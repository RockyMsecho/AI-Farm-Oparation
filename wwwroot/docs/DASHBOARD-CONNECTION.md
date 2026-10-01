# Dashboard ↔ backend connection

## Files added or changed

| File | What changed |
|---|---|
| `auth.html`, `auth.css`, `auth.js` | New. Sign in / create account, styled from the dashboard's own `:root` tokens in `styles.css` (same emerald/navy palette, same card and button language) - not a separate theme. |
| `index.html` | Added a blocking auth-guard script in `<head>`. Removed the "add farm" form (see below). Reworked the Team form and table columns to match the backend's actual `User` fields. Added a Sign Out button. Loads `backend.js` after `script.js`. |
| `script.js` | Removed the `farm-form` submit handler (the form no longer exists - this would otherwise throw on load and break every other form in `initForms()`). Removed the `team-form` local-push handler and the `data-remove-farm` / `data-remove-team` handlers (backend.js replaces these with real requests). `renderFarmsTable()` and `renderTeamTable()` rewritten for the backend's data shape. |
| `styles.css` | One small addition: `.logout-btn`, styled to match the existing `.user-status` / button conventions already in the file. Nothing else touched. |
| `backend.js` | New. All the actual `fetch()` calls live here, kept separate from `script.js` so the original demo logic for the untouched tabs stays easy to find. |

## What's actually connected

- **Sign in / Create account** → `POST /api/Auth/login`, `POST /api/Auth/register`
- **Session** → token stored in `localStorage`, sent as `Authorization: Bearer` on every request; a 401 from any request clears storage and returns to `auth.html`
- **Your farm** → `GET /api/Farm/my-farm` (read-only). Shown in Settings, and its name replaces the generic sidebar subtitle so it's always visible which farm you're in.
- **Users & Roles** → its own tab (`GET /api/User`, `POST /api/User`, `PUT /api/User/{id}/role`, `PUT /api/User/{id}/status`), not nested inside Settings - this is core, frequent work, not a settings screen.
- **Shift clock in/out** → `GET /api/Shifts/current`, `POST /api/Shifts/clock-in`, `POST /api/Shifts/clock-out`. Sidebar widget, visible from every tab.
- **Shift & attendance report** (Reports tab) → `GET /api/Shifts/history` for your own record with computed hours; Owner/Manager additionally see `GET /api/Shifts/team`, every user's shifts on the farm with server-computed `hoursWorked`.
- **Field reports** (Reports tab) → `POST /api/Reports` (Worker/Technician submit, must be clocked in first), `GET /api/Reports` (Owner/Manager/Agronomist see everyone's) or `GET /api/Reports/mine` (everyone else sees their own), `POST /api/Reports/{id}/recommendation` (Owner/Manager/Agronomist), `PUT /api/Reports/{id}/approve` (Owner/Manager only). This is enforced by `ReportsController` server-side via the `reports.*` permissions, not just hidden in the UI.

## Two more additions

- **Toast notifications, replacing `alert()`.** Every error and success
  message across Users & Access, Field Reports, and Shift clock in/out used
  to be a blocking browser `alert()` - stops the page, looks nothing like
  the rest of the dashboard. `showToast(message, kind)` in `backend.js` now
  drops a small card into the bottom-right corner instead, styled to match
  the theme, and fades out on its own after ~4.5 seconds. Success actions
  (user added, role updated, report submitted, recommendation added, report
  approved) now actually say so - they used to just silently refresh the
  table with no feedback at all.
- **CSV export for the Shift & Attendance report.** "My shifts" and "Whole
  team" (Owner/Manager) each get an Export CSV button. Pure client-side -
  the data's already loaded, this just reshapes it and triggers a download -
  no backend change needed. Useful for anyone doing payroll or attendance
  tracking outside the dashboard.

## Two more, again

- **Reject a recommendation.** Approve was the only decision available
  before this - a recommendation you disagreed with had nowhere to go.
  `PUT /api/Reports/{id}/reject` (Owner/Manager, same `reports.approve`
  permission as Approve) marks it Rejected. The old recommendation text
  stays visible as the record of what was turned down; a reviewer can
  submit a fresh one at any time through the existing recommend endpoint,
  which overwrites it and moves the report back to Pending approval. No new
  migration - it reuses the existing `ApprovedByUserId`/`ApprovedUtc`
  columns as generic "decided by / at" fields rather than adding
  Rejected-specific ones so soon after the last migration reset (documented
  in the code comment on `ReportsController.Reject`).
- **Search/filter on Users & Access and Field Reports.** Both were going to
  get unwieldy as real data accumulates. Pure client-side, filters whatever's
  already loaded - no new request per keystroke. The nav badge and Overview
  counts are computed off the full unfiltered set, so typing in the search
  box doesn't make the badge lie about how much actually needs attention.

## Build error fixed: CS0111 duplicate `Reject`

`ReportsController` ended up with two identical `Reject` methods bound to
the same route (`PUT {id:int}/reject`) - the second one was added without
checking whether one already existed. Removed the duplicate; one `Reject`
method remains, unchanged in behavior. If you already applied the previous
zip, replace `Controllers/ReportsController.cs` with this version.

## One more addition

- **"Needs your attention" list on Overview.** The snapshot cards told a
  reviewer or approver *how many* reports needed them, but not *which
  ones* - that meant a click into Reports just to find out. This adds a
  card right on Overview listing up to 5 actionable reports by name, with
  a link straight into the Reports tab. Hidden entirely for Worker/
  Technician (nothing for them to review) and hidden when the list is
  empty. Fixed a related bug while I was in there: the "awaiting
  recommendation" counts didn't yet know about Rejected reports needing a
  fresh recommendation - only the Reports tab's own badge had that fix
  applied. Both now share the same definition.

## Three more additions

- **Privacy Policy.** New `privacy-policy.html`, linked from a "Legal" card
  in Settings. Describes what's actually collected and why, based on what
  this application genuinely does (no invented claims about things it
  doesn't do). It's flagged clearly as a starting template, not legal
  advice - worth an actual review against POPIA/GDPR/whatever applies
  before real users rely on it.
- **Custom 404 page.** New `404.html`, styled consistently with the rest of
  the site. Checks for a token client-side and offers "Go to dashboard" if
  signed in, or straight to "Sign in" if not - no dead-end link back to a
  page that would just bounce you again.
- **Mobile nav toggle.** A lot of mobile groundwork already existed (every
  table scrolls instead of breaking layout, forms and grids collapse to one
  column) but the sidebar itself didn't - on a phone, the brand, all 11 nav
  items, the shift widget, and sign out sat above the actual page content,
  so reaching anything meant scrolling past all of it first. Added a sticky
  toggle bar (mobile only) that collapses the nav by default and closes it
  automatically once you pick a tab.

## What isn't connected, and why

**Crop Lifecycle, Livestock, Inventory & Procurement, Tasks & Workforce, Fields, and Assets** still run exactly as they did in the original file you sent - in-memory arrays, no persistence, nothing sent to a server. This isn't an oversight: **the backend doesn't have endpoints for any of this yet.** It currently implements Auth, Farm, Greenhouse, Zone, Shift, User/Role/Permission, and Field Reports - Steps 1–5 of the build guide plus RBAC, plus the reports/recommendation workflow. Crop, Livestock, Inventory, and Tasks are Steps 6-7-8-10, not built.

These tabs do get the same role-based *visual* hierarchy as the connected ones (their "add" forms are hidden from roles that wouldn't normally use them - see `DEMO_TAB_FORM_RULES` in `backend.js`), but that's UI-only. There's no `ZonesController`-style permission policy behind them, so it isn't real enforcement - just consistency with how the rest of the dashboard behaves. That distinction is called out explicitly in a comment above `DEMO_TAB_FORM_RULES` so it doesn't get mistaken for something it isn't.

Wiring those tabs to nothing would mean either leaving them broken or quietly faking a connection - both worse than being upfront that they're demo-only for now.

**"Add farm" was removed, not connected**, because the backend's account model is one farm per account, set once at registration. A repeatable "add farm" button doesn't fit that model. There's a `POST /api/Farm` endpoint in the backend that technically lets an Owner create *another* farm, but it also reassigns that Owner's `FarmId` to the new one — abandoning their original farm as a side effect. That's more likely a leftover from before registration grew its own farm-creation step than an intentional feature, so it isn't wired here. If multi-farm-per-account is something you actually want, that's a real backend change (a join table between users and farms, not a single `FarmId` column) - worth raising separately rather than papering over it in the frontend.

**Deleting a user isn't in the UI** because the backend doesn't support it - only `IsActive` (activate/deactivate). The old demo's "×" button implied a delete that was never real to begin with.

## Known rough edges

- The farm-select dropdown is disabled with a single option, since there's only ever one farm to choose from right now. It's left in place (rather than removed) so it starts working immediately if multi-farm support is ever added.
- If a Worker, Agronomist or Technician account opens the Users & Roles tab, the table shows a message explaining they don't have permission, instead of silently failing (this is the `Permissions.UsersView` check from the RBAC layer - only Owner and Manager have it).
- Role changes and activate/deactivate both re-fetch the whole user list on success rather than patching the one row in place - simplest correct approach, costs one extra request per action.
- A Worker/Technician must be clocked in before submitting a field report (the backend rejects it with a 409 otherwise, same rule as every other log entry in the build guide) - the reports form doesn't currently check this client-side first, so the error only shows up after clicking Submit.
- The Reports nav tab's badge count is a rough "how many need me" signal (unrecommended reports for reviewers, pending-approval ones for approvers) rather than an exact unread count - good enough to notice something's waiting, not meant as a precise inbox count.

## Fixed: every dropdown's options were invisible

Only `.farm-select-wrap select option` had its text color set. Every other
`<select>` in the dashboard - the Team form's role picker included - had none,
which meant its open option list rendered in the browser's own default
background (usually white) while inheriting `--text-main`, a near-white
color. White text on a white background: present, clickable, invisible. This
is what "I can't select a role" actually was. Fixed with one global
`select option { color:#000; background:#fff; }` rule in `styles.css`, and
the matching rule in `auth.css` for the register form's dropdowns.
