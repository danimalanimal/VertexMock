// Vertex — Organisation Dashboard Demo
// Three pages per sport (?sport=basketball|boxing):
//   #sales                     Sales & Marketing Strategy (market pyramid + notional financials)
//   #performance               Performance Dashboard (cohort view, standouts, tables)
//   #performance/athlete/<id>  athlete drill-down · #performance/coach/<id> coach drill-down
//   #examples                  links to coach test interfaces, reports, player + coach profiles
// Built on VERTEBRA (vendor/vertebra) — tokens only, no raw colours.

(() => {
  'use strict';
  const D = window.VertexOrgData;
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- sport + routing ---------- */
  const params = new URLSearchParams(location.search);
  const sport = params.get('sport') === 'boxing' ? 'boxing' : 'basketball';
  const M = D.market[sport];
  const C = D.cohort(sport);
  document.title = `Vertex — Organisation Dashboard · ${M.label}`;
  $('#orgSportTitle').textContent = M.label;
  $('#badgeAthletes').textContent = C.athletes.length;
  $('#badgeCoaches').textContent = C.coaches.length;

  function syncSportSwitch() {
    document.querySelectorAll('#sportSwitch a').forEach((a) => {
      const s = a.getAttribute('data-sport');
      a.setAttribute('href', `?sport=${s}${location.hash || '#sales'}`);
      if (s === sport) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  /* ---------- formatting ---------- */
  const fmtInt = (v) => Math.round(v).toLocaleString('en-AU');
  const fmtMoney = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return 'A$' + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 2) + 'M';
    if (a >= 1e3) return 'A$' + Math.round(v / 1e3).toLocaleString('en-AU') + 'k';
    return 'A$' + Math.round(v).toLocaleString('en-AU');
  };
  const fmtPct = (f, d = 0) => (f * 100).toFixed(d) + '%';
  const sign = (v, unit = '') => (v > 0 ? '+' : '') + v + unit;
  const initials = (name) => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  /* ---------- tokens → canvas colours ---------- */
  const tokCache = {};
  function tok(name) {
    if (tokCache[name]) return tokCache[name];
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`; probe.style.display = 'none';
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color; probe.remove();
    return (tokCache[name] = c);
  }
  const alpha = (rgb, a) => { const m = rgb.match(/\d+(\.\d+)?/g) || [0, 0, 0]; return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})`; };
  const palette = () => [tok('--accent-strong'), tok('--meter'), tok('--warn'), tok('--u1'), tok('--u2'), tok('--danger'), tok('--ink-faint')];

  /* ---------- chart registry ---------- */
  const charts = [];
  function mkChart(canvas, config) {
    const ch = window.vertebra && window.vertebra.chart ? window.vertebra.chart(canvas, config) : new Chart(canvas, config);
    charts.push(ch);
    return ch;
  }
  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch (e) { /* ignore */ } } }
  function chartBox(cls = '') { const box = el('div', `org-chart ${cls}`); const cv = document.createElement('canvas'); box.append(cv); return { box, cv }; }

  /* ---------- small UI helpers ---------- */
  const pill = (text, tone = '') => `<span class="pill ${tone ? 'pill-' + tone : ''}">${esc(text)}</span>`;
  const stat = (label, value, hint = '', tone = '') => `<div class="stat ${tone ? 'stat-' + tone : ''}"><span class="stat-label">${esc(label)}</span><span class="stat-value">${value}</span>${hint ? `<span class="stat-hint">${hint}</span>` : ''}</div>`;
  const cardHead = (title, sub = '') => `<div class="card-header"><h3>${esc(title)}</h3>${sub ? `<span class="label">${sub}</span>` : ''}</div>`;
  const srcPill = (m) => `<span class="pill ${m.verified ? 'pill-ok' : ''} org-source" title="Measurement source">${esc(D.sourceLabel[m.source] || m.source)}</span>`;
  const sparkline = (series) => {
    const vals = series.filter((v) => v != null);
    if (vals.length < 2) return '<span class="org-spark"></span>';
    const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
    const pts = series.map((v, i) => v == null ? null : `${(i / (series.length - 1)) * 72},${20 - ((v - min) / span) * 18 - 1}`).filter(Boolean).join(' ');
    return `<svg class="org-spark" viewBox="0 0 72 20" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--accent-strong)"/></svg>`;
  };
  const who = (name, lg = false) => `<span class="org-who ${lg ? 'lg' : ''}" aria-hidden="true">${esc(initials(name))}</span>`;
  const coachById = Object.fromEntries(C.coaches.map((c) => [c.id, c]));
  const athleteById = Object.fromEntries(C.athletes.map((a) => [a.id, a]));
  const activeTone = (days) => days <= 14 ? 'ok' : days <= 30 ? 'warn' : 'err';
  const metricDef = (key) => C.metrics.find((m) => m.key === key);
  const fmtMetric = (def, v) => (def.d ? v.toFixed(def.d) : Math.round(v)) + (def.unit === '%' ? '%' : ' ' + def.unit);

  /* ====================================================================
     SALES & MARKETING STRATEGY
     ==================================================================== */
  const salesState = { scenario: 'mid', tier: M.defaultTier, inputs: JSON.parse(JSON.stringify(M.pricing)) };

  function tierSizes(scenario) {
    return M.tiers.map((t, i) => {
      const reach = t.reach[scenario];
      const prev = i > 0 ? M.tiers[i - 1].reach[scenario] : 0;
      const value = Math.max(0, reach - prev);
      const a = Math.round(value * t.male);
      return { label: t.label, value, a, b: value - a, info: `${t.status} · reach ${fmtInt(reach)}`, key: t.key, reach };
    });
  }

  function renderSales(view) {
    const head = el('header', 'org-head', `
      <div>
        <p class="kicker">Sales &amp; Marketing Strategy · ${esc(M.label)}</p>
        <h1>Addressable market</h1>
        <p>${esc(M.summary)}</p>
      </div>
      <div class="org-head-aside">
        <span class="label">Estimate position</span>
        <div class="org-scenario" role="radiogroup" aria-label="Estimate position" id="scenario">
          <button type="button" role="radio" data-s="low" aria-checked="${salesState.scenario === 'low'}">Low</button>
          <button type="button" role="radio" data-s="mid" aria-checked="${salesState.scenario === 'mid'}">Mid</button>
          <button type="button" role="radio" data-s="high" aria-checked="${salesState.scenario === 'high'}">High</button>
        </div>
      </div>`);
    view.append(head);

    view.append(el('div', 'org-stats', M.facts.map((f) => stat(f.label, esc(f.value), esc(f.hint))).join('')));

    // --- pyramid + tier list ---
    const grid = el('div', 'org-grid org-section');
    const pyCard = el('article', 'card span-8 org-pyramid-wrap');
    pyCard.innerHTML = cardHead('Participation pyramid', 'VERTEBRA · data-x-pyramid');
    const host = el('div');
    host.setAttribute('data-x-pyramid', JSON.stringify({ series: M.series, tiers: tierSizes(salesState.scenario) }));
    host.setAttribute('data-mode', 'ziggurat');
    pyCard.append(host, el('p', 'org-note', 'Footprint area is the share of people at or above each tier. Click a tier (or use the list) to make it the target segment for the financial models; drag the ziggurat to turn it; keys 1 2 3 switch views.'));
    grid.append(pyCard);

    const tierCard = el('article', 'card span-4 org-card-pad');
    tierCard.innerHTML = cardHead('Tiers', 'apex → base') + '<div class="org-tiers" id="tierList"></div><div class="org-tier-detail" id="tierDetail"></div>';
    grid.append(tierCard);
    view.append(grid);

    const api = window.vertebraX.pyramid(host);

    function paintTiers() {
      const sizes = tierSizes(salesState.scenario);
      $('#tierList').innerHTML = sizes.map((t, i) => {
        const def = M.tiers[i];
        return `<button type="button" class="org-tier" data-key="${def.key}" aria-pressed="${def.key === salesState.tier}">
          <span class="org-tier-idx">${String(i + 1).padStart(2, '0')}</span>
          <span><span class="org-tier-name">${esc(def.label)}</span><span class="org-tier-sub">${pill(def.status, def.statusTone)} ${esc(def.short)}</span></span>
          <span class="org-tier-val">${fmtInt(t.reach)}<small>reach · ${fmtInt(t.value)} in tier</small></span></button>`;
      }).join('');
      const i = M.tiers.findIndex((t) => t.key === salesState.tier);
      const def = M.tiers[i], sz = sizes[i];
      $('#tierDetail').innerHTML = `<h4>Target segment · ${esc(def.label)}</h4><p>${esc(def.basis)}</p>
        <dl class="org-kv" style="margin-top:8px"><dt>Reach</dt><dd>${fmtInt(sz.reach)} people (${fmtInt(def.reach.low)}–${fmtInt(def.reach.high)})</dd>
        <dt>${esc(M.series[0])}</dt><dd>${fmtPct(def.male)}</dd><dt>Confidence</dt><dd>${esc(def.status)}</dd></dl>`;
      $('#tierList').querySelectorAll('.org-tier').forEach((b) => b.addEventListener('click', () => {
        const idx = M.tiers.findIndex((t) => t.key === b.dataset.key);
        api.select(idx); // observer below routes it back into the model
      }));
    }

    // The kit's pyramid has no selection event; its aria-live readout ends with
    // "pinned" when a tier is clicked or arrowed. Watch that and sync the model.
    const read = host.querySelector('.xpy-read');
    let lastPinned = null;
    new MutationObserver(() => {
      const txt = read.textContent || '';
      const strong = read.querySelector('strong');
      if (!strong || !/pinned$/.test(txt.trim())) return;
      const label = strong.textContent.trim().toUpperCase();
      const idx = M.tiers.findIndex((t) => t.label.toUpperCase() === label);
      if (idx < 0 || M.tiers[idx].key === lastPinned) return;
      lastPinned = M.tiers[idx].key;
      salesState.tier = lastPinned;
      paintTiers(); paintFinancials();
    }).observe(read, { childList: true, characterData: true, subtree: true });

    $('#scenario').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-s]'); if (!b) return;
      salesState.scenario = b.dataset.s;
      $('#scenario').querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      api.set({ series: M.series, tiers: tierSizes(salesState.scenario) });
      lastPinned = null;
      api.select(M.tiers.findIndex((t) => t.key === salesState.tier));
      paintTiers(); paintFinancials();
    });

    // --- financials ---
    const fin = el('section', 'org-section');
    fin.innerHTML = cardHead('Notional financials — three pricing models', 'AUD · ex-GST · illustrative only') +
      '<div class="alert alert-warn" style="margin-bottom:12px"><strong>Notional.</strong> <span id="finLead"></span></div>' +
      '<div class="org-models" id="models"></div>' +
      '<div class="org-grid" style="margin-top:14px"><article class="card span-7 org-card-pad">' + cardHead('Revenue by year', 'ramp 35% · 70% · 100% of year-3 adoption') + '<div id="finChart"></div></article>' +
      '<article class="card span-5 org-card-pad">' + cardHead('Side by side', 'year 3') + '<div class="table-wrap"><table class="table" id="finTable"></table></div><p class="org-note">Gross margin excludes sales, product and overheads; it is cost-to-serve only. Churn is applied as an average half-year effect on subscription revenue.</p></article></div>';
    view.append(fin);

    function model(key) {
      const inp = salesState.inputs[key];
      const tier = M.tiers.find((t) => t.key === salesState.tier);
      const reach = tier.reach[salesState.scenario];
      const years = D.ramp.map((r) => {
        if (key === 'athlete') {
          const athletes = reach * (inp.adoption / 100) * r;
          const rev = athletes * inp.price * 12 * (1 - inp.churn / 200);
          const cost = athletes * inp.costPerAthlete * 12;
          return { athletes, rev, cost, units: athletes, unitLabel: 'athletes' };
        }
        if (key === 'club') {
          const clubs = (reach / inp.perClub) * (inp.adoption / 100) * r;
          const rev = clubs * (inp.licence + inp.coachSeats * inp.seatPrice);
          const cost = clubs * inp.costPerClub;
          return { athletes: clubs * inp.perClub, rev, cost, units: clubs, unitLabel: 'clubs' };
        }
        const assessed = reach * (inp.adoption / 100) * r;
        const rev = assessed * inp.fee * inp.perYear;
        const cost = assessed * inp.deliveryCost * inp.perYear;
        return { athletes: assessed, rev, cost, units: assessed * inp.perYear, unitLabel: 'assessments' };
      });
      const y3 = years[2];
      return { years, y3, cum: years.reduce((s, y) => s + y.rev, 0), margin: y3.rev ? (y3.rev - y3.cost) / y3.rev : 0, reach };
    }

    let finChart = null;
    function paintFinancials() {
      const tier = M.tiers.find((t) => t.key === salesState.tier);
      const reach = tier.reach[salesState.scenario];
      $('#finLead').textContent = `Target segment: ${tier.label} — ${fmtInt(reach)} people at the ${salesState.scenario} estimate. Adoption, price and cost sliders are assumptions to be tested with the first clubs, not forecasts.`;
      const wrap = $('#models');
      if (!wrap.children.length) {
        wrap.innerHTML = D.pricingModels.map((pm) => `<article class="card org-model" data-model="${pm.key}">
          <header><h3>${esc(pm.name)}</h3>${pill(pm.tag)}</header>
          <p class="org-model-blurb">${esc(pm.blurb)}</p>
          <div class="org-model-out">
            <div class="stat"><span class="stat-label">Year-3 revenue</span><span class="stat-value hero" data-out="y3"></span></div>
            <div class="stat"><span class="stat-label">3-yr cumulative</span><span class="stat-value" data-out="cum"></span></div>
            <div class="stat"><span class="stat-label" data-out="unitLabel">Units</span><span class="stat-value" data-out="units"></span></div>
            <div class="stat"><span class="stat-label">Gross margin</span><span class="stat-value" data-out="margin"></span></div>
          </div>
          ${pm.inputs.map((inp) => `<div class="org-ctl"><label for="ctl-${pm.key}-${inp.key}"><span>${esc(inp.label)}</span><output id="out-${pm.key}-${inp.key}"></output></label>
            <input id="ctl-${pm.key}-${inp.key}" type="range" min="${inp.min}" max="${inp.max}" step="${inp.step}" value="${salesState.inputs[pm.key][inp.key]}" data-model="${pm.key}" data-key="${inp.key}" data-unit="${inp.unit}" /></div>`).join('')}
          <p class="org-model-foot" data-out="foot"></p>
        </article>`).join('');
        wrap.querySelectorAll('input[type="range"]').forEach((r) => r.addEventListener('input', () => {
          salesState.inputs[r.dataset.model][r.dataset.key] = parseFloat(r.value);
          paintFinancials();
        }));
      }
      const results = {};
      D.pricingModels.forEach((pm) => {
        const res = results[pm.key] = model(pm.key);
        const card = wrap.querySelector(`[data-model="${pm.key}"]`);
        card.querySelector('[data-out="y3"]').textContent = fmtMoney(res.y3.rev);
        card.querySelector('[data-out="cum"]').textContent = fmtMoney(res.cum);
        card.querySelector('[data-out="units"]').textContent = fmtInt(res.y3.units);
        card.querySelector('[data-out="unitLabel"]').textContent = 'Year-3 ' + res.y3.unitLabel;
        card.querySelector('[data-out="margin"]').textContent = fmtPct(res.margin);
        card.querySelector('[data-out="foot"]').textContent = `${fmtInt(res.y3.athletes)} athletes on Vertex by year 3 (${fmtPct(res.y3.athletes / res.reach, 1)} of the segment).`;
        pm.inputs.forEach((inp) => {
          const v = salesState.inputs[pm.key][inp.key];
          card.querySelector(`#out-${pm.key}-${inp.key}`).textContent = inp.unit === '$' ? 'A$' + v.toLocaleString('en-AU') : inp.unit === '%' ? v + '%' : String(v);
        });
      });
      // table
      $('#finTable').innerHTML = `<thead><tr><th>Model</th><th class="num">Y1</th><th class="num">Y2</th><th class="num">Y3</th><th class="num">Margin</th><th class="num">Athletes Y3</th></tr></thead><tbody>` +
        D.pricingModels.map((pm) => { const r = results[pm.key]; return `<tr><td>${esc(pm.name)}</td>${r.years.map((y) => `<td class="num">${fmtMoney(y.rev)}</td>`).join('')}<td class="num">${fmtPct(r.margin)}</td><td class="num">${fmtInt(r.y3.athletes)}</td></tr>`; }).join('') + '</tbody>';
      // chart
      const pal = palette();
      const data = {
        labels: ['Year 1', 'Year 2', 'Year 3'],
        datasets: D.pricingModels.map((pm, i) => ({ label: pm.name, data: results[pm.key].years.map((y) => Math.round(y.rev)), backgroundColor: alpha(pal[i], 0.75), borderColor: pal[i], borderWidth: 1 })),
      };
      if (!finChart) {
        const { box, cv } = chartBox('tall');
        $('#finChart').append(box);
        finChart = mkChart(cv, { type: 'bar', data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (v) => fmtMoney(v) } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } } } } });
      } else { finChart.data = data; finChart.update(); }
    }

    paintTiers(); paintFinancials();
    api.select(M.tiers.findIndex((t) => t.key === salesState.tier));

    // --- strategy ---
    const strat = el('section', 'org-section');
    strat.innerHTML = cardHead('Go-to-market by segment', 'where to start and why') +
      `<p class="org-note" style="margin:0 0 10px">${esc(M.insight)}</p>` +
      '<div class="table-wrap"><table class="table org-strategy-table"><thead><tr><th>Segment</th><th>Why it matters</th><th>Channel</th><th>Message</th><th>Priority</th></tr></thead><tbody>' +
      M.strategy.map((s) => `<tr><td>${esc(s.segment)}</td><td>${esc(s.why)}</td><td>${esc(s.channel)}</td><td>${esc(s.message)}</td><td>${pill(s.priority, s.priority === 'Beachhead' ? 'ok' : s.priority === 'Credibility' ? 'warn' : '')}</td></tr>`).join('') +
      '</tbody></table></div>';
    view.append(strat);

    const src = el('section', 'org-section');
    src.innerHTML = cardHead('Sources', 'participation figures') + '<ol class="org-sources">' + M.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('') + '</ol>';
    view.append(src);
  }

  /* ====================================================================
     PERFORMANCE DASHBOARD
     ==================================================================== */
  const perfState = { club: '', band: '', sex: '', coach: '', sort: { key: 'devScore', dir: -1 }, tab: 'athletes' };

  function filtered() {
    return C.athletes.filter((a) => (!perfState.club || a.club === perfState.club) && (!perfState.band || a.band === perfState.band) && (!perfState.sex || a.sex === perfState.sex) && (!perfState.coach || a.coaches.includes(perfState.coach)));
  }
  const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quantile = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };

  function standouts(A) {
    const key = metricDef(C.keyMetric);
    const byDelta = [...A].sort((x, y) => y.devDelta - x.devDelta || y.devScore - x.devScore).slice(0, 3);
    const dedication = (a) => a.feedback.total + a.feedback.streak * 0.6 + a.feedback.sessions * 0.25 - (a.feedback.lastActive > 14 ? 10 : 0);
    const byDedication = [...A].sort((x, y) => dedication(y) - dedication(x)).slice(0, 3);
    const verified = A.filter((a) => a.metrics[C.keyMetric].verified);
    const dirZ = (a) => a.metrics[C.keyMetric].z * (key.higherBetter ? 1 : -1);
    const byVerified = verified.sort((x, y) => dirZ(y) - dirZ(x)).slice(0, 3);
    const phys = (a) => (a.anthro.heightPct + a.anthro.wingspanPct) / 2;
    const byPhys = [...A].sort((x, y) => phys(y) - phys(x)).slice(0, 3);
    return { byDelta, byDedication, byVerified, byPhys, key };
  }

  function personLink(a, sub) {
    return `<a class="org-row-link org-person" href="#performance/athlete/${a.id}">${who(a.name)}<span><span class="org-person-name">${esc(a.name)}${a.hero ? ' <span class="pill pill-ok org-pill-sm">full dashboard</span>' : ''}</span><span class="small muted">${esc(sub)}</span></span></a>`;
  }

  function renderPerformance(view) {
    const A = filtered();
    view.append(el('header', 'org-head', `
      <div><p class="kicker">Performance Dashboard · ${esc(M.label)}</p><h1>All Vertex ${esc(M.label.toLowerCase())} athletes</h1>
      <p>A cumulative view of every athlete the organisation has on Vertex: development trajectories, coach feedback volume (retention and dedication), and source-verified performance and physical metrics. Click any athlete or coach to drill down.</p></div>
      <div class="org-head-aside org-filters" id="perfFilters">
        <select class="input" data-f="club" aria-label="Club"><option value="">All clubs</option>${C.clubs.map((c) => `<option value="${c.id}" ${perfState.club === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select class="input" data-f="band" aria-label="Age band"><option value="">All ages</option>${['U12', 'U14', 'U16', 'U18', 'Open'].map((b) => `<option ${perfState.band === b ? 'selected' : ''}>${b}</option>`).join('')}</select>
        <select class="input" data-f="sex" aria-label="Sex"><option value="">All</option><option value="F" ${perfState.sex === 'F' ? 'selected' : ''}>Female</option><option value="M" ${perfState.sex === 'M' ? 'selected' : ''}>Male</option></select>
        <select class="input" data-f="coach" aria-label="Coach"><option value="">All coaches</option>${C.coaches.map((c) => `<option value="${c.id}" ${perfState.coach === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      </div>`));
    $('#perfFilters').querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { perfState[s.dataset.f] = s.value; render(); }));

    if (!A.length) { view.append(el('div', 'empty-state', '<div class="empty-state-icon" aria-hidden="true">◌</div><p>No athletes match those filters.</p>')); return; }

    // --- headline stats ---
    const active = A.filter((a) => a.feedback.lastActive <= 14).length;
    const obs = A.reduce((s, a) => s + a.feedback.total, 0);
    let vm = 0, nm = 0; A.forEach((a) => Object.values(a.metrics).forEach((m) => { nm++; if (m.verified) vm++; }));
    const avgDelta = A.reduce((s, a) => s + a.devDelta, 0) / A.length;
    const sessions = A.reduce((s, a) => s + a.feedback.sessions, 0);
    view.append(el('div', 'org-stats', [
      stat('Athletes', fmtInt(A.length), `${C.clubs.filter((c) => A.some((a) => a.club === c.id)).length} clubs · ${new Set(A.flatMap((a) => a.coaches)).size} coaches`),
      stat('Active last 14 days', fmtInt(active), fmtPct(active / A.length) + ' of cohort', active / A.length > 0.75 ? 'ok' : 'warn'),
      stat('Coach observations · 12 mo', fmtInt(obs), `${(obs / A.length).toFixed(1)} per athlete`),
      stat('Sessions attended', fmtInt(sessions), `${(sessions / A.length).toFixed(0)} per athlete`),
      stat('Verified metrics', fmtPct(vm / nm), 'video 240fps · LiDAR · force plate', 'ok'),
      stat('Avg development Δ', sign(avgDelta.toFixed(1)), 'dev score points · 12 months', avgDelta > 0 ? 'ok' : 'err'),
    ].join('')));

    // --- charts ---
    const pal = palette();
    const grid = el('div', 'org-grid org-section');
    const c1 = el('article', 'card span-4 org-card-pad', cardHead('Development score distribution', 'current'));
    const c2 = el('article', 'card span-8 org-card-pad', cardHead('Cohort trajectory', 'median · interquartile band'));
    const c3 = el('article', 'card span-8 org-card-pad', cardHead('Coach feedback volume', 'observations per month · by coach'));
    const c4 = el('article', 'card span-4 org-card-pad', cardHead('Metric provenance', 'all logged metrics'));
    const c5 = el('article', 'card span-12 org-card-pad', cardHead(`${metricDef(C.keyMetric).label} by age band`, 'verified sources vs all entries'));
    grid.append(c1, c2, c3, c4, c5); view.append(grid);

    const bins = ['<50', '50–59', '60–69', '70–79', '80–89', '90+'];
    const counts = bins.map(() => 0);
    A.forEach((a) => { const s = a.devScore; counts[s < 50 ? 0 : s < 60 ? 1 : s < 70 ? 2 : s < 80 ? 3 : s < 90 ? 4 : 5]++; });
    { const { box, cv } = chartBox(); c1.append(box); mkChart(cv, { type: 'bar', data: { labels: bins, datasets: [{ label: 'Athletes', data: counts, backgroundColor: alpha(pal[1], 0.75), borderColor: pal[1], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } } }); }

    // Consistent cohort: only athletes present for the full 12 months, so the line is not bent by late joiners entering at lower scores.
    const full = A.filter((a) => a.dev[0] != null);
    const T = full.length >= 5 ? full : A;
    c2.querySelector('.card-header .label').textContent = `median · interquartile band · n=${T.length}${T === full ? ' on Vertex all 12 months' : ''}`;
    const med = C.months.map((_, i) => median(T.map((a) => a.dev[i]).filter((v) => v != null)));
    const p25 = C.months.map((_, i) => quantile(T.map((a) => a.dev[i]).filter((v) => v != null), 0.25));
    const p75 = C.months.map((_, i) => quantile(T.map((a) => a.dev[i]).filter((v) => v != null), 0.75));
    { const { box, cv } = chartBox(); c2.append(box); mkChart(cv, { type: 'line', data: { labels: C.months, datasets: [
      { label: 'P75', data: p75, borderColor: alpha(pal[0], 0.35), backgroundColor: alpha(pal[0], 0.12), fill: '+1', pointRadius: 0, borderWidth: 1 },
      { label: 'P25', data: p25, borderColor: alpha(pal[0], 0.35), pointRadius: 0, borderWidth: 1 },
      { label: 'Median', data: med, borderColor: pal[0], borderWidth: 2, pointRadius: 2 },
    ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { suggestedMin: 50, suggestedMax: 90 } }, plugins: { legend: { labels: { filter: (i) => i.text === 'Median' } } } } }); }

    const coachIds = C.coaches.filter((c) => A.some((a) => a.coaches.includes(c.id))).map((c) => c.id);
    const byCoachMonth = coachIds.map((cid) => C.months.map((_, i) => Math.round(A.reduce((s, a) => s + a.feedback.byMonth[i] * (a.feedback.total ? (a.feedback.byCoach[cid] || 0) / a.feedback.total : 0), 0))));
    { const { box, cv } = chartBox(); c3.append(box); mkChart(cv, { type: 'bar', data: { labels: C.months, datasets: coachIds.map((cid, i) => ({ label: coachById[cid].name, data: byCoachMonth[i], backgroundColor: alpha(pal[i % pal.length], 0.8), borderColor: pal[i % pal.length], borderWidth: 1, stack: 'obs' })) }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } }); }

    const srcCount = {};
    A.forEach((a) => Object.values(a.metrics).forEach((m) => { srcCount[m.source] = (srcCount[m.source] || 0) + 1; }));
    const srcKeys = Object.keys(srcCount).sort((x, y) => srcCount[y] - srcCount[x]);
    { const { box, cv } = chartBox(); c4.append(box); mkChart(cv, { type: 'doughnut', data: { labels: srcKeys.map((k) => D.sourceLabel[k] || k), datasets: [{ data: srcKeys.map((k) => srcCount[k]), backgroundColor: srcKeys.map((k, i) => alpha(D.VERIFIED.has(k) ? pal[0] : pal[(i % 3) + 1], D.VERIFIED.has(k) ? 0.85 - i * 0.15 : 0.6)), borderColor: tok('--surface'), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } } }); }

    const kd = metricDef(C.keyMetric);
    const bands = ['U12', 'U14', 'U16', 'U18', 'Open'].filter((b) => A.some((a) => a.band === b));
    const meanOf = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    { const { box, cv } = chartBox(); c5.append(box); mkChart(cv, { type: 'bar', data: { labels: bands, datasets: [
      { label: 'Verified sources', data: bands.map((b) => meanOf(A.filter((a) => a.band === b && a.metrics[C.keyMetric].verified).map((a) => a.metrics[C.keyMetric].value))), backgroundColor: alpha(pal[0], 0.8), borderColor: pal[0], borderWidth: 1 },
      { label: 'All entries', data: bands.map((b) => meanOf(A.filter((a) => a.band === b).map((a) => a.metrics[C.keyMetric].value))), backgroundColor: alpha(pal[6], 0.5), borderColor: pal[6], borderWidth: 1 },
    ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: kd.unit } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtMetric(kd, c.parsed.y)}` } } } } }); }

    // --- standouts ---
    const so = standouts(A);
    const soSec = el('section', 'org-section');
    soSec.innerHTML = cardHead('Standout athletes', 'computed from the filtered cohort');
    const cards = el('div', 'org-standouts');
    const soCard = (title, why, list, metric) => `<article class="card org-standout"><h3>${esc(title)}</h3><p class="org-standout-why">${esc(why)}</p><ol>${list.map((a) => `<li>${who(a.name)}<a class="org-row-link" href="#performance/athlete/${a.id}"><span class="org-person-name">${esc(a.name)}</span><span class="small muted" style="display:block">${esc(a.clubName)} · ${a.band}</span></a><span class="org-standout-metric">${metric(a)}</span></li>`).join('')}</ol></article>`;
    cards.innerHTML =
      soCard('Developing fastest', 'Largest 12-month gain in development score.', so.byDelta, (a) => `${sign(a.devDelta)}<small>now ${a.devScore}</small>`) +
      soCard('Most coach feedback', 'Observation volume, attendance and current streak — a retention and dedication signal.', so.byDedication, (a) => `${a.feedback.total} obs<small>${a.feedback.sessions} sessions<br>${a.feedback.streak}-session streak</small>`) +
      soCard(`Verified ${so.key.label.toLowerCase()}`, 'Best age-adjusted result among entries captured by a verified source (video 240fps / LiDAR / force plate).', so.byVerified, (a) => `${fmtMetric(so.key, a.metrics[C.keyMetric].value)}<small>${esc(D.sourceLabel[a.metrics[C.keyMetric].source])}</small>`) +
      soCard('Physicality', 'Height and wingspan percentile for age and sex.', so.byPhys, (a) => `P${a.anthro.heightPct}<small>height · reach P${a.anthro.wingspanPct}</small>`);
    soSec.append(cards); view.append(soSec);

    // --- tables ---
    const tabs = el('section', 'org-section');
    tabs.innerHTML = `<div class="tabs" role="tablist"><button role="tab" aria-selected="${perfState.tab === 'athletes'}" data-tab="athletes">Athletes (${A.length})</button><button role="tab" aria-selected="${perfState.tab === 'coaches'}" data-tab="coaches">Coaches (${coachIds.length})</button></div><div id="tabBody" role="tabpanel"></div>`;
    view.append(tabs);
    tabs.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => { perfState.tab = b.dataset.tab; tabs.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); paintTab(); }));
    function paintTab() { const body = $('#tabBody'); body.innerHTML = ''; body.append(perfState.tab === 'athletes' ? athleteTable(A) : coachTable(coachIds)); }
    paintTab();
  }

  function athleteTable(A) {
    const kd = metricDef(C.keyMetric);
    const cols = [
      { key: 'name', label: 'Athlete', get: (a) => a.name },
      { key: 'age', label: 'Age', get: (a) => a.age, num: true },
      { key: 'role', label: C.roleLabel, get: (a) => a.role },
      { key: 'devScore', label: 'Dev score', get: (a) => a.devScore, num: true },
      { key: 'devDelta', label: 'Δ 12 mo', get: (a) => a.devDelta, num: true },
      { key: 'trend', label: 'Trend', get: () => 0 },
      { key: 'obs', label: 'Observations', get: (a) => a.feedback.total, num: true },
      { key: 'lastActive', label: 'Last active', get: (a) => a.feedback.lastActive, num: true },
      { key: 'metric', label: kd.label, get: (a) => a.metrics[C.keyMetric].value * (kd.higherBetter ? 1 : -1), num: true },
      { key: 'coaches', label: 'Coaches', get: (a) => a.coaches.length },
    ];
    const wrap = el('div', 'table-wrap org-table-wrap');
    const table = el('table', 'table org-table');
    wrap.append(table);
    function paint() {
      const { key, dir } = perfState.sort;
      const col = cols.find((c) => c.key === key) || cols[3];
      const rows = [...A].sort((x, y) => { const a = col.get(x), b = col.get(y); return (typeof a === 'string' ? a.localeCompare(b) : a - b) * dir; });
      table.innerHTML = `<thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}" data-key="${c.key}" aria-sort="${c.key === key ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>` +
        rows.map((a) => `<tr>
          <td>${personLink(a, a.clubName + ' · ' + a.band)}</td>
          <td class="num">${a.age}</td><td>${esc(a.role)}</td>
          <td class="num"><strong>${a.devScore}</strong></td>
          <td class="num ${a.devDelta >= 0 ? 'org-delta-pos' : 'org-delta-neg'}">${sign(a.devDelta)}</td>
          <td>${sparkline(a.dev)}</td>
          <td class="num">${a.feedback.total}</td>
          <td class="num"><span class="org-dot ${activeTone(a.feedback.lastActive)}"></span>${a.feedback.lastActive}d</td>
          <td class="num">${fmtMetric(kd, a.metrics[C.keyMetric].value)} ${a.metrics[C.keyMetric].verified ? '<span class="org-dot ok" title="Verified source"></span>' : ''}</td>
          <td>${a.coaches.map((c) => `<a class="org-row-link" href="#performance/coach/${c}">${esc(coachById[c].name.replace('Coach ', ''))}</a>`).join(', ')}</td></tr>`).join('') + '</tbody>';
      table.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
        const k = th.dataset.key; if (k === 'trend') return;
        perfState.sort = { key: k, dir: perfState.sort.key === k ? -perfState.sort.dir : (k === 'name' || k === 'role' ? 1 : -1) };
        paint();
      }));
    }
    paint();
    return wrap;
  }

  function coachTable(coachIds) {
    const wrap = el('div', 'table-wrap org-table-wrap');
    const rows = coachIds.map((id) => coachById[id]).sort((x, y) => y.entries - x.entries);
    wrap.innerHTML = `<table class="table org-table"><thead><tr><th>Coach</th><th>Focus</th><th class="num">Athletes</th><th class="num">Observations</th><th class="num">Per athlete / mo</th><th class="num">Athletes' avg Δ</th><th class="num">Active share</th><th class="num">Verified share</th><th>Positive / neutral / critical</th></tr></thead><tbody>` +
      rows.map((c) => `<tr><td><a class="org-row-link org-person" href="#performance/coach/${c.id}">${who(c.name)}<span><span class="org-person-name">${esc(c.name)}</span><span class="small muted">${esc(c.clubs.join(' · '))}</span></span></a></td>
        <td>${esc(c.focus)}</td><td class="num">${c.athleteCount}</td><td class="num">${c.entries}</td><td class="num">${(c.entries / Math.max(1, c.athleteCount) / 12).toFixed(1)}</td>
        <td class="num ${c.avgDelta >= 0 ? 'org-delta-pos' : 'org-delta-neg'}">${sign(c.avgDelta)}</td><td class="num">${fmtPct(c.activeShare)}</td><td class="num">${fmtPct(c.verifiedShare)}</td>
        <td>${sentimentBar(c.sentiment)}</td></tr>`).join('') + '</tbody></table>';
    return wrap;
  }

  function sentimentBar(s) {
    const t = (s.pos + s.neu + s.neg) || 1;
    return `<span class="progress" style="display:inline-block;width:120px;vertical-align:middle;background:linear-gradient(90deg,var(--accent-strong) 0 ${(s.pos / t) * 100}%,var(--ink-faint) ${(s.pos / t) * 100}% ${((s.pos + s.neu) / t) * 100}%,var(--danger) ${((s.pos + s.neu) / t) * 100}% 100%)" title="${s.pos} positive · ${s.neu} neutral · ${s.neg} critical"></span> <span class="small muted num">${Math.round((s.pos / t) * 100)}%</span>`;
  }

  /* ---------- athlete drill-down ---------- */
  function renderAthlete(view, id) {
    const a = athleteById[id];
    if (!a) { view.append(el('div', 'empty-state', '<p>Unknown athlete.</p>')); return; }
    const pal = palette();
    view.append(el('nav', 'org-crumbs', `<a href="#performance">Performance</a><span aria-hidden="true">/</span><a href="#performance/athletes">Athletes</a><span aria-hidden="true">/</span><strong>${esc(a.name)}</strong>`));

    const rank = (fn) => { const sorted = [...C.athletes].sort((x, y) => fn(y) - fn(x)); return sorted.findIndex((x) => x.id === a.id) + 1; };
    const head = el('article', 'card org-profile-head');
    head.innerHTML = `<div class="org-person org-profile-id">${who(a.name, true)}<div>
        <p class="kicker">${esc(a.band)} · ${a.sex === 'F' ? 'Female' : 'Male'} · ${a.age} yrs</p><h1>${esc(a.name)}</h1>
        <div class="small muted">${esc(a.clubName)} · ${esc(C.roleLabel)}: ${esc(a.role)} · on Vertex ${a.joinedMonthsAgo} months</div>
        <div class="org-profile-meta">${a.coaches.map((c) => `<a class="pill" href="#performance/coach/${c}">${esc(coachById[c].name)}</a>`).join('')}
        ${a.link ? `<a class="btn btn-primary btn-sm" href="${esc(a.link)}">${esc(a.linkLabel || 'Open full dashboard')} →</a>` : ''}</div></div></div>
      <div class="org-stats">
        ${stat('Development score', a.devScore, `rank ${rank((x) => x.devScore)} of ${C.athletes.length}`)}
        ${stat('Δ 12 months', sign(a.devDelta), `rank ${rank((x) => x.devDelta)} · fastest developers`, a.devDelta > 6 ? 'ok' : '')}
        ${stat('Coach observations', a.feedback.total, `${a.feedback.cadence} / month · ${a.feedback.sessions} sessions`)}
        ${stat('Current streak', a.feedback.streak, `last active ${a.feedback.lastActive}d ago`, activeTone(a.feedback.lastActive))}
      </div>`;
    view.append(head);

    const grid = el('div', 'org-grid org-section');
    const radar = el('article', 'card span-4 org-card-pad', cardHead('Attribute radar', 'season 1 → season 2'));
    const traj = el('article', 'card span-8 org-card-pad', cardHead('Development trajectory', '12 months · cohort median for reference'));
    const met = el('article', 'card span-7 org-card-pad', cardHead('Verified performance metrics', 'provenance on every entry'));
    const phys = el('article', 'card span-5 org-card-pad', cardHead('Physicality', 'percentile for age and sex'));
    const fb = el('article', 'card span-7 org-card-pad', cardHead('Coach feedback', 'observations per month · by coach'));
    const read = el('article', 'card span-5 org-card-pad', cardHead('Vertex read', 'auto-generated from the data'));
    grid.append(radar, traj, met, phys, fb, read); view.append(grid);

    { const { box, cv } = chartBox(); radar.append(box); mkChart(cv, { type: 'radar', data: { labels: C.attributes, datasets: [
      { label: 'Season 1', data: a.s1, borderColor: alpha(pal[6], 0.9), backgroundColor: alpha(pal[6], 0.15), pointRadius: 2 },
      { label: 'Season 2', data: a.s2, borderColor: pal[0], backgroundColor: alpha(pal[0], 0.2), pointRadius: 2 },
    ] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { suggestedMin: 20, suggestedMax: 100, ticks: { display: false } } } } }); }

    const cohortMed = C.months.map((_, i) => median(C.athletes.map((x) => x.dev[i]).filter((v) => v != null)));
    { const { box, cv } = chartBox(); traj.append(box); mkChart(cv, { type: 'line', data: { labels: C.months, datasets: [
      { label: a.name, data: a.dev, borderColor: pal[0], borderWidth: 2, spanGaps: false },
      { label: 'Cohort median', data: cohortMed, borderColor: alpha(pal[6], 0.8), borderDash: [4, 4], pointRadius: 0 },
    ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { suggestedMin: 40, suggestedMax: 95 } } } }); }

    met.insertAdjacentHTML('beforeend', `<div class="table-wrap"><table class="table org-metric-table"><thead><tr><th>Metric</th><th class="num">Now</th><th class="num">First</th><th class="num">Change</th><th>Source</th><th class="num">Cohort z</th></tr></thead><tbody>` +
      C.metrics.map((d) => { const m = a.metrics[d.key]; const ch = m.value - m.first; const good = d.higherBetter ? ch >= 0 : ch <= 0; return `<tr><td>${esc(d.label)}</td><td class="num"><strong>${fmtMetric(d, m.value)}</strong></td><td class="num muted">${fmtMetric(d, m.first)}</td><td class="num ${good ? 'org-delta-pos' : 'org-delta-neg'}">${(ch > 0 ? '+' : '') + (d.d ? ch.toFixed(d.d) : Math.round(ch))}</td><td>${srcPill(m)}</td><td class="num">${sign((m.z * (d.higherBetter ? 1 : -1)).toFixed(1))}</td></tr>`; }).join('') +
      `</tbody></table></div><p class="org-note">Entries from different sources are not directly comparable (ADR-0002); the cohort z-score is computed within the same metric regardless of source and is indicative only.</p>`);

    phys.insertAdjacentHTML('beforeend', `<div class="org-bars">
      ${[['Height', a.anthro.height + ' cm', a.anthro.heightPct], ['Wingspan', a.anthro.wingspan + ' cm', a.anthro.wingspanPct], ['Weight', a.anthro.weight + ' kg', a.anthro.weightPct]].map(([l, v, p]) => `<div class="org-bar-row"><span class="org-bar-label">${l}</span><div class="progress"><div class="progress-fill" style="width:${p}%"></div></div><span class="num">P${p}</span></div>`).join('')}
      </div><dl class="org-kv" style="margin-top:12px"><dt>Reach ratio</dt><dd>${(a.anthro.wingspan / a.anthro.height).toFixed(3)} (wingspan ÷ height)</dd><dt>Age band</dt><dd>${a.band} · ${a.age} yrs</dd></dl>
      <p class="org-note">Percentiles are against the Vertex cohort model for the athlete's age and sex, not a national reference — a projection aid, not a measurement.</p>`);

    { const { box, cv } = chartBox('short'); fb.append(box); mkChart(cv, { type: 'bar', data: { labels: C.months, datasets: a.coaches.map((cid, i) => ({ label: coachById[cid].name, data: a.feedback.byMonth.map((v) => Math.round(v * (a.feedback.total ? (a.feedback.byCoach[cid] || 0) / a.feedback.total : 0))), backgroundColor: alpha(pal[i % pal.length], 0.8), borderColor: pal[i % pal.length], borderWidth: 1, stack: 'o' })) }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } } }); }
    fb.insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:10px;gap:16px"><div>${sentimentBar(a.feedback.sentiment)}</div>` + a.coaches.map((cid) => `<a class="org-row-link small" href="#performance/coach/${cid}">${esc(coachById[cid].name)} · ${a.feedback.byCoach[cid] || 0} obs</a>`).join('') + '</div>');

    const best = C.attributes[a.s2.indexOf(Math.max(...a.s2))], worst = C.attributes[a.s2.indexOf(Math.min(...a.s2))];
    const gain = C.attributes[a.s2.map((v, i) => v - a.s1[i]).indexOf(Math.max(...a.s2.map((v, i) => v - a.s1[i])))];
    const kd = metricDef(C.keyMetric), km = a.metrics[C.keyMetric];
    const flags = [];
    if (a.devDelta >= 9) flags.push('one of the fastest-developing athletes in the cohort');
    if (a.feedback.total >= quantile(C.athletes.map((x) => x.feedback.total), 0.8)) flags.push('in the top 20% for coach feedback volume — a strong retention and dedication signal');
    if (km.verified && km.z * (kd.higherBetter ? 1 : -1) >= 1) flags.push(`a verified ${kd.label.toLowerCase()} more than one standard deviation above peers`);
    if ((a.anthro.heightPct + a.anthro.wingspanPct) / 2 >= 85) flags.push('physical profile in the top 15% for age');
    if (a.feedback.lastActive > 21) flags.push(`no activity for ${a.feedback.lastActive} days — worth a check-in`);
    read.insertAdjacentHTML('beforeend', `<ul class="org-inline-list">
      <li><strong>Strength:</strong> ${esc(best)} (${Math.max(...a.s2)}). <strong>Biggest gain:</strong> ${esc(gain)} (${sign(Math.max(...a.s2.map((v, i) => v - a.s1[i])))}).</li>
      <li><strong>Growth area:</strong> ${esc(worst)} (${Math.min(...a.s2)}) — the lowest current attribute and the natural next focus.</li>
      <li><strong>Feedback:</strong> ${a.feedback.total} observations from ${a.coaches.length} coach${a.coaches.length > 1 ? 'es' : ''} (${Math.round(a.feedback.sentiment.pos / Math.max(1, a.feedback.total) * 100)}% positive).</li>
      ${flags.map((f) => `<li><strong>Flag:</strong> ${f}.</li>`).join('')}
    </ul><p class="org-note">Illustrative summary generated from the mock data — in production this is the coach-supported Vertex insight panel.</p>`);
  }

  /* ---------- coach drill-down ---------- */
  function renderCoach(view, id) {
    const c = coachById[id];
    if (!c) { view.append(el('div', 'empty-state', '<p>Unknown coach.</p>')); return; }
    const pal = palette();
    const mine = c.athletes.map((aid) => athleteById[aid]);
    view.append(el('nav', 'org-crumbs', `<a href="#performance">Performance</a><span aria-hidden="true">/</span><a href="#performance/coaches">Coaches</a><span aria-hidden="true">/</span><strong>${esc(c.name)}</strong>`));
    const head = el('article', 'card org-profile-head');
    head.innerHTML = `<div class="org-person org-profile-id">${who(c.name, true)}<div>
        <p class="kicker">Coach profile · ${esc(M.label)}</p><h1>${esc(c.name)}</h1>
        <div class="small muted">${esc(c.focus)} · ${esc(c.accreditation)} · on Vertex since ${esc(c.since)}</div>
        <div class="org-profile-meta">${c.clubs.map((n) => pill(n)).join('')}</div></div></div>
      <div class="org-stats">
        ${stat('Athletes', c.athleteCount, c.clubs.length + ' club' + (c.clubs.length > 1 ? 's' : ''))}
        ${stat('Observations · 12 mo', c.entries, `${(c.entries / Math.max(1, c.athleteCount) / 12).toFixed(1)} per athlete per month`)}
        ${stat("Athletes' avg Δ", sign(c.avgDelta), 'dev score points · 12 months', c.avgDelta > 6 ? 'ok' : '')}
        ${stat('Active athletes', fmtPct(c.activeShare), 'seen in the last 14 days', c.activeShare > 0.75 ? 'ok' : 'warn')}
        ${stat('Verified metrics', fmtPct(c.verifiedShare), 'share of entries with a verified source')}
      </div>`;
    view.append(head);

    const grid = el('div', 'org-grid org-section');
    const act = el('article', 'card span-8 org-card-pad', cardHead('Activity', 'observations logged per month'));
    const mix = el('article', 'card span-4 org-card-pad', cardHead('Attribute mix', 'what this coach observes'));
    const tbl = el('article', 'card span-12 org-card-pad', cardHead('Athletes coached', 'click to drill down'));
    grid.append(act, mix, tbl); view.append(grid);
    { const { box, cv } = chartBox(); act.append(box); mkChart(cv, { type: 'bar', data: { labels: C.months, datasets: [{ label: 'Observations', data: c.byMonth, backgroundColor: alpha(pal[0], 0.8), borderColor: pal[0], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); }
    { const { box, cv } = chartBox(); mix.append(box); mkChart(cv, { type: 'polarArea', data: { labels: C.attributes, datasets: [{ data: c.attrMix.map((v) => Math.round(v * 100)), backgroundColor: C.attributes.map((_, i) => alpha(pal[i % pal.length], 0.55)), borderColor: C.attributes.map((_, i) => pal[i % pal.length]), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { ticks: { display: false } } }, plugins: { legend: { position: 'right' } } } }); }
    mix.insertAdjacentHTML('beforeend', `<div style="margin-top:8px">${sentimentBar(c.sentiment)} <span class="small muted">positive share of observations</span></div>`);
    const saved = perfState.sort; perfState.sort = { key: 'devDelta', dir: -1 };
    tbl.append(athleteTable(mine));
    perfState.sort = saved;
  }

  /* ---------- lists (sidebar drill-down shortcuts) ---------- */
  function renderList(view, kind) {
    const A = filtered();
    view.append(el('nav', 'org-crumbs', `<a href="#performance">Performance</a><span aria-hidden="true">/</span><strong>${kind === 'coaches' ? 'Coaches' : 'Athletes'}</strong>`));
    view.append(el('header', 'org-head', `<div><p class="kicker">${esc(M.label)} · drill-down</p><h1>${kind === 'coaches' ? 'Coaches' : 'Athletes'}</h1><p>${kind === 'coaches' ? 'Every coach logging into Vertex for this sport, with feedback volume, cadence and the development of the athletes they coach.' : 'Every athlete on Vertex for this sport. Sort any column; click a name for the individual profile.'}</p></div>`));
    view.append(kind === 'coaches' ? coachTable(C.coaches.map((c) => c.id)) : athleteTable(A));
  }

  /* ====================================================================
     EXAMPLES & LINKS
     ==================================================================== */
  function renderExamples(view) {
    const E = D.examples[sport], S = D.examples.shared;
    view.append(el('header', 'org-head', `<div><p class="kicker">Examples &amp; Links · ${esc(M.label)}</p><h1>See it working</h1><p>Live examples of the coach test interfaces, workshop reports, player profiles and coach profiles that sit behind the numbers on the other two pages. Everything opens in the existing Vertex mockups.</p></div>`));
    const linkCard = (l) => `<a class="card org-link" href="${esc(l.href)}"><span class="org-link-title">${esc(l.title)}</span><span class="org-link-desc">${esc(l.desc)}</span><span class="org-link-href">${esc(l.href)}</span></a>`;
    const section = (title, sub, items) => { const s = el('section', 'org-section'); s.innerHTML = cardHead(title, sub) + `<div class="org-links">${items.join('')}</div>`; return s; };
    view.append(section("Coach test interfaces", `${E.coachInterfaces.length} tools`, E.coachInterfaces.map(linkCard)));
    view.append(section('Workshop reports', 'the report an athlete takes home · shared across both sports', S.workshopReports.map(linkCard)));
    const heroes = C.athletes.filter((a) => a.hero);
    view.append(section('Player individual profiles', 'full dashboards + org drill-downs', [
      ...E.playerProfiles.map(linkCard),
      ...heroes.map((a) => linkCard({ title: `${a.name} — organisation drill-down`, href: `#performance/athlete/${a.id}`, desc: 'The same athlete inside this dashboard: trajectory, verified metrics, feedback and the Vertex read.' })),
      linkCard({ title: 'All athletes', href: '#performance/athletes', desc: `${C.athletes.length} ${M.label.toLowerCase()} athletes, sortable, each with an individual profile.` }),
    ]));
    view.append(section("Coach individual profiles", `${C.coaches.length} coaches`, C.coaches.map((c) => linkCard({ title: c.name, href: `#performance/coach/${c.id}`, desc: `${c.focus} · ${c.athleteCount} athletes · ${c.entries} observations in 12 months.` }))));
  }

  /* ====================================================================
     ROUTER
     ==================================================================== */
  function render() {
    destroyCharts();
    const view = $('#view');
    view.innerHTML = '';
    const hash = (location.hash || '#sales').replace(/^#/, '');
    const [page, sub, id] = hash.split('/');
    if (page === 'performance') {
      if (sub === 'athlete' && id) renderAthlete(view, id);
      else if (sub === 'coach' && id) renderCoach(view, id);
      else if (sub === 'athletes' || sub === 'coaches') renderList(view, sub);
      else renderPerformance(view);
    } else if (page === 'examples') renderExamples(view);
    else renderSales(view);
    syncSportSwitch();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  window.addEventListener('hashchange', render);
  new MutationObserver(() => { Object.keys(tokCache).forEach((k) => delete tokCache[k]); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#sales');
  render();
})();
