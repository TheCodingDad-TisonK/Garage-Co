//@ Garage Co., part 02: the work. A job is a list of steps at the parts of the car: the bonnet opens, the car goes up on the jack, a wheel comes off, a tool comes off the wall. Press E, or hold it while a step fills.
  // ── Tools ─────────────────────────────────────────────────────────
  // the hand tools on the tool wall. The plug socket is bought on the PC; the rest come with the lock-up
  var TOOLS = {
    spanner: { name: 'spanner', len: 0.32, headW: 0.1 },
    brace: { name: 'wheel brace', len: 0.46, headW: 0.16 },
    filterwrench: { name: 'filter wrench', len: 0.28, headW: 0.14 },
    socket: { name: 'spark plug socket', len: 0.3, headW: 0.06 }
  };
  var TOOL_IDS = ['spanner', 'brace', 'filterwrench', 'socket'];
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
    sump: { p: [1.3, 0.24, 0.85], s: [0.5, 0.3, 0.45], name: 'the sump plug, under the front' },
    filter: { p: [0.85, 0.26, 0.85], s: [0.4, 0.3, 0.45], name: 'the oil filter, under the engine' },
    wheel: { p: [1.4, 0.36, 0.98], s: [0.8, 0.8, 0.3], name: 'the front wheel' },
    hub: { p: [1.4, 0.36, 0.98], s: [0.8, 0.8, 0.3], name: 'the hub' },
    exhaust: { p: [-1.4, 0.26, 0.75], s: [1.0, 0.3, 0.4], name: 'the exhaust' },
    rack: { name: 'the parts rack' },
    lift: { name: 'the lift control box' },
    tyre: { name: 'the tyre corner' }
  };
  function placeName(at) { return (PLACES[at] || { name: at }).name; }
  // ── The steps of each job ─────────────────────────────────────────
  // [place, action, seconds, tool, what it says, what it does to the car]. Actions: fetch (E at the parts rack or a store: takes the
  // job's parts), press (once), hold (hold E while it fills), fill (hold E and let go at the full mark), wheel (press, with the
  // wheel in your hands). Workers do the same steps at their own pace
  var JACK_UP = ['jack', 'hold', 2.5, null, 'Jack the car up', 'up'], LOWER = ['jack', 'hold', 2, null, 'Lower the car', 'down'];
  var OPEN = ['bonnet', 'press', 0, null, 'Open the bonnet', 'open'], SHUT = ['bonnet', 'press', 0, null, 'Shut the bonnet', 'shut'];
  var NUTS_OFF = ['wheel', 'hold', 2.5, 'brace', 'Undo the wheel nuts'], WHEEL_OFF = ['wheel', 'press', 0, null, 'Take the wheel off', 'wheeloff'];
  var WHEEL_ON = ['hub', 'wheel', 0, null, 'Put the wheel back on', 'wheelon'], NUTS_ON = ['wheel', 'hold', 2, 'brace', 'Do the wheel nuts up'];
  function fetchStep(what) { return ['rack', 'fetch', 1.5, null, 'Take ' + what + ' from the rack']; }
  var STEPS = {
    oil: [fetchStep('the oil and a filter'), JACK_UP, ['sump', 'hold', 2, 'spanner', 'Undo the sump plug', 'pan'], ['sump', 'hold', 3, null, 'Let the old oil drain into the pan'], ['filter', 'hold', 2.5, 'filterwrench', 'Swap the oil filter'], ['sump', 'hold', 1.5, 'spanner', 'Put the sump plug back in', 'nopan'], LOWER, OPEN, ['cap', 'fill', 3, null, 'Fill it with fresh oil: let go at the full mark'], SHUT],
    brakes: [fetchStep('a pad set'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['hub', 'hold', 4, 'spanner', 'Swap the brake pads'], ['hub', 'press', 0, null, 'Wheel back on', 'wheelon'], NUTS_ON, LOWER],
    bulb: [fetchStep('a bulb'), OPEN, ['lamp', 'hold', 2, null, 'Swap the headlight bulb', 'lampon'], SHUT],
    battery: [fetchStep('a battery'), OPEN, ['battery', 'hold', 2, 'spanner', 'Undo the battery clamp'], ['battery', 'hold', 2, null, 'Lift the old battery out and drop the new one in'], SHUT],
    wipers: [fetchStep('a pair of wiper blades'), ['wipers', 'hold', 2, null, 'Swap the wiper blades']],
    puncture: [fetchStep('a plug kit'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['tyre', 'hold', 3, null, 'Turn the wheel in the water tank until the bubbles show the hole'], ['tyre', 'hold', 2, null, 'Plug the hole'], ['tyre', 'hold', 2, null, 'Pump it up on the air line'], WHEEL_ON, NUTS_ON, LOWER],
    airfilter: [fetchStep('an air filter'), OPEN, ['airbox', 'hold', 2.5, null, 'Swap the air filter'], SHUT],
    plugs: [fetchStep('a set of spark plugs'), OPEN, ['plugs', 'hold', 4, 'socket', 'Swap the spark plugs'], SHUT],
    coolant: [fetchStep('the coolant'), OPEN, ['coolant', 'fill', 2.5, null, 'Top up the coolant: let go at the full mark'], SHUT],
    newtyre: [fetchStep('a tyre'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['tyre', 'hold', 4, null, 'Swap the tyre on the tyre machine'], ['tyre', 'hold', 2, null, 'Balance the wheel'], WHEEL_ON, NUTS_ON, LOWER],
    exhaust: [fetchStep('an exhaust section'), JACK_UP, ['exhaust', 'hold', 3, 'spanner', 'Unbolt the old exhaust section'], ['exhaust', 'hold', 3, 'spanner', 'Bolt the new section on'], LOWER],
    discs: [fetchStep('the discs and pads'), JACK_UP, NUTS_OFF, WHEEL_OFF, ['hub', 'hold', 5, 'spanner', 'Swap the discs and pads'], ['hub', 'press', 0, null, 'Wheel back on', 'wheelon'], NUTS_ON, LOWER]
  };
  function mkStep(a, fid) { return { at: a[0], act: a[1], secs: a[2], tool: a[3], label: a[4], fx: a[5] || null, fault: fid }; }
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

  // ── The car's moving parts ────────────────────────────────────────
  // the engine's car is one body; the bonnet's bump is swapped for an engine bay with a lid on a hinge, and each place gets its box
  function carParts(b, C) {
    var g = C.g, paint = g.userData.paint, bump = g.children[2]; if (bump) bump.visible = false;
    var bay = new THREE.Group(); bay.userData.dynamic = true; g.add(bay); C.bayParts = bay;
    box(1.0, 0.28, 0.04, paint, 1.6, 0.9, 0.78, bay); box(1.0, 0.28, 0.04, paint, 1.6, 0.9, -0.78, bay); box(0.04, 0.28, 1.6, paint, 2.08, 0.9, 0, bay); box(0.04, 0.2, 1.6, MAT.black, 1.12, 0.96, 0, bay);
    box(0.95, 0.04, 1.5, MAT.black, 1.6, 0.8, 0, bay); box(0.55, 0.24, 0.7, MAT.steelDark, 1.55, 0.94, 0, bay);
    cyl(0.04, 0.04, MAT.yellow, PLACES.cap.p[0], 1.08, PLACES.cap.p[2], bay, 10); box(0.02, 0.1, 0.02, MAT.yellow, 1.75, 1.08, -0.18, bay);
    C.battery = box(0.3, 0.2, 0.22, MAT.black, PLACES.battery.p[0], 0.98, PLACES.battery.p[2], bay); box(0.34, 0.14, 0.28, MAT.steelDark, PLACES.airbox.p[0], 0.98, PLACES.airbox.p[2], bay);
    box(0.14, 0.16, 0.14, std({ color: 0xe8f4f0, roughness: 0.3, transparent: true, opacity: 0.8 }), PLACES.coolant.p[0], 0.98, PLACES.coolant.p[2], bay);
    // the lid: hinged at the windscreen end, it lifts at the front
    C.lid = new THREE.Group(); C.lid.position.set(1.1, 1.05, 0); g.add(C.lid); C.lid.userData.dynamic = true;
    box(1.04, 0.04, 1.64, paint, 0.52, 0, 0, C.lid);
    // the jack under the sill, the drain pan under the sump, both on the floor (they stay down while the car goes up)
    C.jackMesh = new THREE.Group(); C.jackMesh.visible = false; g.add(C.jackMesh); box(0.24, 0.1, 0.6, std({ color: 0xc8342a, roughness: 0.45, metalness: 0.3 }), 0, 0.05, 0, C.jackMesh); cyl(0.05, 0.22, MAT.steel, 0, 0.2, 0, C.jackMesh, 10); C.jackMesh.position.set(PLACES.jack.p[0], 0, 0.75);
    C.pan = box(0.6, 0.1, 0.5, MAT.black, PLACES.sump.p[0], 0.05, 0.55, g); C.pan.visible = false;
    C.looseWheel = g.userData.wheels && g.userData.wheels[0];
    C.places = {};
    Object.keys(PLACES).forEach(function (at) { var P = PLACES[at]; if (!P.p) return; var m = hitBox(P.s[0], P.s[1], P.s[2], P.p[0], P.p[1], P.p[2], { gc: { bay: b, at: at }, prompt: function () { return placePrompt(b, at); }, use: function () { placeUse(b, at); } }, g); C.places[at] = m; });
  }
  // what the car looks like now: lid, jack, pan, wheel. J.vis is the save's copy so a reload puts it back as it was
  function carVis(b) {
    var C = carIn(b), J = jobAt(b); if (!C || !J) return; var v = J.vis || {};
    var h = carHeight(b), onLift = J.lift !== null && J.lift !== undefined;
    C.lid.rotation.z = v.open ? 1.05 : 0; C.g.position.y = h; C.jackMesh.visible = !!v.up && !onLift; C.jackMesh.position.y = -h;
    C.pan.visible = !!v.pan; C.pan.position.y = 0.05 - h;
    if (C.looseWheel) C.looseWheel.visible = !v.wheelOff;
    shadowDirty = true;
  }
  function workRestore(b) { carVis(b); }
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
    var J = jobAt(b), s = curStep(J); if (!s || s.at !== at) return '';
    if (s.act === 'fetch') return '';
    var why = stepBlock(b, s); if (why) return s.label + ': ' + why;
    if (s.act === 'fill') return verb(s) + s.label + ' · ' + fillText(J);
    return verb(s) + s.label + (J.stepP > 0 ? ' · ' + Math.round(J.stepP * 100) + '%' : '');
  }
  function fillText(J) { var p = J.stepP || 0; return p < 0.9 ? 'level ' + Math.round(p * 100) + '%' : p <= 1.1 ? 'at the mark: let go' : 'over the mark: ' + Math.round(p * 100) + '%'; }
  function placeUse(b, at) {
    var J = jobAt(b), s = curStep(J); if (!s || s.at !== at) return;
    var why = stepBlock(b, s); if (why) { toast(s.label + ': ' + why + '.', 'bad'); return; }
    J.by = 'player';
    if (s.act === 'press' || s.act === 'wheel') { if (s.act === 'wheel' && S.hand && S.hand.kind === 'wheel') S.hand = null; doStep(b, 'player'); return; }
    if (s.act === 'hold' || s.act === 'fill') { G.hold = { bay: b, step: J.step, at: at, fill: s.act === 'fill' }; }
  }
  // holding E: the step fills while you keep E down and stay at the car (or the tyre corner). A fill step goes past the mark if you
  // keep holding: let go between 90 and 110 percent, or let a little out (hold again) and try once more
  function workTick(dt) {
    var H = G.hold; if (!H) return;
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
    if (s.fx === 'wheeloff' && by === 'player' && stepsOf(J).slice(J.step + 1).some(function (x) { return x.at === 'tyre'; })) S.hand = { kind: 'wheel', bay: b, label: J.car.name + "'s wheel" };
    J.step++; J.stepP = 0; J.over = false; J.hold = null; addXp(1);
    if (J.step >= stepsOf(J).length) jobFinished(b, by);
    else { var n = curStep(J); if (by === 'player' && n) toast('Next: ' + n.label + ' (' + placeName(n.at) + ').', ''); }
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
