import { createSignal, createEffect } from "solid-js";
import { Dialog } from "@ark-ui/solid";
import { X, Sliders, PlayCircle } from "lucide-solid";
import type { SupervisorConfig } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupervisorConfig | undefined;
  autostart: boolean;
  onSave: (config: Partial<SupervisorConfig>) => Promise<boolean>;
}

export function SettingsModal(props: SettingsModalProps) {
  const [studioPort, setStudioPort] = createSignal<number>(3300);
  const [supervisorPort, setSupervisorPort] = createSignal<number>(3333);
  const [autostart, setAutostart] = createSignal<boolean>(false);
  const [hardwareTier, setHardwareTier] = createSignal<string>("");
  const [isSaving, setIsSaving] = createSignal<boolean>(false);

  createEffect(() => {
    if (props.config) {
      setStudioPort(props.config.studioPort ?? 3300);
      setSupervisorPort(props.config.supervisorPort ?? 3333);
      setHardwareTier(props.config.hardwareTierOverride ?? "");
    }
    setAutostart(props.autostart);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await props.onSave({
      studioPort: Number(studioPort()),
      supervisorPort: Number(supervisorPort()),
      autostart: autostart(),
      hardwareTierOverride: hardwareTier() ? hardwareTier() : undefined,
    });
    setIsSaving(false);
    if (success) {
      props.onClose();
    }
  };

  const simulateUpdate = async () => {
    try {
      await fetch("/api/update/simulate", { method: "POST" });
      alert("Simulated v1.1.0 update staged!");
    } catch {}
  };

  return (
    <Dialog.Root open={props.isOpen} onOpenChange={(details) => !details.open && props.onClose()}>
      <Dialog.Backdrop class="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 animate-in fade-in" />
      <Dialog.Positioner class="fixed inset-0 flex items-center justify-center p-4 z-50">
        <Dialog.Content class="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl animate-in zoom-in-95 text-[var(--text-primary)] transition-colors">
          <div class="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
            <div class="flex items-center gap-2">
              <Sliders class="w-5 h-5 text-[var(--accent-primary)]" />
              <Dialog.Title class="text-base font-bold text-[var(--text-primary)]">Control Plane Settings</Dialog.Title>
            </div>
            <Dialog.CloseTrigger
              onClick={props.onClose}
              class="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] cursor-pointer"
            >
              <X class="w-4 h-4" />
            </Dialog.CloseTrigger>
          </div>

          <form onSubmit={handleSubmit} class="space-y-4 pt-4">
            <div>
              <label class="block text-xs font-semibold text-[var(--text-muted)] mb-1">Studio Web Port</label>
              <input
                type="number"
                value={studioPort()}
                onInput={(e) => setStudioPort(Number(e.currentTarget.value))}
                class="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-[var(--text-muted)] mb-1">Supervisor Control Port</label>
              <input
                type="number"
                value={supervisorPort()}
                onInput={(e) => setSupervisorPort(Number(e.currentTarget.value))}
                class="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-[var(--text-muted)] mb-1">Hardware Tier Override</label>
              <select
                value={hardwareTier()}
                onChange={(e) => setHardwareTier(e.currentTarget.value)}
                class="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-canvas)] text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-focus)]"
              >
                <option value="">Auto Detect (Recommended)</option>
                <option value="tier1">Tier 1 (Multi-GPU NVENC / CUDA)</option>
                <option value="tier2">Tier 2 (Consumer RTX / Discrete)</option>
                <option value="tier3">Tier 3 (Apple Silicon M-Series)</option>
                <option value="tier4">Tier 4 (Integrated GPU / Intel)</option>
                <option value="tier5">Tier 5 (Pure CPU Fallback)</option>
              </select>
            </div>

            <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
              <div>
                <div class="text-xs font-semibold text-[var(--text-primary)]">Start on System Boot</div>
                <div class="text-[11px] text-[var(--text-muted)]">Launch supervisor minimized in background</div>
              </div>
              <input
                type="checkbox"
                checked={autostart()}
                onChange={(e) => setAutostart(e.currentTarget.checked)}
                class="w-4 h-4 rounded text-[var(--accent-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)] focus:ring-[var(--accent-primary)] cursor-pointer"
              />
            </div>

            <div class="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <button
                type="button"
                onClick={simulateUpdate}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <PlayCircle class="w-3.5 h-3.5" />
                Simulate OTA
              </button>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={props.onClose}
                  class="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving()}
                  class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isSaving() ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
