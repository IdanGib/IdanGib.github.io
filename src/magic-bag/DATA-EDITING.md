# Editing the Magic School Bag data

The site reads `public/magic-school-bag/ori-data.json` when it opens. Edit this file and publish the Site again to make changes visible. The game does not save edits made in a visitor's browser.

## Change an item's name, book picture, and recording

Find the item under `items` by its stable ID. For example, `science-book` is the book called פלא טבע:

```json
"science-book": {
  "label": "פלא טבע",
  "icon": "📗",
  "imageUrl": "https://example.com/my-book-cover.jpg",
  "audioUrl": "https://example.com/put-science-book-in-bag.mp3",
  "color": "#52cfa3"
}
```

- `label` is the text on the card and in the packing instruction. You can edit it in Hebrew.
- `imageUrl` is a direct link to a picture (`.jpg`, `.png`, `.webp`, etc.). Leave it empty (`""`) to show the emoji instead. A broken image link also falls back to the emoji.
- `audioUrl` is a direct link to a recorded prompt for this item (`.mp3`, `.m4a`, `.wav`, etc.). Leave it empty for silence. Recordings play after the child has interacted with the game; browsers may prevent sound before that.
- `icon` is the fallback emoji. `color` controls the item's tint and border.

Use HTTPS URLs that open the media file directly without a sign-in. You can also put your files inside `public/magic-school-bag/assets/` and use paths such as `"./assets/science-book.jpg"` and `"./assets/science-book.mp3"`. The files must be published alongside the JSON. A Google Drive sharing page, for example, is not a direct image or audio file URL.

You may add `imageUrl` to any item, including notebooks and folders; it is already present as an empty field on the book and workbook entries. An item ID connects it to a subject's `itemIds`, so keep IDs unchanged when changing a name or picture.

## Change general messages and sounds

- `subjects.<subjectId>.label` changes the subject shown above each item card.
- `days[].lessons[].label` changes the displayed timetable wording. Keep the array in lesson order and preserve repeated lessons.
- `generalAudio.appEntry.textTemplate` is the one-time welcome message. Keep `{day}` where the selected weekday belongs.
- `generalAudio.appEntry.humanAudioByWeekday` contains the six human recordings, keyed from Sunday (`"0"`) through Friday (`"5"`).
- `generalAudio.finalDialog` keeps the final message text and its human recording together. It plays only when the final dialog opens.
- `generalAudio.soundEffects` is deliberately separate from speech. It is currently empty, so the app plays no sound effects. Future effects can be added here without confusing them with voice recordings.

For example:

```json
"finalDialog": {
  "text": "כל הכבוד",
  "humanAudioUrl": "https://example.com/well-done.mp3"
}
```

General voice plays in only two situations: the first entry to the app and the opening of the final dialog. Item recordings continue to belong directly to their item. If you change an item label or a day's name, make sure the corresponding spoken recording still says the right words. The timetable and equipment lists come from this same JSON file; avoid changing them while editing media unless intended.

## Publish your edits

Keep the JSON syntax valid: double quotes around keys and strings, commas between entries, and no trailing comma after the last entry. `public/magic-school-bag/ori-data.schema.json` describes the accepted fields.

Attach your edited `ori-data.json` and tell Sites: “Replace `public/magic-school-bag/ori-data.json` in `magic-school-bag` with this file and publish it.” Attach any new local media files too and say which `public/magic-school-bag/assets/` names they should use. You can also ask Sites to make specific changes directly, such as “Set the `science-book` imageUrl to …”.

## Validate before publishing

The app validates the complete data structure and its relationships at startup. A broken subject reference, item reference, weekday order, dismissal-time format, or equipment-status combination stops initialization and reports the validation error in the browser console; the app never guesses replacement values.

- `specified` requires at least one valid item ID.
- `none` means that no equipment is needed and its `itemIds` must be empty.
- `unknown` means that equipment information was not supplied and its `itemIds` must also be empty. Do not use `unknown` to invent a default item.
- `endsAt` is either the supplied local `HH:mm` time or `null`; never derive it from the number of lessons.

Run `npm test` for the focused timetable/date tests and `npm run lint` for TypeScript validation before publishing.
