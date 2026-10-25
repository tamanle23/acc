param(
    [string]$Url = "http://127.0.0.1:9099",
    [string]$Title = "ACC Control Plane",
    [int]$Width = 1200,
    [int]$Height = 800
)

$code = @"
using System;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

public class NativeWebViewWindow : Form {
    private WebView2 webView;

    public NativeWebViewWindow(string url, string title, int width, int height) {
        this.Text = title;
        this.Width = width;
        this.Height = height;
        this.StartPosition = FormStartPosition.CenterScreen;

        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        this.Controls.Add(webView);

        this.Load += async (s, e) => {
            try {
                await webView.EnsureCoreWebView2Async(null);
                webView.Source = new Uri(url);
            } catch (Exception ex) {
                // If WebView2 runtime is missing, fallback to WebBrowser control
                Console.Error.WriteLine("[NativeWebViewHost/Windows] WebView2 runtime initialization error: " + ex.Message);
            }
        };
    }

    public static void Launch(string url, string title, int width, int height) {
        Application.EnableVisualStyles();
        Application.Run(new NativeWebViewWindow(url, title, width, height));
    }
}
"@

try {
    Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms, System.Drawing, Microsoft.Web.WebView2.WinForms -ErrorAction Stop
    [NativeWebViewWindow]::Launch($Url, $Title, $Width, $Height)
} catch {
    # Fallback to standard .NET WebBrowser control if WebView2 DLL is not GAC-registered
    $fallbackCode = @"
using System;
using System.Drawing;
using System.Windows.Forms;

public class FallbackWebWindow : Form {
    public FallbackWebWindow(string url, string title, int width, int height) {
        this.Text = title;
        this.Width = width;
        this.Height = height;
        this.StartPosition = FormStartPosition.CenterScreen;
        var browser = new WebBrowser();
        browser.Dock = DockStyle.Fill;
        browser.ScriptErrorsSuppressed = true;
        browser.Navigate(url);
        this.Controls.Add(browser);
    }
    public static void Launch(string url, string title, int width, int height) {
        Application.EnableVisualStyles();
        Application.Run(new FallbackWebWindow(url, title, width, height));
    }
}
"@
    Add-Type -TypeDefinition $fallbackCode -ReferencedAssemblies System.Windows.Forms, System.Drawing
    [FallbackWebWindow]::Launch($Url, $Title, $Width, $Height)
}
