import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('effects-registry.json', 'utf-8'));

data.composites = {
  ...data.composites,
  "romantic_spring": {
    "category": "Romance",
    "description": "Dreamy sakura petals falling with soft drifting bokeh and vintage light leaks.",
    "layers": [
      { "effect": "leaves", "variant": "sakura_petals", "duration": 7 },
      { "effect": "bokeh", "variant": "drifting_bokeh", "duration": 5 },
      { "effect": "light_leak", "variant": "edge_burns", "duration": 3 }
    ]
  },
  "found_footage": {
    "category": "Retro",
    "description": "Creepy analog VHS tracking with camcorder UI and film dirt.",
    "layers": [
      { "effect": "vhs", "variant": "tracking_lines", "duration": 3 },
      { "effect": "camera_ui", "variant": "camcorder_rec", "duration": 5 },
      { "effect": "film_damage", "variant": "film_dirt", "duration": 7 }
    ]
  },
  "shonen_finisher": {
    "category": "Anime",
    "description": "Intense anime radial speed lines with branching lightning and embers.",
    "layers": [
      { "effect": "speed_lines", "variant": "radial_burst", "duration": 3 },
      { "effect": "embers", "variant": "windy_sparks", "duration": 5 },
      { "effect": "lightning", "variant": "branching_lightning", "duration": 7 }
    ]
  },
  "spaceship_cockpit": {
    "category": "Sci-Fi",
    "description": "Warp speed starfield background with sci-fi HUD targeting and anamorphic flares.",
    "layers": [
      { "effect": "starfield", "variant": "warp_speed", "duration": 3 },
      { "effect": "sci_fi_hud", "variant": "target_lock", "duration": 7 },
      { "effect": "lens_flare", "variant": "anamorphic_streak", "duration": 5 }
    ]
  },
  "neon_noir": {
    "category": "Atmosphere",
    "description": "Sliding rain drops on glass with distant drizzle and intermittent sheet lightning.",
    "layers": [
      { "effect": "rain_on_glass", "variant": "sliding_drops", "duration": 5 },
      { "effect": "rain", "variant": "drizzle", "duration": 3 },
      { "effect": "lightning", "variant": "sheet_lightning", "duration": 11 }
    ]
  },
  "deep_abyss": {
    "category": "Atmosphere",
    "description": "Underwater god ray shafts with floating bubbles and murky ground mist.",
    "layers": [
      { "effect": "god_rays", "variant": "underwater_shafts", "duration": 7 },
      { "effect": "bubbles", "variant": "underwater_bubbles", "duration": 5 },
      { "effect": "fog", "variant": "ground_mist", "duration": 11 }
    ]
  },
  "apocalyptic_wasteland": {
    "category": "Action & Fire",
    "description": "Rolling smoke, ambient dust, and a wall of fire for a post-apocalyptic feel.",
    "layers": [
      { "effect": "smoke", "variant": "rolling_smoke", "duration": 11 },
      { "effect": "dust", "variant": "sunshaft_dust", "duration": 7 },
      { "effect": "fire", "variant": "wall_of_fire", "duration": 5 }
    ]
  }
};

fs.writeFileSync('effects-registry.json', JSON.stringify(data, null, 2));
console.log("Injected 7 new composites into registry!");
