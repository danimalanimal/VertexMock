/* ===========================================================================
   Vertex Results — unified test-results store
   Namespaced by testType (e.g. 'beep', 'yoyoIR1', '30-15', 'plank', 'broadJump').
   Persists to localStorage under 'vertex.results.v1' and exposes a global
   window.__vertexResults snapshot for dashboard mockups to pick up.

   Usage:
     VertexResults.save('beep', [{ id, name, level, shuttle, vo2max, ts }]);
     const last = VertexResults.latest('beep');
     const all  = VertexResults.all();
   =========================================================================== */
(() => {
  'use strict';
  if (window.VertexResults) return;

  const KEY = 'vertex.results.v1';
  const cache = load();
  window.__vertexResults = cache;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch { return {}; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  }

  function save(testType, payload, meta = {}) {
    const entry = {
      ts: Date.now(),
      testType,
      protocol: meta.protocol || testType,
      meta,
      results: payload,
    };
    cache[testType] = cache[testType] || [];
    cache[testType].push(entry);
    persist();
    window.__vertexResults = cache;
    return entry;
  }

  function latest(testType) {
    const arr = cache[testType];
    return arr && arr.length ? arr[arr.length - 1] : null;
  }

  function all() { return cache; }

  function clear(testType) {
    if (testType) delete cache[testType]; else Object.keys(cache).forEach(k => delete cache[k]);
    persist();
  }

  window.VertexResults = { save, latest, all, clear };
})();
