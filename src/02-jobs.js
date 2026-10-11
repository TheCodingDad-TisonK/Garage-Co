//@ Garage Co., part 02: cars and jobs. Cars come off the road into the bays, the customer walks to the desk, you take the job, work it step by step (02-work.js) and take the money.
  // ── Cars ──────────────────────────────────────────────────────────
  // One car a bay: one bay in the lock-up, two once the garage has grown. S.jobs[b] is the save's record of bay b (the car and where its
  // job stands); G.bays[b] holds the live car mesh and the customer, rebuilt from the record on load. The job's states, in order:
  //   coming (on the road, then into the bay)  waiting (parked, the customer walks to the desk)  taken (the steps, 02-work.js)
  //   done (fixed; the payment waits at the desk)  paid (the customer walks back)  leaving (the car drives off; then the bay is free)
  function bayCount() { return grown() ? 2 : 1; }
  function bayOf(b) { return G.bays[b] || (G.bays[b] = { car: null, customer: null }); }
  function jobAt(b) { return S.jobs[b] || null; }
  function jobList() { var out = []; for (var b = 0; b < bayCount(); b++) if (S.jobs[b]) out.push(S.jobs[b]); return out; }
  function carIn(b) { return bayOf(b).car; }
  function customerIn(b) { return bayOf(b).customer; }
  // the jobs the shop can do now: opened by level, and the ones that need a room or a tool only once it is bought
  function faultsOpen() { return FAULTS.filter(function (f) { return f.lvl <= S.level && (!f.needs || owns(f.needs)); }); }
  function newCar(faultId) {
    var pool = faultsOpen(), f = faultId ? faultById(faultId) : pick(pool);
    var car = { id: uid('car'), make: pick(MAKES), col: pick(CAR_COLS), name: pick(NAMES), fault: f.id, plate: 'GC ' + randi(10, 99) + ' ' + pick(['AB', 'KH', 'NL', 'XY']) + randi(100, 999) };
    // about a car in three has a second thing wrong that the customer did not mention: you spot it and offer it (the upsell)
    var others = pool.filter(function (x) { return x.id !== f.id; });
    if (others.length && Math.random() < 0.33) car.extra = pick(others).id;
    return car;
  }
  function jobFaults(J) { return J.faults || [J.car.fault]; }
  function jobName(J) { return jobFaults(J).map(function (id) { return faultById(id).job; }).join(' and '); }
  function partsOf(faults) { var out = []; faults.forEach(function (id) { (faultById(id).parts || []).forEach(function (p) { out.push(p); }); }); return out; }
  // labour goes up with the name the garage has; parts go on the invoice at their selling price
  function labourMul() { return 0.9 + S.rep / 250; }
  function priceFor(faults) { var lab = 0, parts = 0; faults.forEach(function (id) { lab += faultById(id).price; }); partsOf(faults).forEach(function (p) { parts += (PARTS[p] || { sell: 0 }).sell; }); return { labour: Math.round(lab * labourMul()), parts: parts, total: Math.round(lab * labourMul()) + parts }; }
  function freeBay() { for (var b = 0; b < bayCount(); b++) if (!S.jobs[b] && !carIn(b)) return b; return -1; }
  function carPrompt(b) {
    var J = jobAt(b); if (!J) return null;
    if (J.state === 'waiting') return 'Look at the ' + J.car.make + ': ' + J.car.name + ' is coming to the desk';
    if (J.state === 'taken') { var s = curStep(J), onLift = J.lift !== null && J.lift !== undefined, drive = canDrive(b) ? '' : onLift ? ' · E: get in' : ' · E: drive it onto the lift'; return J.car.name + "'s " + J.car.make + ' · ' + jobName(J) + (s ? ' · next: ' + s.label + ' (' + placeName(s.at) + ')' : '') + drive; }
    if (J.state === 'done') return 'Fixed. ' + J.car.name + ' pays at the desk';
    return J.car.name + "'s " + J.car.make;
  }
  function carUse(b) { var J = jobAt(b); if (!J) return; if (J.state === 'waiting') { toast(J.car.name + ' is on the way to the desk. Take the job there.', ''); return; } if ((J.state === 'taken' || J.state === 'done') && !canDrive(b)) { getIn(b); return; } var s = curStep(J); if (s) toast('Next: ' + s.label + ' at ' + placeName(s.at) + '.', ''); }
  function nearCar(b, r) { var C = carIn(b || 0); r = r || 3.2; return !!C && dist2(player.x, player.z, C.x, C.z) < r * r; }
  // a car arrives on the road from the west, comes through the gap in the bollards, along the apron, and noses into its bay
  function spawnCar(b, car, comeback) {
    if (b === undefined || b === null) b = freeBay(); if (b < 0 || carIn(b)) return null;
    car = car || newCar(); var faults = [car.fault], pr = priceFor(faults);
    S.jobs[b] = { bay: b, car: car, faults: faults, state: 'coming', step: 0, stepP: 0, price: comeback ? 0 : pr.total, parts: comeback ? 0 : pr.parts, day: S.day, due: null, assign: null, vis: {}, comeback: !!comeback, offered: false };
    placeCar(b, car, -78, ROAD_Z + LANE, 0, arrivePath(b));
    logEvent(comeback ? car.name + ' is coming back with the ' + car.make + '. Something is not right.' : car.name + ' is on the way in a ' + car.make + '.', comeback ? 'bad' : ''); hudDirty = true; screenDirtyAll();
    return car;
  }
  function arrivePath(b) { var B = BAYS[b]; return [[ENTRY_X, ROAD_Z + LANE, 9], [ENTRY_X, APRON_Z, 3.5], [B.x, APRON_Z, 3.5], [B.x, B.z, 3]]; }
  function leavePath(b) { var B = BAYS[b], off = liftExit(b); return (off || [[B.x, APRON_Z, 3]]).concat([[ENTRY_X, APRON_Z, 3.5], [ENTRY_X, ROAD_Z + LANE, 3.5], [90, ROAD_Z + LANE, 10]]); }
  function placeCar(b, car, x, z, yaw, path) {
    var g = carMesh({ col: car.col, plate: car.plate }); g.userData.dynamic = true; scene.add(g); g.position.set(x, 0, z); g.rotation.y = yaw;
    var C = { rec: car, g: g, x: x, z: z, yaw: yaw, path: path || [], speed: 0, bay: b };
    bayOf(b).car = C;
    C.hit = hitBox(4.4, 1.5, 2.0, 0, 0.75, 0, { gcCar: b, prompt: function () { return carPrompt(b); }, use: function () { carUse(b); } }, g);
    carParts(b, C);
    return C;
  }
  function removeCar(b) { b = b || 0; var C = carIn(b); if (!C) return; C.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); scene.remove(C.g); bayOf(b).car = null; }
  // a straight run to a point at a speed; the car faces where it goes (the mesh's front is +x at yaw 0)
  // rev: it reverses there, the nose staying where it points (off a lift and out of the roll door)
  function moveTo(v, tx, tz, speed, dt, rev) {
    var dx = tx - v.x, dz = tz - v.z, d = Math.sqrt(dx * dx + dz * dz), st = speed * dt; v.speed = rev ? -speed : speed;
    if (d <= st) { v.x = tx; v.z = tz; return true; }
    v.x += dx / d * st; v.z += dz / d * st; v.yaw = rev ? Math.atan2(dz, -dx) : Math.atan2(-dz, dx); return false;
  }
  function tickCars(dt) {
    // a car is due when a bay is free inside the hours; a comeback that is due comes first. The gap shortens as the name gets about
    if (S.time >= OPEN_AT + 0.25 && S.time < LAST_CAR_AT && worldTime >= G.nextCarAt) {
      var fb = freeBay();
      if (fb >= 0) { var cb = (S.comebacks || []).filter(function (k) { return k.day <= S.day; })[0]; if (cb) { S.comebacks.splice(S.comebacks.indexOf(cb), 1); spawnCar(fb, cb.car, true); } else spawnCar(fb); G.nextCarAt = worldTime + carGap(); }
    }
    for (var b = 0; b < bayCount(); b++) {
      var C = carIn(b), J = jobAt(b);
      if (!C) continue;
      if (!J) { removeCar(b); continue; }
      C.speed = 0;
      if ((J.state === 'coming' || J.state === 'leaving') && C.path.length) {
        var p = C.path[0];
        if (moveTo(C, p[0], p[1], p[2], dt, p[3])) {
          C.path.shift();
          if (!C.path.length && J.state === 'coming') { C.yaw = Math.PI / 2; J.state = 'waiting'; sfx('door'); spawnCustomer(b, J.car); logEvent(J.car.name + ' has parked a ' + J.car.make + ' in bay ' + (b + 1) + '.', 'good'); hudDirty = true; screenDirtyAll(); }
          else if (!C.path.length && J.state === 'leaving') { removeCar(b); S.jobs[b] = null; hudDirty = true; screenDirtyAll(); }
          else if (J.state === 'leaving' && J.lift !== null && J.lift !== undefined && C.path.length <= 4) { J.lift = null; carVis(b); }
        }
      }
      if (carIn(b)) { C.g.position.set(C.x, C.g.position.y, C.z); C.g.rotation.y = C.yaw; var ws = C.g.userData.wheels; if (ws && C.speed) ws.forEach(function (w) { w.rotation.z -= C.speed * dt / 0.33; }); }
    }
  }
  function carGap() { return randf(35, 60) * (1.3 - S.rep / 200); }

  // ── The customers ─────────────────────────────────────────────────
  // one person a bay, on the engine's rig, who walks the route finder's path from the car to the desk and back
  function spawnCustomer(b, car, atDesk) {
    var C = carIn(b); if (!C) return null; removeCustomer(b);
    var g = makeHuman({ name: car.name.replace(/^(Mr|Mrs) /, ''), style: pick(['short', 'long', 'bun', 'cap']) }); scene.add(g);
    var ds = deskStand(b), start = atDesk ? ds : { x: C.x + 1.7, z: C.z }, rec = { x: start.x, z: start.z, yaw: Math.PI, speed: 1.5, path: [] };
    g.position.set(rec.x, 0, rec.z); g.rotation.y = rec.yaw;
    var cu = { g: g, rec: rec, walking: false, at: atDesk ? 'desk' : 'car', goal: 'desk', car: car, bay: b };
    bayOf(b).customer = cu;
    cu.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { prompt: function () { return customerPrompt(b); }, use: function () { customerUse(b); } }, g);
    if (!atDesk) { customerGo(b, 'desk'); say(g, (jobAt(b) && jobAt(b).comeback ? 'You again. ' : 'Morning. ') + faultOf(car).symptom); }
    return cu;
  }
  function customerGo(b, goal) { var c = customerIn(b), C = carIn(b); if (!c) return; c.goal = goal; c.walking = true; var to = goal === 'car' && C ? { x: C.x + 1.7, z: C.z } : deskStand(b); c.rec.path = route({ x: c.rec.x, z: c.rec.z }, to); }
  function removeCustomer(b) { b = b || 0; var c = customerIn(b); if (!c) return; var k = inter.indexOf(c.hit); if (k >= 0) inter.splice(k, 1); scene.remove(c.g); bayOf(b).customer = null; }
  function customerPrompt(b) {
    var J = jobAt(b), c = customerIn(b); if (!J || !c) return null;
    if (c.walking) return J.car.name + (c.goal === 'desk' ? ' is coming to the desk' : ' is going back to the car');
    if (J.state === 'waiting') return 'Take the job from ' + J.car.name + ': ' + faultOf(J.car).symptom + (J.comeback ? ' (a comeback: free)' : ' (' + money(J.price) + ')');
    if (J.state === 'taken') return J.car.extra && !J.offered ? 'Offer ' + J.car.name + ' ' + faultById(J.car.extra).job + ' too (' + money(priceFor([J.car.extra]).total) + ')' : J.car.name + ' is waiting for the ' + J.car.make + (J.due ? ', promised for ' + fmtTime(J.due) : '');
    if (J.state === 'done') return 'Take the payment: ' + money(J.price) + ' for ' + jobName(J);
    return J.car.name;
  }
  function customerUse(b) {
    var J = jobAt(b), c = customerIn(b); if (!J || !c || c.walking) return;
    if (J.state === 'waiting') takeJob(b);
    else if (J.state === 'done') takePayment(b);
    else if (J.state === 'taken') { if (J.car.extra && !J.offered) offerExtra(b); else say(c.g, 'Take your time. Well, not too much.'); }
  }
  // a roll door rides up for anyone walking through it: the customers and the staff
  function someoneNear(dx) {
    var lo = LO(), near = false, at = function (x, z) { if (Math.abs(z - lo.z - LOCKUP.z) < 2.6 && Math.abs(x - lo.x - dx) < 3.2) near = true; };
    G.bays.forEach(function (B) { var c = B && B.customer; if (c && c.walking) at(c.rec.x, c.rec.z); });
    staffList().forEach(function (w) { var R = G.staff[w.id]; if (R && R.rec.path && R.rec.path.length) at(R.rec.x, R.rec.z); });
    G.bays.forEach(function (B) { var C = B && B.car; if (C && (C.path.length || (G.drive && carIn(G.drive.b) === C))) { var f = C.g.localToWorld(new THREE.Vector3(2.4, 0, 0)), r = C.g.localToWorld(new THREE.Vector3(-2.4, 0, 0)); at(f.x, f.z); at(r.x, r.z); at(C.x, C.z); } });
    return near;
  }
  function tickCustomers(dt) {
    G.customerNearDoor = someoneNear(0); G.customerNearDoor2 = grown() && someoneNear(HALL2.doorX);
    for (var b = 0; b < bayCount(); b++) {
      var c = customerIn(b); if (!c) continue;
      if (c.walking) {
        var done = walkAlong(c.rec, c.rec.path, c.rec.speed, dt); c.g.position.set(c.rec.x, 0, c.rec.z); c.g.rotation.y = c.rec.yaw; animateHuman(c.g, dt, done ? 'wait' : 'walk', 1, null, false);
        if (done) {
          c.walking = false; c.at = c.goal;
          if (c.goal === 'desk') { c.rec.yaw = Math.PI; say(c.g, jobAt(b) && jobAt(b).state === 'waiting' ? 'Hello? Anyone about?' : 'Thanks.'); }
          else if (c.goal === 'car') { removeCustomer(b); var J = jobAt(b); if (J) { J.state = 'leaving'; carIn(b).path = leavePath(b); logEvent(J.car.name + ' drove off in the ' + J.car.make + '.'); } }
        }
      } else animateHuman(c.g, dt, 'wait', 0, player ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false);
    }
  }

  // ── The job ───────────────────────────────────────────────────────
  // taking the job sets the promised time: an hour and a half from now
  function takeJob(b, by) {
    b = b || 0; var J = jobAt(b); if (!J || J.state !== 'waiting') return false;
    J.state = 'taken'; J.step = 0; J.stepP = 0; J.due = Math.min(CLOSE_AT, S.time + 1.5); sfx('ok');
    toast('Job card, bay ' + (b + 1) + ': ' + jobName(J) + (J.comeback ? ' (a comeback, no charge)' : ' for ' + money(J.price)) + '. Promised for ' + fmtTime(J.due) + '.', 'good');
    logEvent((by === 'staff' ? 'The desk took' : 'Took') + ' the job: ' + jobName(J) + ' on ' + J.car.name + "'s " + J.car.make + '.', 'good');
    if (customerIn(b)) say(customerIn(b).g, 'Great. I will wait here.'); screenDirtyAll(); hudDirty = true; return true;
  }
  // the upsell: you spotted something else; the customer says yes more often the better your name
  function offerExtra(b) {
    var J = jobAt(b); if (!J || J.state !== 'taken' || !J.car.extra || J.offered) return false;
    J.offered = true; var x = J.car.extra, f = faultById(x), pr = priceFor([x]), c = customerIn(b);
    if (Math.random() < 0.35 + S.rep * 0.0065) {
      J.faults.push(x); J.price += pr.total; J.parts += pr.parts; J.due = Math.min(CLOSE_AT, (J.due || S.time) + 1); J.hold = null;
      if (c) say(c.g, 'Go on then, do that too.'); toast(J.car.name + ' said yes: ' + f.job + ' for ' + money(pr.total) + ' more.', 'good'); addXp(5);
    } else { if (c) say(c.g, 'Not today, thanks.'); toast(J.car.name + ' said no to ' + f.job + '.', ''); }
    screenDirtyAll(); hudDirty = true; return true;
  }
  // the last step done: the car is fixed. A customer who went home for the night comes back for it
  function jobFinished(b, by) {
    var J = jobAt(b); if (!J) return; J.state = 'done'; sfx('bell'); S.stats.fixed++; addXp(10);
    toast('Fixed: ' + jobName(J) + ' on ' + J.car.name + "'s " + J.car.make + '. Take the payment at the desk.', 'good'); logEvent('Fixed ' + jobName(J) + ' on the ' + J.car.make + (by && by !== 'player' ? ' (' + by + ')' : '') + '.', 'good');
    if (J.sloppy) S.comebacks.push({ day: S.day + randi(1, 2), car: { id: J.car.id, make: J.car.make, col: J.car.col, name: J.car.name, fault: J.car.fault, plate: J.car.plate } });
    if (!customerIn(b)) { var cu = spawnCustomer(b, J.car, true); if (cu) say(cu.g, 'I have come for the ' + J.car.make + '.'); }
    if (S.hand && S.hand.bay === b) S.hand = null;
    screenDirtyAll(); hudDirty = true;
  }
  function takePayment(b, by) {
    b = b || 0; var J = jobAt(b); if (!J || J.state !== 'done') return false;
    if (J.price) pay(J.price, jobName(J) + ' for ' + J.car.name); S.stats.jobs++;
    if (J.comeback) repChange(1, 'put a comeback right for ' + J.car.name);
    else if (J.due && S.time <= J.due && !J.overnight) repChange(2, 'on time for ' + J.car.name);
    else { repChange(-1, 'late with ' + J.car.name + "'s " + J.car.make); S.stats.late = (S.stats.late || 0) + 1; }
    S.done.unshift({ day: S.day, t: fmtTime(S.time), name: J.car.name, make: J.car.make, job: jobName(J), price: J.price }); if (S.done.length > 30) S.done.pop();
    sfx('cash'); toast(J.car.name + ' paid ' + money(J.price) + '.', 'good'); logEvent(J.car.name + ' paid ' + money(J.price) + ' for ' + jobName(J) + '.', 'good');
    J.state = 'paid'; var c = customerIn(b); if (c) { say(c.g, by === 'staff' ? 'Thanks, tell the mechanic cheers.' : 'Lovely, thanks. See you next time.'); customerGo(b, 'car'); } else { J.state = 'leaving'; if (carIn(b)) carIn(b).path = leavePath(b); }
    addXp(15); screenDirtyAll(); hudDirty = true; return true;
  }
  // rep: what the town says about you. It sets how often cars come and what they pay for labour; every change is in the books
  function repChange(n, why) { var r0 = S.rep; S.rep = clamp(S.rep + n, 0, 100); if (S.rep === r0) return; S.repLog.unshift({ day: S.day, t: fmtTime(S.time), n: S.rep - r0, why: why }); if (S.repLog.length > 40) S.repLog.pop(); hudDirty = true; }
  // the ladder: a level every so many points; at level 5 the lock-up grows into the two-bay garage overnight
  function xpFor(level) { return 40 + level * 20; }
  var LEVEL_NEWS = { 2: 'Wiper blades and puncture repairs (buy the tyre corner on the PC). The stores shed is for sale.', 3: 'Air filters and spark plugs (buy the plug socket). You can hire an apprentice.', 4: 'Coolant top-ups.', 5: 'The garage grows into a two-bay garage tonight. New tyres (buy the tyre machine), exhausts, a mechanic, and the supplier account reorders for you.', 6: 'Brake discs.', 7: 'You can hire a receptionist for the desk.' };
  function addXp(n) { S.xp += n; while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; sfx('levelup'); toast('Level ' + S.level + '. ' + (LEVEL_NEWS[S.level] || ''), 'rare'); logEvent('Level ' + S.level + '. Word is getting round.' + (LEVEL_NEWS[S.level] ? ' ' + LEVEL_NEWS[S.level] : ''), 'good'); } hudDirty = true; }
  // the day: an hour a minute from eight; the garage shuts at six and the next morning starts at eight
  function tickTime(dt) {
    S.time += dt / 60; hudDirty = hudDirty || Math.floor(S.time * 60) !== G.lastMin; G.lastMin = Math.floor(S.time * 60);
    if (S.time >= CLOSE_AT) dayEnd();
  }
  // closing time. A car still waiting for its customer goes home with them; a car half done stays the night if its parts are on the
  // shelf or on the van, and otherwise the customer takes it away. Then the wages, the reorder, the comebacks and, at level 5, the build
  function dayEnd() {
    for (var b = 0; b < S.jobs.length; b++) {
      var J = S.jobs[b]; if (!J) continue;
      if (J.state === 'coming' || J.state === 'paid' || J.state === 'leaving') { removeCustomer(b); removeCar(b); S.jobs[b] = null; continue; }
      if (J.state === 'waiting') { repChange(-1, J.car.name + ' waited at the desk until closing'); removeCustomer(b); removeCar(b); S.jobs[b] = null; continue; }
      if (J.state === 'taken') {
        if (partsCovered(J)) { J.overnight = true; removeCustomer(b); repChange(-1, J.car.name + "'s " + J.car.make + ' had to stay the night'); logEvent(J.car.name + "'s " + J.car.make + ' stays the night in bay ' + (b + 1) + '.', 'bad'); }
        else { repChange(-3, J.car.name + ' took the ' + J.car.make + ' away: no parts'); logEvent(J.car.name + ' took the ' + J.car.make + ' away unfixed: the parts were not there.', 'bad'); removeCustomer(b); removeCar(b); if (S.hand && S.hand.bay === b) S.hand = null; S.jobs[b] = null; }
        continue;
      }
      if (J.state === 'done') { removeCustomer(b); J.overnight = true; }
    }
    staffDayEnd(); stockDayEnd();
    S.day++; S.time = OPEN_AT; S.stats.days++; G.nextCarAt = worldTime + 10;
    var grow = S.level >= 5 && S.stage < 2;
    if (grow) { S.stage = 2; growClear(); logEvent('Overnight the builders knocked through: the lock-up is a two-bay garage now, with a parts store, an office and a waiting corner.', 'rare'); }
    for (var k = 0; k < S.jobs.length; k++) { var Jk = S.jobs[k]; if (Jk && Jk.state === 'done' && carIn(k) && !customerIn(k)) spawnCustomer(k, Jk.car, true); }
    logEvent('Day ' + S.day + '. The garage opens at eight.', ''); save(); hudDirty = true; screenDirtyAll();
    if (grow) growReload();
  }
  // the build: whatever you placed where the new hall stands goes (your fence along the front, a cone), then the page loads the new world
  function growClear() {
    var o = LO(), x0 = o.x + HALL2.x0 - 0.3, x1 = o.x + HALL2.x1 + 0.3, z0 = o.z + HALL2.z0 - 0.3, z1 = o.z + HALL2.z1 + 0.3;
    Object.keys(propInst).forEach(function (id) { var P = propPlacement(id); if (id === 'officeDesk' || inLockupOnly(P.x, P.z)) return; if (P.x > x0 && P.x < x1 && P.z > z0 && P.z < z1) S.layout[id] = Object.assign({}, S.layout[id] || {}, { hidden: true }); });
  }
  function inLockupOnly(x, z) { var o = LO(); return Math.abs(x - o.x) < LOCKUP.x && Math.abs(z - o.z) < LOCKUP.z; }
  function growReload() { if (ui.testing || G.noReload) { G.grewAt = worldTime; return; } toast('The garage has grown. Loading the new building…', 'rare'); setTimeout(function () { saveNow(); location.reload(); }, 1500); }
  // a saved bay comes back as it was: the car in the bay with its bonnet, jack and wheel as they were, the customer at the desk unless
  // they went home for the night; a car still on the road, or already paid, is let go
  function restoreJobs() {
    for (var b = 0; b < S.jobs.length; b++) {
      var J = S.jobs[b]; if (!J) continue;
      if (b >= bayCount() || J.state === 'coming' || J.state === 'leaving' || J.state === 'paid') { if (S.hand && S.hand.bay === b) S.hand = null; S.jobs[b] = null; continue; }
      if (!J.faults) J.faults = [J.car.fault]; if (!J.vis) J.vis = {}; if (J.step === undefined) J.step = 0; if (J.state === 'fixing') J.state = 'taken';
      var onLift = J.lift !== null && J.lift !== undefined; if (onLift && !liftBuilt(J.lift)) { J.lift = null; onLift = false; }
      var at = onLift ? liftWorld(J.lift) : BAYS[b];
      placeCar(b, J.car, at.x, at.z, onLift && J.pos ? J.pos.yaw : Math.PI / 2, []); workRestore(b);
      if (!J.overnight || J.state === 'done') spawnCustomer(b, J.car, true);
    }
  }
  // the job card on the bench: each bay, the step it is on, and the buttons for the desk
  function drawJobCard(c, sc) {
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'JOB CARD', 'Day ' + S.day);
    var n = bayCount(), h = (sc.h - 50) / n;
    for (var b = 0; b < n; b++) {
      var y = 50 + b * h, J = jobAt(b);
      if (!J) { scText(c, 16, y + 22, 'Bay ' + (b + 1) + ': no car in. The next one is on its way.', '#a0acb8', 13); continue; }
      scText(c, 16, y + 20, 'Bay ' + (b + 1) + ' · ' + J.car.make + ' · ' + J.car.plate, '#eef1f5', 14);
      scText(c, 16, y + 38, J.car.name + ': ' + jobName(J), '#a0acb8', 12);
      var s = J.state === 'taken' ? curStep(J) : null, steps = stepsOf(J);
      scText(c, 16, y + 58, J.state === 'waiting' ? 'Customer at the desk' : s ? 'Step ' + (J.step + 1) + ' of ' + steps.length + ': ' + s.label + (J.stepP > 0 ? ' · ' + Math.round(Math.min(J.stepP, 1.5) * 100) + '%' : '') : J.state === 'done' ? 'Fixed: take ' + money(J.price) + ' at the desk' : J.state, J.state === 'done' ? '#5fd38d' : '#f5b53d', 13);
      if (J.hold === 'parts') scText(c, 16, y + 76, 'Waiting on parts: ' + missingParts(J).map(function (p) { return PARTS[p].name; }).join(', '), '#ff6b5e', 12);
      var cu = customerIn(b), here = cu && !cu.walking, bx = sc.w - 150;
      if (J.state === 'waiting' && here) scButton(sc, bx, y + 8, 134, 32, 'Take the job', true, takeJob.bind(null, b));
      if (J.state === 'done' && here) scButton(sc, bx, y + 8, 134, 32, 'Take payment', true, takePayment.bind(null, b));
      if (J.state === 'taken' && J.car.extra && !J.offered && here) scButton(sc, bx, y + 8, 134, 32, 'Offer the extra', true, offerExtra.bind(null, b));
    }
  }
