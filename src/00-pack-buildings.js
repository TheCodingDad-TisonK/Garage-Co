//@ Co Engine pack: buildings. Buildings every game can use, built from the engine's kit alone: a garden shed you can walk into, a carport, a bus shelter, shipping containers in red and blue, a kiosk, a site office cabin, a lock-up garage, a house, a shop front, a petrol station canopy with its pumps and a warehouse. Each stands on its own spot with solids for its walls and says what it is when you look at it; the shed and the carport you walk into, the rest are closed. The editor copies this file into a game as src/00-pack-buildings.js; place them from Assets. They are extras the catalogue does not sell (shop: false); what you place ships through the layout.
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
