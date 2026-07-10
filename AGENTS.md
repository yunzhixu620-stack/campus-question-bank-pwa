# Development Entry

Before changing code, question data, assets, or deployment files:

1. Read `PROJECT_RULES.md` in full.
2. Read `SOURCE_IMPORT_AUDIT.md` and check the current ledger in `data/source-import-status.json`.
3. Preserve local progress compatibility unless a documented migration is included.
4. Run `node scripts/validate-project.mjs` and `node --check app.js` before committing.
5. For user-visible changes, test the real mobile flow at a 390 px viewport.

Do not promote an uncertain, incomplete, answer-revealing, or OCR-only record into normal practice. Quarantine it as `review-only` or `reference-only` and record the reason.
