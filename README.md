# Palmar Bay — an open-world crime game

A sun-soaked modern coastal city you can explore on foot and by car, built
for the make.fun gta6-01 bounty. All original: the city, characters,
vehicles, story, art and sound are ours — nothing from any commercial game.

## The game

You are Jax Carter, a getaway driver in Palmar Bay. Take jobs from Mama Rosa,
steal cars, outrun the Palmar Bay Police Department, and work your way up
through six story missions — from a first fare across town to the big bank job
on the pier.

- A full 3D coastal city: downtown towers, beachfront, suburbs, a pier
- On foot and by car, with traffic, pedestrians, and cars you can steal
- A wanted system (1–5 stars) with police cars and officers who chase you
- Six story missions with dialogue, objectives, and cash rewards
- Combat on foot, a HUD with a live minimap, start screen, and save game
- Procedural sound: engine, sirens, gunshots, and a synth radio loop

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Orbit camera (click the game to lock the mouse) |
| Shift | Sprint / boost |
| Space | Jump (on foot) / handbrake (in a car) |
| E | Enter / exit a car, steal the nearest car |
| Left click | Shoot (on foot, pistol) |
| H | Horn |
| M | Mute |
| Esc / P | Pause |

## How to run

No build step, no network. Serve `game/` with any static server and open
`index.html` in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, taken
by playing it in a headless browser. Each one is staged by a preset in
`game/src/shots.js`, which plays the real rules forward from a fresh game —
an autopilot holding the keys a player would hold — and raises
`window.__shotReady` when the scene has settled:

| Shot | Preset | What it shows |
| --- | --- | --- |
| `1-cover.jpg` | `?shot=cover` | A three-star chase down the north avenue, police closing in |
| `2-street.jpg` | `?shot=street` | Jax on foot downtown, walking to Rosa's Cafe |
| `3-mission.jpg` | `?shot=mission` | Mission 2, Borrowed Wheels — the red Comet GT at Comet Motors |
| `4-wanted.jpg` | `?shot=wanted` | Three stars on foot, a PBPD car bearing down on Jax |

Open any `?shot=` URL in a desktop browser to see the same scene live.

## Entry program

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into `/output` and writes `/output/dossier.json` with the vendored
`vendor/makefun-game.ts` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see LICENSE.
