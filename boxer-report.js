// Vertex Progress Report — Mateo Reyes
// Charts + dynamic blocks for boxer-progress-report.html.
// Reads from window.BoxerData (same source of truth as the boxer dashboard).

(() => {
  const B = window.BoxerData;
  const mateo = B.athletes.find(a => a.id === 'mateo');

  const $  = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const el = (tag, attrs, ...children) => {
    const n = document.createElement(tag);
    if (attrs) {
      for (const [k,v] of Object.entries(attrs)) {
        if (k === 'class') n.className = v;
        else if (k === 'style') n.setAttribute('style', v);
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (v != null) n.setAttribute(k, v);
      }
    }
    children.flat().forEach(c => {
      if (c == null || c === false) return;
      n.appendChild(c.nodeType ? c : document.createTextNode(c));
    });
    return n;
  };

  // ----- Chart.js global defaults (match dashboard) -----
  if (window.Chart) {
    Chart.defaults.color = '#a9b7cb';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
  }

  // ============================================================
  // PAGE 3 — Dev score sparkline
  // ============================================================
  new Chart($('#devSpark'), {
    type:'line',
    data:{
      labels: B.months,
      datasets:[{
        data: B.devScoreSeries,
        borderColor:'rgba(89,183,255,1)',
        backgroundColor:'rgba(89,183,255,0.12)',
        fill:true, tension:.3, borderWidth:2.2, pointRadius:3,
        pointBackgroundColor:'rgba(154,217,255,1)'
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } },
        y:{ grid:{ color:'rgba(255,255,255,.05)' }, suggestedMin:65, suggestedMax:90, ticks:{ stepSize:5 } }
      }
    }
  });

  // ============================================================
  // PAGE 4 — Growth chart (weight + projection band)
  // ============================================================
  const anthro = B.anthroFor(mateo);
  new Chart($('#growthChart'), {
    type:'line',
    data:{
      labels: anthro.labels,
      datasets:[
        {
          label:'Weight — actual (kg)',
          data: anthro.weightActual,
          borderColor:'rgba(89,183,255,1)',
          backgroundColor:'rgba(89,183,255,0.12)',
          fill:false, tension:.25, borderWidth:2.2, pointRadius:3,
          pointBackgroundColor:'rgba(154,217,255,1)',
          spanGaps:false
        },
        {
          label:'Weight — projected',
          data: anthro.weightProjected,
          borderColor:'rgba(127,140,255,1)', borderDash:[6,5],
          fill:false, tension:.25, borderWidth:2, pointRadius:3,
          pointBackgroundColor:'rgba(127,140,255,1)', spanGaps:false
        },
        {
          label:'Band hi', data:anthro.weightBandHi,
          borderColor:'rgba(127,140,255,0)', backgroundColor:'rgba(127,140,255,0.15)',
          fill:'+1', pointRadius:0, borderWidth:0, tension:.25, spanGaps:false
        },
        {
          label:'Band lo', data:anthro.weightBandLo,
          borderColor:'rgba(127,140,255,0)', backgroundColor:'rgba(127,140,255,0.15)',
          fill:false, pointRadius:0, borderWidth:0, tension:.25, spanGaps:false
        }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ labels:{ filter: it => !it.text.startsWith('Band'), color:'#dce9fb', usePointStyle:true, boxWidth:10, boxHeight:10, padding:12, font:{ weight:'600' } } },
        tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1)+' kg' : '—'}` } }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ font:{ size:10 } } },
        y:{ grid:{ color:'rgba(255,255,255,.06)' }, suggestedMin:42, suggestedMax:55, ticks:{ callback:v=>v+' kg' } }
      }
    }
  });

  // Growth legend
  const gl = $('#growthLegend');
  gl.appendChild(el('span', {},
    el('span', { class:'swatch', style:'background:rgba(89,183,255,1);' }),
    'Actual weight'));
  gl.appendChild(el('span', {},
    el('span', { class:'swatch', style:'background:rgba(127,140,255,1);border-top:2px dashed rgba(127,140,255,1);height:0;' }),
    'Projected trend'));
  gl.appendChild(el('span', {},
    el('span', { class:'swatch', style:'background:rgba(127,140,255,0.3);' }),
    'Projection band'));

  // ============================================================
  // PAGE 5 — Fitness benchmarks grid (same look as dashboard)
  // ============================================================
  const fitGrid = $('#reportFitGrid');
  const tests = B.fitnessFor(mateo);

  // Plain-English explainer per test
  const fitCopy = {
    beep:     'Aerobic endurance. How far can the engine go before the legs argue.',
    vertical: 'Lower-body explosive power. Springs in the legs.',
    broad:    'Whole-body explosive power. Hips driving the floor away.',
    sprint20: 'Short-burst speed off the line. Closing distance fast.',
    sitReach: 'Hip and hamstring flexibility. Lets the rotation finish cleanly.',
    pushup:   'Pushing endurance. Holds shape in the cross under fatigue.',
    plank:    'Core hold. Keeps the trunk stable through long combinations.',
    rhr:      'Resting heart rate. Lower means a more efficient engine.'
  };

  const formatVal = (v, unit) => unit === 's' ? v.toFixed(2) + ' s' : `${v} ${unit}`;

  tests.forEach(t => {
    const canvasId = `rep-fit-${t.key}`;
    const delta = +(t.series[7] - t.series[0]).toFixed(2);
    const direction = t.trend === 'up' ? 'Improving' : t.trend === 'down' ? 'Regressing' : 'Stable';
    const deltaStr = (delta > 0 ? '+' : '') + (Math.abs(delta) < 1 ? delta.toFixed(2) : delta.toFixed(1));

    const card = el('div', { class:'fit-card report-fit-card' },
      el('div', { class:'fit-top' },
        el('strong', {}, t.label),
        el('span', { class:`trend ${t.trend}` }, direction)
      ),
      el('div', { class:'fit-current' },
        el('span', { class:'fit-value' }, formatVal(t.current, t.unit)),
        el('span', { class:'fit-delta' }, `${deltaStr} ${t.unit} · 14-mo`)
      ),
      el('div', { class:'chart-frame fit-spark' }, el('canvas', { id:canvasId })),
      el('div', { class:'fit-copy sub' }, fitCopy[t.key] || '')
    );
    fitGrid.appendChild(card);

    const color = t.trend === 'down' ? 'rgba(255,125,125,1)' : t.trend === 'flat' ? 'rgba(255,191,102,1)' : 'rgba(95,227,156,1)';
    const fill  = t.trend === 'down' ? 'rgba(255,125,125,0.12)' : t.trend === 'flat' ? 'rgba(255,191,102,0.1)' : 'rgba(95,227,156,0.12)';
    new Chart(document.getElementById(canvasId), {
      type:'line',
      data:{ labels:B.fitnessLabels, datasets:[{ data:t.series, borderColor:color, backgroundColor:fill, fill:true, tension:.35, borderWidth:1.5, pointRadius:0 }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ enabled:false } },
        scales:{ x:{ display:false }, y:{ display:false, suggestedMin:Math.min(...t.series)*0.95, suggestedMax:Math.max(...t.series)*1.05, reverse: t.lowerBetter } }
      }
    });
  });

  // ============================================================
  // PAGE 6 — Skill radar (season 1 vs season 2)
  // ============================================================
  new Chart($('#skillRadar'), {
    type:'radar',
    data:{
      labels: B.radarLabels,
      datasets:[
        {
          label:'Season start',
          data: mateo.season1,
          borderColor:'rgba(127,140,255,0.9)',
          backgroundColor:'rgba(127,140,255,0.18)',
          borderWidth:1.8, pointRadius:3, pointBackgroundColor:'rgba(127,140,255,1)'
        },
        {
          label:'Now',
          data: mateo.season2,
          borderColor:'rgba(89,183,255,1)',
          backgroundColor:'rgba(89,183,255,0.22)',
          borderWidth:2, pointRadius:3.5, pointBackgroundColor:'rgba(154,217,255,1)'
        }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ color:'#dce9fb', usePointStyle:true, boxWidth:10, padding:14, font:{ weight:'600' } } } },
      scales:{
        r:{
          suggestedMin:30, suggestedMax:90,
          ticks:{ display:false, stepSize:10 },
          grid:{ color:'rgba(255,255,255,.07)' },
          angleLines:{ color:'rgba(255,255,255,.07)' },
          pointLabels:{ color:'#dce9fb', font:{ size:11, weight:'600' } }
        }
      }
    }
  });

  // ============================================================
  // PAGE 7 — Top 3 attribute movers (largest series[8]-series[0])
  // ============================================================
  const layCopy = {
    jab:           ['Jab discipline',  'How clean the jab is and whether the hand comes home. A jab that returns to guard is a defence as well as an attack.'],
    cross:         ['Cross rotation',  'How well the back hip turns through the cross. Power lives in the rotation, not the arm.'],
    mittAccuracy:  ['Mitt accuracy',   'How often Mateo lands the centre of the pad — particularly late in a combination, when fatigue blurs aim.'],
    slip:          ['Slip & footwork', 'How quickly the head moves off-line and the feet reset for the counter.'],
    guardReturn:   ['Guard return',    'Whether the hands come home after each shot. The single biggest defensive habit at this age.'],
    stamina:       ['Round stamina',   'Output across all four shield rounds — does the work-rate hold from round one to four.'],
    composure:     ['Partner composure','Calm pace with a partner, even when drills drift off-script.'],
    coachability:  ['Coachability',    'How fast a verbal correction shows up in the next rep. The most predictive habit of long-term progress.']
  };

  const movers = B.attributeTrends
    .map(a => ({ ...a, delta: a.series[a.series.length-1] - a.series[0] }))
    .sort((x, y) => y.delta - x.delta)
    .slice(0, 3);

  const growStack = $('#growStack');
  movers.forEach((m, i) => {
    const lay = layCopy[m.key] || [m.label, m.text];
    const trendWord = m.trend === 'up' ? 'Improving' : m.trend === 'down' ? 'Regressing' : 'Stable';
    const canvasId = `grow-spark-${m.key}`;

    const row = el('div', { class:'grow-row' },
      el('div', { class:'grow-rank' }, `#${i+1}`),
      el('div', { class:'grow-body' },
        el('div', { class:'grow-head' },
          el('strong', {}, lay[0]),
          el('span', { class:'grow-delta' }, `+${m.delta} pts`),
          el('span', { class:`trend ${m.trend}` }, trendWord)
        ),
        el('p', { class:'grow-copy' }, lay[1]),
        el('p', { class:'grow-quote' }, '\u201C' + m.text + '\u201D'),
      ),
      el('div', { class:'grow-spark' }, el('canvas', { id:canvasId }))
    );
    growStack.appendChild(row);

    new Chart(document.getElementById(canvasId), {
      type:'line',
      data:{
        labels: m.series.map((_, idx) => idx),
        datasets:[{
          data: m.series,
          borderColor:'rgba(95,227,156,1)',
          backgroundColor:'rgba(95,227,156,0.18)',
          fill:true, tension:.35, borderWidth:1.5, pointRadius:0
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ enabled:false } },
        scales:{ x:{ display:false }, y:{ display:false, suggestedMin:Math.min(...m.series)-4, suggestedMax:Math.max(...m.series)+4 } }
      }
    });
  });

})();
