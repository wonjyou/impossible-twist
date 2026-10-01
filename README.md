# Impossible Twist

Nine black-and-white impossible structures you can twist, drawn in smooth 3D.
There is nothing to win: pick a structure, turn it, tip it, and watch it line up
into something that could not exist.

This is the smooth-rendered sibling of `../impossible-cat`, which draws the
first structure as a 1-bit etched pixel plate with a cat to walk around it.

## The structures

Step through them with the ‹ and › buttons at the bottom of the screen. Each one
opens in its front view, which is where its illusion holds.

| # | Name | Theme |
| --- | --- | --- |
| 1 | Cloister | A ring of walks around a court, tied together by three flights of stairs. |
| 2 | Tribar | The Penrose triangle. Three straight beams and three right angles; twist it and it falls open into a zigzag. |
| 3 | Tessellation | A slope of cubes that reads as steps rising, or as steps hanging overhead. |
| 4 | Relativity | After Escher's *Relativity*. One room with three floors, each with its own stair, doorway and idea of down. |
| 5 | Lattice | After Escher's *Cubic Space Division*. Beams running every way at once. |
| 6 | Spire | A stair winding around a single column, one landing at every corner. |
| 7 | Aqueduct | After Escher's *Waterfall*. A level channel that zigzags away and ends two storeys above where it began. Twist it and it turns out to be flat. |
| 8 | Ascent | After Escher's *Ascending and Descending*. Four flights of stairs that climb all the way round to where they began. Twist it and it is a spiral whose ends are four storeys apart. |
| 9 | Crossing | After Monument Valley. A bridge runs level from a tall tower to the top of a short one. Twist it and the bridge stops in mid-air, three storeys above the walk it seemed to join. |

These are original geometry built on the same illusions, not copies of the
prints or of any game level.

## Run it

Open `index.html` in a browser. Nothing to install or build.

If you would rather serve it:

```bash
node serve.js
```

Then visit http://localhost:8766.

## Controls

The same list is available in the app: press the **?** button in the top-right
corner, or press `?` or `H`. `Esc`, the "Got it" button, or a click outside the
panel closes it.

| Input | What it does |
| --- | --- |
| Drag left / right | Turn the structure around. |
| Drag up / down | Tip it over. The side under your pointer rolls up to become the floor, or down to become a wall. |
| Let go | It settles into the nearest of its 24 resting positions. A quick flick carries it to the next one. |
| `←` `→` | Turn a quarter turn. |
| `↑` `↓` | Tip the left side up or down. |
| `Shift` + `↑` `↓` | Tip the right side up or down. |
| ‹ and › buttons | Previous or next structure. |
| `P` `N` (or `[` `]`) | Previous or next structure. |
| `1` – `9` | Jump straight to a structure. |
| `?` or `H` | Open or close help. |

Each drag turns the structure about one axis only, chosen by the direction you
first move in. Arrow keys are ignored while help is open.

## How the illusion works

- The camera is a true isometric view looking down the cube's (1,1,1) diagonal.
  That diagonal projects to a single point, so two floors any whole number of
  levels apart can land edge to edge on screen.
- Every face is shaded by its direction alone, from one light fixed to the
  camera. At rest all floors are the same white, all left walls the same mid
  grey and all right walls the same dark grey, so floors that line up show no
  seam. There are no outlines or shadows to give the depth away.
- Mid-twist the tones shift with the angle and the structure shows its real
  shape.
- Cloister and Relativity are one motif repeated three times around the camera
  diagonal, which is why some twists bring back a familiar view.
- Tribar is an open chain of three beams whose loose ends sit five cells apart
  along the camera diagonal. The near end has no end cap and faces are
  one-sided, so the far beam shows through and the corner looks solid.
- Aqueduct uses the same trick three times. Its channel is flat; each post is
  only three cells tall, and its open top lines up with a channel corner four
  cells further back, so the posts appear to lift the channel a storey at a time.

### What can and cannot be rebuilt this way

Every illusion here comes from one fact: depth along the camera diagonal is
invisible. That covers *Waterfall*, *Ascending and Descending*, the Penrose
triangle, and Monument Valley's bridges that only connect from one angle.

It does not cover pictures such as Escher's *Belvedere* or the impossible cube,
where a far beam is drawn passing in front of a near one. No real object
produces that from any angle, so it would have to be faked by drawing things in
the wrong order rather than built.

The view also keeps each structure centred in the frame as it turns.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page, styles, title, structure switcher, and the help panel. |
| `main.js` | The structure definitions, WebGL rendering, twisting, switching, input, and help toggle. No libraries. |
| `serve.js` | Optional static server on port 8766. |

## Changing it

- **Structures:** edit or add to `STRUCTURES` near the top of `main.js`. Each has
  a `name`, a `theme` line, and `parts` on a lattice of unit cells: `cube`,
  `line`, `box`, `void` (cut cells out), `stair`, and `open` (leave one face
  off). Set `sym: true` to repeat every part three times around the camera
  diagonal. The view scales to fit, and the switcher and number keys pick up new
  entries automatically (the help text says 1–9, so update it if the count changes).
- **Tones:** the fragment shader in `main.js` sets the three resting greys with
  one line. The page background is the gradient on `body` in `index.html`.
- **Feel:** `quarterPx()` sets how far you drag for a quarter turn, and the
  durations in `release()` and `twist()` set how quickly it settles.

## Notes

- Needs WebGL. If it is unavailable the title reads "WebGL is not available".
- Tested with mouse and keyboard in a desktop browser. Touch uses the same
  pointer events but has not been tried on a device.
