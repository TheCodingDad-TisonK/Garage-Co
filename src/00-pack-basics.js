//@ Co Engine pack: basics. Props every game can use, built from the engine's kit alone: a control panel with a touch screen, a gate and a boom barrier that open and close (from their own screen or by hand), a lever, signs, crates, a pallet, a bench, a bin, a cone, a lamp post, a fence section, a planter. The editor copies this file into a game as src/00-pack-basics.js; place the props from Assets. They are extras the catalogue does not sell (shop: false); what you place ships through the layout.
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
