//@ Co Engine pack: cars. Parked vehicles every game can use, built from the engine's kit alone: saloons in three colours, a hatchback, an estate, an SUV, a pickup, a van, a box truck, a taxi, a police car and a bus. Each stands where it is placed with a solid round it and says what it is when you look at it. The editor copies this file into a game as src/00-pack-cars.js; place them from Assets. They are extras the catalogue does not sell (shop: false); what you place ships through the layout.
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
