//@ Garage Co., part 01: the lock-up. The game's tables, the engine setup, the building, the forecourt and the props.
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
  function inLockup(x, z, m) { m = m || 0; return Math.abs(x) < LOCKUP.x - m && Math.abs(z) < LOCKUP.z - m; }
  function inForecourt(x, z, m) { m = m || 0; return Math.abs(x) < FORECOURT.x - m && z > FORECOURT.z0 + m && z < FORECOURT.z1 - m; }
  function inDoorway(x, z) { return Math.abs(x) < LOCKUP.doorW / 2 - 0.2 && Math.abs(z - LOCKUP.z) < 0.6; }
  function faultOf(car) { return FAULTS.filter(function (f) { return f.id === car.fault; })[0] || FAULTS[0]; }
  GAME.floorY = function () { return 0; };
  // the plot around the lock-up: the ground you may walk on and where the editor may stand things. The forecourt can be widened and
  // the fence moved out in the editor, so the plot reaches well past both; walls and fences still stop you through their solids
  var PLOT = { x: FORECOURT.x + 24, z0: -LOCKUP.z - 12, z1: ROAD_Z + 4 };
  GAME.insideWalk = function (x, z) { if (inLockup(x, z, 0.35) || inDoorway(x, z)) return true; if (inLockup(x, z, -0.45)) return false; return Math.abs(x) < PLOT.x && z > PLOT.z0 && z < PLOT.z1; };
  GAME.indoors = function (x, z) { return inLockup(x, z); };
  GAME.roofAt = function (x, z) { return inLockup(x, z) ? LOCKUP.h + 0.3 : 0; };
  GAME.wallPlanes = function () { var X = LOCKUP.x, Z = LOCKUP.z; return [{ a: 'x', v: -X + 0.17, n: 1, z0: -Z, z1: Z }, { a: 'x', v: X - 0.17, n: -1, z0: -Z, z1: Z }, { a: 'z', v: -Z + 0.17, n: 1, x0: -X, x1: X }, { a: 'z', v: Z - 0.17, n: -1, x0: -X, x1: X }]; };
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
    // the lock-up: a slab, block walls (the roll door opening in the south wall, the side door in the east wall), a roof and two skylights
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
    [[-2.5, -1.5], [2.5, 1.5]].forEach(function (p) { highBay(p[0], H - 0.95, p[1], H); var l = new THREE.PointLight(0xffeacc, 0.6, 14, 2); l.position.set(p[0], H - 1.2, p[1]); scene.add(l); G.lamps.push(l); });
    // the side door, hinged, with a window; the roll door, a corrugated panel that rolls into a box over the lintel (E on the chain)
    G.sideDoor = hingedDoor('side', X, 1.6, false, 'the side door', { window: true });
    G.roll = new THREE.Group(); G.roll.userData.dynamic = true; G.roll.position.set(0, 0, Z); scene.add(G.roll);
    G.rollPanel = box(DW, DH, 0.08, MAT.door, 0, DH / 2, 0, G.roll); G.rollPanel.castShadow = false;
    box(0.12, DH + 0.1, 0.2, MAT.steelDark, -DW / 2 - 0.06, (DH + 0.1) / 2, Z); box(0.12, DH + 0.1, 0.2, MAT.steelDark, DW / 2 + 0.06, (DH + 0.1) / 2, Z); box(DW + 0.4, 0.42, 0.46, MAT.steelDark, 0, DH + 0.24, Z - 0.3);
    cyl(0.012, 1.3, MAT.chrome, DW / 2 + 0.35, 1.55, Z - 0.22, null, 6);
    hitBox(0.4, 1.4, 0.4, DW / 2 + 0.35, 1.5, Z - 0.22, { prompt: function () { return (S.doorOpen ? 'Pull the chain: close' : 'Pull the chain: open') + ' the roll door'; }, use: function () { S.doorOpen = !S.doorOpen; sfx(S.doorOpen ? 'unlock' : 'lock'); hudDirty = true; } });
    sign(['GARAGE CO.'], 4.2, 0.9, 0, H + 0.75, Z + 0.22, 0, { bg: '#1b232c' });
    // the forecourt: two trees, a lamp post, the sky, the road's traffic. The fence down both sides is made of fence section props
    // (placed in src/00-layout.js), so it moves, goes and grows in the editor like anything else
    tree(-20, 10, 1.2); tree(21, 18, 0.9); tree(-9, -8, 1.0); lampPost(12, 6, 0, 5);
    buildSky({ clouds: 6, rainN: 2500, snowN: 1200 });
    traffic.x0 = -90; traffic.x1 = 90; trafficAdd(ROAD_Z + LANE, 1, 9); trafficAdd(ROAD_Z - LANE, -1, 8);
    buildProps();
    navSetup({ x0: -FORECOURT.x - 2, z0: -LOCKUP.z - 2, width: 2 * FORECOURT.x + 4, depth: ROAD_Z + 6 + LOCKUP.z, cell: 0.4 });
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
