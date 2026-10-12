// Finding the fault, from a fresh save: a simple symptom named at the desk, a car that struggles to start found with the reader and
// named right, a guess that is wrong (the battery wasted, the terminal named for you), the codes at level 3, the apprentice who waits
// for a name, a reload in the middle of a diagnosis, and a 0.3 save. No backslash-quote in the body.
'use strict';
module.exports = `
  const V3 = (x, y, z) => new window.THREE.Vector3(x, y, z);
  const wp = (b, at) => { const p = T.PLACES[at].p; return T.car(b).g.localToWorld(V3(p[0], p[1], p[2])); };
  const look = (b, at) => { const w = wp(b, at); return T.lookAt(w.x, w.y, w.z); };
  const hold = async (sec) => { T.player.keys.KeyE = true; T.run(sec); T.player.keys.KeyE = false; T.run(0.05); };
  const atCar = (b) => { T.player.x = T.BAYS[b].x + 2.4; T.player.z = T.BAYS[b].z; };
  const atDesk = (b) => { T.player.x = T.deskStand(b).x; T.player.z = T.deskStand(b).z + 1.6; };
  const park = (fault) => { T.devCommand('car', fault); T.devCommand('park'); T.run(4); T.run(16); };
  const press = (b, at) => { look(b, at); T.useFocus(); };
  T.enter(); await wait(300); T.G.noReload = true; T.G.nextCarAt = Infinity;
  ok(S.level === 1 && S.tools.reader && T.G.toolHooks.reader.hook.visible && T.G.toolHooks.reader.tool.visible, 'the code reader hangs on the tool wall from the start');
  ok(T.SYMPTOMS.every((s) => s.faults.every((f) => T.FAULTS.some((x) => x.id === f))) && T.FAULTS.every((f) => T.SYMPTOMS.some((s) => s.faults.indexOf(f.id) >= 0)), 'every symptom names real faults and every fault has a symptom');
  ok(T.STEPS.terminal && T.FAULTS.some((f) => f.id === 'terminal' && f.parts.length === 0), 'the loose terminal is a job with no part');

  // a symptom with one open fault is named at the desk, as before
  park('bulb'); ok(T.job(0).diag.named === 'bulb' && T.job(0).faults.join() === 'bulb' && T.job(0).price > 0 && !T.diagnosing(T.job(0)), 'the headlight is named at once, priced ' + T.job(0).price);
  T.devCommand('leave');

  // it struggles to start: at level 1 a battery or a loose terminal (the plugs are not open yet)
  park('battery'); const J = T.job(0);
  ok(J.state === 'waiting' && J.car.sym === 'nostart' && J.diag.named === null && J.diag.cands.slice().sort().join() === 'battery,terminal' && J.price === 0, 'it struggles to start: ' + J.diag.cands.join() + ', no price yet');
  T.run(16); atDesk(0); { const txt = T.lookAt(T.customer(0).rec.x, 1.3, T.customer(0).rec.z); ok(/struggles to start/.test(txt) && /find the fault/.test(txt), 'the customer: ' + txt); }
  T.takeJob(0); ok(T.diagnosing(J) && T.stepsOf(J).length === 0 && T.curStep(J) === null && /find the fault/.test(T.jobLabel(J)), 'taken as find the fault: no steps yet');
  ok(T.checksFor(J).join() === 'battery', 'the one check that tells them apart is the battery test: ' + T.checksFor(J).join());
  ok(/find the fault/.test(T.jobChip()), 'the HUD chip: ' + T.jobChip());
  T.G.jobCard.dirty = true; T.drawScreens(0); { const z = T.G.jobCard.zones.map((k) => k.label); ok(z.indexOf('battery') >= 0 && z.indexOf('terminal') >= 0, 'the job card has a button an answer: ' + z.join(', ')); }
  T.openPanel('jobs'); ok(/It is: battery/.test(T.panelHtml()) && /Still to check/.test(T.panelHtml()), 'the clipboard shows the answers and the check'); T.closePanel();
  T.pcGo('jobs'); ok(T.pcRows('jobs').some((r) => /find the fault/.test(r.text)), 'the Jobs app on the PC too');
  ok(T.offerExtra(0) === false, 'no upsell before the fault is named');
  // the checks: the codes say the same for both, so the socket offers nothing; the battery wants the bonnet up and the reader
  atCar(0); { const txt = look(0, 'obd'); ok(!/Hold E/.test(txt), 'the reader socket has nothing to tell here: ' + txt); }
  { const txt = look(0, 'bonnet'); ok(/Open the bonnet/.test(txt), 'the bonnet opens while you look: ' + txt); } T.useFocus(); T.run(1.5); ok(J.vis.open && T.car(0).lid.rotation.z > 1, 'the bonnet is up');
  { const txt = look(0, 'battery'); ok(/you need the code reader/.test(txt), 'the battery test wants the reader: ' + txt); }
  T.toolUse('reader'); ok(S.tool === 'reader' && !T.G.toolHooks.reader.tool.visible, 'the reader is in your hand, its hook shows the outline');
  { const txt = look(0, 'battery'); ok(/Hold E: Test the battery/.test(txt), 'the battery: ' + txt); }
  T.useFocus(); T.player.keys.KeyE = true; T.run(0.5); T.player.x = -3; T.player.z = 0; T.run(0.2); T.player.keys.KeyE = false; ok(!J.diag.done.battery && !T.G.hold, 'walking away stops the check');
  atCar(0); press(0, 'battery'); await hold(1.7); ok(/worn out/.test(J.diag.done.battery || '') && J.diag.checks === 1, 'the battery test: ' + J.diag.done.battery);
  ok(T.checksFor(J).length === 0 && T.consistent(J).join() === 'battery', 'nothing left to check; the findings agree with the battery');
  const xp0 = S.xp, lvl0 = S.level;
  ok(T.nameFault(0, 'battery') === '' && !T.diagnosing(J) && J.faults.join() === 'battery' && J.price === Math.round(25 * (0.9 + S.rep / 250)) + 95, 'named: a new battery for ' + J.price);
  ok(J.vis.open && T.curStep(J).act === 'fetch', 'the bonnet stays up for a job under it; the parts first');
  T.rackUse(); ok(J.step === 2 && /clamp/.test(T.curStep(J).label), 'with the bonnet up its Open step is skipped: ' + T.curStep(J).label);
  ok(S.hand && S.hand.kind === 'parts', 'the new battery is in your hands');
  atCar(0); T.toolUse('spanner'); press(0, 'battery'); ok(!S.hand, 'starting on the car puts the new battery down beside it'); await hold(2.2);
  { const fp = T.car(0).parts.floorParts; ok(fp.children.length === 1 && fp.visible !== false, 'the new battery waits on the floor by the car while the clamp comes off'); }
  press(0, 'battery'); await hold(2.2); ok(!S.hand && J.state === 'taken' && T.car(0).parts.floorParts.children.length === 0, 'dropped in: the battery is off the floor and in the car before the bonnet is shut');
  press(0, 'bonnet');
  ok(J.state === 'done' && S.stats.diagRight === 1 && (S.level > lvl0 || S.xp >= xp0 + 5 + 10 + 4), 'right first time: fixed, the books count it, and 5 XP more');
  T.takePayment(0); T.run(40); ok(!T.job(0), 'paid and gone');

  // the gamble: a car with a loose terminal, named a battery without a check
  S.stock.battery = 2; park('terminal'); const K = T.job(0); T.run(16); T.takeJob(0);
  ok(T.diagnosing(K) && K.car.fault === 'terminal', 'a terminal car: find the fault');
  ok(T.nameFault(0, 'oil') !== '' && T.diagnosing(K), 'an answer that is not on the card is refused');
  T.nameFault(0, 'battery'); ok(K.faults.join() === 'battery', 'named the battery without a check');
  T.rackUse(); atCar(0); press(0, 'bonnet'); press(0, 'battery'); await hold(2.2); press(0, 'battery'); await hold(2.2); press(0, 'bonnet');
  ok(K.state === 'taken' && S.stock.battery === 1 && K.diag.wrong.join() === 'battery' && S.stats.wrong === 1, 'started up, it still does it: the battery is gone and crossed off');
  ok(K.diag.named === 'terminal' && K.faults.join() === 'terminal' && K.step === 0 && !K.vis.open, 'one answer left: the terminal is named for you, the car closed up again');
  ok(K.price === Math.round(15 * (0.9 + S.rep / 250)), 'the invoice carries the terminal only: ' + K.price);
  ok(S.log.some((l) => /^Wrong/.test(l.msg)), 'the log says it was wrong');
  press(0, 'bonnet'); press(0, 'battery'); await hold(2.2); press(0, 'bonnet');
  ok(K.state === 'done' && S.stats.diagRight === 1, 'the terminal is done; a wrong guess is not right first time');
  T.takePayment(0); T.run(40);

  // level 3: a sluggish car could be the air filter or the plugs. The codes tell them apart, and so does a look in the air box
  while (S.level < 3) T.devCommand('level'); ok(S.level === 3, 'level 3');
  S.stock.airfilter = 2; park('airfilter'); const A = T.job(0); T.run(16); T.takeJob(0);
  ok(A.diag.cands.slice().sort().join() === 'airfilter,plugs' && T.checksFor(A).join() === 'codes,airbox', 'air filter or plugs; read the codes or look at the filter: ' + T.checksFor(A).join());
  T.toolUse('reader'); atCar(0); { const txt = look(0, 'obd'); ok(/Hold E: Plug the reader in/.test(txt), 'the reader socket: ' + txt); }
  T.useFocus(); await hold(2.2); ok(/P0101/.test(A.diag.done.codes || ''), 'the codes: ' + A.diag.done.codes);
  ok(T.consistent(A).join() === 'airfilter' && T.checksFor(A).join() === 'airbox', 'the findings agree with the air filter; the air box is still there to look at');
  // a reload in the middle keeps the findings
  T.save(); T.removeCustomer(0); T.removeCar(0); T.loadSave(T.GAME.freshState, T.GAME.migrate); T.restoreJobs();
  ok(T.diagnosing(T.job(0)) && /P0101/.test(T.job(0).diag.done.codes) && !!T.car(0), 'a reload keeps the car, the job and its findings');
  T.devCommand('leave');

  // the apprentice leaves a car whose fault is not found, and fits the part once it is named
  T.devCommand('cash', 3000); const ap = T.candidates()[0]; ok(T.hire(ap.id) === '', 'hired an apprentice');
  S.stock.battery = 2; park('battery'); const Q = T.job(0); T.run(16); T.takeJob(0);
  ok(T.diagnosing(Q) && Q.diag.cands.length === 3, 'at level 3 it could be the battery, the terminal or the plugs: ' + Q.diag.cands.join());
  for (let i = 0; i < 4; i++) T.run(2); ok(T.diagnosing(Q) && !Q.assign, 'the apprentice does not take a car whose fault is not found');
  T.nameFault(0, 'battery'); for (let i = 0; i < 40 && Q.state === 'taken'; i++) T.run(3);
  ok(Q.state === 'done' && T.staffList()[0].jobs === 1, 'named, the apprentice fitted the battery: ' + Q.state);
  T.takePayment(0); T.run(40);

  // the books, and a save from 0.3
  T.pcGo('books'); ok(T.pcRows('books').some((r) => /Diagnosis: 1 right first time . 1 wrong/.test(r.text)), 'the Books app counts the calls');
  { const old = { stats: { jobs: 1 }, jobs: [{ car: { fault: 'battery', make: 'Alder Hatch' }, faults: ['battery'], state: 'taken', step: 2 }], tools: { spanner: true, brace: true, filterwrench: true }, layoutRev: 1 };
    const m = T.GAME.migrate(old, T.GAME.freshState(), {}); ok(m.jobs[0].diag.named === 'battery' && m.tools.reader === true, 'a 0.3 job keeps its name and the reader goes on the wall'); }
  ok(/Finding the fault/.test(T.GAME.guideHtml()), 'the guide explains it');
`;
