export type HeroId =
  | 'sneaker'
  | 'headphone'
  | 'perfume'
  | 'chronograph'
  | 'eyewear'
  | 'sculpture'
  | 'totem'
  | 'vinyl'
  | 'lottie-hologram'
  | 'lottie-eq'
  | 'lottie-morph'
  | 'lottie-pulse'
  | 'cyber-katana'
  | 'exo-hand'
  | 'quantum-core'
  | 'prism-crystal'
  | 'isometric-plinth'
  | 'bio-heart'
  | 'modular-synth'
  | 'drum-machine'
  | 'cyber-drone'
  | 'mecha-helmet'
  | 'couture-dress'
  | 'anamorphic-lens'
  // Multi-Genre Hero Subjects
  | 'classical-bust'
  | 'architectural-monolith'
  | 'botanical-flora'
  | 'book-folio'
  | 'cinema-slate'
  | 'bauhaus-geometry'
  | 'destijl-grid-plinth'
  | 'secession-crest'
  | 'deco-ziggurat'
  | 'cinema-lens'
  | 'vertigo-spiral'
  | 'factory-hazard-badge'
  | 'molten-mandala'
  | 'ransom-badge'
  | 'wabi-bonsai'
  | 'biophilic-leaf-arch'
  | 'cosmic-astrolabe'
  | 'chrome-torus-pod'
  // Festive & Cultural Holiday Focal Heroes
  | 'holiday-evergreen-star'
  | 'midnight-champagne-crystal'
  | 'tet-blossom-lantern'
  | 'trung-thu-star-lantern'
  | 'mid-autumn-moon-rabbit'
  | 'halloween-gothic-skull'
  | 'diwali-diya-lamp'
  | 'carnival-feather-mask'
  // Horizon 3 Custom 3D Mesh
  | 'custom-glb';

export interface HeroItem {
  id: HeroId;
  name: string;
  category: string;
  isLottie?: boolean;
}
