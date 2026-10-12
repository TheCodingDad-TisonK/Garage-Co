//@ Garage Co., part 02: the staff. Hired on the PC from the day's candidates; they walk to the rack for the parts and work the same steps you do, at the pace their skill gives them, and they take a wage at closing time.
  // ── The roles ─────────────────────────────────────────────────────
  // the apprentice does the simple jobs and now and then forgets something (the car comes back); the mechanic does every job of the
  // level; the receptionist takes the jobs and the payments at the desk and puts the deliveries away
  var ROLES = {
    apprentice: { name: 'apprentice', lvl: 3, wage: [45, 70], jobs: ['oil', 'bulb', 'battery', 'wipers', 'airfilter', 'coolant'] },
    mechanic: { name: 'mechanic', lvl: 5, wage: [90, 130], jobs: null },
    receptionist: { name: 'receptionist', lvl: 7, wage: [60, 80], desk: true }
  };
  var STAFF_NAMES = ['Kofi', 'Marta', 'Jonno', 'Aisha', 'Tomasz', 'Bea', 'Ravi', 'Hollie', 'Dev', 'Nell', 'Callum', 'Yusuf'];
  var TRAIN_PRICE = 300;
  function staffList() { return (S && S.staff) || []; }
  function staffById(id) { return staffList().filter(function (w) { return w.id === id; })[0] || null; }
  function staffMax() { return grown() ? 4 : 1; }
  function rolesOpen() { return Object.keys(ROLES).filter(function (r) { return S.level >= ROLES[r].lvl && (r !== 'mechanic' || grown()); }); }
  // a fresh list of three every morning (and the first time the PC asks)
  function candidates() {
    if (S.cands && S.cands.day === S.day) return S.cands.list;
    var open = rolesOpen(), list = [];
    for (var i = 0; i < (open.length ? 3 : 0); i++) { var r = pick(open), R = ROLES[r], sk = randi(1, 3); list.push({ id: uid('st'), name: pick(STAFF_NAMES), role: r, skill: sk, wage: Math.round(R.wage[0] + (R.wage[1] - R.wage[0]) * (sk - 1) / 2) }); }
    S.cands = { day: S.day, list: list }; return list;
  }
  function hire(id) {
    var c = candidates().filter(function (k) { return k.id === id; })[0]; if (!c) return 'gone';
    if (staffList().length >= staffMax()) return grown() ? 'the garage has room for four' : 'the lock-up has room for one: the garage grows at level 5';
    S.cands.list.splice(S.cands.list.indexOf(c), 1);
    S.staff.push({ id: c.id, name: c.name, role: c.role, skill: c.skill, wage: c.wage, auto: true, unpaid: 0, jobs: 0 });
    staffSpawn(staffById(c.id)); sfx('ok'); toast(c.name + ' starts as your ' + ROLES[c.role].name + ' at ' + money(c.wage) + ' a day.', 'good'); logEvent('Hired ' + c.name + ', ' + ROLES[c.role].name + ', ' + money(c.wage) + ' a day.', 'good');
    screenDirtyAll(); hudDirty = true; return '';
  }
  function letGo(id) { var w = staffById(id); if (!w) return 'gone'; staffDrop(w); S.staff.splice(S.staff.indexOf(w), 1); jobList().forEach(function (J) { if (J.assign === id) J.assign = null; }); logEvent(w.name + ' has left the garage.', ''); screenDirtyAll(); return ''; }
  function train(id) { var w = staffById(id); if (!w) return 'gone'; if (w.skill >= 5) return 'already the best'; if (S.bank < TRAIN_PRICE) return money(TRAIN_PRICE); pay(-TRAIN_PRICE, 'a course for ' + w.name); w.skill = Math.min(5, Math.floor(w.skill) + 1); toast(w.name + ' did the course: skill ' + w.skill + '.', 'good'); screenDirtyAll(); return ''; }
  // give a job to someone, or take it back (null): the PC's Jobs app cycles through the ones who can do it
  // a car whose fault is still being found is the mechanic's (the apprentice waits until it is named)
  function canDo(w, J) { var R = ROLES[w.role]; if (R.desk) return false; if (unnamed(J)) return !R.jobs; return jobFaults(J).every(function (f) { return !R.jobs || R.jobs.indexOf(f) >= 0; }) && jobFaults(J).every(function (f) { var ff = faultById(f); return !ff.needs || owns(ff.needs); }); }
  function assignNext(b) {
    var J = jobAt(b); if (!J || J.state !== 'taken') return; var who = staffList().filter(function (w) { return canDo(w, J); }), i = J.assign ? who.map(function (w) { return w.id; }).indexOf(J.assign) : -1;
    J.assign = i + 1 < who.length ? who[i + 1].id : null; if (!J.assign) staffFree(b); screenDirtyAll();
  }
  // ── At work ───────────────────────────────────────────────────────
  // G.staff[id] is the live person: the mesh, where they stand, what they are doing. A task is a bay; the step tells where to go
  function staffSpawn(w) {
    if (!w || G.staff[w.id]) return; var p = staffPost(w), g = makeHuman({ name: w.name, style: pick(['short', 'cap', 'bun']), shirt: std({ map: TEX.cloth, color: 0x2c5f9e, roughness: 0.92 }) }); scene.add(g); g.position.set(p.x, 0, p.z);
    var R = { g: g, rec: { x: p.x, z: p.z, yaw: 0, speed: 1.6, path: [] }, task: null, t: 0, wait: 0 }; G.staff[w.id] = R;
    R.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { prompt: function () { return staffPrompt(w.id); }, use: function () { staffTalk(w.id); } }, g);
  }
  function staffDrop(w) { var R = G.staff[w.id]; if (!R) return; var k = inter.indexOf(R.hit); if (k >= 0) inter.splice(k, 1); scene.remove(R.g); delete G.staff[w.id]; }
  function staffPost(w) {
    var o = LO(); if (ROLES[w.role].desk) { var d = propInst.desk ? propInst.desk.g.position : { x: DESK.x + o.x, z: DESK.z + o.z }; return { x: d.x + 1.3, z: d.z + 0.2 }; }
    var i = staffList().indexOf(w); return { x: o.x - 1.2 + i * 0.8, z: o.z + 1.4 };
  }
  function staffPrompt(id) { var w = staffById(id), R = G.staff[id]; if (!w || !R) return ''; var J = R.task !== null && R.task !== undefined ? jobAt(R.task) : null, s = J ? curStep(J) : null; return w.name + ', ' + ROLES[w.role].name + ' (skill ' + Math.floor(w.skill) + ')' + (diagnosing(J) ? ': finding the fault on the ' + J.car.make : s ? ': ' + s.label.toLowerCase() : R.stocking ? ': putting the delivery away' : ': free') + (w.unpaid ? ' · unpaid ' + w.unpaid + ' day' + (w.unpaid > 1 ? 's' : '') : ''); }
  function staffTalk(id) { var w = staffById(id), R = G.staff[id]; if (!w || !R) return; w.auto = !w.auto; say(R.g, w.auto ? 'I will pick up whatever needs doing.' : 'Right, I will wait until you give me a job.'); toast(w.name + (w.auto ? ' takes jobs on their own now.' : ' waits for you to hand them a job (PC, Jobs).'), ''); screenDirtyAll(); }
  // how long a worker takes over a step: skill 1 is slow, skill 5 quicker than you; unpaid staff drag their feet
  function staffMul(w) { return (1.6 - w.skill * 0.15) * (w.unpaid ? 1.4 : 1); }
  function staffFree(b) { staffList().forEach(function (w) { var R = G.staff[w.id]; if (R && R.task === b) { R.task = null; R.rec.path = []; } }); }
  function staffWhere(b, s) { if (s.at === 'rack') return rackSpot(); if (s.at === 'tyre') return tyreSpot(); if (s.at === 'lift' && jobAt(b).lift !== null && jobAt(b).lift !== undefined) { var L = liftWorld(jobAt(b).lift); return { x: L.x - 1.5, z: L.z + 0.9 }; } var C = carIn(b); return C ? { x: C.x + 1.9, z: C.z - 0.6 } : null; }
  function rackSpot() { var I = propInst.rack; if (!I) return null; var a = I.g.rotation.y; return { x: I.g.position.x + Math.sin(a) * 0.9, z: I.g.position.z + Math.cos(a) * 0.9 }; }
  function staffTick(dt) {
    staffList().forEach(function (w) {
      var R = G.staff[w.id]; if (!R) { staffSpawn(w); R = G.staff[w.id]; }
      var walking = R.rec.path && R.rec.path.length;
      if (walking) { var arrived = walkAlong(R.rec, R.rec.path, R.rec.speed, dt); R.g.position.set(R.rec.x, 0, R.rec.z); R.g.rotation.y = R.rec.yaw; animateHuman(R.g, dt, 'walk', 1, null, false); if (!arrived) return; R.rec.path = []; }
      if (ROLES[w.role].desk) { deskWork(w, R, dt); return; }
      // a task: the job given to them, or (on their own) the first job they can do that you have not started on
      if (R.task === null || R.task === undefined || !jobAt(R.task) || jobAt(R.task).state !== 'taken') {
        R.task = null;
        for (var b = 0; b < bayCount(); b++) { var J = jobAt(b); if (J && J.state === 'taken' && !J.hold && (J.assign === w.id || (w.auto && !J.assign && J.by !== 'player' && canDo(w, J)))) { J.assign = w.id; R.task = b; R.t = 0; break; } }
        if (R.task === null && S.delivery && !staffList().some(function (x) { return ROLES[x.role].desk; })) { stockRun(w, R, dt); return; }
        if (R.task === null) { idle(w, R, dt); return; }
      }
      var Jb = jobAt(R.task);
      if (diagnosing(Jb)) { if (canDo(w, Jb)) staffDiag(w, R, dt); else { if (Jb.assign === w.id) Jb.assign = null; R.task = null; } return; }
      var s = curStep(Jb); if (!s) { R.task = null; return; }
      var at = staffWhere(R.task, s); if (!at) { idle(w, R, dt); return; }
      if (dist2(R.rec.x, R.rec.z, at.x, at.z) > 0.8 * 0.8) { R.rec.path = route({ x: R.rec.x, z: R.rec.z }, at); if (!R.rec.path.length) { R.rec.x = at.x; R.rec.z = at.z; } R.t = 0; return; }
      var C = carIn(R.task); if (C) R.rec.yaw = Math.atan2(C.x - R.rec.x, C.z - R.rec.z);
      R.g.rotation.y = R.rec.yaw; animateHuman(R.g, dt, 'work', 0, null, false);
      R.t += dt; Jb.stepP = Math.min(1, R.t / (Math.max(1, s.secs || 1.2) * staffMul(w))); if (s.at === 'lift') carVis(R.task);
      if (R.t >= Math.max(1, s.secs || 1.2) * staffMul(w)) {
        R.t = 0;
        if (s.act === 'fetch' && !takeParts(R.task, s)) { say(R.g, 'We are out of ' + missingParts(Jb).map(function (p) { return PARTS[p].name; }).join(' and ') + '.'); if (w.auto) Jb.assign = null; R.task = null; screenDirtyAll(); return; }
        // the apprentice skips a step now and then: nobody sees it until the car comes back
        if (w.role === 'apprentice' && !Jb.sloppy && Math.random() < 0.02 * (4 - Math.min(3, w.skill))) Jb.sloppy = true;
        var last = Jb.step + 1 >= stepsOf(Jb).length, named = Jb.diag && Jb.diag.named;
        if (s.act === 'fetch') { stepFx(R.task, s.fx); Jb.step++; Jb.stepP = 0; Jb.hold = null; skipOpen(Jb); screenDirtyAll(); } else doStep(R.task, w.name);
        // a wrong name sends the job back to finding the fault: the mechanic stays on it, the apprentice hands it back
        if (last && Jb.state !== 'done') { say(R.g, 'It still does it. It was not the ' + faultById(named).short + '.'); if (!canDo(w, Jb)) { Jb.assign = null; R.task = null; } }
        else if (last) { w.jobs++; w.skill = Math.min(5, w.skill + 0.2); Jb.assign = null; R.task = null; say(R.g, 'Done: ' + jobName(Jb) + '.'); }
        tyreWheelSync();
      }
    });
  }
  // the mechanic finding a fault: each check that still tells the answers apart, at its place on the car, then the name of what is left.
  // A low-skill mechanic sometimes names one without checking (decided once a job: skill 1 two in five, skill 2 one in five)
  function staffDiag(w, R, dt) {
    var b = R.task, J = jobAt(b), D = J.diag;
    if (D.rush === undefined) D.rush = Math.random() < Math.max(0, 0.2 * (3 - Math.floor(w.skill)));
    var cons = consistent(J), cid = D.rush ? null : checksFor(J, cons)[0] || null;
    if (!cid) { var f = pick(cons.length ? cons : candList(J)); say(R.g, 'It is the ' + faultById(f).short + '.'); nameFault(b, f, w.name); R.t = 0; return; }
    var at = staffWhere(b, { at: CHECKS[cid].at }); if (!at) { idle(w, R, dt); return; }
    if (dist2(R.rec.x, R.rec.z, at.x, at.z) > 0.8 * 0.8) { R.rec.path = route({ x: R.rec.x, z: R.rec.z }, at); if (!R.rec.path.length) { R.rec.x = at.x; R.rec.z = at.z; } R.t = 0; return; }
    var C = carIn(b); if (C) R.rec.yaw = Math.atan2(C.x - R.rec.x, C.z - R.rec.z); R.g.rotation.y = R.rec.yaw; animateHuman(R.g, dt, 'work', 0, null, false);
    var secs = CHECKS[cid].secs * staffMul(w); R.t += dt; D.p = Math.min(1, R.t / secs);
    if (R.t >= secs) { R.t = 0; if (PLACES[CHECKS[cid].at].bay && !(J.vis && J.vis.open)) stepFx(b, 'open'); doCheck(b, cid, w.name); }
  }
  function idle(w, R, dt) { var p = staffPost(w); if (dist2(R.rec.x, R.rec.z, p.x, p.z) > 0.6 * 0.6) { R.rec.path = route({ x: R.rec.x, z: R.rec.z }, p); if (!R.rec.path.length) { R.rec.x = p.x; R.rec.z = p.z; } return; } animateHuman(R.g, dt, 'idle', 0, player ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); }
  // putting the delivery away: walk to the pallet, then it goes on the shelves
  function stockRun(w, R, dt) { var d = dropSpot(); if (dist2(R.rec.x, R.rec.z, d.x + 0.9, d.z) > 0.8 * 0.8) { R.stocking = true; R.rec.path = route({ x: R.rec.x, z: R.rec.z }, { x: d.x + 0.9, z: d.z }); return; } R.wait += dt; animateHuman(R.g, dt, 'work', 0, null, true); if (R.wait > 3 * staffMul(w)) { R.wait = 0; R.stocking = false; putAway(w.name); } }
  // the receptionist: takes the job from a customer at the desk, takes the payment, puts the deliveries away when the desk is quiet
  function deskWork(w, R, dt) {
    var p = staffPost(w); if (dist2(R.rec.x, R.rec.z, p.x, p.z) > 0.6 * 0.6 && !R.stocking) { R.rec.path = route({ x: R.rec.x, z: R.rec.z }, p); if (!R.rec.path.length) { R.rec.x = p.x; R.rec.z = p.z; } return; }
    R.wait += dt;
    for (var b = 0; b < bayCount(); b++) { var J = jobAt(b), c = customerIn(b); if (!J || !c || c.walking) continue; if (R.wait > 2.5 * staffMul(w)) { if (J.state === 'waiting') { takeJob(b, 'staff'); R.wait = 0; say(R.g, 'We will have it done by ' + fmtTime(J.due) + '.'); return; } if (J.state === 'done') { takePayment(b, 'staff'); R.wait = 0; return; } } }
    if (S.delivery && R.wait > 4) { stockRun(w, R, dt); return; }
    animateHuman(R.g, dt, 'idle', 0, null, false);
  }
  // closing time: the wages. Short of money, nobody is paid; two unpaid days in a row and they leave
  function staffDayEnd() {
    var list = staffList(), total = 0; list.forEach(function (w) { total += w.wage; }); if (!list.length) return;
    if (S.bank >= total) { pay(-total, 'wages'); list.forEach(function (w) { w.unpaid = 0; }); }
    else { list.slice().forEach(function (w) { w.unpaid++; if (w.unpaid >= 2) { logEvent(w.name + ' has not been paid for two days and has left.', 'bad'); repChange(-2, w.name + ' quit unpaid'); letGo(w.id); } }); logEvent('Not enough in the bank for the wages: ' + money(total) + '.', 'bad'); }
    list.forEach(function (w) { var R = G.staff[w.id]; if (R) { R.task = null; R.rec.path = []; var p = staffPost(w); R.rec.x = p.x; R.rec.z = p.z; R.g.position.set(p.x, 0, p.z); } });
    jobList().forEach(function (J) { if (J.assign && staffById(J.assign) && staffById(J.assign).auto) J.assign = null; });
  }
