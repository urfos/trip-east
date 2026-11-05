# Trip East: project summary

Trip East is a static web page about a family trip. Four cartoon characters with photo heads travel across a simple map of Europe: by bus from Paris to Lausanne, by train from Lausanne to Weisendorf (near Erlangen), and by bus again from Weisendorf to Prague. Each tap or key press drives one leg. When the vehicle arrives, the town's photos open in a full-screen viewer, one by one, with a button to go back to the map. There is no framework, no bundler and no npm: plain HTML, CSS and JS, plus a few Python build scripts.

The first version of the project was a flip-book photo album. It was replaced by this trip on the `characters-map` branch; the album is in the history of `main`.

- **Live site:** https://urfos.github.io/trip-east/
- **Repo:** https://github.com/urfos/trip-east (public, branch `main`). GitHub Pages serves the repo root of `main`, so a push deploys the site.
- **Local preview:** `python3 -m http.server 8000` in the project root, then open http://localhost:8000. Opening `index.html` directly with `file://` does not work, because `fetch()` of the JSON files is blocked there.

## The trip

| Leg | Vehicle | Passengers |
|---|---|---|
| Paris → Lausanne | bus | Ilya, Masha, Iero |
| Lausanne → Weisendorf | train | Ilya, Masha, Iero, Lada |
| Weisendorf → Prague | bus | Ilya, Masha, Iero, Lada |

Relative heights: Ilya is about 10% taller than Masha and Lada; Iero is about 25% shorter. Each town has a cartoon landmark next to it: the Eiffel tower (Paris), a lake in the mountains (Lausanne), the church (Weisendorf) and the astronomical clock (Prague). Small country flags mark France, Switzerland, Germany and Czechia.

## Public and local content

The repo and the site are public, and the trip shows family members and children. So every real picture exists only on the local machine (gitignored), and the published site uses stand-ins:

| Real (local only, gitignored) | Public stand-in (committed) | The page uses the real one when… |
|---|---|---|
| `photos-local/*.jpg` + `photos.local.json` | `photos/*.svg` (coloured rectangles) + `photos.json` | `photos.local.json` loads |
| `avatars-local/<id>.png` (photo heads) | `avatars/<id>.svg` (cartoon heads) | the PNG loads (and the URL hash is not `#public`) |
| `audio/*.mp3` | none (silence) | the file loads |
| `pics/` (originals) | none | never used by the page |

**Never commit `pics/`, `photos-local/`, `photos.local.json`, `avatars-local/` or `audio/`.** They are all in `.gitignore`.

## Files

| Path | What it is | Edit by hand? |
|---|---|---|
| `index.html` | Page shell: the `#stage` SVG, the hint text (`#hud`) and the photo viewer markup. Loads the scripts in dependency order. | Rarely |
| `app.js` | The flow: tap → drive a leg → zoom out → open the town's photos. Loads `map.json` and the photo manifest. | Yes |
| `travel.js` | Draws the map, the routes, landmarks and city labels; drives the vehicles; moves the camera. | Yes |
| `vehicles.js` | Side-view bus and train (locomotive plus cars) with the passengers in the windows. | Yes |
| `characters.js` | The four characters: SVG bodies with a photo head. Heights, colours and head placement are in `CHARACTERS`. | Yes |
| `viewer.js` | Full-screen photo viewer (one photo at a time, buttons, arrow keys, swipe, Escape) and the road photo pop-up. | Yes |
| `music.js` | Background music: one track at a time with 1.5 s fades; the old track fades out fully before the next fades in. | Yes |
| `texts.js` | Every visible and screen-reader text in English and Russian (`TripTexts.en`, `TripTexts.ru`), including the Russian city names in each grammatical case. | Yes: all wording changes go here |
| `intro.css` | The title page with the language buttons, shown over the map until a language is chosen. | Yes |
| `assets/fonts/UnifrakturMaguntia.woff2` | Blackletter font for the English title (SIL Open Font License). | No |
| `assets/fonts/RuslanDisplay-*.woff2` | Old-Russian-style font for the Russian title (SIL Open Font License), Cyrillic and Latin parts. The fonts are self-hosted so the page makes no outside requests. | No |
| `travel.css`, `characters.css`, `viewer.css` | Styles for the map, the characters' idle animation and the viewer. | Yes |
| `map.json` | Countries, cities, routes and landmark positions in SVG units. | **No.** Regenerate. |
| `assets/landmarks/*.svg`, `assets/flags/*.svg` | Cartoon landmarks and flags. | Yes |
| `photos-local/` | The curated real photos (see below). **Gitignored.** | Yes: this is where you choose photos. |
| `photos.local.json`, `photos/*.svg`, `photos.json` | Generated photo manifests and placeholders. | **No.** Regenerate. |
| `avatars-local/*.png` | Cropped real heads. **Gitignored.** | **No.** Regenerate. |
| `avatars/*.svg` | Public cartoon heads. | Yes |
| `audio/` | Music for each town and for the road. **Gitignored, local only.** | Yes |
| `map-preview.html`, `characters-preview.html` | Development pages for checking the map and the characters on their own. | Yes |
| `idea_phase2.md` | The original brief for this version. | No |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. | No |

## Scripts

All scripts are in `scripts/` and use only the Python standard library.

- **`index_photos.py`**: run it after any change in `photos-local/`. It reads the folder as the source of truth and never deletes or reconverts files. It:
  1. sorts the files into towns and roads by name (see "Photo naming" below), in filename order;
  2. turns each photo upright and removes EXIF/XMP metadata, **including GPS**, in place. **Do not remove this step;**
  3. writes `photos.local.json`, then calls `make_placeholders.py`.
  It needs macOS `sips` only when a photo has to be rotated.
- **`make_placeholders.py`**: writes `photos/*.svg` and `photos.json` from `photos.local.json`. There is one coloured rectangle per photo, with the same order and proportions. Any OS.
- **`build_map.py`**: writes `map.json`. The cities, the route waypoints, the landmark offsets and the flag positions are constants at the top. It downloads Natural Earth country shapes once into `.cache/` (gitignored). Any OS.
- **`make_avatars.py`**: downsizes and crops `pics/avatars/<id>_av.png` into `avatars-local/<id>.png`. macOS only (`sips`).
- **`build_photos.py`**: the old album pipeline, which converted `pics/<City>/` into `photos-local/`. **Do not run it.** It deletes every `photos-local/*.jpg` and rebuilds from `pics/`, which would erase the curated selection. The other scripts import its EXIF and JPEG helpers.

### Photo naming

| File name in `photos-local/` | Meaning |
|---|---|
| `<city>-<anything>.jpg` | A photo of that town, e.g. `lausanne-IMG_6321.jpg` |
| `<from>-to-<to>.jpg` | The photo for that road, e.g. `paris-to-lausanne.jpg` |

Each `src` in `photos.local.json` ends in `?v=<first 8 hex digits of the file's MD5>`. When a file is replaced or renamed onto another photo's name, its URL changes, so the browser can't keep showing a cached old picture (it would otherwise, even after Cmd + Shift + R, because the viewer loads photos after the page). City names match `map.json`, without regard to case. `.jpg` and `.jpeg` both work. Files with no city prefix are skipped with a warning. Photos without an EXIF date get `"taken": null, "exact": false`. The page doesn't show dates; `taken` is kept in the manifest only as information.

The structure of `photos.local.json` (and `photos.json`) is:
```json
{"chapters": [
  {"city": "Lausanne", "photos": [
    {"src": "photos-local/lausanne-IMG_6321.jpg", "w": 1200, "h": 1600, "taken": null, "exact": false}
  ]}
 ],
 "roads": [
  {"from": "Paris", "to": "Lausanne",
   "photo": {"src": "photos-local/paris-to-lausanne.jpg", "w": 1200, "h": 1600, "taken": null, "exact": false}}
 ]}
```

## How the trip works

### Flow (`app.js`)
The page opens on a title page (`#intro`): "Going East!" and "October 2026" (or «На восток!» and «Октябрь 2026») in sepia on the map's land colour, with the four landmark drawings scattered at different heights along a sepia dashed route (positions as `--x`/`--y`/`--h` percentages in `index.html`; the route's SVG viewBox has the same 760:300 proportions as the box, so it stays attached at any width) and two language buttons, **English** and **Русский**, below. Only those buttons close it: pressing one sets the language, saves it in `localStorage` (`trip-east-lang`) and fades the page out (0.6 s, matching `intro.css`) without starting the bus. Debug hashes skip it.

### Languages (`texts.js`)
- Before a button is pressed, the language is: `#lang=` in the URL, else the saved choice, else Russian if the browser's language is Russian, else English. `app.js` applies it before anything loads, so the title page appears in that language at once.
- Elements in `index.html` name their text with `data-t="key"` (text) or `data-t-aria="key"` (`aria-label`); `applyTexts()` fills them in. Text built in code (the hints, the road photo caption, the viewer's labels, the city labels on the map via `travel.setLabels()`) reads `T()`, the current language's entry, at the moment it is shown.
- City names stay English everywhere in the data (`map.json`, the photo manifest, the audio files). `T().city(name)` gives the display name; Russian also needs the "to" and "in" forms (`в Лозанну`, `в Лозанне`), kept in `RU_CITY`.
- `<html lang>` follows the language, and `intro.css` uses it to set the Russian title in Ruslan Display (the blackletter font has no Cyrillic).
- To add a language: add an entry to `TripTexts` with the same keys and a button with `data-lang` on the title page.

`at` is the index of the city the vehicle is parked in (0 = Paris). A tap anywhere (not on a button) or a key press calls `advance()`:
1. The camera goes back to following the vehicle if it is zoomed out.
2. `travel.travelLeg(at, roadStop(at), stopAt(at))` drives the leg. It starts with a close-up on the passengers. A leg takes its route length / `SPEED` (40 map units per second), clamped to 6.75–18 s (`travel.js`). If the leg has a road photo, the drive is two eased parts: the vehicle slows to a stop at the photo stop (halfway by default; `ROAD_STOP_AT` in `app.js` sets another share per road, e.g. 0.2 on the way to Weisendorf), the photo pops up as a tilted card (`TripViewer.createPopup`), and a tap or key press closes it and the vehicle drives on. Input in the card's first 400 ms is ignored, so a stray tap doesn't close it unseen.
3. `at++`, and the camera zooms out to show the whole trip.
4. The arrival town's photos open in the viewer. `advance()` waits until the viewer is closed.

`busy` blocks taps during all of this. After Prague the hint says "The end. Tap to start over".

### Music (`music.js`)
`audio/road.mp3` plays while a vehicle drives, including the midway photo stop. `audio/<City>.mp3` starts on arrival and keeps playing while the town's photos are open and until the next departure. Paris has no track, so the trip starts silent. `TripMusic.create(files, { resume })` returns `{ play(name), stop(), unlock() }`:
- `play()` fades the current track out over 1.5 s, and only then starts the new one and fades it in over 1.5 s (no crossfade). If nothing is audible, the new track starts at once. Switching again during the gap cancels the pending start. A track that runs out fades out over its last 1.5 s and then stays silent.
- Tracks listed in `resume` (only `road`) continue where they stopped; the others start from the beginning.
- `levels` sets each track's full volume: the road plays at 0.65, the towns at 1.
- The speaker button in the bottom-left corner (two flat white SVG icons in `index.html`; `travel.css` shows one according to `aria-pressed`) mutes and unmutes the music; it sits above the photo viewer too. Muting keeps the music running silently, so unmuting picks it up where it is now. The choice is saved in `localStorage` (`trip-east-muted`). The button stays hidden until an audio file loads (`onAvailable`), so the public site, which has no audio, doesn't show it.
- `unlock()` is called on every tap and key press. On the first one it briefly plays every idle track muted, because browsers (Safari especially) only allow sound that starts from a user gesture. `advance()` calls `play("road")` before its first `await`, so it still counts as part of the tap.
- A missing file (always the case on the public site) just means silence.
- On iPhone and iPad, Safari ignores `volume`, so the fades there are hard cuts. Fixing that would need the Web Audio API (a gain node per track).

### Map and camera (`travel.js`)
- Everything is drawn in one SVG in map units. The camera is the SVG `viewBox`: `cam` holds the centre and width, and `frame()` eases it towards `target` every animation frame. Zoom changes evenly in log scale.
- Two camera modes: `follow` (close on the vehicle, with a tighter close-up during the first 15% of a leg) and `overview` (the extent of cities, routes and landmarks plus 40% padding).
- City labels are HTML laid over the SVG, not SVG text, so they keep one font size at any zoom. City dots are resized every frame for the same reason.
- Each leg has its own vehicle. Only the active one is visible. `p` (0–1) is the progress along the route path. At both ends the vehicle eases from the route's slope to standing level, so it parks flat in the city.
- `setCamera()` resolves when the camera has arrived; `travelLeg()` resolves on arrival.

### Vehicles and characters
- A vehicle is a list of pieces: a bus is one piece, a train is a locomotive plus cars. Each piece follows the route on its own, so the train bends around curves. The tilt is capped at 70°.
- Passengers stand behind the windows and are clipped to the window band, so only heads and shoulders show.
- Characters bob, sway their heads and swing their arms with CSS animations (`characters.css`). The animations are off under `prefers-reduced-motion`.

### Photo viewer (`viewer.js`)
`TripViewer.create(root)` returns `{ open(city, photos), close(), isOpen() }`. `open()` returns a promise that resolves when the viewer closes: the Back to map button, Escape, or "next" on the last photo (the › button, → key or a left swipe). Changing photos slides the old one out and the new one in from the side (Web Animations API, skipped under `prefers-reduced-motion`). Each change bumps a `swap` counter, so quick taps skip straight to the latest photo instead of queueing. It preloads the next and previous photos.

### Debug URL hashes
| Hash | Effect |
|---|---|
| `#at=N` | Start parked in city N (0 = Paris) |
| `#leg=N&t=0.5` | Freeze partway through leg N |
| `#view=overview` | Start zoomed out |
| `#photos=N` | Open the viewer for city N |
| `#road=N` | Stop at leg N's photo stop and show its road photo |
| `#public` | Use the cartoon heads even if `avatars-local/` exists |
| `#lang=ru` | Use this language and skip the title page (`en` or `ru`) |

Hashes can be combined, e.g. `#at=2&view=overview`.

## Common tasks

**Change the photos:** add, remove or rename files in `photos-local/`, then run `python3 scripts/index_photos.py`. Commit `photos/` and `photos.json` (the placeholders). New photos taken with a phone should be resized first (the current ones are at most about 1600 px on the long side).

**Move a city, a route or a landmark:** edit the constants in `scripts/build_map.py`, run it, and commit `map.json`.

**Change a character's height, colours or head position:** edit `CHARACTERS` in `characters.js`. Use `characters-preview.html` to check the result.

**Deploy:** merge into `main` and push. Pages rebuilds in about a minute. You can check the build with `gh api repos/urfos/trip-east/pages --jq .status`; the expected value is `built`.

**Check a change visually without clicking through:** take a headless Chrome screenshot, using a debug hash:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1400,850 --virtual-time-budget=6000 \
  --screenshot=out.png "http://localhost:8000/#leg=1&t=0.5"
```
Headless Chrome will not make the window narrower than about 500px, so it cannot show true phone widths. With `--virtual-time-budget`, CSS transitions and Web Animations do not run to the end: fades are captured half-way, and the viewer never swaps to the next photo. Add `--force-prefers-reduced-motion` to see final states. To test timing-dependent behaviour, run headless Chrome in real time with `--remote-debugging-port` (which keeps it open) and have the test page `fetch()` its results to a local server.

## Gotchas
- **Privacy:** keep the metadata removal in `index_photos.py`, and keep `<meta name="robots" content="noindex, nofollow">` in `index.html` and the preview pages.
- **Do not run `build_photos.py`:** it erases the curated `photos-local/`.
- **Generated files:** never edit `map.json`, `photos.json`, `photos.local.json` or `photos/` by hand. A rebuild overwrites hand edits.
- **Browser cache:** `python3 -m http.server` sends no caching headers, so after editing JS or CSS the browser may keep running the old copy. Reload with Cmd + Shift + R, or tick "Disable cache" in DevTools.
- **No seeking with `http.server`:** it does not support HTTP range requests, so audio can't jump to the middle of a file (restarting from 0 works). The app never needs to seek; just don't rely on it in tests.
- **Script order in `index.html`:** `texts.js` → `characters.js` → `vehicles.js` → `travel.js` → `viewer.js` → `music.js` → `app.js`. Each one uses globals (`TripCharacters`, `TripVehicles`, …) from the ones before it.
- **macOS:** Pillow is **not** installed. The command `awk` (gawk) is broken on this machine, so avoid it in shell commands.

## Roadmap (from `idea_phase2.md`)
- [x] Characters with photo heads and relative heights
- [x] Map of Europe with the route and the cartoon landmarks
- [x] Bus → train → bus, with the right passengers on each leg
- [x] Tap or key press to drive a leg
- [x] Town photos one by one on arrival, with Back to map
- [x] One photo per road: the vehicle pauses midway, the photo pops up, and a tap closes it and the trip continues
- [x] Music for each town and for the road, with a 1.5 s fade in and fade out (local only: `audio/Lausanne.mp3`, `Weisendorf.mp3`, `Prague.mp3`, `road.mp3`)
