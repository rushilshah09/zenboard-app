# Illustrations

The illustrations are in the film. Source SVGs live in `art-src/`, taken from the files uploaded
to `main`. `node scripts/extract-illustrations.mjs` converts them into
`src/brand/illustrations.generated.ts`, and `<Illustration>` builds each drawing up shape by
shape, with slow parallax between its layers. Re-run the script after replacing a file.

| Code | Source file (on `main`) | Used in | Placement |
|---|---|---|---|
| IMG-01 | Contemplative Morning Workspace.svg | S01, S02 | right six columns, headline on the left |
| IMG-02 | — | S02 | not needed: the note card is built from the product's own card, lightbulb icon and lines |
| IMG-04 | `public/img/IMG-04.png` | whole film | paper grain overlay at 3.5% |
| IMG-05 | `public/img/IMG-05.png` | S09, S10, S18 | aura behind the mark |
| IMG-06a | Minimalist Blue Desk Setup.svg | S15 | "Deep work" card |
| IMG-06b | Sage Sneakers on a Winding Trail.svg | S15 | "A walk" card |
| IMG-06c | Cozy Candlelit Dining Table.svg | S15 | "Dinner with Sam" card |
| IMG-06d | Sunny Beach Chair Retreat.svg | S15 | "A day off" card |
| IMG-07 | Cozy Moonlit Workspace Break.svg | S17 | same framing as IMG-01, evening |

The uploaded `logo .svg` is the same lockup the film already uses (`src/brand/logo.generated.ts`,
taken from the app's `<Logo>`).
