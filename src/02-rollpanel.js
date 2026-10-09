//@ the roll door panel: a screen on the wall beside the roll door, inside the lock-up. Open and close the door from it instead of the chain, see whether a car is on its way, and how the job stands.
  // the same switch the chain throws (01-garage.js): the door rides up while S.doorOpen is set, or while a customer walks through
  function rollDoorToggle() { S.doorOpen = !S.doorOpen; sfx(S.doorOpen ? 'unlock' : 'lock'); hudDirty = true; screenDirtyAll(); }
  function jobLine() {
    var j = S.job; if (!j) return 'No job. The next car comes when it comes.';
    var who = j.car && j.car.model ? j.car.model : 'A car';
    return { coming: who + ' is on its way in.', waiting: who + ' waits at the desk: take the job.', taken: who + ' is in the bay: find the fault.', fixing: who + ': fixing it.', done: who + ' is fixed: the customer pays at the till.', paid: who + ' is paid up; it can leave.', leaving: who + ' is leaving.' }[j.state] || (who + ': ' + j.state);
  }
  defProp('rollPanel', { label: 'roll door panel', cat: 'lockup', wall: true, x: LOCKUP.doorW / 2 + 1.1, z: LOCKUP.z - 0.14, rot: 2, desc: 'The screen beside the roll door: open and close it, see the job.', build: function (c) {
    c.box(0.08, 0.08, 0.1, MAT.steelDark, 0, 1.55, 0.05); c.box(0.78, 0.5, 0.04, MAT.black, 0, 1.55, 0.12);   /* the bracket and the housing */
    touchScreen({ w: 400, h: 250, pw: 0.72, ph: 0.45, x: 0, y: 1.55, z: 0.145, parent: c.group, title: 'Roll door', draw: function (ctx, sc) {
      scBg(ctx, sc.w, sc.h, S.doorOpen ? '#2a7a4a' : undefined); scHead(ctx, sc.w, 'ROLL DOOR', S.doorOpen ? 'OPEN' : 'CLOSED');
      scButton(sc, 16, 62, 170, 46, S.doorOpen ? 'Close the door' : 'Open the door', true, rollDoorToggle);
      scText(ctx, 200, 92, G.customerNearDoor ? 'someone is at the door' : (S.doorOpen ? 'the way is clear' : 'the way is shut'), null, 13);
      scText(ctx, 16, 150, jobLine(), null, 14); scText(ctx, 16, 178, 'Day ' + S.day + ' · ' + (S.stats ? S.stats.jobs : 0) + ' jobs done · rep ' + S.rep, null, 13);
      if (S.job && S.job.price) scText(ctx, 16, 206, 'This job pays ' + money(S.job.price), '#f5b53d', 14);
    } });
  } });
