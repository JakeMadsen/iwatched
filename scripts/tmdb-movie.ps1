<#!
Fetch TMDb movie data by ID or slug from the terminal and
emit quick signals to spot likely placeholder/blank entries.

Usage:
  pwsh scripts/tmdb-movie.ps1 848890-the-tomorrow-war-2
  pwsh scripts/tmdb-movie.ps1 848890
  pwsh scripts/tmdb-movie.ps1 https://iwatched.app/movies/848890-the-tomorrow-war-2

Requires:
  - TMDb v3 API key: uses `TMDB_API_KEY` if set (and not a
    placeholder), otherwise falls back to a bundled demo key.
    You can still save your own at $HOME/.tmdb_api_key.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$MovieIdOrSlug,

  [switch]$Raw,
  # If provided interactively, do not persist to disk
  [switch]$NoPersist
)

# Constants (match requested behavior)
$TMDB_BASE_URL = "https://api.themoviedb.org/3"
$TMDB_DEFAULT_KEY = "ab4e974d12c288535f869686bd72e1da"

function Get-TmdbApiKey {
  # 1) Environment variable (ignore placeholder)
  $key = $env:TMDB_API_KEY
  if ($key -and ($key -notmatch '^(?i)your-tmdb-api-key$')) { return $key }

  # 2) .env in CWD (TMDB_API_KEY=...) if present
  $envPath = Join-Path -Path (Get-Location) -ChildPath '.env'
  if (Test-Path $envPath) {
    try {
      $line = (Get-Content -Path $envPath -ErrorAction Stop) | Where-Object { $_ -match '^\s*TMDB_API_KEY\s*=\s*.+$' } | Select-Object -First 1
      if ($line) {
        if ($line -match '^\s*TMDB_API_KEY\s*=\s*(.+)\s*$') {
          $fromEnvFile = $matches[1].Trim('"','\'',' ')
          if ($fromEnvFile -and ($fromEnvFile -notmatch '^(?i)your-tmdb-api-key$')) { return $fromEnvFile }
        }
      }
    } catch {}
  }

  # 3) Local file in CWD
  $localFile = Join-Path -Path (Get-Location) -ChildPath '.tmdb_api_key'
  if (Test-Path $localFile) {
    try {
      $fromLocal = (Get-Content -Path $localFile -TotalCount 1).Trim()
      if ($fromLocal -and ($fromLocal -notmatch '^(?i)your-tmdb-api-key$')) { return $fromLocal }
    } catch {}
  }

  # 4) User profile file
  $homeFile = Join-Path -Path $HOME -ChildPath '.tmdb_api_key'
  if (Test-Path $homeFile) {
    try {
      $fromHome = (Get-Content -Path $homeFile -TotalCount 1).Trim()
      if ($fromHome -and ($fromHome -notmatch '^(?i)your-tmdb-api-key$')) { return $fromHome }
    } catch {}
  }

  # 5) Fallback default key from request snippet
  if ($TMDB_DEFAULT_KEY) { return $TMDB_DEFAULT_KEY }

  # 6) Prompt only as a last resort
  $entered = Read-Host -Prompt 'Enter your TMDb v3 API key'
  if ([string]::IsNullOrWhiteSpace($entered)) {
    throw 'A TMDb API key is required to proceed.'
  }
  if (-not $NoPersist) {
    try { Set-Content -Path $homeFile -Value $entered -NoNewline -Encoding utf8 } catch {}
  }
  return $entered
}

function Get-MovieIdFromSlug([string]$slug) {
  # Accept full URLs, path segments, or plain id/slug
  $candidate = $slug
  if ($slug -match 'https?://[^\s]+/(\d+)[^/\s]*$') { return $matches[1] }
  if ($slug -match '^(\d+)') { return $matches[1] }
  throw "Could not parse numeric TMDb ID from: $slug"
}

try {
  $apiKey = Get-TmdbApiKey
  $id = Get-MovieIdFromSlug $MovieIdOrSlug

  $url = "$TMDB_BASE_URL/movie/$id?api_key=$apiKey&language=en-US&append_to_response=release_dates,images,videos,credits,external_ids"
  $data = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop

  if ($Raw) {
    $data | ConvertTo-Json -Depth 6
    exit 0
  }

  # Quick summary
  $summary = [pscustomobject]@{
    id              = $data.id
    title           = $data.title
    original_title  = $data.original_title
    status          = $data.status                   # Released, Rumored, Planned, In Production, Post Production, Canceled
    release_date    = $data.release_date
    runtime         = $data.runtime
    overview_len    = if ($null -ne $data.overview) { ($data.overview).Length } else { 0 }
    has_poster      = [bool]$data.poster_path
    has_backdrop    = [bool]$data.backdrop_path
    vote_count      = $data.vote_count
    vote_average    = $data.vote_average
    popularity      = [math]::Round([double]$data.popularity, 2)
    has_imdb        = [bool]$data.external_ids.imdb_id
    genres          = ($data.genres | ForEach-Object { $_.name }) -join ', '
  }

  # Heuristic to flag likely placeholders/non‑existent entries
  $likelyPlaceholder = (
      $summary.status -ne 'Released' -or
      [string]::IsNullOrWhiteSpace($data.release_date) -or
      $summary.runtime -eq 0 -or
      $summary.overview_len -eq 0 -or
      $summary.vote_count -lt 1
  )

  $result = [pscustomobject]@{
    summary            = $summary
    likely_placeholder = $likelyPlaceholder
  }

  $result | Format-List

} catch {
  Write-Error $_
  exit 1
}
