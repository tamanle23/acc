// ============================================================================
// KINETIX STUDIO v4.0 - PUBLIC BARREL EXPORTS
// ============================================================================

// App root
export { default as App } from './App';

// Types & Contracts
export * from './types';

// Constants & Catalogs
export * from './constants';
export * from './constants/archetype-categories';
export * from './constants/theme-presets';

// Hooks
export * from './hooks/use-adaptive-lod';
export * from './hooks/use-studio-shortcuts';

// Libraries & Utilities
export * from './lib/utils';
export * from './lib/safe-canvas-2d';
export * from './lib/midi-controller';
export * from './lib/schema';
export * from './lib/config-engine';
export * from './lib/url-state';
export * from './lib/user-presets';
export * from './lib/export-audio';
export * from './lib/export-video';
export * from './lib/export-mp4';
export * from './lib/opfs-storage';
export * from './lib/theme-utils';
export * from './lib/font-catalog';
export * from './lib/darkroom-processor';
export * from './lib/print-master';
export * from './lib/video-texture-engine';

// Engines & Composition
export * from './engine/spatial-skeleton';
export * from './engine/audio-synth';
export * from './engine/audio-user-track';
export * from './engine/audio/clock-worklet';
export * from './engine/shaders';
export * from './engine/heroes';
export * from './engine/composition-engine';
export * from './engine/composition/stage-geometry';
export * from './engine/composition/layout-geometry';
export * from './engine/composition/background';

// Context & State Management
export * from './context/studio-context';
export * from './context/studio-provider';
export * from './context/theme-context';

// Reusable UI Components
export * from './components/ui';

// Studio Structural Components
export * from './components/header/studio-header';
export * from './components/header/theme-selector';
export * from './components/header/archetype-bar';
export * from './components/header/archetype-popover';
export * from './components/header/quick-action-bar';

export * from './components/inspector/inspector-sidebar';
export * from './components/inspector/config-tab';
export * from './components/inspector/theme-manager-deck';
export * from './components/inspector/brand-and-styles-tab';
export * from './components/inspector/motion-tab';
export * from './components/inspector/payload-tab';

export * from './components/viewport/stage-viewport';
export * from './components/viewport/viewport-status-header';
export * from './components/viewport/motion-poster-stage';
export * from './components/viewport/floating-stage-hud';
export * from './components/viewport/kinetic-typography';
export * from './components/viewport/hero-stage-window';
export * from './components/viewport/blueprint-overlay';
export * from './components/viewport/safe-zone-overlay';
export * from './components/viewport/skeleton-overlays';

export * from './components/timeline/timeline-transport';
export * from './components/timeline/phase-jump-pills';
export * from './components/timeline/scrubber-bar';

export * from './components/telemetry/telemetry-sidebar';
export * from './components/telemetry/pipeline-qa-card';
export * from './components/telemetry/live-bpm-strip';
export * from './components/telemetry/choreography-telemetry';
export * from './components/telemetry/declarative-schema-viewer';

export * from './components/modals/template-vault-modal';
export * from './components/modals/media-vault-modal';
export * from './components/modals/lottie-hub-modal';
export * from './components/modals/matrix-test-modal';
export * from './components/modals/shortcuts-modal';
export * from './components/modals/theme-manager-modal';
export * from './components/modals/share-modal';
export * from './components/modals/export-save-modal';
export * from './components/modals/gallery-presenter-modal';
export * from './components/modals/midi-learn-modal';
export * from './components/timeline/keyframe-track-editor';

// Core Hexagonal Architecture & Ports
export * from './core/container';
export * from './core/domain';
export * from './core/ports/driven/render-target.port';
export * from './core/ports/driven/video-encoder.port';
export * from './core/ports/driven/audio-engine.port';
export * from './core/ports/driven/download-transport.port';
export * from './core/ports/driven/storage.port';
export * from './core/ports/driven/vector-document.port';

// Adapters
export * from './adapters/driven/canvas2d/canvas2d-target.adapter';
export * from './adapters/driven/download/browser-download.adapter';
export * from './adapters/driven/worker-export-adapter';
export * from './adapters/driving/line-in-audio.adapter';
export * from './adapters/driven/pdf-vector-generator.adapter';

// Horizon 1: Multi-Scene Storyboard & Timeline Sequencer
export * from './types/storyboard';
export * from './constants/storyboard-presets';
export * from './core/domain/storyboard/storyboard-sequence.entity';
export * from './engine/transitions/transition-strategy';
export * from './engine/composition/storyboard-compositor';
export * from './components/timeline/storyboard-drawer';
export * from './components/timeline/transition-picker-popover';
export * from './lib/batch-aspect-exporter';

// Horizon 2: AI Creative Director & Prompt-to-Poster Co-Pilot
export * from './core/domain/ai-copilot/copilot-types';
export * from './core/domain/ai-copilot/copilot-pipeline';
export * from './lib/ai-copilot/deterministic-copilot';
export * from './adapters/driving/ai-copilot/wintertc-copilot.adapter';
export * from './components/modals/copilot-modal';

// Horizon 4: Live Stage "VJ Performance Rig" & Real-Time Line-In
export * from './engine/live-stage/deck-crossfader';
export * from './adapters/driven/broadcast-stream.adapter';
export * from './components/modals/vj-performance-modal';

// Horizon 3: WebGPU Compute Pipeline & 3D Mesh Heroes
export * from './core/ports/driven/render-backend.port';
export * from './engine/webgpu/webgpu-probe';
export * from './engine/webgpu/gltf-mesh-engine';
export * from './engine/choreography/camera-director-3d';


