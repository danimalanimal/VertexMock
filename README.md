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

## Run locally

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes

- Projected height uses a deliberately conservative decelerating curve with a ±2 cm band, framed as a projection rather than a measurement. Swap for Khamis–Roche or a club-specific model when available.
- All data is illustrative. No real athlete information.
