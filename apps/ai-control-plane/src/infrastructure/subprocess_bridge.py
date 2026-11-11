"""Cross-Platform Isolated Subprocess Worker Bridge for `uv`-provisioned Virtual Environments."""

from __future__ import annotations

import asyncio
import json
import subprocess
from typing import Any

from core.exceptions import InferenceBackendError
from core.protocols import EnvironmentSpec, PackageEnvironmentPort


class IsolatedUvWorkerBridge:
    """Executes Python inference workloads inside a `uv`-managed isolated venv."""

    def __init__(self, uv_manager: PackageEnvironmentPort, spec: EnvironmentSpec) -> None:
        self._uv_manager = uv_manager
        self._spec = spec
        self._python_bin: str | None = None

    async def initialize(self) -> str:
        self._python_bin = await self._uv_manager.ensure_environment(self._spec)
        return self._python_bin

    def _run_sync(
        self, python_bin: str, code: str, payload: dict[str, Any], timeout_sec: float
    ) -> dict[str, Any]:
        try:
            completed = subprocess.run(
                [python_bin, "-c", code],
                input=json.dumps(payload).encode(),
                capture_output=True,
                timeout=timeout_sec,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise InferenceBackendError(
                f"Isolated worker '{self._spec.env_id}' timed out after {timeout_sec}s"
            ) from exc

        if completed.returncode != 0:
            stderr_msg = completed.stderr.decode("utf-8", errors="replace").strip()
            raise InferenceBackendError(
                f"Isolated uv worker '{self._spec.env_id}' failed: {stderr_msg}"
            )
        raw_stdout = completed.stdout.decode("utf-8", errors="replace").strip()
        if not raw_stdout:
            return {"status": "ok", "stdout": ""}
        try:
            parsed = json.loads(raw_stdout)
            return parsed if isinstance(parsed, dict) else {"result": parsed}
        except json.JSONDecodeError:
            # Scan lines in reverse in case user script printed debug statements before final JSON line
            for line in reversed(raw_stdout.splitlines()):
                candidate = line.strip()
                if candidate.startswith("{") and candidate.endswith("}"):
                    try:
                        parsed_line = json.loads(candidate)
                        if isinstance(parsed_line, dict):
                            return parsed_line
                    except json.JSONDecodeError:
                        continue
            return {
                "status": "completed_plain_stdout",
                "stdout": raw_stdout,
                "lines": raw_stdout.splitlines(),
            }

    async def run_isolated_script(
        self, code: str, payload: dict[str, Any], timeout_sec: float = 60.0
    ) -> dict[str, Any]:
        if not self._python_bin:
            await self.initialize()
        assert self._python_bin is not None
        return await asyncio.to_thread(
            self._run_sync, self._python_bin, code, payload, timeout_sec
        )
