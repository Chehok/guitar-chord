# Vendored Ponytail (upstream unchanged)

- **Repository**: https://github.com/DietrichGebert/ponytail
- **Tag**: v5.3.3
- **Commit**: `7801d061243d7b753bad0e0b3c057cd250b11755`
- **License**: `LICENSE` (MIT)

## Files included (minimal set for Cursor `beforeSubmitPrompt`)

- `hooks/cursor-hooks.json` — upstream template (reference; this project uses a slimmer `.cursor/hooks.json`)
- `hooks/ponytail-config.js`
- `hooks/ponytail-instructions.js`
- `hooks/ponytail-map.js` (invoked by `ponytail-activate.js` only; included for completeness if `sessionStart` is added later)
- `hooks/ponytail-mode-tracker.js`
- `hooks/ponytail-runtime.js`
- `hooks/ponytail-activate.js` (optional; not registered in this repo’s minimal cloud-oriented `hooks.json`)
- `skills/ponytail/SKILL.md` — ruleset source read by `ponytail-instructions.js`
- `scripts/cursor-hooks.js` — official merge installer for `hooks.json`

Do not edit these files for project policy; fork upstream or wrap in separate scripts instead.
