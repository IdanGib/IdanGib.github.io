#!/usr/bin/env bash
set -euo pipefail
trap 'kill 0' EXIT INT TERM
npm run pocketbase &
npm run dev &
wait
