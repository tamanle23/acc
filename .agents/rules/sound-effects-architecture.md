# Sound Effects CLI: Architecture & Catalog Rules

## 1. Modular Architecture & Compositing

- **CLI Pattern:** Use strict arguments: `--effect <name> --variant <name> --sub-variant <name>`.
- **Procedural Generation:** Use FFmpeg audio filters (`afade`, `aecho`, `asetrate`, `volume`, `highpass`, `lowpass`, `tremolo`) to dynamically generate sub-variants from a minimal set of base stems.
- **Companion Metadata:** Every generated audio file (`.wav` or `.mp3`) MUST output a companion `.json` file containing duration, volume metadata, and the exact FFmpeg mixing instructions/filters used.
- **Combinatorial Composites:** Use `--composite` to stack multiple polyrhythmic audio loops or one-shot layers using the FFmpeg `amix` filter.

---

## 2. Engine Selection Guidelines (AI vs Library vs FFmpeg)

Since AI models (like AudioLDM2) often struggle with biological accuracy and can produce "synthetic" or muffled artifacts, it is critical to choose the correct engine for each sound category:

| Engine | Best Used For | Not Recommended For |
| :--- | :--- | :--- |
| **`library`** (Freesound) | **Fauna** (animal calls, realistic barks, cries), **Diegetic** (real weather, traffic), **Realistic Foley** (footsteps, keys). | Sci-fi sounds, abstract magical effects, UI beeps. |
| **`ai`** (Deep Learning) | **Sci-Fi** (lasers, spaceships), **Cinematic** (braams, risers, impacts), **Creature** (aliens, monsters). | Real animal sounds (e.g., dogs, birds), realistic nature environments. |
| **`ffmpeg`** (Procedural) | **UI** (clicks, error buzzes, comedy censors), simple generated tones, composite layering (`amix`). | Complex organic sounds, voices, weather. |

> **Note on AI Accuracy:** If a realistic animal sound or specific real-world event is needed, ALWAYS default to the `library` engine. AudioLDM2 and similar models are highly stochastic and often fail at strict real-world mimicry.

---

## 3. Core Categories & Catalog System

The sound effects catalog is deeply enriched with three dimensions: **Effect Theme**, **Base Variant**, and **Sub-Variants**.

### 1. Foley
| Effect Theme | Base Variant | Sub-Variants |
| :--- | :--- | :--- |
| `footsteps` | `gravel`, `wood`, `snow`, `metal` | `slow_walk`, `sprint`, `heavy_boots`, `stealth_creep` |
| `cloth` | `denim`, `heavy_leather`, `silk` | `subtle_shift`, `fast_swipe`, `frantic_struggle` |
| `handling` | `keys`, `paper`, `glass`, `ceramic` | `jingle`, `drop_shatter`, `slow_crumple`, `clinking` |
| `typing` | `mech_keyboard`, `laptop`, `typewriter` | `single_keystroke`, `fast_typing_burst`, `angry_slam` |

### 2. Diegetic SFX
| Effect Theme | Base Variant | Sub-Variants |
| :--- | :--- | :--- |
| `weather` | `rain`, `wind`, `thunder` | `drizzle_on_tent`, `heavy_rain_tin_roof`, `howling_blizzard` |
| `water` | `ocean`, `stream`, `underwater` | `gentle_lapping_waves`, `crashing_surf`, `muffled_submerged` |
| `urban` | `traffic`, `cafe`, `subway` | `distant_highway_drone`, `crowded_bar_chatter`, `train_passing` |
| `mechanical` | `car_engine`, `door`, `clock` | `revving_idle`, `squeaky_creak_open`, `heavy_vault_slam` |

### 3. Non-Diegetic SFX (Cinematic)
| Effect Theme | Base Variant | Sub-Variants |
| :--- | :--- | :--- |
| `transition`| `whoosh`, `swoosh`, `air_rush` | `fast_whip`, `slow_cinematic_pass`, `low_sub_rumble` |
| `impact` | `hit`, `boom`, `slam` | `heavy_metallic`, `muffled_sub_drop`, `glass_shatter_layer` |
| `tension` | `riser`, `braam`, `stinger` | `slow_horror_build`, `digital_glitch_ascend`, `tinnitus_ring` |

### 4. UI / Interactive
| Effect Theme | Base Variant | Sub-Variants |
| :--- | :--- | :--- |
| `click` | `mouse`, `screen_tap`, `menu_nav` | `plastic_pop`, `glass_haptic`, `muffled_thud`, `sharp_snap` |
| `feedback` | `success`, `error`, `warning` | `bright_chime`, `harsh_buzz`, `retro_8bit_coin` |
| `comedy` | `punchline`, `censor`, `awkward` | `record_scratch_fast`, `vinyl_slow_stop`, `1k_sine_beep` |

---

## 4. Fauna & Creature Acoustic Architecture

### A. By Habitat & Taxonomy
| Category | Base Variant | Sub-Variants |
| :--- | :--- | :--- |
| `domestic_farm` | `canine_feline`, `livestock` | `bark`, `growl`, `purr`, `cattle_lowing`, `horse_whinny`, `pig_squeal`, `rooster_crow` |
| `wild_terrestrial` | `apex_predator`, `herbivore` | `lion_roar`, `wolf_howl`, `hyena_whoop`, `elk_bugle`, `elephant_trumpet`, `ape_screech` |
| `avian` | `songbirds`, `birds_of_prey`, `waterfowl` | `dawn_chorus`, `falcon_screech`, `owl_hoot`, `duck_quack`, `raven_caw` |
| `reptile_insect` | `reptile`, `amphibian`, `insect` | `snake_hiss`, `gator_bellow`, `frog_croak`, `cicada_chirp`, `bee_buzz`, `beetle_click` |
| `marine` | `whale`, `dolphin`, `seal`, `crustacean` | `whale_song`, `dolphin_click`, `seal_bark`, `hydrophone_snap` |

### B. By Behavioral Context
- **`aggression_combat`**: Roars, snarls, hisses, charging vocals, teeth clicking.
- **`alarm_distress`**: Screams, warning squawks, high-pitched yelps.
- **`mating_territory`**: Rutting bugles, territorial howling, bellows.
- **`social_contact`**: Mother-offspring calls, murmurs, purrs.
- **`feeding`**: Chewing, bone crunching, tearing flesh, slurping.

### C. Locomotion & Animal Foley
| Effect Theme | Base Variant | Sub-Variants |
| :--- | :--- | :--- |
| `paws_hooves_claws`| `dirt`, `stone`, `dry_leaves` | `heavy_gallop`, `claw_clicks`, `scurrying_leaves` |
| `wing_flaps` | `takeoff`, `heavy_flap`, `hovering` | `pigeon_startle`, `swan_heavy_takeoff`, `hummingbird_hum` |
| `foliage_env` | `grass`, `brush`, `water` | `rustling_stealth`, `crashing_undergrowth`, `wading_splash` |

### D. Hybrid & Creature Sound Design (Sci-Fi / Fantasy)
- **Kaiju & Giant Beasts:** `lion`, `tiger`, or `bear` pitched down 30%-50% with added sub-bass.
- **Alien Shrieks & Zombies:** High-stress `pig_squeals` and `camel_gurgles` providing guttural vocal cord texture.
- **Subterranean / Swamp Horrors:** Deep throat resonations and wet breathing sourced from `walruses` and `sea_lions`.
- **Dragons & Reptilian Beasts:** Harsh hissing and screeching constructed from `vultures` and `geese`.

---

## 5. Composite Generation: The Layering Blueprint

The CLI's `--composite` engine uses FFmpeg's `amix` and EQ filters (`lowpass`, `highpass`) to dynamically generate punchy composites using a **3-Layer Frequency Blueprint**:

1. **Transient / Attack (Highs):** A sharp click, metal snap, or whip crack ($2\text{ kHz} - 8\text{ kHz}$).
2. **Body / Texture (Mids):** The recognizable characteristic sound, such as wood splintering or stone grinding ($300\text{ Hz} - 2\text{ kHz}$).
3. **Weight / Sub (Lows):** A low-end sine drop or thud ($40\text{ Hz} - 120\text{ Hz}$) that gives physical power and resonance.

*Example workflow for generating `--composite kaiju_roar`:*
- Layer 1 (Highs/Transients): `vulture_screech` (Highpass filtered)
- Layer 2 (Mids/Texture): `pig_squeal` (EQ balanced around 1kHz)
- Layer 3 (Lows/Sub): `lion_roar` (Pitched down 40% + Lowpass filtered)

## 6. Maintenance Directive
**CRITICAL**: If a new sound effect or variant is requested, you MUST update this rule file (`.agents/rules/sound-effects-architecture.md`) strictly following the Markdown Table format above before writing any implementation code.

