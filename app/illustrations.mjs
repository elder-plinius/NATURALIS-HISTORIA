import { cellImageSourceFor, imageSourceFor } from './generated-image-sources.mjs';
import { certifiedAtlasOverrideFor } from './generated-certified-artwork-overrides.mjs';
import { chapterSceneSourceFor } from './generated-chapter-scene-sources.mjs';

const GRID_FOCI = [
  [16, 18], [38, 18], [62, 18], [84, 18],
  [16, 50], [38, 50], [62, 50], [84, 50],
  [16, 82], [38, 82], [62, 82], [84, 82],
];

export const SIX_CELL_FOCI = Object.freeze({
  A1: Object.freeze([16, 25]),
  A2: Object.freeze([50, 25]),
  A3: Object.freeze([84, 25]),
  B1: Object.freeze([16, 75]),
  B2: Object.freeze([50, 75]),
  B3: Object.freeze([84, 75]),
});

// Percentage-point distance between focal coordinates. Below this threshold,
// adjacent crops read as repeats of the same study rather than distinct panels.
export const PANEL_MIN_FOCUS_DISTANCE = 24;

const ASSETS = {
  dedication: { image: '/assets/dedication-pliny-vespasian.jpg', alt: 'Pliny presenting the Natural History in an imperial Roman library' },
  cosmosClassic: { image: '/assets/cosmos-four-elements.jpg', alt: 'the cosmos and four elements on an aged natural-history folio' },
  humanityClassic: { image: '/assets/humanity-anatomy-healing.jpg', alt: 'classical studies of the human body and healing' },
  animalsClassic: {
    image: '/assets/terrestrial-animals.jpg',
    alt: 'elephant, bear, lion, deer, horse, hare, tortoise, lizard, beetles, and comparative tracks',
    focuses: [[19, 24], [21, 58], [52, 48], [77, 24], [82, 62], [15, 81], [29, 81], [42, 88], [51, 88]],
  },
  marineClassic: {
    image: '/assets/marine-waters-remedies.jpg',
    alt: 'springs, salt pans, fish, dolphins, octopus, nautilus, shells, coral, and sponges',
    focuses: [[20, 17], [29, 47], [68, 42], [43, 76], [58, 62], [19, 82], [80, 76]],
  },
  flightClassic: {
    image: '/assets/birds-insects-flight.jpg',
    alt: 'bees, eagle, owl, crane, phoenix, swallow, peacock feather, butterfly, spider, and beetle',
    focuses: [[12, 25], [30, 24], [56, 16], [86, 22], [60, 49], [72, 46], [32, 62], [32, 83], [69, 86], [8, 65]],
  },
  botanyAtlas: { image: '/assets/botany-materia-medica-atlas.jpg', alt: 'botanical specimens, agriculture, and materia medica' },
  elephants: {
    image: '/assets/elephant-life-actions-atlas.jpg',
    alt: 'elephant training, behaviour, family life, ivory, feet, and tracks',
    focuses: [[20, 22], [49, 22], [78, 22], [20, 55], [66, 55], [21, 84], [58, 84]],
  },
  quadrupeds: {
    image: '/assets/terrestrial-quadrupeds-atlas.jpg',
    alt: 'lion, bear, wolf, dog, horse, cattle, deer, goat, boar, camel, rhinoceros, and hyena',
    focuses: GRID_FOCI,
  },
  rareTerrestrial: {
    image: '/assets/rare-terrestrial-life-atlas.jpg',
    alt: 'lynx, ape, porcupine, mouse, mole, sheep, bison, mongoose, frog, hare, goat, and chameleon',
    focuses: GRID_FOCI,
  },
  marineLife: {
    image: '/assets/marine-life-atlas.jpg',
    alt: 'whale, dolphins, fish, octopus, cuttlefish, shells, crocodile, hippopotamus, and seal',
    focuses: [[36, 17], [82, 17], [16, 45], [38, 43], [66, 43], [86, 43], [20, 63], [58, 64], [84, 62], [18, 84], [57, 84], [84, 84]],
  },
  marineInvertebrates: {
    image: '/assets/marine-invertebrate-atlas.jpg',
    alt: 'sea-nettle, sea anemone, coral, sponges, cuttlefish, octopus, nautilus, sea urchin, starfish, murex, oyster, tunicate, and tide-pool polyps',
    focuses: GRID_FOCI,
  },
  wingedLife: {
    image: '/assets/birds-insects-reptiles-atlas.jpg',
    alt: 'eagle, owl, raven, swallow, bee, crane, ostrich, spider, beetle, serpent, and chameleon',
    focuses: [[26, 20], [56, 19], [84, 19], [19, 52], [38, 51], [62, 52], [83, 51], [17, 84], [35, 84], [52, 82], [78, 83]],
  },
  birdsDomestic: {
    image: '/assets/birds-domestic-insects-atlas.jpg',
    alt: 'parrot, pigeon, goose, rooster, kite, bat, silkworm, scorpion, grasshopper, locust, wasps, hornet, and peacock',
    focuses: GRID_FOCI,
  },
  mediterranean: {
    image: '/assets/mediterranean-coasts-routes-atlas.jpg',
    alt: 'the Mediterranean basin, coasts, islands, river mouths, cities, harbours, and sea routes',
    focuses: [[50, 48], [18, 37], [48, 35], [74, 43], [25, 61], [66, 62], [79, 74]],
  },
  regions: {
    image: '/assets/europe-africa-asia-peoples-atlas.jpg',
    alt: 'interconnected ancient regions, settlements, roads, travellers, farmers, herders, and ports',
    focuses: [[24, 29], [52, 55], [77, 28], [25, 70], [76, 69], [50, 45]],
  },
  romanWorks: {
    image: '/assets/roman-cities-engineering-geography-atlas.jpg',
    alt: 'a Roman harbour city, aqueduct, bridge, road, springs, volcano, and earthquake fissure',
    focuses: [[50, 50], [17, 18], [17, 47], [17, 78], [83, 18], [83, 47], [82, 78]],
  },
  celestialWeather: {
    image: '/assets/celestial-weather-phenomena-atlas.jpg',
    alt: 'sun, moon phases, eclipses, comet, stars, weather, tides, volcano, and earth tremor',
    focuses: [[14, 12], [38, 12], [61, 12], [85, 12], [14, 30], [50, 48], [85, 30], [14, 58], [85, 49], [85, 67], [14, 84], [38, 84], [63, 84], [85, 84]],
  },
  trees: {
    image: '/assets/trees-orchards-arboriculture-atlas.jpg',
    alt: 'forest trees, olive, vine, fruit trees, date palm, timber, pruning, and grafting',
    focuses: [[15, 24], [30, 22], [43, 22], [53, 23], [70, 23], [17, 56], [42, 55], [61, 55], [82, 57], [22, 83], [61, 84]],
  },
  cropsHerbs: {
    image: '/assets/crops-flowers-herbs-remedies-atlas.jpg',
    alt: 'grain, flax, legumes, flowers, herbs, bulbs, roots, seeds, harvest, and remedy preparation',
    focuses: [[15, 22], [38, 20], [62, 22], [85, 22], [16, 52], [38, 52], [61, 52], [84, 52], [16, 82], [55, 80], [84, 80]],
  },
  romanMedicine: {
    image: '/assets/roman-medicine-anatomy-care-atlas.jpg',
    alt: 'anatomy, skeleton, eye, hand, maternal care, surgery, remedies, and a physician at work',
    focuses: [[16, 24], [38, 22], [59, 21], [76, 25], [89, 25], [17, 70], [53, 72], [82, 73]],
  },
  mineralArts: {
    image: '/assets/minerals-metals-arts-atlas-v2.jpg',
    alt: 'Roman mining, ores, metallurgy, gems, pigments, painting, sculpture, and architecture',
    focuses: [[34, 18], [75, 18], [23, 45], [73, 45], [20, 70], [47, 72], [68, 76], [87, 76]],
  },
  lacunaAtlas: {
    image: '/assets/creatures-papyrus-lacuna-atlas.jpg',
    alt: 'crustaceans and shells, an ant colony, birds nests and eggs, and papyrus with ancient scroll-making tools',
    focuses: [[25, 25], [75, 25], [25, 75], [75, 75]],
  },
  vesuviusLetters: {
    image: '/assets/pliny-younger-vesuvius-letters-atlas.jpg',
    alt: 'Pliny observing Vesuvius, the Roman rescue fleet, preparations at Misenum, and the ash-dark shore at Stabiae',
    focuses: [[25, 25], [75, 25], [25, 75], [75, 75]],
  },
  earthPhenomena: {
    image: '/assets/earth-regions-phenomena-atlas.jpg',
    alt: 'islands, a river and delta, underground fire, ancient regions, Roman roads and cities, and atmospheric phenomena',
    focuses: [[16, 25], [50, 25], [84, 25], [16, 75], [50, 75], [84, 75]],
  },
  mineralFire: {
    image: '/assets/mineral-fire-lacuna-atlas.jpg',
    alt: 'lodestone, mineral specimens, lime and mortar, glassmaking, metal smelting, and ground mineral pigments',
    focuses: [[16, 25], [50, 25], [84, 25], [16, 75], [50, 75], [84, 75]],
  },
  skyMeasure: {
    image: '/assets/sky-measure-prodigies-atlas.jpg',
    alt: 'Roman sky measurement, gnomons, sundials, atmospheric prodigies, climate zones, and day lengths',
    focuses: GRID_FOCI,
  },
  aromaticsApothecary: {
    image: '/assets/aromatics-apothecary-atlas.jpg',
    alt: 'aromatic resins, Roman apothecary work, vinegars, squill, theriac, pitch, pressing, and trade',
    focuses: GRID_FOCI,
  },
  humanLifeBelief: {
    image: '/assets/human-life-belief-atlas.jpg',
    alt: 'Roman family life, ages, hearing, civic honours, divination, freedmen, timekeeping, medicine, ritual, and care',
    focuses: GRID_FOCI,
  },
  medicinalHerbarium: {
    image: '/assets/medicinal-herbarium-atlas.jpg',
    alt: 'plantain, nettle, mallow, wormwood, hellebore, mandrake, hemlock, aconite, gentian, culinary herbs, and aloe',
    focuses: GRID_FOCI,
  },
  minorHerbs: {
    image: '/assets/plinian-minor-herbs-atlas.jpg',
    alt: 'male and female mercurialis, scarlet and blue anagallis, aegilops, mandrake, hemlock, crethmos, capnos, acoron, cotyledon, and ranunculus',
    focuses: GRID_FOCI,
  },
  comparativeAnatomy: {
    image: '/assets/comparative-animal-anatomy-atlas.jpg',
    alt: 'comparative skulls and teeth, bird feet and beaks, mammal legs and hooves, fish skeletons, insect morphology, and vertebral anatomy',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  aquaticMateria: {
    image: '/assets/aquatic-materia-medica-atlas.jpg',
    alt: 'sponges, coral, shells, aquatic plants, mineral waters and salts, and marine remedy preparation',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  romanAgriculture: {
    image: '/assets/roman-agriculture-gardens-atlas.jpg',
    alt: 'an irrigated Roman garden, flax preparation, grain and legumes, grafting, wine pressing, and cultivated flowers',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  fishForms: {
    image: '/assets/fish-forms-behaviour-atlas.jpg',
    alt: 'giant sea life, comparative fish forms, eels and flatfish, extraordinary fish, cephalopods, rays, spawning, and oyster beds',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  avianReproduction: {
    image: '/assets/avian-reproduction-nests-atlas.jpg',
    alt: 'bird nests, incubation, eggs, Roman poultry keeping, egg augury, and comparative oviparous reproduction',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  treeCraft: {
    image: '/assets/trees-reeds-grain-craft-atlas.jpg',
    alt: 'vine and wine work, reeds and papyrus, grain milling, aromatic resins, orchard fruits, and timber craft',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  wildRemedies: {
    image: '/assets/wild-plants-animal-remedies-atlas.jpg',
    alt: 'plantain, dwarf elder, dangerous plants, minor medicinal herbs, ancient medicine, and animal-derived remedies',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  romanMetalsArts: {
    image: '/assets/roman-metals-arts-stones-atlas.jpg',
    alt: 'Roman gold, silver and mirrors, bronze and base metals, pigments and arts, stone architecture, and precious gems',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  cosmosMechanics: {
    image: '/assets/cosmos-celestial-mechanics-atlas.jpg',
    alt: 'cosmic order, Sun and Moon phenomena, planets and time, comets, storms, winds, and weather',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  earthOcean: {
    image: '/assets/earth-processes-ocean-atlas.jpg',
    alt: 'Earth measurement, navigation and tides, earthquakes, island transformations, rivers, and earthly fire',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  westernRegions: {
    image: '/assets/western-roman-regions-atlas.jpg',
    alt: 'Hispania, Gaul and the Alps, Italy, Mediterranean islands, the Adriatic, and Danube provinces',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  easternRegions: {
    image: '/assets/eastern-southern-regions-atlas.jpg',
    alt: 'North Africa, Egypt, the Levant, Anatolia, the Caspian world, India, Arabia, and Ethiopia',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  humanCapacities: {
    image: '/assets/human-life-capacities-atlas.jpg',
    alt: 'human society, strength and courage, memory and wisdom, honours and fortune, mortality, and inventions',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  cultivatedMateria: {
    image: '/assets/cultivated-materia-medica-atlas.jpg',
    alt: 'garden vegetables, culinary herbs, apothecary work, flowers, medicinal plants, fungi, and antidotes',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  insectSocieties: {
    image: '/assets/insect-societies-lifecycles-atlas.jpg',
    alt: 'bees, wasps, ants, silkworm metamorphosis, cicadas, locusts, beetles, spiders, and scorpions',
    focuses: Object.values(SIX_CELL_FOCI),
  },
  treeSpecies: {
    image: '/assets/tree-species-arboriculture-atlas.jpg',
    alt: 'aromatic trees, vines, orchards, forest species, propagation, timber, and woodland craft',
    focuses: Object.values(SIX_CELL_FOCI),
  },
};

const CURATED_ROUTES = {
  '1:praef': { id: 'dedication', asset: 'dedication', focus: [50, 50], latin: 'NATVRAE OPVS', english: 'THE WHOLE WORK OF NATURE', layouts: ['hero'], mark: 'measure' },
  '2:48': { id: 'sky-whirlwinds', asset: 'skyMeasure', focus: [62, 50], latin: 'DE TYPHONIBVS', english: 'TYPHON, TORNADOES & WHIRLWINDS', layouts: ['ledger'], mark: 'celestial' },
  '2:57': { id: 'sky-sounds', asset: 'skyMeasure', focus: [38, 82], latin: 'DE SONITV CAELI', english: 'SOUNDS HEARD IN THE SKY', layouts: ['ledger'], mark: 'celestial' },
  '2:62': { id: 'local-weather', asset: 'skyMeasure', focus: [62, 82], latin: 'DE CAELI VARIETATE', english: 'WEATHER & CLIMATE BY PLACE', layouts: ['ledger'], mark: 'celestial' },
  '2:72': { id: 'sky-timekeeping', asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[16, 50], [84, 82]], latin: 'DE GNOMONIBVS', english: 'DIALS, SHADOWS & DAYLIGHT', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-2-gnomon-timekeeping' },
  '2:73': { id: 'sky-timekeeping', asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[16, 50], [84, 82]], latin: 'DE VMBRIS', english: 'PLACES WITHOUT SHADOW', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-2-gnomon-timekeeping' },
  '2:74': { id: 'sky-timekeeping', asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[16, 50], [84, 82]], latin: 'DE VMBRARVM RATIONE', english: 'THE DIRECTIONS OF SHADOWS', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-2-gnomon-timekeeping' },
  '2:75': { id: 'sky-timekeeping', asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[84, 82], [62, 82]], latin: 'DE DIERVM SPATIIS', english: 'LONGEST & SHORTEST DAYS', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-2-gnomon-timekeeping' },
  '2:76': { id: 'sky-timekeeping', asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[16, 50], [84, 82]], latin: 'DE PRIMO SOLARIO', english: 'THE FIRST DIAL', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-2-gnomon-timekeeping' },
  '2:77': { id: 'sky-timekeeping', asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[84, 82], [62, 82]], latin: 'DE DIERVM COMPUTATIONE', english: 'COMPUTING THE DAYS', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-2-gnomon-timekeeping' },
  '7:10': { id: 'human-generation', asset: 'humanLifeBelief', focus: [16, 18], detailFocuses: [[38, 18], [62, 18]], latin: 'DE GEMINIS', english: 'TWINS, BIRTH & SURVIVAL', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:11': { id: 'human-generation', asset: 'humanLifeBelief', focus: [16, 18], detailFocuses: [[38, 18], [62, 18]], latin: 'DE GENERATIONE HVMANA', english: 'HUMAN GENERATION & RESEMBLANCE', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:12': { id: 'human-generation', asset: 'humanLifeBelief', focus: [16, 18], detailFocuses: [[38, 18], [62, 18]], latin: 'DE SIMILITVDINE', english: 'RESEMBLANCE & HEREDITY', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:13': { id: 'human-generation', asset: 'humanLifeBelief', focus: [16, 18], detailFocuses: [[38, 18], [62, 18]], latin: 'DE FECVNDITATE', english: 'FECUNDITY & OFFSPRING', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:14': { id: 'human-generation', asset: 'humanLifeBelief', focus: [62, 18], detailFocuses: [[16, 18], [38, 18]], latin: 'DE AETATIBVS', english: 'AGE & GENERATION', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:15': { id: 'human-generation', asset: 'humanLifeBelief', focus: [16, 18], detailFocuses: [[38, 18], [62, 18]], latin: 'DE NATVRA FEMINARVM', english: 'THE CYCLES OF HUMAN GENERATION', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:16': { id: 'human-generation', asset: 'humanLifeBelief', focus: [62, 18], detailFocuses: [[16, 18], [38, 18]], latin: 'DE INFANTIBVS', english: 'GENERATION, INFANCY & GROWTH', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-7-generation' },
  '7:60': { id: 'roman-timepieces', asset: 'humanLifeBelief', focus: [16, 82], latin: 'DE HOROLOGIIS', english: 'THE FIRST TIMEPIECES', layouts: ['ledger'], mark: 'measure' },
  '8:41': { id: 'canine-madness', asset: 'quadrupeds', focus: [84, 18], latin: 'DE RABIE CANINA', english: 'CANINE MADNESS & ITS REMEDIES', layouts: ['hero'], mark: 'measure' },
  '9:45': { id: 'sea-nettle', asset: 'marineInvertebrates', focus: [16, 18], detailFocuses: [[38, 18], [84, 18]], latin: 'DE VRTICA MARINA', english: 'SEA-NETTLE & PLANT-LIKE MARINE LIFE', layouts: ['triptych'], mark: 'none' },
  '23:2': { id: 'squill-vinegar', asset: 'aromaticsApothecary', focus: [84, 50], detailFocuses: [[62, 50], [16, 82]], latin: 'DE SCILLA ET ACETO', english: 'SQUILL, VINEGAR & OXYMEL', layouts: ['triptych'], mark: 'measure' },
  '25:5': { id: 'mercurialis', asset: 'minorHerbs', focus: [16, 18], latin: 'DE LINOZOSTIDE ET MERCVRIALI', english: 'LINOZOSTIS & MERCURIALIS', layouts: ['hero'], mark: 'measure' },
  '25:13': { id: 'anagallis', asset: 'minorHerbs', focus: [38, 18], detailFocuses: [[62, 18], [84, 18]], latin: 'DE ANAGALLIDE', english: 'ANAGALLIS · TWO VARIETIES', layouts: ['triptych'], mark: 'measure' },
  '27:2': { id: 'aconite', asset: 'medicinalHerbarium', focus: [84, 50], latin: 'DE ACONITO', english: 'ACONITE', layouts: ['hero'], mark: 'measure', continuityGroup: 'book-27-aconite' },
  '27:3': { id: 'aconite', asset: 'medicinalHerbarium', focus: [84, 50], latin: 'DE ACONITO', english: 'ACONITE', layouts: ['hero'], mark: 'measure', continuityGroup: 'book-27-aconite' },
  '30:1': { id: 'roman-magic', asset: 'humanLifeBelief', focus: [62, 82], detailFocuses: [[38, 50], [16, 82]], latin: 'DE MAGIA', english: 'THE ORIGINS OF MAGIC & RITUAL', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-30-magic' },
  '30:2': { id: 'roman-magic', asset: 'humanLifeBelief', focus: [62, 82], detailFocuses: [[38, 50], [16, 82]], latin: 'DE MAGIA', english: 'BRANCHES & PRACTICES OF MAGIC', layouts: ['triptych'], mark: 'measure', continuityGroup: 'book-30-magic' },
  '30:10': { id: 'systemic-care', asset: 'humanLifeBelief', focus: [84, 82], detailFocuses: [[38, 18], [38, 82]], latin: 'DE TOTIVS CORPORIS REMEDIIS', english: 'WHOLE-BODY REMEDIES & CARE', layouts: ['triptych'], mark: 'measure' },
  '35:18': { id: 'freedmen-status', asset: 'humanLifeBelief', focus: [62, 50], detailFocuses: [[16, 50], [84, 50]], latin: 'DE LIBERTINIS', english: 'FREEDMEN, PATRONS & SOCIAL RANK', layouts: ['triptych'], mark: 'measure' },
  '2:31': { id: 'many-suns', asset: 'celestialWeather', focus: [14, 12], latin: 'DE PLVRIBVS SOLIBVS', english: 'MANY SUNS', layouts: ['orbit'], mark: 'celestial' },
  '2:32': { id: 'many-moons', asset: 'celestialWeather', focus: [50, 12], latin: 'DE PLVRIBVS LVNIS', english: 'MANY MOONS', layouts: ['orbit'], mark: 'celestial' },
  '2:63': { id: 'earth-form', asset: 'cosmosClassic', focus: [50, 50], latin: 'DE NATVRA TERRAE', english: 'THE NATURE OF EARTH', layouts: ['orbit'], mark: 'celestial' },
  '2:64': { id: 'earth-form', asset: 'cosmosClassic', focus: [50, 50], latin: 'DE FORMA TERRAE', english: 'THE FORM OF EARTH', layouts: ['orbit'], mark: 'celestial' },
  '2:65': { id: 'earth-form', asset: 'cosmosClassic', focus: [50, 50], latin: 'DE ANTIPODIBVS', english: 'EARTH, WATER & ANTIPODES', layouts: ['orbit'], mark: 'celestial' },
  '2:68': { id: 'earth-form', asset: 'cosmosClassic', focus: [50, 50], latin: 'DE TERRARVM ORBE', english: 'THE INHABITED EARTH', layouts: ['orbit'], mark: 'celestial' },
  '2:69': { id: 'earth-form', asset: 'cosmosClassic', focus: [50, 50], latin: 'DE TERRARVM ORBE', english: 'EARTH AT THE CENTRE', layouts: ['orbit'], mark: 'celestial' },
  '2:70': { id: 'earth-form', asset: 'cosmosClassic', focus: [50, 50], latin: 'DE TERRARVM ORBE', english: 'EARTH & THE CELESTIAL ORDER', layouts: ['orbit'], mark: 'celestial' },
  '2:86': { id: 'rising-islands', asset: 'earthPhenomena', focus: [16, 25], latin: 'DE INSVLIS', english: 'ISLANDS RISING FROM THE SEA', layouts: ['map', 'hero'], mark: 'compass' },
  '2:87': { id: 'rising-islands', asset: 'earthPhenomena', focus: [16, 25], latin: 'DE INSVLIS NOVIS', english: 'NEW ISLANDS FORMED', layouts: ['map', 'hero'], mark: 'compass' },
  '2:88': { id: 'rising-islands', asset: 'earthPhenomena', focus: [16, 25], latin: 'DE TERRIS MARI DIVISIS', english: 'LANDS SEVERED BY THE SEA', layouts: ['map', 'hero'], mark: 'compass' },
  '2:89': { id: 'rising-islands', asset: 'earthPhenomena', focus: [16, 25], latin: 'DE INSVLIS CONTINENTI IVNCTIS', english: 'ISLANDS JOINED TO THE MAINLAND', layouts: ['map', 'hero'], mark: 'compass' },
  '2:90': { id: 'rising-islands', asset: 'earthPhenomena', focus: [16, 25], latin: 'DE TERRIS IN MARIA VERSIS', english: 'LANDS CHANGED INTO SEAS', layouts: ['map', 'hero'], mark: 'compass' },
  '2:91': { id: 'rising-islands', asset: 'earthPhenomena', focus: [16, 25], latin: 'DE TERRIS DEVORATIS', english: 'LANDS SWALLOWED UP', layouts: ['map', 'hero'], mark: 'compass' },
  '8:16': { id: 'lions', asset: 'quadrupeds', focus: [16, 18], latin: 'DE LEONIBVS', english: 'LIONS & GREAT CATS', layouts: ['hero'], mark: 'none' },
  '8:51': { id: 'boars', asset: 'quadrupeds', focus: [16, 82], latin: 'DE APRIS', english: 'THE HOG & WILD BOAR', layouts: ['hero'], mark: 'none' },
  '9:58': { id: 'mice', asset: 'rareTerrestrial', focus: [84, 18], latin: 'DE MVRIBVS NILOTICIS', english: 'MICE OF THE NILE', layouts: ['hero'], mark: 'none' },
  '10:9': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '10:31': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '10:53': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '10:55': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '10:58': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '10:59': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '10:60': { id: 'eggs', asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych'], mark: 'measure' },
  '11:38': { id: 'blood-physiology', asset: 'romanMedicine', focus: [16, 24], latin: 'DE SANGVINE', english: 'BLOOD & COAGULATION', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-11-blood' },
  '11:39': { id: 'blood-physiology', asset: 'romanMedicine', focus: [16, 24], latin: 'DE SANGVINE', english: 'BLOOD AS THE PRINCIPLE OF LIFE', layouts: ['ledger'], mark: 'measure', continuityGroup: 'book-11-blood' },
  '11:40': { id: 'mammary-anatomy', asset: 'humanityClassic', focus: [49, 47], latin: 'DE MAMMIS', english: 'MAMMARY ANATOMY', layouts: ['ledger'], mark: 'measure' },
  '11:42': { id: 'milk-and-cheese', asset: 'rareTerrestrial', focus: [38, 50], latin: 'DE CASEO', english: 'MILK & CHEESE', layouts: ['ledger'], mark: 'measure' },
  '11:49': { id: 'sexual-anatomy', asset: 'humanLifeBelief', focus: [16, 18], latin: 'DE PARTIBVS SEXVALIBVS', english: 'SEXUAL ANATOMY', layouts: ['ledger'], mark: 'measure' },
  '11:51': { id: 'animal-voices', asset: 'animalsClassic', focus: [50, 48], latin: 'DE VOCIBVS ANIMALIVM', english: 'THE VOICES OF ANIMALS', layouts: ['ledger'], mark: 'measure' },
  '11:54': { id: 'hunger-and-thirst', asset: 'romanMedicine', focus: [53, 72], latin: 'DE FAME ET SITI', english: 'HUNGER & THIRST', layouts: ['ledger'], mark: 'measure' },
  '18:29': { id: 'agricultural-weather', asset: 'celestialWeather', focus: [50, 48], detailFocuses: [[50, 12], [85, 49]], latin: 'DE CAELI INFLVENTIA', english: 'CELESTIAL INFLUENCES ON HARVESTS', layouts: ['ledger'], mark: 'celestial' },
  '20:19': { id: 'poppies', asset: 'botanyAtlas', focus: [40, 82], latin: 'DE PAPAVERE', english: 'POPPY & ITS USES', layouts: ['hero', 'ledger'], mark: 'measure' },
  '26:4': { id: 'roman-magic', asset: 'humanLifeBelief', focus: [62, 82], detailFocuses: [[38, 50], [16, 82]], latin: 'DE VANITATE MAGIAE', english: 'THE FOLLIES & PRACTICES OF MAGIC', layouts: ['ledger'], mark: 'measure' },
  '35:15': { id: 'mineral-substances', asset: 'mineralFire', focus: [50, 25], latin: 'DE SVLPHVRE', english: 'SULPHUR & MINERAL SUBSTANCES', layouts: ['hero', 'ledger'], mark: 'measure' },
  '35:16': { id: 'mineral-substances', asset: 'mineralFire', focus: [50, 25], latin: 'DE TERRIS', english: 'MINERAL EARTHS', layouts: ['hero', 'ledger'], mark: 'measure' },
  '35:17': { id: 'mineral-substances', asset: 'mineralFire', focus: [50, 25], latin: 'DE TERRIS', english: 'MINERAL EARTHS', layouts: ['hero', 'ledger'], mark: 'measure' },
  '36:16': { id: 'magnet', asset: 'mineralFire', focus: [16, 25], latin: 'DE MAGNETE', english: 'THE MAGNET & IRON', layouts: ['hero'], mark: 'measure' },
  '36:19': { id: 'mineral-substances', asset: 'mineralFire', focus: [50, 25], latin: 'DE LAPIDIBVS', english: 'MINERAL SUBSTANCES', layouts: ['hero', 'ledger'], mark: 'measure' },
  '36:20': { id: 'mineral-substances', asset: 'mineralFire', focus: [50, 25], latin: 'DE LAPIDIBVS', english: 'MINERAL SUBSTANCES', layouts: ['hero', 'ledger'], mark: 'measure' },
  '36:24': { id: 'lime-mortar', asset: 'mineralFire', focus: [84, 25], latin: 'DE CALCE', english: 'LIME, MORTAR & MASONRY', layouts: ['hero', 'ledger'], mark: 'measure' },
  '36:27': { id: 'transformative-fire', asset: 'mineralFire', focus: [50, 75], latin: 'DE IGNE', english: 'TRANSFORMATIVE FIRE & SMELTING', layouts: ['hero', 'ledger'], mark: 'measure' },
};

const SUBJECT_RULES = [
  { id: 'gnomon-timekeeping', families: ['cosmos', 'humanity'], pattern: /\b(?:gnomon|gnomonic|dial|dials|shadow|shadows|time-piece|time-pieces|timepiece|timepieces|day lengths?)\b/, asset: 'skyMeasure', focus: [38, 50], detailFocuses: [[16, 50], [84, 82]], latin: 'DE GNOMONIBVS', english: 'DIALS, SHADOWS & TIMEKEEPING', layouts: ['ledger'], mark: 'measure' },
  { id: 'sky-whirlwinds', families: ['cosmos'], pattern: /\b(?:typhon|typhons|tornado|tornadoes|whirlwind|whirlwinds|ecnephias)\b/, asset: 'skyMeasure', focus: [62, 50], latin: 'DE TYPHONIBVS', english: 'WHIRLWINDS & TEMPESTS', layouts: ['ledger', 'hero'], mark: 'celestial' },
  { id: 'sky-sounds', families: ['cosmos'], pattern: /\b(?:sound|sounds|trumpets?|rattling).{0,36}\bsky\b|\bsky\b.{0,36}\b(?:sound|sounds|trumpets?|rattling)\b/, asset: 'skyMeasure', focus: [38, 82], latin: 'DE SONITV CAELI', english: 'SOUNDS HEARD IN THE SKY', layouts: ['ledger'], mark: 'celestial' },
  { id: 'local-weather', families: ['cosmos'], pattern: /\b(?:weather in different places|peculiarities of the weather|climate zones?|parallels)\b/, asset: 'skyMeasure', focus: [62, 82], latin: 'DE CAELI VARIETATE', english: 'WEATHER & CLIMATE BY PLACE', layouts: ['ledger'], mark: 'celestial' },
  { id: 'human-generation', families: ['humanity'], pattern: /\b(?:generation|conception|heredity|resemblance|offspring|infants?|twins?|life stages?)\b/, asset: 'humanLifeBelief', focus: [16, 18], detailFocuses: [[38, 18], [62, 18]], latin: 'DE GENERATIONE HVMANA', english: 'GENERATION, HEREDITY & LIFE STAGES', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'freedmen-status', families: ['minerals', 'humanity'], pattern: /\b(?:freedman|freedmen|libertinus|social rank|patronage)\b/, asset: 'humanLifeBelief', focus: [62, 50], latin: 'DE LIBERTINIS', english: 'FREEDMEN & SOCIAL RANK', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'roman-magic', families: ['humanity'], books: [30], chapters: ['1', '2'], pattern: /\b(?:magic|magicians|amulet|amulets|druids?|ritual)\b/, asset: 'humanLifeBelief', focus: [62, 82], detailFocuses: [[38, 50], [16, 82]], latin: 'DE MAGIA', english: 'MAGIC, DIVINATION & RITUAL', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'systemic-care', families: ['humanity'], books: [28, 29, 30], pattern: /\b(?:whole body|entire body|general remedies|paralysis|epilepsy|cold shiverings)\b/, asset: 'humanLifeBelief', focus: [84, 82], latin: 'DE TOTIVS CORPORIS REMEDIIS', english: 'WHOLE-BODY REMEDIES & CARE', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'squill-vinegar', families: ['botany'], pattern: /\b(?:squill vinegar|squill|oxymel|oxymeli)\b/, asset: 'aromaticsApothecary', focus: [84, 50], detailFocuses: [[62, 50], [16, 82]], latin: 'DE SCILLA ET ACETO', english: 'SQUILL, VINEGAR & OXYMEL', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'mercurialis', families: ['botany'], pattern: /\b(?:linozostis|parthenion|hermupoa|mercurialis)\b/, asset: 'minorHerbs', focus: [16, 18], latin: 'DE LINOZOSTIDE ET MERCVRIALI', english: 'LINOZOSTIS & MERCURIALIS', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'anagallis', families: ['botany'], pattern: /\b(?:anagallis|corchoron|aegilops)\b/, asset: 'minorHerbs', focus: [38, 18], detailFocuses: [[62, 18], [84, 18]], latin: 'DE ANAGALLIDE', english: 'ANAGALLIS · TWO VARIETIES', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'hellebore', families: ['botany'], pattern: /\b(?:hellebore|melampodium|veratrum)\b/, asset: 'medicinalHerbarium', focus: [16, 50], latin: 'DE HELLEBORO', english: 'HELLEBORE', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'mandrake-hemlock', families: ['botany'], pattern: /\b(?:mandrake|mandragora|hemlock|cicuta)\b/, asset: 'medicinalHerbarium', focus: [38, 50], detailFocuses: [[62, 50], [84, 50]], latin: 'DE MANDRAGORA ET CICVTA', english: 'MANDRAKE & HEMLOCK', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'aconite', families: ['botany'], pattern: /\b(?:aconite|aconitum|thelyphonon|pardalianches)\b/, asset: 'medicinalHerbarium', focus: [84, 50], latin: 'DE ACONITO', english: 'ACONITE', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'medicinal-herbs', families: ['botany'], pattern: /\b(?:plantain|nettle|mallows?|wormwood|artemisia|gentian|centaury|aloes?|dittany|peony)\b/, asset: 'medicinalHerbarium', focus: [50, 50], latin: 'DE HERBIS MEDICIS', english: 'MEDICINAL HERBS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'elephant-sagacity', families: ['terrestrial'], books: [8], chapters: ['12'], pattern: /.+/, asset: 'elephants', focus: [49, 22], latin: 'INGENIVM ELEPHANTORVM', english: 'ELEPHANT INTELLIGENCE', layouts: ['hero'], mark: 'measure' },
  { id: 'elephant-intelligence', families: ['terrestrial'], pattern: /\belephants?\b.*\b(?:capacity|sagacity|intelligence|cleverness)\b|\b(?:capacity|sagacity|intelligence|cleverness)\b.*\belephants?\b/, asset: 'elephants', focus: [49, 22], latin: 'INGENIVM ELEPHANTORVM', english: 'ELEPHANT INTELLIGENCE', layouts: ['hero'], mark: 'measure' },
  { id: 'elephant-harness', families: ['terrestrial'], pattern: /\belephants?.*harness\b/, asset: 'elephants', focus: [20, 22], latin: 'ELEPHANTI IVNGVNTVR', english: 'ELEPHANTS IN HARNESS', layouts: ['ledger'], mark: 'measure' },
  { id: 'elephant-training', families: ['terrestrial'], books: [8], chapters: ['3', '9'], pattern: /.+/, asset: 'elephants', focus: [49, 22], latin: 'ELEPHANTI DISCIPLINAM ACCIPIVNT', english: 'DOCILITY & TRAINING', layouts: ['triptych'], mark: 'measure' },
  { id: 'elephant-combat', families: ['terrestrial'], pattern: /\bcombats? of elephants?\b/, asset: 'elephants', focus: [78, 22], latin: 'CERTAMINA ELEPHANTORVM', english: 'THE COMBATS OF ELEPHANTS', layouts: ['hero'], mark: 'none' },
  { id: 'elephant-capture', families: ['terrestrial'], pattern: /\belephants?.*(?:caught|capture)\b|\b(?:caught|capture).*elephants?\b/, asset: 'elephants', focus: [20, 55], latin: 'CAPTVRA ELEPHANTORVM', english: 'THE CAPTURE OF ELEPHANTS', layouts: ['ledger'], mark: 'measure' },
  { id: 'elephant-birth', families: ['terrestrial'], pattern: /\bbirth of the elephant\b/, asset: 'elephants', focus: [66, 55], latin: 'ORTVS ELEPHANTORVM', english: 'ELEPHANT BIRTH & FAMILY', layouts: ['hero'], mark: 'none' },
  { id: 'elephants', families: ['terrestrial'], pattern: /\b(?:elephant|elephants|tusk|tusks|ivory)\b/, asset: 'elephants', focus: [49, 22], latin: 'DE ELEPHANTIS', english: 'ELEPHANT LIFE & INTELLIGENCE', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'elephant-remedies', families: ['humanity'], books: [28, 29, 30], pattern: /\b(?:elephant|elephants)\b/, asset: 'elephants', focus: [49, 22], latin: 'REMEDIA EX ELEPHANTO', english: 'ELEPHANT-DERIVED REMEDIES', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'dog-remedies', families: ['humanity'], books: [28, 29, 30], pattern: /\b(?:dog|dogs|canine)\b/, asset: 'quadrupeds', focus: [84, 18], latin: 'REMEDIA EX CANIBVS', english: 'DOG-DERIVED REMEDIES', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'small-animal-remedies', families: ['humanity'], books: [28, 29, 30], pattern: /\b(?:mole|moles|mouse|mice)\b/, asset: 'rareTerrestrial', focus: [16, 50], latin: 'REMEDIA EX MINVTIS ANIMALIBVS', english: 'SMALL-ANIMAL REMEDIES', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'water-conveyance', families: ['marine'], books: [31], pattern: /\b(?:conveying water|conveyance of water|aqueduct|aqueducts)\b/, asset: 'romanWorks', focus: [17, 18], latin: 'DE AQVIS DVCENDIS', english: 'AQUEDUCTS & WATERWORKS', layouts: ['map', 'ledger'], mark: 'measure' },
  { id: 'nitrum', families: ['marine'], books: [31], pattern: /\b(?:nitrum|natron)\b/, asset: 'mineralArts', focus: [23, 45], latin: 'DE NITRO', english: 'NITRUM & MINERAL SALTS', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'salt', families: ['marine'], books: [31], pattern: /\b(?:salt|salts|brine)\b/, asset: 'marineClassic', focus: [20, 17], latin: 'DE SALE', english: 'SALT, BRINE & SALT PANS', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'waters', families: ['marine'], books: [31], pattern: /\b(?:water|waters|spring|springs)\b/, asset: 'marineClassic', focus: [20, 17], latin: 'DE AQVIS', english: 'SPRINGS & WATERS', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'sponges', families: ['marine'], pattern: /\b(?:sponge|sponges)\b/, asset: 'marineClassic', focus: [80, 76], latin: 'DE SPONGIIS', english: 'SPONGES & CORAL', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'sea-nettle', families: ['marine'], pattern: /\b(?:sea-nettle|sea nettle|urtica marina|animal and vegetable combined|plant-like marine)\b/, asset: 'marineInvertebrates', focus: [16, 18], detailFocuses: [[38, 18], [84, 18]], latin: 'DE VRTICA MARINA', english: 'SEA-NETTLE & PLANT-LIKE MARINE LIFE', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'whales', families: ['marine'], pattern: /\b(?:largest animals|whale|whales|balaena|orca|orcas|cetacean|cetaceans|dolphin|dolphins|tursio)\b/, asset: 'marineLife', focus: [36, 17], detailFocuses: [[26, 17], [62, 17]], latin: 'DE CETIS', english: 'WHALES & DOLPHINS', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'tortoises', families: ['marine', 'flight', 'terrestrial'], pattern: /\b(?:turtle|turtles|tortoise|tortoises)\b/, asset: 'animalsClassic', focus: [29, 81], latin: 'DE TESTVDINIBVS', english: 'TURTLES & TORTOISES', layouts: ['hero', 'triptych'], mark: 'measure' },
  { id: 'crustaceans', families: ['marine'], pattern: /\b(?:crab|crabs|pinnotheres|urchin|urchins|cockle|cockles)\b/, asset: 'lacunaAtlas', focus: [25, 25], detailFocuses: [[20, 25], [30, 25]], latin: 'DE CRVSTACEIS', english: 'CRABS, URCHINS & COCKLES', layouts: ['triptych', 'ledger'], mark: 'none' },
  { id: 'molluscs', families: ['marine'], pattern: /\b(?:octopus|octopuses|polyp|polyps|polypi|cuttlefish|squid|mollusc|molluscs|sepia|loligo|scallop|scallops)\b/, asset: 'marineLife', focus: [29, 44], latin: 'DE POLYPIS', english: 'OCTOPUS & CUTTLEFISH', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'purple-dyes', families: ['marine'], pattern: /\b(?:purple|purples|crimson|tyrian|hysginians?|dye|dyed|tints?)\b/, asset: 'marineClassic', focus: [19, 82], latin: 'DE PVRPVRIS', english: 'PURPLE DYES & MUREX', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'shells', families: ['marine'], pattern: /\b(?:shell|shells|shellfish|murex|oyster|oysters|pearl|pearls|snail|snails|pinna|conch|conchs)\b/, asset: 'marineLife', focus: [19, 64], latin: 'DE CONCHIS', english: 'SHELLS & PEARLS', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'crocodiles', families: ['marine', 'terrestrial'], pattern: /\b(?:crocodile|crocodiles)\b/, asset: 'marineLife', focus: [18, 84], latin: 'DE CROCODILIS', english: 'CROCODILES', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'hippopotamus', families: ['marine', 'terrestrial'], pattern: /\b(?:hippopotamus|hippopotami)\b/, asset: 'marineLife', focus: [57, 84], latin: 'DE HIPPOPOTAMIS', english: 'HIPPOPOTAMI', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'seals', families: ['marine'], pattern: /\b(?:seal|seals|sea calves|phocae)\b/, asset: 'marineLife', focus: [84, 84], latin: 'DE PHOCIS', english: 'SEALS & SEA-CALVES', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'fish', families: ['marine', 'flight'], pattern: /\b(?:fish|fishes|tunny|tunnies|mullet|mullets|eel|eels|muraena|muraenae|echeneis|remora|shark|sharks|ray|rays|anthias|dog-fish|sea-star|sea-stars)\b/, asset: 'marineLife', focus: [67, 48], latin: 'DE PISCIBVS', english: 'FISHES OF THE SEA', layouts: ['triptych', 'ledger'], mark: 'none' },
  { id: 'lions', families: ['terrestrial'], pattern: /\b(?:lion|panther|leopard|tiger|cat)\b/, asset: 'quadrupeds', focus: [16, 18], latin: 'DE LEONIBVS', english: 'LIONS & GREAT CATS', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'bears', families: ['terrestrial'], pattern: /\b(?:bear|bears)\b/, asset: 'quadrupeds', focus: [38, 18], latin: 'DE VRSIS', english: 'BEARS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'hyenas', families: ['terrestrial'], pattern: /\b(?:hyena|hyenas|hyaena|hyaenas|crocotta)\b/, asset: 'quadrupeds', focus: [84, 82], latin: 'DE HYAENIS', english: 'HYENAS & CROCOTTA', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'wolves', families: ['terrestrial'], pattern: /\b(?:wolf|wolves|dog|dogs)\b/, asset: 'quadrupeds', focus: [73, 18], detailFocuses: [[62, 18], [84, 18]], latin: 'DE LVPIS ET CANIBVS', english: 'WOLVES & DOGS', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'horses', families: ['terrestrial'], pattern: /\b(?:horse|horses|ass|asses|mule|mules)\b/, asset: 'quadrupeds', focus: [16, 50], latin: 'DE EQVIS', english: 'HORSES & DRAUGHT ANIMALS', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'bison', families: ['terrestrial'], pattern: /\b(?:bison|bisons)\b/, asset: 'rareTerrestrial', focus: [62, 50], latin: 'DE BISONTIBVS', english: 'THE BISON', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'cattle', families: ['terrestrial', 'humanity'], pattern: /\b(?:cattle|ox|oxen|bull|bulls|cow|cows|calf|calves|apis)\b/, asset: 'quadrupeds', focus: [38, 50], latin: 'DE BOVIBVS', english: 'CATTLE', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'sheep', families: ['terrestrial', 'humanity'], pattern: /\b(?:sheep|wool|wools|wool-grease|musmon)\b/, asset: 'rareTerrestrial', focus: [38, 50], latin: 'DE OVIBVS', english: 'SHEEP & WOOL', layouts: ['triptych', 'ledger'], mark: 'none' },
  { id: 'goats', families: ['terrestrial', 'humanity'], pattern: /\b(?:goat|goats|he-goat|ibex|ibexes)\b/, asset: 'rareTerrestrial', focus: [62, 82], latin: 'DE CAPRIS', english: 'GOATS & IBEX', layouts: ['triptych', 'ledger'], mark: 'none' },
  { id: 'deer', families: ['terrestrial'], pattern: /\b(?:deer|stag|stags|hart|harts|tarandus)\b/, asset: 'quadrupeds', focus: [62, 50], latin: 'DE CERVIS', english: 'DEER & STAGS', layouts: ['triptych', 'ledger'], mark: 'none' },
  { id: 'boars', families: ['terrestrial'], pattern: /\b(?:boar|swine|pig)\b/, asset: 'quadrupeds', focus: [16, 82], latin: 'DE APRIS', english: 'WILD BOAR', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'camels', families: ['terrestrial'], pattern: /\b(?:camel|camels|dromedary|dromedaries)\b/, asset: 'quadrupeds', focus: [38, 82], latin: 'DE CAMELIS', english: 'CAMELS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'rhinoceros', families: ['terrestrial'], pattern: /\brhinoceros(?:es)?\b/, asset: 'quadrupeds', focus: [62, 82], latin: 'DE RHINOCEROTE', english: 'THE RHINOCEROS', layouts: ['hero'], mark: 'measure' },
  { id: 'hares', families: ['terrestrial'], pattern: /\b(?:hare|hares|rabbit|rabbits)\b/, asset: 'rareTerrestrial', focus: [38, 82], latin: 'DE LEPORIBVS', english: 'HARES & RABBITS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'porcupines', families: ['terrestrial'], pattern: /\b(?:porcupine|porcupines)\b/, asset: 'rareTerrestrial', focus: [62, 18], latin: 'DE HISTRICIBVS', english: 'PORCUPINES', layouts: ['ledger', 'hero'], mark: 'none' },
  { id: 'mice', families: ['terrestrial'], pattern: /\b(?:mouse|mice)\b/, asset: 'rareTerrestrial', focus: [84, 18], latin: 'DE MVRIBVS', english: 'MICE', layouts: ['ledger', 'hero'], mark: 'none' },
  { id: 'moles', families: ['terrestrial'], pattern: /\b(?:mole|moles)\b/, asset: 'rareTerrestrial', focus: [16, 50], latin: 'DE TALPIS', english: 'MOLES', layouts: ['ledger', 'hero'], mark: 'none' },
  { id: 'mongooses', families: ['terrestrial'], pattern: /\b(?:ichneumon|mongoose|mongooses)\b/, asset: 'rareTerrestrial', focus: [84, 50], latin: 'DE ICHNEVMONIBVS', english: 'ICHNEUMONS & MONGOOSES', layouts: ['ledger', 'hero'], mark: 'none' },
  { id: 'apes', families: ['terrestrial'], pattern: /\b(?:ape|apes|monkey|monkeys|cepus|sphinx)\b/, asset: 'rareTerrestrial', focus: [38, 18], latin: 'DE SIMIIS', english: 'APES & EXOTIC ANIMALS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'amphibians', families: ['terrestrial', 'flight'], pattern: /\b(?:frog|frogs|bramble-frog|bramble-frogs|amphibian|amphibians)\b/, asset: 'rareTerrestrial', focus: [16, 82], latin: 'DE AMPHIBIIS', english: 'FROGS & AMPHIBIANS', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'chameleons', families: ['terrestrial', 'flight'], pattern: /\b(?:chameleon|chameleons)\b/, asset: 'rareTerrestrial', focus: [84, 82], latin: 'DE CHAMAELEONIBVS', english: 'CHAMELEONS', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'reptiles', families: ['terrestrial', 'flight'], pattern: /\b(?:serpent|serpents|snake|snakes|viper|vipers|asp|asps|lizard|lizards|dragon|dragons|salamander|salamanders|stellio)\b/, asset: 'wingedLife', focus: [52, 82], latin: 'DE SERPENTIBVS', english: 'SERPENTS & REPTILES', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'exotic-quadrupeds', families: ['terrestrial'], pattern: /\b(?:chama|lynx|lynxes|lycaon|thos|leontophonus)\b/, asset: 'rareTerrestrial', focus: [16, 18], latin: 'DE FERIS EXOTICIS', english: 'EXOTIC QUADRUPEDS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'phoenix', families: ['flight'], pattern: /\b(?:phoenix|phoenicis)\b/, asset: 'flightClassic', focus: [60, 49], latin: 'DE PHOENICE', english: 'THE PHOENIX', layouts: ['hero'], mark: 'celestial' },
  { id: 'peacocks', families: ['flight'], pattern: /\b(?:peacock|peacocks)\b/, asset: 'birdsDomestic', focus: [84, 82], latin: 'DE PAVONIBVS', english: 'PEACOCKS', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'kites', families: ['flight'], pattern: /\b(?:kite|kites)\b/, asset: 'birdsDomestic', focus: [16, 50], latin: 'DE MILVIS', english: 'KITES', layouts: ['hero', 'triptych'], mark: 'measure' },
  { id: 'eagles', families: ['flight'], pattern: /\b(?:eagle|eagles|hawk|hawks|vulture|vultures|buteo)\b/, asset: 'wingedLife', focus: [26, 20], latin: 'DE AQVILIS', english: 'EAGLES & BIRDS OF PREY', layouts: ['hero', 'triptych'], mark: 'measure' },
  { id: 'owls', families: ['flight'], pattern: /\b(?:owl|owls|owlet|owlets|night bird|night birds)\b/, asset: 'wingedLife', focus: [56, 19], latin: 'DE NOCTVRNIS AVIBVS', english: 'OWLS & NIGHT BIRDS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'ravens', families: ['flight'], pattern: /\b(?:raven|ravens|crow|crows)\b/, asset: 'wingedLife', focus: [84, 19], latin: 'DE CORVIS', english: 'RAVENS & CROWS', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'swallows', families: ['flight'], pattern: /\b(?:swallow|swallows|swift|swifts|apodes|cypseli)\b/, asset: 'wingedLife', focus: [19, 52], latin: 'DE HIRVNDINIBVS', english: 'SWALLOWS & FLIGHT', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'bees', families: ['flight', 'botany'], pattern: /\b(?:bee|bees|beehive|beehives|honey|wax)\b/, asset: 'wingedLife', focus: [38, 51], latin: 'DE APIBVS', english: 'BEES, HONEY & WAX', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'cranes', families: ['flight'], pattern: /\b(?:crane|cranes|stork|storks|heron|herons|ibis|ibises)\b/, asset: 'wingedLife', focus: [62, 52], latin: 'DE GRVIBVS', english: 'CRANES & WATER BIRDS', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'ostriches', families: ['flight'], pattern: /\b(?:ostrich|ostriches)\b/, asset: 'wingedLife', focus: [83, 51], latin: 'DE STRVTHIONIBVS', english: 'THE OSTRICH', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'pigeons', families: ['flight'], books: [10], chapters: ['34', '35', '36', '37'], pattern: /.+/, asset: 'birdsDomestic', focus: [38, 18], latin: 'DE COLVMBIS', english: 'PIGEONS', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'parrots', families: ['flight'], pattern: /\b(?:parrot|parrots)\b/, asset: 'birdsDomestic', focus: [16, 18], latin: 'DE PSITTACIS', english: 'PARROTS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'geese', families: ['flight'], pattern: /\b(?:goose|geese)\b/, asset: 'birdsDomestic', focus: [62, 18], latin: 'DE ANSERIBVS', english: 'GEESE', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'roosters', families: ['flight'], pattern: /\b(?:cock|cocks|rooster|roosters)\b/, asset: 'birdsDomestic', focus: [84, 18], latin: 'DE GALLIS', english: 'ROOSTERS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'domestic-birds', families: ['flight'], pattern: /\b(?:hen|hens|poultry|fowl|fowls|brood-hens)\b/, asset: 'birdsDomestic', focus: [84, 18], latin: 'DE AVIBVS DOMESTICIS', english: 'DOMESTIC BIRDS', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'eggs', families: ['flight'], pattern: /\b(?:egg|eggs|incubation)\b/, asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'DE OVIS', english: 'EGGS & INCUBATION', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'named-birds', families: ['flight'], pattern: /\b(?:wood-pecker|woodpecker|blackbird|blackbirds|halcyon|halcyones|hoopoe|hoopoes|memnonides|seleucides|porphyrio|phoenicopterus|vipio)\b/, asset: 'wingedLife', focus: [62, 52], detailFocuses: [[26, 20], [84, 19]], latin: 'DE AVIBVS VARIIS', english: 'BIRDS OF MANY KINDS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'general-birds', families: ['flight'], books: [10], chapterMax: 60, pattern: /\b(?:bird|birds|flight|winged)\b/, asset: 'wingedLife', focus: [62, 52], detailFocuses: [[26, 20], [84, 19]], latin: 'DE AVIBVS', english: 'BIRDS & FLIGHT', layouts: ['hero', 'ledger', 'triptych'], mark: 'none' },
  { id: 'bats', families: ['flight'], books: [10], chapters: ['61'], pattern: /.+/, asset: 'birdsDomestic', focus: [38, 50], latin: 'DE VESPERTILIONE', english: 'THE BAT', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'scorpions', families: ['flight'], pattern: /\b(?:scorpion|scorpions)\b/, asset: 'birdsDomestic', focus: [84, 50], latin: 'DE SCORPIONIBVS', english: 'SCORPIONS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'spiders', families: ['flight'], pattern: /\b(?:spider|spiders|web|webs)\b/, asset: 'flightClassic', focus: [69, 86], latin: 'DE ARANEIS', english: 'SPIDERS & WEBS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'ants', families: ['flight'], pattern: /\b(?:ant|ants)\b/, asset: 'lacunaAtlas', focus: [75, 25], detailFocuses: [[70, 25], [80, 25]], latin: 'DE FORMICIS', english: 'ANTS & THEIR COLONIES', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'silkworms', families: ['flight'], pattern: /\b(?:bombyx|silk-worm|silk-worms|silkworm|silkworms)\b/, asset: 'birdsDomestic', focus: [62, 50], latin: 'DE BOMBYCIBVS', english: 'SILKWORMS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'grasshoppers', families: ['flight'], pattern: /\b(?:grasshopper|grasshoppers)\b/, asset: 'birdsDomestic', focus: [16, 82], latin: 'DE LOCVSTIS MINORIBVS', english: 'GRASSHOPPERS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'locusts', families: ['flight'], pattern: /\b(?:locust|locusts)\b/, asset: 'birdsDomestic', focus: [38, 82], latin: 'DE LOCVSTIS', english: 'LOCUSTS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'wasps', families: ['flight'], pattern: /\b(?:wasp|wasps|hornet|hornets)\b/, asset: 'birdsDomestic', focus: [62, 82], latin: 'DE VESPIS ET CRABRONIBVS', english: 'WASPS & HORNETS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'insects', families: ['flight'], pattern: /\b(?:insect|insects|beetle|beetles|scarab|scarabs|moth|moths|butterfly|butterflies|chrysalis|gnat|gnats|cantharides)\b/, asset: 'wingedLife', focus: [29, 83], latin: 'DE INSECTIS', english: 'INSECTS & SMALL CREATURES', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'animal-anatomy', families: ['flight'], books: [11], chapterMin: 37, pattern: /.+/, asset: 'humanityClassic', focus: [49, 47], latin: 'DE CORPORIBVS ANIMALIVM', english: 'COMPARATIVE ANATOMY', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'general-animal-life', families: ['flight'], books: [10], chapterMin: 63, pattern: /.+/, asset: 'animalsClassic', focus: [50, 48], latin: 'DE NATVRA ANIMALIVM', english: 'THE LIFE OF ANIMALS', layouts: ['hero', 'ledger'], mark: 'none' },
  { id: 'eclipses', families: ['cosmos'], pattern: /\beclipse\w*\b/, asset: 'celestialWeather', focus: [14, 30], latin: 'DE DEFECTIBVS', english: 'ECLIPSES', layouts: ['orbit', 'hero'], mark: 'celestial' },
  { id: 'sun', families: ['cosmos', 'botany'], pattern: /\b(?:sun|suns|solar)\b/, asset: 'celestialWeather', focus: [14, 12], latin: 'DE SOLE', english: 'THE SUN', layouts: ['orbit', 'hero'], mark: 'celestial' },
  { id: 'moon', families: ['cosmos', 'botany'], pattern: /\b(?:moon|moons|lunar)\b/, asset: 'celestialWeather', focus: [50, 12], detailFocuses: [[38, 12], [61, 12]], latin: 'DE LVNA', english: 'THE MOON & HER PHASES', layouts: ['orbit', 'ledger'], mark: 'celestial' },
  { id: 'comets', families: ['cosmos'], pattern: /\b(?:comet|meteor|falling star)\w*\b/, asset: 'celestialWeather', focus: [85, 12], latin: 'DE COMETIS', english: 'COMETS & FIERY SIGNS', layouts: ['orbit', 'hero'], mark: 'celestial' },
  { id: 'stars', families: ['cosmos'], pattern: /\b(?:star|constellation|planet|heaven|sphere|orbit)\w*\b/, asset: 'celestialWeather', focus: [50, 48], latin: 'DE SIDERIBVS', english: 'STARS & CELESTIAL ORDER', layouts: ['orbit', 'ledger'], mark: 'celestial' },
  { id: 'rainbows', families: ['cosmos'], pattern: /\brainbow\w*\b/, asset: 'celestialWeather', focus: [14, 58], latin: 'DE ARCV CAELESTI', english: 'THE RAINBOW', layouts: ['hero', 'orbit'], mark: 'celestial' },
  { id: 'winds', families: ['cosmos', 'botany'], pattern: /\b(?:wind|winds|air|cloud|clouds)\b/, asset: 'celestialWeather', focus: [85, 49], latin: 'DE VENTIS', english: 'WINDS & CLOUDS', layouts: ['ledger', 'orbit'], mark: 'celestial' },
  { id: 'storms', families: ['cosmos'], pattern: /\b(?:thunder|lightning|storm|rain|hail|shower)\w*\b/, asset: 'earthPhenomena', focus: [84, 75], latin: 'DE TEMPESTATIBVS', english: 'STORMS & LIGHTNING', layouts: ['hero', 'ledger'], mark: 'celestial' },
  { id: 'tides', families: ['cosmos'], pattern: /\b(?:tide|tides|ocean|oceans|sea|seas)\b/, asset: 'celestialWeather', focus: [14, 84], latin: 'DE AESTV MARIS', english: 'TIDES & OCEAN', layouts: ['ledger', 'hero'], mark: 'celestial' },
  { id: 'volcanoes', families: ['cosmos'], pattern: /\b(?:volcan|vesuvi|eruption|fire)\w*\b/, asset: 'earthPhenomena', focus: [84, 25], latin: 'DE IGNIBVS TERRAE', english: 'VOLCANOES & EARTHLY FIRE', layouts: ['hero', 'ledger'], mark: 'celestial' },
  { id: 'earthquakes', families: ['cosmos'], pattern: /\b(?:earthquake|tremor|fissure|chasm|cleft|shak)\w*\b/, asset: 'earthPhenomena', focus: [84, 25], latin: 'DE MOTIBVS TERRAE', english: 'EARTHQUAKES', layouts: ['hero', 'ledger'], mark: 'celestial' },
  { id: 'aqueducts', families: ['geography'], pattern: /\b(?:aqueduct|waterwork)\w*\b/, asset: 'romanWorks', focus: [17, 18], latin: 'DE AQVIS DVCENDIS', english: 'AQUEDUCTS & WATERWORKS', layouts: ['map', 'ledger'], mark: 'measure' },
  { id: 'bridges', families: ['geography'], pattern: /\b(?:bridge|crossing)\w*\b/, asset: 'romanWorks', focus: [17, 47], latin: 'DE PONTIBVS', english: 'BRIDGES & RIVER CROSSINGS', layouts: ['map', 'hero'], mark: 'measure' },
  { id: 'roads', families: ['geography'], pattern: /\b(?:road|route|journey|distance|measure)\w*\b/, asset: 'romanWorks', focus: [17, 78], latin: 'DE VIIS', english: 'ROADS & MEASURED DISTANCES', layouts: ['map', 'ledger'], mark: 'measure' },
  { id: 'cities', families: ['geography'], pattern: /\b(?:city|cities|town|towns|harbour|harbours|harbor|harbors|port|ports|colony|colonies)\b/, asset: 'earthPhenomena', focus: [50, 75], latin: 'DE VRBIBVS ET PORTVBVS', english: 'CITIES, ROADS & HARBOURS', layouts: ['map', 'hero'], mark: 'compass' },
  { id: 'coasts', families: ['geography'], pattern: /\b(?:sea|seas|coast|coasts|shore|shores|island|islands|strait|straits|gulf|gulfs|bay|bays)\b/, asset: 'earthPhenomena', focus: [16, 25], latin: 'DE MARIBVS ET LITORIBVS', english: 'SEAS, COASTS & ISLANDS', layouts: ['map', 'hero'], mark: 'compass' },
  { id: 'rivers', families: ['geography'], pattern: /\b(?:river|spring|lake|mountain|promontory)\w*\b/, asset: 'earthPhenomena', focus: [50, 25], latin: 'DE FLVMINIBVS ET MONTIBVS', english: 'RIVERS & MOUNTAINS', layouts: ['map', 'ledger'], mark: 'compass' },
  { id: 'peoples', families: ['geography'], pattern: /\b(?:people|peoples|nation|tribe|inhabitant|custom)\w*\b/, asset: 'earthPhenomena', focus: [16, 75], latin: 'DE GENTIBVS', english: 'LANDS & PEOPLES', layouts: ['map', 'hero'], mark: 'compass' },
  { id: 'human-arts', families: ['humanity'], books: [7], pattern: /\b(?:art|arts|artist|artists|painting|paintings|engraving|carving|bronze|marble|ivory)\b/, asset: 'mineralArts', focus: [47, 72], latin: 'DE ARTIBVS HVMANIS', english: 'HUMAN ARTS & INVENTION', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'human-achievement', families: ['humanity'], books: [7], pattern: /\b(?:memory|mind|wisdom|courage|genius|happiness|fortune|honours|honors|affection|strength|endurance|life|death|burial|spirits|inventors|letters)\b/, asset: 'humanityClassic', focus: [50, 47], latin: 'DE VITA HVMANA', english: 'HUMAN LIFE & ACHIEVEMENT', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'anatomy', families: ['humanity'], pattern: /\b(?:body|anatomy|anatomical|bone|bones|skeleton|limb|limbs|proportion|proportions)\b/, asset: 'romanMedicine', focus: [27, 23], latin: 'DE CORPORE HVMANO', english: 'THE HUMAN BODY', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'senses', families: ['humanity'], pattern: /\b(?:eye|sight|vision|hand|touch|finger|hear|hearing|ear)\w*\b/, asset: 'romanMedicine', focus: [67, 24], detailFocuses: [[59, 21], [76, 25]], latin: 'DE SENSIBVS', english: 'SIGHT, HEARING, TOUCH & THE SENSES', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'birth', families: ['humanity'], pattern: /\b(?:birth|woman|women|mother|child|infant|pregnan|midwi|womb|caesarean|cesarean)\w*\b/, asset: 'romanMedicine', focus: [88, 25], latin: 'DE PARTV ET INFANTIBVS', english: 'BIRTH & MATERNAL CARE', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'surgery', families: ['humanity'], pattern: /\b(?:surger|instrument|wound|physician|doctor)\w*\b/, asset: 'romanMedicine', focus: [18, 70], latin: 'DE MEDICINA', english: 'MEDICINE & SURGERY', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'animal-derived-remedies', families: ['humanity'], pattern: /\b(?:egg|eggs)\b/, asset: 'lacunaAtlas', focus: [25, 75], detailFocuses: [[20, 75], [30, 75]], latin: 'REMEDIA EX OVIS', english: 'EGGS & ANIMAL-DERIVED REMEDIES', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'remedies', families: ['humanity'], pattern: /\b(?:remedy|remedies|medicine|medicines|disease|diseases|pain|pains|painful|poison|poisons|antidote|antidotes|fever|fevers|healing)\b/, asset: 'romanMedicine', focus: [53, 72], latin: 'DE REMEDIIS', english: 'REMEDIES & ANTIDOTES', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'medical-symptoms', families: ['botany'], books: [25, 26, 27], pattern: /\b(?:colic|scrofula|disease|diseases|stomach|belly|sprain|sprains|ulcer|ulcers|wound|wounds|gout|fever|fevers|eye|eyes|female)\b/, asset: 'romanMedicine', focus: [53, 72], latin: 'DE MORBIS ET CVRATIONE', english: 'DISEASE & TREATMENT', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'grafting', families: ['botany'], pattern: /\b(?:graft|prun|propagat|cutting)\w*\b/, asset: 'trees', focus: [61, 84], latin: 'DE INSITIONE', english: 'GRAFTING & CULTIVATION', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'vines', families: ['botany'], pattern: /\b(?:vine|vines|grape|grapes|wine|wines|vintage)\b/, asset: 'trees', focus: [17, 56], latin: 'DE VITIBVS', english: 'VINES & WINE', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'olives', families: ['botany'], pattern: /\b(?:olive|olives|olive-oil)\b/, asset: 'trees', focus: [70, 23], latin: 'DE OLEIS', english: 'OLIVES & OIL', layouts: ['hero', 'triptych'], mark: 'none' },
  { id: 'fruit', families: ['botany'], pattern: /\b(?:fig|figs|citron|citrons|citrus|date|dates|apple|apples|pear|pears|plum|plums|fruit|fruits|orchard|orchards|myrobalanum)\b/, asset: 'trees', focus: [61, 55], latin: 'DE POMIS', english: 'FRUIT TREES & ORCHARDS', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'aromatics-resins', families: ['botany'], pattern: /\b(?:myrrh|frankincense|incense|aromatic|aromatics|resin|resins|gum|gums|pitch|bark)\b/, asset: 'trees', focus: [30, 28], latin: 'DE RESINIS ET ODORIBVS', english: 'AROMATICS, RESINS & BARK', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'papyrus', families: ['botany'], pattern: /\b(?:papyrus|paper|papers)\b/, asset: 'lacunaAtlas', focus: [75, 75], detailFocuses: [[70, 75], [80, 75]], latin: 'DE PAPYRO', english: 'PAPYRUS, SCROLLS & PAPER', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'trees', families: ['botany'], pattern: /\b(?:tree|forest|wood|timber|cedar|pine|oak|cypress|resin|gum|bark)\w*\b/, asset: 'trees', focus: [43, 22], latin: 'DE ARBORIBVS', english: 'TREES & FORESTS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'grain', families: ['botany'], pattern: /\b(?:wheat|barley|grain|grains|corn|cereal|cereals|harvest|agriculture|agricultural|flour|oat|oats)\b/, asset: 'cropsHerbs', focus: [16, 22], latin: 'DE FRVMENTIS', english: 'GRAIN & HARVEST', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'field-work', families: ['botany'], pattern: /\b(?:soil|soils|farm|farm-house|plough|ploughing|harrow|harrowing|sowing|seed|seeds|cultivation|land|lands|hay|hay-making|meadow|meadows|mow|mowing)\b/, asset: 'cropsHerbs', focus: [55, 80], latin: 'DE AGRORVM CVLTV', english: 'FIELDS, MEADOWS & CULTIVATION', layouts: ['ledger', 'hero'], mark: 'measure' },
  { id: 'garden-crops', families: ['botany'], pattern: /\b(?:cucumber|cucumbers|gourd|gourds|turnip|turnips|cabbage|cabbages|lettuce|lettuces|mustard|poppy|poppies|bean|beans|lupine|vetch|legume|legumes|flax|rape)\b/, asset: 'cropsHerbs', focus: [65, 22], latin: 'DE HORTENSIBVS', english: 'GARDEN CROPS & LEGUMES', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'flowers', families: ['botany'], pattern: /\b(?:flower|rose|violet|garland|chaplet|wreath)\w*\b/, asset: 'cropsHerbs', focus: [30, 52], latin: 'DE FLORIBVS', english: 'FLOWERS & GARLANDS', layouts: ['triptych', 'hero'], mark: 'none' },
  { id: 'roots', families: ['botany'], pattern: /\b(?:root|bulb|onion|garlic)\w*\b/, asset: 'cropsHerbs', focus: [16, 82], latin: 'DE RADICIBVS', english: 'ROOTS & BULBS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'herbs', families: ['botany'], pattern: /\b(?:herb|herbs|plant|plants|drug|drugs|materia medica)\b/, asset: 'cropsHerbs', focus: [69, 52], latin: 'DE HERBIS ET REMEDIIS', english: 'HERBS & PLANT REMEDIES', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'magnet', families: ['minerals'], pattern: /\b(?:magnet|lodestone|magnetic)\w*\b/, asset: 'mineralFire', focus: [16, 25], latin: 'DE MAGNETE', english: 'THE MAGNET & IRON', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'mineral-substances', families: ['minerals'], pattern: /\b(?:sulphur|sulfur|haematite|hematite|amiantus|asbestos|schist|mineral earth|mineral substance|earth of)\w*\b/, asset: 'mineralFire', focus: [50, 25], latin: 'DE TERRIS ET LAPIDIBVS', english: 'MINERAL SUBSTANCES', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'lime-mortar', families: ['minerals'], pattern: /\b(?:lime|mortar|cement|calcination)\w*\b/, asset: 'mineralFire', focus: [84, 25], latin: 'DE CALCE', english: 'LIME, MORTAR & MASONRY', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'glassmaking', families: ['minerals'], pattern: /\b(?:glass|glassmaking|glass-maker|glass-makers)\b/, asset: 'mineralFire', focus: [16, 75], latin: 'DE VITRO', english: 'GLASS & THE FURNACE', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'pigments', families: ['minerals'], pattern: /\b(?:pigment|pigments|colour|colours|color|colors|paint|painting|paintings|painter|painters|portrait|portraits|pictorial|cinnabar|cinnabaris|minium|verdigris|caeruleum)\b/, asset: 'mineralFire', focus: [84, 75], latin: 'DE COLORIBVS', english: 'PIGMENTS & PAINTING', layouts: ['ledger', 'triptych'], mark: 'measure' },
  { id: 'gems', families: ['minerals'], pattern: /\b(?:gem|gems|crystal|crystals|precious|amber|pearl|pearls|diamond|diamonds|emerald|emeralds|sapphire|sapphires|adamas|smaragdus|opal|opals|carbunculus|topazos|cyanos|amethyst|amethystos|balanites|batrachitis|botryitis|brontea)\b/, asset: 'mineralArts', focus: [20, 70], latin: 'DE GEMMIS', english: 'GEMS & CRYSTALS', layouts: ['triptych', 'ledger'], mark: 'measure' },
  { id: 'architecture', families: ['minerals'], pattern: /\b(?:architecture|building|buildings|marble|marbles|stone|stones|column|columns|obelisk|obelisks|pyramid|pyramids|labyrinth|labyrinths|temple|temples|pavement|pavements|mosaic|mosaics|glass|walls|wall|sarcophagus|cistern|cisterns)\b/, asset: 'mineralArts', focus: [87, 76], latin: 'DE AEDIFICIIS ET LAPIDIBVS', english: 'STONE, ARCHITECTURE & MOSAIC', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'sculpture', families: ['minerals'], pattern: /\b(?:sculpture|sculptures|sculptor|sculptors|statue|statues|artist|artists|art|arts|modelling|modeling)\b/, asset: 'mineralArts', focus: [68, 76], latin: 'DE ARTIBVS', english: 'SCULPTURE & ANCIENT ART', layouts: ['hero', 'ledger'], mark: 'measure' },
  { id: 'mining', families: ['minerals'], pattern: /\b(?:mine|mines|mining|ore|ores|gold|silver|copper|iron|lead|tin|metal|metals|metallic|metallurgy|smelting)\b/, asset: 'mineralFire', focus: [50, 75], latin: 'DE METALLIS', english: 'MINES, ORES & METALS', layouts: ['ledger', 'hero'], mark: 'measure' },
];

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function familyForBook(bookNumber) {
  if (bookNumber === 1) return 'dedication';
  if (bookNumber === 2) return 'cosmos';
  if (bookNumber <= 6) return 'geography';
  if (bookNumber === 7 || (bookNumber >= 28 && bookNumber <= 30)) return 'humanity';
  if (bookNumber === 8) return 'terrestrial';
  if (bookNumber === 9 || bookNumber === 31 || bookNumber === 32) return 'marine';
  if (bookNumber === 10 || bookNumber === 11) return 'flight';
  if (bookNumber >= 12 && bookNumber <= 27) return 'botany';
  return 'minerals';
}

function chapterNumber(chapterId) {
  const match = String(chapterId).match(/^\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.NaN;
}

const CAMPAIGN_DETAIL_CELLS = Object.freeze(Object.fromEntries(
  Object.keys(SIX_CELL_FOCI).map((mainCell) => {
    const mainPoint = SIX_CELL_FOCI[mainCell];
    const candidates = Object.keys(SIX_CELL_FOCI)
      .filter((cell) => cell !== mainCell)
      .filter((cell) => focusDistance(mainPoint, SIX_CELL_FOCI[cell]) >= PANEL_MIN_FOCUS_DISTANCE);
    const orderedPairs = candidates.flatMap((left) => candidates
      .filter((right) => right !== left
        && focusDistance(SIX_CELL_FOCI[left], SIX_CELL_FOCI[right]) >= PANEL_MIN_FOCUS_DISTANCE)
      .map((right) => Object.freeze([left, right])));
    return [mainCell, Object.freeze(orderedPairs)];
  }),
));

const CAMPAIGN_COPY = Object.freeze({
  comparativeAnatomy: ['COMPARATIVE ANIMAL ANATOMY', 'DE CORPORIBVS ANIMALIVM'],
  aquaticMateria: ['AQUATIC MATERIA MEDICA', 'REMEDIA EX AQVATILIBVS'],
  romanAgriculture: ['ROMAN AGRICULTURE & GARDENS', 'AGRICVLTVRA ET HORTI'],
  fishForms: ['FORMS & BEHAVIOUR OF FISH', 'FORMAE ET MORES PISCIVM'],
  avianReproduction: ['NESTS, EGGS & REPRODUCTION', 'NIDI OVA GENERATIO'],
  treeCraft: ['TREES, REEDS, GRAIN & CRAFT', 'ARBORES HARVNDINES FRVGES'],
  wildRemedies: ['WILD PLANTS & REMEDIES', 'HERBAE SILVESTRES ET REMEDIA'],
  romanMetalsArts: ['METALS, ARTS, STONES & GEMS', 'METALLA ARTES LAPIDES GEMMAE'],
  cosmosMechanics: ['THE MECHANICS OF THE HEAVENS', 'CAELI RATIONES'],
  earthOcean: ['EARTH, OCEAN & CHANGE', 'TERRA OCEANVS MVTATIO'],
  westernRegions: ['THE WESTERN ROMAN WORLD', 'OCCIDENTIS TERRAE'],
  easternRegions: ['AFRICA, ASIA & THE EAST', 'AFRICA ASIA ORIENS'],
  humanCapacities: ['HUMAN LIFE & CAPACITIES', 'VITA ET INGENIA HVMANA'],
  cultivatedMateria: ['GARDENS & MATERIA MEDICA', 'HORTI ET MEDICAMENTA'],
  insectSocieties: ['INSECT SOCIETIES & LIFE CYCLES', 'INSECTORVM VITAE'],
  treeSpecies: ['TREES, ORCHARDS & ARBORICULTURE', 'ARBORES POMARIA CVLTVS'],
});

const CAMPAIGN_CELL_LABELS = Object.freeze({
  comparativeAnatomy: { A1: 'SKULLS, TEETH & HORNS', A2: 'BIRD FEET & BEAKS', A3: 'LEGS & HOOFS', B1: 'FISH SKELETONS & GILLS', B2: 'INSECT MORPHOLOGY', B3: 'SPINES, RIBS & PELVIS' },
  aquaticMateria: { A1: 'SPONGES & THEIR REMEDIES', A2: 'CORAL', A3: 'SHELLS & OYSTERS', B1: 'AQUATIC PLANTS', B2: 'WATERS, SALTS & NITRUM', B3: 'REMEDIES FROM AQUATIC LIFE' },
  romanAgriculture: { A1: 'THE ROMAN GARDEN', A2: 'FLAX & FIBRE', A3: 'GRAIN & LEGUMES', B1: 'GRAFTING & PRUNING', B2: 'VINE, VINTAGE & WINE', B3: 'CULTIVATED FLOWERS' },
  fishForms: { A1: 'GIANT LIFE OF THE SEA', A2: 'COMPARATIVE FORMS OF FISH', A3: 'EELS, FLATFISH & REMORA', B1: 'EXTRAORDINARY FISH FORMS', B2: 'CUTTLEFISH, SQUID & OCTOPUS', B3: 'RAYS, SPAWNING & OYSTER BEDS' },
  avianReproduction: { A1: 'THE ARCHITECTURE OF NESTS', A2: 'INCUBATION & BROOD CARE', A3: 'THE FORMS & NATURE OF EGGS', B1: 'ROMAN POULTRY HUSBANDRY', B2: 'EGG AUGURY & HERONS', B3: 'COMPARATIVE REPRODUCTION' },
  treeCraft: { A1: 'VINE, VINTAGE & WINE', A2: 'REEDS, PAPYRUS & WILLOW', A3: 'GRAIN, MILLING & BREAD', B1: 'FRANKINCENSE, MYRRH & RESIN', B2: 'ORCHARDS, FRUITS & OIL', B3: 'FOREST & TIMBER CRAFT' },
  wildRemedies: { A1: 'PLANTAGO', A2: 'EBULUM · DWARF ELDER', A3: 'DANGEROUS & TOXIC PLANTS', B1: 'MINOR MEDICINAL HERBS', B2: 'THE ORIGIN & PRACTICE OF MEDICINE', B3: 'ANIMAL-DERIVED REMEDIES' },
  romanMetalsArts: { A1: 'GOLD & THE EQUESTRIAN ORDER', A2: 'SILVER, MIRRORS & WEALTH', A3: 'BRONZE & BASE METALS', B1: 'PIGMENTS, PAINTING & MODELLING', B2: 'STONE, ARCHITECTURE & GLASS', B3: 'GEMS & LAPIDARY TESTING' },
  cosmosMechanics: { A1: 'THE ORDERED COSMOS', A2: 'SUN, MOON & ECLIPSES', A3: 'PLANETS, SEASONS & TIME', B1: 'COMETS & CELESTIAL LIGHTS', B2: 'THUNDER, RAINBOW & CLOUDS', B3: 'WINDS & WEATHER' },
  earthOcean: { A1: 'THE FORM & MEASURE OF EARTH', A2: 'NAVIGATION, TIDES & THE SEA', A3: 'EARTHQUAKES & CLEFTS', B1: 'ISLANDS BORN, JOINED & LOST', B2: 'SPRINGS, RIVERS & WATERWORKS', B3: 'SUBSTANCES & FIRES OF EARTH' },
  westernRegions: { A1: 'HISPANIA', A2: 'GAUL & THE ALPS', A3: 'ITALY & THE PADUS', B1: 'THE WESTERN ISLANDS', B2: 'GREECE & THE ADRIATIC', B3: 'THE DANUBE PROVINCES' },
  easternRegions: { A1: 'NORTH AFRICA', A2: 'EGYPT & THE NILE', A3: 'SYRIA, JUDAEA & EUPHRATES', B1: 'ANATOLIA, ARMENIA & CAUCASUS', B2: 'CASPIAN, SCYTHIA & MESOPOTAMIA', B3: 'INDIA, ARABIA & ETHIOPIA' },
  humanCapacities: { A1: 'HUMAN LIFE & SOCIETY', A2: 'STRENGTH, ENDURANCE & COURAGE', A3: 'MEMORY, GENIUS & WISDOM', B1: 'VIRTUE, HONOURS & FORTUNE', B2: 'MORTALITY & REMEMBRANCE', B3: 'INVENTIONS, LETTERS & CUSTOMS' },
  cultivatedMateria: { A1: 'GARDEN VEGETABLES & GOURDS', A2: 'CULINARY & AROMATIC HERBS', A3: 'THE ROMAN APOTHECARY', B1: 'FLOWERS, ODOURS & REMEDIES', B2: 'THE WILD MEDICINAL HERBARIUM', B3: 'TOXIC PLANTS, FUNGI & ANTIDOTES' },
  insectSocieties: { A1: 'BEES & THE HIVE', A2: 'WASPS, HORNETS & NESTS', A3: 'ANT SOCIETY', B1: 'SILKWORM METAMORPHOSIS', B2: 'CICADAS, GRASSHOPPERS & LOCUSTS', B3: 'BEETLES, SPIDERS & SCORPIONS' },
  treeSpecies: { A1: 'FOREIGN & AROMATIC TREES', A2: 'VINES & VITICULTURE', A3: 'OLIVES & ORCHARD FRUITS', B1: 'FOREST TREES', B2: 'PROPAGATION & CARE', B3: 'TIMBER, BARK & WOODLAND CRAFT' },
});

function rangeIncludes(value, ranges) {
  return ranges.some(([start, end = start]) => value >= start && value <= end);
}

function campaignPlate(asset, mainCell, id = asset, variantKey = id) {
  const variants = CAMPAIGN_DETAIL_CELLS[mainCell];
  const detailCells = variants[hashText(`details:${variantKey}`) % variants.length];
  const campaignLayouts = ['triptych', 'hero', 'ledger'];
  const layout = campaignLayouts[hashText(`layout:${variantKey}`) % campaignLayouts.length];
  const [, latin] = CAMPAIGN_COPY[asset];
  const english = CAMPAIGN_CELL_LABELS[asset][mainCell];
  return {
    id,
    asset,
    mainCell,
    detailCells,
    focus: SIX_CELL_FOCI[mainCell],
    detailFocuses: detailCells.map((cell) => SIX_CELL_FOCI[cell]),
    english,
    latin,
    layouts: [layout],
    mark: 'measure',
    matchSource: 'campaign',
    semanticMatch: true,
    campaign: true,
  };
}

function campaignSubject(bookNumber, chapterId, title, subheadings) {
  const chapter = chapterNumber(chapterId);
  const text = `${title} ${subheadings.join(' ')}`;
  const routeKey = `${bookNumber}:${chapterId}`;

  // Receipt-backed atlas cells are mapped by explicit book/chapter taxonomy.
  // These are stronger than a broad book-family fallback, but they are not
  // hand-curated routes and must remain labelled separately.
  if (routeKey === '11:48') return campaignPlate('comparativeAnatomy', 'B2', 'comparative-anatomy-b2', routeKey);
  if (['17:14', '17:15', '17:16'].includes(routeKey)) return campaignPlate('romanAgriculture', 'B1', 'roman-agriculture-b1', routeKey);
  if (routeKey === '18:16') return campaignPlate('romanAgriculture', 'A3', 'roman-agriculture-a3', routeKey);
  if (routeKey === '18:28') return campaignPlate('romanAgriculture', 'A1', 'roman-agriculture-a1', routeKey);
  if (routeKey === '20:24') return campaignPlate('cultivatedMateria', 'A3', 'cultivated-materia-a3', routeKey);
  if (routeKey === '27:7') return campaignPlate('aquaticMateria', 'B1', 'aquatic-materia-b1', routeKey);
  if (routeKey === '27:13') return campaignPlate('wildRemedies', 'A3', 'wild-remedies-a3', routeKey);
  if (['28:20', '30:16'].includes(routeKey)) return campaignPlate('wildRemedies', 'B3', 'wild-remedies-b3', routeKey);

  if (bookNumber === 2) {
    if (chapter >= 79 && chapter <= 84) return campaignPlate('earthOcean', 'A3', 'earth-ocean-a3', routeKey);
    if (chapter === 103) return campaignPlate('earthOcean', 'B2', 'earth-ocean-b2', routeKey);
    if (chapter >= 104 && chapter <= 107) return campaignPlate('earthOcean', 'B3', 'earth-ocean-b3', routeKey);
    if (chapter === 108) return campaignPlate('earthOcean', 'A1', 'earth-ocean-a1', routeKey);
    if (CURATED_ROUTES[routeKey]) return null;
    if (chapter % 4 === 0) return null;
    if (chapter >= 63) {
      const mainCell = chapter <= 65 || [68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 108, 109].includes(chapter) ? 'A1'
        : [66, 67, 85, 97, 98, 99, 100, 101, 102].includes(chapter) ? 'A2'
          : chapter >= 79 && chapter <= 84 ? 'A3'
            : chapter >= 86 && chapter <= 96 ? 'B1'
              : chapter === 103 ? 'B2' : 'B3';
      return campaignPlate('earthOcean', mainCell, `earth-ocean-${mainCell.toLowerCase()}`, routeKey);
    }
    const mainCell = [1, 2, 3, 4, 5, 6, 7, 23].includes(chapter) ? 'A1'
      : [10, 13, 14, 19, 30, 31, 32].includes(chapter) ? 'A2'
        : [8, 9, 11, 12, 15, 16, 17, 18, 21, 22, 26, 39, 40, 41, 42].includes(chapter) ? 'A3'
          : chapter >= 24 && chapter <= 38 ? 'B1'
            : [20, 43, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61].includes(chapter) ? 'B2' : 'B3';
    return campaignPlate('cosmosMechanics', mainCell, `cosmos-mechanics-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber === 3 || bookNumber === 4) {
    if (chapter % 3 === 0) return null;
    let mainCell;
    if (bookNumber === 3) {
      mainCell = chapter <= 3 ? 'A1' : chapter === 4 || chapter === 20 ? 'A2'
        : chapter === 5 || (chapter >= 10 && chapter <= 19) ? 'A3'
          : chapter >= 6 && chapter <= 9 ? 'B1'
            : chapter >= 21 && chapter <= 23 ? 'B2' : 'B3';
    } else {
      mainCell = chapter <= 12 ? 'B2' : chapter <= 19 ? 'A2' : chapter <= 22 ? 'A1' : 'A2';
    }
    return campaignPlate('westernRegions', mainCell, `western-regions-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber === 5 || bookNumber === 6) {
    if (chapter % 3 === 0) return null;
    let mainCell;
    if (bookNumber === 5) {
      mainCell = chapter <= 8 ? 'A1' : chapter <= 10 ? 'A2'
        : chapter <= 26 ? 'A3' : 'B1';
    } else {
      mainCell = chapter <= 12 ? 'B1' : chapter <= 17 || (chapter >= 25 && chapter <= 27) ? 'B2' : 'B3';
    }
    return campaignPlate('easternRegions', mainCell, `eastern-regions-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber === 7) {
    const humanCells = {
      A1: [1, 2, 39],
      A2: [20, 23, 26, 27, 28],
      A3: [24, 25, 29, 30, 31, 32],
      B1: [33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47],
      B2: [48, 51, 52, 53, 54, 55],
      B3: [56, 57, 58, 59],
    };
    const mainCell = Object.entries(humanCells).find(([, chapters]) => chapters.includes(chapter))?.[0];
    if (mainCell) return campaignPlate('humanCapacities', mainCell, `human-capacities-${mainCell.toLowerCase()}`, routeKey);
  }

  if (['27:2', '27:3', '30:1', '30:2'].includes(routeKey)) return null;

  if (bookNumber === 11 && chapter <= 36 && chapter % 4 !== 0) {
    const mainCell = chapter <= 4 ? 'B3' : chapter <= 20 ? 'A1' : chapter === 21 ? 'A2'
      : chapter <= 23 ? 'B1' : chapter <= 26 ? 'B3'
        : [27, 28, 29].includes(chapter) ? 'B2'
          : [30, 31].includes(chapter) ? 'A3' : chapter === 32 ? 'B1' : 'B3';
    return campaignPlate('insectSocieties', mainCell, `insect-societies-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber >= 12 && bookNumber <= 17 && routeKey !== '13:12') {
    const useNewAtlas = hashText(`tree-shelf-v2:${routeKey}`) % 2 === 0;
    let asset = useNewAtlas ? 'treeSpecies' : 'treeCraft';
    let mainCell;
    if (bookNumber === 12) mainCell = useNewAtlas ? 'A1' : 'B1';
    else if (bookNumber === 13) {
      const orchard = /date|palm|fruit|berry|fig/u.test(text);
      mainCell = orchard ? (useNewAtlas ? 'A3' : 'B2') : (useNewAtlas ? 'A1' : 'B3');
    } else if (bookNumber === 14) mainCell = useNewAtlas ? 'A2' : 'A1';
    else if (bookNumber === 15) mainCell = useNewAtlas ? 'A3' : 'B2';
    else if (bookNumber === 16) {
      const timber = /timber|wood|bark|resin|pitch|cut/u.test(text);
      mainCell = useNewAtlas ? (timber ? 'B3' : 'B1') : 'B3';
    } else mainCell = useNewAtlas ? 'B2' : 'B3';
    return campaignPlate(asset, mainCell, `${asset}-${mainCell.toLowerCase()}`, routeKey);
  }

  if (routeKey === '21:14' || routeKey === '22:24') {
    return campaignPlate('insectSocieties', 'A1', 'bees-honey-and-propolis', routeKey);
  }

  if (chapter % 4 !== 0 && ((bookNumber === 20 && chapter !== 19) || bookNumber === 21 || (bookNumber === 22 && chapter !== 25))) {
    const mainCell = bookNumber === 20 ? chapter <= 9 ? 'A1' : chapter <= 22 ? 'A2' : 'A3'
      : bookNumber === 21 ? chapter === 13 ? 'B3' : chapter === 34 ? 'A3' : 'B1'
        : chapter === 23 ? 'B3' : 'B2';
    return campaignPlate('cultivatedMateria', mainCell, `cultivated-materia-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber === 9 && chapter !== 45 && rangeIncludes(chapter, [[1, 30], [43, 53], [57], [59], [62]])) {
    const mainCell = chapter <= 13 ? ([3, 5].includes(chapter) ? 'B1' : [7, 12].includes(chapter) ? 'A2' : 'A1') : chapter <= 20 ? 'A2' : chapter <= 26 ? 'A3'
      : chapter === 27 ? 'B1' : chapter <= 30 ? 'B2' : 'B3';
    return campaignPlate('fishForms', mainCell, `fish-campaign-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber === 10 && ([9, 16, 31, 33].includes(chapter) || rangeIncludes(chapter, [[50, 68]]))) {
    const mainCell = [33, 59].includes(chapter) ? 'A1'
      : [31, 52, 54, 58].includes(chapter) ? 'A2'
        : [9, 16, 53, 60].includes(chapter) ? 'A3'
          : [50, 51, 56, 57].includes(chapter) ? 'B1'
            : chapter === 55 ? 'B2' : 'B3';
    return campaignPlate('avianReproduction', mainCell, `avian-reproduction-${mainCell.toLowerCase()}`, routeKey);
  }

  if (bookNumber === 11 && [37, 43, 44, 45, 46, 47, 48, 50, 52, 53].includes(chapter)) {
    const mainCell = ({ 37: 'B3', 43: 'B3', 44: 'B3', 45: 'A1', 46: 'A3', 47: 'A2', 48: 'A3', 50: 'B3', 52: 'B3', 53: 'B1' })[chapter];
    return campaignPlate('comparativeAnatomy', mainCell, `comparative-anatomy-${mainCell.toLowerCase()}`, routeKey);
  }
  if (routeKey === '11:41') return campaignPlate('wildRemedies', 'B3', 'milk-and-animal-remedies', routeKey);

  const agricultureEligible = (bookNumber === 18 && [2, 4, 6, 8, 13, 15, 17, 19, 20, 22, 24, 31].includes(chapter))
    || (bookNumber === 19 && [1, 3, 4, 5, 7, 8, 9, 10, 11, 12].includes(chapter))
    || (bookNumber === 21 && [1, 2, 3, 4, 5, 6, 9, 11, 12, 18, 19, 26].includes(chapter));
  if (agricultureEligible) {
    const mainCell = routeKey === '19:4' ? 'A1' : /flower|rose|lily|violet|garland|chaplet|hyacinth/u.test(text) ? 'B3'
      : /vine|vintage|wine/u.test(text) ? 'B2'
        : /graft|prun/u.test(text) ? 'B1'
          : /flax|fibre|fiber|hemp/u.test(text) ? 'A2'
            : /grain|corn|wheat|bean|vetch|lupine|seed|legumin/u.test(text) ? 'A3' : 'A1';
    return campaignPlate('romanAgriculture', mainCell, `roman-agriculture-${mainCell.toLowerCase()}`, routeKey);
  }

  if ((bookNumber === 31 || bookNumber === 32) && chapter >= 1 && chapter <= 11 && routeKey !== '32:4') {
    const mainCell = /sponge/u.test(text) ? 'A1' : /coral/u.test(text) ? 'A2'
      : /shell|oyster|conch|purple/u.test(text) ? 'A3'
        : /plant|seaweed/u.test(text) ? 'B1'
          : bookNumber === 31 ? 'B2' : 'B3';
    return campaignPlate('aquaticMateria', mainCell, `aquatic-materia-${mainCell.toLowerCase()}`, routeKey);
  }

  const treeEligible = (bookNumber >= 12 && bookNumber <= 17) || bookNumber === 23 || bookNumber === 24
    || (bookNumber === 18 && chapter >= 9 && chapter <= 11) || routeKey === '22:25';
  const treeForced = (bookNumber === 18 && chapter >= 9 && chapter <= 11) || ['22:25', '23:1', '24:11'].includes(routeKey);
  if (treeEligible && routeKey !== '23:2' && (treeForced || hashText(`campaign-v1:${routeKey}`) % 2 === 0)) {
    const mainCell = routeKey === '22:25' ? 'A3' : routeKey === '13:12' ? 'A2' : /vine|grape|wine|vintage/u.test(text) ? 'A1'
      : /reed|papyrus|willow/u.test(text) ? 'A2'
        : /grain|wheat|flour|meal|leaven|mill|bread/u.test(text) ? 'A3'
          : /frankincense|myrrh|aromatic|resin|bark|pitch/u.test(text) ? 'B1'
            : /olive|fig|apple|pear|date|palm|fruit|orchard/u.test(text) ? 'B2' : 'B3';
    return campaignPlate('treeCraft', mainCell, `tree-craft-${mainCell.toLowerCase()}`, routeKey);
  }

  const wildEligible = (bookNumber === 25 && chapter >= 1 && chapter <= 13)
    || (bookNumber === 26 && [3, 4, 6, 9, 13].includes(chapter))
    || (bookNumber === 27 && chapter >= 1 && chapter <= 13)
    || (bookNumber >= 28 && bookNumber <= 30);
  const wildForced = ['25:8', '25:10', '29:1'].includes(routeKey);
  if (wildEligible && (wildForced || hashText(`campaign-v1:${routeKey}`) % 2 === 0)) {
    const mainCell = routeKey === '25:13' ? 'B1' : /plantago|plantain/u.test(text) ? 'A1' : /ebulum|dwarf elder/u.test(text) ? 'A2'
      : /aconite|mandrake|hemlock/u.test(text) ? 'A3'
        : /origin of the medical|medical art|physician/u.test(text) ? 'B2'
          : bookNumber >= 28 ? 'B3' : 'B1';
    return campaignPlate('wildRemedies', mainCell, `wild-remedies-${mainCell.toLowerCase()}`, routeKey);
  }

  const metalsEligible = bookNumber >= 33 && bookNumber <= 37 && !['35:11', '35:18'].includes(routeKey);
  const metalsForced = ['33:2', '33:9', '34:3'].includes(routeKey);
  if (metalsEligible && (metalsForced || hashText(`campaign-v1:${routeKey}`) % 2 === 0)) {
    const mainCell = bookNumber === 37 ? 'B3' : bookNumber === 36 ? 'B2' : /gold|equestrian/u.test(text) ? 'A1'
      : /silver|mirror|wealth/u.test(text) ? 'A2'
        : /brass|bronze|copper|iron|lead|tin|lamp|statue/u.test(text) ? 'A3'
          : /paint|pigment|artist|modelling|modeling|portrait/u.test(text) ? 'B1'
            : /marble|stone|building|column|temple|obelisk|pavement|mosaic|glass|lime|earth|sulphur|sulfur/u.test(text) ? 'B2' : 'B3';
    return campaignPlate('romanMetalsArts', mainCell, `roman-metals-arts-${mainCell.toLowerCase()}`, routeKey);
  }

  return null;
}

function defaultSubject(family, bookNumber, chapterId) {
  if (family === 'dedication') return { id: 'dedication', asset: 'dedication', focus: [50, 50], latin: 'NATVRAE OPVS', english: 'THE WHOLE WORK OF NATURE', layouts: ['hero'], mark: 'measure' };
  if (family === 'cosmos') return { id: 'cosmos', asset: 'celestialWeather', focus: [50, 48], latin: 'DE MVNDO', english: 'THE ORDER OF THE COSMOS', layouts: ['orbit', 'ledger'], mark: 'celestial' };
  if (family === 'geography') return bookNumber === 3
    ? { id: 'mediterranean', asset: 'mediterranean', focus: [50, 48], latin: 'ORBIS TERRARVM', english: 'THE MEDITERRANEAN WORLD', layouts: ['map', 'hero'], mark: 'compass' }
    : { id: 'regions', asset: 'regions', focus: [50, 50], latin: 'TERRAE ET GENTES', english: 'LANDS & PEOPLES', layouts: ['map', 'ledger'], mark: 'compass' };
  if (family === 'humanity') return bookNumber === 7
    ? { id: 'human-life', asset: 'humanityClassic', focus: [50, 47], latin: 'DE VITA HVMANA', english: 'HUMAN LIFE & ACHIEVEMENT', layouts: ['hero', 'ledger'], mark: 'measure' }
    : { id: 'medicine', asset: 'romanMedicine', focus: [62, 70], latin: 'HOMO ET MEDICINA', english: 'HUMANITY & HEALING', layouts: ['ledger', 'triptych'], mark: 'measure' };
  if (family === 'terrestrial') return { id: 'quadrupeds', asset: 'quadrupeds', focus: [50, 50], latin: 'ANIMALIA TERRAE', english: 'ANIMALS OF THE LAND', layouts: ['triptych', 'hero', 'ledger'], mark: 'none' };
  if (family === 'marine') return bookNumber === 31
    ? { id: 'waters-and-salts', asset: 'marineClassic', focus: [45, 35], latin: 'AQVAE ET SALES', english: 'WATERS, SALTS & AQUATIC MATTER', layouts: ['hero', 'ledger'], mark: 'measure' }
    : { id: 'marine-life', asset: 'marineLife', focus: [50, 50], latin: 'ANIMALIA MARIS', english: 'LIFE OF SEA & RIVER', layouts: ['triptych', 'hero', 'ledger'], mark: 'none' };
  if (family === 'flight') {
    if (bookNumber === 10 && chapterNumber(chapterId) >= 61) return { id: 'animal-life', asset: 'animalsClassic', focus: [50, 48], latin: 'DE NATVRA ANIMALIVM', english: 'THE LIFE OF ANIMALS', layouts: ['hero', 'ledger'], mark: 'none' };
    if (bookNumber === 11 && chapterNumber(chapterId) >= 37) return { id: 'comparative-anatomy', asset: 'humanityClassic', focus: [50, 47], latin: 'DE CORPORIBVS ANIMALIVM', english: 'COMPARATIVE ANATOMY', layouts: ['ledger', 'triptych'], mark: 'measure' };
    return bookNumber === 10
      ? { id: 'birds', asset: 'wingedLife', focus: [50, 38], latin: 'DE AVIBVS', english: 'BIRDS & FLIGHT', layouts: ['triptych', 'hero', 'ledger'], mark: 'none' }
      : { id: 'insect-life', asset: 'wingedLife', focus: [37, 73], latin: 'DE INSECTIS', english: 'INSECTS & SMALL CREATURES', layouts: ['triptych', 'hero', 'ledger'], mark: 'measure' };
  }
  if (family === 'botany') {
    const treeBook = bookNumber <= 17 || bookNumber === 23 || bookNumber === 24;
    return treeBook
      ? { id: 'trees', asset: 'trees', focus: [50, 50], latin: 'ARBORES ET SILVAE', english: 'TREES, ORCHARDS & FORESTS', layouts: ['triptych', 'ledger', 'hero'], mark: 'measure' }
      : { id: 'herbs', asset: 'cropsHerbs', focus: [50, 50], latin: 'FRVGES ET HERBAE', english: 'CROPS, FLOWERS & HERBS', layouts: ['triptych', 'ledger', 'hero'], mark: 'measure' };
  }
  if (bookNumber === 35) return { id: 'painting', asset: 'mineralArts', focus: [47, 72], latin: 'PICTVRA ET PIGMENTA', english: 'PAINTING & PIGMENTS', layouts: ['ledger', 'triptych', 'hero'], mark: 'measure' };
  if (bookNumber === 36) return { id: 'architecture', asset: 'mineralArts', focus: [87, 76], latin: 'LAPIDES ET AEDIFICIA', english: 'STONE & ARCHITECTURE', layouts: ['ledger', 'triptych', 'hero'], mark: 'measure' };
  if (bookNumber === 37) return { id: 'gems', asset: 'mineralArts', focus: [20, 70], latin: 'GEMMAE ET CRYSTALLI', english: 'GEMS & CRYSTALS', layouts: ['ledger', 'triptych', 'hero'], mark: 'measure' };
  return { id: 'mineral-arts', asset: 'mineralArts', focus: [50, 45], latin: 'METALLA LAPIDES ARTES', english: 'METALS, STONES & ARTS', layouts: ['ledger', 'triptych', 'hero'], mark: 'measure' };
}

function ruleApplies(rule, family, bookNumber, chapterId) {
  const numericChapter = chapterNumber(chapterId);
  return rule.families.includes(family)
    && (!rule.books || rule.books.includes(bookNumber))
    && (!rule.chapters || rule.chapters.includes(String(chapterId)))
    && (rule.chapterMin === undefined || numericChapter >= rule.chapterMin)
    && (rule.chapterMax === undefined || numericChapter <= rule.chapterMax);
}

function selectSubject(family, bookNumber, chapterId, title, subheadings) {
  const campaign = campaignSubject(bookNumber, chapterId, title, subheadings);
  if (campaign) return campaign;
  const curated = CURATED_ROUTES[`${bookNumber}:${chapterId}`];
  if (curated) return { ...curated, matchSource: 'curated', semanticMatch: true };
  const familyRules = SUBJECT_RULES.filter((rule) => ruleApplies(rule, family, bookNumber, chapterId));
  const titleMatch = familyRules.find((rule) => rule.pattern.test(title));
  if (titleMatch) return { ...titleMatch, matchSource: 'title', semanticMatch: true };
  const subheadingMatch = familyRules.find((rule) => subheadings.some((heading) => rule.pattern.test(heading)));
  if (subheadingMatch) return { ...subheadingMatch, matchSource: 'subheading', semanticMatch: true };
  return { ...defaultSubject(family, bookNumber, chapterId), matchSource: 'fallback', semanticMatch: false };
}

function normalizeRoutingText(value) {
  return String(value)
    .toLocaleLowerCase('en-US')
    .replaceAll('æ', 'ae')
    .replaceAll('œ', 'oe')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[–—]/g, '-');
}

function declaredDetailPoints({ mainPoint, explicitFocuses = [], assetFocuses = [], clampX, clampY, seed }) {
  const normalizePoint = (point) => {
    if (!Array.isArray(point) || point.length !== 2) return null;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [clampX(x), clampY(y)];
  };
  const normalizedExplicit = explicitFocuses.map(normalizePoint).filter(Boolean);
  const safelySeparated = (left, right) => focusDistance(left, right) >= PANEL_MIN_FOCUS_DISTANCE;
  if (normalizedExplicit.length === 2
    && normalizedExplicit.every((point) => safelySeparated(mainPoint, point))
    && safelySeparated(normalizedExplicit[0], normalizedExplicit[1])) {
    return { points: normalizedExplicit, usedExplicitPair: true };
  }

  const uniqueCandidates = [];
  const seen = new Set();
  for (const point of [...normalizedExplicit, ...assetFocuses.map(normalizePoint).filter(Boolean)]) {
    const key = `${point[0]},${point[1]}`;
    if (seen.has(key) || !safelySeparated(mainPoint, point)) continue;
    seen.add(key);
    uniqueCandidates.push(point);
  }
  const pairs = uniqueCandidates.flatMap((left, leftIndex) => uniqueCandidates
    .slice(leftIndex + 1)
    .filter((right) => safelySeparated(left, right))
    .map((right) => [left, right]));
  if (pairs.length === 0) return null;
  return { points: pairs[seed % pairs.length], usedExplicitPair: false };
}

// Each plate is painted on a cover-sized layer, then enlarged and panned. This
// keeps every frame filled in portrait Focus mode while still isolating a
// chapter's subject from its larger atlas.
const SUBJECT_SCALES = {
  dedication: 1.08,
  humanityClassic: 1.38,
  animalsClassic: 1.48,
  marineClassic: 1.38,
  flightClassic: 1.58,
  elephants: 1.9,
  quadrupeds: 2.78,
  rareTerrestrial: 2.78,
  marineLife: 2.16,
  wingedLife: 2.4,
  birdsDomestic: 2.78,
  mediterranean: 1.08,
  regions: 1.12,
  romanWorks: 2.16,
  celestialWeather: 2.72,
  trees: 2.08,
  cropsHerbs: 2.1,
  romanMedicine: 2.02,
  mineralArts: 2.04,
  lacunaAtlas: 2,
  vesuviusLetters: 2,
  earthPhenomena: 3,
  mineralFire: 3,
  skyMeasure: 2.7,
  aromaticsApothecary: 2.7,
  humanLifeBelief: 2.7,
  medicinalHerbarium: 2.7,
  comparativeAnatomy: 3,
  aquaticMateria: 3,
  romanAgriculture: 3,
  fishForms: 3,
  avianReproduction: 3,
  treeCraft: 3,
  wildRemedies: 3,
  romanMetalsArts: 3,
  cosmosMechanics: 3,
  earthOcean: 3,
  westernRegions: 3,
  easternRegions: 3,
  humanCapacities: 3,
  cultivatedMateria: 3,
  insectSocieties: 3,
  treeSpecies: 3,
};

const SUBJECT_SCALE_OVERRIDES = {
  whales: 1.28,
  wolves: 1.96,
  'named-birds': 1.78,
  'general-birds': 1.78,
  moon: 1.38,
  cities: 1.2,
  stars: 1.2,
  senses: 1.62,
};

const ASSET_BOUNDS = {
  dedication: [8, 92, 8, 92],
  humanityClassic: [8, 92, 8, 92],
  animalsClassic: [15, 82, 24, 88],
  marineClassic: [19, 80, 17, 82],
  flightClassic: [8, 86, 16, 86],
  elephants: [20, 78, 22, 84],
  quadrupeds: [16, 84, 18, 82],
  rareTerrestrial: [16, 84, 18, 82],
  marineLife: [16, 86, 17, 84],
  wingedLife: [17, 84, 19, 84],
  birdsDomestic: [16, 84, 18, 82],
  mediterranean: [12, 88, 12, 88],
  regions: [12, 88, 12, 88],
  romanWorks: [17, 83, 18, 78],
  celestialWeather: [14, 85, 12, 84],
  trees: [15, 82, 22, 84],
  cropsHerbs: [15, 85, 20, 82],
  romanMedicine: [16, 89, 21, 73],
  mineralArts: [20, 87, 18, 76],
  lacunaAtlas: [25, 75, 25, 75],
  vesuviusLetters: [25, 75, 25, 75],
  earthPhenomena: [16, 84, 25, 75],
  mineralFire: [16, 84, 25, 75],
  skyMeasure: [16, 84, 18, 82],
  aromaticsApothecary: [16, 84, 18, 82],
  humanLifeBelief: [16, 84, 18, 82],
  medicinalHerbarium: [16, 84, 18, 82],
  comparativeAnatomy: [16, 84, 25, 75],
  aquaticMateria: [16, 84, 25, 75],
  romanAgriculture: [16, 84, 25, 75],
  fishForms: [16, 84, 25, 75],
  avianReproduction: [16, 84, 25, 75],
  treeCraft: [16, 84, 25, 75],
  wildRemedies: [16, 84, 25, 75],
  romanMetalsArts: [16, 84, 25, 75],
  cosmosMechanics: [16, 84, 25, 75],
  earthOcean: [16, 84, 25, 75],
  westernRegions: [16, 84, 25, 75],
  easternRegions: [16, 84, 25, 75],
  humanCapacities: [16, 84, 25, 75],
  cultivatedMateria: [16, 84, 25, 75],
  insectSocieties: [16, 84, 25, 75],
  treeSpecies: [16, 84, 25, 75],
};

function normalizePan(value, min, max) {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function coverLayerOffset(focus, extent) {
  return Math.min(0, Math.max(100 - extent, 50 - (focus / 100) * extent));
}

function focusDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

/**
 * @param {{
 *   bookNumber: number,
 *   bookRoman: string,
 *   chapterId: string,
 *   chapterTitle: string,
 *   chapterLatinTitle?: string,
 *   englishSubheadings?: Array<string | { title?: string }>,
 *   ordinal: number,
 *   ignoreCertifiedAtlasOverride?: boolean,
 * }} chapter
 */
export function chapterIllustration({
  bookNumber,
  bookRoman,
  chapterId,
  chapterTitle,
  chapterLatinTitle = '',
  englishSubheadings = [],
  ordinal,
  ignoreCertifiedAtlasOverride = false,
}) {
  const chapterScene = chapterSceneSourceFor(bookNumber, chapterId);
  if (chapterScene) {
    const family = familyForBook(bookNumber);
    const plateNumber = `${bookRoman}.${String(chapterId).toUpperCase()}`;
    const logicalPath = chapterScene.logicalPath;
    const style = {
      '--plate-main-image': `url("${chapterScene.desktop.fallback}")`,
      '--plate-main-image-set': chapterScene.desktop.imageSet,
      '--plate-main-image-set-mobile': chapterScene.mobile.imageSet,
      '--plate-main-x': '50%',
      '--plate-main-y': '50%',
      '--plate-main-size': '100%',
      '--plate-main-x-offset': '0%',
      '--plate-main-y-offset': '0%',
      '--plate-mark-x': '76%',
      '--plate-mark-y': '72%',
      '--plate-mark-rotation': '0deg',
    };
    const studyKey = `${logicalPath}|50,50`;
    const panelKey = `${logicalPath}|hero|1|50,50`;
    const renderedKey = `${logicalPath}|hero|1|50%|50%|100%|0%|0%`;
    const accessibleLabel = `${chapterTitle}, panel I: complete modern editorial illustration made for this chapter.`;
    return {
      family,
      subject: `chapter-scene-${bookNumber}-${chapterId}`,
      matchSource: 'chapter-scene',
      semanticMatch: true,
      routeConfidence: 'high',
      continuityKey: `chapter-scene:${bookNumber}:${chapterId}`,
      continuityGroup: null,
      instanceKey: `${bookNumber}|${chapterId}|${renderedKey}`,
      studyKey,
      panelKey,
      renderedKey,
      visualSignature: panelKey,
      layout: 'hero',
      mark: 'none',
      style,
      focus: [50, 50],
      mainCell: null,
      detailCells: null,
      panelCount: 1,
      panels: [{
        label: 'I',
        field: 'main',
        focus: [50, 50],
        cell: null,
        cellLabel: null,
        accessibleLabel,
        source: {
          asset: `chapter-scene:${bookNumber}:${chapterId}`,
          masterImage: logicalPath,
          desktopImage: chapterScene.desktop.fallback,
          mobileImage: chapterScene.mobile.fallback,
          description: chapterScene.description,
          viewerKind: 'chapter-scene',
          viewerImage: chapterScene.desktop.fallback,
          viewerPreferredImage: chapterScene.desktop.preload,
          viewerImageSet: chapterScene.desktop.imageSet,
        },
      }],
      campaign: false,
      originalChapterScene: true,
      compositionKey: renderedKey,
      images: [logicalPath],
      preload: { desktop: chapterScene.desktop.preload, mobile: chapterScene.mobile.preload },
      alt: `${chapterTitle}. Complete modern editorial illustration created specifically for this chapter.`,
      latinCaption: `AD CAPVT ${plateNumber} · TABVLA PROPRIA`,
      englishCaption: `${chapterTitle} · EDITORIAL PLATE ${plateNumber}`,
    };
  }
  const certifiedAtlasOverride = ignoreCertifiedAtlasOverride
    ? null
    : certifiedAtlasOverrideFor(bookNumber, chapterId);
  if (certifiedAtlasOverride) {
    const family = familyForBook(bookNumber);
    const plateNumber = `${bookRoman}.${String(chapterId).toUpperCase()}`;
    const logicalPath = certifiedAtlasOverride.logicalPath;
    const responsive = imageSourceFor(logicalPath);
    const cellResponsive = cellImageSourceFor(logicalPath, certifiedAtlasOverride.cell);
    if (!responsive || !cellResponsive) {
      throw new Error(`Missing certified atlas override source for ${bookNumber}:${chapterId}`);
    }
    const focus = SIX_CELL_FOCI[certifiedAtlasOverride.cell];
    const style = {
      '--plate-main-image': `url("${cellResponsive.fallback}")`,
      '--plate-main-image-set': cellResponsive.imageSet,
      '--plate-main-image-set-mobile': cellResponsive.imageSet,
      '--plate-main-x': '50%',
      '--plate-main-y': '50%',
      '--plate-main-size': '100%',
      '--plate-main-x-offset': '0%',
      '--plate-main-y-offset': '0%',
      '--plate-mark-x': '76%',
      '--plate-mark-y': '72%',
      '--plate-mark-rotation': '0deg',
    };
    const studyKey = `${logicalPath}|${certifiedAtlasOverride.cell}`;
    const panelKey = `${logicalPath}|hero|1|${certifiedAtlasOverride.cell}`;
    const renderedKey = `${logicalPath}#${certifiedAtlasOverride.cell}|hero|1|50%|50%|100%|0%|0%`;
    const accessibleLabel = `${chapterTitle}, panel I: complete receipt-backed study of ${certifiedAtlasOverride.cellLabel}.`;
    return {
      family,
      subject: `certified-atlas-${bookNumber}-${chapterId}-${certifiedAtlasOverride.cell.toLocaleLowerCase()}`,
      matchSource: 'certified-atlas-cell',
      semanticMatch: true,
      routeConfidence: 'high',
      continuityKey: `certified-atlas:${bookNumber}:${chapterId}`,
      continuityGroup: null,
      instanceKey: `${bookNumber}|${chapterId}|${renderedKey}`,
      studyKey,
      panelKey,
      renderedKey,
      visualSignature: panelKey,
      layout: 'hero',
      mark: 'none',
      style,
      focus: [...focus],
      mainCell: certifiedAtlasOverride.cell,
      detailCells: null,
      panelCount: 1,
      panels: [{
        label: 'I',
        field: 'main',
        focus: [...focus],
        cell: certifiedAtlasOverride.cell,
        cellLabel: certifiedAtlasOverride.cellLabel,
        accessibleLabel,
        source: {
          asset: certifiedAtlasOverride.artworkId,
          masterImage: logicalPath,
          desktopImage: responsive.desktop.fallback,
          mobileImage: responsive.mobile.fallback,
          description: `receipt-backed six-scene atlas containing ${certifiedAtlasOverride.cellLabel}`,
          viewerKind: 'cell',
          viewerImage: cellResponsive.fallback,
          viewerPreferredImage: cellResponsive.preload,
          viewerImageSet: cellResponsive.imageSet,
        },
      }],
      campaign: true,
      certifiedAtlasOverride: true,
      originalChapterScene: false,
      compositionKey: renderedKey,
      images: [logicalPath],
      preload: { desktop: cellResponsive.preload, mobile: cellResponsive.preload },
      alt: `${chapterTitle}. One focal study from a single modern antiquarian natural-history plate depicting ${certifiedAtlasOverride.cellLabel}.`,
      latinCaption: `AD CAPVT ${plateNumber} · STVDIVM CERTVM`,
      englishCaption: `${certifiedAtlasOverride.cellLabel} · CERTIFIED STUDY ${plateNumber}`,
    };
  }
  const family = familyForBook(bookNumber);
  const normalizedTitle = normalizeRoutingText(`${chapterTitle} ${chapterLatinTitle}`);
  const normalizedSubheadings = englishSubheadings.map((heading) => normalizeRoutingText(heading.title ?? heading));
  const seed = hashText(`${bookNumber}:${chapterId}:${chapterTitle}:${ordinal}`);
  const subject = selectSubject(family, bookNumber, chapterId, normalizedTitle, normalizedSubheadings);
  const continuityKey = subject.continuityGroup ?? `${bookNumber}:${subject.id}`;
  const continuitySeed = hashText(continuityKey);
  const selectedLayout = subject.layouts[continuitySeed % subject.layouts.length];
  const primary = ASSETS[subject.asset];
  const responsive = imageSourceFor(primary.image);
  const bounds = ASSET_BOUNDS[subject.asset] ?? [8, 92, 8, 92];
  const clampX = (value) => Math.max(bounds[0], Math.min(bounds[1], value));
  const clampY = (value) => Math.max(bounds[2], Math.min(bounds[3], value));
  const mainX = clampX(subject.focus[0]);
  const mainY = clampY(subject.focus[1]);
  const detailSelection = declaredDetailPoints({
    mainPoint: [mainX, mainY],
    explicitFocuses: subject.detailFocuses,
    assetFocuses: primary.focuses,
    clampX,
    clampY,
    seed,
  });
  const panelCount = detailSelection ? 3 : 1;
  const layout = panelCount === 1 ? 'hero' : selectedLayout;
  const [[detailOneX, detailOneY], [detailTwoX, detailTwoY]] = detailSelection?.points
    ?? [[mainX, mainY], [mainX, mainY]];
  const detailCells = detailSelection?.usedExplicitPair && subject.detailCells?.length === 2
    ? [...subject.detailCells]
    : null;
  const baseScale = SUBJECT_SCALE_OVERRIDES[subject.id] ?? SUBJECT_SCALES[subject.asset] ?? 1.45;
  const mainScale = subject.campaign ? 3 : baseScale + (continuitySeed % 7) / 100;
  const detailOneScale = subject.campaign
    ? 3.12
    : Math.max(mainScale * 1.24, mainScale + .56) + ((seed >>> 8) % 6) / 100;
  const detailTwoScale = subject.campaign
    ? 3.24
    : Math.max(mainScale * 1.42, mainScale + .94) + ((seed >>> 16) % 7) / 100;
  // Every leaf receives a small, stable inward zoom treatment. The geometry is
  // route-derived (rather than route-labelled), so it changes the pixels the
  // reader sees while preserving each atlas cell's certified focal point.
  const framingSeed = hashText(`framing:${bookNumber}:${chapterId}`);
  const framingSteps = [
    framingSeed % 101,
    Math.floor(framingSeed / 101) % 61,
    Math.floor(framingSeed / 6161) % 61,
  ];
  const mainSize = Math.round(mainScale * 100) + framingSteps[0] / 10;
  const detailOneSize = Math.max(
    Math.round(detailOneScale * 100) + framingSteps[1] / 10,
    mainSize + 8,
  );
  const detailTwoSize = Math.max(
    Math.round(detailTwoScale * 100) + framingSteps[2] / 10,
    detailOneSize + 8,
  );
  const panelLayerStyle = (field, x, y, size) => ({
    [`--plate-${field}-image`]: `url("${responsive.desktop.fallback}")`,
    [`--plate-${field}-image-set`]: responsive.desktop.imageSet,
    [`--plate-${field}-image-set-mobile`]: responsive.mobile.imageSet,
    [`--plate-${field}-x`]: `${normalizePan(x, bounds[0], bounds[1]).toFixed(2)}%`,
    [`--plate-${field}-y`]: `${normalizePan(y, bounds[2], bounds[3]).toFixed(2)}%`,
    [`--plate-${field}-size`]: `${size}%`,
    [`--plate-${field}-x-offset`]: `${coverLayerOffset(x, size).toFixed(2)}%`,
    [`--plate-${field}-y-offset`]: `${coverLayerOffset(y, size).toFixed(2)}%`,
  });
  const style = {
    ...panelLayerStyle('main', mainX, mainY, mainSize),
    ...(panelCount === 3 ? {
      ...panelLayerStyle('detail-one', detailOneX, detailOneY, detailOneSize),
      ...panelLayerStyle('detail-two', detailTwoX, detailTwoY, detailTwoSize),
    } : {}),
    '--plate-mark-x': `${24 + (seed % 52)}%`,
    '--plate-mark-y': `${23 + ((seed >>> 8) % 48)}%`,
    '--plate-mark-rotation': `${(seed >>> 15) % 360}deg`,
  };
  const panelFields = ['main', 'detail-one', 'detail-two'].slice(0, panelCount);
  const panelNumerals = ['I', 'II', 'III'].slice(0, panelCount);
  const panelFocuses = [[mainX, mainY], ...(detailSelection?.points ?? [])];
  const panelCells = [subject.mainCell ?? null, ...(detailCells ?? [null, null])].slice(0, panelCount);
  const atlasSourceMetadata = {
    asset: subject.asset,
    masterImage: primary.image,
    desktopImage: responsive.desktop.fallback,
    mobileImage: responsive.mobile.fallback,
    description: primary.alt,
  };
  const panelDescriptors = panelFields.map((field, index) => {
    const cell = panelCells[index];
    const cellLabel = cell ? CAMPAIGN_CELL_LABELS[subject.asset]?.[cell] ?? null : null;
    const accessibleSubject = cellLabel
      ?? (index === 0 ? subject.english : `declared focal study from ${primary.alt}`);
    const cellResponsive = cell ? cellImageSourceFor(primary.image, cell) : null;
    return {
      label: panelNumerals[index],
      field,
      focus: [...panelFocuses[index]],
      cell,
      cellLabel,
      accessibleLabel: `${chapterTitle}, panel ${panelNumerals[index]}: ${accessibleSubject.toLocaleLowerCase()}.`,
      source: {
        ...atlasSourceMetadata,
        viewerKind: cellResponsive ? 'cell' : 'atlas',
        viewerImage: cellResponsive?.fallback ?? responsive.desktop.fallback,
        viewerPreferredImage: cellResponsive?.preload ?? responsive.desktop.preload,
        viewerImageSet: cellResponsive?.imageSet ?? responsive.desktop.imageSet,
      },
    };
  });
  const panelStudies = panelDescriptors.map((panel) => panel.cell ?? panel.focus.join(','));
  const mainStudy = panelStudies[0];
  const studyKey = [primary.image, mainStudy].join('|');
  const panelKey = [primary.image, layout, panelCount, ...panelStudies].join('|');
  const renderedKey = [
    primary.image,
    layout,
    panelCount,
    ...panelFields.flatMap((field) => [
      style[`--plate-${field}-x`],
      style[`--plate-${field}-y`],
      style[`--plate-${field}-size`],
      style[`--plate-${field}-x-offset`],
      style[`--plate-${field}-y-offset`],
    ]),
  ].join('|');
  const visualSignature = panelKey;
  const instanceKey = [bookNumber, chapterId, renderedKey].join('|');
  const plateNumber = `${bookRoman}.${String(chapterId).toUpperCase()}`;
  return {
    family,
    subject: subject.id,
    matchSource: subject.matchSource,
    semanticMatch: subject.semanticMatch,
    routeConfidence: subject.matchSource === 'curated' || subject.matchSource === 'title'
      ? 'high'
      : subject.matchSource === 'campaign' || subject.matchSource === 'subheading'
        ? 'medium'
        : 'broad',
    continuityKey,
    continuityGroup: subject.continuityGroup ?? null,
    instanceKey,
    studyKey,
    panelKey,
    renderedKey,
    visualSignature,
    layout,
    mark: subject.mark,
    style,
    focus: [mainX, mainY],
    mainCell: subject.mainCell ?? null,
    detailCells,
    panelCount,
    panels: panelDescriptors,
    campaign: subject.campaign === true,
    compositionKey: renderedKey,
    images: [primary.image],
    preload: { desktop: responsive.desktop.preload, mobile: responsive.mobile.preload },
    alt: subject.semanticMatch
      ? `${chapterTitle}. ${panelCount === 1 ? 'One focal study' : 'Three separated focal studies'} from a single modern antiquarian natural-history plate depicting ${subject.english.toLocaleLowerCase()}.`
      : `${chapterTitle}. ${panelCount === 1 ? 'One focal study' : 'Three separated focal studies'} from a single modern antiquarian book-family plate for ${subject.english.toLocaleLowerCase()}.`,
    latinCaption: `${subject.latin} · TABVLA ${plateNumber}`,
    englishCaption: `${subject.english} · PLATE ${plateNumber}`,
  };
}

export const PLATE_IMAGE_PATHS = Object.values(ASSETS).map((asset) => asset.image);
