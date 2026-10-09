# Monster bag

This standalone app opens at `/monster-bag-app.html` and is listed on the home
screen. Its code lives in `src/monster-bag/`; Magic Bag is unchanged. School data,
item images, audio, monster artwork, the install icon, and the vendored Phaser
bundle are reused directly from `public/magic-school-bag/`. The existing
`src/magic-bag/school-data.ts` validation and media helpers are imported read-only.

Profiles and install-prompt preferences use the separate `monster-bag-*`
localStorage keys. The app has its own manifest and service worker; the worker
scope is limited to `monster-bag-app.html` so it cannot replace Magic Bag’s worker.

`monster-bag.ts` owns the Phaser layers and visual states. `main.ts` still owns
acceptance, card order, progress, audio, and completion. `packingCard` locks the
existing one-at-a-time flow until chewing ends; the packing promise resolves only
after that sequence (or resolves `false` on scene shutdown). Arrow Down, drag,
and the browser packing tool all use this flow. Taps only play the item's audio
and leave the card in the deck without advancing packing progress.

An accepted pointer press gives the card a subtle elastic scale pulse over 360ms
(touch, mouse, or pen): 1 → 0.96 → 1.025 → 0.992 → 1. Taps, clicks, and Enter/Space restart the feedback
while playing audio. The visible drag/packing preview repeats that feedback for
dragging and Arrow Down. Independent scale keeps the positioning transform
intact; feedback is canceled before measuring the resting card and on cleanup.
Reduced motion uses a brief opacity pulse. Missed drops return smoothly without shaking.

## Supplied artwork

The assets are under `public/magic-school-bag/assets/monster/`. Inspection of the
actual PNGs found:

| Asset | Size | Use |
| --- | --- | --- |
| `monster-bag-boy-body.png` | 1024 × 1092, RGBA | Mouthless, eyeless body; visible bounds `(6, 6)–(1018, 1086)` |
| `monster-bag-girl-body.png` | 1254 × 1254, RGBA | Mouthless, eyeless body; visible bounds `(119, 85)–(1134, 1166)` |
| `monster-bag-boy-eyes.png` | 1536 × 1024, RGBA | Required eye layer |
| `monster-bag-girl-eyes.png` | 886 × 864, RGBA | Required eye layer |
| `mouth.png` | 840 × 815, RGBA | Resting smile |
| `mouth-open.png` | 2172 × 724, RGBA | Eighteen unevenly spaced poses, opens left to right; frame 17 holds open |
| `mouth-chewing.png` | 2172 × 724, RGBA | Nineteen unevenly spaced poses; frame 9 is the closed middle mouth |
| `monster-bag-boy.png`, `monster-bag-girl.png` | 1254 × 1254, RGB | Assembled reference images, opaque backgrounds; not loaded |

Frame numbers are zero-based. There are faint alpha artifacts beyond the visible
mouths, so whole-image alpha bounds do not describe frame boundaries. Explicit
rectangles in `MONSTER.mouth` follow each visible pose, allowing edge padding.
Equal-width spritesheet slicing cuts into adjacent poses. Textures are cropped
with Phaser frames, without altering the source PNGs. Mouth textures use nearest
sampling to preserve sharp details at the small early-opening sizes; the existing
2–3× supersampled canvas smooths their edges. Body and eye filtering is unchanged.
All poses share one face
coordinate system. The resting/chewing mouth keeps its original
width; opening frames gradually grow to 1.75 times that width. Width, height, and eye
lift interpolate on every scene update between the nearest sprite poses, so
uneven crops do not cause size jumps. The upper lip stays anchored while the mouth
grows downward, and the eyes lift enough to leave a gap. Reversing a drag continues
from the current fractional pose. Accepted insertions open in up to 360ms
regardless of frame count; dragging selects the fractional pose directly by distance.
Body bounds are normalized to a height of 1080 in character space; eyes have variant-specific
placement and scale. All layers share the character container's uniform scale.

The same eye PNGs supply separate eyebrow and eye frames, split at source y=383
(boy) and y=318 (girl), in the gap above the eyes. The pupils are baked into these
images, so tracking gently shifts the eye artwork toward the dragged/swallowed
card instead of moving individual pupils. The gaze eases back after release or
swallowing. Brows stay steady relative to the face's mouth-clearance lift.
Blinking compresses only the eye region and blends to two Phaser-drawn closed-lid
curves, every 3–6 seconds with occasional double blinks. New blinks wait during
eating/chewing; active blinks finish. Downward gaze is included in mouth clearance.
Both effects run in the scene update loop, without extra listeners or tweens.
Reduced motion disables decorative gaze movement and blinking.

Chewing closes through frames 0 → … → 9 in 240ms, holds **frame 9** for three
subtle vertical cycles, then uses the remaining return poses 10 → … → 18 over 240ms
and settles into the resting smile over 60ms. This lets the last pose render
before the animation completes. Mouth height interpolates between these
poses, and the body stays still. Each strip pose is used once per sequence;
the closed-mouth bob remains the repeated chewing motion. Reduced motion skips
the vertical cycles and opens immediately.

## Tuning

Adjust the exported `MONSTER` configuration in `monster-bag.ts`:

- `height`, `centerY`: responsive scene size and position.
- `variants`: asset names, visible body/eye rectangles, eye/brow split, closed-lid
  centers/half-widths (source pixels), lid color, eye size, and face anchors.
- `eyes`: gaze limits, response speed, lid curve/stroke, blink interval/duration,
  and double-blink chance/gap.
- `mouth`: exact frame rectangles, resting width, `openScale` (1.75× fully open),
  `eyeGap`, opening/chewing transition durations, closed frame, chewing amplitude,
  cycles, and cycle duration. When replacing a strip with more poses, update its
  crop rectangles and the closed frame; the transition durations stay constant.
- `dropArea`: a 480 × 340 character-space rectangle centered on the fully-open
  mouth. Partial overlap with the visible card accepts a drop.
- `card.minDragScale`: the minimum card scale at the mouth (0.45).
- `proximity`: mouth-centered distance and range for opening.
  The mouth is fully open within normalized distance 1, rests at or beyond
  `shrinkDistance` (2.8), and moves through all opening poses between those limits.
- `eatingMs`, `completionPauseMs`: accepted-item travel and final feedback timing.

DOM pointer positions and the rendered card's bounds are converted to Phaser world
coordinates. The controller checks overlap with the smaller mouth rectangle in character
coordinates, accounting for card shrink and container scale. Acceptance happens on
release; moving over the monster alone does not pack an item. The food destination
remains at the mouth. Card shrinking starts as it moves closer, based on its remaining
distance divided by its starting distance to the mouth, smoothly going from full size
to 45%. Moving away restores its size. The unscaled grab offset measures progress,
so shrinking does not feed back into the distance calculation.
Anticipation starts once the pointer moves beyond the existing
7px drag threshold. Each scene update selects the opening-strip position from the
card center's mouth distance, in character coordinates so responsive scaling does
not change the response. A stationary card holds its pose; moving away reverses
the strip, and a distant card keeps the resting mouth. Canceling
or dropping outside the insertion area closes the mouth. Anticipation only changes
visual state. On accepted insertion, the item card is drawn in the character's food
layer above the body and mouth, then shrinks and fades into the face. Local item
images retain their aspect ratio; unloaded or external images use the existing
item emoji fallback.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`. Controller regression tests
cover mouth-area drops, partial card overlap and rejection beyond each edge at
different scales, card shrinking from different starting positions, all distance-driven
opening poses in both directions and along horizontal, vertical and diagonal
approaches, stationary holds, cancellation, smaller
open-mouth size, eye clearance, opening before eating, single callbacks, a stable
body during closed-mouth chewing, all return poses, interpolation within one
sprite, consistent timing with irregular updates, scaled and bounded gaze, eye-only blinking,
double-blink limits, shutdown, both variants, and reduced motion.

In a browser, check both genders on desktop and mobile: approach without dropping,
move away while holding the card (mouth closes), hold a card at an intermediate
distance (opening stays fixed), cancel a drag, release just
outside insertion range, accept a drop, tap rapidly, use Arrow Down, complete the
last item, and replay. Also restart/change
profile or resize across the mobile breakpoint during an animation. Existing
packed IDs are preserved on responsive restart; incomplete insertions return to
the deck. A profile change follows the existing full-restart behavior.
