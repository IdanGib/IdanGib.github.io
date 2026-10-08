# Monster bag

`monster-bag.ts` owns the Phaser layers and visual states. `main.ts` still owns
acceptance, card order, progress, audio, and completion. `packingCard` locks the
existing one-at-a-time flow until chewing ends; the packing promise resolves only
after that sequence (or resolves `false` on scene shutdown). Tap, Arrow Down, drag,
and the browser packing tool all use this flow. Taps also retain their item audio.

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
| `mouth-open.png` | 2170 × 725, RGBA | Five unevenly spaced poses, opens left to right; frame 4 holds open |
| `mouth-chewing.png` | 2172 × 724, RGBA | Seven unevenly spaced poses; frame 3 is the closed middle mouth |
| `monster-bag-boy.png`, `monster-bag-girl.png` | 1254 × 1254, RGB | Assembled reference images, opaque backgrounds; not loaded |

Frame numbers are zero-based. There are faint alpha artifacts beyond the visible
mouths, so whole-image alpha bounds do not describe frame boundaries. Explicit
rectangles in `MONSTER.mouth` follow each visible pose, allowing edge padding.
Equal-width spritesheet slicing cuts into adjacent poses. Textures are cropped
with Phaser frames, without altering the source PNGs. All poses share one face
coordinate system. The resting/chewing mouth keeps its original
width; opening frames gradually grow to twice that width. The upper lip stays
anchored while the mouth grows downward, and the eyes lift enough to leave a gap.
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

Chewing closes through frames 0 → 1 → 2 → 3, holds **frame 3** for three subtle
vertical cycles, then returns through 2 → 1 → 0 to the resting smile. The body
stays still. The full seven-frame strip is never played as a repeated chewing
loop. Reduced motion skips the vertical cycles and shortens entry motion.

## Tuning

Adjust the exported `MONSTER` configuration in `monster-bag.ts`:

- `height`, `centerY`: responsive scene size and position.
- `variants`: asset names, visible body/eye rectangles, eye/brow split, closed-lid
  centers/half-widths (source pixels), lid color, eye size, and face anchors.
- `eyes`: gaze limits, response speed, lid curve/stroke, blink interval/duration,
  and double-blink chance/gap.
- `mouth`: exact frame rectangles, resting width, `openScale` (2× fully open),
  `eyeGap`, frame rates, closed frame, chewing amplitude, cycles, and cycle duration.
- `proximity`: insertion ellipse in character coordinates and the drag shrink
  range. Its dimensions stay fixed and its center matches the fully open mouth.
- `eatingMs`, `completionPauseMs`: accepted-item travel and final feedback timing.

DOM pointer and item positions are converted to Phaser world coordinates. The
controller then converts the item center to character coordinates, including
container scale. Anticipation starts once the pointer moves beyond the existing
7px drag threshold and holds for the whole drag, regardless of proximity. Canceling
or dropping outside the insertion area closes the mouth. Anticipation only changes
visual state. On accepted insertion, the item card is drawn in the character's food layer, above the body and behind
the mouth, so it disappears into the face. Local item images retain their aspect
ratio; unloaded or external images use the existing item emoji fallback.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`. Controller regression tests
cover scaled insertion geometry, drag anticipation, reversal/cancellation, double
open-mouth size, eye clearance, opening before eating, single callbacks, a stable
body during closed-mouth chewing, scaled and bounded gaze, eye-only blinking,
double-blink limits, shutdown, both variants, and reduced motion.

In a browser, check both genders on desktop and mobile: approach without dropping,
move away while holding the card (mouth stays open), cancel a drag, release just
outside insertion range, accept a drop, tap rapidly, use Arrow Down, complete the
last item, and replay. Also restart/change
profile or resize across the mobile breakpoint during an animation. Existing
packed IDs are preserved on responsive restart; incomplete insertions return to
the deck. A profile change follows the existing full-restart behavior.
