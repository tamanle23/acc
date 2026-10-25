// ACC AI-Supervisor — macOS Native Status Bar Tray Runner
// Compiled on first run and cached at ~/.acc/bin/tray_runner_mac
// Protocol (stdin/stdout) is identical to the Windows PowerShell runner:
//   TRAY_READY      — emitted once when the icon is visible
//   EVENT:OPEN      — user clicked "Open Dashboard"
//   EVENT:PURGE_VRAM
//   EVENT:RESTART_ALL
//   EVENT:CHECK_UPDATE
//   EVENT:EXIT
//   stdin commands: ICON:<color>  TOOLTIP:<text>  EXIT

import Cocoa
import Foundation

// ── Helpers ─────────────────────────────────────────────────────────────────

func iconPath(for color: String, dir: String) -> String {
    return (dir as NSString).appendingPathComponent("tray-\(color).ico")
}

func loadImage(color: String, dir: String) -> NSImage? {
    let p = iconPath(for: color, dir: dir)
    if let img = NSImage(contentsOfFile: p) {
        img.isTemplate = false
        img.size = NSSize(width: 18, height: 18)
        return img
    }
    // Fallback: coloured circle drawn in code
    let size = NSSize(width: 18, height: 18)
    let img = NSImage(size: size)
    img.lockFocus()
    let nsColor: NSColor
    switch color {
    case "green":  nsColor = NSColor.systemGreen
    case "red":    nsColor = NSColor.systemRed
    default:       nsColor = NSColor.systemYellow
    }
    nsColor.setFill()
    let oval = NSBezierPath(ovalIn: NSRect(x: 1, y: 1, width: 16, height: 16))
    oval.fill()
    img.unlockFocus()
    img.isTemplate = false
    return img
}

func emit(_ event: String) {
    print(event)
    fflush(stdout)
}

// ── App Delegate ─────────────────────────────────────────────────────────────

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var iconDir: String = ""
    var currentColor: String = "yellow"
    var stdinThread: Thread!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Prevent dock icon
        NSApp.setActivationPolicy(.accessory)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        buildMenu()
        updateIcon(color: currentColor)

        emit("TRAY_READY")

        stdinThread = Thread { self.readStdin() }
        stdinThread.start()
    }

    func buildMenu() {
        let menu = NSMenu()

        let openItem = NSMenuItem(title: "Open Control Plane Dashboard",
                                  action: #selector(onOpen), keyEquivalent: "")
        openItem.target = self
        let boldFont = NSFont.boldSystemFont(ofSize: NSFont.systemFontSize)
        openItem.attributedTitle = NSAttributedString(string: "Open Control Plane Dashboard",
                                                      attributes: [.font: boldFont])
        menu.addItem(openItem)
        menu.addItem(.separator())

        let purgeItem = NSMenuItem(title: "Purge All VRAM",
                                   action: #selector(onPurgeVram), keyEquivalent: "")
        purgeItem.target = self
        menu.addItem(purgeItem)

        let restartItem = NSMenuItem(title: "Restart All Services",
                                     action: #selector(onRestartAll), keyEquivalent: "")
        restartItem.target = self
        menu.addItem(restartItem)

        let updateItem = NSMenuItem(title: "Check for Updates",
                                    action: #selector(onCheckUpdate), keyEquivalent: "")
        updateItem.target = self
        menu.addItem(updateItem)

        menu.addItem(.separator())

        let exitItem = NSMenuItem(title: "Exit ACC Control Plane",
                                  action: #selector(onExit), keyEquivalent: "q")
        exitItem.target = self
        menu.addItem(exitItem)

        statusItem.menu = menu
    }

    func updateIcon(color: String) {
        currentColor = color
        DispatchQueue.main.async {
            self.statusItem.button?.image = loadImage(color: color, dir: self.iconDir)
        }
    }

    func updateTooltip(_ text: String) {
        DispatchQueue.main.async {
            self.statusItem.button?.toolTip = text
        }
    }

    // ── Menu actions ──────────────────────────────────────────────────────────

    @objc func onOpen()        { emit("EVENT:OPEN") }
    @objc func onPurgeVram()   { emit("EVENT:PURGE_VRAM") }
    @objc func onRestartAll()  { emit("EVENT:RESTART_ALL") }
    @objc func onCheckUpdate() { emit("EVENT:CHECK_UPDATE") }
    @objc func onExit() {
        emit("EVENT:EXIT")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            NSApp.terminate(nil)
        }
    }

    // ── stdin command loop ────────────────────────────────────────────────────

    func readStdin() {
        while let line = readLine(strippingNewline: true) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("ICON:") {
                let color = String(trimmed.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                updateIcon(color: color)
            } else if trimmed.hasPrefix("TOOLTIP:") {
                let text = String(trimmed.dropFirst(8)).trimmingCharacters(in: .whitespaces)
                updateTooltip(text)
            } else if trimmed == "EXIT" {
                DispatchQueue.main.async { NSApp.terminate(nil) }
                break
            }
        }
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

let args = CommandLine.arguments
// args[1] = iconDir, args[2] = initialColor
let delegate = AppDelegate()
delegate.iconDir  = args.count > 1 ? args[1] : ""
delegate.currentColor = args.count > 2 ? args[2] : "yellow"

let app = NSApplication.shared
app.delegate = delegate
app.run()
