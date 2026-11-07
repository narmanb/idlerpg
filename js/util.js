/* Pocket Planet — shared utilities: seeded RNG, noise, math helpers, formatting. */
(function (PP) {
  'use strict';

  // ---------- Seeded random ----------
  PP.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PP.hashStr = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // ---------- 3D value noise (seam-free when sampled on a sphere) ----------
  PP.makeNoise3 = function (seed) {
    const rand = PP.rng(seed);
    const perm = new Uint8Array(256);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    const h = (x, y, z) => vals[perm[(perm[(perm[x & 255] + y) & 255] + z) & 255]];
    const fade = (t) => t * t * (3 - 2 * t);
    function noise(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const u = fade(xf), v = fade(yf), w = fade(zf);
      const c000 = h(xi, yi, zi), c100 = h(xi + 1, yi, zi);
      const c010 = h(xi, yi + 1, zi), c110 = h(xi + 1, yi + 1, zi);
      const c001 = h(xi, yi, zi + 1), c101 = h(xi + 1, yi, zi + 1);
      const c011 = h(xi, yi + 1, zi + 1), c111 = h(xi + 1, yi + 1, zi + 1);
      const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
      const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
      const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
      return y0 + (y1 - y0) * w;
    }
    function fbm(x, y, z, oct, lac, gain) {
      oct = oct || 5; lac = lac || 2.0; gain = gain || 0.5;
      let amp = 1, f = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += amp * noise(x * f, y * f, z * f);
        norm += amp; amp *= gain; f *= lac;
      }
      return sum / norm;
    }
    return { noise, fbm };
  };

  // ---------- Math helpers ----------
  PP.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  PP.lerp = (a, b, t) => a + (b - a) * t;
  PP.smooth = function (e0, e1, x) {
    const t = PP.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  /** 1 inside [lo, hi], smoothly falling to 0 at [min, max]. */
  PP.plateau = function (x, min, lo, hi, max) {
    if (x < lo) return PP.smooth(min, lo, x);
    if (x > hi) return 1 - PP.smooth(hi, max, x);
    return 1;
  };
  /** Saturating curve: 0 -> 100 as stock grows, 63% at stock == k. */
  PP.sat = (stock, k) => 100 * (1 - Math.exp(-Math.max(0, stock) / k));
  /** Exponential approach factor for time constant tau. */
  PP.approach = (dt, tau) => 1 - Math.exp(-dt / Math.max(1e-6, tau));

  // ---------- Number formatting ----------
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  PP.notation = 'sci'; // 'sci' | 'eng' | 'suffix'

  PP.fmt = function (n, dec) {
    if (n === undefined || n === null || Number.isNaN(n)) return '0';
    if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
    const neg = n < 0; const a = Math.abs(n);
    let out;
    if (a < 1e6) {
      if (a < 10 && a % 1 !== 0) out = a.toFixed(dec === undefined ? 2 : dec).replace(/\.?0+$/, '');
      else if (a < 100 && a % 1 !== 0) out = a.toFixed(1).replace(/\.0$/, '');
      else out = Math.floor(a).toLocaleString('en-US');
      if (out === '') out = '0';
    } else {
      const e = Math.floor(Math.log10(a));
      if (PP.notation === 'suffix' && e < 36) {
        const g = Math.floor(e / 3);
        out = (a / Math.pow(10, g * 3)).toFixed(2) + SUFFIX[g];
      } else if (PP.notation === 'eng') {
        const g = Math.floor(e / 3) * 3;
        out = (a / Math.pow(10, g)).toFixed(2) + 'e' + g;
      } else {
        let ee = e;
        let ms = (a / Math.pow(10, ee)).toFixed(2);
        if (ms === '10.00') { ee++; ms = '1.00'; }
        out = ms + 'e' + ee;
      }
    }
    return neg ? '-' + out : out;
  };

  PP.fmtRate = (n) => (n >= 0 ? '+' : '') + PP.fmt(n) + '/s';

  PP.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + 'm ' + (s ? s + 's' : '');
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 48) return h + 'h ' + (mm ? mm + 'm' : '');
    const d = Math.floor(h / 24), hh = h % 24;
    return d + 'd ' + (hh ? hh + 'h' : '');
  };

  PP.pct = (v) => Math.round(v) + '%';

  PP.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Planet names ----------
  const SYL_A = ['Ka', 'Vel', 'Or', 'Ly', 'Sen', 'Tho', 'Ar', 'Mi', 'Cae', 'No', 'Ze', 'Ul', 'Pra', 'Ish', 'Bel', 'Ro', 'Ta', 'Quo', 'Eri', 'Ves'];
  const SYL_B = ['ra', 'lis', 'thar', 'mon', 'dra', 'ven', 'ia', 'sto', 'rix', 'nae', 'lum', 'gal', 'ope', 'tis', 'cor', 'phe', 'dun', 'mar'];
  const SYL_C = ['', '', '', ' Prime', ' II', ' IV', ' Minor', ' b', ' c', ' VII'];
  PP.planetName = function (seed) {
    const r = PP.rng(seed ^ 0x9e3779b9);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    return pick(SYL_A) + pick(SYL_B) + (r() < 0.4 ? pick(SYL_B) : '') + pick(SYL_C);
  };
})(globalThis.PP = globalThis.PP || {});
