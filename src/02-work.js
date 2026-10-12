//@ Garage Co., part 02: the work. A job is a list of steps at the parts of the car: the bonnet opens, the car goes up on the jack, a wheel comes off, a tool comes off the wall. Press E, or hold it while a step fills.
  // ── Tools ─────────────────────────────────────────────────────────
  // the hand tools on the tool wall. The plug socket is bought on the PC; the rest come with the lock-up. The code reader finds faults
  // (the checks, below): it reads the codes from the socket under the dash and tests the battery
  var TOOLS = {
    spanner: { name: 'spanner', len: 0.32, headW: 0.1 },
    brace: { name: 'wheel brace', len: 0.46, headW: 0.16 },
    filterwrench: { name: 'filter wrench', len: 0.28, headW: 0.14 },
    socket: { name: 'spark plug socket', len: 0.3, headW: 0.06 },
    reader: { name: 'code reader', len: 0.2, headW: 0.14, mat: MAT.yellow }
  };
  var TOOL_IDS = ['spanner', 'brace', 'filterwrench', 'socket', 'reader'];
  function toolOwned(t) { return !!(S.tools && S.tools[t]); }
  function toolPrompt(t) {
    if (!toolOwned(t)) return t === 'socket' ? 'An empty hook: the spark plug socket is on the PC (Garage)' : '';
    if (S.tool === t) return 'Hang the ' + TOOLS[t].name + ' back';
    return 'Take the ' + TOOLS[t].name + (S.tool ? ' (hang the ' + TOOLS[S.tool].name + ' back)' : '');
  }
  function toolUse(t) { if (!toolOwned(t)) return; S.tool = S.tool === t ? null : t; sfx('putdown'); toolWallSync(); hudDirty = true; }
  function toolWallSync() { if (!G.toolHooks) return; TOOL_IDS.forEach(function (t) { var H = G.toolHooks[t]; if (H) { H.hook.visible = toolOwned(t); H.tool.visible = S.tool !== t; } }); }

  // ── The places on a car ───────────────────────────────────────────
  // where each step happens, in the car's own frame (front is +x, the near side, towards the forecourt's east, is +z), the size of the
  // box you look at, and its name. A place only answers while its step is the next one, so the body's own prompt is there otherwise
  var PLACES = {
    jack: { p: [0.1, 0.32, 0.98], s: [0.9, 0.36, 0.3], name: 'the jacking point' },
    bonnet: { p: [1.62, 1.1, 0], s: [1.05, 0.3, 1.66], name: 'the bonnet' },
    cap: { p: [1.42, 1.04, 0.28], s: [0.26, 0.24, 0.26], name: 'the oil filler cap', bay: true },
    battery: { p: [1.72, 1.02, -0.52], s: [0.36, 0.26, 0.3], name: 'the battery', bay: true },
    airbox: { p: [1.55, 1.02, 0.52], s: [0.4, 0.22, 0.32], name: 'the air filter box', bay: true },
    coolant: { p: [1.28, 1.02, -0.6], s: [0.22, 0.24, 0.22], name: 'the coolant tank', bay: true },
    plugs: { p: [1.6, 1.08, 0], s: [0.5, 0.2, 0.5], name: 'the spark plugs', bay: true },
    lamp: { p: [1.98, 0.84, 0.62], s: [0.24, 0.24, 0.36], name: 'the back of the headlight', bay: true },
    wipers: { p: [0.95, 1.24, 0.2], s: [0.4, 0.3, 1.4], name: 'the windscreen' },
    sump: { p: [1.06, 0.24, 0.85], s: [0.3, 0.3, 0.45], name: 'the sump plug, under the front' },
    filter: { p: [0.72, 0.26, 0.85], s: [0.3, 0.3, 0.45], name: 'the oil filter, under the engine' },
    wheel: { p: [1.4, 0.36, 0.98], s: [0.8, 0.8, 0.3], name: 'the front wheel' },
    hub: { p: [1.4, 0.36, 0.98], s: [0.8, 0.8, 0.3], name: 'the hub' },
    exhaust: { p: [-1.4, 0.26, 0.75], s: [1.0, 0.3, 0.4], name: 'the exhaust' },
    obd: { p: [0.45, 0.78, 0.98], s: [0.6, 0.44, 0.24], name: 'the reader socket, under the dash' },
    rack: { name: 'the parts rack' },
    lift: { name: 'the lift control box' },
    tyre: { name: 'the tyre corner' }
  };
  function placeName(at) { return (PLACES[at] || { name: at }).name; }
  // ── The steps of each job ─────────────────────────────────────────
  // [place, action, seconds, tool, what it says, what it does to the car]. Actions: fetch (E at the parts rack or a store: takes the
  // job's parts), press (once), hold (hold E while it fills), fill (hold E and let go at the full mark), wheel (press, with the
  // wheel in your hands). The seventh field names what the step moves on the car while it fills (02-car.js, gcCarAnimate). Workers do
  // the same steps at their own pace
  var JACK_UP = ['jack', 'hold', 2.5, null, 'Jack the car up', 'up'], LOWER = ['jack', 'hold', 2, null, 'Lower the car', 'down'];
  var OPEN = ['bonnet', 'press', 0, null, 'Open the bonnet', 'open'], SHUT = ['bonnet', 'press', 0, null, 'Shut the bonnet', 'shut'];
  var NUTS_OFF = ['wheel', 'hold', 2.5, 'brace', 'Undo the wheel nuts', null, 'nutsoff'], WHEEL_OFF = ['wheel', 'press', 0, null, 'Take the wheel off', 'wheeloff'];
  var WHEEL_ON = ['hub', 'wheel', 0, null, 'Put the wheel back on', 'wheelon'], NUTS_ON = ['wheel', 'hold', 2, 'brace', 'Do the wheel nuts up', null, 'nutson'];
  function fetchStep(what) { return ['rack', 'fetch', 1.5, null, 'Take ' + what + ' from the rack']; }
  var STEPS = {
    oil: [fetchStep('the oil and a filter'), JACK_UP, ['sump', 'hold', 2, 'spanner', 'Undo the sump plug', 'pan', 'plugout'], ['sump', 'hold', 3, null, 'Let the old oil drain into the pan', null, 'drain'], ['filter', 'hold', 2.5, 'filterwrench', 'Swap the oil filter', null, 'filter'], ['sump', 'hold', 1.5, 'spanner', 'Put the sump plug back in', 'nopan', 'plugin'], LOWER, OPEN, ['cap', 'fill', 3, null, 'Fill it with fresh oil: let go at the full mark', null, 'oilfill'], SHUT],
    brakes: [fetchStep('a pad set'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['hub', 'hold', 4, 'spanner', 'Swap the brake pads', null, 'pads'], ['hub', 'press', 0, null, 'Wheel back on', 'wheelon'], NUTS_ON, LOWER],
    bulb: [fetchStep('a bulb'), OPEN, ['lamp', 'hold', 2, null, 'Swap the headlight bulb', 'lampon', 'bulb'], SHUT],
    battery: [fetchStep('a battery'), OPEN, ['battery', 'hold', 2, 'spanner', 'Undo the battery clamp', null, 'clamp'], ['battery', 'hold', 2, null, 'Lift the old battery out and drop the new one in', null, 'battery'], SHUT],
    terminal: [OPEN, ['battery', 'hold', 2, 'spanner', 'Clean the terminal and do it up tight', null, 'terminal'], SHUT],
    wipers: [fetchStep('a pair of wiper blades'), ['wipers', 'hold', 2, null, 'Swap the wiper blades', null, 'wipers']],
    puncture: [fetchStep('a plug kit'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['tyre', 'hold', 3, null, 'Turn the wheel in the water tank until the bubbles show the hole'], ['tyre', 'hold', 2, null, 'Plug the hole'], ['tyre', 'hold', 2, null, 'Pump it up on the air line'], WHEEL_ON, NUTS_ON, LOWER],
    airfilter: [fetchStep('an air filter'), OPEN, ['airbox', 'hold', 2.5, null, 'Swap the air filter', null, 'airfilter'], SHUT],
    plugs: [fetchStep('a set of spark plugs'), OPEN, ['plugs', 'hold', 4, 'socket', 'Swap the spark plugs', null, 'plugs'], SHUT],
    coolant: [fetchStep('the coolant'), OPEN, ['coolant', 'fill', 2.5, null, 'Top up the coolant: let go at the full mark', null, 'coolant'], SHUT],
    newtyre: [fetchStep('a tyre'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['tyre', 'hold', 4, null, 'Swap the tyre on the tyre machine'], ['tyre', 'hold', 2, null, 'Balance the wheel'], WHEEL_ON, NUTS_ON, LOWER],
    exhaust: [fetchStep('an exhaust section'), JACK_UP, ['exhaust', 'hold', 3, 'spanner', 'Unbolt the old exhaust section', null, 'exhoff'], ['exhaust', 'hold', 3, 'spanner', 'Bolt the new section on', null, 'exhon'], LOWER],
    discs: [fetchStep('the discs and pads'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['hub', 'hold', 5, 'spanner', 'Swap the discs and pads', null, 'discs'], ['hub', 'press', 0, null, 'Wheel back on', 'wheelon'], NUTS_ON, LOWER]
  };
  // the steps that fit the new part: once one is done the parts you took off the rack are in the car, not in your hands
  var FIT_ANIMS = ['oilfill', 'pads', 'discs', 'bulb', 'battery', 'wipers', 'airfilter', 'plugs', 'coolant', 'exhon'];
  // starting work on the car puts the parts you carried from the rack down on the floor beside it (02-car.js draws them there)
  function setPartsDown(b) { if (S.hand && S.hand.kind === 'parts' && S.hand.bay === b) { S.hand = null; sfx('putdown'); hudDirty = true; } }
  function mkStep(a, fid) { return { at: a[0], act: a[1], secs: a[2], tool: a[3], label: a[4], fx: a[5] || null, anim: a[6] || null, fit: FIT_ANIMS.indexOf(a[6]) >= 0, fault: fid }; }
  // a job's steps: each fault's in turn (a second fault the customer said yes to comes after the first)
  function stepsOf(J) { var out = []; jobFaults(J).forEach(function (fid) { (STEPS[fid] || []).forEach(function (a) { out.push(liftStep(J, mkStep(a, fid))); }); }); return out; }
  function curStep(J) { if (!J || J.state !== 'taken') return null; return stepsOf(J)[J.step] || null; }
  // the parts for the step's fault: missing ones, and whether the job is covered (on the shelves, or coming on the van)
  function stepParts(s) { return s && s.fault ? faultById(s.fault).parts || [] : []; }
  function needCount(list) { var n = {}; list.forEach(function (p) { n[p] = (n[p] || 0) + 1; }); return n; }
  function missingParts(J) {
    var s = curStep(J); if (!s || s.act !== 'fetch') { var st = stepsOf(J).slice(J.step).filter(function (x) { return x.act === 'fetch'; })[0]; if (!st) return []; s = st; }
    var need = needCount(stepParts(s)), out = []; for (var p in need) if ((S.stock[p] || 0) < need[p]) out.push(p); return out;
  }
  function partsCovered(J) { var miss = missingParts(J); return miss.every(function (p) { return onOrder(p) > 0; }); }

  // ── Finding the fault ─────────────────────────────────────────────
  // a job whose symptom could be more than one open fault starts as "find the fault": J.diag.named is null and J.faults is empty, so it
  // has no steps yet. A check is a hold of E at a place on the car and finds a line of words for each fault (ok for every fault it
  // says nothing about); only the checks that would tell the answers on the card apart are offered. You read the findings and name the
  // fault on the job card. A wrong name is found out when the car is started at the end, and costs the part and the time
  var CHECKS = {
    codes: { at: 'obd', tool: 'reader', secs: 2, label: 'Plug the reader in and read the codes', ok: 'No fault codes stored.', finds: { plugs: 'P0300: a random misfire.', airfilter: 'P0101: the air flow reads low.' } },
    battery: { at: 'battery', tool: 'reader', secs: 1.5, label: 'Test the battery with the reader', ok: '12.6 volts: the battery is healthy and the terminals are tight.', finds: { battery: '11.4 volts and falling: the battery is worn out.', terminal: '12.6 volts, but the negative terminal is furred up and moves on its post.' } },
    airbox: { at: 'airbox', tool: null, secs: 1.5, label: 'Open the air box and look at the filter', ok: 'The air filter is clean.', finds: { airfilter: 'The air filter is black and clogged.' } },
    brake: { at: 'wheel', tool: null, secs: 1.5, label: 'Look at the brake through the wheel', ok: 'Plenty of pad left and the disc is smooth.', finds: { brakes: 'The pads are worn thin; the disc is smooth.', discs: 'The pads are down to the metal and the disc is deeply scored.' } },
    tyre: { at: 'wheel', tool: null, secs: 1.5, label: 'Look over the tyre', ok: 'The tyre is sound.', finds: { puncture: 'A screw in the tread, and plenty of tread left.', newtyre: 'Worn down to the cord across the tread.' } }
  };
  var CHECK_IDS = ['codes', 'battery', 'airbox', 'brake', 'tyre'];
  function finding(cid, fid) { var K = CHECKS[cid]; return (K.finds && K.finds[fid]) || K.ok; }
  // the answers a car's symptom can be at your level (the true fault is always one of them); a comeback is known already
  function diagStart(car, known) {
    var c = known ? [car.fault] : symptomOf(car).faults.filter(function (f) { var F = faultById(f); return F.id === f && F.lvl <= S.level; });
    if (c.indexOf(car.fault) < 0) c.push(car.fault);
    return { cands: c, done: {}, wrong: [], named: c.length === 1 ? c[0] : null, checks: 0, p: 0 };
  }
  function unnamed(J) { return !!(J && J.diag && !J.diag.named); }
  function diagnosing(J) { return !!(J && J.state === 'taken' && unnamed(J)); }
  // the answers still on the card (a wrong name is crossed off), and those the findings so far agree with (the mechanic goes by these)
  function candList(J) { var D = J.diag; return D.cands.filter(function (f) { return D.wrong.indexOf(f) < 0; }); }
  function consistent(J) { var D = J.diag; return candList(J).filter(function (f) { for (var c in D.done) if (finding(c, f) !== D.done[c]) return false; return true; }); }
  function shortList(list) { var a = list.map(function (f) { return faultById(f).short; }); return a.length > 1 ? a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1] : a.join(''); }
  // the checks worth doing: not done yet, and finding different things across the answers given
  function checksFor(J, among) {
    var set = among || candList(J), D = J.diag;
    return CHECK_IDS.filter(function (cid) { if (D.done[cid] !== undefined) return false; if (CHECKS[cid].tool && !toolOwned(CHECKS[cid].tool)) return false; var seen = {}; set.forEach(function (f) { seen[finding(cid, f)] = 1; }); return Object.keys(seen).length > 1; });
  }
  function checkAt(J, at) { return checksFor(J).filter(function (cid) { return CHECKS[cid].at === at; })[0] || null; }
  function checkBlock(b, cid) {
    var J = jobAt(b), K = CHECKS[cid];
    if (J.assign && staffById(J.assign)) return staffById(J.assign).name + ' is on this car';
    if (PLACES[K.at] && PLACES[K.at].bay && !(J.vis && J.vis.open)) return 'open the bonnet first';
    if (K.tool && S.tool !== K.tool) return 'you need the ' + TOOLS[K.tool].name + ': take it off the tool wall';
    return null;
  }
  function doCheck(b, cid, by) {
    var J = jobAt(b); if (!diagnosing(J) || J.diag.done[cid] !== undefined) return null;
    var f = finding(cid, J.car.fault); J.diag.done[cid] = f; J.diag.checks++; J.diag.p = 0; sfx('beep');
    toast((by && by !== 'player' ? by + ': ' : '') + f, ''); logEvent(J.car.name + "'s " + J.car.make + ': ' + f, '');
    screenDirtyAll(); hudDirty = true; return f;
  }
  // naming the fault prices the job and its steps begin. A bonnet opened for the checks stays open for a job that works under it,
  // and is shut for one that does not
  function nameFault(b, fid, by) {
    var J = jobAt(b); if (!diagnosing(J)) return 'nothing to name'; if (candList(J).indexOf(fid) < 0) return 'not one of the answers';
    var D = J.diag; D.named = fid; D.namedAfter = D.checks; J.faults = [fid]; J.step = 0; J.stepP = 0; J.hold = null; if (G.hold && G.hold.bay === b) G.hold = null;
    var pr = priceFor(jobFaults(J)); J.price = J.comeback ? 0 : pr.total; J.parts = J.comeback ? 0 : pr.parts;
    if (J.vis && J.vis.open && !stepsOf(J).some(function (s) { return s.fx === 'open'; })) stepFx(b, 'shut');
    skipOpen(J); sfx('ok');
    toast((by && by !== 'player' ? by + ' says it is ' : 'Job card, bay ' + (b + 1) + ': ') + faultById(fid).job + ' for ' + money(J.price) + '.', 'good');
    logEvent((by && by !== 'player' ? by + ' named' : 'Named') + ' the fault on ' + J.car.name + "'s " + J.car.make + ': ' + faultById(fid).job + '.', '');
    screenDirtyAll(); hudDirty = true; return '';
  }
  // an Open the bonnet step with the bonnet already up is done already
  function skipOpen(J) { var s = curStep(J); while (s && s.fx === 'open' && J.vis && J.vis.open) { J.step++; s = curStep(J); } }
  // the last step done on a wrong name: started up, the car still does it. The part fitted is lost (the invoice never carries it), the
  // name is crossed off and the job goes back to finding the fault; with one answer left, it is named for you
  function wrongFix(b, by) {
    var J = jobAt(b), D = J.diag, F = faultById(D.named), lost = 0, names = [];
    (F.parts || []).forEach(function (p) { if (PARTS[p]) { lost += PARTS[p].cost; names.push(PARTS[p].name); } });
    D.wrong.push(D.named); D.named = null; J.doneExtra = (J.doneExtra || []).concat(J.faults.slice(1)); J.faults = []; J.step = 0; J.stepP = 0; J.hold = null; J.vis = {}; carVis(b);
    var pr = priceFor(jobFaults(J)); J.price = J.comeback ? 0 : pr.total; J.parts = J.comeback ? 0 : pr.parts;
    S.stats.wrong = (S.stats.wrong || 0) + 1; sfx('bad');
    toast('Started it up, and it still does it: it was not ' + F.job + '.' + (lost ? ' The ' + names.join(' and ') + ' cost ' + money(lost) + ', and the customer will not pay for ' + (names.length > 1 ? 'them' : 'it') + '.' : ''), 'bad');
    logEvent('Wrong: ' + J.car.name + "'s " + J.car.make + ' did not need ' + F.job + (by && by !== 'player' && by !== 'dev' ? ' (' + by + ')' : '') + '.' + (lost ? ' ' + money(lost) + ' of parts wasted.' : ''), 'bad');
    var left = candList(J); if (left.length === 1) nameFault(b, left[0], 'player');
    screenDirtyAll(); hudDirty = true;
  }
  // right first time after at least one check: a little XP, and the books count it
  function diagRight(J) {
    var D = J.diag; if (!D || D.cands.length < 2 || D.wrong.length || !D.namedAfter) return;
    S.stats.diagRight = (S.stats.diagRight || 0) + 1; addXp(5); logEvent('Right first time on ' + J.car.name + "'s " + J.car.make + '.', 'good');
  }
  // holding E at a check: it fills while you stay at the car
  function checkTick(H, dt) {
    var J = jobAt(H.bay); if (!diagnosing(J) || J.diag.done[H.check] !== undefined) { G.hold = null; return; }
    if (!player.keys.KeyE || !nearCar(H.bay, 3.4)) { G.hold = null; J.diag.p = 0; screenDirtyAll(); return; }
    J.diag.p += dt / CHECKS[H.check].secs;
    if (worldTime - (G.lastClank || 0) > 0.9) { G.lastClank = worldTime; sfx('click'); }
    if (J.diag.p >= 1) { G.hold = null; doCheck(H.bay, H.check, 'player'); }
    hudDirty = true;
  }
  // a place on the car while the fault is being found: the bonnet opens freely, the other places offer their check. The open bonnet's
  // box covers the engine bay, so it offers to shut only once no check is left under it (naming the fault shuts it when the job needs)
  function bayCheckLeft(J) { return checksFor(J).some(function (cid) { return PLACES[CHECKS[cid].at].bay; }); }
  function diagPrompt(b, at) {
    var J = jobAt(b); if (J.assign && staffById(J.assign)) return '';
    if (at === 'bonnet') return J.vis && J.vis.open ? (bayCheckLeft(J) ? '' : 'Shut the bonnet') : 'Open the bonnet';
    var cid = checkAt(J, at); if (!cid) return '';
    var why = checkBlock(b, cid); if (why) return CHECKS[cid].label + ': ' + why;
    return 'Hold E: ' + CHECKS[cid].label + (G.hold && G.hold.check === cid && J.diag.p > 0 ? ' · ' + Math.round(J.diag.p * 100) + '%' : '');
  }
  function diagUse(b, at) {
    var J = jobAt(b); if (J.assign && staffById(J.assign)) return;
    if (at === 'bonnet') { if (J.vis && J.vis.open && bayCheckLeft(J)) return; J.by = 'player'; stepFx(b, J.vis && J.vis.open ? 'shut' : 'open'); sfx('door'); screenDirtyAll(); return; }
    var cid = checkAt(J, at); if (!cid) return;
    var why = checkBlock(b, cid); if (why) { toast(CHECKS[cid].label + ': ' + why + '.', 'bad'); return; }
    J.by = 'player'; J.diag.p = 0; G.hold = { bay: b, check: cid, at: at };
  }
  // what the job card, the clipboard and the prompts call a job: its name, or what it could be while the fault is being found
  function jobLabel(J) { return unnamed(J) ? 'find the fault (' + shortList(candList(J)) + ')' : jobName(J); }

  // ── The car's moving parts ────────────────────────────────────────
  // the car (02-car.js) carries its own engine bay, bonnet, jack, drain pan and every part a job moves; here each place on it gets the
  // box you look at
  function carParts(b, C) {
    var g = C.g, P = g.userData.parts; C.parts = P; C.lid = P.lid; C.jackMesh = P.jack; C.pan = P.pan; C.battery = P.battery;
    C.looseWheel = g.userData.wheels && g.userData.wheels[0];
    C.places = {};
    Object.keys(PLACES).forEach(function (at) { var P = PLACES[at]; if (!P.p) return; var m = hitBox(P.s[0], P.s[1], P.s[2], P.p[0], P.p[1], P.p[2], { gc: { bay: b, at: at }, prompt: function () { return placePrompt(b, at); }, use: function () { placeUse(b, at); } }, g); C.places[at] = m; });
  }
  // what the car looks like now: its height, the jack and the pan at once, and the moving parts on their way (gcCarAnimate eases them
  // every tick). J.vis is the save's copy, so a reload puts it all back as it was, at once
  function carVis(b) { gcCarAnimate(b, 0, false); shadowDirty = true; }
  function workRestore(b) { gcCarAnimate(b, 0, true); shadowDirty = true; }
  function stepFx(b, fx) {
    var J = jobAt(b); if (!J || !fx) return; var v = J.vis || (J.vis = {});
    if (fx === 'up') v.up = true; else if (fx === 'down') v.up = false; else if (fx === 'open') v.open = true; else if (fx === 'shut') v.open = false;
    else if (fx === 'pan') v.pan = true; else if (fx === 'nopan') v.pan = false; else if (fx === 'wheeloff') v.wheelOff = true; else if (fx === 'wheelon') v.wheelOff = false;
    carVis(b);
  }

  // ── Doing a step ──────────────────────────────────────────────────
  // why a step cannot be done now by you, or null when it can
  function stepBlock(b, s) {
    var J = jobAt(b); if (!J || !s) return 'no job';
    if (J.assign && staffById(J.assign)) return staffById(J.assign).name + ' is on this car';
    if (PLACES[s.at] && PLACES[s.at].bay && !(J.vis && J.vis.open)) return 'open the bonnet first';
    if (s.tool && S.tool !== s.tool) return 'you need the ' + TOOLS[s.tool].name + ': ' + (toolOwned(s.tool) ? 'take it off the tool wall' : 'buy it on the PC');
    if (s.at === 'tyre') { if (!owns('tyre')) return 'the shop has no tyre corner yet'; if (!(S.hand && S.hand.kind === 'wheel' && S.hand.bay === b)) return 'take the wheel to the tyre corner'; if (s.fault === 'newtyre' && !owns('tyremachine')) return 'the tyre machine is on the PC'; }
    if (s.act === 'wheel' && !(S.hand && S.hand.kind === 'wheel' && S.hand.bay === b)) return 'bring the wheel back from the tyre corner';
    return null;
  }
  function verb(s) { return s.act === 'hold' || s.act === 'fill' ? 'Hold E: ' : ''; }
  function placePrompt(b, at) {
    var J = jobAt(b); if (diagnosing(J)) return diagPrompt(b, at);
    var s = curStep(J); if (!s || s.at !== at) return '';
    if (s.act === 'fetch') return '';
    var why = stepBlock(b, s); if (why) return s.label + ': ' + why;
    if (s.act === 'fill') return verb(s) + s.label + ' · ' + fillText(J);
    return verb(s) + s.label + (J.stepP > 0 ? ' · ' + Math.round(J.stepP * 100) + '%' : '');
  }
  function fillText(J) { var p = J.stepP || 0; return p < 0.9 ? 'level ' + Math.round(p * 100) + '%' : p <= 1.1 ? 'at the mark: let go' : 'over the mark: ' + Math.round(p * 100) + '%'; }
  function placeUse(b, at) {
    var J = jobAt(b); if (diagnosing(J)) { diagUse(b, at); return; }
    var s = curStep(J); if (!s || s.at !== at) return;
    var why = stepBlock(b, s); if (why) { toast(s.label + ': ' + why + '.', 'bad'); return; }
    J.by = 'player'; setPartsDown(b);
    if (s.act === 'press' || s.act === 'wheel') { if (s.act === 'wheel' && S.hand && S.hand.kind === 'wheel') S.hand = null; doStep(b, 'player'); return; }
    if (s.act === 'hold' || s.act === 'fill') { G.hold = { bay: b, step: J.step, at: at, fill: s.act === 'fill' }; }
  }
  // holding E: the step fills while you keep E down and stay at the car (or the tyre corner). A fill step goes past the mark if you
  // keep holding: let go between 90 and 110 percent, or let a little out (hold again) and try once more
  function workTick(dt) {
    var H = G.hold; if (!H) return;
    if (H.check) { checkTick(H, dt); return; }
    var J = jobAt(H.bay), s = curStep(J);
    if (!s || J.step !== H.step) { G.hold = null; return; }
    var here = s.at === 'tyre' ? nearTyre(3.2) : nearCar(H.bay, 3.4);
    if (!player.keys.KeyE || !here) {
      if (H.fill) { if (J.stepP >= 0.9 && J.stepP <= 1.1) { doStep(H.bay, 'player'); } else if (J.stepP > 1.1) { J.over = true; toast('Too much: it is over the mark. Hold E to let a little out.', 'bad'); } }
      G.hold = null; screenDirtyAll(); return;
    }
    if (H.fill && J.over) { J.stepP = Math.max(0, J.stepP - dt / 1.2); if (J.stepP <= 1.05) { J.over = false; toast('Back at the mark. Hold again to top it up, or it is done if you let go.', ''); } }
    else J.stepP += dt / (s.secs * speedFor(s));
    if (s.at === 'lift') carVis(H.bay);
    if (worldTime - (G.lastClank || 0) > 0.7) { G.lastClank = worldTime; sfx(Math.random() < 0.5 ? 'crate' : 'putdown'); }
    if (!H.fill && J.stepP >= 1) { G.hold = null; doStep(H.bay, 'player'); }
    hudDirty = true; if (Math.floor(worldTime * 4) !== G.lastCard) { G.lastCard = Math.floor(worldTime * 4); screenDirtyAll(); }
  }
  // a faster jack from the PC shortens the jack steps
  function speedFor(s) { return s.at === 'jack' && owns('fastjack') ? 0.5 : 1; }
  // the step is done: what it does to the car, the next step, and at the end the job
  function doStep(b, by) {
    var J = jobAt(b), s = curStep(J); if (!s) return false;
    if (s.act === 'fetch' && by !== 'player') { if (!takeParts(b, s)) return false; }
    stepFx(b, s.fx);
    if (s.fit && S.hand && S.hand.kind === 'parts' && S.hand.bay === b) S.hand = null;
    if (s.fx === 'wheeloff' && by === 'player' && stepsOf(J).slice(J.step + 1).some(function (x) { return x.at === 'tyre'; })) S.hand = { kind: 'wheel', bay: b, label: J.car.name + "'s wheel" };
    J.step++; J.stepP = 0; J.over = false; J.hold = null; addXp(1);
    // the last step: start it up. A wrong name shows now (finding the fault, above)
    if (J.step >= stepsOf(J).length) { if (J.diag && J.diag.named && J.diag.named !== J.car.fault) wrongFix(b, by); else { diagRight(J); jobFinished(b, by); } }
    else { skipOpen(J); var n = curStep(J); if (by === 'player' && n) toast('Next: ' + n.label + ' (' + placeName(n.at) + ').', ''); }
    screenDirtyAll(); hudDirty = true; return true;
  }
  // the parts for a fetch step come off the shelves; short of one, the job waits on it (the card and the PC say what)
  function takeParts(b, s) {
    var J = jobAt(b), need = needCount(stepParts(s)), miss = [];
    for (var p in need) if ((S.stock[p] || 0) < need[p]) miss.push(p);
    if (miss.length) { J.hold = 'parts'; return false; }
    for (var q in need) S.stock[q] -= need[q];
    stockDraw(); return true;
  }
  // E at the rack (or a store): the parts for the job whose next step is a fetch, the one you are working first
  function fetchJob() {
    var best = -1; for (var b = 0; b < bayCount(); b++) { var J = jobAt(b), s = curStep(J); if (s && s.act === 'fetch' && !(J.assign && staffById(J.assign))) { if (best < 0 || J.by === 'player') best = b; } }
    return best;
  }
  function rackPrompt() {
    var b = fetchJob();
    if (b >= 0) { var J = jobAt(b), s = curStep(J), miss = missingParts(J); return miss.length ? s.label + ': not on the shelf: ' + miss.map(function (p) { return PARTS[p].name; }).join(', ') + ' (order on the PC)' : s.label + ' for bay ' + (b + 1); }
    return 'The parts: ' + stockTotal() + ' of ' + stockCap() + ' on the shelves';
  }
  function rackUse() {
    var b = fetchJob(); if (b < 0) { toast('The shelves: ' + stockLine() + '.', ''); return; }
    var J = jobAt(b), s = curStep(J);
    if (!takeParts(b, s)) { toast('Not on the shelf: ' + missingParts(J).map(function (p) { return PARTS[p].name; }).join(', ') + '. Order it on the PC.', 'bad'); screenDirtyAll(); return; }
    J.by = 'player'; S.hand = { kind: 'parts', bay: b, label: 'the parts for ' + J.car.name + "'s " + J.car.make }; sfx('crate'); doStep(b, 'player');
  }
  // the tyre corner (02-rooms.js) asks this for its prompt and its E
  function tyreJob() { for (var b = 0; b < bayCount(); b++) { var s = curStep(jobAt(b)); if (s && s.at === 'tyre') return b; } return -1; }
  function tyrePrompt() {
    var b = tyreJob(); if (b < 0) return 'The tyre corner: the water tank, the air line' + (owns('tyremachine') ? ', the tyre machine and the balancer' : '');
    var J = jobAt(b), s = curStep(J), why = stepBlock(b, s); if (why) return s.label + ': ' + why;
    return verb(s) + s.label + (J.stepP > 0 ? ' · ' + Math.round(J.stepP * 100) + '%' : '');
  }
  function tyreUse() { var b = tyreJob(); if (b < 0) return; var J = jobAt(b), s = curStep(J), why = stepBlock(b, s); if (why) { toast(s.label + ': ' + why + '.', 'bad'); return; } J.by = 'player'; G.hold = { bay: b, step: J.step, at: 'tyre', fill: false }; }
  // a place box on the car wins over the car body's own box when it has something to say
  GAME.hitPriority = function (hs, first) { var d = hs.object.userData.it, f = first && first.object.userData.it; return !!(d && d.gc && f && f.gcCar !== undefined && d.prompt()); };
  // the HUD line for your hands
  function handLine() { var t = S.tool ? TOOLS[S.tool].name : 'no tool', h = S.hand ? S.hand.label : ''; return t + (h ? ' · ' + h : ''); }

  // ── The marker ────────────────────────────────────────────────────
  // what to do next is marked where it is: a bobbing amber arrow over it and a glowing outline round it, seen through the car. It follows
  // the job you are on (the one you have worked, or the nearest): the customer to take the job or the payment, the tool on the wall
  // when the next step wants one you are not holding, the parts rack, the place on the car (the step, or a check while the fault is
  // found), the lift's control box, the tyre corner. Nothing while you drive, or while a worker has the car
  function markerJob() {
    var best = -1, bd = 1e9;
    for (var b = 0; b < bayCount(); b++) { var J = jobAt(b), C = carIn(b); if (!J || !C || J.state === 'coming' || J.state === 'paid' || J.state === 'leaving') continue; if (J.assign && staffById(J.assign)) continue; if (S.hand && S.hand.bay === b) return b; if (J.state === 'taken' && J.by === 'player') return b; var d = dist2(player.x, player.z, C.x, C.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  // the target: a world point, a size, a turn (the outline is aligned with what it marks) and a key for the tests
  function markerTarget() {
    if (G.drive) return null; var b = markerJob(); if (b < 0) return null; var J = jobAt(b), C = carIn(b), cu = customerIn(b);
    var onCar = function (at) { var P = PLACES[at]; if (!P || !P.p) return null; C.g.updateMatrixWorld(true); var w = C.g.localToWorld(new THREE.Vector3(P.p[0], P.p[1], P.p[2])); return { x: w.x, y: w.y, z: w.z, s: P.s, ry: C.g.rotation.y, key: 'car:' + at }; };
    var onObj = function (g, dy, s, key) { if (!g) return null; g.updateMatrixWorld(true); var w = new THREE.Vector3(); g.getWorldPosition(w); var q = new THREE.Quaternion(); g.getWorldQuaternion(q); var e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); return { x: w.x, y: w.y + dy, z: w.z, s: s, ry: e.y, key: key }; };
    var tool = function (t) { var H = G.toolHooks && G.toolHooks[t]; return H ? onObj(H.hook, 0, [0.26, 0.6, 0.14], 'tool:' + t) : null; };
    if ((J.state === 'waiting' || J.state === 'done') && cu && !cu.walking) return onObj(cu.g, 0.95, [0.8, 1.95, 0.8], 'customer');
    if (J.state !== 'taken') return null;
    if (diagnosing(J)) {
      var ck = checksFor(J)[0]; if (!ck) return null; var K = CHECKS[ck];
      if (K.tool && S.tool !== K.tool) return tool(K.tool);
      if (PLACES[K.at].bay && !(J.vis && J.vis.open)) return onCar('bonnet');
      return onCar(K.at);
    }
    var s = curStep(J); if (!s) return null;
    if (s.tool && S.tool !== s.tool && toolOwned(s.tool)) return tool(s.tool);
    if (s.act === 'fetch') { var R = propInst.rack; return R ? onObj(R.g, 1.0, [1.95, 1.95, 0.5], 'rack') : null; }
    if (s.at === 'lift') { var L = liftWorld(J.lift || 0); return { x: L.x - 1.5, y: 1.25, z: L.z + 0.25, s: [0.32, 0.42, 0.22], ry: 0, key: 'lift' }; }
    if (s.at === 'tyre') { var T2 = roomInst('gcTyre'); return T2 ? onObj(T2.g, 0.9, [1.6, 1.4, 1.2], 'tyre') : null; }
    if (PLACES[s.at] && PLACES[s.at].bay && !(J.vis && J.vis.open)) return onCar('bonnet');
    return onCar(s.at);
  }
  function markerBuild() {
    var amber = new THREE.MeshBasicMaterial({ color: 0xffb53d, transparent: true, opacity: 0.95, depthTest: false }), g = new THREE.Group(); g.userData.dynamic = true; g.renderOrder = 999;
    var arrow = new THREE.Group(); g.add(arrow);
    var head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 14), amber); head.rotation.x = Math.PI; arrow.add(head);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), amber); stem.position.y = 0.19; arrow.add(stem);
    var line = new THREE.LineBasicMaterial({ color: 0xffb53d, transparent: true, opacity: 0.9, depthTest: false });
    var box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), line); g.add(box);
    [head, stem, box].forEach(function (m) { m.renderOrder = 999; m.castShadow = false; m.frustumCulled = false; });
    scene.add(g); G.marker = { g: g, arrow: arrow, box: box, line: line, amber: amber, at: null };
    return G.marker;
  }
  function markerSync(dt) {
    var t = markerTarget(), M = G.marker || (t ? markerBuild() : null); if (!M) return;
    M.at = t ? t.key : null; M.g.visible = !!t; if (!t) return;
    var pulse = 0.55 + 0.45 * Math.sin(worldTime * 5);
    M.box.position.set(t.x, t.y, t.z); M.box.rotation.set(0, t.ry || 0, 0); M.box.scale.set(t.s[0] + 0.06, t.s[1] + 0.06, t.s[2] + 0.06);
    M.arrow.position.set(t.x, t.y + t.s[1] / 2 + 0.28 + Math.sin(worldTime * 3) * 0.06, t.z); M.arrow.rotation.y += (dt || 0) * 1.5;
    M.line.opacity = 0.35 + 0.55 * pulse; M.amber.opacity = 0.7 + 0.3 * pulse;
  }
