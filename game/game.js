(function () {
  'use strict';
  if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">three.js failed to load (vendor/three/three.min.js).</p>'; return; }
  // ── Co Engine ─────────────────────────────────────────────────────
  // The engine parts come first in the closure, the game's parts after. The engine declares the names both sides share
  // here, unassigned, and fills them when the game calls CO.setup (the renderer, the scene, the palette) and CO.boot (the
  // state, the shell, the frame loop). A game part may use any of them at its top level once CO.setup has run.
  var CO = { version: '0.11.0', cfg: null, game: null, root: null, flash: 0, ready: false, paused: false, stepOnce: false, editor: null };
  var S, SET, SAVE, SETTINGS_KEY, BOOT_SLOT, BOOT_SAVE;               // 40-state fills these
  var canvas, renderer, scene, camera;                                 // 10-three fills these in CO.setup
  var player = null, focus = null, hudDirty = true;                    // 42-player owns player and focus; the HUD throttle flag is read everywhere

  // ── Utilities ─────────────────────────────────────────────────────
  var now = function () { return Date.now(); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var money = function (n) { return (n < 0 ? '-$' : '$') + Math.floor(Math.abs(n)).toLocaleString('en-US'); };
  var randi = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var randf = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmtTime = function (h) { h = ((h % 24) + 24) % 24; var m = Math.floor((h % 1) * 60); return pad2(Math.floor(h)) + ':' + pad2(m); };
  var dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
  var uid = (function () { var n = 0; return function (p) { n++; return (p || 'id') + '-' + Date.now().toString(36) + '-' + n.toString(36); }; })();
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };   // MIDI note to Hz, for anything that plays a tune
  // the hook bus: a game or a pack registers a function under a name, the engine calls every one in order, each inside its own try
  var HOOKS = {};
  function hook(name, fn) { (HOOKS[name] = HOOKS[name] || []).push(fn); return fn; }
  // every argument reaches every hook (the lighting hook takes four: day, dawn, overcast, power; until 0.5.1 only three got through, so power was always undefined)
  function runHooks(name) { var list = HOOKS[name]; if (!list) return; var args = Array.prototype.slice.call(arguments, 1); for (var i = 0; i < list.length; i++) { try { list[i].apply(null, args); } catch (e) { if (typeof console !== 'undefined') console.error('hook ' + name + ': ' + (e && e.message || e)); } } }
  // CO.setup(cfg): the game's first part calls this once, before any part uses the scene. It reads the settings and the save slot
  // (40-state), makes the renderer, the scene, the camera, the lights and the palette (10-three), then runs the 'setup' hooks.
  // cfg.game is the game's hook object (CO.game). Function declarations are hoisted, so the parts that define the setup steps come later.
  function coSetup(cfg) { cfg = cfg || {}; CO.cfg = cfg; CO.game = cfg.game || CO.game || {}; coSetupState(cfg); if (cfg.fov === undefined && SET && SET.fov) cfg.fov = SET.fov; coSetupThree(cfg); coSetupShell(cfg); coSetupPlayer(cfg); runHooks('setup', cfg); CO.ready = true; return CO; }
  CO.setup = coSetup;
  // ── Three.js world ────────────────────────────────────────────────
  // Nothing here runs at parse time. CO.setup(cfg) makes the renderer, the scene, the camera, the sun and the sky bounce, draws
  // the base textures and builds the palette; from then on a game's parts can call box(), sign(), MAT.wall and the rest at
  // their top level. cfg (every field optional):
  //   canvas 'co-canvas'  exposure 0.82  background 0x8fb0d4  fog { color, near 70, far 190 }  fov 75  near 0.08  far 260
  //   env true (the reflection studio)  hemi { sky 0xdfeaff, ground 0x5a4d40, intensity 0.45 }
  //   sun { color 0xfff0d8, intensity 1.1, box 70, near 1, far 230, mapSize 4096, target [0, 0, -20] }  lightBudget 12  post true
  var shadowDirty = true, shadowT = 0;
  var worldTime = 0;   // seconds since boot, for anything that sways, spins or pulses
  var hemi = null, sun = null;
  var TEX = {}, NRM = {}, RGH = {}, MAT = {};

  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  // Reflections: a small studio (dark shell, a few bright troffers, one warm and one cool wall) is drawn once and baked into
  // the environment map. It is dim on purpose: it is there so chrome, glass and screens have something to reflect, not to light the hall.
  function buildEnvStudio() {
    var es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x0b0d0f, side: THREE.BackSide })));
    function pane(w, h, col, k, x, y, z, rx, ry) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); es.add(m); }
    pane(24, 24, 0x14100c, 1, 0, -5.9, 0, -Math.PI / 2); pane(24, 24, 0x141517, 1, 0, 5.9, 0, Math.PI / 2);
    [[-5, -4], [5, -4], [-5, 4], [5, 4], [0, 0]].forEach(function (p) { pane(3.0, 1.1, 0xfff4e2, 1.1, p[0], 5.8, p[1], Math.PI / 2); });
    pane(6, 4, 0xcfe4ff, 1.2, 0, 1, -11.8, 0, 0); pane(5, 3.5, 0xffd9a8, 0.9, 11.8, 0.5, 2, 0, -Math.PI / 2);
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    try { var rt = pm.fromScene(es, 0.04); scene.environment = rt.texture; } catch (e) { /* no env map on this GPU: materials fall back to the lights */ }
    pm.dispose();
  }

  // Three.js lights every pixel with every visible point light, whether or not the light can reach it, so thirty lamps mean thirty
  // evaluations per pixel. Every point light in the scene goes in one list and only the nearest few to the camera stay visible; the
  // rest are hidden. The visible count is held constant so the shaders are not recompiled when you walk from one end of the hall
  // to the other. A lamp inside a hidden group is left alone (the renderer skips it anyway). Lamps that are off sort last.
  var lightBudget = { n: 12, lights: null, scanT: 0, tickT: 0, tmp: new THREE.Vector3(), cam: new THREE.Vector3() };
  function updateLightBudget() {
    var t = worldTime;
    if (!lightBudget.lights || t - lightBudget.scanT > 2) { var list = []; scene.traverse(function (o) { if (o.isPointLight) list.push(o); }); lightBudget.lights = list; lightBudget.scanT = t; }
    if (t - lightBudget.tickT < 0.1) return; lightBudget.tickT = t;
    camera.getWorldPosition(lightBudget.cam);
    var cand = [];
    lightBudget.lights.forEach(function (l) {
      for (var p = l.parent; p; p = p.parent) if (p.visible === false) return;
      l.getWorldPosition(lightBudget.tmp); var d = lightBudget.tmp.distanceTo(lightBudget.cam);
      l.userData.budgetScore = (l.intensity > 0 ? 0 : 1e6) + Math.max(0, d - (l.distance || 40) * 0.25) - (l.visible ? 3 : 0); cand.push(l);   // a lamp already on keeps its place: two near-equal lamps at the cut used to swap every tick
    });
    cand.sort(function (a, b) { return a.userData.budgetScore - b.userData.budgetScore; });
    for (var i = 0; i < cand.length; i++) cand[i].visible = i < lightBudget.n;
  }

  // ── Textures: every one is drawn on a canvas ──────────────────────
  function tex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'); draw(ctx, w, h);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function makeAlphaTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }   // a cut-out sheet: transparent canvas, no repeat
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function grain(ctx, w, h, n, alpha, dark) { for (var i = 0; i < n; i++) { var v = Math.floor(Math.random() * 255); ctx.fillStyle = 'rgba(' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + alpha + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } }
  // soft blotches: water marks, oil, wear. Dark or light, a few big and many small.
  function blotches(ctx, w, h, n, rmin, rmax, dark, alpha) { for (var i = 0; i < n; i++) { var r = randf(rmin, rmax), x = Math.random() * w, y = Math.random() * h; var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + (dark ? '0,0,0,' : '255,255,255,') + alpha + ')'); g.addColorStop(1, 'rgba(' + (dark ? '0,0,0,0)' : '255,255,255,0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
  function cracks(ctx, w, h, n, alpha) { for (var i = 0; i < n; i++) { ctx.strokeStyle = 'rgba(20,20,20,' + alpha + ')'; ctx.lineWidth = 1; ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (var k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; ctx.lineTo(x, y); } ctx.stroke(); } }
  // the base sheets: concrete, asphalt, cladding, plaster, brick, block, wood, grass, a few floors and fabrics. A game adds its own
  // entries to TEX by assignment, with the same helpers.
  function buildBaseTextures() {
    TEX.concrete = tex(1024, 1024, function (c, w, h) {
      c.fillStyle = '#8b8d8e'; c.fillRect(0, 0, w, h); grain(c, w, h, 26000, 0.12); grain(c, w, h, 5000, 0.08, true);
      blotches(c, w, h, 30, 40, 160, true, 0.09); blotches(c, w, h, 16, 30, 110, false, 0.07); cracks(c, w, h, 10, 0.25);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();   // the slab joints
      for (var i = 0; i < 6; i++) { c.strokeStyle = 'rgba(30,30,30,0.18)'; c.lineWidth = randf(6, 14); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.quadraticCurveTo(x + randf(-120, 120), y + randf(-120, 120), x + randf(-260, 260), y + randf(-260, 260)); c.stroke(); }   // tyre scuffs
    }, 5, 3.5);
    TEX.asphalt = tex(1024, 1024, function (c, w, h) { c.fillStyle = '#3d3f42'; c.fillRect(0, 0, w, h); grain(c, w, h, 50000, 0.16); grain(c, w, h, 12000, 0.12, true); for (var i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(120,118,112,0.35)' : 'rgba(86,84,80,0.4)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } blotches(c, w, h, 10, 60, 260, true, 0.14); blotches(c, w, h, 6, 40, 160, false, 0.05); cracks(c, w, h, 16, 0.25); for (var s = 0; s < 4; s++) { c.strokeStyle = 'rgba(14,14,16,0.5)'; c.lineWidth = randf(3, 6); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (var k = 0; k < 8; k++) { x += randf(-60, 60); y += randf(-60, 60); c.lineTo(x, y); } c.stroke(); } }, 22, 22);
    TEX.corrugated = tex(512, 256, function (c, w, h) {
      c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 16) { var g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#7e8792'); g.addColorStop(0.5, '#b7bfc8'); g.addColorStop(1, '#7e8792'); c.fillStyle = g; c.fillRect(x, 0, 16, h); }
      grain(c, w, h, 2500, 0.06, true);
      for (var y = 24; y < h; y += 104) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = 'rgba(40,45,50,0.5)'; c.beginPath(); c.arc(rx, y, 1.6, 0, 6.3); c.fill(); }   // rivet rows
      for (var i = 0; i < 8; i++) { var sx = Math.random() * w; var sg = c.createLinearGradient(0, h * 0.5, 0, h); sg.addColorStop(0, 'rgba(120,70,30,0)'); sg.addColorStop(1, 'rgba(110,60,25,0.35)'); c.fillStyle = sg; c.fillRect(sx, h * 0.5, randf(2, 6), h * 0.5); }   // rust streaks down from the fixings
    }, 8, 2);
    TEX.corrugatedDoor = tex(256, 256, function (c, w, h) { c.fillStyle = '#5d6771'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 20) { var g = c.createLinearGradient(0, y, 0, y + 20); g.addColorStop(0, '#4a535c'); g.addColorStop(0.5, '#7b858f'); g.addColorStop(1, '#4a535c'); c.fillStyle = g; c.fillRect(0, y, w, 20); } grain(c, w, h, 1500, 0.08, true); blotches(c, w, h, 6, 20, 60, true, 0.2); }, 2, 4);
    TEX.plaster = tex(256, 256, function (c, w, h) { c.fillStyle = '#e4e1d8'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.05); blotches(c, w, h, 4, 20, 50, true, 0.05); }, 4, 2);
    TEX.wood = tex(256, 128, function (c, w, h) {
      c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h);
      var drift = [randf(-6, 6), randf(-6, 6), randf(-6, 6)];
      for (var i = 0; i < 60; i++) { c.strokeStyle = 'rgba(80,50,20,' + (0.1 + Math.random() * 0.25) + ')'; c.lineWidth = 1 + Math.random() * 1.5; c.beginPath(); var y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + drift[0] + randf(-3, 3), w * 0.65, y + drift[1] + randf(-3, 3), w + 4, y + drift[2]); c.stroke(); }
      for (var p = 0; p < 500; p++) { c.fillStyle = 'rgba(60,35,10,0.18)'; c.fillRect(Math.random() * w, Math.random() * h, randf(3, 10), 1); }
      c.fillStyle = 'rgba(0,0,0,0.3)'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 2); });   // the slat gaps of a pallet deck
    }, 1, 1);
    TEX.grass = tex(512, 512, function (c, w, h) { c.fillStyle = '#4f6a3a'; c.fillRect(0, 0, w, h); var cols = ['#3f6f2e', '#5c8f44', '#6f9a4a', '#45752f', '#7ea25a']; for (var i = 0; i < 3000; i++) { var x = Math.random() * w, y = Math.random() * h; c.strokeStyle = cols[i % 5]; c.lineWidth = randf(0.8, 1.6); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + randf(-4, 4), y - randf(4, 9), x + randf(-6, 6), y - randf(8, 16)); c.stroke(); } c.fillStyle = 'rgba(70,50,30,.16)'; for (var d = 0; d < 20; d++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, randf(14, 40), randf(8, 22), Math.random() * 3, 0, 6.29); c.fill(); } }, 30, 30);
    TEX.skylight = tex(64, 64, function (c, w, h) { c.fillStyle = '#eef6ff'; c.fillRect(0, 0, w, h); }, 1, 1);
    TEX.hazard = tex(128, 32, function (c, w, h) { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (var x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x + 32, h); c.lineTo(x + 16, h); c.closePath(); c.fill(); } grain(c, w, h, 300, 0.1, true); }, 4, 1);
    TEX.noiseMetal = tex(128, 128, function (c, w, h) { c.fillStyle = '#9ea4aa'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.1); }, 1, 1);
    TEX.vmesh = tex(128, 256, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(60,96,70,1)'; c.lineWidth = 2.2; for (var vx = 4; vx < w; vx += 10) { c.beginPath(); c.moveTo(vx, 0); c.lineTo(vx, h); c.stroke(); } for (var hy = 4; hy < h; hy += 28) { c.beginPath(); c.moveTo(0, hy); c.lineTo(w, hy); c.stroke(); } }, 2, 1);
    TEX.mesh = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(70,75,80,0.95)'; c.lineWidth = 2; for (var i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, h); c.stroke(); c.beginPath(); c.moveTo(i + 16, 0); c.lineTo(i, h); c.stroke(); } }, 8, 2);
    TEX.brick = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c2b4'; c.fillRect(0, 0, w, h); var cols = ['#8a4a3a', '#95553f', '#7c4335', '#9a5c45', '#874836', '#a0634c']; var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(cols); c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } grain(c, w, h, 6000, 0.2); }, 2, 0.6);
    TEX.paper = tex(128, 128, function (c, w, h) { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); grain(c, w, h, 800, 0.05); }, 1, 1);
    TEX.cork = tex(256, 256, function (c, w, h) { c.fillStyle = '#b8905c'; c.fillRect(0, 0, w, h); grain(c, w, h, 8000, 0.25); blotches(c, w, h, 60, 3, 10, true, 0.3); }, 1, 1);
    TEX.fabric = tex(128, 128, function (c, w, h) { c.fillStyle = '#2f4a73'; c.fillRect(0, 0, w, h); grain(c, w, h, 4000, 0.12); }, 1, 1);
    TEX.cloth = tex(128, 128, function (c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { c.fillStyle = 'rgba(0,0,0,' + (((x + y) / 2) % 2 ? 0.14 : 0.04) + ')'; c.fillRect(x, y, 2, 2); } }, 6, 6);   // a white weave that takes whatever colour a shirt is given
    TEX.rubberMat = tex(128, 128, function (c, w, h) { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, w, h); c.fillStyle = '#24272b'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 6, 6);
    // painted blockwork: four courses of 400 x 200 blocks in a sheet 1.6 by 0.8 m, grey paint over grey block, a few blocks a shade off
    TEX.block = tex(512, 256, function (c, w, h) { c.fillStyle = '#6e7276'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(['#9a9c9a', '#959895', '#9fa19e', '#929592', '#9c9e9b']); c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } grain(c, w, h, 5000, 0.08); blotches(c, w, h, 10, 20, 70, true, 0.08); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(40,40,42,' + randf(0.05, 0.2) + ')'; c.fillRect(Math.random() * w, h * 0.7 + Math.random() * h * 0.3, randf(2, 10), randf(2, 5)); } }, 1, 1);
    // carpet tile for an office: half-metre tiles in a blue-grey loop pile, the joints just showing, laid chequerboard
    TEX.carpet = tex(256, 256, function (c, w, h) { c.fillStyle = '#3f4857'; c.fillRect(0, 0, w, h); for (var ty = 0; ty < 2; ty++) for (var tx = 0; tx < 2; tx++) { c.fillStyle = (tx + ty) % 2 ? '#404a5a' : '#3b4453'; c.fillRect(tx * 128 + 1, ty * 128 + 1, 126, 126); } grain(c, w, h, 14000, 0.1); for (var y = 0; y < h; y += 3) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, y, w, 1); } }, 1, 1);
    // vinyl sheet: a pale speckled floor with a faint weld line every 1.5 m
    TEX.vinyl = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { c.fillStyle = pick(['rgba(90,86,80,0.35)', 'rgba(255,255,255,0.3)', 'rgba(120,110,100,0.25)']); c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 3)); } blotches(c, w, h, 6, 30, 90, true, 0.05); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h / 2 - 1, w, 2); }, 1, 1);
    // a ceiling tile for rooms, and a plain lining for the inside of a trailer or a container
    TEX.tile = tex(256, 256, function (c, w, h) { c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.05, true); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 6, 4);
    TEX.lining = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9cdd1'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.08); for (var y = 0; y < h; y += 64) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y, w, 3); } for (var i = 0; i < 24; i++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.18) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(10, 40), randf(2, 6)); } }, 6, 2);
  }
  // a sign on the house slate (#1b232c) is an enamelled plate: the slate shades a little towards the bottom, a hairline of
  // light sits just in from the edge and a hairline of the sign's own colour inside that. opt.plate false turns that off (paint)
  function isPlate(opt) { return !!opt && opt.plate !== false && (opt.plate === true || opt.bg === '#1b232c'); }
  function textTex(lines, opt) {
    opt = opt || {}; var w = opt.w || 512, h = opt.h || 128, plate = isPlate(opt);
    return tex(w, h, function (c) {
      if (plate) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#222c38'); g.addColorStop(1, '#10161d'); c.fillStyle = g; c.fillRect(0, 0, w, h); var e = Math.max(2, Math.round(Math.min(w, h) * 0.02)); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = e; c.strokeRect(e / 2, e / 2, w - e, h - e); c.strokeStyle = opt.fg || '#f5b53d'; c.globalAlpha = 0.5; c.lineWidth = Math.max(1, e * 0.6); c.strokeRect(e * 3, e * 3, w - e * 6, h - e * 6); c.globalAlpha = 1; }
      else { c.fillStyle = opt.bg || '#1b232c'; c.fillRect(0, 0, w, h); }
      if (opt.border) { c.strokeStyle = opt.border; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); }
      c.fillStyle = opt.fg || '#f5b53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var size = opt.size || Math.min(h * 0.6, w / (Math.max.apply(null, lines.map(function (l) { return l.length; })) * 0.6));
      c.font = (opt.weight || 'bold') + ' ' + Math.floor(size) + 'px ' + (opt.font || 'Bahnschrift, Arial, sans-serif');
      if (plate) { c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = Math.max(2, size * 0.08); c.shadowOffsetY = Math.max(1, size * 0.04); }
      lines.forEach(function (l, i) { c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15, w * 0.92); });   // never off the plate
      c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    });
  }
  // normal maps: a height field drawn on a canvas, turned into tangent-space normals with a Sobel filter. Linear, never sRGB.
  function normalTex(w, h, drawHeight, strength, rx, ry) {
    var hc = document.createElement('canvas'); hc.width = w; hc.height = h; var hx = hc.getContext('2d'); drawHeight(hx, w, h);
    var src = hx.getImageData(0, 0, w, h).data, out = hx.createImageData(w, h), o = out.data, s = strength || 1;
    var at = function (x, y) { x = (x + w) % w; y = (y + h) % h; return src[(y * w + x) * 4] / 255; };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      var dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      var nx = -dx * s, ny = -dy * s, nz = 1, len = Math.sqrt(nx * nx + ny * ny + nz * nz), i = (y * w + x) * 4;
      o[i] = (nx / len * 0.5 + 0.5) * 255; o[i + 1] = (ny / len * 0.5 + 0.5) * 255; o[i + 2] = (nz / len * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    hx.putImageData(out, 0, 0);
    var t = new THREE.CanvasTexture(hc); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 8; return t;
  }
  function heightNoise(c, w, h, base, n, amp) { c.fillStyle = base; c.fillRect(0, 0, w, h); for (var i = 0; i < n; i++) { var v = Math.floor(128 + (Math.random() - 0.5) * amp); c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.6)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 4), randf(1, 4)); } }
  function buildBaseNormals() {
    NRM.concrete = normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 14000, 90); for (var i = 0; i < 20; i++) { var r = randf(20, 90), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(60,60,60,0.5)'); g.addColorStop(1, 'rgba(128,128,128,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } c.strokeStyle = '#303030'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 1.6, 5, 3.5);
    NRM.corrugated = normalTex(256, 128, function (c, w, h) { for (var x = 0; x < w; x++) { var v = Math.floor(128 + Math.sin(x / 16 * Math.PI * 2) * 90); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(x, 0, 1, h); } for (var y = 12; y < h; y += 52) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = '#404040'; c.beginPath(); c.arc(rx, y, 2.2, 0, 6.3); c.fill(); } }, 2.2, 8, 2);
    NRM.ribs = normalTex(128, 256, function (c, w, h) { for (var y = 0; y < h; y++) { var v = Math.floor(128 + Math.sin(y / 20 * Math.PI * 2) * 100); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, y, w, 1); } }, 2.0, 2, 4);
    NRM.asphalt = normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 40000, 120); }, 1.2, 22, 22);
    NRM.plaster = normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 3000, 40); }, 0.8, 4, 2);
    NRM.brick = normalTex(256, 256, function (c, w, h) { c.fillStyle = '#a0a0a0'; c.fillRect(0, 0, w, h); var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#404040'; c.fillRect(x, r * bh, bw, bh); c.fillStyle = '#a8a8a8'; c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 2000, 30); }, 1.8, 2, 0.6);
    NRM.wood = normalTex(256, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var i = 0; i < 70; i++) { var y = Math.random() * h; c.strokeStyle = 'rgba(40,40,40,' + randf(0.2, 0.6) + ')'; c.lineWidth = randf(1, 2); c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + randf(-4, 4), w * 0.7, y + randf(-4, 4), w, y); c.stroke(); } c.fillStyle = '#202020'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 3); }); }, 1.2, 1, 1);
    NRM.cardboard = normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 2500, 30); c.fillStyle = '#505050'; c.fillRect(0, h * 0.48, w, 4); c.fillStyle = '#9a9a9a'; c.fillRect(w * 0.44, 0, w * 0.12, h); c.fillStyle = '#8c8c8c'; c.fillRect(w * 0.08, h * 0.08, w * 0.34, h * 0.3); for (var i = 0; i < h; i += 6) { c.fillStyle = 'rgba(100,100,100,0.25)'; c.fillRect(0, i, w, 1); } }, 1.0, 1, 1);
    NRM.chequer = normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { var d = ((x + y) / 32) % 2; c.save(); c.translate(x + 16, y + 16); c.rotate(d ? 0.5 : -0.5); c.fillStyle = '#c0c0c0'; c.fillRect(-10, -3, 20, 6); c.restore(); } }, 1.5, 3, 3);
    NRM.rubber = normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.fillStyle = '#b0b0b0'; c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 1.2, 6, 6);
    NRM.block = normalTex(512, 256, function (c, w, h) { c.fillStyle = '#505050'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#9a9a9a'; c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 3000, 30); }, 1.6, 1, 1);
    NRM.carpet = normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 6000, 50); c.fillStyle = '#606060'; c.fillRect(0, 127, w, 2); c.fillRect(127, 0, 2, h); }, 0.9, 1, 1);
  }
  function roughTex(w, h, base, amp, rx, ry) { var t = tex(w, h, function (c) { var v = Math.floor(base * 255); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, 0, w, h); for (var i = 0; i < 4000; i++) { var k = Math.floor(v + (Math.random() - 0.5) * amp * 255); c.fillStyle = 'rgba(' + k + ',' + k + ',' + k + ',0.7)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 6), randf(1, 6)); } for (var j = 0; j < 12; j++) { var r = randf(10, 50), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } }, rx, ry); t.encoding = THREE.LinearEncoding; return t; }

  // ── Materials ─────────────────────────────────────────────────────
  // the environment map is for reflections only: every lit material takes very little light from it
  function dimEnv(m) { if (m && m.isMeshStandardMaterial) m.envMapIntensity = m.isMeshPhysicalMaterial ? 0.45 : (m.metalness > 0.5 ? 0.4 : 0.22); return m; }
  var std = function (o) { return dimEnv(new THREE.MeshStandardMaterial(o)); };
  function glowMat(col, k) { var m = std({ color: 0x111111, emissive: col, emissiveIntensity: k || 1, roughness: 0.4 }); m.userData.glow = true; return m; }
  function buildBasePalette() {
    RGH.floor = roughTex(256, 256, 0.9, 0.25, 5, 3.5); RGH.paint = roughTex(256, 256, 0.45, 0.35, 1, 1); RGH.metal = roughTex(256, 256, 0.5, 0.3, 1, 1);
    var V2 = function (a, b) { return new THREE.Vector2(a, b); };
    MAT.floor = std({ map: TEX.concrete, roughness: 0.92, metalness: 0.03, normalMap: NRM.concrete, normalScale: V2(0.7, 0.7), roughnessMap: RGH.floor });
    MAT.yard = std({ map: TEX.asphalt, roughness: 0.95, normalMap: NRM.asphalt, normalScale: V2(0.6, 0.6) });
    MAT.grass = std({ map: TEX.grass, roughness: 1 });
    MAT.wall = std({ map: TEX.corrugated, roughness: 0.55, metalness: 0.4, normalMap: NRM.corrugated, normalScale: V2(1, 1), roughnessMap: RGH.metal });
    MAT.wallIn = std({ map: TEX.corrugated, roughness: 0.65, metalness: 0.3, color: 0xcfd6dd, normalMap: NRM.corrugated, normalScale: V2(1, 1) });
    MAT.roof = std({ color: 0x3b4249, roughness: 0.9 });
    MAT.roofIn = std({ color: 0x5c6670, roughness: 0.9 });   // the plane is turned to face down, so its front is what you see from the floor
    MAT.door = std({ map: TEX.corrugatedDoor, roughness: 0.55, metalness: 0.4, normalMap: NRM.ribs, normalScale: V2(1, 1) });
    MAT.plaster = std({ map: TEX.plaster, roughness: 0.9, normalMap: NRM.plaster, normalScale: V2(0.4, 0.4) });
    MAT.brick = std({ map: TEX.brick, roughness: 0.95, normalMap: NRM.brick, normalScale: V2(0.9, 0.9) });
    MAT.block = std({ map: TEX.block, roughness: 0.9, normalMap: NRM.block, normalScale: V2(0.8, 0.8) });
    MAT.carpet = std({ map: TEX.carpet, roughness: 1, normalMap: NRM.carpet, normalScale: V2(0.4, 0.4) });
    MAT.vinyl = std({ map: TEX.vinyl, roughness: 0.45, metalness: 0.02 });
    MAT.gunmetal = std({ color: 0x4a5058, roughness: 0.38, metalness: 0.85, map: TEX.noiseMetal });
    MAT.rack = std({ color: 0xcf6417, roughness: 0.55, metalness: 0.3, roughnessMap: RGH.paint });
    MAT.beam = std({ color: 0x2b5aa6, roughness: 0.5, metalness: 0.4 });
    MAT.deck = std({ color: 0x6a737c, roughness: 0.7, metalness: 0.5 });
    MAT.wood = std({ map: TEX.wood, roughness: 0.85, normalMap: NRM.wood, normalScale: V2(0.6, 0.6) });
    MAT.steel = std({ map: TEX.noiseMetal, roughness: 0.45, metalness: 0.6 });
    MAT.steelDark = std({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 });
    MAT.chrome = std({ color: 0xd8dde3, roughness: 0.18, metalness: 0.95 });
    MAT.black = std({ color: 0x15171a, roughness: 0.8 });
    MAT.plastic = std({ color: 0x2a2d33, roughness: 0.6 });
    MAT.rubber = std({ color: 0x1d1f22, roughness: 0.95 });
    MAT.rubberMat = std({ map: TEX.rubberMat, roughness: 0.95, normalMap: NRM.rubber, normalScale: V2(0.8, 0.8) });
    MAT.chequer = std({ color: 0x8e959c, roughness: 0.45, metalness: 0.7, normalMap: NRM.chequer, normalScale: V2(1, 1) });
    MAT.yellow = std({ color: 0xf5b53d, roughness: 0.6 });
    MAT.yellowLine = new THREE.MeshBasicMaterial({ color: 0xd9a12c });
    MAT.whiteLine = new THREE.MeshBasicMaterial({ color: 0xd8dbdf });
    MAT.hazard = std({ map: TEX.hazard, roughness: 0.6 });
    MAT.mesh = std({ map: TEX.mesh, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
    MAT.red = std({ color: 0xc8342a, roughness: 0.6 });
    MAT.green = std({ color: 0x2f9e44, roughness: 0.6 });
    MAT.blue = std({ color: 0x2f6fb3, roughness: 0.6 });
    MAT.white = std({ color: 0xf0f0f0, roughness: 0.6 });
    MAT.grey = std({ color: 0x8c949c, roughness: 0.7 });
    MAT.trim = std({ color: 0xf2efe6, roughness: 0.8 });
    MAT.paper = std({ map: TEX.paper, roughness: 0.95 });
    MAT.cork = std({ map: TEX.cork, roughness: 0.95 });
    MAT.fabric = std({ map: TEX.fabric, roughness: 1 });
    MAT.screen = new THREE.MeshBasicMaterial({ color: 0x0d1216 }); MAT.screen.userData.noBake = true;
    MAT.screenGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false });
    MAT.skylight = new THREE.MeshBasicMaterial({ map: TEX.skylight });
    MAT.lamp = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });
    MAT.exit = new THREE.MeshBasicMaterial({ color: 0x5fd38d }); MAT.exit.userData.noBake = true;
    MAT.glass = std({ color: 0xa9c7e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3 });
    MAT.tile = std({ map: TEX.tile, roughness: 0.95 });
    MAT.lining = std({ map: TEX.lining, roughness: 0.8, metalness: 0.15 });
    MAT.skin = std({ color: 0xd9a98a, roughness: 0.8 });
    MAT.hivis = std({ color: 0xf6c21b, roughness: 0.8 });
    MAT.hivisOrange = std({ color: 0xf07a1a, roughness: 0.8 });
    MAT.jeans = std({ color: 0x2e3f63, roughness: 0.95 });
    MAT.hair = std({ color: 0x3a2a1c, roughness: 0.95 });
    MAT.hit = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }); MAT.hit.userData.noBake = true;
  }

  // ── Geometry helpers ──────────────────────────────────────────────
  var geoCache = {};
  function cachedGeo(k, make) { var g = geoCache[k]; if (!g) { g = geoCache[k] = make(); g.userData.shared = true; } return g; }   // a cached geometry is shared by every mesh built from it: never dispose it with a mesh
  function boxGeo(w, h, d) { return cachedGeo(w + ',' + h + ',' + d, function () { return new THREE.BoxGeometry(w, h, d); }); }
  // A box with every edge eased: a dead sharp edge catches no light and reads as cardboard. The rows of vertices nearest each edge
  // are moved onto an arc, spaced so the corner turns in equal angles, and the normals follow; the texture keeps its scale (the
  // picture did not move, only the rows). Thinner than 30 mm or longer than 4 m stays sharp unless a radius is asked for.
  var BEVEL = { on: true, max: 0.012, faces: [['z', 'y', -1, -1], ['z', 'y', 1, -1], ['x', 'z', 1, 1], ['x', 'z', 1, -1], ['x', 'y', 1, -1], ['x', 'y', -1, -1]] };
  function bevelGeo(w, h, d, r, k) {
    var mn = Math.min(w, h, d), mx = Math.max(w, h, d);
    if (r === undefined) r = (!BEVEL.on || mn < 0.03 || mx > 4) ? 0 : Math.min(BEVEL.max, mn * 0.22);
    if (!(r > 0) || !(mn > 0)) return boxGeo(w, h, d);
    r = Math.min(r, mn * 0.499); k = Math.max(1, Math.round(k || (r > 0.03 ? 3 : r > 0.015 ? 2 : 1)));   /* a big radius needs more than one step to read as round */
    var key = 'b' + w + ',' + h + ',' + d + ',' + r + ',' + k; if (geoCache[key]) return geoCache[key];
    var n = 2 * k + 1, per = (n + 1) * (n + 1), g = new THREE.BoxGeometry(w, h, d, n, n, n), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, half = { x: w / 2, y: h / 2, z: d / 2 }, v = new THREE.Vector3(), c = new THREE.Vector3();
    function ax(p, hf) { var i = Math.round((p + hf) / (2 * hf) * n); return i <= k ? -hf + r - r * Math.tan((k - i) / k * Math.PI / 4) : hf - r + r * Math.tan((i - (n - k)) / k * Math.PI / 4); }
    for (var i = 0; i < pos.count; i++) {
      v.set(ax(pos.getX(i), half.x), ax(pos.getY(i), half.y), ax(pos.getZ(i), half.z));
      var fc = BEVEL.faces[Math.floor(i / per)]; uv.setXY(i, (v[fc[0]] * fc[2] + half[fc[0]]) / (2 * half[fc[0]]), 1 - (v[fc[1]] * fc[3] + half[fc[1]]) / (2 * half[fc[1]]));
      c.set(clamp(v.x, -half.x + r, half.x - r), clamp(v.y, -half.y + r, half.y - r), clamp(v.z, -half.z + r, half.z - r));
      v.sub(c); if (v.lengthSq() > 1e-12) { v.normalize(); nor.setXYZ(i, v.x, v.y, v.z); pos.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
    }
    g.userData.shared = true; return (geoCache[key] = g);
  }
  // a body part cut from an eased box: narrower at one end than the other, the way a chest runs down to a waist. Give it a fresh geometry.
  function taperGeo(g, h, sx0, sz0) { var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = clamp((p.getY(i) + h / 2) / h, 0, 1); p.setX(i, p.getX(i) * lerp(sx0, 1, t)); p.setZ(i, p.getZ(i) * lerp(sz0, 1, t)); } g.computeVertexNormals(); return g; }
  // The same for anything turned: a cylinder's rims are eased and it gets enough sides to read as round. Wires and rods are left alone.
  function roundCylGeo(rt, rb, h, seg) {
    var rmax = Math.max(rt, rb), rmin = Math.min(rt, rb), r = (!BEVEL.on || rmax < 0.025 || h < 0.02) ? 0 : Math.min(BEVEL.max, h * 0.22, rmin * 0.3);
    seg = seg || 18; if (rmax >= 0.025) seg = Math.max(seg, rmax > 0.12 ? 32 : rmax > 0.05 ? 24 : 16);
    var key = 'c' + rt + ',' + rb + ',' + h + ',' + seg + (r > 0.0012 ? '' : 's'); if (geoCache[key]) return geoCache[key];
    if (!(r > 0.0012)) return cachedGeo(key, function () { return new THREE.CylinderGeometry(rt, rb, h, seg); });
    var g = new THREE.CylinderGeometry(rt, rb, h, seg, 3), pos = g.attributes.position, nor = g.attributes.normal, row = seg + 1, torso = 4 * row, slope = (rb - rt) / h;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), top = pos.getY(i) > 0, len = Math.hypot(x, z) || 1, ux = x / len, uz = z / len, rad, y;
      if (i < torso) {
        var rw = Math.floor(i / row);
        if (rw === 0) { rad = rt - r; y = h / 2; } else if (rw === 1) { rad = rt + slope * r; y = h / 2 - r; } else if (rw === 2) { rad = rb - slope * r; y = -h / 2 + r; } else { rad = rb - r; y = -h / 2; }
        if (rw === 0 || rw === 3) { var ny = rw === 0 ? 0.7071 : -0.7071; nor.setXYZ(i, nor.getX(i) * 0.7071, ny, nor.getZ(i) * 0.7071); var nl = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) || 1; nor.setXYZ(i, nor.getX(i) / nl, nor.getY(i) / nl, nor.getZ(i) / nl); }
        pos.setXYZ(i, ux * rad, y, uz * rad);
      } else if (len > 1e-6) { rad = (top ? rt : rb) - r; pos.setXYZ(i, ux * rad, pos.getY(i), uz * rad); }
    }
    g.userData.shared = true; return (geoCache[key] = g);
  }
  // ── Placers: a mesh made, placed and parented in one call. The default parent is CO.root, else the scene ──
  function parentOf(p) { return p || WORLD_PARENT || CO.root || scene; }   // inside a kit call (part 26) the call's own item
  // box(w, h, d, mat, x, y, z, parent) or box(..., opts) with opts { parent, sharp, r, cast, receive, solid, tag, floorLevel }: a textured, tiled,
  // invisible or userData.sharp material gets a plain box, anything else an eased one (r: the bevel radius). A material with
  // userData.tile = [w, h] is tiled in metres, so the same brick lands on every panel whatever its size. opts.solid adds the box's
  // footprint to the game's blockers: CO.game.boxSolid(w, h, d, x, y, z, opts) when the game keeps its own list, else solids.
  function box(w, h, d, mat, x, y, z, parent) {
    var opts = parent && !parent.isObject3D ? parent : null, par = opts ? opts.parent : parent;
    var sharp = (opts && opts.sharp) || !mat || (mat.map && !(opts && opts.r)) || mat.visible === false || !!(mat.userData && (mat.userData.sharp || mat.userData.tile));
    var g = sharp ? boxGeo(w, h, d) : bevelGeo(w, h, d, opts && opts.r);
    if (mat && mat.userData && mat.userData.tile) { var tl = mat.userData.tile, geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv; for (var ui = 0; ui < uv.count; ui++) { var fc = Math.floor(ui / 4), fw = fc < 2 ? d : w, fh = fc >= 2 && fc < 4 ? d : h; uv.setXY(ui, uv.getX(ui) * fw / tl[0], uv.getY(ui) * fh / tl[1]); } g = geo; }
    var m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = !opts || opts.cast !== false; m.receiveShadow = !opts || opts.receive !== false; parentOf(par).add(m);
    if (opts && opts.solid) { if (CO.game && CO.game.boxSolid) CO.game.boxSolid(w, h, d, x, y, z, opts); else solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y - h / 2, y + h / 2); }
    return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.y = ry || 0; m.receiveShadow = true; parentOf(parent).add(m); return m;
  }
  // cyl(r, h, mat, x, y, z, parent, seg, rb), or Grow Co's order cyl(rt, rb, h, mat, x, y, z, parent, seg): the material in the fourth place tells them apart
  function cyl(r, h, mat, x, y, z, parent, seg, rb) {
    if (x && x.isMaterial) return cyl(r, mat, x, y, z, parent, seg, rb === undefined ? 18 : rb, h);
    var m = new THREE.Mesh(roundCylGeo(r, rb === undefined ? r : rb, h, seg || 12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parentOf(parent).add(m); return m;
  }
  function sphere(r, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); m.castShadow = true; parentOf(parent).add(m); return m; }
  // sprite(mat, x, y, z, sx, sy, parent), or Grow Co's sprite(tex, w, h, x, y, z, parent) with a texture first
  function sprite(mat, x, y, z, sx, sy, parent) {
    if (mat && mat.isTexture) return sprite(new THREE.SpriteMaterial({ map: mat, transparent: true, depthWrite: false }), z, sx, sy, x, y, parent);
    var m = new THREE.Sprite(mat); m.position.set(x, y, z); m.scale.set(sx || 1, sy || sx || 1, 1); parentOf(parent).add(m); return m;
  }
  function sign(lines, w, h, x, y, z, ry, opt, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opt) })); m.position.set(x, y, z); m.rotation.y = ry || 0; m.userData.sign = { lines: lines, opt: opt }; parentOf(parent).add(m);
    // an enamelled plate is fixed to something: a sheet of dark metal a little bigger than the print behind it, and on a plate
    // big enough, four studs through the corners. Hung on the sign's own mesh, so whatever moves the sign moves its plate.
    if (isPlate(opt) && !(opt && opt.flat)) { var pl = new THREE.Mesh(bevelGeo(w + 0.03, h + 0.03, 0.014, 0.004), MAT.gunmetal); pl.position.z = -0.0085; pl.castShadow = true; m.add(pl); if (w >= 0.5 && h >= 0.12) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10), MAT.chrome); st.rotation.x = Math.PI / 2; st.position.set(s[0] * (w / 2 - 0.028), s[1] * (h / 2 - 0.028), 0.003); m.add(st); }); }
    return m;
  }
  // a soft dark blob on the ground under anything that stands on it: the contact shadow the sun map cannot give
  var blobTex = null, blobMat = null;
  function groundBlob(w, d, x, z, parent, y) {
    if (!blobMat) { blobTex = tex(128, 128, function (c, w2, h2) { c.clearRect(0, 0, w2, h2); var g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w2, h2); }); blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 1 }); blobMat.userData.noBake = true; }
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, (y || 0) + 0.006, z); m.renderOrder = 1; m.receiveShadow = false; m.userData.noBake = true; parentOf(parent).add(m); return m;
  }
  // things the player can look at and press E on
  var inter = [];
  function addInter(mesh, def) { mesh.userData.it = def; inter.push(mesh); return mesh; }
  function hitBox(w, h, d, x, y, z, def, parent) { var m = new THREE.Mesh(boxGeo(w, h, d), MAT.hit); m.position.set(x, y, z); parentOf(parent).add(m); return addInter(m, def); }
  // things the player cannot walk through: axis-aligned boxes in world space
  var solids = [], dyn = [];
  function solid(x0, x1, z0, z1, y0, y1) { solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -5 : y0, y1: y1 === undefined ? 9 : y1 }); }
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  // things that move every frame: { update: function (dt) }
  var animated = [];
  function animate(fn) { animated.push(fn); }
  // frees a subtree's GPU buffers. Materials and geometries in KEEP (the palette, the caches, anything shared) are left alone.
  var KEEP = [];
  function keepShared(x) { if (KEEP.indexOf(x) < 0) KEEP.push(x); return x; }
  function disposeTree(root) {
    root.traverse(function (o) {
      if (o.geometry && KEEP.indexOf(o.geometry) < 0) { var cached = false; for (var k in geoCache) if (geoCache[k] === o.geometry) { cached = true; break; } if (!cached) o.geometry.dispose(); }
      var mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(function (m) { var shared = KEEP.indexOf(m) >= 0; if (!shared) for (var k2 in MAT) if (MAT[k2] === m) { shared = true; break; } if (!shared && m.map && m.map.userData && m.map.userData.shared) shared = true; if (!shared) m.dispose(); });
    });
  }
  function clearKids(g) { while (g.children.length) { var ch = g.children[0]; g.remove(ch); disposeTree(ch); } }
  // a short-lived burst of particles: sparks, dust, water, cardboard chips
  var bursts = [];
  function burst(x, y, z, col, n, mode) {
    n = n || 20; var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; var a = Math.random() * 6.28, s = randf(0.6, 2.2); vel.push({ x: Math.cos(a) * s * (mode === 'up' ? 0.3 : 1), y: mode === 'up' ? randf(1.5, 3) : mode === 'down' ? -randf(0.5, 1.5) : randf(0.5, 2.5), z: Math.sin(a) * s * (mode === 'up' ? 0.3 : 1) }); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: col, size: mode === 'smoke' ? 0.12 : 0.05, transparent: true, opacity: 0.9, depthWrite: false });
    var pts = new THREE.Points(geo, mat); scene.add(pts);
    bursts.push({ pts: pts, vel: vel, t: 0, life: mode === 'smoke' ? 2.4 : 1.1, mode: mode });
  }
  function tickBursts(dt) {
    for (var i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i]; b.t += dt; var p = b.pts.geometry.attributes.position.array;
      for (var k = 0; k < b.vel.length; k++) { var v = b.vel[k]; if (b.mode !== 'smoke') v.y -= 6 * dt; else v.y += 0.4 * dt; p[k * 3] += v.x * dt; p[k * 3 + 1] += v.y * dt; p[k * 3 + 2] += v.z * dt; if (p[k * 3 + 1] < 0.02 && b.mode !== 'smoke') { p[k * 3 + 1] = 0.02; v.y = -v.y * 0.4; v.x *= 0.6; v.z *= 0.6; } }
      b.pts.geometry.attributes.position.needsUpdate = true; b.pts.material.opacity = 0.9 * (1 - b.t / b.life);
      if (b.t >= b.life) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  }

  // ── Post-processing: the scene renders to a texture, then one full-screen quad applies grading, vignette and grain ──
  var post = { rt: null, quad: null, mat: null, cam: null, scene: null, on: true, t: 0, calls: 0 };
  function buildPost() {
    post.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); post.scene = new THREE.Scene();
    post.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.42 }, uGrain: { value: 0.035 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uLift: { value: 0.012 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSat, uContrast, uLift, uFlash; varying vec2 vUv;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
        'void main() {',
        '  vec2 uv = vUv; vec2 d = uv - 0.5;',
        '  float ca = 0.0012 * dot(d, d) * 4.0;',
        '  vec3 c; c.r = texture2D(tDiffuse, uv + d * ca).r; c.g = texture2D(tDiffuse, uv).g; c.b = texture2D(tDiffuse, uv - d * ca).b;',
        '  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat);',
        '  c = (c - 0.5) * uContrast + 0.5 + uLift;',
        '  float v = smoothstep(0.95, 0.25, length(d) * 1.15); c *= mix(1.0 - uVignette, 1.0, v);',
        '  c += (hash(uv * 1000.0 + fract(uTime)) - 0.5) * uGrain * (1.0 - l * 0.6);',
        '  c += uFlash;',
        '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
        '}'].join('\n'),
      depthTest: false, depthWrite: false
    });
    post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat); post.scene.add(post.quad);
  }
  function postResize() { var w = Math.floor(window.innerWidth * renderer.getPixelRatio()), h = Math.floor(window.innerHeight * renderer.getPixelRatio()); if (post.rt) post.rt.dispose(); post.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding }); post.rt.samples = 0; }
  function lowQuality() { return typeof SET === 'object' && !!SET && SET.quality === 'low'; }
  function renderFrame(dt) {
    if (!post.on || !post.mat || lowQuality()) { renderer.setRenderTarget(null); renderer.render(scene, camera); post.calls = renderer.info.render.calls; post.tris = renderer.info.render.triangles; return; }
    if (!post.rt || post.rt.width !== Math.floor(window.innerWidth * renderer.getPixelRatio())) postResize();
    post.t += dt; post.mat.uniforms.uTime.value = post.t; post.mat.uniforms.tDiffuse.value = post.rt.texture; post.mat.uniforms.uFlash.value = CO.flash * 0.25;
    renderer.setRenderTarget(post.rt); renderer.render(scene, camera); post.calls = renderer.info.render.calls; post.tris = renderer.info.render.triangles;   /* the post quad renders after this and resets the counts */
    renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
  }

  // ── Setup ─────────────────────────────────────────────────────────
  function coSetupThree(cfg) {
    cfg = cfg || {};
    canvas = $(cfg.canvas || 'co-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.id = cfg.canvas || 'co-canvas'; document.body.appendChild(canvas); }
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure === undefined ? 0.82 : cfg.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // the sun map is redrawn on a timer, not every frame
    scene = new THREE.Scene();
    var bg = cfg.background === undefined ? 0x8fb0d4 : cfg.background;
    if (bg !== null) scene.background = new THREE.Color(bg);
    var fog = cfg.fog === undefined ? { color: bg === null ? 0x8fb0d4 : bg, near: 70, far: 190 } : cfg.fog;
    if (fog) scene.fog = new THREE.Fog(fog.color === undefined ? (bg === null ? 0x8fb0d4 : bg) : fog.color, fog.near === undefined ? 70 : fog.near, fog.far === undefined ? 190 : fog.far);
    camera = new THREE.PerspectiveCamera(cfg.fov || 75, 1, cfg.near || 0.08, cfg.far || 260);
    window.addEventListener('resize', resize);
    if (cfg.env !== false) buildEnvStudio();
    var hc = cfg.hemi || {}; hemi = new THREE.HemisphereLight(hc.sky === undefined ? 0xdfeaff : hc.sky, hc.ground === undefined ? 0x5a4d40 : hc.ground, hc.intensity === undefined ? 0.45 : hc.intensity); scene.add(hemi);
    // the shadow box covers the whole site; the sun aims at its target, which a game's lighting pass moves with it
    var sc = cfg.sun || {}, sb = sc.box === undefined ? 70 : sc.box;
    sun = new THREE.DirectionalLight(sc.color === undefined ? 0xfff0d8 : sc.color, sc.intensity === undefined ? 1.1 : sc.intensity); sun.castShadow = true;
    var ms = sc.mapSize || 4096; sun.shadow.mapSize.set(ms, ms); sun.shadow.camera.left = -sb; sun.shadow.camera.right = sb; sun.shadow.camera.top = sb; sun.shadow.camera.bottom = -sb; sun.shadow.camera.near = sc.near === undefined ? 1 : sc.near; sun.shadow.camera.far = sc.far === undefined ? 230 : sc.far;
    var tg = sc.target || [0, 0, -20]; sun.target.position.set(tg[0], tg[1], tg[2]); sun.shadow.bias = sc.bias === undefined ? -0.0006 : sc.bias; sun.shadow.normalBias = sc.normalBias === undefined ? 0.03 : sc.normalBias; sun.shadow.radius = sc.radius === undefined ? 4 : sc.radius;
    scene.add(sun); scene.add(sun.target);
    if (cfg.lightBudget) lightBudget.n = cfg.lightBudget;
    if (cfg.palette !== false) { buildBaseTextures(); buildBaseNormals(); buildBasePalette(); }   // palette false: the game draws every texture and material of its own
    if (cfg.post !== false) buildPost(); else post.on = false;
    CO.three = { renderer: renderer, scene: scene, camera: camera, canvas: canvas };
    return CO.three;
  }
  // ── Static bake ───────────────────────────────────────────────────
  // Thousands of small boxes (bracing, trims, props) each cost a draw call. After the world is built, everything that cannot
  // move or change is merged into one mesh per material. Anything interactive, animated, glowing, transparent, instanced, or
  // under a group flagged dynamic is left alone, so doors, trucks, people, lamps and screens behave as before.
  // A material is kept out of the bake with material.userData.noBake = true (the engine sets it on MAT.hit; a game sets it on
  // its screens and its lit signs). An object is kept out with object.userData.noBake or an ancestor's userData.dynamic.
  var baked = { meshes: [], hidden: 0, draws: 0 };
  function bakeable(o) {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || !o.visible) return false;
    for (var a = o.parent; a; a = a.parent) if (a.visible === false) return false;   /* a removed world item stays out of the bake */
    var m = o.material; if (!m || Array.isArray(m) || m.userData.glow || m.userData.noBake || m.transparent) return false;
    if (o.userData.it || o.userData.noBake || inter.indexOf(o) >= 0) return false;
    if (!(o.geometry && o.geometry.attributes && o.geometry.attributes.position)) return false;
    for (var p = o; p; p = p.parent) { if (p.userData && p.userData.dynamic) return false; if (!p.visible) return false; if (p === camera) return false; }
    return true;
  }
  function bakeStatic() {
    scene.updateMatrixWorld(true);
    var byMat = {}, list = [];
    scene.traverse(function (o) { if (bakeable(o)) list.push(o); });
    list.forEach(function (o) { var k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : ''); (byMat[k] = byMat[k] || { mat: o.material, items: [] }).items.push(o); });
    Object.keys(byMat).forEach(function (k) {
      var grp = byMat[k]; if (grp.items.length < 2) return;
      var pos = [], nor = [], uv = [], hasUv = true;
      grp.items.forEach(function (o) {
        var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        var pa = g.attributes.position.array, na = g.attributes.normal ? g.attributes.normal.array : null, ua = g.attributes.uv ? g.attributes.uv.array : null;
        for (var i = 0; i < pa.length; i++) pos.push(pa[i]);
        if (na) for (var j = 0; j < na.length; j++) nor.push(na[j]); else for (var j2 = 0; j2 < pa.length; j2++) nor.push(0);
        if (ua) for (var u = 0; u < ua.length; u++) uv.push(ua[u]); else hasUv = false;
        g.dispose();
      });
      var merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      if (hasUv && uv.length === pos.length / 3 * 2) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      var mesh = new THREE.Mesh(merged, grp.mat); mesh.castShadow = grp.items[0].castShadow; mesh.receiveShadow = grp.items[0].receiveShadow; mesh.frustumCulled = false; mesh.userData.baked = true;
      scene.add(mesh); baked.meshes.push(mesh);
      grp.items.forEach(function (o) { o.visible = false; o.userData.bakedAway = true; baked.hidden++; });
      baked.draws++;
    });
    shadowDirty = true;
  }
  // everything back the way it was: the merged meshes go, the originals show. A world that changed (a prop moved, a wall grew)
  // calls unbakeStatic, changes, then bakeStatic again.
  function unbakeStatic() { baked.meshes.forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); baked.meshes = []; baked.draws = 0; baked.hidden = 0; scene.traverse(function (o) { if (o.userData.bakedAway) { o.visible = true; o.userData.bakedAway = false; } }); }
  function rebake() { unbakeStatic(); bakeStatic(); }
  // ── Materials from a layer graph ───────────────────────────────────
  // A graph: { size, repeat: [rx, ry], layers: [{ type, color, color2, alpha, blend, n, size, gap, angle, dark }], roughness: 0.9 or
  // { base, amp }, metalness, bump: { amp, strength } or null, emissive, emissiveIntensity, glow, transparent, opacity }. The layers paint
  // one canvas from the bottom up; the same canvas is the colour map. A game's src/00-materials.js calls CO.material before the boot,
  // so a build function can say MAT.myBrick; the editor calls it again while running and every mesh on that material follows.
  var MATGRAPH = {}, MATGRAPH_ORDER = [], MAT_TIME = { value: 0 };
  animate(function (dt) { MAT_TIME.value += dt; });
  var MAT_LAYER_TYPES = ['fill', 'grain', 'blotches', 'cracks', 'noise', 'bricks', 'planks', 'tiles', 'stripes', 'checks', 'rings', 'speckle'];
  function matLayer(ctx, w, h, L, tag, k) {
    var t = L.type || 'fill', a = L.alpha === undefined ? 1 : +L.alpha, c1 = L.color || '#808080', c2 = L.color2 || '#404040', sz = L.size || 32, gap = L.gap === undefined ? 2 : +L.gap, n = L.n === undefined ? 200 : +L.n, i, j;
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = L.blend || 'source-over';
    var rnd1 = function (q, lo, hi) { return seededF(tag + ':' + k, q, lo, hi); };
    if (t === 'fill') { ctx.fillStyle = c1; ctx.fillRect(0, 0, w, h); }
    else if (t === 'grain') { for (i = 0; i < n; i++) { var v = Math.floor(rnd1(i, 0, 255)); ctx.fillStyle = L.dark ? 'rgba(0,0,0,' + rnd1(i + 7, 0.05, 0.3) + ')' : 'rgb(' + v + ',' + v + ',' + v + ')'; ctx.globalAlpha = a * (L.dark ? 1 : 0.18); ctx.fillRect(rnd1(i + 1, 0, w), rnd1(i + 2, 0, h), rnd1(i + 3, 1, 3), rnd1(i + 4, 1, 3)); } }
    else if (t === 'blotches') { for (i = 0; i < n; i++) { var r = rnd1(i, sz * 0.2, sz), x = rnd1(i + 1, 0, w), y = rnd1(i + 2, 0, h), g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, L.dark ? 'rgba(0,0,0,' + a * 0.35 + ')' : c1); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = L.dark ? 1 : a * 0.5; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
    else if (t === 'cracks') { ctx.strokeStyle = c1; ctx.lineWidth = L.width || 1; for (i = 0; i < Math.min(n, 60); i++) { ctx.beginPath(); var cx = rnd1(i, 0, w), cy = rnd1(i + 1, 0, h); ctx.moveTo(cx, cy); for (j = 0; j < 6; j++) { cx += rnd1(i * 10 + j, -sz / 2, sz / 2); cy += rnd1(i * 10 + j + 5, -sz / 2, sz / 2); ctx.lineTo(cx, cy); } ctx.stroke(); } }
    else if (t === 'noise') { var amp = L.amp === undefined ? 40 : +L.amp; for (i = 0; i < n; i++) { var nv = Math.floor(128 + rnd1(i, -0.5, 0.5) * amp); ctx.fillStyle = 'rgb(' + nv + ',' + nv + ',' + nv + ')'; ctx.fillRect(rnd1(i + 1, 0, w), rnd1(i + 2, 0, h), rnd1(i + 3, 2, sz / 4), rnd1(i + 4, 2, sz / 4)); } }
    else if (t === 'bricks') { var bw = L.size || 48, bh = L.size2 || 20; ctx.fillStyle = c2; ctx.fillRect(0, 0, w, h); for (j = 0; j * bh < h; j++) for (i = -1; i * bw < w + bw; i++) { var off = (j % 2) * bw / 2, bx = i * bw + off, by = j * bh; ctx.fillStyle = L.vary ? mixHex(c1, c2, rnd1(i * 97 + j, 0, 0.18)) : c1; ctx.fillRect(bx + gap / 2, by + gap / 2, bw - gap, bh - gap); } }
    else if (t === 'planks') { var pw = L.size || 40; ctx.fillStyle = c2; ctx.fillRect(0, 0, w, h); for (i = 0; i * pw < w; i++) { ctx.fillStyle = mixHex(c1, c2, rnd1(i, 0, 0.15)); ctx.fillRect(i * pw + gap / 2, 0, pw - gap, h); for (j = 0; j < 30; j++) { ctx.fillStyle = 'rgba(0,0,0,' + rnd1(i * 50 + j, 0.03, 0.12) + ')'; ctx.fillRect(i * pw + rnd1(i * 50 + j + 1, 2, pw - 4), rnd1(i * 50 + j + 2, 0, h), 1, rnd1(i * 50 + j + 3, 8, 60)); } } }
    else if (t === 'tiles') { ctx.fillStyle = c2; ctx.fillRect(0, 0, w, h); for (j = 0; j * sz < h; j++) for (i = 0; i * sz < w; i++) { ctx.fillStyle = L.vary ? mixHex(c1, c2, rnd1(i * 131 + j, 0, 0.12)) : c1; ctx.fillRect(i * sz + gap / 2, j * sz + gap / 2, sz - gap, sz - gap); } }
    else if (t === 'stripes') { var ang = (L.angle || 0) * Math.PI / 180, sw = L.size || 16; ctx.translate(w / 2, h / 2); ctx.rotate(ang); ctx.translate(-w, -h); for (i = 0; i * sw < w * 3; i++) { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(i * sw, 0, sw, h * 3); } }
    else if (t === 'checks') { for (j = 0; j * sz < h; j++) for (i = 0; i * sz < w; i++) { ctx.fillStyle = (i + j) % 2 ? c2 : c1; ctx.fillRect(i * sz, j * sz, sz, sz); } }
    else if (t === 'rings') { var rc = L.n === undefined ? 12 : n; for (i = rc; i >= 1; i--) { ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.arc(w / 2, h / 2, (i / rc) * Math.max(w, h) * 0.72, 0, Math.PI * 2); ctx.fill(); } }
    else if (t === 'speckle') { for (i = 0; i < n; i++) { ctx.fillStyle = i % 3 ? c1 : c2; ctx.beginPath(); ctx.arc(rnd1(i, 0, w), rnd1(i + 1, 0, h), rnd1(i + 2, 0.5, sz / 8), 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  function matCanvas(name, g) { var sz = g.size || 256, c = document.createElement('canvas'); c.width = sz; c.height = sz; var ctx = c.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, sz, sz); (g.layers || []).forEach(function (L, k) { if (L && L.on !== false) matLayer(ctx, sz, sz, L, name, k); }); return c; }
  function matBuild(name, g) {
    g = JSON.parse(JSON.stringify(g || {})); if (!g.layers) g.layers = [{ type: 'fill', color: g.color || '#8a8f96' }];
    var sz = g.size || 256, rep = g.repeat || [1, 1], canvas = matCanvas(name, g), map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(rep[0], rep[1]); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
    var rough = typeof g.roughness === 'object' && g.roughness ? g.roughness : null, roughMap = rough ? roughTex(sz, sz, rough.base === undefined ? 0.8 : rough.base, rough.amp === undefined ? 0.2 : rough.amp, rep[0], rep[1]) : null;
    var normalMap = g.bump ? normalTex(sz, sz, function (c, w, h) { heightNoise(c, w, h, '#808080', g.bump.n || 1500, g.bump.amp || 40); }, g.bump.strength || 1, rep[0], rep[1]) : null;
    var m = MAT[name] && MAT[name].isMeshStandardMaterial ? MAT[name] : new THREE.MeshStandardMaterial();
    if (m.map && m.map !== map) m.map.dispose(); if (m.roughnessMap && m.roughnessMap !== roughMap) m.roughnessMap.dispose(); if (m.normalMap && m.normalMap !== normalMap) m.normalMap.dispose();
    m.map = map; m.roughnessMap = roughMap; m.normalMap = normalMap; m.color.set(g.tint || '#ffffff'); m.roughness = rough ? 1 : (g.roughness === undefined ? 0.9 : +g.roughness); m.metalness = g.metalness || 0;
    m.emissive.set(g.emissive || '#000000'); m.emissiveIntensity = g.emissiveIntensity === undefined ? 1 : +g.emissiveIntensity; m.transparent = !!g.transparent || (g.opacity !== undefined && g.opacity < 1); m.opacity = g.opacity === undefined ? 1 : +g.opacity;
    m.userData.glow = !!g.glow; m.userData.graph = true; m.name = name;
    // a GLSL snippet after the colour map: it may change diffuseColor, with vUv (when the material has a map) and uTime in seconds
    if (g.glsl) { var src = String(g.glsl); m.onBeforeCompile = function (sh) { sh.uniforms.uTime = MAT_TIME; sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + src); }; m.customProgramCacheKey = function () { return 'co-glsl:' + name + ':' + src.length + ':' + src.slice(0, 64); }; } else { m.onBeforeCompile = function () {}; m.customProgramCacheKey = function () { return 'co'; }; }
    m.needsUpdate = true;
    MAT[name] = m; if (!MATGRAPH[name]) MATGRAPH_ORDER.push(name); MATGRAPH[name] = g; return m;
  }
  CO.material = function (name, graph) { if (!name) return MATGRAPH; return matBuild(String(name), graph); };
  function matRemove(name) { if (!MATGRAPH[name]) return false; delete MATGRAPH[name]; MATGRAPH_ORDER.splice(MATGRAPH_ORDER.indexOf(name), 1); return true; }
  function matGraphs() { return { order: MATGRAPH_ORDER.slice(), graphs: JSON.parse(JSON.stringify(MATGRAPH)), types: MAT_LAYER_TYPES.slice(), blends: ['source-over', 'multiply', 'overlay', 'screen', 'soft-light', 'darken', 'lighten'], builtin: Object.keys(MAT).filter(function (k) { return !MATGRAPH[k]; }) }; }
  // a picture of one material on a sphere and a cube, rendered off screen with the page's own renderer
  var matPreview = null;
  function matShot(name, size) {
    var m = MAT[name]; if (!m || !renderer) return null; size = size || 160;
    if (!matPreview) { var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20); cam.position.set(0, 1.1, 4.2); cam.lookAt(0, 0.1, 0); sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, 0.9)); var sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2.5, 4, 3); sc.add(sun); var sph = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32), m), cube = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), m); sph.position.x = -0.95; cube.position.x = 0.95; cube.rotation.y = 0.6; cube.rotation.x = 0.2; sc.add(sph); sc.add(cube); matPreview = { scene: sc, cam: cam, sph: sph, cube: cube, rt: new THREE.WebGLRenderTarget(size, size), size: size, canvas: document.createElement('canvas') }; matPreview.canvas.width = size; matPreview.canvas.height = size; }
    var P = matPreview; P.sph.material = m; P.cube.material = m; P.scene.background = new THREE.Color(0x0e141b);
    var was = renderer.getRenderTarget(); renderer.setRenderTarget(P.rt); renderer.render(P.scene, P.cam); var px = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(P.rt, 0, 0, size, size, px); renderer.setRenderTarget(was);
    var ctx = P.canvas.getContext('2d'), img = ctx.createImageData(size, size), row = size * 4, y; for (y = 0; y < size; y++) img.data.set(px.subarray(y * row, y * row + row), (size - 1 - y) * row); ctx.putImageData(img, 0, 0);
    return P.canvas.toDataURL('image/png');
  }
  // the part the editor writes
  function matGraphCode() {
    if (!MATGRAPH_ORDER.length) return '';
    var lines = ['//@ the materials the editor saved: each one a layer graph the engine paints into a texture at load. Written by the Co Engine editor; it sorts first in src/ so every build function can say MAT.<name>. Edit them in the editor rather than here.'];
    MATGRAPH_ORDER.forEach(function (n) { lines.push('  CO.material(' + JSON.stringify(n) + ', ' + JSON.stringify(MATGRAPH[n]) + ');'); });
    lines.push(''); return lines.join('\n');
  }
  // ── The prop system ───────────────────────────────────────────────
  // A prop is built by defProp(id, { label, x, z, rot, cat, wall, fixed, extra, price, ico, desc, when(), snap(), build(ctx, P, inst), after }).
  // Its placement is the default from the definition unless S.layout[id] overrides it ({ x, z, rot, h, hidden }). Bought extras
  // live in S.custom as { id, type, x, z, rot, h }. Rotation is in quarter turns. Each prop builds into its own group, so moving
  // it is: remove the instance, build it again at the new spot.
  // The game's hooks on CO.game, all optional: resolveDef(id, def) rewrites a default spot for the world as it stands (a hall that
  // grew); propAllowed(id, def) says whether a prop stands now (a stage, a level, a licence); groundY(x, z) is the floor a prop
  // stands on; wallPlanes() lists the faces a wall prop can hang on; editClamp(pt, def) keeps a carried prop inside the site;
  // canEdit() gates build mode. Hooks on the bus: 'propCtx' (ctx, g, id), 'propBuilt' (id, inst, def), 'propRemoved' (id, inst),
  // 'propPlaced' (id, inst, def), 'propDeleted' (id, def), 'editBought' (custom record).
  var PROPS = {}, PROP_ORDER = [], propInst = {};
  // The layout a game ships: where its props stand (over what the definitions say) and the copies the editor placed. The editor writes it
  // into src/00-layout.js as CO.layout({ props: { id: { x, z, rot, h, hidden } }, placed: [{ id, type, x, z, rot, h }] }), the first part
  // in the build so the boot sees it. A player's save still wins over it, as it wins over the definitions.
  var LAYOUT = { props: {}, placed: [] };
  CO.layout = function (L) { if (!L) return LAYOUT; if (L.props) for (var k in L.props) LAYOUT.props[k] = L.props[k]; if (L.placed) L.placed.forEach(function (p) { if (p && p.id && !placedById(p.id)) LAYOUT.placed.push(p); }); return LAYOUT; };
  function placedById(id) { for (var i = 0; i < LAYOUT.placed.length; i++) if (LAYOUT.placed[i].id === id) return LAYOUT.placed[i]; return null; }
  function numOr(v, d) { return typeof v === 'number' ? v : d; }
  function defProp(id, def) { if (CO.game && CO.game.resolveDef) CO.game.resolveDef(id, def); def.id = id; if (MODEL_OVER[id]) def.build = MODEL_OVER[id]; PROPS[id] = def; PROP_ORDER.push(id); return def; }
  // a prop whose build is shared (a pack's wrapper, a builder several props use) is reshaped by type: src/00-models.js, written by the
  // editor's Save, says modelOverride(type, build) and the build lands on that prop whenever it is defined, before or after (0.8.0)
  var MODEL_OVER = {};
  function modelOverride(type, build) { MODEL_OVER[type] = build; if (PROPS[type]) PROPS[type].build = build; }
  function propAllowed(id) { var d = PROPS[id]; if (!d) return true; if (d.extra) return true; if (CO.game && CO.game.propAllowed && !CO.game.propAllowed(id, d)) return false; return true; }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); if (c) return PROPS[c.type]; var p = placedById(id); return p ? PROPS[p.type] : null; }
  function customById(id) { return (S && S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  // where a prop stands: the save's override, else the shipped layout, else the definition (a custom copy: the save over its own record)
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), p = placedById(id), o = (S && S.layout && S.layout[id]) || {}, L = LAYOUT.props[id] || {};
    if (c) return { x: numOr(o.x, c.x), z: numOr(o.z, c.z), rot: numOr(o.rot, c.rot || 0), h: numOr(o.h, c.h || 0), hidden: !!o.hidden, custom: true };
    if (p && !d) return { x: numOr(o.x, p.x), z: numOr(o.z, p.z), rot: numOr(o.rot, p.rot || 0), h: numOr(o.h, p.h || 0), hidden: !!o.hidden, custom: false, placed: true };
    return { x: numOr(o.x, numOr(L.x, d.x)), z: numOr(o.z, numOr(L.z, d.z)), rot: numOr(o.rot, numOr(L.rot, d.rot || 0)), h: numOr(o.h, L.h || 0), hidden: o.hidden !== undefined ? !!o.hidden : !!L.hidden, custom: false };
  }
  // the shipped place of a prop, with no save over it: what the layout file says, else the definition
  function propDefault(id) { var d = PROPS[id], p = placedById(id), L = LAYOUT.props[id] || {}; if (p && !d) return { x: p.x, z: p.z, rot: p.rot || 0, h: p.h || 0, hidden: false }; return { x: numOr(L.x, d.x), z: numOr(L.z, d.z), rot: numOr(L.rot, d.rot || 0), h: L.h || 0, hidden: !!L.hidden }; }
  function propLabel(id) { var d = propDef(id); return d ? d.label : id; }
  function rotAABB(o, rot) {
    var pts = [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1]], a = rot * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), xs = [], zs = [];
    pts.forEach(function (p) { xs.push(p[0] * c + p[1] * s); zs.push(-p[0] * s + p[1] * c); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs) };
  }
  // what a build function gets: placers that parent into the prop's group, a solid list the prop fills, a hit box helper that
  // tags the prop id, a point light, and a dynamic sub-group for parts that move (they stay out of the bake)
  function propCtx(g, id) {
    var obs = [];
    var ctx = {
      group: g, obstacles: obs, id: id,
      box: function (w, h, d, mat, x, y, z) { return box(w, h, d, mat, x, y, z, g); },
      cyl: function (r, h, mat, x, y, z, seg, rb) { return cyl(r, h, mat, x, y, z, g, seg, rb); },
      sphere: function (r, mat, x, y, z) { return sphere(r, mat, x, y, z, g); },
      plane: function (w, h, mat, x, y, z, rx, ry) { return plane(w, h, mat, x, y, z, rx, ry, g); },
      sign: function (lines, w, h, x, y, z, ry, opt) { return sign(lines, w, h, x, y, z, ry, opt, g); },
      hit: function (w, h, d, x, y, z, def) { var m = hitBox(w, h, d, x, y, z, def, g); m.userData.propId = id; return m; },
      solid: function (x0, x1, z0, z1, y0, y1) { obs.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -1 : y0, y1: y1 === undefined ? 3 : y1 }); },
      light: function (col, intensity, dist, x, y, z, decay) { var l = new THREE.PointLight(col, intensity, dist, decay === undefined ? 2 : decay); l.position.set(x, y, z); g.add(l); return l; },
      lane: function (points, opt) { return roadLaneLocal(g, id, points, opt); },
      dynGroup: function () { var dg = new THREE.Group(); dg.userData.dynamic = true; g.add(dg); return dg; },
      add: function (m) { g.add(m); return m; }
    };
    runHooks('propCtx', ctx, g, id);
    return ctx;
  }
  function removePropInst(id) {
    var inst = propInst[id]; if (!inst) return;
    var inGroup = function (o) { for (var p = o; p; p = p.parent) if (p === inst.g) return true; return false; };
    inst.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); });
    for (var si = screens.length - 1; si >= 0; si--) if (inGroup(screens[si].mesh)) screens.splice(si, 1);
    scene.remove(inst.g);
    for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1);
    roadDropProp(id);
    runHooks('propRemoved', id, inst);
    delete propInst[id]; NAV.dirty = true;
  }
  function propGroundY(x, z) { var g = CO.game && CO.game.groundY ? CO.game.groundY(x, z) : 0; return TERRAIN.on ? Math.max(g, terrainY(x, z)) : g; }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null; if (!propAllowed(id)) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, (typeof def.y === 'number' ? def.y : propGroundY(P.x, P.z)) + (def.ownHeight ? 0 : (P.h || 0)), P.z);   /* the height a prop was raised to (the inspector, PageUp, Drop) lifts the whole prop; a def that places its own parts by P.h says ownHeight (0.6.0; before, h was stored and never shown) */ g.rotation.y = P.rot * Math.PI / 2;
    var ctx = propCtx(g, id), inst = { id: id, g: g, P: P, ctx: ctx, def: def };
    if (!P.hidden) propInst[id] = inst;   // a removed prop is not on the list: nothing then counts a hidden machine as standing
    if (!P.hidden) {
      def.build(ctx, P, inst);
      g.traverse(function (o) { if (o.isMesh) o.userData.propId = id; });
      ctx.obstacles.forEach(function (o) { var r = rotAABB(o, P.rot); solids.push({ x0: P.x + r.x0, x1: P.x + r.x1, z0: P.z + r.z0, z1: P.z + r.z1, y0: o.y0, y1: o.y1, prop: id }); });
      if (def.after) def.after(ctx, P, inst);
      if (!def.wall && !def.fixed && !def.noBlob && ctx.obstacles.length) { var fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9; ctx.obstacles.forEach(function (o) { fx0 = Math.min(fx0, o.x0); fx1 = Math.max(fx1, o.x1); fz0 = Math.min(fz0, o.z0); fz1 = Math.max(fz1, o.z1); }); groundBlob((fx1 - fx0) * 1.5 + 0.3, (fz1 - fz0) * 1.5 + 0.3, (fx0 + fx1) / 2, (fz0 + fz1) / 2, g, 0); }
      runHooks('propBuilt', id, inst, def);
    }
    scene.add(g); NAV.dirty = true; shadowDirty = true;
    return inst;
  }
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && propAllowed(id) && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); LAYOUT.placed.forEach(function (p) { if (PROPS[p.type] && !PROPS[p.id]) buildProp(p.id); }); (S && S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null, snapCycle: 0, grabRot: 0, snapText: '' };   // snapCycle: which snap (or free heading) R has walked to for the carried piece
  var ray = new THREE.Raycaster(); ray.far = 3.4; var centre = new THREE.Vector2(0, 0);
  function editAllowed() { return CO.game && CO.game.canEdit ? CO.game.canEdit() : true; }
  function editToggle() {
    if (CO.game && CO.game.editMode === false) return;   // the game brings its own build mode
    if (!edit.on && !editAllowed()) return;
    if (edit.grabbed) editDrop(true);
    edit.on = !edit.on;
    var eb = $('h-edit'); if (eb) { eb.hidden = !edit.on; }
    if (edit.on) { unbakeStatic(); focus = null; toast('Build mode: aim at a prop and E grabs it · R turns · Backspace puts it back · Del removes · C is the catalogue', ''); }
    else { if (edit.helper) { scene.remove(edit.helper); edit.helper = null; } bakeStatic(); save(); toast('Layout saved', 'good'); }
    sfx('click'); hudDirty = true;
  }
  function editHelper(obj, col) {
    if (!obj) { if (edit.helper) edit.helper.visible = false; return; }
    if (edit.helper && edit.helper.userData.col !== col) { scene.remove(edit.helper); edit.helper = null; }
    if (!edit.helper) { edit.helper = new THREE.BoxHelper(obj, col); edit.helper.userData.col = col; scene.add(edit.helper); }
    edit.helper.visible = true; edit.helper.setFromObject(obj);
  }
  function wallPlanes() { return CO.game && CO.game.wallPlanes ? CO.game.wallPlanes() : []; }
  // where the carried prop goes: the point on the floor the player aims at, or 2.6 m ahead; a def's own snap first (a belt piece),
  // then the nearest wall face for a wall prop, then the game's clamp (inside the site), on a 5 cm grid while snap is on
  function editAim(def) {
    ray.setFromCamera(centre, camera);
    var dir = ray.ray.direction, o = ray.ray.origin, px = player ? player.x : o.x, pz = player ? player.z : o.z, y = floorY(px, pz), pt;
    var t = (y - o.y) / dir.y;
    if (dir.y < -0.05 && t > 0 && t < 10) pt = o.clone().add(dir.clone().multiplyScalar(t));
    else { var flat = dir.clone(); flat.y = 0; flat.normalize(); pt = o.clone().add(flat.multiplyScalar(2.6)); pt.y = y; }
    var sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (def.snap) { var bs = def.snap(def, pt, edit.grabbed); edit.snapText = bs ? (bs.text || '') : ''; if (bs) return bs; }
    if (def.wall) {
      var best = null, bd = 2.5;
      wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } });
      if (best) { if (best.a === 'x') return { x: best.v, z: sn(pt.z), rot: best.n > 0 ? 1 : 3, wall: true }; return { x: sn(pt.x), z: best.v, rot: best.n > 0 ? 0 : 2, wall: true }; }
    }
    var cl = CO.game && CO.game.editClamp ? CO.game.editClamp(pt, def) : null;
    return { x: sn(cl ? cl.x : pt.x), z: sn(cl ? cl.z : pt.z), rot: null, wall: false };
  }
  function ghostProp(id) { propInst[id].g.traverse(function (o) { if (o.isMesh && o.material && o.material.clone && !o.userData.ghosted) { o.userData.origMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; o.userData.ghosted = true; } }); }
  function editTick() {
    if (!edit.on || (CO.game && CO.game.editMode === false)) return;
    if (edit.grabbed) {
      var inst = propInst[edit.grabbed]; if (!inst) { edit.grabbed = null; return; }
      var def = propDef(edit.grabbed), aim = editAim(def);
      // a piece snapped at another height is rebuilt at that height while it is still being carried
      if (typeof aim.h === 'number' && Math.abs((inst.P.h || 0) - aim.h) > 0.01) { var cc = customById(edit.grabbed); if (cc) cc.h = aim.h; if (S.layout && S.layout[edit.grabbed]) S.layout[edit.grabbed].h = aim.h; buildProp(edit.grabbed); inst = propInst[edit.grabbed]; inst.P.h = aim.h; for (var si = solids.length - 1; si >= 0; si--) if (solids[si].prop === edit.grabbed) solids.splice(si, 1); ghostProp(edit.grabbed); }
      inst.g.position.set(aim.x, propGroundY(aim.x, aim.z), aim.z); if (aim.rot !== null && (def.wall || def.snap)) { inst.P.rot = aim.rot; inst.g.rotation.y = aim.rot * Math.PI / 2; }
      editHelper(inst.g, 0xf5b53d);
    } else if (focus && focus.editId && propInst[focus.editId]) editHelper(propInst[focus.editId].g, 0x5fd38d);
    else editHelper(null);
  }
  function editGrab(id) {
    if (edit.grabbed || !propInst[id]) return;
    var def = propDef(id); if (def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    edit.grabbed = id; edit.snapText = ''; edit.snapCycle = 0; edit.grabRot = propInst[id].P.rot || 0; for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1); NAV.dirty = true;
    ghostProp(id);
    sfx('pickup'); toast('Carrying the ' + propLabel(id) + ' · E places · R turns · Esc drops it back', '');
  }
  function editDrop(cancel) {
    var id = edit.grabbed; if (!id) return; edit.grabbed = null; edit.snapText = '';
    var inst = propInst[id], def = propDef(id);
    if (!cancel && inst) { if (!S.layout) S.layout = {}; S.layout[id] = { x: Math.round(inst.g.position.x * 100) / 100, z: Math.round(inst.g.position.z * 100) / 100, rot: inst.P.rot, h: inst.P.h || 0 }; sfx('putdown'); }
    buildProp(id); editHelper(null); save();
    if (!cancel && inst) { runHooks('propPlaced', id, propInst[id], def); if (!(def && def.quietPlace)) toast('Placed the ' + propLabel(id), 'good'); }
  }
  function editRotate(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id || !propInst[id]) return;
    var inst = propInst[id], def = propDef(id); if (def && def.fixed) { toast('That one stays where it is.', 'bad'); return; } if (def.wall && !edit.grabbed) { toast('Wall pieces face the wall.', ''); return; }
    if (edit.grabbed && def.snap) { edit.snapCycle++; sfx('click'); return; }   // a carried piece with its own snap: R walks the snaps near the aim, then the free headings; the def's snap applies it
    inst.P.rot = (inst.P.rot + 1) % 4; inst.g.rotation.y = inst.P.rot * Math.PI / 2; sfx('click');
    if (!edit.grabbed) { if (!S.layout) S.layout = {}; S.layout[id] = { x: inst.g.position.x, z: inst.g.position.z, rot: inst.P.rot }; buildProp(id); save(); }
  }
  function editReset(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return; if (propDef(id) && propDef(id).fixed) { toast('That one stays where it is.', 'bad'); return; }
    if (edit.grabbed) edit.grabbed = null;
    if (S.layout) delete S.layout[id]; buildProp(id); editHelper(null); sfx('ok'); toast('Put the ' + propLabel(id) + ' back where it started', 'good'); save();
  }
  function editRemove(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return; var def = propDef(id); if (def && def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    var c = customById(id);
    if (edit.grabbed) edit.grabbed = null;
    if (c) { runHooks('propDeleted', id, def); S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); if (def && def.price) { pay(Math.round(def.price / 2), 'Sold back: ' + def.label); toast('Sold the ' + def.label + ' back for half', ''); } }
    else { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); toast('Removed the ' + propLabel(id) + ' (the catalogue brings it back)', ''); }
    editHelper(null); sfx('bad'); save();
  }
  function editRestore(id) { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = false; buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
  function editBuy(type) {
    var def = PROPS[type]; if (!def || !def.extra) return; if (typeof def.lvl === 'number' && S.level !== undefined && S.level < def.lvl) { toast('That comes at level ' + def.lvl + '.', 'bad'); return; }
    if (def.price && S.bank < def.price) { toast('That costs ' + money(def.price) + ' and you have ' + money(S.bank), 'bad'); return; }
    if (def.price) pay(-def.price, 'Bought: ' + def.label);
    if (!S.custom) S.custom = [];
    var aim = editAim(def), c = { id: uid('cp'), type: type, x: aim.x, z: aim.z, rot: aim.rot || 0, h: aim.h || 0 }; S.custom.push(c);
    buildProp(c.id); runHooks('editBought', c, def); editGrab(c.id); toast('Carrying the ' + def.label + ' · aim and press E', '');
    return c;
  }
  // the catalogue's data: removed props to bring back, and extras to buy, grouped by category (the game draws it)
  function catalogueData() {
    var hidden = PROP_ORDER.filter(function (id) { return !PROPS[id].extra && propPlacement(id).hidden; }).concat(LAYOUT.placed.filter(function (p) { return !PROPS[p.id] && propPlacement(p.id).hidden; }).map(function (p) { return p.id; })), groups = {};
    PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (!d.extra || d.shop === false) return; (groups[d.cat || 'other'] = groups[d.cat || 'other'] || []).push(id); });
    return { hidden: hidden, groups: groups };
  }
  // ── Touch screens: a canvas drawn in the world, tapped where the crosshair points ─
  var screens = [];
  function touchScreen(o) {
    var res = o.res || 1, c = document.createElement('canvas'); c.width = o.w * res; c.height = o.h * res; var ctx = c.getContext('2d'); if (res !== 1) ctx.setTransform(res, 0, 0, res, 0, 0);   // res: canvas pixels per logical pixel; the layout and the tap zones stay in logical pixels
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), new THREE.MeshBasicMaterial({ map: t })); mesh.material.userData.noBake = true; mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.ry || 0; parentOf(o.parent).add(mesh);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), MAT.screenGlass); glass.position.set(0, 0, 0.0015); glass.renderOrder = 2; mesh.add(glass);
    var sc = { w: o.w, h: o.h, res: res, ctx: ctx, tex: t, mesh: mesh, zones: [], draw: o.draw, cur: null, ripple: 0, title: o.title, dirty: true, autoPage: o.autoPage }; mesh.userData.screen = sc;
    addInter(mesh, { prompt: function () { var z = screenZone(sc); return z ? z.label : (o.title || 'Screen'); }, use: function () { screenTap(sc); } });
    screens.push(sc); return sc;
  }
  function screenZone(sc) { var h = ray.intersectObject(sc.mesh, false); if (!h.length || !h[0].uv) { sc.cur = null; return null; } var x = h[0].uv.x * sc.w, y = (1 - h[0].uv.y) * sc.h; sc.cur = { x: x, y: y }; for (var i = 0; i < sc.zones.length; i++) { var z = sc.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; } return null; }
  function screenZoneAt(sc, x, y) { for (var i = 0; i < sc.zones.length; i++) { var z = sc.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; } return null; }   // a tap by logical coordinates: the editor and the tests use it
  function screenTap(sc, zone) { var z = zone || screenZone(sc); sfx('click'); if (z && z.act) { z.act(); sc.ripple = 1; sc.dirty = true; } }
  function drawScreens(dt) { screens.forEach(function (sc) { if (sc.autoPage) { var pg = Math.floor(worldTime / 6); if (sc.lastAuto !== pg) { sc.lastAuto = pg; sc.dirty = true; } } if (sc.ripple > 0) { sc.ripple -= dt * 3; sc.dirty = true; } if (!sc.dirty) return; sc.dirty = false; sc.zones.length = 0; if (sc.res && sc.res !== 1) sc.ctx.setTransform(sc.res, 0, 0, sc.res, 0, 0); sc.draw(sc.ctx, sc); if (sc.cur && sc.ripple > 0) { sc.ctx.strokeStyle = 'rgba(255,255,255,' + sc.ripple + ')'; sc.ctx.lineWidth = 3; sc.ctx.beginPath(); sc.ctx.arc(sc.cur.x, sc.cur.y, (1 - sc.ripple) * 30 + 4, 0, 6.3); sc.ctx.stroke(); } sc.tex.needsUpdate = true; }); }
  function screenDirtyAll() { screens.forEach(function (s) { s.dirty = true; }); }
  // drawing helpers in the house style. The theme is one object a game can repaint.
  var SCREEN_THEME = { bg: '#0d1216', accent: 'rgba(245,181,61,0.18)', dot: 'rgba(255,255,255,0.04)', title: '#f5b53d', sub: '#a0acb8', rule: 'rgba(245,181,61,0.35)', text: '#eef1f5', btn: '#f5b53d', btnText: '#1a1205', btnOff: 'rgba(255,255,255,0.08)', btnOffText: '#eef1f5', font: 'Bahnschrift, Arial, sans-serif' };
  function scBg(c, w, h, accent) { c.fillStyle = SCREEN_THEME.bg; c.fillRect(0, 0, w, h); var g = c.createRadialGradient(0, 0, 10, 0, 0, w); g.addColorStop(0, accent || SCREEN_THEME.accent); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = SCREEN_THEME.dot; for (var y = 8; y < h; y += 16) for (var x = 8; x < w; x += 16) c.fillRect(x, y, 1.5, 1.5); }
  function scHead(c, w, title, sub) { c.fillStyle = SCREEN_THEME.title; c.font = 'bold 22px ' + SCREEN_THEME.font; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(title, 16, 30); c.fillStyle = SCREEN_THEME.sub; c.font = '14px ' + SCREEN_THEME.font; c.textAlign = 'right'; c.fillText(sub === undefined ? (S && typeof S.time === 'number' ? fmtTime(S.time) : '') : sub, w - 16, 30); c.textAlign = 'left'; c.fillStyle = SCREEN_THEME.rule; c.fillRect(16, 40, w - 32, 2); }
  function scButton(sc, x, y, w, h, label, on, act, col) { var c = sc.ctx; c.fillStyle = on ? (col || SCREEN_THEME.btn) : SCREEN_THEME.btnOff; c.strokeStyle = on ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, 8); else c.rect(x, y, w, h); c.fill(); c.stroke(); c.fillStyle = on ? SCREEN_THEME.btnText : SCREEN_THEME.btnOffText; c.font = 'bold 15px ' + SCREEN_THEME.font; var tw = c.measureText(label).width; if (tw > w - 10) c.font = 'bold ' + Math.max(10, Math.floor(15 * (w - 10) / tw)) + 'px ' + SCREEN_THEME.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x + w / 2, y + h / 2, w - 8); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; sc.zones.push({ x: x, y: y, w: w, h: h, label: label, act: act }); }
  function scText(c, x, y, text, col, size) { c.fillStyle = col || SCREEN_THEME.text; c.font = (size || 14) + 'px ' + SCREEN_THEME.font; c.textAlign = 'left'; var sc = c.getTransform ? c.getTransform().a || 1 : 1; c.fillText(text, x, y, Math.max(20, c.canvas.width / sc - x - 8)); }   // never past the right edge of the screen, whatever the resolution
  function scFit(c, text, maxW) { if (c.measureText(text).width <= maxW) return text; var lo = 0, hi = text.length; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (c.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; } return text.slice(0, lo) + '…'; }   // trimmed with an ellipsis to fit

  // ── Hinged doors ──────────────────────────────────────────────────
  // Each door is a leaf on a hinge. E opens or closes it, Shift+E locks or unlocks it (you carry the keys). Walkers with keys
  // (the game lists them with CO.game.doorOpeners(), as [{ x, z }]) have the door swing open as they come up to it and close
  // behind them. The state lives in S.hdoors[id] = { open, locked }.
  var hdoors = [];
  function hingedDoor(id, x, z, alongX, label, opt) { return worldItem('door', function () {
    opt = opt || {};
    var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 0, z); (WORLD_PARENT || scene).add(g);
    var w = opt.w || 1.0, h = opt.h || 2.15, t = 0.06, hinge = new THREE.Group(); g.add(hinge);
    var leaf = box(alongX ? w : t, h, alongX ? t : w, opt.mat || MAT.plaster, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, hinge);
    if (opt.window) box(alongX ? 0.4 : t + 0.01, 0.5, alongX ? t + 0.01 : 0.4, MAT.glass, alongX ? w / 2 : 0, 1.55, alongX ? 0 : w / 2, hinge);
    box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : 0.06, 1.05, alongX ? 0.06 : w - 0.15, hinge); box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : -0.06, 1.05, alongX ? -0.06 : w - 0.15, hinge);
    if (opt.pushbar) box(alongX ? 0.8 : 0.05, 0.05, alongX ? 0.05 : 0.8, MAT.chrome, alongX ? w / 2 : 0.07, 1.0, alongX ? 0.07 : w / 2, hinge);
    var led = box(0.03, 0.03, 0.03, glowMat(0x39d353, 1.2), alongX ? w - 0.1 : 0.05, 2.0, alongX ? 0.05 : w - 0.1, hinge);
    // the frame: on a group of its own, so it joins the static bake (the leaf's group is dynamic and the frame never moves)
    var fg = new THREE.Group(); fg.position.set(x, 0, z); (WORLD_PARENT || scene).add(fg);
    var fm = opt.frameMat || MAT.steelDark; if (alongX) { box(0.08, h + 0.1, t + 0.06, fm, -0.04, (h + 0.1) / 2, 0, fg); box(0.08, h + 0.1, t + 0.06, fm, w + 0.04, (h + 0.1) / 2, 0, fg); box(w + 0.16, 0.08, t + 0.06, fm, w / 2, h + 0.09, 0, fg); } else { box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, -0.04, fg); box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, w + 0.04, fg); box(t + 0.06, 0.08, w + 0.16, fm, 0, h + 0.09, w / 2, fg); }
    var d = { id: id, g: g, frame: fg, hinge: hinge, leaf: leaf, led: led, x: x, z: z, alongX: alongX, w: w, h: h, t: 0, label: label, swing: opt.swing || 1 };
    var hit = hitBox(alongX ? w : 0.4, h, alongX ? 0.4 : w, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, { prompt: function () { return doorPrompt(d); }, use: function () { doorUse(d); }, alt: function () { doorLock(d); } }, g);
    d.hit = hit;
    if (!S.hdoors) S.hdoors = {}; if (!S.hdoors[id]) S.hdoors[id] = { open: !!opt.open, locked: false };
    d.t = S.hdoors[id].open ? 1 : 0; doorPose(d);
    hdoors.push(d); return d;
  }, null); }
  function hd(id) { return S && S.hdoors && S.hdoors[id] ? S.hdoors[id] : { open: false, locked: false }; }
  function doorById(id) { for (var i = 0; i < hdoors.length; i++) if (hdoors[i].id === id) return hdoors[i]; return null; }
  function doorPose(d) { d.hinge.rotation.y = (d.alongX ? -1 : 1) * d.swing * d.t * 1.65; d.led.material.emissive.setHex(hd(d.id).locked ? 0xff3b30 : 0x39d353); }
  function doorPrompt(d) { var s = hd(d.id); if (s.locked) return d.label + ' · locked · Shift+E unlocks'; return (s.open ? 'Close ' : 'Open ') + d.label + ' · Shift+E locks'; }
  function doorUse(d) { var s = hd(d.id); if (player && player.keys && (player.keys.ShiftLeft || player.keys.ShiftRight)) { doorLock(d); return; } if (s.locked) { sfx('bad'); toast(d.label + ' is locked.', 'bad'); return; } s.open = !s.open; sfx('door'); }
  function doorLock(d) { var s = hd(d.id); if (s.open) { s.open = false; } s.locked = !s.locked; sfx(s.locked ? 'lock' : 'unlock'); toast((s.locked ? 'Locked ' : 'Unlocked ') + d.label, s.locked ? '' : 'good'); doorPose(d); screenDirtyAll(); }
  // a door inside a world item stands where the item stands now: its hinge's place is read from the scene (0.9.1)
  var DOOR_V = null;
  function doorSync(d) { var p = d.g.parent; if (!p || p === scene || p === CO.root) return; if (!DOOR_V) DOOR_V = new THREE.Vector3(); d.g.getWorldPosition(DOOR_V); d.x = DOOR_V.x; d.z = DOOR_V.z; }
  function doorCentre(d) { doorSync(d); return { x: d.alongX ? d.x + d.w / 2 : d.x, z: d.alongX ? d.z : d.z + d.w / 2 }; }
  function doorsTick(dt) {
    var walkers = CO.game && CO.game.doorOpeners ? CO.game.doorOpeners() : [];
    hdoors.forEach(function (d) {
      var s = hd(d.id), c = doorCentre(d);
      var near = walkers.some(function (p) { return dist2(p.x, p.z, c.x, c.z) < 1.7; });   // someone with keys: the door opens for them when they are close and closes once they are through
      var want = s.open || near ? 1 : 0;
      if (Math.abs(d.t - want) > 0.002) { d.t = lerp(d.t, want, 1 - Math.pow(0.006, dt)); if (Math.abs(d.t - want) < 0.004) d.t = want; doorPose(d); shadowDirty = true; }
    });
  }
  function doorSolids(out) { hdoors.forEach(function (d) { doorSync(d); if (d.t > 0.5) return; if (d.alongX) out.push({ x0: d.x, x1: d.x + d.w, z0: d.z - 0.08, z1: d.z + 0.08, y0: -1, y1: 3 }); else out.push({ x0: d.x - 0.08, x1: d.x + 0.08, z0: d.z, z1: d.z + d.w, y0: -1, y1: 3 }); }); }
  function lockAll(lock) { hdoors.forEach(function (d) { var s = hd(d.id); if (lock) { s.open = false; s.locked = true; } else s.locked = false; doorPose(d); }); runHooks('lockAll', lock); sfx(lock ? 'lock' : 'unlock'); logEvent(lock ? 'Night mode: every door closed and locked' : 'Doors unlocked for the day'); screenDirtyAll(); }
  function anyDoorUnlocked() { return hdoors.some(function (d) { return !hd(d.id).locked; }); }
  // ── The human model ───────────────────────────────────────────────
  // A rigged person: hip and knee pivots, shoulder and elbow pivots, a torso that rolls with the stride and a head that turns to
  // look at you. Every limb is an eased cylinder, the shoes have soles and laces, the shirt has a collar, buttons, a pocket and a
  // belt, the hair is a cap with a fringe, sideburns and a nape (or long, or a bun), and the face is a 256 px decal that blinks.
  // makeHuman(opt), animateHuman(g, dt, mode, speed, look, carry), setMood(g, mood), say(g, text, col).
  var SKINS = [0xf1d2b6, 0xe2b48f, 0xd9a98a, 0xb87b5a, 0x8d5a3c, 0x5c3a28];
  var HAIRS = [0x1d1510, 0x3a2a1c, 0x6b4a2b, 0xa8793f, 0xd9b36a, 0x8a8a8a, 0xb0352a, 0x2b2b35];
  var SHIRTS = [0x8c949c, 0x3b4b6b, 0x7b3f3f, 0x2f6f4f, 0xd9d9d9, 0x5a4b7b, 0x8a6a3a, 0x335b7b, 0x2a2d33];
  var PANTS = [0x2e3f63, 0x3a3a3a, 0x5b4b3a, 0x1f2a44, 0x6b6b6b];
  var EYES = ['#3a5a8a', '#4a3221', '#2a6a3a', '#5a4a2a', '#6a7a8a'];
  var faceCache = {};
  // what a face key decides, the same every time that key is drawn: eye colour, brow weight, freckles
  function faceSpec(key) { var n = 0; for (var i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0; return { eye: EYES[n % EYES.length], freckles: n % 5 === 0, brow: n % 3 === 0 ? '#1a1008' : '#2a1a10', thin: n % 4 === 1 }; }
  function faceTex(key, mood, skin, blink) {
    var k = key + mood + (blink ? 'b' : ''); if (faceCache[k]) return faceCache[k];
    var sp = faceSpec(key);
    var t = tex(256, 256, function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      var eyeY = 112, iris = sp.eye, closed = blink || mood === 'tired', squint = mood === 'happy' ? 12 : mood === 'angry' ? 12.5 : 15;
      [84, 172].forEach(function (x, i) {
        var sd = i ? 1 : -1, px = x + (mood === 'shifty' ? 8 : 0);
        if (closed) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 21, eyeY + 1); ctx.quadraticCurveTo(x, eyeY + 9, x + 21, eyeY + 1); ctx.stroke(); return; }
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#fbf8f2'; ctx.fillRect(x - 24, eyeY - 18, 48, 36);
        var ig = ctx.createRadialGradient(px, eyeY + 1, 2, px, eyeY + 1, 11); ig.addColorStop(0, iris); ig.addColorStop(0.75, iris); ig.addColorStop(1, 'rgba(10,15,25,.9)'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, eyeY + 1, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(px, eyeY + 1, 4.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(px + 4, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 4, eyeY + 5, 1.6, 0, Math.PI * 2); ctx.fill();
        var lid = ctx.createLinearGradient(0, eyeY - squint, 0, eyeY - squint + 12); lid.addColorStop(0, 'rgba(40,20,10,.5)'); lid.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = lid; ctx.fillRect(x - 24, eyeY - squint, 48, 12);
        ctx.restore();
        ctx.strokeStyle = '#2f2019'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,35,25,.45)'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2019'; ctx.beginPath(); ctx.moveTo(x + sd * 21, eyeY - 3); ctx.lineTo(x + sd * 27, eyeY - 8); ctx.stroke();
      });
      ctx.fillStyle = sp.brow; var tilt = mood === 'angry' ? 12 : mood === 'tired' ? -6 : mood === 'happy' ? -3 : 0, bt = sp.thin ? 0.6 : 1;
      [[58, 110], [198, 146]].forEach(function (b) { ctx.beginPath(); ctx.moveTo(b[0], 84 - tilt + 2); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 72, b[1], 84 + tilt - 4 * bt); ctx.lineTo(b[1], 84 + tilt + 5 * bt); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 80, b[0], 84 - tilt + 4); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(70,35,20,.22)'; ctx.beginPath(); ctx.ellipse(128, 166, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a4536'; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.beginPath();
      if (mood === 'happy') { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.quadraticCurveTo(128, 194, 96, 186); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(102, 188.5); ctx.quadraticCurveTo(128, 196, 154, 188.5); ctx.quadraticCurveTo(128, 203, 102, 188.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.stroke(); }
      else if (mood === 'tired') { ctx.moveTo(100, 198); ctx.quadraticCurveTo(128, 186, 156, 198); ctx.stroke(); }
      else if (mood === 'angry') { ctx.moveTo(100, 196); ctx.quadraticCurveTo(128, 186, 156, 192); ctx.stroke(); }
      else if (mood === 'talk') { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.ellipse(128, 194, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0605a'; ctx.beginPath(); ctx.ellipse(128, 200, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(104, 192); ctx.quadraticCurveTo(128, 199, 152, 192); ctx.stroke(); }
      if (mood !== 'talk' && mood !== 'happy') { ctx.strokeStyle = 'rgba(90,40,30,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(114, 205); ctx.quadraticCurveTo(128, 210, 142, 205); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,110,110,' + (mood === 'happy' ? 0.26 : 0.12) + ')'; [62, 194].forEach(function (x) { var bl = ctx.createRadialGradient(x, 152, 2, x, 152, 22); bl.addColorStop(0, ctx.fillStyle); bl.addColorStop(1, 'rgba(255,110,110,0)'); ctx.save(); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(x, 152, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      if (sp.freckles) { ctx.fillStyle = 'rgba(120,70,40,.5)'; for (var f = 0; f < 22; f++) { ctx.beginPath(); ctx.arc(60 + Math.random() * 136, 136 + Math.random() * 30, 1.6, 0, Math.PI * 2); ctx.fill(); } }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; faceCache[k] = t; return t;
  }
  var HUMAN_GEO = null, HUMAN_SCALE = 0.93, HUMAN_M = null;
  function humanGeo() {
    if (HUMAN_GEO) return HUMAN_GEO;
    var G = HUMAN_GEO = {
      thigh: roundCylGeo(0.088, 0.068, 0.42, 18), shin: roundCylGeo(0.064, 0.046, 0.4, 18), knee: new THREE.SphereGeometry(0.068, 14, 10),
      shoe: bevelGeo(0.12, 0.085, 0.27, 0.036, 3), sole: bevelGeo(0.128, 0.03, 0.285, 0.012, 1), lace: bevelGeo(0.1, 0.02, 0.06, 0.006, 1),
      hips: bevelGeo(0.36, 0.18, 0.22, 0.08, 3), torso: taperGeo(bevelGeo(0.4, 0.5, 0.24, 0.1, 3).clone(), 0.5, 0.86, 0.9), chest: bevelGeo(0.44, 0.26, 0.26, 0.11, 3),
      belt: bevelGeo(0.38, 0.05, 0.24, 0.012, 1), buckle: bevelGeo(0.05, 0.04, 0.02, 0.005, 1), placket: bevelGeo(0.12, 0.05, 0.03, 0.008, 1), button: roundCylGeo(0.008, 0.008, 0.006, 8), pocket: bevelGeo(0.1, 0.1, 0.005, 0.002, 1),
      upperArm: roundCylGeo(0.054, 0.044, 0.3, 14), foreArm: roundCylGeo(0.044, 0.034, 0.3, 14), elbow: new THREE.SphereGeometry(0.047, 12, 10), shoulder: new THREE.SphereGeometry(0.072, 14, 10),
      hand: bevelGeo(0.075, 0.1, 0.036, 0.016, 2), thumb: roundCylGeo(0.012, 0.012, 0.05, 8), cuff: roundCylGeo(0.043, 0.04, 0.035, 14), hem: roundCylGeo(0.058, 0.056, 0.04, 16), collar: bevelGeo(0.085, 0.036, 0.012, 0.004, 1),
      neck: roundCylGeo(0.05, 0.062, 0.1, 14), head: new THREE.SphereGeometry(0.17, 28, 20), ear: new THREE.SphereGeometry(0.03, 10, 8), nose: new THREE.SphereGeometry(0.021, 12, 10),
      hairCap: new THREE.SphereGeometry(0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairLong: new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      vest: bevelGeo(0.47, 0.5, 0.29, 0.06, 3), band: bevelGeo(0.48, 0.04, 0.3, 0.012, 1), strap: bevelGeo(0.05, 0.28, 0.3, 0.012, 1),
      peak: bevelGeo(0.2, 0.015, 0.14, 0.005, 1)
    };
    G.beard = new THREE.SphereGeometry(0.17, 20, 8, -Math.PI * 0.1, Math.PI * 1.2, Math.PI * 0.7, Math.PI * 0.3); G.beard.scale(1.035, 1.15, 0.985);
    G.hairFall = new THREE.CylinderGeometry(0.178, 0.205, 0.4, 22, 3, true, Math.PI * 0.42, Math.PI * 1.16);
    G.ear.scale(0.5, 1.15, 0.85); G.nose.scale(0.82, 1.3, 1.05); G.head.scale(1, 1.12, 0.95);
    G.hairCap.scale(1.07, 1.2, 1.02); G.hairLong.scale(1.08, 1.21, 1.04);
    G.fringe = new THREE.SphereGeometry(0.17, 20, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.2); G.fringe.scale(1.075, 1.205, 1.03);
    G.sideL = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 1.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); G.sideL.scale(1.075, 1.205, 1.03);
    G.sideR = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 0.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); G.sideR.scale(1.075, 1.205, 1.03);
    G.nape = new THREE.SphereGeometry(0.17, 16, 8, Math.PI * 1.2, Math.PI * 0.6, Math.PI * 0.4, Math.PI * 0.3); G.nape.scale(1.075, 1.205, 1.03);
    for (var k in G) keepShared(G[k]);
    HUMAN_M = { band: std({ color: 0xc9ced3, roughness: 0.3, metalness: 0.4, emissive: 0x666666, emissiveIntensity: 0.25 }), lace: std({ color: 0xf2f2f2, roughness: 0.9 }), belt: std({ color: 0x3a2a1a, roughness: 0.5 }), sole: std({ color: 0xd8d4cc, roughness: 0.9 }) };
    for (var m in HUMAN_M) keepShared(HUMAN_M[m]);
    return G;
  }
  // opt: skin, hair, style ('short' | 'long' | 'bun' | 'bald' | 'cap'), shirt (a material), vest (a material), name, rolled, mood, cap, capMat, hardhat (a material), noBeard, glasses
  function makeHuman(opt) {
    opt = opt || {}; var G = humanGeo(), M = HUMAN_M;
    var skinCol = opt.skin || pick(SKINS), hairCol = opt.hair || pick(HAIRS), style = opt.style || pick(['short', 'short', 'long', 'bun', 'bald', 'cap']);
    var skin = std({ color: skinCol, roughness: 0.75 }), shirt = opt.shirt || std({ map: TEX.cloth, color: pick(SHIRTS), roughness: 0.92 }), pants = opt.pants || std({ map: TEX.cloth, color: pick(PANTS), roughness: 0.95 }), hair = std({ color: hairCol, roughness: 0.62 }), hairSide = hair.clone(); hairSide.side = THREE.DoubleSide;
    var shoeM = std({ color: pick([0x1e1a18, 0x3a2a1a, 0x4a3a2a, 0x2f2f33]), roughness: 0.6 }), shirtDark = shirt.clone(); if (shirtDark.color) shirtDark.color.multiplyScalar(0.85);
    var rolled = opt.rolled !== undefined ? !!opt.rolled : Math.random() < 0.4;
    var g = new THREE.Group(), u = g.userData; u.dynamic = true;
    u.key = opt.key || 'f' + Math.floor(Math.random() * 100000); u.mood = opt.mood || 'neutral'; u.blink = 0; u.blinkIn = randf(2, 6); u.walk = 0; u.idleT = Math.random() * 10; u.lookYaw = 0; u.lookPitch = 0; u.skinKey = skinCol.toString(16); u.phase = Math.random() * 6.28;
    g.scale.setScalar(HUMAN_SCALE);
    function mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; }
    function leg(side) {
      var hip = new THREE.Group(); hip.position.set(side * 0.1, 0.86, 0); g.add(hip);
      mesh(G.thigh, pants, 0, -0.21, 0, hip);
      var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
      mesh(G.knee, pants, 0, 0, 0, knee); mesh(G.shin, pants, 0, -0.2, 0, knee);
      mesh(G.shoe, shoeM, 0, -0.4, 0.05, knee); mesh(G.sole, M.sole, 0, -0.445, 0.05, knee); mesh(G.hem, pants, 0, -0.35, 0, knee); mesh(G.lace, M.lace, 0, -0.36, 0.12, knee);
      return hip;
    }
    u.legs = [leg(-1), leg(1)];
    var torso = new THREE.Group(); torso.position.y = 0.86; g.add(torso); u.torso = torso;
    mesh(G.hips, pants, 0, 0.02, 0, torso); mesh(G.belt, M.belt, 0, 0.1, 0, torso); mesh(G.buckle, MAT.chrome, 0, 0.1, 0.125, torso);
    mesh(G.torso, shirt, 0, 0.36, 0, torso); u.chest = mesh(G.chest, shirt, 0, 0.52, 0, torso);
    [-1, 1].forEach(function (sd) { var cl = mesh(G.collar, shirt, sd * 0.05, 0.648, 0.118, torso); cl.rotation.set(-0.35, sd * -0.25, sd * -0.62); });
    mesh(G.placket, shirt, 0, 0.62, 0.13, torso); for (var b = 0; b < 4; b++) mesh(G.button, M.lace, 0, 0.2 + b * 0.11, 0.125, torso).rotation.x = Math.PI / 2; mesh(G.pocket, shirtDark, -0.11, 0.48, 0.125, torso);
    if (opt.vest) { mesh(G.vest, opt.vest, 0, 0.33, 0, torso); mesh(G.band, M.band, 0, 0.22, 0, torso); mesh(G.band, M.band, 0, 0.38, 0, torso); mesh(G.strap, M.band, -0.15, 0.5, 0, torso); mesh(G.strap, M.band, 0.15, 0.5, 0, torso); }
    if (opt.name) { var tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: textTex([opt.name], { w: 128, h: 48, bg: '#fff', fg: '#1b232c' }) })); tag.position.set(0.1, 0.46, opt.vest ? 0.152 : 0.132); torso.add(tag); }
    function arm(side) {
      var sh = new THREE.Group(); sh.position.set(side * 0.27, 0.6, 0); torso.add(sh);
      mesh(G.shoulder, shirt, 0, 0, 0, sh); mesh(G.upperArm, shirt, 0, -0.16, 0, sh);
      var el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el); sh.userData.elbow = el;
      mesh(G.elbow, shirt, 0, 0, 0, el); mesh(G.foreArm, rolled ? skin : shirt, 0, -0.15, 0, el);
      if (!rolled) mesh(G.cuff, shirt, 0, -0.285, 0, el); else mesh(G.cuff, shirt, 0, -0.03, 0, el);
      var hand = mesh(G.hand, skin, 0, -0.35, 0, el); el.userData.hand = hand; var th = mesh(G.thumb, skin, side * 0.04, -0.33, 0.01, el); th.rotation.z = side * 0.6;
      return sh;
    }
    u.arms = [arm(-1), arm(1)];
    var head = new THREE.Group(); head.position.set(0, 0.66, 0); torso.add(head); u.head = head;
    mesh(G.neck, skin, 0, 0.04, 0, head); mesh(G.head, skin, 0, 0.24, 0, head); mesh(G.nose, skin, 0, 0.222, 0.164, head);
    [-1, 1].forEach(function (s) { mesh(G.ear, skin, s * 0.165, 0.24, -0.01, head); });
    var hy = 0.24, capOn = style === 'cap' || !!opt.cap;
    if (style !== 'bald') {
      if (style === 'long') { mesh(G.hairLong, hair, 0, hy, 0, head); mesh(G.hairFall, hairSide, 0, hy - 0.16, -0.012, head); }
      else { mesh(G.hairCap, hair, 0, hy, 0, head); mesh(G.nape, hair, 0, hy, 0, head); }
      if (style === 'bun') mesh(new THREE.SphereGeometry(0.075, 12, 10), hair, 0, hy + 0.14, -0.14, head);
      mesh(G.fringe, hair, 0, hy, 0, head); mesh(G.sideL, hair, 0, hy, 0, head); mesh(G.sideR, hair, 0, hy, 0, head);
    }
    if ((opt.beard === true || (opt.beard === undefined && Math.random() < 0.3)) && !opt.noBeard) mesh(G.beard, hairSide, 0, hy, 0, head);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: faceTex(u.key, u.mood, u.skinKey), transparent: true, depthWrite: false })); face.position.set(0, 0.245, 0.17); head.add(face); u.face = face;
    if (opt.glasses === true || (opt.glasses === undefined && Math.random() < 0.22)) { var fr = std({ color: 0x222222, roughness: 0.4, metalness: 0.5 }); [-0.06, 0.06].forEach(function (x) { mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), fr, x, 0.255, 0.178, head); }); mesh(bevelGeo(0.03, 0.006, 0.006, 0.002, 1), fr, 0, 0.26, 0.178, head); [-1, 1].forEach(function (s) { mesh(bevelGeo(0.006, 0.006, 0.16, 0.002, 1), fr, s * 0.1, 0.255, 0.085, head); }); }
    // hats sit on the brows (the eye line is at 0.26 in the head's frame, the brows at 0.29), never over the eyes
    if (capOn && !opt.hardhat) { var capM = opt.capMat || MAT.blue; mesh(new THREE.SphereGeometry(0.184, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.29, 0, head); var peak = mesh(G.peak, capM, 0, 0.3, 0.2, head); peak.rotation.x = 0.15; mesh(new THREE.SphereGeometry(0.02, 8, 6), capM, 0, 0.47, 0, head); }
    if (opt.hardhat) { mesh(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), opt.hardhat, 0, 0.3, 0, head); mesh(roundCylGeo(0.212, 0.212, 0.016, 24), opt.hardhat, 0, 0.3, 0.0, head); var pk = mesh(bevelGeo(0.16, 0.012, 0.08, 0.004, 1), opt.hardhat, 0, 0.3, 0.245, head); pk.rotation.x = 0.12; }
    groundBlob(0.9, 0.9, 0, 0, g, 0.002);
    runHooks('humanMade', g, opt);
    return g;
  }
  function setMood(g, mood) { var u = g.userData; if (u.mood === mood) return; u.mood = mood; u.face.material.map = faceTex(u.key, mood, u.skinKey, u.blink > 0); }
  // mode: 'walk' | 'idle' | 'wait' | 'work' | 'sit'. look: a world point the head turns to, within reason. carry: true holds a box out
  // in front; 'push' puts both hands down on a grip pushed ahead; 'tow' trails one arm back to something pulled behind; a function
  // (la, ra, le, re, s, sw) poses the arms itself. The feet stay planted: the torso rises and falls with the stride and rolls a little.
  function animateHuman(g, dt, mode, speed, look, carry) {
    var u = g.userData; if (!u.legs) return;
    u.idleT += dt;
    if (mode === 'walk') u.walk += dt * (6 + speed * 1.5); else { var ph = u.walk % Math.PI; u.walk += (ph < Math.PI / 2 ? -ph : Math.PI - ph) * Math.min(1, 10 * dt); }
    var t = u.walk, sw = mode === 'walk' ? 0.55 : 0, s = Math.sin(t), L = u.legs[0], R = u.legs[1], lk = L.userData.knee, rk = R.userData.knee, la = u.arms[0], ra = u.arms[1], le = la.userData.elbow, re = ra.userData.elbow, T = u.torso;
    if (mode === 'sit') {
      L.rotation.x = -1.45; R.rotation.x = -1.45; lk.rotation.x = 1.45; rk.rotation.x = 1.45; R.position.y = 0.86; la.rotation.x = -0.5; ra.rotation.x = -0.5; le.rotation.x = -0.15; re.rotation.x = -0.15; la.rotation.z = 0.18; ra.rotation.z = -0.18; T.position.set(0, 0.86, 0); T.rotation.set(0, 0, 0); u.head.rotation.z = 0;
    } else {
    L.rotation.x = s * sw; R.rotation.x = -s * sw;
    lk.rotation.x = Math.max(0, -Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0); rk.rotation.x = Math.max(0, Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0);
    if (typeof carry === 'function') carry(la, ra, le, re, s, sw);
    else if (carry === 'push' || carry === 'jack') { la.rotation.x = -0.8; ra.rotation.x = -0.8; le.rotation.x = -0.25; re.rotation.x = -0.25; la.rotation.z = 0.12; ra.rotation.z = -0.12; }
    else if (carry === 'tow') { ra.rotation.x = 0.56; re.rotation.x = 0; ra.rotation.z = -0.15; la.rotation.x = -s * sw * 0.8; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; la.rotation.z = 0.08; }
    else if (carry) { la.rotation.x = -0.9; ra.rotation.x = -0.9; le.rotation.x = -0.9; re.rotation.x = -0.9; la.rotation.z = 0.25; ra.rotation.z = -0.25; }
    else if (mode === 'work') { la.rotation.x = -0.6 + Math.sin(u.idleT * 6) * 0.25; ra.rotation.x = -0.6 - Math.sin(u.idleT * 6) * 0.25; le.rotation.x = -0.8; re.rotation.x = -0.8; la.rotation.z = 0.1; ra.rotation.z = -0.1; }
    else { var drift = Math.sin(u.idleT * 1.1) * 0.05; la.rotation.x = -s * sw * 0.8 + drift; ra.rotation.x = s * sw * 0.8 - drift; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; re.rotation.x = -Math.max(0, -s) * sw * 0.6 - 0.15; la.rotation.z = 0.08 + Math.sin(u.idleT * 0.7) * 0.03; ra.rotation.z = -0.08 - Math.sin(u.idleT * 0.7) * 0.03; }
    if (mode === 'wait') { R.position.y = 0.86 + Math.max(0, Math.sin(u.idleT * 2.4)) * 0.04; } else R.position.y = 0.86;
    if (mode === 'walk') { T.position.y = 0.86 + Math.abs(Math.cos(t)) * 0.03; T.position.x = 0; T.rotation.z = s * 0.03; T.rotation.y = s * 0.06; u.head.rotation.z = -s * 0.025; }
    else { T.position.y = 0.86 + Math.sin(u.idleT * 0.31) * 0.006; T.position.x = Math.sin(u.idleT * 0.31) * 0.007; T.rotation.z = Math.sin(u.idleT * 0.31) * 0.014; T.rotation.y = mode === 'wait' ? Math.sin(u.idleT * 0.35) * 0.12 : lerp(T.rotation.y, 0, Math.min(1, 4 * dt)); u.head.rotation.z = 0; }
    }
    if (u.chest) u.chest.scale.z = 1 + Math.sin(worldTime * 1.6 + u.phase) * 0.018;
    g.position.y = u.baseY || 0;
    var wantYaw = 0, wantPitch = 0;
    if (look) { var dx = look.x - g.position.x, dz = look.z - g.position.z, d = Math.sqrt(dx * dx + dz * dz); if (d < 9) { var a = Math.atan2(dx, dz) - g.rotation.y; while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; wantYaw = clamp(a, -1.3, 1.3); wantPitch = clamp(Math.atan2((look.y || 1.6) - 1.6, d), -0.3, 0.3); } }
    else wantYaw = Math.sin(u.idleT * 0.4) * 0.15;
    u.lookYaw += (wantYaw - u.lookYaw) * Math.min(1, 6 * dt); u.lookPitch += (wantPitch - u.lookPitch) * Math.min(1, 6 * dt);
    u.head.rotation.y = u.lookYaw - (mode === 'walk' ? T.rotation.y : 0); u.head.rotation.x = -u.lookPitch;
    u.blinkIn -= dt; if (u.blinkIn <= 0 && u.blink <= 0) { u.blink = 0.12; u.face.material.map = faceTex(u.key, u.mood, u.skinKey, true); } if (u.blink > 0) { u.blink -= dt; if (u.blink <= 0) { u.blinkIn = randf(2, 6.5); u.face.material.map = faceTex(u.key, u.mood, u.skinKey, false); } }
    if (u.bubble) { u.bubble.t -= dt; if (u.bubble.t <= 0) { g.remove(u.bubble.sp); u.bubble = null; } }
  }
  // a line of speech above the head, for a few seconds
  function say(g, text, col) {
    var u = g.userData; if (!u || !u.head) return;
    if (u.bubble) { g.remove(u.bubble.sp); u.bubble = null; }
    var t = tex(512, 160, function (c, w, h) {
      c.clearRect(0, 0, w, h); c.font = '500 30px "Segoe UI", Arial, sans-serif'; var words = text.split(' '), lines = [], cur = '';
      words.forEach(function (wd) { var tr = cur ? cur + ' ' + wd : wd; if (c.measureText(tr).width > w - 60) { lines.push(cur); cur = wd; } else cur = tr; }); if (cur) lines.push(cur); lines = lines.slice(0, 3);
      var bw = Math.min(w - 20, Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; })) + 50), bh = lines.length * 36 + 26, bx = (w - bw) / 2, by = h - bh - 18;
      c.fillStyle = 'rgba(16,22,30,0.92)'; c.strokeStyle = col || '#f5b53d'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + 14, by); c.lineTo(bx + bw - 14, by); c.quadraticCurveTo(bx + bw, by, bx + bw, by + 14); c.lineTo(bx + bw, by + bh - 14); c.quadraticCurveTo(bx + bw, by + bh, bx + bw - 14, by + bh); c.lineTo(w / 2 + 12, by + bh); c.lineTo(w / 2, h - 2); c.lineTo(w / 2 - 12, by + bh); c.lineTo(bx + 14, by + bh); c.quadraticCurveTo(bx, by + bh, bx, by + bh - 14); c.lineTo(bx, by + 14); c.quadraticCurveTo(bx, by, bx + 14, by); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#eef1f5'; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach(function (l, i) { c.fillText(l, w / 2, by + 20 + i * 36 + 4); });
    });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.9, 0.6, 1); sp.position.set(0, 2.15, 0); sp.renderOrder = 5; g.add(sp);
    u.bubble = { sp: sp, t: 2.6 + text.length * 0.03 };
    setMood(g, 'talk'); setTimeout(function () { if (u.mood === 'talk') setMood(g, 'neutral'); }, 900);
  }
  // a walker record on the grid: { x, z, yaw, path, speed } moved along its route; returns true at the end of it
  function walkerStep(rec, dt) { if (!rec.path || !rec.path.length) return true; return walkAlong(rec, rec.path, rec.speed || 1.6, dt); }
  function walkerGo(rec, x, z) { rec.path = route({ x: rec.x, z: rec.z }, { x: x, z: z }); return rec.path; }
  // ── The terrain ───────────────────────────────────────────────────
  // CO.terrain({ w, d, cell, x0, z0, heights, paint, palette, maxH }) stores the data (a game's src/00-terrain.js calls it before the
  // boot); terrainBuild() makes the mesh when the world builds. heights has (w + 1) * (d + 1) corners, row by row from z0; paint has
  // w * d cells, each an index into palette. The flat world outside the terrain stays at 0.
  var TERRAIN = { on: false, w: 0, d: 0, cell: 1, x0: 0, z0: 0, heights: null, paint: null, palette: ['grass', 'dirt', 'gravel', 'sand', 'road'], maxH: 8, mesh: null, geo: null, canvas: null, ctx: null, texture: null, px: 16 };
  // the painters for the ground: a base colour and a scatter of dots, per name; a game adds its own with CO.terrainPaint(name, spec)
  var TERRAIN_PAINT = {
    grass: { base: '#4d7a39', dots: ['#5b8c45', '#3f682e', '#6a9a4f'], n: 26, r: [1, 2.6] },
    dirt: { base: '#6b5239', dots: ['#7a5f44', '#5a432e', '#86684b'], n: 22, r: [1, 3] },
    gravel: { base: '#7b7d80', dots: ['#8f9195', '#65676b', '#a3a5a8'], n: 40, r: [0.8, 2] },
    sand: { base: '#c9b07a', dots: ['#d6bf8c', '#b89d6a', '#e0cb9c'], n: 18, r: [1, 2.4] },
    road: { base: '#3b3e43', dots: ['#45484d', '#33363a', '#505358'], n: 30, r: [0.6, 1.6] },
    snow: { base: '#e6ecf1', dots: ['#f3f6f9', '#d5dde4'], n: 10, r: [1, 3] },
    water: { base: '#2f6f9a', dots: ['#3a7fae', '#28618a'], n: 14, r: [1.5, 3.5] }
  };
  CO.terrainPaint = function (name, spec) { TERRAIN_PAINT[name] = spec; return spec; };
  CO.terrain = function (cfg) {
    if (!cfg) return TERRAIN;
    var w = Math.max(1, Math.round(cfg.w || 32)), d = Math.max(1, Math.round(cfg.d || 32));
    TERRAIN.on = true; TERRAIN.w = w; TERRAIN.d = d; TERRAIN.cell = cfg.cell || 1; TERRAIN.x0 = typeof cfg.x0 === 'number' ? cfg.x0 : -w * TERRAIN.cell / 2; TERRAIN.z0 = typeof cfg.z0 === 'number' ? cfg.z0 : -d * TERRAIN.cell / 2;
    if (cfg.palette) TERRAIN.palette = cfg.palette.slice(); if (cfg.maxH) TERRAIN.maxH = cfg.maxH;
    var nC = (w + 1) * (d + 1), nP = w * d; TERRAIN.heights = new Float32Array(nC); TERRAIN.paint = new Uint8Array(nP);
    if (cfg.heights) for (var i = 0; i < nC && i < cfg.heights.length; i++) TERRAIN.heights[i] = +cfg.heights[i] || 0;
    if (cfg.paint) for (var j = 0; j < nP && j < cfg.paint.length; j++) TERRAIN.paint[j] = cfg.paint[j] | 0;
    if (TERRAIN.mesh) terrainRebuild();   // called again while running (the editor makes a new one): the mesh follows
    return TERRAIN;
  };
  // the ground height at a world point: bilinear between the four corners of the cell; 0 off the terrain
  function terrainY(x, z) {
    var T = TERRAIN; if (!T.on) return 0;
    var u = (x - T.x0) / T.cell, v = (z - T.z0) / T.cell; if (u < 0 || v < 0 || u > T.w || v > T.d) return 0;
    var i = Math.min(T.w - 1, Math.floor(u)), j = Math.min(T.d - 1, Math.floor(v)), fu = u - i, fv = v - j, W = T.w + 1, H = T.heights;
    var h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    return (h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv;
  }
  function terrainPaintAt(x, z) { var T = TERRAIN; if (!T.on) return null; var i = Math.floor((x - T.x0) / T.cell), j = Math.floor((z - T.z0) / T.cell); if (i < 0 || j < 0 || i >= T.w || j >= T.d) return null; return T.palette[T.paint[j * T.w + i]] || null; }
  function terrainPaintCell(i, j) {
    var T = TERRAIN, spec = TERRAIN_PAINT[T.palette[T.paint[j * T.w + i]]] || TERRAIN_PAINT.dirt, c = T.ctx, px = T.px, x = i * px, y = j * px, k;
    c.fillStyle = spec.base; c.fillRect(x, y, px, px);
    for (k = 0; k < spec.n; k++) { var r = seededF('t' + i + ',' + j, k, spec.r[0], spec.r[1]) * px / 16; c.fillStyle = spec.dots[seededI('tc' + i + ',' + j, k, 0, spec.dots.length - 1)]; c.beginPath(); c.arc(x + seededF('tx' + i + ',' + j, k, 0, px), y + seededF('tz' + i + ',' + j, k, 0, px), r, 0, Math.PI * 2); c.fill(); }
    // the neighbours' paints feather in over the edges, so two paints meet in a soft seam rather than a hard line
    var own = T.paint[j * T.w + i], f = Math.max(2, Math.round(px * 0.45)), nb = [[i - 1, j, 'l'], [i + 1, j, 'r'], [i, j - 1, 't'], [i, j + 1, 'b']];
    for (k = 0; k < 4; k++) { var ni = nb[k][0], nj = nb[k][1]; if (ni < 0 || nj < 0 || ni >= T.w || nj >= T.d) continue; var np = T.paint[nj * T.w + ni]; if (np === own) continue; var ns = TERRAIN_PAINT[T.palette[np]] || TERRAIN_PAINT.dirt, side = nb[k][2], g = side === 'l' ? c.createLinearGradient(x, 0, x + f, 0) : side === 'r' ? c.createLinearGradient(x + px, 0, x + px - f, 0) : side === 't' ? c.createLinearGradient(0, y, 0, y + f) : c.createLinearGradient(0, y + px, 0, y + px - f); g.addColorStop(0, ns.base); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = 0.75; if (side === 'l') c.fillRect(x, y, f, px); else if (side === 'r') c.fillRect(x + px - f, y, f, px); else if (side === 't') c.fillRect(x, y, px, f); else c.fillRect(x, y + px - f, px, f); c.globalAlpha = 1; }
  }
  function terrainBuild() {
    var T = TERRAIN; if (!T.on || T.mesh) return T.mesh;
    var W = T.w + 1, D = T.d + 1, pos = new Float32Array(W * D * 3), uv = new Float32Array(W * D * 2), idx = [], i, j;
    for (j = 0; j < D; j++) for (i = 0; i < W; i++) { var k = j * W + i; pos[k * 3] = T.x0 + i * T.cell; pos[k * 3 + 1] = T.heights[k]; pos[k * 3 + 2] = T.z0 + j * T.cell; uv[k * 2] = i / T.w; uv[k * 2 + 1] = 1 - j / T.d; }
    for (j = 0; j < T.d; j++) for (i = 0; i < T.w; i++) { var a = j * W + i, b = a + 1, c2 = a + W, d2 = c2 + 1; idx.push(a, c2, b, b, c2, d2); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    T.canvas = document.createElement('canvas'); T.canvas.width = T.w * T.px; T.canvas.height = T.d * T.px; T.ctx = T.canvas.getContext('2d');
    for (j = 0; j < T.d; j++) for (i = 0; i < T.w; i++) terrainPaintCell(i, j);
    T.texture = new THREE.CanvasTexture(T.canvas); T.texture.encoding = THREE.sRGBEncoding; T.texture.anisotropy = 8;
    var mat = new THREE.MeshStandardMaterial({ map: T.texture, roughness: 0.96, metalness: 0 }); mat.userData.noBake = true;
    T.geo = geo; T.mesh = new THREE.Mesh(geo, mat); T.mesh.name = 'terrain'; T.mesh.receiveShadow = true; T.mesh.userData.noBake = true; T.mesh.userData.terrain = true;
    (CO.root || scene).add(T.mesh); shadowDirty = true; return T.mesh;
  }
  function terrainRebuild() { var T = TERRAIN; if (T.mesh) { if (T.mesh.parent) T.mesh.parent.remove(T.mesh); T.geo.dispose(); T.mesh.material.dispose(); T.texture.dispose(); T.mesh = null; } terrainBuild(); NAV.dirty = true; }
  // the corners in a rectangle moved: the mesh follows, the normals and the shadows too; the cells in it are painted again
  function terrainUpdate(i0, j0, i1, j1) {
    var T = TERRAIN; if (!T.mesh) return; var W = T.w + 1, p = T.geo.attributes.position.array, i, j;
    for (j = Math.max(0, j0); j <= Math.min(T.d, j1); j++) for (i = Math.max(0, i0); i <= Math.min(T.w, i1); i++) p[(j * W + i) * 3 + 1] = T.heights[j * W + i];
    T.geo.attributes.position.needsUpdate = true; T.geo.computeVertexNormals(); T.geo.computeBoundingSphere();
    for (j = Math.max(0, j0); j < Math.min(T.d, j1 + 1); j++) for (i = Math.max(0, i0); i < Math.min(T.w, i1 + 1); i++) terrainPaintCell(i, j);
    T.texture.needsUpdate = true; shadowDirty = true; NAV.dirty = true;
  }
  // a brush at a world point: raise, lower, smooth or flatten the corners within the radius (a soft falloff), or paint the cells
  function terrainBrush(x, z, mode, radius, strength, texIndex) {
    var T = TERRAIN; if (!T.on) return { changed: 0, error: 'no terrain: make one first' };
    radius = Math.max(0.3, +radius || 2); strength = Math.max(0, +strength || 0.5); var W = T.w + 1, H = T.heights, n = 0;
    var ci = (x - T.x0) / T.cell, cj = (z - T.z0) / T.cell, rc = radius / T.cell, i0 = Math.floor(ci - rc), i1 = Math.ceil(ci + rc), j0 = Math.floor(cj - rc), j1 = Math.ceil(cj + rc), i, j;
    if (mode === 'road') {   /* a road: the strip flattens to the height under the brush and takes the road paint */
      var rh = terrainY(x, z), W2 = T.w + 1, ri = T.palette.indexOf('road'), nR = 0; if (ri < 0) { T.palette.push('road'); ri = T.palette.length - 1; }
      for (j = Math.max(0, j0); j <= Math.min(T.d, j1); j++) for (i = Math.max(0, i0); i <= Math.min(T.w, i1); i++) { var rdx = i - ci, rdz = j - cj; if (rdx * rdx + rdz * rdz <= rc * rc) { var ra = j * W2 + i; if (H[ra] !== rh) { H[ra] = rh; nR++; } } }
      for (j = Math.max(0, j0); j < Math.min(T.d, j1 + 1); j++) for (i = Math.max(0, i0); i < Math.min(T.w, i1 + 1); i++) { var pdx = (i + 0.5) - ci, pdz = (j + 0.5) - cj; if (pdx * pdx + pdz * pdz <= (rc * 0.8) * (rc * 0.8) && T.paint[j * T.w + i] !== ri) { T.paint[j * T.w + i] = ri; nR++; } }
      if (nR) terrainUpdate(i0, j0, i1, j1); return { changed: nR };
    }
    if (mode === 'paint') {
      var tex = Math.max(0, Math.min(T.palette.length - 1, texIndex | 0));
      for (j = Math.max(0, j0); j < Math.min(T.d, j1 + 1); j++) for (i = Math.max(0, i0); i < Math.min(T.w, i1 + 1); i++) { var dx = (i + 0.5) - ci, dz = (j + 0.5) - cj; if (dx * dx + dz * dz <= rc * rc && T.paint[j * T.w + i] !== tex) { T.paint[j * T.w + i] = tex; n++; } }
      if (n) terrainUpdate(i0, j0, i1, j1); return { changed: n };
    }
    var centre = terrainY(x, z), hs = [];
    for (j = Math.max(0, j0); j <= Math.min(T.d, j1); j++) for (i = Math.max(0, i0); i <= Math.min(T.w, i1); i++) {
      var ddx = i - ci, ddz = j - cj, dist = Math.sqrt(ddx * ddx + ddz * ddz) / rc; if (dist > 1) continue;
      var k = (1 - dist) * (1 - dist), at = j * W + i, h = H[at], nh = h;
      if (mode === 'raise') nh = h + strength * k; else if (mode === 'lower') nh = h - strength * k;
      else if (mode === 'flatten') nh = h + (centre - h) * Math.min(1, strength * k * 2);
      else if (mode === 'smooth') { var sum = 0, cnt = 0, di, dj; for (dj = -1; dj <= 1; dj++) for (di = -1; di <= 1; di++) { var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > T.w || jj > T.d) continue; sum += H[jj * W + ii]; cnt++; } nh = h + (sum / cnt - h) * Math.min(1, strength * k * 2); }
      nh = Math.max(-T.maxH, Math.min(T.maxH, nh)); if (nh !== h) { hs.push([at, nh]); n++; }
    }
    hs.forEach(function (e) { H[e[0]] = e[1]; });
    if (n) terrainUpdate(i0, j0, i1, j1); return { changed: n };
  }
  // the terrain point under a viewport position, for the editor's brushes
  function terrainPick(nx, ny) { var T = TERRAIN; if (!T.mesh) return null; eRay.setFromCamera({ x: nx || 0, y: ny || 0 }, camera); eRay.far = 400; var hits = eRay.intersectObject(T.mesh, false); return hits.length ? { x: rnd(hits[0].point.x), y: rnd(hits[0].point.y), z: rnd(hits[0].point.z), paint: terrainPaintAt(hits[0].point.x, hits[0].point.z) } : null; }
  // flora and props scattered over the ground: copies of a definition on the cells painted with one name (or anywhere), seeded, placed through the shipped layout
  function terrainScatter(type, count, onPaint, seed) {
    var T = TERRAIN; if (!T.on) return { error: 'no terrain' }; if (!PROPS[type]) return { error: 'no prop definition ' + type };
    var cells = [], i, j; for (j = 0; j < T.d; j++) for (i = 0; i < T.w; i++) if (onPaint == null || onPaint === '' || T.palette[T.paint[j * T.w + i]] === onPaint) cells.push([i, j]);
    if (!cells.length) return { error: 'no cells painted ' + onPaint };
    var placed = [], n = Math.max(1, Math.min(500, count | 0)), tag = String(seed || Date.now()), k;
    for (k = 0; k < n; k++) { var c = cells[seededI(tag, k, 0, cells.length - 1)], id = 'sc' + tag.slice(-4) + '-' + k; placed.push({ id: id, type: type, x: Math.round((T.x0 + (c[0] + seededF(tag, k + 1000, 0.15, 0.85)) * T.cell) * 20) / 20, z: Math.round((T.z0 + (c[1] + seededF(tag, k + 2000, 0.15, 0.85)) * T.cell) * 20) / 20, rot: seededI(tag, k + 3000, 0, 3), h: 0 }); }
    CO.layout({ placed: placed }); placed.forEach(function (p) { buildProp(p.id); });
    return { placed: placed.map(function (p) { return p.id; }), count: placed.length };
  }
  function terrainState() { var T = TERRAIN; return { on: T.on, w: T.w, d: T.d, cell: T.cell, x0: T.x0, z0: T.z0, palette: T.palette.slice(), paints: Object.keys(TERRAIN_PAINT), maxH: T.maxH, cells: T.w * T.d }; }
  // the part the editor writes: the whole terrain as data, the heights to two decimals, a row per line so a diff reads
  function terrainCode() {
    var T = TERRAIN; if (!T.on) return '';
    var W = T.w + 1, lines = ['//@ the terrain the editor saved: the ground as a grid of heights and a paint per cell. Written by the Co Engine editor; it sorts first in src/ so the boot sees it. Sculpt and paint in the editor rather than here.', '  CO.terrain({', '    w: ' + T.w + ', d: ' + T.d + ', cell: ' + T.cell + ', x0: ' + T.x0 + ', z0: ' + T.z0 + ', maxH: ' + T.maxH + ',', '    palette: ' + JSON.stringify(T.palette) + ',', '    heights: ['], j, i, row;
    for (j = 0; j < T.d + 1; j++) { row = []; for (i = 0; i < W; i++) row.push(Math.round(T.heights[j * W + i] * 100) / 100); lines.push('      ' + row.join(',') + ','); }
    lines.push('    ],', '    paint: [');
    for (j = 0; j < T.d; j++) { row = []; for (i = 0; i < T.w; i++) row.push(T.paint[j * T.w + i]); lines.push('      ' + row.join(',') + ','); }
    lines.push('    ]', '  });', '');
    return lines.join('\n');
  }
  // ── Floors and walkable ground ────────────────────────────────────
  // Where the player stands. A game answers CO.game.floorY(x, z, y) with decks, ramps and trailers; the default is a flat 0.
  // insideWalk(x, z) says whether a point is ground the crew may walk on; CO.game.insideWalk overrides it, the default is everywhere.
  function floorY(x, z, y) { var g = CO.game && CO.game.floorY ? CO.game.floorY(x, z, y) : 0; return TERRAIN.on ? Math.max(g, terrainY(x, z)) : g; }
  function insideWalk(x, z) { return CO.game && CO.game.insideWalk ? CO.game.insideWalk(x, z) : true; }
  var lampMeshes = [];   // every lens that goes dark with the power: the troffers, the high bays, whatever a game adds
  // take the openings out of a 1D span: [[a0, a1]] minus every [o0, o1] (and an optional o2, the opening's height, left to the caller)
  function spanCut(a0, a1, openings) {
    var segs = [[a0, a1]];
    (openings || []).forEach(function (o) { var out = []; segs.forEach(function (s) { if (o[1] <= s[0] || o[0] >= s[1]) { out.push(s); return; } if (o[0] > s[0]) out.push([s[0], o[0]]); if (o[1] < s[1]) out.push([o[1], s[1]]); }); segs = out; });
    return segs;
  }
  // a painted lining on a room's outer walls: a plane just inside the cladding, skirting along the floor, a dado rail, with openings
  // left for doors. axis 'x': the wall runs along z at x = at; 'z': along x at z = at. inward is +1 or -1, the side the room is on.
  function lineWall(axis, at, a0, a1, h, mat, openings, inward, opt) { return worldItem('wall', function () {
    opt = opt || {};
    var segs = spanCut(a0, a1, openings);
    var off = at + inward * (opt.inset === undefined ? 0.17 : opt.inset), ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), trim = opt.trim || MAT.trim;
    function strip(w, hh, y, mid, m) { if (axis === 'x') { plane(w, hh, m, off, y, mid, 0, ry); } else { plane(w, hh, m, mid, y, off, 0, ry); } }
    segs.forEach(function (s) { var w = s[1] - s[0], mid = (s[0] + s[1]) / 2; strip(w, h, h / 2, mid, mat); if (opt.skirting !== false) { var sk = axis === 'x' ? box(0.03, 0.12, w, trim, off + inward * 0.012, 0.06, mid) : box(w, 0.12, 0.03, trim, mid, 0.06, off + inward * 0.012); sk.receiveShadow = true; } if (opt.dado !== false) { if (axis === 'x') box(0.025, 0.05, w, trim, off + inward * 0.01, 0.95, mid); else box(w, 0.05, 0.025, trim, mid, 0.95, off + inward * 0.01); } });
    (openings || []).forEach(function (o) { if (o[2] && o[2] < h) { var w = o[1] - o[0], mid = (o[0] + o[1]) / 2; strip(w, h - o[2], o[2] + (h - o[2]) / 2, mid, mat); } });
    return segs;
  }, null); }
  // a room's own floor laid over the slab: the texture repeats in metres so a carpet tile is half a metre wherever it is
  function roomFloor(mat, x0, x1, z0, z1, per, y) { return worldItem('floor', function () {
    var m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set((x1 - x0) / per, (z1 - z0) / per);
    if (mat.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set((x1 - x0) / per, (z1 - z0) / per); }
    var p = plane(x1 - x0, z1 - z0, m, (x0 + x1) / 2, (y === undefined ? 0 : y) + 0.012, (z0 + z1) / 2, -Math.PI / 2); p.receiveShadow = true; return p;
  }, null); }
  // a recessed troffer in a room's ceiling: a white frame and a prismatic lens that dims when the power is off
  function troffer(x, y, z, w, d) { return worldItem('ceiling light', function () { box(w || 1.2, 0.05, d || 0.6, MAT.trim, x, y - 0.025, z).castShadow = false; var lens = box((w || 1.2) - 0.1, 0.02, (d || 0.6) - 0.1, MAT.lamp, x, y - 0.045, z); lens.castShadow = false; lampMeshes.push(lens); return lens; }, null); }
  // a high bay hung from a roof at roofH: the conduit drop, the ballast box, the reflector and the lens
  var HIGHBAY_REFL = null;
  function highBay(x, y, z, roofH) { return worldItem('high bay lamp', function () {
    if (!HIGHBAY_REFL) HIGHBAY_REFL = std({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });   // one reflector material for every lamp: thirty of them bake into one draw instead of thirty
    roofH = roofH === undefined ? y + 1.2 : roofH;
    cyl(0.025, roofH - y - 0.22, MAT.steelDark, x, (roofH + y + 0.22) / 2, z, null, 6);
    box(0.34, 0.22, 0.26, MAT.steelDark, x, y + 0.11, z); box(0.1, 0.06, 0.06, MAT.black, x + 0.2, y + 0.12, z);
    var refl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.14, 0.42, 20, 1, true), HIGHBAY_REFL); refl.position.set(x, y - 0.21, z); parentOf(null).add(refl);
    var lens = cyl(0.42, 0.03, MAT.lamp, x, y - 0.41, z, null, 20); lens.castShadow = false; lampMeshes.push(lens); return lens;
  }, null); }
  // ── The yard kit ──────────────────────────────────────────────────
  var FENCE = null;
  function fenceMats() { if (!FENCE) FENCE = { post: std({ color: 0x2f5d3a, roughness: 0.5, metalness: 0.5 }), mesh: std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x3d6b48 }), conc: std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), wire: std({ color: 0x8e949a, roughness: 0.4, metalness: 0.8 }) }; return FENCE; }
  // a run of fence from (x0, z0) to (x1, z1): posts every 3 m with concrete feet, mesh panels, two folds and a top rail, three
  // strands of barbed wire on angled arms, and a solid the length of the run. opt: { y: ground height, wires: false, solid: false }
  function fenceRun(x0, z0, x1, z1, opt) { return worldItem('fence', function () {
    opt = opt || {}; var F = fenceMats(), Y = opt.y || 0;
    // ang turns a y-axis cylinder laid along z onto the run (the wires); rot turns an x-long box or plane onto it (panels, rails, boards)
    var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.max(1, Math.round(len / 3)), ang = Math.atan2(dx, dz), ux = dx / len, uz = dz / len, nx = uz, nz = -ux, rot = Math.atan2(-uz, ux);
    for (var i = 0; i <= n; i++) {
      var t = i / n, px = x0 + dx * t, pz = z0 + dz * t;
      box(0.08, 2.5, 0.08, F.post, px, Y + 1.25, pz); box(0.3, 0.25, 0.3, F.conc, px, Y + 0.12, pz); box(0.12, 0.03, 0.12, F.post, px, Y + 2.52, pz);
      if (opt.wires !== false) { var arm = box(0.04, 0.6, 0.04, F.post, px + nx * 0.2, Y + 2.72, pz + nz * 0.2); arm.rotation.set(0, ang, -0.7, 'YXZ'); arm.position.y += 0.1; }
      if (i < n) {
        var mx = x0 + dx * (t + 0.5 / n), mz = z0 + dz * (t + 0.5 / n), seg = len / n;
        var mp = plane(seg - 0.1, 2.2, F.mesh, mx, Y + 1.35, mz, 0, rot); mp.receiveShadow = false;
        [0.75, 1.65].forEach(function (vy) { var fold = box(seg - 0.1, 0.06, 0.03, F.post, mx, Y + vy, mz); fold.rotation.y = rot; });
        var gb = box(seg, 0.3, 0.05, F.conc, mx, Y + 0.15, mz); gb.rotation.y = rot; var tr = box(seg, 0.03, 0.03, F.post, mx, Y + 2.46, mz); tr.rotation.y = rot; var br = box(seg, 0.03, 0.03, F.post, mx, Y + 0.32, mz); br.rotation.y = rot;
      }
    }
    if (opt.solid !== false) solid(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, Y, Y + 2.6);   // the fence is a fence: nobody walks through it
    if (opt.wires !== false) [0, 1, 2].forEach(function (k) { var wy = Y + 2.62 + k * 0.17, wo = 0.22 + k * 0.14; var wire = cyl(0.006, len, F.wire, (x0 + x1) / 2 + nx * wo, wy, (z0 + z1) / 2 + nz * wo, null, 4); wire.rotation.x = Math.PI / 2; wire.rotation.z = 0; wire.rotation.order = 'YXZ'; wire.rotation.y = ang; });
  }, opt && opt.parent); }
  // a tree: a tapered trunk and four lumpy crowns, scaled by s, standing on y
  var TREE_MATS = null;
  function tree(x, z, s, y, parent) { return worldItem('tree', function () {
    s = s || 1; y = y || 0;
    if (!TREE_MATS) TREE_MATS = { trunk: std({ color: 0x5b4634, roughness: 1 }), crowns: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a].map(function (c) { return std({ color: c, roughness: 1 }); }) };
    cyl(0.12 * s, 2.6 * s, TREE_MATS.trunk, x, y + 1.3 * s, z, parent, 8, 0.18 * s);
    [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { sphere(b[3] * s, TREE_MATS.crowns[i], x + b[0] * s, y + b[1] * s, z + b[2] * s, parent); });
  }, parent); }
  // a street or yard lamp: a post, an arm and a glowing head; the lens goes on the lamp list
  function lampPost(x, z, y, h, parent) { return worldItem('lamp post', function () { h = h || 5; y = y || 0; cyl(0.06, h, MAT.steelDark, x, y + h / 2, z, parent, 8, 0.09); box(0.9, 0.06, 0.06, MAT.steelDark, x + 0.45, y + h - 0.05, z, parent); var lens = box(0.36, 0.14, 0.3, glowMat(0xfff2c0, 0.6), x + 0.9, y + h - 0.12, z, parent); lampMeshes.push(lens); return lens; }, parent); }
  // point-in-rectangle helpers used all over a site
  function inRect(x, z, x0, x1, z0, z1) { return x > x0 && x < x1 && z > z0 && z < z1; }
  function rectsOverlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0; }
  // ── The route finder ──────────────────────────────────────────────
  // A grid of NAV.cell metres over the site. A cell is blocked by any static solid (walls, racks, furniture) under head height,
  // or, outside the walkable ground (insideWalk), unless the game lets a walker through there (CO.game.navPass(x, z): a docked
  // trailer, a staff door). Hinged doors never block a walker with keys. navSetup names the area; NAV.dirty rebuilds the grid.
  var NAV = { cell: 0.4, x0: -40, z0: -40, w: 200, h: 200, grid: null, dirty: true, pad: 0.3, headroom: 1.6, steps: 20000 };
  function navSetup(o) { o = o || {}; if (o.cell) NAV.cell = o.cell; if (typeof o.x0 === 'number') NAV.x0 = o.x0; if (typeof o.z0 === 'number') NAV.z0 = o.z0; if (o.width) NAV.w = Math.round(o.width / NAV.cell); if (o.depth) NAV.h = Math.round(o.depth / NAV.cell); if (typeof o.w === 'number') NAV.w = o.w; if (typeof o.h === 'number') NAV.h = o.h; if (typeof o.pad === 'number') NAV.pad = o.pad; NAV.grid = null; NAV.dirty = true; return NAV; }
  function navBuild() {
    var g = new Uint8Array(NAV.w * NAV.h), c = NAV.cell, pad = NAV.pad;
    for (var j = 0; j < NAV.h; j++) for (var i = 0; i < NAV.w; i++) {
      var x = NAV.x0 + (i + 0.5) * c, z = NAV.z0 + (j + 0.5) * c, blocked = 0;
      if (!insideWalk(x, z)) blocked = 2;   // outside the ground you walk: open only where the game says so
      else for (var k = 0; k < solids.length; k++) { var s = solids[k]; if (s.y0 > NAV.headroom) continue; if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad) { blocked = 1; break; } }
      g[j * NAV.w + i] = blocked;
    }
    NAV.grid = g; NAV.dirty = false;
  }
  function navOpen(i, j) {
    if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) return false;
    var b = NAV.grid[j * NAV.w + i]; if (b === 0) return true; if (b === 1) return false;
    if (CO.game && CO.game.navPass) return !!CO.game.navPass(NAV.x0 + (i + 0.5) * NAV.cell, NAV.z0 + (j + 0.5) * NAV.cell);
    return false;
  }
  function navCell(p) { return { i: clamp(Math.floor((p.x - NAV.x0) / NAV.cell), 0, NAV.w - 1), j: clamp(Math.floor((p.z - NAV.z0) / NAV.cell), 0, NAV.h - 1) }; }
  function navNearestOpen(cl) { if (navOpen(cl.i, cl.j)) return cl; for (var r = 1; r < 8; r++) for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) if (Math.abs(di) === r || Math.abs(dj) === r) if (navOpen(cl.i + di, cl.j + dj)) return { i: cl.i + di, j: cl.j + dj }; return cl; }
  function navFreeAt(x, z) { if (NAV.dirty || !NAV.grid) navBuild(); var cl = navCell({ x: x, z: z }); return navOpen(cl.i, cl.j); }
  function navLine(a, b) { var dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (NAV.cell * 0.5)) + 1, prev = null; for (var k = 0; k <= n; k++) { var cl = navCell({ x: a.x + dx * k / n, z: a.z + dz * k / n }); if (!navOpen(cl.i, cl.j)) return false; if (prev && cl.i !== prev.i && cl.j !== prev.j && (!navOpen(cl.i, prev.j) || !navOpen(prev.i, cl.j))) return false; prev = cl; } return true; }   // no corner cutting on the string-pulled runs either
  function route(a, b) {
    if (NAV.dirty || !NAV.grid) navBuild();
    var sc = navNearestOpen(navCell(a)), gc = navNearestOpen(navCell(b));
    if (sc.i === gc.i && sc.j === gc.j) return [b];
    var W = NAV.w, open = [], came = {}, gs = {}, key = function (c) { return c.j * W + c.i; }, h = function (c) { return Math.abs(c.i - gc.i) + Math.abs(c.j - gc.j); };
    var sk = key(sc); gs[sk] = 0; open.push({ c: sc, f: h(sc) }); var closed = {}, found = null, steps = 0;
    while (open.length && steps++ < NAV.steps) {
      var bi = 0; for (var q = 1; q < open.length; q++) if (open[q].f < open[bi].f) bi = q;
      var cur = open.splice(bi, 1)[0], ck = key(cur.c); if (closed[ck]) continue; closed[ck] = 1;
      if (cur.c.i === gc.i && cur.c.j === gc.j) { found = cur.c; break; }
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue; var ni = cur.c.i + di, nj = cur.c.j + dj; if (!navOpen(ni, nj)) continue;
        if (di && dj && (!navOpen(cur.c.i + di, cur.c.j) || !navOpen(cur.c.i, cur.c.j + dj))) continue;   // no corner cutting
        var nk = nj * W + ni, ng = gs[ck] + (di && dj ? 1.414 : 1);
        if (gs[nk] !== undefined && gs[nk] <= ng) continue;
        gs[nk] = ng; came[nk] = ck; open.push({ c: { i: ni, j: nj }, f: ng + h({ i: ni, j: nj }) });
      }
    }
    if (!found) return [b];
    var cells = [], k2 = key(found); while (k2 !== undefined && k2 !== sk) { cells.push({ x: NAV.x0 + ((k2 % W) + 0.5) * NAV.cell, z: NAV.z0 + (Math.floor(k2 / W) + 0.5) * NAV.cell }); k2 = came[k2]; }
    cells.reverse(); cells.push(b);
    // string-pulling
    var out = [], from = a, idx = 0;
    while (idx < cells.length) { var far = idx; for (var m = cells.length - 1; m > idx; m--) if (navLine(from, cells[m])) { far = m; break; } out.push(cells[far]); from = cells[far]; idx = far + 1; }
    return out;
  }
  // turn the short way round
  function yawWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function easeYaw(cur, target, k) { return cur + yawWrap(target - cur) * k; }
  // walk a record { x, z, yaw } along a list of waypoints at speed, easing the heading; returns true when the last one is reached
  function walkAlong(rec, path, speed, dt) {
    if (!path || !path.length) return true;
    var p = path[0], dx = p.x - rec.x, dz = p.z - rec.z, dist = Math.sqrt(dx * dx + dz * dz), step = speed * dt;
    if (dist <= step) { rec.x = p.x; rec.z = p.z; path.shift(); return path.length === 0; }
    rec.x += dx / dist * step; rec.z += dz / dist * step; rec.yaw = easeYaw(rec.yaw || 0, Math.atan2(dx, dz), Math.min(1, dt * 8));
    return false;
  }
  // ── The clock ─────────────────────────────────────────────────────
  // S.day and S.time (hours, 0 to 24) are the game's; the engine reads them. A week is CAL.week days, a season CAL.season days.
  var CAL = { week: 7, season: 7, seasons: ['spring', 'summer', 'autumn', 'winter'], dayStart: 6 };
  function nowAbs() { return (S ? (S.day || 1) * 24 + (S.time || 0) : 0); }
  function season() { return Math.floor((((S && S.day || 1) - 1) % (CAL.season * CAL.seasons.length)) / CAL.season); }
  function seasonName() { return CAL.seasons[season()]; }
  function weekday() { return ((S && S.day || 1) - 1) % CAL.week; }
  function isSunday() { return (S && S.day || 1) % CAL.week === 0; }
  // ── Weather ───────────────────────────────────────────────────────
  // S.weather = { kind, wet, snow, wind, until }. The table per season says how likely each kind is; a game may replace it on
  // WEATHER_TABLE. tickWeatherState(dt) rolls the weather on, wets and snows the ground, and flashes and thunders in a storm.
  var WEATHER_TABLE = {
    winter: [['snow', 0.32], ['overcast', 0.3], ['clear', 0.28], ['rain', 0.1]],
    summer: [['clear', 0.6], ['overcast', 0.18], ['rain', 0.12], ['storm', 0.1]],
    other: [['clear', 0.42], ['overcast', 0.26], ['rain', 0.22], ['storm', 0.1]]
  };
  var WEATHER_WORDS = { rain: 'Rain on the roof.', storm: 'A storm is rolling in.', snow: 'Snow. It will be slow outside.', overcast: 'Clouds have come over.', clear: 'The sky has cleared.' };
  var weatherFlash = 0;
  function pickWeather(first) {
    var table = WEATHER_TABLE[seasonName()] || WEATHER_TABLE.other, r = Math.random(), acc = 0, kind = table[table.length - 1][0];
    for (var i = 0; i < table.length; i++) { acc += table[i][1]; if (r < acc) { kind = table[i][0]; break; } }
    var prev = S.weather ? S.weather.kind : null;
    S.weather = { kind: kind, wet: S.weather ? S.weather.wet : 0, snow: S.weather ? S.weather.snow : 0, wind: kind === 'storm' ? randf(0.8, 1.2) : kind === 'clear' ? randf(0.1, 0.4) : randf(0.3, 0.7), until: nowAbs() + randf(2.5, 8) };
    if (!first && prev !== kind) logEvent(WEATHER_WORDS[kind] || kind, kind === 'storm' ? 'bad' : '');
    runHooks('weather', kind, prev);
  }
  function indoors(x, z) { return CO.game && CO.game.indoors ? CO.game.indoors(x, z) : false; }
  function tickWeatherState(dt) {
    if (!S.weather) pickWeather(true);
    var W = S.weather;
    if (nowAbs() > W.until) pickWeather(false);
    var raining = W.kind === 'rain' || W.kind === 'storm';
    W.wet = clamp(W.wet + (raining ? dt / 50 : -dt / 260), 0, 1);
    W.snow = clamp(W.snow + (W.kind === 'snow' ? dt / 90 : seasonName() === 'winter' ? -dt / 1200 : -dt / 200), 0, 1);
    if (W.kind === 'storm' && Math.random() < dt * 0.06) { weatherFlash = 1; var delay = randf(300, 1800); setTimeout(function () { sfx('thunder'); }, delay); }
    weatherFlash *= Math.max(0, 1 - 6 * dt); CO.flash = weatherFlash;
    var inside = player ? indoors(player.x, player.z) : true;
    ambience(raining ? (inside ? 0.05 : 0.14) * (W.kind === 'storm' ? 1.4 : 1) : 0);
  }
  // a looping band of filtered noise is the rain; its level follows whether you are under a roof
  var amb = { gain: null, src: null, want: 0 };
  function ambience(level) {
    amb.want = level;
    if (!AC) return;
    if (!amb.src) { var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var src = AC.createBufferSource(); src.buffer = buf; src.loop = true; var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; var g = AC.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); amb.src = src; amb.gain = g; }
    amb.gain.gain.setTargetAtTime(SET && SET.sound !== false ? level : 0, AC.currentTime, 0.4);
  }
  // ── The sky ───────────────────────────────────────────────────────
  // a dome with a zenith-to-horizon gradient, a sun and a moon that ride opposite each other, clouds that drift with the wind,
  // and the rain and snow as point clouds round the camera. buildSky(opt) makes them; tickSky(dt) moves them.
  var sky = { dome: null, mat: null, sunDisc: null, moon: null, clouds: [], rain: null, snow: null, windT: 0, y: 0, rainN: 7000, snowN: 3000 };
  function cloudTex() { return tex(256, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 14; i++) { var r = randf(18, 42), x = randf(r, w - r), y = randf(r * 0.6, h - r * 0.6); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }); }
  function discTex(col) { return tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(0.6, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
  function buildSky(opt) {
    opt = opt || {}; sky.y = opt.y || 0;
    var skyMat = new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color(0x4f7fb8) }, mid: { value: new THREE.Color(0x8fb0d4) }, bot: { value: new THREE.Color(0xd6e2ec) } }, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main() { vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vW; void main() { float h = clamp(vW.y, -0.05, 1.0); vec3 c = h < 0.12 ? mix(bot, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, pow(smoothstep(0.12, 1.0, h), 0.6)); gl_FragColor = vec4(c, 1.0); }' });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(opt.radius || 230, 32, 16), skyMat); dome.position.y = sky.y; dome.renderOrder = -10; dome.userData.noBake = true; dome.frustumCulled = false; scene.add(dome); sky.dome = dome; sky.mat = skyMat;
    var sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(255,244,214,1)'), transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(26, 26, 1); scene.add(sunSp); sky.sunDisc = sunSp;
    var moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(225,230,240,0.9)'), transparent: true, depthWrite: false, fog: false })); moonSp.scale.set(12, 12, 1); scene.add(moonSp); sky.moon = moonSp;
    var ct = cloudTex();
    for (var k = 0; k < (opt.clouds === undefined ? 10 : opt.clouds); k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false })); var s = randf(50, 90); sp.scale.set(s, s * 0.5, 1); sp.position.set(randf(-150, 150), randf(70, 100), randf(-150, 150)); scene.add(sp); sky.clouds.push({ sp: sp, v: randf(0.6, 1.4) }); }
    if (opt.precipitation !== false) {
      var streak = tex(16, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(210,225,240,0)'); g.addColorStop(0.5, 'rgba(210,225,240,0.9)'); g.addColorStop(1, 'rgba(210,225,240,0)'); c.fillStyle = g; c.fillRect(6, 0, 4, h); });
      var flake = tex(32, 32, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
      var mkPoints = function (n, size, map, range) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = randf(-range, range); pos[i * 3 + 1] = randf(0, 16); pos[i * 3 + 2] = randf(-range, range); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: map, size: size, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts; };
      sky.rainN = opt.rainN || 7000; sky.snowN = opt.snowN || 3000;
      sky.rain = mkPoints(sky.rainN, 0.26, streak, 24); sky.rain.material.opacity = 0.5; sky.rain.material.color.setHex(0xc7d3de); sky.snow = mkPoints(sky.snowN, 0.22, flake, 30);
    }
    return sky;
  }
  // the height of whatever is over a point: 0 outdoors, a roof height under a roof. The game answers CO.game.roofAt(x, z).
  function roofAt(x, z) { return CO.game && CO.game.roofAt ? CO.game.roofAt(x, z) : 0; }
  function tickSky(dt) {
    sky.windT += dt;
    var W = S && S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 }, t = S ? S.time || 12 : 12;
    if (sky.dome) { sky.dome.position.x = camera.position.x; sky.dome.position.z = camera.position.z; }
    sky.clouds.forEach(function (c) { c.sp.position.x += c.v * dt * (0.5 + W.wind); if (c.sp.position.x > camera.position.x + 150) c.sp.position.x = camera.position.x - 150; });
    if (sky.sunDisc && sun) { _v.copy(sun.position).sub(sun.target.position).normalize(); var elv = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1)); sky.sunDisc.position.copy(_v).multiplyScalar(200).add(camera.position); sky.sunDisc.material.opacity = clamp(elv * 4, 0, 1); sky.moon.position.copy(_v).multiplyScalar(-200).add(camera.position); sky.moon.position.y = Math.abs(sky.moon.position.y - camera.position.y) + camera.position.y + 20; sky.moon.material.opacity = clamp(0.9 - elv * 4, 0, 0.9); }
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow', px = player ? player.x : camera.position.x, pz = player ? player.z : camera.position.z;
    if (sky.rain) {
      sky.rain.visible = raining; sky.snow.visible = snowing;
      if (raining) { var p = sky.rain.geometry.attributes.position.array, pn = Math.min(p.length, (CO.rainN || sky.rainN) * 3); for (var r = 0; r < pn; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var roofY = roofAt(p[r], p[r + 2]); if (p[r + 1] < roofY + sky.y || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 2] = pz + randf(-24, 24); var rf = roofAt(p[r], p[r + 2]); p[r + 1] = randf(rf ? rf + 0.6 : 6, 16); } } sky.rain.geometry.attributes.position.needsUpdate = true; }
      if (snowing) { var q = sky.snow.geometry.attributes.position.array, qn = Math.min(q.length, (CO.snowN || sky.snowN) * 3); for (var s = 0; s < qn; s += 3) { q[s + 1] -= 1.3 * dt; q[s] += Math.sin(sky.windT + s) * 0.4 * dt; var ry = roofAt(q[s], q[s + 2]); if (q[s + 1] < ry + sky.y || Math.abs(q[s] - px) > 32 || Math.abs(q[s + 2] - pz) > 32) { q[s] = px + randf(-30, 30); q[s + 2] = pz + randf(-30, 30); var sf = roofAt(q[s], q[s + 2]); q[s + 1] = randf(sf ? sf + 0.6 : 6, 16); } } sky.snow.geometry.attributes.position.needsUpdate = true; }
    }
    var overcast = raining ? 0.75 : snowing ? 0.6 : W.kind === 'overcast' ? 0.5 : 0;
    var cday = 0.12 + 0.88 * Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1)); sky.clouds.forEach(function (c) { c.sp.material.color.setScalar((1 - overcast * 0.55) * cday); c.sp.material.opacity = 0.5 + overcast * 0.5; });
    runHooks('sky', W, dt);
  }
  // ── Light by the hour ─────────────────────────────────────────────
  // the sun's angle, colour and strength, the sky bounce, the sky and fog colours, and the lamp materials follow S.time and the
  // weather. The game lights its own lamps in the 'lighting' hook, which gets (day, dawn, overcast, power) each tick.
  var skyNight = new THREE.Color(0x0b1020), skyDawn = new THREE.Color(0xd9916b), skyDay = new THREE.Color(0x8fb0d4), skyOvercast = new THREE.Color(0x6b7482), skyTmp = new THREE.Color(), lightT = 0;
  function powered() { return CO.game && CO.game.powered ? CO.game.powered() : true; }
  function lighting(dt) {
    lightT += dt; if (lightT < 0.1) return; lightT = 0;
    var t = S ? S.time || 12 : 12, day = clamp((t - 5.5) / 1.5, 0, 1) * clamp((21.5 - t) / 1.5, 0, 1), dawn = Math.max(0, 1 - Math.abs(t - 6.5) / 1.5) + Math.max(0, 1 - Math.abs(t - 20.5) / 1.5);
    var az = Math.PI * (t - 6) / 16, elev = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1));
    var W = S && S.weather || { kind: 'clear' }, overcast = W.kind === 'overcast' ? 0.45 : W.kind === 'rain' ? 0.65 : W.kind === 'storm' ? 0.85 : W.kind === 'snow' ? 0.55 : 0;
    sun.position.set(Math.cos(az) * 60, 8 + elev * 80, 30 + Math.sin(az) * 20); sun.position.add(sun.target.position); sun.intensity = Math.max(0, elev) * 1.15 * (0.6 + 0.4 * day) * (1 - overcast * 0.8) + weatherFlash * 2.5;
    sun.color.setHSL(0.09, dawn * 0.6 * (1 - overcast), 0.95 - dawn * 0.15);
    skyTmp.copy(skyNight).lerp(skyDay, day); if (dawn > 0) skyTmp.lerp(skyDawn, dawn * 0.5 * (1 - day * 0.3));
    if (overcast) skyTmp.lerp(skyOvercast, overcast * day * 0.8); if (weatherFlash > 0.05) skyTmp.lerp(new THREE.Color(0xffffff), weatherFlash * 0.7);
    if (scene.background && scene.background.isColor) scene.background.copy(skyTmp); if (scene.fog) { scene.fog.color.copy(skyTmp); scene.fog.near = 70 - overcast * 30; scene.fog.far = 190 - overcast * 90; }
    if (sky.mat) { sky.mat.uniforms.top.value.copy(skyTmp).multiplyScalar(0.62 + overcast * 0.25); sky.mat.uniforms.mid.value.copy(skyTmp); sky.mat.uniforms.bot.value.copy(skyTmp).lerp(new THREE.Color(0xffffff), 0.4 * day * (1 - overcast * 0.5)); }
    hemi.intensity = 0.12 + day * 0.35 * (1 - overcast * 0.5) + weatherFlash;
    var power = powered();
    MAT.lamp.color.setHex(power ? 0xfff6e4 : 0x3a3a3a); MAT.skylight.color.setHex(0xffffff); MAT.skylight.color.multiplyScalar(0.04 + day * 0.96);
    runHooks('lighting', day, dawn, overcast, power);
  }
  // The sun's shadow map is a second full pass over every caster, so it is not redrawn every frame. It is redrawn four times a
  // second, at once when something flagged it dirty, and every frame while the game says something big is moving (CO.game.shadowLive()).
  function shadowTick(dt) {
    if (!renderer.shadowMap.enabled) return;
    shadowT += dt;
    var live = CO.game && CO.game.shadowLive ? CO.game.shadowLive() : false;
    if (shadowDirty || live || shadowT > 0.25) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0; }
  }
  // ── World items ───────────────────────────────────────────────────
  // A key names an item by what it is and where the game built it ("lamp post@12,6", "mesh plane 34x19.2@0,13.6"), so it survives a
  // reload and most changes to the game's code. An edit is { x, y, z, ry (degrees), sx, sy, sz, hidden }, every field optional.
  var WORLD_EDITS = {}, WORLD_ITEMS = [], WORLD_PARENT = null, WORLD_COPIES = [];
  // copies of world items (0.9.4): { id, of (the original's key), x, y, z, ry (degrees), sx, sy, sz }, kept in src/00-world.js
  CO.worldCopies = function (list) { (list || []).forEach(function (c) { if (c && c.id && c.of && !WORLD_COPIES.some(function (k) { return k.id === c.id; })) WORLD_COPIES.push(c); }); return WORLD_COPIES; };
  CO.world = function (edits) { if (edits && typeof edits === 'object') for (var k in edits) WORLD_EDITS[k] = edits[k]; return WORLD_EDITS; };
  // a kit call builds into a group of its own, centred on what it built and standing on the ground, so it turns and resizes about itself
  // a game marks an item movesOnly (o.userData.movesOnly = true) when its rules follow where it stands but not a turn or a new size
  function worldItem(kind, fn, parent) {
    if (parent || WORLD_PARENT) return fn();
    var root = CO.root || scene, g = new THREE.Group(); g.name = kind; g.userData.worldItem = kind; root.add(g);
    var n0 = solids.length, out; WORLD_PARENT = g;
    try { out = fn(); } finally { WORLD_PARENT = null; }
    g.userData.solids = solids.slice(n0);
    g.updateMatrixWorld(true); var b = new THREE.Box3().setFromObject(g);
    if (!b.isEmpty()) { var cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; g.children.forEach(function (c) { c.position.x -= cx; c.position.z -= cz; }); g.position.set(cx, 0, cz); g.updateMatrixWorld(true); }
    return out;
  }
  function wr(v) { return Math.round(v * 100) / 100; }
  // the things at the top of the world that count as items: not props, people, doors, cars, lights, helpers, the sky or the bake
  function worldCandidate(o) {
    if (!o || o === CO.root || o.userData.editor || o.userData.baked || o.userData.dynamic || o.userData.legs || o.userData.person || o.userData.propId) return false;
    if (o.isLight || o.isPoints || o.isSprite || o.isCamera || o.userData.it || o.material === MAT.hit) return false;   /* a use box is the thing it belongs to, not a thing of its own */
    if (o.userData.worldItem) return true;
    if (hdoors.some(function (d) { return d.g === o; })) return false;
    if (typeof traffic !== 'undefined' && traffic && traffic.cars && traffic.cars.some(function (c) { return c.g === o; })) return false;
    if (o.name === 'terrain' || (typeof TERRAIN === 'object' && TERRAIN && TERRAIN.mesh === o)) return false;
    if (o.isMesh) { var m = Array.isArray(o.material) ? o.material[0] : o.material, P = o.geometry && o.geometry.parameters || {}; if (m && m.side === THREE.BackSide) return false; if (P.radius > 100) return false; return !!o.geometry; }
    return !!o.isGroup && o.children.length > 0;
  }
  function worldKind(o) {
    if (o.userData.worldItem) return o.userData.worldItem;
    if (o.isMesh) { var P = o.geometry.parameters || {}, t = (o.geometry.type || 'mesh').replace(/Geometry$/, '').toLowerCase(); var dims = ['width', 'height', 'depth', 'radius', 'radiusTop'].filter(function (k) { return typeof P[k] === 'number'; }).map(function (k) { return wr(P[k]); }).join('x'); return 'mesh ' + t + (dims ? ' ' + dims : ''); }
    return o.name || 'group';
  }
  function worldName(o) { var k = worldKind(o); return /^mesh /.test(k) ? k.replace(/^mesh (\w+).*/, '$1') + (o.material && matName(o.material) ? ' · ' + matName(o.material) : '') : k; }
  // after the build: every item gets its key and remembers where the game put it and the solids it came with
  // a plain box mesh and a solid laid on exactly its footprint are one wall: the solid travels with the box
  function worldClaimSolids(o, claimed) {
    if (!o.geometry || o.geometry.type !== 'BoxGeometry') return;
    o.updateMatrixWorld(true); var b = new THREE.Box3().setFromObject(o), mine = [], near = function (a, c) { return Math.abs(a - c) < 0.05; };
    solids.forEach(function (s) { if (claimed.indexOf(s) < 0 && near(s.x0, b.min.x) && near(s.x1, b.max.x) && near(s.z0, b.min.z) && near(s.z1, b.max.z)) mine.push(s); });
    if (mine.length) { o.userData.solids = mine; mine.forEach(function (s) { claimed.push(s); }); }
  }
  function worldScan() {
    WORLD_ITEMS = []; var seen = {}, claimed = [];
    (CO.root && CO.root !== scene ? [scene, CO.root] : [scene]).forEach(function (r) { r.children.forEach(function (o) { (o.userData.solids || []).forEach(function (s) { claimed.push(s); }); }); });   /* a kit item's own solids are not up for claiming */
    (CO.root && CO.root !== scene ? [scene, CO.root] : [scene]).forEach(function (r) { r.children.slice().forEach(function (o) {
      if (!worldCandidate(o) || o.userData.worldKey) { if (o.userData.worldKey) WORLD_ITEMS.push(o); return; }
      var base = worldKind(o) + '@' + wr(o.position.x) + ',' + wr(o.position.z) + (Math.abs(o.position.y) > 0.005 ? ',' + wr(o.position.y) : ''), key = base, n = 1;
      while (seen[key]) key = base + '#' + (++n); seen[key] = true;
      if (!o.userData.worldItem && o.isMesh && !o.userData.solids) worldClaimSolids(o, claimed);   /* a wall drawn as a plain box takes the solid laid on its footprint */
      o.userData.worldKey = key; o.userData.worldBase = { x: o.position.x, y: o.position.y, z: o.position.z, ry: o.rotation.y, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z };
      o.userData.worldSolidsBase = (o.userData.solids || []).map(function (s) { return { x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, y0: s.y0, y1: s.y1 }; });
      WORLD_ITEMS.push(o);
    }); });
    return WORLD_ITEMS;
  }
  function worldItemOf(o) { for (var a = o; a; a = a.parent) if (a.userData && a.userData.worldKey) return a; return null; }
  function worldByKey(key) { for (var i = 0; i < WORLD_ITEMS.length; i++) if (WORLD_ITEMS[i].userData.worldKey === key) return WORLD_ITEMS[i]; return null; }
  // the solids an item came with follow it: turned, resized and moved with it, and gone while it is hidden
  function worldSolids(o) {
    var ss = o.userData.solids || [], B = o.userData.worldSolidsBase || [], b0 = o.userData.worldBase; if (!ss.length || !b0) return;
    var c0 = Math.cos(b0.ry), s0 = Math.sin(b0.ry), a = o.rotation.y, c = Math.cos(a), s = Math.sin(a), hidden = !o.visible;
    ss.forEach(function (sol, i) {
      var q = B[i]; if (!q) return; if (hidden) { sol.x0 = sol.x1 = sol.z0 = sol.z1 = 1e6; return; }
      var xs = [], zs = [];
      [[q.x0, q.z0], [q.x1, q.z0], [q.x0, q.z1], [q.x1, q.z1]].forEach(function (p) {
        var dx = p[0] - b0.x, dz = p[1] - b0.z, lx = (dx * c0 - dz * s0) / b0.sx, lz = (dx * s0 + dz * c0) / b0.sz;   /* into the item's own frame at build */
        lx *= o.scale.x; lz *= o.scale.z; xs.push(o.position.x + lx * c + lz * s); zs.push(o.position.z - lx * s + lz * c);
      });
      sol.x0 = Math.min.apply(null, xs); sol.x1 = Math.max.apply(null, xs); sol.z0 = Math.min.apply(null, zs); sol.z1 = Math.max.apply(null, zs);
      var ky = o.scale.y / b0.sy; sol.y0 = o.position.y + (q.y0 - b0.y) * ky; sol.y1 = o.position.y + (q.y1 - b0.y) * ky;
    });
    if (typeof NAV === 'object' && NAV) NAV.dirty = true;
  }
  function worldLay(o, e) {
    var b0 = o.userData.worldBase; if (!b0 || !e) return;
    o.position.set(typeof e.x === 'number' ? e.x : b0.x, typeof e.y === 'number' ? e.y : b0.y, typeof e.z === 'number' ? e.z : b0.z);
    o.rotation.y = typeof e.ry === 'number' ? e.ry * Math.PI / 180 : b0.ry;
    o.scale.set(typeof e.sx === 'number' ? e.sx : b0.sx, typeof e.sy === 'number' ? e.sy : b0.sy, typeof e.sz === 'number' ? e.sz : b0.sz);
    o.visible = !e.hidden; o.updateMatrixWorld(true); worldSolids(o); shadowDirty = true;
  }
  // after the build and before the bake: the saved edits laid on the world, then the copies built
  function worldEditsApply() { worldScan(); WORLD_ITEMS.forEach(function (o) { var e = WORLD_EDITS[o.userData.worldKey]; if (e) worldLay(o, e); }); WORLD_COPIES.forEach(function (c) { worldCopyBuild(c); }); }
  // a copy: the original's meshes cloned (they share its geometry and materials, so a copy costs little), its solids cloned and laid where
  // the copy stands. What the original does (a door that opens, a prompt) stays with the original: a copy is its look and its solids
  function worldCopyBuild(c) {
    var src = worldByKey(c.of); if (!src) return null;
    var keep = [], vis = []; src.traverse(function (o) { keep.push(o.userData); vis.push(o.userData && o.userData.bakedAway ? true : o.visible); o.userData = {}; });
    var g; try { g = src.clone(true); } finally { var i0 = 0; src.traverse(function (o) { o.userData = keep[i0++]; }); }
    var i1 = 0; g.traverse(function (o) { o.visible = vis[i1++]; });
    g.visible = true; g.name = src.name; g.userData = { worldItem: src.userData.worldItem || null, worldKey: c.id, worldCopy: c, worldBase: src.userData.worldBase, worldSolidsBase: src.userData.worldSolidsBase || [] };
    g.userData.solids = g.userData.worldSolidsBase.map(function (q) { var s = { x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1, y0: q.y0, y1: q.y1 }; solids.push(s); return s; });
    (CO.root || scene).add(g); worldCopyLay(g); WORLD_ITEMS.push(g); return g;
  }
  function worldCopyLay(g) { var c = g.userData.worldCopy, b = g.userData.worldBase || { x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1 }; g.position.set(num(c.x, b.x), num(c.y, b.y), num(c.z, b.z)); g.rotation.y = typeof c.ry === 'number' ? c.ry * Math.PI / 180 : b.ry; g.scale.set(num(c.sx, b.sx), num(c.sy, b.sy), num(c.sz, b.sz)); g.updateMatrixWorld(true); worldSolids(g); shadowDirty = true; }
  function num(v, d) { return typeof v === 'number' ? v : d; }
  // a copy removed: out of the scene, its solids gone, its record dropped
  function worldCopyRemove(g) { var c = g.userData.worldCopy; if (g.parent) g.parent.remove(g); (g.userData.solids || []).forEach(function (s) { var k = solids.indexOf(s); if (k >= 0) solids.splice(k, 1); }); var a = WORLD_COPIES.indexOf(c); if (a >= 0) WORLD_COPIES.splice(a, 1); var b = WORLD_ITEMS.indexOf(g); if (b >= 0) WORLD_ITEMS.splice(b, 1); if (typeof NAV === 'object' && NAV) NAV.dirty = true; shadowDirty = true; }
  // what the editor keeps: the item as it stands now against where the game built it
  function worldRecord(o) {
    if (o.userData.worldCopy) { var c = o.userData.worldCopy; c.x = wr(o.position.x); c.y = wr(o.position.y); c.z = wr(o.position.z); c.ry = Math.round(o.rotation.y * 180 / Math.PI * 10) / 10; c.sx = wr(o.scale.x); c.sy = wr(o.scale.y); c.sz = wr(o.scale.z); worldSolids(o); return c; }
    var b0 = o.userData.worldBase, key = o.userData.worldKey; if (!b0 || !key) return null;
    var e = {}, near = function (a, b) { return Math.abs(a - b) < 0.0005; };
    if (!near(o.position.x, b0.x)) e.x = wr(o.position.x); if (!near(o.position.y, b0.y)) e.y = wr(o.position.y); if (!near(o.position.z, b0.z)) e.z = wr(o.position.z);
    if (!near(o.rotation.y, b0.ry)) e.ry = Math.round(o.rotation.y * 180 / Math.PI * 10) / 10;
    if (!near(o.scale.x, b0.sx)) e.sx = wr(o.scale.x); if (!near(o.scale.y, b0.sy)) e.sy = wr(o.scale.y); if (!near(o.scale.z, b0.sz)) e.sz = wr(o.scale.z);
    if (!o.visible) e.hidden = true;
    if (Object.keys(e).length) WORLD_EDITS[key] = e; else delete WORLD_EDITS[key];
    worldSolids(o); return e;
  }
  // the part the editor writes: src/00-world.js, or nothing when the world stands as the game builds it
  function worldCode() {
    var keys = Object.keys(WORLD_EDITS).sort(); if (!keys.length && !WORLD_COPIES.length) return '';
    var obj = function (o) { return JSON.stringify(o).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+: )/g, ', ').replace(/^\{/, '{ ').replace(/\}$/, ' }'); };
    var lines = ['//@ the world the editor changed: what was moved, turned, resized, removed or copied of what the game builds straight into its world. Written by the Co Engine editor; it sorts first in src/ and is laid on the world as it is built. A key is the thing and where the game built it; delete a line to put that thing back, or to take a copy away.'];
    if (keys.length) { lines.push('  CO.world({'); keys.forEach(function (k) { lines.push('    ' + JSON.stringify(k) + ': ' + obj(WORLD_EDITS[k]) + ','); }); lines.push('  });'); }
    if (WORLD_COPIES.length) { lines.push('  CO.worldCopies(['); WORLD_COPIES.forEach(function (c) { lines.push('    ' + obj(c) + ','); }); lines.push('  ]);'); }
    return lines.join('\n') + '\n';
  }
  // ── Meshes ────────────────────────────────────────────────────────
  var CAR_COLS = [0xb8322a, 0x2c5f9e, 0xd8dbdf, 0x2a2d33, 0x7a8691, 0xe0a02a, 0x4f6a3a];
  // a tyre with rings, a rim and a hub, laid along z at (x, y, z) in parent g
  function truckWheel(g, x, y, z, r, w) { var ty = cyl(r, w, MAT.rubber, x, y, z, g, 20); ty.rotation.x = Math.PI / 2; for (var k = 0; k < 3; k++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.04, 0.012, 6, 24), MAT.black); ring.position.set(x, y, z + (k - 1) * w * 0.3); g.add(ring); } cyl(r * 0.58, w + 0.02, MAT.chrome, x, y, z, g, 14).rotation.x = Math.PI / 2; cyl(r * 0.2, w + 0.06, MAT.steelDark, x, y, z, g, 10).rotation.x = Math.PI / 2; return ty; }
  // a bevelled box straight into a group: the one-line closure every vehicle builder used to write for itself
  function rbx(g, w, h, d, r, mat, x, y, z) { var m = new THREE.Mesh(bevelGeo(w, h, d, r), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
  // a hatchback: bevelled body, glass, wheels with arches, lamps, plates, a roof rack bar. opt: { col, plate, seed }
  function carMesh(opt) {
    opt = typeof opt === 'number' ? { col: opt } : (opt || {});
    var g = new THREE.Group(), col = opt.col === undefined ? pick(CAR_COLS) : opt.col, paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, metalness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.15 }), glass = std({ color: 0x2a3340, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 });
    rbx(g, 4.3, 0.52, 1.82, 0.08, paint, 0, 0.6, 0); rbx(g, 2.4, 0.56, 1.66, 0.1, paint, -0.25, 1.12, 0); rbx(g, 1.0, 0.3, 1.6, 0.05, paint, 1.6, 0.9, 0);
    /* the windscreen leans back from the bonnet to the roof's front edge, the rear window forward from the boot to its back edge */ var ws = rbx(g, 0.06, 0.46, 1.5, 0.02, glass, 1.075, 1.21, 0); ws.rotation.z = 0.58; var rw = rbx(g, 0.06, 0.63, 1.5, 0.02, glass, -1.625, 1.14, 0); rw.rotation.z = -0.59; rbx(g, 2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, 0.84); rbx(g, 2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, -0.84);
    [-1, 1].forEach(function (s) { box(0.02, 0.4, 0.02, MAT.black, -0.25, 1.12, s * 0.86, g); box(0.02, 0.4, 0.02, MAT.black, 0.5, 1.1, s * 0.86, g); box(0.14, 0.02, 0.03, MAT.chrome, -0.6, 0.78, s * 0.92, g); box(0.14, 0.02, 0.03, MAT.chrome, 0.3, 0.78, s * 0.92, g); box(0.12, 0.1, 0.16, paint, 0.6, 1.2, s * 1.0, g); });
    g.userData.wheels = [];
    // each wheel is one group at the axle (tyre, rim, spokes, hub) so a game spins it with wheel.rotation.z, around the axle across the car;
    // the spokes lie flat on the outer face and the arch stands in the car's side plane over the tyre
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p) {
      var s = p[1] > 0 ? 1 : -1, w = new THREE.Group(); w.position.set(p[0], 0.33, p[1]); w.userData.wheel = true; g.add(w);
      cyl(0.33, 0.22, MAT.rubber, 0, 0, 0, w, 20).rotation.x = Math.PI / 2; cyl(0.2, 0.225, MAT.chrome, 0, 0, 0, w, 16).rotation.x = Math.PI / 2;
      for (var sp = 0; sp < 3; sp++) box(0.34, 0.035, 0.02, MAT.steelDark, 0, 0, s * 0.118, w).rotation.z = sp * Math.PI / 3;
      cyl(0.055, 0.03, MAT.steelDark, 0, 0, s * 0.125, w, 10).rotation.x = Math.PI / 2;
      var arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 14, Math.PI), paint); arch.position.set(p[0], 0.35, s * 0.92); g.add(arch); g.userData.wheels.push(w);
    });
    rbx(g, 0.12, 0.2, 1.9, 0.03, MAT.plastic, 2.14, 0.42, 0); rbx(g, 0.12, 0.2, 1.9, 0.03, MAT.plastic, -2.14, 0.42, 0);
    g.userData.lamps = [box(0.06, 0.16, 0.34, glowMat(0xfff2c0, 0.4), 2.16, 0.68, 0.62, g), box(0.06, 0.16, 0.34, glowMat(0xfff2c0, 0.4), 2.16, 0.68, -0.62, g)]; box(0.06, 0.14, 0.34, glowMat(0xff2a1a, 0.5), -2.16, 0.68, 0.62, g); box(0.06, 0.14, 0.34, glowMat(0xff2a1a, 0.5), -2.16, 0.68, -0.62, g);
    var plate = opt.plate || ('CO ' + randi(10, 99) + ' ' + pick(['AB', 'KH', 'NL', 'XY']) + randi(100, 999));
    sign([plate], 0.44, 0.11, 2.2, 0.46, 0, Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g); sign([plate.slice(0, 5)], 0.44, 0.11, -2.2, 0.46, 0, -Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g);
    box(0.5, 0.06, 1.0, MAT.black, -0.2, 1.42, 0, g); cyl(0.015, 0.3, MAT.black, -0.9, 1.5, 0.4, g, 4); box(0.3, 0.015, 0.02, MAT.black, 1.0, 1.0, -0.3, g).rotation.z = -0.55;
    g.userData.paint = paint; g.userData.dynamic = true;
    return g;
  }
  // ── Lane traffic ──────────────────────────────────────────────────
  // cars that drive along x in lanes and wrap at the edge: traffic.add(z, dir, speed, mesh) and tickTraffic(dt). The player
  // and the game's own vehicles are not in it; it is the road's life.
  var traffic = { cars: [], x0: -130, x1: 130 };
  function trafficAdd(z, dir, v, mesh, y) { var g = mesh || carMesh(); g.position.set(randf(traffic.x0, traffic.x1), y || 0, z); g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; g.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(g); var c = { g: g, dir: dir, v: v || randf(6, 11), z: z }; traffic.cars.push(c); return c; }
  function tickTraffic(dt) { if (!traffic || !traffic.cars) return; roadTick(dt); traffic.cars.forEach(function (c) { if (c.road) return; c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > traffic.x1) c.g.position.x = traffic.x0; if (c.g.position.x < traffic.x0) c.g.position.x = traffic.x1; var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.dir * c.v * dt / 0.33; }); }); }
  // ── Road network ─────────────────────────────────────────────────
  // Lanes are directed polylines of [x, z] points. A road piece adds its own from its build with c.lane(points, opt), local to
  // the prop, so they move and turn with it; a game adds one in world space with roadLane(points, opt). Lane ends that meet
  // (within 1.2 m, heading within 60 degrees) join into one network, rebuilt when a road piece is placed, moved or removed.
  // roadTraffic({ cars }) keeps that many cars driving it: a car picks its next lane at random at each lane end, keeps its
  // distance to the car ahead, waits while another approach crosses a junction (lanes with the same opt.box), gives way to a
  // lane of higher opt.prio it merges into (a roundabout's ring) and slows for a tight curve (opt.r, its radius). A lane end
  // that leads nowhere sends the car back to a lane nothing leads into, so an open road behaves like the wrapping lanes above.
  // The cars sit in traffic.cars beside the lane cars, flagged road: true. The dev command 'lanes' draws the network.
  var ROADS = { src: [], net: null, sig: '', checkT: 0, want: 0, cars: [], dbg: null, seq: 0 };
  function roadLane(points, opt) { var s = { pts: points.map(function (p) { return [p[0], p[1]]; }), opt: opt || {}, g: null, prop: null, n: ++ROADS.seq }; ROADS.src.push(s); ROADS.sig = ''; return s; }
  function roadLaneLocal(g, prop, points, opt) { var s = roadLane(points, opt); s.g = g; s.prop = prop; return s; }
  function roadDropProp(prop) { var n = ROADS.src.length; ROADS.src = ROADS.src.filter(function (s) { return s.prop !== prop; }); if (ROADS.src.length !== n) ROADS.sig = ''; }
  function roadLive(g) { for (var o = g; o; o = o.parent) { if (o === scene) return true; } return false; }
  function roadSig() { var parts = [ROADS.src.length]; ROADS.src.forEach(function (s) { if (!s.g) return; var p = s.g.position; parts.push(s.n, Math.round(p.x * 20), Math.round(p.z * 20), Math.round(s.g.rotation.y * 100), roadLive(s.g) ? 1 : 0); }); return parts.join(','); }
  function roadNet() {
    var v = new THREE.Vector3(), lanes = [];
    ROADS.src = ROADS.src.filter(function (s) { return !s.g || roadLive(s.g); });
    ROADS.src.forEach(function (s) {
      if (s.g) s.g.updateMatrixWorld(true);
      var pts = s.pts.map(function (p) { if (s.g) { v.set(p[0], 0, p[1]).applyMatrix4(s.g.matrixWorld); return [v.x, v.y, v.z]; } return [p[0], s.opt.y || 0, p[1]]; });
      if (pts.length < 2) return;
      var cum = [0]; for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
      lanes.push({ pts: pts, cum: cum, len: cum[cum.length - 1], src: s, next: [], prev: [], box: s.opt.box ? (s.prop || 'world') + ':' + s.opt.box : null, from: s.opt.from === undefined ? null : s.opt.from, prio: s.opt.prio || 0, vmax: s.opt.vmax || (s.opt.r ? Math.max(2.5, Math.sqrt(2.4 * s.opt.r)) : 11) });
    });
    var head = function (a, b) { var dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    lanes.forEach(function (a) {
      var e = a.pts[a.pts.length - 1], ha = head(a.pts[a.pts.length - 2], e);
      lanes.forEach(function (b) {
        if (b === a) return; var s0 = b.pts[0]; if (Math.hypot(s0[0] - e[0], s0[2] - e[2]) > 1.2) return;
        var hb = head(s0, b.pts[1]); if (ha[0] * hb[0] + ha[1] * hb[1] < 0.5) return;
        a.next.push(b); b.prev.push(a);
      });
    });
    // a loop of priority lanes (a roundabout's ring) takes a car per 10 m of it; a car waits to join a full one, so it cannot lock up
    lanes.forEach(function (l) { if (!l.prio || l.comp) return; var comp = { len: 0, cap: 1 }, todo = [l]; l.comp = comp; while (todo.length) { var q = todo.pop(); comp.len += q.len; q.next.concat(q.prev).forEach(function (o) { if (o.prio && !o.comp) { o.comp = comp; todo.push(o); } }); } comp.cap = Math.max(1, Math.floor(comp.len / 10)); });
    var entries = lanes.filter(function (l) { return !l.prev.length && !l.box; });
    return { lanes: lanes, entries: entries.length ? entries : lanes.filter(function (l) { return !l.box; }), joins: lanes.reduce(function (n, l) { return n + l.next.length; }, 0) };
  }
  function lanePoint(L, s, out) {
    var p = L.pts, c = L.cum, i = 1; while (i < p.length - 1 && c[i] < s) i++;
    var a = p[i - 1], b = p[i], t = clamp((s - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]), 0, 1);
    out.x = a[0] + (b[0] - a[0]) * t; out.y = a[1] + (b[1] - a[1]) * t; out.z = a[2] + (b[2] - a[2]) * t; out.yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]); return out;
  }
  function roadPick(L) { return L.next.length ? L.next[Math.floor(Math.random() * L.next.length)] : null; }
  function roadFree(L, s, skip) { var p = lanePoint(L, s, {}); for (var i = 0; i < ROADS.cars.length; i++) { var d = ROADS.cars[i]; if (d === skip || d.parked) continue; if (d.lane === L && Math.abs(d.s - s) < 9) return false; if (Math.hypot(d.g.position.x - p.x, d.g.position.z - p.z) < 7) return false; } return true; }
  function roadPlace(c, L, s) { c.lane = L; c.src = L.src; c.s = s; c.next = roadPick(L); c.wait = 0; c.parked = false; c.g.visible = true; var p = lanePoint(L, s, {}); c.g.position.set(p.x, p.y, p.z); c.yaw = p.yaw; c.g.rotation.y = p.yaw; }
  function roadPark(c) { c.parked = true; c.lane = null; c.next = null; c.v = 0; c.g.visible = false; }
  function roadSeat(c, anywhere) {
    var net = ROADS.net; if (!net || !net.lanes.length) { roadPark(c); return false; }
    var pool = anywhere ? net.lanes.filter(function (l) { return !l.box && l.len > 4; }) : net.entries; if (!pool.length) pool = net.lanes;
    for (var k = 0; k < 8; k++) { var L = pool[Math.floor(Math.random() * pool.length)], s = anywhere ? Math.random() * L.len : 0; if (roadFree(L, s, c)) { roadPlace(c, L, s); c.v = anywhere ? c.vmax * 0.6 : Math.min(c.vmax, L.vmax) * 0.7; return true; } }
    roadPark(c); return false;
  }
  function roadReseat() {
    var byNode = new Map(); ROADS.net.lanes.forEach(function (l) { byNode.set(l.src, l); });
    ROADS.cars.forEach(function (c) { if (c.parked) return; var L = byNode.get(c.src); if (L) { c.lane = L; c.s = Math.min(c.s, L.len); if (!c.next || L.next.indexOf(c.next) < 0) { var nn = c.next && byNode.get(c.next.src); c.next = nn && L.next.indexOf(nn) >= 0 ? nn : roadPick(L); } } else roadSeat(c, true); });
  }
  // how far ahead the nearest car is: on this lane, on the lane it goes to next, or any car close in front heading its way.
  // Two cars that each have the other in front (side by side at a merge or in a junction) do not both wait: the one on the
  // lower priority lane does, or on equal lanes the later car, so one always goes and they cannot lock each other
  function roadGap(c, me) {
    var best = 1e9, rem = c.lane.len - c.s;
    for (var i = 0; i < ROADS.cars.length; i++) {
      var d = ROADS.cars[i]; if (d === c || d.parked) continue;
      if (d.lane === c.lane && d.s > c.s) best = Math.min(best, d.s - c.s);
      else if (d.lane === c.next) best = Math.min(best, rem + d.s);
      else { var dx = d.g.position.x - me.x, dz = d.g.position.z - me.z, dist = Math.hypot(dx, dz); if (dist < 7) { var hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw), fwd = dx * hx + dz * hz, side = Math.abs(dx * hz - dz * hx); if (fwd > 0 && side < 1.7 && Math.cos(d.yaw - c.yaw) > -0.3) { var gx = Math.cos(d.yaw), gz = -Math.sin(d.yaw), mutual = (-dx * gx - dz * gz) > 0 && Math.abs(-dx * gz + dz * gx) < 1.7; if (!mutual || d.lane.prio > c.lane.prio || (d.lane.prio === c.lane.prio && d.id < c.id)) best = Math.min(best, fwd); } } }
    }
    return best;
  }
  // is any car within limit metres of the end of lane L, counting back through the lanes that feed it (acc is the way already counted)
  function roadComing(L, acc, limit, skip, seen) {
    seen = seen || []; if (seen.indexOf(L) >= 0) return false; seen.push(L);
    for (var i = 0; i < ROADS.cars.length; i++) { var d = ROADS.cars[i]; if (d !== skip && !d.parked && d.lane === L && L.len - d.s + acc < limit) return true; }
    for (var k = 0; k < L.prev.length; k++) if (acc + L.len < limit && roadComing(L.prev[k], acc + L.len, limit, skip, seen)) return true;
    return false;
  }
  // may the car leave its lane for the next one: no other approach inside the junction, nobody with priority about to arrive
  function roadMayEnter(c) {
    var ok = roadMayEnter0(c), B = c.next;
    if (ok && B && B.box) { c.res = B.box; c.resFrom = B.from; } else if (!ok) c.res = null;   // a car that goes reserves the junction, so two cannot decide together
    return ok;
  }
  function roadMayEnter0(c) {
    var B = c.next; c.capHold = false; c.boxHold = false; if (!B) return true;
    if (c.lane.src.opt.merge) return true;   // a car already merging has given way at the line: it carries on
    // into a junction only with room on the far side, so nobody stops in the box and locks the other approaches out
    if (B.box) { if (!c.after || B.next.indexOf(c.after) < 0) c.after = roadPick(B); if (c.after) for (var ai = 0; ai < ROADS.cars.length; ai++) { var da = ROADS.cars[ai]; if (da !== c && !da.parked && da.lane === c.after && da.s < 8) { c.boxHold = true; return false; } } }
    var loopL = B.comp ? B : (B.src.opt.merge && B.next.length ? B.next[0] : null);
    if (loopL && loopL.comp && c.lane.comp !== loopL.comp) { B = loopL; var inLoop = 0; for (var ci = 0; ci < ROADS.cars.length; ci++) { var dc = ROADS.cars[ci]; if (dc !== c && !dc.parked && dc.lane && dc.lane.comp === B.comp) inLoop++; } if (inLoop >= B.comp.cap) { c.capHold = true; return false; } B = c.next; }
    for (var i = 0; i < ROADS.cars.length; i++) {
      var d = ROADS.cars[i]; if (d === c || d.parked || !d.lane) continue;
      if (B.box && ((d.lane.box === B.box && d.lane.from !== B.from) || (d.res === B.box && d.resFrom !== B.from))) { c.boxHold = true; return false; }
      if (d.lane === B && d.s < 6) return false;
    }
    // a merge lane (a roundabout entry) joins the lane after it: give way to anyone coming round on that lane's feeders
    if (B.src.opt.merge && B.next.length) { var T = B.next[0]; for (var ti = 0; ti < T.prev.length; ti++) if (T.prev[ti] !== B && roadComing(T.prev[ti], 0, 22, c)) return false; }
    var near = function (F, extra) { for (var j = 0; j < ROADS.cars.length; j++) { var e = ROADS.cars[j]; if (e !== c && !e.parked && e.lane === F && F.len - e.s + extra < 12) return true; } return false; };
    for (var k = 0; k < B.prev.length; k++) { var F = B.prev[k]; if (F === c.lane || F.prio <= c.lane.prio) continue; if (near(F, 0)) return false; for (var m = 0; m < F.prev.length; m++) if (F.prev[m].prio > c.lane.prio && near(F.prev[m], F.len)) return false; }
    return true;
  }
  function roadTick(dt) {
    ROADS.checkT -= dt;
    if (ROADS.checkT <= 0 || !ROADS.sig) { ROADS.checkT = 0.5; var sig = roadSig(); if (sig !== ROADS.sig) { ROADS.sig = sig; ROADS.net = roadNet(); roadReseat(); if (ROADS.dbg) roadDebugDraw(); } }
    var net = ROADS.net; if (!ROADS.cars.length || !net) return;
    var me = new THREE.Vector3(), p = {};
    ROADS.cars.forEach(function (c) { if (c.parked) { if (Math.random() < dt) roadSeat(c, false); return; }
      var L = c.lane, rem = L.len - c.s, target = Math.min(c.vmax, L.vmax);
      if (c.next && rem < 18) target = Math.min(target, c.next.vmax + rem * 0.5);
      me.copy(c.g.position); var gap = roadGap(c, me); if (gap < 40) target = Math.min(target, Math.max(0, (gap - 6) * 0.9));
      c.hold = !!(c.next && rem < 3 && !roadMayEnter(c));
      if (c.hold) { c.wait += dt; var force = c.wait > 9 && !c.capHold && !c.boxHold; target = force ? 1.5 : 0; if (force) c.hold = false; } else if (rem >= 3) c.wait = 0;
      c.v = clamp(c.v + clamp(target - c.v, -8 * dt, 3 * dt), 0, 30);
    });
    ROADS.cars.forEach(function (c) {
      if (c.parked) return;
      c.s += c.v * dt;
      if (c.hold && c.s > c.lane.len - 0.4) { c.s = c.lane.len - 0.4; c.v = 0; }
      while (c.s >= c.lane.len) { var over = c.s - c.lane.len; if (c.next) { c.lane = c.next; c.src = c.lane.src; c.s = over; c.next = c.after && c.lane.next.indexOf(c.after) >= 0 ? c.after : roadPick(c.lane); c.after = null; c.wait = 0; if (!c.lane.box) c.res = null; } else { roadSeat(c, false); break; } }
      if (c.parked) return;
      lanePoint(c.lane, c.s, p); c.g.position.set(p.x, p.y, p.z);
      var dy = Math.atan2(Math.sin(p.yaw - c.yaw), Math.cos(p.yaw - c.yaw)); c.yaw += dy * Math.min(1, dt * 7); c.g.rotation.y = c.yaw;
      var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.v * dt / 0.33; });
    });
  }
  // keep n cars on the road network (0 takes them all off); opt.speed is the top speed in m/s, opt.colours a list to pick from
  function roadTraffic(opt) {
    opt = typeof opt === 'number' ? { cars: opt } : (opt || {}); ROADS.want = Math.max(0, opt.cars | 0);
    while (ROADS.cars.length > ROADS.want) { var c0 = ROADS.cars.pop(); scene.remove(c0.g); var k = traffic.cars.indexOf(c0); if (k >= 0) traffic.cars.splice(k, 1); }
    if (!ROADS.sig) { ROADS.sig = roadSig(); ROADS.net = roadNet(); }
    while (ROADS.cars.length < ROADS.want) {
      var g = carMesh(opt.colours ? pick(opt.colours) : undefined); g.userData.dynamic = true; scene.add(g);
      var c = { id: ++ROADS.seq, g: g, road: true, dir: 1, z: 0, v: 0, vmax: (opt.speed || 9) * randf(0.85, 1.1), s: 0, lane: null, next: null, wait: 0, yaw: 0 };
      ROADS.cars.push(c); traffic.cars.push(c); roadSeat(c, true);
    }
    return ROADS.cars.length;
  }
  function roadDebugDraw() {
    if (ROADS.dbg) { scene.remove(ROADS.dbg); ROADS.dbg.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var g = new THREE.Group(); g.userData.dynamic = true; g.userData.noBake = true;
    var mats = [new THREE.LineBasicMaterial({ color: 0x2fd0ff }), new THREE.LineBasicMaterial({ color: 0xffb020 }), new THREE.LineBasicMaterial({ color: 0xff3a6a })];
    (ROADS.net ? ROADS.net.lanes : []).forEach(function (L) {
      var m = L.next.length ? (L.prio ? mats[1] : mats[0]) : mats[2], pts = L.pts.map(function (q) { return new THREE.Vector3(q[0], q[1] + 0.15, q[2]); });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
      var p = lanePoint(L, L.len * 0.5, {}), a = p.yaw, hx = Math.cos(a), hz = -Math.sin(a), tip = new THREE.Vector3(p.x + hx * 0.5, p.y + 0.15, p.z + hz * 0.5);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x - hx * 0.3 - hz * 0.35, p.y + 0.15, p.z - hz * 0.3 + hx * 0.35), tip, new THREE.Vector3(p.x - hx * 0.3 + hz * 0.35, p.y + 0.15, p.z - hz * 0.3 - hx * 0.35)]), m));
    });
    scene.add(g); ROADS.dbg = g;
  }
  // the dev command 'lanes': draw the network (blue lanes, amber priority lanes, red ends that lead nowhere) or hide it
  function roadDebug(on) {
    if (on === undefined) on = !ROADS.dbg;
    if (!on) { if (ROADS.dbg) { scene.remove(ROADS.dbg); ROADS.dbg = null; } return 'lanes hidden'; }
    if (!ROADS.net || !ROADS.sig) { ROADS.sig = roadSig(); ROADS.net = roadNet(); }
    roadDebugDraw(); return ROADS.net.lanes.length + ' lanes, ' + ROADS.net.joins + ' joins, ' + ROADS.cars.length + ' cars';
  }
  // ── A vehicle you drive ───────────────────────────────────────────
  // The record is the game's ({ x, z, yaw, speed, gear }); driveStep moves it from the keys with an acceleration, a top speed per
  // gear, drag, steering that scales with speed and a collision test the game supplies (vehicleBlocked(x, z, v)). Returns the
  // speed. vehicleCamera puts the camera at the driving seat with a look offset the mouse turns.
  var DRIVE = { accel: 3.2, top: 4.2, reverse: 2.6, drag: 3, steer: 1.6, gears: [0.6, 1.0, 1.5] };
  function driveStep(v, keys, dt, opt) {
    opt = opt || {}; var D = opt.spec || DRIVE, throttle = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), gm = D.gears[(v.gear || 1) - 1] || 1, cap = opt.cap === undefined ? 1 : opt.cap;
    v.speed = v.speed || 0;
    if (throttle) v.speed = clamp(v.speed + throttle * D.accel * gm * dt, -D.reverse * cap, D.top * gm * cap); else v.speed *= Math.max(0, 1 - D.drag * dt);
    if (Math.abs(v.speed) > 0.05) v.yaw += steer * D.steer * dt * (v.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 1.5);
    var nx = v.x + Math.sin(v.yaw) * v.speed * dt, nz = v.z + Math.cos(v.yaw) * v.speed * dt;
    var blocked = opt.blocked ? opt.blocked(nx, nz, v) : false;
    if (!blocked) { v.x = nx; v.z = nz; } else v.speed = -v.speed * 0.2;
    return v.speed;
  }
  // an obstacle the vehicle is already inside cannot block it, so it can always back out; r is the vehicle's half width
  function vehicleBlocked(v, x, z, r, list) {
    var cx = v.x, cz = v.z, all = list || solids.concat(dyn);
    for (var i = 0; i < all.length; i++) { var s = all[i]; if (s.vehicle === v) continue; if (s.y0 > 2.5) continue; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) { var already = cx > s.x0 - r && cx < s.x1 + r && cz > s.z0 - r && cz < s.z1 + r; if (!already) return true; var dxn = Math.max(s.x0 - x, 0, x - s.x1), dzn = Math.max(s.z0 - z, 0, z - s.z1), dxc = Math.max(s.x0 - cx, 0, cx - s.x1), dzc = Math.max(s.z0 - cz, 0, cz - s.z1); if (dxn + dzn < dxc + dzc - 0.001) return true; } }
    return false;
  }
  function vehicleCamera(v, look, eye, back) { var y = floorY(v.x, v.z) + (eye || 1.78), b = back === undefined ? 0.45 : back; camera.position.set(v.x - Math.sin(v.yaw) * b, y, v.z - Math.cos(v.yaw) * b); camera.rotation.set(look ? look.pitch : 0, v.yaw + Math.PI + (look ? look.yaw : 0), 0, 'YXZ'); }
  // ── Physics ───────────────────────────────────────────────────────
  // body(obj, { mass, shape: 'box' | 'sphere', size: [w, h, d] or r, restitution, friction, kinematic }) makes an object a body; its position is
  // the body's centre. removeBody(obj) takes it out. impulse(obj, vx, vy, vz) kicks it. Bodies rest on floorY (so on the terrain too),
  // on the engine's solids and on each other; a body that is still for a while sleeps until something touches it.
  var PHYS = { on: true, g: -9.81, bodies: [], sleepT: 0.6, maxStep: 1 / 50, iterations: 3, stepped: 0 };
  function bodyOf(obj) { for (var i = 0; i < PHYS.bodies.length; i++) if (PHYS.bodies[i].obj === obj) return PHYS.bodies[i]; return null; }
  function bodyBounds(obj) { var b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); return { size: [Math.max(0.05, s.x), Math.max(0.05, s.y), Math.max(0.05, s.z)], off: [c.x - obj.position.x, c.y - obj.position.y, c.z - obj.position.z] }; }
  function body(obj, opt) {
    opt = opt || {}; var B = bodyOf(obj); if (B) removeBody(obj);
    var bb = bodyBounds(obj), size = opt.size ? (typeof opt.size === 'number' ? [opt.size * 2, opt.size * 2, opt.size * 2] : opt.size.slice()) : bb.size;
    B = { obj: obj, mass: opt.mass === undefined ? 1 : +opt.mass, shape: opt.shape || 'box', hx: size[0] / 2, hy: size[1] / 2, hz: size[2] / 2, off: opt.size ? [0, 0, 0] : bb.off, vel: new THREE.Vector3(), restitution: opt.restitution === undefined ? 0.15 : +opt.restitution, friction: opt.friction === undefined ? 0.6 : +opt.friction, kinematic: !!opt.kinematic, asleep: false, still: 0, onGround: false, id: obj.userData && (obj.userData.propId || obj.userData.eid) || obj.name || ('b' + PHYS.bodies.length) };
    PHYS.bodies.push(B); obj.userData.body = B; return B;
  }
  function removeBody(obj) { var i = PHYS.bodies.findIndex(function (b) { return b.obj === obj; }); if (i >= 0) PHYS.bodies.splice(i, 1); if (obj.userData) delete obj.userData.body; return i >= 0; }
  function impulse(obj, vx, vy, vz) { var B = bodyOf(obj); if (!B) return false; B.vel.x += vx || 0; B.vel.y += vy || 0; B.vel.z += vz || 0; B.asleep = false; B.still = 0; return true; }
  function wake(B) { B.asleep = false; B.still = 0; }
  // the box a body fills now, in world space
  function bodyBox(B) { var p = B.obj.position; return { x0: p.x + B.off[0] - B.hx, x1: p.x + B.off[0] + B.hx, y0: p.y + B.off[1] - B.hy, y1: p.y + B.off[1] + B.hy, z0: p.z + B.off[2] - B.hz, z1: p.z + B.off[2] + B.hz }; }
  function overlap(a, b) { var dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0); if (dx <= 0 || dy <= 0 || dz <= 0) return null; return { dx: dx, dy: dy, dz: dz }; }
  // push a body out of a box along the smallest overlap, and take the velocity along that axis away (with the bounce and the friction)
  function resolve(B, box, other) {
    var ov = overlap(bodyBox(B), box); if (!ov) return false; var p = B.obj.position, cx = p.x + B.off[0], cy = p.y + B.off[1], cz = p.z + B.off[2], bcx = (box.x0 + box.x1) / 2, bcy = (box.y0 + box.y1) / 2, bcz = (box.z0 + box.z1) / 2;
    if (ov.dy <= ov.dx && ov.dy <= ov.dz) { var up = cy >= bcy; p.y += up ? ov.dy : -ov.dy; if ((up && B.vel.y < 0) || (!up && B.vel.y > 0)) B.vel.y = -B.vel.y * B.restitution; if (up) { B.onGround = true; B.vel.x *= 1 - Math.min(1, B.friction * 0.2); B.vel.z *= 1 - Math.min(1, B.friction * 0.2); if (other && other.vel) { B.vel.x += (other.vel.x - B.vel.x) * 0.5; B.vel.z += (other.vel.z - B.vel.z) * 0.5; } } }
    else if (ov.dx <= ov.dz) { var right = cx >= bcx; p.x += right ? ov.dx : -ov.dx; if ((right && B.vel.x < 0) || (!right && B.vel.x > 0)) B.vel.x = -B.vel.x * B.restitution; }
    else { var front = cz >= bcz; p.z += front ? ov.dz : -ov.dz; if ((front && B.vel.z < 0) || (!front && B.vel.z > 0)) B.vel.z = -B.vel.z * B.restitution; }
    if (other && other.asleep) wake(other); return true;
  }
  // a hinge: the object swings from a pivot on an axis like a pendulum, with damping; a sign on a bracket, a lamp on a chain
  var HINGES = [];
  function hinge(obj, opt) { removeHinge(obj); opt = opt || {}; var p = opt.pivot || [obj.position.x, obj.position.y + (opt.length || 1), obj.position.z], H = { obj: obj, pivot: p, length: opt.length || 1, axis: opt.axis === 'x' ? 'x' : 'z', angle: opt.angle || 0, omega: opt.omega || 0, damping: opt.damping === undefined ? 0.4 : +opt.damping }; HINGES.push(H); obj.userData.hinge = H; return H; }
  function removeHinge(obj) { var i = HINGES.findIndex(function (h) { return h.obj === obj; }); if (i >= 0) HINGES.splice(i, 1); if (obj.userData) delete obj.userData.hinge; return i >= 0; }
  function swing(obj, omega) { var H = obj.userData && obj.userData.hinge; if (!H) return false; H.omega += omega; return true; }
  function hingeStep(dt) { HINGES.forEach(function (H) { H.omega += (PHYS.g / H.length) * Math.sin(H.angle) * dt - H.omega * H.damping * dt; H.angle += H.omega * dt; var o = H.obj; if (H.axis === 'z') { o.position.set(H.pivot[0] + Math.sin(H.angle) * H.length, H.pivot[1] - Math.cos(H.angle) * H.length, H.pivot[2]); o.rotation.z = H.angle; } else { o.position.set(H.pivot[0], H.pivot[1] - Math.cos(H.angle) * H.length, H.pivot[2] + Math.sin(H.angle) * H.length); o.rotation.x = -H.angle; } }); }
  // a spring: a body pulled towards an anchor point with stiffness k and damping, around a rest length; a punch bag, a hanging sign that bounces
  var SPRINGS = [];
  function spring(obj, opt) { opt = opt || {}; var B = bodyOf(obj) || body(obj, { mass: opt.mass || 1 }); unspring(obj); var S2 = { B: B, anchor: opt.anchor || [obj.position.x, obj.position.y + 1, obj.position.z], k: opt.k === undefined ? 20 : +opt.k, damping: opt.damping === undefined ? 2 : +opt.damping, rest: opt.rest || 0 }; SPRINGS.push(S2); wake(B); return S2; }
  function unspring(obj) { var i = SPRINGS.findIndex(function (s) { return s.B.obj === obj; }); if (i >= 0) SPRINGS.splice(i, 1); return i >= 0; }
  function springStep(dt) { SPRINGS.forEach(function (S2) { var B = S2.B, p = B.obj.position, dx = S2.anchor[0] - p.x, dy = S2.anchor[1] - p.y, dz = S2.anchor[2] - p.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = S2.k * (len - S2.rest) / B.mass; B.vel.x += (dx / len * f - B.vel.x * S2.damping) * dt; B.vel.y += (dy / len * f - B.vel.y * S2.damping - PHYS.g * 0) * dt; B.vel.z += (dz / len * f - B.vel.z * S2.damping) * dt; wake(B); }); }
  function physicsStep(dt) {
    var bodies = PHYS.bodies, i, j, k;
    hingeStep(dt); springStep(dt);
    for (i = 0; i < bodies.length; i++) {
      var B = bodies[i]; if (B.kinematic || B.asleep) continue; var p = B.obj.position;
      B.vel.y += PHYS.g * dt; p.x += B.vel.x * dt; p.y += B.vel.y * dt; p.z += B.vel.z * dt; B.onGround = false;
      // the ground under the body's centre
      var gy = floorY(p.x + B.off[0], p.z + B.off[2]), bottom = p.y + B.off[1] - B.hy; if (bottom < gy) { p.y += gy - bottom; if (B.vel.y < 0) B.vel.y = -B.vel.y * B.restitution; if (Math.abs(B.vel.y) < 0.5) B.vel.y = 0; B.onGround = true; B.vel.x *= 1 - Math.min(1, B.friction * 0.25); B.vel.z *= 1 - Math.min(1, B.friction * 0.25); }
      // the engine's solids (walls, machines, the props' obstacles) near the body
      for (k = 0; k < PHYS.iterations; k++) { var hit = false; for (j = 0; j < solids.length; j++) { var s = solids[j]; if (s.prop && (s.prop === B.id || s.prop === B.ignoreOwn)) continue; var box = { x0: s.x0, x1: s.x1, y0: s.y0 === undefined ? -5 : s.y0, y1: s.y1 === undefined ? 3 : s.y1, z0: s.z0, z1: s.z1 }; if (resolve(B, box, null)) hit = true; } if (!hit) break; }
    }
    // bodies against bodies: the lighter one moves, both wake
    for (i = 0; i < bodies.length; i++) for (j = i + 1; j < bodies.length; j++) {
      var A = bodies[i], C = bodies[j]; if ((A.asleep && C.asleep) || (A.kinematic && C.kinematic)) continue;
      var mover = A.kinematic ? C : C.kinematic ? A : (A.mass <= C.mass ? A : C), fixed = mover === A ? C : A; if (resolve(mover, bodyBox(fixed), fixed)) { wake(mover); if (!fixed.kinematic) wake(fixed); }
    }
    // spheres roll: the mesh turns with the ground speed
    for (i = 0; i < bodies.length; i++) { var R = bodies[i]; if (R.shape !== 'sphere' || R.asleep) continue; var sp = Math.sqrt(R.vel.x * R.vel.x + R.vel.z * R.vel.z); if (sp > 0.01) { var ax = new THREE.Vector3(R.vel.z, 0, -R.vel.x).normalize(); R.obj.rotateOnWorldAxis(ax, sp * dt / Math.max(0.05, R.hx)); } }
    // sleep when still
    for (i = 0; i < bodies.length; i++) { var D = bodies[i]; if (D.kinematic || D.asleep || SPRINGS.some(function (s) { return s.B === D; })) continue; if (D.onGround && D.vel.lengthSq() < 0.0025) { D.still += dt; if (D.still > PHYS.sleepT) { D.asleep = true; D.vel.set(0, 0, 0); } } else D.still = 0; }
    PHYS.stepped++;
  }
  function physicsTick(dt) {
    if (!PHYS.on || (!PHYS.bodies.length && !HINGES.length) || (CO.game && CO.game.physics === false)) return;
    if (CO.physicsSolver && CO.physicsSolver.step) { CO.physicsSolver.step(PHYS.bodies, dt, PHYS); return; }
    var left = Math.min(dt, 0.1); while (left > 0) { var h = Math.min(PHYS.maxStep, left); physicsStep(h); left -= h; }
    PHYS.bodies.forEach(function (B) { if (B.obj.userData && B.obj.userData.dynamic === undefined) shadowDirty = true; });
  }
  animate(physicsTick);
  function physicsState() { return { on: PHYS.on && !(CO.game && CO.game.physics === false), g: PHYS.g, springs: SPRINGS.length, hinges: HINGES.map(function (H) { return { id: H.obj.userData && (H.obj.userData.propId || H.obj.userData.eid) || H.obj.name || null, angle: rnd(H.angle), length: H.length, axis: H.axis }; }), bodies: PHYS.bodies.map(function (B) { return { id: B.id, mass: B.mass, asleep: B.asleep, onGround: B.onGround, x: rnd(B.obj.position.x), y: rnd(B.obj.position.y), z: rnd(B.obj.position.z), vy: rnd(B.vel.y) }; }), stepped: PHYS.stepped, solver: CO.physicsSolver ? 'plugged' : 'built in' }; }
  // ── Clips ─────────────────────────────────────────────────────────
  // A clip: { duration, loop, tracks: [{ path, keys: [[t, value, ease]] }], events: [[t, name]] }. A path names a node and a field:
  // 'rotation.x' on the object itself, 'child.2.position.y' the third child, 'name.lamp.rotation.z' a named descendant, and on a
  // person 'leg.0', 'knee.1', 'arm.0', 'elbow.1', 'torso', 'head' (the rig's parts). Values are numbers; ease is 'linear', 'smooth',
  // 'in', 'out' or 'step'. Times are seconds.
  var CLIPS = {}, CLIP_ORDER = [], playing = [];
  CO.clip = function (name, clip) { if (!name) return CLIPS; if (clip === null) { delete CLIPS[name]; CLIP_ORDER.splice(CLIP_ORDER.indexOf(name), 1); return null; } clip = JSON.parse(JSON.stringify(clip || {})); clip.duration = clip.duration || clipLength(clip); if (!clip.tracks) clip.tracks = []; if (!CLIPS[name]) CLIP_ORDER.push(name); CLIPS[name] = clip; return clip; };
  function clipLength(c) { var d = 0; (c.tracks || []).forEach(function (t) { (t.keys || []).forEach(function (k) { d = Math.max(d, k[0]); }); }); (c.events || []).forEach(function (e) { d = Math.max(d, e[0]); }); return d || 1; }
  function easeV(k, f) { if (k === 'step') return 0; if (k === 'in') return f * f; if (k === 'out') return 1 - (1 - f) * (1 - f); if (k === 'linear') return f; return f * f * (3 - 2 * f); }
  function trackValue(keys, t) {
    if (!keys || !keys.length) return undefined; if (t <= keys[0][0]) return keys[0][1]; var last = keys[keys.length - 1]; if (t >= last[0]) return last[1];
    for (var i = 0; i < keys.length - 1; i++) { var a = keys[i], b = keys[i + 1]; if (t >= a[0] && t <= b[0]) { var f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * easeV(b[2] || 'smooth', f); } }
    return last[1];
  }
  // the node and field a path names, on an object (a person's parts come from the rig's userData)
  function clipTarget(obj, path) {
    var p = String(path).split('.'), node = obj, u = obj.userData || {}, i = 0;
    if (p[0] === 'child') { node = obj.children[+p[1]]; i = 2; }
    else if (p[0] === 'name') { node = obj.getObjectByName(p[1]); i = 2; }
    else if (p[0] === 'leg' && u.legs) { node = u.legs[+p[1]]; i = 2; }
    else if (p[0] === 'knee' && u.legs) { node = u.legs[+p[1]] && u.legs[+p[1]].userData.knee; i = 2; }
    else if (p[0] === 'arm' && u.arms) { node = u.arms[+p[1]]; i = 2; }
    else if (p[0] === 'elbow' && u.arms) { node = u.arms[+p[1]] && u.arms[+p[1]].userData.elbow; i = 2; }
    else if (p[0] === 'torso' && u.torso) { node = u.torso; i = 1; }
    else if (p[0] === 'head' && u.head) { node = u.head; i = 1; }
    if (!node) return null; var prop = p[i], axis = p[i + 1];
    if (prop === 'material') { var mm = node.material || (function () { var f = null; node.traverse(function (o) { if (!f && o.isMesh && o.material && !o.material.userData.shared) f = o.material; }); return f; })(); if (!mm) return null; if (axis === 'color' || axis === 'emissive') { var ch = p[i + 2]; if (!mm[axis] || 'rgb'.indexOf(ch) < 0) return null; return { node: node, set: function (v) { mm[axis][ch] = v; }, get: function () { return mm[axis][ch]; } }; } if (typeof mm[axis] !== 'number') return null; return { node: node, set: function (v) { mm[axis] = v; if (axis === 'opacity') mm.transparent = v < 1; }, get: function () { return mm[axis]; } }; }
    if (prop === 'visible' || prop === 'intensity' || prop === 'opacity') return { node: node, set: function (v) { if (prop === 'opacity' && node.material) { node.material.opacity = v; node.material.transparent = v < 1; } else node[prop] = prop === 'visible' ? v >= 0.5 : v; }, get: function () { return prop === 'opacity' && node.material ? node.material.opacity : (prop === 'visible' ? (node.visible ? 1 : 0) : node[prop]); } };
    if (!node[prop] || axis === undefined) return null;
    return { node: node, set: function (v) { node[prop][axis] = v; }, get: function () { return node[prop][axis]; } };
  }
  // play a clip on an object: it joins the playing list and the frame drives it; a second play on the same object replaces the first
  function playClip(obj, name, opt) {
    var clip = CLIPS[name]; if (!clip || !obj) return null; opt = opt || {};
    stopClip(obj);
    var tracks = clip.tracks.map(function (t) { var tg = clipTarget(obj, t.path); return tg ? { keys: t.keys, tg: tg, from: tg.get() } : null; }).filter(Boolean);
    var P = { obj: obj, name: name, clip: clip, t: 0, speed: opt.speed || 1, loop: opt.loop !== undefined ? !!opt.loop : !!clip.loop, blend: opt.blend === undefined ? 0.2 : +opt.blend, tracks: tracks, fired: {}, done: false, onDone: opt.onDone || null, hold: opt.hold !== false };
    playing.push(P); if (obj.userData) obj.userData.clip = P; return P;
  }
  function stopClip(obj) { for (var i = playing.length - 1; i >= 0; i--) if (playing[i].obj === obj) { playing[i].done = true; playing.splice(i, 1); } if (obj && obj.userData) obj.userData.clip = null; }
  function clipTick(dt) {
    for (var i = playing.length - 1; i >= 0; i--) {
      var P = playing[i], c = P.clip; P.t += dt * P.speed; var t = P.t, over = t >= c.duration;
      if (over) { if (P.loop) { t = P.t = c.duration ? P.t % c.duration : 0; P.fired = {}; } else t = c.duration; }
      var w = P.blend > 0 ? Math.min(1, P.t / P.blend) : 1;
      P.tracks.forEach(function (tr) { var v = trackValue(tr.keys, t); if (v === undefined) return; tr.tg.set(w < 1 ? tr.from + (v - tr.from) * w : v); });
      (c.events || []).forEach(function (e) { if (!P.fired[e[0] + ':' + e[1]] && t >= e[0]) { P.fired[e[0] + ':' + e[1]] = true; runHooks('clipEvent', P.obj, e[1], P); } });
      if (over && !P.loop) { P.done = true; playing.splice(i, 1); if (P.obj.userData) P.obj.userData.clip = null; if (!P.hold) P.tracks.forEach(function (tr) { tr.tg.set(tr.from); }); if (P.onDone) P.onDone(P); }
    }
  }
  animate(clipTick);
  // what the editor reads and writes
  function clipList() { return { order: CLIP_ORDER.slice(), clips: JSON.parse(JSON.stringify(CLIPS)), playing: playing.map(function (P) { return { name: P.name, t: Math.round(P.t * 100) / 100, loop: P.loop, obj: P.obj.userData && (P.obj.userData.propId || P.obj.userData.eid) || P.obj.name || null }; }) }; }
  function clipCode() {
    if (!CLIP_ORDER.length) return '';
    var lines = ['//@ the clips the editor saved: animation as data, played by the engine. Written by the Co Engine editor; it sorts first in src/ so a game can play them from its first frame. Edit them in the editor rather than here.'];
    CLIP_ORDER.forEach(function (n) { if (BUILTIN_CLIPS[n] && JSON.stringify(BUILTIN_CLIPS[n]) === JSON.stringify(CLIPS[n])) return; lines.push('  CO.clip(' + JSON.stringify(n) + ', ' + JSON.stringify(CLIPS[n]) + ');'); });
    if (lines.length === 1) return ''; lines.push(''); return lines.join('\n');
  }
  // a pose from the current transforms of the paths a clip names: a key at time t for every track
  function clipKeyPose(obj, name, t, ease) { var c = CLIPS[name]; if (!c) return null; var n = 0; c.tracks.forEach(function (tr) { var tg = clipTarget(obj, tr.path); if (!tg) return; var v = Math.round(tg.get() * 1000) / 1000, keys = tr.keys || (tr.keys = []), at = keys.findIndex(function (k) { return Math.abs(k[0] - t) < 1e-6; }); if (at >= 0) keys[at] = [t, v, ease || keys[at][2]]; else { keys.push([t, v, ease || 'smooth']); keys.sort(function (a, b) { return a[0] - b[0]; }); } n++; }); c.duration = Math.max(c.duration || 0, t); return n; }
  // the clips every game starts with: a person's gestures, and a few for props
  var BUILTIN_CLIPS = {
    wave: { duration: 1.6, loop: false, tracks: [{ path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.3, -2.6], [1.3, -2.6], [1.6, -0.2]] }, { path: 'elbow.1.rotation.x', keys: [[0, -0.15], [0.3, -0.6], [0.55, -1.2], [0.8, -0.5], [1.05, -1.2], [1.3, -0.6], [1.6, -0.15]] }, { path: 'arm.1.rotation.z', keys: [[0, -0.1], [0.3, -0.5], [1.3, -0.5], [1.6, -0.1]] }] },
    nod: { duration: 0.9, loop: false, tracks: [{ path: 'head.rotation.x', keys: [[0, 0], [0.25, 0.35], [0.5, -0.05], [0.7, 0.3], [0.9, 0]] }] },
    cheer: { duration: 1.4, loop: false, tracks: [{ path: 'arm.0.rotation.x', keys: [[0, -0.2], [0.35, -2.9], [1.0, -2.9], [1.4, -0.2]] }, { path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.35, -2.9], [1.0, -2.9], [1.4, -0.2]] }, { path: 'torso.position.y', keys: [[0, 0.86], [0.35, 0.92], [0.5, 0.86], [0.7, 0.92], [0.9, 0.86]] }] },
    point: { duration: 1.2, loop: false, tracks: [{ path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.3, -1.5], [1.0, -1.5], [1.2, -0.2]] }, { path: 'elbow.1.rotation.x', keys: [[0, -0.15], [0.3, -0.05], [1.0, -0.05], [1.2, -0.15]] }, { path: 'head.rotation.y', keys: [[0, 0], [0.3, -0.3], [1.0, -0.3], [1.2, 0]] }] },
    lift: { duration: 1.6, loop: false, tracks: [{ path: 'torso.position.y', keys: [[0, 0.86], [0.5, 0.62], [1.1, 0.62], [1.6, 0.86]] }, { path: 'knee.0.rotation.x', keys: [[0, 0], [0.5, 1.2], [1.1, 1.2], [1.6, 0]] }, { path: 'knee.1.rotation.x', keys: [[0, 0], [0.5, 1.2], [1.1, 1.2], [1.6, 0]] }, { path: 'leg.0.rotation.x', keys: [[0, 0], [0.5, -1.0], [1.1, -1.0], [1.6, 0]] }, { path: 'leg.1.rotation.x', keys: [[0, 0], [0.5, -1.0], [1.1, -1.0], [1.6, 0]] }, { path: 'arm.0.rotation.x', keys: [[0, -0.2], [0.5, -0.9], [1.1, -0.9], [1.6, -0.2]] }, { path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.5, -0.9], [1.1, -0.9], [1.6, -0.2]] }], events: [[1.1, 'lifted']] },
    spin: { duration: 2, loop: true, tracks: [{ path: 'rotation.y', keys: [[0, 0, 'linear'], [2, 6.2832, 'linear']] }] },
    bob: { duration: 1.5, loop: true, tracks: [{ path: 'position.y', keys: [[0, 0], [0.75, 0.25], [1.5, 0]] }] },
    swing: { duration: 2.4, loop: true, tracks: [{ path: 'rotation.z', keys: [[0, -0.35], [1.2, 0.35], [2.4, -0.35]] }] },
    blink: { duration: 0.8, loop: true, tracks: [{ path: 'visible', keys: [[0, 1, 'step'], [0.4, 0, 'step'], [0.8, 1, 'step']] }] }
  };
  Object.keys(BUILTIN_CLIPS).forEach(function (n) { CO.clip(n, BUILTIN_CLIPS[n]); });
  // ── Log / toast ───────────────────────────────────────────────────
  function logEvent(msg, kind) {
    if (S && S.log) { S.log.unshift({ day: S.day, t: fmtTime(S.time || 0), msg: msg, kind: kind || '' }); if (S.log.length > 60) S.log.pop(); }
    feedPush(msg, kind);
  }
  function feedPush(msg, kind) {
    var feed = $('h-feed'); if (!feed) return;
    var d = document.createElement('div'); d.className = kind || '';
    d.innerHTML = '<span class="t">' + fmtTime(S && S.time || 0) + '</span>' + msg;
    feed.appendChild(d);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 14000);
  }
  var TOAST_MS = 2600;
  function toast(msg, kind) {
    var box = $('h-toasts');
    if (box) { var d = document.createElement('div'); d.className = kind || ''; d.innerHTML = msg; box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, TOAST_MS); }
    if (kind === 'bad') sfx('bad'); else if (kind === 'rare') sfx('rare'); else sfx('ok');
  }
  // ── Sound ─────────────────────────────────────────────────────────
  var AC = null, sfxBus = null;
  function audio() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxBus = AC.createGain(); sfxBus.gain.value = SET && typeof SET.vol === 'number' ? SET.vol : 0.8; sfxBus.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); return AC; }
  // small synth helpers
  function sTone(type, f0, t, dur, gain, opts) { opts = opts || {}; var o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + dur); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(gain, t + (opts.attack || 0.008)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = opts.dest || sfxBus; if (opts.lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; gn.connect(f); f.connect(dest); } else gn.connect(dest); o.connect(gn); o.start(t); o.stop(t + dur + 0.05); }
  function sNoise(t, dur, gain, opts) { opts = opts || {}; var len = Math.floor(AC.sampleRate * dur); var buf = AC.createBuffer(1, len, AC.sampleRate); var d = buf.getChannelData(0); for (var i = 0; i < len; i++) { var env = opts.shape === 'swell' ? Math.sin(i / len * Math.PI) : opts.shape === 'flat' ? 1 : (1 - i / len); d[i] = (Math.random() * 2 - 1) * env; } var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = opts.type || 'highpass'; f.frequency.value = opts.freq || 4000; if (opts.q) f.Q.value = opts.q; var gn = AC.createGain(); gn.gain.setValueAtTime(gain, t); if (opts.fade) gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(gn); gn.connect(opts.dest || sfxBus); src.start(t); }
  function sThud(t, f, gain, dur) { sTone('sine', f, t, dur || 0.12, gain, { f1: f * 0.5 }); sNoise(t, 0.05, gain * 0.5, { type: 'lowpass', freq: 600 }); }
  function sBeep(t, f, dur, gain) { sTone('square', f, t, dur || 0.08, gain || 0.05, { lp: 3000 }); }
  // the base voices every game has; a game adds its own to SFX by assignment
  var SFX = {
    ok:      function (t) { sTone('sine', 520, t, 0.07, 0.07); sTone('sine', 780, t + 0.07, 0.1, 0.07); },
    bad:     function (t) { sTone('sawtooth', 220, t, 0.14, 0.05, { lp: 1200 }); sTone('sawtooth', 160, t + 0.12, 0.16, 0.05, { lp: 1000 }); },
    rare:    function (t) { [660, 880, 1320, 1760].forEach(function (f, i) { sTone('sine', f, t + i * 0.07, 0.16, 0.07); }); },
    click:   function (t) { sTone('sine', 900, t, 0.03, 0.06); sNoise(t, 0.02, 0.05, { freq: 5000 }); },
    cash:    function (t) { [1175, 1568, 2093, 2637].forEach(function (f, i) { sTone('sine', f, t + i * 0.045, 0.14, 0.06); }); sNoise(t, 0.12, 0.08, { freq: 7000, fade: true }); },
    pickup:  function (t) { sNoise(t, 0.05, 0.08, { type: 'lowpass', freq: 1800 }); sTone('sine', 300, t, 0.08, 0.05, { f1: 200 }); },
    putdown: function (t) { sThud(t, 180, 0.09, 0.12); sNoise(t, 0.04, 0.05, { type: 'lowpass', freq: 1500 }); },
    crate:   function (t) { sThud(t, 120, 0.14, 0.18); sNoise(t + 0.02, 0.1, 0.08, { type: 'lowpass', freq: 900, fade: true }); },
    step:    function (t, o) { var f = o === 'steel' ? 200 : o === 'outside' ? 110 : 130; sThud(t, f, 0.035, 0.07); if (o === 'steel') sNoise(t, 0.03, 0.03, { freq: 3000 }); if (o === 'outside') sNoise(t, 0.06, 0.04, { type: 'bandpass', freq: 1200, q: 0.5 }); },
    roller:  function (t) { for (var i = 0; i < 14; i++) { sNoise(t + i * 0.085, 0.07, 0.07, { type: 'lowpass', freq: 500 + (i % 2) * 300 }); sTone('square', 60 + (i % 3) * 8, t + i * 0.085, 0.08, 0.02, { lp: 300 }); } sThud(t + 1.25, 90, 0.1, 0.15); },
    door:    function (t) { sTone('sawtooth', 180, t, 0.35, 0.02, { f1: 260, lp: 700 }); sThud(t + 0.38, 220, 0.07, 0.08); sNoise(t + 0.38, 0.03, 0.06, { freq: 3000 }); },
    bell:    function (t) { sTone('sine', 2093, t, 0.6, 0.06); sTone('sine', 2637, t + 0.005, 0.5, 0.04); sTone('sine', 3136, t + 0.01, 0.4, 0.02); },
    chime:   function (t) { [523, 659, 784, 1047].forEach(function (f, i) { sTone('sine', f, t + i * 0.16, 0.6, 0.05); }); },
    lock:    function (t) { sThud(t, 400, 0.06, 0.05); sNoise(t + 0.05, 0.04, 0.08, { freq: 3500 }); sTone('sine', 1800, t + 0.1, 0.08, 0.03); },
    unlock:  function (t) { sNoise(t, 0.05, 0.08, { freq: 3000 }); sThud(t + 0.08, 300, 0.07, 0.06); },
    beep:    function (t) { sBeep(t, 2200, 0.06, 0.04); },
    levelup: function (t) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { sTone('triangle', f, t + i * 0.1, 0.4, 0.06); }); sNoise(t + 0.5, 0.4, 0.05, { freq: 6000, fade: true }); },
    fanfare: function (t) { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { sTone('triangle', f, t + i * 0.12, 0.3, 0.06); }); },
    sleep:   function (t) { [440, 392, 349, 330].forEach(function (f, i) { sTone('sine', f, t + i * 0.3, 0.5, 0.04); }); },
    glass:   function (t) { for (var i = 0; i < 8; i++) sTone('sine', 2400 + Math.random() * 2400, t + i * 0.03, 0.08, 0.03); sNoise(t, 0.2, 0.1, { freq: 5000, fade: true }); },
    thunder: function (t) { sNoise(t, 2.6, 0.5, { type: 'lowpass', freq: 220, shape: 'swell', fade: true }); sTone('sine', 45, t + 0.1, 2.0, 0.12, { f1: 28 }); sNoise(t + 0.6, 1.4, 0.2, { type: 'lowpass', freq: 400, fade: true }); }
  };
  var sfxCount = 0;
  function sfx(kind, opt) {
    if (SET && SET.sound === false) return;
    try { audio(); if (sfxBus && SET && typeof SET.vol === 'number') sfxBus.gain.value = SET.vol; var fn = SFX[kind] || SFX.click; fn(AC.currentTime, opt); sfxCount++; } catch (e) {}
  }
  // ── Settings (not part of the save: they belong to the machine) ───
  var SET_DEFAULTS = { sens: 1, invertY: false, quality: 'high', sound: true, vol: 0.8, fps: false, fov: 75, film: true, bob: true };
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); } catch (e) {} }
  function loadSettings() { try { var ss = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (ss) for (var sk in ss) if (sk in SET) SET[sk] = ss[sk]; } catch (e) {} return SET; }
  // ── The slot and the raw peek ─────────────────────────────────────
  // cfg.save is the save key prefix ('depotco'): the slot number lives at <prefix>-slot, the save at <prefix>-slot<n>, the
  // settings at <prefix>-settings unless cfg.settingsKey says otherwise. BOOT_SAVE is the raw save before anything is laid out,
  // so a game can size its world from it (a building stage) before it builds.
  function coSetupState(cfg) {
    var prefix = cfg.save || 'co-game';
    BOOT_SLOT = (function () { try { var q = /[?&]slot=(\d)/.exec(location.search); var sl = q ? +q[1] : +(localStorage.getItem(prefix + '-slot') || 1); return sl >= 1 && sl <= (cfg.slots || 3) ? sl : 1; } catch (e) { return 1; } })();
    var named = /[?&]save=([A-Za-z0-9_-]+)/.exec(location.search);   // ?save=<name>: a save of its own beside the slots, for development and for a reporter's file
    SAVE = named ? prefix + '-' + named[1] : prefix + '-slot' + BOOT_SLOT; SETTINGS_KEY = cfg.settingsKey || prefix + '-settings';
    BOOT_SAVE = (function () { try { var raw = localStorage.getItem(SAVE), s = raw ? JSON.parse(raw) : null; return s && typeof s === 'object' ? s : null; } catch (e) { return null; } })();
    SET = {}; for (var k in SET_DEFAULTS) SET[k] = SET_DEFAULTS[k]; if (cfg.settings) for (var k2 in cfg.settings) SET[k2] = cfg.settings[k2];
    loadSettings();
    CO.save = { prefix: prefix, key: SAVE, slot: BOOT_SLOT, named: named ? named[1] : null };
  }
  function setSlot(n) { try { localStorage.setItem(CO.save.prefix + '-slot', String(n)); } catch (e) {} }
  // ── Load and save ─────────────────────────────────────────────────
  // loadSave(fresh, migrate): S becomes the slot's save, with every top-level key the fresh state has and the save lacks filled in,
  // then the game's migrate(s, fresh, missing) run on it (missing[key] is true for each key that was filled in, so a migration can
  // tell an old save from a new field); or the fresh state when there is no save or it will not parse (the broken copy is kept
  // beside the slot). Returns true when a save was loaded.
  function loadSave(fresh, migrate) {
    var f = fresh(); S = f;
    try {
      var raw = localStorage.getItem(SAVE); if (!raw) return false;
      var s = JSON.parse(raw); if (!s || typeof s !== 'object') return false;
      var missing = {}; for (var k in f) if (!(k in s)) { s[k] = f[k]; missing[k] = true; }
      if (migrate) { var m = migrate(s, f, missing); if (m && typeof m === 'object') s = m; }
      S = s; return true;
    } catch (e) {
      try { if (typeof console !== 'undefined') console.error('co-engine: the save in ' + SAVE + ' could not be loaded', e); var brokenRaw = localStorage.getItem(SAVE); if (brokenRaw) localStorage.setItem(SAVE + '-broken', brokenRaw); } catch (e2) {}
      S = fresh(); return false;
    }
  }
  // save() writes the slot, or with cfg.saveDebounce (ms) schedules one write for a burst of calls; saveNow() writes at once (the unload)
  var saveT = 0, wiped = false, saveTimer = null;
  function writeSave() {
    if (wiped || !S) return;
    try { S.savedAt = now(); localStorage.setItem(SAVE, JSON.stringify(S)); saveT = now(); save.failed = false; }
    catch (e) { if (!save.failed) { save.failed = true; toast('The save could not be written: the browser refused the storage. Export it from the pause menu.', 'bad'); if (typeof console !== 'undefined') console.error('co-engine: save failed', e); } }   // said once, not at every autosave
  }
  function save() { var ms = CO.cfg && CO.cfg.saveDebounce; if (!ms) { writeSave(); return; } if (saveTimer) return; saveTimer = setTimeout(function () { saveTimer = null; writeSave(); }, ms); }
  function saveNow() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } writeSave(); }
  function wipe() { wiped = true; try { localStorage.removeItem(SAVE); } catch (e) {} }
  function exportSave() { return JSON.stringify(S); }
  // ── The ledger ────────────────────────────────────────────────────
  function pay(n, why) { S.bank = (S.bank || 0) + n; if (S.stats) { if (n >= 0) S.stats.earned = (S.stats.earned || 0) + n; else S.stats.spent = (S.stats.spent || 0) + -n; } if (S.ledger) { S.ledger.unshift({ day: S.day, t: fmtTime(S.time || 0), n: n, why: why }); if (S.ledger.length > 80) S.ledger.pop(); } hudDirty = true; }
  // ── The page contract ─────────────────────────────────────────────
  // The engine reads these elements when they exist and does nothing when they do not: dc-start, dc-start-btn, dc-start-stats,
  // dc-start-note (the start screen); dc-hud (the HUD box) with h-prompt, h-toasts, h-feed, h-fps, h-devlink, h-edit inside it;
  // dc-panel with dc-panel-title, dc-panel-tabs, dc-panel-body, dc-panel-close; dc-menu with .dc-menu-btns, dc-menu-body,
  // dc-menu-sub and buttons carrying data-menu; and any card element a game names in showCard.
  var ui = { started: false, menuOpen: false, panelOpen: false, scanOpen: false, rebuilding: false, testing: false, rebuildPending: false, suppressMenu: false,
    blocked: function () { return ui.menuOpen || ui.panelOpen || ui.rebuilding || !!(CO.game && CO.game.blocked && CO.game.blocked()); } };
  // ── HUD ───────────────────────────────────────────────────────────
  // the HUD redraws when something set hudDirty, or every quarter second; the game fills its own fields in CO.game.hud() and the 'hud' hooks
  var hudT = 0;
  // the aiming point: a dot with a dark ring in the middle of the view, made by the engine when the page has none of its own (Depot Co
  // draws a .dc-crosshair itself), shown while the player plays and hidden behind a panel, the menu or the scene camera
  var crossEl = null, crossShown = null;
  function crosshair() {
    if (crossEl === null) { crossEl = document.querySelector('[class*="crosshair"], #crosshair') ? false : null;   /* Depot's .dc-crosshair, Grow's .g3-crosshair: a page with its own keeps it */ if (crossEl === null) { var host = $('dc-hud') || document.body, d = document.createElement('div'); d.id = 'h-cross'; d.style.cssText = 'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,0.9);box-shadow:0 0 0 1.5px rgba(0,0,0,0.6),0 0 6px rgba(0,0,0,0.5);pointer-events:none;z-index:5'; host.appendChild(d); crossEl = d; } }
    if (!crossEl) return; var want = !!(ui.started && !ui.blocked() && !(photo.on && CO.game.photo !== false) && !(CO.game && CO.game.crosshair === false)); if (want !== crossShown) { crossShown = want; crossEl.style.display = want ? '' : 'none'; }
  }
  function updateHud(dt) {
    crosshair();
    hudT += dt; if (!hudDirty && hudT < 0.25) return; hudT = 0; hudDirty = false;
    if (S && !(CO.game && CO.game.hudFields === false)) { var d = $('h-day'); if (d && S.day !== undefined) d.textContent = 'Day ' + S.day + (isSunday() ? ' · Sunday' : ''); var c = $('h-clock'); if (c && S.time !== undefined) c.textContent = fmtTime(S.time); var b = $('h-cash'); if (b && S.bank !== undefined) { b.textContent = money(S.bank); b.style.color = S.bank < 0 ? 'var(--red)' : ''; } }
    if (CO.game && CO.game.hud) CO.game.hud(); uiHudFill(); runHooks('hud');
  }
  function updatePrompt() {
    var p = $('h-prompt'); if (!p) return;
    if (!focusText || (CO.game && CO.game.promptHidden && CO.game.promptHidden())) { p.hidden = true; return; }
    p.hidden = false; p.innerHTML = '<b>E</b>' + esc(focusText);
  }
  // ── Panels ────────────────────────────────────────────────────────
  // openPanel(kind, tab) shows the panel element; the game describes a kind in CO.game.panel(kind, tab) as { title, tabs: [[id, label]], body }.
  // The catalogue kind is the engine's. Buttons in a panel carry data-act and data-arg; the engine takes the catalogue's restore
  // and buy, the game takes the rest in CO.game.panelAct(act, arg). Tabs carry data-tab.
  var panel = { kind: null, tab: null };
  function openPanel(kind, tab) {
    panel.kind = kind; panel.tab = tab || null; ui.panelOpen = true; var el = $('dc-panel'); if (el) el.hidden = false; if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false);
    ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    renderPanel(); sfx('click');
  }
  function closePanel() { if (!ui.panelOpen) return; ui.panelOpen = false; var el = $('dc-panel'); if (el) el.hidden = true; panel.kind = null; hudDirty = true; lockPointer(); }
  function renderPanel() {
    if (!ui.panelOpen) return;
    var spec = panel.kind === 'catalogue' ? { title: 'Catalogue · build mode', tabs: [], body: catalogueHtml() } : (CO.game && CO.game.panel ? CO.game.panel(panel.kind, panel.tab) : null);
    if (!spec) spec = uiPanelSpec(panel.kind);   /* a panel the editor's UI tab described */
    if (!spec) spec = { title: panel.kind || '', tabs: [], body: '' };
    if (spec.tab && spec.tab !== panel.tab) panel.tab = spec.tab;
    var t = $('dc-panel-title'); if (t) t.textContent = spec.title || '';
    var tb = $('dc-panel-tabs'); if (tb) tb.innerHTML = (spec.tabs || []).map(function (tab) { return '<button class="' + (tab[0] === panel.tab ? 'on' : '') + '" data-tab="' + tab[0] + '">' + tab[1] + '</button>'; }).join('');
    var body = $('dc-panel-body'); if (body) body.innerHTML = spec.body || '';
  }
  function btn(act, arg, label, cls, disabled) { return '<button class="dc-btn small ' + (cls || '') + '" data-act="' + act + '" data-arg="' + esc(arg == null ? '' : arg) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function panelAct(act, arg) {
    if (panel.kind === 'catalogue' && act === 'restore') { editRestore(arg); renderPanel(); return true; }
    if (panel.kind === 'catalogue' && act === 'buy') { closePanel(); editBuy(arg); return true; }   // only the catalogue's: a game's shop has a buy of its own
    if (act === 'ui') return uiPanelAct(arg);
    if (CO.game && CO.game.panelAct && CO.game.panelAct(act, arg)) return true;
    runHooks('panelAct', act, arg); return false;
  }
  // the catalogue (C in build mode): removed props to bring back, and extras to buy, grouped as CO.game.catalogueGroups lists them
  function catalogueHtml() {
    var h = '<p>Build mode. Press <kbd>E</kbd> on a prop to carry it, <kbd>R</kbd> to turn it, <kbd>Backspace</kbd> to put it back where it started, <kbd>Del</kbd> to remove it. Bought extras sell back for half.</p>';
    var data = catalogueData(), where = function (id) { return CO.game && CO.game.propWhere ? CO.game.propWhere(id) : ''; }, open = function (d) { return CO.game && CO.game.propOpen ? CO.game.propOpen(d) : !(typeof d.lvl === 'number' && S && S.level !== undefined && S.level < d.lvl); };
    if (data.hidden.length) h += '<h3>Removed</h3><div class="dc-grid">' + data.hidden.map(function (id) { return '<div class="dc-card"><div class="body"><b>' + esc(PROPS[id].label) + '</b><small>' + esc(where(id)) + '</small></div>' + btn('restore', id, 'Bring back', 'primary') + '</div>'; }).join('') + '</div>';
    var groups = CO.game && CO.game.catalogueGroups ? CO.game.catalogueGroups : Object.keys(data.groups).map(function (k) { return [k, k.charAt(0).toUpperCase() + k.slice(1)]; });
    groups.forEach(function (gr) {
      var all = data.groups[gr[0]] || [], items = all.filter(function (id) { return open(PROPS[id]); });
      if (!items.length) { var lk = all.map(function (id) { return PROPS[id].lvl || 1; }); if (lk.length) h += '<h3>' + gr[1] + ' <small style="color:var(--muted);font-weight:normal">from level ' + Math.min.apply(null, lk) + '</small></h3>'; return; }
      h += '<h3>' + gr[1] + (gr[2] ? ' <small style="color:var(--muted);font-weight:normal">' + esc(typeof gr[2] === 'function' ? gr[2]() : gr[2]) + '</small>' : '') + '</h3><div class="dc-grid">' + items.map(function (id) { var d = PROPS[id]; return '<div class="dc-card"><div class="body"><b>' + (d.ico || '') + ' ' + esc(d.label) + '</b><small>' + esc(d.desc || '') + '</small></div><div style="text-align:right"><div class="price">' + (d.price ? money(d.price) : 'free') + '</div>' + btn('buy', id, 'Add', 'primary', !!(d.price && S && S.bank < d.price)) + '</div></div>'; }).join('') + '</div>';
    });
    return h;
  }
  // ── Pause menu ────────────────────────────────────────────────────
  function sessionFlag(name, v) { try { sessionStorage.setItem(CO.save.prefix + '-' + name, v || '1'); } catch (e) {} }
  function openMenu() {
    if (ui.menuOpen) return; ui.menuOpen = true; var m = $('dc-menu'); if (!m) return; m.hidden = false;
    var dl = $('dc-m-devlink'); if (dl) dl.textContent = devLink.on ? 'Unlink the editor' : 'Link the editor';
    var body = $('dc-menu-body'); if (body) body.hidden = true; var btns = m.querySelector('.dc-menu-btns'); if (btns) btns.hidden = false;
    if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    save(); var ms = $('dc-menu-sub'); if (ms) ms.textContent = (CO.game && CO.game.menuLine ? CO.game.menuLine() : (UI.menuLine ? uiEval(UI.menuLine) : 'The game waits until you come back.')) + ' ' + (saveT && !save.failed ? 'Saved at ' + new Date(saveT).toLocaleTimeString() + ', slot ' + BOOT_SLOT + '.' : 'The save could not be written: export it below.');
    runHooks('menuOpen');
  }
  function closeMenu() { if (!ui.menuOpen) return; ui.menuOpen = false; var m = $('dc-menu'); if (m) m.hidden = true; lockPointer(); }
  function menuBody(html) { var b = $('dc-menu-body'); if (!b) return; b.hidden = false; b.innerHTML = '<div class="dc-menu-row" style="margin:0 0 10px"><button data-menu="back" class="primary">← Back</button></div>' + html; var btns = $('dc-menu').querySelector('.dc-menu-btns'); if (btns) btns.hidden = true; }
  function menuAct(k, b) {
    sfx('click');
    if (k === 'resume') closeMenu();
    else if (k === 'back') { $('dc-menu-body').hidden = true; var btns = $('dc-menu').querySelector('.dc-menu-btns'); if (btns) btns.hidden = false; }
    else if (k === 'edit') { closeMenu(); if (!edit.on) editToggle(); }
    else if (k === 'devlink') { closeMenu(); devLinkToggle(); }
    else if (k === 'settings') menuBody(settingsHtml());
    else if (k === 'guide') menuBody('<div class="dc-how">' + (CO.game && CO.game.guideHtml ? CO.game.guideHtml() : (UI.guide ? uiTextHtml(UI.guide) : '<p>No guide yet.</p>')) + '</div>');
    else if (k === 'stats') menuBody(CO.game && CO.game.statsHtml ? CO.game.statsHtml() : '<p>No stats yet.</p>');
    else if (k === 'saves') menuBody('<p style="color:var(--muted)">This save as text. Copy it somewhere safe, or paste one in and load it.</p><textarea class="dc-ta" id="dc-save-ta">' + esc(JSON.stringify(S)) + '</textarea><div class="dc-menu-row"><button data-menu="download">⬇ Download .json</button><button data-menu="import" class="primary">Load what is pasted</button></div>');
    else if (k === 'download') { var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = CO.save.prefix + '-slot' + BOOT_SLOT + (S.day !== undefined ? '-day' + S.day : '') + '.json'; a.click(); }
    else if (k === 'import') { try { var s = JSON.parse($('dc-save-ta').value); if (!s || typeof s !== 'object' || (CO.game && CO.game.saveLooksRight && !CO.game.saveLooksRight(s))) throw new Error('not a save'); wiped = true; localStorage.setItem(SAVE, JSON.stringify(s)); sessionFlag('skip-splash'); sessionFlag('autoplay'); location.reload(); } catch (err) { toast('That is not a save of this game.', 'bad'); } }   // wiped: the unload autosave must not write the old game back over the import
    else if (k === 'reset') { if (b && b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'Really reset slot ' + BOOT_SLOT + '? Click again'; setTimeout(function () { b.removeAttribute('data-sure'); b.textContent = '⟲ Reset this save'; }, 3000); return; } wipe(); sessionFlag('skip-splash'); location.reload(); }
    else if (k === 'quit') { save(); sessionFlag('skip-splash'); location.reload(); }
    else if (CO.game && CO.game.menu) CO.game.menu(k, b);
  }
  // ── Settings ──────────────────────────────────────────────────────
  function settingsHtml() {
    return '<div class="dc-form">' +
      '<label><span>Mouse sensitivity</span><input type="range" min="0.3" max="2.5" step="0.1" value="' + SET.sens + '" data-set="sens"></label>' +
      '<label><span>Invert Y</span><input type="checkbox" ' + (SET.invertY ? 'checked' : '') + ' data-set="invertY"></label>' +
      '<label><span>Field of view</span><input type="range" min="60" max="100" step="1" value="' + SET.fov + '" data-set="fov"></label>' +
      '<label><span>Head bob while walking</span><input type="checkbox" ' + (SET.bob !== false ? 'checked' : '') + ' data-set="bob"></label>' +
      '<label><span>Quality</span><select data-set="quality"><option value="high"' + (SET.quality === 'high' ? ' selected' : '') + '>High</option><option value="medium"' + (SET.quality === 'medium' ? ' selected' : '') + '>Medium</option><option value="low"' + (SET.quality === 'low' ? ' selected' : '') + '>Low (no shadows)</option></select></label>' +
      '<label><span>Sound</span><input type="checkbox" ' + (SET.sound ? 'checked' : '') + ' data-set="sound"></label>' +
      '<label><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="' + SET.vol + '" data-set="vol"></label>' +
      '<label><span>Film look (vignette, grain)</span><input type="checkbox" ' + (SET.film !== false ? 'checked' : '') + ' data-set="film"></label>' +
      '<label><span>Show FPS (F3)</span><input type="checkbox" ' + (SET.fps ? 'checked' : '') + ' data-set="fps"></label>' +
      (CO.game && CO.game.settingsHtml ? CO.game.settingsHtml() : '') +
      '</div>';
  }
  function settingInput(el) {
    var k = el.getAttribute('data-set'); if (!k) return;
    var v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
    if (!(k in SET)) { if (CO.game && CO.game.setting) CO.game.setting(k, v); hudDirty = true; return; }
    SET[k] = v; saveSettings(); applySettings();
  }
  function applySettings() {
    if (!renderer) return;
    camera.fov = SET.fov; camera.updateProjectionMatrix(); post.on = SET.film !== false;
    var pr = SET.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : SET.quality === 'medium' ? 1 : 0.75;
    renderer.setPixelRatio(pr); renderer.shadowMap.enabled = SET.quality !== 'low'; if (sun) sun.castShadow = SET.quality !== 'low'; lightBudget.n = SET.quality === 'high' ? (CO.cfg.lightBudget || 16) : SET.quality === 'medium' ? 10 : 6;
    var big = CO.cfg && CO.cfg.sun && CO.cfg.sun.mapSize || 4096, sm = SET.quality === 'high' ? big : Math.min(big, 2048); if (sun && sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (sky.rain) { var rn = SET.quality === 'high' ? sky.rainN : SET.quality === 'medium' ? Math.round(sky.rainN * 0.64) : Math.round(sky.rainN * 0.36), snn = SET.quality === 'high' ? sky.snowN : SET.quality === 'medium' ? Math.round(sky.snowN * 0.66) : Math.round(sky.snowN * 0.4); CO.rainN = rn; CO.snowN = snn; sky.rain.geometry.setDrawRange(0, rn); sky.snow.geometry.setDrawRange(0, snn); }
    if (applySettings.q !== SET.quality) { applySettings.q = SET.quality; scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; }); }   // only a quality change recompiles the shaders
    shadowDirty = true; var f = $('h-fps'); if (f) f.hidden = !SET.fps; if (sfxBus) sfxBus.gain.value = SET.vol;
    runHooks('settings', SET);
  }
  function screenshot() {
    try { renderFrame(0.016); canvas.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (CO.save ? CO.save.prefix : 'co') + '-' + Date.now() + '.png'; a.click(); toast('Screenshot saved' + (/Electron/.test(navigator.userAgent) ? ' to Pictures' : ''), 'good'); }, 'image/png'); } catch (e) {}
  }
  // ── Cards: a timed overlay any key dismisses (a level card, a day report) ──
  var cards = {};
  function showCard(id, html, seconds) { var el = $(id); if (!el) return; el.innerHTML = html; el.hidden = false; cards[id] = seconds || 12; }
  function hideCard(id) { var el = $(id); if (el && !el.hidden) el.hidden = true; delete cards[id]; }
  function hideCards() { for (var id in cards) hideCard(id); }
  function tickCards(dt) { for (var id in cards) { cards[id] -= dt; if (cards[id] <= 0) hideCard(id); } }
  // ── Binding the page ──────────────────────────────────────────────
  function coSetupShell() {
    var pc = $('dc-panel-close'); if (pc) pc.addEventListener('click', closePanel);
    var pn = $('dc-panel'); if (pn) pn.addEventListener('click', function (e) { var tb = e.target.closest('[data-tab]'); if (tb) { panel.tab = tb.getAttribute('data-tab'); renderPanel(); sfx('click'); return; } var b = e.target.closest('[data-act]'); if (!b || b.disabled) return; panelAct(b.getAttribute('data-act'), b.getAttribute('data-arg')); });
    var mn = $('dc-menu'); if (mn) mn.addEventListener('click', function (e) { var b = e.target.closest('[data-menu]'); if (!b) return; menuAct(b.getAttribute('data-menu'), b); });
    var mb = $('dc-menu-body'); if (mb) mb.addEventListener('input', function (e) { settingInput(e.target); });
  }
  // ── Player ────────────────────────────────────────────────────────
  // player is the record the whole engine reads: x, y, z, yaw, pitch, the keys held, the tool carried. The game's hooks on CO.game:
  // playerOverride(dt) takes the frame (a vehicle, a seat) and returns true; speedMul() scales the walk; stepSurface(x, z) names the
  // step sound; collides(x, z) adds the game's own blockers; hitObjects() adds meshes to look at; hitDef(hit) resolves one of them;
  // useFallback() runs when E hits nothing; putDown() is G with nothing focused; mouseLook(e, sx, iy) takes the mouse; key(e)
  // takes a key before the engine's own bindings; escape() takes Esc first; wheel(dir) takes the wheel.
  var focusText = '';
  function coSetupPlayer(cfg) {
    var sp = cfg.spawn || { x: 0, z: 0 };
    player = { x: sp.x || 0, y: 0, z: sp.z || 0, yaw: sp.yaw === undefined ? 0 : sp.yaw, pitch: 0, vy: 0, grounded: true, keys: {}, locked: false, tool: null, stepT: 0, bob: 0, jumped: false };
    player.y = floorY(player.x, player.z);
    if (cfg.input === false) return player;   // the game binds its own keys, mouse and pointer lock
    canvas.addEventListener('click', function () { if (CO.editor && CO.editor.on) return; if (ui.started && !ui.blocked() && !player.locked) lockPointer(); });   // in the editor's viewport a click selects (60-editor)
    document.addEventListener('pointerlockchange', function () { player.locked = document.pointerLockElement === canvas; if (!player.locked) { player.keys = {}; if (ui.started && !ui.blocked() && !ui.suppressMenu && !ui.testing && !(CO.editor && CO.editor.on)) openMenu(); } ui.suppressMenu = false; });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('blur', function () { player.keys = {}; });
    return player;
  }
  function collides(x, z, opt) {
    var r = 0.32, y0 = player.y, y1 = player.y + 1.7;
    if (floorY(x, z, player.y) - player.y > 0.5) return true;
    for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && y0 < s.y1 && y1 > s.y0) return true; }
    for (var k = 0; k < dyn.length; k++) { var d = dyn[k]; if (d.skip && (opt === d.skip || (CO.game && CO.game.skipDyn && CO.game.skipDyn(d)))) continue; if (x > d.x0 - r && x < d.x1 + r && z > d.z0 - r && z < d.z1 + r && y0 < d.y1 && y1 > d.y0) return true; }
    if (CO.game && CO.game.collides && CO.game.collides(x, z, opt)) return true;
    return false;
  }
  function updatePlayer(dt) {
    if (CO.game && CO.game.playerOverride && CO.game.playerOverride(dt)) return;
    var k = player.keys, run = k.ShiftLeft || k.ShiftRight;
    var speed = 4.0 * (run ? 1.55 : 1) * (CO.game && CO.game.speedMul ? CO.game.speedMul() : 1);
    var fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    var mx = 0, mz = 0;
    if (fwd || side) {
      var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      mx = fx * fwd + rx * side; mz = fz * fwd + rz * side; var l = Math.sqrt(mx * mx + mz * mz); mx /= l; mz /= l;
      var nx = player.x + mx * speed * dt, nz = player.z + mz * speed * dt;
      if (!collides(nx, player.z)) player.x = nx;
      if (!collides(player.x, nz)) player.z = nz;
      player.stepT += speed * dt; player.bob += dt * (run ? 11 : 8);
      if (player.stepT > 2.1) { player.stepT = 0; sfx('step', CO.game && CO.game.stepSurface ? CO.game.stepSurface(player.x, player.z, player.y) : 'floor'); }
    } else player.bob *= Math.max(0, 1 - 8 * dt);
    var fy = floorY(player.x, player.z, player.y);
    if (k.Space && player.grounded && !player.jumped) { player.vy = 6.0; player.grounded = false; player.jumped = true; }
    if (!k.Space) player.jumped = false;
    player.vy -= 16 * dt; player.y += player.vy * dt;
    if (player.y <= fy) { if (!player.grounded && player.vy < -6) sfx('putdown'); player.y = fy; player.vy = 0; player.grounded = true; } else player.grounded = false;
    var bobY = SET.bob !== false && (fwd || side) && player.grounded ? Math.sin(player.bob) * 0.03 : 0;
    camera.position.set(player.x, player.y + 1.62 + bobY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }
  // ── Looking at things ─────────────────────────────────────────────
  function updateFocus() {
    if (CO.game && CO.game.focusOff && CO.game.focusOff()) return;   // the game keeps its own focus (Grow Co): leave it alone; clearing it here wiped the shop's aim every frame, so E and clicks found nothing
    focus = null; focusText = '';
    if (!ui.started || ui.blocked() || photo.on) return;
    ray.setFromCamera(centre, camera);
    if (edit.on && !(CO.game && CO.game.editMode === false)) {
      if (edit.grabbed) { if (edit.snapText) { focus = { prompt: function () { return edit.snapText; }, use: function () {} }; focusText = edit.snapText; } return; }
      ray.far = 7; var ph = ray.intersectObjects(scene.children, true); ray.far = 3.4;
      for (var q = 0; q < ph.length; q++) { var pid = propIdOf(ph[q].object); if (!pid) continue; if (ph[q].object.userData.baked || !ph[q].object.visible) continue; var pdef = propDef(pid); if (!pdef || pdef.fixed) continue; focus = { editId: pid, prompt: function () { return ''; }, use: function () {} }; focusText = 'Grab the ' + pdef.label + '  ·  R turn · Backspace put back · Del remove'; return; }
      return;
    }
    var extra = CO.game && CO.game.hitObjects ? CO.game.hitObjects() : [];
    var hits = ray.intersectObjects(extra.length ? inter.concat(extra) : inter, false);
    // a touch screen sits a few centimetres proud of its cabinet, whose hit box can reach past it: within 0.5 m the screen wins,
    // and the hit box of the screen's own prop never beats it at any range; the game may name other winners in hitPriority
    for (var si = 1; si < hits.length; si++) {
      var hs = hits[si], win = false;
      if (hs.object.userData.screen) { win = true; var spid = propIdOf(hs.object); for (var sj = 0; sj < si; sj++) { var ho = hits[sj].object; if (!(hs.distance - hits[sj].distance < 0.5 || (spid && ho.material === MAT.hit && propIdOf(ho) === spid))) { win = false; break; } } }
      else if (CO.game && CO.game.hitPriority && CO.game.hitPriority(hs, hits[0])) win = true;
      if (win) { hits.unshift(hits.splice(si, 1)[0]); break; }
    }
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], def = h.object.userData.it || (CO.game && CO.game.hitDef ? CO.game.hitDef(h) : null);
      if (!def) continue;
      if (def.prop === undefined) def.prop = propIdOf(h.object) || null;
      var txt = def.prompt(); if (!txt) continue;
      focus = def; focusText = txt; break;
    }
  }
  function useFocus() {
    if (edit.on && !(CO.game && CO.game.editMode === false)) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
    if (CO.game && CO.game.useOverride && CO.game.useOverride()) return;
    if (focus) { focus.use(); sfx('click'); updateFocus(); } else if (CO.game && CO.game.useFallback) CO.game.useFallback();
  }
  // ── Input ─────────────────────────────────────────────────────────
  function lockPointer() { if (!ui.started || ui.blocked() || ui.testing || (CO.editor && CO.editor.on)) return; try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  function onMouseMove(e) {
    if (!(player.locked || (CO.editor && CO.editor.drag)) || ui.blocked()) return;
    var sx = 0.0022 * SET.sens, iy = SET.invertY ? -1 : 1;
    if (photo.on) { photo.yaw -= e.movementX * sx; photo.pitch = clamp(photo.pitch - e.movementY * sx * iy, -1.5, 1.5); return; }
    if (CO.game && CO.game.mouseLook && CO.game.mouseLook(e, sx, iy)) return;
    player.yaw -= e.movementX * sx; player.pitch = clamp(player.pitch - e.movementY * sx * iy, -1.5, 1.5);
  }
  function onKeyDown(e) {
    if (e.code === 'F12') { e.preventDefault(); if (ui.started) screenshot(); return; }
    if (e.code === 'KeyD' && e.ctrlKey && e.shiftKey) { e.preventDefault(); devLinkToggle(); return; }
    if (e.code === 'F3') { e.preventDefault(); SET.fps = !SET.fps; var f = $('h-fps'); if (f) f.hidden = !SET.fps; saveSettings(); return; }
    var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (typing && e.code !== 'Escape') return;
    if (!ui.started) return;
    hideCards();
    if (e.code === 'F9') { e.preventDefault(); photoToggle(); return; }
    if (e.code === 'Escape') { e.preventDefault(); if (photo.on) { photoToggle(false); return; } if (CO.game && CO.game.escape && CO.game.escape()) return; if (edit.on && edit.grabbed) { editDrop(true); return; } if (ui.panelOpen) closePanel(); else if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); else if (ui.menuOpen) closeMenu(); else openMenu(); return; }
    if (ui.blocked()) return;
    if (photo.on) { player.keys[e.code] = true; return; }
    if (e.code === 'F2') { e.preventDefault(); if (editAllowed() && !(CO.game && CO.game.editBlocked && CO.game.editBlocked())) editToggle(); return; }
    if (edit.on && !(CO.game && CO.game.editMode === false)) {
      if (e.code === 'KeyR') { editRotate(); return; }
      if (e.code === 'Backspace') { e.preventDefault(); editReset(); return; }
      if (e.code === 'Delete') { editRemove(); return; }
      if (e.code === 'KeyC') { openPanel('catalogue'); return; }
      if (e.code === 'KeyE' && !e.repeat) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
      if (e.code === 'KeyG' && !e.repeat) { if (edit.grabbed) editDrop(true); return; }
    }
    if (CO.game && CO.game.key && CO.game.key(e)) return;
    player.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') useFocus();
    else if (e.code === 'KeyG') { if (focus && focus.alt) focus.alt(); else if (CO.game && CO.game.putDown) CO.game.putDown(); }
  }
  function screenUnderCrosshair() { for (var i = 0; i < screens.length; i++) { if (!screens[i].mesh.visible) continue; if (ray.intersectObject(screens[i].mesh, false).length) return screens[i]; } return null; }
  function onWheel(e) {
    var dir = e.deltaY > 0 ? 1 : -1;
    if (photo.on && ui.started && !ui.blocked()) { photoZoom(dir); return; }
    if (CO.game && CO.game.wheel && CO.game.wheel(dir, e)) return;
    if (ui.started && !ui.blocked()) { var ssc = screenUnderCrosshair(); if (ssc && ssc.scrollable) { ssc.scroll = clamp((ssc.scroll || 0) + dir, 0, ssc.scrollMax || 0); ssc.userScrollAt = worldTime; ssc.dirty = true; } }
  }
  // ── Photo mode ────────────────────────────────────────────────────
  // F9 lets go of the player: the camera flies free (WASD, Space up, C down, Shift fast, the mouse looks), the HUD goes, the world
  // holds still, and F12 takes the picture. F9 or Esc puts you back where you were standing.
  var photo = { on: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 6, fov: 75 };
  function photoToggle(on) {
    if (CO.game && CO.game.photo === false) return;   // the game has a photo mode of its own
    if (on === undefined) on = !photo.on; if (on === photo.on) return;
    if (on) {
      if (!ui.started || ui.blocked() || edit.on || (CO.game && CO.game.photoBlocked && CO.game.photoBlocked())) return;
      photo.on = true; photo.x = camera.position.x; photo.y = camera.position.y; photo.z = camera.position.z; photo.yaw = player.yaw; photo.pitch = player.pitch; photo.fov = SET.fov;
      if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); var hud = $('dc-hud'); if (hud) hud.hidden = true; player.keys = {}; sfx('beep'); runHooks('photo', true);
    } else { photo.on = false; var hud2 = $('dc-hud'); if (hud2) hud2.hidden = false; hudDirty = true; player.keys = {}; sfx('click'); camera.fov = SET.fov; camera.updateProjectionMatrix(); runHooks('photo', false); }
  }
  function photoZoom(dir) { if (!photo.on) return; photo.fov = clamp(photo.fov + dir * 4, 20, 110); camera.fov = photo.fov; camera.updateProjectionMatrix(); }
  function photoTick(dt) {
    var k = player.keys, sp = photo.speed * (k.ShiftLeft || k.ShiftRight ? 3 : 1) * dt;
    var cp = Math.cos(photo.pitch), fx = -Math.sin(photo.yaw) * cp, fy = Math.sin(photo.pitch), fz = -Math.cos(photo.yaw) * cp, rx = Math.cos(photo.yaw), rz = -Math.sin(photo.yaw);
    var f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), u = (k.Space ? 1 : 0) - (k.KeyC || (k.ControlLeft && !(CO.editor && CO.editor.on)) ? 1 : 0);   /* in the editor Ctrl selects and drags; C flies down */
    photo.x += (fx * f + rx * r) * sp; photo.y = clamp(photo.y + (fy * f + u) * sp, -1.0, 70); photo.z += (fz * f + rz * r) * sp;
    camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
  }
  // ── Seeded random ─────────────────────────────────────────────────
  // a thing's own dice: the same throw every time it is built, so a bought picture keeps its print and a tree its size through
  // every move, turn and reload. FNV-1a over the id and the throw number, mapped to [0, 1).
  function propSeed(id, k) { var s = String(id) + ':' + (k || 0), n = 2166136261; for (var i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619) >>> 0; } return (n % 100000) / 100000; }
  function seededF(id, k, a, b) { return a + propSeed(id, k) * (b - a); }
  function seededI(id, k, a, b) { return a + Math.floor(propSeed(id, k) * (b - a + 1)); }
  function seededPick(id, k, arr) { return arr[Math.floor(propSeed(id, k) * arr.length) % arr.length]; }
  // a small linear congruential stream for a run of throws from one seed (a tree's branches, a crowd's faces)
  function seededStream(seed) { var s = (typeof seed === 'number' ? seed : Math.floor(propSeed(seed, 0) * 2147483647)) >>> 0 || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  // succeeds if any of n tries at probability p does
  function unitRoll(p, n) { return 1 - Math.pow(1 - p, n || 1) > Math.random(); }
  // ── Colours ───────────────────────────────────────────────────────
  function mixHex(a, b, t) { var ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255, br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255; return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t); }
  function hexCss(n) { return '#' + ('000000' + (n & 0xffffff).toString(16)).slice(-6); }
  // ── Data ──────────────────────────────────────────────────────────
  // merge a list by id: replace the entry whose id matches, else append. For a pack or a DLC that adds to a game's tables.
  function mergeById(list, extra) { extra.forEach(function (e) { var i = -1; for (var k = 0; k < list.length; k++) if (list[k].id === e.id) { i = k; break; } if (i >= 0) list[i] = e; else list.push(e); }); return list; }
  function fmtKg(n) { return (n < 10 ? Math.round(n * 10) / 10 : Math.round(n)) + ' kg'; }
  function fmtAgo(sec) { return sec < 60 ? Math.round(sec) + 's ago' : sec < 3600 ? Math.round(sec / 60) + 'm ago' : Math.round(sec / 3600) + 'h ago'; }
  function fmtLeft(sec) { return sec >= 60 ? Math.ceil(sec / 60) + ' min' : Math.ceil(sec) + ' s'; }
  // ── UI as data ────────────────────────────────────────────────────
  // hud: [{ label, value, color }]           chips in a row of their own under the engine's (value is an expression: 'S.day', 'money(S.bank)')
  // panels: { kind: { title, text, buttons: [{ label, action, primary }] } }   openPanel(kind) shows it; text is paragraphs and '- ' lists; an action is a dev command ('cash 500') or an expression
  // start: ['expression', ...]               the start screen's chips    menuLine: 'expression'    guide: 'text'
  var UI = { hud: [], panels: {}, start: [], menuLine: '', guide: '' }, uiFns = {};
  CO.ui = function (data) { if (!data) return UI; if (data.hud) UI.hud = data.hud.slice(); if (data.panels) { UI.panels = {}; for (var k in data.panels) UI.panels[k] = data.panels[k]; } if (data.start) UI.start = data.start.slice(); if (data.menuLine !== undefined) UI.menuLine = data.menuLine; if (data.guide !== undefined) UI.guide = data.guide; uiFns = {}; hudDirty = true; uiHudBuild(); return UI; };
  function uiEval(expr) {
    if (expr === undefined || expr === null || expr === '') return '';
    var fn = uiFns[expr]; if (!fn) { try { fn = uiFns[expr] = new Function('K', 'with (K) { return (' + expr + '\n); }'); } catch (e) { return '?'; } }
    try { var v = fn(editorKit()); return v === undefined || v === null ? '' : String(v); } catch (e2) { return '?'; }
  }
  function uiAction(action) {
    if (!action) return false; var sp = String(action).indexOf(' '), name = sp < 0 ? action : action.slice(0, sp), arg = sp < 0 ? undefined : action.slice(sp + 1).trim();
    if (devCommandList().indexOf(name) >= 0) { if (arg !== undefined && arg !== '' && !isNaN(arg)) arg = +arg; var r = devCommand(name, arg); hudDirty = true; return r; }   /* the engine's dev commands and the game's */
    try { new Function('K', 'with (K) { ' + action + '\n }')(editorKit()); hudDirty = true; save(); return true; } catch (e) { toast('The button failed: ' + e.message, 'bad'); return false; }
  }
  // the HUD chips: a row of their own under the engine's top row, made once and filled on every HUD refresh
  function uiHudBuild() {
    var hud = $('dc-hud'); if (!hud) return null; var row = $('h-ui');
    if (!row) { row = document.createElement('div'); row.id = 'h-ui'; row.style.cssText = 'position:absolute;top:52px;left:12px;display:flex;gap:8px;flex-wrap:wrap;max-width:60vw;pointer-events:none;font:13px/1.3 inherit'; hud.appendChild(row); }
    row.innerHTML = UI.hud.map(function (f, i) { return '<span data-ui="' + i + '" style="background:rgba(5,8,12,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:5px 10px' + (f.color ? ';color:' + f.color : '') + '"><span style="opacity:.6;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px">' + esc(f.label || '') + '</span><b></b></span>'; }).join('');
    return row;
  }
  function uiHudFill() { if (!UI.hud.length) return; var row = $('h-ui') || uiHudBuild(); if (!row) return; var bs = row.querySelectorAll('b'); UI.hud.forEach(function (f, i) { if (bs[i]) bs[i].textContent = uiEval(f.value); }); }
  function uiTextHtml(text) { return String(text || '').split(/\n\s*\n/).map(function (para) { var lines = para.split('\n'); if (lines.every(function (l) { return /^\s*-\s/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + esc(l.replace(/^\s*-\s/, '')) + '</li>'; }).join('') + '</ul>'; return '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function uiPanelSpec(kind) { var p = UI.panels[kind]; if (!p) return null; return { title: uiEval(p.titleExpr) || p.title || kind, tabs: [], body: '<div class="dc-how">' + uiTextHtml(p.text) + '</div>' + (p.buttons && p.buttons.length ? '<div class="dc-menu-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' + p.buttons.map(function (b, i) { return '<button class="dc-btn ' + (b.primary ? 'primary' : '') + '" data-act="ui" data-arg="' + esc(kind + ':' + i) + '">' + esc(b.label || 'Button') + '</button>'; }).join('') + '</div>' : '') }; }
  function uiPanelAct(arg) { var at = String(arg || '').lastIndexOf(':'), kind = arg.slice(0, at), i = +arg.slice(at + 1), p = UI.panels[kind], b = p && p.buttons && p.buttons[i]; if (!b) return false; var r = uiAction(b.action); if (b.close) closePanel(); else renderPanel(); if (typeof r === 'string') toast(r, ''); return true; }
  function uiStartChips() { return UI.start.map(uiEval).filter(Boolean); }
  function uiData() { return JSON.parse(JSON.stringify(UI)); }
  function uiCode() {
    var empty = !UI.hud.length && !Object.keys(UI.panels).length && !UI.start.length && !UI.menuLine && !UI.guide; if (empty) return '';
    return '//@ the UI the editor saved: HUD chips, panels, the start screen chips, the pause line and the guide, as data over the kit. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.\n  CO.ui(' + JSON.stringify(UI, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
  // ── Tuning tables ─────────────────────────────────────────────────
  var TABLES = {}, TABLE_ORDER = [], TUNE = {};
  function pathGet(o, p) { var k = String(p).split('.'); for (var i = 0; i < k.length; i++) { if (o == null) return undefined; o = o[k[i]]; } return o; }
  function pathSet(o, p, v) { var k = String(p).split('.'); for (var i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) return false; o = o[k[i]]; } o[k[k.length - 1]] = v; return true; }
  // the leaves of a table worth editing: numbers, strings and booleans, by path, at most 400 of them
  function tableLeaves(obj) { var out = []; (function walk(o, pre, depth) { if (out.length >= 400 || depth > 5) return; Object.keys(o).forEach(function (k) { var v = o[k], p = pre ? pre + '.' + k : k; if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out.push({ path: p, value: v, type: typeof v }); else if (v && typeof v === 'object' && !v.isObject3D && !v.isMaterial && typeof v !== 'function') walk(v, p, depth + 1); }); })(obj, '', 0); return out; }
  CO.table = function (name, obj, desc) {
    if (!name) return TABLES; if (!obj || typeof obj !== 'object') return obj;
    if (!TABLES[name]) TABLE_ORDER.push(name);
    var defaults = {}; tableLeaves(obj).forEach(function (l) { defaults[l.path] = l.value; });
    TABLES[name] = { obj: obj, desc: desc || '', defaults: defaults };
    var t = TUNE[name]; if (t) for (var p in t) pathSet(obj, p, t[p]);
    return obj;
  };
  CO.tune = function (overrides) { for (var n in overrides) { TUNE[n] = TUNE[n] || {}; for (var p in overrides[n]) { TUNE[n][p] = overrides[n][p]; if (TABLES[n]) pathSet(TABLES[n].obj, p, overrides[n][p]); } } return TUNE; };
  function tablesList() { return TABLE_ORDER.map(function (n) { var T = TABLES[n]; return { name: n, desc: T.desc, fields: tableLeaves(T.obj).map(function (l) { return { path: l.path, value: l.value, type: l.type, changed: T.defaults[l.path] !== undefined && T.defaults[l.path] !== l.value, was: T.defaults[l.path] }; }) }; }); }
  function tableSet(name, path, value) {
    var T = TABLES[name]; if (!T) return { error: 'no table ' + name }; var was = pathGet(T.obj, path); if (was === undefined) return { error: 'no field ' + path + ' in ' + name };
    var v = typeof was === 'number' ? +value : typeof was === 'boolean' ? (value === true || value === 'true') : String(value); if (typeof was === 'number' && isNaN(v)) return { error: 'a number, please' };
    pathSet(T.obj, path, v); TUNE[name] = TUNE[name] || {}; if (T.defaults[path] === v) delete TUNE[name][path]; else TUNE[name][path] = v;
    hudDirty = true; screenDirtyAll();
    histPush(name + '.' + path, function () { pathSet(T.obj, path, was); if (T.defaults[path] === was) delete TUNE[name][path]; else TUNE[name][path] = was; hudDirty = true; screenDirtyAll(); }, function () { pathSet(T.obj, path, v); if (T.defaults[path] === v) delete TUNE[name][path]; else TUNE[name][path] = v; hudDirty = true; screenDirtyAll(); });
    return { ok: true, value: v };
  }
  function tablesCode() {
    var out = {}, any = false; for (var n in TUNE) { var keys = Object.keys(TUNE[n]); if (keys.length) { out[n] = TUNE[n]; any = true; } }
    if (!any) return '';
    return '//@ the tuning the editor saved: changes to the game\'s tables (prices, the economy, the ladder) over what the code says. Written by the Co Engine editor\'s Settings tab; it sorts first in src/ and applies as each table registers.\n  CO.tune(' + JSON.stringify(out, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
  // ── The dev link ──────────────────────────────────────────────────
  // The editor (and the dev console) run a local server on 127.0.0.1:8432. The game links to it with Ctrl+Shift+D, when started
  // with ?dev=1, or, in the desktop app, by itself: every five seconds while unlinked it asks the port once and links when
  // something answers. While linked it posts a readout once a second and takes commands over a server-sent event stream; every
  // command goes through devCommand, the same code the tests call. The HUD element h-devlink shows LINKED.
  var DEV_PORT = 8432, devLink = { on: false, es: null, t: 0, sent: 0, got: 0, fails: 0, last: '', manualOff: false, probeT: 0 };
  var DEV_AUTO = /Electron/i.test(navigator.userAgent);
  function devProbe() {
    try { var opt = { mode: 'cors', cache: 'no-store' }; if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opt.signal = AbortSignal.timeout(800);
      fetch('http://127.0.0.1:' + DEV_PORT + '/state', opt).then(function (r) { if (r.ok && !devLink.on && !devLink.manualOff) devLinkToggle(); }).catch(function () {}); } catch (e) {}
  }
  // the readout: the engine's fields, then whatever the game adds in CO.game.devState()
  function devState() {
    var st = { version: CO.gameVersion || 'dev', engine: CO.version, day: S && S.day, time: S ? Math.round((S.time || 0) * 100) / 100 : 0, clock: fmtTime(S && S.time || 0), bank: S && S.bank, level: S && S.level, weather: S && S.weather ? S.weather.kind : 'clear', player: player ? { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 } : null, commands: devCommandList() };
    if (CO.game && CO.game.devState) { var extra = CO.game.devState(); for (var k in extra) st[k] = extra[k]; }
    return st;
  }
  // the commands: the engine's base set, and the game's in CO.game.commands as { name: function (arg) { return 'what happened'; } }
  var DEV_COMMANDS = {
    cash: function (n) { pay(typeof n === 'number' ? n : 1000, 'Dev console'); return 'bank ' + money(S.bank); },
    setTime: function (h) { if (typeof h === 'number') { S.time = ((h % 24) + 24) % 24; hudDirty = true; return 'time ' + fmtTime(S.time); } return 'setTime needs an hour'; },
    saveNow: function () { save(); return 'saved to ' + SAVE; },
    reload: function () { save(); setTimeout(function () { location.reload(); }, 200); return 'reloading'; },
    tp: function (arg) { if (!player) return 'no player'; var m = /^(-?[\d.]+)[ ,]+(-?[\d.]+)$/.exec(String(arg || '')); if (!m) return 'tp needs "x, z"'; player.x = +m[1]; player.z = +m[2]; player.y = floorY(player.x, player.z); return 'at ' + player.x + ', ' + player.z; },
    lanes: function (arg) { return roadDebug(arg === 'on' ? true : arg === 'off' ? false : undefined); },
    weather: function (kind) { if (!S.weather) S.weather = { wet: 0, snow: 0, wind: 0.4 }; S.weather.kind = kind || 'clear'; S.weather.until = nowAbs() + 6; return 'weather ' + S.weather.kind; }
  };
  function devCommandList() { var out = Object.keys(DEV_COMMANDS); if (CO.game && CO.game.commands) for (var k in CO.game.commands) if (out.indexOf(k) < 0) out.push(k); return out; }
  function devCommand(name, arg) {
    var fn = (CO.game && CO.game.commands && CO.game.commands[name]) || DEV_COMMANDS[name];
    if (!fn) return 'unknown command ' + name;
    try { var r = fn(arg); hudDirty = true; return r === undefined ? 'ok' : String(r); } catch (e) { return 'error: ' + (e && e.message || e); }
  }
  function devLinkBadge() { var b = $('h-devlink'); if (!b) return; b.hidden = !devLink.on; b.textContent = devLink.on ? (devLink.es && devLink.es.readyState === 1 ? 'LINKED · editor' : 'LINKING...') : ''; }
  function devLinkToggle() {
    if (devLink.on) { devLink.manualOff = true; devLinkStop('Editor unlinked. Ctrl+Shift+D links again.'); return; }
    devLink.manualOff = false;
    if (typeof EventSource === 'undefined') { toast('No EventSource in this browser: the editor cannot link.', 'bad'); return; }
    devLink.on = true; devLink.fails = 0;
    try { var es = new EventSource('http://127.0.0.1:' + DEV_PORT + '/events'); devLink.es = es;
      es.onopen = function () { devLink.fails = 0; devLinkBadge(); toast('Editor linked', 'good'); };
      es.onmessage = function (ev) { var cmd; try { cmd = JSON.parse(ev.data); } catch (e) { return; } if (!cmd || !cmd.name) return; devLink.got++; var res = devCommand(cmd.name, cmd.arg); devLink.last = cmd.name + ': ' + res; devPost('/result', { id: cmd.id, name: cmd.name, result: res }); };
      es.onerror = function () { devLink.fails++; devLinkBadge(); if (devLink.fails === 1) toast('Nothing answering on 127.0.0.1:' + DEV_PORT + '. Open the editor; the game keeps trying.', ''); if (devLink.fails > 30) devLinkStop('Editor link: gave up after 30 tries'); };
    } catch (e) { devLinkStop('Editor link: could not open'); return; }
    devLinkBadge(); logEvent('Editor link opened. Ctrl+Shift+D unlinks.');
  }
  function devLinkStop(why) { if (devLink.es) { try { devLink.es.close(); } catch (e) {} } devLink.es = null; devLink.on = false; devLinkBadge(); if (why) toast(why, ''); }
  function devPost(path, body) { try { fetch('http://127.0.0.1:' + DEV_PORT + path, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(function () { devLink.sent++; }).catch(function () {}); } catch (e) {} }
  function tickDevLink(dt) {
    if (!devLink.on) { if (!DEV_AUTO || devLink.manualOff || ui.testing) return; devLink.probeT += dt; if (devLink.probeT < 5) return; devLink.probeT = 0; devProbe(); return; }
    devLink.t += dt; if (devLink.t < 1) return; devLink.t = 0; if (devLink.es && devLink.es.readyState === 1) devPost('/state', devState());
  }
  // ── The editor bridge ─────────────────────────────────────────────
  // The editor shows the running game in its viewport and talks to it through this object (executeJavaScript into the page, or the
  // dev link). Everything here reads or writes the live scene and the save; nothing runs unless the editor asks. Objects are named
  // by id: a prop by its prop id, anything else by an editor id stamped on userData the first time it is listed.
  var EOBJ = {}, eidN = 0, editorSel = null, editorHelper = null, eRay = new THREE.Raycaster(), editorMulti = [], editorHelpers2 = [], groupDrag = null, pendingOff = null;   // editorSel is the last of editorMulti, the things selected together
  // a game that builds its props itself (Grow Co) names its builder in GAME.buildProp; the bridge rebuilds through it
  function rebuildProp(id) { return CO.game && CO.game.buildProp ? CO.game.buildProp(id) : buildProp(id); }
  function eid(o) { if (!o.userData.eid) o.userData.eid = 'e' + (++eidN); EOBJ[o.userData.eid] = o; return o.userData.eid; }
  function isPropRoot(o) { return !!(o.userData.propId && propInst[o.userData.propId] && propInst[o.userData.propId].g === o); }
  function eobj(id) {
    if (propInst[id]) return propInst[id].g;
    var o = EOBJ[id]; if (o && o.parent) return o;
    var found = null; scene.traverse(function (x) { if (!found && x.userData && x.userData.eid === id) found = x; }); if (found) EOBJ[id] = found; return found;
  }
  function matName(m) { if (!m) return ''; for (var k in MAT) if (MAT[k] === m) return k; return m.name || ''; }
  function eName(o) {
    if (isPropRoot(o)) return propLabel(o.userData.propId);
    if (o.name) return o.name;
    if (o.isDirectionalLight) return 'sun'; if (o.isHemisphereLight) return 'sky bounce'; if (o.isSpotLight) return 'spot light'; if (o.isPointLight) return 'point light';
    if (o.userData.legs) return 'person' + (o.userData.name ? ' · ' + o.userData.name : '');
    if (o.userData.screen) return 'screen' + (o.userData.screen.title ? ' · ' + o.userData.screen.title : '');
    if (o.isSprite) return 'sprite'; if (o.isPoints) return 'points';
    if (o.isMesh) { var mn = matName(o.material); return mn ? 'mesh · ' + mn : 'mesh'; }
    if (o.isGroup) return o.userData.dynamic ? 'group (dynamic)' : 'group';
    return o.type;
  }
  function eType(o) { return isPropRoot(o) ? 'prop' : o.isLight ? 'light' : o.isMesh ? 'mesh' : o.isSprite ? 'sprite' : o.isPoints ? 'points' : o.isGroup ? 'group' : o.type; }
  function eNode(o) { return { id: isPropRoot(o) ? o.userData.propId : eid(o), name: eName(o), type: eType(o), n: o.children.length, vis: o.visible !== false }; }
  function rnd(v) { return Math.round(v * 1000) / 1000; }
  // the scene as the hierarchy panel shows it: the props by category, the lights, the people, the doors, the screens, the vehicles,
  // whatever else stands at the top, and the static world as a count. A game adds its own branches in CO.game.editorTree(eid).
  function editorTree() {
    var props = {}, lights = [], people = [], screensL = [], doors = [], vehicles = [], other = [], baked = 0, statics = 0;
    for (var id in propInst) { var d = propInst[id].def || propDef(id) || {}; (props[d.cat || 'other'] = props[d.cat || 'other'] || []).push({ id: id, name: propLabel(id), type: 'prop', custom: !!customById(id), n: propInst[id].g.children.length, from: customById(id) ? 'save' : placedById(id) && !PROPS[id] ? 'layout' : (LAYOUT.props[id] ? 'definition, moved in the layout' : 'definition'), pack: !!(d.id && /^pk[A-Z]/.test(d.id)) }); }
    var roots = CO.root && CO.root !== scene ? [scene, CO.root] : [scene];
    roots.forEach(function (r) { r.children.forEach(function (o) {
      if (o === CO.root || o.userData.editor || isPropRoot(o) || o.userData.worldKey) return;
      if (o.isLight) { lights.push(eNode(o)); return; }
      if (o.userData.legs || o.userData.person) { people.push(eNode(o)); return; }
      if (o.userData.baked) { baked++; return; }
      if (o.isMesh && !o.userData.dynamic) { statics++; return; }
      if (o === editorHelper) return;
      other.push(eNode(o));
    }); });
    hdoors.forEach(function (d) { var s = hd(d.id); doors.push({ id: eid(d.g), name: d.label || d.id, type: 'door', open: !!s.open, locked: !!s.locked }); });
    screens.forEach(function (sc) { screensL.push({ id: eid(sc.mesh), name: sc.title || 'screen', type: 'screen' }); });
    if (traffic && traffic.cars) traffic.cars.forEach(function (c, i) { vehicles.push({ id: eid(c.g), name: 'car ' + (i + 1), type: 'vehicle' }); });
    var extra = null; try { extra = CO.game && CO.game.editorTree ? CO.game.editorTree(eid) : null; } catch (e) { extra = { error: String(e && e.message || e) }; }
    var worldL = WORLD_ITEMS.filter(function (o) { return o.parent; }).map(function (o) { return { id: eid(o), name: worldName(o), type: 'world', n: o.children.length, vis: o.visible !== false, edited: !!WORLD_EDITS[o.userData.worldKey] }; });
    return { props: props, lights: lights, people: people, doors: doors, screens: screensL, vehicles: vehicles, other: other, world: worldL, selection: editorMulti.slice(), counts: { baked: baked, statics: statics, inter: inter.length, solids: solids.length, dyn: dyn.length }, extra: extra, time: S ? { day: S.day, time: S.time } : null, selected: editorSel, paused: !!CO.paused, scene: !!photo.on, started: !!ui.started, engine: CO.version, game: CO.gameVersion };
  }
  function editorChildren(id) { var o = eobj(id); if (!o) return []; return o.children.filter(function (c) { return !c.userData.editor; }).map(eNode); }
  // the inspector record: the transform, the material or the light, the prop's definition and placement, and what the game adds
  function editorInspect(id) {
    var o = eobj(id); if (!o) return null;
    var w = new THREE.Vector3(); o.getWorldPosition(w);
    var r = { id: id, name: eName(o), type: eType(o), position: [rnd(o.position.x), rnd(o.position.y), rnd(o.position.z)], rotation: [rnd(o.rotation.x * 180 / Math.PI), rnd(o.rotation.y * 180 / Math.PI), rnd(o.rotation.z * 180 / Math.PI)], scale: [rnd(o.scale.x), rnd(o.scale.y), rnd(o.scale.z)], world: [rnd(w.x), rnd(w.y), rnd(w.z)], visible: o.visible !== false, children: o.children.length, parent: o.parent && o.parent !== scene && o.parent !== CO.root ? eName(o.parent) : null, dynamic: !!o.userData.dynamic, baked: !!o.userData.baked };
    if (o.isMesh && o.material && !Array.isArray(o.material)) { var m = o.material; r.material = { key: matName(m), type: m.type, color: m.color ? '#' + m.color.getHexString() : null, emissive: m.emissive ? '#' + m.emissive.getHexString() : null, emissiveIntensity: m.emissiveIntensity === undefined ? null : rnd(m.emissiveIntensity), roughness: m.roughness === undefined ? null : rnd(m.roughness), metalness: m.metalness === undefined ? null : rnd(m.metalness), opacity: rnd(m.opacity), transparent: !!m.transparent, map: !!m.map, shared: !!matName(m) }; }
    if (o.isMesh && o.geometry && o.geometry.parameters) r.geometry = { type: o.geometry.type, params: o.geometry.parameters };
    if (o.isLight) r.light = { type: o.type, color: '#' + o.color.getHexString(), intensity: rnd(o.intensity), distance: o.distance === undefined ? null : o.distance, decay: o.decay === undefined ? null : o.decay, shadow: !!o.castShadow };
    if (propInst[id]) { var inst = propInst[id], def = inst.def || propDef(id) || {}, P = propPlacement(id), c = customById(id); r.prop = { id: id, type: c ? c.type : (placedById(id) ? placedById(id).type : id), label: def.label, cat: def.cat || null, custom: !!c, fixed: !!def.fixed, wall: !!def.wall, extra: !!def.extra, price: def.price || 0, lvl: def.lvl || null, desc: def.desc || '', x: rnd(P.x), z: rnd(P.z), rot: P.rot, h: rnd(P.h || 0), hidden: !!P.hidden, moved: !!(S && S.layout && S.layout[id]), obstacles: inst.ctx.obstacles.length }; }
    if (o.userData.worldKey) { r.worldItem = { key: o.userData.worldKey, kind: worldKind(o), edited: !!WORLD_EDITS[o.userData.worldKey], solids: (o.userData.solids || []).length }; r.name = worldName(o); r.type = 'world'; }
    if (editorMulti.length > 1 && editorMulti.indexOf(id) >= 0) r.together = editorMulti.length;
    if (o.userData.screen) r.screen = { title: o.userData.screen.title || '', w: o.userData.screen.w, h: o.userData.screen.h, zones: o.userData.screen.zones.length };
    try { var g = CO.game && CO.game.editorInspect ? CO.game.editorInspect(id, o) : null; if (g) r.game = g; } catch (e) { r.game = { error: String(e && e.message || e) }; }
    return r;
  }
  // a live edit: a prop's placement (kept in the save, rebuilt), or an object's transform, visibility, material or light (not kept)
  function editorApply(id, path, value) {
    var p = String(path).split('.'), v = value;
    if (p[0] === 'prop') {
      if (!PROPS[id] && !customById(id) && !placedById(id)) return id + ' is not a prop';   /* a copy the layout ships counts too */
      var P = propPlacement(id); if (!S.layout) S.layout = {}; var L = S.layout[id] = S.layout[id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 };
      if (p[1] === 'hidden') { L.hidden = !!(v && v !== 'false'); } else if (p[1] === 'reset') { delete S.layout[id]; } else if (p[1] === 'rot') L.rot = ((Math.round(+v) % 4) + 4) % 4; else if (p[1] === 'xz') { L.x = +v[0]; L.z = +v[1]; } else L[p[1]] = +v;
      rebuildProp(id); save(); editorSelect(propInst[id] ? id : null); return 'ok';
    }
    var o = eobj(id); if (!o) return 'no such object ' + id;
    var isWorld = !!(o.userData && o.userData.worldKey);
    if (isWorld && o.userData.movesOnly && (p[0] === 'rotation' || p[0] === 'scale')) return worldName(o) + ' moves but does not turn or resize: the rules of the game are built around its shape'; if (isWorld && (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale' || p[0] === 'visible' || p[0] === 'world') && baked.meshes.length) unbakeStatic();
    if (p[0] === 'world' && p[1] === 'reset' && isWorld) { var b0 = o.userData.worldBase; o.position.set(b0.x, b0.y, b0.z); o.rotation.y = b0.ry; o.scale.set(b0.sx, b0.sy, b0.sz); o.visible = true; o.updateMatrixWorld(true); worldRecord(o); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale') { o[p[0]][p[1]] = p[0] === 'rotation' ? (+v) * Math.PI / 180 : +v; o.updateMatrixWorld(true); if (isWorld) worldRecord(o); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'visible') { o.visible = !!v && v !== 'false'; if (isWorld) worldRecord(o); shadowDirty = true; return 'ok'; }
    if (p[0] === 'material') { var m = o.material; if (!m) return 'no material'; if (p[1] === 'color' || p[1] === 'emissive') { if (!m[p[1]]) return 'no ' + p[1]; m[p[1]].set(String(v)); } else m[p[1]] = +v; m.needsUpdate = true; return 'ok'; }
    if (p[0] === 'light') { if (!o.isLight) return 'not a light'; if (p[1] === 'color') o.color.set(String(v)); else o[p[1]] = +v; return 'ok'; }
    if (p[0] === 'name') { o.name = String(v); return 'ok'; }
    return 'unknown path ' + path;
  }
  function editorSelect(id, add) {
    var o = id ? eobj(id) : null, nid = o ? (propInst[id] ? id : eid(o)) : null;
    if (add && nid) { var at = editorMulti.indexOf(nid); if (at >= 0) { editorMulti.splice(at, 1); nid = null; } else editorMulti.push(nid); }
    else editorMulti = nid ? [nid] : [];
    editorMulti = editorMulti.filter(function (k) { return !!eobj(k); });
    editorSel = nid || editorMulti[editorMulti.length - 1] || null;
    editorHelpersShow();
    return editorSel ? editorInspect(editorSel) : null;
  }
  function editorHelpersShow() {
    if (editorHelper) { scene.remove(editorHelper); editorHelper.geometry.dispose(); editorHelper = null; }
    editorHelpers2.forEach(function (h) { scene.remove(h); h.geometry.dispose(); }); editorHelpers2 = [];
    editorMulti.forEach(function (k) { var o = eobj(k); if (!o) return; var hb = new THREE.BoxHelper(o, k === editorSel ? 0xf5b53d : 0x5aa9ff); hb.userData.editor = true; hb.userData.noBake = true; hb.material.depthTest = false; hb.renderOrder = 9; scene.add(hb); if (k === editorSel) editorHelper = hb; else editorHelpers2.push(hb); });
  }
  function editorHelpersUpdate() { if (editorHelper) editorHelper.update(); editorHelpers2.forEach(function (h) { h.update(); }); }
  // what can be dragged: a prop that is not fixed, a world item
  // ── the selection box ──
  var boxSel = null;
  function boxSelStart(e) {
    var el = document.createElement('div'); el.style.cssText = 'position:fixed;z-index:50;border:1px dashed #f5b53d;background:rgba(245,181,61,0.08);pointer-events:none;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:0;height:0';
    document.body.appendChild(el); boxSel = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.ctrlKey || e.metaKey, el: el };
  }
  function boxSelMove(e) { var B = boxSel; B.x1 = e.clientX; B.y1 = e.clientY; var l = Math.min(B.x0, B.x1), t = Math.min(B.y0, B.y1); B.el.style.left = l + 'px'; B.el.style.top = t + 'px'; B.el.style.width = Math.abs(B.x1 - B.x0) + 'px'; B.el.style.height = Math.abs(B.y1 - B.y0) + 'px'; }
  // what stands inside the box on the screen: the four corners of its footprint on the ground project into it (a roof or a sign that
  // leans out in the picture does not count against it; the ground and the road, far bigger than any box, never fit)
  function boxSelEnd(e) {
    var B = boxSel; boxSel = null; if (B.el.parentNode) B.el.parentNode.removeChild(B.el);
    var l = Math.min(B.x0, e.clientX), r = Math.max(B.x0, e.clientX), t = Math.min(B.y0, e.clientY), b = Math.max(B.y0, e.clientY);
    if (r - l < 4 && b - t < 4) { if (!B.add) editorSelect(null); return; }
    var rc = canvas.getBoundingClientRect(), v = new THREE.Vector3(), bb = new THREE.Box3(), found = [];
    scene.updateMatrixWorld(true);
    var inside = function (o) { bb.setFromObject(o); if (bb.isEmpty()) return false; for (var k = 0; k < 4; k++) { v.set(k & 1 ? bb.max.x : bb.min.x, bb.min.y, k & 2 ? bb.max.z : bb.min.z).project(camera); if (v.z > 1) return false; var sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height; if (sx < l || sx > r || sy < t || sy > b) return false; } return true; };
    for (var id in propInst) if (propInst[id].g.visible !== false && inside(propInst[id].g)) found.push(id);
    WORLD_ITEMS.forEach(function (o) { if (o.parent && o.visible && inside(o)) found.push(eid(o)); });
    if (!B.add) editorMulti = []; found.forEach(function (k) { if (editorMulti.indexOf(k) < 0) editorMulti.push(k); });
    editorSel = editorMulti[editorMulti.length - 1] || null; editorHelpersShow();
    console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), boxed: found.length }));
  }
  function editorMovable(id) { if (propInst[id]) { var d = propDef(id); return !(d && d.fixed); } var o = eobj(id); return !!(o && o.userData.worldKey); }
  // a drag starts on a selected thing: one thing drags the way it always did (walls snap), several move together by the same step
  function editorDragStart(e, hq) {
    var ids = editorMulti.filter(editorMovable); if (ids.indexOf(hq.id) < 0) return false;
    if (ids.some(function (k) { return !propInst[k]; }) && baked.meshes.length) unbakeStatic();
    if (ids.length === 1) {
      var id = ids[0], g1 = eobj(id), p1 = pointOnPlane(e, g1.position.y); if (!p1) return false;
      propDrag = propInst[id] ? { id: id, g: g1, y: g1.position.y, off: p1.clone().sub(g1.position), before: layoutSnap(id), moved: false } : { id: id, g: g1, y: g1.position.y, off: p1.clone().sub(g1.position), world: true, before: { x: g1.position.x, z: g1.position.z }, moved: false };
      return true;
    }
    var hg = eobj(hq.id), p0 = pointOnPlane(e, hg.position.y); if (!p0) return false;
    groupDrag = { y: hg.position.y, p0: p0.clone(), moved: false, items: ids.map(function (k) { var g = eobj(k); return { id: k, g: g, prop: !!propInst[k], x0: g.position.x, z0: g.position.z, before: propInst[k] ? layoutSnap(k) : { x: g.position.x, z: g.position.z } }; }) };
    return true;
  }
  // several things moved: each kept where it now stands (a prop in the layout, a world item in src/00-world.js), one undo step for all
  function editorGroupCommit(GD) {
    var after = GD.items.map(function (it) { return { x: Math.round(it.g.position.x * 100) / 100, z: Math.round(it.g.position.z * 100) / 100 }; });
    var put = function (which) {
      GD.items.forEach(function (it, i) {
        if (it.prop) { if (which === 'before') layoutRestore(it.id, it.before); else { var P = propPlacement(it.id); if (!S.layout) S.layout = {}; var Lz = S.layout[it.id] = S.layout[it.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; Lz.x = after[i].x; Lz.z = after[i].z; rebuildProp(it.id); } }
        else { var g = eobj(it.id), q = which === 'before' ? it.before : after[i]; g.position.x = q.x; g.position.z = q.z; g.updateMatrixWorld(true); worldRecord(g); }
      });
      save(); shadowDirty = true; editorHelpersShow();
    };
    put('after'); histPush('move ' + GD.items.length + ' things', function () { put('before'); }, function () { put('after'); });
    console.log('[co-editor] ' + JSON.stringify({ movedTogether: GD.items.map(function (it) { return it.id; }) }));
    return GD.items.length;
  }
  function editorMoveSel(dx, dz) {
    var ids = editorMulti.filter(editorMovable); if (!ids.length) return 'nothing selected that moves';
    if (ids.some(function (k) { return !propInst[k]; }) && baked.meshes.length) unbakeStatic();
    var GD = { items: ids.map(function (k) { var g = eobj(k); return { id: k, g: g, prop: !!propInst[k], before: propInst[k] ? layoutSnap(k) : { x: g.position.x, z: g.position.z } }; }) };
    GD.items.forEach(function (it) { it.g.position.x += +dx || 0; it.g.position.z += +dz || 0; });
    return 'moved ' + editorGroupCommit(GD);
  }
  // ── duplicate, copy, paste (0.9.4) ──
  // Duplicate makes a copy of every selected prop and world item, 1.5 m along, and selects the copies; Paste does the same at the point
  // the camera looks at, keeping the group's arrangement. A prop copy is a placed copy (the layout keeps it); a world item's copy is a
  // world copy (src/00-world.js keeps it). One undo step takes them all away.
  var editorClip = [];
  function editorDuplicate(ids, at) {
    ids = (ids && ids.length ? ids : editorMulti).filter(function (k) { return !!eobj(k); }); if (!ids.length) return { error: 'nothing selected to duplicate' };
    var spots = ids.map(function (k) { if (propInst[k]) { var P = propPlacement(k); return { x: P.x, z: P.z }; } var o = eobj(k); return { x: o.position.x, z: o.position.z }; });
    var cx = spots.reduce(function (s, p) { return s + p.x; }, 0) / spots.length, cz = spots.reduce(function (s, p) { return s + p.z; }, 0) / spots.length;
    var dx = at ? at.x - cx : 1.5, dz = at ? at.z - cz : 1.5, made = [], refused = [], snap = function (v) { return Math.round(v * 20) / 20; };
    if (!S.custom) S.custom = [];
    ids.forEach(function (k, i) {
      if (propInst[k]) { var src = customById(k) || placedById(k), type = src ? src.type : (PROPS[k] ? k : null), P = propPlacement(k); if (!type) return; var c = { id: uid('cp'), type: type, x: snap(spots[i].x + dx), z: snap(spots[i].z + dz), rot: P.rot || 0, h: P.h || 0 }; S.custom.push(c); buildProp(c.id); made.push({ prop: c, id: c.id }); return; }
      var o = eobj(k); if (!o || !o.userData.worldKey) return; if (o.userData.movesOnly) { refused.push(worldName(o)); return; }
      var rec = { id: uid('wc'), of: o.userData.worldCopy ? o.userData.worldCopy.of : o.userData.worldKey, x: wr(o.position.x + dx), y: wr(o.position.y), z: wr(o.position.z + dz), ry: Math.round(o.rotation.y * 180 / Math.PI * 10) / 10, sx: wr(o.scale.x), sy: wr(o.scale.y), sz: wr(o.scale.z) };
      WORLD_COPIES.push(rec); var g = worldCopyBuild(rec); if (g) made.push({ world: rec, id: eid(g) }); else { WORLD_COPIES.splice(WORLD_COPIES.indexOf(rec), 1); refused.push(worldName(o)); }
    });
    if (!made.length) return { error: refused.length ? refused.join(', ') + ' cannot be copied (it moves only)' : 'nothing to copy' };
    save();
    var undo = function () { made.forEach(function (m) { if (m.prop) { var a = S.custom.indexOf(m.prop); if (a >= 0) S.custom.splice(a, 1); removePropInst(m.prop.id); } else { var g = worldByKey(m.world.id); if (g) worldCopyRemove(g); } }); editorSelect(null); save(); };
    var redo = function () { made.forEach(function (m) { if (m.prop) { S.custom.push(m.prop); buildProp(m.prop.id); } else { WORLD_COPIES.push(m.world); var g = worldCopyBuild(m.world); if (g) m.id = eid(g); } }); save(); };
    histPush((at ? 'paste ' : 'duplicate ') + made.length + (made.length === 1 ? ' thing' : ' things'), undo, redo);
    editorMulti = made.map(function (m) { return m.id; }); editorSel = editorMulti[editorMulti.length - 1]; editorHelpersShow();
    console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), duplicated: made.length }));
    return { ok: true, made: editorMulti.slice(), refused: refused };
  }
  function editorCopy(ids) { editorClip = (ids && ids.length ? ids : editorMulti).filter(function (k) { return !!eobj(k); }); return { ok: true, copied: editorClip.length }; }
  function editorPaste() { if (!editorClip.length) return { error: 'nothing copied: select something and press Ctrl+C first' }; var a = aheadPoint(6); return editorDuplicate(editorClip, { x: a.x, z: a.z }); }
  function editorRemoveSel() { var ids = editorMulti.slice(), out = ids.map(function (k) { return editorRemove(k); }); editorSelect(null); return out; }
  // what the crosshair or a click is on: the nearest visible mesh, named as its prop when it belongs to one
  function editorPick(nx, ny) {
    scene.updateMatrixWorld(true);   /* a prop rebuilt this tick has no world matrix until the next frame */
    eRay.setFromCamera({ x: nx === undefined ? 0 : nx, y: ny === undefined ? 0 : ny }, camera); eRay.far = 120;
    var hits = eRay.intersectObjects(scene.children, true);
    // a baked merge is skipped and the hidden original behind it counts: it is the thing the player would name
    for (var i = 0; i < hits.length; i++) { var h = hits[i].object; if (h.userData.baked || h.userData.editor || h.material === MAT.hit || h === editorHelper || h.isPoints || h.userData.noBake || (!h.visible && !h.userData.bakedAway) || (h.material && h.material.transparent && h.material.opacity < 0.9 && !h.userData.screen)) continue;   /* not a blob, a helper or a glass pane */ var pid = propIdOf(h), isProp = !!(pid && propInst[pid]), wi = isProp ? null : worldItemOf(h); return { id: isProp ? pid : wi ? eid(wi) : eid(h), prop: isProp, world: !!wi, distance: rnd(hits[i].distance), point: [rnd(hits[i].point.x), rnd(hits[i].point.y), rnd(hits[i].point.z)] }; }
    return null;
  }
  function aheadPoint(dist) { var d = new THREE.Vector3(); camera.getWorldDirection(d); var p = camera.position.clone().add(d.multiplyScalar(dist || 3)); return { x: p.x, z: p.z, y: floorY(p.x, p.z) }; }
  // a new copy of a prop definition, free, where the camera looks (or at x, z): kept in the save as a bought extra would be
  function editorSpawn(type, x, z) {
    var def = PROPS[type]; if (!def) return 'no prop definition ' + type;
    if (x === undefined || z === undefined) { var a = aheadPoint(3); x = a.x; z = a.z; }
    if (!S.custom) S.custom = []; var c = { id: uid('cp'), type: type, x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20, rot: 0, h: 0 }; S.custom.push(c);
    buildProp(c.id); save(); editorSelect(c.id);
    histPush('place ' + type, function () { var i = S.custom.indexOf(c); if (i >= 0) S.custom.splice(i, 1); removePropInst(c.id); if (editorSel === c.id) editorSelect(null); save(); }, function () { S.custom.push(c); buildProp(c.id); save(); });
    return c.id;
  }
  function editorRemove(id) {
    var c = customById(id);
    if (c) { var at = S.custom.indexOf(c); S.custom.splice(at, 1); removePropInst(id); save(); if (editorSel === id) editorSelect(null); histPush('remove ' + c.type, function () { S.custom.splice(Math.min(at, S.custom.length), 0, c); buildProp(c.id); save(); }, function () { var i = S.custom.indexOf(c); if (i >= 0) S.custom.splice(i, 1); removePropInst(c.id); if (editorSel === c.id) editorSelect(null); save(); }); return 'removed ' + id; }
    if (propInst[id]) { var before = layoutSnap(id); if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); save(); if (editorSel === id) editorSelect(null); var after = layoutSnap(id); histPush('hide ' + id, function () { layoutRestore(id, before); }, function () { layoutRestore(id, after); }); return 'hidden ' + id + ' (the catalogue brings it back)'; }
    var wc = eobj(id); if (wc && wc.userData.worldCopy) { var rec = wc.userData.worldCopy; worldCopyRemove(wc); if (editorSel === id) editorSelect(null); histPush('remove a copy of ' + worldName(wc), function () { WORLD_COPIES.push(rec); worldCopyBuild(rec); }, function () { var g = worldByKey(rec.id); if (g) worldCopyRemove(g); }); return 'removed a copy of ' + worldName(wc); }
    var wo = eobj(id); if (wo && wo.userData.worldKey) { if (baked.meshes.length) unbakeStatic(); wo.visible = false; worldRecord(wo); if (editorSel === id) editorSelect(null); shadowDirty = true; histPush('remove ' + worldName(wo), function () { wo.visible = true; worldRecord(wo); shadowDirty = true; }, function () { wo.visible = false; worldRecord(wo); shadowDirty = true; }); return 'removed ' + worldName(wo) + ' (kept in src/00-world.js; Put it back in the inspector or Ctrl+Z brings it back)'; }
    var o = eobj(id); if (!o) return 'no such object ' + id; var par = o.parent; if (par) par.remove(o); if (editorSel === id) editorSelect(null); shadowDirty = true;
    histPush('remove ' + eName(o), function () { if (par) { par.add(o); shadowDirty = true; } }, function () { if (o.parent) o.parent.remove(o); if (editorSel === id) editorSelect(null); shadowDirty = true; });
    return 'removed ' + id + ' until the next reload';
  }
  // the scene view is the engine's free camera: the world holds still, the camera flies. frame(id) brings the camera to a thing.
  function editorEnter() { if (ui.started) return true; if (CO.game && CO.game.editorEnter) CO.game.editorEnter(); else enter(); return ui.started; }
  function editorMode(m) {
    if (m === 'top') { editorMode('scene'); photo.y = Math.max(photo.y, 22); photo.pitch = -1.5; camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ'); return photo.on ? 'top' : 'game'; }
    if (m === 'scene') { editorEnter(); if (ui.menuOpen) closeMenu(); if (ui.panelOpen) closePanel(); if (!photo.on) photoToggle(true); return photo.on ? 'scene' : 'game'; }
    if (photo.on) photoToggle(false); return 'game';
  }
  // how far the scene camera can back away from a point along one yaw before a wall (or any solid thing that is not the object itself) is in the way
  function frameClear(c, yaw, d, o) {
    var dir = new THREE.Vector3(Math.sin(yaw), 0.45, Math.cos(yaw)).normalize(), rc = new THREE.Raycaster(c, dir, 0.05, d); rc.camera = camera;   /* sprites need it */ var hits = rc.intersectObjects(scene.children, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i].object, own = false, p = h; while (p) { if (p === o) { own = true; break; } p = p.parent; }
      if (own || h.userData.editor || h === editorHelper || h.material === MAT.hit || h.isPoints || !h.visible || (h.material && h.material.transparent && h.material.opacity < 0.9)) continue;
      return Math.max(1.2, hits[i].distance - 0.5);
    }
    return d;
  }
  // the scene camera flies to one object: back along its current yaw when there is room, else to the side with the most room, so it never ends up behind a wall
  function editorFrame(id) {
    var o = eobj(id); if (!o) return 'no such object ' + id;
    var box3 = new THREE.Box3().setFromObject(o), c = box3.getCenter(new THREE.Vector3()), s = box3.getSize(new THREE.Vector3()), d = Math.max(2.2, Math.max(s.x, s.y, s.z) * 1.6 + 1.2);
    if (editorMode('scene') !== 'scene') return 'the scene view did not open';
    var yaw = photo.yaw, best = yaw, bestD = frameClear(c, yaw, d, o), k, cand, cd;
    if (bestD < d * 0.8) for (k = 1; k < 4; k++) { cand = yaw + k * Math.PI / 2; cd = frameClear(c, cand, d, o); if (cd > bestD + 0.3) { best = cand; bestD = cd; } }
    yaw = best; d = bestD;
    var px = c.x + Math.sin(yaw) * d, pz = c.z + Math.cos(yaw) * d, py = c.y + d * 0.45;
    photo.yaw = yaw; photo.x = px; photo.y = py; photo.z = pz; photo.pitch = -Math.atan2(py - c.y, Math.sqrt((px - c.x) * (px - c.x) + (pz - c.z) * (pz - c.z)));
    camera.position.set(px, py, pz); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
    return 'framed ' + id;
  }
  // the assets panel: every prop definition, the palette, the textures, the voices, the people presets
  function editorAssets() {
    return {
      props: PROP_ORDER.map(function (id) { var d = PROPS[id]; return { id: id, label: d.label, cat: d.cat || 'other', ico: d.ico || '', price: d.price || 0, extra: !!d.extra, lvl: d.lvl || null, wall: !!d.wall, fixed: !!d.fixed, desc: d.desc || '', standing: !!propInst[id] }; }),
      materials: Object.keys(MAT).map(function (k) { var m = MAT[k]; return { key: k, type: m.type, color: m.color ? '#' + m.color.getHexString() : null, map: !!m.map, emissive: m.emissive && m.emissive.getHex() ? '#' + m.emissive.getHexString() : null }; }),
      textures: Object.keys(TEX).filter(function (k) { return !!TEX[k]; }), normals: Object.keys(NRM), sounds: Object.keys(SFX),
      people: { skins: SKINS.map(function (c) { return '#' + c.toString(16).padStart(6, '0'); }), hairs: HAIRS.map(function (c) { return '#' + c.toString(16).padStart(6, '0'); }), styles: ['short', 'long', 'bun', 'bald', 'cap'] },
      catalogue: CO.game && CO.game.catalogueGroups ? CO.game.catalogueGroups.map(function (g) { return [g[0], g[1]]; }) : null
    };
  }
  function editorShot(quality) { renderFrame(0.016); try { return canvas.toDataURL('image/jpeg', quality || 0.8); } catch (e) { return null; } }
  // in the editor's viewport there is no pointer lock (a locked pointer in an embedded page is not safe): a left click selects what it
  // is on, and the look follows the mouse while the right button is held, in the scene camera and in the game alike
  var editorTool = { mode: null, radius: 3, strength: 0.5, tex: 0 }, toolDown = false;
  function editorSetTool(t) { if (!t || !t.mode) { editorTool.mode = null; editorTool.type = null; return editorTool; } editorTool.mode = t.mode; editorTool.type = t.type || null; if (t.radius) editorTool.radius = +t.radius; if (t.strength !== undefined) editorTool.strength = +t.strength; if (t.tex !== undefined) editorTool.tex = t.tex | 0; return editorTool; }
  function toolApply(e) { var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1, pt = terrainPick(nx, ny); if (!pt) return; var res = terrainBrush(pt.x, pt.z, editorTool.mode, editorTool.radius, editorTool.mode === 'paint' ? 1 : editorTool.strength * 0.25, editorTool.tex); if (res && res.changed) console.log('[co-editor] ' + JSON.stringify({ terrain: res.changed })); }
  var dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), dragPt = new THREE.Vector3(), propDrag = null, partDrag = null, dragT = 0, toolStroke = null;
  function terrainRestore(h, p) { if (!TERRAIN.on || TERRAIN.heights.length !== h.length) return; TERRAIN.heights.set(h); TERRAIN.paint.set(p); terrainUpdate(0, 0, TERRAIN.w, TERRAIN.d); }
  // the nearest wall face within 2.5 m, the way build mode snaps a wall prop: the point on it and the quarter turn that faces out
  function wallSnap(pt, s) { var best = null, bd = 2.5; wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } }); if (!best) return null; return best.a === 'x' ? { x: best.v, z: snapTo(pt.z, s || 0.05), rot: best.n > 0 ? 1 : 3 } : { x: snapTo(pt.x, s || 0.05), z: best.v, rot: best.n > 0 ? 0 : 2 }; }
  function pointOnPlane(e, y) { var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1; eRay.setFromCamera({ x: nx, y: ny }, camera); dragPlane.constant = -y; return eRay.ray.intersectPlane(dragPlane, dragPt) ? dragPt : null; }
  function snapTo(v, s) { return Math.round(v / s) * s; }
  // the vertex of a mesh part nearest the pointer on screen, within 14 px
  function nearestVertex(mesh, e) { var r = canvas.getBoundingClientRect(), pos = mesh.geometry.attributes.position, best = null, v = new THREE.Vector3(); mesh.updateMatrixWorld(true); for (var i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); var w = v.clone().applyMatrix4(mesh.matrixWorld), sp = w.clone().project(camera), sx = (sp.x + 1) / 2 * r.width + r.left, sy = (1 - sp.y) / 2 * r.height + r.top, d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < 14 && (!best || d < best.d)) best = { i: mesh.userData.vertMap ? mesh.userData.vertMap[i] : i, d: d, w: w }; } return best; }
  function editorBind() {
    canvas.addEventListener('mousedown', function (e) {
      if (!CO.editor.on || !ui.started) return;
      if (e.button === 0 && editorTool.mode === 'model' && editorTool.type) { var r0 = canvas.getBoundingClientRect(), mx = ((e.clientX - r0.left) / r0.width) * 2 - 1, my = -((e.clientY - r0.top) / r0.height) * 2 + 1, pk = modelPick(editorTool.type, mx, my); if (pk) { var inst0 = propInst[pk.id]; inst0.g.updateMatrixWorld(true); var partObj = null; inst0.g.traverse(function (o) { if (!partObj && o.userData && o.userData.part === pk.part) partObj = o; }); var wp = partObj ? partObj.getWorldPosition(new THREE.Vector3()) : inst0.g.position.clone(); var vh = partObj && partObj.userData.vertexEdit ? nearestVertex(partObj, e) : null; if (vh) { partDrag = { type: editorTool.type, id: pk.id, part: pk.part, g: inst0.g, mesh: partObj, vert: vh.i, y: vh.w.y }; console.log('[co-editor] ' + JSON.stringify({ partPick: pk.part, vert: vh.i, type: editorTool.type })); e.preventDefault(); return; } var p0 = pointOnPlane(e, wp.y); if (p0) { partDrag = { type: editorTool.type, id: pk.id, part: pk.part, g: inst0.g, y: wp.y, off: p0.clone().sub(wp) }; console.log('[co-editor] ' + JSON.stringify({ partPick: pk.part, type: editorTool.type })); e.preventDefault(); return; } } }
      if (e.button === 0 && editorTool.mode && editorTool.mode !== 'model' && TERRAIN.on) { toolDown = true; toolStroke = { mode: editorTool.mode, h: Float32Array.from(TERRAIN.heights), p: Uint8Array.from(TERRAIN.paint) }; toolApply(e); e.preventDefault(); return; }
      // Shift and the left button in the scene camera draw a selection box (Ctrl and Shift add to what is selected)
      if (e.button === 0 && e.shiftKey && photo.on) { boxSelStart(e); e.preventDefault(); return; }
      // the left button: a click selects, Ctrl and a click adds to the selection or takes away; a drag on a selected thing moves it and
      // everything selected with it, with Ctrl in the game view and without in the scene camera
      if (e.button === 0) {
        var rq = canvas.getBoundingClientRect(), qx = ((e.clientX - rq.left) / rq.width) * 2 - 1, qy = -((e.clientY - rq.top) / rq.height) * 2 + 1, hq = editorPick(qx, qy), add = e.ctrlKey || e.metaKey;
        pendingOff = null;
        if (add) { if (hq) { if (editorMulti.indexOf(hq.id) >= 0) pendingOff = hq.id; else editorSelect(hq.id, true); } }
        else if (!hq || editorMulti.indexOf(hq.id) < 0) editorSelect(hq ? hq.id : null);
        else { editorSel = hq.id; editorHelpersShow(); }
        console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), point: hq ? hq.point : null, nx: qx, ny: qy }));
        if (hq && (add || photo.on) && editorMulti.indexOf(hq.id) >= 0 && editorDragStart(e, hq)) { e.preventDefault(); return; }
      }
      if (e.button === 2) { CO.editor.drag = true; e.preventDefault(); }
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 2) CO.editor.drag = false; if (e.button === 0) toolDown = false;
      if (e.button === 0 && boxSel) { boxSelEnd(e); return; }
      var moved0 = (groupDrag && groupDrag.moved) || (propDrag && propDrag.moved);
      if (e.button === 0 && pendingOff) { var po = pendingOff; pendingOff = null; if (!moved0) { editorSelect(po, true); console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice() })); } }
      if (e.button === 0 && groupDrag) { var GD0 = groupDrag; groupDrag = null; if (GD0.moved) editorGroupCommit(GD0); return; }
      if (e.button === 0 && toolStroke) { var TS = toolStroke; toolStroke = null; var afterH = Float32Array.from(TERRAIN.heights), afterP = Uint8Array.from(TERRAIN.paint); histPush('terrain ' + TS.mode, function () { terrainRestore(TS.h, TS.p); }, function () { terrainRestore(afterH, afterP); }); }
      if (e.button === 0 && propDrag && propDrag.world) { var DW = propDrag; propDrag = null; if (DW.moved) { var gw = DW.g, bw = DW.before, aw = { x: gw.position.x, z: gw.position.z }; worldRecord(gw); histPush('move ' + worldName(gw), function () { gw.position.x = bw.x; gw.position.z = bw.z; gw.updateMatrixWorld(true); worldRecord(gw); shadowDirty = true; }, function () { gw.position.x = aw.x; gw.position.z = aw.z; gw.updateMatrixWorld(true); worldRecord(gw); shadowDirty = true; }); console.log('[co-editor] ' + JSON.stringify({ moved: DW.id, x: wr(aw.x), z: wr(aw.z), world: true })); } return; }
      if (e.button === 0 && propDrag) { var D = propDrag; propDrag = null; if (D.moved) { var P = propPlacement(D.id), x = Math.round(D.g.position.x * 100) / 100, z = Math.round(D.g.position.z * 100) / 100; if (!S.layout) S.layout = {}; S.layout[D.id] = S.layout[D.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; S.layout[D.id].x = x; S.layout[D.id].z = z; if (D.rot !== undefined) S.layout[D.id].rot = D.rot; rebuildProp(D.id); save(); var after = layoutSnap(D.id), bef = D.before; histPush('move ' + D.id, function () { layoutRestore(D.id, bef); }, function () { layoutRestore(D.id, after); }); editorSelect(D.id); console.log('[co-editor] ' + JSON.stringify({ moved: D.id, x: x, z: z })); } }
      if (e.button === 0 && partDrag) { console.log('[co-editor] ' + JSON.stringify({ partDragEnd: partDrag.part, type: partDrag.type })); partDrag = null; }
    });
    canvas.addEventListener('mousemove', function (e) {
      if (toolDown && editorTool.mode && editorTool.mode !== 'model' && TERRAIN.on) toolApply(e);
      if (boxSel) { boxSelMove(e); return; }
      if (groupDrag) { var pg = pointOnPlane(e, groupDrag.y); if (!pg) return; var sg = e.shiftKey ? 0.5 : 0.05, gdx = snapTo(pg.x - groupDrag.p0.x, sg), gdz = snapTo(pg.z - groupDrag.p0.z, sg); groupDrag.items.forEach(function (it) { it.g.position.x = it.x0 + gdx; it.g.position.z = it.z0 + gdz; it.g.updateMatrixWorld(true); }); if (gdx || gdz) groupDrag.moved = true; editorHelpersUpdate(); shadowDirty = true; return; }
      if (propDrag) { var p = pointOnPlane(e, propDrag.y); if (!p) return; var s = e.shiftKey ? 0.5 : 0.05, nx2 = snapTo(p.x - propDrag.off.x, s), nz2 = snapTo(p.z - propDrag.off.z, s); var dd = propDrag.world ? null : propDef(propDrag.id); if (dd && dd.wall) { var ws2 = wallSnap({ x: nx2, z: nz2 }, s); if (ws2) { nx2 = ws2.x; nz2 = ws2.z; if (propDrag.g.rotation.y !== ws2.rot * Math.PI / 2) { propDrag.g.rotation.y = ws2.rot * Math.PI / 2; propDrag.rot = ws2.rot; } } } if (nx2 !== propDrag.g.position.x || nz2 !== propDrag.g.position.z) { propDrag.g.position.x = nx2; propDrag.g.position.z = nz2; propDrag.moved = true; if (editorHelper) editorHelper.update(); shadowDirty = true; } return; }
      if (partDrag) { var pp = pointOnPlane(e, partDrag.y); if (!pp) return; var now = performance.now(); if (now - dragT < 40) return; dragT = now; var st = e.shiftKey ? 0.25 : 0.05; if (partDrag.vert !== undefined) { var lv = partDrag.mesh.worldToLocal(pp.clone()); console.log('[co-editor] ' + JSON.stringify({ vertDrag: partDrag.part, v: partDrag.vert, type: partDrag.type, x: snapTo(lv.x, st / 5), z: snapTo(lv.z, st / 5) })); return; } var local = partDrag.g.worldToLocal(pp.clone().sub(partDrag.off)); console.log('[co-editor] ' + JSON.stringify({ partDrag: partDrag.part, type: partDrag.type, x: snapTo(local.x, st), z: snapTo(local.z, st) })); }
    });
    window.addEventListener('blur', function () { CO.editor.drag = false; });
    canvas.addEventListener('contextmenu', function (e) { if (CO.editor.on) e.preventDefault(); });
    // Ctrl and the wheel turn the prop under the pointer (or the selected one) a quarter at a time
    canvas.addEventListener('wheel', function (e) { if (!CO.editor.on || !ui.started || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); e.stopImmediatePropagation(); var r2 = canvas.getBoundingClientRect(), wx = ((e.clientX - r2.left) / r2.width) * 2 - 1, wy = -((e.clientY - r2.top) / r2.height) * 2 + 1, hw = editorPick(wx, wy), id = hw && hw.prop && propInst[hw.id] ? hw.id : hw && hw.world ? hw.id : editorSel; var wt = id && !propInst[id] ? eobj(id) : null; if (wt && wt.userData.worldKey) { var ry0 = wt.rotation.y * 180 / Math.PI; editorSet(id, 'rotation.y', Math.round(ry0 + (e.deltaY > 0 ? -90 : 90))); editorSelect(id); return; } if (!id || !propInst[id]) return; var dw = propDef(id); if (dw && dw.fixed) return; var rot = propPlacement(id).rot || 0; editorSet(id, 'prop.rot', (rot + (e.deltaY > 0 ? 1 : 3)) % 4); editorSelect(id); console.log('[co-editor] ' + JSON.stringify({ moved: id, rot: (rot + (e.deltaY > 0 ? 1 : 3)) % 4 })); }, { capture: true, passive: false });
    window.addEventListener('keydown', function (e) { if (!CO.editor.on || !(e.ctrlKey || e.metaKey)) return; var k = (e.key || '').toLowerCase(); if (k === 'd' || k === 'c' || k === 'v') { e.preventDefault(); var rk = k === 'd' ? editorDuplicate() : k === 'c' ? editorCopy() : editorPaste(); console.log('[co-editor] ' + JSON.stringify({ clip: k, result: rk && (rk.error || rk.made || rk.copied) })); return; } if (k === 'z' && !e.shiftKey) { e.preventDefault(); console.log('[co-editor] ' + JSON.stringify({ history: editorUndoStep() })); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); console.log('[co-editor] ' + JSON.stringify({ history: editorRedoStep() })); } });
  }
  // ── Undo and redo: a stack of steps, each one knowing how to undo and redo itself ──
  // The editor's own edits are steps (a prop field, a live field, a spawn, a remove); the game's build mode is play, not editing, and is not.
  var editorUndoStack = [], editorRedoStack = [];
  function histPush(label, undo, redo) { editorUndoStack.push({ label: label, undo: undo, redo: redo, t: Date.now() }); if (editorUndoStack.length > 200) editorUndoStack.shift(); editorRedoStack.length = 0; }
  function layoutSnap(id) { return S && S.layout && S.layout[id] ? JSON.parse(JSON.stringify(S.layout[id])) : undefined; }
  function layoutRestore(id, snap) { if (!S.layout) S.layout = {}; if (snap === undefined) delete S.layout[id]; else S.layout[id] = JSON.parse(JSON.stringify(snap)); rebuildProp(id); save(); if (editorSel === id) editorSelect(propInst[id] ? id : null); }
  function editorUndoStep() { var s = editorUndoStack.pop(); if (!s) return 'nothing to undo'; s.undo(); editorRedoStack.push(s); if (editorHelper) editorHelper.update(); return 'undid: ' + s.label; }
  function editorRedoStep() { var s = editorRedoStack.pop(); if (!s) return 'nothing to redo'; s.redo(); editorUndoStack.push(s); if (editorHelper) editorHelper.update(); return 'redid: ' + s.label; }
  function editorHistory() { return { undo: editorUndoStack.map(function (s) { return s.label; }), redo: editorRedoStack.map(function (s) { return s.label; }) }; }
  // the current value of a live field, in the units set() takes, so a step can put it back
  function editorGet(id, path) {
    var o = eobj(id); if (!o) return undefined; var p = String(path).split('.');
    if (p[0] === 'position' || p[0] === 'scale') return o[p[0]][p[1]];
    if (p[0] === 'rotation') return o.rotation[p[1]] * 180 / Math.PI;
    if (p[0] === 'visible') return o.visible;
    if (p[0] === 'material') { var m = o.material; if (!m) return undefined; return (p[1] === 'color' || p[1] === 'emissive') ? (m[p[1]] ? '#' + m[p[1]].getHexString() : undefined) : m[p[1]]; }
    if (p[0] === 'light') return !o.isLight ? undefined : p[1] === 'color' ? '#' + o.color.getHexString() : o[p[1]];
    if (p[0] === 'name') return o.name;
    return undefined;
  }
  // set() records a step around apply(): a prop field as a layout snapshot before and after, a live field as its old and new value
  function editorSet(id, path, value) {
    var head = String(path).split('.')[0];
    if (head === 'prop') { var before = layoutSnap(id), r = editorApply(id, path, value); if (r === 'ok') { var after = layoutSnap(id); histPush(path + ' of ' + id, function () { layoutRestore(id, before); }, function () { layoutRestore(id, after); }); } return r; }
    if (head === 'world') { var wo = eobj(id); if (!wo || !wo.userData.worldKey) return 'not a world item'; var snap = function () { return { p: wo.position.clone(), ry: wo.rotation.y, s: wo.scale.clone(), v: wo.visible }; }, put = function (q) { wo.position.copy(q.p); wo.rotation.y = q.ry; wo.scale.copy(q.s); wo.visible = q.v; wo.updateMatrixWorld(true); worldRecord(wo); shadowDirty = true; }, w0 = snap(), rw = editorApply(id, path, value), w1 = snap(); if (rw === 'ok') histPush('put back ' + worldName(wo), function () { put(w0); }, function () { put(w1); }); return rw; }
    var was = editorGet(id, path), r2 = editorApply(id, path, value);
    if (r2 === 'ok' && was !== undefined) histPush(path + ' of ' + id, function () { editorApply(id, path, was); }, function () { editorApply(id, path, value); });
    return r2;
  }

  // ── Pack authoring: a prop definition's build code, compiled and previewed live, and new definitions ──
  // The names a build function may use when the editor compiles it outside the closure: the engine's kit, plus what the game adds in
  // GAME.editorKit (an object, or a function returning one). A name missing here surfaces as "x is not defined" in the preview.
  function editorKit() {
    var K = { THREE: THREE, CO: CO, S: S, SET: SET, MAT: MAT, TEX: TEX, NRM: NRM, PROPS: PROPS, defProp: defProp, propDef: propDef, propPlacement: propPlacement, propWorld: propWorld, propLabel: propLabel, customById: customById, propInst: propInst,
      box: box, plane: plane, cyl: cyl, sphere: sphere, sprite: sprite, sign: sign, tex: tex, textTex: textTex, normalTex: normalTex, roughTex: roughTex, std: std, glowMat: glowMat, cachedGeo: cachedGeo, boxGeo: boxGeo, bevelGeo: bevelGeo, taperGeo: taperGeo, roundCylGeo: roundCylGeo,
      groundBlob: groundBlob, hitBox: hitBox, solid: solid, solids: solids, animate: animate, animated: animated, burst: burst, parentOf: parentOf, inter: inter, addInter: addInter, dyn: dyn, scene: scene, camera: camera, player: player, ui: ui,
      clamp: clamp, lerp: lerp, money: money, randi: randi, randf: randf, pick: pick, uid: uid, dist2: dist2, pad2: pad2, fmtTime: fmtTime, floorY: floorY, propSeed: propSeed, seededF: seededF, seededI: seededI, seededPick: seededPick, mixHex: mixHex, hexCss: hexCss,
      hook: hook, runHooks: runHooks, sfx: sfx, toast: toast, logEvent: logEvent, save: save, buildProp: buildProp, removePropInst: removePropInst, touchScreen: touchScreen, screens: screens, screenDirtyAll: screenDirtyAll, scBg: scBg, scHead: scHead, scText: scText, scButton: scButton, openPanel: openPanel, closePanel: closePanel, pay: pay, terrainY: terrainY, TERRAIN: TERRAIN, LAYOUT: LAYOUT };
    if (CO.game && CO.game.editorKit) { var G = typeof CO.game.editorKit === 'function' ? CO.game.editorKit() : CO.game.editorKit; for (var k in G) K[k] = G[k]; }
    return K;
  }
  var ORIG_BUILD = {};
  // code the editor runs (a build function, a whole definition, a pack) runs inside the engine's own scope by a direct eval here, so it sees every name a part of the game sees (0.6.0; before, only the kit's names)
  function closureRun(src) { return eval(src); }
  function editorCompile(code, what) {
    var fn; try { fn = closureRun('(' + code + '\n)'); } catch (e) { return { error: 'the ' + what + ' code does not parse: ' + e.message }; }
    if (typeof fn !== 'function') return { error: 'the ' + what + ' code must be a function expression: function (c, P, inst) { ... }' };
    return { fn: fn };
  }
  function propTypeIds(type) { var ids = []; if (PROPS[type] && !PROPS[type].extra) ids.push(type); LAYOUT.placed.forEach(function (p) { if (p.type === type && !PROPS[p.id]) ids.push(p.id); }); (S && S.custom || []).forEach(function (c) { if (c.type === type) ids.push(c.id); }); return ids; }
  function rebuildType(type) { var n = 0, err = null; propTypeIds(type).forEach(function (id) { try { rebuildProp(id); n++; } catch (e) { err = err || (id + ': ' + e.message); } }); if (editorSel && propTypeIds(type).indexOf(editorSel) >= 0) editorSelect(propInst[editorSel] ? editorSel : null); return { rebuilt: n, error: err }; }
  // the build code this prop stands on is also another prop's (a pack's loop, a builder used twice): saving over it would reshape them all
  function buildShared(type) { var b0 = ORIG_BUILD[type] || PROPS[type].build, s0 = b0 ? b0.toString() : ''; if (!s0) return false; for (var k in PROPS) { if (k === type) continue; var b = ORIG_BUILD[k] || PROPS[k].build; if (b && (b === b0 || b.toString() === s0)) return true; } return false; }
  function editorSource(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var fields = {}; ['label', 'cat', 'x', 'z', 'rot', 'y', 'wall', 'fixed', 'extra', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (def[k] !== undefined) fields[k] = def[k]; });
    return { type: type, fields: fields, build: def.build ? def.build.toString() : null, after: def.after ? def.after.toString() : null, original: ORIG_BUILD[type] ? ORIG_BUILD[type].toString() : null, modified: !!ORIG_BUILD[type] && def.build !== ORIG_BUILD[type], shared: buildShared(type) || !!MODEL_OVER[type], canOverride: true, instances: propTypeIds(type), kit: Object.keys(editorKit()) };
  }
  // the new build function takes over every placed instance of the type at once; a build that throws is refused and the previous one comes back
  function editorPreview(type, code) {
    var def = PROPS[type]; if (!def) return { ok: false, error: 'no prop definition ' + type };
    var c = editorCompile(code, 'build'); if (c.error) return { ok: false, error: c.error };
    if (!ORIG_BUILD[type]) ORIG_BUILD[type] = def.build;
    var was = def.build; def.build = c.fn;
    var r = rebuildType(type);
    if (r.error) { def.build = was; rebuildType(type); return { ok: false, error: 'the new build threw, the previous one is back: ' + r.error }; }
    return { ok: true, rebuilt: r.rebuilt, modified: def.build !== ORIG_BUILD[type] };
  }
  function editorRevert(type) { var def = PROPS[type]; if (!def) return { ok: false, error: 'no prop definition ' + type }; if (ORIG_BUILD[type]) { def.build = ORIG_BUILD[type]; delete ORIG_BUILD[type]; } var r = rebuildType(type); return { ok: !r.error, rebuilt: r.rebuilt, error: r.error }; }
  // a whole definition, run live: defProp(id, { ... }). A placed one (x, z, not extra) builds at once; an extra one joins the assets
  function editorDefine(code) {
    var n0 = PROP_ORDER.length, known = PROP_ORDER.slice();
    try { closureRun(code + '\n'); } catch (e) { return { ok: false, error: 'the definition does not run: ' + e.message }; }
    var added = PROP_ORDER.slice(n0); if (!added.length) return { ok: false, error: 'the code ran but defined no prop: it should call defProp(id, { ... })' };
    PROP_ORDER.length = n0; var ids = []; added.forEach(function (k) { if (ids.indexOf(k) < 0) ids.push(k); if (PROP_ORDER.indexOf(k) < 0) PROP_ORDER.push(k); });   /* a redefinition keeps its place in the order; a pack adds many */
    var id = ids[ids.length - 1], def = PROPS[id], built = 0, redefined = [];
    for (var q = 0; q < ids.length; q++) {
      var k2 = ids[q], d2 = PROPS[k2];
      if (known.indexOf(k2) >= 0) { delete ORIG_BUILD[k2]; var rr = rebuildType(k2); if (rr.error) return { ok: false, id: k2, error: 'the new definition does not build: ' + rr.error }; built += rr.rebuilt; redefined.push(k2); }
      else if (!d2.extra && typeof d2.x === 'number' && typeof d2.z === 'number') { try { buildProp(k2); built++; } catch (e) { delete PROPS[k2]; PROP_ORDER.splice(PROP_ORDER.indexOf(k2), 1); return { ok: false, id: k2, error: 'the new prop ' + k2 + ' does not build: ' + e.message }; } }
    }
    return { ok: true, id: id, ids: ids, built: ids.length === 1 ? built > 0 : built, extra: !!def.extra, redefined: ids.length === 1 ? redefined.length > 0 : redefined };
  }

  // ── The layout the game ships: what the editor writes into src/00-layout.js, and the moment it did ──
  function sameSpot(a, b) { return a.x === b.x && a.z === b.z && (a.rot || 0) === (b.rot || 0) && (a.h || 0) === (b.h || 0) && !!a.hidden === !!b.hidden; }
  function editorLayout() {
    var props = {}, placed = [], changed = 0, pendingCopies = 0;
    PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (d.extra) return; var P = propPlacement(id), D = propDefault(id), def = { x: d.x, z: d.z, rot: d.rot || 0, h: 0, hidden: false }; if (!sameSpot(P, D)) changed++; if (!sameSpot(P, def)) props[id] = { x: P.x, z: P.z, rot: P.rot, h: P.h || 0, hidden: !!P.hidden }; });
    LAYOUT.placed.forEach(function (p) { if (PROPS[p.id]) return; var P = propPlacement(p.id); if (!sameSpot(P, propDefault(p.id))) changed++; if (!P.hidden) placed.push({ id: p.id, type: p.type, x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }); });
    (S && S.custom || []).forEach(function (c) { if (!PROPS[c.type] || placedById(c.id)) return; var P = propPlacement(c.id); if (!P.hidden) { placed.push({ id: c.id, type: c.type, x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }); pendingCopies++; } });
    var lines = ['//@ the layout the editor saved: where the props stand and the copies that ship with the game. Written by the Co Engine editor; it sorts first in src/ so the boot sees it. Move things in the editor rather than here.', '  CO.layout({', '    props: {'];
    Object.keys(props).sort().forEach(function (id) { var p = props[id]; lines.push('      ' + JSON.stringify(id) + ': { x: ' + p.x + ', z: ' + p.z + ', rot: ' + p.rot + ', h: ' + p.h + (p.hidden ? ', hidden: true' : '') + ' },'); });
    lines.push('    },', '    placed: [');
    placed.forEach(function (p) { lines.push('      { id: ' + JSON.stringify(p.id) + ', type: ' + JSON.stringify(p.type) + ', x: ' + p.x + ', z: ' + p.z + ', rot: ' + p.rot + ', h: ' + p.h + ' },'); });
    lines.push('    ]', '  });', '');
    return { props: props, placed: placed, changed: changed, copies: placed.length, pending: changed + pendingCopies, code: lines.join('\n') };
  }
  // the file is written: what it says is now the baseline, the copies it carries leave the save, and overrides equal to the baseline go
  function editorLayoutAdopt(L) {
    L = L || editorLayout(); LAYOUT.props = {}; for (var k in L.props) LAYOUT.props[k] = L.props[k]; LAYOUT.placed = (L.placed || []).slice();
    var moved = []; if (S.custom) S.custom = S.custom.filter(function (c) { if (placedById(c.id)) { moved.push(c.id); return false; } return true; });
    if (S.layout) Object.keys(S.layout).forEach(function (id) { if (!PROPS[id] && !placedById(id) && !customById(id)) return; if (sameSpot(propPlacement(id), propDefault(id))) delete S.layout[id]; });
    moved.forEach(function (id) { buildProp(id); }); save();
    return { adopted: true, props: Object.keys(LAYOUT.props).length, placed: LAYOUT.placed.length, pending: editorLayout().pending };
  }

  // ── Drop: a placed prop falls under physics from where it is (or from a height) and its resting place goes into the layout ──
  var dropping = {};
  function editorDrop(id, fromHeight) {
    var inst = propInst[id]; if (!inst) return { error: id + ' is not a placed prop' }; if (dropping[id]) return { error: id + ' is already falling' };
    var g = inst.g; if (fromHeight) g.position.y += +fromHeight;
    var before = layoutSnap(id), B = body(g, { mass: 1, restitution: 0.1, friction: 0.7 }); B.ignoreOwn = id; dropping[id] = { t: 0, B: B, before: before };
    return { ok: true, id: id, from: rnd(g.position.y) };
  }
  hook('frame', function (dt) {
    for (var id in dropping) {
      var D = dropping[id], g = D.B.obj; D.t += dt;
      if (D.B.asleep || D.t > 6) {
        removeBody(g); delete dropping[id]; var P = propPlacement(id), ground = propGroundY(g.position.x, g.position.z);
        if (!S.layout) S.layout = {}; var L = S.layout[id] = S.layout[id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; L.x = Math.round(g.position.x * 100) / 100; L.z = Math.round(g.position.z * 100) / 100; L.h = Math.max(0, Math.round((g.position.y - ground) * 100) / 100);
        rebuildProp(id); save(); var after = layoutSnap(id), bef = D.before; histPush('drop ' + id, function () { layoutRestore(id, bef); }, function () { layoutRestore(id, after); });
        if (editorSel === id) editorSelect(id); console.log('[co-editor] ' + JSON.stringify({ dropped: id, x: L.x, z: L.z, h: L.h }));
      }
    }
  });

  // ── The profiler: the frame's phases and the renderer's counts, sampled while the editor's profiler is open ──
  var PROF = { on: false, ring: [], max: 120, cur: null };
  function profBegin() { if (!PROF.on) return; PROF.cur = { t0: performance.now(), sim: 0, world: 0, present: 0, ui: 0, render: 0, total: 0 }; }
  function profMark(k, t) { if (!PROF.on || !PROF.cur) return; PROF.cur[k] += performance.now() - t; }
  function profEnd() { if (!PROF.on || !PROF.cur) return; var c = PROF.cur; c.total = performance.now() - c.t0; PROF.ring.push(c); if (PROF.ring.length > PROF.max) PROF.ring.shift(); PROF.cur = null; }
  function rnd2(v) { return Math.round(v * 100) / 100; }
  function editorProfile(on) {
    if (on !== undefined) { PROF.on = !!on; if (!PROF.on) PROF.ring.length = 0; }
    var r = PROF.ring, n = r.length, sum = { sim: 0, world: 0, present: 0, ui: 0, render: 0, total: 0 }, mx = 0, totals = [], k;
    r.forEach(function (c) { for (k in sum) sum[k] += c[k]; mx = Math.max(mx, c.total); totals.push(c.total); });
    var sorted = totals.slice().sort(function (a, b) { return a - b; }), p95 = n ? rnd2(sorted[Math.min(n - 1, Math.floor(n * 0.95))]) : 0, avg = {}; for (k in sum) avg[k] = n ? rnd2(sum[k] / n) : 0;
    var wall = n > 1 ? (r[n - 1].t0 - r[0].t0) / (n - 1) : 0, info = renderer.info, mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, lights = 0; scene.traverse(function (o) { if (o.isLight) lights++; });
    return { on: PROF.on, frames: n, fps: wall ? Math.round(1000 / wall) : null, avg: avg, max: rnd2(mx), p95: p95, samples: r.map(function (c) { return [rnd2(c.sim), rnd2(c.world), rnd2(c.present), rnd2(c.ui), rnd2(c.render), rnd2(c.total)]; }),
      draws: post.calls || info.render.calls, triangles: post.tris || info.render.triangles, lines: info.render.lines, points: info.render.points, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs ? info.programs.length : null, heapMB: mem,
      counts: { baked: baked.meshes.length, bakedDraws: baked.draws, inter: inter.length, dyn: dyn.length, solids: solids.length, animated: animated.length, lights: lights, props: Object.keys(propInst).length, lightBudget: lightBudget.n, shadows: !!renderer.shadowMap.enabled } };
  }

  CO.editor = {
    on: false, drag: false, bind: editorBind,
    tree: editorTree, children: editorChildren, inspect: editorInspect, set: editorSet, select: editorSelect, pick: editorPick, frame: editorFrame, spawn: editorSpawn, remove: editorRemove, assets: editorAssets, shot: editorShot,
    mode: editorMode, enter: editorEnter, pause: function (v) { CO.paused = v === undefined ? !CO.paused : !!v; return CO.paused; }, step: function () { CO.stepOnce = true; return 'step'; },
    selected: function () { return editorSel; }, state: function () { return devState(); }, sfx: function (k) { sfx(k); return k; }, command: function (name, arg) { return devCommand(name, arg); }, log: function (n) { return S && S.log ? S.log.slice(0, n || 30) : []; },
    undo: editorUndoStep, redo: editorRedoStep, history: editorHistory, get: editorGet,
    source: editorSource, preview: editorPreview, revert: editorRevert, define: editorDefine, kit: function () { return Object.keys(editorKit()); },
    profile: editorProfile, adopt: function (type) { delete ORIG_BUILD[type]; return 'ok'; },
    layout: editorLayout, layoutAdopt: editorLayoutAdopt,
    setTool: editorSetTool, tool: function () { return editorTool; },
    setTool: editorSetTool, tool: function () { return editorTool; },
    terrain: terrainState, terrainY: terrainY, terrainBrush: function (x, z, mode, radius, strength, tex) { if (!TERRAIN.on) return terrainBrush(x, z, mode, radius, strength, tex); var bh = Float32Array.from(TERRAIN.heights), bp = Uint8Array.from(TERRAIN.paint), r = terrainBrush(x, z, mode, radius, strength, tex); if (r && r.changed) { var ah = Float32Array.from(TERRAIN.heights), ap = Uint8Array.from(TERRAIN.paint); histPush('terrain ' + mode, function () { terrainRestore(bh, bp); }, function () { terrainRestore(ah, ap); }); } return r; }, terrainPick: terrainPick, terrainCode: terrainCode, terrainScatter: terrainScatter,
    terrainNew: function (cfg) { cfg = cfg || {}; var T = CO.terrain({ w: cfg.w || 48, d: cfg.d || 48, cell: cfg.cell || 1, x0: cfg.x0, z0: cfg.z0, palette: cfg.palette, maxH: cfg.maxH }); if (!T.mesh) terrainBuild(); NAV.dirty = true; return terrainState(); },
    terrainOff: function () { var T = TERRAIN; if (T.mesh) { if (T.mesh.parent) T.mesh.parent.remove(T.mesh); T.mesh = null; } T.on = false; T.heights = null; T.paint = null; NAV.dirty = true; shadowDirty = true; return terrainState(); },
    materials: matGraphs, material: function (name, graph) { var prev = MATGRAPH[name] ? JSON.parse(JSON.stringify(MATGRAPH[name])) : null, next = JSON.parse(JSON.stringify(graph || {})); matBuild(name, next); histPush('material ' + name, function () { if (prev) matBuild(name, prev); else matRemove(name); }, function () { matBuild(name, next); }); return { ok: true, name: name, shot: matShot(name) }; }, materialShot: matShot, materialCode: matGraphCode, materialRemove: matRemove,
    clips: clipList, clip: function (name, clip) { if (!name) return { error: 'a clip needs a name' }; var c = CO.clip(name, clip); return { ok: true, name: name, duration: c.duration, tracks: c.tracks.length }; }, clipRemove: function (name) { if (!CLIPS[name]) return false; CO.clip(name, null); return true; }, clipCode: clipCode,
    clipPlay: function (id, name, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; if (!CLIPS[name]) return { error: 'no clip ' + name }; var P = playClip(o, name, opt || {}); return P ? { ok: true, name: name, tracks: P.tracks.length, duration: P.clip.duration, loop: P.loop } : { error: 'the clip did not start' }; },
    clipStop: function (id) { var o = eobj(id); if (o) stopClip(o); return !!o; },
    clipSeek: function (id, name, t) { var o = eobj(id), c = CLIPS[name]; if (!o || !c) return { error: 'no such object or clip' }; stopClip(o); c.tracks.forEach(function (tr) { var tg = clipTarget(o, tr.path); if (tg) { var v = trackValue(tr.keys, t); if (v !== undefined) tg.set(v); } }); return { ok: true, t: t }; },
    clipKey: function (id, name, t, ease) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var n = clipKeyPose(o, name, +t || 0, ease); return n === null ? { error: 'no clip ' + name } : { ok: true, keyed: n, t: +t || 0 }; },
    clipPaths: function (id) { var o = eobj(id); if (!o) return []; var u = o.userData || {}, out = ['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'scale.x', 'scale.y', 'scale.z', 'visible']; if (u.legs) ['leg.0', 'leg.1', 'knee.0', 'knee.1', 'arm.0', 'arm.1', 'elbow.0', 'elbow.1', 'torso', 'head'].forEach(function (p) { out.push(p + '.rotation.x', p + '.rotation.y', p + '.rotation.z'); out.push(p + '.position.y'); }); o.children.forEach(function (ch, i) { if (ch.userData.editor) return; ['rotation.x', 'rotation.y', 'rotation.z', 'position.x', 'position.y', 'position.z'].forEach(function (f) { out.push('child.' + i + '.' + f); }); if (ch.name) out.push('name.' + ch.name + '.rotation.y'); }); return out; },
    ui: uiData, uiSet: function (data) { var prev = uiData(), next = JSON.parse(JSON.stringify(data || {})); CO.ui(next); if (ui.panelOpen) renderPanel(); histPush('UI', function () { CO.ui(prev); }, function () { CO.ui(next); }); return uiData(); },
    tables: tablesList, tableSet: tableSet, tablesCode: tablesCode, uiCode: uiCode, uiOpen: function (kind) { openPanel(kind); return !!UI.panels[kind]; }, uiEval: uiEval,
    packCode: function (types) { var ids = (types && types.length ? types : PROP_ORDER.filter(function (id) { return !/^pk[A-Z]/.test(id); })).filter(function (id) { return PROPS[id] && PROPS[id].build; }); var lines = ['//@ a pack made in the Co Engine editor from ' + (CO.game && CO.game.handle || 'a game') + '\'s props. A prop that calls the game\'s own functions needs them in the game it goes to.']; ids.forEach(function (id) { var d = PROPS[id], f = {}; ['label', 'cat', 'wall', 'fixed', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (d[k] !== undefined) f[k] = d[k]; }); f.extra = true; f.shop = false; var body = JSON.stringify(f); lines.push('  defProp(' + JSON.stringify(id) + ', Object.assign(' + body + ', { build: ' + d.build.toString() + (d.after ? ', after: ' + d.after.toString() : '') + ' }));'); }); return { ids: ids, code: lines.join('\n') + '\n' }; },
    run: function (code) { var r = closureRun(String(code)); try { return r === undefined ? null : JSON.parse(JSON.stringify(r)); } catch (e) { return String(r); } },
    model: modelOf, modelPreview: modelPreview, modelStart: modelStart, modelPick: modelPick, modelMirror: modelMirror, modelCode: modelCode, modelConvert: modelConvert, worldCode: worldCode, selection: function () { return editorMulti.slice(); }, duplicate: editorDuplicate, copy: editorCopy, paste: editorPaste, worldCopies: function () { return WORLD_COPIES.slice(); }, selectMany: function (ids) { editorMulti = (ids || []).filter(function (k) { return !!eobj(k); }); editorSel = editorMulti[editorMulti.length - 1] || null; editorHelpersShow(); return editorMulti.slice(); }, moveSel: editorMoveSel, removeSel: editorRemoveSel, worldItems: function () { return WORLD_ITEMS.map(function (o) { return { id: eid(o), key: o.userData.worldKey, name: worldName(o), hidden: !o.visible }; }); },
    physics: physicsState, bodyAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var B = body(o, opt || {}); return { ok: true, id: B.id, size: [B.hx * 2, B.hy * 2, B.hz * 2] }; }, bodyRemove: function (id) { var o = eobj(id); return !!o && removeBody(o); }, impulse: function (id, vx, vy, vz) { var o = eobj(id); return !!o && impulse(o, vx, vy, vz); },
    springAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var S2 = spring(o, opt || {}); return { ok: true, anchor: S2.anchor, k: S2.k }; }, springRemove: function (id) { var o = eobj(id); return !!o && unspring(o); },
    drop: editorDrop, hingeAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var H = hinge(o, opt || {}); return { ok: true, pivot: H.pivot, length: H.length, axis: H.axis }; }, hingeRemove: function (id) { var o = eobj(id); return !!o && removeHinge(o); },
    ids: function () { return { props: Object.keys(propInst), objects: Object.keys(EOBJ) }; }
  };
  // ── The prop modeller ─────────────────────────────────────────────
  // A part: { kind, mat, x, y, z, ry (degrees), name } plus, by kind: box { w, h, d, r (bevel) }, cyl { r, h, seg, rb }, sphere { r },
  // plane { w, h, rx }, sign { lines, w, h }, light { color, intensity, dist }, solid { w, d, h } (an obstacle, not drawn), hit { w, h, d, prompt }.
  // A model: { parts: [...], autoSolid: true } (autoSolid adds one obstacle around every box and cylinder that touches the ground).
  var MODEL_MARK = '/*@model ';
  function modelFrom(code) { var i = String(code || '').indexOf(MODEL_MARK); if (i < 0) return null; var j = code.indexOf('*/', i); if (j < 0) return null; try { return JSON.parse(code.slice(i + MODEL_MARK.length, j).trim()); } catch (e) { return null; } }
  function n2(v) { return Math.round((+v || 0) * 1000) / 1000; }
  function matRef(m) { return /^[A-Za-z_]\w*$/.test(m || '') ? 'MAT.' + m : 'MAT.grey'; }
  function packMat(pk, path, hex, rough, metal) { var get = CO.packMats && CO.packMats[pk], v = get ? get() : null; String(path).split('.').forEach(function (k) { v = v && typeof v === 'object' ? v[k] : null; }); return v && v.isMaterial ? v : hex ? modelMat(hex, rough === undefined ? 0.8 : rough, metal || 0) : MAT.grey; }
  function partMat(p) { if (p.img && !p.mat) return 'modelImgMat(' + JSON.stringify(p.img) + ', ' + JSON.stringify(p.color || '#ffffff') + ', ' + (p.basic ? 1 : 0) + ', ' + (p.clear || 0) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) + ')'; if (p.mat && p.mat.indexOf('/') > 0) { var sl = p.mat.indexOf('/'); return 'packMat(' + JSON.stringify(p.mat.slice(0, sl)) + ', ' + JSON.stringify(p.mat.slice(sl + 1)) + (p.color ? ', ' + JSON.stringify(p.color) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) : '') + ')'; } return !p.mat && p.color ? 'modelMat(' + JSON.stringify(p.color) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) + (p.glow || p.opacity !== undefined ? ', ' + JSON.stringify(p.glow || '') : '') + (p.opacity !== undefined ? ', ' + n2(p.opacity) : '') + ')' : matRef(p.mat); }
  function modelPartCode(p, i) {
    var x = n2(p.x), y = n2(p.y), z = n2(p.z), ry = (p.rx || p.rz) && p.kind !== 'plane' ? ' p' + i + '.rotation.set(' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ', ' + n2((p.rz || 0) * Math.PI / 180) + ', "YXZ");' : p.ry ? ' p' + i + '.rotation.y = ' + n2(p.ry * Math.PI / 180) + ';' : '', tag = ' p' + i + '.userData.part = ' + i + ';';
    if (p.kind === 'box') return p.r ? 'var p' + i + ' = box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ', { parent: c.group, r: ' + n2(p.r) + ' });' + ry + tag : 'var p' + i + ' = c.box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ');' + ry + tag;
    if (p.kind === 'mesh') { var vs = (p.verts || []).map(function (q) { return [n2(q[0]), n2(q[1]), n2(q[2])]; }), fs = (p.faces || []).map(function (q) { return [q[0] | 0, q[1] | 0, q[2] | 0]; }); return 'var p' + i + ' = (function () { var V = ' + JSON.stringify(vs) + ', F = ' + JSON.stringify(fs) + ', pos = [], map = []; F.forEach(function (f) { f.forEach(function (k) { pos.push(V[k][0], V[k][1], V[k][2]); map.push(k); }); }); var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); var m = new THREE.Mesh(geo, ' + partMat(p) + '); m.castShadow = m.receiveShadow = true; m.userData.vertexEdit = true; m.userData.vertMap = map; return c.add(m); })(); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + ');' + ry + tag; }
    if (p.kind === 'lathe') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.LatheGeometry(' + JSON.stringify((p.points || [[0.3, 0], [0.4, 0.5], [0.2, 1]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), ' + (p.seg || 24) + '), ' + partMat(p) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'extrude') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(' + JSON.stringify((p.shape || [[-0.5, 0], [0.5, 0], [0, 0.8]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); })), { depth: ' + n2(p.depth || 0.2) + ', bevelEnabled: false }), ' + partMat(p) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'cyl') return 'var p' + i + ' = c.cyl(' + n2(p.r) + ', ' + n2(p.h) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + (p.seg || p.rb ? ', ' + (p.seg || 16) + (p.rb ? ', ' + n2(p.rb) : '') : '') + ');' + ry + tag;
    if (p.kind === 'sphere') return 'var p' + i + ' = c.sphere(' + n2(p.r) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'plane') return 'var p' + i + ' = c.plane(' + n2(p.w) + ', ' + n2(p.h) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ');' + tag;
    if (p.kind === 'sign') return 'var p' + i + ' = c.sign(' + JSON.stringify(p.lines || ['SIGN']) + ', ' + n2(p.w || 1) + ', ' + n2(p.h || 0.4) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.ry || 0) * Math.PI / 180) + (p.opt ? ', ' + JSON.stringify(p.opt) : '') + ');' + (' if (p' + i + ' && p' + i + '.userData) p' + i + '.userData.part = ' + i + ';');
    if (p.kind === 'light') return 'var p' + i + ' = c.light(' + JSON.stringify(p.color || '#ffd9a0') + ', ' + n2(p.intensity || 1) + ', ' + n2(p.dist || 8) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'solid') return 'c.solid(' + n2(x - p.w / 2) + ', ' + n2(x + p.w / 2) + ', ' + n2(z - p.d / 2) + ', ' + n2(z + p.d / 2) + ', ' + n2(y) + ', ' + n2(y + p.h) + ');';
    if (p.kind === 'hit') return 'c.hit(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + x + ', ' + y + ', ' + z + ', { prompt: function () { return ' + JSON.stringify(p.prompt || 'Use it') + '; }, use: function () { toast(' + JSON.stringify(p.prompt || 'Used') + ', ""); } });';
    return '';
  }
  function modelCode(model) {
    model = model || { parts: [] }; var lines = ['function (c, P, inst) {', '  ' + MODEL_MARK + JSON.stringify(model) + ' */'];
    (model.parts || []).forEach(function (p, i) { var l = modelPartCode(p, i); if (l) lines.push('  ' + l); });
    if (model.autoSolid !== false) (model.parts || []).forEach(function (p) { if ((p.kind === 'box' || p.kind === 'cyl') && n2(p.y) - (p.kind === 'box' ? p.h : p.h) / 2 < 0.3) { var hw = p.kind === 'box' ? p.w / 2 : p.r, hd = p.kind === 'box' ? p.d / 2 : p.r, top = n2(p.y) + p.h / 2; lines.push('  c.solid(' + n2(p.x - hw) + ', ' + n2(p.x + hw) + ', ' + n2(p.z - hd) + ', ' + n2(p.z + hd) + ', 0, ' + n2(top) + ');'); } });
    lines.push('}'); return lines.join('\n');
  }
  function modelOf(type) { var def = PROPS[type]; if (!def || !def.build) return { error: 'no prop definition ' + type }; var src = def.build.toString(), m = modelFrom(src); return { type: type, model: m, modelled: !!m, code: src, mats: modelMatList(m) }; }
  function modelMatList(m) { var out = Object.keys(MAT).filter(function (k) { return k !== 'hit'; }); ((m && m.parts) || []).forEach(function (p) { if (p.mat && out.indexOf(p.mat) < 0) out.push(p.mat); }); return out; }
  function modelPreview(type, model) { var code = modelCode(model); var r = editorPreview(type, code); r.code = code; return r; }
  function modelStart(type) { var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type }; var m = { parts: [{ kind: 'box', mat: 'wood', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, ry: 0 }], autoSolid: true }; return modelPreview(type, m).ok ? { ok: true, model: m, code: modelCode(m) } : { error: 'the first box did not build' }; }
  // which part of a modelled prop is under a viewport point
  function modelPick(type, nx, ny) { var ids = propTypeIds(type); scene.updateMatrixWorld(true); eRay.setFromCamera({ x: nx || 0, y: ny || 0 }, camera); eRay.far = 120; for (var k = 0; k < ids.length; k++) { var inst = propInst[ids[k]]; if (!inst) continue; var hits = eRay.intersectObject(inst.g, true); for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && o !== inst.g) { if (o.userData && o.userData.part !== undefined) return { part: o.userData.part, id: ids[k], distance: rnd(hits[i].distance) }; o = o.parent; } } } return null; }
  function modelMirror(model, axis) { var m = JSON.parse(JSON.stringify(model)); m.parts.forEach(function (p) { if (axis === 'z') { p.z = -n2(p.z); if (p.ry) p.ry = -p.ry; if (p.rx) p.rx = -p.rx; if (p.verts) p.verts.forEach(function (v) { v[2] = -v[2]; }); } else { p.x = -n2(p.x); if (p.ry) p.ry = -p.ry; if (p.rz) p.rz = -p.rz; if (p.verts) p.verts.forEach(function (v) { v[0] = -v[0]; }); } if (p.faces) p.faces.forEach(function (f) { var s = f[1]; f[1] = f[2]; f[2] = s; }); }); return m; }
  // ── Parts from a prop drawn in code (0.8.0) ──────────────────────
  // The selected prop's placed copy is read back as a model: every box, cylinder, sphere and plane keeps its size and turn, a sign
  // keeps its lines, a light its colour, a use box its prompt, an obstacle becomes a solid, and any other shape becomes a mesh of
  // its corners (vertex drag works on it). A material the palette names keeps its name; any other keeps its colour, roughness,
  // metalness and glow (a picture or a texture drawn in code becomes its plain colour). Nothing is built to read it: the copy that
  // stands is what is read, so no stray uses or screens are left behind.
  var modelMats = {}, modelImgs = {};
  // a picture drawn in code, carried in the model as a PNG (at most 512 px a side) and made into a material once per picture
  function modelImgMat(src, hex, basic, clear, rough, metal) {
    var k = src.length + ':' + src.slice(-48) + hex + basic + clear + rough + metal; if (modelImgs[k]) return modelImgs[k];
    var t = new THREE.TextureLoader().load(src); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var o = { map: t, color: new THREE.Color(hex), transparent: !!clear, opacity: typeof clear === 'number' && clear > 0 && clear < 1 ? clear : 1 }; return (modelImgs[k] = basic ? new THREE.MeshBasicMaterial(o) : std(Object.assign(o, { roughness: rough, metalness: metal })));
  }
  function imgOf(map) { var im = map && map.image; if (!im || !(im.width > 0) || !(im.height > 0)) return null; try { var s = Math.min(1, 512 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL('image/png'); } catch (e) { return null; } }
  function modelMat(hex, rough, metal, glow, opacity) { var see = typeof opacity === 'number' && opacity < 1, k = hex + ',' + rough + ',' + metal + ',' + (glow || '') + ',' + (see ? opacity : ''); if (!modelMats[k]) modelMats[k] = std({ color: new THREE.Color(hex), roughness: rough, metalness: metal, emissive: glow ? new THREE.Color(glow) : new THREE.Color(0), emissiveIntensity: glow ? 1 : 0, transparent: see, opacity: see ? opacity : 1, depthWrite: !see }); return modelMats[k]; }
  // which pack names a material: a carried variable, or an entry of a table or a cache one holds ("growco/MAT.wood", "depotco/FABRIC")
  function packMatName(m) {
    if (!m || !CO.packMats) return null;
    for (var pk in CO.packMats) { var vals; try { vals = CO.packMats[pk](); } catch (e) { continue; }
      for (var k in vals) { var v = vals[k]; if (!v || typeof v !== 'object') continue; if (v === m) return pk + '/' + k; if (v.isMaterial || v.isTexture || v.isObject3D || v.isBufferGeometry) continue;
        var ks = Object.keys(v); if (ks.length > 4000) continue; for (var j = 0; j < ks.length; j++) if (v[ks[j]] === m && /^[\w$]+$/.test(ks[j])) return pk + '/' + k + '.' + ks[j]; } }
    return null;
  }
  function modelConvert(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var ids = propTypeIds(type), inst = null; for (var k = 0; k < ids.length && !inst; k++) inst = propInst[ids[k]] || null;
    if (!inst) return { error: 'place a ' + (def.label || type) + ' first: the parts are read from a copy that stands' };
    var root = inst.g; root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), eu = new THREE.Euler(), D = 180 / Math.PI;
    var parts = [], stats = { box: 0, cyl: 0, sphere: 0, plane: 0, sign: 0, mesh: 0, light: 0, hit: 0, solid: 0, colour: 0, skipped: 0 }, skip = [];
    function near0(a) { return Math.abs(a) < 1e-3; }
    function hex(c) { return '#' + c.getHexString(); }
    function matOf(m, p) {
      if (Array.isArray(m)) m = m[0];
      for (var key in MAT) if (MAT[key] === m) { p.mat = key; return; }
      var pm = packMatName(m); if (pm) { p.mat = pm; if (m.color) { p.color = hex(m.color); p.rough = typeof m.roughness === 'number' ? n2(m.roughness) : 0.8; p.metal = typeof m.metalness === 'number' ? n2(m.metalness) : 0; } stats.pack = (stats.pack || 0) + 1; return; }
      if (m && m.map && m.map !== (typeof blobTex !== 'undefined' ? blobTex : null)) { var img = imgOf(m.map); if (img) { p.img = img; p.basic = !!m.isMeshBasicMaterial; p.clear = m.transparent ? (m.opacity < 1 ? n2(m.opacity) : 1) : 0; stats.picture = (stats.picture || 0) + 1; } }
      if (!p.img) stats.colour++; p.color = m && m.color ? hex(m.color) : '#888888'; p.rough = m && typeof m.roughness === 'number' ? n2(m.roughness) : 0.8; p.metal = m && typeof m.metalness === 'number' ? n2(m.metalness) : 0;
      if (m && m.emissive && m.emissive.getHex() && (m.emissiveIntensity || 0) > 0) p.glow = hex(m.emissive.clone().multiplyScalar(Math.min(1, m.emissiveIntensity)));
      if (m && m.transparent && m.opacity < 1) p.opacity = n2(m.opacity);
    }
    // a shape whose corners were moved after it was made (a bent frond, a tapered leg) is only what its numbers say if its bounds agree
    function shapeHolds(g, t, P) {
      var b = new THREE.Box3().setFromBufferAttribute(g.attributes.position), ok = function (v, w) { return Math.abs(v - w) < 2e-3; };
      if (t === 'BoxGeometry') return ok(b.min.x, -P.width / 2) && ok(b.max.x, P.width / 2) && ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && ok(b.min.z, -P.depth / 2) && ok(b.max.z, P.depth / 2);
      if (t === 'CylinderGeometry') { var rm = Math.max(P.radiusTop, P.radiusBottom); return ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && b.max.x <= rm + 2e-3 && b.max.x >= rm * 0.7 && b.max.z <= rm + 2e-3; }
      if (t === 'SphereGeometry') return ok(b.max.y, P.radius) && ok(b.min.y, -P.radius) && ok(b.max.x, P.radius);
      if (t === 'PlaneGeometry') return ok(b.min.x, -P.width / 2) && ok(b.max.x, P.width / 2) && ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && ok(b.min.z, 0) && ok(b.max.z, 0);
      return false;
    }
    function under(o, list) { for (var a = o.parent; a && a !== root; a = a.parent) if (list.indexOf(a) >= 0) return true; return false; }
    root.traverse(function (o) {
      if (o === root || under(o, skip)) return;
      for (var a = o; a && a !== root; a = a.parent) if (a.visible === false && !a.userData.bakedAway && !(a.isMesh && a.material === MAT.hit)) return;   /* a piece the static bake merged away is hidden but still part of the prop */
      M.multiplyMatrices(inv, o.matrixWorld); M.decompose(pos, q, sc);
      var x = n2(pos.x), y = n2(pos.y), z = n2(pos.z);
      if (o.isPointLight) { parts.push({ kind: 'light', color: hex(o.color), intensity: n2(o.intensity), dist: n2(o.distance || 8), x: x, y: y, z: z }); stats.light++; return; }
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || (blobMat && o.material === blobMat)) return;   /* the contact shadow is the engine's, laid again under the rebuilt prop */
      var g = o.geometry, P = g.parameters || {}, t = g.type, p = null;
      if (o.material === MAT.hit || (o.material && o.material.visible === false)) {
        if (t !== 'BoxGeometry') return; var it = o.userData.it, pr = null; try { pr = it && (typeof it.prompt === 'function' ? it.prompt() : it.prompt); } catch (e) {}
        parts.push({ kind: 'hit', w: n2(P.width * sc.x), h: n2(P.height * sc.y), d: n2(P.depth * sc.z), x: x, y: y, z: z, prompt: typeof pr === 'string' && pr ? pr : 'The ' + (def.label || type) }); stats.hit++; return;
      }
      var R = new THREE.Matrix4().compose(pos, q, sc), sheared = false; for (var e = 0; e < 16; e++) if (Math.abs(R.elements[e] - M.elements[e]) > 1e-4) sheared = true;   /* a turn under a stretched parent skews: only a mesh holds that */
      eu.setFromQuaternion(q, 'YXZ'); var upright = near0(eu.x) && near0(eu.z);
      if (o.userData.sign && t === 'PlaneGeometry' && upright && !sheared && shapeHolds(g, t, P)) { skip.push(o); p = { kind: 'sign', lines: o.userData.sign.lines, w: n2(P.width * sc.x), h: n2(P.height * sc.y), x: x, y: y, z: z, ry: n2(eu.y * D) }; if (o.userData.sign.opt) p.opt = o.userData.sign.opt; parts.push(p); stats.sign++; return; }
      if (sheared || !shapeHolds(g, t, P)) p = null;
      else if (t === 'BoxGeometry') p = { kind: 'box', w: n2(P.width * Math.abs(sc.x)), h: n2(P.height * Math.abs(sc.y)), d: n2(P.depth * Math.abs(sc.z)) };
      else if (t === 'CylinderGeometry' && Math.abs(sc.x - sc.z) < 1e-3) { p = { kind: 'cyl', r: n2(P.radiusTop * sc.x), h: n2(P.height * sc.y), seg: P.radialSegments }; if (Math.abs(P.radiusBottom - P.radiusTop) > 1e-4) p.rb = n2(P.radiusBottom * sc.x); }
      else if (t === 'SphereGeometry' && Math.abs(sc.x - sc.y) < 1e-3 && Math.abs(sc.x - sc.z) < 1e-3 && upright) p = { kind: 'sphere', r: n2(P.radius * sc.x) };
      else if (t === 'PlaneGeometry') { var ex = new THREE.Euler().setFromQuaternion(q, 'XYZ'); if (near0(ex.z)) { p = { kind: 'plane', w: n2(P.width * sc.x), h: n2(P.height * sc.y), x: x, y: y, z: z, rx: n2(ex.x * D), ry: n2(ex.y * D) }; matOf(o.material, p); parts.push(p); stats.plane++; return; } p = null; }
      if (p) { p.x = x; p.y = y; p.z = z; if (!near0(eu.y)) p.ry = n2(eu.y * D); if (!upright) { p.rx = n2(eu.x * D); p.rz = n2(eu.z * D); } matOf(o.material, p); parts.push(p); stats[p.kind]++; return; }
      // any other shape: a mesh of its corners in the prop's own space, a corner shared where faces meet
      var pa = g.attributes && g.attributes.position; if (!pa || pa.count > 6000) { stats.skipped++; return; }
      var V = [], F = [], seen = {}, v = new THREE.Vector3(), idx = g.index, flip = M.determinant() < 0;
      var vid = function (i) { v.fromBufferAttribute(pa, i).applyMatrix4(M); var key = n2(v.x) + ',' + n2(v.y) + ',' + n2(v.z); if (seen[key] === undefined) { seen[key] = V.length; V.push([n2(v.x), n2(v.y), n2(v.z)]); } return seen[key]; };
      var n = idx ? idx.count : pa.count; for (var f = 0; f + 2 < n; f += 3) { var a0 = vid(idx ? idx.getX(f) : f), a1 = vid(idx ? idx.getX(f + 1) : f + 1), a2 = vid(idx ? idx.getX(f + 2) : f + 2); if (a0 !== a1 && a1 !== a2 && a0 !== a2) F.push(flip ? [a0, a2, a1] : [a0, a1, a2]); }
      if (!F.length) return; p = { kind: 'mesh', x: 0, y: 0, z: 0, verts: V, faces: F }; matOf(o.material, p); parts.push(p); stats.mesh++;
    });
    (inst.ctx && inst.ctx.obstacles || []).forEach(function (ob) { parts.push({ kind: 'solid', w: n2(ob.x1 - ob.x0), d: n2(ob.z1 - ob.z0), h: n2(ob.y1 - ob.y0), x: n2((ob.x0 + ob.x1) / 2), y: n2(ob.y0), z: n2((ob.z0 + ob.z1) / 2) }); stats.solid++; });
    if (!parts.length) return { error: (def.label || type) + ' has nothing to read back' };
    var model = { parts: parts, autoSolid: false }, r = modelPreview(type, model);
    if (!r.ok) return { error: 'the parts did not build: ' + r.error };
    return { ok: true, model: model, code: r.code, stats: stats, mats: modelMatList(model) };
  }
  // ── Boot ──────────────────────────────────────────────────────────
  // The game's last part calls CO.boot(GAME). GAME carries the hooks (they merge into CO.game) and these steps, every one optional:
  //   freshState()             the game's default S              migrate(s, fresh)      its save migrations
  //   afterLoad(loaded)        repairs on S before the world      buildWorld(loaded)     the walls, the props (buildProps), the people
  //   afterBuild(loaded)       meshes for the saved things        startStats(loaded)     the start screen chips, as strings
  //   startNote(loaded)        the line under the chips           onEnter(loaded)        the first thing after the start button
  //   tick(dt)                 the world, once a frame while running    present(dt)     the game's own per-frame presentation
  //   menuCamera(dt)           the camera behind the start screen       hiddenTick(dt)  what still ticks in a hidden tab
  //   T                        what the game adds to the test handle    handle          the window property ('DEPOT')
  //   bake false               skip the static bake                     weather false   no weather state machine
  //   autoplay false           the game's own front menu handles the autoplay flag
  //   input false (in CO.setup)  the game binds its own keys and mouse;  editMode false, photo false, lighting false, hudFields false: those engine passes stay off
  //   render(dt)               the game draws the frame itself (return true)
  var loaded = false, autosaveT = 0, fpsN = 0, fpsT = 0, lastFrame = 0;
  function coBoot(GAME) {
    GAME = GAME || {}; if (!CO.game) CO.game = {}; for (var k in GAME) if (!(k in CO.game)) CO.game[k] = GAME[k]; CO.gameVersion = GAME.version || window[GAME.versionGlobal || 'GAME_VERSION'] || CO.gameVersion;
    loaded = loadSave(GAME.freshState || function () { return { day: 1, time: CAL.dayStart, bank: 0, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {} }; }, GAME.migrate);
    if (GAME.afterLoad) GAME.afterLoad(loaded);
    runHooks('beforeBuild', loaded);
    terrainBuild();
    if (GAME.buildWorld) GAME.buildWorld(loaded);
    runHooks('afterBuild', loaded);
    if (GAME.afterBuild) GAME.afterBuild(loaded);
    worldEditsApply();   // part 26: what the editor moved, resized or removed of the world, before the bake
    applySettings(); resize();
    if (GAME.bake !== false && !/nobake=1/.test(location.search)) bakeStatic();
    if (!GAME.menuCamera) { camera.position.set(12, 3.6, 0); camera.lookAt(0, 1.4, 0); }   // a game with a menu camera of its own places the camera itself
    var st = $('dc-start-stats'); if (st) st.innerHTML = (GAME.startStats ? GAME.startStats(loaded) : (UI.start.length ? uiStartChips() : [loaded ? 'Day ' + S.day : 'New game'])).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
    var sn = $('dc-start-note'); if (sn) sn.textContent = GAME.startNote ? GAME.startNote(loaded) : ('Slot ' + BOOT_SLOT + (loaded ? ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : ''));
    var sb = $('dc-start-btn'); if (sb) sb.addEventListener('click', enter);
    requestAnimationFrame(frame);
    // a hidden tab gets no animation frames; the world still ticks ten times a second
    setInterval(function () { if (!document.hidden) return; var n = performance.now(), dt = Math.min(0.05, Math.max(0.001, (n - lastFrame) / 1000)); lastFrame = n; worldTime += dt; if (ui.started && !ui.blocked() && !photo.on) { if (CO.game.tick) CO.game.tick(dt); updatePlayer(dt); doorsTick(dt); if (CO.game.hiddenTick) CO.game.hiddenTick(dt); scene.updateMatrixWorld(true); updateFocus(); updatePrompt(); } }, 50);
    window.addEventListener('beforeunload', function () { if (ui.started) saveNow(); });
    var handle = { enter: enter, bootSlot: BOOT_SLOT, version: CO.gameVersion || 'dev', engine: CO.version, T: coHandle() };
    if (GAME.T) { var gt = typeof GAME.T === 'function' ? GAME.T() : GAME.T; for (var tk in gt) handle.T[tk] = gt[tk]; }
    window[GAME.handle || 'CO_GAME'] = handle; CO.handle = handle; window.CO_EDITOR = CO.editor;   // the editor and the MCP server reach the bridge here, outside the closure
    if (/[?&]editor=1/.test(location.search)) { CO.editor.on = true; CO.editor.bind(); }   // opened in the editor's viewport: clicks select, the right button flies
    // <prefix>-autoplay in sessionStorage (or ?autoplay=1) presses the start button on the first frame; GAME.autoplay false leaves
    // the flag to the game's own front menu, which reads and presses it itself
    if (GAME.autoplay !== false) { var auto = false; try { auto = sessionStorage.getItem(CO.save.prefix + '-autoplay') === '1'; if (auto) sessionStorage.removeItem(CO.save.prefix + '-autoplay'); } catch (e) {} if (auto || /[?&]autoplay=1/.test(location.search)) setTimeout(enter, 50); }
    runHooks('boot', loaded);
    return handle;
  }
  function enter() {
    if (ui.started) return;
    ui.started = true; var s = $('dc-start'); if (s) s.hidden = true; var h = $('dc-hud'); if (h) h.hidden = false; hudDirty = true;
    lockPointer(); sfx('ok');
    if (CO.game.onEnter) CO.game.onEnter(loaded);
    if (/[?&]dev=1/.test(location.search) && !devLink.on) devLinkToggle();
    runHooks('enter', loaded);
  }
  // ── The frame loop ────────────────────────────────────────────────
  function frame(nowMs) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrame) / 1000)); lastFrame = nowMs;
    // paused by the editor: the world holds, the scene camera still flies, the frame still draws; one step runs a single frame through
    if (CO.paused && !CO.stepOnce) { if (photo.on && CO.game.photo !== false) photoTick(dt); updateLightBudget(); shadowTick(dt); if (!(CO.game.render && CO.game.render(dt))) renderFrame(dt); return; }
    CO.stepOnce = false; profBegin(); var pf = PROF.on ? performance.now() : 0;
    if (!ui.started) { if (CO.game.menuCamera) CO.game.menuCamera(dt); else { var ma = worldTime * 0.07; camera.position.set(Math.cos(ma) * 12, 3.6 + Math.sin(ma * 1.7) * 0.6, Math.sin(ma) * 9.5); camera.lookAt(Math.cos(ma + 1.2) * 4, 1.4, Math.sin(ma + 1.2) * 3); } }
    if (ui.started && !ui.blocked()) { if (photo.on && CO.game.photo !== false) photoTick(dt); else { if (CO.game.tick) CO.game.tick(dt); if (CO.game.weather !== false) tickWeatherState(dt); updatePlayer(dt); } autosaveT += dt; if (autosaveT > 30) { autosaveT = 0; save(); } }
    profMark('sim', pf); pf = PROF.on ? performance.now() : 0;
    worldTime += dt;
    if (CO.game.lighting !== false) lighting(dt); updateLightBudget(); shadowTick(dt); if (sky.dome || sky.rain) tickSky(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); editTick(); tickTraffic(dt);
    profMark('world', pf); pf = PROF.on ? performance.now() : 0;
    if (CO.game.present) CO.game.present(dt); runHooks('frame', dt);
    for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    profMark('present', pf); pf = PROF.on ? performance.now() : 0;
    updateFocus(); updatePrompt(); updateHud(dt); tickCards(dt); tickDevLink(dt);
    profMark('ui', pf); pf = PROF.on ? performance.now() : 0;
    if (!(CO.game.render && CO.game.render(dt))) renderFrame(dt);
    profMark('render', pf); profEnd();   // a game may render the frame itself (a security camera view, a picture in picture)
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { var f = $('h-fps'); if (f) f.textContent = Math.round(fpsN / fpsT) + ' fps · ' + (post.calls || renderer.info.render.calls) + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  // ── The handle: the engine's part of window.<handle>.T, for the editor and the smoke tests ──
  function coHandle() {
    return {
      get S() { return S; }, CO: CO, editor: CO.editor, player: player, ui: ui, edit: edit, photo: photo, SET: SET, scene: scene, camera: camera, renderer: renderer, baked: baked, MAT: MAT, TEX: TEX, NRM: NRM, solids: solids, dyn: dyn, inter: inter, screens: screens, hdoors: hdoors, lampMeshes: lampMeshes, sky: sky, NAV: NAV, PROPS: PROPS, propInst: propInst, HOOKS: HOOKS,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { if (CO.game.tick) CO.game.tick(0.05); if (CO.game.step) CO.game.step(0.05); } scene.updateMatrixWorld(true); },
      setTime: function (h) { S.time = h; hudDirty = true; },
      save: save, saveNow: saveNow, loadSave: loadSave, pay: pay, enter: enter, floorY: floorY, route: route, navFreeAt: navFreeAt, collides: collides, updatePlayer: updatePlayer, updateFocus: updateFocus, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); updateFocus(); return focusText; },
      buildProp: buildProp, buildProps: buildProps, propPlacement: propPlacement, propWorld: propWorld, removePropInst: removePropInst, catalogueData: catalogueData, editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy,
      panelAct: panelAct, hd: hd, doorById: doorById, doorUse: doorUse, doorLock: doorLock, doorsTick: doorsTick, doorSolids: doorSolids, lockAll: lockAll, drawScreens: drawScreens, screenTap: screenTap, screenZoneAt: screenZoneAt, screenDirtyAll: screenDirtyAll,
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, panelHtml: function () { var b = $('dc-panel-body'); return b ? b.innerHTML : ''; }, openMenu: openMenu, closeMenu: closeMenu, menuAct: menuAct, settingsHtml: settingsHtml, applySettings: applySettings, showCard: showCard, hideCards: hideCards,
      photoToggle: photoToggle, photoTick: photoTick, photoZoom: photoZoom, updateHud: updateHud, toast: toast, logEvent: logEvent, sfx: sfx,
      devCommand: devCommand, devCommandList: devCommandList, devLink: devLink, devLinkToggle: devLinkToggle, devState: devState,
      THREE: THREE, makeHuman: makeHuman, animateHuman: animateHuman, say: say, setMood: setMood, walkAlong: walkAlong, carMesh: carMesh, trafficAdd: trafficAdd, driveStep: driveStep, vehicleBlocked: vehicleBlocked,
      pickWeather: pickWeather, tickWeatherState: tickWeatherState, lighting: lighting, buildSky: buildSky, season: season, isSunday: isSunday, nowAbs: nowAbs,
      bakeStatic: bakeStatic, unbakeStatic: unbakeStatic, rebake: rebake, renderFrame: renderFrame, post: post, resize: resize,
      propSeed: propSeed, seededF: seededF, mixHex: mixHex, fmtTime: fmtTime, money: money, hook: hook, runHooks: runHooks,
      counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    };
  }
  CO.boot = coBoot;
  CO.layout({
    props: {
      "bench": { x: -3.8, z: 0.3, rot: 1, h: 0 },
      "desk": { x: -3.25, z: -5.1, rot: 0, h: 0 },
      "drum": { x: 4.85, z: 1.45, rot: 0, h: 0 },
      "jack": { x: -0.2, z: -1.5, rot: 2, h: 0 },
      "noticeBoard": { x: -4.33, z: -3.75, rot: 1, h: 0.35 },
      "rack": { x: 5, z: -3, rot: 3, h: 0 },
      "rollPanel": { x: 3.05, z: 1.76, rot: 2, h: 0 },
      "stands": { x: 1.4, z: -5.1, rot: 0, h: 0 },
      "toolWall": { x: 1.35, z: -5.83, rot: 0, h: 0 },
    },
    placed: [
      { id: "cp-mv1ejge3-1", type: "pkBin", x: 4.7, z: -5.15, rot: 0, h: 0 },
      { id: "cp-mv25mq1n-1", type: "fenceSection", x: -16.7, z: 3.15, rot: 1, h: 0 },
      { id: "cp-mv25mq2j-2", type: "fenceSection", x: -16.7, z: 6.45, rot: 1, h: 0 },
      { id: "cp-mv25mq55-3", type: "fenceSection", x: -16.7, z: 9.75, rot: 1, h: 0 },
      { id: "cp-mv25mq64-4", type: "fenceSection", x: -16.7, z: 13, rot: 1, h: 0 },
      { id: "cp-mv25mq7j-5", type: "fenceSection", x: -16.7, z: 16.3, rot: 1, h: 0 },
      { id: "cp-mv25mq8x-6", type: "fenceSection", x: -16.7, z: 19.6, rot: 1, h: 0 },
      { id: "cp-mv25mqav-8", type: "fenceSection", x: 17, z: 6.4, rot: 3, h: 0 },
      { id: "cp-mv25mqbr-9", type: "fenceSection", x: 17, z: 9.7, rot: 3, h: 0 },
      { id: "cp-mv25mqcp-a", type: "fenceSection", x: 17, z: 13, rot: 3, h: 0 },
      { id: "cp-mv25mqdq-b", type: "fenceSection", x: 17, z: 16.3, rot: 3, h: 0 },
      { id: "cp-mv25mqen-c", type: "fenceSection", x: 17, z: 19.6, rot: 3, h: 0 },
      { id: "cp-mv29ansm-2", type: "dcExtBreak", x: -1.85, z: -6.05, rot: 0, h: 0 },
      { id: "cp-mv29b3xo-3", type: "dcLockers", x: -1.3, z: -5.35, rot: 0, h: 0 },
      { id: "cp-mv29bbwd-4", type: "dcExtBreak", x: -2.05, z: 1.83, rot: 2, h: 0 },
      { id: "cp-mv29dwmf-8", type: "dcClockHall", x: -4.35, z: -2, rot: 1, h: -3.2 },
      { id: "cp-mv29kfix-9", type: "dcFirstAid", x: -1.45, z: 1.83, rot: 2, h: 0 },
      { id: "cp-mv29ovno-a", type: "fenceSection", x: 8.6, z: 1.6, rot: 0, h: 0 },
      { id: "cp-mv29p9z9-b", type: "fenceSection", x: 11.9, z: 1.6, rot: 0, h: 0 },
      { id: "cp-mv29pnrq-c", type: "fenceSection", x: 15.2, z: 1.6, rot: 0, h: 0 },
      { id: "cp-mv29qgis-d", type: "fenceSection", x: 17, z: 3.1, rot: 3, h: 0 },
      { id: "cp-mv29tjuw-e", type: "fenceSection", x: -14.75, z: 1.65, rot: 0, h: 0 },
      { id: "cp-mv29tpj2-f", type: "fenceSection", x: -8.2, z: 1.65, rot: 0, h: 0 },
      { id: "cp-mv29trmf-g", type: "fenceSection", x: -11.45, z: 1.65, rot: 0, h: 0 },
      { id: "cp-mv29we3t-h", type: "dcBollard", x: -3.55, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv29wiiv-i", type: "dcBollard", x: 3.9, z: 20.7, rot: 0, h: 0 },
      { id: "cp-mv29wza3-j", type: "dcCar", x: -13.8, z: 8, rot: 0, h: 0 },
      { id: "cp-mv29ys8j-l", type: "dcCar", x: -13.65, z: 4.3, rot: 0, h: 0 },
      { id: "cp-mv29z485-m", type: "dcCar", x: -13.7, z: 11.7, rot: 0, h: 0 },
      { id: "cp-mv2k1r23-a", type: "dcCar", x: 14, z: 11.35, rot: 2, h: 0 },
      { id: "cp-mv2k1r25-b", type: "dcCar", x: 13.95, z: 7.75, rot: 2, h: 0 },
      { id: "cp-mv2k1r25-c", type: "dcCar", x: 14, z: 4.25, rot: 2, h: 0 },
      { id: "cp-mv2k2wa1-d", type: "dcBollard", x: 3.65, z: 9.1, rot: 0, h: 0 },
      { id: "cp-mv2k39d2-f", type: "dcBollard", x: 5.45, z: 10.25, rot: 0, h: 0 },
      { id: "cp-mv2k3ii1-h", type: "dcBollard", x: 5, z: 9.1, rot: 0, h: 0 },
      { id: "cp-mv2k3ii2-i", type: "dcBollard", x: 6.35, z: 9.1, rot: 0, h: 0 },
      { id: "cp-mv2k7whr-p", type: "dcBollard", x: -4.8, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k83ka-q", type: "dcBollard", x: -5.95, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8ecc-r", type: "dcBollard", x: -9.4, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8ecc-s", type: "dcBollard", x: -8.25, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8ecc-t", type: "dcBollard", x: -7, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8njl-u", type: "dcBollard", x: -12.9, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8njl-v", type: "dcBollard", x: -11.75, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8njl-w", type: "dcBollard", x: -10.5, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8ruh-y", type: "dcBollard", x: -15.35, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k8ruh-z", type: "dcBollard", x: -14.1, z: 20.55, rot: 0, h: 0 },
      { id: "cp-mv2k9mtr-10", type: "dcBollard", x: 5.05, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-11", type: "dcBollard", x: 6.3, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-12", type: "dcBollard", x: 7.5, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-13", type: "dcBollard", x: 8.65, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-14", type: "dcBollard", x: 9.9, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-15", type: "dcBollard", x: 11, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-16", type: "dcBollard", x: 12.15, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-17", type: "dcBollard", x: 13.4, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-18", type: "dcBollard", x: 14.45, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2k9mts-19", type: "dcBollard", x: 15.6, z: 20.65, rot: 0, h: 0 },
      { id: "cp-mv2kcnp6-1c", type: "dcDumpster", x: -15.1, z: 18.6, rot: 1, h: 0 },
      { id: "cp-mv2kehh6-1e", type: "pkPlanter", x: 3.9, z: 2.45, rot: 0, h: 0 },
      { id: "cp-mv2ker4m-1f", type: "pkPlanter", x: -2.85, z: 2.5, rot: 0, h: 0 },
      { id: "cp-mv2kf4nx-1g", type: "pkCone", x: -15.4, z: 6.1, rot: 0, h: 0 },
      { id: "cp-mv2kfmmv-1h", type: "pkCone", x: -13.55, z: 6.05, rot: 0, h: 0 },
      { id: "cp-mv2kftfo-1i", type: "pkCone", x: -11.9, z: 6.05, rot: 0, h: 0 },
      { id: "cp-mv2kg92b-1j", type: "pkCone", x: -11.9, z: 9.8, rot: 0, h: 0 },
      { id: "cp-mv2kg92b-1k", type: "pkCone", x: -13.55, z: 9.8, rot: 0, h: 0 },
      { id: "cp-mv2kg92b-1l", type: "pkCone", x: -15.4, z: 9.85, rot: 0, h: 0 },
      { id: "cp-mv2kgtap-1p", type: "pkCone", x: -11.9, z: 13.6, rot: 0, h: 0 },
      { id: "cp-mv2kgtap-1q", type: "pkCone", x: -13.55, z: 13.6, rot: 0, h: 0 },
      { id: "cp-mv2kgtap-1r", type: "pkCone", x: -15.4, z: 13.65, rot: 0, h: 0 },
      { id: "cp-mv2ki5ay-1t", type: "dcSofa", x: -3.8, z: -2.9, rot: 1, h: 0 },
      { id: "cp-mv2klrzp-1w", type: "pkCone", x: 12.2, z: 9.6, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-1x", type: "pkCone", x: 12.2, z: 13.4, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-1y", type: "pkCone", x: 12.2, z: 5.85, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-1z", type: "pkCone", x: 14.05, z: 5.8, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-20", type: "pkCone", x: 15.7, z: 5.8, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-21", type: "pkCone", x: 15.7, z: 9.55, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-22", type: "pkCone", x: 14.05, z: 9.55, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-23", type: "pkCone", x: 14.05, z: 13.35, rot: 0, h: 0 },
      { id: "cp-mv2klrzp-24", type: "pkCone", x: 15.7, z: 13.35, rot: 0, h: 0 },
      { id: "cp-mv2qc2k0-3", type: "rdStraight20", x: -0.25, z: 26.75, rot: 0, h: 0 },
      { id: "cp-mv2qcg1r-4", type: "rdStraight20", x: 19.75, z: 26.75, rot: 0, h: 0 },
      { id: "cp-mv2qczlo-5", type: "rdStraight20", x: -20.25, z: 26.75, rot: 0, h: 0 },
      { id: "cp-mv2qfl4t-6", type: "rdBend", x: 29.7, z: 36.75, rot: 0, h: 0 },
      { id: "cp-mv2qgd0t-7", type: "rdStraight", x: 39.7, z: 41.75, rot: 1, h: 0 },
      { id: "cp-mv2qh2si-8", type: "rdTJunction", x: 39.7, z: 52.25, rot: 3, h: 0 },
      { id: "cp-mv2qhqe9-9", type: "rdStraight20", x: 24.2, z: 52.25, rot: 0, h: 0 },
      { id: "cp-mv2qip1l-a", type: "rdStraight20", x: 39.7, z: 67.75, rot: 1, h: 0 },
      { id: "cp-mv2qjamb-b", type: "rdStraight20", x: 4.2, z: 52.25, rot: 0, h: 0 },
      { id: "cp-mv2qlf7f-e", type: "rdBusStop", x: -24, z: 23.6, rot: 0, h: 0 },
      { id: "cp-mv2qm0ke-f", type: "rdStraight20", x: -40.25, z: 26.75, rot: 0, h: 0 },
      { id: "cp-mv2qmf86-g", type: "rdBend", x: -50.25, z: 36.75, rot: 1, h: 0 },
      { id: "cp-mv2qmxkr-h", type: "rdStraight20", x: -60.25, z: 46.75, rot: 3, h: 0 },
      { id: "cp-mv2qo0lm-j", type: "rdStraight", x: -60.25, z: 61.75, rot: 1, h: 0 },
      { id: "cp-mv2qogv0-k", type: "rdBend", x: -50.25, z: 66.75, rot: 2, h: 0 },
      { id: "cp-mv2qprwk-m", type: "rdBend", x: -15.75, z: 62.25, rot: 1, h: 0 },
      { id: "cp-mv2qqdiu-n", type: "rdStraight", x: -45.25, z: 76.75, rot: 0, h: 0 },
      { id: "cp-mv2qrtny-p", type: "rdStraight", x: -10.8, z: 52.25, rot: 0, h: 0 },
      { id: "cp-mv2qt23n-q", type: "rdDeadEnd", x: -35.25, z: 76.75, rot: 0, h: 0 },
      { id: "cp-mv2qtss6-r", type: "rdDeadEnd", x: -25.75, z: 67.25, rot: 3, h: 0 },
      { id: "cp-mv2que4k-s", type: "rdDeadEnd", x: 39.7, z: 82.75, rot: 3, h: 0 },
      { id: "cp-mv2qvawt-t", type: "bdHouse", x: 48.2, z: 40.35, rot: 3, h: 0 },
      { id: "cp-mv2qw11h-u", type: "bdHouse", x: 48.1, z: 50.3, rot: 3, h: 0 },
      { id: "cp-mv2qw9y6-v", type: "bdHouse", x: 48.4, z: 70.25, rot: 3, h: 0 },
      { id: "cp-mv2qw9y6-w", type: "bdHouse", x: 48.5, z: 60.3, rot: 3, h: 0 },
      { id: "cp-mv2qx9ou-y", type: "bdHouse", x: 48.05, z: 79.85, rot: 3, h: 0 },
      { id: "cp-mv2qxsqn-z", type: "bdHouse", x: 31.35, z: 69.95, rot: 1, h: 0 },
      { id: "cp-mv2qy1z7-10", type: "bdHouse", x: 31.2, z: 80.05, rot: 1, h: 0 },
      { id: "cp-mv2qz3i8-11", type: "bdLockup", x: 31.65, z: 60.95, rot: 2, h: 0 },
      { id: "cp-mv2qzgfy-12", type: "bdLockup", x: 25.9, z: 60.9, rot: 2, h: 0 },
      { id: "cp-mv2qzqx3-13", type: "bdShopFront", x: 11.4, z: 34.8, rot: 2, h: 0 },
      { id: "cp-mv2r0d8i-14", type: "bdSiteOffice", x: 0.55, z: 33.35, rot: 2, h: 0 },
      { id: "cp-mv2r0oid-15", type: "bdHouse", x: -8.05, z: 35.2, rot: 2, h: 0 },
      { id: "cp-mv2r0wnp-16", type: "bdSupermarket", x: -41.8, z: 43.3, rot: 2, h: 0 },
      { id: "cp-mv2r1fwo-17", type: "bdCafe", x: -20.55, z: 35.3, rot: 2, h: 0 },
      { id: "cp-mv2r1y5q-18", type: "ctPostBox", x: 5.4, z: 31.75, rot: 2, h: 0 },
      { id: "cp-mv2r29xi-19", type: "ctCrossing", x: -12.15, z: 24.3, rot: 0, h: 0 },
      { id: "cp-mv2r2pp2-1a", type: "ctCrossing", x: -14.6, z: 26.65, rot: 1, h: 0.05 },
      { id: "cp-mv2r3uv7-1b", type: "ctSignStop", x: -11.65, z: 22.8, rot: 1, h: 0 },
      { id: "cp-mv2r45st-1c", type: "ctSignStop", x: -16.5, z: 30.5, rot: 3, h: 0 },
      { id: "cp-mv2r4y07-1e", type: "ntBush", x: -25.6, z: 33, rot: 0, h: 0 },
      { id: "cp-mv2r56h2-1f", type: "ntTallGrass", x: -36.35, z: 17.55, rot: 0, h: 0 },
      { id: "cp-mv2r5hy1-1g", type: "ntBush", x: -26.8, z: 32.85, rot: 0, h: 0 },
      { id: "cp-mv2r5pe4-1h", type: "ntBush", x: -28.3, z: 33, rot: 0, h: 0 },
      { id: "cp-mv2r5uju-1i", type: "ntBush", x: -28.95, z: 34, rot: 0, h: 0 },
      { id: "cp-mv2r5xx5-1j", type: "ntBush", x: -29, z: 35.5, rot: 0, h: 0 },
      { id: "cp-mv2r6215-1k", type: "ntBush", x: -27.55, z: 33.95, rot: 0, h: 0 },
      { id: "cp-mv2r64u9-1l", type: "ntBush", x: -26.05, z: 33.9, rot: 0, h: 0 },
      { id: "cp-mv2r6d36-1m", type: "ntRock", x: -16.05, z: 32.85, rot: 0, h: 0 },
      { id: "cp-mv2r6l6d-1n", type: "ntRock", x: -15.05, z: 32.8, rot: 0, h: 0 },
      { id: "cp-mv2r6oew-1o", type: "ntRock", x: -13.95, z: 32.8, rot: 0, h: 0 },
      { id: "cp-mv2r6u74-1p", type: "ntRock", x: -12.75, z: 32.75, rot: 0, h: 0 },
      { id: "cp-mv2r70ck-1q", type: "ntHedge", x: -36.65, z: 32.85, rot: 0, h: 0 },
      { id: "cp-mv2r7akl-1r", type: "ntHedge", x: -46.8, z: 32.8, rot: 0, h: 0 },
      { id: "cp-mv2r844k-1s", type: "ctTrafficLight", x: 35.7, z: 45.9, rot: 2, h: 0 },
      { id: "cp-mv2r8iyn-1t", type: "ctTrafficLight", x: 43.9, z: 58.3, rot: 0, h: 0 },
      { id: "cp-mv2r8wyv-1u", type: "ctTrafficLight", x: 34.5, z: 56.65, rot: 3, h: 0 },
      { id: "cp-mv2r9p28-1v", type: "bdCarPark", x: 13.25, z: 64.9, rot: 0, h: 0 },
      { id: "cp-mv2rb13k-1z", type: "bdApartments", x: -7.5, z: 62.85, rot: 0, h: 0 },
      { id: "cp-mv2rbfl5-20", type: "bdHouse", x: -34.35, z: 65.35, rot: 1, h: 0 },
      { id: "cp-mv2rblo9-21", type: "bdHouse", x: -34.35, z: 56.6, rot: 1, h: 0 },
      { id: "cp-mv2rc6f2-22", type: "bdHouse", x: -22.25, z: 43.55, rot: 0, h: 0 },
      { id: "cp-mv2rcanc-23", type: "bdHouse", x: -12.15, z: 43.7, rot: 0, h: 0 },
      { id: "cp-mv2rcgxh-24", type: "bdHouse", x: -2.5, z: 43.7, rot: 0, h: 0 },
      { id: "cp-mv2rcpta-25", type: "bdHouse", x: 7.1, z: 43.6, rot: 0, h: 0 },
      { id: "cp-mv2rdda4-26", type: "ntOak", x: 17.5, z: 40.95, rot: 0, h: 0 },
      { id: "cp-mv2rde54-27", type: "ntOak", x: 21.6, z: 45.1, rot: 0, h: 0 },
      { id: "cp-mv2rdmjl-28", type: "ntOak", x: 32.6, z: 44.15, rot: 0, h: 0 },
      { id: "cp-mv2rdqu1-29", type: "ntOak", x: 28.15, z: 42.55, rot: 0, h: 0 },
      { id: "cp-mv2rdu4m-2a", type: "ntOak", x: 27.05, z: 37.65, rot: 0, h: 0 },
      { id: "cp-mv2rdyqi-2b", type: "ntOak", x: 32.15, z: 35.75, rot: 0, h: 0 },
      { id: "cp-mv2re7n9-2c", type: "ntOak", x: 22.35, z: 34.95, rot: 0, h: 0 },
      { id: "cp-mv2rea6u-2d", type: "ntBush", x: 18.35, z: 35.05, rot: 0, h: 0 },
      { id: "cp-mv2rebu5-2e", type: "ntBush", x: 25.6, z: 34.8, rot: 0, h: 0 },
      { id: "cp-mv2redb2-2f", type: "ntBush", x: 30.1, z: 38.2, rot: 0, h: 0 },
      { id: "cp-mv2reeo1-2g", type: "ntBush", x: 29.65, z: 34.35, rot: 0, h: 0 },
      { id: "cp-mv2regbl-2h", type: "ntBush", x: 21, z: 36.85, rot: 0, h: 0 },
      { id: "cp-mv2rejnm-2i", type: "ntBush", x: 24.65, z: 39.3, rot: 0, h: 0 },
      { id: "cp-mv2rektr-2j", type: "ntBush", x: 20.7, z: 40.4, rot: 0, h: 0 },
      { id: "cp-mv2renk7-2k", type: "ntBush", x: 15.55, z: 38.4, rot: 0, h: 0 },
      { id: "cp-mv2req2o-2l", type: "ntBush", x: 14.7, z: 42.9, rot: 0, h: 0 },
      { id: "cp-mv2ret82-2m", type: "ntBush", x: 23.85, z: 42.55, rot: 0, h: 0 },
      { id: "cp-mv2rewmd-2n", type: "ntBush", x: 27.7, z: 40.55, rot: 0, h: 0 },
      { id: "cp-mv2rey9c-2o", type: "ntBush", x: 27.45, z: 45, rot: 0, h: 0 },
      { id: "cp-mv2rhaps-2r", type: "ctStreetLamp", x: -5.75, z: 22.8, rot: 3, h: 0 },
      { id: "cp-mv2rhwak-2s", type: "ctStreetLamp", x: 6.25, z: 22.8, rot: 3, h: 0 },
      { id: "cp-mv2ridkb-2t", type: "ctStreetLamp", x: 24.2, z: 22.7, rot: 3, h: 0 },
      { id: "cp-mv2ridkb-2u", type: "ctStreetLamp", x: 14.25, z: 22.7, rot: 3, h: 0 },
      { id: "cp-mv2rifhs-2v", type: "ctStreetLamp", x: 9.25, z: 25.8, rot: 3, h: 0 },
      { id: "cp-mv2rifhs-2w", type: "ctStreetLamp", x: -2.75, z: 25.8, rot: 3, h: 0 },
      { id: "cp-mv2rk3ix-2x", type: "ctStreetLamp", x: -17.45, z: 22.75, rot: 3, h: 0 },
      { id: "cp-mv2rkcdd-2y", type: "ctStreetLamp", x: -29.15, z: 22.75, rot: 3, h: 0 },
      { id: "cp-mv2rkx98-2z", type: "bdTerrace", x: -37.15, z: 17.1, rot: 0, h: 0 },
    ]
  });
  // the pack's state in the save: which gates and barriers are open, which levers are on
  function pkState() { if (!S.pack) S.pack = { gates: {}, switches: {} }; if (!S.pack.gates) S.pack.gates = {}; if (!S.pack.switches) S.pack.switches = {}; return S.pack; }
  function pkToggleGate(id) { var P = pkState(); P.gates[id] = !P.gates[id]; sfx(P.gates[id] ? 'open' : 'close'); buildProp(id); save(); screenDirtyAll(); }
  function pkGates() { return Object.keys(propInst).filter(function (id) { var d = propDef(id); return d && (d.id === 'pkGate' || d.id === 'pkBarrier'); }); }
  function pkTimeLabel() { var h = Math.floor(S.time || 0), m = Math.floor(((S.time || 0) - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

  // ── a control panel: a standing cabinet with a touch screen; the screen lists the gates and barriers and opens or closes them, counts presses, and shows the time ──
  defProp('pkPanel', { extra: true, shop: false, label: 'control panel', cat: 'pack', desc: 'A standing panel with a touch screen: the gates and barriers in the game open and close from it.', build: function (c) {
    c.box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11); c.box(0.5, 0.8, 0.3, MAT.steelDark, 0, 0.4, -0.08); c.box(0.9, 0.04, 0.3, MAT.steelDark, 0, 0.82, -0.08); c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: c.group, title: 'Control panel', draw: function (ctx, sc) {
      scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, 'CONTROL PANEL', pkTimeLabel()); var P = pkState(), gates = pkGates(), y = 70;
      if (!gates.length) scText(ctx, 16, y, 'No gate or barrier placed yet.'); else gates.forEach(function (g, i) { if (i > 4) return; var open = !!P.gates[g], d = propDef(g); scText(ctx, 16, y + 20, (d.id === 'pkBarrier' ? 'Barrier ' : 'Gate ') + (i + 1) + ': ' + (open ? 'open' : 'closed')); scButton(sc, 250, y, 150, 34, open ? 'Close' : 'Open', !open, function () { pkToggleGate(g); }); y += 46; });
      scButton(sc, 16, sc.h - 56, 140, 40, 'Press', true, function () { S.presses = (S.presses || 0) + 1; }); scText(ctx, 170, sc.h - 30, 'Presses: ' + (S.presses || 0));
    } });
  } });
  // ── a wall screen: the time and a note, on a bracket ──
  defProp('pkWallScreen', { extra: true, shop: false, label: 'wall screen', cat: 'pack', wall: true, desc: 'A screen on a wall bracket showing the time and the day.', build: function (c) {
    c.box(0.1, 0.1, 0.12, MAT.steelDark, 0, 1.7, 0.06); c.box(0.84, 0.52, 0.04, MAT.black, 0, 1.7, 0.14);
    touchScreen({ w: 400, h: 240, pw: 0.78, ph: 0.468, x: 0, y: 1.7, z: 0.165, parent: c.group, title: 'Wall screen', autoPage: true, draw: function (ctx, sc) { scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, pkTimeLabel(), 'Day ' + (S.day || 1)); scText(ctx, 16, 110, 'Co Engine', null, 28); scText(ctx, 16, 150, 'basics pack: wall screen'); } });
  } });

  // ── a sliding gate between two posts: 3.2 m wide; the leaf slides aside when open and the way is free ──
  defProp('pkGate', { extra: true, shop: false, label: 'sliding gate', cat: 'pack', desc: 'A 3.2 m sliding gate. Use it, or a control panel, to open and close it.', build: function (c, P, inst) {
    var open = !!pkState().gates[inst.id], w = 3.2, h = 2.0;
    c.box(0.2, 2.3, 0.2, MAT.steelDark, -w / 2 - 0.1, 1.15, 0); c.box(0.2, 2.3, 0.2, MAT.steelDark, w / 2 + 0.1, 1.15, 0);   /* the posts */
    c.box(w + 0.4, 0.06, 0.06, MAT.steel, 0, 0.05, 0);   /* the rail */
    var g = c.dynGroup(), off = open ? w - 0.3 : 0; g.position.x = off;   /* the leaf, slid aside when open */
    box(w, 0.08, 0.08, MAT.steel, 0, h, 0, g); box(w, 0.08, 0.08, MAT.steel, 0, 0.14, 0, g); box(0.08, h, 0.08, MAT.steel, -w / 2 + 0.04, h / 2 + 0.07, 0, g); box(0.08, h, 0.08, MAT.steel, w / 2 - 0.04, h / 2 + 0.07, 0, g);
    for (var i = 1; i < 12; i++) box(0.04, h - 0.1, 0.04, MAT.steelDark, -w / 2 + i * (w / 12), h / 2 + 0.07, 0, g);
    box(0.5, 0.3, 0.02, MAT.yellow, 0, 1.2, 0.05, g);
    if (!open) c.solid(-w / 2, w / 2, -0.12, 0.12, 0, 2.3); else c.solid(w / 2 - 0.3, w / 2 + w, -0.12, 0.12, 0, 2.3);
    c.solid(-w / 2 - 0.2, -w / 2, -0.12, 0.12, 0, 2.3); c.solid(w / 2, w / 2 + 0.2, -0.12, 0.12, 0, 2.3);
    c.hit(w, 2.2, 0.5, off, 1.1, 0, { prompt: function () { return open ? 'Close the gate' : 'Open the gate'; }, use: function () { pkToggleGate(inst.id); } });
  } });
  // ── a boom barrier: a post and an arm that lifts ──
  defProp('pkBarrier', { extra: true, shop: false, label: 'boom barrier', cat: 'pack', desc: 'A boom barrier over a 3.5 m lane. Use it, or a control panel, to lift and lower it.', build: function (c, P, inst) {
    var open = !!pkState().gates[inst.id];
    c.box(0.36, 1.1, 0.36, MAT.grey, -1.9, 0.55, 0); c.box(0.3, 0.1, 0.3, MAT.steelDark, -1.9, 1.12, 0); c.solid(-2.1, -1.7, -0.2, 0.2, 0, 1.3);
    var g = c.dynGroup(); g.position.set(-1.7, 1.05, 0); g.rotation.z = open ? Math.PI / 2 - 0.1 : 0;
    box(3.6, 0.1, 0.1, MAT.white, 1.8, 0, 0, g); for (var i = 0; i < 4; i++) box(0.45, 0.11, 0.11, MAT.red, 0.5 + i * 0.9, 0, 0, g);
    if (!open) c.solid(-1.7, 1.9, -0.15, 0.15, 0.6, 1.4);
    c.hit(0.8, 1.6, 0.8, -1.9, 0.8, 0, { prompt: function () { return open ? 'Lower the barrier' : 'Lift the barrier'; }, use: function () { pkToggleGate(inst.id); } });
  } });
  // ── a lever that switches something on and off (the game reads S.pack.switches[id]) ──
  defProp('pkLever', { extra: true, shop: false, label: 'lever', cat: 'pack', desc: 'A lever: on or off, kept in the save as S.pack.switches[id].', build: function (c, P, inst) {
    var on = !!pkState().switches[inst.id];
    c.box(0.3, 1.0, 0.3, MAT.steelDark, 0, 0.5, 0); c.box(0.34, 0.06, 0.34, MAT.yellow, 0, 1.03, 0); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 1.1);
    var g = c.dynGroup(); g.position.set(0, 1.05, 0); g.rotation.x = on ? -0.9 : 0.9; box(0.04, 0.5, 0.04, MAT.steel, 0, 0.25, 0, g); box(0.1, 0.1, 0.1, MAT.red, 0, 0.5, 0, g);
    c.hit(0.6, 1.4, 0.6, 0, 0.7, 0, { prompt: function () { return on ? 'Switch it off' : 'Switch it on'; }, use: function () { pkState().switches[inst.id] = !on; sfx('click'); buildProp(inst.id); save(); } });
  } });

  // ── signs ──
  defProp('pkSign', { extra: true, shop: false, label: 'standing sign', cat: 'pack', desc: 'A sign on two legs. Change its lines in the Pack tab.', build: function (c) { c.box(0.05, 1.2, 0.05, MAT.steelDark, -0.5, 0.6, 0); c.box(0.05, 1.2, 0.05, MAT.steelDark, 0.5, 0.6, 0); c.sign(['NOTICE', 'edit me in the Pack tab'], 1.2, 0.6, 0, 1.5, 0.03, 0); c.solid(-0.55, 0.55, -0.1, 0.1, 0, 1.9); } });
  defProp('pkWallSign', { extra: true, shop: false, label: 'wall sign', cat: 'pack', wall: true, desc: 'A sign for a wall. Change its lines in the Pack tab.', build: function (c) { c.sign(['AREA 1'], 1.6, 0.5, 0, 2.1, 0.03, 0); } });
  // ── things that stand around ──
  defProp('pkCrate', { extra: true, shop: false, label: 'crate', cat: 'pack', desc: 'A wooden crate.', build: function (c) { c.box(0.9, 0.9, 0.9, MAT.wood, 0, 0.45, 0); c.box(0.92, 0.06, 0.92, MAT.steelDark, 0, 0.3, 0); c.box(0.92, 0.06, 0.92, MAT.steelDark, 0, 0.6, 0); c.solid(-0.45, 0.45, -0.45, 0.45, 0, 0.9); } });
  defProp('pkPallet', { extra: true, shop: false, label: 'pallet', cat: 'pack', desc: 'An empty pallet.', build: function (c) { for (var i = 0; i < 5; i++) c.box(1.2, 0.03, 0.12, MAT.wood, 0, 0.14, -0.4 + i * 0.2); for (var j = 0; j < 3; j++) c.box(0.1, 0.1, 1.0, MAT.wood, -0.5 + j * 0.5, 0.06, 0); c.solid(-0.6, 0.6, -0.5, 0.5, 0, 0.16); } });
  defProp('pkBench', { extra: true, shop: false, label: 'bench', cat: 'pack', desc: 'A bench for two.', build: function (c) { c.box(1.6, 0.06, 0.4, MAT.wood, 0, 0.45, 0); c.box(1.6, 0.4, 0.05, MAT.wood, 0, 0.7, -0.2); c.box(0.06, 0.45, 0.4, MAT.steelDark, -0.7, 0.22, 0); c.box(0.06, 0.45, 0.4, MAT.steelDark, 0.7, 0.22, 0); c.solid(-0.8, 0.8, -0.25, 0.25, 0, 0.9); } });
  defProp('pkBin', { extra: true, shop: false, label: 'bin', cat: 'pack', desc: 'A steel bin.', build: function (c) { c.cyl(0.28, 0.8, MAT.steelDark, 0, 0.4, 0, 14); c.cyl(0.3, 0.05, MAT.black, 0, 0.82, 0, 14); c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.9); } });
  defProp('pkCone', { extra: true, shop: false, label: 'traffic cone', cat: 'pack', desc: 'An orange cone.', build: function (c) { c.box(0.4, 0.04, 0.4, MAT.black, 0, 0.02, 0); c.cyl(0.1, 0.6, MAT.red, 0, 0.34, 0, 10, 0.2); c.cyl(0.11, 0.08, MAT.white, 0, 0.4, 0, 10); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 0.7); } });
  defProp('pkLampPost', { extra: true, shop: false, label: 'lamp post', cat: 'pack', desc: 'A lamp post with a warm light at night.', build: function (c) { c.cyl(0.07, 3.4, MAT.steelDark, 0, 1.7, 0, 10); c.box(0.5, 0.06, 0.06, MAT.steelDark, 0.22, 3.4, 0); c.box(0.4, 0.12, 0.3, MAT.grey, 0.4, 3.4, 0); c.box(0.36, 0.02, 0.26, MAT.yellow, 0.4, 3.33, 0); c.light(0xffd9a0, 1.2, 9, 0.4, 3.2, 0); c.solid(-0.12, 0.12, -0.12, 0.12, 0, 3.6); } });
  defProp('pkFence', { extra: true, shop: false, label: 'fence section', cat: 'pack', desc: 'A 2 m mesh fence section with two posts.', build: function (c) { c.box(0.08, 1.9, 0.08, MAT.steelDark, -1, 0.95, 0); c.box(0.08, 1.9, 0.08, MAT.steelDark, 1, 0.95, 0); c.plane(2, 1.7, MAT.mesh, 0, 1.0, 0, 0, 0); c.box(2, 0.04, 0.04, MAT.steel, 0, 1.86, 0); c.solid(-1.04, 1.04, -0.06, 0.06, 0, 1.95); } });
  defProp('pkPlanter', { extra: true, shop: false, label: 'planter', cat: 'pack', desc: 'A concrete planter with a shrub.', build: function (c) { c.box(1.2, 0.5, 0.6, MAT.block, 0, 0.25, 0); c.box(1.1, 0.04, 0.5, MAT.yard, 0, 0.5, 0); c.sphere(0.32, MAT.grass, -0.3, 0.75, 0); c.sphere(0.28, MAT.grass, 0.3, 0.7, 0.05); c.solid(-0.6, 0.6, -0.3, 0.3, 0, 1.1); } });
  // the pack's own finishes, made once: coloured corrugated sheet, painted boards, dark window glass
  var BD_MATS = {};
  function bdMat(key, make) { if (!BD_MATS[key]) BD_MATS[key] = make(); return BD_MATS[key]; }
  function bdSheet(hex) { return bdMat('sheet' + hex, function () { return std({ map: TEX.corrugated, color: hex, roughness: 0.55, metalness: 0.45 }); }); }
  function bdBoards(hex) { return bdMat('boards' + hex, function () { return std({ map: TEX.wood, color: hex, roughness: 0.85 }); }); }
  function bdPaint(hex) { return bdMat('paint' + hex, function () { return std({ color: hex, roughness: 0.7 }); }); }
  function bdGlass() { return bdMat('glass', function () { return std({ color: 0x1d2630, roughness: 0.08, metalness: 0.6 }); }); }
  function bdUse(c, label, x0, x1, z0, z1, h) { c.hit(x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, { prompt: function () { return label; }, use: function () { toast(label + '.', ''); } }); }
  // a pitched roof, its ridge along x: two slabs and the two gable ends
  function bdRoof(c, L, D, y, rise, mat, gableMat, over) {
    over = over || 0.3; var half = D / 2, a = Math.atan2(rise, half), slab = Math.sqrt(half * half + rise * rise) + over;
    [-1, 1].forEach(function (s) { var r = c.box(L + 2 * over, 0.08, slab, mat, 0, y + rise / 2, s * half / 2); r.rotation.x = s * a; });
    if (gableMat) [-1, 1].forEach(function (s) { var sh = new THREE.Shape(); sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(0, rise); sh.lineTo(-half, 0); var m = new THREE.Mesh(new THREE.ShapeGeometry(sh), gableMat); m.position.set(s * L / 2, y, 0); m.rotation.y = s * Math.PI / 2; m.castShadow = true; m.receiveShadow = true; c.add(m); });
  }
  // a window: a frame and the glass, on a wall facing +z (ry turns it to the other walls)
  function bdWindow(c, w, h, x, y, z, ry) { var g = c.box(w, h, 0.06, bdGlass(), x, y, z); g.rotation.y = ry || 0; var f = c.box(w + 0.12, 0.08, 0.1, MAT.white, x, y - h / 2, z); f.rotation.y = ry || 0; var t = c.box(w + 0.12, 0.06, 0.1, MAT.white, x, y + h / 2, z); t.rotation.y = ry || 0; }

  defProp('bdShed', { extra: true, shop: false, label: 'garden shed', cat: 'buildings', desc: 'A wooden shed, 3 by 2.4 m, with an open doorway: walk in.', build: function (c) {
    var W = 3, D = 2.4, H = 2.1, wood = bdBoards(0x8a5a36), t = 0.08;
    c.box(W, 0.1, D, MAT.wood, 0, 0.05, 0);
    c.box(W, H, t, wood, 0, H / 2, -D / 2); c.box(t, H, D, wood, -W / 2, H / 2, 0); c.box(t, H, D, wood, W / 2, H / 2, 0);
    c.box(W / 2 - 0.45, H, t, wood, -W / 4 - 0.225, H / 2, D / 2); c.box(W / 2 - 0.45, H, t, wood, W / 4 + 0.225, H / 2, D / 2); c.box(0.9, H - 1.9, t, wood, 0, 1.9 + (H - 1.9) / 2, D / 2);
    bdWindow(c, 0.6, 0.45, -1.0, 1.4, D / 2 + 0.05);
    bdRoof(c, W, D, H, 0.7, MAT.roof, wood, 0.2);
    c.solid(-W / 2, W / 2, -D / 2 - 0.05, -D / 2 + 0.05, 0, 2.6); c.solid(-W / 2 - 0.05, -W / 2 + 0.05, -D / 2, D / 2, 0, 2.6); c.solid(W / 2 - 0.05, W / 2 + 0.05, -D / 2, D / 2, 0, 2.6);
    c.solid(-W / 2, -0.45, D / 2 - 0.05, D / 2 + 0.05, 0, 2.6); c.solid(0.45, W / 2, D / 2 - 0.05, D / 2 + 0.05, 0, 2.6);
    bdUse(c, 'A garden shed', -W / 2, W / 2, D / 2 - 0.1, D / 2 + 0.1, 0.3);
  } });
  defProp('bdCarport', { extra: true, shop: false, label: 'carport', cat: 'buildings', desc: 'Four posts and a roof, 3.2 by 5.6 m: park a car under it.', build: function (c) {
    var W = 3.2, D = 5.6, H = 2.5;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { c.box(0.12, H, 0.12, MAT.steelDark, p[0] * (W / 2 - 0.1), H / 2, p[1] * (D / 2 - 0.1)); c.solid(p[0] * (W / 2 - 0.1) - 0.08, p[0] * (W / 2 - 0.1) + 0.08, p[1] * (D / 2 - 0.1) - 0.08, p[1] * (D / 2 - 0.1) + 0.08, 0, H); });
    c.box(W + 0.3, 0.1, D + 0.3, bdSheet(0x7d8690), 0, H + 0.05, 0); c.box(W + 0.3, 0.12, 0.08, MAT.steelDark, 0, H - 0.03, D / 2 + 0.11); c.box(W + 0.3, 0.12, 0.08, MAT.steelDark, 0, H - 0.03, -D / 2 - 0.11);
    bdUse(c, 'A carport', -W / 2, W / 2, -D / 2, D / 2, 0.15);
  } });
  defProp('bdBusShelter', { extra: true, shop: false, label: 'bus shelter', cat: 'buildings', desc: 'A glass bus shelter with a bench and the stop sign.', build: function (c) {
    var W = 3.2, D = 1.4, H = 2.3, glass = std({ color: 0xbfd8e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
    c.box(W, H - 0.1, 0.04, glass, 0, H / 2, -D / 2); c.box(0.04, H - 0.1, D, glass, -W / 2, H / 2, 0); c.box(0.04, H - 0.1, D * 0.6, glass, W / 2, H / 2, -D * 0.2);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { c.box(0.06, H, 0.06, MAT.steelDark, p[0] * W / 2, H / 2, p[1] * D / 2); });
    c.box(W + 0.2, 0.08, D + 0.25, MAT.steelDark, 0, H, 0.05); c.box(W - 0.6, 0.06, 0.38, MAT.wood, 0, 0.48, -D / 2 + 0.3); c.box(0.06, 0.45, 0.3, MAT.steelDark, -1, 0.24, -D / 2 + 0.3); c.box(0.06, 0.45, 0.3, MAT.steelDark, 1, 0.24, -D / 2 + 0.3);
    c.cyl(0.04, 2.6, MAT.steelDark, W / 2 + 0.4, 1.3, D / 2, 8); c.sign(['BUS', '12  34'], 0.5, 0.42, W / 2 + 0.4, 2.45, D / 2 + 0.03, 0, { w: 256, h: 220, bg: '#2a6db2', fg: '#ffffff' });
    c.solid(-W / 2, W / 2, -D / 2 - 0.05, -D / 2 + 0.05, 0, H); c.solid(-W / 2 - 0.05, -W / 2 + 0.05, -D / 2, D / 2, 0, H); c.solid(W / 2 - 0.05, W / 2 + 0.05, -D / 2, D * 0.1, 0, H);
    bdUse(c, 'A bus shelter', -W / 2, W / 2, -D / 2, D / 2, 0.6);
  } });
  function bdContainer(hex, label) { return function (c) {
    var L = 6.06, W = 2.44, H = 2.59, sheet = bdSheet(hex);
    c.box(L, H, W, sheet, 0, H / 2, 0); c.box(0.05, H - 0.1, W - 0.1, bdPaint(hex), L / 2 + 0.02, H / 2, 0);
    [-0.6, 0.6].forEach(function (z) { c.cyl(0.025, H - 0.2, MAT.steelDark, L / 2 + 0.06, H / 2, z, 6); c.cyl(0.025, H - 0.2, MAT.steelDark, L / 2 + 0.06, H / 2, z * 0.3, 6); });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (p) { c.box(0.18, 0.16, 0.18, MAT.steelDark, p[0] * (L / 2 - 0.09), 0.08, p[1] * (W / 2 - 0.09)); c.box(0.18, 0.16, 0.18, MAT.steelDark, p[0] * (L / 2 - 0.09), H - 0.08, p[1] * (W / 2 - 0.09)); });
    c.sign(['COCU 482117 2'], 1.6, 0.22, 0, H - 0.4, W / 2 + 0.01, 0, { w: 512, h: 72, bg: '#' + ('000000' + hex.toString(16)).slice(-6), fg: '#ffffff' });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, label, -L / 2, L / 2, -W / 2, W / 2, H);
  }; }
  defProp('bdContainerRed', { extra: true, shop: false, label: 'shipping container (red)', cat: 'buildings', desc: 'A 20 ft shipping container, red.', build: bdContainer(0x9e2b25, 'A shipping container') });
  defProp('bdContainerBlue', { extra: true, shop: false, label: 'shipping container (blue)', cat: 'buildings', desc: 'A 20 ft shipping container, blue.', build: bdContainer(0x24548c, 'A shipping container') });
  defProp('bdKiosk', { extra: true, shop: false, label: 'kiosk', cat: 'buildings', desc: 'A kiosk with a service window and a striped awning.', build: function (c) {
    var W = 2.6, D = 2.2, H = 2.6, wall = bdPaint(0x2f6d5a);
    c.box(W, H, D, wall, 0, H / 2, 0); c.box(W + 0.2, 0.16, D + 0.2, MAT.white, 0, H + 0.08, 0);
    c.box(1.8, 0.9, 0.06, bdGlass(), 0, 1.6, D / 2 + 0.01); c.box(1.9, 0.08, 0.4, MAT.wood, 0, 1.12, D / 2 + 0.2);
    for (var i = 0; i < 6; i++) { var aw = c.box(0.36, 0.04, 0.8, bdPaint(i % 2 ? 0xf3f0e8 : 0xc0282e), -0.9 + i * 0.36, 2.25, D / 2 + 0.35); aw.rotation.x = 0.35; }
    c.sign(['KIOSK'], 1.6, 0.3, 0, 2.48, D / 2 + 0.02, 0, { w: 512, h: 96, bg: '#1b232c', fg: '#f5b53d' });
    c.solid(-W / 2, W / 2, -D / 2, D / 2, 0, H); bdUse(c, 'A kiosk', -W / 2, W / 2, -D / 2, D / 2 + 0.4, 2);
  } });
  defProp('bdSiteOffice', { extra: true, shop: false, label: 'site office cabin', cat: 'buildings', desc: 'A portable site office: a door, steps and windows.', build: function (c) {
    var L = 6, W = 2.5, H = 2.7, sheet = bdSheet(0xd8d4c8);
    c.box(L, H - 0.2, W, sheet, 0, 0.2 + (H - 0.2) / 2, 0); c.box(L + 0.1, 0.12, W + 0.1, MAT.steelDark, 0, H + 0.06, 0); c.box(L - 0.4, 0.2, W - 0.4, MAT.steelDark, 0, 0.1, 0);
    c.box(0.9, 2.0, 0.06, MAT.door, 1.6, 1.2, W / 2 + 0.01); c.box(1.2, 0.18, 0.6, MAT.steelDark, 1.6, 0.18, W / 2 + 0.4);
    bdWindow(c, 1.2, 0.8, -1.4, 1.6, W / 2 + 0.02); bdWindow(c, 1.2, 0.8, -0.0, 1.6, W / 2 + 0.02);
    c.sign(['SITE OFFICE'], 1.6, 0.24, 1.6, 2.45, W / 2 + 0.02, 0, { w: 512, h: 80, bg: '#f5b53d', fg: '#1b232c' });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'A site office cabin', -L / 2, L / 2, -W / 2, W / 2 + 0.2, H);
  } });
  defProp('bdLockup', { extra: true, shop: false, label: 'lock-up garage', cat: 'buildings', desc: 'A block lock-up garage with a roller door.', build: function (c) {
    var W = 5, D = 6, H = 3;
    c.box(W, H, D, MAT.block, 0, H / 2, 0); c.box(W + 0.3, 0.2, D + 0.3, MAT.roof, 0, H + 0.1, 0);
    c.box(3.2, 2.5, 0.06, bdSheet(0x9aa2aa), 0, 1.25, D / 2 + 0.02); c.box(3.4, 0.35, 0.3, MAT.steelDark, 0, 2.65, D / 2 + 0.1);
    c.sign(['UNIT 4'], 0.8, 0.22, 2.0, 2.75, D / 2 + 0.02, 0, { w: 256, h: 72, bg: '#1b232c', fg: '#ffffff' });
    c.solid(-W / 2, W / 2, -D / 2, D / 2, 0, H); bdUse(c, 'A lock-up garage', -W / 2, W / 2, -D / 2, D / 2 + 0.1, H);
  } });
  defProp('bdHouse', { extra: true, shop: false, label: 'house', cat: 'buildings', desc: 'A two-storey house: windows, a front door, a pitched roof and a chimney.', build: function (c) {
    var L = 8, W = 6, H = 5.4, wall = bdPaint(0xe8e0cf);
    c.box(L, H, W, wall, 0, H / 2, 0); c.box(L + 0.1, 0.3, W + 0.1, MAT.brick, 0, 0.15, 0);
    bdRoof(c, L, W, H, 2.4, bdPaint(0x5a3a32), wall, 0.4);
    c.box(0.6, 1.6, 0.6, MAT.brick, 2.2, H + 2.0, -0.8);
    c.box(1.0, 2.1, 0.08, bdPaint(0x2a4d6e), 0, 1.1, W / 2 + 0.02); c.box(1.4, 0.12, 0.5, MAT.white, 0, 2.35, W / 2 + 0.25);
    [-2.6, 2.6].forEach(function (x) { bdWindow(c, 1.2, 1.1, x, 1.5, W / 2 + 0.03); }); [-2.6, 0, 2.6].forEach(function (x) { bdWindow(c, 1.1, 1.0, x, 4.1, W / 2 + 0.03); });
    [-1.5, 1.5].forEach(function (z) { bdWindow(c, 1.0, 1.0, L / 2 + 0.03, 4.1, z, Math.PI / 2); });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'A house', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdShopFront', { extra: true, shop: false, label: 'shop front', cat: 'buildings', desc: 'A brick shop with a glass front, an awning and its sign.', build: function (c) {
    var L = 8, W = 5, H = 4.6;
    c.box(L, H, W, MAT.brick, 0, H / 2, 0); c.box(L + 0.2, 0.25, W + 0.2, MAT.steelDark, 0, H + 0.12, 0);
    c.box(L - 1.2, 2.3, 0.06, bdGlass(), -0.4, 1.35, W / 2 + 0.02); c.box(1.0, 2.2, 0.08, bdGlass(), L / 2 - 1.1, 1.1, W / 2 + 0.02); c.box(L - 0.6, 0.12, 0.12, MAT.steelDark, 0, 2.55, W / 2 + 0.06);
    var aw = c.box(L - 0.4, 0.05, 1.3, bdPaint(0x2a6b4a), 0, 3.0, W / 2 + 0.6); aw.rotation.x = 0.3;
    c.sign(['CORNER SHOP'], 3.6, 0.6, 0, 3.75, W / 2 + 0.02, 0, { w: 768, h: 128, bg: '#1b232c', fg: '#f3efe4' });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'A shop', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdPetrolCanopy', { extra: true, shop: false, label: 'petrol station canopy', cat: 'buildings', desc: 'A petrol station canopy on four pillars, with two pump islands and lights under it.', build: function (c) {
    var L = 10, W = 7, H = 5;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { var x = p[0] * (L / 2 - 1), z = p[1] * (W / 2 - 1); c.box(0.4, H, 0.4, MAT.white, x, H / 2, z); c.solid(x - 0.22, x + 0.22, z - 0.22, z + 0.22, 0, H); });
    c.box(L, 0.7, W, MAT.white, 0, H + 0.35, 0); c.box(L + 0.02, 0.25, W + 0.02, bdPaint(0xc0282e), 0, H + 0.45, 0); c.box(L - 0.4, 0.04, W - 0.4, MAT.lamp, 0, H - 0.01, 0);
    c.sign(['FUEL'], 2.0, 0.5, 0, H + 0.4, W / 2 + 0.02, 0, { w: 512, h: 128, bg: '#c0282e', fg: '#ffffff' });
    [-1.6, 1.6].forEach(function (x) { c.box(0.9, 0.2, 3.0, MAT.grey, x, 0.1, 0); c.box(0.6, 1.6, 0.4, bdPaint(0xe8e8e8), x, 1.0, 0); c.box(0.5, 0.35, 0.02, bdGlass(), x, 1.45, 0.21); c.box(0.5, 0.35, 0.02, bdGlass(), x, 1.45, -0.21); c.cyl(0.03, 0.9, MAT.black, x + 0.32, 1.0, 0.1, 6); c.solid(x - 0.45, x + 0.45, -1.5, 1.5, 0, 1.8); });
    c.light(0xfff2dd, 0.8, 12, 0, H - 0.4, 0);
    bdUse(c, 'A petrol station', -2.2, 2.2, -1.5, 1.5, 1.8);
  } });
  defProp('bdWarehouse', { extra: true, shop: false, label: 'warehouse', cat: 'buildings', desc: 'A corrugated warehouse, 16 by 12 m, with a roller door and a pedestrian door.', build: function (c) {
    var L = 16, W = 12, H = 6.5, sheet = bdSheet(0x8d969e);
    c.box(L, H, W, sheet, 0, H / 2, 0); c.box(L, 0.6, W, MAT.block, 0, 0.3, 0);
    bdRoof(c, L, W, H, 1.6, bdSheet(0x5c6670), sheet, 0.3);
    c.box(4.2, 4.5, 0.08, bdSheet(0xb9c0c6), -3, 2.25, W / 2 + 0.03); c.box(4.5, 0.4, 0.4, MAT.steelDark, -3, 4.7, W / 2 + 0.15);
    c.box(1.0, 2.1, 0.08, MAT.door, 3.5, 1.05, W / 2 + 0.03); c.box(0.4, 0.15, 0.2, MAT.lamp, 3.5, 2.5, W / 2 + 0.1);
    c.sign(['WAREHOUSE 2'], 3.2, 0.6, 3.0, 5.2, W / 2 + 0.04, 0, { w: 768, h: 144, bg: '#1b232c', fg: '#f5b53d' });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'A warehouse', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  // ── pre-built city buildings ──
  // a facade grid of windows on one wall facing +z (a row per floor), for the blocks below
  function bdFloors(c, L, z, floors, fh, y0, perFloor, w, h) { for (var f = 0; f < floors; f++) for (var i = 0; i < perFloor; i++) bdWindow(c, w, h, -L / 2 + (i + 0.5) * L / perFloor, y0 + f * fh + fh * 0.55, z); }
  defProp('bdApartments', { extra: true, shop: false, label: 'apartment block', cat: 'buildings', desc: 'A five-storey apartment block with balconies and an entrance.', build: function (c) {
    var L = 14, W = 10, fh = 3, n = 5, H = n * fh + 0.4, wall = bdPaint(0xcfc6b4);
    c.box(L, H, W, wall, 0, H / 2, 0); c.box(L + 0.3, 0.3, W + 0.3, MAT.steelDark, 0, H + 0.15, 0);
    bdFloors(c, L, W / 2 + 0.03, n, fh, 0, 5, 1.3, 1.4); bdFloors(c, L, -W / 2 - 0.03, n, fh, 0, 5, 1.3, 1.4);
    for (var f = 1; f < n; f++) [-4.2, 0, 4.2].forEach(function (x) { c.box(2.0, 0.12, 0.9, MAT.grey, x, f * fh, W / 2 + 0.45); c.box(2.0, 0.9, 0.04, std({ color: 0xdfe8ee, roughness: 0.05, transparent: true, opacity: 0.35 }), x, f * fh + 0.5, W / 2 + 0.9); });
    c.box(2.0, 2.4, 0.08, bdGlass(), 0, 1.2, W / 2 + 0.04); c.box(2.6, 0.15, 1.2, MAT.steelDark, 0, 2.6, W / 2 + 0.6); c.sign(['12'], 0.5, 0.3, 0, 2.95, W / 2 + 0.03, 0, { w: 128, h: 80, bg: '#1b232c', fg: '#ffffff' });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'An apartment block', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdOfficeTower', { extra: true, shop: false, label: 'office tower', cat: 'buildings', desc: 'A twelve-storey glass office tower with a lit lobby.', build: function (c) {
    var L = 12, W = 12, fh = 3.4, n = 12, H = n * fh, glass = bdGlass();
    c.box(L, H, W, glass, 0, H / 2, 0);
    for (var f = 1; f <= n; f++) c.box(L + 0.1, 0.25, W + 0.1, MAT.steelDark, 0, f * fh, 0);
    [-1, 1].forEach(function (s) { [-1, 1].forEach(function (t) { c.box(0.4, H, 0.4, MAT.steelDark, s * L / 2, H / 2, t * W / 2); }); });
    c.box(L - 1, 3.0, 0.1, std({ color: 0xfff1d6, emissive: 0xffe2b0, emissiveIntensity: 0.25, roughness: 0.3 }), 0, 1.5, W / 2 + 0.02); c.box(L + 1, 0.3, 2, MAT.steelDark, 0, 3.4, W / 2 + 1);
    c.sign(['MERIDIAN HOUSE'], 5, 0.7, 0, 4.0, W / 2 + 0.06, 0, { w: 1024, h: 140, bg: '#1b232c', fg: '#e8e8e8' });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'An office tower', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdTerrace', { extra: true, shop: false, label: 'terraced houses', cat: 'buildings', desc: 'A row of three terraced houses in brick, each with its own door.', build: function (c) {
    var w = 5.5, L = 3 * w, W = 8, H = 6, cols = [0x2a4d6e, 0x8a2a2a, 0x2f6d4a];
    c.box(L, H, W, MAT.brick, 0, H / 2, 0); bdRoof(c, L, W, H, 2.6, bdPaint(0x4a4a50), MAT.brick, 0.35);
    for (var i = 0; i < 3; i++) { var x = -L / 2 + (i + 0.5) * w; c.box(0.95, 2.1, 0.08, bdPaint(cols[i]), x - 1.4, 1.05, W / 2 + 0.03); bdWindow(c, 1.6, 1.2, x + 0.9, 1.5, W / 2 + 0.03); bdWindow(c, 1.1, 1.1, x - 1.4, 4.2, W / 2 + 0.03); bdWindow(c, 1.1, 1.1, x + 0.9, 4.2, W / 2 + 0.03); c.box(0.5, 1.2, 0.5, MAT.brick, x, H + 2.0, -1.2); if (i) c.box(0.12, H + 0.2, 0.3, MAT.brick, -L / 2 + i * w, H / 2, W / 2 + 0.1); }
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'Terraced houses', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdCafe', { extra: true, shop: false, label: 'cafe', cat: 'buildings', desc: 'A corner cafe: a glass front, an awning, tables outside.', build: function (c) {
    var L = 8, W = 6, H = 4.2, wall = bdPaint(0xe7d8be);
    c.box(L, H, W, wall, 0, H / 2, 0); c.box(L + 0.2, 0.25, W + 0.2, bdPaint(0x3a2a20), 0, H + 0.12, 0);
    c.box(L - 1.4, 2.3, 0.06, bdGlass(), -0.4, 1.35, W / 2 + 0.02); c.box(1.0, 2.2, 0.08, bdPaint(0x3a2a20), L / 2 - 1.0, 1.1, W / 2 + 0.03);
    for (var i = 0; i < 10; i++) { var aw = c.box(0.78, 0.04, 1.4, bdPaint(i % 2 ? 0xf3f0e8 : 0x2a6b4a), -L / 2 + 0.4 + i * 0.8, 2.95, W / 2 + 0.65); aw.rotation.x = 0.3; }
    c.sign(['CAFE'], 2.4, 0.55, 0, 3.6, W / 2 + 0.02, 0, { w: 512, h: 120, bg: '#3a2a20', fg: '#f3efe4' });
    [-2.4, 0.2].forEach(function (x) { c.cyl(0.4, 0.04, MAT.white, x, 0.75, W / 2 + 1.6, 16); c.cyl(0.04, 0.73, MAT.steelDark, x, 0.37, W / 2 + 1.6, 6); [-0.6, 0.6].forEach(function (dx) { c.box(0.38, 0.04, 0.38, MAT.wood, x + dx, 0.45, W / 2 + 1.6); c.box(0.04, 0.45, 0.04, MAT.steelDark, x + dx, 0.22, W / 2 + 1.6); }); c.solid(x - 0.9, x + 0.9, W / 2 + 1.2, W / 2 + 2.0, 0, 0.8); });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'A cafe', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdSupermarket', { extra: true, shop: false, label: 'supermarket', cat: 'buildings', desc: 'A supermarket: a long glass front, a big sign and trolley bays.', build: function (c) {
    var L = 24, W = 16, H = 6;
    c.box(L, H, W, bdSheet(0xe4e4e0), 0, H / 2, 0); c.box(L + 0.4, 0.8, W + 0.4, bdPaint(0xc0282e), 0, H + 0.2, 0);
    c.box(L - 4, 3.0, 0.08, bdGlass(), 0, 1.6, W / 2 + 0.03); c.box(3, 2.6, 0.1, std({ color: 0xbfd8e6, roughness: 0.05, transparent: true, opacity: 0.4 }), 0, 1.3, W / 2 + 0.06);
    c.box(L, 0.4, 3, MAT.steelDark, 0, 3.6, W / 2 + 1.5);
    c.sign(['FRESH MARKET'], 8, 1.4, 0, 5.0, W / 2 + 0.25, 0, { w: 1024, h: 180, bg: '#c0282e', fg: '#ffffff' });
    [-8, 8].forEach(function (x) { c.box(2.4, 1.0, 0.08, MAT.steel, x, 0.5, W / 2 + 2.6); for (var t = 0; t < 4; t++) c.box(0.55, 0.8, 0.9, MAT.steel, x - 0.9 + t * 0.6, 0.6, W / 2 + 2.0); });
    c.solid(-L / 2, L / 2, -W / 2, W / 2, 0, H); bdUse(c, 'A supermarket', -L / 2, L / 2, -W / 2, W / 2 + 0.1, H);
  } });
  defProp('bdCarPark', { extra: true, shop: false, label: 'multi-storey car park', cat: 'buildings', desc: 'A three-deck car park: concrete decks on columns, open sides.', build: function (c) {
    var L = 20, W = 14, fh = 3, n = 3, H = n * fh;
    for (var f = 1; f <= n; f++) { c.box(L, 0.35, W, MAT.grey, 0, f * fh, 0); c.box(L, 0.9, 0.2, MAT.grey, 0, f * fh + 0.6, W / 2 - 0.1); c.box(L, 0.9, 0.2, MAT.grey, 0, f * fh + 0.6, -W / 2 + 0.1); }
    for (var i = 0; i < 5; i++) [-1, 1].forEach(function (s) { var x = -L / 2 + 0.3 + i * (L - 0.6) / 4; c.box(0.5, H, 0.5, MAT.grey, x, H / 2, s * (W / 2 - 0.3)); c.solid(x - 0.25, x + 0.25, s * (W / 2 - 0.3) - 0.25, s * (W / 2 - 0.3) + 0.25, 0, H); });
    c.box(L, 0.02, W, MAT.yard || MAT.grey, 0, 0.01, 0); for (var k = 0; k < 6; k++) c.box(0.1, 0.012, 4.8, MAT.white, -L / 2 + 2 + k * 3.2, 0.02, 3);
    c.sign(['P', 'PARKING'], 1.6, 1.2, -L / 2 + 0.5, H - 1.0, W / 2 + 0.03, 0, { w: 256, h: 192, bg: '#2a5a9e', fg: '#ffffff' });
    bdUse(c, 'A car park', -L / 2, L / 2, -W / 2, W / 2, 0.3);
  } });
  // the paint and the glass, made once and shared by every car of that colour
  var CR_PAINT = {}, CR_GLASS = null;
  function crPaint(hex) { if (!CR_PAINT[hex]) CR_PAINT[hex] = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.35, metalness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.15 }); return CR_PAINT[hex]; }
  function crGlass() { if (!CR_GLASS) CR_GLASS = std({ color: 0x232c38, roughness: 0.05, metalness: 0.5 }); return CR_GLASS; }
  // a number plate from the copy's own id, so it stays the same every time the car is built
  function crPlate(inst) { var s = 0, id = String(inst && inst.id || 'car'); for (var i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) % 99991; return 'CO ' + (10 + s % 90) + ' ' + ['AB', 'KH', 'NL', 'XY', 'RT', 'GD'][s % 6] + (100 + s % 900); }
  function crUse(c, label, L, W, H) { c.solid(-L / 2 - 0.05, L / 2 + 0.05, -W / 2 - 0.05, W / 2 + 0.05, 0, H); c.hit(L, H, W, 0, H / 2, 0, { prompt: function () { return label; }, use: function () { toast(label + ': parked.', ''); } }); }
  // a wheel: tyre, rim and hub, its axle across the car (z)
  function crWheel(c, x, z, r, w) { var s = z > 0 ? 1 : -1; c.cyl(r, w, MAT.rubber, x, r, z, 18).rotation.x = Math.PI / 2; c.cyl(r * 0.6, w + 0.005, MAT.chrome, x, r, z, 14).rotation.x = Math.PI / 2; c.cyl(r * 0.18, 0.03, MAT.steelDark, x, r, z + s * (w / 2 + 0.01), 8).rotation.x = Math.PI / 2; }
  // a body from boxes: the lower body, a cabin (or a box), the glass round the cabin, the wheels, the lamps, the bumpers and the plates.
  // o: { L, W, r (wheel radius), axle (front and back axle from the middle), lowH, cab: [x, length, height], col, bed, box: [x, length, height, col] }
  function crBuild(c, o, inst) {
    var L = o.L, W = o.W, r = o.r, base = r * 0.75, paint = crPaint(o.col), glass = crGlass();
    c.box(L, o.lowH, W, paint, 0, base + o.lowH / 2, 0);
    var top = base + o.lowH;
    if (o.cab) { var cx = o.cab[0], cl = o.cab[1], ch = o.cab[2];
      c.box(cl, ch, W - 0.12, paint, cx, top + ch / 2, 0);
      c.box(0.04, ch * 0.72, W - 0.22, glass, cx + cl / 2 + 0.01, top + ch * 0.5, 0); c.box(0.04, ch * 0.72, W - 0.22, glass, cx - cl / 2 - 0.01, top + ch * 0.5, 0);
      [-1, 1].forEach(function (s) { c.box(cl - 0.3, ch * 0.62, 0.04, glass, cx, top + ch * 0.52, s * (W / 2 - 0.05)); });
      c.box(cl * 0.4, 0.05, W * 0.6, MAT.black, cx, top + ch + 0.03, 0); }
    if (o.bed) { var bx = o.bed[0], bl = o.bed[1]; [-1, 1].forEach(function (s) { c.box(bl, 0.4, 0.06, paint, bx, top + 0.2, s * (W / 2 - 0.03)); }); c.box(0.06, 0.4, W, paint, bx - bl / 2, top + 0.2, 0); c.box(bl, 0.03, W - 0.1, MAT.steelDark, bx, top + 0.02, 0); }
    if (o.box) { var kx = o.box[0], kl = o.box[1], kh = o.box[2]; c.box(kl, kh, W + 0.08, crPaint(o.box[3] || 0xf2f2ee), kx, top + kh / 2 + 0.05, 0); c.box(0.04, kh - 0.2, W - 0.1, MAT.steelDark, kx - kl / 2 - 0.02, top + kh / 2 + 0.05, 0); }
    [o.axle, -o.axle].forEach(function (x) { [-1, 1].forEach(function (s) { crWheel(c, x, s * (W / 2 - 0.12), r, 0.24); }); });
    if (o.axle2) [-1, 1].forEach(function (s) { crWheel(c, -o.axle2, s * (W / 2 - 0.12), r, 0.24); });
    c.box(0.12, 0.22, W + 0.06, MAT.plastic, L / 2 + 0.02, base + 0.15, 0); c.box(0.12, 0.22, W + 0.06, MAT.plastic, -L / 2 - 0.02, base + 0.15, 0);
    [-1, 1].forEach(function (s) { c.box(0.06, 0.15, 0.3, glowMat(0xfff2c0, 0.4), L / 2 + 0.02, base + o.lowH * 0.7, s * (W / 2 - 0.3)); c.box(0.06, 0.14, 0.3, glowMat(0xff2a1a, 0.5), -L / 2 - 0.02, base + o.lowH * 0.7, s * (W / 2 - 0.3)); });
    var plate = crPlate(inst); c.sign([plate], 0.44, 0.11, L / 2 + 0.09, base + 0.18, 0, Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }); c.sign([plate], 0.44, 0.11, -L / 2 - 0.09, base + 0.18, 0, -Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' });
    return top + (o.cab ? o.cab[2] : 0) + (o.box ? o.box[2] : 0);
  }
  // the saloons are the traffic's own car, parked
  function crSaloon(hex, label) { return function (c, P, inst) { var m = carMesh({ col: hex, plate: crPlate(inst) }); m.userData.dynamic = false; c.add(m); crUse(c, label, 4.4, 1.9, 1.6); }; }
  defProp('vhSaloonRed', { extra: true, shop: false, label: 'red saloon', cat: 'cars', desc: 'A parked saloon, red.', build: crSaloon(0xa8262c, 'A red saloon') });
  defProp('vhSaloonBlue', { extra: true, shop: false, label: 'blue saloon', cat: 'cars', desc: 'A parked saloon, blue.', build: crSaloon(0x24508f, 'A blue saloon') });
  defProp('vhSaloonSilver', { extra: true, shop: false, label: 'silver saloon', cat: 'cars', desc: 'A parked saloon, silver.', build: crSaloon(0xb8bdc4, 'A silver saloon') });
  defProp('vhHatchback', { extra: true, shop: false, label: 'hatchback', cat: 'cars', desc: 'A small hatchback, green.', build: function (c, P, inst) { var h = crBuild(c, { L: 3.8, W: 1.72, r: 0.3, axle: 1.2, lowH: 0.55, cab: [-0.35, 2.2, 0.58], col: 0x3f7a4a }, inst); crUse(c, 'A hatchback', 3.8, 1.72, h); } });
  defProp('vhEstate', { extra: true, shop: false, label: 'estate', cat: 'cars', desc: 'A long estate car, dark grey.', build: function (c, P, inst) { var h = crBuild(c, { L: 4.7, W: 1.84, r: 0.32, axle: 1.5, lowH: 0.55, cab: [-0.55, 3.0, 0.58], col: 0x3b4048 }, inst); crUse(c, 'An estate car', 4.7, 1.84, h); } });
  defProp('vhSuv', { extra: true, shop: false, label: 'SUV', cat: 'cars', desc: 'A tall SUV on big wheels, black.', build: function (c, P, inst) { var h = crBuild(c, { L: 4.7, W: 1.95, r: 0.4, axle: 1.45, lowH: 0.7, cab: [-0.4, 2.9, 0.7], col: 0x1c1f24 }, inst); crUse(c, 'An SUV', 4.7, 1.95, h); } });
  defProp('vhPickup', { extra: true, shop: false, label: 'pickup', cat: 'cars', desc: 'A pickup truck with an open bed, orange.', build: function (c, P, inst) { var h = crBuild(c, { L: 5.3, W: 1.95, r: 0.4, axle: 1.75, lowH: 0.65, cab: [0.7, 2.1, 0.75], bed: [-1.45, 2.1], col: 0xc8641e }, inst); crUse(c, 'A pickup', 5.3, 1.95, h); } });
  defProp('vhVan', { extra: true, shop: false, label: 'van', cat: 'cars', desc: 'A panel van, white.', build: function (c, P, inst) { var h = crBuild(c, { L: 5.2, W: 2.0, r: 0.36, axle: 1.7, lowH: 0.75, cab: [0.0, 4.6, 1.2], col: 0xeeeeea }, inst); c.box(2.6, 0.9, 0.02, crPaint(0xeeeeea), -0.9, 1.75, 1.0); crUse(c, 'A van', 5.2, 2.0, h); } });
  defProp('vhBoxTruck', { extra: true, shop: false, label: 'box truck', cat: 'cars', desc: 'A box truck: a cab and a cargo box, blue and white.', build: function (c, P, inst) { var h = crBuild(c, { L: 7.2, W: 2.3, r: 0.48, axle: 2.5, axle2: 1.4, lowH: 0.7, cab: [2.6, 1.8, 1.3], box: [-0.9, 5.2, 2.4, 0xf2f2ee], col: 0x2a5a9e }, inst); crUse(c, 'A box truck', 7.2, 2.3, h); } });
  defProp('vhTaxi', { extra: true, shop: false, label: 'taxi', cat: 'cars', desc: 'A taxi with its roof sign.', build: function (c, P, inst) { var m = carMesh({ col: 0xf2c224, plate: crPlate(inst) }); m.userData.dynamic = false; c.add(m); c.box(0.6, 0.18, 0.3, MAT.black, -0.2, 1.53, 0); c.sign(['TAXI'], 0.5, 0.14, -0.2, 1.53, 0.16, 0, { w: 256, h: 72, bg: '#f2c224', fg: '#1b232c' }); c.sign(['TAXI'], 0.5, 0.14, -0.2, 1.53, -0.16, Math.PI, { w: 256, h: 72, bg: '#f2c224', fg: '#1b232c' }); crUse(c, 'A taxi', 4.4, 1.9, 1.7); } });
  defProp('vhPolice', { extra: true, shop: false, label: 'police car', cat: 'cars', desc: 'A police car with a light bar.', build: function (c, P, inst) { var m = carMesh({ col: 0xf4f6f8, plate: crPlate(inst) }); m.userData.dynamic = false; c.add(m); c.box(3.6, 0.12, 0.02, crPaint(0x1d4fb8), 0, 0.72, 0.93); c.box(3.6, 0.12, 0.02, crPaint(0x1d4fb8), 0, 0.72, -0.93); c.box(0.2, 0.1, 1.1, MAT.black, -0.2, 1.47, 0); c.box(0.18, 0.1, 0.4, glowMat(0x2f6bff, 0.9), -0.2, 1.55, 0.3); c.box(0.18, 0.1, 0.4, glowMat(0xff2f2f, 0.9), -0.2, 1.55, -0.3); crUse(c, 'A police car', 4.4, 1.9, 1.7); } });
  defProp('vhBus', { extra: true, shop: false, label: 'bus', cat: 'cars', desc: 'A city bus, 11 m long.', build: function (c, P, inst) {
    var L = 11, W = 2.5, r = 0.5, paint = crPaint(0xc0282e), glass = crGlass();
    c.box(L, 2.6, W, paint, 0, 0.5 + 1.3, 0); c.box(L - 0.4, 0.06, W - 0.2, MAT.grey, 0, 3.13, 0);
    [-1, 1].forEach(function (s) { c.box(L - 2.2, 0.95, 0.04, glass, -0.4, 2.2, s * (W / 2 + 0.01)); }); c.box(0.04, 1.3, W - 0.3, glass, L / 2 + 0.01, 2.0, 0); c.box(0.04, 0.9, W - 0.4, glass, -L / 2 - 0.01, 2.3, 0);
    c.box(1.1, 2.0, 0.05, MAT.steelDark, 3.8, 1.5, W / 2 + 0.02); c.box(1.1, 2.0, 0.05, MAT.steelDark, -0.6, 1.5, W / 2 + 0.02);
    [3.6, -3.4].forEach(function (x) { [-1, 1].forEach(function (s) { crWheel(c, x, s * (W / 2 - 0.15), r, 0.3); }); });
    c.sign(['12  STATION'], 1.6, 0.26, L / 2 + 0.03, 2.85, 0, Math.PI / 2, { w: 512, h: 84, bg: '#111418', fg: '#ffb020' });
    [-1, 1].forEach(function (s) { c.box(0.06, 0.18, 0.34, glowMat(0xfff2c0, 0.4), L / 2 + 0.02, 0.9, s * 0.9); c.box(0.06, 0.18, 0.3, glowMat(0xff2a1a, 0.5), -L / 2 - 0.02, 0.9, s * 0.9); });
    crUse(c, 'A bus', L, W, 3.2);
  } });
  var CT_WALK = [], CT_IDLE = [], CT_LIGHTS = [];
  function ctUse(c, label, w, h, d, y) { c.hit(w, h, d, 0, y === undefined ? h / 2 : y, 0, { prompt: function () { return label; }, use: function () { toast(label + '.', ''); } }); }
  function ctSolid(c, w, d, h) { c.solid(-w / 2, w / 2, -d / 2, d / 2, 0, h); }
  function ctPaint(hex) { return std({ color: hex, roughness: 0.6, metalness: 0.2 }); }
  // the city moves: walkers pace their pavement, idle people breathe and look about, traffic lights cycle. A prop rebuilt or removed drops out
  function ctFrame(dt) {
    var live = function (e) { for (var o = e.root; o; o = o.parent) if (o === scene) return true; return false; };
    CT_WALK = CT_WALK.filter(live); CT_IDLE = CT_IDLE.filter(live); CT_LIGHTS = CT_LIGHTS.filter(live);
    CT_WALK.forEach(function (w) { w.t += dt * w.speed; var span = w.len, p = w.t % (2 * span), fwd = p < span, x = fwd ? p - span / 2 : span * 1.5 - p; w.g.position.x = x; w.g.rotation.y = fwd ? Math.PI / 2 : -Math.PI / 2; animateHuman(w.g, dt, 'walk', w.speed); });
    CT_IDLE.forEach(function (w) { animateHuman(w.g, dt, 'idle', 0); });
    var now = Date.now() / 1000;
    CT_LIGHTS.forEach(function (L) { var t = (now + L.offset) % 20, on = t < 9 ? 2 : t < 11 ? 1 : 0; L.lens.forEach(function (m, i) { m.material.emissiveIntensity = i === on ? 1.4 : 0.04; }); });
  }
  if (!CO.ctFrameHooked) { CO.ctFrameHooked = true; hook('frame', function (dt) { ctFrame(dt); }); }

  // ── lights ──
  function ctLampHead(c, x, y, z) { c.box(0.5, 0.12, 0.28, MAT.steelDark, x, y, z); var lens = c.box(0.42, 0.04, 0.22, glowMat(0xfff2c0, 0.6), x, y - 0.07, z); lampMeshes.push(lens); return lens; }
  defProp('ctStreetLamp', { extra: true, shop: false, label: 'street lamp', cat: 'city', desc: 'A 6 m street lamp on one arm; it lights at night.', build: function (c) { c.cyl(0.08, 6, MAT.steelDark, 0, 3, 0, 10, 0.12); c.box(1.2, 0.07, 0.07, MAT.steelDark, 0.55, 5.95, 0); ctLampHead(c, 1.15, 5.9, 0); c.light(0xffe2b0, 0.9, 16, 1.15, 5.6, 0); c.solid(-0.15, 0.15, -0.15, 0.15, 0, 6); ctUse(c, 'A street lamp', 0.3, 2, 0.3); } });
  defProp('ctDoubleLamp', { extra: true, shop: false, label: 'double street lamp', cat: 'city', desc: 'An 8 m lamp with two arms, for a wide road or a square.', build: function (c) { c.cyl(0.1, 8, MAT.steelDark, 0, 4, 0, 10, 0.15); [-1, 1].forEach(function (s) { c.box(1.4, 0.08, 0.08, MAT.steelDark, s * 0.65, 7.95, 0); ctLampHead(c, s * 1.35, 7.9, 0); }); c.light(0xffe2b0, 1.1, 20, 0, 7.4, 0); c.solid(-0.18, 0.18, -0.18, 0.18, 0, 8); ctUse(c, 'A street lamp', 0.36, 2, 0.36); } });
  defProp('ctParkLamp', { extra: true, shop: false, label: 'park lantern', cat: 'city', desc: 'A 3.5 m lantern post for a park or a pedestrian street.', build: function (c) { c.cyl(0.05, 3.2, MAT.black, 0, 1.6, 0, 10, 0.09); c.cyl(0.18, 0.08, MAT.black, 0, 3.25, 0, 8); var lens = c.cyl(0.15, 0.4, glowMat(0xffdca0, 0.7), 0, 3.5, 0, 8, 0.12); lampMeshes.push(lens); c.cyl(0.2, 0.12, MAT.black, 0, 3.76, 0, 8, 0.05); c.light(0xffd9a0, 0.6, 10, 0, 3.4, 0); c.solid(-0.1, 0.1, -0.1, 0.1, 0, 3.6); ctUse(c, 'A lantern', 0.3, 2, 0.3); } });
  defProp('ctTrafficLight', { extra: true, shop: false, label: 'traffic light', cat: 'city', desc: 'A traffic light that cycles green, amber and red.', build: function (c, P, inst) {
    c.cyl(0.07, 3.2, MAT.steelDark, 0, 1.6, 0, 10); c.box(0.36, 1.0, 0.3, MAT.black, 0, 3.0, 0.12);
    var lens = [[0xff2a1a, 3.32], [0xffa31a, 3.0], [0x34d058, 2.68]].map(function (q) { var m = c.cyl(0.11, 0.06, glowMat(q[0], 0.04), 0, q[1], 0.28, 14); m.rotation.x = Math.PI / 2; return m; });
    c.box(0.3, 0.4, 0.06, MAT.black, 0, 1.3, 0.1); c.box(0.18, 0.08, 0.02, MAT.white, 0, 1.3, 0.14);
    var s = 0, id = String(inst && inst.id || 'tl'); for (var i = 0; i < id.length; i++) s += id.charCodeAt(i);
    CT_LIGHTS.push({ root: c.group, lens: lens, offset: s % 20 }); c.solid(-0.12, 0.12, -0.12, 0.12, 0, 3.5); ctUse(c, 'A traffic light', 0.4, 2, 0.4);
  } });
  // ── the road ──
  defProp('ctCrossing', { extra: true, shop: false, label: 'zebra crossing', cat: 'city', desc: 'Zebra stripes across a 7 m road, with a beacon either side.', build: function (c) { for (var i = 0; i < 7; i++) c.box(0.5, 0.012, 3.0, MAT.white, -3.0 + i * 1.0, 0.006, 0); [-1, 1].forEach(function (s) { c.cyl(0.05, 2.6, MAT.black, s * 4.0, 1.3, 1.4, 8); var b = c.sphere(0.2, glowMat(0xffa31a, 0.8), s * 4.0, 2.75, 1.4); lampMeshes.push(b); }); ctUse(c, 'A zebra crossing', 7, 0.1, 3, 0.05); } });
  function ctRoadSign(lines, bg, fg, label, round) { return function (c) { c.cyl(0.04, 2.4, MAT.steel, 0, 1.2, 0, 8); if (round) { var d = c.cyl(0.32, 0.03, ctPaint(bg === '#ffffff' ? 0xffffff : 0xc0282e), 0, 2.45, 0.03, 20); d.rotation.x = Math.PI / 2; } c.sign(lines, round ? 0.5 : 0.8, round ? 0.5 : 0.6, 0, 2.45, round ? 0.05 : 0.03, 0, { w: 256, h: round ? 256 : 192, bg: bg, fg: fg }); c.solid(-0.06, 0.06, -0.06, 0.06, 0, 2.4); ctUse(c, label, 0.3, 2, 0.3); }; }
  defProp('ctSignStop', { extra: true, shop: false, label: 'stop sign', cat: 'city', desc: 'A stop sign on its post.', build: ctRoadSign(['STOP'], '#c0282e', '#ffffff', 'A stop sign', true) });
  defProp('ctSignSpeed', { extra: true, shop: false, label: 'speed limit sign', cat: 'city', desc: 'A 30 speed limit sign.', build: ctRoadSign(['30'], '#ffffff', '#1b232c', 'A speed limit sign', true) });
  defProp('ctSignStreet', { extra: true, shop: false, label: 'street name sign', cat: 'city', desc: 'A street name sign: High Street.', build: function (c) { c.cyl(0.04, 2.6, MAT.steel, 0, 1.3, 0, 8); c.sign(['High Street'], 1.2, 0.28, 0.6, 2.45, 0.03, 0, { w: 512, h: 120, bg: '#ffffff', fg: '#1b232c' }); c.sign(['High Street'], 1.2, 0.28, 0.6, 2.45, -0.03, Math.PI, { w: 512, h: 120, bg: '#ffffff', fg: '#1b232c' }); c.solid(-0.06, 0.06, -0.06, 0.06, 0, 2.6); ctUse(c, 'High Street', 0.3, 2, 0.3); } });
  defProp('ctManhole', { extra: true, shop: false, label: 'manhole cover', cat: 'city', desc: 'A round iron manhole cover, flush with the road.', build: function (c) { c.cyl(0.35, 0.02, MAT.gunmetal, 0, 0.01, 0, 24); c.cyl(0.25, 0.022, MAT.steelDark, 0, 0.011, 0, 24); } });
  defProp('ctRoadworks', { extra: true, shop: false, label: 'roadworks barrier', cat: 'city', desc: 'A red and white roadworks barrier with a lamp.', build: function (c) { [-0.8, 0.8].forEach(function (x) { c.box(0.06, 1.0, 0.5, MAT.steelDark, x, 0.5, 0); }); c.box(1.8, 0.22, 0.04, MAT.hazard, 0, 0.85, 0); c.box(1.8, 0.16, 0.04, MAT.hazard, 0, 0.5, 0); var l = c.cyl(0.08, 0.14, glowMat(0xffa31a, 0.8), 0.8, 1.1, 0, 10); lampMeshes.push(l); c.solid(-0.9, 0.9, -0.25, 0.25, 0, 1.1); ctUse(c, 'Roadworks', 1.8, 1.1, 0.4); } });
  // ── street furniture ──
  defProp('ctBench', { extra: true, shop: false, label: 'city bench', cat: 'city', desc: 'A wooden bench on iron legs.', build: function (c) { [-0.75, 0.75].forEach(function (x) { c.box(0.06, 0.45, 0.5, MAT.black, x, 0.23, 0); c.box(0.06, 0.45, 0.06, MAT.black, x, 0.68, -0.22); }); for (var i = 0; i < 3; i++) c.box(1.7, 0.04, 0.12, MAT.wood, 0, 0.46, -0.15 + i * 0.15); for (var j = 0; j < 2; j++) c.box(1.7, 0.1, 0.03, MAT.wood, 0, 0.62 + j * 0.16, -0.24); c.solid(-0.85, 0.85, -0.25, 0.25, 0, 0.9); ctUse(c, 'A bench', 1.7, 0.9, 0.5); } });
  defProp('ctLitterBin', { extra: true, shop: false, label: 'litter bin', cat: 'city', desc: 'A round street litter bin.', build: function (c) { c.cyl(0.24, 0.85, ctPaint(0x2f4f3a), 0, 0.43, 0, 16, 0.22); c.cyl(0.27, 0.06, MAT.black, 0, 0.88, 0, 16); c.solid(-0.25, 0.25, -0.25, 0.25, 0, 0.9); ctUse(c, 'A litter bin', 0.5, 0.9, 0.5); } });
  defProp('ctRecycling', { extra: true, shop: false, label: 'recycling bins', cat: 'city', desc: 'Three recycling bins: glass, paper, plastic.', build: function (c) { [[0x2f7a4a, 'GLASS'], [0x2a5a9e, 'PAPER'], [0xd8a020, 'PLASTIC']].forEach(function (q, i) { var x = -0.75 + i * 0.75; c.box(0.68, 1.1, 0.68, ctPaint(q[0]), x, 0.55, 0); c.box(0.7, 0.06, 0.7, MAT.black, x, 1.12, 0); c.sign([q[1]], 0.5, 0.14, x, 0.85, 0.35, 0, { w: 256, h: 72, bg: '#1b232c', fg: '#ffffff' }); }); c.solid(-1.1, 1.1, -0.35, 0.35, 0, 1.15); ctUse(c, 'Recycling bins', 2.2, 1.15, 0.7); } });
  defProp('ctHydrant', { extra: true, shop: false, label: 'fire hydrant', cat: 'city', desc: 'A red fire hydrant.', build: function (c) { c.cyl(0.13, 0.6, MAT.red, 0, 0.3, 0, 14); c.sphere(0.13, MAT.red, 0, 0.62, 0); [-1, 1].forEach(function (s) { c.cyl(0.05, 0.12, MAT.chrome, s * 0.17, 0.4, 0, 10).rotation.z = Math.PI / 2; }); c.solid(-0.15, 0.15, -0.15, 0.15, 0, 0.75); ctUse(c, 'A fire hydrant', 0.3, 0.75, 0.3); } });
  defProp('ctPostBox', { extra: true, shop: false, label: 'post box', cat: 'city', desc: 'A red pillar post box.', build: function (c) { c.cyl(0.27, 1.3, MAT.red, 0, 0.65, 0, 20); c.cyl(0.3, 0.12, MAT.red, 0, 1.36, 0, 20, 0.32); c.box(0.3, 0.04, 0.05, MAT.black, 0, 1.05, 0.26); c.sign(['POST'], 0.3, 0.1, 0, 0.85, 0.275, 0, { w: 256, h: 80, bg: '#c0282e', fg: '#f5d24a' }); c.solid(-0.28, 0.28, -0.28, 0.28, 0, 1.4); ctUse(c, 'A post box', 0.56, 1.4, 0.56); } });
  defProp('ctPhoneBox', { extra: true, shop: false, label: 'phone box', cat: 'city', desc: 'A red telephone box.', build: function (c) { var red = ctPaint(0xb52a26), glass = std({ color: 0xcfe2ee, roughness: 0.05, transparent: true, opacity: 0.4 }); c.box(0.95, 2.4, 0.95, red, 0, 1.2, 0); [-1, 1].forEach(function (s) { c.box(0.7, 1.6, 0.02, glass, 0, 1.25, s * 0.48); c.box(0.02, 1.6, 0.7, glass, s * 0.48, 1.25, 0); }); c.box(1.05, 0.2, 1.05, red, 0, 2.5, 0); c.sign(['TELEPHONE'], 0.8, 0.14, 0, 2.3, 0.485, 0, { w: 512, h: 90, bg: '#111418', fg: '#ffffff' }); c.solid(-0.5, 0.5, -0.5, 0.5, 0, 2.6); ctUse(c, 'A phone box', 1, 2.6, 1); } });
  defProp('ctBollard', { extra: true, shop: false, label: 'street bollard', cat: 'city', desc: 'A black street bollard.', build: function (c) { c.cyl(0.1, 0.95, MAT.black, 0, 0.48, 0, 14, 0.11); c.cyl(0.11, 0.04, MAT.chrome, 0, 0.8, 0, 14); c.solid(-0.11, 0.11, -0.11, 0.11, 0, 1.0); } });
  defProp('ctBikeRack', { extra: true, shop: false, label: 'bike rack', cat: 'city', desc: 'A bike rack with two bicycles.', build: function (c) {
    [-0.6, 0, 0.6].forEach(function (x) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 18, Math.PI), MAT.steel); hoop.position.set(x, 0.35, 0); hoop.rotation.y = Math.PI / 2; hoop.castShadow = true; c.add(hoop); c.box(0.05, 0.36, 0.05, MAT.steel, x, 0.18, 0.35); c.box(0.05, 0.36, 0.05, MAT.steel, x, 0.18, -0.35); });
    [[-0.3, 0x2a5a9e], [0.3, 0xc0282e]].forEach(function (b) { var x = b[0], frame = ctPaint(b[1]); [-0.5, 0.5].forEach(function (z) { var w = c.cyl(0.33, 0.04, MAT.rubber, x, 0.33, z, 18); w.rotation.z = Math.PI / 2; }); c.box(0.03, 0.03, 0.9, frame, x, 0.55, 0); c.box(0.03, 0.4, 0.03, frame, x, 0.55, -0.2); c.box(0.25, 0.04, 0.1, MAT.black, x, 0.78, -0.25); c.box(0.45, 0.03, 0.03, MAT.black, x, 0.9, 0.4); });
    c.solid(-0.75, 0.75, -0.6, 0.6, 0, 1.0); ctUse(c, 'A bike rack', 1.5, 1, 1.2);
  } });
  defProp('ctStreetTree', { extra: true, shop: false, label: 'street tree', cat: 'city', desc: 'A street tree in an iron grate.', build: function (c) { c.box(1.2, 0.02, 1.2, MAT.gunmetal, 0, 0.01, 0); c.cyl(0.11, 2.8, std({ color: 0x5b4634, roughness: 1 }), 0, 1.4, 0, 8, 0.15); [[0, 3.4, 0, 1.1], [0.5, 3.0, 0.3, 0.8], [-0.5, 3.1, -0.35, 0.85], [0.1, 4.1, 0.1, 0.7]].forEach(function (b, i) { c.sphere(b[3], std({ color: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a][i], roughness: 1 }), b[0], b[1], b[2]); }); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 3); ctUse(c, 'A street tree', 0.5, 2.5, 0.5); } });
  defProp('ctParkingMeter', { extra: true, shop: false, label: 'parking meter', cat: 'city', desc: 'A parking meter.', build: function (c) { c.cyl(0.04, 1.1, MAT.steelDark, 0, 0.55, 0, 8); c.box(0.22, 0.4, 0.16, MAT.gunmetal, 0, 1.3, 0); c.box(0.14, 0.1, 0.02, MAT.screenGlass || MAT.glass, 0, 1.38, 0.09); c.solid(-0.1, 0.1, -0.1, 0.1, 0, 1.5); ctUse(c, 'A parking meter', 0.3, 1.5, 0.3); } });
  defProp('ctPlanter', { extra: true, shop: false, label: 'flower planter', cat: 'city', desc: 'A concrete planter with flowers.', build: function (c) { c.box(1.6, 0.55, 0.7, MAT.grey, 0, 0.28, 0); c.box(1.45, 0.05, 0.55, std({ color: 0x3a2a1c, roughness: 1 }), 0, 0.55, 0); for (var i = 0; i < 9; i++) c.sphere(0.12, std({ color: [0xd23c6a, 0xf2c224, 0xe8e0f0][i % 3], roughness: 0.8 }), -0.6 + (i % 5) * 0.3, 0.68, i < 5 ? -0.12 : 0.14); c.solid(-0.8, 0.8, -0.35, 0.35, 0, 0.6); ctUse(c, 'A planter', 1.6, 0.6, 0.7); } });
  defProp('ctAdColumn', { extra: true, shop: false, label: 'advertising column', cat: 'city', desc: 'A round advertising column with posters.', build: function (c) { c.cyl(0.6, 2.6, ctPaint(0x2f4f3a), 0, 1.3, 0, 24); c.cyl(0.66, 0.2, ctPaint(0x2f4f3a), 0, 2.7, 0, 24, 0.5); [0, 1, 2, 3].forEach(function (k) { var a = k * Math.PI / 2; c.sign([['CONCERT', 'SAT 8PM'], ['SALE', '50% OFF'], ['CIRCUS', 'IN TOWN'], ['MUSEUM', 'OPEN'] ][k], 0.7, 1.0, Math.sin(a) * 0.61, 1.5, Math.cos(a) * 0.61, a, { w: 256, h: 360, bg: ['#c0282e', '#f5b53d', '#2a5a9e', '#3f7a4a'][k], fg: '#ffffff' }); }); c.solid(-0.6, 0.6, -0.6, 0.6, 0, 2.8); ctUse(c, 'An advertising column', 1.2, 2.8, 1.2); } });
  defProp('ctBillboard', { extra: true, shop: false, label: 'billboard', cat: 'city', desc: 'A 6 m billboard on two posts.', build: function (c) { [-2.2, 2.2].forEach(function (x) { c.box(0.2, 4.2, 0.2, MAT.steelDark, x, 2.1, 0); }); c.box(6.2, 3.2, 0.12, MAT.white, 0, 4.6, 0); c.sign(['CO ENGINE', 'Your games. Your engine.'], 6.0, 3.0, 0, 4.6, 0.07, 0, { w: 1024, h: 512, bg: '#1b232c', fg: '#f5b53d' }); c.solid(-2.4, 2.4, -0.15, 0.15, 0, 6.2); ctUse(c, 'A billboard', 5, 3, 0.4, 1.5); } });
  defProp('ctFountain', { extra: true, shop: false, label: 'fountain', cat: 'city', desc: 'A round stone fountain for a square.', build: function (c) { c.cyl(2.0, 0.5, MAT.grey, 0, 0.25, 0, 32); c.cyl(1.8, 0.05, std({ color: 0x4a86b0, roughness: 0.1, metalness: 0.3 }), 0, 0.46, 0, 32); c.cyl(0.3, 1.2, MAT.grey, 0, 0.9, 0, 16); c.cyl(0.8, 0.15, MAT.grey, 0, 1.5, 0, 24); c.cyl(0.65, 0.04, std({ color: 0x4a86b0, roughness: 0.1, metalness: 0.3 }), 0, 1.58, 0, 24); c.solid(-2, 2, -2, 2, 0, 1.6); ctUse(c, 'A fountain', 4, 1.6, 4); } });
  // ── people ──
  defProp('ctWalker', { extra: true, shop: false, label: 'pedestrian (walking)', cat: 'city', desc: 'A pedestrian walking 8 m up and down the pavement along the prop\'s x: turn it to face the street.', build: function (c, P, inst) { var h = makeHuman({}); c.dynGroup().add(h); var s = 0, id = String(inst && inst.id || 'w'); for (var i = 0; i < id.length; i++) s += id.charCodeAt(i); CT_WALK.push({ root: c.group, g: h, t: s % 16, len: 8, speed: 1.1 + (s % 5) * 0.08 }); } });
  defProp('ctChatting', { extra: true, shop: false, label: 'pedestrians (chatting)', cat: 'city', desc: 'Two people standing and talking.', build: function (c) { var a = makeHuman({}), b = makeHuman({}); a.position.set(-0.45, 0, 0); a.rotation.y = Math.PI / 2; b.position.set(0.45, 0, 0); b.rotation.y = -Math.PI / 2; var dg = c.dynGroup(); dg.add(a); dg.add(b); CT_IDLE.push({ root: c.group, g: a }, { root: c.group, g: b }); c.solid(-0.8, 0.8, -0.3, 0.3, 0, 1.8); ctUse(c, 'Two people talking', 1.6, 1.8, 0.6); } });
  defProp('ctWaiting', { extra: true, shop: false, label: 'pedestrian (waiting)', cat: 'city', desc: 'Someone standing and waiting.', build: function (c) { var a = makeHuman({}); c.dynGroup().add(a); CT_IDLE.push({ root: c.group, g: a }); c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1.8); ctUse(c, 'Someone waiting', 0.6, 1.8, 0.6); } });
  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once
  var depotcoPack = function (HOST_DEF) {
    // the game's own defProp calls land here first; each is registered below as a pack prop
    var P_DEFS = [], defProp = function (id, def) { P_DEFS.push({ id: id, def: def }); return def; };
    // Depot Co.'s carried code, in its part order
    /* 01-head.js */
    function stageForOwned(up) { up = up || {}; return up.hall4 ? 5 : (up.hall2 || up.hall3) ? 4 : 3; }
    /* 01-head.js */
    var BOOT_STAGE = 5;   // the pack builds every prop at the depot's full size
    /* 02-config.js */
    var SKUS = [
        { id: 'paint',  name: 'Paint tins',       col: '#d14a3a', val: 38,  tier: 1, lvl: 1 },
        { id: 'bolts',  name: 'Bolt boxes',       col: '#7b8794', val: 22,  tier: 1, lvl: 1 },
        { id: 'cereal', name: 'Cereal cases',     col: '#f0b94d', val: 18,  tier: 1, lvl: 1 },
        { id: 'lamps',  name: 'Desk lamps',       col: '#e8d9a0', val: 26,  tier: 1, lvl: 1 },
        { id: 'coffee', name: 'Coffee beans',     col: '#6b4423', val: 45,  tier: 2, lvl: 6 },
        { id: 'toys',   name: 'Toy robots',       col: '#3fa7d6', val: 30,  tier: 2, lvl: 3 },
        { id: 'soap',   name: 'Detergent',        col: '#5fd38d', val: 14,  tier: 2, lvl: 7 },
        { id: 'books',  name: 'Book cartons',     col: '#8e6bbf', val: 20,  tier: 2, lvl: 4 },
        { id: 'shoes',  name: 'Trainers',         col: '#f2f2f2', val: 55,  tier: 3, lvl: 8 },
        { id: 'drills', name: 'Cordless drills',  col: '#2f9e44', val: 95,  tier: 3, lvl: 9 },
        { id: 'tv',     name: '32" televisions',  col: '#1f2937', val: 180, tier: 4, lvl: 11 },
        { id: 'tyres',  name: 'Tyre sets',        col: '#111111', val: 120, tier: 4, lvl: 12 },
        // own-brand goods come off the moulding line in the production wing (level 10, with the wing); raw granulate feeds it and is never ordered by a client
        { id: 'dccrate',   name: 'Depot Co. crates',       col: '#2f6b9a', val: 42, tier: 1, lvl: 10, own: true },
        { id: 'dcbin',     name: 'Depot Co. storage bins', col: '#6b8e23', val: 36, tier: 1, lvl: 10, own: true },
        { id: 'dcplanter', name: 'Depot Co. planters',     col: '#b5651d', val: 50, tier: 2, lvl: 13, own: true },
        { id: 'raw',       name: 'Raw granulate',          col: '#9aa0a6', val: 0,  tier: 99, lvl: 10, raw: true }
      ];
    /* 02-config.js */
    var SKU = {};
    /* 02-config.js */
    function skuName(id) { return SKU[id] ? SKU[id].name : id; }
    /* 02-config.js */
    function skuOpen(s) { return !!s && !s.raw && S.level >= (s.lvl || 1); }
    /* 02-config.js */
    var CLIENTS = [
        // mode: the shipping lane the client's parcels leave by (sea at OUT 1, land at OUT 2, air at OUT 3 once the sortation deck opens it). lvl: when the client finds you
        { id: 'hardware', name: 'Kessler Hardware',  mode: 'sea',  lvl: 1,  likes: ['paint', 'bolts', 'drills', 'lamps', 'dccrate', 'dcbin'] },
        { id: 'grocer',   name: 'Northgate Grocers', mode: 'land', lvl: 1,  likes: ['cereal', 'coffee', 'soap', 'dccrate'] },
        { id: 'toyshop',  name: 'Little Wonders',    mode: 'sea',  lvl: 3,  likes: ['toys', 'books', 'dcbin'] },
        { id: 'sports',   name: 'Fairlane Sports',   mode: 'air',  lvl: 8,  likes: ['shoes', 'tyres'] },
        { id: 'electro',  name: 'Volt & Co.',        mode: 'air',  lvl: 11, likes: ['tv', 'lamps', 'drills'] },
        { id: 'office',   name: 'Pinecrest Offices', mode: 'land', lvl: 4,  likes: ['lamps', 'coffee', 'books', 'paint', 'dcbin', 'dcplanter'] },
        // the deck accounts: they only come once the sortation deck stands, order more lines and more of each, and pay a third more
        { id: 'meridian',    name: 'Meridian Exports',   mode: 'sea',  lvl: 15, deck: true, likes: ['tv', 'drills', 'shoes', 'coffee', 'dcplanter'] },
        { id: 'nordwind',    name: 'Nordwind Parcels',   mode: 'air',  lvl: 15, deck: true, likes: ['toys', 'books', 'lamps', 'soap', 'dcbin'] },
        { id: 'continental', name: 'Continental Retail', mode: 'land', lvl: 15, deck: true, likes: ['paint', 'bolts', 'cereal', 'tyres', 'dccrate'] }
      ];
    /* 02-config.js */
    var MODES = {
        sea:  { name: 'Sea',  col: '#3fa7d6', form: 'crate', pack: 'export crating',  verb: 'crating',  haulier: 'OCEANIC LINES · PORT SHUTTLE' },
        land: { name: 'Land', col: '#5fd38d', form: 'strap', pack: 'strap and label', verb: 'strapping', haulier: 'DEPOT CO. FREIGHT' },
        air:  { name: 'Air',  col: '#ff6b5e', form: 'pouch', pack: 'air bagging',     verb: 'bagging',   haulier: 'SKYBRIDGE AIR CARGO' }
      };
    /* 02-config.js */
    var MODE_FEE = 0.75, AIR_RATE = 1.5;
    /* 02-config.js */
    var STAFF_NAMES = ['Jo', 'Mika', 'Sam', 'Ravi', 'Lena', 'Ada', 'Theo', 'Nour'];
    /* 02-config.js */
    var LEVEL_CAP = 25;
    /* 02-config.js */
    var XP_TABLE = [0, 60, 90, 130, 180, 260, 340, 440, 560, 700, 900, 1100, 1350, 1650, 2000, 2400, 2900, 3400, 4000, 4700, 5500, 6400, 7400, 8500, 9800, 9800];
    /* 02-config.js */
    var XP_FOR = function (lvl) { return XP_TABLE[clamp(lvl, 1, LEVEL_CAP)]; };
    /* 02-config.js */
    var XP = { box: 2, pallet: 8, pack: 10, ship: 15, truck: 6 };
    /* 02-config.js */
    var LEVEL_BONUS = 100;
    /* 02-config.js */
    var UNLOCK = {
        // the shop
        cart: 3, lights: 5, sign: 5, row3: 6, fork: 6, jackPower: 7, row4: 8, jackLift: 9, shipbelt: 9, raw: 10, row5: 12, agv: 12, plantTune: 13, agvFast: 13, gantry: 14, deckNight: 15, agvSweep: 15, plantAuto: 16,
        beltsA: 17, beltsB: 18, seating: 18, deckTune: 19, yardCat: 19, deckTier2: 22, decor: 23, clock: 2,
        // the crew and its options
        picker: 3, receiver: 4, packer: 8, driver: 8, shifts: 7, training: 9, raise: 11, cross: 13,
        // systems
        pc: 5, build: 5, contracts: 5, power: 5, rush: 6, loan: 6, prowler: 7, insurance: 7, inspector: 8, returns: 8, comfort: 5,
        scanPutaway: 2, scanStock: 3, scanCrew: 3, scanDocks: 5, scanMap: 5, scanPlant: 10,
        contractsBig: 17, twoContracts: 21, longContract: 24
      };
    /* 02-config.js */
    function unlocked(what) { return S.level >= (UNLOCK[what] || 1); }
    /* 02-config.js */
    var STAFF_CAPS = [0, 0, 0, 1, 2, 2, 2, 3, 4, 4, 5, 5, 5, 5, 6, 6, 7, 7, 7, 7, 8];
    /* 02-config.js */
    function staffCapAt(level) { return STAFF_CAPS[Math.min(level, STAFF_CAPS.length - 1)]; }
    /* 02-config.js */
    var LADDER_NOTES = {
        2: 'a second rack bay and the time clock', 3: 'a third bay, the picking cart, a picker to hire, Little Wonders', 4: 'a fourth bay, the coffee flask, a receiver to hire, Pinecrest Offices',
        5: 'the hall: proper docks, the office and the PC, the break room, the bench and pack line, the yard', 6: 'the forklift and a third rack row in the shop, the bank, coffee beans', 7: 'the powered pallet truck, shift patterns, a third head', 8: 'the fourth row, the packer and the forklift driver, returns, trainers',
        9: 'the high-lift stacker, the shipping belt, training', 10: 'the 60 by 48 hall: IN 2, OUT 2 and the sea lane, the production wing, the second jack, the car park and the road', 11: 'Volt and Co., televisions, the raise', 12: 'the fifth row and the AGV', 13: 'the plant tune-up, AGV fast drive, a second role', 14: 'the gantry pickers',
        15: 'the big hall: the mezzanine, the sortation deck, OUT 3 and the air lane, three deck accounts', 16: 'the plant automation suite', 17: 'conveyor pieces: straights and curves', 18: 'inclines and the high run, the comfort seating', 19: 'the deck dial to 300 percent, the yard catalogue',
        20: 'the returns hall and Hall 3 with IN 3, eight heads', 21: 'two contracts at once', 22: 'the deck runs half as fast again', 23: 'the last of the furniture', 24: 'the long contract', 25: 'Hall 4 and the full yard: the depot is complete'
      };
    /* 02-config.js */
    var LADDER_TIPS = { 2: 'The time clock is on the wall: E clocks you in and keeps your hours.', 5: 'The office PC is on the desk: E sits you down. Orders, the shop, the crew and the bank are on it.', 6: 'The forklift is in the shop. It drives with WASD, lifts with R and F, and reaches the top shelf.', 10: 'Two outbound doors now: the board shows every order’s lane, and a parcel out of the wrong door pays a forwarding fee.', 15: 'Every parcel off the pack line rides up to the deck and down into the truck of its lane by itself.', 20: 'Returns go to the returns hall now: the truck brings them to its own dock and the belt takes them in.' };
    /* 02-config.js */
    var DAY_START = 6, DAY_END = 22;
    /* 02-config.js */
    var TRUCK_IN = [7.5, 13.5];
    /* 02-config.js */
    var ECON = {
        start: 600, rent: 110, rawPrice: 120, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
        wage: { receiver: 85, picker: 85, packer: 75, driver: 95 },
        rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
        palletCap: 8, slotCap: 12, cartCap: 12, benchCap: 24, tableCap: 8
      };
    /* 02-config.js */
    var UPGRADES = [
        { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: UNLOCK.cart, desc: 'A trolley with three shelves that holds twelve boxes or parcels. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
        { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: UNLOCK.row3, desc: 'Another row of hand-reachable slots and a top level for the forklift.' },
        { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: UNLOCK.fork, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
        { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: UNLOCK.row4, desc: 'Another row of bays across three levels.' },
        { id: 'row5',   name: 'Fifth rack row',      price: ECON.rowPrice,   lvl: UNLOCK.row5, desc: 'The last row in the main hall. The annex halls come at level 20.' },
        { id: 'lights', name: 'LED high bays',       price: ECON.lightsPrice, lvl: UNLOCK.lights, desc: 'Brighter hall, and the inspector likes a well-lit floor: fines are halved.' },
        { id: 'dock2',  name: 'Second inbound bay',  price: 1400,            lvl: 10, free: 2, desc: 'Two inbound trucks a day can dock at once, and clients send bigger loads. Comes with the hall at level 10.' },
        { id: 'sign',   name: 'Roadside sign',       price: 500,             lvl: UNLOCK.sign, desc: 'New clients find you sooner. Reputation grows a little faster.' },
        { id: 'shipbelt', name: 'Shipping belt and dock loader', price: 1800, lvl: UNLOCK.shipbelt, desc: 'Parcels roll off the pack line shelf onto a belt down the east wall into the OUT 2 shipping bay (OUT 1 before the hall grows), a flow rack that holds nine, and the dock loader beside it pushes them into any docked truck with its door up.' },
        { id: 'agv',    name: 'AGV pallet mover',    price: 3200,            lvl: UNLOCK.agv, desc: 'A driverless truck. Set a pallet on its pickup square (or let the palletiser drop one) and it puts it away on the racks by itself.' },
        { id: 'gantry', name: 'Gantry pickers over the racks', price: 5000, lvl: UNLOCK.gantry, desc: 'A crane over every rack row you own (new rows get theirs too). Each watches the orders, picks the boxes the bench still needs out of its row and sends them down the overhead pick belts to the bench.' },
        // tiers on what you already own (each needs the one before it)
        { id: 'jackPower', name: 'Powered pallet truck',   price: 1200, lvl: UNLOCK.jackPower, desc: 'An electric drive on the pallet jacks: you walk at full speed with a loaded pallet behind you.' },
        { id: 'jackLift',  name: 'High-lift stacker',      price: 2200, lvl: UNLOCK.jackLift, needs: 'jackPower', desc: 'The jacks lift to the second rack level: set pallets into the middle shelf and pull them out by hand. The top shelf stays forklift work.' },
        { id: 'agvFast',   name: 'AGV: fast drive',        price: 1800, lvl: UNLOCK.agvFast, needs: 'agv', desc: 'The AGV runs at 2.2 m/s instead of 1.3: a put-away in little over half the time.' },
        { id: 'agvSweep',  name: 'AGV: floor sweep',       price: 2400, lvl: UNLOCK.agvSweep, needs: 'agvFast', desc: 'The AGV fetches any pallet left anywhere on the hall floor, not only the ones on its square, keeping clear of you and of pallets the crew already have in hand.' },
        { id: 'plantTune', name: 'Plant tune-up',          price: 2000, lvl: UNLOCK.plantTune, desc: 'Every machine dial goes to 300% (250 and 300 join the steps), and the pack line jams half as often.' },
        { id: 'plantAuto', name: 'Plant automation suite', price: 3500, lvl: UNLOCK.plantAuto, needs: 'plantTune', desc: 'The pack line never jams, and it starts any order the bench can complete by itself, no terminal tap needed. An AUTO switch on the bench terminal turns that off and on.' },
        { id: 'upper',     name: 'Mezzanine level',        price: 6000, lvl: 15, free: 3, desc: 'A steel deck over the receiving strip with a goods lift by the IN docks, one rack row of two levels up there and a crane of its own. Comes with the big hall at level 15.' },
        { id: 'sorter',    name: 'Sortation deck and air dock', price: 7500, lvl: 15, free: 3, desc: 'Every parcel off the pack line rides a spiral up to the deck and along the sorter: a scanner reads its lane, three cells crate it for the sea, strap it for the land or bag it for the air, and spirals drop it into the right dock loader by itself. OUT 3 and the air clients come with it. Comes with the big hall at level 15.' },
        { id: 'deckNight', name: 'Deck night shift',       price: 1800, lvl: UNLOCK.deckNight, needs: 'sorter', desc: 'The deck keeps running while you sleep: every parcel on the shelf and on the deck belts is sorted by morning and staged beside the loader of its lane, and the first truck of each lane loads them from the bays by itself.' },
        // the annex halls, free with the stages
        { id: 'hall2', name: 'Returns hall (east annex)',      price: 9000, lvl: 20, free: 4, needs: 'fork',  desc: 'A second hall off the north wall, east of the production wing, given over to returns: a returns dock of its own with a truck twice a day, the belt to the intake, three inspection desks, the restock cage and a compactor. Comes at level 20.' },
        { id: 'hall3', name: 'Hall 3 (west annex) and IN 3',   price: 9500, lvl: 20, free: 4, needs: 'hall2', desc: 'A third hall west of the wing with two rows of five bays and a third inbound dock, IN 3, on its west wall. Comes at level 20.' },
        { id: 'hall4', name: 'Hall 4 (behind the wing)',       price: 9500, lvl: 25, free: 5, needs: 'hall3', desc: 'The back hall, through the north wall of the production wing: 24 by 20 metres and two more rows of seven bays. Comes at level 25.' }
      ];
    /* 02-config.js */
    function upgradeName(id) { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }
    /* 02-config.js */
    var STAFF_ROLES = {
        receiver: { name: 'Receiver', wage: ECON.wage.receiver, lvl: UNLOCK.receiver, desc: 'Walks pallets out of a docked inbound truck and puts them on the racks.' },
        picker:   { name: 'Picker',   wage: ECON.wage.picker,   lvl: UNLOCK.picker, desc: 'Takes boxes off the racks for open orders and brings them to the bench.' },
        packer:   { name: 'Packer',   wage: ECON.wage.packer,   lvl: UNLOCK.packer, desc: 'Packs complete orders at the bench and loads the parcels into a docked outbound truck.' },
        driver:   { name: 'Forklift driver', wage: ECON.wage.driver, lvl: UNLOCK.driver, needs: 'fork', desc: 'Drives the forklift: puts the pallets left on the hall floor away on any level, the top shelf included, and parks it back in its bay. Needs the forklift.' }
      };
    /* 02-config.js */
    var STAGES = [
        { id: 'shed',  name: 'The shed',       level: 1,  hall: { x: 7, z: 5, h: 5 },    rows: [-3.8], bays: 4, x0: -6,   inZ: [0],        outZ: [],              retZ: [],    rent: 0,   maxOpen: 2,  pallets: [1, 3], skylights: [0],                   fence: { x: 24, z0: -16, z1: 16 } },
        { id: 'small', name: 'The small hall', level: 5,  hall: { x: 20, z: 14, h: 7 },  rows: [-6, -2, 2, 6], bays: 8, x0: -12, inZ: [-8], outZ: [-8],            retZ: [],    rent: 60,  maxOpen: 4,  pallets: [2, 4], skylights: [-7, 0, 7],           fence: { x: 50, z0: -40, z1: 40 } },
        { id: 'hall',  name: 'The hall',       level: 10, hall: { x: 30, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6], outZ: [-14, -6], retZ: [], rent: 110, maxOpen: 6,  pallets: [3, 6], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
        { id: 'big',   name: 'The big hall',   level: 15, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6], outZ: [-14, -6, -21.6], retZ: [], rent: 110, maxOpen: 8, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
        { id: 'annex', name: 'The annexes',    level: 20, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6, -34], outZ: [-14, -6, -21.6], retZ: [-34], rent: 160, maxOpen: 10, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
        { id: 'far',   name: 'The far end',    level: 25, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6, -34], outZ: [-14, -6, -21.6], retZ: [-34], rent: 160, maxOpen: 10, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } }
      ];
    /* 02-config.js */
    var STAGE_LAST = STAGES.length - 1, STAGE = STAGES[BOOT_STAGE];
    /* 02-config.js */
    function stageForLevel(l) { var s = 0; for (var i = 0; i < STAGES.length; i++) if (l >= STAGES[i].level) s = i; return s; }
    /* 02-config.js */
    var STAGE_OF = { rooms: 1, docks: 1, bench: 1, yard: 1, gates: 1, wing: 2, jack2: 2, carpark: 2, road: 2, lanes: 2, deck: 3, neighbours: 3, hallDoors: 3, annex: 4, hall4: 5 };
    /* 02-config.js */
    function stageHas(what) { return BOOT_STAGE >= (STAGE_OF[what] === undefined ? 0 : STAGE_OF[what]); }
    /* 02-config.js */
    function stageName(i) { return STAGES[clamp(i, 0, STAGE_LAST)].name; }
    /* 02-config.js */
    function stageFlags(up, stage) { if (stage >= 1 && (up.rows || 0) < 2) up.rows = 2; if (stage >= 2) up.dock2 = true; if (stage >= 3) { up.upper = true; up.sorter = true; } if (stage >= 4) { up.hall2 = true; up.hall3 = true; } if (stage >= 5) up.hall4 = true; return up; }
    /* 02-config.js */
    var VAN = { cap: 8, len: 4, z: 8.2, x: -2, w: 2.0 };
    /* 02-config.js */
    var TRUCK_OUT = BOOT_STAGE === 0 ? [{ mode: 'land', van: true, windows: [{ arrive: 10.5, leave: 12 }, { arrive: 16, leave: 17.5 }] }]
        : BOOT_STAGE === 1 ? [{ mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] }]
        : [
          { mode: 'sea',  windows: [{ arrive: 10.5, leave: 12 }, { arrive: 17, leave: 18.5 }] },
          { mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] },
          { mode: 'air',  windows: [{ arrive: 13, leave: 14.5 }, { arrive: 19, leave: 20.25 }] }
        ];
    /* 02-config.js */
    function modeDock(m) { for (var k = 0; k < TRUCK_OUT.length; k++) if (TRUCK_OUT[k].mode === m) return k; return TRUCK_OUT.length ? 0 : -1; }
    /* 02-config.js */
    function modeDoor(m) { var k = modeDock(m); return k < 0 ? -1 : doorIndex('out', k); }
    /* 02-config.js */
    function lanesOn() { return TRUCK_OUT.length > 1; }
    /* 02-config.js */
    function outWindows(dock) { return TRUCK_OUT[dock] ? TRUCK_OUT[dock].windows : []; }
    /* 02-config.js */
    function outNext(dock) { var ws = outWindows(dock); for (var k = 0; k < ws.length; k++) if (S.time < ws[k].leave - 0.3 && !S.flags['out' + S.day + '-' + dock + '-' + k]) return ws[k]; var w0 = ws[0] || { arrive: 0, leave: 0 }; return { arrive: w0.arrive, leave: w0.leave, tomorrow: true }; }
    /* 02-config.js */
    function outNextText(dock) { if (isSunday()) return 'closed Sunday'; var n = outNext(dock); return 'next at ' + fmtTime(n.arrive) + (n.tomorrow ? ' tomorrow' : ''); }
    /* 02-config.js */
    function dockOwned(dock) { return dock < TRUCK_OUT.length && (dock < 2 || !!(S.up && S.up.sorter)); }
    /* 02-config.js */
    var HALL = { x: STAGE.hall.x, z: STAGE.hall.z, h: STAGE.hall.h };
    /* 02-config.js */
    var RACK = { rows: STAGE.rows, bays: STAGE.bays, bayW: 3, x0: STAGE.x0, depth: 1.2, levels: [0, 1.55, 3.3], top: 2 };
    /* 02-config.js */
    var DOCKS = { in: STAGE.inZ.map(function (z) { return { z: z }; }), out: STAGE.outZ.map(function (z) { return { z: z }; }), ret: STAGE.retZ.map(function (z) { return { z: z }; }), w: 3.6, h: 4.2 };
    /* 02-config.js */
    var DOOR_MAP = [{ dir: 'in', dock: 0 }, { dir: 'in', dock: 1 }, { dir: 'out', dock: 0 }, { dir: 'out', dock: 1 }, { dir: 'out', dock: 2 }, { dir: 'in', dock: 2 }, { dir: 'ret', dock: 0 }];
    /* 02-config.js */
    function doorIndex(dir, dock) { for (var i = 0; i < DOOR_MAP.length; i++) if (DOOR_MAP[i].dir === dir && DOOR_MAP[i].dock === dock) return i; return -1; }
    /* 02-config.js */
    var YARD_Y = -1.2;
    /* 02-config.js */
    var TRAILER = { len: 12, w: 2.5, h: 2.7 };
    /* 02-config.js */
    var SPOT = {
        bench: { x: 26.6, z: 5.2 }, benchOut: { x: 26.6, z: 7.2 },
        stageIn: { x: -26, z: -10 }, stageOut: { x: 23, z: 0 },   // stageOut lands at x 29 after the wall shift: by OUT 2, between the land spiral and the bench (it sat under the sea spiral from 1.14 to 1.16)
        pc: { x: 27.5, z: 21.8 }, breaker: { x: 29.7, z: 19.6 },
        cot: { x: -27.2, z: 22.2 }, coffee: { x: -29.4, z: 19.3 },
        jack: { x: -27.8, z: -18.0 }, jack2: { x: 27.8, z: -18.0 }, cart: { x: -28.6, z: 9.2 }, fork: { x: 0, z: 21.2 },   // one jack by the IN docks, one by the OUT docks, the cart on the west wall
        spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }
      };
    /* 02-config.js */
    function stageRent() { return STAGE.rent; }
    /* 02-config.js */
    function benchCapNow() { return BOOT_STAGE === 0 ? ECON.tableCap : ECON.benchCap; }
    /* 02-config.js */
    var UNLOCK_WORDS = { cart: 'the picking cart in the shop', lights: 'the LED high bays in the shop', sign: 'the roadside sign in the shop', row3: 'a third rack row in the shop', fork: 'the forklift in the shop', jackPower: 'the powered pallet truck in the shop', row4: 'a fourth rack row in the shop', jackLift: 'the high-lift stacker in the shop', shipbelt: 'the shipping belt and dock loader in the shop', raw: 'raw granulate on the Production app', row5: 'a fifth rack row in the shop', agv: 'the AGV in the shop', plantTune: 'the plant tune-up in the shop', agvFast: 'AGV fast drive in the shop', gantry: 'the gantry pickers in the shop', deckNight: 'the deck night shift in the shop', agvSweep: 'the AGV floor sweep in the shop', plantAuto: 'the plant automation suite in the shop',
        beltsA: 'conveyor straights and curves in the catalogue', beltsB: 'conveyor inclines and the high run in the catalogue', seating: 'the comfort seating in the catalogue', deckTune: 'the deck dial to 300 percent', yardCat: 'the yard catalogue', deckTier2: 'the deck belts half as fast again', decor: 'the last of the furniture in the catalogue',
        picker: 'a picker to hire', receiver: 'a receiver to hire', packer: 'a packer to hire', driver: 'a forklift driver to hire', shifts: 'shift patterns for the crew', training: 'training courses for the crew', raise: 'raises for the crew', cross: 'second roles for the crew',
        clock: 'the time clock', pc: 'the office PC', build: 'build mode and the catalogue', contracts: 'contracts from the clients', power: 'power cuts, and the breaker in the office', rush: 'rush orders', loan: 'the bank loan', prowler: 'the night prowler: lock up', insurance: 'theft insurance', inspector: 'the safety inspector', returns: 'returns on the outbound trucks, and the returns desk', comfort: 'break room comfort',
        scanPutaway: 'the Putaway page on the scanner', scanStock: 'the Stock page on the scanner', scanCrew: 'the Crew page on the scanner', scanDocks: 'the Docks page on the scanner', scanMap: 'the Map page on the scanner', scanPlant: 'the Plant page on the scanner',
        contractsBig: 'bigger contracts', twoContracts: 'two contracts at once', longContract: 'the long contract' };
    /* 02-config.js */
    function levelOpens(level) {
        var out = [];
        if (level === 2) out.push('a second rack bay'); if (level === 3) out.push('a third rack bay'); if (level === 4) out.push('a fourth rack bay, the coffee flask');
        for (var k in UNLOCK) if (UNLOCK[k] === level && UNLOCK_WORDS[k]) out.push(UNLOCK_WORDS[k]);
        SKUS.forEach(function (s) { if (s.lvl === level && !s.raw && level > 1) out.push(s.name.toLowerCase() + (s.own ? ' off the moulding line' : ' from the clients')); });
        CLIENTS.forEach(function (c) { if (c.lvl === level && level > 1) out.push(c.name + (c.deck ? ', a deck account' : '') + ' finds you'); });
        if (staffCapAt(level) > staffCapAt(level - 1)) out.push('the crew grows to ' + staffCapAt(level));
        var st = stageForLevel(level); if (st > stageForLevel(level - 1)) out.unshift(STAGES[st].name.toLowerCase() + ': the builders come in the morning');
        return out;
      }
    /* 03-state.js */
    function freshState() {
        return {
          ver: 1, day: 1, time: DAY_START, bank: ECON.start, xp: 0, level: 1, rep: 10,
          hall: 5,                   // the hall layout generation; 1 was the 40 x 28 hall, 2 the first big-hall build whose migration ran too late
          site: 0, siteDue: 0,       // 1.21.0: the building stage this save is built at, and the one its level has earned (the builders come in at the day roll). Not "stage": that word is the deck's shipping bays below
          up: { rows: 1, cart: false, fork: false, lights: false, dock2: false, sign: false, shipbelt: false, agv: false, gantry: false, upper: false, sorter: false, hall2: false, hall3: false, hall4: false },
          gantries: {}, speed: {},
          agv: { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false },
          slots: {},                 // "row,bay,level" -> { sku, n, pal (a pallet under the boxes), wrapped }
          pallets: [],               // { id, sku, n, place: 'truck'|'floor'|'jack'|'fork'|'staff'|'lift'|'agv', truck, idx, x, z, y, rot, wrapped, recv }
          floor: [],                 // loose boxes and parcels on the floor: { kind: 'box'|'parcel', sku|order, x, y, z, rot }
          bench: { boxes: {}, parcels: [] },
          pack: { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null },           // the pack line
          lift: { pallet: null, pos: 0, state: 'down' },                                      // the goods lift to the mezzanine (1.14.0)
          factory: { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false },   // the moulding line and its hopper
          pal: { sku: null, n: 0 }, belts: {},
          baler: { card: 0, bales: 0, t: 0, made: 0 }, wrap: { film: 20, wrapped: 0 },                                                   // the palletiser's pallet, and what is on each belt
          cart: { boxes: [], parcels: [], x: SPOT.cart.x, z: SPOT.cart.z, rot: 0 },
          jack: { pallet: null, x: SPOT.jack.x, z: SPOT.jack.z, rot: Math.PI / 2 },
          jack2: { pallet: null, x: SPOT.jack2.x, z: SPOT.jack2.z, rot: -Math.PI / 2 },
          fork: { x: SPOT.fork.x, z: SPOT.fork.z, yaw: Math.PI, lift: 0.1, pallet: null, batt: 1 },
          weather: null, radio: { on: false, station: 0 },
          loan: 0, insured: false, contract: null, nextOffer: 3, binned: 0,
          layout: {}, custom: [],
          hand: null,                // { kind: 'box', sku } | { kind: 'parcel', order }
          orders: [], shipped: [],   // shipped keeps the last 40 for the ledger
          trucks: [], doors: [false, false, false, false, false, false, false],   // IN 1, IN 2, OUT 1, OUT 2, OUT 3, IN 3, RETURNS (see DOOR_MAP)
          sort: null,                // the sortation deck's cells, turntable and counts (1.14.0)
          stage: {},                 // parcels staged beside each dock loader, by loader id
          staff: [], nextStaffName: 0,
          intro: { step: 0, done: false, off: false },
          events: { power: false, powerUntil: 0, nextInspect: 4, inspected: false, prowled: false },
          seenSkus: ['paint', 'bolts', 'cereal', 'lamps'],
          stats: { received: 0, putaway: 0, picked: 0, packed: 0, shipped: 0, late: 0, earned: 0, spent: 0, fines: 0, days: 0, lost: 0, stolen: 0, made: 0, palletised: 0, returns: 0 },
          returns: [], rdesk: { queue: [], cur: null, t: 0, shelf: [], done: 0 },   // returns in play, and the returns desk (1.16.0)
          days: [], dayStart: null,  // the day reports (1.16.0)
          ledger: [], log: [], sleptAt: 0, lastOrderAt: 0, orderSeq: 1, truckSeq: 1, flags: {}
        };
      }
    // the state the props read: a sandboxed fresh Depot Co. save, never the host game's
    var S = freshState(); for (var uk in S.up) if (typeof S.up[uk] === 'boolean') S.up[uk] = true; S.up.rows = 6; S.site = 5; S.level = 30;
    /* 03-state.js */
    function addXp(n) {
        if (S.level >= LEVEL_CAP) { hudDirty = true; return; }   // the top of the ladder: the bar stays where it is (1.21.0)
        S.xp += n; hudDirty = true;
        while (S.level < LEVEL_CAP && S.xp >= XP_FOR(S.level)) { S.xp -= XP_FOR(S.level); S.level++; onLevelUp(); }
        if (S.level >= LEVEL_CAP) S.xp = Math.min(S.xp, XP_FOR(LEVEL_CAP));
      }
    /* 03-state.js */
    function addRep(n) { S.rep = clamp(S.rep + n * (S.up.sign && n > 0 ? 1.25 : 1), 0, 100); hudDirty = true; }
    /* 05-three.js */
    var hallLights = [];
    /* 05-three.js */
    var yardLights = [];
    /* 05-three.js */
    function posterTex(kind) {
        return tex(256, 384, function (c, w, h) {
          var title = function (t, col, y, size) { c.fillStyle = col; c.font = 'bold ' + (size || 30) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y); };
          var small = function (t, y, col) { c.fillStyle = col || '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y, w - 40); };
          if (kind === 'forklift') { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.beginPath(); c.moveTo(w / 2, 40); c.lineTo(w - 24, h * 0.55); c.lineTo(24, h * 0.55); c.closePath(); c.fill(); c.fillStyle = '#f5b53d'; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w - 48, h * 0.52); c.lineTo(48, h * 0.52); c.closePath(); c.fill(); c.fillStyle = '#111'; c.fillRect(w * 0.3, h * 0.33, 70, 36); c.fillRect(w * 0.3 + 70, h * 0.38, 40, 20); c.beginPath(); c.arc(w * 0.36, h * 0.47, 10, 0, 6.3); c.arc(w * 0.55, h * 0.47, 10, 0, 6.3); c.fill(); title('CAUTION', '#111', h * 0.68, 34); title('FORKLIFTS', '#111', h * 0.78, 28); small('Look both ways at the aisle ends', h * 0.9, '#111'); }
          else if (kind === 'lifting') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.25, 18, 0, 6.3); c.fill(); c.fillRect(w / 2 - 12, h * 0.3, 24, 60); c.fillRect(w / 2 - 36, h * 0.42, 72, 14); c.fillRect(w / 2 - 14, h * 0.45, 10, 50); c.fillRect(w / 2 + 4, h * 0.45, 10, 50); title('LIFT WITH', '#2c5f9e', h * 0.72, 28); title('YOUR LEGS', '#2c5f9e', h * 0.8, 28); small('Bend your knees, keep your back straight', h * 0.9); }
          else if (kind === 'exit') { c.fillStyle = '#2f9e44'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2f9e44'; title('FIRE EXIT', '#2f9e44', h * 0.2, 34); c.fillRect(w * 0.2, h * 0.3, w * 0.6, 8); c.beginPath(); c.moveTo(w * 0.3, h * 0.6); c.lineTo(w * 0.7, h * 0.6); c.lineTo(w * 0.7, h * 0.5); c.lineTo(w * 0.86, h * 0.65); c.lineTo(w * 0.7, h * 0.8); c.lineTo(w * 0.7, h * 0.7); c.lineTo(w * 0.3, h * 0.7); c.closePath(); c.fill(); small('Keep this route clear at all times', h * 0.9); }
          else if (kind === 'nosmoking') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8342a'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, h * 0.38, 80, 0, 6.3); c.stroke(); c.fillStyle = '#333'; c.fillRect(w / 2 - 50, h * 0.37, 100, 12); c.strokeStyle = '#c8342a'; c.beginPath(); c.moveTo(w / 2 - 56, h * 0.38 - 56); c.lineTo(w / 2 + 56, h * 0.38 + 56); c.stroke(); title('NO SMOKING', '#c8342a', h * 0.75, 30); small('Shelter is outside, by the car park', h * 0.86); }
          else if (kind === 'stacking') { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); title('PALLET RULES', '#1b232c', 46, 28); c.fillStyle = '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'left'; ['1. One line per slot', '2. Twelve boxes, no more', '3. Heavy at the bottom', '4. Labels facing the aisle', '5. Nothing on the floor', '6. Wrap before it moves'].forEach(function (t, i) { c.fillText(t, 28, 90 + i * 34); }); c.fillStyle = '#f5b53d'; c.fillRect(28, h - 56, w - 56, 24); c.fillStyle = '#111'; c.font = 'bold 14px Bahnschrift, Arial'; c.textAlign = 'center'; c.fillText('THE INSPECTOR CHECKS', w / 2, h - 39); }
          else if (kind === 'rota') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); title('SHIFT ROTA', '#1b232c', 40, 26); c.strokeStyle = '#999'; c.lineWidth = 1; for (var r = 0; r < 8; r++) { c.strokeRect(20, 60 + r * 36, w - 40, 36); } c.fillStyle = '#333'; c.font = '14px "Segoe UI", Arial'; c.textAlign = 'left'; ['Mon  Jo · Mika', 'Tue  Sam · Jo', 'Wed  Mika · Ravi', 'Thu  Jo · Lena', 'Fri  Sam · Mika', 'Sat  Ada · Theo', 'Sun  closed', 'Breaks 12:00 to 12:30'].forEach(function (t, i) { c.fillText(t, 30, 84 + i * 36); }); }
          else if (kind === 'hands') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); title('WASH YOUR', '#fff', h * 0.3, 30); title('HANDS', '#fff', h * 0.42, 30); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h * 0.65, 50, 0, 6.3); c.fill(); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.65, 36, 0, 6.3); c.fill(); small('Before you eat, after the yard', h * 0.9, '#fff'); }
          else { c.fillStyle = '#1b232c'; c.fillRect(0, 0, w, h); title('DEPOT CO.', '#f5b53d', h * 0.3, 34); title('SAFETY FIRST', '#fff', h * 0.42, 24); c.fillStyle = '#f5b53d'; c.fillRect(w * 0.2, h * 0.5, w * 0.6, 4); small('Days without an accident', h * 0.62, '#a0acb8'); title(String(randi(3, 180)), '#5fd38d', h * 0.78, 64); }
        });
      }
    /* 05-three.js */
    var POSTER_KINDS = ['forklift', 'lifting', 'exit', 'nosmoking', 'stacking', 'rota', 'hands', 'safety'];
    /* 05-three.js */
    var CARD = {};
    /* 05-three.js */
    function poster(kind, w, h, x, y, z, ry, parent) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: posterTex(kind), roughness: 0.95 })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m); return m; }
    /* 06-building.js */
    var doors = [];
    /* 06-building.js */
    var slotHits = {};
    /* 06-building.js */
    var bayLabelTex = {};
    /* 06-building.js */
    var world = { boardTex: null, boardCtx: null, boardMat: null, officeLamp: null, cot: null, coffeeMachine: null, pcScreen: null };
    /* 06-building.js */
    function slotKey(r, b, l) { return r + ',' + b + ',' + l; }
    /* 06-building.js */
    function slotParse(key) { var p = key.split(',').map(Number); return { r: p[0], b: p[1], l: p[2] }; }
    /* 06-building.js */
    function rackSlotPos(r, b, l) { var P = PROPS['rack' + r] ? propPlacement('rack' + r) : { x: 0, z: RACK.rows[r], rot: 0 }, a = P.rot * Math.PI / 2, lx = RACK.x0 + RACK.bayW * (b + 0.5); return { x: P.x + lx * Math.cos(a), y: RACK.levels[l] + (r === UPPER.row ? UPPER.y : 0), z: P.z - lx * Math.sin(a), ry: a }; }
    /* 06-building.js */
    function slotName(key) { var p = slotParse(key); return rowName(p.r) + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
    /* 06-building.js */
    function rowName(r) { return r === UPPER.row ? 'Upper row' : isAnnexRow(r) ? HALLS[hallOfRow(r)].name + ' row ' + rowLetter(r) : 'Row ' + 'ABCDEF'[r]; }
    /* 06-building.js */
    function buildDoor(i, side, z) {
        var x = side * HALL.x, ud = i < 6 && upperOwned() && z < UPPER.z1 + 0.3, dh = Math.min(DOCKS.h, HALL.h - 0.6);   // a main-hall door under the deck strip: its fittings keep under the deck plate at 4.6 m; dh: the shed's roof is lower than a dock door
        var panel = new THREE.Mesh(boxGeo(0.12, dh, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
        panel.position.set(x - side * 0.22, dh / 2, z); scene.add(panel);
        // the dock leveller: a plate from the hall edge out over the slot to the trailer bed, with a hinged lip and a hazard edge
        var lev = box(0.72, 0.05, 2.3, MAT.chequer, side * (HALL.x + 0.1), 0.0, z); lev.receiveShadow = true; box(0.2, 0.03, 2.3, MAT.hazard, side * (HALL.x + 0.5), 0.02, z).rotation.z = side * 0.12; box(0.06, 0.08, 2.3, MAT.steelDark, side * (HALL.x - 0.22), -0.02, z);
        var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0, h: dh };
        addInter(panel, { prompt: function () { return S.doors[i] ? null : DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock) ? 'OUT 3 · air freight dock · opens with the sortation deck · E opens the shop' : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i) + (dockLane(i) && lanesOn() ? ' (' + dockLane(i).name.toLowerCase() + ' lane)' : '') + (BOOT_STAGE === 0 ? '' : ' · the cabinet and the consoles close it')); }, use: function () { if (DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { if (!driving && !pc.on) openPanel('pc', 'shop'); return; } if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });   // E on the shut OUT 3 goes to the shop, where the deck that opens it is sold
        // a pull cord inside, to bring a door down without walking to the cabinet
        var cord = cyl(0.01, 1.2, MAT.red, x - side * 0.35, dh - 0.6, z - DOCKS.w / 2 - 0.3, null, 4); var knob = box(0.08, 0.12, 0.08, MAT.red, x - side * 0.35, dh - 1.25, z - DOCKS.w / 2 - 0.3);
        addInter(knob, { prompt: function () { return S.doors[i] ? 'Pull the cord: close dock door ' + dockLabel(i) : null; }, use: function () { if (S.doors[i]) setDoor(i, false); } });
        // bumpers, the number outside, the leveller plate, the sign inside
        box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z - DOCKS.w / 2 + 0.3); box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z + DOCKS.w / 2 - 0.3);
        var numY = Math.min(dh + 1.3, HALL.h - 0.7), numS = Math.min(1.2, HALL.h - dh - 0.2);
        sign([DOOR_MAP[i].dir === 'ret' ? 'R' : String(DOOR_MAP[i].dock + 1)], numS, numS, x + side * 0.17, numY, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 128, h: 128, bg: '#f5b53d', fg: '#1a1205' });
        plane(1.6, DOCKS.w - 0.4, MAT.hazard, x - side * 0.8, 0.008, z, -Math.PI / 2);
        var inY = ud ? dh + 0.17 : Math.min(dh + 0.6, HALL.h - 0.45);
        sign([dockLabel(i) + (dockLane(i) && lanesOn() ? ' · ' + dockLane(i).name.toUpperCase() : '')], ud ? 1.6 : 2.4, ud ? 0.3 : Math.min(0.7, HALL.h - dh - 0.1), x - side * 0.17, inY, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: DOOR_MAP[i].dir !== 'out' ? '#f5b53d' : (dockLane(i) ? dockLane(i).col : '#5fd38d') });
        doors[i] = d;
      }
    /* 06-building.js */
    function dockLabel(i) { var d = DOOR_MAP[i]; if (!d) return '?'; if (BOOT_STAGE === 0 && d.dir === 'out') return 'the van'; return d.dir === 'ret' ? 'RETURNS' : (d.dir === 'in' ? 'IN ' : 'OUT ') + (d.dock + 1); }
    /* 06-building.js */
    function dockLane(i) { var d = DOOR_MAP[i]; return d && d.dir === 'out' && TRUCK_OUT[d.dock] ? MODES[TRUCK_OUT[d.dock].mode] : null; }
    /* 06-building.js */
    function setDoor(i, open) { if (S.doors[i] === open) return; if (!doors[i]) return false; if (open && DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { toast('OUT 3 opens with the sortation deck.', 'bad'); return false; } S.doors[i] = open; sfx('roller'); logEvent('Dock door ' + dockLabel(i) + (open ? ' opened' : ' closed')); if (open && i < 2) introStep('door'); rebuildDyn(); return true; }
    /* 06-building.js */
    function doorPassable(i) { return !!doors[i] && doors[i].anim > 0.6; }
    /* 06-building.js */
    function buildRack(r) { if (PROPS['rack' + r]) buildProp('rack' + r); }
    /* 06-building.js */
    function rackBuild(r) {
        return function (c) {
          var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, nb = rowBays(r), RH = Math.min(5, HALL.h - 0.3);   // nb: the annex rows are shorter, the shed's row grows a bay a level; RH: the uprights stop under the shed roof
          for (var b = 0; b <= nb; b++) {
            var ux = x0 + b * bw;
            [-dz, dz].forEach(function (oz) { c.box(0.1, RH, 0.1, MAT.rack, ux, RH / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < RH - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
            for (var br = 0; br < Math.floor(RH - 0.3); br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
          }
          for (var l = 1; l < RACK.levels.length; l++) {
            var y = RACK.levels[l];
            c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, -dz); c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, dz);
            for (var bp = 0; bp <= nb; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
            for (var bb2 = 0; bb2 < nb; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, -0.3); c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, 0.3); }
          }
          for (var bb = 0; bb < nb; bb++) {
            var cx = x0 + (bb + 0.5) * bw, lbl = rowLetter(r) + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
            var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
            [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, RH - 0.25, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
            for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
              var key = slotKey(rr, b2, l2), hh2 = l2 === 2 ? 1.6 : 1.45;
              slotHits[key] = c.hit(bw - 0.2, hh2, RACK.depth, cx, RACK.levels[l2] + hh2 / 2, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } });
            })(r, bb, ll);
          }
          c.solid(x0 - 0.1, x0 + nb * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, RH);
          [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + nb * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, -RACK.depth / 2 - 0.1); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, RACK.depth / 2 + 0.1); c.sign(['MAX LOAD', '1000 kg / level', 'ROW ' + rowLetter(r)], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 }); });
        };
      }
    /* 06-building.js */
    function drawBoard(sc) {
        var c = world.boardCtx; if (!c) return; var w = 768, h = 384; sc = sc || world.boardScreen;
        c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f5b53d'; c.font = 'bold 30px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillText('OPEN ORDERS', 24, 44); c.font = '22px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8'; c.textAlign = 'right'; c.fillText('Day ' + S.day + '  ' + fmtTime(S.time), w - 24, 44);
        c.textAlign = 'left';
        var all = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }), per = 7, pages = Math.max(1, Math.ceil(all.length / per)), lanes = lanesOn();
        // the page: the one you wheeled to, for a while after the wheel turn; otherwise the board turns its own pages every six seconds
        var page = sc && sc.userScrollAt && worldTime - sc.userScrollAt < 12 ? clamp(sc.scroll || 0, 0, pages - 1) : (pages > 1 ? Math.floor(worldTime / 6) % pages : 0);
        if (sc) { sc.scrollMax = pages - 1; sc.scroll = page; }
        var open = all.slice(page * per, page * per + per);
        if (!all.length) { c.fillStyle = '#5fd38d'; c.font = '26px Bahnschrift, Arial, sans-serif'; c.fillText('Nothing waiting. Nice.', 24, 110); }
        open.forEach(function (o, i) {
          var y = 90 + i * 40, lane = MODES[orderMode(o)];   // the lane chip: which door the parcel leaves by (once there is more than one)
          if (lanes) { c.fillStyle = lane.col; c.beginPath(); if (c.roundRect) c.roundRect(24, y - 21, 62, 27, 6); else c.rect(24, y - 21, 62, 27); c.fill(); c.fillStyle = '#0d1b2a'; c.font = 'bold 17px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(lane.name.toUpperCase(), 55, y - 1); c.textAlign = 'left'; }
          c.fillStyle = o.state === 'packed' ? '#5fd38d' : (o.rush ? '#ff6b5e' : '#eef1f5'); c.font = 'bold 22px Bahnschrift, Arial, sans-serif';
          c.fillText('#' + o.num + '  ' + clientName(o.client), lanes ? 98 : 24, y);
          c.font = '20px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8';
          c.fillText(o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ').slice(0, 46), 330, y);
          c.textAlign = 'right'; c.fillStyle = o.state === 'packed' ? '#5fd38d' : '#f5b53d'; c.fillText(o.state === 'packed' ? 'PACKED' : 'due ' + fmtTime(o.due), w - 24, y); c.textAlign = 'left';
        });
        if (pages > 1) { c.fillStyle = '#6b7784'; c.font = '18px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('page ' + (page + 1) + ' of ' + pages + ' · ' + all.length + ' orders · the wheel turns the page', w - 24, h - 16); c.textAlign = 'left'; }
        world.boardTex.needsUpdate = true;
      }
    /* 06-building.js */
    function insideHall(x, z) { return (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z) || !!inAnnex(x, z); }
    /* 06-doors.js */
    function cabinetBuild(c) {
        var g = c.group;
        box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 2.12, -0.1, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 0.78, -0.1, g);
        box(0.04, 0.12, 0.03, MAT.black, 0.38, 1.0, 0.012, g); cyl(0.012, 0.6, MAT.black, 0.42, 0.45, -0.1, g, 6); cyl(0.012, 1.4, MAT.black, -0.42, 2.8, -0.1, g, 6);
        sign(['CONTROL'], 0.7, 0.14, 0, 2.02, 0.012, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' }, g);
        var lamps = [glowMat(0x39d353, 1.2), glowMat(0xf5b53d, 1.2), glowMat(0xff3b30, 1.2)];
        [-0.3, -0.1, 0.1].forEach(function (lx, i) { var l = cyl(0.025, 0.02, lamps[i], lx, 0.9, 0.012, g, 10); l.rotation.x = Math.PI / 2; });
        dress.cabLamps = g;
        touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: g, title: 'Control cabinet', draw: function (c, sc) {
          scBg(c, sc.w, sc.h); scHead(c, sc.w, 'DEPOT CONTROL', 'Day ' + S.day + ' · ' + fmtTime(S.time));
          var power = !S.events.power;
          scText(c, 16, 66, 'Mains ' + (power ? 'ON' : 'OFF: breaker tripped'), power ? '#5fd38d' : '#ff6b5e', 15);
          scText(c, 220, 66, 'Weather: ' + (S.weather ? S.weather.kind : 'clear'), '#a0acb8', 14);
          scButton(sc, 16, 80, 120, 40, 'Hall lights', !S.flags.lightsOff, function () { S.flags.lightsOff = !S.flags.lightsOff; }, '#5fd38d');
          scButton(sc, 148, 80, 120, 40, 'Yard lights', !S.flags.yardOff, function () { S.flags.yardOff = !S.flags.yardOff; }, '#5fd38d');
          scButton(sc, 280, 80, 124, 40, 'Night mode', !!S.flags.night, function () { S.flags.night = !S.flags.night; lockAll(S.flags.night); }, '#ff6b5e');
          scText(c, 16, 150, 'Dock doors', '#f5b53d', 14);
          doors.forEach(function (d, i) { scButton(sc, 10 + i * 58, 160, 54, 38, dockLabel(i).replace(' ', '').replace('RETURNS', 'RET') + (S.doors[i] ? ' ●' : ''), !!S.doors[i], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(i, !S.doors[i]); }); });
          scText(c, 16, 226, 'Doors', '#f5b53d', 14);
          hdoors.forEach(function (d, i) { var s = hd(d.id); scButton(sc, 16 + (i % 4) * 98, 236 + Math.floor(i / 4) * 44, 90, 36, d.label.replace(/^the | door$/g, '') + (s.locked ? ' 🔒' : s.open ? ' open' : ''), s.locked, function () { doorLock(d); }, '#ff6b5e'); });
        } });
        c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
      }
    /* 06-dressing.js */
    var dress = { fans: [], clocks: [], dockLamps: [], wrapper: null, turntable: null, wrapCarriage: null, kpiCtx: null, kpiTex: null, vending: null, radio: null, charger: null };
    /* 06-dressing.js */
    function kpiBoard() {
        var c = document.createElement('canvas'); c.width = 512; c.height = 320; dress.kpiCtx = c.getContext('2d');
        dress.kpiTex = new THREE.CanvasTexture(c); dress.kpiTex.encoding = THREE.sRGBEncoding;
        drawKpi();
        return new THREE.MeshBasicMaterial({ map: dress.kpiTex });
      }
    /* 06-dressing.js */
    function drawKpi() {
        var c = dress.kpiCtx; if (!c) return; var w = 512, h = 320;
        c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2c5f9e'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
        c.fillStyle = '#2c5f9e'; c.font = 'bold 30px "Segoe Print", "Comic Sans MS", cursive'; c.textAlign = 'left'; c.fillText('SO FAR', 24, 48);
        var tot = S.stats.shipped || 0, late = S.stats.late || 0, ontime = tot ? Math.round(100 * (tot - late) / tot) : 100;
        var rows = [['on time', ontime + '%'], ['shipped', String(tot)], ['received', (S.stats.received || 0) + ' pallets'], ['in stock', totalStock() + ' boxes'], ['rep', String(Math.round(S.rep))]];
        c.font = '26px "Segoe Print", "Comic Sans MS", cursive';
        rows.forEach(function (r, i) { c.fillStyle = i === 0 ? (ontime >= 90 ? '#2f9e44' : '#c8342a') : '#1b232c'; c.fillText(r[0], 30, 96 + i * 42); c.textAlign = 'right'; c.fillText(r[1], w - 30, 96 + i * 42); c.textAlign = 'left'; });
        c.strokeStyle = '#c8342a'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, 60); c.lineTo(w - 30, 60); c.stroke();
        c.fillStyle = '#c8342a'; c.font = '20px "Segoe Print", "Comic Sans MS", cursive'; c.fillText('close the dock doors at night!!', 30, h - 24);
        dress.kpiTex.needsUpdate = true;
      }
    /* 06-dressing.js */
    function dressDoor(d) {
        var X = HALL.x;
        [-1, 1].forEach(function (s) { var bx = d.side * (X - 1.0), bz = d.z + s * (DOCKS.w / 2 + 0.5); cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); });
          var x = d.side * (X - 0.3), nz = d.z - DOCKS.w / 2 - 0.5, z = nz < -HALL.z + 0.5 ? d.z + DOCKS.w / 2 + 0.5 : nz, ly = d.i < 6 && d.z < UPPER.z1 + 0.3 ? 4.25 : 4.6;   // OUT 3's beacon stood in the north wall and IN 1's in the deck plate until 1.18.0
          box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, ly, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, ly - 0.1, z);
          var dl = new THREE.PointLight(0xffb020, 0, 9, 2); dl.position.set(x - d.side * 0.9, ly - 0.3, z); scene.add(dl); dress.dockLamps.push({ m: lamp, l: dl, door: d.i });   // the beacon throws real amber on the apron while a truck is on its way
          box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
          var rx = d.side * (X - 0.15); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z - DOCKS.w / 2 - 0.05); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z + DOCKS.w / 2 + 0.05); cyl(0.1, 0.3, MAT.steelDark, rx - d.side * 0.15, DOCKS.h + 0.3, d.z + DOCKS.w / 2 + 0.35, null, 10).rotation.x = Math.PI / 2; cyl(0.006, DOCKS.h - 0.6, MAT.chrome, rx - d.side * 0.15, DOCKS.h / 2 + 0.2, d.z + DOCKS.w / 2 + 0.35, null, 4);
        if (dress.apron) dress.apron(d);   // the tyre scuffs inside the door: at boot the dressing paints every door after this runs, so only a door built later takes this path
      }
    /* 06-dressing.js */
    function paintBay(cx, cz, w, d, label) {
        var ms = [plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2), plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2), plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2), plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2)];
        ms.push(plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2));
        return ms;
      }
    /* 06-dressing.js */
    function repaintJack2Bay() { (dress.jack2Bay || []).forEach(function (m) { scene.remove(m); }); dress.jack2Bay = paintBay(SPOT.jack2.x, SPOT.jack2.z, 1.6, 2.2, 'JACK 2'); }
    /* 06-dressing.js */
    function buySnack() {
        if (S.events.power) { toast('No power.', 'bad'); return; }
        if (S.bank < 3) { toast('No change on you.', 'bad'); return; }
        pay(-3, 'Snack from the machine'); buff.snackDay = S.day; buff.snackUntil = S.time + 0.5; sfx('vend'); toast('Crisps. Faster for half an hour.', 'good');
        if (dress.vending) { var wp = new THREE.Vector3(); dress.vending.getWorldPosition(wp); burst(wp.x, 0.5, wp.z, 0xf5b53d, 8, 'down'); }
      }
    /* 06-props.js */
    function propStageOk(id) { var d = PROPS[id]; if (!d) return true; if (d.extra) return true; if (typeof d.stage === 'number' && BOOT_STAGE < d.stage) return false; if (BOOT_STAGE === 0 && !d.shed && !(d.at && d.at[0])) return false; if (typeof d.lvl === 'number' && S.level < d.lvl) return false; return true; }
    /* 06-props.js */
    function applyLevelUnlocks(level) { PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (!d.extra && d.lvl === level && propStageOk(id) && (!d.when || d.when()) && !propInst[id]) buildProp(id); }); if (BOOT_STAGE === 0 && level <= RACK.bays) { buildRack(0); NAV.dirty = true; } if (!edit.on) { unbakeStatic(); bakeStatic(); } }
    /* 06-props.js */
    var CHAIR_RED = std({ color: 0xc8342a, roughness: 0.6 });
    /* 06-props.js */
    function chairBuild(c) {
        var shell = new THREE.Mesh(bevelGeo(0.44, 0.05, 0.44, 0.02), CHAIR_RED); shell.position.set(0, 0.46, 0); shell.castShadow = true; c.group.add(shell);
        var back = new THREE.Mesh(bevelGeo(0.42, 0.4, 0.04, 0.02), CHAIR_RED); back.position.set(0, 0.72, -0.2); back.rotation.x = -0.12; c.group.add(back);
        [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
        c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, -0.18, 6).rotation.z = Math.PI / 2; c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, 0.18, 6).rotation.z = Math.PI / 2;
        c.cyl(0.012, 0.3, MAT.chrome, -0.18, 0.62, -0.2, 6); c.cyl(0.012, 0.3, MAT.chrome, 0.18, 0.62, -0.2, 6); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 0.5);
      }
    /* 06-props.js */
    function tableBuild(c) {
        var top = new THREE.Mesh(bevelGeo(1.0, 0.05, 1.0, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; c.group.add(top); c.box(1.02, 0.02, 1.02, MAT.black, 0, 0.72, 0);
        c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, -0.42); c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, 0.42); [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]].forEach(function (o) { c.box(0.05, 0.7, 0.05, MAT_MACH.frame, o[0], 0.35, o[1]); c.cyl(0.03, 0.01, MAT.black, o[0], 0.005, o[1], 8); });
        c.cyl(0.045, 0.1, MAT.white, 0.25, 0.83, -0.15, 12); c.cyl(0.035, 0.08, std({ color: 0x4a2c1a, roughness: 1 }), 0.25, 0.84, -0.15, 10); c.box(0.2, 0.012, 0.28, MAT.paper, -0.22, 0.785, 0.15); c.box(0.18, 0.004, 0.26, std({ color: 0xe8e2cc, roughness: 1 }), -0.2, 0.794, 0.17);
        c.cyl(0.04, 0.12, std({ color: 0xb8322a, roughness: 0.3, metalness: 0.4 }), 0.3, 0.84, 0.25, 10); c.box(0.12, 0.04, 0.08, std({ color: 0xf2b705, roughness: 0.6 }), -0.3, 0.8, -0.3); c.cyl(0.006, 0.14, MAT.black, 0.0, 0.78, 0.35, 6).rotation.z = Math.PI / 2;
        c.solid(-0.5, 0.5, -0.5, 0.5, 0, 0.8);
      }
    /* 06-props.js */
    function lockerBuild(c) {
        var LK = std({ color: 0x6f7b86, roughness: 0.5, metalness: 0.4 }), LD = std({ color: 0x5a6670, roughness: 0.5, metalness: 0.4 });
        c.box(1.24, 0.08, 0.5, MAT.black, 0, 0.04, 0); c.box(1.24, 1.82, 0.48, LK, 0, 0.99, -0.02); c.box(1.26, 0.04, 0.5, LK, 0, 1.92, -0.02);
        [-0.31, 0.31].forEach(function (lx, i) {
          c.box(0.56, 1.7, 0.03, LD, lx, 0.99, 0.23);
          for (var vv = 0; vv < 4; vv++) { c.box(0.34, 0.012, 0.015, MAT.black, lx, 1.68 - vv * 0.035, 0.245); c.box(0.34, 0.012, 0.015, MAT.black, lx, 0.42 - vv * 0.035, 0.245); }
          c.box(0.03, 0.1, 0.025, MAT.chrome, lx + 0.22, 1.0, 0.25); c.box(0.05, 0.03, 0.02, MAT.chrome, lx + 0.22, 1.1, 0.25); var hasp = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), MAT.chrome); hasp.position.set(lx + 0.22, 1.13, 0.26); c.add(hasp);
          c.box(0.2, 0.06, 0.012, MAT.white, lx, 1.8, 0.248); c.sign([String(i + 1)], 0.08, 0.05, lx, 1.8, 0.256, 0, { w: 64, h: 40, bg: '#ffffff', fg: '#1b232c' });
        });
        c.box(0.03, 1.7, 0.03, LK, 0, 0.99, 0.235);
        c.solid(-0.65, 0.65, -0.28, 0.28, 0, 2);
      }
    /* 06-props.js */
    function cotBuild(c) {
        var FR = MAT_MACH.frame; [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]].forEach(function (o) { c.box(0.05, 0.42, 0.05, FR, o[0], 0.21, o[1]); c.cyl(0.03, 0.012, MAT.black, o[0], 0.006, o[1], 8); });
        c.box(1.9, 0.05, 0.05, FR, 0, 0.42, -0.44); c.box(1.9, 0.05, 0.05, FR, 0, 0.42, 0.44); c.box(0.05, 0.05, 0.9, FR, -0.92, 0.42, 0); c.box(0.05, 0.05, 0.9, FR, 0.92, 0.42, 0); for (var sl = -0.8; sl <= 0.8; sl += 0.2) c.box(0.03, 0.02, 0.86, FR, sl, 0.43, 0);
        c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, -0.44); c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, 0.44); c.box(0.05, 0.05, 0.93, FR, -0.92, 0.9, 0); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, -0.44); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, 0.44); c.box(0.05, 0.05, 0.93, FR, 0.92, 0.7, 0);
        var mat = new THREE.Mesh(bevelGeo(1.84, 0.16, 0.84, 0.05), std({ color: 0x3c6ea6, roughness: 0.9 })); mat.position.set(0, 0.53, 0); mat.castShadow = true; c.group.add(mat); c.box(1.84, 0.01, 0.84, std({ color: 0x325c8a, roughness: 0.9 }), 0, 0.53, 0);
        var pil = new THREE.Mesh(bevelGeo(0.5, 0.12, 0.4, 0.05), MAT.white); pil.position.set(-0.6, 0.66, 0); pil.rotation.z = 0.06; c.group.add(pil);
        var bl = new THREE.Mesh(bevelGeo(0.7, 0.1, 0.8, 0.03), std({ color: 0x6b2b2b, roughness: 1 })); bl.position.set(0.5, 0.65, 0); c.group.add(bl); c.box(0.7, 0.012, 0.8, std({ color: 0x8a3b3b, roughness: 1 }), 0.5, 0.71, 0); c.box(0.02, 0.1, 0.8, std({ color: 0x5a2424, roughness: 1 }), 0.16, 0.65, 0);
        c.sign(['FIRST AID COT'], 0.6, 0.12, 0, 0.96, -0.47, 0, { w: 256, h: 56, bg: '#1b232c', fg: '#eef1f5' });
        c.hit(2.0, 1.0, 1.0, 0, 0.5, 0, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
        c.solid(-0.95, 0.95, -0.47, 0.47, 0, 0.9);
      }
    /* 06-props.js */
    function coffeeBuild(c) {
        var CAB = std({ color: 0xcfd5d2, roughness: 0.6 }), DOOR = std({ color: 0xbfc6c3, roughness: 0.55 }); c.box(1.36, 0.1, 0.52, MAT.black, 0, 0.05, -0.03); c.box(1.4, 0.8, 0.6, CAB, 0, 0.5, 0); [-0.47, 0, 0.47].forEach(function (dx) { var d = new THREE.Mesh(bevelGeo(0.42, 0.66, 0.02, 0.01), DOOR); d.position.set(dx, 0.5, 0.31); c.group.add(d); c.box(0.02, 0.12, 0.03, MAT.chrome, dx + 0.15, 0.7, 0.33); }); var top = new THREE.Mesh(bevelGeo(1.46, 0.04, 0.66, 0.012), std({ color: 0x3a3e45, roughness: 0.35 })); top.position.set(0, 0.92, 0); c.group.add(top); c.box(1.46, 0.08, 0.03, CAB, 0, 0.98, -0.31);
        c.box(0.34, 0.03, 0.3, MAT.chrome, 0.42, 0.935, -0.02); c.box(0.3, 0.12, 0.26, MAT.steel, 0.42, 0.88, -0.02); var tap = c.cyl(0.012, 0.22, MAT.chrome, 0.42, 1.02, -0.18, 8); var tap2 = c.cyl(0.01, 0.16, MAT.chrome, 0.42, 1.12, -0.11, 8); tap2.rotation.x = Math.PI / 2; c.box(0.05, 0.015, 0.03, MAT.chrome, 0.48, 1.0, -0.18); c.box(0.1, 0.06, 0.02, MAT.plastic, 0.42, 1.02, -0.3); c.cyl(0.03, 0.12, std({ color: 0x4caf50, roughness: 0.5 }), 0.62, 1.0, -0.2, 10);
        c.solid(-0.7, 0.7, -0.3, 0.3, 0, 1);
        var CM = new THREE.MeshPhysicalMaterial({ color: 0x1c1e22, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 });
        var cm = new THREE.Mesh(bevelGeo(0.42, 0.42, 0.36, 0.03), CM); cm.position.set(-0.35, 1.15, -0.06); cm.castShadow = true; c.group.add(cm); c.box(0.44, 0.03, 0.38, MAT.chrome, -0.35, 1.37, -0.06); c.cyl(0.09, 0.16, MAT.glass, -0.35, 1.47, -0.12, 14); c.cyl(0.07, 0.12, std({ color: 0x4a2c1a, roughness: 1 }), -0.35, 1.45, -0.12, 12);
        c.box(0.3, 0.025, 0.16, MAT.chrome, -0.35, 0.955, 0.16); for (var dr = 0; dr < 6; dr++) c.box(0.26, 0.005, 0.01, MAT.black, -0.35, 0.97, 0.1 + dr * 0.024); c.cyl(0.03, 0.06, MAT.chrome, -0.35, 1.0, 0.1, 12); c.cyl(0.02, 0.12, MAT.chrome, -0.35, 0.97, 0.16, 8).rotation.x = Math.PI / 2; c.cyl(0.012, 0.07, MAT.black, -0.35, 0.97, 0.23, 8).rotation.x = Math.PI / 2;
        c.cyl(0.035, 0.09, MAT.white, -0.35, 0.995, 0.16, 12); c.cyl(0.015, 0.2, MAT.chrome, -0.14, 1.0, 0.1, 8).rotation.x = 0.6; c.plane(0.14, 0.08, MAT.screen, -0.35, 1.26, 0.125, 0, 0); c.box(0.03, 0.03, 0.01, MAT.green, -0.42, 1.18, 0.125); c.box(0.03, 0.03, 0.01, MAT.red, -0.28, 1.18, 0.125); c.box(0.06, 0.012, 0.012, MAT.chrome, -0.35, 1.08, 0.125);
        c.cyl(0.035, 0.08, MAT.white, -0.55, 1.41, -0.1, 10); c.cyl(0.035, 0.08, MAT.white, -0.47, 1.41, -0.14, 10); c.cyl(0.035, 0.08, MAT.white, -0.22, 1.41, -0.14, 10);
        c.hit(0.5, 0.6, 0.5, -0.35, 1.19, -0.05, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working until ' + fmtTime(buff.coffeeUntil) : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
        c.cyl(0.08, 0.2, MAT.chrome, 0.1, 1.04, -0.1, 12); c.cyl(0.02, 0.1, MAT.chrome, 0.17, 1.07, -0.04, 6).rotation.z = -0.8; c.cyl(0.045, 0.1, MAT.white, 0.25, 0.99, 0.12, 10); c.cyl(0.045, 0.1, MAT.red, 0.35, 0.99, 0.02, 10);
        c.box(0.5, 0.3, 0.38, MAT.black, 0.42, 1.09, -0.08); c.plane(0.3, 0.16, MAT.glass, 0.42, 1.11, 0.115, 0, 0); c.box(0.06, 0.1, 0.02, MAT.black, 0.62, 1.09, 0.12);
        var rg = new THREE.Group(); rg.position.set(-0.05, 1.02, 0.1); c.add(rg); dress.radio = rg; rg.userData.worldOf = c.group;
        box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3;
        c.hit(0.4, 0.2, 0.2, -0.05, 1.02, 0.1, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } });
      }
    /* 06-props.js */
    function vendingBuild(c) {
        var BODY = new THREE.MeshPhysicalMaterial({ color: 0x1f4e8c, roughness: 0.35, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
        var body = new THREE.Mesh(bevelGeo(0.96, 1.9, 0.8, 0.03), BODY); body.position.set(0, 0.97, 0); body.castShadow = true; c.group.add(body); c.box(0.98, 0.08, 0.82, MAT.black, 0, 0.04, 0); [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (f) { c.cyl(0.03, 0.03, MAT.black, f[0], 0.015, f[1], 8); });
        c.box(0.66, 1.2, 0.3, MAT.black, -0.1, 1.17, 0.26); c.plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, 0.405, 0, 0);
        if (!vendingBuild.mats) vendingBuild.mats = [0xd14a3a, 0x5fd38d, 0xf0b94d, 0x3fa7d6, 0xf2f2f2].map(function (col) { return std({ color: col, roughness: 0.5 }); });   // five materials shared by the sixteen packets, not sixteen: a material of its own is a draw of its own
        for (var vr = 0; vr < 4; vr++) { c.box(0.6, 0.012, 0.28, MAT.chrome, -0.1, 0.7 + vr * 0.25, 0.27); for (var vc = 0; vc < 4; vc++) { var pm = vendingBuild.mats[(vr + vc) % 5]; c.box(0.09, 0.14, 0.08, pm, -0.33 + vc * 0.15, 0.78 + vr * 0.25, 0.3); c.cyl(0.015, 0.26, MAT.chrome, -0.26 + vc * 0.15, 0.72 + vr * 0.25, 0.3, 6).rotation.x = Math.PI / 2; } }
        var gf = c.box(0.64, 1.16, 0.01, MAT.glass, -0.1, 1.15, 0.415); gf.userData.noBake = true; c.box(0.6, 0.02, 0.3, glowMat(0xdfe9ff, 0.5), -0.1, 1.73, 0.26);
        c.box(0.22, 0.5, 0.02, MAT.black, 0.33, 1.3, 0.405); c.plane(0.16, 0.08, MAT.screen, 0.33, 1.48, 0.416, 0, 0); c.box(0.04, 0.06, 0.012, MAT.chrome, 0.33, 1.36, 0.414); c.box(0.03, 0.01, 0.012, MAT.black, 0.33, 1.36, 0.42);
        for (var kp = 0; kp < 12; kp++) c.box(0.035, 0.035, 0.01, MAT.white, 0.26 + (kp % 3) * 0.05, 1.26 - Math.floor(kp / 3) * 0.045, 0.416);
        c.box(0.56, 0.22, 0.04, MAT.black, -0.1, 0.33, 0.405); c.box(0.5, 0.16, 0.02, std({ color: 0x3a3e45, roughness: 0.4, metalness: 0.4 }), -0.1, 0.33, 0.425); c.box(0.44, 0.03, 0.02, MAT.chrome, -0.1, 0.44, 0.432);
        c.sign(['SNACKS'], 0.7, 0.2, -0.1, 1.82, 0.405, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['COLD DRINKS · CRISPS · BARS'], 0.76, 0.1, 0, 1.96, 0.405, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.plane(0.7, 1.4, std({ color: 0x163b6b, roughness: 0.5 }), 0.485, 1.0, 0, 0, Math.PI / 2);
        c.solid(-0.5, 0.5, -0.4, 0.4, 0, 2);
        dress.vending = c.hit(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : buff.snackDay === S.day && buff.snackUntil > S.time ? 'The snack is still working until ' + fmtTime(buff.snackUntil) : S.bank < 3 ? 'Buy a snack ($3): no change on you' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } });   // says what the coffee machine says: still working, or short of change, before you press
      }
    /* 06-props.js */
    function fridgeBuild(c) {
        var FW = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f0, roughness: 0.3, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }); var body = new THREE.Mesh(bevelGeo(0.7, 1.72, 0.68, 0.03), FW); body.position.set(0, 0.96, -0.02); body.castShadow = true; c.group.add(body);
        var dl = new THREE.Mesh(bevelGeo(0.66, 0.52, 0.03, 0.012), FW); dl.position.set(0, 1.56, 0.335); c.group.add(dl); var dl2 = new THREE.Mesh(bevelGeo(0.66, 1.1, 0.03, 0.012), FW); dl2.position.set(0, 0.72, 0.335); c.group.add(dl2); c.box(0.66, 0.01, 0.02, MAT.black, 0, 1.29, 0.345);
        c.box(0.025, 0.4, 0.03, MAT.chrome, -0.28, 1.56, 0.37); c.box(0.025, 0.8, 0.03, MAT.chrome, -0.28, 0.75, 0.37); c.box(0.7, 0.1, 0.02, MAT.black, 0, 0.05, 0.34); for (var gv = 0; gv < 6; gv++) c.box(0.08, 0.06, 0.01, MAT.plastic, -0.25 + gv * 0.1, 0.05, 0.345);
        c.box(0.12, 0.14, 0.004, MAT.paper, 0.15, 1.0, 0.355); c.cyl(0.015, 0.008, MAT.red, 0.15, 1.085, 0.357, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.004, std({ color: 0x3b7dd8, roughness: 0.6 }), -0.1, 0.9, 0.355); c.box(0.3, 0.05, 0.004, std({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.5 }), 0, 1.75, 0.355);
        c.solid(-0.37, 0.37, -0.37, 0.37, 0, 2);
      }
    /* 06-props.js */
    function coolerBuild(c) {
        var CW = std({ color: 0xe9ecef, roughness: 0.45 }); var cab = new THREE.Mesh(bevelGeo(0.38, 0.98, 0.38, 0.02), CW); cab.position.set(0, 0.49, 0); cab.castShadow = true; c.group.add(cab); c.box(0.4, 0.06, 0.4, std({ color: 0x5b6672, roughness: 0.6 }), 0, 1.01, 0); c.box(0.3, 0.02, 0.02, MAT.black, 0, 0.78, 0.19); c.box(0.26, 0.03, 0.12, MAT.plastic, 0, 0.72, 0.14); for (var dr = 0; dr < 5; dr++) c.box(0.24, 0.004, 0.012, MAT.black, 0, 0.74, 0.09 + dr * 0.022);
        c.box(0.03, 0.04, 0.03, MAT.blue, -0.06, 0.84, 0.2); c.box(0.03, 0.04, 0.03, MAT.red, 0.06, 0.84, 0.2); c.cyl(0.006, 0.03, MAT.black, -0.06, 0.835, 0.22, 6); c.cyl(0.006, 0.03, MAT.black, 0.06, 0.835, 0.22, 6);
        var WB = std({ color: 0xbfe3f2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }), WT = std({ color: 0x7fc4e8, roughness: 0.1, transparent: true, opacity: 0.6 }); c.cyl(0.13, 0.44, WB, 0, 1.28, 0, 16); c.cyl(0.124, 0.26, WT, 0, 1.19, 0, 16); c.cyl(0.08, 0.06, WB, 0, 1.53, 0, 14, 0.13); c.cyl(0.05, 0.04, MAT.blue, 0, 1.58, 0, 12); c.sphere(0.02, std({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.6 }), 0.04, 1.26, 0.03);
        c.box(0.08, 0.24, 0.08, CW, 0.23, 0.9, 0); c.cyl(0.03, 0.08, MAT.white, 0.23, 1.06, 0, 10); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.6);
      }
    /* 06-props.js */
    function hooksBuild(c) { c.box(1.9, 0.04, 0.12, MAT.wood, 0, 1.82, 0); for (var hk = 0; hk < 4; hk++) { var hx = -0.68 + hk * 0.45; c.cyl(0.015, 0.1, MAT.chrome, hx, 1.75, 0.05, 6).rotation.x = Math.PI / 2; if (hk !== 2) { c.box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, 0.06); c.box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, 0.06); } } }
    /* 06-props.js */
    function noticeBuild(c) { c.box(1.6, 1.0, 0.04, MAT.wood, 0, 1.9, 0); c.plane(1.5, 0.9, MAT.cork, 0, 1.9, 0.025, 0, 0); var tt = ['TRUCKS', 'IN ' + TRUCK_IN.map(fmtTime).join(' · ')]; TRUCK_OUT.forEach(function (dk) { tt.push((dk.van ? 'VAN' : lanesOn() ? MODES[dk.mode].name.toUpperCase() : 'OUT') + ' ' + dk.windows.map(function (w) { return fmtTime(w.arrive); }).join(' · ')); }); if (returnsHall()) tt.push('RET ' + TRUCK_RET.map(fmtTime).join(' · ')); c.sign(tt, 0.9, 0.5, -0.25, 2.05, 0.03, 0, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: tt.length > 5 ? 34 : 40 }); /* the returns truck joins the timetable once its hall is open (buildHall rebuilds the board) */ [[0.45, 1.75, -0.1], [-0.1, 1.6, 0.15], [0.55, 1.65, 0.05]].forEach(function (n) { var nb = c.box(0.22, 0.28, 0.004, MAT.paper, n[0], n[1], 0.03); nb.rotation.z = n[2]; c.cyl(0.01, 0.01, MAT.red, n[0], n[1] + 0.12, 0.035, 8).rotation.x = Math.PI / 2; }); }
    /* 06-props.js */
    function calendarBuild(c) { c.box(0.4, 0.5, 0.02, MAT.paper, 0, 1.7, 0); c.sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, 0, 1.7, 0.012, 0, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 28 }); }
    /* 06-props.js */
    function clockBuild(r) { return function (c) { var g = new THREE.Group(); g.position.set(0, 2.7, 0.02); c.add(g); var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim); for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; } var dg = new THREE.Group(); dg.userData.dynamic = true; g.add(dg); var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; dg.add(hh); dg.add(mh); box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh); cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2; dress.clocks.push({ h: hh, m: mh, group: c.group }); }; }
    /* 06-props.js */
    function posterBuild(kind, w, h) { return function (c) { c.box(w + 0.05, h + 0.05, 0.012, MAT.white, 0, 2.0, 0.002).castShadow = false; c.poster(kind, w - 0.04, h - 0.04, 0, 2.0, 0.01, 0); var gl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, h + 0.05), MAT.screenGlass); gl.position.set(0, 2.0, 0.016); gl.renderOrder = 2; c.add(gl); var fw = w + 0.08, fh = h + 0.08; c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 + fh / 2, 0.004); c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 - fh / 2, 0.004); c.box(0.03, fh, 0.03, MAT.black, -fw / 2, 2.0, 0.004); c.box(0.03, fh, 0.03, MAT.black, fw / 2, 2.0, 0.004); }; }
    /* 06-props.js */
    function extinguisherBuild(c) { c.cyl(0.08, 0.5, MAT.red, 0, 1.0, 0.12, 12); c.cyl(0.05, 0.08, MAT.black, 0, 1.28, 0.12, 10); c.box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.14); c.cyl(0.012, 0.42, MAT.black, 0.08, 1.0, 0.15, 6).rotation.z = 0.15; c.cyl(0.02, 0.07, MAT.black, 0.11, 0.79, 0.17, 8, 0.03); c.cyl(0.025, 0.02, MAT.white, 0.0, 1.3, 0.21, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.002, MAT.paper, 0, 1.0, 0.202); c.box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, 0.05); c.sign(['FIRE'], 0.3, 0.12, 0, 1.6, 0.04, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }); }
    /* 06-props.js */
    function firstAidBuild(c) { c.box(0.3, 0.3, 0.1, MAT.white, 0, 1.7, 0.05); c.box(0.18, 0.05, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.05, 0.18, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.12, 0.02, 0.02, MAT.chrome, 0, 1.87, 0.05); }
    /* 06-props.js */
    function binPrompt() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) return 'Write off the whole pallet (' + bp.n + ' × ' + skuName(bp.sku) + ', ' + money(Math.round(SKU[bp.sku].val * 0.5 * bp.n)) + ')'; if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return S.hand.ret ? 'Bin the damaged return (no charge)' : 'Bin the damaged box'; if (S.hand && S.hand.kind === 'box') return 'That box is fine: it belongs on a rack'; return 'The bin · ' + (S.binned || 0) + ' damaged boxes written off'; }
    /* 06-props.js */
    function binUse() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) { var n = bp.n, bsku = bp.sku, bcost = Math.round(SKU[bsku].val * 0.5 * n); bp.n = 0; bp.wrapped = false; S.binned = (S.binned || 0) + n; addWaste(2 * n); pay(-bcost, 'Written off: ' + n + ' × ' + skuName(bsku)); addRep(-0.5 * Math.min(n, 4)); sfx('crate'); toast('Pallet written off: ' + n + ' boxes, ' + money(bcost) + '. The pallet is empty again.', 'bad'); logEvent(n + ' boxes of ' + skuName(bsku) + ' went in the bin off a pallet (' + money(bcost) + ')', 'bad'); hudDirty = true; return; }
        if (!(S.hand && S.hand.kind === 'box' && S.hand.damaged)) { sfx('click'); return; } var sku = S.hand.sku, ret = !!S.hand.ret; handSet(null); S.binned = (S.binned || 0) + 1; addWaste(2);
        if (ret) { sfx('crate'); toast('Binned. A damaged return: nothing to pay.', ''); logEvent('A damaged return of ' + skuName(sku) + ' went in the bin'); return; }
        var cost = Math.round(SKU[sku].val * 0.5); pay(-cost, 'Written off: a damaged box of ' + skuName(sku)); addRep(-0.5); sfx('crate'); toast('Binned. The client charges ' + money(cost) + ' for it.', 'bad'); logEvent('A damaged box of ' + skuName(sku) + ' went in the bin (' + money(cost) + ')', 'bad'); }
    /* 06-props.js */
    function binBuild(c) { c.box(0.46, 0.85, 0.5, MAT.red, 0, 0.47, 0); c.box(0.52, 0.05, 0.56, std({ color: 0x8e2420, roughness: 0.7 }), 0, 0.92, 0); c.box(0.08, 0.03, 0.5, MAT.black, 0.22, 0.95, 0); c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, -0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, 0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.015, 0.5, MAT.steelDark, -0.2, 0.09, 0, 6).rotation.x = Math.PI / 2; c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1); c.hit(0.7, 0.9, 0.7, 0, 0.45, 0, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } }); c.sign(['DAMAGED', 'GOODS'], 0.5, 0.3, 0, 1.1, 0.0, 0, { w: 256, h: 128, bg: '#c8342a', fg: '#fff' }); }
    /* 06-props.js */
    function broomBuild(c) { var broom = c.cyl(0.014, 1.3, MAT.wood, 0.02, 0.72, 0, 6); broom.rotation.z = 0.22; c.box(0.3, 0.06, 0.06, MAT.plastic, 0.18, 0.1, 0); c.box(0.3, 0.06, 0.05, std({ color: 0x8a7a55, roughness: 1 }), 0.18, 0.04, 0); c.cyl(0.02, 0.04, MAT.red, -0.13, 1.36, 0, 8); }
    /* 06-props.js */
    function wetFloorBuild(c) { var face = new THREE.MeshBasicMaterial({ map: textTex(['CAUTION', 'WET FLOOR'], { w: 192, h: 256, bg: '#f5b53d', fg: '#111', size: 34 }) }); [-1, 1].forEach(function (s) { var pg = new THREE.Group(); pg.position.set(0, 0.72, 0); pg.rotation.x = s * 0.32; c.add(pg); box(0.34, 0.72, 0.012, MAT.yellow, 0, -0.36, s * 0.006, pg); var f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), face); f.position.set(0, -0.38, s * 0.014); f.rotation.y = s > 0 ? 0 : Math.PI; pg.add(f); box(0.02, 0.72, 0.02, MAT.black, -0.17, -0.36, s * 0.01, pg); box(0.02, 0.72, 0.02, MAT.black, 0.17, -0.36, s * 0.01, pg); box(0.34, 0.03, 0.02, MAT.black, 0, -0.72, s * 0.012, pg); }); c.cyl(0.012, 0.36, MAT.black, 0, 0.72, 0, 8).rotation.z = Math.PI / 2; c.box(0.1, 0.03, 0.02, MAT.black, 0, 0.75, 0); }
    /* 06-props.js */
    function palletModel(c, x, y, z, ry) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; c.add(g); [-0.5, 0, 0.5].forEach(function (bz) { box(1.2, 0.08, 0.1, MAT.wood, 0, 0.065, bz, g); box(1.2, 0.022, 0.1, MAT.wood, 0, 0.011, bz, g); }); for (var i = 0; i < 7; i++) box(i === 0 || i === 6 ? 0.14 : 0.1, 0.022, 1.0, MAT.wood, -0.53 + i * 0.1766, 0.116, 0, g); return g; }
    /* 06-props.js */
    function emptiesBuild(c) {
        for (var i = 0; i < 9; i++) palletModel(c, randf(-0.015, 0.015), i * 0.128, randf(-0.015, 0.015), randf(-0.02, 0.02));
        var mk = std({ color: 0xf0b400, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }); c.plane(1.5, 0.05, mk, 0, 0.004, 0.7, -Math.PI / 2, 0); c.plane(1.5, 0.05, mk, 0, 0.004, -0.7, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, 0.75, 0.004, 0, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, -0.75, 0.004, 0, -Math.PI / 2, 0);
        c.cyl(0.02, 1.5, MAT.steel, 1.05, 0.75, 0.75, 8); c.cyl(0.14, 0.04, MAT.steel, 1.05, 0.02, 0.75, 14); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, 0, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' }); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, Math.PI, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' });
        c.hit(1.4, 1.6, 1.3, 0, 0.8, 0, { prompt: function () { var jp = isJack(player.tool) ? jackPallet() : null; if (jp && jp.n === 0) return 'Stack the empty pallet here (' + (S.emptiesN || 0) + ' stacked)'; if (isJack(player.tool) && !jp) return (S.emptiesN || 0) > 0 ? 'Take an empty pallet onto the jack (' + S.emptiesN + ' stacked)' : 'No empty pallets left on the stack'; return 'Empty pallets · ' + (S.emptiesN || 0) + ' stacked · bring empties here on the jack, or take one for loose boxes'; },
          use: function () { if (!isJack(player.tool)) { sfx('click'); return; } var tl = jackTool(), jp = jackPallet(); if (jp && jp.n === 0) { removePallet(jp.id); S[tl].pallet = null; S.emptiesN = (S.emptiesN || 0) + 1; sfx('putdown'); addXp(1); toast('Empty pallet stacked', ''); hudDirty = true; return; } if (!jp && (S.emptiesN || 0) > 0) { var np = newPallet(null, 0, { place: 'jack', jack: tl }); S[tl].pallet = np.id; S.emptiesN--; sfx('jack'); toast('Empty pallet on the jack: put loose boxes on it by hand', ''); hudDirty = true; return; } sfx('bad'); } });
        c.solid(-0.62, 0.62, -0.52, 0.52, 0, 1.2); c.solid(0.9, 1.2, 0.6, 0.9, 0, 1.7);
      }
    /* 06-props.js */
    function balerBuild(c) {
        var GRN = std({ color: 0x2f7a3a, roughness: 0.55, metalness: 0.3 }), DRK = MAT_MACH.frame, dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        // the body: a vertical baler with a chamber door, a window, the ram head above, the power pack at the side
        c.box(1.3, 0.1, 1.0, DRK, 0, 0.05, 0); c.box(1.2, 2.6, 0.9, GRN, 0, 1.4, 0); c.box(1.3, 0.08, 1.0, DRK, 0, 2.74, 0);
        [-0.62, 0.62].forEach(function (x) { c.box(0.06, 2.7, 0.06, DRK, x, 1.4, 0.45); c.box(0.06, 2.7, 0.06, DRK, x, 1.4, -0.45); });
        c.box(1.2, 0.06, 0.06, DRK, 0, 1.6, 0.47); c.box(1.2, 0.06, 0.06, DRK, 0, 0.75, 0.47);
        var door = c.box(1.04, 0.78, 0.06, GRN, 0, 2.06, 0.47); var win = c.box(0.5, 0.3, 0.02, MAT.glass, 0, 2.12, 0.51); win.userData.noBake = true; c.box(0.1, 0.34, 0.05, MAT.chrome, 0.44, 2.06, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.8, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 2.3, 0.5);
        c.box(1.04, 0.78, 0.06, GRN, 0, 1.16, 0.47); c.box(0.5, 0.05, 0.07, MAT.chrome, 0.2, 1.4, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 0.92, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.4, 0.5); c.box(0.4, 0.04, 0.03, MAT.black, 0, 1.05, 0.51);
        c.box(1.1, 0.1, 0.05, MAT.hazard, 0, 1.6, 0.5); c.sign(['CRUSH HAZARD · KEEP HANDS CLEAR'], 0.9, 0.09, 0, 0.68, 0.5, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
        c.cyl(0.18, 0.9, MAT.chrome, 0, 3.2, 0, 16); c.cyl(0.26, 0.3, DRK, 0, 2.9, 0, 16); var ram = cyl(0.12, 0.6, MAT.chrome, 0, 3.6, 0, dyn, 12); c.box(0.5, 0.06, 0.5, DRK, 0, 3.68, 0);
        c.box(0.5, 0.9, 0.5, DRK, -0.95, 0.5, -0.1); var pm = c.cyl(0.18, 0.5, MAT_MACH.blue, -0.95, 1.2, -0.1, 14); c.cyl(0.14, 0.4, DRK, -0.95, 1.5, -0.1, 12); [[-0.95, 2.6, 0.1, 0.5], [-0.8, 2.0, 0.3, -0.3]].forEach(function (h) { var hs = c.cyl(0.025, 1.4, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
        c.cyl(0.05, 0.03, MAT.white, -0.72, 0.8, 0.16, 10).rotation.x = Math.PI / 2;
        // the control cabinet on the right: screen, lamp stack, E-stop
        cabinet(c, 0.88, 1.45, 0.05, 0.4, 0.9, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.88, y: 1.62, z: 0.17, ry: 0, parent: c.group, title: 'Baler', draw: balerScreenDraw }); scr.mesh.userData.propId = 'baler';
        eStop(c, 0.88, 1.2, 0.17); MACH.baler.lamps = lampStack(c, 0.88, 1.95, 0.05);
        c.sign(['BALER', 'cardboard only'], 0.8, 0.3, 0, 2.5, 0.5, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 });
        // the finished bales stack beside it: strapped cardboard blocks, shown by count
        var bales = []; for (var k = 0; k < 3; k++) { var bg = new THREE.Group(); bg.position.set(1.75, 0.4 + (k === 2 ? 0.82 : 0), k === 1 ? 0.95 : 0.05); bg.visible = false; dyn.add(bg); box(1.0, 0.8, 0.8, MAT.parcel, 0, 0, 0, bg); for (var s = 0; s < 3; s++) { box(1.02, 0.02, 0.03, MAT.steelDark, 0, 0.405, -0.3 + s * 0.3, bg); box(1.02, 0.02, 0.03, MAT.steelDark, 0, -0.405, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, 0.505, 0, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, -0.505, 0, -0.3 + s * 0.3, bg); } bales.push(bg); }
        MACH.baler.anim = { ram: ram, bales: bales };
        c.hit(1.4, 2.8, 1.0, 0, 1.4, 0, { prompt: function () { return balerPrompt(); }, use: function () { balerUse(); } });
        c.solid(-1.25, 1.1, -0.5, 0.55, 0, 2.8); c.solid(1.2, 2.3, -0.4, 1.4, 0, 1.0);
      }
    /* 06-props.js */
    function wrapperBuild(c, P, inst) {
        var wg = c.group; dress.wrapper = wg; var wdyn = new THREE.Group(); wdyn.userData.dynamic = true; wg.add(wdyn);   // the turntable and the carriage move; the column, the ramp, the cabinet and the sign join the bake (the whole group was dynamic until this pass)
        var tt = c.cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, 32); wdyn.add(tt); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
        var rp = c.box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35); rp.rotation.x = 0.11; c.box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15); c.box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15); c.box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95); c.box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95);
        var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wdyn.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
        cabinet(c, 0.75, 1.45, -1.15, 0.4, 0.9, 0.22); var wscr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.75, y: 1.62, z: -1.03, ry: 0, parent: c.group, title: 'Stretch wrapper', draw: wrapperScreenDraw }); wscr.mesh.userData.propId = 'wrapper'; eStop(c, 0.75, 1.2, -1.03); MACH.wrapper.lamps = lampStack(c, 0.75, 1.95, -1.15); c.cyl(0.02, 0.5, MAT.black, 0.55, 1.1, -1.15, 6);
        c.sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }); c.solid(-1, 1, -1.4, 1.0, 0, 3);
        c.hit(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } });
      }
    /* 06-props.js */
    function hoseBuild(c) { var reel = c.cyl(0.32, 0.12, MAT.red, 0, 1.5, 0.08, 24); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, 0.0, 8).rotation.x = Math.PI / 2; for (var hr = 0; hr < 5; hr++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.12 + hr * 0.035, 0.012, 6, 24), MAT.red); ring.position.set(0, 1.5, 0.16); c.add(ring); } c.cyl(0.015, 0.25, MAT.red, 0.3, 1.25, 0.08, 6).rotation.z = 0.4; c.cyl(0.03, 0.08, MAT.chrome, 0.38, 1.12, 0.08, 8, 0.018); c.sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, 0.01, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' }); }
    /* 06-props.js */
    var leafTex = tex(64, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2f6a2a'); g.addColorStop(1, '#8ad474'); c.fillStyle = g; c.beginPath(); c.moveTo(32, 128); c.quadraticCurveTo(0, 70, 32, 4); c.quadraticCurveTo(64, 70, 32, 128); c.fill(); c.strokeStyle = 'rgba(220,255,200,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 124); c.lineTo(32, 10); c.stroke(); });
    /* 06-props.js */
    var leafMat = std({ map: leafTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    /* 06-props.js */
    function plantBuild(c) {
        var pot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.11, 0), new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.17, 0.28), new THREE.Vector2(0.19, 0.3), new THREE.Vector2(0.17, 0.32), new THREE.Vector2(0.15, 0.3)], 16), std({ color: 0xa65e3a, roughness: 0.9 })); pot.castShadow = true; c.group.add(pot);
        c.cyl(0.15, 0.02, std({ color: 0x3a2a1c, roughness: 1 }), 0, 0.29, 0, 14);
        for (var i = 0; i < 11; i++) { var a = i / 11 * 6.283, lg = new THREE.Group(); lg.position.set(0, 0.3, 0); lg.rotation.y = a; c.group.add(lg); var st = cyl(0.006, 0.35 + (i % 3) * 0.12, MAT.green, 0, 0.17 + (i % 3) * 0.06, 0.03, lg, 5); st.rotation.x = 0.5 + (i % 2) * 0.2; var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.34), leafMat); lf.position.set(0, 0.42 + (i % 3) * 0.12, 0.2 + (i % 2) * 0.08); lf.rotation.x = -0.9 + (i % 3) * 0.2; lg.add(lf); }
        c.solid(-0.18, 0.18, -0.18, 0.18, 0, 0.5);
      }
    /* 06-props.js */
    function deskBuild(c) {
        var top = new THREE.Mesh(bevelGeo(2.2, 0.05, 0.8, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; top.receiveShadow = true; c.group.add(top);
        c.box(2.1, 0.5, 0.03, std({ color: 0x9aa4ad, roughness: 0.6 }), 0, 0.45, 0.36); [[-1.0, 0.0], [1.0, 0.0]].forEach(function (o) { c.box(0.05, 0.72, 0.7, MAT_MACH.frame, o[0] * 1.05, 0.36, 0); }); c.cyl(0.03, 0.02, MAT.black, 0.6, 0.76, -0.3, 10);
        var ped = new THREE.Mesh(bevelGeo(0.45, 0.66, 0.6, 0.02), std({ color: 0xcfd4d9, roughness: 0.5 })); ped.position.set(-0.75, 0.37, 0); c.group.add(ped); for (var dw = 0; dw < 3; dw++) { c.box(0.4, 0.19, 0.012, std({ color: 0xbfc6cc, roughness: 0.5 }), -0.75, 0.15 + dw * 0.21, -0.31); c.box(0.12, 0.02, 0.025, MAT.chrome, -0.75, 0.22 + dw * 0.21, 0.32); }
        c.cyl(0.14, 0.02, MAT_MACH.frame, 0, 0.785, 0.2, 14); c.cyl(0.025, 0.3, MAT_MACH.frame, 0, 0.93, 0.22, 8); var bez = new THREE.Mesh(bevelGeo(0.82, 0.52, 0.03, 0.01), MAT.black); bez.position.set(0, 1.25, 0.25); c.group.add(bez);
        pc.screen = touchScreen({ w: 800, h: 500, pw: 0.74, ph: 0.46, x: 0, y: 1.25, z: 0.225, ry: Math.PI, parent: c.group, title: 'Office PC', draw: drawPc });
        if (!deskBuild.keyMat) deskBuild.keyMat = std({ color: 0x4a515b, roughness: 0.6 });   // one material for the 48 keys, not 48: they bake into one draw
        c.box(0.62, 0.012, 0.42, std({ color: 0x1f2a36, roughness: 1 }), -0.1, 0.785, -0.15); for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 12; kc++) c.box(0.032, 0.012, 0.03, deskBuild.keyMat, -0.34 + kc * 0.044, 0.82, -0.26 + kr * 0.05);
        var mouse = new THREE.Mesh(bevelGeo(0.06, 0.03, 0.1, 0.012), MAT.black); mouse.position.set(0.5, 0.8, -0.18); c.group.add(mouse); c.box(0.2, 0.06, 0.16, MAT.black, -0.75, 0.81, 0.26); c.cyl(0.012, 0.18, MAT.black, -0.75, 0.9, 0.26, 6).rotation.z = Math.PI / 2;
        c.cyl(0.03, 0.09, MAT.black, 0.9, 0.82, -0.05, 8); c.cyl(0.004, 0.14, MAT.blue, 0.9, 0.9, -0.05, 4).rotation.z = 0.2; c.cyl(0.04, 0.09, MAT.white, 0.7, 0.82, -0.1, 10); c.box(0.2, 0.01, 0.28, MAT.paper, -0.75, 0.785, -0.1); c.box(0.18, 0.012, 0.26, MAT.paper, -0.72, 0.795, -0.08).rotation.y = 0.1;
        c.cyl(0.02, 0.4, MAT_MACH.frame, 0.95, 0.98, 0.25, 8).rotation.z = -0.3; c.cyl(0.07, 0.1, MAT_MACH.frame, 0.84, 1.17, 0.25, 12, 0.03); c.cyl(0.05, 0.02, glowMat(0xfff2c0, 0.6), 0.84, 1.12, 0.25, 12);
        var dl = new THREE.PointLight(0xfff2c0, 0.3, 3.5, 2); dl.position.set(0.84, 1.05, 0.25); c.add(dl);   // the desk lamp's pool on the desk
        c.sign(['DEPOT CO. · OFFICE'], 0.5, 0.06, -0.75, 0.56, -0.32, Math.PI, { w: 512, h: 64, bg: '#eef1f5', fg: '#1b232c' });
        c.hit(1.2, 0.9, 0.5, 0, 0.5, -0.1, { prompt: function () { return pc.on ? null : (S.events.power ? 'The PC is off: no power' : 'Sit down at the PC'); }, use: function () { openPc(); } });
        c.solid(-1.1, 1.1, -0.4, 0.4, 0, 0.8);
      }
    /* 06-props.js */
    function officeChairBuild(c) {
        var seat = new THREE.Mesh(bevelGeo(0.5, 0.08, 0.5, 0.04), MAT.fabric); seat.position.set(0, 0.52, 0); seat.castShadow = true; c.group.add(seat);
        var back = new THREE.Mesh(bevelGeo(0.48, 0.52, 0.06, 0.03), MAT.fabric); back.position.set(0, 0.84, -0.26); back.rotation.x = -0.1; c.group.add(back); c.box(0.4, 0.4, 0.01, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.86, -0.22).rotation.x = -0.1; c.box(0.3, 0.14, 0.04, MAT.fabric, 0, 1.18, -0.3);
        c.cyl(0.03, 0.3, MAT.chrome, 0, 0.33, 0, 10); c.cyl(0.045, 0.2, MAT.black, 0, 0.18, 0, 10); c.box(0.3, 0.03, 0.3, MAT.black, 0, 0.47, 0); c.box(0.06, 0.03, 0.08, MAT.black, 0.18, 0.44, 0.1);
        for (var sp = 0; sp < 5; sp++) { var a = sp / 5 * 6.283, leg = c.box(0.05, 0.035, 0.3, MAT.black, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15); leg.rotation.y = a; var cs = c.cyl(0.03, 0.025, MAT.black, Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, 8); cs.rotation.x = Math.PI / 2; cs.rotation.z = a; }
        [-0.28, 0.28].forEach(function (x) { c.box(0.04, 0.18, 0.04, MAT.black, x, 0.6, -0.05); c.box(0.06, 0.03, 0.3, MAT.black, x, 0.7, 0); });
        c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.6);
      }
    /* 06-props.js */
    function cabinetsBuild(c) {
        var CAB = std({ color: 0xcfd4d9, roughness: 0.5 }), DRW = std({ color: 0xbfc6cc, roughness: 0.5 });
        [-0.3, 0.3].forEach(function (cx2) { var body = new THREE.Mesh(bevelGeo(0.5, 1.3, 0.6, 0.02), CAB); body.position.set(cx2, 0.65, 0); body.castShadow = true; c.group.add(body); c.box(0.5, 0.06, 0.6, MAT.black, cx2, 0.03, 0); for (var cd = 0; cd < 3; cd++) { var d = new THREE.Mesh(bevelGeo(0.44, 0.36, 0.02, 0.01), DRW); d.position.set(cx2, 0.28 + cd * 0.4, 0.31); c.group.add(d); c.box(0.14, 0.025, 0.03, MAT.chrome, cx2, 0.4 + cd * 0.4, 0.33); c.box(0.16, 0.05, 0.004, MAT.paper, cx2, 0.2 + cd * 0.4, 0.323); c.box(0.17, 0.06, 0.002, MAT.chrome, cx2, 0.2 + cd * 0.4, 0.322); } c.box(0.02, 0.1, 0.02, MAT.chrome, cx2 + 0.2, 1.22, 0.31); });
        c.box(0.5, 0.25, 0.4, CAB, 0.3, 1.42, 0); c.box(0.4, 0.03, 0.3, MAT.white, 0.3, 1.56, 0.05); c.box(0.3, 0.02, 0.2, MAT.paper, 0.3, 1.58, 0.05); c.cyl(0.08, 0.1, std({ color: 0x4a7d33, roughness: 0.9 }), -0.3, 1.36, 0, 10, 0.06); c.sphere(0.12, std({ color: 0x5c8f44, roughness: 1, flatShading: true }), -0.3, 1.5, 0);
        c.solid(-0.6, 0.6, -0.35, 0.35, 0, 1.6);
      }
    /* 06-props.js */
    function coatStandBuild(c) {
        c.cyl(0.028, 1.75, MAT.steelDark, 0, 0.875, 0, 10); c.cyl(0.22, 0.03, MAT.steelDark, 0, 0.015, 0, 16); c.sphere(0.03, MAT.chrome, 0, 1.76, 0);
        for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2, hk = new THREE.Group(); hk.position.set(0, 1.62, 0); hk.rotation.y = a; c.add(hk); var arm = cyl(0.01, 0.2, MAT.chrome, 0, 0.04, 0.1, hk, 6); arm.rotation.x = Math.PI / 2 - 0.4; sphere(0.018, MAT.chrome, 0, 0.1, 0.18, hk); var low = cyl(0.01, 0.18, MAT.chrome, 0, -0.5, 0.09, hk, 6); low.rotation.x = Math.PI / 2 - 0.5; sphere(0.016, MAT.chrome, 0, -0.45, 0.16, hk); }
        var coat = c.box(0.38, 0.7, 0.12, MAT.jeans, 0.18, 1.3, 0.02); coat.rotation.y = 0.5; c.box(0.2, 0.08, 0.1, MAT.jeans, 0.3, 1.66, 0.12); var scarf = c.box(0.06, 0.5, 0.06, MAT.red, -0.1, 1.4, -0.16); scarf.rotation.y = -0.4;
        c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.8);
      }
    /* 06-props.js */
    function kpiBuild(c) { var kb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), kpiBoard()); kb.position.set(0, 2.0, 0.03); c.add(kb); c.box(1.68, 1.08, 0.04, MAT.chrome, 0, 2.0, 0.0); }
    /* 06-props.js */
    function certificateBuild(c) { c.box(0.3, 0.4, 0.02, MAT.wood, 0, 2.4, 0); c.sign(['CERTIFICATE', 'of registration', 'Depot Co. · 3PL'], 0.26, 0.36, 0, 2.4, 0.012, 0, { w: 192, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 22 }); }
    /* 06-props.js */
    function shedTableBuild(c, P) {
        SPOT.bench = { x: P.x, z: P.z }; SPOT.benchOut = { x: P.x, z: P.z };
        var TAN = std({ color: 0xc9a46a, roughness: 0.8 }), TOP = std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood });
        c.box(1.7, 0.05, 0.8, TOP, 0, 0.9, 0); c.box(1.6, 0.04, 0.05, MAT.steelDark, 0, 0.86, -0.36); c.box(1.6, 0.04, 0.05, MAT.steelDark, 0, 0.86, 0.36);
        [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]].forEach(function (o) { var leg = c.box(0.05, 0.86, 0.05, MAT.steelDark, o[0], 0.43, o[1]); leg.rotation.x = o[1] < 0 ? 0.12 : -0.12; });
        c.box(1.5, 0.04, 0.04, MAT.steelDark, 0, 0.3, 0); c.solid(-0.85, 0.85, -0.42, 0.42, 0, 0.95);
        var tgn = new THREE.Group(); tgn.position.set(0.55, 0.92, 0.2); tgn.rotation.y = 0.6; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, MAT.steelDark, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2;
        c.cyl(0.055, 0.048, TAN, 0.7, 0.944, -0.25, 16); c.box(0.26, 0.02, 0.26, MAT.steelDark, -0.62, 0.935, -0.2); c.box(0.22, 0.012, 0.22, std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), -0.62, 0.95, -0.2);
        c.box(0.14, 0.02, 0.03, MAT.yellow, -0.3, 0.935, -0.3).rotation.y = 0.3; c.cyl(0.008, 0.14, MAT.black, -0.15, 0.93, -0.28, 8).rotation.z = Math.PI / 2;
        c.box(0.6, 0.09, 0.6, std({ color: 0xb08a5a, roughness: 1 }), 0, 0.36, 0).rotation.y = 0.05;   /* flat cardboard on the stretcher */
        c.hit(1.9, 1.1, 1.0, 0, 0.6, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
        // the clipboard: the office until there is one. E opens Depot OS, with what the level allows on it
        var cb = new THREE.Group(); cb.position.set(-0.1, 0.925, 0.22); cb.rotation.y = -0.25; c.add(cb); box(0.24, 0.012, 0.32, MAT.black, 0, 0, 0, cb); box(0.21, 0.006, 0.28, MAT.paper, 0, 0.01, 0.01, cb); box(0.09, 0.025, 0.03, MAT.steelDark, 0, 0.02, -0.14, cb); cyl(0.004, 0.14, MAT.blue, 0.06, 0.02, 0.02, cb, 6).rotation.x = Math.PI / 2;
        hitBox(0.36, 0.2, 0.42, 0, 0.05, 0, { prompt: function () { return 'The paperwork · orders, the shop, the crew' + (unlocked('loan') ? ', the bank' : '') + ' · E opens Depot OS'; }, use: function () { if (!driving && !pc.on) { openPanel('pc', 'orders'); introStep('pc'); } } }, cb);
        c.sign(['PACKING'], 0.6, 0.16, 0, 1.25, -0.44, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); c.cyl(0.012, 0.3, MAT.steelDark, 0, 1.08, -0.44, 6);
      }
    /* 06-props.js */
    function flaskBuild(c) { c.cyl(0.07, 0.3, std({ color: 0xc8342a, roughness: 0.35, metalness: 0.3 }), 0, 1.07, 0, 14); c.cyl(0.045, 0.05, MAT.black, 0, 1.245, 0, 12); c.cyl(0.03, 0.06, MAT.chrome, 0.09, 1.15, 0, 8).rotation.z = 0.5; c.cyl(0.035, 0.08, MAT.white, 0.16, 0.96, 0.05, 10); c.hit(0.3, 0.4, 0.3, 0.04, 1.1, 0, { prompt: function () { return buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working until ' + fmtTime(buff.coffeeUntil) : 'Pour a coffee from the flask (walk faster for an hour)'; }, use: function () { drinkCoffee(); } }); }
    /* 06-props.js */
    function benchBuild(c, P) {
        if (BOOT_STAGE === 0) { shedTableBuild(c, P); return; }
        SPOT.bench = { x: P.x, z: P.z }; SPOT.benchOut = { x: P.x + Math.sin(P.rot * Math.PI / 2) * 2.0, z: P.z + Math.cos(P.rot * Math.PI / 2) * 2.0 };
        c.box(1.0, 0.08, 3.2, MAT.wood, 0, 0.9, 0); [[-0.45, -1.5], [0.45, -1.5], [-0.45, 1.5], [0.45, 1.5]].forEach(function (o) { c.box(0.06, 0.9, 0.06, MAT.steelDark, o[0], 0.45, o[1]); }); c.box(0.9, 0.04, 3.0, MAT.steelDark, 0, 0.3, 0); c.solid(-0.5, 0.5, -1.6, 1.6, 0, 1);
        // the kit lives at the two ends: the box stacks take local z -0.95 to 1.3, and anything under them was never seen
        var TAN = std({ color: 0xc9a46a, roughness: 0.8 }), CARD = std({ color: 0xb08a5a, roughness: 1 }), TRAY = std({ color: 0x3a4149, roughness: 0.6 });
        // near end: a platform scale with its readout turned to the worker
        c.box(0.3, 0.03, 0.3, MAT.steelDark, 0.28, 0.955, -1.2); c.box(0.26, 0.012, 0.26, std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), 0.28, 0.976, -1.2); c.box(0.04, 0.24, 0.04, MAT.steelDark, 0.42, 1.09, -1.2);
        var sgp = new THREE.Group(); sgp.position.set(0.4, 1.23, -1.2); sgp.rotation.order = 'YXZ'; sgp.rotation.y = -Math.PI / 2; sgp.rotation.x = -0.25; c.add(sgp); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, sgp); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, sgp);
        // a tape gun standing on its head, two spare rolls beside it
        var tgn = new THREE.Group(); tgn.position.set(-0.2, 0.94, -1.12); tgn.rotation.y = 0.6; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, MAT.steelDark, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2; box(0.05, 0.02, 0.05, MAT.steelDark, 0.03, 0.01, 0.11, tgn); cyl(0.012, 0.05, MAT.rubber, 0.03, 0.012, 0.085, tgn, 8).rotation.z = Math.PI / 2;
        c.cyl(0.055, 0.048, TAN, 0.06, 0.964, -1.48, 16); c.cyl(0.055, 0.048, TAN, 0.08, 1.012, -1.47, 16).rotation.y = 0.4; c.cyl(0.03, 0.05, MAT.white, 0.06, 1.012, -1.48, 12);
        // a parts tray: box cutter, marker, a roll of labels
        c.box(0.26, 0.03, 0.18, TRAY, -0.3, 0.955, -1.45); c.box(0.23, 0.014, 0.15, MAT.black, -0.3, 0.972, -1.45); c.box(0.14, 0.02, 0.03, MAT.yellow, -0.33, 0.99, -1.48).rotation.y = 0.3; c.cyl(0.008, 0.14, MAT.black, -0.27, 0.988, -1.41, 8).rotation.z = Math.PI / 2; c.cyl(0.03, 0.04, MAT.white, -0.22, 1.0, -1.49, 12);
        // the label printer at the near corner, a strip of labels hanging out toward the worker
        c.box(0.2, 0.12, 0.16, MAT.white, 0.28, 1.0, -1.5); c.box(0.21, 0.02, 0.17, std({ color: 0x8b949c, roughness: 0.5 }), 0.28, 0.95, -1.5); c.box(0.004, 0.09, 0.07, MAT.paper, 0.17, 0.985, -1.5); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.2, 1.05, -1.42);
        // far end: the task lamp and a roll of bubble wrap on a rod between two brackets
        c.cyl(0.02, 0.9, MAT.steelDark, -0.4, 1.4, 1.4, 8); c.box(0.3, 0.08, 0.15, MAT.lamp, -0.3, 1.85, 1.4);
        [-0.3, 0.3].forEach(function (bx) { c.box(0.03, 0.3, 0.03, MAT.steelDark, bx, 1.09, 1.5); c.box(0.08, 0.02, 0.08, MAT.steelDark, bx, 0.95, 1.5); }); c.cyl(0.012, 0.66, MAT.chrome, 0, 1.25, 1.5, 8).rotation.z = Math.PI / 2;
        c.cyl(0.11, 0.5, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.85 }), 0, 1.25, 1.5, 18).rotation.z = Math.PI / 2; c.plane(0.48, 0.26, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.7, side: THREE.DoubleSide }), 0, 1.07, 1.615, 0, 0);
        // the shelf below: flat cardboard and a bale of folded boxes
        c.box(0.7, 0.12, 0.8, CARD, 0, 0.38, -0.6); c.box(0.66, 0.02, 0.76, TAN, 0, 0.45, -0.6); c.box(0.6, 0.09, 0.7, CARD, 0.02, 0.365, 0.7).rotation.y = 0.05; c.box(0.02, 0.1, 0.72, MAT.black, -0.2, 0.37, 0.7); c.box(0.02, 0.1, 0.72, MAT.black, 0.2, 0.37, 0.7);
        var tl = new THREE.PointLight(0xfff0d0, 0.45, 5, 2); tl.position.set(-0.3, 1.7, 1.4); c.add(tl);   // the task lamp lights the far end of the bench
        c.hit(1.1, 1.2, 3.2, 0, 1.4, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
        // the terminal: a floor stand on the east corner past the near end, screen at 1.7 m turned to face the working side across the
        // end of the bench, so it clears the box stacks and never stands in the walkway. It used to hang over the bench top at 1.45 m,
        // where two layers of boxes hid it and the bench's own hit box took the focus.
        var tg = new THREE.Group(); tg.position.set(0.35, 0, -2.0); tg.rotation.y = -Math.PI * 3 / 8; c.add(tg);
        cyl(0.28, 0.03, MAT.steelDark, 0, 0.015, -0.04, tg, 20); cyl(0.24, 0.02, MAT.rubber, 0, 0.04, -0.04, tg, 20); cyl(0.035, 1.72, MAT.steelDark, 0, 0.89, -0.08, tg, 10); box(0.14, 0.2, 0.07, MAT.steelDark, 0, 1.75, -0.06, tg);
        box(1.0, 0.76, 0.03, MAT.black, 0, 1.75, -0.02, tg); box(0.5, 0.02, 0.14, MAT.steelDark, 0, 1.3, 0.02, tg); box(0.06, 0.04, 0.12, MAT.black, 0.14, 1.33, 0.02, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.46, 1.44, 0.0, tg);
        var scr = touchScreen({ w: 400, h: 300, res: 3, pw: 0.9, ph: 0.675, x: 0, y: 1.75, z: 0, ry: 0, parent: tg, title: 'Bench terminal', draw: benchScreenDraw }); scr.mesh.userData.propId = 'bench'; scr.scrollable = true; scr.scroll = 0;
        c.solid(0.1, 0.6, -2.25, -1.75, 0, 2.3);
        // the stool
        c.cyl(0.17, 0.04, MAT.black, -1.0, 0.65, -0.4, 16); c.cyl(0.02, 0.6, MAT.chrome, -1.0, 0.32, -0.4, 8); c.cyl(0.2, 0.03, MAT.steelDark, -1.0, 0.03, -0.4, 16);
      }
    /* 06-props.js */
    function benchScreenDraw(c, sc) {
        var allO = openOrders().sort(function (a, b2) { return (b2.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b2.due; }); sc.scrollMax = Math.max(0, allO.length - 4); sc.scroll = clamp(sc.scroll || 0, 0, sc.scrollMax);
        scBg(c, sc.w, sc.h); scHead(c, sc.w, 'PACKING', benchCount() + ' / ' + benchCapNow() + ' on the bench · ' + allO.length + ' open');
        var os = allO.slice(sc.scroll, sc.scroll + 4), y = 56;
        if (!os.length) scText(c, 16, 76, 'No open orders.', '#a0acb8', 14);
        os.forEach(function (o) { var n = orderNeed(o); scText(c, 16, y + 12, '#' + o.num + ' ' + clientName(o.client).slice(0, 16) + (o.rush ? ' RUSH' : '') + (o.late ? ' LATE' : ''), o.late || o.rush ? '#ff6b5e' : '#eef1f5', 13); scText(c, 16, y + 28, o.lines.map(function (l) { return Math.min(l.qty, S.bench.boxes[l.sku] || 0) + '/' + l.qty + ' ' + skuName(l.sku).slice(0, 12); }).join(' · ').slice(0, 44), '#a0acb8', 11); var can = canPack(o), short = canPackShort(o); scButton(sc, 300, y + 4, 86, 32, can ? 'PACK' : short ? 'SHORT' : n.have + '/' + n.tot, can || short, function () { if (packOrder(o)) toast('Packed #' + o.num, 'good'); }, can ? '#5fd38d' : '#f5b53d'); y += 46; });
        if (sc.scrollMax > 0) { scText(c, 16, 290, 'Orders ' + (sc.scroll + 1) + ' to ' + Math.min(allO.length, sc.scroll + 4) + ' of ' + allO.length + ' · wheel scrolls', '#6b7784', 10); scButton(sc, 300, 262, 40, 26, 'UP', sc.scroll > 0, function () { sc.scroll = Math.max(0, sc.scroll - 1); }, '#f5b53d'); scButton(sc, 346, 262, 40, 26, 'DOWN', sc.scroll < sc.scrollMax, function () { sc.scroll = Math.min(sc.scrollMax, sc.scroll + 1); }, '#f5b53d'); }
        else scText(c, 16, 290, 'Look at a box on the bench to take it back · the cart takes surplus', '#6b7784', 10);
        var surN = surplusCount(); scButton(sc, 116, 258, 118, 26, surN ? 'RETURN ' + surN + ' SURPLUS' : 'NO SURPLUS', surN > 0, function () { returnSurplus(); }, '#f5b53d');
        if (S.up.plantAuto) { var autoOn = !S.pack || S.pack.auto !== false; scButton(sc, 16, 258, 92, 26, 'AUTO ' + (autoOn ? 'ON' : 'OFF'), true, function () { if (!S.pack) return; S.pack.auto = autoOn ? false : true; toast('Pack line auto-start ' + (autoOn ? 'off' : 'on'), autoOn ? 'bad' : 'good'); }, autoOn ? '#5fd38d' : '#ff6b5e'); }
      }
    /* 06-props.js */
    function shelterBuild(c) {
        var FR = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        [[-1.7, -2.2], [-1.7, 2.2], [1.7, -2.2], [1.7, 2.2]].forEach(function (p) { c.box(0.08, 2.5, 0.08, FR, p[0], 1.25, p[1]); c.box(0.2, 0.02, 0.2, FR, p[0], 0.01, p[1]); });
        c.box(3.6, 0.06, 4.6, FR, 0, 2.5, 0); c.box(3.8, 0.04, 4.8, std({ color: 0x2a2f35, roughness: 0.7 }), 0, 2.56, 0); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, 2.4); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, -2.4); c.box(0.06, 0.1, 4.8, FR, -1.9, 2.5, 0); c.box(0.06, 0.1, 4.8, FR, 1.9, 2.5, 0);
        c.plane(4.4, 2.3, GL, -1.7, 1.3, 0, 0, Math.PI / 2); c.plane(1.6, 2.3, GL, -0.9, 1.3, -2.2, 0, 0); c.plane(1.6, 2.3, GL, 0.9, 1.3, -2.2, 0, 0); c.box(0.08, 2.5, 0.08, FR, -1.7, 1.25, 0); c.box(0.06, 0.06, 4.4, FR, -1.7, 0.95, 0); c.box(3.4, 0.06, 0.06, FR, 0, 0.95, -2.2);
        for (var sl = 0; sl < 5; sl++) c.box(2.4, 0.04, 0.08, MAT.wood, 0, 0.46, -1.9 + sl * 0.095); for (var sb = 0; sb < 3; sb++) { var bb = c.box(2.4, 0.04, 0.09, MAT.wood, 0, 0.7 + sb * 0.12, -2.04 - sb * 0.04); bb.rotation.x = -0.2; } [-1.0, 1.0].forEach(function (bx) { c.box(0.05, 0.44, 0.44, FR, bx, 0.22, -1.72); c.box(0.05, 0.5, 0.06, FR, bx, 0.75, -2.08).rotation.x = -0.2; });
        c.cyl(0.11, 1.0, FR, 1.3, 0.5, 1.6, 12); c.cyl(0.13, 0.08, FR, 1.3, 1.02, 1.6, 12); c.cyl(0.1, 0.02, std({ color: 0x8a8a8a, roughness: 0.5 }), 1.3, 1.065, 1.6, 12); c.cyl(0.14, 0.02, FR, 1.3, 0.01, 1.6, 12);
        c.sign(['SMOKING AREA', 'please use the ashtray'], 0.9, 0.3, 0, 2.05, -2.17, 0, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign(['NO SMOKING', 'beyond this shelter'], 0.9, 0.3, -1.67, 2.05, 0, Math.PI / 2, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' });
        c.solid(-1.8, -1.6, -2.3, 2.3, 0, 2.6); c.solid(-1.8, 1.8, -2.3, -2.1, 0, 2.6); c.solid(-1.3, 1.3, -2.1, -1.5, 0, 1.0); c.solid(1.1, 1.5, 1.4, 1.8, 0, 1.1);
      }
    /* 06-props.js */
    function dumpsterBuild(c) { c.box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 0, 0.65, 0); var dl = c.box(1.9, 0.08, 1.3, MAT.black, 0, 1.52, -0.2); dl.rotation.x = -0.35; [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (w) { c.cyl(0.08, 0.06, MAT.black, w[0], 0.08, w[1], 10).rotation.z = Math.PI / 2; }); c.box(0.1, 0.1, 0.4, MAT.steelDark, -0.95, 0.9, 0); c.box(0.1, 0.1, 0.4, MAT.steelDark, 0.95, 0.9, 0); c.sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 0, 0.9, -0.62, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' }); c.solid(-0.95, 0.95, -0.65, 0.65, -2, 2); }
    /* 06-props.js */
    function flagBuild(c) { c.cyl(0.05, 9, MAT.chrome, 0, 4.5, 0, 8, 0.07); c.sphere(0.1, MAT.yellow, 0, 9.05, 0); var fg = new THREE.Group(); fg.position.set(0, 8.3, 0); fg.userData.dynamic = true; c.add(fg); yard.flag = fg; var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag; }
    /* 06-props.js */
    function parkingSignBuild(c) { c.cyl(0.04, 2.4, MAT.steelDark, 0, 1.2, 0, 6); c.sign(['STAFF', 'PARKING'], 0.9, 0.6, 0, 2.5, 0, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' }); }
    /* 06-props.js */
    var BARK = std({ color: 0x5a4634, roughness: 1, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.8, 0.8) });
    /* 06-props.js */
    var LEAF = [std({ color: 0x3f6f2e, roughness: 1, flatShading: true }), std({ color: 0x5c8f44, roughness: 1, flatShading: true }), std({ color: 0x4a7d33, roughness: 1, flatShading: true })];
    /* 06-props.js */
    function canopy(c, r, x, y, z, mat, rnd) { rnd = rnd || Math.random; var g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position; for (var i = 0; i < p.count; i++) { var k = 1 + (rnd() - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.8 + rnd() * 0.3), p.getZ(i) * k); } g.computeVertexNormals(); var m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; c.group.add(m); return m; }
    /* 06-props.js */
    function treeBuild(c, P, inst) {
        // the tree's size, lean and leaf jitter come from its own seed: a tree used to grow or shrink at every move, turn and reload
        var id = inst ? inst.id : 'tree', s = seededF(id, 1, 0.85, 1.25), lean = seededF(id, 2, -0.06, 0.06), seed = Math.floor(propSeed(id, 3) * 2147483647) || 1, rnd = function () { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        var trunk = c.cyl(0.11 * s, 2.8 * s, BARK, 0, 1.4 * s, 0, 9, 0.2 * s); trunk.rotation.z = lean;
        var l1 = c.cyl(0.05 * s, 1.1 * s, BARK, 0.35 * s, 2.5 * s, 0.1 * s, 6, 0.09 * s); l1.rotation.z = -0.7; var l2 = c.cyl(0.05 * s, 0.9 * s, BARK, -0.3 * s, 2.7 * s, -0.2 * s, 6, 0.08 * s); l2.rotation.z = 0.8; l2.rotation.x = 0.4;
        canopy(c, 1.35 * s, 0, 3.4 * s, 0, LEAF[0], rnd); canopy(c, 1.0 * s, 0.8 * s, 3.0 * s, 0.4 * s, LEAF[1], rnd); canopy(c, 0.95 * s, -0.75 * s, 3.2 * s, -0.5 * s, LEAF[2], rnd); canopy(c, 0.8 * s, 0.1 * s, 4.3 * s, 0.1 * s, LEAF[1], rnd); canopy(c, 0.7 * s, -0.2 * s, 2.6 * s, 0.8 * s, LEAF[0], rnd);
        c.solid(-0.2, 0.2, -0.2, 0.2, -2, 2);
      }
    /* 06-props.js */
    function bollardBuild(c) { c.cyl(0.11, 1.0, MAT.yellow, 0, 0.5, 0, 10); c.cyl(0.14, 0.05, MAT.black, 0, 0.025, 0, 10); c.solid(-0.12, 0.12, -0.12, 0.12, -2, 1); }
    /* 06-props.js */
    function benchSeatBuild(c) { for (var sl = 0; sl < 4; sl++) c.box(1.6, 0.04, 0.07, MAT.wood, 0, 0.45, -0.14 + sl * 0.09); c.box(1.6, 0.04, 0.3, MAT.wood, 0, 0.85, 0.16).rotation.x = -0.2; [[-0.65], [0.65]].forEach(function (p) { c.box(0.06, 0.45, 0.4, MAT.steelDark, p[0], 0.22, 0); c.box(0.06, 0.5, 0.06, MAT.steelDark, p[0], 0.65, 0.18); }); c.solid(-0.8, 0.8, -0.25, 0.25, -2, 1); }
    /* 06-props.js */
    function timeclockBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        var hous = new THREE.Mesh(bevelGeo(0.4, 0.56, 0.12, 0.02), LG); hous.position.set(0, 1.5, 0); hous.castShadow = true; c.group.add(hous); c.box(0.42, 0.03, 0.14, DG, 0, 1.79, 0); c.box(0.42, 0.03, 0.14, DG, 0, 1.21, 0);
        c.box(0.34, 0.36, 0.01, MAT.black, 0, 1.52, 0.05); c.box(0.14, 0.012, 0.03, MAT.black, 0, 1.28, 0.07); c.box(0.12, 0.004, 0.01, MAT.chrome, 0, 1.283, 0.08); tclock.lamp = c.box(0.03, 0.03, 0.02, glowMat(0x39d353, 1.2), 0.15, 1.72, 0.065); c.box(0.03, 0.03, 0.02, glowMat(0xff3b2f, 0.3), -0.15, 1.72, 0.065);
        c.box(0.5, 0.56, 0.08, DG, 0.58, 1.5, -0.02); c.box(0.48, 0.02, 0.06, LG, 0.58, 1.75, 0.0); for (var k = 0; k < 8; k++) { c.box(0.07, 0.15, 0.03, MAT.paper, 0.4 + Math.floor(k / 4) * 0.12 + 0.06 * (k % 2 ? 0 : 0), 1.62 - (k % 4) * 0.13, 0.04); } c.box(0.5, 0.02, 0.03, DG, 0.58, 1.26, 0.03);
        c.sign(['CLOCK IN · CLOCK OUT'], 0.86, 0.14, 0.3, 1.9, 0.0, 0, { w: 384, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['CARDS'], 0.3, 0.08, 0.58, 1.19, 0.05, 0, { w: 128, h: 40, bg: '#f5b53d', fg: '#1a1205' });
        c.cyl(0.012, 0.6, MAT.black, 0.18, 1.0, 0.0, 6);
        touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0, y: 1.5, z: 0.07, ry: 0, parent: c.group, title: 'Time clock', draw: drawTimeClock });
      }
    /* 06-props.js */
    function consoleBuild(di) { return function (c) {
        var dir = DOOR_MAP[di].dir, inbound = dir === 'in', ret = dir === 'ret', k = DOOR_MAP[di].dock, lane = inbound || ret ? null : MODES[TRUCK_OUT[k].mode];
        var hous = new THREE.Mesh(bevelGeo(0.5, 0.62, 0.12, 0.02), MAT_MACH.panel); hous.position.set(0, 1.45, 0); hous.castShadow = true; c.group.add(hous); c.box(0.44, 0.34, 0.01, MAT.black, 0, 1.47, 0.05); c.box(0.54, 0.04, 0.14, inbound ? MAT.hazard : MAT.yellow, 0, 1.78, 0); c.box(0.54, 0.04, 0.14, MAT_MACH.frame, 0, 1.12, 0); c.cyl(0.012, 1.0, MAT.black, 0, 0.6, -0.03, 6); c.cyl(0.03, 0.03, MAT.red, -0.17, 1.22, 0.07, 10).rotation.x = Math.PI / 2; c.box(0.05, 0.05, 0.02, MAT.yellow, -0.17, 1.22, 0.06); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), 0.17, 1.22, 0.065); c.box(0.08, 0.06, 0.04, MAT_MACH.frame, 0, 1.08, -0.02);
        touchScreen({ w: 320, h: 240, pw: 0.4, ph: 0.3, x: 0, y: 1.47, z: 0.065, ry: 0, parent: c.group, title: 'Dock console ' + dockLabel(di), draw: function (cc, sc) {
          scBg(cc, sc.w, sc.h, inbound || ret ? 'rgba(245,181,61,0.16)' : 'rgba(95,211,141,0.16)'); scHead(cc, sc.w, 'DOCK ' + dockLabel(di), lane ? lane.name.toUpperCase() + ' LANE' : undefined);
          var t = truckAtDoor(di);
          if (ret) {
            if (t) { var ra = (t.returns || []).length; scText(cc, 16, 66, 'Returns truck docked · ' + t.driver, '#f5b53d', 14); scText(cc, 16, 86, ra + ' return' + (ra === 1 ? '' : 's') + ' still aboard · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, retFeedWorks(t) ? 'The belt is taking them in' : !S.doors[di] ? 'Door down: the belt waits' : !powered() ? 'No power: the belt is stopped' : 'The belt is starting', retFeedWorks(t) ? '#5fd38d' : '#ff6b5e', 13); }
            else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, isSunday() ? 'Closed Sunday' : 'The returns truck comes at ' + TRUCK_RET.map(fmtTime).join(' and ') + ' daily', '#eef1f5', 13); }
            scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
            var qn = rdesk().queue.length; scButton(sc, 164, 128, 140, 40, qn + ' in the queue', false, function () { scanToggle(true); scanPage(1); });
            scText(cc, 16, 190, rdesk().done + ' returns inspected so far · ' + rdesk().shelf.length + ' box' + (rdesk().shelf.length === 1 ? '' : 'es') + ' in the cage', '#a0acb8', 11);
          } else if (inbound) {
            if (t) { var left = S.pallets.filter(function (q) { return q.place === 'truck' && q.truck === t.id; }).length; scText(cc, 16, 66, 'Truck docked · ' + t.driver + ' · ' + clientName(t.client), '#f5b53d', 14); scText(cc, 16, 86, left + ' of ' + t.pallets.length + ' pallets still on it · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, t.signed ? 'Delivery note signed' : 'NOT SIGNED: see the driver outside', t.signed ? '#5fd38d' : '#ff6b5e', 13); }
            else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Inbound slots: ' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 || k !== 1 ? '' : ' (buy the second bay)'), '#eef1f5', 13); }
            scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
            var pending = S.pallets.filter(function (q) { return q.place === 'floor'; }).length; scButton(sc, 164, 128, 140, 40, pending + ' on the floor', false, function () { scanToggle(true); scanPage(3); });
            if (t && !t.signed) scButton(sc, 16, 176, 288, 36, 'SIGN THE DELIVERY NOTE', true, function () { signTruck(t); var dm = truckMeshes[t.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); }, '#5fd38d');   // from the console, no walk to the driver
          } else {
            var nxt = outNext(k);
            if (!dockOwned(k)) { scText(cc, 16, 66, 'Not in service', '#ff6b5e', 15); scText(cc, 16, 86, 'The air dock opens with the sortation deck (shop)', '#eef1f5', 13); }
            else if (t) { scText(cc, 16, 66, 'Truck docked · ' + t.driver, '#5fd38d', 15); scText(cc, 16, 86, t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scButton(sc, 16, 104, 288, 44, t.parcels.length ? 'DISPATCH NOW' : 'nothing loaded', t.parcels.length > 0, function () { consoleUse(di); }, '#5fd38d'); }
            else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, (isSunday() ? 'Closed Sunday · ' : 'Next: ' + fmtTime(nxt.arrive) + ' to ' + fmtTime(nxt.leave) + (nxt.tomorrow ? ' tomorrow' : '')) + ' · ' + outWindows(k).map(function (w) { return fmtTime(w.arrive); }).join(' and ') + ' daily', '#eef1f5', 13); }
            scButton(sc, 16, 160, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
            var packed = S.orders.filter(function (o) { return o.state === 'packed' && orderMode(o) === lane.id; }).length; scButton(sc, 164, 160, 140, 40, packed + ' ' + lane.name.toLowerCase() + ' packed', false, function () { scanToggle(true); scanPage(5); });
            scText(cc, 16, 212, (S.stats.misrouted || 0) + ' parcels out of the wrong door so far', '#a0acb8', 11);
          }
          scText(cc, 16, 226, S.events.power ? 'NO POWER' : 'mains ok', S.events.power ? '#ff6b5e' : '#5fd38d', 11);
        } });
        c.sign([ret ? 'RETURNS DOCK' : 'DOCK ' + dockLabel(di)], ret ? 1.0 : 0.7, 0.18, 0, 1.95, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: inbound || ret ? '#f5b53d' : '#5fd38d' });
      }; }
    /* 06-props.js */
    function breakerBuild(c) {
        var LG = std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }); var box2 = new THREE.Mesh(bevelGeo(0.46, 0.7, 0.14, 0.02), LG); box2.position.set(0, 1.5, 0); box2.castShadow = true; c.group.add(box2);
        c.box(0.4, 0.62, 0.012, std({ color: 0xcfd4d9, roughness: 0.5 }), 0, 1.5, 0.075); c.box(0.025, 0.08, 0.02, MAT.chrome, 0.16, 1.5, 0.085); c.box(0.4, 0.02, 0.016, MAT_MACH.frame, 0, 1.2, 0.075);
        c.box(0.1, 0.22, 0.03, MAT.black, 0, 1.52, 0.09); c.box(0.06, 0.12, 0.04, MAT.red, 0, 1.55, 0.11); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), -0.12, 1.7, 0.085); c.box(0.08, 0.06, 0.002, MAT.paper, 0.1, 1.7, 0.082);
        c.sign(['⚡ DANGER 400 V'], 0.3, 0.07, 0, 1.32, 0.085, 0, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.cyl(0.02, 0.5, MAT.black, -0.1, 2.1, -0.02, 6); c.cyl(0.02, 0.5, MAT.black, 0.1, 2.1, -0.02, 6);
        c.hit(0.5, 0.7, 0.2, 0, 1.5, 0.05, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } }); c.sign(['MAIN BREAKER'], 0.6, 0.15, 0, 1.95, 0.01, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' });
      }
    /* 06-props.js */
    function boardBuild(c) {
        var cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; world.boardCtx = cv.getContext('2d');
        world.boardTex = new THREE.CanvasTexture(cv); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
        c.cyl(0.03, 2.8, MAT.steelDark, -1.0, 5.6, 0, 6); c.cyl(0.03, 2.8, MAT.steelDark, 1.0, 5.6, 0, 6); c.box(3.1, 0.06, 0.1, MAT.steelDark, 0, 4.2, 0);
        c.box(3.1, 1.6, 0.08, MAT.black, 0, 3.35, 0); var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(0, 3.35, 0.05); c.add(board); var back = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); back.position.set(0, 3.35, -0.05); back.rotation.y = Math.PI; c.add(back);
        // on the screens list so the wheel pages it when you look up at it and it redraws itself as its pages turn; no buttons, so no E prompt
        world.boardScreen = { w: 768, h: 384, ctx: world.boardCtx, tex: world.boardTex, mesh: board, zones: [], draw: function (cx, sc) { drawBoard(sc); }, cur: null, ripple: 0, title: 'Order board', dirty: true, scrollable: true, scroll: 0, scrollMax: 0, autoPage: true }; screens.push(world.boardScreen);
        drawBoard();
      }
    /* 06-props.js */
    function chargerBuild(c) {
        var CB = std({ color: 0x8b949c, roughness: 0.5, metalness: 0.4 });
        c.box(0.9, 1.1, 0.32, CB, 0, 1.55, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 2.12, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 0.98, -0.14);
        for (var vv = 0; vv < 6; vv++) c.box(0.3, 0.012, 0.02, MAT.black, -0.22, 1.9 - vv * 0.04, 0.03); for (var vw = 0; vw < 6; vw++) c.box(0.3, 0.012, 0.02, MAT.black, 0.22, 1.9 - vw * 0.04, 0.03);
        dress.charger = c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), -0.35, 1.3, 0.03); 
        c.sign(['CHARGING POINT'], 0.8, 0.14, 0, 2.0, 0.03, 0, { w: 512, h: 96, bg: '#1b232c', fg: '#5fd38d' }); c.sign(['24 V · ISOLATE BEFORE SERVICE'], 0.8, 0.07, 0, 1.08, 0.03, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
        [-0.28].forEach(function (rx) { var reel = c.cyl(0.14, 0.12, MAT.black, rx, 0.75, -0.1, 16); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.14, MAT.steelDark, rx, 0.75, -0.1, 10).rotation.x = Math.PI / 2; var cab = c.cyl(0.018, 0.9, MAT.black, rx, 0.35, 0.3, 6); cab.rotation.x = 1.1; });
        c.box(0.18, 0.6, 0.18, MAT.steelDark, -0.5, 0.3, 0.55); c.box(0.22, 0.04, 0.22, MAT.yellow, -0.5, 0.62, 0.55); c.box(0.1, 0.08, 0.06, MAT.red, -0.5, 0.5, 0.65); c.box(0.1, 0.08, 0.06, MAT.blue, -0.5, 0.36, 0.65);
        c.sign(['FORKLIFT'], 0.2, 0.05, -0.5, 0.28, 0.65, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
        c.box(1.1, 0.03, 0.08, MAT.hazard, 0, 0.015, 0.2); c.solid(-0.5, 0.5, -0.3, 0.7, 0, 2.2);
        c.hit(1.0, 1.3, 0.5, 0, 1.5, 0.05, { prompt: function () { return cablePrompt('fork'); }, use: function () { cableUse('fork'); } });
        touchScreen({ w: 200, h: 80, pw: 0.4, ph: 0.16, x: 0.05, y: 1.3, z: 0.035, ry: 0, parent: c.group, title: 'Charger display', draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.2)'); var b = Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100); scText(cc, 10, 30, S.fork.plugged ? (b >= 100 ? 'FORKLIFT · FULL' : 'CHARGING · ' + b + '%') : 'FORKLIFT · ' + b + '% · unplugged', S.fork.plugged ? '#5fd38d' : '#f5b53d', 18); cc.fillStyle = 'rgba(255,255,255,0.12)'; cc.fillRect(10, 48, 180, 14); cc.fillStyle = b < 20 ? '#ff6b5e' : '#5fd38d'; cc.fillRect(10, 48, 1.8 * b, 14); } });
        var w = 2.6, d = 3.2, cz = 2.6; [[0, cz - d / 2, w, 0.08], [0, cz + d / 2, w, 0.08], [-w / 2, cz, 0.08, d], [w / 2, cz, 0.08, d]].forEach(function (ln) { c.plane(ln[2], ln[3], MAT.yellowLine, ln[0], 0.0062, ln[1], -Math.PI / 2, 0); }); c.plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex(['FORKLIFT'], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), 0, 0.0066, cz - d / 2 + 0.3, -Math.PI / 2, 0);
      }
    /* 06-props.js */
    function lampPostBuild(c) { c.cyl(0.08, 7.5, MAT.steelDark, 0, 3.75, 0, 8, 0.11); c.box(0.6, 0.2, 0.3, MAT.steelDark, 0, 7.65, 0); var lens = c.box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), 0, 7.53, 0); yard.lampLenses.push(lens); var l = new THREE.PointLight(0xffd9a0, 0.0, 36, 2); l.position.set(0, 7.4, 0); l.userData.k = 1.4; c.add(l); yardLights.push(l); c.box(0.3, 0.2, 0.3, MAT.grey, 0, 0.1, 0); c.solid(-0.15, 0.15, -0.15, 0.15, -2, 2); }
    /* 06-props.js */
    function carBuild(k) { return function (c) { c.add(carMesh(typeof k === "number" ? CAR_COLS[k % CAR_COLS.length] : k)); c.solid(-2.2, 2.2, -1.0, 1.0, -2, 1.5); }; }
    /* 06-props.js */
    function paintedBuild(c) { c.sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, 0.01, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d', plate: false }); c.sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8', plate: false }); }
    /* 06-props.js */
    function aisleSignBuild(text) { return function (c) { c.sign([text], 2.2, 0.5, 0, 5.4, 0, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([text], 2.2, 0.5, 0, 5.4, 0, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, 0, 4); c.cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, 0, 4); }; }
    /* 06-props.js */
    var treeN = 0;
    /* 06-props2-factory.js */
    var WING = { x0: -14, x1: 10, z0: -HALL.z - 20, z1: -HALL.z, h: 6, door: { x0: 4, x1: 7.6, h: 4.2 }, belt: { x0: -5, x1: -3, h: 2.0 } };
    /* 06-props2-factory.js */
    function inWing(x, z) { return stageHas('wing') && x > WING.x0 && x < WING.x1 && z > WING.z0 && z < WING.z1; }
    /* 06-props2-factory.js */
    var MAT_MACH = { frame: std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), panel: std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), guard: std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), blue: std({ color: 0x2f5f9e, roughness: 0.45, metalness: 0.4 }), roller: std({ color: 0x8d9298, roughness: 0.3, metalness: 0.8 }), rubber: std({ color: 0x1c1e22, roughness: 0.95 }) };
    /* 06-props2-factory.js */
    var beltTexBase = tex(64, 64, function (c, w, h) { c.fillStyle = '#23262a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2c3035'; for (var i = 0; i < 8; i++) c.fillRect(0, i * 8, w, 3); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 28, w, 4); grain(c, w, h, 300, 0.08); }, 1, 1);
    /* 06-props2-factory.js */
    function lampStack(c, x, y, z) {
        c.cyl(0.02, 0.5, MAT_MACH.frame, x, y + 0.25, z, 6); var g = c.cyl(0.05, 0.08, glowMat(0x5fd38d, 1.4), x, y + 0.56, z, 10), a = c.cyl(0.05, 0.08, glowMat(0xf5b53d, 1.4), x, y + 0.65, z, 10), r = c.cyl(0.05, 0.08, glowMat(0xff3b2f, 1.4), x, y + 0.74, z, 10); c.cyl(0.055, 0.03, MAT.black, x, y + 0.8, z, 10);
        g.visible = false; a.visible = true; r.visible = false; return { g: g, a: a, r: r };
      }
    /* 06-props2-factory.js */
    function conveyorBuild(c, x, z0, z1, opt) {
        opt = opt || {}; var len = z1 - z0, zc = (z0 + z1) / 2, y = BELT_Y, FR = MAT_MACH.frame, LG = std({ color: 0xcfd4d9, roughness: 0.45, metalness: 0.3 });
        // side frames: a channel profile (web plus top and bottom flanges) with a painted top lip
        [-0.36, 0.36].forEach(function (sx) { c.box(0.04, 0.16, len, LG, x + sx, y - 0.06, zc); c.box(0.1, 0.02, len, LG, x + sx + (sx < 0 ? 0.03 : -0.03), y + 0.02, zc); c.box(0.1, 0.02, len, LG, x + sx + (sx < 0 ? 0.03 : -0.03), y - 0.14, zc); c.box(0.05, 0.02, len, MAT_MACH.blue, x + sx, y + 0.035, zc); });
        for (var cb = z0 + 0.6; cb < z1; cb += 1.2) c.box(0.68, 0.04, 0.05, FR, x, y - 0.13, cb);                                               // cross stays under the bed
        // rollers under the belt, end drums, the belt itself
        for (var rz = z0 + 0.18; rz < z1 - 0.1; rz += 0.3) { var r = c.cyl(0.03, 0.66, MAT_MACH.roller, x, y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
        [z0 + 0.06, z1 - 0.06].forEach(function (dz) { var dr = c.cyl(0.07, 0.68, MAT_MACH.roller, x, y - 0.03, dz, 14); dr.rotation.z = Math.PI / 2; });
        var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, len / 0.5); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true;
        var top = c.plane(0.62, len - 0.04, bm, x, y + 0.025, zc, -Math.PI / 2, 0); top.userData.speedKey = c.group.userData.propId; BELT_PLANES.push(top); c.box(0.62, 0.012, len - 0.04, std({ color: 0x1c1f23, roughness: 0.95 }), x, y - 0.09, zc);   // the return run underneath
        // guide rails on brackets, not floating
        [-0.32, 0.32].forEach(function (gx) { c.box(0.03, 0.04, len - 0.1, MAT_MACH.guard, x + gx, y + 0.14, zc); for (var gz = z0 + 0.3; gz < z1; gz += 1.2) { c.box(0.03, 0.14, 0.03, FR, x + gx, y + 0.08, gz); c.box(0.08, 0.02, 0.03, FR, x + gx + (gx < 0 ? 0.03 : -0.03), y + 0.04, gz); } });
        // the drive: motor and gearbox hung off the far drum, a guard over the chain (one per run, not one per short segment of a curve)
        if (!opt.noMotor) { var mt = c.cyl(0.085, 0.26, MAT_MACH.blue, x + 0.5, y - 0.1, z1 - 0.2, 14); mt.rotation.z = Math.PI / 2; c.cyl(0.095, 0.02, MAT.black, x + 0.64, y - 0.1, z1 - 0.2, 14).rotation.z = Math.PI / 2; c.box(0.12, 0.16, 0.16, FR, x + 0.43, y - 0.1, z1 - 0.2); c.box(0.06, 0.26, 0.2, FR, x + 0.4, y - 0.05, z1 - 0.1); c.box(0.03, 0.02, 0.4, MAT.black, x + 0.43, y - 0.2, z1 - 0.4); }
        if (!opt.noLegs) for (var lz = z0 + 0.4; lz < z1; lz += 1.5) { [-0.3, 0.3].forEach(function (lx) { c.box(0.06, y - 0.14, 0.06, FR, x + lx, (y - 0.14) / 2, lz); c.box(0.14, 0.02, 0.14, FR, x + lx, 0.01, lz); c.cyl(0.02, 0.04, MAT.chrome, x + lx, 0.03, lz, 6); }); c.box(0.66, 0.05, 0.05, FR, x, 0.2, lz); var dg = c.box(0.04, Math.hypot(0.6, y - 0.4), 0.04, FR, x, (y - 0.14) / 2 + 0.05, lz); dg.rotation.z = Math.atan2(0.6, y - 0.4); }
        if (!opt.noEye) { c.box(0.03, 0.4, 0.03, FR, x - 0.42, y + 0.2, z1 - 0.3); c.box(0.05, 0.06, 0.04, MAT.black, x - 0.42, y + 0.32, z1 - 0.3); c.box(0.02, 0.02, 0.005, glowMat(0xff3b2f, 1.2), x - 0.395, y + 0.32, z1 - 0.3); c.box(0.03, 0.3, 0.03, FR, x + 0.42, y + 0.15, z1 - 0.3); c.box(0.03, 0.03, 0.02, MAT.white, x + 0.42, y + 0.32, z1 - 0.3); }
        c.box(0.04, 0.03, len - 0.6, MAT.black, x - 0.4, y - 0.18, zc); for (var cz = z0 + 0.5; cz < z1; cz += 2) c.box(0.06, 0.08, 0.04, FR, x - 0.4, y - 0.18, cz);   // the cable run
        c.solid(x - 0.4, x + 0.4, z0, z1, 0, 0.82);
      }
    /* 06-props2-factory.js */
    function conveyorPath(c, pts) {
        for (var i = 1; i < pts.length; i++) {
          var ax = pts[i - 1][0], az = pts[i - 1][1], ay = pts[i - 1][2] || 0, bx = pts[i][0], bz = pts[i][1], by = pts[i][2] || 0, run = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), slope = Math.atan2(by - ay, run), len = Math.hypot(run, by - ay);
          var sg = new THREE.Group(); sg.position.set(ax, ay, az); sg.rotation.order = 'YXZ'; sg.rotation.y = ang; sg.rotation.x = -slope; sg.userData.propId = c.group.userData.propId; c.group.add(sg);   // the segments scroll with the prop's dial
          var sc = propCtx(sg, 'seg'); conveyorBuild(sc, 0, 0, len, { noEye: i < pts.length - 1, noLegs: true, noMotor: i < pts.length - 1 });
          // legs in the prop frame, the right height wherever the belt is, braced when tall; a curve's short segments share a leg every third one
          var ux = (bx - ax) / run, uz = (bz - az) / run, px = uz, pz = -ux;
          var hang = pts[i][3] === 'hang', spiral = pts[i][3] === 'spiral';   // a spiral segment hangs off the spiral's own column and guard: no legs, no hangers, no solid of its own
          if (spiral) { } else if (hang) { for (var hd = 0.6; hd < run; hd += 2.5) { var ht = BELT_Y + ay + (by - ay) * hd / run + 0.05, hx = ax + ux * hd, hz = az + uz * hd; [-0.3, 0.3].forEach(function (o) { c.cyl(0.025, HALL.h - 0.2 - ht, MAT_MACH.frame, hx + px * o, (HALL.h - 0.2 + ht) / 2, hz + pz * o, 6); }); var hb = c.box(0.8, 0.06, 0.06, MAT_MACH.frame, hx, ht, hz); hb.rotation.y = ang; var hp = c.box(0.9, 0.05, 0.3, MAT_MACH.frame, hx, HALL.h - 0.2, hz); hp.rotation.y = ang; } }
          else for (var d = run < 1 ? (i % 3 === 1 ? run / 2 : run + 1) : 0.5; d < run; d += 1.5) { var top = BELT_Y + ay + (by - ay) * d / run - 0.1, lx = ax + ux * d, lz = az + uz * d; [-0.3, 0.3].forEach(function (o) { c.box(0.06, top, 0.06, MAT_MACH.frame, lx + px * o, top / 2, lz + pz * o); c.box(0.14, 0.02, 0.14, MAT_MACH.frame, lx + px * o, 0.01, lz + pz * o); if (Math.min(ay, by) > 1.2) c.solid(lx + px * o - 0.1, lx + px * o + 0.1, lz + pz * o - 0.1, lz + pz * o + 0.1, 0, top); }); var cb = c.box(0.66, 0.05, 0.05, MAT_MACH.frame, lx, top - 0.02, lz); cb.rotation.y = ang; if (top > 1.5) { var br = c.box(0.66, 0.05, 0.05, MAT_MACH.frame, lx, top * 0.5, lz); br.rotation.y = ang; var dg = c.box(0.04, top * 0.95, 0.04, MAT_MACH.frame, lx, top / 2, lz); dg.rotation.order = 'YXZ'; dg.rotation.y = ang; dg.rotation.z = Math.atan2(0.6, top); } }
          // the solid: a level belt on the deck is a floor belt up there (solid from the deck to a metre up, so a step-over clears it); a high run carries only
          // a band round the belt; a slope is cut into metre-long pieces, each at its own height, so you can walk under the high end of an incline
          var lo = Math.min(ay, by), onDeck = Math.abs(lo - UPPER.y) < 0.25 && Math.abs(ay - by) < 0.25;
          if (!spiral) { var nch = Math.abs(ay - by) > 0.3 ? Math.max(1, Math.ceil(run / 1.0)) : 1; for (var ch = 0; ch < nch; ch++) { var t0 = ch / nch, t1 = (ch + 1) / nch, cy = Math.min(ay + (by - ay) * t0, ay + (by - ay) * t1), cx0 = ax + (bx - ax) * t0, cx1 = ax + (bx - ax) * t1, cz0 = az + (bz - az) * t0, cz1 = az + (bz - az) * t1, chigh = cy > 1.2, clow = BELT_Y + cy - 0.15; c.solid(Math.min(cx0, cx1) - 0.4, Math.max(cx0, cx1) + 0.4, Math.min(cz0, cz1) - 0.4, Math.max(cz0, cz1) + 0.4, onDeck ? cy : chigh ? clow : 0, onDeck ? cy + 0.9 : chigh ? clow + 1.2 : 0.82); } }
        }
      }
    /* 06-props2-factory.js */
    var SHIP_PATH = BOOT_STAGE === 1 ? [[0, 0], [0, 0.5], [2.6, 0.5], [2.6, -9.8], [0.4, -9.8], [0.4, -11.6]] : [[0, 0], [0, 0.5], [2.6, 0.5], [2.6, -15.3], [0.4, -15.3], [0.4, -17.1]];
    /* 06-props2-factory.js */
    function shipBeltBuild(c) { conveyorPath(c, SHIP_PATH); c.sign(['TO THE ' + (BOOT_STAGE === 1 ? 'OUT 1' : 'OUT 2') + ' BAY'], 0.8, 0.14, 2.17, 1.05, BOOT_STAGE === 1 ? -2 : -4, -Math.PI / 2, { w: 320, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function dockLoaderBuildFor(id, label, mirror) { return function (c) {
        var m = mirror ? -1 : 1, Z = function (z) { return z * m; }, door = LOADER_DOORS[id];
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame, BL = MAT_MACH.blue;
        var rbx = function (w, h, d, r, mat, x, y, z, parent) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; (parent || c.group).add(mm); return mm; };
        rbx(1.6, 0.26, 2.2, 0.03, DG, -0.2, 0.13, Z(0.6)); [[-0.9, -0.4], [0.5, -0.4], [-0.9, 1.6], [0.5, 1.6]].forEach(function (p) { c.cyl(0.07, 0.04, DG, p[0], 0.02, Z(p[1]), 10); c.box(0.12, 0.3, 0.12, DG, p[0], 0.3, Z(p[1])); });
        [-0.46, 0.26].forEach(function (sx) { c.box(0.04, 0.16, 1.9, LG, sx, BELT_Y - 0.06, Z(0.75)); c.box(0.05, 0.02, 1.9, BL, sx, BELT_Y + 0.035, Z(0.75)); });
        for (var rz = -0.1; rz < 1.6; rz += 0.3) { var r = c.cyl(0.03, 0.68, MAT_MACH.roller, -0.1, BELT_Y - 0.02, Z(rz), 10); r.rotation.z = Math.PI / 2; }
        var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, 3.8); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true; var top = c.plane(0.62, 1.86, bm, -0.1, BELT_Y + 0.025, Z(0.75), -Math.PI / 2, m > 0 ? 0 : Math.PI); top.userData.speedKey = c.group.userData.propId; BELT_PLANES.push(top);
        [-0.42, 0.22].forEach(function (gx) { c.box(0.03, 0.04, 1.8, MAT_MACH.guard, gx, BELT_Y + 0.14, Z(0.75)); [0.0, 0.8, 1.5].forEach(function (gz) { c.box(0.03, 0.14, 0.03, DG, gx, BELT_Y + 0.08, Z(gz)); }); });
        [[-0.1, -0.1], [-0.1, 0.9]].forEach(function (p) { c.box(0.14, 1.9, 0.14, BL, 0.55, 0.95, Z(p[1])); }); c.box(0.16, 0.16, 1.2, BL, 0.55, 1.9, Z(0.4)); c.cyl(0.1, 0.9, DG, 0.55, 1.1, Z(0.4), 12).rotation.x = Math.PI / 2;
        var cylm = c.cyl(0.06, 1.0, MAT.chrome, 1.0, 0.5, Z(0.4), 10); cylm.rotation.z = -0.9; var cylb = c.cyl(0.08, 0.6, DG, 0.75, 0.3, Z(0.4), 10); cylb.rotation.z = -0.9;
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        var boom = new THREE.Group(); boom.position.set(0.9, BELT_Y + 0.02, Z(0.4)); dyn.add(boom);
        box(1.6, 0.16, 0.76, LG, 0, 0, 0, boom); box(1.6, 0.03, 0.62, std({ color: 0x2c3035, roughness: 0.9 }), 0, 0.1, 0, boom); box(1.6, 0.05, 0.03, MAT_MACH.guard, 0, 0.16, 0.34, boom); box(1.6, 0.05, 0.03, MAT_MACH.guard, 0, 0.16, -0.34, boom);
        for (var bk = -0.6; bk <= 0.6; bk += 0.3) cyl(0.03, 0.62, MAT_MACH.roller, bk, 0.09, 0, boom, 8).rotation.x = Math.PI / 2;
        cyl(0.06, 0.66, MAT.rubber, 0.82, 0.02, 0, boom, 10).rotation.x = Math.PI / 2; box(0.12, 0.12, 0.8, MAT.yellow, 0.86, -0.08, 0, boom); box(0.14, 0.04, 0.8, MAT.black, 0.86, 0.0, 0, boom);
        box(1.4, 0.06, 0.1, DG, 0, -0.1, 0.42, boom); box(1.4, 0.06, 0.1, DG, 0, -0.1, -0.42, boom); box(0.3, 0.1, 0.5, DG, -0.6, -0.14, 0, boom);
        var pusher = box(0.08, 0.34, 0.56, BL, 0.2, 0.3, 0, boom); box(0.4, 0.05, 0.05, MAT.chrome, 0.0, 0.3, 0, boom); box(0.1, 0.1, 0.1, DG, -0.2, 0.3, 0, boom);
        c.box(0.08, 0.08, 0.08, DG, 0.55, 2.0, Z(0.4)); c.box(0.6, 0.08, 0.3, DG, 0.85, 2.05, Z(0.4)); c.box(0.5, 0.05, 0.22, MAT.lamp, 0.9, 1.99, Z(0.4));
        rbx(0.5, 1.3, 0.4, 0.03, LG, -1.1, 0.7, Z(1.6)); c.box(0.52, 0.16, 0.42, DG, -1.1, 0.08, Z(1.6)); var scr = touchScreen({ w: 300, h: 200, pw: 0.38, ph: 0.25, x: -1.1, y: 1.15, z: Z(1.81), ry: m > 0 ? 0 : Math.PI, parent: c.group, title: 'Dock loader ' + label, draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(cc, sc.w, 'DOCK LOADER ' + label, dockLoaderStatus(door).toUpperCase()); scText(cc, 16, 70, dockLoaderPrompt(door).split(' · ').slice(1, 2).join(''), '#eef1f5', 13); scText(cc, 16, 100, (dockLane(door) ? dockLane(door).name.toUpperCase() + ' lane · ' : '') + (S.stats.autoLoaded || 0) + ' loaded by machine', '#a0acb8', 12); speedButton(sc, 16, 150, 130, S.up.sorter ? 'sorter' : 'shipBelt', 'BELT'); } }); scr.mesh.userData.propId = id;
        eStop(c, -1.1, 0.6, Z(1.81)); MACH[id].lamps = lampStack(c, -1.1, 1.4, Z(1.6)); c.box(0.04, 1.1, 0.04, MAT.black, -1.3, 0.55, Z(1.4));
        [-0.2, 1.0].forEach(function (lz) { c.box(0.06, 1.7, 0.06, MAT.yellow, 1.55, 0.85, Z(lz)); c.box(0.02, 1.5, 0.02, glowMat(0xff3b2f, 0.6), 1.59, 0.85, Z(lz)); c.box(0.14, 0.03, 0.14, DG, 1.55, 0.015, Z(lz)); });
        c.sign(['DOCK LOADER', 'KEEP CLEAR OF THE BOOM'], 1.2, 0.24, -0.2, 1.0, Z(-0.56), m > 0 ? Math.PI : 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' }); c.sign([label + ' · AUTO' + (dockLane(door) ? ' · ' + dockLane(door).name.toUpperCase() : '')], 0.8, 0.14, 0.55, 2.12, Z(0.4), m > 0 ? 0 : Math.PI, { w: 320, h: 64, bg: '#1b232c', fg: dockLane(door) ? dockLane(door).col : '#5fd38d' });
        MACH[id].anim = { boom: boom, pusher: pusher, pushT: 0, ext: 0 };
        c.hit(2.0, 2.0, 2.4, 0, 1.0, Z(0.6), { prompt: function () { return dockLoaderPrompt(door); }, use: function () { sfx('click'); } });
        c.solid(-1.4, 0.7, Z(-0.5), Z(1.8), 0, 2.1);
      }; }
    /* 06-props2-factory.js */
    var dockLoaderBuild = dockLoaderBuildFor('dockLoader2', 'OUT 2', false);
    /* 06-props2-factory.js */
    function gantryBuild(r) { return function (c) {
        var DG = MAT_MACH.frame, YL = std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), LG = MAT_MACH.panel, GT = gantryTop(r), GD = GT - 5.0;   // GT: rail height; the upper crane is two metres lower
        // end columns stand clear of the racking at the row ends; the mid columns stand tight against the rack faces, out of the aisles
        // the east pair stands at 47.2, past the overhead pick belt that runs along the row ends at 46
        // every column stands tight against the rack face and reaches the rails on an outrigger, so nothing stands in the aisle
        [-0.4, 47.2].forEach(function (cx) { [-0.78, 0.78].forEach(function (cz) { c.box(0.26, 5.4 + GD, 0.26, YL, cx, 2.7 + GD / 2, cz); c.box(0.5, 0.03, 0.5, DG, cx, 0.015, cz); c.box(0.26, 0.2, 1.0, DG, cx, 5.45 + GD, cz * 1.5); c.box(0.3, 0.3, 0.3, DG, cx, 5.5 + GD, cz); }); c.box(0.2, 0.2, 3.5, DG, cx, 5.55 + GD, 0); });
        for (var cx = 7.67; cx < 46; cx += 7.67) { [-0.78, 0.78].forEach(function (cz) { c.box(0.2, 5.4 + GD, 0.2, YL, cx, 2.7 + GD / 2, cz); c.box(0.4, 0.03, 0.4, DG, cx, 0.015, cz); var ob = c.box(0.2, 0.2, 0.9, DG, cx, 5.45 + GD, cz * 1.5); }); c.box(0.2, 0.2, 3.5, DG, cx, 5.55 + GD, 0); }
        [-1.6, 1.6].forEach(function (rz) { c.box(48.2, 0.18, 0.2, DG, 23.4, 5.4 + GD, rz); c.box(48.2, 0.04, 0.06, MAT.chrome, 23.4, 5.5 + GD, rz); });
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        var trolley = new THREE.Group(); trolley.position.set(46, GT, 0); dyn.add(trolley);
        box(1.0, 0.3, 3.6, YL, 0, 0.55, 0, trolley); box(1.1, 0.12, 0.5, DG, 0, 0.6, -1.6, trolley); box(1.1, 0.12, 0.5, DG, 0, 0.6, 1.6, trolley); [-0.4, 0.4].forEach(function (wx) { [-1.6, 1.6].forEach(function (wz) { cyl(0.1, 0.08, MAT.black, wx, 0.6, wz, trolley, 12).rotation.z = Math.PI / 2; }); });
        box(0.7, 0.5, 0.7, LG, 0, 0.95, 0, trolley); box(0.3, 0.3, 0.3, MAT_MACH.blue, 0.5, 0.95, 0, trolley); var beacon = cyl(0.05, 0.12, glowMat(0xffd060, 2.5), 0, 1.3, 0, trolley, 10); box(0.02, 0.1, 0.06, MAT.black, 0.03, 1.3, 0, beacon);
        var mast = box(0.28, GT - 1.0, 0.28, LG, 0, -(GT - 1.0) / 2, 0, trolley); mast.scale.y = 0.05; mast.position.y = 0;   // scaled from the trolley down to the gripper
        var grip = new THREE.Group(); grip.position.set(0, 0, 0); trolley.add(grip); box(0.5, 0.15, 0.5, DG, 0, 0.3, 0, grip); box(0.7, 0.06, 0.7, MAT.black, 0, 0.2, 0, grip); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(function (s) { cyl(0.07, 0.06, MAT_MACH.rubber, s[0], 0.15, s[1], grip, 10); });
        var bx = new THREE.Mesh(BOX_GEO, CARD[SKUS[0].id]); bx.position.set(0, -0.05, 0); bx.visible = false; grip.add(bx);
        c.sign(['GANTRY PICKER · ROW ' + rowLetter(r), 'AUTOMATIC · KEEP CLEAR'], 2.0, 0.4, 44.5, 5.9 + GD, 1.75, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#f5b53d' });
        // the control cabinet hangs off the south end column (at z -0.78) on two brackets; screen and e-stop face the aisle
        c.box(0.5, 1.0, 0.3, LG, 47.2, 1.4, -1.25); c.box(0.08, 0.3, 0.2, DG, 47.2, 1.1, -1.0); c.box(0.08, 0.3, 0.2, DG, 47.2, 1.75, -1.0); eStop(c, 47.2, 1.2, -1.41); MACH['gantry' + r].lamps = lampStack(c, 47.2, 1.9, -1.25);
        c.box(0.42, 0.3, 0.02, DG, 47.2, 1.6, -1.405); var gsc = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 47.2, y: 1.6, z: -1.418, ry: Math.PI, parent: c.group, title: 'Gantry ' + rowLetter(r), draw: gantryScreenDraw(r) }); gsc.mesh.userData.propId = 'gantry' + r; MACH['gantry' + r].screen = gsc;
        MACH['gantry' + r].anim = { trolley: trolley, mast: mast, grip: grip, box: bx, beacon: beacon };
        c.hit(0.5, 1.0, 0.3, 47.2, 1.4, -1.25, { prompt: function () { return gantryPrompt(r); }, use: function () { sfx('click'); } });
        [-0.4, 47.2].forEach(function (sx) { c.solid(sx - 0.15, sx + 0.15, -0.93, -0.63, 0, 5.5 + GD); c.solid(sx - 0.15, sx + 0.15, 0.63, 0.93, 0, 5.5 + GD); }); for (var sx2 = 7.67; sx2 < 46; sx2 += 7.67) { c.solid(sx2 - 0.12, sx2 + 0.12, -0.9, -0.66, 0, 5.5 + GD); c.solid(sx2 - 0.12, sx2 + 0.12, 0.66, 0.9, 0, 5.5 + GD); }
      }; }
    /* 06-props2-factory.js */
    function pickBeltBuild(c) { conveyorPath(c, BELTS.pickBelt.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 0, BELT_Y + 2.4 + 0.3, 8, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function pickMergeBuild(c) { conveyorPath(c, BELTS.pickMerge.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 2.0, BELT_Y + 2.4 + 0.3, 0.45, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function pickBelt2Build(c) { conveyorPath(c, BELTS.pickBelt2.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 0, BELT_Y + 2.4 + 0.3, -4, -Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function agvDockBuild(c) {
        var DG = MAT_MACH.frame; c.box(1.2, 0.012, 1.8, MAT.hazard, 0, 0.006, 0); c.box(0.5, 0.9, 0.3, MAT_MACH.panel, 0, 0.45, -1.0); c.box(0.52, 0.06, 0.32, DG, 0, 0.03, -1.0); c.box(0.3, 0.08, 0.04, MAT.chrome, 0, 0.35, -0.83); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), -0.2, 0.76, -0.84); agvScreen = touchScreen({ w: 300, h: 200, pw: 0.33, ph: 0.22, x: 0, y: 0.57, z: -0.845, ry: 0, parent: c.group, title: 'AGV dock', draw: agvScreenDraw }); agvScreen.mesh.userData.propId = 'agvDock';
        c.sign(['AGV DOCK'], 0.5, 0.12, 0, 0.82, -0.84, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' });
        [[-1.0, 1.6], [1.0, 1.6], [-1.0, 3.6], [1.0, 3.6]].forEach(function (p) { c.cyl(0.04, 0.5, MAT.yellow, p[0], 0.25, p[1], 8); });
        [[0, 1.6, 2.0, 0.08], [0, 3.6, 2.0, 0.08]].forEach(function (l) { c.plane(l[2], l[3], MAT.yellowLine, l[0], 0.0065, l[1], -Math.PI / 2); }); c.plane(0.08, 2.0, MAT.yellowLine, -1.0, 0.0065, 2.6, -Math.PI / 2); c.plane(0.08, 2.0, MAT.yellowLine, 1.0, 0.0065, 2.6, -Math.PI / 2);
        var fs2 = c.sign(['AGV PICKUP', 'set a pallet here'], 1.6, 0.5, 0, 0.0068, 2.6, 0, { w: 512, h: 160, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }); fs2.rotation.x = -Math.PI / 2;
        c.hit(0.5, 0.9, 0.3, 0, 0.45, -1.0, { prompt: function () { return agvPrompt(); }, use: function () { sfx('click'); } });
        c.solid(-0.3, 0.3, -1.2, -0.85, 0, 1.0);
      }
    /* 06-props2-factory.js */
    function eStop(c, x, y, z) { c.box(0.12, 0.12, 0.03, MAT.yellow, x, y, z); c.cyl(0.035, 0.04, MAT.red, x, y, z + 0.03, 12).rotation.x = Math.PI / 2; }
    /* 06-props2-factory.js */
    function cabinet(c, x, y, z, w, h, d) { c.box(w, h, d, MAT_MACH.panel, x, y, z); c.box(w + 0.02, 0.05, d + 0.02, MAT_MACH.frame, x, y + h / 2, z); c.box(w - 0.1, h - 0.12, 0.01, std({ color: 0xcfd4d9, roughness: 0.5 }), x, y, z + d / 2 + 0.004); c.box(0.025, 0.08, 0.02, MAT.chrome, x + w / 2 - 0.08, y, z + d / 2 + 0.015); }
    /* 06-props2-factory.js */
    function packLineBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame, BL = MAT_MACH.blue;
        var rbx = function (w, h, d, r, mat, x, y, z) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; c.group.add(mm); return mm; };
        conveyorBuild(c, 0, 0, 2.0, { noEye: true });
        // the taper body on four legs: lower skirt, louvred side panels, a top housing with a window onto the tape head, service doors
        [[-0.6, 2.15], [0.6, 2.15], [-0.6, 3.65], [0.6, 3.65]].forEach(function (p) { c.box(0.1, 0.7, 0.1, DG, p[0], 0.35, p[1]); c.box(0.2, 0.03, 0.2, DG, p[0], 0.015, p[1]); });
        rbx(1.4, 0.16, 1.8, 0.02, DG, 0, 0.78, 2.9); rbx(1.4, 1.0, 1.8, 0.04, LG, 0, 1.36, 2.9); c.box(1.42, 0.04, 1.82, MAT.hazard, 0, 0.88, 2.9);
        [-0.71, 0.71].forEach(function (sx) { for (var lv = 0; lv < 8; lv++) c.box(0.015, 0.03, 1.3, DG, sx, 1.0 + lv * 0.08, 2.9); c.box(0.02, 0.5, 0.5, std({ color: 0xcfd4d9, roughness: 0.5 }), sx, 1.3, 2.3); c.box(0.03, 0.08, 0.02, MAT.chrome, sx + (sx < 0 ? -0.01 : 0.01), 1.3, 2.5); });
        c.box(0.9, 0.7, 0.1, MAT.black, 0, 1.2, 2.02); c.box(0.9, 0.7, 0.1, MAT.black, 0, 1.2, 3.78); var flap = c.box(0.86, 0.3, 0.02, std({ color: 0xd8dde3, roughness: 0.4, transparent: true, opacity: 0.6 }), 0, 1.4, 3.8); flap.rotation.x = -0.6; flap.userData.noBake = true;
        for (var rz = 2.1; rz < 3.7; rz += 0.2) { var r = c.cyl(0.035, 0.84, MAT_MACH.roller, 0, BELT_Y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
        [-0.4, 0.4].forEach(function (x) { c.box(0.04, 0.28, 1.5, MAT_MACH.rubber, x, BELT_Y + 0.2, 2.9); });
        rbx(1.0, 0.5, 1.2, 0.05, LG, 0, 2.1, 2.9); c.box(1.04, 0.04, 1.24, DG, 0, 1.88, 2.9); c.plane(0.7, 0.3, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0.0, 2.15, 3.51, 0, 0); c.box(0.74, 0.34, 0.02, DG, 0, 2.15, 3.5);
        c.box(0.36, 0.42, 0.5, DG, 0, 1.62, 2.9); var roll = c.cyl(0.16, 0.08, MAT.white, 0, 1.72, 3.15, 16); roll.rotation.z = Math.PI / 2; c.cyl(0.03, 0.14, MAT.chrome, 0, 1.72, 3.15, 8).rotation.z = Math.PI / 2; var pr = c.cyl(0.04, 0.3, MAT_MACH.rubber, 0, 1.45, 2.62, 10); pr.rotation.z = Math.PI / 2;
        c.box(0.3, 0.02, 0.4, MAT_MACH.guard, -0.42, BELT_Y + 0.5, 2.1).rotation.z = 0.5; c.box(0.3, 0.02, 0.4, MAT_MACH.guard, 0.42, BELT_Y + 0.5, 2.1).rotation.z = -0.5;
        c.box(0.3, 0.2, 0.24, LG, 0.5, 1.12, 3.74); c.box(0.22, 0.01, 0.03, MAT.paper, 0.5, 1.04, 3.88); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.62, 1.2, 3.86);
        c.sign(['CASE TAPER 400', 'KEEP HANDS CLEAR OF THE INFEED'], 1.0, 0.2, 0, 1.6, 2.0, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['DEPOT CO. PACK LINE 1'], 1.2, 0.14, -0.72, 1.7, 2.9, -Math.PI / 2, { w: 512, h: 60, bg: '#1b232c', fg: '#f5b53d' });
        // the cabinet on a pedestal, cable trunking back to the machine
        rbx(0.5, 1.2, 0.45, 0.03, LG, 1.05, 1.0, 2.9); c.box(0.52, 0.3, 0.47, DG, 1.05, 0.25, 2.9); c.box(0.05, 0.05, 0.25, MAT.black, 0.78, 0.5, 2.9); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.05, y: 1.3, z: 3.135, ry: 0, parent: c.group, title: 'Pack line', draw: packScreenDraw }); scr.mesh.userData.propId = 'packline';
        eStop(c, 1.05, 0.85, 3.135); MACH.taper.lamps = lampStack(c, 1.05, 1.62, 2.9); c.cyl(0.02, 0.5, MAT.black, 1.2, 0.5, 2.7, 6);
        c.hit(1.6, 2.4, 1.9, 0.1, 1.2, 2.9, { prompt: function () { return packPrompt(); }, use: function () { packUse(); } });
        c.solid(-0.75, 1.35, 2.0, 3.8, 0, 2.5);
        conveyorBuild(c, 0, 3.8, 5.8, {});
        // the gravity shelf: a sloped roller bed on a frame with an end stop and a take-from-here plate
        for (var sz = 5.9; sz < 7.0; sz += 0.12) { var sr = c.cyl(0.025, 0.7, MAT_MACH.roller, 0, 0.66 - (sz - 5.9) * 0.06, sz, 8); sr.rotation.z = Math.PI / 2; }
        [-0.38, 0.38].forEach(function (x) { var rail = c.box(0.04, 0.1, 1.2, DG, x, 0.64, 6.45); rail.rotation.x = 0.06; c.box(0.05, 0.55, 0.05, DG, x, 0.28, 5.95); c.box(0.05, 0.5, 0.05, DG, x, 0.25, 6.95); c.box(0.12, 0.02, 0.12, DG, x, 0.01, 5.95); c.box(0.12, 0.02, 0.12, DG, x, 0.01, 6.95); }); c.box(0.8, 0.04, 0.04, DG, 0, 0.3, 5.95); c.box(0.8, 0.04, 0.04, DG, 0, 0.3, 6.95);
        c.box(0.8, 0.12, 0.03, MAT_MACH.guard, 0, 0.68, 7.02); c.sign(['PARCELS · TAKE FROM HERE'], 0.8, 0.12, 0, 0.5, 7.03, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#5fd38d' });
        c.solid(-0.45, 0.45, 5.8, 7.05, 0, 0.75);
      }
    /* 06-props2-factory.js */
    function moulderBuild(c) {
        var LG = MAT_MACH.panel, DG = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), BL = MAT_MACH.blue, CH = MAT.chrome;
        var rbx = function (w, h, d, r, mat, x, y, z, parent) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; (parent || c.group).add(mm); return mm; };
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        // the base: a dark skirt on levelling feet, a light bevelled bed, a hazard band, the cable chain down the operator side
        rbx(1.6, 0.34, 4.9, 0.03, DG, 0, 0.17, -0.55); rbx(1.5, 0.56, 4.9, 0.05, LG, 0, 0.62, -0.55); c.box(1.52, 0.04, 4.92, MAT.hazard, 0, 0.36, -0.55);
        [[-0.65, -2.8], [0.65, -2.8], [-0.65, -0.3], [0.65, -0.3], [-0.65, 1.7], [0.65, 1.7]].forEach(function (p) { c.cyl(0.08, 0.06, DG, p[0], 0.03, p[1], 10); c.cyl(0.03, 0.1, CH, p[0], 0.05, p[1], 8); });
        c.box(0.12, 0.08, 2.6, DG, 0.82, 0.95, 0.4); for (var cl = -0.8; cl < 1.6; cl += 0.16) c.box(0.14, 0.1, 0.03, MAT.black, 0.82, 0.95, cl);
        // the injection unit at the back: housing, loader hopper on the throat, the barrel in its slotted heater cover, the nozzle to the fixed platen
        rbx(1.2, 1.1, 1.7, 0.05, LG, 0, 1.45, -1.7); rbx(1.22, 0.3, 1.72, 0.03, BL, 0, 0.9, -1.7);
        c.cyl(0.14, 0.4, DG, 0, 2.2, -1.9, 12); c.cyl(0.32, 0.5, LG, 0, 2.6, -1.9, 16, 0.14); c.cyl(0.32, 0.5, LG, 0, 3.1, -1.9, 16); c.cyl(0.33, 0.04, DG, 0, 3.37, -1.9, 16); c.box(0.16, 0.14, 0.16, MAT.black, 0.25, 2.55, -1.9); c.cyl(0.04, 0.4, DG, 0.42, 2.8, -1.9, 8);
        c.box(0.26, 0.16, 0.3, DG, 0.5, 2.1, -1.5); var ib = c.cyl(0.18, 0.5, BL, 0, 1.3, -2.8, 14); ib.rotation.x = Math.PI / 2; c.cyl(0.2, 0.08, DG, 0, 1.3, -2.55, 14).rotation.x = Math.PI / 2;
        rbx(0.56, 0.56, 1.1, 0.06, LG, 0, 1.55, -0.3); for (var sl = -0.75; sl < 0.15; sl += 0.12) c.box(0.58, 0.03, 0.04, MAT.black, 0, 1.75, sl); for (var sl2 = -0.75; sl2 < 0.15; sl2 += 0.12) c.box(0.58, 0.03, 0.04, MAT.black, 0, 1.35, sl2);
        var nz = c.cyl(0.06, 0.4, CH, 0, 1.55, 0.35, 10); nz.rotation.x = Math.PI / 2; c.cyl(0.1, 0.1, DG, 0, 1.55, 0.25, 10).rotation.x = Math.PI / 2;
        // the clamp: fixed platen, four tie bars with nuts, the moving platen on the toggles, the rear platen and its cylinder
        rbx(1.5, 1.5, 0.25, 0.03, DG, 0, 1.3, 0.6);
        // the rear platen is an open frame standing on the floor: the finished part slides out through the opening onto the belt
        rbx(0.4, 2.05, 0.22, 0.03, DG, -0.55, 1.025, 2.5); rbx(0.4, 2.05, 0.22, 0.03, DG, 0.55, 1.025, 2.5); rbx(1.5, 0.4, 0.22, 0.03, DG, 0, 1.85, 2.5); c.box(0.5, 0.04, 0.5, DG, -0.55, 0.02, 2.5); c.box(0.5, 0.04, 0.5, DG, 0.55, 0.02, 2.5);
        c.box(0.74, 0.06, 0.06, MAT.hazard, 0, 1.62, 2.63); c.box(0.06, 1.62, 0.06, MAT.hazard, -0.38, 0.81, 2.63); c.box(0.06, 1.62, 0.06, MAT.hazard, 0.38, 0.81, 2.63); c.sign(['PARTS OUT'], 0.5, 0.12, 0, 1.72, 2.64, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
        c.cyl(0.14, 0.45, BL, 0, 1.85, 2.85, 14).rotation.x = Math.PI / 2; c.cyl(0.06, 0.4, CH, 0, 1.85, 3.05, 10).rotation.x = Math.PI / 2;
        [[-0.58, 0.72], [0.58, 0.72], [-0.58, 1.88], [0.58, 1.88]].forEach(function (t) { var tb = c.cyl(0.045, 2.2, CH, t[0], t[1], 1.55, 12); tb.rotation.x = Math.PI / 2; [0.42, 2.68].forEach(function (nz2) { c.cyl(0.09, 0.12, DG, t[0], t[1], nz2, 8).rotation.x = Math.PI / 2; }); });
        var ram = rbx(1.36, 1.36, 0.2, 0.03, DG, 0, 1.3, 1.25, dyn); rbx(0.64, 0.74, 0.16, 0.02, MAT_MACH.roller, 0, 0, -0.18, ram); c.box(0.06, 0.06, 0.06, MAT.black, 0, 0, 0, ram);
        rbx(0.64, 0.74, 0.16, 0.02, MAT_MACH.roller, 0, 1.3, 0.81); c.box(0.5, 0.06, 0.04, MAT.black, 0, 1.0, 0.9);
        [[-0.45, 1.0], [0.45, 1.0], [-0.45, 1.6], [0.45, 1.6]].forEach(function (l) { var lk = c.box(0.08, 0.06, 0.6, DG, l[0], l[1], 1.85, 0); lk.rotation.x = l[1] > 1.3 ? 0.5 : -0.5; var lk2 = c.box(0.08, 0.06, 0.6, DG, l[0], l[1], 2.15); lk2.rotation.x = l[1] > 1.3 ? -0.5 : 0.5; });
        c.cyl(0.05, 1.3, CH, 0, 1.3, 1.9, 8).rotation.z = Math.PI / 2;
        // the guards: a sliding gate with a window on the operator side, a fixed sheet with a window on the other, a top cover carrying the lamp stack
        var GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        c.box(0.05, 1.7, 2.1, MAT_MACH.guard, 0.82, 1.35, 1.55); c.box(0.05, 1.7, 2.1, LG, 0.84, 1.35, 1.55); c.plane(1.3, 0.9, GL, 0.87, 1.45, 1.55, 0, Math.PI / 2); c.box(0.06, 0.08, 1.4, DG, 0.87, 0.95, 1.55); c.box(0.06, 0.08, 1.4, DG, 0.87, 1.95, 1.55); c.box(0.06, 1.0, 0.08, DG, 0.87, 1.45, 0.85); c.box(0.06, 1.0, 0.08, DG, 0.87, 1.45, 2.25); c.box(0.08, 0.3, 0.04, MAT.black, 0.9, 1.3, 2.1);
        c.box(0.05, 1.7, 2.1, LG, -0.84, 1.35, 1.55); c.plane(0.9, 0.6, GL, -0.87, 1.5, 1.55, 0, -Math.PI / 2); c.box(0.06, 0.06, 1.0, DG, -0.87, 1.2, 1.55); c.box(0.06, 0.06, 1.0, DG, -0.87, 1.8, 1.55);
        rbx(1.7, 0.06, 2.2, 0.02, LG, 0, 2.22, 1.55); c.box(1.7, 0.04, 0.1, DG, 0, 2.2, 0.5); c.box(1.7, 0.04, 0.1, DG, 0, 2.2, 2.6);
        MACH.moulder.lamps = lampStack(c, -0.5, 2.25, 0.7); var spin = cyl(0.07, 0.1, glowMat(0xf5b53d, 1.0), 0.5, 2.3, 0.7, dyn, 10); box(0.03, 0.12, 0.03, MAT.black, 0.05, 0, 0, spin); c.cyl(0.02, 0.1, DG, 0.5, 2.25, 0.7, 6);
        // the operator panel on a swing arm, with the touchscreen and the E-stop
        c.box(0.08, 0.5, 0.08, DG, 0.9, 1.25, -0.3); var arm = c.box(0.45, 0.06, 0.06, DG, 1.1, 1.5, -0.3); c.box(0.08, 0.4, 0.08, DG, 1.32, 1.3, -0.3);
        rbx(0.1, 0.62, 0.5, 0.02, LG, 1.37, 1.05, -0.3); var scr = touchScreen({ w: 400, h: 260, pw: 0.42, ph: 0.28, x: 1.43, y: 1.12, z: -0.3, ry: Math.PI / 2, parent: c.group, title: 'Moulding line', draw: moulderScreenDraw }); scr.mesh.userData.propId = 'moulder';
        c.box(0.04, 0.1, 0.1, MAT.yellow, 1.43, 0.8, -0.45); c.cyl(0.03, 0.03, MAT.red, 1.46, 0.8, -0.45, 10).rotation.z = Math.PI / 2; c.box(0.04, 0.03, 0.03, glowMat(0x5fd38d, 1.2), 1.43, 0.8, -0.2);
        // the hydraulic power unit behind, the water manifold with its hoses to the mould, the outfeed chute to the belt
        rbx(1.1, 0.7, 0.8, 0.04, DG, 0, 0.75, -2.95); var mot = cyl(0.2, 0.6, BL, -0.25, 1.4, -2.95, dyn, 14); mot.rotation.z = Math.PI / 2; c.cyl(0.22, 0.05, MAT.black, -0.58, 1.4, -2.95, 14).rotation.z = Math.PI / 2; rbx(0.4, 0.4, 0.5, 0.04, LG, 0.3, 1.3, -2.95); c.cyl(0.05, 0.03, MAT.white, 0.3, 1.5, -2.69, 10).rotation.x = Math.PI / 2; c.cyl(0.04, 0.3, MAT.black, 0.3, 1.1, -2.69, 8);
        [[0.3, 1.2, -2.4, 0.7], [-0.3, 1.0, -2.3, -0.6]].forEach(function (h) { var hs = c.cyl(0.03, 1.2, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
        c.box(0.3, 0.2, 0.12, BL, -0.9, 0.95, 0.3); for (var hh = 0; hh < 4; hh++) { var wh = c.cyl(0.012, 1.0, hh % 2 ? MAT.red : MAT.blue, -0.85 + hh * 0.04, 1.0 + hh * 0.05, 0.75, 6); wh.rotation.x = Math.PI / 2 - 0.3; }
        var chute = c.box(0.62, 0.03, 1.5, MAT_MACH.roller, 0, 0.95, 1.65); chute.rotation.x = 0.2; c.box(0.03, 0.14, 1.5, MAT_MACH.guard, -0.31, 1.02, 1.65).rotation.x = 0.2; c.box(0.03, 0.14, 1.5, MAT_MACH.guard, 0.31, 1.02, 1.65).rotation.x = 0.2; c.box(0.6, 0.02, 0.3, MAT_MACH.roller, 0, 0.8, 2.45);
        conveyorBuild(c, 0, 2.4, 4.4, {});
        c.sign(['DC-IMM 180', 'MOULDING LINE 1'], 0.9, 0.3, -0.84, 1.75, -1.7, -Math.PI / 2, { w: 512, h: 170, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['⚠ HOT SURFACE'], 0.5, 0.14, 0.61, 1.2, -1.2, Math.PI / 2, { w: 256, h: 72, bg: '#f5b53d', fg: '#1a1205' });
        MACH.moulder.anim = { ram: ram, wheel: mot, spin: spin };
        c.hit(2.6, 2.6, 6.0, 0.2, 1.3, -0.2, { prompt: function () { return moulderPrompt(); }, use: function () { moulderUse(); } });
        c.solid(-0.9, 0.9, -3.4, 2.4, 0, 2.6); c.solid(0.9, 1.5, -0.6, 0.0, 0, 2.0);
      }
    /* 06-props2-factory.js */
    function hopperBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame, hdyn = new THREE.Group(); hdyn.userData.dynamic = true; c.group.add(hdyn);
        // legs: square section with footplates and bolts, cross bracing on every face, a ring girder under the cone
        var L = 2.3; [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(function (p) { c.box(0.16, L, 0.16, DG, p[0], L / 2, p[1]); c.box(0.36, 0.03, 0.36, DG, p[0], 0.015, p[1]); [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(function (b) { c.cyl(0.02, 0.05, MAT.chrome, p[0] + b[0], 0.04, p[1] + b[1], 6); }); });
        [[0, -0.85, 0], [0, 0.85, 0], [-0.85, 0, 1], [0.85, 0, 1]].forEach(function (f) { var d1 = c.box(0.06, 2.3, 0.02, DG, f[0], L / 2, f[1]); var d2 = c.box(0.06, 2.3, 0.02, DG, f[0], L / 2, f[1]); if (f[2]) { d1.rotation.y = Math.PI / 2; d2.rotation.y = Math.PI / 2; d1.rotation.x = 0.63; d2.rotation.x = -0.63; } else { d1.rotation.z = 0.63; d2.rotation.z = -0.63; } c.box(f[2] ? 0.08 : 1.86, 0.08, f[2] ? 1.86 : 0.08, DG, f[0], 1.0, f[1]); });
        c.box(1.9, 0.12, 0.12, DG, 0, L - 0.06, -0.85); c.box(1.9, 0.12, 0.12, DG, 0, L - 0.06, 0.85); c.box(0.12, 0.12, 1.9, DG, -0.85, L - 0.06, 0); c.box(0.12, 0.12, 1.9, DG, 0.85, L - 0.06, 0);
        // the bin: cone, drum with stiffening bands, a lid with a loader flange, a sight glass strip and a level gauge line
        c.cyl(1.05, 1.3, LG, 0, 2.95, 0, 24, 0.18); c.cyl(1.05, 1.5, LG, 0, 4.35, 0, 24); c.cyl(1.05, 0.08, LG, 0, 5.14, 0, 24); c.cyl(0.95, 0.2, DG, 0, 5.2, 0, 24, 0.3); c.cyl(0.25, 0.25, DG, 0, 5.38, 0, 12);
        [3.7, 4.3, 4.9].forEach(function (y) { var hb = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.035, 6, 32), DG); hb.position.y = y; hb.rotation.x = Math.PI / 2; c.group.add(hb); });
        c.box(0.12, 1.3, 0.02, MAT.glass, 0, 4.35, 1.06); c.box(0.16, 1.34, 0.01, DG, 0, 4.35, 1.05);
        // the discharge: a butterfly valve with a handle, the rotary feeder, the vacuum loader pipe up and over to the moulder
        c.cyl(0.2, 0.25, DG, 0, 2.18, 0, 12); c.cyl(0.26, 0.05, DG, 0, 2.08, 0, 12); c.cyl(0.26, 0.05, DG, 0, 1.96, 0, 12); c.box(0.35, 0.04, 0.04, MAT.red, 0.2, 2.02, 0.15); c.cyl(0.2, 0.2, DG, 0, 1.85, 0, 12);
        var feeder = box(0.6, 0.5, 0.5, MAT_MACH.blue, 0, 1.5, 0, hdyn); var fm = c.cyl(0.12, 0.3, DG, 0.45, 1.5, 0, 12); fm.rotation.z = Math.PI / 2; c.cyl(0.14, 0.05, MAT.black, 0.62, 1.5, 0, 12).rotation.z = Math.PI / 2;
        c.cyl(0.12, 0.5, MAT.steel, 0, 1.5, 0.45, 12).rotation.x = Math.PI / 2; var r1 = c.cyl(0.12, 1.1, MAT.steel, 0.3, 2.0, 0.9, 12); r1.rotation.set(0, 0, 0); c.cyl(0.14, 0.1, MAT.steel, 0.3, 1.5, 0.9, 12); c.cyl(0.14, 0.1, MAT.steel, 0.3, 2.5, 0.9, 12);
        var pipe = c.cyl(0.12, 5.2, MAT.steel, 2.9, 2.55, 0.9, 12); pipe.rotation.z = Math.PI / 2; c.cyl(0.13, 0.3, MAT.steel, 0.55, 2.55, 0.9, 12).rotation.z = Math.PI / 2; var drop = c.cyl(0.12, 0.9, MAT.steel, 5.5, 3.0, 0.9, 12); c.cyl(0.14, 0.1, MAT.steel, 5.5, 2.5, 0.9, 12);
        [1.8, 3.6].forEach(function (sx) { c.box(0.06, 0.4, 0.06, DG, sx, 2.25, 0.9); c.box(0.06, 0.06, 0.4, DG, sx, 2.05, 0.9); c.box(0.3, 0.06, 0.06, DG, sx, 2.72, 0.9); });
        // the caged ladder on the +z side, up to the lid
        [-0.22, 0.22].forEach(function (x) { c.box(0.05, 5.0, 0.05, DG, x, 2.55, 1.2); }); for (var r = 0.3; r < 5.1; r += 0.3) c.box(0.5, 0.03, 0.03, DG, 0, r, 1.2);
        for (var cg = 2.4; cg < 5.2; cg += 0.7) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.2); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); } [-0.42, 0, 0.42].forEach(function (sx2) { c.box(0.04, 3.0, 0.03, MAT_MACH.guard, sx2, 3.8, 1.2 + (sx2 === 0 ? 0.42 : 0)); });
        c.box(0.6, 0.04, 0.5, DG, 0, 5.25, 1.3); c.box(0.03, 0.9, 0.03, DG, -0.3, 5.7, 1.55); c.box(0.03, 0.9, 0.03, DG, 0.3, 5.7, 1.55); c.box(0.64, 0.03, 0.03, DG, 0, 6.15, 1.55);
        // the level gauge cabinet on a bracket between two legs, the tip point in front: a steel kerb, hazard plate, the sign on a stand
        c.box(0.6, 0.06, 0.4, DG, -1.2, 1.0, 0.85); c.box(0.06, 1.0, 0.06, DG, -1.45, 0.5, 0.85); c.box(0.06, 1.0, 0.06, DG, -0.95, 0.5, 0.85);
        cabinet(c, -1.2, 1.35, 0.85, 0.44, 0.6, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: -1.2, y: 1.45, z: 0.965, ry: 0, parent: c.group, title: 'Hopper', draw: hopperScreenDraw }); scr.mesh.userData.propId = 'hopper';
        MACH.hopper.lamps = lampStack(c, -1.2, 1.7, 0.85);
        c.box(2.4, 0.012, 1.6, MAT.hazard, 0, 0.006, -1.9); c.box(2.4, 0.1, 0.1, MAT.yellow, 0, 0.05, -2.7); c.box(0.1, 0.1, 1.6, MAT.yellow, -1.2, 0.05, -1.9); c.box(0.1, 0.1, 1.6, MAT.yellow, 1.2, 0.05, -1.9);
        c.cyl(0.02, 1.3, DG, 1.5, 0.65, -1.2, 8); c.cyl(0.12, 0.03, DG, 1.5, 0.015, -1.2, 12); c.sign(['TIP POINT', 'raw granulate pallets only'], 0.7, 0.36, 1.5, 1.4, -1.2, Math.PI, { w: 384, h: 200, bg: '#f5b53d', fg: '#1a1205' });
        MACH.hopper.anim = { feeder: feeder, tipT: 0 };
        c.hit(2.6, 2.6, 4.0, 0, 1.3, -0.6, { prompt: function () { return hopperPrompt(); }, use: function () { hopperUse(); } });
        c.solid(-1.0, 1.0, -1.0, 1.4, 0, 2.3); c.solid(-1.5, -0.9, 0.7, 1.0, 0, 1.8);
      }
    /* 06-props2-factory.js */
    function palletiserBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        c.box(2.6, 0.08, 2.6, DG, 0, 0.04, 0); c.box(2.62, 0.03, 2.62, MAT.hazard, 0, 0.085, 0);
        [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.2, 3.0, 0.2, MAT_MACH.blue, p[0], 1.5, p[1]); c.box(0.36, 0.04, 0.36, DG, p[0], 0.1, p[1]); });
        c.box(2.4, 0.2, 0.2, MAT_MACH.blue, 0, 3.0, -1.1); c.box(2.4, 0.2, 0.2, MAT_MACH.blue, 0, 3.0, 1.1); c.box(0.2, 0.2, 2.4, MAT_MACH.blue, -1.1, 3.0, 0); c.box(0.2, 0.2, 2.4, MAT_MACH.blue, 1.1, 3.0, 0);
        c.box(0.06, 2.6, 0.06, DG, -1.1, 1.5, 0); c.box(0.06, 0.06, 2.2, DG, -1.1, 2.0, 0); c.plane(2.2, 1.6, MAT.mesh, -1.12, 1.9, 0, 0, Math.PI / 2);
        // the pusher on its gantry: a carriage on two rails, a vertical ram, the plate
        c.box(0.12, 0.12, 2.3, DG, -0.5, 2.85, 0); c.box(0.12, 0.12, 2.3, DG, 0.5, 2.85, 0); c.box(1.2, 0.3, 0.6, LG, 0, 2.72, 0); c.cyl(0.09, 0.9, MAT.chrome, 0, 2.2, 0, 10); c.box(1.0, 0.1, 1.0, LG, 0, 1.75, 0); c.box(0.9, 0.04, 0.9, MAT_MACH.rubber, 0, 1.68, 0);
        for (var rz = -0.75; rz <= 0.75; rz += 0.15) { var r = c.cyl(0.03, 1.5, MAT_MACH.roller, 0, 0.3, rz, 8); r.rotation.z = Math.PI / 2; } c.box(1.6, 0.06, 0.06, DG, 0, 0.33, -0.82); c.box(1.6, 0.06, 0.06, DG, 0, 0.33, 0.82); [-0.78, 0.78].forEach(function (x) { c.box(0.06, 0.3, 1.7, DG, x, 0.18, 0); });
        for (var iz = -1.6; iz < -0.9; iz += 0.12) { var ir = c.cyl(0.03, 0.62, MAT_MACH.roller, 0, BELT_Y - 0.02, iz, 8); ir.rotation.z = Math.PI / 2; } c.box(0.05, 0.1, 0.8, DG, -0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.1, 0.8, DG, 0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.7, 0.05, DG, -0.3, 0.35, -1.5); c.box(0.05, 0.7, 0.05, DG, 0.3, 0.35, -1.5);
        var slide = c.box(0.7, 0.03, 0.5, MAT_MACH.roller, 0, 0.55, -0.95); slide.rotation.x = -0.5;
        [-1.3, 1.3].forEach(function (x) { c.box(0.08, 1.8, 0.08, MAT.yellow, x, 0.9, -1.25); c.box(0.02, 1.6, 0.02, glowMat(0xff3b2f, 0.6), x, 0.9, -1.2); });
        var cab = new THREE.Mesh(bevelGeo(0.5, 1.4, 0.4, 0.03), LG); cab.position.set(1.4, 0.8, 0.6); c.group.add(cab); c.box(0.52, 0.2, 0.42, DG, 1.4, 0.1, 0.6); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.4, y: 1.15, z: 0.81, ry: 0, parent: c.group, title: 'Palletiser', draw: palletiserScreenDraw }); scr.mesh.userData.propId = 'palletiser';
        eStop(c, 1.4, 0.75, 0.81); MACH.palletiser.lamps = lampStack(c, 1.4, 1.5, 0.6);
        c.box(1.6, 0.012, 1.4, MAT.hazard, 2.4, 0.006, 0); c.sign(['PALLET DROP · KEEP CLEAR'], 1.4, 0.16, 2.4, 0.008, -0.8, 0, { w: 512, h: 56, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }).rotation.x = -Math.PI / 2;
        c.sign(['PALLETISER'], 1.6, 0.4, 0, 3.3, 0, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
        c.hit(2.6, 3.2, 2.6, 0, 1.6, 0, { prompt: function () { return palletiserPrompt(); }, use: function () { palletiserUse(); } });
        c.solid(-1.2, 1.2, -1.2, 1.2, 0, 3); c.solid(-0.4, 0.4, -1.7, -1.2, 0, 0.9); c.solid(1.15, 1.65, 0.4, 0.8, 0, 1.8);
      }
    /* 06-props2-factory.js */
    function beltMainBuild(c) { conveyorBuild(c, 0, 0, 10.4, {}); c.box(0.8, 0.03, 0.04, MAT.hazard, 0, 1.6, 8.5); }
    /* 06-props2-factory.js */
    function siloBuild(c) {
        [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.16, 3.2, 0.16, MAT_MACH.frame, p[0], 1.6, p[1]); c.box(0.5, 0.05, 0.5, MAT.grey, p[0], 0.02, p[1]); });
        c.cyl(1.5, 1.6, MAT_MACH.panel, 0, 4.0, 0, 24, 0.3); c.cyl(1.5, 5.2, MAT_MACH.panel, 0, 7.4, 0, 24); c.cyl(1.5, 0.6, MAT_MACH.panel, 0, 10.3, 0, 24, 0.2); c.cyl(0.25, 0.4, MAT_MACH.frame, 0, 10.8, 0, 12);
        for (var r = 4.9; r < 10; r += 1.3) { var ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 32), MAT_MACH.frame); ring.position.y = r; ring.rotation.x = Math.PI / 2; c.group.add(ring); }
        [-0.2, 0.2].forEach(function (x) { c.box(0.05, 10, 0.05, MAT_MACH.frame, x, 5.0, 1.62); }); for (var lr = 0.4; lr < 10; lr += 0.3) c.box(0.44, 0.03, 0.03, MAT_MACH.frame, 0, lr, 1.62); for (var cg = 3; cg < 10; cg += 0.6) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.62); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); }
        var out = c.cyl(0.16, 2.2, MAT.steel, 1.1, 2.4, 0, 12); out.rotation.z = -0.9; c.box(0.6, 0.5, 0.4, MAT_MACH.blue, 0, 2.6, 0); c.cyl(0.12, 0.06, MAT.white, 0.8, 5.5, 1.3, 12).rotation.x = Math.PI / 2;
        c.sign(['RAW GRANULATE · 40 t'], 2.0, 0.5, 0, 6.5, 1.52, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }); c.box(1.2, 0.012, 1.2, MAT.hazard, 2.4, 0.006, 0);
        c.solid(-1.6, 1.6, -1.6, 1.8, -2, 12);
      }
    /* 06-props2-factory.js */
    function qcBenchBuild(c) {
        c.box(1.6, 0.05, 0.7, std({ color: 0x3a3e45, roughness: 0.35 }), 0, 0.9, 0); [[-0.72, -0.28], [0.72, -0.28], [-0.72, 0.28], [0.72, 0.28]].forEach(function (p) { c.box(0.05, 0.9, 0.05, MAT_MACH.frame, p[0], 0.45, p[1]); }); c.box(1.5, 0.04, 0.6, MAT_MACH.frame, 0, 0.3, 0);
        c.box(0.04, 0.4, 0.56, MAT.black, 0.55, 1.18, -0.1); var scr = touchScreen({ w: 320, h: 220, pw: 0.5, ph: 0.34, x: 0.53, y: 1.2, z: -0.1, ry: -Math.PI / 2, parent: c.group, title: 'Quality station', draw: qcScreenDraw }); scr.mesh.userData.propId = 'qcBench'; c.box(0.2, 0.03, 0.2, MAT_MACH.frame, 0.55, 0.93, -0.1);
        c.box(0.34, 0.03, 0.14, MAT.black, -0.1, 0.94, 0.15); c.box(0.08, 0.02, 0.1, MAT.chrome, -0.5, 0.93, 0.2); c.cyl(0.01, 0.3, MAT.chrome, -0.5, 0.93, 0.05, 6).rotation.x = Math.PI / 2;
        c.box(0.26, 0.2, 0.26, std({ color: 0x2f6b9a, roughness: 0.6 }), -0.4, 1.03, -0.15); c.box(0.22, 0.14, 0.22, std({ color: 0x6b8e23, roughness: 0.6 }), -0.05, 1.0, -0.2); c.cyl(0.12, 0.12, std({ color: 0xb5651d, roughness: 0.6 }), 0.25, 0.99, -0.2, 12, 0.09);
        c.box(0.3, 0.02, 0.2, MAT.paper, 0.1, 0.93, 0.22); c.cyl(0.006, 0.14, MAT.black, 0.18, 0.95, 0.24, 6).rotation.x = Math.PI / 2;
        c.cyl(0.16, 0.04, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.62, 0.7, 14); c.cyl(0.02, 0.6, MAT_MACH.frame, 0, 0.3, 0.7, 8); c.cyl(0.2, 0.02, MAT_MACH.frame, 0, 0.01, 0.7, 14);
        c.sign(['QUALITY', 'first-off checks every batch'], 1.0, 0.3, 0, 1.9, -0.36, 0, { w: 512, h: 150, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-0.8, 0.8, -0.35, 0.35, 0, 1.0);
      }
    /* 06-props2-factory.js */
    function qcScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'QUALITY', factoryStatus().toUpperCase()); scText(c, 16, 70, 'Product: ' + skuName(F.product), '#eef1f5', 15); scText(c, 16, 92, 'Made ' + F.made + ' · hopper ' + F.raw, '#a0acb8', 13); scText(c, 16, 114, 'Weight 412 g · wall 2.1 mm · OK', '#5fd38d', 13); scText(c, 16, 136, 'Shrink 0.4% · flash none', '#5fd38d', 13); scText(c, 16, 170, 'Last check day ' + S.day + ' ' + fmtTime(Math.floor(S.time)), '#6b7784', 11); }
    /* 06-props2-factory.js */
    function toolCabBuild(c) {
        var RED = std({ color: 0xb3261e, roughness: 0.45, metalness: 0.3 }); var body = new THREE.Mesh(bevelGeo(0.9, 1.0, 0.5, 0.02), RED); body.position.set(0, 0.55, 0); body.castShadow = true; c.group.add(body); c.box(0.92, 0.04, 0.52, MAT.black, 0, 1.07, 0);
        for (var d = 0; d < 5; d++) { c.box(0.8, 0.14, 0.02, RED, 0, 0.22 + d * 0.17, 0.26); c.box(0.4, 0.02, 0.03, MAT.chrome, 0, 0.26 + d * 0.17, 0.28); } [-0.35, 0.35].forEach(function (x) { [-0.18, 0.18].forEach(function (z) { c.cyl(0.05, 0.04, MAT.black, x, 0.02, z, 10).rotation.x = Math.PI / 2; }); });
        c.box(0.3, 0.05, 0.3, MAT.black, -0.2, 1.12, 0); c.cyl(0.02, 0.3, MAT.chrome, 0.25, 1.24, 0.1, 6).rotation.z = 0.3; c.box(0.12, 0.04, 0.03, MAT.chrome, 0.2, 1.1, 0.12);
        c.solid(-0.5, 0.5, -0.3, 0.3, 0, 1.2);
      }
    /* 06-props2-factory.js */
    function workbenchBuild(c) {
        c.box(2.0, 0.08, 0.8, MAT.wood, 0, 0.9, 0); [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]].forEach(function (p) { c.box(0.06, 0.9, 0.06, MAT_MACH.frame, p[0], 0.45, p[1]); }); c.box(1.9, 0.04, 0.7, MAT_MACH.frame, 0, 0.25, 0);
        c.box(0.3, 0.2, 0.2, MAT_MACH.frame, 0.6, 1.04, 0.2); c.box(0.08, 0.1, 0.24, MAT.chrome, 0.6, 1.1, 0.2); c.cyl(0.015, 0.3, MAT.chrome, 0.75, 1.08, 0.2, 6).rotation.z = Math.PI / 2;
        c.box(1.9, 1.0, 0.05, std({ color: 0xf0e6cf, roughness: 0.9 }), 0, 1.5, -0.4); for (var k = 0; k < 8; k++) { var tx = -0.8 + k * 0.23; c.cyl(0.01, 0.1, MAT.chrome, tx, 1.5, -0.33, 6).rotation.x = Math.PI / 2; c.box(0.04, 0.25 + (k % 3) * 0.08, 0.02, k % 2 ? MAT.black : MAT_MACH.frame, tx, 1.3, -0.33); }
        c.box(0.25, 0.1, 0.18, std({ color: 0x2f6b9a, roughness: 0.6 }), -0.6, 0.99, 0.1); c.box(0.2, 0.08, 0.12, MAT.yellow, -0.2, 0.98, 0.15); c.cyl(0.05, 0.14, MAT.white, 0.1, 1.01, -0.2, 10);
        c.sign(['MAINTENANCE'], 0.9, 0.22, 0, 2.2, -0.4, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-1.0, 1.0, -0.45, 0.4, 0, 1.0);
      }
    /* 06-props2-factory.js */
    function mouldRackBuild(c) {
        [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (p) { c.box(0.08, 2.0, 0.08, MAT_MACH.blue, p[0], 1.0, p[1]); }); [0.3, 1.0, 1.7].forEach(function (y) { c.box(1.9, 0.05, 0.9, MAT_MACH.frame, 0, y, 0); });
        [[-0.55, 0.3], [0.2, 0.3], [-0.5, 1.0], [0.3, 1.0], [-0.4, 1.7]].forEach(function (p, i) { c.box(0.6, 0.45, 0.6, MAT_MACH.roller, p[0], p[1] + 0.25, 0, 0); c.box(0.62, 0.04, 0.62, MAT_MACH.frame, p[0], p[1] + 0.49, 0); c.sign(['M-' + (i + 1)], 0.2, 0.08, p[0], p[1] + 0.25, 0.31, 0, { w: 128, h: 48, bg: '#f5b53d', fg: '#1a1205' }); });
        c.sign(['MOULD STORE'], 0.9, 0.22, 0, 2.15, 0.45, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' });
        c.solid(-1.0, 1.0, -0.5, 0.5, 0, 2.2);
      }
    /* 06-props2-factory.js */
    function chillerBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        var body = new THREE.Mesh(bevelGeo(2.2, 1.9, 1.1, 0.04), LG); body.position.set(0, 1.05, 0); body.castShadow = true; c.group.add(body); c.box(2.24, 0.12, 1.14, DG, 0, 0.06, 0); c.box(2.24, 0.06, 1.14, DG, 0, 2.03, 0);
        for (var g = -0.95; g < 0.95; g += 0.075) { c.box(0.03, 1.4, 0.02, DG, g, 1.05, 0.56); c.box(0.03, 1.4, 0.02, DG, g, 1.05, -0.56); }
        [-0.55, 0.55].forEach(function (x) { c.cyl(0.42, 0.06, DG, x, 2.09, 0, 24); var fan = c.cyl(0.34, 0.03, MAT.black, x, 2.13, 0, 20); for (var b = 0; b < 6; b++) { var bl = box(0.6, 0.01, 0.1, DG, 0, 0, 0, fan); bl.rotation.y = b * 1.047; } c.cyl(0.06, 0.08, MAT.black, x, 2.17, 0, 10); var guard = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 24), DG); guard.position.set(x, 2.2, 0); guard.rotation.x = Math.PI / 2; c.group.add(guard); for (var sp = 0; sp < 4; sp++) { var spk = box(0.8, 0.01, 0.02, DG, 0, 0, 0, fan); spk.position.y = 0.07; spk.rotation.y = sp * 0.785; } });
        c.box(0.6, 0.5, 1.0, DG, 1.4, 0.5, 0); var pump = c.cyl(0.18, 0.5, MAT_MACH.blue, 1.4, 0.95, 0, 14); pump.rotation.z = Math.PI / 2; c.cyl(0.08, 0.3, DG, 1.4, 1.2, 0, 10);
        cabinet(c, -0.6, 1.3, 0.62, 0.5, 0.6, 0.12); c.plane(0.3, 0.14, MAT.screen, -0.6, 1.4, 0.69, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), -0.75, 1.15, 0.69); c.box(0.04, 0.04, 0.02, glowMat(0xf5b53d, 1.2), -0.68, 1.15, 0.69);
        [[-0.8, MAT.blue], [-0.6, MAT.red]].forEach(function (p) { var pp = c.cyl(0.05, 1.2, p[1], p[0], 0.5, -0.9, 10); pp.rotation.x = Math.PI / 2; var pd = c.cyl(0.05, 0.9, p[1], p[0], 0.45, -1.5, 10); c.cyl(0.07, 0.06, DG, p[0], 0.5, -1.5, 10); });
        c.box(0.7, 0.2, 0.3, MAT_MACH.blue, -0.7, 0.1, -1.5); c.sign(['CHILLER · 12 kW · 10 °C'], 1.1, 0.14, 0.3, 1.75, 0.57, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-1.15, 1.75, -0.6, 0.6, 0, 2.3);
      }
    /* 06-props2-factory.js */
    function dryerBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        var cab = new THREE.Mesh(bevelGeo(1.2, 1.5, 0.9, 0.04), LG); cab.position.set(0, 0.85, 0); cab.castShadow = true; c.group.add(cab); c.box(1.24, 0.12, 0.94, DG, 0, 0.06, 0); c.box(1.24, 0.06, 0.94, DG, 0, 1.63, 0);
        c.box(0.5, 1.1, 0.02, std({ color: 0xcfd4d9, roughness: 0.5 }), -0.3, 0.85, 0.46); c.box(0.03, 0.12, 0.03, MAT.chrome, -0.1, 0.85, 0.48); c.plane(0.3, 0.16, MAT.screen, 0.3, 1.25, 0.465, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.18, 1.0, 0.465); c.box(0.04, 0.04, 0.02, glowMat(0xf5b53d, 1.2), 0.28, 1.0, 0.465); eStop(c, 0.42, 0.95, 0.465);
        [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].forEach(function (p) { c.box(0.1, 0.9, 0.1, DG, p[0], 2.1, p[1]); }); c.box(1.1, 0.08, 0.9, DG, 0, 2.55, 0);
        c.cyl(0.55, 0.7, LG, 0, 2.3, 0, 18, 0.14); c.cyl(0.55, 1.3, LG, 0, 3.3, 0, 18); [2.9, 3.5].forEach(function (y) { var b = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 24), DG); b.position.y = y; b.rotation.x = Math.PI / 2; c.group.add(b); });
        c.cyl(0.55, 0.06, LG, 0, 3.98, 0, 18); c.cyl(0.45, 0.2, DG, 0, 4.05, 0, 18, 0.3); c.cyl(0.14, 0.2, DG, 0, 4.2, 0, 12); c.box(0.4, 0.3, 0.3, MAT_MACH.blue, 0, 4.3, -0.5); c.box(0.08, 0.5, 0.08, DG, 0, 3.9, -0.5);
        c.box(0.5, 0.6, 0.5, DG, 0.95, 0.95, 0); c.cyl(0.2, 0.4, MAT.black, 0.95, 1.4, 0, 14); c.cyl(0.14, 0.5, LG, 0.95, 1.85, 0, 12); c.cyl(0.16, 0.05, DG, 0.95, 2.1, 0, 12);
        var h1 = c.cyl(0.05, 2.2, MAT.black, 0.75, 3.2, 0.3, 8); h1.rotation.z = 0.35; var h2 = c.cyl(0.05, 1.4, MAT.black, 0.6, 1.0, 0.5, 8); h2.rotation.z = -0.5;
        c.sign(['GRANULATE DRYER', 'desiccant · 80 °C'], 0.8, 0.26, -0.1, 1.5, 0.47, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-0.65, 1.25, -0.5, 0.5, 0, 2.0);
      }
    /* 06-props2-factory.js */
    function switchboardBuild(c) {
        c.box(1.4, 1.8, 0.25, std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }), 0, 1.4, -0.12); c.box(1.42, 0.05, 0.27, MAT_MACH.frame, 0, 2.3, -0.12);
        [-0.35, 0.35].forEach(function (x) { c.box(0.62, 1.6, 0.02, std({ color: 0xcfd4d9, roughness: 0.5 }), x, 1.4, 0.01); c.box(0.03, 0.1, 0.03, MAT.chrome, x + 0.25, 1.4, 0.03); });
        for (var k = 0; k < 6; k++) { c.box(0.06, 0.1, 0.03, k < 4 ? MAT.black : MAT.red, -0.6 + k * 0.1, 2.05, 0.025); } c.box(0.14, 0.14, 0.05, MAT.red, 0.4, 2.05, 0.03); c.cyl(0.04, 0.04, MAT.black, 0.4, 2.05, 0.06, 10).rotation.x = Math.PI / 2; c.box(0.02, 0.08, 0.02, glowMat(0x5fd38d, 1.2), -0.5, 1.85, 0.03);
        c.sign(['⚡ 400 V · ISOLATE BEFORE OPENING'], 1.2, 0.14, 0, 0.9, 0.025, 0, { w: 512, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['PRODUCTION DB'], 0.8, 0.16, 0, 2.2, 0.025, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
        for (var t = 0; t < 4; t++) c.cyl(0.03, 1.5, MAT.black, -0.4 + t * 0.25, 3.0, -0.1, 6);
        c.solid(-0.7, 0.7, -0.25, 0.05, 0, 2.4);
      }
    /* 06-props2-factory.js */
    function partsShelfBuild(c) {
        [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]].forEach(function (p) { c.box(0.05, 2.0, 0.05, MAT_MACH.frame, p[0], 1.0, p[1]); }); [0.1, 0.6, 1.1, 1.6].forEach(function (y) { c.box(1.85, 0.03, 0.65, MAT_MACH.frame, 0, y, 0); });
        if (!partsShelfBuild.mats) partsShelfBuild.mats = [0x2f6b9a, 0xb3261e, 0xf5b53d, 0x6b8e23, 0x3a4149].map(function (col) { return std({ color: col, roughness: 0.6 }); });   // five materials for the 24 bins, not 24
        for (var s = 0; s < 4; s++) for (var b = 0; b < 6; b++) { var bm = partsShelfBuild.mats[(s + b) % 5]; c.box(0.26, 0.2, 0.4, bm, -0.75 + b * 0.3, 0.1 + s * 0.5 + 0.12, 0.05); }
        c.sign(['SPARES'], 0.6, 0.18, 0, 2.15, 0.33, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-0.95, 0.95, -0.35, 0.35, 0, 2.1);
      }
    /* 06-props2-factory.js */
    function shiftBoardBuild(c) { c.box(1.6, 1.0, 0.04, MAT.white, 0, 1.9, 0); c.box(1.64, 1.04, 0.02, MAT_MACH.frame, 0, 1.9, -0.015); var scr = touchScreen({ w: 400, h: 250, pw: 1.5, ph: 0.92, x: 0, y: 1.9, z: 0.025, ry: 0, parent: c.group, title: 'Shift board', draw: function (cc, sc) { cc.fillStyle = '#f7f7f4'; cc.fillRect(0, 0, sc.w, sc.h); cc.fillStyle = '#1b232c'; cc.font = 'bold 26px Bahnschrift, Arial'; cc.fillText('SHIFT OUTPUT · DAY ' + S.day, 16, 36); cc.font = '18px Bahnschrift, Arial'; cc.fillStyle = '#2f6b9a'; cc.fillText('Boxes moulded today: ' + (S.factory.madeOn === S.day ? (S.factory.madeDay || 0) : 0) + ' · all time ' + S.factory.made, 16, 80); cc.fillText('Pallets finished: ' + (S.stats.palletised || 0), 16, 108); cc.fillText('Hopper: ' + S.factory.raw + ' units', 16, 136); cc.fillStyle = S.factory.jam ? '#b3261e' : '#1e7a3a'; cc.fillText('Jams: ' + (S.factory.jam ? 'LINE JAMMED' : 'none'), 16, 164); cc.fillStyle = '#6b7784'; cc.font = '14px Bahnschrift, Arial'; cc.fillText('Target 60 a day · keep the hopper above 40', 16, 220); } }); scr.mesh.userData.propId = 'shiftBoard'; c.box(0.4, 0.03, 0.06, MAT_MACH.frame, 0, 1.36, 0.03); c.cyl(0.01, 0.12, MAT.black, 0.1, 1.4, 0.05, 6).rotation.z = Math.PI / 2; }
    /* 06-props2-factory.js */
    function arcPath(dir) { var R = 1.5, pts = []; for (var k = 0; k <= 6; k++) { var a = k / 6 * Math.PI / 2; pts.push([dir * (R - R * Math.cos(a)), R * Math.sin(a), 0]); } return pts; }
    /* 06-props2-factory.js */
    var BELT_PIECES = {
        beltS2: { label: 'belt, 2 m', ico: '➖', price: 120, desc: 'A straight run.', path: [[0, 0, 0], [0, 2, 0]] },
        beltS4: { label: 'belt, 4 m', ico: '➖', price: 200, desc: 'A longer straight run.', path: [[0, 0, 0], [0, 4, 0]] },
        beltCL: { label: 'belt, curve left', ico: '↰', price: 220, desc: 'A quarter turn to the left.', path: arcPath(1) },
        beltCR: { label: 'belt, curve right', ico: '↱', price: 220, desc: 'A quarter turn to the right.', path: arcPath(-1) },
        beltUp: { label: 'belt, incline up', ico: '⬈', price: 260, desc: 'Climbs a metre over three.', path: [[0, 0, 0], [0, 3, 1]] },
        beltDown: { label: 'belt, incline down', ico: '⬊', price: 260, desc: 'Drops a metre over three.', path: [[0, 0, 0], [0, 3, -1]] },
        beltHigh: { label: 'belt, high run', ico: '⤒', price: 240, desc: 'A 4 m run hung from the roof two metres up, for crossing a lane. Two inclines reach it.', path: [[0, 0, 2.0], [0, 4, 2.0, 'hang']] }
      };
    /* 06-props2-factory.js */
    function beltPieceBuild(kind) { return function (c, P) { var h = P.h || 0, pts = BELT_PIECES[kind].path.map(function (p) { return [p[0], p[1], (p[2] || 0) + h, p[3]]; }); conveyorPath(c, pts); }; }
    /* 06-props2-factory.js */
    function wallSignBuild(lines, w, h, y, opt) { return function (c) { var o = {}; for (var k in opt) o[k] = opt[k]; if (o.plate === undefined) o.plate = true; c.sign(lines, w, h, 0, y, 0.012, 0, o); }; }
    /* 06-props2-factory.js */
    function floorSignBuild(lines, w, h, opt) { return function (c) { var m = c.sign(lines, w, h, 0, 0.008, 0, 0, opt); m.rotation.x = -Math.PI / 2; }; }
    /* 06-props2-factory.js */
    function exitSignBuild(c) { var m = c.sign(['EXIT'], 0.5, 0.2, 0, 2.6, 0.03, 0, { w: 256, h: 96, bg: '#1f7a3a', fg: '#dfffe8' }); m.renderOrder = 1; c.box(0.54, 0.24, 0.04, MAT.exit, 0, 2.6, 0); }
    /* 06-props3-halls.js */
    var HALLS = {
        hall2: { name: 'Returns hall', x0: 10.0, x1: HALL.x, z0: -44, z1: -HALL.z, door: { x0: 17.0, x1: 20.6, h: 4.2, z: -HALL.z }, rows: [], rowZ: [], rowX0: 12.5, bays: 7, dockRet: 0, lights: [[15, -39], [23, -39], [31, -39], [15, -29], [23, -29], [31, -29]] },
        hall3: { name: 'Hall 3', x0: -HALL.x, x1: -14.0, z0: -44, z1: -HALL.z, door: { x0: -28.5, x1: -26.0, h: 3.6, z: -HALL.z }, rows: [22, 23], rowZ: [-29.5, -38.5], rowX0: -33.0, bays: 5, lights: [[-31, -39], [-23, -39], [-17, -39], [-31, -29], [-23, -29], [-17, -29]], dockIn: 2 },
        hall4: { name: 'Hall 4', x0: -14, x1: 10, z0: -64, z1: -44, door: { x0: 5.0, x1: 8.6, h: 4.2, z: -44 }, rows: [24, 25], rowZ: [-50.5, -57.5], rowX0: -12.5, bays: 7, lights: [[-8, -59], [0, -59], [8, -59], [-8, -49], [0, -49], [8, -49]] }
      };
    /* 06-props3-halls.js */
    var HALL_OF_ROW = {};
    /* 06-props3-halls.js */
    function hallOwned(id) { return !!(S.up && S.up[id]); }
    /* 06-props3-halls.js */
    function hallOfRow(r) { return HALL_OF_ROW[r] || null; }
    /* 06-props3-halls.js */
    function isAnnexRow(r) { return r >= 20; }
    /* 06-props3-halls.js */
    function annexRowOwned(r) { var h = hallOfRow(r); return !!h && hallOwned(h); }
    /* 06-props3-halls.js */
    function rowBays(r) { var h = hallOfRow(r); if (h) return HALLS[h].bays; return BOOT_STAGE === 0 ? Math.min(RACK.bays, Math.max(1, S.level)) : RACK.bays; }
    /* 06-props3-halls.js */
    function rowLetter(r) { if (r === UPPER.row) return 'U'; if (isAnnexRow(r)) return 'HIJKLM'[r - 20]; return 'ABCDEF'[r]; }
    /* 06-props3-halls.js */
    function groundRows() { var out = []; for (var r = 0; r < S.up.rows; r++) out.push(r); for (var h in HALLS) if (hallOwned(h)) HALLS[h].rows.forEach(function (r) { out.push(r); }); return out; }
    /* 06-props3-halls.js */
    function slotTotal() { var n = 0; groundRows().forEach(function (r) { n += rowBays(r) * RACK.levels.length; }); if (upperOwned()) n += RACK.bays * UPPER.levels; return n; }
    /* 06-props3-halls.js */
    function inRectH(x, z, H) { return x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1; }
    /* 06-props3-halls.js */
    function inAnnex(x, z) { for (var h in HALLS) if (hallOwned(h) && inRectH(x, z, HALLS[h])) return h; return null; }
    /* 06-props3-halls.js */
    function hallSegs(a0, a1, cuts) { var out = [[a0, a1]]; cuts.forEach(function (cc) { var nx = []; out.forEach(function (s) { if (cc[1] <= s[0] || cc[0] >= s[1]) { nx.push(s); return; } if (cc[0] > s[0]) nx.push([s[0], cc[0]]); if (cc[1] < s[1]) nx.push([cc[1], s[1]]); }); out = nx; }); return out.filter(function (s) { return s[1] - s[0] > 0.3; }); }
    /* 06-props3-halls.js */
    function hallDado(len, DH) { var m = MAT.block.clone(); m.map = MAT.block.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.6, DH / 0.8); m.normalMap = MAT.block.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(len / 1.6, DH / 0.8); return m; }
    /* 06-props3-halls.js */
    function hallColumn(c, x, z, alongZ) {
        var FR = MAT.steelDark, h = HALL.h - 0.3; c.box(alongZ ? 0.26 : 0.02, h, alongZ ? 0.02 : 0.26, FR, x, h / 2, z);
        [-0.12, 0.12].forEach(function (o) { c.box(alongZ ? 0.02 : 0.3, h, alongZ ? 0.3 : 0.02, FR, x + (alongZ ? o : 0), h / 2, z + (alongZ ? 0 : o)); });
        c.box(0.42, 0.03, 0.42, FR, x, 0.015, z); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (b) { c.cyl(0.018, 0.03, MAT.chrome, x + b[0], 0.04, z + b[1], 6); });
        c.box(0.46, 0.5, 0.46, MAT.hazard, x, 0.28, z).castShadow = false; c.solid(x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0, h);
      }
    /* 06-props3-halls.js */
    function hallFace(c, axis, at, inward, a0, a1, cuts, opts) {
        var FR = MAT.steelDark, DH = 2.4, ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), off = at + inward * 0.17, full = a1 - a0, c0 = (a0 + a1) / 2;
        hallSegs(a0 + 0.3, a1 - 0.3, cuts).forEach(function (s) { var len = s[1] - s[0], mid = (s[0] + s[1]) / 2; if (axis === 'x') { c.plane(len, DH, hallDado(len, DH), off, DH / 2, mid, 0, ry); c.box(0.06, 0.05, len, FR, off + inward * 0.02, DH + 0.025, mid); } else { c.plane(len, DH, hallDado(len, DH), mid, DH / 2, off, 0, ry); c.box(len, 0.05, 0.06, FR, mid, DH + 0.025, off + inward * 0.02); } });
        var g = at + inward * 0.22; [5.2, 6.8].forEach(function (gy) { if (axis === 'x') c.box(0.06, 0.12, full, FR, g, gy, c0); else c.box(full, 0.12, 0.06, FR, c0, gy, g); });
        if (opts.tray) { var ty = at + inward * 0.35; if (axis === 'x') { c.box(0.3, 0.08, full - 1, FR, ty, 5.6, c0); for (var t = a0 + 1; t < a1; t += 2) c.box(0.3, 0.08, 0.04, FR, ty, 5.6, t); } else { c.box(full - 1, 0.08, 0.3, FR, c0, 5.6, ty); for (var t2 = a0 + 1; t2 < a1; t2 += 2) c.box(0.04, 0.08, 0.3, FR, t2, 5.6, ty); } }
        for (var p = a0 + 4; p < a1 - 1; p += 8) { if (cuts.some(function (cc) { return p > cc[0] - 0.6 && p < cc[1] + 0.6; })) continue; hallColumn(c, axis === 'x' ? at + inward * 0.42 : p, axis === 'x' ? p : at + inward * 0.42, axis === 'x'); }
        if (opts.windows) { var wy = 6.0, ww = 2.4, wh = 1.3, woff = at + inward * 0.2; for (var wp = a0 + 2; wp < a1 - 2; wp += 4) { if (cuts.some(function (cc) { return wp > cc[0] - 1.5 && wp < cc[1] + 1.5; })) continue; if (axis === 'x') { c.box(0.04, wh + 0.12, ww + 0.12, FR, woff - inward * 0.035, wy, wp); c.plane(ww, wh, MAT.skylight, woff, wy, wp, 0, ry); c.box(0.05, wh, 0.05, FR, woff + inward * 0.01, wy, wp); c.box(0.05, 0.05, ww, FR, woff + inward * 0.01, wy, wp); } else { c.box(ww + 0.12, wh + 0.12, 0.04, FR, wp, wy, woff - inward * 0.035); c.plane(ww, wh, MAT.skylight, wp, wy, woff, 0, ry); c.box(0.05, wh, 0.05, FR, wp, wy, woff + inward * 0.01); c.box(ww, 0.05, 0.05, FR, wp, wy, woff + inward * 0.01); } } }
      }
    /* 06-props3-halls.js */
    function hallBuild(id) { return function (c) {
        var H = HALLS[id], h = HALL.h, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2, wx = H.x1 - H.x0, wz = H.z1 - H.z0, FR = MAT.steelDark, D = H.door;
        var ownW = id !== 'hall2', ownE = id !== 'hall3';   // Hall 2 leans on the wing's east wall, Hall 3 on its west wall; those stand already
        c.box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.58, cz - 0.15);   // the plinth, its top a touch under the floor so the two never flicker
        var fl = c.plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2, 0); fl.receiveShadow = true;
        c.plane(wx - 0.4, 0.12, MAT.trim, cx, 0.06, H.z0 + 0.16, 0, 0);   // the skirting line along the far wall
        var wallSeg = function (axis, at, a0, a1, y0, y1) { var len = a1 - a0, mid = (a0 + a1) / 2, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return; if (axis === 'x') { c.box(len, hh, 0.3, MAT.wall, mid, y0 + hh / 2, at); c.solid(a0, a1, at - 0.15, at + 0.15, y0 === 0 ? -1 : y0, y1 + 1); } else { c.box(0.3, hh, len, MAT.wall, at, y0 + hh / 2, mid); c.solid(at - 0.15, at + 0.15, a0, a1, y0 === 0 ? -1 : y0, y1 + 1); } };
        wallSeg('x', H.z0, H.x0 - 0.15, H.x1 + 0.15, 0, h);   // the far wall
        var dockCut = id === 'hall3' ? [DOCKS.in[2].z - DOCKS.w / 2, DOCKS.in[2].z + DOCKS.w / 2] : null, dockCutE = id === 'hall2' ? [DOCKS.ret[0].z - DOCKS.w / 2, DOCKS.ret[0].z + DOCKS.w / 2] : null;   // IN 3 in Hall 3's west wall, the returns dock in the returns hall's east wall
        if (ownW) { if (dockCut) { wallSeg('z', H.x0, H.z0, dockCut[0], 0, h); wallSeg('z', H.x0, dockCut[0], dockCut[1], DOCKS.h, h); wallSeg('z', H.x0, dockCut[1], H.z1, 0, h); } else wallSeg('z', H.x0, H.z0, H.z1, 0, h); }
        if (ownE) { if (dockCutE) { wallSeg('z', H.x1, H.z0, dockCutE[0], 0, h); wallSeg('z', H.x1, dockCutE[0], dockCutE[1], DOCKS.h, h); wallSeg('z', H.x1, dockCutE[1], H.z1, 0, h); } else wallSeg('z', H.x1, H.z0, H.z1, 0, h); }
        if (!ownW) wallSeg('z', H.x0, H.z0, H.z1, WING.h, h); if (!ownE) wallSeg('z', H.x1, H.z0, H.z1, WING.h, h); if (id === 'hall4') wallSeg('x', H.z1, H.x0 - 0.15, H.x1 + 0.15, WING.h, h);   // the wing's walls are two metres lower: the strip above them is this hall's
        // the roof: slab, inner face, three skylight strips, trusses along z, purlins across, two roof vents
        c.box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); c.plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2, 0);
        [H.z0 + 4.5, cz, H.z1 - 4.5].forEach(function (z) { var sk = c.plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2, 0); lampMeshes.push(sk); });
        for (var tx = Math.ceil((H.x0 + 2) / 8) * 8; tx < H.x1 - 1; tx += 8) c.box(0.25, 0.6, wz - 0.4, FR, tx, h - 0.35, cz);
        for (var pz = H.z0 + 3; pz < H.z1 - 1; pz += 4) c.box(wx - 0.4, 0.12, 0.12, FR, cx, h - 0.1, pz);
        [cx - wx / 4, cx + wx / 4].forEach(function (vx) { c.cyl(0.45, 0.6, MAT.steel, vx, h + 0.6, cz, 12); c.cyl(0.6, 0.15, FR, vx, h + 0.95, cz, 12); });
        H.lights.forEach(function (p, i) { highBay(p[0], 7.6, p[1], HALL.h);   /* 7.6 like the main hall's (the light at 7.3 sits just above the lens); at 7.0 the lamp hung 0.6 m lower with the light inside the ballast box */ var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l); });
        // the inside faces: the far wall with the tray and windows, the wall it opens off with the doorway cut, the two sides
        var dcut = [D.x0 - 0.1, D.x1 + 0.1];
        hallFace(c, 'z', H.z0, 1, H.x0, H.x1, [], { windows: true, tray: true });
        hallFace(c, 'z', H.z1, -1, H.x0, H.x1, [dcut], { windows: false });
        hallFace(c, 'x', H.x0, 1, H.z0, H.z1, dockCut ? [dockCut] : [], { windows: ownW });
        hallFace(c, 'x', H.x1, -1, H.z0, H.z1, dockCutE ? [dockCutE] : [], { windows: ownE });
        // the doorway: jambs and a lintel, a strip curtain, the hall's name over it on both sides, the way out inside, bollards, hazard strips
        var dcx = (D.x0 + D.x1) / 2, dz = D.z, dw = D.x1 - D.x0, strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
        [D.x0 - 0.1, D.x1 + 0.1].forEach(function (jx) { c.box(0.2, D.h, 0.5, FR, jx, D.h / 2, dz); }); c.box(dw + 0.4, 0.14, 0.5, FR, dcx, D.h - 0.04, dz);
        for (var sx2 = D.x0 + 0.15; sx2 < D.x1; sx2 += 0.3) { var st = c.plane(0.28, D.h - 0.2, strip, sx2, (D.h - 0.2) / 2, dz + (sx2 * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx2 * 13) % 1 - 0.5) * 0.08; }
        c.sign([H.name.toUpperCase()], 2.0, 0.5, dcx, D.h + 0.55, dz + 0.3, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([id === 'hall4' ? 'WAY OUT  →  THE WING' : 'WAY OUT  →  MAIN HALL'], 1.8, 0.4, dcx, D.h + 0.55, dz - 0.3, Math.PI, { w: 512, h: 112, bg: '#1e7a3a', fg: '#fff' });
        [D.x0 - 0.6, D.x1 + 0.6].forEach(function (bx) { [dz - 0.9, dz + 0.9].forEach(function (bz) { if (id === 'hall3' && bz > dz) return; c.cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, 10); c.solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); }); });
        c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz - 0.9, -Math.PI / 2, 0); c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz + 0.9, -Math.PI / 2, 0);
        // floor markings: the rack block edges, the walkway along the wall you come in by, the hall's name painted at the doorway
        if (H.rows.length) { var rx0 = H.rowX0 - 0.4, rx1 = H.rowX0 + H.bays * RACK.bayW + 0.4; c.plane(0.1, wz - 1, MAT.yellowLine, rx0, 0.006, cz, -Math.PI / 2, 0); c.plane(0.1, wz - 1, MAT.yellowLine, rx1, 0.006, cz, -Math.PI / 2, 0); }   // the returns hall paints its own zones (12-machines7-returns)
        c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 1.6, -Math.PI / 2, 0); c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 2.8, -Math.PI / 2, 0);
        var lbl = new THREE.MeshBasicMaterial({ map: textTex([H.name.toUpperCase()], { w: 512, h: 128, bg: '#8b8d8e', fg: '#d9a12c' }) }); c.plane(2.2, 0.55, lbl, dcx, 0.0066, dz - 2.2, -Math.PI / 2, 0);
        // a dock door in a hall wall gets its hazard plane from buildDoor and its bollards, lamp and chocks from dressDoor, like the main hall's (this hall painted both again until 1.17.0, and they flickered)
        // outside: the gutter and downpipes on the far wall, gutters down the sides, the painted name high on the far wall inside
        c.box(wx + 0.4, 0.16, 0.16, FR, cx, h - 0.05, H.z0 - 0.25); [H.x0 + 1, H.x1 - 1].forEach(function (dx) { c.cyl(0.07, h + 1.1, FR, dx, (h - 1.2) / 2 + 0.05, H.z0 - 0.25, 8); });
        if (ownW) { c.box(0.16, 0.16, wz, FR, H.x0 - 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x0 - 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); } if (ownE) { c.box(0.16, 0.16, wz, FR, H.x1 + 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x1 + 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); }
        c.sign([H.name.toUpperCase(), 'DEPOT CO.'], 4.0, 1.2, H.x0 + 8, 4.3, H.z0 + 0.17, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d', size: 64 });   // between the columns, the text sized to the plate
      }; }
    /* 06-props3-halls.js */
    function shutterBuild(id) { return function (c) {
        if (hallOwned(id)) return;
        var D = HALLS[id].door, w = D.x1 - D.x0, cx = (D.x0 + D.x1) / 2;
        c.box(w, D.h, 0.12, MAT.door, cx, D.h / 2, D.z); for (var y = 0.5; y < D.h; y += 0.5) c.box(w, 0.04, 0.14, MAT.steelDark, cx, y, D.z);
        c.sign([HALLS[id].name.toUpperCase(), 'in the shop'], 1.6, 0.5, cx, D.h / 2, D.z + 0.08, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign([HALLS[id].name.toUpperCase()], 1.6, 0.5, cx, D.h / 2, D.z - 0.08, Math.PI, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' });
        c.solid(D.x0 - 0.1, D.x1 + 0.1, D.z - 0.2, D.z + 0.2, 0, D.h);
        c.hit(w, D.h, 0.5, cx, D.h / 2, D.z, { prompt: function () { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return HALLS[id].name + ' · ' + (u ? money(u.price) + ' in the shop' : 'not open') + (u && u.needs && !S.up[u.needs] ? ' · needs ' + upgradeName(u.needs).toLowerCase() : '') + ' · E opens the shop'; }, use: function () { sfx('click'); if (!driving && !pc.on) openPanel('pc', 'shop'); } });   // E on the shutter opens the shop page instead of clicking at nothing
      }; }
    /* 06-props3-halls.js */
    function buildHall(id) {
        var H = HALLS[id];
        if (id === 'hall2') { if (!doors[6]) { buildDoor(6, 1, DOCKS.ret[0].z); if (yard.dock) yard.dock(doors[6]); dressDoor(doors[6]); } if (propInst.returnsDesk) removePropInst('returnsDesk'); RET_PROPS.forEach(function (pid) { buildProp(pid); }); migrateReturnsHall(); if (propInst.notice) buildProp('notice'); }   // the returns hall: its dock, its fixtures, and the desk by the bench goes; the lobby timetable gains the returns truck
        if (id === 'hall3') { var sp = propPlacement('silo'); if (inRectH(sp.x, sp.z, H) || (sp.x > H.x0 - 3 && sp.x < H.x1 + 3 && sp.z > H.z0 - 3 && sp.z < H.z1 + 3)) { S.layout.silo = { x: -26, z: -50, rot: 0 }; buildProp('silo'); } if (!doors[5]) { buildDoor(5, -1, DOCKS.in[2].z); if (yard.dock) yard.dock(doors[5]); dressDoor(doors[5]); } buildProp('consoleIn2'); }
        buildProp(id); H.rows.forEach(function (r) { buildProp('rack' + r); }); buildProp('shut' + id); ['ext', 'posterExit', 'posterSmoke', 'firstAid', 'clock', 'aisle'].forEach(function (k) { if (PROPS[k + id]) buildProp(k + id); });
        NAV.dirty = true; shadowDirty = true; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); }
        logEvent(H.name + ' is open: ' + (id === 'hall2' ? 'a returns dock of its own, the belt to the intake, three inspection desks, the restock cage and the compactor. The desk by the bench has gone.' : H.rows.length + ' rack rows of ' + H.bays + ' bays' + (id === 'hall3' ? ', and IN 3 on its west wall' : '')), 'good');
      }
    /* 06-props4-furniture.js */
    var FABRIC = std({ color: 0x4a5f7a, roughness: 0.92 }), FABRIC2 = std({ color: 0x8a6d4a, roughness: 0.9 }), OAK = std({ color: 0x9a7a52, roughness: 0.7 }), WALNUT = std({ color: 0x5b3f2a, roughness: 0.65 }), CREAM = std({ color: 0xe8e2d4, roughness: 0.6 }), DARKGREY = std({ color: 0x3a4149, roughness: 0.6, metalness: 0.2 });
    /* 06-props4-furniture.js */
    var COMFORT_PROPS = { tv: 1, dartboard: 1, microwave: 1, fanStand: 1, bookshelf: 0.5, rugLobby: 0.25, rugOffice: 0.25, pictureOffice: 0.25, pictureLobby: 0.25, printer: 0 };
    /* 06-props4-furniture.js */
    var COMFORT_TYPES = { xSofa: 2, xArmchair: 1, xRoundTable: 1, xPaddedChair: 0.5, xTv: 1, xDartboard: 1, xMicrowave: 1, xFan: 1, xRug: 0.5, xBookshelf: 0.5, xPicture: 0.5, xPrinter: 0, xPlant: 0.25, xCooler: 0.5, xCot: 0.5 };
    /* 06-props4-furniture.js */
    function roomComfort() { var n = 0; for (var id in COMFORT_PROPS) if (propInst[id] && !propPlacement(id).hidden) n += COMFORT_PROPS[id]; (S.custom || []).forEach(function (cp) { if (COMFORT_TYPES[cp.type] && propInst[cp.id]) n += COMFORT_TYPES[cp.type]; }); return Math.min(10, Math.round(n * 2) / 2); }
    /* 06-props4-furniture.js */
    function breakLen() { return Math.max(0.25, 0.5 - 0.025 * roomComfort()); }
    /* 06-props4-furniture.js */
    function comfortText() { var cf = roomComfort(); return 'comfort ' + cf + '/10 · breaks ' + Math.round(breakLen() * 60) + ' min'; }
    /* 06-props4-furniture.js */
    var TV_LINES = ['Rates on the land lane hold for a third week', 'Sea freight: the port clears its backlog', 'Air parcels up a fifth on last month', 'The gatehouse union asks for a longer lunch', 'A rival depot opens two halls up the road', 'Returns are up across the trade: inspect everything', 'Forklift battery prices fall again', 'The weather desk says: bring a coat'];
    /* 06-props4-furniture.js */
    function tvDraw(cc, sc) {
        if (!powered()) { cc.fillStyle = '#05070a'; cc.fillRect(0, 0, sc.w, sc.h); scText(cc, 110, 96, 'NO SIGNAL', '#2a3340', 16); return; }
        cc.fillStyle = '#0b1a2b'; cc.fillRect(0, 0, sc.w, sc.h); var g = cc.createLinearGradient(0, 0, 0, sc.h); g.addColorStop(0, 'rgba(60,120,200,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cc.fillStyle = g; cc.fillRect(0, 0, sc.w, sc.h);
        cc.fillStyle = '#c8342a'; cc.fillRect(0, 0, sc.w, 30); scText(cc, 12, 21, 'DEPOT NEWS · DAY ' + S.day, '#fff', 15);
        var d = (S.days || [])[0];
        scText(cc, 12, 58, d ? 'Yesterday: ' + (d.shipped || 0) + ' shipped, ' + (d.late || 0) + ' late, ' + money(d.net || 0) + ' net' : 'First day on air: no figures yet', '#eef1f5', 13);
        scText(cc, 12, 80, 'Weather: ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + ' · bank ' + money(S.bank), '#a0acb8', 12);
        scText(cc, 12, 102, 'Crew: ' + S.staff.filter(function (w) { return w.clocked; }).length + ' on the clock of ' + S.staff.length + ' · ' + comfortText(), '#a0acb8', 12);
        cc.fillStyle = '#f5b53d'; cc.fillRect(0, sc.h - 28, sc.w, 28); var line = TV_LINES[(S.day + Math.floor(S.time / 2)) % TV_LINES.length]; scText(cc, 12, sc.h - 9, line, '#1a1205', 13);
      }
    /* 06-props4-furniture.js */
    function tvBuild(c, P, inst) {
        c.box(0.12, 0.3, 0.05, MAT.steelDark, 0, 1.95, 0.0); c.box(0.5, 0.06, 0.06, MAT.steelDark, 0, 1.95, 0.03);   // the wall bracket
        var bez = new THREE.Mesh(bevelGeo(1.14, 0.68, 0.035, 0.01), MAT.black); bez.position.set(0, 1.95, 0.065); bez.castShadow = true; c.group.add(bez);
        c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.5, 1.64, 0.085);
        var scr = touchScreen({ w: 320, h: 180, pw: 1.06, ph: 0.6, x: 0, y: 1.95, z: 0.084, ry: 0, parent: c.group, title: 'TV', draw: tvDraw }); scr.mesh.userData.propId = inst.id;
        c.sign(['DEPOT NEWS · the hall channel'], 0.5, 0.06, 0, 1.56, 0.07, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#a0acb8' });
        c.hit(1.2, 0.8, 0.2, 0, 1.95, 0.05, { prompt: function () { return powered() ? 'The TV · depot news' : 'The TV · no power'; }, use: function () { sfx('click'); screenDirtyAll(); } });
      }
    /* 06-props4-furniture.js */
    function dartboardBuild(c) {
        c.box(0.64, 0.64, 0.05, OAK, 0, 1.73, 0.0); c.box(0.58, 0.58, 0.012, CREAM, 0, 1.73, 0.028);
        var rings = [[0.225, MAT.black], [0.2, CREAM], [0.17, MAT.red], [0.155, CREAM], [0.1, std({ color: 0x1e7a3a, roughness: 0.6 })], [0.088, CREAM], [0.04, std({ color: 0x1e7a3a, roughness: 0.6 })], [0.016, MAT.red]];
        rings.forEach(function (r, i) { var ring = c.cyl(r[0], 0.012 + i * 0.002, r[1], 0, 1.73, 0.04 + i * 0.001, 32); ring.rotation.x = Math.PI / 2; });
        for (var k = 0; k < 20; k++) { var a = k * Math.PI / 10; var wire = c.box(0.004, 0.19, 0.004, MAT.chrome, Math.sin(a) * 0.12, 1.73 + Math.cos(a) * 0.12, 0.06); wire.rotation.z = -a; }
        [[0.03, 1.76], [-0.05, 1.7], [0.09, 1.66]].forEach(function (d, i) { var dart = new THREE.Group(); dart.position.set(d[0], d[1], 0.06); dart.rotation.x = -0.25 - i * 0.08; dart.rotation.y = (i - 1) * 0.15; c.add(dart); cyl(0.004, 0.06, MAT.chrome, 0, 0, 0.03, dart, 6).rotation.x = Math.PI / 2; cyl(0.006, 0.05, std({ color: [0xd14a3a, 0x3fa7d6, 0xf0b94d][i], roughness: 0.5 }), 0, 0, 0.085, dart, 8).rotation.x = Math.PI / 2; box(0.02, 0.028, 0.03, MAT.white, 0, 0, 0.125, dart); });
        c.sign(['DARTS · best of three · loser makes the tea'], 0.56, 0.05, 0, 1.38, 0.03, 0, { w: 512, h: 48, bg: '#1b232c', fg: '#f5b53d' });
        c.hit(0.7, 0.8, 0.2, 0, 1.7, 0.03, { prompt: function () { return 'The dartboard · ' + (S.stats.darts || 0) + ' thrown'; }, use: function () { S.stats.darts = (S.stats.darts || 0) + 1; sfx('click'); toast(pick(['Treble twenty!', 'Just inside the wire.', 'The wall takes one.', 'Bull. Nobody saw it.']), ''); } });
      }
    /* 06-props4-furniture.js */
    function microwaveBuild(c) {
        var body = new THREE.Mesh(bevelGeo(0.5, 0.3, 0.38, 0.012), CREAM); body.position.set(0, 0.15, 0); body.castShadow = true; c.group.add(body);
        c.box(0.3, 0.22, 0.01, MAT.black, -0.07, 0.15, 0.19); c.plane(0.26, 0.18, std({ color: 0x2a3340, roughness: 0.2, metalness: 0.3 }), -0.07, 0.15, 0.196, 0, 0);
        c.box(0.015, 0.2, 0.015, MAT.chrome, 0.1, 0.15, 0.2); c.box(0.1, 0.08, 0.005, MAT.black, 0.19, 0.2, 0.19); c.box(0.01, 0.01, 0.004, glowMat(0x5fd38d, 1.2), 0.19, 0.24, 0.193);
        for (var k = 0; k < 6; k++) c.box(0.02, 0.012, 0.004, DARKGREY, 0.165 + (k % 2) * 0.05, 0.1 - Math.floor(k / 2) * 0.025, 0.193);
        c.cyl(0.02, 0.01, MAT.black, -0.2, 0.005, -0.15, 8); c.cyl(0.02, 0.01, MAT.black, 0.2, 0.005, -0.15, 8); c.cyl(0.02, 0.01, MAT.black, -0.2, 0.005, 0.15, 8); c.cyl(0.02, 0.01, MAT.black, 0.2, 0.005, 0.15, 8);
        c.hit(0.55, 0.35, 0.42, 0, 0.15, 0, { prompt: function () { return powered() ? 'The microwave · two minutes on full' : 'The microwave · no power'; }, use: function () { if (!powered()) { sfx('bad'); return; } sfx('click'); toast('Two minutes on full.', ''); setTimeout(function () { if (powered() && ui.started) { sfx('chime'); toast('Ping.', ''); } }, 2200); } });   // the ping comes after the hum, not with the button
      }
    /* 06-props4-furniture.js */
    function fanStandBuild(c) {
        c.cyl(0.24, 0.03, DARKGREY, 0, 0.015, 0, 24); c.cyl(0.02, 1.1, MAT.chrome, 0, 0.58, 0, 10); c.cyl(0.05, 0.12, DARKGREY, 0, 1.18, 0, 12);
        var head = new THREE.Group(); head.position.set(0, 1.24, 0.08); head.rotation.x = -0.15; head.userData.dynamic = true; c.add(head);
        box(0.14, 0.14, 0.16, DARKGREY, 0, 0, -0.1, head); var cage = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 36), MAT.chrome); cage.position.set(0, 0, 0.04); head.add(cage); var cage2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 36), MAT.chrome); cage2.position.set(0, 0, -0.04); head.add(cage2);
        for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, bar = box(0.004, 0.46, 0.004, MAT.chrome, 0, 0, 0.045, head); bar.rotation.z = a; }
        var hub = new THREE.Group(); hub.position.set(0, 0, 0); head.add(hub); cyl(0.03, 0.03, MAT.black, 0, 0, 0, hub, 10).rotation.x = Math.PI / 2;
        for (var b = 0; b < 3; b++) { var bl = new THREE.Mesh(bevelGeo(0.07, 0.19, 0.006, 0.01), std({ color: 0xdfe6ec, roughness: 0.4, metalness: 0.3 })); bl.position.set(Math.sin(b * 2.094) * 0.11, Math.cos(b * 2.094) * 0.11, 0); bl.rotation.z = -b * 2.094; bl.rotation.y = 0.5; hub.add(bl); }
        dress.fans.push(hub); dress.fanHeads = dress.fanHeads || []; dress.fanHeads.push(head);   // the hub spins with the ceiling fans; the head sweeps side to side in tickDressing
        c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1.5);
        c.hit(0.5, 1.5, 0.5, 0, 0.75, 0, { prompt: function () { return powered() ? 'The fan · turning' : 'The fan · no power'; }, use: function () { sfx('click'); } });
      }
    /* 06-props4-furniture.js */
    function rugBuild(w, d, col, col2) { return function (c) {
        var t = tex(256, 256, function (cc, W, H) { cc.fillStyle = col; cc.fillRect(0, 0, W, H); cc.strokeStyle = col2; cc.lineWidth = 14; cc.strokeRect(14, 14, W - 28, H - 28); cc.lineWidth = 4; cc.strokeRect(34, 34, W - 68, H - 68); for (var i = 0; i < 400; i++) { cc.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12) + ')'; cc.fillRect(Math.random() * W, Math.random() * H, 2, 2); } });
        var m = c.plane(w, d, std({ map: t, roughness: 0.95 }), 0, 0.022, 0, -Math.PI / 2, 0); m.receiveShadow = true;
        c.hit(w, 0.1, d, 0, 0.05, 0, { prompt: function () { return 'A rug'; }, use: function () { sfx('click'); } });
      }; }
    /* 06-props4-furniture.js */
    function bookshelfBuild(c) {
        var W = 1.2, H = 1.9, D = 0.34; c.box(0.03, H, D, OAK, -W / 2, H / 2, 0); c.box(0.03, H, D, OAK, W / 2, H / 2, 0); c.box(W, 0.03, D, OAK, 0, H - 0.015, 0); c.box(W, 0.03, D, OAK, 0, 0.05, 0); c.box(W, H, 0.015, WALNUT, 0, H / 2, -D / 2 + 0.008);
        [0.5, 0.95, 1.4].forEach(function (y) { c.box(W - 0.06, 0.025, D - 0.02, OAK, 0, y, 0); });
        if (!bookshelfBuild.mats) bookshelfBuild.mats = [0x9c2f2f, 0x2f5a9c, 0x3f8a4a, 0xd8b04a, 0x6b4a8a, 0xe6e2d8, 0x2a2d33, 0xc8742a].map(function (col) { return std({ color: col, roughness: 0.6 }); });   // eight materials for some eighty books, not eighty: the shelf bakes into eight draws
        var cols = bookshelfBuild.mats;
        [0.065, 0.515, 0.965, 1.415].forEach(function (y, row) { var x = -W / 2 + 0.06; while (x < W / 2 - 0.1) { var bw = 0.03 + Math.random() * 0.03, bh = 0.2 + Math.random() * 0.12, lean = Math.random() < 0.12; var bk = c.box(bw, bh, D - 0.08, cols[Math.floor(Math.random() * cols.length)], x + bw / 2, y + bh / 2, 0.01); if (lean) bk.rotation.z = 0.12; x += bw + 0.004; if (Math.random() < 0.08) x += 0.06; } });
        c.box(0.28, 0.26, 0.2, std({ color: 0x9a9890, roughness: 0.5 }), 0.35, H + 0.13, 0); c.cyl(0.06, 0.18, std({ color: 0x3f8a4a, roughness: 0.7 }), -0.35, H + 0.09, 0, 10);   // a box file and a vase on top
        c.solid(-W / 2 - 0.02, W / 2 + 0.02, -D / 2 - 0.02, D / 2 + 0.02, 0, H + 0.3);
        c.hit(W + 0.1, H + 0.4, D + 0.2, 0, H / 2 + 0.15, 0, { prompt: function () { return 'The bookshelf · manuals, ledgers and a thriller somebody left'; }, use: function () { sfx('click'); toast(pick(['"Warehouse Management, 4th ed." Riveting.', '"The Pallet Murders." Chapter three is missing.', 'Last year\'s ledger. Better not.', 'A manual for a forklift you do not own.']), ''); } });
      }
    /* 06-props4-furniture.js */
    function printerBuild(c, P, inst) {
        c.box(0.6, 0.04, 0.5, MAT.trim, 0, 0.68, 0); [[-0.27, -0.22], [0.27, -0.22], [-0.27, 0.22], [0.27, 0.22]].forEach(function (l) { c.box(0.03, 0.66, 0.03, MAT.steelDark, l[0], 0.33, l[1]); }); c.box(0.56, 0.02, 0.46, MAT.steelDark, 0, 0.3, 0); c.box(0.4, 0.05, 0.3, MAT.paper, 0, 0.335, 0);
        var body = new THREE.Mesh(bevelGeo(0.5, 0.24, 0.42, 0.015), std({ color: 0xd9dde2, roughness: 0.5 })); body.position.set(0, 0.82, 0); body.castShadow = true; c.group.add(body);
        c.box(0.46, 0.04, 0.2, DARKGREY, 0, 0.96, 0.05); c.box(0.4, 0.015, 0.22, MAT.paper, 0, 0.99, -0.08); c.box(0.36, 0.01, 0.3, MAT.paper, 0, 0.71, 0.3); c.box(0.44, 0.03, 0.02, DARKGREY, 0, 0.78, 0.22);
        c.box(0.14, 0.05, 0.01, MAT.black, 0.15, 0.9, 0.215); inst.led = c.box(0.012, 0.012, 0.005, glowMat(0x5fd38d, 1.0), 0.07, 0.9, 0.217);
        c.solid(-0.32, 0.32, -0.27, 0.27, 0, 1.1);
        c.hit(0.66, 1.1, 0.56, 0, 0.55, 0, { prompt: function () { return powered() ? 'The printer · prints the day report' : 'The printer · no power'; }, use: function () { if (!powered()) { sfx('bad'); return; } sfx('scan'); var d = (S.days || [])[0]; toast(d ? 'Printed: day ' + d.day + ', ' + (d.shipped || 0) + ' shipped, ' + money(d.net || 0) + ' net' : 'Printed a blank sheet: no day report yet', ''); } });
      }
    /* 06-props4-furniture.js */
    function pictureTex(kind) {
        return tex(256, 192, function (cc, W, H) {
          if (kind === 'depot') { var g = cc.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6a35b'); g.addColorStop(0.55, '#f3c777'); g.addColorStop(1, '#4b5566'); cc.fillStyle = g; cc.fillRect(0, 0, W, H); cc.fillStyle = '#ffe9b0'; cc.beginPath(); cc.arc(190, 70, 26, 0, 6.3); cc.fill(); cc.fillStyle = '#2b3440'; cc.fillRect(30, 95, 170, 60); cc.fillRect(20, 85, 190, 12); cc.fillStyle = '#f5b53d'; cc.fillRect(70, 112, 40, 28); cc.fillRect(130, 112, 40, 28); cc.fillStyle = '#1b232c'; cc.fillRect(0, 155, W, H - 155); cc.fillStyle = '#3d4652'; cc.fillRect(205, 125, 42, 24); cc.fillRect(235, 118, 16, 10); cc.fillStyle = '#111'; cc.beginPath(); cc.arc(214, 151, 5, 0, 6.3); cc.arc(240, 151, 5, 0, 6.3); cc.fill(); }
          else if (kind === 'mountains') { var g2 = cc.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, '#5aa2e6'); g2.addColorStop(1, '#cfe6fb'); cc.fillStyle = g2; cc.fillRect(0, 0, W, H); cc.fillStyle = '#5b6f86'; cc.beginPath(); cc.moveTo(0, 150); cc.lineTo(80, 50); cc.lineTo(150, 140); cc.lineTo(200, 70); cc.lineTo(256, 150); cc.closePath(); cc.fill(); cc.fillStyle = '#eef4f8'; cc.beginPath(); cc.moveTo(62, 72); cc.lineTo(80, 50); cc.lineTo(98, 72); cc.closePath(); cc.fill(); cc.fillStyle = '#3f7fb8'; cc.fillRect(0, 150, W, 42); cc.fillStyle = '#2f6b3a'; cc.fillRect(0, 140, W, 14); }
          else { cc.fillStyle = '#eee9df'; cc.fillRect(0, 0, W, H); cc.strokeStyle = '#2b3440'; cc.lineWidth = 6; cc.strokeRect(70, 50, 116, 92); cc.beginPath(); cc.moveTo(70, 50); cc.lineTo(128, 20); cc.lineTo(186, 50); cc.stroke(); cc.fillStyle = '#f5b53d'; cc.fillRect(110, 86, 36, 56); cc.fillStyle = '#2b3440'; cc.font = 'bold 18px Bahnschrift, Arial, sans-serif'; cc.textAlign = 'center'; cc.fillText('SHIP IT', 128, 172); }
        });
      }
    /* 06-props4-furniture.js */
    function pictureBuild(kind) { return function (c) {
        var fw = 0.7, fh = 0.52; c.box(fw + 0.06, fh + 0.06, 0.03, WALNUT, 0, 1.7, 0.0); c.box(fw + 0.02, fh + 0.02, 0.01, CREAM, 0, 1.7, 0.02);
        var m = c.plane(fw - 0.04, fh - 0.04, std({ map: pictureTex(kind), roughness: 0.8 }), 0, 1.7, 0.028, 0, 0); m.receiveShadow = false;
        c.hit(0.8, 0.6, 0.12, 0, 1.7, 0.02, { prompt: function () { return kind === 'depot' ? 'A picture: the depot at sunset' : kind === 'mountains' ? 'A picture: mountains, for some reason' : 'A poster: SHIP IT'; }, use: function () { sfx('click'); } });
      }; }
    /* 06-props4-furniture.js */
    function seatBuild(width, fabric) { return function (c) {
        var w = width, d = 0.85, armW = 0.12;
        c.box(w, 0.42, d, fabric, 0, 0.21, 0); [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]].forEach(function (l) { c.cyl(0.025, 0.1, WALNUT, l[0], 0.05, l[1], 8); });
        c.box(w, 0.5, 0.22, fabric, 0, 0.6, -d / 2 + 0.11);   // the back
        var seats = width > 1.3 ? 2 : 1, sw = (w - armW * 2 - 0.04) / seats;
        for (var k = 0; k < seats; k++) { var cx = -w / 2 + armW + 0.02 + sw * (k + 0.5); var cush = new THREE.Mesh(bevelGeo(sw - 0.03, 0.14, d - 0.3, 0.04), fabric); cush.position.set(cx, 0.49, 0.05); cush.castShadow = true; c.group.add(cush); var back = new THREE.Mesh(bevelGeo(sw - 0.03, 0.42, 0.12, 0.04), fabric); back.position.set(cx, 0.72, -d / 2 + 0.26); back.rotation.x = -0.1; back.castShadow = true; c.group.add(back); }
        [-1, 1].forEach(function (s) { var arm = new THREE.Mesh(bevelGeo(armW, 0.3, d - 0.05, 0.03), fabric); arm.position.set(s * (w / 2 - armW / 2), 0.57, 0); arm.castShadow = true; c.group.add(arm); });
        if (seats === 2) { var cushion = new THREE.Mesh(bevelGeo(0.3, 0.3, 0.08, 0.04), FABRIC2); cushion.position.set(w / 2 - 0.35, 0.76, -d / 2 + 0.33); cushion.rotation.z = 0.2; c.group.add(cushion); }
        c.solid(-w / 2, w / 2, -d / 2, d / 2, 0, 1.0);
        c.hit(w + 0.1, 1.0, d + 0.1, 0, 0.5, 0, { prompt: function () { return seats === 2 ? 'The sofa · the crew\'s favourite' : 'The armchair'; }, use: function () { sfx('click'); toast(pick(['Comfy.', 'Somebody left crumbs.', 'Five minutes. Then back to it.']), ''); } });
      }; }
    /* 06-props4-furniture.js */
    function paddedChairBuild(c) {
        var seat = new THREE.Mesh(bevelGeo(0.46, 0.08, 0.46, 0.03), FABRIC); seat.position.set(0, 0.47, 0); seat.castShadow = true; c.group.add(seat);
        var back = new THREE.Mesh(bevelGeo(0.44, 0.42, 0.07, 0.03), FABRIC); back.position.set(0, 0.75, -0.2); back.rotation.x = -0.12; back.castShadow = true; c.group.add(back);
        [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
        c.box(0.4, 0.03, 0.03, MAT.chrome, 0, 0.42, -0.19); c.box(0.4, 0.03, 0.03, MAT.chrome, 0, 0.42, 0.19);
        c.solid(-0.24, 0.24, -0.24, 0.24, 0, 0.9);
      }
    /* 06-props4-furniture.js */
    function roundTableBuild(c) {
        c.cyl(0.65, 0.04, OAK, 0, 0.74, 0, 36); c.cyl(0.06, 0.7, MAT.steelDark, 0, 0.36, 0, 12); [0, 1, 2, 3].forEach(function (k) { var foot = c.box(0.5, 0.04, 0.06, MAT.steelDark, 0, 0.03, 0); foot.rotation.y = k * Math.PI / 2; foot.position.set(Math.sin(k * Math.PI / 2) * 0.25, 0.03, Math.cos(k * Math.PI / 2) * 0.25); });
        c.cyl(0.045, 0.1, MAT.white, 0.25, 0.81, 0.1, 12); c.cyl(0.045, 0.1, MAT.red, -0.3, 0.81, -0.15, 12); c.box(0.3, 0.012, 0.2, MAT.paper, 0.05, 0.766, -0.25);
        c.solid(-0.66, 0.66, -0.66, 0.66, 0, 0.8);
      }
    /* 06-yard.js */
    var yard = { gates: [], guards: [], traffic: [], puddles: [], flag: null, lampLenses: [], windT: 0 };
    /* 07-items.js */
    var BOX = { w: 0.55, h: 0.42, d: 0.45 };
    /* 07-items.js */
    var BOX_GEO = boxGeo(BOX.w, BOX.h, BOX.d), PARCEL_GEO = boxGeo(0.6, 0.46, 0.5), PALLET_GEO = boxGeo(1.2, 0.14, 1.0);
    /* 07-items.js */
    var handBox = new THREE.Mesh(BOX_GEO, CARD.paint);
    /* 07-items.js */
    var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel);
    /* 07-items.js */
    function parcelForm(oid) { var o = oid ? orderById(oid) : null; return o && o.form || null; }
    /* 07-items.js */
    function formMat(f) { return f === 'crate' ? MAT.crate : f === 'strap' ? MAT.strapped : f === 'pouch' ? MAT.airbox : MAT.parcel; }
    /* 07-items.js */
    function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && (h.kind === 'parcel' || h.kind === 'return')); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; if (h && h.kind === 'parcel') handParcel.material = formMat(parcelForm(h.order)); if (h && h.kind === 'return') handParcel.material = MAT.returned; }
    /* 07-items.js */
    function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
    /* 07-items.js */
    function slotSpace(key, sku) { var s = S.slots[key]; if (!s || !s.n) return ECON.slotCap; if (s.sku !== sku) return 0; return ECON.slotCap - s.n; }
    /* 07-items.js */
    function slotAdd(key, sku, n) { var s = S.slots[key]; if (!s || !s.n) S.slots[key] = { sku: sku, n: n, pal: !!(s && s.pal) }; else s.n += n; }
    /* 07-items.js */
    function slotTake(key, n) { var s = S.slots[key]; if (!s) return 0; var k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) { if (s.pal) s.n = 0; else delete S.slots[key]; } return k; }
    /* 07-items.js */
    function slotOwned(key) { var r = slotParse(key).r; return r < S.up.rows || (r === UPPER.row && upperRowsOwned() > 0) || annexRowOwned(r); }
    /* 07-items.js */
    function stockCount(sku) { var n = 0; for (var k in S.slots) if (S.slots[k].sku === sku) n += S.slots[k].n; return n; }
    /* 07-items.js */
    function totalStock() { var n = 0; for (var k in S.slots) n += S.slots[k].n; return n; }
    /* 07-items.js */
    function stockSummary() { var m = {}; for (var k in S.slots) { var s = S.slots[k]; if (!s.n) continue; m[s.sku] = (m[s.sku] || 0) + s.n; } return m; }
    /* 07-items.js */
    function slotsWith(sku) { var out = []; for (var k in S.slots) if (S.slots[k].sku === sku && S.slots[k].n > 0) out.push(k); out.sort(function (a, b) { return slotParse(a).l - slotParse(b).l; }); return out; }
    /* 07-items.js */
    function findSlotFor(sku, n, maxLevel) {
        var best = null, bestScore = -1;
        var rows = groundRows();   // the main rows you own and the rows of the halls you own; the main rows fill first
        for (var ri = 0; ri < rows.length; ri++) for (var b = 0; b < rowBays(rows[ri]); b++) for (var l = 0; l <= maxLevel; l++) {
          var r = rows[ri], key = slotKey(r, b, l), s = S.slots[key], space = slotSpace(key, sku); if (space < n) continue;
          var score = (s && s.n ? 100 : 50) - l * 10 - b - (isAnnexRow(r) ? 30 : 0);
          if (score > bestScore) { bestScore = score; best = key; }
        }
        return best;
      }
    /* 07-items.js */
    function jackReach(l) { return l <= (S.up.jackLift ? 1 : 0); }
    /* 07-items.js */
    function jackReachText() { return S.up.jackLift ? 'The stacker reaches the second level, not the top' : 'The jack only reaches the floor level'; }
    /* 07-items.js */
    function slotPrompt(key) {
        var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
        if (p.l === RACK.top && !driving) return has ? skuName(s.sku) + ' × ' + s.n + ' · top level: forklift only' : 'Top level: forklift only';
        if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) return 'Pick a box of ' + skuName(s.sku) + ' onto the cart (' + s.n + ' here)'; return has ? 'Cart is full' : null; }
        if (isJack(tool)) { var jp = jackPallet(tool); if (jp) return jackReach(p.l) ? (slotSpace(key, jp.sku) >= jp.n && !(jp.n === 0 && s) ? 'Set the pallet into the rack' : (has ? 'Slot holds ' + skuName(s.sku) + ': no room' : null)) : jackReachText(); return has && jackReach(p.l) ? 'Pull the pallet out (' + Math.min(s.n, ECON.palletCap) + ' boxes)' : (s && s.pal && jackReach(p.l) ? 'Take the empty pallet out' : null); }
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'A damaged box does not go on the rack: bin it';
        if (S.hand && S.hand.kind === 'box') return slotSpace(key, S.hand.sku) > 0 ? 'Put the box on the rack' + (has ? ' (' + s.n + ' here)' : '') : 'Slot holds ' + skuName(s.sku) + ': no room';
        if (S.hand) return null;
        return has ? 'Take a box of ' + skuName(s.sku) + ' (' + s.n + ' here)' : 'Empty slot · ' + slotName(key);
      }
    /* 07-items.js */
    function slotUse(key) {
        var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
        if (p.l === RACK.top && !driving) { toast('Too high. Use the forklift.', 'bad'); return; }
        if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) { S.cart.boxes.push(s.sku); slotTake(key, 1); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); } return; }
        if (isJack(tool)) {
          var jp = jackPallet(tool);
          if (jp) { if (!jackReach(p.l)) { toast(jackReachText() + '.', 'bad'); return; } if (storePallet(jp, key)) { S[tool].pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in that slot.', 'bad'); return; }
          if (has && jackReach(p.l)) { var np = pullPallet(key); if (np) { np.place = 'jack'; np.jack = tool; S[tool].pallet = np.id; sfx('jack'); } }
          else if (s && s.pal && jackReach(p.l)) { delete S.slots[key]; var ep = newPallet(s.sku, 0, { place: 'jack', jack: tool }); S[tool].pallet = ep.id; sfx('jack'); }
          return;
        }
        if (!S.hand && has && s.wrapped) s.wrapped = false;   // cutting the film to take a box
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
        if (S.hand && S.hand.kind === 'box') { if (slotSpace(key, S.hand.sku) > 0) { slotAdd(key, S.hand.sku, 1); handSet(null); sfx('putdown'); S.stats.putaway++; addXp(XP.box); introStep('putaway'); } else toast('No room: that slot holds ' + skuName(s.sku) + '.', 'bad'); return; }
        if (S.hand) return;
        if (has) { slotTake(key, 1); handSet({ kind: 'box', sku: s.sku }); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); }
      }
    /* 07-items.js */
    function palletById(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) return S.pallets[i]; return null; }
    /* 07-items.js */
    function newPallet(sku, n, props) { var p = { id: uid('pl'), sku: sku, n: n, place: 'floor', x: 0, y: 0, z: 0, rot: 0 }; for (var k in props) p[k] = props[k]; S.pallets.push(p); return p; }
    /* 07-items.js */
    function removePallet(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) { S.pallets.splice(i, 1); return; } }
    /* 07-items.js */
    function storePallet(p, key) { if (!slotOwned(key) || slotSpace(key, p.sku) < p.n || (p.n === 0 && S.slots[key])) return false; slotAdd(key, p.sku, p.n); S.slots[key].pal = true; S.slots[key].wrapped = !!p.wrapped; S.stats.putaway += p.n; removePallet(p.id); return true; }
    /* 07-items.js */
    function pullPallet(key) { var s = S.slots[key]; if (!s || !s.n) return null; var sku = s.sku, n = Math.min(s.n, ECON.palletCap), wrapped = !!s.wrapped; slotTake(key, n); if (S.slots[key] && S.slots[key].n <= 0) delete S.slots[key]; return newPallet(sku, n, { place: 'floor', wrapped: wrapped }); }
    /* 07-items.js */
    function jackPallet(tool) { var t = tool || jackTool(), js = S[t]; return js && js.pallet ? palletById(js.pallet) : null; }
    /* 07-items.js */
    function forkPallet() { return S.fork.pallet ? palletById(S.fork.pallet) : null; }
    /* 08-trucks.js */
    var truckMeshes = {};
    /* 08-trucks.js */
    function truckById(id) { for (var i = 0; i < S.trucks.length; i++) if (S.trucks[i].id === id) return S.trucks[i]; return null; }
    /* 08-trucks.js */
    function truckAtDoor(i) { var dm = DOOR_MAP[i]; if (!dm) return null; var dir = dm.dir, dock = dm.dock; for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.dir === dir && t.dock === dock && t.state === 'docked') return t; } return null; }
    /* 08-trucks.js */
    function trailerBounds(t) { var len = t.len || TRAILER.len, w = t.van ? VAN.w : TRAILER.w, a = t.x, b = t.x + t.side * len; return { x0: Math.min(a, b), x1: Math.max(a, b), z0: t.z - w / 2, z1: t.z + w / 2 }; }
    /* 08-trucks.js */
    function removeTruckMesh(id) { var m = truckMeshes[id]; if (!m) return; scene.remove(m.g); m.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); delete truckMeshes[id]; shadowDirty = true; }
    /* 08-trucks.js */
    var DRIVER_LINES = {
        sign: ['Sign here, chief.', 'Just the one signature and it is all yours.', 'Name and a squiggle, ta.', 'Delivery note. Sign the bottom.'],
        signed: ['Cheers. All yours.', 'Lovely. I will get the kettle on in the cab.', 'Ta. Mind the back ones, they are heavy.', 'Done. Give us a shout when it is empty.'],
        chat: ['Traffic was murder on the ring road.', 'Yard looks tidy, I will give you that.', 'Three more drops after this one.', 'Is the kettle on?', 'Mind the forks. I have seen things.', 'My last depot had a vending machine with actual food in it.', 'Weather is turning.', 'They want this lot back in Northgate by six.'],
        late: ['Any chance we can get a move on, mate?', 'I have got a slot to make.', 'Clock is ticking, chief.'],
        out: ['Load her up, I am ready when you are.', 'Anything heavy goes at the front.', 'Shout when you want me gone.']
      };
    /* 08-trucks.js */
    function signTruck(t) { if (t.signed) return; t.signed = true; sfx('tape'); addXp(3); toast('Delivery note signed: ' + t.pallets.length + ' pallets from ' + clientName(t.client), 'good'); logEvent('Signed for ' + t.pallets.length + ' pallets from ' + clientName(t.client) + ' (' + t.driver + ')'); introStep('sign'); }
    /* 08-trucks.js */
    function truckLeave(t, why) {
        if (t.state !== 'docked') return;
        if (t.dir === 'out' && t.parcels.length) introStep('dispatch');   // a truck leaving on schedule with your parcel finishes the intro too
        sellBales(t);
        if (t.dir === 'in') {
          S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n <= 0; }).forEach(function (p) { removePallet(p.id); });   // empties go back with the truck, no harm done
          var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; });
          if (left.length) { left.forEach(function (p) { removePallet(p.id); }); addRep(-Math.min(5, 0.5 * left.length)); S.stats.lost += left.length; logEvent(left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back on the truck unreceived', 'bad'); toast('Refused delivery: ' + left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back', 'bad'); }
          else { logEvent(t.driver + ' left ' + dockLabel(doorIndex('in', t.dock)) + ' empty', 'good'); }
        } else {
          if (t.parcels.length) { var n = t.parcels.length, sum = 0; t.parcels.forEach(function (oid) { var o = orderById(oid); if (o) sum += shipOrder(o, doorIndex(t.dir, t.dock)); }); toast('Truck out with ' + n + ' parcel' + (n > 1 ? 's' : '') + ' · ' + money(sum), 'good'); logEvent('Outbound truck left ' + dockLabel(doorIndex(t.dir, t.dock)) + ' with ' + n + ' parcel' + (n > 1 ? 's' : '') + ', ' + money(sum) + ' paid', 'good'); if (why === 'dispatched') addXp(XP.truck); }
          else logEvent((t.dir === 'ret' ? 'The returns truck left ' : 'Outbound truck left ') + dockLabel(doorIndex(t.dir, t.dock)) + ' empty');
          t.parcels = [];
          // a return nobody took off: the driver sets it down inside the door
          if (t.returns && t.returns.length) { var rat = doorInside(doorIndex(t.dir, t.dock)), rn = t.returns.length; t.returns.forEach(function (rid, k) { S.floor.push({ kind: 'return', id: rid, x: rat[0] - 1.3, y: 0, z: rat[1] + (t.dir === 'ret' ? 0.9 + k * 0.9 : -0.9 + k * 0.9), rot: 0 }); }); toast(t.driver + ' set ' + rn + ' return' + (rn > 1 ? 's' : '') + ' down inside ' + dockLabel(doorIndex(t.dir, t.dock)), ''); logEvent(rn + ' return' + (rn > 1 ? 's' : '') + ' left on the dock floor at ' + dockLabel(doorIndex(t.dir, t.dock)) + ': take them to the returns desk'); t.returns = []; }
        }
        // nobody rides along
        var b = trailerBounds(t);
        if (player.x > b.x0 - 0.3 && player.x < b.x1 + 0.3 && player.z > b.z0 - 0.3 && player.z < b.z1 + 0.3) { player.x = t.side * (HALL.x - 1.6); player.z = t.z; }
        if (driving && S.fork.x > b.x0 - 0.3 && S.fork.x < b.x1 + 0.3 && Math.abs(S.fork.z - t.z) < 1.5) { S.fork.x = t.side * (HALL.x - 2.5); S.fork.z = t.z; }
        // nothing else rides along either: a box, a parcel, a pallet or a tool left in the trailer is set down inside the door
        var inT = function (o) { return o && typeof o.x === 'number' && o.x > b.x0 - 0.3 && o.x < b.x1 + 0.3 && Math.abs((o.z || 0) - t.z) < 1.6; };
        S.floor.concat(S.pallets.filter(function (p) { return p.place === 'floor'; }), [S.jack, S.jack2, S.cart]).forEach(function (o) { if (inT(o)) { o.x = t.side * (HALL.x - 1.6); if (o.y !== undefined) o.y = 0; } });
        S.staff.forEach(function (st) { if (inT(st)) { st.x = t.side * (HALL.x - 1.6); st.path = []; } if (st.jackAt && inT(st.jackAt)) st.jackAt.x = t.side * (HALL.x - 1.6); });   // a worker fetching in the trailer, or a jack parked in it at a clock-out, would be left in the yard
        t.state = 'leaving'; sfx('truck'); rebuildBoardSoon();
      }
    /* 08-trucks.js */
    function consoleUse(i) {
        var t = truckAtDoor(i); if (!t) { sfx('bad'); return; }
        if (!t.parcels.length) { toast('Nothing loaded yet.', 'bad'); return; }
        sfx('horn'); introStep('dispatch'); truckLeave(t, 'dispatched');
      }
    /* 08-trucks.js */
    var boardT = 0;
    /* 08-trucks.js */
    function rebuildBoardSoon() { boardT = 0.01; }
    /* 09-orders.js */
    function clientName(id) { for (var i = 0; i < CLIENTS.length; i++) if (CLIENTS[i].id === id) return CLIENTS[i].name; return id || 'Walk-in'; }
    /* 09-orders.js */
    function orderById(id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; }
    /* 09-orders.js */
    function openOrders() { return S.orders.filter(function (o) { return o.state === 'open'; }); }
    /* 09-orders.js */
    function dueText(abs) { var day = Math.floor(abs / 24), t = abs % 24; return fmtTime(t) + (day > S.day + 1 ? ' in ' + (day - S.day) + ' days' : day > S.day ? ' tomorrow' : abs < nowAbs() ? ' (overdue)' : ''); }
    /* 09-orders.js */
    function orderLate(o) { return nowAbs() > o.due + 0.05; }
    /* 09-orders.js */
    function benchNeed() { var need = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); }); for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k]; for (var q in need) if (need[q] <= 0) delete need[q]; return need; }
    /* 09-orders.js */
    function benchSurplus() { var want = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { want[l.sku] = (want[l.sku] || 0) + l.qty; }); }); var sur = {}; for (var k in S.bench.boxes) { var n = S.bench.boxes[k] - (want[k] || 0); if (n > 0) sur[k] = n; } return sur; }
    /* 09-orders.js */
    function contractSlots() { return unlocked('twoContracts') ? ['contract', 'contract2'] : ['contract']; }
    /* 09-orders.js */
    function contractsAll() { return contractSlots().map(function (k) { return S[k]; }).filter(Boolean); }
    /* 09-orders.js */
    function contractOffer() { return contractsAll().filter(function (c) { return !c.accepted; })[0] || null; }
    /* 09-orders.js */
    function contractSlotOf(c) { for (var i = 0; i < contractSlots().length; i++) if (S[contractSlots()[i]] === c) return contractSlots()[i]; return null; }
    /* 09-orders.js */
    function contractAccept(k) { var c = k ? S[k] : contractOffer(); if (!c || c.accepted) return false; c.accepted = true; sfx('chime'); toast('Contract accepted', 'good'); logEvent('Accepted the contract from ' + clientName(c.client), 'good'); hudDirty = true; return true; }
    /* 09-orders.js */
    function contractDecline(k) { var c = k ? S[k] : contractOffer(); if (!c || c.accepted) return false; logEvent('Declined the contract from ' + clientName(c.client)); S[contractSlotOf(c)] = null; S.nextOffer = S.day + 2; hudDirty = true; return true; }
    /* 09-orders.js */
    function contractSettle(k) {
        var c = S[k || 'contract']; if (!c) return;
        if (c.done >= c.need) { pay(c.bonus, 'Contract bonus, ' + clientName(c.client)); addRep(6); toast('Contract complete: ' + money(c.bonus) + ' bonus', 'rare'); logEvent('Contract with ' + clientName(c.client) + ' complete: ' + money(c.bonus) + ' bonus', 'rare'); sfx('fanfare'); addXp(40); }
        else { pay(-c.penalty, 'Contract penalty, ' + clientName(c.client)); addRep(-4); toast('Contract missed: ' + c.done + ' of ' + c.need + '. Penalty ' + money(c.penalty), 'bad'); logEvent('Contract with ' + clientName(c.client) + ' missed (' + c.done + ' of ' + c.need + ')', 'bad'); }
        S[k || 'contract'] = null; S.nextOffer = S.day + randi(2, 4);
      }
    /* 09-orders.js */
    function benchCount() { var n = 0; for (var k in S.bench.boxes) n += S.bench.boxes[k] || 0; return n; }
    /* 09-orders.js */
    function benchAdd(sku, n) { S.bench.boxes[sku] = (S.bench.boxes[sku] || 0) + n; }
    /* 09-orders.js */
    function benchTake(sku, n) { var k = Math.min(n, S.bench.boxes[sku] || 0); if (!k) { delete S.bench.boxes[sku]; return 0; } S.bench.boxes[sku] -= k; if (S.bench.boxes[sku] <= 0) delete S.bench.boxes[sku]; return k; }
    /* 09-orders.js */
    function cartAtBench() { var need = benchNeed(), off = 0, on = 0, room = benchCapNow() - benchCount(); S.cart.boxes.forEach(function (sku) { if ((need[sku] || 0) > 0 && off < room) { need[sku]--; off++; } }); var sur = benchSurplus(); for (var k in sur) on += sur[k]; on = Math.min(on, ECON.cartCap - (cartLoad() - off)); return { off: off, on: Math.max(0, on) }; }
    /* 09-orders.js */
    function benchPrompt() {
        if (player.tool === 'cart') { var c = cartAtBench(); return (c.off ? 'Unload ' + c.off + ' wanted ' + (c.off === 1 ? 'box' : 'boxes') : '') + (c.off && c.on ? ', ' : '') + (c.on ? 'take ' + c.on + ' surplus back on the cart' : '') || 'Packing bench · nothing on the cart the orders want'; }
        if (isJack(player.tool)) return null;
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Damaged boxes do not ship: bin it';
        if (S.hand && S.hand.kind === 'box') return benchCount() < benchCapNow() ? 'Put the box on the ' + (BOOT_STAGE === 0 ? 'table' : 'bench') : 'The ' + (BOOT_STAGE === 0 ? 'table' : 'bench') + ' is full';
        if (S.hand) return null;
        var sur = benchSurplus(), sn = 0; for (var k in sur) sn += sur[k];
        return (BOOT_STAGE === 0 ? 'Packing table · ' : 'Packing bench · ') + benchCount() + (benchCount() === 1 ? ' box' : ' boxes') + ' · ' + openOrders().length + (openOrders().length === 1 ? ' open order' : ' open orders') + (sn ? ' · ' + sn + ' surplus (look at a box to take it back)' : '');
      }
    /* 09-orders.js */
    function benchUse() {
        if (player.tool === 'cart') {
          // the boxes the open orders still want come off the cart; the surplus on the bench goes onto the cart, to go back on the racks
          var need = benchNeed(), off = 0, on = 0;
          for (var i = S.cart.boxes.length - 1; i >= 0; i--) { var sku = S.cart.boxes[i]; if ((need[sku] || 0) > 0 && benchCount() < benchCapNow()) { S.cart.boxes.splice(i, 1); benchAdd(sku, 1); need[sku]--; off++; } }
          var sur = benchSurplus(); for (var k in sur) while (sur[k] > 0 && cartLoad() < ECON.cartCap) { benchTake(k, 1); S.cart.boxes.push(k); sur[k]--; on++; }
          if (off || on) { sfx('putdown'); introStep('bench'); toast((off ? off + ' onto the bench' : '') + (off && on ? ' · ' : '') + (on ? on + ' surplus onto the cart' : ''), 'good'); hudDirty = true; }
          else if (S.cart.boxes.length) toast(benchCount() >= benchCapNow() ? 'The bench is full.' : 'No open order wants what is on the cart. Put it back on the racks.', 'bad');
          else toast('Nothing surplus on the bench.', '');
          return;
        }
        if (isJack(player.tool)) return;
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. Bin it.', 'bad'); return; }
        if (S.hand && S.hand.kind === 'box') { if (benchCount() >= benchCapNow()) { toast('The ' + (BOOT_STAGE === 0 ? 'table' : 'bench') + ' is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
        if (S.hand) return;
        if (BOOT_STAGE === 0) { var ready = openOrders().filter(canPack).sort(function (a, b) { return a.due - b.due; })[0]; if (ready) { if (packOrder(ready)) { toast('Packing #' + ready.num + ' by hand: four seconds', 'good'); } } else if (S.pack && S.pack.job) toast('Packing #' + (orderById(S.pack.job.order) || { num: '?' }).num + '...', ''); else toast(openOrders().length ? 'Not every box of an order is on the table yet.' : 'No open orders. Boxes you leave here stay on the table.', ''); return; }   // the shed: E on the table packs the first whole order on it, by hand
        sfx('click'); toast('Look at a box on the bench and press E to take it back. The terminal at the end packs the orders.', '');
      }
    /* 09-orders.js */
    function returnSurplus() {
        var sur = benchSurplus(), moved = 0, floorN = 0;
        for (var sku in sur) { var left = sur[sku]; for (var guard = 0; left > 0 && guard < 40; guard++) { var key = findSlotFor(sku, 1, 1); if (!key) break; var room = Math.min(left, slotSpace(key, sku)); if (room <= 0) break; benchTake(sku, room); slotAdd(key, sku, room); left -= room; moved += room; } }
        for (var i = S.floor.length - 1; i >= 0; i--) { var f = S.floor[i]; if (f.kind !== 'box' || f.damaged || !insideHall(f.x, f.z)) continue; var k2 = findSlotFor(f.sku, 1, 1); if (!k2) continue; slotAdd(k2, f.sku, 1); S.floor.splice(i, 1); moved++; floorN++; }
        if (moved) { S.stats.putaway += moved; sfx('crate'); toast(moved + ' surplus box' + (moved > 1 ? 'es' : '') + ' back on the racks' + (floorN ? ' (' + floorN + ' off the floor)' : ''), 'good'); logEvent('Returned ' + moved + ' surplus boxes to the racks' + (floorN ? ', ' + floorN + ' of them off the floor' : ''), 'good'); hudDirty = true; screenDirtyAll(); if (ui.panelOpen) renderPanel(); }
        else toast('Nothing surplus to return.', '');
        return moved;
      }
    /* 09-orders.js */
    function surplusCount() { var sur = benchSurplus(), n = 0; for (var k in sur) n += sur[k]; S.floor.forEach(function (f) { if (f.kind === 'box' && !f.damaged && insideHall(f.x, f.z)) n++; }); return n; }
    /* 09-orders.js */
    function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
    /* 09-orders.js */
    function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
    /* 09-orders.js */
    function canPackShort(o) { if (BOOT_STAGE === 0) return false; var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
    /* 09-orders.js */
    function shipOrder(o, door) {   // door: the outbound door the parcel left by; the wrong lane's door pays the forwarding fee
        var late = orderLate(o), m = orderMode(o), wrong = lanesOn() && door !== undefined && modeDoor(m) !== door && !sorterOwned(), amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1) * (wrong ? MODE_FEE : 1));
        if (wrong) S.stats.misrouted = (S.stats.misrouted || 0) + 1;
        pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : '') + (wrong ? ' (' + m + ' parcel out of ' + dockLabel(door) + ': forwarding fee)' : ''));
        if (!late) contractSlots().forEach(function (k) { var c = S[k]; if (c && c.accepted && c.client === o.client) { c.done++; if (c.done >= c.need) contractSettle(k); else feedPush('Contract: ' + c.done + ' of ' + c.need, 'good'); } });
        addRep(late ? -1 : o.rush ? 3 : 1.5); S.stats.shipped++; if (late) S.stats.late++; addXp(XP.ship);
        o.state = 'shipped'; o.shippedAt = nowAbs(); o.paid = amount;
        for (var i = 0; i < S.orders.length; i++) if (S.orders[i] === o) { S.orders.splice(i, 1); break; }
        S.shipped.unshift({ num: o.num, client: o.client, paid: amount, late: late, short: o.short, day: S.day, mode: m, wrong: wrong, form: o.form || null, lines: o.lines.map(function (l) { return { sku: l.sku, qty: l.qty }; }) }); if (S.shipped.length > 40) S.shipped.pop();
        sfx('cash'); hudDirty = true;
        return amount;
      }
    /* 09-returns.js */
    var RETURNS = { level: UNLOCK.returns, chance: 0.3, max: 2, fee: 10, perBox: 4, deskCap: 4, shelfCap: 8, inspectSec: 5, lateHours: 24, hallDeskCap: 8, hallShelfCap: 24, truckMin: 3, truckMax: 6 };
    /* 09-returns.js */
    function returnById(id) { var rs = S.returns || []; for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i]; return null; }
    /* 09-returns.js */
    function returnsHall() { return !!(S.up && S.up.hall2); }
    /* 09-returns.js */
    function rdeskStations() { return returnsHall() ? 3 : 1; }
    /* 09-returns.js */
    function rdeskCap() { return returnsHall() ? RETURNS.hallDeskCap : RETURNS.deskCap; }
    /* 09-returns.js */
    function rdesk() {
        if (!S.rdesk) S.rdesk = { queue: [], s: [], shelf: [], done: 0 };
        var D = S.rdesk;
        if (!D.s) { D.s = [{ cur: D.cur || null, t: D.t || 0 }]; delete D.cur; delete D.t; }   // 1.16 saves had the one station in cur/t
        while (D.s.length < rdeskStations()) D.s.push({ cur: null, t: 0 });
        return D;
      }
    /* 09-returns.js */
    function returnFee(r) { var n = 0; (r ? r.lines : []).forEach(function (l) { n += l.qty; }); return RETURNS.fee + RETURNS.perBox * n; }
    /* 09-returns.js */
    function returnLabel(r) { return 'Return #' + r.num + ' from ' + clientName(r.client); }
    /* 09-returns.js */
    function returnPlace(id) {
        if (S.hand && S.hand.kind === 'return' && S.hand.id === id) return 'hand';
        for (var i = 0; i < S.trucks.length; i++) if ((S.trucks[i].returns || []).indexOf(id) >= 0) return 'truck';
        for (var k = 0; k < S.floor.length; k++) if (S.floor[k].kind === 'return' && S.floor[k].id === id) return 'floor';
        for (var bk in (S.belts || {})) { var arr = S.belts[bk]; for (var q = 0; q < arr.length; q++) if (arr[q].ret === id) return 'belt'; }
        var D = rdesk(); if (D.queue.indexOf(id) >= 0) return 'desk'; for (var j = 0; j < D.s.length; j++) if (D.s[j].cur === id) return 'inspecting';
        for (var s = 0; s < S.staff.length; s++) { var c = S.staff[s].carry; if (c && c.kind === 'return' && c.id === id) return 'staff'; }
        return null;
      }
    /* 09-returns.js */
    function returnPlaceText(r) { var p = returnPlace(r.id); if (p === 'truck') { var t = S.trucks.filter(function (x) { return (x.returns || []).indexOf(r.id) >= 0; })[0]; return 'on the truck at ' + (t ? dockLabel(doorIndex(t.dir, t.dock)) : '?'); } return p === 'hand' ? 'in your hands' : p === 'floor' ? 'on the floor' : p === 'belt' ? 'on the returns belt' : p === 'desk' ? (returnsHall() ? 'waiting at the intake' : 'waiting on the desk') : p === 'inspecting' ? 'being inspected' : p === 'staff' ? 'with the crew' : 'gone'; }
    /* 09-returns.js */
    function returnsPending() { return (S.returns || []).filter(function (r) { return returnPlace(r.id) !== null; }); }
    /* 09-returns.js */
    function rdeskPrompt(k) {
        var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall();
        if (S.hand && S.hand.kind === 'return') return D.queue.length < rdeskCap() ? 'Put the return ' + (hall ? 'in the queue' : 'on the desk') + ' (' + D.queue.length + ' waiting)' : 'The queue is full: inspect one first';
        if (S.hand || player.tool) return null;
        if (st.cur) { var rc = returnById(st.cur); return 'Inspecting return #' + (rc ? rc.num : '?') + ' · ' + Math.ceil(st.t) + ' s'; }
        if (D.queue.length) { var rq = returnById(D.queue[0]); return 'Inspect return #' + (rq ? rq.num : '?') + ' (' + D.queue.length + ' waiting) · ' + money(returnFee(rq)) + ' fee'; }
        return (hall ? 'Inspection desk ' + (k + 1) : 'Returns desk') + ' · ' + (D.shelf.length ? D.shelf.length + ' box' + (D.shelf.length > 1 ? 'es' : '') + (hall ? ' in the cage · ' : ' on the shelf · ') : '') + D.done + ' inspected · ' + (hall ? 'returns come in on the returns truck and the outbound trucks' : 'returns ride in on the outbound trucks');
      }
    /* 09-returns.js */
    function rdeskUse(k) {
        var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall();
        if (S.hand && S.hand.kind === 'return') { if (D.queue.length >= rdeskCap()) { toast('The queue is full. Inspect one first.', 'bad'); sfx('bad'); return; } D.queue.push(S.hand.id); handSet(null); sfx('putdown'); screenDirtyAll(); hudDirty = true; return; }
        if (S.hand || player.tool) return;
        if (st.cur) { toast('Inspecting. ' + Math.ceil(st.t) + ' seconds to go.', ''); return; }
        if (!D.queue.length) { sfx('click'); toast(D.shelf.length ? 'Take the boxes off the ' + (hall ? 'restock cage' : 'shelf') + ': good ones to the racks, damaged ones to the ' + (hall ? 'compactor' : 'bin') + '.' : 'Nothing to inspect. ' + (hall ? 'Returns come in on the returns truck and the outbound trucks.' : 'Returns come in on the outbound trucks.'), ''); return; }
        if (!powered()) { toast('No power: the desk scanner is dead.', 'bad'); sfx('bad'); return; }
        rdeskStart(k);
      }
    /* 09-returns.js */
    function rdeskStart(k) { var D = rdesk(), st = D.s[k || 0]; if (!st || st.cur || !D.queue.length) return false; st.cur = D.queue.shift(); st.t = RETURNS.inspectSec; sfx('scan'); screenDirtyAll(); return true; }
    /* 09-returns.js */
    function returnsDeskBuildFor(k, label) { return function (c, P, inst) {
        var TOP = std({ color: 0x8f98a3, roughness: 0.45, metalness: 0.35 }), FRAME = MAT.steelDark, PLATE = std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), TAN = std({ color: 0xc9a46a, roughness: 0.8 });
        c.box(2.0, 0.05, 0.8, TOP, 0, 1.0, 0); [[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].forEach(function (o) { c.box(0.05, 1.0, 0.05, FRAME, o[0], 0.5, o[1]); });
        c.box(1.9, 0.03, 0.7, FRAME, 0, 0.12, 0); c.box(1.9, 0.03, 0.7, FRAME, 0, 0.54, 0);   // the two shelves for the opened boxes
        c.box(0.6, 0.02, 0.6, PLATE, 0.6, 1.035, -0.05); c.box(0.04, 0.26, 0.04, FRAME, 0.92, 1.16, -0.3);   // the scale plate and its readout post at the back
        var rg = new THREE.Group(); rg.position.set(0.92, 1.3, -0.3); rg.rotation.order = 'YXZ'; rg.rotation.x = -0.3; c.add(rg); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, rg); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, rg);
        c.box(0.24, 0.13, 0.17, MAT.white, -0.82, 1.09, 0.22); c.box(0.004, 0.09, 0.07, MAT.paper, -0.69, 1.07, 0.22); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), -0.76, 1.14, 0.31);   // the label printer
        var tgn = new THREE.Group(); tgn.position.set(-0.25, 1.03, 0.22); tgn.rotation.y = 0.5; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, FRAME, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2;   // the tape gun
        c.box(0.22, 0.012, 0.3, MAT.black, 0.12, 1.03, 0.2).rotation.y = -0.2; c.box(0.2, 0.006, 0.27, MAT.paper, 0.12, 1.04, 0.2).rotation.y = -0.2; c.box(0.08, 0.02, 0.03, FRAME, 0.12, 1.05, 0.33).rotation.y = -0.2;   // the clipboard
        c.box(0.3, 0.1, 0.3, std({ color: 0x3a4149, roughness: 0.6 }), -0.6, 1.08, -0.18);   // the parcel tray the queue stands in
        var post = c.cyl(0.02, 2.3, FRAME, 0, 1.15, -0.38, 8); post.castShadow = false; c.box(0.9, 0.03, 0.03, FRAME, 0, 2.3, -0.38);
        c.sign([label], 0.9, 0.22, 0, 2.15, -0.36, 0, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' }); c.sign([label], 0.9, 0.22, 0, 2.15, -0.4, Math.PI, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
        c.plane(2.2, 0.9, std({ color: 0x242c36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.004, 0.9, -Math.PI / 2, 0);   // the mat where you stand
        // the lamp over the scale: dark when idle, lit with returns waiting, blinking while it inspects (a dynamic subgroup, so the bake leaves it)
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.add(dyn); c.box(0.03, 0.03, 0.4, FRAME, 0.6, 1.62, -0.2); c.cyl(0.02, 0.6, FRAME, 0.6, 1.32, -0.38, 8); inst.lamp = box(0.09, 0.07, 0.09, glowMat(0xf5b53d, 0.12), 0.6, 1.58, -0.02, dyn);
        // the terminal on its stand at the end, screen facing the working side
        var tg = new THREE.Group(); tg.position.set(1.35, 0, -0.05); c.add(tg);
        cyl(0.22, 0.03, FRAME, 0, 0.015, 0, tg, 16); cyl(0.2, 0.02, MAT.rubber, 0, 0.04, 0, tg, 16); cyl(0.03, 1.5, FRAME, 0, 0.78, 0, tg, 10); box(0.64, 0.5, 0.03, MAT.black, 0, 1.56, -0.03, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.28, 1.34, -0.01, tg);
        var scr = touchScreen({ w: 320, h: 240, res: 3, pw: 0.58, ph: 0.435, x: 0, y: 1.56, z: -0.01, ry: 0, parent: tg, title: label === 'RETURNS' ? 'Returns desk' : 'Inspection desk ' + (k + 1), draw: function (cc, sc) { rdeskScreenDraw(cc, sc, k); } }); scr.mesh.userData.propId = inst.id;
        c.solid(-1.05, 1.05, -0.45, 0.45, 0, 1.05); c.solid(1.12, 1.58, -0.3, 0.2, 0, 1.9);
        c.hit(2.2, 1.3, 1.0, 0, 0.7, 0, { prompt: function () { return rdeskPrompt(k); }, use: function () { rdeskUse(k); } });
      }; }
    /* 09-returns.js */
    function rdeskScreenDraw(c, sc, k) {
        var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall(); scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.16)'); scHead(c, sc.w, hall ? 'INSPECTION ' + (k + 1) : 'RETURNS', D.done + ' inspected');
        var y = 60;
        if (st.cur) { var r = returnById(st.cur); scText(c, 16, y, 'Inspecting #' + (r ? r.num : '?') + ' · ' + (r ? clientName(r.client).slice(0, 18) : ''), '#f5b53d', 14); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, y + 10, sc.w - 32, 10); c.fillStyle = '#f5b53d'; c.fillRect(16, y + 10, (sc.w - 32) * clamp(1 - st.t / RETURNS.inspectSec, 0, 1), 10); y += 36; }
        else if (D.queue.length) { var q0 = returnById(D.queue[0]); scText(c, 16, y, (q0 ? returnLabel(q0) : 'A return') + ' waiting', '#eef1f5', 14); scText(c, 16, y + 17, q0 ? q0.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + q0.why : '', '#a0acb8', 11); scButton(sc, sc.w - 116, y - 14, 100, 30, 'INSPECT', powered(), function () { if (!powered()) { toast('No power.', 'bad'); return; } rdeskStart(k); }, '#5fd38d'); y += 40; }
        else { scText(c, 16, y, 'Nothing waiting', '#5fd38d', 14); scText(c, 16, y + 17, hall ? 'The belt brings them in from the returns dock' : 'Returns come in on the outbound trucks: look in the trailer', '#a0acb8', 11); y += 40; }
        if (D.queue.length > (st.cur ? 0 : 1)) { scText(c, 16, y, 'Also waiting: ' + D.queue.slice(st.cur ? 0 : 1).map(function (id) { var r2 = returnById(id); return '#' + (r2 ? r2.num : '?'); }).join(', '), '#a0acb8', 11); y += 18; }
        var good = D.shelf.filter(function (b) { return !b.damaged; }).length, bad = D.shelf.length - good;
        scText(c, 16, y + 4, (hall ? 'In the cage: ' : 'On the shelves: ') + (D.shelf.length ? good + ' resaleable' + (bad ? ', ' + bad + ' damaged' : '') : 'nothing'), D.shelf.length ? '#eef1f5' : '#6b7784', 13); y += 22;
        if (D.shelf.length) scText(c, 16, y + 2, (good ? 'good ones go back on a rack' : '') + (good && bad ? ' · ' : '') + (bad ? 'damaged ones go in the ' + (hall ? 'compactor' : 'bin') + ', no charge' : ''), '#a0acb8', 11);
        var pend = returnsPending().length - D.queue.length - D.s.filter(function (x) { return x.cur; }).length;
        scText(c, 16, sc.h - 40, pend > 0 ? pend + ' more return' + (pend > 1 ? 's' : '') + ' out there: on a truck, the belt or the floor' : 'Fee: ' + money(RETURNS.fee) + ' a return and ' + money(RETURNS.perBox) + ' a box', pend > 0 ? '#f5b53d' : '#6b7784', 11);
        scText(c, 16, sc.h - 22, 'A return left a day costs reputation', '#6b7784', 10);
      }
    /* 10-vehicles.js */
    var jackMesh = null, jackMeshes = {}, cartMesh = null, forkM = null, driving = false, forkSpeed = 0, forkLook = { yaw: 0, pitch: 0 }, jackModel = null;
    /* 10-vehicles.js */
    function isJack(t) { return t === 'jack' || t === 'jack2'; }
    /* 10-vehicles.js */
    function jackTool() { return isJack(player.tool) ? player.tool : 'jack'; }
    /* 10-vehicles.js */
    function toolWorld(tool) {
        if (player.tool === tool) return { x: player.x - Math.sin(player.yaw) * 1.15, z: player.z - Math.cos(player.yaw) * 1.15, ry: player.yaw + Math.PI };
        var t = S[tool]; return { x: t.x, z: t.z, ry: t.rot || 0 };
      }
    /* 10-vehicles.js */
    function cartParcels() { if (!S.cart.parcels) S.cart.parcels = []; return S.cart.parcels; }
    /* 10-vehicles.js */
    function cartLoad() { return S.cart.boxes.length + cartParcels().length; }
    /* 10-vehicles.js */
    function releaseTool() { if (!player.tool) return; if (player.tool === 'cable') { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; } var w = toolWorld(player.tool), tm = isJack(player.tool) ? jackMeshes[player.tool] : cartMesh; if (tm && tm.userData.towRy !== undefined) { w.ry = tm.userData.towRy; w.x = tm.position.x; w.z = tm.position.z; } var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
    /* 10-vehicles.js */
    function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
    /* 11-staff.js */
    function slotStand(key) { var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l), a = sp.ry || 0, nx = Math.sin(a), nz = Math.cos(a); var A = { x: sp.x + nx * 1.4, z: sp.z + nz * 1.4 }, B = { x: sp.x - nx * 1.4, z: sp.z - nz * 1.4 }; if (NAV.dirty || !NAV.grid) navBuild(); var ca = navCell(A), cb = navCell(B); if (navOpen(ca.i, ca.j)) return A; if (navOpen(cb.i, cb.j)) return B; return A; }
    /* 11-staff.js */
    var staffMeshes = {};
    /* 11-staff.js */
    var VOICE = {
        Jo:   { hi: 'Morning, boss. What have we got?', bye: 'That is me done. See you tomorrow.', onit: 'On it.', full: 'Bench is full, boss.', nospace: 'No rack space for this one.', idle: ['Quiet one today.', 'Did you see the game last night?', 'Coffee machine is on the blink again.', 'That truck driver never stops talking.'], brk: 'Lunch. Back in a bit.' },
        Mika: { hi: 'Right. Clocking in.', bye: 'Home time.', onit: 'Yep.', full: 'Bench. Full.', nospace: 'Nowhere to put it.', idle: ['Hm.', 'Could use a second jack.', 'Rain again.', 'Row C needs sorting.'], brk: 'Break.' },
        Sam:  { hi: 'Alright mate, what is the plan?', bye: 'Cheers, see you tomorrow mate.', onit: 'Leave it with me.', full: 'Bench is rammed, mate.', nospace: 'Racks are chocka, mate.', idle: ['Fancy a brew after this?', 'Those tyres weigh a ton.', 'Reckon it will rain?', 'New lad on the gate is alright.'], brk: 'Sarnie time.' },
        Ravi: { hi: 'Good morning. Ready when you are.', bye: 'Have a good evening.', onit: 'Certainly.', full: 'The bench cannot take any more.', nospace: 'There is no slot for this line.', idle: ['The orders are picking up.', 'I counted row A twice. It is right.', 'Lovely day for it.', 'The inspector is due soon, I think.'], brk: 'I will take my break now.' },
        Lena: { hi: 'Hey. Let us get it moving.', bye: 'Done for today. Night.', onit: 'Got it.', full: 'Bench is maxed.', nospace: 'Zero slots left for that.', idle: ['Forklift beeps are stuck in my head.', 'Who left the dock open?', 'I like the new sign.', 'Need more tape at the bench.'], brk: 'Lunch!' },
        Ada:  { hi: 'Morning all.', bye: 'Off home.', onit: 'Sure.', full: 'No room on the bench.', nospace: 'Racks are full for that line.', idle: ['Peaceful.', 'Trucks are late today.', 'Nice and tidy, that row.', 'I will sort the empties later.'], brk: 'Tea break.' },
        Theo: { hi: 'Yo. Clocking in.', bye: 'Peace.', onit: 'Say less.', full: 'Bench is packed out.', nospace: 'Nowhere for it, chief.', idle: ['Radio is decent today.', 'Who ordered forty lamps?', 'Yard is slippy.', 'Pigeons are back.'], brk: 'Food.' },
        Nour: { hi: 'Good morning. Shall we?', bye: 'Goodnight, everyone.', onit: 'Of course.', full: 'The bench is full, I am afraid.', nospace: 'No rack space for this pallet.', idle: ['The clients are happy this week.', 'I rewrote the pick list.', 'It is cold in here.', 'Nice work on that order.'], brk: 'Lunch time.' }
      };
    /* 11-staff.js */
    function voice(st) { return VOICE[st.name] || VOICE.Jo; }
    /* 11-staff.js */
    function staffSay(st, text, col) { var m = staffMeshes[st.id]; if (m && m.visible) say(m, text, col); }
    /* 11-staff.js */
    function staffById(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
    /* 11-staff.js */
    function hireStaff(role) {
        var def = STAFF_ROLES[role]; if (!def) return;
        if (S.level < def.lvl) { toast('A ' + def.name.toLowerCase() + ' can be hired from level ' + def.lvl + '.', 'bad'); return; } if (S.staff.length >= staffCap()) { toast('The crew is ' + staffCap() + ' at this level: it grows as you level.', 'bad'); return; }   // the ladder gates the hire itself, not only the buttons (1.21.0)
        if (def.needs && !S.up[def.needs]) { toast('Buy the forklift first: a driver needs something to drive.', 'bad'); return; }
        var used = S.staff.map(function (s) { return s.name; }), free = STAFF_NAMES.filter(function (n) { return used.indexOf(n) < 0; }), name = free.length ? free[S.nextStaffName++ % free.length] : STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];   // no two Jos
        var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0, punct: randf(0.2, 1), arriveOff: 0, hoursToday: 0, sheet: [] };
        S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase() + '. Paid ' + money(def.wage / 10) + ' an hour from the time clock, time and a half past ten hours.', 'good'); hudDirty = true; if (S.time < 17 && !isSunday()) { st.state = 'home'; st.arriveOff = Math.max(0, Math.round((S.time + 0.15 - SHIFT_START) * 60)); }   // hired before the shift: they come in at the start, not in the night
      }
    /* 11-staff.js */
    function fireStaff(id) {
        var st = staffById(id); if (!st) return;
        staffDropAll(st); var fh = st.hoursToday || 0; if (fh > 0.05 && st.clocked !== undefined) { var fpay = Math.round(hourly(st) * (Math.min(fh, 10.25) + Math.max(0, fh - 10.25) * 1.5)); if (fpay > 0) pay(-fpay, 'Final pay, ' + st.name + ' (' + (Math.round(fh * 10) / 10) + ' h)'); }   // the hours worked today are paid on the way out
        var m = staffMeshes[id]; if (m) { if (m.userData.jack) scene.remove(m.userData.jack); if (m.userData.hit) { var hi = inter.indexOf(m.userData.hit); if (hi >= 0) inter.splice(hi, 1); } scene.remove(m); delete staffMeshes[id]; }
        S.staff.splice(S.staff.indexOf(st), 1); logEvent(st.name + ' let go'); hudDirty = true;
      }
    /* 11-staff.js */
    function buildStaffMesh(st) {
        var vest = st.role === 'receiver' ? MAT.hivisOrange : st.role === 'picker' ? MAT.hivis : st.role === 'driver' ? MAT.hivis : MAT.green;
        var look = st.look || {};
        var g = makeHuman({ skin: look.skin, hair: look.hair, style: look.style, vest: vest, hardhat: st.role === 'receiver' || st.role === 'driver' ? (st.role === 'driver' ? MAT.yellow : MAT.white) : null, name: st.name }); g.userData.dynamic = true; g.position.set(st.x, 0, st.z); scene.add(g); staffMeshes[st.id] = g;
        if (hasJack(st) && jackModel) g.userData.jack = jackModel('staffjack', true);
        g.userData.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { staffId: st.id, prompt: function () { return staffPrompt(st); }, use: function () { staffUse(st); } }, g);   // look at a worker: name, job, status, timekeeping   // a receiver has a pallet jack of their own: pushed under the pallet, towed behind them when empty
      }
    /* 11-staff.js */
    function staffDriving() { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].state === 'drive') return S.staff[i]; return null; }
    /* 11-staff.js */
    function staffDropAll(st) {
        if (st.state === 'drive') driverDismount(st);
        S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = floorY(p.x, p.z); p.rot = st.yaw; p.staff = null; } });   // a pallet on the jack is set down where the worker stands (two metres ahead put it inside the rack they were facing)
        if (st.carry) {
          var cy = st.carry, bk = cy.kind === 'box' && !cy.damaged ? findSlotFor(cy.sku, 1, 1) : null;
          if (cy.kind === 'box') { if (bk) slotAdd(bk, cy.sku, 1); else S.floor.push({ kind: 'box', sku: cy.sku, damaged: !!cy.damaged, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
          else if (cy.kind === 'return') { if (rdesk().queue.length < rdeskCap()) rdesk().queue.push(cy.id); else S.floor.push({ kind: 'return', id: cy.id, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
          else if (orderById(cy.order) && S.bench.parcels.length < shelfCap()) S.bench.parcels.push(cy.order);
          else if (orderById(cy.order)) S.floor.push({ kind: 'parcel', order: cy.order, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw });
          st.carry = null;
        }
        st.task = null; st.state = 'idle'; st.path = [];
      }
    /* 11-staff.js */
    function pickInFlight() {
        var n = {}, add = function (sku) { n[sku] = (n[sku] || 0) + 1; };
        ['pickBelt', 'pickBelt2', 'pickMerge', 'upperPick', 'upperChute'].forEach(function (bid) { if (BELTS[bid]) beltItems(bid).forEach(function (it) { if (it.kind === 'box') add(it.sku); }); });
        if (S.up.gantry) gantryRows().forEach(function (r) { var G = gantryState(r); if (G.sku && G.state !== 'idle') add(G.sku); });
        S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') { if (!st.carry.back && !st.carry.bin) add(st.carry.sku); } else if (st.task && st.task.kind === 'pick') add(st.task.sku); });
        return n;
      }
    /* 11-staff.js */
    function driverDismount(st) {
        var p = S.fork.pallet ? palletById(S.fork.pallet) : null;
        if (p && st.task && st.task.pallet === p.id) { var ft = forkTip(); p.place = 'floor'; p.x = ft.x; p.z = ft.z; p.y = 0; p.rot = S.fork.yaw; S.fork.pallet = null; }
        if (!S.fork.pallet) S.fork.lift = Math.min(S.fork.lift, 0.3);
        st.drive = null; st.task = null; st.state = 'idle'; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw;
      }
    /* 11-staff.js */
    var JACK_HOME = BOOT_STAGE === 0 ? { x: -3.9, z0: 4.1, step: 0 } : { x: -HALL.x + 1.3, z0: BOOT_STAGE >= 2 ? 11.4 : -2.0, step: 1.5 };
    /* 11-staff.js */
    function hasJack(st) { return st.role === 'receiver' || st.cross === 'receiver'; }
    /* 11-staff.js */
    function jackRank(st, list) { var n = 0; list = list || S.staff; for (var i = 0; i < list.length; i++) { var o = list[i]; if (o === st) return n; if (hasJack(o)) n++; } return n; }
    /* 11-staff.js */
    function jackHome(st, list) { var k = jackRank(st, list); return { x: JACK_HOME.x, z: JACK_HOME.z0 + k * JACK_HOME.step, ry: -Math.PI / 2 }; }
    /* 11-staff.js */
    function punctWord(st) { var p = st.punct === undefined ? 0.6 : st.punct; return p >= 0.75 ? 'reliable' : p >= 0.4 ? 'fair timekeeper' : 'poor timekeeper'; }
    /* 11-staff.js */
    function staffPrompt(st) { return st.name + ' · ' + STAFF_ROLES[st.role].name.toLowerCase() + (st.cross && STAFF_ROLES[st.cross] ? ' (and ' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + ' · ' + staffStatus(st) + ' · ' + punctWord(st) + (st.lateToday && !st.wordToday ? ' · E: have a word about the time' : ''); }
    /* 11-staff.js */
    function staffUse(st) { if (st.lateToday && !st.wordToday) { staffWord(st); staffSay(st, pick(['Sorry, boss. Will not happen again.', 'Yes, I know. Sorry.', 'Alarm did not go off. Sorry.']), '#a0acb8'); return; } staffSay(st, pick(voice(st).idle), '#a0acb8'); sfx('click'); }
    /* 11-timeclock.js */
    var RAMP_BOTTOM = { x: -HALL.x - 7.3, z: SPOT.staffDoor.z }, SHIFT_START = 8;
    /* 11-timeclock.js */
    var STAFF_SHIFTS = { early: { start: 6, end: 16 }, day: { start: 8, end: 18 }, late: { start: 12, end: 22 } }, TRAIN_PRICE = 400, CROSS_PRICE = 350, RAISE_PRICE = 250;
    /* 11-timeclock.js */
    function shiftOf(st) { return STAFF_SHIFTS[st.shift] || STAFF_SHIFTS.day; }
    /* 11-timeclock.js */
    function shiftStart(st) { return shiftOf(st).start; }
    /* 11-timeclock.js */
    function hourly(st) { return STAFF_ROLES[st.role].wage / 10 * (st.raise ? 1.1 : 1); }
    /* 11-timeclock.js */
    function staffArrival(st) { return shiftStart(st) + (st.arriveOff || 0) / 60; }
    /* 11-timeclock.js */
    function staffCap() { return staffCapAt(S.level); }
    /* 11-timeclock.js */
    function staffTrain(st) { if (st.trained) return; if (!unlocked('training')) { toast('Training courses come at level ' + UNLOCK.training + '.', 'bad'); return; } if (S.bank < TRAIN_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-TRAIN_PRICE, 'Training course, ' + st.name); st.trained = true; sfx('cash'); toast(st.name + ' is trained: quicker on their feet and at every task', 'good'); logEvent(st.name + ' finished the ' + STAFF_ROLES[st.role].name.toLowerCase() + ' course', 'good'); }
    /* 11-timeclock.js */
    function staffRaise(st) { if (st.raise) return; if (!unlocked('raise')) { toast('Raises come at level ' + UNLOCK.raise + '.', 'bad'); return; } if (S.bank < RAISE_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-RAISE_PRICE, 'Raise for ' + st.name); st.raise = true; st.punct = 1; if ((st.arriveOff || 0) > 0) st.arriveOff = 0; sfx('cash'); staffSay(st, pick(['Cheers, boss.', 'I will not let you down.', 'Appreciated.']), '#5fd38d'); logEvent(st.name + ' got a raise: 10% more an hour, and on time from now on', 'good'); }
    /* 11-timeclock.js */
    function staffShiftCycle(st) { if (!unlocked('shifts')) { toast('Shift patterns come at level ' + UNLOCK.shifts + '.', 'bad'); return; } var order = ['day', 'early', 'late'], cur = st.shiftNext || st.shift || 'day', nx = order[(order.indexOf(cur) + 1) % 3], now = st.state === 'home' && !st.clocked && !st.clockedOutAt; if (now) { st.shift = nx; st.shiftNext = null; } else st.shiftNext = nx; var sh = STAFF_SHIFTS[nx]; sfx('click'); toast(st.name + ' moves to the ' + nx + ' shift' + (now ? '' : ' from tomorrow') + ' (' + fmtTime(sh.start) + ' to ' + fmtTime(sh.end) + ')', 'good'); logEvent(st.name + ' moves to the ' + nx + ' shift' + (now ? '' : ' from tomorrow')); }
    /* 11-timeclock.js */
    function staffCrossCycle(st) {
        if (!unlocked('cross')) { toast('Second roles come at level ' + UNLOCK.cross + '.', 'bad'); return; }
        var roles = Object.keys(STAFF_ROLES).filter(function (r) { return r !== st.role && !(STAFF_ROLES[r].needs && !S.up[STAFF_ROLES[r].needs]); }); if (!roles.length) return;
        var i = roles.indexOf(st.cross || ''), next = i < 0 ? roles[0] : i + 1 < roles.length ? roles[i + 1] : null;
        if (next && !st.crossPaid) { if (S.bank < CROSS_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-CROSS_PRICE, 'Cross-training, ' + st.name); st.crossPaid = true; }
        st.cross = next; if (st.state === 'idle') st.task = null; sfx('click');   // a worker mid-task keeps it: dropping a fetch or a pick orphaned the claim
        var cm = staffMeshes[st.id], wantJack = st.role === 'receiver' || st.cross === 'receiver';
        if (cm && wantJack && !cm.userData.jack && jackModel) cm.userData.jack = jackModel('staffjack', true);
        if (cm && !wantJack && cm.userData.jack) { scene.remove(cm.userData.jack); cm.userData.jack = null; st.jackParked = false; st.jackAt = null; }
        toast(next ? st.name + ' also covers ' + STAFF_ROLES[next].name.toLowerCase() + ' work when their own queue is empty' : st.name + ' sticks to ' + STAFF_ROLES[st.role].name.toLowerCase() + ' work', 'good');
      }
    /* 11-timeclock.js */
    function staffStatus(st) {
        if (isSunday()) return 'Sunday';
        if (st.sick) return 'called in sick'; if (st.dayOff) return 'day off';
        if (st.state === 'home' && S.time < staffArrival(st)) return 'due ' + fmtTime(staffArrival(st));
        if (st.state === 'home' && st.clockedOutAt) return 'clocked out ' + fmtTime(st.clockedOutAt);
        if (st.state === 'home') return 'not in';
        if (!st.clocked) return 'arriving';
        if (st.state === 'break') return 'on break';
        return 'in since ' + fmtTime(st.clockInAt || shiftStart(st)) + (st.overtime ? ' · overtime' : '') + (st.lateToday ? ' · late' : '');
      }
    /* 11-timeclock.js */
    function staffNewDay() {
        S.staff.forEach(function (st) {
          if (st.state !== 'home') { staffDropAll(st); st.state = 'home'; } if (hasJack(st)) { st.jackParked = true; st.jackAt = jackHome(st); }   // the jacks stand in their row overnight, wherever the day left them   // whoever was still in at the roll (a sleep at 17:00, a late shift at midnight) goes home now, or they stand frozen from then on
          if (st.shiftNext) { st.shift = st.shiftNext; st.shiftNext = null; }
          if (st.dayOffNext && !isSunday()) { st.dayOff = true; st.dayOffNext = false; } else st.dayOff = false;   // a day off booked for a Sunday keeps for Monday
          st.sick = !st.dayOff && Math.random() < 0.04;
          if (st.punct === undefined) st.punct = randf(0.2, 1); if (st.raise) st.punct = 1;   // a raise keeps them on time for good
          var p = st.punct, r = Math.random();
          st.arriveOff = p > 0.75 ? randi(-12, -2) : p > 0.4 ? (r < 0.7 ? randi(-6, 4) : randi(6, 14)) : (r < 0.35 ? randi(-3, 3) : randi(8, 28));
          st.overtime = !!st.overtimeNext; st.overtimeNext = false;
          st.said = 0; st.lateToday = false; st.hoursToday = 0; st.clockInAt = null; st.clockedOutAt = null; st.clocked = false; st.wordToday = false; st.leaving = false; st.leavingWait = false;
          if (st.sick) logEvent(st.name + ' called in sick', 'bad');
          if (st.dayOff) logEvent(st.name + ' has the day off');
          if (st.punct < 1 && !st.raise) st.punct = clamp(st.punct - 0.01, 0.1, 1);   // a word wears off slowly
        });
      }
    /* 11-timeclock.js */
    function payStaffWages() {
        S.staff.forEach(function (st) {
          var h = st.hoursToday || 0, base = Math.min(h, 10.25), ot = Math.max(0, h - 10.25), amount = Math.round(hourly(st) * (base + ot * 1.5));   // a quarter hour's grace: an early arrival and the clock-out walk are on the clock too
          if (!st.sheet) st.sheet = []; st.sheet.unshift({ day: S.day - 1, h: Math.round(h * 10) / 10, late: !!st.lateToday, sick: !!st.sick, off: !!st.dayOff, ot: Math.round(ot * 10) / 10, pay: amount }); if (st.sheet.length > 7) st.sheet.pop();
          st.hoursTotal = (st.hoursTotal || 0) + h;
          if (amount > 0) pay(-amount, 'Wages, ' + st.name + ' (' + (Math.round(h * 10) / 10) + ' h' + (ot ? ', ' + (Math.round(ot * 10) / 10) + ' h overtime' : '') + ')');
        });
      }
    /* 11-timeclock.js */
    function staffWord(st) {
        if (st.wordToday) { toast('You already had a word with ' + st.name + ' today.', ''); return; }
        st.wordToday = true; st.punct = clamp(st.punct + 0.35, 0, 0.99); sfx('click');   // short of the raise's pinned 1: a word wears off, a raise does not
        staffSay(st, pick(['Understood, boss.', 'Fair enough. I will be on time.', 'Will not happen again.']), '#f5b53d'); logEvent('Had a word with ' + st.name + ' about timekeeping'); if (S.wordRepDay !== S.day) { S.wordRepDay = S.day; addRep(0.2); }
      }
    /* 11-timeclock.js */
    function myClock(on) {
        if (on === !!S.clockedIn) return;
        if (on) { S.clockedIn = true; S.clockInAt = S.time; S.clockInDay = S.day; introStep('clockin'); S.shiftStart = { shipped: S.stats.shipped, received: S.stats.received, earned: S.stats.earned, spent: S.stats.spent }; sfx('scan'); toast('Clocked in at ' + fmtTime(S.time), 'good'); logEvent('You clocked in at ' + fmtTime(S.time)); if (S.time < 7.5 && S.time >= DAY_START && S.earlyDay !== S.day) { S.earlyDay = S.day; addXp(5); toast('Early bird: +5 XP', 'rare'); } }
        else {
          var h = S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time, ss = S.shiftStart || S.stats;
          S.clockedIn = false; S.stats.hoursWorked = (S.stats.hoursWorked || 0) + h; sfx('scan');
          var rep = 'Shift: ' + (Math.round(h * 10) / 10) + ' h · ' + (S.stats.shipped - ss.shipped) + ' orders shipped · ' + (S.stats.received - ss.received) + ' pallets in · ' + money(S.stats.earned - ss.earned) + ' earned, ' + money(S.stats.spent - ss.spent) + ' spent';
          toast('Clocked out. ' + rep, 'good'); logEvent('You clocked out at ' + fmtTime(S.time) + '. ' + rep, 'rare'); if (h >= 8) addXp(10);
        }
        hudDirty = true; screenDirtyAll();
      }
    /* 11-timeclock.js */
    function myHours() { if (!S.clockedIn) return 0; return S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time; }
    /* 11-timeclock.js */
    var tclock = { page: 0 };
    /* 11-timeclock.js */
    function drawTimeClock(c, sc) {
        scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.16)'); scHead(c, sc.w, tclock.page ? 'TIMESHEET' : 'TIME CLOCK');
        scButton(sc, 230, 8, 60, 24, tclock.page ? 'now' : 'sheet', false, function () { tclock.page = tclock.page ? 0 : 1; });
        var y = 60;
        if (!tclock.page) {
          scText(c, 12, y, 'You · ' + (S.clockedIn ? 'in since ' + fmtTime(S.clockInAt) + ' (' + (Math.round(myHours() * 10) / 10) + ' h)' : 'not clocked in'), S.clockedIn ? '#5fd38d' : '#eef1f5', 13);
          scButton(sc, 12, y + 8, 276, 32, S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', !S.clockedIn, function () { myClock(!S.clockedIn); }, '#5fd38d'); y += 54;
          if (!S.staff.length) scText(c, 12, y + 10, 'No crew yet. Hire on the office PC.', '#6b7784', 12);
          S.staff.forEach(function (st) {
            if (y > sc.h - 30) return;
            scText(c, 12, y, st.name + ' · ' + STAFF_ROLES[st.role].name, '#eef1f5', 12); scText(c, 12, y + 14, staffStatus(st) + (st.hoursToday ? ' · ' + (Math.round(st.hoursToday * 10) / 10) + ' h' : ''), st.lateToday ? '#ff6b5e' : '#a0acb8', 10);
            var otOk = shiftOf(st).end < DAY_END; scButton(sc, 196, y - 10, 28, 22, 'OT', !!(st.overtime || st.overtimeNext), function () { if (!otOk) { toast('The late shift already ends at closing time.', ''); return; } if (st.clocked && !st.sick && !st.dayOff) st.overtime = !st.overtime; else st.overtimeNext = !st.overtimeNext; var e = STAFF_SHIFTS[st.shiftNext || st.shift || 'day'].end; toast(st.name + (st.overtime || st.overtimeNext ? ' works till ' + fmtTime(Math.min(DAY_END, e + 2)) + ' at time and a half' : ' goes home at ' + fmtTime(e)), ''); }, '#f5b53d');
            scButton(sc, 228, y - 10, 30, 22, 'OFF', !!st.dayOffNext, function () { st.dayOffNext = !st.dayOffNext; toast(st.name + (st.dayOffNext ? ' has tomorrow off' : ' is in tomorrow'), ''); }, '#78bdf5');
            if (st.lateToday && !st.wordToday) scButton(sc, 262, y - 10, 28, 22, '!', true, function () { staffWord(st); }, '#ff6b5e');
            y += 27;   // eight rows fit the screen since the crew grew to eight
          });
        } else {
          scText(c, 12, y, 'Last 7 days · hours (overtime) · pay', '#a0acb8', 11); y += 18;
          S.staff.forEach(function (st) {
            if (y > sc.h - 24) return;
            var tot = (st.sheet || []).reduce(function (a, r) { return a + r.pay; }, 0), hrs = (st.sheet || []).reduce(function (a, r) { return a + r.h; }, 0), lates = (st.sheet || []).filter(function (r) { return r.late; }).length;
            scText(c, 12, y, st.name + ' · ' + (Math.round(hrs * 10) / 10) + ' h · ' + money(tot) + (lates ? ' · late ×' + lates : ''), '#eef1f5', 12); y += 14;
            scText(c, 12, y, (st.sheet || []).slice(0, 7).map(function (r) { return r.sick ? 'sick' : r.off ? 'off' : (Math.round((r.h - r.ot) * 10) / 10) + (r.ot ? '+' + r.ot : ''); }).join('  ') || 'no days yet', '#a0acb8', 10); y += 20;
          });
          scText(c, 12, sc.h - 10, 'You: ' + (Math.round((S.stats.hoursWorked || 0) * 10) / 10) + ' h on the clock all time', '#6b7784', 10);
        }
      }
    /* 12-machines.js */
    var MACH = {}, BELTS = {}, BELT_PLANES = [];
    /* 12-machines.js */
    var BELT_SPEED = 0.5, BELT_GAP = 0.45, BELT_Y = 0.75, REACH = 1.3;
    /* 12-machines.js */
    var SPEED_STEPS = [0.5, 0.75, 1, 1.5, 2];
    /* 12-machines.js */
    function speedOf(key) { var v = S.speed && S.speed[key]; return typeof v === 'number' ? v : 1; }
    /* 12-machines.js */
    function speedSteps(key) { return S.up.plantTune || (key === 'sorter' && unlocked('deckTune')) ? SPEED_STEPS.concat([2.5, 3]) : SPEED_STEPS; }
    /* 12-machines.js */
    function speedCycle(key) { if (!S.speed) S.speed = {}; var steps = speedSteps(key), i = steps.indexOf(speedOf(key)); S.speed[key] = steps[(i + 1) % steps.length]; sfx('click'); screenDirtyAll(); }
    /* 12-machines.js */
    function speedButton(sc, x, y, w, key, label) { var pct = Math.round(speedOf(key) * 100) + '%'; scButton(sc, x, y, w, 30, w < 80 ? pct : (label || 'SPD') + ' ' + pct, true, function () { speedCycle(key); }, '#78bdf5'); }
    /* 12-machines.js */
    function beltItems(id) { if (!S.belts) S.belts = {}; if (!S.belts[id]) S.belts[id] = []; return S.belts[id]; }
    /* 12-machines.js */
    var sinkCache = {};
    /* 12-machines.js */
    function beltsChanged() { sinkCache = {}; }
    /* 12-machines.js */
    function beltLabel(b) { return propLabel(b.prop); }
    /* 12-machines.js */
    function doorInside(i) { var d = doors[i]; return d ? [d.side * (HALL.x - 1.2), d.z] : null; }
    /* 12-machines.js */
    function lampSet(m, status) { if (!m.lamps) return; m.lamps.g.visible = status === 'run'; m.lamps.a.visible = status === 'idle'; m.lamps.r.visible = status === 'jam' || status === 'off'; }
    /* 12-machines.js */
    function packStatus() { if (!powered()) return 'off'; if (S.pack.jam) return 'jam'; return S.pack.job ? 'run' : 'idle'; }
    /* 12-machines.js */
    function shelfCap() { return BOOT_STAGE === 0 ? 6 : 12; }
    /* 12-machines.js */
    function packOrder(o) {
        if (o.state !== 'open') return false;
        var n = orderNeed(o); if (n.have < Math.ceil(n.tot / 2)) return false; if (BOOT_STAGE === 0 && n.have < n.tot) return false;   // the shed packs whole orders only
        var boxes = []; o.lines.forEach(function (l) { l.packed = benchTake(l.sku, l.qty); for (var i = 0; i < l.packed; i++) boxes.push(l.sku); });
        o.short = n.have < n.tot; o.state = 'packing'; S.pack.queue.push({ order: o.id, boxes: boxes, fed: 0, inMach: 0, t: 0, hand: BOOT_STAGE === 0 });
        sfx('click'); rebuildBoardSoon(); logEvent('Order #' + o.num + ' released to the pack line' + (o.short ? ' (short)' : ''));
        return true;
      }
    /* 12-machines.js */
    function packPrompt() { if (S.pack.jam) return 'Clear the jam on the pack line'; if (!powered()) return 'Pack line · no power'; var j = S.pack.job; return 'Pack line · ' + (j ? 'packing order #' + (orderById(j.order) || { num: '?' }).num + ' · ' + j.inMach + '/' + j.boxes.length : S.pack.queue.length ? S.pack.queue.length + ' waiting' : 'idle') + ' · ' + S.pack.made + ' parcels made'; }
    /* 12-machines.js */
    function packUse() { if (S.pack.jam) { S.pack.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } openPanel('bench'); }
    /* 12-machines.js */
    function packScreenDraw(c, sc) {
        var st = packStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'CASE TAPER', st.toUpperCase());
        var j = S.pack.job, o = j ? orderById(j.order) : null;
        scText(c, 16, 70, o ? 'Order #' + o.num + ' · ' + clientName(o.client) : 'No job', '#eef1f5', 16);
        scText(c, 16, 94, j ? 'Boxes in: ' + j.inMach + ' / ' + j.boxes.length + (j.inMach >= j.boxes.length ? ' · taping ' + Math.max(0, 3 - j.t).toFixed(1) + ' s' : '') : S.pack.queue.length + ' in the queue', '#a0acb8', 13);
        scText(c, 16, 118, 'Parcels made: ' + S.pack.made + ' · shelf ' + S.bench.parcels.length + '/' + shelfCap(), '#a0acb8', 13);
        if (S.pack.jam) scButton(sc, 16, 140, 150, 34, 'CLEAR JAM', true, function () { packUse(); }, '#ff6b5e');
        speedButton(sc, 176, 142, 108, 'packline'); if (speedOf('packline') > 1 && !S.up.plantAuto) scText(c, 176, 188, 'fast: jams more', '#ff6b5e', 10);
      }
    /* 12-machines.js */
    var FACTORY_RATE = 8;
    /* 12-machines.js */
    function ownSkus() { return SKUS.filter(function (s) { return s.own; }); }
    /* 12-machines.js */
    function factoryStatus() { var F = S.factory; if (!powered()) return 'off'; if (F.jam) return 'jam'; return F.on && F.raw > 0 ? 'run' : 'idle'; }
    /* 12-machines.js */
    function moulderPrompt() { var F = S.factory; if (F.jam) return 'Clear the jam on the moulding line'; return 'Moulding line · ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product) + ' · hopper ' + F.raw + ' · made ' + F.made; }
    /* 12-machines.js */
    function moulderUse() { var F = S.factory; if (F.jam) { F.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } if (!powered()) { toast('No power.', 'bad'); return; } F.on = !F.on; sfx('click'); if (F.on && F.raw <= 0) { F.on = false; toast('The hopper is empty. Tip a pallet of raw granulate in first.', 'bad'); } screenDirtyAll(); }
    /* 12-machines.js */
    function moulderScreenDraw(c, sc) {
        var F = S.factory, st = factoryStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'MOULDING LINE', st.toUpperCase());
        scText(c, 16, 66, 'Hopper ' + F.raw + ' / ' + HOPPER_CAP + ' units' + (F.raw ? ' · a unit a box' : ' · EMPTY'), F.raw ? '#eef1f5' : '#ff6b5e', 14);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 76, sc.w - 32, 10); c.fillStyle = F.raw > 40 ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 76, (sc.w - 32) * clamp(F.raw / HOPPER_CAP, 0, 1), 10);
        scText(c, 16, 108, 'Product', '#6b7784', 11);
        ownSkus().forEach(function (s, i) { scButton(sc, 16 + i * 124, 116, 118, 30, s.name.replace('Depot Co. ', ''), F.product === s.id, function () { F.product = s.id; sfx('click'); }, '#78bdf5'); });
        scButton(sc, 16, 160, 110, 34, F.on ? 'STOP' : 'START', F.on, function () { moulderUse(); }, F.on ? '#ff6b5e' : '#5fd38d');
        if (F.jam) scButton(sc, 136, 160, 120, 34, 'CLEAR JAM', true, function () { moulderUse(); }, '#ff6b5e');
        speedButton(sc, 270, 162, 110, 'moulder');
        scText(c, 16, 220, 'Made ' + F.made + ' · ' + (FACTORY_RATE / speedOf('moulder')).toFixed(0) + ' s a box · one unit of granulate each · the dial also drives its belt', '#a0acb8', 12);
        scText(c, 16, 240, 'Boxes go down the belt to the palletiser in the hall.', '#6b7784', 11);
      }
    /* 12-machines.js */
    var RAW_PER_SACK = 5, HOPPER_CAP = 400;
    /* 12-machines.js */
    function rawPalletInHand() { var p = isJack(player.tool) ? jackPallet() : driving ? forkPallet() : null; return p && p.sku === 'raw' ? p : null; }
    /* 12-machines.js */
    function hopperPrompt() { var p = rawPalletInHand(); if (p) return S.factory.raw + p.n * RAW_PER_SACK > HOPPER_CAP ? 'No room in the hopper for this pallet (' + (HOPPER_CAP - S.factory.raw) + ' units free)' : 'Tip the granulate into the hopper (+' + p.n * RAW_PER_SACK + ')'; return 'Raw hopper · ' + S.factory.raw + ' / ' + HOPPER_CAP + ' units' + (isJack(player.tool) || driving ? ' · bring a pallet of raw granulate' : ''); }
    /* 12-machines.js */
    function hopperUse() {
        var p = rawPalletInHand(); if (!p) { sfx('bad'); return; } if (S.factory.raw + p.n * RAW_PER_SACK > HOPPER_CAP) { toast('The hopper has room for ' + (HOPPER_CAP - S.factory.raw) + ' units; this pallet is ' + p.n * RAW_PER_SACK + '.', 'bad'); sfx('bad'); return; }
        S.factory.raw = Math.min(HOPPER_CAP, S.factory.raw + p.n * RAW_PER_SACK);
        for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === p.id) { S.pallets.splice(i, 1); break; }
        if (S.jack.pallet === p.id) S.jack.pallet = null; if (S.jack2 && S.jack2.pallet === p.id) S.jack2.pallet = null; if (S.fork.pallet === p.id) S.fork.pallet = null;
        S.pallets.push(newPalletObj('empty')); sfx('hydraulic'); addXp(4); toast('Granulate tipped in: hopper at ' + S.factory.raw, 'good'); logEvent('Tipped a pallet of raw granulate into the hopper'); screenDirtyAll(); hudDirty = true;
        if (MACH.hopper.anim) MACH.hopper.anim.tipT = 1.5;
      }
    /* 12-machines.js */
    function newPalletObj() { var w = propWorld('hopper', 1.8, 0.4); for (var k = 1; k < 5 && S.pallets.some(function (q) { return q.place === 'floor' && dist2(q.x, q.z, w.x, w.z) < 1; }); k++) w = propWorld('hopper', 1.8 + k * 1.3, 0.4); return { id: uid('pl'), sku: 'raw', n: 0, place: 'floor', x: w.x, y: 0, z: w.z, rot: w.a }; }
    /* 12-machines.js */
    function hopperScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'HOPPER', F.raw + ' / ' + HOPPER_CAP); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(20, 50, 40, 100); c.fillStyle = '#f5b53d'; var hh = 100 * clamp(F.raw / HOPPER_CAP, 0, 1); c.fillRect(20, 150 - hh, 40, hh); scText(c, 76, 80, 'Raw granulate', '#eef1f5', 14); scText(c, 76, 102, 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units.', '#a0acb8', 11); scText(c, 76, 120, 'Order pallets on the office PC.', '#a0acb8', 11); }
    /* 12-machines.js */
    function palletiserEject() {
        var P = S.pal; if (!P.n) return; var w = propWorld('palletiser', 2.2, 0);
        newPallet(P.sku, P.n, { place: 'floor', x: w.x, z: w.z, rot: w.a, y: 0 }); if (S.seenSkus.indexOf(P.sku) < 0) S.seenSkus.push(P.sku); S.stats.palletised = (S.stats.palletised || 0) + 1;
        logEvent('The palletiser finished a pallet of ' + P.n + ' × ' + skuName(P.sku), 'good'); sfx('hydraulic'); addXp(6); P.sku = null; P.n = 0; screenDirtyAll();
      }
    /* 12-machines.js */
    function palletiserPrompt() { var P = S.pal; return 'Palletiser · ' + (P.n ? P.n + ' × ' + skuName(P.sku) + ' on the pallet · E ejects it' : 'waiting for boxes'); }
    /* 12-machines.js */
    function palletiserUse() { if (S.pal.n) palletiserEject(); else sfx('bad'); }
    /* 12-machines.js */
    function palletiserScreenDraw(c, sc) { var P = S.pal; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'PALLETISER', powered() ? (P.n ? 'STACKING' : 'READY') : 'OFF'); scText(c, 16, 70, P.n ? P.n + ' / 8 · ' + skuName(P.sku) : 'Empty pallet in the cradle', '#eef1f5', 16); for (var i = 0; i < 8; i++) { c.fillStyle = i < P.n ? '#5fd38d' : 'rgba(255,255,255,0.1)'; c.fillRect(16 + i * 30, 86, 24, 24); } speedButton(sc, 148, 125, 136, 'beltMain', 'BELT'); scButton(sc, 16, 124, 120, 32, 'EJECT', P.n > 0, function () { palletiserUse(); }); scText(c, 16, 180, 'Pallets made: ' + (S.stats.palletised || 0), '#a0acb8', 12); lampSet(MACH.palletiser, powered() ? (P.n ? 'run' : 'idle') : 'off'); }
    /* 12-machines.js */
    var BALE_NEED = 10, BALE_PRICE = 18;
    /* 12-machines.js */
    function balerStatus() { if (!powered()) return 'off'; return S.baler.t > 0 ? 'run' : 'idle'; }
    /* 12-machines.js */
    function addWaste(n) { if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; S.baler.card += n; screenDirtyAll(); }
    /* 12-machines.js */
    function balerPrompt() { var B = S.baler; if (B.t > 0) return 'Baling… ' + Math.ceil(B.t) + ' s'; if (!powered()) return 'Baler · no power'; return 'Baler · ' + B.card + ' / ' + BALE_NEED + ' cardboard in the chamber' + (B.card >= BALE_NEED ? ' · E makes a bale' : '') + (B.bales ? ' · ' + B.bales + ' bale' + (B.bales > 1 ? 's' : '') + ' waiting for a truck' : ''); }
    /* 12-machines.js */
    function balerUse() { var B = S.baler; if (B.t > 0 || !powered()) { sfx('bad'); return; } if (B.card < BALE_NEED) { toast('Not enough cardboard yet: ' + B.card + ' of ' + BALE_NEED + '. Binned boxes and packing offcuts fill it.', ''); sfx('bad'); return; } B.t = 8; B.card -= BALE_NEED; sfx('hydraulic'); addXp(3); screenDirtyAll(); }
    /* 12-machines.js */
    function balerScreenDraw(c, sc) { var B = S.baler; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'BALER', balerStatus().toUpperCase()); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 46, sc.w - 32, 12); c.fillStyle = B.card >= BALE_NEED ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 46, (sc.w - 32) * clamp(B.card / BALE_NEED, 0, 1), 12); scText(c, 16, 80, 'Chamber ' + B.card + ' / ' + BALE_NEED, '#eef1f5', 14); scText(c, 16, 100, 'Bales waiting ' + B.bales + ' · made ' + B.made, '#a0acb8', 12); speedButton(sc, 134, 117, 90, 'baler'); scButton(sc, 16, 116, 110, 32, B.t > 0 ? Math.ceil(B.t) + ' s' : 'BALE', B.card >= BALE_NEED && !B.t, function () { balerUse(); }); scText(c, 16, 162, 'Trucks pay ' + money(BALE_PRICE) + ' a bale', '#6b7784', 11); }
    /* 12-machines.js */
    function sellBales(t) { var B = S.baler; if (!B || !B.bales || t.dir !== 'out') return; var n = Math.min(4, B.bales); B.bales -= n; pay(n * BALE_PRICE, 'Cardboard bales collected, ' + n); logEvent(t.driver + ' took ' + n + ' bale' + (n > 1 ? 's' : '') + ' of cardboard: ' + money(n * BALE_PRICE), 'good'); screenDirtyAll(); }
    /* 12-machines.js */
    var FILM_ROLL = 20, FILM_PRICE = 30;
    /* 12-machines.js */
    function wrapperStatus() { if (!powered()) return 'off'; if (!S.wrap || S.wrap.film <= 0) return 'jam'; return wrapperBusy() ? 'run' : 'idle'; }
    /* 12-machines.js */
    function wrapperScreenDraw(c, sc) { var W2 = S.wrap; scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'STRETCH WRAP', wrapperStatus() === 'jam' ? 'NO FILM' : wrapperStatus().toUpperCase()); scText(c, 16, 70, wrapperBusy() ? 'Wrapping… ' + Math.ceil(wrapper.t) + ' s' : 'Bring a pallet on the jack', '#eef1f5', 14); scText(c, 16, 92, 'Film left: ' + W2.film + ' pallets · wrapped ' + W2.wrapped, W2.film > 3 ? '#a0acb8' : '#ff6b5e', 12); speedButton(sc, 172, 111, 56, 'wrapper'); scButton(sc, 16, 110, 150, 32, 'NEW ROLL $' + FILM_PRICE, W2.film < FILM_ROLL && S.bank >= FILM_PRICE, function () { if (S.bank < FILM_PRICE) { sfx('bad'); return; } pay(-FILM_PRICE, 'Stretch film roll'); W2.film = FILM_ROLL; sfx('click'); toast('New film roll fitted', 'good'); }); }
    /* 12-machines2-automation.js */
    function dockLoaderStatus(door) { if (!powered()) return 'off'; var t = truckAtDoor(door), lid = null; for (var k in LOADER_DOORS) if (LOADER_DOORS[k] === door) lid = k; return t && S.doors[door] && lid && stageOf(lid).length ? 'run' : 'idle'; }
    /* 12-machines2-automation.js */
    function dockLoaderPrompt(door) { var t = truckAtDoor(door); return 'Dock loader ' + dockLabel(door) + ' · ' + (!powered() ? 'no power' : t && S.doors[door] ? 'loading, ' + t.parcels.length + ' aboard' : t ? 'open the door and it loads' : 'waiting for a truck at ' + dockLabel(door)) + ' · ' + (S.stats.autoLoaded || 0) + ' loaded by machine so far'; }
    /* 12-machines2-automation.js */
    function agvState() { if (!S.agv) S.agv = { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false }; return S.agv; }
    /* 12-machines2-automation.js */
    function agvDockWorld() { return propInst.agvDock ? propWorld('agvDock', 0, 0) : null; }
    /* 12-machines2-automation.js */
    function agvGo(to, state) { var A = agvState(); A.path = route({ x: A.x, z: A.z }, to); A.state = state; }
    /* 12-machines2-automation.js */
    var agvScreen = null, agvShown = '';
    /* 12-machines2-automation.js */
    function agvScreenDraw(c, sc) {
        var A = agvState(), st = !powered() ? 'off' : A.paused && A.state === 'idle' ? 'paused' : A.state === 'idle' ? 'ready' : 'running', tp = A.pallet ? palletById(A.pallet) : null;
        scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'AGV-1', st.toUpperCase());
        scText(c, 16, 70, A.state === 'idle' ? (A.paused ? 'Held at the dock' : 'Watching the pickup square') : A.state === 'toPickup' ? 'Fetching a pallet' : A.state === 'toSlot' ? 'Putting away' + (A.key ? ' to ' + slotName(A.key) : '') : 'Returning to the dock', '#eef1f5', 16);
        scText(c, 16, 94, tp ? 'Load: ' + tp.n + ' × ' + skuName(tp.sku) : 'Forks empty', '#a0acb8', 13);
        scText(c, 16, 118, 'Put away: ' + (S.stats.agvPutaway || 0) + ' pallets · at ' + A.x.toFixed(1) + ', ' + A.z.toFixed(1), '#a0acb8', 13);
        scText(c, 16, 136, 'Pickup: set a pallet on the square, or let the palletiser drop one', '#6b7784', 11);
        speedButton(sc, 208, 152, 76, 'agv');
        scButton(sc, 16, 150, 80, 34, A.paused ? 'RESUME' : 'PAUSE', !A.paused, function () { A.paused = !A.paused; toast('AGV-1 ' + (A.paused ? 'will hold at the dock after this run' : 'running'), A.paused ? 'bad' : 'good'); }, A.paused ? '#5fd38d' : '#f5b53d');
        scButton(sc, 102, 150, 100, 34, 'DROP LOAD', !!tp, function () { var q = A.pallet ? palletById(A.pallet) : null; if (!q) return; q.place = 'floor'; q.x = A.x + Math.sin(A.yaw) * 1.0; q.z = A.z + Math.cos(A.yaw) * 1.0; q.y = 0; q.rot = A.yaw; A.pallet = null; A.key = null; A.skip = q.id; A.skipT = worldTime + 30; var dk = agvDockWorld(); if (dk) agvGo(dk, 'return'); sfx('putdown'); toast('AGV-1 set its pallet down', ''); }, '#ff6b5e');
      }
    /* 12-machines2-automation.js */
    function agvPrompt() { var A = agvState(); return 'AGV-1 · ' + (!powered() ? 'no power' : A.state === 'idle' ? 'waiting at its dock' : A.state === 'toPickup' ? 'fetching a pallet' : A.state === 'toSlot' ? 'putting a pallet away' : 'returning') + ' · ' + (S.stats.agvPutaway || 0) + ' pallets put away'; }
    /* 12-machines3-gantry.js */
    var GANTRY_SPEED = 3.0, GANTRY_LIFT = 2.0, GANTRY_DROP_X = 46.0;
    /* 12-machines3-gantry.js */
    function gantryBeltFor(r) { return r >= UPPER.row ? 'upperPick' : r >= 3 ? 'pickBelt2' : 'pickBelt'; }
    /* 12-machines3-gantry.js */
    function gantryTop(r) { return r >= UPPER.row ? 3.0 : 5.0; }
    /* 12-machines3-gantry.js */
    function gantryRows() { var out = []; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows && propInst['gantry' + r]) out.push(r); if (S.up.upper && propInst.gantry5) out.push(UPPER.row); return out; }
    /* 12-machines3-gantry.js */
    function gantryState(r) { r = r || 0; if (!S.gantries) S.gantries = {}; if (!S.gantries[r]) S.gantries[r] = { x: GANTRY_DROP_X, lift: 5.0, state: 'idle', sku: null, key: null, t: 0, picked: 0 }; return S.gantries[r]; }
    /* 12-machines3-gantry.js */
    function gantryRowStock(r) { var n = 0, slots = 0; for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === r && s && s.n > 0) { n += s.n; slots++; } } return { n: n, slots: slots }; }
    /* 12-machines3-gantry.js */
    function gantryScreenDraw(r) { return function (c, sc) {
        var G = gantryState(r), st = !powered() ? 'off' : G.paused && G.state === 'idle' ? 'paused' : G.state === 'idle' ? 'ready' : 'running';
        scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GANTRY ' + rowLetter(r), st.toUpperCase());
        var rs = gantryRowStock(r), pos = G.state === 'idle' ? 'parked at the belt' : G.state === 'toBay' ? 'running to bay ' + (Math.round(G.bayX / RACK.bayW - 0.5) + 1) : G.state === 'down' || G.state === 'up' ? 'at the rack' : G.state === 'toDrop' ? 'running to the belt' : 'setting down';
        scText(c, 16, 70, G.sku ? 'Picking ' + skuName(G.sku) : G.paused ? 'Held: finishing nothing' : 'Watching the orders', '#eef1f5', 16);
        scText(c, 16, 94, pos + ' · trolley ' + G.x.toFixed(1) + ' m · hook ' + G.lift.toFixed(1) + ' m', '#a0acb8', 13);
        scText(c, 16, 118, 'Row ' + rowLetter(r) + ': ' + rs.n + ' boxes in ' + rs.slots + ' slots · picked ' + G.picked, '#a0acb8', 13);
        scText(c, 16, 136, 'Belt ' + beltItems(gantryBeltFor(r)).length + ' · bench ' + benchCount() + '/' + benchCapNow(), '#a0acb8', 13);
        speedButton(sc, 208, 152, 76, 'gantry' + r); scText(c, 212, 148, 'crane', '#6b7784', 9); speedButton(sc, 208, 116, 76, 'pickBelt'); scText(c, 212, 112, 'pick belt', '#6b7784', 9);
        scButton(sc, 16, 150, 80, 34, G.paused ? 'RESUME' : 'PAUSE', !G.paused, function () { G.paused = !G.paused; toast('Gantry ' + rowLetter(r) + (G.paused ? ' will hold after this pick' : ' running'), G.paused ? 'bad' : 'good'); }, G.paused ? '#5fd38d' : '#f5b53d');
        scButton(sc, 102, 150, 100, 34, 'RESET JOB', G.state !== 'idle', function () { if (G.state === 'idle') return; if (G.sku && /^(up|toDrop|lower|drop)$/.test(G.state)) { var back = G.key && slotSpace(G.key, G.sku) > 0 ? G.key : findSlotFor(G.sku, 1, 2); if (back) slotAdd(back, G.sku, 1); else S.floor.push({ kind: 'box', sku: G.sku, x: RACK.x0 + G.x, y: 0, z: RACK.rows[r] + 1.2, rot: 0 }); } G.sku = null; G.key = null; G.state = 'up'; sfx('hydraulic'); toast('Gantry ' + rowLetter(r) + ' dropped its job and is coming home', 'good'); }, '#ff6b5e');
      }; }
    /* 12-machines3-gantry.js */
    function gantryPrompt(r) { var G = gantryState(r); return 'Gantry picker ' + rowLetter(r) + ' · ' + (!powered() ? 'no power' : G.state === 'idle' ? 'watching the orders' : G.sku ? 'picking ' + skuName(G.sku) : 'working') + ' · ' + G.picked + ' boxes picked'; }
    /* 12-machines3-gantry.js */
    function buildGantries() { if (!S.up.gantry) return; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows) buildProp('gantry' + r); buildProp('pickBelt'); buildProp('pickMerge'); if (S.up.upper) { buildProp('gantry5'); buildProp('upperPick'); } if (S.up.rows > 3) buildProp('pickBelt2'); }
    /* 12-machines5-upper.js */
    var UPPER = { y: 4.6, z0: -HALL.z + 0.3, z1: -13.5, rowZ: -19.0, row: 5, levels: 2, rise: 8,
        lift: { x: -31.0, z: -15.5 }, shaft: { x0: -32.2, x1: -29.8, z0: -16.7, z1: -14.3 },   // on the deck's south edge by IN 1, east of the first jack's bay at (-33.8, -18); the north-west corner is the break room
        stair: { x0: -25.6, x1: -16.0, z0: -23.4, z1: -21.8 }, well: { x0: -25.6, x1: -20.8 } };
    /* 12-machines5-upper.js */
    function upperOwned() { return !!(S.up && S.up.upper); }
    /* 12-machines5-upper.js */
    function upperRowsOwned() { return upperOwned() ? 1 : 0; }
    /* 12-machines5-upper.js */
    function upperSlotFor(sku, n) {
        for (var pass = 0; pass < 2; pass++) for (var r = UPPER.row; r < UPPER.row + upperRowsOwned(); r++) for (var l = 0; l < UPPER.levels; l++) for (var b = 0; b < RACK.bays; b++) {
          var k = slotKey(r, b, l), s = S.slots[k];
          if (pass === 0 ? (s && s.n > 0 && s.sku === sku && slotSpace(k, sku) >= n) : ((!s || !s.n) && slotSpace(k, sku) >= n)) return k;
        }
        return null;
      }
    /* 12-machines5-upper.js */
    function raiseToDeck(ctx, P, inst) { inst.g.position.y = UPPER.y; for (var i = 0; i < solids.length; i++) if (solids[i].prop === inst.id) { solids[i].y0 += UPPER.y; solids[i].y1 += UPPER.y; } }
    /* 12-machines5-upper.js */
    var liftM = null, liftScreen = null, liftShown = '';
    /* 12-machines5-upper.js */
    function liftState() { if (!S.lift) S.lift = { pallet: null, pos: 0, state: 'down' }; return S.lift; }
    /* 12-machines5-upper.js */
    function liftPrompt() {
        var L = liftState(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
        if (!powered()) return 'Goods lift · no power';
        if (L.state !== 'down') return 'Goods lift · ' + (L.state === 'rising' ? 'going up' : L.state === 'up' ? 'unloading upstairs' : 'coming down');
        if (jp && !lp) return jp.n <= 0 ? 'An empty pallet has no business upstairs' : SKU[jp.sku] && SKU[jp.sku].raw ? 'Granulate goes to the hopper, not upstairs' : !upperSlotFor(jp.sku, jp.n) ? 'No room on the upper row for this pallet' : 'Set the pallet in the lift (it goes up by itself)';
        if (lp && !jp && isJack(player.tool)) return 'Take the pallet back out of the lift';
        return lp ? 'Goods lift · pallet of ' + lp.n + ' × ' + skuName(lp.sku) + (L.hold ? ' held at the floor' : ' about to go up') : 'Goods lift · empty, at the floor';
      }
    /* 12-machines5-upper.js */
    function liftUse() {
        var L = liftState(), jt = jackTool(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
        if (!powered() || L.state !== 'down') { sfx('bad'); return; }
        if (jp && !lp) { if (jp.n <= 0 || (SKU[jp.sku] && SKU[jp.sku].raw) || !upperSlotFor(jp.sku, jp.n)) { toast(jp.n <= 0 ? 'An empty pallet has no business upstairs.' : SKU[jp.sku] && SKU[jp.sku].raw ? 'Granulate goes to the hopper, not upstairs.' : 'No room on the upper row for this pallet.', 'bad'); sfx('bad'); return; } jp.place = 'lift'; S[jt].pallet = null; L.pallet = jp.id; L.wait = 1.5; sfx('crate'); toast('Pallet in the lift · it goes up by itself', 'good'); return; }
        if (lp && !jp && isJack(player.tool)) { lp.place = 'jack'; lp.jack = jt; S[jt].pallet = lp.id; L.pallet = null; sfx('jack'); return; }
        sfx('click');
      }
    /* 12-machines5-upper.js */
    function liftScreenDraw(c, sc) {
        var L = liftState(), p = L.pallet ? palletById(L.pallet) : null, st = !powered() ? 'off' : L.state === 'down' ? (p ? (L.hold ? 'held' : 'loaded') : 'ready') : L.state;
        scBg(c, sc.w, sc.h, st === 'rising' || st === 'lowering' || st === 'up' ? 'rgba(95,211,141,0.18)' : st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GOODS LIFT', st.toUpperCase());
        scText(c, 12, 62, p ? 'Pallet: ' + p.n + ' × ' + skuName(p.sku) : 'Platform empty', '#eef1f5', 14);
        scText(c, 12, 84, L.state === 'down' ? (p ? (L.hold ? 'Held at the floor' : 'Going up in a moment') : 'At the floor · a jack or the forklift sets a pallet in') : L.state === 'rising' ? 'Going up · ' + Math.round(L.pos * 100) + '%' : L.state === 'up' ? 'Upstairs · rolling it onto the feed belt' : 'Coming down · ' + Math.round((1 - L.pos) * 100) + '%', '#a0acb8', 11);
        scText(c, 12, 104, 'Lifted so far: ' + (S.stats.lifted || 0) + ' pallets · upstairs racked ' + (S.stats.upperIn || 0), '#a0acb8', 11);
        scButton(sc, 12, 122, 100, 30, 'SEND NOW', L.state === 'down' && !!p, function () { if (L.state === 'down' && p) { L.hold = false; L.state = 'rising'; sfx('hydraulic'); } }, '#5fd38d');
        scButton(sc, 124, 122, 100, 30, L.hold ? 'RELEASE' : 'HOLD', true, function () { L.hold = !L.hold; }, L.hold ? '#5fd38d' : '#f5b53d');
      }
    /* 12-machines5-upper.js */
    function liftBuild(c) {
        var FR = MAT_MACH.frame;
        // four posts and cross members, mesh guards on three sides, a gate bar across the open east side at the floor
        [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(function (p) { c.box(0.12, 5.6, 0.12, FR, p[0], 2.8, p[1]); c.box(0.3, 0.03, 0.3, FR, p[0], 0.015, p[1]); });
        [2.6, 5.5].forEach(function (y) { c.box(2.52, 0.1, 0.1, FR, 0, y, -1.2); c.box(2.52, 0.1, 0.1, FR, 0, y, 1.2); c.box(0.1, 0.1, 2.52, FR, -1.2, y, 0); if (y > 5) c.box(0.1, 0.1, 2.52, FR, 1.2, y, 0); });
        c.plane(2.4, 5.4, MAT.mesh, -1.19, 2.8, 0, 0, Math.PI / 2); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, -1.19, 0, 0); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, 1.19, 0, Math.PI);
        c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 1.0, 0); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 0.5, 0);
        c.solid(-1.3, -1.1, -1.3, 1.3, 0, 5.6); c.solid(-1.3, 1.3, -1.3, -1.1, 0, 5.6); c.solid(-1.3, 1.3, 1.1, 1.3, 0, 5.6); c.solid(1.1, 1.3, -1.1, 1.1, 0, 1.3); c.solid(1.1, 1.3, -1.1, 1.1, UPPER.y, UPPER.y + 1.1); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, UPPER.y + 1.0, 0);
        // the platform: a plate on powered rollers, hazard-striped edges; it rides up to the deck
        var plat = new THREE.Group(); plat.userData.dynamic = true; c.add(plat); liftM = plat;
        box(2.2, 0.12, 2.2, MAT.steelDark, 0, 0.06, 0, plat); for (var rz = -0.8; rz <= 0.81; rz += 0.4) cyl(0.03, 2.0, MAT_MACH.roller, 0, 0.15, rz, plat, 8).rotation.z = Math.PI / 2;
        box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, -1.08, plat); box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, 1.08, plat); box(0.04, 0.04, 2.2, MAT.hazard, -1.08, 0.14, 0, plat);
        cyl(0.06, 5.6, FR, -1.0, 2.8, 0, c.group, 10); cyl(0.06, 5.6, FR, 1.0, 2.8, 0, c.group, 10);   // the guide rails the platform rides
        // the console on the south post, facing the hall side you walk up from; a lamp at the top
        cabinet(c, 0.9, 1.45, 1.21, 0.4, 0.6, 0.22); liftScreen = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.9, y: 1.5, z: 1.335, ry: 0, parent: c.group, title: 'Goods lift', draw: liftScreenDraw }); liftScreen.mesh.userData.propId = 'lift';
        c.box(0.06, 0.06, 0.06, glowMat(0xff3b2f, 1.5), 1.2, 5.3, 0);
        c.sign(['GOODS LIFT', 'pallets only · goes up by itself'], 1.2, 0.3, 1.22, 2.2, 0, Math.PI / 2, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
        c.hit(2.8, 2.6, 2.8, 0, 1.3, 0, { prompt: function () { return liftPrompt(); }, use: function () { liftUse(); } });
      }
    /* 12-machines5-upper.js */
    function railRun(c, a0, a1, at, axis, y, gaps) {
        if (gaps && gaps.length) { var cuts = gaps.slice().sort(function (p, q) { return p[0] - q[0]; }), s0 = a0; cuts.forEach(function (g) { if (g[0] > s0) railRun(c, s0, Math.min(g[0], a1), at, axis, y); s0 = Math.max(s0, g[1]); }); if (s0 < a1) railRun(c, s0, a1, at, axis, y); return; }   // gaps: where a belt crosses the rail
        var len = a1 - a0, mid = (a0 + a1) / 2; if (len < 0.3) return;
        for (var p = a0 + 0.2; p <= a1 - 0.1; p += 1.5) { if (axis === 'x') c.cyl(0.025, 1.1, MAT.chrome, p, y + 0.55, at, 8); else c.cyl(0.025, 1.1, MAT.chrome, at, y + 0.55, p, 8); }
        [0.55, 1.1].forEach(function (ry) { if (axis === 'x') c.box(len, 0.04, 0.04, MAT.chrome, mid, y + ry, at); else c.box(0.04, 0.04, len, MAT.chrome, at, y + ry, mid); });
        if (axis === 'x') { c.box(len, 0.12, 0.03, MAT.yellow, mid, y + 0.06, at); c.solid(a0, a1, at - 0.12, at + 0.12, y, y + 1.3); } else { c.box(0.03, 0.12, len, MAT.yellow, at, y + 0.06, mid); c.solid(at - 0.12, at + 0.12, a0, a1, y, y + 1.3); }
      }
    /* 12-machines5-upper.js */
    function mezzBuild(c) {
        var DK = std({ color: 0x5c656f, roughness: 0.55, metalness: 0.55 }), FR = MAT_MACH.frame, Y = UPPER.y, X = HALL.x - 0.2, z0 = UPPER.z0, z1 = UPPER.z1, sh = UPPER.shaft, stw = UPPER.stair, well = UPPER.well;
        for (var ex = -X + 0.6; ex < X - 0.6; ex += 1.6) c.plane(1.0, 0.1, MAT.yellowLine, ex + 0.5, 0.0064, z1 + 0.15, -Math.PI / 2, 0);   // the deck's edge on the ground: a dashed line along its south face
        var plate = function (x0, x1, za, zb) { if (x1 - x0 < 0.05 || zb - za < 0.05) return; c.box(x1 - x0, 0.12, zb - za, DK, (x0 + x1) / 2, Y - 0.06, (za + zb) / 2); };
        // plates: the deck rectangle in z bands at every hole edge, each band laid in x around the holes open in it (the shaft, the stairwell)
        var holes = [{ x0: sh.x0, x1: sh.x1, z0: sh.z0, z1: sh.z1 }, { x0: well.x0, x1: well.x1, z0: stw.z0, z1: stw.z1 }].concat(sorterHoles()), zs = [z0, z1]; holes.forEach(function (h) { zs.push(h.z0, h.z1); }); zs = zs.filter(function (v) { return v >= z0 && v <= z1; }).sort(function (p, q) { return p - q; });
        for (var bi = 0; bi + 1 < zs.length; bi++) { var za = zs[bi], zb = zs[bi + 1]; if (zb - za < 0.05) continue; var zm = (za + zb) / 2, xs = [-X, X]; holes.forEach(function (h) { if (zm > h.z0 && zm < h.z1) xs.push(h.x0, h.x1); }); xs.sort(function (p, q) { return p - q; }); for (var xi = 0; xi + 1 < xs.length; xi++) { var xm = (xs[xi] + xs[xi + 1]) / 2, inHole = holes.some(function (h) { return zm > h.z0 && zm < h.z1 && xm > h.x0 && xm < h.x1; }); if (!inHole) plate(xs[xi], xs[xi + 1], za, zb); } }
        // the edge beam, the south railing, and the railings round the stairwell
        c.box(2 * X, 0.4, 0.2, FR, 0, Y - 0.32, z1 + 0.1);
        railRun(c, -X, X, z1 - 0.12, 'x', Y, sorterEdgeGaps()); sorterWellRails(c); railRun(c, well.x0, well.x1, stw.z1 + 0.12, 'x', Y); railRun(c, stw.z0, stw.z1 + 0.24, well.x1 + 0.12, 'z', Y);
        // columns under the south edge every twelve metres, bump guards at the foot
        for (var cx = -24; cx <= 30; cx += 12) { c.box(0.35, Y - 0.12, 0.35, FR, cx, (Y - 0.12) / 2, z1 - 0.35); c.box(0.5, 0.5, 0.5, MAT.hazard, cx, 0.25, z1 - 0.35); c.solid(cx - 0.25, cx + 0.25, z1 - 0.6, z1 - 0.1, 0, Y); }
        // lamps under the deck, so the receiving strip is not a cave; a few on the deck
        [-24, 0, 24].forEach(function (lx) { var pl = new THREE.PointLight(0xfff0d0, 0.55, 11, 2); pl.position.set(lx, Y - 0.4, (z0 + z1) / 2); c.add(pl); c.box(0.5, 0.08, 0.5, MAT.lamp, lx, Y - 0.16, (z0 + z1) / 2); });
        // the stair: treads along the north wall rising westward, risers, two stringers, a handrail on the open side
        var n = 24, run = (stw.x1 - stw.x0) / n, rise = Y / n, zc = (stw.z0 + stw.z1) / 2, w = stw.z1 - stw.z0;
        for (var i = 0; i < n; i++) { var tx = stw.x1 - (i + 0.5) * run, ty = (i + 1) * rise; c.box(run, 0.06, w - 0.1, DK, tx, ty - 0.03, zc); c.box(0.04, rise, w - 0.1, FR, tx + run / 2 - 0.02, ty - rise / 2 - 0.03, zc); }
        var ang = Math.atan2(Y, stw.x1 - stw.x0), len = Math.hypot(Y, stw.x1 - stw.x0), mx = (stw.x0 + stw.x1) / 2;
        [stw.z0 + 0.05, stw.z1 - 0.05].forEach(function (sz) { c.box(len, 0.28, 0.06, FR, mx, Y / 2 - 0.08, sz).rotation.z = -ang; });
        c.box(len, 0.04, 0.04, MAT.chrome, mx, Y / 2 + 0.95, stw.z1 + 0.06).rotation.z = -ang;
        for (var hp = 1; hp < n; hp += 4) c.cyl(0.018, 0.95, MAT.chrome, stw.x1 - (hp + 0.5) * run, (hp + 1) * rise + 0.47, stw.z1 + 0.06, 6);
        c.solid(stw.x0, stw.x1, stw.z0, stw.z1, -3, -0.5);   // below the floor: the crew's grid sees it and routes round the stair, you never meet it
        c.solid(stw.x0, stw.x1 + 0.3, stw.z1, stw.z1 + 0.25, 0, Y + 1.0);   // the open side of the stair is railed from the floor up
        c.solid(-X, X, z0 - 0.4, z0, Y, Y + 3);   // the north wall at deck height
        c.sign(['MEZZANINE', 'stair · pallets go by the goods lift'], 1.4, 0.4, stw.x1 + 0.9, 2.2, stw.z1 + 0.14, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#f5b53d' });
      }
    /* 12-machines5-upper.js */
    function upperRackBuild(c) {
        var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, H = 3.2, r = UPPER.row;
        for (var b = 0; b <= RACK.bays; b++) {
          var ux = x0 + b * bw;
          [-dz, dz].forEach(function (oz) { c.box(0.1, H, 0.1, MAT.rack, ux, H / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < H - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
          for (var br = 0; br < 3; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
        }
        var y = RACK.levels[1];
        c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, -dz); c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, dz);
        for (var bp = 0; bp <= RACK.bays; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
        for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; }
        for (var bb = 0; bb < RACK.bays; bb++) {
          var cx = x0 + (bb + 0.5) * bw, lbl = 'U' + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#5fd38d' });
          var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
          [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, H - 0.3, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
          for (var ll = 0; ll < UPPER.levels; ll++) (function (b2, l2) { var key = slotKey(r, b2, l2); slotHits[key] = c.hit(bw - 0.2, 1.45, RACK.depth, cx, RACK.levels[l2] + 0.725, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } }); })(bb, ll);
        }
        c.solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, H);
        [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + RACK.bays * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.sign(['UPPER ROW', 'automatic', 'keep clear'], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 26 }); });
      }
    /* 12-machines5-upper.js */
    function buildUpper() { ['mezz', 'lift', 'rack5', 'gantry5', 'upperFeed', 'upperPick', 'upperChute'].forEach(function (id) { buildProp(id); }); if (S.up.sorter) buildSorter(); else { beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } } }
    /* 12-machines6-sorter.js */
    var SORT = {
        spineZ: -20.7, spineX0: 25.2, spineX1: -12.4,          // the spine: west along the upper row's north face
        collZ: -23.2, collX0: -7.0, collX1: 29.0, collX: 29.4, // the collector: east along the north wall, then south along x 29.4 past the well and over the deck edge, down the east lane
        cells: [{ mode: 'sea', x: 16.0 }, { mode: 'land', x: 6.0 }, { mode: 'air', x: -4.0 }], cellZ: -21.72, liftX: 1.25, liftT: 2.4,   // liftX: the parcel lift beside each cell (local x); liftT: seconds up to the collector   // against the spine, so the corridor along the wall stays 1.3 m clear
        table: { x: -13.4, z: -20.7 }, inX: 25.5, scanZ: -19.4, up: 2.0,                                         // up: how high the overhead runs ride above the deck
        walk: [{ id: 'walk1', x: 22.0, z: -17.2, rot: 0 }, { id: 'walk2', x: 23.35, z: -20.7, rot: 1 }],         // step-overs: over the upper pick belt, over the spine's east end
        well: { x0: 31.0, x1: 33.4, z0: -20.5, z1: -18.1 },    // the spiral well through the deck, railed: the air spiral comes down here
        spiral: { sea: { x: 31.6, z: -11.1 }, air: { x: 32.2, z: -19.3 }, land: { x: 30.4, z: -3.2 }, up: { x: 30.6, z: 14.3 }, r: 1.0 },   // sea: in the OUT 1 apron, south of the deck edge; air: through the well; land: by OUT 2
        gates: { air: -19.3, sea: -13.9 },                      // where on the collector's south run the gates kick east (the sea gate at the deck's last row, its bridge runs out over the edge)
        jack2: { x: 27.0, z: -23.0 },                           // jack 2's bay moves out from under the spirals to the north wall
        cellTime: { sea: 7, land: 4, air: 5 }
      };
    /* 12-machines6-sorter.js */
    var LOADER_DOORS = { dockLoader1: 2, dockLoader2: BOOT_STAGE < 2 ? 2 : 3, dockLoader3: 4 };
    /* 12-machines6-sorter.js */
    function sorterOwned() { return !!(S.up && S.up.sorter && S.up.upper); }
    /* 12-machines6-sorter.js */
    function sortState() { if (!S.sort) S.sort = { cells: {}, table: [], scanned: 0, sorted: 0, count: { sea: 0, land: 0, air: 0 }, last: null, tableT: 0 }; var Z = S.sort; SORT.cells.forEach(function (c) { if (!Z.cells[c.mode]) Z.cells[c.mode] = { q: [], t: 0, made: 0 }; }); if (!Z.count) Z.count = { sea: 0, land: 0, air: 0 }; return Z; }
    /* 12-machines6-sorter.js */
    var Y = UPPER.y, R = SORT.spiral.r;
    /* 12-machines6-sorter.js */
    function orderMode(o) { if (!o) return 'land'; if (o.mode && MODES[o.mode]) return o.mode; return clientMode(o.client); }
    /* 12-machines6-sorter.js */
    function clientMode(cid) { var c = CLIENTS.filter(function (x) { return x.id === cid; })[0], m = c && c.mode || 'land'; if (m === 'air' && !sorterOwned()) m = 'land'; return m; }
    /* 12-machines6-sorter.js */
    var sortD = null;
    /* 12-machines6-sorter.js */
    var STAGE_CAP = 9, BAY = { x0: HALL.x - 2.6, len: 1.8, lanes: 3, deep: 3, pitch: 0.62, step: 0.6, h: 0.55, at: { dockLoader1: { prop: 'bay1', z0: -12.1 }, dockLoader2: { prop: 'bay2', z0: (BOOT_STAGE < 2 && DOCKS.out[0] ? DOCKS.out[0].z : -6) + 1.9 }, dockLoader3: { prop: 'bay3', z0: -19.56 } } }, STAGE_AT = BAY.at, stageT = {};
    /* 12-machines6-sorter.js */
    function stageOf(id) { if (!S.stage) S.stage = {}; if (!S.stage[id]) S.stage[id] = []; return S.stage[id]; }
    /* 12-machines6-sorter.js */
    function stagePush(id, oid) { var st = stageOf(id); if (st.length >= STAGE_CAP || st.indexOf(oid) >= 0) return false; st.push(oid); return true; }
    /* 12-machines6-sorter.js */
    function bayBuild(id) { return function (c) {
        var DG = MAT_MACH.frame, L = BAY.len, W = BAY.lanes * BAY.pitch, lane = MODES[TRUCK_OUT[LOADER_DOORS[id] - 2].mode], LC = new THREE.Color(lane.col), PM = std({ color: LC, roughness: 0.5, metalness: 0.3 });
        [[0.05, 0.05], [L - 0.05, 0.05], [0.05, W - 0.05], [L - 0.05, W - 0.05]].forEach(function (p) { c.box(0.08, BAY.h + 0.5, 0.08, DG, p[0], (BAY.h + 0.5) / 2, p[1]); c.box(0.16, 0.02, 0.16, DG, p[0], 0.01, p[1]); });
        c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, 0.03); c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, W - 0.03); c.box(0.05, 0.05, W, DG, 0.03, BAY.h - 0.1, W / 2); c.box(0.05, 0.05, W, DG, L - 0.03, BAY.h - 0.1, W / 2);
        for (var k = 0; k < BAY.lanes; k++) { var lz = 0.31 + k * BAY.pitch; var bed = c.box(L - 0.1, 0.03, 0.5, MAT_MACH.roller, L / 2, BAY.h - 0.03, lz); bed.rotation.z = -0.04; for (var rx = 0.15; rx < L - 0.1; rx += 0.15) { var sk = c.cyl(0.03, 0.46, MAT.chrome, rx, BAY.h - 0.02 + (L / 2 - rx) * 0.04, lz, 8); sk.rotation.x = Math.PI / 2; } c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz - 0.3); c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz + 0.3); c.box(0.04, 0.2, 0.46, PM, L - 0.06, BAY.h + 0.06, lz); }
        c.box(0.06, 0.5, W, DG, L + 0.02, BAY.h + 0.7, W / 2); c.sign([lane.name.toUpperCase() + ' SHIPPING BAY', dockLabel(LOADER_DOORS[id]) + ' · ' + lane.haulier], W - 0.1, 0.42, L + 0.06, BAY.h + 0.7, W / 2, -Math.PI / 2, { w: 640, h: 128, bg: '#1b232c', fg: lane.col });
        c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, -0.3, -Math.PI / 2, 0); c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, W + 0.3, -Math.PI / 2, 0); c.plane(0.1, W + 0.7, MAT.yellowLine, -0.35, 0.006, W / 2, -Math.PI / 2, 0);
        var lbl = new THREE.MeshBasicMaterial({ map: textTex(['BAY ' + (LOADER_DOORS[id] - 1) + ' · ' + lane.name.toUpperCase()], { w: 512, h: 128, bg: '#3b3d40', fg: lane.col }) }); c.plane(1.6, 0.4, lbl, L / 2, 0.0066, -0.7, -Math.PI / 2, 0);
        MACH['bay' + (LOADER_DOORS[id] - 1)].lamps = lampStack(c, L + 0.02, BAY.h + 1.0, W - 0.1);
        c.hit(0.3, 1.6, W + 0.2, L + 0.1, 0.8, W / 2, { prompt: function () { var n = stageOf(id).length, t = truckAtDoor(LOADER_DOORS[id]); return lane.name + ' shipping bay ' + dockLabel(LOADER_DOORS[id]) + ' · ' + n + ' of ' + STAGE_CAP + ' parcels' + (t && S.doors[LOADER_DOORS[id]] ? ' · the loader is taking them aboard' : ' · waiting for the ' + lane.name.toLowerCase() + ' truck'); }, use: function () { sfx('click'); } });
        c.solid(-0.05, L + 0.1, -0.05, W + 0.05, 0, 1.1);
      }; }
    /* 12-machines6-sorter.js */
    function deckNightRun() {
        if (!S.up.deckNight || !sorterOwned() || !propInst.spine || S.events.power) return 0;
        // seen: already past the scanner; done: already counted out of its cell. Neither is counted twice.
        var Z = sortState(), list = [], n = { sea: 0, land: 0, air: 0 }, take = function (oid, seen, done) { var o = orderById(oid); if (o) list.push({ o: o, seen: !!seen, done: !!done }); };
        S.bench.parcels.splice(0).forEach(function (oid) { take(oid, false, false); });
        ['sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellOutsea', 'cellOutland', 'cellOutair'].forEach(function (b) { if (!BELTS[b]) return; var items = beltItems(b); for (var i = items.length - 1; i >= 0; i--) if (items[i].kind === 'parcel') { if (items[i].order) take(items[i].order, b !== 'sortUp', b !== 'sortUp' && b !== 'spine'); items.splice(i, 1); } });
        SORT.cells.forEach(function (cd) { Z.cells[cd.mode].q.splice(0).forEach(function (j) { if (j.order) take(j.order, true, false); }); }); Z.table.splice(0).forEach(function (it) { if (it.order) take(it.order, true, false); });
        var left = [];
        list.forEach(function (e) { var o = e.o, m = orderMode(o), id = { sea: 'dockLoader1', land: 'dockLoader2', air: 'dockLoader3' }[m]; o.form = MODES[m].form; if (stagePush(id, o.id)) { n[m]++; if (!e.seen) Z.scanned++; if (!e.done) { Z.sorted++; Z.count[m] = (Z.count[m] || 0) + 1; S.stats.sorted = (S.stats.sorted || 0) + 1; } } else left.push(o); });
        left.forEach(function (o) { if (S.bench.parcels.length < 12) S.bench.parcels.push(o.id); else S.floor.push({ kind: 'parcel', order: o.id, x: 31.2 + Math.random() * 0.8, y: 0, z: 16.4 + Math.random() * 0.8, rot: 0 }); });
        var tot = n.sea + n.land + n.air; if (tot) logEvent('Night shift on the deck: ' + tot + ' parcel' + (tot > 1 ? 's' : '') + ' sorted and waiting in the shipping bays (sea ' + n.sea + ', land ' + n.land + ', air ' + n.air + ')', 'good');
        return tot;
      }
    /* 12-machines6-sorter.js */
    function sorterHoles() { return sorterOwned() ? [{ x0: SORT.well.x0, x1: SORT.well.x1, z0: SORT.well.z0, z1: SORT.well.z1 }] : []; }
    /* 12-machines6-sorter.js */
    function sorterEdgeGaps() { var g = [[22 - 0.7, 22 + 0.7]]; if (sorterOwned()) g.push([SORT.collX - 0.7, 32.3]); return g; }
    /* 12-machines6-sorter.js */
    function sorterWellRails(c) {
        if (!sorterOwned()) return; var w = SORT.well;
        railRun(c, w.x0, w.x1, w.z0 - 0.12, 'x', Y); railRun(c, w.x0, w.x1, w.z1 + 0.12, 'x', Y); railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x1 + 0.12, 'z', Y);
        railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x0 - 0.12, 'z', Y, [[SORT.gates.air - 0.5, SORT.gates.air + 1.4]]);
        c.sign(['SPIRAL WELL', 'keep clear'], 0.9, 0.3, (w.x0 + w.x1) / 2, Y + 1.5, w.z0 - 0.2, Math.PI, { w: 320, h: 100, bg: '#1b232c', fg: '#ff6b5e' });
      }
    /* 12-machines6-sorter.js */
    function sorterSpots() { if (!S.up.sorter) return; var old = { x: SPOT.jack2.x, z: SPOT.jack2.z }; SPOT.jack2 = { x: SORT.jack2.x, z: SORT.jack2.z }; if (S.jack2 && Math.abs(S.jack2.x - old.x) < 3 && Math.abs(S.jack2.z - old.z) < 3) { S.jack2.x = SPOT.jack2.x; S.jack2.z = SPOT.jack2.z; S.jack2.rot = Math.PI; } }
    /* 12-machines6-sorter.js */
    function buildSorter() {
        sorterSpots(); repaintJack2Bay();
        // the shipping belt gives way: its parcels go back on the shelf, or the floor if the shelf is full
        if (propInst.shipBelt) { beltItems('shipBelt').forEach(function (it) { if (it.kind === 'parcel' && it.order) { if (S.bench.parcels.length < 12) S.bench.parcels.push(it.order); else S.floor.push({ kind: 'parcel', order: it.order, x: 31.5, y: 0, z: 16.5, rot: 0 }); } }); beltItems('shipBelt').length = 0; removePropInst('shipBelt'); }
        buildProp('mezz'); buildProp('upperPick');
        ['dockLoader1', 'dockLoader2', 'dockLoader3', 'bay1', 'bay2', 'bay3', 'sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellsea', 'cellland', 'cellair', 'cellOutsea', 'cellOutland', 'cellOutair', 'sortTable', 'scanner', 'gateSea', 'gateAir', 'walk1', 'walk2'].forEach(function (id) { buildProp(id); });
        if (!S.speed) S.speed = {}; if (S.speed.sorter === undefined) S.speed.sorter = 1;
        sortD = null; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } rebuildBoardSoon();
      }
    /* 12-machines7-returns.js */
    var RET = { door: 6, dockZ: -34, beltZ: -35.0, beltX0: 34.6, beltX1: 22.2, intake: { x: 21.0, z: -35.0 }, desks: [{ x: 19.0, z: -38.2 }, { x: 23.4, z: -38.2 }, { x: 27.8, z: -38.2 }], cage: { x: 30.5, z: -43.2 }, compactor: { x: 15.5, z: -43.0 } };
    /* 12-machines7-returns.js */
    var TRUCK_RET = [9.5, 15];
    /* 12-machines7-returns.js */
    var RET_PROPS = ['retBelt', 'retIntake', 'retDesk0', 'retDesk1', 'retDesk2', 'retCage', 'retCompactor', 'retPaint', 'retSign', 'consoleRet'];
    /* 12-machines7-returns.js */
    function doorOwned(i) { var d = DOOR_MAP[i]; if (!d) return false; return d.dir === 'in' ? (d.dock < 2 || !!S.up.hall3) : d.dir === 'ret' ? returnsHall() : dockOwned(d.dock); }
    /* 12-machines7-returns.js */
    function retWhen() { return returnsHall(); }
    /* 12-machines7-returns.js */
    function retFeedWorks(t) { return !!(propInst.retBelt && S.doors[RET.door] && doorPassable(RET.door) && powered() && t && t.state === 'docked'); }
    /* 12-machines7-returns.js */
    function retIntakePrompt() { var D = rdesk(); if (S.hand && S.hand.kind === 'return') return D.queue.length < rdeskCap() ? 'Put the return in the queue (' + D.queue.length + ' waiting)' : 'The queue is full: inspect one first'; if (S.hand || player.tool) return null; return 'Returns intake · ' + D.queue.length + ' waiting · the belt brings them in from the dock · E on an inspection desk inspects the next'; }
    /* 12-machines7-returns.js */
    function retIntakeUse() { if (S.hand && S.hand.kind === 'return') { rdeskUse(0); return; } sfx('click'); }
    /* 12-machines7-returns.js */
    function migrateReturnsHall() {
        var moved = 0, dropped = 0, keys = Object.keys(S.slots || {});
        keys.forEach(function (k) { var r = +k.split(',')[0]; if (r !== 20 && r !== 21) return; var sl = S.slots[k]; delete S.slots[k]; if (!sl || !sl.n) return; var key = findSlotFor(sl.sku, sl.n, 2); if (key && slotSpace(key, sl.sku) >= sl.n) { slotAdd(key, sl.sku, sl.n); if (sl.pal && S.slots[key]) S.slots[key].pal = true; moved += sl.n; } else { var b = +k.split(',')[1]; newPallet(sl.sku, sl.n, { place: 'floor', x: 13.0 + (b % 7) * 3.0, z: r === 20 ? -30.5 : -40.0, y: 0, rot: 0, wrapped: !!sl.wrapped }); dropped += sl.n; } });
        if (S.layout) { delete S.layout.rack20; delete S.layout.rack21; delete S.layout.aislehall2; }
        if (moved || dropped) logEvent('Hall 2 is the returns hall now and its racks are gone: ' + moved + ' boxes moved to other rows' + (dropped ? ', ' + dropped + ' left on pallets on its floor' : ''), '');
      }
    /* 12-player.js */
    var buff = { coffeeUntil: 0, coffeeDay: 0 };
    /* 12-player.js */
    function rebuildDyn() {
        dyn.length = 0;
        S.pallets.forEach(function (p) { if (p.place !== 'floor') return; dyn.push({ x0: p.x - 0.65, x1: p.x + 0.65, z0: p.z - 0.65, z1: p.z + 0.65, y0: (p.y || 0) - 0.1, y1: (p.y || 0) + 0.3 + Math.ceil(p.n / 4) * BOX.h }); });
        S.trucks.forEach(function (t) {
          if (t.state === 'gone') return; var b = trailerBounds(t); if (t.van) { dyn.push({ x0: b.x0 - 1.8, x1: b.x1 + 0.1, z0: b.z0 - 0.1, z1: b.z1 + 0.1, y0: -2, y1: 3 }); return; }   /* the van is one block: nobody walks into it */ var cabX0 = Math.min(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2)), cabX1 = Math.max(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2));
          dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.12, z1: b.z0, y0: -2, y1: 3 }); dyn.push({ x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + 0.12, y0: -2, y1: 3 });
          var fx = t.x + t.side * TRAILER.len; dyn.push({ x0: fx - 0.08, x1: fx + 0.08, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
          dyn.push({ x0: cabX0, x1: cabX1, z0: t.z - 1.3, z1: t.z + 1.3, y0: -2, y1: 3 });
          if (t.state !== 'docked') dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
        });
        doors.forEach(function (d) { if (d.anim < 0.6) dyn.push({ x0: d.side * HALL.x - 0.3, x1: d.side * HALL.x + 0.3, z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, y0: -2, y1: 9 }); });
        doorSolids(dyn);
        if (S.up.fork) dyn.push({ x0: S.fork.x - 1.0, x1: S.fork.x + 1.0, z0: S.fork.z - 1.0, z1: S.fork.z + 1.0, y0: -1, y1: 2.4, skip: 'fork' });
        ['jack', 'jack2'].forEach(function (jt) { if (player.tool !== jt && jackPallet(jt)) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld(jt); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); } });
      }
    /* 13-pc.js */
    var pc = { on: false, app: 'home', scroll: 0, saved: null, look: { yaw: 0, pitch: 0 }, screen: null };
    /* 13-pc.js */
    var PC_APPS = [['home', '🏠', 'Desktop'], ['orders', '📦', 'Orders'], ['contracts', '📝', 'Contracts'], ['shop', '🛒', 'Shop'], ['staff', '👷', 'Staff'], ['bank', '🏦', 'Bank'], ['stock', '🗄', 'Stock'], ['factory', '🏭', 'Production'], ['plant', '⚙', 'Plant'], ['stats', '📊', 'Stats']];
    /* 13-pc.js */
    var APP_LVL = { contracts: 'contracts', bank: 'loan', factory: 'raw', plant: 'scanPlant' };
    /* 13-pc.js */
    function pcApps() { return PC_APPS.filter(function (a) { return !APP_LVL[a[0]] || unlocked(APP_LVL[a[0]]); }); }
    /* 13-pc.js */
    function plantRows() {
        var rows = [], pct = function (key) { return Math.round(speedOf(key) * 100) + '%'; };
        var dialRow = function (name, key) { rows.push({ text: '   ' + name + ' dial', sub: 'tap to step the speed', right: pct(key), key: key, dialOnly: true, btn: { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } }); };
        var add = function (name, status, sub, key, action) { rows.push({ text: name + '  ·  ' + status, sub: sub, right: key ? pct(key) : '', key: key, hi: status === 'run' || status === 'running' || status === 'sorting', btnIsDial: !action && !!key, btn: action || (key ? { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } : null) }); if (action && key) dialRow(name, key); };
        if (propInst.packline) add('Pack line', packStatus(), packPrompt(), 'packline', S.pack.jam ? { label: 'CLEAR JAM', on: true, act: packUse, col: '#ff6b5e' } : S.up.plantAuto ? { label: S.pack.auto === false ? 'AUTO OFF' : 'AUTO ON', on: true, act: function () { S.pack.auto = S.pack.auto === false; sfx('click'); }, col: S.pack.auto === false ? '#f5b53d' : '#5fd38d' } : null);
        var surP = surplusCount(); if (surP) rows.push({ text: 'Bench surplus  ·  ' + surP + ' box' + (surP > 1 ? 'es' : ''), sub: 'boxes no open order wants, on the bench or loose on the floor', hi: true, btn: { label: 'RETURN ALL', on: true, act: function () { returnSurplus(); }, col: '#f5b53d' } });
        if (propInst.moulder) add('Moulding line', factoryStatus(), moulderPrompt(), 'moulder', { label: S.factory.jam ? 'CLEAR JAM' : S.factory.on ? 'STOP' : 'START', on: true, act: moulderUse, col: S.factory.jam ? '#ff6b5e' : S.factory.on ? '#f5b53d' : '#5fd38d' });
        if (propInst.palletiser) add('Palletiser', S.pal.n ? 'run' : 'idle', palletiserPrompt(), 'beltMain', { label: 'EJECT', on: S.pal.n > 0, act: palletiserUse, col: '#f5b53d' });
        if (propInst.baler) add('Baler', balerStatus(), balerPrompt(), 'baler', { label: 'BALE', on: S.baler.card >= BALE_NEED && !S.baler.t, act: balerUse, col: '#f5b53d' });
        if (propInst.wrapper) add('Stretch wrapper', wrapperStatus(), 'film ' + S.wrap.film + ' pallets · wrapped ' + S.wrap.wrapped, 'wrapper', null);
        if (S.up.agv && propInst.agvDock) { var A = agvState(); add('AGV-1', A.paused && A.state === 'idle' ? 'paused' : A.state, agvPrompt(), 'agv', { label: A.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { A.paused = !A.paused; sfx('click'); }, col: A.paused ? '#5fd38d' : '#f5b53d' }); }
        if (S.up.gantry) { gantryRows().forEach(function (r) { var G = gantryState(r); add('Gantry ' + (r >= UPPER.row ? 'upper' : 'ABCDEF'[r]), G.paused && G.state === 'idle' ? 'paused' : G.state, gantryPrompt(r), 'gantry' + r, { label: G.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { G.paused = !G.paused; sfx('click'); }, col: G.paused ? '#5fd38d' : '#f5b53d' }); }); dialRow('Pick belts', 'pickBelt'); }
        for (var lid in LOADER_DOORS) if (propInst[lid]) add('Dock loader ' + dockLabel(LOADER_DOORS[lid]), dockLoaderStatus(LOADER_DOORS[lid]), dockLoaderPrompt(LOADER_DOORS[lid]) + ' · ' + stageOf(lid).length + ' in the bay', null, null);
        if (S.up.shipbelt && propInst.shipBelt) dialRow('Shipping belt', 'shipBelt');
        if (upperOwned() && propInst.lift) { var L = liftState(); add('Goods lift', L.state, 'lifted ' + (S.stats.lifted || 0) + ' pallets · racked upstairs ' + (S.stats.upperIn || 0), null, { label: L.hold ? 'RELEASE' : 'HOLD', on: true, act: function () { L.hold = !L.hold; sfx('click'); }, col: L.hold ? '#5fd38d' : '#f5b53d' }); }
        if (sorterOwned() && propInst.spine) { var Z = sortState(); add('Sortation deck', SORT.cells.some(function (cd) { return Z.cells[cd.mode].q.length; }) ? 'sorting' : 'ready', 'read ' + Z.scanned + ' · sorted ' + Z.sorted + ' · turntable ' + Z.table.length + (S.up.deckNight ? ' · night shift on' : ''), 'sorter', null); }
        if (!rows.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench; the rest is in the shop', col: '#a0acb8' });
        return rows;
      }
    /* 13-pc.js */
    function openPc() {
        if (pc.on || driving) return;
        if (S.events.power) { toast('No power.', 'bad'); return; }
        pc.on = true; pc.app = pc.app || 'home'; pc.scroll = 0; pc.look.yaw = 0; pc.look.pitch = 0;
        pc.saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
        if (player.tool) releaseTool(); scanToggle(false);
        sfx('click'); introStep('pc'); screenDirtyAll(); hudDirty = true;
        $('h-drive').hidden = false; $('h-drive').innerHTML = 'Office PC · aim at a button and <b>E</b> taps it · mouse wheel scrolls a list · <b>Esc</b> or <b>WASD</b> stands up';
      }
    /* 13-pc.js */
    function pcRows(sc, rows, y0, rowH) {
        var c = sc.ctx, maxRows = Math.floor((sc.h - y0 - 90) / rowH), start = clamp(pc.scroll, 0, Math.max(0, rows.length - maxRows)), y = y0;   // 90: the two-row taskbar
        pc.scroll = start;
        rows.slice(start, start + maxRows).forEach(function (r) {
          c.fillStyle = r.hi ? 'rgba(245,181,61,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(16, y, sc.w - 32, rowH - 6);
          if (r.sw) { c.fillStyle = r.sw; c.fillRect(24, y + 10, 10, 10); }
          scText(c, r.sw ? 42 : 26, y + 19, String(r.text).slice(0, 70), r.col || '#eef1f5', 14); if (r.sub) scText(c, r.sw ? 42 : 26, y + 36, String(r.sub).slice(0, 96), '#a0acb8', 11);
          if (r.right !== undefined) { c.fillStyle = r.rcol || '#f5b53d'; c.font = 'bold 14px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), sc.w - (r.btn ? 130 : 26), y + 19); c.textAlign = 'left'; }
          if (r.btn) scButton(sc, sc.w - 118, y + 6, 96, rowH - 18, r.btn.label, !!r.btn.on, r.btn.act, r.btn.col);
          y += rowH;
        });
        if (rows.length > maxRows) { scButton(sc, sc.w - 60, y0 - 34, 20, 22, '▲', false, function () { pc.scroll = Math.max(0, pc.scroll - 1); }); scButton(sc, sc.w - 36, y0 - 34, 20, 22, '▼', false, function () { pc.scroll = pc.scroll + 1; }); c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText((start + 1) + '-' + Math.min(rows.length, start + maxRows) + ' of ' + rows.length, sc.w - 66, y0 - 18); c.textAlign = 'left'; }
        if (!rows.length) scText(c, 26, y0 + 24, 'Nothing here.', '#6b7784', 14);
      }
    /* 13-pc.js */
    function drawPc(c, sc) {
        var w = sc.w, h = sc.h;
        if (S.events.power) { c.fillStyle = '#05080a'; c.fillRect(0, 0, w, h); return; }
        scBg(c, w, h, 'rgba(120,189,245,0.18)');
        // the taskbar
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 84, w, 84);   // two rows of five since the Plant app: ten in one row left the last one a sliver
        var apps = pcApps(), perRow = Math.ceil(apps.length / 2), bw = Math.floor((w - 16 - 8 * (perRow - 1)) / perRow); if (!apps.some(function (a) { return a[0] === pc.app; })) pc.app = 'home';
        apps.forEach(function (a, i) { var row = Math.floor(i / perRow), col = i % perRow; scButton(sc, 8 + col * (bw + 8), h - 80 + row * 40, bw, 34, a[1] + ' ' + a[2], pc.app === a[0], function () { pc.app = a[0]; pc.scroll = 0; }, '#78bdf5'); });
        c.fillStyle = '#a0acb8'; c.font = '12px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('Day ' + S.day + ' · ' + fmtTime(S.time), w - 10, 14); c.textAlign = 'left';
        var app = pc.app;
        if (app === 'home') {
          scText(c, 24, 48, 'DEPOT OS', '#f5b53d', 34); scText(c, 24, 72, 'Depot Co. · ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + (isSunday() ? ' · Sunday, closed' : ''), '#a0acb8', 14);
          var kp = [['Bank', money(S.bank)], ['Open orders', String(openOrders().length)], ['In stock', totalStock() + ' boxes'], ['Reputation', String(Math.round(S.rep))], ['Level', S.level + ' · ' + S.xp + '/' + XP_FOR(S.level)], ['Crew', S.staff.length + ' (' + S.staff.filter(function (s) { return s.clocked; }).length + ' on the clock)']];
          kp.forEach(function (k, i) { var x = 24 + (i % 3) * 250, y = 100 + Math.floor(i / 3) * 90; c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, y, 234, 76); scText(c, x + 14, y + 26, k[0].toUpperCase(), '#6b7784', 11); scText(c, x + 14, y + 58, k[1], '#eef1f5', 24); });
          var last = S.log.slice(0, 5); scText(c, 24, 300, 'RECENT', '#6b7784', 11); last.forEach(function (l, i) { scText(c, 24, 322 + i * 20, 'D' + l.day + ' ' + l.t + '  ' + l.msg.slice(0, 90), l.kind === 'bad' ? '#ff6b5e' : l.kind === 'good' ? '#5fd38d' : '#eef1f5', 12); });
        } else if (app === 'orders') {
          scHead(c, w, 'ORDERS', openOrders().length + ' open');
          var rows = S.orders.slice().sort(function (a, b) { return a.due - b.due; }).map(function (o) { return { text: '#' + o.num + '  ' + clientName(o.client) + (o.rush ? '  RUSH' : '') + (o.late ? '  LATE' : ''), sub: o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · due ' + dueText(o.due) + ' · ' + o.state, right: money(o.pay), col: o.late || o.rush ? '#ff6b5e' : '#eef1f5', hi: o.state !== 'open' }; });
          returnsPending().forEach(function (r) { rows.push({ text: 'RETURN #' + r.num + '  ' + clientName(r.client), sub: r.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + r.why + ' · ' + returnPlaceText(r), right: money(returnFee(r)), rcol: '#f5b53d', col: r.late ? '#ff6b5e' : '#f5b53d' }); });
          S.shipped.slice(0, 6).forEach(function (s) { rows.push({ text: 'shipped #' + s.num + '  ' + clientName(s.client) + (s.late ? '  late' : '') + (s.short ? '  short' : ''), sub: 'day ' + s.day, right: money(s.paid), rcol: '#5fd38d', col: '#a0acb8' }); });
          pcRows(sc, rows, 60, 46);
        } else if (app === 'contracts') {
          scHead(c, w, 'CONTRACTS', unlocked('twoContracts') ? 'two at once' : undefined); var rows2 = [];
          if (!contractsAll().length) rows2.push({ text: 'No offer on the table', sub: !unlocked('contracts') ? 'Reach level ' + UNLOCK.contracts + ' and the clients start asking.' : 'Next offer around day ' + S.nextOffer + '.' });
          contractSlots().forEach(function (k) { var ct = S[k]; if (!ct) return;
            if (!ct.accepted) { rows2.push({ text: clientName(ct.client) + ' offers a ' + (ct.long ? 'long ' : '') + 'contract', sub: ct.need + ' orders on time by ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), btn: { label: 'ACCEPT', on: true, act: function () { contractAccept(k); }, col: '#5fd38d' }, hi: true }); rows2.push({ text: 'Decline', sub: 'The next offer comes in a couple of days.', btn: { label: 'DECLINE', on: false, act: function () { contractDecline(k); } } }); }
            else rows2.push({ text: clientName(ct.client) + ' · ' + ct.done + ' of ' + ct.need + ' on time', sub: 'until ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), right: Math.round(100 * ct.done / ct.need) + '%', hi: true }); });
          rows2.push({ text: 'How it works', sub: 'Every order of theirs shipped on time in the window counts. Miss the number and the penalty is taken. Contract clients order more while it runs.', col: '#a0acb8' });
          pcRows(sc, rows2, 60, 50);
        } else if (app === 'shop') {
          scHead(c, w, 'SHOP', money(S.bank) + ' · level ' + S.level);
          var rows3 = UPGRADES.filter(shopShows).map(function (u) { var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[u.id]; var needs = rowN && S.up.rows < rowN - 1 ? 'needs the previous row' : u.needs && !S.up[u.needs] ? 'needs ' + upgradeName(u.needs).toLowerCase() : S.level < u.lvl ? 'level ' + u.lvl : S.bank < u.price ? 'not enough money' : ''; return { text: u.name + (owned ? '  ·  owned' : ''), sub: (needs ? needs + ' · ' : '') + u.desc, right: money(u.price), btn: owned ? null : { label: !needs ? 'BUY' : needs === 'not enough money' ? 'NO MONEY' : 'LOCKED', on: !needs, act: function () { if (!needs) buyUpgrade(u.id); }, col: '#5fd38d' } }; });
          pcRows(sc, rows3, 60, 50);
        } else if (app === 'staff') {
          scHead(c, w, 'STAFF', S.staff.length + ' of ' + staffCap() + ' · ' + comfortText());
          var rows4 = Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl || (d.needs && !S.up[d.needs]); return { text: 'Hire a ' + d.name.toLowerCase() + '  ·  ' + money(d.wage / 10) + '/h', sub: d.desc, btn: { label: locked ? (S.level < d.lvl ? 'LEVEL ' + d.lvl : 'NEEDS FORK') : S.staff.length >= staffCap() ? 'FULL' : 'HIRE', on: !locked && S.staff.length < staffCap(), act: function () { if (!locked && S.staff.length < staffCap()) { hireStaff(r); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }, col: '#5fd38d' } }; });
          S.staff.forEach(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0), open = pc.staffOpen === st.id;
            rows4.push({ text: st.name + '  ·  ' + STAFF_ROLES[st.role].name + (st.cross && STAFF_ROLES[st.cross] ? ' (+' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + '  ·  ' + staffStatus(st), sub: 'today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + ' · ' + punctWord(st) + ' (' + Math.round((st.punct || 0.5) * 100) + '%)' + (st.lateToday ? ' · late today' : '') + ' · ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.raise ? ' · raised' : ''), hi: !!st.clocked, btn: { label: open ? 'CLOSE ▴' : 'OPTIONS ▸', on: open, act: function () { pc.staffOpen = open ? null : st.id; pc.confirm = null; }, col: '#78bdf5' } });
            if (!open) return;   // one row a worker unless their options are open (five rows each made eight crew forty rows of scrolling)
            rows4.push({ text: '   shift: ' + (st.shift || 'day') + (st.shiftNext ? ' (' + st.shiftNext + ' from tomorrow)' : ''), sub: 'shift ' + fmtTime(shiftStart(st)) + ' to ' + fmtTime(shiftOf(st).end) + ' · day, early or late; the change takes effect tomorrow', col: '#a0acb8', btn: { label: 'SHIFT ▸', on: true, act: function () { staffShiftCycle(st); }, col: '#78bdf5' } });
            rows4.push({ text: '   ' + (st.trained ? 'trained' : 'training course · $' + TRAIN_PRICE), sub: st.trained ? 'walks a fifth faster and finishes every task step a third sooner' : 'quicker on their feet and at every task', col: '#a0acb8', btn: { label: st.trained ? 'DONE' : 'TRAIN', on: !st.trained && S.bank >= TRAIN_PRICE, act: function () { staffTrain(st); }, col: '#5fd38d' } });
            rows4.push({ text: '   ' + (st.raise ? 'on the raised rate' : 'a raise · $' + RAISE_PRICE), sub: st.raise ? money(hourly(st)) + ' an hour, on time every day' : '10% more an hour, and timekeeping stops being a problem', col: '#a0acb8', btn: { label: st.raise ? 'DONE' : 'RAISE', on: !st.raise && S.bank >= RAISE_PRICE, act: function () { staffRaise(st); }, col: '#5fd38d' } });
            rows4.push({ text: '   second role' + (st.cross && STAFF_ROLES[st.cross] ? ' · ' + STAFF_ROLES[st.cross].name.toLowerCase() : ' · $' + CROSS_PRICE + ' once'), sub: 'covers the other job when their own queue is empty; tap to choose the role', col: '#a0acb8', btn: { label: st.cross ? 'NEXT ▸' : 'CHOOSE', on: st.crossPaid || S.bank >= CROSS_PRICE, act: function () { staffCrossCycle(st); }, col: '#78bdf5' } });
            rows4.push({ text: '   let ' + st.name + ' go', sub: 'the hours worked today are paid on the way out · tap twice', col: '#a0acb8', btn: { label: 'LET GO', on: false, act: function () { if (pc.confirm !== st.id) { pc.confirm = st.id; toast('Tap LET GO again to let ' + st.name + ' go', 'bad'); return; } pc.confirm = null; pc.staffOpen = null; fireStaff(st.id); }, col: '#ff6b5e' } }); });
          pcRows(sc, rows4, 60, 50);
        } else if (app === 'plant') {
          scHead(c, w, 'PLANT', powered() ? 'mains ok' : 'NO POWER');
          pcRows(sc, plantRows(), 60, 50);
        } else if (app === 'bank') {
          scHead(c, w, 'BANK', money(S.bank));
          var rows5 = [
            { text: 'Loan', sub: S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day from level ' + UNLOCK.loan + '. Repay when you can.', right: S.loan > 0 ? money(S.loan) : '', btn: S.loan > 0 ? { label: 'REPAY', on: S.bank > 0, act: function () { var amt = Math.min(S.loan, Math.max(0, S.bank)); if (amt > 0) { S.loan -= amt; pay(-amt, 'Loan repayment'); sfx('cash'); toast('Repaid ' + money(amt), 'good'); } }, col: '#5fd38d' } : { label: 'BORROW', on: unlocked('loan'), act: function () { if (unlocked('loan') && S.loan <= 0) { S.loan = 5000; pay(5000, 'Bank loan'); sfx('cash'); toast('$5,000 in the bank. 1.5% a day.', 'good'); } }, col: '#f5b53d' } },
            { text: 'Theft insurance', sub: '$40 a day. Pays 80% of the value of anything that walks off at night.' + (unlocked('insurance') ? '' : ' From level ' + UNLOCK.insurance + '.'), right: S.insured ? 'insured' : '', btn: { label: S.insured ? 'CANCEL' : 'INSURE', on: S.insured || unlocked('insurance'), act: function () { if (!S.insured && !unlocked('insurance')) return; S.insured = !S.insured; toast(S.insured ? 'Insured from tonight' : 'Insurance cancelled', ''); }, col: '#78bdf5' } },
            { text: 'Earned ' + money(S.stats.earned) + '  ·  spent ' + money(S.stats.spent) + '  ·  fines ' + money(S.stats.fines), sub: 'daily costs: rent ' + money(stageRent()) + ' + the crew by the hour' + (S.insured ? ' + $40 insurance' : '') + (S.loan ? ' + loan interest' : ''), col: '#a0acb8' }
          ];
          S.ledger.slice(0, 8).forEach(function (l) { rows5.push({ text: l.why, sub: 'day ' + l.day + ' · ' + l.t, right: money(l.n), rcol: l.n < 0 ? '#ff6b5e' : '#5fd38d', col: '#a0acb8' }); });
          pcRows(sc, rows5, 60, 48);
        } else if (app === 'stock') {
          var sum = stockSummary(), keys = Object.keys(sum).sort(); scHead(c, w, 'STOCK', totalStock() + ' boxes · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + '/' + slotTotal() + ' slots');
          var rows6 = keys.map(function (k) { var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) need += l.qty; }); }); return { sw: SKU[k].col, text: skuName(k) + '  ·  ' + money(SKU[k].val) + ' each', sub: slotsWith(k).map(slotName).slice(0, 4).join(', '), right: sum[k] + (need ? '  (' + need + ' needed)' : ''), rcol: need > sum[k] ? '#ff6b5e' : '#f5b53d' }; });
          pcRows(sc, rows6, 60, 44);
        } else if (app === 'factory') {
          var F = S.factory; scHead(c, w, 'PRODUCTION', factoryStatus().toUpperCase());
          var rowsF = [
            { text: 'Hopper: ' + F.raw + ' / ' + HOPPER_CAP + ' units of raw granulate', sub: 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units, one unit a box. Tip pallets in at the hopper in the production wing.', right: F.rawOrdered ? F.rawOrdered + ' on order' : '', btn: { label: 'ORDER $' + ECON.rawPrice, on: S.bank >= ECON.rawPrice, act: function () { if (S.bank < ECON.rawPrice) { sfx('bad'); return; } pay(-ECON.rawPrice, 'Raw granulate, one pallet'); F.rawOrdered++; sfx('cash'); toast('A pallet of raw granulate comes with the next inbound truck', 'good'); } } },
            { text: 'Moulding line: ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product), sub: FACTORY_RATE + ' s a box · made ' + F.made + ' so far · boxes go by belt to the palletiser in the hall', btn: { label: F.on ? 'STOP' : 'START', on: true, act: function () { moulderUse(); }, col: F.on ? '#ff6b5e' : '#5fd38d' } }
          ];
          ownSkus().forEach(function (s) { rowsF.push({ sw: s.col, text: s.name + ' · ' + money(s.val) + ' a box to the clients', sub: 'in stock ' + stockCount(s.id) + (!skuOpen(s) ? ' · clients ask for it from level ' + s.lvl : ''), btn: { label: F.product === s.id ? 'SELECTED' : 'SELECT', on: F.product !== s.id, act: function () { F.product = s.id; sfx('click'); } } }); });
          rowsF.push({ text: 'Baler: ' + S.baler.card + ' / ' + BALE_NEED + ' cardboard · ' + S.baler.bales + ' bales waiting · ' + S.baler.made + ' made', sub: 'Binned boxes and packing offcuts fill it. Outbound trucks take bales at ' + money(BALE_PRICE) + ' each. Wrapper film left: ' + S.wrap.film + '.', col: '#a0acb8' });
          rowsF.push({ text: 'Pallets finished by the palletiser: ' + (S.stats.palletised || 0) + ' · parcels off the pack line: ' + S.pack.made, sub: 'Finished pallets drop beside the palletiser; rack them like any delivery. Clients start ordering your own goods once they have seen them.', col: '#a0acb8' });
          pcRows(sc, rowsF, 60, 50);
        } else if (app === 'stats') {
          scHead(c, w, 'STATS', 'day ' + S.day); var st2 = S.stats;
          var rows7 = [['Pallets received', st2.received], ['Boxes put away', st2.putaway], ['Boxes picked', st2.picked], ['Orders packed', st2.packed], ['Orders shipped', st2.shipped], ['Late', st2.late], ['Pallets refused', st2.lost], ['Boxes stolen', st2.stolen || 0], ['Returns inspected', st2.returns || 0], ['Damaged boxes binned', S.binned || 0], ['Your hours on the clock', Math.round((st2.hoursWorked || 0) * 10) / 10], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return { text: k[0], right: String(k[1]) }; });
          pcRows(sc, reportRows().concat(rows7), 60, 40);   // the last seven day reports first, then the lifetime counts
        }
      }
    /* 13-scanner-device.js */
    var scanDev = { g: null, canvas: null, ctx: null, tex: null, t: 0, redrawT: 0, laser: null, laserT: 0, lastFocusKey: null, lastBeep: null, led: null, marker: null, rows: [], navShown: false };
    /* 13-scanner-device.js */
    var SCAN_W = 300, SCAN_H = 380, SCAN_RES = 2;
    /* 13-scanner-device.js */
    function scanSlotNav(key, label) { var sp = slotStand(key), p = slotParse(key); return { x: sp.x, z: sp.z, y: p.r === UPPER.row ? UPPER.y : 0, label: label || slotName(key) }; }
    /* 13-scanner-device.js */
    function scanPickSlot(sku) {   // the hand-reachable slot of a line nearest to you, floor and shelf levels only
        var best = null, bd = 1e9; slotsWith(sku).forEach(function (k) { var p = slotParse(k); if (p.l >= RACK.top || !slotOwned(k)) return; var sp = slotStand(k), d = dist2(sp.x, sp.z, player.x, player.z); if (d < bd) { bd = d; best = k; } }); return best;
      }
    /* 13-scanner-device.js */
    function scanDoorNav(i) { var at = doorInside(i); return at ? { x: at[0] + (DOOR_MAP[i].dir === 'in' ? 2.0 : -2.0), z: at[1], y: 0, label: 'Dock ' + dockLabel(i) } : null; }
    /* 13-scanner-device.js */
    function scanPropNav(prop, label) { if (!propInst[prop]) return null; var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.6, z: P.z + Math.cos(a) * 1.6, y: prop === 'scanner' ? UPPER.y : 0, label: label || propLabel(prop) }; }
    /* 13-scanner-device.js */
    function scanLane(o) { var m = MODES[orderMode(o)]; return { col: m.col, tag: m.name.toUpperCase() }; }
    /* 13-scanner-device.js */
    function scanReturnsNav() { return returnsHall() ? scanPropNav('retIntake', 'Returns intake') : scanPropNav('returnsDesk', 'Returns desk'); }
    /* 13-scanner-device.js */
    function scanReturnsWhere() { return returnsHall() ? 'the intake in the returns hall' : 'the returns desk by the bench'; }
    /* 13-scanner-device.js */
    function scanPageRows(page) {
        var rows = [];
        if (page === MAP_PAGE) return rows;   // the map draws itself
        if (page === 0) {   // HOME: the day at a glance, then the alerts
          var openN = S.orders.filter(function (o) { return o.state === 'open'; }).length, packedN = S.orders.filter(function (o) { return o.state === 'packed'; }).length, lateN = S.orders.filter(function (o) { return o.late && o.state !== 'shipped'; }).length;
          rows.push({ text: 'Day ' + S.day + ' · ' + fmtTime(S.time) + ' · ' + SEASONS[season()] + (isSunday() ? ' · SUNDAY' : ''), sub: (S.weather ? S.weather.kind : 'clear') + ' · level ' + S.level + ' · ' + S.xp + ' / ' + XP_FOR(S.level) + ' xp', right: money(S.bank), col: '#f5b53d' });
          rows.push({ text: openN + ' open · ' + packedN + ' packed · ' + lateN + ' late', sub: 'rep ' + Math.round(S.rep) + (S.contract && S.contract.accepted ? ' · contract ' + S.contract.done + '/' + S.contract.need : ''), right: 'orders' });
          var docked = S.trucks.filter(function (t) { return t.state === 'docked'; });
          rows.push({ text: docked.length ? docked.map(function (t) { return dockLabel(doorIndex(t.dir, t.dock)); }).join(' · ') + ' docked' : 'No truck at a door', sub: 'next in ' + TRUCK_IN.map(fmtTime).join(' / ') + ' · out ' + TRUCK_OUT.filter(function (dk, i) { return dockOwned(i); }).map(function (dk, i) { return MODES[dk.mode].name.slice(0, 1) + ' ' + fmtTime(outNext(i).arrive); }).join(' · '), right: 'trucks' });
          if (scan.nav) rows.push({ text: '⌖ ' + scan.nav.label, sub: Math.round(Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z))) + ' m away · X clears', hi: true, col: '#5fd38d' });
          var al = [];
          if (S.events.power) al.push(['NO POWER', 'reset the breaker in the office', scanPropNav('breaker', 'Breaker panel')]);
          S.trucks.forEach(function (t) { if (t.dir === 'in' && t.state === 'docked' && !t.signed) al.push(['Unsigned delivery at ' + dockLabel(doorIndex('in', t.dock)), 'the driver waits by the door · Enter signs it from here', scanDoorNav(doorIndex('in', t.dock)), scanSignAct(t)]); });
          // a truck about to go with work still to do: an inbound one in its last hour with pallets aboard, an outbound one at a manual dock with parcels of its lane packed and not loaded (a loader or the deck takes those by itself)
          S.trucks.forEach(function (t) { if (t.state !== 'docked') return; var di = doorIndex(t.dir, t.dock);
            if (t.dir === 'in') { var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; }).length; if (left && S.time >= t.leave - 1) al.push([dockLabel(di) + ' truck leaves ' + fmtTime(t.leave) + ' · ' + left + ' pallet' + (left > 1 ? 's' : '') + ' aboard', 'whatever is still on it goes back unpaid', scanDoorNav(di)]); }
            else if (t.dir === 'out' && !sorterOwned() && !(S.up.shipbelt && di === LOADER_DOORS.dockLoader2)) { var wait = S.orders.filter(function (o) { return o.state === 'packed' && (!lanesOn() || orderMode(o) === t.mode); }).length; if (wait) al.push([wait + ' ' + t.mode + ' parcel' + (wait > 1 ? 's' : '') + ' not on the ' + dockLabel(di) + ' truck', 'it leaves ' + fmtTime(t.leave) + ' · the parcels are on the shelf, the floor or the cart', scanPropNav('packline', 'Parcel shelf')]); } });
          var cof = contractOffer(); if (cof) al.push(['Contract offer from ' + clientName(cof.client), cof.need + ' orders on time by ' + dueText(cof.until) + ' for ' + money(cof.bonus) + ' · Enter accepts, the PC declines', scanPropNav(unlocked('pc') ? 'desk' : 'bench', unlocked('pc') ? 'Office PC' : 'The paperwork'), { label: 'ACCEPT', run: function () { contractAccept(); } }]);
          if (S.siteDue > S.site) al.push(['The builders are booked: ' + stageName(S.siteDue).toLowerCase(), 'the building grows at the day roll: sleep, or let the clock run past midnight', scanPropNav('cot', 'The cot')]);
          if (propInst.wrapper && S.wrap && S.wrap.film <= 2) al.push(['Wrapper film ' + (S.wrap.film ? 'nearly out: ' + S.wrap.film + ' left' : 'finished'), 'a new roll is ' + money(FILM_PRICE) + ' on the wrapper screen', scanPropNav('wrapper', 'Stretch wrapper')]);
          if (S.pack && S.pack.jam) al.push(['Pack line jammed', 'Enter clears the jam from here', scanPropNav('packline', 'Pack line'), { label: 'CLEAR', run: function () { packUse(); } }]);
          if (S.factory && S.factory.jam) al.push(['Moulding line jammed', 'Enter clears the jam from here', scanPropNav('moulder', 'Moulding line'), { label: 'CLEAR', run: function () { moulderUse(); } }]);
          if (lateN) al.push([lateN + ' late order' + (lateN > 1 ? 's' : ''), 'half pay once shipped · cancelled after 30 h', null]);
          var surN = surplusCount(); if (surN) al.push([surN + ' surplus box' + (surN > 1 ? 'es' : ''), 'Enter puts them back on the racks', scanPropNav('bench', 'Packing bench'), { label: 'RETURN', run: function () { returnSurplus(); } }]);
          var rpn = returnsPending(); if (rpn.length) al.push([rpn.length + ' return' + (rpn.length > 1 ? 's' : '') + ' to inspect', rpn.map(function (r) { return '#' + r.num + ' ' + returnPlaceText(r); }).join(' · '), scanReturnsNav()]);
          var loose = S.floor.filter(function (f) { return f.kind === 'parcel'; }).length; if (loose) al.push([loose + ' parcel' + (loose > 1 ? 's' : '') + ' on the floor', 'the inspector counts these', null]);
          if (S.up.fork && (S.fork.batt === undefined ? 1 : S.fork.batt) < 0.25) al.push(['Forklift battery ' + Math.round((S.fork.batt || 0) * 100) + '%', 'plug it in at the charger by the south wall', scanPropNav('charger', 'Charger')]);
          for (var id in (S.stage || {})) if (S.stage[id].length >= STAGE_CAP - 1 && LOADER_DOORS[id] !== undefined) al.push([dockLabel(LOADER_DOORS[id]) + ' shipping bay nearly full', S.stage[id].length + ' of ' + STAGE_CAP + ' · it empties when a truck of its lane docks', scanDoorNav(LOADER_DOORS[id])]);
          if (sorterOwned() && S.sort && S.sort.table.length >= 4) al.push(['Sorter turntable backing up', S.sort.table.length + ' parcels going round again', null]);
          if (!al.length) rows.push({ text: 'No alerts', sub: 'everything that needs a hand shows up here', col: '#5fd38d' });
          al.forEach(function (a) { rows.push({ text: '! ' + a[0], sub: a[1], col: '#ff6b5e', nav: a[2], act: a[3] || null }); });
        } else if (page === 1) {   // ORDERS: every open and packed order, oldest due first, its lines and where they are
          var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packing' || o.state === 'packed'; }).sort(function (a, b) { return a.due - b.due; });
          if (!os.length) rows.push({ text: 'No orders', sub: 'they arrive from 08:00 on working days', col: '#a0acb8' });
          os.forEach(function (o) {
            var ln = scanLane(o), first = null;
            if (o.state === 'open') o.lines.forEach(function (l) { if (first) return; var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0); if (have < l.qty) { var k = scanPickSlot(l.sku); if (k) first = scanSlotNav(k, skuName(l.sku) + ' for #' + o.num + ' · ' + slotName(k)); } });
            rows.push({ text: '#' + o.num + ' ' + clientName(o.client).slice(0, 18) + (o.rush ? ' RUSH' : ''), sub: (lanesOn() ? ln.tag + ' · ' : '') + dockLabel(modeDoor(orderMode(o))) + ' · due ' + dueText(o.due) + (o.late ? ' LATE' : '') + ' · ' + money(o.pay) + (o.state !== 'open' ? ' · ' + o.state.toUpperCase() : ''), right: o.state === 'open' ? o.lines.reduce(function (a, l) { return a + Math.min(l.qty, S.bench.boxes[l.sku] || 0); }, 0) + '/' + o.lines.reduce(function (a, l) { return a + l.qty; }, 0) : '', col: o.late || o.rush ? '#ff6b5e' : o.state === 'packed' ? '#5fd38d' : '#eef1f5', sw: ln.col, nav: first, hi: o.state === 'packed', act: o.state === 'open' ? { label: 'PACK', on: canPack(o) && powered(), why: !powered() ? 'No power.' : 'Not every box is on the bench yet.', run: function () { packOrder(o); } } : null });
            if (o.state === 'open') o.lines.forEach(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0), k = have < l.qty ? scanPickSlot(l.sku) : null; rows.push({ text: '   ' + skuName(l.sku), sub: '   ' + (have >= l.qty ? 'on the bench' : k ? slotName(k) : stockCount(l.sku) ? 'top level only: forklift' : 'not in stock'), right: have + '/' + l.qty, col: have >= l.qty ? '#5fd38d' : '#a0acb8', sw: SKU[l.sku].col, nav: k ? scanSlotNav(k, skuName(l.sku) + ' · ' + slotName(k)) : null }); });
          });
          var rts = returnsPending(); if (rts.length) { rows.push({ text: 'Returns · ' + rts.length, sub: 'to ' + scanReturnsWhere() + ' · ' + money(RETURNS.fee) + ' a return and ' + money(RETURNS.perBox) + ' a box', col: '#f5b53d', nav: scanReturnsNav() }); rts.forEach(function (r) { var pl = returnPlace(r.id), nav = null; if (pl === 'truck') { var tt = S.trucks.filter(function (x) { return (x.returns || []).indexOf(r.id) >= 0; })[0]; if (tt) nav = scanDoorNav(doorIndex(tt.dir, tt.dock)); } else if (pl === 'floor') { var ff = S.floor.filter(function (f) { return f.kind === 'return' && f.id === r.id; })[0]; if (ff) nav = { x: ff.x, z: ff.z, y: 0, label: 'Return #' + r.num }; } else if (pl === 'desk' || pl === 'inspecting' || pl === 'belt') nav = scanReturnsNav(); rows.push({ text: '   #' + r.num + ' ' + clientName(r.client).slice(0, 16), sub: '   ' + r.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + r.why + ' · ' + returnPlaceText(r), right: pl === 'inspecting' ? 'INSPECTING' : '', col: r.late ? '#ff6b5e' : '#a0acb8', sw: MODES[r.mode] ? MODES[r.mode].col : null, nav: nav }); }); }
        } else if (page === 2) {   // PICKS: one list for every open order together, less the bench and what is already on its way, in walking order
          var need = benchNeed(), fl = pickInFlight(), items = [];
          for (var sku in need) { var n = need[sku] - (fl[sku] || 0); if (n <= 0) continue; var k2 = scanPickSlot(sku); items.push({ sku: sku, n: n, key: k2, p: k2 ? slotParse(k2) : null }); }
          items.sort(function (a, b) { if (!a.key) return 1; if (!b.key) return -1; return (a.p.r - b.p.r) || (a.p.b - b.p.b); });
          if (!items.length) rows.push({ text: 'Nothing to pick', sub: Object.keys(need).length ? 'the cranes and the crew have every box on its way' : 'the bench has every box the open orders want', col: '#5fd38d' });
          items.forEach(function (it, i) { rows.push({ text: it.n + ' × ' + skuName(it.sku), sub: it.key ? slotName(it.key) + (i === 0 ? ' · next' : '') : stockCount(it.sku) ? 'top level only: the forklift reaches it' : 'not on the racks', right: it.key ? rowName(it.p.r).replace('Row ', '') + ' ' + (it.p.b + 1) : '', sw: SKU[it.sku].col, hi: i === 0, nav: it.key ? scanSlotNav(it.key, it.n + ' × ' + skuName(it.sku) + ' · ' + slotName(it.key)) : null }); });
          var sur = benchSurplus(), sn = 0; for (var sk in sur) sn += sur[sk]; if (sn) rows.push({ text: sn + ' surplus on the bench', sub: 'Enter puts it back on the racks, or the cart takes it', col: '#f5b53d', nav: scanPropNav('bench', 'Packing bench'), act: { label: 'RETURN', run: function () { returnSurplus(); } } });
        } else if (page === 3) {   // PUTAWAY: what is on a docked truck and where it should go, pallets on the floor, loose boxes
          var any = false;
          S.trucks.forEach(function (t) { if (t.dir !== 'in' || t.state !== 'docked') return; any = true; var di = doorIndex('in', t.dock), ps = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; });
            rows.push({ text: dockLabel(di) + ' · ' + clientName(t.client).slice(0, 16), sub: ps.length + ' pallets aboard · leaves ' + fmtTime(t.leave) + (t.signed ? '' : ' · NOT SIGNED'), col: t.signed ? '#f5b53d' : '#ff6b5e', hi: !t.signed, nav: scanDoorNav(di), act: t.signed ? null : scanSignAct(t) });
            ps.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); rows.push({ text: '   ' + p.n + ' × ' + skuName(p.sku), sub: '   ' + (k ? '→ ' + slotName(k) : 'no rack space on the hand levels'), sw: SKU[p.sku].col, col: '#a0acb8', nav: k ? scanSlotNav(k, p.n + ' × ' + skuName(p.sku) + ' → ' + slotName(k)) : null }); }); });
          var flp = S.pallets.filter(function (p) { return p.place === 'floor' && p.n > 0; });
          flp.forEach(function (p) { if (!any) { rows.push({ text: 'On the floor', sub: 'pallets set down and not racked', col: '#f5b53d' }); any = true; } var k = findSlotFor(p.sku, p.n, 1); rows.push({ text: p.n + ' × ' + skuName(p.sku) + (p.wrapped ? ' (wrapped)' : ''), sub: (k ? '→ ' + slotName(k) : 'no rack space') + ' · at ' + p.x.toFixed(0) + ', ' + p.z.toFixed(0), sw: SKU[p.sku].col, nav: { x: p.x, z: p.z, y: 0, label: 'Pallet of ' + skuName(p.sku) } }); });
          var lb = S.floor.filter(function (f) { return f.kind === 'box'; }); if (lb.length) { any = true; rows.push({ text: lb.length + ' loose box' + (lb.length > 1 ? 'es' : '') + ' on the floor', sub: 'the inspector counts these · RETURN SURPLUS racks the undamaged ones', col: '#ff6b5e', nav: { x: lb[0].x, z: lb[0].z, y: 0, label: 'Loose box of ' + skuName(lb[0].sku) }, act: { label: 'RETURN', run: function () { returnSurplus(); } } }); }
          if (!any) rows.push({ text: 'Nothing to put away', sub: 'inbound trucks at ' + TRUCK_IN.map(fmtTime).join(' and '), col: '#5fd38d' });
        } else if (page === 4) {   // STOCK: every line, most first, with its slots, what the orders want of it, and the low ones flagged
          var sum = stockSummary(), keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a]; }), used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
          rows.push({ text: totalStock() + ' boxes · ' + used + ' / ' + slotTotal() + ' slots', sub: S.up.rows + ' main rows' + (upperOwned() ? ' · the deck' : '') + (groundRows().length > S.up.rows ? ' · ' + (groundRows().length - S.up.rows) + ' annex rows' : ''), col: '#f5b53d' });
          if (!keys.length) rows.push({ text: 'The racks are empty', sub: 'the first truck is due at ' + fmtTime(TRUCK_IN[0]), col: '#a0acb8' });
          keys.forEach(function (k) { var want = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) want += l.qty; }); }); var sl = slotsWith(k), first = sl.filter(function (q) { return slotParse(q).l < RACK.top; })[0] || sl[0]; rows.push({ text: skuName(k), sub: sl.slice(0, 3).map(slotName).join(' · ') + (sl.length > 3 ? ' +' + (sl.length - 3) : '') + (want ? ' · orders want ' + want : ''), right: String(sum[k]) + (sum[k] < 6 ? ' LOW' : ''), col: sum[k] < 6 ? '#ff6b5e' : '#eef1f5', sw: SKU[k].col, nav: first ? scanSlotNav(first, skuName(k) + ' · ' + slotName(first)) : null }); });
        } else if (page === 5) {   // DOCKS: every door, its lane, its truck, the next window, the shipping bays
          if (TRUCK_OUT[0] && TRUCK_OUT[0].van) { var vt = truckAtDoor(2); rows.push({ text: 'The van · ' + (vt ? vt.parcels.length + ' of ' + VAN.cap + ' aboard' : 'not here'), sub: vt ? 'at the shed front · leaves ' + fmtTime(vt.leave) : outNextText(0) + ' · it parks at the shed front', right: vt ? 'VAN' : '', sw: '#5fd38d', hi: !!vt, nav: { x: VAN.x + 1.6, z: VAN.z, y: YARD_Y, label: 'The van' }, act: vt && vt.parcels.length ? { label: 'DISPATCH', on: true, run: function () { consoleUse(2); } } : null }); }
          DOOR_MAP.forEach(function (dm, i) { if (!doors[i]) return; var t = truckAtDoor(i), lane = dockLane(i), own = doorOwned(i);
            var sub = !own ? 'opens with the sortation deck' : t ? (t.dir === 'in' ? t.pallets.length + ' pallets · ' + (t.signed ? 'signed' : 'NOT SIGNED') : t.dir === 'ret' ? (t.returns || []).length + ' returns aboard' : t.parcels.length + ' parcels aboard' + (t.returns && t.returns.length ? ' · ' + t.returns.length + ' return' + (t.returns.length > 1 ? 's' : '') : '')) + ' · leaves ' + fmtTime(t.leave) : dm.dir === 'in' ? 'next at ' + TRUCK_IN.map(fmtTime).join(' / ') : dm.dir === 'ret' ? 'returns truck · next at ' + TRUCK_RET.map(fmtTime).join(' / ') : outNextText(dm.dock) + (outNext(dm.dock).tomorrow ? '' : ' to ' + fmtTime(outNext(dm.dock).leave));
            var bayId = null; for (var lid in LOADER_DOORS) if (LOADER_DOORS[lid] === i) bayId = lid; if (bayId && propInst[BAY.at[bayId].prop]) sub += ' · bay ' + stageOf(bayId).length + '/' + STAGE_CAP;
            rows.push({ text: dockLabel(i) + (lane && lanesOn() ? ' · ' + lane.name.toUpperCase() : dm.dir === 'in' ? ' · inbound' : ' · outbound') + ' · ' + (S.doors[i] ? 'OPEN' : 'shut'), sub: sub, right: t ? 'TRUCK' : '', sw: lane ? lane.col : '#f5b53d', hi: !!t, col: own ? '#eef1f5' : '#6b7784', nav: scanDoorNav(i), act: own ? { label: S.doors[i] ? 'CLOSE' : 'OPEN', on: !S.events.power, why: 'No power: the door motor is dead.', run: function () { setDoor(i, !S.doors[i]); } } : null });
            if (t) rows.push({ text: '   ' + (t.dir === 'in' ? 'Inbound' : t.dir === 'ret' ? 'Returns' : (MODES[t.mode] || MODES.land).name) + ' truck · ' + t.driver, sub: '   ' + (t.dir === 'in' ? (t.signed ? 'signed · ' + t.pallets.length + ' pallets' : 'NOT SIGNED') : t.dir === 'out' ? t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded' : (t.returns || []).length + ' returns aboard') + ' · leaves ' + fmtTime(t.leave), col: '#a0acb8', act: t.dir === 'in' ? (t.signed ? null : scanSignAct(t)) : t.dir === 'out' ? { label: 'DISPATCH', on: t.parcels.length > 0, why: 'Nothing loaded yet.', run: function () { consoleUse(i); } } : null }); });
          var packedBy = {}; S.orders.forEach(function (o) { if (o.state === 'packed') { var m = orderMode(o); packedBy[m] = (packedBy[m] || 0) + 1; } });
          if (lanesOn()) rows.push({ text: 'Waiting to ship: sea ' + (packedBy.sea || 0) + ' · land ' + (packedBy.land || 0) + ' · air ' + (packedBy.air || 0), sub: 'wrong door pays a ' + Math.round((1 - MODE_FEE) * 100) + '% fee · misrouted so far ' + (S.stats.misrouted || 0), col: '#a0acb8' }); else rows.push({ text: 'Waiting to ship: ' + S.orders.filter(function (o) { return o.state === 'packed'; }).length + ' packed', sub: 'the lanes come with the hall at level ' + STAGES[2].level, col: '#a0acb8' });
        } else if (page === 6) {   // PLANT: every machine, jams first
          var pr = plantRows().filter(function (r) { return !r.dialOnly; });
          pr.sort(function (a, b) { return (/jam|off/.test(b.text) ? 1 : 0) - (/jam|off/.test(a.text) ? 1 : 0); });
          pr.forEach(function (r) { var parts = r.text.split('  ·  '), name = parts[0].trim(), st = parts.slice(1).join(' '), prop = ({ 'Pack line': 'packline', 'Moulding line': 'moulder', 'Palletiser': 'palletiser', 'Baler': 'baler', 'Stretch wrapper': 'wrapper', 'AGV-1': 'agvDock', 'Goods lift': 'lift', 'Sortation deck': 'scanner', 'Bench surplus': 'bench' })[name] || (/^Gantry /.test(name) ? 'gantry' + (name === 'Gantry upper' ? 5 : 'ABCDEF'.indexOf(name.slice(7))) : /^Dock loader/.test(name) ? 'dockLoader' + (+name.slice(-1)) : null);
            rows.push({ text: name + (st ? ' · ' + st : ''), sub: String(r.sub || '').slice(0, 60), right: r.right || '', col: /jam|off|paused/.test(st) ? '#ff6b5e' : r.hi ? '#5fd38d' : '#eef1f5', hi: /jam/.test(st), nav: prop ? scanPropNav(prop, name) : null, act: r.btn ? { label: String(r.btn.label), on: r.btn.on !== false, why: 'Not now.', run: r.btn.act } : null }); });
          if (!pr.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench', col: '#a0acb8' });
        } else {   // CREW: who is in, what they are at, and you
          if (!S.staff.length) rows.push({ text: 'No crew', sub: 'hire ' + (unlocked('pc') ? 'on the office PC' : 'on the clipboard') + ' from level ' + UNLOCK.picker + ' · ' + staffCapAt(S.level) + ' head' + (staffCapAt(S.level) === 1 ? '' : 's') + ' at this level', col: '#a0acb8' });
          S.staff.forEach(function (st) { var task = st.task ? (st.task.kind === 'pick' ? 'picking ' + skuName(st.task.sku) : st.task.kind === 'fetch' ? 'fetching a pallet' : st.task.kind === 'return' ? 'returning ' + skuName(st.task.sku) : st.task.kind === 'rdesk' ? 'taking a return to the desk' : /^ret/.test(st.task.kind) ? 'on the returns' : st.task.kind) : st.carry ? (st.carry.kind === 'box' ? 'carrying ' + skuName(st.carry.sku) : st.carry.kind === 'return' ? 'carrying a return' : 'carrying a parcel') : st.state === 'drive' ? 'on the forklift' : st.state === 'break' ? 'on break' : staffStatus(st);
            rows.push({ text: st.name + ' · ' + STAFF_ROLES[st.role].name + (st.cross ? ' +' + STAFF_ROLES[st.cross].name.toLowerCase() : ''), sub: task + ' · ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h today · ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.lateToday ? ' · late' : ''), right: st.clocked ? 'IN' : '', hi: !!st.clocked, col: st.clocked ? '#eef1f5' : '#a0acb8', staff: st.id, nav: st.clocked ? { x: st.x, z: st.z, y: 0, label: st.name } : null, act: st.lateToday && !st.wordToday ? { label: 'WORD', run: function () { staffWord(st); } } : { label: 'SHIFT ▸', run: function () { staffShiftCycle(st); } } }); });
          rows.push({ text: S.clockedIn ? 'You · on the clock since ' + fmtTime(S.clockInAt) : 'You · not clocked in', sub: S.clockedIn ? (Math.round(myHours() * 10) / 10) + ' h this shift' : 'the time clock is by the staff door', right: '', col: S.clockedIn ? '#5fd38d' : '#f5b53d', nav: scanPropNav('timeclock', 'Time clock'), act: { label: S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', run: function () { myClock(!S.clockedIn); } } });
          if (S.up.fork) rows.push({ text: 'Forklift · battery ' + Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100) + '%', sub: forkCharging() ? 'charging' : S.fork.plugged ? 'plugged in, full' : 'not plugged in', col: (S.fork.batt === undefined ? 1 : S.fork.batt) > 0.3 ? '#eef1f5' : '#ff6b5e', nav: { x: S.fork.x, z: S.fork.z, y: 0, label: 'Forklift' } });
        }
        return rows;
      }
    /* 13-scanner-device.js */
    function scanReadout() {
        if (!focus) return null;
        if (focus.slot) { var sl = S.slots[focus.slot], want = 0, sk = sl && sl.sku; if (sk) S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sk) want += l.qty; }); }); return { key: 'slot:' + focus.slot, head: slotName(focus.slot), body: sl && sl.n ? sl.n + ' × ' + skuName(sl.sku) + (sl.pal ? ' on a pallet' : '') + (want ? ' · orders want ' + want : '') : sl && sl.pal ? 'an empty pallet' : 'empty · ' + ECON.slotCap + ' boxes of one line fit' }; }
        var src = focus.src;
        if (src) {
          if (src.kind === 'truckReturn' || src.kind === 'rdeskq' || src.kind === 'rdeskcur' || (src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'return')) { var rid = src.kind === 'truckReturn' ? src.id : src.kind === 'rdeskq' ? rdesk().queue[src.idx] : src.kind === 'rdeskcur' ? rdesk().cur : S.floor[src.idx].id, rr = returnById(rid); if (rr) return { key: 'ret:' + rr.id, head: returnLabel(rr), body: rr.lines.map(function (l) { return l.qty + ' × ' + skuName(l.sku); }).join(', ') + ' · ' + rr.why + ' · ' + money(returnFee(rr)) + ' fee at the desk' }; }
          if (src.kind === 'pallet') { var p = palletById(src.id); if (p) { var k = p.n ? findSlotFor(p.sku, p.n, 1) : null; return { key: 'pal:' + p.id, head: p.n ? p.n + ' × ' + skuName(p.sku) : 'Empty pallet', body: (p.wrapped ? 'wrapped · ' : '') + (p.place === 'truck' ? 'on the truck' : p.place === 'floor' ? 'on the floor' : p.place) + (k ? ' · goes to ' + slotName(k) : '') }; } }
          var oid = src.kind === 'shelf' || src.kind === 'stage' ? src.order : src.kind === 'belt' && src.item && src.item.kind === 'parcel' ? src.item.order : src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'parcel' ? S.floor[src.idx].order : src.kind === 'cart' && src.idx >= S.cart.boxes.length ? (S.cart.parcels || [])[src.idx - S.cart.boxes.length] : null;
          var o = oid ? orderById(oid) : null;
          if (o) { var m = MODES[orderMode(o)]; return { key: 'par:' + o.id, head: 'Parcel #' + o.num + ' · ' + clientName(o.client).slice(0, 16), body: (lanesOn() ? m.name.toUpperCase() + ' lane · ' : '') + 'out by ' + dockLabel(modeDoor(orderMode(o))) + ' · due ' + dueText(o.due) + (o.form ? ' · ' + o.form : '') + (o.late ? ' · LATE' : '') }; }
          var bsku = src.kind === 'bench' ? src.sku : src.kind === 'belt' && src.item && src.item.kind === 'box' ? src.item.sku : src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'box' ? S.floor[src.idx].sku : src.kind === 'cart' && src.idx < S.cart.boxes.length ? S.cart.boxes[src.idx] : src.kind === 'rdesk' && rdesk().shelf[src.idx] ? rdesk().shelf[src.idx].sku : null;
          if (bsku) { var w2 = 0; S.orders.forEach(function (o2) { if (o2.state === 'open') o2.lines.forEach(function (l) { if (l.sku === bsku) w2 += l.qty; }); }); return { key: 'box:' + bsku + ':' + src.kind, head: 'Box of ' + skuName(bsku), body: (src.kind === 'bench' ? 'on the bench' : src.kind === 'belt' ? 'riding the ' + beltLabel(BELTS[src.belt]) : src.kind === 'floor' ? 'loose on the floor' : src.kind === 'rdesk' ? (rdesk().shelf[src.idx].damaged ? 'a damaged return: for the bin' : 'a return: back on a rack') : 'on the cart') + (w2 ? ' · orders want ' + w2 : ' · no open order wants it') }; }
        }
        if (focus.truck) { var t = truckById(focus.truck); if (t) return { key: 'truck:' + t.id, head: (t.dir === 'in' ? 'Inbound' : (MODES[t.mode] || MODES.land).name + ' truck') + ' at ' + dockLabel(doorIndex(t.dir, t.dock)), body: (t.dir === 'in' ? t.pallets.length + ' pallets · ' + (t.signed ? 'signed' : 'not signed yet') : t.parcels.length + ' parcels aboard') + ' · leaves ' + fmtTime(t.leave) + ' · ' + t.driver }; }
        if (focus.staffId) { var st = staffById(focus.staffId); if (st) return { key: 'staff:' + st.id, head: st.name + ' · ' + STAFF_ROLES[st.role].name, body: staffStatus(st) + ' · ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h today' }; }
        if (focus.prop) { var pr = plantRows().filter(function (r) { return !r.dialOnly; }), lbl = propLabel(focus.prop), hit = pr.filter(function (r) { return r.key === focus.prop; })[0] || pr.filter(function (r) { return r.text.toLowerCase().indexOf(lbl.toLowerCase().split(' ')[0]) === 0; })[0]; return { key: 'prop:' + focus.prop, head: lbl.charAt(0).toUpperCase() + lbl.slice(1), body: hit ? hit.text.split('  ·  ').slice(1).join(' · ') + (hit.right ? ' · dial ' + hit.right : '') : (focusText || '').slice(0, 60) }; }
        return null;
      }
    /* 13-scanner-device.js */
    var SCAN_ICONS = ['⌂', '≡', '✓', '▣', '▤', '⇄', '⚙', '☺', '⊞'];
    /* 13-scanner-device.js */
    function scanFit(c, s, maxW) { s = String(s); if (c.measureText(s).width <= maxW) return s; var lo = 0, hi = s.length; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (c.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; } return s.slice(0, lo).replace(/[\s·]+$/, '') + '…'; }
    /* 13-scanner-device.js */
    function drawScanner() {
        var c = scanDev.ctx; if (!c) return; var w = SCAN_W, h = SCAN_H; c.setTransform(SCAN_RES, 0, 0, SCAN_RES, 0, 0);
        c.fillStyle = '#0a0f13'; c.fillRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(245,181,61,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f5b53d'; c.font = 'bold 15px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText(SCAN_PAGES[scan.page].toUpperCase(), 12, 20);
        c.fillStyle = '#a0acb8'; c.font = '11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(fmtTime(S.time) + '  ▮▮▮', w - 12, 20); c.textAlign = 'left';
        var tn = SCAN_PAGES.length, tw = Math.floor((w - 24 - (tn - 1) * 3) / tn);
        for (var p = 0; p < tn; p++) { var tx = 12 + p * (tw + 3), openP = scanPageOpen(p); c.fillStyle = p === scan.page ? '#f5b53d' : openP ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; c.fillRect(tx, 28, tw, 18); c.fillStyle = p === scan.page ? '#1a1205' : openP ? '#a0acb8' : '#4a535c'; c.font = 'bold 10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(openP ? (p + 1) + ' ' + SCAN_ICONS[p] : 'L' + UNLOCK[SCAN_LVL[p]], tx + tw / 2, 41); }   // a locked page shows the level that opens it
        c.textAlign = 'left';
        var footH = 52;
        if (!scanPageOpen(scan.page)) scan.page = 0;
        if (scan.page === MAP_PAGE) { scanDev.rows = []; drawScanMap(c, 8, 54, w - 16, h - 54 - footH - 6); drawScanFoot(c, w, h, footH); scanDev.tex.needsUpdate = true; return; }
        var rows = scanPageRows(scan.page); scanDev.rows = rows; if (scan.sel >= rows.length) scan.sel = Math.max(0, rows.length - 1); if (scan.sel < 0) scan.sel = 0;
        var y0 = 56, rowH = 30, maxRows = Math.floor((h - y0 - footH - 10) / rowH);   // ten px kept for the page counter under the last row
        if (scan.sel < scan.scroll) scan.scroll = scan.sel; if (scan.sel >= scan.scroll + maxRows) scan.scroll = scan.sel - maxRows + 1; scan.scroll = clamp(scan.scroll, 0, Math.max(0, rows.length - maxRows));   // the view follows the cursor (this line sat inside a comment from 1.16.0 to 1.19.0, so long pages never scrolled)
        var y = y0;
        rows.slice(scan.scroll, scan.scroll + maxRows).forEach(function (r, i) {
          var idx = scan.scroll + i, sel = idx === scan.sel;
          c.fillStyle = sel ? 'rgba(245,181,61,0.22)' : r.hi ? 'rgba(95,211,141,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(8, y, w - 16, rowH - 3);
          if (sel) { c.fillStyle = '#f5b53d'; c.fillRect(8, y, 3, rowH - 3); }
          var x = 14; if (r.sw) { c.fillStyle = r.sw; c.fillRect(x, y + 6, 8, 14); x += 14; }
          var rightW = 0; if (r.right) { c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; rightW = c.measureText(String(r.right)).width + 8; }
          c.fillStyle = r.col || '#eef1f5'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, r.text, w - 14 - x - rightW), x, y + 11);
          var al = r.act ? '⏎ ' + r.act.label : null, actW = 0; if (al) { c.font = 'bold 9px Bahnschrift, Arial, sans-serif'; actW = c.measureText(al).width + 14; }
          if (r.sub) { c.fillStyle = '#a0acb8'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, r.sub, w - 14 - x - (r.nav ? 16 : 0) - actW), x, y + 23); }
          if (al) { var aw = actW - 4, ax = w - 14 - aw - (r.nav ? 14 : 0), off = r.act.on === false; c.fillStyle = off ? 'rgba(255,255,255,0.08)' : sel ? '#f5b53d' : 'rgba(245,181,61,0.3)'; c.fillRect(ax, y + 15, aw, 12); c.fillStyle = off ? '#6b7784' : sel ? '#1a1205' : '#eef1f5'; c.font = 'bold 9px Bahnschrift, Arial, sans-serif'; c.fillText(al, ax + 5, y + 24); }
          if (r.right) { c.fillStyle = r.hi ? '#5fd38d' : '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), w - 14, y + 11); c.textAlign = 'left'; }
          if (r.nav) { c.fillStyle = sel ? '#f5b53d' : 'rgba(255,255,255,0.25)'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('⌖', w - 14, y + 23); c.textAlign = 'left'; }
          y += rowH;
        });
        if (rows.length > maxRows) { c.fillStyle = '#6b7784'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText((scan.scroll + 1) + '-' + Math.min(rows.length, scan.scroll + maxRows) + ' of ' + rows.length + ' · wheel', w - 12, h - footH - 4); c.textAlign = 'left'; }
        drawScanFoot(c, w, h, footH);
        scanDev.tex.needsUpdate = true;
      }
    /* 13-scanner-device.js */
    function drawScanFoot(c, w, h, footH) {
        var rd = scanReadout(), fy = h - footH;
        if (rd) { c.fillStyle = 'rgba(95,211,141,0.15)'; c.fillRect(0, fy, w, footH); c.fillStyle = '#5fd38d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, '▶ ' + rd.head, w - 24), 12, fy + 16); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, rd.body, w - 24), 12, fy + 31); }
        else if (scan.nav) { var d = Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z)); c.fillStyle = 'rgba(245,181,61,0.14)'; c.fillRect(0, fy, w, footH); c.fillStyle = '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, scanArrow() + ' ' + scan.nav.label, w - 24), 12, fy + 16); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(Math.round(d) + ' m · X clears the waypoint', 12, fy + 31); }
        else { c.fillStyle = '#6b7784'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, 'Point the beam at a slot, a pallet, a parcel, a truck or a machine', w - 24), 12, fy + 16); c.fillText(scanFit(c, '1-9 pages · wheel · F waypoint on ⌖ · Enter acts on ⏎ rows', w - 24), 12, fy + 31); }
        c.fillStyle = '#6b7784'; c.font = '8px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('Tab closes', w - 12, h - 6); c.textAlign = 'left';
      }
    /* 13-scanner-device.js */
    function scanArrow() {
        if (!scan.nav) return ''; var yawTo = Math.atan2(-(scan.nav.x - player.x), -(scan.nav.z - player.z)), rel = yawTo - player.yaw; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
        var a = Math.abs(rel); return a < Math.PI / 8 ? '↑' : a < 3 * Math.PI / 8 ? (rel > 0 ? '↖' : '↗') : a < 5 * Math.PI / 8 ? (rel > 0 ? '←' : '→') : a < 7 * Math.PI / 8 ? (rel > 0 ? '↙' : '↘') : '↓';
      }
    /* 13-scanner-device.js */
    function scanSignAct(t) { return { label: 'SIGN', run: function () { var tt = truckById(t.id); if (!tt || tt.state !== 'docked' || tt.signed) { sfx('bad'); return; } signTruck(tt); var dm = truckMeshes[tt.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); } }; }
    /* 13-scanner-map.js */
    var MAP_PAGE = 8;
    /* 13-scanner-map.js */
    function mapBounds() {
        var b = { x0: -HALL.x - 16, x1: HALL.x + 16, z0: stageHas('wing') ? WING.z0 - 2 : -HALL.z - 3, z1: HALL.z + (BOOT_STAGE === 0 ? 8 : 3) };   // the hall, the wing (from the hall stage), the trucks on both aprons, the van at the shed front
        for (var h in HALLS) if (hallOwned(h) || stageHas('hallDoors')) { var H = HALLS[h]; b.x0 = Math.min(b.x0, H.x0 - (H.dockIn !== undefined ? 16 : 2)); b.x1 = Math.max(b.x1, H.x1 + 2); b.z0 = Math.min(b.z0, H.z0 - 2); }
        return b;
      }
    /* 13-scanner-map.js */
    function drawScanMap(c, x, y, w, h) {
        var b = mapBounds(), s = Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0)), ox = x + (w - (b.x1 - b.x0) * s) / 2, oz = y + (h - (b.z1 - b.z0) * s) / 2;
        var X = function (wx) { return ox + (wx - b.x0) * s; }, Z = function (wz) { return oz + (wz - b.z0) * s; };
        var rect = function (x0, x1, z0, z1, fill, stroke, dash) { c.beginPath(); c.rect(X(Math.min(x0, x1)), Z(Math.min(z0, z1)), Math.abs(x1 - x0) * s, Math.abs(z1 - z0) * s); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; if (dash) c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); } };
        var label = function (t, wx, wz, col, size, align) { c.fillStyle = col || '#a0acb8'; c.font = (size || 8) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = align || 'center'; c.fillText(t, X(wx), Z(wz)); c.textAlign = 'left'; };
        c.fillStyle = '#0f151b'; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(X(-HALL.x - 16), Z(-17), 16 * s, 14 * s); c.fillRect(X(HALL.x), Z(returnsHall() ? -37 : -25), 16 * s, (returnsHall() ? 34 : 22) * s);   // the aprons the trucks back onto (the east one reaches the returns dock once the returns hall is open)
        var FLOOR = 'rgba(120,140,160,0.13)', WALL = 'rgba(200,215,230,0.55)';
        rect(-HALL.x, HALL.x, -HALL.z, HALL.z, FLOOR, WALL);
        if (stageHas('wing')) { rect(WING.x0, WING.x1, WING.z0, WING.z1, FLOOR, WALL); label('WING', (WING.x0 + WING.x1) / 2, WING.z0 + 3.2, '#6b7784', 8); }
        for (var hk in HALLS) { var H = HALLS[hk], own = hallOwned(hk); if (!own && !stageHas('hallDoors')) continue; rect(H.x0, H.x1, H.z0, H.z1, own ? FLOOR : null, own ? WALL : 'rgba(200,215,230,0.22)', !own); label(H.name.toUpperCase(), (H.x0 + H.x1) / 2, H.z0 + 3.2, own ? '#6b7784' : '#3d4652', 8); }
        if (stageHas('rooms')) { var zs = HALL.z - 24, zn = 24 - HALL.z; rect(HALL.x - 7.5, HALL.x, 18.5 + zs, HALL.z, 'rgba(245,181,61,0.08)', 'rgba(245,181,61,0.35)'); label('OFFICE', HALL.x - 3.75, 21.8 + zs, '#f5b53d', 7);
          rect(-HALL.x, -HALL.x + 4.5, 18.5 + zs, HALL.z, null, 'rgba(200,215,230,0.3)'); label('LOBBY', -HALL.x + 2.25, 21.8 + zs, '#6b7784', 6);
          rect(-HALL.x, -HALL.x + 7, -HALL.z, -20.2 + zn, null, 'rgba(200,215,230,0.3)'); label('BREAK', -HALL.x + 3.5, -21.6 + zn, '#6b7784', 6); }
        else label('THE SHED', 0, -HALL.z - 1.2, '#6b7784', 7);
        if (upperOwned()) { rect(-HALL.x, HALL.x, UPPER.z0, UPPER.z1, 'rgba(120,189,245,0.08)', 'rgba(120,189,245,0.3)'); label(sorterOwned() ? 'SORTATION DECK' : 'MEZZANINE', 0, UPPER.z1 - 1.0, '#78bdf5', 7); }
        // the rack rows you own, lettered, and the upper row
        groundRows().forEach(function (r) { var p0 = rackSlotPos(r, 0, 0), p1 = rackSlotPos(r, rowBays(r) - 1, 0), lo = Math.min(p0.x, p1.x) - RACK.bayW / 2, hi = Math.max(p0.x, p1.x) + RACK.bayW / 2; rect(lo, hi, p0.z - RACK.depth / 2, p0.z + RACK.depth / 2, 'rgba(245,181,61,0.55)', null); label(rowLetter(r), lo - 1.0, p0.z + 1.0, '#f5b53d', 7, 'right'); });
        // the docks: a notch on the wall in the lane colour, the label, and the truck when one is in
        DOOR_MAP.forEach(function (dm, i) { var d = doors[i]; if (!d) return; var lane = dockLane(i), col = lane ? lane.col : '#f5b53d', own = doorOwned(i), wx = d.side * HALL.x;
          c.fillStyle = own ? col : 'rgba(255,255,255,0.15)'; c.fillRect(X(wx) - 2, Z(d.z - DOCKS.w / 2), 4, DOCKS.w * s); label(dockLabel(i), wx + d.side * 2.4, d.z + 1.4, own ? col : '#6b7784', 7, d.side < 0 ? 'right' : 'left');
          var t = truckAtDoor(i); if (t) { var tb = trailerBounds(t); rect(tb.x0, tb.x1, tb.z0, tb.z1, 'rgba(238,241,245,0.7)', null); var cx0 = t.x + t.side * TRAILER.len, cx1 = t.x + t.side * (TRAILER.len + 3.2); rect(cx0, cx1, t.z - 1.2, t.z + 1.2, col, null); } });
        // the things worth finding
        [['bench', 'BENCH'], ['returnsDesk', 'RETURNS'], ['retDesk1', 'RETURNS'], ['retCage', 'RESTOCK'], ['palletiser', 'PALLETISER'], ['moulder', 'MOULDER'], ['agvDock', 'AGV DOCK'], ['timeclock', 'CLOCK'], ['cot', 'COT'], ['empties', 'EMPTIES'], ['wrapper', 'WRAP'], ['baler', 'BALER'], ['desk', 'PC']].forEach(function (p) { if (!propInst[p[0]] || propPlacement(p[0]).hidden) return; var P = propPlacement(p[0]); c.fillStyle = 'rgba(238,241,245,0.5)'; c.fillRect(X(P.x) - 2, Z(P.z) - 2, 4, 4); label(p[1], P.x, P.z - 1.2, '#a0acb8', 6); });
        // the forklift, the AGV, the crew
        if (S.up.fork) { c.fillStyle = '#f5b53d'; c.fillRect(X(S.fork.x) - 3, Z(S.fork.z) - 3, 6, 6); }
        if (S.up.agv && S.agv) { c.fillStyle = '#78bdf5'; c.fillRect(X(S.agv.x) - 2.5, Z(S.agv.z) - 2.5, 5, 5); }
        S.staff.forEach(function (st) { var m = staffMeshes[st.id]; if (!m || !m.visible) return; c.fillStyle = st.state === 'break' ? '#a0acb8' : '#5fd38d'; c.beginPath(); c.arc(X(st.x), Z(st.z), 3.5, 0, 6.3); c.fill(); c.fillStyle = '#0a0f13'; c.font = 'bold 6px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(st.name.slice(0, 1), X(st.x), Z(st.z) + 2.2); c.textAlign = 'left'; });
        // the waypoint, and you
        if (scan.nav) { c.strokeStyle = '#5fd38d'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(scan.nav.x), Z(scan.nav.z), 5 + Math.sin(worldTime * 4) * 1.5, 0, 6.3); c.stroke(); }
        c.save(); c.translate(X(player.x), Z(player.z)); c.rotate(-player.yaw); c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 14, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
        // the scale bar and north
        c.fillStyle = '#6b7784'; c.fillRect(x + 10, y + h - 9, 10 * s, 1.5); c.font = '7px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText('10 m', x + 10, y + h - 12); c.textAlign = 'right'; c.fillText('N ↑', x + w - 8, y + 12); c.textAlign = 'left';
        c.fillStyle = '#5fd38d'; c.beginPath(); c.arc(x + w - 62, y + h - 8, 3, 0, 6.3); c.fill(); c.fillStyle = '#6b7784'; c.font = '7px Bahnschrift, Arial, sans-serif'; c.fillText('crew', x + w - 56, y + h - 5); c.fillStyle = '#f5b53d'; c.fillRect(x + w - 36, y + h - 11, 6, 6); c.fillStyle = '#6b7784'; c.fillText('fork', x + w - 27, y + h - 5);
      }
    /* 13-ui.js */
    var scan = { page: 0, sel: 0, scroll: 0, nav: null };
    /* 13-ui.js */
    var SCAN_PAGES = ['Home', 'Orders', 'Picks', 'Putaway', 'Stock', 'Docks', 'Plant', 'Crew', 'Map'];
    /* 13-ui.js */
    function scanToggle(on) { if (on && driving) return; ui.scanOpen = on; if (on) { sfx('scan'); introStep('scanner'); drawScanner(); } }
    /* 13-ui.js */
    var SCAN_LVL = [null, null, null, 'scanPutaway', 'scanStock', 'scanDocks', 'scanPlant', 'scanCrew', 'scanMap'];
    /* 13-ui.js */
    function scanPageOpen(i) { return !SCAN_LVL[i] || unlocked(SCAN_LVL[i]); }
    /* 13-ui.js */
    function scanPage(i) { if (!scanPageOpen(i)) { sfx('bad'); toast('The ' + SCAN_PAGES[i] + ' page comes at level ' + UNLOCK[SCAN_LVL[i]] + '.', ''); return; } scan.selBy = scan.selBy || {}; scan.selBy[scan.page] = scan.sel; scan.page = clamp(i, 0, SCAN_PAGES.length - 1); scan.sel = scan.selBy[scan.page] || 0; scan.scroll = 0; sfx('click'); drawScanner(); }
    /* 13-ui.js */
    function sw(sku) { return '<span class="sw" style="background:' + SKU[sku].col + '"></span>'; }
    /* 13-ui.js */
    function shopShows(u) { if (u.free) return false; var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0; if (rowN && rowN > RACK.rows.length) return false; return true; }
    /* 13-ui.js */
    function buyUpgrade(id) {
        var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; if (!u || !shopShows(u)) return;
        var rowN = /^row(\d)$/.test(id) ? +id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[id];
        if (owned || S.level < u.lvl || S.bank < u.price || (rowN && S.up.rows < rowN - 1) || (u.needs && !S.up[u.needs])) { sfx('bad'); return; }
        pay(-u.price, 'Bought ' + u.name);
        if (rowN) { S.up.rows = rowN; buildRack(rowN - 1); buildGantries(); } else { S.up[id] = true; if (id === 'shipbelt') { buildProp('shipBelt'); buildProp('dockLoader2'); buildProp('bay2'); } if (id === 'agv') buildProp('agvDock'); if (id === 'gantry') buildGantries(); if (id === 'upper') buildUpper(); if (id === 'sorter') buildSorter(); if (/^hall\d$/.test(id)) buildHall(id); }
        if (rowN && !edit.on) { unbakeStatic(); bakeStatic(); }   // every new row joins the bake, the fifth included
        if (id === 'lights') hallLights.forEach(function (l) { l.distance = 30; });
        toast(u.name + ' bought', 'good'); logEvent('Bought ' + u.name + ' for ' + money(u.price), 'good'); sfx('cash'); save();
      }
    /* 14-events.js */
    function newDay() {
        S.day++; S.stats.days++;
        if (stageRent()) pay(-stageRent(), 'Rent, day ' + S.day);   // the shed is rent free; the halls are not
        payStaffWages(); staffNewDay(); if (S.clockedIn) { myClock(false); logEvent('The clock ran past midnight: you were clocked out automatically'); }
        if (S.loan > 0) { var interest = Math.round(S.loan * 0.015); pay(-interest, 'Loan interest (1.5%)'); }
        if (S.insured) pay(-40, 'Insurance premium');
        closeDay();
        if (isSunday()) { toast('Sunday. The depot is closed: no trucks, no orders.', ''); logEvent('Sunday. Nothing moves today. A good day to sleep through.'); }
        for (var f in S.flags) if (/^(in|out|ret)\d+-/.test(f) && +f.replace(/^(in|out|ret)/, '').split('-')[0] < S.day - 1) delete S.flags[f];
        S.events.inspected = false; S.events.prowled = false;
        logEvent('Day ' + S.day + '. Rent and wages paid.', 'rare'); toast('Day ' + S.day, 'rare'); rebuildBoardSoon(); hudDirty = true; save();
        if (S.bank < -600) { toast('The bank is getting nervous: ' + money(S.bank), 'bad'); }
        if (S.siteDue > S.site) stageRebuild();   // the builders were in overnight
      }
    /* 14-events.js */
    function stageRebuild() {
        if (ui.rebuilding || S.siteDue <= S.site) return;
        var from = S.site, to = S.siteDue; S.site = to; stageFlags(S.up, to); ui.rebuilding = true;
        S.trucks.slice().forEach(function (t) { removeTruckMesh(t.id); }); S.trucks = []; S.pallets = S.pallets.filter(function (p) { return p.place !== 'truck'; });   // nothing rides through the rebuild
        S.flags.rebuiltFrom = from; logEvent('The builders were in: ' + stageName(from) + ' is ' + stageName(to).toLowerCase() + ' now.', 'rare'); save();
        try { sessionStorage.setItem('depotco-skip-splash', '1'); sessionStorage.setItem('depotco-autoplay', '1'); } catch (e) {}
        var fade = $('dc-fade'); if (fade) { fade.hidden = false; fade.style.opacity = '1'; fade.style.transition = 'none'; fade.innerHTML = '<div class="dc-fade-note"><b>The builders were in overnight.</b><span>' + esc(stageName(to)) + '</span></div>'; }
        sfx('fanfare'); if (ui.testing) { ui.rebuildPending = true; return; } setTimeout(function () { location.reload(); }, 2200);   // the test runner reloads the page itself
      }
    /* 14-events.js */
    function stageEarn() { var want = stageForLevel(S.level); if (want > S.siteDue) { S.siteDue = want; toast('The builders are booked: ' + stageName(want).toLowerCase() + ' in the morning. Sleep, or wait for the day roll.', 'rare'); logEvent('Level ' + S.level + ' earns ' + stageName(want).toLowerCase() + ': the builders come in at the day roll.', 'rare'); if (propInst.scaffold) buildProp('scaffold'); hudDirty = true; return true; } return false; }
    /* 14-events.js */
    function cotPrompt() { return S.time >= 17 || S.time < DAY_START || isSunday() ? 'Sleep until morning (rent and wages are due)' : 'Too early to sleep: the cot is for after 17:00'; }
    /* 14-events.js */
    function sleepNow() {
        if (!(S.time >= 17 || S.time < DAY_START || isSunday())) { toast('Too early. Come back after 17:00.', 'bad'); return; }   // a closed Sunday can be slept through at any hour
        sfx('sleep'); logEvent('Slept in the break room');
        var nightN = deckNightRun(); if (nightN) toast('Night shift: ' + nightN + ' parcel' + (nightN > 1 ? 's' : '') + ' sorted into the shipping bays overnight', 'good');
        S.trucks.slice().forEach(function (t) { if (t.state === 'docked') truckLeave(t, 'night'); });
        S.trucks.slice().forEach(function (t) { removeTruckMesh(t.id); }); S.trucks = [];
        if (S.time >= 17 && S.time < 23) prowlerCheck();   // sleeping past 23:00 is not a way round the prowler
        if (S.time >= DAY_START) { if (S.clockedIn) myClock(false); S.time = DAY_START; newDay(); } else S.time = DAY_START;   // your card is clocked out before the roll, or the shift reads 23 hours
        S.events.power = false; buff.coffeeUntil = 0; if (ui.rebuilding) return;   // the builders' fade is already up
        var fade = $('dc-fade'); fade.hidden = false; fade.style.opacity = '1'; fade.style.transition = 'none';   // a black fade, not the title card
        setTimeout(function () { fade.style.transition = 'opacity .9s'; fade.style.opacity = '0'; setTimeout(function () { fade.hidden = true; fade.style.opacity = ''; fade.style.transition = ''; }, 900); }, 400);
      }
    /* 14-events.js */
    function drinkCoffee() {
        if (S.events.power) { toast('No power.', 'bad'); return; }
        if (buff.coffeeDay === S.day && buff.coffeeUntil > S.time) { toast('You are already wired.', ''); return; }
        buff.coffeeDay = S.day; buff.coffeeUntil = S.time + 1; sfx('coffee'); toast('Coffee. Faster for an hour.', 'good');
      }
    /* 14-events.js */
    function flipBreaker() {
        if (S.events.power) { S.events.power = false; sfx('breaker'); toast('Power restored.', 'good'); logEvent('Breaker reset', 'good'); addXp(4); }
        else { sfx('click'); toast('The power is on. Leave it be.', ''); }
      }
    /* 14-events.js */
    function prowlerCheck() {
        if (S.events.prowled || !unlocked('prowler')) return; S.events.prowled = true;
        var open = doors.filter(function (d) { return S.doors[d.i] && !truckAtDoor(d.i); });
        if (!open.length) { var unl = hdoors.filter(function (d) { return (d.id === 'staff' || d.id === 'exit') && !hd(d.id).locked; }); if (unl.length && Math.random() < 0.5) { var keys2 = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys2.length) return; var key2 = pick(keys2), sku2 = S.slots[key2].sku, n2 = slotTake(key2, randi(1, 3)); S.stats.stolen = (S.stats.stolen || 0) + n2; addRep(-2); if (S.insured) { var refund2 = Math.round(n2 * SKU[sku2].val * 0.8); pay(refund2, 'Insurance payout, ' + n2 + ' boxes'); toast('Insurance paid ' + money(refund2) + ' for the loss', 'good'); } sfx('glass'); toast('Someone slipped in through ' + unl[0].label + ' and took ' + n2 + ' boxes. Lock up at night.', 'bad'); logEvent(n2 + ' boxes of ' + skuName(sku2) + ' taken through the unlocked ' + unl[0].label + '. Shift+E locks a door; the control cabinet locks them all.', 'bad'); } return; }
        var keys = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys.length) return;
        var key = pick(keys), sku = S.slots[key].sku, n = slotTake(key, randi(2, 6));
        S.stats.stolen = (S.stats.stolen || 0) + n; addRep(-3); sfx('glass');   // stolen, not refused: the two were one count until 1.16.0
        if (S.insured) { var refund = Math.round(n * SKU[sku].val * 0.8); pay(refund, 'Insurance payout, ' + n + ' boxes'); toast('Insurance paid ' + money(refund) + ' for the loss', 'good'); }
        toast('Someone walked off with ' + n + ' boxes through the open door at ' + dockLabel(open[0].i), 'bad'); logEvent(n + ' boxes of ' + skuName(sku) + ' stolen through the open door at ' + dockLabel(open[0].i) + '. Close the doors at night.', 'bad');
      }
    /* 14-events.js */
    function onLevelUp() {
        var lv = S.level, opens = levelOpens(lv), bonus = LEVEL_BONUS * lv;
        sfx('levelup'); pay(bonus, 'Level ' + lv + ' bonus');
        var what = opens.length ? opens.join('; ').replace(/^./, function (ch) { return ch.toUpperCase(); }) + '.' : 'Bigger orders and bigger loads.';
        logEvent('Level ' + lv + ': ' + money(bonus) + ' bonus. ' + what, 'rare');
        applyLevelUnlocks(lv); stageEarn(); showLevelCard(lv, opens, bonus); introStep('levelup');
        if (LADDER_TIPS[lv]) setTimeout(function () { feedPush(LADDER_TIPS[lv], 'good'); }, 1500);
        if (lv >= LEVEL_CAP) { logEvent('Level ' + LEVEL_CAP + ': the ladder is climbed. Everything the depot has is yours.', 'rare'); }
        hudDirty = true; screenDirtyAll(); if (ui.panelOpen) renderPanel();
      }
    /* 14-events.js */
    function nextLevelText() { if (S.level >= LEVEL_CAP) return 'Level ' + LEVEL_CAP + ': the top of the ladder'; var n = S.level + 1, note = LADDER_NOTES[n] || (levelOpens(n)[0] || 'more of everything'); return 'Next: level ' + n + ', ' + note; }
    /* 14-events.js */
    function showLevelCard(lv, opens, bonus) {
        if (!ui.started || S.flags.noLevelCard) return; var el = $('h-level'); if (!el) return;
        var st = stageForLevel(lv), grows = st > stageForLevel(lv - 1);
        el.innerHTML = '<div class="lv-head"><b>Level ' + lv + '</b><span>+' + money(bonus) + '</span></div>' + (grows ? '<div class="lv-stage">' + esc(STAGES[st].name) + ': the builders come in the morning</div>' : '') +
          '<ul>' + opens.filter(function (o) { return !/builders come in the morning/.test(o); }).map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' +
          (lv < LEVEL_CAP ? '<small>' + esc(nextLevelText()) + ' · any key closes</small>' : '<small>The ladder is climbed. Any key closes.</small>');
        el.hidden = false; cards['h-level'] = 18;   // the engine's card timer: any key closes it (Co Engine 41-shell)
      }
    /* 14-events.js */
    var INTRO = [
        ['door', 'This is your shed: one rack, one door, one table. Walk to the roll door <b>IN 1</b> on the west wall and press <b>E</b> on it, or on the console beside it. The first truck docks at 07:30.'],
        ['sign', 'When the truck is in and the door is up, the driver walks in and waits beside it. Press <b>E</b> on him to sign the delivery note. Nothing comes off until you do.'],
        ['unload', 'Walk into the trailer. Take a box off a pallet with <b>E</b>, or grab the pallet jack from the south wall and lift a whole pallet.'],
        ['putaway', 'Put it on the rack: look at a slot and press <b>E</b>. A slot holds 12 boxes of one line. The rack grows a bay every level until the hall.'],
        ['scanner', 'Press <b>Tab</b>. The scanner in your hand shows the orders and their slots and the pick list; its other pages unlock as you level. The wheel moves the cursor and <b>F</b> sets a waypoint on the highlighted row.'],
        ['order', 'Orders arrive from 08:30 on the board by the door and on the scanner. The clipboard on the table is your office: the shop and the crew are on it. Wait for the first order.'],
        ['pick', 'Take the boxes the order needs off the rack (<b>E</b> on the slot). One box per trip until you buy the cart at level 3.'],
        ['bench', 'Carry them to the <b>table</b> along the south wall and press E to put them down.'],
        ['pack', 'With empty hands press <b>E</b> on the table: you pack the first whole order on it by hand, four seconds a parcel. The parcel appears at the back of the table.'],
        ['load', 'Pick the parcel up and go out of the person door: the <b>van</b> parks at the shed front from 10:30 and 16:00. Press <b>E</b> at its back doors to load it.'],
        ['dispatch', 'The van leaves on its own at 12:00 and 17:30, or press <b>E</b> on the dock console to send it early. You are paid when it goes.'],
        ['levelup', 'Every parcel, pallet and box earns XP. Level 2 brings a second rack bay and the time clock; level 5 brings the hall, with proper docks and an office. The HUD says what the next level opens.']
      ];
    /* 14-events.js */
    function introStep(key) {
        if (!S.intro || S.intro.done) return;
        S.intro.did = S.intro.did || {};
        if (S.intro.did[key]) return;
        S.intro.did[key] = 1;
        var i = introIndex();
        if (i >= INTRO.length) { S.intro.done = true; pay(400, 'Intro bonus'); toast('Intro done: $400 bonus. The depot is yours.', 'rare'); logEvent('Guided intro finished. $400 bonus. Everything from here is on the ladder: the HUD says what the next level opens.', 'rare'); sfx('chime'); }
        else if (INTRO[i][0] !== key) { /* a step done out of order still counts */ }
        hudDirty = true;
      }
    /* 14-events.js */
    function introIndex() { var d = S.intro.did || {}; for (var i = 0; i < INTRO.length; i++) if (!d[INTRO[i][0]]) return i; return INTRO.length; }
    /* 14-life.js */
    var SEASONS = CAL.seasons;
    /* 14-life.js */
    var STATIONS = [
        { name: 'Depot FM', bpm: 92, wave: 'triangle', root: 220, chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], bass: [0, 0, 7, 5], hat: [1, 0, 1, 1, 1, 0, 1, 1], kick: [1, 0, 0, 0, 1, 0, 1, 0] },
        { name: 'Night Drive', bpm: 118, wave: 'sawtooth', root: 196, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], bass: [0, 0, 0, 3], hat: [1, 1, 1, 1, 1, 1, 1, 1], kick: [1, 0, 0, 0, 1, 0, 0, 0] },
        { name: 'Country 101', bpm: 104, wave: 'square', root: 247, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bass: [0, 7, 5, 7], hat: [0, 1, 0, 1, 0, 1, 0, 1], kick: [1, 0, 1, 0, 1, 0, 1, 0] }
      ];
    /* 14-life.js */
    var radio = { next: 0, step: 0, gain: null, timer: null };
    /* 14-life.js */
    function radioPrompt() { if (S.events.power) return 'The radio is off: no power'; return S.radio && S.radio.on ? 'Radio: ' + STATIONS[S.radio.station].name + ' · next station' : 'Switch the radio on'; }
    /* 14-life.js */
    function radioUse() {
        if (S.events.power) { toast('No power.', 'bad'); return; }
        if (!S.radio) S.radio = { on: false, station: 0 };
        if (!S.radio.on) { S.radio.on = true; S.radio.station = 0; } else if (S.radio.station < STATIONS.length - 1) S.radio.station++; else S.radio.on = false;
        sfx('click'); toast(S.radio.on ? '📻 ' + STATIONS[S.radio.station].name : 'Radio off', ''); audio(); radioStart();
      }
    /* 14-life.js */
    function radioStart() { if (!AC) return; if (!radio.gain) { radio.gain = AC.createGain(); radio.gain.gain.value = 0; radio.gain.connect(sfxBus); } if (!radio.timer) { radio.next = AC.currentTime + 0.1; radio.step = 0; radio.timer = setInterval(radioSchedule, 120); } }
    /* 14-life.js */
    function radioSchedule() {
        if (!AC || !S.radio || !S.radio.on || S.events.power) { if (radio.gain) radio.gain.gain.setTargetAtTime(0, AC ? AC.currentTime : 0, 0.3); return; }
        var st = STATIONS[S.radio.station], beat = 60 / st.bpm, sixteenth = beat / 4;
        while (radio.next < AC.currentTime + 0.35) {
          var t = radio.next, i = radio.step, bar = Math.floor(i / 16) % st.chords.length, chord = st.chords[bar], semi = function (n) { return st.root * Math.pow(2, n / 12); };
          if (i % 8 === 0) chord.forEach(function (n, k) { rTone(st.wave, semi(n) * (k === 2 ? 1 : 1), t, sixteenth * 7.5, 0.05, 1800); });
          if (i % 4 === 0) rTone('sine', semi(st.bass[Math.floor(i / 4) % 4] - 24), t, beat * 0.9, 0.12, 400);
          if (st.hat[i % 8]) rNoise(t, 0.03, 0.04, 6000);
          if (st.kick[i % 8]) { rTone('sine', 110, t, 0.14, 0.18, null, 40); }
          if (i % 16 === 14 && Math.random() < 0.5) rTone(st.wave, semi(chord[1] + 12), t, sixteenth * 2, 0.04, 2400);
          radio.next += sixteenth; radio.step++;
        }
      }
    /* 14-life.js */
    function rTone(type, f0, t, dur, gain, lp, f1) { var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = radio.gain; if (lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(dest); } else g.connect(dest); o.connect(g); o.start(t); o.stop(t + dur + 0.05); }
    /* 14-life.js */
    function rNoise(t, dur, gain, freq) { var len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; var g = AC.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(radio.gain); src.start(t); }
    /* 14-life.js */
    var cables = { fork: { tool: 'cable', prop: 'charger', mesh: null, plugged: function () { return !!S.fork.plugged; } } };
    /* 14-life.js */
    var CABLE_REACH = 8;
    /* 14-life.js */
    function cablePrompt(k) { var cb = cables[k], name = k === 'fork' ? 'forklift' : 'jack'; if (player.tool === cb.tool) return 'Hang the ' + name + ' cable back on the reel'; if (cb.plugged()) return 'Unplug the ' + name + ' (E)'; if (player.tool || S.hand) return 'Hands full'; return 'Take the ' + name + ' charging cable'; }
    /* 14-life.js */
    function cableUse(k) {
        var cb = cables[k], name = k === 'fork' ? 'forklift' : 'jack';
        if (player.tool === cb.tool) { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; }
        if (cb.plugged()) { S.fork.plugged = false; sfx('click'); toast(name.charAt(0).toUpperCase() + name.slice(1) + ' unplugged', ''); screenDirtyAll(); hudDirty = true; return; }
        if (player.tool || S.hand || driving) { toast('Hands full.', 'bad'); return; }
        player.tool = cb.tool; sfx('pickup'); toast('Carrying the cable · E on the ' + name + ' plugs it in · it reaches ' + CABLE_REACH + ' m', ''); hudDirty = true;
      }
    /* 14-life.js */
    function forkCharging() { return !!S.up.fork && !driving && !staffDriving() && !!S.fork.plugged && S.fork.batt < 1; }
    /* 14-life.js */
    var wrapper = { t: 0, pallet: null };
    /* 14-life.js */
    function wrapperBusy() { return wrapper.t > 0; }
    /* 14-life.js */
    function wrapperTarget() { var p = isJack(player.tool) ? jackPallet() : null; if (p) return p; var P = PROPS.wrapper ? propPlacement('wrapper') : null; if (!P) return null; var best = null, bd = 1.3 * 1.3; S.pallets.forEach(function (q) { if (q.place !== 'floor') return; var d = dist2(q.x, q.z, P.x, P.z); if (d < bd) { bd = d; best = q; } }); return best; }
    /* 14-life.js */
    function wrapperPrompt() {
        if (wrapperBusy()) return 'Wrapping… ' + Math.ceil(wrapper.t) + ' s';
        if (S.events.power) return 'The wrapper is off: no power';
        if (S.wrap && S.wrap.film <= 0) return 'The film roll is finished: fit a new one on the screen';
        var p = wrapperTarget(); if (p) return p.wrapped ? 'That pallet is already wrapped' : 'Wrap the pallet' + (p.place === 'floor' ? ' on the turntable' : '');
        return 'Stretch wrapper · set a pallet on the turntable, or bring one on the jack';
      }
    /* 14-life.js */
    function wrapperUse() {
        if (wrapperBusy() || S.events.power) return;
        var p = wrapperTarget(); if (!p || p.wrapped) { sfx('bad'); return; }
        if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 }; if (S.wrap.film <= 0) { toast('The film roll is finished. Fit a new one on the wrapper screen.', 'bad'); sfx('bad'); return; }
        S.wrap.film--; S.wrap.wrapped++; wrapper.t = 5; wrapper.pallet = p.id; sfx('hydraulic'); addXp(3); screenDirtyAll();
      }
    /* 14-report.js */
    var DAY_KEEP = 14, reportT = 0;
    /* 14-report.js */
    function daySnapshot() { return { day: S.day, earned: S.stats.earned, spent: S.stats.spent, shipped: S.stats.shipped, late: S.stats.late, received: S.stats.received, picked: S.stats.picked, putaway: S.stats.putaway, returns: S.stats.returns || 0, fines: S.stats.fines, misrouted: S.stats.misrouted || 0, lost: S.stats.lost, rep: S.rep, bank: S.bank }; }
    /* 14-report.js */
    function closeDay() {   // from newDay, after the morning charges, with S.day already the new day
        var a = S.dayStart;
        if (a) {
          var r = { day: a.day, earned: S.stats.earned - a.earned, spent: S.stats.spent - a.spent, shipped: S.stats.shipped - a.shipped, late: S.stats.late - a.late, received: S.stats.received - a.received, picked: S.stats.picked - a.picked, putaway: S.stats.putaway - a.putaway, returns: (S.stats.returns || 0) - a.returns, fines: S.stats.fines - a.fines, misrouted: (S.stats.misrouted || 0) - a.misrouted, lost: S.stats.lost - a.lost, rep: Math.round((S.rep - a.rep) * 10) / 10, bank: S.bank };
          r.net = r.earned - r.spent; if (!S.days) S.days = []; S.days.unshift(r); if (S.days.length > DAY_KEEP) S.days.pop();
          showDayReport(r);
        }
        S.dayStart = daySnapshot();
      }
    /* 14-report.js */
    function showDayReport(r) {
        logEvent('Day ' + r.day + ' closed: ' + money(r.earned) + ' in, ' + money(r.spent) + ' out, ' + r.shipped + ' shipped' + (r.late ? ' (' + r.late + ' late)' : '') + ', ' + r.received + ' pallets in', r.net >= 0 ? 'good' : 'bad');
        if (!ui.started) return; var el = $('h-report'); if (!el) return;
        var sign = function (n) { return (n >= 0 ? '+' : '') + n; };
        el.innerHTML = '<div class="rep-head"><b>Day ' + r.day + ' report</b><span class="' + (r.net >= 0 ? 'good' : 'bad') + '">' + (r.net >= 0 ? '+' : '') + money(r.net) + '</span></div>' +
          '<div class="rep-grid">' + [['Earned', money(r.earned)], ['Spent', money(r.spent)], ['Shipped', r.shipped + (r.late ? ' (' + r.late + ' late)' : '')], ['Pallets in', String(r.received)], ['Picked', r.picked + ' boxes'], ['Returns', String(r.returns)], ['Rep', sign(r.rep)], ['Bank', money(r.bank)]].map(function (k) { return '<i>' + k[0] + '</i><em>' + esc(k[1]) + '</em>'; }).join('') + '</div>' +
          '<small>Any key closes · the Stats app keeps a fortnight</small>';
        el.hidden = false; cards['h-report'] = 20;   // the engine's card timer: any key closes it
      }
    /* 14-report.js */
    function reportRows() { return (S.days || []).slice(0, 7).map(function (r) { return { text: 'Day ' + r.day + '  ·  ' + r.shipped + ' shipped' + (r.late ? ' (' + r.late + ' late)' : '') + ' · ' + r.received + ' pallets in' + (r.returns ? ' · ' + r.returns + ' returns' : ''), sub: money(r.earned) + ' in, ' + money(r.spent) + ' out · rep ' + (r.rep >= 0 ? '+' : '') + r.rep + ' · bank ' + money(r.bank), right: (r.net >= 0 ? '+' : '') + money(r.net), rcol: r.net >= 0 ? '#5fd38d' : '#ff6b5e' }; }); }
    // after the carried code: what the props expect the game to have set up
    if (typeof Proxy !== 'undefined') MACH = new Proxy(MACH || {}, { get: function (t, k) { if (typeof k === 'string' && !(k in t)) t[k] = {}; return t[k]; } });   // the machines' records fill as their props build
    RACK.bays = 4; RACK.x0 = -RACK.bays * RACK.bayW / 2;   // a rack row in the pack is four bays, centred on its own spot, not a hall's length
    // the definitions, each in a guard: one that cannot build here is left out rather than breaking the pack
    try {
      for (var rr = 0; rr < RACK.rows.length; rr++) (function (r) { defProp('rack' + r, { label: 'rack row ' + 'ABCDEF'[r], cat: 'hall', abs: true, keep: true, shed: true, x: 0, z: RACK.rows[r], rot: 0, build: rackBuild(r), when: function () { return r < S.up.rows; } }); })(rr);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: rack: " + e.message); }
    try {
      defProp('timeclock', { label: 'time clock', cat: 'wall', wall: true, lvl: UNLOCK.clock, x: -19.74, z: 10.6, rot: 1, at: { 0: { x: -6.74, z: 4.55, rot: 1 } }, build: timeclockBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: timeclock: " + e.message); }
    try {
      defProp('cabinet', { label: 'control cabinet', cat: 'wall', wall: true, x: 12.42, z: 12.6, rot: 3, build: cabinetBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cabinet: " + e.message); }
    try {
      defProp('consoleIn0', { label: 'dock console IN 1', cat: 'wall', wall: true, abs: true, x: -29.7, z: -11.5, rot: 1, at: { 0: { x: -6.7, z: 2.4, rot: 1 }, 1: { x: -19.7, z: -5.5, rot: 1 } }, build: consoleBuild(0) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: consoleIn0: " + e.message); }
    try {
      defProp('console0', { label: 'dock console OUT 1', cat: 'wall', wall: true, abs: true, stage: 1, x: 29.7, z: -9.6, rot: 3, at: { 1: { x: 19.7, z: -5.5, rot: 3 } }, build: consoleBuild(2) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: console0: " + e.message); }
    try {
      defProp('breaker', { label: 'breaker panel', cat: 'wall', wall: true, stage: 1, x: 19.79, z: 9.6, rot: 3, build: breakerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: breaker: " + e.message); }
    try {
      defProp('board', { label: 'order board', cat: 'hall', x: 16.2, z: 7.4, rot: 2, at: { 0: { x: 6.75, z: -0.6, rot: 3 } }, build: boardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: board: " + e.message); }
    try {
      defProp('charger', { label: 'forklift charging point', cat: 'wall', wall: true, stage: 1, x: 0, z: 13.83, rot: 2, build: chargerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: charger: " + e.message); }
    try {
      defProp('painted', { label: 'painted name', cat: 'wall', wall: true, abs: true, keep: true, stage: 1, x: 28.5, z: -23.83, rot: 0, build: paintedBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: painted: " + e.message); }
    try {
      [[-30, -12], [-30, 10], [30, -15.5], [30, 10]].forEach(function (p, i) { defProp('lamp' + i, { label: 'lamp post', cat: 'yard', yard: true, x: p[0], z: p[1], rot: 0, at: i === 0 ? { 0: { x: -12, z: 10, rot: 0 } } : i === 2 ? { 0: { x: 12, z: -8, rot: 0 } } : null, build: lampPostBuild }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lamp: " + e.message); }
    try {
      [0, 1, 3, 4].forEach(function (k, i) { defProp('car' + i, { label: 'parked car', cat: 'yard', yard: true, abs: true, keep: true, stage: 2, x: -27.65 + k * 2.7, z: 31.5, rot: 1, build: carBuild(k) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: car: " + e.message); }
    try {
      defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: -30, z: 24, rot: 0, at: { 0: { x: -14, z: 12, rot: 0 } }, build: treeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: tree: " + e.message); }
    try {
      defProp('xLampPost', { extra: true, label: 'lamp post', ico: '💡', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 350, desc: 'Lights the yard at night.', build: lampPostBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xLampPost: " + e.message); }
    try {
      defProp('xCar', { extra: true, label: 'parked car', ico: '🚗', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 0, desc: 'Somebody is in.', build: function (c, P, inst) { carBuild(CAR_COLS[Math.floor(propSeed(inst ? inst.id : 'car', 1) * CAR_COLS.length)])(c); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCar: " + e.message); }
    try {
      defProp('xAisleSign', { extra: true, lvl: UNLOCK.build, label: 'aisle sign', ico: '🪧', cat: 'hall', price: 40, desc: 'Hangs from the roof.', build: aisleSignBuild('AISLE') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xAisleSign: " + e.message); }
    try {
      defProp('lockers', { label: 'lockers', cat: 'room', x: -18.4, z: 13.55, rot: 2, build: lockerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lockers: " + e.message); }
    try {
      defProp('hooks', { label: 'coat hooks', cat: 'room', wall: true, x: -16.6, z: 13.83, rot: 2, build: hooksBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: hooks: " + e.message); }
    try {
      defProp('notice', { label: 'notice board', cat: 'wall', wall: true, x: -17.5, z: 8.59, rot: 0, build: noticeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: notice: " + e.message); }
    try {
      defProp('firstAid', { label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: -25.6, z: 22.9, rot: 3, at: { 0: { x: 6.75, z: 1.6, rot: 3 } }, build: firstAidBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: firstAid: " + e.message); }
    try {
      defProp('extBreak', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: 13.2, rot: 1, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extBreak: " + e.message); }
    try {
      defProp('posterRota', { label: 'rota poster', cat: 'wall', wall: true, x: -19.83, z: 9.2, rot: 1, build: posterBuild('rota', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterRota: " + e.message); }
    try {
      defProp('posterSmoke', { label: 'no-smoking poster', cat: 'wall', wall: true, x: -15.6, z: 11.0, rot: 3, build: posterBuild('nosmoking', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterSmoke: " + e.message); }
    try {
      defProp('lobbySeat', { label: 'bench seat', cat: 'room', x: -17.8, z: 9.1, rot: 2, build: benchSeatBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lobbySeat: " + e.message); }
    try {
      defProp('cot', { label: 'cot', cat: 'room', x: -15.0, z: -13.3, rot: 0, at: { 0: { x: -5.5, z: 4.45, rot: 0 } }, build: cotBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cot: " + e.message); }
    try {
      defProp('vending', { label: 'vending machine', cat: 'room', x: -13.6, z: -11.4, rot: 3, build: vendingBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: vending: " + e.message); }
    try {
      defProp('coffee', { label: 'coffee counter', cat: 'room', x: -19.5, z: -12.2, rot: 1, build: coffeeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: coffee: " + e.message); }
    try {
      defProp('fridge', { label: 'fridge', cat: 'room', x: -19.5, z: -13.5, rot: 1, build: fridgeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: fridge: " + e.message); }
    try {
      defProp('cooler', { label: 'water cooler', cat: 'room', x: -19.6, z: -10.7, rot: 1, build: coolerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cooler: " + e.message); }
    try {
      defProp('table', { label: 'table', cat: 'room', x: -16.6, z: -11.6, rot: 0, build: tableBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: table: " + e.message); }
    try {
      defProp('chair1', { label: 'chair', cat: 'room', x: -17.35, z: -11.6, rot: 1, build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chair1: " + e.message); }
    try {
      defProp('chair2', { label: 'chair', cat: 'room', x: -15.85, z: -11.6, rot: 3, build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chair2: " + e.message); }
    try {
      defProp('chair3', { label: 'chair', cat: 'room', x: -16.6, z: -12.35, rot: 0, build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chair3: " + e.message); }
    try {
      defProp('calendar', { label: 'calendar', cat: 'wall', wall: true, x: -17.6, z: -13.83, rot: 0, build: calendarBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: calendar: " + e.message); }
    try {
      defProp('clockBreak', { label: 'wall clock', cat: 'wall', wall: true, x: -18.4, z: -13.83, rot: 0, build: clockBuild(0.28) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: clockBreak: " + e.message); }
    try {
      defProp('posterHands', { label: 'wash-hands poster', cat: 'wall', wall: true, x: -16.5, z: -13.83, rot: 0, build: posterBuild('hands', 0.5, 0.75) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterHands: " + e.message); }
    try {
      defProp('plantBreak', { label: 'potted plant', cat: 'room', x: -13.5, z: -13.5, rot: 0, build: plantBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: plantBreak: " + e.message); }
    try {
      defProp('desk', { label: 'office desk', cat: 'room', x: 17.5, z: 12.4, rot: 0, build: deskBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: desk: " + e.message); }
    try {
      defProp('officeChair', { label: 'office chair', cat: 'room', x: 17.5, z: 11.6, rot: 0, build: officeChairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: officeChair: " + e.message); }
    try {
      defProp('cabinets', { label: 'filing cabinets', cat: 'room', x: 19.3, z: 13.5, rot: 2, build: cabinetsBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cabinets: " + e.message); }
    try {
      defProp('plant', { label: 'potted plant', cat: 'room', x: 13.2, z: 13.4, rot: 0, build: plantBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: plant: " + e.message); }
    try {
      defProp('coatStand', { label: 'coat stand', cat: 'room', x: 13.0, z: 9.0, rot: 0, build: coatStandBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: coatStand: " + e.message); }
    try {
      defProp('kpi', { label: 'whiteboard', cat: 'wall', wall: true, x: 19.83, z: 11.5, rot: 3, build: kpiBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: kpi: " + e.message); }
    try {
      defProp('certificate', { label: 'certificate', cat: 'wall', wall: true, x: 19.83, z: 13.3, rot: 3, build: certificateBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: certificate: " + e.message); }
    try {
      defProp('posterSafety', { label: 'safety poster', cat: 'wall', wall: true, x: 16.5, z: 13.83, rot: 2, build: posterBuild('safety', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterSafety: " + e.message); }
    try {
      defProp('bench', { label: 'packing bench', cat: 'hall', x: 16.6, z: 5.2, rot: 0, at: { 0: { x: 4.6, z: 2.6, rot: 0 }, 1: { x: 16.6, z: -2.2, rot: 0 } }, build: benchBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: bench: " + e.message); }
    try {
      defProp('flask', { label: 'coffee flask', cat: 'hall', abs: true, keep: true, lvl: 4, x: 5.3, z: 2.55, rot: 0, at: { 0: { x: 5.3, z: 2.55, rot: 0 } }, build: flaskBuild, when: function () { return BOOT_STAGE === 0; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: flask: " + e.message); }
    try {
      defProp('binDamaged', { label: 'damaged-goods bin', cat: 'hall', x: 13.3, z: 2.4, rot: 0, at: { 0: { x: 6.3, z: 4.3, rot: 0 } }, build: binBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: binDamaged: " + e.message); }
    try {
      defProp('broom', { label: 'broom', cat: 'hall', x: 13.0, z: 3.0, rot: 0, build: broomBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: broom: " + e.message); }
    try {
      defProp('wetFloor', { label: 'wet-floor sign', cat: 'hall', x: 13.4, z: 7.6, rot: 1, build: wetFloorBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: wetFloor: " + e.message); }
    try {
      defProp('empties', { label: 'stack of empty pallets', cat: 'hall', abs: true, keep: true, x: -12.5, z: -21.0, rot: 0, at: { 0: { x: -0.5, z: 4.3, rot: 0 } }, build: emptiesBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: empties: " + e.message); }
    try {
      defProp('baler', { label: 'baler', cat: 'hall', stage: 1, x: -7.5, z: -13.2, rot: 0, build: balerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: baler: " + e.message); }
    try {
      defProp('wrapper', { label: 'stretch wrapper', cat: 'hall', abs: true, stage: 1, x: 14, z: -22.3, rot: 0, at: { 1: { x: 9.5, z: -12.3, rot: 0 } }, build: wrapperBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: wrapper: " + e.message); }
    try {
      defProp('hose', { label: 'hose reel', cat: 'wall', wall: true, abs: true, x: -10.5, z: -23.83, rot: 0, build: hoseBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: hose: " + e.message); }
    try {
      defProp('extNW', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: -11.2, rot: 1, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extNW: " + e.message); }
    try {
      defProp('extNE', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 35.83, z: -16.4, rot: 3, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extNE: " + e.message); }
    try {
      defProp('extBench', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 29.83, z: 16.5, rot: 3, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extBench: " + e.message); }
    try {
      defProp('clockHall', { label: 'hall clock', cat: 'wall', wall: true, abs: true, x: 12, z: -23.7, rot: 0, at: { 0: { x: 6.75, z: -3.4, rot: 3 } }, build: function (c) { var f = clockBuild(0.5); f(c); c.group.children[c.group.children.length - 1].position.y = BOOT_STAGE === 0 ? 3.4 : 5.8 - 2.7 + 2.7; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: clockHall: " + e.message); }
    try {
      defProp('posterLift', { label: 'lifting poster', cat: 'wall', wall: true, abs: true, x: -29.83, z: 2, rot: 1, build: posterBuild('lifting', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterLift: " + e.message); }
    try {
      defProp('posterFork', { label: 'forklift poster', cat: 'wall', wall: true, x: 2.2, z: 13.83, rot: 2, build: posterBuild('forklift', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterFork: " + e.message); }
    try {
      defProp('posterStack', { label: 'pallet-rules poster', cat: 'wall', wall: true, x: -6, z: 13.83, rot: 2, build: posterBuild('stacking', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterStack: " + e.message); }
    try {
      defProp('posterOffice', { label: 'safety poster', cat: 'wall', wall: true, x: 12.42, z: 11.5, rot: 3, build: posterBuild('safety', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterOffice: " + e.message); }
    try {
      defProp('posterExit', { label: 'fire-exit poster', cat: 'wall', wall: true, x: 15.2, z: -13.83, rot: 0, build: posterBuild('exit', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterExit: " + e.message); }
    try {
      defProp('shelter', { label: 'smoking shelter', cat: 'yard', yard: true, stage: 1, x: -22.5, z: 19, rot: 0, build: shelterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: shelter: " + e.message); }
    try {
      defProp('dumpster', { label: 'dumpster', cat: 'yard', yard: true, x: 24, z: 18, rot: 0, at: { 0: { x: 9.6, z: 6.4, rot: 0 } }, build: dumpsterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dumpster: " + e.message); }
    try {
      defProp('flag', { label: 'flag pole', cat: 'yard', yard: true, stage: 1, x: 10, z: 19, rot: 0, build: flagBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: flag: " + e.message); }
    try {
      defProp('parkingSign', { label: 'parking sign', cat: 'yard', yard: true, stage: 2, x: -2, z: 18.5, rot: 0, build: parkingSignBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: parkingSign: " + e.message); }
    try {
      defProp('xChair', { extra: true, lvl: UNLOCK.build, label: 'chair', ico: '🪑', cat: 'room', price: 25, desc: 'A canteen chair.', build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xChair: " + e.message); }
    try {
      defProp('xTable', { extra: true, lvl: UNLOCK.build, label: 'table', ico: '🪵', cat: 'room', price: 60, desc: 'A square canteen table.', build: tableBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xTable: " + e.message); }
    try {
      defProp('xLockers', { extra: true, lvl: UNLOCK.build, label: 'lockers', ico: '🗄️', cat: 'room', price: 120, desc: 'Two more lockers.', build: lockerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xLockers: " + e.message); }
    try {
      defProp('xPlant', { extra: true, lvl: UNLOCK.build, label: 'potted plant', ico: '🌿', cat: 'room', price: 40, desc: 'Something green.', build: plantBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPlant: " + e.message); }
    try {
      defProp('xCooler', { extra: true, lvl: UNLOCK.build, label: 'water cooler', ico: '🥤', cat: 'room', price: 90, desc: 'Another cooler.', build: coolerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCooler: " + e.message); }
    try {
      defProp('xCot', { extra: true, lvl: UNLOCK.build, label: 'cot', ico: '🛏️', cat: 'room', price: 150, desc: 'A second place to sleep.', build: cotBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCot: " + e.message); }
    try {
      defProp('xOfficeChair', { extra: true, lvl: UNLOCK.build, label: 'office chair', ico: '💺', cat: 'room', price: 80, desc: 'Swivels.', build: officeChairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xOfficeChair: " + e.message); }
    try {
      defProp('xCabinets', { extra: true, lvl: UNLOCK.build, label: 'filing cabinets', ico: '🗂️', cat: 'room', price: 110, desc: 'Paperwork storage.', build: cabinetsBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCabinets: " + e.message); }
    try {
      defProp('xBin', { extra: true, lvl: UNLOCK.build, label: 'wheelie bin', ico: '🗑️', cat: 'hall', price: 20, desc: 'Takes damaged boxes too.', build: binBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBin: " + e.message); }
    try {
      defProp('xWetFloor', { extra: true, lvl: UNLOCK.build, label: 'wet-floor sign', ico: '⚠️', cat: 'hall', price: 10, desc: 'For appearances.', build: wetFloorBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xWetFloor: " + e.message); }
    try {
      defProp('xEmpties', { extra: true, lvl: UNLOCK.build, label: 'stack of empty pallets', ico: '🪵', cat: 'hall', price: 0, desc: 'Dressing.', build: emptiesBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xEmpties: " + e.message); }
    try {
      defProp('xBollard', { extra: true, lvl: UNLOCK.build, label: 'bollard', ico: '🟡', cat: 'hall', price: 30, desc: 'Guards a corner.', build: bollardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBollard: " + e.message); }
    try {
      defProp('xExt', { extra: true, lvl: UNLOCK.build, label: 'fire extinguisher', ico: '🧯', cat: 'wall', wall: true, price: 60, desc: 'On the wall.', build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xExt: " + e.message); }
    try {
      defProp('xClock', { extra: true, lvl: UNLOCK.build, label: 'wall clock', ico: '🕒', cat: 'wall', wall: true, price: 25, desc: 'Keeps game time.', build: clockBuild(0.32) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xClock: " + e.message); }
    try {
      defProp('xNotice', { extra: true, lvl: UNLOCK.build, label: 'notice board', ico: '📌', cat: 'wall', wall: true, price: 30, desc: 'Cork and pins.', build: noticeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xNotice: " + e.message); }
    try {
      POSTER_KINDS.forEach(function (k) { defProp('xPoster_' + k, { extra: true, lvl: UNLOCK.build, label: k + ' poster', ico: '🖼️', cat: 'wall', wall: true, price: 15, desc: 'Framed.', build: posterBuild(k, 0.6, 0.9) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPoster_: " + e.message); }
    try {
      defProp('xFirstAid', { extra: true, lvl: UNLOCK.build, label: 'first-aid box', ico: '🩹', cat: 'wall', wall: true, price: 35, desc: 'The inspector likes one.', build: firstAidBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xFirstAid: " + e.message); }
    try {
      defProp('xTree', { extra: true, label: 'tree', ico: '🌳', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 80, desc: 'For the yard.', build: treeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xTree: " + e.message); }
    try {
      defProp('xBenchSeat', { extra: true, label: 'bench seat', ico: '🪑', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 70, desc: 'Slatted.', build: benchSeatBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBenchSeat: " + e.message); }
    try {
      defProp('xYardBollard', { extra: true, label: 'bollard', ico: '🟡', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 30, desc: 'Yellow steel.', build: bollardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xYardBollard: " + e.message); }
    try {
      defProp('xShelter', { extra: true, label: 'smoking shelter', ico: '🚬', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 400, desc: 'Roof and a bench.', build: shelterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xShelter: " + e.message); }
    try {
      defProp('xDumpster', { extra: true, label: 'dumpster', ico: '♻️', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 150, desc: 'Cardboard only.', build: dumpsterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xDumpster: " + e.message); }
    try {
      Object.keys(BELT_PIECES).forEach(function (k) { var bp = BELT_PIECES[k]; defProp('x' + k.charAt(0).toUpperCase() + k.slice(1), { extra: true, label: bp.label, ico: bp.ico, cat: 'belt', lvl: /^beltS|^beltC/.test(k) ? UNLOCK.beltsA : UNLOCK.beltsB, price: bp.price, desc: bp.desc, beltPath: bp.path, build: beltPieceBuild(k) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: x: " + e.message); }
    try {
      defProp('packline', { label: 'pack line', cat: 'hall', abs: true, stage: 1, x: 26.6, z: 7.2, rot: 0, at: { 1: { x: 16.6, z: -0.2, rot: 0 } }, build: packLineBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: packline: " + e.message); }
    try {
      defProp('moulder', { stage: 2, label: 'moulding line', cat: 'factory', abs: true, x: -4, z: -37, rot: 0, build: moulderBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: moulder: " + e.message); }
    try {
      defProp('beltMain', { stage: 2, label: 'main belt', cat: 'factory', abs: true, x: -4, z: -32.5, rot: 0, build: beltMainBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: beltMain: " + e.message); }
    try {
      defProp('palletiser', { stage: 2, label: 'palletiser', cat: 'hall', abs: true, x: -4, z: -20.6, rot: 0, build: palletiserBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: palletiser: " + e.message); }
    try {
      defProp('hopper', { stage: 2, label: 'raw hopper', cat: 'factory', abs: true, x: -9.5, z: -37, rot: 0, build: hopperBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: hopper: " + e.message); }
    try {
      defProp('dockLoader2', { label: 'dock loader OUT 2', cat: 'hall', abs: true, stage: 1, x: 28.6, z: -5.9, rot: 0, at: { 1: { x: 18.6, z: -7.9, rot: 0 } }, build: dockLoaderBuild, when: function () { return !!S.up.shipbelt || !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dockLoader2: " + e.message); }
    try {
      defProp('dockLoader1', { label: 'dock loader OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, stage: 3, x: 34.6, z: -13.9, rot: 0, build: dockLoaderBuildFor('dockLoader1', 'OUT 1', false), when: function () { return !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dockLoader1: " + e.message); }
    try {
      defProp('dockLoader3', { label: 'dock loader OUT 3', cat: 'hall', abs: true, keep: true, fixed: true, stage: 3, x: 34.6, z: -21.4, rot: 0, build: dockLoaderBuildFor('dockLoader3', 'OUT 3', false), when: function () { return !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dockLoader3: " + e.message); }
    try {
      defProp('agvDock', { label: 'AGV dock', cat: 'hall', abs: true, stage: 2, x: -26.5, z: -5.5, rot: 0, build: agvDockBuild, when: function () { return !!S.up.agv; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: agvDock: " + e.message); }
    try {
      for (var gr2 = 0; gr2 < RACK.rows.length; gr2++) (function (r) { defProp('gantry' + r, { label: 'gantry picker ' + 'ABCDE'[r], cat: 'hall', abs: true, stage: 2, x: -24, z: RACK.rows[r], rot: 0, build: gantryBuild(r), when: function () { return !!S.up.gantry && r < S.up.rows; } }); })(gr2);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: gantry: " + e.message); }
    try {
      defProp('silo', { stage: 2, label: 'silo', cat: 'yard', yard: true, abs: true, x: -17.5, z: -34, rot: 0, build: siloBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: silo: " + e.message); }
    try {
      defProp('extWing', { stage: 2, label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 9.83, z: -30, rot: 3, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extWing: " + e.message); }
    try {
      defProp('qcBench', { stage: 2, label: 'quality bench', cat: 'factory', abs: true, x: 6.5, z: -29, rot: 2, build: qcBenchBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: qcBench: " + e.message); }
    try {
      defProp('workbench', { stage: 2, label: 'maintenance bench', cat: 'factory', abs: true, x: -12.8, z: -27.5, rot: 1, build: workbenchBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: workbench: " + e.message); }
    try {
      defProp('toolCab', { stage: 2, label: 'tool cabinet', cat: 'factory', abs: true, x: -13.2, z: -25.4, rot: 1, build: toolCabBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: toolCab: " + e.message); }
    try {
      defProp('mouldRack', { stage: 2, label: 'mould store', cat: 'factory', abs: true, x: 2.5, z: -43.2, rot: 0, build: mouldRackBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: mouldRack: " + e.message); }
    try {
      defProp('partsShelf', { stage: 2, label: 'spares shelf', cat: 'factory', abs: true, x: -1.0, z: -43.3, rot: 0, build: partsShelfBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: partsShelf: " + e.message); }
    try {
      defProp('chiller', { stage: 2, label: 'chiller', cat: 'factory', abs: true, x: -11.5, z: -42.5, rot: 0, build: chillerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chiller: " + e.message); }
    try {
      defProp('dryer', { stage: 2, label: 'granulate dryer', cat: 'factory', abs: true, x: -6.0, z: -42.8, rot: 0, build: dryerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dryer: " + e.message); }
    try {
      defProp('switchboard', { stage: 2, label: 'switchboard', cat: 'wall', wall: true, abs: true, x: 9.8, z: -41, rot: 3, build: switchboardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: switchboard: " + e.message); }
    try {
      defProp('shiftBoard', { stage: 2, label: 'shift board', cat: 'wall', wall: true, abs: true, x: 9.83, z: -33, rot: 3, build: shiftBoardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: shiftBoard: " + e.message); }
    try {
      defProp('clockWing', { stage: 2, label: 'wing clock', cat: 'wall', wall: true, abs: true, x: 9.83, z: -27, rot: 3, build: function (c) { var f = clockBuild(0.4); f(c); c.group.children[c.group.children.length - 1].position.y = 3.6; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: clockWing: " + e.message); }
    try {
      defProp('firstAidWing', { stage: 2, label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: 9.83, z: -25.5, rot: 3, build: firstAidBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: firstAidWing: " + e.message); }
    try {
      defProp('signStaff', { label: 'sign: STAFF', cat: 'wall', wall: true, abs: true, stage: 1, x: -30.17, z: 22, rot: 3, build: wallSignBuild(['STAFF'], 1.2, 0.4, 3.75, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signStaff: " + e.message); }
    try {
      defProp('signFront', { label: 'sign: DEPOT CO. (front)', cat: 'wall', wall: true, abs: true, stage: 1, x: 0, z: 24.17, rot: 0, build: function (c) { c.sign(['DEPOT CO.'], 12, 2.6, 0, 5, 0.01, 0, { w: 1024, h: 224, bg: '#1b232c', fg: '#f5b53d', border: '#f5b53d' }); c.sign(['3PL · STORAGE · FULFILMENT'], 10, 0.8, 0, 3.2, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' }); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signFront: " + e.message); }
    try {
      defProp('signOffice', { label: 'sign: OFFICE', cat: 'wall', wall: true, abs: true, stage: 1, x: 22.41, z: 19.95, rot: 3, build: wallSignBuild(['OFFICE'], 1.4, 0.45, 2.6, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signOffice: " + e.message); }
    try {
      defProp('signLobby', { label: 'sign: LOBBY', cat: 'wall', wall: true, abs: true, stage: 1, x: -25.41, z: 19.95, rot: 1, build: wallSignBuild(['LOBBY'], 1.2, 0.45, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signLobby: " + e.message); }
    try {
      defProp('signBreak', { label: 'sign: BREAK ROOM', cat: 'wall', wall: true, abs: true, stage: 1, x: -22.91, z: -22.45, rot: 1, build: wallSignBuild(['BREAK ROOM'], 1.6, 0.45, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signBreak: " + e.message); }
    try {
      defProp('exitNorth', { keep: true, stage: 1, label: 'exit sign (fire exit)', cat: 'wall', wall: true, abs: true, x: 23.5, z: -23.8, rot: 0, build: exitSignBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: exitNorth: " + e.message); }
    try {
      defProp('exitStaff', { label: 'exit sign (staff door)', cat: 'wall', wall: true, abs: true, stage: 1, x: -29.8, z: 22, rot: 1, build: exitSignBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: exitStaff: " + e.message); }
    try {
      defProp('signPacking', { label: 'sign: PACKING', cat: 'wall', wall: true, abs: true, stage: 1, x: 29.83, z: 5.2, rot: 3, at: { 1: { x: 19.83, z: -2.2, rot: 3 } }, build: wallSignBuild(['PACKING'], 1.8, 0.5, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signPacking: " + e.message); }
    try {
      defProp('signProduction', { stage: 2, label: 'sign: PRODUCTION', cat: 'wall', wall: true, abs: true, x: 5.8, z: -23.83, rot: 0, build: wallSignBuild(['PRODUCTION'], 2.6, 0.6, 4.9, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signProduction: " + e.message); }
    try {
      defProp('signWarehouse', { stage: 2, label: 'sign: WAREHOUSE', cat: 'wall', wall: true, abs: true, x: 5.8, z: -24.17, rot: 2, build: wallSignBuild(['WAREHOUSE'], 2.6, 0.6, 4.9, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signWarehouse: " + e.message); }
    try {
      defProp('signPpe', { stage: 2, label: 'sign: PPE', cat: 'wall', wall: true, abs: true, x: 2.5, z: -23.83, rot: 0, build: wallSignBuild(['PPE BEYOND THIS POINT', 'ear defenders · safety boots · hi-vis'], 1.2, 0.5, 2.3, { w: 512, h: 200, bg: '#1f4e8c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signPpe: " + e.message); }
    try {
      defProp('paintReceiving', { label: 'floor paint: RECEIVING', cat: 'hall', abs: true, keep: true, stage: 1, x: SPOT.stageIn.x, z: SPOT.stageIn.z + 2.2, rot: 0, build: floorSignBuild(['RECEIVING'], 2.6, 0.9, { w: 512, h: 128, bg: '#2a2f36', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintReceiving: " + e.message); }
    try {
      defProp('paintShipping', { label: 'floor paint: SHIPPING', cat: 'hall', abs: true, keep: true, stage: 1, x: SPOT.stageOut.x - 2.3, z: SPOT.stageOut.z, rot: 1, build: floorSignBuild(['SHIPPING'], 2.6, 0.9, { w: 512, h: 128, bg: '#2a2f36', fg: '#5fd38d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintShipping: " + e.message); }
    try {
      defProp('paintFinished', { stage: 2, label: 'floor paint: FINISHED GOODS', cat: 'hall', abs: true, x: -1.0, z: -16.3, rot: 0, build: floorSignBuild(['FINISHED GOODS'], 1.8, 0.3, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintFinished: " + e.message); }
    try {
      defProp('paintRaw', { stage: 2, label: 'floor paint: RAW GRANULATE', cat: 'factory', abs: true, x: -9.5, z: -31.6, rot: 0, build: floorSignBuild(['RAW GRANULATE'], 1.6, 0.3, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintRaw: " + e.message); }
    try {
      defProp('xWallSign', { extra: true, lvl: UNLOCK.build, label: 'wall sign (DEPOT CO.)', ico: '🪧', cat: 'wall', wall: true, price: 30, desc: 'A spare sign for any wall.', build: wallSignBuild(['DEPOT CO.'], 1.2, 0.4, 2.4, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xWallSign: " + e.message); }
    try {
      defProp('xFloorArrow', { extra: true, lvl: UNLOCK.build, label: 'floor arrow', ico: '➡️', cat: 'hall', price: 10, desc: 'Points the way.', build: floorSignBuild(['➜'], 1.2, 0.6, { w: 256, h: 128, bg: 'rgba(0,0,0,0)', fg: '#f5b53d', size: 110 }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xFloorArrow: " + e.message); }
    try {
      defProp('posterWing', { stage: 2, label: 'safety poster', cat: 'wall', wall: true, abs: true, x: 9.83, z: -36, rot: 3, build: posterBuild('safety', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterWing: " + e.message); }
    try {
      for (var hid in HALLS) (function (id) {
          var H = HALLS[id];
          defProp(id, { label: H.name, cat: 'hall', abs: true, keep: true, fixed: true, stage: id === 'hall4' ? 5 : 4, x: 0, z: 0, rot: 0, build: hallBuild(id), when: function () { return hallOwned(id); } });
          defProp('shut' + id, { label: H.name + ' shutter', cat: 'hall', abs: true, keep: true, fixed: true, stage: id === 'hall4' ? 2 : 3, x: 0, z: 0, rot: 0, build: shutterBuild(id) });   // a shutter where the doorway is cut: the wing's north wall from the hall stage, the main hall's from the big hall
          H.rows.forEach(function (r, k) { defProp('rack' + r, { label: H.name + ' rack row ' + 'HIJKLM'[r - 20], cat: 'hall', abs: true, keep: true, fixed: true, stage: id === 'hall4' ? 5 : 4, x: H.rowX0 - RACK.x0, y: 0, z: H.rowZ[k], rot: 0, build: rackBuild(r), when: function () { return hallOwned(id); } }); });
        })(hid);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: shut,rack: " + e.message); }
    try {
      for (var hfid in HALLS) (function (id) {
          var H = HALLS[id], when = function () { return hallOwned(id); }, cx = (H.x0 + H.x1) / 2, D = H.door, hs = id === 'hall4' ? 5 : 4;
          defProp('ext' + id, { label: H.name + ' extinguisher', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: H.x1 - 2.5, z: H.z0 + 0.17, rot: 0, build: extinguisherBuild, when: when });
          defProp('posterExit' + id, { label: H.name + ' fire-exit poster', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: D.x0 - 1.6, z: D.z - 0.17, rot: 2, build: posterBuild('exit', 0.6, 0.9), when: when });
          defProp('posterSmoke' + id, { label: H.name + ' no-smoking poster', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: H.x0 + 2.5, z: H.z0 + 0.17, rot: 0, build: posterBuild('nosmoking', 0.6, 0.8), when: when });
          defProp('firstAid' + id, { label: H.name + ' first-aid box', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: H.x0 + 4.0, z: H.z0 + 0.17, rot: 0, build: firstAidBuild, when: when });   // the lobby and the wing have one; the halls did not
          defProp('clock' + id, { label: H.name + ' clock', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: cx + 3.2, z: H.z0 + 0.3, rot: 0, build: function (c) { var f = clockBuild(0.4); f(c); }, when: when });
          if (H.rows.length) defProp('aisle' + id, { label: H.name + ' aisle sign', cat: 'hall', abs: true, keep: true, fixed: true, stage: hs, x: cx, z: (H.rowZ[0] + H.rowZ[1]) / 2, rot: 0, build: aisleSignBuild(H.name.toUpperCase() + ' · ' + 'HIJKLM'[H.rows[0] - 20] + ' / ' + 'HIJKLM'[H.rows[1] - 20]), when: when });
        })(hfid);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: ext,posterExit,posterSmoke,firstAid,clock,aisle: " + e.message); }
    try {
      defProp('tv', { label: 'TV', cat: 'wall', wall: true, abs: true, keep: true, x: -31.0, z: -23.83, rot: 0, build: tvBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: tv: " + e.message); }
    try {
      defProp('dartboard', { label: 'dartboard', cat: 'wall', wall: true, abs: true, keep: true, x: -30.6, z: -20.19, rot: 2, build: dartboardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dartboard: " + e.message); }
    try {
      defProp('microwave', { label: 'microwave', cat: 'room', abs: true, keep: true, x: -35.5, z: -22.5, y: 0.95, rot: 1, build: microwaveBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: microwave: " + e.message); }
    try {
      defProp('fanStand', { label: 'standing fan', cat: 'room', abs: true, keep: true, x: 29.8, z: 20.8, rot: 1, build: fanStandBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: fanStand: " + e.message); }
    try {
      defProp('rugLobby', { label: 'rug', cat: 'room', abs: true, keep: true, x: -33.6, z: 21.6, rot: 0, build: rugBuild(2.0, 2.4, '#6b3f3a', '#d9a12c') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: rugLobby: " + e.message); }
    try {
      defProp('rugOffice', { label: 'rug', cat: 'room', abs: true, keep: true, x: 32.2, z: 21.0, rot: 0, build: rugBuild(2.8, 2.2, '#2f4a5f', '#c9d3dc') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: rugOffice: " + e.message); }
    try {
      defProp('bookshelf', { label: 'bookshelf', cat: 'room', abs: true, keep: true, x: 31.2, z: 23.55, rot: 0, build: bookshelfBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: bookshelf: " + e.message); }
    try {
      defProp('printer', { label: 'printer', cat: 'room', abs: true, keep: true, x: 30.0, z: 22.6, rot: 2, build: printerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: printer: " + e.message); }
    try {
      defProp('pictureOffice', { label: 'picture', cat: 'wall', wall: true, abs: true, keep: true, x: 29.6, z: 23.83, rot: 2, build: pictureBuild('depot') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: pictureOffice: " + e.message); }
    try {
      defProp('pictureLobby', { label: 'picture', cat: 'wall', wall: true, abs: true, keep: true, x: -35.0, z: 18.67, rot: 0, build: pictureBuild('mountains') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: pictureLobby: " + e.message); }
    try {
      defProp('xSofa', { extra: true, lvl: UNLOCK.seating, label: 'sofa', ico: '🛋️', cat: 'room', price: 220, desc: 'Two seats and a cushion. Comfort +2.', build: seatBuild(1.7, FABRIC) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xSofa: " + e.message); }
    try {
      defProp('xArmchair', { extra: true, lvl: UNLOCK.seating, label: 'armchair', ico: '🪑', cat: 'room', price: 140, desc: 'One seat, deep. Comfort +1.', build: seatBuild(0.95, FABRIC2) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xArmchair: " + e.message); }
    try {
      defProp('xPaddedChair', { extra: true, lvl: UNLOCK.seating, label: 'padded chair', ico: '🪑', cat: 'room', price: 45, desc: 'The canteen chair with a cushion. Comfort +0.5.', build: paddedChairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPaddedChair: " + e.message); }
    try {
      defProp('xRoundTable', { extra: true, lvl: UNLOCK.seating, label: 'round table', ico: '🪵', cat: 'room', price: 90, desc: 'Seats six. Comfort +1.', build: roundTableBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xRoundTable: " + e.message); }
    try {
      defProp('xTv', { extra: true, lvl: UNLOCK.decor, label: 'TV', ico: '📺', cat: 'wall', wall: true, price: 300, desc: 'Depot news on a wall of your choosing. Comfort +1.', build: tvBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xTv: " + e.message); }
    try {
      defProp('xDartboard', { extra: true, lvl: UNLOCK.decor, label: 'dartboard', ico: '🎯', cat: 'wall', wall: true, price: 35, desc: 'Comfort +1.', build: dartboardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xDartboard: " + e.message); }
    try {
      defProp('xMicrowave', { extra: true, lvl: UNLOCK.decor, label: 'microwave', ico: '🍱', cat: 'room', price: 110, desc: 'Sits on anything flat. Comfort +1.', build: microwaveBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xMicrowave: " + e.message); }
    try {
      defProp('xFan', { extra: true, lvl: UNLOCK.decor, label: 'standing fan', ico: '🌀', cat: 'room', price: 60, desc: 'Turns while the power is on. Comfort +1.', build: fanStandBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xFan: " + e.message); }
    try {
      defProp('xRug', { extra: true, lvl: UNLOCK.decor, label: 'rug', ico: '🟫', cat: 'room', price: 70, desc: 'Two by two and a half. Comfort +0.5.', build: rugBuild(2.0, 2.5, '#5f3f2f', '#d9a12c') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xRug: " + e.message); }
    try {
      defProp('xBookshelf', { extra: true, lvl: UNLOCK.decor, label: 'bookshelf', ico: '📚', cat: 'room', price: 130, desc: 'Oak, four shelves. Comfort +0.5.', build: bookshelfBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBookshelf: " + e.message); }
    try {
      defProp('xPrinter', { extra: true, lvl: UNLOCK.decor, label: 'printer', ico: '🖨️', cat: 'room', price: 160, desc: 'Prints the day report. Comfort +0.', build: printerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPrinter: " + e.message); }
    try {
      defProp('xPicture', { extra: true, lvl: UNLOCK.decor, label: 'picture', ico: '🖼️', cat: 'wall', wall: true, price: 50, desc: 'One of three. Comfort +0.5.', build: function (c, P, inst) { pictureBuild(['depot', 'mountains', 'ship'][Math.floor(propSeed(inst ? inst.id : 'pic', 1) * 3)])(c); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPicture: " + e.message); }
    try {
      defProp('returnsDesk', { label: 'returns desk', cat: 'hall', abs: true, keep: true, stage: 1, lvl: UNLOCK.returns, x: 29.4, z: 10.4, rot: 3, at: { 1: { x: 13.8, z: -5.2, rot: 0 } }, build: returnsDeskBuildFor(0, 'RETURNS'), when: function () { return !returnsHall(); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: returnsDesk: " + e.message); }
    try {
      defProp('lift', { stage: 3, label: 'goods lift', cat: 'hall', abs: true, keep: true, fixed: true, x: UPPER.lift.x, z: UPPER.lift.z, rot: 0, build: liftBuild, when: upperOwned })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lift: " + e.message); }
    try {
      defProp('bay1', { label: 'shipping bay OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, stage: 3, x: BAY.x0, z: BAY.at.dockLoader1.z0, rot: 0, build: bayBuild('dockLoader1'), when: function () { return !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: bay1: " + e.message); }
    try {
      defProp('retIntake', { label: 'returns intake', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.intake.x, z: RET.intake.z, rot: 0, when: retWhen, stage: 4, build: function (c, P, inst) {
          var FR = MAT.steelDark, TOP = std({ color: 0x8f98a3, roughness: 0.45, metalness: 0.35 });
          c.box(1.6, 0.06, 0.9, TOP, 0, 0.83, 0); [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].forEach(function (o) { c.box(0.05, 0.83, 0.05, FR, o[0], 0.415, o[1]); });
          for (var rx = -0.6; rx <= 0.6; rx += 0.15) { var rl = c.cyl(0.035, 0.84, MAT.steel, rx, 0.875, 0, 10); rl.rotation.x = Math.PI / 2; }   // rollers across the top
          c.box(1.6, 0.25, 0.04, FR, 0, 0.98, 0.45); c.box(1.6, 0.25, 0.04, FR, 0, 0.98, -0.45); c.box(0.04, 0.25, 0.9, FR, -0.8, 0.98, 0);   // the tray's three sides: the belt feeds the open one
          var post = c.cyl(0.02, 2.2, FR, -0.9, 1.1, -0.5, 8); post.castShadow = false; c.box(0.22, 0.14, 0.1, MAT.black, -0.9, 1.75, -0.44); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), -0.83, 1.8, -0.385);   // the scanner head over the tray
          var scr = touchScreen({ w: 200, h: 80, pw: 0.44, ph: 0.176, x: -0.9, y: 1.45, z: -0.44, ry: 0, parent: c.group, title: 'Returns intake', draw: function (cc, sc) { var D = rdesk(); scBg(cc, sc.w, sc.h, 'rgba(245,181,61,0.2)'); scText(cc, 10, 28, 'INTAKE · ' + D.queue.length + ' / ' + rdeskCap() + ' waiting', '#f5b53d', 14); scText(cc, 10, 54, D.queue.length ? 'E on an inspection desk' : 'the belt brings them in', '#a0acb8', 11); } }); scr.mesh.userData.propId = 'retIntake';
          c.sign(['INTAKE'], 0.7, 0.18, 0, 1.15, 0.47, 0, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' });
          c.solid(-0.85, 0.85, -0.5, 0.5, 0, 1.1); c.hit(1.8, 1.2, 1.1, 0, 0.6, 0, { prompt: function () { return retIntakePrompt(); }, use: function () { retIntakeUse(); } });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retIntake: " + e.message); }
    try {
      RET.desks.forEach(function (d, k) { defProp('retDesk' + k, { label: 'inspection desk ' + (k + 1), cat: 'hall', abs: true, keep: true, fixed: true, x: d.x, z: d.z, rot: 0, when: retWhen, stage: 4, build: returnsDeskBuildFor(k, 'INSPECTION ' + (k + 1)) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retDesk: " + e.message); }
    try {
      defProp('retCage', { label: 'restock cage', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.cage.x, z: RET.cage.z, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var FR = MAT.steelDark, MESH = std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x6a737c }), W = 3.6, Dp = 0.9, H = 2.1;
          [[-W / 2, -Dp / 2], [W / 2, -Dp / 2], [-W / 2, Dp / 2], [W / 2, Dp / 2], [0, -Dp / 2], [0, Dp / 2]].forEach(function (o) { c.box(0.06, H, 0.06, FR, o[0], H / 2, o[1]); });
          [0.1, 0.72, 1.34, 1.96].forEach(function (y) { c.box(W, 0.04, Dp, MAT.steel, 0, y, 0); c.box(W, 0.04, 0.04, FR, 0, y, -Dp / 2); c.box(W, 0.04, 0.04, FR, 0, y, Dp / 2); });
          c.plane(W, H, MESH, 0, H / 2, -Dp / 2 - 0.01, 0, 0); c.plane(Dp, H, MESH, -W / 2 - 0.01, H / 2, 0, 0, Math.PI / 2); c.plane(Dp, H, MESH, W / 2 + 0.01, H / 2, 0, 0, -Math.PI / 2);   // mesh on the back and the ends, the front open
          c.sign(['RESTOCK CAGE', 'good returns go back on the racks'], 2.2, 0.5, 0, H + 0.35, 0.02, 0, { w: 512, h: 128, bg: '#1e7a3a', fg: '#fff' }); c.box(W, 0.05, 0.05, FR, 0, H + 0.6, 0); c.box(0.03, 0.6, 0.03, FR, -1.0, H + 0.3, 0); c.box(0.03, 0.6, 0.03, FR, 1.0, H + 0.3, 0);
          c.plane(W + 0.4, 1.1, std({ color: 0x242c36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.004, Dp / 2 + 0.6, -Math.PI / 2, 0);
          c.solid(-W / 2 - 0.05, W / 2 + 0.05, -Dp / 2 - 0.05, Dp / 2 + 0.05, 0, H);
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retCage: " + e.message); }
    try {
      defProp('retCompactor', { label: 'cardboard compactor', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.compactor.x, z: RET.compactor.z, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var BODY = std({ color: 0x3b7a3e, roughness: 0.55, metalness: 0.45 }), FR = MAT.steelDark;
          c.box(1.8, 1.7, 1.3, BODY, 0, 0.85, 0); c.box(1.9, 0.08, 1.4, FR, 0, 0.04, 0); c.box(1.9, 0.08, 1.4, FR, 0, 1.74, 0);
          c.box(1.2, 0.5, 0.8, FR, 0, 2.03, -0.1); c.cyl(0.14, 0.5, MAT.chrome, 0, 2.53, -0.1, 14); c.cyl(0.1, 0.3, FR, 0, 2.93, -0.1, 12);   // the ram housing and its cylinder
          c.box(1.0, 0.6, 0.06, MAT.black, 0, 1.2, 0.68); c.box(1.1, 0.06, 0.3, MAT.hazard, 0, 0.88, 0.75).rotation.x = 0.35; c.box(0.06, 0.6, 0.08, MAT.hazard, -0.53, 1.2, 0.69); c.box(0.06, 0.6, 0.08, MAT.hazard, 0.53, 1.2, 0.69);   // the mouth with its hazard lip
          c.box(0.3, 0.2, 0.08, FR, 0.7, 1.4, 0.68); c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), 0.64, 1.42, 0.73); c.box(0.06, 0.06, 0.02, MAT.red, 0.76, 1.42, 0.73);   // the start and stop buttons
          c.sign(['SCRAP', 'cardboard only · damaged returns'], 1.4, 0.5, 0, 1.55, 0.68, 0, { w: 448, h: 160, bg: '#c8342a', fg: '#fff' });
          c.plane(1.6, 0.9, MAT.hazard, 0, 0.0065, 1.15, -Math.PI / 2, 0);
          c.solid(-0.95, 0.95, -0.7, 0.7, 0, 2.6); c.hit(2.0, 1.8, 1.6, 0, 0.9, 0.2, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retCompactor: " + e.message); }
    try {
      defProp('consoleRet', { label: 'dock console RETURNS', cat: 'wall', abs: true, keep: true, fixed: true, x: HALL.x - 0.3, z: RET.dockZ + 3.4, rot: 3, when: retWhen, stage: 4, build: consoleBuild(6) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: consoleRet: " + e.message); }
    try {
      defProp('retPaint', { label: 'returns hall floor paint', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var lbl = function (t, x, z, w, col, ry) { var m = c.plane(w, 0.42, new THREE.MeshBasicMaterial({ map: textTex([t], { w: 512, h: 96, bg: '#8b8d8e', fg: col || '#d9a12c' }) }), x, 0.0066, z, -Math.PI / 2, 0); if (ry) m.rotation.z = ry; };
          lbl('RECEIVING', 32.2, -31.2, 2.6); lbl('INSPECTION', 23.4, -36.1, 3.0); lbl('RESTOCK', 30.5, -41.3, 2.2, '#5fd38d'); lbl('SCRAP', 15.5, -41.1, 1.8, '#ff6b5e');
          var D = HALLS.hall2.door, dcx = (D.x0 + D.x1) / 2; for (var z = -27.8; z > -31.2; z -= 0.7) c.plane(1.2, 0.35, MAT.whiteLine, dcx, 0.0065, z, -Math.PI / 2, 0);   // the zebra from the doorway walkway up into the hall
          c.plane(0.1, 3.4, MAT.yellowLine, 17.2, 0.006, -37.6, -Math.PI / 2, 0); c.plane(0.1, 3.4, MAT.yellowLine, 29.6, 0.006, -37.6, -Math.PI / 2, 0); c.plane(12.5, 0.1, MAT.yellowLine, 23.4, 0.006, -35.9, -Math.PI / 2, 0); c.plane(12.5, 0.1, MAT.yellowLine, 23.4, 0.006, -39.3, -Math.PI / 2, 0);   // the inspection row's box: from the belt's side to behind the desks
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retPaint: " + e.message); }
    try {
      defProp('retSign', { label: 'returns hall sign', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var H = HALLS.hall2;
          c.sign(['RETURNS', 'RECEIVE · INSPECT · RESTOCK · SCRAP'], 5.2, 1.3, (H.x0 + H.x1) / 2 + 4.5, 5.0, H.z0 + 0.19, 0, { w: 768, h: 192, bg: '#1b232c', fg: '#f5b53d', size: 72 });   // on the far wall, east of the hall's own name plate (x 16 to 20) and above the clock
          c.sign(['RETURNS DOCK', 'the belt takes the returns in while the door is up'], 2.6, 0.7, H.x1 - 0.2, 5.4, RET.dockZ, -Math.PI / 2, { w: 640, h: 160, bg: '#1b232c', fg: '#eef1f5' });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retSign: " + e.message); }
    // each definition as a pack prop: placeable in the editor, never sold, its uses saying what it is (the game logic stays behind)
    var SKIP = ["aislehall3","aislehall4","bay2","bay3","car1","car2","car3","clockhall2","clockhall3","clockhall4","console1","console2","consoleIn1","consoleIn2","exthall2","exthall3","exthall4","firstAidhall2","firstAidhall3","firstAidhall4","gantry0","gantry1","gantry2","gantry3","gantry4","gantry5","hall2","hall3","hall4","mezz","pickBelt","pickBelt2","pickMerge","posterExithall2","posterExithall3","posterExithall4","posterSmokehall2","posterSmokehall3","posterSmokehall4","rack1","rack2","rack20","rack21","rack22","rack23","rack24","rack25","rack3","rack4","rack5","retBelt","retDesk1","retDesk2","shipBelt","shut","shuthall2","shuthall3","shuthall4","upperChute","upperFeed","upperPick","xPoster_exit","xPoster_forklift","xPoster_hands","xPoster_lifting","xPoster_nosmoking","xPoster_rota","xPoster_safety","xPoster_stacking"], seenBuild = new Map(), seenId = {};
    P_DEFS.forEach(function (e) {
      var d = e.def; if (!d || typeof d.build !== 'function' || SKIP.indexOf(e.id) >= 0 || seenBuild.has(d.build)) return; seenBuild.set(d.build, 1);
      var base = (/^x[A-Z]/.test(e.id) ? e.id.slice(1) : e.id).replace(/[^A-Za-z0-9]/g, ''), nid = "dc" + base.charAt(0).toUpperCase() + base.slice(1);
      if (seenId[nid] || PROPS[nid]) return; seenId[nid] = 1;
      var label = d.label || base, inert = { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from Depot Co.)', ''); } };
      HOST_DEF(nid, { extra: true, shop: false, label: label, cat: "depot co", ico: d.ico, wall: !!d.wall, noBlob: !!d.noBlob, desc: 'From Depot Co.: ' + label + '.', build: function (c, P, inst) {
        var h0 = c.hit; c.hit = function (w, h, dd, x, y, z) { return h0.call(c, w, h, dd, x, y, z, inert); };
        if (!c.poster) c.poster = function (kind, w, h, x, y, z, ry) { return poster(kind, w, h, x, y, z, ry, c.group); };
        try { d.build(c, P, inst); if (d.after) d.after(c, P, inst); } finally { c.hit = h0; }
      } });
    });
    // the pack's own materials by name, for a prop read back as parts in the Model tab (Co Engine 0.8.0): a getter, so a cache filled later is seen
    CO.packMats = CO.packMats || {}; CO.packMats["depotco"] = function () { return { SKUS: SKUS, SKU: SKU, CLIENTS: CLIENTS, MODES: MODES, MODE_FEE: MODE_FEE, AIR_RATE: AIR_RATE, STAFF_NAMES: STAFF_NAMES, LEVEL_CAP: LEVEL_CAP, XP_TABLE: XP_TABLE, XP_FOR: XP_FOR, XP: XP, LEVEL_BONUS: LEVEL_BONUS, UNLOCK: UNLOCK, STAFF_CAPS: STAFF_CAPS, LADDER_NOTES: LADDER_NOTES, LADDER_TIPS: LADDER_TIPS, DAY_START: DAY_START, DAY_END: DAY_END, TRUCK_IN: TRUCK_IN, ECON: ECON, UPGRADES: UPGRADES, STAFF_ROLES: STAFF_ROLES, STAGES: STAGES, STAGE_LAST: STAGE_LAST, STAGE: STAGE, STAGE_OF: STAGE_OF, VAN: VAN, TRUCK_OUT: TRUCK_OUT, HALL: HALL, RACK: RACK, DOCKS: DOCKS, DOOR_MAP: DOOR_MAP, YARD_Y: YARD_Y, TRAILER: TRAILER, SPOT: SPOT, UNLOCK_WORDS: UNLOCK_WORDS, hallLights: hallLights, yardLights: yardLights, POSTER_KINDS: POSTER_KINDS, CARD: CARD, doors: doors, slotHits: slotHits, bayLabelTex: bayLabelTex, world: world, dress: dress, CHAIR_RED: CHAIR_RED, leafTex: leafTex, leafMat: leafMat, BARK: BARK, LEAF: LEAF, treeN: treeN, WING: WING, MAT_MACH: MAT_MACH, beltTexBase: beltTexBase, SHIP_PATH: SHIP_PATH, dockLoaderBuild: dockLoaderBuild, BELT_PIECES: BELT_PIECES, HALLS: HALLS, HALL_OF_ROW: HALL_OF_ROW, FABRIC: FABRIC, FABRIC2: FABRIC2, OAK: OAK, WALNUT: WALNUT, CREAM: CREAM, DARKGREY: DARKGREY, COMFORT_PROPS: COMFORT_PROPS, COMFORT_TYPES: COMFORT_TYPES, TV_LINES: TV_LINES, yard: yard, BOX: BOX, BOX_GEO: BOX_GEO, PARCEL_GEO: PARCEL_GEO, PALLET_GEO: PALLET_GEO, handBox: handBox, handParcel: handParcel, truckMeshes: truckMeshes, DRIVER_LINES: DRIVER_LINES, boardT: boardT, RETURNS: RETURNS, jackMesh: jackMesh, jackMeshes: jackMeshes, cartMesh: cartMesh, forkM: forkM, driving: driving, forkSpeed: forkSpeed, forkLook: forkLook, jackModel: jackModel, staffMeshes: staffMeshes, VOICE: VOICE, JACK_HOME: JACK_HOME, RAMP_BOTTOM: RAMP_BOTTOM, SHIFT_START: SHIFT_START, STAFF_SHIFTS: STAFF_SHIFTS, TRAIN_PRICE: TRAIN_PRICE, CROSS_PRICE: CROSS_PRICE, RAISE_PRICE: RAISE_PRICE, tclock: tclock, MACH: MACH, BELTS: BELTS, BELT_PLANES: BELT_PLANES, BELT_SPEED: BELT_SPEED, BELT_GAP: BELT_GAP, BELT_Y: BELT_Y, REACH: REACH, SPEED_STEPS: SPEED_STEPS, sinkCache: sinkCache, FACTORY_RATE: FACTORY_RATE, RAW_PER_SACK: RAW_PER_SACK, HOPPER_CAP: HOPPER_CAP, BALE_NEED: BALE_NEED, BALE_PRICE: BALE_PRICE, FILM_ROLL: FILM_ROLL, FILM_PRICE: FILM_PRICE, agvScreen: agvScreen, agvShown: agvShown, GANTRY_SPEED: GANTRY_SPEED, GANTRY_LIFT: GANTRY_LIFT, GANTRY_DROP_X: GANTRY_DROP_X, UPPER: UPPER, liftM: liftM, liftScreen: liftScreen, liftShown: liftShown, SORT: SORT, LOADER_DOORS: LOADER_DOORS, Y: Y, R: R, sortD: sortD, STAGE_CAP: STAGE_CAP, BAY: BAY, STAGE_AT: STAGE_AT, stageT: stageT, RET: RET, TRUCK_RET: TRUCK_RET, RET_PROPS: RET_PROPS, buff: buff, pc: pc, PC_APPS: PC_APPS, APP_LVL: APP_LVL, scanDev: scanDev, SCAN_W: SCAN_W, SCAN_H: SCAN_H, SCAN_RES: SCAN_RES, SCAN_ICONS: SCAN_ICONS, MAP_PAGE: MAP_PAGE, scan: scan, SCAN_PAGES: SCAN_PAGES, SCAN_LVL: SCAN_LVL, INTRO: INTRO, SEASONS: SEASONS, STATIONS: STATIONS, radio: radio, cables: cables, CABLE_REACH: CABLE_REACH, wrapper: wrapper, DAY_KEEP: DAY_KEEP, reportT: reportT, S: S }; };
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) depotcoPack(defProp); else hook('beforeBuild', function () { depotcoPack(defProp); });
  var NT_MATS = {};
  function ntMat(hex, rough) { var k = hex + ':' + (rough || 1); if (!NT_MATS[k]) NT_MATS[k] = std({ color: hex, roughness: rough || 1 }); return NT_MATS[k]; }
  function ntSeed(inst, salt) { var s = salt || 7, id = String(inst && inst.id || 'n'); for (var i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) % 100003; return function () { s = (s * 16807) % 2147483647; return (s % 10000) / 10000; }; }
  function ntUse(c, label, w, h, d) { c.hit(w, h, d, 0, h / 2, 0, { prompt: function () { return label; }, use: function () { toast(label + '.', ''); } }); }
  // a lumpy rock: an icosahedron with its corners pushed in and out, the same every time for the same copy
  function ntRock(c, r, x, y, z, rnd, hex) { var g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, seen = {}; for (var i = 0; i < p.count; i++) { var k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (seen[k] === undefined) seen[k] = 0.8 + rnd() * 0.4; var f = seen[k]; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.75, p.getZ(i) * f); } g.computeVertexNormals(); var m = new THREE.Mesh(g, ntMat(hex || 0x8a8780, 0.95)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; c.add(m); return m; }
  function ntTrunk(c, r, h, hex) { return c.cyl(r, h, ntMat(hex || 0x5b4634), 0, h / 2, 0, 9, r * 1.4); }

  defProp('ntOak', { extra: true, shop: false, label: 'oak tree', cat: 'nature', desc: 'A broad oak, about 8 m.', build: function (c, P, inst) { var rnd = ntSeed(inst, 3); ntTrunk(c, 0.28, 3.6); [[0, 5.2, 0, 2.4], [1.3, 4.6, 0.6, 1.7], [-1.2, 4.8, -0.7, 1.8], [0.4, 6.3, -0.3, 1.6], [-0.6, 4.4, 1.2, 1.5]].forEach(function (b, i) { c.sphere(b[3] * (0.9 + rnd() * 0.2), ntMat([0x3f6f2e, 0x4c7a34, 0x365f28][i % 3]), b[0], b[1], b[2]); }); c.solid(-0.35, 0.35, -0.35, 0.35, 0, 4); ntUse(c, 'An oak', 0.7, 3, 0.7); } });
  defProp('ntPine', { extra: true, shop: false, label: 'pine tree', cat: 'nature', desc: 'A tall pine, about 9 m.', build: function (c) { ntTrunk(c, 0.18, 2.4, 0x4a3a2a); [[2.4, 2.6, 1.9], [4.0, 2.2, 1.6], [5.4, 1.8, 1.3], [6.7, 1.4, 1.0], [7.8, 1.0, 0.7]].forEach(function (b, i) { c.cyl(0.02, b[1] * 1.1, ntMat(i % 2 ? 0x2c5a34 : 0x24502e), 0, b[0], 0, 10, b[2]); }); c.solid(-0.25, 0.25, -0.25, 0.25, 0, 3); ntUse(c, 'A pine', 0.5, 3, 0.5); } });
  defProp('ntBirch', { extra: true, shop: false, label: 'birch tree', cat: 'nature', desc: 'A slim birch with a white trunk.', build: function (c, P, inst) { var rnd = ntSeed(inst, 5); ntTrunk(c, 0.12, 5, 0xe8e4dc); for (var i = 0; i < 6; i++) c.box(0.13, 0.04, 0.02, MAT.black, 0, 0.6 + i * 0.7, 0.12); [[0, 5.6, 0, 1.3], [0.6, 4.9, 0.3, 1.0], [-0.5, 5.1, -0.4, 1.0], [0.2, 6.4, 0.1, 0.9]].forEach(function (b) { c.sphere(b[3] * (0.9 + rnd() * 0.2), ntMat(0x8ab04e), b[0], b[1], b[2]); }); c.solid(-0.18, 0.18, -0.18, 0.18, 0, 4); ntUse(c, 'A birch', 0.4, 3, 0.4); } });
  defProp('ntPalm', { extra: true, shop: false, label: 'palm tree', cat: 'nature', desc: 'A palm with a leaning, ringed trunk and a crown of fronds.', build: function (c) {
    var bark = ntMat(0x8a7254), x = 0, y = 0; for (var i = 0; i < 10; i++) { var seg = c.cyl(0.17 - i * 0.008, 0.62, bark, x, y + 0.31, 0, 10, 0.19 - i * 0.008); seg.rotation.z = -0.04 * i; x += 0.03 * i; y += 0.6; }
    for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, fr = c.box(2.4, 0.04, 0.5, ntMat(k % 2 ? 0x4c8a3a : 0x3f7a30), x + Math.cos(a) * 1.1, y - 0.2, Math.sin(a) * 1.1); fr.rotation.set(0, -a, -0.45, 'YXZ'); }
    c.solid(-0.22, 0.22, -0.22, 0.22, 0, 3); ntUse(c, 'A palm tree', 0.45, 3, 0.45);
  } });
  defProp('ntBush', { extra: true, shop: false, label: 'bush', cat: 'nature', desc: 'A round bush, about 1.2 m.', build: function (c, P, inst) { var rnd = ntSeed(inst, 9); for (var i = 0; i < 5; i++) c.sphere(0.45 + rnd() * 0.2, ntMat([0x3f6f2e, 0x4f7f3a, 0x35602a][i % 3]), (rnd() - 0.5) * 0.8, 0.5 + rnd() * 0.3, (rnd() - 0.5) * 0.8); c.solid(-0.6, 0.6, -0.6, 0.6, 0, 1.1); ntUse(c, 'A bush', 1.2, 1.1, 1.2); } });
  defProp('ntHedge', { extra: true, shop: false, label: 'hedge', cat: 'nature', desc: 'A 3 m clipped hedge, 1.4 m high.', build: function (c) { c.box(3, 1.4, 0.8, std({ map: TEX.grass, color: 0x5f8a44, roughness: 1 }), 0, 0.7, 0); c.solid(-1.5, 1.5, -0.4, 0.4, 0, 1.4); ntUse(c, 'A hedge', 3, 1.4, 0.8); } });
  defProp('ntRock', { extra: true, shop: false, label: 'rock', cat: 'nature', desc: 'A rock about 1 m across.', build: function (c, P, inst) { var rnd = ntSeed(inst, 11); ntRock(c, 0.55, 0, 0.3, 0, rnd); c.solid(-0.5, 0.5, -0.5, 0.5, 0, 0.7); ntUse(c, 'A rock', 1, 0.7, 1); } });
  defProp('ntBoulder', { extra: true, shop: false, label: 'boulder', cat: 'nature', desc: 'A big boulder about 2.5 m across, with a smaller stone beside it.', build: function (c, P, inst) { var rnd = ntSeed(inst, 13); ntRock(c, 1.3, 0, 0.8, 0, rnd, 0x7d7a74); ntRock(c, 0.5, 1.4, 0.25, 0.6, rnd, 0x8f8c86); c.solid(-1.2, 1.2, -1.2, 1.2, 0, 1.8); ntUse(c, 'A boulder', 2.4, 1.8, 2.4); } });
  defProp('ntLog', { extra: true, shop: false, label: 'fallen log', cat: 'nature', desc: 'A fallen log, 3 m long.', build: function (c) { var l = c.cyl(0.3, 3, ntMat(0x5b4634), 0, 0.3, 0, 12); l.rotation.z = Math.PI / 2; [-1, 1].forEach(function (s) { var e = c.cyl(0.27, 0.02, ntMat(0xb08a5a), s * 1.51, 0.3, 0, 12); e.rotation.z = Math.PI / 2; }); c.solid(-1.5, 1.5, -0.3, 0.3, 0, 0.6); ntUse(c, 'A fallen log', 3, 0.6, 0.6); } });
  defProp('ntStump', { extra: true, shop: false, label: 'tree stump', cat: 'nature', desc: 'A sawn tree stump.', build: function (c) { c.cyl(0.4, 0.5, ntMat(0x5b4634), 0, 0.25, 0, 12, 0.5); c.cyl(0.37, 0.02, ntMat(0xc09a68), 0, 0.51, 0, 12); c.solid(-0.4, 0.4, -0.4, 0.4, 0, 0.55); ntUse(c, 'A stump', 0.8, 0.55, 0.8); } });
  defProp('ntFlowers', { extra: true, shop: false, label: 'flower bed', cat: 'nature', desc: 'A flower bed, 2 by 1 m, you can walk through.', build: function (c, P, inst) { var rnd = ntSeed(inst, 17); c.box(2, 0.06, 1, ntMat(0x3a2a1c), 0, 0.03, 0); for (var i = 0; i < 28; i++) { var x = (rnd() - 0.5) * 1.8, z = (rnd() - 0.5) * 0.8, h = 0.2 + rnd() * 0.25; c.box(0.02, h, 0.02, ntMat(0x3f7a30), x, h / 2, z); c.sphere(0.06, ntMat([0xd23c6a, 0xf2c224, 0xe8e0f0, 0x8a4fc8, 0xf07a2a][i % 5], 0.8), x, h, z); } } });
  defProp('ntTallGrass', { extra: true, shop: false, label: 'tall grass', cat: 'nature', desc: 'A clump of tall grass you can walk through.', build: function (c, P, inst) { var rnd = ntSeed(inst, 19), m = std({ color: 0x6f9a4a, roughness: 1, side: THREE.DoubleSide }); for (var i = 0; i < 18; i++) { var b = c.plane(0.12, 0.6 + rnd() * 0.5, m, (rnd() - 0.5) * 1.2, 0.35, (rnd() - 0.5) * 1.2, 0, rnd() * Math.PI); b.rotation.z = (rnd() - 0.5) * 0.4; } } });
  defProp('ntPond', { extra: true, shop: false, label: 'pond', cat: 'nature', desc: 'A round pond, 4 m across, with stones round it.', build: function (c, P, inst) { var rnd = ntSeed(inst, 23); c.cyl(2.0, 0.04, std({ color: 0x3f6f8a, roughness: 0.08, metalness: 0.3 }), 0, 0.02, 0, 32); for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8; ntRock(c, 0.22 + rnd() * 0.1, Math.cos(a) * 2.1, 0.1, Math.sin(a) * 2.1, rnd, 0x8f8c86); } for (var k = 0; k < 3; k++) c.cyl(0.25, 0.02, ntMat(0x4c8a3a), (rnd() - 0.5) * 2, 0.045, (rnd() - 0.5) * 2, 10); c.solid(-2, 2, -2, 2, 0, 0.3); ntUse(c, 'A pond', 4, 0.3, 4); } });
  var RD_W = 7, RD_PAVE = 2, RD_HALF = RD_W / 2;
  var RD_MATS = {};
  function rdMat(hex, rough, metal) { var k = hex + ':' + rough + ':' + metal; if (!RD_MATS[k]) RD_MATS[k] = std({ color: hex, roughness: rough === undefined ? 0.7 : rough, metalness: metal || 0 }); return RD_MATS[k]; }
  function rdTex(name, w, d, per) {
    // a texture cloned per size so a 10 m piece and a 40 m roundabout show the tarmac at the same scale
    var k = name + ':' + Math.round(w * 10) + 'x' + Math.round(d * 10);
    if (!RD_MATS[k]) { var base = TEX[name], t = base ? base.clone() : null; if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, w / per), Math.max(1, d / per)); t.needsUpdate = true; } RD_MATS[k] = std({ map: t, color: name === 'asphalt' ? 0xffffff : 0xd8d6d0, roughness: 0.95 }); }
    return RD_MATS[k];
  }
  var RD_KERB = null;
  function rdKerb() { if (!RD_KERB) RD_KERB = std({ color: 0xb8b6b0, roughness: 0.9, side: THREE.DoubleSide }); return RD_KERB; }
  function rdTar(c, w, d, x, z) { return c.box(w, 0.02, d, rdTex('asphalt', w, d, 8), x || 0, 0.01, z || 0); }
  function rdPave(c, w, d, x, z) { var m = c.box(w, 0.15, d, rdTex('concrete', w, d, 4), x, 0.075, z); c.box(w, 0.16, 0.15, rdMat(0xb8b6b0, 0.9), x, 0.08, z + (z > 0 ? -d / 2 : d / 2) + (z > 0 ? 0.075 : -0.075)); return m; }
  function rdPaveZ(c, w, d, x, z) { c.box(w, 0.15, d, rdTex('concrete', w, d, 4), x, 0.075, z); }
  function rdLine(c, len, w, x, z, ry, mat) { var m = c.box(len, 0.012, w, mat || MAT.whiteLine || MAT.white, x, 0.026, z); if (ry) m.rotation.y = ry; return m; }
  function rdDashes(c, x0, x1, z) { for (var x = x0 + 0.5; x + 2 <= x1 + 0.01; x += 4) rdLine(c, 2, 0.12, x + 1, z, 0); }
  function rdEdges(c, len, x) { [-1, 1].forEach(function (s) { rdLine(c, len, 0.1, x || 0, s * (RD_HALF - 0.25), 0); }); }
  function rdArc(c, r0, r1, a0, a1, mat, y, h, ox) {
    ox = ox || 0;
    // a flat ring sector in the ground plane; angle 0 is +x and angles turn toward -z
    var g = new THREE.RingGeometry(r0, r1, Math.max(8, Math.round((a1 - a0) * r1 * 1.5)), 1, a0, a1 - a0);
    var m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.set(ox, y, 0); m.receiveShadow = true; c.add(m);
    if (h) [r0, r1].forEach(function (r) { if (r <= 0) return; var w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, Math.max(8, Math.round((a1 - a0) * r * 1.5)), 1, true, Math.PI / 2 + a0, a1 - a0), rdKerb()); w.position.set(ox, y - h / 2, 0); c.add(w); });
    return m;
  }
  function rdArcDashes(c, r, a0, a1) { var n = Math.floor((a1 - a0) * r / 4); for (var i = 0; i < n; i++) { var a = a0 + (i + 0.5) * (a1 - a0) / n; rdLine(c, 2, 0.12, Math.cos(a) * r, -Math.sin(a) * r, a + Math.PI / 2); } }
  function rdUse(c, label, w, h, d, x, z) { x = x || 0; z = z || 0; c.solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0, h); c.hit(w, h, d, x, h / 2, z, { prompt: function () { return label; }, use: function () { toast(label + '.', ''); } }); }
  // traffic lanes (0.11.0): cars keep right, 1.75 m off the centre line. Points are [x, z] local to the piece; the engine joins
  // the lanes of pieces that meet into one network and drives roadTraffic's cars along it
  var RD_L = 1.75, RD_E = RD_HALF + RD_PAVE;
  function rdRot(q, k) { var a = k * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); return [q[0] * c + q[1] * s, -q[0] * s + q[1] * c]; }
  function rdCircle(cx, cz, r, t0, t1) { var n = Math.max(4, Math.ceil(Math.abs(t1 - t0) * r / 1.2)), out = []; for (var i = 0; i <= n; i++) { var t = t0 + (t1 - t0) * i / n; out.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]); } return out; }
  function rdRing(r, a0, a1) { var n = Math.max(3, Math.ceil(Math.abs(a1 - a0) * r / 1.2)), out = []; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; out.push([r * Math.cos(a), -r * Math.sin(a)]); } return out; }
  function rdBez(a, b, c, d) { var out = []; for (var i = 0; i <= 10; i++) { var t = i / 10, u = 1 - t; out.push(d ? [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]] : [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]); } return out; }
  function rdStraightLanes(c, len) { c.lane([[-len / 2, RD_L], [len / 2, RD_L]]); c.lane([[len / 2, -RD_L], [-len / 2, -RD_L]]); }
  // a junction approach from arm k (0 from -x, 1 from +z, 2 from +x, 3 from -z): straight on, a right turn and a left turn, as asked
  function rdApproach(c, k, ways) {
    var lanes = { straight: [[[-RD_E, RD_L], [RD_E, RD_L]], 0], right: [rdCircle(-RD_E, RD_E, RD_E - RD_L, -Math.PI / 2, 0), RD_E - RD_L], left: [rdCircle(-RD_E, -RD_E, RD_E + RD_L, Math.PI / 2, 0), RD_E + RD_L] };
    ways.forEach(function (w) { var L = lanes[w]; c.lane(L[0].map(function (q) { return rdRot(q, k); }), { box: 'junction', from: k, r: L[1] || undefined }); });
  }
  function rdStraight(c, len) { rdTar(c, len, RD_W, 0, 0); [-1, 1].forEach(function (s) { rdPave(c, len, RD_PAVE, 0, s * (RD_HALF + RD_PAVE / 2)); }); rdEdges(c, len, 0); rdDashes(c, -len / 2, len / 2, 0); rdStraightLanes(c, len); }

  defProp('rdStraight', { extra: true, shop: false, label: 'road, straight 10 m', cat: 'roads', desc: 'A 10 m straight: two lanes, a dashed centre line, kerbs and pavements.', build: function (c) { rdStraight(c, 10); } });
  defProp('rdStraight20', { extra: true, shop: false, label: 'road, straight 20 m', cat: 'roads', desc: 'A 20 m straight: two lanes, a dashed centre line, kerbs and pavements.', build: function (c) { rdStraight(c, 20); } });
  defProp('rdCrossroads', { extra: true, shop: false, label: 'crossroads', cat: 'roads', desc: 'An 11 m crossroads with give way lines on all four arms: set a straight on each side.', build: function (c) { var S = RD_W + RD_PAVE * 2, o = RD_HALF + RD_PAVE / 2; rdTar(c, RD_W, S, 0, 0); rdTar(c, RD_PAVE * 2 + 0.001, RD_W, -o, 0); rdTar(c, RD_PAVE * 2 + 0.001, RD_W, o, 0); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { rdPaveZ(c, RD_PAVE, RD_PAVE, q[0] * o, q[1] * o); }); for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); for (var d = 0; d < 4; d++) { var off = 0.5 + d * 0.8, m = rdLine(c, 0.5, 0.15, ca * (RD_HALF + 0.1) - sa * off, sa * (RD_HALF + 0.1) + ca * off, a + Math.PI / 2); } } for (var ak = 0; ak < 4; ak++) rdApproach(c, ak, ['straight', 'right', 'left']); } });
  defProp('rdTJunction', { extra: true, shop: false, label: 'T-junction', cat: 'roads', desc: 'An 11 m T-junction: the road runs along x and a side road joins from +z, with a give way line.', build: function (c) { var S = RD_W + RD_PAVE * 2, o = RD_HALF + RD_PAVE / 2; rdTar(c, S, RD_W, 0, 0); rdTar(c, RD_W, RD_PAVE, 0, o); rdPave(c, S, RD_PAVE, 0, -o); [-1, 1].forEach(function (s) { rdPaveZ(c, RD_PAVE, RD_PAVE, s * o, o); }); rdLine(c, S, 0.1, 0, -(RD_HALF - 0.25), 0); [-1, 1].forEach(function (s) { rdLine(c, RD_PAVE, 0.1, s * o, RD_HALF - 0.25, 0); }); rdDashes(c, -S / 2, S / 2, 0); for (var d = 0; d < 4; d++) rdLine(c, 0.5, 0.15, 0.4 + d * 0.8, RD_HALF + 0.2, 0); rdApproach(c, 0, ['straight', 'right']); rdApproach(c, 2, ['straight', 'left']); rdApproach(c, 1, ['right', 'left']); } });
  defProp('rdBend', { extra: true, shop: false, label: 'road, 90 degree bend', cat: 'roads', desc: 'A 90 degree bend on a 10 m centre radius. It leaves along x at one end and along z at the other, each end meeting a straight.', build: function (c) { var R = 10, A = Math.PI / 2, tar = rdTex('asphalt', 24, 24, 8), pave = rdTex('concrete', 24, 24, 4); rdArc(c, R - RD_HALF, R + RD_HALF, 0, A, tar, 0.02); rdArc(c, R + RD_HALF, R + RD_HALF + RD_PAVE, 0, A, pave, 0.15, 0.15); rdArc(c, R - RD_HALF - RD_PAVE, R - RD_HALF, 0, A, pave, 0.15, 0.15); rdArcDashes(c, R, 0, A); [R - RD_HALF + 0.25, R + RD_HALF - 0.25].forEach(function (r) { var n = 24; for (var i = 0; i < n; i++) { var a = (i + 0.5) * A / n, len = r * A / n + 0.02; rdLine(c, len, 0.1, Math.cos(a) * r, -Math.sin(a) * r, a + Math.PI / 2); } }); c.lane(rdRing(R - RD_L, A, 0), { r: R - RD_L }); c.lane(rdRing(R + RD_L, 0, A), { r: R + RD_L }); } });
  defProp('rdRoundabout', { extra: true, shop: false, label: 'roundabout', cat: 'roads', desc: 'A roundabout with a grassed island and a tree, 30 m across, with four arms that meet straights.', build: function (c) { var Ri = 5, Ro = Ri + RD_W, tar = rdTex('asphalt', 34, 34, 8), pave = rdTex('concrete', 34, 34, 4); rdArc(c, Ri, Ro, 0, Math.PI * 2, tar, 0.022); var isl = c.cyl(Ri, 0.3, std({ map: TEX.grass || null, color: 0x8ab06a, roughness: 1 }), 0, 0.15, 0, 28); c.cyl(Ri + 0.15, 0.2, rdMat(0xb8b6b0, 0.9), 0, 0.1, 0, 28); c.cyl(0.25, 3, rdMat(0x6a4a32, 0.95), 0, 1.6, 0, 8); c.sphere(1.6, rdMat(0x4f7a3a, 0.9), 0, 3.6, 0); rdArcDashes(c, Ri + RD_HALF, 0, Math.PI * 2); for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2 + Math.PI / 4, gap = 0.46; rdArc(c, Ro, Ro + RD_PAVE, a - (Math.PI / 4 - gap), a + (Math.PI / 4 - gap), pave, 0.15, 0.15); var b = k * Math.PI / 2, ca = Math.cos(b), sa = -Math.sin(b), L = 4; var arm = rdTar(c, L + 0.5, RD_W, ca * (Ro + L / 2 - 0.25), sa * (Ro + L / 2 - 0.25)); arm.rotation.y = b; [-1, 1].forEach(function (s) { var p = c.box(L, 0.15, RD_PAVE, pave, ca * (Ro + L / 2) - sa * s * (RD_HALF + RD_PAVE / 2), 0.075, sa * (Ro + L / 2) + ca * s * (RD_HALF + RD_PAVE / 2)); p.rotation.y = b; }); for (var d = 0; d < 4; d++) { var off = 0.4 + d * 0.8, m = rdLine(c, 0.5, 0.15, ca * (Ro + 0.3) - sa * off, sa * (Ro + 0.3) + ca * off, b + Math.PI / 2); } } c.solid(-Ri, Ri, -Ri, Ri, 0, 0.3); var rr = Ri + RD_HALF, ga = 0.6, edge = Ro + 4; for (var q = 0; q < 4; q++) { var bq = q * Math.PI / 2, u = [Math.cos(bq), -Math.sin(bq)], w = [-Math.sin(bq), -Math.cos(bq)], at = function (k, side) { return [u[0] * k + w[0] * side, u[1] * k + w[1] * side]; }, ringAt = function (a) { return [rr * Math.cos(a), -rr * Math.sin(a)]; }; c.lane([at(edge, RD_L), at(Ro + 0.5, RD_L)]); c.lane([at(Ro + 0.5, RD_L)].concat(rdBez(at(Ro, RD_L), at(9.5, RD_L), ringAt(bq + ga))), { r: 6, merge: true }); c.lane(rdBez(ringAt(bq - ga), at(9.5, -RD_L), at(Ro, -RD_L)).concat([at(edge, -RD_L)]), { r: 6 }); c.lane(rdRing(rr, bq - ga, bq + ga), { prio: 1, r: rr }); c.lane(rdRing(rr, bq + ga, bq + Math.PI / 2 - ga), { prio: 1, r: rr }); } } });
  defProp('rdDeadEnd', { extra: true, shop: false, label: 'road, dead end', cat: 'roads', desc: 'A 10 m road that ends in a turning circle with a kerb round it.', build: function (c) { rdTar(c, 6, RD_W, -2, 0); [-1, 1].forEach(function (s) { rdPave(c, 6, RD_PAVE, -2, s * (RD_HALF + RD_PAVE / 2)); }); rdEdges(c, 6, -2); rdDashes(c, -5, 1, 0); var tar = rdTex('asphalt', 14, 14, 8), pave = rdTex('concrete', 14, 14, 4); rdArc(c, 0, 5.5, -Math.PI / 2, Math.PI / 2, tar, 0.021, 0, 1); rdArc(c, 5.5, 5.5 + RD_PAVE, -Math.PI / 2 + 0.68, Math.PI / 2 - 0.68, pave, 0.15, 0.15, 1); c.lane([[-5, RD_L]].concat(rdBez([0, RD_L], [5.5, RD_L], [5.5, -RD_L], [0, -RD_L])).concat([[-5, -RD_L]]), { r: 2.5 }); } });
  defProp('rdPavement', { extra: true, shop: false, label: 'pavement strip', cat: 'roads', desc: 'A 10 m by 2 m pavement with a kerb, to edge a yard or a car park.', build: function (c) { rdPaveZ(c, 10, RD_PAVE, 0, 0); c.box(10, 0.16, 0.15, rdMat(0xb8b6b0, 0.9), 0, 0.08, RD_PAVE / 2 + 0.075); } });
  defProp('rdParking', { extra: true, shop: false, label: 'parking bays', cat: 'roads', desc: 'Five 2.5 by 5 m parking bays on tarmac, with a P sign.', build: function (c) { rdTar(c, 12.5, 6, 0, 0); for (var i = 0; i <= 5; i++) rdLine(c, 5, 0.12, -6.25 + i * 2.5, -0.5, Math.PI / 2); rdLine(c, 12.5, 0.12, 0, -3.0, 0); c.cyl(0.04, 2.4, MAT.steelDark, 6.6, 1.2, -2.9, 8); c.sign(['P'], 0.6, 0.6, 6.6, 2.2, -2.85, 0, { w: 128, h: 128, bg: '#1d4fb8', fg: '#ffffff' }); c.solid(6.5, 6.7, -3.0, -2.8, 0, 2.5); } });
  defProp('rdBusStop', { extra: true, shop: false, label: 'bus stop', cat: 'roads', desc: 'A bus stop: the yellow box marking on the road and a flag on its pole.', build: function (c) { var y = MAT.yellowLine || rdMat(0xf0c020, 0.6); rdLine(c, 12, 0.15, 0, 0, 0, y); rdLine(c, 12, 0.15, 0, 2.6, 0, y); [-6, 6].forEach(function (x) { rdLine(c, 2.6, 0.15, x, 1.3, Math.PI / 2, y); }); var sg = c.sign(['BUS STOP'], 3.6, 0.6, 0, 0.03, 1.3, 0, { w: 512, h: 86, bg: '#3d3f42', fg: '#f0c020' }); sg.rotation.x = -Math.PI / 2; c.cyl(0.04, 2.8, MAT.steelDark, 4, 1.4, -0.6, 8); c.sign(['BUS', '12  24  36'], 0.55, 0.45, 4, 2.55, -0.55, 0, { w: 160, h: 130, bg: '#c0282e', fg: '#ffffff' }); c.solid(3.9, 4.1, -0.7, -0.5, 0, 2.8); } });
  defProp('rdSpeedBump', { extra: true, shop: false, label: 'speed bump', cat: 'roads', desc: 'A speed bump across a 7 m road, striped black and yellow.', build: function (c) { for (var i = 0; i < 7; i++) { var b = c.cyl(0.35, 1.0, i % 2 ? MAT.black : rdMat(0xf0c020, 0.6), 0, 0, -3 + i, 16); b.rotation.x = Math.PI / 2; b.scale.set(1, 1, 0.22); b.position.y = 0; } } });
  defProp('rdCrashBarrier', { extra: true, shop: false, label: 'crash barrier', cat: 'roads', desc: 'A 10 m steel crash barrier on posts.', build: function (c) { var s = rdMat(0xb8bcc0, 0.35, 0.8); for (var i = 0; i < 6; i++) c.box(0.1, 0.75, 0.1, MAT.steelDark, -5 + i * 2, 0.38, -0.08); c.box(10, 0.3, 0.06, s, 0, 0.6, 0.02); c.box(10, 0.06, 0.1, s, 0, 0.6, 0.04); c.solid(-5, 5, -0.15, 0.1, 0, 0.8); } });
  defProp('rdCones', { extra: true, shop: false, label: 'traffic cones', cat: 'roads', desc: 'Six traffic cones in a line, 1.5 m apart.', build: function (c) { var o = rdMat(0xe8641e, 0.5); for (var i = 0; i < 6; i++) { var x = -3.75 + i * 1.5; c.box(0.4, 0.04, 0.4, MAT.black, x, 0.02, 0); c.cyl(0.03, 0.7, o, x, 0.39, 0, 12, 0.17); c.cyl(0.09, 0.1, MAT.white, x, 0.46, 0, 12, 0.11); c.solid(x - 0.2, x + 0.2, -0.2, 0.2, 0, 0.75); } } });
  defProp('rdArrows', { extra: true, shop: false, label: 'lane arrows', cat: 'roads', desc: 'Painted lane arrows: straight on in one lane, turn left in the other.', build: function (c) { function arrow(x, z, turn) { var s = new THREE.Shape(); if (turn) { s.moveTo(-1.6, -0.12); s.lineTo(0.12, -0.12); s.lineTo(0.12, 0.6); s.lineTo(0.45, 0.6); s.lineTo(0, 1.3); s.lineTo(-0.45, 0.6); s.lineTo(-0.12, 0.6); s.lineTo(-0.12, 0.12); s.lineTo(-1.6, 0.12); s.lineTo(-1.6, -0.12); } else { s.moveTo(-1.6, -0.12); s.lineTo(0.8, -0.12); s.lineTo(0.8, -0.45); s.lineTo(1.6, 0); s.lineTo(0.8, 0.45); s.lineTo(0.8, 0.12); s.lineTo(-1.6, 0.12); s.lineTo(-1.6, -0.12); } var m = new THREE.Mesh(new THREE.ShapeGeometry(s), MAT.whiteLine || MAT.white); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.027, z); c.add(m); } arrow(0, -1.75, false); arrow(0, 1.2, true); } });
  defProp('rdGiveWay', { extra: true, shop: false, label: 'give way line', cat: 'roads', desc: 'A give way line across one lane, with the triangle painted behind it.', build: function (c) { for (var d = 0; d < 4; d++) rdLine(c, 0.5, 0.15, 0, -1.4 + d * 0.8, Math.PI / 2); var s = new THREE.Shape(); s.moveTo(0, -0.9); s.lineTo(2.4, 0); s.lineTo(0, 0.9); s.lineTo(0, -0.9); var h = new THREE.Path(); h.moveTo(0.2, -0.6); h.lineTo(0.2, 0.6); h.lineTo(1.8, 0); h.lineTo(0.2, -0.6); s.holes.push(h); var m = new THREE.Mesh(new THREE.ShapeGeometry(s), MAT.whiteLine || MAT.white); m.rotation.x = -Math.PI / 2; m.position.set(-3.5, 0.027, 0); c.add(m); } });
  defProp('rdGantry', { extra: true, shop: false, label: 'motorway sign gantry', cat: 'roads', desc: 'A sign gantry spanning a 7 m road, with two direction boards.', build: function (c) { var g = rdMat(0x8a9098, 0.4, 0.6); [-1, 1].forEach(function (s) { c.box(0.35, 6.2, 0.35, g, 0, 3.1, s * 4.8); c.box(0.8, 0.3, 0.8, rdMat(0x9a9890, 0.9), 0, 0.15, s * 4.8); c.solid(-0.2, 0.2, s * 4.8 - 0.2, s * 4.8 + 0.2, 0, 6.2); }); c.box(0.5, 0.5, 10, g, 0, 6.0, 0); c.sign(['A1  North', 'Leeds  42'], 3.8, 1.6, 0.3, 4.9, -2.1, Math.PI / 2, { w: 512, h: 216, bg: '#1d4fb8', fg: '#ffffff' }); c.sign(['City Centre', 'Docks  3'], 3.8, 1.6, 0.3, 4.9, 2.1, Math.PI / 2, { w: 512, h: 216, bg: '#1d4fb8', fg: '#ffffff' }); } });
  CO.ui({
    "hud": [
      {
        "label": "Day",
        "value": "S.day"
      },
      {
        "label": "Time",
        "value": "fmtTime(S.time)"
      },
      {
        "label": "Bank",
        "value": "money(S.bank)",
        "color": "#f5b53d"
      },
      {
        "label": "Rep",
        "value": "S.rep"
      },
      {
        "label": "Level",
        "value": "S.level"
      },
      {
        "label": "Job",
        "value": "S.job ? ({ coming: 'car on its way', waiting: 'customer at the desk', taken: 'find the fault', fixing: 'fixing', done: 'fixed, take the money', paid: 'paid', leaving: 'leaving' })[S.job.state] || S.job.state : 'no job'"
      },
      {
        "label": "Roll door",
        "value": "S.doorOpen ? 'open' : 'closed'"
      }
    ],
    "panels": {},
    "start": [
      "'Day ' + S.day",
      "money(S.bank)",
      "S.stats.jobs + ' jobs done'"
    ],
    "menuLine": "'Day ' + S.day + ' at the lock-up · ' + money(S.bank) + ' in the bank'",
    "guide": ""
  });
  CO.world({
    "lamp post@12.5,6": { x: 3.55, z: 9.5, ry: 1 },
    "lock-up@0,0": { x: 0.5, z: -2 },
    "mesh box 13x0.12x0.3@-10,22.75,0.06": { x: -10.05, z: 21.1 },
    "mesh box 13x0.12x0.3@10,22.75,0.06": { x: 10.35, z: 21.1 },
    "mesh plane 180x0.12@0,25": { hidden: true },
    "mesh plane 180x7.5@0,25": { hidden: true },
    "mesh plane 34x19.2@0,13.6": { x: 0.15, z: 11.65, ry: -360, sy: 1.04 },
    "mesh plane 400x400@0,0,-0.03": { x: -10.65, z: -0.7 },
    "tree@-20,9.88": { x: -18.45, z: 6.5 },
    "tree@-9,-8.1": { hidden: true },
    "tree@21,17.91": { hidden: true },
  });
  CO.worldCopies([
    { id: "wc-mv2jyad7-1", of: "tree@-20,9.88", x: -18.35, y: 0, z: 19.8, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2jyghu-2", of: "tree@-20,9.88", x: -18.5, y: 0, z: 13.35, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2jz61f-3", of: "tree@-20,9.88", x: 18.5, y: 0, z: 16.85, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2jz61g-4", of: "tree@-20,9.88", x: 18.35, y: 0, z: 11.05, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2jz61g-5", of: "tree@-20,9.88", x: 18.2, y: 0, z: 4.1, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2k0i9z-6", of: "tree@-20,9.88", x: -18.1, y: 0, z: -0.85, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2k0okc-7", of: "tree@-20,9.88", x: -9.5, y: 0, z: -1.1, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2k16ns-8", of: "tree@-20,9.88", x: 17.8, y: 0, z: -0.25, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2k16ns-9", of: "tree@-20,9.88", x: 9.2, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2k6k8f-n", of: "lamp post@12.5,6", x: 16.75, y: 0, z: 20.3, ry: -269, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2k7awv-o", of: "lamp post@12.5,6", x: -16.45, y: 0, z: 20.35, ry: -269, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2kkbhj-1u", of: "tree@-20,9.88", x: -24.65, y: 0, z: 20.35, ry: 0, sx: 1, sy: 1, sz: 1 },
    { id: "wc-mv2kkjb0-1v", of: "tree@-20,9.88", x: 18.05, y: 0, z: 20.7, ry: 0, sx: 1, sy: 1, sz: 1 },
  ]);
  // ── Garage Co. ────────────────────────────────────────────────────
  // The first room of the game: a lock-up on the edge of town with a roll door onto a small forecourt. Cars come in off the road,
  // the customer walks to the desk, you take the job, fix the car in the bay and take the payment. Everything else in docs/PLAN.md
  // builds on this room. GAME carries the hooks for the engine (CO.game); G holds the live things that are not state (meshes, timers).
  var GAME = {}, G = { lamps: [], rollT: 0, nextCarAt: 0, customerNearDoor: false };
  var LOCKUP = { x: 5, z: 4, h: 3.6, doorW: 3.2, doorH: 3.0 };                 // half sizes: a 10 by 8 m lock-up, 3.6 m to the roof
  var FORECOURT = { x: 16, z0: LOCKUP.z, z1: 22 }, ROAD_Z = 25, LANE = 1.6;      // the forecourt in front of the roll door, the road past it
  var BAY = { x: 5, z: 12 }, DESK = { x: -3.2, z: -2.6 }, DESK_STAND = { x: -3.2, z: -1.0 };   // where a car parks, where the desk stands, where a customer waits
  var OPEN_AT = 8, CLOSE_AT = 18, LAST_CAR_AT = 17;                              // the day: cars arrive from a quarter past eight to five
  // the four faults of the lock-up (levels 1 to 4 in the plan): what the customer says, what the job is, how long it takes, what it pays
  var FAULTS = [
    { id: 'oil', symptom: 'The oil light has been on since Tuesday.', job: 'an oil and filter change', secs: 8, price: 60 },
    { id: 'brakes', symptom: 'It squeals every time I brake.', job: 'new front brake pads', secs: 10, price: 120 },
    { id: 'bulb', symptom: 'The left headlight is out.', job: 'a headlight bulb', secs: 4, price: 15 },
    { id: 'battery', symptom: 'It would not start this morning.', job: 'a new battery', secs: 6, price: 95 }
  ];
  CO.table('FAULTS', FAULTS, 'the faults a car comes in with: how long each takes (secs) and what it pays');   // the editor's Settings tab tunes it
  var MAKES = ['Harlow Estate', 'Pennant 1.4', 'Kestrel Van', 'Dunmore Coupe', 'Alder Hatch', 'Brampton Saloon'];   // made-up makes, in the house look
  var NAMES = ['Mrs Okafor', 'Dan', 'Priya', 'Mr Holt', 'Lena', 'Sam', 'Mr Baptiste', 'Ruth'];
  CO.setup({ canvas: 'co-canvas', save: 'garageco', game: GAME, spawn: { x: 0, z: -1, yaw: Math.PI }, sun: { box: 40, far: 120, mapSize: 2048, target: [0, 0, 8] }, lightBudget: 8 });

  // ── Where things are ──────────────────────────────────────────────
  // the lock-up is one world item: the editor can move the whole building, and every rule about it (where it is indoors, the roof,
  // the walls, the doorway, where a customer waits) follows it. LO() is how far it stands from where the code built it
  function LO() { var it = G.lockup, b = G.lockBase; return it && b ? { x: it.position.x - b.x, z: it.position.z - b.z } : { x: 0, z: 0 }; }
  function inLockup(x, z, m) { m = m || 0; var o = LO(); x -= o.x; z -= o.z; return Math.abs(x) < LOCKUP.x - m && Math.abs(z) < LOCKUP.z - m; }
  function inForecourt(x, z, m) { m = m || 0; return Math.abs(x) < FORECOURT.x - m && z > FORECOURT.z0 + m && z < FORECOURT.z1 - m; }
  function inDoorway(x, z) { var o = LO(); x -= o.x; z -= o.z; return Math.abs(x) < LOCKUP.doorW / 2 - 0.2 && Math.abs(z - LOCKUP.z) < 0.6; }
  function deskStand() { var o = LO(); return { x: DESK_STAND.x + o.x, z: DESK_STAND.z + o.z }; }
  function faultOf(car) { return FAULTS.filter(function (f) { return f.id === car.fault; })[0] || FAULTS[0]; }
  GAME.floorY = function () { return 0; };
  // the plot around the lock-up: the ground you may walk on and where the editor may stand things. The forecourt can be widened and
  // the fence moved out in the editor, so the plot reaches well past both; walls and fences still stop you through their solids
  var PLOT = { x: FORECOURT.x + 24, z0: -LOCKUP.z - 12, z1: ROAD_Z + 4 };
  GAME.insideWalk = function (x, z) { if (inLockup(x, z, 0.35) || inDoorway(x, z)) return true; if (inLockup(x, z, -0.45)) return false; return Math.abs(x) < PLOT.x && z > PLOT.z0 && z < PLOT.z1; };
  GAME.indoors = function (x, z) { return inLockup(x, z); };
  GAME.roofAt = function (x, z) { return inLockup(x, z) ? LOCKUP.h + 0.3 : 0; };
  GAME.wallPlanes = function () { var X = LOCKUP.x, Z = LOCKUP.z, o = LO(); return [{ a: 'x', v: o.x - X + 0.17, n: 1, z0: o.z - Z, z1: o.z + Z }, { a: 'x', v: o.x + X - 0.17, n: -1, z0: o.z - Z, z1: o.z + Z }, { a: 'z', v: o.z - Z + 0.17, n: 1, x0: o.x - X, x1: o.x + X }, { a: 'z', v: o.z + Z - 0.17, n: -1, x0: o.x - X, x1: o.x + X }]; };
  GAME.editClamp = function (pt) { if (inLockup(pt.x, pt.z)) return { x: pt.x, z: pt.z }; return { x: clamp(pt.x, -PLOT.x + 0.5, PLOT.x - 0.5), z: clamp(pt.z, PLOT.z0 + 0.5, PLOT.z1 - 0.5) }; };
  GAME.stepSurface = function (x, z) { return inLockup(x, z) ? 'floor' : 'outside'; };
  GAME.catalogueGroups = [['garage', '🔧 The workshop'], ['yard', '🌳 The forecourt']];
  // the roll door is yours to open; while it is down nobody walks through the doorway (a customer has it opened for them)
  GAME.collides = function (x, z) { return !S.doorOpen && G.rollT < 0.7 && inDoorway(x, z); };
  GAME.doorOpeners = function () { return G.customer && G.customer.walking ? [{ x: G.customer.rec.x, z: G.customer.rec.z }] : []; };

  // ── The building ──────────────────────────────────────────────────
  GAME.buildWorld = function (loaded) {
    var X = LOCKUP.x, Z = LOCKUP.z, H = LOCKUP.h, DW = LOCKUP.doorW, DH = LOCKUP.doorH;
    // the ground: grass to the horizon, the forecourt's asphalt, the road with its centre line and a kerb either side of the entrance
    plane(400, 400, MAT.grass, 0, -0.03, 0, -Math.PI / 2);
    var fc = plane(2 * FORECOURT.x + 2, FORECOURT.z1 - FORECOURT.z0 + 1.2, MAT.yard, 0, 0, (FORECOURT.z0 + FORECOURT.z1) / 2 + 0.6, -Math.PI / 2); fc.receiveShadow = true;
    plane(180, 7.5, MAT.yard, 0, 0, ROAD_Z, -Math.PI / 2); plane(180, 0.12, MAT.whiteLine, 0, 0.004, ROAD_Z, -Math.PI / 2);
    box(FORECOURT.x - 3, 0.12, 0.3, MAT.grey, -(FORECOURT.x + 4) / 2, 0.06, FORECOURT.z1 + 0.75); box(FORECOURT.x - 3, 0.12, 0.3, MAT.grey, (FORECOURT.x + 4) / 2, 0.06, FORECOURT.z1 + 0.75);
    // the bay: two white lines and an end mark
    box(0.1, 0.02, 5.4, MAT.whiteLine, BAY.x - 1.5, 0.01, BAY.z); box(0.1, 0.02, 5.4, MAT.whiteLine, BAY.x + 1.5, 0.01, BAY.z); box(3.0, 0.02, 0.1, MAT.whiteLine, BAY.x, 0.01, BAY.z - 2.7);
    // the lock-up: a slab, block walls (the roll door opening in the south wall, the side door in the east wall), a roof and two skylights.
    // All of it is one world item, so the editor moves the building as a whole and the rules above follow it
    worldItem('lock-up', function () { G.lockup = WORLD_PARENT;
    var slab = plane(2 * X, 2 * Z, MAT.floor, 0, 0.01, 0, -Math.PI / 2); slab.receiveShadow = true;
    box(2 * X + 0.3, H, 0.3, MAT.block, 0, H / 2, -Z); solid(-X - 0.15, X + 0.15, -Z - 0.15, -Z + 0.15);
    box(0.3, H, 2 * Z + 0.3, MAT.block, -X, H / 2, 0); solid(-X - 0.15, -X + 0.15, -Z - 0.15, Z + 0.15);
    box(0.3, H, 1.6 + Z, MAT.block, X, H / 2, (-Z + 1.6) / 2); solid(X - 0.15, X + 0.15, -Z - 0.15, 1.6);
    box(0.3, H, Z - 2.6, MAT.block, X, H / 2, (2.6 + Z) / 2); solid(X - 0.15, X + 0.15, 2.6, Z + 0.15);
    box(0.3, H - 2.25, 1.0, MAT.block, X, 2.25 + (H - 2.25) / 2, 2.1);
    var pier = (2 * X - DW) / 2;
    box(pier, H, 0.3, MAT.block, -(DW / 2 + pier / 2), H / 2, Z); box(pier, H, 0.3, MAT.block, DW / 2 + pier / 2, H / 2, Z); box(DW + 0.4, H - DH, 0.3, MAT.block, 0, DH + (H - DH) / 2, Z);
    solid(-X - 0.15, -DW / 2, Z - 0.15, Z + 0.15); solid(DW / 2, X + 0.15, Z - 0.15, Z + 0.15);
    box(2 * X + 0.6, 0.25, 2 * Z + 0.6, MAT.roof, 0, H + 0.125, 0); plane(2 * X, 2 * Z, MAT.roofIn, 0, H - 0.01, 0, Math.PI / 2);
    [-2.5, 2.5].forEach(function (x) { var sk = plane(1.6, 1.2, MAT.skylight, x, H - 0.02, -1, Math.PI / 2); lampMeshes.push(sk); });
    // the linings: painted plaster inside with a skirting, the two openings left out
    lineWall('z', -Z, -X, X, H - 0.4, MAT.plaster, [], 1, { inset: 0.16 }); lineWall('x', -X, -Z, Z, H - 0.4, MAT.plaster, [], 1, { inset: 0.16 });
    lineWall('x', X, -Z, Z, H - 0.4, MAT.plaster, [[1.6, 2.6, 2.25]], -1, { inset: 0.16 }); lineWall('z', Z, -X, X, H - 0.4, MAT.plaster, [[-DW / 2, DW / 2, DH]], -1, { inset: 0.16 });
    // the trusses and the light: two high bays, a point light under each
    [-1.5, 1.5].forEach(function (z) { box(2 * X - 0.4, 0.3, 0.2, MAT.steelDark, 0, H - 0.25, z); });
    [[-2.5, -1.5], [2.5, 1.5]].forEach(function (p) { highBay(p[0], H - 0.95, p[1], H); var l = new THREE.PointLight(0xffeacc, 0.6, 14, 2); l.position.set(p[0], H - 1.2, p[1]); parentOf(null).add(l); G.lamps.push(l); });
    // the side door, hinged, with a window; the roll door, a corrugated panel that rolls into a box over the lintel (E on the chain)
    G.sideDoor = hingedDoor('side', X, 1.6, false, 'the side door', { window: true });
    G.roll = new THREE.Group(); G.roll.userData.dynamic = true; G.roll.position.set(0, 0, Z); parentOf(null).add(G.roll);
    G.rollPanel = box(DW, DH, 0.08, MAT.door, 0, DH / 2, 0, G.roll); G.rollPanel.castShadow = false;
    box(0.12, DH + 0.1, 0.2, MAT.steelDark, -DW / 2 - 0.06, (DH + 0.1) / 2, Z); box(0.12, DH + 0.1, 0.2, MAT.steelDark, DW / 2 + 0.06, (DH + 0.1) / 2, Z); box(DW + 0.4, 0.42, 0.46, MAT.steelDark, 0, DH + 0.24, Z - 0.3);
    cyl(0.012, 1.3, MAT.chrome, DW / 2 + 0.35, 1.55, Z - 0.22, null, 6);
    hitBox(0.4, 1.4, 0.4, DW / 2 + 0.35, 1.5, Z - 0.22, { prompt: function () { return (S.doorOpen ? 'Pull the chain: close' : 'Pull the chain: open') + ' the roll door'; }, use: function () { S.doorOpen = !S.doorOpen; sfx(S.doorOpen ? 'unlock' : 'lock'); hudDirty = true; } });
    sign(['GARAGE CO.'], 4.2, 0.9, 0, H + 0.75, Z + 0.22, 0, { bg: '#1b232c' });
    }, null);
    if (G.lockup) { G.lockBase = { x: G.lockup.position.x, z: G.lockup.position.z }; G.lockup.userData.movesOnly = true; }   // the rules follow where it stands, not a turn or a new size
    // the forecourt: two trees, a lamp post, the sky, the road's traffic. The fence down both sides is made of fence section props
    // (placed in src/00-layout.js), so it moves, goes and grows in the editor like anything else
    tree(-20, 10, 1.2); tree(21, 18, 0.9); tree(-9, -8, 1.0); lampPost(12, 6, 0, 5);
    buildSky({ clouds: 6, rainN: 2500, snowN: 1200 });
    // the road is a lane each way on the engine's road network: road pieces laid off either end join it, and its two cars drive on
    roadLane([[-90, ROAD_Z + LANE], [90, ROAD_Z + LANE]]); roadLane([[90, ROAD_Z - LANE], [-90, ROAD_Z - LANE]]); roadTraffic({ cars: 2, speed: 8.5 });
    buildProps();
    navSetup({ x0: -PLOT.x, z0: PLOT.z0, width: 2 * PLOT.x, depth: PLOT.z1 - PLOT.z0 + 2, cell: 0.4 });
  };
  // the roll door rides up into its box while open, or while a customer walks through; the shadow map follows it
  function tickRoll(dt) {
    var want = S.doorOpen || G.customerNearDoor ? 1 : 0;
    if (Math.abs(G.rollT - want) < 0.002) return;
    G.rollT = lerp(G.rollT, want, 1 - Math.pow(0.03, dt)); if (Math.abs(G.rollT - want) < 0.004) G.rollT = want;
    var sy = 1 - G.rollT * 0.94; G.rollPanel.scale.y = sy; G.rollPanel.position.y = LOCKUP.doorH - (LOCKUP.doorH * sy) / 2; shadowDirty = true;
  }

  // ── The props: the lock-up's fittings, and two extras for the catalogue ──
  var CHROME_RED = std({ color: 0xc8342a, roughness: 0.45, metalness: 0.3 });
  defProp('toolWall', { label: 'tool wall', cat: 'garage', wall: true, x: 1.5, z: -3.83, rot: 0, build: function (c) {
    c.box(2.4, 1.2, 0.04, MAT.wood, 0, 1.5, 0); for (var i = 0; i < 9; i++) { var x = -1.05 + i * 0.26; c.cyl(0.012, 0.3, MAT.steel, x, 1.75 - (i % 3) * 0.12, 0.05, 6); c.box(0.06, 0.05, 0.03, MAT.rubber, x, 1.62 - (i % 3) * 0.12, 0.05); }
    c.sign(['TOOLS', 'put it back where you found it'], 1.4, 0.3, 0, 2.3, 0.03, 0, { bg: '#1b232c' });
  } });
  defProp('bench', { label: 'workbench', cat: 'garage', x: -3.6, z: 0.6, rot: 1, build: function (c) {
    c.box(2.2, 0.08, 0.8, MAT.wood, 0, 0.9, 0); c.box(2.1, 0.5, 0.7, MAT.steelDark, 0, 0.3, 0); [-0.95, 0.95].forEach(function (x) { c.box(0.08, 0.86, 0.7, MAT.steelDark, x, 0.43, 0); });
    c.box(0.5, 0.25, 0.3, MAT.red, -0.6, 1.07, -0.1); c.box(0.3, 0.1, 0.2, MAT.black, 0.5, 0.99, 0.1); c.solid(-1.1, 1.1, -0.4, 0.4, 0, 1.0);
    // the job card: a small screen on a stand at the bench's end, drawn from the state
    c.box(0.06, 0.5, 0.06, MAT.steelDark, 0.95, 1.2, -0.3);
    touchScreen({ w: 360, h: 240, pw: 0.6, ph: 0.4, x: 0.95, y: 1.6, z: -0.29, ry: 0, parent: c.group, title: 'Job card', draw: drawJobCard });
  } });
  defProp('desk', { label: 'desk', cat: 'garage', x: DESK.x, z: DESK.z, rot: 0, build: function (c) {
    c.box(1.6, 0.06, 0.8, MAT.wood, 0, 0.78, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, -0.72, 0.38, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, 0.72, 0.38, 0); c.box(0.5, 0.6, 0.6, MAT.steelDark, 0.45, 0.3, 0);
    c.box(0.32, 0.02, 0.44, MAT.paper, -0.3, 0.82, 0.05); c.box(0.3, 0.2, 0.02, MAT.black, 0.35, 0.92, -0.25);
    c.hit(0.5, 0.2, 0.5, -0.3, 0.9, 0.05, { prompt: function () { return 'Read the clipboard: the jobs'; }, use: function () { openPanel('jobs'); } });
    c.solid(-0.8, 0.8, -0.4, 0.4, 0, 0.85);
  } });
  defProp('jack', { label: 'trolley jack', cat: 'garage', x: 1.4, z: 1.2, rot: 0, build: function (c) {
    c.box(0.3, 0.12, 0.7, CHROME_RED, 0, 0.1, 0); c.cyl(0.06, 0.1, MAT.steel, 0, 0.21, -0.1, 12); var h = c.cyl(0.015, 1.0, MAT.steelDark, 0, 0.55, 0.55, 6); h.rotation.x = 0.9;
    [[0.13, -0.28], [-0.13, -0.28], [0.13, 0.3], [-0.13, 0.3]].forEach(function (p) { var w = c.cyl(0.05, 0.04, MAT.rubber, p[0], 0.05, p[1], 10); w.rotation.z = Math.PI / 2; });
    c.solid(-0.2, 0.2, -0.4, 0.6, 0, 0.4);
  } });
  defProp('stands', { label: 'axle stands', cat: 'garage', x: 3.2, z: -2.8, rot: 0, build: function (c) {
    [-0.3, 0.3].forEach(function (x) { c.cyl(0.05, 0.45, MAT.steelDark, x, 0.45, 0, 8); c.box(0.36, 0.04, 0.36, MAT.steelDark, x, 0.02, 0); c.box(0.12, 0.05, 0.16, MAT.steelDark, x, 0.7, 0); });
    c.solid(-0.5, 0.5, -0.2, 0.2, 0, 0.75);
  } });
  defProp('drum', { label: 'oil drum', cat: 'garage', x: 4.2, z: -0.5, rot: 0, build: function (c) { c.cyl(0.3, 0.9, MAT.blue, 0, 0.45, 0, 16); c.cyl(0.31, 0.03, MAT.steelDark, 0, 0.3, 0, 16); c.cyl(0.31, 0.03, MAT.steelDark, 0, 0.6, 0, 16); c.solid(-0.32, 0.32, -0.32, 0.32, 0, 0.9); } });
  defProp('rack', { label: 'parts rack', cat: 'garage', x: 4.5, z: -2.2, rot: 3, build: function (c) {
    [-0.9, 0.9].forEach(function (x) { c.box(0.05, 2.0, 0.4, MAT.rack, x, 1.0, 0); }); [0.4, 1.0, 1.6].forEach(function (y) { c.box(1.85, 0.04, 0.4, MAT.steel, 0, y, 0); });
    c.box(0.3, 0.3, 0.3, MAT.wood, -0.5, 0.57, 0); c.box(0.4, 0.2, 0.25, MAT.black, 0.3, 1.12, 0); c.box(0.5, 0.15, 0.3, MAT.yellow, -0.4, 1.7, 0);
    c.solid(-0.95, 0.95, -0.22, 0.22, 0, 2.0);
  } });
  defProp('noticeBoard', { label: 'notice board', cat: 'garage', wall: true, x: -4.83, z: -2.6, rot: 1, build: function (c) { c.box(1.2, 0.9, 0.04, MAT.wood, 0, 1.7, 0); c.plane(1.1, 0.8, MAT.cork, 0, 1.7, 0.025, 0, 0); c.sign(['OPEN 8 TO 6'], 0.5, 0.16, 0.2, 1.9, 0.03, 0, { bg: '#f3efe4', fg: '#1b232c' }); } });
  defProp('xCompressor', { extra: true, label: 'compressor', cat: 'garage', price: 300, desc: 'A tank on wheels, a motor on top. Air for the tools.', build: function (c) { var t = c.cyl(0.25, 0.9, MAT.red, 0, 0.45, 0, 16); t.rotation.z = Math.PI / 2; c.box(0.3, 0.25, 0.3, MAT.black, 0, 0.75, 0); c.cyl(0.06, 0.04, MAT.rubber, -0.3, 0.1, 0.2, 10).rotation.z = Math.PI / 2; c.cyl(0.06, 0.04, MAT.rubber, 0.3, 0.1, 0.2, 10).rotation.z = Math.PI / 2; c.solid(-0.5, 0.5, -0.3, 0.3, 0, 0.9); } });
  defProp('xStool', { extra: true, label: 'stool', cat: 'garage', price: 25, desc: 'A mechanic sits down sometimes.', build: function (c) { c.cyl(0.18, 0.05, MAT.red, 0, 0.6, 0, 16); c.cyl(0.02, 0.58, MAT.chrome, 0, 0.3, 0, 8); c.cyl(0.2, 0.03, MAT.steelDark, 0, 0.02, 0, 16); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 0.65); } });
  // a 3 m section of the forecourt fence: posts with concrete feet, the mesh panel, two folds, the rails, the gravel board and three strands
  // of barbed wire on arms that lean out to the section's back (-z). The same look as the engine's fenceRun, as a prop to place in the editor
  function fenceSectionBuild(c) {
    var F = fenceMats(), L = 3;
    [-L / 2, L / 2].forEach(function (px) {
      c.box(0.08, 2.5, 0.08, F.post, px, 1.25, 0); c.box(0.3, 0.25, 0.3, F.conc, px, 0.12, 0); c.box(0.12, 0.03, 0.12, F.post, px, 2.52, 0);
      var arm = c.box(0.04, 0.6, 0.04, F.post, px, 2.82, -0.2); arm.rotation.set(0, Math.PI / 2, -0.7, 'YXZ');
    });
    var mp = c.plane(L - 0.1, 2.2, F.mesh, 0, 1.35, 0, 0, 0); mp.receiveShadow = false;
    [0.75, 1.65].forEach(function (vy) { c.box(L - 0.1, 0.06, 0.03, F.post, 0, vy, 0); });
    c.box(L, 0.3, 0.05, F.conc, 0, 0.15, 0); c.box(L, 0.03, 0.03, F.post, 0, 2.46, 0); c.box(L, 0.03, 0.03, F.post, 0, 0.32, 0);
    [0, 1, 2].forEach(function (k) { var w = c.cyl(0.006, L, F.wire, 0, 2.62 + k * 0.17, -(0.22 + k * 0.14), 4); w.rotation.set(Math.PI / 2, Math.PI / 2, 0, 'YXZ'); });
    c.solid(-L / 2 - 0.06, L / 2 + 0.06, -0.06, 0.06, 0, 2.6);
  }
  defProp('fenceSection', { extra: true, shop: false, label: 'fence section', cat: 'yard', yard: true, desc: 'A 3 m section of the forecourt fence with barbed wire. The wire leans out to the back: turn it to face the right way.', build: fenceSectionBuild });
  defProp('xPlanter', { extra: true, label: 'planter', cat: 'yard', yard: true, price: 40, desc: 'A tub of green by the door.', build: function (c) { c.box(0.6, 0.45, 0.6, MAT.grey, 0, 0.22, 0); c.sphere(0.3, std({ color: 0x4f7f3a, roughness: 1 }), 0, 0.65, 0); c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.9); } });
  // ── Cars ──────────────────────────────────────────────────────────
  // One car at a time in the lock-up. The record is the save's (S.job holds the car and the state of its job); the mesh, the position
  // and the customer are G's and are rebuilt from the record on load. The job's states, in order:
  //   coming (on the road, then into the bay)  waiting (parked, the customer walks to the desk)  taken (you have the job card)
  //   fixing (you are at the car, the work counts up)  done (fixed; the payment waits at the desk)  paid (the customer walks back)
  //   leaving (the car drives off; then S.job is null and the next car is due)
  function newCar() { var f = pick(FAULTS); return { id: uid('car'), make: pick(MAKES), col: pick(CAR_COLS), name: pick(NAMES), fault: f.id, plate: 'GC ' + randi(10, 99) + ' ' + pick(['AB', 'KH', 'NL', 'XY']) + randi(100, 999) }; }
  function carPrompt() {
    var J = S.job; if (!J) return null;
    if (J.state === 'waiting') return 'Look at the ' + J.car.make + ': ' + J.car.name + ' is coming to the desk';
    if (J.state === 'taken') return 'Start the job: ' + faultOf(J.car).job;
    if (J.state === 'fixing') return 'Working: ' + faultOf(J.car).job + ' · ' + Math.round(J.progress * 100) + '%' + (nearCar() ? '' : ' · stay at the car');
    if (J.state === 'done') return 'Fixed. ' + J.car.name + ' pays at the desk';
    return J.car.name + "'s " + J.car.make;
  }
  function carUse() { var J = S.job; if (!J) return; if (J.state === 'taken') fixStart(); else if (J.state === 'waiting') toast(J.car.name + ' is on the way to the desk. Take the job there.', ''); }
  function nearCar() { return !!G.car && dist2(player.x, player.z, G.car.x, G.car.z) < 3.2 * 3.2; }
  // the car arrives on the road from the west, turns into the bay and parks facing the lock-up
  function spawnCar(car) {
    if (G.car) return null;
    car = car || newCar(); S.job = { car: car, state: 'coming', progress: 0, price: faultOf(car).price, day: S.day };
    placeCar(car, -78, ROAD_Z + LANE, 0, 0);
    logEvent(car.name + ' is on the way in a ' + car.make + '.'); hudDirty = true;
    return car;
  }
  function placeCar(car, x, z, yaw, leg) {
    var g = carMesh(car.col); g.userData.dynamic = true; scene.add(g); g.position.set(x, 0, z); g.rotation.y = yaw;
    G.car = { rec: car, g: g, x: x, z: z, yaw: yaw, leg: leg, speed: 0 };
    G.car.hit = hitBox(4.4, 1.5, 2.0, 0, 0.75, 0, { prompt: carPrompt, use: carUse }, g);
  }
  function removeCar() { var C = G.car; if (!C) return; var k = inter.indexOf(C.hit); if (k >= 0) inter.splice(k, 1); scene.remove(C.g); G.car = null; }
  // a straight run to a point at a speed; the car faces where it goes (the mesh's front is +x at yaw 0)
  function moveTo(v, tx, tz, speed, dt) {
    var dx = tx - v.x, dz = tz - v.z, d = Math.sqrt(dx * dx + dz * dz), st = speed * dt; v.speed = speed;
    if (d <= st) { v.x = tx; v.z = tz; return true; }
    v.x += dx / d * st; v.z += dz / d * st; v.yaw = Math.atan2(-dz, dx); return false;
  }
  function tickCars(dt) {
    var C = G.car, J = S.job;
    if (!C) { if (S.time >= OPEN_AT + 0.25 && S.time < LAST_CAR_AT && worldTime >= G.nextCarAt && !J) spawnCar(); return; }
    if (!J) { removeCar(); return; }
    C.speed = 0;
    if (J.state === 'coming') {
      var done = C.leg === 0 ? moveTo(C, BAY.x, ROAD_Z + LANE, 9, dt) : moveTo(C, BAY.x, BAY.z, 3.5, dt);
      if (done) { C.leg++; if (C.leg === 2) { C.yaw = Math.PI / 2; J.state = 'waiting'; sfx('door'); spawnCustomer(J.car); logEvent(J.car.name + ' has parked a ' + J.car.make + ' in the bay.', 'good'); hudDirty = true; } }
    } else if (J.state === 'leaving') {
      var gone = C.leg === 3 ? moveTo(C, BAY.x, ROAD_Z + LANE, 3.5, dt) : moveTo(C, 90, ROAD_Z + LANE, 10, dt);
      if (gone) { C.leg++; if (C.leg === 5) { removeCar(); S.job = null; G.nextCarAt = worldTime + randf(35, 60); hudDirty = true; } }
    }
    if (G.car) { C.g.position.set(C.x, 0, C.z); C.g.rotation.y = C.yaw; var ws = C.g.userData.wheels; if (ws && C.speed) ws.forEach(function (w) { w.rotation.z -= C.speed * dt / 0.33; }); }
  }

  // ── The customer ──────────────────────────────────────────────────
  // one person, on the engine's rig, who walks the route finder's path from the car to the desk and back
  function spawnCustomer(car, atDesk) {
    var g = makeHuman({ name: car.name.replace(/^(Mr|Mrs) /, ''), style: pick(['short', 'long', 'bun', 'cap']) }); scene.add(g);
    var start = atDesk ? deskStand() : { x: G.car.x + 1.7, z: G.car.z }, rec = { x: start.x, z: start.z, yaw: atDesk ? 0 : Math.PI, speed: 1.5, path: [] };
    g.position.set(rec.x, 0, rec.z); g.rotation.y = rec.yaw;
    G.customer = { g: g, rec: rec, walking: false, at: atDesk ? 'desk' : 'car', goal: 'desk', car: car };
    G.customer.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { prompt: customerPrompt, use: customerUse }, g);
    if (!atDesk) { customerGo('desk'); say(g, 'Morning. ' + faultOf(car).symptom); }
  }
  function customerGo(goal) { var c = G.customer; if (!c) return; c.goal = goal; c.walking = true; var to = goal === 'car' ? { x: G.car.x + 1.7, z: G.car.z } : deskStand(); c.rec.path = route({ x: c.rec.x, z: c.rec.z }, to); }
  function removeCustomer() { var c = G.customer; if (!c) return; var k = inter.indexOf(c.hit); if (k >= 0) inter.splice(k, 1); scene.remove(c.g); G.customer = null; G.customerNearDoor = false; }
  function customerPrompt() {
    var J = S.job, c = G.customer; if (!J || !c) return null;
    if (c.walking) return J.car.name + (c.goal === 'desk' ? ' is coming to the desk' : ' is going back to the car');
    if (J.state === 'waiting') return 'Take the job from ' + J.car.name + ': ' + faultOf(J.car).symptom;
    if (J.state === 'taken' || J.state === 'fixing') return J.car.name + ' is waiting for the ' + J.car.make;
    if (J.state === 'done') return 'Take the payment: ' + money(J.price) + ' for ' + faultOf(J.car).job;
    return J.car.name;
  }
  function customerUse() { var J = S.job; if (!J || !G.customer || G.customer.walking) return; if (J.state === 'waiting') takeJob(); else if (J.state === 'done') takePayment(); else if (J.state === 'taken') say(G.customer.g, 'Take your time. Well, not too much.'); }
  function tickCustomer(dt) {
    var c = G.customer; if (!c) return;
    var lo = LO(); G.customerNearDoor = c.walking && Math.abs(c.rec.z - lo.z - LOCKUP.z) < 2.6 && Math.abs(c.rec.x - lo.x) < 3.2;
    if (c.walking) {
      var done = walkAlong(c.rec, c.rec.path, c.rec.speed, dt); c.g.position.set(c.rec.x, 0, c.rec.z); c.g.rotation.y = c.rec.yaw; animateHuman(c.g, dt, done ? 'wait' : 'walk', 1, null, false);
      if (done) { c.walking = false; c.at = c.goal; if (c.goal === 'desk') { c.rec.yaw = Math.PI; say(c.g, S.job && S.job.state === 'waiting' ? 'Hello? Anyone about?' : 'Thanks.'); } else if (c.goal === 'car') { removeCustomer(); if (S.job) { S.job.state = 'leaving'; G.car.leg = 3; logEvent(S.job.car.name + ' drove off in the ' + S.job.car.make + '.'); } } }
    } else animateHuman(c.g, dt, 'wait', 0, player ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false);
  }

  // ── The job ───────────────────────────────────────────────────────
  function takeJob() {
    var J = S.job; if (!J || J.state !== 'waiting') return false;
    J.state = 'taken'; var f = faultOf(J.car); sfx('ok'); toast('Job card: ' + f.job + ' for ' + money(J.price) + '. E at the car starts the work.', 'good'); logEvent('Took the job: ' + f.job + ' on ' + J.car.name + "'s " + J.car.make + '.', 'good');
    if (G.customer) say(G.customer.g, 'Great. I will wait here.'); screenDirtyAll(); hudDirty = true; return true;
  }
  function fixStart() {
    var J = S.job; if (!J || J.state !== 'taken') return false;
    if (!nearCar()) { toast('Get to the car first.', 'bad'); return false; }
    J.state = 'fixing'; J.progress = 0; sfx('click'); toast('Working on ' + faultOf(J.car).job + '. Stay at the car.', ''); screenDirtyAll(); hudDirty = true; return true;
  }
  // the work counts up only while you stand at the car: a job is a few seconds of clanking, longer for the bigger ones
  function fixTick(dt) {
    var J = S.job; if (!J || J.state !== 'fixing' || !nearCar()) return;
    var f = faultOf(J.car); J.progress = Math.min(1, J.progress + dt / f.secs);
    if (worldTime - (G.lastClank || 0) > 0.8) { G.lastClank = worldTime; sfx(Math.random() < 0.5 ? 'crate' : 'putdown'); }
    if (J.progress >= 1) { J.state = 'done'; sfx('bell'); toast('Fixed: ' + f.job + '. Take the payment at the desk.', 'good'); logEvent('Fixed ' + f.job + ' on the ' + J.car.make + '.', 'good'); S.stats.fixed++; addXp(10); screenDirtyAll(); }
    hudDirty = true;
  }
  function takePayment() {
    var J = S.job; if (!J || J.state !== 'done') return false;
    var f = faultOf(J.car); pay(J.price, f.job + ' for ' + J.car.name); S.stats.jobs++; S.rep = Math.min(100, S.rep + 1);
    S.done.unshift({ day: S.day, t: fmtTime(S.time), name: J.car.name, make: J.car.make, job: f.job, price: J.price }); if (S.done.length > 30) S.done.pop();
    sfx('cash'); toast(J.car.name + ' paid ' + money(J.price) + '.', 'good'); logEvent(J.car.name + ' paid ' + money(J.price) + ' for ' + f.job + '.', 'good');
    J.state = 'paid'; if (G.customer) { say(G.customer.g, 'Lovely, thanks. See you next time.'); customerGo('car'); } else { J.state = 'leaving'; if (G.car) G.car.leg = 3; }
    addXp(15); screenDirtyAll(); hudDirty = true; return true;
  }
  // the ladder: a level every so many points, as in the bigger games; the lock-up has four levels before the plan's next building
  function xpFor(level) { return 40 + level * 20; }
  function addXp(n) { S.xp += n; while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; sfx('levelup'); toast('Level ' + S.level + '.', 'rare'); logEvent('Level ' + S.level + '. Word is getting round.', 'good'); } hudDirty = true; }
  // the day: an hour a minute from eight; the lock-up shuts at six and the next morning starts at eight
  function tickTime(dt) {
    S.time += dt / 60; hudDirty = hudDirty || Math.floor(S.time * 60) !== G.lastMin; G.lastMin = Math.floor(S.time * 60);
    if (S.time >= CLOSE_AT) { S.day++; S.time = OPEN_AT; S.stats.days++; logEvent('Day ' + S.day + '. The garage opens at eight.', ''); if (!S.job) G.nextCarAt = worldTime + 10; save(); hudDirty = true; }
  }
  // a saved job comes back as it was: the car in the bay, the customer at the desk; a car still on the road, or already paid, is let go
  function restoreJob() {
    var J = S.job; if (!J) return;
    if (J.state === 'coming' || J.state === 'leaving' || J.state === 'paid') { S.job = null; return; }
    placeCar(J.car, BAY.x, BAY.z, Math.PI / 2, 2); spawnCustomer(J.car, true);
  }
  // the job card screen on the bench
  function drawJobCard(c, sc) {
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'JOB CARD', 'Day ' + S.day);
    var J = S.job;
    if (!J) { scText(c, 16, 70, 'No car in. The next one is on its way.', '#a0acb8'); scText(c, 16, 100, S.stats.jobs + ' jobs done, ' + money(S.stats.earned) + ' taken.', '#a0acb8'); return; }
    var f = faultOf(J.car);
    scText(c, 16, 70, J.car.make + ' · ' + J.car.plate, '#eef1f5', 16); scText(c, 16, 92, J.car.name + ': ' + f.symptom, '#a0acb8', 13);
    scText(c, 16, 122, J.state === 'waiting' ? 'Customer coming to the desk' : J.state === 'taken' ? 'Job: ' + f.job : J.state === 'fixing' ? 'Working: ' + Math.round(J.progress * 100) + '%' : J.state === 'done' ? 'Fixed: take ' + money(J.price) + ' at the desk' : 'Paid. ' + J.car.name + ' is leaving.', J.state === 'done' ? '#5fd38d' : '#f5b53d', 15);
    scText(c, 16, 150, 'Price ' + money(J.price) + ' · about ' + f.secs + ' seconds of work', '#a0acb8', 13);
    if (J.state === 'waiting' && G.customer && !G.customer.walking) scButton(sc, 16, 180, 160, 40, 'Take the job', true, takeJob);
    if (J.state === 'done' && G.customer && !G.customer.walking) scButton(sc, 16, 180, 180, 40, 'Take the payment', true, takePayment);
  }
  // the same switch the chain throws (01-garage.js): the door rides up while S.doorOpen is set, or while a customer walks through
  function rollDoorToggle() { S.doorOpen = !S.doorOpen; sfx(S.doorOpen ? 'unlock' : 'lock'); hudDirty = true; screenDirtyAll(); }
  function jobLine() {
    var j = S.job; if (!j) return 'No job. The next car comes when it comes.';
    var who = j.car && j.car.model ? j.car.model : 'A car';
    return { coming: who + ' is on its way in.', waiting: who + ' waits at the desk: take the job.', taken: who + ' is in the bay: find the fault.', fixing: who + ': fixing it.', done: who + ' is fixed: the customer pays at the till.', paid: who + ' is paid up; it can leave.', leaving: who + ' is leaving.' }[j.state] || (who + ': ' + j.state);
  }
  defProp('rollPanel', { label: 'roll door panel', cat: 'lockup', wall: true, x: LOCKUP.doorW / 2 + 1.1, z: LOCKUP.z - 0.14, rot: 2, desc: 'The screen beside the roll door: open and close it, see the job.', build: function (c) {
    c.box(0.08, 0.08, 0.1, MAT.steelDark, 0, 1.55, 0.05); c.box(0.78, 0.5, 0.04, MAT.black, 0, 1.55, 0.12);   /* the bracket and the housing */
    touchScreen({ w: 400, h: 250, pw: 0.72, ph: 0.45, x: 0, y: 1.55, z: 0.145, parent: c.group, title: 'Roll door', draw: function (ctx, sc) {
      scBg(ctx, sc.w, sc.h, S.doorOpen ? '#2a7a4a' : undefined); scHead(ctx, sc.w, 'ROLL DOOR', S.doorOpen ? 'OPEN' : 'CLOSED');
      scButton(sc, 16, 62, 170, 46, S.doorOpen ? 'Close the door' : 'Open the door', true, rollDoorToggle);
      scText(ctx, 200, 92, G.customerNearDoor ? 'someone is at the door' : (S.doorOpen ? 'the way is clear' : 'the way is shut'), null, 13);
      scText(ctx, 16, 150, jobLine(), null, 14); scText(ctx, 16, 178, 'Day ' + S.day + ' · ' + (S.stats ? S.stats.jobs : 0) + ' jobs done · rep ' + S.rep, null, 13);
      if (S.job && S.job.price) scText(ctx, 16, 206, 'This job pays ' + money(S.job.price), '#f5b53d', 14);
    } });
  } });
  // ── The shell ─────────────────────────────────────────────────────
  GAME.hud = function () {
    var j = $('h-jobs'); if (j) j.textContent = S.stats.jobs + (S.stats.jobs === 1 ? ' job' : ' jobs');
    var r = $('h-rep'); if (r) r.textContent = 'rep ' + S.rep;
    var l = $('h-level'); if (l) l.textContent = 'Level ' + S.level + ' · ' + S.xp + '/' + xpFor(S.level);
  };
  GAME.panel = function (kind) {
    if (kind !== 'jobs') return null;
    var J = S.job, h = '';
    if (J) { var f = faultOf(J.car); h += '<div class="dc-card"><div class="body"><b>' + esc(J.car.make) + ' · ' + esc(J.car.plate) + '</b><small>' + esc(J.car.name) + ': ' + esc(f.symptom) + '</small><small>' + esc(J.state === 'waiting' ? 'the customer is coming to the desk' : J.state === 'taken' ? 'job card open: ' + f.job : J.state === 'fixing' ? 'working, ' + Math.round(J.progress * 100) + '%' : J.state === 'done' ? 'fixed, the payment waits at the desk' : 'paid, leaving') + '</small></div><div style="text-align:right"><div class="price">' + money(J.price) + '</div>' + (J.state === 'waiting' && G.customer && !G.customer.walking ? btn('take', '', 'Take the job', 'primary') : J.state === 'done' && G.customer && !G.customer.walking ? btn('pay', '', 'Take the payment', 'primary') : '') + '</div></div>'; }
    else h += '<p class="dc-sub">No car in. The next one is on its way between a quarter past eight and five.</p>';
    h += '<h3>Done</h3>' + (S.done.length ? '<table class="dc-table"><tr><th>Day</th><th>Time</th><th>Customer</th><th>Car</th><th>Job</th><th>Paid</th></tr>' + S.done.map(function (d) { return '<tr><td>' + d.day + '</td><td>' + esc(d.t) + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.make) + '</td><td>' + esc(d.job) + '</td><td>' + money(d.price) + '</td></tr>'; }).join('') + '</table>' : '<p class="dc-sub">Nothing yet.</p>');
    return { title: 'The clipboard', tabs: [], body: h };
  };
  GAME.panelAct = function (act) { if (act === 'take') { takeJob(); renderPanel(); return true; } if (act === 'pay') { takePayment(); renderPanel(); return true; } return false; };
  GAME.statsHtml = function () { return '<h3>The books</h3><p>Day ' + S.day + ' · ' + money(S.bank) + ' in the bank · ' + S.stats.jobs + ' jobs · ' + money(S.stats.earned) + ' taken · rep ' + S.rep + '</p>' + GAME.panel('jobs').body; };
  GAME.menuLine = function () { return 'The garage waits until you come back.'; };
  GAME.saveLooksRight = function (s) { return typeof s.bank === 'number' && s.stats && typeof s.stats.jobs === 'number'; };
  GAME.guideHtml = function () {
    return '<h3>The lock-up</h3><p>You run a one-bay garage on the edge of town. A car pulls onto the forecourt, the customer walks to the desk and tells you what it does. <kbd>E</kbd> on the customer takes the job, <kbd>E</kbd> at the car starts the work (stay at the car until it is done), <kbd>E</kbd> on the customer again takes the payment. The car drives off and the next one is due.</p>' +
      '<h3>Controls</h3><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> use · <kbd>Esc</kbd> pause · <kbd>F2</kbd> build mode (<kbd>C</kbd> the catalogue) · <kbd>F9</kbd> photo mode · <kbd>F12</kbd> screenshot · <kbd>F3</kbd> FPS</p>' +
      '<h3>The roll door</h3><p>Pull the chain by the roll door to open it. A customer has it opened for them as they walk in.</p>' +
      '<h3>What comes next</h3><p>The plan in docs/PLAN.md: the reader and the parts rack, the lift, the two-bay garage, staff, the town. This room is where it starts.</p>';
  };
  GAME.commands = {
    car: function () { if (G.car) return 'a car is in already'; var c = spawnCar(); return c ? c.name + ' coming in a ' + c.make : 'no car'; },
    park: function () { if (!S.job || S.job.state !== 'coming') return 'no car on the road'; G.car.x = BAY.x; G.car.z = BAY.z; G.car.leg = 1; return 'parked'; },
    fix: function () { var J = S.job; if (!J) return 'no job'; if (J.state === 'waiting') takeJob(); if (J.state === 'taken' || J.state === 'fixing') { J.state = 'done'; J.progress = 1; S.stats.fixed++; screenDirtyAll(); } return 'job ' + J.state; },
    leave: function () { if (!S.job) return 'no car'; removeCustomer(); removeCar(); S.job = null; G.nextCarAt = worldTime + 5; return 'gone'; },
    rep: function (n) { S.rep = clamp(Math.round(typeof n === 'number' ? n : 50), 0, 100); hudDirty = true; return 'rep ' + S.rep; },
    level: function () { addXp(xpFor(S.level) - S.xp); return 'level ' + S.level; }
  };
  GAME.devState = function () { return { rep: S.rep, xp: S.xp, jobs: S.stats.jobs, job: S.job ? S.job.state + ' ' + S.job.car.make : null, customer: G.customer ? (G.customer.walking ? 'walking to the ' + G.customer.goal : 'at the ' + G.customer.at) : null, doorOpen: !!S.doorOpen }; };

  // ── Boot ──────────────────────────────────────────────────────────
  GAME.handle = 'GARAGE'; GAME.versionGlobal = 'GARAGE_VERSION';
  GAME.freshState = function () { return { day: 1, time: OPEN_AT, bank: 400, rep: 10, level: 1, xp: 0, doorOpen: false, job: null, done: [], stats: { earned: 0, spent: 0, jobs: 0, fixed: 0, days: 0 }, log: [], ledger: [], layout: {}, custom: [], hdoors: {} }; };
  GAME.migrate = function (s) { if (!s.stats.jobs) s.stats.jobs = s.stats.jobs || 0; return s; };
  GAME.afterBuild = function (loaded) { restoreJob(); G.rollT = S.doorOpen ? 1 : 0; if (G.rollPanel) { var sy = 1 - G.rollT * 0.94; G.rollPanel.scale.y = sy; G.rollPanel.position.y = LOCKUP.doorH - (LOCKUP.doorH * sy) / 2; } if (!loaded) S.time = 10; };
  GAME.startStats = function (loaded) { return loaded ? ['Day ' + S.day, 'Level ' + S.level, money(S.bank), S.stats.jobs + ' jobs', 'rep ' + S.rep] : ['New garage', 'The lock-up', money(400), 'one bay, a jack, a tool wall']; };
  GAME.startNote = function (loaded) { return loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first car is due at a quarter past eight'; };
  GAME.onEnter = function (loaded) { if (!loaded) { S.time = OPEN_AT; logEvent('Welcome to Garage Co. This is your lock-up. Pull the chain to open the roll door; the first car is due at a quarter past eight.', 'rare'); save(); } else logEvent('Back at the garage. Day ' + S.day + ', ' + fmtTime(S.time) + '.'); G.nextCarAt = worldTime + 12; };
  GAME.menuCamera = function (dt) { var t = worldTime * 0.05; camera.position.set(9 + Math.sin(t) * 2.5, 2.4, 13 + Math.cos(t) * 1.5); camera.lookAt(0, 1.6, LOCKUP.z - 1); };
  GAME.tick = function (dt) { tickTime(dt); tickCars(dt); tickCustomer(dt); fixTick(dt); };
  GAME.present = function (dt) { tickRoll(dt); };
  GAME.hiddenTick = function (dt) { tickRoll(dt); };
  GAME.T = function () {
    return { GAME: GAME, G: G, traffic: traffic, FAULTS: FAULTS, LOCKUP: LOCKUP, FORECOURT: FORECOURT, BAY: BAY, DESK: DESK, DESK_STAND: DESK_STAND, ROAD_Z: ROAD_Z, inLockup: inLockup, inForecourt: inForecourt, inDoorway: inDoorway, LO: LO, deskStand: deskStand, faultOf: faultOf,
      newCar: newCar, spawnCar: spawnCar, removeCar: removeCar, placeCar: placeCar, spawnCustomer: spawnCustomer, removeCustomer: removeCustomer, restoreJob: restoreJob, takeJob: takeJob, fixStart: fixStart, takePayment: takePayment, addXp: addXp, xpFor: xpFor, tickRoll: tickRoll,
      car: function () { return G.car; }, customer: function () { return G.customer; }, carPrompt: carPrompt, customerPrompt: customerPrompt, drawJobCard: drawJobCard };
  };
  CO.boot(GAME);
})();
