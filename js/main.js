/* Pocket Planet — game bootstrap, fixed-step simulation loop, render loop, autosave. */
(function (PP) {
  'use strict';
  const Sim = PP.Sim;
  const SIM_DT = 0.2;          // seconds per simulation step
  const AUTOSAVE_MS = 20000;

  const Game = (PP.Game = {
    s: null, renderer: null, lastSave: 0, acc: 0,
  });

  Game.refreshRates = function () {
    const m = Sim.mods(Game.s);
    Game.s._mods = m;
    Game.s._rates = Sim.rates(Game.s, m, SIM_DT);
  };

  Game.updateVisual = function (instant) {
    Game.renderer.setVisualTarget(PP.PlanetRenderer.visualFromState(Game.s), instant);
  };

  Game.save = function () {
    Game.s.lastTick = Date.now();
    if (PP.saveLocal(Game.s)) Game.lastSave = Date.now();
  };

  Game.loadWorld = function () {
    Game.renderer.setWorld(Game.s.world.seed, Game.s.world.traits);
    Game.refreshRates();
    Game.updateVisual(true);
  };

  /** Run elapsed real seconds of catch-up (app resumed, tab was hidden). */
  Game.catchUp = function (elapsed, showSummary) {
    if (!(elapsed > 0)) return;
    if (elapsed < 30) {
      // short gaps: just step normally
      const steps = Math.ceil(elapsed / SIM_DT);
      for (let i = 0; i < steps; i++) Sim.tick(Game.s, elapsed / steps);
      return;
    }
    const sum = Sim.offline(Game.s, elapsed);
    Sim.events.length = 0; // summarized instead of toasted one by one
    Game.refreshRates();
    Game.updateVisual();
    if (showSummary && elapsed >= 60) PP.UI.offlineModal(sum);
  };

  Game.ascend = function (nextSeed) {
    const s = Game.s;
    const thumb = Game.renderer.snapshot(96);
    const oldName = s.world.name;
    const r = Sim.ascend(s, nextSeed, thumb);
    if (!r) return;
    Game.s = r.state;
    Game.loadWorld();
    Game.save();
    PP.UI.applySettings();
    PP.UI.key = null;
    PP.UI.ascendedModal(oldName, r.seeds, thumb);
    PP.UI.openTab('archive');
  };

  Game.importText = function (txt) {
    try {
      const s = PP.importSave(txt);
      Game.s = s;
      Game.loadWorld();
      PP.UI.applySettings();
      Game.save();
      PP.UI.closeModal();
      PP.UI.key = null;
      PP.UI.toast('Save imported');
    } catch (e) {
      PP.UI.toast('Import failed: ' + PP.esc(e.message));
    }
  };

  Game.hardReset = function () {
    try { localStorage.removeItem(PP.SAVE_KEY); localStorage.removeItem(PP.BACKUP_KEY); } catch (e) { /* ignore */ }
    Game.s = PP.newGame();
    Game.loadWorld();
    PP.UI.applySettings();
    Game.save();
    PP.UI.closeModal();
    PP.UI.key = null;
    PP.UI.openTab(null);
    PP.UI.introModal();
  };

  // ------------------------------------------------------------ loops
  let lastFrame = 0, lastUi = 0, lastVis = 0, lastWall = Date.now();

  function simStep(realDt) {
    Game.acc += realDt;
    let n = 0;
    while (Game.acc >= SIM_DT && n < 50) { Sim.tick(Game.s, SIM_DT); Game.acc -= SIM_DT; n++; }
    if (n >= 50) Game.acc = 0;
    if (Sim.events.length) { PP.UI.handleEvents(Sim.events.splice(0)); }
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const now = Date.now();
    const wallDt = (now - lastWall) / 1000;
    lastWall = now;
    if (wallDt > 5) {
      // The page was suspended (rAF paused): catch up as offline time.
      Game.catchUp(wallDt, true);
    } else if (wallDt > 0) {
      simStep(wallDt);
    }
    const st = Game.s.settings;
    const minFrame = st.battery ? 1000 / 30 : 0;
    if (t - lastFrame >= minFrame - 1) {
      const dt = lastFrame ? (t - lastFrame) / 1000 : 0.016;
      lastFrame = t;
      Game.renderer.frame(dt);
    }
    if (t - lastUi > 250) { lastUi = t; PP.UI.update(); }
    if (t - lastVis > 1000) { lastVis = t; Game.updateVisual(); }
    if (now - Game.lastSave > AUTOSAVE_MS) Game.save();
  }

  // ------------------------------------------------------------ boot
  function boot() {
    const canvas = document.getElementById('planet');
    Game.renderer = new PP.PlanetRenderer(canvas);
    let loaded = PP.loadLocal();
    const fresh = !loaded;
    Game.s = loaded || PP.newGame();
    Game.loadWorld();
    PP.UI.init(Game);
    Game.renderer.resize();
    window.addEventListener('resize', () => Game.renderer.resize());
    if (!fresh) {
      const elapsed = Math.max(0, (Date.now() - (Game.s.lastTick || Date.now())) / 1000);
      Game.catchUp(elapsed, true);
    } else {
      PP.UI.introModal();
    }
    Game.refreshRates();
    Game.save();
    lastWall = Date.now();
    // The render loop notices a long gap on resume and runs it as offline time.
    document.addEventListener('visibilitychange', () => { if (document.hidden) Game.save(); });
    window.addEventListener('pagehide', () => Game.save());
    window.addEventListener('beforeunload', () => Game.save());
    requestAnimationFrame(loop);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline install unavailable */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis.PP = globalThis.PP || {});
