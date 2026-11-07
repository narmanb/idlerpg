/* Pocket Planet — economy and readable climate simulation.
 * The simulation is independent of rendering and runs at a fixed step
 * (and in larger chunks for offline progress). */
(function (PP) {
  'use strict';
  const S = PP.smooth, sat = PP.sat, approach = PP.approach, clamp = PP.clamp;
  const Sim = (PP.Sim = {});

  // Tunable climate constants (scaled by planet surface area).
  const K = {
    atmo: 7000, water: 30000, bio: 6e4, oxy: 4e4, civ: 1.5e5,
    ghg: 22, poll: 30,
    tauTemp: 90, tauGhg: 60, tauPoll: 120, tauCloud: 40, tauBio: 60,
  };
  Sim.K = K;

  Sim.events = [];
  function emit(type, data) { Sim.events.push(Object.assign({ type }, data || {})); }

  // ------------------------------------------------------------ Modifiers
  function blankMods() {
    return {
      bld: {}, res: {}, cons: {}, ghgB: {}, pollB: {}, costB: {},
      ghg: 1, poll: 1, cost: 1, shield: 0, stab: 0, reg: 1, oxy: 1, heat: 0, cold: 0,
      global: 1, features: {}, waterAdd: 0, bioAdd: 0, seaCap: 72, waterK: 1,
    };
  }
  function mul(o, k, x) { o[k] = (o[k] || 1) * x; }

  function applyFx(m, fx) {
    for (const f of fx) {
      switch (f.t) {
        case 'bld': mul(m.bld, f.id, f.x); break;
        case 'res': mul(m.res, f.id, f.x); break;
        case 'cons': mul(m.cons, f.id, f.x); break;
        case 'ghg': if (f.id) mul(m.ghgB, f.id, f.x); else m.ghg *= f.x; break;
        case 'poll': m.poll *= f.x; break;
        case 'pollb': mul(m.pollB, f.id, f.x); break;
        case 'cost': mul(m.costB, f.id, f.x); break;
        case 'shield': m.shield += f.v; break;
        case 'stab': m.stab += f.v; break;
        case 'reg': m.reg *= f.x; break;
        case 'oxy': m.oxy *= f.x; break;
        case 'heat': m.heat += f.v; break;
        case 'cold': m.cold += f.v; break;
        case 'global': m.global *= f.x; break;
        case 'feature': m.features[f.id] = true; break;
        case 'water': m.waterAdd += f.v; break;
        case 'bio': m.bioAdd += f.v; break;
      }
    }
  }

  Sim.legacyBonus = function (meta) {
    const arch = meta.archive || [];
    if (!arch.length) return 1;
    const dirs = new Set(arch.map((a) => a.directive || 'none'));
    const res = Math.pow(2, meta.upgrades.u_archive || 0);
    // Each legacy world +10%, each distinct specialization +15% more. Scaled by resonance.
    return 1 + (arch.length * 0.10 + dirs.size * 0.15) * res;
  };

  Sim.prestigeMult = function (s) {
    const meta = s.meta, up = meta.upgrades;
    const disc = Object.keys(meta.discoveries).length;
    return Math.pow(1.5, up.u_industry || 0) *
      (1 + PP.SEED_BONUS * meta.seeds) *
      (1 + PP.DISC_BONUS * disc) *
      Sim.legacyBonus(meta);
  };

  Sim.mods = function (s) {
    const m = blankMods();
    for (const id in s.research) if (s.research[id] && PP.RSR[id]) applyFx(m, PP.RSR[id].fx);
    for (const id in s.projects) {
      if (!s.projects[id] || !PP.PRJ[id]) continue;
      const p = PP.PRJ[id];
      if (p.toggle && s.projOff[id]) continue;
      applyFx(m, p.fx.filter((f) => f.t !== 'water' && f.t !== 'bio'));
    }
    for (const id in s.milestones) if (s.milestones[id] === 'claimed' && PP.MIL[id]) applyFx(m, PP.MIL[id].fx);
    if (s.directive && PP.DIR[s.directive]) applyFx(m, PP.DIR[s.directive].fx);
    if (s.directive === 'ocean') m.seaCap = 92;
    if (s.directive === 'desert') { m.seaCap = 40; m.waterK = 3; }
    const up = s.meta.upgrades;
    if (up.u_research) mul(m.res, 'research', Math.pow(2, up.u_research));
    if (up.u_cost) m.cost *= Math.pow(0.94, up.u_cost);
    if (up.u_auto) m.features.autobuy = true;
    if (up.u_autoresearch) { m.features.autoresearch = true; m.features.autoclaim = true; }
    m.prestige = Sim.prestigeMult(s);
    m.global *= m.prestige;
    m.inertia = 1 + 0.25 * (up.u_inertia || 0);
    return m;
  };

  // ------------------------------------------------------------ Climate
  Sim.areaScale = (s) => s.world.traits.radius * s.world.traits.radius;

  Sim.initialClimate = function (s) {
    const t = s.world.traits, a = t.radius * t.radius, up = s.meta.upgrades;
    const c = {
      atmo: K.atmo * a * (t.remnant + 0.08 * (up.u_atmo || 0)) * 1.0,
      water: K.water * a * 0.06 * (up.u_hydro || 0),
      bio: 0, oxy: 0, civ: 0,
      greenhouse: 0, pollution: 0, temp: t.baseTemp, clouds: 0, bioHealth: 0,
    };
    // Convert remnant / memory fraction into stocks that produce the right % of pressure
    c.atmo = -Math.log(1 - Math.min(0.9, t.remnant + 0.08 * (up.u_atmo || 0))) * K.atmo * a;
    c.water = -Math.log(1 - Math.min(0.9, 0.06 * (up.u_hydro || 0))) * K.water * a;
    Sim.deriveClimate(s, c, null);
    return c;
  };

  /** Derived (non-stock) climate values. Mutates c. */
  Sim.deriveClimate = function (s, c, m) {
    m = m || blankMods();
    const t = s.world.traits, a = t.radius * t.radius;
    c.pressure = sat(c.atmo, K.atmo * a);
    const waterPot = Math.min(m.seaCap, sat(c.water, K.water * a * m.waterK));
    const T = c.temp;
    const liquidFrac = S(-12, 4, T) * S(3, 18, c.pressure) * (1 - S(85, 120, T));
    c.waterPot = waterPot;
    c.liquid = waterPot * liquidFrac;
    const polar = t.ice * 7 * (1 - S(-30, 12, T));
    c.ice = Math.min(95, waterPot * (1 - liquidFrac) * (1 - S(30, 70, T)) + polar);
    c.oxygen = sat(c.oxy, K.oxy * a);
    c.shield = clamp(c.pressure * 0.35 + c.oxygen * 0.35 + m.shield, 0, 100);
    const comfortLo = 8 - m.cold, comfortHi = 30 - m.cold;
    c.comfortLo = comfortLo; c.comfortHi = comfortHi;
    const tempF = PP.plateau(T, comfortLo - 35, comfortLo, comfortHi, comfortHi + 35);
    const waterF = S(0, 20, c.liquid);
    const pressF = S(4, 30, c.pressure);
    const radF = 0.35 + 0.65 * c.shield / 100;
    const pollF = 1 - 0.7 * c.pollution / 100;
    c.f = { temp: tempF, water: waterF, press: pressF, rad: radF, poll: pollF };
    c.lifeHab = 100 * tempF * waterF * pressF * radF * pollF;
    c.waterHab = 100 * pressF * S(-12, 4, T) * (1 - S(85, 120, T)) * S(0, 10, waterPot);
    c.veg = Math.min(c.lifeHab, sat(c.bio, K.bio * a));
    c.civLevel = sat(c.civ, K.civ * a);
    return c;
  };

  // ------------------------------------------------------------ Production
  Sim.traitMult = function (s, b) {
    const t = s.world.traits;
    if (b.id === 'extractor' || b.id === 'deepMine') return t.mineral;
    if (b.id === 'geothermal') return 0.6 + 0.4 * t.tectonic;
    if (b.id === 'iceHarvester') return t.ice;
    if (b.id === 'solar') return 1.15 - 0.15 * t.radius; // smaller worlds catch proportionally more light per site
    return 1;
  };

  Sim.unlocked = function (s, b, c) {
    if (s.bld[b.id] > 0) return true;
    return b.unlock(s, c || s.climate);
  };

  /** Full rate calculation for the current state. */
  Sim.rates = function (s, m, dt) {
    dt = dt || 1;
    const c = s.climate;
    const R = PP.RESOURCES.map((r) => r.id);
    const stabF = 0.5 + 0.5 * (c.stability === undefined ? 70 : c.stability) / 100;
    const out = { prod: {}, cons: {}, net: {}, demand: {}, resEff: {}, bld: {}, ghg: 0, poll: 0, heatN: 0 };
    R.forEach((r) => { out.prod[r] = 0; out.cons[r] = 0; out.demand[r] = 0; out.resEff[r] = 1; });

    const list = [];
    for (const b of PP.BUILDINGS) {
      const owned = s.bld[b.id] || 0;
      const n = s.off[b.id] ? 0 : owned;
      const info = { id: b.id, n, owned, gross: {}, consBase: {}, eff: 1, factors: [] };
      out.bld[b.id] = info;
      if (!owned) continue;
      const cm = PP.countMult(owned), bm = m.bld[b.id] || 1, tm = Sim.traitMult(s, b);
      const env = b.env ? b.env(s, c) : null;
      const envF = env ? Math.max(0, env[0]) : 1;
      info.factors.push(['Count bonus', cm]);
      if (bm !== 1) info.factors.push(['Research & bonuses', bm]);
      if (tm !== 1) info.factors.push(['World trait', tm]);
      if (env) info.factors.push([env[1], envF]);
      if (m.global !== 1) info.factors.push(['Global', m.global]);
      for (const r in b.prod) {
        let rm = m.res[r] || 1;
        if (r === 'biomass' || r === 'civ') rm *= stabF;
        info.gross[r] = b.prod[r] * n * cm * bm * tm * envF * m.global * rm;
        info.each = info.each || {};
        info.each[r] = n ? info.gross[r] / n : b.prod[r] * cm * bm * tm * envF * m.global * rm;
      }
      if (b.cons) for (const r in b.cons) info.consBase[r] = b.cons[r] * n * (m.cons[r] || 1);
      list.push([b, info]);
    }

    // Iterate efficiencies for consumer chains (energy <-> minerals).
    const stock = s.res;
    for (let iter = 0; iter < 4; iter++) {
      R.forEach((r) => { out.prod[r] = 0; out.demand[r] = 0; });
      for (const [, info] of list) {
        for (const r in info.gross) out.prod[r] += info.gross[r] * info.eff;
        for (const r in info.consBase) out.demand[r] += info.consBase[r];
      }
      R.forEach((r) => {
        const d = out.demand[r];
        if (d <= 0) out.resEff[r] = 1;
        else if (stock[r] >= d * dt * 1.001) out.resEff[r] = 1;
        // In a shortage consumers may only use 80% of production, so a stockpile
        // always accumulates and the player can still afford new producers.
        else out.resEff[r] = clamp(0.8 * out.prod[r] / d, 0, 1);
      });
      for (const [, info] of list) {
        let e = 1;
        for (const r in info.consBase) if (info.consBase[r] > 0) e = Math.min(e, out.resEff[r]);
        info.eff = e;
      }
    }
    R.forEach((r) => { out.prod[r] = 0; out.cons[r] = 0; });
    for (const [b, info] of list) {
      for (const r in info.gross) out.prod[r] += info.gross[r] * info.eff;
      for (const r in info.consBase) out.cons[r] += info.consBase[r] * info.eff;
      if (b.emit && info.n) {
        const k = info.n * info.eff;
        if (b.emit.ghg) out.ghg += b.emit.ghg * k * (b.emit.ghg > 0 ? m.ghg * (m.ghgB[b.id] || 1) : 1);
        if (b.emit.poll) out.poll += b.emit.poll * k * (b.emit.poll > 0 ? m.poll * (m.pollB[b.id] || 1) : 1);
        if (b.emit.heat) out.heatN += b.emit.heat * k;
      }
      if (info.eff < 0.999) info.factors.push(['Input shortage', info.eff]);
    }
    R.forEach((r) => (out.net[r] = out.prod[r] - out.cons[r]));
    return out;
  };

  // ------------------------------------------------------------ Tick
  /** Advance the simulation by dt seconds. opts.offline caps climate swings. */
  Sim.tick = function (s, dt, opts) {
    opts = opts || {};
    const m = Sim.mods(s);
    const c = s.climate;
    const t = s.world.traits, a = t.radius * t.radius;
    const rt = Sim.rates(s, m, dt);

    // Resources
    for (const r in rt.net) {
      s.res[r] = Math.max(0, s.res[r] + rt.net[r] * dt);
      s.life[r] += rt.prod[r] * dt;
    }

    // Climate stocks
    c.atmo += rt.prod.compounds * dt;
    c.water += rt.prod.water * dt;
    c.bio += rt.prod.biomass * dt;
    c.oxy += rt.prod.biomass * dt * m.oxy;
    c.civ += rt.prod.civ * dt;

    const inertia = m.inertia;
    const pf = S(0, 40, c.pressure);
    const ghgTarget = sat(Math.max(0, rt.ghg), K.ghg);
    c.greenhouse += (ghgTarget - c.greenhouse) * approach(dt, K.tauGhg / inertia);
    const pollTarget = sat(Math.max(0, rt.poll), K.poll);
    c.pollution += (pollTarget - c.pollution) * approach(dt, K.tauPoll / inertia);

    const geoHeat = 35 * (1 - Math.exp(-rt.heatN * t.tectonic / 25));
    let target = t.baseTemp + c.greenhouse * (0.25 + 0.75 * pf) * 1.05 + geoHeat + m.heat - c.clouds * 0.12;
    const regN = s.off.regulator ? 0 : (s.bld.regulator || 0) * (rt.bld.regulator ? rt.bld.regulator.eff : 0);
    const regStrength = regN > 0 ? 1 - Math.exp(-regN * m.reg / 8) : 0;
    c.naturalTarget = target;
    target += (s.setpoint - target) * regStrength;
    c.targetTemp = target;
    c.regStrength = regStrength;
    const prevT = c.temp;
    c.temp += (target - c.temp) * approach(dt, K.tauTemp / inertia);
    if (opts.offline && opts.T0 !== undefined) {
      // Never let an absence swing temperature more than 25 °C away from the comfort band.
      const lo = Math.min(opts.T0, c.comfortLo || 8) - 25, hi = Math.max(opts.T0, c.comfortHi || 30) + 25;
      c.temp = clamp(c.temp, Math.min(lo, prevT), Math.max(hi, prevT));
    }

    Sim.deriveClimate(s, c, m);
    const cloudTarget = Math.min(70, c.waterPot * 0.5 * S(2, 30, c.pressure) * S(-35, 15, c.temp) + 25 * S(70, 110, c.temp) * c.waterPot / 100);
    c.clouds += (cloudTarget - c.clouds) * approach(dt, K.tauCloud / inertia);

    // Stability
    const out = c.temp < c.comfortLo ? c.comfortLo - c.temp : c.temp > c.comfortHi ? c.temp - c.comfortHi : 0;
    const lifeStab = c.veg * 0.15;
    c.stability = clamp(62 + m.stab + regStrength * 25 + lifeStab - c.pollution * 0.45 - Math.min(40, out * 0.6) - Math.abs(c.temp - prevT) / Math.max(dt, 1) * 20, 0, 100);
    const bioTarget = c.lifeHab * (0.25 + 0.75 * S(0, 60, c.veg)) * (0.6 + 0.4 * c.stability / 100);
    c.bioHealth += (bioTarget - c.bioHealth) * approach(dt, K.tauBio / inertia);

    s.worldTime += dt;
    s.played += dt;
    s._rates = rt;
    s._mods = m;

    Sim.checkProgress(s, m);
    if (m.features.autobuy && s.autoOn) Sim.autoBuy(s, m);
    if (m.features.autoresearch && s.autoResearch) Sim.autoResearch(s);
    if (m.features.autoclaim && s.autoClaim) Sim.claimAll(s);
    return rt;
  };

  Sim.checkProgress = function (s, m) {
    const c = s.climate;
    for (const ms of PP.MILESTONES) {
      if (!s.milestones[ms.id] && ms.cond(s, c)) {
        s.milestones[ms.id] = 'ready';
        emit('milestone', { id: ms.id });
      }
    }
    for (const d of PP.DISCOVERIES) {
      if (!s.meta.discoveries[d.id] && d.cond(s, c)) {
        s.meta.discoveries[d.id] = { at: Date.now(), world: s.world.name };
        emit('discovery', { id: d.id });
      }
    }
    for (const b of PP.BUILDINGS) {
      if (!s.seen['b_' + b.id] && Sim.unlocked(s, b, c)) {
        s.seen['b_' + b.id] = 1;
        if (b.id !== 'solar' && b.id !== 'extractor') emit('unlock', { id: b.id });
      }
    }
    const goal = Sim.objective(s);
    if (goal.done && !s.seen.ascendReady) { s.seen.ascendReady = 1; emit('ascendReady', {}); }
  };

  // ------------------------------------------------------------ Purchases
  Sim.costMult = function (s, id, m) {
    m = m || s._mods || Sim.mods(s);
    return m.cost * (m.costB[id] || 1);
  };

  Sim.costFor = function (s, id, k, m) {
    const b = PP.BLD[id], n = s.bld[id], g = b.growth, cm = Sim.costMult(s, id, m);
    const out = {};
    for (const r in b.cost) out[r] = b.cost[r] * cm * Math.pow(g, n) * (Math.pow(g, k) - 1) / (g - 1);
    return out;
  };

  Sim.maxAffordable = function (s, id, m, spend) {
    spend = spend || 1;
    const b = PP.BLD[id], n = s.bld[id], g = b.growth, cm = Sim.costMult(s, id, m);
    let k = Infinity;
    for (const r in b.cost) {
      const first = b.cost[r] * cm * Math.pow(g, n);
      const have = s.res[r] * spend;
      const kr = Math.floor(Math.log(1 + have * (g - 1) / first) / Math.log(g) + 1e-9);
      k = Math.min(k, kr);
    }
    return Math.max(0, k === Infinity ? 0 : k);
  };

  Sim.canAfford = function (s, cost, spend) {
    spend = spend || 1;
    for (const r in cost) if (s.res[r] * spend < cost[r] * 0.999999) return false;
    return true;
  };

  Sim.pay = function (s, cost) {
    for (const r in cost) s.res[r] = Math.max(0, s.res[r] - cost[r]);
  };

  /** Buy amt (number or 'max') of building id. Returns number bought. */
  Sim.buy = function (s, id, amt) {
    const b = PP.BLD[id];
    if (!b || !Sim.unlocked(s, b)) return 0;
    let k = amt === 'max' ? Sim.maxAffordable(s, id) : amt;
    if (k <= 0) return 0;
    let cost = Sim.costFor(s, id, k);
    if (!Sim.canAfford(s, cost)) {
      k = Math.min(k, Sim.maxAffordable(s, id));
      if (k <= 0) return 0;
      cost = Sim.costFor(s, id, k);
    }
    Sim.pay(s, cost);
    const before = s.bld[id];
    s.bld[id] += k;
    if (before === 0) emit('firstBuild', { id });
    return k;
  };

  Sim.autoBuy = function (s, m) {
    const spend = s.settings.autoSpend || 1;
    for (let i = 0; i < 20; i++) {
      let best = null, bestScore = Infinity;
      for (const b of PP.BUILDINGS) {
        if (!s.auto[b.id] || !Sim.unlocked(s, b)) continue;
        const cost = Sim.costFor(s, b.id, 1, m);
        if (!Sim.canAfford(s, cost, spend)) continue;
        // Score: largest fraction of stock this would consume (cheapest relative purchase first)
        let score = 0;
        for (const r in cost) score = Math.max(score, cost[r] / Math.max(1e-9, s.res[r]));
        if (score < bestScore) { bestScore = score; best = b; }
      }
      if (!best) break;
      Sim.buy(s, best.id, 1);
    }
  };

  // ------------------------------------------------------------ Research
  Sim.researchState = function (s, r) {
    if (s.research[r.id]) return 'done';
    if (r.excl && s.research[r.excl]) return 'excluded';
    for (const q of r.req) if (!s.research[q]) return 'locked';
    if (r.vis && !r.vis(s)) return 'hidden';
    return 'available';
  };

  Sim.buyResearch = function (s, id) {
    const r = PP.RSR[id];
    if (!r || Sim.researchState(s, r) !== 'available') return false;
    if (!Sim.canAfford(s, r.cost)) return false;
    Sim.pay(s, r.cost);
    s.research[id] = true;
    emit('research', { id });
    return true;
  };

  Sim.autoResearch = function (s) {
    let best = null, bestCost = Infinity;
    for (const r of PP.RESEARCH) {
      if (r.choice) continue;
      if (Sim.researchState(s, r) !== 'available') continue;
      if (!Sim.canAfford(s, r.cost)) continue;
      const c = Object.values(r.cost).reduce((a, b) => a + b, 0);
      if (c < bestCost) { bestCost = c; best = r; }
    }
    if (best) Sim.buyResearch(s, best.id);
  };

  // ------------------------------------------------------------ Projects
  Sim.buyProject = function (s, id) {
    const p = PP.PRJ[id];
    if (!p || s.projects[id] || !p.req(s)) return false;
    if (!Sim.canAfford(s, p.cost)) return false;
    Sim.pay(s, p.cost);
    s.projects[id] = true;
    const a = Sim.areaScale(s);
    for (const f of p.fx) {
      if (f.t === 'water') s.climate.water += K.water * a * f.v;
      if (f.t === 'bio') s.climate.bio += K.bio * a * f.v;
    }
    emit('project', { id });
    return true;
  };

  // ------------------------------------------------------------ Directives
  Sim.DIRECTIVE_COOLDOWN = 600;
  Sim.directiveCooldown = function (s) {
    if (!s.directive) return 0;
    return Math.max(0, Sim.DIRECTIVE_COOLDOWN - (s.worldTime - s.directiveAt));
  };
  Sim.setDirective = function (s, id) {
    if (!PP.DIR[id] || s.directive === id) return false;
    if (Sim.directiveCooldown(s) > 0) return false;
    s.directive = id;
    s.directiveAt = s.worldTime;
    emit('directive', { id });
    return true;
  };

  // ------------------------------------------------------------ Milestones
  Sim.claim = function (s, id) {
    if (s.milestones[id] !== 'ready') return false;
    s.milestones[id] = 'claimed';
    return true;
  };
  Sim.claimAll = function (s) {
    let n = 0;
    for (const id in s.milestones) if (Sim.claim(s, id)) n++;
    return n;
  };

  // ------------------------------------------------------------ Ascension
  Sim.ascensionPotential = function (s) {
    let ap = 0;
    for (const r in PP.AP_WEIGHT) ap += (s.life[r] || 0) * PP.AP_WEIGHT[r];
    return ap;
  };

  Sim.objective = function (s) {
    const c = s.climate;
    const routes = [{ name: 'Thriving Civilization', goal: PP.CIV_GOAL.goal, done: PP.CIV_GOAL.done(s, c), prog: clamp(PP.CIV_GOAL.prog(s, c), 0, 1) }];
    if (s.directive) {
      const d = PP.DIR[s.directive];
      routes.unshift({ name: d.name, goal: d.goal, done: d.done(s, c), prog: clamp(d.prog(s, c), 0, 1) });
    }
    const done = routes.some((r) => r.done);
    return { routes, done };
  };

  Sim.seedPreview = function (s) {
    const ap = Sim.ascensionPotential(s);
    const distinct = Object.values(s.milestones).filter(Boolean).length;
    const harvest = 1 + 0.15 * (s.meta.upgrades.u_harvest || 0);
    const seeds = Math.floor(Math.pow(ap / 1e9, 0.35) * (1 + distinct * 0.08) * harvest);
    return { ap, distinct, seeds: Math.max(0, seeds) };
  };

  Sim.candidateSeeds = function (s, n) {
    const out = [];
    const base = (s.world.seed * 2654435761 + (s.meta.ascensions + 1) * 97 + (s.seen.reroll || 0) * 7919) >>> 0;
    const r = PP.rng(base);
    for (let i = 0; i < n; i++) out.push((r() * 4294967296) >>> 0);
    return out;
  };

  /** Ascend the current world into the archive and start a new one. */
  Sim.ascend = function (s, nextSeed, thumb) {
    const obj = Sim.objective(s);
    if (!obj.done) return null;
    const pv = Sim.seedPreview(s);
    const meta = s.meta;
    meta.seeds += pv.seeds;
    meta.totalSeeds += pv.seeds;
    meta.ascensions += 1;
    meta.lifetimeAP += pv.ap;
    const c = s.climate;
    meta.archive.push({
      name: s.world.name, seed: s.world.seed, directive: s.directive,
      time: s.worldTime, seeds: pv.seeds, at: Date.now(),
      temp: Math.round(c.temp), liquid: Math.round(c.liquid), veg: Math.round(c.veg), civ: Math.round(c.civLevel),
      thumb: thumb || null,
    });
    if (!meta.bestTimes.ascend || s.worldTime < meta.bestTimes.ascend) meta.bestTimes.ascend = s.worldTime;
    const ns = PP.newWorld(nextSeed, meta, s.settings);
    ns.played = s.played;
    ns.seen.tutorialDone = s.seen.tutorialDone;
    return { state: ns, seeds: pv.seeds };
  };

  Sim.buyUpgrade = function (s, id) {
    const u = PP.UPG[id];
    const lvl = s.meta.upgrades[id] || 0;
    if (!u || lvl >= u.max) return false;
    const cost = PP.upgradeCost(u, lvl);
    if (s.meta.seeds < cost) return false;
    s.meta.seeds -= cost;
    s.meta.upgrades[id] = lvl + 1;
    return true;
  };

  // ------------------------------------------------------------ Offline
  Sim.offlineCap = function (s) {
    return (24 + 12 * (s.meta.upgrades.u_offline || 0)) * 3600;
  };

  /** Simulate elapsed seconds in chunks; returns a summary. */
  Sim.offline = function (s, elapsed) {
    if (!(elapsed > 0)) return null;
    const cap = Sim.offlineCap(s);
    // Full speed up to the cap, then 25% efficiency for up to two more caps.
    const extra = Math.min(Math.max(0, elapsed - cap), cap * 2);
    const simTime = Math.min(elapsed, cap) + extra * 0.25;
    const before = { res: Object.assign({}, s.res), bld: Object.assign({}, s.bld), temp: s.climate.temp, liquid: s.climate.liquid, veg: s.climate.veg, pressure: s.climate.pressure, civ: s.climate.civLevel, research: Object.keys(s.research).length };
    const eventsBefore = Sim.events.length;
    const steps = Math.min(3000, Math.max(1, Math.ceil(simTime / 2)));
    const dt = simTime / steps;
    const T0 = s.climate.temp;
    for (let i = 0; i < steps; i++) Sim.tick(s, dt, { offline: true, T0 });
    const evs = Sim.events.slice(eventsBefore);
    const gained = {};
    for (const r in s.res) gained[r] = s.res[r] - before.res[r];
    let bought = 0;
    for (const id in s.bld) bought += s.bld[id] - before.bld[id];
    return {
      elapsed, simTime, gained, bought,
      milestones: evs.filter((e) => e.type === 'milestone').map((e) => e.id),
      unlocks: evs.filter((e) => e.type === 'unlock').map((e) => e.id),
      research: Object.keys(s.research).length - before.research,
      climate: {
        temp: [before.temp, s.climate.temp], liquid: [before.liquid, s.climate.liquid],
        veg: [before.veg, s.climate.veg], pressure: [before.pressure, s.climate.pressure], civ: [before.civ, s.climate.civLevel],
      },
    };
  };

  // ------------------------------------------------------------ Guidance
  /** The single most relevant next goal for the main screen card. */
  Sim.nextGoal = function (s) {
    const c = s.climate;
    const ready = Object.values(s.milestones).filter((v) => v === 'ready').length;
    if (Sim.objective(s).done) return { text: 'This world is complete — Ascend it from the Archive tab', prog: 1, kind: 'ascend' };
    for (const b of PP.BUILDINGS) {
      if (!Sim.unlocked(s, b, c)) {
        let prog = null;
        if (b.id === 'geothermal') prog = s.life.minerals / 30;
        if (b.id === 'iceHarvester') prog = c.pressure / 4;
        if (b.id === 'bioseed') prog = c.lifeHab / 12;
        if (b.id === 'settlement' && s.research.r_habitats) prog = c.bioHealth / 25;
        const rs = PP.RESEARCH.find((r) => b.req && b.req.indexOf(r.name) >= 0);
        if (rs && Sim.researchState(s, rs) === 'hidden') continue;
        return { text: 'Unlock ' + b.name + ': ' + (b.req || ''), prog: prog === null ? null : clamp(prog, 0, 1), kind: 'unlock', hint: ready ? ready + ' milestone(s) ready to claim' : null };
      }
    }
    const obj = Sim.objective(s);
    const best = obj.routes.reduce((a, b) => (b.prog > a.prog ? b : a));
    return { text: best.name + ': ' + best.goal, prog: best.prog, kind: 'objective' };
  };

  /** Plain-language reasons why habitability is low. */
  Sim.habitabilityAdvice = function (s) {
    const c = s.climate, f = c.f, tips = [];
    if (f.press < 0.8) tips.push('Pressure is low — build Atmospheric Processors.');
    if (f.water < 0.8) tips.push(c.temp < 0 ? 'Water is frozen — warm the planet (Geothermal, greenhouse gas).' : 'Little liquid water — build Ice Harvesters or Vapor Condensers.');
    if (f.temp < 0.8) tips.push(c.temp < c.comfortLo ? 'Too cold for life — add warming or raise the regulator setpoint.' : 'Too hot for life — plant forests, research Clean Processing, or use Climate Regulators.');
    if (f.rad < 0.7) tips.push('Radiation is high — thicker air, oxygen from life, Ozone Shielding.');
    if (f.poll < 0.85) tips.push('Pollution hurts life — forests absorb it; Clean Processing reduces it.');
    return tips;
  };
})(globalThis.PP = globalThis.PP || {});
