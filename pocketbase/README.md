# Magic Bag Editor backend

Pinned for PocketBase **0.40.4**. Download the matching executable as `pocketbase/pocketbase`; binaries and `pb_data` are intentionally ignored.

Migrations create the auth whitelist and editor data. Hooks implement invitation/revocation and re-check membership for authentication and protected routes. They run in the PocketBase JavaScript VM (no Node APIs).
