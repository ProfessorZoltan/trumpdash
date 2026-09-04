# Trump Dash

A parody rhythm platformer in the style of Geometry Dash, with six levels you pick from the
main menu.

**Level 1 — GREENLAND (Normal, 112 BPM).** The on-ramp. From Nuuk across the ice past polar
bears, a **NOT FOR SALE** sign, the Danish **Folketing**, and a **NEJ** wall cleared with the
**PURCHASE OFFER** pad. Then the **FLIP-FLOP** portal turns gravity upside down and you run along
the underside of the ice, past **Inatsisartut** (Greenland's parliament), before flipping back
for iceberg alley. It ends at a giant map: **(DENMARK)** gets stamped **U.S.A.**, then **TRUMP**,
and the island slides across the screen to sit next to Florida.

**Level 2 — VENEZUELA (Hard, 128 BPM).** Run a pixel-art Trump from Washington, D.C. to
Venezuela's Orinoco oil belt, jumping obstacles like **The Constitution**, **Congress**, the
**Supreme Court**, **International Law**, the **Free Press** and a **Gag Order** ceiling. Reach the
tanker truck marked **VENEZUELA**, climb in, watch **U.S.A.** stamp over the name and then
**TRUMP** stamp over that, and drive away.

**Level 3 — HORMUZ (Insane, 140 BPM).** From a golf round at Mar-a-Lago, through the Pentagon
and off an aircraft carrier's catapult into the Gulf: water gaps between ship decks, floating
naval mines, drones bobbing on the beat, the **War Powers Act**, **AUMF**, **Intel Briefing**,
**Senate/House Hearing** columns, a **UN Security Council** wall (cleared with the **VETO** pad),
a torn-up **JCPOA**, **NATO Article 5**, and **CEASEFIRE** ceilings. It ends at the Strait of
Hormuz, where the sign gets stamped **CLOSED** and then **TRUMP TOLL**, the barrier drops, and
tankers queue up to pay $1B each.

**Level 4 — THE 51st STATE (Hard, 120 BPM).** North across the border past Mounties, a
**SORRY** sign, Parliament Hill columns, a **USMCA** wall cleared with the **TARIFF THREAT** pad,
a **DOUBLE DOUBLE** coffee block, maple-syrup pits and a **25% TARIFF** ceiling. Two frozen lakes
and a hockey rink are **ice zones**: the run speeds up on them (×1.25 and ×1.3) with pucks to
clear. It ends at the border sign, where CANADA is stamped **51st STATE** and then **TRUMP**, the
maple leaf comes down and a TRUMP flag goes up.

**Level 5 — PANAMA CANAL (Expert, 132 BPM, reggaeton).** From the canal entrance past
crocodiles, **HIGHLY UNFAIR FEE** booths, a **FOOLISH GIFT (1977)** treaty wall cleared with the
**TAKE IT BACK** pad, an **EXORBITANT FEE** ceiling and container stairs. Four **lock lifts**: barges
in lock chambers whose water rises on the beat; jump on low, ride up, jump off onto the upper wall.
The ending is the lock gate: PANAMA CANAL is stamped **TAKEN BACK** and then **TRUMP CANAL**, the fee
sign flips to "U.S. ships: free, everyone else: $5,000,000", the gates open and a U.S. ship sails
through. The track is a dembow: kick on every beat, snare on the tresillo, horn stabs on the drops.

**Level 6 — THE MOON (Extreme, 150 BPM, space synths).** The hardest and strangest: dense
double spikes, aliens, asteroid mines and a UFO in normal gravity, then **low-gravity zones**
where every jump goes twice as high and lasts twice as long, with four-block outpost walls,
crater pits, an asteroid belt you must not jump into, boosted jumps over six-spike fields, a
Space Force pad over a six-block outpost, and gravity flips inside the low-gravity field. It ends
at the outpost site, where the plaque is lowered onto its pedestal and engraved line by line with
the text NASA unveiled ("America has returned… Signed, President Donald Trump"), the sign is
stamped RETURNED and then TRUMP, and Trump bounces around in one-sixth gravity while a UFO
flies past.

Satire. Not affiliated with any person, government or oil company.

## Play

Open `index.html` through a local web server (browsers block the sprite sheet on `file://`):

```bash
python -m http.server 8765
```

Then visit <http://localhost:8765/>. The repository is a static site, so it also deploys
as-is on Vercel or GitHub Pages.

Scripts are loaded with a version query string from `index.html`. On localhost every load gets a
fresh stamp; in production bump `TD_VERSION` in `index.html` whenever a JS or CSS file changes so
returning players never run a mix of old and new modules.

| Key | Action |
| --- | --- |
| ← → / 1–6 / click a card | Choose a level on the menu |
| Space / ↑ / W / Enter / click / tap | Start, and jump (hold to keep jumping, like Geometry Dash) |
| Esc, or the ⏸ button top-right | Pause (the pause screen has Resume / Restart / Practice / Sound / Quit buttons) |
| R | Restart from the beginning |
| P, or the PRACTICE toggle | Toggle practice mode (auto checkpoints every few bars, all flags stay visible) |
| M, or the SOUND toggle | Mute |
| C, or the SYNC chip | Tap-to-the-beat calibration: measures how late your taps arrive and starts the music that much earlier |
| F, or the ⛶ button on the menu | Fullscreen (on Android this also locks landscape) |
| H | Show hitboxes |
| A | Toggle autoplay (watch mode) |

### On a phone

Everything is reachable by touch: tap anywhere to jump and hold to keep jumping, tap a level card
to select it and again to start, and use the on-screen buttons for pause, restart, practice, sound
and fullscreen. The jump stays held while *any* finger is on the screen, so two-thumb tapping works
and a resting thumb never cancels a jump. The canvas is fitted to the safe area of the screen
(notches and the home indicator are avoided) and refitted when the browser bar collapses or the
phone rotates. Portrait phones get a "rotate your phone" screen, and a run in progress pauses when
the phone is turned. `manifest.json` plus the Apple meta tags in `index.html` make "Add to Home
Screen" launch the game landscape and chrome-free; the icons in `icons/` are rendered from the
sprite sheet by `node tools/make_icons.js`.

Bluetooth headphones and touch screens both add latency, so SYNC on the menu runs a short
calibration: tap along to a click twelve times and the median lateness (minus whatever latency the
browser reports for the audio device) is stored as the sync offset. Every song is then scheduled
that much earlier, so a tap that feels on the beat lands on the physics beat. Recalibrate after
switching headphones.

### Offline and app-store shell

`sw.js` is a network-first service worker: online it changes nothing (every load still fetches the
latest deploy), and when the network is gone it serves the last cached copy of the whole game, so
the home-screen and Play Store versions start without a connection. It registers itself on the
live site; on localhost only with `?sw=1`, and `?nosw=1` unregisters it anywhere. Bump `CACHE` in
`sw.js` if the precache list changes.

`privacy.html` is the privacy policy Google Play asks for, linked from the PRIVACY button on the
menu. Fill in the contact line before submitting. `.well-known/assetlinks.json` is the Digital
Asset Links file that lets the Android shell own the domain (no URL bar); replace the fingerprint
placeholder with the SHA-256 of the Play App Signing key that Bubblewrap or PWABuilder generates,
and keep `package_name` in step with the package you build.

### Rendering

The canvas keeps its 960x540 coordinate system but its backing store is sized to the CSS size
times the device pixel ratio (capped at 2x), so text and sprites are crisp on phones and large
monitors. The parallax backdrops are baked into tiles the first time they are drawn at a given
scale and blitted afterwards; gradients are cached; only animated details (twinkle, comet, flames,
aurora, glints) are drawn live. If a device still cannot hold roughly 45 fps the backing store is
stepped down to 1x, never lower. `?scale=<n>` pins the scale for testing.

## How the rhythm works

Every level declares its BPM and everything else derives from it in `src/constants.js`.
The distance per beat is always 180 px, so a faster song simply scrolls faster and the
obstacle geometry is identical between levels. Obstacles are placed in **beats** by the helper
functions in `src/level.js` (`S` spikes, `MS` mines, `OVER` blocks you jump over, `P` platforms,
`O` orbs, `GJ` water gaps, `FLIP` gravity portals), positioned so that pressing exactly on the
named beat puts the apex of the jump over the hazard. Drones bob on a two-beat cycle and are
highest exactly when an on-beat jump passes under them. After a `FLIP` portal every helper
places its objects relative to the ceiling instead of the floor, so a level reads the same
right side up or upside down. `ICE(startBeat, endBeat, multiplier)` declares a speed zone: the
builder's beat-to-pixel mapping integrates the multiplier, so obstacles inside the zone are
still placed on exact beats while the world scrolls faster. `LIFT(press, width, low, high, period)`
places a lock barge that is lowest exactly when the jump pressed on `press` lands on it and
highest half a period later; the player rides it and jumps off near the top. `LOWG(startBeat,
endBeat, k)` divides gravity by k inside a zone; every helper scales its apex offset by k, so a
low-gravity jump still lands its hazard on the beat.

The music is generated live with the Web Audio API. `src/audio.js` owns the instruments and the
16th-note scheduler; each level's file owns its arrangement. Every beat that requires a jump
gets an accent (a bright pluck and a clap) so the track itself tells you when to press. Jumps
within ±60 ms count as PERFECT, within ±120 ms as GOOD, and build the on-beat combo.

Physics runs on the audio clock at 240 Hz, so the game stays deterministic and in sync even if
the frame rate stutters. The clock itself is interpolated: `AudioContext.currentTime` only advances
once per hardware audio buffer (20 ms or more on phones), so `audio.js` measures its offset from
`performance.now()` at every audio tick and the physics target moves once per display frame. The
world is drawn at the frame's exact time between 1/240 s steps. `?quant=0.02&rawclock=1` reproduces
the old stepping for comparison; the `jitter` harness plan measures it.

## Tools

* `node tools/verify_level.js [levelId]` simulates a player pressing exactly on every jump beat
  for each level, checks the level is completable, prints the timing window (ms early / late)
  of every jump, and confirms a restart from every practice checkpoint still finishes.
* `node tools/shoot.js <plan> [outDir]` drives headless Chrome over the DevTools protocol
  (server must be running on port 8765) and captures screenshots. Plans: `menu`, `tour`,
  `ending`, `practice`, `audio` (Venezuela), `tour2`, `ending2` (Hormuz) and `tour3`, `ending3`
  (Greenland), `tour4`, `ending4` (Canada), `tour5`, `ending5` (Panama), `tour6`, `ending6` (Moon),
  plus `desk_pause`, `complete_tap` and `calib` (clicking the on-screen buttons and driving the sync
  calibration with synthetic taps) and, with `MOBILE=landscape`, `mobile_menu` and `mobile_rotate`,
  which emulate a phone with touch and walk the touch UI. `PERF_LEVEL=<id> THROTTLE=4 node
  tools/shoot.js perf` logs the JS time spent in draw() and the achieved frame rate under a 4x CPU
  throttle (`PERF_SCALE=1` pins the resolution). `swinstall` registers the service worker and waits
  for the precache; stop the web server and run `offline` on the same `PORT` to prove the game
  loads with no network. Set `PORT=` to run several at once.
* `node tools/make_icons.js` regenerates `icons/` (home-screen icons and the social preview) and the
  Play Store feature graphic `store/feature.png` from the running game.
* `STORE=1 node tools/shoot.js store store` renders the Play Store screenshots (1920x1080: the menu,
  one moment per mechanic, three endings) into `store/`; `store/listing.md` holds the listing copy and
  the Play Console form answers. The PNGs are not committed.

Debug URL parameters: `?level=greenland|venezuela|hormuz|canada|panama|moon`, `?autoplay=1`, `?start=<beat>`, `?noaudio=1`, `?mute=1`,
`?practice=1`, `?debug=1`.

## Files

```
index.html               page shell
style.css                layout
src/constants.js         physics constants, setTempo(bpm)
src/sprites.js           frame table for resources/sprite_sheet.png
src/level.js             level builder (beats -> objects, floor or ceiling), checkpoint rule
src/levels/greenland.js  Greenland: layout, palettes, music, death messages
src/levels/venezuela.js  Venezuela: layout, palettes, music, death messages
src/levels/hormuz.js     Hormuz: layout, palettes, music, death messages
src/levels/canada.js     The 51st State: layout, palettes, music, death messages
src/levels/panama.js     Panama Canal: layout, palettes, music, death messages
src/levels/moon.js       The Moon: layout, palettes, music, death messages
src/physics.js           deterministic player physics + collisions (spikes, blocks, mines, drones, water, gravity flip, ice speed zones, lock lifts, low gravity)
src/audio.js             instruments, scheduler and sound effects
src/render.js            canvas rendering, HUD, level-select menu, truck / toll-booth / map / border-sign / canal-gate / moon-plaque endings
src/game.js              game loop, input, state machine, ending cutscenes
manifest.json            home-screen install (landscape, fullscreen)
sw.js                    network-first service worker (offline fallback)
privacy.html             privacy policy (linked from the menu)
.well-known/assetlinks.json  Android app <-> domain link for the Play Store shell
icons/                   app icons + social preview (generated)
tools/verify_level.js    completability + timing-window verifier
tools/shoot.js           headless screenshot harness (desktop or emulated phone)
tools/make_icons.js      renders icons/ from the sprite sheet
```
