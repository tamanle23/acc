#!/usr/bin/env python3
"""
ACC AI-Supervisor — Linux Native WebKit2GTK Window Host
Spawns a true native GTK window embedding WebKit2.WebView.
"""

import sys
import os

url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:9099"
title = sys.argv[2] if len(sys.argv) > 2 else "ACC Control Plane"
width = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
height = int(sys.argv[4]) if len(sys.argv) > 4 else 800

try:
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("WebKit2", "4.0")
    from gi.repository import Gtk, WebKit2

    window = Gtk.Window(title=title)
    window.set_default_size(width, height)
    window.set_position(Gtk.WindowPosition.CENTER)
    window.connect("destroy", Gtk.main_quit)

    # Ephemeral context with zero disk caching
    context = WebKit2.WebContext.new_ephemeral()
    context.set_cache_model(WebKit2.CacheModel.DOCUMENT_VIEWER)
    webview = WebKit2.WebView.new_with_context(context)
    webview.load_uri(url)
    window.add(webview)

    window.show_all()
    Gtk.main()
    sys.exit(0)
except Exception as e:
    sys.stderr.write(f"[NativeWebViewHost/Linux] Failed to launch WebKit2GTK: {e}\n")
    sys.exit(1)
