// The game's smoke: `npm test`. Boots the page in a hidden Electron window and plays the lock-up's loop in tests/lockup.smoke.js.
'use strict';
const path = require('path');
const { run } = require('co-engine/tools/smoke-runner');
run({ page: path.join(__dirname, '..', 'index.html'), handle: 'GARAGE', userDataPrefix: 'garage-co-test', scenarios: [{ name: 'the lock-up', body: require('./lockup.smoke.js') }] });
