# POCKET PLANET
## Complete Game Design & Development Blueprint

**Genre:** Idle/incremental game, planetary terraforming, visually driven sandbox simulation  
**Primary platform:** Android phones and handhelds, with desktop/web ports possible  
**Orientation:** Portrait-first; landscape supported where practical  
**Business model assumption:** Premium or free without mandatory ads, energy limits, or pay-to-win mechanics  
**Document status:** Standalone design blueprint. All numbers marked *initial balance targets* should be tuned through playtesting.

---

## 1. Elevator Pitch

Begin with a barren, slowly rotating planetoid. Produce energy, mine minerals, build atmospheric processors, melt ice, cultivate oceans, and nurture an entire living world. Every meaningful upgrade changes both the underlying production systems and the appearance of the planet. Eventually, civilizations arise, orbital industry develops, and a completed world can be **ascended** into a permanent collection, contributing knowledge and resources to future planets. Later progression expands from single planets to star systems and beyond.

The fantasy is **turning nothing into a living, technologically advanced world**, then scaling that accomplishment across the cosmos.

This is fundamentally a **planet-management incremental**, not a detailed individual-species evolution simulator. Biology should be meaningful without duplicating the focus of a separate evolution game.

### Key promise

When the player opens the game after several hours, they should see more than a larger currency total: coastlines have expanded, clouds have formed, forests have spread, city lights have appeared, or a ring of orbital structures now surrounds their world.

---

## 2. Design Pillars

1. **A world that visibly grows.** Planet appearance must respond to simulation state, not merely change at fixed level thresholds.
2. **A satisfying incremental economy.** Generators, multiplicative upgrades, milestone bonuses, research, automation, prestige, and very large numbers.
3. **Approachable environmental strategy.** Interdependent atmosphere, water, temperature, and life systems with understandable feedback and recoverable setbacks.
4. **Meaningful specialization.** Ocean, volcanic, ice, garden, industrial, and other worlds can become powerful in different ways. A single mandatory Earth-like build is not the goal.
5. **Generous idle progression.** The game makes progress while closed, never requires constant tapping, and eventually automates repetitive tasks.
6. **A long arc of discovery.** New systems arrive gradually rather than presenting dozens of inaccessible buttons on day one.

### Desired feel

Calm, atmospheric, slightly mysterious, and rewarding. Watching your planet should feel almost like tending a terrarium, except the terrarium eventually gets orbital elevators.

---

## 3. Core Gameplay Loop

**Short loop (seconds to minutes):**

1. Collect continuously generated energy, minerals, and later advanced resources.
2. Purchase production buildings or bulk upgrades.
3. Allocate power and material toward terraforming projects.
4. Watch physical changes appear on the planet.
5. Claim research discoveries and milestone rewards.

**Medium loop (minutes to hours):**

1. Reach conditions for a new environmental layer: atmosphere, surface water, primitive life, forests, etc.
2. Unlock a new factory, research branch, or planetary project.
3. Resolve a bottleneck, such as insufficient power for atmospheric processing.
4. Improve automation and exploit beneficial synergies.
5. Decide which type of planet to specialize in.

**Long loop (days to weeks):**

1. Develop a complete world and unlock civilization/orbital systems.
2. Achieve planetary objectives to earn **Ascension Potential**.
3. Ascend the planet, receiving permanent **World Seeds** and a legacy world.
4. Begin a new planet with inherited technology and selectable starting conditions.
5. Eventually manage multiple archived worlds, star-system infrastructure, and cosmic research.

**Target session cadence:** 2–10 minutes for routine visits, with optional 15–30-minute sessions when major systems unlock.

---

## 4. Opening Experience: First 30 Minutes

### Minute 0–2: The first spark

- Show a small gray rotating planet with craters, faint sunlight, and an empty atmosphere.
- Display only **Energy**, **Minerals**, and two purchase buttons: `Solar Collector` and `Surface Extractor`.
- Start the player with one collector and enough currency for the first extractor.
- Buying the first extractor immediately creates a visible installation and subtle excavation lights.
- The player learns: buy generators -> income rises -> buy upgrades.

### Minute 2–5: Heat and the atmosphere

- Unlock `Geothermal Tap` and `Atmospheric Processor`.
- Introduce a compact **Planet Status** card: Temperature, Pressure, Surface Water.
- The first processor adds a thin visible atmospheric rim around the globe.
- Unlock a single research choice, such as cheaper extractors versus stronger solar collection.

### Minute 5–12: Water begins

- Unlock `Ice Harvester`, `Vapor Injector`, and `Hydrology`.
- Planet cracks, polar ice appears, or low-lying basins gradually fill with water, depending on its seed.
- Introduce useful trade-offs: more heat accelerates ice melt but may reduce long-term water retention.
- Make the world visibly bluer within the first real play session.

### Minute 12–20: Primitive life

- Once water, temperature, and atmospheric stability thresholds are reached, unlock `Bioseed Laboratory`.
- Algae appears as subtle green patches in oceans.
- **Biomass** becomes a resource; atmospheric oxygen production becomes automatic.
- Introduce research milestones and an `Auto-buy` preview, with basic automation unlockable reasonably early.

### Minute 20–30: First major choice

- Unlock `Planetary Directive`, a reversible specialization preview: `Oceanic`, `Geothermal`, or `Biosphere`.
- Offer a significant choice of how to direct research rather than permanently trapping the player.
- Show the longer-term goal: `Develop a self-sustaining biosphere` followed by `Establish civilization`.
- Provide one achievable long-term objective and a clear next milestone.

**Opening acceptance test:** Within 30 minutes, a new player should have a noticeably altered planet, at least three interacting resource generators, one research decision, and one medium-term goal.

---

## 5. Primary Resources and Systems

Keep the early game to a few visible currencies. Hide locked systems until they become relevant.

| Resource | Source | Main use | Unlock phase |
|---|---|---|---|
| Energy | Solar collectors, geothermal taps, fusion, orbital power | Powers machines and projects | Start |
| Minerals | Surface extractors, deep mines, asteroid imports | Construction and material upgrades | Start |
| Atmospheric Compounds | Processors, chemical synthesis, volcanic vents | Air pressure and atmosphere engineering | Early |
| Water | Ice harvesting, import, vapor condensation | Oceans, weather, biology | Early |
| Biomass | Algae, forests, farms, marine habitats | Life research, biological production | Mid |
| Research Data | Laboratories and planetary discoveries | Technology tree | Mid |
| Civilization Output | Settlements, industry, knowledge networks | Advanced infrastructure | Late |
| Exotic Matter | Orbital industry, interplanetary missions | High-end planetary technologies | Late |
| World Seeds | Planet ascension | Permanent prestige upgrades | Prestige |
| Stellar Insight | Advanced multi-world objectives | Star-system upgrades | Post-MVP |

### Five interacting planetary layers

**1. Geology:** Surface minerals, tectonic energy, volcanism, geothermal heat. Geology enables the industrial base and influences temperature.

**2. Atmosphere:** Pressure, atmospheric chemistry, greenhouse effect, radiation protection. Too little pressure blocks oceans; too much greenhouse heating hurts some ecosystems.

**3. Hydrosphere:** Ice, liquid water, clouds, rainfall. Water coverage influences temperature, albedo, humidity, and life.

**4. Biosphere:** Microbial mats, oceanic life, forests, balanced ecosystems. The biosphere produces biomass and oxygen and can stabilize the climate.

**5. Civilization:** Small settlements, expanding cities, global infrastructure, orbital technology. Civilization generates advanced output but creates controllable ecological pressures.

The player should understand the dependency chain without having to study real atmospheric chemistry.

---

## 6. Planet Simulation: Readable, Not Needlessly Realistic

Use a **game-readable approximation** of climate rather than a high-fidelity physics solver.

Maintain normalized values in [0, 100] for:

- `AtmosphericPressure`
- `GreenhouseIntensity`
- `AverageTemperatureSuitability`
- `LiquidWaterCoverage`
- `BiosphereHealth`
- `Pollution`
- `RadiationShielding`
- `ClimateStability`

Also track temperature in an intuitive unit for presentation, such as degrees Celsius, derived from an internal normalized target.

### Example climate calculation (tunable)

- `targetTemperature = baseTemperature + greenhouseBonus + geothermalBonus - coolingTech - cloudCooling`
- `actualTemperature += (targetTemperature - actualTemperature) * min(1, dt / thermalInertiaSeconds)`
- `waterHabitability = pressureFactor * temperatureFactor * availableWaterFactor`
- `lifeHabitability = waterHabitability * atmosphereFactor * radiationFactor * pollutionFactor`
- Use smooth curves with forgiving plateaus instead of on/off thresholds.

An illustrative temperature factor might be 100% between 10–28 °C, smoothly declining toward 0% at extreme values. This is a gameplay convenience, **not** a universal scientific claim.

### Resilience rules

- Environmental mistakes reduce production or slow development; they do not irreversibly destroy progress.
- Once unlocked, emergency climate controls offer recovery options.
- A planet can deliberately specialize as hot, cold, or oceanic without being treated as a failure.
- Offline calculations should avoid a sudden catastrophic ecosystem collapse while the user is away.
- Present clear tooltips explaining why an indicator is low and which purchase could improve it.

### World seeds

Each new world has deterministic seeded traits: radius, gravity, mineral richness, initial temperature, ice content, tectonic activity, and atmosphere remnants. These offer variety and encourage different specializations. Seed bonuses and penalties must be balanced so no seed is a dead end.

---

## 7. Building and Upgrade Design

### Building categories

| Building | Produces / does | Interesting connection |
|---|---|---|
| Solar Collector | Energy | Improved by low cloud coverage and orbital tech |
| Surface Extractor | Minerals | Creates modest heat/pollution until upgraded |
| Geothermal Tap | Energy + heat | Boosted on volcanic worlds |
| Atmospheric Processor | Atmospheric compounds | Consumes energy and minerals |
| Ice Harvester | Water | Stronger on icy worlds |
| Vapor Condenser | Water | Benefits from pressure/humidity |
| Ocean Fertilizer | Biomass | Depends on water and mineral nutrients |
| Bioseed Laboratory | Biological growth + research | Stronger with favorable habitability |
| Forest Cultivator | Biomass + carbon cycling | Requires suitable terrain |
| Climate Regulator | Stabilizes conditions | Consumes energy for resilience |
| Research Observatory | Research Data | More effective with discoveries |
| Settlement | Civilization Output | Grows with biosphere and infrastructure |
| Fusion Complex | Major energy | Consumes advanced materials |
| Orbital Platform | Research + logistics | Bridges surface and space economy |
| Dyson Collector | Massive energy | Post-planet / star-system progression |

### Basic building costs

Use a geometric cost curve initially:

`cost(n) = baseCost * costGrowth^n`

For example, `Solar Collector`: base cost 10 Energy, growth 1.14. Introduce bulk purchasing (`x1`, `x10`, `x100`, `MAX`) and milestone bonuses at building counts 10, 25, 50, 100, 250, etc. Special generators can have steeper cost curves.

### Production formula

`production = baseRate * count * levelMultiplier * researchMultiplier * worldMultiplier * synergyMultiplier * prestigeMultiplier`

Apply bottlenecks as separate, visible efficiency factors rather than silently withholding resources.

**Important:** Large-number growth should be achievable through unlocks and synergies, not merely exponentially increasing costs. The game should eventually support scientific notation and numbers far beyond 64-bit floating-point ranges.

### Upgrade types

- **Repeatable upgrades:** +production, reduced costs, greater capacity.
- **Threshold upgrades:** At 25 atmospheric processors, unlock pressure recirculation.
- **Research nodes:** New strategies, systems, and efficiency links.
- **Planetary projects:** Expensive, visible, transformative investments, like oceans, a magnetic shield, continent shaping, and orbital rings.
- **Automation upgrades:** Purchase policies, research queues, project allocation, and climate stabilization.

---

## 8. Research Tree

Build a **branching but readable** technology web with gated tiers.

**Energy:** Better solar cells -> geothermal regulation -> fusion -> orbital power -> stellar capture.

**Geology:** Deep drilling -> mineral synthesis -> mantle taps -> tectonic control -> planet-scale construction.

**Atmosphere:** Gas processing -> greenhouse tuning -> ozone shielding -> weather control -> climate engineering.

**Hydrology:** Ice extraction -> condensation -> oceans -> atmospheric rivers -> planetary water regulation.

**Life:** Ocean microbes -> photosynthesis -> multicellular ecosystems -> forests and marine habitats -> planetary biosphere.

**Civilization:** Habitats -> settlements -> cities -> research networks -> planetary automation -> orbital civilization.

**Cosmic:** Asteroid imports -> satellites -> space industry -> colony support -> interstellar engineering.

Some research should unlock entirely new interfaces. The first time `Ocean Biology` is researched, a new biosphere panel appears with a meaningful visual introduction.

---

## 9. Planet Specializations

The player unlocks directives that can be changed after a cooldown or modest cost.

| Directive | Main advantage | Trade-off | Visual identity |
|---|---|---|---|
| Ocean World | Strong biomass, water industries, aquatic research | Weaker surface mineral extraction | Mostly blue with scattered islands |
| Volcanic World | Heat, energy, rare minerals | Requires active climate stabilization | Lava fissures, ash belts, dark terrain |
| Frozen World | Cryogenic science, ice compounds, crystal mining | Slower baseline life growth | Ice caps, glaciers, pale atmosphere |
| Garden World | Biomass, biodiversity, civilization growth | High water and climate demands | Rich green continents, dense clouds |
| Industrial World | Machines, minerals, city production | Pollution management | City lights, industrial rings |
| Desert World | Solar power, atmospheric science, rare surface materials | Higher water demand | Ochre dunes, sparse oceans |

Important rule: specialization should **open new viable strategies**, not force one choice to be mathematically superior at every stage.

---

## 10. Planet Visualization and Graphics

The globe is the star of the experience.

### Rendering approach

A practical mobile solution is a low-poly or moderately tessellated 3D sphere (or a 2D sphere shader if necessary) with procedurally generated seeded surface textures. Avoid real-time simulations of millions of polygons or organisms.

Use several visual layers:

1. Terrain texture with elevation, rock color, crater masks, ice, and continents.
2. Water mask changing from ice/dry basins to oceans.
3. Vegetation mask growing across suitable land.
4. Transparent cloud sphere with animated cloud movement.
5. Atmosphere rim/lighting and restrained bloom.
6. Optional city-light emissive mask visible on the night side.
7. Orbiting satellites, stations, and late-game rings.

### Planet visual generation

- Generate 128×64 or 256×128 low-resolution planetary maps using seeded noise and simple region rules.
- Update environmental masks at meaningful intervals, not every frame.
- Smooth transitions between development stages over seconds/minutes.
- Permit drag-to-rotate and pinch-to-zoom with sensible camera limits.
- Keep visual landmarks deterministic within one planet's seed.
- Provide a low-effects mode: fewer clouds, reduced particles, capped shader quality.

### Emotional visual moments

- First atmospheric glow.
- First rainstorm over barren continents.
- First ocean spreading into a basin.
- First visible green vegetation patch.
- First settlement lights on the dark side.
- First orbital ring around a mature world.
- Ascension: the finished planet moves into a growing cosmic archive.

### Art direction

Polished, readable, slightly stylized-realistic science fiction. Dark space background, luminous atmosphere, attractive soft lighting, restrained effects, smooth transitions. The planet should look beautiful even if individual production facilities are represented by small icons instead of enormous 3D structures.

---

## 11. Mobile UI / Interaction

### Screen hierarchy

**Main Planet screen:** Dominant rotating globe, top resource strip, compact production summary, bottom navigation, next-goal card.

**Production:** Collapsible building categories, cost/production details, x1/x10/x100/MAX controls, clear affordability indicators.

**Research:** Branch tabs, current goal, queued research, unlocked milestone history.

**World:** Planet status, climate targets, directive selection, environmental projects.

**Archive:** Completed/ascended planets and permanent legacy bonuses.

**Settings/Stats:** Graphics, sound, accessibility, notation, autosave, import/export, prestige history, production breakdown.

### UX standards

- Designed for one-handed touch; large targets and limited tiny text.
- Resource bar can collapse when expanded UI panels are visible.
- Show a concise `Why is production low?` breakdown.
- One-tap claim for multiple completed milestones.
- Distinguish mandatory next action from optional optimization.
- Support both portrait and landscape without hiding buttons off-screen.
- Maintain legible text on 1080p+ Android phones and smaller handheld screens.
- Disable unnecessary continuous animations in battery saver mode.
- Accessibility: motion reduction, colorblind-safe status indicators, adjustable font sizes where feasible.

### Suggested text-only layout

```text
[Energy 4.2e12] [Minerals 8.7e9] [Research 1.2e4]

            [ ROTATING PLANET ]
              drag to rotate

Habitability 67%  Climate Stable 90%
Next: Unlock Forest Cultivator (72% Habitat)

[BUILDINGS] [RESEARCH] [WORLD] [ARCHIVE]

Quick Buy: Atmospheric Processor   [x10] [MAX]
Current: 28   Next cost: 6.3e7 Minerals
```

---

## 12. Prestige: Planetary Ascension

A mature planet can be **ascended**, converting its achievements into persistent progression without treating the world as if it were simply deleted.

### Eligibility examples

- Reach a civilization or equivalent specialization-specific milestone.
- Complete the primary planetary objective.
- Maintain a viable or stabilized world for a modest interval.
- Generate sufficient Ascension Potential from total lifetime production and achievements.

Alternative victory routes must exist for unusual world types; a volcanic world should not be forced to turn into a temperate garden before ascending.

### Rewards

**World Seeds:** Permanent prestige currency for account-level upgrades.  
**Legacy Planets:** Previously ascended worlds visible in the Archive and providing capped or scaled passive contributions.  
**Planetary Blueprints:** Inherited technologies that alter the next run.  
**Discovery Records:** Permanent milestones from special planet conditions.

### Example prestige calculation

`worldSeeds = floor((ascensionPotential / 1e9)^0.35 * (1 + distinctMilestones * 0.08))`

This is a balancing prototype, not a fixed final formula. Include clear preview of current and projected rewards and the time/value trade-off before resetting.

### Permanent upgrades

- Retain a fraction of base research at the start of each new planet.
- Unlock auto-buy and auto-project allocation earlier.
- Add a modest multiplier per distinct specialized legacy world.
- Increase initial habitable conditions for selected starting seeds.
- Unlock new world traits, weather patterns, resource sources, and research branches.
- Improve ascension rewards and archived-world production.

### Long-term prestige expansions

**Solar System Administration:** Run multiple worlds, arrange specialized production links, and construct a Dyson swarm.

**Galactic Ecology:** Establish interstellar supply chains and complete unique galaxy objectives.

**Universal Genesis:** In a very late expansion, retire a mature galaxy or universe to obtain a high-order reset currency. This is a *future feature*, not required for the first playable release.

---

## 13. Balance, Progression, and Idle Design

### Intended pacing (initial targets)

| Time played | Expected development |
|---|---|
| 0–5 minutes | Energy and minerals; barren planet visually begins changing |
| 5–30 minutes | Atmosphere, ice, first oceans, primitive life |
| 30–120 minutes | Research tree deepens, biosphere expands, automation begins |
| 2–8 hours | Advanced ecology, settlements, strong specialization |
| 1–3 days | Planet completion and first ascension for a moderately active player |
| 1–2 weeks | Multiple world specializations, substantial prestige builds |
| Months | Long-term archive, unusual seeds, star-system metagame |

These times assume offline progress and are not promises. A prototype should be playtested before locking them.

### Offline progression

- Record last authoritative save timestamp.
- On resume, compute elapsed time subject to a configurable maximum (e.g., full speed for 24 hours, partial efficiency afterward; preferably unlockable).
- Evaluate production using analytical or chunked simulation at 1–10 minute steps for interdependent climate systems; avoid per-frame replay.
- Cap extreme climate changes across a single offline interval to prevent unfair irreversible collapses.
- Provide a clear offline summary: resources earned, projects completed, new milestones, and planet changes.
- Support optional auto-buy only after the player unlocks and configures it.
- Ensure clock irregularities cannot create negative time or catastrophic save corruption.

### Anti-frustration rules

- No mandatory tapping for core progression.
- No forced daily login bonuses.
- No required watching of ads.
- Avoid extended stretches where the only available action is waiting.
- Show upcoming unlock requirements in advance.
- Allow reversible specialization and climate recovery.
- Give meaningful automation early, but preserve strategic decisions.

---

## 14. Technical Implementation Plan

**Recommended baseline:** Godot 4.x with data-driven game systems and Android export. The design is engine-independent; another engine is viable if it supports smooth mobile rendering, local saves, and large-number arithmetic.

### Suggested modules

- `GameState`: resources, progression, current world, settings.
- `EconomySystem`: generator counts, costs, rates, multipliers, resource flows.
- `PlanetClimate`: normalized environmental variables and controlled interactions.
- `ResearchSystem`: unlock prerequisites, upgrades, branch data.
- `MilestoneSystem`: conditions, achievements, rewards.
- `PlanetRenderer`: seeded visual masks and 3D or shader-based appearance.
- `AutomationSystem`: player-selected buy rules, project priorities.
- `PrestigeSystem`: ascension eligibility, rewards, resets, legacy archive.
- `OfflineSimulator`: elapsed-time progression and summaries.
- `SaveManager`: versioned saves, backup, checksums, import/export.
- `UIController`: adaptive touch UI and modal views.

### Data-driven content

Define buildings, upgrades, research nodes, planets, and milestones in editable data files such as JSON or Godot resources rather than hardcoding all balances in UI scripts.

Example generator definition:

```json
{
  "id": "solar_collector",
  "name": "Solar Collector",
  "base_cost": {"energy": 10},
  "cost_growth": 1.14,
  "base_production": {"energy": 1},
  "milestones": [10, 25, 50, 100],
  "unlock": "start"
}
```

### Large numbers

Use a custom mantissa/exponent representation or a tested arbitrary-magnitude number implementation for resource amounts and costs. Keep climate variables ordinary bounded floats. Format `1,250`, `2.45e12`, etc., with an optional engineering-notation setting. Ensure bulk-buy calculations and prestige math do not overflow.

### Save safety

- Autosave periodically and on background/pause.
- Write atomically when possible, retain at least one backup, and validate save format versions.
- Save deterministic world seed plus environmental and progression state.
- Include import/export to local file or clipboard-friendly text where practical.
- Implement save migration before major content changes.

### Performance targets

- Smooth 30–60 FPS on contemporary Android handhelds and phones, with 30 FPS as an acceptable battery-saver target.
- Avoid continuously regenerating planet textures.
- Avoid one node/object per tree, organism, or building.
- Simulate environmental values at modest fixed intervals, separate from the render frame rate.
- Battery-conscious idle visuals when the player leaves the main planet view.

---

## 15. Development Roadmap

### Milestone A: First playable economy

**Deliver:** One rotating barren planet, energy, minerals, two generators, escalating costs, purchases, resource display, autosave, and offline gains.

**Acceptance criteria:** Core loop works without any art assets beyond simple procedural graphics; save/reload does not break counts or rates.

### Milestone B: Visible terraforming

**Deliver:** Atmosphere, heat, water, climate indicators, a small set of machines, visual transitions, tooltips, and the first planetary milestone.

**Acceptance criteria:** Planet appearance measurably follows climate state; player can recover from inefficient temperature settings.

### Milestone C: Biosphere and research

**Deliver:** Biomass, algae/forest growth, 20–30 research nodes, milestone unlocks, basic bulk purchase and automation.

**Acceptance criteria:** Progression is engaging over at least 60–120 minutes without a major dead end.

### Milestone D: Civilization and first prestige

**Deliver:** Settlements/city lights, orbital preview, one full ascension loop, World Seeds, 10+ permanent upgrades, archive screen.

**Acceptance criteria:** Two consecutive planetary runs feel different and the second reaches milestones faster through permanent improvements.

### Milestone E: Content and polish

**Deliver:** 4–6 specializations, 40–80 research nodes, more projects, stronger visuals, events, audio, accessibility, landscape support, performance testing, export-ready Android build.

### Milestone F: Post-launch depth

Add archived-world synergies, multiple simultaneous planets, star-system projects, and high-order prestige. Do not build this before the basic planet loop is fun.

---

## 16. MVP Feature Checklist

- [ ] Planet rotates and responds visually to atmosphere, water, and life.
- [ ] At least five purchasable building types with scalable costs.
- [ ] Resource income continues without tapping.
- [ ] Atmospheric and hydrological conditions interact in a readable way.
- [ ] First biomass unlock changes the planet's appearance.
- [ ] Research tree includes multiple strategies.
- [ ] Bulk purchase and early automation work.
- [ ] Save/load and offline progress are reliable.
- [ ] At least two viable planetary specialization paths.
- [ ] First ascension awards useful permanent progression.
- [ ] Android UI is readable and playable by touch.

---

## 17. Risks and Design Safeguards

**Risk: Too much climate micromanagement.** Make most systems trend toward targets and give players simple directives; advanced balancing remains optional.

**Risk: Beautiful but shallow.** Ensure attractive visuals are backed by research decisions, synergies, and prestige goals.

**Risk: Production systems become incomprehensible.** Provide a source-by-source rate breakdown and clear cause/effect descriptions.

**Risk: The first prestige takes too long.** Tune pacing with test saves; the first prestige should demonstrate its benefit and not feel like erasing a weekend.

**Risk: Ambitious 3D slows development.** Implement simple sphere shaders first, then add refined texture masks, clouds, cities, and orbital features in stages.

**Risk: Every world feels identical.** Deterministic world seeds plus meaningful specializations must affect gameplay and visuals, not just cosmetic color.

---

## 18. Definition of a Successful Game

Pocket Planet succeeds if a player enjoys both **optimizing the numbers** and **checking how their world has changed**. The progression must keep uncovering new systems while preserving the soothing fantasy of growing a planet from a dead rock to a thriving civilization. The first playable should concentrate on one beautiful, responsive world. A hundred worlds only matter after the first one is worth making.
