/* Pocket Planet — data-driven content: resources, buildings, research, projects,
 * directives, milestones, discoveries and prestige upgrades.
 * All numbers are initial balance targets and are expected to be tuned. */
(function (PP) {
  'use strict';
  const S = PP.smooth;

  PP.RESOURCES = [
    { id: 'energy', name: 'Energy', icon: '⚡', color: '#ffd65a' },
    { id: 'minerals', name: 'Minerals', icon: '◆', color: '#d6ae86' },
    { id: 'compounds', name: 'Compounds', icon: '☁', color: '#a9d8ff' },
    { id: 'water', name: 'Water', icon: '💧', color: '#56b0ff' },
    { id: 'biomass', name: 'Biomass', icon: '🌿', color: '#72e07e' },
    { id: 'research', name: 'Research', icon: '🔬', color: '#c9a0ff' },
    { id: 'civ', name: 'Civilization', icon: '🏙', color: '#ffb46b' },
    { id: 'exotic', name: 'Exotic Matter', icon: '✦', color: '#ff7fd8' },
  ];
  PP.RES = {};
  PP.RESOURCES.forEach((r) => (PP.RES[r.id] = r));

  /* Asset value of each resource for Ascension Potential. */
  PP.AP_WEIGHT = { energy: 1, minerals: 2, compounds: 6, water: 6, biomass: 25, research: 60, civ: 800, exotic: 2e4 };

  // ---------------------------------------------------------------- Buildings
  // env(s, c) returns [factor, label] for a visible environmental efficiency factor.
  PP.BUILDINGS = [
    {
      id: 'solar', name: 'Solar Collector', cat: 'Energy',
      desc: 'Photovoltaic arrays. Clouds reduce their output.',
      cost: { energy: 10 }, growth: 1.12, prod: { energy: 1 },
      unlock: () => true,
      env: (s, c) => [1 - 0.45 * c.clouds / 100, 'Cloud cover'],
    },
    {
      id: 'extractor', name: 'Surface Extractor', cat: 'Industry',
      desc: 'Strip-mines the regolith. Mildly polluting.',
      cost: { energy: 15 }, growth: 1.13, prod: { minerals: 0.5 },
      emit: { poll: 0.04, ghg: 0.05 },
      unlock: () => true,
    },
    {
      id: 'geothermal', name: 'Geothermal Tap', cat: 'Energy',
      desc: 'Taps internal heat. Warms the planet and vents greenhouse gas.',
      cost: { energy: 120, minerals: 50 }, growth: 1.14, prod: { energy: 5 },
      emit: { ghg: 0.4, heat: 1 },
      unlock: (s) => s.life.minerals >= 30, req: 'Mine 30 minerals',
    },
    {
      id: 'processor', name: 'Atmospheric Processor', cat: 'Atmosphere',
      desc: 'Cracks rock into breathable gases. Builds pressure and greenhouse warming.',
      cost: { energy: 300, minerals: 150 }, growth: 1.15,
      cons: { energy: 2 }, prod: { compounds: 1 },
      emit: { ghg: 1.0, atmo: 1 },
      unlock: (s) => s.bld.geothermal >= 1, req: 'Build a Geothermal Tap',
    },
    {
      id: 'iceHarvester', name: 'Ice Harvester', cat: 'Hydrosphere',
      desc: 'Melts subsurface ice and releases it to the surface. Stronger on icy worlds.',
      cost: { minerals: 800, compounds: 120 }, growth: 1.17,
      cons: { energy: 5 }, prod: { water: 1 }, emit: { water: 1 },
      unlock: (s, c) => s.bld.processor > 0 && c.pressure >= 4, req: 'Atmospheric Processor and 4% pressure',
      trait: 'ice',
    },
    {
      id: 'deepMine', name: 'Deep Mine', cat: 'Industry',
      desc: 'Bores through the crust for rich ore veins.',
      cost: { energy: 8000, minerals: 4000 }, growth: 1.165,
      cons: { energy: 15 }, prod: { minerals: 18 }, emit: { poll: 0.25, ghg: 0.2 },
      unlock: (s) => !!s.research.r_deep, req: 'Research Deep Drilling',
    },
    {
      id: 'condenser', name: 'Vapor Condenser', cat: 'Hydrosphere',
      desc: 'Pulls moisture out of the air. Needs atmospheric pressure.',
      cost: { minerals: 1.2e4, compounds: 2500 }, growth: 1.18,
      cons: { energy: 30 }, prod: { water: 8 }, emit: { water: 1 },
      unlock: (s) => !!s.research.r_hydro, req: 'Research Hydrology',
      env: (s, c) => [0.1 + 0.9 * S(5, 50, c.pressure), 'Pressure'],
    },
    {
      id: 'bioseed', name: 'Bioseed Laboratory', cat: 'Biosphere',
      desc: 'Engineers microbes for the young oceans. Produces biomass and research.',
      cost: { minerals: 8000, water: 1500 }, growth: 1.19,
      cons: { energy: 60 }, prod: { biomass: 1, research: 0.6 }, emit: { bio: 1 },
      unlock: (s, c) => c.lifeHab >= 12 || s.bld.bioseed > 0, req: 'Life habitability 12%',
      env: (s, c) => [0.05 + 0.95 * c.lifeHab / 100, 'Habitability'],
    },
    {
      id: 'observatory', name: 'Research Observatory', cat: 'Science',
      desc: 'Studies the planet and the sky above it.',
      cost: { minerals: 1e5, energy: 1e5 }, growth: 1.2,
      cons: { energy: 250 }, prod: { research: 6 },
      unlock: (s) => !!s.research.r_observe, req: 'Research Planetary Science',
      env: (s, c) => [1 - 0.35 * c.clouds / 100, 'Clear skies'],
    },
    {
      id: 'fertilizer', name: 'Ocean Fertilizer', cat: 'Biosphere',
      desc: 'Seeds oceans with mineral nutrients. Scales with ocean coverage.',
      cost: { minerals: 6e5, biomass: 600 }, growth: 1.19,
      cons: { minerals: 40 }, prod: { biomass: 12 }, emit: { bio: 1 },
      unlock: (s) => !!s.research.r_microbe, req: 'Research Ocean Microbes',
      env: (s, c) => [S(0, 40, c.liquid) * (0.2 + 0.8 * c.lifeHab / 100), 'Ocean & habitability'],
    },
    {
      id: 'regulator', name: 'Climate Regulator', cat: 'Climate',
      desc: 'Steers temperature toward your setpoint and stabilises weather.',
      cost: { minerals: 2e6, energy: 3e6 }, growth: 1.22,
      cons: { energy: 1500 }, prod: {},
      unlock: (s) => !!s.research.r_climate, req: 'Research Climate Engineering',
    },
    {
      id: 'forest', name: 'Forest Cultivator', cat: 'Biosphere',
      desc: 'Plants forests across suitable land. Absorbs greenhouse gas and pollution.',
      cost: { biomass: 2.5e4, water: 2e5 }, growth: 1.2,
      cons: { water: 50 }, prod: { biomass: 220 }, emit: { ghg: -2.5, poll: -1, bio: 2 },
      unlock: (s) => !!s.research.r_multi, req: 'Research Multicellular Ecosystems',
      env: (s, c) => [0.05 + 0.95 * c.lifeHab / 100, 'Habitability'],
    },
    {
      id: 'settlement', name: 'Settlement', cat: 'Civilization',
      desc: 'Communities that grow into cities. Needs a healthy biosphere.',
      cost: { biomass: 1.5e5, minerals: 1.5e7 }, growth: 1.21,
      cons: { biomass: 300, energy: 2000 }, prod: { civ: 1, research: 120 }, emit: { poll: 1.6, ghg: 1.2, civ: 1 },
      unlock: (s, c) => !!s.research.r_habitats && c.bioHealth >= 25, req: 'Research Habitats and 25% biosphere health',
      env: (s, c) => [0.1 + 0.9 * c.bioHealth / 100, 'Biosphere health'],
    },
    {
      id: 'fusion', name: 'Fusion Complex', cat: 'Energy',
      desc: 'Star-fire on the ground. Burns refined minerals.',
      cost: { minerals: 2e8, civ: 500 }, growth: 1.2,
      cons: { minerals: 5000 }, prod: { energy: 2e5 },
      unlock: (s) => !!s.research.r_fusion, req: 'Research Fusion Ignition',
    },
    {
      id: 'orbital', name: 'Orbital Platform', cat: 'Civilization',
      desc: 'Stations in orbit. Bridges the surface and space economy.',
      cost: { civ: 4e4, energy: 5e11 }, growth: 1.25,
      cons: { energy: 1e6 }, prod: { research: 2e4, exotic: 0.05 },
      unlock: (s) => !!s.research.r_orbital, req: 'Research Orbital Civilization',
    },
  ];
  PP.BLD = {};
  PP.BUILDINGS.forEach((b) => (PP.BLD[b.id] = b));
  PP.BUILDING_CATS = ['Energy', 'Industry', 'Atmosphere', 'Hydrosphere', 'Biosphere', 'Science', 'Climate', 'Civilization'];

  // ------------------------------------------------------------- Research
  // Effects:
  //  {t:'bld', id, x}  building production multiplier
  //  {t:'res', id, x}  resource production multiplier
  //  {t:'cons', id, x} consumption of resource multiplier
  //  {t:'ghg', id?, x} greenhouse emission multiplier (building or all)
  //  {t:'poll', x}     pollution emission multiplier
  //  {t:'cost', id, x} building cost multiplier
  //  {t:'shield', v}   additive radiation shielding
  //  {t:'stab', v}     additive climate stability
  //  {t:'reg', x}      climate regulator power multiplier
  //  {t:'feature', id} unlock a feature (autobuy, autoresearch, directive, autoclaim)
  //  {t:'global', x}   all production
  PP.BRANCHES = ['Energy', 'Geology', 'Atmosphere', 'Hydrology', 'Life', 'Civilization', 'Cosmic', 'Automation'];

  PP.RESEARCH = [
    // Opening choice (exclusive pair)
    { id: 'r_solar1', br: 'Energy', name: 'Concentrated Solar', desc: 'Solar Collectors ×2.5.', cost: { energy: 250 }, req: [], excl: 'r_mine1', fx: [{ t: 'bld', id: 'solar', x: 2.5 }], choice: true },
    { id: 'r_mine1', br: 'Geology', name: 'Efficient Drills', desc: 'Surface Extractors ×2.5.', cost: { energy: 250 }, req: [], excl: 'r_solar1', fx: [{ t: 'bld', id: 'extractor', x: 2.5 }], choice: true },

    { id: 'r_gas', br: 'Atmosphere', name: 'Gas Processing', desc: 'Atmospheric Processors ×2.', cost: { energy: 2500, minerals: 1500 }, req: [], fx: [{ t: 'bld', id: 'processor', x: 2 }], vis: (s) => s.bld.processor > 0 },
    { id: 'r_geo1', br: 'Energy', name: 'Geothermal Regulation', desc: 'Geothermal Taps ×2.', cost: { energy: 4000, minerals: 3000 }, req: [], fx: [{ t: 'bld', id: 'geothermal', x: 2 }], vis: (s) => s.bld.geothermal > 0 },
    { id: 'r_hydro', br: 'Hydrology', name: 'Hydrology', desc: 'Unlocks the Vapor Condenser. Ice Harvesters ×1.5.', cost: { minerals: 6000, compounds: 800 }, req: [], fx: [{ t: 'bld', id: 'iceHarvester', x: 1.5 }], vis: (s) => s.bld.iceHarvester > 0 },
    { id: 'r_deep', br: 'Geology', name: 'Deep Drilling', desc: 'Unlocks the Deep Mine.', cost: { energy: 1.2e4, minerals: 6000 }, req: [], fx: [], vis: (s) => s.bld.processor > 0 },
    { id: 'r_auto1', br: 'Automation', name: 'Autonomous Fabricators', desc: 'Unlocks Auto-buy for buildings.', cost: { energy: 6e4, minerals: 3e4 }, req: ['r_deep'], fx: [{ t: 'feature', id: 'autobuy' }] },
    { id: 'r_grid', br: 'Energy', name: 'Smart Grid', desc: 'Energy consumption −30%.', cost: { energy: 3e4, minerals: 1.5e4 }, req: ['r_geo1'], fx: [{ t: 'cons', id: 'energy', x: 0.7 }] },
    { id: 'r_catalyst', br: 'Atmosphere', name: 'Greenhouse Catalysts', desc: 'Processors vent twice the greenhouse gas. Warms cold worlds faster.', cost: { compounds: 1500, energy: 8000 }, req: ['r_gas'], fx: [{ t: 'ghg', id: 'processor', x: 2 }] },

    // Life & research data era
    { id: 'r_microbe', br: 'Life', name: 'Ocean Microbes', desc: 'Bioseed Labs ×2. Unlocks the Ocean Fertilizer.', cost: { research: 40 }, req: [], fx: [{ t: 'bld', id: 'bioseed', x: 2 }], vis: (s) => s.bld.bioseed > 0, intro: 'biosphere' },
    { id: 'r_directive', br: 'Civilization', name: 'Planetary Directives', desc: 'Choose a specialization for this world (World tab).', cost: { research: 120 }, req: ['r_microbe'], fx: [{ t: 'feature', id: 'directive' }] },
    { id: 'r_synth', br: 'Geology', name: 'Mineral Synthesis', desc: 'All mineral production ×2.', cost: { research: 250 }, req: ['r_microbe'], fx: [{ t: 'res', id: 'minerals', x: 2 }] },
    { id: 'r_observe', br: 'Cosmic', name: 'Planetary Science', desc: 'Unlocks the Research Observatory.', cost: { research: 400 }, req: ['r_microbe'], fx: [] },
    { id: 'r_photo', br: 'Life', name: 'Photosynthesis', desc: 'Biomass ×2. Oxygen builds faster.', cost: { research: 900 }, req: ['r_microbe'], fx: [{ t: 'res', id: 'biomass', x: 2 }, { t: 'oxy', x: 2 }] },
    { id: 'r_lattice', br: 'Energy', name: 'Photonic Lattice', desc: 'Solar Collectors ×3, Geothermal ×2.', cost: { research: 3000 }, req: ['r_microbe'], fx: [{ t: 'bld', id: 'solar', x: 3 }, { t: 'bld', id: 'geothermal', x: 2 }] },
    { id: 'r_supercond', br: 'Energy', name: 'Superconductors', desc: 'All energy production ×4.', cost: { research: 6e4 }, req: ['r_lattice', 'r_grid'], fx: [{ t: 'res', id: 'energy', x: 4 }] },
    { id: 'r_comet', br: 'Hydrology', name: 'Cometary Capture', desc: 'Unlocks the Comet Redirect project.', cost: { research: 1500 }, req: ['r_hydro', 'r_microbe'], fx: [] },
    { id: 'r_ozone', br: 'Atmosphere', name: 'Ozone Shielding', desc: '+20 radiation shielding.', cost: { research: 2500 }, req: ['r_photo'], fx: [{ t: 'shield', v: 20 }] },
    { id: 'r_mantle', br: 'Geology', name: 'Mantle Taps', desc: 'Geothermal ×3, Deep Mines ×2.', cost: { research: 4000 }, req: ['r_synth', 'r_geo1'], fx: [{ t: 'bld', id: 'geothermal', x: 3 }, { t: 'bld', id: 'deepMine', x: 2 }] },
    { id: 'r_climate', br: 'Atmosphere', name: 'Climate Engineering', desc: 'Unlocks the Climate Regulator and the temperature setpoint.', cost: { research: 6000 }, req: ['r_ozone'], fx: [] },
    { id: 'r_clean', br: 'Atmosphere', name: 'Clean Processing', desc: 'All greenhouse emissions ×0.5, pollution ×0.6.', cost: { research: 9000 }, req: ['r_climate'], fx: [{ t: 'ghg', x: 0.5 }, { t: 'poll', x: 0.6 }] },
    { id: 'r_multi', br: 'Life', name: 'Multicellular Ecosystems', desc: 'Unlocks the Forest Cultivator.', cost: { research: 1.2e4 }, req: ['r_photo'], fx: [] },
    { id: 'r_auto2', br: 'Automation', name: 'Research Scheduler', desc: 'Unlocks Auto-research and auto-claiming milestones.', cost: { research: 2e4 }, req: ['r_auto1', 'r_observe'], fx: [{ t: 'feature', id: 'autoresearch' }, { t: 'feature', id: 'autoclaim' }] },
    { id: 'r_rivers', br: 'Hydrology', name: 'Atmospheric Rivers', desc: 'Water production ×3.', cost: { research: 3e4 }, req: ['r_comet'], fx: [{ t: 'res', id: 'water', x: 3 }] },
    { id: 'r_marine', br: 'Life', name: 'Marine Habitats', desc: 'Ocean Fertilizers ×3.', cost: { research: 5e4 }, req: ['r_multi'], fx: [{ t: 'bld', id: 'fertilizer', x: 3 }] },
    { id: 'r_habitats', br: 'Civilization', name: 'Habitats', desc: 'Unlocks Settlements (needs 25% biosphere health).', cost: { research: 8e4 }, req: ['r_multi'], fx: [] },
    { id: 'r_asteroid', br: 'Cosmic', name: 'Asteroid Imports', desc: 'Minerals ×3.', cost: { research: 1.5e5 }, req: ['r_observe', 'r_mantle'], fx: [{ t: 'res', id: 'minerals', x: 3 }] },
    { id: 'r_weather', br: 'Atmosphere', name: 'Weather Control', desc: 'Regulator power ×3, +15 stability.', cost: { research: 2.5e5 }, req: ['r_clean'], fx: [{ t: 'reg', x: 3 }, { t: 'stab', v: 15 }] },
    { id: 'r_cities', br: 'Civilization', name: 'Cities', desc: 'Settlements ×3.', cost: { research: 6e5 }, req: ['r_habitats'], fx: [{ t: 'bld', id: 'settlement', x: 3 }] },
    { id: 'r_biosphere', br: 'Life', name: 'Planetary Biosphere', desc: 'Biomass ×4, +10 stability.', cost: { research: 1.2e6 }, req: ['r_marine'], fx: [{ t: 'res', id: 'biomass', x: 4 }, { t: 'stab', v: 10 }] },
    { id: 'r_fusion', br: 'Energy', name: 'Fusion Ignition', desc: 'Unlocks the Fusion Complex.', cost: { research: 2e6 }, req: ['r_cities'], fx: [] },
    { id: 'r_network', br: 'Civilization', name: 'Research Networks', desc: 'All research ×3.', cost: { research: 4e6 }, req: ['r_cities'], fx: [{ t: 'res', id: 'research', x: 3 }] },
    { id: 'r_waterreg', br: 'Hydrology', name: 'Planetary Water Regulation', desc: 'Water ×5.', cost: { research: 6e6 }, req: ['r_rivers', 'r_weather'], fx: [{ t: 'res', id: 'water', x: 5 }] },
    { id: 'r_tectonic', br: 'Geology', name: 'Tectonic Control', desc: 'Minerals ×4, +10 stability.', cost: { research: 1e7 }, req: ['r_asteroid'], fx: [{ t: 'res', id: 'minerals', x: 4 }, { t: 'stab', v: 10 }] },
    { id: 'r_orbital', br: 'Cosmic', name: 'Orbital Civilization', desc: 'Unlocks the Orbital Platform.', cost: { research: 2.5e7 }, req: ['r_fusion', 'r_network'], fx: [] },
    { id: 'r_ecocity', br: 'Civilization', name: 'Arcology Design', desc: 'Settlement pollution ×0.3, Settlements ×2.', cost: { research: 6e7 }, req: ['r_orbital'], fx: [{ t: 'pollb', id: 'settlement', x: 0.3 }, { t: 'bld', id: 'settlement', x: 2 }] },
    { id: 'r_orbpower', br: 'Energy', name: 'Orbital Power Relays', desc: 'Solar ×10, Fusion ×3.', cost: { research: 1.5e8 }, req: ['r_orbital'], fx: [{ t: 'bld', id: 'solar', x: 10 }, { t: 'bld', id: 'fusion', x: 3 }] },
    { id: 'r_satellite', br: 'Cosmic', name: 'Satellite Network', desc: 'Orbital Platforms ×3, all research ×2.', cost: { research: 5e8 }, req: ['r_orbital'], fx: [{ t: 'bld', id: 'orbital', x: 3 }, { t: 'res', id: 'research', x: 2 }] },
    { id: 'r_space', br: 'Cosmic', name: 'Space Industry', desc: 'Exotic matter ×5. Unlocks the Space Elevator.', cost: { research: 2e9 }, req: ['r_satellite'], fx: [{ t: 'res', id: 'exotic', x: 5 }] },
    { id: 'r_mind', br: 'Civilization', name: 'Planetary Mind', desc: 'Civilization ×5, all production ×2.', cost: { research: 1e10, exotic: 500 }, req: ['r_space'], fx: [{ t: 'res', id: 'civ', x: 5 }, { t: 'global', x: 2 }] },
  ];
  PP.RSR = {};
  PP.RESEARCH.forEach((r) => (PP.RSR[r.id] = r));

  // ------------------------------------------------------------- Projects
  PP.PROJECTS = [
    { id: 'p_comet', name: 'Comet Redirect', desc: 'Steer an icy comet into the planet. A huge one-time water delivery.', cost: { energy: 2e6, minerals: 1e6 }, req: (s) => !!s.research.r_comet, reqText: 'Research Cometary Capture', fx: [{ t: 'water', v: 0.6 }] },
    { id: 'p_panspermia', name: 'Panspermia Seeding', desc: 'Scatter hardy spores across every shore. Jump-starts vegetation.', cost: { water: 5e5, biomass: 5e3 }, req: (s) => !!s.research.r_photo, reqText: 'Research Photosynthesis', fx: [{ t: 'bio', v: 0.4 }] },
    { id: 'p_lances', name: 'Thermal Lances', desc: 'Orbital lasers heat the crust. Permanently +12 °C. Can be toggled.', cost: { energy: 5e7, minerals: 2e7 }, req: (s) => !!s.research.r_mantle, reqText: 'Research Mantle Taps', fx: [{ t: 'heat', v: 12 }], toggle: true },
    { id: 'p_sunshade', name: 'Orbital Sunshade', desc: 'A vast mirror film in orbit. −15 °C while deployed. Can be toggled.', cost: { energy: 1e8, minerals: 5e7 }, req: (s) => !!s.research.r_climate, reqText: 'Research Climate Engineering', fx: [{ t: 'heat', v: -15 }], toggle: true },
    { id: 'p_magnet', name: 'Magnetic Shield', desc: 'A planetary dynamo restarted. +35 radiation shielding.', cost: { minerals: 3e9, energy: 5e9 }, req: (s) => !!s.research.r_ozone && s.bld.observatory > 0, reqText: 'Ozone Shielding and an Observatory', fx: [{ t: 'shield', v: 35 }] },
    { id: 'p_weathernet', name: 'Global Weather Network', desc: 'Satellite-guided rainfall. +20 stability, water ×2.', cost: { research: 5e5, minerals: 5e10 }, req: (s) => !!s.research.r_weather, reqText: 'Research Weather Control', fx: [{ t: 'stab', v: 20 }, { t: 'res', id: 'water', x: 2 }] },
    { id: 'p_ring', name: 'Orbital Ring', desc: 'A band of industry around the world. Research ×3, exotic matter ×3.', cost: { exotic: 80, minerals: 1e14 }, req: (s) => s.bld.orbital >= 5, reqText: '5 Orbital Platforms', fx: [{ t: 'res', id: 'research', x: 3 }, { t: 'res', id: 'exotic', x: 3 }] },
    { id: 'p_elevator', name: 'Space Elevator', desc: 'Cheap lift to orbit. Civilization ×3, Orbital Platforms ×3.', cost: { exotic: 800, civ: 5e7 }, req: (s) => !!s.research.r_space, reqText: 'Research Space Industry', fx: [{ t: 'res', id: 'civ', x: 3 }, { t: 'bld', id: 'orbital', x: 3 }] },
  ];
  PP.PRJ = {};
  PP.PROJECTS.forEach((p) => (PP.PRJ[p.id] = p));

  // ------------------------------------------------------------- Directives
  PP.DIRECTIVES = [
    {
      id: 'ocean', name: 'Ocean World', color: '#3fa8ff',
      adv: 'Water ×2, biomass ×2, Ocean Fertilizers ×2', cost: 'Minerals ×0.75',
      fx: [{ t: 'res', id: 'water', x: 2 }, { t: 'res', id: 'biomass', x: 2 }, { t: 'bld', id: 'fertilizer', x: 2 }, { t: 'res', id: 'minerals', x: 0.75 }],
      goal: 'Oceans cover 80%, biosphere health 60%, 60 Ocean Fertilizers',
      done: (s, c) => c.liquid >= 80 && c.bioHealth >= 60 && s.bld.fertilizer >= 60,
      prog: (s, c) => Math.min(c.liquid / 80, c.bioHealth / 60, s.bld.fertilizer / 60),
    },
    {
      id: 'volcanic', name: 'Volcanic World', color: '#ff6a3d',
      adv: 'Energy ×2, Geothermal ×3, minerals ×1.5', cost: 'Greenhouse ×1.5, stability −15',
      fx: [{ t: 'res', id: 'energy', x: 2 }, { t: 'bld', id: 'geothermal', x: 3 }, { t: 'res', id: 'minerals', x: 1.5 }, { t: 'ghg', x: 1.5 }, { t: 'stab', v: -15 }],
      goal: '250 Geothermal Taps, temperature ≥ 35 °C, 15 Settlements',
      done: (s, c) => s.bld.geothermal >= 250 && c.temp >= 35 && s.bld.settlement >= 15,
      prog: (s, c) => Math.min(s.bld.geothermal / 250, Math.max(0, c.temp) / 35, s.bld.settlement / 15),
    },
    {
      id: 'frozen', name: 'Frozen World', color: '#bfe6ff',
      adv: 'Research ×2, water ×1.5, cold-adapted life (comfort band −15 °C)', cost: 'Biomass ×0.6',
      fx: [{ t: 'res', id: 'research', x: 2 }, { t: 'res', id: 'water', x: 1.5 }, { t: 'res', id: 'biomass', x: 0.6 }, { t: 'cold', v: 15 }],
      goal: 'Ice covers 30%, 120 Observatories, 10 Settlements',
      done: (s, c) => c.ice >= 30 && s.bld.observatory >= 120 && s.bld.settlement >= 10,
      prog: (s, c) => Math.min(c.ice / 30, s.bld.observatory / 120, s.bld.settlement / 10),
    },
    {
      id: 'garden', name: 'Garden World', color: '#5fe07a',
      adv: 'Biomass ×2.5, civilization ×1.5', cost: 'Water consumption ×1.5',
      fx: [{ t: 'res', id: 'biomass', x: 2.5 }, { t: 'res', id: 'civ', x: 1.5 }, { t: 'cons', id: 'water', x: 1.5 }],
      goal: 'Vegetation 55%, biosphere health 75%, 30 Settlements',
      done: (s, c) => c.veg >= 55 && c.bioHealth >= 75 && s.bld.settlement >= 30,
      prog: (s, c) => Math.min(c.veg / 55, c.bioHealth / 75, s.bld.settlement / 30),
    },
    {
      id: 'industrial', name: 'Industrial World', color: '#ffb84d',
      adv: 'Minerals ×2.5, civilization ×1.5, Deep Mines ×2', cost: 'Pollution ×2',
      fx: [{ t: 'res', id: 'minerals', x: 2.5 }, { t: 'res', id: 'civ', x: 1.5 }, { t: 'bld', id: 'deepMine', x: 2 }, { t: 'poll', x: 2 }],
      goal: 'Civilization level 45%, 200 Deep Mines, 5 Orbital Platforms',
      done: (s, c) => c.civLevel >= 45 && s.bld.deepMine >= 200 && s.bld.orbital >= 5,
      prog: (s, c) => Math.min(c.civLevel / 45, s.bld.deepMine / 200, s.bld.orbital / 5),
    },
    {
      id: 'desert', name: 'Desert World', color: '#e0a960',
      adv: 'Solar ×4, research ×1.4, rare sands (minerals ×1.3)', cost: 'Water ×0.6',
      fx: [{ t: 'bld', id: 'solar', x: 4 }, { t: 'res', id: 'research', x: 1.4 }, { t: 'res', id: 'minerals', x: 1.3 }, { t: 'res', id: 'water', x: 0.6 }],
      goal: '400 Solar Collectors, oceans ≤ 35%, civilization level 30%',
      done: (s, c) => s.bld.solar >= 400 && c.liquid <= 35 && c.civLevel >= 30,
      prog: (s, c) => Math.min(s.bld.solar / 400, c.liquid <= 35 ? 1 : 35 / c.liquid, c.civLevel / 30),
    },
  ];
  PP.DIR = {};
  PP.DIRECTIVES.forEach((d) => (PP.DIR[d.id] = d));

  /* Universal ascension route available to every world. */
  PP.CIV_GOAL = {
    goal: 'Civilization level 50% with biosphere health 50%',
    done: (s, c) => c.civLevel >= 50 && c.bioHealth >= 50,
    prog: (s, c) => Math.min(c.civLevel / 50, c.bioHealth / 50),
  };

  // ------------------------------------------------------------- Milestones (per world, claimable)
  PP.MILESTONES = [
    { id: 'm_glow', name: 'First Atmospheric Glow', text: 'A faint halo now clings to the horizon.', cond: (s, c) => s.bld.processor > 0 && c.pressure >= 3, fx: [{ t: 'res', id: 'energy', x: 1.25 }], reward: 'Energy ×1.25' },
    { id: 'm_thick', name: 'Breathable Pressure', text: 'The sky has weight. Dust storms give way to wind.', cond: (s, c) => c.pressure >= 35, fx: [{ t: 'bld', id: 'processor', x: 1.5 }], reward: 'Processors ×1.5' },
    { id: 'm_thaw', name: 'The Great Thaw', text: 'The surface rises above freezing for the first time.', cond: (s, c) => c.temp >= 0, fx: [{ t: 'res', id: 'water', x: 1.5 }], reward: 'Water ×1.5' },
    { id: 'm_ocean', name: 'First Ocean', text: 'Meltwater pools in the deepest basin.', cond: (s, c) => c.liquid >= 2, fx: [{ t: 'res', id: 'minerals', x: 1.5 }], reward: 'Minerals ×1.5' },
    { id: 'm_rain', name: 'First Rainstorm', text: 'Clouds gather and rain falls on barren continents.', cond: (s, c) => c.clouds >= 12 && c.liquid >= 5, fx: [{ t: 'res', id: 'water', x: 1.5 }], reward: 'Water ×1.5' },
    { id: 'm_green', name: 'First Green', text: 'A smear of algae colours the shallows.', cond: (s, c) => c.veg >= 1, fx: [{ t: 'res', id: 'research', x: 1.5 }], reward: 'Research ×1.5' },
    { id: 'm_seas', name: 'Open Seas', text: 'A quarter of the world is now ocean.', cond: (s, c) => c.liquid >= 25, fx: [{ t: 'res', id: 'biomass', x: 1.5 }], reward: 'Biomass ×1.5' },
    { id: 'm_temperate', name: 'Temperate Climate', text: 'Average temperature settles into the comfort band.', cond: (s, c) => c.temp >= 10 && c.temp <= 28 && c.pressure >= 20, fx: [{ t: 'global', x: 1.2 }], reward: 'All production ×1.2' },
    { id: 'm_biosphere', name: 'Self-Sustaining Biosphere', text: 'Life now regulates the air on its own.', cond: (s, c) => c.bioHealth >= 50, fx: [{ t: 'res', id: 'biomass', x: 2 }], reward: 'Biomass ×2' },
    { id: 'm_lights', name: 'First Lights', text: 'Settlement lights flicker on the night side.', cond: (s, c) => c.civLevel >= 1, fx: [{ t: 'res', id: 'civ', x: 1.5 }], reward: 'Civilization ×1.5' },
    { id: 'm_cities', name: 'A World of Cities', text: 'Cities trace every coastline.', cond: (s, c) => c.civLevel >= 30, fx: [{ t: 'res', id: 'research', x: 2 }], reward: 'Research ×2' },
    { id: 'm_orbit', name: 'Reaching Orbit', text: 'The first station rises above the clouds.', cond: (s) => s.bld.orbital >= 1, fx: [{ t: 'res', id: 'exotic', x: 2 }], reward: 'Exotic ×2' },
    { id: 'm_ring', name: 'Ring World', text: 'A band of light now circles the planet.', cond: (s) => !!s.projects.p_ring, fx: [{ t: 'global', x: 1.5 }], reward: 'All production ×1.5' },
  ];
  PP.MIL = {};
  PP.MILESTONES.forEach((m) => (PP.MIL[m.id] = m));

  // Building count milestones (automatic multipliers)
  PP.countMult = function (n) {
    let m = 1;
    if (n >= 10) m *= 1.5;
    const steps = [25, 50, 100, 150, 200, 250, 300];
    for (const t of steps) if (n >= t) m *= 2;
    if (n >= 400) m *= Math.pow(2, Math.floor((n - 300) / 100));
    return m;
  };
  PP.nextCountMilestone = function (n) {
    const steps = [10, 25, 50, 100, 150, 200, 250, 300];
    for (const t of steps) if (n < t) return t;
    return Math.max(400, Math.ceil((n + 1) / 100) * 100);
  };

  // ------------------------------------------------------------- Discoveries (permanent, account-wide)
  PP.DISCOVERIES = [
    { id: 'd_first', name: 'Genesis', text: 'Reach first green on any world.', cond: (s, c) => c.veg >= 1 },
    { id: 'd_waterworld', name: 'Water World', text: 'Oceans cover 85% of a world.', cond: (s, c) => c.liquid >= 85 },
    { id: 'd_snowball', name: 'Snowball', text: 'Ice covers 50% of a world.', cond: (s, c) => c.ice >= 50 },
    { id: 'd_inferno', name: 'Inferno', text: 'Reach an average temperature of 80 °C.', cond: (s, c) => c.temp >= 80 },
    { id: 'd_eden', name: 'Eden', text: 'Biosphere health 90%.', cond: (s, c) => c.bioHealth >= 90 },
    { id: 'd_megacity', name: 'Ecumenopolis', text: 'Civilization level 80%.', cond: (s, c) => c.civLevel >= 80 },
    { id: 'd_clean', name: 'Pristine Skies', text: 'Civilization 20% with pollution under 10%.', cond: (s, c) => c.civLevel >= 20 && c.pollution < 10 },
    { id: 'd_dry', name: 'Dune Sea', text: 'Civilization 10% with oceans under 15%.', cond: (s, c) => c.civLevel >= 10 && c.liquid < 15 },
    { id: 'd_ring', name: 'Ringmaker', text: 'Build an Orbital Ring.', cond: (s) => !!s.projects.p_ring },
  ];
  PP.DISC_BONUS = 0.03; // +3% all production per discovery

  // ------------------------------------------------------------- Prestige upgrades (World Seeds)
  // cost(level) = base * scale^level
  PP.UPGRADES = [
    { id: 'u_industry', name: 'Seeded Industry', desc: 'All production ×1.5 per level (multiplicative).', base: 1, scale: 2.2, max: 50 },
    { id: 'u_capital', name: 'Starting Capital', desc: 'Begin new worlds with 5k energy and 2k minerals ×10 per level.', base: 1, scale: 3, max: 6 },
    { id: 'u_auto', name: 'Inherited Fabricators', desc: 'Auto-buy available from the start of every world.', base: 3, scale: 1, max: 1 },
    { id: 'u_atmo', name: 'Atmospheric Memory', desc: 'New worlds start with +8% atmospheric pressure per level.', base: 2, scale: 2.5, max: 5 },
    { id: 'u_hydro', name: 'Hydrological Memory', desc: 'New worlds start with +6% water per level.', base: 2, scale: 2.5, max: 5 },
    { id: 'u_inertia', name: 'Rapid Climate Response', desc: 'Climate changes 25% faster per level.', base: 2, scale: 2.5, max: 4 },
    { id: 'u_research', name: 'Archived Knowledge', desc: 'Research ×2 per level.', base: 2, scale: 2.4, max: 20 },
    { id: 'u_cost', name: 'Cheap Foundations', desc: 'Building costs −6% per level.', base: 3, scale: 2.6, max: 8 },
    { id: 'u_offline', name: 'Dreaming Machines', desc: 'Offline progress cap +12 hours per level.', base: 2, scale: 2, max: 6 },
    { id: 'u_archive', name: 'Archive Resonance', desc: 'Legacy world bonus ×2 per level.', base: 4, scale: 3, max: 5 },
    { id: 'u_harvest', name: 'Greater Harvest', desc: '+15% World Seeds from ascension per level.', base: 5, scale: 2.5, max: 10 },
    { id: 'u_cartography', name: 'Seed Cartography', desc: 'Choose from 3 candidate worlds when ascending (and reroll once).', base: 4, scale: 1, max: 1 },
    { id: 'u_autoresearch', name: 'Scheduler Imprint', desc: 'Auto-research and auto-claim available from the start.', base: 8, scale: 1, max: 1 },
  ];
  PP.UPG = {};
  PP.UPGRADES.forEach((u) => (PP.UPG[u.id] = u));
  PP.upgradeCost = (u, lvl) => Math.ceil(u.base * Math.pow(u.scale, lvl));
  PP.SEED_BONUS = 0.04; // each unspent World Seed: +4% production
})(globalThis.PP = globalThis.PP || {});
