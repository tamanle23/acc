use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub const TRAY_ID: &str = "acc-supervisor-tray";

const ICON_GREEN: &[u8] = include_bytes!("../icons/tray-green.ico");
const ICON_YELLOW: &[u8] = include_bytes!("../icons/tray-yellow.ico");
const ICON_RED: &[u8] = include_bytes!("../icons/tray-red.ico");

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let purge_item = MenuItem::with_id(app, "purge_vram", "Purge All VRAM", true, None::<&str>)?;
    let restart_item = MenuItem::with_id(app, "restart_fleet", "Restart Fleet", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&open_item)
        .separator()
        .item(&purge_item)
        .item(&restart_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let initial_icon = Image::from_bytes(ICON_YELLOW)?;

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(initial_icon)
        .tooltip("ACC Control Plane (Connecting...)")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "purge_vram" => {
                tauri::async_runtime::spawn(async {
                    let client = reqwest::Client::new();
                    let _ = client
                        .post("http://127.0.0.1:3333/api/vram/purge")
                        .send()
                        .await;
                });
            }
            "restart_fleet" => {
                tauri::async_runtime::spawn(async {
                    let client = reqwest::Client::new();
                    let _ = client
                        .post("http://127.0.0.1:3333/api/services/restart-all")
                        .send()
                        .await;
                });
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    println!("[DesktopHost] System Tray registered successfully with id '{}'", TRAY_ID);
    Ok(())
}

pub fn update_tray_status(app: &AppHandle, color: &str, tooltip: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let icon_bytes = match color {
            "green" => ICON_GREEN,
            "red" => ICON_RED,
            _ => ICON_YELLOW,
        };

        if let Ok(icon) = Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }
        let _ = tray.set_tooltip(Some(tooltip));
    }
}
