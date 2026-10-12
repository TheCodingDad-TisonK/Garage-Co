// The systems around the work: parts short and ordered on the PC, the express van and the delivery, a car kept overnight, the
// tyre corner and a puncture, the shop's upgrades, the upsell, an apprentice who works a job alone, wages, rep and a comeback;
// and at level 5 the night the garage grows (the next scenario loads the grown garage). No backslash-quote in the body.
'use strict';
module.exports = `
  const V3 = (x, y, z) => new window.THREE.Vector3(x, y, z);
  const wp = (b, at) => { const p = T.PLACES[at].p; return T.car(b).g.localToWorld(V3(p[0], p[1], p[2])); };
  const look = (b, at) => { const w = wp(b, at); return T.lookAt(w.x, w.y, w.z); };
  const hold = async (sec) => { T.player.keys.KeyE = true; T.run(sec); T.player.keys.KeyE = false; T.run(0.05); };
  const atCar = (b) => { T.player.x = T.BAYS[b].x + 2.4; T.player.z = T.BAYS[b].z; };
  const atDesk = (b) => { T.player.x = T.deskStand(b).x; T.player.z = T.deskStand(b).z + 1.6; };
  const park = (fault) => { T.devCommand('car', fault); T.devCommand('park'); T.run(4); T.run(16); };
  T.enter(); await wait(300);
  ok(S.day === 1 && S.jobs.length === 0 && S.bank === 400, 'a fresh garage for the systems');
  // no bulbs on the shelf: the job waits on the part
  S.stock.bulb = 0; T.G.noReload = true; park('bulb'); T.takeJob(0); const J = T.job(0);
  ok(J.state === 'taken' && T.missingParts(J).join() === 'bulb' && /not on the shelf: headlight bulb/.test(T.rackPrompt()), 'no bulb on the shelf: the rack says so: ' + T.rackPrompt());
  T.rackUse(); ok(J.step === 0 && J.hold === 'parts', 'E at the rack finds no bulb: the job waits on parts');
  // the PC: order on the van, and an express
  T.pcGo('parts'); T.PC.basket = { bulb: 2 }; const b0 = S.bank; ok(T.pcTap('Order: 8:30 van') && S.orders.length === 1 && S.orders[0].due.day === 2 && S.bank === b0 - 4, 'the PC orders two bulbs on tomorrow morning van: ' + JSON.stringify(S.orders[0]));
  ok(T.onOrder('bulb') === 2 && T.pcRows('parts').some((r) => /coming 2/.test(r.sub || '')), 'the Parts app shows the bulbs coming');
  T.PC.basket = { pads: 1 }; const b1 = S.bank; ok(T.pcTap('Express') && S.orders.length === 2 && S.bank === b1 - 22 - 15, 'an express order: the pads and the fee');
  T.pcGo('stock'); ok(T.pcRows('stock')[0].text.indexOf('coming') > 0, 'the Stock app counts what is coming');
  // the rows scroll: the Parts list is longer than the screen
  T.pcGo('parts'); T.drawScreens(0); const rows = T.PC.rows; ok(rows > 6 && T.pcTap('▼') && T.PC.scroll === 3, 'the parts list scrolls with the arrow: ' + rows + ' rows, scrolled to ' + T.PC.scroll);
  ok(T.GAME.wheel(-1) === false, 'the wheel only scrolls a PC you are looking at');
  // the express van comes within the hour
  T.setTime(S.time + 1.02); T.run(0.2); ok(!!T.van() && T.van().load.length === 1, 'the parts van is on its way with the express');
  T.run(22); ok(!T.van() || T.van().leaving, 'the van dropped the delivery and is leaving'); ok(S.delivery && S.delivery.parts.pads === 1 && !!T.G.pile, 'a pallet with the pads waits by the roll door');
  T.putAway('player'); ok(!S.delivery && S.stock.pads === 2, 'E on the pallet puts the pads on the shelves');
  T.run(16); ok(!T.van(), 'the van has gone');
  // closing time with the bulb job waiting on parts that are coming: the car stays the night
  const rep0 = S.rep; T.setTime(17.999); T.run(0.5);
  ok(S.day === 2 && T.job(0) && T.job(0).overnight && !T.customer(0) && S.rep === rep0 - 1, 'the car stayed the night (rep ' + S.rep + '), the customer went home');
  T.setTime(8.55); T.run(0.2); ok(!!T.van(), 'the morning van comes at half past eight'); T.run(22); T.putAway('player'); ok(S.stock.bulb === 2 && T.job(0).hold === null, 'the bulbs are on the shelf and the job is free: ' + JSON.stringify({ st: S.stock, hold: T.job(0) && T.job(0).hold, del: S.delivery, ord: S.orders, t: S.time, van: !!T.van() }));
  T.rackUse(); atCar(0); look(0, 'bonnet'); T.useFocus(); look(0, 'lamp'); T.useFocus(); await hold(2.2); look(0, 'bonnet'); T.useFocus();
  ok(T.job(0).state === 'done' && !!T.customer(0) && T.customer(0).at === 'desk', 'the bulb is in, and the customer came back for the car');
  const rep1 = S.rep; T.takePayment(0); ok(S.rep === rep1 - 1 && /late/.test(S.repLog[0].why), 'an overnight job pays late: rep ' + S.rep);
  T.run(40);
  // the shop: level 3, the tyre corner, the socket, the fast jack
  T.devCommand('cash', 6000); T.devCommand('level'); T.devCommand('level');
  ok(S.level === 3, 'level 3');
  ok(T.buyUpgrade('tyremachine') === 'level 5', 'the tyre machine waits for level 5');
  ok(T.buyUpgrade('tyre') === '' && !!T.roomInst('gcTyre') && S.custom.some((c) => c.type === 'gcTyre'), 'the tyre corner stands on the forecourt as your own prop');
  ok(T.buyUpgrade('socket') === '' && S.tools.socket && T.G.toolHooks.socket.hook.visible, 'the spark plug socket hangs on the tool wall');
  ok(T.buyUpgrade('shed') === '' && T.stockCap() === 64 && !!T.roomInst('gcShed'), 'the stores shed: room for 64 parts');
  ok(T.buyUpgrade('fastjack') === '' && T.owns('fastjack'), 'the fast jack');
  T.pcGo('garage'); ok(T.pcRows('garage').filter((r) => /✓/.test(r.text)).length === 4, 'the Garage app ticks what is bought');
  // a puncture: the wheel goes to the tyre corner and back
  S.stock.plugkit = 2; park('puncture'); T.takeJob(0); const P = T.job(0); T.rackUse();
  atCar(0); look(0, 'jack'); T.useFocus(); await hold(1.4); ok(P.step === 2, 'the fast jack is up in half the time');
  T.toolUse('brace'); look(0, 'wheel'); T.useFocus(); await hold(2.7); look(0, 'wheel'); T.useFocus(); T.run(1.2);
  ok(P.step === 4 && P.vis.wheelOff && S.hand && S.hand.kind === 'wheel' && !T.car(0).looseWheel.visible, 'the wheel is off and in your hands');
  { const ts = T.tyreSpot(); T.player.x = ts.x; T.player.z = ts.z; const ti = T.roomInst('gcTyre').g.position; const txt = T.lookAt(ti.x, 0.8, ti.z - 0.6); ok(/water tank/.test(txt), 'the tyre corner: ' + txt); }
  T.tyreUse(); await hold(3.2); T.tyreUse(); await hold(2.2); T.tyreUse(); await hold(2.2); ok(P.step === 7, 'found the hole, plugged it, pumped it up');
  atCar(0); look(0, 'hub'); T.useFocus(); ok(P.step === 8 && !P.vis.wheelOff && !S.hand, 'the wheel is back on');
  look(0, 'wheel'); T.useFocus(); await hold(2.2); look(0, 'jack'); T.useFocus(); await hold(1.2); ok(P.state === 'done', 'the puncture job is done');
  T.takePayment(0); T.run(40);
  // the upsell: a second fault spotted, offered, said yes or no
  park('oil'); T.takeJob(0); const U = T.job(0); U.car.extra = 'wipers'; S.rep = 100; atDesk(0);
  { const txt = T.customerPrompt(0); ok(/Offer .* new wiper blades/.test(txt), 'the customer can be offered the extra: ' + txt); }
  const p0 = U.price; T.offerExtra(0); ok(U.offered && U.faults.length === 2 && U.price > p0 && T.stepsOf(U).length === 12, 'at rep 100 the customer said yes: two faults, twelve steps, ' + U.price);
  T.devCommand('fix'); T.takePayment(0); T.run(40); S.rep = 20;
  // an apprentice: hired on the PC, works a job alone from the rack to the bonnet
  T.pcGo('staff'); const cands = T.candidates(); ok(cands.length === 3 && cands.every((c) => c.role === 'apprentice'), 'three apprentices are looking for work at level 3');
  const hid = cands[0].id, hname = cands[0].name; ok(T.hire(hid) === '' && T.staffList().length === 1 && !!T.G.staff[hid], 'hired ' + hname);
  ok(T.hire(T.candidates()[0].id) !== '' && T.staffList().length === 1, 'the lock-up has room for one');
  S.stock.battery = 2; park('battery'); T.takeJob(0); T.nameFault(0, 'battery'); const W = T.job(0); W.sloppy = true;
  for (let i = 0; i < 40 && W.state === 'taken'; i++) T.run(3);
  ok(W.state === 'done' && T.staffList()[0].jobs === 1, 'the apprentice did the battery job alone: ' + W.state + ' at step ' + W.step);
  ok(S.comebacks.length === 1, 'a job the apprentice rushed is coming back');
  T.takePayment(0); T.run(40);
  const bank3 = S.bank, wage = T.staffList()[0].wage; T.setTime(17.999); T.run(0.5); ok(S.bank <= bank3 - wage && T.staffList()[0].unpaid === 0, 'wages at closing: ' + wage);
  // the comeback is due the next day or the one after: it comes in free
  T.setTime(17.999); T.run(0.5); T.setTime(8.3); T.G.nextCarAt = 0; T.run(1); const CB = T.job(0); ok(CB && CB.comeback && CB.price === 0, 'the rushed job came back, for nothing: ' + JSON.stringify({ cb: S.comebacks, day: S.day, t: S.time, j: S.jobs.map((x) => x && [x.state, x.comeback, x.price]) }));
  T.devCommand('leave');
  // the books: rep and where it came from
  T.pcGo('books'); ok(T.pcRows('books').some((r) => /What the town says/.test(r.text)) && S.repLog.length >= 4, 'the Books app shows the rep log: ' + S.repLog.length + ' entries');
  // level 5: the builders come at closing time
  T.devCommand('level'); T.devCommand('level'); ok(S.level === 5 && S.stage === 1, 'level 5: still the lock-up until tonight');
  T.setTime(17.999); T.run(0.5); ok(S.stage === 2 && T.G.grewAt > 0, 'at closing the garage grows: stage ' + S.stage);
  { const o = T.LO(), H = T.HALL2, inside = Object.keys(T.propInst).filter((id) => { if (id === 'officeDesk' || (S.layout[id] && S.layout[id].hidden)) return false; const P = T.propPlacement(id); return P.x > o.x + H.x0 && P.x < o.x + H.x1 && P.z > o.z + H.z0 && P.z < o.z + H.z1; });
    ok(inside.length === 0, 'nothing placed stands where the new hall goes: ' + (inside.join(', ') || 'clear') + ' (' + Object.keys(S.layout).filter((k) => S.layout[k].hidden).length + ' put away)'); }
  S.hdoors = S.hdoors || {}; S.hdoors.side = { open: true, locked: false };   // saved with the side door open: the next scenario checks the lock-up keeps its key
  T.saveNow();
`;
