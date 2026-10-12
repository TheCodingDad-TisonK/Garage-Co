// The car and the work you can see, from a fresh save: the car's parts, the parts that move while a step fills (the jack, the wheel
// nuts, the wheel laid on the floor, the caliper, the sump plug and the oil, the battery), the faults you can see, the driver's seat,
// the tool in your hand and the parts on the shelves. No backslash-quote in the body.
'use strict';
module.exports = `
  const park = (fault) => { T.devCommand('leave'); T.devCommand('car', fault); T.devCommand('park'); T.run(4); T.run(16); T.takeJob(0); if (T.diagnosing(T.job(0))) T.nameFault(0, fault); T.run(0.2); };
  const at = (step, vis, p) => { const J = T.job(0); J.step = step; J.vis = vis; J.stepP = p; T.carVis(0); T.run(1.5); J.stepP = p; T.run(0.05); };
  T.enter(); await wait(300); T.G.noReload = true; T.G.nextCarAt = Infinity;
  park('brakes'); const C = T.car(0), P = C.parts;
  ok(C.g.userData.wheels.length === 4 && P.lid && P.stay && P.jack && P.steer && P.pan && P.disc && P.caliper && P.battery && P.coils.length === 4 && P.wipers.length === 2, 'the car carries its own parts: wheels, bonnet, jack, steering wheel, brakes, battery, coils, wipers');
  ok(C.looseWheel.userData.nuts.length === 5 && T.stepsOf(T.job(0)).some((s) => s.anim === 'nutsoff'), 'the near front wheel has its five nuts, and the steps name what they move');
  // the jack lifts the car as its step fills, and only then stands under it
  at(1, {}, 0.5); ok(Math.abs(C.g.position.y - 0.07) < 0.01 && P.jack.visible, 'half way through jacking it up: ' + C.g.position.y.toFixed(3) + ' m, the jack under the sill');
  // the nuts back out while the brace turns
  const n0 = C.looseWheel.userData.nuts[0], z0 = n0.userData.base[2];
  at(2, { up: true }, 0.5); ok(n0.position.z > z0 + 0.05 && n0.visible, 'the nuts back out as the step fills: ' + (n0.position.z - z0).toFixed(3));
  at(3, { up: true }, 0); ok(!n0.visible && P.nutPile.visible, 'undone, the nuts lie in a pile by the wheel');
  // the wheel comes off and is laid on the floor beside the car (a brake job keeps it there)
  at(4, { up: true, wheelOff: true }, 0); ok(C.looseWheel.visible && C.looseWheel.rotation.x < -1.4 && C.looseWheel.position.y < 0, 'the wheel lies flat on the floor: y ' + C.looseWheel.position.y.toFixed(2));
  const cy = P.caliper.position.y; at(4, { up: true, wheelOff: true }, 0.5); ok(P.caliper.position.y > cy + 0.1, 'the caliper swings up off the disc while the pads are changed');
  at(4, { up: true, wheelOff: true }, 0.3); const worn = P.pads.children[0].material; at(4, { up: true, wheelOff: true }, 0.7); ok(P.pads.children[0].material !== worn, 'past half way the worn pads are swapped for new ones');
  at(T.stepsOf(T.job(0)).length, {}, 0); ok(Math.abs(C.looseWheel.position.z - 0.95) < 0.02 && C.looseWheel.rotation.x === 0 && !P.nutPile.visible, 'put back together, the wheel is on its studs');
  // the oil: the sump plug drops, the old oil runs into the pan, the pan fills
  park('oil'); const O = T.car(0).parts;
  at(2, { up: true }, 0.5); ok(O.sumpPlug.position.y < O.sumpPlugBase - 0.02, 'the sump plug spins out as the spanner turns');
  at(3, { up: true, pan: true }, 0.5); ok(O.pan.visible && O.stream.visible && O.panOil.visible, 'the old oil runs into the pan');
  at(8, { open: true }, 0.4); ok(O.can.visible && O.cap.position.z > O.capBase[2] + 0.05, 'filling: the cap is off and the jug pours');
  // the battery: the clamp comes off, the old battery lifts out
  park('battery'); const Bt = T.car(0).parts;
  at(2, { open: true }, 0.9); ok(Bt.clamp.position.y > Bt.clampBase + 0.08, 'the clamp is coming off');
  at(3, { open: true }, 0.5); ok(Bt.battery.position.y > Bt.batteryBase + 0.25, 'the old battery is lifted out');
  // faults you can see: a dead headlight stays dark until the bulb is in, a loose terminal is furred white
  park('bulb'); const Bu = T.car(0); ok(Bu.parts.lensNear.every((m) => m.material !== Bu.g.userData.lamps[1].material), 'the left headlight is out: its lamps are dark');
  at(T.stepsOf(T.job(0)).length, {}, 0); ok(Bu.parts.lensNear.every((m) => m.material === Bu.g.userData.lamps[1].material), 'with the new bulb in, it lights again');
  park('terminal'); ok(T.car(0).parts.fuzz.visible, 'a loose terminal shows its white fur with the bonnet up');
  // the driver sits on the left (left-hand drive) and the wheel turns right for D
  T.devCommand('leave'); park('brakes'); T.job(0).vis = {}; T.carVis(0); ok(T.getIn(0), 'in the driving seat');
  T.player.keys.KeyD = true; for (let i = 0; i < 30; i++) T.GAME.playerOverride(1 / 60); T.player.keys.KeyD = false;
  { const lp = T.car(0).g.worldToLocal(T.camera.position.clone()); ok(lp.z < -0.3 && lp.y > 1.1, 'the eye is in the left seat: ' + lp.x.toFixed(2) + ', ' + lp.y.toFixed(2) + ', ' + lp.z.toFixed(2)); }
  ok(T.car(0).parts.steer.rotation.x > 0.5, 'D turns the steering wheel clockwise: ' + T.car(0).parts.steer.rotation.x.toFixed(2));
  T.G.drive = null;
  // the tool in your hand, and the parts on the shelves in their own looks
  S.tool = 'spanner'; T.GAME.present(0.016); ok(T.G.held && T.G.held.g && T.G.held.g.visible !== false && T.G.held.tool, 'the spanner shows in your hand');
  S.tool = null; T.GAME.present(0.016); ok(!T.G.held.g, 'hung back, the hand is empty');
  ok(T.G.rackBoxes.children.length > 0 && T.G.rackBoxes.children.every((m) => m.isGroup && m.children.length > 0), 'the parts on the rack are models, not plain boxes: ' + T.G.rackBoxes.children.length);
`;
