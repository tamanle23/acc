"""Subprocess Worker Bridge for Python 3.12 + PyTorch CUDA 12.4 (`gpu_worker_bridge.py`).

Provides an asynchronous, non-blocking bridge between the Python 3.14 CPU backend
and the dedicated Python 3.12 CUDA GPU sandbox worker (`gpu_worker.py`).
"""

from __future__ import annotations

import asyncio
import collections
from collections.abc import AsyncIterator
import json
import logging
import os
import subprocess
import sys
import threading
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core.protocols import PackageEnvironmentPort

logger = logging.getLogger(__name__)

_ACTIVE_LOOP: asyncio.AbstractEventLoop | None = None



class GpuWorkerBridge:
    """Manages the persistent lifecycle and JSON IPC protocol with `gpu_worker.py`."""

    def __init__(
        self,
        env_id: str = "vision-worker",
        workspace_root: Path | None = None,
        uv_manager: PackageEnvironmentPort | None = None,
    ) -> None:
        self._env_id = env_id.strip() or "vision-worker"
        self._workspace_root = (
            workspace_root
            if workspace_root is not None
            else Path(
                os.environ.get(
                    "INFERENCE_UV_WORKSPACE_ROOT",
                    str(Path.home() / ".acc" / ".uv_isolated_envs"),
                )
            ).expanduser().resolve()
        )
        self._uv_manager = uv_manager
        self._proc: subprocess.Popen[str] | None = None
        self._lock: asyncio.Lock | None = None
        self._lock_loop: asyncio.AbstractEventLoop | None = None
        self._pending_requests: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._streaming_listeners: dict[str, asyncio.Queue[dict[str, Any]]] = {}
        self._stdout_thread: threading.Thread | None = None
        self._stderr_thread: threading.Thread | None = None
        self._is_shutting_down = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stderr_buffer: collections.deque[str] = collections.deque(maxlen=40)
        self._loaded_engines: set[str] = set()

    @property
    def env_id(self) -> str:
        return self._env_id

    def get_sandbox_python_path(self, env_id: str | None = None) -> Path:
        target_env = (env_id or self._env_id).strip() or self._env_id
        if self._uv_manager is not None:
            return Path(self._uv_manager.get_python_executable(target_env))
        if self._workspace_root.name == ".uv_isolated_envs":
            env_dir = self._workspace_root / target_env
        elif (self._workspace_root / ".uv_isolated_envs").exists():
            env_dir = self._workspace_root / ".uv_isolated_envs" / target_env
        else:
            env_dir = self._workspace_root / target_env
        is_win = os.name == "nt"
        return env_dir / ("Scripts/python.exe" if is_win else "bin/python")

    def is_sandbox_provisioned(self, env_id: str | None = None) -> bool:
        py_bin = self.get_sandbox_python_path(env_id)
        return py_bin.exists() and py_bin.is_file()

    async def ensure_worker_started(self) -> bool:
        if not self.is_sandbox_provisioned():
            logger.info("GPU sandbox '%s' is not provisioned.", self.get_sandbox_python_path())
            return False

        cur_loop = asyncio.get_running_loop()
        self._loop = cur_loop

        if self._proc is not None and self._proc.poll() is None:
            return True

        if self._lock is None or getattr(self, "_lock_loop", None) is not cur_loop:
            self._lock = asyncio.Lock()
            self._lock_loop = cur_loop

        async with self._lock:
            if self._proc is not None and self._proc.poll() is None:
                return True

            if self._proc is not None:
                try:
                    self._proc.terminate()
                    await asyncio.to_thread(self._proc.wait, timeout=2.0)
                except Exception:
                    pass
                self._proc = None

            py_bin = self.get_sandbox_python_path()
            worker_script = (
                Path(__file__).resolve().parent.parent / "workers" / "gpu_worker.py"
            )

            src_dir = Path(__file__).resolve().parents[2]
            env = os.environ.copy()
            env["PYTHONPATH"] = (
                f"{src_dir};{env.get('PYTHONPATH', '')}"
                if os.name == "nt"
                else f"{src_dir}:{env.get('PYTHONPATH', '')}"
            )
            env["PYTHONUTF8"] = "1"
            env["PYTHONUNBUFFERED"] = "1"
            if "INFERENCE_WEIGHTS_CACHE_ROOT" not in env:
                env["INFERENCE_WEIGHTS_CACHE_ROOT"] = str(Path.home() / ".acc" / ".weights_cache")

            logger.info("Spawning GPU Worker: %s %s", py_bin, worker_script)
            try:
                self._proc = subprocess.Popen(
                    [str(py_bin), str(worker_script)],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,  # Line buffered
                    encoding="utf-8",
                    env=env,
                )
                self._is_shutting_down = False
                self._loaded_engines.clear()
                self._stderr_buffer.clear()

                self._stdout_thread = threading.Thread(
                    target=self._read_stdout_worker,
                    args=(self._proc,),
                    daemon=True,
                    name="gpu-bridge-stdout",
                )
                self._stdout_thread.start()

                self._stderr_thread = threading.Thread(
                    target=self._log_stderr_worker,
                    args=(self._proc,),
                    daemon=True,
                    name="gpu-bridge-stderr",
                )
                self._stderr_thread.start()

                logger.info("GPU Worker spawned successfully (PID: %s)", self._proc.pid)
                return True
            except Exception as exc:
                logger.error("Failed to spawn GPU worker: %s", exc)
                self._proc = None
                return False

    def _read_stdout_worker(self, proc: subprocess.Popen[str]) -> None:
        if proc.stdout is None:
            return
        try:
            for raw_line in proc.stdout:
                if self._is_shutting_down or not raw_line:
                    break
                line_str = raw_line.strip()
                if not line_str:
                    continue
                try:
                    data = json.loads(line_str)
                    req_id = data.get("id")
                    ev = data.get("event")

                    # Dispatch to streaming listeners
                    if req_id and req_id in self._streaming_listeners:
                        listener_q = self._streaming_listeners[req_id]
                        if self._loop and self._loop.is_running():
                            self._loop.call_soon_threadsafe(listener_q.put_nowait, data)

                    # Non-streaming commands, or streaming terminal responses
                    if req_id and req_id in self._pending_requests:
                        if ev not in ("token", "stage_complete"):
                            fut = self._pending_requests.pop(req_id, None)
                            if fut is not None and not fut.done():
                                loop = fut.get_loop()
                                if loop.is_running():
                                    loop.call_soon_threadsafe(fut.set_result, data)
                except json.JSONDecodeError:
                    logger.warning("[gpu_worker stdout raw]: %s", line_str)
        except Exception as exc:
            if not self._is_shutting_down:
                logger.error("Error reading from GPU worker stdout: %s", exc)

        # Cancel remaining requests with rich diagnostics if process terminated
        exit_code = proc.poll()
        stderr_tail = "\n".join(list(self._stderr_buffer)[-15:])
        err_msg = (
            f"GPU worker process terminated unexpectedly (exit code {exit_code}).\n"
            f"Recent worker stderr:\n{stderr_tail}"
            if stderr_tail
            else f"GPU worker process terminated unexpectedly (exit code {exit_code})."
        )
        self._loaded_engines.clear()
        for fut in list(self._pending_requests.values()):
            if not fut.done():
                try:
                    loop = fut.get_loop()
                    if loop.is_running():
                        loop.call_soon_threadsafe(
                            fut.set_exception,
                            RuntimeError(err_msg),
                        )
                except Exception:
                    pass
        self._pending_requests.clear()

        for queue in list(self._streaming_listeners.values()):
            if self._loop and self._loop.is_running():
                self._loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {
                        "status": "error",
                        "event": "error",
                        "error": err_msg,
                        "error_type": "WORKER_TERMINATED",
                    },
                )
        self._streaming_listeners.clear()

    def _log_stderr_worker(self, proc: subprocess.Popen[str]) -> None:
        if proc.stderr is None:
            return
        try:
            for raw_line in proc.stderr:
                if self._is_shutting_down or not raw_line:
                    break
                line_str = raw_line.strip()
                if line_str:
                    self._stderr_buffer.append(line_str)
                    logger.info("[gpu_worker stderr]: %s", line_str)
        except Exception:
            pass

    async def send_command(
        self, cmd: str, payload: dict[str, Any], timeout_sec: float = 60.0
    ) -> dict[str, Any]:
        if not await self.ensure_worker_started():
            raise RuntimeError(
                f"GPU worker is not available. Please provision 'uv-sandbox:{self._env_id}'."
            )

        assert self._proc is not None and self._proc.stdin is not None

        req_id = f"gpu-req-{uuid.uuid4().hex[:8]}"
        req_packet = {"id": req_id, "cmd": cmd, **payload}
        encoded = json.dumps(req_packet) + "\n"

        loop = asyncio.get_running_loop()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending_requests[req_id] = fut

        def _write_stdin():
            assert self._proc is not None and self._proc.stdin is not None
            self._proc.stdin.write(encoded)
            self._proc.stdin.flush()

        await asyncio.to_thread(_write_stdin)

        try:
            return await asyncio.wait_for(fut, timeout=timeout_sec)
        except asyncio.TimeoutError as exc:
            self._pending_requests.pop(req_id, None)
            raise TimeoutError(f"GPU Worker command '{cmd}' timed out after {timeout_sec}s") from exc

    async def send_streaming_command(
        self, cmd: str, payload: dict[str, Any], timeout_sec: float = 120.0
    ) -> AsyncIterator[dict[str, Any]]:
        if not await self.ensure_worker_started():
            raise RuntimeError(
                f"GPU worker is not available. Please provision 'uv-sandbox:{self._env_id}'."
            )

        assert self._proc is not None and self._proc.stdin is not None

        req_id = f"gpu-stream-{uuid.uuid4().hex[:8]}"
        req_packet = {"id": req_id, "cmd": cmd, **payload}
        encoded = json.dumps(req_packet) + "\n"

        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._streaming_listeners[req_id] = queue

        def _write_stdin() -> None:
            assert self._proc is not None and self._proc.stdin is not None
            self._proc.stdin.write(encoded)
            self._proc.stdin.flush()

        await asyncio.to_thread(_write_stdin)

        completed_normally = False
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=timeout_sec)
                except asyncio.TimeoutError as exc:
                    await self.cancel_command(req_id)
                    raise TimeoutError(f"GPU Worker streaming command '{cmd}' timed out after {timeout_sec}s") from exc

                yield item
                ev = item.get("event")
                st = item.get("status")
                if ev == "done" or ev == "error" or st in ("error", "oom_error"):
                    completed_normally = True
                    break
        finally:
            self._streaming_listeners.pop(req_id, None)
            if not completed_normally:
                await self.cancel_command(req_id)

    async def cancel_command(self, target_id: str) -> dict[str, Any]:
        """Send immediate cancel command to GPU worker daemon to halt in-flight generation."""
        if self._proc is None or self._proc.poll() is not None:
            return {"cancelled": False, "target_id": target_id}
        try:
            return await self.send_command("cancel", {"target_id": target_id}, timeout_sec=5.0)
        except Exception as exc:
            logger.warning("Failed to cancel GPU worker command '%s': %s", target_id, exc)
            return {"cancelled": False, "target_id": target_id, "error": str(exc)}

    async def pin_engine(self, engine_id: str, pinned: bool = True) -> dict[str, Any]:
        """Pin or unpin engine in GPU VRAM to control LRU eviction behavior."""
        if not self.is_sandbox_provisioned():
            return {"engine_id": engine_id, "pinned": pinned, "pinned_engines": []}
        return await self.send_command("pin", {"engine_id": engine_id, "pinned": pinned}, timeout_sec=10.0)

    async def execute_dag_chain(
        self, stages: list[dict[str, Any]], initial_input: Any, timeout_sec: float = 120.0
    ) -> dict[str, Any]:
        """Execute multi-modal DAG chain in-worker with direct GPU tensor handoffs."""
        return await self.send_command(
            "dag_chain",
            {"stages": stages, "initial_input": initial_input},
            timeout_sec=timeout_sec,
        )

    async def get_health(self) -> dict[str, Any]:
        if not self.is_sandbox_provisioned():
            return {
                "env_id": self._env_id,
                "provisioned": False,
                "cuda_available": False,
                "status": "not_provisioned",
                "message": f"GPU Sandbox (~/.acc/.uv_isolated_envs/{self._env_id}) is not provisioned.",
            }
        try:
            res = await self.send_command("health", {}, timeout_sec=20.0)
            return {
                "env_id": self._env_id,
                "provisioned": True,
                "status": "ready",
                **res.get("hardware", {}),
            }
        except Exception as exc:
            return {
                "env_id": self._env_id,
                "provisioned": True,
                "cuda_available": False,
                "status": "worker_error",
                "error": str(exc),
            }

    async def load_model(
        self,
        engine_id: str,
        model_id: str,
        task: str,
        weight_tier: str = "studio_bf16",
        precision: str = "bf16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "engine_id": engine_id,
            "model_id": model_id,
            "task": task,
            "weight_tier": weight_tier,
            "precision": precision,
            "offload_strategy": offload_strategy,
        }
        if vram_mb:
            payload["vram_mb"] = vram_mb

        res = await self.send_command(
            "load",
            payload,
            timeout_sec=120.0,
        )
        if res.get("status") in ("ok", "loaded"):
            self._loaded_engines.add(engine_id)
        return res

    def is_engine_loaded(self, engine_id: str) -> bool:
        """Return True if engine is confirmed resident inside the running GPU worker process."""
        return bool(
            self._proc is not None
            and self._proc.poll() is None
            and engine_id in self._loaded_engines
        )

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop
        global _ACTIVE_LOOP
        if loop is not None and loop.is_running():
            _ACTIVE_LOOP = loop

    async def infer(self, engine_id: str, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        return await self.send_command(
            "infer",
            {"engine_id": engine_id, "inputs": inputs, "parameters": parameters},
            timeout_sec=90.0,
        )

    async def unload(self, engine_id: str) -> dict[str, Any]:
        res = await self.send_command("unload", {"engine_id": engine_id}, timeout_sec=10.0)
        self._loaded_engines.discard(engine_id)
        return res

    async def list_voices(self, engine_id: str) -> list[dict[str, str]]:
        if not self.is_sandbox_provisioned():
            return []
        try:
            res = await self.send_command("list_voices", {"engine_id": engine_id}, timeout_sec=5.0)
            if res.get("status") == "ok":
                return res.get("voices", [])
        except Exception:
            pass
        return []
        return res

    def load_model_sync(
        self,
        engine_id: str,
        model_id: str,
        task: str,
        weight_tier: str = "studio_bf16",
        precision: str = "bf16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
    ) -> dict[str, Any]:
        """Synchronously load a model onto the GPU worker daemon via the active event loop."""
        loop = self._loop
        if loop is None or not loop.is_running():
            global _ACTIVE_LOOP
            if _ACTIVE_LOOP is not None and _ACTIVE_LOOP.is_running():
                loop = _ACTIVE_LOOP
        if loop is None or not loop.is_running():
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        if loop is None or not loop.is_running():
            for b in _gpu_bridges.values():
                if b._loop is not None and b._loop.is_running():
                    loop = b._loop
                    break
        if loop is None or not loop.is_running():
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = None
        if loop is None or not loop.is_running():
            raise RuntimeError("GPU bridge event loop is not running.")
        self._loop = loop
        fut = asyncio.run_coroutine_threadsafe(
            self.load_model(
                engine_id=engine_id,
                model_id=model_id,
                task=task,
                weight_tier=weight_tier,
                precision=precision,
                offload_strategy=offload_strategy,
                vram_mb=vram_mb,
            ),
            loop,
        )
        return fut.result(timeout=120.0)

    def infer_sync(
        self, engine_id: str, inputs: Any, parameters: dict[str, Any]
    ) -> dict[str, Any]:
        loop = self._loop
        if loop is None or not loop.is_running():
            global _ACTIVE_LOOP
            if _ACTIVE_LOOP is not None and _ACTIVE_LOOP.is_running():
                loop = _ACTIVE_LOOP
        if loop is None or not loop.is_running():
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        if loop is None or not loop.is_running():
            for b in _gpu_bridges.values():
                if b._loop is not None and b._loop.is_running():
                    loop = b._loop
                    break
        if loop is None or not loop.is_running():
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = None
        if loop is None or not loop.is_running():
            raise RuntimeError("GPU bridge event loop is not running.")
        self._loop = loop
        fut = asyncio.run_coroutine_threadsafe(
            self.infer(engine_id, inputs, parameters), loop
        )
        return fut.result(timeout=90.0)

    def unload_sync(self, engine_id: str) -> dict[str, Any]:
        loop = self._loop
        if loop is None or not loop.is_running():
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        if loop is None or not loop.is_running():
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = None
        if loop is None or not loop.is_running():
            return {}
        self._loop = loop
        fut = asyncio.run_coroutine_threadsafe(self.unload(engine_id), loop)
        return fut.result(timeout=10.0)

    async def stop(self) -> None:
        self._is_shutting_down = True
        if self._proc is not None and self._proc.poll() is None:
            try:
                self._proc.terminate()
                await asyncio.to_thread(self._proc.wait, timeout=3.0)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None
        self._pending_requests.clear()


_gpu_bridges: dict[str, GpuWorkerBridge] = {}
_default_uv_manager: PackageEnvironmentPort | None = None


def get_gpu_worker_bridge(
    env_id: str | None = None,
    workspace_root: Path | None = None,
    uv_manager: PackageEnvironmentPort | None = None,
) -> GpuWorkerBridge:
    global _default_uv_manager
    if uv_manager is not None:
        _default_uv_manager = uv_manager

    active_uv = uv_manager or _default_uv_manager

    if env_id is None:
        resolved_env_id = "vision-worker"
        if active_uv is not None:
            try:
                envs = active_uv.list_environments()
                gpu_envs = [e for e in envs if e.get("enable_gpu")]
                if gpu_envs:
                    resolved_env_id = str(gpu_envs[0]["env_id"])
                elif envs:
                    resolved_env_id = str(envs[0]["env_id"])
            except Exception:
                pass
        else:
            root = (
                workspace_root
                if workspace_root is not None
                else Path(
                    os.environ.get(
                        "INFERENCE_UV_WORKSPACE_ROOT",
                        str(Path.home() / ".acc" / ".uv_isolated_envs"),
                    )
                ).expanduser().resolve()
            )
            if (root / "vision-worker").exists():
                resolved_env_id = "vision-worker"
            elif root.exists():
                for d in sorted(root.iterdir()):
                    if d.is_dir():
                        resolved_env_id = d.name
                        break
        env_id = resolved_env_id

    bridge = _gpu_bridges.get(env_id)
    if bridge is None:
        bridge = GpuWorkerBridge(
            env_id=env_id,
            workspace_root=workspace_root,
            uv_manager=active_uv,
        )
        _gpu_bridges[env_id] = bridge
    elif active_uv is not None and bridge._uv_manager is None:
        bridge._uv_manager = active_uv
    return bridge
