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
- **Prod check.** Run `ng build`, then `grep -r "dev/token" dist/`. It must find nothing.
- **Patient page.** `/q/:code` is public (no login), French by default with an English toggle.
- **Manual acceptance (against the API in profile `local`).** Open the dashboard and Marie's alerts; complete the `/q/<marie code>` check-in and confirm a new alert appears; complete the `/q/<jean intake code>` pre-consult, check the appointment badge changes and use "Mark reviewed"; open a form on the Forms page and try the preview.

## Patient file, Settings, Reports and Messages

- **Where.** Patient file tabs (Medical, Contacts, Timeline, Documents, Messages, Access log) are under `/patients/:id?tab=`; Messages (`/messages`, `/messages/:patientId`), Reports (`/reports`) and Settings (`/settings?tab=clinic|staff|notifications|rules`) are top-level. The patient file and these three pages are lazy-loaded (`PatientFileModule`, `PagesModule`) to keep the initial bundle under budget; the shared building blocks live in `SharedModule`.
- **Health number (RAMQ).** The UI only ever receives the masked value. "Reveal" needs a reason (3 to 200 characters), keeps the number in a component field for 30 s (cleared on tab change, navigation and destroy) and never writes it to a URL, `localStorage`, the console or the page title. Every reveal is recorded by the API.
- **Documents.** PDF, JPEG or PNG up to 10 MB. Files are fetched as blobs and shown through `blob:` URLs (images in a drawer, PDFs in a new window with `noopener`); the URLs are revoked afterwards. No `bypassSecurityTrust*`.
- **Messages are plain text.** Bodies are rendered through Angular interpolation with `white-space: pre-wrap`: no `innerHTML`, no linkification. The patient side (`/q/:code`, French by default) calls only `/api/public/q/{code}/messages…`, which are not in the staff allow-list (`src/app/auth.config.ts`), so the staff token is never attached to them.
- **CSV export** (Reports) is built in the browser from the report response: UTF-8 with BOM, every cell quoted, and cells starting with `=`, `+`, `-` or `@` are prefixed with `'` against spreadsheet formula injection.
- **Privacy (Law 25).** This screen set shows personal health information: use it only on managed devices, log out on shared computers, and keep the organisational tasks from the API README (privacy impact assessment, person in charge, incident register, Canadian hosting, retention calendar) in view before production.
