import os from "node:os";
import type { HardwareTierOption } from "./configStore.js";
import { type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner";

export type HardwareTier = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export interface GpuInfo {
  name: string;
  totalVramBytes: number;
  freeVramBytes: number;
  isAppleSilicon: boolean;
  isIntegrated: boolean;
}

export interface HardwareProfile {
  detectedTier: HardwareTier;
  activeTier: HardwareTier;
  gpu: GpuInfo | null;
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

    return {
      detectedTier,
      activeTier,
      gpu: gpuInfo,
      totalSystemRamBytes: os.totalmem(),
      freeSystemRamBytes: os.freemem(),
      cpuCores: os.cpus().length,
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
