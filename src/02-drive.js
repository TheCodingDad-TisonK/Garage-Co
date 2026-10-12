//@ Garage Co., part 02: the lifts and driving. You take the job, get in the car in its bay, drive it through the roll door onto the lift and get out; the lift's control box raises it. The customer drives it off the lift when they have paid.
  // ── The lifts ─────────────────────────────────────────────────────
  // a two-post lift a hall, in the hall's own frame, just inside its roll door; the car stands on it nose to the back wall. Lift 0 is
  // the lock-up's; lift 1 comes with the two-bay garage. A car on a lift does its jack steps on the lift instead (J.lift)
  var LIFTS = [{ x: 0, z: -0.1 }, { x: HALL2.doorX, z: -0.1, grown: true }];
  var LIFT_H = 1.5;
  function liftBuilt(i) { return !LIFTS[i].grown || grown(); }
  function liftWorld(i) { var o = LO(); return { x: LIFTS[i].x + o.x, z: LIFTS[i].z + o.z }; }
  function liftCar(i) { for (var b = 0; b < S.jobs.length; b++) { var J = S.jobs[b]; if (J && J.lift === i && carIn(b)) return b; } return -1; }
  // the posts, the floor lines, the arms (they ride up with the car) and the control box, built into the hall's world item
  function buildLift(i, ox, oz) {
    var L = LIFTS[i], sx = L.x - (ox || 0), sz = L.z - (oz || 0), yel = std({ color: 0xe0a02a, roughness: 0.5, metalness: 0.3 });
    [-1.5, 1.5].forEach(function (dx) { box(0.24, 2.9, 0.3, yel, sx + dx, 1.45, sz); box(0.5, 0.04, 0.6, MAT.steelDark, sx + dx, 0.02, sz); });
    [-1.0, 1.0].forEach(function (dx) { box(0.08, 0.012, 4.4, std({ color: 0xf5d24a, roughness: 0.8 }), sx + dx, 0.012, sz); });
    var arms = new THREE.Group(); arms.userData.dynamic = true; arms.position.set(sx, 0, sz); parentOf(null).add(arms);
    [-1, 1].forEach(function (s) { box(0.3, 0.3, 0.36, yel, s * 1.32, 0.2, 0, arms); [-0.9, 0.9].forEach(function (dz) { var a = box(1.0, 0.06, 0.1, MAT.steelDark, s * 0.85, 0.08, dz * 0.6, arms); a.rotation.y = s * dz * 0.5; box(0.16, 0.05, 0.16, MAT.rubber, s * 0.55, 0.12, dz * 1.0, arms); }); });
    (G.liftArms = G.liftArms || [])[i] = arms;
    box(0.22, 0.34, 0.14, MAT.black, sx - 1.5, 1.25, sz + 0.25); box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 0.6), sx - 1.5, 1.33, sz + 0.33); box(0.06, 0.06, 0.02, glowMat(0xff6b5e, 0.6), sx - 1.5, 1.2, sz + 0.33);
    hitBox(0.4, 0.5, 0.4, sx - 1.5, 1.25, sz + 0.3, { prompt: function () { return liftPrompt(i); }, use: function () { liftUse(i); } });
  }
  function liftPrompt(i) {
    var b = liftCar(i); if (b < 0) return 'The lift' + (LIFTS[i].grown ? ' in bay 2' : '') + ': drive a car onto the yellow lines';
    var J = jobAt(b), s = curStep(J);
    if (s && s.at === 'lift') { var why = stepBlock(b, s); return why ? s.label + ': ' + why : verb(s) + s.label + (J.stepP > 0 ? ' · ' + Math.round(J.stepP * 100) + '%' : ''); }
    return 'The lift: ' + J.car.make + (J.vis && J.vis.up ? ', up' : ', down') + (s ? ' · next: ' + s.label : '');
  }
  function liftUse(i) { var b = liftCar(i); if (b < 0) return; var J = jobAt(b), s = curStep(J); if (!s || s.at !== 'lift') { toast(s ? 'Next: ' + s.label + ' (' + placeName(s.at) + ').' : 'Nothing to do on the lift.', ''); return; } var why = stepBlock(b, s); if (why) { toast(s.label + ': ' + why + '.', 'bad'); return; } J.by = 'player'; G.hold = { bay: b, step: J.step, at: 'lift', fill: false }; }
  // a jack step becomes a lift step while the car is on a lift: quicker, and the car goes up to working height
  function liftStep(J, s) { if (J.lift === null || J.lift === undefined || s.at !== 'jack') return s; return { at: 'lift', act: 'hold', secs: s.secs * 0.6, tool: null, label: s.fx === 'up' ? 'Raise the car on the lift' : 'Lower the lift', fx: s.fx, fault: s.fault }; }
  // the height the car stands at now: on a lift it rises as the step fills
  function carHeight(b) {
    var J = jobAt(b), v = (J && J.vis) || {}; if (!J) return 0;
    if (J.lift === null || J.lift === undefined) { var sj = curStep(J), fj = v.up ? 1 : 0; if (sj && sj.at === 'jack' && J.stepP > 0) fj = sj.fx === 'up' ? Math.min(1, J.stepP) : 1 - Math.min(1, J.stepP); return fj * 0.14; }   // the jack lifts it as its step fills
    var s = curStep(J), f = v.up ? 1 : 0; if (s && s.at === 'lift' && J.stepP > 0) f = s.fx === 'up' ? Math.min(1, J.stepP) : 1 - Math.min(1, J.stepP);
    return f * LIFT_H;
  }
  function liftSync() { (G.liftArms || []).forEach(function (arms, i) { if (!arms) return; var b = liftCar(i), C = b >= 0 ? carIn(b) : null; arms.position.y = C ? C.g.position.y : 0; }); }

  // ── Driving ───────────────────────────────────────────────────────
  // G.drive is the car you sit in: E on the car of a job you have taken; W and S drive, A and D steer, E gets you out. Out only on
  // a lift (the yellow lines) or back in the car's own bay, so a car is never left standing in the way
  var CAR_DRIVE = { accel: 3.0, top: 3.4, reverse: 2.2, drag: 3, steer: 1.4, gears: [1] };
  function canDrive(b) {
    var J = jobAt(b), C = carIn(b); if (!J || !C) return 'no car';
    if (J.state !== 'taken' && J.state !== 'done') return J.state === 'waiting' ? 'take the job at the desk first' : 'not now';
    if (J.assign && staffById(J.assign)) return staffById(J.assign).name + ' is working on it';
    var v = J.vis || {}; if (v.up || v.wheelOff || v.open || v.pan) return 'lower it and close it up first';
    return '';
  }
  function getIn(b) {
    var why = canDrive(b); if (why) { toast('Not now: ' + why + '.', 'bad'); return false; }
    var C = carIn(b); G.drive = { b: b, v: { x: C.x, z: C.z, yaw: C.yaw + Math.PI / 2, speed: 0, gear: 1 }, look: { yaw: 0, pitch: -0.12 } };
    G.hold = null; sfx('door'); toast('Driving: W and S, A and D to steer. Park on the yellow lines of a lift (or back in the bay) and press E to get out.', ''); hudDirty = true; return true;
  }
  function getOut() {
    var D = G.drive; if (!D) return false; var b = D.b, J = jobAt(b), C = carIn(b), v = D.v;
    if (Math.abs(v.speed) > 0.3) { toast('Stop the car first.', 'bad'); return false; }
    var along = function (y) { var a = ((y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.min(Math.abs(a - Math.PI), Math.abs(a), Math.abs(a - 2 * Math.PI)) < 0.35; };
    var spot = null;
    for (var i = 0; i < LIFTS.length; i++) { if (!liftBuilt(i)) continue; var L = liftWorld(i), other = liftCar(i); if (other >= 0 && other !== b) continue; if (dist2(v.x, v.z, L.x, L.z) < 0.9 * 0.9 && along(v.yaw)) { spot = { x: L.x, z: L.z, lift: i }; break; } }
    var B = BAYS[b]; if (!spot && dist2(v.x, v.z, B.x, B.z) < 1.6 * 1.6) spot = { x: B.x, z: B.z, lift: null };
    if (!spot) { toast('Park it on the yellow lines of a lift, or back in bay ' + (b + 1) + ', then get out.', 'bad'); return false; }
    C.x = spot.x; C.z = spot.z; var a = ((v.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); C.yaw = (Math.abs(a - Math.PI) < Math.PI / 2 ? Math.PI : 0) - Math.PI / 2; if (C.yaw < 0) C.yaw += 2 * Math.PI;
    J.lift = spot.lift; J.pos = { x: C.x, z: C.z, yaw: C.yaw };
    C.g.position.set(C.x, carHeight(b), C.z); C.g.rotation.y = C.yaw; C.g.updateMatrixWorld(true);
    var out = C.g.localToWorld(new THREE.Vector3(0.9, 0, -1.55)); player.x = out.x; player.z = out.z; player.y = floorY(out.x, out.z);
    G.drive = null; sfx('door'); toast(spot.lift !== null ? 'On the lift. Its control box is on the left post.' : 'Back in bay ' + (b + 1) + '.', 'good'); screenDirtyAll(); hudDirty = true; return true;
  }
  // the car's corners must stay clear: three points down its length, each a car's half width round
  function driveBlocked(nx, nz, v) {
    var fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), pts = [[0, 0], [1.55, 0], [-1.55, 0]];
    for (var i = 0; i < pts.length; i++) {
      var px = nx + fx * pts[i][0], pz = nz + fz * pts[i][0], cx = v.x + fx * pts[i][0], cz = v.z + fz * pts[i][0];
      if (vehicleBlocked({ x: cx, z: cz }, px, pz, 0.85)) return true;
      if ((!S.doorOpen && G.rollT < 0.7 && inDoorway(px, pz)) || (!S.door2Open && G.roll2T < 0.7 && inDoorway2(px, pz))) return true;
      if (Math.abs(px) > PLOT.x - 1 || pz < PLOT.z0 + 1 || pz > PLOT.z1 - 1) return true;
    }
    return false;
  }
  GAME.playerOverride = function (dt) {
    var D = G.drive; if (!D) return false; var C = carIn(D.b); if (!C) { G.drive = null; return false; }
    driveStep(D.v, player.keys, dt, { spec: CAR_DRIVE, blocked: driveBlocked });
    C.x = D.v.x; C.z = D.v.z; C.yaw = D.v.yaw - Math.PI / 2; C.g.position.set(C.x, 0, C.z); C.g.rotation.y = C.yaw;
    var ws = C.g.userData.wheels; if (ws && D.v.speed) ws.forEach(function (w) { w.rotation.z -= D.v.speed * dt / 0.33; });
    player.x = C.x; player.z = C.z; gcDriverCamera(C, D);
    return true;
  };
  GAME.useOverride = function () { if (G.drive) { getOut(); return true; } return false; };
  GAME.mouseLook = function (e, sx, iy) { var D = G.drive; if (!D) return false; D.look.yaw = clamp(D.look.yaw - e.movementX * sx, -1.8, 1.8); D.look.pitch = clamp(D.look.pitch - e.movementY * sx * iy, -0.8, 0.5); return true; };
  GAME.promptHidden = function () { return !!G.drive; };
  // where a car leaves from: off the lift it reverses out through its roll door to the apron, then the way it came
  function liftExit(b) { var J = jobAt(b); if (!J || J.lift === null || J.lift === undefined) return null; var L = liftWorld(J.lift), o = LO(); return [[L.x, o.z + LOCKUP.z + 3.0, 2.2, true], [L.x, APRON_Z, 3, true]]; }
