# Patch Notes

## 2025-11-11T19:30Z - Reviews system (v1), profile route links, and API docs

- Reviews model + API
  - New `Review` model with votes and embedded comments; configurable length via `SiteSetting.review_max_length`.
  - API endpoints: list/get/create/update/delete review, vote; comment add/edit/delete/reply/vote.
  - Files: `db/models/review.js`, `db/models/siteSetting.js`, `routes/controllers/api/v1/reviews.js`.

- Movies/Shows integration
  - Added Reviews section below Similar on movie/show pages with star widget (half-stars), voting and comments.
  - Fixed similar-toggle script placement and ensured deleted comments render as placeholder.
  - Files: `views/public assets/partials/movies/one.ejs`, `views/public assets/partials/shows/one.ejs`.

- Profile reviews page
  - Pretty route `/:id/reviews` (custom_url or ObjectId), renders inside standard profile shell (banner, stats, quicklinks).
  - Server‑rendered list (no comments) with links to the reviewed item.
  - Files: `routes/controllers/public/reviews.js`, `views/public assets/partials/profile/reviews.ejs`, `views/public assets/partials/reviews/main.ejs`.

- Navigation + pretty links
  - User dropdown links now use custom_url/id: Recommendations, My Reviews, Badges.
  - Kept legacy `/user/...` paths as shortcuts that redirect to pretty paths.
  - Files: `views/public assets/partials/standard/header.ejs`, `views/public assets/partials/standard/navigation.ejs`, `routes/controllers/public/recommendations.js`, `routes/controllers/public/profile.js`.

- API dashboard
  - Added Reviews section with route list and payload notes.
  - Files: `views/api assets/pages/index.ejs`.

- Misc
  - Auto‑upvote review author on create/update; ensured comment enrichment (avatar/link) in GET one review.
  - Files: `routes/controllers/api/v1/reviews.js`.

## 2025-11-11T13:00Z - Personalize fixes, final layout for controls, new showcases polish

- Personalize bug fix
  - Fixed SSR-to-client JSON embedding in `user_personalize.ejs` to avoid quote-escape breakage when notes include apostrophes.
  - Hydrate previews from enriched server data so Favorite Person/Title render on refresh.

- Catalog + Selected UI polish
  - Restyled catalog items and Add buttons; added live used/max badges (e.g., 1/3, 0/1).
  - Finalized “Steam-like” controls: up/drag/down/remove appear as a dedicated right-side column per showcase, inside Selected but outside the item box; non-wrapping layout.
  - Files (key): `public/style/css/profile_personalize.css`, `views/public assets/pages/user_personalize.ejs`.

- Slot-based editing
  - Favorite Movies/Actors: six editable slots with slot-anchored search popover; closes on select/outside/Escape.
  - Favorite Person/Title: converted to the same slot popover flow (single slot); note editor sits to the right of the poster in the preview.
  - My Badges: chooser popover with user’s badges; supports selecting order; preview shows chosen + next empty slot.
  - Files: `views/public assets/pages/user_personalize.ejs`, `public/style/css/profile_personalize.css`.

- New showcases (v1)
  - My Favorite Movies, My Favorite Actors, My Favorite Shows (6 slots each), and My Badges (6/12).
  - Enrichment + public render for each; `/user` now displays them alongside existing showcases.
  - Files: `routes/controllers/api/v1/userShowcases.js`, `routes/controllers/public/profile.js`,
           `views/public assets/partials/showcases/{favorite_movies.ejs,favorite_actors.ejs,favorite_shows.ejs,my_badges.ejs}`,
           `views/public assets/partials/profile/main.ejs`.

- Admin
  - Added `/admin/showcase-catalog` (list/edit/toggle) and link under Content in admin nav.
  - Files: `routes/controllers/private/showcaseCatalog.js`, `views/private assets/pages/showcase_catalog.ejs`,
           `views/private assets/partials/standard/sidebar_nav.ejs`, `routes/controllers/index.js`.

Directive for contributors:
- Append newest entries to the top (reverse-chronological).
- Use ISO 8601 (UTC) timestamps like `YYYY-MM-DDTHH:mmZ`.
- Keep entries concise; reference files/paths in backticks where helpful.
- Group related bullets; prefer links (paths) to the exact files changed.


## 2025-11-11T00:00Z - Profile showcases system (v1), personalize UI, and visual fixes

- Core model + API
  - Added showcase catalog and per-user selection models and routes.
  - API: `GET/PUT /api/v1/user-showcases/:profile_id` to resolve and save layout.
  - Files: `db/models/showcaseCatalog.js`, `db/models/userShowcase.js`, `routes/controllers/api/v1/userShowcases.js`.

- Personalize page (/:id/personalize)
  - Catalog + Selected panel, add/remove, mode controls, item count.
  - Typeahead search for favorites (reuses `/api/v1/search`).
  - Live preview while editing; dirty-state tracking + beforeunload warning.
  - Hydrates from API on load to avoid stale SSR state.
  - Files: `views/public assets/pages/user_personalize.ejs`, `public/style/css/profile_personalize.css`.

- Recent Timeline showcase
  - Converted legacy “Latest activity” to a showcase (`recent_timeline`).
  - Modes: mixed, movies_only, shows_only; configurable items (6 or 12).
  - Titles computed per mode (e.g., “Recently Added Movies/Shows”).
  - Movies/Shows lists fetched independently; mixed uses unified endpoint.
  - Files: `views/public assets/partials/showcases/recent_timeline.ejs`, `public/style/js/profile_activity.js`, `routes/controllers/api/v1/userActivity.js`, `routes/controllers/public/profile.js`.

- Favorite showcases
  - `favorite_person` (mode: actor/director) with note; fetches TMDB person info.
  - `favorite_title` (mode: movie/show) with note; resolves from DB or TMDB.
  - Profile partials render image, short description/tagline, and note.
  - Files: `views/public assets/partials/showcases/favorite_person.ejs`, `views/public assets/partials/showcases/favorite_title.ejs`, `routes/controllers/public/profile.js` (enrichment).

- Profile integration
  - Profile main renders selected showcases in saved order; seeding defaults.
  - Added catalog seeding for all three showcases if missing.
  - Files: `views/public assets/partials/profile/main.ejs`, `routes/controllers/public/profile.js`.

- Quick Actions + overlay fixes
  - Duplicate poster status now updates across all instances (scoped toggles).
  - Clipped hover gradient strictly to poster; overlay moved inside link.
  - Files: `public/style/js/toggle_watched_movies.js`, `public/style/js/toggle_watched_shows.js`, `views/public assets/partials/profile/movie_template.ejs`, `views/public assets/partials/profile/show_template.ejs`, `public/style/css/stylesheet.css`.

- Limits + plan logic
  - Free: max 3 showcases; Premium: max 6. Enforced server-side on save.
  - Per-showcase `max_instances`: `recent_timeline` (3), favorites (1).
  - Files: `routes/controllers/api/v1/userShowcases.js`.

- Notes
  - Legacy “Latest activity” UI removed; markup clearly labeled when retained.
  - `/user` redirects to `/:id` (single source); both render same page.
  - Known follow-ups: add “Reset to saved” in personalize; add more showcases.


## 2025-11-09T18:00Z - Movies/Shows UI revamp, multi-genre search, GDPR export/delete, and logo preference

- Movies (desktop)
  - Added floating left genre sidebar with compact, wrapping pills; synced with inline list; strong active styling.
  - Sidebar includes a compact search bar that proxies the main search.
  - Multi-genre filtering (AND by default): toggle multiple chips; URL `?genre=a,b`; API uses TMDB `discoverMovie` with `with_genres` (supports `|` for OR).
  - Clipped hover gradient to poster; removed row-wide dark bands; added spacing between chips and grid.
  - Fixed scroll-to-top button and layout spacing from navbar; kept poster size intact.
  - Files: `views/public assets/partials/movies/all.ejs`, `public/style/js/search_movies.js`, `routes/controllers/api/v1/movies.js`, `routes/controllers/public/movies.js`.

- Shows (desktop)
  - 3×6 scrollable grid container with infinite load (removed "View more"); active genre highlight.
  - Clipped hover gradient to poster; added spacing between chips and grid.
  - Files: `views/public assets/partials/shows/all.ejs`, `public/style/js/search_shows.js`.

- GDPR & Privacy on Settings
  - Export zip with `Profile_Data.json`, `Movie_Data.json`, `Show_Data.json` (sanitized sessions; excludes password/private keys). Rate-limited to 1/24h.
  - Permanent delete endpoint (password required) with cascading cleanup; De-activate account flag and UI.
  - Files: `routes/controllers/public/profile.js`, `views/public assets/partials/profile/settings.ejs`, `package.json` (added `archiver`).

- Logo preference
  - New setting: clicking the iWatched logo navigates to user profile; applied in header and nav.
  - Files: `db/models/user.js`, `views/public assets/partials/standard/header.ejs`, `views/public assets/partials/standard/navigation.ejs`, `views/public assets/partials/profile/settings.ejs`, `views/public assets/partials/standard/scripts.ejs`.

- Documentation
  - Added Dependencies section describing all runtime packages.
  - File: `documention.md`.


## 2025-11-09T00:00Z - Admin tools for runtime recalculation, caching, API robustness, and legacy cleanup

- Admin: Users Tools — Movies and Shows
  - Added background jobs with polling + cancel-after-current and issue-only logs.
  - Endpoints:
    - Movies: `POST/GET /admin/users/tools/recalculate-movies/{start,active,status/:jobId,cancel}`
    - Shows: `POST/GET /admin/users/tools/recalculate-shows/{start,active,status/:jobId,cancel}`
  - UI card with progress bars and options: Force TMDB refresh (this run only) and Clear cache; page reconnects after refresh.
  - Files: `routes/controllers/private/users.js`, `views/private assets/pages/users_tools.ejs`, `views/private assets/partials/standard/sidebar_nav.ejs`.

- Caching + environment
  - Dev uses OS temp (`%TEMP%/iwatched/cache`); Prod uses `bin/cache` (override via `IWATCHED_CACHE_DIR`).
  - New caches: `movie_runtime_cache.json`, `show_season_runtime_cache.json`, `show_avg_runtime_cache.json`.

- Movies runtime logic
  - API `POST /api/v1/user-movies/watch/add` now resolves runtime cache-first: request → in-process cache → `movies` collection → TMDB → REST fallback; writes to in-process cache.
  - Admin recompute prefers `user_movies.movie_runtime` > 0, then `movies.movie_runtime`, then TMDB; backfills `user_movies.movie_runtime` when 0.
  - Files: `routes/controllers/api/v1/userMovies.js`, `routes/controllers/private/users.js`.

- Shows runtime logic
  - Recompute counts only completed seasons; excludes specials (season 0). Uses TMDB season data with per-show average fallback.
  - Files: `routes/controllers/private/users.js`.

- Legacy cleanup
  - Removed legacy profile API and legacy models (saved/favourited/watched collections). `getTimeWatched` now reads from totals only.
  - Files: `routes/controllers/api/v1/profile.js` (deleted), `routes/controllers/index.js`, `routes/services/users.js`, `db/models/*` legacy deletions.

- Reliability fixes
  - `apiIsCorrectUser` now returns HTTP 401 (was 200 with JSON `{status:401}`), adds warning log.
  - Frontend watch toggles await responses and revert UI on failure.
  - Files: `routes/middleware/apiIsCorrectUser.js`, `public/style/js/toggle_watched_movies.js`.

- Misc
  - Tools sidebar link under Users; avoided nodemon restarts by moving caches in dev.

## 2025-10-29T00:00Z - Storage, uploads, contact anti-spam, admin UI, and SEO

- Avatars/Banners to S3 with proxy and migration
  - Added S3/Tigris helper with `putObject/deleteObject/streamToResponse/list` and proxy route so existing URLs keep working.
  - Uploads now go to bucket under `style/img/profile_images/users/:id/…` and are streamed at `/static/style/img/profile_images/users/...`.
  - Migration script to push existing local files: `npm run migrate:profile-images`.
  - Files: `bin/server/config/storage.js`, `bin/server/config/serverSetup.js`, `routes/services/users.js`, `scripts/migrate_profile_images_to_s3.js`, `package.json`.

- Upload limits and image processing
  - Client + server limits: Free 5MB, Premium 8MB; friendly error messaging on `/users/settings`.
  - Compress + sanitize with `sharp`: avatars 512x512 WebP, banners 1600x400 WebP; MIME sniffing via `file-type`.
  - Files: `views/public assets/partials/profile/settings.ejs`, `routes/controllers/public/profile.js`, `bin/server/utils/imageProcessing.js`.

- Contact form anti‑spam and CAPTCHA
  - Added honeypot, 3s timing check, IP rate‑limit (5/hour), heuristic text filter, IP/UA capture.
  - Optional reCAPTCHA v2 or hCaptcha; auto‑selects reCAPTCHA when provided; fallback to hCaptcha.
  - Files: `routes/controllers/public/contact.js`, `bin/server/utils/antiSpam.js`, `bin/server/utils/rateLimit.js`, `views/public assets/pages/contact.ejs`, `db/models/contactMessages.js`.

- Admin Contact improvements
  - Pagination, sorting, status badge (Spam/Clean), Received column, and Delete action.
  - Files: `routes/controllers/private/contact.js`, `views/private assets/pages/contact.ejs`.

- Admin pages (visual) and moderation tool
  - Admins & Roles (visual): `GET /admin/admins` → `views/private assets/pages/admins.ejs`.
  - Admin Audit (visual): `GET /admin/audit` → `views/private assets/pages/audit.ejs`.
  - Uploads Moderation (functional): list latest avatars/banners (S3 or FS), delete file and clear user reference.
    - Files: `routes/controllers/private/uploads.js`, `views/private assets/pages/uploads_moderation.ejs`.
  - Wired routes in `routes/controllers/index.js` and sidebar links.

- Admin dashboard polish
  - “API Metrics” button on top; unique visits (24h) counter (by IP) and live polling.
  - Files: `views/private assets/pages/index.ejs`, `bin/server/metrics.js`.

- Admin sidebar restructure + icon fix
  - Grouped sections (Dashboard, Inbox, Users, Content, System, Exit). Replaced Badges icon with `fa-certificate`.
  - Files: `views/private assets/partials/standard/sidebar_nav.ejs`, `public/style/css/admin_dashboard.css`.

- Branding & SEO
  - Dropped `.xyz` from titles; canonical tags and dynamic `og:url`; `robots.txt` + `sitemap.xml`.
  - Optional `PRIMARY_HOST` redirect support (leave unset if not needed).
  - Files: `views/public assets/partials/standard/head.ejs`, `public/robots.txt`, `public/sitemap.xml`, multiple route title updates, `public/manifest.json`.

## 2025-10-27T13:00Z - SEO: site name, icon, and snippet polish

- Added rich head metadata to improve how the homepage appears in Google and social shares.
  - Favicon/app icons + theme color: `cropped_ico.png` wired via `link rel="icon"`, `shortcut icon`, `apple-touch-icon`, and `<meta name="theme-color">`.
  - Default meta description: “A better way to see what you've seen.”
  - Open Graph / Twitter cards: title, description, image set to standard banner.
  - Structured data (JSON‑LD):
    - `WebSite` with preferred site name “iWatched”, URL `https://iwatched.app`, and `SearchAction` for on‑site search.
    - `Organization` with `logo` set to `cropped_ico.png`.
  - File: `views/public assets/partials/standard/head.ejs`.

Notes
- These hints help Google render the “iWatched” site name, show your icon, and use the new tagline under the result. Changes take effect after re‑crawl.

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
