pub mod process;
pub mod sse;
pub mod tray;

use process::{bootstrap_or_adopt_worker, shutdown_spawned_worker, ManagedWorkerState};
use std::sync::Arc;

pub fn run() {
    let worker_state = Arc::new(ManagedWorkerState::new());
    let worker_state_exit = Arc::clone(&worker_state);

    tauri::Builder::default()
        .setup({
            let worker_state = Arc::clone(&worker_state);
            move |app| {
                // 1. Setup native Windows 11 System Tray
                if let Err(err) = tray::setup_tray(app.handle()) {
                    eprintln!("[DesktopHost] Failed to initialize system tray: {}", err);
                }

                // 2. Ensure @acc/worker daemon is active (auto-spawn with Windows Job Object or adopt)
                let worker_port = 3333;
                if let Err(err) = bootstrap_or_adopt_worker(&worker_state, worker_port) {
                    eprintln!("[DesktopHost] Warning during worker initialization: {}", err);
                }

                // 3. Connect real-time SSE listener to port 3333 to update tray status icon
                sse::start_sse_tray_listener(app.handle().clone(), worker_port);

                Ok(())
            }
        })
        .on_window_event(|window, event| {
            // Close button hides window into system tray instead of killing the app
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                shutdown_spawned_worker(&worker_state_exit);
            }
        });
}
