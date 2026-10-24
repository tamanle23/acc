import { type IWindowStrategy, type WindowOptions, type WindowHandle } from "./IWindowStrategy";
import { type IProcessRunner } from "../../IProcessRunner";

export class WindowsWebView2Strategy implements IWindowStrategy {
  readonly name = "WindowsWebView2Strategy";

  constructor(private readonly runner: IProcessRunner) {}

  async isSupported(): Promise<boolean> {
    if (process.platform !== "win32") return false;
    const posh = await this.runner.which("powershell.exe");
    return posh !== null;
  }

  async launch(options: WindowOptions): Promise<WindowHandle> {
    const width = options.width ?? 1200;
    const height = options.height ?? 820;

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "${options.title.replace(/"/g, '`"')}"
$form.Size = New-Object System.Drawing.Size(${width}, ${height})
$form.StartPosition = "CenterScreen"

$browser = New-Object Microsoft.Web.WebView2.WinForms.WebView2
$browser.Dock = [System.Windows.Forms.DockStyle]::Fill
$browser.Source = New-Object System.Uri("${options.url}")
$form.Controls.Add($browser)

[System.Windows.Forms.Application]::Run($form)
`.trim();

    const proc = this.runner.spawnManaged(
      ["powershell.exe", "-NoProfile", "-WindowStyle", "Hidden", "-Command", psScript],
      { stdout: "ignore", stderr: "ignore" }
    );

    return {
      pid: proc.pid,
      close: async () => {
        await proc.kill();
      },
    };
  }
}
