# Midnight Candy Run

<a href="https://brandeispatrick.github.io/web-engine/halloween/"><img src="../public/halloween/share.jpg" width="720" alt="A kid in a witch costume at a moonlit graveyard gate, a cloth ghost behind the fence"></a>

## 👻 [Play it in your browser](https://brandeispatrick.github.io/web-engine/halloween/)

Phone or computer, nothing to install. The first tap starts the game and the sound.

You're a kid in a witch costume on Halloween night. Grab as much candy as you can before the clock strikes midnight.
A round lasts 3 minutes, from 11:57 to 12:00.

The village: a lane loops past lit cottage porches, the graveyard gate and the witch's hollow; a haunted house stands on
a knoll; a creek cuts across the south with three footbridges (or jump it); Porch Row, the pumpkin patch, the Bale Yard
and a hollow oak in the far corner.

## How to play

**On a phone or tablet** (portrait or landscape)
- Put your left thumb anywhere on the left side to move. The stick appears under it.
- Drag on the right side to look around.
- Tap **JUMP** and **BOO!**

**On a computer:** W A S D or the arrow keys to move, the mouse to look (click the view), Space to jump, E to BOO,
Esc to pause, M for sound. A gamepad works too.

- **Candy** glows on the grass; run past it to collect it. Big swirl lollipops are worth 5.
- **Trick or treat:** a lit porch lamp means somebody is home. Step onto the glowing doormat and the door opens and
  candy pours out. Shout **BOO!** on the mat instead for a trick: more candy, but a ghost drops out of the chimney after
  you. A porch's lamp goes dark for a while after a visit and lights up again later. The haunted house only answers a
  trick. Visit all five cottages in one round for a **Full Round** bonus: each porch you have visited keeps a lit
  jack-o'-lantern on its post.
- **Jack-o'-lanterns:** run into one to kick it apart, or jump on it for more candy.
- **The creek:** cross on a footbridge or JUMP it anywhere. Fall in and it takes a JUMP at the bank to climb out (the
  candy in its bed is the reward).
- **Ghosts** chase you and steal candy when they touch you. Press **BOO!** when one gets close: it scares every ghost
  nearby, and each one drops 2 candies. BOO recharges in 5 s.
- **Grave hands:** when a ring of soil glows red and crackles, bony hands are about to burst out of it. **JUMP** over
  them, or **BOO!** them back down. If they catch you, they hold you for a second and you drop 3 candies.
- **The candy thief:** from 11:58 a raccoon in a little bedsheet runs to the candy you're heading for and eats it,
  stuffing its glowing pink sack. It keeps away from you. **BOO!** it when it's close to make it dizzy, then run into
  it to tag it: its whole sack spills out, plus 5 extra.
- **Streaks:** grab candy quickly, one after another. Every 10th in a row adds 3 bonus candy.
- **The Witching Hour:** in the last 30 seconds candy counts double, every lantern and porch lights up again and candy
  rains down around you. The hands come up twice as often, and the thief is back with a sack already full of candy.
- **Ranks:** the number after your candy count is the next rank. Your best score is saved on your device; once you have
  one, the clock shows now and then how far ahead of it (or behind) you are. Share your score from the results.

<p>
<img src="screenshots/phone-portrait.jpg" width="200" alt="Portrait gameplay with ghosts and the touch controls">
<img src="screenshots/phone-boo.jpg" width="440" alt="Landscape gameplay: a BOO scattering a ghost">
</p>

<details>
<summary>All controls</summary>

| | Phone / tablet | Keyboard + mouse | Gamepad |
|---|---|---|---|
| Move | left thumb anywhere on the left side (floating stick) | W A S D (↑ ↓ run too) | left stick |
| Look | drag on the right side | the mouse (START captures it; Esc frees it), ← → turn; if the browser won't capture it, click the view or hold the right mouse button; wheel zooms | right stick |
| Jump | JUMP | Space | A |
| BOO | BOO! | E (or F, B, Q) | X / B |
| Start / Play Again | TAP TO START / PLAY AGAIN | click, Enter / Space | A |
| Pause | the pause button, top right (also pauses when the tab is hidden) | Esc / P | Start |
| Sound | the speaker button (top right) or SOUND on the pause screen | M | Back / Select |
| Full screen | the corner-arrows button, where the browser allows it (Android Chrome, iPad; on iPhone use Add to Home Screen) | the same button | |

- Every button is at least 44 x 44 px and stays inside the safe area (notch, home indicator).
- On Android, short vibrations mark a candy, a smashed lantern, a BOO and a ghost's touch.
- On a laptop with a touchscreen, the touch controls appear with the first touch and hide when you press a key.
- The camera swings in behind you while you run forward, so one thumb is enough. You can turn the phone mid-round.
- On a touchscreen, pushing straight into a gravestone, a tree or a fence slides you round it.
- Smashes, BOO and catches shake the camera a little (less on phones). With reduced motion turned on in the device's
  settings, nothing shakes or zooms.

</details>

## How it was made

Built with Claude (AI agents) on this repository's engine, [`@vibe/engine`](../../README.md), and three.js. There are
no model, texture or sound files: the kid, the graveyard and the music are all made in code.

- **Hand-made look, in code:** every model is modelled procedurally (sweeps, lathes, extrusions) and hand-painted in
  vertex colours: the chibi witch kid with her bent hat, braids and starry cape; ribbed jack-o'-lanterns whose carved
  faces have depth (a mask texture and a parallax march into the cut); round-headed ghosts with cute faces; candy
  with three distinct silhouettes; gravestones with engravings, cracks and moss, wrought iron, gnarled trees, the
  crooked haunted house, the crypt, the scarecrow and the cauldron (`props.js`, reusable builders).

- **Cloth ghosts:** each ghost is a cloth sheet on the engine's XPBD physics, pinned to a moving head.
- **Fracture:** jack-o'-lanterns break into real physics pieces.
- **Synth audio:** music, ambience and effects are synthesized live. The music speeds up toward midnight.
- **Phone touch controls:** a floating stick, a cooldown ring on BOO, safe-area layout, portrait and landscape.
- **A night that builds to midnight:** the wind rises in gusts that bend the grass and the dead trees and blow autumn
  leaves past you (and kick them up as you run); clouds thicken and race across the moon, which dims the graveyard as
  they pass; the mist creeps in and pours out of graves when a ghost rises; soft lightning and thunder arrive in the
  last minutes, the lanterns gutter, the house lights blink, the gate creaks, and the moon turns blood red in the
  last seconds. Crows on the gate, the scarecrow and the stones take off when you run near. With "reduce motion" set
  on the device, it all moves slower and the lightning is a gentle glow.

The engine changes this game needed are opt-in and listed in the [CHANGELOG](../../CHANGELOG.md) under
"Unreleased".

<details>
<summary>What each file does</summary>

| File | What it does |
|---|---|
| `main.js` | Wires everything up: Engine (120 Hz fixed step, render interpolation, adaptive resolution), PhysicsWorld, CharacterController, AnimationController, camera rigs, CharacterInput with the phone touch layout, the night Atmosphere, PostFX and the round flow. |
| `kid.js` | The procedural skinned kid in one skinned mesh (chibi head with a toon face, braids, a bent witch hat, a pleated starry cape, striped stockings, curly boots, the glowing pumpkin pail), its own clips (idle, walk, run, jump) and a landing pose. |
| `props.js` | The modelling kit (sweep, lathe, slab, crack, star, chamfered boxes, Batch) and reusable prop builders: gravestones, iron fences and the gate, gnarled trees, the haunted house, the crypt, the scarecrow, the cauldron, hay bales, pumpkins and their leaves; the village's cottages with porches (lamp, doormat, railing jack-o'-lantern), footbridges, creek banks and reeds, standing stones, straw-bale stairs, the well, the signpost, the hollow oak, picket fences and path stones. |
| `world.js` | The map: the terrain (a knoll and a creek in one height function), the lane ring and its spokes, every landmark's place, the lantern and ghost spots, candy spawns by zone, the moon and the horizon; it exports the map the game rules build on (`PORCHES`, `HAND_SPOTS`, `BRIDGES`, `CREEK`, `POP_SPOTS`, `SECRETS`, `CAULDRON`, `VANTAGE`, `THIEF_DEN`). |
| `village.js` | Places the village (`props.js` builders) on the map with its colliders: the porch houses (each with a doorway for its door), the creek's bank walls and bridges, the Bale Yard, the standing stones, the hollow oak; and the creek's water (one additive mesh). |
| `pumpkins.js` | The jack-o'-lanterns (ribbed, a carved face with depth): lights from the `NearestLights` pool; smashing uses `fracturePieces` + `pieceGeometry`, real dynamic bodies on the `DynamicsWorld`, shaded with ribs, fibres and seeds. |
| `ghosts.js` | Each ghost is a `Cloth.grid` sheet pinned to a kinematic head sphere, drawn with `ClothMesh` (2x subdivided), a cute face painted through a uv warp, moved by a small state machine (rise, wander, chase, flee, retreat); `summon` sends one after the kid (a porch's resident). |
| `porches.js` | Trick-or-treat: the porch lamps and their cooldowns, treats and tricks (BOO on a lit doormat), the haunted porch, resident ghosts, candy trails to a porch that relights, the Full Round and its railing jack-o'-lanterns; the hinged doors (one instanced mesh). |
| `porch-spots.js` | The six porches `porches.js` drives: the map's (`world.js` `PORCHES`: the doormats on the porch decks, the lamps and railings as light groups, the chimneys). |
| `candy.js` | The candy pool: instanced meshes (wrapped sweets, candy corn, swirl lollipops, hand-shaded), the magnet and spilled candy. |
| `effects.js` | Glow billboards, the engine `ParticleSystem` sparks and the BOO ring. |
| `reach.js` | The faint ring on the ground that shows BOO's reach while a ghost is inside it. |
| `environment.js` | The living night, driven by the round clock: wind gusts, blowing and kicked-up leaves, clouds over the moon and the blood moon, creeping mist, lightning and thunder, crows, flickering lights, the swinging gate and their sounds. Animated on the GPU from a few uniforms (`setFinale(on)` pushes it to its peak). |
| `audio.js` | All synth sound on `AudioBus`: a D-minor music loop, ambience, effects and the midnight bells. |
| `hud.js` | The DOM title, HUD (candy and the next rank, the streak meter, the clock and the pace against your best, call-outs: hints at most one per 2.5 s), pause, how-to-play and results screens (rank ladder, porches and tricks, share), and the full-screen toggle. |

</details>

## Run it locally

```sh
npm install
npm run dev     # http://localhost:5190/halloween/
```

To play on a phone on the same Wi-Fi, run `npx vite --host` and open `http://<computer-ip>:5190/halloween/` on the
phone (`npx vite --host` prints the address). On iPhone, sound also needs the silent switch off.

`npm run build` writes it to `dist/halloween/`, and `npm run preview` serves the build at
http://localhost:5191/halloween/.

URL options: `?touch=1|0` (force the touch UI), `?quality=low|high` (touch devices default to low), `?nofx=1`, `?shadows=0`,
`?round=60` (round length in seconds), `?fps=30`.

## Tests

- `test/browser/halloween.mjs` plays the game in headless Chrome on a desktop and in phone emulation (iPhone, Pixel,
  small Android, portrait, landscape, rotation, two-thumb input). It checks controls, layout, pause, results and that
  five rounds in a row don't leak resources. Run `node test/browser/halloween.mjs`.
- `test/browser/halloween-media.mjs` captures the stills and short clips used for social posts.
