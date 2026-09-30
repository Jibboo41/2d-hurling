/* HURLING '92 - a 2D Irish hurling game in the style of early-90s sports games.
   320x200 low-res canvas, 16-ish colour palette, pixel-art sprites defined as
   text maps below and rendered at start-up. No external assets. */
'use strict';
(function () {
  const VW = 320, VH = 200;          // screen
  const W = 800, H = 160;            // pitch (world) size
  const PY = 30;                     // screen y of the top sideline
  const GY = H / 2, GW = 16;         // goal centre y, half mouth width
  const BAR = 14, POSTH = 46;        // crossbar / upright height
  const G = 300;                     // ball gravity
  const HALF = 90;                   // seconds per half
  const DEMO = /[?&]demo/.test(location.search);

  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function fit() {
    let s = Math.min(innerWidth / VW, innerHeight / VH);
    if (s >= 1) s = Math.floor(s);
    cv.style.width = Math.floor(VW * s) + 'px';
    cv.style.height = Math.floor(VH * s) + 'px';
  }
  addEventListener('resize', fit); fit();

  /* ---------- helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* ---------- input ---------- */
  const keys = {}; let edge = {};
  const PREVENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  addEventListener('keydown', e => {
    if (!keys[e.code]) edge[e.code] = true;
    keys[e.code] = true;
    if (PREVENT.includes(e.code)) e.preventDefault();
    initAudio();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const down = (...c) => c.some(k => keys[k]);
  const hit = (...c) => c.some(k => edge[k]);

  /* ---------- audio (WebAudio chip-style beeps) ---------- */
  let AC = null;
  function initAudio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function tone(f, d, type, v, slide) {
    if (!AC) return;
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  }
  function noise(d, v) {
    if (!AC) return;
    const n = Math.floor(AC.sampleRate * d), buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = v || 0.06;
    s.buffer = buf; s.connect(g); g.connect(AC.destination); s.start();
  }
  function sfx(n) {
    switch (n) {
      case 'hit': tone(180, 0.09, 'square', 0.07, -80); noise(0.05, 0.05); break;
      case 'pass': tone(330, 0.07, 'square', 0.05, 120); break;
      case 'hand': tone(440, 0.06, 'triangle', 0.06, 60); break;
      case 'solo': tone(520, 0.05, 'triangle', 0.05, 200); break;
      case 'hook': tone(140, 0.12, 'sawtooth', 0.05, -60); break;
      case 'catch': tone(260, 0.05, 'square', 0.04); break;
      case 'whistle': tone(1500, 0.25, 'sine', 0.06); setTimeout(() => tone(1500, 0.35, 'sine', 0.06), 300); break;
      case 'goal': noise(1.2, 0.08); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.05), i * 110)); break;
      case 'point': noise(0.7, 0.05); [659, 880].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'square', 0.05), i * 110)); break;
      case 'foul': tone(120, 0.25, 'sawtooth', 0.06, -40); break;
    }
  }

  /* ---------- 3x5 bitmap font ---------- */
  const FONT_SRC = {
    A: '010 101 111 101 101', B: '110 101 110 101 110', C: '011 100 100 100 011', D: '110 101 101 101 110',
    E: '111 100 110 100 111', F: '111 100 110 100 100', G: '011 100 101 101 011', H: '101 101 111 101 101',
    I: '111 010 010 010 111', J: '001 001 001 101 010', K: '101 101 110 101 101', L: '100 100 100 100 111',
    M: '101 111 111 101 101', N: '110 101 101 101 101', O: '010 101 101 101 010', P: '110 101 110 100 100',
    Q: '010 101 101 111 011', R: '110 101 110 101 101', S: '011 100 010 001 110', T: '111 010 010 010 010',
    U: '101 101 101 101 111', V: '101 101 101 101 010', W: '101 101 111 111 101', X: '101 101 010 101 101',
    Y: '101 101 010 010 010', Z: '111 001 010 100 111',
    0: '111 101 101 101 111', 1: '010 110 010 010 111', 2: '110 001 010 100 111', 3: '110 001 010 001 110',
    4: '101 101 111 001 001', 5: '111 100 110 001 110', 6: '011 100 111 101 111', 7: '111 001 010 010 010',
    8: '111 101 111 101 111', 9: '111 101 111 001 110',
    '-': '000 000 111 000 000', ':': '000 010 000 010 000', '!': '010 010 010 000 010', '.': '000 000 000 000 010',
    '/': '001 001 010 100 100', '+': '000 010 111 010 000', '?': '110 001 010 000 010', "'": '010 010 000 000 000',
    '(': '001 010 010 010 001', ')': '100 010 010 010 100', ',': '000 000 000 010 100', '=': '000 111 000 111 000'
  };
  const FONT = {};
  for (const k in FONT_SRC) FONT[k] = FONT_SRC[k].split(' ');
  function textW(s, sc) { return s.length * 4 * sc - sc; }
  function txt(s, x, y, sc, col, align, shadow) {
    s = String(s).toUpperCase(); sc = sc || 1;
    if (align === 'c') x -= Math.floor(textW(s, sc) / 2); else if (align === 'r') x -= textW(s, sc);
    const pass = (ox, oy, c) => {
      ctx.fillStyle = c;
      for (let i = 0; i < s.length; i++) {
        const g = FONT[s[i]]; if (!g) continue;
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++)
          if (g[r][q] === '1') ctx.fillRect(x + i * 4 * sc + q * sc + ox, y + r * sc + oy, sc, sc);
      }
    };
    if (shadow) pass(sc, sc, shadow);
    pass(0, 0, col || '#fff');
  }

  /* ---------- pixel-art sprites ---------- */
  // 8 wide x 13 tall. h=helmet s=skin j=jersey t=shorts k=socks b=boots
  const BODY = [
    '..hhhh..',
    '.hhhhss.',
    '.hhsssh.',
    '..ssss..',
    '..jjjj..',
    '.jjjjjj.',
    '.jjjjjj.',
    '..jjjj..',
    '..tttt..'
  ];
  const LEGS = [
    ['..tt.tt.', '..kk.kk.', '..kk.kk.', '..bb.bbb'],
    ['..tt..tt', '.kk...kk', '.kk...kk', '.bbb.bbb'],
    ['..tt.tt.', '..kk.kk.', '..kk.kk.', '..bb.bbb'],
    ['..tt..tt', '..kkkk..', '.kk..kk.', '.bb..bbb']
  ];
  const TEAMS = [
    { name: 'ORANGE', j: '#f08018', jd: '#b85808', t: '#181818', k: '#f08018', h: '#b85808', kj: '#e8e020' },
    { name: 'BLUE', j: '#3060e0', jd: '#1c3890', t: '#f0f0f0', k: '#f0f0f0', h: '#1c3890', kj: '#e040d8' }
  ];
  const SKIN = '#f0b080', BOOT = '#181818';
  function buildSprites() {
    const out = [];
    for (let t = 0; t < 2; t++) {
      out[t] = [];
      for (let kp = 0; kp < 2; kp++) {
        const T = TEAMS[t], jer = kp ? T.kj : T.j;
        const pal = { h: T.h, s: SKIN, j: jer, t: T.t, k: T.k, b: BOOT };
        out[t][kp] = LEGS.map(legs => {
          const c = document.createElement('canvas'); c.width = 8; c.height = 13;
          const x = c.getContext('2d'), rows = BODY.concat(legs);
          rows.forEach((r, y) => { for (let i = 0; i < 8; i++) { const ch = r[i]; if (ch !== '.') { x.fillStyle = pal[ch]; x.fillRect(i, y, 1, 1); } } });
          return c;
        });
      }
    }
    return out;
  }
  const SPR = buildSprites();

  /* ---------- crowd ---------- */
  const CROWD_COLS = ['#c82820', '#2040c0', '#f0c020', '#f0f0f0', '#28a038', '#a048c0', '#181818', '#f08018'];
  function buildCrowd(off) {
    const c = document.createElement('canvas'); c.width = W + 64; c.height = 12;
    const x = c.getContext('2d'); x.fillStyle = '#20202c'; x.fillRect(0, 0, c.width, 12);
    let seed = 7; const r = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let cx = 0; cx < c.width; cx += 2) for (let ry = 0; ry < 5; ry++) {
      const jump = (off && ((cx >> 1) + ry) % 2) ? -1 : 0;
      x.fillStyle = '#e0a070'; x.fillRect(cx, 2 + ry * 2 + jump, 2, 1);
      x.fillStyle = CROWD_COLS[Math.floor(r() * CROWD_COLS.length)]; x.fillRect(cx, 3 + ry * 2 + jump, 2, 1);
    }
    x.fillStyle = '#f0f0f0'; x.fillRect(0, 10, c.width, 2);
    for (let cx = 0; cx < c.width; cx += 24) { x.fillStyle = '#c82820'; x.fillRect(cx, 10, 12, 2); }
    return c;
  }
  const CROWD = [buildCrowd(false), buildCrowd(true)];

  /* ---------- game state ---------- */
  const FORM = [[0.03, 0.5], [0.17, 0.5], [0.27, 0.2], [0.27, 0.8], [0.45, 0.5], [0.62, 0.27], [0.62, 0.73]];
  let state = 'title', P = [], ball, score, half, clock, banner, ctrl = null, camX = 0, time = 0, toast = null;

  function homeOf(p) { const f = FORM[p.i]; return { x: p.t === 0 ? f[0] * W : W - f[0] * W, y: f[1] * H }; }
  function mkPlayer(t, i) {
    const p = {
      t, i, keeper: i === 0, x: 0, y: 0, vx: 0, vy: 0, ax: t === 0 ? 1 : -1, ay: 0, face: t === 0 ? 1 : -1,
      anim: 0, moving: false, stepAcc: 0, swing: 0, swingCool: 0, stun: 0, noPick: 0, soloT: 0, hold: 0, charge: 0, aiT: rnd(0, .4)
    };
    const h = homeOf(p); p.x = h.x; p.y = h.y; return p;
  }
  function resetPositions() {
    P.forEach(p => {
      const h = homeOf(p); p.x = h.x; p.y = h.y; p.vx = p.vy = 0; p.stun = p.noPick = p.swing = p.swingCool = p.soloT = p.hold = p.charge = 0;
      p.stepAcc = 0; p.ax = p.t === 0 ? 1 : -1; p.ay = 0; p.face = p.ax;
    });
    ball.owner = null;
  }
  function newMatch() {
    P = []; for (let t = 0; t < 2; t++) for (let i = 0; i < 7; i++) P.push(mkPlayer(t, i));
    ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, noFric: 0, lastT: 0 };
    score = [{ g: 0, p: 0 }, { g: 0, p: 0 }];
    half = 1; clock = HALF; toast = null;
    resetPositions(); ctrl = null;
    state = 'play';
    setBanner('GET READY', 'THROW-IN', 1.6, throwIn);
    sfx('whistle');
  }
  function setBanner(text, sub, t, next, cheer) { banner = { text, sub, t, next, cheer: !!cheer }; }
  function throwIn() {
    Object.assign(ball, { x: W / 2, y: H / 2, z: 2, vx: rnd(-12, 12), vy: rnd(-12, 12), vz: 170, owner: null, noFric: 0 });
    P.forEach(p => p.noPick = 0);
    sfx('whistle');
  }
  const pts = s => s.g * 3 + s.p;
  const fmt = s => s.g + '-' + (s.p < 10 ? '0' : '') + s.p;

  /* ---------- ball / player actions ---------- */
  function say(t) { toast = { text: t, t: 1.1 }; }

  function giveTo(team, x, y, keeperOnly) {
    let best = null, bd = 1e9;
    for (const p of P) {
      if (p.t !== team || (p.keeper !== !!keeperOnly)) continue;
      const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    if (!keeperOnly) { best.x = clamp(x, 6, W - 6); best.y = clamp(y, 6, H - 6); }
    best.stepAcc = 0; best.hold = keeperOnly ? 1.1 : 0.6; best.noPick = 0; best.soloT = 0;
    ball.owner = best; ball.lastT = team; ball.vx = ball.vy = ball.vz = 0;
  }

  function solo(p) {
    if (ball.owner !== p || p.soloT > 0) return;
    p.soloT = 0.4; p.stepAcc = 0; sfx('solo');
  }

  function launch(p, tx, ty, speed, h, ground) {
    const b = ball;
    b.owner = null; b.lastT = p.t;
    const d = Math.hypot(tx - b.x, ty - b.y) || 1, t = d / speed;
    b.vx = (tx - b.x) / t; b.vy = (ty - b.y) / t;
    if (ground) { b.vz = 0; b.z = 0; b.noFric = t + 0.15; }
    else { b.z = Math.max(b.z, 2); b.vz = (h - b.z + 0.5 * G * t * t) / t; b.noFric = 0; }
    p.noPick = 0.35; p.swing = 0.25; p.charge = 0; p.soloT = 0;
  }

  function shoot(p, power) {
    if (ball.owner !== p) return;
    const gx = p.t === 0 ? W : 0, dx = gx - p.x, dy = GY - p.y, dg = Math.hypot(dx, dy);
    const ang = Math.atan2(p.ay, p.ax), ga = Math.atan2(dy, dx);
    const da = Math.abs(((ang - ga + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const speed = 240 + power * 160;
    let tx, ty, h;
    if (da < 0.9 && Math.abs(gx - p.x) < 340) {
      const sig = 3 + dg * 0.03 + (p.moving ? 3 : 0);
      const corner = p.ay > 0.35 ? 7 : p.ay < -0.35 ? -7 : 0;
      tx = gx; ty = GY + corner + (Math.random() + Math.random() - 1) * sig * 1.6; h = 4 + power * 32;
    } else {
      const l = 110 + power * 200; tx = p.x + p.ax * l; ty = p.y + p.ay * l; h = 8 + power * 20;
    }
    launch(p, tx, ty, speed, h, false); sfx('hit');
  }

  function bestTarget(p, maxD, minDot) {
    let best = null, bs = -1e9; const dirx = p.t === 0 ? 1 : -1;
    for (const q of P) {
      if (q.t !== p.t || q === p || q.keeper) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      if (d < 14 || d > maxD) continue;
      const dot = (dx * p.ax + dy * p.ay) / d; if (dot < minDot) continue;
      let s = dot * 100 - d * 0.2 + dx * dirx * 0.05;
      for (const o of P) if (o.t !== p.t && Math.hypot(o.x - q.x, o.y - q.y) < 22) s -= 40;
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  }

  function passTo(p, tm, kind) {
    if (ball.owner !== p) return;
    const sp = kind === 'hand' ? 120 : kind === 'lob' ? 230 : 230;
    let tx, ty;
    if (tm) {
      const d = dist(p, tm), tt = d / sp;
      tx = clamp(tm.x + tm.vx * tt * 0.7, 4, W - 4); ty = clamp(tm.y + tm.vy * tt * 0.7, 4, H - 4);
    } else {
      const l = kind === 'hand' ? 50 : kind === 'lob' ? 250 : 110;
      tx = p.x + p.ax * l; ty = p.y + p.ay * l;
    }
    if (kind === 'stick') { launch(p, tx, ty, sp, 0, true); sfx('pass'); }
    else if (kind === 'hand') { launch(p, tx, ty, sp, 3, false); sfx('hand'); }
    else { launch(p, tx, ty, sp, 6, false); sfx('hit'); }
    if (tm) ball.target = tm; else ball.target = null;
  }
  function pass(p, kind) {
    if (ball.owner !== p) return;
    passTo(p, bestTarget(p, kind === 'hand' ? 85 : 260, kind === 'hand' ? 0.3 : 0.45), kind);
  }

  function hook(p) {
    if (p.swingCool > 0 || p.stun > 0) return;
    p.swing = 0.3; p.swingCool = 0.7; sfx('hook');
    const b = ball, o = b.owner;
    if (o && o.t !== p.t) {
      if (dist(o, p) < 18) {
        const ch = (p === ctrl ? 0.72 : 0.4) + (o.soloT > 0 ? 0.2 : 0);
        if (Math.random() < ch) {
          let a = Math.atan2(o.y - p.y, o.x - p.x) + rnd(-0.8, 0.8);
          b.owner = null; b.lastT = p.t; b.vx = Math.cos(a) * 85; b.vy = Math.sin(a) * 85; b.vz = 70; b.z = 3; b.noFric = 0;
          o.stun = 0.35; o.noPick = 0.5; o.soloT = 0; o.charge = 0; say('HOOKED!'); sfx('hit');
        }
      }
    } else if (!o && dist(p, b) < 20 && b.z < 16) {
      b.vx = p.ax * 190; b.vy = p.ay * 190; b.vz = 50; b.lastT = p.t; b.noFric = 0; sfx('hit');
    }
  }

  function foul(p) {
    say('STEPS!'); sfx('foul');
    const x = p.x, y = p.y; p.stun = 0.5; p.stepAcc = 0; ball.owner = null;
    giveTo(1 - p.t, x, y, false);
  }

  /* ---------- AI ---------- */
  function chaseRank(p, ref) {
    const d = Math.hypot(p.x - ref.x, p.y - ref.y); let n = 0;
    for (const q of P) {
      if (q === p || q.t !== p.t || q.keeper) continue;
      const e = Math.hypot(q.x - ref.x, q.y - ref.y);
      if (e < d || (e === d && q.i < p.i)) n++;
    }
    return n;
  }

  function carrierAI(p) {
    const dirx = p.t === 0 ? 1 : -1, gx = p.t === 0 ? W : 0, dg = Math.abs(gx - p.x);
    if (p.keeper) {
      if (p.hold > 0) return [0, 0];
      p.ax = dirx; p.ay = 0;
      passTo(p, bestTarget(p, 380, 0.2), 'lob');
      return [0, 0];
    }
    let vx = gx - p.x, vy = (GY - p.y) * 0.6, l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    let near = 1e9;
    for (const o of P) {
      if (o.t === p.t || o.keeper) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y); near = Math.min(near, d);
      if (d < 34 && d > 0.1) { vx += (p.x - o.x) / d * (34 - d) * 0.05; vy += (p.y - o.y) / d * (34 - d) * 0.05; }
    }
    l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    p.ax = vx; p.ay = vy;
    if (p.stepAcc >= 34) solo(p);
    if (p.aiT <= 0) {
      p.aiT = 0.3 + Math.random() * 0.3;
      if (dg < 190 && Math.random() < 0.65) {
        p.ax = (gx - p.x) / dg; p.ay = (GY - p.y) / dg;
        shoot(p, dg < 110 ? rnd(0, 0.15) : 0.4 + Math.random() * 0.5); return [0, 0];
      }
      if ((near < 24 && Math.random() < 0.7) || Math.random() < 0.05) {
        const tm = bestTarget(p, 200, 0.1);
        if (tm) { passTo(p, tm, dist(p, tm) < 70 ? 'hand' : 'stick'); return [0, 0]; }
      }
    }
    return [vx, vy];
  }

  function ai(p, dt) {
    p.aiT -= dt;
    const b = ball, o = b.owner, dirx = p.t === 0 ? 1 : -1, gx = p.t === 0 ? W : 0, home = homeOf(p);
    if (o === p) return carrierAI(p);
    if (p.hold > 0) return [0, 0];
    let tx = home.x, ty = home.y;
    if (p.keeper) {
      ty = GY + clamp((b.y - GY) * 0.4, -16, 16);
      if (!o && Math.abs(b.x - gx) < 90 && dist(p, b) < 60) { tx = b.x; ty = b.y; }
    } else if (!o || o.t !== p.t) {
      const ref = o || b, lim = o ? 2 : 1;
      if (chaseRank(p, ref) < lim) {
        tx = ref.x + (o ? 0 : b.vx * 0.25); ty = ref.y + (o ? 0 : b.vy * 0.25);
        if (dist(p, ref) < 17 && p.swingCool <= 0 && Math.random() < dt * 3) { p.ax = (ref.x - p.x) / 17; p.ay = (ref.y - p.y) / 17; hook(p); }
      } else { tx = lerp(home.x, ref.x, 0.45); ty = lerp(home.y, ref.y, 0.3); }
    } else {
      tx = lerp(home.x, o.x + dirx * 60, 0.7); ty = home.y + Math.sin(time * 0.5 + p.i) * 15;
    }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 3) return [0, 0];
    return [dx / d, dy / d];
  }

  /* ---------- per-frame logic ---------- */
  function pickCtrl() {
    if (DEMO) { ctrl = null; return; }
    const o = ball.owner;
    if (o && o.t === 0) { ctrl = o; return; }
    let best = null, bd = 1e9;
    const bx = ball.x + ball.vx * 0.2, by = ball.y + ball.vy * 0.2;
    for (const p of P) {
      if (p.t !== 0) continue;
      const d = Math.hypot(p.x - bx, p.y - by); if (d < bd) { bd = d; best = p; }
    }
    if (ctrl && ctrl.t === 0 && Math.hypot(ctrl.x - bx, ctrl.y - by) <= bd + 14) return;
    ctrl = best;
  }

  function act(p, dt) {
    for (const k of ['swing', 'swingCool', 'stun', 'noPick', 'soloT', 'hold']) p[k] = Math.max(0, p[k] - dt);
    if (p.stun > 0) { p.moving = false; p.vx = p.vy = 0; return; }
    let mx = 0, my = 0, spd;
    if (p === ctrl) {
      mx = (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0);
      my = (down('ArrowDown', 'KeyS') ? 1 : 0) - (down('ArrowUp', 'KeyW') ? 1 : 0);
      spd = 60;
      const has = ball.owner === p;
      if (mx || my) { const l = Math.hypot(mx, my); p.ax = mx / l; p.ay = my / l; }
      if (hit('KeyZ') || (down('KeyZ') && p.stepAcc >= 36)) solo(p);
      if (has) {
        if (down('Space')) p.charge = Math.min(1, p.charge + dt / 0.8);
        else if (p.charge > 0) { shoot(p, p.charge); p.charge = 0; }
      } else { p.charge = 0; if (hit('Space')) hook(p); }
      if (hit('KeyX')) pass(p, 'stick');
      if (hit('KeyC')) pass(p, 'hand');
      if (hit('KeyV')) hook(p);
    } else {
      const r = ai(p, dt); mx = r[0]; my = r[1]; spd = p.keeper ? 36 : (p.t === 1 ? 54 : 57);
    }
    // movement
    const l = Math.hypot(mx, my);
    let s = spd * (ball.owner === p ? 0.9 : 1) * (p.charge > 0 ? 0.6 : 1) * (p.swing > 0 ? 0.45 : 1);
    if (l > 0) {
      mx /= l; my /= l; p.ax = mx; p.ay = my;
      if (Math.abs(mx) > 0.3) p.face = mx > 0 ? 1 : -1;
      p.vx = mx * s; p.vy = my * s; p.anim += dt * 9; p.moving = true;
      if (ball.owner === p) p.stepAcc += s * dt;
    } else { p.vx = p.vy = 0; p.moving = false; if (Math.abs(p.ax) > 0.3) p.face = p.ax > 0 ? 1 : -1; }
    p.x = clamp(p.x + p.vx * dt, 2, W - 2); p.y = clamp(p.y + p.vy * dt, 3, H - 2);
    if (ball.owner === p && p.stepAcc >= 60) foul(p);
  }

  function separate() {
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], c = P[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d < 7 && d > 0.01) { const push = (7 - d) * 0.5; a.x -= dx / d * push; a.y -= dy / d * push; c.x += dx / d * push; c.y += dy / d * push; }
    }
  }

  function updateBall(dt) {
    const b = ball, o = b.owner;
    if (o) {
      b.lastT = o.t;
      if (o.soloT > 0) {
        const u = Math.sin(Math.PI * (1 - o.soloT / 0.4));
        b.x = o.x + o.face * (6 + 8 * u); b.z = 4 + 16 * u;
      } else { b.x = o.x + o.face * 6; b.z = 3 + (o.moving ? Math.abs(Math.sin(o.anim * 0.5)) * 2 : 0); }
      b.y = o.y + 1; b.vx = b.vy = b.vz = 0;
      return;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= G * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -40) { b.vz = -b.vz * 0.45; sfx('catch'); } else b.vz = 0;
    }
    b.noFric = Math.max(0, b.noFric - dt);
    if (b.z === 0 && b.noFric <= 0) {
      const f = Math.exp(-1.6 * dt); b.vx *= f; b.vy *= f;
      if (Math.hypot(b.vx, b.vy) < 4) b.vx = b.vy = 0;
    }
    // pick-ups
    let best = null, bd = 1e9;
    for (const p of P) {
      if (p.noPick > 0 || p.stun > 0) continue;
      if (b.z > (p.keeper ? 22 : 12)) continue;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < (p.keeper ? 9 : 8) && d < bd) { bd = d; best = p; }
    }
    if (best) {
      const sp = Math.hypot(b.vx, b.vy);
      if (best.keeper && sp > 190 && Math.random() < 0.35) {
        b.vx = -b.vx * 0.35 + rnd(-30, 30); b.vy = b.vy * 0.5 + rnd(-60, 60); b.vz = 40; best.noPick = 0.4; b.noFric = 0; b.lastT = best.t;
        say('SAVE!'); sfx('hit');
      } else {
        b.owner = best; b.lastT = best.t; best.stepAcc = 0; best.soloT = 0; b.target = null;
        if (best.keeper) best.hold = 0.9; sfx('catch');
      }
    }
  }

  function checkBounds() {
    const b = ball; if (b.owner) return;
    if (b.y < 0 || b.y > H) {
      say('SIDELINE'); sfx('whistle');
      giveTo(1 - b.lastT, clamp(b.x, 10, W - 10), b.y < 0 ? 4 : H - 4, false);
    } else if (b.x < 0 || b.x > W) {
      const d = b.x < 0 ? 0 : 1, att = 1 - d;
      if (Math.abs(b.y - GY) <= GW && b.z < BAR + POSTH) {
        if (b.z < BAR) return goalScored(att, 'GOAL!');
        return goalScored(att, 'POINT!');
      }
      b.vx = b.vy = 0; b.z = 0;
      if (b.lastT === att) {
        say('WIDE'); sfx('whistle');
        giveTo(d, d === 0 ? 10 : W - 10, GY, true);
      } else {
        say('65!'); sfx('whistle');
        giveTo(att, d === 0 ? 45 : W - 45, b.y < GY ? 12 : H - 12, false);
      }
    }
  }

  function goalScored(team, what) {
    const goal = what === 'GOAL!';
    if (goal) score[team].g++; else score[team].p++;
    ball.vx = ball.vy = 0; ball.owner = null;
    sfx(goal ? 'goal' : 'point');
    setBanner(what, TEAMS[team].name + ' ' + fmt(score[team]), 2.4, () => { resetPositions(); giveTo(1 - team, 0, 0, true); sfx('whistle'); }, true);
  }

  function endHalf() {
    sfx('whistle');
    if (half === 1) {
      setBanner('HALF TIME', TEAMS[0].name + ' ' + fmt(score[0]) + '  ' + TEAMS[1].name + ' ' + fmt(score[1]), 3, () => {
        half = 2; clock = HALF; resetPositions(); throwIn();
      });
    } else {
      setBanner('FULL TIME', TEAMS[0].name + ' ' + fmt(score[0]) + '  ' + TEAMS[1].name + ' ' + fmt(score[1]), 3.5, () => { state = 'end'; });
    }
  }

  function update(dt) {
    time += dt;
    if (toast && (toast.t -= dt) <= 0) toast = null;
    if (state === 'title') { if (hit('Enter', 'Space')) newMatch(); return; }
    if (state === 'end') { if (hit('Enter')) state = 'title'; return; }
    if (banner) {
      if ((banner.t -= dt) <= 0) { const n = banner.next; banner = null; if (n) n(); }
    } else {
      clock -= dt; if (clock <= 0) { clock = 0; endHalf(); }
      pickCtrl();
      for (const p of P) act(p, dt);
      separate();
      updateBall(dt);
      checkBounds();
    }
    const fx = ball.owner ? ball.owner.x + ball.owner.face * 30 : ball.x;
    camX += (clamp(fx - VW / 2, -16, W - VW + 16) - camX) * Math.min(1, dt * 5);
  }

  /* ---------- rendering ---------- */
  const GRASS = ['#2a8a2a', '#329832'];
  function sx(x) { return Math.round(x - camX); }

  function drawPitch() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    // stripes
    for (let wx = -48; wx < W + 48; wx += 40) {
      const x0 = sx(wx); if (x0 > VW || x0 + 40 < 0) continue;
      ctx.fillStyle = GRASS[((wx + 48) / 40) & 1]; ctx.fillRect(x0, PY, 40, H);
    }
    const L = '#e8f0e8'; ctx.fillStyle = L;
    ctx.fillRect(0, PY, VW, 1); ctx.fillRect(0, PY + H - 1, VW, 1);
    const vline = x => ctx.fillRect(sx(x), PY, 1, H);
    [0, W, 74, W - 74, 114, W - 114, 257, W - 257, W / 2].forEach(vline);
    // small rectangles
    [[0, 1], [W - 26, 1]].forEach(r => {
      const x = sx(r[0]); ctx.fillRect(x, PY + GY - 40, 26, 1); ctx.fillRect(x, PY + GY + 40, 26, 1);
      ctx.fillRect(sx(r[0] === 0 ? 26 : W - 26), PY + GY - 40, 1, 81);
    });
    // centre marks
    ctx.fillRect(sx(W / 2) - 2, PY + GY, 5, 1);
    // crowd
    ctx.fillStyle = '#10101a'; ctx.fillRect(0, 18, VW, 12);
    const cheer = banner && banner.cheer ? (Math.floor(time * 6) & 1) : 0;
    ctx.drawImage(CROWD[cheer], Math.round(-camX - 32), 18);
    // bottom strip
    ctx.fillStyle = '#000'; ctx.fillRect(0, PY + H, VW, VH - PY - H);
  }

  function drawGoal(x, dir) {
    // net behind the line
    const nx = sx(x) + (dir > 0 ? 0 : -12);
    ctx.fillStyle = '#20282c'; ctx.fillRect(nx, PY + GY - GW - BAR, 12, GW * 2 + 1);
    ctx.fillStyle = '#485058';
    for (let i = 0; i < 12; i += 3) ctx.fillRect(nx + i, PY + GY - GW - BAR, 1, GW * 2 + 1);
    for (let j = 0; j <= GW * 2; j += 3) ctx.fillRect(nx, PY + GY - GW - BAR + j, 12, 1);
  }
  function drawPosts(x) {
    const px = sx(x);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(px, PY + GY - GW - POSTH, 1, POSTH + 1);       // far upright
    ctx.fillRect(px, PY + GY + GW - POSTH, 1, POSTH + 1);       // near upright
    for (let y = GY - GW; y <= GY + GW; y++) ctx.fillRect(px, PY + y - BAR, 1, 1); // crossbar
  }

  function drawPlayer(p) {
    const kp = p.keeper ? 1 : 0, fr = p.moving ? (Math.floor(p.anim) & 3) : 0;
    const spr = SPR[p.t][kp][fr], x = sx(p.x), y = PY + Math.round(p.y);
    // shadow
    ctx.fillStyle = 'rgba(0,30,0,0.45)'; ctx.fillRect(x - 3, y - 1, 7, 2);
    const sh = p.stun > 0 ? (Math.floor(time * 20) & 1) : 0;
    ctx.save(); ctx.translate(x, y - 13 + sh);
    if (p.face < 0) { ctx.scale(-1, 1); ctx.drawImage(spr, -4, 0); } else ctx.drawImage(spr, -4, 0);
    ctx.restore();
    // hurley
    const s = p.face, hx = x + s * 3, hy = y - 6 + sh;
    let a;
    if (p.swing > 0) { const u = 1 - p.swing / 0.3; a = lerp(-2.4, 1.1, u); }
    else a = 0.55;
    const ex = Math.round(hx + s * 9 * Math.sin(a)), ey = Math.round(hy + 9 * Math.cos(a));
    ctx.strokeStyle = '#d8b060'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + 0.5, hy + 0.5); ctx.lineTo(ex + 0.5, ey + 0.5); ctx.stroke();
    ctx.fillStyle = '#f0e0a0'; ctx.fillRect(ex - 1, ey - 1, 3, 2);
  }

  function drawBall() {
    const b = ball, x = sx(b.x), y = PY + Math.round(b.y), z = Math.round(b.z);
    ctx.fillStyle = 'rgba(0,30,0,0.5)'; ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillStyle = '#301800'; ctx.fillRect(x - 2, y - z - 3, 4, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - z - 2, 2, 2);
    ctx.fillStyle = '#d04020'; ctx.fillRect(x - 1, y - z - 2, 1, 1);
  }

  function drawHUD() {
    ctx.fillStyle = '#10103c'; ctx.fillRect(0, 0, VW, 18);
    ctx.fillStyle = '#f0c020'; ctx.fillRect(0, 17, VW, 1);
    [0, 1].forEach(t => {
      const T = TEAMS[t], x = t === 0 ? 4 : VW - 4, al = t === 0 ? 'l' : 'r';
      ctx.fillStyle = T.j; ctx.fillRect(t === 0 ? 4 : VW - 10, 3, 6, 4);
      const nx = t === 0 ? 13 : VW - 13;
      txt(T.name, nx, 2, 1, '#fff', al);
      txt(fmt(score[t]) + ' (' + pts(score[t]) + ')', nx, 10, 1, '#f0c020', al);
    });
    const m = Math.floor(clock / 60), s = Math.floor(clock % 60);
    txt('H' + half, VW / 2, 2, 1, '#88f', 'c');
    txt(m + ':' + (s < 10 ? '0' : '') + s, VW / 2, 10, 1, '#fff', 'c');
    // bottom hints
    txt('ARROWS MOVE  Z SOLO  X STICK PASS  C HAND PASS  V HOOK  SPACE SHOOT', VW / 2, PY + H + 3, 1, '#9a9ac0', 'c');
  }

  function drawOverlay() {
    if (ctrl && !banner) {
      const x = sx(ctrl.x), y = PY + Math.round(ctrl.y), bob = Math.floor(time * 6) & 1;
      ctx.fillStyle = '#f8e020';
      ctx.fillRect(x - 2, y - 20 - bob, 5, 1); ctx.fillRect(x - 1, y - 19 - bob, 3, 1); ctx.fillRect(x, y - 18 - bob, 1, 1);
      if (ball.owner === ctrl) {
        const st = Math.min(4, Math.floor(ctrl.stepAcc / 12));
        for (let i = 0; i < 4; i++) { ctx.fillStyle = i < st ? (st >= 4 ? '#f02020' : '#f8e020') : '#303030'; ctx.fillRect(x - 6 + i * 3, y - 24 - bob, 2, 2); }
        if (ctrl.charge > 0) {
          ctx.fillStyle = '#000'; ctx.fillRect(x - 9, y + 2, 18, 4);
          ctx.fillStyle = ctrl.charge > 0.3 ? '#f02020' : '#20e020'; ctx.fillRect(x - 8, y + 3, Math.round(16 * ctrl.charge), 2);
        }
      }
    }
    if (toast && !banner) txt(toast.text, VW / 2, 36, 2, '#fff', 'c', '#000');
    if (banner) {
      ctx.fillStyle = 'rgba(0,0,40,0.55)'; ctx.fillRect(0, 78, VW, 50);
      txt(banner.text, VW / 2, 84, 4, '#f8e020', 'c', '#c02010');
      txt(banner.sub, VW / 2, 112, 1, '#fff', 'c', '#000');
    }
  }

  function drawTitle() {
    ctx.fillStyle = '#0c2a0c'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < VH; i += 8) { ctx.fillStyle = (i / 8) & 1 ? '#0f340f' : '#0c2a0c'; ctx.fillRect(0, i, VW, 8); }
    txt("HURLING '92", VW / 2, 18, 5, '#f8e020', 'c', '#c02010');
    txt('THE 2D IRISH HURLING GAME', VW / 2, 52, 1, '#fff', 'c', '#000');
    // little demo sprites
    [[60, 0], [110, 1]].forEach(d => {
      ctx.save(); ctx.translate(d[0], 94); if (d[1]) ctx.scale(-1, 1);
      ctx.scale(3, 3); ctx.drawImage(SPR[d[1]][0][Math.floor(time * 6) & 3], -4, -13); ctx.restore();
    });
    ctx.save(); ctx.translate(VW - 60, 94); ctx.scale(-3, 3); ctx.drawImage(SPR[1][0][Math.floor(time * 6) & 3], -4, -13); ctx.restore();
    const lines = [['ARROWS / WASD', 'MOVE'], ['Z', 'SOLO (HOLD TO KEEP SOLOING)'], ['HOLD SPACE', 'CHARGE SHOT: TAP=GOAL TRY, LONG=POINT'],
      ['X', 'STICK PASS (GROUND)'], ['C', 'HAND PASS (SHORT)'], ['V / SPACE', 'HOOK THE OPPONENT']];
    lines.forEach((l, i) => { txt(l[0], 50, 112 + i * 9, 1, '#f8e020'); txt(l[1], 112, 112 + i * 9, 1, '#fff'); });
    txt('4 STEPS WITH THE BALL THEN YOU MUST SOLO', VW / 2, 172, 1, '#9cf', 'c');
    if (Math.floor(time * 2) & 1) txt('PRESS ENTER TO START', VW / 2, 186, 1, '#fff', 'c', '#000');
  }

  function drawEnd() {
    drawPitch(); drawHUD();
    ctx.fillStyle = 'rgba(0,0,40,0.75)'; ctx.fillRect(40, 50, 240, 100);
    const a = pts(score[0]), b = pts(score[1]);
    txt('FULL TIME', VW / 2, 58, 3, '#f8e020', 'c', '#c02010');
    txt(TEAMS[0].name + ' ' + fmt(score[0]) + ' (' + a + ')', VW / 2, 86, 1, '#fff', 'c');
    txt(TEAMS[1].name + ' ' + fmt(score[1]) + ' (' + b + ')', VW / 2, 96, 1, '#fff', 'c');
    txt(a > b ? 'YOU WIN!' : a < b ? 'YOU LOSE' : 'A DRAW', VW / 2, 114, 2, '#f8e020', 'c', '#000');
    if (Math.floor(time * 2) & 1) txt('PRESS ENTER', VW / 2, 136, 1, '#fff', 'c');
  }

  function render() {
    if (state === 'title') return drawTitle();
    if (state === 'end') return drawEnd();
    drawPitch();
    drawGoal(0, -1); drawGoal(W, 1);
    const ents = P.map(p => ({ y: p.y, f: () => drawPlayer(p) }));
    ents.push({ y: ball.y + 0.5, f: drawBall });
    ents.push({ y: -1, f: () => drawPosts(0) }, { y: -1, f: () => drawPosts(W) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
    drawHUD(); drawOverlay();
  }

  /* ---------- main loop ---------- */
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    update(dt); edge = {}; render();
    requestAnimationFrame(frame);
  }
  ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, noFric: 0, lastT: 0 };
  score = [{ g: 0, p: 0 }, { g: 0, p: 0 }];
  requestAnimationFrame(frame);

  window.__hurling = { start: newMatch, step: update, render, get state() { return state; }, get score() { return score; }, get P() { return P; }, get ball() { return ball; } };
  if (DEMO) newMatch();
})();
