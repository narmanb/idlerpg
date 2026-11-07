/* Pocket Planet — procedural planet renderer.
 * A software "sphere shader" on a 2D canvas: seeded equirectangular maps are
 * composed into a surface texture whenever the climate visibly changes, and
 * each frame samples that texture onto a lit, rotating sphere with clouds,
 * atmosphere scattering, night-side lights, orbital stations and rings. */
(function (PP) {
  'use strict';
  const S = PP.smooth, clamp = PP.clamp;
  const MW = 384, MH = 192;

  class PlanetRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.off = document.createElement('canvas');
      this.offCtx = this.off.getContext('2d');
      this.rot = 0; this.rotVel = 0; this.tilt = 0.32; this.zoom = 1;
      this.cloudRot = 0; this.time = 0;
      this.quality = 'high';
      this.reduceMotion = false;
      this.vis = null; this.visTarget = null; this.lastComposeVis = null;
      this.composeTimer = 0;
      this.stars = null;
      this.size = 0;
      this.dragging = false;
      this._bindInput();
    }

    // ---------------------------------------------------------- World maps
    setWorld(seed, traits) {
      this.seed = seed; this.traits = traits;
      const N = MW * MH;
      const nH = PP.makeNoise3(seed), nV = PP.makeNoise3(seed ^ 0xa5a5), nC = PP.makeNoise3(seed ^ 0x5151);
      const nL = PP.makeNoise3(seed ^ 0x7777);
      this.height = new Float32Array(N);
      this.vegN = new Float32Array(N);
      this.cloudN = new Float32Array(N);
      this.cityN = new Float32Array(N);
      this.lavaN = new Float32Array(N);
      this.detail = new Float32Array(N);
      this.latN = new Float32Array(MH);
      this.cosLat = new Float32Array(MH);
      const rnd = PP.rng(seed ^ 0x1234);
      const ox = rnd() * 50, oy = rnd() * 50, oz = rnd() * 50;
      // craters
      const craters = [];
      const nCr = 26 + Math.floor(rnd() * 14);
      for (let k = 0; k < nCr; k++) {
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
        craters.push({ x: rr * Math.cos(th), y: u, z: rr * Math.sin(th), r: 0.04 + Math.pow(rnd(), 2.2) * 0.22, d: 0.5 + rnd() * 0.6 });
      }
      for (let y = 0; y < MH; y++) {
        const lat = (0.5 - (y + 0.5) / MH) * Math.PI;
        this.latN[y] = Math.abs(lat) / (Math.PI / 2);
        this.cosLat[y] = Math.cos(lat);
        const cy = Math.sin(lat), cl = Math.cos(lat);
        for (let x = 0; x < MW; x++) {
          const lon = (x + 0.5) / MW * Math.PI * 2;
          const px = cl * Math.cos(lon), pz = cl * Math.sin(lon), py = cy;
          const i = y * MW + x;
          let h = nH.fbm(px * 1.6 + ox, py * 1.6 + oy, pz * 1.6 + oz, 6);
          // continental shaping
          h = h * 0.75 + 0.25 * nH.fbm(px * 0.7 - oy, py * 0.7 + oz, pz * 0.7 + ox, 3);
          let cr = 0;
          for (const c of craters) {
            const d = Math.acos(clamp(px * c.x + py * c.y + pz * c.z, -1, 1));
            if (d < c.r * 1.35) {
              const t = d / c.r;
              if (t < 1) cr -= c.d * 0.12 * (1 - t * t);
              else cr += c.d * 0.05 * (1 - (t - 1) / 0.35);
            }
          }
          this.height[i] = h + cr * 0.9;
          this.detail[i] = nH.noise(px * 22 + 3, py * 22, pz * 22);
          this.vegN[i] = nV.fbm(px * 3 + 9, py * 3, pz * 3, 4);
          { const wx = nC.noise(px * 1.5 + 11, py * 1.5, pz * 1.5) * 0.9; this.cloudN[i] = nC.fbm(px * 2.6 + 5 + wx, py * 5.5, pz * 2.6 + wx, 6, 2.1, 0.58); }
          this.cityN[i] = nV.fbm(px * 9 - 4, py * 9, pz * 9 + 2, 3);
          const lv = nL.fbm(px * 3.5, py * 3.5, pz * 3.5, 4);
          this.lavaN[i] = 1 - Math.abs(lv * 2 - 1); // ridges
        }
      }
      // weighted height distribution so "coverage %" corresponds to surface area
      const idx = new Uint32Array(N);
      for (let i = 0; i < N; i++) idx[i] = i;
      const H = this.height;
      const sorted = Array.from(idx).sort((a, b) => H[a] - H[b]);
      this.sortedH = new Float32Array(N);
      this.cumW = new Float32Array(N);
      let tot = 0;
      for (let k = 0; k < N; k++) { tot += this.cosLat[Math.floor(sorted[k] / MW)]; }
      let acc = 0;
      for (let k = 0; k < N; k++) {
        const i = sorted[k];
        acc += this.cosLat[Math.floor(i / MW)];
        this.sortedH[k] = H[i]; this.cumW[k] = acc / tot;
      }
      this.hMin = this.sortedH[0]; this.hMax = this.sortedH[N - 1];
      // cloud noise percentiles so cloud cover % maps to visible area
      const cs = Float32Array.from(this.cloudN).sort();
      this.cloudPct = (cov) => cs[Math.floor(clamp(1 - cov, 0, 0.9999) * (N - 1))];
      // facility sites (deterministic)
      this.sites = [];
      for (let k = 0; k < 260; k++) {
        let tries = 0, x, y;
        do { x = Math.floor(rnd() * MW); y = Math.floor(MH * (0.18 + rnd() * 0.64)); tries++; } while (tries < 8 && H[y * MW + x] < this.heightAt(0.45));
        this.sites.push([x, y]);
      }
      // palette
      const hue = traits.hue;
      const baseRock = hslToRgb(0.05 + hue * 0.12, 0.12 + hue * 0.18, 0.36);
      const lightRock = hslToRgb(0.06 + hue * 0.1, 0.10 + hue * 0.12, 0.62);
      this.palette = { dark: baseRock, light: lightRock };
      this.surf = new Uint8ClampedArray(N * 3);
      this.emis = new Uint8ClampedArray(N * 3);
      this.waterMask = new Uint8Array(N);
      this.cloudA = new Uint8Array(N);
      this.vis = null; this.lastComposeVis = null;
      this.stars = null;
    }

    heightAt(coverage) {
      coverage = clamp(coverage, 0, 1);
      if (coverage <= 0) return this.hMin - 1;
      const cw = this.cumW;
      let lo = 0, hi = cw.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cw[mid] < coverage) lo = mid + 1; else hi = mid; }
      return this.sortedH[lo];
    }

    /** Map simulation state to visual targets (0–1 values). */
    static visualFromState(s) {
      const c = s.climate;
      let total = 0; for (const id in s.bld) total += s.bld[id];
      const dir = s.directive;
      return {
        sea: c.waterPot / 100,
        liquid: c.liquid / 100,
        ice: c.ice / 100,
        veg: c.veg / 100,
        civ: c.civLevel / 100,
        pressure: c.pressure / 100,
        oxygen: c.oxygen / 100,
        pollution: c.pollution / 100,
        clouds: c.clouds / 100,
        temp: c.temp,
        greenhouse: c.greenhouse / 100,
        lava: clamp((s.world.traits.tectonic - 1.1) * 0.5 + (s.bld.geothermal || 0) / 250 + (dir === 'volcanic' ? 0.5 : 0) + S(40, 90, c.temp) * 0.3 - 0.12, 0, 1) * (1 - 0.5 * (c.waterPot / 100)),
        desert: (dir === 'desert' ? 0.9 : 0) + S(25, 55, c.temp) * (1 - c.waterPot / 100) * 0.6,
        sites: total,
        orbital: s.bld.orbital || 0,
        ring: s.projects.p_ring ? 1 : 0,
        elevator: s.projects.p_elevator ? 1 : 0,
        industrial: dir === 'industrial' ? 1 : 0,
      };
    }

    setVisualTarget(v, instant) {
      this.visTarget = v;
      if (!this.vis || instant) { this.vis = Object.assign({}, v); this.compose(); }
    }

    _stepVisual(dt) {
      if (!this.visTarget || !this.vis) return;
      const k = 1 - Math.exp(-dt / 2.5);
      for (const key in this.visTarget) {
        const t = this.visTarget[key];
        if (typeof t !== 'number') continue;
        const cur = this.vis[key];
        this.vis[key] = Math.abs(t - cur) < 1e-4 ? t : cur + (t - cur) * k;
      }
      this.composeTimer -= dt;
      if (this.composeTimer <= 0 && this._visChanged()) { this.compose(); this.composeTimer = this.quality === 'low' ? 1.0 : 0.35; }
    }

    _visChanged() {
      const a = this.vis, b = this.lastComposeVis;
      if (!b) return true;
      for (const k in a) {
        if (k === 'orbital' || k === 'ring' || k === 'elevator') continue;
        const d = Math.abs(a[k] - b[k]);
        if (k === 'temp' ? d > 0.6 : k === 'sites' ? d >= 1 : d > 0.0035) return true;
      }
      return false;
    }

    // ---------------------------------------------------------- Compose surface
    compose() {
      const v = this.vis; if (!v || !this.height) return;
      this.lastComposeVis = Object.assign({}, v);
      const N = MW * MH, H = this.height, surf = this.surf, emis = this.emis;
      const seaH = this.heightAt(v.sea);
      const range = this.hMax - this.hMin;
      const pal = this.palette;
      const frozen = v.sea > 0.001 ? clamp(1 - v.liquid / Math.max(1e-4, v.sea), 0, 1) : 0;
      const capEdge = 1 - clamp(v.ice * 1.05, 0, 0.92);
      const vegT = v.veg;
      const algae = S(0.0, 0.15, v.veg) * S(0, 0.05, v.liquid);
      const barren = 1 - clamp(v.sea * 1.5 + v.veg * 2, 0, 1);
      const warm = S(-10, 30, v.temp);
      const civ = v.civ;
      const lava = v.lava;
      const desert = clamp(v.desert, 0, 1);
      const poll = v.pollution;
      const cloudThr = this.cloudPct(v.clouds);
      for (let y = 0; y < MH; y++) {
        const latN = this.latN[y];
        for (let x = 0; x < MW; x++) {
          const i = y * MW + x, j = i * 3;
          const h = H[i], det = this.detail[i];
          let r, g, b, er = 0, eg = 0, eb = 0, water = 0;
          const capScore = latN + (this.vegN[i] - 0.5) * 0.22;
          if (h < seaH) {
            // ---- water
            const depth = clamp((seaH - h) / (range * 0.25), 0, 1);
            r = 18 + (1 - depth) * 30; g = 58 + (1 - depth) * 70; b = 112 + (1 - depth) * 60;
            if (algae > 0) { const a = algae * (1 - depth) * 0.7; r = r * (1 - a) + 40 * a; g = g * (1 - a) + 130 * a; b = b * (1 - a) + 100 * a; }
            const ice = frozen > 0 ? S(1 - frozen * 1.15, 1 - frozen * 1.15 + 0.12, capScore + (1 - depth) * 0.15) : 0;
            if (ice > 0) { r += (215 - r) * ice; g += (232 - g) * ice; b += (245 - b) * ice; }
            water = ice > 0.5 ? 0 : 1;
          } else {
            // ---- land
            const elev = clamp((h - Math.max(seaH, this.hMin)) / (range * 0.6), 0, 1);
            const t = clamp((h - this.hMin) / range, 0, 1);
            r = pal.dark[0] + (pal.light[0] - pal.dark[0]) * t;
            g = pal.dark[1] + (pal.light[1] - pal.dark[1]) * t;
            b = pal.dark[2] + (pal.light[2] - pal.dark[2]) * t;
            const dn = (det - 0.5) * 26 * (0.4 + barren * 0.6);
            r += dn; g += dn; b += dn;
            // dry ochre / desert sands
            const dry = clamp(desert + warm * 0.25 * (1 - v.sea), 0, 1) * (1 - elev * 0.5);
            if (dry > 0) { r += (196 - r) * dry * 0.65; g += (146 - g) * dry * 0.65; b += (86 - b) * dry * 0.65; }
            // vegetation
            if (vegT > 0) {
              const score = this.vegN[i] * 0.55 + latN * 0.3 + elev * 0.55 - (seaH > this.hMin ? 0.12 : 0);
              const thr = vegT * 1.15 + 0.05;
              const vg = 1 - S(thr - 0.09, thr, score);
              if (vg > 0) {
                const tropical = 1 - latN;
                const vr = 34 + latN * 40 + desert * 40, vgc = 92 + tropical * 30 - desert * 10, vb = 40 + latN * 10;
                r += (vr - r) * vg * 0.92; g += (vgc - g) * vg * 0.92; b += (vb - b) * vg * 0.92;
              }
            }
            // lava fissures (emissive)
            if (lava > 0.02) {
              const lf = S(1 - lava * 0.09, 1 - lava * 0.03, this.lavaN[i]) * (1 - elev * 0.4);
              if (lf > 0) {
                r = r * (1 - lf * 0.6) + 40 * lf * 0.6; g = g * (1 - lf * 0.6) + 22 * lf * 0.6; b = b * (1 - lf * 0.6) + 18 * lf * 0.6;
                er += 255 * lf; eg += 90 * lf; eb += 20 * lf;
              }
            }
            // cities
            if (civ > 0.003) {
              const coast = seaH > this.hMin ? 1 - clamp((h - seaH) / (range * 0.18), 0, 1) : 0.4;
              const cs = this.cityN[i] - coast * 0.22 + latN * 0.15;
              const lit = (1 - S(0.26 + civ * 0.36 - 0.04, 0.26 + civ * 0.36, cs)) * S(0.42, 0.62, det);
              if (lit > 0) {
                const core = 1 - S(0.2 + civ * 0.3 - 0.1, 0.2 + civ * 0.3, cs);
                const k = lit * (0.55 + 0.45 * core);
                er += 255 * k; eg += 186 * k; eb += 105 * k;
                r += (125 - r) * lit * 0.3; g += (122 - g) * lit * 0.3; b += (116 - b) * lit * 0.3;
              }
            }
            if (poll > 0.05) { const p = poll * 0.35; r += (110 - r) * p; g += (95 - g) * p; b += (70 - b) * p; }
          }
          // polar caps
          const cap = S(capEdge, capEdge + 0.06, capScore);
          if (cap > 0) { r += (232 - r) * cap; g += (240 - g) * cap; b += (248 - b) * cap; water *= (1 - cap); }
          surf[j] = r; surf[j + 1] = g; surf[j + 2] = b;
          emis[j] = er; emis[j + 1] = eg; emis[j + 2] = eb;
          this.waterMask[i] = water ? 1 : 0;
          // cloud alpha
          const cn = this.cloudN[i];
          let ca = v.clouds > 0.005 ? S(cloudThr - 0.06, cloudThr + 0.07, cn) * 0.9 : 0;
          // thin hazy veil on thick or polluted atmospheres
          ca = Math.max(ca, v.pressure * 0.06 + poll * 0.15);
          this.cloudA[i] = ca * 235;
        }
      }
      // facility lights
      const nSites = Math.min(this.sites.length, Math.floor(Math.sqrt(v.sites) * 4.2));
      for (let k = 0; k < nSites; k++) {
        const [sx, sy] = this.sites[k];
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const i = (sy + dy) * MW + ((sx + dx) % MW), j = i * 3;
          if (this.waterMask[i]) continue;
          emis[j] = Math.min(255, emis[j] + 200); emis[j + 1] = Math.min(255, emis[j + 1] + 170); emis[j + 2] = Math.min(255, emis[j + 2] + 110);
          surf[j] = Math.min(255, surf[j] + 18); surf[j + 1] = Math.min(255, surf[j + 1] + 16); surf[j + 2] = Math.min(255, surf[j + 2] + 12);
        }
      }
      // atmosphere color: thin CO2 orange -> oxygen blue -> polluted brown
      const ox = clamp(v.oxygen * 1.3, 0, 1);
      let ar = 230 * (1 - ox) + 110 * ox, ag = 150 * (1 - ox) + 175 * ox, ab = 110 * (1 - ox) + 255 * ox;
      ar += (170 - ar) * poll * 0.6; ag += (140 - ag) * poll * 0.6; ab += (90 - ab) * poll * 0.6;
      if (v.greenhouse > 0.7 && v.temp > 45) { ar += 30; ag += 5; }
      this.atmoColor = [ar, ag, ab];
    }

    // ---------------------------------------------------------- Projection tables
    _buildTables(N) {
      this.size = N;
      this.off.width = N; this.off.height = N;
      this.img = this.offCtx.createImageData(N, N);
      const R = N / 2 - 1, c = N / 2;
      const ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
      const L = norm([-0.62, -0.38, 0.68]);
      const Hh = norm([L[0], L[1], L[2] + 1]);
      const pix = [], row = [], lon0 = [], light = [], night = [], rim = [], spec = [], edge = [];
      for (let py = 0; py < N; py++) {
        for (let px = 0; px < N; px++) {
          const nx = (px + 0.5 - c) / R, ny = (py + 0.5 - c) / R;
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          // planet frame (y up), tilted toward the viewer
          const up = -ny;
          const yP = up * ct + nz * st;
          const zP = -up * st + nz * ct;
          const lat = Math.asin(clamp(yP, -1, 1));
          const lon = Math.atan2(nx, zP);
          let my = Math.floor((0.5 - lat / Math.PI) * MH); my = clamp(my, 0, MH - 1);
          pix.push(py * N + px);
          row.push(my * MW);
          lon0.push(((lon / (Math.PI * 2)) + 1) * MW);
          const ndl = nx * L[0] + ny * L[1] + nz * L[2];
          light.push(0.05 + 1.05 * S(-0.12, 0.55, ndl) * (0.55 + 0.45 * Math.max(0, ndl)));
          night.push(1 - S(-0.2, 0.08, ndl));
          rim.push(Math.pow(1 - nz, 2.2));
          const nh = Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]);
          spec.push(Math.pow(nh, 48) * S(0, 0.2, ndl));
          edge.push(clamp((1 - Math.sqrt(d2)) * R * 1.2, 0, 1));
        }
      }
      this.T = {
        pix: Int32Array.from(pix), row: Int32Array.from(row), lon0: Float32Array.from(lon0),
        light: Float32Array.from(light), night: Float32Array.from(night), rim: Float32Array.from(rim),
        spec: Float32Array.from(spec), edge: Float32Array.from(edge),
      };
      this._tableTilt = this.tilt;
    }

    _renderSphere() {
      const T = this.T, data = this.img.data, surf = this.surf, emis = this.emis, cl = this.cloudA, wm = this.waterMask;
      const n = T.pix.length;
      const rotPx = (this.rot / (Math.PI * 2)) * MW;
      const cRotPx = (this.cloudRot / (Math.PI * 2)) * MW;
      const v = this.vis;
      const atm = this.atmoColor || [200, 160, 120];
      const atmS = clamp(v.pressure * 1.25, 0, 1) * 0.95;
      const ar = atm[0] * atmS, ag = atm[1] * atmS, ab = atm[2] * atmS;
      const lowFx = this.quality === 'low';
      data.fill(0);
      for (let k = 0; k < n; k++) {
        const row = T.row[k];
        let x = T.lon0[k] + rotPx;
        x = x - Math.floor(x / MW) * MW;
        const xi = x | 0, fx = x - xi, xj = xi + 1 === MW ? 0 : xi + 1;
        const i0 = row + xi, i1 = row + xj, j0 = i0 * 3, j1 = i1 * 3;
        const gx = 1 - fx;
        const L = T.light[k], Nn = T.night[k];
        let r = (surf[j0] * gx + surf[j1] * fx) * L;
        let g = (surf[j0 + 1] * gx + surf[j1 + 1] * fx) * L;
        let b = (surf[j0 + 2] * gx + surf[j1 + 2] * fx) * L;
        if (Nn > 0.01) {
          r += (emis[j0] * gx + emis[j1] * fx) * Nn;
          g += (emis[j0 + 1] * gx + emis[j1 + 1] * fx) * Nn;
          b += (emis[j0 + 2] * gx + emis[j1 + 2] * fx) * Nn;
        }
        if (wm[i0]) { const sp = T.spec[k] * 130; r += sp; g += sp; b += sp * 0.9; }
        // clouds
        let cx = T.lon0[k] + cRotPx; cx = cx - Math.floor(cx / MW) * MW;
        const cxi = cx | 0, cfx = cx - cxi;
        const a = (cl[row + cxi] * (1 - cfx) + cl[row + (cxi + 1 === MW ? 0 : cxi + 1)] * cfx) / 255;
        if (a > 0) {
          const cL = L * 255 * (lowFx ? 0.9 : 1);
          r = r * (1 - a) + cL * a * 0.97; g = g * (1 - a) + cL * a * 0.98; b = b * (1 - a) + cL * a;
        }
        // atmospheric scattering at the limb
        const rm = T.rim[k] * (0.25 + 0.75 * Math.min(1, L));
        r += ar * rm; g += ag * rm; b += ab * rm;
        const p = T.pix[k] * 4;
        data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255 * T.edge[k];
      }
      this.offCtx.putImageData(this.img, 0, 0);
    }

    // ---------------------------------------------------------- Frame
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.dpr = dpr; this.stars = null;
    }

    _drawStars(ctx, W, H) {
      if (!this.stars || this.stars.w !== W || this.stars.h !== H) {
        const r = PP.rng(4242);
        const list = [];
        const count = Math.round(W * H / 2600);
        for (let i = 0; i < count; i++) list.push([r() * W, r() * H, r() * 1.3 + 0.2, r(), r()]);
        this.stars = { w: W, h: H, list };
      }
      const t = this.time;
      for (const [x, y, s, ph, hue] of this.stars.list) {
        const tw = this.reduceMotion ? 0.8 : 0.6 + 0.4 * Math.sin(t * (0.5 + ph) + ph * 10);
        ctx.fillStyle = hue > 0.85 ? `rgba(255,210,180,${0.7 * tw})` : hue < 0.15 ? `rgba(180,200,255,${0.8 * tw})` : `rgba(255,255,255,${0.65 * tw})`;
        ctx.fillRect(x, y, s * this.dpr, s * this.dpr);
      }
    }

    frame(dt) {
      if (!this.height || !this.vis) return;
      dt = Math.min(dt, 0.25);
      this.time += dt;
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      if (!W || !H) return;
      const spin = this.reduceMotion ? 0.02 : 0.07;
      if (!this.dragging) {
        this.rotVel *= Math.exp(-dt * 1.5);
        this.rot += (spin + this.rotVel) * dt;
      }
      this.cloudRot = this.rot * 1.0 + this.time * (this.reduceMotion ? 0.004 : 0.012);
      this._stepVisual(dt);
      const base = Math.min(W, H) * 0.78 * this.zoom;
      const rad = base / 2;
      const want = this.quality === 'low' ? 170 : Math.round(clamp(base / 1.7, 200, 340));
      if (want !== this.size || Math.abs(this._tableTilt - this.tilt) > 0.004) this._buildTables(want);
      this._renderSphere();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, W, H);
      const g0 = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.max(W, H));
      g0.addColorStop(0, 'rgba(40,40,90,0.35)'); g0.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
      this._drawStars(ctx, W, H);
      const cx = W / 2, cy = H / 2;
      const v = this.vis;

      // outer atmosphere glow
      if (v.pressure > 0.005) {
        const a = this.atmoColor;
        const s = clamp(v.pressure * 1.4, 0, 1);
        const gl = ctx.createRadialGradient(cx, cy, rad * 0.96, cx, cy, rad * (1.08 + 0.1 * s));
        gl.addColorStop(0, `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${0.55 * s})`);
        gl.addColorStop(1, `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},0)`);
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(cx, cy, rad * 1.2, 0, Math.PI * 2); ctx.fill();
      }
      const sats = this._satellites(cx, cy, rad);
      if (v.ring > 0.01) this._drawRing(ctx, cx, cy, rad, false);
      for (const s of sats) if (s.z < 0) this._drawSat(ctx, s);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.off, cx - rad, cy - rad, rad * 2, rad * 2);
      if (v.elevator > 0.01) {
        ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1 * this.dpr;
        ctx.beginPath(); ctx.moveTo(cx + rad * 0.15, cy - rad * 0.2); ctx.lineTo(cx + rad * 1.3, cy - rad * 1.05); ctx.stroke();
      }
      if (v.ring > 0.01) this._drawRing(ctx, cx, cy, rad, true);
      for (const s of sats) if (s.z >= 0) this._drawSat(ctx, s);
    }

    _satellites(cx, cy, rad) {
      const n = Math.min(28, Math.round(this.vis.orbital * 2));
      const out = [];
      for (let i = 0; i < n; i++) {
        const r = PP.rng(this.seed + i * 31);
        const orbit = rad * (1.18 + r() * 0.35);
        const inc = (r() - 0.5) * 1.2;
        const sp = (0.25 + r() * 0.35) * (this.reduceMotion ? 0.3 : 1);
        const ph = r() * Math.PI * 2 + this.time * sp;
        const x = Math.cos(ph) * orbit, z = Math.sin(ph) * orbit;
        const y = z * Math.sin(inc) * 0.5;
        out.push({ x: cx + x, y: cy + y - z * 0.18, z, big: i < 4 });
      }
      return out;
    }

    _drawSat(ctx, s) {
      const d = this.dpr;
      ctx.fillStyle = s.z < 0 ? 'rgba(170,190,220,0.55)' : 'rgba(235,245,255,0.95)';
      const sz = (s.big ? 2.4 : 1.5) * d;
      ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
      if (s.big) { ctx.fillStyle = 'rgba(120,200,255,0.5)'; ctx.fillRect(s.x - sz * 2, s.y - 0.5 * d, sz * 4, 1 * d); }
    }

    _drawRing(ctx, cx, cy, rad, front) {
      const a = this.vis.ring;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.28);
      if (front) { ctx.beginPath(); ctx.rect(-rad * 3, 0, rad * 6, rad * 3); ctx.clip(); }
      for (let k = 0; k < 14; k++) {
        const rr = rad * (1.35 + k * 0.028);
        const al = (0.12 + 0.18 * Math.sin(k * 1.7 + 1) ** 2) * a;
        ctx.strokeStyle = `rgba(${200 + k * 3},${190 + k * 2},${170 + k * 4},${al})`;
        ctx.lineWidth = rad * 0.026;
        ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // station lights on the ring
      ctx.fillStyle = `rgba(255,220,150,${0.8 * a})`;
      for (let k = 0; k < 24; k++) {
        const ang = k / 24 * Math.PI * 2 + this.time * 0.05;
        const y = Math.sin(ang) * rad * 1.53 * 0.22;
        if (front ? y < 0 : y >= 0) continue;
        ctx.fillRect(Math.cos(ang) * rad * 1.53 - 1, y - 1, 2 * this.dpr, 2 * this.dpr);
      }
      ctx.restore();
    }

    /** Render a small still image (data URL) for the archive. */
    snapshot(size) {
      size = size || 96;
      const prevSize = this.size;
      this._buildTables(size);
      this._renderSphere();
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').drawImage(this.off, 0, 0);
      this._buildTables(prevSize || 240);
      try { return c.toDataURL('image/webp', 0.8); } catch (e) { return c.toDataURL(); }
    }

    // ---------------------------------------------------------- Input
    _bindInput() {
      const el = this.canvas;
      const pts = new Map();
      let lastX = 0, lastY = 0, lastT = 0, pinch0 = 0, zoom0 = 1;
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 1) { this.dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = performance.now(); this.rotVel = 0; }
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = this.zoom; }
      });
      el.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch0 > 0) this.zoom = clamp(zoom0 * d / pinch0, 0.6, 1.6);
          return;
        }
        const now = performance.now();
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const scale = 2.6 / Math.max(120, el.clientWidth * this.zoom);
        this.rot -= dx * scale;
        this.tilt = clamp(this.tilt + dy * scale * 0.6, -0.7, 0.9);
        const dtm = Math.max(1, now - lastT) / 1000;
        this.rotVel = -dx * scale / dtm * 0.5;
        lastX = e.clientX; lastY = e.clientY; lastT = now;
      });
      const up = (e) => {
        pts.delete(e.pointerId);
        if (pts.size === 0) { this.dragging = false; this.rotVel = clamp(this.rotVel, -3, 3); }
        pinch0 = 0;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.6, 1.6);
      }, { passive: false });
    }
  }

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function hslToRgb(h, s, l) {
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  }

  PP.PlanetRenderer = PlanetRenderer;
})(globalThis.PP = globalThis.PP || {});
