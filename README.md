# Compound

A calm, honest daily tracker for a long-term plan. An installable web app that works fully offline. No backend and no analytics: every bit of data stays on your phone, encrypted with your password.

## Accounts and privacy

- Anyone who opens the site sees only a **log-in / create-account** screen. The app's code contains no plan: each person either starts with a **blank plan** or loads a **plan file** they own.
- Accounts live **on the device**. Each account has its own database, encrypted with AES-256-GCM. The key is random and is stored only wrapped with the password (PBKDF2-SHA256, 600,000 rounds). Without the password the data is unreadable ciphertext; there is no password check to bypass. Record ids are random, so even the fields IndexedDB keeps readable for its indexes (ids, dates, statuses) reveal nothing about the plan.
- **Keep me logged in** (on by default) remembers the key on this device so the app opens without the password; anyone who can unlock the phone could then open it. Turn it off in Settings → Account on shared devices.
- There is **no password reset**. The password is the only key; keep it, and keep backups.
- An account exists only on the device where it was created. To move to a new phone, restore a backup file there (it asks for the password).
- Data from the version before accounts moves into the first account created on the device, encrypted.

## Plan files

A plan file (`.compound.json`) is a whole plan as data: areas, phases, checkpoints, habits with their if-then plans and rollout dates, study subjects and topics, workout templates and to-dos. Load one during setup (**Load a plan file**). It asks for the start date and, if the plan needs them, your weight and workout days, then builds the plan with dates relative to your start. The format is defined in `src/seed/template.ts`; `tests/fixtures/sample-plan.compound.json` is a neutral example.

Keep your own plan file private (here it lives in `private/`, excluded from git via `.git/info/exclude`). Send it to your phone, e.g. through Google Drive, and load it there.

## What's in it

- **Today**: the day's habits grouped by time of day (Done / Min / Skip with a reason), "never miss twice" items pinned on top, a strength score per habit, the numbers row (steps, protein, sleep, weight), and cards for DSA reviews due, the study topic, workout days, this week's commitments, application follow-ups and due to-dos. A banner stays until the weekly review is done.
- **Plan**: phases and checkpoints (pass/fail with notes), the study subject queue with one active subject, topic statuses and paste-to-import, and every habit with its if-then plan, backup plan, minimum version, schedule, target, reminder and start date. New habits respect the queue (one per area every two weeks).
- **Logs**: DSA (spaced reviews at 1/3/7/14/30/60 days, weak patterns), workouts (pre-filled sets, +2.5 kg suggestions, PRs), speaking drills and the people log, body metrics, skin (products with the one-new-product rule, photo checkpoints, dermatologist visits), mock interviews (fixes become a checklist) and the application pipeline.
- **Review**: the guided Sunday review (scoreboard → lag check → wins → misses → one change → commitments) with a copyable summary, and the monthly review (results vs plan, checkpoints, accept planned changes, start or postpone queued habits).
- **Insights**: honest status per area from the last 14 days (on track ≥ 80%, slipping 50–79%, off track < 50%), weekly compliance, habit strength, a calendar heatmap, and charts per area.
- **Settings**: account (log out, change password, keep me logged in, delete account), encrypted backup/restore, CSV exports, calendar reminders, plan dates, the day's rollover hour, and everything else editable. Erasing an account's data requires typing RESET.

## Run it locally

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev        # http://localhost:5173, with a dev-only "time travel" panel in Settings
npm test           # unit tests (Vitest)
npm run e2e        # production build + browser tests (Playwright, uses your installed Chrome)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

The browser tests in `tests/e2e/` cover accounts (log-in wall, wrong passwords refused, users isolated, nothing readable stored, a blank plan built from scratch) and the acceptance tests: week-1 habits only on day 1, marking a day in seconds, strength and "never miss twice", the DSA review loop, workout pre-fill and progression, weekly-review commitments on Today, backup → reset → restore with identical data, offline use and the calendar file, and a sweep for placeholder text and unlabelled buttons. Importing the calendar file into Google Calendar is the one step that has to be checked by hand.

## Deploy free to GitHub Pages

1. Create a GitHub repository (it can be private if your plan includes Pages for private repos; otherwise public) and push this project to its `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs the tests, builds, and publishes. The workflow is `.github/workflows/deploy.yml`.
4. The app is served at `https://<your-username>.github.io/<repo-name>/`.

The build reads `BASE_PATH` (set by the workflow to `/<repo-name>/`). For Netlify, Vercel or a custom domain, build with the default `/`: on Netlify or Vercel, set the build command to `npm run build` and the output folder to `dist`.

## Install on your phone

Open the deployed URL once while online, then:

- **Android (Chrome):** menu ⋮ → **Add to Home screen** (or **Install app**).
- **iPhone (Safari):** Share → **Add to Home Screen**. Always open it from the home-screen icon. On iPhone, data saved by an installed app is much less likely to be cleared than data in a Safari tab.

After the first load it works with no connection. When a new version is deployed, the app shows **"A new version is ready"**; tap **Reload** when convenient.

## Backup routine (important)

Your data lives only in this browser's storage, which the browser can clear, especially on iPhone.

- **Settings → Backup → Back up now** saves one **encrypted** file with everything. Only the account's password opens it (the password the account had when the backup was made). On a phone this opens the share sheet: choose **Save to Files** or **Google Drive**, i.e. somewhere off the phone.
- Do it at least **weekly**: the Sunday review is a good moment. The dot next to the date on Today shows backup age (green = recent, amber = over 7 days, red = never), and Today shows a reminder card when it's overdue.
- **Restore:** Settings → Backup → Restore from a backup file. On a new phone you can restore straight from the first screen instead of onboarding. Restoring replaces everything on the device, and nothing changes unless every record in the file is valid. Backups from older app versions are upgraded automatically.
- **CSV:** Settings → Backup → Export a log as CSV gives a spreadsheet of any log (habit check-ins, numbers, DSA, workouts, …).

## Reminders via your calendar

Scheduled notifications need a server, so reminders come from your phone's calendar instead:

1. Settings → Reminders → **Export calendar file (.ics)**. It holds one repeating event for each habit's reminder time, plus the Sunday and monthly reviews.
2. On a computer, in Google Calendar: **Settings → Add calendar → Create new calendar** named "Compound", then **Import & export → Import** the file into that calendar.
3. In that calendar's settings, set the default notification to **at time of event** (Google ignores alarms inside imported files).
4. When habits change, the app shows **"Reminders changed"**. Delete the Compound calendar, create it again, and import the new file so events never double up.

Apple Calendar can open the .ics file directly and keeps its built-in alerts.

## How the code is organised (and how to extend it safely)

```
src/
  domain/    pure logic, no React or database: dates and the 3 AM rollover, habit
             strength, compliance, Today's list, the .ics file, CSV
  model/     zod schemas: the single source of truth for every stored record
  db/        Dexie (IndexedDB): table registry, versions and migrations, backup, CSV exports
  seed/      the plan's starting content, built from the onboarding answers
  features/  screens and cards (today, settings, backup, reminders, onboarding)
  ui/        shared components (buttons, stepper, sheet, form fields, icons)
  app/       shell: routing, layout, screen registry, app-wide data
```

Rules that keep changes from breaking stored data or old backups:

- **A new field** in a record: make it optional or give it a default in `src/model`. Old rows and old backups still load.
- **A renamed or reshaped field, or a new table:** add a new version in `src/db/versions.ts` (never edit a shipped one). Its row migrations run on the live database *and* on older backup files during import. A test checks that every table has both a schema and indexes.
- **Habit schedule or target changes** add a new dated rule to the habit, so past days are still judged by the rule that applied then.
- **"Missed" is never stored.** It is worked out from the schedule and your check-ins, so there is nothing to go stale.
- **Registries instead of scattered code:** screens (`app/screens.tsx`), Today cards (`features/today/cards.tsx`), daily numbers and log sources (`domain/metrics.ts`), CSV exports (`db/csvExports.ts`). Adding one is one entry.
- **One clock** (`domain/time/clock.ts`): nothing else reads the system time, so tests and the dev time-travel panel can move it.
