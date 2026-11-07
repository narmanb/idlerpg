/* Pocket Planet — game state creation, world generation traits, save/load. */
(function (PP) {
  'use strict';

  PP.SAVE_VERSION = 1;
  PP.SAVE_KEY = 'pocketPlanet.save';
  PP.BACKUP_KEY = 'pocketPlanet.save.bak';

  /** Deterministic world traits from a numeric seed. No trait is a dead end:
   * every penalty stays within a modest band and is offset elsewhere. */
  PP.worldTraits = function (seed) {
    const r = PP.rng(seed);
    const radius = 0.75 + r() * 0.55;            // 0.75 – 1.30
    const density = 0.8 + r() * 0.4;
    const t = {
      radius: +radius.toFixed(2),
      gravity: +(radius * density).toFixed(2),
      mineral: +(0.75 + r() * 0.75).toFixed(2),   // mineral richness
      baseTemp: Math.round(-95 + r() * 55),       // °C, -95 .. -40
      ice: +(0.6 + r() * 1.0).toFixed(2),          // ice content
      tectonic: +(0.6 + r() * 1.0).toFixed(2),     // tectonic activity
      remnant: +(r() * 0.12).toFixed(3),           // atmosphere remnants (fraction of K)
      hue: r(),                                    // rock palette
      tilt: 0.25 + r() * 0.3,
    };
    // Compensation: cold worlds get more tectonic heat; mineral-poor worlds get more ice.
    if (t.baseTemp < -80) t.tectonic = +(t.tectonic + 0.25).toFixed(2);
    if (t.mineral < 0.95) t.ice = +(t.ice + 0.2).toFixed(2);
    return t;
  };

  PP.traitSummary = function (t) {
    const tags = [];
    tags.push(t.radius >= 1.1 ? 'Large' : t.radius <= 0.9 ? 'Small' : 'Medium');
    if (t.mineral >= 1.25) tags.push('Mineral-rich'); else if (t.mineral <= 0.9) tags.push('Mineral-poor');
    if (t.ice >= 1.35) tags.push('Icy'); else if (t.ice <= 0.85) tags.push('Arid');
    if (t.tectonic >= 1.3) tags.push('Volcanic'); else if (t.tectonic <= 0.8) tags.push('Quiet core');
    if (t.baseTemp <= -80) tags.push('Frigid'); else if (t.baseTemp >= -50) tags.push('Mild');
    if (t.remnant >= 0.08) tags.push('Thin air remnant');
    return tags;
  };

  function zeroRes() {
    const o = {};
    PP.RESOURCES.forEach((r) => (o[r.id] = 0));
    return o;
  }
  function zeroBld() {
    const o = {};
    PP.BUILDINGS.forEach((b) => (o[b.id] = 0));
    return o;
  }

  PP.newMeta = function () {
    return {
      seeds: 0, totalSeeds: 0, ascensions: 0,
      upgrades: {}, archive: [], discoveries: {},
      bestTimes: {}, lifetimeAP: 0,
    };
  };

  PP.newSettings = function () {
    return { notation: 'sci', lowFx: false, reduceMotion: false, battery: false, fontScale: 1, buyAmt: 1, autoSpend: 1, showTips: true };
  };

  /** A fresh world. Keeps meta/settings when supplied. */
  PP.newWorld = function (seed, meta, settings) {
    meta = meta || PP.newMeta();
    const traits = PP.worldTraits(seed);
    const up = meta.upgrades;
    const s = {
      version: PP.SAVE_VERSION,
      created: Date.now(),
      lastTick: Date.now(),
      played: 0, worldTime: 0,
      world: { seed, name: PP.planetName(seed), traits },
      res: zeroRes(),
      life: zeroRes(),
      bld: zeroBld(),
      off: {},
      auto: {},
      autoOn: false,
      autoResearch: false,
      autoClaim: false,
      research: {},
      projects: {},
      projOff: {},
      milestones: {},
      directive: null,
      directiveAt: -1e9,
      setpoint: 18,
      climate: null,
      seen: {},
      log: [],
      meta,
      settings: settings || PP.newSettings(),
    };
    s.bld.solar = 1;
    s.res.energy = 20;
    const cap = up.u_capital || 0;
    if (cap > 0) {
      s.res.energy += 5000 * Math.pow(10, cap - 1);
      s.res.minerals += 2000 * Math.pow(10, cap - 1);
    }
    if (up.u_auto) s.autoOn = false; // available but opt-in
    s.climate = PP.Sim.initialClimate(s);
    return s;
  };

  PP.newGame = function () {
    const seed = (Math.random() * 4294967296) >>> 0;
    return PP.newWorld(seed);
  };

  // ------------------------------------------------------------------ Save
  function checksum(str) { return PP.hashStr(str).toString(36); }

  PP.serialize = function (s) {
    const data = JSON.stringify(s);
    return JSON.stringify({ v: PP.SAVE_VERSION, c: checksum(data), d: data });
  };

  PP.deserialize = function (text) {
    const wrap = JSON.parse(text);
    if (!wrap || typeof wrap.d !== 'string') throw new Error('Not a Pocket Planet save');
    if (checksum(wrap.d) !== wrap.c) throw new Error('Save checksum mismatch');
    const s = JSON.parse(wrap.d);
    return PP.migrate(s);
  };

  /** Fill in any fields missing from older saves; future versions upgrade here. */
  PP.migrate = function (s) {
    if (!s || !s.world || !s.res) throw new Error('Corrupt save');
    const fresh = PP.newWorld(s.world.seed, PP.newMeta(), PP.newSettings());
    const fill = (dst, src) => {
      for (const k in src) {
        if (dst[k] === undefined || dst[k] === null) dst[k] = src[k];
        else if (typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof dst[k] === 'object') fill(dst[k], src[k]);
      }
    };
    fill(s, fresh);
    // Sanitize numbers
    for (const k in s.res) if (!Number.isFinite(s.res[k]) || s.res[k] < 0) s.res[k] = 0;
    for (const k in s.bld) if (!Number.isFinite(s.bld[k]) || s.bld[k] < 0) s.bld[k] = 0;
    s.version = PP.SAVE_VERSION;
    return s;
  };

  PP.saveLocal = function (s) {
    try {
      const txt = PP.serialize(s);
      const prev = localStorage.getItem(PP.SAVE_KEY);
      if (prev) localStorage.setItem(PP.BACKUP_KEY, prev);
      localStorage.setItem(PP.SAVE_KEY, txt);
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  };

  PP.loadLocal = function () {
    let txt = null;
    try { txt = localStorage.getItem(PP.SAVE_KEY); } catch (e) { return null; }
    if (txt) {
      try { return PP.deserialize(txt); } catch (e) { console.warn('Main save invalid, trying backup', e); }
    }
    try {
      const bak = localStorage.getItem(PP.BACKUP_KEY);
      if (bak) return PP.deserialize(bak);
    } catch (e) { console.warn('Backup invalid', e); }
    return null;
  };

  PP.exportSave = function (s) {
    const txt = PP.serialize(s);
    return btoa(unescape(encodeURIComponent(txt)));
  };
  PP.importSave = function (b64) {
    const txt = decodeURIComponent(escape(atob(b64.trim())));
    return PP.deserialize(txt);
  };
})(globalThis.PP = globalThis.PP || {});
