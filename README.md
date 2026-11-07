# Pocket Planet

An idle / incremental planetary terraforming game. Start with a barren, slowly turning rock and grow it into a living, technological world: thicken the atmosphere, melt the ice, fill the oceans, seed life, raise cities, then **ascend** the finished planet into your archive and start again stronger.

The full design blueprint is in [`docs/Pocket_Planet_Game_Design.md`](docs/Pocket_Planet_Game_Design.md).

## Playing

No build step and no dependencies. It is plain HTML/CSS/JavaScript.

- **Quickest:** open `index.html` in a browser.
- **As an installable Android app (PWA):** serve the folder over HTTPS (for example GitHub Pages), open it in Chrome on Android and choose *Add to Home screen / Install app*. A service worker caches everything, so it then runs offline and full-screen.
- **Local server:** `python3 -m http.server 8000`, then open http://localhost:8000.

Controls: drag the planet to rotate it, pinch or scroll to zoom, and use the bottom tabs. Portrait-first, landscape supported.

## What's in this build (MVP: design doc milestones A–D)

| Area | Implemented |
|---|---|
| Economy | 8 resources, 15 buildings, geometric costs, x1/x10/x100/MAX bulk buy, count-milestone bonuses, input shortages shown as visible efficiency factors |
| Climate | Pressure, greenhouse, temperature with thermal inertia, liquid water / ice / clouds, oxygen, radiation shielding, pollution, life habitability, biosphere health, civilization, stability. Smooth curves, nothing is irreversible |
| Recovery | Every climate building can be switched off; Climate Regulators with a temperature setpoint; toggleable Thermal Lances / Orbital Sunshade |
| Research | 40 nodes in 8 branches, including an exclusive opening choice |
| Projects | 8 planetary projects (Comet Redirect, Magnetic Shield, Orbital Ring, Space Elevator…) |
| Directives | 6 reversible specializations (Ocean, Volcanic, Frozen, Garden, Industrial, Desert), each with its own ascension route |
| Milestones | 13 claimable per-world milestones (one-tap *Claim all*) and 9 permanent discovery records |
| Prestige | Ascension Potential → World Seeds, 13 permanent upgrades, legacy worlds archive with thumbnails, choose-your-next-world |
| Automation | Auto-buy (per building, with a spend limit), auto-research, auto-claim |
| Idle | Offline progress in chunks (24 h at full speed, then 25% speed; cap extendable), climate-swing safety cap, "While you were away" summary |
| Saves | Autosave every 20 s and on hide, backup slot, checksums, versioned migration, export/import text and file download |
| Visuals | Software sphere shader: seeded terrain with craters, oceans filling basins by area, polar caps, vegetation, clouds, an atmosphere tint that shifts from CO₂ orange to oxygen blue, lava fissures, facility lights, night-side city lights, satellites, orbital ring |
| Accessibility | Text size, reduced motion, low-effects mode, battery saver (30 FPS), notation options, colour plus text status indicators |

## Project layout

```
index.html            app shell
css/style.css         mobile-first styles (portrait + landscape grid)
js/util.js            seeded RNG, 3D value noise, formatting
js/data.js            all content and balance numbers (data-driven)
js/state.js           world traits, new game, save/load/migration
js/sim.js             economy + climate simulation, purchases, prestige, offline
js/planet.js          procedural planet renderer
js/ui.js              panels, toasts, modals
js/main.js            boot, fixed-step sim loop, render loop, autosave
sw.js, manifest.webmanifest, icons/   PWA install/offline support
tools/test.js         simulation tests:   node tools/test.js
tools/balance.js      greedy-bot pacing report:   node tools/balance.js [hours] [seed] [ascensions]
```

## Balance snapshot (greedy bot, `tools/balance.js`)

A bot that buys the best thing every few seconds reaches: first atmosphere at about 4 min, the thaw and first ocean at about 7–9 min, first life at about 15–20 min, directives at about 20 min, a self-sustaining biosphere at about 45 min, settlement lights at about 3 h, and ascension at about 4–5 h. The second world takes about 1–1.5 h. A real player who checks in now and then should land in the design's "1–3 days to first ascension" band. All numbers live in `js/data.js` and the `K` constants in `js/sim.js`.

## Known limitations / next steps

- Resource values are ordinary JavaScript doubles (fine up to about 1e308). A mantissa/exponent big-number type is the next step before very deep prestige layers.
- There is no audio yet.
- Star-system play, multiple simultaneous planets and higher-order prestige (design Milestone F) are not started.
- A native Android package can be produced by wrapping this folder with a Trusted Web Activity (Bubblewrap) or Capacitor. The PWA already installs and runs offline.
