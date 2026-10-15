# VertexMock

Static HTML/JS mockup of the **Vertex Sport Systems** player development dashboard. Single-athlete view designed to support — not replace — coach judgement. Built for design review and stakeholder demos before backend work begins.

## What's in v2

The dashboard centres on one athlete (Ava Thompson, U16 Girls) and surfaces:

- **Hero radar snapshot** — at-a-glance Season 1 vs Season 2 attribute comparison.
- **Player overview** — profile, KPIs, and a live development-score sparkline.
- **Height & physical projection** — actual height samples + dashed projected trend line + ±2 cm confidence band out to the U18 window, with wingspan overlay and projection KPIs.
- **Skill development radar with friend overlay** — toggle any consenting *Vertex Stat Share* friend to overlay their Season 2 radar on Ava's.
- **Vertex Stat Share** — mutual-consent peer benchmarking. Stats from another player only appear once both sides have accepted. Includes a *Share my stats* invite flow, consent badges (mutual / pending / not connected), per-row invite + reminder actions, and an auto-computed "largest gap vs shared median" callout. Framed as benchmarking, not ranking.
- **Players to watch** — a curated set of NBA pros (past & present) chosen for transferable traits that map onto Ava’s growth areas. Each card has study focus tags, why-study-them notes, film cues, and the growth areas the pro addresses.
- **Two-season timeline** — Season 1, Season 2, and coach-led turning points (now positioned at the bottom of the page); each milestone tagged with the contributing coach.
- **Coach observation summary** — eight recurring themes, each with a trend sparkline, plain-language summary, coach contribution bar (share of observations), attribution chips, and a consensus indicator (aligned vs mixed signals).
- **Observation feed** — chronological notes filterable by coach.
- **Observation volume heatmap** — category × month grid showing where coach attention has concentrated; useful for spotting blind spots.
- **Vertex insight panel** — AI-assisted, coach-supported recommendations.

## Coach attribution

Three mock coaches (`Lin`, `Rivera`, `Vidal`) with consistent colour tokens (`--coach-lin`, `--coach-rivera`, `--coach-vidal`) appear as chips on:

- Timeline milestones
- Strengths / growth / focus list items
- Observation summary cards (chips + weighted contribution bar + consensus dot)
- Feed entries (with a feed-level filter bar)

## Stack

- Plain HTML/CSS/JS — no build step.
- [Chart.js](https://www.chartjs.org/) (CDN) for radar, line, and sparkline charts.
- Inter + Roboto Mono via Google Fonts.

## File layout

```
index.html       Markup + panel structure
styles.css       Design tokens, layout, component styles
data.js          All mock data (coaches, attributes, watchlist, height series, feed, heatmap)
app.js           Rendering, chart wiring, filter + overlay interactions
assets/          Logo (SVG) and player photo
```

To swap mock data for an API later, replace the `window.VertexData` object in `data.js` with a fetch + transform; `app.js` consumes it via a stable shape.

## Organisation Dashboard Demo

`org-dashboard.html?sport=basketball` and `org-dashboard.html?sport=boxing` (tiles 05 and 06 on the hub) are the surface for early demonstrations to clubs and sporting institutions. Built on the [VERTEBRA](https://github.com/danimalanimal/VERTEBRA) kit (vendored under `vendor/vertebra/`, v1.31.0 plus the pyramid's opt-in `data-labels="count"` from the `pyramid-count-labels` branch — see `vendor/vertebra/AGENTS.md` for the consumption contract).

- **Sales & Marketing Strategy** (`#sales`) — for boxing this is a **Queensland** page. Positioning: serve the whole participation market, weighted to the largest groups without access to high-skill coaching; improve the coach whoever they are (PT, class instructor, club coach); give casual boxers progress and motivational feedback and a report they keep. Headline facts and every pyramid tier carry a numbered citation into the Sources list; AusPlay figures are marked *Verified*. The pyramid uses VERTEBRA's `data-x-pyramid` with `data-labels="count"` so bands show real headcounts (ziggurat and pyramid views; the kit's mirror view hides itself because the tiers carry no two-series split). Tiers are exclusive groups: Qld children in organised boxing (3,508), adults through a club (4,805), with a PT (4,206), a commercial boxing business (8,363), a gym / leisure centre (9,109), informal (10,372, derived) and boxing-style fitness coded as Fitness/Gym (30–69k, estimate). The financials have a **control panel** with one slider per tier (share of that tier on Vertex by year 3, with presets) that drives three notional models — casual boxer subscription, coach & PT seat licence, gym / studio / club licence — through a 35 / 70 / 100% ramp, then a go-to-market table with segment sizes, a filterable **Queensland venue directory** (`org-qld-clubs.js`, 177 venues merged from Boxing Queensland, Play On!, PCYC Queensland and UBX listings) and the numbered Sources. Basketball keeps its national AusPlay 2025 pyramid with the same control panel and three models (athlete subscription, club / association licence, assessment workshops).
- **Performance Dashboard** (`#performance`) — cumulative view of every Vertex athlete in the sport: filters (club, age band incl. adult bands, sex, market segment, coach), headline stats, development-score distribution, consistent-cohort trajectory (median + IQR), coach feedback volume by coach, metric provenance, key metric by age band (verified sources vs all entries), four standout panels (developing fastest, most coach feedback, verified key metric, physicality), and sortable athlete / coach tables. Drill down to `#performance/athlete/<id>` and `#performance/coach/<id>`. The boxing cohort is 256 athletes across eight fictional Queensland venues, one per market segment (club, PCYC-style youth club, commercial gym, franchise studio, PT collective, council leisure-centre boxfit); basketball is 202 across six clubs.
- **Examples & Links** (`#examples`) — links to the coach test interfaces, workshop report, player profiles and coach profiles. Edit `examples` in `org-data.js` to add more (the `workshopReports` array is where a basketball workshop report link goes once one exists in the repo).

Cohort data is generated deterministically in `org-data.js` (`VertexOrgData.cohort(sport)`) and seeded with the named rosters from `coach-data.js` and `boxer-data.js`; Ava Thompson and Mateo Reyes link through to their full dashboards. All figures in the financial models are notional.

```
org-dashboard.html   Shell page (VERTEBRA app shell, HUD palette, dark default)
org-dashboard.css    Surface-specific styles, all `org-` prefixed, tokens only
org-data.js          Market tiers + keyed sources, pricing model types, cohort generator, example links
org-qld-clubs.js     Queensland boxing venue directory (compiled from four public lists; see file header)
org-dashboard.js     Hash router + renderers (sales, performance, athlete, coach, examples, directory)
docs/boxing-in-australia-brief.md   Research brief the national boxing-fitness estimate comes from
vendor/vertebra/     VERTEBRA kit copy (theme, palettes, charts adapter, experiments incl. pyramid)
```

## Run locally

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes

- Projected height uses a deliberately conservative decelerating curve with a ±2 cm band, framed as a projection rather than a measurement. Swap for Khamis–Roche or a club-specific model when available.
- All data is illustrative. No real athlete information.
