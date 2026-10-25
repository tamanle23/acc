import { createSignal, Show } from "solid-js";
import { createSupervisorStore } from "./stores/supervisorStore";
import { createThemeStore } from "./stores/themeStore";
import { HeaderBar } from "./components/HeaderBar";
import { TelemetryGrid } from "./components/TelemetryGrid";
import { FleetGrid } from "./components/FleetGrid";
import { ConsoleSection } from "./components/ConsoleSection";
import { SettingsModal } from "./components/SettingsModal";
import { AlertCircle, CheckCircle, Info } from "lucide-solid";

export function App() {
  const store = createSupervisorStore();
  const themeStore = createThemeStore();
  const [isSettingsOpen, setIsSettingsOpen] = createSignal<boolean>(false);

  const handleOpenStudio = () => {
    const s = store.status();
    const port = s?.services?.studio?.port ?? s?.config?.studioPort ?? 3300;
    window.open(`http://localhost:${port}`, "_blank");
  };

  return (
    <main class="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      <div class="max-w-6xl w-full mx-auto flex-1 flex flex-col">
        {/* Top Notification Toast */}
        <Show when={store.toastMessage()}>
          {(toast) => (
            <div
              class={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-top-2 duration-200 ${
                toast().type === "error"
                  ? "bg-rose-950/90 text-rose-200 border-rose-800"
                  : toast().type === "success"
                  ? "bg-emerald-950/90 text-emerald-200 border-emerald-800"
                  : "bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]"
              }`}
            >
              {toast().type === "error" && <AlertCircle class="w-4 h-4 text-rose-400" />}
              {toast().type === "success" && <CheckCircle class="w-4 h-4 text-emerald-400" />}
              {toast().type === "info" && <Info class="w-4 h-4 text-[var(--accent-primary)]" />}
              <span>{toast().text}</span>
            </div>
          )}
        </Show>

        {/* Global Connection / Status Error Banner */}
        <Show when={store.error()}>
          <div class="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-between text-xs text-rose-300">
            <div class="flex items-center gap-2">
              <AlertCircle class="w-4 h-4 text-rose-400" />
              <span>Failed to sync with supervisor engine: {store.error()}</span>
            </div>
            <button
              onClick={() => store.refreshStatus()}
              class="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-rose-100 cursor-pointer font-medium"
            >
              Retry Sync
            </button>
          </div>
        </Show>

        {/* 1. Header Bar with Theme Switcher */}
        <HeaderBar
          store={store}
          themeStore={themeStore}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* 2. Telemetry Grid */}
        <TelemetryGrid
          profile={store.status()?.hardwareProfile || (store.status() as any)?.profile}
          telemetry={store.telemetry()}
          isLoading={store.isLoading()}
        />

        {/* 3. Supervised Fleet Grid */}
        <FleetGrid
          services={store.status()?.services}
          isActionPending={store.isActionPending()}
          onControlService={(name, action) => store.controlService(name, action)}
          onPurgeVram={() => store.purgeVram()}
          onOpenStudio={handleOpenStudio}
        />

        {/* 4. Live Console Logs */}
        <ConsoleSection
          activeService={store.activeLogService()}
          onSelectService={(svc) => store.setActiveLogService(svc)}
          logs={store.logs()}
          filter={store.logFilter()}
          onFilterChange={(val) => store.setLogFilter(val)}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen()}
        onClose={() => setIsSettingsOpen(false)}
        config={store.status()?.config}
        autostart={store.status()?.autostart ?? false}
        onSave={(cfg) => store.saveConfig(cfg)}
      />
    </main>
  );
}
