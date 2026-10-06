# Magic Bag

`magic-bag-app.html` hosts one full-viewport Phaser canvas. The vendored Phaser 4.2.1 bundle remains in `public/magic-school-bag/vendor`; no additional package or CDN is needed.

- `main.ts` owns the packing scene, artwork, drag/return/packing animations, progress, completion, recorded audio and app lifecycle.
- `canvas-card.ts` paints equipment cards into Phaser canvas textures. The original card typography and image dimensions stay in screen pixels while the artwork follows the game viewport.
- `canvas-shell.ts` paints the toolbar, day chooser, profile, day-start and installation dialogs, and routes their Phaser input.
- `school-data.ts` validates the existing JSON data and computes equipment in timetable order.

All visible app controls render through Phaser. Invisible native controls provide screen-reader semantics, keyboard navigation and the mobile name-entry keyboard. They are an accessibility/input bridge, not a visible HTML UI. Keep that boundary when adding controls.

Preserve the page URL, the `magic-bag-kid-profile` and `magic-bag-install-suggestion-dismissed` storage keys, the two profile palettes, and the explicit day-start gate. Tapping equipment requests its recording; dragging it into the bag packs it. Only the front item can be packed, and resizing retains already packed items.

Run `npm run dev` for development, and validate changes with `npm run lint`, `npm test`, and `npm run build`. Browser checks should cover actual touch and mouse dragging, return animation, completion/replay, profile editing, mobile resizing and the hidden keyboard controls. Compare the existing visual layout at multiple mobile viewport sizes when changing rendering.
