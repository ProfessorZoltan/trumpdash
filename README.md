# Trump Dash

A parody rhythm platformer in the style of Geometry Dash. You run a pixel-art Trump from
Washington, D.C. to Venezuela's Orinoco oil belt, jumping obstacles like **The Constitution**,
**Congress**, the **Supreme Court**, **International Law**, the **Free Press** and a
**Gag Order** ceiling. Reach the tanker truck marked **VENEZUELA**, climb in, watch the
**U.S.A.** stamp slam over the name and then **TRUMP** stamp over that, and drive away.

Satire. Not affiliated with any person, government or oil company.

## Play

Open `index.html` through a local web server (browsers block the sprite sheet on `file://`):

```bash
python -m http.server 8765
```

Then visit <http://localhost:8765/>.

| Key | Action |
| --- | --- |
| Space / ↑ / W / click / tap | Jump (hold to keep jumping, like Geometry Dash) |
| Esc | Pause |
| R | Restart from the beginning |
| P | Toggle practice mode (auto checkpoints every few bars) |
| M | Mute |
| H | Show hitboxes |
| A | Toggle autoplay (watch mode) |

## How the rhythm works

Everything is derived from one number, `BPM = 128` in `src/constants.js`. The player moves
at a constant 384 px/s, so one beat is exactly 180 px. Every obstacle in `src/level.js` is
placed in **beats**, and the helper functions (`S` for spikes, `OVER` for blocks you jump
over, `P` for platforms, `O` for the Pardon orb) position the geometry so that pressing
exactly on the named beat puts the apex of the jump over the hazard.

The music is generated live with the Web Audio API (`src/audio.js`) on a 16th-note grid
locked to the same clock. Every beat that requires a jump gets an accent (a bright pluck and
a clap) so the track itself tells you when to press. Jumps within ±60 ms of the beat count as
PERFECT, within ±120 ms as GOOD, and build the on-beat combo shown above the player.

Physics runs on the audio clock at 240 Hz, so the game stays deterministic and in sync even
if the frame rate stutters.

## Level

| Bars | Section | What you meet |
| --- | --- | --- |
| 0–3 | Intro | White House, first spikes |
| 4–11 | Verse | Spikes, The Constitution, the first Pardon orb |
| 12–15 | Build | Congress columns (Senate, House) to hop across |
| 16–23 | Drop | Executive Order pad over the Article I wall, International Law, Supreme Court, Gag Order |
| 24–27 | Breakdown | Tariff zone, oil-barrel stairs |
| 28–35 | Drop 2 | Free Press, second Gag Order, double spikes |
| 36–39 | Finale | Orinoco oil belt, PDVSA tanks, the truck |

## Tools

* `node tools/verify_level.js` simulates a player pressing exactly on every jump beat, checks
  the level is completable, and prints the timing window (ms early / late) of every jump.
* `node tools/shoot.js ending|tour|audio [outDir]` drives headless Chrome over the DevTools
  protocol (server must be running on port 8765) and captures screenshots of key moments.

Debug URL parameters: `?autoplay=1`, `?start=<beat>`, `?noaudio=1`, `?mute=1`, `?debug=1`.

## Files

```
index.html          page shell
style.css           layout
src/constants.js    BPM, speed, physics constants
src/sprites.js      frame table for resources/sprite_sheet.png
src/level.js        level design in beats
src/physics.js      deterministic player physics + collisions
src/audio.js        procedural music and sound effects
src/render.js       canvas rendering, HUD, menus, truck + stamps
src/game.js         game loop, input, state machine, ending cutscene
```
