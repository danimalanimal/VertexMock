/* VERTEBRA × Chart.js adapter (Chart.js 4.x, MIT). Formerly sentinel-charts.js.
   Load AFTER chart.umd.js and theme.css. Canvas can't see CSS custom
   properties, so this file resolves the theme tokens into a Chart.js theme,
   applies it as global defaults, and re-themes every chart created through
   sentinel.chart() whenever data-theme flips on <html>.

   Usage:
     const c = sentinel.chart(document.getElementById("my-canvas"), {
       type: "line",
       data: { labels: [...], datasets: [{ label: "SIGNAL", data: [...] }] },
     });
   Datasets without explicit colors get the Sentinel palette and stay in sync
   with the light/dark toggle. Charts made with `new Chart(...)` directly still
   pick up fonts/grid defaults at creation but are NOT re-themed live. */
(function () {
  "use strict";
  if (!window.Chart) return; /* Chart.js not on this page — no-op */

  const root = document.documentElement;
  const charts = new Set();

  /* resolve a CSS custom property to a concrete rgb() the canvas can use
     (handles var() chains and color-mix) */
  function resolveColor(varName) {
    const probe = document.createElement("span");
    probe.style.color = "var(" + varName + ")";
    probe.style.display = "none";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }

  function alpha(rgb, a) {
    /* "rgb(1, 2, 3)" -> "rgba(1, 2, 3, a)" */
    const m = rgb.match(/\d+(\.\d+)?/g) || [0, 0, 0];
    return "rgba(" + m[0] + ", " + m[1] + ", " + m[2] + ", " + a + ")";
  }

  function tokens() {
    return {
      ink: resolveColor("--ink"),
      muted: resolveColor("--ink-muted"),
      faint: resolveColor("--ink-faint"),
      grid: resolveColor("--line-soft"),
      surface: resolveColor("--surface"),
      bg: resolveColor("--bg"),
      meter: resolveColor("--meter"),
      accent: resolveColor("--accent"),
      warn: resolveColor("--warn"),
      danger: resolveColor("--danger"),
      fontMono: getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace",
    };
  }

  function seriesPalette(t) {
    return [t.meter, t.faint, t.warn, t.danger, t.ink];
  }

  function applyDefaults(t) {
    const d = Chart.defaults;
    /* Chart.js v4 auto-assigns its own palette via the colors plugin before we
       can — disable it, the Sentinel palette takes over */
    if (d.plugins.colors) d.plugins.colors.enabled = false;
    d.color = t.muted;
    d.borderColor = t.grid;
    d.font.family = t.fontMono;
    d.font.size = 11;
    d.plugins.legend.labels.boxWidth = 10;
    d.plugins.legend.labels.boxHeight = 10;
    d.plugins.tooltip.backgroundColor = t.surface;
    d.plugins.tooltip.titleColor = t.ink;
    d.plugins.tooltip.bodyColor = t.muted;
    d.plugins.tooltip.borderColor = t.grid;
    d.plugins.tooltip.borderWidth = 1;
    d.plugins.tooltip.cornerRadius = 2;
    d.plugins.tooltip.padding = 10;
    /* the retro-functional look: straight lines, square points, flat bars */
    d.elements.line.tension = 0;
    d.elements.line.borderWidth = 1.5;
    d.elements.point.pointStyle = "rect";
    d.elements.point.radius = 3;
    d.elements.point.hoverRadius = 5;
    d.elements.bar.borderWidth = 0;
    d.elements.arc.borderColor = t.bg;
    d.elements.arc.borderWidth = 2;
  }

  /* color any dataset the author left colorless; remember which ones we own
     so a theme flip recolors exactly those */
  function colorDatasets(type, datasets, t) {
    const pal = seriesPalette(t);
    (datasets || []).forEach(function (ds, i) {
      if (!ds._sentinelAuto && (ds.borderColor || ds.backgroundColor)) return;
      ds._sentinelAuto = true;
      const c = pal[i % pal.length];
      if (type === "doughnut" || type === "pie" || type === "polarArea") {
        ds.backgroundColor = ds.data.map(function (_, j) { return pal[j % pal.length]; });
        ds.borderColor = t.bg;
      } else if (type === "radar") {
        ds.borderColor = c;
        ds.backgroundColor = alpha(c, 0.15);
        ds.pointBackgroundColor = c;
      } else if (type === "line") {
        ds.borderColor = c;
        ds.backgroundColor = ds.fill ? alpha(c, 0.12) : c;
        ds.pointBackgroundColor = c;
      } else {
        ds.borderColor = c;
        ds.backgroundColor = c;
      }
    });
  }

  function chart(canvas, config) {
    const t = tokens();
    applyDefaults(t); /* pre-create so scales resolve current tokens */
    /* color BEFORE construction so no plugin beats us to it */
    colorDatasets(config.type, config.data && config.data.datasets, t);
    const instance = new Chart(canvas, config);
    charts.add(instance);
    const origDestroy = instance.destroy.bind(instance);
    instance.destroy = function () { charts.delete(instance); origDestroy(); };
    return instance;
  }

  function retheme() {
    const t = tokens();
    applyDefaults(t);
    charts.forEach(function (c) {
      colorDatasets(c.config.type, c.data.datasets, t);
      c.update("none");
    });
  }

  /* follow the theme toggle */
  new MutationObserver(retheme)
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  window.sentinelCharts = { chart: chart, retheme: retheme, tokens: tokens, palette: function () { return seriesPalette(tokens()); } };
  window.vertebraCharts = window.sentinelCharts; /* canonical name post-rename */
  window.sentinel = window.sentinel || {};
  window.sentinel.chart = chart;
  window.vertebra = window.sentinel; /* keep the aliases pointing at one object */
})();
