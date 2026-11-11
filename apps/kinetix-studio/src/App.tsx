import { createSignal, createEffect, onCleanup, Component, Show } from 'solid-js';
import type { AspectRatio } from '@/types/spatial';
import type { TemplatePreset } from '@/types/preset';
import { StudioProvider } from '@/context/studio-provider';
import { ThemeProvider, useTheme } from '@/context/theme-context';
import { useStudio } from '@/context/studio-context';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';
import type { ExportResolutionScale } from '@/lib/export-video';

import { StudioHeader } from '@/components/header/studio-header';
import { InspectorSidebar } from '@/components/inspector/inspector-sidebar';
import { StageViewport } from '@/components/viewport/stage-viewport';
import { TelemetrySidebar } from '@/components/telemetry/telemetry-sidebar';
import { TemplateVaultModal } from '@/components/modals/template-vault-modal';
import { MediaVaultModal } from '@/components/modals/media-vault-modal';
import { LottieHubModal } from '@/components/modals/lottie-hub-modal';
import { MatrixTestModal } from '@/components/modals/matrix-test-modal';
import { ShortcutsModal } from '@/components/modals/shortcuts-modal';
import { ThemeManagerModal } from '@/components/modals/theme-manager-modal';
import { ShareModal } from '@/components/modals/share-modal';
import { ExportSaveModal, type ExportFormat } from '@/components/modals/export-save-modal';
import { GalleryPresenterModal } from '@/components/modals/gallery-presenter-modal';
import { CopilotModal } from '@/components/modals/copilot-modal';
import { VjPerformanceModal } from '@/components/modals/vj-performance-modal';
import { useStudioShortcuts } from '@/hooks/use-studio-shortcuts';
import { Toast } from '@/components/ui/toast';

const StudioWorkspace: Component = () => {
  const studio = useStudio();
  const { toggleMode, resolvedMode } = useTheme();

  const [vaultOpen, setVaultOpen] = createSignal<boolean>(false);
  const [mediaVaultOpen, setMediaVaultOpen] = createSignal<boolean>(false);
  const [lottieHubOpen, setLottieHubOpen] = createSignal<boolean>(false);
  const [matrixTestOpen, setMatrixTestOpen] = createSignal<boolean>(false);
  const [batchCycleActive, setBatchCycleActive] = createSignal<boolean>(false);
  const [isRecording] = createSignal<boolean>(false);
  const [recordProgress] = createSignal<number>(0);
  const [shortcutsOpen, setShortcutsOpen] = createSignal<boolean>(false);
  const [themeModalOpen, setThemeModalOpen] = createSignal<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = createSignal<boolean>(false);
  const [presenterOpen, setPresenterOpen] = createSignal<boolean>(false);
  const [copilotOpen, setCopilotOpen] = createSignal<boolean>(false);
  const [vjModalOpen, setVjModalOpen] = createSignal<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = createSignal<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = createSignal<ExportFormat>('mp4');

  // Resizable & Collapsible Sidebars State
  const [inspectorWidth, setInspectorWidth] = createSignal<number>(
    typeof window !== 'undefined'
      ? Number(localStorage.getItem('kx_inspector_width') || 384)
      : 384
  );
  const [inspectorCollapsed, setInspectorCollapsed] = createSignal<boolean>(
    typeof window !== 'undefined'
      ? localStorage.getItem('kx_inspector_collapsed') === 'true'
      : false
  );
  const [telemetryWidth, setTelemetryWidth] = createSignal<number>(
    typeof window !== 'undefined'
      ? Number(localStorage.getItem('kx_telemetry_width') || 320)
      : 320
  );
  const [telemetryCollapsed, setTelemetryCollapsed] = createSignal<boolean>(
    typeof window !== 'undefined'
      ? localStorage.getItem('kx_telemetry_collapsed') === 'true'
      : false
  );

  const toggleInspector = () => {
    const next = !inspectorCollapsed();
    setInspectorCollapsed(next);
    localStorage.setItem('kx_inspector_collapsed', String(next));
    studio.triggerToast(next ? 'Inspector Collapsed (HotKey: [)' : 'Inspector Expanded');
  };

  const toggleTelemetry = () => {
    const next = !telemetryCollapsed();
    setTelemetryCollapsed(next);
    localStorage.setItem('kx_telemetry_collapsed', String(next));
    studio.triggerToast(next ? 'Telemetry Collapsed (HotKey: ])' : 'Telemetry Expanded');
  };

  // Drag-to-resize handlers
  let isDraggingLeft = false;
  let isDraggingRight = false;

  const handleStartDragLeft = (e: MouseEvent) => {
    e.preventDefault();
    isDraggingLeft = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleStartDragRight = (e: MouseEvent) => {
    e.preventDefault();
    isDraggingRight = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  createEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newW = Math.max(340, Math.min(480, e.clientX));
        setInspectorWidth(newW);
        localStorage.setItem('kx_inspector_width', String(newW));
      } else if (isDraggingRight) {
        const newW = Math.max(280, Math.min(420, window.innerWidth - e.clientX));
        setTelemetryWidth(newW);
        localStorage.setItem('kx_telemetry_width', String(newW));
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLeft || isDraggingRight) {
        isDraggingLeft = false;
        isDraggingRight = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    });
  });

  // Global Keyboard Shortcuts (Space, R, M, 1-4, [ / ], T, F, ?)
  useStudioShortcuts({
    onOpenShortcuts: () => setShortcutsOpen(true),
    onOpenMediaVault: () => setMediaVaultOpen(true),
    onOpenThemeModal: () => setThemeModalOpen(true),
    onToggleTheme: () => {
      toggleMode();
      studio.triggerToast(
        `Switched to ${resolvedMode === 'dark' ? 'Light' : 'Dark'} Studio Mode`
      );
    },
    onToggleLeftSidebar: toggleInspector,
    onToggleRightSidebar: toggleTelemetry,
    onTogglePresenter: () => setPresenterOpen((v) => !v),
  });

  // Automated Variant Cycle (Cycles Aspect Ratios & Archetypes Automatically)
  createEffect(() => {
    if (!batchCycleActive()) return;
    const ratios: AspectRatio[] = ['9:16', '4:5', '1:1', '16:9'];
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % (ratios.length * BRAND_ARCHETYPES.length);
      const nextRatio = ratios[step % ratios.length];
      const nextArch = BRAND_ARCHETYPES[step % BRAND_ARCHETYPES.length];
      studio.patchState({
        aspectRatio: nextRatio,
        archetypeId: nextArch.id,
        ...nextArch.patch,
      });
    }, 2400);

    onCleanup(() => clearInterval(timer));
  });

  const handleOpenExportModal = (fmt: ExportFormat = 'mp4') => {
    setExportModalFormat(fmt);
    setExportModalOpen(true);
  };

  // Multi-Resolution Composite Snapshot Exporter (1x, 2x Retina, 4x Print Master PNG)
  const handleExportSnapshot = async (_scale: ExportResolutionScale = 1) => {
    handleOpenExportModal('png');
  };

  // Scalable Vector Graphics (.svg) Exporter
  const handleExportSvg = async () => {
    handleOpenExportModal('svg');
  };

  // 1-Click Composite Video Renderer (Web Standard MediaRecorder + Blob + AbortController)
  const handleOneClickVideoRender = async (overridePreset?: TemplatePreset) => {
    if (overridePreset) {
      studio.patchState(overridePreset.statePatch);
    }
    handleOpenExportModal('webm');
  };

  // Hardware-Accelerated MP4 Video Exporter via Mediabunny WebCodecs
  const handleExportMp4 = async () => {
    handleOpenExportModal('mp4');
  };

  // Client-Side Animated GIF Exporter
  const handleExportGif = async () => {
    handleOpenExportModal('gif');
  };

  return (
    <div class="min-h-screen h-screen w-full bg-background text-foreground flex flex-col overflow-hidden select-none font-sans">
      {/* SVG Liquid Psychedelic Distortion Filter Definition */}
      <svg class="hidden" aria-hidden="true">
        <defs>
          <filter id="kx-liquid-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={
                studio.state.liquidWarp
                  ? `${(0.012 + 0.006 * Math.sin(studio.rawProgress * Math.PI * 2)).toFixed(4)} 0.025`
                  : '0.0001'
              }
              numOctaves={2}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={studio.state.liquidWarp ? 16 : 0}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* TOP STUDIO COMMAND BAR WITH COMPACT 18 ARCHETYPES & QUICK TOOLS */}
      <StudioHeader
        onOpenVault={() => setVaultOpen(true)}
        onOpenMediaVault={() => setMediaVaultOpen(true)}
        onOpenLottieHub={() => setLottieHubOpen(true)}
        onOpenMatrixTest={() => setMatrixTestOpen(true)}
        onOpenThemeModal={() => setThemeModalOpen(true)}
        onOpenShare={() => setShareModalOpen(true)}
        onOpenPresenter={() => setPresenterOpen(true)}
        onOpenCopilot={() => setCopilotOpen(true)}
        onOpenVjRig={() => setVjModalOpen(true)}
        onExportSnapshot={handleExportSnapshot}
        onExportSvg={handleExportSvg}
        onRecordVideo={() => handleOneClickVideoRender()}
        onExportMp4={handleExportMp4}
        onExportGif={handleExportGif}
        isRecording={isRecording()}
        recordProgress={recordProgress()}
        matrixTestOpen={matrixTestOpen()}
        batchCycleActive={batchCycleActive()}
      />

      {/* WORKSPACE 3-COLUMN BODY WITH RESIZABLE & COLLAPSIBLE PANELS */}
      <div class="flex-1 flex overflow-hidden relative">
        {/* LEFT INSPECTOR: 4-LAYER SYSTEM CONFIGURATION */}
        <InspectorSidebar
          width={inspectorWidth()}
          collapsed={inspectorCollapsed()}
          onToggleCollapse={toggleInspector}
          onOpenLottieHub={() => setLottieHubOpen(true)}
          onOpenMediaVault={() => setMediaVaultOpen(true)}
        />

        {/* LEFT RESIZER GUTTER */}
        <Show when={!inspectorCollapsed()}>
          <div
            onMouseDown={handleStartDragLeft}
            onDblClick={() => {
              setInspectorWidth(384);
              localStorage.setItem('kx_inspector_width', '384');
            }}
            title="Drag to resize Inspector (Double click to reset to 384px)"
            class="w-1.5 -ml-0.5 z-20 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors flex items-center justify-center group shrink-0 select-none"
          >
            <div class="w-0.5 h-6 rounded-full bg-border group-hover:bg-primary/80 transition-colors" />
          </div>
        </Show>

        {/* CENTER STAGE: INTERACTIVE POSTER VIEWPORT & TIMELINE SCRUBBER */}
        <StageViewport
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenPresenter={() => setPresenterOpen(true)}
        />

        {/* RIGHT RESIZER GUTTER */}
        <Show when={!telemetryCollapsed()}>
          <div
            onMouseDown={handleStartDragRight}
            onDblClick={() => {
              setTelemetryWidth(320);
              localStorage.setItem('kx_telemetry_width', '320');
            }}
            title="Drag to resize Telemetry (Double click to reset to 320px)"
            class="w-1.5 -mr-0.5 z-20 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors flex items-center justify-center group shrink-0 select-none hidden lg:flex"
          >
            <div class="w-0.5 h-6 rounded-full bg-border group-hover:bg-primary/80 transition-colors" />
          </div>
        </Show>

        {/* RIGHT INSPECTOR: STUDIO QA AUDIT & DECLARATIVE JSON CONTRACT */}
        <TelemetrySidebar
          width={telemetryWidth()}
          collapsed={telemetryCollapsed()}
          onToggleCollapse={toggleTelemetry}
        />
      </div>

      {/* TEMPLATE VAULT MODAL (24 ONE-CLICK PRODUCTION PRESETS) */}
      <TemplateVaultModal
        isOpen={vaultOpen()}
        onClose={() => setVaultOpen(false)}
        onQuickVideoRender={(preset) => handleOneClickVideoRender(preset)}
      />

      {/* REAL-WORLD CC0 & ARCHIVAL MEDIA VAULT MODAL */}
      <MediaVaultModal
        isOpen={mediaVaultOpen()}
        onClose={() => setMediaVaultOpen(false)}
      />

      {/* LOTTIE VECTOR HUB MODAL */}
      <LottieHubModal
        isOpen={lottieHubOpen()}
        onClose={() => setLottieHubOpen(false)}
      />

      {/* 4-UP MULTI-FORMAT MATRIX TEST & BATCH VARIANT CYCLE MODAL */}
      <MatrixTestModal
        isOpen={matrixTestOpen()}
        onClose={() => setMatrixTestOpen(false)}
        batchCycleActive={batchCycleActive()}
        onToggleBatchCycle={() => {
          const next = !batchCycleActive();
          setBatchCycleActive(next);
          studio.triggerToast(
            next
              ? 'Started Automated Batch Variant Cycle'
              : 'Stopped Batch Variant Cycle'
          );
        }}
      />

      {/* KEYBOARD SHORTCUTS CHEATSHEET MODAL */}
      <ShortcutsModal
        isOpen={shortcutsOpen()}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* STUDIO UI THEME & APPEARANCE MODAL */}
      <ThemeManagerModal
        isOpen={themeModalOpen()}
        onClose={() => setThemeModalOpen(false)}
      />

      {/* INSTANT COLLABORATION SHARE & QR MODAL */}
      <ShareModal
        isOpen={shareModalOpen()}
        onClose={() => setShareModalOpen(false)}
      />

      {/* FULLSCREEN EXHIBITION & GALLERY KIOSK PRESENTER MODAL */}
      <GalleryPresenterModal
        isOpen={presenterOpen()}
        onClose={() => setPresenterOpen(false)}
      />

      {/* AI CREATIVE DIRECTOR & PROMPT-TO-POSTER CO-PILOT MODAL */}
      <CopilotModal
        isOpen={copilotOpen()}
        onClose={() => setCopilotOpen(false)}
      />

      {/* LIVE STAGE VJ PERFORMANCE RIG & DUAL-DECK MODAL */}
      <VjPerformanceModal
        isOpen={vjModalOpen()}
        onClose={() => setVjModalOpen(false)}
      />

      {/* DEDICATED COMPOSITE EXPORT & SAVE MODAL */}
      <ExportSaveModal
        isOpen={exportModalOpen()}
        onClose={() => setExportModalOpen(false)}
        initialFormat={exportModalFormat()}
      />

      {/* NON-BLOCKING TOAST NOTIFICATION */}
      <Toast message={studio.toastMessage} />
    </div>
  );
};

export default function App(): Element {
  return (
    <ThemeProvider>
      <StudioProvider>
        <StudioWorkspace />
      </StudioProvider>
    </ThemeProvider>
  ) as unknown as Element;
}
