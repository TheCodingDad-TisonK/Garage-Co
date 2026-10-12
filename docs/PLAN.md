# Garage Co.

A first-person car workshop. Cars come in broken, you find the fault, get the part, fix it on the lift, take the money, and the car drives off. The lock-up grows into a dealership. Game three on Co Engine, written 2026-10-08; the shop and the system sections added 2026-10-11.

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

## Where it stands (v0.3.1)

The lock-up plays end to end and grows into the two-bay garage at level 5. There are twelve jobs, each worked step by step at the car with tools off the wall. Stock sits on the shelves and the PC orders more. The parts van comes, and the tyre corner and the stores shed can be bought. Three staff roles can be hired. Rep sets how often cars come and what labour pays. A lift takes the car you drive onto it.

What it does not have is the part the pitch opens with: finding the fault. The customer's symptom names the job outright, so every car is a recipe to follow and the player can never get one wrong. The next update, diagnosis, puts that in (below). After it, the ladder still stops at level 7: nothing opens past it, and the workshop at level 10 has no plan beyond the ladder table.

(Before v0.3, this section read: one bay, four faults, the work a bar that fills, rep that nothing reads. The two update sections below are what v0.3.0 shipped.)

## The next update: the shop

### More room

- **Before level 5, bought from the PC.** Two add-ons on the lock-up's side wall: a **stores shed** (shelving for stock past the one parts rack) and a **tyre corner** (the tyre bench with its water tank, the air line, later the tyre machine and the balancer). Each one is a small lean-to built overnight after you buy it.
- **At level 5, the two-bay garage**, built overnight as the ladder says. It grows in place: a second hall the same size off the lock-up's east wall, with its own roll door, bay 2 and lift, and the side door as the way between the halls. An **office** goes off the side door, with the PC desk and a window onto both bays. A **stores room** sits behind the parts rack. A **waiting corner** with two chairs and a coffee machine, where a customer sits instead of standing at the desk. The forecourt gets four marked bays where cars can wait their turn.
- **What changes underneath:** `BAY` becomes a list of bays and `S.job` becomes `S.jobs`, one per bay, each with its own car, customer and state. The roll door panel and the job card read the bay they stand at.

### Workers

- **Hired at the PC** (the Staff app): every morning a short list of candidates, each with a name, a day wage, a skill from 1 to 5 and the jobs they can do.
- **The roles, in ladder order:** the **apprentice** from level 3 (oil, bulbs, batteries, wipers; slow, and now and then forgets a step, which comes back as a comeback), the **mechanic** at level 5 with the second bay (every job of the level, at your speed), the **receptionist** at level 7 (takes jobs and payments at the desk so you can stay at the cars). The painter, valeter and recovery driver follow the ladder above.
- **How a worker works:** they clock in at eight and pick a car off the job board (only the jobs you hand them, or any job once you tick "let them take jobs"). They walk to the rack for the part, carry it to the car, and work through the same steps you do (see Interactive work), at the speed their skill gives them. When the car is done they set it to done, and the customer pays at the desk. If the part isn't on the rack, they put the job on hold and it shows on the PC.
- **Pay and growth:** wages come out of the bank at close. Skill rises with jobs done, faster with a training course bought on the PC. A worker who isn't paid, or who works too many late days, gets slower and can quit.
- You can always walk up and take over a car a worker is on.

## The next update: the system

### More jobs

The `FAULTS` table grows from four to about twelve, opened by level. Each job names its symptom, its part, its tool, its steps, its time and its price; the invoice shows labour and parts as separate lines.

| Job | What the customer says | Part | Tool | From level |
|---|---|---|---|---|
| Oil and filter | The oil light is on | 5 L of oil, an oil filter | jack, drain pan, filter wrench | 1 |
| Front brake pads | It squeals when I brake | a pad set | jack, wheel brace | 1 |
| Headlight bulb | The left headlight is out | a bulb | hands | 1 |
| Battery | It would not start | a battery | spanner | 1 |
| Wiper blades | It smears in the rain | a wiper pair | hands | 2 |
| Puncture | The tyre keeps going flat | a plug kit | jack, wheel brace, tyre corner | 2 |
| Air filter | It feels sluggish and thirsty | an air filter | hands | 3 |
| Spark plugs | It misfires pulling away | four plugs | plug socket | 3 |
| Coolant | It runs hot in traffic | coolant | hands | 4 |
| New tyre | The tyre is worn to the cord | a tyre | tyre machine, balancer | 5 |
| Exhaust | It rattles and it is loud | an exhaust section | jack, spanner | 5 |
| Discs and pads | It grinds when I brake | discs and a pad set | jack, wheel brace | 6 |

A car can come in with two faults, or you spot a second one while it is in (worn wipers, a low tyre). Offering it to the customer at the desk is an upsell. They say yes or no, and the yes rate rises with rep.

### Interactive work

The bar that fills while you stand at the car is replaced by real steps at real parts of the car.

- **The car opens.** The bonnet, the boot, the doors and the four wheels are hinged or removable groups on the car mesh. This is the plan's "hinged car parts as a standard", and an engine candidate afterwards. E on the bonnet lifts it on its hinge and the stay goes in. The engine bay has parts you can point at: the oil filler cap, the dipstick, the battery, the air filter box, the coolant tank, the washer bottle, the headlight units from behind.
- **A job is a step list on the job card.** Each step names a place on the car, a tool, and an action. A **press** (open the bonnet, take the cap off), a **hold** (undo the sump plug, pump the jack: a bar while you hold E), or a **carry** (the old battery to the bench, the new one from the rack). The next step's place glows on the car, and the card ticks each step off.
- **Oil and filter, step by step:** jack under the sill and pump the car up. Slide the drain pan under. Undo the sump plug (hold) and wait while it drains (the level drops in the pan). Swap the filter with the filter wrench (hold). Sump plug back in. Lower the car. Open the bonnet and fill from the can (hold; the dipstick shows the level). Cap on, bonnet shut.
- **A puncture, step by step:** jack the corner up. Undo the five nuts with the wheel brace (a hold each). Take the wheel off and carry it to the tyre corner. Lower it into the water tank and turn it until the bubbles show the hole. Plug it with the plug kit. Pump it up with the air line. Carry it back, wheel on, nuts on, lower the car.
- **Mistakes cost something, within limits.** Leave the sump plug out and the oil ends up on the forecourt, and the car comes back tomorrow as a comeback, which costs rep. Overfill it and the dipstick says so before you shut the bonnet. The step list never lets you drive a car off with a wheel missing or the car still up on the jack.
- **Tools are in your hands.** You take a tool off the tool wall (the hands kit, as Depot Co's scanner) and hang it back afterwards. The tool wall shows an outline where a tool is missing. A step needs its tool in hand.
- **Workers run the same steps.** An apprentice's car shows the same open bonnet and the same wheel off as yours does.

### Stock and the PC

- **Parts are stock.** A part has a count. It sits on the parts rack, and later in the stores shed and the stores room, as boxes on a shelf slot: one part type per slot, the Depot Co slot model. A new garage starts with a few of each level 1 part.
- **A job takes its part at the step that fits it.** No part, no step: the job card says what is missing. The customer either leaves the car overnight in a forecourt bay or drives off, and that costs rep.
- **The PC** stands on the desk now (the desk already carries a monitor) and moves to the office with the two-bay garage. E at the desk sits you down in front of it, like Depot Co's office PC (`src/13-pc.js` there): apps drawn on the screen, tapped with the crosshair, lists that scroll.
- **Its apps:**
  - **Parts:** the supplier's catalogue by category, a price per part, a basket, Order. Standard delivery comes on the parts van at half past eight the next morning; express comes the same day for a fee. Prices drift a little from day to day.
  - **Stock:** what is on the shelves, what is on order, and a minimum per part. Once the supplier account opens (level 5), the shop reorders up to the minimums at close by itself.
  - **Jobs:** today's cars, what each one waits on, and the done list. The clipboard on the desk stays as the quick view. Bookings arrive here once appointments open (level 5).
  - **Staff:** candidates, hire, wages, skills, training, let go.
  - **Garage:** buy room (the stores shed, the tyre corner), tools (filter wrench, plug socket, tyre machine, balancer, compressor) and upgrades (a jack that pumps faster, a second tool wall).
  - **Books:** the ledger, the day's takings against wages and parts, and rep with where every change came from.
- **The parts van:** comes off the road at half past eight, parks in a forecourt bay, and the driver leaves the boxes by the roll door. You or a worker carry them to the rack.

### Rep that does something

Rep sets how often cars come (the gap between cars shrinks as it rises), how far they come from, and how much a customer accepts for labour. It rises with a paid job and a job done before the promised time. It falls for a comeback, a customer who drives off because a part is missing, and a job that runs past its promised time. The Books app shows every change.

### The lift and driving the car in

Tyson, 2026-10-11: the customer parks in the bay outside and walks to the desk; you take the job, get in, and drive the car yourself through the roll door onto the lift.

- **The lift** is a two-post lift just inside each roll door: the lock-up has one from the start, the second hall has its own. Yellow lines on the floor show where to stop.
- **Driving:** E on the car of a job you have taken puts you in the driving seat (W and S, A and D to steer). The roll door rides up as you come. You can only get out on a lift's lines or back in the car's own bay, so a car is never left standing in the way.
- **On the lift** every jack step becomes a lift step: hold E at the control box on the left post and the car rises to working height (1.5 m) as the step fills. The sump, the filter, the brakes and the exhaust are then done standing under it. Lift steps are quicker than the trolley jack.
- **The trolley jack** still works for a car left out in its bay, so the lift is the better way, not the only one. Staff work a car wherever it stands.
- **Leaving:** once paid, the customer reverses the car off the lift and out of the roll door, then drives off the way they came.

### What shipped in v0.3.0

Tyson asked for all of it in one release, so v0.3.0 carries every part of this update: the PC and stock, the step-by-step work with the tools, the twelve jobs, rep that does something, more room (the tyre corner, the stores shed, the two-bay garage), the workers, and the lift you drive onto. The two-bay garage grows in place: it is built into the lock-up's own world item off the east wall, so the town Tyson laid out stays as it is, and an editor move of the lock-up takes the new hall with it. Anything placed where the new hall stands (the front fence on that side) is cleared the night it grows. `tests/lockup.smoke.js`, `tests/systems.smoke.js` and `tests/garage2.smoke.js` cover it: 134 checks.

## The next update: diagnosis

Tyson, 2026-10-12: the pitch says you find the fault, and v0.3 never asks you to. Loop step 3 (Diagnose) and the reader on the ladder's first row were left out of the v0.3 sections. This update makes the fault something you work out.

### What the customer says is a symptom, not a job

A car has a hidden true fault and a symptom the customer describes. Symptoms are their own table (`SYMPTOMS`), and each names the faults it could be. Some point to one fault ("The left headlight is out"). Others point to several:

| What the customer says | It could be |
|---|---|
| It struggles to start in the mornings | a worn-out battery, a loose battery terminal, worn spark plugs |
| It feels sluggish and it drinks fuel | a clogged air filter, worn spark plugs |
| It makes a horrible noise when I brake | worn pads, scored discs and pads |
| Something is not right with the front tyre | a puncture, a tyre worn to the cord |

The rest (the oil light, the headlight, smearing wipers, a tyre that keeps going flat, a misfire, running hot, a rattle underneath) point to one job each.

- **Only the faults open at your level count.** At level 1 only the starting trouble is a puzzle (the battery or the terminal). Spark plugs join it at level 3, new tyres at 5, discs at 6. A symptom with one open fault is named at the desk as before, so the simple jobs stay quick.
- **A new job: a loose battery terminal** (level 1). It needs no part: clean it and do it up with the spanner. It exists to sit next to the expensive answer. Fit a battery to a car that only had a loose terminal and that battery is gone.

### Checks

- Taking a job that could be more than one thing opens it as **find the fault**. The job card lists what it could be and the checks that would tell those apart.
- A check is a hold of E at a place on the car, like a step:
  - **Read the codes.** The code reader, a new tool on the tool wall that the lock-up has from the start, goes into the socket under the dash. A misfire code points to the plugs, an air-flow code to the air filter, and no codes to neither.
  - **Test the battery.** The reader on the battery, with the bonnet up. It reads worn out, healthy with a loose terminal, or healthy.
  - **Look at the air filter.** Bonnet up, open the air box.
  - **Look at the brake** through the wheel: thin pads on a smooth disc, or pads down to the metal on a scored disc.
  - **Look over the tyre:** a screw in the tread, or worn to the cord.
- Only the checks that would tell the remaining answers apart are offered. Each says what it found, in words, and the card keeps the findings. The game does not cross answers off for you: you read the findings and decide.

### Naming the fault

- Each possible answer has a button on the job card and on the clipboard. Naming one prices the job (labour plus parts, as the invoice always did) and the steps begin.
- You may name it without a single check. That is the gamble: quicker when you are right.
- **Wrong costs a part and time.** At the last step you start the car and it still does it. The part you fitted is gone and the customer does not pay for it. The wrong answer is crossed off the card, and the job goes back to finding the fault with the clock still running toward the promised time. When only one answer is left it is named for you. The guess itself costs no rep; being late does, as before.
- Right first time, after at least one check, earns 5 XP more. The Books app counts the right calls and the wrong ones.
- The upsell waits until the fault is named.

### Staff

- **The mechanic can find a fault:** they walk to each check that still tells the answers apart, then name what is left. A low-skill mechanic sometimes names one without checking (skill 1: two jobs in five; skill 2: one in five).
- **The apprentice cannot.** A car still being diagnosed waits for you or the mechanic. Once it is named, the apprentice can do its steps as before.

### Saves

A save from 0.3 keeps its jobs as named, since the fault was known when they were taken, and the reader goes up on its tool wall.

### Later, not in this update

- A better reader on the PC that reads more from the socket (the battery, the coolant).
- The test drive round the block as the check at the end of a job (loop step 6), instead of starting the car in the bay.
- Faults that only show on the road.

## What the engine gives, what is new

Engine as of M2: the world kit, props and build mode, doors, people, screens, the hand-held device, the vehicle meshes and the drivable-vehicle core, lane traffic, the yard and the town kit, weather, saves, the shell, the dev console, the editor.

New for this game (and engine candidates afterwards): hinged car parts as a standard (bonnet, doors, boot, wheels off), a vehicle-on-a-machine parent (the lift), a fault and symptom model, a multi-step work minigame, the invoice and the trade accounts.

Prop packs it would ship and share: `garage` (lifts, tool wall, compressor, tyre machine, oil drum, parts rack), `vehicles-parts` (wheels, tyres, batteries, exhausts as carried items), `forecourt` (bays, signs, air line, wash bay).

## Art direction

The same generated look: bevelled boxes, canvas textures, the house slate and amber for signs, warm high bays indoors, a grey forecourt under a wide sky. Cars in the Depot Co car palette, dirt and dents as material tints. The workshop sounds: the compressor cycling, the impact wrench, the radio.

## Scope

Comparable to Depot Co at 1.21: about twenty-five levels, five buildings, six roles, a hundred props. On the engine, with the packs above and the vehicle kit, the first playable lock-up (levels 1 to 4) is weeks of work, not months. The fault model and the minigames are the part with no precedent in the two games.

## Open questions for Tyson

- Real makes or made-up ones? Answered by the lock-up: made-up (Harlow, Pennant, Kestrel, Dunmore, Alder, Brampton).
- More room: the two-bay garage grows in place in v0.3.0. Does the workshop (level 10) move to a bigger plot in town, or keep growing here?
- Steps go in a fixed order in v0.3.0 (the card always knows the next one). Any order that works, later?
- Workers are paid by the day in v0.3.0. By the job instead?
- How hard should diagnosis be? A puzzle with a wrong-guess cost, or a timer you buy down with better tools? Answered for the diagnosis update (2026-10-12): a puzzle with a wrong-guess cost. The findings are words you read, and a wrong guess costs the part and the time. Better tools that cut the checks down stay open, as the better reader.
- What comes after level 7? Nothing opens past it yet, and the workshop (level 10) has only its ladder row.
- Does the player drive on the road, or only on the forecourt and the lap? The town kit allows both.
