param(
    [string]$IconDir = "",
    [string]$InitialColor = "yellow"
)

$code = @"
using System;
using System.IO;
using System.Drawing;
using System.Windows.Forms;
using System.Threading;

public class NativeTrayApp {
    private static NotifyIcon notify;
    private static string iconDir;

    public static void Run(string[] args) {
        iconDir = args.Length > 0 ? args[0] : "";
        string initialColor = args.Length > 1 ? args[1] : "yellow";

        Application.EnableVisualStyles();
        notify = new NotifyIcon();
        UpdateIcon(initialColor);
        notify.Text = "ACC Control Plane";
        notify.Visible = true;

        var menu = new ContextMenuStrip();
        var itemOpen = menu.Items.Add("Open Control Plane Dashboard");
        itemOpen.Font = new Font(itemOpen.Font, FontStyle.Bold);
        itemOpen.Click += (s, e) => { Console.WriteLine("EVENT:OPEN"); Console.Out.Flush(); };

        menu.Items.Add(new ToolStripSeparator());

        var itemPurge = menu.Items.Add("Purge All VRAM");
        itemPurge.Click += (s, e) => { Console.WriteLine("EVENT:PURGE_VRAM"); Console.Out.Flush(); };

        var itemRestart = menu.Items.Add("Restart All Services");
        itemRestart.Click += (s, e) => { Console.WriteLine("EVENT:RESTART_ALL"); Console.Out.Flush(); };

        var itemUpdate = menu.Items.Add("Check for Updates");
        itemUpdate.Click += (s, e) => { Console.WriteLine("EVENT:CHECK_UPDATE"); Console.Out.Flush(); };

        menu.Items.Add(new ToolStripSeparator());

        var itemExit = menu.Items.Add("Exit ACC Control Plane");
        itemExit.Click += (s, e) => {
            Console.WriteLine("EVENT:EXIT");
            Console.Out.Flush();
            notify.Visible = false;
            notify.Dispose();
            Application.Exit();
        };

        notify.ContextMenuStrip = menu;
        notify.DoubleClick += (s, e) => { Console.WriteLine("EVENT:OPEN"); Console.Out.Flush(); };
        notify.Click += (s, e) => {
            MouseEventArgs me = e as MouseEventArgs;
            if (me != null && me.Button == MouseButtons.Left) {
                Console.WriteLine("EVENT:OPEN");
                Console.Out.Flush();
            }
        };

        var thread = new Thread(() => {
            try {
                string line;
                while ((line = Console.ReadLine()) != null) {
                    string trimmed = line.Trim();
                    if (trimmed.StartsWith("ICON:")) {
                        string color = trimmed.Substring(5).Trim();
                        menu.Invoke(new Action(() => UpdateIcon(color)));
                    } else if (trimmed.StartsWith("TOOLTIP:")) {
                        string tip = trimmed.Substring(8).Trim();
                        if (tip.Length > 63) tip = tip.Substring(0, 63);
                        menu.Invoke(new Action(() => { notify.Text = tip; }));
                    } else if (trimmed == "EXIT") {
                        menu.Invoke(new Action(() => {
                            notify.Visible = false;
                            notify.Dispose();
                            Application.Exit();
                        }));
                        break;
                    }
                }
            } catch {}
        });
        thread.IsBackground = true;
        thread.Start();

        Console.WriteLine("TRAY_READY");
        Console.Out.Flush();
        Application.Run();
    }

    private static void UpdateIcon(string color) {
        try {
            string file = Path.Combine(iconDir, "tray-" + color + ".ico");
            if (File.Exists(file)) {
                Icon old = notify.Icon;
                notify.Icon = new Icon(file);
                if (old != null) old.Dispose();
            }
        } catch {}
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms, System.Drawing

[NativeTrayApp]::Run(@($IconDir, $InitialColor))
