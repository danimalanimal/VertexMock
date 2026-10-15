/* VERTEBRA theme (formerly Sentinel) — behavior layer. No dependencies.
   by DDS/DN
   Provides: theme toggle, font-pairing switcher, mobile nav,
   text decode effect, progress/gauge helpers. Everything is optional —
   markup without these hooks simply does nothing.

   To avoid a light-theme flash on first paint, also inline this in <head>
   BEFORE the stylesheet (index.html/starter.html already do):
     <script>(function(){try{var t=localStorage.getItem("vertebra-theme")||
     localStorage.getItem("sentinel-theme");
     if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))
     document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();</script>

   Storage keys are "vertebra-*" with legacy "sentinel-*" read fallback and
   write-through, so pre-rename pages and stored preferences keep working. */
(function () {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  /* ---------- theme (light/dark) ----------
     Default source is the OS setting. Opt a page into the VISITOR'S CLOCK
     instead with <html data-theme-default="clock">: with no stored choice the
     theme follows their local time — dark from dusk, light from morning. An
     explicit choice still wins, and pages that do not opt in are unchanged.
     To avoid a flash the same rule has to run pre-paint in the page's inline
     head script; darkByClock is exported so both use one definition. */
  const CLOCK_DARK_FROM = 19;   /* 19:00 and later -> dark */
  const CLOCK_LIGHT_FROM = 7;   /* 07:00 and later -> light */
  function darkByClock(now) {
    const h = (now || new Date()).getHours();
    return h >= CLOCK_DARK_FROM || h < CLOCK_LIGHT_FROM;
  }
  function clockMode() { return root.getAttribute("data-theme-default") === "clock"; }
  function defaultIsDark() { return clockMode() ? darkByClock() : darkScheme.matches; }

  if (safeGet("theme") === "dark" || (!safeGet("theme") && defaultIsDark())) {
    root.setAttribute("data-theme", "dark");
  }

  function applyTheme(dark, persist) {
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    if (persist) safeSet("theme", dark ? "dark" : "light");
    document.querySelectorAll("[data-theme-toggle]").forEach(syncThemeToggle);
  }

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    syncThemeToggle(btn);
    btn.addEventListener("click", () => {
      applyTheme(root.getAttribute("data-theme") !== "dark", true);
    });
  });

  /* follow live OS theme changes until the user picks one explicitly — but not
     when the page has handed that job to the clock */
  onMediaChange(darkScheme, (e) => {
    if (!safeGet("theme") && !clockMode()) applyTheme(e.matches, false);
  });

  function syncThemeToggle(btn) {
    const dark = root.getAttribute("data-theme") === "dark";
    /* preferred markup: the two-way .theme-switch (role="switch" + stable
       aria-label; visuals driven by [data-theme] in CSS) */
    if (btn.getAttribute("role") === "switch") {
      btn.setAttribute("aria-checked", String(dark));
      return;
    }
    /* legacy button markup: visible label states the CURRENT theme; a
       .sr-only "Theme:" prefix names the control (no aria-pressed — name +
       pressed changing together is an ARIA anti-pattern) */
    const label = btn.querySelector("[data-theme-label]");
    if (label) label.textContent = dark ? "DARK" : "LIGHT";
  }

  /* ---------- font pairing switcher ----------
     The stored pairing is only restored on pages that opt in by having
     switcher buttons (they load every pairing's font files). Author-set
     data-font on <html> always wins. */
  const storedFont = safeGet("font");
  if (
    storedFont && /^[a-f]$/.test(storedFont) &&
    !root.hasAttribute("data-font") &&
    document.querySelector("[data-font-set]")
  ) {
    root.setAttribute("data-font", storedFont);
  }

  document.querySelectorAll("[data-font-set]").forEach((btn) => {
    syncFontButton(btn);
    btn.addEventListener("click", () => {
      root.setAttribute("data-font", btn.getAttribute("data-font-set"));
      safeSet("font", btn.getAttribute("data-font-set"));
      document.querySelectorAll("[data-font-set]").forEach(syncFontButton);
      setTimeout(kickFonts, 200); /* re-request faces for the new pairing */
    });
  });

  function syncFontButton(btn) {
    const current = root.getAttribute("data-font") || "a";
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-font-set") === current));
  }

  /* ---------- font watchdog ----------
     Webfonts load lazily, and a transient fetch failure silently degrades
     text to system fallbacks (no error anywhere). Once initial loading
     settles, explicitly (re)request the active pairing's faces — a no-op
     when healthy, a self-heal when a fetch was dropped. Re-runs when the
     pairing switches. */
  function kickFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const cs = getComputedStyle(root);
    const fams = ["--font-display", "--font-body", "--font-mono"]
      .map((v) => (cs.getPropertyValue(v).split(",")[0] || "").trim().replace(/^["']|["']$/g, ""))
      .filter((f, i, a) => f && a.indexOf(f) === i);
    for (const f of fams) {
      for (const wt of ["400", "500", "600", "700"]) {
        try { document.fonts.load(wt + ' 16px "' + f + '"'); } catch (e) { /* ignore */ }
      }
    }
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(kickFonts, 300));
  }

  /* ---------- palette switcher ----------
     data-palette="<name>" on <html> + a palette-<name>.css link loaded after
     theme.css. Stored choice is only restored on pages that opt in by having
     switcher buttons (they load the palette stylesheets). "default" =
     attribute removed = the built-in Sentinel palette. */
  const storedPalette = safeGet("palette");
  if (
    storedPalette && /^[a-z][a-z-]*$/.test(storedPalette) &&
    !root.hasAttribute("data-palette") &&
    document.querySelector("[data-palette-set]")
  ) {
    if (storedPalette !== "default") root.setAttribute("data-palette", storedPalette);
  }

  document.querySelectorAll("[data-palette-set]").forEach((btn) => {
    syncPaletteButton(btn);
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-palette-set");
      if (name === "default") root.removeAttribute("data-palette");
      else root.setAttribute("data-palette", name);
      safeSet("palette", name);
      document.querySelectorAll("[data-palette-set]").forEach(syncPaletteButton);
    });
  });

  function syncPaletteButton(btn) {
    const current = root.getAttribute("data-palette") || "default";
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-palette-set") === current));
  }

  /* ---------- mobile nav ---------- */
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (navToggle && nav) {
    const setNav = (open) => {
      nav.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open); /* scroll lock, see CSS */
    };
    navToggle.addEventListener("click", () => setNav(!nav.classList.contains("open")));
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setNav(false);
    });
    document.addEventListener("pointerdown", (e) => {
      if (nav.classList.contains("open") && !e.target.closest(".nav, .nav-toggle")) setNav(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        setNav(false);
        navToggle.focus();
      }
    });
  }

  /* ---------- text decode effect ----------
     <h1 data-decode>DEFENSE GRID</h1> scrambles into place when it first
     scrolls into view. Text-only elements — children are left untouched.
     No-ops while prefers-reduced-motion is set. */
  const GLYPHS = "#/\\<>[]{}=+*-_10";
  const decodeState = new WeakMap(); /* el -> { original, raf } */

  function decode(el) {
    if (reducedMotion.matches) return;
    if (el.children.length) return; /* would destroy child markup */
    let state = decodeState.get(el);
    if (state) {
      cancelAnimationFrame(state.raf); /* restart cleanly from the pristine text */
    } else {
      state = { original: el.textContent, raf: 0 };
      decodeState.set(el, state);
    }
    const original = state.original;
    const duration = Math.min(900, 300 + original.length * 28);
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const settled = Math.floor(t * original.length);
      let out = original.slice(0, settled);
      for (let i = settled; i < original.length; i++) {
        const ch = original[i];
        out += ch === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (t < 1) state.raf = requestAnimationFrame(frame);
      else el.textContent = original;
    }
    state.raf = requestAnimationFrame(frame);
  }

  const decodeEls = document.querySelectorAll("[data-decode]");
  if (decodeEls.length && "IntersectionObserver" in window) {
    const seen = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !seen.has(entry.target)) {
          seen.add(entry.target);
          decode(entry.target); /* reduced-motion is re-checked at fire time */
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    decodeEls.forEach((el) => io.observe(el));
  }

  /* ---------- nav dropdown groups ----------
     [data-nav-group] wraps a .nav-group-btn + .nav-menu. One open at a
     time; outside pointerdown or Escape closes. Works as an accordion
     inside the mobile nav panel (same markup, CSS handles layout). */
  const navGroups = Array.from(document.querySelectorAll("[data-nav-group]"));
  if (navGroups.length) {
    const closeGroups = (except) => navGroups.forEach((g) => {
      if (g === except) return;
      const b = g.querySelector(".nav-group-btn");
      if (b) b.setAttribute("aria-expanded", "false");
    });
    navGroups.forEach((g) => {
      const btn = g.querySelector(".nav-group-btn");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        closeGroups(g);
        btn.setAttribute("aria-expanded", String(!open));
      });
    });
    document.addEventListener("pointerdown", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.closest("[data-nav-group]")) closeGroups();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeGroups();
    });
  }

  /* ---------- live region ----------
     One polite announcer the kit owns. Components that change the DOM
     without moving focus (reorder, triage, filter) speak through say(). */
  let liveEl = null;
  function say(msg) {
    if (!msg) return;
    if (!liveEl) {
      liveEl = document.createElement("div");
      liveEl.className = "sr-only";
      liveEl.setAttribute("aria-live", "polite");
      liveEl.setAttribute("aria-atomic", "true");
      document.body.appendChild(liveEl);
    }
    /* re-set to the same string still announces if we clear first */
    liveEl.textContent = "";
    setTimeout(() => { liveEl.textContent = msg; }, 30);
  }

  /* ---------- layer manager ----------
     ONE stack for everything that floats: modals, popover menus, and the
     sheets/palettes to come. Guarantees: Escape closes only the TOP layer;
     closing restores focus to the opener; blocking layers lock body scroll
     without a sideways jump (--layer-gap absorbs the scrollbar). Native
     <dialog> layers keep their platform behavior — the stack coordinates
     around it rather than re-implementing it. */
  const layerStack = [];
  /* An entry is stale once its element leaves the document or (for a native
     dialog) is no longer open. Dialogs can close without us hearing about it
     — dlg.close() called elsewhere, a form[method=dialog] submit, or a
     missed "close" event — and a stale entry would strand the scroll lock.
     Pruning before every read makes the stack self-correcting. */
  function pruneLayers() {
    for (let i = layerStack.length - 1; i >= 0; i--) {
      const el = layerStack[i].el;
      const gone = !document.contains(el) ||
        (typeof HTMLDialogElement !== "undefined" && el instanceof HTMLDialogElement && !el.open);
      if (gone) {
        const stale = layerStack.splice(i, 1)[0];
        if (stale.mo) stale.mo.disconnect();
        if (stale.inerted) stale.inerted.forEach((n) => { n.inert = false; });
      }
    }
  }
  function syncScrollLock() {
    pruneLayers();
    const lock = layerStack.some((l) => l.lock);
    if (lock && !document.body.classList.contains("layer-lock")) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.setProperty("--layer-gap", gap + "px");
      document.body.classList.add("layer-lock");
    } else if (!lock) {
      document.body.classList.remove("layer-lock");
      document.body.style.removeProperty("--layer-gap");
    }
  }
  const layer = {
    open(el, opts) {
      opts = opts || {};
      const entry = {
        el: el,
        kind: opts.kind || "pop",
        lock: !!opts.lock,
        trigger: opts.trigger || document.activeElement,
        onClose: opts.onClose,
      };
      /* A dialog can be closed by routes that notify nobody (a direct
         dlg.close() elsewhere in app code, a form[method=dialog] submit, or
         an engine that skips the "close" event). Watching the `open`
         attribute catches every one of them, so the scroll lock can never
         be stranded. */
      if (typeof HTMLDialogElement !== "undefined" && el instanceof HTMLDialogElement &&
          typeof MutationObserver !== "undefined") {
        entry.mo = new MutationObserver(() => { if (!el.open) layer.close(el); });
        entry.mo.observe(el, { attributes: true, attributeFilter: ["open"] });
      }
      /* focus containment for blocking layers: mark every other top-level
         node inert, which both traps Tab and hides them from AT. We record
         what we set so nested layers unwind cleanly. */
      if (entry.lock && "inert" in HTMLElement.prototype) {
        entry.inerted = [];
        Array.prototype.forEach.call(document.body.children, (node) => {
          if (node === el || node.contains(el) || node.inert) return;
          node.inert = true;
          entry.inerted.push(node);
        });
      }
      layerStack.push(entry);
      syncScrollLock();
      return entry;
    },
    close(el) {
      const i = layerStack.findIndex((l) => l.el === el);
      if (i < 0) { syncScrollLock(); return; } /* already pruned — still resync */
      /* unwind anything stacked ABOVE this layer first, so closing a modal
         can't strand its own popover (and the scroll lock) behind it */
      while (layerStack.length > i + 1) layer.close(layerStack[layerStack.length - 1].el);
      const entry = layerStack.splice(i, 1)[0];
      if (entry.mo) entry.mo.disconnect();
      if (entry.inerted) entry.inerted.forEach((n) => { n.inert = false; });
      if (entry.onClose) entry.onClose(entry);
      /* restore focus to the opener — but never steal it from wherever the
         user has already moved it (e.g. an outside click) */
      const active = document.activeElement;
      const lost = !active || active === document.body || entry.el.contains(active);
      if (lost && entry.trigger && document.contains(entry.trigger)) entry.trigger.focus();
      syncScrollLock();
    },
    closeTop() {
      pruneLayers();
      if (layerStack.length) layer.close(layerStack[layerStack.length - 1].el);
    },
    /* call after closing a dialog by any other route — resyncs the lock */
    sync: syncScrollLock,
    get depth() { pruneLayers(); return layerStack.length; },
  };
  /* Escape routing: capture-phase so a popover above a native dialog wins —
     the dialog's own cancel only fires once it IS the top layer */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    pruneLayers();
    if (!layerStack.length) return;
    const top = layerStack[layerStack.length - 1];
    if (typeof HTMLDialogElement !== "undefined" && top.el instanceof HTMLDialogElement) return;
    e.preventDefault();
    e.stopPropagation();
    layer.close(top.el);
  }, true);

  /* ---------- modal ----------
     <button data-modal-open="#my-dialog"> opens <dialog id="my-dialog" class="modal">.
     Clicking the backdrop or any [data-modal-close] inside closes it.
     Rides the layer stack (scroll lock + focus restore); markup unchanged. */
  document.querySelectorAll("[data-modal-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dlg = document.querySelector(btn.getAttribute("data-modal-open"));
      if (!dlg || !dlg.showModal || dlg.open) return;
      dlg.showModal();
      layer.open(dlg, { kind: "modal", lock: true, trigger: btn });
      dlg.addEventListener("close", () => layer.close(dlg), { once: true });
    });
  });
  document.querySelectorAll("dialog.modal").forEach((dlg) => {
    /* close by any route unwinds the layer entry; the "close" event is the
       normal path, these are the belt-and-braces ones */
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) { dlg.close(); layer.close(dlg); } /* backdrop click */
    });
    dlg.addEventListener("cancel", () => setTimeout(() => layer.close(dlg), 0)); /* native Esc */
    dlg.querySelectorAll("[data-modal-close]").forEach((b) =>
      b.addEventListener("click", () => { dlg.close(); layer.close(dlg); }));
  });

  /* ---------- toasts ----------
     sentinel.toast("Uplink stable", "ok" | "warn" | "err" | "info" | "nudge",
       { ttl, action: {label, fn}, snooze: {label, fn} })
     ttl (ms; Infinity = sticky) draws a draining bar; actions render as
     buttons ("Archived · UNDO"). Legacy {duration} keeps working. */
  const TOAST_LABELS = { ok: "OK", warn: "WARN", err: "ERROR", info: "INFO", nudge: "NUDGE" };
  function toast(message, kind, opts) {
    kind = TOAST_LABELS[kind] ? kind : "ok";
    opts = opts || {};
    /* a toast carrying an action must outlive the time it takes to notice
       and reach it (WCAG 2.2.1) — actionable toasts get a longer default and
       pause while hovered or focused */
    const actionable = !!(opts.action || opts.snooze);
    const ttl = opts.ttl || opts.duration || (actionable ? 12000 : 4000);
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "toast toast-" + kind;
    el.setAttribute("role", kind === "err" ? "alert" : "status");
    const label = document.createElement("strong");
    label.textContent = TOAST_LABELS[kind];
    const body = document.createElement("span");
    body.textContent = message;
    el.append(label, body);
    let timer = 0, left = ttl, startedAt = 0;
    function dismiss() {
      clearTimeout(timer);
      el.classList.add("leaving");
      /* only the toast's OWN exit animation removes it — the ttl bar's
         animationend bubbles here too and used to kill the exit mid-flight.
         animationend may never fire under reduced motion — hard fallback */
      el.addEventListener("animationend", (ev) => {
        if (ev.target === el && ev.animationName !== "toast-ttl") el.remove();
      });
      setTimeout(() => el.remove(), 400);
    }
    function arm(ms) {
      if (ttl === Infinity) return;
      startedAt = performance.now();
      left = ms;
      clearTimeout(timer);
      timer = setTimeout(dismiss, ms);
    }
    const acts = [opts.action, opts.snooze].filter(Boolean);
    if (acts.length) {
      const row = document.createElement("div");
      row.className = "toast-actions";
      acts.forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "toast-act";
        b.textContent = a.label;
        b.addEventListener("click", () => {
          dismiss();
          if (a.fn) a.fn();
        });
        row.appendChild(b);
      });
      el.appendChild(row);
    }
    if (ttl !== Infinity) {
      const bar = document.createElement("div");
      bar.className = "toast-ttl";
      bar.style.animationDuration = ttl + "ms";
      el.appendChild(bar);
      arm(ttl);
      if (actionable) {
        const hold = () => { clearTimeout(timer); left = Math.max(1200, left - (performance.now() - startedAt)); };
        const resume = () => arm(left);
        el.addEventListener("pointerenter", hold);
        el.addEventListener("pointerleave", resume);
        el.addEventListener("focusin", hold);
        el.addEventListener("focusout", resume);
      }
    }
    stack.appendChild(el);
    el.dismiss = dismiss;
    return el;
  }

  /* ---------- nudge ----------
     vertebra.nudge("Water. Now.", { ttl, snoozeMs, onDone }) — a toast with
     SNOOZE as a first-class action: snoozing visibly re-queues the nudge. */
  function nudge(message, opts) {
    opts = opts || {};
    const snoozeMs = opts.snoozeMs || 10 * 60 * 1000;
    const mins = Math.round(snoozeMs / 60000);
    return toast(message, "nudge", {
      ttl: opts.ttl || 10000,
      action: { label: opts.doneLabel || "DONE", fn: opts.onDone },
      snooze: {
        label: "SNOOZE " + (mins >= 1 ? mins + "M" : Math.round(snoozeMs / 1000) + "S"),
        fn: function () {
          toast("Snoozed — back in " + (mins >= 1 ? mins + " min" : Math.round(snoozeMs / 1000) + "s"), "info");
          setTimeout(function () { nudge(message, opts); }, snoozeMs);
        },
      },
    });
  }

  /* ---------- tabs ----------
     <div class="tabs" data-tabs role="tablist"> with [role=tab] buttons whose
     aria-controls point at [role=tabpanel] ids. Arrow keys move between tabs. */
  document.querySelectorAll("[data-tabs]").forEach((tablist) => {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    function select(i, focus) {
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", String(i === j));
        t.tabIndex = i === j ? 0 : -1;
        if (panels[j]) panels[j].hidden = i !== j;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        let n = null;
        if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") n = 0;
        if (e.key === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(n, true); }
      });
    });
    const initial = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    select(initial < 0 ? 0 : initial);
  });

  /* ---------- pointer gesture utility ----------
     vertebra.gesture(el, { onPress, onTap, onLongPress, onDragStart,
       onDragMove, onDragEnd, onSwipe, threshold, longPress })
     One pointer-events engine for every draggable thing in the kit:
     sortable lists now; kanban, sheets, decks, boards later. Drag begins
     after a small threshold so taps stay taps; swipe reports direction +
     velocity on release. */
  function gesture(el, o) {
    o = o || {};
    const TH = o.threshold || 6;
    let pid = null, startX = 0, startY = 0, startT = 0, dragging = false, moved = false, longT = 0;
    el.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      if (pid !== null) return; /* a second finger must not hijack the drag */
      if (o.accept && !o.accept(e)) return;
      pid = e.pointerId;
      startX = e.clientX; startY = e.clientY; startT = performance.now();
      dragging = false; moved = false;
      if (o.onLongPress) {
        longT = setTimeout(() => { if (!moved) o.onLongPress(e); }, o.longPress || 500);
      }
      try { el.setPointerCapture(pid); } catch (err) { /* detached mid-press */ }
      if (o.onPress) o.onPress(e);
    });
    el.addEventListener("pointermove", (e) => {
      if (pid === null || e.pointerId !== pid) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) >= TH) {
        dragging = true; moved = true;
        clearTimeout(longT);
        if (o.onDragStart) o.onDragStart(e, { dx: dx, dy: dy });
      }
      if (dragging && o.onDragMove) o.onDragMove(e, { dx: dx, dy: dy });
    });
    function finish(e, cancelled) {
      if (pid === null || e.pointerId !== pid) return;
      clearTimeout(longT);
      const dt = Math.max(1, performance.now() - startT);
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (dragging) {
        if (o.onDragEnd) o.onDragEnd(e, { dx: dx, dy: dy, cancelled: !!cancelled });
        if (!cancelled && o.onSwipe && Math.hypot(dx, dy) > 40 && Math.hypot(dx, dy) / dt > 0.45) {
          o.onSwipe(e, {
            dx: dx, dy: dy, vx: dx / dt, vy: dy / dt,
            dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"),
          });
        }
      } else if (!cancelled && !moved && o.onTap) o.onTap(e);
      pid = null; dragging = false;
    }
    el.addEventListener("pointerup", (e) => finish(e, false));
    el.addEventListener("pointercancel", (e) => finish(e, true));
  }

  /* ---------- drag lift ----------
     Shared by sortable lists and the kanban board: the pressed card ITSELF
     rides the pointer (position: fixed) with soft physics — the rendered
     position trails the pointer a touch and the card tilts with horizontal
     velocity — while a card-sized dashed .sort-slot marks the landing.
     Under reduced motion the card still follows, rigidly and untilted. */
  function liftBegin(el, e) {
    const r = el.getBoundingClientRect();
    const st = {
      el: el,
      grabX: e.clientX - r.left, grabY: e.clientY - r.top,
      x: r.left, y: r.top, tx: r.left, ty: r.top,
      tilt: 0, vx: 0, lastX: e.clientX, lastT: performance.now(),
      raf: 0, live: true, height: r.height,
    };
    st.css = {
      width: el.style.width, height: el.style.height, position: el.style.position,
      left: el.style.left, top: el.style.top, margin: el.style.margin,
      transform: el.style.transform,
    };
    el.classList.add("drag-lift");
    el.style.width = r.width + "px";
    el.style.height = r.height + "px";
    el.style.position = "fixed";
    el.style.left = "0";
    el.style.top = "0";
    el.style.margin = "0";
    function paint() {
      el.style.transform = "translate3d(" + st.x + "px," + st.y + "px,0)" +
        " rotate(" + st.tilt.toFixed(2) + "deg) scale(1.02)";
    }
    paint();
    function frame() {
      if (!st.live) return;
      st.x += (st.tx - st.x) * 0.34;
      st.y += (st.ty - st.y) * 0.34;
      st.vx *= 0.9; /* tilt relaxes as the pointer slows */
      const want = Math.max(-6.5, Math.min(6.5, st.vx * 22));
      st.tilt += (want - st.tilt) * 0.16;
      paint();
      st.raf = requestAnimationFrame(frame);
    }
    st.move = function (ev) {
      st.tx = ev.clientX - st.grabX;
      st.ty = ev.clientY - st.grabY;
      const now = performance.now();
      const dt = Math.max(1, now - st.lastT);
      st.vx = st.vx * 0.6 + ((ev.clientX - st.lastX) / dt) * 0.4;
      st.lastX = ev.clientX; st.lastT = now;
      if (reducedMotion.matches) { st.x = st.tx; st.y = st.ty; st.tilt = 0; paint(); }
    };
    if (!reducedMotion.matches) st.raf = requestAnimationFrame(frame);
    /* settle(): back into normal flow, then FLIP from where it floated to
       where it now sits, landing with a soft overshoot */
    st.settle = function () {
      st.live = false;
      cancelAnimationFrame(st.raf);
      const from = { x: st.x, y: st.y, tilt: st.tilt };
      el.classList.remove("drag-lift");
      el.style.width = st.css.width; el.style.height = st.css.height;
      el.style.position = st.css.position; el.style.left = st.css.left;
      el.style.top = st.css.top; el.style.margin = st.css.margin;
      el.style.transform = st.css.transform;
      if (reducedMotion.matches) return;
      const now = el.getBoundingClientRect();
      const dx = from.x - now.left, dy = from.y - now.top;
      if (Math.hypot(dx, dy) < 2 && Math.abs(from.tilt) < 0.5) return;
      el.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + from.tilt.toFixed(2) + "deg)";
      el.getBoundingClientRect(); /* commit the start frame before transitioning */
      el.classList.add("drag-settle");
      el.style.transform = st.css.transform;
      const done = function (ev) {
        if (ev && ev.target !== el) return;
        el.classList.remove("drag-settle");
        el.removeEventListener("transitionend", done);
        clearTimeout(t);
      };
      const t = setTimeout(done, 420); /* transitionend can be swallowed */
      el.addEventListener("transitionend", done);
    };
    return st;
  }

  /* ---------- sortable lists ----------
     <ul class="sortable" data-sortable> whose items contain a .drag-h
     handle. Pointer: drag the handle, an insertion line tracks the drop.
     Keyboard: focus the handle, Space grabs, arrows move, Space drops,
     Escape cancels. Emits "vertebra:sort" on the list after a reorder. */
  document.querySelectorAll("[data-sortable]").forEach(initSortable);
  function initSortable(list) {
    let item = null, line = null, grabbed = null, grabbedHandle = null, grabIndex = -1;
    let lift = null, origin = null;
    const items = () => Array.from(list.children).filter((c) => !c.classList.contains("sort-line"));
    function lineEl() {
      if (!line) {
        line = document.createElement(list.tagName === "UL" || list.tagName === "OL" ? "li" : "div");
        line.className = "sort-line";
        line.setAttribute("aria-hidden", "true");
      }
      return line;
    }
    function placeLine(y) {
      let before = null;
      for (const el of items()) {
        if (el === item) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) { before = el; break; }
      }
      list.insertBefore(lineEl(), before);
    }
    function announce(el, verb) {
      const row = el || item || grabbed;
      if (row && verb) {
        const all = items();
        const label = (row.querySelector(".todo-text, .capture-text") || row).textContent.trim().slice(0, 60);
        say(verb === "grabbed"
          ? label + ", grabbed. Use arrow keys to move, space to drop."
          : verb === "cancelled"
            ? label + ", move cancelled."
            : label + ", " + verb + " to position " + (all.indexOf(row) + 1) + " of " + all.length + ".");
      }
      list.dispatchEvent(new CustomEvent("vertebra:sort", { bubbles: true, detail: { item: row, list: list } }));
    }
    let pending = null;
    gesture(list, {
      accept: (e) => !!(e.target instanceof Element && e.target.closest(".drag-h")),
      /* pointer capture retargets pointermove to the list, so the handle must
         be resolved here, from the original pointerdown target */
      onPress: (e) => {
        const h = e.target instanceof Element ? e.target.closest(".drag-h") : null;
        pending = h ? h.closest("[data-sortable] > *") : null;
      },
      onDragStart: (e) => {
        item = pending;
        if (!item) return;
        origin = { parent: item.parentNode, next: item.nextElementSibling };
        lift = liftBegin(item, e);
        /* the landing marker is a card-sized slot, not a hairline */
        lineEl().classList.add("sort-slot");
        lineEl().style.height = lift.height + "px";
        placeLine(e.clientY);
      },
      onDragMove: (e) => { if (lift) lift.move(e); if (item) placeLine(e.clientY); },
      onDragEnd: (e, d) => {
        pending = null;
        if (!item) return;
        const landed = !d.cancelled && line && line.parentNode === list;
        if (landed) {
          list.insertBefore(item, line);
        } else if (origin) {
          /* cancelled — put it back exactly where it lifted from */
          const next = origin.next && origin.next.parentNode === origin.parent ? origin.next : null;
          origin.parent.insertBefore(item, next);
        }
        if (line) line.remove();
        if (lift) lift.settle();
        if (landed) announce(item, "moved");
        item = null; lift = null; origin = null;
      },
    });
    list.addEventListener("keydown", (e) => {
      const h = e.target instanceof Element && e.target.closest(".drag-h");
      if (!h) return;
      const row = h.closest("[data-sortable] > *");
      if (!row) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (grabbed === row) {
          grabbed.classList.remove("sort-grabbed");
          h.setAttribute("aria-pressed", "false");
          const dropped = grabbed;
          grabbed = null; grabbedHandle = null;
          announce(dropped, "dropped");
        } else {
          /* reset the PREVIOUS handle — clearing the row alone left it
             reporting aria-pressed="true" forever */
          if (grabbedHandle) grabbedHandle.setAttribute("aria-pressed", "false");
          if (grabbed) grabbed.classList.remove("sort-grabbed");
          grabbed = row;
          grabbedHandle = h;
          grabIndex = items().indexOf(row);
          row.classList.add("sort-grabbed");
          h.setAttribute("aria-pressed", "true");
          announce(row, "grabbed");
        }
      } else if (grabbed === row && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const sib = e.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
        if (sib && !sib.classList.contains("sort-line")) {
          list.insertBefore(row, e.key === "ArrowUp" ? sib : sib.nextElementSibling);
          h.focus();
          announce(row, "moved");
        }
      } else if (grabbed === row && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation(); /* don't let the layer stack see this */
        const all = items().filter((x) => x !== row);
        list.insertBefore(row, all[grabIndex] || null);
        row.classList.remove("sort-grabbed");
        h.setAttribute("aria-pressed", "false");
        h.focus();
        grabbed = null; grabbedHandle = null;
        announce(row, "cancelled");
      }
    });
  }

  /* ---------- popover menu ----------
     <div class="menu" data-menu> = .menu-btn trigger + .menu-list of
     [role=menuitem] buttons. Edge-aware (flips .up/.left), arrow-key
     roving, closes on Escape / outside press / item click. */
  document.querySelectorAll("[data-menu]").forEach((wrap) => {
    const btn = wrap.querySelector(".menu-btn");
    const listEl = wrap.querySelector(".menu-list");
    if (!btn || !listEl) return;
    const items = () => Array.from(listEl.querySelectorAll('[role="menuitem"]:not([disabled])'));
    function setOpen(open, focusFirst) {
      const already = btn.getAttribute("aria-expanded") === "true";
      if (open === already) { if (open && focusFirst) { const f = items()[0]; if (f) f.focus(); } return; }
      btn.setAttribute("aria-expanded", String(open));
      if (open) {
        listEl.classList.remove("up", "left");
        layer.open(listEl, {
          kind: "pop",
          trigger: btn,
          onClose: () => btn.setAttribute("aria-expanded", "false"),
        });
        requestAnimationFrame(() => {
          const r = listEl.getBoundingClientRect();
          if (r.bottom > window.innerHeight - 8) listEl.classList.add("up");
          if (r.left < 8) listEl.classList.add("left");
        });
        if (focusFirst) { const f = items()[0]; if (f) f.focus(); }
      } else {
        layer.close(listEl);
      }
    }
    btn.addEventListener("click", (e) => {
      /* detail === 0 means Enter/Space, not a real pointer click — the ARIA
         menu-button pattern moves focus into the menu for those */
      const viaKeyboard = e.detail === 0;
      setOpen(btn.getAttribute("aria-expanded") !== "true", viaKeyboard);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true, true); }
    });
    listEl.addEventListener("keydown", (e) => {
      const it = items();
      const i = it.indexOf(document.activeElement);
      let n = null;
      if (e.key === "ArrowDown") n = (i + 1) % it.length;
      if (e.key === "ArrowUp") n = (i - 1 + it.length) % it.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = it.length - 1;
      if (n !== null && it.length) { e.preventDefault(); it[n].focus(); }
    });
    listEl.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest('[role="menuitem"]')) setOpen(false);
    });
    document.addEventListener("pointerdown", (e) => {
      if (btn.getAttribute("aria-expanded") === "true" &&
          !(e.target instanceof Element && wrap.contains(e.target))) setOpen(false);
    });
  });

  /* ---------- segmented control ----------
     <div class="segctl" role="radiogroup" aria-label="View"> of
     [role=radio] buttons. Click or arrow keys; emits "vertebra:seg"
     with { value } (data-value, else the label). */
  document.querySelectorAll(".segctl").forEach((grp) => {
    const radios = () => Array.from(grp.querySelectorAll('[role="radio"]'));
    function select(r, focus) {
      radios().forEach((x) => {
        x.setAttribute("aria-checked", String(x === r));
        x.tabIndex = x === r ? 0 : -1;
      });
      if (focus) r.focus();
      grp.dispatchEvent(new CustomEvent("vertebra:seg", {
        bubbles: true,
        detail: { value: r.getAttribute("data-value") || r.textContent.trim(), btn: r },
      }));
    }
    radios().forEach((r) => {
      if (r.tagName === "BUTTON" && !r.hasAttribute("type")) r.type = "button";
      r.tabIndex = r.getAttribute("aria-checked") === "true" ? 0 : -1;
      r.addEventListener("click", () => select(r));
      r.addEventListener("keydown", (e) => {
        const rs = radios();
        const i = rs.indexOf(r);
        let n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % rs.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + rs.length) % rs.length;
        if (n !== null) { e.preventDefault(); select(rs[n], true); }
      });
    });
    if (!grp.querySelector('[role="radio"][aria-checked="true"]')) {
      const f = radios()[0];
      if (f) { f.setAttribute("aria-checked", "true"); f.tabIndex = 0; }
    }
  });

  /* ---------- badge counts ----------
     vertebra.badge(navLink, 3) — creates/updates a .nav-badge inside el;
     0/null removes it; true renders the bare dot; caps at 99+. */
  function badgeCount(el, n) {
    let b = el.querySelector(":scope > .nav-badge");
    if (!n) { if (b) b.remove(); return null; }
    if (!b) {
      b = document.createElement("span");
      b.className = "nav-badge";
      el.appendChild(b);
    }
    b.textContent = n === true ? "" : (n > 99 ? "99+" : String(n));
    return b;
  }

  /* ---------- auto-growing textarea (fallback) ----------
     CSS field-sizing covers new engines; elsewhere, mirror scrollHeight. */
  if (!(window.CSS && CSS.supports && CSS.supports("field-sizing: content"))) {
    document.querySelectorAll("textarea.textarea-grow").forEach((ta) => {
      const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
      ta.addEventListener("input", grow);
      grow();
    });
  }

  /* ---------- acting user (two-user demo/presence convention) ----------
     data-acting="u1|u2" on <html> names who is driving this device.
     [data-acting-set="u1"] buttons switch it (persisted). Display initials
     come from data-u1-init / data-u2-init on <html> (default D / J). */
  function actingUser() { return root.getAttribute("data-acting") || "u1"; }
  function userInit(u) {
    return root.getAttribute("data-" + u + "-init") || (u === "u2" ? "J" : "D");
  }
  const storedActing = safeGet("acting");
  if (storedActing && /^u[12]$/.test(storedActing) && document.querySelector("[data-acting-set]")) {
    root.setAttribute("data-acting", storedActing);
  }
  function syncActingButtons() {
    document.querySelectorAll("[data-acting-set]").forEach((b) => {
      const on = b.getAttribute("data-acting-set") === actingUser();
      if (b.getAttribute("role") === "radio") {
        b.setAttribute("aria-checked", String(on));
        b.tabIndex = on ? 0 : -1; /* roving tabindex must follow the checked state */
      } else b.setAttribute("aria-pressed", String(on));
    });
  }
  document.querySelectorAll("[data-acting-set]").forEach((b) => {
    b.addEventListener("click", () => {
      root.setAttribute("data-acting", b.getAttribute("data-acting-set"));
      safeSet("acting", b.getAttribute("data-acting-set"));
      syncActingButtons();
    });
  });
  syncActingButtons();

  function whoChip(u, extra) {
    const s = document.createElement("span");
    s.className = "who" + (extra ? " " + extra : "");
    s.setAttribute("data-user", u);
    s.textContent = userInit(u);
    return s;
  }

  /* ---------- todo ----------
     <section class="todo" data-todo> — quick-add form, filter chips,
     .todo-list of .todo-item rows. All state lives in the DOM (the app
     persists it; here it's the interaction contract): data-state =
     open|doing|done|blocked, data-user = creator, data-claimed = claimant. */
  const todoApis = new WeakMap();
  document.querySelectorAll("[data-todo]").forEach(initTodo);
  function initTodo(box) {
    const list = box.querySelector(".todo-list");
    if (!list) return;
    /* keep author-marked done rows honest */
    list.querySelectorAll('.todo-item[data-state="done"] .todo-check input').forEach((c) => { c.checked = true; });

    function buildItem(text, u) {
      const li = document.createElement("li");
      li.className = "todo-item";
      li.setAttribute("data-user", u);
      li.setAttribute("data-state", "open");
      const h = document.createElement("button");
      h.type = "button";
      h.className = "drag-h";
      h.setAttribute("aria-label", "Reorder: " + text);
      h.textContent = "⠿";
      const check = document.createElement("label");
      check.className = "todo-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("aria-label", "Done: " + text);
      const boxEl = document.createElement("span");
      boxEl.className = "todo-box";
      boxEl.setAttribute("aria-hidden", "true");
      check.append(input, boxEl);
      const main = document.createElement("div");
      main.className = "todo-main";
      const p = document.createElement("p");
      p.className = "todo-text";
      p.textContent = text;
      const meta = document.createElement("div");
      meta.className = "todo-meta";
      const by = document.createElement("span");
      by.className = "byline";
      by.append(whoChip(u), document.createTextNode(" added · just now"));
      meta.appendChild(by);
      main.append(p, meta);
      const claim = document.createElement("button");
      claim.type = "button";
      claim.className = "todo-claim";
      claim.setAttribute("aria-pressed", "false");
      claim.textContent = "CLAIM";
      li.append(h, check, main, claim);
      return li;
    }
    /* the active filter must be re-applied whenever the list or a row's
       state changes — a one-shot pass let new and re-opened items leak in */
    function applyFilter() {
      const on = box.querySelector("[data-todo-filters] [data-filter][aria-pressed='true']");
      const f = on ? on.getAttribute("data-filter") : "all";
      list.querySelectorAll(".todo-item").forEach((item) => {
        const state = item.getAttribute("data-state");
        const show =
          f === "all" ? true :
          f === "done" ? state === "done" :
          f === "open" ? state !== "done" :
          item.getAttribute("data-user") === f || item.getAttribute("data-claimed") === f;
        item.hidden = !show;
      });
    }
    const api = {
      add(text, u) {
        const t = (text || "").trim();
        if (!t) return null;
        const li = buildItem(t, u || actingUser());
        list.prepend(li);
        applyFilter();
        return li;
      },
    };
    todoApis.set(box, api);

    const addForm = box.querySelector(".todo-add");
    if (addForm) {
      addForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = addForm.querySelector("input");
        if (!input) return;
        if (api.add(input.value)) input.value = "";
        input.focus();
      });
    }

    list.addEventListener("change", (e) => {
      const input = e.target instanceof Element && e.target.closest(".todo-check input");
      if (!input) return;
      const item = input.closest(".todo-item");
      if (!item) return;
      /* a rapid tick/untick must not let the delayed "done" land afterwards */
      clearTimeout(item._doneT);
      const fire = (action) => {
        applyFilter();
        box.dispatchEvent(new CustomEvent("vertebra:todo", {
          bubbles: true,
          detail: { action: action, item: item },
        }));
      };
      if (input.checked) {
        if (reducedMotion.matches) {
          item.setAttribute("data-state", "done");
          fire("done");
        } else {
          item.classList.add("completing");
          item._doneT = setTimeout(() => {
            item.classList.remove("completing");
            if (!input.checked) return; /* un-ticked while animating */
            item.setAttribute("data-state", "done");
            fire("done");
          }, 480);
        }
      } else {
        item.classList.remove("completing");
        item.setAttribute("data-state", item.hasAttribute("data-claimed") ? "doing" : "open");
        fire("reopen");
      }
    });

    list.addEventListener("click", (e) => {
      const claim = e.target instanceof Element && e.target.closest(".todo-claim");
      if (!claim) return;
      const item = claim.closest(".todo-item");
      const u = actingUser();
      const mine = claim.getAttribute("aria-pressed") === "true" && claim.getAttribute("data-user") === u;
      if (mine) {
        claim.setAttribute("aria-pressed", "false");
        claim.removeAttribute("data-user");
        claim.textContent = "CLAIM";
        item.removeAttribute("data-claimed");
        if (item.getAttribute("data-state") === "doing") item.setAttribute("data-state", "open");
      } else {
        claim.setAttribute("aria-pressed", "true");
        claim.setAttribute("data-user", u);
        claim.textContent = userInit(u) + " ON IT";
        item.setAttribute("data-claimed", u);
        if (item.getAttribute("data-state") === "open") item.setAttribute("data-state", "doing");
      }
      applyFilter();
    });

    const filters = box.querySelector("[data-todo-filters]");
    if (filters) {
      filters.addEventListener("click", (e) => {
        const btn = e.target instanceof Element && e.target.closest("[data-filter]");
        if (!btn) return;
        filters.querySelectorAll("[data-filter]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        applyFilter();
        const shown = list.querySelectorAll(".todo-item:not([hidden])").length;
        say(btn.textContent.trim() + " filter, " + shown + " task" + (shown === 1 ? "" : "s") + " shown.");
      });
    }
  }

  /* ---------- capture inbox ----------
     <section class="capture" data-capture data-capture-to="#a-data-todo-box">
     One field in, triage later: → Todo (moves it, with UNDO), Later
     (defers to the bottom), ✕ (discards, with UNDO). */
  document.querySelectorAll("[data-capture]").forEach((box) => {
    const list = box.querySelector(".capture-list");
    if (!list) return;
    const emptyEl = box.querySelector(".empty");
    function syncEmpty() {
      if (emptyEl) emptyEl.hidden = list.children.length > 0;
    }
    function buildCapture(text, u) {
      const li = document.createElement("li");
      li.className = "capture-item";
      li.setAttribute("data-user", u);
      const p = document.createElement("p");
      p.className = "capture-text";
      if (/^https?:\/\/\S+$/i.test(text)) {
        const a = document.createElement("a");
        a.href = text;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = text;
        p.appendChild(a);
      } else {
        p.textContent = text;
      }
      const by = document.createElement("span");
      by.className = "byline";
      by.append(whoChip(u), document.createTextNode(" captured · just now"));
      const tri = document.createElement("div");
      tri.className = "capture-tri";
      tri.innerHTML =
        '<button type="button" class="btn btn-sm" data-tri="todo">→ Todo</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-tri="later">Later</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-tri="trash" aria-label="Discard">✕</button>';
      li.append(p, by, tri);
      return li;
    }
    const addForm = box.querySelector(".capture-add");
    if (addForm) {
      addForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = addForm.querySelector("input");
        const t = input && input.value.trim();
        if (!t) return;
        list.prepend(buildCapture(t, actingUser()));
        input.value = "";
        input.focus();
        syncEmpty();
      });
    }
    /* removing the focused row would drop focus to <body>; move it to the
       same control on a neighbour, else the capture field */
    function refocus(li, btn) {
      const sib = li.nextElementSibling || li.previousElementSibling;
      const kind = btn && btn.getAttribute("data-tri");
      const next = sib && kind ? sib.querySelector('[data-tri="' + kind + '"]') : null;
      const fallback = box.querySelector(".capture-add input");
      const target = next || fallback;
      if (target) target.focus();
    }
    function leave(li, then) {
      if (reducedMotion.matches) { li.remove(); syncEmpty(); if (then) then(); return; }
      li.classList.add("leaving");
      li.addEventListener("animationend", () => { li.remove(); syncEmpty(); if (then) then(); }, { once: true });
      setTimeout(() => { if (li.isConnected) { li.remove(); syncEmpty(); if (then) then(); } }, 320);
    }
    list.addEventListener("click", (e) => {
      const btn = e.target instanceof Element && e.target.closest("[data-tri]");
      if (!btn) return;
      const li = btn.closest(".capture-item");
      const text = li.querySelector(".capture-text").textContent;
      const kind = btn.getAttribute("data-tri");
      const idx = Array.from(list.children).indexOf(li);
      if (kind === "trash") {
        refocus(li, btn);
        leave(li, () => {
          toast("Discarded", "info", {
            action: { label: "UNDO", fn: () => {
              list.insertBefore(li, list.children[idx] || null);
              li.classList.remove("leaving");
              syncEmpty();
            } },
          });
        });
      } else if (kind === "later") {
        list.appendChild(li);
        const by = li.querySelector(".byline");
        if (by && !by.querySelector(".pill")) {
          const c = document.createElement("span");
          c.className = "pill";
          c.textContent = "LATER";
          by.appendChild(c);
        }
      } else if (kind === "todo") {
        const target = document.querySelector(box.getAttribute("data-capture-to") || "[data-todo]");
        const api = target && todoApis.get(target);
        const made = api && api.add(text, li.getAttribute("data-user") || actingUser());
        refocus(li, btn);
        leave(li, () => {
          toast(api ? "Moved to todo" : "No todo list on this page", api ? "ok" : "warn", {
            action: api ? { label: "UNDO", fn: () => {
              if (made) made.remove();
              list.insertBefore(li, list.children[idx] || null); /* back where it was */
              li.classList.remove("leaving");
              syncEmpty();
            } } : undefined,
          });
        });
      }
    });
    syncEmpty();
  });

  /* ---------- timebox ----------
     <article data-timebox data-minutes="25"> containing a .timebox with a
     .gauge, [data-tb-clock], and [data-tb-start] / [data-tb-add="5"] /
     [data-tb-done] controls. Visible time, gentle end nudge. */
  document.querySelectorAll("[data-timebox]").forEach((box) => {
    const wrap = box.querySelector(".timebox") || box;
    const gaugeEl = box.querySelector(".gauge");
    const clock = box.querySelector("[data-tb-clock]");
    const startBtn = box.querySelector("[data-tb-start]");
    let total = Math.max(60, (parseFloat(box.getAttribute("data-minutes")) || 25) * 60);
    /* anchored to wall-clock: a backgrounded tab throttles intervals, and
       counting ticks would silently hand back minutes that never happened */
    let remain = total, timer = 0, running = false, deadline = 0;
    function render() {
      if (clock) {
        const m = Math.floor(remain / 60), s = Math.floor(remain % 60);
        clock.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      }
      if (gaugeEl) setProgress(gaugeEl, (remain / total) * 100);
      wrap.classList.toggle("tb-low", running && remain > 0 && remain <= 120);
    }
    function stop() {
      running = false;
      clearInterval(timer);
      if (startBtn) startBtn.textContent = remain > 0 ? "Resume" : "Start";
    }
    function tick() {
      remain = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      if (remain <= 0) {
        remain = 0;
        stop();
        wrap.classList.add("tb-done");
        nudge("Timebox complete — stretch, water, then pick the next thing.", { snoozeMs: 5 * 60 * 1000 });
      }
      render();
    }
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (running) { stop(); startBtn.textContent = "Resume"; return; }
        if (remain <= 0) { remain = total; wrap.classList.remove("tb-done"); }
        running = true;
        deadline = Date.now() + remain * 1000;
        timer = setInterval(tick, 1000);
        startBtn.textContent = "Pause";
      });
    }
    box.querySelectorAll("[data-tb-add]").forEach((b) => {
      b.addEventListener("click", () => {
        const mins = parseFloat(b.getAttribute("data-tb-add")) || 5;
        remain += mins * 60;
        if (running) deadline += mins * 60 * 1000;
        total = Math.max(total, remain);
        wrap.classList.remove("tb-done");
        render();
      });
    });
    box.querySelectorAll("[data-tb-done]").forEach((b) => {
      b.addEventListener("click", () => {
        stop();
        wrap.classList.add("tb-done");
        wrap.classList.remove("tb-low");
        toast("Focus block logged. Nice.", "ok");
      });
    });
    render();
  });

  /* ---------- chat: reactions + pin-to-decision-log ----------
     .msg-react chips toggle (with a trailing count when present);
     [data-pin-to="#decisions"] copies the message into a decision entry. */
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;
    const pin = e.target.closest("[data-pin-to]");
    if (pin) {
      const targetSel = pin.getAttribute("data-pin-to");
      const target = document.querySelector(targetSel);
      const msg = pin.closest(".msg");
      if (target && msg && pin.getAttribute("aria-pressed") !== "true") {
        const art = document.createElement("article");
        art.className = "decision";
        const head = document.createElement("header");
        head.className = "decision-head";
        const chip = document.createElement("span");
        chip.className = "pill pill-ok";
        chip.textContent = "DECIDED";
        const by = document.createElement("span");
        by.className = "byline";
        const u = msg.getAttribute("data-user");
        if (u) by.appendChild(whoChip(u));
        by.appendChild(document.createTextNode(" pinned · just now"));
        head.append(chip, by);
        const p = document.createElement("p");
        p.className = "decision-text";
        p.textContent = (msg.querySelector(".msg-bubble") || msg).textContent.trim();
        art.append(head, p);
        target.prepend(art);
        pin.setAttribute("aria-pressed", "true");
        toast("Pinned to the decision log", "ok");
      }
      return;
    }
    const react = e.target.closest(".msg-react button.pill");
    if (react) {
      const on = react.getAttribute("aria-pressed") === "true";
      const m = react.textContent.match(/^(.*?)(\d+)\s*$/);
      if (m) {
        const n = Math.max(0, parseInt(m[2], 10) + (on ? -1 : 1));
        react.textContent = n > 0 ? m[1] + n : m[1].trim();
      }
      react.setAttribute("aria-pressed", String(!on));
    }
  });

  /* selector-safe lookup: an author's empty or malformed data-* value must
     never throw at load time — that would abort the rest of this IIFE and
     silently take window.vertebra with it */
  function q(sel) {
    if (!sel) return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  /* ---------- app shell ----------
     <body class="shell"> + [data-shell-toggle] collapses the sidebar to
     icons ([data-shell-collapsed] on <html>, persisted). Sidebar and tabbar
     links sync their .active state from the current hash/path. */
  if (document.querySelector(".shell")) {
    if (safeGet("shell-collapsed") === "1") root.setAttribute("data-shell-collapsed", "");
    document.querySelectorAll("[data-shell-toggle]").forEach((btn) => {
      const sync = () => {
        const on = root.hasAttribute("data-shell-collapsed");
        btn.setAttribute("aria-pressed", String(on));
        /* the visible text is the accessible name (WCAG 2.5.3 Label in Name),
           so change BOTH together rather than overriding with aria-label */
        btn.removeAttribute("aria-label");
        const txt = btn.querySelector(".sidebar-text");
        if (txt) txt.textContent = on ? "Expand" : "Collapse";
        else btn.textContent = on ? "›› Expand" : "‹‹ Collapse";
      };
      sync();
      btn.addEventListener("click", () => {
        const on = root.hasAttribute("data-shell-collapsed");
        if (on) root.removeAttribute("data-shell-collapsed");
        else root.setAttribute("data-shell-collapsed", "");
        safeSet("shell-collapsed", on ? "0" : "1");
        sync();
      });
    });
  }

  /* ---------- route highlight ----------
     Any .sidebar/.tabbar link whose href matches the current hash (or path)
     gets .active + aria-current. Hash routing is what the mockups use; mark
     one link [data-route-default] so the landing state is highlighted too. */
  const routeNavs = document.querySelectorAll(".sidebar, .tabbar");
  if (routeNavs.length) {
    const syncRoute = () => {
      const hash = location.hash || "";
      const path = location.pathname.split("/").pop();
      routeNavs.forEach((navEl) => {
        navEl.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href");
          const on = href && (
            href === hash ||
            (!hash && (href === path || a.hasAttribute("data-route-default"))) ||
            (href.startsWith("#") && href.length > 1 &&
              (hash.startsWith(href + "/") || hash.startsWith(href + "?"))));
          a.classList.toggle("active", !!on);
          if (on) a.setAttribute("aria-current", "page");
          else a.removeAttribute("aria-current");
        });
      });
    };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
  }

  /* ---------- fab speed dial ----------
     <button class="fab" data-fab="#dial-id"> + <div class="fab-dial" id="…">
     Click toggles; Escape or an outside press closes; focus returns. */
  document.querySelectorAll("[data-fab]").forEach((fab) => {
    const dial = q(fab.getAttribute("data-fab"));
    if (!dial) return;
    fab.setAttribute("aria-expanded", "false");
    function setOpen(open) {
      if (open) {
        dial.setAttribute("data-open", "");
        fab.setAttribute("aria-expanded", "true");
        layer.open(dial, { kind: "pop", trigger: fab, onClose: () => {
          dial.removeAttribute("data-open");
          fab.setAttribute("aria-expanded", "false");
        } });
        const first = dial.querySelector("button");
        if (first) first.focus();
      } else {
        layer.close(dial);
      }
    }
    fab.addEventListener("click", () => setOpen(fab.getAttribute("aria-expanded") !== "true"));
    /* capture phase: the dial must close BEFORE the item's own click handler
       runs, or layer.close(dial) unwinds the sheet that handler just opened */
    dial.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest("button")) setOpen(false);
    }, true);
    document.addEventListener("pointerdown", (e) => {
      if (fab.getAttribute("aria-expanded") === "true" &&
          !(e.target instanceof Element && (dial.contains(e.target) || fab.contains(e.target)))) setOpen(false);
    });
  });

  /* ---------- bottom sheet ----------
     [data-sheet-open="#id"] opens <div class="sheet" id="id" hidden>.
     Closes on: scrim press, [data-sheet-close], Escape (layer), or a
     drag-down past a third of the panel (gesture util). */
  const sheetApi = {
    open(sheet, trigger) {
      if (!sheet || !sheet.hasAttribute("hidden")) return;
      sheet.hidden = false;
      sheet.classList.remove("closing");
      layer.open(sheet, { kind: "sheet", lock: true, trigger: trigger, onClose: () => closeSheet(sheet) });
      const focusable = sheet.querySelector("[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable) focusable.focus();
    },
    close(sheet) { layer.close(sheet); },
  };
  function closeSheet(sheet) {
    if (sheet.hasAttribute("hidden")) return;
    const panel = sheet.querySelector(".sheet-panel");
    const finish = () => {
      sheet.hidden = true;
      sheet.classList.remove("closing");
      if (panel) panel.style.transform = "";
    };
    if (reducedMotion.matches) { finish(); return; }
    sheet.classList.add("closing");
    setTimeout(finish, 210);
  }
  document.querySelectorAll("[data-sheet-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sheetApi.open(q(btn.getAttribute("data-sheet-open")), btn);
    });
  });
  document.querySelectorAll(".sheet").forEach((sheet) => {
    const panel = sheet.querySelector(".sheet-panel");
    sheet.addEventListener("click", (e) => { if (e.target === sheet) layer.close(sheet); });
    sheet.querySelectorAll("[data-sheet-close]").forEach((b) =>
      b.addEventListener("click", () => layer.close(sheet)));
    const grab = sheet.querySelector(".sheet-grab");
    if (grab && panel) {
      let h = 0;
      gesture(grab, {
        onDragStart: () => {
          h = panel.getBoundingClientRect().height;
          panel.style.transition = "none";
        },
        onDragMove: (e, d) => { panel.style.transform = "translateY(" + Math.max(0, d.dy) + "px)"; },
        onDragEnd: (e, d) => {
          panel.style.transition = "";
          const far = d.dy > h / 3;
          panel.style.transform = "";
          if (far && !d.cancelled) layer.close(sheet);
        },
        onSwipe: (e, sw) => { if (sw.dir === "down") layer.close(sheet); },
      });
    }
  });

  /* ---------- modal auto-degrade ----------
     <dialog class="modal" data-overlay="auto" data-sheet="#id"> uses the
     dialog on desktop and the named sheet under the mobile breakpoint.
     Opt-in only — existing modals are untouched. */
  const phone = window.matchMedia("(max-width: 860px)");
  document.querySelectorAll("[data-modal-open]").forEach((btn) => {
    const dlg = q(btn.getAttribute("data-modal-open"));
    if (!dlg || dlg.getAttribute("data-overlay") !== "auto") return;
    const sheet = q(dlg.getAttribute("data-sheet"));
    if (!sheet) return;
    btn.addEventListener("click", (e) => {
      if (!phone.matches) return;         /* desktop: the modal handler runs */
      e.stopImmediatePropagation();       /* phone: swallow it, open the sheet */
      e.preventDefault();
      if (dlg.open) dlg.close();
      sheetApi.open(sheet, btn);
    }, true);
  });

  /* ---------- tree (ARIA tree) ----------
     <ul class="tree" role="tree"> of <li role="none"> whose .tree-row is
     role="treeitem". Keyboard: up/down move, right expands/descends, left
     collapses/ascends, Home/End jump, Enter/Space select. */
  /* initTree is exposed as vertebra.tree.init(el) because a tree that is
     built AFTER load -- by a script, from data -- would otherwise get none of
     this: no roving tabindex, no arrow keys, no selection event. Auto-init
     below is unchanged; this is the same code reachable on demand. */
  function initTree(tree) {
    if (tree.dataset.treeInit) return;
    tree.dataset.treeInit = "1";
    const rows = () => Array.from(tree.querySelectorAll('.tree-row')).filter((r) => {
      /* skip rows inside a collapsed branch */
      let p = r.parentElement;
      while (p && p !== tree) {
        if (p.tagName === "UL") {
          const owner = p.previousElementSibling;
          if (owner && owner.getAttribute("aria-expanded") === "false") return false;
        }
        p = p.parentElement;
      }
      return true;
    });
    function focusRow(r) {
      /* reset every row, including ones inside collapsed branches — otherwise
         a hidden row keeps tabIndex 0 and the tree gets two tab stops */
      tree.querySelectorAll(".tree-row").forEach((x) => { x.tabIndex = x === r ? 0 : -1; });
      /* a row revealed by the same keystroke that expanded its parent may
         not be laid out yet — flush, then retry once on the next frame */
      void r.offsetHeight;
      r.focus();
      if (document.activeElement !== r) requestAnimationFrame(() => r.focus());
    }
    function toggle(r, open) {
      if (!r.hasAttribute("aria-expanded")) return false;
      r.setAttribute("aria-expanded", String(open));
      return true;
    }
    tree.querySelectorAll(".tree-row").forEach((r, i) => {
      r.tabIndex = i === 0 ? 0 : -1;
      if (!r.getAttribute("role")) r.setAttribute("role", "treeitem");
      r.addEventListener("click", () => {
        if (r.hasAttribute("aria-expanded")) toggle(r, r.getAttribute("aria-expanded") !== "true");
        tree.querySelectorAll('.tree-row[aria-selected="true"]').forEach((x) => x.setAttribute("aria-selected", "false"));
        r.setAttribute("aria-selected", "true");
        focusRow(r);
        tree.dispatchEvent(new CustomEvent("vertebra:tree", { bubbles: true, detail: { row: r } }));
      });
      r.addEventListener("keydown", (e) => {
        const list = rows();
        const i2 = list.indexOf(r);
        if (e.key === "ArrowDown") { e.preventDefault(); if (list[i2 + 1]) focusRow(list[i2 + 1]); }
        else if (e.key === "ArrowUp") { e.preventDefault(); if (list[i2 - 1]) focusRow(list[i2 - 1]); }
        else if (e.key === "Home") { e.preventDefault(); focusRow(list[0]); }
        else if (e.key === "End") { e.preventDefault(); focusRow(list[list.length - 1]); }
        else if (e.key === "ArrowRight") {
          e.preventDefault();
          if (r.getAttribute("aria-expanded") === "false") toggle(r, true);
          else if (list[i2 + 1]) focusRow(list[i2 + 1]);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (r.getAttribute("aria-expanded") === "true") toggle(r, false);
          else {
            /* climb to the owning row */
            let p = r.parentElement;
            while (p && p !== tree) {
              if (p.tagName === "UL" && p.previousElementSibling &&
                  p.previousElementSibling.classList.contains("tree-row")) {
                focusRow(p.previousElementSibling); break;
              }
              p = p.parentElement;
            }
          }
        } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.click(); }
      });
    });
  }
  document.querySelectorAll('.tree[role="tree"]').forEach(initTree);

  /* ---------- combobox ----------
     One engine, three skins (spec section 2):
       <div class="combo" data-combo>            input + listbox
       <div class="combo" data-combo data-combo-chips>   chips accumulate
       <textarea data-mention>                    @-mention popover
     Options come from data-combo-options (JSON array of strings/objects) or
     a callback registered with vertebra.combo.source(el, fn). */
  const comboSources = new WeakMap();
  function comboOptions(host) {
    const fn = comboSources.get(host);
    if (fn) return fn;
    let list = [];
    try { list = JSON.parse(host.getAttribute("data-combo-options") || host.getAttribute("data-mention-options") || "[]"); }
    catch (e) { list = []; }
    return (q) => list.filter((o) => String(o.label || o).toLowerCase().includes(q.toLowerCase()));
  }
  let comboSeq = 0;
  function buildComboList(host, cls) {
    const ul = document.createElement("ul");
    ul.className = "combo-list" + (cls ? " " + cls : "");
    ul.id = "vcombo-" + ++comboSeq;
    ul.setAttribute("role", "listbox");
    ul.hidden = true;
    host.appendChild(ul);
    return ul;
  }
  function renderOptions(ul, opts, q, onPick) {
    ul.textContent = "";
    if (!opts.length) {
      const li = document.createElement("li");
      li.className = "combo-empty";
      li.textContent = "No matches";
      ul.appendChild(li);
      return [];
    }
    return opts.map((o, i) => {
      const label = String(o.label || o);
      const li = document.createElement("li");
      li.className = "combo-opt";
      li.id = ul.id + "-o" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      const at = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
      if (at >= 0 && q) {
        li.append(document.createTextNode(label.slice(0, at)));
        const m = document.createElement("mark");
        m.textContent = label.slice(at, at + q.length);
        li.append(m, document.createTextNode(label.slice(at + q.length)));
      } else li.textContent = label;
      if (o.user) li.prepend(whoChip(o.user, "who-sm"));
      /* pointerdown's preventDefault keeps the input from blurring; click is
         what assistive tech and voice control actually dispatch */
      let claimed = false;
      li.addEventListener("pointerdown", (e) => { e.preventDefault(); claimed = true; onPick(o, li); });
      li.addEventListener("click", () => { if (!claimed) onPick(o, li); claimed = false; });
      ul.appendChild(li);
      return li;
    });
  }
  /* does anything between el and <body> clip its overflow? */
  function inScroller(el) {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const o = getComputedStyle(p);
      if (o.overflow !== "visible" || o.overflowY !== "visible" || o.overflowX !== "visible") return true;
      p = p.parentElement;
    }
    return false;
  }

  function wireCombo(host) {
    const input = host.querySelector("input");
    if (!input) return;
    const chipsMode = host.hasAttribute("data-combo-chips");
    const ul = buildComboList(host);
    let items = [], idx = -1, portalled = false;
    /* Inside a scrolling box the absolutely-positioned list is clipped, so
       move it to <body> and place it in viewport coordinates instead. */
    function placeList() {
      if (ul.hidden) return;
      if (!portalled && inScroller(host)) {
        document.body.appendChild(ul);
        ul.classList.add("portalled");
        portalled = true;
      }
      if (!portalled) return;
      const r = input.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 8;
      ul.style.width = Math.max(r.width, 180) + "px";
      ul.style.left = Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8) + "px";
      const h = ul.offsetHeight;
      if (below < Math.min(h, 200) && r.top > below) {
        ul.style.top = Math.max(8, r.top - h - 4) + "px";
      } else {
        ul.style.top = (r.bottom + 4) + "px";
      }
    }
    function unportal() {
      if (!portalled) return;
      ul.classList.remove("portalled");
      ul.style.cssText = "";
      host.appendChild(ul);
      portalled = false;
    }
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", ul.id);
    input.setAttribute("autocomplete", "off");
    function close() {
      if (!ul.hidden) layer.close(ul);
      ul.hidden = true;
      unportal();
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      idx = -1;
    }
    window.addEventListener("resize", placeList);
    document.addEventListener("scroll", placeList, true);
    function highlight(n) {
      if (!items.length) return;
      idx = (n + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute("aria-selected", String(i === idx)));
      input.setAttribute("aria-activedescendant", items[idx].id);
      items[idx].scrollIntoView({ block: "nearest" });
    }
    function pick(o) {
      const label = String(o.label || o);
      const bag = host.querySelector(".combo-chips");
      if (chipsMode && bag) {
        const chip = document.createElement("span");
        chip.className = "pill pill-x";
        chip.append(document.createTextNode(label + " "));
        const x = document.createElement("button");
        x.type = "button";
        x.setAttribute("aria-label", "Remove " + label);
        x.textContent = "×";
        x.addEventListener("click", () => { chip.remove(); input.focus(); });
        chip.appendChild(x);
        bag.insertBefore(chip, input);
        input.value = "";
      } else {
        input.value = label;
      }
      close();
      host.dispatchEvent(new CustomEvent("vertebra:combo", { bubbles: true, detail: { value: o } }));
    }
    let seq = 0;
    function refresh() {
      const q = input.value.trim();
      const token = ++seq;
      Promise.resolve(comboOptions(host)(q)).then((opts) => {
        if (token !== seq) return; /* a newer keystroke already answered */
        items = renderOptions(ul, opts || [], q, pick);
        if (ul.hidden) {
          ul.hidden = false;
          /* register on the stack so Escape dismisses the popup, not the
             sheet or modal containing it */
          layer.open(ul, { kind: "pop", trigger: input, onClose: () => { ul.hidden = true; input.setAttribute("aria-expanded", "false"); } });
        }
        placeList();
        input.setAttribute("aria-expanded", "true");
        idx = -1;
      });
    }
    input.addEventListener("input", refresh);
    input.addEventListener("focus", refresh);
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (ul.hidden) refresh(); else highlight(idx + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(idx - 1); }
      else if (e.key === "Enter") {
        if (idx >= 0 && items[idx]) { e.preventDefault(); items[idx].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }
      } else if (e.key === "Escape") {
        if (!ul.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
      } else if (e.key === "Backspace" && chipsMode && !input.value) {
        const last = input.previousElementSibling;
        if (last && last.classList.contains("pill")) last.remove();
      }
    });
  }
  document.querySelectorAll("[data-combo]").forEach(wireCombo);

  /* @-mention: same listbox, triggered mid-text in a textarea */
  document.querySelectorAll("[data-mention]").forEach((ta) => {
    const host = document.createElement("span");
    host.className = "combo";
    host.style.position = "relative";
    ta.parentNode.insertBefore(host, ta);
    host.appendChild(ta);
    const ul = buildComboList(host, "combo-mention");
    let items = [], idx = -1, at = -1;
    const trigger = ta.getAttribute("data-mention") || "@";
    ta.setAttribute("role", "combobox");
    ta.setAttribute("aria-autocomplete", "list");
    ta.setAttribute("aria-expanded", "false");
    ta.setAttribute("aria-controls", ul.id);
    function close() {
      ul.hidden = true; idx = -1; at = -1;
      ta.setAttribute("aria-expanded", "false");
      ta.removeAttribute("aria-activedescendant");
    }
    function insert(o) {
      const label = String(o.label || o);
      const v = ta.value;
      ta.value = v.slice(0, at) + trigger + label + " " + v.slice(ta.selectionStart);
      const pos = at + label.length + 2;
      ta.setSelectionRange(pos, pos);
      close();
      ta.focus();
    }
    ta.addEventListener("input", () => {
      const pos = ta.selectionStart;
      const upto = ta.value.slice(0, pos);
      const m = upto.match(new RegExp("\\" + trigger + "([\\w-]*)$"));
      if (!m) { close(); return; }
      at = pos - m[0].length;
      Promise.resolve(comboOptions(ta)(m[1])).then((opts) => {
        items = renderOptions(ul, opts || [], m[1], insert);
        ul.hidden = false;
        ta.setAttribute("aria-expanded", "true");
        if (items[0]) { ta.setAttribute("aria-activedescendant", items[0].id); }
        /* park it under the textarea's caret line, clamped to the host */
        const rows = upto.split("\n").length;
        ul.style.top = Math.min(rows * 20 + 8, ta.offsetHeight) + "px";
        idx = -1;
      });
    });
    ta.addEventListener("keydown", (e) => {
      if (ul.hidden) return;
      const mark = () => { items.forEach((li, i) => li.setAttribute("aria-selected", String(i === idx))); if (items[idx]) ta.setAttribute("aria-activedescendant", items[idx].id); };
      if (e.key === "ArrowDown") { e.preventDefault(); idx = (idx + 1) % items.length; mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; mark(); }
      else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); items[idx].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    });
    ta.addEventListener("blur", () => setTimeout(close, 120));
  });

  /* ---------- command palette ----------
     <div class="cmdk" id="cmdk" hidden> … Ctrl/Cmd-K toggles it. Results
     come from vertebra.cmdk.source(fn) or the [data-cmdk-items] JSON:
     [{label, kind, group, href, action}]. */
  const cmdkEl = document.querySelector(".cmdk");
  let cmdkSource = null, cmdkApi = null;
  if (cmdkEl) {
    const input = cmdkEl.querySelector("input");
    let results = cmdkEl.querySelector(".cmdk-results");
    if (!results) { /* tolerate a panel without one rather than throwing later */
      results = document.createElement("div");
      results.className = "cmdk-results";
      (cmdkEl.querySelector(".cmdk-panel") || cmdkEl).appendChild(results);
    }
    let items = [], idx = -1;
    let staticItems = [];
    try { staticItems = JSON.parse(cmdkEl.getAttribute("data-cmdk-items") || "[]"); } catch (e) { staticItems = []; }
    if (input) {
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-autocomplete", "list");
      if (results && !results.id) results.id = "vcmdk-results";
      if (results) {
        results.setAttribute("role", "listbox");
        input.setAttribute("aria-controls", results.id);
      }
    }
    let cmdkSeq = 0;
    function query(q) {
      const src = cmdkSource || ((s2) => staticItems.filter((it) =>
        String(it.label).toLowerCase().includes(s2.toLowerCase())));
      const token = ++cmdkSeq;
      return Promise.resolve(src(q)).then((r) => (token === cmdkSeq ? r : null));
    }
    function render(list) {
      if (!list) return; /* superseded response */
      results.textContent = "";
      items = [];
      if (!list.length) {
        const p = document.createElement("p");
        p.className = "combo-empty";
        p.textContent = "Nothing matches. Try fewer words.";
        results.appendChild(p);
        return;
      }
      let group = null;
      list.forEach((it, i) => {
        if (it.group && it.group !== group) {
          group = it.group;
          const g = document.createElement("p");
          g.className = "cmdk-group";
          g.setAttribute("role", "presentation"); /* not a listbox child */
          g.textContent = group;
          results.appendChild(g);
        }
        const el = document.createElement(it.href ? "a" : "button");
        el.className = "cmdk-item";
        el.setAttribute("role", "option");
        el.tabIndex = -1; /* the input keeps focus; options are virtual */
        el.setAttribute("aria-selected", "false");
        el.id = "vcmdk-i" + i;
        if (it.href) el.href = it.href; else el.type = "button";
        const label = document.createElement("span");
        label.textContent = it.label;
        el.appendChild(label);
        if (it.kind) {
          const k = document.createElement("span");
          k.className = "cmdk-item-kind";
          k.textContent = it.kind;
          el.appendChild(k);
        }
        el.addEventListener("click", () => {
          closeCmdk();
          if (typeof it.action === "function") it.action();
          cmdkEl.dispatchEvent(new CustomEvent("vertebra:cmdk", { bubbles: true, detail: { item: it } }));
        });
        results.appendChild(el);
        items.push(el);
      });
      idx = -1;
      highlight(0);
    }
    function highlight(n) {
      if (!items.length) return;
      idx = (n + items.length) % items.length;
      items.forEach((el, i) => el.setAttribute("aria-selected", String(i === idx)));
      if (input) input.setAttribute("aria-activedescendant", items[idx].id);
      items[idx].scrollIntoView({ block: "nearest" });
    }
    function openCmdk(trigger) {
      if (!cmdkEl.hidden) return;
      cmdkEl.hidden = false;
      layer.open(cmdkEl, { kind: "palette", lock: true, trigger: trigger || document.activeElement, onClose: () => { cmdkEl.hidden = true; } });
      if (input) { input.value = ""; input.focus(); }
      query("").then(render);
    }
    function closeCmdk() { layer.close(cmdkEl); }
    cmdkEl.addEventListener("click", (e) => { if (e.target === cmdkEl) closeCmdk(); });
    if (input) {
      input.addEventListener("input", () => query(input.value.trim()).then(render));
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); highlight(idx + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); highlight(idx - 1); }
        else if (e.key === "Enter" && items[idx]) { e.preventDefault(); items[idx].click(); }
      });
    }
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (cmdkEl.hidden) openCmdk(document.activeElement); else closeCmdk();
      }
    });
    document.querySelectorAll("[data-cmdk-open]").forEach((b) =>
      b.addEventListener("click", () => openCmdk(b)));
    cmdkApi = { open: openCmdk, close: closeCmdk, source: (fn) => { cmdkSource = fn; } };
  }

  /* ---------- swipe deck ----------
     <div class="deck" data-deck data-deck-right="Keep" data-deck-left="Drop"
          data-deck-up="Later"> of .deck-card children. Swipe or press the
     action buttons / arrow keys; every disposition is undoable. */
  document.querySelectorAll("[data-deck]").forEach((deck) => {
    const labels = {
      right: deck.getAttribute("data-deck-right") || "Keep",
      left: deck.getAttribute("data-deck-left") || "Drop",
      up: deck.getAttribute("data-deck-up") || "Later",
    };
    const emptyEl = deck.querySelector(".deck-empty");
    /* controls and counters commonly sit beside the deck, not inside it */
    const scope = q(deck.getAttribute("data-deck-scope")) || deck.parentElement || deck;
    const history = [];
    function cards() { return Array.from(deck.querySelectorAll(".deck-card:not([data-disposing])")); }
    /* Seed each card's jitter ONCE and keep it on the element, so a card does
       not shuffle its own tilt every time the pile is restacked — the pile
       should settle, not twitch. */
    function seed(c) {
      if (c.dataset.seeded) return;
      c.dataset.seeded = "1";
      /* Signed magnitude, never near zero: a plain random() happily returns
         0.02deg, and a card that lands dead square in a pile of leaning ones
         looks like a bug rather than like chance. */
      var jit = function (lo, hi) {
        return (Math.random() < 0.5 ? -1 : 1) * (lo + Math.random() * (hi - lo));
      };
      c.style.setProperty("--tilt", jit(0.45, 0.95).toFixed(2) + "deg");
      c.style.setProperty("--dx", jit(1.2, 2.6).toFixed(1) + "px");
    }
    function restack() {
      cards().forEach((c, i) => { seed(c); c.setAttribute("data-depth", String(Math.min(4, i))); });
      const n = cards().length;
      if (emptyEl) emptyEl.hidden = n > 0;
      scope.querySelectorAll("[data-deck-count]").forEach((el) => { el.textContent = String(n); });
      if (n === 0) deck.dispatchEvent(new CustomEvent("vertebra:deck-empty", { bubbles: true }));
    }
    deck.querySelectorAll(".deck-stamp").forEach((el) => el.setAttribute("aria-hidden", "true"));
    function stampFor(card, dir) { return card.querySelector(".deck-stamp-" + dir); }
    function dispose(card, dir) {
      if (!card) return;
      if (card.hasAttribute("data-disposing")) return; /* already flying */
      card.setAttribute("data-disposing", "");
      /* a selector list returns document order, so probe in priority order */
      const titleEl = card.querySelector(".deck-title") || card.querySelector("h3") ||
        card.querySelector("p:not(.byline)") || card;
      const label = titleEl.textContent.trim().slice(0, 48);
      const parent = card.parentNode;
      const next = card.nextSibling;
      const fling = dir === "up" ? "translateY(-140%)" : "translateX(" + (dir === "right" ? "" : "-") + "140%) rotate(" + (dir === "right" ? 14 : -14) + "deg)";
      card.classList.add("flung");
      card.style.transform = fling;
      const finish = () => {
        card.remove();
        card.classList.remove("flung", "dragging");
        card.style.transform = "";
        card.removeAttribute("data-disposing");
        restack();
      };
      let timer = 0;
      if (reducedMotion.matches) finish(); else timer = setTimeout(finish, 320);
      history.push({ card: card, parent: parent, next: next, timer: timer });
      say(label + " — " + labels[dir] + ". " + (cards().length - 1) + " left.");
      deck.dispatchEvent(new CustomEvent("vertebra:deck", { bubbles: true, detail: { card: card, disposition: dir, label: labels[dir] } }));
      toast(labels[dir] + " — " + label, "info", {
        action: { label: "UNDO", fn: undo },
      });
    }
    function undo() {
      const last = history.pop();
      if (!last) return;
      /* undo inside the fling window must cancel the pending removal, or the
         timer fires afterwards and deletes the restored card */
      if (last.timer) clearTimeout(last.timer);
      last.card.removeAttribute("data-disposing");
      last.card.classList.remove("flung", "dragging");
      last.card.style.transform = "";
      last.parent.insertBefore(last.card, last.next);
      last.card.style.transform = "";
      last.card.classList.remove("flung");
      restack();
      say("Restored.");
    }
    scope.querySelectorAll("[data-deck-do]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = btn.getAttribute("data-deck-do");
        if (dir === "undo") undo(); else dispose(cards()[0], dir);
      });
    });
    deck.addEventListener("keydown", (e) => {
      const map = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "up" };
      if (map[e.key]) { e.preventDefault(); dispose(cards()[0], map[e.key]); }
    });
    gesture(deck, {
      accept: (e) => {
        const c = e.target instanceof Element ? e.target.closest(".deck-card") : null;
        return !!c && c === cards()[0] && !e.target.closest("button, a");
      },
      onDragStart: () => { const c = cards()[0]; if (c) c.classList.add("dragging"); },
      onDragMove: (e, d) => {
        const c = cards()[0];
        if (!c) return;
        c.style.transform = "translate(" + d.dx + "px," + d.dy + "px) rotate(" + (d.dx / 22) + "deg)";
        const right = stampFor(c, "right"), left = stampFor(c, "left"), up = stampFor(c, "up");
        if (right) right.style.opacity = String(Math.max(0, Math.min(1, d.dx / 90)));
        if (left) left.style.opacity = String(Math.max(0, Math.min(1, -d.dx / 90)));
        if (up) up.style.opacity = String(Math.max(0, Math.min(1, -d.dy / 90)) * (Math.abs(d.dx) < 60 ? 1 : 0));
      },
      onDragEnd: (e, d) => {
        const c = cards()[0];
        if (!c) return;
        c.classList.remove("dragging");
        ["right", "left", "up"].forEach((k) => { const s = stampFor(c, k); if (s) s.style.opacity = "0"; });
        const dir = Math.abs(d.dx) > 110 ? (d.dx > 0 ? "right" : "left") : (d.dy < -110 ? "up" : null);
        if (dir && !d.cancelled) dispose(c, dir);
        else c.style.transform = "";
      },
    });
    restack();
  });

  /* ---------- board (kanban) ----------
     <div class="board" data-board> of .board-col[data-cap] each containing a
     .board-list. Cards move between columns by pointer drag or, from the
     keyboard, by grabbing the card's .drag-h and using left/right arrows.
     Columns past data-cap get .over (Now/Next/Later's WIP caps). */
  document.querySelectorAll("[data-board]").forEach((board) => {
    const lists = () => Array.from(board.querySelectorAll(".board-list"));
    function syncCounts() {
      board.querySelectorAll(".board-col").forEach((col) => {
        const list = col.querySelector(".board-list");
        const n = list ? list.querySelectorAll(".board-card").length : 0;
        const cap = parseInt(col.getAttribute("data-cap") || "0", 10);
        col.querySelectorAll("[data-board-count]").forEach((el) => {
          el.textContent = cap ? n + " / " + cap : String(n);
        });
        col.classList.toggle("over", !!cap && n > cap);
      });
      board.dispatchEvent(new CustomEvent("vertebra:board", { bubbles: true }));
    }
    let card = null, fromList = null, line = null, lift = null, origin = null;
    function lineEl() {
      if (!line) {
        line = document.createElement("li");
        line.className = "sort-line";
        line.setAttribute("aria-hidden", "true");
      }
      return line;
    }
    function listAt(x, y) {
      return lists().find((l) => {
        const r = l.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top - 40 && y <= r.bottom + 40;
      }) || null;
    }
    function place(x, y) {
      const target = listAt(x, y);
      lists().forEach((l) => l.classList.toggle("drop-active", l === target));
      if (!target) { if (line) line.remove(); return; }
      let before = null;
      Array.from(target.querySelectorAll(".board-card")).forEach((c) => {
        if (c === card || before) return;
        const r = c.getBoundingClientRect();
        if (y < r.top + r.height / 2) before = c;
      });
      target.insertBefore(lineEl(), before);
    }
    let pendingCard = null;
    gesture(board, {
      accept: (e) => !!(e.target instanceof Element && e.target.closest(".drag-h")),
      onPress: (e) => {
        const h = e.target instanceof Element ? e.target.closest(".drag-h") : null;
        pendingCard = h ? h.closest(".board-card") : null;
      },
      onDragStart: (e) => {
        card = pendingCard;
        if (!card) return;
        fromList = card.parentElement;
        origin = { parent: card.parentNode, next: card.nextElementSibling };
        lift = liftBegin(card, e);
        lineEl().classList.add("sort-slot");
        lineEl().style.height = lift.height + "px";
        place(e.clientX, e.clientY);
      },
      onDragMove: (e) => { if (lift) lift.move(e); if (card) place(e.clientX, e.clientY); },
      onDragEnd: (e, d) => {
        pendingCard = null;
        if (!card) return;
        lists().forEach((l) => l.classList.remove("drop-active"));
        const landed = !d.cancelled && line && line.parentNode;
        if (landed) {
          line.parentNode.insertBefore(card, line);
        } else if (origin) {
          const next = origin.next && origin.next.parentNode === origin.parent ? origin.next : null;
          origin.parent.insertBefore(card, next);
        }
        if (line) line.remove();
        if (lift) lift.settle();
        if (landed) {
          syncCounts();
          const colName = card.closest(".board-col");
          say((card.querySelector(".board-card-title") || card).textContent.trim().slice(0, 40) +
              " moved to " + ((colName && colName.querySelector(".label")) ? colName.querySelector(".label").textContent.trim() : "column") + ".");
        }
        card = null; fromList = null; lift = null; origin = null;
      },
    });
    /* keyboard: grab a card's handle, left/right to change column */
    board.addEventListener("keydown", (e) => {
      const h = e.target instanceof Element ? e.target.closest(".drag-h") : null;
      if (!h) return;
      const c = h.closest(".board-card");
      if (!c) return;
      /* left/right change column, up/down reorder within the column — one
         drag context, both axes, no mouse required */
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const sib = e.key === "ArrowUp" ? c.previousElementSibling : c.nextElementSibling;
        if (!sib) return;
        c.parentElement.insertBefore(c, e.key === "ArrowUp" ? sib : sib.nextElementSibling);
        h.focus();
        say((c.querySelector(".board-card-title") || c).textContent.trim().slice(0, 40) +
            " moved " + (e.key === "ArrowUp" ? "up" : "down") + ".");
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const all = lists();
      const i = all.indexOf(c.parentElement);
      const next = all[e.key === "ArrowRight" ? i + 1 : i - 1];
      if (!next) return;
      next.appendChild(c);
      h.focus();
      syncCounts();
      const col = next.closest(".board-col");
      say((c.querySelector(".board-card-title") || c).textContent.trim().slice(0, 40) +
          " moved to " + ((col && col.querySelector(".label")) ? col.querySelector(".label").textContent.trim() : "column") + ".");
    });
    syncCounts();
  });

  /* ---------- piles (THE LIST) ----------
     <div class="piles" data-piles> of .pile sections, each with an editable
     .pile-name and a .pile-list of .pile-card items. Cards drag between
     zones (lift physics + card-sized slot); [data-pile-add] creates a zone.
     Everything is DELEGATED off the wrapper, so apps may re-render the
     zones/cards freely. Emits: "vertebra:pile-move" { item, from, to },
     "vertebra:pile-add" { pile }, "vertebra:pile-rename" { pile, name }. */
  document.querySelectorAll("[data-piles]").forEach((wrap) => {
    const lists = () => Array.from(wrap.querySelectorAll(".pile-list"));
    function pileName(list) {
      const p = list.closest(".pile");
      const inp = p && p.querySelector(".pile-name");
      return inp ? inp.value : "pile";
    }
    function syncCounts() {
      wrap.querySelectorAll(".pile").forEach((p) => {
        const n = p.querySelectorAll(".pile-card").length;
        p.querySelectorAll("[data-pile-count]").forEach((el) => { el.textContent = String(n); });
        /* deep piles fold past 8 notes behind a "more" strip */
        let more = p.querySelector(".pile-more");
        if (n > 8) {
          if (!more) {
            more = document.createElement("button");
            more.type = "button";
            more.className = "pile-more";
            p.appendChild(more);
          }
          more.textContent = p.classList.contains("pile-open")
            ? "⌃ fold the pile"
            : "⋯ " + (n - 8) + " more underneath";
        } else if (more) {
          more.remove();
          p.classList.remove("pile-open");
        }
      });
    }
    wrap.addEventListener("click", (e) => {
      const m = e.target instanceof Element && e.target.closest(".pile-more");
      if (!m) return;
      const p = m.closest(".pile");
      p.classList.toggle("pile-open");
      syncCounts();
      say(p.classList.contains("pile-open") ? "Pile spread out." : "Pile folded.");
    });
    let card = null, line = null, lift = null, origin = null, pendingCard = null;
    let pilePend = null, pileDrag = null, pileStart = null;
    function lineEl() {
      if (!line) {
        line = document.createElement("li");
        line.className = "sort-line";
        line.setAttribute("aria-hidden", "true");
      }
      return line;
    }
    function listAt(x, y) {
      /* reversed: piles may overlap on a free desk, and later-in-DOM paints
         on top — the drop must go to the pile you can SEE under the card */
      return lists().slice().reverse().find((l) => {
        const r = l.closest(".pile").getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom + 20;
      }) || null;
    }
    function place(x, y) {
      const target = listAt(x, y);
      lists().forEach((l) => l.classList.toggle("drop-active", l === target));
      if (!target) { if (line) line.remove(); return; }
      let before = null;
      Array.from(target.querySelectorAll(".pile-card")).forEach((c) => {
        if (c === card || before) return;
        const r = c.getBoundingClientRect();
        if (y < r.top + r.height / 2) before = c;
      });
      target.insertBefore(lineEl(), before);
    }
    const snap20 = (v) => Math.max(0, Math.round(v / 20) * 20);
    /* dragging toward the desk's edge pans the desk under you */
    function edgeScroll(e) {
      const desk = wrap.closest(".desk");
      if (!desk) return;
      const r = desk.getBoundingClientRect(), M = 48, S = 16;
      if (e.clientX > r.right - M) desk.scrollLeft += S;
      else if (e.clientX < r.left + M) desk.scrollLeft -= S;
      if (e.clientY > r.bottom - M) desk.scrollTop += S;
      else if (e.clientY < r.top + M) desk.scrollTop -= S;
    }
    gesture(wrap, {
      accept: (e) => !!(e.target instanceof Element && e.target.closest(".drag-h, .pile-grip")),
      onPress: (e) => {
        const t = e.target instanceof Element ? e.target : null;
        const grip = t && t.closest(".pile-grip");
        pilePend = grip ? grip.closest(".pile") : null;
        const h = !grip && t ? t.closest(".drag-h") : null;
        pendingCard = h ? h.closest(".pile-card") : null;
      },
      onDragStart: (e) => {
        /* a grip drag moves the whole pile around the desk (free mode) */
        if (pilePend && wrap.classList.contains("piles-free")) {
          pileDrag = pilePend;
          /* grab-point anchored (not delta-based) so edge auto-scroll can't
             desync the pile from the pointer */
          const pr = pileDrag.getBoundingClientRect();
          pileStart = {
            x: pileDrag.offsetLeft, y: pileDrag.offsetTop,
            gx: e.clientX - pr.left, gy: e.clientY - pr.top,
          };
          /* touching a pile brings it to the top of the desk — and since
             drop-targeting reads reverse DOM order, paint and targeting
             agree from here on */
          const addB = wrap.querySelector("[data-pile-add]");
          if (addB) wrap.insertBefore(pileDrag, addB);
          else wrap.appendChild(pileDrag);
          pileDrag.classList.add("pile-dragging");
          return;
        }
        card = pendingCard;
        if (!card) return;
        origin = { parent: card.parentNode, next: card.nextElementSibling };
        lift = liftBegin(card, e);
        lineEl().classList.add("sort-slot");
        lineEl().style.height = lift.height + "px";
        place(e.clientX, e.clientY);
      },
      onDragMove: (e, d) => {
        if (pileDrag) {
          edgeScroll(e);
          const wr = wrap.getBoundingClientRect();
          pileDrag.style.left = Math.max(0, e.clientX - wr.left - pileStart.gx) + "px";
          pileDrag.style.top = Math.max(0, e.clientY - wr.top - pileStart.gy) + "px";
          return;
        }
        if (lift) { lift.move(e); edgeScroll(e); }
        if (card) place(e.clientX, e.clientY);
      },
      onDragEnd: (e, d) => {
        if (pileDrag) {
          const x = snap20(d.cancelled ? pileStart.x : pileDrag.offsetLeft);
          const y = snap20(d.cancelled ? pileStart.y : pileDrag.offsetTop);
          pileDrag.style.left = x + "px";
          pileDrag.style.top = y + "px";
          pileDrag.classList.remove("pile-dragging");
          const nm = pileDrag.querySelector(".pile-name");
          say((nm && nm.value ? nm.value : "Pile") + " placed.");
          wrap.dispatchEvent(new CustomEvent("vertebra:pile-place", {
            bubbles: true, detail: { pile: pileDrag, x: x, y: y },
          }));
          /* landed mostly on another pile? OFFER to combine — never assume */
          const dropped = pileDrag;
          if (!d.cancelled) {
            const pr = dropped.getBoundingClientRect();
            let best = null, bestRel = 0;
            wrap.querySelectorAll(".pile").forEach((q) => {
              if (q === dropped) return;
              const qr = q.getBoundingClientRect();
              const w = Math.min(pr.right, qr.right) - Math.max(pr.left, qr.left);
              const hh = Math.min(pr.bottom, qr.bottom) - Math.max(pr.top, qr.top);
              if (w <= 0 || hh <= 0) return;
              /* overlap relative to the SMALLER pile: covering a small pile
                 with a big one (or vice versa) both read as "on top of it" */
              const rel = (w * hh) / Math.min(pr.width * pr.height, qr.width * qr.height);
              if (rel > bestRel) { bestRel = rel; best = q; }
            });
            if (best && bestRel > 0.45) {
              const intoName = (best.querySelector(".pile-name") || {}).value || "that pile";
              toast("Dropped onto “" + intoName + "”. Combine them?", "info", {
                ttl: 9000,
                action: { label: "COMBINE", fn: () => {
                  const list = best.querySelector(".pile-list");
                  dropped.querySelectorAll(".pile-card").forEach((c) => list.appendChild(c));
                  dropped.remove();
                  syncCounts();
                  say("Piles combined into " + intoName + ".");
                  wrap.dispatchEvent(new CustomEvent("vertebra:pile-merge", {
                    bubbles: true, detail: { from: dropped, into: best },
                  }));
                } },
              });
            }
          }
          pileDrag = null; pilePend = null; pileStart = null;
          return;
        }
        pendingCard = null;
        if (!card) return;
        lists().forEach((l) => l.classList.remove("drop-active"));
        const landed = !d.cancelled && line && line.parentNode;
        const from = origin ? origin.parent : null;
        let born = null; /* a pile created by dropping on bare desk */
        if (landed) {
          line.parentNode.insertBefore(card, line);
        } else if (origin) {
          /* free desk: dropping a note on empty space STARTS a pile there */
          const wr = wrap.getBoundingClientRect();
          const onDesk = wrap.classList.contains("piles-free") && !d.cancelled &&
            e.clientX >= wr.left && e.clientX <= wr.right &&
            e.clientY >= wr.top && e.clientY <= wr.bottom &&
            !listAt(e.clientX, e.clientY);
          if (onDesk) {
            born = makePile(e.clientX - wr.left - 130, e.clientY - wr.top - 16);
            born.querySelector(".pile-list").appendChild(card);
          } else {
            const next = origin.next && origin.next.parentNode === origin.parent ? origin.next : null;
            origin.parent.insertBefore(card, next);
          }
        }
        if (line) line.remove();
        if (lift) lift.settle();
        if (landed || born) {
          syncCounts();
          say((card.querySelector(".pile-card-title") || card).textContent.trim().slice(0, 40) +
              (born ? " started a new pile." : " moved to " + pileName(card.parentElement) + "."));
          wrap.dispatchEvent(new CustomEvent("vertebra:pile-move", {
            bubbles: true, detail: { item: card, from: from, to: card.parentElement },
          }));
          if (born) born.querySelector(".pile-name").focus();
        }
        card = null; lift = null; origin = null;
      },
    });
    /* keyboard on the handle: up/down reorder, left/right hop zones;
       on a pile grip (free mode) arrows nudge the pile one grid step */
    wrap.addEventListener("keydown", (e) => {
      const grip = e.target instanceof Element ? e.target.closest(".pile-grip") : null;
      if (grip && wrap.classList.contains("piles-free") &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) >= 0) {
        e.preventDefault();
        const p = grip.closest(".pile");
        const dx = e.key === "ArrowLeft" ? -20 : e.key === "ArrowRight" ? 20 : 0;
        const dy = e.key === "ArrowUp" ? -20 : e.key === "ArrowDown" ? 20 : 0;
        p.style.left = Math.max(0, p.offsetLeft + dx) + "px";
        p.style.top = Math.max(0, p.offsetTop + dy) + "px";
        wrap.dispatchEvent(new CustomEvent("vertebra:pile-place", {
          bubbles: true, detail: { pile: p, x: p.offsetLeft, y: p.offsetTop },
        }));
        return;
      }
      const h = e.target instanceof Element ? e.target.closest(".drag-h") : null;
      if (!h) return;
      const c = h.closest(".pile-card");
      if (!c) return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const sib = e.key === "ArrowUp" ? c.previousElementSibling : c.nextElementSibling;
        if (!sib) return;
        c.parentElement.insertBefore(c, e.key === "ArrowUp" ? sib : sib.nextElementSibling);
        h.focus();
        say("Moved " + (e.key === "ArrowUp" ? "up" : "down") + ".");
        wrap.dispatchEvent(new CustomEvent("vertebra:pile-move", {
          bubbles: true, detail: { item: c, from: c.parentElement, to: c.parentElement },
        }));
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const all = lists();
      const i = all.indexOf(c.parentElement);
      const next = all[e.key === "ArrowRight" ? i + 1 : i - 1];
      if (!next) return;
      const from = c.parentElement;
      next.appendChild(c);
      h.focus();
      syncCounts();
      say((c.querySelector(".pile-card-title") || c).textContent.trim().slice(0, 40) +
          " moved to " + pileName(next) + ".");
      wrap.dispatchEvent(new CustomEvent("vertebra:pile-move", {
        bubbles: true, detail: { item: c, from: from, to: next },
      }));
    });
    /* create a zone — via the add button, or by dropping a note on bare desk */
    function makePile(x, y) {
      const pile = document.createElement("section");
      pile.className = "pile";
      pile.setAttribute("data-pile-id", "pile-" + Date.now().toString(36));
      pile.innerHTML =
        '<header class="pile-head">' +
        '<button type="button" class="pile-grip" aria-label="Move pile">⠿</button>' +
        '<input class="pile-name" value="" placeholder="Name this pile" aria-label="Pile name" />' +
        '<span class="pile-count" data-pile-count>0</span></header>' +
        '<ul class="pile-list"></ul>';
      if (wrap.classList.contains("piles-free")) {
        if (x === undefined) {
          /* no target point: land in view, cascading like dealt cards so
             new piles never bury each other or a pile at the origin */
          const scroller = wrap.closest(".desk") || wrap.parentElement;
          const n = wrap.querySelectorAll(".pile").length;
          x = (scroller.scrollLeft || 0) + 60 + (n % 4) * 60;
          y = (scroller.scrollTop || 0) + 60 + n * 44;
        }
        pile.style.left = snap20(x) + "px";
        pile.style.top = snap20(y) + "px";
      }
      wrap.insertBefore(pile, wrap.querySelector("[data-pile-add]"));
      wrap.dispatchEvent(new CustomEvent("vertebra:pile-add", { bubbles: true, detail: { pile: pile } }));
      return pile;
    }
    wrap.addEventListener("click", (e) => {
      const btn = e.target instanceof Element && e.target.closest("[data-pile-add]");
      if (!btn) return;
      makePile().querySelector(".pile-name").focus();
    });
    /* rename */
    wrap.addEventListener("change", (e) => {
      const inp = e.target;
      if (!(inp instanceof HTMLInputElement) || !inp.classList.contains("pile-name")) return;
      wrap.dispatchEvent(new CustomEvent("vertebra:pile-rename", {
        bubbles: true, detail: { pile: inp.closest(".pile"), name: inp.value },
      }));
    });
    /* Enter in the name field commits (blur), it never submits anything */
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target instanceof HTMLInputElement &&
          e.target.classList.contains("pile-name")) {
        e.preventDefault();
        e.target.blur();
      }
    });
    syncCounts();
  });

  /* ---------- desk panning ----------
     A .desk pans smoothly: focus it and use arrow keys (Shift = big steps),
     or hold the MIDDLE mouse button and drag. Inputs and grips inside keep
     their own keys — arrows only pan when the desk itself has focus. */
  document.querySelectorAll(".desk").forEach((desk) => {
    if (!desk.hasAttribute("tabindex")) desk.tabIndex = 0;
    if (!desk.hasAttribute("aria-label")) desk.setAttribute("aria-label", "Desk — arrow keys pan");
    desk.addEventListener("keydown", (e) => {
      if (e.target !== desk) return;
      const step = e.shiftKey ? 240 : 64;
      let dx = 0, dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      desk.scrollBy({ left: dx, top: dy, behavior: reducedMotion.matches ? "auto" : "smooth" });
    });
    let pan = null;
    desk.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
    desk.addEventListener("pointerdown", (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      pan = { x: e.clientX, y: e.clientY, sl: desk.scrollLeft, st: desk.scrollTop };
      try { desk.setPointerCapture(e.pointerId); } catch (err) { /* detached */ }
      desk.classList.add("desk-panning");
    });
    desk.addEventListener("pointermove", (e) => {
      if (!pan) return;
      desk.scrollLeft = pan.sl - (e.clientX - pan.x);
      desk.scrollTop = pan.st - (e.clientY - pan.y);
    });
    const endPan = () => { pan = null; desk.classList.remove("desk-panning"); };
    desk.addEventListener("pointerup", endPan);
    desk.addEventListener("pointercancel", endPan);
    desk.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
  });

  /* ---------- .cal-mini month grid ----------
     Small month picker for desktop popovers and range selection. NOT a
     replacement for the native date input — pair it with one:

       <div class="cal-mini" data-cal-mini data-cal-mini-for="#start"></div>
       <div class="cal-mini" data-cal-mini data-cal-mini-range
            data-cal-mini-for="#from" data-cal-mini-to="#to"></div>

     Emits "vertebra:date" with { value, start, end }. Keyboard: arrows move
     by day/week, PageUp/PageDown by month, Enter/Space picks. */
  const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseISO(v) {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const p = v.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  document.querySelectorAll("[data-cal-mini]").forEach((host) => {
    const target = q(host.getAttribute("data-cal-mini-for"));
    const target2 = q(host.getAttribute("data-cal-mini-to"));
    const isRange = host.hasAttribute("data-cal-mini-range");
    const today = new Date();
    let cursor = parseISO(target && target.value) || new Date(today.getFullYear(), today.getMonth(), 1);
    let start = parseISO(target && target.value);
    let end = parseISO(target2 && target2.value);

    const head = document.createElement("div");
    head.className = "cal-mini-head";
    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "cal-mini-nav"; prev.textContent = "‹";
    prev.setAttribute("aria-label", "Previous month");
    const title = document.createElement("span");
    title.className = "cal-mini-title";
    title.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button"; next.className = "cal-mini-nav"; next.textContent = "›";
    next.setAttribute("aria-label", "Next month");
    head.append(prev, title, next);
    const grid = document.createElement("div");
    grid.className = "cal-mini-grid";
    /* deliberately NOT role="grid": the children are buttons, not rows and
       gridcells, and a grid role with no row structure is invalid. Each day
       button carries its full date as an accessible name, and the host is a
       labelled group — which is what AT actually needs here. */
    host.append(head, grid);

    prev.addEventListener("click", () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); render(); });
    next.addEventListener("click", () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); render(); });

    let commit = function (d) {
      if (!isRange) {
        start = d;
        if (target) { target.value = iso(d); target.dispatchEvent(new Event("change", { bubbles: true })); }
      } else if (!start || (start && end) || d < start) {
        start = d; end = null;
        if (target) { target.value = iso(d); target.dispatchEvent(new Event("change", { bubbles: true })); }
        if (target2) { target2.value = ""; }
      } else {
        end = d;
        if (target2) { target2.value = iso(d); target2.dispatchEvent(new Event("change", { bubbles: true })); }
      }
      host.dispatchEvent(new CustomEvent("vertebra:date", {
        bubbles: true,
        detail: { value: start ? iso(start) : null, start: start ? iso(start) : null, end: end ? iso(end) : null },
      }));
      /* keep focus on the day just picked (the grid is about to be rebuilt) */
      restoreFocus = document.activeElement && document.activeElement.classList &&
        document.activeElement.classList.contains("cal-mini-day");
      render(iso(d));
    };

    function render(focusISO) {
      title.textContent = MONTHS[cursor.getMonth()] + " " + cursor.getFullYear();
      grid.textContent = "";
      DOW.forEach((d) => {
        const c = document.createElement("span");
        c.className = "cal-mini-dow";
        c.setAttribute("aria-hidden", "true");
        c.textContent = d;
        grid.appendChild(c);
      });
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const lead = (first.getDay() + 6) % 7;           /* Monday-first */
      const cell = new Date(first);
      cell.setDate(cell.getDate() - lead);
      for (let i = 0; i < 42; i++) {
        const d = new Date(cell);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cal-mini-day";
        b.textContent = String(d.getDate());
        b.dataset.d = iso(d);
        b.tabIndex = -1;
        const out = d.getMonth() !== cursor.getMonth();
        if (out) b.classList.add("is-out");
        if (iso(d) === iso(today)) { b.classList.add("is-today"); b.setAttribute("aria-current", "date"); }
        const isStart = start && iso(d) === iso(start);
        const isEnd = end && iso(d) === iso(end);
        b.setAttribute("aria-pressed", String(!!(isStart || isEnd)));
        if (isStart) b.classList.add("range-start");
        if (isEnd) b.classList.add("range-end");
        if (start && end && d > start && d < end) b.classList.add("in-range");
        /* an accessible name that says the whole date, not just the number */
        b.setAttribute("aria-label", d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear());
        b.addEventListener("click", () => commit(d));
        grid.appendChild(b);
        cell.setDate(cell.getDate() + 1);
      }
      /* exactly one tab stop, and focus follows the cell we were asked to
         land on — the grid is rebuilt from scratch on every render, so
         nothing else can be trusted to restore it */
      grid.querySelectorAll(".cal-mini-day").forEach((b) => { b.tabIndex = -1; });
      const focusTarget =
        (focusISO && grid.querySelector('.cal-mini-day[data-d="' + focusISO + '"]')) ||
        grid.querySelector('.cal-mini-day[aria-pressed="true"]') ||
        grid.querySelector(".cal-mini-day.is-today") ||
        grid.querySelector(".cal-mini-day:not(.is-out)");
      if (focusTarget) {
        focusTarget.tabIndex = 0;
        if (focusISO && restoreFocus) focusTarget.focus();
      }
      restoreFocus = false;
    }
    let restoreFocus = false;

    grid.addEventListener("keydown", (e) => {
      const btn = e.target instanceof Element ? e.target.closest(".cal-mini-day") : null;
      if (!btn) return;
      const d = parseISO(btn.dataset.d);
      if (!d) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step) {
        e.preventDefault();
        const n = new Date(d);
        n.setDate(n.getDate() + step);
        if (n.getMonth() !== cursor.getMonth()) cursor = new Date(n.getFullYear(), n.getMonth(), 1);
        restoreFocus = true;
        render(iso(n));
      } else if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + (e.key === "PageUp" ? -1 : 1), 1);
        render();
        const el = grid.querySelector(".cal-mini-day:not(.is-out)");
        if (el) { el.tabIndex = 0; el.focus(); }
        grid.querySelectorAll(".cal-mini-day").forEach((b) => { if (b !== el) b.tabIndex = -1; });
      }
    });

    /* both bound inputs feed the grid, so typing a date updates the picker.
       commit() writes to these inputs and dispatches change, so guard against
       re-entering render() for a value we just wrote. */
    let writing = false;
    const origCommit = commit;
    commit = function (d) { writing = true; try { origCommit(d); } finally { writing = false; } };
    if (target) {
      target.addEventListener("change", () => {
        if (writing) return;
        const d = parseISO(target.value);
        if (d) { start = d; cursor = new Date(d.getFullYear(), d.getMonth(), 1); render(); }
      });
    }
    if (target2) {
      target2.addEventListener("change", () => {
        if (writing) return;
        const d = parseISO(target2.value);
        if (d) { end = d; render(); }
      });
    }
    render();
  });

  /* ---------- progress helpers ----------
     setProgress(el, 42) works on .progress, .progress-row and .gauge.
     Updates the bar/ring plus any [data-pct] readout inside the row,
     and keeps progressbar ARIA (value + name) in sync. */
  let labelSeq = 0;
  function setProgress(el, value) {
    const v = Math.max(0, Math.min(100, value));
    const target = el.classList.contains("progress-row")
      ? el.querySelector(".progress, .gauge")
      : el;
    if (!target) return;
    target.style.setProperty("--value", v);
    const row = target.closest(".progress-row") || target;
    if (target.classList.contains("progress")) {
      target.setAttribute("role", "progressbar");
      target.setAttribute("aria-valuemin", "0");
      target.setAttribute("aria-valuemax", "100");
      target.setAttribute("aria-valuenow", String(Math.round(v)));
      /* progressbar needs an accessible name: reuse the row's .label */
      if (!target.hasAttribute("aria-label") && !target.hasAttribute("aria-labelledby")) {
        const name = row.querySelector(".label");
        if (name) {
          if (!name.id) name.id = "sentinel-meter-" + ++labelSeq;
          target.setAttribute("aria-labelledby", name.id);
        }
      }
    }
    const pct = row.querySelector("[data-pct]");
    if (pct) pct.textContent = Math.round(v) + "%";
  }
  /* ---------- LCD clock ----------
     <span class="lcd" data-clock></span> shows the visitor's local time.

     It ticks ONCE A MINUTE, not once a second: the readout is HH:MM, so a
     per-second timer would repaint nothing new — the colon blinks in CSS
     instead, which the compositor handles. Each tick re-arms on the next
     minute BOUNDARY rather than +60s, so it cannot drift.

     The same tick re-checks a clock-defaulted theme, so a page left open
     across dusk changes over with the clock instead of going stale. */
  const clockEls = document.querySelectorAll("[data-clock]");
  if (clockEls.length) {
    const pad2 = (n) => (n < 10 ? "0" : "") + n;
    clockEls.forEach((el) => {
      el.textContent = "";
      const hh = document.createElement("span");
      const sep = document.createElement("span");
      const mm = document.createElement("span");
      sep.className = "lcd-sep";
      sep.textContent = ":";
      el.append(hh, sep, mm);
      el._clockParts = { hh: hh, mm: mm };
      if (!el.hasAttribute("role")) el.setAttribute("role", "timer");
      if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "Local time");
    });
    (function tickClock() {
      const d = new Date();
      const hh = pad2(d.getHours());
      const mm = pad2(d.getMinutes());
      clockEls.forEach((el) => {
        el._clockParts.hh.textContent = hh;
        el._clockParts.mm.textContent = mm;
      });
      if (clockMode() && !safeGet("theme")) applyTheme(darkByClock(d), false);
      setTimeout(tickClock, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20);
    })();
  }

  /* ---------- ratings ----------
     .rate-stars needs no JS at all -- native radios plus CSS. These two do.

     [data-rate-thumbs]: like/dislike as a pair of toggle buttons. Delegated,
     so votes rendered after load work without re-init. Clicking the pressed
     one clears it: a vote you cannot take back is a trap, and "I clicked it
     by accident" is the single most common thing to want to undo here.

     [data-rate-slider]: mirrors the range into its <output>. */
  function rateValue(box) {
    const up = box.querySelector(".rate-up");
    const down = box.querySelector(".rate-down");
    if (up && up.getAttribute("aria-pressed") === "true") return 1;
    if (down && down.getAttribute("aria-pressed") === "true") return -1;
    return 0;
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest ? e.target.closest(".rate-vote") : null;
    if (!btn) return;
    const box = btn.closest("[data-rate-thumbs]");
    if (!box) return;
    const was = btn.getAttribute("aria-pressed") === "true";
    /* one vote at a time, and pressing the live one takes it back */
    box.querySelectorAll(".rate-vote").forEach(function (b) {
      b.setAttribute("aria-pressed", "false");
    });
    if (!was) btn.setAttribute("aria-pressed", "true");
    box.dispatchEvent(new CustomEvent("vertebra:rate", {
      bubbles: true,
      detail: { value: rateValue(box), source: "thumbs" },
    }));
  });

  function syncRateSlider(box) {
    const input = box.querySelector('input[type="range"]');
    const out = box.querySelector(".rate-out");
    if (!input) return;
    const suffix = box.getAttribute("data-rate-suffix") || "";
    if (out) out.textContent = input.value + suffix;
    /* Labelled scales read as a bare number otherwise -- "7" tells a screen
       reader nothing that "7, confident" does. */
    let labels = null;
    try { labels = JSON.parse(box.getAttribute("data-rate-labels") || "null"); }
    catch (err) { labels = null; }
    if (labels && labels.length) {
      const min = Number(input.min || 0), max = Number(input.max || 100);
      const span = max - min || 1;
      const i = Math.round(((Number(input.value) - min) / span) * (labels.length - 1));
      const word = labels[Math.max(0, Math.min(labels.length - 1, i))];
      if (word) input.setAttribute("aria-valuetext", input.value + ", " + word);
    }
  }

  document.addEventListener("input", function (e) {
    const box = e.target.closest ? e.target.closest("[data-rate-slider]") : null;
    if (!box) return;
    syncRateSlider(box);
    box.dispatchEvent(new CustomEvent("vertebra:rate", {
      bubbles: true,
      detail: { value: Number(e.target.value), source: "slider" },
    }));
  });
  document.querySelectorAll("[data-rate-slider]").forEach(syncRateSlider);

  /* .rate-stars is CSS-only, but a script still needs to READ it */
  function rateRead(el) {
    const box = typeof el === "string" ? q(el) : el;
    if (!box) return null;
    if (box.hasAttribute("data-rate-thumbs")) return rateValue(box);
    const range = box.querySelector('input[type="range"]');
    if (range) return Number(range.value);
    const checked = box.querySelector("input:checked");
    return checked ? Number(checked.value) : null;
  }

  /* MERGE, never replace: an opt-in module (vertebra-cal, vertebra-charts)
     may legitimately load before theme.js and hang its own method here. A
     wholesale assignment would silently delete it. */
  window.sentinel = window.sentinel || {};
  const api = {
    darkByClock: darkByClock,
    setProgress: setProgress,
    decode: decode,
    toast: toast,
    nudge: nudge,
    badge: badgeCount,
    layer: layer,
    gesture: gesture,
    sheet: sheetApi,
    combo: { source: function (el, fn) { comboSources.set(el, fn); } },
    cmdk: {
      open: function () { if (cmdkApi) cmdkApi.open(); },
      close: function () { if (cmdkApi) cmdkApi.close(); },
      source: function (fn) { if (cmdkApi) cmdkApi.source(fn); },
    },
    say: say,
    rate: { read: rateRead, sync: syncRateSlider },
    tree: { init: initTree },
    user: {
      get: actingUser,
      init: userInit,
      set: function (u) {
        if (/^u[12]$/.test(u)) { root.setAttribute("data-acting", u); safeSet("acting", u); syncActingButtons(); }
      },
    },
  };
  Object.keys(api).forEach(function (k) { window.sentinel[k] = api[k]; });
  window.vertebra = window.sentinel; /* canonical name post-rename; sentinel kept for compat */

  /* ---------- demo: elements that animate themselves ----------
     <div class="progress" data-demo-progress="72"> fills to 72 on view.
     <div class="gauge" data-demo-progress="68"> same idea. */
  const demoEls = document.querySelectorAll("[data-demo-progress]");
  if (demoEls.length) {
    const run = (el) => {
      const target = parseFloat(el.getAttribute("data-demo-progress")) || 0;
      if (reducedMotion.matches) { setProgress(el, target); return; }
      const startTime = performance.now();
      const dur = 1100;
      function frame(now) {
        const t = Math.min(1, (now - startTime) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(el, target * eased);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };
    if ("IntersectionObserver" in window) {
      const done = new WeakSet();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !done.has(entry.target)) {
            done.add(entry.target);
            run(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      demoEls.forEach((el) => io.observe(el));
    } else {
      demoEls.forEach(run);
    }
  }

  /* ---------- demo: boot sequence ----------
     <div data-boot> containing a .progress and [data-boot-status]
     runs a stepped fake boot, then shows READY. Give the status element
     role="status" in markup so updates are announced. */
  document.querySelectorAll("[data-boot]").forEach((box) => {
    const bar = box.querySelector(".progress");
    const status = box.querySelector("[data-boot-status]");
    if (!bar) return;
    const steps = [
      [12, "LINK ESTABLISHED"],
      [31, "LOADING MODULES"],
      [54, "CHECKSUM VERIFY"],
      [76, "CALIBRATING"],
      [93, "FINALIZING"],
      [100, "SYSTEM READY"],
    ];
    let i = 0;
    function next() {
      if (i >= steps.length) return;
      const step = steps[i++];
      setProgress(bar, step[0]);
      if (status) status.textContent = step[1];
      if (i < steps.length) {
        setTimeout(next, reducedMotion.matches ? 0 : 380 + Math.random() * 420);
      } else if (status) {
        status.classList.add("cursor");
      }
    }
    setTimeout(next, 400);
  });

  /* ---------- demo: loading button ----------
     <button data-demo-loading> fakes a 2s busy state on click. */
  document.querySelectorAll("[data-demo-loading]").forEach((btn) => {
    const original = btn.innerHTML;
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-loading")) return;
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>WORKING';
      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.removeAttribute("aria-busy");
        btn.innerHTML = original;
      }, 2000);
    });
  });

  /* ---------- small helpers ---------- */
  function onMediaChange(mql, fn) {
    if (mql.addEventListener) mql.addEventListener("change", fn);
    else if (mql.addListener) mql.addListener(fn); /* older Safari */
  }
  /* namespaced storage: vertebra-* first, legacy sentinel-* as fallback;
     writes go to both so pre-rename consumers stay in sync */
  function safeGet(k) {
    try {
      const v = localStorage.getItem("vertebra-" + k);
      return v !== null ? v : localStorage.getItem("sentinel-" + k);
    } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try {
      localStorage.setItem("vertebra-" + k, v);
      localStorage.setItem("sentinel-" + k, v);
    } catch (e) { /* ignore */ }
  }
})();
