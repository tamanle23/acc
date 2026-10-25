#!/usr/bin/env python3
"""
ACC AI-Supervisor — Linux System Tray Runner
Uses libappindicator3 (GTK) when available, falls back to a headless mode
with notify-send desktop notifications for events.

stdin/stdout protocol (same as Windows/macOS runners):
  stdout:  TRAY_READY | EVENT:OPEN | EVENT:PURGE_VRAM |
           EVENT:RESTART_ALL | EVENT:CHECK_UPDATE | EVENT:EXIT
  stdin:   ICON:<color>  TOOLTIP:<text>  EXIT
"""

import sys
import os
import threading
import signal

icon_dir = sys.argv[1] if len(sys.argv) > 1 else ""
initial_color = sys.argv[2] if len(sys.argv) > 2 else "yellow"


def emit(event: str) -> None:
    sys.stdout.write(event + "\n")
    sys.stdout.flush()


def notify(summary: str, body: str = "", icon: str = "") -> None:
    """Fire a desktop notification — best-effort, never raises."""
    try:
        cmd = ["notify-send", summary]
        if body:
            cmd.append(body)
        if icon:
            cmd += ["--icon", icon]
        os.system(" ".join(cmd))
    except Exception:
        pass


def icon_path(color: str) -> str:
    return os.path.join(icon_dir, f"tray-{color}.ico")


# ── Try GTK + AppIndicator3 ──────────────────────────────────────────────────

try:
    import gi
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk, GLib

    try:
        gi.require_version("AppIndicator3", "0.1")
        from gi.repository import AppIndicator3
        _HAS_INDICATOR = True
    except (ValueError, ImportError):
        _HAS_INDICATOR = False

    _HAS_GTK = True
except ImportError:
    _HAS_GTK = False
    _HAS_INDICATOR = False


# ── GTK + AppIndicator3 backend ──────────────────────────────────────────────

if _HAS_GTK and _HAS_INDICATOR:

    APP_ID = "acc-control-plane"

    def get_icon_path(color: str) -> str:
        p = icon_path(color)
        if os.path.isfile(p):
            return p
        # Fallback: use a theme icon name understood by GTK
        mapping = {"green": "emblem-ok-symbolic",
                   "yellow": "emblem-synchronizing-symbolic",
                   "red": "emblem-important-symbolic"}
        return mapping.get(color, "emblem-default-symbolic")

    indicator = AppIndicator3.Indicator.new(
        APP_ID,
        get_icon_path(initial_color),
        AppIndicator3.IndicatorCategory.APPLICATION_STATUS,
    )
    indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)

    # Build context menu
    menu = Gtk.Menu()

    item_open = Gtk.MenuItem(label="Open Control Plane Dashboard")
    item_open.connect("activate", lambda _: emit("EVENT:OPEN"))
    menu.append(item_open)

    menu.append(Gtk.SeparatorMenuItem())

    item_purge = Gtk.MenuItem(label="Purge All VRAM")
    item_purge.connect("activate", lambda _: emit("EVENT:PURGE_VRAM"))
    menu.append(item_purge)

    item_restart = Gtk.MenuItem(label="Restart All Services")
    item_restart.connect("activate", lambda _: emit("EVENT:RESTART_ALL"))
    menu.append(item_restart)

    item_update = Gtk.MenuItem(label="Check for Updates")
    item_update.connect("activate", lambda _: emit("EVENT:CHECK_UPDATE"))
    menu.append(item_update)

    menu.append(Gtk.SeparatorMenuItem())

    item_exit = Gtk.MenuItem(label="Exit ACC Control Plane")

    def on_exit(_):
        emit("EVENT:EXIT")
        GLib.timeout_add(100, Gtk.main_quit)

    item_exit.connect("activate", on_exit)
    menu.append(item_exit)

    menu.show_all()
    indicator.set_menu(menu)

    def update_icon(color: str) -> None:
        GLib.idle_add(indicator.set_icon_full, get_icon_path(color), f"ACC {color}")

    def update_tooltip(_text: str) -> None:
        # AppIndicator3 doesn't support native tooltips; silently ignore.
        pass

    def quit_loop() -> None:
        GLib.idle_add(Gtk.main_quit)

    def stdin_loop() -> None:
        try:
            for raw in sys.stdin:
                line = raw.strip()
                if line.startswith("ICON:"):
                    update_icon(line[5:].strip())
                elif line.startswith("TOOLTIP:"):
                    update_tooltip(line[8:].strip())
                elif line == "EXIT":
                    quit_loop()
                    break
        except Exception:
            pass

    t = threading.Thread(target=stdin_loop, daemon=True)
    t.start()

    emit("TRAY_READY")
    Gtk.main()


# ── GTK only (no AppIndicator3) — use a simple status icon ─────────────────

elif _HAS_GTK:

    def _make_icon(color: str):
        p = icon_path(color)
        if os.path.isfile(p):
            return Gtk.StatusIcon.new_from_file(p)
        mapping = {"green": Gtk.STOCK_YES,
                   "yellow": Gtk.STOCK_EXECUTE,
                   "red": Gtk.STOCK_DIALOG_WARNING}
        return Gtk.StatusIcon.new_from_stock(mapping.get(color, Gtk.STOCK_INFO))

    status_icon = _make_icon(initial_color)
    status_icon.set_tooltip_text("ACC Control Plane")
    status_icon.set_visible(True)

    def build_menu() -> Gtk.Menu:
        m = Gtk.Menu()
        for label, event in [
            ("Open Control Plane Dashboard", "EVENT:OPEN"),
            None,
            ("Purge All VRAM", "EVENT:PURGE_VRAM"),
            ("Restart All Services", "EVENT:RESTART_ALL"),
            ("Check for Updates", "EVENT:CHECK_UPDATE"),
            None,
            ("Exit ACC Control Plane", "EVENT:EXIT"),
        ]:
            if label is None:
                m.append(Gtk.SeparatorMenuItem())
                continue
            item = Gtk.MenuItem(label=label)
            ev = event

            def handler(_, e=ev):
                emit(e)
                if e == "EVENT:EXIT":
                    GLib.timeout_add(100, Gtk.main_quit)

            item.connect("activate", handler)
            m.append(item)
        m.show_all()
        return m

    _menu = build_menu()

    def on_popup(icon, button, time):
        _menu.popup(None, None, Gtk.StatusIcon.position_menu, icon, button, time)

    status_icon.connect("popup-menu", on_popup)
    status_icon.connect("activate", lambda _: emit("EVENT:OPEN"))

    def update_icon(color: str) -> None:
        p = icon_path(color)
        if os.path.isfile(p):
            GLib.idle_add(status_icon.set_from_file, p)

    def update_tooltip(text: str) -> None:
        GLib.idle_add(status_icon.set_tooltip_text, text)

    def quit_loop() -> None:
        GLib.idle_add(Gtk.main_quit)

    def stdin_loop() -> None:
        try:
            for raw in sys.stdin:
                line = raw.strip()
                if line.startswith("ICON:"):
                    update_icon(line[5:].strip())
                elif line.startswith("TOOLTIP:"):
                    update_tooltip(line[8:].strip())
                elif line == "EXIT":
                    quit_loop()
                    break
        except Exception:
            pass

    t = threading.Thread(target=stdin_loop, daemon=True)
    t.start()

    emit("TRAY_READY")
    Gtk.main()


# ── Headless fallback — no GTK available ─────────────────────────────────────

else:
    sys.stderr.write(
        "[TrayRunner/Linux] GTK/AppIndicator3 not available. "
        "Running in headless mode (notify-send only).\n"
    )
    sys.stderr.flush()

    notify(
        "ACC Control Plane",
        "Supervisor started (no system tray — install python3-gi for full tray support).",
    )

    _current_color = initial_color

    def update_icon(color: str) -> None:
        global _current_color
        _current_color = color

    def update_tooltip(_text: str) -> None:
        pass

    def stdin_loop() -> None:
        try:
            for raw in sys.stdin:
                line = raw.strip()
                if line.startswith("ICON:"):
                    update_icon(line[5:].strip())
                elif line.startswith("TOOLTIP:"):
                    update_tooltip(line[8:].strip())
                elif line == "EXIT":
                    emit("EVENT:EXIT")
                    os._exit(0)
        except Exception:
            pass

    signal.signal(signal.SIGTERM, lambda *_: os._exit(0))
    signal.signal(signal.SIGINT,  lambda *_: os._exit(0))

    emit("TRAY_READY")
    stdin_loop()
