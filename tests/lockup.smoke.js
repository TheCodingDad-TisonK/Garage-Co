// The lock-up's loop, end to end: a car comes in, the customer walks to the desk, the job is taken, fixed and paid, the car leaves.
// Run by tests/smoke.js through the engine's smoke runner. No backslash-quote in the body.
'use strict';
module.exports = `
  ok(T.CO.ready === true && typeof T.enter === 'function' && T.CO.save.key === 'garageco-slot1', 'CO.setup and CO.boot ran on slot 1');
  ok(/New garage/.test(document.getElementById('dc-start-stats').textContent) && /Slot 1/.test(document.getElementById('dc-start-note').textContent), 'the start screen says it is a new garage');
  T.enter(); ok(T.ui.started === true && document.getElementById('dc-start').hidden && !document.getElementById('dc-hud').hidden, 'enter opens the garage');
  await wait(400);
  ok(T.counts().draws > 0 && T.counts().baked >= 2, 'frames draw with the bake in: ' + JSON.stringify(T.counts()));
  ok(S.bank === 400 && S.day === 1 && S.stats.jobs === 0 && S.job === null, 'a fresh save: ' + S.bank + ' in the bank, no car in');
  // the building
  ok(T.solids.length >= 8 && T.lampMeshes.length >= 5 && T.hdoors.length === 1, 'walls, lamps and the side door stand: ' + T.solids.length + ' solids, ' + T.lampMeshes.length + ' lenses');
  ok(['toolWall', 'bench', 'desk', 'jack', 'stands', 'drum', 'rack', 'noticeBoard'].every((id) => !!T.propInst[id]) && T.PROPS.xCompressor.extra, 'the fittings are built and the compressor is in the catalogue');
  ok(!!T.G.rollPanel && S.doorOpen === false && T.GAME.collides(0, T.LOCKUP.z) === true && T.GAME.collides(0, 0) === false, 'the roll door is down and blocks the doorway');
  S.doorOpen = true; ok(T.GAME.collides(0, T.LOCKUP.z) === false, 'an open roll door lets you through'); T.tickRoll(2); ok(T.G.rollPanel.scale.y < 0.5, 'the panel rolled up: scale ' + T.G.rollPanel.scale.y.toFixed(2)); S.doorOpen = false;
  ok(T.navFreeAt(0, 0) && T.navFreeAt(0, T.LOCKUP.z) && T.navFreeAt(T.BAY.x + 2, T.BAY.z) && !T.navFreeAt(-T.LOCKUP.x, 0) && !T.navFreeAt(0, 40), 'the route finder walks the lock-up, the doorway and the forecourt, not the walls or the far road');
  ok(T.traffic.cars.length === 2, 'two cars on the road');
  // a car comes in
  const car = T.spawnCar(); ok(!!car && S.job && S.job.state === 'coming' && !!T.car() && T.car().x < -60, 'a car is on the way: ' + car.name + ' in a ' + car.make + ' with ' + car.fault);
  T.run(18); ok(S.job.state === 'waiting' && Math.abs(T.car().x - T.BAY.x) < 0.01 && Math.abs(T.car().z - T.BAY.z) < 0.01, 'the car parked in the bay: ' + T.car().x.toFixed(1) + ',' + T.car().z.toFixed(1));
  ok(!!T.customer() && T.customer().walking && T.customer().goal === 'desk', 'the customer got out and is walking to the desk');
  T.run(16); ok(!!T.customer() && !T.customer().walking && T.customer().at === 'desk' && Math.abs(T.customer().rec.x - T.DESK_STAND.x) < 0.6 && Math.abs(T.customer().rec.z - T.DESK_STAND.z) < 0.6, 'the customer stands at the desk: ' + T.customer().rec.x.toFixed(1) + ',' + T.customer().rec.z.toFixed(1));
  // take the job at the desk
  T.player.x = T.DESK_STAND.x; T.player.z = T.DESK_STAND.z + 1.6; T.player.y = 0;
  { const txt = T.lookAt(T.customer().rec.x, 1.3, T.customer().rec.z); ok(/Take the job/.test(txt), 'looking at the customer offers the job: ' + txt); }
  T.useFocus(); ok(S.job.state === 'taken', 'E takes the job: ' + S.job.state);
  T.openPanel('jobs'); ok(/job card open/.test(T.panelHtml()) && /The clipboard/.test(document.getElementById('dc-panel-title').textContent), 'the clipboard shows the open job'); T.closePanel();
  // the work, at the car only
  T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z;
  { const txt = T.lookAt(T.car().x, 0.8, T.car().z); ok(/Start the job/.test(txt), 'looking at the car offers the work: ' + txt); }
  T.useFocus(); ok(S.job.state === 'fixing' && S.job.progress === 0, 'E at the car starts the work');
  T.run(1); const p1 = S.job.progress; ok(p1 > 0.05 && p1 < 0.6, 'the work counts up while you stand there: ' + p1.toFixed(2));
  T.player.x = -3; T.player.z = 0; T.run(2); ok(Math.abs(S.job.progress - p1) < 1e-9, 'it stops when you walk away');
  T.player.x = T.BAY.x + 2.4; T.player.z = T.BAY.z; T.run(T.faultOf(car).secs + 1); ok(S.job.state === 'done' && S.stats.fixed === 1, 'the job is done: ' + S.job.state);
  // the payment at the desk
  T.player.x = T.DESK_STAND.x; T.player.z = T.DESK_STAND.z + 1.6;
  { const txt = T.lookAt(T.customer().rec.x, 1.3, T.customer().rec.z); ok(/Take the payment/.test(txt), 'the customer pays: ' + txt); }
  const price = S.job.price, bank0 = S.bank; T.useFocus();
  ok(S.bank === bank0 + price && S.stats.jobs === 1 && S.done.length === 1 && S.done[0].price === price && S.ledger[0].n === price, 'paid ' + price + ': bank ' + S.bank + ', one job in the book');
  ok(S.job.state === 'paid' && T.customer().walking && T.customer().goal === 'car', 'the customer walks back to the car');
  T.run(18); ok(T.customer() === null && S.job && S.job.state === 'leaving', 'the customer is in the car and it is leaving: ' + (S.job && S.job.state));
  T.run(30); ok(T.car() === null && S.job === null, 'the car has gone and the bay is free');
  T.updateHud(1); ok(/1 job$/.test(document.getElementById('h-jobs').textContent) && /rep 11/.test(document.getElementById('h-rep').textContent), 'the HUD counts the job and the rep: ' + document.getElementById('h-jobs').textContent);
  ok(S.xp === 25 && S.level === 1, 'the job earned 25 xp towards level 2 at ' + T.xpFor(1));
  // the day rolls at six
  T.setTime(17.995); T.run(1); ok(S.day === 2 && S.time >= 8 && S.time < 8.1 && S.stats.days === 1, 'six o clock rolls the day: day ' + S.day + ' at ' + T.fmtTime(S.time));
  // the save keeps the books
  T.save(); S.stats.jobs = 99; T.loadSave(T.GAME.freshState, T.GAME.migrate); ok(S.stats.jobs === 1 && S.done.length === 1 && S.day === 2, 'the save round-trips the books');
  // a job survives a reload: the car is back in the bay and the customer at the desk
  T.devCommand('car'); T.devCommand('park'); T.run(6); ok(S.job && S.job.state === 'waiting', 'dev: a car parked at once: ' + (S.job && S.job.state));
  T.run(16); T.takeJob(); T.save(); T.removeCustomer(); T.removeCar(); T.loadSave(T.GAME.freshState, T.GAME.migrate); T.restoreJob();
  ok(S.job && S.job.state === 'taken' && !!T.car() && Math.abs(T.car().x - T.BAY.x) < 0.01 && !!T.customer() && T.customer().at === 'desk', 'a reload puts the car back in the bay and the customer at the desk');
  ok(/job taken|job done/.test(T.devCommand('fix')) && S.job.state === 'done', 'dev: fix finishes the job'); ok(T.devCommand('leave') === 'gone' && S.job === null && T.car() === null, 'dev: leave clears the bay');
  ok(/roll door/i.test(T.GAME.guideHtml()) && /garage/i.test(T.GAME.menuLine()), 'the guide and the pause line are the garage’s');
`;
