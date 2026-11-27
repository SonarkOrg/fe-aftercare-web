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
- 2026-11-27 [spec-review] Verified: the 650 kB initial budget in angular.json is maximumWarning only (maximumError 1 mb), DashboardComponent and PatientsComponent are eager (their changes count toward the initial bundle), core dictionaries are lazy chunks, and patient-detail.component.html dereferences patient.address.city/state/zip without a guard (a patient with no address crashes the file) → read the build warning text, not the exit code, and make Patient.email/phone/gender/address nullable before relaxing PatientDTO.
- 2026-11-27 [p1a] A zero-width regex (a lookahead-only pattern with the g flag) used in `while (re.exec())` never advances lastIndex: the loop froze the Karma browser at test 347 and showed up only as "Disconnected ... ping timeout", not as a failing spec → use a sticky `/y` regex with an explicit offset loop, and when Karma disconnects bisect with `--include` globs; the headless Chrome here is /opt/pw-browsers/chromium-1243/chrome-linux64/chrome (the chromium-*/chrome-linux glob in this file matches nothing); the full suite (1062 specs) takes about 2 minutes, so run it in the background.
- 2026-11-27 [p1a] `AppointmentMetrics` and `Appointment` gained required members (arrived, walkIns, arrivedAt, arrivalSource, walkIn) so every fully-typed fixture in specs must be updated (appointments.component.spec.ts needed arrived/walkIns); i18n scope `frontDesk` is now the 4th closed-set scope (6 places done in P1A-FE-0) and the new `fd.*`, `appts.arrive*` and `chip.desk|reason.*` keys show as unused-key warnings until P1A-FE-A/B reference them (warning only, i18n:check still 0).
- 2026-11-27 [auth] Verified: default `provideAuth0` keeps the access token in memory, but `Auth0StaffAuth.getAccessToken()` uses `getAccessTokenSilently()`, which re-mints a token from the Auth0 session cookie after a reload or in a new tab → clearing the token or closing the tab is NOT a logout; the idle lock (EFVP A-04) must do a full Auth0 logout or force re-auth (`max_age`/`prompt=login` + API `auth_time` check). Also `patient-questionnaire.component.ts` fetches the whole message thread on page open only to count unread, so link scanners receive it → load the thread on user action and use a count-only call (A-51).
- 2026-11-27 [p1a] FE-B: the appointments view switch is now three <a> links and the component follows ?view= through ActivatedRoute.queryParamMap, so specs must change view with router.navigateByUrl('/appointments?view=week') (RouterTestingModule.withRoutes with a blank component for /appointments and /appointments/arrivals) and clear localStorage['aftercare.appts.view'] in beforeEach, otherwise a remembered 'arrivals' redirects the next test; fr-ui.spec and i18n.pseudo.spec still call AppointmentsComponent.setView('week') → it stays as a programmatic (no-URL) method. The global .pill-group__item CSS only styles [aria-pressed=true] buttons, so anchors need [aria-current=page] rules (put in the component styles for now; should move to components.css).
- 2026-11-27 [p1a] Arrivals page writes localStorage `aftercare.appts.view`=arrivals on init, and the day-board component redirects to Arrivals when it reads that value, so any spec that renders ArrivalsComponent leaked the key and made `AppointmentsComponent` specs fail with NG04002 "Cannot match any routes: appointments/arrivals" → remove the key in `afterEach` of every spec that creates the Arrivals page (done in arrivals/pseudo/fr-ui specs). Also in Karma `HttpTestingController.match()` still returns requests that were cancelled by `unsubscribe()`, so a "no request while masked" assertion under fakeAsync must answer the 20 s polls while time advances (helper `tickAnswering` in arrivals.component.spec.ts), and Angular dev mode reflects bound values as `ng-reflect-*` attributes, so never assert "not in innerHTML" on a whole page (use textContent or a sub-tree).
- 2026-11-27 [p1a] Verification recipes that avoid ports 4200/8080: (1) a karma config kept outside the repo must `require()` karma-jasmine, karma-chrome-launcher and @angular-devkit/build-angular/plugins/karma by ABSOLUTE node_modules path; (2) a lazy module with no route yet can be template-checked with `npx ngc -p <tsconfig in /var/tmp that extends tsconfig.app.json and lists the module in files>`; (3) `ng build --configuration development --output-path /var/tmp/x`, serve it with a 15-line node static server on a spare port and let Playwright `page.route("http://localhost:8080/**")` mock /dev/token, /api/me and the endpoints, which gives real screenshots and focus/scroll/target-size checks without the API.
- 2026-11-27 [p1a] At 390 px the Arrivals arrive/undo button shared its line with the 44 px expand chevron (250 of 302 px), not full width as §7.8 asks → fixed in front-desk.css (chevron absolute top-right, button flex-basis 100%, main padding-right 44px); in Playwright, rows inside a closed <details> still count via offsetParent, use locator.isVisible().
- 2026-11-27 [p1a-review] Verified with node: `maybeNam` (/[A-Za-z]{4}[\s-]?\d{3,}/) and `extractNam` miss a NAM typed in pairs or with dots ("TREM 68 12 12 12", "TREM.6812.1212"), so the Arrivals no-match card echoes it and links it to /patients?q= → strip every non-alphanumeric before any NAM-shape test, never only [\s-].
- 2026-11-27 [p1a-review] Glass surfaces must use the --g-* tokens of glass.css (--g-active, --g-tile, --g-pop): its no-backdrop-filter block already redefines them, so a hand-written rgba(...) plus a second fallback rule (front-desk.css did both) duplicates the palette and drifts → grep new CSS for rgba( and #fff and swap in the token before review.
- 2026-11-27 [p1a-fix] A-44 wins over spec §7.5: « Nouveau lien » (fix panel and day board) is shown only with CLINICAL_READ (reception gets « Envoyer le lien » and the fd.fix.refusedDesk note); arrivalChip now takes the status and returns null on a closed appointment; dictionaries.spec fails when a fr value equals the en one ("Source") → pick a real French word (« Provenance ») or document the exception.
