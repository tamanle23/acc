import { describe, expect, it } from "bun:test";
import { HardwareProfiler, type GpuInfo } from "../apps/ai-supervisor/src/bun/HardwareProfiler.js";

describe("5-Tier HardwareProfiler", () => {
  it("classifies discrete GPUs into correct tiers", () => {
    // 24GB RTX 3090 / 4090
    const rtx4090: GpuInfo = {
      name: "NVIDIA GeForce RTX 4090",
      totalVramBytes: 24 * 1024 * 1024 * 1024,
      freeVramBytes: 20 * 1024 * 1024 * 1024,
      isAppleSilicon: false,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(rtx4090)).toBe("tier1");

    // 16GB RTX 4080
    const rtx4080: GpuInfo = {
      name: "NVIDIA GeForce RTX 4080",
      totalVramBytes: 16 * 1024 * 1024 * 1024,
      freeVramBytes: 12 * 1024 * 1024 * 1024,
      isAppleSilicon: false,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(rtx4080)).toBe("tier2");

    // 8GB RTX 4060
    const rtx4060: GpuInfo = {
      name: "NVIDIA GeForce RTX 4060",
      totalVramBytes: 8 * 1024 * 1024 * 1024,
      freeVramBytes: 5 * 1024 * 1024 * 1024,
      isAppleSilicon: false,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(rtx4060)).toBe("tier3");

    // 4GB GTX 1650
    const gtx1650: GpuInfo = {
      name: "NVIDIA GeForce GTX 1650",
      totalVramBytes: 4 * 1024 * 1024 * 1024,
      freeVramBytes: 3 * 1024 * 1024 * 1024,
      isAppleSilicon: false,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(gtx1650)).toBe("tier4");

    // No GPU / Integrated
    expect(HardwareProfiler.classifyTier(null)).toBe("tier5");
  });

  it("scales Apple Silicon unified memory correctly", () => {
    const macStudio: GpuInfo = {
      name: "Apple M2 Ultra",
      totalVramBytes: 64 * 1024 * 1024 * 1024,
      freeVramBytes: 40 * 1024 * 1024 * 1024,
      isAppleSilicon: true,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(macStudio)).toBe("tier1");

    const macBookPro: GpuInfo = {
      name: "Apple M3 Pro",
      totalVramBytes: 18 * 1024 * 1024 * 1024,
      freeVramBytes: 10 * 1024 * 1024 * 1024,
      isAppleSilicon: true,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(macBookPro)).toBe("tier2");

    const macBookAir: GpuInfo = {
      name: "Apple M1",
      totalVramBytes: 8 * 1024 * 1024 * 1024,
      freeVramBytes: 3 * 1024 * 1024 * 1024,
      isAppleSilicon: true,
      isIntegrated: false,
    };
    expect(HardwareProfiler.classifyTier(macBookAir)).toBe("tier3");
  });

  it("evaluates eviction requirements according to tier policies", () => {
    const safeHeadroom = 2 * 1024 * 1024 * 1024; // 2GB
    const taskVram = 3 * 1024 * 1024 * 1024;     // 3GB
    const freeVram = 4 * 1024 * 1024 * 1024;     // 4GB

    // Tier 1: Zero eviction
    expect(HardwareProfiler.isEvictionRequired("tier1", taskVram, freeVram, safeHeadroom)).toBe(false);

    // Tier 2: Dynamic (4GB free - 3GB task = 1GB left < 2GB headroom -> must evict)
    expect(HardwareProfiler.isEvictionRequired("tier2", taskVram, freeVram, safeHeadroom)).toBe(true);

    // Tier 2: Plenty headroom (8GB free - 3GB task = 5GB left > 2GB headroom -> no eviction)
    expect(HardwareProfiler.isEvictionRequired("tier2", taskVram, 8 * 1024 * 1024 * 1024, safeHeadroom)).toBe(false);

    // Tier 3: Strict mutual exclusion
    expect(HardwareProfiler.isEvictionRequired("tier3", taskVram, freeVram, safeHeadroom)).toBe(true);

    // Tier 4: Strict mutual exclusion / CPU hybrid
    expect(HardwareProfiler.isEvictionRequired("tier4", taskVram, freeVram, safeHeadroom)).toBe(true);

    // Tier 5: CPU-only
    expect(HardwareProfiler.isEvictionRequired("tier5", taskVram, freeVram, safeHeadroom)).toBe(false);
  });

  it("honors manual hardware tier overrides in profile retrieval", async () => {
    const profile = await HardwareProfiler.getProfile("tier4");
    expect(profile.activeTier).toBe("tier4");
    expect(profile.recommendedPythonDevice).toBe("cpu"); // Tier 4 always pins Python to CPU
  });
});
