/* Headless balance harness: a greedy bot plays a world and reports pacing.
 * Usage: node tools/balance.js [hours] [seed] [ascensions]  */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
globalThis.PP = {};
for (const f of ['util.js', 'data.js', 'state.js', 'sim.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const PP = globalThis.PP, Sim = PP.Sim;
const hours = +(process.argv[2] || 12);
const seed = +(process.argv[3] || 12345);
const runs = +(process.argv[4] || 1);

function botStep(s) {
  // claim, research (cheapest), projects, directive, buildings
  Sim.claimAll(s);
  for (const r of PP.RESEARCH) {
    if (r.id === 'r_mine1') continue;
    if (Sim.researchState(s, r) === 'available' && Sim.canAfford(s, r.cost)) Sim.buyResearch(s, r.id);
  }
  for (const p of PP.PROJECTS) {
    if (p.id === 'p_sunshade' || p.id === 'p_lances') continue;
    if (!s.projects[p.id] && p.req(s) && Sim.canAfford(s, p.cost)) Sim.buyProject(s, p.id);
  }
  if (s.research.r_directive && !s.directive) Sim.setDirective(s, 'garden');
  const c = s.climate;
  // climate management: toggle processors if too hot
  if (c.temp > 34 && c.pressure > 40) s.off.processor = true; else if (c.temp < 28) s.off.processor = false;
  s.setpoint = 18;
  for (let i = 0; i < 30; i++) {
    let best = null, bs = Infinity;
    for (const b of PP.BUILDINGS) {
      if (!Sim.unlocked(s, b)) continue;
      const cost = Sim.costFor(s, b.id, 1);
      if (!Sim.canAfford(s, cost)) continue;
      let sc = 0; for (const r in cost) sc = Math.max(sc, cost[r] / Math.max(1e-9, s.res[r]));
      if (sc < bs) { bs = sc; best = b; }
    }
    if (!best) break;
    Sim.buy(s, best.id, 1);
  }
}

let s = PP.newWorld(seed);
for (let run = 0; run < runs; run++) {
  console.log(`\n=== World ${s.world.name} traits`, JSON.stringify(s.world.traits));
  const seenMs = {}, seenUnlock = {}, seenRes = {};
  const T = hours * 3600;
  let t = 0, asc = false;
  while (t < T) {
    const dt = t < 3600 ? 1 : 5;
    Sim.tick(s, dt);
    if (Math.floor(t) % (t < 3600 ? 2 : 10) === 0) botStep(s);
    t += dt;
    for (const e of Sim.events) {
      const tag = PP.fmtTime(t).padEnd(9);
      if (e.type === 'milestone' && !seenMs[e.id]) { seenMs[e.id] = 1; console.log(tag, 'MILESTONE', PP.MIL[e.id].name); }
      if (e.type === 'unlock' && !seenUnlock[e.id]) { seenUnlock[e.id] = 1; console.log(tag, 'unlock', e.id); }
      if (e.type === 'research') console.log(tag, '  research', PP.RSR[e.id].name);
      if (e.type === 'ascendReady') console.log(tag, '*** ASCENSION READY', JSON.stringify(Sim.seedPreview(s)));
    }
    Sim.events.length = 0;
    const c = s.climate;
    if (Math.floor(t) % (t < 3600 ? 300 : 3600) === 0) {
      console.log(PP.fmtTime(t).padEnd(9), `T=${c.temp.toFixed(1)} P=${c.pressure.toFixed(0)} GH=${c.greenhouse.toFixed(0)} liq=${c.liquid.toFixed(0)} ice=${c.ice.toFixed(0)} cl=${c.clouds.toFixed(0)} hab=${c.lifeHab.toFixed(0)} veg=${c.veg.toFixed(0)} bioH=${c.bioHealth.toFixed(0)} civ=${c.civLevel.toFixed(0)} poll=${c.pollution.toFixed(0)} stab=${c.stability.toFixed(0)}`);
      console.log('          res', Object.entries(s.res).map(([k, v]) => k.slice(0, 4) + '=' + PP.fmt(v)).join(' '));
      console.log('          bld', Object.entries(s.bld).filter(([, v]) => v).map(([k, v]) => k + ':' + v).join(' '));
    }
    if (Sim.objective(s).done && runs > 1) {
      const pv = Sim.seedPreview(s);
      console.log('ASCENDING at', PP.fmtTime(t), 'seeds', pv.seeds);
      const r = Sim.ascend(s, (seed * 31 + run + 7) >>> 0);
      s = r.state;
      // spend seeds greedily
      let bought = true;
      while (bought) { bought = false; for (const u of PP.UPGRADES) if (Sim.buyUpgrade(s, u.id)) bought = true; }
      console.log('upgrades', JSON.stringify(s.meta.upgrades), 'seeds left', s.meta.seeds);
      asc = true;
      break;
    }
  }
  if (!asc) break;
}
