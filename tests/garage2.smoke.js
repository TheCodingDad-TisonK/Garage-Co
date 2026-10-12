// The two-bay garage: the save from the systems scenario loads the grown world. The second hall, its roll door, the office PC, the
// parts store, two cars at once, and a mechanic in bay 2. No backslash-quote in the body.
'use strict';
module.exports = `
  T.enter(); await wait(300);
  ok(S.stage === 2 && T.grown() && T.bayCount() === 2, 'the grown garage loads: two bays');
  const LO = T.LO(), H = T.HALL2;
  ok(!!T.G.roll2Panel && T.GAME.collides(LO.x + H.doorX, LO.z + T.LOCKUP.z) === true && T.inLockup(LO.x + 10, LO.z) && T.GAME.indoors(LO.x + 12, LO.z + 2), 'the second hall: its roll door is down, it is indoors');
  ok(!!T.propInst.officeDesk && T.G.pcs.length === 2 && !!T.G.store2Boxes, 'the office desk with the second PC, and the parts store');
  ok(T.stockCap() === 124 && T.G.store2Boxes.children.length >= 0, 'the parts store adds 60: ' + T.stockCap());
  ok(T.navFreeAt(LO.x + 10, LO.z) && T.navFreeAt(LO.x + 5, LO.z + 2.1) && T.navFreeAt(LO.x + H.doorX, LO.z + T.LOCKUP.z), 'the route finder walks the new hall, the side door and the second doorway');
  ok(T.G.lockup.userData.worldKey === 'lock-up@0,0' && S.hdoors.side && S.hdoors.side.open, 'with the side door saved open the lock-up keeps its key (' + T.G.lockup.userData.worldKey + '), so the editor move applies: ' + JSON.stringify(LO));
  ok(T.hall2Clash().length === 0, 'nothing placed in the editor stands inside the new hall (' + (T.G.hall2Cleared || 0) + ' put away)');
  ok(T.G.store2.children.length > 10 && !!T.propInst.officeDesk && T.inLockup(LO.x + 13, LO.z - 3), 'the parts store is dressed, the office has its desk');
  const lockupItem = T.G.lockup; ok(lockupItem && lockupItem.userData.worldKey && /^lock-up@/.test(lockupItem.userData.worldKey) && lockupItem.userData.solids.length > 12, 'the new hall is part of the lock-up world item: ' + lockupItem.userData.worldKey);
  // two cars, one in each bay
  T.devCommand('car', 'oil'); T.devCommand('car', 'brakes'); ok(!!T.job(0) && !!T.job(1), 'two cars on the way');
  T.devCommand('park'); T.run(4); T.run(20); ok(T.job(0).state === 'waiting' && T.job(1).state === 'waiting' && Math.abs(T.car(1).x - T.BAYS[1].x) < 0.01, 'both parked, the second in bay 2');
  ok(!!T.customer(1) && !T.customer(1).walking && Math.abs(T.customer(1).rec.x - T.deskStand(1).x) < 0.7, 'the second customer waits a step along at the desk');
  // a mechanic for bay 2
  S.cands = { day: S.day, list: [{ id: 'st-mech', name: 'Marta', role: 'mechanic', skill: 3, wage: 110 }] }; ok(T.hire('st-mech') === '', 'hired a mechanic');
  S.stock.pads = 3; T.takeJob(1); T.assignNext(1); ok(T.job(1).assign === 'st-mech' || T.job(1).assign, 'bay 2 is given to Marta');
  for (let i = 0; i < 40 && T.job(1).state === 'taken'; i++) T.run(3);
  ok(T.job(1).state === 'done', 'Marta did the brakes in bay 2: ' + T.job(1).state + ' at step ' + T.job(1).step);
  T.pcGo('jobs'); ok(T.pcRows('jobs').filter((r) => /^Bay/.test(r.text)).length === 2, 'the Jobs app lists both bays');
  // the mechanic finds a fault: a sluggish car could be the air filter or the plugs; Marta checks, names it and fits it
  T.G.nextCarAt = Infinity; T.takePayment(1); T.run(40); ok(!T.job(1), 'bay 2 is free again');
  S.stock.airfilter = 3; T.devCommand('car', 'airfilter'); T.devCommand('park'); T.run(4); T.run(16);
  const M = T.job(1); ok(M && M.car.fault === 'airfilter', 'an air filter car in bay 2'); T.takeJob(1);
  ok(T.diagnosing(M) && M.diag.cands.slice().sort().join() === 'airfilter,plugs', 'it could be the air filter or the plugs: ' + M.diag.cands.join());
  M.diag.rush = false;
  for (let i = 0; i < 60 && M.state === 'taken'; i++) T.run(2);
  ok(M.state === 'done' && M.diag.named === 'airfilter' && M.diag.checks >= 1 && !M.diag.wrong.length, 'Marta checked (' + Object.keys(M.diag.done).join() + '), named the air filter and fitted it: ' + M.state);
`;
