import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { PythonBackend } from '@acc/core';
import path from 'path';

// Acoustic Translation Bridge: Mapping Vietnamese cultural onomatopoeia to English AI prompts
export const FAUNA_DICTIONARY: Record<string, Record<string, string>> = {
  // DOMESTIC / PETS
  'cho': {
    'gau_gau': 'Dog barking loudly, domestic canine woof, aggressive bark',
    'ang_ang': 'Small puppy crying, high pitch dog yelp, whimpering',
    'gu_gu': 'Dog growling, threatening low pitch canine growl',
    'u_u': 'Soft dog whining, whimpering, begging for food, cute whine'
  },
  'meo': {
    'meo_meo': 'Cat meowing loudly, feline cry, cute kitten meow',
    'ru_ru': 'Cat purring happily, low vibrating feline sound, ASMR close up purr',
    'ngoao_ngoao': 'Cat howling loudly, angry feline yowling, feral cat calling'
  },
  'chuot': {
    'chit_chit': 'Mouse squeaking, high pitched rat squeaks, tiny rodent sounds'
  },

  // LIVESTOCK & POULTRY
  'ga_trong': {
    'o_o_o': 'Rooster crowing loud, morning farm bird, cock-a-doodle-doo'
  },
  'ga_mai': {
    'cuc_tac': 'Hen clucking loudly, female chicken sounds, domestic poultry'
  },
  'ga_con': {
    'chip_chip': 'Baby chick chirping, tiny bird peeps, cute poultry sounds'
  },
  'vit': {
    'cap_cap': 'Duck quacking loudly, waterfowl farm animal, goose honk'
  },
  'lon': {
    'et_et': 'Pig squealing loudly, intense piglet squeak, farm animal distress',
    'un_in': 'Pig grunting softly, snorting pig sounds, happy hog',
    'en_en': 'Pig squealing for food, high pitched hungry piglet crying'
  },
  'trau': {
    'nghe_o': 'Water buffalo bellowing, loud cattle lowing, deep cow moo'
  },
  'bo': {
    'mooo': 'Cow mooing loudly, deep cattle moo, farm animal'
  },
  'de': {
    'be_be': 'Goat bleating loudly, sheep baa, farm animal cry'
  },
  'ngua': {
    'hi_hi': 'Horse whinnying loudly, stallion neighing, wild horse vocalization',
    'coc_coc': 'Horse galloping hooves, walking on dirt road, rhythmic clicking'
  },

  // WILD ANIMALS
  'ho': {
    'gam_vang': 'Tiger roaring loudly, deep bass wildcat growl, apex predator'
  },
  'voi': {
    'rong': 'Elephant trumpeting loudly, massive mammal bellow, wildlife safari'
  },
  'khi': {
    'chi_choe': 'Monkey chattering excitedly, high pitched primate screeches, jungle ape',
    'hu_hu': 'Gibbon howling, ape hooting sounds, monkey whoop'
  },
  'soi': {
    'hu_dai': 'Lone wolf howling at the moon, long eerie howl, night forest'
  },
  'ech': {
    'op_op': 'Frog croaking loudly, amphibian ribbit, swamp nocturnal animal'
  },
  'ran': {
    'xuyt_xuyt': 'Snake hissing aggressively, reptile tongue slither, venomous strike'
  },

  // BIRDS
  'chim_se': {
    'liu_lo': 'Small birds singing, beautiful dawn chorus, happy chirping tweet'
  },
  'qua': {
    'qua_qua': 'Crow cawing loudly, raven croak, dark bird sounds'
  },
  'tu_hu': {
    'tu_hu': 'Asian koel bird calling, cuckoo bird song, rhythmic hoot'
  },
  'bo_cau': {
    'gu_gu': 'Pigeon cooing softly, dove purr, urban bird sound'
  },
  'cu_meo': {
    'ruc': 'Owl hooting in the night, nocturnal bird call, eerie hoot'
  },

  // INSECTS
  'muoi': {
    'vo_ve': 'Mosquito buzzing close to ear, annoying fly hum, tiny insect wings'
  },
  've_sau': {
    've_ve': 'Cicada buzzing loudly, summer insect drone, constant hum'
  },
  'de_men': {
    'ri_ra': 'Cricket chirping at night, relaxing insect rhythm, nighttime ambiance'
  }
};

export class Fauna implements ISoundGenerator {
  constructor(private aiModel: string) { }

  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s_${this.aiModel}`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let prompt = customPrompt || '';

    // Look up the translation bridge for cultural onomatopoeia
    const animalEntry = FAUNA_DICTIONARY[variant];
    if (animalEntry && animalEntry[subVariant]) {
      prompt = animalEntry[subVariant];
    } else {
      // Fallback: If not in dictionary, construct a generic English prompt from keys
      prompt = 'High quality nature recording of animal sounds, ';
      prompt += `${variant.replace(/_/g, ' ')} ${subVariant.replace(/_/g, ' ')}, realistic wildlife fauna.`;
    }

    const engine = PythonBackend.getInstance();
    await engine.dispatchTask<{ file_path: string }>('audio', 'generate_sfx', { prompt, model: this.aiModel, duration, output_path: audioPath });

    const metadata = { effect, variant, subVariant, category: 'fauna', duration, engine: 'ai', model: this.aiModel, aiPrompt: prompt };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}



