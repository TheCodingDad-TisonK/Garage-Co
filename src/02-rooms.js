//@ Garage Co., part 02: more room and the upgrades. The tyre corner and the stores shed are bought on the PC and stand on the forecourt as props you can move in build mode; tools and the faster jack are bought the same way.
  // ── What the shop owns ────────────────────────────────────────────
  // owns(key): a room, a tool or an upgrade. The rooms are custom props (S.custom), so build mode moves them like anything else
  var UPGRADES = [
    { id: 'shed', name: 'Stores shed', desc: 'A lean-to with shelving on the forecourt: room for 40 more parts.', price: 900, lvl: 2, room: 'gcShed' },
    { id: 'tyre', name: 'Tyre corner', desc: 'A canopy with the water tank and the air line: puncture repairs.', price: 1200, lvl: 2, room: 'gcTyre' },
    { id: 'fastjack', name: 'Fast trolley jack', desc: 'Pumps the car up and down in half the time.', price: 400, lvl: 2 },
    { id: 'socket', name: 'Spark plug socket', desc: 'For the tool wall: spark plug jobs.', price: 120, lvl: 3, tool: 'socket' },
    { id: 'tyremachine', name: 'Tyre machine and balancer', desc: 'In the tyre corner: new tyres.', price: 1500, lvl: 5, after: 'tyre' }
  ];
  function owns(k) { return !!(S && S.up && S.up[k]) || toolOwned(k); }
  function upgradeById(id) { return UPGRADES.filter(function (u) { return u.id === id; })[0] || null; }
  function canBuy(u) { if (owns(u.id)) return 'owned'; if (S.level < u.lvl) return 'level ' + u.lvl; if (u.after && !owns(u.after)) return 'needs the ' + upgradeById(u.after).name.toLowerCase(); if (S.bank < u.price) return money(u.price); return ''; }
  function buyUpgrade(id) {
    var u = upgradeById(id); if (!u) return 'no such thing'; var why = canBuy(u); if (why) return why;
    pay(-u.price, u.name); S.up[u.id] = true; if (u.tool) { S.tools[u.tool] = true; toolWallSync(); }
    if (u.room) roomPlace(u); if (u.id === 'tyremachine') roomRebuild('gcTyre');
    sfx('cash'); toast('Bought: ' + u.name + '.' + (u.room ? ' It stands on the forecourt; F2 moves it.' : ''), 'good'); logEvent('Bought the ' + u.name.toLowerCase() + ' for ' + money(u.price) + '.', 'good');
    stockDraw(); screenDirtyAll(); hudDirty = true; return '';
  }
  // the room goes where the definition says, on the forecourt beside the lock-up, as the player's own copy
  function roomPlace(u) { var d = PROPS[u.room], o = LO(); if (S.custom.some(function (c) { return c.type === u.room; })) return; var c = { id: 'gc-' + u.id, type: u.room, x: d.x + o.x - 0.5, z: d.z + o.z + 2, rot: d.rot || 0, h: 0 }; S.custom.push(c); buildProp(c.id); NAV.dirty = true; }
  function roomInst(type) { var c = S.custom.filter(function (k) { return k.type === type; })[0]; return c ? propInst[c.id] : null; }
  function roomRebuild(type) { var c = S.custom.filter(function (k) { return k.type === type; })[0]; if (c) buildProp(c.id); }
  function nearTyre(r) { var I = roomInst('gcTyre'); if (!I) return false; return dist2(player.x, player.z, I.g.position.x, I.g.position.z) < r * r; }
  function tyreSpot() { var I = roomInst('gcTyre'); return I ? { x: I.g.position.x, z: I.g.position.z + 1.4 } : null; }

  // ── The tyre corner ───────────────────────────────────────────────
  // a canopy on four posts: the water tank to find the hole, the air line on its reel, a bench, and once bought the tyre machine and the
  // wheel balancer. E at the bench does the tyre steps of the job whose wheel you carry
  defProp('gcTyre', { extra: true, shop: false, label: 'tyre corner', cat: 'yard', yard: true, x: -8.5, z: 5.0, rot: 0, desc: 'The tyre corner: water tank, air line and bench under a canopy.', build: function (c) {
    [[-1.9, -1.1], [1.9, -1.1], [-1.9, 1.1], [1.9, 1.1]].forEach(function (p) { c.box(0.1, 2.6, 0.1, MAT.steelDark, p[0], 1.3, p[1]); });
    c.box(4.2, 0.08, 2.6, std({ color: 0x2c5f9e, roughness: 0.6 }), 0, 2.64, 0); c.sign(['TYRES'], 1.4, 0.36, 0, 2.38, 1.31, 0, { bg: '#1b232c' });
    c.box(1.8, 0.85, 0.7, MAT.steelDark, -0.9, 0.42, -0.55); c.box(1.84, 0.05, 0.74, MAT.wood, -0.9, 0.87, -0.55);
    c.box(0.9, 0.55, 0.6, MAT.blue, 0.9, 0.28, -0.6); c.plane(0.82, 0.52, std({ color: 0x5fa8d3, roughness: 0.1, transparent: true, opacity: 0.7 }), 0.9, 0.5, -0.6, -Math.PI / 2);
    var reel = c.cyl(0.22, 0.1, MAT.red, 1.85, 1.5, -1.0, 16); reel.rotation.x = Math.PI / 2; c.cyl(0.01, 1.2, MAT.black, 1.6, 0.9, -0.9, 6);
    if (owns('tyremachine')) { c.box(0.7, 0.9, 0.7, MAT.red, -1.4, 0.45, 0.4); c.cyl(0.32, 0.06, MAT.steel, -1.4, 0.93, 0.4, 20); c.box(0.6, 1.0, 0.5, MAT.blue, -0.4, 0.5, 0.5); c.cyl(0.04, 0.3, MAT.chrome, -0.4, 1.0, 0.75, 8).rotation.x = Math.PI / 2; c.solid(-1.8, 0.0, 0.05, 0.8, 0, 1.1); }
    var dg = c.dynGroup(); G.tyreWheel = new THREE.Group(); dg.add(G.tyreWheel); G.tyreWheel.position.set(-0.9, 1.22, -0.55); var t = cyl(0.33, 0.22, MAT.rubber, 0, 0, 0, G.tyreWheel, 20); t.rotation.x = Math.PI / 2; cyl(0.2, 0.225, MAT.chrome, 0, 0, 0, G.tyreWheel, 16).rotation.x = Math.PI / 2; G.tyreWheel.visible = false;
    c.hit(3.6, 1.4, 1.2, 0, 0.8, -0.6, { prompt: function () { return tyrePrompt(); }, use: function () { tyreUse(); } });
    c.solid(-1.8, 1.4, -0.95, -0.2, 0, 1.0); [[-1.9, -1.1], [1.9, -1.1], [-1.9, 1.1], [1.9, 1.1]].forEach(function (p) { c.solid(p[0] - 0.06, p[0] + 0.06, p[1] - 0.06, p[1] + 0.06, 0, 2.6); });
  } });
  // ── The stores shed ───────────────────────────────────────────────
  // a lean-to with an open front and shelving along its back: room for 40 more parts. E at the shelves works like the parts rack
  defProp('gcShed', { extra: true, shop: false, label: 'stores shed', cat: 'yard', yard: true, x: -4.6, z: 4.4, rot: 0, desc: 'A lean-to with shelving: room for 40 more parts.', build: function (c) {
    var wall = std({ color: 0x7a8691, roughness: 0.9 });
    c.box(3.0, 2.5, 0.08, wall, 0, 1.25, -0.9); c.box(0.08, 2.5, 1.8, wall, -1.5, 1.25, 0); c.box(0.08, 2.5, 1.8, wall, 1.5, 1.25, 0);
    var roof = c.box(3.3, 0.06, 2.2, MAT.roof, 0, 2.6, 0); roof.rotation.x = 0.08; c.sign(['STORES'], 1.1, 0.3, 0, 2.3, 0.92, 0, { bg: '#1b232c' });
    [-1.35, 0, 1.35].forEach(function (x) { c.box(0.04, 2.2, 0.5, MAT.rack, x, 1.1, -0.6); }); [0.3, 0.9, 1.5, 2.08].forEach(function (y) { c.box(2.8, 0.04, 0.5, MAT.steel, 0, y, -0.6); });
    G.shedBoxes = c.dynGroup(); G.shedBoxes.position.set(0, 0, -0.6); stockDraw();
    c.hit(2.8, 2.0, 0.6, 0, 1.1, -0.55, { prompt: function () { return rackPrompt(); }, use: function () { rackUse(); } });
    c.solid(-1.55, 1.55, -0.95, -0.3, 0, 2.5); c.solid(-1.55, -1.45, -0.95, 0.9, 0, 2.5); c.solid(1.45, 1.55, -0.95, 0.9, 0, 2.5);
  } });
  // the wheel on the tyre bench while a tyre step is the next one
  function tyreWheelSync() { if (!G.tyreWheel) return; var b = tyreJob(), J = b >= 0 ? jobAt(b) : null; G.tyreWheel.visible = !!(J && ((S.hand && S.hand.kind === 'wheel' && S.hand.bay === b) || (J.assign && staffById(J.assign)))); }
