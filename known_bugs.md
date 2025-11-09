Report 1
Snavs - 
Added season 1 of both twin peaks and x-files, but the profile stats counter says 4 shows - 4 seasons
He said that in first attempt of adding them nothing happened, he checked his profile inbetween adding them
He then tried to add them again, which worked
And this resulted in wrong count

Notes (suspected cause + where to look)
- Likely a race/idempotency issue in the "season complete" endpoint that double‑increments totals when two requests happen close together (first click “does nothing”, user retries).
- In routes/controllers/api/v1/userShows.js:293 (POST /api/v1/user-shows/season/complete) we compute `existing` and `preWatched` from the document, then update totals inside `if (!wasCompleted) { ... totals.save() }`.
- If two requests overlap, both can observe `wasCompleted === false` and `preWatched === false` before the first save lands, so both increment:
  - `unique_shows_watched += 1`
  - `total_seasons_watched += 1`
  - runtime/episodes also added twice
- Fix ideas:
  - Make the update atomic using a single `findOneAndUpdate` with `$addToSet` for `seasons` (to ensure the season number is only added once) and return whether it modified; only then bump totals.
  - Or re‑read after `doc.save()` and short‑circuit if another concurrent request already completed the season.
  - Add a unique “completion key” or debounce on the client, but the server should be idempotent.

Report 2
Tooltip missing on nearly all Quick Action buttons

Notes (suspected cause + where to look)
- The quick‑action <i> icons generally don’t have a `title` or `data-toggle="tooltip"` attribute in the templates that render cards (e.g. views/public assets/pages/search.ejs and the profile list templates under views/public assets/partials/profile/*_template.ejs).
- Bootstrap tooltips also require initialization (e.g. `$("[data-toggle='tooltip']").tooltip()`), which we don’t do anywhere globally.
- Fix ideas:
  - Add `title` strings and `data-toggle="tooltip"` to the action icons; initialize tooltips once in views/public assets/partials/standard/scripts.ejs after jQuery/Bootstrap load.
  - Optionally use native `title` only (no JS init) if we want to avoid Bootstrap behavior.

Report 3
Quick actions are broken on /search

Notes (suspected cause + where to look)
- Search results are injected dynamically (views/public assets/pages/search.ejs). The quick‑action icons are rendered via string concatenation and rely on inline `onclick` handlers (movieAddWatched/showAddWatched/etc.).
- A few things can make this feel “broken”:
  1) On touch devices there is no hover, so `.movie-hover` never becomes visible; icons remain hidden. CSS currently reveals on hover only. Consider forcing the overlay visible on small screens or when tapping the poster once.
  2) Tooltips missing (see Report 2) can make icons look inert; also the overlay uses `pointer-events: none` except for `.movie-actions`. If the injected markup misses the `.movie-actions` wrapper, clicks won’t register. In search.ejs it is present, but worth double‑checking when results change.
  3) If the batch status call fails, the code hides all icons and never shows them. In search.ejs we call `StatusStore.request(...)` and then `.show()`/`.hide()` the appropriate icons; on network/API failure we don’t fall back to showing the default “add” state. Add a `.catch()` that reveals “add” icons so buttons remain usable.
- Files to check: views/public assets/pages/search.ejs, public/style/js/js_helpers/status_store.js, public/style/css/stylesheet.css (hover/visibility rules).

Self report
Movie watched time doesnt seem to be correct?
Live example:
Movies watched: 140 
Time: 1 day and 8 hours and 15 minutes
Isnt correct

Another observation, more movies added, yet the time went down?
Movies watched: 156 
Time: 1 day and 6 hours and 45 minutes

Notes (suspected cause + where to look)
- Totals for movies are tracked in db/models/userMovieTotals.js and updated in routes/controllers/api/v1/userMovies.js via `totals.incWatch/decWatch(...)` using a per‑movie runtime.
- Under‑counting can happen when `runtime` is missing from TMDB for some titles; the add route falls back to `info.runtime` but if that is 0/undefined we add 0 minutes. This skews totals heavily while still increasing the movie count.
- The “time went down” symptom points to `decWatch` being applied later (e.g., accidental toggles or duplicate clicks). Another source: removing a watch decrements using a runtime fetched via `movieService.getMoveRuntimeIfNull(...)`; if that returns a non‑zero value while the original add used 0 (unknown), the net result is negative drift.
- Fix ideas:
  - When adding, if runtime is missing, try multiple fallbacks (external lookup or cached runtime) and persist the resolved runtime on the UserMovie doc so subsequent remove uses the same value.
  - Make `decWatch` prefer the stored `user_movies.movie_runtime` for that movie instead of re‑deriving.
  - Add a periodic reconciliation script to recompute `user_movie_totals.total_runtime` from `user_movies` to catch historical drift.
