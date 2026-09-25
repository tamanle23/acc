import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('effects-registry.json', 'utf-8'));

data.composites = {
  "haunted_forest": {
    "category": "Horror",
    "description": "Spooky ground mist with subtle dust and film damage.",
    "layers": [
      { "effect": "fog", "variant": "ground_mist", "duration": 7 },
      { "effect": "dust", "variant": "ambient_dust", "duration": 5 },
      { "effect": "film_damage", "variant": "hairline_scratches", "duration": 3 }
    ]
  },
  "cyberpunk_alley": {
    "category": "Sci-Fi",
    "description": "Heavy rain combined with rolling smoke and digital glitches.",
    "layers": [
      { "effect": "rain", "variant": "heavy_rain", "duration": 5 },
      { "effect": "smoke", "variant": "rolling_smoke", "duration": 7 },
      { "effect": "digital_glitch", "variant": "rgb_shake", "duration": 11 }
    ]
  }
};

fs.writeFileSync('effects-registry.json', JSON.stringify(data, null, 2));
