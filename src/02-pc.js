//@ Garage Co., part 02: the shop PC. A screen on the desk (and one in the office once the garage has grown), tapped with the crosshair: Parts, Stock, Jobs, Staff, Garage and Books. The lists scroll with the arrows on the screen or the mouse wheel.
  // ── The screen ────────────────────────────────────────────────────
  var PC_APPS = [['parts', 'Parts'], ['stock', 'Stock'], ['jobs', 'Jobs'], ['staff', 'Staff'], ['garage', 'Garage'], ['books', 'Books']];
  var PC = { app: 'parts', scroll: 0, basket: {}, msg: '', msgT: 0, rows: 0 };
  var PC_W = 640, PC_H = 400, PC_ROW = 46, PC_TOP = 52, PC_VIS = 6;
  function pcBuild(c, x, y, z, which) {
    c.box(0.08, 0.26, 0.08, MAT.steelDark, x, y + 0.13, z - 0.06); c.box(0.4, 0.02, 0.24, MAT.steelDark, x, y + 0.01, z - 0.06);
    c.box(1.2, 0.77, 0.04, MAT.black, x, y + 0.64, z - 0.04);
    var sc = touchScreen({ w: PC_W, h: PC_H, res: 2, pw: 1.15, ph: 0.72, x: x, y: y + 0.64, z: z - 0.015, parent: c.group, title: 'The PC', draw: drawPc });
    sc.pc = which; (G.pcs = G.pcs || []).push(sc);
  }
  function pcSay(t) { PC.msg = t; PC.msgT = worldTime; screenDirtyAll(); }
  function pcGo(app) { PC.app = app; PC.scroll = 0; screenDirtyAll(); }
  function pcScroll(d) { PC.scroll = clamp(PC.scroll + d, 0, Math.max(0, PC.rows - PC_VIS)); screenDirtyAll(); }
  // the wheel scrolls the PC you are looking at
  GAME.wheel = function (dir) { var sc = typeof screenUnderCrosshair === 'function' ? screenUnderCrosshair() : null; if (sc && sc.pc) { pcScroll(dir > 0 ? 1 : -1); return true; } return false; };
  function drawPc(c, sc) {
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'GARAGE CO. PC', 'Day ' + S.day + ' · ' + fmtTime(S.time) + ' · ' + money(S.bank));
    PC_APPS.forEach(function (a, i) { scButton(sc, 10, PC_TOP + i * 50, 104, 44, a[1], PC.app === a[0], function () { pcGo(a[0]); }); });
    var rows = pcRows(PC.app); PC.rows = rows.length; PC.scroll = clamp(PC.scroll, 0, Math.max(0, rows.length - PC_VIS));
    var x0 = 126, w = sc.w - x0 - 56;
    rows.slice(PC.scroll, PC.scroll + PC_VIS).forEach(function (r, i) {
      var y = PC_TOP + i * PC_ROW;
      if (r.head) { scText(c, x0, y + 28, r.text, '#f5b53d', 18); return; }
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'; c.fillRect(x0, y + 2, w, PC_ROW - 4);
      var bw = 0; (r.btns || []).forEach(function (B) { bw += (B.w || 64) + 6; });
      c.font = '17px ' + SCREEN_THEME.font; scText(c, x0 + 8, y + 20, scFit(c, r.text, w - bw - 16), r.col || '#eef1f5', 17);
      if (r.sub) { c.font = '13px ' + SCREEN_THEME.font; scText(c, x0 + 8, y + 38, scFit(c, r.sub, w - bw - 16), '#a0acb8', 13); }
      var bx = x0 + w - 4; (r.btns || []).slice().reverse().forEach(function (B) { var bwid = B.w || 64; bx -= bwid; scButton(sc, bx, y + 5, bwid, PC_ROW - 10, B.label, B.on !== false, B.act, B.col); bx -= 6; });
    });
    // the scroll arrows, and where you are in the list
    var sx = sc.w - 48;
    scButton(sc, sx, PC_TOP, 40, 40, '▲', PC.scroll > 0, function () { pcScroll(-3); }); scButton(sc, sx, PC_TOP + PC_VIS * PC_ROW - 40, 40, 40, '▼', PC.scroll + PC_VIS < rows.length, function () { pcScroll(3); });
    if (rows.length > PC_VIS) { var th = PC_VIS * PC_ROW - 96, ty = PC_TOP + 46 + th * PC.scroll / rows.length; c.fillStyle = 'rgba(245,181,61,0.5)'; c.fillRect(sx + 17, ty, 6, Math.max(14, th * PC_VIS / rows.length)); }
    // the footer: the app's own buttons and the last message
    var foot = pcFoot(PC.app), fy = PC_TOP + PC_VIS * PC_ROW + 6, fx = x0;
    foot.forEach(function (B) { if (B.text) { scText(c, fx, fy + 24, B.text, B.col || '#a0acb8', 13); c.font = '13px ' + SCREEN_THEME.font; fx += c.measureText(B.text).width + 12; return; } scButton(sc, fx, fy, B.w || 120, 34, B.label, B.on !== false, B.act, B.col); fx += (B.w || 120) + 8; });
    if (PC.msg && worldTime - PC.msgT < 6) scText(c, x0, sc.h - 6, PC.msg, '#ff9a8a', 12);
  }
  function act(fn) { return function () { var r = fn(); if (r) pcSay(r); screenDirtyAll(); }; }
  // ── The apps ──────────────────────────────────────────────────────
  function pcRows(app) {
    var rows = [];
    if (app === 'parts') {
      Object.keys(PARTS).forEach(function (p) {
        var P = PARTS[p], open = S.level >= P.lvl;
        rows.push({ text: P.name + (open ? '' : ' (level ' + P.lvl + ')'), sub: money(P.cost) + ' each · sells for ' + money(P.sell) + ' · on the shelf ' + (S.stock[p] || 0) + (onOrder(p) ? ' · coming ' + onOrder(p) : '') + (PC.basket[p] ? ' · in the basket ' + PC.basket[p] : ''), col: open ? null : '#7a8691',
          btns: open ? [{ label: '+1', w: 44, act: function () { PC.basket[p] = (PC.basket[p] || 0) + 1; screenDirtyAll(); } }, { label: '+5', w: 44, act: function () { PC.basket[p] = (PC.basket[p] || 0) + 5; screenDirtyAll(); } }] : [] });
      });
    } else if (app === 'stock') {
      rows.push({ head: true, text: 'On the shelves: ' + stockTotal() + ' of ' + stockCap() + (onOrderTotal() ? ' · ' + onOrderTotal() + ' coming' : '') + (S.delivery ? ' · a delivery waits by the roll door' : '') });
      Object.keys(PARTS).forEach(function (p) {
        if (S.level < PARTS[p].lvl && !S.stock[p]) return; var min = (S.minStock || {})[p] || 0, acct = S.level >= 5;
        rows.push({ text: PARTS[p].name + ': ' + (S.stock[p] || 0), sub: (onOrder(p) ? onOrder(p) + ' coming · ' : '') + (acct ? 'keep at least ' + min + ' (the supplier account reorders at closing)' : 'the supplier account opens at level 5'),
          btns: acct ? [{ label: '−', w: 40, act: function () { S.minStock[p] = Math.max(0, min - 1); screenDirtyAll(); } }, { label: '+', w: 40, act: function () { S.minStock[p] = min + 1; screenDirtyAll(); } }] : [] });
      });
    } else if (app === 'jobs') {
      for (var b = 0; b < bayCount(); b++) (function (b) {
        var J = jobAt(b); if (!J) { rows.push({ text: 'Bay ' + (b + 1) + ': empty', sub: 'the next car is on its way' }); return; }
        var s = curStep(J), who = J.assign && staffById(J.assign);
        rows.push({ text: 'Bay ' + (b + 1) + ': ' + J.car.name + "'s " + J.car.make + ' · ' + jobLabel(J), sub: (diagnosing(J) ? Object.keys(J.diag.done).length + ' check' + (Object.keys(J.diag.done).length === 1 ? '' : 's') + ' done; name it on the job card' : J.state === 'taken' ? 'step ' + (J.step + 1) + '/' + stepsOf(J).length + ': ' + (s ? s.label : '') : J.state) + (J.hold === 'parts' ? ' · WAITING ON PARTS: ' + missingParts(J).map(function (p) { return PARTS[p].name; }).join(', ') : '') + (J.due && J.state === 'taken' ? ' · promised ' + fmtTime(J.due) : '') + ' · ' + money(J.price),
          col: J.hold === 'parts' ? '#ff6b5e' : null,
          btns: [J.state === 'taken' && staffList().some(function (w) { return canDo(w, J); }) ? { label: who ? who.name : 'Give to…', w: 96, act: function () { assignNext(b); } } : null, J.state === 'taken' && J.car.extra && !J.offered && !unnamed(J) && customerIn(b) && !customerIn(b).walking ? { label: 'Offer extra', w: 96, act: function () { offerExtra(b); } } : null].filter(Boolean) });
      })(b);
      rows.push({ head: true, text: 'Done (' + S.done.length + ')' });
      S.done.slice(0, 20).forEach(function (d) { rows.push({ text: 'Day ' + d.day + ' ' + d.t + ' · ' + d.name + ' · ' + d.job, sub: d.make + ' · ' + money(d.price) }); });
    } else if (app === 'staff') {
      rows.push({ head: true, text: 'Your staff (' + staffList().length + ' of ' + staffMax() + ')' });
      staffList().forEach(function (w) { rows.push({ text: w.name + ', ' + ROLES[w.role].name + ' · skill ' + Math.floor(w.skill), sub: money(w.wage) + ' a day · ' + w.jobs + ' jobs' + (w.auto ? ' · takes jobs on their own' : ' · waits to be given a job') + (w.unpaid ? ' · UNPAID ' + w.unpaid : ''), btns: [{ label: 'Course ' + money(TRAIN_PRICE), w: 110, on: w.skill < 5, act: act(function () { return train(w.id); }) }, { label: 'Let go', w: 70, col: '#ff6b5e', act: act(function () { return letGo(w.id); }) }] }); });
      if (!staffList().length) rows.push({ text: 'Nobody yet.', sub: S.level < 3 ? 'an apprentice can start at level 3' : 'hire from the list below' });
      rows.push({ head: true, text: 'Looking for work today' });
      var cs = candidates(); if (!cs.length) rows.push({ text: 'Nobody: the first role opens at level 3 (apprentice).' });
      cs.forEach(function (k) { rows.push({ text: k.name + ', ' + ROLES[k.role].name + ' · skill ' + k.skill, sub: money(k.wage) + ' a day · ' + (ROLES[k.role].desk ? 'the desk: jobs, payments, deliveries' : ROLES[k.role].jobs ? 'simple jobs: ' + ROLES[k.role].jobs.length + ' kinds' : 'every job'), btns: [{ label: 'Hire', w: 70, act: act(function () { return hire(k.id); }) }] }); });
    } else if (app === 'garage') {
      UPGRADES.forEach(function (u) { var why = canBuy(u); rows.push({ text: u.name + (owns(u.id) ? ' ✓' : ''), sub: u.desc + (owns(u.id) ? '' : ' · ' + money(u.price) + (S.level < u.lvl ? ' · level ' + u.lvl : '')), col: owns(u.id) ? '#5fd38d' : null, btns: owns(u.id) ? [] : [{ label: why || 'Buy', w: 96, on: !why, act: act(function () { return buyUpgrade(u.id); }) }] }); });
      rows.push({ text: 'The two-bay garage' + (grown() ? ' ✓' : ''), sub: grown() ? 'two bays, the parts store, the office, the waiting corner' : 'the builders come the night you reach level 5', col: grown() ? '#5fd38d' : '#a0acb8' });
    } else if (app === 'books') {
      var today = 0, out = 0; (S.ledger || []).forEach(function (l) { if (l.day === S.day) { if (l.n > 0) today += l.n; else out -= l.n; } });
      rows.push({ head: true, text: money(S.bank) + ' in the bank · today in ' + money(today) + ', out ' + money(out) });
      rows.push({ text: 'Rep ' + S.rep + ' of 100', sub: 'cars every ' + Math.round(47 * (1.3 - S.rep / 200)) + ' s or so · labour at ' + Math.round(labourMul() * 100) + '%' });
      rows.push({ text: 'Diagnosis: ' + (S.stats.diagRight || 0) + ' right first time · ' + (S.stats.wrong || 0) + ' wrong', sub: 'a wrong name costs the part you fitted and the time' });
      var wages = 0; staffList().forEach(function (w) { wages += w.wage; }); rows.push({ text: 'Wages: ' + money(wages) + ' a day', sub: staffList().length + ' staff · paid at closing' });
      rows.push({ head: true, text: 'What the town says' });
      (S.repLog || []).slice(0, 12).forEach(function (r) { rows.push({ text: (r.n > 0 ? '+' : '') + r.n + ' · ' + r.why, sub: 'day ' + r.day + ' ' + r.t, col: r.n > 0 ? '#5fd38d' : '#ff6b5e' }); });
      rows.push({ head: true, text: 'The ledger' });
      (S.ledger || []).slice(0, 20).forEach(function (l) { rows.push({ text: (l.n >= 0 ? '+' : '') + money(l.n) + ' · ' + l.why, sub: 'day ' + l.day + ' ' + l.t, col: l.n >= 0 ? '#5fd38d' : null }); });
    }
    return rows;
  }
  function basketCost() { var c = 0, n = 0; for (var p in PC.basket) { c += PARTS[p].cost * PC.basket[p]; n += PC.basket[p]; } return { cost: c, n: n }; }
  function pcFoot(app) {
    if (app === 'parts') { var B = basketCost(); return [{ text: B.n ? B.n + ' in the basket · ' + money(B.cost) : 'The basket is empty' }, { label: 'Clear', w: 64, on: B.n > 0, act: function () { PC.basket = {}; screenDirtyAll(); } }, { label: 'Order: 8:30 van', w: 130, on: B.n > 0, act: act(function () { var r = orderParts(PC.basket, false); if (!r) PC.basket = {}; return r; }) }, { label: 'Express +' + money(EXPRESS_FEE), w: 120, on: B.n > 0, act: act(function () { var r = orderParts(PC.basket, true); if (!r) PC.basket = {}; return r; }) }]; }
    if (app === 'jobs') return [{ text: 'Give a job to someone, or tap again to take it back. Staff on their own take what you have not started.' }];
    if (app === 'staff') return [{ text: 'Wages at closing. Two unpaid days and they leave.' }];
    if (app === 'stock') return [{ text: S.level >= 5 ? 'Set a minimum and the account orders up to it every night.' : 'Order on Parts. Short of a part, the job waits on it.' }];
    return [];
  }
  // the test handle taps a PC button by its label
  function pcTap(label) { var sc = (G.pcs || [])[0]; if (!sc) return false; sc.dirty = true; drawScreens(0); var z = sc.zones.filter(function (k) { return k.label === label || (k.label && k.label.indexOf(label) === 0); })[0]; if (!z) return false; screenTap(sc, z); drawScreens(0); return true; }
