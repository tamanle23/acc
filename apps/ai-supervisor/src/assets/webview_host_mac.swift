// ACC AI-Supervisor — macOS Native WKWebView Window Host
// Spawns a true native Cocoa NSWindow embedding WKWebView.
// Hardened with parent process watchdog to prevent orphaned zombie windows.

import Cocoa
import WebKit

class WebWindowController: NSObject, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    init(urlStr: String, title: String, width: CGFloat, height: CGFloat) {
        super.init()

        let screenSize = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1440, height: 900)
        let rect = NSRect(
            x: (screenSize.width - width) / 2,
            y: (screenSize.height - height) / 2,
            width: width,
            height: height
        )

        let styleMask: NSWindow.StyleMask = [
            .titled,
            .closable,
            .miniaturizable,
            .resizable,
            .fullSizeContentView
        ]

        window = NSWindow(contentRect: rect, styleMask: styleMask, backing: .buffered, defer: false)
        window.title = title
        window.titlebarAppearsTransparent = false
        window.isReleasedWhenClosed = false
        window.delegate = self

        // Configure WKWebView
        let config = WKWebViewConfiguration()
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        // Disable disk caching for local dev/supervisor webview to guarantee immediate updates
        config.websiteDataStore = WKWebsiteDataStore.nonPersistent()

        // Enable Safari Web Inspector / DevTools for debugging
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: rect, configuration: config)
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }
        webView.autoresizingMask = [.width, .height]
        window.contentView = webView

        if let url = URL(string: urlStr) {
            var request = URLRequest(url: url)
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            webView.load(request)
        }

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func windowWillClose(_ notification: Notification) {
        NSApp.terminate(nil)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var controller: WebWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)

        let args = CommandLine.arguments
        let url = args.count > 1 ? args[1] : "http://127.0.0.1:9099"
        let title = args.count > 2 ? args[2] : "ACC Control Plane"
        let width = args.count > 3 ? (CGFloat(Double(args[3]) ?? 1200)) : 1200
        let height = args.count > 4 ? (CGFloat(Double(args[4]) ?? 800)) : 800

        controller = WebWindowController(urlStr: url, title: title, width: width, height: height)

        // Parent process watchdog: If stdin closes or parent dies, terminate immediately
        DispatchQueue.global(qos: .background).async {
            // Check if parent process (PPID) changes to 1 (launchd / orphaned)
            let initialPPID = getppid()
            while true {
                usleep(500_000) // 500ms check
                let currentPPID = getppid()
                // If parent changed (orphaned to init/launchd 1) or parent PID terminated
                if currentPPID != initialPPID || currentPPID <= 1 || kill(initialPPID, 0) != 0 {
                    DispatchQueue.main.async {
                        NSApp.terminate(nil)
                    }
                    break
                }
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
