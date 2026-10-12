//@ Garage Co., part 02: the customers' cars, built for the workshop. A shaped body with wheel arches, glass you see through, an interior with seats, a dashboard and a steering wheel, an engine bay under a hinged bonnet, and under it all the brakes, the sump, the oil filter and the exhaust. Every part a job works on is its own mesh, and gcCarAnimate moves them while the work goes on. Also the tools (on the wall and in your hand) and the parts as they sit on the shelves.
  // ── Materials ─────────────────────────────────────────────────────
  // made once and shared by every car; a car's own paint is its own material (the editor and the jobs read g.userData.paint)
  var GCM = null;
  function gcMats() {
    if (GCM) return GCM;
    GCM = {
      glass: new THREE.MeshPhysicalMaterial({ color: 0x22313b, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.34, side: THREE.DoubleSide, clearcoat: 1, depthWrite: false }),
      mirror: std({ color: 0x8fa3b0, roughness: 0.05, metalness: 1 }),
      trim: std({ color: 0x16181b, roughness: 0.65 }), black: std({ color: 0x1b1c1f, roughness: 0.7 }), tyre: std({ color: 0x1c1d1f, roughness: 0.95 }),
      rim: std({ color: 0xc4c8ce, roughness: 0.25, metalness: 0.9 }), rimDark: std({ color: 0x2c2f33, roughness: 0.5, metalness: 0.6 }),
      disc: std({ color: 0x9a9da3, roughness: 0.35, metalness: 0.8 }), discOld: std({ color: 0x6b5244, roughness: 0.85, metalness: 0.35 }),
      caliper: std({ color: 0xb8322a, roughness: 0.45, metalness: 0.3 }), pad: std({ color: 0x77716a, roughness: 0.9 }), padOld: std({ color: 0x2a2725, roughness: 0.95 }),
      engine: std({ color: 0x45484e, roughness: 0.5, metalness: 0.55 }), alu: std({ color: 0xaeb2b8, roughness: 0.35, metalness: 0.8 }),
      seat: std({ color: 0x2d3036, roughness: 0.95 }), cloth: std({ color: 0x3c4048, roughness: 1 }), dash: std({ color: 0x1f2125, roughness: 0.85 }), liner: std({ color: 0xbdb8ae, roughness: 1 }),
      head: glowMat(0xfff4d0, 0.45), tail: glowMat(0xff2a1a, 0.5), amber: glowMat(0xffa020, 0.35), white: glowMat(0xf6f6f6, 0.3), dial: glowMat(0x9fd8ff, 0.7), screen: glowMat(0x4a8fe0, 0.5),
      yellow: std({ color: 0xf2c230, roughness: 0.5 }), red: std({ color: 0xc8342a, roughness: 0.5 }), blue: std({ color: 0x2c5f9e, roughness: 0.4, metalness: 0.2 }), filterOld: std({ color: 0x1e2e44, roughness: 0.85 }),
      bottle: std({ color: 0xf1f4f0, roughness: 0.3, transparent: true, opacity: 0.55 }), pink: std({ color: 0xf06aa8, roughness: 0.2 }),
      oil: std({ color: 0x2e1f08, roughness: 0.08, metalness: 0.3 }), oilNew: std({ color: 0xc89a2a, roughness: 0.08, metalness: 0.2 }),
      pleat: std({ color: 0xf2e7c9, roughness: 1 }), pleatDirty: std({ color: 0x4b4239, roughness: 1 }), copper: std({ color: 0xc87a3a, roughness: 0.35, metalness: 0.8 }),
      ceramic: std({ color: 0xf2f2ee, roughness: 0.4 }), sooty: std({ color: 0x3a3532, roughness: 0.9 }), fuzz: std({ color: 0xd3eadc, roughness: 1 }),
      exhaust: std({ color: 0x6f6b66, roughness: 0.75, metalness: 0.5 }), exhaustNew: std({ color: 0xb0aca6, roughness: 0.35, metalness: 0.85 }),
      jack: std({ color: 0xc8342a, roughness: 0.45, metalness: 0.3 }), labelOld: std({ color: 0x6a6f66, roughness: 0.8 }), labelNew: std({ color: 0x2f9e5a, roughness: 0.6 }),
      cardboard: std({ color: 0xb48a5a, roughness: 0.95 }), orange: std({ color: 0xe0782a, roughness: 0.6 }),
      steel: std({ color: 0x6f757e, roughness: 0.4, metalness: 0.7 }), chrome: std({ color: 0x9aa1aa, roughness: 0.18, metalness: 0.95 }), bay: std({ color: 0x3a3e44, roughness: 0.8 })
    };
    return GCM;
  }
  // ── Small builders ────────────────────────────────────────────────
  function gcGrp(parent, x, y, z) { var g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
  function gcMesh(geo, mat, parent, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  // a bar from point a to point b in the car's side plane (x, y) at depth z: t thick, wd across
  function gcBeam(a, b, z, t, wd, mat, parent) { var dx = b[0] - a[0], dy = b[1] - a[1], m = box(Math.hypot(dx, dy), t, wd, mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z, parent); m.rotation.z = Math.atan2(dy, dx); return m; }
  function gcZcyl(r, len, mat, x, y, z, parent, seg) { var m = cyl(r, len, mat, x, y, z, parent, seg || 14); m.rotation.x = Math.PI / 2; return m; }   // lying across the car
  function gcXcyl(r, len, mat, x, y, z, parent, seg) { var m = cyl(r, len, mat, x, y, z, parent, seg || 14); m.rotation.z = Math.PI / 2; return m; }   // lying along the car
  var GC_GEO = {};
  function gcTyreGeo() {
    if (GC_GEO.tyre) return GC_GEO.tyre;
    var pts = [[0.2, -0.1], [0.255, -0.112], [0.3, -0.11], [0.322, -0.096], [0.331, -0.06], [0.333, 0], [0.331, 0.06], [0.322, 0.096], [0.3, 0.11], [0.255, 0.112], [0.2, 0.1]];
    return (GC_GEO.tyre = new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 30));
  }
  // the side of the body: sills, the two wheel arches, the nose and the tail, up to the waist line
  function gcSideShape() {
    var s = new THREE.Shape();
    s.moveTo(-2.13, 0.36); s.lineTo(-1.83, 0.34); s.absarc(-1.4, 0.33, 0.43, Math.PI, 0, true); s.lineTo(0.97, 0.33); s.absarc(1.4, 0.33, 0.43, Math.PI, 0, true);
    s.lineTo(2.12, 0.36); s.quadraticCurveTo(2.2, 0.42, 2.19, 0.62); s.quadraticCurveTo(2.18, 0.86, 2.06, 0.95); s.lineTo(1.1, 1.0); s.lineTo(-1.72, 0.99);
    s.quadraticCurveTo(-2.1, 0.98, -2.16, 0.86); s.quadraticCurveTo(-2.2, 0.5, -2.13, 0.36);
    return s;
  }
  function gcWindowShape() { var s = new THREE.Shape(); s.moveTo(1.06, 1.01); s.lineTo(0.4, 1.39); s.lineTo(-1.04, 1.39); s.lineTo(-1.68, 1.01); s.lineTo(1.06, 1.01); return s; }

  // ── A wheel ───────────────────────────────────────────────────────
  // one group at the axle, spun with rotation.z: a rounded tyre, an alloy with five spokes, a centre cap and five wheel nuts (userData.nuts)
  function gcWheelMesh(s) {
    var M = gcMats(), w = new THREE.Group();
    gcMesh(gcTyreGeo(), M.tyre, w).rotation.x = Math.PI / 2;
    gcZcyl(0.2, 0.2, M.rimDark, 0, 0, 0, w, 20); gcZcyl(0.205, 0.018, M.rim, 0, 0, s * 0.092, w, 24);
    gcZcyl(0.17, 0.02, M.rimDark, 0, 0, s * 0.094, w, 20);
    for (var k = 0; k < 5; k++) { var a = k * Math.PI * 2 / 5, sp = box(0.15, 0.04, 0.022, M.rim, Math.cos(a) * 0.1, Math.sin(a) * 0.1, s * 0.1, w); sp.rotation.z = a; }
    gcZcyl(0.05, 0.03, M.rim, 0, 0, s * 0.108, w, 16); gcZcyl(0.03, 0.006, M.trim, 0, 0, s * 0.124, w, 12);
    w.userData.nuts = [];
    for (var n = 0; n < 5; n++) { var b = n * Math.PI * 2 / 5 + Math.PI / 5, nut = gcZcyl(0.013, 0.026, M.alu, Math.cos(b) * 0.068, Math.sin(b) * 0.068, s * 0.114, w, 6); nut.userData.base = [nut.position.x, nut.position.y, nut.position.z]; w.userData.nuts.push(nut); }
    w.userData.side = s; w.userData.wheel = true;
    return w;
  }

  // ── The car ───────────────────────────────────────────────────────
  // opt: col, plate, van (the parts van: a load box behind the cab). The car's frame is the engine's: the front is +x, the near side
  // (the driver's side, the one you work from) is +z. g.userData.wheels are in the engine's order: near front, far front, near rear, far rear
  function gcCar(opt) {
    opt = opt || {}; var M = gcMats(), g = new THREE.Group(), col = opt.col === undefined ? pick(CAR_COLS) : opt.col, P = {};
    var paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.32, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12 });
    // the body: two side skins cut from the profile, the floor, the nose and the tail between them
    var sideGeo = new THREE.ExtrudeGeometry(gcSideShape(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 14 });
    gcMesh(sideGeo, paint, g, 0, 0, 0.86); gcMesh(sideGeo, paint, g, 0, 0, -0.91);
    box(4.1, 0.05, 1.74, M.black, 0, 0.36, 0, g);
    gcMesh(bevelGeo(0.16, 0.22, 1.88, 0.05), paint, g, 2.13, 0.46, 0); gcMesh(bevelGeo(0.16, 0.22, 1.88, 0.05), paint, g, -2.13, 0.46, 0);
    box(0.05, 0.3, 1.72, paint, 2.16, 0.73, 0, g); box(0.05, 0.42, 1.72, paint, -2.15, 0.76, 0, g);
    // the grille and its badge, the lower intake, the number plates
    box(0.02, 0.14, 0.62, M.chrome, 2.185, 0.7, 0, g); box(0.03, 0.12, 0.58, M.trim, 2.19, 0.7, 0, g); [0.67, 0.7, 0.73].forEach(function (y) { box(0.012, 0.008, 0.54, M.chrome, 2.205, y, 0, g); });
    gcXcyl(0.04, 0.012, M.chrome, 2.21, 0.72, 0, g, 16); box(0.03, 0.06, 1.1, M.trim, 2.215, 0.4, 0, g);
    var plate = opt.plate || ('GC ' + randi(10, 99) + ' ' + pick(['AB', 'KH', 'NL', 'XY']) + randi(100, 999));
    sign([plate], 0.44, 0.11, 2.225, 0.5, 0, Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g); sign([plate], 0.44, 0.11, -2.225, 0.5, 0, -Math.PI / 2, { w: 256, h: 64, bg: '#f3c843', fg: '#1b232c' }, g);
    // the lights: headlights with a chrome bezel, indicators, tail lights with a reversing lamp
    g.userData.lamps = [];
    [1, -1].forEach(function (s) {
      box(0.08, 0.15, 0.4, M.trim, 2.13, 0.84, s * 0.6, g); box(0.012, 0.16, 0.41, M.chrome, 2.17, 0.84, s * 0.6, g);
      var lens = box(0.02, 0.025, 0.34, M.head, 2.18, 0.785, s * 0.6, g), lamps = [lens]; g.userData.lamps.push(lens);
      [-0.08, 0.08].forEach(function (dz) { gcXcyl(0.05, 0.012, M.chrome, 2.176, 0.85, s * 0.6 + dz, g, 18); lamps.push(gcXcyl(0.038, 0.014, M.head, 2.178, 0.85, s * 0.6 + dz, g, 18)); });
      if (s > 0) P.lensNear = lamps;
      box(0.03, 0.04, 0.12, M.amber, 2.2, 0.56, s * 0.74, g);
      box(0.04, 0.15, 0.36, M.tail, -2.17, 0.84, s * 0.6, g); box(0.042, 0.05, 0.1, M.white, -2.17, 0.8, s * 0.48, g);
      // the door lines, the handles, the sills, a mirror each side
      var z = s * 0.924; box(0.006, 0.54, 0.004, M.trim, 1.06, 0.71, z, g); box(0.006, 0.6, 0.004, M.trim, -0.32, 0.69, z, g); box(0.006, 0.36, 0.004, M.trim, -1.62, 0.81, z, g);
      box(0.12, 0.025, 0.02, M.chrome, 0.62, 0.86, s * 0.93, g); box(0.12, 0.025, 0.02, M.chrome, -0.8, 0.86, s * 0.93, g);
      box(1.92, 0.08, 0.05, M.trim, 0, 0.38, s * 0.93, g);
      box(0.04, 0.03, 0.12, M.trim, 1.0, 1.04, s * 0.94, g); var mh = gcMesh(bevelGeo(0.12, 0.1, 0.18, 0.025), paint, g, 1.0, 1.07, s * 1.03); box(0.004, 0.075, 0.14, M.mirror, 0.938, 1.07, s * 1.03, g); mh.rotation.y = s * -0.12;
    });
    // the wheels, and behind each one its brake: a disc on the hub, a caliper over it; the near front's are the job's
    g.userData.wheels = [];
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p, i) {
      var s = p[1] > 0 ? 1 : -1, w = gcWheelMesh(s); w.position.set(p[0], 0.33, p[1]); g.add(w); g.userData.wheels.push(w);
      box(0.9, 0.46, 0.04, M.black, p[0], 0.57, s * 0.62, g); box(0.86, 0.04, 0.3, M.black, p[0], 0.78, s * 0.76, g);   // the wheel well
      var disc = gcZcyl(0.235, 0.022, M.disc, p[0], 0.33, s * 0.81, g, 26), hub = gcZcyl(0.075, 0.05, M.steel, p[0], 0.33, s * 0.83, g, 16);
      for (var n = 0; n < 5; n++) { var a = n * Math.PI * 2 / 5 + Math.PI / 5; gcZcyl(0.008, 0.05, M.alu, p[0] + Math.cos(a) * 0.068, 0.33 + Math.sin(a) * 0.068, s * 0.86, g, 6); }
      var cal = gcGrp(g, p[0] - 0.16, 0.49, s * 0.8); cal.rotation.z = Math.PI / 4; box(0.16, 0.09, 0.09, M.caliper, 0, 0, 0, cal);
      var pads = gcGrp(cal, 0, -0.04, 0); box(0.13, 0.05, 0.012, M.pad, 0, 0, 0.022, pads); box(0.13, 0.05, 0.012, M.pad, 0, 0, -0.022, pads);
      if (i === 0) { P.disc = disc; P.discBase = disc.position.z; P.caliper = cal; P.calBase = [cal.position.x, cal.position.y, cal.position.z]; P.pads = pads; P.hub = hub; }
    });
    // the cabin: the waist, the glass, the pillars and the roof
    [1, -1].forEach(function (s) {
      box(2.84, 0.03, 0.1, paint, -0.31, 0.995, s * 0.845, g);
      var wg = gcMesh(new THREE.ShapeGeometry(gcWindowShape()), M.glass, g, 0, 0, s * 0.8); wg.castShadow = false;
      gcBeam([1.1, 1.0], [0.38, 1.41], s * 0.77, 0.05, 0.07, paint, g); gcBeam([0.38, 1.41], [-1.06, 1.41], s * 0.77, 0.05, 0.07, paint, g); gcBeam([-1.06, 1.41], [-1.72, 1.0], s * 0.75, 0.05, 0.12, paint, g);
      box(0.07, 0.4, 0.05, M.trim, -0.32, 1.2, s * 0.8, g); box(2.8, 0.014, 0.02, M.trim, -0.31, 1.015, s * 0.81, g);
    });
    var ws = gcBeam([1.1, 1.0], [0.38, 1.41], 0, 0.008, 1.52, M.glass, g); ws.castShadow = false; var rw = gcBeam([-1.06, 1.41], [-1.72, 1.0], 0, 0.008, 1.46, M.glass, g); rw.castShadow = false;
    gcMesh(bevelGeo(1.5, 0.05, 1.58, 0.02), paint, g, -0.34, 1.435, 0); box(1.42, 0.01, 1.48, M.liner, -0.34, 1.403, 0, g);
    box(0.12, 0.04, 1.74, M.trim, 1.06, 1.0, 0, g);   // the scuttle below the windscreen
    // the boot lid
    gcMesh(bevelGeo(0.44, 0.04, 1.76, 0.015), paint, g, -1.93, 0.975, 0);
    // the wipers, each on its own pivot at the scuttle: they lift off the glass (rotation.x) when they are changed
    P.wipers = []; [0.62, -0.08].forEach(function (z) { var wp = gcGrp(g, 1.07, 1.03, z); gcBeam([0, 0], [-0.04, 0.01], 0, 0.015, 0.02, M.trim, wp); box(0.02, 0.018, 0.56, M.trim, -0.02, 0.012, -0.28, wp); P.wipers.push(wp); });
    // the interior: two seats, a bench, a dashboard with its dials and screen, the steering wheel on the left (left-hand drive: the far side, -z), the door cards
    [1, -1].forEach(function (s) {
      gcMesh(bevelGeo(0.5, 0.12, 0.5, 0.04), M.seat, g, -0.18, 0.56, s * 0.4);
      var back = gcGrp(g, -0.44, 0.6, s * 0.4); back.rotation.z = 0.22; gcMesh(bevelGeo(0.1, 0.62, 0.48, 0.04), M.seat, back, 0, 0.31, 0); box(0.08, 0.15, 0.26, M.seat, 0, 0.72, 0, back);
      box(2.62, 0.5, 0.02, M.cloth, -0.32, 0.73, s * 0.845, g);
    });
    gcMesh(bevelGeo(0.5, 0.12, 1.42, 0.04), M.seat, g, -1.2, 0.56, 0); var rb = gcGrp(g, -1.46, 0.6, 0); rb.rotation.z = 0.22; gcMesh(bevelGeo(0.1, 0.56, 1.42, 0.04), M.seat, rb, 0, 0.28, 0);
    box(2.8, 0.04, 1.68, M.cloth, -0.32, 0.42, 0, g);
    gcMesh(bevelGeo(0.42, 0.2, 1.66, 0.05), M.dash, g, 0.84, 0.8, 0); box(0.16, 0.06, 0.44, M.dash, 0.64, 0.93, -0.4, g);
    [-0.31, -0.49].forEach(function (z) { var d = cyl(0.05, 0.006, M.dial, 0.628, 0.88, z, g, 18); d.rotation.z = Math.PI / 2; });
    box(0.01, 0.1, 0.2, M.screen, 0.625, 0.84, 0.02, g); box(0.2, 0.18, 0.2, M.dash, 0.4, 0.55, 0, g);
    cyl(0.01, 0.15, M.chrome, 0.38, 0.7, 0, g, 6); sphere(0.025, M.trim, 0.38, 0.78, 0, g); box(0.02, 0.05, 0.2, M.trim, 0.52, 1.34, 0, g);
    var col2 = gcGrp(g, 0.6, 0.86, -0.4); col2.rotation.z = -0.4; gcXcyl(0.025, 0.24, M.dash, -0.1, 0, 0, col2, 10);
    var sw = gcGrp(g, 0.44, 0.93, -0.4); sw.rotation.z = -0.4; P.steer = gcGrp(sw, 0, 0, 0);
    var ring = gcMesh(new THREE.TorusGeometry(0.155, 0.017, 8, 28), M.trim, P.steer); ring.rotation.y = Math.PI / 2;
    box(0.02, 0.025, 0.32, M.trim, 0, 0, 0, P.steer); box(0.02, 0.15, 0.03, M.trim, 0, -0.08, 0, P.steer); box(0.04, 0.07, 0.09, M.dash, 0, 0, 0, P.steer);
    // the engine bay: a floor, the inner wings, the radiator at the front and the bulkhead at the back
    box(0.95, 0.04, 1.62, M.bay, 1.58, 0.6, 0, g); box(0.95, 0.38, 0.04, paint, 1.58, 0.8, 0.82, g); box(0.95, 0.38, 0.04, paint, 1.58, 0.8, -0.82, g);
    box(0.06, 0.3, 1.32, M.black, 2.05, 0.8, 0, g); box(0.1, 0.03, 1.62, paint, 2.08, 0.96, 0, g); box(0.03, 0.38, 1.62, paint, 1.12, 0.8, 0, g);
    for (var f = 0; f < 9; f++) box(0.005, 0.26, 0.004, M.alu, 2.015, 0.8, -0.56 + f * 0.14, g);
    // the engine: the block, the head under its cover with ribs, four coil packs over the spark plugs, the oil filler cap, the dipstick
    box(0.55, 0.22, 0.62, M.engine, 1.55, 0.74, 0, g); gcMesh(bevelGeo(0.48, 0.07, 0.52, 0.02), M.alu, g, 1.56, 0.885, 0);
    [-0.15, -0.05, 0.05, 0.15].forEach(function (x) { box(0.03, 0.012, 0.46, M.engine, 1.56 + x, 0.926, 0, g); });
    P.coils = []; P.plugs = [];
    [-0.18, -0.06, 0.06, 0.18].forEach(function (z) {
      var pl = gcGrp(g, 1.6, 0.9, z); cyl(0.011, 0.07, M.ceramic, 0, 0.0, 0, pl, 8); cyl(0.016, 0.02, M.copper, 0, -0.04, 0, pl, 6); pl.userData.base = pl.position.y; P.plugs.push(pl);
      var co = gcGrp(g, 1.6, 0.97, z); box(0.05, 0.08, 0.05, M.black, 0, 0, 0, co); box(0.03, 0.015, 0.06, M.red, 0, 0.045, 0.01, co); co.userData.base = co.position.y; P.coils.push(co);
    });
    P.cap = gcGrp(g, 1.42, 0.935, 0.28); cyl(0.035, 0.03, M.yellow, 0, 0, 0, P.cap, 16); P.capBase = [1.42, 0.935, 0.28];
    var ds = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), M.yellow); ds.position.set(1.3, 0.95, 0.14); g.add(ds); cyl(0.004, 0.2, M.steel, 1.3, 0.85, 0.14, g, 4);
    gcXcyl(0.035, 0.3, M.black, 1.36, 0.88, 0.42, g, 10);   // the intake hose to the air box
    // the air box: a base, a lid that lifts off, and the pleated filter inside
    box(0.3, 0.08, 0.24, M.black, 1.55, 0.84, 0.55, g);
    P.airLid = gcGrp(g, 1.55, 0.9, 0.55); P.airLidBase = 0.9; gcMesh(bevelGeo(0.32, 0.045, 0.26, 0.012), M.black, P.airLid); box(0.02, 0.03, 0.03, M.alu, 0.17, -0.01, 0, P.airLid); box(0.02, 0.03, 0.03, M.alu, -0.17, -0.01, 0, P.airLid);
    P.airFilter = gcGrp(g, 1.55, 0.88, 0.55); P.airFilterBase = 0.88; P.airPleats = [];
    for (var q = 0; q < 7; q++) P.airPleats.push(box(0.03, 0.03, 0.2, M.pleat, -0.105 + q * 0.035, 0, 0, P.airFilter)); box(0.27, 0.012, 0.22, M.orange, 0, -0.018, 0, P.airFilter);
    // the battery on its tray: a label, the two terminals, the clamp across the top, the white fur of a corroded terminal
    box(0.3, 0.03, 0.22, M.black, 1.72, 0.775, -0.52, g);
    P.battery = gcGrp(g, 1.72, 0.88, -0.52); P.batteryBase = 0.88; box(0.26, 0.18, 0.18, M.black, 0, 0, 0, P.battery); P.batLabel = box(0.2, 0.06, 0.004, M.labelOld, 0, 0.01, 0.092, P.battery);
    cyl(0.018, 0.03, M.red, 0.08, 0.1, 0.05, P.battery, 10); P.termNut = cyl(0.018, 0.03, M.trim, -0.08, 0.1, 0.05, P.battery, 6);
    P.fuzz = gcGrp(P.battery, -0.08, 0.115, 0.05); [[0, 0, 0], [0.02, -0.005, 0.012], [-0.015, -0.004, -0.01]].forEach(function (f) { sphere(0.016, M.fuzz, f[0], f[1], f[2], P.fuzz); });
    P.clamp = gcGrp(g, 1.72, 0.98, -0.52); P.clampBase = 0.98; box(0.03, 0.015, 0.2, M.steel, 0, 0, 0, P.clamp); cyl(0.006, 0.12, M.steel, 0, -0.06, 0.1, P.clamp, 6); cyl(0.006, 0.12, M.steel, 0, -0.06, -0.1, P.clamp, 6);
    // the coolant tank with its fluid (low when it runs hot) and cap, the washer bottle, the brake fluid, the strut tops
    cyl(0.062, 0.15, M.bottle, 1.28, 0.9, -0.6, g, 16); P.coolFluid = cyl(0.055, 0.14, M.pink, 1.28, 0.83, -0.6, g, 14); P.coolFluid.position.y = 0.83;
    P.coolCap = gcGrp(g, 1.28, 0.985, -0.6); P.coolCapBase = [1.28, 0.985, -0.6]; cyl(0.032, 0.025, M.black, 0, 0, 0, P.coolCap, 12);
    cyl(0.05, 0.13, M.bottle, 1.92, 0.86, -0.25, g, 12); cyl(0.02, 0.02, M.blue, 1.92, 0.935, -0.25, g, 10);
    box(0.08, 0.08, 0.06, M.bottle, 1.22, 0.92, 0.6, g); cyl(0.02, 0.02, M.yellow, 1.22, 0.97, 0.6, g, 10);
    [1, -1].forEach(function (s) { cyl(0.06, 0.03, M.black, 1.4, 0.975, s * 0.72, g, 14); });
    // the backs of the headlights: the near one's round cover twists off and the bulb comes out
    [1, -1].forEach(function (s) { box(0.1, 0.14, 0.34, M.black, 2.0, 0.84, s * 0.6, g); });
    P.lampCap = gcGrp(g, 1.94, 0.84, 0.62); P.lampCapBase = 1.94; gcXcyl(0.04, 0.02, M.trim, 0, 0, 0, P.lampCap, 12); box(0.012, 0.05, 0.012, M.trim, -0.012, 0, 0, P.lampCap);
    P.bulb = gcGrp(g, 1.955, 0.84, 0.62); P.bulbBase = 1.955; sphere(0.016, M.white, -0.01, 0, 0, P.bulb); gcXcyl(0.012, 0.025, M.alu, 0.01, 0, 0, P.bulb, 8);
    // the bonnet: hinged at the bulkhead, the front a touch lower; the stay holds it up
    P.lid = gcGrp(g, 1.1, 1.0, 0); var lp = gcMesh(bevelGeo(1.04, 0.03, 1.74, 0.012), paint, P.lid, 0.52, 0.01, 0); lp.rotation.z = -0.025; box(0.92, 0.01, 1.5, M.bay, 0.5, -0.012, 0, P.lid); [-0.45, 0, 0.45].forEach(function (z) { box(0.85, 0.02, 0.05, M.engine, 0.5, -0.025, z, P.lid); }); box(0.05, 0.02, 1.4, M.engine, 0.85, -0.025, 0, P.lid);
    P.stay = gcBeam([2.0, 0.96], [1.49, 1.64], 0.68, 0.01, 0.01, M.black, g); P.stay.visible = false;
    // underneath: the sump with its drain plug, the oil filter, the exhaust and its silencer (the section an exhaust job changes)
    box(0.7, 0.09, 0.8, M.engine, 1.25, 0.31, 0.24, g);
    P.sumpPlug = cyl(0.018, 0.03, M.alu, 0.98, 0.255, 0.66, g, 6); P.sumpPlugBase = 0.255;
    P.filter = cyl(0.046, 0.11, M.filterOld, 0.7, 0.28, 0.66, g, 16); box(0.12, 0.04, 0.2, M.engine, 0.72, 0.34, 0.6, g); P.filterBase = 0.28;
    gcXcyl(0.028, 2.5, M.exhaust, -0.35, 0.24, 0.42, g, 10); gcXcyl(0.03, 0.3, M.chrome, -2.06, 0.27, 0.55, g, 12);
    P.silencer = gcGrp(g, -1.4, 0.26, 0.58); P.silencerBase = 0.26; var sil = gcXcyl(0.12, 0.62, M.exhaust, 0, 0, 0, P.silencer, 16); sil.scale.z = 0.62; gcXcyl(0.03, 0.9, M.exhaust, 0, -0.02, -0.08, P.silencer, 10);
    // the drain pan on the floor (y is set against the car's height) with the oil it catches, the stream into it, and the plug lying in it
    P.pan = gcGrp(g, 0.98, 0, 0.8); P.pan.visible = false; cyl(0.25, 0.08, M.black, 0, 0.04, 0, P.pan, 22); P.panOil = cyl(0.23, 0.01, M.oil, 0, 0.02, 0, P.pan, 22); P.panPlug = cyl(0.018, 0.03, M.alu, 0.1, 0.06, -0.08, P.pan, 6);
    P.stream = cyl(0.009, 1, M.oil, 0.98, 0.1, 0.68, g, 6); P.stream.visible = false; P.stream.castShadow = false;
    // the wheel nuts once they are off: in a little pile by the wheel
    P.floorParts = gcGrp(g, 2.0, 0, 1.4); P.floorParts.userData.key = '';
    P.nutPile = gcGrp(g, 1.0, 0, 1.35); P.nutPile.visible = false; [[0, 0], [0.04, 0.01], [-0.03, 0.03], [0.02, -0.04], [-0.04, -0.02]].forEach(function (n) { cyl(0.013, 0.026, M.alu, n[0], 0.013, n[1], P.nutPile, 6); });
    // the jug and the coolant bottle that pour while a fill step fills
    P.can = gcGrp(g, 1.36, 1.2, 0.36); P.can.visible = false; gcMesh(bevelGeo(0.16, 0.22, 0.1, 0.02), M.yellow, P.can, 0, 0, 0); cyl(0.02, 0.06, M.black, 0.09, -0.1, 0, P.can, 8).rotation.z = 1.0; P.can.rotation.z = 0.9;
    P.canStream = cyl(0.008, 0.18, M.oilNew, 1.42, 1.03, 0.28, g, 6); P.canStream.visible = false; P.canStream.castShadow = false;
    P.cbottle = gcGrp(g, 1.22, 1.16, -0.52); P.cbottle.visible = false; cyl(0.05, 0.2, M.bottle, 0, 0, 0, P.cbottle, 12); cyl(0.045, 0.12, M.pink, 0, -0.03, 0, P.cbottle, 12); P.cbottle.rotation.x = -0.9;
    // the trolley jack under the sill: a chassis on four castors, the lifting arm with its saddle, the handle that pumps
    P.jack = gcJackMesh(); P.jack.position.set(0.1, 0, 0.75); P.jack.visible = false; g.add(P.jack);
    // the parts van: a load box behind the cab
    if (opt.van) { var vb = std({ color: col, roughness: 0.55 }); gcMesh(bevelGeo(2.0, 1.15, 1.84, 0.05), vb, g, -1.12, 1.55, 0); sign(['PARTS'], 1.4, 0.36, -1.12, 1.6, 0.93, 0, { bg: '#1b232c' }, g); sign(['PARTS'], 1.4, 0.36, -1.12, 1.6, -0.93, Math.PI, { bg: '#1b232c' }, g); }
    g.userData.paint = paint; g.userData.parts = P; g.userData.dynamic = true;
    return g;
  }
  // the trolley jack (also the jack prop's look): its arm and handle are their own groups (userData.arm, userData.handle)
  function gcJackMesh() {
    var M = gcMats(), j = new THREE.Group();
    box(0.26, 0.07, 0.62, M.jack, 0, 0.08, 0.32, j); box(0.2, 0.04, 0.5, M.trim, 0, 0.125, 0.34, j);
    [[0.12, 0.08], [-0.12, 0.08], [0.11, 0.58], [-0.11, 0.58]].forEach(function (p) { gcXcyl(0.045, 0.035, M.trim, p[0], 0.045, p[1], j, 12); });
    var arm = gcGrp(j, 0, 0.13, 0.5); box(0.12, 0.05, 0.5, M.jack, 0, 0, -0.25, arm); var sad = gcGrp(arm, 0, 0.03, -0.5); cyl(0.06, 0.03, M.steel, 0, 0, 0, sad, 14); sad.userData.keepLevel = true; j.userData.saddle = sad;
    cyl(0.04, 0.16, M.steel, 0, 0.2, 0.42, j, 12);
    var hd = gcGrp(j, 0, 0.14, 0.64); hd.rotation.x = 0.95; cyl(0.015, 0.9, M.black, 0, 0.45, 0, hd, 8); cyl(0.022, 0.12, M.tyre, 0, 0.88, 0, hd, 10);
    j.userData.arm = arm; j.userData.handle = hd;
    return j;
  }

  // ── The work you can see ──────────────────────────────────────────
  // every tick each moving part eases toward its pose for the job: what J.vis says, which steps are done, and how far the hold of the
  // current step has filled (J.stepP: yours or a worker's). A step's anim key names what it moves (02-work.js, STEPS). snap: at once
  function gcStepsDone(J, key) { var st = stepsOf(J); for (var i = 0; i < J.step && i < st.length; i++) if (st[i].anim === key) return true; return false; }
  function gcEase(A, k, target, rate, snap, dt) { if (A[k] === undefined || snap) A[k] = target; else A[k] += (target - A[k]) * (1 - Math.exp(-(dt || 0) * (rate || 10))); return A[k]; }
  function gcUpDown(u) { return u < 0.5 ? u / 0.5 : (1 - u) / 0.5; }   // up to the top at half way, back down by the end
  function gcCarAnimate(b, dt, snap) {
    var C = carIn(b), J = jobAt(b); if (!C || !C.parts) return; var P = C.parts, M = gcMats(), A = C.anim || (C.anim = {}), v = (J && J.vis) || {}, fault = C.rec.fault;
    var s = J && J.state === 'taken' ? curStep(J) : null, key = s && s.anim, p = s ? clamp(J.stepP || 0, 0, 1) : 0;
    var live = function (k) { return key === k && J.stepP > 0; }, done = function (k) { return !!J && gcStepsDone(J, k); };
    var over = !J || J.state === 'done' || J.state === 'paid' || J.state === 'leaving', fixed = function (k) { return over || done(k) || (live(k) && p > 0.5); };
    var h = carHeight(b), onLift = J && J.lift !== null && J.lift !== undefined;
    C.g.position.y = h;
    // the bonnet on its hinge, the stay once it is up
    var lid = gcEase(A, 'lid', v.open ? 1.05 : 0, 5, snap, dt); P.lid.rotation.z = lid; P.stay.visible = lid > 0.98;
    // the jack: on the floor under the sill while the car is up or a jack step fills; its arm reaches the sill, its handle pumps
    var jackStep = !!(s && s.at === 'jack' && J.stepP > 0);
    P.jack.visible = !!(v.up || jackStep) && !onLift; P.jack.position.y = -h;
    if (P.jack.visible) { var reach = clamp((0.31 + h - 0.16) / 0.5, -1, 1), ang = Math.asin(reach); P.jack.userData.arm.rotation.x = -ang; P.jack.userData.saddle.rotation.x = ang; P.jack.userData.handle.rotation.x = 0.95 + (jackStep ? Math.sin(J.stepP * 22) * 0.35 : 0); }
    // the wheel nuts: they spin and back out while you hold the brace, then lie in a pile; done up again the same way back
    var nutsT = live('nutsoff') ? p : live('nutson') ? 1 - p : (done('nutsoff') && !done('nutson') && !over) ? 1 : 0; nutsT = gcEase(A, 'nuts', nutsT, 14, snap, dt);
    var W = C.looseWheel; if (W && W.userData.nuts) W.userData.nuts.forEach(function (n) { var bz = n.userData.base; n.position.z = bz[2] + nutsT * 0.14; n.rotation.set(Math.PI / 2, nutsT * 14, 0); n.visible = nutsT < 0.9; });
    P.nutPile.visible = nutsT >= 0.9 || (!!v.wheelOff && !over); P.nutPile.position.y = -h;
    // the wheel: it slides off the studs, then is laid flat on the floor by the car (or goes with you to the tyre corner)
    var wt = gcEase(A, 'wheel', v.wheelOff ? 1 : 0, 4, snap, dt), away = !!v.wheelOff && J && stepsOf(J).some(function (x) { return x.at === 'tyre'; });
    if (W) {
      if (wt <= 0.4) { W.position.set(1.4, 0.33, 0.95 + wt / 0.4 * 0.3); W.rotation.x = 0; }
      else { var u = (wt - 0.4) / 0.6; W.position.set(1.4 + u * 0.2, 0.33 + (0.115 - h - 0.33) * u, 1.25 + u * 0.4); W.rotation.x = -u * Math.PI / 2; }
      W.visible = !(away && wt > 0.45);
    }
    // the brakes: the caliper swings up off the disc while the pads are changed; for discs the disc slides off the hub and back
    var lift = live('pads') || live('discs') ? Math.sin(p * Math.PI) : 0; lift = gcEase(A, 'cal', lift, 14, snap, dt);
    P.caliper.position.set(P.calBase[0] - lift * 0.05, P.calBase[1] + lift * 0.16, P.calBase[2] + lift * 0.08);
    var discOff = gcEase(A, 'disc', live('discs') ? Math.sin(p * Math.PI) : 0, 14, snap, dt); P.disc.position.z = P.discBase + discOff * 0.22;
    var padsNew = fixed('pads') || fixed('discs') || (fault !== 'brakes' && fault !== 'discs'); P.pads.children.forEach(function (m) { m.material = padsNew ? M.pad : M.padOld; });
    P.disc.material = fault === 'discs' && !fixed('discs') ? M.discOld : M.disc;
    // the sump plug spins out and drops into the pan; the old oil runs out in a stream and fills the pan
    var plugT = live('plugout') ? p : live('plugin') ? 1 - p : (done('plugout') && !done('plugin') && !over) ? 1 : 0; plugT = gcEase(A, 'plug', plugT, 14, snap, dt);
    P.sumpPlug.position.y = P.sumpPlugBase - plugT * 0.05; P.sumpPlug.rotation.y = plugT * 12; P.sumpPlug.visible = plugT < 0.9;
    P.pan.visible = !!v.pan; P.pan.position.y = -h; P.panPlug.visible = plugT >= 0.9;
    var lvl = live('drain') ? p : (done('drain') && !over) ? 1 : 0; lvl = gcEase(A, 'lvl', lvl, 6, snap, dt); P.panOil.visible = lvl > 0.02; P.panOil.position.y = 0.015 + lvl * 0.05;
    var flow = !!v.pan && (live('drain') || (live('plugout') && p > 0.85)), bottom = -h + 0.02 + lvl * 0.05, top = P.sumpPlugBase - 0.02;
    P.stream.visible = flow; if (flow) { P.stream.scale.y = Math.max(0.01, top - bottom); P.stream.position.y = (top + bottom) / 2; }
    // the oil filter spins down off its thread and a new one goes on
    var fu = live('filter') ? p : 0; P.filter.position.y = P.filterBase - gcUpDown(fu) * 0.14; P.filter.rotation.y = fu * 24; P.filter.material = fixed('filter') ? M.blue : M.filterOld;
    // filling: the filler cap comes off and the jug pours; the coolant the same with its own cap and bottle, the level rising in the tank
    var filling = key === 'oilfill' && J.stepP > 0, capT = gcEase(A, 'cap', key === 'oilfill' ? 1 : 0, 8, snap, dt);
    P.cap.position.set(P.capBase[0], P.capBase[1] + capT * 0.03, P.capBase[2] + capT * 0.09); P.can.visible = filling; P.canStream.visible = filling;
    var cooling = key === 'coolant' && J.stepP > 0, ccT = gcEase(A, 'ccap', key === 'coolant' ? 1 : 0, 8, snap, dt);
    P.coolCap.position.set(P.coolCapBase[0], P.coolCapBase[1] + ccT * 0.03, P.coolCapBase[2] + ccT * 0.09); P.cbottle.visible = cooling;
    var level = fault === 'coolant' && !fixed('coolant') ? 0.3 : 0.85; if (live('coolant')) level = 0.3 + Math.min(1.1, J.stepP) * 0.55; level = gcEase(A, 'cool', level, 8, snap, dt);
    P.coolFluid.scale.y = level; P.coolFluid.position.y = 0.76 + 0.07 * level;   // the tank's bottom stays put as the level rises
    // the battery: the clamp unbolts and comes off, the old battery lifts out and the new one goes in; a loose terminal is furred white
    var clampT = live('clamp') ? p : (done('clamp') && !over) ? 1 : 0; clampT = gcEase(A, 'clamp', clampT, 10, snap, dt);
    P.clamp.position.y = P.clampBase + clampT * 0.14; P.clamp.position.x = 1.72 + clampT * 0.12; P.clamp.rotation.y = clampT * 0.6;
    var bu = live('battery') ? p : 0; P.battery.position.y = P.batteryBase + gcUpDown(bu) * 0.34;
    P.batLabel.material = fault === 'battery' && !fixed('battery') ? M.labelOld : M.labelNew;
    P.termNut.rotation.y = live('terminal') ? p * 18 : 0; P.fuzz.visible = fault === 'terminal' && !fixed('terminal');
    // the headlight: its cover twists off the back, the bulb comes out and a new one goes in; the lamp lights again once it is fixed
    var lu = live('bulb') ? p : 0, capOut = lu < 0.3 ? lu / 0.3 : lu < 0.7 ? 1 : (1 - lu) / 0.3, bulbOut = lu < 0.3 ? 0 : lu < 0.5 ? (lu - 0.3) / 0.2 : lu < 0.7 ? (0.7 - lu) / 0.2 : 0;
    P.lampCap.position.x = P.lampCapBase - capOut * 0.12; P.lampCap.rotation.x = capOut * 2.4; P.bulb.position.x = P.bulbBase - bulbOut * 0.16; P.bulb.visible = capOut > 0.4;
    var lensMat = fault === 'bulb' && !fixed('bulb') ? M.trim : M.head; P.lensNear.forEach(function (m) { m.material = lensMat; });
    // the air box: the lid lifts, the filter comes up out of it (dirty when that is the fault) and a clean one goes back; a look for a check opens it too
    var au = live('airfilter') ? p : 0, lidUp = au < 0.3 ? au / 0.3 : au < 0.7 ? 1 : (1 - au) / 0.3, elUp = au < 0.3 ? 0 : au < 0.5 ? (au - 0.3) / 0.2 : au < 0.7 ? (0.7 - au) / 0.2 : 0;
    if (G.hold && G.hold.check === 'airbox' && G.hold.bay === b && J && J.diag) lidUp = Math.min(1, J.diag.p * 2);
    lidUp = gcEase(A, 'air', lidUp, 12, snap, dt); P.airLid.position.y = P.airLidBase + lidUp * 0.14; P.airLid.rotation.z = lidUp * 0.6; P.airFilter.position.y = P.airFilterBase + elUp * 0.24;
    var pm = fault === 'airfilter' && !fixed('airfilter') ? M.pleatDirty : M.pleat; P.airPleats.forEach(function (m) { m.material = pm; });
    // the spark plugs: the coil packs lift, the plugs come out (sooty when that is the fault) and new ones go in
    var pu = live('plugs') ? p : 0, coilUp = pu < 0.25 ? pu / 0.25 : pu < 0.75 ? 1 : (1 - pu) / 0.25, plugUp = pu < 0.25 ? 0 : pu < 0.5 ? (pu - 0.25) / 0.25 : pu < 0.75 ? (0.75 - pu) / 0.25 : 0;
    var sm = fault === 'plugs' && !fixed('plugs') ? M.sooty : M.ceramic;
    P.coils.forEach(function (c, i) { c.position.y = c.userData.base + coilUp * (0.12 + i * 0.01); }); P.plugs.forEach(function (pl) { pl.position.y = pl.userData.base + plugUp * 0.16; pl.children[0].material = sm; });
    // the wipers lift off the glass while the blades are changed
    var wl = gcEase(A, 'wip', live('wipers') ? Math.sin(p * Math.PI) : 0, 12, snap, dt); P.wipers.forEach(function (w) { w.rotation.x = wl * 0.9; });
    // the new parts waiting by the car: taken off the rack, out of your hands, not yet fitted (a fit step past half way has put it in)
    var waiting = [];
    if (J && J.state === 'taken' && !(S.hand && S.hand.kind === 'parts' && S.hand.bay === b)) {
      var st = stepsOf(J), got = {}, fit = {};
      for (var si = 0; si < st.length; si++) { var x = st[si]; if (si < J.step) { if (x.act === 'fetch') got[x.fault] = true; if (x.fit) fit[x.fault] = true; } else if (si === J.step && x.fit && J.stepP > 0 && (x.anim === 'oilfill' || x.anim === 'coolant' || J.stepP > 0.5)) fit[x.fault] = true; }
      Object.keys(got).forEach(function (f) { if (!fit[f]) (faultById(f).parts || []).forEach(function (pt) { waiting.push(pt); }); });
    }
    var wkey = waiting.join(',');
    if (wkey !== P.floorParts.userData.key) { while (P.floorParts.children.length) P.floorParts.remove(P.floorParts.children[0]); waiting.forEach(function (pt, i) { var pm = gcPartMesh(pt); pm.position.set((i % 3) * 0.26, 0, Math.floor(i / 3) * 0.3); pm.rotation.y = 0.3 * i; P.floorParts.add(pm); }); P.floorParts.userData.key = wkey; }
    P.floorParts.position.y = -h;
    // the exhaust: the old silencer is unbolted and lowered to the floor, the new one (bright) is lifted into place and bolted on
    var exT = live('exhoff') ? p : live('exhon') ? 1 - p : (done('exhoff') && !done('exhon') && !over) ? 1 : 0; exT = gcEase(A, 'exh', exT, 10, snap, dt);
    P.silencer.position.y = P.silencerBase + (-h + 0.08 - P.silencerBase) * exT; P.silencer.rotation.x = exT * 0.15;
    var exNew = done('exhoff') || (fault === 'exhaust' && over); P.silencer.children.forEach(function (m) { m.material = exNew ? M.exhaustNew : M.exhaust; });
  }

  // ── The tools ─────────────────────────────────────────────────────
  // each tool hangs with its long side up, centred on its hook; the same model goes in your hand
  function gcToolMesh(t) {
    var M = gcMats(), g = new THREE.Group();
    if (t === 'spanner') {
      box(0.024, 0.22, 0.008, M.chrome, 0, 0, 0, g); var ring = gcMesh(new THREE.TorusGeometry(0.026, 0.009, 6, 16), M.chrome, g, 0, 0.13, 0);
      box(0.012, 0.045, 0.009, M.chrome, -0.02, -0.13, 0, g).rotation.z = 0.2; box(0.012, 0.045, 0.009, M.chrome, 0.02, -0.13, 0, g).rotation.z = -0.2; box(0.05, 0.016, 0.009, M.chrome, 0, -0.112, 0, g);
    } else if (t === 'brace') {
      cyl(0.011, 0.4, M.steel, 0, 0.02, 0, g, 8); gcXcyl(0.011, 0.14, M.steel, 0.07, -0.18, 0, g, 8); cyl(0.022, 0.06, M.chrome, 0.14, -0.17, 0, g, 12); cyl(0.018, 0.05, M.chrome, 0, 0.24, 0, g, 12);
    } else if (t === 'filterwrench') {
      cyl(0.012, 0.22, M.red, 0, -0.04, 0, g, 8); cyl(0.016, 0.1, M.tyre, 0, -0.12, 0, g, 10); var band = gcMesh(new THREE.TorusGeometry(0.05, 0.006, 6, 20), M.steel, g, 0, 0.12, 0); band.rotation.x = Math.PI / 2;
    } else if (t === 'socket') {
      box(0.022, 0.18, 0.012, M.chrome, 0, -0.02, 0, g); cyl(0.016, 0.07, M.tyre, 0, -0.08, 0, g, 10); gcZcyl(0.028, 0.02, M.chrome, 0, 0.08, 0, g, 14); cyl(0.013, 0.1, M.chrome, 0, 0.13, 0.012, g, 10);
    } else if (t === 'reader') {
      gcMesh(bevelGeo(0.09, 0.15, 0.03, 0.01), M.yellow, g, 0, 0.02, 0); box(0.066, 0.05, 0.004, M.screen, 0, 0.05, 0.016, g);
      [-0.02, 0.02].forEach(function (x) { box(0.016, 0.012, 0.004, M.trim, x, 0.0, 0.016, g); }); box(0.016, 0.016, 0.004, M.red, 0, -0.025, 0.016, g);
      cyl(0.005, 0.12, M.trim, 0, -0.12, 0, g, 6); box(0.03, 0.03, 0.02, M.trim, 0, -0.19, 0, g);
    }
    return g;
  }
  // ── The parts, as they sit on the shelves ─────────────────────────
  // each part type has its own look: a jug of oil, a filter, a battery, a coolant bottle, a pleated air filter, a tin of plugs, or a
  // printed carton for the rest. Made once a type, cloned for each one on a shelf (the clones share geometry and materials)
  var GC_PARTS = {};
  function gcLabelMat(p) {
    var key = 'lbl:' + p; if (GC_PARTS[key]) return GC_PARTS[key];
    var c = document.createElement('canvas'); c.width = 256; c.height = 160; var x = c.getContext('2d'), P = PARTS[p] || { name: p, col: 0x888888 };
    x.fillStyle = '#b48a5a'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#' + ('000000' + P.col.toString(16)).slice(-6); x.fillRect(0, 0, 256, 46); x.fillRect(0, 140, 256, 20);
    x.fillStyle = '#1b232c'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; var words = String(P.name).toUpperCase().split(' '), l1 = words.slice(0, Math.ceil(words.length / 2)).join(' '), l2 = words.slice(Math.ceil(words.length / 2)).join(' ');
    x.fillText(l1, 128, 86); if (l2) x.fillText(l2, 128, 122); x.fillStyle = '#ffffff'; x.font = 'bold 22px sans-serif'; x.fillText('GARAGE CO. PARTS', 128, 32);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return (GC_PARTS[key] = std({ map: t, roughness: 0.9 }));
  }
  function gcCarton(p, w, h, d, parent, y) { var M = gcMats(), L = gcLabelMat(p), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [M.cardboard, M.cardboard, L, M.cardboard, L, L]); m.position.y = y + h / 2; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function gcPartMesh(p) {
    if (!GC_PARTS[p]) {
      var M = gcMats(), g = new THREE.Group();
      if (p === 'oil') { gcMesh(bevelGeo(0.15, 0.2, 0.1, 0.02), M.yellow, g, 0, 0.1, 0); var hd = gcMesh(new THREE.TorusGeometry(0.03, 0.01, 6, 12), M.yellow, g, 0.035, 0.2, 0); cyl(0.02, 0.03, M.trim, -0.045, 0.215, 0, g, 10); box(0.11, 0.08, 0.004, gcLabelMat(p), 0, 0.09, 0.052, g); }
      else if (p === 'oilfilter') { cyl(0.05, 0.1, M.blue, 0, 0.05, 0, g, 16); cyl(0.04, 0.012, M.steel, 0, 0.106, 0, g, 16); }
      else if (p === 'battery') { box(0.18, 0.15, 0.12, M.black, 0, 0.075, 0, g); box(0.182, 0.04, 0.122, M.labelNew, 0, 0.09, 0, g); cyl(0.014, 0.025, M.red, 0.05, 0.16, 0.03, g, 8); cyl(0.014, 0.025, M.trim, -0.05, 0.16, 0.03, g, 8); }
      else if (p === 'coolant') { cyl(0.045, 0.17, M.pink, 0, 0.085, 0, g, 14); cyl(0.022, 0.03, M.trim, 0, 0.185, 0, g, 10); box(0.06, 0.07, 0.004, gcLabelMat(p), 0, 0.08, 0.045, g); }
      else if (p === 'airfilter') { box(0.19, 0.03, 0.23, M.orange, 0, 0.015, 0, g); for (var q = 0; q < 6; q++) box(0.025, 0.03, 0.2, M.pleat, -0.075 + q * 0.03, 0.03, 0, g); }
      else if (p === 'plugkit') { cyl(0.05, 0.05, M.orange, 0, 0.025, 0, g, 16); cyl(0.05, 0.006, M.steel, 0, 0.052, 0, g, 16); }
      else if (p === 'wipers') gcCarton(p, 0.07, 0.05, 0.25, g, 0);
      else if (p === 'bulb') { gcCarton(p, 0.08, 0.1, 0.06, g, 0); gcCarton(p, 0.08, 0.1, 0.06, g, 0).position.x = 0.09; }
      else if (p === 'pads') gcCarton(p, 0.18, 0.08, 0.14, g, 0);
      else if (p === 'plugs') gcCarton(p, 0.15, 0.06, 0.1, g, 0);
      else if (p === 'tyre') { var ty = gcMesh(gcTyreGeo(), M.tyre, g, 0, 0.11, 0); ty.scale.set(0.33, 0.33, 0.33); gcCarton(p, 0.2, 0.02, 0.22, g, 0); }
      else if (p === 'exhaust') { gcCarton(p, 0.2, 0.12, 0.25, g, 0); }
      else if (p === 'discs') gcCarton(p, 0.2, 0.07, 0.2, g, 0);
      else gcCarton(p, 0.2, 0.16, 0.24, g, 0);
      g.traverse(function (o) { o.castShadow = true; });
      GC_PARTS[p] = g;
    }
    return GC_PARTS[p].clone();
  }

  // ── In your hands ─────────────────────────────────────────────────
  // what you carry shows at the bottom of the view: the tool off the wall, a wheel on its way to the tyre corner, a job's parts. It
  // works a little while you hold E at a step. Not while you drive
  function gcHeldSync(dt) {
    if (typeof camera === 'undefined' || !camera) return;
    var key = G.drive ? '' : (S.tool || '') + '|' + (S.hand ? S.hand.kind + ':' + S.hand.bay : '');
    var H = G.held || (G.held = { g: null, key: null, t: 0 });
    if (key !== H.key) {
      if (H.g) scene.remove(H.g); H.g = null; H.key = key;
      if (key && key !== '|') {
        var g = new THREE.Group(); g.userData.dynamic = true; H.g = g; scene.add(g);
        if (S.tool) { var tm = gcToolMesh(S.tool); tm.position.set(0.26, -0.27, -0.45); tm.rotation.set(-0.5, 0.45, 0.75); tm.scale.set(0.6, 0.6, 0.6); g.add(tm); H.tool = tm; } else H.tool = null;
        if (S.hand && S.hand.kind === 'wheel') { var wm = gcWheelMesh(1); wm.position.set(-0.05, -0.42, -0.62); wm.rotation.set(0.3, 0.4, 0); wm.scale.set(0.9, 0.9, 0.9); g.add(wm); }
        else if (S.hand && S.hand.kind === 'parts') { var J = jobAt(S.hand.bay), list = J ? partsOf(J.faults || []) : []; if (list.length) { var pm = gcPartMesh(list[0]); pm.position.set(-0.24, -0.34, -0.62); pm.rotation.set(0.25, 0.6, 0); pm.scale.set(0.55, 0.55, 0.55); g.add(pm); } }
        g.traverse(function (o) { o.castShadow = false; o.receiveShadow = false; });
      }
    }
    if (!H.g) return;
    H.t += dt || 0; H.g.position.copy(camera.position); H.g.quaternion.copy(camera.quaternion);
    if (H.tool) { var work = G.hold && !G.hold.fill ? Math.sin(H.t * 16) * 0.18 : 0; H.tool.rotation.z = 0.75 + work; H.tool.position.y = -0.27 + Math.sin(H.t * 2) * 0.004; }
  }
  // the driver's view: in the left seat (left-hand drive), looking over the dashboard; the steering wheel turns with A and D, right for D
  function gcDriverCamera(C, D) {
    C.g.updateMatrixWorld(true); var e = C.g.localToWorld(new THREE.Vector3(-0.22, 1.22, -0.4));
    camera.position.copy(e); camera.rotation.set(D.look ? D.look.pitch : 0, D.v.yaw + Math.PI + (D.look ? D.look.yaw : 0), 0, 'YXZ');
    var P = C.g.userData.parts; if (P && P.steer) { var want = ((player.keys.KeyD ? 1 : 0) - (player.keys.KeyA ? 1 : 0)) * 1.4; P.steer.rotation.x += (want - P.steer.rotation.x) * 0.15; }
  }
