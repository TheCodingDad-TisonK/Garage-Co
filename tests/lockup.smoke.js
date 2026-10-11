// The lock-up's loop, end to end: a car comes in, the customer walks to the desk, the job is taken, worked step by step at the car
// (the rack, the jack, the tools off the wall, the bonnet, the oil to the mark), paid, and the car leaves.
// Run by tests/smoke.js through the engine's smoke runner. No backslash-quote in the body.
'use strict';
module.exports = `
  const V3 = (x, y, z) => new window.THREE.Vector3(x, y, z);
  const wp = (b, at) => { const p = T.PLACES[at].p; return T.car(b).g.localToWorld(V3(p[0], p[1], p[2])); };
  const look = (b, at) => { const w = wp(b, at); return T.lookAt(w.x, w.y, w.z); };
  const hold = async (sec) => { T.player.keys.KeyE = true; T.run(sec); T.player.keys.KeyE = false; T.run(0.05); };
  ok(T.CO.ready === true && typeof T.enter === 'function' && T.CO.save.key === 'garageco-slot1', 'CO.setup and CO.boot ran on slot 1');
  ok(/New garage/.test(document.getElementById('dc-start-stats').textContent) && /Slot 1/.test(document.getElementById('dc-start-note').textContent), 'the start screen says it is a new garage');
  T.enter(); ok(T.ui.started === true && document.getElementById('dc-start').hidden && !document.getElementById('dc-hud').hidden, 'enter opens the garage');
  await wait(400);
  ok(T.counts().draws > 0 && T.counts().baked >= 2, 'frames draw with the bake in: ' + JSON.stringify(T.counts()));
  ok(S.bank === 400 && S.day === 1 && S.stats.jobs === 0 && S.jobs.length === 0 && S.stage === 1 && T.bayCount() === 1, 'a fresh save: ' + S.bank + ' in the bank, one bay, no car in');
  ok(S.stock.oil === 2 && S.stock.oilfilter === 2 && S.tools.spanner && S.tools.brace && S.tools.filterwrench && !S.tools.socket, 'the lock-up starts with some stock and three tools');
  // the building
  ok(T.solids.length >= 8 && T.lampMeshes.length >= 5 && T.hdoors.length === 1, 'walls, lamps and the side door stand: ' + T.solids.length + ' solids, ' + T.lampMeshes.length + ' lenses');
  ok(['toolWall', 'bench', 'desk', 'jack', 'stands', 'drum', 'rack', 'noticeBoard'].every((id) => !!T.propInst[id]) && T.PROPS.xCompressor.extra && !T.propInst.officeDesk, 'the fittings are built, the compressor is in the catalogue, no office desk yet');
  ok(T.G.pcs.length === 1 && T.G.rackBoxes.children.length === 9 && T.G.toolHooks.spanner.hook.visible && !T.G.toolHooks.socket.hook.visible, 'the PC is on the desk, nine boxes on the rack, the socket hook is empty');
  const LO = T.LO(); ok(!!T.G.rollPanel && S.doorOpen === false && T.GAME.collides(LO.x, LO.z + T.LOCKUP.z) === true && T.GAME.collides(LO.x, LO.z) === false, 'the roll door is down and blocks the doorway (the lock-up stands at ' + LO.x + ',' + LO.z + ')');
  S.doorOpen = true; ok(T.GAME.collides(LO.x, LO.z + T.LOCKUP.z) === false, 'an open roll door lets you through'); T.tickRoll(2); ok(T.G.rollPanel.scale.y < 0.5, 'the panel rolled up: scale ' + T.G.rollPanel.scale.y.toFixed(2)); S.doorOpen = false;
  ok(T.navFreeAt(LO.x, LO.z) && T.navFreeAt(LO.x, LO.z + T.LOCKUP.z) && T.navFreeAt(T.BAY.x + 2, T.BAY.z) && !T.navFreeAt(LO.x - T.LOCKUP.x, LO.z) && !T.navFreeAt(0, 40), 'the route finder walks the lock-up, the doorway and the forecourt, not the walls or the far road');
  ok(T.traffic.cars.length === 2 && T.traffic.cars.every((c) => c.road), 'two cars on the road, on the engine road network');
  // a car comes in, through the gap in the bollards and along the apron
  const car = T.spawnCar(0, T.newCar('oil')); ok(!!car && T.job(0).state === 'coming' && !!T.car(0) && T.car(0).x < -60 && car.fault === 'oil', 'a car is on the way: ' + car.name + ' in a ' + car.make + ' with ' + car.fault);
  T.run(20); ok(T.job(0).state === 'waiting' && Math.abs(T.car(0).x - T.BAY.x) < 0.01 && Math.abs(T.car(0).z - T.BAY.z) < 0.01, 'the car parked in the bay: ' + T.car(0).x.toFixed(1) + ',' + T.car(0).z.toFixed(1));
  ok(!!T.customer(0) && T.customer(0).walking && T.customer(0).goal === 'desk', 'the customer got out and is walking to the desk');
  T.run(16); ok(!!T.customer(0) && !T.customer(0).walking && T.customer(0).at === 'desk' && Math.abs(T.customer(0).rec.x - T.deskStand(0).x) < 0.6 && Math.abs(T.customer(0).rec.z - T.deskStand(0).z) < 0.6, 'the customer stands at the desk: ' + T.customer(0).rec.x.toFixed(1) + ',' + T.customer(0).rec.z.toFixed(1));
  // take the job at the desk
  T.player.x = T.deskStand(0).x; T.player.z = T.deskStand(0).z + 1.6; T.player.y = 0;
  { const txt = T.lookAt(T.customer(0).rec.x, 1.3, T.customer(0).rec.z); ok(/Take the job/.test(txt) && /oil light/.test(txt), 'looking at the customer offers the job: ' + txt); }
  T.useFocus(); const J = T.job(0); ok(J.state === 'taken' && J.step === 0 && J.due > S.time && T.stepsOf(J).length === 10, 'E takes the job: ten steps, promised for ' + T.fmtTime(J.due));
  T.openPanel('jobs'); ok(/step 1 of 10/.test(T.panelHtml()) && /The clipboard/.test(document.getElementById('dc-panel-title').textContent), 'the clipboard shows the open job at step 1'); T.closePanel();
  // step 1: the parts off the rack
  { const r = T.propInst.rack.g.position; T.player.x = r.x - 1.6; T.player.z = r.z; const txt = T.lookAt(r.x, 1.0, r.z); ok(/Take the oil and a filter from the rack/.test(txt), 'the rack offers the parts: ' + txt); }
  T.useFocus(); ok(J.step === 1 && S.stock.oil === 1 && S.stock.oilfilter === 1 && S.hand && /parts for/.test(S.hand.label) && T.G.rackBoxes.children.length === 7, 'E at the rack takes the oil and a filter: the rack shows seven boxes');
  // step 2: the jack. The place answers; the body of the car does not take the E
  T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z;
  { const txt = look(0, 'jack'); ok(/Hold E: Jack the car up/.test(txt), 'the jacking point says what to do: ' + txt); }
  T.useFocus(); ok(!!T.G.hold && T.G.hold.at === 'jack', 'E starts holding at the jack');
  T.player.keys.KeyE = true; T.run(1); ok(J.stepP > 0.2 && J.stepP < 0.7 && J.step === 1, 'holding fills the step: ' + J.stepP.toFixed(2));
  T.player.x = -3; T.player.z = 0; T.run(0.5); ok(!T.G.hold && J.step === 1, 'walking away lets go of it'); T.player.keys.KeyE = false;
  T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z; look(0, 'jack'); T.useFocus(); await hold(2);
  ok(J.step === 2 && J.vis.up === true && Math.abs(T.car(0).g.position.y - 0.14) < 0.01 && T.car(0).jackMesh.visible, 'the car is up on the jack: y ' + T.car(0).g.position.y);
  // step 3 wants the spanner: the tool wall
  { const txt = look(0, 'sump'); ok(/you need the spanner/.test(txt), 'the sump plug asks for the spanner: ' + txt); }
  { const tw = T.propInst.toolWall.g; const hp = tw.localToWorld(V3(-1.0, 1.5, 0.06)); const out = tw.localToWorld(V3(-1.0, 1.5, 1.5)); T.player.x = out.x; T.player.z = out.z; const txt = T.lookAt(hp.x, hp.y, hp.z); ok(/Take the spanner/.test(txt), 'the tool wall offers the spanner: ' + txt); T.useFocus(); }
  ok(S.tool === 'spanner' && !T.G.toolHooks.spanner.tool.visible, 'the spanner is in your hand and its hook shows the outline');
  T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z;
  look(0, 'sump'); T.useFocus(); await hold(2.2); ok(J.step === 3 && J.vis.pan && T.car(0).pan.visible, 'the sump plug is out and the pan is under it');
  look(0, 'sump'); T.useFocus(); await hold(3.2); ok(J.step === 4, 'the old oil drained');
  { const txt = look(0, 'filter'); ok(/filter wrench/.test(txt), 'the filter wants the filter wrench: ' + txt); }
  T.toolUse('filterwrench'); look(0, 'filter'); T.useFocus(); await hold(2.7); ok(J.step === 5, 'the filter is swapped');
  T.toolUse('spanner'); look(0, 'sump'); T.useFocus(); await hold(1.7); ok(J.step === 6 && !J.vis.pan, 'the plug is back in and the pan is away');
  look(0, 'jack'); T.useFocus(); await hold(2.2); ok(J.step === 7 && !J.vis.up && T.car(0).g.position.y === 0, 'the car is down');
  // the bonnet, and the fill: hold too long and it goes over the mark
  { const txt = look(0, 'cap'); ok(!/Fill/.test(txt), 'the oil cap says nothing with the bonnet shut: ' + txt); }
  { const txt = look(0, 'bonnet'); ok(/Open the bonnet/.test(txt), 'the bonnet: ' + txt); } T.useFocus(); ok(J.step === 8 && J.vis.open && T.car(0).lid.rotation.z > 1, 'the bonnet is up');
  { const txt = look(0, 'cap'); ok(/Hold E: Fill it with fresh oil/.test(txt), 'the oil cap: ' + txt); }
  T.useFocus(); await hold(3.6); ok(J.step === 8 && J.over === true, 'held too long: over the mark (' + J.stepP.toFixed(2) + ')');
  look(0, 'cap'); T.useFocus(); await hold(0.2); ok(J.step === 9, 'let a little out and it is at the mark: the oil is done');
  look(0, 'bonnet'); T.useFocus(); ok(J.state === 'done' && S.stats.fixed === 1 && !J.vis.open, 'the bonnet is shut and the job is done');
  // the payment at the desk: labour by rep plus the parts
  T.player.x = T.deskStand(0).x; T.player.z = T.deskStand(0).z + 1.6;
  { const txt = T.lookAt(T.customer(0).rec.x, 1.3, T.customer(0).rec.z); ok(/Take the payment/.test(txt), 'the customer pays: ' + txt); }
  const price = J.price, bank0 = S.bank; ok(price === Math.round(45 * (0.9 + 10 / 250)) + 30 + 12, 'the price is labour at rep 10 plus the parts: ' + price); T.useFocus();
  ok(S.bank === bank0 + price && S.stats.jobs === 1 && S.done.length === 1 && S.done[0].price === price && S.ledger[0].n === price, 'paid ' + price + ': bank ' + S.bank + ', one job in the book');
  ok(S.rep === 12 && S.repLog[0].n === 2 && /on time/.test(S.repLog[0].why), 'on time: rep 12, and the books say why');
  ok(J.state === 'paid' && T.customer(0).walking && T.customer(0).goal === 'car', 'the customer walks back to the car');
  T.run(18); ok(T.customer(0) === null && T.job(0) && T.job(0).state === 'leaving', 'the customer is in the car and it is leaving: ' + (T.job(0) && T.job(0).state));
  T.run(30); ok(T.car(0) === null && !T.job(0), 'the car has gone and the bay is free');
  T.updateHud(1); ok(/1 job$/.test(document.getElementById('h-jobs').textContent) && /rep 12/.test(document.getElementById('h-rep').textContent), 'the HUD counts the job and the rep: ' + document.getElementById('h-jobs').textContent);
  ok(S.xp === 10 + 10 + 15 && S.level === 1, 'the job earned 35 xp (a point a step, 10 fixed, 15 paid): ' + S.xp);
  // the day rolls at six
  T.setTime(17.995); T.run(1); ok(S.day === 2 && S.time >= 8 && S.time < 8.1 && S.stats.days === 1, 'six o clock rolls the day: day ' + S.day + ' at ' + T.fmtTime(S.time));
  // the save keeps the books
  T.save(); S.stats.jobs = 99; T.loadSave(T.GAME.freshState, T.GAME.migrate); ok(S.stats.jobs === 1 && S.done.length === 1 && S.day === 2 && S.stock.oil === 1, 'the save round-trips the books and the stock');
  // a job survives a reload: the car is back in the bay with the bonnet up, and the customer at the desk
  T.devCommand('car', 'battery'); T.devCommand('park'); T.run(4); ok(T.job(0) && T.job(0).state === 'waiting' && T.job(0).car.fault === 'battery', 'dev: a battery car parked at once: ' + (T.job(0) && T.job(0).state));
  T.run(16); T.takeJob(0); T.rackUse(); T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z; look(0, 'bonnet'); T.useFocus(); ok(T.job(0).step === 2 && T.job(0).vis.open, 'the battery job is at the clamp with the bonnet up');
  T.save(); T.removeCustomer(0); T.removeCar(0); T.loadSave(T.GAME.freshState, T.GAME.migrate); T.restoreJobs();
  ok(T.job(0) && T.job(0).state === 'taken' && T.job(0).step === 2 && !!T.car(0) && T.car(0).lid.rotation.z > 1 && !!T.customer(0) && T.customer(0).at === 'desk', 'a reload puts the car back with its bonnet up and the customer at the desk');
  ok(/step 3 of 5/.test(T.devCommand('step')) && T.job(0).step === 3, 'dev: step does the next step');
  ok(/job done/.test(T.devCommand('fix')) && T.job(0).state === 'done', 'dev: fix finishes the job'); ok(T.devCommand('leave') === 'gone' && !T.job(0) && T.car(0) === null, 'dev: leave clears the bay');
  // drive it in: take the job, get in, drive through the roll door onto the lift, get out, raise it
  ok(!!T.G.liftArms[0] && T.LIFTS.length === 2, 'the lock-up has its lift');
  T.devCommand('car', 'brakes'); T.devCommand('park'); T.run(4); T.run(16); S.stock.pads = 2;
  ok(/take the job/.test(T.canDrive(0)), 'no driving before the job is taken: ' + T.canDrive(0));
  T.takeJob(0); T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z;
  { const w = T.car(0).g.position; const txt = T.lookAt(w.x, 0.9, w.z); ok(/drive it onto the lift/.test(txt), 'the car offers the drive: ' + txt); }
  ok(T.getIn(0) && !!T.drive() && T.drive().v.yaw === Math.PI, 'in the driving seat, facing the lock-up');
  { const z0 = T.car(0).z; T.player.keys.KeyW = true; for (let i = 0; i < 40; i++) T.GAME.playerOverride(1 / 60); T.player.keys.KeyW = false; ok(T.car(0).z < z0 - 0.3 && Math.abs(T.car(0).x - T.BAY.x) < 0.05, 'W drives it forward: z ' + z0.toFixed(2) + ' to ' + T.car(0).z.toFixed(2)); }
  T.drive().v.z = T.BAY.z - 4; T.drive().v.speed = 0; ok(T.getOut() === false && !!T.drive(), 'you cannot get out in the middle of the forecourt');
  { const L = T.liftWorld(0), D = T.drive(); D.v.x = L.x + 0.3; D.v.z = L.z + 0.3; D.v.yaw = Math.PI + 0.1; D.v.speed = 0; T.GAME.playerOverride(1 / 60);
    ok(T.getOut() && !T.drive() && T.job(0).lift === 0 && Math.abs(T.car(0).x - L.x) < 0.01 && Math.abs(T.car(0).z - L.z) < 0.01, 'parked on the lines and got out: the car is on the lift'); }
  T.rackUse(); ok(/Raise the car on the lift/.test(T.liftPrompt(0)), 'the jack step is a lift step now: ' + T.liftPrompt(0));
  T.liftUse(0); T.player.keys.KeyE = true; T.run(0.8); ok(T.car(0).g.position.y > 0.3 && T.car(0).g.position.y < 1.4, 'the car rises with the step: ' + T.car(0).g.position.y.toFixed(2)); T.run(1); T.player.keys.KeyE = false; T.run(0.05);
  ok(T.job(0).step === 2 && Math.abs(T.car(0).g.position.y - 1.5) < 0.01 && !T.car(0).jackMesh.visible, 'up at working height: ' + T.car(0).g.position.y);
  T.GAME.present(0.016); ok(Math.abs(T.G.liftArms[0].position.y - 1.5) < 0.01, 'the arms are up with it');
  ok(/lower it/.test(T.canDrive(0)), 'no driving off a raised lift');
  T.devCommand('fix'); T.run(16); T.takePayment(0); T.run(20); ok(T.job(0) && T.job(0).state === 'leaving', 'paid: the customer drives it off the lift');
  T.run(40); ok(!T.job(0) && T.car(0) === null, 'it reversed out and drove away');
  ok(/hold/i.test(T.GAME.guideHtml()) && /PC/.test(T.GAME.guideHtml()) && /garage/i.test(T.GAME.menuLine()), 'the guide and the pause line are the garage ones');
`;
