import os from "node:os";
import type { HardwareTierOption } from "./configStore.js";
import { type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner.js";

export type HardwareTier = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export interface GpuInfo {
  name: string;
  totalVramBytes: number;
  freeVramBytes: number;
  isAppleSilicon: boolean;
  isIntegrated: boolean;
  vendor?: string;
  metalSupport?: string;
}

export interface CpuInfo {
  model: string;
  cores: number;
  speedMhz: number;
}

export interface HardwareProfile {
  detectedTier: HardwareTier;
  activeTier: HardwareTier;
  gpu: GpuInfo | null;
  cpu?: CpuInfo;
  totalSystemRamBytes: number;
  freeSystemRamBytes: number;
  cpuCores: number;
  safeHeadroomBytes: number;
  recommendedPythonDevice: "cuda" | "mps" | "cpu";
}

export class HardwareProfiler {
  public static async queryNvidiaSmi(
    runner: IProcessRunner = defaultProcessRunner
  ): Promise<{ totalBytes: number; freeBytes: number; name: string } | null> {
    try {
      const res = await runner.execute([
        "nvidia-smi",
        "--query-gpu=memory.total,memory.free,name",
        "--format=csv,noheader,nounits",
      ]);
      if (!res.ok || !res.value.stdout.trim()) return null;

      const [totalMbStr, freeMbStr, nameStr] = res.value.stdout.trim().split(",").map((s) => s.trim());
      const totalBytes = Number(totalMbStr) * 1024 * 1024;
      const freeBytes = Number(freeMbStr) * 1024 * 1024;
      return { totalBytes, freeBytes, name: nameStr || "NVIDIA GPU" };
    } catch {
      return null;
    }
  }

  public static async queryAppleSilicon(
    runner: IProcessRunner = defaultProcessRunner
  ): Promise<{ totalBytes: number; freeBytes: number; name: string } | null> {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
      return null;
    }

    try {
      const res = await runner.execute(["sysctl", "-n", "hw.memsize"]);
      if (res.ok) {
        const totalRam = Number(res.value.stdout.trim());
        if (Number.isFinite(totalRam) && totalRam > 0) {
          return {
            totalBytes: totalRam,
            freeBytes: Math.floor(totalRam * 0.5), // dynamic heuristic
            name: "Apple Silicon Unified Memory",
          };
        }
      }
    } catch {
      // fallback
    }
    return null;
  }

  public static async queryMacDisplays(
    runner: IProcessRunner = defaultProcessRunner
  ): Promise<GpuInfo | null> {
    if (process.platform !== "darwin") {
      return null;
    }

    try {
      const res = await runner.execute(["system_profiler", "SPDisplaysDataType", "-json"]);
      if (!res.ok || !res.value.stdout.trim()) return null;

      const data = JSON.parse(res.value.stdout.trim());
      const displays = data?.SPDisplaysDataType;
      if (!Array.isArray(displays) || displays.length === 0) return null;

      // Prefer discrete PCIe GPU (e.g. Radeon / AMD / dedicated) over built-in IGPU
      let chosen = displays.find((d: any) => d.sppci_bus === "spdisplays_pcie_device");
      if (!chosen) {
        chosen = displays[0];
      }

      const name = chosen.sppci_model || chosen._name || "macOS Graphics";
      const isIntegrated = chosen.sppci_bus === "spdisplays_builtin";
      const isApple = name.toLowerCase().includes("apple");

      // Parse VRAM string, e.g. "4 GB" or "1536 MB"
      let vramBytes = 0;
      const vramStr = chosen.spdisplays_vram || chosen._spdisplays_vram || chosen.spdisplays_vram_shared;
      if (typeof vramStr === "string") {
        const parts = vramStr.trim().split(/\s+/);
        const val = parseFloat(parts[0]) || 0;
        const unit = (parts[1] || "").toUpperCase();
        if (unit === "GB") {
          vramBytes = val * 1024 * 1024 * 1024;
        } else if (unit === "MB") {
          vramBytes = val * 1024 * 1024;
        }
      }

      return {
        name,
        totalVramBytes: vramBytes > 0 ? vramBytes : 0,
        freeVramBytes: vramBytes > 0 ? Math.floor(vramBytes * 0.7) : 0,
        isAppleSilicon: isApple,
        isIntegrated,
        vendor: chosen.spdisplays_vendor || (chosen.sppci_vendor_amd ? "AMD" : "Apple/Intel"),
        metalSupport: chosen.spdisplays_mtlgpufamilysupport?.replace("spdisplays_", "") || undefined,
      };
    } catch {
      return null;
    }
  }

  public static async queryWindowsGpu(
    runner: IProcessRunner = defaultProcessRunner
  ): Promise<GpuInfo | null> {
    if (process.platform !== "win32") {
      return null;
    }

    try {
      // Query Windows WMI / CIM for VideoController details
      const cmd = [
        "powershell",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, VideoProcessor | ConvertTo-Json -Compress",
      ];
      const res = await runner.execute(cmd);
      if (!res.ok || !res.value.stdout.trim()) return null;

      let data: any;
      try {
        data = JSON.parse(res.value.stdout.trim());
      } catch {
        return null;
      }

      // Handle array or single object
      const gpus = Array.isArray(data) ? data : [data];
      if (gpus.length === 0) return null;

      // Prefer discrete GPU with highest AdapterRAM or non-Intel/non-Basic display
      let chosen = gpus[0];
      for (const g of gpus) {
        const ram = Number(g.AdapterRAM) || 0;
        const chosenRam = Number(chosen.AdapterRAM) || 0;
        if (ram > chosenRam) {
          chosen = g;
        }
      }

      const name = chosen.Name || "Windows GPU";
      const vramBytes = Number(chosen.AdapterRAM) || 0;
      const isIntel = name.toLowerCase().includes("intel");
      const isIntegrated = isIntel || vramBytes <= 2 * 1024 * 1024 * 1024;

      return {
        name,
        totalVramBytes: vramBytes,
        freeVramBytes: Math.floor(vramBytes * 0.7),
        isAppleSilicon: false,
        isIntegrated,
        vendor: name.toLowerCase().includes("amd") || name.toLowerCase().includes("radeon") ? "AMD" : (isIntel ? "Intel" : "Dedicated"),
        driverVersion: chosen.DriverVersion,
      };
    } catch {
      return null;
    }
  }

  public static async queryLinuxGpu(
    runner: IProcessRunner = defaultProcessRunner
  ): Promise<GpuInfo | null> {
    if (process.platform !== "linux") {
      return null;
    }

    try {
      // 1. Try rocm-smi for AMD GPUs
      const rocmRes = await runner.execute(["rocm-smi", "--showmeminfo", "vram", "--json"]);
      if (rocmRes.ok && rocmRes.value.stdout.trim()) {
        try {
          const data = JSON.parse(rocmRes.value.stdout.trim());
          const cardKey = Object.keys(data)[0];
          if (cardKey && data[cardKey]) {
            const totalBytes = Number(data[cardKey]["VRAM Total Memory (B)"]) || 0;
            const usedBytes = Number(data[cardKey]["VRAM Total Used Memory (B)"]) || 0;
            return {
              name: `AMD Radeon (${cardKey})`,
              totalVramBytes: totalBytes,
              freeVramBytes: Math.max(0, totalBytes - usedBytes),
              isAppleSilicon: false,
              isIntegrated: false,
              vendor: "AMD",
            };
          }
        } catch {
          // ignore rocm json parse error
        }
      }

      // 2. Fallback to lspci for PCI GPU identification
      const lspciRes = await runner.execute(["lspci"]);
      if (lspciRes.ok && lspciRes.value.stdout.trim()) {
        const lines = lspciRes.value.stdout.trim().split("\n");
        const vgaLine = lines.find((l) => l.includes("VGA compatible controller") || l.includes("3D controller"));
        if (vgaLine) {
          const parts = vgaLine.split(":");
          const name = (parts[parts.length - 1] || "Linux Graphics").trim();
          const isIntel = name.toLowerCase().includes("intel");
          return {
            name,
            totalVramBytes: 0,
            freeVramBytes: 0,
            isAppleSilicon: false,
            isIntegrated: isIntel,
            vendor: name.toLowerCase().includes("amd") ? "AMD" : (isIntel ? "Intel" : "Generic"),
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  public static classifyTier(gpu: GpuInfo | null): HardwareTier {
    if (!gpu) {
      return "tier5";
    }

    const totalGb = gpu.totalVramBytes / (1024 * 1024 * 1024);

    if (gpu.isAppleSilicon) {
      if (totalGb >= 36) return "tier1";
      if (totalGb >= 16) return "tier2";
      return "tier3";
    }

    if (totalGb >= 23.5) return "tier1"; // 24GB+
    if (totalGb >= 11.5) return "tier2"; // 12GB - 20GB
    if (totalGb >= 5.5) return "tier3";  // 6GB - 8GB
    if (totalGb > 0) return "tier4";     // < 6GB (e.g. 4GB)
    return "tier5";                      // 0GB / CPU
  }

  public static async getProfile(tierOverride: HardwareTierOption = "auto"): Promise<HardwareProfile> {
    let gpuInfo: GpuInfo | null = null;

    const nvidia = await this.queryNvidiaSmi();
    if (nvidia) {
      gpuInfo = {
        name: nvidia.name,
        totalVramBytes: nvidia.totalBytes,
        freeVramBytes: nvidia.freeBytes,
        isAppleSilicon: false,
        isIntegrated: false,
      };
    } else {
      const apple = await this.queryAppleSilicon();
      if (apple) {
        gpuInfo = {
          name: apple.name,
          totalVramBytes: apple.totalBytes,
          freeVramBytes: apple.freeBytes,
          isAppleSilicon: true,
          isIntegrated: false,
        };
      } else {
        // Platform-specific non-NVIDIA GPU queries
        if (process.platform === "darwin") {
          const macDisplayGpu = await this.queryMacDisplays();
          if (macDisplayGpu) gpuInfo = macDisplayGpu;
        } else if (process.platform === "win32") {
          const winGpu = await this.queryWindowsGpu();
          if (winGpu) gpuInfo = winGpu;
        } else if (process.platform === "linux") {
          const linuxGpu = await this.queryLinuxGpu();
          if (linuxGpu) gpuInfo = linuxGpu;
        }
      }
    }

    const detectedTier = this.classifyTier(gpuInfo);
    const activeTier: HardwareTier = tierOverride !== "auto" ? tierOverride : detectedTier;

    let safeHeadroomBytes = 2.5 * 1024 * 1024 * 1024; // 2.5GB default
    let recommendedPythonDevice: "cuda" | "mps" | "cpu" = "cpu";

    if (activeTier === "tier1") {
      safeHeadroomBytes = 1.5 * 1024 * 1024 * 1024;
      recommendedPythonDevice = gpuInfo?.isAppleSilicon ? "mps" : "cuda";
    } else if (activeTier === "tier2") {
      safeHeadroomBytes = 2.0 * 1024 * 1024 * 1024;
      recommendedPythonDevice = gpuInfo?.isAppleSilicon ? "mps" : "cuda";
    } else if (activeTier === "tier3") {
      safeHeadroomBytes = 2.5 * 1024 * 1024 * 1024;
      recommendedPythonDevice = gpuInfo?.isAppleSilicon ? "mps" : "cuda";
    } else if (activeTier === "tier4") {
      // Tier 4 enforces CPU/GPU Role Splitting: Python strictly on CPU
      safeHeadroomBytes = 1.0 * 1024 * 1024 * 1024;
      recommendedPythonDevice = "cpu";
    } else {
      safeHeadroomBytes = 0;
      recommendedPythonDevice = "cpu";
    }

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Unknown CPU";
    const cpuSpeed = cpus[0]?.speed || 0;

    return {
      detectedTier,
      activeTier,
      gpu: gpuInfo,
      cpu: {
        model: cpuModel,
        cores: cpus.length,
        speedMhz: cpuSpeed,
      },
      totalSystemRamBytes: os.totalmem(),
      freeSystemRamBytes: os.freemem(),
      cpuCores: cpus.length,
      safeHeadroomBytes,
      recommendedPythonDevice,
    };
  }

  public static isEvictionRequired(
    tier: HardwareTier,
    incomingVramBytes: number,
    currentFreeVramBytes: number,
    safeHeadroomBytes: number
  ): boolean {
    if (tier === "tier1") {
      return false; // Zero proactive eviction for Tier 1
    }
    if (tier === "tier5") {
      return false; // CPU only
    }
    if (tier === "tier3" || tier === "tier4") {
      return true; // Strict mutual exclusion in budget/constrained tiers
    }

    // Tier 2: Dynamic threshold
    return currentFreeVramBytes - incomingVramBytes < safeHeadroomBytes;
  }
}
