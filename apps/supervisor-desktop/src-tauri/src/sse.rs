use futures_util::StreamExt;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

pub fn start_sse_tray_listener(app_handle: AppHandle, port: u16) {
    tauri::async_runtime::spawn(async move {
        let stream_url = format!("http://127.0.0.1:{}/api/telemetry/stream", port);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_default();

        loop {
            match client.get(&stream_url).send().await {
                Ok(response) if response.status().is_success() => {
                    let mut stream = response.bytes_stream();
                    let mut buffer = String::new();

                    while let Some(chunk_result) = stream.next().await {
                        match chunk_result {
                            Ok(bytes) => {
                                let chunk_str = String::from_utf8_lossy(&bytes);
                                buffer.push_str(&chunk_str);

                                while let Some(pos) = buffer.find("\n\n") {
                                    let message = buffer[..pos].to_string();
                                    buffer = buffer[pos + 2..].to_string();

                                    for line in message.lines() {
                                        if let Some(json_str) = line.strip_prefix("data: ") {
                                            if let Ok(val) = serde_json::from_str::<Value>(json_str) {
                                                process_telemetry_snapshot(&app_handle, &val);
                                            }
                                        }
                                    }
                                }
                            }
                            Err(_) => break,
                        }
                    }
                }
                _ => {
                    // When worker is offline or reconnecting, reflect yellow status
                    crate::tray::update_tray_status(
                        &app_handle,
                        "yellow",
                        "ACC Control Plane (Connecting to Worker...)",
                    );
                }
            }

            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });
}

fn process_telemetry_snapshot(app: &AppHandle, snapshot: &Value) {
    let mut has_crash_loop = false;
    let mut has_degraded = false;
    let mut all_running = true;
    let mut running_count = 0;
    let mut total_count = 0;

    if let Some(services) = snapshot.get("services").and_then(|s| s.as_object()) {
        for (_name, state) in services {
            total_count += 1;
            let status = state.get("status").and_then(|s| s.as_str()).unwrap_or("STOPPED");
            match status {
                "CRASH_LOOP" => has_crash_loop = true,
                "STARTING" | "PROVISIONING" | "BUSY" => has_degraded = true,
                "RUNNING" | "ADOPTED" => running_count += 1,
                _ => all_running = false,
            }
        }
    }

    let (color, tooltip) = if has_crash_loop {
        (
            "red",
            format!("ACC Control Plane - Crash Loop ({}/{} online)", running_count, total_count),
        )
    } else if has_degraded || !all_running || total_count == 0 {
        (
            "yellow",
            format!("ACC Control Plane - Starting / Busy ({}/{} online)", running_count, total_count),
        )
    } else {
        (
            "green",
            format!("ACC Control Plane - Healthy ({}/{} online)", running_count, total_count),
        )
    };

    crate::tray::update_tray_status(app, color, &tooltip);
}
