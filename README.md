# Garage Co.

**NOT a Farming Simulator product.** This game has nothing to do with Farming Simulator, GIANTS Software, or any Farming Simulator mod. It is a separate, standalone hobby project by TheCodingDad.

A first-person car workshop on [Co Engine](https://github.com/TheCodingDad-TisonK/Co-Engine). Cars come in broken, you take the job at the desk, fix the fault at the car and take the money. The lock-up grows into a dealership; the plan is in `docs/PLAN.md`. This is the first room: the lock-up, one bay, four faults, the loop from the road to the till.

## Play

**From source:** `npm install`, `npm run build`, `npm start`. **Any browser:** `npm run serve` and open the address it prints, or point a static server at this folder.

| Key | Does |
|---|---|
| `W A S D` · `Shift` · `Space` | Move, run, jump |
| `E` | Take the job from the customer, start the work at the car, take the payment, pull the roll door's chain |
| `F2` · `C` | Build mode and its catalogue |
| `F9` · `F12` · `F3` | Photo mode, screenshot, FPS |
| `Esc` | Pause: settings, guide, the books, save file |

## Building

```
npm install        # fetches the engine at the tag package.json pins, and Electron
npm run build      # puts three.js beside the page, joins the engine parts and src/ into game/game.js
npm run check      # refuses to pass if game/game.js is not what the parts build
npm test           # the check, then the smoke: the whole loop in a hidden window
npm run dev        # the game, linked to the Co Engine editor from the first frame
```

Never edit `game/game.js` by hand: edit `src/` and build. The engine's contract is `docs/ENGINE.md` in the engine repo.

## Support

Garage Co. is free and stays free. If you want to follow the work, there is a Patreon: https://www.patreon.com/cw/thecodingdad. A one-off thank you goes through PayPal: https://www.paypal.com/paypalme/TheCodingDad. Supporters are listed in `SUPPORTERS.md`.

## Licence

All rights reserved. You may download and play the game for yourself; copying, sharing, selling or reusing it needs written permission. Releases up to v0.2.1 were MIT. See [LICENSE](LICENSE). Made by TheCodingDad.
