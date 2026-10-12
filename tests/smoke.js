// The game's smoke: `npm test`. Boots the page in a hidden Electron window and plays the lock-up's loop in tests/lockup.smoke.js,
// then the systems from a fresh save (tests/systems.smoke.js), then the grown garage that save leaves (tests/garage2.smoke.js),
// then finding the fault from another fresh save (tests/diagnosis.smoke.js), then the car and its moving parts (tests/car.smoke.js).
'use strict';
const path = require('path');
const { run } = require('co-engine/tools/smoke-runner');
const fresh = async (win) => { await win.webContents.executeJavaScript('localStorage.clear()'); };
run({ page: path.join(__dirname, '..', 'index.html'), handle: 'GARAGE', userDataPrefix: 'garage-co-test', scenarios: [
  { name: 'the lock-up', body: require('./lockup.smoke.js') },
  { name: 'the systems', before: fresh, body: require('./systems.smoke.js') },
  { name: 'the two-bay garage', body: require('./garage2.smoke.js') },
  { name: 'finding the fault', before: fresh, body: require('./diagnosis.smoke.js') },
  { name: 'the car and the work you can see', before: fresh, body: require('./car.smoke.js') }
] });
