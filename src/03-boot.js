//@ Garage Co., part 03: the HUD, the clipboard panel, the guide, the dev commands, the boot steps and the test handle; CO.boot runs the loop.
  // ── The shell ─────────────────────────────────────────────────────
  GAME.hud = function () {
    var j = $('h-jobs'); if (j) j.textContent = S.stats.jobs + (S.stats.jobs === 1 ? ' job' : ' jobs');
    var r = $('h-rep'); if (r) r.textContent = 'rep ' + S.rep;
    var l = $('h-level'); if (l) l.textContent = 'Level ' + S.level + ' · ' + S.xp + '/' + xpFor(S.level);
  };
  // the HUD chip for the job: the bay you are nearest, or the first with a car in
  function jobChip() {
    var b = 0, best = 1e9; for (var i = 0; i < bayCount(); i++) { var C = carIn(i); if (C && jobAt(i)) { var d = dist2(player.x, player.z, C.x, C.z); if (d < best) { best = d; b = i; } } }
    var J = jobAt(b); if (!J) return 'no car in';
    var s = curStep(J); if (diagnosing(J)) return (bayCount() > 1 ? 'bay ' + (b + 1) + ': ' : '') + 'find the fault'; return (bayCount() > 1 ? 'bay ' + (b + 1) + ': ' : '') + ({ coming: 'car on its way', waiting: 'customer at the desk', done: 'fixed, take the money', paid: 'paid', leaving: 'leaving' }[J.state] || (s ? (J.hold === 'parts' ? 'waiting on parts' : s.label.toLowerCase()) : J.state));
  }
  GAME.panel = function (kind) {
    if (kind !== 'jobs') return null;
    var h = '';
    for (var b = 0; b < bayCount(); b++) {
      var J = jobAt(b); if (!J) { h += '<p class="dc-sub">Bay ' + (b + 1) + ': no car in. The next one comes between a quarter past eight and five.</p>'; continue; }
      var s = curStep(J), cu = customerIn(b), here = cu && !cu.walking;
      if (diagnosing(J)) { h += diagCardHtml(b, J); continue; }
      h += '<div class="dc-card"><div class="body"><b>Bay ' + (b + 1) + ' · ' + esc(J.car.make) + ' · ' + esc(J.car.plate) + '</b><small>' + esc(J.car.name) + ': ' + esc(symptomOf(J.car).says) + '</small><small>' + esc(J.state === 'waiting' ? 'the customer is at the desk' + (unnamed(J) ? ': it could be ' + shortList(candList(J)) : '') : J.state === 'taken' ? jobName(J) + ' · step ' + (J.step + 1) + ' of ' + stepsOf(J).length + ': ' + (s ? s.label : '') + (J.hold === 'parts' ? ' · waiting on parts' : '') : J.state === 'done' ? 'fixed, the payment waits at the desk' : J.state) + '</small></div><div style="text-align:right"><div class="price">' + money(J.price) + '</div>' + (J.state === 'waiting' && here ? btn('take', b, 'Take the job', 'primary') : J.state === 'done' && here ? btn('pay', b, 'Take the payment', 'primary') : J.state === 'taken' && J.car.extra && !J.offered && here ? btn('offer', b, 'Offer the extra', 'primary') : '') + '</div></div>';
    }
    h += '<h3>Done</h3>' + (S.done.length ? '<table class="dc-table"><tr><th>Day</th><th>Time</th><th>Customer</th><th>Car</th><th>Job</th><th>Paid</th></tr>' + S.done.map(function (d) { return '<tr><td>' + d.day + '</td><td>' + esc(d.t) + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.make) + '</td><td>' + esc(d.job) + '</td><td>' + money(d.price) + '</td></tr>'; }).join('') + '</table>' : '<p class="dc-sub">Nothing yet.</p>');
    return { title: 'The clipboard', tabs: [], body: h };
  };
  // the clipboard's card for a bay whose fault is being found: the symptom, the findings, the checks left, a button an answer
  function diagCardHtml(b, J) {
    var D = J.diag, found = CHECK_IDS.filter(function (k) { return D.done[k] !== undefined; }), ck = checksFor(J), mine = !(J.assign && staffById(J.assign));
    return '<div class="dc-card"><div class="body"><b>Bay ' + (b + 1) + ' · ' + esc(J.car.make) + ' · ' + esc(J.car.plate) + ' · find the fault</b><small>' + esc(J.car.name) + ': ' + esc(symptomOf(J.car).says) + '</small>' +
      (D.wrong.length ? '<small>Tried, and it still did it: ' + esc(D.wrong.map(function (f) { return faultById(f).short; }).join(', ')) + '</small>' : '') +
      found.map(function (k) { return '<small>' + esc(CHECKS[k].label) + ': <b>' + esc(D.done[k]) + '</b></small>'; }).join('') +
      (ck.length ? '<small>Still to check: ' + esc(ck.map(function (k) { return CHECKS[k].label.toLowerCase() + ' (' + placeName(CHECKS[k].at) + (CHECKS[k].tool ? ', the ' + TOOLS[CHECKS[k].tool].name : '') + ')'; }).join('; ')) + '</small>' : '') +
      '</div><div style="text-align:right">' + candList(J).map(function (f) { return btn('name', b + ':' + f, 'It is: ' + esc(faultById(f).short), 'primary', !mine); }).join(' ') + '</div></div>';
  }
  GAME.panelAct = function (act, arg) { if (act === 'name') { var a = String(arg).split(':'), r = nameFault(+a[0] || 0, a[1], 'player'); if (r) toast(r, 'bad'); renderPanel(); return true; } var b = +arg || 0; if (act === 'take') { takeJob(b); renderPanel(); return true; } if (act === 'pay') { takePayment(b); renderPanel(); return true; } if (act === 'offer') { offerExtra(b); renderPanel(); return true; } return false; };
  GAME.statsHtml = function () { return '<h3>The books</h3><p>Day ' + S.day + ' · ' + money(S.bank) + ' in the bank · ' + S.stats.jobs + ' jobs · ' + money(S.stats.earned) + ' taken · rep ' + S.rep + '</p>' + GAME.panel('jobs').body; };
  GAME.menuLine = function () { return 'The garage waits until you come back.'; };
  GAME.saveLooksRight = function (s) { return typeof s.bank === 'number' && s.stats && typeof s.stats.jobs === 'number'; };
  GAME.guideHtml = function () {
    return '<h3>The garage</h3><p>A car pulls into a bay, the customer walks to the desk and tells you what it does. <kbd>E</kbd> on the customer takes the job. Then you work it step by step: the job card on the bench and the prompt say what is next and where. <kbd>E</kbd> once for a quick step (open the bonnet, take the wheel off), <b>hold</b> <kbd>E</kbd> for the rest (jack the car up, undo the sump plug) and stay at the car while it fills. Fill steps go past the mark if you keep holding: let go at the mark. <kbd>E</kbd> on the customer again takes the payment.</p>' +
      '<h3>Finding the fault</h3><p>What the customer says is a symptom, and some symptoms could be more than one thing: "it struggles to start" could be the battery, a loose terminal or the spark plugs. Such a job opens as <b>find the fault</b>. The job card lists what it could be and what to check: hold <kbd>E</kbd> at that place on the car. The code reader off the tool wall goes in the socket under the dash or on the battery; some things you just look at. Read what the checks find, then name the fault with its button on the job card or the clipboard. Name it wrong and you find out when you start the car at the end: the part you fitted is lost and the clock keeps running.</p>' +
      '<h3>Tools and parts</h3><p>A step that needs a tool says so: take it off the tool wall, and hang it back with <kbd>E</kbd>. Every job starts at the parts rack: <kbd>E</kbd> takes the parts. Short of a part, the job waits on it.</p>' +
      '<h3>The PC</h3><p>On the desk. <b>Parts</b>: order from the supplier (the van comes at half past eight tomorrow, or express within the hour). <b>Stock</b>: the shelves. <b>Jobs</b>: the bays, and who works them. <b>Staff</b>: hire from 3 (apprentice), 5 (mechanic) and 7 (receptionist). <b>Garage</b>: the tyre corner, the stores shed, tools, a faster jack. <b>Books</b>: the money and what the town says. Arrows on the screen or the mouse wheel scroll it.</p>' +
      '<h3>Rep</h3><p>On time: +2. Late or kept overnight: -1. No parts at closing, the car goes home unfixed: -3. A comeback (a job done badly) comes back free. The higher the rep, the more cars and the more they pay for labour.</p>' +
      '<h3>The two-bay garage</h3><p>At level 5 the builders come overnight: a second hall with its own roll door and bay, a parts store, an office with a second PC, a waiting corner.</p>' +
      '<h3>Controls</h3><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> use (hold for the long steps) · <kbd>Esc</kbd> pause · <kbd>F2</kbd> build mode (<kbd>C</kbd> the catalogue) · <kbd>F9</kbd> photo mode · <kbd>F12</kbd> screenshot · <kbd>F3</kbd> FPS</p>' +
      '<h3>The roll doors</h3><p>Pull the chain by a roll door to open it, or use the panel beside it. Customers and staff have them opened as they walk through.</p>';
  };
  GAME.commands = {
    car: function (f) { var c = spawnCar(null, typeof f === 'string' && FAULTS.some(function (x) { return x.id === f; }) ? newCar(f) : null); return c ? c.name + ' coming in a ' + c.make + ' with ' + c.fault : 'no bay free'; },
    park: function () { var n = 0; for (var b = 0; b < bayCount(); b++) { var J = jobAt(b), C = carIn(b); if (J && C && J.state === 'coming') { var p = arrivePath(b), e = p[p.length - 1]; C.x = e[0]; C.z = e[1]; C.path = [e]; n++; } } return n ? 'parked ' + n : 'no car on the road'; },
    step: function (b) { b = +b || 0; var J = jobAt(b); if (!J) return 'no job'; if (J.state === 'waiting') takeJob(b); var s = curStep(J); if (!s) return 'job ' + J.state; if (s.act === 'fetch' && !takeParts(b, s)) return 'no parts: ' + missingParts(J).join(', '); stepFx(b, s.fx); J.step++; J.stepP = 0; if (J.step >= stepsOf(J).length) jobFinished(b, 'dev'); screenDirtyAll(); return 'step ' + J.step + ' of ' + stepsOf(J).length + (curStep(J) ? ': next ' + curStep(J).label : ''); },
    fix: function (b) { b = +b || 0; var J = jobAt(b); if (!J) return 'no job'; if (J.state === 'waiting') takeJob(b); if (J.state === 'taken') { J.step = stepsOf(J).length; J.vis = {}; carVis(b); jobFinished(b, 'dev'); } return 'job ' + J.state; },
    leave: function (b) { b = +b || 0; if (!jobAt(b)) return 'no car'; removeCustomer(b); removeCar(b); S.jobs[b] = null; G.nextCarAt = worldTime + 5; return 'gone'; },
    rep: function (n) { S.rep = clamp(Math.round(typeof n === 'number' ? n : 50), 0, 100); hudDirty = true; return 'rep ' + S.rep; },
    name: function (a) { var p = String(a == null ? '' : a).split(':'), b = p.length > 1 ? +p[0] || 0 : 0, f = p.length > 1 ? p[1] : p[0], J = jobAt(b); if (!diagnosing(J)) return 'no fault to find in bay ' + (b + 1); if (!f) return 'it could be ' + candList(J).join(', ') + ' (it is ' + J.car.fault + ')'; return nameFault(b, f, 'player') || 'named ' + f; },
    level: function () { addXp(xpFor(S.level) - S.xp); return 'level ' + S.level; },
    cash: function (n) { pay(typeof n === 'number' ? n : 1000, 'dev cash'); return money(S.bank); },
    stock: function () { Object.keys(PARTS).forEach(function (p) { if (S.level >= PARTS[p].lvl) S.stock[p] = Math.max(S.stock[p] || 0, 3); }); stockDraw(); return stockLine(); },
    van: function () { S.orders.forEach(function (o) { o.due = { day: S.day, time: 0 }; }); return S.orders.length + ' orders due now'; },
    grow: function () { S.level = Math.max(S.level, 5); S.stage = 2; growClear(); save(); growReload(); return 'the garage grows'; }
  };
  GAME.devState = function () { return { rep: S.rep, xp: S.xp, level: S.level, stage: S.stage, jobs: S.stats.jobs, bays: S.jobs.map(function (J) { return J ? J.state + ' ' + J.car.make + ' step ' + J.step : null; }), tool: S.tool, hand: S.hand ? S.hand.label : null, stock: stockTotal() + '/' + stockCap(), staff: staffList().map(function (w) { return w.name; }) }; };

  // ── Boot ──────────────────────────────────────────────────────────
  GAME.handle = 'GARAGE'; GAME.versionGlobal = 'GARAGE_VERSION';
  GAME.freshState = function () {
    return { day: 1, time: OPEN_AT, bank: 400, rep: 10, level: 1, xp: 0, stage: 1, doorOpen: false, door2Open: false, jobs: [], done: [], stats: { earned: 0, spent: 0, jobs: 0, fixed: 0, days: 0, late: 0, diagRight: 0, wrong: 0 }, log: [], ledger: [], layout: {}, custom: [], hdoors: {},
      stock: { oil: 2, oilfilter: 2, pads: 1, bulb: 3, battery: 1 }, orders: [], delivery: null, minStock: {}, tools: { spanner: true, brace: true, filterwrench: true, reader: true }, tool: null, hand: null, up: {}, staff: [], cands: null, comebacks: [], repLog: [], layoutRev: 1 };
  };
  // the HUD chips of src/00-ui.js are expressions over the editor's kit: these are the game's own names they read
  GAME.editorKit = function () { return { jobChip: jobChip, handLine: handLine, jobAt: jobAt, stockTotal: stockTotal, stockCap: stockCap }; };
  // a save from 0.2: one job (S.job) becomes bay 1's; the stock, the tools and the rest arrive as the fresh state's missing keys.
  // Its own prop positions (S.layout) date from before the lock-up was moved in the editor and would stand the fittings 2 m out in
  // front of it, so they are dropped once (layoutRev): every prop goes back to where the shipped layout puts it
  GAME.migrate = function (s, fresh, missing) {
    if (missing && missing.layoutRev) { s.layout = {}; s.layoutRev = 1; }
    if (s.job !== undefined) { s.jobs = s.job ? [s.job] : []; delete s.job; }
    if (!s.stats.jobs) s.stats.jobs = s.stats.jobs || 0;
    if (s.jobs) s.jobs.forEach(function (J) { if (J && !J.faults) { J.faults = [J.car.fault]; J.step = 0; J.stepP = 0; J.vis = {}; J.parts = 0; if (J.state === 'fixing') J.state = 'taken'; } });
    // a save from 0.3: its jobs were named when they were taken, and the code reader goes up on the tool wall
    if (s.jobs) s.jobs.forEach(function (J) { if (J && !J.diag) J.diag = { cands: [J.car.fault], done: {}, wrong: [], named: J.car.fault, checks: 0, p: 0 }; });
    if (s.tools && s.tools.reader === undefined) s.tools.reader = true;
    return s;
  };
  GAME.afterBuild = function (loaded) {
    restoreJobs(); toolWallSync(); stockDraw(); pileBuild();
    G.rollT = S.doorOpen ? 1 : 0; if (G.rollPanel) { var sy = 1 - G.rollT * 0.94; G.rollPanel.scale.y = sy; G.rollPanel.position.y = LOCKUP.doorH - (LOCKUP.doorH * sy) / 2; } tickRoll2(1);
    staffList().forEach(staffSpawn);
    if (!loaded) S.time = 10;
  };
  GAME.startStats = function (loaded) { return loaded ? ['Day ' + S.day, 'Level ' + S.level, money(S.bank), S.stats.jobs + ' jobs', 'rep ' + S.rep] : ['New garage', 'The lock-up', money(400), 'one bay, a jack, a tool wall, a PC']; };
  GAME.startNote = function (loaded) { return loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first car is due at a quarter past eight'; };
  GAME.onEnter = function (loaded) { if (!loaded) { S.time = OPEN_AT; logEvent('Welcome to Garage Co. This is your lock-up. Pull the chain to open the roll door; the first car is due at a quarter past eight. The PC on the desk orders parts.', 'rare'); save(); } else logEvent('Back at the garage. Day ' + S.day + ', ' + fmtTime(S.time) + '.'); G.nextCarAt = worldTime + 12; };
  GAME.menuCamera = function (dt) { var t = worldTime * 0.05; camera.position.set(9 + Math.sin(t) * 2.5, 2.4, 13 + Math.cos(t) * 1.5); camera.lookAt(0, 1.6, LOCKUP.z - 1); };
  GAME.tick = function (dt) { tickTime(dt); tickCars(dt); tickCustomers(dt); workTick(dt); tickVan(dt); staffTick(dt); for (var b = 0; b < bayCount(); b++) gcCarAnimate(b, dt); };
  GAME.present = function (dt) { tickRoll(dt); tyreWheelSync(); liftSync(); gcHeldSync(dt); markerSync(dt); };
  GAME.hiddenTick = function (dt) { tickRoll(dt); };
  GAME.T = function () {
    return { GAME: GAME, G: G, traffic: traffic, FAULTS: FAULTS, PARTS: PARTS, STEPS: STEPS, PLACES: PLACES, nearTyre: nearTyre, tyreSpot: tyreSpot, staffById: staffById, propPlacement: propPlacement, drawScreens: drawScreens, saveNow: saveNow, TOOLS: TOOLS, UPGRADES: UPGRADES, ROLES: ROLES, LOCKUP: LOCKUP, HALL2: HALL2, FORECOURT: FORECOURT, BAY: BAY, BAYS: BAYS, DESK: DESK, DESK_STAND: DESK_STAND, ROAD_Z: ROAD_Z, PC: PC,
      inLockup: inLockup, inForecourt: inForecourt, inDoorway: inDoorway, LO: LO, deskStand: deskStand, faultOf: faultOf, faultById: faultById, grown: grown, bayCount: bayCount,
      newCar: newCar, spawnCar: spawnCar, removeCar: removeCar, placeCar: placeCar, spawnCustomer: spawnCustomer, removeCustomer: removeCustomer, restoreJobs: restoreJobs, takeJob: takeJob, takePayment: takePayment, offerExtra: offerExtra, addXp: addXp, xpFor: xpFor, tickRoll: tickRoll, dayEnd: dayEnd, repChange: repChange,
      stepsOf: stepsOf, curStep: curStep, doStep: doStep, placeUse: placeUse, placePrompt: placePrompt, rackUse: rackUse, rackPrompt: rackPrompt, toolUse: toolUse, stepBlock: stepBlock, missingParts: missingParts, carVis: carVis, tyreUse: tyreUse, tyrePrompt: tyrePrompt,
      orderParts: orderParts, putAway: putAway, stockTotal: stockTotal, stockCap: stockCap, onOrder: onOrder, buyUpgrade: buyUpgrade, owns: owns, roomInst: roomInst, hire: hire, candidates: candidates, staffList: staffList, assignNext: assignNext, letGo: letGo, pcTap: pcTap, pcGo: pcGo, pcRows: pcRows, jobChip: jobChip, handLine: handLine,
      SYMPTOMS: SYMPTOMS, CHECKS: CHECKS, symptomOf: symptomOf, diagnosing: diagnosing, candList: candList, consistent: consistent, checksFor: checksFor, checkAt: checkAt, doCheck: doCheck, nameFault: nameFault, jobLabel: jobLabel, hall2Clash: hall2Clash, markerTarget: markerTarget,
      car: function (b) { return carIn(b || 0); }, LIFTS: LIFTS, liftWorld: liftWorld, liftCar: liftCar, liftUse: liftUse, liftPrompt: liftPrompt, getIn: getIn, getOut: getOut, canDrive: canDrive, carHeight: carHeight, drive: function () { return G.drive; }, customer: function (b) { return customerIn(b || 0); }, job: function (b) { return jobAt(b || 0); }, van: function () { return G.van; }, carPrompt: carPrompt, customerPrompt: customerPrompt, drawJobCard: drawJobCard };
  };
  CO.boot(GAME);
