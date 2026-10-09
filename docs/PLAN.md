# Garage Co.

A first-person car workshop. Cars come in broken, you find the fault, get the part, fix it on the lift, take the money, and the car drives off. The lock-up grows into a dealership. A candidate for the third or fourth game on Co Engine, written 2026-10-08.

## The pitch

You run a small garage on the edge of town. Customers pull onto the forecourt with a car that coughs, pulls, squeals or will not start. They tell you what it does at the desk; you put it on the lift, plug in the reader, look, listen, and name the fault. The part comes on the supplier van tomorrow, or it is on your rack if you stocked it. You fit it, test-drive it round the block, print the invoice, and hand back the keys. Late, wrong or careless work costs reputation, and reputation is what brings the next car.

## The loop

1. **Arrive.** A car drives onto the forecourt and parks in a bay (the vehicle kit's traffic and parking). The customer walks to the desk.
2. **Take the job.** At the desk screen the customer describes the symptom in a line. You open a job card: the car, the complaint, the promised time.
3. **Diagnose.** Drive or push the car onto a lift, raise it, open the bonnet, and use the reader (the hand-held device kit, as Depot Co's scanner) and your eyes: a smoking part, a worn tyre, a leak on the floor. The fault is a hidden tag on the car; the symptom narrows it, the reader narrows it further, and a look confirms it. Guessing wrong wastes a part.
4. **Get the part.** From your rack if you stocked it, or ordered on the PC and brought by the parts van the next morning (the truck kit, with a pallet or a box). Stock the common parts and the queue moves faster.
5. **Fit it.** A hold-to-work action at the part with the right tool in hand (the task bar from Grow Co): the longer jobs are minigames of a few steps (drain, swap, fill). An apprentice can do the simple ones.
6. **Test and hand over.** A lap of the block in the car (the drivable vehicle kit), then the invoice at the till (Grow Co's POS) and the keys back. Pay and reputation land.

Trouble, one kind at a time: a comeback (a car returns with the same fault), the MOT inspector (Depot Co's inspector as a stricter cousin), a fire from a careless weld, a thief in the night (the prowler), a customer who will not pay.

## The ladder

Everything earns XP; every fifth level the building grows, free, overnight, as in Depot Co.

| Levels | The building | What opens |
|---|---|---|
| 1 to 4 | **The lock-up.** One roll door, one jack and axle stands, a tool wall, a desk with a clipboard. Oil, brakes, bulbs, batteries. Walk-in customers only. | The reader, the parts rack, the first apprentice |
| 5 to 9 | **The two-bay garage.** Two lifts, an office with the PC, a waiting room, a forecourt with four bays, the parts van. Tyres and exhausts. | The supplier account, the tyre machine, the compressor, booked appointments, the mechanic |
| 10 to 14 | **The workshop.** Four bays, a diagnostics bay, a tyre and brake lane, a staff room, the car park. Engines and gearboxes. | The MOT lane, the second mechanic, the recovery truck, courtesy cars, trade accounts |
| 15 to 19 | **The bodyshop.** A paint booth and a panel bay off the back wall, a parts store with a mezzanine. Accident repairs, resprays. | The insurer accounts, the painter, the valeter, the wash bay |
| 20 to 25 | **The dealership.** A showroom on the forecourt, a used-car lot, a second workshop hall. Buying, preparing and selling cars. | The sales desk, the finance app, the fleet contracts |

## Systems

- **Cars as records.** Make, colour, mileage, a fault list with a visible symptom per fault, a hidden true fault, wear on tyres, brakes, oil. The vehicle kit draws them; a car's parts (bonnet, boot, doors, wheels) are hinged groups so they open and come off.
- **Parts and stock.** A parts catalogue by category, a rack with slots (the Depot Co slot model), a supplier van on a schedule, prices that drift. The generic item system of the engine carries them.
- **The lift.** A machine prop with a screen: up, down, lock. A car on a lift is a vehicle parented to the lift group.
- **Tools.** Hand tools you carry (the hands kit), the trolley jack, the reader, the tyre machine, the compressor, the welder, the paint gun. A job names the tool it needs.
- **Jobs board and appointments.** Screens kit: the board on the wall, the desk PC with the day's bookings, the invoice.
- **Staff.** Apprentice, mechanic, receptionist, painter, valeter, recovery driver. The people rig, the grid router, the roles as game logic.
- **Reputation and word of mouth.** Reputation sets how many cars arrive and how far they come from; a comeback or a late job costs it.
- **Weather and seasons.** Rain brings breakdowns and wet-weather jobs; winter brings tyres and batteries; summer brings air-con.
- **The town.** Grow Co's city kit outside the fence: the road, parked cars, pedestrians, the lap round the block.

## What the engine gives, what is new

Engine as of M2: the world kit, props and build mode, doors, people, screens, the hand-held device, the vehicle meshes and the drivable-vehicle core, lane traffic, the yard and the town kit, weather, saves, the shell, the dev console, the editor.

New for this game (and engine candidates afterwards): hinged car parts as a standard (bonnet, doors, boot, wheels off), a vehicle-on-a-machine parent (the lift), a fault and symptom model, a multi-step work minigame, the invoice and the trade accounts.

Prop packs it would ship and share: `garage` (lifts, tool wall, compressor, tyre machine, oil drum, parts rack), `vehicles-parts` (wheels, tyres, batteries, exhausts as carried items), `forecourt` (bays, signs, air line, wash bay).

## Art direction

The same generated look: bevelled boxes, canvas textures, the house slate and amber for signs, warm high bays indoors, a grey forecourt under a wide sky. Cars in the Depot Co car palette, dirt and dents as material tints. The workshop sounds: the compressor cycling, the impact wrench, the radio.

## Scope

Comparable to Depot Co at 1.21: about twenty-five levels, five buildings, six roles, a hundred props. On the engine, with the packs above and the vehicle kit, the first playable lock-up (levels 1 to 4) is weeks of work, not months. The fault model and the minigames are the part with no precedent in the two games.

## Open questions for Tyson

- Real makes or made-up ones? Made-up keeps us clear of trademarks and lets the cars match the house look.
- How hard should diagnosis be? A puzzle with a wrong-guess cost, or a timer you buy down with better tools?
- Does the player drive on the road, or only on the forecourt and the lap? The town kit allows both.
