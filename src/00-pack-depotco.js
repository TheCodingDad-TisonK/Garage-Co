//@ Co Engine pack: Depot Co.. The warehouse's props: rack rows, belts and the packing line, machines, the dock loaders, office and break room furniture, lockers, signs, posters, floor paint and the yard, carried with the helpers and materials they are drawn with, sealed in a scope of their own. The depot's logic stays behind: a machine you use says what it is. Generated from Depot Co.'s src/ by the Co Engine pack tools; regenerate rather than edit.
  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once
  var depotcoPack = function (HOST_DEF) {
    // the game's own defProp calls land here first; each is registered below as a pack prop
    var P_DEFS = [], defProp = function (id, def) { P_DEFS.push({ id: id, def: def }); return def; };
    // Depot Co.'s carried code, in its part order
    /* 01-head.js */
    function stageForOwned(up) { up = up || {}; return up.hall4 ? 5 : (up.hall2 || up.hall3) ? 4 : 3; }
    /* 01-head.js */
    var BOOT_STAGE = 5;   // the pack builds every prop at the depot's full size
    /* 02-config.js */
    var SKUS = [
        { id: 'paint',  name: 'Paint tins',       col: '#d14a3a', val: 38,  tier: 1, lvl: 1 },
        { id: 'bolts',  name: 'Bolt boxes',       col: '#7b8794', val: 22,  tier: 1, lvl: 1 },
        { id: 'cereal', name: 'Cereal cases',     col: '#f0b94d', val: 18,  tier: 1, lvl: 1 },
        { id: 'lamps',  name: 'Desk lamps',       col: '#e8d9a0', val: 26,  tier: 1, lvl: 1 },
        { id: 'coffee', name: 'Coffee beans',     col: '#6b4423', val: 45,  tier: 2, lvl: 6 },
        { id: 'toys',   name: 'Toy robots',       col: '#3fa7d6', val: 30,  tier: 2, lvl: 3 },
        { id: 'soap',   name: 'Detergent',        col: '#5fd38d', val: 14,  tier: 2, lvl: 7 },
        { id: 'books',  name: 'Book cartons',     col: '#8e6bbf', val: 20,  tier: 2, lvl: 4 },
        { id: 'shoes',  name: 'Trainers',         col: '#f2f2f2', val: 55,  tier: 3, lvl: 8 },
        { id: 'drills', name: 'Cordless drills',  col: '#2f9e44', val: 95,  tier: 3, lvl: 9 },
        { id: 'tv',     name: '32" televisions',  col: '#1f2937', val: 180, tier: 4, lvl: 11 },
        { id: 'tyres',  name: 'Tyre sets',        col: '#111111', val: 120, tier: 4, lvl: 12 },
        // own-brand goods come off the moulding line in the production wing (level 10, with the wing); raw granulate feeds it and is never ordered by a client
        { id: 'dccrate',   name: 'Depot Co. crates',       col: '#2f6b9a', val: 42, tier: 1, lvl: 10, own: true },
        { id: 'dcbin',     name: 'Depot Co. storage bins', col: '#6b8e23', val: 36, tier: 1, lvl: 10, own: true },
        { id: 'dcplanter', name: 'Depot Co. planters',     col: '#b5651d', val: 50, tier: 2, lvl: 13, own: true },
        { id: 'raw',       name: 'Raw granulate',          col: '#9aa0a6', val: 0,  tier: 99, lvl: 10, raw: true }
      ];
    /* 02-config.js */
    var SKU = {};
    /* 02-config.js */
    function skuName(id) { return SKU[id] ? SKU[id].name : id; }
    /* 02-config.js */
    function skuOpen(s) { return !!s && !s.raw && S.level >= (s.lvl || 1); }
    /* 02-config.js */
    var CLIENTS = [
        // mode: the shipping lane the client's parcels leave by (sea at OUT 1, land at OUT 2, air at OUT 3 once the sortation deck opens it). lvl: when the client finds you
        { id: 'hardware', name: 'Kessler Hardware',  mode: 'sea',  lvl: 1,  likes: ['paint', 'bolts', 'drills', 'lamps', 'dccrate', 'dcbin'] },
        { id: 'grocer',   name: 'Northgate Grocers', mode: 'land', lvl: 1,  likes: ['cereal', 'coffee', 'soap', 'dccrate'] },
        { id: 'toyshop',  name: 'Little Wonders',    mode: 'sea',  lvl: 3,  likes: ['toys', 'books', 'dcbin'] },
        { id: 'sports',   name: 'Fairlane Sports',   mode: 'air',  lvl: 8,  likes: ['shoes', 'tyres'] },
        { id: 'electro',  name: 'Volt & Co.',        mode: 'air',  lvl: 11, likes: ['tv', 'lamps', 'drills'] },
        { id: 'office',   name: 'Pinecrest Offices', mode: 'land', lvl: 4,  likes: ['lamps', 'coffee', 'books', 'paint', 'dcbin', 'dcplanter'] },
        // the deck accounts: they only come once the sortation deck stands, order more lines and more of each, and pay a third more
        { id: 'meridian',    name: 'Meridian Exports',   mode: 'sea',  lvl: 15, deck: true, likes: ['tv', 'drills', 'shoes', 'coffee', 'dcplanter'] },
        { id: 'nordwind',    name: 'Nordwind Parcels',   mode: 'air',  lvl: 15, deck: true, likes: ['toys', 'books', 'lamps', 'soap', 'dcbin'] },
        { id: 'continental', name: 'Continental Retail', mode: 'land', lvl: 15, deck: true, likes: ['paint', 'bolts', 'cereal', 'tyres', 'dccrate'] }
      ];
    /* 02-config.js */
    var MODES = {
        sea:  { name: 'Sea',  col: '#3fa7d6', form: 'crate', pack: 'export crating',  verb: 'crating',  haulier: 'OCEANIC LINES · PORT SHUTTLE' },
        land: { name: 'Land', col: '#5fd38d', form: 'strap', pack: 'strap and label', verb: 'strapping', haulier: 'DEPOT CO. FREIGHT' },
        air:  { name: 'Air',  col: '#ff6b5e', form: 'pouch', pack: 'air bagging',     verb: 'bagging',   haulier: 'SKYBRIDGE AIR CARGO' }
      };
    /* 02-config.js */
    var MODE_FEE = 0.75, AIR_RATE = 1.5;
    /* 02-config.js */
    var STAFF_NAMES = ['Jo', 'Mika', 'Sam', 'Ravi', 'Lena', 'Ada', 'Theo', 'Nour'];
    /* 02-config.js */
    var LEVEL_CAP = 25;
    /* 02-config.js */
    var XP_TABLE = [0, 60, 90, 130, 180, 260, 340, 440, 560, 700, 900, 1100, 1350, 1650, 2000, 2400, 2900, 3400, 4000, 4700, 5500, 6400, 7400, 8500, 9800, 9800];
    /* 02-config.js */
    var XP_FOR = function (lvl) { return XP_TABLE[clamp(lvl, 1, LEVEL_CAP)]; };
    /* 02-config.js */
    var XP = { box: 2, pallet: 8, pack: 10, ship: 15, truck: 6 };
    /* 02-config.js */
    var LEVEL_BONUS = 100;
    /* 02-config.js */
    var UNLOCK = {
        // the shop
        cart: 3, lights: 5, sign: 5, row3: 6, fork: 6, jackPower: 7, row4: 8, jackLift: 9, shipbelt: 9, raw: 10, row5: 12, agv: 12, plantTune: 13, agvFast: 13, gantry: 14, deckNight: 15, agvSweep: 15, plantAuto: 16,
        beltsA: 17, beltsB: 18, seating: 18, deckTune: 19, yardCat: 19, deckTier2: 22, decor: 23, clock: 2,
        // the crew and its options
        picker: 3, receiver: 4, packer: 8, driver: 8, shifts: 7, training: 9, raise: 11, cross: 13,
        // systems
        pc: 5, build: 5, contracts: 5, power: 5, rush: 6, loan: 6, prowler: 7, insurance: 7, inspector: 8, returns: 8, comfort: 5,
        scanPutaway: 2, scanStock: 3, scanCrew: 3, scanDocks: 5, scanMap: 5, scanPlant: 10,
        contractsBig: 17, twoContracts: 21, longContract: 24
      };
    /* 02-config.js */
    function unlocked(what) { return S.level >= (UNLOCK[what] || 1); }
    /* 02-config.js */
    var STAFF_CAPS = [0, 0, 0, 1, 2, 2, 2, 3, 4, 4, 5, 5, 5, 5, 6, 6, 7, 7, 7, 7, 8];
    /* 02-config.js */
    function staffCapAt(level) { return STAFF_CAPS[Math.min(level, STAFF_CAPS.length - 1)]; }
    /* 02-config.js */
    var LADDER_NOTES = {
        2: 'a second rack bay and the time clock', 3: 'a third bay, the picking cart, a picker to hire, Little Wonders', 4: 'a fourth bay, the coffee flask, a receiver to hire, Pinecrest Offices',
        5: 'the hall: proper docks, the office and the PC, the break room, the bench and pack line, the yard', 6: 'the forklift and a third rack row in the shop, the bank, coffee beans', 7: 'the powered pallet truck, shift patterns, a third head', 8: 'the fourth row, the packer and the forklift driver, returns, trainers',
        9: 'the high-lift stacker, the shipping belt, training', 10: 'the 60 by 48 hall: IN 2, OUT 2 and the sea lane, the production wing, the second jack, the car park and the road', 11: 'Volt and Co., televisions, the raise', 12: 'the fifth row and the AGV', 13: 'the plant tune-up, AGV fast drive, a second role', 14: 'the gantry pickers',
        15: 'the big hall: the mezzanine, the sortation deck, OUT 3 and the air lane, three deck accounts', 16: 'the plant automation suite', 17: 'conveyor pieces: straights and curves', 18: 'inclines and the high run, the comfort seating', 19: 'the deck dial to 300 percent, the yard catalogue',
        20: 'the returns hall and Hall 3 with IN 3, eight heads', 21: 'two contracts at once', 22: 'the deck runs half as fast again', 23: 'the last of the furniture', 24: 'the long contract', 25: 'Hall 4 and the full yard: the depot is complete'
      };
    /* 02-config.js */
    var LADDER_TIPS = { 2: 'The time clock is on the wall: E clocks you in and keeps your hours.', 5: 'The office PC is on the desk: E sits you down. Orders, the shop, the crew and the bank are on it.', 6: 'The forklift is in the shop. It drives with WASD, lifts with R and F, and reaches the top shelf.', 10: 'Two outbound doors now: the board shows every order’s lane, and a parcel out of the wrong door pays a forwarding fee.', 15: 'Every parcel off the pack line rides up to the deck and down into the truck of its lane by itself.', 20: 'Returns go to the returns hall now: the truck brings them to its own dock and the belt takes them in.' };
    /* 02-config.js */
    var DAY_START = 6, DAY_END = 22;
    /* 02-config.js */
    var TRUCK_IN = [7.5, 13.5];
    /* 02-config.js */
    var ECON = {
        start: 600, rent: 110, rawPrice: 120, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
        wage: { receiver: 85, picker: 85, packer: 75, driver: 95 },
        rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
        palletCap: 8, slotCap: 12, cartCap: 12, benchCap: 24, tableCap: 8
      };
    /* 02-config.js */
    var UPGRADES = [
        { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: UNLOCK.cart, desc: 'A trolley with three shelves that holds twelve boxes or parcels. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
        { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: UNLOCK.row3, desc: 'Another row of hand-reachable slots and a top level for the forklift.' },
        { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: UNLOCK.fork, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
        { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: UNLOCK.row4, desc: 'Another row of bays across three levels.' },
        { id: 'row5',   name: 'Fifth rack row',      price: ECON.rowPrice,   lvl: UNLOCK.row5, desc: 'The last row in the main hall. The annex halls come at level 20.' },
        { id: 'lights', name: 'LED high bays',       price: ECON.lightsPrice, lvl: UNLOCK.lights, desc: 'Brighter hall, and the inspector likes a well-lit floor: fines are halved.' },
        { id: 'dock2',  name: 'Second inbound bay',  price: 1400,            lvl: 10, free: 2, desc: 'Two inbound trucks a day can dock at once, and clients send bigger loads. Comes with the hall at level 10.' },
        { id: 'sign',   name: 'Roadside sign',       price: 500,             lvl: UNLOCK.sign, desc: 'New clients find you sooner. Reputation grows a little faster.' },
        { id: 'shipbelt', name: 'Shipping belt and dock loader', price: 1800, lvl: UNLOCK.shipbelt, desc: 'Parcels roll off the pack line shelf onto a belt down the east wall into the OUT 2 shipping bay (OUT 1 before the hall grows), a flow rack that holds nine, and the dock loader beside it pushes them into any docked truck with its door up.' },
        { id: 'agv',    name: 'AGV pallet mover',    price: 3200,            lvl: UNLOCK.agv, desc: 'A driverless truck. Set a pallet on its pickup square (or let the palletiser drop one) and it puts it away on the racks by itself.' },
        { id: 'gantry', name: 'Gantry pickers over the racks', price: 5000, lvl: UNLOCK.gantry, desc: 'A crane over every rack row you own (new rows get theirs too). Each watches the orders, picks the boxes the bench still needs out of its row and sends them down the overhead pick belts to the bench.' },
        // tiers on what you already own (each needs the one before it)
        { id: 'jackPower', name: 'Powered pallet truck',   price: 1200, lvl: UNLOCK.jackPower, desc: 'An electric drive on the pallet jacks: you walk at full speed with a loaded pallet behind you.' },
        { id: 'jackLift',  name: 'High-lift stacker',      price: 2200, lvl: UNLOCK.jackLift, needs: 'jackPower', desc: 'The jacks lift to the second rack level: set pallets into the middle shelf and pull them out by hand. The top shelf stays forklift work.' },
        { id: 'agvFast',   name: 'AGV: fast drive',        price: 1800, lvl: UNLOCK.agvFast, needs: 'agv', desc: 'The AGV runs at 2.2 m/s instead of 1.3: a put-away in little over half the time.' },
        { id: 'agvSweep',  name: 'AGV: floor sweep',       price: 2400, lvl: UNLOCK.agvSweep, needs: 'agvFast', desc: 'The AGV fetches any pallet left anywhere on the hall floor, not only the ones on its square, keeping clear of you and of pallets the crew already have in hand.' },
        { id: 'plantTune', name: 'Plant tune-up',          price: 2000, lvl: UNLOCK.plantTune, desc: 'Every machine dial goes to 300% (250 and 300 join the steps), and the pack line jams half as often.' },
        { id: 'plantAuto', name: 'Plant automation suite', price: 3500, lvl: UNLOCK.plantAuto, needs: 'plantTune', desc: 'The pack line never jams, and it starts any order the bench can complete by itself, no terminal tap needed. An AUTO switch on the bench terminal turns that off and on.' },
        { id: 'upper',     name: 'Mezzanine level',        price: 6000, lvl: 15, free: 3, desc: 'A steel deck over the receiving strip with a goods lift by the IN docks, one rack row of two levels up there and a crane of its own. Comes with the big hall at level 15.' },
        { id: 'sorter',    name: 'Sortation deck and air dock', price: 7500, lvl: 15, free: 3, desc: 'Every parcel off the pack line rides a spiral up to the deck and along the sorter: a scanner reads its lane, three cells crate it for the sea, strap it for the land or bag it for the air, and spirals drop it into the right dock loader by itself. OUT 3 and the air clients come with it. Comes with the big hall at level 15.' },
        { id: 'deckNight', name: 'Deck night shift',       price: 1800, lvl: UNLOCK.deckNight, needs: 'sorter', desc: 'The deck keeps running while you sleep: every parcel on the shelf and on the deck belts is sorted by morning and staged beside the loader of its lane, and the first truck of each lane loads them from the bays by itself.' },
        // the annex halls, free with the stages
        { id: 'hall2', name: 'Returns hall (east annex)',      price: 9000, lvl: 20, free: 4, needs: 'fork',  desc: 'A second hall off the north wall, east of the production wing, given over to returns: a returns dock of its own with a truck twice a day, the belt to the intake, three inspection desks, the restock cage and a compactor. Comes at level 20.' },
        { id: 'hall3', name: 'Hall 3 (west annex) and IN 3',   price: 9500, lvl: 20, free: 4, needs: 'hall2', desc: 'A third hall west of the wing with two rows of five bays and a third inbound dock, IN 3, on its west wall. Comes at level 20.' },
        { id: 'hall4', name: 'Hall 4 (behind the wing)',       price: 9500, lvl: 25, free: 5, needs: 'hall3', desc: 'The back hall, through the north wall of the production wing: 24 by 20 metres and two more rows of seven bays. Comes at level 25.' }
      ];
    /* 02-config.js */
    function upgradeName(id) { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }
    /* 02-config.js */
    var STAFF_ROLES = {
        receiver: { name: 'Receiver', wage: ECON.wage.receiver, lvl: UNLOCK.receiver, desc: 'Walks pallets out of a docked inbound truck and puts them on the racks.' },
        picker:   { name: 'Picker',   wage: ECON.wage.picker,   lvl: UNLOCK.picker, desc: 'Takes boxes off the racks for open orders and brings them to the bench.' },
        packer:   { name: 'Packer',   wage: ECON.wage.packer,   lvl: UNLOCK.packer, desc: 'Packs complete orders at the bench and loads the parcels into a docked outbound truck.' },
        driver:   { name: 'Forklift driver', wage: ECON.wage.driver, lvl: UNLOCK.driver, needs: 'fork', desc: 'Drives the forklift: puts the pallets left on the hall floor away on any level, the top shelf included, and parks it back in its bay. Needs the forklift.' }
      };
    /* 02-config.js */
    var STAGES = [
        { id: 'shed',  name: 'The shed',       level: 1,  hall: { x: 7, z: 5, h: 5 },    rows: [-3.8], bays: 4, x0: -6,   inZ: [0],        outZ: [],              retZ: [],    rent: 0,   maxOpen: 2,  pallets: [1, 3], skylights: [0],                   fence: { x: 24, z0: -16, z1: 16 } },
        { id: 'small', name: 'The small hall', level: 5,  hall: { x: 20, z: 14, h: 7 },  rows: [-6, -2, 2, 6], bays: 8, x0: -12, inZ: [-8], outZ: [-8],            retZ: [],    rent: 60,  maxOpen: 4,  pallets: [2, 4], skylights: [-7, 0, 7],           fence: { x: 50, z0: -40, z1: 40 } },
        { id: 'hall',  name: 'The hall',       level: 10, hall: { x: 30, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6], outZ: [-14, -6], retZ: [], rent: 110, maxOpen: 6,  pallets: [3, 6], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
        { id: 'big',   name: 'The big hall',   level: 15, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6], outZ: [-14, -6, -21.6], retZ: [], rent: 110, maxOpen: 8, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
        { id: 'annex', name: 'The annexes',    level: 20, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6, -34], outZ: [-14, -6, -21.6], retZ: [-34], rent: 160, maxOpen: 10, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
        { id: 'far',   name: 'The far end',    level: 25, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6, -34], outZ: [-14, -6, -21.6], retZ: [-34], rent: 160, maxOpen: 10, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } }
      ];
    /* 02-config.js */
    var STAGE_LAST = STAGES.length - 1, STAGE = STAGES[BOOT_STAGE];
    /* 02-config.js */
    function stageForLevel(l) { var s = 0; for (var i = 0; i < STAGES.length; i++) if (l >= STAGES[i].level) s = i; return s; }
    /* 02-config.js */
    var STAGE_OF = { rooms: 1, docks: 1, bench: 1, yard: 1, gates: 1, wing: 2, jack2: 2, carpark: 2, road: 2, lanes: 2, deck: 3, neighbours: 3, hallDoors: 3, annex: 4, hall4: 5 };
    /* 02-config.js */
    function stageHas(what) { return BOOT_STAGE >= (STAGE_OF[what] === undefined ? 0 : STAGE_OF[what]); }
    /* 02-config.js */
    function stageName(i) { return STAGES[clamp(i, 0, STAGE_LAST)].name; }
    /* 02-config.js */
    function stageFlags(up, stage) { if (stage >= 1 && (up.rows || 0) < 2) up.rows = 2; if (stage >= 2) up.dock2 = true; if (stage >= 3) { up.upper = true; up.sorter = true; } if (stage >= 4) { up.hall2 = true; up.hall3 = true; } if (stage >= 5) up.hall4 = true; return up; }
    /* 02-config.js */
    var VAN = { cap: 8, len: 4, z: 8.2, x: -2, w: 2.0 };
    /* 02-config.js */
    var TRUCK_OUT = BOOT_STAGE === 0 ? [{ mode: 'land', van: true, windows: [{ arrive: 10.5, leave: 12 }, { arrive: 16, leave: 17.5 }] }]
        : BOOT_STAGE === 1 ? [{ mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] }]
        : [
          { mode: 'sea',  windows: [{ arrive: 10.5, leave: 12 }, { arrive: 17, leave: 18.5 }] },
          { mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] },
          { mode: 'air',  windows: [{ arrive: 13, leave: 14.5 }, { arrive: 19, leave: 20.25 }] }
        ];
    /* 02-config.js */
    function modeDock(m) { for (var k = 0; k < TRUCK_OUT.length; k++) if (TRUCK_OUT[k].mode === m) return k; return TRUCK_OUT.length ? 0 : -1; }
    /* 02-config.js */
    function modeDoor(m) { var k = modeDock(m); return k < 0 ? -1 : doorIndex('out', k); }
    /* 02-config.js */
    function lanesOn() { return TRUCK_OUT.length > 1; }
    /* 02-config.js */
    function outWindows(dock) { return TRUCK_OUT[dock] ? TRUCK_OUT[dock].windows : []; }
    /* 02-config.js */
    function outNext(dock) { var ws = outWindows(dock); for (var k = 0; k < ws.length; k++) if (S.time < ws[k].leave - 0.3 && !S.flags['out' + S.day + '-' + dock + '-' + k]) return ws[k]; var w0 = ws[0] || { arrive: 0, leave: 0 }; return { arrive: w0.arrive, leave: w0.leave, tomorrow: true }; }
    /* 02-config.js */
    function outNextText(dock) { if (isSunday()) return 'closed Sunday'; var n = outNext(dock); return 'next at ' + fmtTime(n.arrive) + (n.tomorrow ? ' tomorrow' : ''); }
    /* 02-config.js */
    function dockOwned(dock) { return dock < TRUCK_OUT.length && (dock < 2 || !!(S.up && S.up.sorter)); }
    /* 02-config.js */
    var HALL = { x: STAGE.hall.x, z: STAGE.hall.z, h: STAGE.hall.h };
    /* 02-config.js */
    var RACK = { rows: STAGE.rows, bays: STAGE.bays, bayW: 3, x0: STAGE.x0, depth: 1.2, levels: [0, 1.55, 3.3], top: 2 };
    /* 02-config.js */
    var DOCKS = { in: STAGE.inZ.map(function (z) { return { z: z }; }), out: STAGE.outZ.map(function (z) { return { z: z }; }), ret: STAGE.retZ.map(function (z) { return { z: z }; }), w: 3.6, h: 4.2 };
    /* 02-config.js */
    var DOOR_MAP = [{ dir: 'in', dock: 0 }, { dir: 'in', dock: 1 }, { dir: 'out', dock: 0 }, { dir: 'out', dock: 1 }, { dir: 'out', dock: 2 }, { dir: 'in', dock: 2 }, { dir: 'ret', dock: 0 }];
    /* 02-config.js */
    function doorIndex(dir, dock) { for (var i = 0; i < DOOR_MAP.length; i++) if (DOOR_MAP[i].dir === dir && DOOR_MAP[i].dock === dock) return i; return -1; }
    /* 02-config.js */
    var YARD_Y = -1.2;
    /* 02-config.js */
    var TRAILER = { len: 12, w: 2.5, h: 2.7 };
    /* 02-config.js */
    var SPOT = {
        bench: { x: 26.6, z: 5.2 }, benchOut: { x: 26.6, z: 7.2 },
        stageIn: { x: -26, z: -10 }, stageOut: { x: 23, z: 0 },   // stageOut lands at x 29 after the wall shift: by OUT 2, between the land spiral and the bench (it sat under the sea spiral from 1.14 to 1.16)
        pc: { x: 27.5, z: 21.8 }, breaker: { x: 29.7, z: 19.6 },
        cot: { x: -27.2, z: 22.2 }, coffee: { x: -29.4, z: 19.3 },
        jack: { x: -27.8, z: -18.0 }, jack2: { x: 27.8, z: -18.0 }, cart: { x: -28.6, z: 9.2 }, fork: { x: 0, z: 21.2 },   // one jack by the IN docks, one by the OUT docks, the cart on the west wall
        spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }
      };
    /* 02-config.js */
    function stageRent() { return STAGE.rent; }
    /* 02-config.js */
    function benchCapNow() { return BOOT_STAGE === 0 ? ECON.tableCap : ECON.benchCap; }
    /* 02-config.js */
    var UNLOCK_WORDS = { cart: 'the picking cart in the shop', lights: 'the LED high bays in the shop', sign: 'the roadside sign in the shop', row3: 'a third rack row in the shop', fork: 'the forklift in the shop', jackPower: 'the powered pallet truck in the shop', row4: 'a fourth rack row in the shop', jackLift: 'the high-lift stacker in the shop', shipbelt: 'the shipping belt and dock loader in the shop', raw: 'raw granulate on the Production app', row5: 'a fifth rack row in the shop', agv: 'the AGV in the shop', plantTune: 'the plant tune-up in the shop', agvFast: 'AGV fast drive in the shop', gantry: 'the gantry pickers in the shop', deckNight: 'the deck night shift in the shop', agvSweep: 'the AGV floor sweep in the shop', plantAuto: 'the plant automation suite in the shop',
        beltsA: 'conveyor straights and curves in the catalogue', beltsB: 'conveyor inclines and the high run in the catalogue', seating: 'the comfort seating in the catalogue', deckTune: 'the deck dial to 300 percent', yardCat: 'the yard catalogue', deckTier2: 'the deck belts half as fast again', decor: 'the last of the furniture in the catalogue',
        picker: 'a picker to hire', receiver: 'a receiver to hire', packer: 'a packer to hire', driver: 'a forklift driver to hire', shifts: 'shift patterns for the crew', training: 'training courses for the crew', raise: 'raises for the crew', cross: 'second roles for the crew',
        clock: 'the time clock', pc: 'the office PC', build: 'build mode and the catalogue', contracts: 'contracts from the clients', power: 'power cuts, and the breaker in the office', rush: 'rush orders', loan: 'the bank loan', prowler: 'the night prowler: lock up', insurance: 'theft insurance', inspector: 'the safety inspector', returns: 'returns on the outbound trucks, and the returns desk', comfort: 'break room comfort',
        scanPutaway: 'the Putaway page on the scanner', scanStock: 'the Stock page on the scanner', scanCrew: 'the Crew page on the scanner', scanDocks: 'the Docks page on the scanner', scanMap: 'the Map page on the scanner', scanPlant: 'the Plant page on the scanner',
        contractsBig: 'bigger contracts', twoContracts: 'two contracts at once', longContract: 'the long contract' };
    /* 02-config.js */
    function levelOpens(level) {
        var out = [];
        if (level === 2) out.push('a second rack bay'); if (level === 3) out.push('a third rack bay'); if (level === 4) out.push('a fourth rack bay, the coffee flask');
        for (var k in UNLOCK) if (UNLOCK[k] === level && UNLOCK_WORDS[k]) out.push(UNLOCK_WORDS[k]);
        SKUS.forEach(function (s) { if (s.lvl === level && !s.raw && level > 1) out.push(s.name.toLowerCase() + (s.own ? ' off the moulding line' : ' from the clients')); });
        CLIENTS.forEach(function (c) { if (c.lvl === level && level > 1) out.push(c.name + (c.deck ? ', a deck account' : '') + ' finds you'); });
        if (staffCapAt(level) > staffCapAt(level - 1)) out.push('the crew grows to ' + staffCapAt(level));
        var st = stageForLevel(level); if (st > stageForLevel(level - 1)) out.unshift(STAGES[st].name.toLowerCase() + ': the builders come in the morning');
        return out;
      }
    /* 03-state.js */
    function freshState() {
        return {
          ver: 1, day: 1, time: DAY_START, bank: ECON.start, xp: 0, level: 1, rep: 10,
          hall: 5,                   // the hall layout generation; 1 was the 40 x 28 hall, 2 the first big-hall build whose migration ran too late
          site: 0, siteDue: 0,       // 1.21.0: the building stage this save is built at, and the one its level has earned (the builders come in at the day roll). Not "stage": that word is the deck's shipping bays below
          up: { rows: 1, cart: false, fork: false, lights: false, dock2: false, sign: false, shipbelt: false, agv: false, gantry: false, upper: false, sorter: false, hall2: false, hall3: false, hall4: false },
          gantries: {}, speed: {},
          agv: { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false },
          slots: {},                 // "row,bay,level" -> { sku, n, pal (a pallet under the boxes), wrapped }
          pallets: [],               // { id, sku, n, place: 'truck'|'floor'|'jack'|'fork'|'staff'|'lift'|'agv', truck, idx, x, z, y, rot, wrapped, recv }
          floor: [],                 // loose boxes and parcels on the floor: { kind: 'box'|'parcel', sku|order, x, y, z, rot }
          bench: { boxes: {}, parcels: [] },
          pack: { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null },           // the pack line
          lift: { pallet: null, pos: 0, state: 'down' },                                      // the goods lift to the mezzanine (1.14.0)
          factory: { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false },   // the moulding line and its hopper
          pal: { sku: null, n: 0 }, belts: {},
          baler: { card: 0, bales: 0, t: 0, made: 0 }, wrap: { film: 20, wrapped: 0 },                                                   // the palletiser's pallet, and what is on each belt
          cart: { boxes: [], parcels: [], x: SPOT.cart.x, z: SPOT.cart.z, rot: 0 },
          jack: { pallet: null, x: SPOT.jack.x, z: SPOT.jack.z, rot: Math.PI / 2 },
          jack2: { pallet: null, x: SPOT.jack2.x, z: SPOT.jack2.z, rot: -Math.PI / 2 },
          fork: { x: SPOT.fork.x, z: SPOT.fork.z, yaw: Math.PI, lift: 0.1, pallet: null, batt: 1 },
          weather: null, radio: { on: false, station: 0 },
          loan: 0, insured: false, contract: null, nextOffer: 3, binned: 0,
          layout: {}, custom: [],
          hand: null,                // { kind: 'box', sku } | { kind: 'parcel', order }
          orders: [], shipped: [],   // shipped keeps the last 40 for the ledger
          trucks: [], doors: [false, false, false, false, false, false, false],   // IN 1, IN 2, OUT 1, OUT 2, OUT 3, IN 3, RETURNS (see DOOR_MAP)
          sort: null,                // the sortation deck's cells, turntable and counts (1.14.0)
          stage: {},                 // parcels staged beside each dock loader, by loader id
          staff: [], nextStaffName: 0,
          intro: { step: 0, done: false, off: false },
          events: { power: false, powerUntil: 0, nextInspect: 4, inspected: false, prowled: false },
          seenSkus: ['paint', 'bolts', 'cereal', 'lamps'],
          stats: { received: 0, putaway: 0, picked: 0, packed: 0, shipped: 0, late: 0, earned: 0, spent: 0, fines: 0, days: 0, lost: 0, stolen: 0, made: 0, palletised: 0, returns: 0 },
          returns: [], rdesk: { queue: [], cur: null, t: 0, shelf: [], done: 0 },   // returns in play, and the returns desk (1.16.0)
          days: [], dayStart: null,  // the day reports (1.16.0)
          ledger: [], log: [], sleptAt: 0, lastOrderAt: 0, orderSeq: 1, truckSeq: 1, flags: {}
        };
      }
    // the state the props read: a sandboxed fresh Depot Co. save, never the host game's
    var S = freshState(); for (var uk in S.up) if (typeof S.up[uk] === 'boolean') S.up[uk] = true; S.up.rows = 6; S.site = 5; S.level = 30;
    /* 03-state.js */
    function addXp(n) {
        if (S.level >= LEVEL_CAP) { hudDirty = true; return; }   // the top of the ladder: the bar stays where it is (1.21.0)
        S.xp += n; hudDirty = true;
        while (S.level < LEVEL_CAP && S.xp >= XP_FOR(S.level)) { S.xp -= XP_FOR(S.level); S.level++; onLevelUp(); }
        if (S.level >= LEVEL_CAP) S.xp = Math.min(S.xp, XP_FOR(LEVEL_CAP));
      }
    /* 03-state.js */
    function addRep(n) { S.rep = clamp(S.rep + n * (S.up.sign && n > 0 ? 1.25 : 1), 0, 100); hudDirty = true; }
    /* 05-three.js */
    var hallLights = [];
    /* 05-three.js */
    var yardLights = [];
    /* 05-three.js */
    function posterTex(kind) {
        return tex(256, 384, function (c, w, h) {
          var title = function (t, col, y, size) { c.fillStyle = col; c.font = 'bold ' + (size || 30) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y); };
          var small = function (t, y, col) { c.fillStyle = col || '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y, w - 40); };
          if (kind === 'forklift') { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.beginPath(); c.moveTo(w / 2, 40); c.lineTo(w - 24, h * 0.55); c.lineTo(24, h * 0.55); c.closePath(); c.fill(); c.fillStyle = '#f5b53d'; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w - 48, h * 0.52); c.lineTo(48, h * 0.52); c.closePath(); c.fill(); c.fillStyle = '#111'; c.fillRect(w * 0.3, h * 0.33, 70, 36); c.fillRect(w * 0.3 + 70, h * 0.38, 40, 20); c.beginPath(); c.arc(w * 0.36, h * 0.47, 10, 0, 6.3); c.arc(w * 0.55, h * 0.47, 10, 0, 6.3); c.fill(); title('CAUTION', '#111', h * 0.68, 34); title('FORKLIFTS', '#111', h * 0.78, 28); small('Look both ways at the aisle ends', h * 0.9, '#111'); }
          else if (kind === 'lifting') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.25, 18, 0, 6.3); c.fill(); c.fillRect(w / 2 - 12, h * 0.3, 24, 60); c.fillRect(w / 2 - 36, h * 0.42, 72, 14); c.fillRect(w / 2 - 14, h * 0.45, 10, 50); c.fillRect(w / 2 + 4, h * 0.45, 10, 50); title('LIFT WITH', '#2c5f9e', h * 0.72, 28); title('YOUR LEGS', '#2c5f9e', h * 0.8, 28); small('Bend your knees, keep your back straight', h * 0.9); }
          else if (kind === 'exit') { c.fillStyle = '#2f9e44'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2f9e44'; title('FIRE EXIT', '#2f9e44', h * 0.2, 34); c.fillRect(w * 0.2, h * 0.3, w * 0.6, 8); c.beginPath(); c.moveTo(w * 0.3, h * 0.6); c.lineTo(w * 0.7, h * 0.6); c.lineTo(w * 0.7, h * 0.5); c.lineTo(w * 0.86, h * 0.65); c.lineTo(w * 0.7, h * 0.8); c.lineTo(w * 0.7, h * 0.7); c.lineTo(w * 0.3, h * 0.7); c.closePath(); c.fill(); small('Keep this route clear at all times', h * 0.9); }
          else if (kind === 'nosmoking') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8342a'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, h * 0.38, 80, 0, 6.3); c.stroke(); c.fillStyle = '#333'; c.fillRect(w / 2 - 50, h * 0.37, 100, 12); c.strokeStyle = '#c8342a'; c.beginPath(); c.moveTo(w / 2 - 56, h * 0.38 - 56); c.lineTo(w / 2 + 56, h * 0.38 + 56); c.stroke(); title('NO SMOKING', '#c8342a', h * 0.75, 30); small('Shelter is outside, by the car park', h * 0.86); }
          else if (kind === 'stacking') { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); title('PALLET RULES', '#1b232c', 46, 28); c.fillStyle = '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'left'; ['1. One line per slot', '2. Twelve boxes, no more', '3. Heavy at the bottom', '4. Labels facing the aisle', '5. Nothing on the floor', '6. Wrap before it moves'].forEach(function (t, i) { c.fillText(t, 28, 90 + i * 34); }); c.fillStyle = '#f5b53d'; c.fillRect(28, h - 56, w - 56, 24); c.fillStyle = '#111'; c.font = 'bold 14px Bahnschrift, Arial'; c.textAlign = 'center'; c.fillText('THE INSPECTOR CHECKS', w / 2, h - 39); }
          else if (kind === 'rota') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); title('SHIFT ROTA', '#1b232c', 40, 26); c.strokeStyle = '#999'; c.lineWidth = 1; for (var r = 0; r < 8; r++) { c.strokeRect(20, 60 + r * 36, w - 40, 36); } c.fillStyle = '#333'; c.font = '14px "Segoe UI", Arial'; c.textAlign = 'left'; ['Mon  Jo · Mika', 'Tue  Sam · Jo', 'Wed  Mika · Ravi', 'Thu  Jo · Lena', 'Fri  Sam · Mika', 'Sat  Ada · Theo', 'Sun  closed', 'Breaks 12:00 to 12:30'].forEach(function (t, i) { c.fillText(t, 30, 84 + i * 36); }); }
          else if (kind === 'hands') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); title('WASH YOUR', '#fff', h * 0.3, 30); title('HANDS', '#fff', h * 0.42, 30); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h * 0.65, 50, 0, 6.3); c.fill(); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.65, 36, 0, 6.3); c.fill(); small('Before you eat, after the yard', h * 0.9, '#fff'); }
          else { c.fillStyle = '#1b232c'; c.fillRect(0, 0, w, h); title('DEPOT CO.', '#f5b53d', h * 0.3, 34); title('SAFETY FIRST', '#fff', h * 0.42, 24); c.fillStyle = '#f5b53d'; c.fillRect(w * 0.2, h * 0.5, w * 0.6, 4); small('Days without an accident', h * 0.62, '#a0acb8'); title(String(randi(3, 180)), '#5fd38d', h * 0.78, 64); }
        });
      }
    /* 05-three.js */
    var POSTER_KINDS = ['forklift', 'lifting', 'exit', 'nosmoking', 'stacking', 'rota', 'hands', 'safety'];
    /* 05-three.js */
    var CARD = {};
    /* 05-three.js */
    function poster(kind, w, h, x, y, z, ry, parent) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: posterTex(kind), roughness: 0.95 })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m); return m; }
    /* 06-building.js */
    var doors = [];
    /* 06-building.js */
    var slotHits = {};
    /* 06-building.js */
    var bayLabelTex = {};
    /* 06-building.js */
    var world = { boardTex: null, boardCtx: null, boardMat: null, officeLamp: null, cot: null, coffeeMachine: null, pcScreen: null };
    /* 06-building.js */
    function slotKey(r, b, l) { return r + ',' + b + ',' + l; }
    /* 06-building.js */
    function slotParse(key) { var p = key.split(',').map(Number); return { r: p[0], b: p[1], l: p[2] }; }
    /* 06-building.js */
    function rackSlotPos(r, b, l) { var P = PROPS['rack' + r] ? propPlacement('rack' + r) : { x: 0, z: RACK.rows[r], rot: 0 }, a = P.rot * Math.PI / 2, lx = RACK.x0 + RACK.bayW * (b + 0.5); return { x: P.x + lx * Math.cos(a), y: RACK.levels[l] + (r === UPPER.row ? UPPER.y : 0), z: P.z - lx * Math.sin(a), ry: a }; }
    /* 06-building.js */
    function slotName(key) { var p = slotParse(key); return rowName(p.r) + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
    /* 06-building.js */
    function rowName(r) { return r === UPPER.row ? 'Upper row' : isAnnexRow(r) ? HALLS[hallOfRow(r)].name + ' row ' + rowLetter(r) : 'Row ' + 'ABCDEF'[r]; }
    /* 06-building.js */
    function buildDoor(i, side, z) {
        var x = side * HALL.x, ud = i < 6 && upperOwned() && z < UPPER.z1 + 0.3, dh = Math.min(DOCKS.h, HALL.h - 0.6);   // a main-hall door under the deck strip: its fittings keep under the deck plate at 4.6 m; dh: the shed's roof is lower than a dock door
        var panel = new THREE.Mesh(boxGeo(0.12, dh, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
        panel.position.set(x - side * 0.22, dh / 2, z); scene.add(panel);
        // the dock leveller: a plate from the hall edge out over the slot to the trailer bed, with a hinged lip and a hazard edge
        var lev = box(0.72, 0.05, 2.3, MAT.chequer, side * (HALL.x + 0.1), 0.0, z); lev.receiveShadow = true; box(0.2, 0.03, 2.3, MAT.hazard, side * (HALL.x + 0.5), 0.02, z).rotation.z = side * 0.12; box(0.06, 0.08, 2.3, MAT.steelDark, side * (HALL.x - 0.22), -0.02, z);
        var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0, h: dh };
        addInter(panel, { prompt: function () { return S.doors[i] ? null : DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock) ? 'OUT 3 · air freight dock · opens with the sortation deck · E opens the shop' : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i) + (dockLane(i) && lanesOn() ? ' (' + dockLane(i).name.toLowerCase() + ' lane)' : '') + (BOOT_STAGE === 0 ? '' : ' · the cabinet and the consoles close it')); }, use: function () { if (DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { if (!driving && !pc.on) openPanel('pc', 'shop'); return; } if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });   // E on the shut OUT 3 goes to the shop, where the deck that opens it is sold
        // a pull cord inside, to bring a door down without walking to the cabinet
        var cord = cyl(0.01, 1.2, MAT.red, x - side * 0.35, dh - 0.6, z - DOCKS.w / 2 - 0.3, null, 4); var knob = box(0.08, 0.12, 0.08, MAT.red, x - side * 0.35, dh - 1.25, z - DOCKS.w / 2 - 0.3);
        addInter(knob, { prompt: function () { return S.doors[i] ? 'Pull the cord: close dock door ' + dockLabel(i) : null; }, use: function () { if (S.doors[i]) setDoor(i, false); } });
        // bumpers, the number outside, the leveller plate, the sign inside
        box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z - DOCKS.w / 2 + 0.3); box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z + DOCKS.w / 2 - 0.3);
        var numY = Math.min(dh + 1.3, HALL.h - 0.7), numS = Math.min(1.2, HALL.h - dh - 0.2);
        sign([DOOR_MAP[i].dir === 'ret' ? 'R' : String(DOOR_MAP[i].dock + 1)], numS, numS, x + side * 0.17, numY, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 128, h: 128, bg: '#f5b53d', fg: '#1a1205' });
        plane(1.6, DOCKS.w - 0.4, MAT.hazard, x - side * 0.8, 0.008, z, -Math.PI / 2);
        var inY = ud ? dh + 0.17 : Math.min(dh + 0.6, HALL.h - 0.45);
        sign([dockLabel(i) + (dockLane(i) && lanesOn() ? ' · ' + dockLane(i).name.toUpperCase() : '')], ud ? 1.6 : 2.4, ud ? 0.3 : Math.min(0.7, HALL.h - dh - 0.1), x - side * 0.17, inY, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: DOOR_MAP[i].dir !== 'out' ? '#f5b53d' : (dockLane(i) ? dockLane(i).col : '#5fd38d') });
        doors[i] = d;
      }
    /* 06-building.js */
    function dockLabel(i) { var d = DOOR_MAP[i]; if (!d) return '?'; if (BOOT_STAGE === 0 && d.dir === 'out') return 'the van'; return d.dir === 'ret' ? 'RETURNS' : (d.dir === 'in' ? 'IN ' : 'OUT ') + (d.dock + 1); }
    /* 06-building.js */
    function dockLane(i) { var d = DOOR_MAP[i]; return d && d.dir === 'out' && TRUCK_OUT[d.dock] ? MODES[TRUCK_OUT[d.dock].mode] : null; }
    /* 06-building.js */
    function setDoor(i, open) { if (S.doors[i] === open) return; if (!doors[i]) return false; if (open && DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { toast('OUT 3 opens with the sortation deck.', 'bad'); return false; } S.doors[i] = open; sfx('roller'); logEvent('Dock door ' + dockLabel(i) + (open ? ' opened' : ' closed')); if (open && i < 2) introStep('door'); rebuildDyn(); return true; }
    /* 06-building.js */
    function doorPassable(i) { return !!doors[i] && doors[i].anim > 0.6; }
    /* 06-building.js */
    function buildRack(r) { if (PROPS['rack' + r]) buildProp('rack' + r); }
    /* 06-building.js */
    function rackBuild(r) {
        return function (c) {
          var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, nb = rowBays(r), RH = Math.min(5, HALL.h - 0.3);   // nb: the annex rows are shorter, the shed's row grows a bay a level; RH: the uprights stop under the shed roof
          for (var b = 0; b <= nb; b++) {
            var ux = x0 + b * bw;
            [-dz, dz].forEach(function (oz) { c.box(0.1, RH, 0.1, MAT.rack, ux, RH / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < RH - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
            for (var br = 0; br < Math.floor(RH - 0.3); br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
          }
          for (var l = 1; l < RACK.levels.length; l++) {
            var y = RACK.levels[l];
            c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, -dz); c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, dz);
            for (var bp = 0; bp <= nb; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
            for (var bb2 = 0; bb2 < nb; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, -0.3); c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, 0.3); }
          }
          for (var bb = 0; bb < nb; bb++) {
            var cx = x0 + (bb + 0.5) * bw, lbl = rowLetter(r) + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
            var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
            [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, RH - 0.25, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
            for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
              var key = slotKey(rr, b2, l2), hh2 = l2 === 2 ? 1.6 : 1.45;
              slotHits[key] = c.hit(bw - 0.2, hh2, RACK.depth, cx, RACK.levels[l2] + hh2 / 2, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } });
            })(r, bb, ll);
          }
          c.solid(x0 - 0.1, x0 + nb * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, RH);
          [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + nb * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, -RACK.depth / 2 - 0.1); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, RACK.depth / 2 + 0.1); c.sign(['MAX LOAD', '1000 kg / level', 'ROW ' + rowLetter(r)], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 }); });
        };
      }
    /* 06-building.js */
    function drawBoard(sc) {
        var c = world.boardCtx; if (!c) return; var w = 768, h = 384; sc = sc || world.boardScreen;
        c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f5b53d'; c.font = 'bold 30px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillText('OPEN ORDERS', 24, 44); c.font = '22px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8'; c.textAlign = 'right'; c.fillText('Day ' + S.day + '  ' + fmtTime(S.time), w - 24, 44);
        c.textAlign = 'left';
        var all = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }), per = 7, pages = Math.max(1, Math.ceil(all.length / per)), lanes = lanesOn();
        // the page: the one you wheeled to, for a while after the wheel turn; otherwise the board turns its own pages every six seconds
        var page = sc && sc.userScrollAt && worldTime - sc.userScrollAt < 12 ? clamp(sc.scroll || 0, 0, pages - 1) : (pages > 1 ? Math.floor(worldTime / 6) % pages : 0);
        if (sc) { sc.scrollMax = pages - 1; sc.scroll = page; }
        var open = all.slice(page * per, page * per + per);
        if (!all.length) { c.fillStyle = '#5fd38d'; c.font = '26px Bahnschrift, Arial, sans-serif'; c.fillText('Nothing waiting. Nice.', 24, 110); }
        open.forEach(function (o, i) {
          var y = 90 + i * 40, lane = MODES[orderMode(o)];   // the lane chip: which door the parcel leaves by (once there is more than one)
          if (lanes) { c.fillStyle = lane.col; c.beginPath(); if (c.roundRect) c.roundRect(24, y - 21, 62, 27, 6); else c.rect(24, y - 21, 62, 27); c.fill(); c.fillStyle = '#0d1b2a'; c.font = 'bold 17px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(lane.name.toUpperCase(), 55, y - 1); c.textAlign = 'left'; }
          c.fillStyle = o.state === 'packed' ? '#5fd38d' : (o.rush ? '#ff6b5e' : '#eef1f5'); c.font = 'bold 22px Bahnschrift, Arial, sans-serif';
          c.fillText('#' + o.num + '  ' + clientName(o.client), lanes ? 98 : 24, y);
          c.font = '20px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8';
          c.fillText(o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ').slice(0, 46), 330, y);
          c.textAlign = 'right'; c.fillStyle = o.state === 'packed' ? '#5fd38d' : '#f5b53d'; c.fillText(o.state === 'packed' ? 'PACKED' : 'due ' + fmtTime(o.due), w - 24, y); c.textAlign = 'left';
        });
        if (pages > 1) { c.fillStyle = '#6b7784'; c.font = '18px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('page ' + (page + 1) + ' of ' + pages + ' · ' + all.length + ' orders · the wheel turns the page', w - 24, h - 16); c.textAlign = 'left'; }
        world.boardTex.needsUpdate = true;
      }
    /* 06-building.js */
    function insideHall(x, z) { return (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z) || !!inAnnex(x, z); }
    /* 06-doors.js */
    function cabinetBuild(c) {
        var g = c.group;
        box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 2.12, -0.1, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 0.78, -0.1, g);
        box(0.04, 0.12, 0.03, MAT.black, 0.38, 1.0, 0.012, g); cyl(0.012, 0.6, MAT.black, 0.42, 0.45, -0.1, g, 6); cyl(0.012, 1.4, MAT.black, -0.42, 2.8, -0.1, g, 6);
        sign(['CONTROL'], 0.7, 0.14, 0, 2.02, 0.012, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' }, g);
        var lamps = [glowMat(0x39d353, 1.2), glowMat(0xf5b53d, 1.2), glowMat(0xff3b30, 1.2)];
        [-0.3, -0.1, 0.1].forEach(function (lx, i) { var l = cyl(0.025, 0.02, lamps[i], lx, 0.9, 0.012, g, 10); l.rotation.x = Math.PI / 2; });
        dress.cabLamps = g;
        touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: g, title: 'Control cabinet', draw: function (c, sc) {
          scBg(c, sc.w, sc.h); scHead(c, sc.w, 'DEPOT CONTROL', 'Day ' + S.day + ' · ' + fmtTime(S.time));
          var power = !S.events.power;
          scText(c, 16, 66, 'Mains ' + (power ? 'ON' : 'OFF: breaker tripped'), power ? '#5fd38d' : '#ff6b5e', 15);
          scText(c, 220, 66, 'Weather: ' + (S.weather ? S.weather.kind : 'clear'), '#a0acb8', 14);
          scButton(sc, 16, 80, 120, 40, 'Hall lights', !S.flags.lightsOff, function () { S.flags.lightsOff = !S.flags.lightsOff; }, '#5fd38d');
          scButton(sc, 148, 80, 120, 40, 'Yard lights', !S.flags.yardOff, function () { S.flags.yardOff = !S.flags.yardOff; }, '#5fd38d');
          scButton(sc, 280, 80, 124, 40, 'Night mode', !!S.flags.night, function () { S.flags.night = !S.flags.night; lockAll(S.flags.night); }, '#ff6b5e');
          scText(c, 16, 150, 'Dock doors', '#f5b53d', 14);
          doors.forEach(function (d, i) { scButton(sc, 10 + i * 58, 160, 54, 38, dockLabel(i).replace(' ', '').replace('RETURNS', 'RET') + (S.doors[i] ? ' ●' : ''), !!S.doors[i], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(i, !S.doors[i]); }); });
          scText(c, 16, 226, 'Doors', '#f5b53d', 14);
          hdoors.forEach(function (d, i) { var s = hd(d.id); scButton(sc, 16 + (i % 4) * 98, 236 + Math.floor(i / 4) * 44, 90, 36, d.label.replace(/^the | door$/g, '') + (s.locked ? ' 🔒' : s.open ? ' open' : ''), s.locked, function () { doorLock(d); }, '#ff6b5e'); });
        } });
        c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
      }
    /* 06-dressing.js */
    var dress = { fans: [], clocks: [], dockLamps: [], wrapper: null, turntable: null, wrapCarriage: null, kpiCtx: null, kpiTex: null, vending: null, radio: null, charger: null };
    /* 06-dressing.js */
    function kpiBoard() {
        var c = document.createElement('canvas'); c.width = 512; c.height = 320; dress.kpiCtx = c.getContext('2d');
        dress.kpiTex = new THREE.CanvasTexture(c); dress.kpiTex.encoding = THREE.sRGBEncoding;
        drawKpi();
        return new THREE.MeshBasicMaterial({ map: dress.kpiTex });
      }
    /* 06-dressing.js */
    function drawKpi() {
        var c = dress.kpiCtx; if (!c) return; var w = 512, h = 320;
        c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2c5f9e'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
        c.fillStyle = '#2c5f9e'; c.font = 'bold 30px "Segoe Print", "Comic Sans MS", cursive'; c.textAlign = 'left'; c.fillText('SO FAR', 24, 48);
        var tot = S.stats.shipped || 0, late = S.stats.late || 0, ontime = tot ? Math.round(100 * (tot - late) / tot) : 100;
        var rows = [['on time', ontime + '%'], ['shipped', String(tot)], ['received', (S.stats.received || 0) + ' pallets'], ['in stock', totalStock() + ' boxes'], ['rep', String(Math.round(S.rep))]];
        c.font = '26px "Segoe Print", "Comic Sans MS", cursive';
        rows.forEach(function (r, i) { c.fillStyle = i === 0 ? (ontime >= 90 ? '#2f9e44' : '#c8342a') : '#1b232c'; c.fillText(r[0], 30, 96 + i * 42); c.textAlign = 'right'; c.fillText(r[1], w - 30, 96 + i * 42); c.textAlign = 'left'; });
        c.strokeStyle = '#c8342a'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, 60); c.lineTo(w - 30, 60); c.stroke();
        c.fillStyle = '#c8342a'; c.font = '20px "Segoe Print", "Comic Sans MS", cursive'; c.fillText('close the dock doors at night!!', 30, h - 24);
        dress.kpiTex.needsUpdate = true;
      }
    /* 06-dressing.js */
    function dressDoor(d) {
        var X = HALL.x;
        [-1, 1].forEach(function (s) { var bx = d.side * (X - 1.0), bz = d.z + s * (DOCKS.w / 2 + 0.5); cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); });
          var x = d.side * (X - 0.3), nz = d.z - DOCKS.w / 2 - 0.5, z = nz < -HALL.z + 0.5 ? d.z + DOCKS.w / 2 + 0.5 : nz, ly = d.i < 6 && d.z < UPPER.z1 + 0.3 ? 4.25 : 4.6;   // OUT 3's beacon stood in the north wall and IN 1's in the deck plate until 1.18.0
          box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, ly, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, ly - 0.1, z);
          var dl = new THREE.PointLight(0xffb020, 0, 9, 2); dl.position.set(x - d.side * 0.9, ly - 0.3, z); scene.add(dl); dress.dockLamps.push({ m: lamp, l: dl, door: d.i });   // the beacon throws real amber on the apron while a truck is on its way
          box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
          var rx = d.side * (X - 0.15); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z - DOCKS.w / 2 - 0.05); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z + DOCKS.w / 2 + 0.05); cyl(0.1, 0.3, MAT.steelDark, rx - d.side * 0.15, DOCKS.h + 0.3, d.z + DOCKS.w / 2 + 0.35, null, 10).rotation.x = Math.PI / 2; cyl(0.006, DOCKS.h - 0.6, MAT.chrome, rx - d.side * 0.15, DOCKS.h / 2 + 0.2, d.z + DOCKS.w / 2 + 0.35, null, 4);
        if (dress.apron) dress.apron(d);   // the tyre scuffs inside the door: at boot the dressing paints every door after this runs, so only a door built later takes this path
      }
    /* 06-dressing.js */
    function paintBay(cx, cz, w, d, label) {
        var ms = [plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2), plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2), plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2), plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2)];
        ms.push(plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2));
        return ms;
      }
    /* 06-dressing.js */
    function repaintJack2Bay() { (dress.jack2Bay || []).forEach(function (m) { scene.remove(m); }); dress.jack2Bay = paintBay(SPOT.jack2.x, SPOT.jack2.z, 1.6, 2.2, 'JACK 2'); }
    /* 06-dressing.js */
    function buySnack() {
        if (S.events.power) { toast('No power.', 'bad'); return; }
        if (S.bank < 3) { toast('No change on you.', 'bad'); return; }
        pay(-3, 'Snack from the machine'); buff.snackDay = S.day; buff.snackUntil = S.time + 0.5; sfx('vend'); toast('Crisps. Faster for half an hour.', 'good');
        if (dress.vending) { var wp = new THREE.Vector3(); dress.vending.getWorldPosition(wp); burst(wp.x, 0.5, wp.z, 0xf5b53d, 8, 'down'); }
      }
    /* 06-props.js */
    function propStageOk(id) { var d = PROPS[id]; if (!d) return true; if (d.extra) return true; if (typeof d.stage === 'number' && BOOT_STAGE < d.stage) return false; if (BOOT_STAGE === 0 && !d.shed && !(d.at && d.at[0])) return false; if (typeof d.lvl === 'number' && S.level < d.lvl) return false; return true; }
    /* 06-props.js */
    function applyLevelUnlocks(level) { PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (!d.extra && d.lvl === level && propStageOk(id) && (!d.when || d.when()) && !propInst[id]) buildProp(id); }); if (BOOT_STAGE === 0 && level <= RACK.bays) { buildRack(0); NAV.dirty = true; } if (!edit.on) { unbakeStatic(); bakeStatic(); } }
    /* 06-props.js */
    var CHAIR_RED = std({ color: 0xc8342a, roughness: 0.6 });
    /* 06-props.js */
    function chairBuild(c) {
        var shell = new THREE.Mesh(bevelGeo(0.44, 0.05, 0.44, 0.02), CHAIR_RED); shell.position.set(0, 0.46, 0); shell.castShadow = true; c.group.add(shell);
        var back = new THREE.Mesh(bevelGeo(0.42, 0.4, 0.04, 0.02), CHAIR_RED); back.position.set(0, 0.72, -0.2); back.rotation.x = -0.12; c.group.add(back);
        [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
        c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, -0.18, 6).rotation.z = Math.PI / 2; c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, 0.18, 6).rotation.z = Math.PI / 2;
        c.cyl(0.012, 0.3, MAT.chrome, -0.18, 0.62, -0.2, 6); c.cyl(0.012, 0.3, MAT.chrome, 0.18, 0.62, -0.2, 6); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 0.5);
      }
    /* 06-props.js */
    function tableBuild(c) {
        var top = new THREE.Mesh(bevelGeo(1.0, 0.05, 1.0, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; c.group.add(top); c.box(1.02, 0.02, 1.02, MAT.black, 0, 0.72, 0);
        c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, -0.42); c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, 0.42); [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]].forEach(function (o) { c.box(0.05, 0.7, 0.05, MAT_MACH.frame, o[0], 0.35, o[1]); c.cyl(0.03, 0.01, MAT.black, o[0], 0.005, o[1], 8); });
        c.cyl(0.045, 0.1, MAT.white, 0.25, 0.83, -0.15, 12); c.cyl(0.035, 0.08, std({ color: 0x4a2c1a, roughness: 1 }), 0.25, 0.84, -0.15, 10); c.box(0.2, 0.012, 0.28, MAT.paper, -0.22, 0.785, 0.15); c.box(0.18, 0.004, 0.26, std({ color: 0xe8e2cc, roughness: 1 }), -0.2, 0.794, 0.17);
        c.cyl(0.04, 0.12, std({ color: 0xb8322a, roughness: 0.3, metalness: 0.4 }), 0.3, 0.84, 0.25, 10); c.box(0.12, 0.04, 0.08, std({ color: 0xf2b705, roughness: 0.6 }), -0.3, 0.8, -0.3); c.cyl(0.006, 0.14, MAT.black, 0.0, 0.78, 0.35, 6).rotation.z = Math.PI / 2;
        c.solid(-0.5, 0.5, -0.5, 0.5, 0, 0.8);
      }
    /* 06-props.js */
    function lockerBuild(c) {
        var LK = std({ color: 0x6f7b86, roughness: 0.5, metalness: 0.4 }), LD = std({ color: 0x5a6670, roughness: 0.5, metalness: 0.4 });
        c.box(1.24, 0.08, 0.5, MAT.black, 0, 0.04, 0); c.box(1.24, 1.82, 0.48, LK, 0, 0.99, -0.02); c.box(1.26, 0.04, 0.5, LK, 0, 1.92, -0.02);
        [-0.31, 0.31].forEach(function (lx, i) {
          c.box(0.56, 1.7, 0.03, LD, lx, 0.99, 0.23);
          for (var vv = 0; vv < 4; vv++) { c.box(0.34, 0.012, 0.015, MAT.black, lx, 1.68 - vv * 0.035, 0.245); c.box(0.34, 0.012, 0.015, MAT.black, lx, 0.42 - vv * 0.035, 0.245); }
          c.box(0.03, 0.1, 0.025, MAT.chrome, lx + 0.22, 1.0, 0.25); c.box(0.05, 0.03, 0.02, MAT.chrome, lx + 0.22, 1.1, 0.25); var hasp = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), MAT.chrome); hasp.position.set(lx + 0.22, 1.13, 0.26); c.add(hasp);
          c.box(0.2, 0.06, 0.012, MAT.white, lx, 1.8, 0.248); c.sign([String(i + 1)], 0.08, 0.05, lx, 1.8, 0.256, 0, { w: 64, h: 40, bg: '#ffffff', fg: '#1b232c' });
        });
        c.box(0.03, 1.7, 0.03, LK, 0, 0.99, 0.235);
        c.solid(-0.65, 0.65, -0.28, 0.28, 0, 2);
      }
    /* 06-props.js */
    function cotBuild(c) {
        var FR = MAT_MACH.frame; [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]].forEach(function (o) { c.box(0.05, 0.42, 0.05, FR, o[0], 0.21, o[1]); c.cyl(0.03, 0.012, MAT.black, o[0], 0.006, o[1], 8); });
        c.box(1.9, 0.05, 0.05, FR, 0, 0.42, -0.44); c.box(1.9, 0.05, 0.05, FR, 0, 0.42, 0.44); c.box(0.05, 0.05, 0.9, FR, -0.92, 0.42, 0); c.box(0.05, 0.05, 0.9, FR, 0.92, 0.42, 0); for (var sl = -0.8; sl <= 0.8; sl += 0.2) c.box(0.03, 0.02, 0.86, FR, sl, 0.43, 0);
        c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, -0.44); c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, 0.44); c.box(0.05, 0.05, 0.93, FR, -0.92, 0.9, 0); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, -0.44); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, 0.44); c.box(0.05, 0.05, 0.93, FR, 0.92, 0.7, 0);
        var mat = new THREE.Mesh(bevelGeo(1.84, 0.16, 0.84, 0.05), std({ color: 0x3c6ea6, roughness: 0.9 })); mat.position.set(0, 0.53, 0); mat.castShadow = true; c.group.add(mat); c.box(1.84, 0.01, 0.84, std({ color: 0x325c8a, roughness: 0.9 }), 0, 0.53, 0);
        var pil = new THREE.Mesh(bevelGeo(0.5, 0.12, 0.4, 0.05), MAT.white); pil.position.set(-0.6, 0.66, 0); pil.rotation.z = 0.06; c.group.add(pil);
        var bl = new THREE.Mesh(bevelGeo(0.7, 0.1, 0.8, 0.03), std({ color: 0x6b2b2b, roughness: 1 })); bl.position.set(0.5, 0.65, 0); c.group.add(bl); c.box(0.7, 0.012, 0.8, std({ color: 0x8a3b3b, roughness: 1 }), 0.5, 0.71, 0); c.box(0.02, 0.1, 0.8, std({ color: 0x5a2424, roughness: 1 }), 0.16, 0.65, 0);
        c.sign(['FIRST AID COT'], 0.6, 0.12, 0, 0.96, -0.47, 0, { w: 256, h: 56, bg: '#1b232c', fg: '#eef1f5' });
        c.hit(2.0, 1.0, 1.0, 0, 0.5, 0, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
        c.solid(-0.95, 0.95, -0.47, 0.47, 0, 0.9);
      }
    /* 06-props.js */
    function coffeeBuild(c) {
        var CAB = std({ color: 0xcfd5d2, roughness: 0.6 }), DOOR = std({ color: 0xbfc6c3, roughness: 0.55 }); c.box(1.36, 0.1, 0.52, MAT.black, 0, 0.05, -0.03); c.box(1.4, 0.8, 0.6, CAB, 0, 0.5, 0); [-0.47, 0, 0.47].forEach(function (dx) { var d = new THREE.Mesh(bevelGeo(0.42, 0.66, 0.02, 0.01), DOOR); d.position.set(dx, 0.5, 0.31); c.group.add(d); c.box(0.02, 0.12, 0.03, MAT.chrome, dx + 0.15, 0.7, 0.33); }); var top = new THREE.Mesh(bevelGeo(1.46, 0.04, 0.66, 0.012), std({ color: 0x3a3e45, roughness: 0.35 })); top.position.set(0, 0.92, 0); c.group.add(top); c.box(1.46, 0.08, 0.03, CAB, 0, 0.98, -0.31);
        c.box(0.34, 0.03, 0.3, MAT.chrome, 0.42, 0.935, -0.02); c.box(0.3, 0.12, 0.26, MAT.steel, 0.42, 0.88, -0.02); var tap = c.cyl(0.012, 0.22, MAT.chrome, 0.42, 1.02, -0.18, 8); var tap2 = c.cyl(0.01, 0.16, MAT.chrome, 0.42, 1.12, -0.11, 8); tap2.rotation.x = Math.PI / 2; c.box(0.05, 0.015, 0.03, MAT.chrome, 0.48, 1.0, -0.18); c.box(0.1, 0.06, 0.02, MAT.plastic, 0.42, 1.02, -0.3); c.cyl(0.03, 0.12, std({ color: 0x4caf50, roughness: 0.5 }), 0.62, 1.0, -0.2, 10);
        c.solid(-0.7, 0.7, -0.3, 0.3, 0, 1);
        var CM = new THREE.MeshPhysicalMaterial({ color: 0x1c1e22, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 });
        var cm = new THREE.Mesh(bevelGeo(0.42, 0.42, 0.36, 0.03), CM); cm.position.set(-0.35, 1.15, -0.06); cm.castShadow = true; c.group.add(cm); c.box(0.44, 0.03, 0.38, MAT.chrome, -0.35, 1.37, -0.06); c.cyl(0.09, 0.16, MAT.glass, -0.35, 1.47, -0.12, 14); c.cyl(0.07, 0.12, std({ color: 0x4a2c1a, roughness: 1 }), -0.35, 1.45, -0.12, 12);
        c.box(0.3, 0.025, 0.16, MAT.chrome, -0.35, 0.955, 0.16); for (var dr = 0; dr < 6; dr++) c.box(0.26, 0.005, 0.01, MAT.black, -0.35, 0.97, 0.1 + dr * 0.024); c.cyl(0.03, 0.06, MAT.chrome, -0.35, 1.0, 0.1, 12); c.cyl(0.02, 0.12, MAT.chrome, -0.35, 0.97, 0.16, 8).rotation.x = Math.PI / 2; c.cyl(0.012, 0.07, MAT.black, -0.35, 0.97, 0.23, 8).rotation.x = Math.PI / 2;
        c.cyl(0.035, 0.09, MAT.white, -0.35, 0.995, 0.16, 12); c.cyl(0.015, 0.2, MAT.chrome, -0.14, 1.0, 0.1, 8).rotation.x = 0.6; c.plane(0.14, 0.08, MAT.screen, -0.35, 1.26, 0.125, 0, 0); c.box(0.03, 0.03, 0.01, MAT.green, -0.42, 1.18, 0.125); c.box(0.03, 0.03, 0.01, MAT.red, -0.28, 1.18, 0.125); c.box(0.06, 0.012, 0.012, MAT.chrome, -0.35, 1.08, 0.125);
        c.cyl(0.035, 0.08, MAT.white, -0.55, 1.41, -0.1, 10); c.cyl(0.035, 0.08, MAT.white, -0.47, 1.41, -0.14, 10); c.cyl(0.035, 0.08, MAT.white, -0.22, 1.41, -0.14, 10);
        c.hit(0.5, 0.6, 0.5, -0.35, 1.19, -0.05, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working until ' + fmtTime(buff.coffeeUntil) : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
        c.cyl(0.08, 0.2, MAT.chrome, 0.1, 1.04, -0.1, 12); c.cyl(0.02, 0.1, MAT.chrome, 0.17, 1.07, -0.04, 6).rotation.z = -0.8; c.cyl(0.045, 0.1, MAT.white, 0.25, 0.99, 0.12, 10); c.cyl(0.045, 0.1, MAT.red, 0.35, 0.99, 0.02, 10);
        c.box(0.5, 0.3, 0.38, MAT.black, 0.42, 1.09, -0.08); c.plane(0.3, 0.16, MAT.glass, 0.42, 1.11, 0.115, 0, 0); c.box(0.06, 0.1, 0.02, MAT.black, 0.62, 1.09, 0.12);
        var rg = new THREE.Group(); rg.position.set(-0.05, 1.02, 0.1); c.add(rg); dress.radio = rg; rg.userData.worldOf = c.group;
        box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3;
        c.hit(0.4, 0.2, 0.2, -0.05, 1.02, 0.1, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } });
      }
    /* 06-props.js */
    function vendingBuild(c) {
        var BODY = new THREE.MeshPhysicalMaterial({ color: 0x1f4e8c, roughness: 0.35, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
        var body = new THREE.Mesh(bevelGeo(0.96, 1.9, 0.8, 0.03), BODY); body.position.set(0, 0.97, 0); body.castShadow = true; c.group.add(body); c.box(0.98, 0.08, 0.82, MAT.black, 0, 0.04, 0); [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (f) { c.cyl(0.03, 0.03, MAT.black, f[0], 0.015, f[1], 8); });
        c.box(0.66, 1.2, 0.3, MAT.black, -0.1, 1.17, 0.26); c.plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, 0.405, 0, 0);
        if (!vendingBuild.mats) vendingBuild.mats = [0xd14a3a, 0x5fd38d, 0xf0b94d, 0x3fa7d6, 0xf2f2f2].map(function (col) { return std({ color: col, roughness: 0.5 }); });   // five materials shared by the sixteen packets, not sixteen: a material of its own is a draw of its own
        for (var vr = 0; vr < 4; vr++) { c.box(0.6, 0.012, 0.28, MAT.chrome, -0.1, 0.7 + vr * 0.25, 0.27); for (var vc = 0; vc < 4; vc++) { var pm = vendingBuild.mats[(vr + vc) % 5]; c.box(0.09, 0.14, 0.08, pm, -0.33 + vc * 0.15, 0.78 + vr * 0.25, 0.3); c.cyl(0.015, 0.26, MAT.chrome, -0.26 + vc * 0.15, 0.72 + vr * 0.25, 0.3, 6).rotation.x = Math.PI / 2; } }
        var gf = c.box(0.64, 1.16, 0.01, MAT.glass, -0.1, 1.15, 0.415); gf.userData.noBake = true; c.box(0.6, 0.02, 0.3, glowMat(0xdfe9ff, 0.5), -0.1, 1.73, 0.26);
        c.box(0.22, 0.5, 0.02, MAT.black, 0.33, 1.3, 0.405); c.plane(0.16, 0.08, MAT.screen, 0.33, 1.48, 0.416, 0, 0); c.box(0.04, 0.06, 0.012, MAT.chrome, 0.33, 1.36, 0.414); c.box(0.03, 0.01, 0.012, MAT.black, 0.33, 1.36, 0.42);
        for (var kp = 0; kp < 12; kp++) c.box(0.035, 0.035, 0.01, MAT.white, 0.26 + (kp % 3) * 0.05, 1.26 - Math.floor(kp / 3) * 0.045, 0.416);
        c.box(0.56, 0.22, 0.04, MAT.black, -0.1, 0.33, 0.405); c.box(0.5, 0.16, 0.02, std({ color: 0x3a3e45, roughness: 0.4, metalness: 0.4 }), -0.1, 0.33, 0.425); c.box(0.44, 0.03, 0.02, MAT.chrome, -0.1, 0.44, 0.432);
        c.sign(['SNACKS'], 0.7, 0.2, -0.1, 1.82, 0.405, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['COLD DRINKS · CRISPS · BARS'], 0.76, 0.1, 0, 1.96, 0.405, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.plane(0.7, 1.4, std({ color: 0x163b6b, roughness: 0.5 }), 0.485, 1.0, 0, 0, Math.PI / 2);
        c.solid(-0.5, 0.5, -0.4, 0.4, 0, 2);
        dress.vending = c.hit(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : buff.snackDay === S.day && buff.snackUntil > S.time ? 'The snack is still working until ' + fmtTime(buff.snackUntil) : S.bank < 3 ? 'Buy a snack ($3): no change on you' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } });   // says what the coffee machine says: still working, or short of change, before you press
      }
    /* 06-props.js */
    function fridgeBuild(c) {
        var FW = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f0, roughness: 0.3, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }); var body = new THREE.Mesh(bevelGeo(0.7, 1.72, 0.68, 0.03), FW); body.position.set(0, 0.96, -0.02); body.castShadow = true; c.group.add(body);
        var dl = new THREE.Mesh(bevelGeo(0.66, 0.52, 0.03, 0.012), FW); dl.position.set(0, 1.56, 0.335); c.group.add(dl); var dl2 = new THREE.Mesh(bevelGeo(0.66, 1.1, 0.03, 0.012), FW); dl2.position.set(0, 0.72, 0.335); c.group.add(dl2); c.box(0.66, 0.01, 0.02, MAT.black, 0, 1.29, 0.345);
        c.box(0.025, 0.4, 0.03, MAT.chrome, -0.28, 1.56, 0.37); c.box(0.025, 0.8, 0.03, MAT.chrome, -0.28, 0.75, 0.37); c.box(0.7, 0.1, 0.02, MAT.black, 0, 0.05, 0.34); for (var gv = 0; gv < 6; gv++) c.box(0.08, 0.06, 0.01, MAT.plastic, -0.25 + gv * 0.1, 0.05, 0.345);
        c.box(0.12, 0.14, 0.004, MAT.paper, 0.15, 1.0, 0.355); c.cyl(0.015, 0.008, MAT.red, 0.15, 1.085, 0.357, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.004, std({ color: 0x3b7dd8, roughness: 0.6 }), -0.1, 0.9, 0.355); c.box(0.3, 0.05, 0.004, std({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.5 }), 0, 1.75, 0.355);
        c.solid(-0.37, 0.37, -0.37, 0.37, 0, 2);
      }
    /* 06-props.js */
    function coolerBuild(c) {
        var CW = std({ color: 0xe9ecef, roughness: 0.45 }); var cab = new THREE.Mesh(bevelGeo(0.38, 0.98, 0.38, 0.02), CW); cab.position.set(0, 0.49, 0); cab.castShadow = true; c.group.add(cab); c.box(0.4, 0.06, 0.4, std({ color: 0x5b6672, roughness: 0.6 }), 0, 1.01, 0); c.box(0.3, 0.02, 0.02, MAT.black, 0, 0.78, 0.19); c.box(0.26, 0.03, 0.12, MAT.plastic, 0, 0.72, 0.14); for (var dr = 0; dr < 5; dr++) c.box(0.24, 0.004, 0.012, MAT.black, 0, 0.74, 0.09 + dr * 0.022);
        c.box(0.03, 0.04, 0.03, MAT.blue, -0.06, 0.84, 0.2); c.box(0.03, 0.04, 0.03, MAT.red, 0.06, 0.84, 0.2); c.cyl(0.006, 0.03, MAT.black, -0.06, 0.835, 0.22, 6); c.cyl(0.006, 0.03, MAT.black, 0.06, 0.835, 0.22, 6);
        var WB = std({ color: 0xbfe3f2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }), WT = std({ color: 0x7fc4e8, roughness: 0.1, transparent: true, opacity: 0.6 }); c.cyl(0.13, 0.44, WB, 0, 1.28, 0, 16); c.cyl(0.124, 0.26, WT, 0, 1.19, 0, 16); c.cyl(0.08, 0.06, WB, 0, 1.53, 0, 14, 0.13); c.cyl(0.05, 0.04, MAT.blue, 0, 1.58, 0, 12); c.sphere(0.02, std({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.6 }), 0.04, 1.26, 0.03);
        c.box(0.08, 0.24, 0.08, CW, 0.23, 0.9, 0); c.cyl(0.03, 0.08, MAT.white, 0.23, 1.06, 0, 10); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.6);
      }
    /* 06-props.js */
    function hooksBuild(c) { c.box(1.9, 0.04, 0.12, MAT.wood, 0, 1.82, 0); for (var hk = 0; hk < 4; hk++) { var hx = -0.68 + hk * 0.45; c.cyl(0.015, 0.1, MAT.chrome, hx, 1.75, 0.05, 6).rotation.x = Math.PI / 2; if (hk !== 2) { c.box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, 0.06); c.box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, 0.06); } } }
    /* 06-props.js */
    function noticeBuild(c) { c.box(1.6, 1.0, 0.04, MAT.wood, 0, 1.9, 0); c.plane(1.5, 0.9, MAT.cork, 0, 1.9, 0.025, 0, 0); var tt = ['TRUCKS', 'IN ' + TRUCK_IN.map(fmtTime).join(' · ')]; TRUCK_OUT.forEach(function (dk) { tt.push((dk.van ? 'VAN' : lanesOn() ? MODES[dk.mode].name.toUpperCase() : 'OUT') + ' ' + dk.windows.map(function (w) { return fmtTime(w.arrive); }).join(' · ')); }); if (returnsHall()) tt.push('RET ' + TRUCK_RET.map(fmtTime).join(' · ')); c.sign(tt, 0.9, 0.5, -0.25, 2.05, 0.03, 0, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: tt.length > 5 ? 34 : 40 }); /* the returns truck joins the timetable once its hall is open (buildHall rebuilds the board) */ [[0.45, 1.75, -0.1], [-0.1, 1.6, 0.15], [0.55, 1.65, 0.05]].forEach(function (n) { var nb = c.box(0.22, 0.28, 0.004, MAT.paper, n[0], n[1], 0.03); nb.rotation.z = n[2]; c.cyl(0.01, 0.01, MAT.red, n[0], n[1] + 0.12, 0.035, 8).rotation.x = Math.PI / 2; }); }
    /* 06-props.js */
    function calendarBuild(c) { c.box(0.4, 0.5, 0.02, MAT.paper, 0, 1.7, 0); c.sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, 0, 1.7, 0.012, 0, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 28 }); }
    /* 06-props.js */
    function clockBuild(r) { return function (c) { var g = new THREE.Group(); g.position.set(0, 2.7, 0.02); c.add(g); var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim); for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; } var dg = new THREE.Group(); dg.userData.dynamic = true; g.add(dg); var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; dg.add(hh); dg.add(mh); box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh); cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2; dress.clocks.push({ h: hh, m: mh, group: c.group }); }; }
    /* 06-props.js */
    function posterBuild(kind, w, h) { return function (c) { c.box(w + 0.05, h + 0.05, 0.012, MAT.white, 0, 2.0, 0.002).castShadow = false; c.poster(kind, w - 0.04, h - 0.04, 0, 2.0, 0.01, 0); var gl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, h + 0.05), MAT.screenGlass); gl.position.set(0, 2.0, 0.016); gl.renderOrder = 2; c.add(gl); var fw = w + 0.08, fh = h + 0.08; c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 + fh / 2, 0.004); c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 - fh / 2, 0.004); c.box(0.03, fh, 0.03, MAT.black, -fw / 2, 2.0, 0.004); c.box(0.03, fh, 0.03, MAT.black, fw / 2, 2.0, 0.004); }; }
    /* 06-props.js */
    function extinguisherBuild(c) { c.cyl(0.08, 0.5, MAT.red, 0, 1.0, 0.12, 12); c.cyl(0.05, 0.08, MAT.black, 0, 1.28, 0.12, 10); c.box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.14); c.cyl(0.012, 0.42, MAT.black, 0.08, 1.0, 0.15, 6).rotation.z = 0.15; c.cyl(0.02, 0.07, MAT.black, 0.11, 0.79, 0.17, 8, 0.03); c.cyl(0.025, 0.02, MAT.white, 0.0, 1.3, 0.21, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.002, MAT.paper, 0, 1.0, 0.202); c.box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, 0.05); c.sign(['FIRE'], 0.3, 0.12, 0, 1.6, 0.04, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }); }
    /* 06-props.js */
    function firstAidBuild(c) { c.box(0.3, 0.3, 0.1, MAT.white, 0, 1.7, 0.05); c.box(0.18, 0.05, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.05, 0.18, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.12, 0.02, 0.02, MAT.chrome, 0, 1.87, 0.05); }
    /* 06-props.js */
    function binPrompt() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) return 'Write off the whole pallet (' + bp.n + ' × ' + skuName(bp.sku) + ', ' + money(Math.round(SKU[bp.sku].val * 0.5 * bp.n)) + ')'; if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return S.hand.ret ? 'Bin the damaged return (no charge)' : 'Bin the damaged box'; if (S.hand && S.hand.kind === 'box') return 'That box is fine: it belongs on a rack'; return 'The bin · ' + (S.binned || 0) + ' damaged boxes written off'; }
    /* 06-props.js */
    function binUse() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) { var n = bp.n, bsku = bp.sku, bcost = Math.round(SKU[bsku].val * 0.5 * n); bp.n = 0; bp.wrapped = false; S.binned = (S.binned || 0) + n; addWaste(2 * n); pay(-bcost, 'Written off: ' + n + ' × ' + skuName(bsku)); addRep(-0.5 * Math.min(n, 4)); sfx('crate'); toast('Pallet written off: ' + n + ' boxes, ' + money(bcost) + '. The pallet is empty again.', 'bad'); logEvent(n + ' boxes of ' + skuName(bsku) + ' went in the bin off a pallet (' + money(bcost) + ')', 'bad'); hudDirty = true; return; }
        if (!(S.hand && S.hand.kind === 'box' && S.hand.damaged)) { sfx('click'); return; } var sku = S.hand.sku, ret = !!S.hand.ret; handSet(null); S.binned = (S.binned || 0) + 1; addWaste(2);
        if (ret) { sfx('crate'); toast('Binned. A damaged return: nothing to pay.', ''); logEvent('A damaged return of ' + skuName(sku) + ' went in the bin'); return; }
        var cost = Math.round(SKU[sku].val * 0.5); pay(-cost, 'Written off: a damaged box of ' + skuName(sku)); addRep(-0.5); sfx('crate'); toast('Binned. The client charges ' + money(cost) + ' for it.', 'bad'); logEvent('A damaged box of ' + skuName(sku) + ' went in the bin (' + money(cost) + ')', 'bad'); }
    /* 06-props.js */
    function binBuild(c) { c.box(0.46, 0.85, 0.5, MAT.red, 0, 0.47, 0); c.box(0.52, 0.05, 0.56, std({ color: 0x8e2420, roughness: 0.7 }), 0, 0.92, 0); c.box(0.08, 0.03, 0.5, MAT.black, 0.22, 0.95, 0); c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, -0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, 0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.015, 0.5, MAT.steelDark, -0.2, 0.09, 0, 6).rotation.x = Math.PI / 2; c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1); c.hit(0.7, 0.9, 0.7, 0, 0.45, 0, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } }); c.sign(['DAMAGED', 'GOODS'], 0.5, 0.3, 0, 1.1, 0.0, 0, { w: 256, h: 128, bg: '#c8342a', fg: '#fff' }); }
    /* 06-props.js */
    function broomBuild(c) { var broom = c.cyl(0.014, 1.3, MAT.wood, 0.02, 0.72, 0, 6); broom.rotation.z = 0.22; c.box(0.3, 0.06, 0.06, MAT.plastic, 0.18, 0.1, 0); c.box(0.3, 0.06, 0.05, std({ color: 0x8a7a55, roughness: 1 }), 0.18, 0.04, 0); c.cyl(0.02, 0.04, MAT.red, -0.13, 1.36, 0, 8); }
    /* 06-props.js */
    function wetFloorBuild(c) { var face = new THREE.MeshBasicMaterial({ map: textTex(['CAUTION', 'WET FLOOR'], { w: 192, h: 256, bg: '#f5b53d', fg: '#111', size: 34 }) }); [-1, 1].forEach(function (s) { var pg = new THREE.Group(); pg.position.set(0, 0.72, 0); pg.rotation.x = s * 0.32; c.add(pg); box(0.34, 0.72, 0.012, MAT.yellow, 0, -0.36, s * 0.006, pg); var f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), face); f.position.set(0, -0.38, s * 0.014); f.rotation.y = s > 0 ? 0 : Math.PI; pg.add(f); box(0.02, 0.72, 0.02, MAT.black, -0.17, -0.36, s * 0.01, pg); box(0.02, 0.72, 0.02, MAT.black, 0.17, -0.36, s * 0.01, pg); box(0.34, 0.03, 0.02, MAT.black, 0, -0.72, s * 0.012, pg); }); c.cyl(0.012, 0.36, MAT.black, 0, 0.72, 0, 8).rotation.z = Math.PI / 2; c.box(0.1, 0.03, 0.02, MAT.black, 0, 0.75, 0); }
    /* 06-props.js */
    function palletModel(c, x, y, z, ry) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; c.add(g); [-0.5, 0, 0.5].forEach(function (bz) { box(1.2, 0.08, 0.1, MAT.wood, 0, 0.065, bz, g); box(1.2, 0.022, 0.1, MAT.wood, 0, 0.011, bz, g); }); for (var i = 0; i < 7; i++) box(i === 0 || i === 6 ? 0.14 : 0.1, 0.022, 1.0, MAT.wood, -0.53 + i * 0.1766, 0.116, 0, g); return g; }
    /* 06-props.js */
    function emptiesBuild(c) {
        for (var i = 0; i < 9; i++) palletModel(c, randf(-0.015, 0.015), i * 0.128, randf(-0.015, 0.015), randf(-0.02, 0.02));
        var mk = std({ color: 0xf0b400, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }); c.plane(1.5, 0.05, mk, 0, 0.004, 0.7, -Math.PI / 2, 0); c.plane(1.5, 0.05, mk, 0, 0.004, -0.7, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, 0.75, 0.004, 0, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, -0.75, 0.004, 0, -Math.PI / 2, 0);
        c.cyl(0.02, 1.5, MAT.steel, 1.05, 0.75, 0.75, 8); c.cyl(0.14, 0.04, MAT.steel, 1.05, 0.02, 0.75, 14); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, 0, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' }); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, Math.PI, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' });
        c.hit(1.4, 1.6, 1.3, 0, 0.8, 0, { prompt: function () { var jp = isJack(player.tool) ? jackPallet() : null; if (jp && jp.n === 0) return 'Stack the empty pallet here (' + (S.emptiesN || 0) + ' stacked)'; if (isJack(player.tool) && !jp) return (S.emptiesN || 0) > 0 ? 'Take an empty pallet onto the jack (' + S.emptiesN + ' stacked)' : 'No empty pallets left on the stack'; return 'Empty pallets · ' + (S.emptiesN || 0) + ' stacked · bring empties here on the jack, or take one for loose boxes'; },
          use: function () { if (!isJack(player.tool)) { sfx('click'); return; } var tl = jackTool(), jp = jackPallet(); if (jp && jp.n === 0) { removePallet(jp.id); S[tl].pallet = null; S.emptiesN = (S.emptiesN || 0) + 1; sfx('putdown'); addXp(1); toast('Empty pallet stacked', ''); hudDirty = true; return; } if (!jp && (S.emptiesN || 0) > 0) { var np = newPallet(null, 0, { place: 'jack', jack: tl }); S[tl].pallet = np.id; S.emptiesN--; sfx('jack'); toast('Empty pallet on the jack: put loose boxes on it by hand', ''); hudDirty = true; return; } sfx('bad'); } });
        c.solid(-0.62, 0.62, -0.52, 0.52, 0, 1.2); c.solid(0.9, 1.2, 0.6, 0.9, 0, 1.7);
      }
    /* 06-props.js */
    function balerBuild(c) {
        var GRN = std({ color: 0x2f7a3a, roughness: 0.55, metalness: 0.3 }), DRK = MAT_MACH.frame, dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        // the body: a vertical baler with a chamber door, a window, the ram head above, the power pack at the side
        c.box(1.3, 0.1, 1.0, DRK, 0, 0.05, 0); c.box(1.2, 2.6, 0.9, GRN, 0, 1.4, 0); c.box(1.3, 0.08, 1.0, DRK, 0, 2.74, 0);
        [-0.62, 0.62].forEach(function (x) { c.box(0.06, 2.7, 0.06, DRK, x, 1.4, 0.45); c.box(0.06, 2.7, 0.06, DRK, x, 1.4, -0.45); });
        c.box(1.2, 0.06, 0.06, DRK, 0, 1.6, 0.47); c.box(1.2, 0.06, 0.06, DRK, 0, 0.75, 0.47);
        var door = c.box(1.04, 0.78, 0.06, GRN, 0, 2.06, 0.47); var win = c.box(0.5, 0.3, 0.02, MAT.glass, 0, 2.12, 0.51); win.userData.noBake = true; c.box(0.1, 0.34, 0.05, MAT.chrome, 0.44, 2.06, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.8, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 2.3, 0.5);
        c.box(1.04, 0.78, 0.06, GRN, 0, 1.16, 0.47); c.box(0.5, 0.05, 0.07, MAT.chrome, 0.2, 1.4, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 0.92, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.4, 0.5); c.box(0.4, 0.04, 0.03, MAT.black, 0, 1.05, 0.51);
        c.box(1.1, 0.1, 0.05, MAT.hazard, 0, 1.6, 0.5); c.sign(['CRUSH HAZARD · KEEP HANDS CLEAR'], 0.9, 0.09, 0, 0.68, 0.5, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
        c.cyl(0.18, 0.9, MAT.chrome, 0, 3.2, 0, 16); c.cyl(0.26, 0.3, DRK, 0, 2.9, 0, 16); var ram = cyl(0.12, 0.6, MAT.chrome, 0, 3.6, 0, dyn, 12); c.box(0.5, 0.06, 0.5, DRK, 0, 3.68, 0);
        c.box(0.5, 0.9, 0.5, DRK, -0.95, 0.5, -0.1); var pm = c.cyl(0.18, 0.5, MAT_MACH.blue, -0.95, 1.2, -0.1, 14); c.cyl(0.14, 0.4, DRK, -0.95, 1.5, -0.1, 12); [[-0.95, 2.6, 0.1, 0.5], [-0.8, 2.0, 0.3, -0.3]].forEach(function (h) { var hs = c.cyl(0.025, 1.4, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
        c.cyl(0.05, 0.03, MAT.white, -0.72, 0.8, 0.16, 10).rotation.x = Math.PI / 2;
        // the control cabinet on the right: screen, lamp stack, E-stop
        cabinet(c, 0.88, 1.45, 0.05, 0.4, 0.9, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.88, y: 1.62, z: 0.17, ry: 0, parent: c.group, title: 'Baler', draw: balerScreenDraw }); scr.mesh.userData.propId = 'baler';
        eStop(c, 0.88, 1.2, 0.17); MACH.baler.lamps = lampStack(c, 0.88, 1.95, 0.05);
        c.sign(['BALER', 'cardboard only'], 0.8, 0.3, 0, 2.5, 0.5, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 });
        // the finished bales stack beside it: strapped cardboard blocks, shown by count
        var bales = []; for (var k = 0; k < 3; k++) { var bg = new THREE.Group(); bg.position.set(1.75, 0.4 + (k === 2 ? 0.82 : 0), k === 1 ? 0.95 : 0.05); bg.visible = false; dyn.add(bg); box(1.0, 0.8, 0.8, MAT.parcel, 0, 0, 0, bg); for (var s = 0; s < 3; s++) { box(1.02, 0.02, 0.03, MAT.steelDark, 0, 0.405, -0.3 + s * 0.3, bg); box(1.02, 0.02, 0.03, MAT.steelDark, 0, -0.405, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, 0.505, 0, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, -0.505, 0, -0.3 + s * 0.3, bg); } bales.push(bg); }
        MACH.baler.anim = { ram: ram, bales: bales };
        c.hit(1.4, 2.8, 1.0, 0, 1.4, 0, { prompt: function () { return balerPrompt(); }, use: function () { balerUse(); } });
        c.solid(-1.25, 1.1, -0.5, 0.55, 0, 2.8); c.solid(1.2, 2.3, -0.4, 1.4, 0, 1.0);
      }
    /* 06-props.js */
    function wrapperBuild(c, P, inst) {
        var wg = c.group; dress.wrapper = wg; var wdyn = new THREE.Group(); wdyn.userData.dynamic = true; wg.add(wdyn);   // the turntable and the carriage move; the column, the ramp, the cabinet and the sign join the bake (the whole group was dynamic until this pass)
        var tt = c.cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, 32); wdyn.add(tt); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
        var rp = c.box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35); rp.rotation.x = 0.11; c.box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15); c.box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15); c.box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95); c.box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95);
        var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wdyn.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
        cabinet(c, 0.75, 1.45, -1.15, 0.4, 0.9, 0.22); var wscr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.75, y: 1.62, z: -1.03, ry: 0, parent: c.group, title: 'Stretch wrapper', draw: wrapperScreenDraw }); wscr.mesh.userData.propId = 'wrapper'; eStop(c, 0.75, 1.2, -1.03); MACH.wrapper.lamps = lampStack(c, 0.75, 1.95, -1.15); c.cyl(0.02, 0.5, MAT.black, 0.55, 1.1, -1.15, 6);
        c.sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }); c.solid(-1, 1, -1.4, 1.0, 0, 3);
        c.hit(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } });
      }
    /* 06-props.js */
    function hoseBuild(c) { var reel = c.cyl(0.32, 0.12, MAT.red, 0, 1.5, 0.08, 24); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, 0.0, 8).rotation.x = Math.PI / 2; for (var hr = 0; hr < 5; hr++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.12 + hr * 0.035, 0.012, 6, 24), MAT.red); ring.position.set(0, 1.5, 0.16); c.add(ring); } c.cyl(0.015, 0.25, MAT.red, 0.3, 1.25, 0.08, 6).rotation.z = 0.4; c.cyl(0.03, 0.08, MAT.chrome, 0.38, 1.12, 0.08, 8, 0.018); c.sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, 0.01, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' }); }
    /* 06-props.js */
    var leafTex = tex(64, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2f6a2a'); g.addColorStop(1, '#8ad474'); c.fillStyle = g; c.beginPath(); c.moveTo(32, 128); c.quadraticCurveTo(0, 70, 32, 4); c.quadraticCurveTo(64, 70, 32, 128); c.fill(); c.strokeStyle = 'rgba(220,255,200,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 124); c.lineTo(32, 10); c.stroke(); });
    /* 06-props.js */
    var leafMat = std({ map: leafTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    /* 06-props.js */
    function plantBuild(c) {
        var pot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.11, 0), new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.17, 0.28), new THREE.Vector2(0.19, 0.3), new THREE.Vector2(0.17, 0.32), new THREE.Vector2(0.15, 0.3)], 16), std({ color: 0xa65e3a, roughness: 0.9 })); pot.castShadow = true; c.group.add(pot);
        c.cyl(0.15, 0.02, std({ color: 0x3a2a1c, roughness: 1 }), 0, 0.29, 0, 14);
        for (var i = 0; i < 11; i++) { var a = i / 11 * 6.283, lg = new THREE.Group(); lg.position.set(0, 0.3, 0); lg.rotation.y = a; c.group.add(lg); var st = cyl(0.006, 0.35 + (i % 3) * 0.12, MAT.green, 0, 0.17 + (i % 3) * 0.06, 0.03, lg, 5); st.rotation.x = 0.5 + (i % 2) * 0.2; var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.34), leafMat); lf.position.set(0, 0.42 + (i % 3) * 0.12, 0.2 + (i % 2) * 0.08); lf.rotation.x = -0.9 + (i % 3) * 0.2; lg.add(lf); }
        c.solid(-0.18, 0.18, -0.18, 0.18, 0, 0.5);
      }
    /* 06-props.js */
    function deskBuild(c) {
        var top = new THREE.Mesh(bevelGeo(2.2, 0.05, 0.8, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; top.receiveShadow = true; c.group.add(top);
        c.box(2.1, 0.5, 0.03, std({ color: 0x9aa4ad, roughness: 0.6 }), 0, 0.45, 0.36); [[-1.0, 0.0], [1.0, 0.0]].forEach(function (o) { c.box(0.05, 0.72, 0.7, MAT_MACH.frame, o[0] * 1.05, 0.36, 0); }); c.cyl(0.03, 0.02, MAT.black, 0.6, 0.76, -0.3, 10);
        var ped = new THREE.Mesh(bevelGeo(0.45, 0.66, 0.6, 0.02), std({ color: 0xcfd4d9, roughness: 0.5 })); ped.position.set(-0.75, 0.37, 0); c.group.add(ped); for (var dw = 0; dw < 3; dw++) { c.box(0.4, 0.19, 0.012, std({ color: 0xbfc6cc, roughness: 0.5 }), -0.75, 0.15 + dw * 0.21, -0.31); c.box(0.12, 0.02, 0.025, MAT.chrome, -0.75, 0.22 + dw * 0.21, 0.32); }
        c.cyl(0.14, 0.02, MAT_MACH.frame, 0, 0.785, 0.2, 14); c.cyl(0.025, 0.3, MAT_MACH.frame, 0, 0.93, 0.22, 8); var bez = new THREE.Mesh(bevelGeo(0.82, 0.52, 0.03, 0.01), MAT.black); bez.position.set(0, 1.25, 0.25); c.group.add(bez);
        pc.screen = touchScreen({ w: 800, h: 500, pw: 0.74, ph: 0.46, x: 0, y: 1.25, z: 0.225, ry: Math.PI, parent: c.group, title: 'Office PC', draw: drawPc });
        if (!deskBuild.keyMat) deskBuild.keyMat = std({ color: 0x4a515b, roughness: 0.6 });   // one material for the 48 keys, not 48: they bake into one draw
        c.box(0.62, 0.012, 0.42, std({ color: 0x1f2a36, roughness: 1 }), -0.1, 0.785, -0.15); for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 12; kc++) c.box(0.032, 0.012, 0.03, deskBuild.keyMat, -0.34 + kc * 0.044, 0.82, -0.26 + kr * 0.05);
        var mouse = new THREE.Mesh(bevelGeo(0.06, 0.03, 0.1, 0.012), MAT.black); mouse.position.set(0.5, 0.8, -0.18); c.group.add(mouse); c.box(0.2, 0.06, 0.16, MAT.black, -0.75, 0.81, 0.26); c.cyl(0.012, 0.18, MAT.black, -0.75, 0.9, 0.26, 6).rotation.z = Math.PI / 2;
        c.cyl(0.03, 0.09, MAT.black, 0.9, 0.82, -0.05, 8); c.cyl(0.004, 0.14, MAT.blue, 0.9, 0.9, -0.05, 4).rotation.z = 0.2; c.cyl(0.04, 0.09, MAT.white, 0.7, 0.82, -0.1, 10); c.box(0.2, 0.01, 0.28, MAT.paper, -0.75, 0.785, -0.1); c.box(0.18, 0.012, 0.26, MAT.paper, -0.72, 0.795, -0.08).rotation.y = 0.1;
        c.cyl(0.02, 0.4, MAT_MACH.frame, 0.95, 0.98, 0.25, 8).rotation.z = -0.3; c.cyl(0.07, 0.1, MAT_MACH.frame, 0.84, 1.17, 0.25, 12, 0.03); c.cyl(0.05, 0.02, glowMat(0xfff2c0, 0.6), 0.84, 1.12, 0.25, 12);
        var dl = new THREE.PointLight(0xfff2c0, 0.3, 3.5, 2); dl.position.set(0.84, 1.05, 0.25); c.add(dl);   // the desk lamp's pool on the desk
        c.sign(['DEPOT CO. · OFFICE'], 0.5, 0.06, -0.75, 0.56, -0.32, Math.PI, { w: 512, h: 64, bg: '#eef1f5', fg: '#1b232c' });
        c.hit(1.2, 0.9, 0.5, 0, 0.5, -0.1, { prompt: function () { return pc.on ? null : (S.events.power ? 'The PC is off: no power' : 'Sit down at the PC'); }, use: function () { openPc(); } });
        c.solid(-1.1, 1.1, -0.4, 0.4, 0, 0.8);
      }
    /* 06-props.js */
    function officeChairBuild(c) {
        var seat = new THREE.Mesh(bevelGeo(0.5, 0.08, 0.5, 0.04), MAT.fabric); seat.position.set(0, 0.52, 0); seat.castShadow = true; c.group.add(seat);
        var back = new THREE.Mesh(bevelGeo(0.48, 0.52, 0.06, 0.03), MAT.fabric); back.position.set(0, 0.84, -0.26); back.rotation.x = -0.1; c.group.add(back); c.box(0.4, 0.4, 0.01, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.86, -0.22).rotation.x = -0.1; c.box(0.3, 0.14, 0.04, MAT.fabric, 0, 1.18, -0.3);
        c.cyl(0.03, 0.3, MAT.chrome, 0, 0.33, 0, 10); c.cyl(0.045, 0.2, MAT.black, 0, 0.18, 0, 10); c.box(0.3, 0.03, 0.3, MAT.black, 0, 0.47, 0); c.box(0.06, 0.03, 0.08, MAT.black, 0.18, 0.44, 0.1);
        for (var sp = 0; sp < 5; sp++) { var a = sp / 5 * 6.283, leg = c.box(0.05, 0.035, 0.3, MAT.black, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15); leg.rotation.y = a; var cs = c.cyl(0.03, 0.025, MAT.black, Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, 8); cs.rotation.x = Math.PI / 2; cs.rotation.z = a; }
        [-0.28, 0.28].forEach(function (x) { c.box(0.04, 0.18, 0.04, MAT.black, x, 0.6, -0.05); c.box(0.06, 0.03, 0.3, MAT.black, x, 0.7, 0); });
        c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.6);
      }
    /* 06-props.js */
    function cabinetsBuild(c) {
        var CAB = std({ color: 0xcfd4d9, roughness: 0.5 }), DRW = std({ color: 0xbfc6cc, roughness: 0.5 });
        [-0.3, 0.3].forEach(function (cx2) { var body = new THREE.Mesh(bevelGeo(0.5, 1.3, 0.6, 0.02), CAB); body.position.set(cx2, 0.65, 0); body.castShadow = true; c.group.add(body); c.box(0.5, 0.06, 0.6, MAT.black, cx2, 0.03, 0); for (var cd = 0; cd < 3; cd++) { var d = new THREE.Mesh(bevelGeo(0.44, 0.36, 0.02, 0.01), DRW); d.position.set(cx2, 0.28 + cd * 0.4, 0.31); c.group.add(d); c.box(0.14, 0.025, 0.03, MAT.chrome, cx2, 0.4 + cd * 0.4, 0.33); c.box(0.16, 0.05, 0.004, MAT.paper, cx2, 0.2 + cd * 0.4, 0.323); c.box(0.17, 0.06, 0.002, MAT.chrome, cx2, 0.2 + cd * 0.4, 0.322); } c.box(0.02, 0.1, 0.02, MAT.chrome, cx2 + 0.2, 1.22, 0.31); });
        c.box(0.5, 0.25, 0.4, CAB, 0.3, 1.42, 0); c.box(0.4, 0.03, 0.3, MAT.white, 0.3, 1.56, 0.05); c.box(0.3, 0.02, 0.2, MAT.paper, 0.3, 1.58, 0.05); c.cyl(0.08, 0.1, std({ color: 0x4a7d33, roughness: 0.9 }), -0.3, 1.36, 0, 10, 0.06); c.sphere(0.12, std({ color: 0x5c8f44, roughness: 1, flatShading: true }), -0.3, 1.5, 0);
        c.solid(-0.6, 0.6, -0.35, 0.35, 0, 1.6);
      }
    /* 06-props.js */
    function coatStandBuild(c) {
        c.cyl(0.028, 1.75, MAT.steelDark, 0, 0.875, 0, 10); c.cyl(0.22, 0.03, MAT.steelDark, 0, 0.015, 0, 16); c.sphere(0.03, MAT.chrome, 0, 1.76, 0);
        for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2, hk = new THREE.Group(); hk.position.set(0, 1.62, 0); hk.rotation.y = a; c.add(hk); var arm = cyl(0.01, 0.2, MAT.chrome, 0, 0.04, 0.1, hk, 6); arm.rotation.x = Math.PI / 2 - 0.4; sphere(0.018, MAT.chrome, 0, 0.1, 0.18, hk); var low = cyl(0.01, 0.18, MAT.chrome, 0, -0.5, 0.09, hk, 6); low.rotation.x = Math.PI / 2 - 0.5; sphere(0.016, MAT.chrome, 0, -0.45, 0.16, hk); }
        var coat = c.box(0.38, 0.7, 0.12, MAT.jeans, 0.18, 1.3, 0.02); coat.rotation.y = 0.5; c.box(0.2, 0.08, 0.1, MAT.jeans, 0.3, 1.66, 0.12); var scarf = c.box(0.06, 0.5, 0.06, MAT.red, -0.1, 1.4, -0.16); scarf.rotation.y = -0.4;
        c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.8);
      }
    /* 06-props.js */
    function kpiBuild(c) { var kb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), kpiBoard()); kb.position.set(0, 2.0, 0.03); c.add(kb); c.box(1.68, 1.08, 0.04, MAT.chrome, 0, 2.0, 0.0); }
    /* 06-props.js */
    function certificateBuild(c) { c.box(0.3, 0.4, 0.02, MAT.wood, 0, 2.4, 0); c.sign(['CERTIFICATE', 'of registration', 'Depot Co. · 3PL'], 0.26, 0.36, 0, 2.4, 0.012, 0, { w: 192, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 22 }); }
    /* 06-props.js */
    function shedTableBuild(c, P) {
        SPOT.bench = { x: P.x, z: P.z }; SPOT.benchOut = { x: P.x, z: P.z };
        var TAN = std({ color: 0xc9a46a, roughness: 0.8 }), TOP = std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood });
        c.box(1.7, 0.05, 0.8, TOP, 0, 0.9, 0); c.box(1.6, 0.04, 0.05, MAT.steelDark, 0, 0.86, -0.36); c.box(1.6, 0.04, 0.05, MAT.steelDark, 0, 0.86, 0.36);
        [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]].forEach(function (o) { var leg = c.box(0.05, 0.86, 0.05, MAT.steelDark, o[0], 0.43, o[1]); leg.rotation.x = o[1] < 0 ? 0.12 : -0.12; });
        c.box(1.5, 0.04, 0.04, MAT.steelDark, 0, 0.3, 0); c.solid(-0.85, 0.85, -0.42, 0.42, 0, 0.95);
        var tgn = new THREE.Group(); tgn.position.set(0.55, 0.92, 0.2); tgn.rotation.y = 0.6; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, MAT.steelDark, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2;
        c.cyl(0.055, 0.048, TAN, 0.7, 0.944, -0.25, 16); c.box(0.26, 0.02, 0.26, MAT.steelDark, -0.62, 0.935, -0.2); c.box(0.22, 0.012, 0.22, std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), -0.62, 0.95, -0.2);
        c.box(0.14, 0.02, 0.03, MAT.yellow, -0.3, 0.935, -0.3).rotation.y = 0.3; c.cyl(0.008, 0.14, MAT.black, -0.15, 0.93, -0.28, 8).rotation.z = Math.PI / 2;
        c.box(0.6, 0.09, 0.6, std({ color: 0xb08a5a, roughness: 1 }), 0, 0.36, 0).rotation.y = 0.05;   /* flat cardboard on the stretcher */
        c.hit(1.9, 1.1, 1.0, 0, 0.6, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
        // the clipboard: the office until there is one. E opens Depot OS, with what the level allows on it
        var cb = new THREE.Group(); cb.position.set(-0.1, 0.925, 0.22); cb.rotation.y = -0.25; c.add(cb); box(0.24, 0.012, 0.32, MAT.black, 0, 0, 0, cb); box(0.21, 0.006, 0.28, MAT.paper, 0, 0.01, 0.01, cb); box(0.09, 0.025, 0.03, MAT.steelDark, 0, 0.02, -0.14, cb); cyl(0.004, 0.14, MAT.blue, 0.06, 0.02, 0.02, cb, 6).rotation.x = Math.PI / 2;
        hitBox(0.36, 0.2, 0.42, 0, 0.05, 0, { prompt: function () { return 'The paperwork · orders, the shop, the crew' + (unlocked('loan') ? ', the bank' : '') + ' · E opens Depot OS'; }, use: function () { if (!driving && !pc.on) { openPanel('pc', 'orders'); introStep('pc'); } } }, cb);
        c.sign(['PACKING'], 0.6, 0.16, 0, 1.25, -0.44, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); c.cyl(0.012, 0.3, MAT.steelDark, 0, 1.08, -0.44, 6);
      }
    /* 06-props.js */
    function flaskBuild(c) { c.cyl(0.07, 0.3, std({ color: 0xc8342a, roughness: 0.35, metalness: 0.3 }), 0, 1.07, 0, 14); c.cyl(0.045, 0.05, MAT.black, 0, 1.245, 0, 12); c.cyl(0.03, 0.06, MAT.chrome, 0.09, 1.15, 0, 8).rotation.z = 0.5; c.cyl(0.035, 0.08, MAT.white, 0.16, 0.96, 0.05, 10); c.hit(0.3, 0.4, 0.3, 0.04, 1.1, 0, { prompt: function () { return buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working until ' + fmtTime(buff.coffeeUntil) : 'Pour a coffee from the flask (walk faster for an hour)'; }, use: function () { drinkCoffee(); } }); }
    /* 06-props.js */
    function benchBuild(c, P) {
        if (BOOT_STAGE === 0) { shedTableBuild(c, P); return; }
        SPOT.bench = { x: P.x, z: P.z }; SPOT.benchOut = { x: P.x + Math.sin(P.rot * Math.PI / 2) * 2.0, z: P.z + Math.cos(P.rot * Math.PI / 2) * 2.0 };
        c.box(1.0, 0.08, 3.2, MAT.wood, 0, 0.9, 0); [[-0.45, -1.5], [0.45, -1.5], [-0.45, 1.5], [0.45, 1.5]].forEach(function (o) { c.box(0.06, 0.9, 0.06, MAT.steelDark, o[0], 0.45, o[1]); }); c.box(0.9, 0.04, 3.0, MAT.steelDark, 0, 0.3, 0); c.solid(-0.5, 0.5, -1.6, 1.6, 0, 1);
        // the kit lives at the two ends: the box stacks take local z -0.95 to 1.3, and anything under them was never seen
        var TAN = std({ color: 0xc9a46a, roughness: 0.8 }), CARD = std({ color: 0xb08a5a, roughness: 1 }), TRAY = std({ color: 0x3a4149, roughness: 0.6 });
        // near end: a platform scale with its readout turned to the worker
        c.box(0.3, 0.03, 0.3, MAT.steelDark, 0.28, 0.955, -1.2); c.box(0.26, 0.012, 0.26, std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), 0.28, 0.976, -1.2); c.box(0.04, 0.24, 0.04, MAT.steelDark, 0.42, 1.09, -1.2);
        var sgp = new THREE.Group(); sgp.position.set(0.4, 1.23, -1.2); sgp.rotation.order = 'YXZ'; sgp.rotation.y = -Math.PI / 2; sgp.rotation.x = -0.25; c.add(sgp); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, sgp); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, sgp);
        // a tape gun standing on its head, two spare rolls beside it
        var tgn = new THREE.Group(); tgn.position.set(-0.2, 0.94, -1.12); tgn.rotation.y = 0.6; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, MAT.steelDark, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2; box(0.05, 0.02, 0.05, MAT.steelDark, 0.03, 0.01, 0.11, tgn); cyl(0.012, 0.05, MAT.rubber, 0.03, 0.012, 0.085, tgn, 8).rotation.z = Math.PI / 2;
        c.cyl(0.055, 0.048, TAN, 0.06, 0.964, -1.48, 16); c.cyl(0.055, 0.048, TAN, 0.08, 1.012, -1.47, 16).rotation.y = 0.4; c.cyl(0.03, 0.05, MAT.white, 0.06, 1.012, -1.48, 12);
        // a parts tray: box cutter, marker, a roll of labels
        c.box(0.26, 0.03, 0.18, TRAY, -0.3, 0.955, -1.45); c.box(0.23, 0.014, 0.15, MAT.black, -0.3, 0.972, -1.45); c.box(0.14, 0.02, 0.03, MAT.yellow, -0.33, 0.99, -1.48).rotation.y = 0.3; c.cyl(0.008, 0.14, MAT.black, -0.27, 0.988, -1.41, 8).rotation.z = Math.PI / 2; c.cyl(0.03, 0.04, MAT.white, -0.22, 1.0, -1.49, 12);
        // the label printer at the near corner, a strip of labels hanging out toward the worker
        c.box(0.2, 0.12, 0.16, MAT.white, 0.28, 1.0, -1.5); c.box(0.21, 0.02, 0.17, std({ color: 0x8b949c, roughness: 0.5 }), 0.28, 0.95, -1.5); c.box(0.004, 0.09, 0.07, MAT.paper, 0.17, 0.985, -1.5); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.2, 1.05, -1.42);
        // far end: the task lamp and a roll of bubble wrap on a rod between two brackets
        c.cyl(0.02, 0.9, MAT.steelDark, -0.4, 1.4, 1.4, 8); c.box(0.3, 0.08, 0.15, MAT.lamp, -0.3, 1.85, 1.4);
        [-0.3, 0.3].forEach(function (bx) { c.box(0.03, 0.3, 0.03, MAT.steelDark, bx, 1.09, 1.5); c.box(0.08, 0.02, 0.08, MAT.steelDark, bx, 0.95, 1.5); }); c.cyl(0.012, 0.66, MAT.chrome, 0, 1.25, 1.5, 8).rotation.z = Math.PI / 2;
        c.cyl(0.11, 0.5, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.85 }), 0, 1.25, 1.5, 18).rotation.z = Math.PI / 2; c.plane(0.48, 0.26, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.7, side: THREE.DoubleSide }), 0, 1.07, 1.615, 0, 0);
        // the shelf below: flat cardboard and a bale of folded boxes
        c.box(0.7, 0.12, 0.8, CARD, 0, 0.38, -0.6); c.box(0.66, 0.02, 0.76, TAN, 0, 0.45, -0.6); c.box(0.6, 0.09, 0.7, CARD, 0.02, 0.365, 0.7).rotation.y = 0.05; c.box(0.02, 0.1, 0.72, MAT.black, -0.2, 0.37, 0.7); c.box(0.02, 0.1, 0.72, MAT.black, 0.2, 0.37, 0.7);
        var tl = new THREE.PointLight(0xfff0d0, 0.45, 5, 2); tl.position.set(-0.3, 1.7, 1.4); c.add(tl);   // the task lamp lights the far end of the bench
        c.hit(1.1, 1.2, 3.2, 0, 1.4, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
        // the terminal: a floor stand on the east corner past the near end, screen at 1.7 m turned to face the working side across the
        // end of the bench, so it clears the box stacks and never stands in the walkway. It used to hang over the bench top at 1.45 m,
        // where two layers of boxes hid it and the bench's own hit box took the focus.
        var tg = new THREE.Group(); tg.position.set(0.35, 0, -2.0); tg.rotation.y = -Math.PI * 3 / 8; c.add(tg);
        cyl(0.28, 0.03, MAT.steelDark, 0, 0.015, -0.04, tg, 20); cyl(0.24, 0.02, MAT.rubber, 0, 0.04, -0.04, tg, 20); cyl(0.035, 1.72, MAT.steelDark, 0, 0.89, -0.08, tg, 10); box(0.14, 0.2, 0.07, MAT.steelDark, 0, 1.75, -0.06, tg);
        box(1.0, 0.76, 0.03, MAT.black, 0, 1.75, -0.02, tg); box(0.5, 0.02, 0.14, MAT.steelDark, 0, 1.3, 0.02, tg); box(0.06, 0.04, 0.12, MAT.black, 0.14, 1.33, 0.02, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.46, 1.44, 0.0, tg);
        var scr = touchScreen({ w: 400, h: 300, res: 3, pw: 0.9, ph: 0.675, x: 0, y: 1.75, z: 0, ry: 0, parent: tg, title: 'Bench terminal', draw: benchScreenDraw }); scr.mesh.userData.propId = 'bench'; scr.scrollable = true; scr.scroll = 0;
        c.solid(0.1, 0.6, -2.25, -1.75, 0, 2.3);
        // the stool
        c.cyl(0.17, 0.04, MAT.black, -1.0, 0.65, -0.4, 16); c.cyl(0.02, 0.6, MAT.chrome, -1.0, 0.32, -0.4, 8); c.cyl(0.2, 0.03, MAT.steelDark, -1.0, 0.03, -0.4, 16);
      }
    /* 06-props.js */
    function benchScreenDraw(c, sc) {
        var allO = openOrders().sort(function (a, b2) { return (b2.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b2.due; }); sc.scrollMax = Math.max(0, allO.length - 4); sc.scroll = clamp(sc.scroll || 0, 0, sc.scrollMax);
        scBg(c, sc.w, sc.h); scHead(c, sc.w, 'PACKING', benchCount() + ' / ' + benchCapNow() + ' on the bench · ' + allO.length + ' open');
        var os = allO.slice(sc.scroll, sc.scroll + 4), y = 56;
        if (!os.length) scText(c, 16, 76, 'No open orders.', '#a0acb8', 14);
        os.forEach(function (o) { var n = orderNeed(o); scText(c, 16, y + 12, '#' + o.num + ' ' + clientName(o.client).slice(0, 16) + (o.rush ? ' RUSH' : '') + (o.late ? ' LATE' : ''), o.late || o.rush ? '#ff6b5e' : '#eef1f5', 13); scText(c, 16, y + 28, o.lines.map(function (l) { return Math.min(l.qty, S.bench.boxes[l.sku] || 0) + '/' + l.qty + ' ' + skuName(l.sku).slice(0, 12); }).join(' · ').slice(0, 44), '#a0acb8', 11); var can = canPack(o), short = canPackShort(o); scButton(sc, 300, y + 4, 86, 32, can ? 'PACK' : short ? 'SHORT' : n.have + '/' + n.tot, can || short, function () { if (packOrder(o)) toast('Packed #' + o.num, 'good'); }, can ? '#5fd38d' : '#f5b53d'); y += 46; });
        if (sc.scrollMax > 0) { scText(c, 16, 290, 'Orders ' + (sc.scroll + 1) + ' to ' + Math.min(allO.length, sc.scroll + 4) + ' of ' + allO.length + ' · wheel scrolls', '#6b7784', 10); scButton(sc, 300, 262, 40, 26, 'UP', sc.scroll > 0, function () { sc.scroll = Math.max(0, sc.scroll - 1); }, '#f5b53d'); scButton(sc, 346, 262, 40, 26, 'DOWN', sc.scroll < sc.scrollMax, function () { sc.scroll = Math.min(sc.scrollMax, sc.scroll + 1); }, '#f5b53d'); }
        else scText(c, 16, 290, 'Look at a box on the bench to take it back · the cart takes surplus', '#6b7784', 10);
        var surN = surplusCount(); scButton(sc, 116, 258, 118, 26, surN ? 'RETURN ' + surN + ' SURPLUS' : 'NO SURPLUS', surN > 0, function () { returnSurplus(); }, '#f5b53d');
        if (S.up.plantAuto) { var autoOn = !S.pack || S.pack.auto !== false; scButton(sc, 16, 258, 92, 26, 'AUTO ' + (autoOn ? 'ON' : 'OFF'), true, function () { if (!S.pack) return; S.pack.auto = autoOn ? false : true; toast('Pack line auto-start ' + (autoOn ? 'off' : 'on'), autoOn ? 'bad' : 'good'); }, autoOn ? '#5fd38d' : '#ff6b5e'); }
      }
    /* 06-props.js */
    function shelterBuild(c) {
        var FR = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        [[-1.7, -2.2], [-1.7, 2.2], [1.7, -2.2], [1.7, 2.2]].forEach(function (p) { c.box(0.08, 2.5, 0.08, FR, p[0], 1.25, p[1]); c.box(0.2, 0.02, 0.2, FR, p[0], 0.01, p[1]); });
        c.box(3.6, 0.06, 4.6, FR, 0, 2.5, 0); c.box(3.8, 0.04, 4.8, std({ color: 0x2a2f35, roughness: 0.7 }), 0, 2.56, 0); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, 2.4); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, -2.4); c.box(0.06, 0.1, 4.8, FR, -1.9, 2.5, 0); c.box(0.06, 0.1, 4.8, FR, 1.9, 2.5, 0);
        c.plane(4.4, 2.3, GL, -1.7, 1.3, 0, 0, Math.PI / 2); c.plane(1.6, 2.3, GL, -0.9, 1.3, -2.2, 0, 0); c.plane(1.6, 2.3, GL, 0.9, 1.3, -2.2, 0, 0); c.box(0.08, 2.5, 0.08, FR, -1.7, 1.25, 0); c.box(0.06, 0.06, 4.4, FR, -1.7, 0.95, 0); c.box(3.4, 0.06, 0.06, FR, 0, 0.95, -2.2);
        for (var sl = 0; sl < 5; sl++) c.box(2.4, 0.04, 0.08, MAT.wood, 0, 0.46, -1.9 + sl * 0.095); for (var sb = 0; sb < 3; sb++) { var bb = c.box(2.4, 0.04, 0.09, MAT.wood, 0, 0.7 + sb * 0.12, -2.04 - sb * 0.04); bb.rotation.x = -0.2; } [-1.0, 1.0].forEach(function (bx) { c.box(0.05, 0.44, 0.44, FR, bx, 0.22, -1.72); c.box(0.05, 0.5, 0.06, FR, bx, 0.75, -2.08).rotation.x = -0.2; });
        c.cyl(0.11, 1.0, FR, 1.3, 0.5, 1.6, 12); c.cyl(0.13, 0.08, FR, 1.3, 1.02, 1.6, 12); c.cyl(0.1, 0.02, std({ color: 0x8a8a8a, roughness: 0.5 }), 1.3, 1.065, 1.6, 12); c.cyl(0.14, 0.02, FR, 1.3, 0.01, 1.6, 12);
        c.sign(['SMOKING AREA', 'please use the ashtray'], 0.9, 0.3, 0, 2.05, -2.17, 0, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign(['NO SMOKING', 'beyond this shelter'], 0.9, 0.3, -1.67, 2.05, 0, Math.PI / 2, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' });
        c.solid(-1.8, -1.6, -2.3, 2.3, 0, 2.6); c.solid(-1.8, 1.8, -2.3, -2.1, 0, 2.6); c.solid(-1.3, 1.3, -2.1, -1.5, 0, 1.0); c.solid(1.1, 1.5, 1.4, 1.8, 0, 1.1);
      }
    /* 06-props.js */
    function dumpsterBuild(c) { c.box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 0, 0.65, 0); var dl = c.box(1.9, 0.08, 1.3, MAT.black, 0, 1.52, -0.2); dl.rotation.x = -0.35; [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (w) { c.cyl(0.08, 0.06, MAT.black, w[0], 0.08, w[1], 10).rotation.z = Math.PI / 2; }); c.box(0.1, 0.1, 0.4, MAT.steelDark, -0.95, 0.9, 0); c.box(0.1, 0.1, 0.4, MAT.steelDark, 0.95, 0.9, 0); c.sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 0, 0.9, -0.62, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' }); c.solid(-0.95, 0.95, -0.65, 0.65, -2, 2); }
    /* 06-props.js */
    function flagBuild(c) { c.cyl(0.05, 9, MAT.chrome, 0, 4.5, 0, 8, 0.07); c.sphere(0.1, MAT.yellow, 0, 9.05, 0); var fg = new THREE.Group(); fg.position.set(0, 8.3, 0); fg.userData.dynamic = true; c.add(fg); yard.flag = fg; var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag; }
    /* 06-props.js */
    function parkingSignBuild(c) { c.cyl(0.04, 2.4, MAT.steelDark, 0, 1.2, 0, 6); c.sign(['STAFF', 'PARKING'], 0.9, 0.6, 0, 2.5, 0, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' }); }
    /* 06-props.js */
    var BARK = std({ color: 0x5a4634, roughness: 1, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.8, 0.8) });
    /* 06-props.js */
    var LEAF = [std({ color: 0x3f6f2e, roughness: 1, flatShading: true }), std({ color: 0x5c8f44, roughness: 1, flatShading: true }), std({ color: 0x4a7d33, roughness: 1, flatShading: true })];
    /* 06-props.js */
    function canopy(c, r, x, y, z, mat, rnd) { rnd = rnd || Math.random; var g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position; for (var i = 0; i < p.count; i++) { var k = 1 + (rnd() - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.8 + rnd() * 0.3), p.getZ(i) * k); } g.computeVertexNormals(); var m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; c.group.add(m); return m; }
    /* 06-props.js */
    function treeBuild(c, P, inst) {
        // the tree's size, lean and leaf jitter come from its own seed: a tree used to grow or shrink at every move, turn and reload
        var id = inst ? inst.id : 'tree', s = seededF(id, 1, 0.85, 1.25), lean = seededF(id, 2, -0.06, 0.06), seed = Math.floor(propSeed(id, 3) * 2147483647) || 1, rnd = function () { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        var trunk = c.cyl(0.11 * s, 2.8 * s, BARK, 0, 1.4 * s, 0, 9, 0.2 * s); trunk.rotation.z = lean;
        var l1 = c.cyl(0.05 * s, 1.1 * s, BARK, 0.35 * s, 2.5 * s, 0.1 * s, 6, 0.09 * s); l1.rotation.z = -0.7; var l2 = c.cyl(0.05 * s, 0.9 * s, BARK, -0.3 * s, 2.7 * s, -0.2 * s, 6, 0.08 * s); l2.rotation.z = 0.8; l2.rotation.x = 0.4;
        canopy(c, 1.35 * s, 0, 3.4 * s, 0, LEAF[0], rnd); canopy(c, 1.0 * s, 0.8 * s, 3.0 * s, 0.4 * s, LEAF[1], rnd); canopy(c, 0.95 * s, -0.75 * s, 3.2 * s, -0.5 * s, LEAF[2], rnd); canopy(c, 0.8 * s, 0.1 * s, 4.3 * s, 0.1 * s, LEAF[1], rnd); canopy(c, 0.7 * s, -0.2 * s, 2.6 * s, 0.8 * s, LEAF[0], rnd);
        c.solid(-0.2, 0.2, -0.2, 0.2, -2, 2);
      }
    /* 06-props.js */
    function bollardBuild(c) { c.cyl(0.11, 1.0, MAT.yellow, 0, 0.5, 0, 10); c.cyl(0.14, 0.05, MAT.black, 0, 0.025, 0, 10); c.solid(-0.12, 0.12, -0.12, 0.12, -2, 1); }
    /* 06-props.js */
    function benchSeatBuild(c) { for (var sl = 0; sl < 4; sl++) c.box(1.6, 0.04, 0.07, MAT.wood, 0, 0.45, -0.14 + sl * 0.09); c.box(1.6, 0.04, 0.3, MAT.wood, 0, 0.85, 0.16).rotation.x = -0.2; [[-0.65], [0.65]].forEach(function (p) { c.box(0.06, 0.45, 0.4, MAT.steelDark, p[0], 0.22, 0); c.box(0.06, 0.5, 0.06, MAT.steelDark, p[0], 0.65, 0.18); }); c.solid(-0.8, 0.8, -0.25, 0.25, -2, 1); }
    /* 06-props.js */
    function timeclockBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        var hous = new THREE.Mesh(bevelGeo(0.4, 0.56, 0.12, 0.02), LG); hous.position.set(0, 1.5, 0); hous.castShadow = true; c.group.add(hous); c.box(0.42, 0.03, 0.14, DG, 0, 1.79, 0); c.box(0.42, 0.03, 0.14, DG, 0, 1.21, 0);
        c.box(0.34, 0.36, 0.01, MAT.black, 0, 1.52, 0.05); c.box(0.14, 0.012, 0.03, MAT.black, 0, 1.28, 0.07); c.box(0.12, 0.004, 0.01, MAT.chrome, 0, 1.283, 0.08); tclock.lamp = c.box(0.03, 0.03, 0.02, glowMat(0x39d353, 1.2), 0.15, 1.72, 0.065); c.box(0.03, 0.03, 0.02, glowMat(0xff3b2f, 0.3), -0.15, 1.72, 0.065);
        c.box(0.5, 0.56, 0.08, DG, 0.58, 1.5, -0.02); c.box(0.48, 0.02, 0.06, LG, 0.58, 1.75, 0.0); for (var k = 0; k < 8; k++) { c.box(0.07, 0.15, 0.03, MAT.paper, 0.4 + Math.floor(k / 4) * 0.12 + 0.06 * (k % 2 ? 0 : 0), 1.62 - (k % 4) * 0.13, 0.04); } c.box(0.5, 0.02, 0.03, DG, 0.58, 1.26, 0.03);
        c.sign(['CLOCK IN · CLOCK OUT'], 0.86, 0.14, 0.3, 1.9, 0.0, 0, { w: 384, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['CARDS'], 0.3, 0.08, 0.58, 1.19, 0.05, 0, { w: 128, h: 40, bg: '#f5b53d', fg: '#1a1205' });
        c.cyl(0.012, 0.6, MAT.black, 0.18, 1.0, 0.0, 6);
        touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0, y: 1.5, z: 0.07, ry: 0, parent: c.group, title: 'Time clock', draw: drawTimeClock });
      }
    /* 06-props.js */
    function consoleBuild(di) { return function (c) {
        var dir = DOOR_MAP[di].dir, inbound = dir === 'in', ret = dir === 'ret', k = DOOR_MAP[di].dock, lane = inbound || ret ? null : MODES[TRUCK_OUT[k].mode];
        var hous = new THREE.Mesh(bevelGeo(0.5, 0.62, 0.12, 0.02), MAT_MACH.panel); hous.position.set(0, 1.45, 0); hous.castShadow = true; c.group.add(hous); c.box(0.44, 0.34, 0.01, MAT.black, 0, 1.47, 0.05); c.box(0.54, 0.04, 0.14, inbound ? MAT.hazard : MAT.yellow, 0, 1.78, 0); c.box(0.54, 0.04, 0.14, MAT_MACH.frame, 0, 1.12, 0); c.cyl(0.012, 1.0, MAT.black, 0, 0.6, -0.03, 6); c.cyl(0.03, 0.03, MAT.red, -0.17, 1.22, 0.07, 10).rotation.x = Math.PI / 2; c.box(0.05, 0.05, 0.02, MAT.yellow, -0.17, 1.22, 0.06); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), 0.17, 1.22, 0.065); c.box(0.08, 0.06, 0.04, MAT_MACH.frame, 0, 1.08, -0.02);
        touchScreen({ w: 320, h: 240, pw: 0.4, ph: 0.3, x: 0, y: 1.47, z: 0.065, ry: 0, parent: c.group, title: 'Dock console ' + dockLabel(di), draw: function (cc, sc) {
          scBg(cc, sc.w, sc.h, inbound || ret ? 'rgba(245,181,61,0.16)' : 'rgba(95,211,141,0.16)'); scHead(cc, sc.w, 'DOCK ' + dockLabel(di), lane ? lane.name.toUpperCase() + ' LANE' : undefined);
          var t = truckAtDoor(di);
          if (ret) {
            if (t) { var ra = (t.returns || []).length; scText(cc, 16, 66, 'Returns truck docked · ' + t.driver, '#f5b53d', 14); scText(cc, 16, 86, ra + ' return' + (ra === 1 ? '' : 's') + ' still aboard · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, retFeedWorks(t) ? 'The belt is taking them in' : !S.doors[di] ? 'Door down: the belt waits' : !powered() ? 'No power: the belt is stopped' : 'The belt is starting', retFeedWorks(t) ? '#5fd38d' : '#ff6b5e', 13); }
            else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, isSunday() ? 'Closed Sunday' : 'The returns truck comes at ' + TRUCK_RET.map(fmtTime).join(' and ') + ' daily', '#eef1f5', 13); }
            scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
            var qn = rdesk().queue.length; scButton(sc, 164, 128, 140, 40, qn + ' in the queue', false, function () { scanToggle(true); scanPage(1); });
            scText(cc, 16, 190, rdesk().done + ' returns inspected so far · ' + rdesk().shelf.length + ' box' + (rdesk().shelf.length === 1 ? '' : 'es') + ' in the cage', '#a0acb8', 11);
          } else if (inbound) {
            if (t) { var left = S.pallets.filter(function (q) { return q.place === 'truck' && q.truck === t.id; }).length; scText(cc, 16, 66, 'Truck docked · ' + t.driver + ' · ' + clientName(t.client), '#f5b53d', 14); scText(cc, 16, 86, left + ' of ' + t.pallets.length + ' pallets still on it · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, t.signed ? 'Delivery note signed' : 'NOT SIGNED: see the driver outside', t.signed ? '#5fd38d' : '#ff6b5e', 13); }
            else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Inbound slots: ' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 || k !== 1 ? '' : ' (buy the second bay)'), '#eef1f5', 13); }
            scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
            var pending = S.pallets.filter(function (q) { return q.place === 'floor'; }).length; scButton(sc, 164, 128, 140, 40, pending + ' on the floor', false, function () { scanToggle(true); scanPage(3); });
            if (t && !t.signed) scButton(sc, 16, 176, 288, 36, 'SIGN THE DELIVERY NOTE', true, function () { signTruck(t); var dm = truckMeshes[t.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); }, '#5fd38d');   // from the console, no walk to the driver
          } else {
            var nxt = outNext(k);
            if (!dockOwned(k)) { scText(cc, 16, 66, 'Not in service', '#ff6b5e', 15); scText(cc, 16, 86, 'The air dock opens with the sortation deck (shop)', '#eef1f5', 13); }
            else if (t) { scText(cc, 16, 66, 'Truck docked · ' + t.driver, '#5fd38d', 15); scText(cc, 16, 86, t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scButton(sc, 16, 104, 288, 44, t.parcels.length ? 'DISPATCH NOW' : 'nothing loaded', t.parcels.length > 0, function () { consoleUse(di); }, '#5fd38d'); }
            else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, (isSunday() ? 'Closed Sunday · ' : 'Next: ' + fmtTime(nxt.arrive) + ' to ' + fmtTime(nxt.leave) + (nxt.tomorrow ? ' tomorrow' : '')) + ' · ' + outWindows(k).map(function (w) { return fmtTime(w.arrive); }).join(' and ') + ' daily', '#eef1f5', 13); }
            scButton(sc, 16, 160, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
            var packed = S.orders.filter(function (o) { return o.state === 'packed' && orderMode(o) === lane.id; }).length; scButton(sc, 164, 160, 140, 40, packed + ' ' + lane.name.toLowerCase() + ' packed', false, function () { scanToggle(true); scanPage(5); });
            scText(cc, 16, 212, (S.stats.misrouted || 0) + ' parcels out of the wrong door so far', '#a0acb8', 11);
          }
          scText(cc, 16, 226, S.events.power ? 'NO POWER' : 'mains ok', S.events.power ? '#ff6b5e' : '#5fd38d', 11);
        } });
        c.sign([ret ? 'RETURNS DOCK' : 'DOCK ' + dockLabel(di)], ret ? 1.0 : 0.7, 0.18, 0, 1.95, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: inbound || ret ? '#f5b53d' : '#5fd38d' });
      }; }
    /* 06-props.js */
    function breakerBuild(c) {
        var LG = std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }); var box2 = new THREE.Mesh(bevelGeo(0.46, 0.7, 0.14, 0.02), LG); box2.position.set(0, 1.5, 0); box2.castShadow = true; c.group.add(box2);
        c.box(0.4, 0.62, 0.012, std({ color: 0xcfd4d9, roughness: 0.5 }), 0, 1.5, 0.075); c.box(0.025, 0.08, 0.02, MAT.chrome, 0.16, 1.5, 0.085); c.box(0.4, 0.02, 0.016, MAT_MACH.frame, 0, 1.2, 0.075);
        c.box(0.1, 0.22, 0.03, MAT.black, 0, 1.52, 0.09); c.box(0.06, 0.12, 0.04, MAT.red, 0, 1.55, 0.11); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), -0.12, 1.7, 0.085); c.box(0.08, 0.06, 0.002, MAT.paper, 0.1, 1.7, 0.082);
        c.sign(['⚡ DANGER 400 V'], 0.3, 0.07, 0, 1.32, 0.085, 0, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.cyl(0.02, 0.5, MAT.black, -0.1, 2.1, -0.02, 6); c.cyl(0.02, 0.5, MAT.black, 0.1, 2.1, -0.02, 6);
        c.hit(0.5, 0.7, 0.2, 0, 1.5, 0.05, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } }); c.sign(['MAIN BREAKER'], 0.6, 0.15, 0, 1.95, 0.01, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' });
      }
    /* 06-props.js */
    function boardBuild(c) {
        var cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; world.boardCtx = cv.getContext('2d');
        world.boardTex = new THREE.CanvasTexture(cv); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
        c.cyl(0.03, 2.8, MAT.steelDark, -1.0, 5.6, 0, 6); c.cyl(0.03, 2.8, MAT.steelDark, 1.0, 5.6, 0, 6); c.box(3.1, 0.06, 0.1, MAT.steelDark, 0, 4.2, 0);
        c.box(3.1, 1.6, 0.08, MAT.black, 0, 3.35, 0); var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(0, 3.35, 0.05); c.add(board); var back = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); back.position.set(0, 3.35, -0.05); back.rotation.y = Math.PI; c.add(back);
        // on the screens list so the wheel pages it when you look up at it and it redraws itself as its pages turn; no buttons, so no E prompt
        world.boardScreen = { w: 768, h: 384, ctx: world.boardCtx, tex: world.boardTex, mesh: board, zones: [], draw: function (cx, sc) { drawBoard(sc); }, cur: null, ripple: 0, title: 'Order board', dirty: true, scrollable: true, scroll: 0, scrollMax: 0, autoPage: true }; screens.push(world.boardScreen);
        drawBoard();
      }
    /* 06-props.js */
    function chargerBuild(c) {
        var CB = std({ color: 0x8b949c, roughness: 0.5, metalness: 0.4 });
        c.box(0.9, 1.1, 0.32, CB, 0, 1.55, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 2.12, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 0.98, -0.14);
        for (var vv = 0; vv < 6; vv++) c.box(0.3, 0.012, 0.02, MAT.black, -0.22, 1.9 - vv * 0.04, 0.03); for (var vw = 0; vw < 6; vw++) c.box(0.3, 0.012, 0.02, MAT.black, 0.22, 1.9 - vw * 0.04, 0.03);
        dress.charger = c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), -0.35, 1.3, 0.03); 
        c.sign(['CHARGING POINT'], 0.8, 0.14, 0, 2.0, 0.03, 0, { w: 512, h: 96, bg: '#1b232c', fg: '#5fd38d' }); c.sign(['24 V · ISOLATE BEFORE SERVICE'], 0.8, 0.07, 0, 1.08, 0.03, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
        [-0.28].forEach(function (rx) { var reel = c.cyl(0.14, 0.12, MAT.black, rx, 0.75, -0.1, 16); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.14, MAT.steelDark, rx, 0.75, -0.1, 10).rotation.x = Math.PI / 2; var cab = c.cyl(0.018, 0.9, MAT.black, rx, 0.35, 0.3, 6); cab.rotation.x = 1.1; });
        c.box(0.18, 0.6, 0.18, MAT.steelDark, -0.5, 0.3, 0.55); c.box(0.22, 0.04, 0.22, MAT.yellow, -0.5, 0.62, 0.55); c.box(0.1, 0.08, 0.06, MAT.red, -0.5, 0.5, 0.65); c.box(0.1, 0.08, 0.06, MAT.blue, -0.5, 0.36, 0.65);
        c.sign(['FORKLIFT'], 0.2, 0.05, -0.5, 0.28, 0.65, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
        c.box(1.1, 0.03, 0.08, MAT.hazard, 0, 0.015, 0.2); c.solid(-0.5, 0.5, -0.3, 0.7, 0, 2.2);
        c.hit(1.0, 1.3, 0.5, 0, 1.5, 0.05, { prompt: function () { return cablePrompt('fork'); }, use: function () { cableUse('fork'); } });
        touchScreen({ w: 200, h: 80, pw: 0.4, ph: 0.16, x: 0.05, y: 1.3, z: 0.035, ry: 0, parent: c.group, title: 'Charger display', draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.2)'); var b = Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100); scText(cc, 10, 30, S.fork.plugged ? (b >= 100 ? 'FORKLIFT · FULL' : 'CHARGING · ' + b + '%') : 'FORKLIFT · ' + b + '% · unplugged', S.fork.plugged ? '#5fd38d' : '#f5b53d', 18); cc.fillStyle = 'rgba(255,255,255,0.12)'; cc.fillRect(10, 48, 180, 14); cc.fillStyle = b < 20 ? '#ff6b5e' : '#5fd38d'; cc.fillRect(10, 48, 1.8 * b, 14); } });
        var w = 2.6, d = 3.2, cz = 2.6; [[0, cz - d / 2, w, 0.08], [0, cz + d / 2, w, 0.08], [-w / 2, cz, 0.08, d], [w / 2, cz, 0.08, d]].forEach(function (ln) { c.plane(ln[2], ln[3], MAT.yellowLine, ln[0], 0.0062, ln[1], -Math.PI / 2, 0); }); c.plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex(['FORKLIFT'], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), 0, 0.0066, cz - d / 2 + 0.3, -Math.PI / 2, 0);
      }
    /* 06-props.js */
    function lampPostBuild(c) { c.cyl(0.08, 7.5, MAT.steelDark, 0, 3.75, 0, 8, 0.11); c.box(0.6, 0.2, 0.3, MAT.steelDark, 0, 7.65, 0); var lens = c.box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), 0, 7.53, 0); yard.lampLenses.push(lens); var l = new THREE.PointLight(0xffd9a0, 0.0, 36, 2); l.position.set(0, 7.4, 0); l.userData.k = 1.4; c.add(l); yardLights.push(l); c.box(0.3, 0.2, 0.3, MAT.grey, 0, 0.1, 0); c.solid(-0.15, 0.15, -0.15, 0.15, -2, 2); }
    /* 06-props.js */
    function carBuild(k) { return function (c) { c.add(carMesh(typeof k === "number" ? CAR_COLS[k % CAR_COLS.length] : k)); c.solid(-2.2, 2.2, -1.0, 1.0, -2, 1.5); }; }
    /* 06-props.js */
    function paintedBuild(c) { c.sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, 0.01, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d', plate: false }); c.sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8', plate: false }); }
    /* 06-props.js */
    function aisleSignBuild(text) { return function (c) { c.sign([text], 2.2, 0.5, 0, 5.4, 0, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([text], 2.2, 0.5, 0, 5.4, 0, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, 0, 4); c.cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, 0, 4); }; }
    /* 06-props.js */
    var treeN = 0;
    /* 06-props2-factory.js */
    var WING = { x0: -14, x1: 10, z0: -HALL.z - 20, z1: -HALL.z, h: 6, door: { x0: 4, x1: 7.6, h: 4.2 }, belt: { x0: -5, x1: -3, h: 2.0 } };
    /* 06-props2-factory.js */
    function inWing(x, z) { return stageHas('wing') && x > WING.x0 && x < WING.x1 && z > WING.z0 && z < WING.z1; }
    /* 06-props2-factory.js */
    var MAT_MACH = { frame: std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), panel: std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), guard: std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), blue: std({ color: 0x2f5f9e, roughness: 0.45, metalness: 0.4 }), roller: std({ color: 0x8d9298, roughness: 0.3, metalness: 0.8 }), rubber: std({ color: 0x1c1e22, roughness: 0.95 }) };
    /* 06-props2-factory.js */
    var beltTexBase = tex(64, 64, function (c, w, h) { c.fillStyle = '#23262a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2c3035'; for (var i = 0; i < 8; i++) c.fillRect(0, i * 8, w, 3); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 28, w, 4); grain(c, w, h, 300, 0.08); }, 1, 1);
    /* 06-props2-factory.js */
    function lampStack(c, x, y, z) {
        c.cyl(0.02, 0.5, MAT_MACH.frame, x, y + 0.25, z, 6); var g = c.cyl(0.05, 0.08, glowMat(0x5fd38d, 1.4), x, y + 0.56, z, 10), a = c.cyl(0.05, 0.08, glowMat(0xf5b53d, 1.4), x, y + 0.65, z, 10), r = c.cyl(0.05, 0.08, glowMat(0xff3b2f, 1.4), x, y + 0.74, z, 10); c.cyl(0.055, 0.03, MAT.black, x, y + 0.8, z, 10);
        g.visible = false; a.visible = true; r.visible = false; return { g: g, a: a, r: r };
      }
    /* 06-props2-factory.js */
    function conveyorBuild(c, x, z0, z1, opt) {
        opt = opt || {}; var len = z1 - z0, zc = (z0 + z1) / 2, y = BELT_Y, FR = MAT_MACH.frame, LG = std({ color: 0xcfd4d9, roughness: 0.45, metalness: 0.3 });
        // side frames: a channel profile (web plus top and bottom flanges) with a painted top lip
        [-0.36, 0.36].forEach(function (sx) { c.box(0.04, 0.16, len, LG, x + sx, y - 0.06, zc); c.box(0.1, 0.02, len, LG, x + sx + (sx < 0 ? 0.03 : -0.03), y + 0.02, zc); c.box(0.1, 0.02, len, LG, x + sx + (sx < 0 ? 0.03 : -0.03), y - 0.14, zc); c.box(0.05, 0.02, len, MAT_MACH.blue, x + sx, y + 0.035, zc); });
        for (var cb = z0 + 0.6; cb < z1; cb += 1.2) c.box(0.68, 0.04, 0.05, FR, x, y - 0.13, cb);                                               // cross stays under the bed
        // rollers under the belt, end drums, the belt itself
        for (var rz = z0 + 0.18; rz < z1 - 0.1; rz += 0.3) { var r = c.cyl(0.03, 0.66, MAT_MACH.roller, x, y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
        [z0 + 0.06, z1 - 0.06].forEach(function (dz) { var dr = c.cyl(0.07, 0.68, MAT_MACH.roller, x, y - 0.03, dz, 14); dr.rotation.z = Math.PI / 2; });
        var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, len / 0.5); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true;
        var top = c.plane(0.62, len - 0.04, bm, x, y + 0.025, zc, -Math.PI / 2, 0); top.userData.speedKey = c.group.userData.propId; BELT_PLANES.push(top); c.box(0.62, 0.012, len - 0.04, std({ color: 0x1c1f23, roughness: 0.95 }), x, y - 0.09, zc);   // the return run underneath
        // guide rails on brackets, not floating
        [-0.32, 0.32].forEach(function (gx) { c.box(0.03, 0.04, len - 0.1, MAT_MACH.guard, x + gx, y + 0.14, zc); for (var gz = z0 + 0.3; gz < z1; gz += 1.2) { c.box(0.03, 0.14, 0.03, FR, x + gx, y + 0.08, gz); c.box(0.08, 0.02, 0.03, FR, x + gx + (gx < 0 ? 0.03 : -0.03), y + 0.04, gz); } });
        // the drive: motor and gearbox hung off the far drum, a guard over the chain (one per run, not one per short segment of a curve)
        if (!opt.noMotor) { var mt = c.cyl(0.085, 0.26, MAT_MACH.blue, x + 0.5, y - 0.1, z1 - 0.2, 14); mt.rotation.z = Math.PI / 2; c.cyl(0.095, 0.02, MAT.black, x + 0.64, y - 0.1, z1 - 0.2, 14).rotation.z = Math.PI / 2; c.box(0.12, 0.16, 0.16, FR, x + 0.43, y - 0.1, z1 - 0.2); c.box(0.06, 0.26, 0.2, FR, x + 0.4, y - 0.05, z1 - 0.1); c.box(0.03, 0.02, 0.4, MAT.black, x + 0.43, y - 0.2, z1 - 0.4); }
        if (!opt.noLegs) for (var lz = z0 + 0.4; lz < z1; lz += 1.5) { [-0.3, 0.3].forEach(function (lx) { c.box(0.06, y - 0.14, 0.06, FR, x + lx, (y - 0.14) / 2, lz); c.box(0.14, 0.02, 0.14, FR, x + lx, 0.01, lz); c.cyl(0.02, 0.04, MAT.chrome, x + lx, 0.03, lz, 6); }); c.box(0.66, 0.05, 0.05, FR, x, 0.2, lz); var dg = c.box(0.04, Math.hypot(0.6, y - 0.4), 0.04, FR, x, (y - 0.14) / 2 + 0.05, lz); dg.rotation.z = Math.atan2(0.6, y - 0.4); }
        if (!opt.noEye) { c.box(0.03, 0.4, 0.03, FR, x - 0.42, y + 0.2, z1 - 0.3); c.box(0.05, 0.06, 0.04, MAT.black, x - 0.42, y + 0.32, z1 - 0.3); c.box(0.02, 0.02, 0.005, glowMat(0xff3b2f, 1.2), x - 0.395, y + 0.32, z1 - 0.3); c.box(0.03, 0.3, 0.03, FR, x + 0.42, y + 0.15, z1 - 0.3); c.box(0.03, 0.03, 0.02, MAT.white, x + 0.42, y + 0.32, z1 - 0.3); }
        c.box(0.04, 0.03, len - 0.6, MAT.black, x - 0.4, y - 0.18, zc); for (var cz = z0 + 0.5; cz < z1; cz += 2) c.box(0.06, 0.08, 0.04, FR, x - 0.4, y - 0.18, cz);   // the cable run
        c.solid(x - 0.4, x + 0.4, z0, z1, 0, 0.82);
      }
    /* 06-props2-factory.js */
    function conveyorPath(c, pts) {
        for (var i = 1; i < pts.length; i++) {
          var ax = pts[i - 1][0], az = pts[i - 1][1], ay = pts[i - 1][2] || 0, bx = pts[i][0], bz = pts[i][1], by = pts[i][2] || 0, run = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), slope = Math.atan2(by - ay, run), len = Math.hypot(run, by - ay);
          var sg = new THREE.Group(); sg.position.set(ax, ay, az); sg.rotation.order = 'YXZ'; sg.rotation.y = ang; sg.rotation.x = -slope; sg.userData.propId = c.group.userData.propId; c.group.add(sg);   // the segments scroll with the prop's dial
          var sc = propCtx(sg, 'seg'); conveyorBuild(sc, 0, 0, len, { noEye: i < pts.length - 1, noLegs: true, noMotor: i < pts.length - 1 });
          // legs in the prop frame, the right height wherever the belt is, braced when tall; a curve's short segments share a leg every third one
          var ux = (bx - ax) / run, uz = (bz - az) / run, px = uz, pz = -ux;
          var hang = pts[i][3] === 'hang', spiral = pts[i][3] === 'spiral';   // a spiral segment hangs off the spiral's own column and guard: no legs, no hangers, no solid of its own
          if (spiral) { } else if (hang) { for (var hd = 0.6; hd < run; hd += 2.5) { var ht = BELT_Y + ay + (by - ay) * hd / run + 0.05, hx = ax + ux * hd, hz = az + uz * hd; [-0.3, 0.3].forEach(function (o) { c.cyl(0.025, HALL.h - 0.2 - ht, MAT_MACH.frame, hx + px * o, (HALL.h - 0.2 + ht) / 2, hz + pz * o, 6); }); var hb = c.box(0.8, 0.06, 0.06, MAT_MACH.frame, hx, ht, hz); hb.rotation.y = ang; var hp = c.box(0.9, 0.05, 0.3, MAT_MACH.frame, hx, HALL.h - 0.2, hz); hp.rotation.y = ang; } }
          else for (var d = run < 1 ? (i % 3 === 1 ? run / 2 : run + 1) : 0.5; d < run; d += 1.5) { var top = BELT_Y + ay + (by - ay) * d / run - 0.1, lx = ax + ux * d, lz = az + uz * d; [-0.3, 0.3].forEach(function (o) { c.box(0.06, top, 0.06, MAT_MACH.frame, lx + px * o, top / 2, lz + pz * o); c.box(0.14, 0.02, 0.14, MAT_MACH.frame, lx + px * o, 0.01, lz + pz * o); if (Math.min(ay, by) > 1.2) c.solid(lx + px * o - 0.1, lx + px * o + 0.1, lz + pz * o - 0.1, lz + pz * o + 0.1, 0, top); }); var cb = c.box(0.66, 0.05, 0.05, MAT_MACH.frame, lx, top - 0.02, lz); cb.rotation.y = ang; if (top > 1.5) { var br = c.box(0.66, 0.05, 0.05, MAT_MACH.frame, lx, top * 0.5, lz); br.rotation.y = ang; var dg = c.box(0.04, top * 0.95, 0.04, MAT_MACH.frame, lx, top / 2, lz); dg.rotation.order = 'YXZ'; dg.rotation.y = ang; dg.rotation.z = Math.atan2(0.6, top); } }
          // the solid: a level belt on the deck is a floor belt up there (solid from the deck to a metre up, so a step-over clears it); a high run carries only
          // a band round the belt; a slope is cut into metre-long pieces, each at its own height, so you can walk under the high end of an incline
          var lo = Math.min(ay, by), onDeck = Math.abs(lo - UPPER.y) < 0.25 && Math.abs(ay - by) < 0.25;
          if (!spiral) { var nch = Math.abs(ay - by) > 0.3 ? Math.max(1, Math.ceil(run / 1.0)) : 1; for (var ch = 0; ch < nch; ch++) { var t0 = ch / nch, t1 = (ch + 1) / nch, cy = Math.min(ay + (by - ay) * t0, ay + (by - ay) * t1), cx0 = ax + (bx - ax) * t0, cx1 = ax + (bx - ax) * t1, cz0 = az + (bz - az) * t0, cz1 = az + (bz - az) * t1, chigh = cy > 1.2, clow = BELT_Y + cy - 0.15; c.solid(Math.min(cx0, cx1) - 0.4, Math.max(cx0, cx1) + 0.4, Math.min(cz0, cz1) - 0.4, Math.max(cz0, cz1) + 0.4, onDeck ? cy : chigh ? clow : 0, onDeck ? cy + 0.9 : chigh ? clow + 1.2 : 0.82); } }
        }
      }
    /* 06-props2-factory.js */
    var SHIP_PATH = BOOT_STAGE === 1 ? [[0, 0], [0, 0.5], [2.6, 0.5], [2.6, -9.8], [0.4, -9.8], [0.4, -11.6]] : [[0, 0], [0, 0.5], [2.6, 0.5], [2.6, -15.3], [0.4, -15.3], [0.4, -17.1]];
    /* 06-props2-factory.js */
    function shipBeltBuild(c) { conveyorPath(c, SHIP_PATH); c.sign(['TO THE ' + (BOOT_STAGE === 1 ? 'OUT 1' : 'OUT 2') + ' BAY'], 0.8, 0.14, 2.17, 1.05, BOOT_STAGE === 1 ? -2 : -4, -Math.PI / 2, { w: 320, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function dockLoaderBuildFor(id, label, mirror) { return function (c) {
        var m = mirror ? -1 : 1, Z = function (z) { return z * m; }, door = LOADER_DOORS[id];
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame, BL = MAT_MACH.blue;
        var rbx = function (w, h, d, r, mat, x, y, z, parent) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; (parent || c.group).add(mm); return mm; };
        rbx(1.6, 0.26, 2.2, 0.03, DG, -0.2, 0.13, Z(0.6)); [[-0.9, -0.4], [0.5, -0.4], [-0.9, 1.6], [0.5, 1.6]].forEach(function (p) { c.cyl(0.07, 0.04, DG, p[0], 0.02, Z(p[1]), 10); c.box(0.12, 0.3, 0.12, DG, p[0], 0.3, Z(p[1])); });
        [-0.46, 0.26].forEach(function (sx) { c.box(0.04, 0.16, 1.9, LG, sx, BELT_Y - 0.06, Z(0.75)); c.box(0.05, 0.02, 1.9, BL, sx, BELT_Y + 0.035, Z(0.75)); });
        for (var rz = -0.1; rz < 1.6; rz += 0.3) { var r = c.cyl(0.03, 0.68, MAT_MACH.roller, -0.1, BELT_Y - 0.02, Z(rz), 10); r.rotation.z = Math.PI / 2; }
        var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, 3.8); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true; var top = c.plane(0.62, 1.86, bm, -0.1, BELT_Y + 0.025, Z(0.75), -Math.PI / 2, m > 0 ? 0 : Math.PI); top.userData.speedKey = c.group.userData.propId; BELT_PLANES.push(top);
        [-0.42, 0.22].forEach(function (gx) { c.box(0.03, 0.04, 1.8, MAT_MACH.guard, gx, BELT_Y + 0.14, Z(0.75)); [0.0, 0.8, 1.5].forEach(function (gz) { c.box(0.03, 0.14, 0.03, DG, gx, BELT_Y + 0.08, Z(gz)); }); });
        [[-0.1, -0.1], [-0.1, 0.9]].forEach(function (p) { c.box(0.14, 1.9, 0.14, BL, 0.55, 0.95, Z(p[1])); }); c.box(0.16, 0.16, 1.2, BL, 0.55, 1.9, Z(0.4)); c.cyl(0.1, 0.9, DG, 0.55, 1.1, Z(0.4), 12).rotation.x = Math.PI / 2;
        var cylm = c.cyl(0.06, 1.0, MAT.chrome, 1.0, 0.5, Z(0.4), 10); cylm.rotation.z = -0.9; var cylb = c.cyl(0.08, 0.6, DG, 0.75, 0.3, Z(0.4), 10); cylb.rotation.z = -0.9;
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        var boom = new THREE.Group(); boom.position.set(0.9, BELT_Y + 0.02, Z(0.4)); dyn.add(boom);
        box(1.6, 0.16, 0.76, LG, 0, 0, 0, boom); box(1.6, 0.03, 0.62, std({ color: 0x2c3035, roughness: 0.9 }), 0, 0.1, 0, boom); box(1.6, 0.05, 0.03, MAT_MACH.guard, 0, 0.16, 0.34, boom); box(1.6, 0.05, 0.03, MAT_MACH.guard, 0, 0.16, -0.34, boom);
        for (var bk = -0.6; bk <= 0.6; bk += 0.3) cyl(0.03, 0.62, MAT_MACH.roller, bk, 0.09, 0, boom, 8).rotation.x = Math.PI / 2;
        cyl(0.06, 0.66, MAT.rubber, 0.82, 0.02, 0, boom, 10).rotation.x = Math.PI / 2; box(0.12, 0.12, 0.8, MAT.yellow, 0.86, -0.08, 0, boom); box(0.14, 0.04, 0.8, MAT.black, 0.86, 0.0, 0, boom);
        box(1.4, 0.06, 0.1, DG, 0, -0.1, 0.42, boom); box(1.4, 0.06, 0.1, DG, 0, -0.1, -0.42, boom); box(0.3, 0.1, 0.5, DG, -0.6, -0.14, 0, boom);
        var pusher = box(0.08, 0.34, 0.56, BL, 0.2, 0.3, 0, boom); box(0.4, 0.05, 0.05, MAT.chrome, 0.0, 0.3, 0, boom); box(0.1, 0.1, 0.1, DG, -0.2, 0.3, 0, boom);
        c.box(0.08, 0.08, 0.08, DG, 0.55, 2.0, Z(0.4)); c.box(0.6, 0.08, 0.3, DG, 0.85, 2.05, Z(0.4)); c.box(0.5, 0.05, 0.22, MAT.lamp, 0.9, 1.99, Z(0.4));
        rbx(0.5, 1.3, 0.4, 0.03, LG, -1.1, 0.7, Z(1.6)); c.box(0.52, 0.16, 0.42, DG, -1.1, 0.08, Z(1.6)); var scr = touchScreen({ w: 300, h: 200, pw: 0.38, ph: 0.25, x: -1.1, y: 1.15, z: Z(1.81), ry: m > 0 ? 0 : Math.PI, parent: c.group, title: 'Dock loader ' + label, draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(cc, sc.w, 'DOCK LOADER ' + label, dockLoaderStatus(door).toUpperCase()); scText(cc, 16, 70, dockLoaderPrompt(door).split(' · ').slice(1, 2).join(''), '#eef1f5', 13); scText(cc, 16, 100, (dockLane(door) ? dockLane(door).name.toUpperCase() + ' lane · ' : '') + (S.stats.autoLoaded || 0) + ' loaded by machine', '#a0acb8', 12); speedButton(sc, 16, 150, 130, S.up.sorter ? 'sorter' : 'shipBelt', 'BELT'); } }); scr.mesh.userData.propId = id;
        eStop(c, -1.1, 0.6, Z(1.81)); MACH[id].lamps = lampStack(c, -1.1, 1.4, Z(1.6)); c.box(0.04, 1.1, 0.04, MAT.black, -1.3, 0.55, Z(1.4));
        [-0.2, 1.0].forEach(function (lz) { c.box(0.06, 1.7, 0.06, MAT.yellow, 1.55, 0.85, Z(lz)); c.box(0.02, 1.5, 0.02, glowMat(0xff3b2f, 0.6), 1.59, 0.85, Z(lz)); c.box(0.14, 0.03, 0.14, DG, 1.55, 0.015, Z(lz)); });
        c.sign(['DOCK LOADER', 'KEEP CLEAR OF THE BOOM'], 1.2, 0.24, -0.2, 1.0, Z(-0.56), m > 0 ? Math.PI : 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' }); c.sign([label + ' · AUTO' + (dockLane(door) ? ' · ' + dockLane(door).name.toUpperCase() : '')], 0.8, 0.14, 0.55, 2.12, Z(0.4), m > 0 ? 0 : Math.PI, { w: 320, h: 64, bg: '#1b232c', fg: dockLane(door) ? dockLane(door).col : '#5fd38d' });
        MACH[id].anim = { boom: boom, pusher: pusher, pushT: 0, ext: 0 };
        c.hit(2.0, 2.0, 2.4, 0, 1.0, Z(0.6), { prompt: function () { return dockLoaderPrompt(door); }, use: function () { sfx('click'); } });
        c.solid(-1.4, 0.7, Z(-0.5), Z(1.8), 0, 2.1);
      }; }
    /* 06-props2-factory.js */
    var dockLoaderBuild = dockLoaderBuildFor('dockLoader2', 'OUT 2', false);
    /* 06-props2-factory.js */
    function gantryBuild(r) { return function (c) {
        var DG = MAT_MACH.frame, YL = std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), LG = MAT_MACH.panel, GT = gantryTop(r), GD = GT - 5.0;   // GT: rail height; the upper crane is two metres lower
        // end columns stand clear of the racking at the row ends; the mid columns stand tight against the rack faces, out of the aisles
        // the east pair stands at 47.2, past the overhead pick belt that runs along the row ends at 46
        // every column stands tight against the rack face and reaches the rails on an outrigger, so nothing stands in the aisle
        [-0.4, 47.2].forEach(function (cx) { [-0.78, 0.78].forEach(function (cz) { c.box(0.26, 5.4 + GD, 0.26, YL, cx, 2.7 + GD / 2, cz); c.box(0.5, 0.03, 0.5, DG, cx, 0.015, cz); c.box(0.26, 0.2, 1.0, DG, cx, 5.45 + GD, cz * 1.5); c.box(0.3, 0.3, 0.3, DG, cx, 5.5 + GD, cz); }); c.box(0.2, 0.2, 3.5, DG, cx, 5.55 + GD, 0); });
        for (var cx = 7.67; cx < 46; cx += 7.67) { [-0.78, 0.78].forEach(function (cz) { c.box(0.2, 5.4 + GD, 0.2, YL, cx, 2.7 + GD / 2, cz); c.box(0.4, 0.03, 0.4, DG, cx, 0.015, cz); var ob = c.box(0.2, 0.2, 0.9, DG, cx, 5.45 + GD, cz * 1.5); }); c.box(0.2, 0.2, 3.5, DG, cx, 5.55 + GD, 0); }
        [-1.6, 1.6].forEach(function (rz) { c.box(48.2, 0.18, 0.2, DG, 23.4, 5.4 + GD, rz); c.box(48.2, 0.04, 0.06, MAT.chrome, 23.4, 5.5 + GD, rz); });
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        var trolley = new THREE.Group(); trolley.position.set(46, GT, 0); dyn.add(trolley);
        box(1.0, 0.3, 3.6, YL, 0, 0.55, 0, trolley); box(1.1, 0.12, 0.5, DG, 0, 0.6, -1.6, trolley); box(1.1, 0.12, 0.5, DG, 0, 0.6, 1.6, trolley); [-0.4, 0.4].forEach(function (wx) { [-1.6, 1.6].forEach(function (wz) { cyl(0.1, 0.08, MAT.black, wx, 0.6, wz, trolley, 12).rotation.z = Math.PI / 2; }); });
        box(0.7, 0.5, 0.7, LG, 0, 0.95, 0, trolley); box(0.3, 0.3, 0.3, MAT_MACH.blue, 0.5, 0.95, 0, trolley); var beacon = cyl(0.05, 0.12, glowMat(0xffd060, 2.5), 0, 1.3, 0, trolley, 10); box(0.02, 0.1, 0.06, MAT.black, 0.03, 1.3, 0, beacon);
        var mast = box(0.28, GT - 1.0, 0.28, LG, 0, -(GT - 1.0) / 2, 0, trolley); mast.scale.y = 0.05; mast.position.y = 0;   // scaled from the trolley down to the gripper
        var grip = new THREE.Group(); grip.position.set(0, 0, 0); trolley.add(grip); box(0.5, 0.15, 0.5, DG, 0, 0.3, 0, grip); box(0.7, 0.06, 0.7, MAT.black, 0, 0.2, 0, grip); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(function (s) { cyl(0.07, 0.06, MAT_MACH.rubber, s[0], 0.15, s[1], grip, 10); });
        var bx = new THREE.Mesh(BOX_GEO, CARD[SKUS[0].id]); bx.position.set(0, -0.05, 0); bx.visible = false; grip.add(bx);
        c.sign(['GANTRY PICKER · ROW ' + rowLetter(r), 'AUTOMATIC · KEEP CLEAR'], 2.0, 0.4, 44.5, 5.9 + GD, 1.75, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#f5b53d' });
        // the control cabinet hangs off the south end column (at z -0.78) on two brackets; screen and e-stop face the aisle
        c.box(0.5, 1.0, 0.3, LG, 47.2, 1.4, -1.25); c.box(0.08, 0.3, 0.2, DG, 47.2, 1.1, -1.0); c.box(0.08, 0.3, 0.2, DG, 47.2, 1.75, -1.0); eStop(c, 47.2, 1.2, -1.41); MACH['gantry' + r].lamps = lampStack(c, 47.2, 1.9, -1.25);
        c.box(0.42, 0.3, 0.02, DG, 47.2, 1.6, -1.405); var gsc = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 47.2, y: 1.6, z: -1.418, ry: Math.PI, parent: c.group, title: 'Gantry ' + rowLetter(r), draw: gantryScreenDraw(r) }); gsc.mesh.userData.propId = 'gantry' + r; MACH['gantry' + r].screen = gsc;
        MACH['gantry' + r].anim = { trolley: trolley, mast: mast, grip: grip, box: bx, beacon: beacon };
        c.hit(0.5, 1.0, 0.3, 47.2, 1.4, -1.25, { prompt: function () { return gantryPrompt(r); }, use: function () { sfx('click'); } });
        [-0.4, 47.2].forEach(function (sx) { c.solid(sx - 0.15, sx + 0.15, -0.93, -0.63, 0, 5.5 + GD); c.solid(sx - 0.15, sx + 0.15, 0.63, 0.93, 0, 5.5 + GD); }); for (var sx2 = 7.67; sx2 < 46; sx2 += 7.67) { c.solid(sx2 - 0.12, sx2 + 0.12, -0.9, -0.66, 0, 5.5 + GD); c.solid(sx2 - 0.12, sx2 + 0.12, 0.66, 0.9, 0, 5.5 + GD); }
      }; }
    /* 06-props2-factory.js */
    function pickBeltBuild(c) { conveyorPath(c, BELTS.pickBelt.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 0, BELT_Y + 2.4 + 0.3, 8, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function pickMergeBuild(c) { conveyorPath(c, BELTS.pickMerge.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 2.0, BELT_Y + 2.4 + 0.3, 0.45, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function pickBelt2Build(c) { conveyorPath(c, BELTS.pickBelt2.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 0, BELT_Y + 2.4 + 0.3, -4, -Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
    /* 06-props2-factory.js */
    function agvDockBuild(c) {
        var DG = MAT_MACH.frame; c.box(1.2, 0.012, 1.8, MAT.hazard, 0, 0.006, 0); c.box(0.5, 0.9, 0.3, MAT_MACH.panel, 0, 0.45, -1.0); c.box(0.52, 0.06, 0.32, DG, 0, 0.03, -1.0); c.box(0.3, 0.08, 0.04, MAT.chrome, 0, 0.35, -0.83); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), -0.2, 0.76, -0.84); agvScreen = touchScreen({ w: 300, h: 200, pw: 0.33, ph: 0.22, x: 0, y: 0.57, z: -0.845, ry: 0, parent: c.group, title: 'AGV dock', draw: agvScreenDraw }); agvScreen.mesh.userData.propId = 'agvDock';
        c.sign(['AGV DOCK'], 0.5, 0.12, 0, 0.82, -0.84, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' });
        [[-1.0, 1.6], [1.0, 1.6], [-1.0, 3.6], [1.0, 3.6]].forEach(function (p) { c.cyl(0.04, 0.5, MAT.yellow, p[0], 0.25, p[1], 8); });
        [[0, 1.6, 2.0, 0.08], [0, 3.6, 2.0, 0.08]].forEach(function (l) { c.plane(l[2], l[3], MAT.yellowLine, l[0], 0.0065, l[1], -Math.PI / 2); }); c.plane(0.08, 2.0, MAT.yellowLine, -1.0, 0.0065, 2.6, -Math.PI / 2); c.plane(0.08, 2.0, MAT.yellowLine, 1.0, 0.0065, 2.6, -Math.PI / 2);
        var fs2 = c.sign(['AGV PICKUP', 'set a pallet here'], 1.6, 0.5, 0, 0.0068, 2.6, 0, { w: 512, h: 160, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }); fs2.rotation.x = -Math.PI / 2;
        c.hit(0.5, 0.9, 0.3, 0, 0.45, -1.0, { prompt: function () { return agvPrompt(); }, use: function () { sfx('click'); } });
        c.solid(-0.3, 0.3, -1.2, -0.85, 0, 1.0);
      }
    /* 06-props2-factory.js */
    function eStop(c, x, y, z) { c.box(0.12, 0.12, 0.03, MAT.yellow, x, y, z); c.cyl(0.035, 0.04, MAT.red, x, y, z + 0.03, 12).rotation.x = Math.PI / 2; }
    /* 06-props2-factory.js */
    function cabinet(c, x, y, z, w, h, d) { c.box(w, h, d, MAT_MACH.panel, x, y, z); c.box(w + 0.02, 0.05, d + 0.02, MAT_MACH.frame, x, y + h / 2, z); c.box(w - 0.1, h - 0.12, 0.01, std({ color: 0xcfd4d9, roughness: 0.5 }), x, y, z + d / 2 + 0.004); c.box(0.025, 0.08, 0.02, MAT.chrome, x + w / 2 - 0.08, y, z + d / 2 + 0.015); }
    /* 06-props2-factory.js */
    function packLineBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame, BL = MAT_MACH.blue;
        var rbx = function (w, h, d, r, mat, x, y, z) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; c.group.add(mm); return mm; };
        conveyorBuild(c, 0, 0, 2.0, { noEye: true });
        // the taper body on four legs: lower skirt, louvred side panels, a top housing with a window onto the tape head, service doors
        [[-0.6, 2.15], [0.6, 2.15], [-0.6, 3.65], [0.6, 3.65]].forEach(function (p) { c.box(0.1, 0.7, 0.1, DG, p[0], 0.35, p[1]); c.box(0.2, 0.03, 0.2, DG, p[0], 0.015, p[1]); });
        rbx(1.4, 0.16, 1.8, 0.02, DG, 0, 0.78, 2.9); rbx(1.4, 1.0, 1.8, 0.04, LG, 0, 1.36, 2.9); c.box(1.42, 0.04, 1.82, MAT.hazard, 0, 0.88, 2.9);
        [-0.71, 0.71].forEach(function (sx) { for (var lv = 0; lv < 8; lv++) c.box(0.015, 0.03, 1.3, DG, sx, 1.0 + lv * 0.08, 2.9); c.box(0.02, 0.5, 0.5, std({ color: 0xcfd4d9, roughness: 0.5 }), sx, 1.3, 2.3); c.box(0.03, 0.08, 0.02, MAT.chrome, sx + (sx < 0 ? -0.01 : 0.01), 1.3, 2.5); });
        c.box(0.9, 0.7, 0.1, MAT.black, 0, 1.2, 2.02); c.box(0.9, 0.7, 0.1, MAT.black, 0, 1.2, 3.78); var flap = c.box(0.86, 0.3, 0.02, std({ color: 0xd8dde3, roughness: 0.4, transparent: true, opacity: 0.6 }), 0, 1.4, 3.8); flap.rotation.x = -0.6; flap.userData.noBake = true;
        for (var rz = 2.1; rz < 3.7; rz += 0.2) { var r = c.cyl(0.035, 0.84, MAT_MACH.roller, 0, BELT_Y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
        [-0.4, 0.4].forEach(function (x) { c.box(0.04, 0.28, 1.5, MAT_MACH.rubber, x, BELT_Y + 0.2, 2.9); });
        rbx(1.0, 0.5, 1.2, 0.05, LG, 0, 2.1, 2.9); c.box(1.04, 0.04, 1.24, DG, 0, 1.88, 2.9); c.plane(0.7, 0.3, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0.0, 2.15, 3.51, 0, 0); c.box(0.74, 0.34, 0.02, DG, 0, 2.15, 3.5);
        c.box(0.36, 0.42, 0.5, DG, 0, 1.62, 2.9); var roll = c.cyl(0.16, 0.08, MAT.white, 0, 1.72, 3.15, 16); roll.rotation.z = Math.PI / 2; c.cyl(0.03, 0.14, MAT.chrome, 0, 1.72, 3.15, 8).rotation.z = Math.PI / 2; var pr = c.cyl(0.04, 0.3, MAT_MACH.rubber, 0, 1.45, 2.62, 10); pr.rotation.z = Math.PI / 2;
        c.box(0.3, 0.02, 0.4, MAT_MACH.guard, -0.42, BELT_Y + 0.5, 2.1).rotation.z = 0.5; c.box(0.3, 0.02, 0.4, MAT_MACH.guard, 0.42, BELT_Y + 0.5, 2.1).rotation.z = -0.5;
        c.box(0.3, 0.2, 0.24, LG, 0.5, 1.12, 3.74); c.box(0.22, 0.01, 0.03, MAT.paper, 0.5, 1.04, 3.88); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.62, 1.2, 3.86);
        c.sign(['CASE TAPER 400', 'KEEP HANDS CLEAR OF THE INFEED'], 1.0, 0.2, 0, 1.6, 2.0, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['DEPOT CO. PACK LINE 1'], 1.2, 0.14, -0.72, 1.7, 2.9, -Math.PI / 2, { w: 512, h: 60, bg: '#1b232c', fg: '#f5b53d' });
        // the cabinet on a pedestal, cable trunking back to the machine
        rbx(0.5, 1.2, 0.45, 0.03, LG, 1.05, 1.0, 2.9); c.box(0.52, 0.3, 0.47, DG, 1.05, 0.25, 2.9); c.box(0.05, 0.05, 0.25, MAT.black, 0.78, 0.5, 2.9); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.05, y: 1.3, z: 3.135, ry: 0, parent: c.group, title: 'Pack line', draw: packScreenDraw }); scr.mesh.userData.propId = 'packline';
        eStop(c, 1.05, 0.85, 3.135); MACH.taper.lamps = lampStack(c, 1.05, 1.62, 2.9); c.cyl(0.02, 0.5, MAT.black, 1.2, 0.5, 2.7, 6);
        c.hit(1.6, 2.4, 1.9, 0.1, 1.2, 2.9, { prompt: function () { return packPrompt(); }, use: function () { packUse(); } });
        c.solid(-0.75, 1.35, 2.0, 3.8, 0, 2.5);
        conveyorBuild(c, 0, 3.8, 5.8, {});
        // the gravity shelf: a sloped roller bed on a frame with an end stop and a take-from-here plate
        for (var sz = 5.9; sz < 7.0; sz += 0.12) { var sr = c.cyl(0.025, 0.7, MAT_MACH.roller, 0, 0.66 - (sz - 5.9) * 0.06, sz, 8); sr.rotation.z = Math.PI / 2; }
        [-0.38, 0.38].forEach(function (x) { var rail = c.box(0.04, 0.1, 1.2, DG, x, 0.64, 6.45); rail.rotation.x = 0.06; c.box(0.05, 0.55, 0.05, DG, x, 0.28, 5.95); c.box(0.05, 0.5, 0.05, DG, x, 0.25, 6.95); c.box(0.12, 0.02, 0.12, DG, x, 0.01, 5.95); c.box(0.12, 0.02, 0.12, DG, x, 0.01, 6.95); }); c.box(0.8, 0.04, 0.04, DG, 0, 0.3, 5.95); c.box(0.8, 0.04, 0.04, DG, 0, 0.3, 6.95);
        c.box(0.8, 0.12, 0.03, MAT_MACH.guard, 0, 0.68, 7.02); c.sign(['PARCELS · TAKE FROM HERE'], 0.8, 0.12, 0, 0.5, 7.03, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#5fd38d' });
        c.solid(-0.45, 0.45, 5.8, 7.05, 0, 0.75);
      }
    /* 06-props2-factory.js */
    function moulderBuild(c) {
        var LG = MAT_MACH.panel, DG = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), BL = MAT_MACH.blue, CH = MAT.chrome;
        var rbx = function (w, h, d, r, mat, x, y, z, parent) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; (parent || c.group).add(mm); return mm; };
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
        // the base: a dark skirt on levelling feet, a light bevelled bed, a hazard band, the cable chain down the operator side
        rbx(1.6, 0.34, 4.9, 0.03, DG, 0, 0.17, -0.55); rbx(1.5, 0.56, 4.9, 0.05, LG, 0, 0.62, -0.55); c.box(1.52, 0.04, 4.92, MAT.hazard, 0, 0.36, -0.55);
        [[-0.65, -2.8], [0.65, -2.8], [-0.65, -0.3], [0.65, -0.3], [-0.65, 1.7], [0.65, 1.7]].forEach(function (p) { c.cyl(0.08, 0.06, DG, p[0], 0.03, p[1], 10); c.cyl(0.03, 0.1, CH, p[0], 0.05, p[1], 8); });
        c.box(0.12, 0.08, 2.6, DG, 0.82, 0.95, 0.4); for (var cl = -0.8; cl < 1.6; cl += 0.16) c.box(0.14, 0.1, 0.03, MAT.black, 0.82, 0.95, cl);
        // the injection unit at the back: housing, loader hopper on the throat, the barrel in its slotted heater cover, the nozzle to the fixed platen
        rbx(1.2, 1.1, 1.7, 0.05, LG, 0, 1.45, -1.7); rbx(1.22, 0.3, 1.72, 0.03, BL, 0, 0.9, -1.7);
        c.cyl(0.14, 0.4, DG, 0, 2.2, -1.9, 12); c.cyl(0.32, 0.5, LG, 0, 2.6, -1.9, 16, 0.14); c.cyl(0.32, 0.5, LG, 0, 3.1, -1.9, 16); c.cyl(0.33, 0.04, DG, 0, 3.37, -1.9, 16); c.box(0.16, 0.14, 0.16, MAT.black, 0.25, 2.55, -1.9); c.cyl(0.04, 0.4, DG, 0.42, 2.8, -1.9, 8);
        c.box(0.26, 0.16, 0.3, DG, 0.5, 2.1, -1.5); var ib = c.cyl(0.18, 0.5, BL, 0, 1.3, -2.8, 14); ib.rotation.x = Math.PI / 2; c.cyl(0.2, 0.08, DG, 0, 1.3, -2.55, 14).rotation.x = Math.PI / 2;
        rbx(0.56, 0.56, 1.1, 0.06, LG, 0, 1.55, -0.3); for (var sl = -0.75; sl < 0.15; sl += 0.12) c.box(0.58, 0.03, 0.04, MAT.black, 0, 1.75, sl); for (var sl2 = -0.75; sl2 < 0.15; sl2 += 0.12) c.box(0.58, 0.03, 0.04, MAT.black, 0, 1.35, sl2);
        var nz = c.cyl(0.06, 0.4, CH, 0, 1.55, 0.35, 10); nz.rotation.x = Math.PI / 2; c.cyl(0.1, 0.1, DG, 0, 1.55, 0.25, 10).rotation.x = Math.PI / 2;
        // the clamp: fixed platen, four tie bars with nuts, the moving platen on the toggles, the rear platen and its cylinder
        rbx(1.5, 1.5, 0.25, 0.03, DG, 0, 1.3, 0.6);
        // the rear platen is an open frame standing on the floor: the finished part slides out through the opening onto the belt
        rbx(0.4, 2.05, 0.22, 0.03, DG, -0.55, 1.025, 2.5); rbx(0.4, 2.05, 0.22, 0.03, DG, 0.55, 1.025, 2.5); rbx(1.5, 0.4, 0.22, 0.03, DG, 0, 1.85, 2.5); c.box(0.5, 0.04, 0.5, DG, -0.55, 0.02, 2.5); c.box(0.5, 0.04, 0.5, DG, 0.55, 0.02, 2.5);
        c.box(0.74, 0.06, 0.06, MAT.hazard, 0, 1.62, 2.63); c.box(0.06, 1.62, 0.06, MAT.hazard, -0.38, 0.81, 2.63); c.box(0.06, 1.62, 0.06, MAT.hazard, 0.38, 0.81, 2.63); c.sign(['PARTS OUT'], 0.5, 0.12, 0, 1.72, 2.64, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
        c.cyl(0.14, 0.45, BL, 0, 1.85, 2.85, 14).rotation.x = Math.PI / 2; c.cyl(0.06, 0.4, CH, 0, 1.85, 3.05, 10).rotation.x = Math.PI / 2;
        [[-0.58, 0.72], [0.58, 0.72], [-0.58, 1.88], [0.58, 1.88]].forEach(function (t) { var tb = c.cyl(0.045, 2.2, CH, t[0], t[1], 1.55, 12); tb.rotation.x = Math.PI / 2; [0.42, 2.68].forEach(function (nz2) { c.cyl(0.09, 0.12, DG, t[0], t[1], nz2, 8).rotation.x = Math.PI / 2; }); });
        var ram = rbx(1.36, 1.36, 0.2, 0.03, DG, 0, 1.3, 1.25, dyn); rbx(0.64, 0.74, 0.16, 0.02, MAT_MACH.roller, 0, 0, -0.18, ram); c.box(0.06, 0.06, 0.06, MAT.black, 0, 0, 0, ram);
        rbx(0.64, 0.74, 0.16, 0.02, MAT_MACH.roller, 0, 1.3, 0.81); c.box(0.5, 0.06, 0.04, MAT.black, 0, 1.0, 0.9);
        [[-0.45, 1.0], [0.45, 1.0], [-0.45, 1.6], [0.45, 1.6]].forEach(function (l) { var lk = c.box(0.08, 0.06, 0.6, DG, l[0], l[1], 1.85, 0); lk.rotation.x = l[1] > 1.3 ? 0.5 : -0.5; var lk2 = c.box(0.08, 0.06, 0.6, DG, l[0], l[1], 2.15); lk2.rotation.x = l[1] > 1.3 ? -0.5 : 0.5; });
        c.cyl(0.05, 1.3, CH, 0, 1.3, 1.9, 8).rotation.z = Math.PI / 2;
        // the guards: a sliding gate with a window on the operator side, a fixed sheet with a window on the other, a top cover carrying the lamp stack
        var GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        c.box(0.05, 1.7, 2.1, MAT_MACH.guard, 0.82, 1.35, 1.55); c.box(0.05, 1.7, 2.1, LG, 0.84, 1.35, 1.55); c.plane(1.3, 0.9, GL, 0.87, 1.45, 1.55, 0, Math.PI / 2); c.box(0.06, 0.08, 1.4, DG, 0.87, 0.95, 1.55); c.box(0.06, 0.08, 1.4, DG, 0.87, 1.95, 1.55); c.box(0.06, 1.0, 0.08, DG, 0.87, 1.45, 0.85); c.box(0.06, 1.0, 0.08, DG, 0.87, 1.45, 2.25); c.box(0.08, 0.3, 0.04, MAT.black, 0.9, 1.3, 2.1);
        c.box(0.05, 1.7, 2.1, LG, -0.84, 1.35, 1.55); c.plane(0.9, 0.6, GL, -0.87, 1.5, 1.55, 0, -Math.PI / 2); c.box(0.06, 0.06, 1.0, DG, -0.87, 1.2, 1.55); c.box(0.06, 0.06, 1.0, DG, -0.87, 1.8, 1.55);
        rbx(1.7, 0.06, 2.2, 0.02, LG, 0, 2.22, 1.55); c.box(1.7, 0.04, 0.1, DG, 0, 2.2, 0.5); c.box(1.7, 0.04, 0.1, DG, 0, 2.2, 2.6);
        MACH.moulder.lamps = lampStack(c, -0.5, 2.25, 0.7); var spin = cyl(0.07, 0.1, glowMat(0xf5b53d, 1.0), 0.5, 2.3, 0.7, dyn, 10); box(0.03, 0.12, 0.03, MAT.black, 0.05, 0, 0, spin); c.cyl(0.02, 0.1, DG, 0.5, 2.25, 0.7, 6);
        // the operator panel on a swing arm, with the touchscreen and the E-stop
        c.box(0.08, 0.5, 0.08, DG, 0.9, 1.25, -0.3); var arm = c.box(0.45, 0.06, 0.06, DG, 1.1, 1.5, -0.3); c.box(0.08, 0.4, 0.08, DG, 1.32, 1.3, -0.3);
        rbx(0.1, 0.62, 0.5, 0.02, LG, 1.37, 1.05, -0.3); var scr = touchScreen({ w: 400, h: 260, pw: 0.42, ph: 0.28, x: 1.43, y: 1.12, z: -0.3, ry: Math.PI / 2, parent: c.group, title: 'Moulding line', draw: moulderScreenDraw }); scr.mesh.userData.propId = 'moulder';
        c.box(0.04, 0.1, 0.1, MAT.yellow, 1.43, 0.8, -0.45); c.cyl(0.03, 0.03, MAT.red, 1.46, 0.8, -0.45, 10).rotation.z = Math.PI / 2; c.box(0.04, 0.03, 0.03, glowMat(0x5fd38d, 1.2), 1.43, 0.8, -0.2);
        // the hydraulic power unit behind, the water manifold with its hoses to the mould, the outfeed chute to the belt
        rbx(1.1, 0.7, 0.8, 0.04, DG, 0, 0.75, -2.95); var mot = cyl(0.2, 0.6, BL, -0.25, 1.4, -2.95, dyn, 14); mot.rotation.z = Math.PI / 2; c.cyl(0.22, 0.05, MAT.black, -0.58, 1.4, -2.95, 14).rotation.z = Math.PI / 2; rbx(0.4, 0.4, 0.5, 0.04, LG, 0.3, 1.3, -2.95); c.cyl(0.05, 0.03, MAT.white, 0.3, 1.5, -2.69, 10).rotation.x = Math.PI / 2; c.cyl(0.04, 0.3, MAT.black, 0.3, 1.1, -2.69, 8);
        [[0.3, 1.2, -2.4, 0.7], [-0.3, 1.0, -2.3, -0.6]].forEach(function (h) { var hs = c.cyl(0.03, 1.2, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
        c.box(0.3, 0.2, 0.12, BL, -0.9, 0.95, 0.3); for (var hh = 0; hh < 4; hh++) { var wh = c.cyl(0.012, 1.0, hh % 2 ? MAT.red : MAT.blue, -0.85 + hh * 0.04, 1.0 + hh * 0.05, 0.75, 6); wh.rotation.x = Math.PI / 2 - 0.3; }
        var chute = c.box(0.62, 0.03, 1.5, MAT_MACH.roller, 0, 0.95, 1.65); chute.rotation.x = 0.2; c.box(0.03, 0.14, 1.5, MAT_MACH.guard, -0.31, 1.02, 1.65).rotation.x = 0.2; c.box(0.03, 0.14, 1.5, MAT_MACH.guard, 0.31, 1.02, 1.65).rotation.x = 0.2; c.box(0.6, 0.02, 0.3, MAT_MACH.roller, 0, 0.8, 2.45);
        conveyorBuild(c, 0, 2.4, 4.4, {});
        c.sign(['DC-IMM 180', 'MOULDING LINE 1'], 0.9, 0.3, -0.84, 1.75, -1.7, -Math.PI / 2, { w: 512, h: 170, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['⚠ HOT SURFACE'], 0.5, 0.14, 0.61, 1.2, -1.2, Math.PI / 2, { w: 256, h: 72, bg: '#f5b53d', fg: '#1a1205' });
        MACH.moulder.anim = { ram: ram, wheel: mot, spin: spin };
        c.hit(2.6, 2.6, 6.0, 0.2, 1.3, -0.2, { prompt: function () { return moulderPrompt(); }, use: function () { moulderUse(); } });
        c.solid(-0.9, 0.9, -3.4, 2.4, 0, 2.6); c.solid(0.9, 1.5, -0.6, 0.0, 0, 2.0);
      }
    /* 06-props2-factory.js */
    function hopperBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame, hdyn = new THREE.Group(); hdyn.userData.dynamic = true; c.group.add(hdyn);
        // legs: square section with footplates and bolts, cross bracing on every face, a ring girder under the cone
        var L = 2.3; [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(function (p) { c.box(0.16, L, 0.16, DG, p[0], L / 2, p[1]); c.box(0.36, 0.03, 0.36, DG, p[0], 0.015, p[1]); [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(function (b) { c.cyl(0.02, 0.05, MAT.chrome, p[0] + b[0], 0.04, p[1] + b[1], 6); }); });
        [[0, -0.85, 0], [0, 0.85, 0], [-0.85, 0, 1], [0.85, 0, 1]].forEach(function (f) { var d1 = c.box(0.06, 2.3, 0.02, DG, f[0], L / 2, f[1]); var d2 = c.box(0.06, 2.3, 0.02, DG, f[0], L / 2, f[1]); if (f[2]) { d1.rotation.y = Math.PI / 2; d2.rotation.y = Math.PI / 2; d1.rotation.x = 0.63; d2.rotation.x = -0.63; } else { d1.rotation.z = 0.63; d2.rotation.z = -0.63; } c.box(f[2] ? 0.08 : 1.86, 0.08, f[2] ? 1.86 : 0.08, DG, f[0], 1.0, f[1]); });
        c.box(1.9, 0.12, 0.12, DG, 0, L - 0.06, -0.85); c.box(1.9, 0.12, 0.12, DG, 0, L - 0.06, 0.85); c.box(0.12, 0.12, 1.9, DG, -0.85, L - 0.06, 0); c.box(0.12, 0.12, 1.9, DG, 0.85, L - 0.06, 0);
        // the bin: cone, drum with stiffening bands, a lid with a loader flange, a sight glass strip and a level gauge line
        c.cyl(1.05, 1.3, LG, 0, 2.95, 0, 24, 0.18); c.cyl(1.05, 1.5, LG, 0, 4.35, 0, 24); c.cyl(1.05, 0.08, LG, 0, 5.14, 0, 24); c.cyl(0.95, 0.2, DG, 0, 5.2, 0, 24, 0.3); c.cyl(0.25, 0.25, DG, 0, 5.38, 0, 12);
        [3.7, 4.3, 4.9].forEach(function (y) { var hb = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.035, 6, 32), DG); hb.position.y = y; hb.rotation.x = Math.PI / 2; c.group.add(hb); });
        c.box(0.12, 1.3, 0.02, MAT.glass, 0, 4.35, 1.06); c.box(0.16, 1.34, 0.01, DG, 0, 4.35, 1.05);
        // the discharge: a butterfly valve with a handle, the rotary feeder, the vacuum loader pipe up and over to the moulder
        c.cyl(0.2, 0.25, DG, 0, 2.18, 0, 12); c.cyl(0.26, 0.05, DG, 0, 2.08, 0, 12); c.cyl(0.26, 0.05, DG, 0, 1.96, 0, 12); c.box(0.35, 0.04, 0.04, MAT.red, 0.2, 2.02, 0.15); c.cyl(0.2, 0.2, DG, 0, 1.85, 0, 12);
        var feeder = box(0.6, 0.5, 0.5, MAT_MACH.blue, 0, 1.5, 0, hdyn); var fm = c.cyl(0.12, 0.3, DG, 0.45, 1.5, 0, 12); fm.rotation.z = Math.PI / 2; c.cyl(0.14, 0.05, MAT.black, 0.62, 1.5, 0, 12).rotation.z = Math.PI / 2;
        c.cyl(0.12, 0.5, MAT.steel, 0, 1.5, 0.45, 12).rotation.x = Math.PI / 2; var r1 = c.cyl(0.12, 1.1, MAT.steel, 0.3, 2.0, 0.9, 12); r1.rotation.set(0, 0, 0); c.cyl(0.14, 0.1, MAT.steel, 0.3, 1.5, 0.9, 12); c.cyl(0.14, 0.1, MAT.steel, 0.3, 2.5, 0.9, 12);
        var pipe = c.cyl(0.12, 5.2, MAT.steel, 2.9, 2.55, 0.9, 12); pipe.rotation.z = Math.PI / 2; c.cyl(0.13, 0.3, MAT.steel, 0.55, 2.55, 0.9, 12).rotation.z = Math.PI / 2; var drop = c.cyl(0.12, 0.9, MAT.steel, 5.5, 3.0, 0.9, 12); c.cyl(0.14, 0.1, MAT.steel, 5.5, 2.5, 0.9, 12);
        [1.8, 3.6].forEach(function (sx) { c.box(0.06, 0.4, 0.06, DG, sx, 2.25, 0.9); c.box(0.06, 0.06, 0.4, DG, sx, 2.05, 0.9); c.box(0.3, 0.06, 0.06, DG, sx, 2.72, 0.9); });
        // the caged ladder on the +z side, up to the lid
        [-0.22, 0.22].forEach(function (x) { c.box(0.05, 5.0, 0.05, DG, x, 2.55, 1.2); }); for (var r = 0.3; r < 5.1; r += 0.3) c.box(0.5, 0.03, 0.03, DG, 0, r, 1.2);
        for (var cg = 2.4; cg < 5.2; cg += 0.7) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.2); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); } [-0.42, 0, 0.42].forEach(function (sx2) { c.box(0.04, 3.0, 0.03, MAT_MACH.guard, sx2, 3.8, 1.2 + (sx2 === 0 ? 0.42 : 0)); });
        c.box(0.6, 0.04, 0.5, DG, 0, 5.25, 1.3); c.box(0.03, 0.9, 0.03, DG, -0.3, 5.7, 1.55); c.box(0.03, 0.9, 0.03, DG, 0.3, 5.7, 1.55); c.box(0.64, 0.03, 0.03, DG, 0, 6.15, 1.55);
        // the level gauge cabinet on a bracket between two legs, the tip point in front: a steel kerb, hazard plate, the sign on a stand
        c.box(0.6, 0.06, 0.4, DG, -1.2, 1.0, 0.85); c.box(0.06, 1.0, 0.06, DG, -1.45, 0.5, 0.85); c.box(0.06, 1.0, 0.06, DG, -0.95, 0.5, 0.85);
        cabinet(c, -1.2, 1.35, 0.85, 0.44, 0.6, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: -1.2, y: 1.45, z: 0.965, ry: 0, parent: c.group, title: 'Hopper', draw: hopperScreenDraw }); scr.mesh.userData.propId = 'hopper';
        MACH.hopper.lamps = lampStack(c, -1.2, 1.7, 0.85);
        c.box(2.4, 0.012, 1.6, MAT.hazard, 0, 0.006, -1.9); c.box(2.4, 0.1, 0.1, MAT.yellow, 0, 0.05, -2.7); c.box(0.1, 0.1, 1.6, MAT.yellow, -1.2, 0.05, -1.9); c.box(0.1, 0.1, 1.6, MAT.yellow, 1.2, 0.05, -1.9);
        c.cyl(0.02, 1.3, DG, 1.5, 0.65, -1.2, 8); c.cyl(0.12, 0.03, DG, 1.5, 0.015, -1.2, 12); c.sign(['TIP POINT', 'raw granulate pallets only'], 0.7, 0.36, 1.5, 1.4, -1.2, Math.PI, { w: 384, h: 200, bg: '#f5b53d', fg: '#1a1205' });
        MACH.hopper.anim = { feeder: feeder, tipT: 0 };
        c.hit(2.6, 2.6, 4.0, 0, 1.3, -0.6, { prompt: function () { return hopperPrompt(); }, use: function () { hopperUse(); } });
        c.solid(-1.0, 1.0, -1.0, 1.4, 0, 2.3); c.solid(-1.5, -0.9, 0.7, 1.0, 0, 1.8);
      }
    /* 06-props2-factory.js */
    function palletiserBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        c.box(2.6, 0.08, 2.6, DG, 0, 0.04, 0); c.box(2.62, 0.03, 2.62, MAT.hazard, 0, 0.085, 0);
        [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.2, 3.0, 0.2, MAT_MACH.blue, p[0], 1.5, p[1]); c.box(0.36, 0.04, 0.36, DG, p[0], 0.1, p[1]); });
        c.box(2.4, 0.2, 0.2, MAT_MACH.blue, 0, 3.0, -1.1); c.box(2.4, 0.2, 0.2, MAT_MACH.blue, 0, 3.0, 1.1); c.box(0.2, 0.2, 2.4, MAT_MACH.blue, -1.1, 3.0, 0); c.box(0.2, 0.2, 2.4, MAT_MACH.blue, 1.1, 3.0, 0);
        c.box(0.06, 2.6, 0.06, DG, -1.1, 1.5, 0); c.box(0.06, 0.06, 2.2, DG, -1.1, 2.0, 0); c.plane(2.2, 1.6, MAT.mesh, -1.12, 1.9, 0, 0, Math.PI / 2);
        // the pusher on its gantry: a carriage on two rails, a vertical ram, the plate
        c.box(0.12, 0.12, 2.3, DG, -0.5, 2.85, 0); c.box(0.12, 0.12, 2.3, DG, 0.5, 2.85, 0); c.box(1.2, 0.3, 0.6, LG, 0, 2.72, 0); c.cyl(0.09, 0.9, MAT.chrome, 0, 2.2, 0, 10); c.box(1.0, 0.1, 1.0, LG, 0, 1.75, 0); c.box(0.9, 0.04, 0.9, MAT_MACH.rubber, 0, 1.68, 0);
        for (var rz = -0.75; rz <= 0.75; rz += 0.15) { var r = c.cyl(0.03, 1.5, MAT_MACH.roller, 0, 0.3, rz, 8); r.rotation.z = Math.PI / 2; } c.box(1.6, 0.06, 0.06, DG, 0, 0.33, -0.82); c.box(1.6, 0.06, 0.06, DG, 0, 0.33, 0.82); [-0.78, 0.78].forEach(function (x) { c.box(0.06, 0.3, 1.7, DG, x, 0.18, 0); });
        for (var iz = -1.6; iz < -0.9; iz += 0.12) { var ir = c.cyl(0.03, 0.62, MAT_MACH.roller, 0, BELT_Y - 0.02, iz, 8); ir.rotation.z = Math.PI / 2; } c.box(0.05, 0.1, 0.8, DG, -0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.1, 0.8, DG, 0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.7, 0.05, DG, -0.3, 0.35, -1.5); c.box(0.05, 0.7, 0.05, DG, 0.3, 0.35, -1.5);
        var slide = c.box(0.7, 0.03, 0.5, MAT_MACH.roller, 0, 0.55, -0.95); slide.rotation.x = -0.5;
        [-1.3, 1.3].forEach(function (x) { c.box(0.08, 1.8, 0.08, MAT.yellow, x, 0.9, -1.25); c.box(0.02, 1.6, 0.02, glowMat(0xff3b2f, 0.6), x, 0.9, -1.2); });
        var cab = new THREE.Mesh(bevelGeo(0.5, 1.4, 0.4, 0.03), LG); cab.position.set(1.4, 0.8, 0.6); c.group.add(cab); c.box(0.52, 0.2, 0.42, DG, 1.4, 0.1, 0.6); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.4, y: 1.15, z: 0.81, ry: 0, parent: c.group, title: 'Palletiser', draw: palletiserScreenDraw }); scr.mesh.userData.propId = 'palletiser';
        eStop(c, 1.4, 0.75, 0.81); MACH.palletiser.lamps = lampStack(c, 1.4, 1.5, 0.6);
        c.box(1.6, 0.012, 1.4, MAT.hazard, 2.4, 0.006, 0); c.sign(['PALLET DROP · KEEP CLEAR'], 1.4, 0.16, 2.4, 0.008, -0.8, 0, { w: 512, h: 56, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }).rotation.x = -Math.PI / 2;
        c.sign(['PALLETISER'], 1.6, 0.4, 0, 3.3, 0, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
        c.hit(2.6, 3.2, 2.6, 0, 1.6, 0, { prompt: function () { return palletiserPrompt(); }, use: function () { palletiserUse(); } });
        c.solid(-1.2, 1.2, -1.2, 1.2, 0, 3); c.solid(-0.4, 0.4, -1.7, -1.2, 0, 0.9); c.solid(1.15, 1.65, 0.4, 0.8, 0, 1.8);
      }
    /* 06-props2-factory.js */
    function beltMainBuild(c) { conveyorBuild(c, 0, 0, 10.4, {}); c.box(0.8, 0.03, 0.04, MAT.hazard, 0, 1.6, 8.5); }
    /* 06-props2-factory.js */
    function siloBuild(c) {
        [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.16, 3.2, 0.16, MAT_MACH.frame, p[0], 1.6, p[1]); c.box(0.5, 0.05, 0.5, MAT.grey, p[0], 0.02, p[1]); });
        c.cyl(1.5, 1.6, MAT_MACH.panel, 0, 4.0, 0, 24, 0.3); c.cyl(1.5, 5.2, MAT_MACH.panel, 0, 7.4, 0, 24); c.cyl(1.5, 0.6, MAT_MACH.panel, 0, 10.3, 0, 24, 0.2); c.cyl(0.25, 0.4, MAT_MACH.frame, 0, 10.8, 0, 12);
        for (var r = 4.9; r < 10; r += 1.3) { var ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 32), MAT_MACH.frame); ring.position.y = r; ring.rotation.x = Math.PI / 2; c.group.add(ring); }
        [-0.2, 0.2].forEach(function (x) { c.box(0.05, 10, 0.05, MAT_MACH.frame, x, 5.0, 1.62); }); for (var lr = 0.4; lr < 10; lr += 0.3) c.box(0.44, 0.03, 0.03, MAT_MACH.frame, 0, lr, 1.62); for (var cg = 3; cg < 10; cg += 0.6) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.62); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); }
        var out = c.cyl(0.16, 2.2, MAT.steel, 1.1, 2.4, 0, 12); out.rotation.z = -0.9; c.box(0.6, 0.5, 0.4, MAT_MACH.blue, 0, 2.6, 0); c.cyl(0.12, 0.06, MAT.white, 0.8, 5.5, 1.3, 12).rotation.x = Math.PI / 2;
        c.sign(['RAW GRANULATE · 40 t'], 2.0, 0.5, 0, 6.5, 1.52, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }); c.box(1.2, 0.012, 1.2, MAT.hazard, 2.4, 0.006, 0);
        c.solid(-1.6, 1.6, -1.6, 1.8, -2, 12);
      }
    /* 06-props2-factory.js */
    function qcBenchBuild(c) {
        c.box(1.6, 0.05, 0.7, std({ color: 0x3a3e45, roughness: 0.35 }), 0, 0.9, 0); [[-0.72, -0.28], [0.72, -0.28], [-0.72, 0.28], [0.72, 0.28]].forEach(function (p) { c.box(0.05, 0.9, 0.05, MAT_MACH.frame, p[0], 0.45, p[1]); }); c.box(1.5, 0.04, 0.6, MAT_MACH.frame, 0, 0.3, 0);
        c.box(0.04, 0.4, 0.56, MAT.black, 0.55, 1.18, -0.1); var scr = touchScreen({ w: 320, h: 220, pw: 0.5, ph: 0.34, x: 0.53, y: 1.2, z: -0.1, ry: -Math.PI / 2, parent: c.group, title: 'Quality station', draw: qcScreenDraw }); scr.mesh.userData.propId = 'qcBench'; c.box(0.2, 0.03, 0.2, MAT_MACH.frame, 0.55, 0.93, -0.1);
        c.box(0.34, 0.03, 0.14, MAT.black, -0.1, 0.94, 0.15); c.box(0.08, 0.02, 0.1, MAT.chrome, -0.5, 0.93, 0.2); c.cyl(0.01, 0.3, MAT.chrome, -0.5, 0.93, 0.05, 6).rotation.x = Math.PI / 2;
        c.box(0.26, 0.2, 0.26, std({ color: 0x2f6b9a, roughness: 0.6 }), -0.4, 1.03, -0.15); c.box(0.22, 0.14, 0.22, std({ color: 0x6b8e23, roughness: 0.6 }), -0.05, 1.0, -0.2); c.cyl(0.12, 0.12, std({ color: 0xb5651d, roughness: 0.6 }), 0.25, 0.99, -0.2, 12, 0.09);
        c.box(0.3, 0.02, 0.2, MAT.paper, 0.1, 0.93, 0.22); c.cyl(0.006, 0.14, MAT.black, 0.18, 0.95, 0.24, 6).rotation.x = Math.PI / 2;
        c.cyl(0.16, 0.04, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.62, 0.7, 14); c.cyl(0.02, 0.6, MAT_MACH.frame, 0, 0.3, 0.7, 8); c.cyl(0.2, 0.02, MAT_MACH.frame, 0, 0.01, 0.7, 14);
        c.sign(['QUALITY', 'first-off checks every batch'], 1.0, 0.3, 0, 1.9, -0.36, 0, { w: 512, h: 150, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-0.8, 0.8, -0.35, 0.35, 0, 1.0);
      }
    /* 06-props2-factory.js */
    function qcScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'QUALITY', factoryStatus().toUpperCase()); scText(c, 16, 70, 'Product: ' + skuName(F.product), '#eef1f5', 15); scText(c, 16, 92, 'Made ' + F.made + ' · hopper ' + F.raw, '#a0acb8', 13); scText(c, 16, 114, 'Weight 412 g · wall 2.1 mm · OK', '#5fd38d', 13); scText(c, 16, 136, 'Shrink 0.4% · flash none', '#5fd38d', 13); scText(c, 16, 170, 'Last check day ' + S.day + ' ' + fmtTime(Math.floor(S.time)), '#6b7784', 11); }
    /* 06-props2-factory.js */
    function toolCabBuild(c) {
        var RED = std({ color: 0xb3261e, roughness: 0.45, metalness: 0.3 }); var body = new THREE.Mesh(bevelGeo(0.9, 1.0, 0.5, 0.02), RED); body.position.set(0, 0.55, 0); body.castShadow = true; c.group.add(body); c.box(0.92, 0.04, 0.52, MAT.black, 0, 1.07, 0);
        for (var d = 0; d < 5; d++) { c.box(0.8, 0.14, 0.02, RED, 0, 0.22 + d * 0.17, 0.26); c.box(0.4, 0.02, 0.03, MAT.chrome, 0, 0.26 + d * 0.17, 0.28); } [-0.35, 0.35].forEach(function (x) { [-0.18, 0.18].forEach(function (z) { c.cyl(0.05, 0.04, MAT.black, x, 0.02, z, 10).rotation.x = Math.PI / 2; }); });
        c.box(0.3, 0.05, 0.3, MAT.black, -0.2, 1.12, 0); c.cyl(0.02, 0.3, MAT.chrome, 0.25, 1.24, 0.1, 6).rotation.z = 0.3; c.box(0.12, 0.04, 0.03, MAT.chrome, 0.2, 1.1, 0.12);
        c.solid(-0.5, 0.5, -0.3, 0.3, 0, 1.2);
      }
    /* 06-props2-factory.js */
    function workbenchBuild(c) {
        c.box(2.0, 0.08, 0.8, MAT.wood, 0, 0.9, 0); [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]].forEach(function (p) { c.box(0.06, 0.9, 0.06, MAT_MACH.frame, p[0], 0.45, p[1]); }); c.box(1.9, 0.04, 0.7, MAT_MACH.frame, 0, 0.25, 0);
        c.box(0.3, 0.2, 0.2, MAT_MACH.frame, 0.6, 1.04, 0.2); c.box(0.08, 0.1, 0.24, MAT.chrome, 0.6, 1.1, 0.2); c.cyl(0.015, 0.3, MAT.chrome, 0.75, 1.08, 0.2, 6).rotation.z = Math.PI / 2;
        c.box(1.9, 1.0, 0.05, std({ color: 0xf0e6cf, roughness: 0.9 }), 0, 1.5, -0.4); for (var k = 0; k < 8; k++) { var tx = -0.8 + k * 0.23; c.cyl(0.01, 0.1, MAT.chrome, tx, 1.5, -0.33, 6).rotation.x = Math.PI / 2; c.box(0.04, 0.25 + (k % 3) * 0.08, 0.02, k % 2 ? MAT.black : MAT_MACH.frame, tx, 1.3, -0.33); }
        c.box(0.25, 0.1, 0.18, std({ color: 0x2f6b9a, roughness: 0.6 }), -0.6, 0.99, 0.1); c.box(0.2, 0.08, 0.12, MAT.yellow, -0.2, 0.98, 0.15); c.cyl(0.05, 0.14, MAT.white, 0.1, 1.01, -0.2, 10);
        c.sign(['MAINTENANCE'], 0.9, 0.22, 0, 2.2, -0.4, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-1.0, 1.0, -0.45, 0.4, 0, 1.0);
      }
    /* 06-props2-factory.js */
    function mouldRackBuild(c) {
        [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (p) { c.box(0.08, 2.0, 0.08, MAT_MACH.blue, p[0], 1.0, p[1]); }); [0.3, 1.0, 1.7].forEach(function (y) { c.box(1.9, 0.05, 0.9, MAT_MACH.frame, 0, y, 0); });
        [[-0.55, 0.3], [0.2, 0.3], [-0.5, 1.0], [0.3, 1.0], [-0.4, 1.7]].forEach(function (p, i) { c.box(0.6, 0.45, 0.6, MAT_MACH.roller, p[0], p[1] + 0.25, 0, 0); c.box(0.62, 0.04, 0.62, MAT_MACH.frame, p[0], p[1] + 0.49, 0); c.sign(['M-' + (i + 1)], 0.2, 0.08, p[0], p[1] + 0.25, 0.31, 0, { w: 128, h: 48, bg: '#f5b53d', fg: '#1a1205' }); });
        c.sign(['MOULD STORE'], 0.9, 0.22, 0, 2.15, 0.45, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' });
        c.solid(-1.0, 1.0, -0.5, 0.5, 0, 2.2);
      }
    /* 06-props2-factory.js */
    function chillerBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        var body = new THREE.Mesh(bevelGeo(2.2, 1.9, 1.1, 0.04), LG); body.position.set(0, 1.05, 0); body.castShadow = true; c.group.add(body); c.box(2.24, 0.12, 1.14, DG, 0, 0.06, 0); c.box(2.24, 0.06, 1.14, DG, 0, 2.03, 0);
        for (var g = -0.95; g < 0.95; g += 0.075) { c.box(0.03, 1.4, 0.02, DG, g, 1.05, 0.56); c.box(0.03, 1.4, 0.02, DG, g, 1.05, -0.56); }
        [-0.55, 0.55].forEach(function (x) { c.cyl(0.42, 0.06, DG, x, 2.09, 0, 24); var fan = c.cyl(0.34, 0.03, MAT.black, x, 2.13, 0, 20); for (var b = 0; b < 6; b++) { var bl = box(0.6, 0.01, 0.1, DG, 0, 0, 0, fan); bl.rotation.y = b * 1.047; } c.cyl(0.06, 0.08, MAT.black, x, 2.17, 0, 10); var guard = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 24), DG); guard.position.set(x, 2.2, 0); guard.rotation.x = Math.PI / 2; c.group.add(guard); for (var sp = 0; sp < 4; sp++) { var spk = box(0.8, 0.01, 0.02, DG, 0, 0, 0, fan); spk.position.y = 0.07; spk.rotation.y = sp * 0.785; } });
        c.box(0.6, 0.5, 1.0, DG, 1.4, 0.5, 0); var pump = c.cyl(0.18, 0.5, MAT_MACH.blue, 1.4, 0.95, 0, 14); pump.rotation.z = Math.PI / 2; c.cyl(0.08, 0.3, DG, 1.4, 1.2, 0, 10);
        cabinet(c, -0.6, 1.3, 0.62, 0.5, 0.6, 0.12); c.plane(0.3, 0.14, MAT.screen, -0.6, 1.4, 0.69, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), -0.75, 1.15, 0.69); c.box(0.04, 0.04, 0.02, glowMat(0xf5b53d, 1.2), -0.68, 1.15, 0.69);
        [[-0.8, MAT.blue], [-0.6, MAT.red]].forEach(function (p) { var pp = c.cyl(0.05, 1.2, p[1], p[0], 0.5, -0.9, 10); pp.rotation.x = Math.PI / 2; var pd = c.cyl(0.05, 0.9, p[1], p[0], 0.45, -1.5, 10); c.cyl(0.07, 0.06, DG, p[0], 0.5, -1.5, 10); });
        c.box(0.7, 0.2, 0.3, MAT_MACH.blue, -0.7, 0.1, -1.5); c.sign(['CHILLER · 12 kW · 10 °C'], 1.1, 0.14, 0.3, 1.75, 0.57, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-1.15, 1.75, -0.6, 0.6, 0, 2.3);
      }
    /* 06-props2-factory.js */
    function dryerBuild(c) {
        var LG = MAT_MACH.panel, DG = MAT_MACH.frame;
        var cab = new THREE.Mesh(bevelGeo(1.2, 1.5, 0.9, 0.04), LG); cab.position.set(0, 0.85, 0); cab.castShadow = true; c.group.add(cab); c.box(1.24, 0.12, 0.94, DG, 0, 0.06, 0); c.box(1.24, 0.06, 0.94, DG, 0, 1.63, 0);
        c.box(0.5, 1.1, 0.02, std({ color: 0xcfd4d9, roughness: 0.5 }), -0.3, 0.85, 0.46); c.box(0.03, 0.12, 0.03, MAT.chrome, -0.1, 0.85, 0.48); c.plane(0.3, 0.16, MAT.screen, 0.3, 1.25, 0.465, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.18, 1.0, 0.465); c.box(0.04, 0.04, 0.02, glowMat(0xf5b53d, 1.2), 0.28, 1.0, 0.465); eStop(c, 0.42, 0.95, 0.465);
        [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].forEach(function (p) { c.box(0.1, 0.9, 0.1, DG, p[0], 2.1, p[1]); }); c.box(1.1, 0.08, 0.9, DG, 0, 2.55, 0);
        c.cyl(0.55, 0.7, LG, 0, 2.3, 0, 18, 0.14); c.cyl(0.55, 1.3, LG, 0, 3.3, 0, 18); [2.9, 3.5].forEach(function (y) { var b = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 24), DG); b.position.y = y; b.rotation.x = Math.PI / 2; c.group.add(b); });
        c.cyl(0.55, 0.06, LG, 0, 3.98, 0, 18); c.cyl(0.45, 0.2, DG, 0, 4.05, 0, 18, 0.3); c.cyl(0.14, 0.2, DG, 0, 4.2, 0, 12); c.box(0.4, 0.3, 0.3, MAT_MACH.blue, 0, 4.3, -0.5); c.box(0.08, 0.5, 0.08, DG, 0, 3.9, -0.5);
        c.box(0.5, 0.6, 0.5, DG, 0.95, 0.95, 0); c.cyl(0.2, 0.4, MAT.black, 0.95, 1.4, 0, 14); c.cyl(0.14, 0.5, LG, 0.95, 1.85, 0, 12); c.cyl(0.16, 0.05, DG, 0.95, 2.1, 0, 12);
        var h1 = c.cyl(0.05, 2.2, MAT.black, 0.75, 3.2, 0.3, 8); h1.rotation.z = 0.35; var h2 = c.cyl(0.05, 1.4, MAT.black, 0.6, 1.0, 0.5, 8); h2.rotation.z = -0.5;
        c.sign(['GRANULATE DRYER', 'desiccant · 80 °C'], 0.8, 0.26, -0.1, 1.5, 0.47, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-0.65, 1.25, -0.5, 0.5, 0, 2.0);
      }
    /* 06-props2-factory.js */
    function switchboardBuild(c) {
        c.box(1.4, 1.8, 0.25, std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }), 0, 1.4, -0.12); c.box(1.42, 0.05, 0.27, MAT_MACH.frame, 0, 2.3, -0.12);
        [-0.35, 0.35].forEach(function (x) { c.box(0.62, 1.6, 0.02, std({ color: 0xcfd4d9, roughness: 0.5 }), x, 1.4, 0.01); c.box(0.03, 0.1, 0.03, MAT.chrome, x + 0.25, 1.4, 0.03); });
        for (var k = 0; k < 6; k++) { c.box(0.06, 0.1, 0.03, k < 4 ? MAT.black : MAT.red, -0.6 + k * 0.1, 2.05, 0.025); } c.box(0.14, 0.14, 0.05, MAT.red, 0.4, 2.05, 0.03); c.cyl(0.04, 0.04, MAT.black, 0.4, 2.05, 0.06, 10).rotation.x = Math.PI / 2; c.box(0.02, 0.08, 0.02, glowMat(0x5fd38d, 1.2), -0.5, 1.85, 0.03);
        c.sign(['⚡ 400 V · ISOLATE BEFORE OPENING'], 1.2, 0.14, 0, 0.9, 0.025, 0, { w: 512, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['PRODUCTION DB'], 0.8, 0.16, 0, 2.2, 0.025, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
        for (var t = 0; t < 4; t++) c.cyl(0.03, 1.5, MAT.black, -0.4 + t * 0.25, 3.0, -0.1, 6);
        c.solid(-0.7, 0.7, -0.25, 0.05, 0, 2.4);
      }
    /* 06-props2-factory.js */
    function partsShelfBuild(c) {
        [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]].forEach(function (p) { c.box(0.05, 2.0, 0.05, MAT_MACH.frame, p[0], 1.0, p[1]); }); [0.1, 0.6, 1.1, 1.6].forEach(function (y) { c.box(1.85, 0.03, 0.65, MAT_MACH.frame, 0, y, 0); });
        if (!partsShelfBuild.mats) partsShelfBuild.mats = [0x2f6b9a, 0xb3261e, 0xf5b53d, 0x6b8e23, 0x3a4149].map(function (col) { return std({ color: col, roughness: 0.6 }); });   // five materials for the 24 bins, not 24
        for (var s = 0; s < 4; s++) for (var b = 0; b < 6; b++) { var bm = partsShelfBuild.mats[(s + b) % 5]; c.box(0.26, 0.2, 0.4, bm, -0.75 + b * 0.3, 0.1 + s * 0.5 + 0.12, 0.05); }
        c.sign(['SPARES'], 0.6, 0.18, 0, 2.15, 0.33, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#eef1f5' });
        c.solid(-0.95, 0.95, -0.35, 0.35, 0, 2.1);
      }
    /* 06-props2-factory.js */
    function shiftBoardBuild(c) { c.box(1.6, 1.0, 0.04, MAT.white, 0, 1.9, 0); c.box(1.64, 1.04, 0.02, MAT_MACH.frame, 0, 1.9, -0.015); var scr = touchScreen({ w: 400, h: 250, pw: 1.5, ph: 0.92, x: 0, y: 1.9, z: 0.025, ry: 0, parent: c.group, title: 'Shift board', draw: function (cc, sc) { cc.fillStyle = '#f7f7f4'; cc.fillRect(0, 0, sc.w, sc.h); cc.fillStyle = '#1b232c'; cc.font = 'bold 26px Bahnschrift, Arial'; cc.fillText('SHIFT OUTPUT · DAY ' + S.day, 16, 36); cc.font = '18px Bahnschrift, Arial'; cc.fillStyle = '#2f6b9a'; cc.fillText('Boxes moulded today: ' + (S.factory.madeOn === S.day ? (S.factory.madeDay || 0) : 0) + ' · all time ' + S.factory.made, 16, 80); cc.fillText('Pallets finished: ' + (S.stats.palletised || 0), 16, 108); cc.fillText('Hopper: ' + S.factory.raw + ' units', 16, 136); cc.fillStyle = S.factory.jam ? '#b3261e' : '#1e7a3a'; cc.fillText('Jams: ' + (S.factory.jam ? 'LINE JAMMED' : 'none'), 16, 164); cc.fillStyle = '#6b7784'; cc.font = '14px Bahnschrift, Arial'; cc.fillText('Target 60 a day · keep the hopper above 40', 16, 220); } }); scr.mesh.userData.propId = 'shiftBoard'; c.box(0.4, 0.03, 0.06, MAT_MACH.frame, 0, 1.36, 0.03); c.cyl(0.01, 0.12, MAT.black, 0.1, 1.4, 0.05, 6).rotation.z = Math.PI / 2; }
    /* 06-props2-factory.js */
    function arcPath(dir) { var R = 1.5, pts = []; for (var k = 0; k <= 6; k++) { var a = k / 6 * Math.PI / 2; pts.push([dir * (R - R * Math.cos(a)), R * Math.sin(a), 0]); } return pts; }
    /* 06-props2-factory.js */
    var BELT_PIECES = {
        beltS2: { label: 'belt, 2 m', ico: '➖', price: 120, desc: 'A straight run.', path: [[0, 0, 0], [0, 2, 0]] },
        beltS4: { label: 'belt, 4 m', ico: '➖', price: 200, desc: 'A longer straight run.', path: [[0, 0, 0], [0, 4, 0]] },
        beltCL: { label: 'belt, curve left', ico: '↰', price: 220, desc: 'A quarter turn to the left.', path: arcPath(1) },
        beltCR: { label: 'belt, curve right', ico: '↱', price: 220, desc: 'A quarter turn to the right.', path: arcPath(-1) },
        beltUp: { label: 'belt, incline up', ico: '⬈', price: 260, desc: 'Climbs a metre over three.', path: [[0, 0, 0], [0, 3, 1]] },
        beltDown: { label: 'belt, incline down', ico: '⬊', price: 260, desc: 'Drops a metre over three.', path: [[0, 0, 0], [0, 3, -1]] },
        beltHigh: { label: 'belt, high run', ico: '⤒', price: 240, desc: 'A 4 m run hung from the roof two metres up, for crossing a lane. Two inclines reach it.', path: [[0, 0, 2.0], [0, 4, 2.0, 'hang']] }
      };
    /* 06-props2-factory.js */
    function beltPieceBuild(kind) { return function (c, P) { var h = P.h || 0, pts = BELT_PIECES[kind].path.map(function (p) { return [p[0], p[1], (p[2] || 0) + h, p[3]]; }); conveyorPath(c, pts); }; }
    /* 06-props2-factory.js */
    function wallSignBuild(lines, w, h, y, opt) { return function (c) { var o = {}; for (var k in opt) o[k] = opt[k]; if (o.plate === undefined) o.plate = true; c.sign(lines, w, h, 0, y, 0.012, 0, o); }; }
    /* 06-props2-factory.js */
    function floorSignBuild(lines, w, h, opt) { return function (c) { var m = c.sign(lines, w, h, 0, 0.008, 0, 0, opt); m.rotation.x = -Math.PI / 2; }; }
    /* 06-props2-factory.js */
    function exitSignBuild(c) { var m = c.sign(['EXIT'], 0.5, 0.2, 0, 2.6, 0.03, 0, { w: 256, h: 96, bg: '#1f7a3a', fg: '#dfffe8' }); m.renderOrder = 1; c.box(0.54, 0.24, 0.04, MAT.exit, 0, 2.6, 0); }
    /* 06-props3-halls.js */
    var HALLS = {
        hall2: { name: 'Returns hall', x0: 10.0, x1: HALL.x, z0: -44, z1: -HALL.z, door: { x0: 17.0, x1: 20.6, h: 4.2, z: -HALL.z }, rows: [], rowZ: [], rowX0: 12.5, bays: 7, dockRet: 0, lights: [[15, -39], [23, -39], [31, -39], [15, -29], [23, -29], [31, -29]] },
        hall3: { name: 'Hall 3', x0: -HALL.x, x1: -14.0, z0: -44, z1: -HALL.z, door: { x0: -28.5, x1: -26.0, h: 3.6, z: -HALL.z }, rows: [22, 23], rowZ: [-29.5, -38.5], rowX0: -33.0, bays: 5, lights: [[-31, -39], [-23, -39], [-17, -39], [-31, -29], [-23, -29], [-17, -29]], dockIn: 2 },
        hall4: { name: 'Hall 4', x0: -14, x1: 10, z0: -64, z1: -44, door: { x0: 5.0, x1: 8.6, h: 4.2, z: -44 }, rows: [24, 25], rowZ: [-50.5, -57.5], rowX0: -12.5, bays: 7, lights: [[-8, -59], [0, -59], [8, -59], [-8, -49], [0, -49], [8, -49]] }
      };
    /* 06-props3-halls.js */
    var HALL_OF_ROW = {};
    /* 06-props3-halls.js */
    function hallOwned(id) { return !!(S.up && S.up[id]); }
    /* 06-props3-halls.js */
    function hallOfRow(r) { return HALL_OF_ROW[r] || null; }
    /* 06-props3-halls.js */
    function isAnnexRow(r) { return r >= 20; }
    /* 06-props3-halls.js */
    function annexRowOwned(r) { var h = hallOfRow(r); return !!h && hallOwned(h); }
    /* 06-props3-halls.js */
    function rowBays(r) { var h = hallOfRow(r); if (h) return HALLS[h].bays; return BOOT_STAGE === 0 ? Math.min(RACK.bays, Math.max(1, S.level)) : RACK.bays; }
    /* 06-props3-halls.js */
    function rowLetter(r) { if (r === UPPER.row) return 'U'; if (isAnnexRow(r)) return 'HIJKLM'[r - 20]; return 'ABCDEF'[r]; }
    /* 06-props3-halls.js */
    function groundRows() { var out = []; for (var r = 0; r < S.up.rows; r++) out.push(r); for (var h in HALLS) if (hallOwned(h)) HALLS[h].rows.forEach(function (r) { out.push(r); }); return out; }
    /* 06-props3-halls.js */
    function slotTotal() { var n = 0; groundRows().forEach(function (r) { n += rowBays(r) * RACK.levels.length; }); if (upperOwned()) n += RACK.bays * UPPER.levels; return n; }
    /* 06-props3-halls.js */
    function inRectH(x, z, H) { return x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1; }
    /* 06-props3-halls.js */
    function inAnnex(x, z) { for (var h in HALLS) if (hallOwned(h) && inRectH(x, z, HALLS[h])) return h; return null; }
    /* 06-props3-halls.js */
    function hallSegs(a0, a1, cuts) { var out = [[a0, a1]]; cuts.forEach(function (cc) { var nx = []; out.forEach(function (s) { if (cc[1] <= s[0] || cc[0] >= s[1]) { nx.push(s); return; } if (cc[0] > s[0]) nx.push([s[0], cc[0]]); if (cc[1] < s[1]) nx.push([cc[1], s[1]]); }); out = nx; }); return out.filter(function (s) { return s[1] - s[0] > 0.3; }); }
    /* 06-props3-halls.js */
    function hallDado(len, DH) { var m = MAT.block.clone(); m.map = MAT.block.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.6, DH / 0.8); m.normalMap = MAT.block.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(len / 1.6, DH / 0.8); return m; }
    /* 06-props3-halls.js */
    function hallColumn(c, x, z, alongZ) {
        var FR = MAT.steelDark, h = HALL.h - 0.3; c.box(alongZ ? 0.26 : 0.02, h, alongZ ? 0.02 : 0.26, FR, x, h / 2, z);
        [-0.12, 0.12].forEach(function (o) { c.box(alongZ ? 0.02 : 0.3, h, alongZ ? 0.3 : 0.02, FR, x + (alongZ ? o : 0), h / 2, z + (alongZ ? 0 : o)); });
        c.box(0.42, 0.03, 0.42, FR, x, 0.015, z); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (b) { c.cyl(0.018, 0.03, MAT.chrome, x + b[0], 0.04, z + b[1], 6); });
        c.box(0.46, 0.5, 0.46, MAT.hazard, x, 0.28, z).castShadow = false; c.solid(x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0, h);
      }
    /* 06-props3-halls.js */
    function hallFace(c, axis, at, inward, a0, a1, cuts, opts) {
        var FR = MAT.steelDark, DH = 2.4, ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), off = at + inward * 0.17, full = a1 - a0, c0 = (a0 + a1) / 2;
        hallSegs(a0 + 0.3, a1 - 0.3, cuts).forEach(function (s) { var len = s[1] - s[0], mid = (s[0] + s[1]) / 2; if (axis === 'x') { c.plane(len, DH, hallDado(len, DH), off, DH / 2, mid, 0, ry); c.box(0.06, 0.05, len, FR, off + inward * 0.02, DH + 0.025, mid); } else { c.plane(len, DH, hallDado(len, DH), mid, DH / 2, off, 0, ry); c.box(len, 0.05, 0.06, FR, mid, DH + 0.025, off + inward * 0.02); } });
        var g = at + inward * 0.22; [5.2, 6.8].forEach(function (gy) { if (axis === 'x') c.box(0.06, 0.12, full, FR, g, gy, c0); else c.box(full, 0.12, 0.06, FR, c0, gy, g); });
        if (opts.tray) { var ty = at + inward * 0.35; if (axis === 'x') { c.box(0.3, 0.08, full - 1, FR, ty, 5.6, c0); for (var t = a0 + 1; t < a1; t += 2) c.box(0.3, 0.08, 0.04, FR, ty, 5.6, t); } else { c.box(full - 1, 0.08, 0.3, FR, c0, 5.6, ty); for (var t2 = a0 + 1; t2 < a1; t2 += 2) c.box(0.04, 0.08, 0.3, FR, t2, 5.6, ty); } }
        for (var p = a0 + 4; p < a1 - 1; p += 8) { if (cuts.some(function (cc) { return p > cc[0] - 0.6 && p < cc[1] + 0.6; })) continue; hallColumn(c, axis === 'x' ? at + inward * 0.42 : p, axis === 'x' ? p : at + inward * 0.42, axis === 'x'); }
        if (opts.windows) { var wy = 6.0, ww = 2.4, wh = 1.3, woff = at + inward * 0.2; for (var wp = a0 + 2; wp < a1 - 2; wp += 4) { if (cuts.some(function (cc) { return wp > cc[0] - 1.5 && wp < cc[1] + 1.5; })) continue; if (axis === 'x') { c.box(0.04, wh + 0.12, ww + 0.12, FR, woff - inward * 0.035, wy, wp); c.plane(ww, wh, MAT.skylight, woff, wy, wp, 0, ry); c.box(0.05, wh, 0.05, FR, woff + inward * 0.01, wy, wp); c.box(0.05, 0.05, ww, FR, woff + inward * 0.01, wy, wp); } else { c.box(ww + 0.12, wh + 0.12, 0.04, FR, wp, wy, woff - inward * 0.035); c.plane(ww, wh, MAT.skylight, wp, wy, woff, 0, ry); c.box(0.05, wh, 0.05, FR, wp, wy, woff + inward * 0.01); c.box(ww, 0.05, 0.05, FR, wp, wy, woff + inward * 0.01); } } }
      }
    /* 06-props3-halls.js */
    function hallBuild(id) { return function (c) {
        var H = HALLS[id], h = HALL.h, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2, wx = H.x1 - H.x0, wz = H.z1 - H.z0, FR = MAT.steelDark, D = H.door;
        var ownW = id !== 'hall2', ownE = id !== 'hall3';   // Hall 2 leans on the wing's east wall, Hall 3 on its west wall; those stand already
        c.box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.58, cz - 0.15);   // the plinth, its top a touch under the floor so the two never flicker
        var fl = c.plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2, 0); fl.receiveShadow = true;
        c.plane(wx - 0.4, 0.12, MAT.trim, cx, 0.06, H.z0 + 0.16, 0, 0);   // the skirting line along the far wall
        var wallSeg = function (axis, at, a0, a1, y0, y1) { var len = a1 - a0, mid = (a0 + a1) / 2, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return; if (axis === 'x') { c.box(len, hh, 0.3, MAT.wall, mid, y0 + hh / 2, at); c.solid(a0, a1, at - 0.15, at + 0.15, y0 === 0 ? -1 : y0, y1 + 1); } else { c.box(0.3, hh, len, MAT.wall, at, y0 + hh / 2, mid); c.solid(at - 0.15, at + 0.15, a0, a1, y0 === 0 ? -1 : y0, y1 + 1); } };
        wallSeg('x', H.z0, H.x0 - 0.15, H.x1 + 0.15, 0, h);   // the far wall
        var dockCut = id === 'hall3' ? [DOCKS.in[2].z - DOCKS.w / 2, DOCKS.in[2].z + DOCKS.w / 2] : null, dockCutE = id === 'hall2' ? [DOCKS.ret[0].z - DOCKS.w / 2, DOCKS.ret[0].z + DOCKS.w / 2] : null;   // IN 3 in Hall 3's west wall, the returns dock in the returns hall's east wall
        if (ownW) { if (dockCut) { wallSeg('z', H.x0, H.z0, dockCut[0], 0, h); wallSeg('z', H.x0, dockCut[0], dockCut[1], DOCKS.h, h); wallSeg('z', H.x0, dockCut[1], H.z1, 0, h); } else wallSeg('z', H.x0, H.z0, H.z1, 0, h); }
        if (ownE) { if (dockCutE) { wallSeg('z', H.x1, H.z0, dockCutE[0], 0, h); wallSeg('z', H.x1, dockCutE[0], dockCutE[1], DOCKS.h, h); wallSeg('z', H.x1, dockCutE[1], H.z1, 0, h); } else wallSeg('z', H.x1, H.z0, H.z1, 0, h); }
        if (!ownW) wallSeg('z', H.x0, H.z0, H.z1, WING.h, h); if (!ownE) wallSeg('z', H.x1, H.z0, H.z1, WING.h, h); if (id === 'hall4') wallSeg('x', H.z1, H.x0 - 0.15, H.x1 + 0.15, WING.h, h);   // the wing's walls are two metres lower: the strip above them is this hall's
        // the roof: slab, inner face, three skylight strips, trusses along z, purlins across, two roof vents
        c.box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); c.plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2, 0);
        [H.z0 + 4.5, cz, H.z1 - 4.5].forEach(function (z) { var sk = c.plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2, 0); lampMeshes.push(sk); });
        for (var tx = Math.ceil((H.x0 + 2) / 8) * 8; tx < H.x1 - 1; tx += 8) c.box(0.25, 0.6, wz - 0.4, FR, tx, h - 0.35, cz);
        for (var pz = H.z0 + 3; pz < H.z1 - 1; pz += 4) c.box(wx - 0.4, 0.12, 0.12, FR, cx, h - 0.1, pz);
        [cx - wx / 4, cx + wx / 4].forEach(function (vx) { c.cyl(0.45, 0.6, MAT.steel, vx, h + 0.6, cz, 12); c.cyl(0.6, 0.15, FR, vx, h + 0.95, cz, 12); });
        H.lights.forEach(function (p, i) { highBay(p[0], 7.6, p[1], HALL.h);   /* 7.6 like the main hall's (the light at 7.3 sits just above the lens); at 7.0 the lamp hung 0.6 m lower with the light inside the ballast box */ var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l); });
        // the inside faces: the far wall with the tray and windows, the wall it opens off with the doorway cut, the two sides
        var dcut = [D.x0 - 0.1, D.x1 + 0.1];
        hallFace(c, 'z', H.z0, 1, H.x0, H.x1, [], { windows: true, tray: true });
        hallFace(c, 'z', H.z1, -1, H.x0, H.x1, [dcut], { windows: false });
        hallFace(c, 'x', H.x0, 1, H.z0, H.z1, dockCut ? [dockCut] : [], { windows: ownW });
        hallFace(c, 'x', H.x1, -1, H.z0, H.z1, dockCutE ? [dockCutE] : [], { windows: ownE });
        // the doorway: jambs and a lintel, a strip curtain, the hall's name over it on both sides, the way out inside, bollards, hazard strips
        var dcx = (D.x0 + D.x1) / 2, dz = D.z, dw = D.x1 - D.x0, strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
        [D.x0 - 0.1, D.x1 + 0.1].forEach(function (jx) { c.box(0.2, D.h, 0.5, FR, jx, D.h / 2, dz); }); c.box(dw + 0.4, 0.14, 0.5, FR, dcx, D.h - 0.04, dz);
        for (var sx2 = D.x0 + 0.15; sx2 < D.x1; sx2 += 0.3) { var st = c.plane(0.28, D.h - 0.2, strip, sx2, (D.h - 0.2) / 2, dz + (sx2 * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx2 * 13) % 1 - 0.5) * 0.08; }
        c.sign([H.name.toUpperCase()], 2.0, 0.5, dcx, D.h + 0.55, dz + 0.3, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([id === 'hall4' ? 'WAY OUT  →  THE WING' : 'WAY OUT  →  MAIN HALL'], 1.8, 0.4, dcx, D.h + 0.55, dz - 0.3, Math.PI, { w: 512, h: 112, bg: '#1e7a3a', fg: '#fff' });
        [D.x0 - 0.6, D.x1 + 0.6].forEach(function (bx) { [dz - 0.9, dz + 0.9].forEach(function (bz) { if (id === 'hall3' && bz > dz) return; c.cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, 10); c.solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); }); });
        c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz - 0.9, -Math.PI / 2, 0); c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz + 0.9, -Math.PI / 2, 0);
        // floor markings: the rack block edges, the walkway along the wall you come in by, the hall's name painted at the doorway
        if (H.rows.length) { var rx0 = H.rowX0 - 0.4, rx1 = H.rowX0 + H.bays * RACK.bayW + 0.4; c.plane(0.1, wz - 1, MAT.yellowLine, rx0, 0.006, cz, -Math.PI / 2, 0); c.plane(0.1, wz - 1, MAT.yellowLine, rx1, 0.006, cz, -Math.PI / 2, 0); }   // the returns hall paints its own zones (12-machines7-returns)
        c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 1.6, -Math.PI / 2, 0); c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 2.8, -Math.PI / 2, 0);
        var lbl = new THREE.MeshBasicMaterial({ map: textTex([H.name.toUpperCase()], { w: 512, h: 128, bg: '#8b8d8e', fg: '#d9a12c' }) }); c.plane(2.2, 0.55, lbl, dcx, 0.0066, dz - 2.2, -Math.PI / 2, 0);
        // a dock door in a hall wall gets its hazard plane from buildDoor and its bollards, lamp and chocks from dressDoor, like the main hall's (this hall painted both again until 1.17.0, and they flickered)
        // outside: the gutter and downpipes on the far wall, gutters down the sides, the painted name high on the far wall inside
        c.box(wx + 0.4, 0.16, 0.16, FR, cx, h - 0.05, H.z0 - 0.25); [H.x0 + 1, H.x1 - 1].forEach(function (dx) { c.cyl(0.07, h + 1.1, FR, dx, (h - 1.2) / 2 + 0.05, H.z0 - 0.25, 8); });
        if (ownW) { c.box(0.16, 0.16, wz, FR, H.x0 - 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x0 - 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); } if (ownE) { c.box(0.16, 0.16, wz, FR, H.x1 + 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x1 + 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); }
        c.sign([H.name.toUpperCase(), 'DEPOT CO.'], 4.0, 1.2, H.x0 + 8, 4.3, H.z0 + 0.17, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d', size: 64 });   // between the columns, the text sized to the plate
      }; }
    /* 06-props3-halls.js */
    function shutterBuild(id) { return function (c) {
        if (hallOwned(id)) return;
        var D = HALLS[id].door, w = D.x1 - D.x0, cx = (D.x0 + D.x1) / 2;
        c.box(w, D.h, 0.12, MAT.door, cx, D.h / 2, D.z); for (var y = 0.5; y < D.h; y += 0.5) c.box(w, 0.04, 0.14, MAT.steelDark, cx, y, D.z);
        c.sign([HALLS[id].name.toUpperCase(), 'in the shop'], 1.6, 0.5, cx, D.h / 2, D.z + 0.08, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign([HALLS[id].name.toUpperCase()], 1.6, 0.5, cx, D.h / 2, D.z - 0.08, Math.PI, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' });
        c.solid(D.x0 - 0.1, D.x1 + 0.1, D.z - 0.2, D.z + 0.2, 0, D.h);
        c.hit(w, D.h, 0.5, cx, D.h / 2, D.z, { prompt: function () { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return HALLS[id].name + ' · ' + (u ? money(u.price) + ' in the shop' : 'not open') + (u && u.needs && !S.up[u.needs] ? ' · needs ' + upgradeName(u.needs).toLowerCase() : '') + ' · E opens the shop'; }, use: function () { sfx('click'); if (!driving && !pc.on) openPanel('pc', 'shop'); } });   // E on the shutter opens the shop page instead of clicking at nothing
      }; }
    /* 06-props3-halls.js */
    function buildHall(id) {
        var H = HALLS[id];
        if (id === 'hall2') { if (!doors[6]) { buildDoor(6, 1, DOCKS.ret[0].z); if (yard.dock) yard.dock(doors[6]); dressDoor(doors[6]); } if (propInst.returnsDesk) removePropInst('returnsDesk'); RET_PROPS.forEach(function (pid) { buildProp(pid); }); migrateReturnsHall(); if (propInst.notice) buildProp('notice'); }   // the returns hall: its dock, its fixtures, and the desk by the bench goes; the lobby timetable gains the returns truck
        if (id === 'hall3') { var sp = propPlacement('silo'); if (inRectH(sp.x, sp.z, H) || (sp.x > H.x0 - 3 && sp.x < H.x1 + 3 && sp.z > H.z0 - 3 && sp.z < H.z1 + 3)) { S.layout.silo = { x: -26, z: -50, rot: 0 }; buildProp('silo'); } if (!doors[5]) { buildDoor(5, -1, DOCKS.in[2].z); if (yard.dock) yard.dock(doors[5]); dressDoor(doors[5]); } buildProp('consoleIn2'); }
        buildProp(id); H.rows.forEach(function (r) { buildProp('rack' + r); }); buildProp('shut' + id); ['ext', 'posterExit', 'posterSmoke', 'firstAid', 'clock', 'aisle'].forEach(function (k) { if (PROPS[k + id]) buildProp(k + id); });
        NAV.dirty = true; shadowDirty = true; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); }
        logEvent(H.name + ' is open: ' + (id === 'hall2' ? 'a returns dock of its own, the belt to the intake, three inspection desks, the restock cage and the compactor. The desk by the bench has gone.' : H.rows.length + ' rack rows of ' + H.bays + ' bays' + (id === 'hall3' ? ', and IN 3 on its west wall' : '')), 'good');
      }
    /* 06-props4-furniture.js */
    var FABRIC = std({ color: 0x4a5f7a, roughness: 0.92 }), FABRIC2 = std({ color: 0x8a6d4a, roughness: 0.9 }), OAK = std({ color: 0x9a7a52, roughness: 0.7 }), WALNUT = std({ color: 0x5b3f2a, roughness: 0.65 }), CREAM = std({ color: 0xe8e2d4, roughness: 0.6 }), DARKGREY = std({ color: 0x3a4149, roughness: 0.6, metalness: 0.2 });
    /* 06-props4-furniture.js */
    var COMFORT_PROPS = { tv: 1, dartboard: 1, microwave: 1, fanStand: 1, bookshelf: 0.5, rugLobby: 0.25, rugOffice: 0.25, pictureOffice: 0.25, pictureLobby: 0.25, printer: 0 };
    /* 06-props4-furniture.js */
    var COMFORT_TYPES = { xSofa: 2, xArmchair: 1, xRoundTable: 1, xPaddedChair: 0.5, xTv: 1, xDartboard: 1, xMicrowave: 1, xFan: 1, xRug: 0.5, xBookshelf: 0.5, xPicture: 0.5, xPrinter: 0, xPlant: 0.25, xCooler: 0.5, xCot: 0.5 };
    /* 06-props4-furniture.js */
    function roomComfort() { var n = 0; for (var id in COMFORT_PROPS) if (propInst[id] && !propPlacement(id).hidden) n += COMFORT_PROPS[id]; (S.custom || []).forEach(function (cp) { if (COMFORT_TYPES[cp.type] && propInst[cp.id]) n += COMFORT_TYPES[cp.type]; }); return Math.min(10, Math.round(n * 2) / 2); }
    /* 06-props4-furniture.js */
    function breakLen() { return Math.max(0.25, 0.5 - 0.025 * roomComfort()); }
    /* 06-props4-furniture.js */
    function comfortText() { var cf = roomComfort(); return 'comfort ' + cf + '/10 · breaks ' + Math.round(breakLen() * 60) + ' min'; }
    /* 06-props4-furniture.js */
    var TV_LINES = ['Rates on the land lane hold for a third week', 'Sea freight: the port clears its backlog', 'Air parcels up a fifth on last month', 'The gatehouse union asks for a longer lunch', 'A rival depot opens two halls up the road', 'Returns are up across the trade: inspect everything', 'Forklift battery prices fall again', 'The weather desk says: bring a coat'];
    /* 06-props4-furniture.js */
    function tvDraw(cc, sc) {
        if (!powered()) { cc.fillStyle = '#05070a'; cc.fillRect(0, 0, sc.w, sc.h); scText(cc, 110, 96, 'NO SIGNAL', '#2a3340', 16); return; }
        cc.fillStyle = '#0b1a2b'; cc.fillRect(0, 0, sc.w, sc.h); var g = cc.createLinearGradient(0, 0, 0, sc.h); g.addColorStop(0, 'rgba(60,120,200,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cc.fillStyle = g; cc.fillRect(0, 0, sc.w, sc.h);
        cc.fillStyle = '#c8342a'; cc.fillRect(0, 0, sc.w, 30); scText(cc, 12, 21, 'DEPOT NEWS · DAY ' + S.day, '#fff', 15);
        var d = (S.days || [])[0];
        scText(cc, 12, 58, d ? 'Yesterday: ' + (d.shipped || 0) + ' shipped, ' + (d.late || 0) + ' late, ' + money(d.net || 0) + ' net' : 'First day on air: no figures yet', '#eef1f5', 13);
        scText(cc, 12, 80, 'Weather: ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + ' · bank ' + money(S.bank), '#a0acb8', 12);
        scText(cc, 12, 102, 'Crew: ' + S.staff.filter(function (w) { return w.clocked; }).length + ' on the clock of ' + S.staff.length + ' · ' + comfortText(), '#a0acb8', 12);
        cc.fillStyle = '#f5b53d'; cc.fillRect(0, sc.h - 28, sc.w, 28); var line = TV_LINES[(S.day + Math.floor(S.time / 2)) % TV_LINES.length]; scText(cc, 12, sc.h - 9, line, '#1a1205', 13);
      }
    /* 06-props4-furniture.js */
    function tvBuild(c, P, inst) {
        c.box(0.12, 0.3, 0.05, MAT.steelDark, 0, 1.95, 0.0); c.box(0.5, 0.06, 0.06, MAT.steelDark, 0, 1.95, 0.03);   // the wall bracket
        var bez = new THREE.Mesh(bevelGeo(1.14, 0.68, 0.035, 0.01), MAT.black); bez.position.set(0, 1.95, 0.065); bez.castShadow = true; c.group.add(bez);
        c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.5, 1.64, 0.085);
        var scr = touchScreen({ w: 320, h: 180, pw: 1.06, ph: 0.6, x: 0, y: 1.95, z: 0.084, ry: 0, parent: c.group, title: 'TV', draw: tvDraw }); scr.mesh.userData.propId = inst.id;
        c.sign(['DEPOT NEWS · the hall channel'], 0.5, 0.06, 0, 1.56, 0.07, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#a0acb8' });
        c.hit(1.2, 0.8, 0.2, 0, 1.95, 0.05, { prompt: function () { return powered() ? 'The TV · depot news' : 'The TV · no power'; }, use: function () { sfx('click'); screenDirtyAll(); } });
      }
    /* 06-props4-furniture.js */
    function dartboardBuild(c) {
        c.box(0.64, 0.64, 0.05, OAK, 0, 1.73, 0.0); c.box(0.58, 0.58, 0.012, CREAM, 0, 1.73, 0.028);
        var rings = [[0.225, MAT.black], [0.2, CREAM], [0.17, MAT.red], [0.155, CREAM], [0.1, std({ color: 0x1e7a3a, roughness: 0.6 })], [0.088, CREAM], [0.04, std({ color: 0x1e7a3a, roughness: 0.6 })], [0.016, MAT.red]];
        rings.forEach(function (r, i) { var ring = c.cyl(r[0], 0.012 + i * 0.002, r[1], 0, 1.73, 0.04 + i * 0.001, 32); ring.rotation.x = Math.PI / 2; });
        for (var k = 0; k < 20; k++) { var a = k * Math.PI / 10; var wire = c.box(0.004, 0.19, 0.004, MAT.chrome, Math.sin(a) * 0.12, 1.73 + Math.cos(a) * 0.12, 0.06); wire.rotation.z = -a; }
        [[0.03, 1.76], [-0.05, 1.7], [0.09, 1.66]].forEach(function (d, i) { var dart = new THREE.Group(); dart.position.set(d[0], d[1], 0.06); dart.rotation.x = -0.25 - i * 0.08; dart.rotation.y = (i - 1) * 0.15; c.add(dart); cyl(0.004, 0.06, MAT.chrome, 0, 0, 0.03, dart, 6).rotation.x = Math.PI / 2; cyl(0.006, 0.05, std({ color: [0xd14a3a, 0x3fa7d6, 0xf0b94d][i], roughness: 0.5 }), 0, 0, 0.085, dart, 8).rotation.x = Math.PI / 2; box(0.02, 0.028, 0.03, MAT.white, 0, 0, 0.125, dart); });
        c.sign(['DARTS · best of three · loser makes the tea'], 0.56, 0.05, 0, 1.38, 0.03, 0, { w: 512, h: 48, bg: '#1b232c', fg: '#f5b53d' });
        c.hit(0.7, 0.8, 0.2, 0, 1.7, 0.03, { prompt: function () { return 'The dartboard · ' + (S.stats.darts || 0) + ' thrown'; }, use: function () { S.stats.darts = (S.stats.darts || 0) + 1; sfx('click'); toast(pick(['Treble twenty!', 'Just inside the wire.', 'The wall takes one.', 'Bull. Nobody saw it.']), ''); } });
      }
    /* 06-props4-furniture.js */
    function microwaveBuild(c) {
        var body = new THREE.Mesh(bevelGeo(0.5, 0.3, 0.38, 0.012), CREAM); body.position.set(0, 0.15, 0); body.castShadow = true; c.group.add(body);
        c.box(0.3, 0.22, 0.01, MAT.black, -0.07, 0.15, 0.19); c.plane(0.26, 0.18, std({ color: 0x2a3340, roughness: 0.2, metalness: 0.3 }), -0.07, 0.15, 0.196, 0, 0);
        c.box(0.015, 0.2, 0.015, MAT.chrome, 0.1, 0.15, 0.2); c.box(0.1, 0.08, 0.005, MAT.black, 0.19, 0.2, 0.19); c.box(0.01, 0.01, 0.004, glowMat(0x5fd38d, 1.2), 0.19, 0.24, 0.193);
        for (var k = 0; k < 6; k++) c.box(0.02, 0.012, 0.004, DARKGREY, 0.165 + (k % 2) * 0.05, 0.1 - Math.floor(k / 2) * 0.025, 0.193);
        c.cyl(0.02, 0.01, MAT.black, -0.2, 0.005, -0.15, 8); c.cyl(0.02, 0.01, MAT.black, 0.2, 0.005, -0.15, 8); c.cyl(0.02, 0.01, MAT.black, -0.2, 0.005, 0.15, 8); c.cyl(0.02, 0.01, MAT.black, 0.2, 0.005, 0.15, 8);
        c.hit(0.55, 0.35, 0.42, 0, 0.15, 0, { prompt: function () { return powered() ? 'The microwave · two minutes on full' : 'The microwave · no power'; }, use: function () { if (!powered()) { sfx('bad'); return; } sfx('click'); toast('Two minutes on full.', ''); setTimeout(function () { if (powered() && ui.started) { sfx('chime'); toast('Ping.', ''); } }, 2200); } });   // the ping comes after the hum, not with the button
      }
    /* 06-props4-furniture.js */
    function fanStandBuild(c) {
        c.cyl(0.24, 0.03, DARKGREY, 0, 0.015, 0, 24); c.cyl(0.02, 1.1, MAT.chrome, 0, 0.58, 0, 10); c.cyl(0.05, 0.12, DARKGREY, 0, 1.18, 0, 12);
        var head = new THREE.Group(); head.position.set(0, 1.24, 0.08); head.rotation.x = -0.15; head.userData.dynamic = true; c.add(head);
        box(0.14, 0.14, 0.16, DARKGREY, 0, 0, -0.1, head); var cage = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 36), MAT.chrome); cage.position.set(0, 0, 0.04); head.add(cage); var cage2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 36), MAT.chrome); cage2.position.set(0, 0, -0.04); head.add(cage2);
        for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, bar = box(0.004, 0.46, 0.004, MAT.chrome, 0, 0, 0.045, head); bar.rotation.z = a; }
        var hub = new THREE.Group(); hub.position.set(0, 0, 0); head.add(hub); cyl(0.03, 0.03, MAT.black, 0, 0, 0, hub, 10).rotation.x = Math.PI / 2;
        for (var b = 0; b < 3; b++) { var bl = new THREE.Mesh(bevelGeo(0.07, 0.19, 0.006, 0.01), std({ color: 0xdfe6ec, roughness: 0.4, metalness: 0.3 })); bl.position.set(Math.sin(b * 2.094) * 0.11, Math.cos(b * 2.094) * 0.11, 0); bl.rotation.z = -b * 2.094; bl.rotation.y = 0.5; hub.add(bl); }
        dress.fans.push(hub); dress.fanHeads = dress.fanHeads || []; dress.fanHeads.push(head);   // the hub spins with the ceiling fans; the head sweeps side to side in tickDressing
        c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1.5);
        c.hit(0.5, 1.5, 0.5, 0, 0.75, 0, { prompt: function () { return powered() ? 'The fan · turning' : 'The fan · no power'; }, use: function () { sfx('click'); } });
      }
    /* 06-props4-furniture.js */
    function rugBuild(w, d, col, col2) { return function (c) {
        var t = tex(256, 256, function (cc, W, H) { cc.fillStyle = col; cc.fillRect(0, 0, W, H); cc.strokeStyle = col2; cc.lineWidth = 14; cc.strokeRect(14, 14, W - 28, H - 28); cc.lineWidth = 4; cc.strokeRect(34, 34, W - 68, H - 68); for (var i = 0; i < 400; i++) { cc.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12) + ')'; cc.fillRect(Math.random() * W, Math.random() * H, 2, 2); } });
        var m = c.plane(w, d, std({ map: t, roughness: 0.95 }), 0, 0.022, 0, -Math.PI / 2, 0); m.receiveShadow = true;
        c.hit(w, 0.1, d, 0, 0.05, 0, { prompt: function () { return 'A rug'; }, use: function () { sfx('click'); } });
      }; }
    /* 06-props4-furniture.js */
    function bookshelfBuild(c) {
        var W = 1.2, H = 1.9, D = 0.34; c.box(0.03, H, D, OAK, -W / 2, H / 2, 0); c.box(0.03, H, D, OAK, W / 2, H / 2, 0); c.box(W, 0.03, D, OAK, 0, H - 0.015, 0); c.box(W, 0.03, D, OAK, 0, 0.05, 0); c.box(W, H, 0.015, WALNUT, 0, H / 2, -D / 2 + 0.008);
        [0.5, 0.95, 1.4].forEach(function (y) { c.box(W - 0.06, 0.025, D - 0.02, OAK, 0, y, 0); });
        if (!bookshelfBuild.mats) bookshelfBuild.mats = [0x9c2f2f, 0x2f5a9c, 0x3f8a4a, 0xd8b04a, 0x6b4a8a, 0xe6e2d8, 0x2a2d33, 0xc8742a].map(function (col) { return std({ color: col, roughness: 0.6 }); });   // eight materials for some eighty books, not eighty: the shelf bakes into eight draws
        var cols = bookshelfBuild.mats;
        [0.065, 0.515, 0.965, 1.415].forEach(function (y, row) { var x = -W / 2 + 0.06; while (x < W / 2 - 0.1) { var bw = 0.03 + Math.random() * 0.03, bh = 0.2 + Math.random() * 0.12, lean = Math.random() < 0.12; var bk = c.box(bw, bh, D - 0.08, cols[Math.floor(Math.random() * cols.length)], x + bw / 2, y + bh / 2, 0.01); if (lean) bk.rotation.z = 0.12; x += bw + 0.004; if (Math.random() < 0.08) x += 0.06; } });
        c.box(0.28, 0.26, 0.2, std({ color: 0x9a9890, roughness: 0.5 }), 0.35, H + 0.13, 0); c.cyl(0.06, 0.18, std({ color: 0x3f8a4a, roughness: 0.7 }), -0.35, H + 0.09, 0, 10);   // a box file and a vase on top
        c.solid(-W / 2 - 0.02, W / 2 + 0.02, -D / 2 - 0.02, D / 2 + 0.02, 0, H + 0.3);
        c.hit(W + 0.1, H + 0.4, D + 0.2, 0, H / 2 + 0.15, 0, { prompt: function () { return 'The bookshelf · manuals, ledgers and a thriller somebody left'; }, use: function () { sfx('click'); toast(pick(['"Warehouse Management, 4th ed." Riveting.', '"The Pallet Murders." Chapter three is missing.', 'Last year\'s ledger. Better not.', 'A manual for a forklift you do not own.']), ''); } });
      }
    /* 06-props4-furniture.js */
    function printerBuild(c, P, inst) {
        c.box(0.6, 0.04, 0.5, MAT.trim, 0, 0.68, 0); [[-0.27, -0.22], [0.27, -0.22], [-0.27, 0.22], [0.27, 0.22]].forEach(function (l) { c.box(0.03, 0.66, 0.03, MAT.steelDark, l[0], 0.33, l[1]); }); c.box(0.56, 0.02, 0.46, MAT.steelDark, 0, 0.3, 0); c.box(0.4, 0.05, 0.3, MAT.paper, 0, 0.335, 0);
        var body = new THREE.Mesh(bevelGeo(0.5, 0.24, 0.42, 0.015), std({ color: 0xd9dde2, roughness: 0.5 })); body.position.set(0, 0.82, 0); body.castShadow = true; c.group.add(body);
        c.box(0.46, 0.04, 0.2, DARKGREY, 0, 0.96, 0.05); c.box(0.4, 0.015, 0.22, MAT.paper, 0, 0.99, -0.08); c.box(0.36, 0.01, 0.3, MAT.paper, 0, 0.71, 0.3); c.box(0.44, 0.03, 0.02, DARKGREY, 0, 0.78, 0.22);
        c.box(0.14, 0.05, 0.01, MAT.black, 0.15, 0.9, 0.215); inst.led = c.box(0.012, 0.012, 0.005, glowMat(0x5fd38d, 1.0), 0.07, 0.9, 0.217);
        c.solid(-0.32, 0.32, -0.27, 0.27, 0, 1.1);
        c.hit(0.66, 1.1, 0.56, 0, 0.55, 0, { prompt: function () { return powered() ? 'The printer · prints the day report' : 'The printer · no power'; }, use: function () { if (!powered()) { sfx('bad'); return; } sfx('scan'); var d = (S.days || [])[0]; toast(d ? 'Printed: day ' + d.day + ', ' + (d.shipped || 0) + ' shipped, ' + money(d.net || 0) + ' net' : 'Printed a blank sheet: no day report yet', ''); } });
      }
    /* 06-props4-furniture.js */
    function pictureTex(kind) {
        return tex(256, 192, function (cc, W, H) {
          if (kind === 'depot') { var g = cc.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6a35b'); g.addColorStop(0.55, '#f3c777'); g.addColorStop(1, '#4b5566'); cc.fillStyle = g; cc.fillRect(0, 0, W, H); cc.fillStyle = '#ffe9b0'; cc.beginPath(); cc.arc(190, 70, 26, 0, 6.3); cc.fill(); cc.fillStyle = '#2b3440'; cc.fillRect(30, 95, 170, 60); cc.fillRect(20, 85, 190, 12); cc.fillStyle = '#f5b53d'; cc.fillRect(70, 112, 40, 28); cc.fillRect(130, 112, 40, 28); cc.fillStyle = '#1b232c'; cc.fillRect(0, 155, W, H - 155); cc.fillStyle = '#3d4652'; cc.fillRect(205, 125, 42, 24); cc.fillRect(235, 118, 16, 10); cc.fillStyle = '#111'; cc.beginPath(); cc.arc(214, 151, 5, 0, 6.3); cc.arc(240, 151, 5, 0, 6.3); cc.fill(); }
          else if (kind === 'mountains') { var g2 = cc.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, '#5aa2e6'); g2.addColorStop(1, '#cfe6fb'); cc.fillStyle = g2; cc.fillRect(0, 0, W, H); cc.fillStyle = '#5b6f86'; cc.beginPath(); cc.moveTo(0, 150); cc.lineTo(80, 50); cc.lineTo(150, 140); cc.lineTo(200, 70); cc.lineTo(256, 150); cc.closePath(); cc.fill(); cc.fillStyle = '#eef4f8'; cc.beginPath(); cc.moveTo(62, 72); cc.lineTo(80, 50); cc.lineTo(98, 72); cc.closePath(); cc.fill(); cc.fillStyle = '#3f7fb8'; cc.fillRect(0, 150, W, 42); cc.fillStyle = '#2f6b3a'; cc.fillRect(0, 140, W, 14); }
          else { cc.fillStyle = '#eee9df'; cc.fillRect(0, 0, W, H); cc.strokeStyle = '#2b3440'; cc.lineWidth = 6; cc.strokeRect(70, 50, 116, 92); cc.beginPath(); cc.moveTo(70, 50); cc.lineTo(128, 20); cc.lineTo(186, 50); cc.stroke(); cc.fillStyle = '#f5b53d'; cc.fillRect(110, 86, 36, 56); cc.fillStyle = '#2b3440'; cc.font = 'bold 18px Bahnschrift, Arial, sans-serif'; cc.textAlign = 'center'; cc.fillText('SHIP IT', 128, 172); }
        });
      }
    /* 06-props4-furniture.js */
    function pictureBuild(kind) { return function (c) {
        var fw = 0.7, fh = 0.52; c.box(fw + 0.06, fh + 0.06, 0.03, WALNUT, 0, 1.7, 0.0); c.box(fw + 0.02, fh + 0.02, 0.01, CREAM, 0, 1.7, 0.02);
        var m = c.plane(fw - 0.04, fh - 0.04, std({ map: pictureTex(kind), roughness: 0.8 }), 0, 1.7, 0.028, 0, 0); m.receiveShadow = false;
        c.hit(0.8, 0.6, 0.12, 0, 1.7, 0.02, { prompt: function () { return kind === 'depot' ? 'A picture: the depot at sunset' : kind === 'mountains' ? 'A picture: mountains, for some reason' : 'A poster: SHIP IT'; }, use: function () { sfx('click'); } });
      }; }
    /* 06-props4-furniture.js */
    function seatBuild(width, fabric) { return function (c) {
        var w = width, d = 0.85, armW = 0.12;
        c.box(w, 0.42, d, fabric, 0, 0.21, 0); [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]].forEach(function (l) { c.cyl(0.025, 0.1, WALNUT, l[0], 0.05, l[1], 8); });
        c.box(w, 0.5, 0.22, fabric, 0, 0.6, -d / 2 + 0.11);   // the back
        var seats = width > 1.3 ? 2 : 1, sw = (w - armW * 2 - 0.04) / seats;
        for (var k = 0; k < seats; k++) { var cx = -w / 2 + armW + 0.02 + sw * (k + 0.5); var cush = new THREE.Mesh(bevelGeo(sw - 0.03, 0.14, d - 0.3, 0.04), fabric); cush.position.set(cx, 0.49, 0.05); cush.castShadow = true; c.group.add(cush); var back = new THREE.Mesh(bevelGeo(sw - 0.03, 0.42, 0.12, 0.04), fabric); back.position.set(cx, 0.72, -d / 2 + 0.26); back.rotation.x = -0.1; back.castShadow = true; c.group.add(back); }
        [-1, 1].forEach(function (s) { var arm = new THREE.Mesh(bevelGeo(armW, 0.3, d - 0.05, 0.03), fabric); arm.position.set(s * (w / 2 - armW / 2), 0.57, 0); arm.castShadow = true; c.group.add(arm); });
        if (seats === 2) { var cushion = new THREE.Mesh(bevelGeo(0.3, 0.3, 0.08, 0.04), FABRIC2); cushion.position.set(w / 2 - 0.35, 0.76, -d / 2 + 0.33); cushion.rotation.z = 0.2; c.group.add(cushion); }
        c.solid(-w / 2, w / 2, -d / 2, d / 2, 0, 1.0);
        c.hit(w + 0.1, 1.0, d + 0.1, 0, 0.5, 0, { prompt: function () { return seats === 2 ? 'The sofa · the crew\'s favourite' : 'The armchair'; }, use: function () { sfx('click'); toast(pick(['Comfy.', 'Somebody left crumbs.', 'Five minutes. Then back to it.']), ''); } });
      }; }
    /* 06-props4-furniture.js */
    function paddedChairBuild(c) {
        var seat = new THREE.Mesh(bevelGeo(0.46, 0.08, 0.46, 0.03), FABRIC); seat.position.set(0, 0.47, 0); seat.castShadow = true; c.group.add(seat);
        var back = new THREE.Mesh(bevelGeo(0.44, 0.42, 0.07, 0.03), FABRIC); back.position.set(0, 0.75, -0.2); back.rotation.x = -0.12; back.castShadow = true; c.group.add(back);
        [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
        c.box(0.4, 0.03, 0.03, MAT.chrome, 0, 0.42, -0.19); c.box(0.4, 0.03, 0.03, MAT.chrome, 0, 0.42, 0.19);
        c.solid(-0.24, 0.24, -0.24, 0.24, 0, 0.9);
      }
    /* 06-props4-furniture.js */
    function roundTableBuild(c) {
        c.cyl(0.65, 0.04, OAK, 0, 0.74, 0, 36); c.cyl(0.06, 0.7, MAT.steelDark, 0, 0.36, 0, 12); [0, 1, 2, 3].forEach(function (k) { var foot = c.box(0.5, 0.04, 0.06, MAT.steelDark, 0, 0.03, 0); foot.rotation.y = k * Math.PI / 2; foot.position.set(Math.sin(k * Math.PI / 2) * 0.25, 0.03, Math.cos(k * Math.PI / 2) * 0.25); });
        c.cyl(0.045, 0.1, MAT.white, 0.25, 0.81, 0.1, 12); c.cyl(0.045, 0.1, MAT.red, -0.3, 0.81, -0.15, 12); c.box(0.3, 0.012, 0.2, MAT.paper, 0.05, 0.766, -0.25);
        c.solid(-0.66, 0.66, -0.66, 0.66, 0, 0.8);
      }
    /* 06-yard.js */
    var yard = { gates: [], guards: [], traffic: [], puddles: [], flag: null, lampLenses: [], windT: 0 };
    /* 07-items.js */
    var BOX = { w: 0.55, h: 0.42, d: 0.45 };
    /* 07-items.js */
    var BOX_GEO = boxGeo(BOX.w, BOX.h, BOX.d), PARCEL_GEO = boxGeo(0.6, 0.46, 0.5), PALLET_GEO = boxGeo(1.2, 0.14, 1.0);
    /* 07-items.js */
    var handBox = new THREE.Mesh(BOX_GEO, CARD.paint);
    /* 07-items.js */
    var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel);
    /* 07-items.js */
    function parcelForm(oid) { var o = oid ? orderById(oid) : null; return o && o.form || null; }
    /* 07-items.js */
    function formMat(f) { return f === 'crate' ? MAT.crate : f === 'strap' ? MAT.strapped : f === 'pouch' ? MAT.airbox : MAT.parcel; }
    /* 07-items.js */
    function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && (h.kind === 'parcel' || h.kind === 'return')); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; if (h && h.kind === 'parcel') handParcel.material = formMat(parcelForm(h.order)); if (h && h.kind === 'return') handParcel.material = MAT.returned; }
    /* 07-items.js */
    function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
    /* 07-items.js */
    function slotSpace(key, sku) { var s = S.slots[key]; if (!s || !s.n) return ECON.slotCap; if (s.sku !== sku) return 0; return ECON.slotCap - s.n; }
    /* 07-items.js */
    function slotAdd(key, sku, n) { var s = S.slots[key]; if (!s || !s.n) S.slots[key] = { sku: sku, n: n, pal: !!(s && s.pal) }; else s.n += n; }
    /* 07-items.js */
    function slotTake(key, n) { var s = S.slots[key]; if (!s) return 0; var k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) { if (s.pal) s.n = 0; else delete S.slots[key]; } return k; }
    /* 07-items.js */
    function slotOwned(key) { var r = slotParse(key).r; return r < S.up.rows || (r === UPPER.row && upperRowsOwned() > 0) || annexRowOwned(r); }
    /* 07-items.js */
    function stockCount(sku) { var n = 0; for (var k in S.slots) if (S.slots[k].sku === sku) n += S.slots[k].n; return n; }
    /* 07-items.js */
    function totalStock() { var n = 0; for (var k in S.slots) n += S.slots[k].n; return n; }
    /* 07-items.js */
    function stockSummary() { var m = {}; for (var k in S.slots) { var s = S.slots[k]; if (!s.n) continue; m[s.sku] = (m[s.sku] || 0) + s.n; } return m; }
    /* 07-items.js */
    function slotsWith(sku) { var out = []; for (var k in S.slots) if (S.slots[k].sku === sku && S.slots[k].n > 0) out.push(k); out.sort(function (a, b) { return slotParse(a).l - slotParse(b).l; }); return out; }
    /* 07-items.js */
    function findSlotFor(sku, n, maxLevel) {
        var best = null, bestScore = -1;
        var rows = groundRows();   // the main rows you own and the rows of the halls you own; the main rows fill first
        for (var ri = 0; ri < rows.length; ri++) for (var b = 0; b < rowBays(rows[ri]); b++) for (var l = 0; l <= maxLevel; l++) {
          var r = rows[ri], key = slotKey(r, b, l), s = S.slots[key], space = slotSpace(key, sku); if (space < n) continue;
          var score = (s && s.n ? 100 : 50) - l * 10 - b - (isAnnexRow(r) ? 30 : 0);
          if (score > bestScore) { bestScore = score; best = key; }
        }
        return best;
      }
    /* 07-items.js */
    function jackReach(l) { return l <= (S.up.jackLift ? 1 : 0); }
    /* 07-items.js */
    function jackReachText() { return S.up.jackLift ? 'The stacker reaches the second level, not the top' : 'The jack only reaches the floor level'; }
    /* 07-items.js */
    function slotPrompt(key) {
        var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
        if (p.l === RACK.top && !driving) return has ? skuName(s.sku) + ' × ' + s.n + ' · top level: forklift only' : 'Top level: forklift only';
        if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) return 'Pick a box of ' + skuName(s.sku) + ' onto the cart (' + s.n + ' here)'; return has ? 'Cart is full' : null; }
        if (isJack(tool)) { var jp = jackPallet(tool); if (jp) return jackReach(p.l) ? (slotSpace(key, jp.sku) >= jp.n && !(jp.n === 0 && s) ? 'Set the pallet into the rack' : (has ? 'Slot holds ' + skuName(s.sku) + ': no room' : null)) : jackReachText(); return has && jackReach(p.l) ? 'Pull the pallet out (' + Math.min(s.n, ECON.palletCap) + ' boxes)' : (s && s.pal && jackReach(p.l) ? 'Take the empty pallet out' : null); }
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'A damaged box does not go on the rack: bin it';
        if (S.hand && S.hand.kind === 'box') return slotSpace(key, S.hand.sku) > 0 ? 'Put the box on the rack' + (has ? ' (' + s.n + ' here)' : '') : 'Slot holds ' + skuName(s.sku) + ': no room';
        if (S.hand) return null;
        return has ? 'Take a box of ' + skuName(s.sku) + ' (' + s.n + ' here)' : 'Empty slot · ' + slotName(key);
      }
    /* 07-items.js */
    function slotUse(key) {
        var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
        if (p.l === RACK.top && !driving) { toast('Too high. Use the forklift.', 'bad'); return; }
        if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) { S.cart.boxes.push(s.sku); slotTake(key, 1); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); } return; }
        if (isJack(tool)) {
          var jp = jackPallet(tool);
          if (jp) { if (!jackReach(p.l)) { toast(jackReachText() + '.', 'bad'); return; } if (storePallet(jp, key)) { S[tool].pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in that slot.', 'bad'); return; }
          if (has && jackReach(p.l)) { var np = pullPallet(key); if (np) { np.place = 'jack'; np.jack = tool; S[tool].pallet = np.id; sfx('jack'); } }
          else if (s && s.pal && jackReach(p.l)) { delete S.slots[key]; var ep = newPallet(s.sku, 0, { place: 'jack', jack: tool }); S[tool].pallet = ep.id; sfx('jack'); }
          return;
        }
        if (!S.hand && has && s.wrapped) s.wrapped = false;   // cutting the film to take a box
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
        if (S.hand && S.hand.kind === 'box') { if (slotSpace(key, S.hand.sku) > 0) { slotAdd(key, S.hand.sku, 1); handSet(null); sfx('putdown'); S.stats.putaway++; addXp(XP.box); introStep('putaway'); } else toast('No room: that slot holds ' + skuName(s.sku) + '.', 'bad'); return; }
        if (S.hand) return;
        if (has) { slotTake(key, 1); handSet({ kind: 'box', sku: s.sku }); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); }
      }
    /* 07-items.js */
    function palletById(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) return S.pallets[i]; return null; }
    /* 07-items.js */
    function newPallet(sku, n, props) { var p = { id: uid('pl'), sku: sku, n: n, place: 'floor', x: 0, y: 0, z: 0, rot: 0 }; for (var k in props) p[k] = props[k]; S.pallets.push(p); return p; }
    /* 07-items.js */
    function removePallet(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) { S.pallets.splice(i, 1); return; } }
    /* 07-items.js */
    function storePallet(p, key) { if (!slotOwned(key) || slotSpace(key, p.sku) < p.n || (p.n === 0 && S.slots[key])) return false; slotAdd(key, p.sku, p.n); S.slots[key].pal = true; S.slots[key].wrapped = !!p.wrapped; S.stats.putaway += p.n; removePallet(p.id); return true; }
    /* 07-items.js */
    function pullPallet(key) { var s = S.slots[key]; if (!s || !s.n) return null; var sku = s.sku, n = Math.min(s.n, ECON.palletCap), wrapped = !!s.wrapped; slotTake(key, n); if (S.slots[key] && S.slots[key].n <= 0) delete S.slots[key]; return newPallet(sku, n, { place: 'floor', wrapped: wrapped }); }
    /* 07-items.js */
    function jackPallet(tool) { var t = tool || jackTool(), js = S[t]; return js && js.pallet ? palletById(js.pallet) : null; }
    /* 07-items.js */
    function forkPallet() { return S.fork.pallet ? palletById(S.fork.pallet) : null; }
    /* 08-trucks.js */
    var truckMeshes = {};
    /* 08-trucks.js */
    function truckById(id) { for (var i = 0; i < S.trucks.length; i++) if (S.trucks[i].id === id) return S.trucks[i]; return null; }
    /* 08-trucks.js */
    function truckAtDoor(i) { var dm = DOOR_MAP[i]; if (!dm) return null; var dir = dm.dir, dock = dm.dock; for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.dir === dir && t.dock === dock && t.state === 'docked') return t; } return null; }
    /* 08-trucks.js */
    function trailerBounds(t) { var len = t.len || TRAILER.len, w = t.van ? VAN.w : TRAILER.w, a = t.x, b = t.x + t.side * len; return { x0: Math.min(a, b), x1: Math.max(a, b), z0: t.z - w / 2, z1: t.z + w / 2 }; }
    /* 08-trucks.js */
    function removeTruckMesh(id) { var m = truckMeshes[id]; if (!m) return; scene.remove(m.g); m.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); delete truckMeshes[id]; shadowDirty = true; }
    /* 08-trucks.js */
    var DRIVER_LINES = {
        sign: ['Sign here, chief.', 'Just the one signature and it is all yours.', 'Name and a squiggle, ta.', 'Delivery note. Sign the bottom.'],
        signed: ['Cheers. All yours.', 'Lovely. I will get the kettle on in the cab.', 'Ta. Mind the back ones, they are heavy.', 'Done. Give us a shout when it is empty.'],
        chat: ['Traffic was murder on the ring road.', 'Yard looks tidy, I will give you that.', 'Three more drops after this one.', 'Is the kettle on?', 'Mind the forks. I have seen things.', 'My last depot had a vending machine with actual food in it.', 'Weather is turning.', 'They want this lot back in Northgate by six.'],
        late: ['Any chance we can get a move on, mate?', 'I have got a slot to make.', 'Clock is ticking, chief.'],
        out: ['Load her up, I am ready when you are.', 'Anything heavy goes at the front.', 'Shout when you want me gone.']
      };
    /* 08-trucks.js */
    function signTruck(t) { if (t.signed) return; t.signed = true; sfx('tape'); addXp(3); toast('Delivery note signed: ' + t.pallets.length + ' pallets from ' + clientName(t.client), 'good'); logEvent('Signed for ' + t.pallets.length + ' pallets from ' + clientName(t.client) + ' (' + t.driver + ')'); introStep('sign'); }
    /* 08-trucks.js */
    function truckLeave(t, why) {
        if (t.state !== 'docked') return;
        if (t.dir === 'out' && t.parcels.length) introStep('dispatch');   // a truck leaving on schedule with your parcel finishes the intro too
        sellBales(t);
        if (t.dir === 'in') {
          S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n <= 0; }).forEach(function (p) { removePallet(p.id); });   // empties go back with the truck, no harm done
          var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; });
          if (left.length) { left.forEach(function (p) { removePallet(p.id); }); addRep(-Math.min(5, 0.5 * left.length)); S.stats.lost += left.length; logEvent(left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back on the truck unreceived', 'bad'); toast('Refused delivery: ' + left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back', 'bad'); }
          else { logEvent(t.driver + ' left ' + dockLabel(doorIndex('in', t.dock)) + ' empty', 'good'); }
        } else {
          if (t.parcels.length) { var n = t.parcels.length, sum = 0; t.parcels.forEach(function (oid) { var o = orderById(oid); if (o) sum += shipOrder(o, doorIndex(t.dir, t.dock)); }); toast('Truck out with ' + n + ' parcel' + (n > 1 ? 's' : '') + ' · ' + money(sum), 'good'); logEvent('Outbound truck left ' + dockLabel(doorIndex(t.dir, t.dock)) + ' with ' + n + ' parcel' + (n > 1 ? 's' : '') + ', ' + money(sum) + ' paid', 'good'); if (why === 'dispatched') addXp(XP.truck); }
          else logEvent((t.dir === 'ret' ? 'The returns truck left ' : 'Outbound truck left ') + dockLabel(doorIndex(t.dir, t.dock)) + ' empty');
          t.parcels = [];
          // a return nobody took off: the driver sets it down inside the door
          if (t.returns && t.returns.length) { var rat = doorInside(doorIndex(t.dir, t.dock)), rn = t.returns.length; t.returns.forEach(function (rid, k) { S.floor.push({ kind: 'return', id: rid, x: rat[0] - 1.3, y: 0, z: rat[1] + (t.dir === 'ret' ? 0.9 + k * 0.9 : -0.9 + k * 0.9), rot: 0 }); }); toast(t.driver + ' set ' + rn + ' return' + (rn > 1 ? 's' : '') + ' down inside ' + dockLabel(doorIndex(t.dir, t.dock)), ''); logEvent(rn + ' return' + (rn > 1 ? 's' : '') + ' left on the dock floor at ' + dockLabel(doorIndex(t.dir, t.dock)) + ': take them to the returns desk'); t.returns = []; }
        }
        // nobody rides along
        var b = trailerBounds(t);
        if (player.x > b.x0 - 0.3 && player.x < b.x1 + 0.3 && player.z > b.z0 - 0.3 && player.z < b.z1 + 0.3) { player.x = t.side * (HALL.x - 1.6); player.z = t.z; }
        if (driving && S.fork.x > b.x0 - 0.3 && S.fork.x < b.x1 + 0.3 && Math.abs(S.fork.z - t.z) < 1.5) { S.fork.x = t.side * (HALL.x - 2.5); S.fork.z = t.z; }
        // nothing else rides along either: a box, a parcel, a pallet or a tool left in the trailer is set down inside the door
        var inT = function (o) { return o && typeof o.x === 'number' && o.x > b.x0 - 0.3 && o.x < b.x1 + 0.3 && Math.abs((o.z || 0) - t.z) < 1.6; };
        S.floor.concat(S.pallets.filter(function (p) { return p.place === 'floor'; }), [S.jack, S.jack2, S.cart]).forEach(function (o) { if (inT(o)) { o.x = t.side * (HALL.x - 1.6); if (o.y !== undefined) o.y = 0; } });
        S.staff.forEach(function (st) { if (inT(st)) { st.x = t.side * (HALL.x - 1.6); st.path = []; } if (st.jackAt && inT(st.jackAt)) st.jackAt.x = t.side * (HALL.x - 1.6); });   // a worker fetching in the trailer, or a jack parked in it at a clock-out, would be left in the yard
        t.state = 'leaving'; sfx('truck'); rebuildBoardSoon();
      }
    /* 08-trucks.js */
    function consoleUse(i) {
        var t = truckAtDoor(i); if (!t) { sfx('bad'); return; }
        if (!t.parcels.length) { toast('Nothing loaded yet.', 'bad'); return; }
        sfx('horn'); introStep('dispatch'); truckLeave(t, 'dispatched');
      }
    /* 08-trucks.js */
    var boardT = 0;
    /* 08-trucks.js */
    function rebuildBoardSoon() { boardT = 0.01; }
    /* 09-orders.js */
    function clientName(id) { for (var i = 0; i < CLIENTS.length; i++) if (CLIENTS[i].id === id) return CLIENTS[i].name; return id || 'Walk-in'; }
    /* 09-orders.js */
    function orderById(id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; }
    /* 09-orders.js */
    function openOrders() { return S.orders.filter(function (o) { return o.state === 'open'; }); }
    /* 09-orders.js */
    function dueText(abs) { var day = Math.floor(abs / 24), t = abs % 24; return fmtTime(t) + (day > S.day + 1 ? ' in ' + (day - S.day) + ' days' : day > S.day ? ' tomorrow' : abs < nowAbs() ? ' (overdue)' : ''); }
    /* 09-orders.js */
    function orderLate(o) { return nowAbs() > o.due + 0.05; }
    /* 09-orders.js */
    function benchNeed() { var need = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); }); for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k]; for (var q in need) if (need[q] <= 0) delete need[q]; return need; }
    /* 09-orders.js */
    function benchSurplus() { var want = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { want[l.sku] = (want[l.sku] || 0) + l.qty; }); }); var sur = {}; for (var k in S.bench.boxes) { var n = S.bench.boxes[k] - (want[k] || 0); if (n > 0) sur[k] = n; } return sur; }
    /* 09-orders.js */
    function contractSlots() { return unlocked('twoContracts') ? ['contract', 'contract2'] : ['contract']; }
    /* 09-orders.js */
    function contractsAll() { return contractSlots().map(function (k) { return S[k]; }).filter(Boolean); }
    /* 09-orders.js */
    function contractOffer() { return contractsAll().filter(function (c) { return !c.accepted; })[0] || null; }
    /* 09-orders.js */
    function contractSlotOf(c) { for (var i = 0; i < contractSlots().length; i++) if (S[contractSlots()[i]] === c) return contractSlots()[i]; return null; }
    /* 09-orders.js */
    function contractAccept(k) { var c = k ? S[k] : contractOffer(); if (!c || c.accepted) return false; c.accepted = true; sfx('chime'); toast('Contract accepted', 'good'); logEvent('Accepted the contract from ' + clientName(c.client), 'good'); hudDirty = true; return true; }
    /* 09-orders.js */
    function contractDecline(k) { var c = k ? S[k] : contractOffer(); if (!c || c.accepted) return false; logEvent('Declined the contract from ' + clientName(c.client)); S[contractSlotOf(c)] = null; S.nextOffer = S.day + 2; hudDirty = true; return true; }
    /* 09-orders.js */
    function contractSettle(k) {
        var c = S[k || 'contract']; if (!c) return;
        if (c.done >= c.need) { pay(c.bonus, 'Contract bonus, ' + clientName(c.client)); addRep(6); toast('Contract complete: ' + money(c.bonus) + ' bonus', 'rare'); logEvent('Contract with ' + clientName(c.client) + ' complete: ' + money(c.bonus) + ' bonus', 'rare'); sfx('fanfare'); addXp(40); }
        else { pay(-c.penalty, 'Contract penalty, ' + clientName(c.client)); addRep(-4); toast('Contract missed: ' + c.done + ' of ' + c.need + '. Penalty ' + money(c.penalty), 'bad'); logEvent('Contract with ' + clientName(c.client) + ' missed (' + c.done + ' of ' + c.need + ')', 'bad'); }
        S[k || 'contract'] = null; S.nextOffer = S.day + randi(2, 4);
      }
    /* 09-orders.js */
    function benchCount() { var n = 0; for (var k in S.bench.boxes) n += S.bench.boxes[k] || 0; return n; }
    /* 09-orders.js */
    function benchAdd(sku, n) { S.bench.boxes[sku] = (S.bench.boxes[sku] || 0) + n; }
    /* 09-orders.js */
    function benchTake(sku, n) { var k = Math.min(n, S.bench.boxes[sku] || 0); if (!k) { delete S.bench.boxes[sku]; return 0; } S.bench.boxes[sku] -= k; if (S.bench.boxes[sku] <= 0) delete S.bench.boxes[sku]; return k; }
    /* 09-orders.js */
    function cartAtBench() { var need = benchNeed(), off = 0, on = 0, room = benchCapNow() - benchCount(); S.cart.boxes.forEach(function (sku) { if ((need[sku] || 0) > 0 && off < room) { need[sku]--; off++; } }); var sur = benchSurplus(); for (var k in sur) on += sur[k]; on = Math.min(on, ECON.cartCap - (cartLoad() - off)); return { off: off, on: Math.max(0, on) }; }
    /* 09-orders.js */
    function benchPrompt() {
        if (player.tool === 'cart') { var c = cartAtBench(); return (c.off ? 'Unload ' + c.off + ' wanted ' + (c.off === 1 ? 'box' : 'boxes') : '') + (c.off && c.on ? ', ' : '') + (c.on ? 'take ' + c.on + ' surplus back on the cart' : '') || 'Packing bench · nothing on the cart the orders want'; }
        if (isJack(player.tool)) return null;
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Damaged boxes do not ship: bin it';
        if (S.hand && S.hand.kind === 'box') return benchCount() < benchCapNow() ? 'Put the box on the ' + (BOOT_STAGE === 0 ? 'table' : 'bench') : 'The ' + (BOOT_STAGE === 0 ? 'table' : 'bench') + ' is full';
        if (S.hand) return null;
        var sur = benchSurplus(), sn = 0; for (var k in sur) sn += sur[k];
        return (BOOT_STAGE === 0 ? 'Packing table · ' : 'Packing bench · ') + benchCount() + (benchCount() === 1 ? ' box' : ' boxes') + ' · ' + openOrders().length + (openOrders().length === 1 ? ' open order' : ' open orders') + (sn ? ' · ' + sn + ' surplus (look at a box to take it back)' : '');
      }
    /* 09-orders.js */
    function benchUse() {
        if (player.tool === 'cart') {
          // the boxes the open orders still want come off the cart; the surplus on the bench goes onto the cart, to go back on the racks
          var need = benchNeed(), off = 0, on = 0;
          for (var i = S.cart.boxes.length - 1; i >= 0; i--) { var sku = S.cart.boxes[i]; if ((need[sku] || 0) > 0 && benchCount() < benchCapNow()) { S.cart.boxes.splice(i, 1); benchAdd(sku, 1); need[sku]--; off++; } }
          var sur = benchSurplus(); for (var k in sur) while (sur[k] > 0 && cartLoad() < ECON.cartCap) { benchTake(k, 1); S.cart.boxes.push(k); sur[k]--; on++; }
          if (off || on) { sfx('putdown'); introStep('bench'); toast((off ? off + ' onto the bench' : '') + (off && on ? ' · ' : '') + (on ? on + ' surplus onto the cart' : ''), 'good'); hudDirty = true; }
          else if (S.cart.boxes.length) toast(benchCount() >= benchCapNow() ? 'The bench is full.' : 'No open order wants what is on the cart. Put it back on the racks.', 'bad');
          else toast('Nothing surplus on the bench.', '');
          return;
        }
        if (isJack(player.tool)) return;
        if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. Bin it.', 'bad'); return; }
        if (S.hand && S.hand.kind === 'box') { if (benchCount() >= benchCapNow()) { toast('The ' + (BOOT_STAGE === 0 ? 'table' : 'bench') + ' is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
        if (S.hand) return;
        if (BOOT_STAGE === 0) { var ready = openOrders().filter(canPack).sort(function (a, b) { return a.due - b.due; })[0]; if (ready) { if (packOrder(ready)) { toast('Packing #' + ready.num + ' by hand: four seconds', 'good'); } } else if (S.pack && S.pack.job) toast('Packing #' + (orderById(S.pack.job.order) || { num: '?' }).num + '...', ''); else toast(openOrders().length ? 'Not every box of an order is on the table yet.' : 'No open orders. Boxes you leave here stay on the table.', ''); return; }   // the shed: E on the table packs the first whole order on it, by hand
        sfx('click'); toast('Look at a box on the bench and press E to take it back. The terminal at the end packs the orders.', '');
      }
    /* 09-orders.js */
    function returnSurplus() {
        var sur = benchSurplus(), moved = 0, floorN = 0;
        for (var sku in sur) { var left = sur[sku]; for (var guard = 0; left > 0 && guard < 40; guard++) { var key = findSlotFor(sku, 1, 1); if (!key) break; var room = Math.min(left, slotSpace(key, sku)); if (room <= 0) break; benchTake(sku, room); slotAdd(key, sku, room); left -= room; moved += room; } }
        for (var i = S.floor.length - 1; i >= 0; i--) { var f = S.floor[i]; if (f.kind !== 'box' || f.damaged || !insideHall(f.x, f.z)) continue; var k2 = findSlotFor(f.sku, 1, 1); if (!k2) continue; slotAdd(k2, f.sku, 1); S.floor.splice(i, 1); moved++; floorN++; }
        if (moved) { S.stats.putaway += moved; sfx('crate'); toast(moved + ' surplus box' + (moved > 1 ? 'es' : '') + ' back on the racks' + (floorN ? ' (' + floorN + ' off the floor)' : ''), 'good'); logEvent('Returned ' + moved + ' surplus boxes to the racks' + (floorN ? ', ' + floorN + ' of them off the floor' : ''), 'good'); hudDirty = true; screenDirtyAll(); if (ui.panelOpen) renderPanel(); }
        else toast('Nothing surplus to return.', '');
        return moved;
      }
    /* 09-orders.js */
    function surplusCount() { var sur = benchSurplus(), n = 0; for (var k in sur) n += sur[k]; S.floor.forEach(function (f) { if (f.kind === 'box' && !f.damaged && insideHall(f.x, f.z)) n++; }); return n; }
    /* 09-orders.js */
    function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
    /* 09-orders.js */
    function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
    /* 09-orders.js */
    function canPackShort(o) { if (BOOT_STAGE === 0) return false; var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
    /* 09-orders.js */
    function shipOrder(o, door) {   // door: the outbound door the parcel left by; the wrong lane's door pays the forwarding fee
        var late = orderLate(o), m = orderMode(o), wrong = lanesOn() && door !== undefined && modeDoor(m) !== door && !sorterOwned(), amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1) * (wrong ? MODE_FEE : 1));
        if (wrong) S.stats.misrouted = (S.stats.misrouted || 0) + 1;
        pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : '') + (wrong ? ' (' + m + ' parcel out of ' + dockLabel(door) + ': forwarding fee)' : ''));
        if (!late) contractSlots().forEach(function (k) { var c = S[k]; if (c && c.accepted && c.client === o.client) { c.done++; if (c.done >= c.need) contractSettle(k); else feedPush('Contract: ' + c.done + ' of ' + c.need, 'good'); } });
        addRep(late ? -1 : o.rush ? 3 : 1.5); S.stats.shipped++; if (late) S.stats.late++; addXp(XP.ship);
        o.state = 'shipped'; o.shippedAt = nowAbs(); o.paid = amount;
        for (var i = 0; i < S.orders.length; i++) if (S.orders[i] === o) { S.orders.splice(i, 1); break; }
        S.shipped.unshift({ num: o.num, client: o.client, paid: amount, late: late, short: o.short, day: S.day, mode: m, wrong: wrong, form: o.form || null, lines: o.lines.map(function (l) { return { sku: l.sku, qty: l.qty }; }) }); if (S.shipped.length > 40) S.shipped.pop();
        sfx('cash'); hudDirty = true;
        return amount;
      }
    /* 09-returns.js */
    var RETURNS = { level: UNLOCK.returns, chance: 0.3, max: 2, fee: 10, perBox: 4, deskCap: 4, shelfCap: 8, inspectSec: 5, lateHours: 24, hallDeskCap: 8, hallShelfCap: 24, truckMin: 3, truckMax: 6 };
    /* 09-returns.js */
    function returnById(id) { var rs = S.returns || []; for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i]; return null; }
    /* 09-returns.js */
    function returnsHall() { return !!(S.up && S.up.hall2); }
    /* 09-returns.js */
    function rdeskStations() { return returnsHall() ? 3 : 1; }
    /* 09-returns.js */
    function rdeskCap() { return returnsHall() ? RETURNS.hallDeskCap : RETURNS.deskCap; }
    /* 09-returns.js */
    function rdesk() {
        if (!S.rdesk) S.rdesk = { queue: [], s: [], shelf: [], done: 0 };
        var D = S.rdesk;
        if (!D.s) { D.s = [{ cur: D.cur || null, t: D.t || 0 }]; delete D.cur; delete D.t; }   // 1.16 saves had the one station in cur/t
        while (D.s.length < rdeskStations()) D.s.push({ cur: null, t: 0 });
        return D;
      }
    /* 09-returns.js */
    function returnFee(r) { var n = 0; (r ? r.lines : []).forEach(function (l) { n += l.qty; }); return RETURNS.fee + RETURNS.perBox * n; }
    /* 09-returns.js */
    function returnLabel(r) { return 'Return #' + r.num + ' from ' + clientName(r.client); }
    /* 09-returns.js */
    function returnPlace(id) {
        if (S.hand && S.hand.kind === 'return' && S.hand.id === id) return 'hand';
        for (var i = 0; i < S.trucks.length; i++) if ((S.trucks[i].returns || []).indexOf(id) >= 0) return 'truck';
        for (var k = 0; k < S.floor.length; k++) if (S.floor[k].kind === 'return' && S.floor[k].id === id) return 'floor';
        for (var bk in (S.belts || {})) { var arr = S.belts[bk]; for (var q = 0; q < arr.length; q++) if (arr[q].ret === id) return 'belt'; }
        var D = rdesk(); if (D.queue.indexOf(id) >= 0) return 'desk'; for (var j = 0; j < D.s.length; j++) if (D.s[j].cur === id) return 'inspecting';
        for (var s = 0; s < S.staff.length; s++) { var c = S.staff[s].carry; if (c && c.kind === 'return' && c.id === id) return 'staff'; }
        return null;
      }
    /* 09-returns.js */
    function returnPlaceText(r) { var p = returnPlace(r.id); if (p === 'truck') { var t = S.trucks.filter(function (x) { return (x.returns || []).indexOf(r.id) >= 0; })[0]; return 'on the truck at ' + (t ? dockLabel(doorIndex(t.dir, t.dock)) : '?'); } return p === 'hand' ? 'in your hands' : p === 'floor' ? 'on the floor' : p === 'belt' ? 'on the returns belt' : p === 'desk' ? (returnsHall() ? 'waiting at the intake' : 'waiting on the desk') : p === 'inspecting' ? 'being inspected' : p === 'staff' ? 'with the crew' : 'gone'; }
    /* 09-returns.js */
    function returnsPending() { return (S.returns || []).filter(function (r) { return returnPlace(r.id) !== null; }); }
    /* 09-returns.js */
    function rdeskPrompt(k) {
        var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall();
        if (S.hand && S.hand.kind === 'return') return D.queue.length < rdeskCap() ? 'Put the return ' + (hall ? 'in the queue' : 'on the desk') + ' (' + D.queue.length + ' waiting)' : 'The queue is full: inspect one first';
        if (S.hand || player.tool) return null;
        if (st.cur) { var rc = returnById(st.cur); return 'Inspecting return #' + (rc ? rc.num : '?') + ' · ' + Math.ceil(st.t) + ' s'; }
        if (D.queue.length) { var rq = returnById(D.queue[0]); return 'Inspect return #' + (rq ? rq.num : '?') + ' (' + D.queue.length + ' waiting) · ' + money(returnFee(rq)) + ' fee'; }
        return (hall ? 'Inspection desk ' + (k + 1) : 'Returns desk') + ' · ' + (D.shelf.length ? D.shelf.length + ' box' + (D.shelf.length > 1 ? 'es' : '') + (hall ? ' in the cage · ' : ' on the shelf · ') : '') + D.done + ' inspected · ' + (hall ? 'returns come in on the returns truck and the outbound trucks' : 'returns ride in on the outbound trucks');
      }
    /* 09-returns.js */
    function rdeskUse(k) {
        var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall();
        if (S.hand && S.hand.kind === 'return') { if (D.queue.length >= rdeskCap()) { toast('The queue is full. Inspect one first.', 'bad'); sfx('bad'); return; } D.queue.push(S.hand.id); handSet(null); sfx('putdown'); screenDirtyAll(); hudDirty = true; return; }
        if (S.hand || player.tool) return;
        if (st.cur) { toast('Inspecting. ' + Math.ceil(st.t) + ' seconds to go.', ''); return; }
        if (!D.queue.length) { sfx('click'); toast(D.shelf.length ? 'Take the boxes off the ' + (hall ? 'restock cage' : 'shelf') + ': good ones to the racks, damaged ones to the ' + (hall ? 'compactor' : 'bin') + '.' : 'Nothing to inspect. ' + (hall ? 'Returns come in on the returns truck and the outbound trucks.' : 'Returns come in on the outbound trucks.'), ''); return; }
        if (!powered()) { toast('No power: the desk scanner is dead.', 'bad'); sfx('bad'); return; }
        rdeskStart(k);
      }
    /* 09-returns.js */
    function rdeskStart(k) { var D = rdesk(), st = D.s[k || 0]; if (!st || st.cur || !D.queue.length) return false; st.cur = D.queue.shift(); st.t = RETURNS.inspectSec; sfx('scan'); screenDirtyAll(); return true; }
    /* 09-returns.js */
    function returnsDeskBuildFor(k, label) { return function (c, P, inst) {
        var TOP = std({ color: 0x8f98a3, roughness: 0.45, metalness: 0.35 }), FRAME = MAT.steelDark, PLATE = std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), TAN = std({ color: 0xc9a46a, roughness: 0.8 });
        c.box(2.0, 0.05, 0.8, TOP, 0, 1.0, 0); [[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].forEach(function (o) { c.box(0.05, 1.0, 0.05, FRAME, o[0], 0.5, o[1]); });
        c.box(1.9, 0.03, 0.7, FRAME, 0, 0.12, 0); c.box(1.9, 0.03, 0.7, FRAME, 0, 0.54, 0);   // the two shelves for the opened boxes
        c.box(0.6, 0.02, 0.6, PLATE, 0.6, 1.035, -0.05); c.box(0.04, 0.26, 0.04, FRAME, 0.92, 1.16, -0.3);   // the scale plate and its readout post at the back
        var rg = new THREE.Group(); rg.position.set(0.92, 1.3, -0.3); rg.rotation.order = 'YXZ'; rg.rotation.x = -0.3; c.add(rg); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, rg); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, rg);
        c.box(0.24, 0.13, 0.17, MAT.white, -0.82, 1.09, 0.22); c.box(0.004, 0.09, 0.07, MAT.paper, -0.69, 1.07, 0.22); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), -0.76, 1.14, 0.31);   // the label printer
        var tgn = new THREE.Group(); tgn.position.set(-0.25, 1.03, 0.22); tgn.rotation.y = 0.5; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, FRAME, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2;   // the tape gun
        c.box(0.22, 0.012, 0.3, MAT.black, 0.12, 1.03, 0.2).rotation.y = -0.2; c.box(0.2, 0.006, 0.27, MAT.paper, 0.12, 1.04, 0.2).rotation.y = -0.2; c.box(0.08, 0.02, 0.03, FRAME, 0.12, 1.05, 0.33).rotation.y = -0.2;   // the clipboard
        c.box(0.3, 0.1, 0.3, std({ color: 0x3a4149, roughness: 0.6 }), -0.6, 1.08, -0.18);   // the parcel tray the queue stands in
        var post = c.cyl(0.02, 2.3, FRAME, 0, 1.15, -0.38, 8); post.castShadow = false; c.box(0.9, 0.03, 0.03, FRAME, 0, 2.3, -0.38);
        c.sign([label], 0.9, 0.22, 0, 2.15, -0.36, 0, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' }); c.sign([label], 0.9, 0.22, 0, 2.15, -0.4, Math.PI, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
        c.plane(2.2, 0.9, std({ color: 0x242c36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.004, 0.9, -Math.PI / 2, 0);   // the mat where you stand
        // the lamp over the scale: dark when idle, lit with returns waiting, blinking while it inspects (a dynamic subgroup, so the bake leaves it)
        var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.add(dyn); c.box(0.03, 0.03, 0.4, FRAME, 0.6, 1.62, -0.2); c.cyl(0.02, 0.6, FRAME, 0.6, 1.32, -0.38, 8); inst.lamp = box(0.09, 0.07, 0.09, glowMat(0xf5b53d, 0.12), 0.6, 1.58, -0.02, dyn);
        // the terminal on its stand at the end, screen facing the working side
        var tg = new THREE.Group(); tg.position.set(1.35, 0, -0.05); c.add(tg);
        cyl(0.22, 0.03, FRAME, 0, 0.015, 0, tg, 16); cyl(0.2, 0.02, MAT.rubber, 0, 0.04, 0, tg, 16); cyl(0.03, 1.5, FRAME, 0, 0.78, 0, tg, 10); box(0.64, 0.5, 0.03, MAT.black, 0, 1.56, -0.03, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.28, 1.34, -0.01, tg);
        var scr = touchScreen({ w: 320, h: 240, res: 3, pw: 0.58, ph: 0.435, x: 0, y: 1.56, z: -0.01, ry: 0, parent: tg, title: label === 'RETURNS' ? 'Returns desk' : 'Inspection desk ' + (k + 1), draw: function (cc, sc) { rdeskScreenDraw(cc, sc, k); } }); scr.mesh.userData.propId = inst.id;
        c.solid(-1.05, 1.05, -0.45, 0.45, 0, 1.05); c.solid(1.12, 1.58, -0.3, 0.2, 0, 1.9);
        c.hit(2.2, 1.3, 1.0, 0, 0.7, 0, { prompt: function () { return rdeskPrompt(k); }, use: function () { rdeskUse(k); } });
      }; }
    /* 09-returns.js */
    function rdeskScreenDraw(c, sc, k) {
        var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall(); scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.16)'); scHead(c, sc.w, hall ? 'INSPECTION ' + (k + 1) : 'RETURNS', D.done + ' inspected');
        var y = 60;
        if (st.cur) { var r = returnById(st.cur); scText(c, 16, y, 'Inspecting #' + (r ? r.num : '?') + ' · ' + (r ? clientName(r.client).slice(0, 18) : ''), '#f5b53d', 14); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, y + 10, sc.w - 32, 10); c.fillStyle = '#f5b53d'; c.fillRect(16, y + 10, (sc.w - 32) * clamp(1 - st.t / RETURNS.inspectSec, 0, 1), 10); y += 36; }
        else if (D.queue.length) { var q0 = returnById(D.queue[0]); scText(c, 16, y, (q0 ? returnLabel(q0) : 'A return') + ' waiting', '#eef1f5', 14); scText(c, 16, y + 17, q0 ? q0.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + q0.why : '', '#a0acb8', 11); scButton(sc, sc.w - 116, y - 14, 100, 30, 'INSPECT', powered(), function () { if (!powered()) { toast('No power.', 'bad'); return; } rdeskStart(k); }, '#5fd38d'); y += 40; }
        else { scText(c, 16, y, 'Nothing waiting', '#5fd38d', 14); scText(c, 16, y + 17, hall ? 'The belt brings them in from the returns dock' : 'Returns come in on the outbound trucks: look in the trailer', '#a0acb8', 11); y += 40; }
        if (D.queue.length > (st.cur ? 0 : 1)) { scText(c, 16, y, 'Also waiting: ' + D.queue.slice(st.cur ? 0 : 1).map(function (id) { var r2 = returnById(id); return '#' + (r2 ? r2.num : '?'); }).join(', '), '#a0acb8', 11); y += 18; }
        var good = D.shelf.filter(function (b) { return !b.damaged; }).length, bad = D.shelf.length - good;
        scText(c, 16, y + 4, (hall ? 'In the cage: ' : 'On the shelves: ') + (D.shelf.length ? good + ' resaleable' + (bad ? ', ' + bad + ' damaged' : '') : 'nothing'), D.shelf.length ? '#eef1f5' : '#6b7784', 13); y += 22;
        if (D.shelf.length) scText(c, 16, y + 2, (good ? 'good ones go back on a rack' : '') + (good && bad ? ' · ' : '') + (bad ? 'damaged ones go in the ' + (hall ? 'compactor' : 'bin') + ', no charge' : ''), '#a0acb8', 11);
        var pend = returnsPending().length - D.queue.length - D.s.filter(function (x) { return x.cur; }).length;
        scText(c, 16, sc.h - 40, pend > 0 ? pend + ' more return' + (pend > 1 ? 's' : '') + ' out there: on a truck, the belt or the floor' : 'Fee: ' + money(RETURNS.fee) + ' a return and ' + money(RETURNS.perBox) + ' a box', pend > 0 ? '#f5b53d' : '#6b7784', 11);
        scText(c, 16, sc.h - 22, 'A return left a day costs reputation', '#6b7784', 10);
      }
    /* 10-vehicles.js */
    var jackMesh = null, jackMeshes = {}, cartMesh = null, forkM = null, driving = false, forkSpeed = 0, forkLook = { yaw: 0, pitch: 0 }, jackModel = null;
    /* 10-vehicles.js */
    function isJack(t) { return t === 'jack' || t === 'jack2'; }
    /* 10-vehicles.js */
    function jackTool() { return isJack(player.tool) ? player.tool : 'jack'; }
    /* 10-vehicles.js */
    function toolWorld(tool) {
        if (player.tool === tool) return { x: player.x - Math.sin(player.yaw) * 1.15, z: player.z - Math.cos(player.yaw) * 1.15, ry: player.yaw + Math.PI };
        var t = S[tool]; return { x: t.x, z: t.z, ry: t.rot || 0 };
      }
    /* 10-vehicles.js */
    function cartParcels() { if (!S.cart.parcels) S.cart.parcels = []; return S.cart.parcels; }
    /* 10-vehicles.js */
    function cartLoad() { return S.cart.boxes.length + cartParcels().length; }
    /* 10-vehicles.js */
    function releaseTool() { if (!player.tool) return; if (player.tool === 'cable') { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; } var w = toolWorld(player.tool), tm = isJack(player.tool) ? jackMeshes[player.tool] : cartMesh; if (tm && tm.userData.towRy !== undefined) { w.ry = tm.userData.towRy; w.x = tm.position.x; w.z = tm.position.z; } var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
    /* 10-vehicles.js */
    function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
    /* 11-staff.js */
    function slotStand(key) { var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l), a = sp.ry || 0, nx = Math.sin(a), nz = Math.cos(a); var A = { x: sp.x + nx * 1.4, z: sp.z + nz * 1.4 }, B = { x: sp.x - nx * 1.4, z: sp.z - nz * 1.4 }; if (NAV.dirty || !NAV.grid) navBuild(); var ca = navCell(A), cb = navCell(B); if (navOpen(ca.i, ca.j)) return A; if (navOpen(cb.i, cb.j)) return B; return A; }
    /* 11-staff.js */
    var staffMeshes = {};
    /* 11-staff.js */
    var VOICE = {
        Jo:   { hi: 'Morning, boss. What have we got?', bye: 'That is me done. See you tomorrow.', onit: 'On it.', full: 'Bench is full, boss.', nospace: 'No rack space for this one.', idle: ['Quiet one today.', 'Did you see the game last night?', 'Coffee machine is on the blink again.', 'That truck driver never stops talking.'], brk: 'Lunch. Back in a bit.' },
        Mika: { hi: 'Right. Clocking in.', bye: 'Home time.', onit: 'Yep.', full: 'Bench. Full.', nospace: 'Nowhere to put it.', idle: ['Hm.', 'Could use a second jack.', 'Rain again.', 'Row C needs sorting.'], brk: 'Break.' },
        Sam:  { hi: 'Alright mate, what is the plan?', bye: 'Cheers, see you tomorrow mate.', onit: 'Leave it with me.', full: 'Bench is rammed, mate.', nospace: 'Racks are chocka, mate.', idle: ['Fancy a brew after this?', 'Those tyres weigh a ton.', 'Reckon it will rain?', 'New lad on the gate is alright.'], brk: 'Sarnie time.' },
        Ravi: { hi: 'Good morning. Ready when you are.', bye: 'Have a good evening.', onit: 'Certainly.', full: 'The bench cannot take any more.', nospace: 'There is no slot for this line.', idle: ['The orders are picking up.', 'I counted row A twice. It is right.', 'Lovely day for it.', 'The inspector is due soon, I think.'], brk: 'I will take my break now.' },
        Lena: { hi: 'Hey. Let us get it moving.', bye: 'Done for today. Night.', onit: 'Got it.', full: 'Bench is maxed.', nospace: 'Zero slots left for that.', idle: ['Forklift beeps are stuck in my head.', 'Who left the dock open?', 'I like the new sign.', 'Need more tape at the bench.'], brk: 'Lunch!' },
        Ada:  { hi: 'Morning all.', bye: 'Off home.', onit: 'Sure.', full: 'No room on the bench.', nospace: 'Racks are full for that line.', idle: ['Peaceful.', 'Trucks are late today.', 'Nice and tidy, that row.', 'I will sort the empties later.'], brk: 'Tea break.' },
        Theo: { hi: 'Yo. Clocking in.', bye: 'Peace.', onit: 'Say less.', full: 'Bench is packed out.', nospace: 'Nowhere for it, chief.', idle: ['Radio is decent today.', 'Who ordered forty lamps?', 'Yard is slippy.', 'Pigeons are back.'], brk: 'Food.' },
        Nour: { hi: 'Good morning. Shall we?', bye: 'Goodnight, everyone.', onit: 'Of course.', full: 'The bench is full, I am afraid.', nospace: 'No rack space for this pallet.', idle: ['The clients are happy this week.', 'I rewrote the pick list.', 'It is cold in here.', 'Nice work on that order.'], brk: 'Lunch time.' }
      };
    /* 11-staff.js */
    function voice(st) { return VOICE[st.name] || VOICE.Jo; }
    /* 11-staff.js */
    function staffSay(st, text, col) { var m = staffMeshes[st.id]; if (m && m.visible) say(m, text, col); }
    /* 11-staff.js */
    function staffById(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
    /* 11-staff.js */
    function hireStaff(role) {
        var def = STAFF_ROLES[role]; if (!def) return;
        if (S.level < def.lvl) { toast('A ' + def.name.toLowerCase() + ' can be hired from level ' + def.lvl + '.', 'bad'); return; } if (S.staff.length >= staffCap()) { toast('The crew is ' + staffCap() + ' at this level: it grows as you level.', 'bad'); return; }   // the ladder gates the hire itself, not only the buttons (1.21.0)
        if (def.needs && !S.up[def.needs]) { toast('Buy the forklift first: a driver needs something to drive.', 'bad'); return; }
        var used = S.staff.map(function (s) { return s.name; }), free = STAFF_NAMES.filter(function (n) { return used.indexOf(n) < 0; }), name = free.length ? free[S.nextStaffName++ % free.length] : STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];   // no two Jos
        var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0, punct: randf(0.2, 1), arriveOff: 0, hoursToday: 0, sheet: [] };
        S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase() + '. Paid ' + money(def.wage / 10) + ' an hour from the time clock, time and a half past ten hours.', 'good'); hudDirty = true; if (S.time < 17 && !isSunday()) { st.state = 'home'; st.arriveOff = Math.max(0, Math.round((S.time + 0.15 - SHIFT_START) * 60)); }   // hired before the shift: they come in at the start, not in the night
      }
    /* 11-staff.js */
    function fireStaff(id) {
        var st = staffById(id); if (!st) return;
        staffDropAll(st); var fh = st.hoursToday || 0; if (fh > 0.05 && st.clocked !== undefined) { var fpay = Math.round(hourly(st) * (Math.min(fh, 10.25) + Math.max(0, fh - 10.25) * 1.5)); if (fpay > 0) pay(-fpay, 'Final pay, ' + st.name + ' (' + (Math.round(fh * 10) / 10) + ' h)'); }   // the hours worked today are paid on the way out
        var m = staffMeshes[id]; if (m) { if (m.userData.jack) scene.remove(m.userData.jack); if (m.userData.hit) { var hi = inter.indexOf(m.userData.hit); if (hi >= 0) inter.splice(hi, 1); } scene.remove(m); delete staffMeshes[id]; }
        S.staff.splice(S.staff.indexOf(st), 1); logEvent(st.name + ' let go'); hudDirty = true;
      }
    /* 11-staff.js */
    function buildStaffMesh(st) {
        var vest = st.role === 'receiver' ? MAT.hivisOrange : st.role === 'picker' ? MAT.hivis : st.role === 'driver' ? MAT.hivis : MAT.green;
        var look = st.look || {};
        var g = makeHuman({ skin: look.skin, hair: look.hair, style: look.style, vest: vest, hardhat: st.role === 'receiver' || st.role === 'driver' ? (st.role === 'driver' ? MAT.yellow : MAT.white) : null, name: st.name }); g.userData.dynamic = true; g.position.set(st.x, 0, st.z); scene.add(g); staffMeshes[st.id] = g;
        if (hasJack(st) && jackModel) g.userData.jack = jackModel('staffjack', true);
        g.userData.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { staffId: st.id, prompt: function () { return staffPrompt(st); }, use: function () { staffUse(st); } }, g);   // look at a worker: name, job, status, timekeeping   // a receiver has a pallet jack of their own: pushed under the pallet, towed behind them when empty
      }
    /* 11-staff.js */
    function staffDriving() { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].state === 'drive') return S.staff[i]; return null; }
    /* 11-staff.js */
    function staffDropAll(st) {
        if (st.state === 'drive') driverDismount(st);
        S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = floorY(p.x, p.z); p.rot = st.yaw; p.staff = null; } });   // a pallet on the jack is set down where the worker stands (two metres ahead put it inside the rack they were facing)
        if (st.carry) {
          var cy = st.carry, bk = cy.kind === 'box' && !cy.damaged ? findSlotFor(cy.sku, 1, 1) : null;
          if (cy.kind === 'box') { if (bk) slotAdd(bk, cy.sku, 1); else S.floor.push({ kind: 'box', sku: cy.sku, damaged: !!cy.damaged, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
          else if (cy.kind === 'return') { if (rdesk().queue.length < rdeskCap()) rdesk().queue.push(cy.id); else S.floor.push({ kind: 'return', id: cy.id, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
          else if (orderById(cy.order) && S.bench.parcels.length < shelfCap()) S.bench.parcels.push(cy.order);
          else if (orderById(cy.order)) S.floor.push({ kind: 'parcel', order: cy.order, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw });
          st.carry = null;
        }
        st.task = null; st.state = 'idle'; st.path = [];
      }
    /* 11-staff.js */
    function pickInFlight() {
        var n = {}, add = function (sku) { n[sku] = (n[sku] || 0) + 1; };
        ['pickBelt', 'pickBelt2', 'pickMerge', 'upperPick', 'upperChute'].forEach(function (bid) { if (BELTS[bid]) beltItems(bid).forEach(function (it) { if (it.kind === 'box') add(it.sku); }); });
        if (S.up.gantry) gantryRows().forEach(function (r) { var G = gantryState(r); if (G.sku && G.state !== 'idle') add(G.sku); });
        S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') { if (!st.carry.back && !st.carry.bin) add(st.carry.sku); } else if (st.task && st.task.kind === 'pick') add(st.task.sku); });
        return n;
      }
    /* 11-staff.js */
    function driverDismount(st) {
        var p = S.fork.pallet ? palletById(S.fork.pallet) : null;
        if (p && st.task && st.task.pallet === p.id) { var ft = forkTip(); p.place = 'floor'; p.x = ft.x; p.z = ft.z; p.y = 0; p.rot = S.fork.yaw; S.fork.pallet = null; }
        if (!S.fork.pallet) S.fork.lift = Math.min(S.fork.lift, 0.3);
        st.drive = null; st.task = null; st.state = 'idle'; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw;
      }
    /* 11-staff.js */
    var JACK_HOME = BOOT_STAGE === 0 ? { x: -3.9, z0: 4.1, step: 0 } : { x: -HALL.x + 1.3, z0: BOOT_STAGE >= 2 ? 11.4 : -2.0, step: 1.5 };
    /* 11-staff.js */
    function hasJack(st) { return st.role === 'receiver' || st.cross === 'receiver'; }
    /* 11-staff.js */
    function jackRank(st, list) { var n = 0; list = list || S.staff; for (var i = 0; i < list.length; i++) { var o = list[i]; if (o === st) return n; if (hasJack(o)) n++; } return n; }
    /* 11-staff.js */
    function jackHome(st, list) { var k = jackRank(st, list); return { x: JACK_HOME.x, z: JACK_HOME.z0 + k * JACK_HOME.step, ry: -Math.PI / 2 }; }
    /* 11-staff.js */
    function punctWord(st) { var p = st.punct === undefined ? 0.6 : st.punct; return p >= 0.75 ? 'reliable' : p >= 0.4 ? 'fair timekeeper' : 'poor timekeeper'; }
    /* 11-staff.js */
    function staffPrompt(st) { return st.name + ' · ' + STAFF_ROLES[st.role].name.toLowerCase() + (st.cross && STAFF_ROLES[st.cross] ? ' (and ' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + ' · ' + staffStatus(st) + ' · ' + punctWord(st) + (st.lateToday && !st.wordToday ? ' · E: have a word about the time' : ''); }
    /* 11-staff.js */
    function staffUse(st) { if (st.lateToday && !st.wordToday) { staffWord(st); staffSay(st, pick(['Sorry, boss. Will not happen again.', 'Yes, I know. Sorry.', 'Alarm did not go off. Sorry.']), '#a0acb8'); return; } staffSay(st, pick(voice(st).idle), '#a0acb8'); sfx('click'); }
    /* 11-timeclock.js */
    var RAMP_BOTTOM = { x: -HALL.x - 7.3, z: SPOT.staffDoor.z }, SHIFT_START = 8;
    /* 11-timeclock.js */
    var STAFF_SHIFTS = { early: { start: 6, end: 16 }, day: { start: 8, end: 18 }, late: { start: 12, end: 22 } }, TRAIN_PRICE = 400, CROSS_PRICE = 350, RAISE_PRICE = 250;
    /* 11-timeclock.js */
    function shiftOf(st) { return STAFF_SHIFTS[st.shift] || STAFF_SHIFTS.day; }
    /* 11-timeclock.js */
    function shiftStart(st) { return shiftOf(st).start; }
    /* 11-timeclock.js */
    function hourly(st) { return STAFF_ROLES[st.role].wage / 10 * (st.raise ? 1.1 : 1); }
    /* 11-timeclock.js */
    function staffArrival(st) { return shiftStart(st) + (st.arriveOff || 0) / 60; }
    /* 11-timeclock.js */
    function staffCap() { return staffCapAt(S.level); }
    /* 11-timeclock.js */
    function staffTrain(st) { if (st.trained) return; if (!unlocked('training')) { toast('Training courses come at level ' + UNLOCK.training + '.', 'bad'); return; } if (S.bank < TRAIN_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-TRAIN_PRICE, 'Training course, ' + st.name); st.trained = true; sfx('cash'); toast(st.name + ' is trained: quicker on their feet and at every task', 'good'); logEvent(st.name + ' finished the ' + STAFF_ROLES[st.role].name.toLowerCase() + ' course', 'good'); }
    /* 11-timeclock.js */
    function staffRaise(st) { if (st.raise) return; if (!unlocked('raise')) { toast('Raises come at level ' + UNLOCK.raise + '.', 'bad'); return; } if (S.bank < RAISE_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-RAISE_PRICE, 'Raise for ' + st.name); st.raise = true; st.punct = 1; if ((st.arriveOff || 0) > 0) st.arriveOff = 0; sfx('cash'); staffSay(st, pick(['Cheers, boss.', 'I will not let you down.', 'Appreciated.']), '#5fd38d'); logEvent(st.name + ' got a raise: 10% more an hour, and on time from now on', 'good'); }
    /* 11-timeclock.js */
    function staffShiftCycle(st) { if (!unlocked('shifts')) { toast('Shift patterns come at level ' + UNLOCK.shifts + '.', 'bad'); return; } var order = ['day', 'early', 'late'], cur = st.shiftNext || st.shift || 'day', nx = order[(order.indexOf(cur) + 1) % 3], now = st.state === 'home' && !st.clocked && !st.clockedOutAt; if (now) { st.shift = nx; st.shiftNext = null; } else st.shiftNext = nx; var sh = STAFF_SHIFTS[nx]; sfx('click'); toast(st.name + ' moves to the ' + nx + ' shift' + (now ? '' : ' from tomorrow') + ' (' + fmtTime(sh.start) + ' to ' + fmtTime(sh.end) + ')', 'good'); logEvent(st.name + ' moves to the ' + nx + ' shift' + (now ? '' : ' from tomorrow')); }
    /* 11-timeclock.js */
    function staffCrossCycle(st) {
        if (!unlocked('cross')) { toast('Second roles come at level ' + UNLOCK.cross + '.', 'bad'); return; }
        var roles = Object.keys(STAFF_ROLES).filter(function (r) { return r !== st.role && !(STAFF_ROLES[r].needs && !S.up[STAFF_ROLES[r].needs]); }); if (!roles.length) return;
        var i = roles.indexOf(st.cross || ''), next = i < 0 ? roles[0] : i + 1 < roles.length ? roles[i + 1] : null;
        if (next && !st.crossPaid) { if (S.bank < CROSS_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-CROSS_PRICE, 'Cross-training, ' + st.name); st.crossPaid = true; }
        st.cross = next; if (st.state === 'idle') st.task = null; sfx('click');   // a worker mid-task keeps it: dropping a fetch or a pick orphaned the claim
        var cm = staffMeshes[st.id], wantJack = st.role === 'receiver' || st.cross === 'receiver';
        if (cm && wantJack && !cm.userData.jack && jackModel) cm.userData.jack = jackModel('staffjack', true);
        if (cm && !wantJack && cm.userData.jack) { scene.remove(cm.userData.jack); cm.userData.jack = null; st.jackParked = false; st.jackAt = null; }
        toast(next ? st.name + ' also covers ' + STAFF_ROLES[next].name.toLowerCase() + ' work when their own queue is empty' : st.name + ' sticks to ' + STAFF_ROLES[st.role].name.toLowerCase() + ' work', 'good');
      }
    /* 11-timeclock.js */
    function staffStatus(st) {
        if (isSunday()) return 'Sunday';
        if (st.sick) return 'called in sick'; if (st.dayOff) return 'day off';
        if (st.state === 'home' && S.time < staffArrival(st)) return 'due ' + fmtTime(staffArrival(st));
        if (st.state === 'home' && st.clockedOutAt) return 'clocked out ' + fmtTime(st.clockedOutAt);
        if (st.state === 'home') return 'not in';
        if (!st.clocked) return 'arriving';
        if (st.state === 'break') return 'on break';
        return 'in since ' + fmtTime(st.clockInAt || shiftStart(st)) + (st.overtime ? ' · overtime' : '') + (st.lateToday ? ' · late' : '');
      }
    /* 11-timeclock.js */
    function staffNewDay() {
        S.staff.forEach(function (st) {
          if (st.state !== 'home') { staffDropAll(st); st.state = 'home'; } if (hasJack(st)) { st.jackParked = true; st.jackAt = jackHome(st); }   // the jacks stand in their row overnight, wherever the day left them   // whoever was still in at the roll (a sleep at 17:00, a late shift at midnight) goes home now, or they stand frozen from then on
          if (st.shiftNext) { st.shift = st.shiftNext; st.shiftNext = null; }
          if (st.dayOffNext && !isSunday()) { st.dayOff = true; st.dayOffNext = false; } else st.dayOff = false;   // a day off booked for a Sunday keeps for Monday
          st.sick = !st.dayOff && Math.random() < 0.04;
          if (st.punct === undefined) st.punct = randf(0.2, 1); if (st.raise) st.punct = 1;   // a raise keeps them on time for good
          var p = st.punct, r = Math.random();
          st.arriveOff = p > 0.75 ? randi(-12, -2) : p > 0.4 ? (r < 0.7 ? randi(-6, 4) : randi(6, 14)) : (r < 0.35 ? randi(-3, 3) : randi(8, 28));
          st.overtime = !!st.overtimeNext; st.overtimeNext = false;
          st.said = 0; st.lateToday = false; st.hoursToday = 0; st.clockInAt = null; st.clockedOutAt = null; st.clocked = false; st.wordToday = false; st.leaving = false; st.leavingWait = false;
          if (st.sick) logEvent(st.name + ' called in sick', 'bad');
          if (st.dayOff) logEvent(st.name + ' has the day off');
          if (st.punct < 1 && !st.raise) st.punct = clamp(st.punct - 0.01, 0.1, 1);   // a word wears off slowly
        });
      }
    /* 11-timeclock.js */
    function payStaffWages() {
        S.staff.forEach(function (st) {
          var h = st.hoursToday || 0, base = Math.min(h, 10.25), ot = Math.max(0, h - 10.25), amount = Math.round(hourly(st) * (base + ot * 1.5));   // a quarter hour's grace: an early arrival and the clock-out walk are on the clock too
          if (!st.sheet) st.sheet = []; st.sheet.unshift({ day: S.day - 1, h: Math.round(h * 10) / 10, late: !!st.lateToday, sick: !!st.sick, off: !!st.dayOff, ot: Math.round(ot * 10) / 10, pay: amount }); if (st.sheet.length > 7) st.sheet.pop();
          st.hoursTotal = (st.hoursTotal || 0) + h;
          if (amount > 0) pay(-amount, 'Wages, ' + st.name + ' (' + (Math.round(h * 10) / 10) + ' h' + (ot ? ', ' + (Math.round(ot * 10) / 10) + ' h overtime' : '') + ')');
        });
      }
    /* 11-timeclock.js */
    function staffWord(st) {
        if (st.wordToday) { toast('You already had a word with ' + st.name + ' today.', ''); return; }
        st.wordToday = true; st.punct = clamp(st.punct + 0.35, 0, 0.99); sfx('click');   // short of the raise's pinned 1: a word wears off, a raise does not
        staffSay(st, pick(['Understood, boss.', 'Fair enough. I will be on time.', 'Will not happen again.']), '#f5b53d'); logEvent('Had a word with ' + st.name + ' about timekeeping'); if (S.wordRepDay !== S.day) { S.wordRepDay = S.day; addRep(0.2); }
      }
    /* 11-timeclock.js */
    function myClock(on) {
        if (on === !!S.clockedIn) return;
        if (on) { S.clockedIn = true; S.clockInAt = S.time; S.clockInDay = S.day; introStep('clockin'); S.shiftStart = { shipped: S.stats.shipped, received: S.stats.received, earned: S.stats.earned, spent: S.stats.spent }; sfx('scan'); toast('Clocked in at ' + fmtTime(S.time), 'good'); logEvent('You clocked in at ' + fmtTime(S.time)); if (S.time < 7.5 && S.time >= DAY_START && S.earlyDay !== S.day) { S.earlyDay = S.day; addXp(5); toast('Early bird: +5 XP', 'rare'); } }
        else {
          var h = S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time, ss = S.shiftStart || S.stats;
          S.clockedIn = false; S.stats.hoursWorked = (S.stats.hoursWorked || 0) + h; sfx('scan');
          var rep = 'Shift: ' + (Math.round(h * 10) / 10) + ' h · ' + (S.stats.shipped - ss.shipped) + ' orders shipped · ' + (S.stats.received - ss.received) + ' pallets in · ' + money(S.stats.earned - ss.earned) + ' earned, ' + money(S.stats.spent - ss.spent) + ' spent';
          toast('Clocked out. ' + rep, 'good'); logEvent('You clocked out at ' + fmtTime(S.time) + '. ' + rep, 'rare'); if (h >= 8) addXp(10);
        }
        hudDirty = true; screenDirtyAll();
      }
    /* 11-timeclock.js */
    function myHours() { if (!S.clockedIn) return 0; return S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time; }
    /* 11-timeclock.js */
    var tclock = { page: 0 };
    /* 11-timeclock.js */
    function drawTimeClock(c, sc) {
        scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.16)'); scHead(c, sc.w, tclock.page ? 'TIMESHEET' : 'TIME CLOCK');
        scButton(sc, 230, 8, 60, 24, tclock.page ? 'now' : 'sheet', false, function () { tclock.page = tclock.page ? 0 : 1; });
        var y = 60;
        if (!tclock.page) {
          scText(c, 12, y, 'You · ' + (S.clockedIn ? 'in since ' + fmtTime(S.clockInAt) + ' (' + (Math.round(myHours() * 10) / 10) + ' h)' : 'not clocked in'), S.clockedIn ? '#5fd38d' : '#eef1f5', 13);
          scButton(sc, 12, y + 8, 276, 32, S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', !S.clockedIn, function () { myClock(!S.clockedIn); }, '#5fd38d'); y += 54;
          if (!S.staff.length) scText(c, 12, y + 10, 'No crew yet. Hire on the office PC.', '#6b7784', 12);
          S.staff.forEach(function (st) {
            if (y > sc.h - 30) return;
            scText(c, 12, y, st.name + ' · ' + STAFF_ROLES[st.role].name, '#eef1f5', 12); scText(c, 12, y + 14, staffStatus(st) + (st.hoursToday ? ' · ' + (Math.round(st.hoursToday * 10) / 10) + ' h' : ''), st.lateToday ? '#ff6b5e' : '#a0acb8', 10);
            var otOk = shiftOf(st).end < DAY_END; scButton(sc, 196, y - 10, 28, 22, 'OT', !!(st.overtime || st.overtimeNext), function () { if (!otOk) { toast('The late shift already ends at closing time.', ''); return; } if (st.clocked && !st.sick && !st.dayOff) st.overtime = !st.overtime; else st.overtimeNext = !st.overtimeNext; var e = STAFF_SHIFTS[st.shiftNext || st.shift || 'day'].end; toast(st.name + (st.overtime || st.overtimeNext ? ' works till ' + fmtTime(Math.min(DAY_END, e + 2)) + ' at time and a half' : ' goes home at ' + fmtTime(e)), ''); }, '#f5b53d');
            scButton(sc, 228, y - 10, 30, 22, 'OFF', !!st.dayOffNext, function () { st.dayOffNext = !st.dayOffNext; toast(st.name + (st.dayOffNext ? ' has tomorrow off' : ' is in tomorrow'), ''); }, '#78bdf5');
            if (st.lateToday && !st.wordToday) scButton(sc, 262, y - 10, 28, 22, '!', true, function () { staffWord(st); }, '#ff6b5e');
            y += 27;   // eight rows fit the screen since the crew grew to eight
          });
        } else {
          scText(c, 12, y, 'Last 7 days · hours (overtime) · pay', '#a0acb8', 11); y += 18;
          S.staff.forEach(function (st) {
            if (y > sc.h - 24) return;
            var tot = (st.sheet || []).reduce(function (a, r) { return a + r.pay; }, 0), hrs = (st.sheet || []).reduce(function (a, r) { return a + r.h; }, 0), lates = (st.sheet || []).filter(function (r) { return r.late; }).length;
            scText(c, 12, y, st.name + ' · ' + (Math.round(hrs * 10) / 10) + ' h · ' + money(tot) + (lates ? ' · late ×' + lates : ''), '#eef1f5', 12); y += 14;
            scText(c, 12, y, (st.sheet || []).slice(0, 7).map(function (r) { return r.sick ? 'sick' : r.off ? 'off' : (Math.round((r.h - r.ot) * 10) / 10) + (r.ot ? '+' + r.ot : ''); }).join('  ') || 'no days yet', '#a0acb8', 10); y += 20;
          });
          scText(c, 12, sc.h - 10, 'You: ' + (Math.round((S.stats.hoursWorked || 0) * 10) / 10) + ' h on the clock all time', '#6b7784', 10);
        }
      }
    /* 12-machines.js */
    var MACH = {}, BELTS = {}, BELT_PLANES = [];
    /* 12-machines.js */
    var BELT_SPEED = 0.5, BELT_GAP = 0.45, BELT_Y = 0.75, REACH = 1.3;
    /* 12-machines.js */
    var SPEED_STEPS = [0.5, 0.75, 1, 1.5, 2];
    /* 12-machines.js */
    function speedOf(key) { var v = S.speed && S.speed[key]; return typeof v === 'number' ? v : 1; }
    /* 12-machines.js */
    function speedSteps(key) { return S.up.plantTune || (key === 'sorter' && unlocked('deckTune')) ? SPEED_STEPS.concat([2.5, 3]) : SPEED_STEPS; }
    /* 12-machines.js */
    function speedCycle(key) { if (!S.speed) S.speed = {}; var steps = speedSteps(key), i = steps.indexOf(speedOf(key)); S.speed[key] = steps[(i + 1) % steps.length]; sfx('click'); screenDirtyAll(); }
    /* 12-machines.js */
    function speedButton(sc, x, y, w, key, label) { var pct = Math.round(speedOf(key) * 100) + '%'; scButton(sc, x, y, w, 30, w < 80 ? pct : (label || 'SPD') + ' ' + pct, true, function () { speedCycle(key); }, '#78bdf5'); }
    /* 12-machines.js */
    function beltItems(id) { if (!S.belts) S.belts = {}; if (!S.belts[id]) S.belts[id] = []; return S.belts[id]; }
    /* 12-machines.js */
    var sinkCache = {};
    /* 12-machines.js */
    function beltsChanged() { sinkCache = {}; }
    /* 12-machines.js */
    function beltLabel(b) { return propLabel(b.prop); }
    /* 12-machines.js */
    function doorInside(i) { var d = doors[i]; return d ? [d.side * (HALL.x - 1.2), d.z] : null; }
    /* 12-machines.js */
    function lampSet(m, status) { if (!m.lamps) return; m.lamps.g.visible = status === 'run'; m.lamps.a.visible = status === 'idle'; m.lamps.r.visible = status === 'jam' || status === 'off'; }
    /* 12-machines.js */
    function packStatus() { if (!powered()) return 'off'; if (S.pack.jam) return 'jam'; return S.pack.job ? 'run' : 'idle'; }
    /* 12-machines.js */
    function shelfCap() { return BOOT_STAGE === 0 ? 6 : 12; }
    /* 12-machines.js */
    function packOrder(o) {
        if (o.state !== 'open') return false;
        var n = orderNeed(o); if (n.have < Math.ceil(n.tot / 2)) return false; if (BOOT_STAGE === 0 && n.have < n.tot) return false;   // the shed packs whole orders only
        var boxes = []; o.lines.forEach(function (l) { l.packed = benchTake(l.sku, l.qty); for (var i = 0; i < l.packed; i++) boxes.push(l.sku); });
        o.short = n.have < n.tot; o.state = 'packing'; S.pack.queue.push({ order: o.id, boxes: boxes, fed: 0, inMach: 0, t: 0, hand: BOOT_STAGE === 0 });
        sfx('click'); rebuildBoardSoon(); logEvent('Order #' + o.num + ' released to the pack line' + (o.short ? ' (short)' : ''));
        return true;
      }
    /* 12-machines.js */
    function packPrompt() { if (S.pack.jam) return 'Clear the jam on the pack line'; if (!powered()) return 'Pack line · no power'; var j = S.pack.job; return 'Pack line · ' + (j ? 'packing order #' + (orderById(j.order) || { num: '?' }).num + ' · ' + j.inMach + '/' + j.boxes.length : S.pack.queue.length ? S.pack.queue.length + ' waiting' : 'idle') + ' · ' + S.pack.made + ' parcels made'; }
    /* 12-machines.js */
    function packUse() { if (S.pack.jam) { S.pack.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } openPanel('bench'); }
    /* 12-machines.js */
    function packScreenDraw(c, sc) {
        var st = packStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'CASE TAPER', st.toUpperCase());
        var j = S.pack.job, o = j ? orderById(j.order) : null;
        scText(c, 16, 70, o ? 'Order #' + o.num + ' · ' + clientName(o.client) : 'No job', '#eef1f5', 16);
        scText(c, 16, 94, j ? 'Boxes in: ' + j.inMach + ' / ' + j.boxes.length + (j.inMach >= j.boxes.length ? ' · taping ' + Math.max(0, 3 - j.t).toFixed(1) + ' s' : '') : S.pack.queue.length + ' in the queue', '#a0acb8', 13);
        scText(c, 16, 118, 'Parcels made: ' + S.pack.made + ' · shelf ' + S.bench.parcels.length + '/' + shelfCap(), '#a0acb8', 13);
        if (S.pack.jam) scButton(sc, 16, 140, 150, 34, 'CLEAR JAM', true, function () { packUse(); }, '#ff6b5e');
        speedButton(sc, 176, 142, 108, 'packline'); if (speedOf('packline') > 1 && !S.up.plantAuto) scText(c, 176, 188, 'fast: jams more', '#ff6b5e', 10);
      }
    /* 12-machines.js */
    var FACTORY_RATE = 8;
    /* 12-machines.js */
    function ownSkus() { return SKUS.filter(function (s) { return s.own; }); }
    /* 12-machines.js */
    function factoryStatus() { var F = S.factory; if (!powered()) return 'off'; if (F.jam) return 'jam'; return F.on && F.raw > 0 ? 'run' : 'idle'; }
    /* 12-machines.js */
    function moulderPrompt() { var F = S.factory; if (F.jam) return 'Clear the jam on the moulding line'; return 'Moulding line · ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product) + ' · hopper ' + F.raw + ' · made ' + F.made; }
    /* 12-machines.js */
    function moulderUse() { var F = S.factory; if (F.jam) { F.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } if (!powered()) { toast('No power.', 'bad'); return; } F.on = !F.on; sfx('click'); if (F.on && F.raw <= 0) { F.on = false; toast('The hopper is empty. Tip a pallet of raw granulate in first.', 'bad'); } screenDirtyAll(); }
    /* 12-machines.js */
    function moulderScreenDraw(c, sc) {
        var F = S.factory, st = factoryStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'MOULDING LINE', st.toUpperCase());
        scText(c, 16, 66, 'Hopper ' + F.raw + ' / ' + HOPPER_CAP + ' units' + (F.raw ? ' · a unit a box' : ' · EMPTY'), F.raw ? '#eef1f5' : '#ff6b5e', 14);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 76, sc.w - 32, 10); c.fillStyle = F.raw > 40 ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 76, (sc.w - 32) * clamp(F.raw / HOPPER_CAP, 0, 1), 10);
        scText(c, 16, 108, 'Product', '#6b7784', 11);
        ownSkus().forEach(function (s, i) { scButton(sc, 16 + i * 124, 116, 118, 30, s.name.replace('Depot Co. ', ''), F.product === s.id, function () { F.product = s.id; sfx('click'); }, '#78bdf5'); });
        scButton(sc, 16, 160, 110, 34, F.on ? 'STOP' : 'START', F.on, function () { moulderUse(); }, F.on ? '#ff6b5e' : '#5fd38d');
        if (F.jam) scButton(sc, 136, 160, 120, 34, 'CLEAR JAM', true, function () { moulderUse(); }, '#ff6b5e');
        speedButton(sc, 270, 162, 110, 'moulder');
        scText(c, 16, 220, 'Made ' + F.made + ' · ' + (FACTORY_RATE / speedOf('moulder')).toFixed(0) + ' s a box · one unit of granulate each · the dial also drives its belt', '#a0acb8', 12);
        scText(c, 16, 240, 'Boxes go down the belt to the palletiser in the hall.', '#6b7784', 11);
      }
    /* 12-machines.js */
    var RAW_PER_SACK = 5, HOPPER_CAP = 400;
    /* 12-machines.js */
    function rawPalletInHand() { var p = isJack(player.tool) ? jackPallet() : driving ? forkPallet() : null; return p && p.sku === 'raw' ? p : null; }
    /* 12-machines.js */
    function hopperPrompt() { var p = rawPalletInHand(); if (p) return S.factory.raw + p.n * RAW_PER_SACK > HOPPER_CAP ? 'No room in the hopper for this pallet (' + (HOPPER_CAP - S.factory.raw) + ' units free)' : 'Tip the granulate into the hopper (+' + p.n * RAW_PER_SACK + ')'; return 'Raw hopper · ' + S.factory.raw + ' / ' + HOPPER_CAP + ' units' + (isJack(player.tool) || driving ? ' · bring a pallet of raw granulate' : ''); }
    /* 12-machines.js */
    function hopperUse() {
        var p = rawPalletInHand(); if (!p) { sfx('bad'); return; } if (S.factory.raw + p.n * RAW_PER_SACK > HOPPER_CAP) { toast('The hopper has room for ' + (HOPPER_CAP - S.factory.raw) + ' units; this pallet is ' + p.n * RAW_PER_SACK + '.', 'bad'); sfx('bad'); return; }
        S.factory.raw = Math.min(HOPPER_CAP, S.factory.raw + p.n * RAW_PER_SACK);
        for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === p.id) { S.pallets.splice(i, 1); break; }
        if (S.jack.pallet === p.id) S.jack.pallet = null; if (S.jack2 && S.jack2.pallet === p.id) S.jack2.pallet = null; if (S.fork.pallet === p.id) S.fork.pallet = null;
        S.pallets.push(newPalletObj('empty')); sfx('hydraulic'); addXp(4); toast('Granulate tipped in: hopper at ' + S.factory.raw, 'good'); logEvent('Tipped a pallet of raw granulate into the hopper'); screenDirtyAll(); hudDirty = true;
        if (MACH.hopper.anim) MACH.hopper.anim.tipT = 1.5;
      }
    /* 12-machines.js */
    function newPalletObj() { var w = propWorld('hopper', 1.8, 0.4); for (var k = 1; k < 5 && S.pallets.some(function (q) { return q.place === 'floor' && dist2(q.x, q.z, w.x, w.z) < 1; }); k++) w = propWorld('hopper', 1.8 + k * 1.3, 0.4); return { id: uid('pl'), sku: 'raw', n: 0, place: 'floor', x: w.x, y: 0, z: w.z, rot: w.a }; }
    /* 12-machines.js */
    function hopperScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'HOPPER', F.raw + ' / ' + HOPPER_CAP); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(20, 50, 40, 100); c.fillStyle = '#f5b53d'; var hh = 100 * clamp(F.raw / HOPPER_CAP, 0, 1); c.fillRect(20, 150 - hh, 40, hh); scText(c, 76, 80, 'Raw granulate', '#eef1f5', 14); scText(c, 76, 102, 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units.', '#a0acb8', 11); scText(c, 76, 120, 'Order pallets on the office PC.', '#a0acb8', 11); }
    /* 12-machines.js */
    function palletiserEject() {
        var P = S.pal; if (!P.n) return; var w = propWorld('palletiser', 2.2, 0);
        newPallet(P.sku, P.n, { place: 'floor', x: w.x, z: w.z, rot: w.a, y: 0 }); if (S.seenSkus.indexOf(P.sku) < 0) S.seenSkus.push(P.sku); S.stats.palletised = (S.stats.palletised || 0) + 1;
        logEvent('The palletiser finished a pallet of ' + P.n + ' × ' + skuName(P.sku), 'good'); sfx('hydraulic'); addXp(6); P.sku = null; P.n = 0; screenDirtyAll();
      }
    /* 12-machines.js */
    function palletiserPrompt() { var P = S.pal; return 'Palletiser · ' + (P.n ? P.n + ' × ' + skuName(P.sku) + ' on the pallet · E ejects it' : 'waiting for boxes'); }
    /* 12-machines.js */
    function palletiserUse() { if (S.pal.n) palletiserEject(); else sfx('bad'); }
    /* 12-machines.js */
    function palletiserScreenDraw(c, sc) { var P = S.pal; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'PALLETISER', powered() ? (P.n ? 'STACKING' : 'READY') : 'OFF'); scText(c, 16, 70, P.n ? P.n + ' / 8 · ' + skuName(P.sku) : 'Empty pallet in the cradle', '#eef1f5', 16); for (var i = 0; i < 8; i++) { c.fillStyle = i < P.n ? '#5fd38d' : 'rgba(255,255,255,0.1)'; c.fillRect(16 + i * 30, 86, 24, 24); } speedButton(sc, 148, 125, 136, 'beltMain', 'BELT'); scButton(sc, 16, 124, 120, 32, 'EJECT', P.n > 0, function () { palletiserUse(); }); scText(c, 16, 180, 'Pallets made: ' + (S.stats.palletised || 0), '#a0acb8', 12); lampSet(MACH.palletiser, powered() ? (P.n ? 'run' : 'idle') : 'off'); }
    /* 12-machines.js */
    var BALE_NEED = 10, BALE_PRICE = 18;
    /* 12-machines.js */
    function balerStatus() { if (!powered()) return 'off'; return S.baler.t > 0 ? 'run' : 'idle'; }
    /* 12-machines.js */
    function addWaste(n) { if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; S.baler.card += n; screenDirtyAll(); }
    /* 12-machines.js */
    function balerPrompt() { var B = S.baler; if (B.t > 0) return 'Baling… ' + Math.ceil(B.t) + ' s'; if (!powered()) return 'Baler · no power'; return 'Baler · ' + B.card + ' / ' + BALE_NEED + ' cardboard in the chamber' + (B.card >= BALE_NEED ? ' · E makes a bale' : '') + (B.bales ? ' · ' + B.bales + ' bale' + (B.bales > 1 ? 's' : '') + ' waiting for a truck' : ''); }
    /* 12-machines.js */
    function balerUse() { var B = S.baler; if (B.t > 0 || !powered()) { sfx('bad'); return; } if (B.card < BALE_NEED) { toast('Not enough cardboard yet: ' + B.card + ' of ' + BALE_NEED + '. Binned boxes and packing offcuts fill it.', ''); sfx('bad'); return; } B.t = 8; B.card -= BALE_NEED; sfx('hydraulic'); addXp(3); screenDirtyAll(); }
    /* 12-machines.js */
    function balerScreenDraw(c, sc) { var B = S.baler; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'BALER', balerStatus().toUpperCase()); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 46, sc.w - 32, 12); c.fillStyle = B.card >= BALE_NEED ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 46, (sc.w - 32) * clamp(B.card / BALE_NEED, 0, 1), 12); scText(c, 16, 80, 'Chamber ' + B.card + ' / ' + BALE_NEED, '#eef1f5', 14); scText(c, 16, 100, 'Bales waiting ' + B.bales + ' · made ' + B.made, '#a0acb8', 12); speedButton(sc, 134, 117, 90, 'baler'); scButton(sc, 16, 116, 110, 32, B.t > 0 ? Math.ceil(B.t) + ' s' : 'BALE', B.card >= BALE_NEED && !B.t, function () { balerUse(); }); scText(c, 16, 162, 'Trucks pay ' + money(BALE_PRICE) + ' a bale', '#6b7784', 11); }
    /* 12-machines.js */
    function sellBales(t) { var B = S.baler; if (!B || !B.bales || t.dir !== 'out') return; var n = Math.min(4, B.bales); B.bales -= n; pay(n * BALE_PRICE, 'Cardboard bales collected, ' + n); logEvent(t.driver + ' took ' + n + ' bale' + (n > 1 ? 's' : '') + ' of cardboard: ' + money(n * BALE_PRICE), 'good'); screenDirtyAll(); }
    /* 12-machines.js */
    var FILM_ROLL = 20, FILM_PRICE = 30;
    /* 12-machines.js */
    function wrapperStatus() { if (!powered()) return 'off'; if (!S.wrap || S.wrap.film <= 0) return 'jam'; return wrapperBusy() ? 'run' : 'idle'; }
    /* 12-machines.js */
    function wrapperScreenDraw(c, sc) { var W2 = S.wrap; scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'STRETCH WRAP', wrapperStatus() === 'jam' ? 'NO FILM' : wrapperStatus().toUpperCase()); scText(c, 16, 70, wrapperBusy() ? 'Wrapping… ' + Math.ceil(wrapper.t) + ' s' : 'Bring a pallet on the jack', '#eef1f5', 14); scText(c, 16, 92, 'Film left: ' + W2.film + ' pallets · wrapped ' + W2.wrapped, W2.film > 3 ? '#a0acb8' : '#ff6b5e', 12); speedButton(sc, 172, 111, 56, 'wrapper'); scButton(sc, 16, 110, 150, 32, 'NEW ROLL $' + FILM_PRICE, W2.film < FILM_ROLL && S.bank >= FILM_PRICE, function () { if (S.bank < FILM_PRICE) { sfx('bad'); return; } pay(-FILM_PRICE, 'Stretch film roll'); W2.film = FILM_ROLL; sfx('click'); toast('New film roll fitted', 'good'); }); }
    /* 12-machines2-automation.js */
    function dockLoaderStatus(door) { if (!powered()) return 'off'; var t = truckAtDoor(door), lid = null; for (var k in LOADER_DOORS) if (LOADER_DOORS[k] === door) lid = k; return t && S.doors[door] && lid && stageOf(lid).length ? 'run' : 'idle'; }
    /* 12-machines2-automation.js */
    function dockLoaderPrompt(door) { var t = truckAtDoor(door); return 'Dock loader ' + dockLabel(door) + ' · ' + (!powered() ? 'no power' : t && S.doors[door] ? 'loading, ' + t.parcels.length + ' aboard' : t ? 'open the door and it loads' : 'waiting for a truck at ' + dockLabel(door)) + ' · ' + (S.stats.autoLoaded || 0) + ' loaded by machine so far'; }
    /* 12-machines2-automation.js */
    function agvState() { if (!S.agv) S.agv = { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false }; return S.agv; }
    /* 12-machines2-automation.js */
    function agvDockWorld() { return propInst.agvDock ? propWorld('agvDock', 0, 0) : null; }
    /* 12-machines2-automation.js */
    function agvGo(to, state) { var A = agvState(); A.path = route({ x: A.x, z: A.z }, to); A.state = state; }
    /* 12-machines2-automation.js */
    var agvScreen = null, agvShown = '';
    /* 12-machines2-automation.js */
    function agvScreenDraw(c, sc) {
        var A = agvState(), st = !powered() ? 'off' : A.paused && A.state === 'idle' ? 'paused' : A.state === 'idle' ? 'ready' : 'running', tp = A.pallet ? palletById(A.pallet) : null;
        scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'AGV-1', st.toUpperCase());
        scText(c, 16, 70, A.state === 'idle' ? (A.paused ? 'Held at the dock' : 'Watching the pickup square') : A.state === 'toPickup' ? 'Fetching a pallet' : A.state === 'toSlot' ? 'Putting away' + (A.key ? ' to ' + slotName(A.key) : '') : 'Returning to the dock', '#eef1f5', 16);
        scText(c, 16, 94, tp ? 'Load: ' + tp.n + ' × ' + skuName(tp.sku) : 'Forks empty', '#a0acb8', 13);
        scText(c, 16, 118, 'Put away: ' + (S.stats.agvPutaway || 0) + ' pallets · at ' + A.x.toFixed(1) + ', ' + A.z.toFixed(1), '#a0acb8', 13);
        scText(c, 16, 136, 'Pickup: set a pallet on the square, or let the palletiser drop one', '#6b7784', 11);
        speedButton(sc, 208, 152, 76, 'agv');
        scButton(sc, 16, 150, 80, 34, A.paused ? 'RESUME' : 'PAUSE', !A.paused, function () { A.paused = !A.paused; toast('AGV-1 ' + (A.paused ? 'will hold at the dock after this run' : 'running'), A.paused ? 'bad' : 'good'); }, A.paused ? '#5fd38d' : '#f5b53d');
        scButton(sc, 102, 150, 100, 34, 'DROP LOAD', !!tp, function () { var q = A.pallet ? palletById(A.pallet) : null; if (!q) return; q.place = 'floor'; q.x = A.x + Math.sin(A.yaw) * 1.0; q.z = A.z + Math.cos(A.yaw) * 1.0; q.y = 0; q.rot = A.yaw; A.pallet = null; A.key = null; A.skip = q.id; A.skipT = worldTime + 30; var dk = agvDockWorld(); if (dk) agvGo(dk, 'return'); sfx('putdown'); toast('AGV-1 set its pallet down', ''); }, '#ff6b5e');
      }
    /* 12-machines2-automation.js */
    function agvPrompt() { var A = agvState(); return 'AGV-1 · ' + (!powered() ? 'no power' : A.state === 'idle' ? 'waiting at its dock' : A.state === 'toPickup' ? 'fetching a pallet' : A.state === 'toSlot' ? 'putting a pallet away' : 'returning') + ' · ' + (S.stats.agvPutaway || 0) + ' pallets put away'; }
    /* 12-machines3-gantry.js */
    var GANTRY_SPEED = 3.0, GANTRY_LIFT = 2.0, GANTRY_DROP_X = 46.0;
    /* 12-machines3-gantry.js */
    function gantryBeltFor(r) { return r >= UPPER.row ? 'upperPick' : r >= 3 ? 'pickBelt2' : 'pickBelt'; }
    /* 12-machines3-gantry.js */
    function gantryTop(r) { return r >= UPPER.row ? 3.0 : 5.0; }
    /* 12-machines3-gantry.js */
    function gantryRows() { var out = []; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows && propInst['gantry' + r]) out.push(r); if (S.up.upper && propInst.gantry5) out.push(UPPER.row); return out; }
    /* 12-machines3-gantry.js */
    function gantryState(r) { r = r || 0; if (!S.gantries) S.gantries = {}; if (!S.gantries[r]) S.gantries[r] = { x: GANTRY_DROP_X, lift: 5.0, state: 'idle', sku: null, key: null, t: 0, picked: 0 }; return S.gantries[r]; }
    /* 12-machines3-gantry.js */
    function gantryRowStock(r) { var n = 0, slots = 0; for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === r && s && s.n > 0) { n += s.n; slots++; } } return { n: n, slots: slots }; }
    /* 12-machines3-gantry.js */
    function gantryScreenDraw(r) { return function (c, sc) {
        var G = gantryState(r), st = !powered() ? 'off' : G.paused && G.state === 'idle' ? 'paused' : G.state === 'idle' ? 'ready' : 'running';
        scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GANTRY ' + rowLetter(r), st.toUpperCase());
        var rs = gantryRowStock(r), pos = G.state === 'idle' ? 'parked at the belt' : G.state === 'toBay' ? 'running to bay ' + (Math.round(G.bayX / RACK.bayW - 0.5) + 1) : G.state === 'down' || G.state === 'up' ? 'at the rack' : G.state === 'toDrop' ? 'running to the belt' : 'setting down';
        scText(c, 16, 70, G.sku ? 'Picking ' + skuName(G.sku) : G.paused ? 'Held: finishing nothing' : 'Watching the orders', '#eef1f5', 16);
        scText(c, 16, 94, pos + ' · trolley ' + G.x.toFixed(1) + ' m · hook ' + G.lift.toFixed(1) + ' m', '#a0acb8', 13);
        scText(c, 16, 118, 'Row ' + rowLetter(r) + ': ' + rs.n + ' boxes in ' + rs.slots + ' slots · picked ' + G.picked, '#a0acb8', 13);
        scText(c, 16, 136, 'Belt ' + beltItems(gantryBeltFor(r)).length + ' · bench ' + benchCount() + '/' + benchCapNow(), '#a0acb8', 13);
        speedButton(sc, 208, 152, 76, 'gantry' + r); scText(c, 212, 148, 'crane', '#6b7784', 9); speedButton(sc, 208, 116, 76, 'pickBelt'); scText(c, 212, 112, 'pick belt', '#6b7784', 9);
        scButton(sc, 16, 150, 80, 34, G.paused ? 'RESUME' : 'PAUSE', !G.paused, function () { G.paused = !G.paused; toast('Gantry ' + rowLetter(r) + (G.paused ? ' will hold after this pick' : ' running'), G.paused ? 'bad' : 'good'); }, G.paused ? '#5fd38d' : '#f5b53d');
        scButton(sc, 102, 150, 100, 34, 'RESET JOB', G.state !== 'idle', function () { if (G.state === 'idle') return; if (G.sku && /^(up|toDrop|lower|drop)$/.test(G.state)) { var back = G.key && slotSpace(G.key, G.sku) > 0 ? G.key : findSlotFor(G.sku, 1, 2); if (back) slotAdd(back, G.sku, 1); else S.floor.push({ kind: 'box', sku: G.sku, x: RACK.x0 + G.x, y: 0, z: RACK.rows[r] + 1.2, rot: 0 }); } G.sku = null; G.key = null; G.state = 'up'; sfx('hydraulic'); toast('Gantry ' + rowLetter(r) + ' dropped its job and is coming home', 'good'); }, '#ff6b5e');
      }; }
    /* 12-machines3-gantry.js */
    function gantryPrompt(r) { var G = gantryState(r); return 'Gantry picker ' + rowLetter(r) + ' · ' + (!powered() ? 'no power' : G.state === 'idle' ? 'watching the orders' : G.sku ? 'picking ' + skuName(G.sku) : 'working') + ' · ' + G.picked + ' boxes picked'; }
    /* 12-machines3-gantry.js */
    function buildGantries() { if (!S.up.gantry) return; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows) buildProp('gantry' + r); buildProp('pickBelt'); buildProp('pickMerge'); if (S.up.upper) { buildProp('gantry5'); buildProp('upperPick'); } if (S.up.rows > 3) buildProp('pickBelt2'); }
    /* 12-machines5-upper.js */
    var UPPER = { y: 4.6, z0: -HALL.z + 0.3, z1: -13.5, rowZ: -19.0, row: 5, levels: 2, rise: 8,
        lift: { x: -31.0, z: -15.5 }, shaft: { x0: -32.2, x1: -29.8, z0: -16.7, z1: -14.3 },   // on the deck's south edge by IN 1, east of the first jack's bay at (-33.8, -18); the north-west corner is the break room
        stair: { x0: -25.6, x1: -16.0, z0: -23.4, z1: -21.8 }, well: { x0: -25.6, x1: -20.8 } };
    /* 12-machines5-upper.js */
    function upperOwned() { return !!(S.up && S.up.upper); }
    /* 12-machines5-upper.js */
    function upperRowsOwned() { return upperOwned() ? 1 : 0; }
    /* 12-machines5-upper.js */
    function upperSlotFor(sku, n) {
        for (var pass = 0; pass < 2; pass++) for (var r = UPPER.row; r < UPPER.row + upperRowsOwned(); r++) for (var l = 0; l < UPPER.levels; l++) for (var b = 0; b < RACK.bays; b++) {
          var k = slotKey(r, b, l), s = S.slots[k];
          if (pass === 0 ? (s && s.n > 0 && s.sku === sku && slotSpace(k, sku) >= n) : ((!s || !s.n) && slotSpace(k, sku) >= n)) return k;
        }
        return null;
      }
    /* 12-machines5-upper.js */
    function raiseToDeck(ctx, P, inst) { inst.g.position.y = UPPER.y; for (var i = 0; i < solids.length; i++) if (solids[i].prop === inst.id) { solids[i].y0 += UPPER.y; solids[i].y1 += UPPER.y; } }
    /* 12-machines5-upper.js */
    var liftM = null, liftScreen = null, liftShown = '';
    /* 12-machines5-upper.js */
    function liftState() { if (!S.lift) S.lift = { pallet: null, pos: 0, state: 'down' }; return S.lift; }
    /* 12-machines5-upper.js */
    function liftPrompt() {
        var L = liftState(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
        if (!powered()) return 'Goods lift · no power';
        if (L.state !== 'down') return 'Goods lift · ' + (L.state === 'rising' ? 'going up' : L.state === 'up' ? 'unloading upstairs' : 'coming down');
        if (jp && !lp) return jp.n <= 0 ? 'An empty pallet has no business upstairs' : SKU[jp.sku] && SKU[jp.sku].raw ? 'Granulate goes to the hopper, not upstairs' : !upperSlotFor(jp.sku, jp.n) ? 'No room on the upper row for this pallet' : 'Set the pallet in the lift (it goes up by itself)';
        if (lp && !jp && isJack(player.tool)) return 'Take the pallet back out of the lift';
        return lp ? 'Goods lift · pallet of ' + lp.n + ' × ' + skuName(lp.sku) + (L.hold ? ' held at the floor' : ' about to go up') : 'Goods lift · empty, at the floor';
      }
    /* 12-machines5-upper.js */
    function liftUse() {
        var L = liftState(), jt = jackTool(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
        if (!powered() || L.state !== 'down') { sfx('bad'); return; }
        if (jp && !lp) { if (jp.n <= 0 || (SKU[jp.sku] && SKU[jp.sku].raw) || !upperSlotFor(jp.sku, jp.n)) { toast(jp.n <= 0 ? 'An empty pallet has no business upstairs.' : SKU[jp.sku] && SKU[jp.sku].raw ? 'Granulate goes to the hopper, not upstairs.' : 'No room on the upper row for this pallet.', 'bad'); sfx('bad'); return; } jp.place = 'lift'; S[jt].pallet = null; L.pallet = jp.id; L.wait = 1.5; sfx('crate'); toast('Pallet in the lift · it goes up by itself', 'good'); return; }
        if (lp && !jp && isJack(player.tool)) { lp.place = 'jack'; lp.jack = jt; S[jt].pallet = lp.id; L.pallet = null; sfx('jack'); return; }
        sfx('click');
      }
    /* 12-machines5-upper.js */
    function liftScreenDraw(c, sc) {
        var L = liftState(), p = L.pallet ? palletById(L.pallet) : null, st = !powered() ? 'off' : L.state === 'down' ? (p ? (L.hold ? 'held' : 'loaded') : 'ready') : L.state;
        scBg(c, sc.w, sc.h, st === 'rising' || st === 'lowering' || st === 'up' ? 'rgba(95,211,141,0.18)' : st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GOODS LIFT', st.toUpperCase());
        scText(c, 12, 62, p ? 'Pallet: ' + p.n + ' × ' + skuName(p.sku) : 'Platform empty', '#eef1f5', 14);
        scText(c, 12, 84, L.state === 'down' ? (p ? (L.hold ? 'Held at the floor' : 'Going up in a moment') : 'At the floor · a jack or the forklift sets a pallet in') : L.state === 'rising' ? 'Going up · ' + Math.round(L.pos * 100) + '%' : L.state === 'up' ? 'Upstairs · rolling it onto the feed belt' : 'Coming down · ' + Math.round((1 - L.pos) * 100) + '%', '#a0acb8', 11);
        scText(c, 12, 104, 'Lifted so far: ' + (S.stats.lifted || 0) + ' pallets · upstairs racked ' + (S.stats.upperIn || 0), '#a0acb8', 11);
        scButton(sc, 12, 122, 100, 30, 'SEND NOW', L.state === 'down' && !!p, function () { if (L.state === 'down' && p) { L.hold = false; L.state = 'rising'; sfx('hydraulic'); } }, '#5fd38d');
        scButton(sc, 124, 122, 100, 30, L.hold ? 'RELEASE' : 'HOLD', true, function () { L.hold = !L.hold; }, L.hold ? '#5fd38d' : '#f5b53d');
      }
    /* 12-machines5-upper.js */
    function liftBuild(c) {
        var FR = MAT_MACH.frame;
        // four posts and cross members, mesh guards on three sides, a gate bar across the open east side at the floor
        [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(function (p) { c.box(0.12, 5.6, 0.12, FR, p[0], 2.8, p[1]); c.box(0.3, 0.03, 0.3, FR, p[0], 0.015, p[1]); });
        [2.6, 5.5].forEach(function (y) { c.box(2.52, 0.1, 0.1, FR, 0, y, -1.2); c.box(2.52, 0.1, 0.1, FR, 0, y, 1.2); c.box(0.1, 0.1, 2.52, FR, -1.2, y, 0); if (y > 5) c.box(0.1, 0.1, 2.52, FR, 1.2, y, 0); });
        c.plane(2.4, 5.4, MAT.mesh, -1.19, 2.8, 0, 0, Math.PI / 2); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, -1.19, 0, 0); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, 1.19, 0, Math.PI);
        c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 1.0, 0); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 0.5, 0);
        c.solid(-1.3, -1.1, -1.3, 1.3, 0, 5.6); c.solid(-1.3, 1.3, -1.3, -1.1, 0, 5.6); c.solid(-1.3, 1.3, 1.1, 1.3, 0, 5.6); c.solid(1.1, 1.3, -1.1, 1.1, 0, 1.3); c.solid(1.1, 1.3, -1.1, 1.1, UPPER.y, UPPER.y + 1.1); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, UPPER.y + 1.0, 0);
        // the platform: a plate on powered rollers, hazard-striped edges; it rides up to the deck
        var plat = new THREE.Group(); plat.userData.dynamic = true; c.add(plat); liftM = plat;
        box(2.2, 0.12, 2.2, MAT.steelDark, 0, 0.06, 0, plat); for (var rz = -0.8; rz <= 0.81; rz += 0.4) cyl(0.03, 2.0, MAT_MACH.roller, 0, 0.15, rz, plat, 8).rotation.z = Math.PI / 2;
        box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, -1.08, plat); box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, 1.08, plat); box(0.04, 0.04, 2.2, MAT.hazard, -1.08, 0.14, 0, plat);
        cyl(0.06, 5.6, FR, -1.0, 2.8, 0, c.group, 10); cyl(0.06, 5.6, FR, 1.0, 2.8, 0, c.group, 10);   // the guide rails the platform rides
        // the console on the south post, facing the hall side you walk up from; a lamp at the top
        cabinet(c, 0.9, 1.45, 1.21, 0.4, 0.6, 0.22); liftScreen = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.9, y: 1.5, z: 1.335, ry: 0, parent: c.group, title: 'Goods lift', draw: liftScreenDraw }); liftScreen.mesh.userData.propId = 'lift';
        c.box(0.06, 0.06, 0.06, glowMat(0xff3b2f, 1.5), 1.2, 5.3, 0);
        c.sign(['GOODS LIFT', 'pallets only · goes up by itself'], 1.2, 0.3, 1.22, 2.2, 0, Math.PI / 2, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
        c.hit(2.8, 2.6, 2.8, 0, 1.3, 0, { prompt: function () { return liftPrompt(); }, use: function () { liftUse(); } });
      }
    /* 12-machines5-upper.js */
    function railRun(c, a0, a1, at, axis, y, gaps) {
        if (gaps && gaps.length) { var cuts = gaps.slice().sort(function (p, q) { return p[0] - q[0]; }), s0 = a0; cuts.forEach(function (g) { if (g[0] > s0) railRun(c, s0, Math.min(g[0], a1), at, axis, y); s0 = Math.max(s0, g[1]); }); if (s0 < a1) railRun(c, s0, a1, at, axis, y); return; }   // gaps: where a belt crosses the rail
        var len = a1 - a0, mid = (a0 + a1) / 2; if (len < 0.3) return;
        for (var p = a0 + 0.2; p <= a1 - 0.1; p += 1.5) { if (axis === 'x') c.cyl(0.025, 1.1, MAT.chrome, p, y + 0.55, at, 8); else c.cyl(0.025, 1.1, MAT.chrome, at, y + 0.55, p, 8); }
        [0.55, 1.1].forEach(function (ry) { if (axis === 'x') c.box(len, 0.04, 0.04, MAT.chrome, mid, y + ry, at); else c.box(0.04, 0.04, len, MAT.chrome, at, y + ry, mid); });
        if (axis === 'x') { c.box(len, 0.12, 0.03, MAT.yellow, mid, y + 0.06, at); c.solid(a0, a1, at - 0.12, at + 0.12, y, y + 1.3); } else { c.box(0.03, 0.12, len, MAT.yellow, at, y + 0.06, mid); c.solid(at - 0.12, at + 0.12, a0, a1, y, y + 1.3); }
      }
    /* 12-machines5-upper.js */
    function mezzBuild(c) {
        var DK = std({ color: 0x5c656f, roughness: 0.55, metalness: 0.55 }), FR = MAT_MACH.frame, Y = UPPER.y, X = HALL.x - 0.2, z0 = UPPER.z0, z1 = UPPER.z1, sh = UPPER.shaft, stw = UPPER.stair, well = UPPER.well;
        for (var ex = -X + 0.6; ex < X - 0.6; ex += 1.6) c.plane(1.0, 0.1, MAT.yellowLine, ex + 0.5, 0.0064, z1 + 0.15, -Math.PI / 2, 0);   // the deck's edge on the ground: a dashed line along its south face
        var plate = function (x0, x1, za, zb) { if (x1 - x0 < 0.05 || zb - za < 0.05) return; c.box(x1 - x0, 0.12, zb - za, DK, (x0 + x1) / 2, Y - 0.06, (za + zb) / 2); };
        // plates: the deck rectangle in z bands at every hole edge, each band laid in x around the holes open in it (the shaft, the stairwell)
        var holes = [{ x0: sh.x0, x1: sh.x1, z0: sh.z0, z1: sh.z1 }, { x0: well.x0, x1: well.x1, z0: stw.z0, z1: stw.z1 }].concat(sorterHoles()), zs = [z0, z1]; holes.forEach(function (h) { zs.push(h.z0, h.z1); }); zs = zs.filter(function (v) { return v >= z0 && v <= z1; }).sort(function (p, q) { return p - q; });
        for (var bi = 0; bi + 1 < zs.length; bi++) { var za = zs[bi], zb = zs[bi + 1]; if (zb - za < 0.05) continue; var zm = (za + zb) / 2, xs = [-X, X]; holes.forEach(function (h) { if (zm > h.z0 && zm < h.z1) xs.push(h.x0, h.x1); }); xs.sort(function (p, q) { return p - q; }); for (var xi = 0; xi + 1 < xs.length; xi++) { var xm = (xs[xi] + xs[xi + 1]) / 2, inHole = holes.some(function (h) { return zm > h.z0 && zm < h.z1 && xm > h.x0 && xm < h.x1; }); if (!inHole) plate(xs[xi], xs[xi + 1], za, zb); } }
        // the edge beam, the south railing, and the railings round the stairwell
        c.box(2 * X, 0.4, 0.2, FR, 0, Y - 0.32, z1 + 0.1);
        railRun(c, -X, X, z1 - 0.12, 'x', Y, sorterEdgeGaps()); sorterWellRails(c); railRun(c, well.x0, well.x1, stw.z1 + 0.12, 'x', Y); railRun(c, stw.z0, stw.z1 + 0.24, well.x1 + 0.12, 'z', Y);
        // columns under the south edge every twelve metres, bump guards at the foot
        for (var cx = -24; cx <= 30; cx += 12) { c.box(0.35, Y - 0.12, 0.35, FR, cx, (Y - 0.12) / 2, z1 - 0.35); c.box(0.5, 0.5, 0.5, MAT.hazard, cx, 0.25, z1 - 0.35); c.solid(cx - 0.25, cx + 0.25, z1 - 0.6, z1 - 0.1, 0, Y); }
        // lamps under the deck, so the receiving strip is not a cave; a few on the deck
        [-24, 0, 24].forEach(function (lx) { var pl = new THREE.PointLight(0xfff0d0, 0.55, 11, 2); pl.position.set(lx, Y - 0.4, (z0 + z1) / 2); c.add(pl); c.box(0.5, 0.08, 0.5, MAT.lamp, lx, Y - 0.16, (z0 + z1) / 2); });
        // the stair: treads along the north wall rising westward, risers, two stringers, a handrail on the open side
        var n = 24, run = (stw.x1 - stw.x0) / n, rise = Y / n, zc = (stw.z0 + stw.z1) / 2, w = stw.z1 - stw.z0;
        for (var i = 0; i < n; i++) { var tx = stw.x1 - (i + 0.5) * run, ty = (i + 1) * rise; c.box(run, 0.06, w - 0.1, DK, tx, ty - 0.03, zc); c.box(0.04, rise, w - 0.1, FR, tx + run / 2 - 0.02, ty - rise / 2 - 0.03, zc); }
        var ang = Math.atan2(Y, stw.x1 - stw.x0), len = Math.hypot(Y, stw.x1 - stw.x0), mx = (stw.x0 + stw.x1) / 2;
        [stw.z0 + 0.05, stw.z1 - 0.05].forEach(function (sz) { c.box(len, 0.28, 0.06, FR, mx, Y / 2 - 0.08, sz).rotation.z = -ang; });
        c.box(len, 0.04, 0.04, MAT.chrome, mx, Y / 2 + 0.95, stw.z1 + 0.06).rotation.z = -ang;
        for (var hp = 1; hp < n; hp += 4) c.cyl(0.018, 0.95, MAT.chrome, stw.x1 - (hp + 0.5) * run, (hp + 1) * rise + 0.47, stw.z1 + 0.06, 6);
        c.solid(stw.x0, stw.x1, stw.z0, stw.z1, -3, -0.5);   // below the floor: the crew's grid sees it and routes round the stair, you never meet it
        c.solid(stw.x0, stw.x1 + 0.3, stw.z1, stw.z1 + 0.25, 0, Y + 1.0);   // the open side of the stair is railed from the floor up
        c.solid(-X, X, z0 - 0.4, z0, Y, Y + 3);   // the north wall at deck height
        c.sign(['MEZZANINE', 'stair · pallets go by the goods lift'], 1.4, 0.4, stw.x1 + 0.9, 2.2, stw.z1 + 0.14, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#f5b53d' });
      }
    /* 12-machines5-upper.js */
    function upperRackBuild(c) {
        var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, H = 3.2, r = UPPER.row;
        for (var b = 0; b <= RACK.bays; b++) {
          var ux = x0 + b * bw;
          [-dz, dz].forEach(function (oz) { c.box(0.1, H, 0.1, MAT.rack, ux, H / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < H - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
          for (var br = 0; br < 3; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
        }
        var y = RACK.levels[1];
        c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, -dz); c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, dz);
        for (var bp = 0; bp <= RACK.bays; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
        for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; }
        for (var bb = 0; bb < RACK.bays; bb++) {
          var cx = x0 + (bb + 0.5) * bw, lbl = 'U' + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#5fd38d' });
          var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
          [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, H - 0.3, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
          for (var ll = 0; ll < UPPER.levels; ll++) (function (b2, l2) { var key = slotKey(r, b2, l2); slotHits[key] = c.hit(bw - 0.2, 1.45, RACK.depth, cx, RACK.levels[l2] + 0.725, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } }); })(bb, ll);
        }
        c.solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, H);
        [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + RACK.bays * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.sign(['UPPER ROW', 'automatic', 'keep clear'], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 26 }); });
      }
    /* 12-machines5-upper.js */
    function buildUpper() { ['mezz', 'lift', 'rack5', 'gantry5', 'upperFeed', 'upperPick', 'upperChute'].forEach(function (id) { buildProp(id); }); if (S.up.sorter) buildSorter(); else { beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } } }
    /* 12-machines6-sorter.js */
    var SORT = {
        spineZ: -20.7, spineX0: 25.2, spineX1: -12.4,          // the spine: west along the upper row's north face
        collZ: -23.2, collX0: -7.0, collX1: 29.0, collX: 29.4, // the collector: east along the north wall, then south along x 29.4 past the well and over the deck edge, down the east lane
        cells: [{ mode: 'sea', x: 16.0 }, { mode: 'land', x: 6.0 }, { mode: 'air', x: -4.0 }], cellZ: -21.72, liftX: 1.25, liftT: 2.4,   // liftX: the parcel lift beside each cell (local x); liftT: seconds up to the collector   // against the spine, so the corridor along the wall stays 1.3 m clear
        table: { x: -13.4, z: -20.7 }, inX: 25.5, scanZ: -19.4, up: 2.0,                                         // up: how high the overhead runs ride above the deck
        walk: [{ id: 'walk1', x: 22.0, z: -17.2, rot: 0 }, { id: 'walk2', x: 23.35, z: -20.7, rot: 1 }],         // step-overs: over the upper pick belt, over the spine's east end
        well: { x0: 31.0, x1: 33.4, z0: -20.5, z1: -18.1 },    // the spiral well through the deck, railed: the air spiral comes down here
        spiral: { sea: { x: 31.6, z: -11.1 }, air: { x: 32.2, z: -19.3 }, land: { x: 30.4, z: -3.2 }, up: { x: 30.6, z: 14.3 }, r: 1.0 },   // sea: in the OUT 1 apron, south of the deck edge; air: through the well; land: by OUT 2
        gates: { air: -19.3, sea: -13.9 },                      // where on the collector's south run the gates kick east (the sea gate at the deck's last row, its bridge runs out over the edge)
        jack2: { x: 27.0, z: -23.0 },                           // jack 2's bay moves out from under the spirals to the north wall
        cellTime: { sea: 7, land: 4, air: 5 }
      };
    /* 12-machines6-sorter.js */
    var LOADER_DOORS = { dockLoader1: 2, dockLoader2: BOOT_STAGE < 2 ? 2 : 3, dockLoader3: 4 };
    /* 12-machines6-sorter.js */
    function sorterOwned() { return !!(S.up && S.up.sorter && S.up.upper); }
    /* 12-machines6-sorter.js */
    function sortState() { if (!S.sort) S.sort = { cells: {}, table: [], scanned: 0, sorted: 0, count: { sea: 0, land: 0, air: 0 }, last: null, tableT: 0 }; var Z = S.sort; SORT.cells.forEach(function (c) { if (!Z.cells[c.mode]) Z.cells[c.mode] = { q: [], t: 0, made: 0 }; }); if (!Z.count) Z.count = { sea: 0, land: 0, air: 0 }; return Z; }
    /* 12-machines6-sorter.js */
    var Y = UPPER.y, R = SORT.spiral.r;
    /* 12-machines6-sorter.js */
    function orderMode(o) { if (!o) return 'land'; if (o.mode && MODES[o.mode]) return o.mode; return clientMode(o.client); }
    /* 12-machines6-sorter.js */
    function clientMode(cid) { var c = CLIENTS.filter(function (x) { return x.id === cid; })[0], m = c && c.mode || 'land'; if (m === 'air' && !sorterOwned()) m = 'land'; return m; }
    /* 12-machines6-sorter.js */
    var sortD = null;
    /* 12-machines6-sorter.js */
    var STAGE_CAP = 9, BAY = { x0: HALL.x - 2.6, len: 1.8, lanes: 3, deep: 3, pitch: 0.62, step: 0.6, h: 0.55, at: { dockLoader1: { prop: 'bay1', z0: -12.1 }, dockLoader2: { prop: 'bay2', z0: (BOOT_STAGE < 2 && DOCKS.out[0] ? DOCKS.out[0].z : -6) + 1.9 }, dockLoader3: { prop: 'bay3', z0: -19.56 } } }, STAGE_AT = BAY.at, stageT = {};
    /* 12-machines6-sorter.js */
    function stageOf(id) { if (!S.stage) S.stage = {}; if (!S.stage[id]) S.stage[id] = []; return S.stage[id]; }
    /* 12-machines6-sorter.js */
    function stagePush(id, oid) { var st = stageOf(id); if (st.length >= STAGE_CAP || st.indexOf(oid) >= 0) return false; st.push(oid); return true; }
    /* 12-machines6-sorter.js */
    function bayBuild(id) { return function (c) {
        var DG = MAT_MACH.frame, L = BAY.len, W = BAY.lanes * BAY.pitch, lane = MODES[TRUCK_OUT[LOADER_DOORS[id] - 2].mode], LC = new THREE.Color(lane.col), PM = std({ color: LC, roughness: 0.5, metalness: 0.3 });
        [[0.05, 0.05], [L - 0.05, 0.05], [0.05, W - 0.05], [L - 0.05, W - 0.05]].forEach(function (p) { c.box(0.08, BAY.h + 0.5, 0.08, DG, p[0], (BAY.h + 0.5) / 2, p[1]); c.box(0.16, 0.02, 0.16, DG, p[0], 0.01, p[1]); });
        c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, 0.03); c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, W - 0.03); c.box(0.05, 0.05, W, DG, 0.03, BAY.h - 0.1, W / 2); c.box(0.05, 0.05, W, DG, L - 0.03, BAY.h - 0.1, W / 2);
        for (var k = 0; k < BAY.lanes; k++) { var lz = 0.31 + k * BAY.pitch; var bed = c.box(L - 0.1, 0.03, 0.5, MAT_MACH.roller, L / 2, BAY.h - 0.03, lz); bed.rotation.z = -0.04; for (var rx = 0.15; rx < L - 0.1; rx += 0.15) { var sk = c.cyl(0.03, 0.46, MAT.chrome, rx, BAY.h - 0.02 + (L / 2 - rx) * 0.04, lz, 8); sk.rotation.x = Math.PI / 2; } c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz - 0.3); c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz + 0.3); c.box(0.04, 0.2, 0.46, PM, L - 0.06, BAY.h + 0.06, lz); }
        c.box(0.06, 0.5, W, DG, L + 0.02, BAY.h + 0.7, W / 2); c.sign([lane.name.toUpperCase() + ' SHIPPING BAY', dockLabel(LOADER_DOORS[id]) + ' · ' + lane.haulier], W - 0.1, 0.42, L + 0.06, BAY.h + 0.7, W / 2, -Math.PI / 2, { w: 640, h: 128, bg: '#1b232c', fg: lane.col });
        c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, -0.3, -Math.PI / 2, 0); c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, W + 0.3, -Math.PI / 2, 0); c.plane(0.1, W + 0.7, MAT.yellowLine, -0.35, 0.006, W / 2, -Math.PI / 2, 0);
        var lbl = new THREE.MeshBasicMaterial({ map: textTex(['BAY ' + (LOADER_DOORS[id] - 1) + ' · ' + lane.name.toUpperCase()], { w: 512, h: 128, bg: '#3b3d40', fg: lane.col }) }); c.plane(1.6, 0.4, lbl, L / 2, 0.0066, -0.7, -Math.PI / 2, 0);
        MACH['bay' + (LOADER_DOORS[id] - 1)].lamps = lampStack(c, L + 0.02, BAY.h + 1.0, W - 0.1);
        c.hit(0.3, 1.6, W + 0.2, L + 0.1, 0.8, W / 2, { prompt: function () { var n = stageOf(id).length, t = truckAtDoor(LOADER_DOORS[id]); return lane.name + ' shipping bay ' + dockLabel(LOADER_DOORS[id]) + ' · ' + n + ' of ' + STAGE_CAP + ' parcels' + (t && S.doors[LOADER_DOORS[id]] ? ' · the loader is taking them aboard' : ' · waiting for the ' + lane.name.toLowerCase() + ' truck'); }, use: function () { sfx('click'); } });
        c.solid(-0.05, L + 0.1, -0.05, W + 0.05, 0, 1.1);
      }; }
    /* 12-machines6-sorter.js */
    function deckNightRun() {
        if (!S.up.deckNight || !sorterOwned() || !propInst.spine || S.events.power) return 0;
        // seen: already past the scanner; done: already counted out of its cell. Neither is counted twice.
        var Z = sortState(), list = [], n = { sea: 0, land: 0, air: 0 }, take = function (oid, seen, done) { var o = orderById(oid); if (o) list.push({ o: o, seen: !!seen, done: !!done }); };
        S.bench.parcels.splice(0).forEach(function (oid) { take(oid, false, false); });
        ['sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellOutsea', 'cellOutland', 'cellOutair'].forEach(function (b) { if (!BELTS[b]) return; var items = beltItems(b); for (var i = items.length - 1; i >= 0; i--) if (items[i].kind === 'parcel') { if (items[i].order) take(items[i].order, b !== 'sortUp', b !== 'sortUp' && b !== 'spine'); items.splice(i, 1); } });
        SORT.cells.forEach(function (cd) { Z.cells[cd.mode].q.splice(0).forEach(function (j) { if (j.order) take(j.order, true, false); }); }); Z.table.splice(0).forEach(function (it) { if (it.order) take(it.order, true, false); });
        var left = [];
        list.forEach(function (e) { var o = e.o, m = orderMode(o), id = { sea: 'dockLoader1', land: 'dockLoader2', air: 'dockLoader3' }[m]; o.form = MODES[m].form; if (stagePush(id, o.id)) { n[m]++; if (!e.seen) Z.scanned++; if (!e.done) { Z.sorted++; Z.count[m] = (Z.count[m] || 0) + 1; S.stats.sorted = (S.stats.sorted || 0) + 1; } } else left.push(o); });
        left.forEach(function (o) { if (S.bench.parcels.length < 12) S.bench.parcels.push(o.id); else S.floor.push({ kind: 'parcel', order: o.id, x: 31.2 + Math.random() * 0.8, y: 0, z: 16.4 + Math.random() * 0.8, rot: 0 }); });
        var tot = n.sea + n.land + n.air; if (tot) logEvent('Night shift on the deck: ' + tot + ' parcel' + (tot > 1 ? 's' : '') + ' sorted and waiting in the shipping bays (sea ' + n.sea + ', land ' + n.land + ', air ' + n.air + ')', 'good');
        return tot;
      }
    /* 12-machines6-sorter.js */
    function sorterHoles() { return sorterOwned() ? [{ x0: SORT.well.x0, x1: SORT.well.x1, z0: SORT.well.z0, z1: SORT.well.z1 }] : []; }
    /* 12-machines6-sorter.js */
    function sorterEdgeGaps() { var g = [[22 - 0.7, 22 + 0.7]]; if (sorterOwned()) g.push([SORT.collX - 0.7, 32.3]); return g; }
    /* 12-machines6-sorter.js */
    function sorterWellRails(c) {
        if (!sorterOwned()) return; var w = SORT.well;
        railRun(c, w.x0, w.x1, w.z0 - 0.12, 'x', Y); railRun(c, w.x0, w.x1, w.z1 + 0.12, 'x', Y); railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x1 + 0.12, 'z', Y);
        railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x0 - 0.12, 'z', Y, [[SORT.gates.air - 0.5, SORT.gates.air + 1.4]]);
        c.sign(['SPIRAL WELL', 'keep clear'], 0.9, 0.3, (w.x0 + w.x1) / 2, Y + 1.5, w.z0 - 0.2, Math.PI, { w: 320, h: 100, bg: '#1b232c', fg: '#ff6b5e' });
      }
    /* 12-machines6-sorter.js */
    function sorterSpots() { if (!S.up.sorter) return; var old = { x: SPOT.jack2.x, z: SPOT.jack2.z }; SPOT.jack2 = { x: SORT.jack2.x, z: SORT.jack2.z }; if (S.jack2 && Math.abs(S.jack2.x - old.x) < 3 && Math.abs(S.jack2.z - old.z) < 3) { S.jack2.x = SPOT.jack2.x; S.jack2.z = SPOT.jack2.z; S.jack2.rot = Math.PI; } }
    /* 12-machines6-sorter.js */
    function buildSorter() {
        sorterSpots(); repaintJack2Bay();
        // the shipping belt gives way: its parcels go back on the shelf, or the floor if the shelf is full
        if (propInst.shipBelt) { beltItems('shipBelt').forEach(function (it) { if (it.kind === 'parcel' && it.order) { if (S.bench.parcels.length < 12) S.bench.parcels.push(it.order); else S.floor.push({ kind: 'parcel', order: it.order, x: 31.5, y: 0, z: 16.5, rot: 0 }); } }); beltItems('shipBelt').length = 0; removePropInst('shipBelt'); }
        buildProp('mezz'); buildProp('upperPick');
        ['dockLoader1', 'dockLoader2', 'dockLoader3', 'bay1', 'bay2', 'bay3', 'sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellsea', 'cellland', 'cellair', 'cellOutsea', 'cellOutland', 'cellOutair', 'sortTable', 'scanner', 'gateSea', 'gateAir', 'walk1', 'walk2'].forEach(function (id) { buildProp(id); });
        if (!S.speed) S.speed = {}; if (S.speed.sorter === undefined) S.speed.sorter = 1;
        sortD = null; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } rebuildBoardSoon();
      }
    /* 12-machines7-returns.js */
    var RET = { door: 6, dockZ: -34, beltZ: -35.0, beltX0: 34.6, beltX1: 22.2, intake: { x: 21.0, z: -35.0 }, desks: [{ x: 19.0, z: -38.2 }, { x: 23.4, z: -38.2 }, { x: 27.8, z: -38.2 }], cage: { x: 30.5, z: -43.2 }, compactor: { x: 15.5, z: -43.0 } };
    /* 12-machines7-returns.js */
    var TRUCK_RET = [9.5, 15];
    /* 12-machines7-returns.js */
    var RET_PROPS = ['retBelt', 'retIntake', 'retDesk0', 'retDesk1', 'retDesk2', 'retCage', 'retCompactor', 'retPaint', 'retSign', 'consoleRet'];
    /* 12-machines7-returns.js */
    function doorOwned(i) { var d = DOOR_MAP[i]; if (!d) return false; return d.dir === 'in' ? (d.dock < 2 || !!S.up.hall3) : d.dir === 'ret' ? returnsHall() : dockOwned(d.dock); }
    /* 12-machines7-returns.js */
    function retWhen() { return returnsHall(); }
    /* 12-machines7-returns.js */
    function retFeedWorks(t) { return !!(propInst.retBelt && S.doors[RET.door] && doorPassable(RET.door) && powered() && t && t.state === 'docked'); }
    /* 12-machines7-returns.js */
    function retIntakePrompt() { var D = rdesk(); if (S.hand && S.hand.kind === 'return') return D.queue.length < rdeskCap() ? 'Put the return in the queue (' + D.queue.length + ' waiting)' : 'The queue is full: inspect one first'; if (S.hand || player.tool) return null; return 'Returns intake · ' + D.queue.length + ' waiting · the belt brings them in from the dock · E on an inspection desk inspects the next'; }
    /* 12-machines7-returns.js */
    function retIntakeUse() { if (S.hand && S.hand.kind === 'return') { rdeskUse(0); return; } sfx('click'); }
    /* 12-machines7-returns.js */
    function migrateReturnsHall() {
        var moved = 0, dropped = 0, keys = Object.keys(S.slots || {});
        keys.forEach(function (k) { var r = +k.split(',')[0]; if (r !== 20 && r !== 21) return; var sl = S.slots[k]; delete S.slots[k]; if (!sl || !sl.n) return; var key = findSlotFor(sl.sku, sl.n, 2); if (key && slotSpace(key, sl.sku) >= sl.n) { slotAdd(key, sl.sku, sl.n); if (sl.pal && S.slots[key]) S.slots[key].pal = true; moved += sl.n; } else { var b = +k.split(',')[1]; newPallet(sl.sku, sl.n, { place: 'floor', x: 13.0 + (b % 7) * 3.0, z: r === 20 ? -30.5 : -40.0, y: 0, rot: 0, wrapped: !!sl.wrapped }); dropped += sl.n; } });
        if (S.layout) { delete S.layout.rack20; delete S.layout.rack21; delete S.layout.aislehall2; }
        if (moved || dropped) logEvent('Hall 2 is the returns hall now and its racks are gone: ' + moved + ' boxes moved to other rows' + (dropped ? ', ' + dropped + ' left on pallets on its floor' : ''), '');
      }
    /* 12-player.js */
    var buff = { coffeeUntil: 0, coffeeDay: 0 };
    /* 12-player.js */
    function rebuildDyn() {
        dyn.length = 0;
        S.pallets.forEach(function (p) { if (p.place !== 'floor') return; dyn.push({ x0: p.x - 0.65, x1: p.x + 0.65, z0: p.z - 0.65, z1: p.z + 0.65, y0: (p.y || 0) - 0.1, y1: (p.y || 0) + 0.3 + Math.ceil(p.n / 4) * BOX.h }); });
        S.trucks.forEach(function (t) {
          if (t.state === 'gone') return; var b = trailerBounds(t); if (t.van) { dyn.push({ x0: b.x0 - 1.8, x1: b.x1 + 0.1, z0: b.z0 - 0.1, z1: b.z1 + 0.1, y0: -2, y1: 3 }); return; }   /* the van is one block: nobody walks into it */ var cabX0 = Math.min(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2)), cabX1 = Math.max(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2));
          dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.12, z1: b.z0, y0: -2, y1: 3 }); dyn.push({ x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + 0.12, y0: -2, y1: 3 });
          var fx = t.x + t.side * TRAILER.len; dyn.push({ x0: fx - 0.08, x1: fx + 0.08, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
          dyn.push({ x0: cabX0, x1: cabX1, z0: t.z - 1.3, z1: t.z + 1.3, y0: -2, y1: 3 });
          if (t.state !== 'docked') dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
        });
        doors.forEach(function (d) { if (d.anim < 0.6) dyn.push({ x0: d.side * HALL.x - 0.3, x1: d.side * HALL.x + 0.3, z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, y0: -2, y1: 9 }); });
        doorSolids(dyn);
        if (S.up.fork) dyn.push({ x0: S.fork.x - 1.0, x1: S.fork.x + 1.0, z0: S.fork.z - 1.0, z1: S.fork.z + 1.0, y0: -1, y1: 2.4, skip: 'fork' });
        ['jack', 'jack2'].forEach(function (jt) { if (player.tool !== jt && jackPallet(jt)) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld(jt); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); } });
      }
    /* 13-pc.js */
    var pc = { on: false, app: 'home', scroll: 0, saved: null, look: { yaw: 0, pitch: 0 }, screen: null };
    /* 13-pc.js */
    var PC_APPS = [['home', '🏠', 'Desktop'], ['orders', '📦', 'Orders'], ['contracts', '📝', 'Contracts'], ['shop', '🛒', 'Shop'], ['staff', '👷', 'Staff'], ['bank', '🏦', 'Bank'], ['stock', '🗄', 'Stock'], ['factory', '🏭', 'Production'], ['plant', '⚙', 'Plant'], ['stats', '📊', 'Stats']];
    /* 13-pc.js */
    var APP_LVL = { contracts: 'contracts', bank: 'loan', factory: 'raw', plant: 'scanPlant' };
    /* 13-pc.js */
    function pcApps() { return PC_APPS.filter(function (a) { return !APP_LVL[a[0]] || unlocked(APP_LVL[a[0]]); }); }
    /* 13-pc.js */
    function plantRows() {
        var rows = [], pct = function (key) { return Math.round(speedOf(key) * 100) + '%'; };
        var dialRow = function (name, key) { rows.push({ text: '   ' + name + ' dial', sub: 'tap to step the speed', right: pct(key), key: key, dialOnly: true, btn: { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } }); };
        var add = function (name, status, sub, key, action) { rows.push({ text: name + '  ·  ' + status, sub: sub, right: key ? pct(key) : '', key: key, hi: status === 'run' || status === 'running' || status === 'sorting', btnIsDial: !action && !!key, btn: action || (key ? { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } : null) }); if (action && key) dialRow(name, key); };
        if (propInst.packline) add('Pack line', packStatus(), packPrompt(), 'packline', S.pack.jam ? { label: 'CLEAR JAM', on: true, act: packUse, col: '#ff6b5e' } : S.up.plantAuto ? { label: S.pack.auto === false ? 'AUTO OFF' : 'AUTO ON', on: true, act: function () { S.pack.auto = S.pack.auto === false; sfx('click'); }, col: S.pack.auto === false ? '#f5b53d' : '#5fd38d' } : null);
        var surP = surplusCount(); if (surP) rows.push({ text: 'Bench surplus  ·  ' + surP + ' box' + (surP > 1 ? 'es' : ''), sub: 'boxes no open order wants, on the bench or loose on the floor', hi: true, btn: { label: 'RETURN ALL', on: true, act: function () { returnSurplus(); }, col: '#f5b53d' } });
        if (propInst.moulder) add('Moulding line', factoryStatus(), moulderPrompt(), 'moulder', { label: S.factory.jam ? 'CLEAR JAM' : S.factory.on ? 'STOP' : 'START', on: true, act: moulderUse, col: S.factory.jam ? '#ff6b5e' : S.factory.on ? '#f5b53d' : '#5fd38d' });
        if (propInst.palletiser) add('Palletiser', S.pal.n ? 'run' : 'idle', palletiserPrompt(), 'beltMain', { label: 'EJECT', on: S.pal.n > 0, act: palletiserUse, col: '#f5b53d' });
        if (propInst.baler) add('Baler', balerStatus(), balerPrompt(), 'baler', { label: 'BALE', on: S.baler.card >= BALE_NEED && !S.baler.t, act: balerUse, col: '#f5b53d' });
        if (propInst.wrapper) add('Stretch wrapper', wrapperStatus(), 'film ' + S.wrap.film + ' pallets · wrapped ' + S.wrap.wrapped, 'wrapper', null);
        if (S.up.agv && propInst.agvDock) { var A = agvState(); add('AGV-1', A.paused && A.state === 'idle' ? 'paused' : A.state, agvPrompt(), 'agv', { label: A.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { A.paused = !A.paused; sfx('click'); }, col: A.paused ? '#5fd38d' : '#f5b53d' }); }
        if (S.up.gantry) { gantryRows().forEach(function (r) { var G = gantryState(r); add('Gantry ' + (r >= UPPER.row ? 'upper' : 'ABCDEF'[r]), G.paused && G.state === 'idle' ? 'paused' : G.state, gantryPrompt(r), 'gantry' + r, { label: G.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { G.paused = !G.paused; sfx('click'); }, col: G.paused ? '#5fd38d' : '#f5b53d' }); }); dialRow('Pick belts', 'pickBelt'); }
        for (var lid in LOADER_DOORS) if (propInst[lid]) add('Dock loader ' + dockLabel(LOADER_DOORS[lid]), dockLoaderStatus(LOADER_DOORS[lid]), dockLoaderPrompt(LOADER_DOORS[lid]) + ' · ' + stageOf(lid).length + ' in the bay', null, null);
        if (S.up.shipbelt && propInst.shipBelt) dialRow('Shipping belt', 'shipBelt');
        if (upperOwned() && propInst.lift) { var L = liftState(); add('Goods lift', L.state, 'lifted ' + (S.stats.lifted || 0) + ' pallets · racked upstairs ' + (S.stats.upperIn || 0), null, { label: L.hold ? 'RELEASE' : 'HOLD', on: true, act: function () { L.hold = !L.hold; sfx('click'); }, col: L.hold ? '#5fd38d' : '#f5b53d' }); }
        if (sorterOwned() && propInst.spine) { var Z = sortState(); add('Sortation deck', SORT.cells.some(function (cd) { return Z.cells[cd.mode].q.length; }) ? 'sorting' : 'ready', 'read ' + Z.scanned + ' · sorted ' + Z.sorted + ' · turntable ' + Z.table.length + (S.up.deckNight ? ' · night shift on' : ''), 'sorter', null); }
        if (!rows.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench; the rest is in the shop', col: '#a0acb8' });
        return rows;
      }
    /* 13-pc.js */
    function openPc() {
        if (pc.on || driving) return;
        if (S.events.power) { toast('No power.', 'bad'); return; }
        pc.on = true; pc.app = pc.app || 'home'; pc.scroll = 0; pc.look.yaw = 0; pc.look.pitch = 0;
        pc.saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
        if (player.tool) releaseTool(); scanToggle(false);
        sfx('click'); introStep('pc'); screenDirtyAll(); hudDirty = true;
        $('h-drive').hidden = false; $('h-drive').innerHTML = 'Office PC · aim at a button and <b>E</b> taps it · mouse wheel scrolls a list · <b>Esc</b> or <b>WASD</b> stands up';
      }
    /* 13-pc.js */
    function pcRows(sc, rows, y0, rowH) {
        var c = sc.ctx, maxRows = Math.floor((sc.h - y0 - 90) / rowH), start = clamp(pc.scroll, 0, Math.max(0, rows.length - maxRows)), y = y0;   // 90: the two-row taskbar
        pc.scroll = start;
        rows.slice(start, start + maxRows).forEach(function (r) {
          c.fillStyle = r.hi ? 'rgba(245,181,61,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(16, y, sc.w - 32, rowH - 6);
          if (r.sw) { c.fillStyle = r.sw; c.fillRect(24, y + 10, 10, 10); }
          scText(c, r.sw ? 42 : 26, y + 19, String(r.text).slice(0, 70), r.col || '#eef1f5', 14); if (r.sub) scText(c, r.sw ? 42 : 26, y + 36, String(r.sub).slice(0, 96), '#a0acb8', 11);
          if (r.right !== undefined) { c.fillStyle = r.rcol || '#f5b53d'; c.font = 'bold 14px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), sc.w - (r.btn ? 130 : 26), y + 19); c.textAlign = 'left'; }
          if (r.btn) scButton(sc, sc.w - 118, y + 6, 96, rowH - 18, r.btn.label, !!r.btn.on, r.btn.act, r.btn.col);
          y += rowH;
        });
        if (rows.length > maxRows) { scButton(sc, sc.w - 60, y0 - 34, 20, 22, '▲', false, function () { pc.scroll = Math.max(0, pc.scroll - 1); }); scButton(sc, sc.w - 36, y0 - 34, 20, 22, '▼', false, function () { pc.scroll = pc.scroll + 1; }); c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText((start + 1) + '-' + Math.min(rows.length, start + maxRows) + ' of ' + rows.length, sc.w - 66, y0 - 18); c.textAlign = 'left'; }
        if (!rows.length) scText(c, 26, y0 + 24, 'Nothing here.', '#6b7784', 14);
      }
    /* 13-pc.js */
    function drawPc(c, sc) {
        var w = sc.w, h = sc.h;
        if (S.events.power) { c.fillStyle = '#05080a'; c.fillRect(0, 0, w, h); return; }
        scBg(c, w, h, 'rgba(120,189,245,0.18)');
        // the taskbar
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 84, w, 84);   // two rows of five since the Plant app: ten in one row left the last one a sliver
        var apps = pcApps(), perRow = Math.ceil(apps.length / 2), bw = Math.floor((w - 16 - 8 * (perRow - 1)) / perRow); if (!apps.some(function (a) { return a[0] === pc.app; })) pc.app = 'home';
        apps.forEach(function (a, i) { var row = Math.floor(i / perRow), col = i % perRow; scButton(sc, 8 + col * (bw + 8), h - 80 + row * 40, bw, 34, a[1] + ' ' + a[2], pc.app === a[0], function () { pc.app = a[0]; pc.scroll = 0; }, '#78bdf5'); });
        c.fillStyle = '#a0acb8'; c.font = '12px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('Day ' + S.day + ' · ' + fmtTime(S.time), w - 10, 14); c.textAlign = 'left';
        var app = pc.app;
        if (app === 'home') {
          scText(c, 24, 48, 'DEPOT OS', '#f5b53d', 34); scText(c, 24, 72, 'Depot Co. · ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + (isSunday() ? ' · Sunday, closed' : ''), '#a0acb8', 14);
          var kp = [['Bank', money(S.bank)], ['Open orders', String(openOrders().length)], ['In stock', totalStock() + ' boxes'], ['Reputation', String(Math.round(S.rep))], ['Level', S.level + ' · ' + S.xp + '/' + XP_FOR(S.level)], ['Crew', S.staff.length + ' (' + S.staff.filter(function (s) { return s.clocked; }).length + ' on the clock)']];
          kp.forEach(function (k, i) { var x = 24 + (i % 3) * 250, y = 100 + Math.floor(i / 3) * 90; c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, y, 234, 76); scText(c, x + 14, y + 26, k[0].toUpperCase(), '#6b7784', 11); scText(c, x + 14, y + 58, k[1], '#eef1f5', 24); });
          var last = S.log.slice(0, 5); scText(c, 24, 300, 'RECENT', '#6b7784', 11); last.forEach(function (l, i) { scText(c, 24, 322 + i * 20, 'D' + l.day + ' ' + l.t + '  ' + l.msg.slice(0, 90), l.kind === 'bad' ? '#ff6b5e' : l.kind === 'good' ? '#5fd38d' : '#eef1f5', 12); });
        } else if (app === 'orders') {
          scHead(c, w, 'ORDERS', openOrders().length + ' open');
          var rows = S.orders.slice().sort(function (a, b) { return a.due - b.due; }).map(function (o) { return { text: '#' + o.num + '  ' + clientName(o.client) + (o.rush ? '  RUSH' : '') + (o.late ? '  LATE' : ''), sub: o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · due ' + dueText(o.due) + ' · ' + o.state, right: money(o.pay), col: o.late || o.rush ? '#ff6b5e' : '#eef1f5', hi: o.state !== 'open' }; });
          returnsPending().forEach(function (r) { rows.push({ text: 'RETURN #' + r.num + '  ' + clientName(r.client), sub: r.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + r.why + ' · ' + returnPlaceText(r), right: money(returnFee(r)), rcol: '#f5b53d', col: r.late ? '#ff6b5e' : '#f5b53d' }); });
          S.shipped.slice(0, 6).forEach(function (s) { rows.push({ text: 'shipped #' + s.num + '  ' + clientName(s.client) + (s.late ? '  late' : '') + (s.short ? '  short' : ''), sub: 'day ' + s.day, right: money(s.paid), rcol: '#5fd38d', col: '#a0acb8' }); });
          pcRows(sc, rows, 60, 46);
        } else if (app === 'contracts') {
          scHead(c, w, 'CONTRACTS', unlocked('twoContracts') ? 'two at once' : undefined); var rows2 = [];
          if (!contractsAll().length) rows2.push({ text: 'No offer on the table', sub: !unlocked('contracts') ? 'Reach level ' + UNLOCK.contracts + ' and the clients start asking.' : 'Next offer around day ' + S.nextOffer + '.' });
          contractSlots().forEach(function (k) { var ct = S[k]; if (!ct) return;
            if (!ct.accepted) { rows2.push({ text: clientName(ct.client) + ' offers a ' + (ct.long ? 'long ' : '') + 'contract', sub: ct.need + ' orders on time by ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), btn: { label: 'ACCEPT', on: true, act: function () { contractAccept(k); }, col: '#5fd38d' }, hi: true }); rows2.push({ text: 'Decline', sub: 'The next offer comes in a couple of days.', btn: { label: 'DECLINE', on: false, act: function () { contractDecline(k); } } }); }
            else rows2.push({ text: clientName(ct.client) + ' · ' + ct.done + ' of ' + ct.need + ' on time', sub: 'until ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), right: Math.round(100 * ct.done / ct.need) + '%', hi: true }); });
          rows2.push({ text: 'How it works', sub: 'Every order of theirs shipped on time in the window counts. Miss the number and the penalty is taken. Contract clients order more while it runs.', col: '#a0acb8' });
          pcRows(sc, rows2, 60, 50);
        } else if (app === 'shop') {
          scHead(c, w, 'SHOP', money(S.bank) + ' · level ' + S.level);
          var rows3 = UPGRADES.filter(shopShows).map(function (u) { var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[u.id]; var needs = rowN && S.up.rows < rowN - 1 ? 'needs the previous row' : u.needs && !S.up[u.needs] ? 'needs ' + upgradeName(u.needs).toLowerCase() : S.level < u.lvl ? 'level ' + u.lvl : S.bank < u.price ? 'not enough money' : ''; return { text: u.name + (owned ? '  ·  owned' : ''), sub: (needs ? needs + ' · ' : '') + u.desc, right: money(u.price), btn: owned ? null : { label: !needs ? 'BUY' : needs === 'not enough money' ? 'NO MONEY' : 'LOCKED', on: !needs, act: function () { if (!needs) buyUpgrade(u.id); }, col: '#5fd38d' } }; });
          pcRows(sc, rows3, 60, 50);
        } else if (app === 'staff') {
          scHead(c, w, 'STAFF', S.staff.length + ' of ' + staffCap() + ' · ' + comfortText());
          var rows4 = Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl || (d.needs && !S.up[d.needs]); return { text: 'Hire a ' + d.name.toLowerCase() + '  ·  ' + money(d.wage / 10) + '/h', sub: d.desc, btn: { label: locked ? (S.level < d.lvl ? 'LEVEL ' + d.lvl : 'NEEDS FORK') : S.staff.length >= staffCap() ? 'FULL' : 'HIRE', on: !locked && S.staff.length < staffCap(), act: function () { if (!locked && S.staff.length < staffCap()) { hireStaff(r); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }, col: '#5fd38d' } }; });
          S.staff.forEach(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0), open = pc.staffOpen === st.id;
            rows4.push({ text: st.name + '  ·  ' + STAFF_ROLES[st.role].name + (st.cross && STAFF_ROLES[st.cross] ? ' (+' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + '  ·  ' + staffStatus(st), sub: 'today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + ' · ' + punctWord(st) + ' (' + Math.round((st.punct || 0.5) * 100) + '%)' + (st.lateToday ? ' · late today' : '') + ' · ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.raise ? ' · raised' : ''), hi: !!st.clocked, btn: { label: open ? 'CLOSE ▴' : 'OPTIONS ▸', on: open, act: function () { pc.staffOpen = open ? null : st.id; pc.confirm = null; }, col: '#78bdf5' } });
            if (!open) return;   // one row a worker unless their options are open (five rows each made eight crew forty rows of scrolling)
            rows4.push({ text: '   shift: ' + (st.shift || 'day') + (st.shiftNext ? ' (' + st.shiftNext + ' from tomorrow)' : ''), sub: 'shift ' + fmtTime(shiftStart(st)) + ' to ' + fmtTime(shiftOf(st).end) + ' · day, early or late; the change takes effect tomorrow', col: '#a0acb8', btn: { label: 'SHIFT ▸', on: true, act: function () { staffShiftCycle(st); }, col: '#78bdf5' } });
            rows4.push({ text: '   ' + (st.trained ? 'trained' : 'training course · $' + TRAIN_PRICE), sub: st.trained ? 'walks a fifth faster and finishes every task step a third sooner' : 'quicker on their feet and at every task', col: '#a0acb8', btn: { label: st.trained ? 'DONE' : 'TRAIN', on: !st.trained && S.bank >= TRAIN_PRICE, act: function () { staffTrain(st); }, col: '#5fd38d' } });
            rows4.push({ text: '   ' + (st.raise ? 'on the raised rate' : 'a raise · $' + RAISE_PRICE), sub: st.raise ? money(hourly(st)) + ' an hour, on time every day' : '10% more an hour, and timekeeping stops being a problem', col: '#a0acb8', btn: { label: st.raise ? 'DONE' : 'RAISE', on: !st.raise && S.bank >= RAISE_PRICE, act: function () { staffRaise(st); }, col: '#5fd38d' } });
            rows4.push({ text: '   second role' + (st.cross && STAFF_ROLES[st.cross] ? ' · ' + STAFF_ROLES[st.cross].name.toLowerCase() : ' · $' + CROSS_PRICE + ' once'), sub: 'covers the other job when their own queue is empty; tap to choose the role', col: '#a0acb8', btn: { label: st.cross ? 'NEXT ▸' : 'CHOOSE', on: st.crossPaid || S.bank >= CROSS_PRICE, act: function () { staffCrossCycle(st); }, col: '#78bdf5' } });
            rows4.push({ text: '   let ' + st.name + ' go', sub: 'the hours worked today are paid on the way out · tap twice', col: '#a0acb8', btn: { label: 'LET GO', on: false, act: function () { if (pc.confirm !== st.id) { pc.confirm = st.id; toast('Tap LET GO again to let ' + st.name + ' go', 'bad'); return; } pc.confirm = null; pc.staffOpen = null; fireStaff(st.id); }, col: '#ff6b5e' } }); });
          pcRows(sc, rows4, 60, 50);
        } else if (app === 'plant') {
          scHead(c, w, 'PLANT', powered() ? 'mains ok' : 'NO POWER');
          pcRows(sc, plantRows(), 60, 50);
        } else if (app === 'bank') {
          scHead(c, w, 'BANK', money(S.bank));
          var rows5 = [
            { text: 'Loan', sub: S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day from level ' + UNLOCK.loan + '. Repay when you can.', right: S.loan > 0 ? money(S.loan) : '', btn: S.loan > 0 ? { label: 'REPAY', on: S.bank > 0, act: function () { var amt = Math.min(S.loan, Math.max(0, S.bank)); if (amt > 0) { S.loan -= amt; pay(-amt, 'Loan repayment'); sfx('cash'); toast('Repaid ' + money(amt), 'good'); } }, col: '#5fd38d' } : { label: 'BORROW', on: unlocked('loan'), act: function () { if (unlocked('loan') && S.loan <= 0) { S.loan = 5000; pay(5000, 'Bank loan'); sfx('cash'); toast('$5,000 in the bank. 1.5% a day.', 'good'); } }, col: '#f5b53d' } },
            { text: 'Theft insurance', sub: '$40 a day. Pays 80% of the value of anything that walks off at night.' + (unlocked('insurance') ? '' : ' From level ' + UNLOCK.insurance + '.'), right: S.insured ? 'insured' : '', btn: { label: S.insured ? 'CANCEL' : 'INSURE', on: S.insured || unlocked('insurance'), act: function () { if (!S.insured && !unlocked('insurance')) return; S.insured = !S.insured; toast(S.insured ? 'Insured from tonight' : 'Insurance cancelled', ''); }, col: '#78bdf5' } },
            { text: 'Earned ' + money(S.stats.earned) + '  ·  spent ' + money(S.stats.spent) + '  ·  fines ' + money(S.stats.fines), sub: 'daily costs: rent ' + money(stageRent()) + ' + the crew by the hour' + (S.insured ? ' + $40 insurance' : '') + (S.loan ? ' + loan interest' : ''), col: '#a0acb8' }
          ];
          S.ledger.slice(0, 8).forEach(function (l) { rows5.push({ text: l.why, sub: 'day ' + l.day + ' · ' + l.t, right: money(l.n), rcol: l.n < 0 ? '#ff6b5e' : '#5fd38d', col: '#a0acb8' }); });
          pcRows(sc, rows5, 60, 48);
        } else if (app === 'stock') {
          var sum = stockSummary(), keys = Object.keys(sum).sort(); scHead(c, w, 'STOCK', totalStock() + ' boxes · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + '/' + slotTotal() + ' slots');
          var rows6 = keys.map(function (k) { var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) need += l.qty; }); }); return { sw: SKU[k].col, text: skuName(k) + '  ·  ' + money(SKU[k].val) + ' each', sub: slotsWith(k).map(slotName).slice(0, 4).join(', '), right: sum[k] + (need ? '  (' + need + ' needed)' : ''), rcol: need > sum[k] ? '#ff6b5e' : '#f5b53d' }; });
          pcRows(sc, rows6, 60, 44);
        } else if (app === 'factory') {
          var F = S.factory; scHead(c, w, 'PRODUCTION', factoryStatus().toUpperCase());
          var rowsF = [
            { text: 'Hopper: ' + F.raw + ' / ' + HOPPER_CAP + ' units of raw granulate', sub: 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units, one unit a box. Tip pallets in at the hopper in the production wing.', right: F.rawOrdered ? F.rawOrdered + ' on order' : '', btn: { label: 'ORDER $' + ECON.rawPrice, on: S.bank >= ECON.rawPrice, act: function () { if (S.bank < ECON.rawPrice) { sfx('bad'); return; } pay(-ECON.rawPrice, 'Raw granulate, one pallet'); F.rawOrdered++; sfx('cash'); toast('A pallet of raw granulate comes with the next inbound truck', 'good'); } } },
            { text: 'Moulding line: ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product), sub: FACTORY_RATE + ' s a box · made ' + F.made + ' so far · boxes go by belt to the palletiser in the hall', btn: { label: F.on ? 'STOP' : 'START', on: true, act: function () { moulderUse(); }, col: F.on ? '#ff6b5e' : '#5fd38d' } }
          ];
          ownSkus().forEach(function (s) { rowsF.push({ sw: s.col, text: s.name + ' · ' + money(s.val) + ' a box to the clients', sub: 'in stock ' + stockCount(s.id) + (!skuOpen(s) ? ' · clients ask for it from level ' + s.lvl : ''), btn: { label: F.product === s.id ? 'SELECTED' : 'SELECT', on: F.product !== s.id, act: function () { F.product = s.id; sfx('click'); } } }); });
          rowsF.push({ text: 'Baler: ' + S.baler.card + ' / ' + BALE_NEED + ' cardboard · ' + S.baler.bales + ' bales waiting · ' + S.baler.made + ' made', sub: 'Binned boxes and packing offcuts fill it. Outbound trucks take bales at ' + money(BALE_PRICE) + ' each. Wrapper film left: ' + S.wrap.film + '.', col: '#a0acb8' });
          rowsF.push({ text: 'Pallets finished by the palletiser: ' + (S.stats.palletised || 0) + ' · parcels off the pack line: ' + S.pack.made, sub: 'Finished pallets drop beside the palletiser; rack them like any delivery. Clients start ordering your own goods once they have seen them.', col: '#a0acb8' });
          pcRows(sc, rowsF, 60, 50);
        } else if (app === 'stats') {
          scHead(c, w, 'STATS', 'day ' + S.day); var st2 = S.stats;
          var rows7 = [['Pallets received', st2.received], ['Boxes put away', st2.putaway], ['Boxes picked', st2.picked], ['Orders packed', st2.packed], ['Orders shipped', st2.shipped], ['Late', st2.late], ['Pallets refused', st2.lost], ['Boxes stolen', st2.stolen || 0], ['Returns inspected', st2.returns || 0], ['Damaged boxes binned', S.binned || 0], ['Your hours on the clock', Math.round((st2.hoursWorked || 0) * 10) / 10], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return { text: k[0], right: String(k[1]) }; });
          pcRows(sc, reportRows().concat(rows7), 60, 40);   // the last seven day reports first, then the lifetime counts
        }
      }
    /* 13-scanner-device.js */
    var scanDev = { g: null, canvas: null, ctx: null, tex: null, t: 0, redrawT: 0, laser: null, laserT: 0, lastFocusKey: null, lastBeep: null, led: null, marker: null, rows: [], navShown: false };
    /* 13-scanner-device.js */
    var SCAN_W = 300, SCAN_H = 380, SCAN_RES = 2;
    /* 13-scanner-device.js */
    function scanSlotNav(key, label) { var sp = slotStand(key), p = slotParse(key); return { x: sp.x, z: sp.z, y: p.r === UPPER.row ? UPPER.y : 0, label: label || slotName(key) }; }
    /* 13-scanner-device.js */
    function scanPickSlot(sku) {   // the hand-reachable slot of a line nearest to you, floor and shelf levels only
        var best = null, bd = 1e9; slotsWith(sku).forEach(function (k) { var p = slotParse(k); if (p.l >= RACK.top || !slotOwned(k)) return; var sp = slotStand(k), d = dist2(sp.x, sp.z, player.x, player.z); if (d < bd) { bd = d; best = k; } }); return best;
      }
    /* 13-scanner-device.js */
    function scanDoorNav(i) { var at = doorInside(i); return at ? { x: at[0] + (DOOR_MAP[i].dir === 'in' ? 2.0 : -2.0), z: at[1], y: 0, label: 'Dock ' + dockLabel(i) } : null; }
    /* 13-scanner-device.js */
    function scanPropNav(prop, label) { if (!propInst[prop]) return null; var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.6, z: P.z + Math.cos(a) * 1.6, y: prop === 'scanner' ? UPPER.y : 0, label: label || propLabel(prop) }; }
    /* 13-scanner-device.js */
    function scanLane(o) { var m = MODES[orderMode(o)]; return { col: m.col, tag: m.name.toUpperCase() }; }
    /* 13-scanner-device.js */
    function scanReturnsNav() { return returnsHall() ? scanPropNav('retIntake', 'Returns intake') : scanPropNav('returnsDesk', 'Returns desk'); }
    /* 13-scanner-device.js */
    function scanReturnsWhere() { return returnsHall() ? 'the intake in the returns hall' : 'the returns desk by the bench'; }
    /* 13-scanner-device.js */
    function scanPageRows(page) {
        var rows = [];
        if (page === MAP_PAGE) return rows;   // the map draws itself
        if (page === 0) {   // HOME: the day at a glance, then the alerts
          var openN = S.orders.filter(function (o) { return o.state === 'open'; }).length, packedN = S.orders.filter(function (o) { return o.state === 'packed'; }).length, lateN = S.orders.filter(function (o) { return o.late && o.state !== 'shipped'; }).length;
          rows.push({ text: 'Day ' + S.day + ' · ' + fmtTime(S.time) + ' · ' + SEASONS[season()] + (isSunday() ? ' · SUNDAY' : ''), sub: (S.weather ? S.weather.kind : 'clear') + ' · level ' + S.level + ' · ' + S.xp + ' / ' + XP_FOR(S.level) + ' xp', right: money(S.bank), col: '#f5b53d' });
          rows.push({ text: openN + ' open · ' + packedN + ' packed · ' + lateN + ' late', sub: 'rep ' + Math.round(S.rep) + (S.contract && S.contract.accepted ? ' · contract ' + S.contract.done + '/' + S.contract.need : ''), right: 'orders' });
          var docked = S.trucks.filter(function (t) { return t.state === 'docked'; });
          rows.push({ text: docked.length ? docked.map(function (t) { return dockLabel(doorIndex(t.dir, t.dock)); }).join(' · ') + ' docked' : 'No truck at a door', sub: 'next in ' + TRUCK_IN.map(fmtTime).join(' / ') + ' · out ' + TRUCK_OUT.filter(function (dk, i) { return dockOwned(i); }).map(function (dk, i) { return MODES[dk.mode].name.slice(0, 1) + ' ' + fmtTime(outNext(i).arrive); }).join(' · '), right: 'trucks' });
          if (scan.nav) rows.push({ text: '⌖ ' + scan.nav.label, sub: Math.round(Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z))) + ' m away · X clears', hi: true, col: '#5fd38d' });
          var al = [];
          if (S.events.power) al.push(['NO POWER', 'reset the breaker in the office', scanPropNav('breaker', 'Breaker panel')]);
          S.trucks.forEach(function (t) { if (t.dir === 'in' && t.state === 'docked' && !t.signed) al.push(['Unsigned delivery at ' + dockLabel(doorIndex('in', t.dock)), 'the driver waits by the door · Enter signs it from here', scanDoorNav(doorIndex('in', t.dock)), scanSignAct(t)]); });
          // a truck about to go with work still to do: an inbound one in its last hour with pallets aboard, an outbound one at a manual dock with parcels of its lane packed and not loaded (a loader or the deck takes those by itself)
          S.trucks.forEach(function (t) { if (t.state !== 'docked') return; var di = doorIndex(t.dir, t.dock);
            if (t.dir === 'in') { var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; }).length; if (left && S.time >= t.leave - 1) al.push([dockLabel(di) + ' truck leaves ' + fmtTime(t.leave) + ' · ' + left + ' pallet' + (left > 1 ? 's' : '') + ' aboard', 'whatever is still on it goes back unpaid', scanDoorNav(di)]); }
            else if (t.dir === 'out' && !sorterOwned() && !(S.up.shipbelt && di === LOADER_DOORS.dockLoader2)) { var wait = S.orders.filter(function (o) { return o.state === 'packed' && (!lanesOn() || orderMode(o) === t.mode); }).length; if (wait) al.push([wait + ' ' + t.mode + ' parcel' + (wait > 1 ? 's' : '') + ' not on the ' + dockLabel(di) + ' truck', 'it leaves ' + fmtTime(t.leave) + ' · the parcels are on the shelf, the floor or the cart', scanPropNav('packline', 'Parcel shelf')]); } });
          var cof = contractOffer(); if (cof) al.push(['Contract offer from ' + clientName(cof.client), cof.need + ' orders on time by ' + dueText(cof.until) + ' for ' + money(cof.bonus) + ' · Enter accepts, the PC declines', scanPropNav(unlocked('pc') ? 'desk' : 'bench', unlocked('pc') ? 'Office PC' : 'The paperwork'), { label: 'ACCEPT', run: function () { contractAccept(); } }]);
          if (S.siteDue > S.site) al.push(['The builders are booked: ' + stageName(S.siteDue).toLowerCase(), 'the building grows at the day roll: sleep, or let the clock run past midnight', scanPropNav('cot', 'The cot')]);
          if (propInst.wrapper && S.wrap && S.wrap.film <= 2) al.push(['Wrapper film ' + (S.wrap.film ? 'nearly out: ' + S.wrap.film + ' left' : 'finished'), 'a new roll is ' + money(FILM_PRICE) + ' on the wrapper screen', scanPropNav('wrapper', 'Stretch wrapper')]);
          if (S.pack && S.pack.jam) al.push(['Pack line jammed', 'Enter clears the jam from here', scanPropNav('packline', 'Pack line'), { label: 'CLEAR', run: function () { packUse(); } }]);
          if (S.factory && S.factory.jam) al.push(['Moulding line jammed', 'Enter clears the jam from here', scanPropNav('moulder', 'Moulding line'), { label: 'CLEAR', run: function () { moulderUse(); } }]);
          if (lateN) al.push([lateN + ' late order' + (lateN > 1 ? 's' : ''), 'half pay once shipped · cancelled after 30 h', null]);
          var surN = surplusCount(); if (surN) al.push([surN + ' surplus box' + (surN > 1 ? 'es' : ''), 'Enter puts them back on the racks', scanPropNav('bench', 'Packing bench'), { label: 'RETURN', run: function () { returnSurplus(); } }]);
          var rpn = returnsPending(); if (rpn.length) al.push([rpn.length + ' return' + (rpn.length > 1 ? 's' : '') + ' to inspect', rpn.map(function (r) { return '#' + r.num + ' ' + returnPlaceText(r); }).join(' · '), scanReturnsNav()]);
          var loose = S.floor.filter(function (f) { return f.kind === 'parcel'; }).length; if (loose) al.push([loose + ' parcel' + (loose > 1 ? 's' : '') + ' on the floor', 'the inspector counts these', null]);
          if (S.up.fork && (S.fork.batt === undefined ? 1 : S.fork.batt) < 0.25) al.push(['Forklift battery ' + Math.round((S.fork.batt || 0) * 100) + '%', 'plug it in at the charger by the south wall', scanPropNav('charger', 'Charger')]);
          for (var id in (S.stage || {})) if (S.stage[id].length >= STAGE_CAP - 1 && LOADER_DOORS[id] !== undefined) al.push([dockLabel(LOADER_DOORS[id]) + ' shipping bay nearly full', S.stage[id].length + ' of ' + STAGE_CAP + ' · it empties when a truck of its lane docks', scanDoorNav(LOADER_DOORS[id])]);
          if (sorterOwned() && S.sort && S.sort.table.length >= 4) al.push(['Sorter turntable backing up', S.sort.table.length + ' parcels going round again', null]);
          if (!al.length) rows.push({ text: 'No alerts', sub: 'everything that needs a hand shows up here', col: '#5fd38d' });
          al.forEach(function (a) { rows.push({ text: '! ' + a[0], sub: a[1], col: '#ff6b5e', nav: a[2], act: a[3] || null }); });
        } else if (page === 1) {   // ORDERS: every open and packed order, oldest due first, its lines and where they are
          var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packing' || o.state === 'packed'; }).sort(function (a, b) { return a.due - b.due; });
          if (!os.length) rows.push({ text: 'No orders', sub: 'they arrive from 08:00 on working days', col: '#a0acb8' });
          os.forEach(function (o) {
            var ln = scanLane(o), first = null;
            if (o.state === 'open') o.lines.forEach(function (l) { if (first) return; var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0); if (have < l.qty) { var k = scanPickSlot(l.sku); if (k) first = scanSlotNav(k, skuName(l.sku) + ' for #' + o.num + ' · ' + slotName(k)); } });
            rows.push({ text: '#' + o.num + ' ' + clientName(o.client).slice(0, 18) + (o.rush ? ' RUSH' : ''), sub: (lanesOn() ? ln.tag + ' · ' : '') + dockLabel(modeDoor(orderMode(o))) + ' · due ' + dueText(o.due) + (o.late ? ' LATE' : '') + ' · ' + money(o.pay) + (o.state !== 'open' ? ' · ' + o.state.toUpperCase() : ''), right: o.state === 'open' ? o.lines.reduce(function (a, l) { return a + Math.min(l.qty, S.bench.boxes[l.sku] || 0); }, 0) + '/' + o.lines.reduce(function (a, l) { return a + l.qty; }, 0) : '', col: o.late || o.rush ? '#ff6b5e' : o.state === 'packed' ? '#5fd38d' : '#eef1f5', sw: ln.col, nav: first, hi: o.state === 'packed', act: o.state === 'open' ? { label: 'PACK', on: canPack(o) && powered(), why: !powered() ? 'No power.' : 'Not every box is on the bench yet.', run: function () { packOrder(o); } } : null });
            if (o.state === 'open') o.lines.forEach(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0), k = have < l.qty ? scanPickSlot(l.sku) : null; rows.push({ text: '   ' + skuName(l.sku), sub: '   ' + (have >= l.qty ? 'on the bench' : k ? slotName(k) : stockCount(l.sku) ? 'top level only: forklift' : 'not in stock'), right: have + '/' + l.qty, col: have >= l.qty ? '#5fd38d' : '#a0acb8', sw: SKU[l.sku].col, nav: k ? scanSlotNav(k, skuName(l.sku) + ' · ' + slotName(k)) : null }); });
          });
          var rts = returnsPending(); if (rts.length) { rows.push({ text: 'Returns · ' + rts.length, sub: 'to ' + scanReturnsWhere() + ' · ' + money(RETURNS.fee) + ' a return and ' + money(RETURNS.perBox) + ' a box', col: '#f5b53d', nav: scanReturnsNav() }); rts.forEach(function (r) { var pl = returnPlace(r.id), nav = null; if (pl === 'truck') { var tt = S.trucks.filter(function (x) { return (x.returns || []).indexOf(r.id) >= 0; })[0]; if (tt) nav = scanDoorNav(doorIndex(tt.dir, tt.dock)); } else if (pl === 'floor') { var ff = S.floor.filter(function (f) { return f.kind === 'return' && f.id === r.id; })[0]; if (ff) nav = { x: ff.x, z: ff.z, y: 0, label: 'Return #' + r.num }; } else if (pl === 'desk' || pl === 'inspecting' || pl === 'belt') nav = scanReturnsNav(); rows.push({ text: '   #' + r.num + ' ' + clientName(r.client).slice(0, 16), sub: '   ' + r.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + r.why + ' · ' + returnPlaceText(r), right: pl === 'inspecting' ? 'INSPECTING' : '', col: r.late ? '#ff6b5e' : '#a0acb8', sw: MODES[r.mode] ? MODES[r.mode].col : null, nav: nav }); }); }
        } else if (page === 2) {   // PICKS: one list for every open order together, less the bench and what is already on its way, in walking order
          var need = benchNeed(), fl = pickInFlight(), items = [];
          for (var sku in need) { var n = need[sku] - (fl[sku] || 0); if (n <= 0) continue; var k2 = scanPickSlot(sku); items.push({ sku: sku, n: n, key: k2, p: k2 ? slotParse(k2) : null }); }
          items.sort(function (a, b) { if (!a.key) return 1; if (!b.key) return -1; return (a.p.r - b.p.r) || (a.p.b - b.p.b); });
          if (!items.length) rows.push({ text: 'Nothing to pick', sub: Object.keys(need).length ? 'the cranes and the crew have every box on its way' : 'the bench has every box the open orders want', col: '#5fd38d' });
          items.forEach(function (it, i) { rows.push({ text: it.n + ' × ' + skuName(it.sku), sub: it.key ? slotName(it.key) + (i === 0 ? ' · next' : '') : stockCount(it.sku) ? 'top level only: the forklift reaches it' : 'not on the racks', right: it.key ? rowName(it.p.r).replace('Row ', '') + ' ' + (it.p.b + 1) : '', sw: SKU[it.sku].col, hi: i === 0, nav: it.key ? scanSlotNav(it.key, it.n + ' × ' + skuName(it.sku) + ' · ' + slotName(it.key)) : null }); });
          var sur = benchSurplus(), sn = 0; for (var sk in sur) sn += sur[sk]; if (sn) rows.push({ text: sn + ' surplus on the bench', sub: 'Enter puts it back on the racks, or the cart takes it', col: '#f5b53d', nav: scanPropNav('bench', 'Packing bench'), act: { label: 'RETURN', run: function () { returnSurplus(); } } });
        } else if (page === 3) {   // PUTAWAY: what is on a docked truck and where it should go, pallets on the floor, loose boxes
          var any = false;
          S.trucks.forEach(function (t) { if (t.dir !== 'in' || t.state !== 'docked') return; any = true; var di = doorIndex('in', t.dock), ps = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; });
            rows.push({ text: dockLabel(di) + ' · ' + clientName(t.client).slice(0, 16), sub: ps.length + ' pallets aboard · leaves ' + fmtTime(t.leave) + (t.signed ? '' : ' · NOT SIGNED'), col: t.signed ? '#f5b53d' : '#ff6b5e', hi: !t.signed, nav: scanDoorNav(di), act: t.signed ? null : scanSignAct(t) });
            ps.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); rows.push({ text: '   ' + p.n + ' × ' + skuName(p.sku), sub: '   ' + (k ? '→ ' + slotName(k) : 'no rack space on the hand levels'), sw: SKU[p.sku].col, col: '#a0acb8', nav: k ? scanSlotNav(k, p.n + ' × ' + skuName(p.sku) + ' → ' + slotName(k)) : null }); }); });
          var flp = S.pallets.filter(function (p) { return p.place === 'floor' && p.n > 0; });
          flp.forEach(function (p) { if (!any) { rows.push({ text: 'On the floor', sub: 'pallets set down and not racked', col: '#f5b53d' }); any = true; } var k = findSlotFor(p.sku, p.n, 1); rows.push({ text: p.n + ' × ' + skuName(p.sku) + (p.wrapped ? ' (wrapped)' : ''), sub: (k ? '→ ' + slotName(k) : 'no rack space') + ' · at ' + p.x.toFixed(0) + ', ' + p.z.toFixed(0), sw: SKU[p.sku].col, nav: { x: p.x, z: p.z, y: 0, label: 'Pallet of ' + skuName(p.sku) } }); });
          var lb = S.floor.filter(function (f) { return f.kind === 'box'; }); if (lb.length) { any = true; rows.push({ text: lb.length + ' loose box' + (lb.length > 1 ? 'es' : '') + ' on the floor', sub: 'the inspector counts these · RETURN SURPLUS racks the undamaged ones', col: '#ff6b5e', nav: { x: lb[0].x, z: lb[0].z, y: 0, label: 'Loose box of ' + skuName(lb[0].sku) }, act: { label: 'RETURN', run: function () { returnSurplus(); } } }); }
          if (!any) rows.push({ text: 'Nothing to put away', sub: 'inbound trucks at ' + TRUCK_IN.map(fmtTime).join(' and '), col: '#5fd38d' });
        } else if (page === 4) {   // STOCK: every line, most first, with its slots, what the orders want of it, and the low ones flagged
          var sum = stockSummary(), keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a]; }), used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
          rows.push({ text: totalStock() + ' boxes · ' + used + ' / ' + slotTotal() + ' slots', sub: S.up.rows + ' main rows' + (upperOwned() ? ' · the deck' : '') + (groundRows().length > S.up.rows ? ' · ' + (groundRows().length - S.up.rows) + ' annex rows' : ''), col: '#f5b53d' });
          if (!keys.length) rows.push({ text: 'The racks are empty', sub: 'the first truck is due at ' + fmtTime(TRUCK_IN[0]), col: '#a0acb8' });
          keys.forEach(function (k) { var want = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) want += l.qty; }); }); var sl = slotsWith(k), first = sl.filter(function (q) { return slotParse(q).l < RACK.top; })[0] || sl[0]; rows.push({ text: skuName(k), sub: sl.slice(0, 3).map(slotName).join(' · ') + (sl.length > 3 ? ' +' + (sl.length - 3) : '') + (want ? ' · orders want ' + want : ''), right: String(sum[k]) + (sum[k] < 6 ? ' LOW' : ''), col: sum[k] < 6 ? '#ff6b5e' : '#eef1f5', sw: SKU[k].col, nav: first ? scanSlotNav(first, skuName(k) + ' · ' + slotName(first)) : null }); });
        } else if (page === 5) {   // DOCKS: every door, its lane, its truck, the next window, the shipping bays
          if (TRUCK_OUT[0] && TRUCK_OUT[0].van) { var vt = truckAtDoor(2); rows.push({ text: 'The van · ' + (vt ? vt.parcels.length + ' of ' + VAN.cap + ' aboard' : 'not here'), sub: vt ? 'at the shed front · leaves ' + fmtTime(vt.leave) : outNextText(0) + ' · it parks at the shed front', right: vt ? 'VAN' : '', sw: '#5fd38d', hi: !!vt, nav: { x: VAN.x + 1.6, z: VAN.z, y: YARD_Y, label: 'The van' }, act: vt && vt.parcels.length ? { label: 'DISPATCH', on: true, run: function () { consoleUse(2); } } : null }); }
          DOOR_MAP.forEach(function (dm, i) { if (!doors[i]) return; var t = truckAtDoor(i), lane = dockLane(i), own = doorOwned(i);
            var sub = !own ? 'opens with the sortation deck' : t ? (t.dir === 'in' ? t.pallets.length + ' pallets · ' + (t.signed ? 'signed' : 'NOT SIGNED') : t.dir === 'ret' ? (t.returns || []).length + ' returns aboard' : t.parcels.length + ' parcels aboard' + (t.returns && t.returns.length ? ' · ' + t.returns.length + ' return' + (t.returns.length > 1 ? 's' : '') : '')) + ' · leaves ' + fmtTime(t.leave) : dm.dir === 'in' ? 'next at ' + TRUCK_IN.map(fmtTime).join(' / ') : dm.dir === 'ret' ? 'returns truck · next at ' + TRUCK_RET.map(fmtTime).join(' / ') : outNextText(dm.dock) + (outNext(dm.dock).tomorrow ? '' : ' to ' + fmtTime(outNext(dm.dock).leave));
            var bayId = null; for (var lid in LOADER_DOORS) if (LOADER_DOORS[lid] === i) bayId = lid; if (bayId && propInst[BAY.at[bayId].prop]) sub += ' · bay ' + stageOf(bayId).length + '/' + STAGE_CAP;
            rows.push({ text: dockLabel(i) + (lane && lanesOn() ? ' · ' + lane.name.toUpperCase() : dm.dir === 'in' ? ' · inbound' : ' · outbound') + ' · ' + (S.doors[i] ? 'OPEN' : 'shut'), sub: sub, right: t ? 'TRUCK' : '', sw: lane ? lane.col : '#f5b53d', hi: !!t, col: own ? '#eef1f5' : '#6b7784', nav: scanDoorNav(i), act: own ? { label: S.doors[i] ? 'CLOSE' : 'OPEN', on: !S.events.power, why: 'No power: the door motor is dead.', run: function () { setDoor(i, !S.doors[i]); } } : null });
            if (t) rows.push({ text: '   ' + (t.dir === 'in' ? 'Inbound' : t.dir === 'ret' ? 'Returns' : (MODES[t.mode] || MODES.land).name) + ' truck · ' + t.driver, sub: '   ' + (t.dir === 'in' ? (t.signed ? 'signed · ' + t.pallets.length + ' pallets' : 'NOT SIGNED') : t.dir === 'out' ? t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded' : (t.returns || []).length + ' returns aboard') + ' · leaves ' + fmtTime(t.leave), col: '#a0acb8', act: t.dir === 'in' ? (t.signed ? null : scanSignAct(t)) : t.dir === 'out' ? { label: 'DISPATCH', on: t.parcels.length > 0, why: 'Nothing loaded yet.', run: function () { consoleUse(i); } } : null }); });
          var packedBy = {}; S.orders.forEach(function (o) { if (o.state === 'packed') { var m = orderMode(o); packedBy[m] = (packedBy[m] || 0) + 1; } });
          if (lanesOn()) rows.push({ text: 'Waiting to ship: sea ' + (packedBy.sea || 0) + ' · land ' + (packedBy.land || 0) + ' · air ' + (packedBy.air || 0), sub: 'wrong door pays a ' + Math.round((1 - MODE_FEE) * 100) + '% fee · misrouted so far ' + (S.stats.misrouted || 0), col: '#a0acb8' }); else rows.push({ text: 'Waiting to ship: ' + S.orders.filter(function (o) { return o.state === 'packed'; }).length + ' packed', sub: 'the lanes come with the hall at level ' + STAGES[2].level, col: '#a0acb8' });
        } else if (page === 6) {   // PLANT: every machine, jams first
          var pr = plantRows().filter(function (r) { return !r.dialOnly; });
          pr.sort(function (a, b) { return (/jam|off/.test(b.text) ? 1 : 0) - (/jam|off/.test(a.text) ? 1 : 0); });
          pr.forEach(function (r) { var parts = r.text.split('  ·  '), name = parts[0].trim(), st = parts.slice(1).join(' '), prop = ({ 'Pack line': 'packline', 'Moulding line': 'moulder', 'Palletiser': 'palletiser', 'Baler': 'baler', 'Stretch wrapper': 'wrapper', 'AGV-1': 'agvDock', 'Goods lift': 'lift', 'Sortation deck': 'scanner', 'Bench surplus': 'bench' })[name] || (/^Gantry /.test(name) ? 'gantry' + (name === 'Gantry upper' ? 5 : 'ABCDEF'.indexOf(name.slice(7))) : /^Dock loader/.test(name) ? 'dockLoader' + (+name.slice(-1)) : null);
            rows.push({ text: name + (st ? ' · ' + st : ''), sub: String(r.sub || '').slice(0, 60), right: r.right || '', col: /jam|off|paused/.test(st) ? '#ff6b5e' : r.hi ? '#5fd38d' : '#eef1f5', hi: /jam/.test(st), nav: prop ? scanPropNav(prop, name) : null, act: r.btn ? { label: String(r.btn.label), on: r.btn.on !== false, why: 'Not now.', run: r.btn.act } : null }); });
          if (!pr.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench', col: '#a0acb8' });
        } else {   // CREW: who is in, what they are at, and you
          if (!S.staff.length) rows.push({ text: 'No crew', sub: 'hire ' + (unlocked('pc') ? 'on the office PC' : 'on the clipboard') + ' from level ' + UNLOCK.picker + ' · ' + staffCapAt(S.level) + ' head' + (staffCapAt(S.level) === 1 ? '' : 's') + ' at this level', col: '#a0acb8' });
          S.staff.forEach(function (st) { var task = st.task ? (st.task.kind === 'pick' ? 'picking ' + skuName(st.task.sku) : st.task.kind === 'fetch' ? 'fetching a pallet' : st.task.kind === 'return' ? 'returning ' + skuName(st.task.sku) : st.task.kind === 'rdesk' ? 'taking a return to the desk' : /^ret/.test(st.task.kind) ? 'on the returns' : st.task.kind) : st.carry ? (st.carry.kind === 'box' ? 'carrying ' + skuName(st.carry.sku) : st.carry.kind === 'return' ? 'carrying a return' : 'carrying a parcel') : st.state === 'drive' ? 'on the forklift' : st.state === 'break' ? 'on break' : staffStatus(st);
            rows.push({ text: st.name + ' · ' + STAFF_ROLES[st.role].name + (st.cross ? ' +' + STAFF_ROLES[st.cross].name.toLowerCase() : ''), sub: task + ' · ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h today · ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.lateToday ? ' · late' : ''), right: st.clocked ? 'IN' : '', hi: !!st.clocked, col: st.clocked ? '#eef1f5' : '#a0acb8', staff: st.id, nav: st.clocked ? { x: st.x, z: st.z, y: 0, label: st.name } : null, act: st.lateToday && !st.wordToday ? { label: 'WORD', run: function () { staffWord(st); } } : { label: 'SHIFT ▸', run: function () { staffShiftCycle(st); } } }); });
          rows.push({ text: S.clockedIn ? 'You · on the clock since ' + fmtTime(S.clockInAt) : 'You · not clocked in', sub: S.clockedIn ? (Math.round(myHours() * 10) / 10) + ' h this shift' : 'the time clock is by the staff door', right: '', col: S.clockedIn ? '#5fd38d' : '#f5b53d', nav: scanPropNav('timeclock', 'Time clock'), act: { label: S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', run: function () { myClock(!S.clockedIn); } } });
          if (S.up.fork) rows.push({ text: 'Forklift · battery ' + Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100) + '%', sub: forkCharging() ? 'charging' : S.fork.plugged ? 'plugged in, full' : 'not plugged in', col: (S.fork.batt === undefined ? 1 : S.fork.batt) > 0.3 ? '#eef1f5' : '#ff6b5e', nav: { x: S.fork.x, z: S.fork.z, y: 0, label: 'Forklift' } });
        }
        return rows;
      }
    /* 13-scanner-device.js */
    function scanReadout() {
        if (!focus) return null;
        if (focus.slot) { var sl = S.slots[focus.slot], want = 0, sk = sl && sl.sku; if (sk) S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sk) want += l.qty; }); }); return { key: 'slot:' + focus.slot, head: slotName(focus.slot), body: sl && sl.n ? sl.n + ' × ' + skuName(sl.sku) + (sl.pal ? ' on a pallet' : '') + (want ? ' · orders want ' + want : '') : sl && sl.pal ? 'an empty pallet' : 'empty · ' + ECON.slotCap + ' boxes of one line fit' }; }
        var src = focus.src;
        if (src) {
          if (src.kind === 'truckReturn' || src.kind === 'rdeskq' || src.kind === 'rdeskcur' || (src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'return')) { var rid = src.kind === 'truckReturn' ? src.id : src.kind === 'rdeskq' ? rdesk().queue[src.idx] : src.kind === 'rdeskcur' ? rdesk().cur : S.floor[src.idx].id, rr = returnById(rid); if (rr) return { key: 'ret:' + rr.id, head: returnLabel(rr), body: rr.lines.map(function (l) { return l.qty + ' × ' + skuName(l.sku); }).join(', ') + ' · ' + rr.why + ' · ' + money(returnFee(rr)) + ' fee at the desk' }; }
          if (src.kind === 'pallet') { var p = palletById(src.id); if (p) { var k = p.n ? findSlotFor(p.sku, p.n, 1) : null; return { key: 'pal:' + p.id, head: p.n ? p.n + ' × ' + skuName(p.sku) : 'Empty pallet', body: (p.wrapped ? 'wrapped · ' : '') + (p.place === 'truck' ? 'on the truck' : p.place === 'floor' ? 'on the floor' : p.place) + (k ? ' · goes to ' + slotName(k) : '') }; } }
          var oid = src.kind === 'shelf' || src.kind === 'stage' ? src.order : src.kind === 'belt' && src.item && src.item.kind === 'parcel' ? src.item.order : src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'parcel' ? S.floor[src.idx].order : src.kind === 'cart' && src.idx >= S.cart.boxes.length ? (S.cart.parcels || [])[src.idx - S.cart.boxes.length] : null;
          var o = oid ? orderById(oid) : null;
          if (o) { var m = MODES[orderMode(o)]; return { key: 'par:' + o.id, head: 'Parcel #' + o.num + ' · ' + clientName(o.client).slice(0, 16), body: (lanesOn() ? m.name.toUpperCase() + ' lane · ' : '') + 'out by ' + dockLabel(modeDoor(orderMode(o))) + ' · due ' + dueText(o.due) + (o.form ? ' · ' + o.form : '') + (o.late ? ' · LATE' : '') }; }
          var bsku = src.kind === 'bench' ? src.sku : src.kind === 'belt' && src.item && src.item.kind === 'box' ? src.item.sku : src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'box' ? S.floor[src.idx].sku : src.kind === 'cart' && src.idx < S.cart.boxes.length ? S.cart.boxes[src.idx] : src.kind === 'rdesk' && rdesk().shelf[src.idx] ? rdesk().shelf[src.idx].sku : null;
          if (bsku) { var w2 = 0; S.orders.forEach(function (o2) { if (o2.state === 'open') o2.lines.forEach(function (l) { if (l.sku === bsku) w2 += l.qty; }); }); return { key: 'box:' + bsku + ':' + src.kind, head: 'Box of ' + skuName(bsku), body: (src.kind === 'bench' ? 'on the bench' : src.kind === 'belt' ? 'riding the ' + beltLabel(BELTS[src.belt]) : src.kind === 'floor' ? 'loose on the floor' : src.kind === 'rdesk' ? (rdesk().shelf[src.idx].damaged ? 'a damaged return: for the bin' : 'a return: back on a rack') : 'on the cart') + (w2 ? ' · orders want ' + w2 : ' · no open order wants it') }; }
        }
        if (focus.truck) { var t = truckById(focus.truck); if (t) return { key: 'truck:' + t.id, head: (t.dir === 'in' ? 'Inbound' : (MODES[t.mode] || MODES.land).name + ' truck') + ' at ' + dockLabel(doorIndex(t.dir, t.dock)), body: (t.dir === 'in' ? t.pallets.length + ' pallets · ' + (t.signed ? 'signed' : 'not signed yet') : t.parcels.length + ' parcels aboard') + ' · leaves ' + fmtTime(t.leave) + ' · ' + t.driver }; }
        if (focus.staffId) { var st = staffById(focus.staffId); if (st) return { key: 'staff:' + st.id, head: st.name + ' · ' + STAFF_ROLES[st.role].name, body: staffStatus(st) + ' · ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h today' }; }
        if (focus.prop) { var pr = plantRows().filter(function (r) { return !r.dialOnly; }), lbl = propLabel(focus.prop), hit = pr.filter(function (r) { return r.key === focus.prop; })[0] || pr.filter(function (r) { return r.text.toLowerCase().indexOf(lbl.toLowerCase().split(' ')[0]) === 0; })[0]; return { key: 'prop:' + focus.prop, head: lbl.charAt(0).toUpperCase() + lbl.slice(1), body: hit ? hit.text.split('  ·  ').slice(1).join(' · ') + (hit.right ? ' · dial ' + hit.right : '') : (focusText || '').slice(0, 60) }; }
        return null;
      }
    /* 13-scanner-device.js */
    var SCAN_ICONS = ['⌂', '≡', '✓', '▣', '▤', '⇄', '⚙', '☺', '⊞'];
    /* 13-scanner-device.js */
    function scanFit(c, s, maxW) { s = String(s); if (c.measureText(s).width <= maxW) return s; var lo = 0, hi = s.length; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (c.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; } return s.slice(0, lo).replace(/[\s·]+$/, '') + '…'; }
    /* 13-scanner-device.js */
    function drawScanner() {
        var c = scanDev.ctx; if (!c) return; var w = SCAN_W, h = SCAN_H; c.setTransform(SCAN_RES, 0, 0, SCAN_RES, 0, 0);
        c.fillStyle = '#0a0f13'; c.fillRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(245,181,61,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f5b53d'; c.font = 'bold 15px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText(SCAN_PAGES[scan.page].toUpperCase(), 12, 20);
        c.fillStyle = '#a0acb8'; c.font = '11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(fmtTime(S.time) + '  ▮▮▮', w - 12, 20); c.textAlign = 'left';
        var tn = SCAN_PAGES.length, tw = Math.floor((w - 24 - (tn - 1) * 3) / tn);
        for (var p = 0; p < tn; p++) { var tx = 12 + p * (tw + 3), openP = scanPageOpen(p); c.fillStyle = p === scan.page ? '#f5b53d' : openP ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; c.fillRect(tx, 28, tw, 18); c.fillStyle = p === scan.page ? '#1a1205' : openP ? '#a0acb8' : '#4a535c'; c.font = 'bold 10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(openP ? (p + 1) + ' ' + SCAN_ICONS[p] : 'L' + UNLOCK[SCAN_LVL[p]], tx + tw / 2, 41); }   // a locked page shows the level that opens it
        c.textAlign = 'left';
        var footH = 52;
        if (!scanPageOpen(scan.page)) scan.page = 0;
        if (scan.page === MAP_PAGE) { scanDev.rows = []; drawScanMap(c, 8, 54, w - 16, h - 54 - footH - 6); drawScanFoot(c, w, h, footH); scanDev.tex.needsUpdate = true; return; }
        var rows = scanPageRows(scan.page); scanDev.rows = rows; if (scan.sel >= rows.length) scan.sel = Math.max(0, rows.length - 1); if (scan.sel < 0) scan.sel = 0;
        var y0 = 56, rowH = 30, maxRows = Math.floor((h - y0 - footH - 10) / rowH);   // ten px kept for the page counter under the last row
        if (scan.sel < scan.scroll) scan.scroll = scan.sel; if (scan.sel >= scan.scroll + maxRows) scan.scroll = scan.sel - maxRows + 1; scan.scroll = clamp(scan.scroll, 0, Math.max(0, rows.length - maxRows));   // the view follows the cursor (this line sat inside a comment from 1.16.0 to 1.19.0, so long pages never scrolled)
        var y = y0;
        rows.slice(scan.scroll, scan.scroll + maxRows).forEach(function (r, i) {
          var idx = scan.scroll + i, sel = idx === scan.sel;
          c.fillStyle = sel ? 'rgba(245,181,61,0.22)' : r.hi ? 'rgba(95,211,141,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(8, y, w - 16, rowH - 3);
          if (sel) { c.fillStyle = '#f5b53d'; c.fillRect(8, y, 3, rowH - 3); }
          var x = 14; if (r.sw) { c.fillStyle = r.sw; c.fillRect(x, y + 6, 8, 14); x += 14; }
          var rightW = 0; if (r.right) { c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; rightW = c.measureText(String(r.right)).width + 8; }
          c.fillStyle = r.col || '#eef1f5'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, r.text, w - 14 - x - rightW), x, y + 11);
          var al = r.act ? '⏎ ' + r.act.label : null, actW = 0; if (al) { c.font = 'bold 9px Bahnschrift, Arial, sans-serif'; actW = c.measureText(al).width + 14; }
          if (r.sub) { c.fillStyle = '#a0acb8'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, r.sub, w - 14 - x - (r.nav ? 16 : 0) - actW), x, y + 23); }
          if (al) { var aw = actW - 4, ax = w - 14 - aw - (r.nav ? 14 : 0), off = r.act.on === false; c.fillStyle = off ? 'rgba(255,255,255,0.08)' : sel ? '#f5b53d' : 'rgba(245,181,61,0.3)'; c.fillRect(ax, y + 15, aw, 12); c.fillStyle = off ? '#6b7784' : sel ? '#1a1205' : '#eef1f5'; c.font = 'bold 9px Bahnschrift, Arial, sans-serif'; c.fillText(al, ax + 5, y + 24); }
          if (r.right) { c.fillStyle = r.hi ? '#5fd38d' : '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), w - 14, y + 11); c.textAlign = 'left'; }
          if (r.nav) { c.fillStyle = sel ? '#f5b53d' : 'rgba(255,255,255,0.25)'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('⌖', w - 14, y + 23); c.textAlign = 'left'; }
          y += rowH;
        });
        if (rows.length > maxRows) { c.fillStyle = '#6b7784'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText((scan.scroll + 1) + '-' + Math.min(rows.length, scan.scroll + maxRows) + ' of ' + rows.length + ' · wheel', w - 12, h - footH - 4); c.textAlign = 'left'; }
        drawScanFoot(c, w, h, footH);
        scanDev.tex.needsUpdate = true;
      }
    /* 13-scanner-device.js */
    function drawScanFoot(c, w, h, footH) {
        var rd = scanReadout(), fy = h - footH;
        if (rd) { c.fillStyle = 'rgba(95,211,141,0.15)'; c.fillRect(0, fy, w, footH); c.fillStyle = '#5fd38d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, '▶ ' + rd.head, w - 24), 12, fy + 16); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, rd.body, w - 24), 12, fy + 31); }
        else if (scan.nav) { var d = Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z)); c.fillStyle = 'rgba(245,181,61,0.14)'; c.fillRect(0, fy, w, footH); c.fillStyle = '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, scanArrow() + ' ' + scan.nav.label, w - 24), 12, fy + 16); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(Math.round(d) + ' m · X clears the waypoint', 12, fy + 31); }
        else { c.fillStyle = '#6b7784'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, 'Point the beam at a slot, a pallet, a parcel, a truck or a machine', w - 24), 12, fy + 16); c.fillText(scanFit(c, '1-9 pages · wheel · F waypoint on ⌖ · Enter acts on ⏎ rows', w - 24), 12, fy + 31); }
        c.fillStyle = '#6b7784'; c.font = '8px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('Tab closes', w - 12, h - 6); c.textAlign = 'left';
      }
    /* 13-scanner-device.js */
    function scanArrow() {
        if (!scan.nav) return ''; var yawTo = Math.atan2(-(scan.nav.x - player.x), -(scan.nav.z - player.z)), rel = yawTo - player.yaw; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
        var a = Math.abs(rel); return a < Math.PI / 8 ? '↑' : a < 3 * Math.PI / 8 ? (rel > 0 ? '↖' : '↗') : a < 5 * Math.PI / 8 ? (rel > 0 ? '←' : '→') : a < 7 * Math.PI / 8 ? (rel > 0 ? '↙' : '↘') : '↓';
      }
    /* 13-scanner-device.js */
    function scanSignAct(t) { return { label: 'SIGN', run: function () { var tt = truckById(t.id); if (!tt || tt.state !== 'docked' || tt.signed) { sfx('bad'); return; } signTruck(tt); var dm = truckMeshes[tt.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); } }; }
    /* 13-scanner-map.js */
    var MAP_PAGE = 8;
    /* 13-scanner-map.js */
    function mapBounds() {
        var b = { x0: -HALL.x - 16, x1: HALL.x + 16, z0: stageHas('wing') ? WING.z0 - 2 : -HALL.z - 3, z1: HALL.z + (BOOT_STAGE === 0 ? 8 : 3) };   // the hall, the wing (from the hall stage), the trucks on both aprons, the van at the shed front
        for (var h in HALLS) if (hallOwned(h) || stageHas('hallDoors')) { var H = HALLS[h]; b.x0 = Math.min(b.x0, H.x0 - (H.dockIn !== undefined ? 16 : 2)); b.x1 = Math.max(b.x1, H.x1 + 2); b.z0 = Math.min(b.z0, H.z0 - 2); }
        return b;
      }
    /* 13-scanner-map.js */
    function drawScanMap(c, x, y, w, h) {
        var b = mapBounds(), s = Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0)), ox = x + (w - (b.x1 - b.x0) * s) / 2, oz = y + (h - (b.z1 - b.z0) * s) / 2;
        var X = function (wx) { return ox + (wx - b.x0) * s; }, Z = function (wz) { return oz + (wz - b.z0) * s; };
        var rect = function (x0, x1, z0, z1, fill, stroke, dash) { c.beginPath(); c.rect(X(Math.min(x0, x1)), Z(Math.min(z0, z1)), Math.abs(x1 - x0) * s, Math.abs(z1 - z0) * s); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; if (dash) c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); } };
        var label = function (t, wx, wz, col, size, align) { c.fillStyle = col || '#a0acb8'; c.font = (size || 8) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = align || 'center'; c.fillText(t, X(wx), Z(wz)); c.textAlign = 'left'; };
        c.fillStyle = '#0f151b'; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(X(-HALL.x - 16), Z(-17), 16 * s, 14 * s); c.fillRect(X(HALL.x), Z(returnsHall() ? -37 : -25), 16 * s, (returnsHall() ? 34 : 22) * s);   // the aprons the trucks back onto (the east one reaches the returns dock once the returns hall is open)
        var FLOOR = 'rgba(120,140,160,0.13)', WALL = 'rgba(200,215,230,0.55)';
        rect(-HALL.x, HALL.x, -HALL.z, HALL.z, FLOOR, WALL);
        if (stageHas('wing')) { rect(WING.x0, WING.x1, WING.z0, WING.z1, FLOOR, WALL); label('WING', (WING.x0 + WING.x1) / 2, WING.z0 + 3.2, '#6b7784', 8); }
        for (var hk in HALLS) { var H = HALLS[hk], own = hallOwned(hk); if (!own && !stageHas('hallDoors')) continue; rect(H.x0, H.x1, H.z0, H.z1, own ? FLOOR : null, own ? WALL : 'rgba(200,215,230,0.22)', !own); label(H.name.toUpperCase(), (H.x0 + H.x1) / 2, H.z0 + 3.2, own ? '#6b7784' : '#3d4652', 8); }
        if (stageHas('rooms')) { var zs = HALL.z - 24, zn = 24 - HALL.z; rect(HALL.x - 7.5, HALL.x, 18.5 + zs, HALL.z, 'rgba(245,181,61,0.08)', 'rgba(245,181,61,0.35)'); label('OFFICE', HALL.x - 3.75, 21.8 + zs, '#f5b53d', 7);
          rect(-HALL.x, -HALL.x + 4.5, 18.5 + zs, HALL.z, null, 'rgba(200,215,230,0.3)'); label('LOBBY', -HALL.x + 2.25, 21.8 + zs, '#6b7784', 6);
          rect(-HALL.x, -HALL.x + 7, -HALL.z, -20.2 + zn, null, 'rgba(200,215,230,0.3)'); label('BREAK', -HALL.x + 3.5, -21.6 + zn, '#6b7784', 6); }
        else label('THE SHED', 0, -HALL.z - 1.2, '#6b7784', 7);
        if (upperOwned()) { rect(-HALL.x, HALL.x, UPPER.z0, UPPER.z1, 'rgba(120,189,245,0.08)', 'rgba(120,189,245,0.3)'); label(sorterOwned() ? 'SORTATION DECK' : 'MEZZANINE', 0, UPPER.z1 - 1.0, '#78bdf5', 7); }
        // the rack rows you own, lettered, and the upper row
        groundRows().forEach(function (r) { var p0 = rackSlotPos(r, 0, 0), p1 = rackSlotPos(r, rowBays(r) - 1, 0), lo = Math.min(p0.x, p1.x) - RACK.bayW / 2, hi = Math.max(p0.x, p1.x) + RACK.bayW / 2; rect(lo, hi, p0.z - RACK.depth / 2, p0.z + RACK.depth / 2, 'rgba(245,181,61,0.55)', null); label(rowLetter(r), lo - 1.0, p0.z + 1.0, '#f5b53d', 7, 'right'); });
        // the docks: a notch on the wall in the lane colour, the label, and the truck when one is in
        DOOR_MAP.forEach(function (dm, i) { var d = doors[i]; if (!d) return; var lane = dockLane(i), col = lane ? lane.col : '#f5b53d', own = doorOwned(i), wx = d.side * HALL.x;
          c.fillStyle = own ? col : 'rgba(255,255,255,0.15)'; c.fillRect(X(wx) - 2, Z(d.z - DOCKS.w / 2), 4, DOCKS.w * s); label(dockLabel(i), wx + d.side * 2.4, d.z + 1.4, own ? col : '#6b7784', 7, d.side < 0 ? 'right' : 'left');
          var t = truckAtDoor(i); if (t) { var tb = trailerBounds(t); rect(tb.x0, tb.x1, tb.z0, tb.z1, 'rgba(238,241,245,0.7)', null); var cx0 = t.x + t.side * TRAILER.len, cx1 = t.x + t.side * (TRAILER.len + 3.2); rect(cx0, cx1, t.z - 1.2, t.z + 1.2, col, null); } });
        // the things worth finding
        [['bench', 'BENCH'], ['returnsDesk', 'RETURNS'], ['retDesk1', 'RETURNS'], ['retCage', 'RESTOCK'], ['palletiser', 'PALLETISER'], ['moulder', 'MOULDER'], ['agvDock', 'AGV DOCK'], ['timeclock', 'CLOCK'], ['cot', 'COT'], ['empties', 'EMPTIES'], ['wrapper', 'WRAP'], ['baler', 'BALER'], ['desk', 'PC']].forEach(function (p) { if (!propInst[p[0]] || propPlacement(p[0]).hidden) return; var P = propPlacement(p[0]); c.fillStyle = 'rgba(238,241,245,0.5)'; c.fillRect(X(P.x) - 2, Z(P.z) - 2, 4, 4); label(p[1], P.x, P.z - 1.2, '#a0acb8', 6); });
        // the forklift, the AGV, the crew
        if (S.up.fork) { c.fillStyle = '#f5b53d'; c.fillRect(X(S.fork.x) - 3, Z(S.fork.z) - 3, 6, 6); }
        if (S.up.agv && S.agv) { c.fillStyle = '#78bdf5'; c.fillRect(X(S.agv.x) - 2.5, Z(S.agv.z) - 2.5, 5, 5); }
        S.staff.forEach(function (st) { var m = staffMeshes[st.id]; if (!m || !m.visible) return; c.fillStyle = st.state === 'break' ? '#a0acb8' : '#5fd38d'; c.beginPath(); c.arc(X(st.x), Z(st.z), 3.5, 0, 6.3); c.fill(); c.fillStyle = '#0a0f13'; c.font = 'bold 6px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(st.name.slice(0, 1), X(st.x), Z(st.z) + 2.2); c.textAlign = 'left'; });
        // the waypoint, and you
        if (scan.nav) { c.strokeStyle = '#5fd38d'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(scan.nav.x), Z(scan.nav.z), 5 + Math.sin(worldTime * 4) * 1.5, 0, 6.3); c.stroke(); }
        c.save(); c.translate(X(player.x), Z(player.z)); c.rotate(-player.yaw); c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 14, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
        // the scale bar and north
        c.fillStyle = '#6b7784'; c.fillRect(x + 10, y + h - 9, 10 * s, 1.5); c.font = '7px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText('10 m', x + 10, y + h - 12); c.textAlign = 'right'; c.fillText('N ↑', x + w - 8, y + 12); c.textAlign = 'left';
        c.fillStyle = '#5fd38d'; c.beginPath(); c.arc(x + w - 62, y + h - 8, 3, 0, 6.3); c.fill(); c.fillStyle = '#6b7784'; c.font = '7px Bahnschrift, Arial, sans-serif'; c.fillText('crew', x + w - 56, y + h - 5); c.fillStyle = '#f5b53d'; c.fillRect(x + w - 36, y + h - 11, 6, 6); c.fillStyle = '#6b7784'; c.fillText('fork', x + w - 27, y + h - 5);
      }
    /* 13-ui.js */
    var scan = { page: 0, sel: 0, scroll: 0, nav: null };
    /* 13-ui.js */
    var SCAN_PAGES = ['Home', 'Orders', 'Picks', 'Putaway', 'Stock', 'Docks', 'Plant', 'Crew', 'Map'];
    /* 13-ui.js */
    function scanToggle(on) { if (on && driving) return; ui.scanOpen = on; if (on) { sfx('scan'); introStep('scanner'); drawScanner(); } }
    /* 13-ui.js */
    var SCAN_LVL = [null, null, null, 'scanPutaway', 'scanStock', 'scanDocks', 'scanPlant', 'scanCrew', 'scanMap'];
    /* 13-ui.js */
    function scanPageOpen(i) { return !SCAN_LVL[i] || unlocked(SCAN_LVL[i]); }
    /* 13-ui.js */
    function scanPage(i) { if (!scanPageOpen(i)) { sfx('bad'); toast('The ' + SCAN_PAGES[i] + ' page comes at level ' + UNLOCK[SCAN_LVL[i]] + '.', ''); return; } scan.selBy = scan.selBy || {}; scan.selBy[scan.page] = scan.sel; scan.page = clamp(i, 0, SCAN_PAGES.length - 1); scan.sel = scan.selBy[scan.page] || 0; scan.scroll = 0; sfx('click'); drawScanner(); }
    /* 13-ui.js */
    function sw(sku) { return '<span class="sw" style="background:' + SKU[sku].col + '"></span>'; }
    /* 13-ui.js */
    function shopShows(u) { if (u.free) return false; var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0; if (rowN && rowN > RACK.rows.length) return false; return true; }
    /* 13-ui.js */
    function buyUpgrade(id) {
        var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; if (!u || !shopShows(u)) return;
        var rowN = /^row(\d)$/.test(id) ? +id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[id];
        if (owned || S.level < u.lvl || S.bank < u.price || (rowN && S.up.rows < rowN - 1) || (u.needs && !S.up[u.needs])) { sfx('bad'); return; }
        pay(-u.price, 'Bought ' + u.name);
        if (rowN) { S.up.rows = rowN; buildRack(rowN - 1); buildGantries(); } else { S.up[id] = true; if (id === 'shipbelt') { buildProp('shipBelt'); buildProp('dockLoader2'); buildProp('bay2'); } if (id === 'agv') buildProp('agvDock'); if (id === 'gantry') buildGantries(); if (id === 'upper') buildUpper(); if (id === 'sorter') buildSorter(); if (/^hall\d$/.test(id)) buildHall(id); }
        if (rowN && !edit.on) { unbakeStatic(); bakeStatic(); }   // every new row joins the bake, the fifth included
        if (id === 'lights') hallLights.forEach(function (l) { l.distance = 30; });
        toast(u.name + ' bought', 'good'); logEvent('Bought ' + u.name + ' for ' + money(u.price), 'good'); sfx('cash'); save();
      }
    /* 14-events.js */
    function newDay() {
        S.day++; S.stats.days++;
        if (stageRent()) pay(-stageRent(), 'Rent, day ' + S.day);   // the shed is rent free; the halls are not
        payStaffWages(); staffNewDay(); if (S.clockedIn) { myClock(false); logEvent('The clock ran past midnight: you were clocked out automatically'); }
        if (S.loan > 0) { var interest = Math.round(S.loan * 0.015); pay(-interest, 'Loan interest (1.5%)'); }
        if (S.insured) pay(-40, 'Insurance premium');
        closeDay();
        if (isSunday()) { toast('Sunday. The depot is closed: no trucks, no orders.', ''); logEvent('Sunday. Nothing moves today. A good day to sleep through.'); }
        for (var f in S.flags) if (/^(in|out|ret)\d+-/.test(f) && +f.replace(/^(in|out|ret)/, '').split('-')[0] < S.day - 1) delete S.flags[f];
        S.events.inspected = false; S.events.prowled = false;
        logEvent('Day ' + S.day + '. Rent and wages paid.', 'rare'); toast('Day ' + S.day, 'rare'); rebuildBoardSoon(); hudDirty = true; save();
        if (S.bank < -600) { toast('The bank is getting nervous: ' + money(S.bank), 'bad'); }
        if (S.siteDue > S.site) stageRebuild();   // the builders were in overnight
      }
    /* 14-events.js */
    function stageRebuild() {
        if (ui.rebuilding || S.siteDue <= S.site) return;
        var from = S.site, to = S.siteDue; S.site = to; stageFlags(S.up, to); ui.rebuilding = true;
        S.trucks.slice().forEach(function (t) { removeTruckMesh(t.id); }); S.trucks = []; S.pallets = S.pallets.filter(function (p) { return p.place !== 'truck'; });   // nothing rides through the rebuild
        S.flags.rebuiltFrom = from; logEvent('The builders were in: ' + stageName(from) + ' is ' + stageName(to).toLowerCase() + ' now.', 'rare'); save();
        try { sessionStorage.setItem('depotco-skip-splash', '1'); sessionStorage.setItem('depotco-autoplay', '1'); } catch (e) {}
        var fade = $('dc-fade'); if (fade) { fade.hidden = false; fade.style.opacity = '1'; fade.style.transition = 'none'; fade.innerHTML = '<div class="dc-fade-note"><b>The builders were in overnight.</b><span>' + esc(stageName(to)) + '</span></div>'; }
        sfx('fanfare'); if (ui.testing) { ui.rebuildPending = true; return; } setTimeout(function () { location.reload(); }, 2200);   // the test runner reloads the page itself
      }
    /* 14-events.js */
    function stageEarn() { var want = stageForLevel(S.level); if (want > S.siteDue) { S.siteDue = want; toast('The builders are booked: ' + stageName(want).toLowerCase() + ' in the morning. Sleep, or wait for the day roll.', 'rare'); logEvent('Level ' + S.level + ' earns ' + stageName(want).toLowerCase() + ': the builders come in at the day roll.', 'rare'); if (propInst.scaffold) buildProp('scaffold'); hudDirty = true; return true; } return false; }
    /* 14-events.js */
    function cotPrompt() { return S.time >= 17 || S.time < DAY_START || isSunday() ? 'Sleep until morning (rent and wages are due)' : 'Too early to sleep: the cot is for after 17:00'; }
    /* 14-events.js */
    function sleepNow() {
        if (!(S.time >= 17 || S.time < DAY_START || isSunday())) { toast('Too early. Come back after 17:00.', 'bad'); return; }   // a closed Sunday can be slept through at any hour
        sfx('sleep'); logEvent('Slept in the break room');
        var nightN = deckNightRun(); if (nightN) toast('Night shift: ' + nightN + ' parcel' + (nightN > 1 ? 's' : '') + ' sorted into the shipping bays overnight', 'good');
        S.trucks.slice().forEach(function (t) { if (t.state === 'docked') truckLeave(t, 'night'); });
        S.trucks.slice().forEach(function (t) { removeTruckMesh(t.id); }); S.trucks = [];
        if (S.time >= 17 && S.time < 23) prowlerCheck();   // sleeping past 23:00 is not a way round the prowler
        if (S.time >= DAY_START) { if (S.clockedIn) myClock(false); S.time = DAY_START; newDay(); } else S.time = DAY_START;   // your card is clocked out before the roll, or the shift reads 23 hours
        S.events.power = false; buff.coffeeUntil = 0; if (ui.rebuilding) return;   // the builders' fade is already up
        var fade = $('dc-fade'); fade.hidden = false; fade.style.opacity = '1'; fade.style.transition = 'none';   // a black fade, not the title card
        setTimeout(function () { fade.style.transition = 'opacity .9s'; fade.style.opacity = '0'; setTimeout(function () { fade.hidden = true; fade.style.opacity = ''; fade.style.transition = ''; }, 900); }, 400);
      }
    /* 14-events.js */
    function drinkCoffee() {
        if (S.events.power) { toast('No power.', 'bad'); return; }
        if (buff.coffeeDay === S.day && buff.coffeeUntil > S.time) { toast('You are already wired.', ''); return; }
        buff.coffeeDay = S.day; buff.coffeeUntil = S.time + 1; sfx('coffee'); toast('Coffee. Faster for an hour.', 'good');
      }
    /* 14-events.js */
    function flipBreaker() {
        if (S.events.power) { S.events.power = false; sfx('breaker'); toast('Power restored.', 'good'); logEvent('Breaker reset', 'good'); addXp(4); }
        else { sfx('click'); toast('The power is on. Leave it be.', ''); }
      }
    /* 14-events.js */
    function prowlerCheck() {
        if (S.events.prowled || !unlocked('prowler')) return; S.events.prowled = true;
        var open = doors.filter(function (d) { return S.doors[d.i] && !truckAtDoor(d.i); });
        if (!open.length) { var unl = hdoors.filter(function (d) { return (d.id === 'staff' || d.id === 'exit') && !hd(d.id).locked; }); if (unl.length && Math.random() < 0.5) { var keys2 = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys2.length) return; var key2 = pick(keys2), sku2 = S.slots[key2].sku, n2 = slotTake(key2, randi(1, 3)); S.stats.stolen = (S.stats.stolen || 0) + n2; addRep(-2); if (S.insured) { var refund2 = Math.round(n2 * SKU[sku2].val * 0.8); pay(refund2, 'Insurance payout, ' + n2 + ' boxes'); toast('Insurance paid ' + money(refund2) + ' for the loss', 'good'); } sfx('glass'); toast('Someone slipped in through ' + unl[0].label + ' and took ' + n2 + ' boxes. Lock up at night.', 'bad'); logEvent(n2 + ' boxes of ' + skuName(sku2) + ' taken through the unlocked ' + unl[0].label + '. Shift+E locks a door; the control cabinet locks them all.', 'bad'); } return; }
        var keys = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys.length) return;
        var key = pick(keys), sku = S.slots[key].sku, n = slotTake(key, randi(2, 6));
        S.stats.stolen = (S.stats.stolen || 0) + n; addRep(-3); sfx('glass');   // stolen, not refused: the two were one count until 1.16.0
        if (S.insured) { var refund = Math.round(n * SKU[sku].val * 0.8); pay(refund, 'Insurance payout, ' + n + ' boxes'); toast('Insurance paid ' + money(refund) + ' for the loss', 'good'); }
        toast('Someone walked off with ' + n + ' boxes through the open door at ' + dockLabel(open[0].i), 'bad'); logEvent(n + ' boxes of ' + skuName(sku) + ' stolen through the open door at ' + dockLabel(open[0].i) + '. Close the doors at night.', 'bad');
      }
    /* 14-events.js */
    function onLevelUp() {
        var lv = S.level, opens = levelOpens(lv), bonus = LEVEL_BONUS * lv;
        sfx('levelup'); pay(bonus, 'Level ' + lv + ' bonus');
        var what = opens.length ? opens.join('; ').replace(/^./, function (ch) { return ch.toUpperCase(); }) + '.' : 'Bigger orders and bigger loads.';
        logEvent('Level ' + lv + ': ' + money(bonus) + ' bonus. ' + what, 'rare');
        applyLevelUnlocks(lv); stageEarn(); showLevelCard(lv, opens, bonus); introStep('levelup');
        if (LADDER_TIPS[lv]) setTimeout(function () { feedPush(LADDER_TIPS[lv], 'good'); }, 1500);
        if (lv >= LEVEL_CAP) { logEvent('Level ' + LEVEL_CAP + ': the ladder is climbed. Everything the depot has is yours.', 'rare'); }
        hudDirty = true; screenDirtyAll(); if (ui.panelOpen) renderPanel();
      }
    /* 14-events.js */
    function nextLevelText() { if (S.level >= LEVEL_CAP) return 'Level ' + LEVEL_CAP + ': the top of the ladder'; var n = S.level + 1, note = LADDER_NOTES[n] || (levelOpens(n)[0] || 'more of everything'); return 'Next: level ' + n + ', ' + note; }
    /* 14-events.js */
    function showLevelCard(lv, opens, bonus) {
        if (!ui.started || S.flags.noLevelCard) return; var el = $('h-level'); if (!el) return;
        var st = stageForLevel(lv), grows = st > stageForLevel(lv - 1);
        el.innerHTML = '<div class="lv-head"><b>Level ' + lv + '</b><span>+' + money(bonus) + '</span></div>' + (grows ? '<div class="lv-stage">' + esc(STAGES[st].name) + ': the builders come in the morning</div>' : '') +
          '<ul>' + opens.filter(function (o) { return !/builders come in the morning/.test(o); }).map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' +
          (lv < LEVEL_CAP ? '<small>' + esc(nextLevelText()) + ' · any key closes</small>' : '<small>The ladder is climbed. Any key closes.</small>');
        el.hidden = false; cards['h-level'] = 18;   // the engine's card timer: any key closes it (Co Engine 41-shell)
      }
    /* 14-events.js */
    var INTRO = [
        ['door', 'This is your shed: one rack, one door, one table. Walk to the roll door <b>IN 1</b> on the west wall and press <b>E</b> on it, or on the console beside it. The first truck docks at 07:30.'],
        ['sign', 'When the truck is in and the door is up, the driver walks in and waits beside it. Press <b>E</b> on him to sign the delivery note. Nothing comes off until you do.'],
        ['unload', 'Walk into the trailer. Take a box off a pallet with <b>E</b>, or grab the pallet jack from the south wall and lift a whole pallet.'],
        ['putaway', 'Put it on the rack: look at a slot and press <b>E</b>. A slot holds 12 boxes of one line. The rack grows a bay every level until the hall.'],
        ['scanner', 'Press <b>Tab</b>. The scanner in your hand shows the orders and their slots and the pick list; its other pages unlock as you level. The wheel moves the cursor and <b>F</b> sets a waypoint on the highlighted row.'],
        ['order', 'Orders arrive from 08:30 on the board by the door and on the scanner. The clipboard on the table is your office: the shop and the crew are on it. Wait for the first order.'],
        ['pick', 'Take the boxes the order needs off the rack (<b>E</b> on the slot). One box per trip until you buy the cart at level 3.'],
        ['bench', 'Carry them to the <b>table</b> along the south wall and press E to put them down.'],
        ['pack', 'With empty hands press <b>E</b> on the table: you pack the first whole order on it by hand, four seconds a parcel. The parcel appears at the back of the table.'],
        ['load', 'Pick the parcel up and go out of the person door: the <b>van</b> parks at the shed front from 10:30 and 16:00. Press <b>E</b> at its back doors to load it.'],
        ['dispatch', 'The van leaves on its own at 12:00 and 17:30, or press <b>E</b> on the dock console to send it early. You are paid when it goes.'],
        ['levelup', 'Every parcel, pallet and box earns XP. Level 2 brings a second rack bay and the time clock; level 5 brings the hall, with proper docks and an office. The HUD says what the next level opens.']
      ];
    /* 14-events.js */
    function introStep(key) {
        if (!S.intro || S.intro.done) return;
        S.intro.did = S.intro.did || {};
        if (S.intro.did[key]) return;
        S.intro.did[key] = 1;
        var i = introIndex();
        if (i >= INTRO.length) { S.intro.done = true; pay(400, 'Intro bonus'); toast('Intro done: $400 bonus. The depot is yours.', 'rare'); logEvent('Guided intro finished. $400 bonus. Everything from here is on the ladder: the HUD says what the next level opens.', 'rare'); sfx('chime'); }
        else if (INTRO[i][0] !== key) { /* a step done out of order still counts */ }
        hudDirty = true;
      }
    /* 14-events.js */
    function introIndex() { var d = S.intro.did || {}; for (var i = 0; i < INTRO.length; i++) if (!d[INTRO[i][0]]) return i; return INTRO.length; }
    /* 14-life.js */
    var SEASONS = CAL.seasons;
    /* 14-life.js */
    var STATIONS = [
        { name: 'Depot FM', bpm: 92, wave: 'triangle', root: 220, chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], bass: [0, 0, 7, 5], hat: [1, 0, 1, 1, 1, 0, 1, 1], kick: [1, 0, 0, 0, 1, 0, 1, 0] },
        { name: 'Night Drive', bpm: 118, wave: 'sawtooth', root: 196, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], bass: [0, 0, 0, 3], hat: [1, 1, 1, 1, 1, 1, 1, 1], kick: [1, 0, 0, 0, 1, 0, 0, 0] },
        { name: 'Country 101', bpm: 104, wave: 'square', root: 247, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bass: [0, 7, 5, 7], hat: [0, 1, 0, 1, 0, 1, 0, 1], kick: [1, 0, 1, 0, 1, 0, 1, 0] }
      ];
    /* 14-life.js */
    var radio = { next: 0, step: 0, gain: null, timer: null };
    /* 14-life.js */
    function radioPrompt() { if (S.events.power) return 'The radio is off: no power'; return S.radio && S.radio.on ? 'Radio: ' + STATIONS[S.radio.station].name + ' · next station' : 'Switch the radio on'; }
    /* 14-life.js */
    function radioUse() {
        if (S.events.power) { toast('No power.', 'bad'); return; }
        if (!S.radio) S.radio = { on: false, station: 0 };
        if (!S.radio.on) { S.radio.on = true; S.radio.station = 0; } else if (S.radio.station < STATIONS.length - 1) S.radio.station++; else S.radio.on = false;
        sfx('click'); toast(S.radio.on ? '📻 ' + STATIONS[S.radio.station].name : 'Radio off', ''); audio(); radioStart();
      }
    /* 14-life.js */
    function radioStart() { if (!AC) return; if (!radio.gain) { radio.gain = AC.createGain(); radio.gain.gain.value = 0; radio.gain.connect(sfxBus); } if (!radio.timer) { radio.next = AC.currentTime + 0.1; radio.step = 0; radio.timer = setInterval(radioSchedule, 120); } }
    /* 14-life.js */
    function radioSchedule() {
        if (!AC || !S.radio || !S.radio.on || S.events.power) { if (radio.gain) radio.gain.gain.setTargetAtTime(0, AC ? AC.currentTime : 0, 0.3); return; }
        var st = STATIONS[S.radio.station], beat = 60 / st.bpm, sixteenth = beat / 4;
        while (radio.next < AC.currentTime + 0.35) {
          var t = radio.next, i = radio.step, bar = Math.floor(i / 16) % st.chords.length, chord = st.chords[bar], semi = function (n) { return st.root * Math.pow(2, n / 12); };
          if (i % 8 === 0) chord.forEach(function (n, k) { rTone(st.wave, semi(n) * (k === 2 ? 1 : 1), t, sixteenth * 7.5, 0.05, 1800); });
          if (i % 4 === 0) rTone('sine', semi(st.bass[Math.floor(i / 4) % 4] - 24), t, beat * 0.9, 0.12, 400);
          if (st.hat[i % 8]) rNoise(t, 0.03, 0.04, 6000);
          if (st.kick[i % 8]) { rTone('sine', 110, t, 0.14, 0.18, null, 40); }
          if (i % 16 === 14 && Math.random() < 0.5) rTone(st.wave, semi(chord[1] + 12), t, sixteenth * 2, 0.04, 2400);
          radio.next += sixteenth; radio.step++;
        }
      }
    /* 14-life.js */
    function rTone(type, f0, t, dur, gain, lp, f1) { var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = radio.gain; if (lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(dest); } else g.connect(dest); o.connect(g); o.start(t); o.stop(t + dur + 0.05); }
    /* 14-life.js */
    function rNoise(t, dur, gain, freq) { var len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; var g = AC.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(radio.gain); src.start(t); }
    /* 14-life.js */
    var cables = { fork: { tool: 'cable', prop: 'charger', mesh: null, plugged: function () { return !!S.fork.plugged; } } };
    /* 14-life.js */
    var CABLE_REACH = 8;
    /* 14-life.js */
    function cablePrompt(k) { var cb = cables[k], name = k === 'fork' ? 'forklift' : 'jack'; if (player.tool === cb.tool) return 'Hang the ' + name + ' cable back on the reel'; if (cb.plugged()) return 'Unplug the ' + name + ' (E)'; if (player.tool || S.hand) return 'Hands full'; return 'Take the ' + name + ' charging cable'; }
    /* 14-life.js */
    function cableUse(k) {
        var cb = cables[k], name = k === 'fork' ? 'forklift' : 'jack';
        if (player.tool === cb.tool) { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; }
        if (cb.plugged()) { S.fork.plugged = false; sfx('click'); toast(name.charAt(0).toUpperCase() + name.slice(1) + ' unplugged', ''); screenDirtyAll(); hudDirty = true; return; }
        if (player.tool || S.hand || driving) { toast('Hands full.', 'bad'); return; }
        player.tool = cb.tool; sfx('pickup'); toast('Carrying the cable · E on the ' + name + ' plugs it in · it reaches ' + CABLE_REACH + ' m', ''); hudDirty = true;
      }
    /* 14-life.js */
    function forkCharging() { return !!S.up.fork && !driving && !staffDriving() && !!S.fork.plugged && S.fork.batt < 1; }
    /* 14-life.js */
    var wrapper = { t: 0, pallet: null };
    /* 14-life.js */
    function wrapperBusy() { return wrapper.t > 0; }
    /* 14-life.js */
    function wrapperTarget() { var p = isJack(player.tool) ? jackPallet() : null; if (p) return p; var P = PROPS.wrapper ? propPlacement('wrapper') : null; if (!P) return null; var best = null, bd = 1.3 * 1.3; S.pallets.forEach(function (q) { if (q.place !== 'floor') return; var d = dist2(q.x, q.z, P.x, P.z); if (d < bd) { bd = d; best = q; } }); return best; }
    /* 14-life.js */
    function wrapperPrompt() {
        if (wrapperBusy()) return 'Wrapping… ' + Math.ceil(wrapper.t) + ' s';
        if (S.events.power) return 'The wrapper is off: no power';
        if (S.wrap && S.wrap.film <= 0) return 'The film roll is finished: fit a new one on the screen';
        var p = wrapperTarget(); if (p) return p.wrapped ? 'That pallet is already wrapped' : 'Wrap the pallet' + (p.place === 'floor' ? ' on the turntable' : '');
        return 'Stretch wrapper · set a pallet on the turntable, or bring one on the jack';
      }
    /* 14-life.js */
    function wrapperUse() {
        if (wrapperBusy() || S.events.power) return;
        var p = wrapperTarget(); if (!p || p.wrapped) { sfx('bad'); return; }
        if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 }; if (S.wrap.film <= 0) { toast('The film roll is finished. Fit a new one on the wrapper screen.', 'bad'); sfx('bad'); return; }
        S.wrap.film--; S.wrap.wrapped++; wrapper.t = 5; wrapper.pallet = p.id; sfx('hydraulic'); addXp(3); screenDirtyAll();
      }
    /* 14-report.js */
    var DAY_KEEP = 14, reportT = 0;
    /* 14-report.js */
    function daySnapshot() { return { day: S.day, earned: S.stats.earned, spent: S.stats.spent, shipped: S.stats.shipped, late: S.stats.late, received: S.stats.received, picked: S.stats.picked, putaway: S.stats.putaway, returns: S.stats.returns || 0, fines: S.stats.fines, misrouted: S.stats.misrouted || 0, lost: S.stats.lost, rep: S.rep, bank: S.bank }; }
    /* 14-report.js */
    function closeDay() {   // from newDay, after the morning charges, with S.day already the new day
        var a = S.dayStart;
        if (a) {
          var r = { day: a.day, earned: S.stats.earned - a.earned, spent: S.stats.spent - a.spent, shipped: S.stats.shipped - a.shipped, late: S.stats.late - a.late, received: S.stats.received - a.received, picked: S.stats.picked - a.picked, putaway: S.stats.putaway - a.putaway, returns: (S.stats.returns || 0) - a.returns, fines: S.stats.fines - a.fines, misrouted: (S.stats.misrouted || 0) - a.misrouted, lost: S.stats.lost - a.lost, rep: Math.round((S.rep - a.rep) * 10) / 10, bank: S.bank };
          r.net = r.earned - r.spent; if (!S.days) S.days = []; S.days.unshift(r); if (S.days.length > DAY_KEEP) S.days.pop();
          showDayReport(r);
        }
        S.dayStart = daySnapshot();
      }
    /* 14-report.js */
    function showDayReport(r) {
        logEvent('Day ' + r.day + ' closed: ' + money(r.earned) + ' in, ' + money(r.spent) + ' out, ' + r.shipped + ' shipped' + (r.late ? ' (' + r.late + ' late)' : '') + ', ' + r.received + ' pallets in', r.net >= 0 ? 'good' : 'bad');
        if (!ui.started) return; var el = $('h-report'); if (!el) return;
        var sign = function (n) { return (n >= 0 ? '+' : '') + n; };
        el.innerHTML = '<div class="rep-head"><b>Day ' + r.day + ' report</b><span class="' + (r.net >= 0 ? 'good' : 'bad') + '">' + (r.net >= 0 ? '+' : '') + money(r.net) + '</span></div>' +
          '<div class="rep-grid">' + [['Earned', money(r.earned)], ['Spent', money(r.spent)], ['Shipped', r.shipped + (r.late ? ' (' + r.late + ' late)' : '')], ['Pallets in', String(r.received)], ['Picked', r.picked + ' boxes'], ['Returns', String(r.returns)], ['Rep', sign(r.rep)], ['Bank', money(r.bank)]].map(function (k) { return '<i>' + k[0] + '</i><em>' + esc(k[1]) + '</em>'; }).join('') + '</div>' +
          '<small>Any key closes · the Stats app keeps a fortnight</small>';
        el.hidden = false; cards['h-report'] = 20;   // the engine's card timer: any key closes it
      }
    /* 14-report.js */
    function reportRows() { return (S.days || []).slice(0, 7).map(function (r) { return { text: 'Day ' + r.day + '  ·  ' + r.shipped + ' shipped' + (r.late ? ' (' + r.late + ' late)' : '') + ' · ' + r.received + ' pallets in' + (r.returns ? ' · ' + r.returns + ' returns' : ''), sub: money(r.earned) + ' in, ' + money(r.spent) + ' out · rep ' + (r.rep >= 0 ? '+' : '') + r.rep + ' · bank ' + money(r.bank), right: (r.net >= 0 ? '+' : '') + money(r.net), rcol: r.net >= 0 ? '#5fd38d' : '#ff6b5e' }; }); }
    // after the carried code: what the props expect the game to have set up
    if (typeof Proxy !== 'undefined') MACH = new Proxy(MACH || {}, { get: function (t, k) { if (typeof k === 'string' && !(k in t)) t[k] = {}; return t[k]; } });   // the machines' records fill as their props build
    RACK.bays = 4; RACK.x0 = -RACK.bays * RACK.bayW / 2;   // a rack row in the pack is four bays, centred on its own spot, not a hall's length
    // the definitions, each in a guard: one that cannot build here is left out rather than breaking the pack
    try {
      for (var rr = 0; rr < RACK.rows.length; rr++) (function (r) { defProp('rack' + r, { label: 'rack row ' + 'ABCDEF'[r], cat: 'hall', abs: true, keep: true, shed: true, x: 0, z: RACK.rows[r], rot: 0, build: rackBuild(r), when: function () { return r < S.up.rows; } }); })(rr);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: rack: " + e.message); }
    try {
      defProp('timeclock', { label: 'time clock', cat: 'wall', wall: true, lvl: UNLOCK.clock, x: -19.74, z: 10.6, rot: 1, at: { 0: { x: -6.74, z: 4.55, rot: 1 } }, build: timeclockBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: timeclock: " + e.message); }
    try {
      defProp('cabinet', { label: 'control cabinet', cat: 'wall', wall: true, x: 12.42, z: 12.6, rot: 3, build: cabinetBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cabinet: " + e.message); }
    try {
      defProp('consoleIn0', { label: 'dock console IN 1', cat: 'wall', wall: true, abs: true, x: -29.7, z: -11.5, rot: 1, at: { 0: { x: -6.7, z: 2.4, rot: 1 }, 1: { x: -19.7, z: -5.5, rot: 1 } }, build: consoleBuild(0) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: consoleIn0: " + e.message); }
    try {
      defProp('console0', { label: 'dock console OUT 1', cat: 'wall', wall: true, abs: true, stage: 1, x: 29.7, z: -9.6, rot: 3, at: { 1: { x: 19.7, z: -5.5, rot: 3 } }, build: consoleBuild(2) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: console0: " + e.message); }
    try {
      defProp('breaker', { label: 'breaker panel', cat: 'wall', wall: true, stage: 1, x: 19.79, z: 9.6, rot: 3, build: breakerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: breaker: " + e.message); }
    try {
      defProp('board', { label: 'order board', cat: 'hall', x: 16.2, z: 7.4, rot: 2, at: { 0: { x: 6.75, z: -0.6, rot: 3 } }, build: boardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: board: " + e.message); }
    try {
      defProp('charger', { label: 'forklift charging point', cat: 'wall', wall: true, stage: 1, x: 0, z: 13.83, rot: 2, build: chargerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: charger: " + e.message); }
    try {
      defProp('painted', { label: 'painted name', cat: 'wall', wall: true, abs: true, keep: true, stage: 1, x: 28.5, z: -23.83, rot: 0, build: paintedBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: painted: " + e.message); }
    try {
      [[-30, -12], [-30, 10], [30, -15.5], [30, 10]].forEach(function (p, i) { defProp('lamp' + i, { label: 'lamp post', cat: 'yard', yard: true, x: p[0], z: p[1], rot: 0, at: i === 0 ? { 0: { x: -12, z: 10, rot: 0 } } : i === 2 ? { 0: { x: 12, z: -8, rot: 0 } } : null, build: lampPostBuild }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lamp: " + e.message); }
    try {
      [0, 1, 3, 4].forEach(function (k, i) { defProp('car' + i, { label: 'parked car', cat: 'yard', yard: true, abs: true, keep: true, stage: 2, x: -27.65 + k * 2.7, z: 31.5, rot: 1, build: carBuild(k) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: car: " + e.message); }
    try {
      defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: -30, z: 24, rot: 0, at: { 0: { x: -14, z: 12, rot: 0 } }, build: treeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: tree: " + e.message); }
    try {
      defProp('xLampPost', { extra: true, label: 'lamp post', ico: '💡', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 350, desc: 'Lights the yard at night.', build: lampPostBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xLampPost: " + e.message); }
    try {
      defProp('xCar', { extra: true, label: 'parked car', ico: '🚗', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 0, desc: 'Somebody is in.', build: function (c, P, inst) { carBuild(CAR_COLS[Math.floor(propSeed(inst ? inst.id : 'car', 1) * CAR_COLS.length)])(c); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCar: " + e.message); }
    try {
      defProp('xAisleSign', { extra: true, lvl: UNLOCK.build, label: 'aisle sign', ico: '🪧', cat: 'hall', price: 40, desc: 'Hangs from the roof.', build: aisleSignBuild('AISLE') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xAisleSign: " + e.message); }
    try {
      defProp('lockers', { label: 'lockers', cat: 'room', x: -18.4, z: 13.55, rot: 2, build: lockerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lockers: " + e.message); }
    try {
      defProp('hooks', { label: 'coat hooks', cat: 'room', wall: true, x: -16.6, z: 13.83, rot: 2, build: hooksBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: hooks: " + e.message); }
    try {
      defProp('notice', { label: 'notice board', cat: 'wall', wall: true, x: -17.5, z: 8.59, rot: 0, build: noticeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: notice: " + e.message); }
    try {
      defProp('firstAid', { label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: -25.6, z: 22.9, rot: 3, at: { 0: { x: 6.75, z: 1.6, rot: 3 } }, build: firstAidBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: firstAid: " + e.message); }
    try {
      defProp('extBreak', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: 13.2, rot: 1, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extBreak: " + e.message); }
    try {
      defProp('posterRota', { label: 'rota poster', cat: 'wall', wall: true, x: -19.83, z: 9.2, rot: 1, build: posterBuild('rota', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterRota: " + e.message); }
    try {
      defProp('posterSmoke', { label: 'no-smoking poster', cat: 'wall', wall: true, x: -15.6, z: 11.0, rot: 3, build: posterBuild('nosmoking', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterSmoke: " + e.message); }
    try {
      defProp('lobbySeat', { label: 'bench seat', cat: 'room', x: -17.8, z: 9.1, rot: 2, build: benchSeatBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lobbySeat: " + e.message); }
    try {
      defProp('cot', { label: 'cot', cat: 'room', x: -15.0, z: -13.3, rot: 0, at: { 0: { x: -5.5, z: 4.45, rot: 0 } }, build: cotBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cot: " + e.message); }
    try {
      defProp('vending', { label: 'vending machine', cat: 'room', x: -13.6, z: -11.4, rot: 3, build: vendingBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: vending: " + e.message); }
    try {
      defProp('coffee', { label: 'coffee counter', cat: 'room', x: -19.5, z: -12.2, rot: 1, build: coffeeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: coffee: " + e.message); }
    try {
      defProp('fridge', { label: 'fridge', cat: 'room', x: -19.5, z: -13.5, rot: 1, build: fridgeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: fridge: " + e.message); }
    try {
      defProp('cooler', { label: 'water cooler', cat: 'room', x: -19.6, z: -10.7, rot: 1, build: coolerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cooler: " + e.message); }
    try {
      defProp('table', { label: 'table', cat: 'room', x: -16.6, z: -11.6, rot: 0, build: tableBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: table: " + e.message); }
    try {
      defProp('chair1', { label: 'chair', cat: 'room', x: -17.35, z: -11.6, rot: 1, build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chair1: " + e.message); }
    try {
      defProp('chair2', { label: 'chair', cat: 'room', x: -15.85, z: -11.6, rot: 3, build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chair2: " + e.message); }
    try {
      defProp('chair3', { label: 'chair', cat: 'room', x: -16.6, z: -12.35, rot: 0, build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chair3: " + e.message); }
    try {
      defProp('calendar', { label: 'calendar', cat: 'wall', wall: true, x: -17.6, z: -13.83, rot: 0, build: calendarBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: calendar: " + e.message); }
    try {
      defProp('clockBreak', { label: 'wall clock', cat: 'wall', wall: true, x: -18.4, z: -13.83, rot: 0, build: clockBuild(0.28) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: clockBreak: " + e.message); }
    try {
      defProp('posterHands', { label: 'wash-hands poster', cat: 'wall', wall: true, x: -16.5, z: -13.83, rot: 0, build: posterBuild('hands', 0.5, 0.75) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterHands: " + e.message); }
    try {
      defProp('plantBreak', { label: 'potted plant', cat: 'room', x: -13.5, z: -13.5, rot: 0, build: plantBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: plantBreak: " + e.message); }
    try {
      defProp('desk', { label: 'office desk', cat: 'room', x: 17.5, z: 12.4, rot: 0, build: deskBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: desk: " + e.message); }
    try {
      defProp('officeChair', { label: 'office chair', cat: 'room', x: 17.5, z: 11.6, rot: 0, build: officeChairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: officeChair: " + e.message); }
    try {
      defProp('cabinets', { label: 'filing cabinets', cat: 'room', x: 19.3, z: 13.5, rot: 2, build: cabinetsBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: cabinets: " + e.message); }
    try {
      defProp('plant', { label: 'potted plant', cat: 'room', x: 13.2, z: 13.4, rot: 0, build: plantBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: plant: " + e.message); }
    try {
      defProp('coatStand', { label: 'coat stand', cat: 'room', x: 13.0, z: 9.0, rot: 0, build: coatStandBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: coatStand: " + e.message); }
    try {
      defProp('kpi', { label: 'whiteboard', cat: 'wall', wall: true, x: 19.83, z: 11.5, rot: 3, build: kpiBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: kpi: " + e.message); }
    try {
      defProp('certificate', { label: 'certificate', cat: 'wall', wall: true, x: 19.83, z: 13.3, rot: 3, build: certificateBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: certificate: " + e.message); }
    try {
      defProp('posterSafety', { label: 'safety poster', cat: 'wall', wall: true, x: 16.5, z: 13.83, rot: 2, build: posterBuild('safety', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterSafety: " + e.message); }
    try {
      defProp('bench', { label: 'packing bench', cat: 'hall', x: 16.6, z: 5.2, rot: 0, at: { 0: { x: 4.6, z: 2.6, rot: 0 }, 1: { x: 16.6, z: -2.2, rot: 0 } }, build: benchBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: bench: " + e.message); }
    try {
      defProp('flask', { label: 'coffee flask', cat: 'hall', abs: true, keep: true, lvl: 4, x: 5.3, z: 2.55, rot: 0, at: { 0: { x: 5.3, z: 2.55, rot: 0 } }, build: flaskBuild, when: function () { return BOOT_STAGE === 0; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: flask: " + e.message); }
    try {
      defProp('binDamaged', { label: 'damaged-goods bin', cat: 'hall', x: 13.3, z: 2.4, rot: 0, at: { 0: { x: 6.3, z: 4.3, rot: 0 } }, build: binBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: binDamaged: " + e.message); }
    try {
      defProp('broom', { label: 'broom', cat: 'hall', x: 13.0, z: 3.0, rot: 0, build: broomBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: broom: " + e.message); }
    try {
      defProp('wetFloor', { label: 'wet-floor sign', cat: 'hall', x: 13.4, z: 7.6, rot: 1, build: wetFloorBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: wetFloor: " + e.message); }
    try {
      defProp('empties', { label: 'stack of empty pallets', cat: 'hall', abs: true, keep: true, x: -12.5, z: -21.0, rot: 0, at: { 0: { x: -0.5, z: 4.3, rot: 0 } }, build: emptiesBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: empties: " + e.message); }
    try {
      defProp('baler', { label: 'baler', cat: 'hall', stage: 1, x: -7.5, z: -13.2, rot: 0, build: balerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: baler: " + e.message); }
    try {
      defProp('wrapper', { label: 'stretch wrapper', cat: 'hall', abs: true, stage: 1, x: 14, z: -22.3, rot: 0, at: { 1: { x: 9.5, z: -12.3, rot: 0 } }, build: wrapperBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: wrapper: " + e.message); }
    try {
      defProp('hose', { label: 'hose reel', cat: 'wall', wall: true, abs: true, x: -10.5, z: -23.83, rot: 0, build: hoseBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: hose: " + e.message); }
    try {
      defProp('extNW', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: -11.2, rot: 1, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extNW: " + e.message); }
    try {
      defProp('extNE', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 35.83, z: -16.4, rot: 3, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extNE: " + e.message); }
    try {
      defProp('extBench', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 29.83, z: 16.5, rot: 3, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extBench: " + e.message); }
    try {
      defProp('clockHall', { label: 'hall clock', cat: 'wall', wall: true, abs: true, x: 12, z: -23.7, rot: 0, at: { 0: { x: 6.75, z: -3.4, rot: 3 } }, build: function (c) { var f = clockBuild(0.5); f(c); c.group.children[c.group.children.length - 1].position.y = BOOT_STAGE === 0 ? 3.4 : 5.8 - 2.7 + 2.7; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: clockHall: " + e.message); }
    try {
      defProp('posterLift', { label: 'lifting poster', cat: 'wall', wall: true, abs: true, x: -29.83, z: 2, rot: 1, build: posterBuild('lifting', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterLift: " + e.message); }
    try {
      defProp('posterFork', { label: 'forklift poster', cat: 'wall', wall: true, x: 2.2, z: 13.83, rot: 2, build: posterBuild('forklift', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterFork: " + e.message); }
    try {
      defProp('posterStack', { label: 'pallet-rules poster', cat: 'wall', wall: true, x: -6, z: 13.83, rot: 2, build: posterBuild('stacking', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterStack: " + e.message); }
    try {
      defProp('posterOffice', { label: 'safety poster', cat: 'wall', wall: true, x: 12.42, z: 11.5, rot: 3, build: posterBuild('safety', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterOffice: " + e.message); }
    try {
      defProp('posterExit', { label: 'fire-exit poster', cat: 'wall', wall: true, x: 15.2, z: -13.83, rot: 0, build: posterBuild('exit', 0.6, 0.9) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterExit: " + e.message); }
    try {
      defProp('shelter', { label: 'smoking shelter', cat: 'yard', yard: true, stage: 1, x: -22.5, z: 19, rot: 0, build: shelterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: shelter: " + e.message); }
    try {
      defProp('dumpster', { label: 'dumpster', cat: 'yard', yard: true, x: 24, z: 18, rot: 0, at: { 0: { x: 9.6, z: 6.4, rot: 0 } }, build: dumpsterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dumpster: " + e.message); }
    try {
      defProp('flag', { label: 'flag pole', cat: 'yard', yard: true, stage: 1, x: 10, z: 19, rot: 0, build: flagBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: flag: " + e.message); }
    try {
      defProp('parkingSign', { label: 'parking sign', cat: 'yard', yard: true, stage: 2, x: -2, z: 18.5, rot: 0, build: parkingSignBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: parkingSign: " + e.message); }
    try {
      defProp('xChair', { extra: true, lvl: UNLOCK.build, label: 'chair', ico: '🪑', cat: 'room', price: 25, desc: 'A canteen chair.', build: chairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xChair: " + e.message); }
    try {
      defProp('xTable', { extra: true, lvl: UNLOCK.build, label: 'table', ico: '🪵', cat: 'room', price: 60, desc: 'A square canteen table.', build: tableBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xTable: " + e.message); }
    try {
      defProp('xLockers', { extra: true, lvl: UNLOCK.build, label: 'lockers', ico: '🗄️', cat: 'room', price: 120, desc: 'Two more lockers.', build: lockerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xLockers: " + e.message); }
    try {
      defProp('xPlant', { extra: true, lvl: UNLOCK.build, label: 'potted plant', ico: '🌿', cat: 'room', price: 40, desc: 'Something green.', build: plantBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPlant: " + e.message); }
    try {
      defProp('xCooler', { extra: true, lvl: UNLOCK.build, label: 'water cooler', ico: '🥤', cat: 'room', price: 90, desc: 'Another cooler.', build: coolerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCooler: " + e.message); }
    try {
      defProp('xCot', { extra: true, lvl: UNLOCK.build, label: 'cot', ico: '🛏️', cat: 'room', price: 150, desc: 'A second place to sleep.', build: cotBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCot: " + e.message); }
    try {
      defProp('xOfficeChair', { extra: true, lvl: UNLOCK.build, label: 'office chair', ico: '💺', cat: 'room', price: 80, desc: 'Swivels.', build: officeChairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xOfficeChair: " + e.message); }
    try {
      defProp('xCabinets', { extra: true, lvl: UNLOCK.build, label: 'filing cabinets', ico: '🗂️', cat: 'room', price: 110, desc: 'Paperwork storage.', build: cabinetsBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xCabinets: " + e.message); }
    try {
      defProp('xBin', { extra: true, lvl: UNLOCK.build, label: 'wheelie bin', ico: '🗑️', cat: 'hall', price: 20, desc: 'Takes damaged boxes too.', build: binBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBin: " + e.message); }
    try {
      defProp('xWetFloor', { extra: true, lvl: UNLOCK.build, label: 'wet-floor sign', ico: '⚠️', cat: 'hall', price: 10, desc: 'For appearances.', build: wetFloorBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xWetFloor: " + e.message); }
    try {
      defProp('xEmpties', { extra: true, lvl: UNLOCK.build, label: 'stack of empty pallets', ico: '🪵', cat: 'hall', price: 0, desc: 'Dressing.', build: emptiesBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xEmpties: " + e.message); }
    try {
      defProp('xBollard', { extra: true, lvl: UNLOCK.build, label: 'bollard', ico: '🟡', cat: 'hall', price: 30, desc: 'Guards a corner.', build: bollardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBollard: " + e.message); }
    try {
      defProp('xExt', { extra: true, lvl: UNLOCK.build, label: 'fire extinguisher', ico: '🧯', cat: 'wall', wall: true, price: 60, desc: 'On the wall.', build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xExt: " + e.message); }
    try {
      defProp('xClock', { extra: true, lvl: UNLOCK.build, label: 'wall clock', ico: '🕒', cat: 'wall', wall: true, price: 25, desc: 'Keeps game time.', build: clockBuild(0.32) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xClock: " + e.message); }
    try {
      defProp('xNotice', { extra: true, lvl: UNLOCK.build, label: 'notice board', ico: '📌', cat: 'wall', wall: true, price: 30, desc: 'Cork and pins.', build: noticeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xNotice: " + e.message); }
    try {
      POSTER_KINDS.forEach(function (k) { defProp('xPoster_' + k, { extra: true, lvl: UNLOCK.build, label: k + ' poster', ico: '🖼️', cat: 'wall', wall: true, price: 15, desc: 'Framed.', build: posterBuild(k, 0.6, 0.9) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPoster_: " + e.message); }
    try {
      defProp('xFirstAid', { extra: true, lvl: UNLOCK.build, label: 'first-aid box', ico: '🩹', cat: 'wall', wall: true, price: 35, desc: 'The inspector likes one.', build: firstAidBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xFirstAid: " + e.message); }
    try {
      defProp('xTree', { extra: true, label: 'tree', ico: '🌳', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 80, desc: 'For the yard.', build: treeBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xTree: " + e.message); }
    try {
      defProp('xBenchSeat', { extra: true, label: 'bench seat', ico: '🪑', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 70, desc: 'Slatted.', build: benchSeatBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBenchSeat: " + e.message); }
    try {
      defProp('xYardBollard', { extra: true, label: 'bollard', ico: '🟡', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 30, desc: 'Yellow steel.', build: bollardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xYardBollard: " + e.message); }
    try {
      defProp('xShelter', { extra: true, label: 'smoking shelter', ico: '🚬', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 400, desc: 'Roof and a bench.', build: shelterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xShelter: " + e.message); }
    try {
      defProp('xDumpster', { extra: true, label: 'dumpster', ico: '♻️', cat: 'yard', yard: true, lvl: UNLOCK.yardCat, price: 150, desc: 'Cardboard only.', build: dumpsterBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xDumpster: " + e.message); }
    try {
      Object.keys(BELT_PIECES).forEach(function (k) { var bp = BELT_PIECES[k]; defProp('x' + k.charAt(0).toUpperCase() + k.slice(1), { extra: true, label: bp.label, ico: bp.ico, cat: 'belt', lvl: /^beltS|^beltC/.test(k) ? UNLOCK.beltsA : UNLOCK.beltsB, price: bp.price, desc: bp.desc, beltPath: bp.path, build: beltPieceBuild(k) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: x: " + e.message); }
    try {
      defProp('packline', { label: 'pack line', cat: 'hall', abs: true, stage: 1, x: 26.6, z: 7.2, rot: 0, at: { 1: { x: 16.6, z: -0.2, rot: 0 } }, build: packLineBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: packline: " + e.message); }
    try {
      defProp('moulder', { stage: 2, label: 'moulding line', cat: 'factory', abs: true, x: -4, z: -37, rot: 0, build: moulderBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: moulder: " + e.message); }
    try {
      defProp('beltMain', { stage: 2, label: 'main belt', cat: 'factory', abs: true, x: -4, z: -32.5, rot: 0, build: beltMainBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: beltMain: " + e.message); }
    try {
      defProp('palletiser', { stage: 2, label: 'palletiser', cat: 'hall', abs: true, x: -4, z: -20.6, rot: 0, build: palletiserBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: palletiser: " + e.message); }
    try {
      defProp('hopper', { stage: 2, label: 'raw hopper', cat: 'factory', abs: true, x: -9.5, z: -37, rot: 0, build: hopperBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: hopper: " + e.message); }
    try {
      defProp('dockLoader2', { label: 'dock loader OUT 2', cat: 'hall', abs: true, stage: 1, x: 28.6, z: -5.9, rot: 0, at: { 1: { x: 18.6, z: -7.9, rot: 0 } }, build: dockLoaderBuild, when: function () { return !!S.up.shipbelt || !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dockLoader2: " + e.message); }
    try {
      defProp('dockLoader1', { label: 'dock loader OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, stage: 3, x: 34.6, z: -13.9, rot: 0, build: dockLoaderBuildFor('dockLoader1', 'OUT 1', false), when: function () { return !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dockLoader1: " + e.message); }
    try {
      defProp('dockLoader3', { label: 'dock loader OUT 3', cat: 'hall', abs: true, keep: true, fixed: true, stage: 3, x: 34.6, z: -21.4, rot: 0, build: dockLoaderBuildFor('dockLoader3', 'OUT 3', false), when: function () { return !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dockLoader3: " + e.message); }
    try {
      defProp('agvDock', { label: 'AGV dock', cat: 'hall', abs: true, stage: 2, x: -26.5, z: -5.5, rot: 0, build: agvDockBuild, when: function () { return !!S.up.agv; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: agvDock: " + e.message); }
    try {
      for (var gr2 = 0; gr2 < RACK.rows.length; gr2++) (function (r) { defProp('gantry' + r, { label: 'gantry picker ' + 'ABCDE'[r], cat: 'hall', abs: true, stage: 2, x: -24, z: RACK.rows[r], rot: 0, build: gantryBuild(r), when: function () { return !!S.up.gantry && r < S.up.rows; } }); })(gr2);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: gantry: " + e.message); }
    try {
      defProp('silo', { stage: 2, label: 'silo', cat: 'yard', yard: true, abs: true, x: -17.5, z: -34, rot: 0, build: siloBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: silo: " + e.message); }
    try {
      defProp('extWing', { stage: 2, label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 9.83, z: -30, rot: 3, build: extinguisherBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: extWing: " + e.message); }
    try {
      defProp('qcBench', { stage: 2, label: 'quality bench', cat: 'factory', abs: true, x: 6.5, z: -29, rot: 2, build: qcBenchBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: qcBench: " + e.message); }
    try {
      defProp('workbench', { stage: 2, label: 'maintenance bench', cat: 'factory', abs: true, x: -12.8, z: -27.5, rot: 1, build: workbenchBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: workbench: " + e.message); }
    try {
      defProp('toolCab', { stage: 2, label: 'tool cabinet', cat: 'factory', abs: true, x: -13.2, z: -25.4, rot: 1, build: toolCabBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: toolCab: " + e.message); }
    try {
      defProp('mouldRack', { stage: 2, label: 'mould store', cat: 'factory', abs: true, x: 2.5, z: -43.2, rot: 0, build: mouldRackBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: mouldRack: " + e.message); }
    try {
      defProp('partsShelf', { stage: 2, label: 'spares shelf', cat: 'factory', abs: true, x: -1.0, z: -43.3, rot: 0, build: partsShelfBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: partsShelf: " + e.message); }
    try {
      defProp('chiller', { stage: 2, label: 'chiller', cat: 'factory', abs: true, x: -11.5, z: -42.5, rot: 0, build: chillerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: chiller: " + e.message); }
    try {
      defProp('dryer', { stage: 2, label: 'granulate dryer', cat: 'factory', abs: true, x: -6.0, z: -42.8, rot: 0, build: dryerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dryer: " + e.message); }
    try {
      defProp('switchboard', { stage: 2, label: 'switchboard', cat: 'wall', wall: true, abs: true, x: 9.8, z: -41, rot: 3, build: switchboardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: switchboard: " + e.message); }
    try {
      defProp('shiftBoard', { stage: 2, label: 'shift board', cat: 'wall', wall: true, abs: true, x: 9.83, z: -33, rot: 3, build: shiftBoardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: shiftBoard: " + e.message); }
    try {
      defProp('clockWing', { stage: 2, label: 'wing clock', cat: 'wall', wall: true, abs: true, x: 9.83, z: -27, rot: 3, build: function (c) { var f = clockBuild(0.4); f(c); c.group.children[c.group.children.length - 1].position.y = 3.6; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: clockWing: " + e.message); }
    try {
      defProp('firstAidWing', { stage: 2, label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: 9.83, z: -25.5, rot: 3, build: firstAidBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: firstAidWing: " + e.message); }
    try {
      defProp('signStaff', { label: 'sign: STAFF', cat: 'wall', wall: true, abs: true, stage: 1, x: -30.17, z: 22, rot: 3, build: wallSignBuild(['STAFF'], 1.2, 0.4, 3.75, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signStaff: " + e.message); }
    try {
      defProp('signFront', { label: 'sign: DEPOT CO. (front)', cat: 'wall', wall: true, abs: true, stage: 1, x: 0, z: 24.17, rot: 0, build: function (c) { c.sign(['DEPOT CO.'], 12, 2.6, 0, 5, 0.01, 0, { w: 1024, h: 224, bg: '#1b232c', fg: '#f5b53d', border: '#f5b53d' }); c.sign(['3PL · STORAGE · FULFILMENT'], 10, 0.8, 0, 3.2, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' }); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signFront: " + e.message); }
    try {
      defProp('signOffice', { label: 'sign: OFFICE', cat: 'wall', wall: true, abs: true, stage: 1, x: 22.41, z: 19.95, rot: 3, build: wallSignBuild(['OFFICE'], 1.4, 0.45, 2.6, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signOffice: " + e.message); }
    try {
      defProp('signLobby', { label: 'sign: LOBBY', cat: 'wall', wall: true, abs: true, stage: 1, x: -25.41, z: 19.95, rot: 1, build: wallSignBuild(['LOBBY'], 1.2, 0.45, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signLobby: " + e.message); }
    try {
      defProp('signBreak', { label: 'sign: BREAK ROOM', cat: 'wall', wall: true, abs: true, stage: 1, x: -22.91, z: -22.45, rot: 1, build: wallSignBuild(['BREAK ROOM'], 1.6, 0.45, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signBreak: " + e.message); }
    try {
      defProp('exitNorth', { keep: true, stage: 1, label: 'exit sign (fire exit)', cat: 'wall', wall: true, abs: true, x: 23.5, z: -23.8, rot: 0, build: exitSignBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: exitNorth: " + e.message); }
    try {
      defProp('exitStaff', { label: 'exit sign (staff door)', cat: 'wall', wall: true, abs: true, stage: 1, x: -29.8, z: 22, rot: 1, build: exitSignBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: exitStaff: " + e.message); }
    try {
      defProp('signPacking', { label: 'sign: PACKING', cat: 'wall', wall: true, abs: true, stage: 1, x: 29.83, z: 5.2, rot: 3, at: { 1: { x: 19.83, z: -2.2, rot: 3 } }, build: wallSignBuild(['PACKING'], 1.8, 0.5, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signPacking: " + e.message); }
    try {
      defProp('signProduction', { stage: 2, label: 'sign: PRODUCTION', cat: 'wall', wall: true, abs: true, x: 5.8, z: -23.83, rot: 0, build: wallSignBuild(['PRODUCTION'], 2.6, 0.6, 4.9, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signProduction: " + e.message); }
    try {
      defProp('signWarehouse', { stage: 2, label: 'sign: WAREHOUSE', cat: 'wall', wall: true, abs: true, x: 5.8, z: -24.17, rot: 2, build: wallSignBuild(['WAREHOUSE'], 2.6, 0.6, 4.9, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signWarehouse: " + e.message); }
    try {
      defProp('signPpe', { stage: 2, label: 'sign: PPE', cat: 'wall', wall: true, abs: true, x: 2.5, z: -23.83, rot: 0, build: wallSignBuild(['PPE BEYOND THIS POINT', 'ear defenders · safety boots · hi-vis'], 1.2, 0.5, 2.3, { w: 512, h: 200, bg: '#1f4e8c', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: signPpe: " + e.message); }
    try {
      defProp('paintReceiving', { label: 'floor paint: RECEIVING', cat: 'hall', abs: true, keep: true, stage: 1, x: SPOT.stageIn.x, z: SPOT.stageIn.z + 2.2, rot: 0, build: floorSignBuild(['RECEIVING'], 2.6, 0.9, { w: 512, h: 128, bg: '#2a2f36', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintReceiving: " + e.message); }
    try {
      defProp('paintShipping', { label: 'floor paint: SHIPPING', cat: 'hall', abs: true, keep: true, stage: 1, x: SPOT.stageOut.x - 2.3, z: SPOT.stageOut.z, rot: 1, build: floorSignBuild(['SHIPPING'], 2.6, 0.9, { w: 512, h: 128, bg: '#2a2f36', fg: '#5fd38d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintShipping: " + e.message); }
    try {
      defProp('paintFinished', { stage: 2, label: 'floor paint: FINISHED GOODS', cat: 'hall', abs: true, x: -1.0, z: -16.3, rot: 0, build: floorSignBuild(['FINISHED GOODS'], 1.8, 0.3, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintFinished: " + e.message); }
    try {
      defProp('paintRaw', { stage: 2, label: 'floor paint: RAW GRANULATE', cat: 'factory', abs: true, x: -9.5, z: -31.6, rot: 0, build: floorSignBuild(['RAW GRANULATE'], 1.6, 0.3, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#eef1f5' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: paintRaw: " + e.message); }
    try {
      defProp('xWallSign', { extra: true, lvl: UNLOCK.build, label: 'wall sign (DEPOT CO.)', ico: '🪧', cat: 'wall', wall: true, price: 30, desc: 'A spare sign for any wall.', build: wallSignBuild(['DEPOT CO.'], 1.2, 0.4, 2.4, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d' }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xWallSign: " + e.message); }
    try {
      defProp('xFloorArrow', { extra: true, lvl: UNLOCK.build, label: 'floor arrow', ico: '➡️', cat: 'hall', price: 10, desc: 'Points the way.', build: floorSignBuild(['➜'], 1.2, 0.6, { w: 256, h: 128, bg: 'rgba(0,0,0,0)', fg: '#f5b53d', size: 110 }) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xFloorArrow: " + e.message); }
    try {
      defProp('posterWing', { stage: 2, label: 'safety poster', cat: 'wall', wall: true, abs: true, x: 9.83, z: -36, rot: 3, build: posterBuild('safety', 0.7, 1.05) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: posterWing: " + e.message); }
    try {
      for (var hid in HALLS) (function (id) {
          var H = HALLS[id];
          defProp(id, { label: H.name, cat: 'hall', abs: true, keep: true, fixed: true, stage: id === 'hall4' ? 5 : 4, x: 0, z: 0, rot: 0, build: hallBuild(id), when: function () { return hallOwned(id); } });
          defProp('shut' + id, { label: H.name + ' shutter', cat: 'hall', abs: true, keep: true, fixed: true, stage: id === 'hall4' ? 2 : 3, x: 0, z: 0, rot: 0, build: shutterBuild(id) });   // a shutter where the doorway is cut: the wing's north wall from the hall stage, the main hall's from the big hall
          H.rows.forEach(function (r, k) { defProp('rack' + r, { label: H.name + ' rack row ' + 'HIJKLM'[r - 20], cat: 'hall', abs: true, keep: true, fixed: true, stage: id === 'hall4' ? 5 : 4, x: H.rowX0 - RACK.x0, y: 0, z: H.rowZ[k], rot: 0, build: rackBuild(r), when: function () { return hallOwned(id); } }); });
        })(hid);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: shut,rack: " + e.message); }
    try {
      for (var hfid in HALLS) (function (id) {
          var H = HALLS[id], when = function () { return hallOwned(id); }, cx = (H.x0 + H.x1) / 2, D = H.door, hs = id === 'hall4' ? 5 : 4;
          defProp('ext' + id, { label: H.name + ' extinguisher', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: H.x1 - 2.5, z: H.z0 + 0.17, rot: 0, build: extinguisherBuild, when: when });
          defProp('posterExit' + id, { label: H.name + ' fire-exit poster', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: D.x0 - 1.6, z: D.z - 0.17, rot: 2, build: posterBuild('exit', 0.6, 0.9), when: when });
          defProp('posterSmoke' + id, { label: H.name + ' no-smoking poster', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: H.x0 + 2.5, z: H.z0 + 0.17, rot: 0, build: posterBuild('nosmoking', 0.6, 0.8), when: when });
          defProp('firstAid' + id, { label: H.name + ' first-aid box', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: H.x0 + 4.0, z: H.z0 + 0.17, rot: 0, build: firstAidBuild, when: when });   // the lobby and the wing have one; the halls did not
          defProp('clock' + id, { label: H.name + ' clock', cat: 'wall', wall: true, abs: true, keep: true, stage: hs, x: cx + 3.2, z: H.z0 + 0.3, rot: 0, build: function (c) { var f = clockBuild(0.4); f(c); }, when: when });
          if (H.rows.length) defProp('aisle' + id, { label: H.name + ' aisle sign', cat: 'hall', abs: true, keep: true, fixed: true, stage: hs, x: cx, z: (H.rowZ[0] + H.rowZ[1]) / 2, rot: 0, build: aisleSignBuild(H.name.toUpperCase() + ' · ' + 'HIJKLM'[H.rows[0] - 20] + ' / ' + 'HIJKLM'[H.rows[1] - 20]), when: when });
        })(hfid);
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: ext,posterExit,posterSmoke,firstAid,clock,aisle: " + e.message); }
    try {
      defProp('tv', { label: 'TV', cat: 'wall', wall: true, abs: true, keep: true, x: -31.0, z: -23.83, rot: 0, build: tvBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: tv: " + e.message); }
    try {
      defProp('dartboard', { label: 'dartboard', cat: 'wall', wall: true, abs: true, keep: true, x: -30.6, z: -20.19, rot: 2, build: dartboardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: dartboard: " + e.message); }
    try {
      defProp('microwave', { label: 'microwave', cat: 'room', abs: true, keep: true, x: -35.5, z: -22.5, y: 0.95, rot: 1, build: microwaveBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: microwave: " + e.message); }
    try {
      defProp('fanStand', { label: 'standing fan', cat: 'room', abs: true, keep: true, x: 29.8, z: 20.8, rot: 1, build: fanStandBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: fanStand: " + e.message); }
    try {
      defProp('rugLobby', { label: 'rug', cat: 'room', abs: true, keep: true, x: -33.6, z: 21.6, rot: 0, build: rugBuild(2.0, 2.4, '#6b3f3a', '#d9a12c') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: rugLobby: " + e.message); }
    try {
      defProp('rugOffice', { label: 'rug', cat: 'room', abs: true, keep: true, x: 32.2, z: 21.0, rot: 0, build: rugBuild(2.8, 2.2, '#2f4a5f', '#c9d3dc') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: rugOffice: " + e.message); }
    try {
      defProp('bookshelf', { label: 'bookshelf', cat: 'room', abs: true, keep: true, x: 31.2, z: 23.55, rot: 0, build: bookshelfBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: bookshelf: " + e.message); }
    try {
      defProp('printer', { label: 'printer', cat: 'room', abs: true, keep: true, x: 30.0, z: 22.6, rot: 2, build: printerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: printer: " + e.message); }
    try {
      defProp('pictureOffice', { label: 'picture', cat: 'wall', wall: true, abs: true, keep: true, x: 29.6, z: 23.83, rot: 2, build: pictureBuild('depot') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: pictureOffice: " + e.message); }
    try {
      defProp('pictureLobby', { label: 'picture', cat: 'wall', wall: true, abs: true, keep: true, x: -35.0, z: 18.67, rot: 0, build: pictureBuild('mountains') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: pictureLobby: " + e.message); }
    try {
      defProp('xSofa', { extra: true, lvl: UNLOCK.seating, label: 'sofa', ico: '🛋️', cat: 'room', price: 220, desc: 'Two seats and a cushion. Comfort +2.', build: seatBuild(1.7, FABRIC) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xSofa: " + e.message); }
    try {
      defProp('xArmchair', { extra: true, lvl: UNLOCK.seating, label: 'armchair', ico: '🪑', cat: 'room', price: 140, desc: 'One seat, deep. Comfort +1.', build: seatBuild(0.95, FABRIC2) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xArmchair: " + e.message); }
    try {
      defProp('xPaddedChair', { extra: true, lvl: UNLOCK.seating, label: 'padded chair', ico: '🪑', cat: 'room', price: 45, desc: 'The canteen chair with a cushion. Comfort +0.5.', build: paddedChairBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPaddedChair: " + e.message); }
    try {
      defProp('xRoundTable', { extra: true, lvl: UNLOCK.seating, label: 'round table', ico: '🪵', cat: 'room', price: 90, desc: 'Seats six. Comfort +1.', build: roundTableBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xRoundTable: " + e.message); }
    try {
      defProp('xTv', { extra: true, lvl: UNLOCK.decor, label: 'TV', ico: '📺', cat: 'wall', wall: true, price: 300, desc: 'Depot news on a wall of your choosing. Comfort +1.', build: tvBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xTv: " + e.message); }
    try {
      defProp('xDartboard', { extra: true, lvl: UNLOCK.decor, label: 'dartboard', ico: '🎯', cat: 'wall', wall: true, price: 35, desc: 'Comfort +1.', build: dartboardBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xDartboard: " + e.message); }
    try {
      defProp('xMicrowave', { extra: true, lvl: UNLOCK.decor, label: 'microwave', ico: '🍱', cat: 'room', price: 110, desc: 'Sits on anything flat. Comfort +1.', build: microwaveBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xMicrowave: " + e.message); }
    try {
      defProp('xFan', { extra: true, lvl: UNLOCK.decor, label: 'standing fan', ico: '🌀', cat: 'room', price: 60, desc: 'Turns while the power is on. Comfort +1.', build: fanStandBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xFan: " + e.message); }
    try {
      defProp('xRug', { extra: true, lvl: UNLOCK.decor, label: 'rug', ico: '🟫', cat: 'room', price: 70, desc: 'Two by two and a half. Comfort +0.5.', build: rugBuild(2.0, 2.5, '#5f3f2f', '#d9a12c') })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xRug: " + e.message); }
    try {
      defProp('xBookshelf', { extra: true, lvl: UNLOCK.decor, label: 'bookshelf', ico: '📚', cat: 'room', price: 130, desc: 'Oak, four shelves. Comfort +0.5.', build: bookshelfBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xBookshelf: " + e.message); }
    try {
      defProp('xPrinter', { extra: true, lvl: UNLOCK.decor, label: 'printer', ico: '🖨️', cat: 'room', price: 160, desc: 'Prints the day report. Comfort +0.', build: printerBuild })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPrinter: " + e.message); }
    try {
      defProp('xPicture', { extra: true, lvl: UNLOCK.decor, label: 'picture', ico: '🖼️', cat: 'wall', wall: true, price: 50, desc: 'One of three. Comfort +0.5.', build: function (c, P, inst) { pictureBuild(['depot', 'mountains', 'ship'][Math.floor(propSeed(inst ? inst.id : 'pic', 1) * 3)])(c); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: xPicture: " + e.message); }
    try {
      defProp('returnsDesk', { label: 'returns desk', cat: 'hall', abs: true, keep: true, stage: 1, lvl: UNLOCK.returns, x: 29.4, z: 10.4, rot: 3, at: { 1: { x: 13.8, z: -5.2, rot: 0 } }, build: returnsDeskBuildFor(0, 'RETURNS'), when: function () { return !returnsHall(); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: returnsDesk: " + e.message); }
    try {
      defProp('lift', { stage: 3, label: 'goods lift', cat: 'hall', abs: true, keep: true, fixed: true, x: UPPER.lift.x, z: UPPER.lift.z, rot: 0, build: liftBuild, when: upperOwned })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: lift: " + e.message); }
    try {
      defProp('bay1', { label: 'shipping bay OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, stage: 3, x: BAY.x0, z: BAY.at.dockLoader1.z0, rot: 0, build: bayBuild('dockLoader1'), when: function () { return !!S.up.sorter; } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: bay1: " + e.message); }
    try {
      defProp('retIntake', { label: 'returns intake', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.intake.x, z: RET.intake.z, rot: 0, when: retWhen, stage: 4, build: function (c, P, inst) {
          var FR = MAT.steelDark, TOP = std({ color: 0x8f98a3, roughness: 0.45, metalness: 0.35 });
          c.box(1.6, 0.06, 0.9, TOP, 0, 0.83, 0); [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].forEach(function (o) { c.box(0.05, 0.83, 0.05, FR, o[0], 0.415, o[1]); });
          for (var rx = -0.6; rx <= 0.6; rx += 0.15) { var rl = c.cyl(0.035, 0.84, MAT.steel, rx, 0.875, 0, 10); rl.rotation.x = Math.PI / 2; }   // rollers across the top
          c.box(1.6, 0.25, 0.04, FR, 0, 0.98, 0.45); c.box(1.6, 0.25, 0.04, FR, 0, 0.98, -0.45); c.box(0.04, 0.25, 0.9, FR, -0.8, 0.98, 0);   // the tray's three sides: the belt feeds the open one
          var post = c.cyl(0.02, 2.2, FR, -0.9, 1.1, -0.5, 8); post.castShadow = false; c.box(0.22, 0.14, 0.1, MAT.black, -0.9, 1.75, -0.44); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), -0.83, 1.8, -0.385);   // the scanner head over the tray
          var scr = touchScreen({ w: 200, h: 80, pw: 0.44, ph: 0.176, x: -0.9, y: 1.45, z: -0.44, ry: 0, parent: c.group, title: 'Returns intake', draw: function (cc, sc) { var D = rdesk(); scBg(cc, sc.w, sc.h, 'rgba(245,181,61,0.2)'); scText(cc, 10, 28, 'INTAKE · ' + D.queue.length + ' / ' + rdeskCap() + ' waiting', '#f5b53d', 14); scText(cc, 10, 54, D.queue.length ? 'E on an inspection desk' : 'the belt brings them in', '#a0acb8', 11); } }); scr.mesh.userData.propId = 'retIntake';
          c.sign(['INTAKE'], 0.7, 0.18, 0, 1.15, 0.47, 0, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' });
          c.solid(-0.85, 0.85, -0.5, 0.5, 0, 1.1); c.hit(1.8, 1.2, 1.1, 0, 0.6, 0, { prompt: function () { return retIntakePrompt(); }, use: function () { retIntakeUse(); } });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retIntake: " + e.message); }
    try {
      RET.desks.forEach(function (d, k) { defProp('retDesk' + k, { label: 'inspection desk ' + (k + 1), cat: 'hall', abs: true, keep: true, fixed: true, x: d.x, z: d.z, rot: 0, when: retWhen, stage: 4, build: returnsDeskBuildFor(k, 'INSPECTION ' + (k + 1)) }); });
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retDesk: " + e.message); }
    try {
      defProp('retCage', { label: 'restock cage', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.cage.x, z: RET.cage.z, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var FR = MAT.steelDark, MESH = std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x6a737c }), W = 3.6, Dp = 0.9, H = 2.1;
          [[-W / 2, -Dp / 2], [W / 2, -Dp / 2], [-W / 2, Dp / 2], [W / 2, Dp / 2], [0, -Dp / 2], [0, Dp / 2]].forEach(function (o) { c.box(0.06, H, 0.06, FR, o[0], H / 2, o[1]); });
          [0.1, 0.72, 1.34, 1.96].forEach(function (y) { c.box(W, 0.04, Dp, MAT.steel, 0, y, 0); c.box(W, 0.04, 0.04, FR, 0, y, -Dp / 2); c.box(W, 0.04, 0.04, FR, 0, y, Dp / 2); });
          c.plane(W, H, MESH, 0, H / 2, -Dp / 2 - 0.01, 0, 0); c.plane(Dp, H, MESH, -W / 2 - 0.01, H / 2, 0, 0, Math.PI / 2); c.plane(Dp, H, MESH, W / 2 + 0.01, H / 2, 0, 0, -Math.PI / 2);   // mesh on the back and the ends, the front open
          c.sign(['RESTOCK CAGE', 'good returns go back on the racks'], 2.2, 0.5, 0, H + 0.35, 0.02, 0, { w: 512, h: 128, bg: '#1e7a3a', fg: '#fff' }); c.box(W, 0.05, 0.05, FR, 0, H + 0.6, 0); c.box(0.03, 0.6, 0.03, FR, -1.0, H + 0.3, 0); c.box(0.03, 0.6, 0.03, FR, 1.0, H + 0.3, 0);
          c.plane(W + 0.4, 1.1, std({ color: 0x242c36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.004, Dp / 2 + 0.6, -Math.PI / 2, 0);
          c.solid(-W / 2 - 0.05, W / 2 + 0.05, -Dp / 2 - 0.05, Dp / 2 + 0.05, 0, H);
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retCage: " + e.message); }
    try {
      defProp('retCompactor', { label: 'cardboard compactor', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.compactor.x, z: RET.compactor.z, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var BODY = std({ color: 0x3b7a3e, roughness: 0.55, metalness: 0.45 }), FR = MAT.steelDark;
          c.box(1.8, 1.7, 1.3, BODY, 0, 0.85, 0); c.box(1.9, 0.08, 1.4, FR, 0, 0.04, 0); c.box(1.9, 0.08, 1.4, FR, 0, 1.74, 0);
          c.box(1.2, 0.5, 0.8, FR, 0, 2.03, -0.1); c.cyl(0.14, 0.5, MAT.chrome, 0, 2.53, -0.1, 14); c.cyl(0.1, 0.3, FR, 0, 2.93, -0.1, 12);   // the ram housing and its cylinder
          c.box(1.0, 0.6, 0.06, MAT.black, 0, 1.2, 0.68); c.box(1.1, 0.06, 0.3, MAT.hazard, 0, 0.88, 0.75).rotation.x = 0.35; c.box(0.06, 0.6, 0.08, MAT.hazard, -0.53, 1.2, 0.69); c.box(0.06, 0.6, 0.08, MAT.hazard, 0.53, 1.2, 0.69);   // the mouth with its hazard lip
          c.box(0.3, 0.2, 0.08, FR, 0.7, 1.4, 0.68); c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), 0.64, 1.42, 0.73); c.box(0.06, 0.06, 0.02, MAT.red, 0.76, 1.42, 0.73);   // the start and stop buttons
          c.sign(['SCRAP', 'cardboard only · damaged returns'], 1.4, 0.5, 0, 1.55, 0.68, 0, { w: 448, h: 160, bg: '#c8342a', fg: '#fff' });
          c.plane(1.6, 0.9, MAT.hazard, 0, 0.0065, 1.15, -Math.PI / 2, 0);
          c.solid(-0.95, 0.95, -0.7, 0.7, 0, 2.6); c.hit(2.0, 1.8, 1.6, 0, 0.9, 0.2, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retCompactor: " + e.message); }
    try {
      defProp('consoleRet', { label: 'dock console RETURNS', cat: 'wall', abs: true, keep: true, fixed: true, x: HALL.x - 0.3, z: RET.dockZ + 3.4, rot: 3, when: retWhen, stage: 4, build: consoleBuild(6) })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: consoleRet: " + e.message); }
    try {
      defProp('retPaint', { label: 'returns hall floor paint', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var lbl = function (t, x, z, w, col, ry) { var m = c.plane(w, 0.42, new THREE.MeshBasicMaterial({ map: textTex([t], { w: 512, h: 96, bg: '#8b8d8e', fg: col || '#d9a12c' }) }), x, 0.0066, z, -Math.PI / 2, 0); if (ry) m.rotation.z = ry; };
          lbl('RECEIVING', 32.2, -31.2, 2.6); lbl('INSPECTION', 23.4, -36.1, 3.0); lbl('RESTOCK', 30.5, -41.3, 2.2, '#5fd38d'); lbl('SCRAP', 15.5, -41.1, 1.8, '#ff6b5e');
          var D = HALLS.hall2.door, dcx = (D.x0 + D.x1) / 2; for (var z = -27.8; z > -31.2; z -= 0.7) c.plane(1.2, 0.35, MAT.whiteLine, dcx, 0.0065, z, -Math.PI / 2, 0);   // the zebra from the doorway walkway up into the hall
          c.plane(0.1, 3.4, MAT.yellowLine, 17.2, 0.006, -37.6, -Math.PI / 2, 0); c.plane(0.1, 3.4, MAT.yellowLine, 29.6, 0.006, -37.6, -Math.PI / 2, 0); c.plane(12.5, 0.1, MAT.yellowLine, 23.4, 0.006, -35.9, -Math.PI / 2, 0); c.plane(12.5, 0.1, MAT.yellowLine, 23.4, 0.006, -39.3, -Math.PI / 2, 0);   // the inspection row's box: from the belt's side to behind the desks
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retPaint: " + e.message); }
    try {
      defProp('retSign', { label: 'returns hall sign', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, when: retWhen, stage: 4, build: function (c) {
          var H = HALLS.hall2;
          c.sign(['RETURNS', 'RECEIVE · INSPECT · RESTOCK · SCRAP'], 5.2, 1.3, (H.x0 + H.x1) / 2 + 4.5, 5.0, H.z0 + 0.19, 0, { w: 768, h: 192, bg: '#1b232c', fg: '#f5b53d', size: 72 });   // on the far wall, east of the hall's own name plate (x 16 to 20) and above the clock
          c.sign(['RETURNS DOCK', 'the belt takes the returns in while the door is up'], 2.6, 0.7, H.x1 - 0.2, 5.4, RET.dockZ, -Math.PI / 2, { w: 640, h: 160, bg: '#1b232c', fg: '#eef1f5' });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("depotco pack: retSign: " + e.message); }
    // each definition as a pack prop: placeable in the editor, never sold, its uses saying what it is (the game logic stays behind)
    var SKIP = ["aislehall3","aislehall4","bay2","bay3","car1","car2","car3","clockhall2","clockhall3","clockhall4","console1","console2","consoleIn1","consoleIn2","exthall2","exthall3","exthall4","firstAidhall2","firstAidhall3","firstAidhall4","gantry0","gantry1","gantry2","gantry3","gantry4","gantry5","hall2","hall3","hall4","mezz","pickBelt","pickBelt2","pickMerge","posterExithall2","posterExithall3","posterExithall4","posterSmokehall2","posterSmokehall3","posterSmokehall4","rack1","rack2","rack20","rack21","rack22","rack23","rack24","rack25","rack3","rack4","rack5","retBelt","retDesk1","retDesk2","shipBelt","shut","shuthall2","shuthall3","shuthall4","upperChute","upperFeed","upperPick","xPoster_exit","xPoster_forklift","xPoster_hands","xPoster_lifting","xPoster_nosmoking","xPoster_rota","xPoster_safety","xPoster_stacking"], seenBuild = new Map(), seenId = {};
    P_DEFS.forEach(function (e) {
      var d = e.def; if (!d || typeof d.build !== 'function' || SKIP.indexOf(e.id) >= 0 || seenBuild.has(d.build)) return; seenBuild.set(d.build, 1);
      var base = (/^x[A-Z]/.test(e.id) ? e.id.slice(1) : e.id).replace(/[^A-Za-z0-9]/g, ''), nid = "dc" + base.charAt(0).toUpperCase() + base.slice(1);
      if (seenId[nid] || PROPS[nid]) return; seenId[nid] = 1;
      var label = d.label || base, inert = { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from Depot Co.)', ''); } };
      HOST_DEF(nid, { extra: true, shop: false, label: label, cat: "depot co", ico: d.ico, wall: !!d.wall, noBlob: !!d.noBlob, desc: 'From Depot Co.: ' + label + '.', build: function (c, P, inst) {
        var h0 = c.hit; c.hit = function (w, h, dd, x, y, z) { return h0.call(c, w, h, dd, x, y, z, inert); };
        if (!c.poster) c.poster = function (kind, w, h, x, y, z, ry) { return poster(kind, w, h, x, y, z, ry, c.group); };
        try { d.build(c, P, inst); if (d.after) d.after(c, P, inst); } finally { c.hit = h0; }
      } });
    });
    // the pack's own materials by name, for a prop read back as parts in the Model tab (Co Engine 0.8.0): a getter, so a cache filled later is seen
    CO.packMats = CO.packMats || {}; CO.packMats["depotco"] = function () { return { SKUS: SKUS, SKU: SKU, CLIENTS: CLIENTS, MODES: MODES, MODE_FEE: MODE_FEE, AIR_RATE: AIR_RATE, STAFF_NAMES: STAFF_NAMES, LEVEL_CAP: LEVEL_CAP, XP_TABLE: XP_TABLE, XP_FOR: XP_FOR, XP: XP, LEVEL_BONUS: LEVEL_BONUS, UNLOCK: UNLOCK, STAFF_CAPS: STAFF_CAPS, LADDER_NOTES: LADDER_NOTES, LADDER_TIPS: LADDER_TIPS, DAY_START: DAY_START, DAY_END: DAY_END, TRUCK_IN: TRUCK_IN, ECON: ECON, UPGRADES: UPGRADES, STAFF_ROLES: STAFF_ROLES, STAGES: STAGES, STAGE_LAST: STAGE_LAST, STAGE: STAGE, STAGE_OF: STAGE_OF, VAN: VAN, TRUCK_OUT: TRUCK_OUT, HALL: HALL, RACK: RACK, DOCKS: DOCKS, DOOR_MAP: DOOR_MAP, YARD_Y: YARD_Y, TRAILER: TRAILER, SPOT: SPOT, UNLOCK_WORDS: UNLOCK_WORDS, hallLights: hallLights, yardLights: yardLights, POSTER_KINDS: POSTER_KINDS, CARD: CARD, doors: doors, slotHits: slotHits, bayLabelTex: bayLabelTex, world: world, dress: dress, CHAIR_RED: CHAIR_RED, leafTex: leafTex, leafMat: leafMat, BARK: BARK, LEAF: LEAF, treeN: treeN, WING: WING, MAT_MACH: MAT_MACH, beltTexBase: beltTexBase, SHIP_PATH: SHIP_PATH, dockLoaderBuild: dockLoaderBuild, BELT_PIECES: BELT_PIECES, HALLS: HALLS, HALL_OF_ROW: HALL_OF_ROW, FABRIC: FABRIC, FABRIC2: FABRIC2, OAK: OAK, WALNUT: WALNUT, CREAM: CREAM, DARKGREY: DARKGREY, COMFORT_PROPS: COMFORT_PROPS, COMFORT_TYPES: COMFORT_TYPES, TV_LINES: TV_LINES, yard: yard, BOX: BOX, BOX_GEO: BOX_GEO, PARCEL_GEO: PARCEL_GEO, PALLET_GEO: PALLET_GEO, handBox: handBox, handParcel: handParcel, truckMeshes: truckMeshes, DRIVER_LINES: DRIVER_LINES, boardT: boardT, RETURNS: RETURNS, jackMesh: jackMesh, jackMeshes: jackMeshes, cartMesh: cartMesh, forkM: forkM, driving: driving, forkSpeed: forkSpeed, forkLook: forkLook, jackModel: jackModel, staffMeshes: staffMeshes, VOICE: VOICE, JACK_HOME: JACK_HOME, RAMP_BOTTOM: RAMP_BOTTOM, SHIFT_START: SHIFT_START, STAFF_SHIFTS: STAFF_SHIFTS, TRAIN_PRICE: TRAIN_PRICE, CROSS_PRICE: CROSS_PRICE, RAISE_PRICE: RAISE_PRICE, tclock: tclock, MACH: MACH, BELTS: BELTS, BELT_PLANES: BELT_PLANES, BELT_SPEED: BELT_SPEED, BELT_GAP: BELT_GAP, BELT_Y: BELT_Y, REACH: REACH, SPEED_STEPS: SPEED_STEPS, sinkCache: sinkCache, FACTORY_RATE: FACTORY_RATE, RAW_PER_SACK: RAW_PER_SACK, HOPPER_CAP: HOPPER_CAP, BALE_NEED: BALE_NEED, BALE_PRICE: BALE_PRICE, FILM_ROLL: FILM_ROLL, FILM_PRICE: FILM_PRICE, agvScreen: agvScreen, agvShown: agvShown, GANTRY_SPEED: GANTRY_SPEED, GANTRY_LIFT: GANTRY_LIFT, GANTRY_DROP_X: GANTRY_DROP_X, UPPER: UPPER, liftM: liftM, liftScreen: liftScreen, liftShown: liftShown, SORT: SORT, LOADER_DOORS: LOADER_DOORS, Y: Y, R: R, sortD: sortD, STAGE_CAP: STAGE_CAP, BAY: BAY, STAGE_AT: STAGE_AT, stageT: stageT, RET: RET, TRUCK_RET: TRUCK_RET, RET_PROPS: RET_PROPS, buff: buff, pc: pc, PC_APPS: PC_APPS, APP_LVL: APP_LVL, scanDev: scanDev, SCAN_W: SCAN_W, SCAN_H: SCAN_H, SCAN_RES: SCAN_RES, SCAN_ICONS: SCAN_ICONS, MAP_PAGE: MAP_PAGE, scan: scan, SCAN_PAGES: SCAN_PAGES, SCAN_LVL: SCAN_LVL, INTRO: INTRO, SEASONS: SEASONS, STATIONS: STATIONS, radio: radio, cables: cables, CABLE_REACH: CABLE_REACH, wrapper: wrapper, DAY_KEEP: DAY_KEEP, reportT: reportT, S: S }; };
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) depotcoPack(defProp); else hook('beforeBuild', function () { depotcoPack(defProp); });
