// Vertex Boxing Workshop — Coach Input.
// Mirrors coach.js structure (player + attribute + sentiment + phrase => entry)
// with workshop-specific additions:
//   * 5 attribute blocks (fundamentals / mitts / noodle / shields / partner)
//   * Per-attribute satisfaction slider: orange (stagnant) -> blue -> green (excellent)
//   * Each logged entry stores a satisfaction snapshot for that (player, attribute)
//   * Unified feed: entries are pushed to VertexData.feed tagged discipline:'boxing'
//   * Strict slot search: results restricted to picked attribute+sentiment

(function () {
  const D = window.VertexBoxingData;
  const STORE_KEY  = 'vertex.boxing.entries.v1';
  const FREQ_KEY   = 'vertex.boxing.freq.v1';
  const CUSTOM_KEY = 'vertex.boxing.custom.v1';
  const SAT_KEY    = 'vertex.boxing.satisfaction.v1'; // { 'playerId|attribute': 0..100 }

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (t, a = {}, ...c) => {
    const n = document.createElement(t);
    for (const k in a) {
      if (k === 'class') n.className = a[k];
      else if (k === 'html') n.innerHTML = a[k];
      else if (k === 'on') for (const ev in a.on) n.addEventListener(ev, a.on[ev]);
      else if (a[k] === true) n.setAttribute(k, '');
      else if (a[k] === false || a[k] == null) {}
      else n.setAttribute(k, a[k]);
    }
    c.flat().forEach(x => n.append(x?.nodeType ? x : document.createTextNode(x ?? '')));
    return n;
  };

  // ---------- Persistence ----------
  const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const state = {
    sessionOn: false,
    sessionCoach: 'kade',
    sessionKind: 'Workshop',
    bulk: false,
    players: [],
    attribute: null,
    sentiment: null,
    query: '',
    entries: load(STORE_KEY, []),
    freq: load(FREQ_KEY, {}),
    customs: load(CUSTOM_KEY, {}),
    satisfaction: load(SAT_KEY, {}),  // { 'playerId|attr': 0..100 }
  };

  // ---------- Helpers ----------
  const today = () => new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
  const slotKey = () => `${state.attribute}|${state.sentiment}`;

  // Satisfaction helpers. Default 50 (mid). The active player drives the
  // slider value — in bulk mode we use the first selected athlete as the
  // reference for display, but write the same value to all selected athletes
  // when the coach drags.
  const refPlayer = () => state.players[0] || null;
  const satKey = (pid, attr) => `${pid}|${attr}`;
  const getSat = (pid, attr) => {
    if (!pid || !attr) return 50;
    const v = state.satisfaction[satKey(pid, attr)];
    return (typeof v === 'number') ? v : 50;
  };
  const setSat = (attr, value) => {
    if (!attr || state.players.length === 0) return;
    const v = Math.max(0, Math.min(100, Math.round(value)));
    state.players.forEach(pid => { state.satisfaction[satKey(pid, attr)] = v; });
    save(SAT_KEY, state.satisfaction);
  };

  // ---------- Render: session toggle ----------
  const sessToggle = $('#sessionToggle');
  const sessLabel  = sessToggle.querySelector('.cs-label');
  const sessMeta   = $('#sessionMeta');
  const coachSel   = $('#sessionCoach');
  const kindSel    = $('#sessionKind');
  D.coaches.forEach(c => coachSel.append(el('option', { value: c.id }, c.name)));
  D.sessionKinds.forEach(k => kindSel.append(el('option', { value: k }, k)));
  coachSel.value = state.sessionCoach;
  kindSel.value  = state.sessionKind;

  const renderSession = () => {
    sessToggle.setAttribute('aria-pressed', String(state.sessionOn));
    sessToggle.classList.toggle('on', state.sessionOn);
    sessLabel.textContent = state.sessionOn
      ? `Session \u2022 ${D.coaches.find(c => c.id === state.sessionCoach).name} \u2022 ${state.sessionKind}`
      : 'Free-fire';
    sessMeta.hidden = !state.sessionOn;
  };
  sessToggle.addEventListener('click', () => { state.sessionOn = !state.sessionOn; renderSession(); });
  coachSel.addEventListener('change', () => { state.sessionCoach = coachSel.value; renderSession(); });
  kindSel.addEventListener('change',  () => { state.sessionKind  = kindSel.value;  renderSession(); });
  renderSession();

  // ---------- Render: bulk toggle ----------
  const bulkBtn = $('#bulkToggle');
  const renderBulk = () => {
    bulkBtn.classList.toggle('on', state.bulk);
    bulkBtn.setAttribute('aria-pressed', String(state.bulk));
    document.body.classList.toggle('bulk-mode', state.bulk);
    if (!state.bulk && state.players.length > 1) state.players = state.players.slice(0, 1);
    renderRoster();
    renderAttrs();
  };
  bulkBtn.addEventListener('click', () => { state.bulk = !state.bulk; renderBulk(); });

  // ---------- Render: athlete rail ----------
  const rail = $('#playerRail');
  const clearPlayersBtn = $('#clearPlayers');
  const renderRoster = () => {
    rail.innerHTML = '';
    D.squad.forEach(p => {
      const selected = state.players.includes(p.id);
      const chip = el('button', {
        class: 'pchip' + (selected ? ' on' : ''),
        type: 'button',
        role: 'option',
        'aria-selected': String(selected),
        'data-id': p.id,
        title: `${p.name} \u2022 ${p.level}`,
      },
        el('span', { class:'pa', style:`background:${p.accent};color:#0c1422` }, p.initials),
        el('span', { class:'pn' }, p.name.split(' ')[0]),
        el('span', { class:'pp' }, p.level),
      );
      chip.addEventListener('click', () => selectPlayer(p.id));
      rail.append(chip);
    });
    clearPlayersBtn.hidden = state.players.length === 0;
    updateReady();
  };
  const selectPlayer = (id) => {
    if (state.bulk) {
      const i = state.players.indexOf(id);
      if (i >= 0) state.players.splice(i, 1); else state.players.push(id);
    } else {
      state.players = (state.players[0] === id) ? [] : [id];
    }
    renderRoster();
    renderAttrs();           // sliders reflect picked athlete's stored satisfaction
  };
  clearPlayersBtn.addEventListener('click', () => { state.players = []; renderRoster(); renderAttrs(); });

  // ---------- Render: attribute grid (with per-tile satisfaction slider) ----------
  const attrGrid = $('#attrGrid');
  const sliderHint = $('#sliderHint');
  const todayCount = (key) => state.entries.filter(e => e.attribute === key && e.date === today()).length;

  const satLabel = (v) => v <= 33 ? 'Stagnant' : v <= 66 ? 'Developing' : 'Excellent';
  const satTone = (v) => v <= 33 ? 'low' : v <= 66 ? 'mid' : 'high';

  const renderAttrs = () => {
    attrGrid.innerHTML = '';
    const ref = refPlayer();
    sliderHint.hidden = !ref;

    D.attributes.forEach(a => {
      const on = state.attribute === a.key;
      const satVal = ref ? getSat(ref, a.key) : 50;
      const sLabel = satLabel(satVal);
      const sTone  = satTone(satVal);

      // Each attribute cell stacks the tappable tile above its satisfaction slider.
      const cell = el('div', { class:'bx-cell' + (on ? ' on' : '') });

      const tile = el('button', {
        class: 'atile bx-atile' + (on ? ' on' : ''),
        type: 'button',
        role: 'radio',
        'aria-checked': String(on),
        'data-key': a.key,
      },
        el('span', { class:'ag' }, a.glyph),
        el('span', { class:'al' }, a.label),
        el('span', { class:'ac' }, String(todayCount(a.key))),
      );
      tile.addEventListener('click', () => {
        state.attribute = a.key;
        renderAttrs();
        renderPhrases();
        updateReady();
      });
      cell.append(tile);

      // Slider lives *below* the tile inside the same grid cell wrapper so it
      // doesn't interfere with the tile's button hit area. Disabled if no
      // athlete picked yet.
      const slider = el('div', {
        class: 'bx-slider' + (ref ? '' : ' disabled') + ' tone-' + sTone,
        'data-attr': a.key,
      });
      const track = el('div', { class:'bx-slider-track' });
      const fill = el('div', { class:'bx-slider-fill', style:`width:${satVal}%` });
      const thumb = el('div', { class:'bx-slider-thumb', style:`left:${satVal}%`,
        role:'slider', 'aria-label':`${a.label} satisfaction`,
        'aria-valuemin':'0', 'aria-valuemax':'100', 'aria-valuenow':String(satVal),
        tabindex: ref ? '0' : '-1',
      });
      const badge = el('span', { class:'bx-slider-badge' },
        el('span', { class:'bx-slider-val' }, String(satVal)),
        el('span', { class:'bx-slider-lbl' }, sLabel),
      );
      const input = el('input', {
        class:'bx-slider-input',
        type:'range', min:'0', max:'100', step:'1', value:String(satVal),
        'aria-label':`${a.label} satisfaction`,
        'data-attr': a.key,
      });
      if (!ref) input.disabled = true;
      track.append(fill, thumb);
      slider.append(track, badge, input);
      // Stop slider taps from bubbling up and triggering the tile click
      slider.addEventListener('click', (e) => e.stopPropagation());

      // Live update as the coach drags. Persists to localStorage on `change`
      // to avoid flooding writes during drag.
      input.addEventListener('input', () => {
        const v = Number(input.value);
        fill.style.width = v + '%';
        thumb.style.left = v + '%';
        thumb.setAttribute('aria-valuenow', String(v));
        badge.querySelector('.bx-slider-val').textContent = String(v);
        badge.querySelector('.bx-slider-lbl').textContent = satLabel(v);
        slider.classList.remove('tone-low','tone-mid','tone-high');
        slider.classList.add('tone-' + satTone(v));
      });
      input.addEventListener('change', () => {
        const v = Number(input.value);
        setSat(a.key, v);
        toast(`${a.label}: ${v} \u2022 ${satLabel(v)}`, 'ok');
      });

      cell.append(slider);
      attrGrid.append(cell);
    });
  };

  // ---------- Render: sentiment ----------
  const sentBtns = $$('.cs-btn');
  sentBtns.forEach(b => b.addEventListener('click', () => {
    state.sentiment = b.getAttribute('data-sent');
    sentBtns.forEach(x => {
      const on = x === b;
      x.classList.toggle('on', on);
      x.setAttribute('aria-checked', String(on));
    });
    renderPhrases();
    updateReady();
  }));

  // ---------- Search engine ----------
  const scorePhrase = (phrase, qTokens) => {
    if (qTokens.length === 0) return 0;
    const p = phrase.toLowerCase();
    let score = 0;
    for (const t of qTokens) {
      const wb = new RegExp('(^|[\\s\\-/\'"(\u2019])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (wb.test(p)) { score += 100 + Math.min(20, t.length * 2); continue; }
      if (p.startsWith(t)) { score += 40 + Math.min(20, t.length * 2); continue; }
      if (p.includes(t)) { score += 30 + Math.min(15, t.length); continue; }
      return 0; // every token must match somewhere
    }
    return score;
  };

  // Word-boundary safe highlight returning DOM fragment
  const highlightMatches = (text, qTokens) => {
    if (qTokens.length === 0) return document.createTextNode(text);
    const frag = document.createDocumentFragment();
    const lower = text.toLowerCase();
    // Build sorted match ranges
    const ranges = [];
    qTokens.forEach(t => {
      let idx = 0;
      while ((idx = lower.indexOf(t, idx)) !== -1) {
        ranges.push([idx, idx + t.length]);
        idx += t.length;
      }
    });
    if (ranges.length === 0) return document.createTextNode(text);
    ranges.sort((a, b) => a[0] - b[0]);
    // Merge overlapping
    const merged = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
      else merged.push(ranges[i]);
    }
    let cursor = 0;
    for (const [s, e] of merged) {
      if (s > cursor) frag.append(document.createTextNode(text.slice(cursor, s)));
      const m = document.createElement('mark');
      m.textContent = text.slice(s, e);
      frag.append(m);
      cursor = e;
    }
    if (cursor < text.length) frag.append(document.createTextNode(text.slice(cursor)));
    return frag;
  };

  const buildPhraseList = () => {
    const q = state.query.trim();
    const qTokens = q ? q.toLowerCase().split(/\s+/) : [];
    const slotPicked = !!(state.attribute && state.sentiment);

    if (qTokens.length === 0) {
      if (!slotPicked) return { mode:'empty', items:[], qTokens };
      const customs = state.customs[slotKey()] || [];
      const seed = (D.phrases[state.attribute]?.[state.sentiment]) || [];
      const items = [...customs, ...seed].map((p, i) => ({
        phrase: p,
        attribute: state.attribute,
        sentiment: state.sentiment,
        isCustom: customs.includes(p),
        count: state.freq[`${state.attribute}|${state.sentiment}|${p}`] || 0,
        score: 0,
      }));
      items.sort((a, b) => b.count - a.count);
      return { mode:'slot', items, qTokens };
    }

    const customsEntries = [];
    Object.keys(state.customs || {}).forEach(k => {
      const [a, s] = k.split('|');
      (state.customs[k] || []).forEach(p => customsEntries.push({ phrase: p, attribute: a, sentiment: s, isCustom: true }));
    });
    let pool = customsEntries.concat(D.allPhrases.map(p => ({ ...p, isCustom: false })));

    // Strict slot filter: restrict pool by what the coach has picked.
    if (state.attribute) pool = pool.filter(p => p.attribute === state.attribute);
    if (state.sentiment) pool = pool.filter(p => p.sentiment === state.sentiment);

    const scored = [];
    for (const it of pool) {
      const sc = scorePhrase(it.phrase, qTokens);
      if (sc <= 0) continue;
      const fKey = `${it.attribute}|${it.sentiment}|${it.phrase}`;
      const freq = state.freq[fKey] || 0;
      const customBoost = it.isCustom ? 20 : 0;
      scored.push({ ...it, count: freq, score: sc + customBoost + Math.min(15, freq) });
    }
    scored.sort((a, b) => b.score - a.score);

    let mode;
    if (slotPicked) mode = 'searchSlot';
    else if (state.attribute || state.sentiment) mode = 'searchScoped';
    else mode = 'searchAll';
    return { mode, items: scored.slice(0, 40), qTokens };
  };

  // ---------- Render: phrase deck ----------
  const phraseGrid = $('#phraseGrid');
  const phraseStatus = $('#phraseStatus');
  let topMatch = null;

  const addCustomTile = () => {
    const q = state.query.trim();
    const label = q
      ? `+ Save \u201c${q.length > 28 ? q.slice(0, 26) + '\u2026' : q}\u201d as phrase`
      : '+ Custom phrase';
    const addTile = el('button', { class:'ptile add', type:'button' },
      el('span', { class:'pt-text' }, label));
    addTile.addEventListener('click', openCustom);
    phraseGrid.append(addTile);
  };

  const renderPhrases = () => {
    phraseGrid.innerHTML = '';
    topMatch = null;
    const built = buildPhraseList();
    const { mode, items, qTokens } = built;
    const slotPicked = state.attribute && state.sentiment;

    if (mode === 'empty') {
      phraseStatus.textContent = 'Pick attribute & sentiment — or type to search';
      phraseStatus.dataset.tone = 'wait';
    } else if (mode === 'slot') {
      const sentName = state.sentiment === '+' ? 'commend' : state.sentiment === '-' ? 'critique' : 'note';
      const attrLabel = D.attributes.find(a => a.key === state.attribute).label;
      phraseStatus.textContent = `${attrLabel} \u2022 ${sentName} \u2022 ${items.length}`;
      phraseStatus.dataset.tone = state.sentiment === '+' ? 'pos' : state.sentiment === '-' ? 'neg' : 'neu';
    } else {
      let scope;
      if (mode === 'searchAll') scope = 'all library';
      else if (mode === 'searchScoped') {
        if (state.attribute) {
          const attrLabel = D.attributes.find(a => a.key === state.attribute).label;
          scope = `${attrLabel.toLowerCase()} only`;
        } else {
          const sentName = state.sentiment === '+' ? 'commend' : state.sentiment === '-' ? 'critique' : 'note';
          scope = `${sentName} only`;
        }
      } else {
        scope = 'this slot only';
      }
      phraseStatus.textContent = `${items.length} match${items.length === 1 ? '' : 'es'} \u2022 ${scope}`;
      phraseStatus.dataset.tone = 'neu';
    }

    phraseGrid.classList.toggle('searching', qTokens.length > 0);

    if (mode === 'empty') {
      phraseGrid.append(el('div', { class:'cp-empty' },
        'Pick attribute and sentiment to load phrases — or just start typing.'));
      addCustomTile();
      return;
    }
    if (items.length === 0) {
      phraseGrid.append(el('div', { class:'cp-empty' },
        `No matches for \u201c${state.query}\u201d. Tap \u201c+ Save\u201d to add it.`));
      addCustomTile();
      return;
    }

    items.forEach((it, idx) => {
      const sentCls = it.sentiment === '+' ? 'pos' : it.sentiment === '-' ? 'neg' : 'neu';
      const crossSlot = qTokens.length > 0 && (!slotPicked || it.attribute !== state.attribute || it.sentiment !== state.sentiment);

      const textSpan = el('span', { class:'pt-text' });
      if (crossSlot) {
        const attrLabel = D.attributes.find(a => a.key === it.attribute).label;
        const sentLabel = D.sentimentLabels[it.sentiment];
        textSpan.append(el('span', { class:'pt-context ' + sentCls }, `${attrLabel} \u2022 ${sentLabel}`));
        textSpan.append(' ');
      }
      const body = qTokens.length > 0 ? highlightMatches(it.phrase, qTokens) : document.createTextNode(it.phrase);
      textSpan.append(body);

      const isTop = qTokens.length > 0 && idx === 0;
      const tile = el('button', {
        class: 'ptile sent-' + sentCls + (it.isCustom ? ' custom' : '')
                + (crossSlot ? ' cross-slot' : '')
                + (isTop ? ' top-match' : ''),
        type: 'button',
      },
        textSpan,
        it.count > 0 ? el('span', { class:'pt-freq', title:`Used ${it.count}\u00d7` }, `\u00d7${it.count}`) : '',
        it.isCustom ? el('span', { class:'pt-tag' }, 'custom') : '',
      );
      tile.addEventListener('click', () => logEntry(it.phrase, { attribute: it.attribute, sentiment: it.sentiment }));
      if (isTop) topMatch = { phrase: it.phrase, attribute: it.attribute, sentiment: it.sentiment };
      phraseGrid.append(tile);
    });

    addCustomTile();
  };

  // ---------- Ready/Disabled state ----------
  const updateReady = () => {
    const ready = state.players.length > 0 && state.attribute && state.sentiment;
    phraseGrid.classList.toggle('disabled', !ready);
  };

  // ---------- Log entry ----------
  const logEntry = (phrase, override) => {
    if (state.players.length === 0) { toast('Pick an athlete first', 'warn'); return; }
    const useAttribute = override?.attribute || state.attribute;
    const useSentiment = override?.sentiment || state.sentiment;
    if (!useAttribute || !useSentiment) { toast('Pick attribute & sentiment first', 'warn'); return; }

    const attr = D.attributes.find(a => a.key === useAttribute);
    const batchId = 'b' + Date.now() + Math.random().toString(36).slice(2, 6);
    const newOnes = state.players.map(pid => {
      const player = D.squad.find(p => p.id === pid);
      return {
        id: 'e' + Date.now() + Math.random().toString(36).slice(2, 8),
        batchId,
        discipline: 'boxing',
        date: today(),
        time: new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' }),
        playerId: pid,
        playerName: player.name,
        attribute: useAttribute,
        attributeLabel: attr.label,
        sentiment: useSentiment,
        phrase,
        satisfaction: getSat(pid, useAttribute),  // snapshot at log time
        coach:  state.sessionOn ? state.sessionCoach : 'kade',
        kind:   state.sessionOn ? state.sessionKind  : 'Workshop',
        session: state.sessionOn,
      };
    });
    const fKey = `${useAttribute}|${useSentiment}|${phrase}`;
    state.freq[fKey] = (state.freq[fKey] || 0) + 1;
    save(FREQ_KEY, state.freq);
    state.entries.unshift(...newOnes);
    save(STORE_KEY, state.entries);
    pushToFeed(newOnes);
    renderTally();
    pulsePhraseSaved(phrase);
    toast(state.players.length > 1
      ? `Logged ${newOnes.length} entries`
      : `Logged \u2014 ${player1Name(newOnes[0])}`, 'ok');
    if (state.query) setQuery('');
    else { renderPhrases(); renderAttrs(); }
  };
  const player1Name = (entry) => entry.playerName.split(' ')[0];

  // Push to unified VertexData.feed tagged as boxing.
  const pushToFeed = (entries) => {
    if (!window.VertexData) return;
    entries.forEach(e => {
      window.VertexData.feed.unshift({
        discipline: 'boxing',
        date:  e.date,
        coach: e.coach,
        kind:  e.kind,
        topic: D.attributes.find(a => a.key === e.attribute).topic,
        text:  e.phrase,
        sentiment: e.sentiment,
        satisfaction: e.satisfaction,
        source: 'boxing-input',
        playerId: e.playerId,
      });
    });
  };

  // ---------- Render: tally strip ----------
  const tallyList = $('#tallyList');
  const tallyCount = $('#tallyCount');
  const renderTally = () => {
    tallyList.innerHTML = '';
    const recent = state.entries.slice(0, 20);
    tallyCount.textContent = state.entries.length;
    if (recent.length === 0) {
      tallyList.append(el('li', { class:'ct-empty' }, 'No entries yet. Pick athlete \u2192 attribute \u2192 sentiment \u2192 phrase.'));
      return;
    }
    let lastBatch = null;
    recent.forEach(e => {
      const player = D.squad.find(p => p.id === e.playerId);
      const sentCls = e.sentiment === '+' ? 'pos' : e.sentiment === '-' ? 'neg' : 'neu';
      const item = el('li', { class:'ct-item sent-' + sentCls, 'data-id': e.id, 'data-batch': e.batchId },
        el('span', { class:'ct-pa', style:`background:${player.accent};color:#0c1422` }, player.initials),
        el('div', { class:'ct-body' },
          el('div', { class:'ct-meta' },
            el('span', { class:'ct-name' }, player.name.split(' ')[0]),
            el('span', { class:'ct-attr' }, e.attributeLabel),
            el('span', { class:'ct-sent' }, e.sentiment),
            typeof e.satisfaction === 'number'
              ? el('span', { class:'ct-sat tone-' + (e.satisfaction <= 33 ? 'low' : e.satisfaction <= 66 ? 'mid' : 'high'), title:'Satisfaction at time of entry' }, `s${e.satisfaction}`)
              : '',
            el('span', { class:'ct-time' }, e.time),
          ),
          el('div', { class:'ct-text' }, e.phrase),
        ),
        el('button', { class:'ct-del', type:'button', title:'Remove entry', 'data-del': e.id, html:'&times;' }),
      );
      if (lastBatch && lastBatch === e.batchId) item.classList.add('batch-continued');
      lastBatch = e.batchId;
      tallyList.append(item);
    });
  };
  tallyList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-del]');
    if (!btn) return;
    const id = btn.getAttribute('data-del');
    const i = state.entries.findIndex(e => e.id === id);
    if (i >= 0) {
      state.entries.splice(i, 1);
      save(STORE_KEY, state.entries);
      renderTally();
      renderAttrs();
    }
  });

  // ---------- Undo last batch ----------
  $('#undoBtn').addEventListener('click', () => {
    if (state.entries.length === 0) { toast('Nothing to undo', 'warn'); return; }
    const lastBatch = state.entries[0].batchId;
    const removed = [];
    while (state.entries.length && state.entries[0].batchId === lastBatch) removed.push(state.entries.shift());
    save(STORE_KEY, state.entries);
    renderTally();
    renderAttrs();
    toast(`Undone \u2014 ${removed.length} entr${removed.length === 1 ? 'y' : 'ies'}`, 'ok');
  });

  // ---------- Export ----------
  $('#exportBtn').addEventListener('click', async () => {
    const blob = JSON.stringify(state.entries, null, 2);
    try {
      await navigator.clipboard.writeText(blob);
      toast('Copied to clipboard', 'ok');
    } catch {
      window.prompt('Copy entries JSON:', blob);
    }
  });

  // ---------- Custom phrase dialog ----------
  const customDialog = $('#customDialog');
  const customText   = $('#customText');
  const openCustom = () => {
    if (!state.attribute || !state.sentiment) { toast('Pick attribute & sentiment first', 'warn'); return; }
    customText.value = state.query.trim();
    if (typeof customDialog.showModal === 'function') customDialog.showModal();
    else customDialog.setAttribute('open', '');
    setTimeout(() => {
      customText.focus();
      const v = customText.value;
      customText.setSelectionRange(v.length, v.length);
    }, 50);
  };
  $('#customCancel').addEventListener('click', () => customDialog.close && customDialog.close());
  $('#customForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = customText.value.trim();
    if (!text) return;
    const k = slotKey();
    state.customs[k] = state.customs[k] || [];
    if (!state.customs[k].includes(text)) state.customs[k].unshift(text);
    save(CUSTOM_KEY, state.customs);
    customDialog.close && customDialog.close();
    logEntry(text);
    setQuery('');
    renderPhrases();
  });

  // ---------- Toast ----------
  const toastEl = $('#coachToast');
  let toastTimer;
  const toast = (msg, tone = 'ok') => {
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.dataset.tone = tone;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 1600);
  };

  const pulsePhraseSaved = (phrase) => {
    const tile = $$('.ptile').find(t => {
      const text = t.querySelector('.pt-text');
      if (!text) return false;
      const ctx = text.querySelector('.pt-context');
      const raw = ctx ? text.textContent.replace(ctx.textContent, '').trim() : text.textContent;
      return raw === phrase;
    });
    if (!tile) return;
    tile.classList.remove('flash');
    void tile.offsetWidth;
    tile.classList.add('flash');
  };

  // ---------- Phrase search input ----------
  const searchInput = $('#phraseSearch');
  const searchClear = $('#phraseSearchClear');
  let searchDebounce = null;
  const setQuery = (q) => {
    state.query = q || '';
    if (searchInput.value !== state.query) searchInput.value = state.query;
    searchClear.hidden = state.query.length === 0;
    renderPhrases();
  };
  searchInput.addEventListener('input', (ev) => {
    const v = ev.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => setQuery(v), 60);
  });
  searchInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (topMatch) {
        logEntry(topMatch.phrase, { attribute: topMatch.attribute, sentiment: topMatch.sentiment });
        setQuery('');
      } else if (state.query.trim().length > 0) {
        openCustom();
      }
    } else if (ev.key === 'Escape') {
      setQuery('');
      searchInput.blur();
    }
  });
  searchClear.addEventListener('click', () => {
    setQuery('');
    searchInput.focus();
  });

  // ---------- First paint ----------
  renderRoster();
  renderAttrs();
  renderPhrases();
  renderTally();
  renderBulk();
})();
