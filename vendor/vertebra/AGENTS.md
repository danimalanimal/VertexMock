# VERTEBRA — build instructions for agents

A design system shipped as plain CSS and JS. No build step, no framework, no
runtime dependencies. You use it by adding two tags to an HTML page.

Read this file before writing any markup. Most of it is the class contract;
the part that actually breaks things is **Hard rules**, so read that first.

---

## 1. Wire it up

Copy the kit into your project (see `install-vertebra.ps1`, or just copy the
files) and reference it. Minimum viable page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your page</title>

  <!-- MUST run pre-paint, in <head>, before the stylesheet. Otherwise the
       page lands in light for one frame and visibly flashes. -->
  <script>
    (function () {
      try {
        var t = localStorage.getItem("vertebra-theme");
        if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches))
          document.documentElement.setAttribute("data-theme", "dark");
        var f = localStorage.getItem("vertebra-font");
        if (f && /^[a-f]$/.test(f)) document.documentElement.setAttribute("data-font", f);
        var p = localStorage.getItem("vertebra-palette");
        if (p && p !== "default" && /^[a-z][a-z-]*$/.test(p))
          document.documentElement.setAttribute("data-palette", p);
      } catch (e) {}
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

  <!-- theme.css FIRST, palette file AFTER (it overrides tokens) -->
  <link rel="stylesheet" href="vendor/vertebra/theme.css?v=VERSION" />
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>

  <header class="topbar">
    <div class="container">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span> Your app</a>
      <div class="topbar-actions">
        <button class="theme-switch" data-theme-toggle role="switch" aria-checked="false" aria-label="Dark theme">
          <span class="ts-opt ts-light" aria-hidden="true">Light</span>
          <span class="ts-track" aria-hidden="true"><span class="ts-thumb"></span></span>
          <span class="ts-opt ts-dark" aria-hidden="true">Dark</span>
        </button>
      </div>
    </div>
  </header>

  <main id="content">
    <section class="section"><div class="container">
      <p class="kicker">Section label</p>
      <h1>Heading</h1>
    </div></section>
  </main>

  <script src="vendor/vertebra/theme.js?v=VERSION"></script>
</body>
</html>
```

`starter.html` in the kit is this same skeleton, kept current — copy it rather
than retyping.

Every local asset carries `?v=<version>` matching the release tag. Keep it,
and bump it when you upgrade, or browsers serve stale CSS.

---

## 2. Hard rules

These are the ones that cause real breakage. They are not style preferences.

**Never define `.chip`, `.empty` or `.tag` in the kit.** The kit deliberately
leaves those three names to consuming apps, which already ship their own. A
same-named rule in the kit leaks every property the app does not itself
declare — this shipped once and uppercased an app's UUIDs. The kit's own
equivalents are `.pill` / `.pill-row` / `.pill-x` and `.empty-state`.

**Colours come from tokens. Never write a raw hex value** in app CSS. If you
hardcode `#1a1a1a`, it stays black in light mode, ignores all five palettes,
and breaks the moment someone switches theme. Use `var(--ink)` etc.

**Do not rename or repurpose an existing class.** Component class names are a
public contract; renames are breaking changes for every consuming app. Add
new names instead — the kit is additive-only.

**Every interactive thing must be keyboard-operable with correct ARIA.** Real
`<button>`/`<a>` elements, visible focus, `aria-expanded` on disclosures,
`role="switch"` + `aria-checked` on toggles. Do not build a control out of a
`<div>` with a click handler.

**Load order matters**: `theme.css` first, then a palette file, then your app
CSS. The palette works by overriding tokens, so it must come after.

---

## 3. Theming

Set these on `<html>`. All are optional; the defaults are light + palette
"default" + font pairing A.

| Attribute | Values | Meaning |
|---|---|---|
| `data-theme` | `dark` | Dark mode. Absent = light. |
| `data-palette` | `blossom` `corporate` `hud` `neutrals` `ma` | Alternate colour scheme. Needs its `palette-<name>.css` loaded. |
| `data-font` | `a`–`f` | Type pairing. A standard, B Chakra Petch, C Rajdhani, D Michroma, E Pixelify (Y2K), F Fraunces+Karla (warm serif). Load the matching Google Fonts link. |
| `data-density` | `touch` | Larger tap targets. |
| `data-discreet` | (present) | Veils media thumbnails. |

Every palette redefines the same semantic tokens, so a component written
against tokens works in all of them for free.

### Tokens

Surfaces `--bg` `--bg-alt` `--surface` `--surface-2`
Text `--ink` `--ink-muted` `--ink-faint`
Lines `--line` `--line-soft` `--grid-line`
Accent `--accent` `--accent-strong` `--accent-soft` `--on-accent`
Status `--danger` `--danger-soft` `--warn` `--warn-soft` `--meter` `--meter-ink`
Two-user `--u1` `--u1-soft` `--u2` `--u2-soft`
Shape `--radius` `--space` `--shadow` `--focus-ring` `--topbar-h`
Motion `--ease` `--t-fast` `--t-med`
Stacking `--z-nav` `--z-fab` `--z-sheet` `--z-modal` `--z-lightbox` `--z-palette` `--z-toast` `--z-tip`

Use the `--z-*` tokens rather than raw `z-index` numbers, so an app can
re-base the whole stack.

---

## 4. Class contract

**Layout** `.container` `.section` `.grid` `.grid-sm` `.row` `.stack` `.panel`
`.card` `.card-header` · spacing helpers `.mt-lg` `.mb-lg` `.gap-lg`

**Chrome** `.topbar` `.topbar-actions` `.brand` `.brand-mark` `.nav`
`.nav-group` `.nav-menu` `.nav-toggle` `.nav-badge` `.footer` `.skip-link`
`.tabs` `.tabbar` `.sidebar*` `.shell-body` `.shell-main` `.edge-tab`

**Type** `.kicker` `.label` `.muted` `.mono` `.small` `.byline` `.sr-only`

**Controls** `.btn` (`.btn-primary` `.btn-ghost` `.btn-danger` `.btn-icon`
`.btn-sm` `.btn-lg`) `.input` `.field` `.field-error` `.check` `.radio`
`.toggle` `.segctl` `.menu` `.theme-switch` `.date-range` `.input-affix`
(with `.affix-pre` / `.affix-post`)

**Ratings** `.rate` + one of `.rate-stars` (X then five, native radios, no
JS), `.rate-thumbs` (`.rate-vote` `.rate-up` `.rate-down`, toggle buttons
with `aria-pressed`, needs `data-rate-thumbs`), `.rate-slider` (`.rate-out`
`.rate-scale`, needs `data-rate-slider`). Retint with `--rate-on` /
`--rate-off`. Both scripted ones emit a `vertebra:rate` event.

**Status** `.badge` (`-ok` `-warn` `-err`) `.alert` (`-ok` `-warn` `-err`)
`.pill` (`-ok` `-warn` `-danger` `-x`) `.pill-row` `.status-dot` `.toast*`
`.tip`

**Data** `.table` `.table-wrap` `.progress` `.progress-fill` `.progress-row`
`.gauge` `.stat` (`.stat-label` `.stat-value` `.stat-hint` `.stat-lg`
`.stat-ok` `.stat-warn` `.stat-err`) `.num` (`.num-pos` `.num-neg`
`.num-mono`) `.lcd` `.swatch*`

**Loading / empty** `.spinner` `.spinner-radar` `.skeleton` `.skeleton-line`
`.skeleton-card` `.skeleton-thumb` `.empty-state` `.empty-state-icon`

**Overlays** `.sheet*` `.modal-*` `.cmdk*` `.fab` `.fab-dial` `.combo*`

**Two-user** `.who` `.who-sm` `.who-both` `.who-img`

**Collaboration components** `.todo*` `.capture*` `.focus-card` `.timebox`
`.decision*` `.chat*` `.msg*` `.deck*` `.board*` `.pile*` `.tree*`
`.sortable` `.cal-mini*`

Suffix conventions: `-sm`/`-lg` size, `-ok`/`-warn`/`-err` tone.

---

## 5. JavaScript

`theme.js` is optional — every component renders without it; JS only adds
behaviour. It self-initialises from `data-*` attributes on load.

The API is `window.vertebra`, with `window.sentinel` as a permanent alias
(the kit was formerly called Sentinel; **both names must keep working**).

```js
vertebra.toast("Saved");                    // transient message
vertebra.setProgress(el, 42);               // drive a .progress
vertebra.decode(el);                        // text-scramble reveal
vertebra.nudge(el);  vertebra.badge(el, 3);
vertebra.sheet.open(el);                    // bottom sheet
vertebra.layer(...)                         // overlay stack: scroll lock,
                                            // focus restore, Escape routing
vertebra.gesture(...) vertebra.combo(...) vertebra.cmdk(...)
vertebra.say(...)    vertebra.user(...)
```

If you add a module, **merge** into the namespace, never assign:

```js
window.sentinel = window.sentinel || {};   // correct
window.sentinel = { mine: fn };            // WRONG — destroys everything else
```

---

## 6. Optional modules

Load only what a page uses. Each is a CSS + JS pair alongside `theme.css`.

| Module | Purpose |
|---|---|
| `vertebra-cal.*` | Calendar, over a vendored MIT engine in `vendor/event-calendar/` |
| `vertebra-media.*` | Thumb grids, masonry, lightbox, dropzone |
| `vertebra-vitals.*` | Readouts and live figures |
| `vertebra-charts.js` | Chart.js theming bridge (Chart.js not bundled) |
| `experiments.*` | Ambient displays and data instruments: radar/scope/spectrum, worldmap, pebblemap, flow ledger, `data-x-market` tape, `data-x-atlas` country plate + site tree, `data-x-pyramid` tiered pyramid (terrace / mirror / ziggurat; `data-labels="count"` for numbers instead of shares) |
| `integrations.css` | Third-party widget reskins |

---

## 7. If you are editing the kit itself

- **Additive only.** Never change what an existing class already renders —
  three apps depend on it.
- **Grep all consumers before adding any bare class name**, for the
  collision reason in Hard rules.
- Anything new appears in a showcase page with fake data in the same change.
- On release: bump `?v=` on every local asset and the VER chip in
  `vertebra.html`, then tag.
