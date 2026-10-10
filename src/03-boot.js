//@ Garage Co., part 03: the HUD, the clipboard panel, the guide, the dev commands, the boot steps and the test handle; CO.boot runs the loop.
  // ── The shell ─────────────────────────────────────────────────────
  GAME.hud = function () {
    var j = $('h-jobs'); if (j) j.textContent = S.stats.jobs + (S.stats.jobs === 1 ? ' job' : ' jobs');
    var r = $('h-rep'); if (r) r.textContent = 'rep ' + S.rep;
    var l = $('h-level'); if (l) l.textContent = 'Level ' + S.level + ' · ' + S.xp + '/' + xpFor(S.level);
  };
  GAME.panel = function (kind) {
    if (kind !== 'jobs') return null;
    var J = S.job, h = '';
    if (J) { var f = faultOf(J.car); h += '<div class="dc-card"><div class="body"><b>' + esc(J.car.make) + ' · ' + esc(J.car.plate) + '</b><small>' + esc(J.car.name) + ': ' + esc(f.symptom) + '</small><small>' + esc(J.state === 'waiting' ? 'the customer is coming to the desk' : J.state === 'taken' ? 'job card open: ' + f.job : J.state === 'fixing' ? 'working, ' + Math.round(J.progress * 100) + '%' : J.state === 'done' ? 'fixed, the payment waits at the desk' : 'paid, leaving') + '</small></div><div style="text-align:right"><div class="price">' + money(J.price) + '</div>' + (J.state === 'waiting' && G.customer && !G.customer.walking ? btn('take', '', 'Take the job', 'primary') : J.state === 'done' && G.customer && !G.customer.walking ? btn('pay', '', 'Take the payment', 'primary') : '') + '</div></div>'; }
    else h += '<p class="dc-sub">No car in. The next one is on its way between a quarter past eight and five.</p>';
    h += '<h3>Done</h3>' + (S.done.length ? '<table class="dc-table"><tr><th>Day</th><th>Time</th><th>Customer</th><th>Car</th><th>Job</th><th>Paid</th></tr>' + S.done.map(function (d) { return '<tr><td>' + d.day + '</td><td>' + esc(d.t) + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.make) + '</td><td>' + esc(d.job) + '</td><td>' + money(d.price) + '</td></tr>'; }).join('') + '</table>' : '<p class="dc-sub">Nothing yet.</p>');
    return { title: 'The clipboard', tabs: [], body: h };
  };
  GAME.panelAct = function (act) { if (act === 'take') { takeJob(); renderPanel(); return true; } if (act === 'pay') { takePayment(); renderPanel(); return true; } return false; };
  GAME.statsHtml = function () { return '<h3>The books</h3><p>Day ' + S.day + ' · ' + money(S.bank) + ' in the bank · ' + S.stats.jobs + ' jobs · ' + money(S.stats.earned) + ' taken · rep ' + S.rep + '</p>' + GAME.panel('jobs').body; };
  GAME.menuLine = function () { return 'The garage waits until you come back.'; };
  GAME.saveLooksRight = function (s) { return typeof s.bank === 'number' && s.stats && typeof s.stats.jobs === 'number'; };
  GAME.guideHtml = function () {
    return '<h3>The lock-up</h3><p>You run a one-bay garage on the edge of town. A car pulls onto the forecourt, the customer walks to the desk and tells you what it does. <kbd>E</kbd> on the customer takes the job, <kbd>E</kbd> at the car starts the work (stay at the car until it is done), <kbd>E</kbd> on the customer again takes the payment. The car drives off and the next one is due.</p>' +
      '<h3>Controls</h3><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> use · <kbd>Esc</kbd> pause · <kbd>F2</kbd> build mode (<kbd>C</kbd> the catalogue) · <kbd>F9</kbd> photo mode · <kbd>F12</kbd> screenshot · <kbd>F3</kbd> FPS</p>' +
      '<h3>The roll door</h3><p>Pull the chain by the roll door to open it. A customer has it opened for them as they walk in.</p>' +
      '<h3>What comes next</h3><p>The plan in docs/PLAN.md: the reader and the parts rack, the lift, the two-bay garage, staff, the town. This room is where it starts.</p>';
  };
  GAME.commands = {
    car: function () { if (G.car) return 'a car is in already'; var c = spawnCar(); return c ? c.name + ' coming in a ' + c.make : 'no car'; },
    park: function () { if (!S.job || S.job.state !== 'coming') return 'no car on the road'; G.car.x = BAY.x; G.car.z = BAY.z; G.car.leg = 1; return 'parked'; },
    fix: function () { var J = S.job; if (!J) return 'no job'; if (J.state === 'waiting') takeJob(); if (J.state === 'taken' || J.state === 'fixing') { J.state = 'done'; J.progress = 1; S.stats.fixed++; screenDirtyAll(); } return 'job ' + J.state; },
    leave: function () { if (!S.job) return 'no car'; removeCustomer(); removeCar(); S.job = null; G.nextCarAt = worldTime + 5; return 'gone'; },
    rep: function (n) { S.rep = clamp(Math.round(typeof n === 'number' ? n : 50), 0, 100); hudDirty = true; return 'rep ' + S.rep; },
    level: function () { addXp(xpFor(S.level) - S.xp); return 'level ' + S.level; }
  };
  GAME.devState = function () { return { rep: S.rep, xp: S.xp, jobs: S.stats.jobs, job: S.job ? S.job.state + ' ' + S.job.car.make : null, customer: G.customer ? (G.customer.walking ? 'walking to the ' + G.customer.goal : 'at the ' + G.customer.at) : null, doorOpen: !!S.doorOpen }; };

  // ── Boot ──────────────────────────────────────────────────────────
  GAME.handle = 'GARAGE'; GAME.versionGlobal = 'GARAGE_VERSION';
  GAME.freshState = function () { return { day: 1, time: OPEN_AT, bank: 400, rep: 10, level: 1, xp: 0, doorOpen: false, job: null, done: [], stats: { earned: 0, spent: 0, jobs: 0, fixed: 0, days: 0 }, log: [], ledger: [], layout: {}, custom: [], hdoors: {} }; };
  GAME.migrate = function (s) { if (!s.stats.jobs) s.stats.jobs = s.stats.jobs || 0; return s; };
  GAME.afterBuild = function (loaded) { restoreJob(); G.rollT = S.doorOpen ? 1 : 0; if (G.rollPanel) { var sy = 1 - G.rollT * 0.94; G.rollPanel.scale.y = sy; G.rollPanel.position.y = LOCKUP.doorH - (LOCKUP.doorH * sy) / 2; } if (!loaded) S.time = 10; };
  GAME.startStats = function (loaded) { return loaded ? ['Day ' + S.day, 'Level ' + S.level, money(S.bank), S.stats.jobs + ' jobs', 'rep ' + S.rep] : ['New garage', 'The lock-up', money(400), 'one bay, a jack, a tool wall']; };
  GAME.startNote = function (loaded) { return loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first car is due at a quarter past eight'; };
  GAME.onEnter = function (loaded) { if (!loaded) { S.time = OPEN_AT; logEvent('Welcome to Garage Co. This is your lock-up. Pull the chain to open the roll door; the first car is due at a quarter past eight.', 'rare'); save(); } else logEvent('Back at the garage. Day ' + S.day + ', ' + fmtTime(S.time) + '.'); G.nextCarAt = worldTime + 12; };
  GAME.menuCamera = function (dt) { var t = worldTime * 0.05; camera.position.set(9 + Math.sin(t) * 2.5, 2.4, 13 + Math.cos(t) * 1.5); camera.lookAt(0, 1.6, LOCKUP.z - 1); };
  GAME.tick = function (dt) { tickTime(dt); tickCars(dt); tickCustomer(dt); fixTick(dt); };
  GAME.present = function (dt) { tickRoll(dt); };
  GAME.hiddenTick = function (dt) { tickRoll(dt); };
  GAME.T = function () {
    return { GAME: GAME, G: G, traffic: traffic, FAULTS: FAULTS, LOCKUP: LOCKUP, FORECOURT: FORECOURT, BAY: BAY, DESK: DESK, DESK_STAND: DESK_STAND, ROAD_Z: ROAD_Z, inLockup: inLockup, inForecourt: inForecourt, inDoorway: inDoorway, LO: LO, deskStand: deskStand, faultOf: faultOf,
      newCar: newCar, spawnCar: spawnCar, removeCar: removeCar, placeCar: placeCar, spawnCustomer: spawnCustomer, removeCustomer: removeCustomer, restoreJob: restoreJob, takeJob: takeJob, fixStart: fixStart, takePayment: takePayment, addXp: addXp, xpFor: xpFor, tickRoll: tickRoll,
      car: function () { return G.car; }, customer: function () { return G.customer; }, carPrompt: carPrompt, customerPrompt: customerPrompt, drawJobCard: drawJobCard };
  };
  CO.boot(GAME);
