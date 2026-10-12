//@ Garage Co., part 01: the lock-up. The game's tables, the engine setup, the building, the forecourt and the props.
  // ── Garage Co. ────────────────────────────────────────────────────
  // The first room of the game: a lock-up on the edge of town with a roll door onto a small forecourt. Cars come in off the road,
  // the customer walks to the desk, you take the job, fix the car in the bay and take the payment. Everything else in docs/PLAN.md
  // builds on this room. GAME carries the hooks for the engine (CO.game); G holds the live things that are not state (meshes, timers).
  var GAME = {}, G = { lamps: [], rollT: 0, roll2T: 0, nextCarAt: 0, customerNearDoor: false, bays: [], staff: {}, hold: null };
  var LOCKUP = { x: 5, z: 4, h: 3.6, doorW: 3.2, doorH: 3.0 };                 // half sizes: a 10 by 8 m lock-up, 3.6 m to the roof
  var HALL2 = { x0: 5, x1: 15, z0: -4, z1: 4, doorX: 9 };                      // the two-bay garage (level 5): a second hall off the lock-up's east wall, in the lock-up's own frame
  var FORECOURT = { x: 16, z0: LOCKUP.z, z1: 22 }, ROAD_Z = 25, LANE = 1.6;      // the forecourt in front of the roll door, the road past it
  var BAY = { x: 5, z: 12 }, DESK = { x: -3.2, z: -2.6 }, DESK_STAND = { x: -3.2, z: -1.0 };   // where a car parks, where the desk stands, where a customer waits
  var BAYS = [BAY, { x: 9.5, z: 12 }];                                          // the forecourt bays: the second is marked out when the garage grows
  var ENTRY_X = 0.2, APRON_Z = 17;                                              // cars come in through the gap in the bollards and turn along the apron to their bay
  var OPEN_AT = 8, CLOSE_AT = 18, LAST_CAR_AT = 17;                              // the day: cars arrive from a quarter past eight to five
  // the parts the supplier sells: what it costs you, what it goes on the invoice for, the level it comes into the catalogue
  var PARTS = {
    oil: { name: '5 L of oil', cost: 18, sell: 30, lvl: 1, col: 0xd8a52a },
    oilfilter: { name: 'oil filter', cost: 6, sell: 12, lvl: 1, col: 0x2c5f9e },
    pads: { name: 'brake pad set', cost: 22, sell: 45, lvl: 1, col: 0xb8322a },
    bulb: { name: 'headlight bulb', cost: 2, sell: 6, lvl: 1, col: 0xeeeeee },
    battery: { name: 'battery', cost: 55, sell: 95, lvl: 1, col: 0x2a2d33 },
    wipers: { name: 'wiper blade pair', cost: 8, sell: 18, lvl: 2, col: 0x4f6a3a },
    plugkit: { name: 'puncture plug kit', cost: 3, sell: 10, lvl: 2, col: 0xe0a02a },
    airfilter: { name: 'air filter', cost: 7, sell: 15, lvl: 3, col: 0xf3efe4 },
    plugs: { name: 'set of four spark plugs', cost: 12, sell: 26, lvl: 3, col: 0x7a8691 },
    coolant: { name: 'coolant', cost: 8, sell: 16, lvl: 4, col: 0x5fd3b0 },
    tyre: { name: 'tyre', cost: 45, sell: 80, lvl: 5, col: 0x1a1a1a },
    exhaust: { name: 'exhaust section', cost: 60, sell: 110, lvl: 5, col: 0x8a8a8a },
    discs: { name: 'brake disc pair', cost: 40, sell: 80, lvl: 6, col: 0x6a6f75 }
  };
  CO.table('PARTS', PARTS, 'the supplier catalogue: what a part costs you, what it sells for on the invoice, the level it opens');
  // the faults a car can have, opened by level: the job, its short name on the job card's buttons, the parts, the labour price, and
  // what the shop needs (needs: an upgrade or a tool bought on the PC). The steps of each job are in 02-work.js, the checks that find
  // it there too. What the customer says is a symptom (below), and a symptom can be more than one fault
  var FAULTS = [
    { id: 'oil', short: 'oil change', job: 'an oil and filter change', parts: ['oil', 'oilfilter'], price: 45, lvl: 1 },
    { id: 'brakes', short: 'brake pads', job: 'new front brake pads', parts: ['pads'], price: 70, lvl: 1 },
    { id: 'bulb', short: 'bulb', job: 'a headlight bulb', parts: ['bulb'], price: 12, lvl: 1 },
    { id: 'battery', short: 'battery', job: 'a new battery', parts: ['battery'], price: 25, lvl: 1 },
    { id: 'terminal', short: 'terminal', job: 'a loose battery terminal', parts: [], price: 15, lvl: 1 },
    { id: 'wipers', short: 'wipers', job: 'new wiper blades', parts: ['wipers'], price: 10, lvl: 2 },
    { id: 'puncture', short: 'puncture', job: 'a puncture repair', parts: ['plugkit'], price: 25, lvl: 2, needs: 'tyre' },
    { id: 'airfilter', short: 'air filter', job: 'a new air filter', parts: ['airfilter'], price: 15, lvl: 3 },
    { id: 'plugs', short: 'spark plugs', job: 'new spark plugs', parts: ['plugs'], price: 40, lvl: 3, needs: 'socket' },
    { id: 'coolant', short: 'coolant', job: 'a coolant top-up', parts: ['coolant'], price: 20, lvl: 4 },
    { id: 'newtyre', short: 'new tyre', job: 'a new front tyre', parts: ['tyre'], price: 30, lvl: 5, needs: 'tyremachine' },
    { id: 'exhaust', short: 'exhaust', job: 'a new exhaust section', parts: ['exhaust'], price: 60, lvl: 5 },
    { id: 'discs', short: 'discs and pads', job: 'new front discs and pads', parts: ['discs', 'pads'], price: 90, lvl: 6 }
  ];
  CO.table('FAULTS', FAULTS, 'the faults a car comes in with: the job, the parts, the labour price (price) and the level it opens');   // the editor's Settings tab tunes it
  // what the customer says at the desk, and the faults it could be. Only the faults open at your level count: a symptom with one of
  // them is named at the desk, one with more is a job you find the fault on first (02-work.js, the checks)
  var SYMPTOMS = [
    { id: 'oillight', says: 'The oil light has been on since Tuesday.', faults: ['oil'] },
    { id: 'squeal', says: 'It squeals every time I brake.', faults: ['brakes'] },
    { id: 'brakenoise', says: 'It makes a horrible noise when I brake.', faults: ['brakes', 'discs'] },
    { id: 'headlight', says: 'The left headlight is out.', faults: ['bulb'] },
    { id: 'nostart', says: 'It struggles to start in the mornings.', faults: ['battery', 'terminal', 'plugs'] },
    { id: 'smear', says: 'It smears all over the glass in the rain.', faults: ['wipers'] },
    { id: 'flat', says: 'The front tyre keeps going flat.', faults: ['puncture'] },
    { id: 'tyre', says: 'Something is not right with the front tyre.', faults: ['puncture', 'newtyre'] },
    { id: 'sluggish', says: 'It feels sluggish and it drinks fuel.', faults: ['airfilter', 'plugs'] },
    { id: 'misfire', says: 'It misfires when I pull away.', faults: ['plugs'] },
    { id: 'hot', says: 'It runs hot in traffic.', faults: ['coolant'] },
    { id: 'rattle', says: 'It rattles underneath and it is loud.', faults: ['exhaust'] }
  ];
  CO.table('SYMPTOMS', SYMPTOMS, 'what a customer says at the desk (says) and the faults it could be (faults); two or more open faults make it a job to diagnose');
  var MAKES = ['Harlow Estate', 'Pennant 1.4', 'Kestrel Van', 'Dunmore Coupe', 'Alder Hatch', 'Brampton Saloon'];   // made-up makes, in the house look
  var NAMES = ['Mrs Okafor', 'Dan', 'Priya', 'Mr Holt', 'Lena', 'Sam', 'Mr Baptiste', 'Ruth'];
  CO.setup({ canvas: 'co-canvas', save: 'garageco', game: GAME, spawn: { x: 0, z: -1, yaw: Math.PI }, sun: { box: 40, far: 120, mapSize: 2048, target: [0, 0, 8] }, lightBudget: 8 });

  // ── Where things are ──────────────────────────────────────────────
  // the lock-up is one world item: the editor can move the whole building, and every rule about it (where it is indoors, the roof,
  // the walls, the doorway, where a customer waits) follows it. LO() is how far it stands from where the code built it
  function LO() { var it = G.lockup, b = G.lockBase; return it && b ? { x: it.position.x - b.x, z: it.position.z - b.z } : { x: 0, z: 0 }; }
  function grown() { return !!(S && S.stage >= 2); }
  function inHall2(x, z, m) { if (!grown()) return false; m = m || 0; var o = LO(); x -= o.x; z -= o.z; return x > HALL2.x0 + m && x < HALL2.x1 - m && z > HALL2.z0 + m && z < HALL2.z1 - m; }
  function inLockup(x, z, m) { m = m || 0; var o = LO(); var lx = x - o.x, lz = z - o.z; return (Math.abs(lx) < LOCKUP.x - m && Math.abs(lz) < LOCKUP.z - m) || inHall2(x, z, m); }
  function inForecourt(x, z, m) { m = m || 0; return Math.abs(x) < FORECOURT.x - m && z > FORECOURT.z0 + m && z < FORECOURT.z1 - m; }
  function inDoorway(x, z) { var o = LO(); x -= o.x; z -= o.z; return Math.abs(x) < LOCKUP.doorW / 2 - 0.2 && Math.abs(z - LOCKUP.z) < 0.6; }
  function inDoorway2(x, z) { if (!grown()) return false; var o = LO(); x -= o.x; z -= o.z; return Math.abs(x - HALL2.doorX) < LOCKUP.doorW / 2 - 0.2 && Math.abs(z - LOCKUP.z) < 0.6; }
  function inSideDoor(x, z) { if (!grown()) return false; var o = LO(); x -= o.x; z -= o.z; return Math.abs(x - LOCKUP.x) < 0.6 && Math.abs(z - 2.1) < 0.4; }
  // where a customer stands at the desk: the second one waits a step along
  function deskStand(i) { var o = LO(); return { x: DESK_STAND.x + o.x + (i || 0) * 0.9, z: DESK_STAND.z + o.z + (i || 0) * 0.3 }; }
  function faultById(id) { return FAULTS.filter(function (f) { return f.id === id; })[0] || FAULTS[0]; }
  function faultOf(car) { return faultById(car.fault); }
  // what the car's customer says: its own symptom, or (a car from before 0.4) the first one its fault shows as
  function symptomById(id) { return SYMPTOMS.filter(function (s) { return s.id === id; })[0] || null; }
  function symptomsFor(fid) { return SYMPTOMS.filter(function (s) { return s.faults.indexOf(fid) >= 0; }); }
  function symptomOf(car) { return symptomById(car.sym) || symptomsFor(car.fault)[0] || { id: '', says: 'Something is not right with it.', faults: [car.fault] }; }
  GAME.floorY = function () { return 0; };
  // the plot around the lock-up: the ground you may walk on and where the editor may stand things. The forecourt can be widened and
  // the fence moved out in the editor, so the plot reaches well past both; walls and fences still stop you through their solids
  var PLOT = { x: FORECOURT.x + 24, z0: -LOCKUP.z - 12, z1: ROAD_Z + 4 };
  GAME.insideWalk = function (x, z) { if (inLockup(x, z, 0.35) || inDoorway(x, z) || inDoorway2(x, z) || inSideDoor(x, z)) return true; if (inLockup(x, z, -0.45)) return false; return Math.abs(x) < PLOT.x && z > PLOT.z0 && z < PLOT.z1; };
  GAME.indoors = function (x, z) { return inLockup(x, z); };
  GAME.roofAt = function (x, z) { return inLockup(x, z) ? LOCKUP.h + 0.3 : 0; };
  GAME.wallPlanes = function () {
    var X = LOCKUP.x, Z = LOCKUP.z, o = LO(), w = [{ a: 'x', v: o.x - X + 0.17, n: 1, z0: o.z - Z, z1: o.z + Z }, { a: 'x', v: o.x + X - 0.17, n: -1, z0: o.z - Z, z1: o.z + Z }, { a: 'z', v: o.z - Z + 0.17, n: 1, x0: o.x - X, x1: o.x + X }, { a: 'z', v: o.z + Z - 0.17, n: -1, x0: o.x - X, x1: o.x + X }];
    if (grown()) w.push({ a: 'x', v: o.x + X + 0.17, n: 1, z0: o.z - Z, z1: o.z + Z }, { a: 'x', v: o.x + HALL2.x1 - 0.17, n: -1, z0: o.z - Z, z1: o.z + Z }, { a: 'z', v: o.z - Z + 0.17, n: 1, x0: o.x + HALL2.x0, x1: o.x + HALL2.x1 }, { a: 'z', v: o.z + Z - 0.17, n: -1, x0: o.x + HALL2.x0, x1: o.x + HALL2.x1 });
    return w;
  };
  GAME.editClamp = function (pt) { if (inLockup(pt.x, pt.z)) return { x: pt.x, z: pt.z }; return { x: clamp(pt.x, -PLOT.x + 0.5, PLOT.x - 0.5), z: clamp(pt.z, PLOT.z0 + 0.5, PLOT.z1 - 0.5) }; };
  GAME.stepSurface = function (x, z) { return inLockup(x, z) ? 'floor' : 'outside'; };
  GAME.catalogueGroups = [['garage', '🔧 The workshop'], ['yard', '🌳 The forecourt']];
  // the roll doors are yours to open; while one is down nobody walks through its doorway (a customer has it opened for them)
  GAME.collides = function (x, z) { return (!S.doorOpen && G.rollT < 0.7 && inDoorway(x, z)) || (!S.door2Open && G.roll2T < 0.7 && inDoorway2(x, z)); };
  // people with keys: the customers, and the staff (02-staff.js)
  GAME.doorOpeners = function () {
    var out = []; G.bays.forEach(function (B) { var c = B && B.customer; if (c && c.walking) out.push({ x: c.rec.x, z: c.rec.z }); });
    staffList().forEach(function (w) { var R = G.staff[w.id]; if (R && R.rec.path && R.rec.path.length) out.push({ x: R.rec.x, z: R.rec.z }); });
    return out;
  };

  // ── The building ──────────────────────────────────────────────────
  GAME.buildWorld = function (loaded) {
    var X = LOCKUP.x, Z = LOCKUP.z, H = LOCKUP.h, DW = LOCKUP.doorW, DH = LOCKUP.doorH;
    // the ground: grass to the horizon, the forecourt's asphalt, the road with its centre line and a kerb either side of the entrance
    plane(400, 400, MAT.grass, 0, -0.03, 0, -Math.PI / 2);
    var fc = plane(2 * FORECOURT.x + 2, FORECOURT.z1 - FORECOURT.z0 + 1.2, MAT.yard, 0, 0, (FORECOURT.z0 + FORECOURT.z1) / 2 + 0.6, -Math.PI / 2); fc.receiveShadow = true;
    plane(180, 7.5, MAT.yard, 0, 0, ROAD_Z, -Math.PI / 2); plane(180, 0.12, MAT.whiteLine, 0, 0.004, ROAD_Z, -Math.PI / 2);
    box(FORECOURT.x - 3, 0.12, 0.3, MAT.grey, -(FORECOURT.x + 4) / 2, 0.06, FORECOURT.z1 + 0.75); box(FORECOURT.x - 3, 0.12, 0.3, MAT.grey, (FORECOURT.x + 4) / 2, 0.06, FORECOURT.z1 + 0.75);
    // the bay: two white lines and an end mark; the second bay is marked out once the garage has grown
    box(0.1, 0.02, 5.4, MAT.whiteLine, BAY.x - 1.5, 0.01, BAY.z); box(0.1, 0.02, 5.4, MAT.whiteLine, BAY.x + 1.5, 0.01, BAY.z); box(3.0, 0.02, 0.1, MAT.whiteLine, BAY.x, 0.01, BAY.z - 2.7);
    if (grown()) { var B2 = BAYS[1]; box(0.1, 0.02, 5.4, MAT.whiteLine, B2.x + 1.5, 0.01, B2.z); box(3.0, 0.02, 0.1, MAT.whiteLine, B2.x, 0.01, B2.z - 2.7); sign(['BAY 2'], 1.2, 0.3, B2.x, 0.02, B2.z - 2.2, 0, { bg: '#1b232c' }).rotation.x = -Math.PI / 2; }
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
    buildLift(0);
    }, null);
    if (G.lockup) { G.lockBase = { x: G.lockup.position.x, z: G.lockup.position.z }; G.lockup.userData.movesOnly = true; }   // the rules follow where it stands, not a turn or a new size
    if (G.lockup && grown()) buildHall2();
    // the forecourt: two trees, a lamp post, the sky, the road's traffic. The fence down both sides is made of fence section props
    // (placed in src/00-layout.js), so it moves, goes and grows in the editor like anything else
    tree(-20, 10, 1.2); tree(21, 18, 0.9); tree(-9, -8, 1.0); lampPost(12, 6, 0, 5);
    buildSky({ clouds: 6, rainN: 2500, snowN: 1200 });
    // the road is a lane each way on the engine's road network: road pieces laid off either end join it, and its two cars drive on
    roadLane([[-90, ROAD_Z + LANE], [90, ROAD_Z + LANE]]); roadLane([[90, ROAD_Z - LANE], [-90, ROAD_Z - LANE]]); roadTraffic({ cars: 2, speed: 8.5 });
    buildProps();
    navSetup({ x0: -PLOT.x, z0: PLOT.z0, width: 2 * PLOT.x, depth: PLOT.z1 - PLOT.z0 + 2, cell: 0.4 });
  };
  // ── The two-bay garage ────────────────────────────────────────────
  // At level 5 the lock-up grows east overnight: a second hall the same size, with its own roll door onto bay 2, a parts store along the
  // back wall, an office in the far corner with the second PC, and a waiting corner by the door. The old east wall stays as the wall
  // between the halls and the side door is the way through. It is built into the lock-up's own world item, after the item has been
  // centred, so the item keeps its key and wherever the editor stood the lock-up the new hall stands beside it
  function buildHall2() {
    var g = G.lockup, b = G.lockBase, n0 = solids.length, prev = WORLD_PARENT, X0 = HALL2.x0, X1 = HALL2.x1, Z = LOCKUP.z, H = LOCKUP.h, DW = LOCKUP.doorW, DH = LOCKUP.doorH, cx = (X0 + X1) / 2, W = X1 - X0;
    WORLD_PARENT = g;
    try {
      var bx = function (w, h, d, mat, x, y, z) { return box(w, h, d, mat, x - b.x, y, z - b.z); };
      var sol = function (x0, x1, z0, z1) { solid(x0, x1, z0, z1); };
      var slab = plane(W, 2 * Z, MAT.floor, cx - b.x, 0.01, -b.z, -Math.PI / 2); slab.receiveShadow = true;
      bx(W + 0.3, H, 0.3, MAT.block, cx, H / 2, -Z); sol(X0, X1 + 0.15, -Z - 0.15, -Z + 0.15);
      bx(0.3, H, 2 * Z + 0.3, MAT.block, X1, H / 2, 0); sol(X1 - 0.15, X1 + 0.15, -Z - 0.15, Z + 0.15);
      var d0 = HALL2.doorX - DW / 2, d1 = HALL2.doorX + DW / 2;
      bx(d0 - X0, H, 0.3, MAT.block, (X0 + d0) / 2, H / 2, Z); bx(X1 - d1, H, 0.3, MAT.block, (d1 + X1) / 2, H / 2, Z); bx(DW + 0.4, H - DH, 0.3, MAT.block, HALL2.doorX, DH + (H - DH) / 2, Z);
      sol(X0, d0, Z - 0.15, Z + 0.15); sol(d1, X1 + 0.15, Z - 0.15, Z + 0.15);
      bx(W + 0.6, 0.25, 2 * Z + 0.6, MAT.roof, cx, H + 0.125, 0); plane(W, 2 * Z, MAT.roofIn, cx - b.x, H - 0.01, -b.z, Math.PI / 2);
      // windows high on the long walls: light in, no view of the street at eye height
      [cx - 2.5, cx + 2.5].forEach(function (x) { var sk = plane(1.6, 1.2, MAT.skylight, x - b.x, H - 0.02, -1 - b.z, Math.PI / 2); lampMeshes.push(sk); });
      [cx - 3, cx, cx + 3].forEach(function (x) { bx(1.6, 0.5, 0.06, MAT.skylight, x, H - 0.55, -Z + 0.17); });
      [-1.5, 1.5].forEach(function (z) { bx(W - 0.4, 0.3, 0.2, MAT.steelDark, cx, H - 0.25, z); });
      [[cx - 2.5, -1.5], [cx + 2.5, 1.5]].forEach(function (p) { highBay(p[0] - b.x, H - 0.95, p[1] - b.z, H); var l = new THREE.PointLight(0xffeacc, 0.6, 14, 2); l.position.set(p[0] - b.x, H - 1.2, p[1] - b.z); g.add(l); G.lamps.push(l); });
      // the roll door onto bay 2, on a chain like the first
      G.roll2 = new THREE.Group(); G.roll2.userData.dynamic = true; G.roll2.position.set(HALL2.doorX - b.x, 0, Z - b.z); g.add(G.roll2);
      G.roll2Panel = box(DW, DH, 0.08, MAT.door, 0, DH / 2, 0, G.roll2); G.roll2Panel.castShadow = false;
      bx(DW + 0.4, 0.42, 0.46, MAT.steelDark, HALL2.doorX, DH + 0.24, Z - 0.3);
      hitBox(0.4, 1.4, 0.4, HALL2.doorX + DW / 2 + 0.35 - b.x, 1.5, Z - 0.22 - b.z, { prompt: function () { return (S.door2Open ? 'Pull the chain: close' : 'Pull the chain: open') + ' the bay 2 roll door'; }, use: function () { S.door2Open = !S.door2Open; sfx(S.door2Open ? 'unlock' : 'lock'); hudDirty = true; } });
      sign(['BAY 2'], 1.6, 0.5, HALL2.doorX - b.x, H + 0.55, Z + 0.22 - b.z, 0, { bg: '#1b232c' });
      // the parts store: shelving along the back wall, west half (the stock boxes on it are drawn by 02-stock.js)
      G.store2 = new THREE.Group(); G.store2.position.set(X0 + 2.4 - b.x, 0, -Z + 0.55 - b.z); g.add(G.store2);
      [-1.9, 0, 1.9].forEach(function (x) { box(0.05, 2.2, 0.5, MAT.rack, x, 1.1, 0, G.store2); }); [0.35, 0.95, 1.55, 2.1].forEach(function (y) { box(3.85, 0.04, 0.5, MAT.steel, 0, y, 0, G.store2); });
      sol(X0 + 0.45, X0 + 4.35, -Z + 0.25, -Z + 0.85);
      G.store2Boxes = new THREE.Group(); G.store2Boxes.userData.dynamic = true; G.store2.add(G.store2Boxes);
      hitBox(3.8, 2.0, 0.6, X0 + 2.4 - b.x, 1.1, -Z + 0.6 - b.z, { prompt: function () { return rackPrompt(); }, use: function () { rackUse(); } });
      // the office: two glazed walls in the north-east corner, a door gap, a desk with the second PC (a prop, so it can be moved)
      var ox0 = X1 - 4, oz1 = -0.6;
      bx(0.12, H - 0.4, 3.4 - 1.0, MAT.plaster, ox0, (H - 0.4) / 2, -Z + 1.7 - 0.5); sol(ox0 - 0.06, ox0 + 0.06, -Z, oz1 - 1.0);
      bx(0.12, H - 2.5, 1.0, MAT.plaster, ox0, 2.1 + (H - 2.5) / 2, oz1 - 0.5);
      bx(4.0, 1.0, 0.12, MAT.plaster, X1 - 2, 0.5, oz1); bx(4.0, 0.8, 0.06, MAT.skylight, X1 - 2, 1.4, oz1); bx(4.0, H - 2.2, 0.12, MAT.plaster, X1 - 2, 1.8 + (H - 2.2) / 2, oz1); sol(ox0, X1, oz1 - 0.06, oz1 + 0.06);
      sign(['OFFICE'], 0.9, 0.24, ox0 - 0.07 - b.x, 2.3, -2.8 - b.z, -Math.PI / 2, { bg: '#1b232c' });
      // the waiting corner: two chairs and a coffee machine by the front wall
      [X1 - 2.2, X1 - 1.4].forEach(function (x) { bx(0.5, 0.06, 0.5, MAT.red, x, 0.45, Z - 0.7); bx(0.5, 0.5, 0.06, MAT.red, x, 0.72, Z - 0.45); bx(0.04, 0.45, 0.04, MAT.steelDark, x, 0.22, Z - 0.7); });
      bx(0.5, 1.5, 0.5, MAT.black, X1 - 0.5, 0.75, Z - 0.6); bx(0.36, 0.3, 0.04, glowMat(0xf5b53d, 0.5), X1 - 0.5, 1.15, Z - 0.84);
      sol(X1 - 2.5, X1 - 0.2, Z - 1.0, Z - 0.3);
      // the doorway between the halls is the old side door; its box keeps the lights apart a little
      lineWall('z', -Z, X0, X1, H - 0.4, MAT.plaster, [], 1, { inset: 0.16 }); lineWall('x', X1, -Z, Z, H - 0.4, MAT.plaster, [], -1, { inset: 0.16 });
      buildLift(1, b.x, b.z);
    } finally { WORLD_PARENT = prev; }
    // the solids of the new hall are in the lock-up's frame as built; they join the item's own so an editor move takes them along
    var mine = solids.slice(n0); g.userData.solids = (g.userData.solids || []).concat(mine);
    tickRoll2(1);
  }
  // the roll door rides up into its box while open, or while a customer walks through; the shadow map follows it
  function tickRoll(dt) {
    var want = S.doorOpen || G.customerNearDoor ? 1 : 0;
    tickRoll2(dt);
    if (Math.abs(G.rollT - want) < 0.002) return;
    G.rollT = lerp(G.rollT, want, 1 - Math.pow(0.03, dt)); if (Math.abs(G.rollT - want) < 0.004) G.rollT = want;
    var sy = 1 - G.rollT * 0.94; G.rollPanel.scale.y = sy; G.rollPanel.position.y = LOCKUP.doorH - (LOCKUP.doorH * sy) / 2; shadowDirty = true;
  }
  function tickRoll2(dt) {
    if (!G.roll2Panel) return; var want = S.door2Open || G.customerNearDoor2 ? 1 : 0;
    if (Math.abs(G.roll2T - want) < 0.002 && dt < 1) return;
    G.roll2T = dt >= 1 ? want : lerp(G.roll2T, want, 1 - Math.pow(0.03, dt)); if (Math.abs(G.roll2T - want) < 0.004) G.roll2T = want;
    var sy = 1 - G.roll2T * 0.94; G.roll2Panel.scale.y = sy; G.roll2Panel.position.y = LOCKUP.doorH - (LOCKUP.doorH * sy) / 2; shadowDirty = true;
  }

  // ── The props: the lock-up's fittings, and two extras for the catalogue ──
  var CHROME_RED = std({ color: 0xc8342a, roughness: 0.45, metalness: 0.3 });
  // the tool wall: the hand tools a job asks for hang on it (02-work.js has the list). E takes one off its hook or hangs the one in
  // your hand back; a hook you have taken from shows its painted outline. Tools the shop has not bought yet are not on it
  defProp('toolWall', { label: 'tool wall', cat: 'garage', wall: true, x: 1.5, z: -3.83, rot: 0, build: function (c) {
    c.box(2.4, 1.2, 0.04, MAT.wood, 0, 1.5, 0); for (var i = 0; i < 4; i++) { var x = 0.4 + i * 0.22; c.cyl(0.012, 0.3, MAT.steel, x, 1.75 - (i % 3) * 0.12, 0.05, 6); c.box(0.06, 0.05, 0.03, MAT.rubber, x, 1.62 - (i % 3) * 0.12, 0.05); }
    c.sign(['TOOLS', 'put it back where you found it'], 1.4, 0.3, 0, 2.3, 0.03, 0, { bg: '#1b232c' });
    var dg = c.dynGroup(); G.toolHooks = {};
    TOOL_IDS.forEach(function (t, k) {
      var x = -1.0 + k * 0.28, T = TOOLS[t], hook = new THREE.Group(); hook.position.set(x, 1.5, 0.05); dg.add(hook);
      box(0.2, 0.5, 0.005, std({ color: 0x2a2e34, roughness: 1 }), 0, 0, -0.012, hook);   // the painted outline
      cyl(0.006, 0.05, MAT.steelDark, 0, 0.2, 0.01, hook, 6).rotation.x = Math.PI / 2;      // the peg it hangs from
      var tool = new THREE.Group(); hook.add(tool); tool.add(gcToolMesh(t));
      G.toolHooks[t] = { hook: hook, tool: tool };
      c.hit(0.24, 0.6, 0.12, x, 1.5, 0.06, { prompt: function () { return toolPrompt(t); }, use: function () { toolUse(t); } });
    });
    toolWallSync();
  } });
  defProp('bench', { label: 'workbench', cat: 'garage', x: -3.6, z: 0.6, rot: 1, build: function (c) {
    c.box(2.2, 0.08, 0.8, MAT.wood, 0, 0.9, 0); c.box(2.1, 0.5, 0.7, MAT.steelDark, 0, 0.3, 0); [-0.95, 0.95].forEach(function (x) { c.box(0.08, 0.86, 0.7, MAT.steelDark, x, 0.43, 0); });
    c.box(0.5, 0.25, 0.3, MAT.red, -0.6, 1.07, -0.1); c.box(0.3, 0.1, 0.2, MAT.black, 0.5, 0.99, 0.1); c.solid(-1.1, 1.1, -0.4, 0.4, 0, 1.0);
    // the job card: a small screen on a stand at the bench's end, drawn from the state
    c.box(0.06, 0.5, 0.06, MAT.steelDark, 0.95, 1.2, -0.3);
    G.jobCard = touchScreen({ w: 360, h: 240, pw: 0.6, ph: 0.4, x: 0.95, y: 1.6, z: -0.29, ry: 0, parent: c.group, title: 'Job card', draw: drawJobCard });
  } });
  defProp('desk', { label: 'desk', cat: 'garage', x: DESK.x, z: DESK.z, rot: 0, build: function (c) {
    c.box(1.6, 0.06, 0.8, MAT.wood, 0, 0.78, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, -0.72, 0.38, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, 0.72, 0.38, 0); c.box(0.5, 0.6, 0.6, MAT.steelDark, 0.45, 0.3, 0);
    c.box(0.32, 0.02, 0.44, MAT.paper, -0.3, 0.82, 0.05);
    c.hit(0.5, 0.2, 0.5, -0.3, 0.9, 0.05, { prompt: function () { return 'Read the clipboard: the jobs'; }, use: function () { openPanel('jobs'); } });
    // the shop PC: the parts supplier, the stock, the jobs, the staff, the garage and the books (02-pc.js draws it)
    pcBuild(c, 0.38, 0.81, -0.22, 'desk');
    c.solid(-0.8, 0.8, -0.4, 0.4, 0, 0.85);
  } });
  // the office desk in the two-bay garage, with the second PC on the same accounts
  defProp('officeDesk', { label: 'office desk', cat: 'garage', x: 13.2, z: -5.1, rot: 0, desc: 'The office in the two-bay garage: a desk and the second PC.', build: function (c) {
    c.box(1.6, 0.06, 0.8, MAT.wood, 0, 0.78, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, -0.72, 0.38, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, 0.72, 0.38, 0);
    c.box(0.5, 0.45, 0.04, MAT.cork, -0.4, 1.5, -0.38); pcBuild(c, 0.2, 0.81, -0.15, 'office'); c.solid(-0.8, 0.8, -0.4, 0.4, 0, 0.85);
  } });
  GAME.propAllowed = function (id) { return id !== 'officeDesk' || grown(); };
  defProp('jack', { label: 'trolley jack', cat: 'garage', x: 1.4, z: 1.2, rot: 0, build: function (c) {
    var j = gcJackMesh(); j.position.z = -0.3; c.group.add(j);   // the same trolley jack that goes under the cars (02-car.js)
    c.solid(-0.2, 0.2, -0.4, 0.6, 0, 0.4);
  } });
  defProp('stands', { label: 'axle stands', cat: 'garage', x: 3.2, z: -2.8, rot: 0, build: function (c) {
    [-0.3, 0.3].forEach(function (x) { c.cyl(0.05, 0.45, MAT.steelDark, x, 0.45, 0, 8); c.box(0.36, 0.04, 0.36, MAT.steelDark, x, 0.02, 0); c.box(0.12, 0.05, 0.16, MAT.steelDark, x, 0.7, 0); });
    c.solid(-0.5, 0.5, -0.2, 0.2, 0, 0.75);
  } });
  defProp('drum', { label: 'oil drum', cat: 'garage', x: 4.2, z: -0.5, rot: 0, build: function (c) { c.cyl(0.3, 0.9, MAT.blue, 0, 0.45, 0, 16); c.cyl(0.31, 0.03, MAT.steelDark, 0, 0.3, 0, 16); c.cyl(0.31, 0.03, MAT.steelDark, 0, 0.6, 0, 16); c.solid(-0.32, 0.32, -0.32, 0.32, 0, 0.9); } });
  // the parts rack: the stock lives on it as boxes, one colour a part (02-stock.js draws them). E takes the parts for the job in hand
  defProp('rack', { label: 'parts rack', cat: 'garage', x: 4.5, z: -2.2, rot: 3, build: function (c) {
    [-0.9, 0.9].forEach(function (x) { c.box(0.05, 2.0, 0.4, MAT.rack, x, 1.0, 0); }); [0.4, 1.0, 1.6].forEach(function (y) { c.box(1.85, 0.04, 0.4, MAT.steel, 0, y, 0); });
    G.rackBoxes = c.dynGroup(); stockDraw();
    c.hit(1.9, 1.9, 0.5, 0, 1.0, 0, { prompt: function () { return rackPrompt(); }, use: function () { rackUse(); } });
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
