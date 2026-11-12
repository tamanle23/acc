/**
 * Acoustic Translation Bridge: Mapping Vietnamese cultural onomatopoeia to English acoustic descriptors.
 */
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
  'bo': {
    'u_bo': 'Cow mooing low pitch, domestic cattle sound, deep bovine call'
  },
  'trau': {
    'nghe_o': 'Water buffalo calling, deep resonance bovine, pastoral farm'
  },
  'de': {
    'be_be': 'Goat bleating, farm animal crying, cute domestic goat sound'
  },
  'cuu': {
    'be_e': 'Sheep baa sound, gentle woolly livestock bleat'
  },
  'ngua': {
    'hi_hi': 'Horse whinnying loudly, domestic equine neigh, galloping horse snort'
  },

  // WILD & AMPHIBIANS
  'ech': {
    'op_op': 'Bullfrog croaking loud, wet pond amphibian, deep frog resonance',
    'uong_uong': 'Giant toad croaking, reverberant night pond, marshland ambience'
  },
  've_sau': {
    've_ve': 'Summer cicadas buzzing intense, hot tropical forest insect swarm',
    'ri_ri': 'Evening crickets chirping rhythmically, calm rural night meadow'
  },
  'de_men': {
    'ri_ri': 'Cricket chirping, single field cricket singing in grass'
  },
  'chim': {
    'liu_lo': 'Songbird tweeting cheerfully, morning forest canopy melody',
    'hot_hot': 'Tropical birds singing loudly, vibrant jungle avian ambience',
    'cuc_cu': 'Cuckoo bird call, gentle rhythmic forest clock bird'
  },
  'ho': {
    'gam_gu': 'Tiger roaring menacingly, deep predatory feline growl, jungle predator'
  },
  'voi': {
    'gam_gam': 'Elephant trumpeting loudly, powerful pachyderm call, savanna giant'
  }
};
