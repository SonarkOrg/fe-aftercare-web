# FeAftercareWeb

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.1.2.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Aftercare MVP notes

> All clinical content (questions, thresholds, flags) is a development placeholder. A clinician must validate it before use with real patients.

- **Staff auth.** `StaffAuth` is implemented by `Auth0StaffAuth` (production) and `DevStaffAuth` (local `/dev/token`). `ng serve` / `ng build --configuration development` swap `src/app/auth/staff-auth.providers.ts` for `staff-auth.providers.development.ts` through `fileReplacements`, so dev auth never reaches the production bundle. Dev mode needs the API running with profile `local`.
- **Prod check.** Run `ng build`, then `grep -r "dev/token" dist/`. It must find nothing. Also `grep -l "Tableau de bord" dist/fe-aftercare-web/browser/main-*.js` must find nothing (the French dictionary is a lazy chunk) and the same grep over `chunk-*.js` finds exactly one chunk.
- **Patient page.** `/q/:code` is public (no login), French by default with an English toggle.
- **Manual acceptance (against the API in profile `local`).** Open the dashboard and Marie's alerts; complete the `/q/<marie code>` check-in and confirm a new alert appears; complete the `/q/<jean intake code>` pre-consult, check the appointment badge changes and use "Mark reviewed"; open a form on the Forms page and try the preview.

## Patient file, Settings, Reports and Messages

- **Where.** Patient file tabs (Medical, Contacts, Timeline, Documents, Messages, Access log) are under `/patients/:id?tab=`; Messages (`/messages`, `/messages/:patientId`), Reports (`/reports`) and Settings (`/settings?tab=clinic|staff|notifications|rules`) are top-level. The patient file and these three pages are lazy-loaded (`PatientFileModule`, `PagesModule`) to keep the initial bundle under budget; the shared building blocks live in `SharedModule`.
- **Health number (RAMQ).** The UI only ever receives the masked value. "Reveal" needs a reason (3 to 200 characters), keeps the number in a component field for 30 s (cleared on tab change, navigation and destroy) and never writes it to a URL, `localStorage`, the console or the page title. Every reveal is recorded by the API.
- **Documents.** PDF, JPEG or PNG up to 10 MB. Files are fetched as blobs and shown through `blob:` URLs (images in a drawer, PDFs in a new window with `noopener`); the URLs are revoked afterwards. No `bypassSecurityTrust*`.
- **Messages are plain text.** Bodies are rendered through Angular interpolation with `white-space: pre-wrap`: no `innerHTML`, no linkification. The patient side (`/q/:code`, French by default) calls only `/api/public/q/{code}/messages…`, which are not in the staff allow-list (`src/app/auth.config.ts`), so the staff token is never attached to them.
- **CSV export** (Reports) is built in the browser from the report response: UTF-8 with BOM, every cell quoted, and cells starting with `=`, `+`, `-` or `@` are prefixed with `'` against spreadsheet formula injection.
- **Privacy (Law 25).** This screen set shows personal health information: use it only on managed devices, log out on shared computers, and keep the organisational tasks from the API README (privacy impact assessment, person in charge, incident register, Canadian hosting, retention calendar) in view before production.

## Roles, notifications and retention (Phase A)

- **Roles come from the API, not from Auth0.** `GET /api/me` returns the staff member and a `permissions` list; the UI checks permissions only (`Permissions.can`, `*appCan`, `permissionGuard`). The role-to-permission matrix lives only in the API. Hiding a button is a convenience: the API enforces everything and records every denial.
- **Navigation per role.** Admin, Physician and Nurse see the whole top bar (Admin also gets Settings and the Access log); Reception sees Dashboard, Patients, Appointments and Forms. The patient file shows only the tabs the role may open (Reception: Overview, Contacts, Appointments). A route the role may not open goes to `/forbidden`; a login with no active staff member goes to `/not-staff`, which shows the `sub` to give to an administrator.
- **Dev role switcher.** In `ng serve` (development build only) the menu has a "Dev identity" select that switches between the seeded logins, including an unlinked one, and reloads. It is provided only by `staff-auth.providers.development.ts`, so the production bundle has no dev auth code (`grep -rE "dev/token|role-switch" dist/` finds nothing).
- **Patient notifications.** Staff record consent, preferred channel and language in the Contacts tab, and use "Send link" on an active follow-up or an upcoming appointment. Nothing is sent without a recorded consent; the app never shows the patient's full address or phone number after a send (only the masked recipient).
- **Settings (Admin).** Notifications (channels, reminder times, missed check-in cutoff), Retention and the global Access log. Retention periods are entered by the clinic's privacy officer; the app assumes no legal period, and nothing is purged unless the API is also configured to do so.
- **Staff allow-list.** `auth.config.ts` now also covers `/api/me`, `/api/audit` and `/api/retention/*`. `/api/public/**` and `/dev/**` never receive the staff token (tested).

## Languages (fr-CA default, en-CA on request)

- **French is the default** for every person and every device; English is an opt-in per staff member (`MeDTO.uiLanguage`, saved with `PUT /api/me/preferences`, `null` means French). `navigator.language` is never used. The choice is made in the user menu; it saves the preference and reloads the page, so a page load has one fixed language. A `localStorage` hint (`aftercare.staffLang`) only decides the language before `/api/me` answers (login and not-staff pages). The patient page `/q/:code` keeps its own dictionaries and toggle.
- **How it works.** `src/app/i18n/`: `I18nService` (`t()`, plurals, interpolation), pure pipes (`t`, `tzDate`, `num`, `pct`, `fileSize`, `duration`, `enumLabel`) and typed dictionaries in `dict/` (`core` is loaded for the boot language only, `patientFile` and `pages` are bundled in their lazy modules). Dates are always formatted in America/Toronto, times in 24 h. The built-in `date`, `number` and `percent` pipes are banned in templates.
- **Add a text.** Add the key to the `*.en.ts` file first (flat keys, `{name}` placeholders, no HTML, a `{count}` plural entry for anything countable), then to the matching `*.fr.ts` (a missing key is a compile error), then use `{{ 'area.feature.element' | t }}` (a mistyped key is a compile error with `strictTemplates`). Run `npm run i18n:check`: it must report 0 findings (hard-coded text in templates and TS, banned pipes, French dictionary imported outside its loader). `npm run i18n:inventory` prints every finding as TSV.
- **API messages are never shown.** Errors are translated from the `error` code (`ApiErrorsService`); field errors go through `fieldText()`. When the backend adds a fixed message, add it to `API_MESSAGE_KEYS`.
- **Vocabulary.** The glossary is section 6 of the i18n spec (check-in = « suivi quotidien », acknowledge = « prendre en charge », care notes = « notes d'évolution », …). Each `*.fr.ts` header has a "To be validated by" line for the clinician or translator.
- **Pseudo-locale.** In a development build, `?pseudo=1` shows every text as `⟦…⟧`, padded by 30%: anything still readable is hard-coded, and clipped layouts show up. `i18n.pseudo.spec.ts` does the same for every page in the unit tests.
- **Allowed English in the French UI** (each marked `lang="en"`): timeline summaries of rows written before the French texts existed, a question label without a French version, the technical `detail` column of the access log.
- **Native date and time inputs.** `<input type="date|time|number">` render with the browser's own locale (a French-language UI on an English-language browser still shows "mm/dd/yyyy" and "02:05 PM"), because the page language does not change the browser's control. Their values stay machine values (`2026-10-15`, `14:05`, `38.4`), so only the display differs. Everything we format ourselves follows the staff language.
- **Tests.** Component specs import `I18nTestingModule.forLang()` (English by default; `'fr'` and `'pseudo'` also work). `dictionaries.spec.ts` checks parity, placeholders, plurals, French typography (no-break space before `:`, « »), enum coverage and the API tables.

