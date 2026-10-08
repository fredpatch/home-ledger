# Design brief — Suivi financier

Status: approved baseline for P1.6 onward. Business rules live in `docs/spec.md`; flows in `docs/app-flow.md`. This file decides how the UI looks and behaves. UI text is French; this document is English.

---

## 1. Principles

1. **Entry in under 5 seconds.** The quick entry screen is the product. Every other screen is secondary.
2. **Readable at a glance.** One key number per card. Amounts are the largest text on any screen.
3. **Colour means something.** Colour is never decoration (see §3). Plain spending is not red.
4. **Calm by default.** Flat surfaces, thin borders, no gradients, no shadows except focus rings and overlays.
5. **Mobile first, desktop for review.** Phone = capture and check. Desktop = review, correct, close the month.
6. **Private by design.** No external fonts, CDNs or analytics: the app works fully on the tailnet and offline.

## 2. Layout

| Breakpoint | Layout | Navigation |
| --- | --- | --- |
| < 768 px (phone) | single column, 16 px side padding | bottom bar, 5 items: Accueil · Budget · **+** (centre, primary) · Historique · Plus |
| 768–1023 px (tablet) | single column, max width 720 px, centred | bottom bar |
| ≥ 1024 px (desktop) | sidebar 200 px · content · optional right panel 280 px | sidebar (all sections) |

- Content max width on desktop: 1280 px.
- Touch targets ≥ 44 × 44 px. Bottom bar respects the iOS safe area (`env(safe-area-inset-bottom)`).
- No horizontal page scroll at any width. Wide tables scroll inside their own container on phone.

## 3. Colour tokens

Defined once as CSS custom properties on `:root`, overridden under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. Components use tokens only — never raw hex.

| Token | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `--bg` | page background | #F7F7F5 | #141413 |
| `--surface` | cards, sheets | #FFFFFF | #1E1E1C |
| `--surface-muted` | metric cards, inputs | #F0EFEA | #262624 |
| `--border` | hairlines | #E3E1DA | #34332F |
| `--text` | primary text | #1F1E1C | #F2F1EC |
| `--text-muted` | secondary text | #6B6A64 | #A3A19A |
| `--accent` | primary action, selection, links | #2563EB | #6EA0FF |
| `--income` | money in (revenu, remboursement) | #15803D | #4ADE80 |
| `--savings` | épargne, projets funded from savings | #6D28D9 | #B49CFF |
| `--warning` | ≥ 90 % of an envelope, gap within tolerance, item to check | #B45309 | #FBBF24 |
| `--danger` | over budget, gap above tolerance, errors | #B91C1C | #F87171 |
| `--neutral` | transfers (neutral to totals) | #6B6A64 | #A3A19A |

Rules:
- Expenses display in `--text` with a leading minus; only **over budget** turns red.
- Income displays in `--income` with a leading `+`.
- Transfers display in `--neutral` with no sign and a ⇄ icon.
- Each semantic colour has a tint for backgrounds (same hue, ~10 % opacity) with text in the full colour.
- Contrast: WCAG AA (4.5:1) for all text in both themes.

## 4. Typography

- Font: system stack — `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. No web fonts.
- Amounts: `font-variant-numeric: tabular-nums` everywhere so columns align.
- Weights: 400 and 600 only.

| Role | Size / line height |
| --- | --- |
| Hero amount (quick entry, "Disponible") | 32 / 40, 600 |
| Card amount | 20 / 28, 600 |
| Screen title | 18 / 24, 600 |
| Body | 15 / 22 |
| Secondary, labels | 13 / 18 |
| Caption (minimum) | 12 / 16 |

## 5. Formatting

| Item | Rule | Example |
| --- | --- | --- |
| Amount | integer, thin space every 3 digits via `Intl.NumberFormat('fr-FR')`, currency as small muted suffix | `1 023 000 XAF` |
| Expense | true minus sign `−` (U+2212) | `−12 000` |
| Income | `+` in `--income` | `+150 000` |
| Percentage | integer, non-breaking space before `%` | `39 %` |
| Date (list) | `jj/mm` in current year, `jj/mm/aaaa` otherwise | `07/10` |
| Date (title) | weekday + day + month | `mercredi 7 octobre` |
| Budget month | month + year | `octobre 2026` |

Dates are formatted from `'YYYY-MM-DD'` strings without passing through UTC (PROJECT §Gotchas).

## 6. Spacing and shape

- 4 px grid; common steps 4 · 8 · 12 · 16 · 24 · 32.
- Radius: 8 px for controls, 12 px for cards, 999 px for chips.
- Borders: 1 px `--border`. Cards: `--surface` + border, no shadow.
- Focus: 2 px `--accent` outline with 2 px offset, always visible on keyboard focus.

## 7. Components

| Component | Behaviour |
| --- | --- |
| **Amount keypad** | Large digits 0–9, `000` key, backspace. No decimal key. Hero amount updates live with formatting. Zero disables "Enregistrer". |
| **Category chips** | Horizontal wrap; 6 most-used first, then "Plus" opens a searchable sheet. Selected chip = `--accent` tint + border. |
| **Account chips** | Same pattern; the account last used for the chosen category is preselected. |
| **Derived line** | Under the form, muted text: `Dépense · Transport et alimentation · octobre 2026`. Updates as the category changes (R2, R3). |
| **Primary button** | Full width on phone, `--accent` fill, white text, 48 px tall. One primary button per screen. |
| **Metric card** | `--surface-muted`, label 13 px muted on top, amount 20 px below. Used in grids of 2–4. |
| **Envelope bar** | Label + `spent / budget` on one line, 6 px bar below. Bar colour: `--text-muted` < 90 %, `--warning` 90–100 %, `--danger` > 100 %. |
| **Operation row** | Date · label · category (muted) · amount right-aligned. Tap/click opens detail. Drafts show a "Brouillon" badge. |
| **Badge** | Small pill, tint background + full-colour text: Brouillon, À vérifier, Clôturé, Renfort. |
| **Alert banner** | Tint background, icon + one sentence + optional action. Max 2 on the home screen. |
| **Bottom sheet** (phone) / **dialog** (desktop) | Detail and edit. Close on swipe-down / Esc. Destructive action separated and confirmed. |
| **Toast** | Bottom, 3 s, after save: `Opération enregistrée` + `Annuler` (undo within 5 s). |

Icons: one outline icon set, 20 px, `currentColor`. Choice of set (inline SVGs vs a library) is a P1.6 decision; adding a library needs dependency approval.

Styling approach: plain CSS with the tokens above (CSS Modules, supported by Vite). No UI component library in Phase 1 unless approved as a dependency.

## 8. States

Every data screen defines all five:

| State | Treatment |
| --- | --- |
| Loading | skeleton blocks in `--surface-muted`, no spinner over 300 ms content |
| Empty | one sentence + one action, e.g. `Aucune opération ce mois-ci.` + `Ajouter une opération` |
| Error | banner in `--danger` tint: what failed + `Réessayer`; never a raw error code |
| Offline | top strip `Hors ligne — les saisies seront envoyées au retour du réseau` (when the offline queue exists) |
| Locked month | `Clôturé` badge; edit controls hidden; `Rouvrir le mois` only on desktop |

## 9. French microcopy

- Sentence case, no exclamation marks, no "Veuillez".
- Buttons are verbs: `Enregistrer`, `Valider`, `Pointer`, `Clôturer le mois`.
- Errors say what to do: `Montant requis.`, `Choisis un compte de destination.`
- Address the user with "tu" (personal app), consistently.
- Domain words as in the spec: opération, enveloppe, pot du mois, pointage, renfort, épargne de sécurité, fonds projets, clôture.

## 10. Accessibility

- Every input has a visible label; icon-only buttons have `aria-label`.
- Colour is never the only signal: over-budget also shows the percentage and a warning icon.
- Respects `prefers-reduced-motion` (no transitions).
- Usable with keyboard only on desktop; logical tab order in forms.
