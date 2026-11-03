use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(windows)]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

pub struct ManagedWorkerState {
    pub is_adopted: AtomicBool,
    #[cfg(windows)]
    pub job_handle: std::sync::Mutex<Option<usize>>,
    pub child_process: std::sync::Mutex<Option<Child>>,
}

impl ManagedWorkerState {
    pub fn new() -> Self {
        Self {
            is_adopted: AtomicBool::new(false),
            #[cfg(windows)]
            job_handle: std::sync::Mutex::new(None),
            child_process: std::sync::Mutex::new(None),
        }
    }
}

pub fn is_port_listening(port: u16) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_millis(300)).is_ok()
}

pub fn find_repo_root() -> PathBuf {
    let mut current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for _ in 0..6 {
        if current.join("pnpm-workspace.yaml").exists() || current.join("bun.lock").exists() {
            return current;
        }
        if let Some(parent) = current.parent() {
            current = parent.to_path_buf();
        } else {
            break;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn find_bun_binary() -> String {
    #[cfg(windows)]
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let candidate = PathBuf::from(profile).join(".bun").join("bin").join("bun.exe");
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    #[cfg(not(windows))]
    if let Ok(home) = std::env::var("HOME") {
        let candidate = PathBuf::from(home).join(".bun").join("bin").join("bun");
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    "bun".to_string()
}

pub fn bootstrap_or_adopt_worker(state: &Arc<ManagedWorkerState>, port: u16) -> Result<(), String> {
    if is_port_listening(port) {
        println!("[DesktopHost] Worker already active on port {}. Adopting instance.", port);
        state.is_adopted.store(true, Ordering::SeqCst);
        return Ok(());
    }

    println!("[DesktopHost] Worker offline on port {}. Auto-spawning background daemon...", port);
    state.is_adopted.store(false, Ordering::SeqCst);

    let repo_root = find_repo_root();
    let worker_script = repo_root.join("apps").join("worker").join("src").join("index.ts");
    let bun_bin = find_bun_binary();

    let mut cmd = Command::new(&bun_bin);
    cmd.arg("run")
        .arg(&worker_script)
        .current_dir(repo_root.join("apps").join("worker"))
        .env("SUPERVISOR_PORT", port.to_string())
        .env("NODE_ENV", "production");

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn worker daemon: {}", e))?;

    #[cfg(windows)]
    {
        unsafe {
            let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null_mut());
            if job != std::ptr::null_mut() {
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const _,
                    std::mem::size_of_val(&info) as u32,
                );
                AssignProcessToJobObject(job, child.as_raw_handle() as HANDLE);
                let mut handle_guard = state.job_handle.lock().unwrap();
                *handle_guard = Some(job as usize);
            }
        }
    }

    {
        let mut child_guard = state.child_process.lock().unwrap();
        *child_guard = Some(child);
    }

    // Await port readiness (up to 12 seconds)
    let start_wait = Instant::now();
    while start_wait.elapsed() < Duration::from_secs(12) {
        if is_port_listening(port) {
            println!("[DesktopHost] Worker daemon successfully initialized on port {}.", port);
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    Err(format!("Worker failed to open port {} within 12 seconds.", port))
}

pub fn shutdown_spawned_worker(state: &Arc<ManagedWorkerState>) {
    if state.is_adopted.load(Ordering::SeqCst) {
        println!("[DesktopHost] Worker was adopted; leaving background daemon running.");
        return;
    }

    println!("[DesktopHost] Shutting down auto-spawned worker daemon...");
    let mut child_guard = state.child_process.lock().unwrap();
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
    }

    #[cfg(windows)]
    {
        let mut job_guard = state.job_handle.lock().unwrap();
        if let Some(job) = job_guard.take() {
            unsafe {
                CloseHandle(job as HANDLE);
            }
        }
    }
}
