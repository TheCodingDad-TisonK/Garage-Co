//@ Garage Co., part 02: cars and jobs. A car comes off the road into the bay, the customer walks to the desk, you take the job, fix the car and take the money.
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
