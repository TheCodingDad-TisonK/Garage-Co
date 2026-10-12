//@ Garage Co., part 02: the stock. Parts on the shelves, orders from the supplier on the PC, the parts van that brings them, and the delivery you put away.
  // ── The shelves ───────────────────────────────────────────────────
  // S.stock counts what is on the shelves, part by part. The parts rack holds 24; the stores shed (bought) 40 more; the parts store of
  // the two-bay garage 60 more. Boxes on the shelves show it, a colour a part
  function stockTotal() { var n = 0; for (var p in S.stock) n += S.stock[p] || 0; return n; }
  function stockCap() { return 24 + (owns('shed') ? 40 : 0) + (grown() ? 60 : 0); }
  function stockLine() { var a = []; Object.keys(PARTS).forEach(function (p) { if (S.stock[p]) a.push(S.stock[p] + ' ' + PARTS[p].name); }); return a.length ? a.join(', ') : 'empty'; }
  function onOrder(p) { var n = 0; (S.orders || []).forEach(function (o) { if (o.part === p) n += o.n; }); if (S.delivery) n += S.delivery.parts[p] || 0; return n; }
  // the parts on the shelves, each in its own look (02-car.js, gcPartMesh): the rack first, then the shed, then the parts store
  function stockDraw() {
    var units = []; Object.keys(PARTS).forEach(function (p) { for (var i = 0; i < (S.stock && S.stock[p] || 0); i++) units.push(p); });
    var fill = function (grp, shelves, per, x0, dx, n0, dz) {
      if (!grp) return n0; while (grp.children.length) grp.remove(grp.children[0]);
      var n = n0; for (var s = 0; s < shelves.length; s++) for (var k = 0; k < per; k++) { if (n >= units.length) return n; var m = gcPartMesh(units[n]); m.position.set(x0 + k * dx, shelves[s] + 0.02, dz || 0); grp.add(m); n++; }
      return n;
    };
    var n = fill(G.rackBoxes, [0.42, 1.02, 1.62], 8, -0.8, 0.228, 0);
    n = fill(G.shedBoxes, [0.32, 0.92, 1.52, 2.1], 10, -1.2, 0.27, n);
    fill(G.store2Boxes, [0.37, 0.97, 1.57], 20, -1.8, 0.19, n);
    if (screens.length) screenDirtyAll();
  }
  // ── Orders and the parts van ──────────────────────────────────────
  // an order is paid when it is placed. Standard comes on the van at half past eight the next morning; express comes within the hour for
  // a flat fee. The van parks by the roll door and the driver leaves the boxes on a pallet; E on it puts them on the shelves
  var EXPRESS_FEE = 15;
  function orderParts(basket, express) {
    var cost = 0, n = 0; for (var p in basket) { cost += PARTS[p].cost * basket[p]; n += basket[p]; }
    if (!n) return 'The basket is empty.';
    if (stockTotal() + onOrderTotal() + n > stockCap()) return 'No room: the shelves hold ' + stockCap() + ' and ' + (stockTotal() + onOrderTotal()) + ' are on them or coming.';
    if (express) cost += EXPRESS_FEE;
    if (S.bank < cost) return 'Not enough in the bank: ' + money(cost) + '.';
    pay(-cost, 'parts order' + (express ? ', express' : ''));
    var due = express ? { day: S.day, time: Math.min(CLOSE_AT - 0.2, S.time + 1) } : { day: S.day + 1, time: 8.5 };
    for (var q in basket) if (basket[q]) S.orders.push({ part: q, n: basket[q], due: due, express: !!express });
    sfx('ok'); logEvent('Ordered ' + n + ' part' + (n > 1 ? 's' : '') + ' for ' + money(cost) + (express ? ': express, the van comes within the hour.' : ': the van comes at half past eight tomorrow.'), 'good');
    screenDirtyAll(); hudDirty = true; return '';
  }
  function onOrderTotal() { var n = 0; (S.orders || []).forEach(function (o) { n += o.n; }); if (S.delivery) for (var p in S.delivery.parts) n += S.delivery.parts[p]; return n; }
  function dueNow(o) { return o.due.day < S.day || (o.due.day === S.day && S.time >= o.due.time); }
  function tickVan(dt) {
    if (!G.van && S.orders.some(dueNow) && S.time >= OPEN_AT) vanCome();
    var V = G.van; if (!V) return;
    if (V.wait > 0) { V.wait -= dt; if (V.wait <= 0) vanDrop(); return; }
    if (!V.path.length) { if (V.leaving) { scene.remove(V.g); G.van = null; } return; }
    var p = V.path[0]; if (moveTo(V, p[0], p[1], p[2], dt)) { V.path.shift(); if (!V.path.length && !V.leaving) V.wait = 3; }
    V.g.position.set(V.x, 0, V.z); V.g.rotation.y = V.yaw; var ws = V.g.userData.wheels; if (ws && V.speed) ws.forEach(function (w) { w.rotation.z -= V.speed * dt / 0.33; });
  }
  function dropSpot() { var o = LO(); return { x: o.x - 2.4, z: o.z + LOCKUP.z + 1.6 }; }
  function vanCome() {
    var load = S.orders.filter(dueNow); S.orders = S.orders.filter(function (o) { return !dueNow(o); });
    var g = gcCar({ col: 0xf3efe4, plate: 'PARTS', van: true }); g.userData.dynamic = true; scene.add(g);
    var d = dropSpot(); G.van = { g: g, x: -78, z: ROAD_Z + LANE, yaw: 0, speed: 0, load: load, wait: 0, path: [[ENTRY_X, ROAD_Z + LANE, 9], [ENTRY_X, APRON_Z - 4, 3.5], [d.x + 1.2, d.z + 4.5, 3]] };
    g.position.set(G.van.x, 0, G.van.z); logEvent('The parts van is on its way in.', '');
  }
  function vanDrop() {
    var V = G.van, parts = (S.delivery && S.delivery.parts) || {}; V.load.forEach(function (o) { parts[o.part] = (parts[o.part] || 0) + o.n; });
    S.delivery = { parts: parts }; pileBuild(); sfx('crate'); toast('The parts van left a delivery by the roll door.', 'good'); logEvent('The parts van left a delivery by the roll door: ' + pileLine() + '.', 'good');
    V.leaving = true; V.path = [[ENTRY_X, APRON_Z - 4, 3.5], [ENTRY_X, ROAD_Z + LANE, 3.5], [90, ROAD_Z + LANE, 10]]; screenDirtyAll();
  }
  function pileLine() { var a = []; if (S.delivery) for (var p in S.delivery.parts) if (S.delivery.parts[p]) a.push(S.delivery.parts[p] + ' ' + PARTS[p].name); return a.join(', '); }
  // the delivery: a pallet with boxes by the roll door until it is put away
  function pileBuild() {
    if (G.pile) { var k = inter.indexOf(G.pileHit); if (k >= 0) inter.splice(k, 1); scene.remove(G.pile); G.pile = null; }
    if (!S.delivery) return; var d = dropSpot(), g = new THREE.Group(); g.userData.dynamic = true; g.position.set(d.x, 0, d.z); scene.add(g); G.pile = g;
    box(1.0, 0.12, 0.8, MAT.wood, 0, 0.06, 0, g); var i = 0; for (var p in S.delivery.parts) for (var k2 = 0; k2 < Math.min(6, S.delivery.parts[p]); k2++, i++) { var m = gcPartMesh(p); m.position.set(-0.35 + (i % 4) * 0.23, 0.12 + Math.floor(i / 8) * 0.25, -0.2 + (Math.floor(i / 4) % 2) * 0.4); g.add(m); }
    G.pileHit = hitBox(1.1, 0.8, 0.9, 0, 0.4, 0, { prompt: function () { return 'Put the delivery on the shelves: ' + pileLine(); }, use: function () { putAway('player'); } }, g);
  }
  function putAway(by) {
    if (!S.delivery) return false; var room = stockCap() - stockTotal(), moved = 0, left = {};
    for (var p in S.delivery.parts) { var n = Math.min(S.delivery.parts[p], room); S.stock[p] = (S.stock[p] || 0) + n; room -= n; moved += n; if (S.delivery.parts[p] - n > 0) left[p] = S.delivery.parts[p] - n; }
    S.delivery = Object.keys(left).length ? { parts: left } : null; pileBuild(); stockDraw(); sfx('crate');
    toast((by === 'player' ? 'On the shelves: ' : by + ' put the delivery away: ') + moved + ' parts.' + (S.delivery ? ' No room for the rest.' : ''), S.delivery ? 'bad' : 'good');
    jobList().forEach(function (J) { if (J.hold === 'parts' && !missingParts(J).length) J.hold = null; });
    screenDirtyAll(); hudDirty = true; return true;
  }
  // the supplier account (level 5): at closing time, anything below its minimum is ordered up to it for the morning van
  function stockDayEnd() {
    if (S.level < 5) return; var basket = {}, any = false;
    Object.keys(S.minStock || {}).forEach(function (p) { var want = S.minStock[p] - (S.stock[p] || 0) - onOrder(p); if (want > 0) { basket[p] = want; any = true; } });
    if (any) { var err = orderParts(basket, false); if (err) logEvent('The supplier account could not reorder: ' + err, 'bad'); else logEvent('The supplier account reordered to your minimums.', ''); }
  }
