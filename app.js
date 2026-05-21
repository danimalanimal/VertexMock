// Vertex dashboard rendering & interaction
(() => {
  const D = window.VertexData;

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
    const c = D.coaches[coachId];
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
      const c = D.coaches[id];
      bar.appendChild(el('span', { style:`width:${(w*100).toFixed(0)}%;background:${c.color};` }));
    });
    return bar;
  };

  const consensusBadge = (state) => {
    const label = state === 'aligned' ? 'Coaches aligned' : 'Mixed signals';
    return el('span', { class:`consensus ${state}`, title:label },
      el('span', { class:'dotc' }), label);
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

  // ---------- Radar charts ----------
  const radarDatasets = () => [
    { label:'Season 1', data:D.seasonOne, borderColor:'rgba(127,140,255,0.9)', backgroundColor:'rgba(127,140,255,0.14)', pointBackgroundColor:'rgba(127,140,255,1)', borderWidth:2 },
    { label:'Season 2', data:D.seasonTwo, borderColor:'rgba(89,183,255,1)',  backgroundColor:'rgba(89,183,255,0.18)',  pointBackgroundColor:'rgba(154,217,255,1)', borderWidth:2 },
  ];

  new Chart($('#heroRadarChart'), {
    type:'radar',
    data:{ labels:D.radarLabels, datasets:radarDatasets() },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ r:radarScale } }
  });

  const skillRadar = new Chart($('#skillRadarChart'), {
    type:'radar',
    data:{ labels:D.radarLabels, datasets:radarDatasets() },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#dce9fb', usePointStyle:true, boxWidth:10, boxHeight:10, padding:18, font:{ family:'Inter', size:11, weight:'600' } } } },
      scales:{ r:radarScale }
    }
  });

  // ---------- Dev score sparkline (KPI) ----------
  new Chart($('#devSpark'), {
    type:'line',
    data:{
      labels:D.months,
      datasets:[{
        data:D.devScoreSeries,
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

  // ---------- Anthropometrics chart (Weight / Height / Wingspan) ----------
  // Single Chart.js instance whose datasets are swapped when the user picks a metric.
  const heroAthlete = D.hero;
  const anthroMeta = {
    weight:   { label:'Weight',   unit:'kg', color:'rgba(89,183,255,1)',  fillCol:'rgba(89,183,255,0.12)' },
    height:   { label:'Height',   unit:'cm', color:'rgba(95,227,156,1)',  fillCol:'rgba(95,227,156,0.10)' },
    wingspan: { label:'Wingspan', unit:'cm', color:'rgba(200,155,255,1)', fillCol:'rgba(200,155,255,0.10)' },
  };

  let activeAnthro = 'weight';
  let anthroCache = D.anthroFor(heroAthlete);

  const anthroDatasetsFor = (metric) => {
    const m = anthroMeta[metric];
    const data = anthroCache;
    return [
      {
        label:`${m.label} — actual`,
        data:data[`${metric}Actual`],
        borderColor:m.color, backgroundColor:m.fillCol,
        fill:false, tension:.25, borderWidth:2.2, pointRadius:3,
        pointBackgroundColor:m.color,
        spanGaps:false, yAxisID:'y'
      },
      {
        label:`${m.label} — projected`,
        data:data[`${metric}Projected`],
        borderColor:'rgba(127,140,255,1)', borderDash:[6,5],
        fill:false, tension:.25, borderWidth:2, pointRadius:3,
        pointBackgroundColor:'rgba(127,140,255,1)',
        spanGaps:false, yAxisID:'y'
      },
      {
        label:'Band high', data:data[`${metric}BandHi`],
        borderColor:'rgba(127,140,255,0)', backgroundColor:'rgba(127,140,255,0.15)',
        fill:'+1', pointRadius:0, borderWidth:0, tension:.25, spanGaps:false, yAxisID:'y'
      },
      {
        label:'Band low', data:data[`${metric}BandLo`],
        borderColor:'rgba(127,140,255,0)', backgroundColor:'rgba(127,140,255,0.15)',
        fill:false, pointRadius:0, borderWidth:0, tension:.25, spanGaps:false, yAxisID:'y'
      },
    ];
  };

  const anthroAxisRange = (metric) => {
    const data = anthroCache;
    const all = [
      ...(data[`${metric}Actual`]||[]),
      ...(data[`${metric}Projected`]||[]),
      ...(data[`${metric}BandHi`]||[]),
      ...(data[`${metric}BandLo`]||[]),
    ].filter(v => v != null);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.18 || 1;
    return { min: Math.floor(min - pad), max: Math.ceil(max + pad) };
  };

  const anthroChart = new Chart($('#anthroChart'), {
    type:'line',
    data:{ labels:D.anthroLabels, datasets:anthroDatasetsFor('weight') },
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
              const unit = anthroMeta[activeAnthro].unit;
              return `${ctx.dataset.label}: ${v.toFixed(1)} ${unit}`;
            }
          }
        }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#a9b7cb', font:{ size:10 } } },
        y:{ position:'left', grid:{ color:'rgba(255,255,255,0.06)' },
            ticks:{ color:'#a9b7cb', callback:v => v + ' ' + anthroMeta['weight'].unit },
            ...anthroAxisRange('weight') }
      }
    }
  });

  const renderAnthroLegend = () => {
    const m = anthroMeta[activeAnthro];
    const legend = $('#anthroLegend');
    legend.innerHTML = '';
    legend.appendChild(el('span', {}, el('span', { class:'swatch', style:`background:${m.color};` }), `Actual ${m.label.toLowerCase()}`));
    legend.appendChild(el('span', {},
      el('span', { class:'swatch', style:'background:rgba(127,140,255,1);border-top:2px dashed rgba(127,140,255,1);height:0;' }),
      'Projected trend'));
    legend.appendChild(el('span', {}, el('span', { class:'swatch', style:'background:rgba(127,140,255,0.3);' }), 'Projection band'));
  };
  renderAnthroLegend();

  const switchAnthro = (metric) => {
    activeAnthro = metric;
    const m = anthroMeta[metric];
    anthroChart.data.datasets = anthroDatasetsFor(metric);
    const r = anthroAxisRange(metric);
    anthroChart.options.scales.y.min = r.min;
    anthroChart.options.scales.y.max = r.max;
    anthroChart.options.scales.y.ticks.callback = v => v + ' ' + m.unit;
    anthroChart.update();
    renderAnthroLegend();
    $$('.sub-tab').forEach(b => {
      const on = b.dataset.anthro === metric;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
  };

  $$('.sub-tab').forEach(b => b.addEventListener('click', () => switchAnthro(b.dataset.anthro)));

  // ---------- Physical-panel top-level tabs (Anthro / Fitness) ----------
  const switchPhysSection = (id) => {
    $$('.phys-tab').forEach(b => {
      const on = b.dataset.physSection === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$('.phys-section').forEach(s => {
      const on = s.dataset.physPane === id;
      s.classList.toggle('active', on);
      if (on) s.removeAttribute('hidden'); else s.setAttribute('hidden', '');
    });
    if (id === 'anthro')  { anthroChart.resize(); }
    if (id === 'fitness') { fitnessSparks.forEach(c => c.resize()); }
  };
  $$('.phys-tab').forEach(b => b.addEventListener('click', () => switchPhysSection(b.dataset.physSection)));

  // ---------- Fitness benchmarks grid ----------
  const fitnessGrid = $('#fitnessGrid');
  const fitnessSparks = [];
  const formatVal = (v, unit) => unit === 's' ? v.toFixed(2) + ' s' : `${v} ${unit}`;
  const renderFitness = (a) => {
    fitnessGrid.innerHTML = '';
    fitnessSparks.length = 0;
    const tests = D.fitnessFor(a);
    tests.forEach(t => {
      const canvasId = `fit-${t.key}`;
      const delta = +(t.series[7] - t.series[0]).toFixed(2);
      const direction = t.trend === 'up' ? 'Improving' : t.trend === 'down' ? 'Regressing' : 'Stable';
      const deltaStr = (delta > 0 ? '+' : '') + (Math.abs(delta) < 1 ? delta.toFixed(2) : delta.toFixed(1));

      const card = el('div', { class:'fit-card' },
        el('div', { class:'fit-top' },
          el('strong', {}, t.label),
          el('span', { class:`trend ${t.trend}` }, direction)
        ),
        el('div', { class:'fit-current' },
          el('span', { class:'fit-value' }, formatVal(t.current, t.unit)),
          el('span', { class:'fit-delta' }, `${deltaStr} ${t.unit} 14-mo`)
        ),
        el('div', { class:'chart-frame fit-spark' }, el('canvas', { id:canvasId })),
        el('div', { class:'fit-foot sub' },
          t.lowerBetter ? 'Lower is better' : 'Higher is better'
        )
      );
      fitnessGrid.appendChild(card);

      const color = t.trend === 'down' ? 'rgba(255,125,125,1)' : t.trend === 'flat' ? 'rgba(255,191,102,1)' : 'rgba(95,227,156,1)';
      const fill  = t.trend === 'down' ? 'rgba(255,125,125,0.12)' : t.trend === 'flat' ? 'rgba(255,191,102,0.1)' : 'rgba(95,227,156,0.12)';
      const c = new Chart(document.getElementById(canvasId), {
        type:'line',
        data:{ labels:D.fitnessLabels, datasets:[{ data:t.series, borderColor:color, backgroundColor:fill, fill:true, tension:.35, borderWidth:1.5, pointRadius:0 }] },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: ctx => `${D.fitnessLabels[ctx.dataIndex]}: ${formatVal(ctx.parsed.y, t.unit)}` } } },
          scales:{ x:{ display:false }, y:{ display:false, suggestedMin:Math.min(...t.series)*0.95, suggestedMax:Math.max(...t.series)*1.05, reverse: t.lowerBetter } }
        }
      });
      fitnessSparks.push(c);
    });
  };
  renderFitness(heroAthlete);

  // ---------- Anthro KPI tiles ----------
  const updateAnthroKpis = (a) => {
    const data = D.anthroFor(a);
    const last = arr => { for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] != null) return arr[i]; } return null; };
    const projEnd = (key) => last(data[`${key}Projected`]);
    const gain = (key, current) => {
      const end = projEnd(key);
      if (end == null) return '—';
      const d = +(end - current).toFixed(1);
      return (d>=0?'+':'') + d;
    };
    $('#anthroAge').textContent = a.age + ' yrs';
    $('#anthroAgeSub').textContent = a.level + ' · ' + a.position;
    $('#anthroWeight').textContent = a.weight.toFixed(1) + ' kg';
    $('#anthroWeightSub').textContent = `Projected ${gain('weight', a.weight)} kg by May 27`;
    $('#anthroHeight').textContent = a.height.toFixed(1) + ' cm';
    $('#anthroHeightSub').textContent = `Projected ${gain('height', a.height)} cm by May 27`;
    $('#anthroWingspan').textContent = a.wingspan.toFixed(1) + ' cm';
    const ratio = (a.wingspan / a.height).toFixed(2);
    $('#anthroWingspanSub').textContent = `Ratio ${ratio} · projected ${gain('wingspan', a.wingspan)} cm`;
  };
  updateAnthroKpis(heroAthlete);

  // ---------- Attribute sparklines + cards ----------
  const obsGrid = $('#observationsGrid');
  obsGrid.innerHTML = '';
  D.attributeTrends.forEach((a, i) => {
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
      data:{ labels:D.months, datasets:[{ data:a.series, borderColor:color, backgroundColor:fill, fill:true, tension:.35, borderWidth:1.5, pointRadius:0 }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ enabled:false } },
        scales:{ x:{ display:false }, y:{ display:false, suggestedMin:Math.min(...a.series)-5, suggestedMax:Math.max(...a.series)+5 } }
      }
    });
  });

  // ---------- Vertex Stat Share (mutual-consent peer comparison) ----------
  const shareListEl = $('#shareList');
  const gapCallout  = $('#gapCallout');
  const activeShare = new Set();

  const consentMeta = {
    consent: { label:'Mutual share',  cls:'consent-ok',      action:'Compare' },
    pending: { label:'Pending',       cls:'consent-pending', action:'Resend invite' },
    none:    { label:'Not connected', cls:'consent-none',    action:'Send invite' },
  };

  const renderStatShare = () => {
    shareListEl.innerHTML = '';
    D.statShare.forEach(p => {
      const meta = consentMeta[p.consent];
      const canCompare = p.consent === 'consent';
      const active = activeShare.has(p.id);
      const row = el('div', { class:`share-row${active?' active':''}${canCompare?'':' locked'}`, 'data-id':p.id,
          title: canCompare ? 'Tap to overlay on radar' : 'Stats locked — mutual consent required',
          onclick: () => { if (canCompare) togglePeer(p.id); } },
        el('div', { class:'share-avatar' }, p.name.split(' ').map(n=>n[0]).join('')),
        el('div', { class:'share-info' },
          el('span', { class:'share-name' }, p.name),
          el('span', { class:'share-pos' }, `${p.pos} · ${p.team}`),
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
    // Mock: in production this would call the Vertex Stat Share API.
    if (p.consent === 'none')    { p.consent = 'pending'; toast(`Invite sent to ${p.name}.`); }
    else if (p.consent === 'pending') { toast(`Reminder sent to ${p.name}. Awaiting their consent.`); }
    renderStatShare();
  };

  const shareMyStatsFlow = () => {
    const dlg = $('#shareDialog');
    if (dlg) dlg.showModal();
  };
  $('#shareStatsBtn')?.addEventListener('click', shareMyStatsFlow);
  $('#shareDialogClose')?.addEventListener('click', () => $('#shareDialog').close());
  $('#shareDialogSend')?.addEventListener('click', () => {
    const handle = $('#shareHandle').value.trim();
    $('#shareDialog').close();
    if (handle) toast(`Stat-share invite sent to ${handle}. They must accept before stats are shared.`);
  });

  // Lightweight toast
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
    const base = radarDatasets();
    D.statShare.filter(p => activeShare.has(p.id) && p.consent === 'consent').forEach((p, idx) => {
      const palette = ['rgba(95,227,156,1)','rgba(255,191,102,1)','rgba(200,155,255,1)','rgba(255,125,125,1)'];
      const color = palette[idx % palette.length];
      base.push({
        label:`${p.name} · S2`,
        data:p.season2,
        borderColor:color,
        backgroundColor:color.replace('1)','0.12)'),
        pointBackgroundColor:color,
        borderWidth:2, borderDash:[4,4]
      });
    });
    skillRadar.data.datasets = base;
    skillRadar.update();
    renderStatShare();
  };

  const renderGap = () => {
    const active = D.statShare.filter(p => activeShare.has(p.id) && p.consent === 'consent');
    if (!active.length) {
      gapCallout.textContent = 'Stats from Vertex friends only appear with mutual consent. Select a connected friend to overlay on the radar.';
      return;
    }
    const medians = D.radarLabels.map((_, i) => {
      const vals = active.map(p => p.season2[i]).sort((a,b)=>a-b);
      const mid = Math.floor(vals.length/2);
      return vals.length % 2 ? vals[mid] : Math.round((vals[mid-1]+vals[mid])/2);
    });
    const gaps = D.radarLabels.map((label, i) => ({ label, diff: D.seasonTwo[i] - medians[i] }))
      .sort((a,b) => a.diff - b.diff);
    const worst = gaps[0];
    if (worst.diff >= 0) {
      gapCallout.textContent = `Ava is at or above the shared median on every attribute. Closest gap: ${worst.label} (${worst.diff>=0?'+':''}${worst.diff}).`;
    } else {
      gapCallout.innerHTML = `Largest gap vs shared median: <strong style="color:#ffe6c2">${worst.label} ${worst.diff}</strong>. Use this as a focus prompt, not a ranking.`;
    }
  };
  renderStatShare();

  // ---------- Players to Watch (NBA pros) ----------
  const attrLabelMap = {
    decision:'Decision-making', defence:'Defensive awareness', shooting:'Shooting',
    communication:'Communication', iq:'Game IQ', effort:'Effort', coachability:'Coachability',
    handle:'Ball handling',
  };
  const nbaGrid = $('#nbaWatchGrid');
  if (nbaGrid) {
    D.nbaWatch.forEach(p => {
      const card = el('article', { class:'nba-card' },
        el('div', { class:'nba-head' },
          el('div', { class:'nba-avatar' }, p.name.split(' ').map(n=>n[0]).join('')),
          el('div', { class:'nba-id' },
            el('h3', {}, p.name),
            el('span', { class:'nba-meta' }, `${p.pos} · ${p.era}`),
            el('span', { class:'nba-teams' }, p.teams)
          )
        ),
        el('p', { class:'nba-headline' }, p.headline),
        el('div', { class:'nba-focus' },
          ...p.studyFocus.map(f => el('span', { class:'focus-tag' }, f))
        ),
        el('div', { class:'nba-section' },
          el('h4', {}, 'Why study them'),
          el('ul', {}, ...p.reasons.map(r => el('li', {}, r)))
        ),
        el('div', { class:'nba-section' },
          el('h4', {}, 'Film cues to watch'),
          el('div', { class:'cue-row' }, ...p.filmCues.map(c => el('span', { class:'cue-tag' }, c)))
        ),
        el('div', { class:'nba-section addresses' },
          el('span', { class:'addresses-label' }, 'Addresses growth areas:'),
          ...p.addresses.map(k => el('span', { class:'address-pill' }, attrLabelMap[k] || k))
        ),
        el('a', { class:'nba-cta', href:p.highlight, target:'_blank', rel:'noopener' }, 'Search film →')
      );
      nbaGrid.appendChild(card);
    });
  }

  // ---------- Timeline ----------
  const fillTimeline = (containerId, items) => {
    const c = $(containerId);
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
  fillTimeline('#timelineS1', D.timeline.s1);
  fillTimeline('#timelineS2', D.timeline.s2);
  fillTimeline('#timelineTurning', D.timeline.turning);

  // ---------- Strengths / growth / focus ----------
  const fillList = (containerId, items) => {
    const ul = $(containerId);
    items.forEach(item => {
      ul.appendChild(el('li', {},
        document.createTextNode(item.text),
        attribution(item.coaches || [])
      ));
    });
  };
  fillList('#listStrengths', D.lists.strengths);
  fillList('#listGrowth',    D.lists.growth);
  fillList('#listFocus',     D.lists.focus);

  // ---------- Observation feed (filterable) ----------
  const feedEl = $('#feed');
  D.feed.forEach(f => {
    const c = D.coaches[f.coach];
    feedEl.appendChild(el('div', { class:'feed-item', 'data-coach':f.coach },
      el('div', { class:'feed-meta' },
        el('span', { class:'tag' }, f.date),
        coachChip(f.coach),
        el('span', { class:'tag' }, f.kind),
        el('span', { class:'tag' }, f.topic)
      ),
      el('p', {}, f.text)
    ));
  });

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
    Object.values(D.coaches).forEach(c => filterBar.appendChild(mk(c.id, c.name)));
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
  const thead = el('tr', {}, el('th', {}, ''), ...D.heatMonths.map(m => el('th', {}, m)));
  heatTable.appendChild(thead);
  D.heatCategories.forEach((cat, i) => {
    const row = el('tr', {}, el('td', { class:'label' }, cat));
    D.heatValues[i].forEach(v => row.appendChild(el('td', { 'data-v':String(cap(v)), title:`${v} observation${v===1?'':'s'}` }, v ? String(v) : '')));
    heatTable.appendChild(row);
  });

  // ---------- Mobile nav: hamburger + sheet + scroll-spy tab bar ----------
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

  // Close nav on jump link click; smooth-scroll handled by CSS scroll-behavior
  document.querySelectorAll('[data-jump]').forEach(a => {
    a.addEventListener('click', () => setNav(false));
  });

  // Scroll-spy across all sections
  const sectionIds = ['overview','playerCard','physical','radar','statShare','nbaWatch','observations','insights','timeline'];
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

  // Pick the section whose top is closest to (but not past) a fixed offset from the viewport top
  const pickActive = () => {
    const probe = window.innerHeight * 0.35;
    let bestId = null, bestDelta = Infinity;
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // candidates whose top is at or above the probe line
      if (top - probe <= 0) {
        const delta = Math.abs(top - probe);
        if (delta < bestDelta) { bestDelta = delta; bestId = id; }
      }
    });
    // fallback: nearest section if none above probe
    if (!bestId) {
      sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const delta = Math.abs(el.getBoundingClientRect().top - probe);
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
