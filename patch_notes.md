# Patch Notes

Directive for contributors:
- Append newest entries to the top (reverse‑chronological).
- Use ISO 8601 (UTC) timestamps like `YYYY-MM-DDTHH:mmZ`.
- Keep entries concise; reference files/paths in backticks where helpful.
- Group related bullets; prefer links (paths) to the exact files changed.

---

## 2025-10-27T12:00Z - Admin bans, signup hardening, UI fixes, and defaults

- Admin: Ban + Delete and bans management
  - Added `BannedAccount` model: `db/models/bannedAccount.js` (email, ip, hardware_id, reason, moderator, date).
  - User edit now supports Ban and delete with reason/HWID: `views/private assets/pages/user_edit.ejs` and route `POST /admin/users/:id/ban_delete` in `routes/controllers/private/users.js`.
  - Stores the target user's last session IP (not the admin IP) using `UserSession`; ignores private/loopback IPs on signup checks.
  - Records moderator persona name when available: `routes/controllers/private/users.js`, `db/models/moderatorPersona.js` (read-only).
  - Bans list and manual add/unban: `GET/POST /admin/bans` with UI `views/private assets/pages/bans.ejs`.
  - Admin sidebar: Users dropdown (All users, Banned users, Create user): `views/private assets/partials/standard/sidebar_nav.ejs`.
  - Admin create-user form: `GET/POST /admin/users/create`, page `views/private assets/pages/user_create.ejs`.

- Signup flow + validation
  - Username restricted to letters/numbers (3–24 chars) server-side and client-side: `config/passport/passport.js`, `views/public assets/pages/login.ejs`.
  - Signup now blocks banned emails and (public) IPs; private/loopback IPs are ignored to avoid dev lockouts: `config/passport/passport.js`.
  - Fixed flash handling so signup/login errors display reliably: `routes/controllers/public/login.js`, `views/public assets/pages/login.ejs`.

- Profile defaults
  - New default avatar and banner for users without uploads:
    - Avatar fallback: `/static/style/img/standard/standard_avatar.png` wired in header/profile/friends/search/announcements/support.
      Files updated across: `views/public assets/partials/standard/header.ejs`, `views/public assets/pages/profile.ejs`, `views/public assets/partials/recommendations/main.ejs`, `views/public assets/pages/temp_user.ejs`, `views/public assets/partials/profile/friends.ejs`, `views/public assets/pages/search.ejs`, `views/public assets/partials/announcements/one.ejs`, `views/public assets/pages/temp_announcements.ejs`, `routes/controllers/api/v1/announcements.js`, `routes/controllers/public/support.js`, `routes/controllers/private/support.js`.
    - Banner fallback: `/static/style/img/standard/standard_banner.png` applied on profile/recommendations/temp profile pages.

- Latest activity quick actions
  - API now returns w/f/s flags and client uses them for immediate state; if viewing own profile, StatusStore refines: `routes/controllers/api/v1/userActivity.js`, `public/style/js/profile_activity.js`.

- Favourites/Bookmarked UI
  - Element-scrolled containers with fixed height and prefill until scrollable; overlay alignment fixed when fewer than 3 rows.
  - Files: `views/public assets/partials/profile/favourites.ejs`, `views/public assets/partials/profile/bookmarked.ejs`, `public/style/js/profile_movies.js`, `public/style/js/profile_shows.js`.

- Watched pages polish
  - Align header row width with quick links and add top padding: `views/public assets/partials/profile/watched.ejs`.


## 2025-10-27T00:00Z - Site-wide filtering: skip Rumored titles and Reality TV

- Public pages
  - Redirect away from low-quality details:
    - Movies: if `status === Rumored` redirect to `/movies` (`routes/controllers/public/movies.js`).
    - Shows: if `status === Rumored` or `type/genre === Reality` redirect to `/shows` (`routes/controllers/public/shows.js`).
- API search endpoints
  - Movies: require `release_date` and `vote_count > 0` for results (`routes/controllers/api/v1/movies.js`).
  - Shows: exclude Reality (genre `10764`), require `first_air_date` and `vote_count > 0` (`routes/controllers/api/v1/shows.js`).
  - Global navbar search also applies the same filters (`routes/controllers/api/v1/search.js`).
- Home/popular lists
  - Post-filter popular movies/shows with the same rules in services and on render (`routes/services/movies.js`, `routes/services/shows.js`, `routes/controllers/public/index.js`).
- Person page
  - Filter credits to hide rumored/unreleased movies and Reality TV appearances (`routes/controllers/public/person.js`).
- Similar content
  - Movie similar list now requires `release_date` to avoid placeholder recommendations (`routes/controllers/public/movies.js`).

Notes
- Reality detection uses TMDb TV genre id `10764` and `type === 'Reality'` where available.
- These changes affect: `/`, `/movies`, `/movies/:id`, `/shows`, `/shows/:id`, `/person/:id`, and the navbar search.

## 2025-10-26T00:00Z - New public UI, fixes, support UX, and safety hardening

- Layout + Partials
  - Extracted new header/footer into shared partials and enabled across public pages: `views/public assets/partials/standard/header.ejs`, `footer.ejs`.
  - Base template always includes new header/footer; added global background and fonts; small offset under sticky header: `views/public assets/template.ejs`, `public/style/css/temp_home.css`, `views/public assets/partials/standard/head.ejs`.
  - Added floating “Join Beta” CTA for logged-out users: `views/public assets/partials/standard/floating_cta.ejs` + include in template.

- Homepage
  - Swapped real home (`/`) to new design and restored full hero + features layout: `views/public assets/pages/temp_home.ejs`.
  - “Trending” section wired to TMDb popular (6 movies + 6 shows): `routes/controllers/public/index.js`, `views/public assets/pages/temp_home.ejs`, `public/style/css/temp_home.css`.
  - `/home` and `/index` redirect to `/`; removed `/temp-home` route.

- Navigation
  - Fixed active link highlighting (runs after DOM ready and matches nested routes): `views/public assets/partials/standard/scripts.ejs`.
  - Reordered user dropdown and added “Badges”: `views/public assets/partials/standard/header.ejs`.

- Titles
  - Removed “.xyz” from tab titles; standardized to `iWatched - …`: `views/public assets/partials/standard/head.ejs`, `views/private assets/partials/standard/head.ejs`.

- Policies + Contact
  - Corrected footer policy links: `/policy/terms-of-service`, `/policy/privacy`, `/policy/community`: `views/public assets/partials/standard/footer.ejs`.
  - Contact page works for guests and redirects logged-in users to Support; safe email handling when logged out: `routes/controllers/public/contact.js`, `views/public assets/pages/contact.ejs`.

- Support UX
  - New cases no longer trigger “new reply” notifications; “New answer” badge only when last message is from support: `db/models/supportMessages.js`, `views/public assets/pages/support.ejs`.
  - Support case page: back link, “Re-open case” for closed, “Close case” for open; user routes added: `routes/controllers/public/support.js`, `views/public assets/pages/support-case.ejs`, `routes/services/support.js`.
  - Admin respond view includes “Resolve case” button: `views/private assets/partials/support/respond.ejs`.

- Shows watched logic
  - A show counts as watched if any season is completed (affects caches/search/hide-watched):
    - Bulk status API: `routes/controllers/api/v1/userShows.js` (seasons.date_completed considered).
    - Season toggle updates caches/UI: `public/style/js/toggle_season_watched.js`.
    - checkIfWatchedShow validates against API and syncs cache: `public/style/js/toggle_watched_shows.js`.

- Recommendations page polish
  - Added profile hero, stats, and quicklinks on `/user/recommendations` (and `/:id/recommendations`).
  - Hydrated header stats server-side: `routes/controllers/public/recommendations.js`, `views/public assets/partials/recommendations/main.ejs`.

- Profile/Badges
  - Badges page alignment matches profile width; header stats included so cards show correct values: `views/public assets/partials/profile/badges.ejs`, `routes/controllers/public/profile.js`.
  - Profile description rendered in hero on profile-derived pages.
  - Tier Status section hidden temporarily on settings: `views/public assets/partials/profile/settings.ejs`.

- Safety & Admin tools
  - Prevent blank/undefined username/email overwrites in settings; preserve custom URL case: `db/models/user.js`.
  - Admin user edit allows username override and preserves custom URL case: `views/private assets/pages/user_edit.ejs`, `routes/controllers/private/users.js`.


## 2025-10-26T00:00Z — Performance + Preferences + Admin Metrics

- Added Site Preferences card with two toggles:
  - "Always show Quick Actions" (watched/favourite/bookmark overlays render without hover).
    - UI: `views/public assets/partials/profile/settings.ejs`
    - Render class: `views/public assets/template.ejs` adds `pref-show-quick-actions`
    - CSS: `public/style/css/stylesheet.css` forces overlay visible when class is present
  - "Hide watched in search results" (movies/shows the user has already watched are hidden in search pages).
    - Schema: `db/models/user.js` (`profile.preferences.hide_watched_in_search`) and `markModified('profile.preferences')`
    - UI save (no redirect): AJAX handler in `views/public assets/partials/profile/settings.ejs`
    - Server save: `routes/controllers/public/profile.js` `POST /:id/settings?ajax=1` responds JSON
    - API filtering: `routes/controllers/api/v1/movies.js`, `routes/controllers/api/v1/shows.js` accept `?profile_id=...&hide_watched=1` and filter with `$in` against `UserMovie`/`UserShow`

- Quick Actions status performance:
  - Introduced bulk status endpoints returning watched/favourite/saved in one call:
    - Movies: `POST /api/v1/user-movies/status/bulk` in `routes/controllers/api/v1/userMovies.js`
    - Shows: `POST /api/v1/user-shows/status/bulk` in `routes/controllers/api/v1/userShows.js`
  - Client-side StatusStore (batch + cache):
    - `public/style/js/js_helpers/status_store.js` — batches ids, caches 10 min (sessionStorage), de-dupes, updates UI, hides watched when preference is on.
    - Hooked check functions to use cache first: `public/style/js/toggle_*` (all six movie/show variants)
    - Prefetch on append and viewport lists: `public/style/js/search_movies.js`, `public/style/js/search_shows.js`
  - Write-through cache on user actions: each toggle updates the cache immediately in the same files above.

- De-duplication in infinite scroll lists to avoid duplicate cards and icon conflicts:
  - Added `data-tmd-id` to cards: `views/public assets/partials/movies/all.ejs`, `views/public assets/partials/shows/all.ejs`
  - Skip duplicates across pages/DOM: `public/style/js/search_movies.js`, `public/style/js/search_shows.js`

- Active Sessions UI improvements:
  - Collapsible (default closed) with lazy load on first open; chevron toggle button.
  - File: `views/public assets/partials/profile/settings.ejs`

- Admin API metrics dashboard for live request visibility:
  - Page: `GET /admin/api-metrics` → `views/private assets/pages/api_metrics.ejs`
  - JSON feed: `GET /admin/api-metrics.json`
  - Route loader: `routes/controllers/private/apiMetrics.js`; registered in `routes/controllers/index.js`
  - Backend metrics enhancements: `bin/server/metrics.js`
    - Per-minute buckets (RPM + avg/hr), per-endpoint rollups (normalized paths), latency stats.
  - Metrics middleware wired at startup: `bin/server/config/serverSetup.js`

- Misc/UX:
  - Settings page now saves Site Preferences without redirect and shows a toast.
  - Server-rendered filtering for search respects the new preference; client also hides watched when statuses come from cache.

Known/Notes
- IntersectionObserver deferred fetching and cache hit/miss telemetry can be added next if desired.
- Ensure users are logged in for server-side filtering (`profile_id` is required); client automatically appends it when preference is enabled.
