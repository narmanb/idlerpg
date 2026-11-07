/* Pocket Planet — touch UI: resource bar, planet overlays, panels, toasts, modals. */
(function (PP) {
  'use strict';
  const Sim = PP.Sim, fmt = PP.fmt, esc = PP.esc, clamp = PP.clamp;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const UI = (PP.UI = {
    tab: null, key: null, game: null,
    branch: 'All', collapsedCats: {}, openCards: {},
  });

  // ------------------------------------------------------------ helpers
  function costHtml(s, cost) {
    return Object.keys(cost).map((r) => {
      const ok = s.res[r] >= cost[r] * 0.999999;
      return `<span class="${ok ? 'ok' : 'no'}">${PP.RES[r].icon} ${fmt(cost[r])}</span>`;
    }).join(' ');
  }
  function bar(p) { return `<div class="bar"><i style="width:${(clamp(p, 0, 1) * 100).toFixed(1)}%"></i></div>`; }
  function resSeen(s, r) { return r === 'energy' || r === 'minerals' || s.life[r] > 0 || s.res[r] > 0; }
  function timeTo(s, cost) {
    const net = s._rates ? s._rates.net : {};
    let t = 0;
    for (const r in cost) {
      const need = cost[r] - s.res[r];
      if (need <= 0) continue;
      if (!(net[r] > 0)) return Infinity;
      t = Math.max(t, need / net[r]);
    }
    return t;
  }
  function etaText(s, cost) {
    const t = timeTo(s, cost);
    if (t === 0) return '';
    if (!Number.isFinite(t)) return '<span class="muted">—</span>';
    return '<span class="muted">' + PP.fmtTime(t) + '</span>';
  }

  // ------------------------------------------------------------ init
  UI.init = function (game) {
    UI.game = game;
    $('#tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (b) UI.openTab(b.dataset.tab === UI.tab && !UI.isLandscape() ? null : b.dataset.tab);
    });
    document.addEventListener('click', onAction);
    document.addEventListener('input', onInput);
    $('#resbar').addEventListener('click', (e) => {
      const r = e.target.closest('.res');
      if (r) UI.showBreakdown(r.dataset.r);
    });
    $('#modalWrap').addEventListener('click', (e) => { if (e.target.id === 'modalWrap' && !UI.modalLocked) UI.closeModal(); });
    window.addEventListener('resize', () => { if (UI.isLandscape() && !UI.tab) UI.openTab('build'); });
    if (UI.isLandscape()) UI.openTab('build');
    UI.applySettings();
  };

  UI.isLandscape = () => window.matchMedia('(orientation: landscape) and (min-width: 720px)').matches;

  UI.applySettings = function () {
    const st = UI.game.s.settings;
    PP.notation = st.notation;
    document.documentElement.style.setProperty('--fs', st.fontScale || 1);
    document.body.classList.toggle('reduce-motion', !!st.reduceMotion);
    const r = UI.game.renderer;
    if (r) { r.quality = st.lowFx || st.battery ? 'low' : 'high'; r.reduceMotion = !!st.reduceMotion; }
  };

  UI.openTab = function (tab) {
    UI.tab = tab;
    UI.key = null;
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#panel').classList.toggle('collapsed', !tab);
    $('#panelBody').scrollTop = 0;
    UI.update(true);
    setTimeout(() => UI.game.renderer.resize(), 220);
  };

  // ------------------------------------------------------------ update loop
  UI.update = function () {
    const s = UI.game.s;
    if (!s._rates) return;
    renderResbar(s);
    renderOverlay(s);
    renderBadges(s);
    if (UI.tab) {
      const P = PANELS[UI.tab];
      const k = UI.tab + '|' + P.key(s);
      if (k !== UI.key) {
        UI.key = k;
        const body = $('#panelBody'), sc = body.scrollTop;
        $('#panelHead').innerHTML = P.head(s);
        body.innerHTML = P.body(s);
        body.scrollTop = sc;
      }
      P.update(s);
    }
  };

  function renderResbar(s) {
    const net = s._rates.net;
    const bar = $('#resbar');
    const vis = PP.RESOURCES.filter((r) => resSeen(s, r.id)).map((r) => r.id);
    const sig = vis.join(',');
    if (bar.dataset.sig !== sig) {
      bar.dataset.sig = sig;
      bar.innerHTML = vis.map((id) => `<div class="res" data-r="${id}" title="${PP.RES[id].name}"><span class="rv"><span class="ri">${PP.RES[id].icon}</span><span data-v></span></span><span class="rr" data-rr></span></div>`).join('');
    }
    for (const el of bar.children) {
      const id = el.dataset.r;
      el.querySelector('[data-v]').textContent = fmt(s.res[id]);
      const rr = el.querySelector('[data-rr]');
      rr.textContent = PP.fmtRate(net[id]);
      rr.classList.toggle('neg', net[id] < -1e-9);
    }
  }

  function statusClass(v, lo, hi) { return v >= hi ? 'good' : v >= lo ? 'warn' : 'bad'; }

  function renderOverlay(s) {
    const c = s.climate, t = s.world.traits;
    const tag = $('#worldTag');
    const sig = s.world.name + '|' + s.directive;
    if (tag.dataset.sig !== sig) {
      tag.dataset.sig = sig;
      const d = s.directive ? PP.DIR[s.directive] : null;
      tag.innerHTML = `<div class="wn">${esc(s.world.name)}</div><div class="wt">${PP.traitSummary(t).join(' · ')}</div>` +
        (d ? `<span class="wd" style="color:${d.color}">${d.name}</span>` : '');
    }
    const tempCls = c.temp >= c.comfortLo && c.temp <= c.comfortHi ? 'good' : (c.temp > c.comfortLo - 25 && c.temp < c.comfortHi + 25 ? 'warn' : 'bad');
    const rows = [
      `<div class="st ${tempCls}">🌡 <b>${c.temp.toFixed(0)}°C</b>${Math.abs(c.targetTemp - c.temp) > 1 ? (c.targetTemp > c.temp ? ' ▲' : ' ▼') : ''}</div>`,
      `<div class="st ${statusClass(c.pressure, 10, 30)}">◎ Pressure <b>${PP.pct(c.pressure)}</b></div>`,
    ];
    if (c.waterPot > 0.5 || s.bld.iceHarvester) rows.push(`<div class="st ${statusClass(c.liquid, 5, 25)}">≈ Ocean <b>${PP.pct(c.liquid)}</b>${c.ice >= 1 ? ` · ❄ ${PP.pct(c.ice)}` : ''}</div>`);
    if (c.pressure > 5) rows.push(`<div class="st ${statusClass(c.lifeHab, 15, 50)}">✿ Habitability <b>${PP.pct(c.lifeHab)}</b></div>`);
    if (c.veg > 0.5) rows.push(`<div class="st ${statusClass(c.bioHealth, 25, 60)}">🌿 Biosphere <b>${PP.pct(c.bioHealth)}</b></div>`);
    if (c.civLevel > 0.3) rows.push(`<div class="st good">🏙 Civilization <b>${PP.pct(c.civLevel)}</b></div>`);
    if (s.bld.processor) rows.push(`<div class="st ${statusClass(c.stability, 40, 70)}">⚖ Stability <b>${PP.pct(c.stability)}</b></div>`);
    $('#statusRow').innerHTML = rows.join('');

    // goal
    const g = UI.goal(s);
    $('#goalCard').innerHTML = `<div class="gl">Next goal</div><div>${esc(g.text)}</div>${g.prog !== null && g.prog !== undefined ? bar(g.prog) : ''}`;

    // claim chip
    const ready = Object.values(s.milestones).filter((v) => v === 'ready').length;
    const chip = $('#claimChip');
    chip.classList.toggle('hidden', !ready);
    chip.textContent = `✦ ${ready} milestone${ready > 1 ? 's' : ''} reached — Claim all`;

    // quick buy (only while panel is collapsed in portrait)
    const qb = $('#quickBuy');
    const show = !UI.tab && !UI.isLandscape();
    qb.classList.toggle('hidden', !show);
    if (show) {
      const id = UI.quickId(s);
      const b = PP.BLD[id];
      const cost = Sim.costFor(s, id, 1);
      const max = Sim.maxAffordable(s, id);
      const sig = id + '|' + (Sim.canAfford(s, cost) ? 1 : 0) + '|' + (max > 1 ? 1 : 0);
      const html = `<div class="qn"><b>${b.name}</b> <small>×${s.bld[id]}</small><br><span class="cost">${costHtml(s, cost)}</span></div>` +
        `<button class="btn small primary" data-action="buy" data-id="${id}" data-amt="1" ${Sim.canAfford(s, cost) ? '' : 'disabled'}>Buy</button>` +
        `<button class="btn small" data-action="buy" data-id="${id}" data-amt="max" ${max > 0 ? '' : 'disabled'}>MAX${max > 0 ? ' ' + max : ''}</button>`;
      if (qb.dataset.sig !== sig || qb.dataset.html !== html) { qb.dataset.sig = sig; qb.dataset.html = html; qb.innerHTML = html; }
    }
  }

  UI.quickId = function (s) {
    if (s.seen.lastBuy && PP.BLD[s.seen.lastBuy] && Sim.unlocked(s, PP.BLD[s.seen.lastBuy])) return s.seen.lastBuy;
    return s.bld.extractor ? 'solar' : 'extractor';
  };

  UI.goal = function (s) {
    if (!s.bld.extractor) return { text: 'Buy a Surface Extractor to start mining minerals', prog: s.res.energy / 15 };
    if (s.bld.solar < 3 && !s.bld.geothermal) return { text: 'Build more Solar Collectors to raise your energy income', prog: s.bld.solar / 3 };
    if (s.bld.processor && !s.research.r_solar1 && !s.research.r_mine1) return { text: 'Choose your first research in the Research tab', prog: s.res.energy / 250 };
    return Sim.nextGoal(s);
  };

  function renderBadges(s) {
    const avail = PP.RESEARCH.filter((r) => Sim.researchState(s, r) === 'available' && Sim.canAfford(s, r.cost)).length;
    $('#badge-research').textContent = avail || '';
    const ready = Object.values(s.milestones).filter((v) => v === 'ready').length;
    const m = s._mods;
    const needDir = m.features.directive && !s.directive ? 1 : 0;
    $('#badge-world').textContent = ready + needDir || '';
    $('#badge-archive').textContent = Sim.objective(s).done ? '!' : '';
  }

  // ------------------------------------------------------------ panels
  const PANELS = {};

  // ---- Build
  PANELS.build = {
    key(s) {
      const ul = PP.BUILDINGS.filter((b) => Sim.unlocked(s, b)).map((b) => b.id + (s.off[b.id] ? 0 : 1) + (s.auto[b.id] ? 1 : 0) + (UI.openCards[b.id] ? 'o' : ''));
      return ul.join(',') + '|' + s.settings.buyAmt + '|' + !!s._mods.features.autobuy + s.autoOn + '|' + JSON.stringify(UI.collapsedCats) + '|' + s.settings.autoSpend;
    },
    head(s) {
      const amts = [1, 10, 100, 'max'];
      let h = `<h2>Build</h2><div class="seg">` + amts.map((a) => `<button class="${s.settings.buyAmt === a ? 'on' : ''}" data-action="setAmt" data-amt="${a}">${a === 'max' ? 'MAX' : 'x' + a}</button>`).join('') + '</div>';
      if (s._mods.features.autobuy) h += `<button class="tgl ${s.autoOn ? 'on' : ''}" data-action="autoOn">Auto-buy ${s.autoOn ? 'ON' : 'OFF'}</button>`;
      return h;
    },
    body(s) {
      let h = '';
      if (s._mods.features.autobuy) {
        h += `<div class="small muted" style="margin-bottom:6px">Auto-buy spends up to <span class="seg">` +
          [1, 0.5, 0.25].map((p) => `<button class="${s.settings.autoSpend === p ? 'on' : ''}" data-action="autoSpend" data-v="${p}">${p * 100}%</button>`).join('') +
          `</span> of each resource on buildings marked <b>A</b>.</div>`;
      }
      let nextLocked = null;
      for (const cat of PP.BUILDING_CATS) {
        const list = PP.BUILDINGS.filter((b) => b.cat === cat && Sim.unlocked(s, b));
        if (!list.length) continue;
        const col = UI.collapsedCats[cat];
        h += `<h3 data-action="cat" data-cat="${cat}">${col ? '▸' : '▾'} ${cat}</h3>`;
        if (col) continue;
        for (const b of list) h += buildingCard(s, b);
      }
      nextLocked = PP.BUILDINGS.find((b) => !Sim.unlocked(s, b));
      if (nextLocked) {
        h += `<div class="card locked"><div class="bname">🔒 ${nextLocked.name}</div><div class="bdesc">${esc(nextLocked.desc)}</div><div class="small" style="margin-top:4px">Requires: ${esc(nextLocked.req || '')}</div></div>`;
      }
      return h;
    },
    update(s) {
      const amt = s.settings.buyAmt;
      for (const card of $$('#panelBody .card[data-b]')) {
        const id = card.dataset.b, b = PP.BLD[id];
        const info = s._rates.bld[id];
        const k = amt === 'max' ? Math.max(1, Sim.maxAffordable(s, id)) : amt;
        const cost = Sim.costFor(s, id, k);
        const can = Sim.canAfford(s, cost);
        set(card, '[data-count]', s.bld[id]);
        set(card, '[data-cost]', costHtml(s, cost) + ' ' + etaText(s, cost), true);
        const btn = card.querySelector('[data-action=buy]');
        btn.disabled = !can;
        btn.textContent = 'Buy ' + (amt === 'max' ? (Sim.maxAffordable(s, id) || 'MAX') : '×' + amt);
        let rate = '';
        if (info && info.each) rate = Object.keys(b.prod).map((r) => `${PP.RES[r].icon} ${fmt(info.each[r])}/s each · ${fmt((info.gross[r] || 0) * info.eff)}/s`).join('<br>');
        if (b.cons && s.bld[id]) rate += '<br>uses ' + Object.keys(b.cons).map((r) => `${PP.RES[r].icon} ${fmt(info.consBase[r] * info.eff)}/s`).join(' ');
        if (id === 'regulator' && s.bld[id]) rate = `Climate control strength ${PP.pct(s.climate.regStrength * 100)}` + (rate ? '<br>' + rate : '');
        set(card, '[data-rate]', rate, true);
        const warn = [];
        if (info && info.eff < 0.98 && info.n) warn.push(`<span class="pill bad">Input shortage ${PP.pct(info.eff * 100)}</span>`);
        if (b.env && s.bld[id]) { const e = b.env(s, s.climate); if (e[0] < 0.9) warn.push(`<span class="pill warn">${e[1]}: ${PP.pct(e[0] * 100)} output</span>`); }
        const nm = PP.nextCountMilestone(s.bld[id]);
        warn.push(`<span class="pill">Next bonus at ${nm}</span>`);
        set(card, '[data-warn]', warn.join(''), true);
        if (card.classList.contains('open') && info) {
          const f = info.factors.map(([n, v]) => `<div><span>${esc(n)}</span><b>×${fmt(v)}</b></div>`).join('');
          const em = b.emit ? Object.entries(b.emit).filter(([k]) => k === 'ghg' || k === 'poll').map(([k, v]) => `<div><span>${k === 'ghg' ? 'Greenhouse' : 'Pollution'} per building</span><b>${v > 0 ? '+' : ''}${v}</b></div>`).join('') : '';
          set(card, '[data-factors]', `<div class="muted">Why this output?</div>${f || '<div>No modifiers yet</div>'}${em}`, true);
        }
      }
    },
  };

  function buildingCard(s, b) {
    const climateBld = b.emit && (b.emit.ghg || b.emit.poll || b.emit.atmo || b.emit.water) || b.id === 'regulator';
    const off = s.off[b.id];
    return `<div class="card ${UI.openCards[b.id] ? 'open' : ''}" data-b="${b.id}">
      <div class="row">
        <div class="grow" data-action="cardInfo" data-id="${b.id}">
          <div class="row"><span class="bname">${b.name}</span>${off ? '<span class="pill bad">OFF</span>' : ''}</div>
          <div class="brate" data-rate></div>
        </div>
        <div class="bcount" data-count></div>
      </div>
      <div class="bdesc">${esc(b.desc)}</div>
      <div data-warn style="margin-top:3px"></div>
      <div class="row" style="margin-top:6px">
        <div class="grow cost" data-cost></div>
        ${climateBld ? `<button class="tgl ${off ? 'offp' : 'on'}" data-action="power" data-id="${b.id}" title="Switch this building type on or off">${off ? 'Off' : 'On'}</button>` : ''}
        ${s._mods.features.autobuy ? `<button class="tgl ${s.auto[b.id] ? 'on' : ''}" data-action="auto" data-id="${b.id}" title="Include in auto-buy">A</button>` : ''}
        <button class="btn primary buybtn" data-action="buy" data-id="${b.id}">Buy</button>
      </div>
      <div class="factors" data-factors></div>
    </div>`;
  }

  function set(root, sel, val, html) {
    const el = root.querySelector(sel);
    if (!el) return;
    const v = String(val);
    if (el._v === v) return;
    el._v = v;
    if (html) el.innerHTML = v; else el.textContent = v;
  }

  // ---- Research
  PANELS.research = {
    key(s) {
      return UI.branch + '|' + PP.RESEARCH.map((r) => Sim.researchState(s, r)[0]).join('') + '|' + (s._mods.features.autoresearch ? 1 : 0) + s.autoResearch;
    },
    head(s) {
      const brs = ['All'].concat(PP.BRANCHES.filter((b) => PP.RESEARCH.some((r) => r.br === b && Sim.researchState(s, r) !== 'hidden')));
      let h = '<h2>Research</h2>';
      if (s._mods.features.autoresearch) h += `<button class="tgl ${s.autoResearch ? 'on' : ''}" data-action="autoResearch">Auto ${s.autoResearch ? 'ON' : 'OFF'}</button>`;
      h += `<div class="seg">` + brs.map((b) => `<button class="${UI.branch === b ? 'on' : ''}" data-action="branch" data-v="${b}">${b}</button>`).join('') + '</div>';
      return h;
    },
    body(s) {
      const list = PP.RESEARCH.filter((r) => UI.branch === 'All' || r.br === UI.branch);
      const avail = list.filter((r) => Sim.researchState(s, r) === 'available');
      const locked = list.filter((r) => Sim.researchState(s, r) === 'locked' && r.req.some((q) => s.research[q]));
      const done = list.filter((r) => Sim.researchState(s, r) === 'done');
      let h = '';
      if (avail.length) {
        h += '<h3>Available</h3>';
        const choice = avail.filter((r) => r.choice);
        if (choice.length) h += `<div class="small muted" style="margin-bottom:6px">⚖ A choice: picking one of these locks the other for this world.</div>`;
        for (const r of avail) h += researchCard(s, r, 'available');
      } else h += '<div class="muted small" style="padding:6px 0">Nothing to research right now — keep developing your world.</div>';
      if (locked.length) {
        h += '<h3>Coming up</h3>';
        for (const r of locked) h += researchCard(s, r, 'locked');
      }
      if (done.length) {
        h += `<h3>Completed (${done.length})</h3>`;
        h += '<div class="small">' + done.map((r) => `<span class="pill good" title="${esc(r.desc)}">${r.name}</span>`).join('') + '</div>';
      }
      const ex = list.filter((r) => Sim.researchState(s, r) === 'excluded');
      if (ex.length) h += '<div class="small muted" style="margin-top:6px">Not chosen: ' + ex.map((r) => r.name).join(', ') + '</div>';
      return h;
    },
    update(s) {
      for (const card of $$('#panelBody .card[data-r]')) {
        const r = PP.RSR[card.dataset.r];
        set(card, '[data-cost]', costHtml(s, r.cost) + ' ' + etaText(s, r.cost), true);
        const btn = card.querySelector('button');
        if (btn) btn.disabled = !Sim.canAfford(s, r.cost);
      }
    },
  };

  function researchCard(s, r, st) {
    const reqNames = r.req.filter((q) => !s.research[q]).map((q) => PP.RSR[q].name);
    return `<div class="card ${st === 'locked' ? 'locked' : ''}" data-r="${r.id}">
      <div class="row"><div class="grow"><span class="bname">${r.name}</span> <span class="pill">${r.br}</span></div>
      ${st === 'available' ? `<button class="btn small primary" data-action="research" data-id="${r.id}">Research</button>` : ''}</div>
      <div class="bdesc">${esc(r.desc)}</div>
      <div class="cost" style="margin-top:4px" data-cost></div>
      ${st === 'locked' ? `<div class="small muted">Needs: ${reqNames.join(', ')}</div>` : ''}
    </div>`;
  }

  // ---- World
  PANELS.world = {
    key(s) {
      const ms = PP.MILESTONES.map((m) => (s.milestones[m.id] || '-')[0]).join('');
      const pj = PP.PROJECTS.map((p) => (s.projects[p.id] ? (s.projOff[p.id] ? 'o' : 'd') : p.req(s) ? 'a' : '-')).join('');
      return ms + '|' + pj + '|' + s.directive + '|' + !!s._mods.features.directive + '|' + !!s.research.r_climate + '|' + (Sim.directiveCooldown(s) > 0) + '|' + Sim.habitabilityAdvice(s).length;
    },
    head() { return '<h2>World</h2><span class="muted small">Climate · Directive · Projects · Milestones</span>'; },
    body(s) {
      const c = s.climate;
      let h = '';
      const ready = PP.MILESTONES.filter((m) => s.milestones[m.id] === 'ready');
      if (ready.length) {
        h += `<div class="card ready"><div class="row"><div class="grow"><b>${ready.length} milestone${ready.length > 1 ? 's' : ''} reached</b><div class="small muted">${ready.map((m) => m.name).join(', ')}</div></div><button class="btn warn" data-action="claimAll">Claim all</button></div></div>`;
      }
      h += '<h3>Planet status</h3><div class="card"><div class="climate-grid" id="climateGrid"></div><ul class="tips" id="habTips"></ul></div>';
      if (s.research.r_climate) {
        h += `<div class="card"><div class="row"><div class="grow"><b>Regulator setpoint</b><div class="small muted">Climate Regulators steer temperature toward this value.</div></div><b id="spv">${s.setpoint}°C</b></div>
          <input type="range" min="-40" max="70" step="1" value="${s.setpoint}" data-input="setpoint"></div>`;
      }
      // directive
      if (s._mods.features.directive) {
        const cd = Sim.directiveCooldown(s);
        h += `<h3>Planetary directive</h3><div class="small muted" style="margin-bottom:6px">Specialize this world. You can change it later${cd > 0 ? ` (available in <span id="dircd">${PP.fmtTime(cd)}</span>)` : ' (10 minute cooldown after each change)'}. Each directive also offers its own ascension route.</div><div class="dir-grid">`;
        for (const d of PP.DIRECTIVES) {
          h += `<div class="card ${s.directive === d.id ? 'sel' : ''}" data-action="directive" data-id="${d.id}">
            <div class="dn" style="color:${d.color}">${d.name}</div>
            <div class="small" style="color:var(--good)">+ ${esc(d.adv)}</div>
            <div class="small" style="color:var(--bad)">− ${esc(d.cost)}</div>
            <div class="small muted" style="margin-top:3px">Goal: ${esc(d.goal)}</div></div>`;
        }
        h += '</div>';
      } else {
        h += `<h3>Planetary directive</h3><div class="card locked small">🔒 Research <b>Planetary Directives</b> to specialize this world.</div>`;
      }
      // projects
      const projs = PP.PROJECTS.filter((p) => s.projects[p.id] || p.req(s));
      const nextP = PP.PROJECTS.find((p) => !s.projects[p.id] && !p.req(s));
      if (projs.length || nextP) h += '<h3>Planetary projects</h3>';
      for (const p of projs) {
        const done = s.projects[p.id];
        h += `<div class="card ${done && !p.toggle ? 'done' : ''}" data-p="${p.id}"><div class="row"><div class="grow"><span class="bname">${p.name}</span>${done ? ' <span class="pill good">Built</span>' : ''}</div>
          ${!done ? `<button class="btn small primary" data-action="project" data-id="${p.id}">Build</button>` : p.toggle ? `<button class="tgl ${s.projOff[p.id] ? 'offp' : 'on'}" data-action="projToggle" data-id="${p.id}">${s.projOff[p.id] ? 'Inactive' : 'Active'}</button>` : ''}</div>
          <div class="bdesc">${esc(p.desc)}</div>${!done ? '<div class="cost" data-cost style="margin-top:4px"></div>' : ''}</div>`;
      }
      if (nextP) h += `<div class="card locked small">🔒 ${nextP.name} — ${esc(nextP.reqText)}</div>`;
      // milestones
      h += '<h3>Milestones</h3>';
      for (const m of PP.MILESTONES) {
        const st = s.milestones[m.id];
        h += `<div class="card ${st === 'claimed' ? 'done' : st === 'ready' ? 'ready' : 'locked'} small"><div class="row"><div class="grow"><b>${m.name}</b> <span class="pill ${st ? 'good' : ''}">${m.reward}</span><div class="muted">${st ? esc(m.text) : '???'}</div></div>
          ${st === 'ready' ? `<button class="btn small warn" data-action="claim" data-id="${m.id}">Claim</button>` : st === 'claimed' ? '✓' : ''}</div></div>`;
      }
      return h;
    },
    update(s) {
      const c = s.climate;
      const g = $('#climateGrid');
      if (g) {
        const items = [
          ['Temperature', `${c.temp.toFixed(1)} °C → ${c.targetTemp.toFixed(0)}`, PP.plateau(c.temp, c.comfortLo - 35, c.comfortLo, c.comfortHi, c.comfortHi + 35)],
          ['Pressure', PP.pct(c.pressure), c.pressure / 100],
          ['Greenhouse', PP.pct(c.greenhouse), c.greenhouse / 100],
          ['Liquid water', PP.pct(c.liquid), c.liquid / 100],
          ['Ice', PP.pct(c.ice), c.ice / 100],
          ['Clouds', PP.pct(c.clouds), c.clouds / 100],
          ['Oxygen', PP.pct(c.oxygen), c.oxygen / 100],
          ['Radiation shield', PP.pct(c.shield), c.shield / 100],
          ['Pollution', PP.pct(c.pollution), c.pollution / 100],
          ['Life habitability', PP.pct(c.lifeHab), c.lifeHab / 100],
          ['Vegetation', PP.pct(c.veg), c.veg / 100],
          ['Biosphere health', PP.pct(c.bioHealth), c.bioHealth / 100],
          ['Civilization', PP.pct(c.civLevel), c.civLevel / 100],
          ['Climate stability', PP.pct(c.stability), c.stability / 100],
        ];
        g.innerHTML = items.map(([n, v, p]) => `<div class="cl"><div class="ct"><span>${n}</span><b>${v}</b></div>${bar(p)}</div>`).join('') +
          `<div class="cl" style="grid-column:1/3"><div class="ct muted"><span>Comfort band for life</span><b>${c.comfortLo}–${c.comfortHi} °C</b></div></div>`;
        const tips = Sim.habitabilityAdvice(s);
        $('#habTips').innerHTML = c.pressure > 3 ? tips.map((t) => `<li>${esc(t)}</li>`).join('') : '<li>Build Atmospheric Processors to begin an atmosphere.</li>';
      }
      const cd = $('#dircd'); if (cd) cd.textContent = PP.fmtTime(Sim.directiveCooldown(s));
      for (const card of $$('#panelBody .card[data-p]')) {
        const p = PP.PRJ[card.dataset.p];
        if (s.projects[p.id]) continue;
        set(card, '[data-cost]', costHtml(s, p.cost) + ' ' + etaText(s, p.cost), true);
        const btn = card.querySelector('[data-action=project]');
        if (btn) btn.disabled = !Sim.canAfford(s, p.cost);
      }
    },
  };

  // ---- Archive / prestige
  PANELS.archive = {
    key(s) {
      return s.meta.seeds + '|' + JSON.stringify(s.meta.upgrades) + '|' + s.meta.archive.length + '|' + Sim.objective(s).done + '|' + Object.keys(s.meta.discoveries).length + '|' + s.directive;
    },
    head(s) { return `<h2>Archive</h2><span class="pill good">🌱 ${fmt(s.meta.seeds)} World Seeds</span>`; },
    body(s) {
      const obj = Sim.objective(s);
      let h = '<h3>Planetary ascension</h3><div class="card">';
      h += '<div class="small muted">Complete any route to ascend this world into your archive. It becomes a legacy world and you start a new planet with permanent World Seeds.</div>';
      for (const r of obj.routes) h += `<div style="margin-top:8px"><div class="row small"><b class="grow">${r.done ? '✓ ' : ''}${esc(r.name)}</b><span data-prog="${esc(r.name)}"></span></div><div class="small muted">${esc(r.goal)}</div><div data-bar="${esc(r.name)}">${bar(r.prog)}</div></div>`;
      h += `<div class="row" style="margin-top:10px"><div class="grow small">Ascension Potential <b data-ap></b><br>Reward now: <b data-seeds style="color:var(--good)"></b> World Seeds</div>
        <button class="btn ${obj.done ? 'good' : ''}" data-action="ascend" ${obj.done ? '' : 'disabled'}>Ascend</button></div>`;
      h += '<div class="small muted" style="margin-top:4px">Seeds grow with everything this world produces — staying longer yields more. Unspent seeds give +4% production each.</div></div>';
      h += `<h3>Permanent upgrades</h3><div class="small muted" style="margin-bottom:6px">Current permanent multiplier: <b data-pm></b></div>`;
      for (const u of PP.UPGRADES) {
        const lvl = s.meta.upgrades[u.id] || 0;
        const maxed = lvl >= u.max;
        const cost = PP.upgradeCost(u, lvl);
        h += `<div class="card ${maxed ? 'done' : ''}"><div class="row"><div class="grow"><span class="bname">${u.name}</span> <span class="pill">${u.max > 1 ? `Lv ${lvl}/${u.max}` : lvl ? 'Owned' : ''}</span><div class="bdesc">${esc(u.desc)}</div></div>
          ${maxed ? '✓' : `<button class="btn small ${s.meta.seeds >= cost ? 'good' : ''}" data-action="upgrade" data-id="${u.id}" ${s.meta.seeds >= cost ? '' : 'disabled'}>🌱 ${cost}</button>`}</div></div>`;
      }
      h += `<h3>Legacy worlds (${s.meta.archive.length})</h3>`;
      if (!s.meta.archive.length) h += '<div class="small muted">Ascended worlds are kept here forever, each adding a permanent bonus (more for distinct specializations).</div>';
      else {
        h += `<div class="small muted" style="margin-bottom:6px">Legacy bonus: ×${fmt(Sim.legacyBonus(s.meta))} all production</div><div class="legacy">`;
        for (const w of s.meta.archive.slice().reverse()) {
          const d = w.directive ? PP.DIR[w.directive] : null;
          h += `<div class="lw">${w.thumb ? `<img src="${w.thumb}" alt="">` : '<div class="noimg"></div>'}<b>${esc(w.name)}</b><br><span style="color:${d ? d.color : 'var(--dim)'}">${d ? d.name : 'Generalist'}</span><br><span class="muted">${PP.fmtTime(w.time)} · 🌱${w.seeds}</span></div>`;
        }
        h += '</div>';
      }
      h += `<h3>Discovery records</h3><div class="small muted" style="margin-bottom:6px">Permanent, across all worlds: +${PP.DISC_BONUS * 100}% production each.</div>`;
      for (const d of PP.DISCOVERIES) {
        const got = s.meta.discoveries[d.id];
        h += `<div class="card small ${got ? '' : 'locked'}"><b>${got ? '★' : '☆'} ${d.name}</b> <span class="muted">— ${esc(d.text)}${got ? ' (' + esc(got.world) + ')' : ''}</span></div>`;
      }
      return h;
    },
    update(s) {
      const pv = Sim.seedPreview(s);
      set($('#panelBody'), '[data-ap]', fmt(pv.ap));
      set($('#panelBody'), '[data-seeds]', fmt(pv.seeds));
      set($('#panelBody'), '[data-pm]', '×' + fmt(Sim.prestigeMult(s)));
      const obj = Sim.objective(s);
      for (const r of obj.routes) {
        const el = $(`#panelBody [data-bar="${CSS.escape(r.name)}"]`);
        if (el) set(el.parentNode, `[data-bar="${CSS.escape(r.name)}"]`, bar(r.prog), true);
        set($('#panelBody'), `[data-prog="${CSS.escape(r.name)}"]`, PP.pct(r.prog * 100));
      }
    },
  };

  // ---- Settings & stats
  PANELS.stats = {
    key(s) { return JSON.stringify(s.settings) + '|' + UI.bdRes; },
    head() { return '<h2>Stats & Settings</h2>'; },
    body(s) {
      const st = s.settings;
      const seg = (key, opts) => `<span class="seg">` + opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-action="setting" data-k="${key}" data-v='${JSON.stringify(v)}'>${l}</button>`).join('') + '</span>';
      let h = '<h3>Production breakdown</h3>';
      const rs = PP.RESOURCES.filter((r) => resSeen(s, r.id));
      UI.bdRes = UI.bdRes || 'energy';
      h += '<div class="seg" style="flex-wrap:wrap;margin-bottom:6px">' + rs.map((r) => `<button class="${UI.bdRes === r.id ? 'on' : ''}" data-action="bdRes" data-v="${r.id}">${r.icon}</button>`).join('') + '</div>';
      h += '<div class="card" id="breakdown"></div>';
      h += '<h3>Settings</h3><div class="card">';
      h += `<div class="row" style="margin-bottom:8px"><span class="grow">Number notation</span>${seg('notation', [['sci', '1.2e9'], ['eng', '1.2e9 eng'], ['suffix', '1.2B']])}</div>`;
      h += `<div class="row" style="margin-bottom:8px"><span class="grow">Text size</span>${seg('fontScale', [[0.9, 'S'], [1, 'M'], [1.15, 'L'], [1.3, 'XL']])}</div>`;
      h += `<div class="row" style="margin-bottom:8px"><span class="grow">Low effects mode<br><small class="muted">Smaller planet texture, fewer updates</small></span>${seg('lowFx', [[false, 'Off'], [true, 'On']])}</div>`;
      h += `<div class="row" style="margin-bottom:8px"><span class="grow">Battery saver<br><small class="muted">30 FPS cap, pauses when idle</small></span>${seg('battery', [[false, 'Off'], [true, 'On']])}</div>`;
      h += `<div class="row"><span class="grow">Reduce motion</span>${seg('reduceMotion', [[false, 'Off'], [true, 'On']])}</div>`;
      h += '</div><h3>Save</h3><div class="card"><div class="small muted" id="saveInfo"></div><div class="row" style="flex-wrap:wrap;margin-top:8px">' +
        '<button class="btn small" data-action="save">Save now</button><button class="btn small" data-action="export">Export</button><button class="btn small" data-action="import">Import</button><button class="btn small danger" data-action="reset">Reset all</button></div></div>';
      h += '<h3>Statistics</h3><div class="card small" id="statsBox"></div>';
      h += '<h3>About</h3><div class="card small muted">Pocket Planet — an idle terraforming game. No ads, no energy limits. Progress continues while you are away (up to 24 h at full speed, more with upgrades).</div>';
      return h;
    },
    update(s) {
      const r = UI.bdRes || 'energy';
      const rt = s._rates;
      const rows = [];
      for (const b of PP.BUILDINGS) {
        const info = rt.bld[b.id];
        if (!info || !info.owned) continue;
        if (info.gross[r]) rows.push([b.name + ' ×' + info.n, info.gross[r] * info.eff]);
        if (info.consBase[r]) rows.push([b.name + ' (uses)', -info.consBase[r] * info.eff]);
      }
      rows.sort((a, b) => b[1] - a[1]);
      const bd = $('#breakdown');
      if (bd) {
        bd.innerHTML = `<table class="bd">${rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td style="color:${v < 0 ? 'var(--bad)' : 'var(--good)'}">${v < 0 ? '' : '+'}${fmt(v)}/s</td></tr>`).join('') || '<tr><td class="muted">No sources yet</td><td></td></tr>'}
          <tr><td><b>Net</b></td><td><b>${PP.fmtRate(rt.net[r])}</b></td></tr></table>
          ${rt.demand[r] > 0 && rt.resEff[r] < 0.999 ? `<div class="small" style="color:var(--bad);margin-top:4px">Shortage: consumers are running at ${PP.pct(rt.resEff[r] * 100)}. Build more ${PP.RES[r].name.toLowerCase()} producers or switch some consumers off.</div>` : ''}`;
      }
      const si = $('#saveInfo');
      if (si) si.textContent = 'Autosaves every 20 seconds and when the app is hidden. Last save: ' + (UI.game.lastSave ? new Date(UI.game.lastSave).toLocaleTimeString() : 'never');
      const sb = $('#statsBox');
      if (sb) {
        const m = s.meta;
        sb.innerHTML = `<table class="bd">
          <tr><td>Time on this world</td><td>${PP.fmtTime(s.worldTime)}</td></tr>
          <tr><td>Total time played</td><td>${PP.fmtTime(s.played)}</td></tr>
          <tr><td>Ascensions</td><td>${m.ascensions}</td></tr>
          <tr><td>World Seeds earned</td><td>${fmt(m.totalSeeds)}</td></tr>
          <tr><td>Fastest ascension</td><td>${m.bestTimes.ascend ? PP.fmtTime(m.bestTimes.ascend) : '—'}</td></tr>
          <tr><td>Permanent multiplier</td><td>×${fmt(Sim.prestigeMult(s))}</td></tr>
          <tr><td>Buildings on this world</td><td>${fmt(Object.values(s.bld).reduce((a, b) => a + b, 0))}</td></tr>
          <tr><td>World seed</td><td>${s.world.seed}</td></tr></table>`;
      }
    },
  };

  // ------------------------------------------------------------ actions
  function onAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const g = UI.game, s = g.s, a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case 'buy': {
        const amtAttr = el.dataset.amt;
        const amt = amtAttr ? (amtAttr === 'max' ? 'max' : +amtAttr) : s.settings.buyAmt;
        const n = Sim.buy(s, id, amt);
        if (n) { s.seen.lastBuy = id; g.refreshRates(); }
        break;
      }
      case 'setAmt': s.settings.buyAmt = el.dataset.amt === 'max' ? 'max' : +el.dataset.amt; break;
      case 'autoOn': s.autoOn = !s.autoOn; break;
      case 'autoSpend': s.settings.autoSpend = +el.dataset.v; break;
      case 'auto': s.auto[id] = !s.auto[id]; break;
      case 'power': s.off[id] = !s.off[id]; g.refreshRates(); break;
      case 'cat': UI.collapsedCats[el.dataset.cat] = !UI.collapsedCats[el.dataset.cat]; break;
      case 'cardInfo': UI.openCards[id] = !UI.openCards[id]; break;
      case 'branch': UI.branch = el.dataset.v; break;
      case 'research': if (Sim.buyResearch(s, id)) g.refreshRates(); break;
      case 'autoResearch': s.autoResearch = !s.autoResearch; break;
      case 'project': if (Sim.buyProject(s, id)) g.refreshRates(); break;
      case 'projToggle': s.projOff[id] = !s.projOff[id]; g.refreshRates(); break;
      case 'directive': UI.confirmDirective(id); break;
      case 'claim': if (Sim.claim(s, id)) { g.refreshRates(); UI.toast(`Claimed: ${PP.MIL[id].reward}`); } break;
      case 'claimAll': { const n = Sim.claimAll(s); if (n) { g.refreshRates(); UI.toast(`Claimed ${n} milestone${n > 1 ? 's' : ''}`); } break; }
      case 'upgrade': if (Sim.buyUpgrade(s, id)) g.refreshRates(); break;
      case 'ascend': UI.ascendModal(); break;
      case 'doAscend': g.ascend(+el.dataset.seed); break;
      case 'reroll': s.seen.reroll = (s.seen.reroll || 0) + 1; s.seen.rerolled = 1; UI.ascendModal(); break;
      case 'setting': {
        s.settings[el.dataset.k] = JSON.parse(el.dataset.v);
        UI.applySettings();
        break;
      }
      case 'bdRes': UI.bdRes = el.dataset.v; break;
      case 'save': g.save(); UI.toast('Saved'); break;
      case 'export': UI.exportModal(); break;
      case 'import': UI.importModal(); break;
      case 'doImport': g.importText($('#impText').value); break;
      case 'reset': UI.resetModal(); break;
      case 'doReset': g.hardReset(); break;
      case 'copyExport': { const t = $('#expText'); t.select(); try { navigator.clipboard.writeText(t.value); UI.toast('Copied to clipboard'); } catch (err) { document.execCommand('copy'); } break; }
      case 'downloadExport': {
        const blob = new Blob([$('#expText').value], { type: 'text/plain' });
        const aEl = document.createElement('a');
        aEl.href = URL.createObjectURL(blob); aEl.download = 'pocket-planet-save.txt'; aEl.click();
        setTimeout(() => URL.revokeObjectURL(aEl.href), 2000);
        break;
      }
      case 'closeModal': UI.closeModal(); break;
      default: return;
    }
    UI.key = null;
    UI.update();
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.input === 'setpoint') {
      UI.game.s.setpoint = +el.value;
      const v = $('#spv'); if (v) v.textContent = el.value + '°C';
    }
  }

  // ------------------------------------------------------------ toasts
  UI.toast = function (html, opts) {
    opts = opts || {};
    const box = $('#toasts');
    while (box.children.length > 3) box.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast' + (opts.big ? ' big' : '') + (opts.gold ? ' gold' : '');
    t.innerHTML = opts.title ? `<div class="tt">${opts.title}</div><div>${html}</div>` : html;
    box.appendChild(t);
    const life = opts.big ? 5200 : 2600;
    setTimeout(() => t.classList.add('fade'), life);
    setTimeout(() => t.remove(), life + 700);
  };

  UI.handleEvents = function (events) {
    const s = UI.game.s;
    for (const e of events) {
      if (e.type === 'milestone') {
        const m = PP.MIL[e.id];
        UI.toast(esc(m.text) + `<div class="small muted">Reward: ${m.reward}</div>`, { big: true, title: m.name });
      } else if (e.type === 'discovery') {
        const d = PP.DISCOVERIES.find((x) => x.id === e.id);
        UI.toast(`Permanent +${PP.DISC_BONUS * 100}% production`, { big: true, gold: true, title: '★ Discovery: ' + d.name });
      } else if (e.type === 'unlock') {
        UI.toast(`🔓 New building: <b>${PP.BLD[e.id].name}</b>`);
      } else if (e.type === 'research') {
        const r = PP.RSR[e.id];
        if (r.intro === 'biosphere' && !s.seen.introBio) { s.seen.introBio = 1; UI.bioIntro(); }
        if (e.id === 'r_directive' && !s.seen.introDir) { s.seen.introDir = 1; UI.toast('Planetary Directives unlocked — choose one in the <b>World</b> tab', { big: true, title: 'A first major choice' }); }
        if (e.id === 'r_auto1') UI.toast('Auto-buy unlocked: mark buildings with <b>A</b> in the Build tab and switch Auto-buy on.', { big: true, title: 'Automation' });
      } else if (e.type === 'project') {
        UI.toast(`Project complete: <b>${PP.PRJ[e.id].name}</b>`, { big: true, title: 'Planetary project' });
      } else if (e.type === 'ascendReady') {
        UI.toast('This world can now be ascended from the Archive tab.', { big: true, gold: true, title: 'World complete' });
      } else if (e.type === 'firstBuild' && e.id === 'extractor' && !s.seen.firstExtractor) {
        s.seen.firstExtractor = 1;
        UI.toast('Excavation lights flicker on the surface.');
      }
    }
  };

  // ------------------------------------------------------------ modals
  UI.modal = function (html, locked) {
    UI.modalLocked = !!locked;
    $('#modal').innerHTML = html;
    $('#modalWrap').classList.remove('hidden');
  };
  UI.closeModal = function () { $('#modalWrap').classList.add('hidden'); UI.modalLocked = false; };

  UI.introModal = function () {
    UI.modal(`<h2>Pocket Planet</h2>
      <p>A barren, slowly turning rock — and you. Produce energy, mine minerals, thicken the air, melt the ice, seed the oceans and raise a living, technological world.</p>
      <p class="muted small">Drag the planet to rotate it, pinch to zoom. Your world keeps developing while the app is closed.</p>
      <div class="actions"><button class="btn primary" data-action="closeModal">Begin</button></div>`);
  };

  UI.bioIntro = function () {
    UI.modal(`<h2>🌿 The Biosphere</h2>
      <p>Microbes have taken hold in the young oceans. Life now produces <b>Biomass</b> and <b>Oxygen</b>, which thickens your radiation shield and stabilises the climate.</p>
      <p class="small muted">Life thrives between its comfort temperatures with liquid water, enough pressure and low pollution. Check the <b>World</b> tab for what is holding it back.</p>
      <div class="actions"><button class="btn primary" data-action="closeModal">Wonderful</button></div>`);
  };

  UI.offlineModal = function (sum) {
    if (!sum) return;
    const gained = Object.entries(sum.gained).filter(([, v]) => v > 0.5).map(([r, v]) => `<tr><td>${PP.RES[r].icon} ${PP.RES[r].name}</td><td>+${fmt(v)}</td></tr>`).join('');
    const c = sum.climate;
    const ch = [];
    if (Math.abs(c.temp[1] - c.temp[0]) >= 1) ch.push(`Temperature ${c.temp[0].toFixed(0)} → ${c.temp[1].toFixed(0)} °C`);
    if (c.pressure[1] - c.pressure[0] >= 1) ch.push(`Pressure ${c.pressure[0].toFixed(0)} → ${c.pressure[1].toFixed(0)}%`);
    if (c.liquid[1] - c.liquid[0] >= 1) ch.push(`Oceans ${c.liquid[0].toFixed(0)} → ${c.liquid[1].toFixed(0)}%`);
    if (c.veg[1] - c.veg[0] >= 1) ch.push(`Vegetation ${c.veg[0].toFixed(0)} → ${c.veg[1].toFixed(0)}%`);
    if (c.civ[1] - c.civ[0] >= 1) ch.push(`Civilization ${c.civ[0].toFixed(0)} → ${c.civ[1].toFixed(0)}%`);
    UI.modal(`<h2>While you were away</h2>
      <div class="small muted">${PP.fmtTime(sum.elapsed)} passed${sum.simTime < sum.elapsed - 1 ? ` (${PP.fmtTime(sum.simTime)} simulated — raise the cap with Dreaming Machines)` : ''}.</div>
      ${ch.length ? '<h3>Your planet changed</h3><ul class="small">' + ch.map((x) => `<li>${x}</li>`).join('') + '</ul>' : ''}
      ${sum.milestones.length ? '<h3>Milestones reached</h3><div class="small">' + sum.milestones.map((id) => `<span class="pill good">${PP.MIL[id].name}</span>`).join('') + '</div>' : ''}
      ${sum.unlocks.length ? '<h3>Unlocked</h3><div class="small">' + sum.unlocks.map((id) => `<span class="pill">${PP.BLD[id].name}</span>`).join('') + '</div>' : ''}
      ${sum.bought ? `<div class="small" style="margin-top:6px">Auto-buy built ${sum.bought} buildings${sum.research ? ` and completed ${sum.research} research` : ''}.</div>` : ''}
      <h3>Resources gathered</h3><table class="bd">${gained || '<tr><td class="muted">Nothing yet</td><td></td></tr>'}</table>
      <div class="actions"><button class="btn primary" data-action="closeModal">Continue</button></div>`);
  };

  UI.confirmDirective = function (id) {
    const s = UI.game.s, d = PP.DIR[id];
    if (s.directive === id) return;
    const cd = Sim.directiveCooldown(s);
    if (cd > 0) { UI.toast(`Directive can be changed in ${PP.fmtTime(cd)}`); return; }
    UI.modal(`<h2 style="color:${d.color}">${d.name}</h2>
      <p class="small" style="color:var(--good)">+ ${esc(d.adv)}</p><p class="small" style="color:var(--bad)">− ${esc(d.cost)}</p>
      <p class="small muted">Ascension route: ${esc(d.goal)}</p>
      <p class="small muted">You can switch again after a 10 minute cooldown.</p>
      <div class="actions"><button class="btn" data-action="closeModal">Cancel</button><button class="btn primary" id="dirOk">Adopt directive</button></div>`);
    $('#dirOk').onclick = () => { Sim.setDirective(s, id); UI.game.refreshRates(); UI.closeModal(); UI.key = null; UI.update(); UI.game.updateVisual(); };
  };

  UI.ascendModal = function () {
    const s = UI.game.s;
    const pv = Sim.seedPreview(s);
    const n = s.meta.upgrades.u_cartography ? 3 : 1;
    const cands = Sim.candidateSeeds(s, n);
    let h = `<h2>Ascend ${esc(s.world.name)}?</h2>
      <p class="small">Your world joins the Archive as a legacy world. You will receive <b style="color:var(--good)">🌱 ${pv.seeds} World Seeds</b> and begin a new planet. Buildings, resources, research and projects reset; seeds, upgrades, the archive and discoveries are kept.</p>
      <h3>${n > 1 ? 'Choose your next world' : 'Your next world'}</h3>`;
    for (const sd of cands) {
      const t = PP.worldTraits(sd);
      h += `<div class="card"><div class="row"><div class="grow"><b>${esc(PP.planetName(sd))}</b><div class="small muted">${PP.traitSummary(t).join(' · ')} · ${t.baseTemp} °C</div>
        <div class="small muted">Minerals ×${t.mineral} · Ice ×${t.ice} · Tectonics ×${t.tectonic} · Radius ${t.radius}</div></div>
        <button class="btn good small" data-action="doAscend" data-seed="${sd}">Ascend</button></div></div>`;
    }
    h += `<div class="actions">${n > 1 && !s.seen.rerolled ? '<button class="btn small" data-action="reroll">Reroll candidates (once)</button>' : ''}<button class="btn" data-action="closeModal">Not yet</button></div>`;
    UI.modal(h);
  };

  UI.ascendedModal = function (oldName, seeds, thumb) {
    UI.modal(`<h2>✦ ${esc(oldName)} ascends</h2>
      ${thumb ? `<img src="${thumb}" style="width:120px;height:120px;display:block;margin:6px auto;border-radius:50%">` : ''}
      <p>The finished world drifts into your cosmic archive. You gained <b style="color:var(--good)">🌱 ${seeds} World Seeds</b>.</p>
      <p class="small muted">Spend them on permanent upgrades in the Archive tab before your new world gets going.</p>
      <div class="actions"><button class="btn primary" data-action="closeModal">To the new world</button></div>`);
  };

  UI.exportModal = function () {
    const txt = PP.exportSave(UI.game.s);
    UI.modal(`<h2>Export save</h2><p class="small muted">Copy this text somewhere safe, or download it as a file.</p>
      <textarea id="expText" readonly>${txt}</textarea>
      <div class="actions"><button class="btn small" data-action="downloadExport">Download</button><button class="btn small" data-action="copyExport">Copy</button><button class="btn primary small" data-action="closeModal">Done</button></div>`);
  };

  UI.importModal = function () {
    UI.modal(`<h2>Import save</h2><p class="small muted">Paste an exported save. This replaces your current game.</p>
      <textarea id="impText" placeholder="Paste save text here"></textarea>
      <div class="actions"><button class="btn" data-action="closeModal">Cancel</button><button class="btn primary" data-action="doImport">Import</button></div>`);
  };

  UI.resetModal = function () {
    UI.modal(`<h2>Reset everything?</h2><p>This permanently deletes your worlds, seeds, archive and discoveries. Consider exporting first.</p>
      <div class="actions"><button class="btn" data-action="closeModal">Cancel</button><button class="btn danger" data-action="doReset">Delete everything</button></div>`);
  };

  UI.showBreakdown = function (r) {
    UI.bdRes = r;
    UI.openTab('stats');
  };
})(globalThis.PP = globalThis.PP || {});
