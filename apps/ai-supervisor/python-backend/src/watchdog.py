import os
import sys
import time
import threading
from typing import Optional, Callable


class PIDManager:
    """
    Manages PID file creation, stale process detection, and cleanup for the Python AI daemon.
    Guarantees that orphaned lockfiles do not prevent server restarts.
    """

    def __init__(self, pid_file_path: Optional[str] = None):
        if not pid_file_path:
            acc_dir = os.path.join(os.path.expanduser("~"), ".acc")
            os.makedirs(acc_dir, exist_ok=True)
            self.pid_file_path = os.path.join(acc_dir, ".acc-python.pid")
        else:
            self.pid_file_path = pid_file_path

    def write_pid(self) -> int:
        current_pid = os.getpid()
        if os.path.exists(self.pid_file_path):
            try:
                with open(self.pid_file_path, "r", encoding="utf-8") as f:
                    old_pid = int(f.read().strip())
                if is_pid_alive(old_pid) and old_pid != current_pid:
                    print(
                        f"[PIDManager] Warning: Detected active daemon running under PID {old_pid}.",
                        flush=True,
                    )
                else:
                    print(
                        f"[PIDManager] Overwriting stale PID file (previous PID {old_pid}).",
                        flush=True,
                    )
            except Exception:
                pass

        try:
            with open(self.pid_file_path, "w", encoding="utf-8") as f:
                f.write(str(current_pid))
            print(f"[PIDManager] Wrote daemon PID {current_pid} to {self.pid_file_path}", flush=True)
        except Exception as e:
            print(f"[PIDManager] Error writing PID file: {e}", flush=True)

        return current_pid

    def remove_pid(self) -> None:
        try:
            if os.path.exists(self.pid_file_path):
                os.remove(self.pid_file_path)
                print(f"[PIDManager] Cleaned up PID file at {self.pid_file_path}", flush=True)
        except Exception as e:
            print(f"[PIDManager] Error removing PID file: {e}", flush=True)


def is_pid_alive(pid: int) -> bool:
    """
    Cross-platform check to determine if a process with the given PID is currently active.
    Works natively on Windows, Linux, and macOS.
    """
    if pid <= 0:
        return False

    if sys.platform == "win32":
        try:
            import ctypes
            # PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            SYNCHRONIZE = 0x00100000
            PROCESS_QUERY_INFORMATION = 0x0400
            handle = ctypes.windll.kernel32.OpenProcess(
                PROCESS_QUERY_INFORMATION | SYNCHRONIZE, False, pid
            )
            if handle:
                # Check exit code
                exit_code = ctypes.c_ulong()
                ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
                ctypes.windll.kernel32.CloseHandle(handle)
                # STILL_ACTIVE = 259
                return exit_code.value == 259
            return False
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def start_parent_watchdog(
    parent_pid: int,
    poll_interval_sec: float = 1.0,
    on_terminate: Optional[Callable[[], None]] = None,
) -> threading.Thread:
    """
    Spawns a daemon thread that continuously probes whether the parent process is alive.
    If the parent process dies, immediately invokes on_terminate callback or sys.exit(0)
    to prevent zombie orphan processes.
    """
    def _watch():
        print(f"[Watchdog] Active monitoring parent PID {parent_pid} (interval: {poll_interval_sec}s)", flush=True)
        while True:
            time.sleep(poll_interval_sec)
            if not is_pid_alive(parent_pid):
                print(
                    f"\n[Watchdog] CRITICAL: Parent process {parent_pid} terminated. Auto-terminating child daemon to prevent zombie process.",
                    flush=True,
                )
                if on_terminate:
                    try:
                        on_terminate()
                    except Exception:
                        pass
                sys.exit(0)

    thread = threading.Thread(target=_watch, name="ParentWatchdogThread", daemon=True)
    thread.start()
    return thread
