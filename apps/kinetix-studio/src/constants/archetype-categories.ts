// ============================================================================
// KINETIX STUDIO v5.0 - 10-SPHERE CURATORIAL TAXONOMY SPECIFICATION
// Universal Master Classification spanning 28 non-redundant brand archetypes
// ============================================================================

export type ArchetypeFamily =
  | 'all'
  | 'modernism'
  | 'editorial'
  | 'classical'
  | 'cinema'
  | 'music'
  | 'activism'
  | 'nature-zen'
  | 'architecture'
  | 'speculative'
  | 'club-kinetic'
  | 'festive-seasonal';

export interface ArchetypeCategoryMeta {
  family: ArchetypeFamily;
  badge: string;
  tagColor: string;
  sphere: string;
}

export const ARCHETYPE_META: Record<string, ArchetypeCategoryMeta> = {
  // --------------------------------------------------------------------------
  // 1. MODERNISM & CONSTRUCTIVISM
  // --------------------------------------------------------------------------
  'swiss-international': {
    family: 'modernism',
    badge: 'SWISS',
    tagColor: '#dc2626',
    sphere: 'International Typographic & Exhibition',
  },
  'bauhaus-constructivism': {
    family: 'modernism',
    badge: 'BAUHAUS',
    tagColor: '#d90429',
    sphere: 'Weimar Bauhaus & Soviet Vkhutemas',
  },
  'de-stijl-neoplasticism': {
    family: 'modernism',
    badge: 'DE STIJL',
    tagColor: '#004b9e',
    sphere: 'Neoplasticism & Orthogonal Balance',
  },

  // --------------------------------------------------------------------------
  // 2. HAUTE COUTURE, LOOKBOOKS & EDITORIAL
  // --------------------------------------------------------------------------
  'editorial-couture': {
    family: 'editorial',
    badge: 'COUTURE',
    tagColor: '#b45309',
    sphere: 'Haute Couture & Luxury Editorial',
  },
  'monograph-press': {
    family: 'editorial',
    badge: 'PRESS',
    tagColor: '#475569',
    sphere: 'Publishing & Literary Monograph',
  },
  'vogue-avant-lookbook': {
    family: 'editorial',
    badge: 'LOOKBOOK',
    tagColor: '#1c1917',
    sphere: 'Editorial Art Direction & Capsule Fashion',
  },

  // --------------------------------------------------------------------------
  // 3. CLASSICAL FINE ART, ORNAMENT & ANTIQUITY
  // --------------------------------------------------------------------------
  'vienna-secession': {
    family: 'classical',
    badge: 'SECESSION',
    tagColor: '#ca8a04',
    sphere: 'Viennese Secession & Gilded Art Nouveau',
  },
  'art-deco-metropolis': {
    family: 'classical',
    badge: 'ART DECO',
    tagColor: '#fbbf24',
    sphere: '1925 Art Deco & Metropolis Architecture',
  },
  'hellenistic-antiquity': {
    family: 'classical',
    badge: 'ANTIQUITY',
    tagColor: '#78716c',
    sphere: 'Classical Sculpture & Chiseled Antiquity',
  },

  // --------------------------------------------------------------------------
  // 4. AUTEUR CINEMA, NOIR & TITLE DESIGN
  // --------------------------------------------------------------------------
  'a24-cinematheque': {
    family: 'cinema',
    badge: 'CINEMA',
    tagColor: '#d97706',
    sphere: 'Cinematheque & Auteur Film Noir',
  },
  'french-new-wave': {
    family: 'cinema',
    badge: 'NEW WAVE',
    tagColor: '#2563eb',
    sphere: 'Nouvelle Vague & Jump-Cut Cinema',
  },
  'saul-bass-vertigo': {
    family: 'cinema',
    badge: 'SAUL BASS',
    tagColor: '#ef4444',
    sphere: 'Mid-Century Kinetic Title Sequences',
  },

  // --------------------------------------------------------------------------
  // 5. MUSIC SUBCULTURES, SOUND & VINYL SLEEVES
  // --------------------------------------------------------------------------
  'blue-note-jazz': {
    family: 'music',
    badge: 'BLUE NOTE',
    tagColor: '#1d4ed8',
    sphere: 'Jazz, Soul & Vinyl Dubplate',
  },
  'factory-records': {
    family: 'music',
    badge: 'FAC 51',
    tagColor: '#eab308',
    sphere: 'Factory Records & Post-Punk Manchester',
  },
  'psychedelic-rock': {
    family: 'music',
    badge: 'PSYCH ROCK',
    tagColor: '#84cc16',
    sphere: '1967 Fillmore San Francisco Rock',
  },

  // --------------------------------------------------------------------------
  // 6. ACTIVISM, MANIFESTOS & ZINE PRESS
  // --------------------------------------------------------------------------
  'activist-risograph': {
    family: 'activism',
    badge: 'RISO',
    tagColor: '#f43f5e',
    sphere: 'Activist Manifesto & Social Screenprint',
  },
  'punk-diy-dada': {
    family: 'activism',
    badge: 'PUNK DADA',
    tagColor: '#e11d48',
    sphere: 'Punk Zine, Ransom Collage & Dada',
  },

  // --------------------------------------------------------------------------
  // 7. NATURE, EARTH & ZEN PHILOSOPHY
  // --------------------------------------------------------------------------
  'botanical-herbarium': {
    family: 'nature-zen',
    badge: 'BOTANICAL',
    tagColor: '#2d6a4f',
    sphere: 'Natural History & Botanical Herbarium',
  },
  'wabi-sabi-zen': {
    family: 'nature-zen',
    badge: 'WABI-SABI',
    tagColor: '#1e293b',
    sphere: 'Japanese Mingei & Washi Negative Space',
  },
  'scandinavian-biophilic': {
    family: 'nature-zen',
    badge: 'BIOPHILIC',
    tagColor: '#059669',
    sphere: 'Nordic Organic Modernism & Woodcraft',
  },

  // --------------------------------------------------------------------------
  // 8. ARCHITECTURE & SPATIAL STRUCTURES
  // --------------------------------------------------------------------------
  'architectural-brutalism': {
    family: 'architecture',
    badge: 'BRUTALISM',
    tagColor: '#f97316',
    sphere: 'Modernist Architecture & Concrete Monoliths',
  },
  'blueprint-cartography': {
    family: 'architecture',
    badge: 'BLUEPRINT',
    tagColor: '#0284c7',
    sphere: 'Cyanotype Blueprints & Bathymetry',
  },

  // --------------------------------------------------------------------------
  // 9. SPECULATIVE FUTURES, Y2K & CYBERNETICS
  // --------------------------------------------------------------------------
  'afrofuturism-cosmic': {
    family: 'speculative',
    badge: 'COSMIC JAZZ',
    tagColor: '#f59e0b',
    sphere: 'Afrofuturism & Speculative Space Arkestra',
  },
  'y2k-cyber-millennium': {
    family: 'speculative',
    badge: 'Y2K CHROME',
    tagColor: '#38bdf8',
    sphere: 'Millennium Liquid Chrome & Cyber Aesthetics',
  },
  'cyber-telemetry': {
    family: 'speculative',
    badge: 'CYBER',
    tagColor: '#00f0ff',
    sphere: 'Cybernetic Systems & Aerospace HUD',
  },

  // --------------------------------------------------------------------------
  // 10. UNDERGROUND CLUB, AUDIOVISUAL & KINETIC ART
  // --------------------------------------------------------------------------
  'brutalist-club': {
    family: 'club-kinetic',
    badge: 'CLUB 909',
    tagColor: '#ccff00',
    sphere: 'Club & Audiovisual Underground',
  },
  'op-art-moire': {
    family: 'club-kinetic',
    badge: 'OP-ART',
    tagColor: '#facc15',
    sphere: 'Kinetic Optical Art & Wave Interference',
  },
  'vaporwave-vhs': {
    family: 'club-kinetic',
    badge: 'RETRO VHS',
    tagColor: '#f472b6',
    sphere: 'Retro Analog VHS & Tape Retrowave',
  },

  // --------------------------------------------------------------------------
  // 11. FESTIVE CALENDAR & CULTURAL HOLIDAYS
  // --------------------------------------------------------------------------
  'christmas-noel-solstice': {
    family: 'festive-seasonal',
    badge: 'NOËL',
    tagColor: '#15803d',
    sphere: 'Winter Solstice & Alpine Yuletide',
  },
  'new-year-countdown': {
    family: 'festive-seasonal',
    badge: 'NEW YEAR',
    tagColor: '#eab308',
    sphere: 'Neo-Metropolis Countdown & Gala',
  },
  'tet-lunar-spring': {
    family: 'festive-seasonal',
    badge: 'TẾT XUÂN',
    tagColor: '#dc2626',
    sphere: 'Vietnamese Lunar Spring & Imperial Lacquer',
  },
  'tet-trung-thu-star-lantern': {
    family: 'festive-seasonal',
    badge: 'TRUNG THU',
    tagColor: '#e11d48',
    sphere: 'Tết Trung Thu & Rước Đèn Dân Gian',
  },
  'mid-autumn-celestial-moon': {
    family: 'festive-seasonal',
    badge: 'MOONLIGHT',
    tagColor: '#f59e0b',
    sphere: 'Celestial Harvest Moon & Tea Ceremony',
  },
  'halloween-all-hallows': {
    family: 'festive-seasonal',
    badge: 'HALLOWS',
    tagColor: '#ea580c',
    sphere: 'Gothic Macabre & All Hallows Eve',
  },
  'diwali-festival-lights': {
    family: 'festive-seasonal',
    badge: 'DIWALI',
    tagColor: '#eab308',
    sphere: 'Sacred Illumination & Deepavali',
  },
  'carnival-rio-masquerade': {
    family: 'festive-seasonal',
    badge: 'CARNIVAL',
    tagColor: '#10b981',
    sphere: 'Rio Sambadrome & Venetian Masquerade',
  },
  'summer-solstice-solar': {
    family: 'festive-seasonal',
    badge: 'SOLSTICE',
    tagColor: '#f97316',
    sphere: 'Midsummer Solar Equinox & Sunburst',
  },
};

export const ARCHETYPE_FAMILY_TABS: Array<{ id: ArchetypeFamily; label: string }> = [
  { id: 'all', label: 'All Spheres (37)' },
  { id: 'modernism', label: 'Modernism & Bauhaus' },
  { id: 'editorial', label: 'Editorial & Lookbooks' },
  { id: 'classical', label: 'Classical Art & Deco' },
  { id: 'cinema', label: 'Cinema & Title Cards' },
  { id: 'music', label: 'Music & Vinyl Sleeves' },
  { id: 'activism', label: 'Activism & Zines' },
  { id: 'nature-zen', label: 'Nature & Wabi-Sabi' },
  { id: 'architecture', label: 'Architecture & Blueprint' },
  { id: 'speculative', label: 'Speculative Futures & Y2K' },
  { id: 'club-kinetic', label: 'Underground Club & Op-Art' },
  { id: 'festive-seasonal', label: 'Festive & Calendar Holidays (9)' },
];
