/* VERTEBRA (formerly Sentinel) — experimental visualizations. EXPERIMENTAL: API may change.
   Self-contained (no libraries). Canvas pieces resolve theme tokens at init
   and re-resolve when data-theme flips; all loops respect reduced motion
   (they render a single static frame instead).

   Auto-init markup:
     <canvas data-x-radar    width="360" height="240"></canvas>
     <canvas data-x-scope    width="360" height="160"></canvas>
     <canvas data-x-spectrum width="360" height="160"></canvas>
     <div data-x-log></div>
     <div data-x-market></div>   market tape (NEM-shaped demo data)
     <div data-x-atlas></div>    Australia plate + site list
     <div data-x-pyramid></div>  tiered pyramid: terrace / mirror / ziggurat
   Or call sentinelX.radar(canvas) etc. yourself. */
(function () {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- theme tokens (resolved to concrete colors) ---------- */
  function resolveColor(varName) {
    const probe = document.createElement("span");
    probe.style.color = "var(" + varName + ")";
    probe.style.display = "none";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }
  function readTokens() {
    return {
      ink: resolveColor("--ink"),
      muted: resolveColor("--ink-muted"),
      grid: resolveColor("--line-soft"),
      line: resolveColor("--line"),
      accent: resolveColor("--accent"),
      meter: resolveColor("--meter"),
      warn: resolveColor("--warn"),
      danger: resolveColor("--danger"),
      bg: resolveColor("--bg"),
      bgAlt: resolveColor("--bg-alt"),
      surface2: resolveColor("--surface-2"),
      accentSoft: resolveColor("--accent-soft"),
      u1: resolveColor("--u1"),
      u2: resolveColor("--u2"),
    };
  }
  let T = null;
  function tokens() { return T || (T = readTokens()); }
  /* static pieces (like the image filter) register here to re-render on
     theme or palette changes; animated pieces re-read tokens every frame */
  const liveRenders = new Set();
  new MutationObserver(() => {
    T = readTokens();
    liveRenders.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });

  function alpha(rgb, a) {
    const m = rgb.match(/\d+(\.\d+)?/g) || [0, 0, 0];
    return "rgba(" + m[0] + ", " + m[1] + ", " + m[2] + ", " + a + ")";
  }

  /* run a draw loop, or a single frame under reduced motion */
  function loop(draw) {
    if (reducedMotion.matches) { draw(0); return; }
    let t0 = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      draw((now - t0) / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- radar scope ---------- */
  function radar(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 8;
    /* fixed pseudo-random blips (angle rad, dist 0-1) */
    const blips = [[0.7, 0.55], [2.1, 0.8], [2.9, 0.35], [4.4, 0.65], [5.6, 0.85]];
    loop((t) => {
      const k = tokens();
      const sweep = (t * 1.1) % (Math.PI * 2);
      ctx.clearRect(0, 0, W, H);
      /* rings + crosshair */
      ctx.strokeStyle = k.grid;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
      ctx.stroke();
      /* sweep trail */
      for (let i = 0; i < 36; i++) {
        const a = sweep - i * 0.018;
        ctx.strokeStyle = alpha(k.accent, 0.5 * (1 - i / 36));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }
      /* blips light up as the sweep passes, then fade */
      blips.forEach(([a, d]) => {
        let behind = (sweep - a) % (Math.PI * 2);
        if (behind < 0) behind += Math.PI * 2;
        const glow = Math.max(0, 1 - behind / 2.4);
        if (glow <= 0.02) return;
        const x = cx + Math.cos(a) * R * d, y = cy + Math.sin(a) * R * d;
        ctx.fillStyle = alpha(k.accent, glow);
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        ctx.strokeStyle = alpha(k.accent, glow * 0.4);
        ctx.strokeRect(x - 5.5, y - 5.5, 11, 11);
      });
      /* bezel */
      ctx.strokeStyle = k.line;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    });
  }

  /* ---------- waveform scope ---------- */
  function scope(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height, mid = H / 2;
    loop((t) => {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = k.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += W / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
      ctx.strokeStyle = k.meter;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        const p = x / W;
        const y = mid
          + Math.sin(p * 14 + t * 3.1) * H * 0.18
          + Math.sin(p * 31 - t * 5.7) * H * 0.09
          + Math.sin(p * 5 + t * 1.3) * H * 0.12;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  /* ---------- spectrum bars ---------- */
  function spectrum(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const N = 28, gap = 3, bw = (W - gap * (N - 1)) / N;
    const level = new Array(N).fill(0.3);
    const target = level.slice();
    let nextShuffle = 0;
    loop((t) => {
      const k = tokens();
      if (t >= nextShuffle) {
        nextShuffle = t + 0.18;
        for (let i = 0; i < N; i++) {
          const shape = 0.35 + 0.5 * Math.exp(-Math.pow((i - N * 0.35) / (N * 0.3), 2));
          target[i] = Math.random() * shape + 0.06;
        }
      }
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        level[i] += (target[i] - level[i]) * (reducedMotion.matches ? 1 : 0.18);
        const h = Math.max(2, level[i] * (H - 14));
        const x = i * (bw + gap);
        ctx.fillStyle = level[i] > 0.75 ? k.warn : k.meter;
        ctx.fillRect(x, H - h, bw, h);
        ctx.fillStyle = alpha(k.muted, 0.65);           /* peak cap */
        ctx.fillRect(x, H - h - 4, bw, 2);
      }
    });
  }

  /* ---------- log stream ---------- */
  const LOG_LINES = [
    ["ok", "RELAY N HANDSHAKE OK"],
    ["ok", "SIGNAL LOCK 98.2%"],
    ["ok", "SECTOR SWEEP COMPLETE"],
    ["warn", "LATENCY SPIKE 214MS"],
    ["ok", "CHECKSUM VERIFIED"],
    ["err", "RELAY S TIMEOUT"],
    ["ok", "FAILOVER ARMED"],
    ["ok", "PACKET LOSS 0.4%"],
    ["warn", "BATTERY 34%"],
    ["ok", "UPLINK STABLE"],
  ];
  function logStream(el) {
    el.classList.add("x-log");
    let i = 0;
    let clock = 4 * 3600 + 12 * 60; /* fake mission clock, deterministic */
    function stamp() {
      clock += 7 + ((i * 13) % 23);
      const h = String(Math.floor(clock / 3600) % 24).padStart(2, "0");
      const m = String(Math.floor(clock / 60) % 60).padStart(2, "0");
      const s = String(clock % 60).padStart(2, "0");
      return h + ":" + m + ":" + s;
    }
    function add() {
      const entry = LOG_LINES[i % LOG_LINES.length];
      i++;
      const line = document.createElement("div");
      line.className = "x-log-line x-log-" + entry[0];
      const ts = document.createElement("span");
      ts.textContent = stamp();
      const txt = document.createElement("span");
      txt.textContent = entry[1];
      line.append(ts, txt);
      el.appendChild(line);
      while (el.children.length > 8) el.removeChild(el.firstChild);
    }
    if (reducedMotion.matches) {
      for (let n = 0; n < 8; n++) add();
      return;
    }
    for (let n = 0; n < 3; n++) add();
    setInterval(add, 1600);
  }

  /* ---------- image filter ----------
     Halftone-family filters over any local image: dots, linked dots (merged
     halftone), Bayer ordered dither, ASCII, pixel squares. Files are read
     with createObjectURL only — nothing ever leaves the machine.
     Markup: <div data-x-imagefilter></div> — controls are built here. */
  const XIF_MODES = [
    ["linked", "Linked dots"],
    ["halftone", "Halftone"],
    ["bayer", "Bayer dither"],
    ["ascii", "ASCII"],
    ["squares", "Squares"],
  ];
  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const ASCII_RAMP = "@%#*+=-:."; /* dark -> light; blanks drawn as nothing */

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function imageFilter(host) {
    if (host.dataset.xifInit) return;
    host.dataset.xifInit = "1";
    host.classList.add("xif");

    /* ---- controls (kit classes, no extra deps) ---- */
    const bar = el("div", "row xif-bar");
    const modeSel = el("select", "input");
    XIF_MODES.forEach(([v, label]) => {
      const o = el("option", null, label);
      o.value = v;
      modeSel.appendChild(o);
    });
    const sizeWrap = el("label", "row xif-size");
    sizeWrap.append(el("span", "label", "Dot pitch"));
    const size = el("input");
    size.type = "range"; size.min = "4"; size.max = "28"; size.value = "10";
    sizeWrap.appendChild(size);
    const invertWrap = el("label", "check");
    const invert = el("input"); invert.type = "checkbox";
    invertWrap.append(invert, document.createTextNode(" Invert"));
    const accentWrap = el("label", "check");
    const accent = el("input"); accent.type = "checkbox";
    accentWrap.append(accent, document.createTextNode(" Accent color"));
    const fxWrap = el("label", "check");
    const fx = el("input"); fx.type = "checkbox";
    fxWrap.append(fx, document.createTextNode(" Pointer FX"));
    fxWrap.title = "Halftone/Bayer dots react to the cursor";

    /* pointer FX tuning — visible only while the toggle is on */
    function fxSlider(label, min, max, step, val) {
      const wrap = el("label", "row xif-size");
      wrap.append(el("span", "label", label));
      const input = el("input");
      input.type = "range"; input.min = min; input.max = max; input.step = step; input.value = val;
      const out = el("span", "xif-val", String(val));
      wrap.append(input, out);
      input.addEventListener("input", () => { out.textContent = input.value; });
      return { wrap: wrap, input: input };
    }
    const fxSwell = fxSlider("Swell", 0, 3, 0.1, 1.1);
    const fxPush = fxSlider("Push", 0, 5, 0.1, 0.6);
    const fxRadius = fxSlider("Radius", 2, 32, 1, 7);
    /* per-frame smoothing factors: 1 = instant snap, low = slow drift */
    const fxPushSpd = fxSlider("Push speed", 0.02, 1, 0.02, 0.35);
    const fxRetSpd = fxSlider("Return speed", 0.02, 1, 0.02, 0.1);
    const fxBar = el("div", "row xif-fxbar");
    fxBar.append(fxSwell.wrap, fxPush.wrap, fxRadius.wrap, fxPushSpd.wrap, fxRetSpd.wrap);
    fxBar.hidden = true;
    const fileBtn = el("button", "btn btn-sm", "Load image…");
    fileBtn.type = "button";
    const fileIn = el("input");
    fileIn.type = "file"; fileIn.accept = "image/*"; fileIn.hidden = true;
    const dlBtn = el("button", "btn btn-sm btn-ghost", "Download PNG");
    dlBtn.type = "button";
    bar.append(modeSel, sizeWrap, invertWrap, accentWrap, fxWrap, fileBtn, fileIn, dlBtn);

    const canvas = el("canvas", "xif-canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Filtered image preview");
    const hint = el("p", "small muted xif-hint",
      "Drop any image on this panel (or Load image…) — processed locally in your browser, never uploaded.");
    host.append(bar, fxBar, canvas, hint);
    const ctx = canvas.getContext("2d");

    /* ---- source image (procedural sample until a file is dropped) ---- */
    let img = makeSample();
    let imgVersion = 0;
    /* pointer FX state — a per-cell influence field animated toward its
       target: dots chase the cursor at "push speed" and relax at "return
       speed". fxState holds current influence [0..1] per grid cell. */
    const pointer = { x: 0, y: 0, on: false };
    let fxState = null, fxDims = "", fxLoop = 0;

    function makeSample() {
      const c = document.createElement("canvas");
      c.width = 960; c.height = 600;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 960, 600);
      grad.addColorStop(0, "#f2f2f2");
      grad.addColorStop(1, "#5a5a5a");
      g.fillStyle = grad;
      g.fillRect(0, 0, 960, 600);
      const orb = g.createRadialGradient(660, 240, 30, 660, 240, 260);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.55, "#9a9a9a");
      orb.addColorStop(1, "rgba(20,20,20,0)");
      g.fillStyle = orb;
      g.fillRect(0, 0, 960, 600);
      g.fillStyle = "#1c1c1c";
      g.beginPath(); g.arc(250, 400, 150, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#111111";
      g.lineWidth = 22;
      g.beginPath(); g.arc(660, 240, 180, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#0d0d0d";
      g.font = "700 92px system-ui, sans-serif";
      g.fillText("SENTINEL", 80, 140);
      g.font = "500 40px monospace";
      g.fillText("// IMG-01", 84, 200);
      return c;
    }

    /* ---- render ---- */
    /* cached per (grid size, invert, image): pointer-move re-renders must not
       re-sample the image every frame */
    let lumCache = { key: "", lum: null };
    function luminanceGrid(cols, rows) {
      const key = cols + "x" + rows + ":" + invert.checked + ":" + imgVersion;
      if (lumCache.key === key) return lumCache.lum;
      const s = document.createElement("canvas");
      s.width = cols; s.height = rows;
      const sg = s.getContext("2d", { willReadFrequently: true });
      sg.drawImage(img, 0, 0, cols, rows);
      const data = sg.getImageData(0, 0, cols, rows).data;
      const lum = new Float32Array(cols * rows);
      for (let i = 0; i < lum.length; i++) {
        const o = i * 4;
        let l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
        /* fold alpha toward white so transparent PNGs read as paper */
        const a = data[o + 3] / 255;
        l = l * a + (1 - a);
        l = Math.min(1, Math.max(0, (l - 0.5) * 1.12 + 0.5)); /* gentle contrast */
        if (invert.checked) l = 1 - l;
        lum[i] = l;
      }
      lumCache = { key: key, lum: lum };
      return lum;
    }

    function render(advanceFx) {
      const k = tokens();
      const cell = Number(size.value);
      const iw = img.width || 960, ih = img.height || 600;
      const cols = Math.max(8, Math.min(300, Math.round(1120 / cell)));
      const rows = Math.max(8, Math.round(cols * (ih / iw)));
      canvas.width = cols * cell;
      canvas.height = rows * cell;
      const lum = luminanceGrid(cols, rows);
      const dotColor = accent.checked ? k.meter : k.ink;
      ctx.fillStyle = k.bgAlt;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = dotColor;
      ctx.strokeStyle = dotColor;
      const mode = modeSel.value;
      const r_ = (l, max) => max * Math.pow(1 - l, 1.15);
      /* pointer FX: dots near the cursor swell and shy away, gaussian falloff */
      const useFx = fx.checked && !reducedMotion.matches &&
        (mode === "halftone" || mode === "bayer");
      const swellK = Number(fxSwell.input.value);
      const pushK = Number(fxPush.input.value);
      const fxR2 = Math.pow(cell * Number(fxRadius.input.value), 2) * 0.45;
      let fxActive = false;
      if (useFx) {
        const dims = cols + "x" + rows;
        if (fxDims !== dims) { fxState = new Float32Array(cols * rows); fxDims = dims; }
        if (advanceFx) {
          const up = Number(fxPushSpd.input.value);
          const down = Number(fxRetSpd.input.value);
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const i = y * cols + x;
              let target = 0;
              if (pointer.on) {
                const dx = x * cell + cell / 2 - pointer.x;
                const dy = y * cell + cell / 2 - pointer.y;
                target = Math.exp(-(dx * dx + dy * dy) / fxR2);
                if (target < 0.004) target = 0;
              }
              const s = fxState[i];
              const next = s + (target - s) * (target > s ? up : down);
              fxState[i] = next;
              if (Math.abs(target - next) > 0.002 || (!pointer.on && next > 0.004)) fxActive = true;
            }
          }
        }
      }

      if (mode === "ascii") {
        const mono = getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace";
        ctx.font = Math.round(cell * 1.15) + "px " + mono;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const l = lum[y * cols + x];
          const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
          if (mode === "halftone" || mode === "linked") {
            const max = mode === "halftone" ? cell * 0.62 : cell * 0.52;
            let r = r_(l, max), ox = 0, oy = 0;
            if (useFx && fxState && r >= 0.4) {
              const inf = fxState[y * cols + x];
              if (inf > 0.01) {
                r *= 1 + swellK * inf;
                const dx = cx - pointer.x, dy = cy - pointer.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                ox = (dx / d) * inf * cell * pushK;
                oy = (dy / d) * inf * cell * pushK;
              }
            }
            if (r < 0.4) continue;
            ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2); ctx.fill();
          } else if (mode === "bayer") {
            const t = (BAYER4[y % 4][x % 4] + 0.5) / 16;
            if (l < t) {
              let r = cell * 0.42, ox = 0, oy = 0;
              if (useFx && fxState) {
                const inf = fxState[y * cols + x];
                if (inf > 0.01) {
                  r *= 1 + swellK * inf;
                  const dx = cx - pointer.x, dy = cy - pointer.y;
                  const d = Math.sqrt(dx * dx + dy * dy) || 1;
                  ox = (dx / d) * inf * cell * pushK;
                  oy = (dy / d) * inf * cell * pushK;
                }
              }
              ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2); ctx.fill();
            }
          } else if (mode === "ascii") {
            const idx = Math.floor(l * ASCII_RAMP.length);
            if (idx < ASCII_RAMP.length) ctx.fillText(ASCII_RAMP[idx], cx, cy);
          } else if (mode === "squares") {
            const s = (1 - l) * cell;
            if (s < 0.6) continue;
            ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
          }
        }
      }

      /* linked dots: bridge neighbors so blobs merge like dot-matrix print */
      if (mode === "linked") {
        const max = cell * 0.52, minR = cell * 0.2;
        ctx.lineCap = "round";
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const r1 = r_(lum[y * cols + x], max);
            if (r1 < minR) continue;
            const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
            if (x + 1 < cols) {
              const r2 = r_(lum[y * cols + x + 1], max);
              if (r2 >= minR) {
                ctx.lineWidth = 1.7 * Math.min(r1, r2);
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cell, cy); ctx.stroke();
              }
            }
            if (y + 1 < rows) {
              const r2 = r_(lum[(y + 1) * cols + x], max);
              if (r2 >= minR) {
                ctx.lineWidth = 1.7 * Math.min(r1, r2);
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cell); ctx.stroke();
              }
            }
          }
        }
      }
      return fxActive;
    }

    /* ---- wiring ---- */
    /* animation loop: runs while any cell is still chasing its target,
       stops itself when the field settles (and restarts on pointer events) */
    function animate() {
      fxLoop = 0;
      if (render(true)) fxLoop = requestAnimationFrame(animate);
    }
    function kick() {
      if (!fxLoop) fxLoop = requestAnimationFrame(animate);
    }
    const refresh = () => { render(false); kick(); };
    modeSel.addEventListener("change", refresh);
    size.addEventListener("input", refresh);
    invert.addEventListener("change", refresh);
    accent.addEventListener("change", refresh);
    fileBtn.addEventListener("click", () => fileIn.click());
    fileIn.addEventListener("change", () => loadFile(fileIn.files && fileIn.files[0]));
    host.addEventListener("dragover", (e) => { e.preventDefault(); host.classList.add("xif-drop"); });
    host.addEventListener("dragleave", () => host.classList.remove("xif-drop"));
    host.addEventListener("drop", (e) => {
      e.preventDefault();
      host.classList.remove("xif-drop");
      loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!fx.checked || reducedMotion.matches) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      pointer.y = (e.clientY - rect.top) * (canvas.height / rect.height);
      pointer.on = true;
      kick();
    });
    canvas.addEventListener("pointerleave", () => {
      if (!pointer.on) return;
      pointer.on = false;
      kick(); /* field decays at return speed, loop stops when settled */
    });
    fx.addEventListener("change", () => {
      fxBar.hidden = !fx.checked;
      pointer.on = false;
      if (fxState) fxState.fill(0);
      render(false);
    });
    [fxSwell.input, fxPush.input, fxRadius.input, fxPushSpd.input, fxRetSpd.input]
      .forEach((s) => s.addEventListener("input", () => { render(false); kick(); }));
    dlBtn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.download = "sentinel-" + modeSel.value + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    });

    function loadFile(file) {
      if (!file || !/^image\//.test(file.type)) return;
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { img = im; imgVersion++; URL.revokeObjectURL(url); render(); };
      im.src = url;
    }

    liveRenders.add(render); /* follow theme/palette flips */
    render();
  }

  /* ---------- pipeline / funnel ----------
     Stage funnel drawn as a particle stream: a dotted band tapers through
     stage columns; at each boundary the dropped fraction detaches and falls
     away. Big % per stage, counts + drop rate along the bottom.
     Markup: <canvas data-x-pipeline width="1120" height="380"></canvas>
     Custom stages: data-x-pipeline='[{"label":"IN","value":1000}, …]'
     Under reduced motion the simulation is warmed up and drawn once. */
  const PIPELINE_DEFAULT = [
    { label: "DETECTED", value: 12400 },
    { label: "RELEVANT", value: 3900 },
    { label: "CONFIRMED", value: 730 },
    { label: "RESOLVED", value: 640 },
  ];

  function pipeline(canvas) {
    let stages = null;
    try { stages = JSON.parse(canvas.getAttribute("data-x-pipeline") || "null"); }
    catch (e) { stages = null; }
    if (!Array.isArray(stages) || stages.length < 2 ||
        stages.some((s) => !s || typeof s.value !== "number" || s.value < 0)) {
      stages = PIPELINE_DEFAULT;
    }
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const n = stages.length;
    const colW = W / n;
    const bandTop = H * 0.2, bandBot = H * 0.78;
    const midY = (bandTop + bandBot) / 2, maxHalf = (bandBot - bandTop) / 2;
    const frac = stages.map((s) => s.value / (stages[0].value || 1));
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");

    /* band half-height at x: smoothstep between column centers */
    function halfH(x) {
      const c = x / colW - 0.5;
      if (c <= 0) return Math.max(2, frac[0] * maxHalf);
      const i = Math.min(n - 2, Math.floor(c));
      const u = Math.min(1, Math.max(0, c - i));
      const s = u * u * (3 - 2 * u);
      return Math.max(2, (frac[i] + (frac[i + 1] - frac[i]) * s) * maxHalf);
    }

    /* particles: lane in (-1..1); rr decides the boundary where it drops */
    const COUNT = 240;
    const parts = [];
    function spawn(p, randomX) {
      if (randomX) {
        /* initial fill: rejection-sample x by stage survival so the field
           starts at steady-state density instead of uniform */
        let guard = 0;
        do {
          p.x = Math.random() * W;
        } while (Math.random() > frac[Math.min(n - 1, Math.floor(p.x / colW + 0.5))] && guard++ < 60);
      } else {
        p.x = -Math.random() * 40;
      }
      p.lane = (Math.random() * 2 - 1) * 0.92;
      p.v = 1 + Math.random() * 0.9;
      p.rr = Math.random();
      p.fall = 0;
      /* if spawned mid-canvas, must be a survivor of every stage before it */
      const stage = Math.min(n - 1, Math.floor(p.x / colW + 0.5));
      let guard2 = 0;
      while (p.rr > frac[Math.max(0, stage)] && guard2++ < 40) p.rr = Math.random();
      return p;
    }
    for (let i = 0; i < COUNT; i++) parts.push(spawn({}, true));

    function step() {
      for (const p of parts) {
        if (p.fall) {
          p.x += p.v * 0.4;
          p.fall += 2.2;
          if (midY + p.fall > H + 10) spawn(p, false);
          continue;
        }
        p.x += p.v;
        if (p.x > W + 10) { spawn(p, false); continue; }
        /* crossing into a stage it doesn't survive -> detach */
        const stage = Math.min(n - 1, Math.floor(p.x / colW + 0.5));
        if (stage > 0 && p.rr > frac[stage]) p.fall = 1;
      }
    }

    function draw() {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      ctx.font = "500 11px " + mono();
      ctx.textAlign = "center";
      /* column dividers + labels */
      for (let i = 0; i < n; i++) {
        const cx = i * colW + colW / 2;
        if (i) {
          ctx.strokeStyle = k.grid;
          ctx.beginPath(); ctx.moveTo(i * colW, 8); ctx.lineTo(i * colW, H - 8); ctx.stroke();
        }
        ctx.fillStyle = k.muted;
        ctx.fillText(stages[i].label, cx, 20);
        const pct = (frac[i] * 100);
        const pctText = (pct >= 10 || pct === Math.round(pct) ? Math.round(pct) : pct.toFixed(1)) + "%";
        ctx.font = "700 " + Math.min(26, colW * 0.18) + "px " + mono();
        ctx.fillStyle = k.ink;
        ctx.fillText(pctText, cx, midY + 8);
        ctx.font = "500 11px " + mono();
        ctx.fillStyle = k.muted;
        ctx.fillText(stages[i].value.toLocaleString("en-US"), cx - (i ? 18 : 0), H - 12);
        if (i) {
          const drop = Math.round((1 - stages[i].value / (stages[i - 1].value || 1)) * 100);
          ctx.fillStyle = k.danger;
          const w = ctx.measureText(stages[i].value.toLocaleString("en-US")).width;
          ctx.textAlign = "left";
          ctx.fillText("-" + drop + "%", cx - 18 + w / 2 + 8, H - 12);
          ctx.textAlign = "center";
        }
      }
      /* band envelope: faint fill + hairline edges */
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, midY - halfH(x));
      for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, midY + halfH(x));
      ctx.closePath();
      ctx.fillStyle = alpha(k.meter, 0.07);
      ctx.fill();
      ctx.strokeStyle = alpha(k.meter, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      /* particles: survivors in meter color, dropped in danger, falling */
      for (const p of parts) {
        if (p.x < -4 || p.x > W + 4) continue;
        if (p.fall) {
          const fade = Math.max(0, 1 - p.fall / 130);
          if (fade <= 0) continue;
          ctx.fillStyle = alpha(k.danger, fade * 0.8);
          ctx.fillRect(p.x - 1.4, midY + p.lane * 6 + p.fall, 2.8, 2.8);
        } else {
          const y = midY + p.lane * (halfH(p.x) - 2);
          ctx.fillStyle = alpha(k.meter, 0.9);
          ctx.fillRect(p.x - 1.4, y - 1.4, 2.8, 2.8);
        }
      }
    }

    if (reducedMotion.matches) {
      for (let i = 0; i < 900; i++) step();
      draw();
      liveRenders.add(draw); /* still re-theme on palette/theme flips */
      return;
    }
    loop(() => { step(); draw(); });
  }

  /* ---------- dispersion strip ----------
     Ordered dot lattice decaying into scatter along the x axis — tick rail
     with dashed guides, ring annotation over the breakdown zone, hairline
     constellation links between far-zone dots. Pure ambient piece.
     Markup: <canvas data-x-dispersion width="1120" height="300"></canvas> */
  function dispersion(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const x0 = 40, x1 = W - 40, y0 = H * 0.3, y1 = H * 0.7;
    const pitch = 10;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");
    const TICKS = ["+2", "0", "-1", "-3", "-6"];
    const tickX = [0.06, 0.25, 0.45, 0.68, 0.88].map((f) => x0 + (x1 - x0) * f);

    /* disorder 0..1 along the strip, quadratic so the left stays crisp */
    const disorder = (x) => {
      const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0) - 0.18) / 0.82);
      return u * u;
    };
    const dots = [];
    for (let y = y0; y <= y1; y += pitch) {
      for (let x = x0; x <= x1; x += pitch) {
        const d = disorder(x);
        if (Math.random() < d * 0.72) continue; /* dropout grows with disorder */
        dots.push({
          hx: x, hy: y, d: d,
          r: 3.2 - d * 1.1 + Math.random() * 0.5,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          f: 0.35 + Math.random() * 0.5,
        });
      }
    }
    const far = dots.filter((p) => p.d > 0.72);

    function draw(t) {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      /* header + captions */
      ctx.font = "500 11px " + mono();
      ctx.textAlign = "left";
      ctx.fillStyle = k.ink;
      ctx.fillText("DRIFT:  RANGE", x0, 26);
      ctx.fillStyle = k.muted;
      ctx.fillText("Signal coherence ratio", x0, 42);
      ctx.fillText("ORDERED", x0, H - 14);
      ctx.textAlign = "right";
      ctx.fillText("( DISPERSED )", x1, H - 14);
      /* tick rail + dashed guides */
      ctx.textAlign = "center";
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = k.grid;
      TICKS.forEach((lbl, i) => {
        ctx.fillStyle = k.muted;
        ctx.fillText(lbl, tickX[i], y0 - 26);
        ctx.beginPath();
        ctx.moveTo(tickX[i], y0 - 18);
        ctx.lineTo(tickX[i], y1 + 22);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      /* dots with growing jitter */
      const pos = [];
      for (const p of dots) {
        const amp = p.d * p.d * 15;
        const x = p.hx + Math.sin(t * p.f * 2 + p.px) * amp;
        const y = p.hy + Math.sin(t * p.f * 1.6 + p.py) * amp;
        if (p.d > 0.72) pos.push([x, y]);
        ctx.fillStyle = alpha(k.ink, 0.92 - p.d * 0.25);
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      /* constellation hairlines in the far zone */
      ctx.strokeStyle = alpha(k.line, 0.4);
      ctx.lineWidth = 1;
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
          if (dx * dx + dy * dy < 24 * 24) {
            ctx.beginPath(); ctx.moveTo(pos[i][0], pos[i][1]); ctx.lineTo(pos[j][0], pos[j][1]); ctx.stroke();
          }
        }
      }
      /* ring annotation over the breakdown zone */
      const rcx = x0 + (x1 - x0) * 0.76, rcy = (y0 + y1) / 2, rr = (y1 - y0) * 0.62;
      ctx.strokeStyle = alpha(k.ink, 0.7);
      ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "500 10px " + mono();
      ctx.fillStyle = k.muted;
      ctx.textAlign = "left";
      ctx.fillText("x", rcx + rr + 8, rcy + rr);
      /* sub-range arrow under the strip */
      const ay = y1 + 40;
      ctx.strokeStyle = k.line;
      ctx.beginPath();
      ctx.moveTo(tickX[2], ay); ctx.lineTo(x1, ay);
      ctx.moveTo(tickX[2], ay - 4); ctx.lineTo(tickX[2], ay + 4);
      ctx.moveTo(x1, ay - 4); ctx.lineTo(x1, ay + 4);
      ctx.stroke();
    }

    if (reducedMotion.matches) {
      draw(0);
      liveRenders.add(() => draw(0));
      return;
    }
    loop(draw);
  }

  /* ---------- ribbon funnel ----------
     The solid-band treatment of the pipeline: layered translucent ribbons
     taper through the stages, big % per stage (paper-colored on the band),
     reveal animation + slow traveling sheen. Same JSON contract as
     data-x-pipeline. Markup: <canvas data-x-funnel width="1120" height="380"> */
  function funnel(canvas) {
    let stages = null;
    try { stages = JSON.parse(canvas.getAttribute("data-x-funnel") || "null"); }
    catch (e) { stages = null; }
    if (!Array.isArray(stages) || stages.length < 2 ||
        stages.some((s) => !s || typeof s.value !== "number" || s.value < 0)) {
      stages = PIPELINE_DEFAULT;
    }
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const n = stages.length;
    const colW = W / n;
    const bandTop = H * 0.2, bandBot = H * 0.78;
    const midY = (bandTop + bandBot) / 2, maxHalf = (bandBot - bandTop) / 2;
    const frac = stages.map((s) => s.value / (stages[0].value || 1));
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");

    function halfH(x) {
      const c = x / colW - 0.5;
      if (c <= 0) return Math.max(1.5, frac[0] * maxHalf);
      const i = Math.min(n - 2, Math.floor(c));
      const u = Math.min(1, Math.max(0, c - i));
      const s = u * u * (3 - 2 * u);
      return Math.max(1.5, (frac[i] + (frac[i + 1] - frac[i]) * s) * maxHalf);
    }

    function bandPath(scale, upTo) {
      ctx.beginPath();
      for (let x = 0; x <= upTo; x += 8) ctx.lineTo(x, midY - halfH(x) * scale);
      for (let x = upTo; x >= 0; x -= 8) ctx.lineTo(x, midY + halfH(x) * scale);
      ctx.closePath();
    }

    function draw(t) {
      const k = tokens();
      const reveal = reducedMotion.matches ? 1 : Math.min(1, t / 1.2);
      const upTo = W * (1 - Math.pow(1 - reveal, 3));
      ctx.clearRect(0, 0, W, H);
      ctx.font = "500 11px " + mono();
      ctx.textAlign = "center";
      /* dividers + top labels */
      for (let i = 0; i < n; i++) {
        const cx = i * colW + colW / 2;
        if (i) {
          ctx.strokeStyle = k.grid;
          ctx.beginPath(); ctx.moveTo(i * colW, 8); ctx.lineTo(i * colW, H - 8); ctx.stroke();
        }
        ctx.fillStyle = k.muted;
        ctx.fillText(stages[i].label, cx, 20);
      }
      /* layered ribbons: echoes behind, solid main on top */
      bandPath(1.85, upTo); ctx.fillStyle = alpha(k.meter, 0.10); ctx.fill();
      bandPath(1.38, upTo); ctx.fillStyle = alpha(k.meter, 0.22); ctx.fill();
      bandPath(1, upTo); ctx.fillStyle = alpha(k.meter, 0.95); ctx.fill();
      /* traveling sheen, clipped to the main band */
      if (!reducedMotion.matches && reveal >= 1) {
        ctx.save();
        bandPath(1, W); ctx.clip();
        const sx = ((t * 90) % (W + 300)) - 150;
        const g = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
        g.addColorStop(0, alpha(k.bg, 0));
        g.addColorStop(0.5, alpha(k.bg, 0.22));
        g.addColorStop(1, alpha(k.bg, 0));
        ctx.fillStyle = g;
        ctx.fillRect(sx - 80, bandTop, 160, bandBot - bandTop);
        ctx.restore();
      }
      /* per-stage % + bottom counts */
      for (let i = 0; i < n; i++) {
        const cx = i * colW + colW / 2;
        const onBand = frac[i] * maxHalf > 18;
        const pct = frac[i] * 100;
        const pctText = (pct >= 10 || pct === Math.round(pct) ? Math.round(pct) : pct.toFixed(1)) + "%";
        ctx.font = "700 " + Math.min(26, colW * 0.18) + "px " + mono();
        ctx.fillStyle = onBand ? k.bg : k.ink;
        ctx.fillText(pctText, cx, midY + 8);
        ctx.font = "500 11px " + mono();
        ctx.fillStyle = k.muted;
        ctx.fillText(stages[i].value.toLocaleString("en-US"), cx - (i ? 18 : 0), H - 12);
        if (i) {
          const drop = Math.round((1 - stages[i].value / (stages[i - 1].value || 1)) * 100);
          const w = ctx.measureText(stages[i].value.toLocaleString("en-US")).width;
          ctx.fillStyle = k.danger;
          ctx.textAlign = "left";
          ctx.fillText("-" + drop + "%", cx - 18 + w / 2 + 8, H - 12);
          ctx.textAlign = "center";
        }
      }
    }

    if (reducedMotion.matches) {
      draw(0);
      liveRenders.add(() => draw(0));
      return;
    }
    loop(draw);
  }

  /* ---------- world map / globe ----------
     Geographic points on a dot-matrix globe (orthographic, auto-rotating,
     drag to spin) or a 2D outline map (equirectangular). Hovering a marker
     shows a kit-styled tooltip. Continents are simplified embedded polygons
     — no network, no dependencies. Data contract:
       <div data-x-worldmap='[{"lat":-27.5,"lon":153,"label":"BNE RELAY",
         "info":"ONLINE","status":"ok|warn|err"}, …]'></div>
     Empty attribute -> demo relay network. */
  const WORLD_POLYS = [
    /* north america */
    [[-168,65],[-166,60],[-158,58],[-153,57],[-145,60],[-131,55],[-125,49],[-124,40],[-117,33],[-105,20],[-97,16],[-94,18],[-90,21],[-87,16],[-83,9],[-77,8],[-81,25],[-76,35],[-70,42],[-60,46],[-52,47],[-55,52],[-60,55],[-64,60],[-78,62],[-93,64],[-110,68],[-128,70],[-156,71]],
    /* south america */
    [[-77,8],[-72,12],[-60,9],[-52,5],[-44,-3],[-35,-8],[-39,-15],[-48,-26],[-53,-34],[-58,-39],[-65,-41],[-71,-46],[-69,-52],[-75,-50],[-73,-40],[-70,-18],[-77,-12],[-81,-5],[-79,2]],
    /* greenland */
    [[-45,60],[-53,66],[-55,71],[-46,82],[-25,83],[-20,76],[-22,70],[-32,65]],
    /* africa */
    [[-6,35],[-17,21],[-17,15],[-8,5],[6,4],[9,-1],[14,-8],[12,-18],[15,-28],[19,-35],[27,-33],[33,-26],[36,-19],[40,-11],[43,-1],[51,10],[43,12],[38,18],[33,28],[30,31],[19,31],[10,34]],
    /* eurasia + arabia */
    [[-9,37],[-9,43],[-2,44],[-5,48],[1,50],[8,54],[12,56],[18,55],[22,59],[28,60],[24,65],[26,71],[40,68],[50,69],[68,69],[75,72],[95,76],[110,77],[130,72],[142,72],[160,70],[170,66],[178,65],[170,60],[162,58],[158,52],[141,53],[135,44],[129,40],[126,34],[121,31],[122,25],[110,20],[108,12],[105,9],[100,7],[98,12],[95,16],[91,22],[88,21],[80,15],[77,8],[73,16],[68,23],[66,25],[57,25],[56,25],[59,22],[53,17],[45,13],[43,12],[35,28],[32,31],[36,36],[27,37],[26,40],[22,37],[19,42],[18,40],[16,38],[9,44],[3,43],[-1,37],[-5,36]],
    /* australia */
    [[114,-22],[113,-25],[115,-34],[119,-34],[124,-33],[130,-32],[134,-35],[138,-35],[141,-38],[146,-39],[150,-37],[153,-30],[153,-25],[146,-19],[142,-11],[136,-12],[132,-11],[126,-14],[122,-17]],
    /* islands: sumatra/java, borneo, new guinea, japan, uk, madagascar, nz */
    [[95,5],[102,-1],[106,-7],[114,-8],[108,-7],[104,-3],[97,3]],
    [[109,1],[113,4],[117,7],[119,1],[116,-4],[110,-2]],
    [[131,-1],[138,-2],[146,-6],[150,-10],[143,-9],[135,-4]],
    [[130,31],[133,34],[137,35],[141,39],[142,45],[144,44],[141,41],[140,35],[135,33],[131,30]],
    [[-5,50],[-3,53],[-2,56],[-4,58],[-6,55]],
    [[44,-25],[47,-15],[50,-12],[49,-19],[47,-25]],
    [[173,-35],[175,-37],[178,-38],[174,-41],[170,-44],[167,-46],[171,-42]],
    /* antarctica band */
    [[-180,-70],[-60,-72],[0,-69],[60,-67],[120,-66],[180,-70],[180,-90],[-180,-90]],
  ];

  function pointInPolys(lon, lat) {
    for (const poly of WORLD_POLYS) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > lat) !== (yj > lat) &&
            lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  let WORLD_DOTS = null; /* [{lon, lat, cosLat, sinLat}] — computed once */
  function worldDots() {
    if (WORLD_DOTS) return WORLD_DOTS;
    WORLD_DOTS = [];
    for (let lat = -84; lat <= 84; lat += 3) {
      for (let lon = -180; lon < 180; lon += 3) {
        if (!pointInPolys(lon + 1.5, lat)) continue;
        const phi = (lat * Math.PI) / 180;
        WORLD_DOTS.push({ lon: lon + 1.5, lat: lat, cosLat: Math.cos(phi), sinLat: Math.sin(phi) });
      }
    }
    return WORLD_DOTS;
  }

  const WORLDMAP_DEMO = [
    { lat: -27.47, lon: 153.03, label: "BNE RELAY", info: "ONLINE · LOAD 63%", status: "ok" },
    { lat: 35.68, lon: 139.69, label: "TYO NODE", info: "ONLINE · 12MS", status: "ok" },
    { lat: 34.05, lon: -118.24, label: "LAX NODE", info: "DEGRADED · 214MS", status: "warn" },
    { lat: 51.51, lon: -0.13, label: "LON HUB", info: "ONLINE · 9MS", status: "ok" },
    { lat: 64.13, lon: -21.9, label: "RKV COLD STORE", info: "STANDBY", status: "" },
    { lat: 6.52, lon: 3.38, label: "LOS RELAY", info: "OFFLINE · NO RESPONSE", status: "err" },
    { lat: -23.55, lon: -46.63, label: "SAO NODE", info: "ONLINE · 82MS", status: "ok" },
    { lat: 19.08, lon: 72.88, label: "BOM NODE", info: "ONLINE · 45MS", status: "ok" },
    { lat: -77.85, lon: 166.67, label: "MCM OUTPOST", info: "SEASONAL LINK", status: "warn" },
    /* explicit stack: one CDN edge fronting many hosts — fans out on hover */
    { lat: 37.77, lon: -122.42, label: "SFO EDGE · CDN", info: "EDGE ENDPOINT · 7 HOSTS BEHIND", status: "warn",
      items: [
        { label: "TUBE-ALPHA.EX", info: "OFFLINE · NOTICE SENT", status: "err" },
        { label: "MIRROR-BETA.EX", info: "DEGRADED", status: "warn" },
        { label: "BOARD-GAMMA.EX", info: "ONLINE", status: "ok" },
        { label: "CACHE-DELTA.EX", info: "ONLINE", status: "ok" },
        { label: "DUMP-EPSILON.EX", info: "OFFLINE · REFUSED", status: "err" },
        { label: "FORUM-ZETA.EX", info: "ONLINE", status: "ok" },
        { label: "CDN-ETA.EX", info: "STANDBY", status: "" },
      ] },
    /* close to TYO NODE — auto-clusters into one stacked pin */
    { lat: 35.44, lon: 139.64, label: "YOK NODE", info: "ONLINE · 18MS", status: "ok" },
  ];

  function worldmap(host) {
    if (host.dataset.xmapInit) return;
    host.dataset.xmapInit = "1";
    host.classList.add("xmap");
    let points = null;
    try { points = JSON.parse(host.getAttribute("data-x-worldmap") || "null"); }
    catch (e) { points = null; }
    if (!Array.isArray(points) || !points.length ||
        points.some((p) => !p || typeof p.lat !== "number" || typeof p.lon !== "number")) {
      points = WORLDMAP_DEMO;
    }

    /* stacked pins: a point may carry items:[{label,info,status}] (hosts
       behind a CDN endpoint), and points within ~2.2 degrees auto-cluster.
       Either way one pin holds many entries, fanned out on hover. */
    const STATUS_RANK = { err: 3, warn: 2, ok: 1 };
    const normItem = (p) => ({ label: p.label || "ITEM", info: p.info || "", status: p.status || "" });
    (function stackPins() {
      const clusters = [];
      for (const p of points) {
        let home = null;
        for (const cl of clusters) {
          const dLat = cl.lat - p.lat;
          const dLon = (cl.lon - p.lon) * Math.cos((p.lat * Math.PI) / 180);
          if (dLat * dLat + dLon * dLon < 2.2 * 2.2) { home = cl; break; }
        }
        if (home) home.pts.push(p); else clusters.push({ lat: p.lat, lon: p.lon, pts: [p] });
      }
      points = clusters.map((cl) => {
        if (cl.pts.length === 1) {
          const p = cl.pts[0];
          if (Array.isArray(p.items) && p.items.length) {
            return { lat: p.lat, lon: p.lon, label: p.label, info: p.info,
              status: p.status || "", items: p.items.map(normItem) };
          }
          return p;
        }
        const lat = cl.pts.reduce((s, p) => s + p.lat, 0) / cl.pts.length;
        const lon = cl.pts.reduce((s, p) => s + p.lon, 0) / cl.pts.length;
        const worst = cl.pts.reduce((w, p) =>
          (STATUS_RANK[p.status] || 0) > (STATUS_RANK[w] || 0) ? p.status : w, "");
        return { lat: lat, lon: lon, label: cl.pts.length + " SITES",
          info: "stacked location · hover to fan out", status: worst, items: cl.pts.map(normItem) };
      });
    })();

    /* in-frame view toggle: icon buttons with kit tooltips, sliding thumb */
    const view = el("div", "xmap-view");
    view.setAttribute("role", "group");
    view.setAttribute("aria-label", "View mode");
    const globeBtn = el("button", "xmap-viewbtn");
    globeBtn.type = "button";
    globeBtn.setAttribute("aria-label", "Globe view");
    globeBtn.setAttribute("data-tip", "Globe view");
    globeBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
      '<circle cx="8" cy="8" r="6.2"/><ellipse cx="8" cy="8" rx="2.9" ry="6.2"/><path d="M1.8 8h12.4"/></svg>';
    const mapBtn = el("button", "xmap-viewbtn");
    mapBtn.type = "button";
    mapBtn.setAttribute("aria-label", "Flat map view");
    mapBtn.setAttribute("data-tip", "Flat map view");
    mapBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
      '<path d="M1.8 3.6l4.1-1.6 4.2 1.6 4.1-1.6v10.4l-4.1 1.6-4.2-1.6-4.1 1.6z"/><path d="M5.9 2v10.4M10.1 3.6V14"/></svg>';
    view.append(globeBtn, mapBtn);
    const canvas = el("canvas", "x-canvas xmap-canvas");
    canvas.width = 1120; canvas.height = 560;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "World map with " + points.length + " marked locations");
    const hint = el("p", "small muted xmap-hint",
      "hover a marker — stacked pins fan out · drag the globe to spin");
    const tip = el("div", "xmap-tip");
    host.append(view, canvas, hint, tip);
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");

    let mode = "globe";
    let rot = 1.4;          /* radians; central meridian ~80W at load — the americas */
    const TILT = -0.32;
    let hovering = false, dragging = false, dragX = 0, hoverIdx = -1, hoverKey = "";
    const R = 232, cx = W / 2, cy = H / 2 + 6;
    let screenPts = [], satPts = [];
    const fan = { idx: -1, prog: 0 }; /* open stacked pin + fan-out ease */
    /* stub rays on stacked pins: always-visible dotted hints at 30% of the
       fan length (disable with data-stubs="off" on the host) */
    const stubs = host.getAttribute("data-stubs") !== "off";

    /* shared fan geometry: base direction away from the globe centre (globe)
       or toward open space (map), entries spread around it */
    function fanGeom(anchor, n) {
      let baseA;
      if (mode === "globe") {
        baseA = Math.atan2(anchor.y - cy, anchor.x - cx);
        if (!isFinite(baseA)) baseA = -Math.PI / 4;
      } else {
        baseA = anchor.x < W / 2 ? -Math.PI / 5 : Math.PI + Math.PI / 5;
      }
      const spread = Math.min(Math.PI * 1.1, 0.42 * Math.max(1, n - 1));
      const out = [];
      for (let s = 0; s < n; s++) {
        out.push({
          a: baseA + (n === 1 ? 0 : (s / (n - 1) - 0.5) * spread),
          rr: 54 + (s % 2) * 18 + (mode === "globe" ? 12 : 0),
        });
      }
      return out;
    }

    function syncBtns() {
      view.dataset.mode = mode;
      globeBtn.setAttribute("aria-pressed", String(mode === "globe"));
      mapBtn.setAttribute("aria-pressed", String(mode === "map"));
    }
    syncBtns();

    function statusColor(k, s) {
      return s === "warn" ? k.warn : s === "err" ? k.danger : s === "ok" ? k.meter : k.accent;
    }

    /* orthographic projection with tilt; returns null when on the far side */
    function projGlobe(lonDeg, cosLat, sinLat) {
      const lam = (lonDeg * Math.PI) / 180 + rot;
      const x3 = cosLat * Math.sin(lam);
      const z3 = cosLat * Math.cos(lam);
      const y3 = sinLat;
      const y2 = y3 * Math.cos(TILT) - z3 * Math.sin(TILT);
      const z2 = y3 * Math.sin(TILT) + z3 * Math.cos(TILT);
      if (z2 < 0.02) return null;
      return { x: cx + x3 * R, y: cy - y2 * R, z: z2 };
    }
    const projMap = (lon, lat) => ({ x: ((lon + 180) / 360) * W, y: ((90 - lat) / 180) * H });

    function draw(t) {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      screenPts = [];
      ctx.font = "500 9px " + mono();
      if (mode === "globe") {
        /* rim + dots */
        ctx.strokeStyle = alpha(k.line, 0.5);
        ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.stroke();
        for (const d of worldDots()) {
          const p = projGlobe(d.lon, d.cosLat, d.sinLat);
          if (!p) continue;
          const s = 0.5 + p.z * 0.85;
          ctx.fillStyle = alpha(k.ink, 0.15 + p.z * 0.75);
          ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
        }
      } else {
        /* outline map + margin figures */
        ctx.strokeStyle = alpha(k.ink, 0.75);
        ctx.lineWidth = 1;
        for (const poly of WORLD_POLYS) {
          ctx.beginPath();
          for (let i = 0; i < poly.length; i++) {
            const p = projMap(poly[i][0], poly[i][1]);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath(); ctx.stroke();
        }
        ctx.fillStyle = alpha(k.muted, 0.7);
        ctx.textAlign = "center";
        for (let lon = -150; lon <= 150; lon += 60) {
          const p = projMap(lon, 0);
          ctx.fillText(String(lon), p.x, 14);
          ctx.fillText(String(lon), p.x, H - 8);
        }
        ctx.textAlign = "left";
        for (let lat = -60; lat <= 60; lat += 30) {
          const p = projMap(0, lat);
          ctx.fillText(String(lat), 8, p.y + 3);
        }
      }
      /* faint chord links between consecutive visible markers (globe only) */
      const pts = points.map((pt) => {
        if (mode === "globe") {
          const phi = (pt.lat * Math.PI) / 180;
          return projGlobe(pt.lon, Math.cos(phi), Math.sin(phi));
        }
        return projMap(pt.lon, pt.lat);
      });
      if (mode === "globe") {
        ctx.strokeStyle = alpha(k.line, 0.35);
        for (let i = 0; i + 1 < pts.length; i++) {
          if (!pts[i] || !pts[i + 1]) continue;
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
        }
      }
      /* markers + pulse pings (+ count badges on stacked pins) */
      ctx.textAlign = "left";
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!p) continue;
        screenPts.push({ x: p.x, y: p.y, i: i });
        const c = statusColor(k, points[i].status);
        const ping = ((t + i * 0.4) % 1.8) / 1.8;
        ctx.strokeStyle = alpha(c, (1 - ping) * 0.6);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + ping * 12, 0, Math.PI * 2); ctx.stroke();
        const sz = hoverIdx === i ? 5 : 3.5;
        ctx.fillStyle = c;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        ctx.strokeStyle = alpha(c, 0.9);
        ctx.strokeRect(p.x - sz / 2 - 2.5, p.y - sz / 2 - 2.5, sz + 5, sz + 5);
        if (points[i].items && points[i].items.length > 1) {
          ctx.font = "700 10px " + mono();
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = k.bgAlt;
          ctx.strokeText(String(points[i].items.length), p.x + 7, p.y - 6);
          ctx.fillStyle = k.ink;
          ctx.fillText(String(points[i].items.length), p.x + 7, p.y - 6);
          ctx.lineWidth = 1;
        }
      }

      /* stub rays: stacked pins advertise their hidden entries at all times —
         tapered wedges (2px at the pin to a point) at 30% of the fan length,
         each ending in a status-tinted nub: the future satellite, ghosted.
         In globe view a bg halo channel clears the dot texture underneath.
         Everything fades as the real fan opens. */
      if (stubs) {
        for (const sp of screenPts) {
          const pt = points[sp.i];
          if (!pt.items || !pt.items.length) continue;
          const fade = fan.idx === sp.i ? Math.max(0, 1 - fan.prog * 1.6) : 1;
          if (fade <= 0.02) continue;
          const geom = fanGeom(sp, pt.items.length);
          for (let s = 0; s < geom.length; s++) {
            const g = geom[s];
            const ex = sp.x + Math.cos(g.a) * g.rr * 0.3;
            const ey = sp.y + Math.sin(g.a) * g.rr * 0.3;
            if (mode === "globe") {
              ctx.strokeStyle = alpha(k.bgAlt, 0.9 * fade);
              ctx.lineWidth = 5;
              ctx.lineCap = "round";
              ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ex, ey); ctx.stroke();
              ctx.lineCap = "butt";
            }
            const nx = -Math.sin(g.a), ny = Math.cos(g.a); /* perpendicular */
            ctx.fillStyle = alpha(k.ink, 0.55 * fade);
            ctx.beginPath();
            ctx.moveTo(sp.x + nx * 1.1, sp.y + ny * 1.1);
            ctx.lineTo(sp.x - nx * 1.1, sp.y - ny * 1.1);
            ctx.lineTo(ex, ey);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = alpha(statusColor(k, pt.items[s].status), 0.6 * fade);
            ctx.fillRect(ex - 1.8, ey - 1.8, 3.6, 3.6);
          }
        }
        ctx.lineWidth = 1;
      }

      /* fan-out: an open stacked pin branches its items into space on
         annotation leader lines (elbow + tick, halo'd labels) */
      satPts = [];
      if (fan.idx >= 0) {
        const anchor = pts[fan.idx];
        if (!anchor || !points[fan.idx].items) {
          fan.idx = -1; /* pin rotated to the far side or vanished */
        } else if (fan.prog > 0.02) {
          const items = points[fan.idx].items;
          const n = items.length;
          const geom = fanGeom(anchor, n);
          /* twin rails (n >= 3): entries dock onto two concentric arcs — the
             radius stagger formalized. Rails shrink near canvas edges so
             nodes never detach from them; below 3 entries the plain fan
             (clamped endpoints) is kept. */
          const useRails = n >= 3;
          const rails = [54 + (mode === "globe" ? 12 : 0), 72 + (mode === "globe" ? 12 : 0)];
          if (useRails) {
            for (let s = 0; s < n; s++) {
              const ca = Math.cos(geom[s].a), sa = Math.sin(geom[s].a);
              let m = Infinity;
              if (ca > 1e-4) m = Math.min(m, (W - 12 - anchor.x) / ca);
              if (ca < -1e-4) m = Math.min(m, (12 - anchor.x) / ca);
              if (sa > 1e-4) m = Math.min(m, (H - 10 - anchor.y) / sa);
              if (sa < -1e-4) m = Math.min(m, (14 - anchor.y) / sa);
              const rail = s % 2;
              rails[rail] = Math.max(16, Math.min(rails[rail], m));
            }
            if (rails[1] - rails[0] < 10) rails[0] = Math.max(16, rails[1] - 14);
          }
          ctx.font = "500 9.5px " + mono();
          /* the rails themselves: dim arcs spanning the fan, ticked at docks */
          if (useRails && fan.prog > 0.15) {
            const a0 = geom[0].a - 0.1, a1 = geom[n - 1].a + 0.1;
            ctx.strokeStyle = alpha(k.line, 0.35 * fan.prog);
            ctx.lineWidth = 1;
            for (const rr of rails) {
              ctx.beginPath();
              ctx.arc(anchor.x, anchor.y, rr * fan.prog, a0, a1);
              ctx.stroke();
            }
            for (let s = 0; s < n; s++) {
              const rr = rails[s % 2] * fan.prog;
              const ca = Math.cos(geom[s].a), sa = Math.sin(geom[s].a);
              ctx.beginPath();
              ctx.moveTo(anchor.x + ca * (rr - 4), anchor.y + sa * (rr - 4));
              ctx.lineTo(anchor.x + ca * (rr + 4), anchor.y + sa * (rr + 4));
              ctx.stroke();
            }
          }
          for (let s = 0; s < n; s++) {
            const a = geom[s].a;
            const rr = (useRails ? rails[s % 2] : geom[s].rr) * fan.prog;
            let sx = anchor.x + Math.cos(a) * rr;
            let sy = anchor.y + Math.sin(a) * rr;
            if (!useRails) {
              sx = Math.min(W - 12, Math.max(12, sx));
              sy = Math.min(H - 10, Math.max(14, sy));
            }
            const it = items[s];
            const tickDir = Math.cos(a) >= 0 ? 1 : -1;
            ctx.strokeStyle = alpha(k.line, 0.75 * fan.prog);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(anchor.x, anchor.y);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            if (fan.prog > 0.6) {
              ctx.fillStyle = statusColor(k, it.status);
              ctx.fillRect(sx - 2.2, sy - 2.2, 4.4, 4.4);
              const lx = sx + tickDir * 11;
              ctx.textAlign = tickDir > 0 ? "left" : "right";
              ctx.lineJoin = "round";
              ctx.lineWidth = 3;
              ctx.strokeStyle = k.bgAlt;
              ctx.strokeText(it.label, lx, sy + 3);
              ctx.fillStyle = k.ink;
              ctx.fillText(it.label, lx, sy + 3);
              ctx.lineWidth = 1;
              satPts.push({ x: sx, y: sy, item: it, pin: fan.idx });
            }
          }
          ctx.textAlign = "left";
        }
      }
    }

    /* hover -> nearest marker within reach; tooltip is a DOM node */
    function canvasPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (W / rect.width),
        y: (e.clientY - rect.top) * (H / rect.height),
        rect: rect,
      };
    }
    function fillTip(title, info, sub) {
      tip.innerHTML = "";
      const ttl = document.createElement("strong");
      ttl.textContent = title;
      tip.appendChild(ttl);
      if (info) { const s = document.createElement("span"); s.textContent = info; tip.appendChild(s); }
      if (sub) {
        const s2 = document.createElement("span");
        s2.className = "xmap-coords";
        s2.textContent = sub;
        tip.appendChild(s2);
      }
      tip.style.display = "grid";
    }
    function updateHover(e) {
      const pos = canvasPos(e);
      /* satellites take priority while a fan is open */
      let satHit = null;
      for (const sp of satPts) {
        const dx = sp.x - pos.x, dy = sp.y - pos.y;
        if (dx * dx + dy * dy < 14 * 14) { satHit = sp; break; }
      }
      let best = -1, bestD = 18 * 18;
      if (satHit) best = satHit.pin;
      else {
        for (const sp of screenPts) {
          const dx = sp.x - pos.x, dy = sp.y - pos.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD) { bestD = d2; best = sp.i; }
        }
        /* grace zone: keep an open fan while the pointer roams near its pin */
        if (best < 0 && fan.idx >= 0) {
          const anchor = screenPts.find((s) => s.i === fan.idx);
          if (anchor) {
            const dx = anchor.x - pos.x, dy = anchor.y - pos.y;
            if (dx * dx + dy * dy < 130 * 130) best = fan.idx;
          }
        }
      }
      const wantFan = best >= 0 && points[best].items ? best : -1;
      if (wantFan !== fan.idx) {
        fan.idx = wantFan;
        if (reducedMotion.matches) fan.prog = wantFan >= 0 ? 1 : 0;
      }
      const key = satHit ? "s:" + satHit.item.label : "p:" + best;
      if (key !== hoverKey) {
        hoverKey = key;
        hoverIdx = best;
        if (satHit) {
          fillTip(satHit.item.label, satHit.item.info, "via " + (points[satHit.pin].label || "STACK"));
        } else if (best >= 0) {
          const pt = points[best];
          fillTip(pt.label || "POINT " + (best + 1), pt.info,
            Math.abs(pt.lat).toFixed(2) + (pt.lat < 0 ? "S" : "N") +
            " · " + Math.abs(pt.lon).toFixed(2) + (pt.lon < 0 ? "W" : "E"));
        } else {
          tip.style.display = "none";
        }
        if (reducedMotion.matches) draw(0);
      }
      const target = satHit || screenPts.find((s) => s.i === hoverIdx);
      if ((satHit || hoverIdx >= 0) && target) {
        const hostRect = host.getBoundingClientRect();
        let tx = target.x, ty = target.y;
        let transform = "translate(-50%, -100%)", lift = 14;
        if (!satHit && fan.idx === hoverIdx && points[hoverIdx] && points[hoverIdx].items) {
          /* the fan owns one half-plane — park the tooltip on the opposite
             side of the pin so it never covers the fanned entries */
          const base = fanGeom(target, 1)[0].a;
          const ox = -Math.cos(base), oy = -Math.sin(base);
          tx = target.x + ox * 26;
          ty = target.y + oy * 26;
          lift = 0;
          transform = oy > 0.35 ? "translate(-50%, 0)"
            : oy < -0.35 ? "translate(-50%, -100%)"
            : ox > 0 ? "translate(0, -50%)" : "translate(-100%, -50%)";
        }
        tip.style.transform = transform;
        tip.style.left = (pos.rect.left - hostRect.left + tx * (pos.rect.width / W)) + "px";
        tip.style.top = (pos.rect.top - hostRect.top + ty * (pos.rect.height / H) - lift) + "px";
      }
    }
    canvas.addEventListener("pointermove", (e) => {
      hovering = true;
      if (dragging && mode === "globe") {
        rot += (e.clientX - dragX) * 0.006;
        dragX = e.clientX;
        if (reducedMotion.matches) draw(0);
        return;
      }
      updateHover(e);
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (mode !== "globe") return;
      dragging = true; dragX = e.clientX;
      tip.style.display = "none"; hoverIdx = -1; hoverKey = "";
      fan.idx = -1;
      if (reducedMotion.matches) fan.prog = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("pointerleave", () => {
      hovering = false; dragging = false; hoverIdx = -1; hoverKey = "";
      fan.idx = -1;
      tip.style.display = "none";
      if (reducedMotion.matches) { fan.prog = 0; draw(0); }
    });
    function setMode(m) {
      mode = m; hoverIdx = -1; hoverKey = ""; tip.style.display = "none";
      fan.idx = -1;
      if (reducedMotion.matches) fan.prog = 0;
      syncBtns();
      if (reducedMotion.matches) draw(0);
    }
    globeBtn.addEventListener("click", () => setMode("globe"));
    mapBtn.addEventListener("click", () => setMode("map"));

    if (reducedMotion.matches) {
      draw(0);
      liveRenders.add(() => draw(0));
      return;
    }
    let lastT = 0;
    loop((t) => {
      const dt = Math.min(0.1, t - lastT);
      lastT = t;
      if (mode === "globe" && !hovering && !dragging) rot += dt * 0.1;
      fan.prog += ((fan.idx >= 0 ? 1 : 0) - fan.prog) * 0.18;
      draw(t);
    });
  }

  /* ---------- flow ledger ----------
     Angular tree-sankey: solid ink wedges branch left->right through depth
     columns, mono values throughout. Hovering a band or wedge isolates its
     full path (ancestors + descendants) and runs a particle trace along it.
     Data: nested {label, value, children:[...]} JSON in data-x-flowledger. */
  const FLOW_DEMO = {
    label: "DISCOVERED", value: 12400, children: [
      { label: "DISMISSED", value: 8500, children: [
        { label: "NOISE", value: 5600 },
        { label: "OWN PROPERTY", value: 2100 },
        { label: "MUTED HOSTS", value: 800 },
      ] },
      { label: "CASED", value: 3900, accent: true, children: [
        { label: "NOTICES SENT", value: 3100, children: [
          { label: "REMOVED", value: 2450 },
          { label: "PENDING", value: 480 },
          { label: "REFUSED", value: 170 },
        ] },
        { label: "IN REVIEW", value: 800 },
      ] },
    ],
  };

  function flowledger(canvas) {
    let tree = null;
    try { tree = JSON.parse(canvas.getAttribute("data-x-flowledger") || "null"); }
    catch (e) { tree = null; }
    if (!tree || typeof tree.value !== "number" || tree.value <= 0) tree = FLOW_DEMO;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");

    /* flatten the tree */
    const nodes = [];
    (function walk(n, depth, parentIdx) {
      const idx = nodes.length;
      nodes.push({
        label: String(n.label || "NODE " + idx).toUpperCase(),
        value: Math.max(0, +n.value || 0),
        depth: depth, parent: parentIdx, children: [], accent: !!n.accent,
        y0: 0, y1: 0,
      });
      if (parentIdx >= 0) nodes[parentIdx].children.push(idx);
      (Array.isArray(n.children) ? n.children : []).forEach((c) => walk(c, depth + 1, idx));
    })(tree, 0, -1);
    const maxDepth = Math.max(...nodes.map((n) => n.depth));
    const PADL = 8, PADR = 170, TOP = 30, BOT = H - 14, GAP = 16, BARW = 8;
    const colX = (d) => PADL + (maxDepth ? d * ((W - PADL - PADR - BARW) / maxDepth) : 0);

    /* vertical layout: children partition the parent's band (order preserved,
       so wedges never cross); outgoing slices are the gap-free partition */
    nodes[0].y0 = TOP; nodes[0].y1 = BOT;
    const flows = []; /* {c, xs, ys0, ys1, xt, yt0, yt1} — child idx + wedge geometry */
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      if (!nd.children.length) continue;
      const sum = nd.children.reduce((s, ci) => s + nodes[ci].value, 0) || 1;
      const avail = Math.max(10, (nd.y1 - nd.y0) - GAP * (nd.children.length - 1));
      let y = nd.y0, ys = nd.y0;
      for (const ci of nd.children) {
        const frac = nodes[ci].value / sum;
        const h = Math.max(1.5, avail * frac);
        nodes[ci].y0 = y; nodes[ci].y1 = y + h;
        const sh = (nd.y1 - nd.y0) * frac;
        flows.push({
          c: ci,
          xs: colX(nd.depth) + BARW, ys0: ys, ys1: ys + sh,
          xt: colX(nodes[ci].depth), yt0: y, yt1: y + h,
        });
        y += h + GAP; ys += sh;
      }
    }

    /* hover path: ancestors + descendants of the focused node */
    let focus = -1, pathSet = null, pathFlows = [];
    function setFocus(i) {
      focus = i;
      if (i < 0) { pathSet = null; pathFlows = []; return; }
      pathSet = new Set();
      for (let a = i; a >= 0; a = nodes[a].parent) pathSet.add(a);
      const stack = [i];
      while (stack.length) {
        const n = stack.pop();
        pathSet.add(n);
        for (const c of nodes[n].children) stack.push(c);
      }
      pathFlows = flows.filter((f) => pathSet.has(f.c) && pathSet.has(nodes[f.c].parent));
      trace.length = 0;
    }
    const trace = []; /* particle trace along the focused path */

    const fmt = (v) => v.toLocaleString("en-US");
    const pct = (v) => {
      const p = (v / nodes[0].value) * 100;
      return (p >= 10 ? Math.round(p) : p.toFixed(1)) + "%";
    };

    function draw(t) {
      const k = tokens();
      const reveal = reducedMotion.matches ? 1 : Math.min(1, t / 1.1);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W * (1 - Math.pow(1 - reveal, 3)), H);
      ctx.clip();

      const dimmed = focus >= 0;
      const wedgeColor = (ci) => {
        if (dimmed && !pathSet.has(ci)) return alpha(k.ink, 0.1);
        if (dimmed && pathSet.has(ci)) return k.meter;
        return nodes[ci].accent ? k.accent : alpha(k.ink, 0.92);
      };
      /* wedges */
      for (const f of flows) {
        ctx.fillStyle = wedgeColor(f.c);
        ctx.beginPath();
        ctx.moveTo(f.xs, f.ys0); ctx.lineTo(f.xt, f.yt0);
        ctx.lineTo(f.xt, f.yt1); ctx.lineTo(f.xs, f.ys1);
        ctx.closePath(); ctx.fill();
      }
      /* node bars */
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        ctx.fillStyle = dimmed && !pathSet.has(i) ? alpha(k.ink, 0.14)
          : dimmed ? k.meter : nd.accent ? k.accent : k.ink;
        ctx.fillRect(colX(nd.depth), nd.y0, BARW, Math.max(1.5, nd.y1 - nd.y0));
      }
      /* labels with a bg halo so they survive sitting on ink */
      ctx.lineJoin = "round";
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const h = nd.y1 - nd.y0;
        const isLeaf = !nd.children.length;
        const faded = dimmed && !pathSet.has(i);
        if (faded && !isLeaf) continue;
        const ink = faded ? k.muted : k.ink;
        if (isLeaf && nd.depth === maxDepth) {
          /* leaves: label to the right of the final bar */
          const x = colX(nd.depth) + BARW + 8, cy = (nd.y0 + nd.y1) / 2;
          ctx.textAlign = "left";
          ctx.font = "700 11px " + mono();
          ctx.fillStyle = ink;
          ctx.fillText(nd.label, x, cy - 1);
          ctx.font = "500 10px " + mono();
          ctx.fillStyle = faded ? alpha(k.muted, 0.7) : k.muted;
          ctx.fillText(fmt(nd.value) + " · " + pct(nd.value), x, cy + 11);
        } else if (h >= 10 || focus === i) {
          const x = colX(nd.depth) + BARW + 6, y = Math.max(12, nd.y0 - 5);
          ctx.textAlign = "left";
          ctx.font = "700 10.5px " + mono();
          ctx.lineWidth = 4;
          ctx.strokeStyle = k.bgAlt;
          const line = nd.label + "  " + fmt(nd.value) + " · " + pct(nd.value);
          ctx.strokeText(line, x, y);
          ctx.fillStyle = ink;
          ctx.fillText(line, x, y);
        }
      }
      /* particle trace along the focused path */
      if (!reducedMotion.matches && pathFlows.length) {
        while (trace.length < pathFlows.length * 4) {
          trace.push({ f: trace.length % pathFlows.length, u: Math.random(), lane: 0.2 + Math.random() * 0.6 });
        }
        ctx.fillStyle = k.accent;
        for (const p of trace) {
          p.u += 0.012;
          if (p.u > 1) { p.u = 0; p.lane = 0.2 + Math.random() * 0.6; }
          const f = pathFlows[p.f];
          const x = f.xs + (f.xt - f.xs) * p.u;
          const yA = f.ys0 + (f.yt0 - f.ys0) * p.u, yB = f.ys1 + (f.yt1 - f.ys1) * p.u;
          const y = yA + (yB - yA) * p.lane;
          ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
        }
      }
      ctx.restore();
    }

    /* hit test: node bars (with a little slop), then wedges */
    function hitTest(x, y) {
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const bx = colX(nd.depth);
        if (x >= bx - 4 && x <= bx + BARW + 4 && y >= nd.y0 - 4 && y <= nd.y1 + 4) return i;
      }
      for (const f of flows) {
        if (x < f.xs || x > f.xt) continue;
        const u = (x - f.xs) / Math.max(1, f.xt - f.xs);
        const yT = f.ys0 + (f.yt0 - f.ys0) * u, yB = f.ys1 + (f.yt1 - f.ys1) * u;
        if (y >= yT && y <= yB) return f.c;
      }
      return -1;
    }
    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const y = (e.clientY - rect.top) * (H / rect.height);
      const hit = hitTest(x, y);
      if (hit !== focus) {
        setFocus(hit);
        canvas.style.cursor = hit >= 0 ? "pointer" : "crosshair";
        if (reducedMotion.matches) draw(0);
      }
    });
    canvas.addEventListener("pointerleave", () => {
      setFocus(-1);
      if (reducedMotion.matches) draw(0);
    });

    if (reducedMotion.matches) {
      draw(0);
      liveRenders.add(() => draw(0));
      return;
    }
    loop(draw);
  }

  /* ---------- pebble map ----------
     Weighted cells packed organically into an ink slab — the borders are the
     negative space. A soft collision sim settles the pebbles; each cell's
     outline is its circle clipped by radical axes to its neighbours, so cells
     flatten where they touch. Hover inflates a cell (neighbours yield).
     Data: [{label, value, status?}] JSON in data-x-pebblemap. */
  const PEBBLE_DEMO = [
    { label: "ALPHA-TUBE", value: 3400, status: "err" },
    { label: "BETA FORUM", value: 2300, status: "warn" },
    { label: "GAMMA MIRROR", value: 1800 },
    { label: "DELTA CDN", value: 1500 },
    { label: "EPSILON BOARD", value: 1100, status: "warn" },
    { label: "ZETA HOST", value: 950 },
    { label: "ETA CACHE", value: 800 },
    { label: "THETA VAULT", value: 640 },
    { label: "IOTA DUMP", value: 520 },
    { label: "KAPPA NET", value: 430, status: "err" },
    { label: "LAMBDA IO", value: 350 },
    { label: "MU ZONE", value: 280 },
    { label: "NU LINK", value: 210 },
    { label: "XI NODE", value: 160 },
  ];

  function pebblemap(canvas) {
    let items = null;
    try { items = JSON.parse(canvas.getAttribute("data-x-pebblemap") || "null"); }
    catch (e) { items = null; }
    if (!Array.isArray(items) || items.length < 2 ||
        items.some((s) => !s || typeof s.value !== "number" || s.value <= 0)) {
      items = PEBBLE_DEMO;
    }
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");
    const IN = 14, CORNER = 26, GAP = 5;
    const sum = items.reduce((s, it) => s + it.value, 0);
    const usable = (W - IN * 2) * (H - IN * 2) * 0.74;
    const cells = items.map((it, i) => ({
      it: it,
      r0: Math.sqrt((it.value / sum) * usable / Math.PI),
      r: 0, boost: 1,
      x: IN + 40 + ((i * 379) % (W - IN * 2 - 80)),
      y: IN + 40 + ((i * 211) % (H - IN * 2 - 80)),
      ph: (i * 0.7) % (Math.PI * 2),
    }));
    let hover = -1;

    function step(t) {
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const breathe = reducedMotion.matches ? 1 : 1 + 0.006 * Math.sin(t * 0.9 + c.ph);
        c.boost += ((hover === i ? 1.07 : 1) - c.boost) * 0.14;
        c.r += (c.r0 * c.boost * breathe - c.r) * 0.16;
      }
      for (let iter = 0; iter < 2; iter++) {
        for (let i = 0; i < cells.length; i++) {
          const a = cells[i];
          for (let j = i + 1; j < cells.length; j++) {
            const b = cells[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const min = a.r + b.r + GAP;
            if (d < min) {
              const push = (min - d) / d * 0.5;
              const wa = b.r * b.r / (a.r * a.r + b.r * b.r); /* heavy moves less */
              a.x -= dx * push * wa; a.y -= dy * push * wa;
              b.x += dx * push * (1 - wa); b.y += dy * push * (1 - wa);
            }
          }
          /* containment + gentle centering */
          a.x = Math.min(W - IN - a.r - GAP / 2, Math.max(IN + a.r + GAP / 2, a.x));
          a.y = Math.min(H - IN - a.r - GAP / 2, Math.max(IN + a.r + GAP / 2, a.y));
          a.x += (W / 2 - a.x) * 0.0012;
          a.y += (H / 2 - a.y) * 0.0012;
        }
      }
    }

    function roundedSlab(k) {
      /* Backdrop follows the page (--bg), with the cells carrying --ink on top. Inverted from the
         original treatment, where the slab took --ink and turned into a bright panel in dark mode. */
      ctx.fillStyle = k.bg;
      ctx.beginPath();
      ctx.moveTo(IN + CORNER, IN);
      ctx.arcTo(W - IN, IN, W - IN, H - IN, CORNER);
      ctx.arcTo(W - IN, H - IN, IN, H - IN, CORNER);
      ctx.arcTo(IN, H - IN, IN, IN, CORNER);
      ctx.arcTo(IN, IN, W - IN, IN, CORNER);
      ctx.closePath(); ctx.fill();
    }

    function cellPath(i) {
      const c = cells[i];
      const SAMPLES = 26;
      const pts = [];
      for (let s = 0; s < SAMPLES; s++) {
        const th = (s / SAMPLES) * Math.PI * 2;
        const ux = Math.cos(th), uy = Math.sin(th);
        let rad = c.r;
        for (let j = 0; j < cells.length; j++) {
          if (j === i) continue;
          const o = cells[j];
          const dx = o.x - c.x, dy = o.y - c.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > c.r + o.r + 60) continue;
          /* radical axis distance, minus half the gap */
          const tR = (d * d + c.r * c.r - o.r * o.r) / (2 * d) - GAP / 2;
          const cosA = (ux * dx + uy * dy) / d;
          if (cosA > 0.12) rad = Math.min(rad, tR / cosA);
        }
        /* wall constraints */
        if (ux > 0.12) rad = Math.min(rad, (W - IN - GAP / 2 - c.x) / ux);
        if (ux < -0.12) rad = Math.min(rad, (IN + GAP / 2 - c.x) / ux);
        if (uy > 0.12) rad = Math.min(rad, (H - IN - GAP / 2 - c.y) / uy);
        if (uy < -0.12) rad = Math.min(rad, (IN + GAP / 2 - c.y) / uy);
        rad = Math.max(2, rad);
        pts.push([c.x + ux * rad, c.y + uy * rad]);
      }
      /* smooth closed curve through midpoints */
      ctx.beginPath();
      for (let s = 0; s < SAMPLES; s++) {
        const p = pts[s], q = pts[(s + 1) % SAMPLES];
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        if (s === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
      }
      const p0 = pts[0], pl = pts[SAMPLES - 1];
      ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + pl[0]) / 2, (p0[1] + pl[1]) / 2);
      ctx.closePath();
    }

    /* Largest label size that still fits the cell. Scales with the pebble, then measures and steps
       down until it fits the usable chord width — so a big cell gets big type instead of being
       capped at 13px, and a small or long-labelled cell shrinks rather than spilling over its edge.
       Falls back to truncation only when even the floor size can't fit. */
    function fitLabel(text, r) {
      const maxW = r * 1.55;                       // chord well inside the cell edge
      /* rounded, so the -1 steps below land on whole sizes and stop exactly at the floor —
         starting fractional (e.g. 10.12) would step to 9.12 and then straight past 9 to 8.12 */
      let fs = Math.max(10, Math.min(26, Math.round(r * 0.44)));
      ctx.font = "700 " + fs + "px " + mono();
      while (fs > 9 && ctx.measureText(text).width > maxW) {
        fs -= 1;
        ctx.font = "700 " + fs + "px " + mono();
      }
      let out = text;
      if (ctx.measureText(out).width > maxW) {     // still too long at the floor: clip it
        while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1);
        out += "…";
      }
      return { text: out, size: fs };
    }

    function draw() {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      roundedSlab(k);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        cellPath(i);
        /* Cells carry the INK fill and the slab behind them the page background, so the block
           reads as bright shapes on a backdrop that matches the surrounding page in either
           theme — rather than a light slab that fights a dark UI (and vice versa). Label and
           value therefore draw in the background colour, on top of the ink cell. */
        ctx.fillStyle = hover === i ? k.accent : k.ink;
        ctx.fill();
        if (c.r > 24) {
          const st = c.it.status;
          ctx.textAlign = "center";
          const lab = fitLabel(c.it.label, c.r);
          ctx.font = "700 " + lab.size + "px " + mono();
          ctx.fillStyle = k.bg;
          const twoLine = c.r > 34;
          ctx.fillText(lab.text, c.x, c.y + (twoLine ? -2 : lab.size * 0.34));
          if (twoLine) {
            ctx.font = "500 " + Math.max(9, Math.min(15, lab.size * 0.78)) + "px " + mono();
            /* status hues stay legible on the ink cell; the neutral case is a softened
               background colour rather than --ink-muted, which would vanish against it */
            ctx.fillStyle = st === "err" ? k.danger : st === "warn" ? k.warn : alpha(k.bg, 0.68);
            ctx.fillText(c.it.value.toLocaleString("en-US"), c.x, c.y + lab.size * 0.92 + 4);
          }
        }
      }
    }

    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const y = (e.clientY - rect.top) * (H / rect.height);
      let best = -1;
      for (let i = 0; i < cells.length; i++) {
        const dx = x - cells[i].x, dy = y - cells[i].y;
        if (dx * dx + dy * dy < cells[i].r * cells[i].r) { best = i; break; }
      }
      if (best !== hover) {
        hover = best;
        canvas.style.cursor = best >= 0 ? "pointer" : "default";
        if (reducedMotion.matches) { step(0); draw(); }
      }
    });
    canvas.addEventListener("pointerleave", () => {
      if (hover !== -1) { hover = -1; if (reducedMotion.matches) { step(0); draw(); } }
    });

    if (reducedMotion.matches) {
      for (let i = 0; i < 700; i++) step(0);
      draw();
      liveRenders.add(draw);
      return;
    }
    loop((t) => { step(t); draw(); });
  }

  /* ---------- redaction stream ----------
     Progress-as-declassification: content renders as redaction bars that lift
     chunk by chunk as progress advances (with a brief dot-matrix glitch), some
     chunks stay permanently redacted. Drive it with real loading progress via
     sentinelX.redaction(el).set(pct) — or leave the element empty for a
     self-playing demo with a synced progress row.
     Options (attributes on the host):
       data-xr-bare — no progress row / replay button; caller drives via ctl
     Inside the host, wrap text in an element with data-xr-keep to force its
     chunks to stay permanently redacted (e.g. a classified name). */
  const REDACTION_DEMO = [
    "INTERCEPT 0142 — PARTIAL TRANSCRIPT",
    "Subject confirms the relay handoff occurred at 04:12 local. Custody of the package transferred without incident, and the escort element withdrew along the northern service corridor exactly as planned.",
    "Analysis indicates the secondary channel remained dark for the full duration. No counter-surveillance signatures were logged, though two civilian vehicles circled the block at irregular intervals.",
    "Recommend continued observation of the drop site through the next cycle. Escalation to active measures is not warranted at this time; the standing directive remains in force.",
  ];

  function redaction(host) {
    if (host.dataset.xrInit) return host._xrCtl;
    host.dataset.xrInit = "1";
    host.classList.add("xr");
    const bare = host.hasAttribute("data-xr-bare");
    const auto = !host.children.length && !host.textContent.trim();
    if (auto) {
      const head = el("p", "label xr-head", REDACTION_DEMO[0]);
      host.appendChild(head);
      for (let i = 1; i < REDACTION_DEMO.length; i++) {
        const p = document.createElement("p");
        p.textContent = REDACTION_DEMO[i];
        host.appendChild(p);
      }
    }
    /* wrap words into 1-3 word chunks — variable bar lengths read like real
       redactions; every 17th chunk stays permanently redacted */
    const chunkSizes = [1, 2, 1, 3, 1, 2, 2, 1];
    let chunkN = 0;
    const spans = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement.closest(".xr-head, .xr-ui") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const textNodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) textNodes.push(walker.currentNode);
    for (const tn of textNodes) {
      const words = tn.nodeValue.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      let i = 0;
      while (i < words.length) {
        if (!words[i].trim()) { frag.appendChild(document.createTextNode(words[i])); i++; continue; }
        const size = chunkSizes[chunkN % chunkSizes.length];
        let text = "";
        let taken = 0;
        while (i < words.length && taken < size) {
          if (words[i].trim()) taken++;
          if (taken === size && !words[i].trim()) break;
          text += words[i]; i++;
        }
        const s = document.createElement("span");
        const forceKeep = !!tn.parentElement.closest("[data-xr-keep]");
        s.className = "xr-word" + (forceKeep || chunkN % 17 === 9 ? " xr-keep" : "");
        s.textContent = text;
        frag.appendChild(s);
        spans.push(s);
        chunkN++;
      }
      tn.parentNode.replaceChild(frag, tn);
    }
    const openable = spans.filter((s) => !s.classList.contains("xr-keep"));

    /* progress UI (kit progress row, no theme.js dependency) — skipped when
       the host opts out with data-xr-bare (e.g. a hero subtitle) */
    let barEl = null, pctEl = null, replay = null;
    if (!bare) {
      const ui = el("div", "xr-ui");
      const rowEl = el("div", "progress-row");
      const head2 = document.createElement("header");
      head2.append(el("span", "label", "Declassifying"), el("span", "progress-pct", "0%"));
      barEl = el("div", "progress seg");
      barEl.appendChild(el("div", "progress-fill"));
      rowEl.append(head2, barEl);
      ui.appendChild(rowEl);
      replay = el("button", "btn btn-sm btn-ghost", "Replay");
      replay.type = "button";
      ui.appendChild(replay);
      host.appendChild(ui);
      pctEl = head2.querySelector(".progress-pct");
    }

    /* single rAF pump drives both auto-play progress and staggered reveals,
       so it pauses when the page is hidden and is deterministic under test */
    let opened = 0, raf2 = 0, playing = null;
    const pending = [];
    function applySet(p) {
      p = Math.max(0, Math.min(100, p));
      if (barEl) barEl.style.setProperty("--value", p);
      if (pctEl) pctEl.textContent = Math.round(p) + "%";
      const target = Math.round((openable.length * p) / 100);
      if (target > opened) {
        const now = performance.now();
        for (let i = opened; i < target; i++) {
          if (reducedMotion.matches) { openable[i].classList.add("xr-open"); continue; }
          pending.push({ s: openable[i], glitchAt: now + (i - opened) * 26, openAt: now + (i - opened) * 26 + 90, g: false });
        }
        opened = target;
        kick2();
      } else if (target < opened) {
        for (let i = target; i < opened; i++) openable[i].classList.remove("xr-open", "xr-glitch");
        pending.length = 0;
        opened = target;
      }
    }
    function pump(now) {
      raf2 = 0;
      if (playing) {
        const p = Math.min(100, ((now - playing.t0) / playing.ms) * 100);
        applySet(p);
        if (p >= 100) {
          if (playing.loop && !reducedMotion.matches) {
            if (!playing.holdUntil) playing.holdUntil = now + 2800;
            else if (now >= playing.holdUntil) { applySet(0); playing = { t0: now, ms: playing.ms, loop: true }; }
          } else playing = null;
        }
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i];
        if (!p.g && now >= p.glitchAt) { p.s.classList.add("xr-glitch"); p.g = true; }
        if (now >= p.openAt) {
          p.s.classList.remove("xr-glitch");
          p.s.classList.add("xr-open");
          pending.splice(i, 1);
        }
      }
      if (playing || pending.length) raf2 = requestAnimationFrame(pump);
    }
    function kick2() { if (!raf2) raf2 = requestAnimationFrame(pump); }
    const ctl = {
      set: (p) => { playing = null; applySet(p); },
      play: (ms, loopIt) => {
        if (reducedMotion.matches) { applySet(100); return; }
        playing = { t0: performance.now(), ms: ms || 5200, loop: !!loopIt };
        kick2();
      },
      reset: () => { playing = null; applySet(0); },
    };
    if (replay) replay.addEventListener("click", () => { ctl.reset(); ctl.play(5200, auto); });
    host._xrCtl = ctl;
    if (auto) ctl.play(5200, true);
    return ctl;
  }

  /* ---------- market tape ----------
     An instrument for interval-priced markets. First use: the Australian NEM
     (5-minute dispatch, A$/MWh, market price cap 20,300, floor -1,000), but
     nothing below knows what a NEM is -- the contract is "a price every N
     minutes, maybe a forecast, maybe demand, maybe what I dispatched."

       <div data-x-market='{ ...contract... }'></div>       builds its own DOM
       vertebraX.market(host).set(data) / .push(point) / .now(iso) / .destroy()

     Contract (JSON in the attribute, or passed to set()):
       market, region, unit, interval (min), cap, floor, threshold (symlog knee)
       now:      ISO -- the dispatch boundary; everything after it is forecast
       price:    [[iso|ms, n], ...]   actual spot, one per interval
       forecast: [[iso|ms, n], ...]   P5MIN / pre-dispatch, beyond `now`
       demand:   [[iso|ms, MW], ...]  optional, drawn on a right axis
       dispatch: [[iso|ms, MW], ...]  optional own asset: +export / -import

     THE SCALE IS THE POINT. NEM prices live between -100 and 300 nearly all
     the time and then spike to 20,300 for one interval. On a linear axis the
     spike is the chart and the day you actually traded is a flat line along
     the bottom. A symlog axis -- linear through zero, log either side --
     keeps a -$60 trough, a $140 evening and a $2,800 spike all legible on
     one canvas, and negatives get real height going DOWN rather than hiding
     under the baseline.

     Colour is regime, not series: positive price in the data colour, negative
     in the accent (free energy -- the signal a battery owner is watching for),
     above the knee in the danger colour. The own-asset band underneath reads
     the same way, and saturates only when the dispatch made sense against the
     price -- discharging into a high, charging into a low -- so a glance says
     whether the asset was on the right side of the market. */
  const MKT_PROFILES = {
    /* [overnight, morning, trough, evening, spike, trough depth hours, demand base, demand swing] */
    SA1:  { base: 68, morn: 150, trough: -62, eve: 190, spike: 2840, demand: 1300, swing: 900 },
    VIC1: { base: 74, morn: 135, trough: -31, eve: 210, spike: 1260, demand: 4800, swing: 2100 },
    NSW1: { base: 82, morn: 128, trough: 6,   eve: 240, spike: 940,  demand: 7600, swing: 3100 },
    QLD1: { base: 79, morn: 118, trough: -9,  eve: 310, spike: 620,  demand: 6400, swing: 2400 },
    TAS1: { base: 91, morn: 102, trough: 54,  eve: 128, spike: 0,    demand: 1150, swing: 350 },
  };
  function marketDemo(region) {
    const p = MKT_PROFILES[region] || MKT_PROFILES.SA1;
    /* seeded so the showcase is the same picture on every load */
    let seed = 0; for (const ch of region) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const t0 = day.getTime(), STEP = 5 * 60000;
    const NOW_I = 175;                       /* 14:35 -- mid-trough, forecast ahead */
    const shape = (h) => {                   /* the NEM day, as a curve over hours */
      const ramp = (a, b, x) => x <= a ? 0 : x >= b ? 1 : (1 - Math.cos(((x - a) / (b - a)) * Math.PI)) / 2;
      let v = p.base;
      v += (p.morn - p.base) * ramp(5.5, 7.8, h) * (1 - ramp(8.5, 10.5, h));
      v += (p.trough - p.base) * ramp(9.5, 11.5, h) * (1 - ramp(14.5, 16.2, h));
      v += (p.eve - p.base) * ramp(16, 18.2, h) * (1 - ramp(19.5, 22.5, h));
      return v;
    };
    const price = [], forecast = [], demand = [], dispatch = [];
    for (let i = 0; i < 288 + 24; i++) {
      const t = t0 + i * STEP, h = i / 12;
      let v = shape(h) * (1 + (rnd() - 0.5) * 0.14);
      if (i === 222 && p.spike) v = p.spike;                        /* 18:30, one interval */
      if (i === 223 && p.spike) v = p.spike * 0.42;
      const d = p.demand + p.swing * (0.55 * Math.exp(-Math.pow((h - 8) / 2.2, 2)) +
                                       Math.exp(-Math.pow((h - 18.5) / 2.4, 2)));
      if (i <= NOW_I) price.push([t, Math.round(v * 100) / 100]);
      else forecast.push([t, Math.round(v * (1 + (rnd() - 0.5) * 0.08) * 100) / 100]);
      demand.push([t, Math.round(d + (rnd() - 0.5) * 60)]);
      /* a 100 MW / 2 h battery: fills in the trough, empties into the evening */
      let mw = 0;
      if (h >= 10.5 && h < 14.5) mw = -78 - rnd() * 12;
      else if (h >= 17 && h < 19.6) mw = 96 + rnd() * 6;
      else if (h >= 6.5 && h < 7.8) mw = 40;
      dispatch.push([t, Math.round(mw)]);
    }
    return { market: "NEM", region: region, unit: "$/MWh", interval: 5, cap: 20300, floor: -1000,
      threshold: 300, now: new Date(t0 + NOW_I * STEP).toISOString(),
      price: price, forecast: forecast, demand: demand, dispatch: dispatch };
  }

  function market(host) {
    if (host.dataset.xmkInit) return host._xmk;
    host.dataset.xmkInit = "1";
    host.classList.add("xmk");
    const compact = host.hasAttribute("data-xmk-compact");
    if (compact) host.classList.add("xmk-compact");

    /* ---- DOM: header is real text, so it themes, reflows and reads aloud ---- */
    const head = el("div", "xmk-head");
    const idBox = el("div", "xmk-id");
    const region = el("span", "pill");
    const mktLbl = el("span", "label xmk-mkt");
    idBox.append(region, mktLbl);
    const priceBox = el("div", "xmk-price");
    const priceNow = el("span", "xmk-now num");
    const delta = el("span", "xmk-delta num");
    priceBox.append(priceNow, delta);
    const nextBox = el("div", "xmk-next");
    const nextLbl = el("span", "label", "Next dispatch");
    const countdown = el("span", "lcd xmk-count");
    nextBox.append(nextLbl, countdown);
    const stats = el("div", "xmk-stats num");
    head.append(idBox, priceBox, nextBox, stats);
    const frame = el("div", "xmk-frame");
    const canvas = el("canvas", "x-canvas xmk-canvas");
    canvas.width = compact ? 420 : 1120;
    canvas.height = compact ? 118 : 440;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("tabindex", "0");
    const tip = el("div", "xmk-tip");
    const live = el("div", "sr-only");
    live.setAttribute("aria-live", "polite");
    frame.append(canvas, tip);
    const hint = compact ? null : el("p", "small muted xmk-hint",
      "hover to read an interval · arrow keys step · dashed = forecast · hatched = beyond dispatch");
    host.append(head, frame);
    if (hint) host.append(hint);
    host.append(live);

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");
    const ms = (x) => (typeof x === "number" ? x : new Date(x).getTime());
    const fmtMoney = (v) => {
      const a = Math.abs(v);
      const s = a >= 1000 ? Math.round(a).toLocaleString() : a >= 100 ? a.toFixed(0) : a.toFixed(a < 10 ? 2 : 1);
      return (v < 0 ? "−$" : "$") + s;
    };
    const fmtTime = (t) => { const d = new Date(t); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); };

    let data = null, rows = [], nowT = 0, nowIdx = -1, knee = 300;
    let scrub = -1, summary = { avg: 0, max: 0, maxT: 0, min: 0, neg: 0 };
    let tickTimer = null;

    /* ---- ingest: one row per interval, series joined on timestamp ---- */
    function ingest(d) {
      data = d;
      knee = +d.threshold > 0 ? +d.threshold : 300;
      nowT = d.now ? ms(d.now) : (d.price && d.price.length ? ms(d.price[d.price.length - 1][0]) : Date.now());
      const byT = new Map();
      const put = (arr, key) => (arr || []).forEach((pt) => {
        if (!pt || pt.length < 2 || !isFinite(+pt[1])) return;
        const t = ms(pt[0]);
        if (!byT.has(t)) byT.set(t, { t: t });
        byT.get(t)[key] = +pt[1];
      });
      put(d.price, "price"); put(d.forecast, "fc"); put(d.demand, "demand"); put(d.dispatch, "mw");
      rows = [...byT.values()].sort((a, b) => a.t - b.t);
      nowIdx = -1;
      for (let i = 0; i < rows.length; i++) if (rows[i].t <= nowT) nowIdx = i;
      /* the day's story, in four numbers */
      const actual = rows.filter((r) => r.price != null);
      if (actual.length) {
        let sum = 0, mx = -Infinity, mxT = 0, mn = Infinity, neg = 0;
        for (const r of actual) { sum += r.price; if (r.price > mx) { mx = r.price; mxT = r.t; } if (r.price < mn) mn = r.price; if (r.price < 0) neg++; }
        summary = { avg: sum / actual.length, max: mx, maxT: mxT, min: mn, neg: neg };
      }
      region.textContent = d.region || "";
      mktLbl.textContent = (d.market || "") + (d.interval ? " · " + d.interval + "-min" : "") + (d.unit ? " · " + d.unit : "");
      const cur = actual.length ? actual[actual.length - 1] : null;
      const prev = actual.length > 1 ? actual[actual.length - 2] : null;
      priceNow.textContent = cur ? fmtMoney(cur.price) : "—";
      priceNow.classList.toggle("xmk-neg", !!cur && cur.price < 0);
      priceNow.classList.toggle("xmk-spike", !!cur && cur.price > knee);
      if (cur && prev) {
        const dv = cur.price - prev.price;
        delta.textContent = (dv >= 0 ? "▲ " : "▼ ") + fmtMoney(Math.abs(dv)).replace("$", "");
        delta.className = "xmk-delta num " + (dv >= 0 ? "num-pos" : "num-neg");
      } else delta.textContent = "";
      stats.textContent = actual.length
        ? "avg " + fmtMoney(summary.avg) + "  ·  max " + fmtMoney(summary.max) + " @ " + fmtTime(summary.maxT) +
          "  ·  min " + fmtMoney(summary.min) + "  ·  " + summary.neg + " negative"
        : "";
      canvas.setAttribute("aria-label",
        (d.region || "Market") + " " + (d.market || "") + " price, " + (d.interval || "") + "-minute intervals. " +
        (cur ? "Now " + fmtMoney(cur.price) + ". " : "") +
        (actual.length ? "Day average " + fmtMoney(summary.avg) + ", peak " + fmtMoney(summary.max) + " at " + fmtTime(summary.maxT) +
          ", " + summary.neg + " negative intervals. " : "") +
        (rows.length > nowIdx + 1 ? (rows.length - nowIdx - 1) + " forecast intervals ahead." : ""));
      if (scrub >= rows.length) scrub = -1;
    }

    /* ---- symlog: linear near zero, log beyond the knee, mirrored below ---- */
    const sl = (v) => Math.sign(v) * Math.log1p(Math.abs(v) / knee);
    const TICKS = [-1000, -300, -100, -30, 0, 30, 100, 300, 1000, 3000, 10000, 20300];

    function layout() {
      /* rows, top to bottom: plot / hour labels (B) / own-dispatch band */
      const L = compact ? 8 : 52, R = compact ? 8 : 54, T = compact ? 8 : 16, B = compact ? 6 : 22;
      const hasMw = !compact && rows.some((r) => r.mw != null);
      const bandH = hasMw ? Math.round((H - T - B) * 0.2) : 0;
      const plotB = hasMw ? H - 6 - bandH - B : H - B;
      let lo = 0, hi = knee * 1.4;
      for (const r of rows) {
        const v = r.price != null ? r.price : r.fc;
        if (v == null) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      hi = Math.min(hi * 1.18, (+data.cap || 20300) * 1.02);
      lo = Math.max(lo * 1.25, +data.floor || -1000);
      const yLo = sl(lo), yHi = sl(hi);
      const t0 = rows.length ? rows[0].t : 0, t1 = rows.length ? rows[rows.length - 1].t : 1;
      return {
        L: L, R: R, T: T, plotB: plotB, bandH: bandH, hasMw: hasMw, lo: lo, hi: hi,
        x: (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R),
        y: (v) => plotB - ((sl(v) - yLo) / (yHi - yLo)) * (plotB - T),
        xNow: nowIdx >= 0 ? L + ((rows[nowIdx].t - t0) / Math.max(1, t1 - t0)) * (W - L - R) : null,
        t0: t0, t1: t1,
      };
    }

    function regime(k, v) { return v < 0 ? k.accent : v > knee ? k.danger : k.meter; }

    function draw() {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      if (!rows.length) return;
      const g = layout();
      const f = mono();
      ctx.font = (compact ? 9 : 10) + "px " + f;
      ctx.textBaseline = "middle";

      /* forecast territory: hatched, so "we don't know this yet" is a texture */
      if (g.xNow != null && g.xNow < W - g.R) {
        ctx.save();
        ctx.beginPath(); ctx.rect(g.xNow, g.T, W - g.R - g.xNow, g.plotB - g.T); ctx.clip();
        ctx.strokeStyle = alpha(k.muted, 0.16); ctx.lineWidth = 1;
        for (let x = g.xNow - (g.plotB - g.T); x < W; x += 9) {
          ctx.beginPath(); ctx.moveTo(x, g.plotB); ctx.lineTo(x + (g.plotB - g.T), g.T); ctx.stroke();
        }
        ctx.restore();
      }

      /* price grid on the symlog ticks; the zero line is the one that matters */
      ctx.lineWidth = 1;
      for (const tv of TICKS) {
        if (tv < g.lo || tv > g.hi) continue;
        const y = g.y(tv);
        ctx.strokeStyle = tv === 0 ? alpha(k.ink, 0.55) : alpha(k.grid, tv === +data.cap ? 0 : 0.9);
        ctx.setLineDash(tv === +data.cap ? [4, 4] : []);
        if (tv === +data.cap) ctx.strokeStyle = alpha(k.danger, 0.7);
        ctx.beginPath(); ctx.moveTo(g.L, y); ctx.lineTo(W - g.R, y); ctx.stroke();
        ctx.setLineDash([]);
        if (!compact) {
          ctx.fillStyle = tv === +data.cap ? k.danger : k.muted;
          ctx.textAlign = "right";
          ctx.fillText(tv === +data.cap ? "MPC" : (tv < 0 ? "−" : "") + (Math.abs(tv) >= 1000 ? Math.abs(tv) / 1000 + "k" : Math.abs(tv)), g.L - 6, y);
        }
      }
      /* hour grid */
      const hourMs = 3600000, step = compact ? 6 : 3;
      ctx.textAlign = "center";
      for (let t = Math.ceil(g.t0 / hourMs) * hourMs; t <= g.t1; t += hourMs) {
        const hr = new Date(t).getHours();
        if (hr % step) continue;
        const x = g.x(t);
        ctx.strokeStyle = alpha(k.grid, 0.7);
        ctx.beginPath(); ctx.moveTo(x, g.T); ctx.lineTo(x, g.plotB); ctx.stroke();
        if (!compact) { ctx.fillStyle = k.muted; ctx.fillText(fmtTime(t), x, g.plotB + 11); }
      }

      /* demand, quietly, on its own axis */
      const dem = rows.filter((r) => r.demand != null);
      if (dem.length > 1 && !compact) {
        let dlo = Infinity, dhi = -Infinity;
        for (const r of dem) { if (r.demand < dlo) dlo = r.demand; if (r.demand > dhi) dhi = r.demand; }
        const pad = (dhi - dlo) * 0.15 || 1;
        const dy = (v) => g.plotB - ((v - (dlo - pad)) / ((dhi + pad) - (dlo - pad))) * (g.plotB - g.T);
        ctx.strokeStyle = alpha(k.muted, 0.75); ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        ctx.beginPath();
        dem.forEach((r, i) => { const x = g.x(r.t), y = dy(r.demand); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
        ctx.fillStyle = k.muted; ctx.textAlign = "left";
        ctx.fillText(Math.round(dhi / 100) / 10 + " GW", W - g.R + 6, dy(dhi));
        ctx.fillText(Math.round(dlo / 100) / 10 + " GW", W - g.R + 6, dy(dlo));
        ctx.fillText("demand", W - g.R + 6, (dy(dhi) + dy(dlo)) / 2);
      }

      /* the tape: each interval is a column from the zero line to its price,
         coloured by regime -- so a negative interval is a visible pit, not a
         missing bar */
      const y0 = g.y(0);
      const colW = rows.length > 1 ? (g.x(rows[1].t) - g.x(rows[0].t)) : 4;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const v = r.price != null ? r.price : r.fc;
        if (v == null) continue;
        const isFc = r.price == null;
        const x = g.x(r.t), y = g.y(v);
        ctx.fillStyle = alpha(regime(k, v), isFc ? 0.1 : (v > knee ? 0.42 : 0.26));
        ctx.fillRect(x, Math.min(y, y0), Math.max(1, colW - 0.5), Math.abs(y0 - y) || 1);
      }
      /* line over the actuals, dashed over the forecast */
      const strokeRun = (pts, dash, width) => {
        if (pts.length < 2) return;
        ctx.setLineDash(dash); ctx.lineWidth = width; ctx.lineJoin = "round";
        for (let i = 1; i < pts.length; i++) {
          ctx.strokeStyle = regime(k, pts[i].v);
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
        ctx.setLineDash([]);
      };
      strokeRun(rows.filter((r) => r.price != null).map((r) => ({ x: g.x(r.t) + colW / 2, y: g.y(r.price), v: r.price })), [], compact ? 1.2 : 1.6);
      const fcPts = rows.filter((r) => r.fc != null).map((r) => ({ x: g.x(r.t) + colW / 2, y: g.y(r.fc), v: r.fc }));
      if (nowIdx >= 0 && rows[nowIdx].price != null) fcPts.unshift({ x: g.x(rows[nowIdx].t) + colW / 2, y: g.y(rows[nowIdx].price), v: rows[nowIdx].price });
      strokeRun(fcPts, [3, 4], compact ? 1 : 1.3);

      /* the dispatch boundary */
      if (g.xNow != null) {
        ctx.strokeStyle = k.ink; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(g.xNow + colW, g.T); ctx.lineTo(g.xNow + colW, g.hasMw ? H - 6 : g.plotB); ctx.stroke();
        ctx.setLineDash([]);
        if (!compact) {
          ctx.fillStyle = k.ink; ctx.textAlign = "left"; ctx.font = "700 9px " + f;
          ctx.fillText("NOW " + fmtTime(nowT), g.xNow + colW + 5, g.T + 7);
          ctx.font = "10px " + f;
        }
      }

      /* own-asset band: export up, import down; saturated when it made sense */
      if (g.hasMw) {
        const bT = g.plotB + 22, bB = H - 6, mid = (bT + bB) / 2;
        let mx = 1; for (const r of rows) if (r.mw != null && Math.abs(r.mw) > mx) mx = Math.abs(r.mw);
        ctx.strokeStyle = alpha(k.grid, 0.9); ctx.beginPath(); ctx.moveTo(g.L, mid); ctx.lineTo(W - g.R, mid); ctx.stroke();
        for (const r of rows) {
          if (r.mw == null || r.mw === 0) continue;
          const v = r.price != null ? r.price : r.fc;
          const smart = v == null ? 0.5 : (r.mw > 0 ? v >= summary.avg : v <= summary.avg) ? 1 : 0.35;
          const h = (Math.abs(r.mw) / mx) * ((bB - bT) / 2 - 1);
          ctx.fillStyle = alpha(r.mw > 0 ? k.u1 : k.u2, (r.price == null ? 0.25 : 0.85) * smart);
          ctx.fillRect(g.x(r.t), r.mw > 0 ? mid - h : mid, Math.max(1, colW - 0.5), h);
        }
        ctx.fillStyle = k.muted; ctx.textAlign = "right";
        ctx.fillText("+" + Math.round(mx) + " MW", g.L - 6, bT + 4);
        ctx.fillText("−" + Math.round(mx) + " MW", g.L - 6, bB - 4);
        /* the band's name sits inside it, top-left: the right margin is sized
           for a demand figure, and a twelve-character label does not fit there */
        ctx.textAlign = "left"; ctx.font = "700 9px " + f;
        ctx.fillText("OWN DISPATCH", g.L + 5, bT + 6);
        ctx.font = "10px " + f;
      }

      /* scrub: a column lit, a crosshair, and the readout follows */
      if (scrub >= 0 && scrub < rows.length) {
        const r = rows[scrub], x = g.x(r.t);
        ctx.fillStyle = alpha(k.ink, 0.08); ctx.fillRect(x, g.T, Math.max(1, colW - 0.5), (g.hasMw ? H - 6 : g.plotB) - g.T);
        ctx.strokeStyle = alpha(k.ink, 0.6); ctx.setLineDash([1, 3]);
        ctx.beginPath(); ctx.moveTo(x + colW / 2, g.T); ctx.lineTo(x + colW / 2, g.hasMw ? H - 6 : g.plotB); ctx.stroke();
        ctx.setLineDash([]);
        const v = r.price != null ? r.price : r.fc;
        if (v != null) {
          ctx.fillStyle = regime(k, v);
          ctx.beginPath(); ctx.arc(x + colW / 2, g.y(v), 3.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      /* frame */
      ctx.strokeStyle = k.line; ctx.lineWidth = 1;
      ctx.strokeRect(g.L + 0.5, g.T + 0.5, W - g.L - g.R - 1, g.plotB - g.T - 1);
    }

    /* ---- the readout for one interval ---- */
    function describe(r) {
      const v = r.price != null ? r.price : r.fc;
      const parts = [fmtTime(r.t) + (r.price == null ? " forecast" : "")];
      if (v != null) parts.push(fmtMoney(v) + (v < 0 ? " negative" : v > knee ? " spike" : ""));
      if (r.demand != null) parts.push(Math.round(r.demand).toLocaleString() + " MW demand");
      if (r.mw != null && r.mw !== 0) parts.push((r.mw > 0 ? "exporting " : "importing ") + Math.abs(r.mw) + " MW");
      return parts;
    }
    function showTip() {
      if (scrub < 0 || scrub >= rows.length) { tip.style.display = "none"; return; }
      const r = rows[scrub], g = layout();
      const parts = describe(r);
      tip.innerHTML = "";
      const strong = el("strong", null, parts[0]); tip.append(strong);
      parts.slice(1).forEach((p) => tip.append(el("span", null, p)));
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width / W;
      const x = g.x(r.t) * sx;
      tip.style.display = "grid";
      tip.style.left = Math.max(80, Math.min(rect.width - 80, x)) + "px";
      tip.style.top = Math.max(8, g.T * (rect.height / H) + 6) + "px";
      live.textContent = parts.join(", ");
    }
    function setScrub(i) {
      scrub = i;
      draw(); showTip();
    }

    canvas.addEventListener("pointermove", (e) => {
      if (!rows.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const g = layout();
      let best = -1, bd = Infinity;
      for (let i = 0; i < rows.length; i++) { const d = Math.abs(g.x(rows[i].t) - x); if (d < bd) { bd = d; best = i; } }
      if (best !== scrub) setScrub(best);
    });
    canvas.addEventListener("pointerleave", () => setScrub(-1));
    canvas.addEventListener("keydown", (e) => {
      if (!rows.length) return;
      const last = rows.length - 1;
      if (e.key === "ArrowRight") { e.preventDefault(); setScrub(scrub < 0 ? (nowIdx >= 0 ? nowIdx : 0) : Math.min(last, scrub + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setScrub(scrub < 0 ? (nowIdx >= 0 ? nowIdx : last) : Math.max(0, scrub - 1)); }
      else if (e.key === "Home") { e.preventDefault(); setScrub(0); }
      else if (e.key === "End") { e.preventDefault(); setScrub(last); }
      else if (e.key === "Escape") { setScrub(-1); }
    });
    canvas.addEventListener("blur", () => setScrub(-1));

    /* countdown to the next dispatch boundary on the wall clock -- the NEM
       dispatches at :00 :05 :10, so this is real even when the data is demo */
    function tick() {
      const step = ((data && +data.interval) || 5) * 60000;
      const left = step - (Date.now() % step);
      const s = Math.floor(left / 1000);
      countdown.textContent = (s >= 600 ? "" : "0") + Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    }

    const api = {
      set: (d) => { ingest(d); draw(); showTip(); return api; },
      push: (pt) => {
        /* one new interval: becomes the actual, and anything we had forecast
           for that time is superseded by it */
        if (!data) return api;
        const t = ms(pt.t != null ? pt.t : pt[0]);
        const price = pt.price != null ? pt.price : pt[1];
        data.price = (data.price || []).concat([[t, price]]);
        data.forecast = (data.forecast || []).filter((f) => ms(f[0]) > t);
        if (pt.demand != null) data.demand = (data.demand || []).concat([[t, pt.demand]]);
        if (pt.dispatch != null) data.dispatch = (data.dispatch || []).concat([[t, pt.dispatch]]);
        if (pt.forecast) data.forecast = data.forecast.concat(pt.forecast);
        data.now = new Date(t).toISOString();
        return api.set(data);
      },
      now: (iso) => { if (data) { data.now = iso; return api.set(data); } return api; },
      scrub: (i) => { setScrub(i); return api; },
      data: () => (data ? Object.assign({}, data) : null),
      destroy: () => { liveRenders.delete(draw); if (tickTimer) clearInterval(tickTimer); host.innerHTML = ""; delete host.dataset.xmkInit; },
    };
    host._xmk = api;

    let initial = null;
    try { initial = JSON.parse(host.getAttribute("data-x-market") || "null"); } catch (e) { initial = null; }
    if (!initial || typeof initial !== "object" || !Array.isArray(initial.price)) {
      initial = marketDemo(host.getAttribute("data-xmk-region") || (initial && initial.region) || "SA1");
    }
    api.set(initial);
    liveRenders.add(draw);
    tick(); tickTimer = setInterval(tick, 1000);
    return api;
  }

  /* ---------- atlas ----------
     A detailed single-country plate with a site list beside it. First plate:
     Australia, drawn from Natural Earth 1:50m admin-1 geometry (public
     domain), simplified and embedded -- no network, no dependencies, like
     the world map. States and the NEM regions they are share an outline;
     WA and NT are drawn lighter because they are not in the market.

       <div data-x-atlas='[{"lat":-34.5,"lon":146.2,"label":"…","status":"ok"}]'></div>
       vertebraX.atlas(host).set(points) / .select(i) / .focus("NSW") / .destroy()

     Points: {lat, lon, label, info?, status?, kind?, group?}
       status  ok | warn | err | off | pending     (off = hollow, pending = dashed)
       kind    solar | bess | other               (square / diamond / circle)
       group   optional; otherwise points group by the state they fall in

     THE LIST IS THE OTHER HALF. Sixty pins on a map answer "where", not
     "which" -- you cannot read a label off a cluster in the Hunter. So the
     same points are also a real ARIA tree beside the map: a row per state
     (or per group), each opening to its sites. Hover either side and the
     other lights up; pick a row and the map frames it; filter and the tree
     is rebuilt, so the keyboard never lands on a hidden row.

     Clusters are not a separate feature. Pins within a few screen pixels
     stack into one marker with a count, and because the map zooms, they
     fall apart on their own as you frame the state. */
  const AU_PLATE = {"WA":[[[113.13,-25.95],[113.16,-26.09],[112.96,-25.78],[112.91,-25.57],[112.95,-25.53]],[[129.0,-26.0],[129.0,-31.69],[128.07,-32.07],[127.32,-32.26],[125.92,-32.3],[124.76,-32.88],[124.24,-33.02],[123.87,-33.6],[123.51,-33.92],[123.37,-33.91],[123.21,-33.99],[123.07,-33.9],[122.78,-33.89],[122.15,-33.99],[122.06,-33.87],[121.41,-33.83],[120.42,-33.96],[119.85,-33.97],[119.64,-34.1],[119.45,-34.37],[119.25,-34.46],[118.9,-34.48],[118.14,-34.99],[117.86,-35.06],[117.58,-35.1],[116.52,-34.99],[115.99,-34.79],[115.56,-34.43],[115.28,-34.3],[115.13,-34.34],[115.01,-34.26],[114.99,-33.52],[115.18,-33.64],[115.36,-33.64],[115.52,-33.53],[115.68,-33.19],[115.62,-32.67],[115.71,-32.57],[115.73,-32.4],[115.7,-31.69],[115.08,-30.56],[114.97,-30.04],[114.96,-29.43],[114.86,-29.14],[114.63,-28.87],[114.54,-28.54],[114.17,-28.08],[114.03,-27.35],[113.18,-26.18],[113.32,-26.24],[113.36,-26.08],[113.58,-26.56],[113.73,-26.6],[113.84,-26.5],[113.85,-26.33],[113.59,-26.1],[113.4,-25.71],[113.45,-25.6],[113.71,-25.83],[113.72,-26.13],[113.77,-26.16],[113.85,-26.01],[113.99,-26.32],[114.09,-26.39],[114.22,-26.29],[114.21,-25.85],[113.67,-24.98],[113.42,-24.44],[113.49,-23.87],[113.76,-23.42],[113.8,-22.91],[113.68,-22.64],[113.96,-21.94],[114.12,-21.83],[114.09,-22.18],[114.16,-22.32],[114.14,-22.48],[114.38,-22.34],[114.71,-21.82],[115.46,-21.49],[116.01,-21.03],[116.71,-20.65],[117.14,-20.64],[117.41,-20.72],[118.2,-20.38],[118.75,-20.26],[119.1,-20.0],[119.59,-20.04],[120.43,-19.84],[121.0,-19.6],[121.34,-19.32],[121.83,-18.48],[122.35,-18.11],[122.36,-18.04],[122.24,-17.97],[122.15,-17.55],[122.16,-17.31],[122.26,-17.14],[122.72,-16.79],[122.92,-16.43],[122.97,-16.44],[123.14,-16.86],[123.56,-17.52],[123.59,-17.03],[123.83,-17.12],[123.87,-16.92],[123.49,-16.49],[123.63,-16.42],[123.61,-16.22],[123.73,-16.19],[123.86,-16.38],[124.04,-16.26],[124.3,-16.39],[124.77,-16.4],[124.4,-16.3],[124.42,-16.13],[124.58,-16.11],[124.65,-15.87],[124.65,-15.81],[124.61,-15.82],[124.5,-15.97],[124.38,-15.76],[124.44,-15.49],[124.56,-15.5],[124.69,-15.36],[124.69,-15.27],[125.02,-15.47],[125.06,-15.44],[125.07,-15.31],[124.91,-15.31],[124.84,-15.16],[125.02,-15.07],[125.04,-15.0],[125.36,-15.12],[125.38,-15.02],[125.24,-14.94],[125.18,-14.71],[125.28,-14.58],[125.58,-14.48],[125.63,-14.26],[125.7,-14.29],[125.66,-14.53],[125.74,-14.44],[125.82,-14.47],[125.89,-14.62],[126.02,-14.49],[126.11,-14.11],[126.05,-13.98],[126.18,-14.0],[126.26,-14.16],[126.4,-14.02],[126.57,-14.16],[126.78,-13.96],[126.78,-13.79],[126.9,-13.74],[127.46,-14.03],[128.2,-14.75],[128.08,-15.09],[128.07,-15.33],[128.16,-15.23],[128.25,-15.3],[128.18,-15.04],[128.48,-14.79],[129.0,-14.87]]],"NT":[[[129.0,-26.0],[129.0,-14.87],[129.17,-14.99],[129.22,-15.16],[129.27,-14.87],[129.46,-14.93],[129.63,-15.14],[129.64,-14.85],[129.85,-14.83],[129.6,-14.65],[129.7,-14.56],[129.61,-14.56],[129.38,-14.39],[129.46,-14.21],[129.71,-13.98],[129.84,-13.57],[130.14,-13.45],[130.26,-13.3],[130.14,-13.15],[130.17,-12.96],[130.32,-12.88],[130.4,-12.69],[130.62,-12.65],[130.62,-12.43],[130.74,-12.43],[130.87,-12.56],[130.87,-12.37],[131.02,-12.34],[131.02,-12.21],[131.22,-12.18],[131.29,-12.07],[131.34,-12.21],[131.44,-12.28],[131.89,-12.23],[132.06,-12.28],[132.25,-12.19],[132.41,-12.3],[132.51,-12.13],[132.71,-12.12],[132.63,-12.04],[132.67,-11.65],[132.48,-11.49],[132.07,-11.47],[131.82,-11.3],[131.96,-11.18],[132.16,-11.31],[132.26,-11.2],[132.33,-11.22],[132.68,-11.51],[132.86,-11.39],[132.96,-11.41],[133.19,-11.71],[133.53,-11.82],[133.9,-11.83],[134.42,-12.05],[134.73,-11.98],[135.03,-12.19],[135.22,-12.22],[135.92,-11.83],[135.83,-11.95],[135.89,-11.99],[135.7,-12.21],[135.74,-12.24],[135.94,-12.15],[136.01,-12.19],[136.08,-12.42],[136.26,-12.43],[136.33,-12.31],[136.27,-12.13],[136.44,-11.95],[136.54,-11.96],[136.61,-12.13],[136.72,-12.23],[136.9,-12.24],[136.95,-12.35],[136.54,-12.78],[136.59,-13.0],[136.46,-13.23],[136.29,-13.14],[135.93,-13.3],[135.99,-13.81],[135.88,-14.15],[135.41,-14.76],[135.53,-15.0],[136.21,-15.4],[136.29,-15.57],[136.58,-15.71],[136.7,-15.69],[136.7,-15.83],[136.78,-15.89],[137.0,-15.88],[137.7,-16.23],[138.0,-16.56],[138.0,-26.0]],[[136.93,-14.18],[136.89,-14.29],[136.34,-14.21],[136.43,-14.13],[136.42,-13.86],[136.66,-13.68],[136.76,-13.85],[136.85,-13.75],[136.89,-13.79],[136.75,-14.12]],[[130.58,-11.74],[130.61,-11.82],[130.5,-11.84],[130.32,-11.77],[130.13,-11.82],[130.04,-11.79],[130.07,-11.68],[130.2,-11.66],[130.15,-11.48],[130.29,-11.34],[130.34,-11.34],[130.46,-11.68]],[[131.47,-11.38],[131.54,-11.44],[131.46,-11.59],[131.38,-11.58],[131.29,-11.71],[130.95,-11.93],[130.51,-11.62],[130.37,-11.21],[130.43,-11.18],[130.62,-11.38],[130.75,-11.38],[130.91,-11.31],[131.02,-11.33],[131.27,-11.19]],[[136.73,-11.02],[136.78,-11.01],[136.74,-11.19],[136.53,-11.44],[136.71,-11.16]],[[132.59,-11.0],[132.63,-11.17],[132.57,-11.32],[132.48,-11.04]]],"SA":[[[129.0,-31.69],[129.0,-26.0],[141.0,-26.0],[141.03,-34.04],[140.97,-34.01],[140.97,-38.07],[140.63,-38.03],[140.39,-37.9],[140.21,-37.64],[139.78,-37.25],[139.74,-37.06],[139.86,-36.66],[139.73,-36.37],[139.55,-36.1],[138.97,-35.58],[139.07,-35.6],[139.18,-35.52],[139.29,-35.61],[139.33,-35.43],[139.28,-35.38],[139.19,-35.35],[138.88,-35.54],[138.52,-35.64],[138.18,-35.61],[138.4,-35.33],[138.51,-35.02],[138.49,-34.76],[138.09,-34.17],[137.92,-34.46],[137.87,-34.73],[137.69,-35.14],[136.88,-35.24],[137.01,-34.92],[137.39,-34.91],[137.49,-34.6],[137.49,-34.16],[137.65,-33.86],[137.93,-33.58],[137.85,-33.2],[137.99,-33.09],[137.91,-32.77],[137.78,-32.58],[137.79,-32.82],[137.44,-33.19],[137.24,-33.63],[136.43,-34.03],[135.89,-34.66],[135.97,-34.98],[135.79,-34.86],[135.65,-34.94],[135.32,-34.64],[135.12,-34.59],[135.22,-34.49],[135.38,-34.6],[135.45,-34.58],[135.22,-33.96],[134.89,-33.63],[134.72,-33.26],[134.61,-33.19],[134.3,-33.17],[134.1,-32.75],[134.23,-32.73],[134.23,-32.55],[133.67,-32.21],[133.21,-32.18],[132.76,-31.96],[132.21,-32.01],[131.72,-31.7],[131.14,-31.5],[130.78,-31.6],[130.13,-31.58]],[[137.93,-35.73],[138.12,-35.85],[138.07,-35.9],[137.67,-35.9],[137.59,-36.03],[137.45,-36.07],[137.21,-35.98],[137.15,-36.04],[136.76,-36.03],[136.54,-35.89],[136.64,-35.75],[137.33,-35.59],[137.59,-35.62],[137.64,-35.66],[137.6,-35.74]]],"QLD":[[[138.0,-26.0],[138.0,-16.56],[138.24,-16.72],[139.01,-16.9],[139.25,-17.33],[140.04,-17.7],[140.51,-17.62],[140.83,-17.41],[140.97,-17.01],[141.29,-16.46],[141.41,-16.07],[141.45,-15.61],[141.63,-15.06],[141.52,-14.47],[141.59,-14.15],[141.47,-13.8],[141.65,-13.26],[141.61,-12.94],[141.78,-12.78],[141.92,-12.8],[141.93,-12.74],[141.85,-12.58],[141.68,-12.49],[141.69,-12.35],[141.87,-11.98],[141.96,-12.05],[142.17,-10.95],[142.33,-10.88],[142.46,-10.71],[142.54,-10.71],[142.61,-10.75],[142.55,-10.87],[142.72,-11.01],[142.84,-11.31],[142.87,-11.82],[142.99,-11.92],[143.18,-11.95],[143.11,-12.3],[143.25,-12.4],[143.4,-12.64],[143.59,-13.44],[143.55,-13.74],[143.76,-14.35],[143.96,-14.46],[144.21,-14.3],[144.47,-14.23],[144.65,-14.49],[145.29,-14.94],[145.27,-15.48],[145.46,-16.06],[145.43,-16.41],[145.75,-16.88],[145.91,-16.91],[145.9,-17.07],[146.13,-17.64],[146.03,-18.27],[146.22,-18.51],[146.33,-18.55],[146.3,-18.84],[146.48,-19.08],[147.0,-19.26],[147.14,-19.39],[147.42,-19.38],[147.74,-19.77],[148.37,-20.09],[148.6,-20.15],[148.76,-20.29],[148.88,-20.48],[148.73,-20.47],[148.68,-20.58],[149.2,-21.13],[149.33,-21.48],[149.45,-21.58],[149.52,-22.02],[149.7,-22.44],[149.82,-22.39],[149.97,-22.55],[149.94,-22.31],[149.98,-22.18],[150.08,-22.16],[150.23,-22.37],[150.54,-22.56],[150.57,-22.38],[150.67,-22.42],[150.76,-22.58],[150.84,-23.46],[151.15,-23.78],[151.5,-24.01],[151.83,-24.12],[152.13,-24.6],[152.46,-24.8],[152.65,-25.2],[152.91,-25.43],[152.92,-25.69],[153.03,-25.87],[153.16,-25.96],[153.08,-26.3],[153.16,-26.98],[153.12,-27.19],[153.52,-28.14],[153.38,-28.24],[153.19,-28.26],[153.12,-28.35],[152.75,-28.36],[152.49,-28.26],[151.97,-28.53],[152.07,-28.7],[152.02,-28.87],[151.82,-28.97],[151.73,-28.89],[151.55,-28.96],[151.39,-29.14],[151.23,-28.9],[150.98,-28.71],[150.15,-28.56],[149.51,-28.58],[148.97,-29.0],[141.0,-29.0],[141.0,-26.0]],[[153.28,-24.74],[153.35,-25.06],[153.05,-25.78],[152.98,-25.55],[153.06,-25.3],[153.04,-25.19],[153.23,-25.01],[153.24,-24.92],[153.14,-24.81]],[[151.23,-23.59],[151.3,-23.72],[151.24,-23.78],[151.18,-23.74],[151.03,-23.53],[151.06,-23.46],[151.24,-23.53]],[[146.28,-18.23],[146.34,-18.4],[146.3,-18.48],[146.1,-18.25]],[[139.59,-16.4],[139.7,-16.51],[139.56,-16.53],[139.43,-16.66],[139.16,-16.74],[139.16,-16.63],[139.29,-16.47]]],"TAS":[[[147.31,-43.28],[147.36,-43.4],[147.31,-43.5],[147.15,-43.5],[147.1,-43.41],[147.16,-43.43]],[[148.34,-42.11],[148.33,-42.26],[148.29,-42.26],[148.28,-42.14],[148.18,-42.06],[148.24,-42.02],[148.21,-41.97],[148.02,-42.26],[147.91,-42.66],[147.95,-43.18],[147.79,-43.22],[147.7,-43.12],[147.65,-43.02],[147.77,-43.0],[147.8,-42.93],[147.57,-42.85],[147.54,-43.0],[147.45,-43.03],[147.3,-42.79],[147.35,-42.93],[147.24,-43.22],[147.17,-43.26],[147.0,-43.16],[146.99,-43.22],[147.08,-43.28],[146.87,-43.61],[146.7,-43.6],[146.55,-43.51],[146.04,-43.55],[145.99,-43.38],[146.23,-43.36],[146.21,-43.32],[145.8,-43.24],[145.49,-42.93],[145.27,-42.54],[145.2,-42.23],[145.37,-42.34],[145.47,-42.49],[145.53,-42.39],[145.33,-42.15],[145.23,-42.2],[145.24,-42.02],[144.78,-41.42],[144.65,-40.98],[144.72,-40.67],[145.04,-40.79],[145.28,-40.77],[145.82,-41.02],[146.32,-41.16],[146.72,-41.08],[146.85,-41.17],[146.86,-41.06],[146.99,-40.99],[147.32,-40.96],[147.45,-41.0],[147.62,-40.84],[147.87,-40.87],[148.03,-40.78],[148.29,-40.95],[148.29,-41.82]],[[148.42,-40.37],[148.47,-40.43],[148.35,-40.5],[148.32,-40.43],[148.1,-40.45],[148.01,-40.38],[148.33,-40.31]],[[148.25,-40.1],[148.31,-40.17],[148.11,-40.26],[147.89,-40.01],[147.88,-39.91],[147.77,-39.87],[147.93,-39.73],[148.0,-39.76],[148.3,-39.99]],[[144.12,-39.79],[144.11,-40.02],[143.9,-40.12],[143.84,-39.9],[143.95,-39.58],[144.09,-39.64]]],"VIC":[[[140.97,-38.07],[140.97,-34.01],[141.47,-34.18],[141.76,-34.11],[142.16,-34.17],[142.37,-34.33],[142.43,-34.59],[142.57,-34.78],[142.77,-34.59],[143.33,-34.79],[143.4,-35.17],[143.71,-35.41],[144.16,-35.63],[144.67,-36.09],[144.92,-36.11],[145.01,-35.88],[145.43,-35.83],[146.22,-36.06],[146.47,-35.99],[147.05,-36.11],[147.16,-36.04],[147.32,-36.07],[147.46,-35.95],[147.93,-36.02],[148.2,-36.63],[148.13,-36.78],[149.94,-37.5],[149.48,-37.77],[148.26,-37.83],[147.88,-37.93],[147.4,-38.22],[146.86,-38.66],[146.22,-38.73],[146.34,-38.89],[146.47,-38.84],[146.48,-39.06],[146.4,-39.15],[146.16,-38.87],[146.07,-38.83],[145.94,-38.9],[145.79,-38.67],[145.61,-38.66],[145.4,-38.54],[145.54,-38.39],[145.48,-38.24],[145.29,-38.24],[145.19,-38.38],[144.96,-38.5],[144.72,-38.34],[144.91,-38.34],[145.12,-38.09],[144.89,-37.9],[144.4,-38.14],[144.67,-38.21],[144.1,-38.46],[143.81,-38.7],[143.54,-38.82],[143.23,-38.74],[142.46,-38.39],[142.19,-38.4],[141.92,-38.28],[141.73,-38.27],[141.59,-38.39],[141.42,-38.36],[141.21,-38.17]]],"ACT":[[[149.4,-35.33],[149.19,-35.38],[149.09,-35.61],[149.1,-35.83],[149.05,-35.91],[148.95,-35.89],[148.77,-35.64],[148.83,-35.31],[149.1,-35.15]]],"NSW":[[[141.03,-34.04],[141.0,-29.0],[148.97,-29.0],[149.51,-28.58],[150.15,-28.56],[150.98,-28.71],[151.23,-28.9],[151.39,-29.14],[151.55,-28.96],[151.73,-28.89],[151.82,-28.97],[152.02,-28.87],[152.07,-28.7],[151.97,-28.53],[152.49,-28.26],[152.75,-28.36],[153.12,-28.35],[153.19,-28.26],[153.38,-28.24],[153.52,-28.14],[153.58,-28.24],[153.6,-28.85],[153.35,-29.29],[153.27,-29.89],[153.03,-30.56],[153.05,-30.91],[152.94,-31.43],[152.79,-31.79],[152.56,-32.05],[152.47,-32.44],[152.22,-32.68],[152.14,-32.68],[152.16,-32.76],[151.81,-32.9],[151.48,-33.35],[151.43,-33.52],[151.29,-33.58],[151.28,-33.93],[151.12,-34.01],[151.23,-34.03],[150.96,-34.3],[150.87,-34.5],[150.8,-35.01],[150.7,-35.04],[150.71,-35.12],[150.57,-35.21],[150.2,-35.83],[149.96,-36.85],[149.94,-37.5],[148.13,-36.78],[148.2,-36.63],[147.93,-36.02],[147.46,-35.95],[147.32,-36.07],[147.16,-36.04],[147.05,-36.11],[146.47,-35.99],[146.22,-36.06],[145.43,-35.83],[145.01,-35.88],[144.94,-35.98],[144.96,-36.07],[144.8,-36.13],[144.52,-35.99],[144.16,-35.63],[143.71,-35.41],[143.4,-35.17],[143.33,-34.79],[142.77,-34.59],[142.57,-34.78],[142.43,-34.59],[142.37,-34.33],[142.16,-34.17],[141.76,-34.11],[141.47,-34.18]]]};
  const AU_STATES = [
    { code: "QLD", nem: "QLD1", name: "Queensland",         lbl: [144.6, -22.8] },
    { code: "NSW", nem: "NSW1", name: "New South Wales",    lbl: [146.6, -32.2] },
    { code: "ACT", nem: "NSW1", name: "ACT",                lbl: null },
    { code: "VIC", nem: "VIC1", name: "Victoria",           lbl: [144.0, -36.9] },
    { code: "SA",  nem: "SA1",  name: "South Australia",    lbl: [135.4, -29.6] },
    { code: "TAS", nem: "TAS1", name: "Tasmania",           lbl: [146.6, -42.3] },
    { code: "WA",  nem: null,   name: "Western Australia",  lbl: [122.2, -25.6] },
    { code: "NT",  nem: null,   name: "Northern Territory", lbl: [133.6, -19.4] },
    { code: "JBT", nem: "NSW1", name: "Jervis Bay",         lbl: null },
  ];
  const ATLAS_DEMO = [
    { lat: -34.22, lon: 146.02, label: "Darlington Point Solar", info: "275 MW · PLC-117", status: "ok", kind: "solar" },
    { lat: -34.58, lon: 143.84, label: "Balranald Solar",        info: "120 MW · PLC-118", status: "ok", kind: "solar" },
    { lat: -32.75, lon: 151.48, label: "Hunter Valley BESS",     info: "150 MW / 300 MWh · PLC-201", status: "warn", kind: "bess" },
    { lat: -32.70, lon: 151.52, label: "Hunter Valley Solar",    info: "60 MW · PLC-202", status: "ok", kind: "solar" },
    { lat: -32.63, lon: 151.57, label: "Kurri Switchyard BESS",  info: "50 MW / 100 MWh · PLC-203", status: "ok", kind: "bess" },
    { lat: -35.12, lon: 147.37, label: "Wagga North Solar",      info: "90 MW · PLC-119", status: "err", kind: "solar" },
    { lat: -31.52, lon: 150.68, label: "Liverpool Plains BESS",  info: "100 MW / 200 MWh · PLC-204", status: "ok", kind: "bess" },
    { lat: -29.68, lon: 151.96, label: "New England Solar",      info: "400 MW · PLC-120", status: "ok", kind: "solar" },
    { lat: -27.19, lon: 150.11, label: "Western Downs Solar",    info: "250 MW · PLC-121", status: "ok", kind: "solar" },
    { lat: -27.22, lon: 150.19, label: "Western Downs BESS",     info: "200 MW / 400 MWh · PLC-205", status: "ok", kind: "bess" },
    { lat: -24.87, lon: 152.35, label: "Bundaberg Solar",        info: "80 MW · PLC-122", status: "warn", kind: "solar" },
    { lat: -20.73, lon: 143.14, label: "Hughenden Solar",        info: "70 MW · PLC-123", status: "off", kind: "solar" },
    { lat: -23.38, lon: 150.51, label: "Rockhampton BESS",       info: "50 MW / 100 MWh · PLC-206", status: "ok", kind: "bess" },
    { lat: -36.76, lon: 142.71, label: "Wimmera BESS",           info: "75 MW / 150 MWh · PLC-207", status: "ok", kind: "bess" },
    { lat: -34.19, lon: 142.16, label: "Mildura Solar",          info: "110 MW · PLC-124", status: "ok", kind: "solar" },
    { lat: -36.18, lon: 143.90, label: "Loddon Solar",           info: "40 MW · PLC-125", status: "pending", kind: "solar" },
    { lat: -38.06, lon: 145.98, label: "Gippsland BESS",         info: "300 MW / 600 MWh · PLC-208", status: "ok", kind: "bess" },
    { lat: -34.73, lon: 138.75, label: "Barossa BESS",           info: "100 MW / 200 MWh · PLC-209", status: "err", kind: "bess" },
    { lat: -33.00, lon: 137.56, label: "Port Augusta Solar",     info: "210 MW · PLC-126", status: "ok", kind: "solar" },
    { lat: -32.52, lon: 137.78, label: "Spencer Gulf BESS",      info: "125 MW / 250 MWh · PLC-210", status: "ok", kind: "bess" },
    { lat: -35.23, lon: 140.03, label: "Murraylands Solar",      info: "95 MW · PLC-127", status: "ok", kind: "solar" },
    { lat: -41.23, lon: 146.36, label: "Devonport BESS",         info: "50 MW / 100 MWh · PLC-211", status: "ok", kind: "bess" },
    { lat: -41.45, lon: 147.14, label: "Tamar Solar",            info: "30 MW · PLC-128", status: "warn", kind: "solar" },
    { lat: -31.95, lon: 116.95, label: "Northam Solar",          info: "45 MW · WEM · PLC-129", status: "ok", kind: "solar" },
    { lat: -32.10, lon: 115.95, label: "Kwinana BESS",           info: "100 MW / 200 MWh · WEM · PLC-212", status: "ok", kind: "bess" },
    { lat: -12.46, lon: 130.96, label: "Darwin Solar",           info: "25 MW · PLC-130", status: "ok", kind: "solar" },
  ];

  function atlas(host) {
    if (host.dataset.xatInit) return host._xat;
    host.dataset.xatInit = "1";
    host.classList.add("xat");

    /* ---- DOM: map on the left, list on the right ---- */
    const mapBox = el("div", "xat-map");
    const canvas = el("canvas", "x-canvas xat-canvas");
    canvas.width = 880; canvas.height = 820;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("tabindex", "0");
    const ctl = el("div", "xat-ctl");
    ctl.setAttribute("role", "group"); ctl.setAttribute("aria-label", "Map zoom");
    const mk = (txt, label) => { const b = el("button", "xat-ctlbtn", txt); b.type = "button"; b.setAttribute("aria-label", label); b.setAttribute("data-tip", label); return b; };
    const zin = mk("+", "Zoom in"), zout = mk("−", "Zoom out"), zfit = mk("□", "Fit all");
    ctl.append(zin, zout, zfit);
    const tip = el("div", "xat-tip");
    const hint = el("p", "small muted xat-hint", "hover a marker · click to select · drag to pan · double-click to zoom · +/− and arrows on the keyboard");
    mapBox.append(canvas, ctl, tip, hint);
    const listBox = el("aside", "xat-list");
    const listHead = el("div", "xat-listhead");
    const listTitle = el("span", "label", "Sites");
    const listCount = el("span", "pill");
    listHead.append(listTitle, listCount);
    const filter = el("input", "input input-sm xat-filter");
    filter.type = "search"; filter.placeholder = "Filter sites…"; filter.setAttribute("aria-label", "Filter sites");
    const treeWrap = el("div", "xat-tree");
    const live = el("div", "sr-only"); live.setAttribute("aria-live", "polite");
    listBox.append(listHead, filter, treeWrap, live);
    host.append(mapBox, listBox);

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");

    /* ---- projection: equirectangular, lat-corrected for the plate's middle ---- */
    const plate = AU_PLATE || {};
    const COS = Math.cos((-27 * Math.PI) / 180);
    let bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    const flat = (lon, lat) => ({ x: lon * COS, y: -lat });
    Object.keys(plate).forEach((code) => plate[code].forEach((ring) => ring.forEach(([lon, lat]) => {
      const p = flat(lon, lat);
      if (p.x < bb.x0) bb.x0 = p.x; if (p.x > bb.x1) bb.x1 = p.x;
      if (p.y < bb.y0) bb.y0 = p.y; if (p.y > bb.y1) bb.y1 = p.y;
    })));
    const PAD = 30;
    const base = Math.min((W - PAD * 2) / (bb.x1 - bb.x0), (H - PAD * 2) / (bb.y1 - bb.y0));
    /* view: centre (in flat coords) + zoom factor over the fitted base */
    const home = { cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, z: 1 };
    let view = { cx: home.cx, cy: home.cy, z: 1 }, target = { cx: home.cx, cy: home.cy, z: 1 };
    const proj = (lon, lat) => {
      const p = flat(lon, lat);
      return { x: W / 2 + (p.x - view.cx) * base * view.z, y: H / 2 + (p.y - view.cy) * base * view.z };
    };
    const unproj = (x, y) => ({ fx: (x - W / 2) / (base * view.z) + view.cx, fy: (y - H / 2) / (base * view.z) + view.cy });

    /* ---- which state is a point in? ray-cast against the rings ---- */
    function inRing(lon, lat, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    function stateOf(lon, lat) {
      for (const code of Object.keys(plate)) for (const ring of plate[code]) if (inRing(lon, lat, ring)) return code;
      /* off the coast: nearest state label wins, so an offshore pin still groups */
      let best = null, bd = Infinity;
      for (const s of AU_STATES) { if (!s.lbl) continue; const d = Math.hypot((s.lbl[0] - lon) * COS, s.lbl[1] - lat); if (d < bd) { bd = d; best = s.code; } }
      return best;
    }
    const stateMeta = (code) => AU_STATES.find((s) => s.code === code) || { code: code, name: code, nem: null };
    const stateBBox = (code) => {
      const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      (plate[code] || []).forEach((ring) => ring.forEach(([lon, lat]) => {
        const p = flat(lon, lat);
        if (p.x < b.x0) b.x0 = p.x; if (p.x > b.x1) b.x1 = p.x; if (p.y < b.y0) b.y0 = p.y; if (p.y > b.y1) b.y1 = p.y;
      }));
      return b;
    };

    /* ---- state ---- */
    let points = [], groups = [], hover = -1, selected = -1, hoverRow = -1;
    let dragging = false, dragFrom = null, moved = false, downAt = null;
    let clusters = [];       /* [{x, y, idx:[...]}] in screen space, rebuilt each draw */
    let rafId = 0, animating = false, lastT = 0;

    function statusColor(k, s) {
      return s === "warn" ? k.warn : s === "err" ? k.danger : s === "off" ? k.muted : s === "pending" ? k.accent : k.meter;
    }
    const groupKey = (p) => p.group != null ? String(p.group) : (p.state || "?");
    const groupTitle = (key) => {
      const s = AU_STATES.find((x) => x.code === key);
      return s ? (s.nem ? s.nem + " · " + s.name : s.name + " · not in NEM") : key;
    };

    function ingest(list) {
      points = (list || []).filter((p) => p && isFinite(+p.lat) && isFinite(+p.lon)).map((p, i) => ({
        lat: +p.lat, lon: +p.lon, label: p.label || "SITE " + (i + 1), info: p.info || "",
        status: p.status || "ok", kind: p.kind || "other", group: p.group,
        state: stateOf(+p.lon, +p.lat), i: i,
      }));
      const byG = new Map();
      points.forEach((p) => { const g = groupKey(p); if (!byG.has(g)) byG.set(g, []); byG.get(g).push(p); });
      const order = AU_STATES.map((s) => s.code);
      groups = [...byG.entries()].map(([key, pts]) => ({ key: key, title: groupTitle(key), pts: pts }))
        .sort((a, b) => { const ia = order.indexOf(a.key), ib = order.indexOf(b.key); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.key.localeCompare(b.key); });
      const worst = points.reduce((w, p) => Math.max(w, p.status === "err" ? 3 : p.status === "warn" ? 2 : p.status === "off" ? 1 : 0), 0);
      canvas.setAttribute("aria-label", "Map of Australia with " + points.length + " sites in " + groups.length + " groups" +
        (worst ? "; " + points.filter((p) => p.status === "err").length + " in error, " + points.filter((p) => p.status === "warn").length + " warning, " +
          points.filter((p) => p.status === "off").length + " offline" : "") + ". Use the list beside the map to select a site.");
      listCount.textContent = String(points.length);
      selected = -1; hover = -1;
      buildTree(filter.value);
    }

    /* ---- the list: a real tree, rebuilt (not hidden) when filtered ---- */
    let tree = null;
    function buildTree(q) {
      const needle = (q || "").trim().toLowerCase();
      const ul = el("ul", "tree"); ul.setAttribute("role", "tree"); ul.setAttribute("aria-label", "Sites by region");
      let shown = 0;
      for (const g of groups) {
        const pts = needle ? g.pts.filter((p) => (p.label + " " + p.info + " " + g.title).toLowerCase().indexOf(needle) > -1) : g.pts;
        if (!pts.length) continue;
        const li = el("li"); li.setAttribute("role", "none");
        const row = el("div", "tree-row xat-grow"); row.setAttribute("role", "treeitem");
        row.setAttribute("aria-expanded", needle || groups.length <= 3 ? "true" : "false");
        row.setAttribute("aria-selected", "false");
        row.dataset.group = g.key;
        const twist = el("span", "tree-twist", "▶"); twist.setAttribute("aria-hidden", "true");
        const lab = el("span", "tree-label", g.title);
        const cnt = el("span", "pill xat-gcount", String(pts.length));
        const bad = pts.filter((p) => p.status === "err").length, warn = pts.filter((p) => p.status === "warn").length;
        if (bad) cnt.classList.add("pill-danger"); else if (warn) cnt.classList.add("pill-warn");
        row.append(twist, lab, cnt);
        const sub = el("ul"); sub.setAttribute("role", "group");
        for (const p of pts) {
          const li2 = el("li"); li2.setAttribute("role", "none");
          const r2 = el("div", "tree-row xat-row"); r2.setAttribute("role", "treeitem"); r2.setAttribute("aria-selected", String(p.i === selected));
          r2.dataset.idx = String(p.i);
          const dot = el("span", "xat-dot xat-" + p.status + " xat-k-" + p.kind); dot.setAttribute("aria-hidden", "true");
          const l2 = el("span", "tree-label", p.label);
          const i2 = el("span", "small muted xat-info", p.info);
          const sr = el("span", "sr-only", ", " + p.status + (p.kind !== "other" ? ", " + p.kind : ""));
          r2.append(dot, l2, i2, sr);
          r2.addEventListener("pointerenter", () => { hover = p.i; hoverRow = p.i; requestDraw(); });
          r2.addEventListener("pointerleave", () => { if (hoverRow === p.i) { hover = -1; hoverRow = -1; requestDraw(); } });
          li2.append(r2); sub.append(li2); shown++;
        }
        li.append(row, sub); ul.append(li);
      }
      if (!shown) {
        const empty = el("p", "small muted", needle ? "No sites match “" + q + "”" : "No sites");
        treeWrap.replaceChildren(empty); tree = null; return;
      }
      treeWrap.replaceChildren(ul); tree = ul;
      if (window.vertebra && window.vertebra.tree && window.vertebra.tree.init) window.vertebra.tree.init(ul);
      ul.addEventListener("vertebra:tree", (e) => {
        const r = e.detail.row;
        if (r.dataset.idx != null) select(+r.dataset.idx, true);
        else if (r.dataset.group != null) focusGroup(r.dataset.group);
      });
    }
    filter.addEventListener("input", () => buildTree(filter.value));

    /* ---- selection + framing ---- */
    function select(i, fromList) {
      selected = i;
      if (tree) tree.querySelectorAll(".xat-row").forEach((r) => {
        const on = +r.dataset.idx === i;
        r.setAttribute("aria-selected", String(on));
        if (on && !fromList) { const grp = r.closest("ul[role=group]").previousElementSibling; if (grp) grp.setAttribute("aria-expanded", "true"); r.scrollIntoView({ block: "nearest" }); }
      });
      if (i >= 0) {
        const p = points[i];
        /* bring it into frame: if it is off-screen or the view is wide, step in */
        const s = proj(p.lon, p.lat), fp = flat(p.lon, p.lat);
        if (s.x < 40 || s.x > W - 40 || s.y < 40 || s.y > H - 40 || view.z < 1.6) target = { cx: fp.x, cy: fp.y, z: Math.max(target.z, 2.6) };
        live.textContent = p.label + ", " + p.status + (p.info ? ", " + p.info : "") + ", " + groupTitle(groupKey(p));
      }
      showTip(); requestDraw();
    }
    function focusGroup(key) {
      const g = groups.find((x) => x.key === key);
      if (!g) return;
      let b;
      if (plate[key]) b = stateBBox(key);
      else {
        b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
        g.pts.forEach((p) => { const f = flat(p.lon, p.lat); b.x0 = Math.min(b.x0, f.x); b.x1 = Math.max(b.x1, f.x); b.y0 = Math.min(b.y0, f.y); b.y1 = Math.max(b.y1, f.y); });
      }
      const z = Math.min(6, 0.82 * Math.min((W - PAD * 2) / Math.max(0.5, (b.x1 - b.x0) * base), (H - PAD * 2) / Math.max(0.5, (b.y1 - b.y0) * base)));
      target = { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, z: Math.max(1, z) };
      live.textContent = g.title + ", " + g.pts.length + " sites";
      requestDraw();
    }
    function zoomTo(z, atX, atY) {
      /* Zoom about a screen point so what is under the cursor stays put. The
         anchor is computed against the TARGET transform, not the animating
         view: a second double-click before the first has settled would
         otherwise anchor on a stale frame and walk the map sideways. */
      const nz = Math.max(1, Math.min(10, z));
      if (atX != null) {
        const fx = (atX - W / 2) / (base * target.z) + target.cx;
        const fy = (atY - H / 2) / (base * target.z) + target.cy;
        target = { cx: fx - (atX - W / 2) / (base * nz), cy: fy - (atY - H / 2) / (base * nz), z: nz };
      } else target = { cx: target.cx, cy: target.cy, z: nz };
      if (nz === 1) target = { cx: home.cx, cy: home.cy, z: 1 };
      requestDraw();
    }

    /* ---- drawing ---- */
    function landPath() {
      const path = new Path2D();
      for (const code of Object.keys(plate)) for (const ring of plate[code]) {
        ring.forEach(([lon, lat], i) => { const p = proj(lon, lat); if (i) path.lineTo(p.x, p.y); else path.moveTo(p.x, p.y); });
        path.closePath();
      }
      return path;
    }
    function markerPath(x, y, r, kind) {
      ctx.beginPath();
      if (kind === "bess") { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
      else if (kind === "solar") ctx.rect(x - r, y - r, r * 2, r * 2);
      else ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    function draw(t) {
      const k = tokens();
      ctx.clearRect(0, 0, W, H);
      ctx.font = "500 9px " + mono();
      /* dot-matrix land: clip to the plate, lay a screen-space grid of dots;
         NEM states print darker than the two that are not in the market */
      const path = landPath();
      ctx.save(); ctx.clip(path);
      const step = 7;
      ctx.fillStyle = alpha(k.ink, 0.2);
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      ctx.restore();
      /* lighten the non-NEM states by washing their dots back toward the ground */
      for (const code of ["WA", "NT"]) {
        if (!plate[code]) continue;
        const pth = new Path2D();
        for (const ring of plate[code]) { ring.forEach(([lon, lat], i) => { const p = proj(lon, lat); if (i) pth.lineTo(p.x, p.y); else pth.moveTo(p.x, p.y); }); pth.closePath(); }
        ctx.fillStyle = alpha(k.bgAlt, 0.55); ctx.fill(pth);
      }
      /* borders and coast */
      ctx.strokeStyle = alpha(k.ink, 0.62); ctx.lineWidth = 1; ctx.lineJoin = "round";
      ctx.stroke(path);
      /* state labels, NEM id first because that is what the market calls them */
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const s of AU_STATES) {
        if (!s.lbl) continue;
        const p = proj(s.lbl[0], s.lbl[1]);
        if (p.x < -40 || p.x > W + 40 || p.y < -20 || p.y > H + 20) continue;
        ctx.font = "700 " + (s.nem ? 11 : 10) + "px " + mono();
        ctx.fillStyle = alpha(s.nem ? k.ink : k.muted, s.nem ? 0.8 : 0.7);
        ctx.fillText(s.nem || s.code, p.x, p.y);
        if (s.nem) { ctx.font = "500 8px " + mono(); ctx.fillStyle = alpha(k.muted, 0.9); ctx.fillText(s.name.toUpperCase(), p.x, p.y + 12); }
      }
      /* cluster: pins within R px share a marker. R SHRINKS WITH ZOOM -- a
         solar farm and its co-located battery sit ~0.08 deg apart, which is
         under 2px at fit, and a fixed radius would keep them stacked until the
         very last zoom step. At 6x they are 10px apart and R has come down to
         5, so they separate where you would expect them to. */
      clusters = [];
      const R = Math.max(5, 11 - 1.2 * (view.z - 1));
      points.forEach((p) => {
        const s = proj(p.lon, p.lat);
        if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) return;
        let home2 = null;
        for (const c of clusters) if (Math.hypot(c.x - s.x, c.y - s.y) < R) { home2 = c; break; }
        if (home2) { home2.idx.push(p.i); home2.x = (home2.x * (home2.idx.length - 1) + s.x) / home2.idx.length; home2.y = (home2.y * (home2.idx.length - 1) + s.y) / home2.idx.length; }
        else clusters.push({ x: s.x, y: s.y, idx: [p.i] });
      });
      ctx.textBaseline = "alphabetic";
      for (const c of clusters) {
        const members = c.idx.map((i) => points[i]);
        const lead = members.find((p) => p.i === selected) || members.find((p) => p.i === hover) ||
          members.slice().sort((a, b) => ({ err: 0, warn: 1, pending: 2, off: 3, ok: 4 })[a.status] - ({ err: 0, warn: 1, pending: 2, off: 3, ok: 4 })[b.status])[0];
        const col = statusColor(k, lead.status);
        const hot = c.idx.indexOf(hover) > -1, sel = c.idx.indexOf(selected) > -1;
        const r = (hot || sel ? 6 : 4.5) + (members.length > 1 ? 1 : 0);
        /* ping only the ones that need a human: warn and err */
        if (!reducedMotion.matches && (lead.status === "warn" || lead.status === "err")) {
          const ping = ((t + lead.i * 0.37) % 1.8) / 1.8;
          ctx.strokeStyle = alpha(col, (1 - ping) * 0.55); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(c.x, c.y, r + ping * 14, 0, Math.PI * 2); ctx.stroke();
        }
        /* halo so the marker reads over dots and borders */
        ctx.fillStyle = alpha(k.bgAlt, 0.85);
        ctx.beginPath(); ctx.arc(c.x, c.y, r + 3.5, 0, Math.PI * 2); ctx.fill();
        markerPath(c.x, c.y, r, members.length > 1 ? "other" : lead.kind);
        if (lead.status === "off") { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); }
        else if (lead.status === "pending") { ctx.setLineDash([2, 2]); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.fillStyle = col; ctx.fill(); }
        if (hot || sel) { ctx.strokeStyle = alpha(k.ink, 0.9); ctx.lineWidth = 1.2; markerPath(c.x, c.y, r + 3, members.length > 1 ? "other" : lead.kind); ctx.stroke(); }
        if (members.length > 1) {
          ctx.font = "700 10px " + mono(); ctx.lineWidth = 3; ctx.strokeStyle = k.bgAlt; ctx.textAlign = "left";
          ctx.strokeText(String(members.length), c.x + r + 3, c.y - r + 2);
          ctx.fillStyle = k.ink; ctx.fillText(String(members.length), c.x + r + 3, c.y - r + 2);
          ctx.lineWidth = 1;
        }
      }
      /* scale + zoom readout */
      ctx.font = "500 9px " + mono(); ctx.fillStyle = alpha(k.muted, 0.9); ctx.textAlign = "right";
      ctx.fillText((view.z === 1 ? "FIT" : view.z.toFixed(1) + "×") + "  ·  " + points.length + " SITES", W - 10, H - 10);
    }

    /* animate the view toward its target; idle when settled and nothing pings */
    function requestDraw() { if (!rafId) rafId = requestAnimationFrame(frame); }
    function frame(now) {
      rafId = 0;
      const t = now / 1000;
      /* data-xat-instant on the host snaps instead of easing -- for a static
         embed, a screenshot, or a test that cannot wait on throttled frames */
      const ease = (reducedMotion.matches || host.hasAttribute("data-xat-instant")) ? 1 : 0.16;
      view.cx += (target.cx - view.cx) * ease; view.cy += (target.cy - view.cy) * ease; view.z += (target.z - view.z) * ease;
      const settled = Math.abs(target.z - view.z) < 0.002 && Math.abs(target.cx - view.cx) * base * view.z < 0.3 && Math.abs(target.cy - view.cy) * base * view.z < 0.3;
      if (settled) { view.cx = target.cx; view.cy = target.cy; view.z = target.z; }
      draw(t);
      if (hover >= 0 || selected >= 0) showTip();
      const pinging = !reducedMotion.matches && points.some((p) => p.status === "warn" || p.status === "err");
      if (!settled || pinging) rafId = requestAnimationFrame(frame);
    }

    /* ---- tooltip: one site, or every member of a stack ---- */
    function showTip() {
      const i = hover >= 0 ? hover : selected;
      if (i < 0) { tip.style.display = "none"; return; }
      const c = clusters.find((cl) => cl.idx.indexOf(i) > -1);
      if (!c) { tip.style.display = "none"; return; }
      tip.innerHTML = "";
      const members = c.idx.map((j) => points[j]);
      if (members.length === 1) {
        const p = members[0];
        tip.append(el("strong", null, p.label));
        if (p.info) tip.append(el("span", null, p.info));
        tip.append(el("span", "xat-tipstatus xat-" + p.status, p.status.toUpperCase() + (p.kind !== "other" ? " · " + p.kind.toUpperCase() : "")));
      } else {
        tip.append(el("strong", null, members.length + " sites here"));
        members.slice(0, 6).forEach((p) => { const s = el("span", null, p.label); s.prepend(el("i", "xat-dot xat-" + p.status)); tip.append(s); });
        if (members.length > 6) tip.append(el("span", "muted", "+" + (members.length - 6) + " more · zoom in"));
      }
      const rect = canvas.getBoundingClientRect(), sx = rect.width / W, sy = rect.height / H;
      tip.style.display = "grid";
      tip.style.left = Math.max(90, Math.min(rect.width - 90, c.x * sx)) + "px";
      tip.style.top = Math.max(6, c.y * sy - 14) + "px";
    }

    /* ---- pointer ---- */
    const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
    function hitTest(x, y) {
      let best = -1, bd = 14;
      for (const c of clusters) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c.idx[0]; } }
      return best;
    }
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; moved = false; dragFrom = toCanvas(e); downAt = { cx: target.cx, cy: target.cy };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = toCanvas(e);
      if (dragging && dragFrom) {
        const dx = p.x - dragFrom.x, dy = p.y - dragFrom.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (moved) { target = { cx: downAt.cx - dx / (base * view.z), cy: downAt.cy - dy / (base * view.z), z: target.z }; view.cx = target.cx; view.cy = target.cy; requestDraw(); }
        return;
      }
      const h = hitTest(p.x, p.y);
      if (h !== hover) { hover = h; hoverRow = -1; if (tree) tree.querySelectorAll(".xat-row").forEach((r) => r.classList.toggle("xat-hot", +r.dataset.idx === h)); showTip(); requestDraw(); }
      canvas.style.cursor = h >= 0 ? "pointer" : dragging ? "grabbing" : "grab";
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      if (moved) return;
      const p = toCanvas(e), h = hitTest(p.x, p.y);
      select(h, false);
    });
    canvas.addEventListener("pointerleave", () => { dragging = false; if (hover >= 0) { hover = -1; if (tree) tree.querySelectorAll(".xat-hot").forEach((r) => r.classList.remove("xat-hot")); showTip(); requestDraw(); } });
    canvas.addEventListener("dblclick", (e) => { const p = toCanvas(e); zoomTo(target.z * 1.8, p.x, p.y); });
    zin.addEventListener("click", () => zoomTo(target.z * 1.6));
    zout.addEventListener("click", () => zoomTo(target.z / 1.6));
    zfit.addEventListener("click", () => zoomTo(1));
    canvas.addEventListener("keydown", (e) => {
      const pan = 40 / (base * view.z);
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(target.z * 1.6); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomTo(target.z / 1.6); }
      else if (e.key === "0") { e.preventDefault(); zoomTo(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); target.cx -= pan; requestDraw(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); target.cx += pan; requestDraw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); target.cy -= pan; requestDraw(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); target.cy += pan; requestDraw(); }
      else if (e.key === "Escape") { select(-1); }
    });

    const api = {
      set: (pts) => { ingest(pts); requestDraw(); return api; },
      select: (which) => { const i = typeof which === "number" ? which : points.findIndex((p) => p.label === which); select(i, false); return api; },
      focus: (key) => { if (key == null) zoomTo(1); else focusGroup(key); return api; },
      points: () => points.map((p) => Object.assign({}, p)),
      /* the current frame, so an app can persist and restore where the user left the map */
      view: () => ({ cx: view.cx, cy: view.cy, z: view.z, target: Object.assign({}, target),
        settled: Math.abs(target.z - view.z) < 0.002 && Math.abs(target.cx - view.cx) * base * view.z < 0.3 && Math.abs(target.cy - view.cy) * base * view.z < 0.3,
        clusters: clusters.map((c) => ({ x: c.x, y: c.y, n: c.idx.length })) }),
      destroy: () => { liveRenders.delete(requestDraw); if (rafId) cancelAnimationFrame(rafId); host.innerHTML = ""; delete host.dataset.xatInit; },
    };
    host._xat = api;

    let initial = null;
    try { initial = JSON.parse(host.getAttribute("data-x-atlas") || "null"); } catch (e) { initial = null; }
    if (initial && !Array.isArray(initial) && Array.isArray(initial.points)) initial = initial.points;
    if (!Array.isArray(initial) || !initial.length) initial = ATLAS_DEMO;
    api.set(initial);
    liveRenders.add(requestDraw);
    return api;
  }

  /* ---------- pyramid ----------
     Tiered data as a pyramid, three ways. Tiers run apex → base:
       <div data-x-pyramid='{"series":["GIRLS","BOYS"],"tiers":[
         {"label":"ELITE","value":24,"a":9,"b":15,"info":"national squad"}, …]}'></div>
     A bare array of tiers also works. value = tier size; a/b = an optional
     two-series split (named by series) that enables the mirror view; info =
     a tooltip line. Views (in-frame toggle, keys 1 2 3):
       terrace  — one silhouette where each band's AREA is its share, so the
                  picture is honest (equal slabs would not be);
       mirror   — every tier split into its two series around a centre axis,
                  the population-pyramid reading;
       ziggurat — a stepped 2.5D monument, one terrace per tier, same areas;
                  drag or ←/→ to turn, it idles round on its own.
     Hover a tier for its readout; click or ↑/↓ pins it
     (vertebraX.pyramid(el).select(i)); Enter / Space toggles the pin on the
     hovered tier; Escape clears. Reduced motion: no reveal, no spin, redraws
     only on interaction. Empty attribute → athlete pathway demo. */
  const PYRAMID_DEMO = {
    series: ["GIRLS", "BOYS"],
    tiers: [
      { label: "ELITE", value: 24, a: 9, b: 15, info: "national squad" },
      { label: "NATIONAL", value: 180, a: 70, b: 110, info: "national championships" },
      { label: "STATE", value: 1100, a: 460, b: 640, info: "state titles" },
      { label: "CLUB", value: 6400, a: 2900, b: 3500, info: "registered competitors" },
      { label: "PARTICIPATION", value: 22000, a: 11200, b: 10800, info: "programme entrants" },
    ],
  };
  const PYRAMID_MODES = ["terrace", "mirror", "ziggurat"];

  function pyramid(host) {
    if (host.dataset.xpyInit) return host._xpy;
    host.dataset.xpyInit = "1";
    host.classList.add("xpy");

    /* ---- frame ---- */
    const view = el("div", "xpy-view");
    view.setAttribute("role", "group");
    view.setAttribute("aria-label", "Chart view");
    const btns = {};
    PYRAMID_MODES.forEach((m, i) => {
      const b = el("button", "xpy-viewbtn", m);
      b.type = "button";
      b.setAttribute("aria-label", m.charAt(0).toUpperCase() + m.slice(1) + " view (key " + (i + 1) + ")");
      b.setAttribute("data-tip", m.charAt(0).toUpperCase() + m.slice(1) + " · " + (i + 1));
      b.addEventListener("click", () => { setMode(m); canvas.focus({ preventScroll: true }); });
      btns[m] = b;
      view.append(b);
    });
    const canvas = el("canvas", "x-canvas xpy-canvas");
    canvas.width = 1120; canvas.height = 540;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    const read = el("p", "small xpy-read");
    read.setAttribute("aria-live", "polite");
    read.id = "xpy-read-" + Math.random().toString(36).slice(2, 8);
    canvas.setAttribute("aria-describedby", read.id);   /* the keyboard hint reads with the chart */
    const tip = el("div", "xpy-tip");
    host.append(view, canvas, read, tip);
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const mono = () => (getComputedStyle(root).getPropertyValue("--font-mono").trim() || "monospace");
    const fmt = (v) => Math.round(v).toLocaleString("en-US");
    const pct = (f) => { const p = f * 100; return (p >= 10 || p === Math.round(p) ? Math.round(p) : p.toFixed(1)) + "%"; };

    /* ---- state ---- */
    let series = ["A", "B"], tiers = [], total = 1, split = false;
    let mode = "terrace", sel = -1, hover = -1;
    let yaw = 0.62, yawTarget = 0.62, spinning = !reducedMotion.matches, dragging = false, dragFrom = 0, dragYaw = 0, moved = false;
    let born = null, alive = true, rafId = 0, running = false, shapes = [], labelZones = [], labelCol = W;
    let MONOF = "monospace";                             /* resolved once per draw, not per glyph */

    function ingest(raw) {
      let d = raw;
      if (d && !Array.isArray(d) && Array.isArray(d.tiers)) {
        if (Array.isArray(d.series) && d.series.length >= 2) series = [String(d.series[0]), String(d.series[1])];
        d = d.tiers;
      }
      if (!Array.isArray(d) || d.length < 2 || d.length > 12 ||
          d.some((t) => !t || typeof t.value !== "number" || !(t.value >= 0))) {
        d = PYRAMID_DEMO.tiers; series = PYRAMID_DEMO.series.slice();
      }
      tiers = d.map((t, i) => ({
        label: String(t.label == null ? "TIER " + (i + 1) : t.label).toUpperCase(),
        value: t.value,
        a: typeof t.a === "number" && t.a >= 0 ? t.a : null,
        b: typeof t.b === "number" && t.b >= 0 ? t.b : null,
        info: t.info == null ? "" : String(t.info),
      }));
      total = tiers.reduce((s, t) => s + t.value, 0) || 1;
      let cum = 0;
      tiers.forEach((t) => { t.share = t.value / total; cum += t.value; t.cum = cum / total; });
      split = tiers.every((t) => t.a !== null && t.b !== null);
      btns.mirror.hidden = !split;
      if (!split && mode === "mirror") mode = "terrace";
      if (sel >= tiers.length) sel = -1;
      hover = -1; shapes = []; labelZones = [];           /* stale geometry must never index the new tiers */
      hideTip();
      canvas.setAttribute("aria-label", "Pyramid chart, " + tiers.length + " tiers from apex to base: " +
        tiers.map((t) => t.label + " " + fmt(t.value) + " (" + pct(t.share) + ")").join("; "));
      syncBtns();
      paintRead();
    }

    function setMode(m) {
      if (PYRAMID_MODES.indexOf(m) < 0 || (m === "mirror" && !split) || m === mode) return;
      mode = m; hover = -1; shapes = []; labelZones = []; hideTip(); syncBtns(); paintRead(); requestDraw();
    }
    function syncBtns() {
      PYRAMID_MODES.forEach((m) => btns[m].setAttribute("aria-pressed", String(m === mode)));
      canvas.classList.toggle("xpy-grab", mode === "ziggurat");
    }
    function select(i) {
      sel = i >= 0 && i < tiers.length ? i : -1;
      paintRead(); requestDraw();
    }

    /* the DOM readout: the pinned tier, else the hovered one, else a hint */
    function paintRead() {
      const i = sel >= 0 ? sel : hover;
      read.textContent = "";
      if (i < 0 || !tiers[i]) {
        read.textContent = "hover a tier · click or ↑ ↓ pins it · Esc clears · " + (split ? "1 2 3" : "1 3") + " switch view" +
          (mode === "ziggurat" ? " · drag or ← → to turn · R spins" : "");
        return;
      }
      const t = tiers[i], below = tiers[i + 1];
      read.append(el("strong", null, t.label), document.createTextNode(" · " + fmt(t.value) + " · " + pct(t.share) + " of " + fmt(total)));
      if (i > 0) read.append(document.createTextNode(" · to here " + pct(t.cum)));
      if (below && below.value > 0) read.append(document.createTextNode(" · " + pct(t.value / below.value) + " of " + below.label));
      if (split) read.append(document.createTextNode(" · " + series[0] + " " + fmt(t.a) + " / " + series[1] + " " + fmt(t.b)));
      if (sel >= 0) read.append(document.createTextNode(" · pinned"));
    }

    /* ---- tooltip (kit-styled, DOM) ---- */
    function showTip(i, x, y) {
      const t = tiers[i], below = tiers[i + 1];
      if (!t) { hideTip(); return; }
      tip.textContent = "";
      tip.append(el("strong", null, t.label));
      tip.append(el("span", null, fmt(t.value) + " · " + pct(t.share) + " of total"));
      if (below && below.value > 0) tip.append(el("span", null, pct(t.value / below.value) + " of " + below.label + " reach here"));
      if (split) {
        const ab = t.a + t.b || 1;
        tip.append(el("span", null, series[0] + " " + fmt(t.a) + " (" + pct(t.a / ab) + ") · " + series[1] + " " + fmt(t.b) + " (" + pct(t.b / ab) + ")"));
      }
      if (t.info) tip.append(el("span", "muted", t.info));
      const rect = canvas.getBoundingClientRect(), sx = rect.width / W, sy = rect.height / H;
      tip.style.display = "grid";
      tip.style.left = Math.max(90, Math.min(rect.width - 90, x * sx)) + "px";
      tip.style.top = Math.max(6, y * sy - 14 + canvas.offsetTop) + "px";
    }
    function hideTip() { tip.style.display = "none"; }

    /* ---- shared drawing helpers ---- */
    function poly(pts) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }
    function inPoly(pts, x, y) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    /* band tone: apex strongest, base softest — never below legibility */
    const tone = (i) => Math.max(0.42, 0.95 - i * (0.5 / Math.max(1, tiers.length - 1)));
    const hot = (i) => i === sel || i === hover;
    function bandFill(k, i) {
      if (hot(i)) return alpha(k.accent, 0.95);
      return alpha(k.meter, tone(i));
    }
    function onBandInk(k, i) { return hot(i) || tone(i) >= 0.62 ? k.bg : k.ink; }
    function reveal(t) { return reducedMotion.matches ? 1 : Math.min(1, t / 1.1); }
    const easeOut = (u) => 1 - Math.pow(1 - u, 3);

    /* where the right-hand label column may start: below the in-frame view
       toggle when the column runs under it (both measured in CSS px, so this
       holds at any canvas width) */
    function labelTop(labX) {
      const cb = canvas.getBoundingClientRect(), tb = view.getBoundingClientRect();
      if (!cb.width || !tb.width) return 64;
      const togLeft = (tb.left - cb.left) * (W / cb.width) - 24;
      if (labX < togLeft) return 20;
      return (tb.bottom - cb.top) * (H / cb.height) + 12;
    }
    /* keep a column of labels at least `gap` apart inside [lo, hi] */
    function spread(ys, lo, hi, gap) {
      const out = ys.slice();
      for (let i = 1; i < out.length; i++) if (out[i] < out[i - 1] + gap) out[i] = out[i - 1] + gap;
      if (out.length && out[out.length - 1] > hi) {
        out[out.length - 1] = hi;
        for (let i = out.length - 2; i >= 0; i--) if (out[i] > out[i + 1] - gap) out[i] = out[i + 1] - gap;
      }
      if (out.length && out[0] < lo) { const d = lo - out[0]; for (let i = 0; i < out.length; i++) out[i] += d; }
      return out;
    }
    /* right-hand label column with a leader line to the shape */
    function sideLabel(k, i, fromX, fromY, labX, labY, big) {
      ctx.strokeStyle = hot(i) ? k.accent : k.line;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(labX - 10, labY); ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = "600 11px " + MONOF;
      ctx.fillStyle = hot(i) ? k.accent : k.ink;
      ctx.fillText(tiers[i].label, labX, labY - 3);
      ctx.font = "500 11px " + MONOF;
      ctx.fillStyle = k.muted;
      ctx.fillText(fmt(tiers[i].value) + (big ? "" : " · " + pct(tiers[i].share)), labX, labY + 11);
    }

    /* ---- terrace: one silhouette, band area = share ---- */
    function drawTerrace(t) {
      const k = tokens();
      const n = tiers.length;
      const top = 44, base = H - 48, Hp = base - top;
      const cx = W * 0.42, halfW = Math.min(W * 0.3, Hp * 0.9);
      const labX = cx + halfW + 36;
      const r = easeOut(reveal(t));
      const hw = (d) => (halfW * d) / Hp;
      shapes = [];
      ctx.clearRect(0, 0, W, H);
      ctx.font = "500 11px " + MONOF;
      /* baseline */
      ctx.strokeStyle = k.grid;
      ctx.beginPath(); ctx.moveTo(cx - halfW - 24, base + 0.5); ctx.lineTo(W - 16, base + 0.5); ctx.stroke();
      const anchors = [];
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const d0 = Hp * Math.sqrt(prev), d1 = Hp * Math.sqrt(tiers[i].cum);
        prev = tiers[i].cum;
        /* reveal: the whole silhouette grows out of its base */
        const y0 = base - (base - (top + d0)) * r, y1 = base - (base - (top + d1)) * r;
        const w0 = hw(d0) * r, w1 = hw(d1) * r;
        const pts = [[cx - w0, y0], [cx + w0, y0], [cx + w1, y1], [cx - w1, y1]];
        shapes.push({ i: i, pts: pts, y0: y0, y1: y1 });
        poly(pts);
        ctx.fillStyle = bandFill(k, i); ctx.fill();
        ctx.strokeStyle = alpha(k.bg, 0.6); ctx.lineWidth = 1; ctx.stroke();
        /* share inside when the band is thick enough; label column always */
        const thick = y1 - y0, midY = (y0 + y1) / 2;
        const big = thick >= 26 && w1 > 40;
        if (big && r > 0.6) {
          ctx.font = "700 " + Math.min(24, thick * 0.62) + "px " + MONOF;
          ctx.textAlign = "center";
          ctx.fillStyle = onBandInk(k, i);
          ctx.fillText(pct(tiers[i].share), cx, midY + Math.min(24, thick * 0.62) * 0.36);
        }
        anchors.push([cx + hw((d0 + d1) / 2) * r + 2, midY, big]);
      }
      const ys = spread(anchors.map((a) => a[1]), labelTop(labX), base - 10, 28);
      labelCol = labX; labelZones = ys;
      anchors.forEach((a, i) => sideLabel(k, i, a[0], a[1], labX, ys[i], a[2]));
      /* apex / base captions */
      ctx.textAlign = "left";
      ctx.font = "500 10px " + MONOF;
      ctx.fillStyle = k.muted;
      ctx.fillText("APEX", 16, top + 4);
      ctx.fillText("BASE · " + fmt(total) + " total · area = share", 16, base + 16);
    }

    /* ---- mirror: two series back to back, one row per tier ---- */
    function drawMirror(t) {
      const k = tokens();
      const n = tiers.length;
      const top = 58, bottom = H - 40, rowH = (bottom - top) / n;
      const maxAB = Math.max(1, ...tiers.map((x) => Math.max(x.a, x.b)));
      const r = easeOut(reveal(t));
      shapes = []; labelZones = [];
      ctx.clearRect(0, 0, W, H);
      ctx.font = "500 11px " + MONOF;
      /* the longest bar still leaves room for its value at the edge */
      const reserve = Math.max(...tiers.map((x) => Math.max(ctx.measureText(fmt(x.a)).width, ctx.measureText(fmt(x.b)).width))) + 18;
      const cx = W / 2, gutter = 92, maxLen = cx - gutter - reserve - 12;
      ctx.font = "600 11px " + MONOF;
      /* series headers + centre axis */
      ctx.textAlign = "right"; ctx.fillStyle = alpha(k.u1, 1); ctx.fillText(series[0], cx - gutter, top - 22);
      ctx.textAlign = "left"; ctx.fillStyle = alpha(k.u2, 1); ctx.fillText(series[1], cx + gutter, top - 22);
      ctx.strokeStyle = k.grid;
      ctx.beginPath(); ctx.moveTo(cx - gutter, top - 8); ctx.lineTo(cx - gutter, bottom); ctx.moveTo(cx + gutter, top - 8); ctx.lineTo(cx + gutter, bottom); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const y0 = top + i * rowH + 6, y1 = top + (i + 1) * rowH - 6, midY = (y0 + y1) / 2;
        const la = (tiers[i].a / maxAB) * maxLen * r, lb = (tiers[i].b / maxAB) * maxLen * r;
        const rowPts = [[cx - gutter - maxLen - 8, y0 - 6], [cx + gutter + maxLen + 8, y0 - 6], [cx + gutter + maxLen + 8, y1 + 6], [cx - gutter - maxLen - 8, y1 + 6]];
        shapes.push({ i: i, pts: rowPts, y0: y0, y1: y1 });
        if (hot(i)) { poly(rowPts); ctx.fillStyle = alpha(k.ink, 0.06); ctx.fill(); }
        /* bars */
        ctx.fillStyle = alpha(k.u1, hot(i) ? 1 : 0.78);
        ctx.fillRect(cx - gutter - la, y0, la, y1 - y0);
        ctx.fillStyle = alpha(k.u2, hot(i) ? 1 : 0.78);
        ctx.fillRect(cx + gutter, y0, lb, y1 - y0);
        /* centre label + values at the bar ends */
        ctx.textAlign = "center";
        ctx.font = "600 11px " + MONOF;
        ctx.fillStyle = hot(i) ? k.accent : k.ink;
        ctx.fillText(tiers[i].label, cx, midY - 2);
        ctx.font = "500 10px " + MONOF;
        ctx.fillStyle = k.muted;
        ctx.fillText(fmt(tiers[i].value) + " · " + pct(tiers[i].share), cx, midY + 12);
        if (r > 0.6) {
          ctx.font = "500 11px " + MONOF;
          ctx.fillStyle = k.muted;
          ctx.textAlign = "right"; ctx.fillText(fmt(tiers[i].a), cx - gutter - la - 8, midY + 4);
          ctx.textAlign = "left"; ctx.fillText(fmt(tiers[i].b), cx + gutter + lb + 8, midY + 4);
        }
      }
      ctx.textAlign = "left";
      ctx.font = "500 10px " + MONOF;
      ctx.fillStyle = k.muted;
      ctx.fillText("bars share one scale · " + fmt(maxAB) + " = full width", 16, H - 14);
    }

    /* ---- ziggurat: stepped 2.5D stack, footprint area = cumulative share ---- */
    function drawZiggurat(t) {
      const k = tokens();
      const n = tiers.length;
      const r = easeOut(reveal(t));
      const cx = W * 0.44, cy = H * 0.56;
      const S = Math.min(W * 0.46, H * 0.95);             /* base footprint side */
      const stepH = Math.min(46, (H * 0.5) / n);           /* equal step heights: the data is in the footprint */
      const DEPTH = 0.46;                                  /* how far the depth axis leans down the screen */
      const labX = cx + S * 0.58 + 40;
      const project = (x, y, z) => {
        const xr = x * Math.cos(yaw) - z * Math.sin(yaw);
        const zr = x * Math.sin(yaw) + z * Math.cos(yaw);
        return [cx + xr, cy - y + zr * DEPTH, zr];
      };
      const lightA = -2.3;                                 /* light from the front-left */
      shapes = [];
      ctx.clearRect(0, 0, W, H);
      /* ground shadow */
      const g = S * 0.56;
      ctx.fillStyle = alpha(k.ink, 0.06);
      ctx.beginPath(); ctx.ellipse(cx, cy + 8, g * 1.05, g * DEPTH * 1.05, 0, 0, Math.PI * 2); ctx.fill();
      const faces = [], anchors = [];                      /* faces for hit testing, top slab first */
      for (let i = n - 1; i >= 0; i--) {
        const side = S * Math.sqrt(tiers[i].cum) * r;
        const half = side / 2;
        const yb = (n - 1 - i) * stepH * r, yt = yb + stepH * r;
        /* square corners at 45° offsets so a face always faces somewhere */
        const corners = [0, 1, 2, 3].map((c) => { const a = Math.PI / 4 + (c * Math.PI) / 2; return [Math.cos(a) * half * Math.SQRT2, Math.sin(a) * half * Math.SQRT2]; }); /* half-diagonal → corners at (±half, ±half) */
        const base2 = corners.map((c) => project(c[0], yb, c[1]));
        const top2 = corners.map((c) => project(c[0], yt, c[1]));
        const slabFaces = [];
        for (let c = 0; c < 4; c++) {
          const d = (c + 1) % 4;
          const nz = (base2[c][2] + base2[d][2]) / 2;      /* face midpoint depth: positive = toward the viewer */
          if (nz <= 0) continue;
          const nx = (base2[c][0] + base2[d][0]) / 2 - cx;
          const normA = Math.atan2(nz, nx);
          const light = 0.5 + 0.5 * Math.max(0, Math.cos(normA - lightA));
          const pts = [[base2[c][0], base2[c][1]], [base2[d][0], base2[d][1]], [top2[d][0], top2[d][1]], [top2[c][0], top2[c][1]]];
          poly(pts);
          ctx.fillStyle = bandFill(k, i); ctx.fill();
          ctx.fillStyle = alpha(k.ink, (1 - light) * 0.42); ctx.fill();
          ctx.strokeStyle = alpha(k.bg, 0.5); ctx.lineWidth = 1; ctx.stroke();
          slabFaces.push(pts);
        }
        const topPts = top2.map((p) => [p[0], p[1]]);
        poly(topPts);
        ctx.fillStyle = bandFill(k, i); ctx.fill();
        ctx.fillStyle = alpha(k.bg, 0.18); ctx.fill();   /* lit from above */
        ctx.strokeStyle = alpha(k.bg, 0.6); ctx.stroke();
        slabFaces.push(topPts);
        faces.unshift({ i: i, pts: slabFaces });
        /* label anchor: the slab's nearest corner, at mid-height */
        let near = base2[0];
        base2.forEach((p) => { if (p[2] > near[2]) near = p; });
        anchors[i] = [near[0] + 4, near[1] - (stepH * r) / 2];
      }
      shapes = faces.map((f) => ({ i: f.i, polys: f.pts }));
      const ys = spread(anchors.map((a) => a[1]), labelTop(labX), H - 30, 28);
      labelCol = labX; labelZones = ys;
      anchors.forEach((a, i) => sideLabel(k, i, a[0], a[1], labX, ys[i], false));
      ctx.textAlign = "left";
      ctx.font = "500 10px " + MONOF;
      ctx.fillStyle = k.muted;
      ctx.fillText("footprint area = share to that tier · equal steps · drag to turn", 16, H - 14);
    }

    function draw(t) {
      MONOF = mono();
      if (mode === "mirror") drawMirror(t);
      else if (mode === "ziggurat") drawZiggurat(t);
      else drawTerrace(t);
    }

    /* ---- render loop: runs only while something moves (reveal, spin, a
       turn settling); every interaction kicks it, it idles when still.
       Reduced motion: no loop at all — draws happen synchronously. ---- */
    let lastT = 0, needDraw = true;
    function kick() {
      if (reducedMotion.matches || running || !alive) return;
      running = true; rafId = requestAnimationFrame(frame);
    }
    function requestDraw() {
      needDraw = true;
      if (!alive) return;
      if (reducedMotion.matches) { lastT = 10; draw(lastT); needDraw = false; return; }
      kick();
    }
    function frame(now) {
      running = false;
      if (!alive) return;
      if (born === null) born = now;
      lastT = (now - born) / 1000;
      let moving = lastT < 1.3;
      if (mode === "ziggurat") {
        if (spinning && !dragging && hover < 0) yawTarget += 0.0035;
        const d = yawTarget - yaw;
        if (Math.abs(d) > 0.0004) { yaw += d * 0.14; needDraw = true; moving = true; }
        else if (yaw !== yawTarget) { yaw = yawTarget; needDraw = true; }
        if (spinning && !dragging && hover < 0) moving = true;
      }
      if (needDraw || moving) { draw(lastT); needDraw = false; }
      if (moving) kick();
    }
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) { if (rafId) cancelAnimationFrame(rafId); running = false; spinning = false; }
      else { born = null; spinning = true; }
      requestDraw();
    });
    liveRenders.add(requestDraw);

    /* ---- pointer ---- */
    const toCanvas = (e) => { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; };
    function hitTest(x, y) {
      /* the label column: whichever label row the pointer is on */
      if (labelZones.length && x >= labelCol - 14 && x < W - 6) {
        let best = -1, bd = 15;
        labelZones.forEach((ly, i) => { const d = Math.abs(y - ly + 3); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) return best;
      }
      for (const s of shapes) {
        if (s.polys) { if (s.polys.some((p) => inPoly(p, x, y))) return s.i; }
        else if (s.pts && y >= s.y0 - 2 && y <= s.y1 + 2 && inPoly(s.pts, x, y)) return s.i;
      }
      return -1;
    }
    canvas.addEventListener("pointermove", (e) => {
      const p = toCanvas(e);
      if (dragging) {
        const dx = p.x - dragFrom;
        if (Math.abs(dx) > 3) moved = true;
        yawTarget = dragYaw + dx * 0.006; yaw = yawTarget;
        requestDraw();
        return;
      }
      const h = hitTest(p.x, p.y);
      if (h !== hover) { hover = h; paintRead(); requestDraw(); }
      if (h >= 0) showTip(h, p.x, p.y); else hideTip();
      canvas.classList.toggle("xpy-hot", h >= 0);
    });
    canvas.addEventListener("pointerleave", () => { if (hover >= 0) { hover = -1; paintRead(); requestDraw(); } hideTip(); canvas.classList.remove("xpy-hot"); });
    canvas.addEventListener("pointerdown", (e) => {
      if (mode !== "ziggurat") return;
      dragging = true; moved = false; dragFrom = toCanvas(e).x; dragYaw = yawTarget;
      canvas.classList.add("xpy-grabbing");
      hideTip();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    });
    function endDrag() { dragging = false; canvas.classList.remove("xpy-grabbing"); }
    canvas.addEventListener("pointerup", (e) => {
      const wasDrag = dragging && moved;
      endDrag();
      const p = toCanvas(e), h = hitTest(p.x, p.y);
      if (wasDrag) {
        spinning = false;
        if (h !== hover) { hover = h; paintRead(); }
        if (h >= 0) showTip(h, p.x, p.y); else hideTip();
        canvas.classList.toggle("xpy-hot", h >= 0);
        requestDraw();
        return;
      }
      select(h === sel ? -1 : h);
    });
    canvas.addEventListener("pointercancel", () => { endDrag(); hideTip(); requestDraw(); });
    canvas.addEventListener("lostpointercapture", () => { if (dragging) { endDrag(); requestDraw(); } });
    canvas.addEventListener("keydown", (e) => {
      const n = tiers.length;
      if (e.key === "ArrowDown") { e.preventDefault(); select(sel < 0 ? 0 : Math.min(n - 1, sel + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(sel < 0 ? n - 1 : Math.max(0, sel - 1)); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (hover >= 0 && hover !== sel) select(hover); else select(-1); }
      else if (e.key === "Escape") { select(-1); hideTip(); }
      else if (e.key === "1") setMode("terrace");
      else if (e.key === "2") setMode("mirror");
      else if (e.key === "3") setMode("ziggurat");
      else if (mode === "ziggurat" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault(); spinning = false;
        yawTarget += e.key === "ArrowLeft" ? -0.22 : 0.22;
        if (reducedMotion.matches) yaw = yawTarget;      /* no loop to ease it there */
        requestDraw();
      }
      else if (mode === "ziggurat" && (e.key === "r" || e.key === "R")) { spinning = !spinning; requestDraw(); }
    });

    const api = {
      set: (raw) => { ingest(raw); born = null; requestDraw(); return api; },
      mode: (m) => { setMode(m); return api; },
      select: (which) => { select(typeof which === "number" ? which : tiers.findIndex((t) => t.label === String(which).toUpperCase())); return api; },
      tiers: () => tiers.map((t) => ({ label: t.label, value: t.value, a: t.a, b: t.b, share: t.share, cum: t.cum })),
      destroy: () => { alive = false; running = false; if (rafId) cancelAnimationFrame(rafId); liveRenders.delete(requestDraw); host.innerHTML = ""; delete host.dataset.xpyInit; delete host._xpy; },
    };
    host._xpy = api;

    let initial = null;
    try { initial = JSON.parse(host.getAttribute("data-x-pyramid") || "null"); } catch (e) { initial = null; }
    ingest(initial);
    const m0 = (host.getAttribute("data-mode") || "").toLowerCase();
    if (PYRAMID_MODES.indexOf(m0) >= 0) setMode(m0);
    requestDraw();                                       /* kicks the reveal, or draws the static frame */
    return api;
  }

  /* ---------- auto-init ---------- */
  document.querySelectorAll("[data-x-radar]").forEach(radar);
  document.querySelectorAll("[data-x-scope]").forEach(scope);
  document.querySelectorAll("[data-x-spectrum]").forEach(spectrum);
  document.querySelectorAll("[data-x-log]").forEach(logStream);
  document.querySelectorAll("[data-x-imagefilter]").forEach(imageFilter);
  document.querySelectorAll("canvas[data-x-pipeline]").forEach(pipeline);
  document.querySelectorAll("canvas[data-x-dispersion]").forEach(dispersion);
  document.querySelectorAll("canvas[data-x-funnel]").forEach(funnel);
  document.querySelectorAll("[data-x-worldmap]").forEach(worldmap);
  document.querySelectorAll("canvas[data-x-flowledger]").forEach(flowledger);
  document.querySelectorAll("canvas[data-x-pebblemap]").forEach(pebblemap);
  document.querySelectorAll("[data-x-redaction]").forEach(redaction);
  document.querySelectorAll("[data-x-market]").forEach(market);
  document.querySelectorAll("[data-x-atlas]").forEach(atlas);
  document.querySelectorAll("[data-x-pyramid]").forEach(pyramid);

  window.sentinelX = { radar: radar, scope: scope, spectrum: spectrum, logStream: logStream, imageFilter: imageFilter, pipeline: pipeline, dispersion: dispersion, funnel: funnel, worldmap: worldmap, flowledger: flowledger, pebblemap: pebblemap, redaction: redaction, market: market, atlas: atlas, pyramid: pyramid };
  window.vertebraX = window.sentinelX; /* canonical name post-rename; sentinelX kept for compat */
})();
