// Vertex boxer dashboard rendering & interaction.
// Mirrors app.js but pulls from window.BoxerData and adds:
//  - 3rd radar dataset: coach satisfaction overlay (tone-coloured)
//  - Roster picker: switching athletes re-renders the radar, spark, hero KPIs
//  - Workshop-cohort comparison (squad average) instead of NBA study targets
//  - Weight chart instead of height
//  - Feed filtered to discipline:'boxing' merged with seedFeed
(() => {
  const B = window.BoxerData;
  const V = window.VertexData || {};

  // ---------- helpers ----------
  const $  = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const el = (tag, attrs={}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  const coachChip = (coachId) => {
    const c = B.coaches[coachId];
    if (!c) return null;
    return el('span', { class:'coach-chip', 'data-coach':coachId, title:`${c.name} — recent contributor` },
      el('span', { class:'ini' }, c.initials),
      c.name.replace('Coach ',''));
  };

  const attribution = (coachIds) => {
    const wrap = el('div', { class:'attribution' });
    coachIds.forEach(id => { const chip = coachChip(id); if (chip) wrap.appendChild(chip); });
    return wrap;
  };

  const contribBar = (coachWeights) => {
    const bar = el('div', { class:'contrib-bar', title:'Share of observations by coach' });
    Object.entries(coachWeights).forEach(([id, w]) => {
      const c = B.coaches[id];
      if (!c) return;
      bar.appendChild(el('span', { style:`width:${(w*100).toFixed(0)}%;background:${c.color};` }));
    });
    return bar;
  };

  const consensusBadge = (state) => {
    const label = state === 'aligned' ? 'Coaches aligned' : 'Mixed signals';
    return el('span', { class:`consensus ${state}`, title:label },
      el('span', { class:'dotc' }), label);
  };

  // Satisfaction tone helpers (match boxing.html slider thresholds)
  const toneFor = (v) => v >= 67 ? 'high' : v >= 34 ? 'mid' : 'low';
  const toneColor = (t) => t === 'high' ? 'rgba(141,224,138,1)' : t === 'mid' ? 'rgba(107,182,255,1)' : 'rgba(255,138,64,1)';
  const toneFill  = (t) => t === 'high' ? 'rgba(141,224,138,0.18)' : t === 'mid' ? 'rgba(107,182,255,0.18)' : 'rgba(255,138,64,0.18)';
  // Average a satisfaction array to pick one overlay tone
  const overallTone = (arr) => {
    const m = arr.reduce((s,v)=>s+v,0) / arr.length;
    return toneFor(Math.round(m));
  };

  // ---------- Chart defaults ----------
  Chart.defaults.font.family = "'Roboto Mono', ui-monospace, monospace";
  Chart.defaults.color = '#a9b7cb';
  Chart.defaults.animation.duration = 900;
  Chart.defaults.animation.easing = 'easeOutQuart';
  Chart.defaults.animations.colors = { duration: 600, easing: 'easeOutQuart' };
  Chart.defaults.animations.numbers = { duration: 900, easing: 'easeOutQuart' };

  const radarScale = {
    min:0, max:100,
    ticks:{ display:false, stepSize:20 },
    angleLines:{ color:'rgba(255,255,255,0.09)' },
    grid:{ color:'rgba(255,255,255,0.08)' },
    pointLabels:{ color:'#a9b7cb', font:{ family:'Inter', size:11, weight:'600' } }
  };

  // ---------- Radar datasets (for the selected athlete) ----------
  // 1. Season 1, 2. Season 2, 3. Satisfaction overlay (dashed, tone-tinted)
  const radarDatasets = (athlete) => {
    const tone = overallTone(athlete.satisfaction);
    return [
      { label:'Season 1',
        data:athlete.season1,
        borderColor:'rgba(127,140,255,0.9)', backgroundColor:'rgba(127,140,255,0.14)',
        pointBackgroundColor:'rgba(127,140,255,1)', borderWidth:2 },
      { label:'Season 2',
        data:athlete.season2,
        borderColor:'rgba(89,183,255,1)', backgroundColor:'rgba(89,183,255,0.18)',
        pointBackgroundColor:'rgba(154,217,255,1)', borderWidth:2 },
      { label:'Satisfaction (current)',
        data:athlete.satisfaction,
        borderColor:toneColor(tone), backgroundColor:toneFill(tone),
        pointBackgroundColor:athlete.satisfaction.map(v => toneColor(toneFor(v))),
        pointRadius:3.5, borderWidth:2, borderDash:[5,4] },
    ];
  };

  // ---------- find hero + selected athlete state ----------
  const heroAthlete = B.athletes.find(a => a.hero) || B.athletes[0];
  let selected = heroAthlete;

  // ---------- Chart handles (we update these on athlete switch) ----------
  let heroRadar, skillRadar, devSpark;

  // Build initial radar charts (hero + main)
  heroRadar = new Chart($('#heroRadarChart'), {
    type:'radar',
    data:{ labels:B.radarLabels, datasets:radarDatasets(selected) },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ r:radarScale } }
  });

  skillRadar = new Chart($('#skillRadarChart'), {
    type:'radar',
    data:{ labels:B.radarLabels, datasets:radarDatasets(selected) },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#dce9fb', usePointStyle:true, boxWidth:10, boxHeight:10, padding:18, font:{ family:'Inter', size:11, weight:'600' } } } },
      scales:{ r:radarScale }
    }
  });

  // ---------- Dev score sparkline (KPI) ----------
  // For non-hero athletes we synthesise a small ramp from their delta so the
  // spark still tells the right story.
  const seriesFor = (a) => {
    if (a.hero && B.devScoreSeries) return B.devScoreSeries;
    const end = a.devScore;
    const start = Math.max(40, end - (a.delta || 6));
    const n = (B.devScoreSeries && B.devScoreSeries.length) || 9;
    return Array.from({ length:n }, (_, i) => Math.round(start + (end - start) * (i / (n - 1))));
  };

  devSpark = new Chart($('#devSpark'), {
    type:'line',
    data:{
      labels:B.months,
      datasets:[{
        data:seriesFor(selected),
        borderColor:'rgba(89,183,255,1)',
        backgroundColor:'rgba(89,183,255,0.18)',
        fill:true, tension:.35, borderWidth:1.5, pointRadius:0
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:{ enabled:false } },
      scales:{ x:{ display:false }, y:{ display:false } },
      elements:{ line:{ borderJoinStyle:'round' } }
    }
  });

  // ---------- Weight & conditioning projection ----------
  new Chart($('#weightChart'), {
    type:'line',
    data:{
      labels:B.weightLabels,
      datasets:[
        {
          label:'Weight — actual (kg)',
          data:B.weightActual,
          borderColor:'rgba(89,183,255,1)',
          backgroundColor:'rgba(89,183,255,0.12)',
          fill:false, tension:.25, borderWidth:2.2, pointRadius:3, pointBackgroundColor:'rgba(154,217,255,1)',
          spanGaps:false, yAxisID:'y'
        },
        {
          label:'Weight — projected',
          data:B.weightProjected,
          borderColor:'rgba(127,140,255,1)',
          borderDash:[6,5],
          fill:false, tension:.25, borderWidth:2, pointRadius:3, pointBackgroundColor:'rgba(127,140,255,1)',
          spanGaps:false, yAxisID:'y'
        },
        {
          label:'Band high',
          data:B.weightBandHi,
          borderColor:'rgba(127,140,255,0)',
          backgroundColor:'rgba(127,140,255,0.15)',
          fill:'+1', pointRadius:0, borderWidth:0, tension:.25, spanGaps:false, yAxisID:'y'
        },
        {
          label:'Band low',
          data:B.weightBandLo,
          borderColor:'rgba(127,140,255,0)',
          backgroundColor:'rgba(127,140,255,0.15)',
          fill:false, pointRadius:0, borderWidth:0, tension:.25, spanGaps:false, yAxisID:'y'
        },
        {
          label:'Conditioning index',
          data:B.conditioningActual,
          borderColor:'rgba(95,227,156,0.9)',
          backgroundColor:'rgba(95,227,156,0.1)',
          fill:false, tension:.25, borderWidth:1.8, pointRadius:2.5, pointBackgroundColor:'rgba(95,227,156,1)',
          spanGaps:false, yAxisID:'y2'
        },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{
          labels:{
            color:'#dce9fb', usePointStyle:true, boxWidth:10, boxHeight:10, padding:14,
            font:{ family:'Inter', size:11, weight:'600' },
            filter: it => !it.text.startsWith('Band')
          }
        },
        tooltip:{
          callbacks:{
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (v == null) return `${ctx.dataset.label}: —`;
              if (ctx.dataset.label === 'Conditioning index') return `${ctx.dataset.label}: ${v.toFixed(1)}`;
              return `${ctx.dataset.label}: ${v.toFixed(1)} kg`;
            }
          }
        }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#a9b7cb', font:{ size:10 } } },
        y:{ position:'left',  grid:{ color:'rgba(255,255,255,0.06)' }, ticks:{ color:'#a9b7cb', callback:v=>v+' kg' }, suggestedMin:62, suggestedMax:73 },
        y2:{ position:'right', grid:{ display:false }, ticks:{ color:'#7fc6a3' }, suggestedMin:44, suggestedMax:60 }
      }
    }
  });

  // ---------- Attribute trends (small multiples) ----------
  const obsGrid = $('#observationsGrid');
  obsGrid.innerHTML = '';
  B.attributeTrends.forEach((a, i) => {
    const canvasId = `spark-${a.key}`;
    const card = el('div', { class:'obs-card' },
      el('div', { class:'obs-top' },
        el('strong', {}, a.label),
        el('span', { class:`trend ${a.trend}` }, a.trend === 'up' ? 'Improving' : a.trend === 'down' ? 'Needs attention' : 'Stable')
      ),
      el('div', { class:'chart-frame obs-spark' }, el('canvas', { id:canvasId })),
      el('p', {}, a.text),
      contribBar(a.coaches),
      el('div', { class:'obs-footer' },
        attribution(Object.keys(a.coaches)),
        consensusBadge(a.consensus)
      )
    );
    obsGrid.appendChild(card);

    const color = a.trend === 'down' ? 'rgba(255,125,125,1)' : a.trend === 'flat' ? 'rgba(255,191,102,1)' : 'rgba(95,227,156,1)';
    const fill  = a.trend === 'down' ? 'rgba(255,125,125,0.12)' : a.trend === 'flat' ? 'rgba(255,191,102,0.1)' : 'rgba(95,227,156,0.12)';
    new Chart(document.getElementById(canvasId), {
      type:'line',
      data:{ labels:B.months, datasets:[{ data:a.series, borderColor:color, backgroundColor:fill, fill:true, tension:.35, borderWidth:1.5, pointRadius:0 }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ enabled:false } },
        scales:{ x:{ display:false }, y:{ display:false, suggestedMin:Math.min(...a.series)-5, suggestedMax:Math.max(...a.series)+5 } }
      }
    });
  });

  // ---------- Workshop cohort comparison (peer share) ----------
  const shareListEl = $('#shareList');
  const gapCallout  = $('#gapCallout');
  const activeShare = new Set();

  const consentMeta = {
    consent: { label:'Mutual share',  cls:'consent-ok',      action:'Compare' },
    pending: { label:'Pending',       cls:'consent-pending', action:'Resend invite' },
    none:    { label:'Not connected', cls:'consent-none',    action:'Send invite' },
  };

  // Always include a "Workshop cohort" pseudo-peer at the top
  const cohortPeer = {
    id:'cohort_avg', name:'Workshop squad', level:'12 athletes', stance:'Average',
    devScore:Math.round(B.athletes.reduce((s,a)=>s+a.devScore,0)/B.athletes.length),
    delta:+7, consent:'consent', season1:B.cohort.map(v=>v-12), season2:B.cohort, cohort:true
  };

  const peers = [cohortPeer, ...B.statShare];

  const renderStatShare = () => {
    shareListEl.innerHTML = '';
    peers.forEach(p => {
      const meta = consentMeta[p.consent];
      const canCompare = p.consent === 'consent';
      const active = activeShare.has(p.id);
      const row = el('div', { class:`share-row${active?' active':''}${canCompare?'':' locked'}${p.cohort?' cohort':''}`, 'data-id':p.id,
          title: canCompare ? 'Tap to overlay on radar' : 'Stats locked — mutual consent required',
          onclick: () => { if (canCompare) togglePeer(p.id); } },
        el('div', { class:'share-avatar' }, p.cohort ? '★' : p.name.split(' ').map(n=>n[0]).join('')),
        el('div', { class:'share-info' },
          el('span', { class:'share-name' }, p.name),
          el('span', { class:'share-pos' }, `${p.level} · ${p.stance}`),
          el('span', { class:`consent-badge ${meta.cls}` },
            el('span', { class:'consent-dot' }),
            meta.label
          )
        ),
        canCompare
          ? el('span', { class:'share-score', title:'Shared development score' }, String(p.devScore))
          : el('span', { class:'share-score locked', title:'Mutual consent required' }, '—'),
        canCompare
          ? el('span', { class:`share-delta ${p.delta>=0?'up':'down'}` }, (p.delta>=0?'+':'')+p.delta)
          : el('button', { class:'invite-btn', onclick:(e)=>{ e.stopPropagation(); inviteFlow(p); } }, meta.action)
      );
      shareListEl.appendChild(row);
    });
    renderGap();
  };

  const inviteFlow = (p) => {
    if (p.consent === 'none')         { p.consent = 'pending'; toast(`Invite sent to ${p.name}.`); }
    else if (p.consent === 'pending') { toast(`Reminder sent to ${p.name}. Awaiting their consent.`); }
    renderStatShare();
  };

  const toast = (msg) => {
    let t = $('#toast');
    if (!t) { t = el('div', { id:'toast', class:'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3200);
  };

  const togglePeer = (id) => {
    if (activeShare.has(id)) activeShare.delete(id); else activeShare.add(id);
    refreshSkillRadar();
    renderStatShare();
  };

  const refreshSkillRadar = () => {
    const base = radarDatasets(selected);
    peers.filter(p => activeShare.has(p.id) && p.consent === 'consent').forEach((p, idx) => {
      const palette = p.cohort
        ? ['rgba(255,255,255,0.85)']
        : ['rgba(95,227,156,1)','rgba(255,191,102,1)','rgba(200,155,255,1)','rgba(255,125,125,1)'];
      const color = palette[idx % palette.length];
      base.push({
        label:`${p.name} · S2`,
        data:p.season2,
        borderColor:color,
        backgroundColor:color.replace('1)','0.10)').replace('0.85)','0.08)'),
        pointBackgroundColor:color,
        borderWidth: p.cohort ? 1.6 : 2,
        borderDash: p.cohort ? [2,4] : [4,4]
      });
    });
    skillRadar.data.datasets = base;
    skillRadar.update();
  };

  const renderGap = () => {
    const active = peers.filter(p => activeShare.has(p.id) && p.consent === 'consent');
    if (!active.length) {
      gapCallout.textContent = 'Scores from workshop peers only appear with mutual consent. Tap the workshop squad average or a connected boxer to overlay on the radar.';
      return;
    }
    const medians = B.radarLabels.map((_, i) => {
      const vals = active.map(p => p.season2[i]).sort((a,b)=>a-b);
      const mid = Math.floor(vals.length/2);
      return vals.length % 2 ? vals[mid] : Math.round((vals[mid-1]+vals[mid])/2);
    });
    const gaps = B.radarLabels.map((label, i) => ({ label, diff: selected.season2[i] - medians[i] }))
      .sort((a,b) => a.diff - b.diff);
    const worst = gaps[0];
    if (worst.diff >= 0) {
      gapCallout.textContent = `${selected.name} is at or above the cohort median on every attribute. Closest gap: ${worst.label} (${worst.diff>=0?'+':''}${worst.diff}).`;
    } else {
      gapCallout.innerHTML = `Largest gap vs cohort median: <strong style="color:#ffe6c2">${worst.label} ${worst.diff}</strong>. Use this as a focus prompt, not a ranking.`;
    }
  };
  renderStatShare();

  // ---------- Timeline ----------
  const fillTimeline = (containerId, items) => {
    const c = $(containerId);
    c.innerHTML = '';
    items.forEach(m => {
      c.appendChild(el('div', { class:'milestone' },
        el('div', { class:'date' }, m.date),
        el('div', { class:'dot' }),
        el('div', {},
          el('p', {}, m.text),
          attribution(m.coaches || [])
        )
      ));
    });
  };
  fillTimeline('#timelineS1', B.timeline.s1);
  fillTimeline('#timelineS2', B.timeline.s2);
  fillTimeline('#timelineTurning', B.timeline.turning);

  // ---------- Strengths / growth / focus ----------
  const fillList = (containerId, items) => {
    const ul = $(containerId);
    ul.innerHTML = '';
    items.forEach(item => {
      ul.appendChild(el('li', {},
        document.createTextNode(item.text),
        attribution(item.coaches || [])
      ));
    });
  };
  fillList('#listStrengths', B.lists.strengths);
  fillList('#listGrowth',    B.lists.growth);
  fillList('#listFocus',     B.lists.focus);

  // ---------- Observation feed ----------
  // Boxing-discipline live entries from the unified VertexData.feed merged with the seed feed.
  const boxerCoachIds = new Set(Object.keys(B.coaches));
  const liveBoxingEntries = (V.feed || [])
    .filter(f => f.discipline === 'boxing' && boxerCoachIds.has(f.coach));

  // Live entries first (most-recent at top of the page), then historical seed.
  const allFeed = [...liveBoxingEntries, ...B.seedFeed];

  const feedEl = $('#feed');
  feedEl.innerHTML = '';
  allFeed.forEach(f => {
    feedEl.appendChild(el('div', { class:'feed-item', 'data-coach':f.coach },
      el('div', { class:'feed-meta' },
        el('span', { class:'tag' }, f.date),
        coachChip(f.coach),
        el('span', { class:'tag' }, f.kind || 'Workshop'),
        el('span', { class:'tag' }, f.topic || '—')
      ),
      el('p', {}, f.text)
    ));
  });

  // Empty-state guard
  if (!allFeed.length) {
    feedEl.appendChild(el('div', { class:'sub', style:'padding:14px 6px;' },
      'No observations yet. Log workshop observations in the Boxing Workshop Coach Input mockup — they appear here automatically.'));
  }

  // Coach filter
  const filterBar = $('#coachFilter');
  const buildFilters = () => {
    filterBar.innerHTML = '';
    const mk = (id, label) => {
      const b = el('button', { 'data-filter':id, onclick: () => applyFilter(id) }, label);
      if (id === 'all') b.classList.add('active');
      return b;
    };
    filterBar.appendChild(mk('all','All coaches'));
    Object.values(B.coaches).forEach(c => filterBar.appendChild(mk(c.id, c.name)));
  };
  const applyFilter = (id) => {
    $$('#coachFilter button').forEach(b => b.classList.toggle('active', b.dataset.filter === id));
    $$('#feed .feed-item').forEach(item => {
      item.classList.toggle('hidden', id !== 'all' && item.dataset.coach !== id);
    });
  };
  buildFilters();

  // ---------- Observation volume heatmap ----------
  const heatTable = $('#heatTable');
  const cap = (v) => v >= 4 ? 4 : v >= 3 ? 3 : v >= 2 ? 2 : v >= 1 ? 1 : 0;
  const thead = el('tr', {}, el('th', {}, ''), ...B.heatMonths.map(m => el('th', {}, m)));
  heatTable.appendChild(thead);
  B.heatCategories.forEach((cat, i) => {
    const row = el('tr', {}, el('td', { class:'label' }, cat));
    B.heatValues[i].forEach(v => row.appendChild(el('td', { 'data-v':String(cap(v)), title:`${v} observation${v===1?'':'s'}` }, v ? String(v) : '')));
    heatTable.appendChild(row);
  });

  // ---------- Roster picker ----------
  // Switching athlete: re-render hero meta, KPIs, profile, both radars, dev spark.
  // (Lists/timeline/observation grid/heatmap/feed stay hero-specific by design —
  // the workshop dashboard is Mateo's deep dive, with the other 11 surfaced
  // via radar + KPI snapshot only.)
  const rosterSelect = $('#rosterSelect');
  const rosterSub    = $('#rosterSub');

  // Build options
  B.athletes.forEach(a => {
    const opt = el('option', { value:a.id }, `${a.name} · ${a.level}${a.hero ? ' (hero)' : ''}`);
    if (a.id === selected.id) opt.setAttribute('selected', '');
    rosterSelect.appendChild(opt);
  });

  const setHeroMeta = (a) => {
    const meta = $('#heroMetaPills');
    meta.innerHTML = '';
    const pills = [
      a.level,
      a.stance,
      a.ageGroup || '12-athlete workshop',
      a.team || 'Iron Vine Boxing — Workshop',
    ];
    pills.forEach(p => meta.appendChild(el('span', { class:'pill' }, p)));
  };

  const renderProfileCard = (a) => {
    $('#profileName').textContent = a.name;
    $('#profileMeta').innerHTML =
      `Level: ${a.level}<br>Stance: ${a.stance}<br>Team: ${a.team || 'Iron Vine Boxing — Workshop'}<br>Season range: Season 1 → Season 2`;
    $('#kpiDev').textContent = a.devScore;
    $('#kpiDevSub').textContent = `${a.delta>=0?'+':''}${a.delta} pts across 2 seasons`;
    $('#kpiConf').textContent  = a.confidence  || (a.devScore >= 80 ? '8.6/10' : a.devScore >= 70 ? '7.8/10' : '7.0/10');
    $('#kpiStage').textContent = a.stage       || (a.level === 'Advanced' ? 'Build → Perform' : a.level === 'Intermediate' ? 'Foundation → Build' : 'Foundation');
    $('#kpiReady').textContent = a.readiness   || (a.level === 'Advanced' ? 'Workshop lead' : a.level === 'Intermediate' ? 'Sparring partner' : 'Drill partner');

    // Portraits — hero athlete uses the player photo, others fall back to an initials tile via CSS.
    const portraits = [$('#heroPortrait'), $('#profilePortrait')];
    portraits.forEach(img => {
      if (a.portrait) {
        img.src = a.portrait;
        img.alt = a.name;
        img.style.display = '';
      } else {
        img.removeAttribute('src');
        img.alt = a.name;
        img.style.display = 'none';
        // Set parent attribute so CSS can show initials
        const parent = img.parentElement;
        if (parent) {
          parent.setAttribute('data-initials', a.initials || a.name.split(' ').map(n=>n[0]).join(''));
          parent.setAttribute('data-accent', a.accent || '#9bd2ff');
          parent.style.setProperty('--accent', a.accent || '#9bd2ff');
        }
      }
      const parent = img.parentElement;
      if (parent && a.portrait) {
        parent.removeAttribute('data-initials');
        parent.removeAttribute('data-accent');
        parent.style.removeProperty('--accent');
      }
    });

    rosterSub.textContent = `Dev score ${a.devScore} · ${a.delta>=0?'+':''}${a.delta} delta · Satisfaction tone: ${overallTone(a.satisfaction).replace('low','stagnant').replace('mid','developing').replace('high','excellent')}`;
  };

  const updateRadars = (a) => {
    heroRadar.data.datasets = radarDatasets(a);
    heroRadar.update();
    refreshSkillRadar();
  };

  const updateDevSpark = (a) => {
    devSpark.data.datasets[0].data = seriesFor(a);
    devSpark.update();
  };

  const selectAthlete = (id) => {
    const a = B.athletes.find(x => x.id === id);
    if (!a) return;
    selected = a;
    setHeroMeta(a);
    renderProfileCard(a);
    updateRadars(a);
    updateDevSpark(a);
    renderGap(); // gap callout re-runs with new selected
  };

  rosterSelect.addEventListener('change', e => selectAthlete(e.target.value));

  // Initial paint
  setHeroMeta(selected);
  renderProfileCard(selected);

  // ---------- Mobile nav (mirrors app.js) ----------
  const navToggle = document.getElementById('navToggle');
  const navSheet  = document.getElementById('navSheet');
  const tabInner  = document.getElementById('tabInner');

  const setNav = (open) => {
    if (!navSheet || !navToggle) return;
    navSheet.classList.toggle('open', open);
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navSheet.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  navToggle?.addEventListener('click', () => setNav(!navSheet.classList.contains('open')));
  navSheet?.addEventListener('click', (e) => { if (e.target === navSheet) setNav(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  document.querySelectorAll('[data-jump]').forEach(a => {
    a.addEventListener('click', () => setNav(false));
  });

  const sectionIds = ['overview','playerCard','physical','radar','statShare','observations','insights','timeline'];
  const jumpLinks  = Array.from(document.querySelectorAll('[data-jump]'));
  const setActive = (id) => {
    let activeTab = null;
    jumpLinks.forEach(a => {
      const match = a.getAttribute('href') === '#' + id;
      a.classList.toggle('active', match);
      if (match && a.closest('#tabInner')) activeTab = a;
    });
    if (activeTab && tabInner) {
      const tabRect = tabInner.getBoundingClientRect();
      const linkRect = activeTab.getBoundingClientRect();
      const offset = (linkRect.left + linkRect.width / 2) - (tabRect.left + tabRect.width / 2);
      tabInner.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const pickActive = () => {
    const probe = window.innerHeight * 0.35;
    let bestId = null, bestDelta = Infinity;
    sectionIds.forEach(id => {
      const node = document.getElementById(id);
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      if (top - probe <= 0) {
        const delta = Math.abs(top - probe);
        if (delta < bestDelta) { bestDelta = delta; bestId = id; }
      }
    });
    if (!bestId) {
      sectionIds.forEach(id => {
        const node = document.getElementById(id);
        if (!node) return;
        const delta = Math.abs(node.getBoundingClientRect().top - probe);
        if (delta < bestDelta) { bestDelta = delta; bestId = id; }
      });
    }
    if (bestId) setActive(bestId);
  };
  let spyTick = null;
  const onScroll = () => {
    if (spyTick) return;
    spyTick = requestAnimationFrame(() => { spyTick = null; pickActive(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  pickActive();
})();
