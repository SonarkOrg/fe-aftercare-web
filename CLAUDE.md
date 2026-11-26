# Aftercare — working memory (web repo)

Read this file AND `../aftercare-api/CLAUDE.md` (product, owner's wishes, hard rules, journal protocol)
before any work. Append lessons and mistakes to the Journal at the bottom with a single shell append:
`printf '%s\n' '- YYYY-MM-DD [area] what happened → what to do instead.' >> CLAUDE.md`
Subagents never Edit/Write this file and never commit or push.

## Design rules (the owner is strict about these)

- Keep the "v2" layout: top bar with pill navigation, big display title, rounded cards (24px), KPI row,
  tiles. Do NOT redesign layouts when asked for a visual change.
- Glassmorphism on top of v2 (`src/styles/glass.css`): translucent cards, ambient blurred glow, soft
  shadows. There is a no-`backdrop-filter` fallback block; keep it in sync.
- Palette is Bleu Québec. Tokens live in `src/styles/tokens.css`. The scale is still named `--sage-*`
  (names kept for stability; values are blue). Accent `#1f4fa0`, hover `#1a4388`, use
  `var(--accent-grad)` for filled accent surfaces. Never hardcode brand hex in components.
- NEVER use a coloured left border/edge as an accent. NEVER add generic gradient-hero "AI slop".
- Status is always glyph + word, never colour alone. Status tones are reserved:
  critical (red ▲), serious (plum ◆), warning (amber ●), good (green ✓), info (ℹ), neutral (—).
  Build chips through `src/app/shared/status.ts`.
- WCAG AA: 4.5:1 text, 3:1 for field borders and glyphs. Touch targets ≥ 44px. Works at 390px wide.
- Fonts: Urbanist (display) + Inter (text), bundled via @fontsource-variable. No CDN assets.

## Code rules

- Angular 17 with NgModules and lazy feature modules. Follow the structure in `src/app/components/*`.
- i18n is in-house: typed dictionaries + the `t` pipe, lazy per module and language. Every string in
  fr-CA and en-CA; run `npm run i18n:check` (must report 0 findings). French uses Quebec typography
  (non-breaking space before `:`, `?`, `%`; decimal comma). Dates/numbers use the fr-CA/en-CA formatters
  in the America/Toronto zone.
- Permissions: `Permissions` service, `*appCan`, route guards. The UI hides what the role cannot do, the
  API enforces it.
- The auth interceptor only attaches the staff token to allow-listed paths (`auth.config.ts`). A new
  staff API path must be added there or it gets 401. Public patient paths must NOT get the staff token.
- Initial bundle budget is 650 kB (was 633.58 kB). Heavy libraries (OCR, barcode, charts) must be lazy.

## Run and test (this container)

- `npm ci`, then `npx ng serve` (port 4200; needs the API on 8080 with profile `local`).
- Dev identity for staff pages: `sessionStorage.setItem('aftercare.devIdentity', JSON.stringify({role:'ADMIN'}))`
  (roles ADMIN, PHYSICIAN, NURSE, RECEPTION).
- Build: `npm run build` (budget must pass). i18n: `npm run i18n:check`.
- Unit tests: there is no committed headless Karma config. Run with
  `CHROME_BIN=$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)` and a temporary karma
  config that defines a `ChromeHeadless` launcher with `--no-sandbox`; delete the temp config after.
- Live checks: Playwright is at `/opt/node22/lib/node_modules/playwright`; use an init script to set the
  dev identity; screenshot at 1440×900 and 390×844.

## Mistakes already made (don't repeat)

- Language switch returned 401 because `/me/preferences` was missing from the interceptor allow-list.
- A palette sweep missed `rgba(...)` colours and component-level inline SVG fills. When changing colours,
  grep hex AND rgba AND `.html` templates.
- Native date inputs follow the browser locale, not the app language (known, not fixed).
- Count badges and tab counters are `.badge` / `.count-pill` / `.pill-group__count` overridden in
  `glass.css`, not only in `components.css`. Check both files.

## Journal
- 2026-11-26 [fe-map] Verified in code: i18n scopes are a CLOSED set (core, patientFile, pages) hard-coded in 6 places (`i18n.types.ts` Scope+TKey, `I18nService.preload`/`setScope` pseudo loop, `testing/i18n-testing.module.ts`, `dictionaries.spec.ts` PAIRS, `scripts/i18n-check.mjs` scopeOf+fileScope), `I18nService.boot()` returns early on `/q/` so the `t` pipe and every shared component that uses it (status chip, ring tile, access link) print raw keys on public patient pages, and `auth.config.spec.ts` pins the allow-list to exactly 21 entries (`/check-ins` is exact-match and already means the daily follow-up feed) → a new lazy module must touch all 6 i18n places, public pages keep their own `*.i18n.ts` records + `.pq-*` classes, and a new staff API prefix needs the allow-list AND its spec updated.
