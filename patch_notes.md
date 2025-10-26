# Patch Notes

Directive for contributors:
- Append newest entries to the top (reverse‑chronological).
- Use ISO 8601 (UTC) timestamps like `YYYY-MM-DDTHH:mmZ`.
- Keep entries concise; reference files/paths in backticks where helpful.
- Group related bullets; prefer links (paths) to the exact files changed.

---

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

