export interface PipelineStudioStyle {
  studioTitle: string;
  studioSubtitle: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  cardGlow: string;
  pillActive: string;
  gradientBanner: string;
}

export const PIPELINE_STUDIO_STYLES: Record<string, PipelineStudioStyle> = {
  "text-to-speech": {
    studioTitle: "Acoustic Mastering & Prosody Console",
    studioSubtitle: "48 kHz Neural Speech Synthesis • Rotary DSP Strip • Zero-Shot Voice Conditioning",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "automatic-speech-recognition": {
    studioTitle: "Broadcast Transcription & Acoustic Forensics Booth",
    studioSubtitle: "Live WebRTC VU Meter • Silero VAD Gate • DTW Word-Timestamp Alignment",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "image-text-to-text": {
    studioTitle: "Multimodal Vision-Language & Reasoning Studio",
    studioSubtitle: "System Persona Composer • Vision Frame Inspection • <think> Chain-of-Thought",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "text-generation": {
    studioTitle: "Autoregressive Reasoning & Code Synthesis Workbench",
    studioSubtitle: "Chain-of-Thought <think> Trace • Strict JSON Schema Grammar • Nucleus Sampling",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "text-to-image": {
    studioTitle: "Latent Diffusion & Flow-Matching Image Atelier",
    studioSubtitle: "FLUX.1-schnell 4-Step Flow Synthesis • Live Latent Step Stream • 1-Click Chain to RMBG-2.0",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "image-to-image": {
    studioTitle: "Adversarial Diffusion Distillation (SDXL-Turbo) Restyler",
    studioSubtitle: "1-Step Real-Time Image-to-Image Synthesis • Latent Seed Control • CFG Guidance",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "image-segmentation": {
    studioTitle: "Dichotomous Alpha Matte & Background Removal Darkroom",
    studioSubtitle: "BiRefNet / SAM-2 1024×1024 8-Bit Alpha Matte • Hair-Edge Refinement • Split-Wipe Inspector",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "object-detection": {
    studioTitle: "Spatial 2D Object Detection & Tactical Vision HUD",
    studioSubtitle: "60 FPS Client Confidence Cutoff • NMS IoU Filtering • Multi-Class Bounding Boxes",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "depth-estimation": {
    studioTitle: "Monocular 3D Depth & Surface Normal Horizon Lab",
    studioSubtitle: "Dense 2D Depth Matrix • Turbo/Magma/Viridis Colormap Slicer • Metric Horizon Clipping",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "text-classification": {
    studioTitle: "NLU Sequence Classification & Sentiment Workbench",
    studioSubtitle: "Interactive Candidate Label Chips • Softmax Temperature • Probability Distribution",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "token-classification": {
    studioTitle: "Zero-Shot Named Entity Recognition (GLiNER) Span Lab",
    studioSubtitle: "Custom Entity Schema Chips • Character Span Highlighting • Token Attribution",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "text-ranking": {
    studioTitle: "Cross-Encoder RAG Passage Reranking Studio",
    studioSubtitle: "Multi-Candidate Relevance Scoring • Top-K Cutoff • Query-Passage Alignment",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
  "feature-extraction": {
    studioTitle: "Matryoshka Semantic Vector Space & Similarity Lab",
    studioSubtitle: "Itemized Multi-Document Corpus • 256D–1024D Slicing • N×N Cosine Matrix",
    accentText: "text-primary",
    accentBg: "bg-primary/10",
    accentBorder: "border-primary/40",
    cardGlow: "border-primary/40 shadow-studio",
    pillActive: "bg-primary text-primary-foreground border-primary font-bold shadow-xs",
    gradientBanner: "from-primary/15 via-primary/5 to-transparent",
  },
};

export function getPipelineStudioStyle(pipelineType: string): PipelineStudioStyle {
  return (
    PIPELINE_STUDIO_STYLES[pipelineType] ??
    PIPELINE_STUDIO_STYLES["text-classification"]
  );
}

export const VOICE_SPEAKER_CARDS: Record<
  string,
  { register: string; freq: string; character: string }
> = {
  "Hải Đăng": { register: "Baritone Master", freq: "135 Hz", character: "Warm • Authoritative" },
  "Mai Anh": { register: "Soprano Studio", freq: "215 Hz", character: "Crisp • Articulate" },
  "Minh Quang": { register: "Tenor Narrative", freq: "145 Hz", character: "Steady • Documentary" },
  "Thanh Hà": { register: "Mezzo Expressive", freq: "205 Hz", character: "Natural • Conversational" },
};

export const CANONICAL_PIPELINE_OPTIONS = [
  "text-to-image",
  "image-to-image",
  "image-segmentation",
  "object-detection",
  "depth-estimation",
  "text-to-speech",
  "automatic-speech-recognition",
  "image-text-to-text",
  "text-generation",
  "text-classification",
  "token-classification",
  "text-ranking",
  "feature-extraction",
];
