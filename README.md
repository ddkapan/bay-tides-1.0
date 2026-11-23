# Bay Tide Log

Quick prototype (fast first pass, not yet the reproducible-research rebuild) of a phone web app for tide-linked shorebird surveys.

One self-contained page, `index.html` (inline CSS and JS; Leaflet and JSZip from cdnjs), plus `sw.js` for offline use.

## What it does
- San Francisco Bay NOAA CO-OPS (Center for Operational Oceanographic Products and Services) stations, live from the metadata API; default Richmond 9414863 (gauge, real time).
- Predicted tide (6-minute) vs observed gauge, high/low markers, now-line, touch readout with residual (gauge minus predicted).
- Date range (max 31 days per NOAA request), local station time (lst_ldt), datum NAVD88 by default (MLLW, MSL, station datum selectable), feet or metres.
- If a station does not serve NAVD88, heights are converted from MLLW (Mean Lower Low Water) with the station's published datums; if that fails, MLLW is shown and labelled.
- Subordinate (prediction-only) stations: curve interpolated from highs and lows by cosine interpolation.
- Observations: time, place (GPS or map tap or typed), species/count, note, photos; saved in the browser (IndexedDB) with nearest station, distance, predicted and observed tide height at that moment. Export CSV, JSON, or ZIP with photos.

## Run
Needs a normal web origin (https or localhost) so the browser can call the NOAA API:
`npx http-server -p 8080 .` then open http://localhost:8080, or host on GitHub Pages.
The claude.ai artifact preview blocks outside requests, so live NOAA data does not load there.

## Deploy and updates
- GitHub Pages serves `main` at https://ddkapan.github.io/bay-tides-1.0/. Changes go in on a feature branch and a PR (a local pre-push hook blocks pushing from `main`).
- Open tabs update themselves: the page checks its own ETag every 60 s and when the tab is shown, and reloads when a new deploy lands. It waits while the observation dialog is open, and if browser storage is unavailable it asks you to export first instead of reloading.
- Offline (`sw.js`): the page is fetched network-first (cached copy offline); the last NOAA data, libraries, and up to 800 viewed map tiles are cached. Cache names are fixed, so no version bump is needed when shipping.

## Known limits
- Times are parsed as the phone's local time; correct for Bay Area stations on a Pacific-time phone.
- Observations live in one browser until exported.
- Not yet tested against the live NOAA API from a browser (build sandbox could not reach NOAA); logic tested with a mocked API.
