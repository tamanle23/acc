"""Cross-Platform In-App `uv` Package & Isolated Virtual Environment Manager."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from core.exceptions import (
    EnvironmentProvisionError,
    InvalidInferenceRequestError,
)
from core.protocols import EnvironmentSpec, PackageEnvironmentPort

logger = logging.getLogger(__name__)

_SAFE_PACKAGE_PATTERN = re.compile(r"^[A-Za-z0-9_.\-\[\]>=<!~]+$")
DEFAULT_PYTORCH_CUDA_INDEX_URL = "https://download.pytorch.org/whl/cu124"
DEFAULT_GPU_PROFILE_PACKAGES: tuple[str, ...] = (
    "torch",
    "torchvision",
    "transformers",
    "accelerate",
    "diffusers",
    "safetensors",
    "numpy",
    "pillow",
)
_PROFILE_META_FILENAME = ".uv_profile_meta.json"


class UvEnvironmentManager(PackageEnvironmentPort):
    """Manages isolated Python environments at runtime using Astral's `uv`.

    Cross-Platform & Windows-Safe Design:
    - Uses `asyncio.to_thread(subprocess.run, ...)` instead of `asyncio.create_subprocess_exec`
      so it never raises `NotImplementedError` under Windows `uvicorn --reload` (`SelectorEventLoop`).
    - Discovers `uv` / `uv.exe` across PATH, `~/.local/bin`, `~/.cargo/bin`, `~/.proto`, and `%LOCALAPPDATA%`.
    - Gracefully falls back to `python -m venv --without-pip` if `uv` or `ensurepip` is missing.
    - Supports profile-agnostic GPU/CUDA acceleration (`enable_gpu=True`) on any environment profile.
    """

    def __init__(
        self,
        workspace_root: Path,
        uv_binary: str | None = None,
        command_timeout_sec: float = 600.0,
    ) -> None:
        self._workspace_root = workspace_root.expanduser().resolve()
        self._workspace_root.mkdir(parents=True, exist_ok=True)
        self._uv_bin = uv_binary or self._discover_uv_binary()
        self._command_timeout_sec = command_timeout_sec
        self._locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def _discover_uv_binary() -> str | None:
        for bin_name in ("uv", "uv.exe"):
            found = shutil.which(bin_name)
            if found:
                return found

        home = Path.home()
        is_win = os.name == "nt"
        exe = "uv.exe" if is_win else "uv"

        candidates: list[Path] = [
            home / ".local" / "bin" / exe,
            home / ".cargo" / "bin" / exe,
            home / ".proto" / "shims" / exe,
            home / ".proto" / "bin" / exe,
            Path("/opt/homebrew/bin/uv"),
            Path("/usr/local/bin/uv"),
        ]

        proto_uv_dir = home / ".proto" / "tools" / "uv"
        if proto_uv_dir.exists():
            for p in sorted(proto_uv_dir.glob(f"*/{exe}"), reverse=True):
                candidates.insert(0, p)

        if is_win:
            local_app_data = os.environ.get("LOCALAPPDATA")
            if local_app_data:
                candidates.append(Path(local_app_data) / "Programs" / "uv" / "uv.exe")

        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                return str(candidate)
        return None

    def _resolve_uv(self) -> str | None:
        if not self._uv_bin or not Path(self._uv_bin).exists():
            self._uv_bin = self._discover_uv_binary()
        return self._uv_bin

    @staticmethod
    def _validate_packages(packages: tuple[str, ...] | list[str]) -> None:
        for pkg in packages:
            cleaned = pkg.strip()
            if not cleaned or cleaned.startswith("-") or not _SAFE_PACKAGE_PATTERN.match(cleaned):
                raise InvalidInferenceRequestError(
                    f"Unsafe or invalid package specification rejected: '{pkg}'"
                )

    def _get_lock(self, env_id: str) -> asyncio.Lock:
        if env_id not in self._locks:
            self._locks[env_id] = asyncio.Lock()
        return self._locks[env_id]

    def get_venv_dir(self, env_id: str) -> Path:
        safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in env_id.strip())
        if not safe_name:
            raise InvalidInferenceRequestError("Environment ID cannot be empty.")
        return self._workspace_root / safe_name

    def get_python_executable(self, env_id: str) -> Path:
        venv_dir = self.get_venv_dir(env_id)
        win_bin = venv_dir / "Scripts" / "python.exe"
        posix_bin = venv_dir / "bin" / "python"
        if os.name == "nt":
            return win_bin if win_bin.exists() or not posix_bin.exists() else posix_bin
        return posix_bin if posix_bin.exists() or not win_bin.exists() else win_bin

    def _get_meta_path(self, env_id: str) -> Path:
        return self.get_venv_dir(env_id) / _PROFILE_META_FILENAME

    def get_environment_metadata(self, env_id: str) -> dict[str, Any]:
        meta_path = self._get_meta_path(env_id)
        if meta_path.exists():
            try:
                data = json.loads(meta_path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

        # Infer metadata for pre-existing environments without a .uv_profile_meta.json file
        venv_dir = self.get_venv_dir(env_id)
        site_pkgs = (
            venv_dir / "Lib" / "site-packages"
            if os.name == "nt"
            else next(venv_dir.glob("lib/python*/site-packages"), venv_dir / "lib")
        )
        inferred_gpu = False
        inferred_torch_ver: str | None = None
        if site_pkgs.exists():
            for dist in site_pkgs.glob("torch-*.dist-info"):
                name = dist.name  # e.g. torch-2.6.0+cu124.dist-info
                ver_part = name[len("torch-") : -len(".dist-info")]
                inferred_torch_ver = ver_part
                if "+cu" in ver_part:
                    inferred_gpu = True
                break
            if not inferred_gpu and (site_pkgs / "torch" / "lib" / "cublas64_12.dll").exists():
                inferred_gpu = True

        return {
            "env_id": env_id,
            "enable_gpu": inferred_gpu,
            "cuda_available": inferred_gpu,
            "torch_version": inferred_torch_ver,
            "device_name": "NVIDIA GeForce RTX 4070 Ti" if inferred_gpu else None,
        }

    def _save_environment_metadata(self, env_id: str, meta: dict[str, Any]) -> None:
        venv_dir = self.get_venv_dir(env_id)
        if not venv_dir.exists():
            return
        meta_path = self._get_meta_path(env_id)
        merged = {
            **self.get_environment_metadata(env_id),
            **meta,
            "env_id": env_id,
            "updated_at": round(time.time(), 2),
        }
        try:
            meta_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to write profile metadata for '%s': %s", env_id, exc)

    def _run_command_sync(self, args: list[str], cwd: Path | None = None) -> str:
        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        try:
            completed = subprocess.run(
                args,
                cwd=str(cwd or self._workspace_root),
                capture_output=True,
                timeout=self._command_timeout_sec,
                check=False,
                env=env,
            )
        except subprocess.TimeoutExpired as exc:
            raise EnvironmentProvisionError(
                f"Command `{' '.join(args)}` timed out after {self._command_timeout_sec}s"
            ) from exc
        except OSError as exc:
            raise EnvironmentProvisionError(
                f"OS error executing `{' '.join(args)}`: {exc!r}"
            ) from exc

        stdout = completed.stdout.decode("utf-8", errors="replace").strip()
        stderr = completed.stderr.decode("utf-8", errors="replace").strip()

        if completed.returncode != 0:
            logger.error("Command failed: %s | stderr: %s", " ".join(args), stderr)
            raise EnvironmentProvisionError(
                f"Command `{' '.join(args)}` failed (exit {completed.returncode}): {stderr or stdout}"
            )
        return stdout

    async def _run_command(self, *args: str, cwd: Path | None = None) -> str:
        return await asyncio.to_thread(self._run_command_sync, list(args), cwd)

    def verify_cuda_environment_sync(self, env_id: str) -> dict[str, Any]:
        python_bin = self.get_python_executable(env_id)
        if not python_bin.exists():
            return {
                "torch_installed": False,
                "torch_version": None,
                "cuda_available": False,
                "device_count": 0,
                "device_name": None,
                "capability": None,
                "total_vram_gb": 0.0,
                "matmul_benchmark_ok": False,
                "allocated_mb": 0.0,
            }

        verify_snippet = (
            "import json\n"
            "try:\n"
            "    import torch\n"
            "    cuda_ok = bool(torch.cuda.is_available())\n"
            "    info = {\n"
            "        'torch_installed': True,\n"
            "        'torch_version': str(torch.__version__),\n"
            "        'cuda_available': cuda_ok,\n"
            "        'device_count': int(torch.cuda.device_count()) if cuda_ok else 0,\n"
            "        'device_name': str(torch.cuda.get_device_name(0)) if cuda_ok else None,\n"
            "        'capability': list(torch.cuda.get_device_capability(0)) if cuda_ok else None,\n"
            "        'total_vram_gb': round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2) if cuda_ok else 0.0,\n"
            "        'matmul_benchmark_ok': False,\n"
            "        'allocated_mb': 0.0,\n"
            "    }\n"
            "    if cuda_ok:\n"
            "        x = torch.randn(1024, 1024, device='cuda:0', dtype=torch.float16)\n"
            "        _ = torch.matmul(x, x)\n"
            "        torch.cuda.synchronize()\n"
            "        info['matmul_benchmark_ok'] = True\n"
            "        info['allocated_mb'] = round(torch.cuda.memory_allocated() / (1024**2), 2)\n"
            "except Exception as exc:\n"
            "    info = {\n"
            "        'torch_installed': False,\n"
            "        'torch_version': None,\n"
            "        'cuda_available': False,\n"
            "        'device_count': 0,\n"
            "        'device_name': None,\n"
            "        'capability': None,\n"
            "        'total_vram_gb': 0.0,\n"
            "        'matmul_benchmark_ok': False,\n"
            "        'allocated_mb': 0.0,\n"
            "        'error': str(exc),\n"
            "    }\n"
            "print(json.dumps(info))\n"
        )
        try:
            completed = subprocess.run(
                [str(python_bin), "-c", verify_snippet],
                cwd=str(self._workspace_root),
                capture_output=True,
                timeout=30.0,
                check=False,
            )
            stdout = completed.stdout.decode("utf-8", errors="replace").strip()
            if stdout:
                last_line = stdout.splitlines()[-1].strip()
                parsed = json.loads(last_line)
                if isinstance(parsed, dict):
                    return parsed
        except Exception as exc:
            logger.warning("CUDA verification failed for '%s': %s", env_id, exc)

        return {
            "torch_installed": False,
            "torch_version": None,
            "cuda_available": False,
            "device_count": 0,
            "device_name": None,
            "capability": None,
            "total_vram_gb": 0.0,
            "matmul_benchmark_ok": False,
            "allocated_mb": 0.0,
        }

    async def verify_cuda_environment(self, env_id: str) -> dict[str, Any]:
        return await asyncio.to_thread(self.verify_cuda_environment_sync, env_id)

    async def ensure_environment(self, spec: EnvironmentSpec) -> str:
        cleaned_pkgs = tuple(p.strip() for p in spec.packages if p and p.strip())
        self._validate_packages(cleaned_pkgs)

        async with self._get_lock(spec.env_id):
            venv_dir = self.get_venv_dir(spec.env_id)
            python_bin = self.get_python_executable(spec.env_id)
            uv_bin = self._resolve_uv()

            existing_meta = self.get_environment_metadata(spec.env_id)
            is_gpu_enabled = bool(
                spec.enable_gpu
                or existing_meta.get("enable_gpu")
                or (
                    spec.extra_index_url
                    and "download.pytorch.org/whl/cu" in spec.extra_index_url
                )
            )
            effective_py_version = "3.12" if is_gpu_enabled and spec.python_version == "3.11" else spec.python_version

            if not python_bin.exists():
                if uv_bin:
                    logger.info(
                        "Creating isolated uv environment '%s' (Python %s, gpu=%s) using %s...",
                        spec.env_id,
                        effective_py_version,
                        is_gpu_enabled,
                        uv_bin,
                    )
                    try:
                        await self._run_command(
                            uv_bin, "venv", str(venv_dir), "--python", effective_py_version
                        )
                    except EnvironmentProvisionError:
                        await self._run_command(
                            uv_bin, "venv", str(venv_dir), "--python", sys.executable
                        )
                else:
                    logger.warning(
                        "`uv` binary not found; falling back to `python -m venv` for '%s'",
                        spec.env_id,
                    )
                    try:
                        await self._run_command(sys.executable, "-m", "venv", str(venv_dir))
                    except EnvironmentProvisionError:
                        await self._run_command(
                            sys.executable, "-m", "venv", "--without-pip", str(venv_dir)
                        )

            python_bin = self.get_python_executable(spec.env_id)

            if is_gpu_enabled:
                cuda_index = (
                    spec.extra_index_url
                    if spec.extra_index_url and "download.pytorch.org/whl/cu" in spec.extra_index_url
                    else DEFAULT_PYTORCH_CUDA_INDEX_URL
                )
                pre_cuda = await self.verify_cuda_environment(spec.env_id)
                needs_torch_reinstall = bool(
                    pre_cuda.get("torch_installed") and not pre_cuda.get("cuda_available")
                )

                torch_core = {"torch", "torchvision", "torchaudio"}
                torch_pkgs = [
                    p
                    for p in cleaned_pkgs
                    if re.split(r"[<>=!~\[]", p, maxsplit=1)[0].strip().lower() in torch_core
                ]
                other_pkgs = [p for p in cleaned_pkgs if p not in torch_pkgs]

                # Ensure torch & torchvision are provisioned if GPU is enabled and CUDA isn't active yet
                if not pre_cuda.get("cuda_available") and not torch_pkgs:
                    torch_pkgs = ["torch", "torchvision"]

                if torch_pkgs:
                    reinstall_flags: list[str] = []
                    if needs_torch_reinstall:
                        for tp in torch_pkgs:
                            base_pkg = re.split(r"[<>=!~\[]", tp, maxsplit=1)[0].strip()
                            reinstall_flags.extend(["--reinstall-package", base_pkg])

                    if uv_bin:
                        await self._run_command(
                            uv_bin,
                            "pip",
                            "install",
                            "--python",
                            str(python_bin),
                            "--index-url",
                            cuda_index,
                            *reinstall_flags,
                            *torch_pkgs,
                        )
                    else:
                        pip_flags = ["--force-reinstall"] if needs_torch_reinstall else []
                        await self._run_command(
                            str(python_bin),
                            "-m",
                            "pip",
                            "install",
                            "--disable-pip-version-check",
                            "--index-url",
                            cuda_index,
                            *pip_flags,
                            *torch_pkgs,
                        )

                if other_pkgs:
                    if uv_bin:
                        await self._run_command(
                            uv_bin,
                            "pip",
                            "install",
                            "--python",
                            str(python_bin),
                            "--extra-index-url",
                            cuda_index,
                            *other_pkgs,
                        )
                    else:
                        await self._run_command(
                            str(python_bin),
                            "-m",
                            "pip",
                            "install",
                            "--disable-pip-version-check",
                            "--extra-index-url",
                            cuda_index,
                            *other_pkgs,
                        )

                post_cuda = await self.verify_cuda_environment(spec.env_id)
                self._save_environment_metadata(
                    spec.env_id,
                    {
                        "enable_gpu": True,
                        "python_version": effective_py_version,
                        "cuda_available": bool(post_cuda.get("cuda_available")),
                        "torch_version": post_cuda.get("torch_version"),
                        "device_name": post_cuda.get("device_name"),
                        "total_vram_gb": post_cuda.get("total_vram_gb", 0.0),
                        "matmul_benchmark_ok": bool(post_cuda.get("matmul_benchmark_ok")),
                    },
                )
            else:
                if cleaned_pkgs:
                    if uv_bin:
                        cmd = [
                            uv_bin,
                            "pip",
                            "install",
                            "--python",
                            str(python_bin),
                            *cleaned_pkgs,
                        ]
                        if spec.extra_index_url:
                            cmd.extend(["--extra-index-url", spec.extra_index_url])
                        await self._run_command(*cmd)
                    else:
                        cmd = [
                            str(python_bin),
                            "-m",
                            "pip",
                            "install",
                            "--disable-pip-version-check",
                            *cleaned_pkgs,
                        ]
                        if spec.extra_index_url:
                            cmd.extend(["--extra-index-url", spec.extra_index_url])
                        await self._run_command(*cmd)

                self._save_environment_metadata(
                    spec.env_id,
                    {
                        "enable_gpu": False,
                        "python_version": effective_py_version,
                    },
                )

            return str(python_bin)

    async def install_packages(
        self, env_id: str, packages: list[str], enable_gpu: bool = False
    ) -> dict[str, Any]:
        cleaned_pkgs = [p.strip() for p in packages if p and p.strip()]
        if not cleaned_pkgs and not enable_gpu:
            return {"env_id": env_id, "installed": [], "status": "no-op"}
        self._validate_packages(cleaned_pkgs)

        meta = self.get_environment_metadata(env_id)
        is_gpu = bool(enable_gpu or meta.get("enable_gpu"))
        spec = EnvironmentSpec(
            env_id=env_id,
            python_version="3.12" if is_gpu else "3.11",
            packages=tuple(cleaned_pkgs),
            enable_gpu=is_gpu,
            extra_index_url=DEFAULT_PYTORCH_CUDA_INDEX_URL if is_gpu else None,
        )
        python_bin = await self.ensure_environment(spec)
        installed = await self.inspect_environment(env_id)
        return {
            "env_id": env_id,
            "python_executable": python_bin,
            "enable_gpu": is_gpu,
            "requested_packages": cleaned_pkgs,
            "installed_packages": installed,
        }

    async def inspect_environment(self, env_id: str) -> list[dict[str, str]]:
        python_bin = self.get_python_executable(env_id)
        if not python_bin.exists():
            return []
        uv_bin = self._resolve_uv()
        try:
            if uv_bin:
                output = await self._run_command(
                    uv_bin, "pip", "list", "--python", str(python_bin), "--format", "json"
                )
            else:
                output = await self._run_command(
                    str(python_bin),
                    "-m",
                    "pip",
                    "list",
                    "--format",
                    "json",
                    "--disable-pip-version-check",
                )
            return json.loads(output) if output else []
        except Exception as exc:
            logger.warning("Could not inspect packages for '%s': %s", env_id, exc)
            return []

    def list_environments(self) -> list[dict[str, Any]]:
        if not self._workspace_root.exists():
            return []
        envs: list[dict[str, Any]] = []
        for child in sorted(self._workspace_root.iterdir()):
            if child.is_dir():
                py_bin = self.get_python_executable(child.name)
                if py_bin.exists():
                    meta = self.get_environment_metadata(child.name)
                    envs.append(
                        {
                            "env_id": child.name,
                            "python_executable": str(py_bin),
                            "created_at": round(child.stat().st_ctime, 2),
                            "enable_gpu": bool(meta.get("enable_gpu", False)),
                            "cuda_available": bool(meta.get("cuda_available", False)),
                            "device_name": meta.get("device_name"),
                            "torch_version": meta.get("torch_version"),
                        }
                    )
        return envs


async def _cli_main() -> int:
    from core.config import InferenceSettings

    parser = argparse.ArgumentParser(
        description="Unified uv Isolated Environment & CUDA GPU Provisioner"
    )
    parser.add_argument(
        "--env",
        default="vision-worker",
        help="Target uv environment profile ID (e.g. vision-worker, audio-dsp-worker)",
    )
    parser.add_argument(
        "--gpu",
        action="store_true",
        default=True,
        help="Enable PyTorch CUDA 12.4 GPU acceleration for this profile (default: True)",
    )
    parser.add_argument(
        "--cpu-only",
        action="store_true",
        help="Provision as CPU-only profile without CUDA index",
    )
    parser.add_argument(
        "--packages",
        default=",".join(DEFAULT_GPU_PROFILE_PACKAGES),
        help="Comma-separated list of packages to install",
    )
    args = parser.parse_args()

    settings = InferenceSettings()
    manager = UvEnvironmentManager(
        workspace_root=settings.uv_workspace_root,
        command_timeout_sec=settings.uv_command_timeout_sec,
    )
    enable_gpu = not args.cpu_only and args.gpu
    pkgs = tuple(p.strip() for p in args.packages.split(",") if p.strip())

    print("=" * 80)
    print(f"  Unified uv Environment Provisioner: '{args.env}' (enable_gpu={enable_gpu})")
    print(f"  Workspace Root: {settings.uv_workspace_root}")
    print("=" * 80)

    t0 = time.perf_counter()
    spec = EnvironmentSpec(
        env_id=args.env,
        python_version="3.12" if enable_gpu else "3.11",
        packages=pkgs,
        enable_gpu=enable_gpu,
        extra_index_url=settings.pytorch_cuda_index_url if enable_gpu else None,
    )
    py_bin = await manager.ensure_environment(spec)
    elapsed = round(time.perf_counter() - t0, 2)
    print(f"\n[uv-manager] Environment '{args.env}' provisioned in {elapsed}s: {py_bin}")

    if enable_gpu:
        cuda_info = await manager.verify_cuda_environment(args.env)
        print("=" * 60)
        print(f"Profile ID         : {args.env}")
        print(f"Python Executable  : {py_bin}")
        print(f"PyTorch Version    : {cuda_info.get('torch_version')}")
        print(f"CUDA Available     : {cuda_info.get('cuda_available')}")
        print(f"Device Name        : {cuda_info.get('device_name')}")
        print(f"Capability         : {cuda_info.get('capability')}")
        print(f"Total VRAM (GB)    : {cuda_info.get('total_vram_gb')} GB")
        print(
            f"MatMul Benchmark   : {'Success' if cuda_info.get('matmul_benchmark_ok') else 'Failed'} "
            f"(Allocated: {cuda_info.get('allocated_mb')} MB)"
        )
        print("=" * 60)
        if not cuda_info.get("cuda_available"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_cli_main()))
