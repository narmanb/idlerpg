/* Simulation sanity tests (no browser needed). Usage: node tools/test.js */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
globalThis.PP = {};
for (const f of ['util.js', 'data.js', 'state.js', 'sim.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const PP = globalThis.PP, Sim = PP.Sim;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; }
}
function allFinite(s) {
  for (const k in s.res) assert(Number.isFinite(s.res[k]) && s.res[k] >= 0, 'res ' + k + '=' + s.res[k]);
  for (const k of ['temp', 'pressure', 'liquid', 'ice', 'clouds', 'greenhouse', 'pollution', 'lifeHab', 'bioHealth', 'stability', 'veg', 'civLevel']) {
    assert(Number.isFinite(s.climate[k]), 'climate ' + k + '=' + s.climate[k]);
  }
}

test('new world starts with one solar collector and only basics unlocked', () => {
  const s = PP.newWorld(42);
  Sim.tick(s, 0.2);
  assert.strictEqual(s.bld.solar, 1);
  const unlocked = PP.BUILDINGS.filter((b) => Sim.unlocked(s, b)).map((b) => b.id);
  assert.deepStrictEqual(unlocked, ['solar', 'extractor']);
});

test('geometric bulk cost equals sum of single costs', () => {
  const s = PP.newWorld(1);
  s.bld.solar = 7;
  const bulk = Sim.costFor(s, 'solar', 10).energy;
  let sum = 0;
  for (let i = 0; i < 10; i++) { sum += Sim.costFor(s, 'solar', 1).energy; s.bld.solar++; }
  assert(Math.abs(bulk - sum) / sum < 1e-9);
});

test('max affordable never overspends', () => {
  const s = PP.newWorld(2);
  s.res.energy = 123456;
  const k = Sim.maxAffordable(s, 'solar');
  assert(Sim.canAfford(s, Sim.costFor(s, 'solar', k)));
  assert(!Sim.canAfford(s, Sim.costFor(s, 'solar', k + 1)));
  assert.strictEqual(Sim.buy(s, 'solar', 'max'), k);
  assert(s.res.energy >= 0);
});

test('consumers never fully starve the stockpile (reserve rule)', () => {
  const s = PP.newWorld(3);
  s.bld.processor = 500; s.bld.geothermal = 1; s.res.energy = 0;
  for (let i = 0; i < 50; i++) Sim.tick(s, 1);
  assert(s.res.energy > 0, 'energy should still accumulate');
});

test('save serialize/deserialize roundtrip with checksum', () => {
  const s = PP.newWorld(4);
  for (let i = 0; i < 100; i++) Sim.tick(s, 1);
  const txt = PP.serialize(s);
  const back = PP.deserialize(txt);
  assert.strictEqual(back.world.seed, s.world.seed);
  assert.strictEqual(back.res.energy, s.res.energy);
  const bad = JSON.parse(txt); bad.d = bad.d.replace('"solar":1', '"solar":999');
  assert.throws(() => PP.deserialize(JSON.stringify(bad)));
});

test('migration fills missing fields from older saves', () => {
  const s = PP.newWorld(5);
  delete s.projOff; delete s.settings.autoSpend; s.res.energy = NaN;
  const m = PP.migrate(JSON.parse(JSON.stringify(s)));
  assert(m.projOff && m.settings.autoSpend === 1 && Number.isFinite(m.res.energy));
});

test('long offline catch-up stays finite and bounded', () => {
  const s = PP.newWorld(6);
  s.bld.solar = 40; s.bld.extractor = 30; s.bld.geothermal = 30; s.bld.processor = 60; s.bld.iceHarvester = 10;
  s.res.energy = 1e5; s.res.minerals = 1e5;
  const sum = Sim.offline(s, 10 * 24 * 3600);
  allFinite(s);
  assert(sum.simTime <= Sim.offlineCap(s) * 1.5 + 1);
  assert(s.climate.temp < 200 && s.climate.temp > -200);
});

test('negative or garbage elapsed time is ignored', () => {
  const s = PP.newWorld(7);
  assert.strictEqual(Sim.offline(s, -500), null);
  assert.strictEqual(Sim.offline(s, NaN), null);
});

test('exclusive opening research choice locks the alternative', () => {
  const s = PP.newWorld(8);
  s.res.energy = 1000;
  assert(Sim.buyResearch(s, 'r_solar1'));
  assert.strictEqual(Sim.researchState(s, PP.RSR.r_mine1), 'excluded');
});

test('full greedy run reaches ascension and the next world is faster', () => {
  function bot(s) {
    Sim.claimAll(s);
    for (const r of PP.RESEARCH) if (r.id !== 'r_mine1' && Sim.researchState(s, r) === 'available' && Sim.canAfford(s, r.cost)) Sim.buyResearch(s, r.id);
    for (const p of PP.PROJECTS) if (!p.toggle && !s.projects[p.id] && p.req(s) && Sim.canAfford(s, p.cost)) Sim.buyProject(s, p.id);
    if (s.research.r_directive && !s.directive) Sim.setDirective(s, 'garden');
    if (s.climate.temp > 34 && s.climate.pressure > 40) s.off.processor = true; else if (s.climate.temp < 28) s.off.processor = false;
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
  function run(s) {
    let t = 0;
    while (!Sim.objective(s).done && t < 16 * 3600) { Sim.tick(s, 2); if (t % 10 === 0) bot(s); t += 2; }
    return t;
  }
  let s = PP.newWorld(12345);
  const t1 = run(s);
  assert(Sim.objective(s).done, 'first world should be completable');
  allFinite(s);
  const r = Sim.ascend(s, 999);
  assert(r.seeds > 0);
  s = r.state;
  while (Sim.buyUpgrade(s, 'u_industry') || Sim.buyUpgrade(s, 'u_atmo')) { /* spend */ }
  const t2 = run(s);
  console.log('      first ascension', PP.fmtTime(t1), '· second', PP.fmtTime(t2));
  assert(t2 < t1, 'second world should be faster');
});

test('number formatting', () => {
  PP.notation = 'sci';
  assert.strictEqual(PP.fmt(1250), '1,250');
  assert.strictEqual(PP.fmt(2.45e12), '2.45e12');
  assert.strictEqual(PP.fmt(9.999e6), '1.00e7');
  PP.notation = 'suffix';
  assert.strictEqual(PP.fmt(3.2e9), '3.20B');
  PP.notation = 'sci';
});

console.log(`\n${passed} passed`);
