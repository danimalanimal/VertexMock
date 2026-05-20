// Vertex Coach Input — courtside, thumb-driven, 2-4 tap observation logger.
// Stateful UI: player(s) + attribute + sentiment + phrase => one logged entry.
// Bulk mode multiplies the player axis. Sticky context speeds repeated entries.

(function () {
  const D = window.VertexCoachData;
  const FEED = (window.VertexData && window.VertexData.feed) || [];
  const STORE_KEY = 'vertex.coach.entries.v1';
  const FREQ_KEY  = 'vertex.coach.freq.v1';
  const CUSTOM_KEY = 'vertex.coach.custom.v1';

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
    sessionCoach: 'lin',
    sessionKind: 'Training',
    bulk: false,
    players: [],       // selected player ids
    attribute: null,   // attribute key
    sentiment: null,   // '+' | '=' | '-'
    query: '',         // phrase search query
    entries: load(STORE_KEY, []),
    freq: load(FREQ_KEY, {}),    // { 'attr|sent|phrase': count }
    customs: load(CUSTOM_KEY, {}),// { 'attr|sent': ['custom phrase', ...] }
  };

  // ---------- Helpers ----------
  const today = () => {
    const d = new Date();
    return d.toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
  };
  const slotKey = () => `${state.attribute}|${state.sentiment}`;
  const phraseKey = (p) => `${slotKey()}|${p}`;
  const getPhrases = () => {
    if (!state.attribute || !state.sentiment) return [];
    const seed = (D.phrases[state.attribute]?.[state.sentiment]) || [];
    const customs = (state.customs[slotKey()] || []);
    const all = [...customs, ...seed];
    // Sort by usage frequency desc; ties keep author order
    return all.map((p, i) => ({ p, f: state.freq[`${slotKey()}|${p}`] || 0, i }))
              .sort((a, b) => b.f - a.f || a.i - b.i)
              .map(x => ({ phrase: x.p, count: x.f, isCustom: customs.includes(x.p) }));
  };

  // ---------- Render: session toggle + coaches ----------
  const sessToggle = $('#sessionToggle');
  const sessLabel  = sessToggle.querySelector('.cs-label');
  const sessMeta   = $('#sessionMeta');
  const coachSel   = $('#sessionCoach');
  const kindSel    = $('#sessionKind');
  D.coaches.forEach(c => coachSel.append(el('option', { value: c.id }, c.name)));
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
    // Exiting bulk: collapse to first selected
    if (!state.bulk && state.players.length > 1) state.players = state.players.slice(0, 1);
    renderRoster();
  };
  bulkBtn.addEventListener('click', () => { state.bulk = !state.bulk; renderBulk(); });

  // ---------- Render: player rail ----------
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
        title: `${p.name} \u2022 ${p.pos}`,
      },
        el('span', { class:'pa', style:`background:${p.accent};color:#0c1422` }, p.initials),
        el('span', { class:'pn' }, p.name.split(' ')[0]),
        el('span', { class:'pp' }, `#${p.num}`),
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
  };
  clearPlayersBtn.addEventListener('click', () => { state.players = []; renderRoster(); });

  // ---------- Render: attribute grid ----------
  const attrGrid = $('#attrGrid');
  const todayCount = (key) => state.entries.filter(e => e.attribute === key && e.date === today()).length;
  const renderAttrs = () => {
    attrGrid.innerHTML = '';
    D.attributes.forEach(a => {
      const on = state.attribute === a.key;
      const tile = el('button', {
        class: 'atile' + (on ? ' on' : ''),
        type: 'button',
        role: 'radio',
        'aria-checked': String(on),
        'data-key': a.key,
      },
        el('span', { class:'ag' }, a.glyph),
        el('span', { class:'al' }, a.label),
        el('span', { class:'ac' }, String(todayCount(a.key))),
      );
      tile.addEventListener('click', () => { state.attribute = a.key; renderAttrs(); renderPhrases(); updateReady(); });
      attrGrid.append(tile);
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
  // Score a phrase against the query. Higher = better. 0 = no match.
  // Token-prefix matches score highest, then word-boundary substring, then loose substring.
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scorePhrase = (phrase, qTokens) => {
    if (qTokens.length === 0) return 0;
    const lc = phrase.toLowerCase();
    let score = 0;
    for (const t of qTokens) {
      if (!t) continue;
      const tokenRe = new RegExp('(^|[\\s\\-/\u2019\'"(])' + escapeRe(t), 'i');
      const subAt = lc.indexOf(t);
      if (tokenRe.test(phrase)) {
        score += 100 + Math.min(20, t.length * 2);
        if (lc.startsWith(t)) score += 40;
      } else if (subAt >= 0) {
        score += 30 + Math.min(15, t.length * 2);
      } else {
        return 0; // require every token to match somewhere
      }
    }
    return score;
  };

  // Wrap matched query tokens in <mark>. Returns an array of DOM nodes.
  const highlightMatches = (phrase, qTokens) => {
    if (qTokens.length === 0) return [document.createTextNode(phrase)];
    const parts = qTokens.filter(Boolean).map(escapeRe);
    if (parts.length === 0) return [document.createTextNode(phrase)];
    const re = new RegExp('(' + parts.join('|') + ')', 'ig');
    const nodes = [];
    let last = 0;
    let m;
    while ((m = re.exec(phrase)) !== null) {
      if (m.index > last) nodes.push(document.createTextNode(phrase.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.textContent = m[0];
      nodes.push(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < phrase.length) nodes.push(document.createTextNode(phrase.slice(last)));
    return nodes;
  };

  const buildPhraseList = () => {
    const q = state.query.trim();
    const qTokens = q ? q.toLowerCase().split(/\s+/) : [];
    const slotPicked = !!(state.attribute && state.sentiment);

    if (qTokens.length === 0) {
      if (!slotPicked) return { mode:'empty', items:[], qTokens };
      const items = getPhrases().map(x => ({ ...x, attribute: state.attribute, sentiment: state.sentiment, score: 0 }));
      return { mode:'slot', items, qTokens };
    }

    const customsEntries = [];
    Object.keys(state.customs || {}).forEach(k => {
      const [a, s] = k.split('|');
      (state.customs[k] || []).forEach(p => customsEntries.push({ phrase: p, attribute: a, sentiment: s, isCustom: true }));
    });
    let pool = customsEntries.concat(D.allPhrases.map(p => ({ ...p, isCustom: false })));

    // Strict slot filter: restrict pool to what the coach has picked.
    // Both picked -> exact slot. Only attr -> all 3 sentiments of that attr.
    // Only sent -> all 6 attrs of that sentiment. Neither -> entire library.
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

    // Mode reflects how filtered the pool is, for status-line copy.
    let mode;
    if (slotPicked) mode = 'searchSlot';
    else if (state.attribute || state.sentiment) mode = 'searchScoped';
    else mode = 'searchAll';
    return { mode, items: scored.slice(0, 40), qTokens };
  };

  // ---------- Render: phrase deck ----------
  const phraseGrid = $('#phraseGrid');
  const phraseStatus = $('#phraseStatus');
  let topMatch = null; // remembered for Enter-to-save-top

  const addCustomTile = () => {
    const q = state.query.trim();
    const label = q
      ? `+ Save “${q.length > 28 ? q.slice(0, 26) + '…' : q}” as phrase`
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
      phraseStatus.textContent = `${attrLabel} • ${sentName} • ${items.length}`;
      phraseStatus.dataset.tone = state.sentiment === '+' ? 'pos' : state.sentiment === '-' ? 'neg' : 'neu';
    } else {
      let scope;
      if (mode === 'searchAll') {
        scope = 'all library';
      } else if (mode === 'searchScoped') {
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
      phraseStatus.textContent = `${items.length} match${items.length === 1 ? '' : 'es'} • ${scope}`;
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
        `No matches for “${state.query}”. Tap “+ Save” to add it.`));
      addCustomTile();
      return;
    }

    items.forEach((it, idx) => {
      const sentCls = it.sentiment === '+' ? 'pos' : it.sentiment === '-' ? 'neg' : 'neu';
      const crossSlot = qTokens.length > 0 && (!slotPicked || it.attribute !== state.attribute || it.sentiment !== state.sentiment);

      const textSpan = el('span', { class:'pt-text' });
      if (crossSlot) {
        const attrLabel = D.attributes.find(a => a.key === it.attribute)?.label || it.attribute;
        const sentLabel = D.sentimentLabels[it.sentiment] || it.sentiment;
        textSpan.append(el('span', { class:'pt-context ' + sentCls }, `${attrLabel} • ${sentLabel}`));
      }
      highlightMatches(it.phrase, qTokens).forEach(n => textSpan.append(n));

      const isTop = qTokens.length > 0 && idx === 0;
      const tile = el('button', {
        class: 'ptile sent-' + sentCls
                + (it.isCustom ? ' custom' : '')
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
  // Optional override allows a cross-slot search match to log against the phrase's
  // own attribute/sentiment without disturbing the coach's current slot selection.
  const logEntry = (phrase, override) => {
    if (state.players.length === 0) { toast('Pick a player first', 'warn'); return; }
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
        date: today(),
        time: new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' }),
        playerId: pid,
        playerName: player.name,
        attribute: useAttribute,
        attributeLabel: attr.label,
        sentiment: useSentiment,
        phrase,
        coach:  state.sessionOn ? state.sessionCoach : 'lin',
        kind:   state.sessionOn ? state.sessionKind  : 'Training',
        session: state.sessionOn,
      };
    });
    // Increment usage against the phrase's actual slot (so it surfaces faster next time).
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
    // Clear the search query (if any) so next-entry typing starts fresh.
    // This also re-renders the deck, refreshing tally counts on attribute tiles.
    if (state.query) setQuery('');
    else { renderPhrases(); renderAttrs(); }
  };
  const player1Name = (entry) => entry.playerName.split(' ')[0];

  // Push entries into the live dashboard feed (in-memory + localStorage mirror).
  const pushToFeed = (entries) => {
    if (!window.VertexData) return;
    entries.forEach(e => {
      window.VertexData.feed.unshift({
        date:  e.date,
        coach: e.coach,
        kind:  e.kind,
        topic: D.attributes.find(a => a.key === e.attribute).topic,
        text:  e.phrase + (e.sentiment === '+' ? '' : e.sentiment === '-' ? '' : ''),
        sentiment: e.sentiment,
        source: 'coach-input',
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
      tallyList.append(el('li', { class:'ct-empty' }, 'No entries yet. Pick player \u2192 attribute \u2192 sentiment \u2192 phrase.'));
      return;
    }
    // Group consecutive entries from the same batch
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

  // ---------- Undo last ----------
  $('#undoBtn').addEventListener('click', () => {
    if (state.entries.length === 0) { toast('Nothing to undo', 'warn'); return; }
    // Undo the whole most-recent batch
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
      // Fallback: dump into a prompt
      window.prompt('Copy entries JSON:', blob);
    }
  });

  // ---------- Custom phrase dialog ----------
  const customDialog = $('#customDialog');
  const customText   = $('#customText');
  const openCustom = () => {
    if (!state.attribute || !state.sentiment) { toast('Pick attribute & sentiment first', 'warn'); return; }
    // Prefill with the current search query if one is typed
    customText.value = state.query.trim();
    if (typeof customDialog.showModal === 'function') customDialog.showModal();
    else customDialog.setAttribute('open', '');
    setTimeout(() => {
      customText.focus();
      // Place caret at end for fast editing of the prefilled query
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
    // Clear the search so the deck snaps back to a clean slot view
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

  // ---------- Pulse the just-tapped phrase tile (peripheral confirmation) ----------
  // Matches by phrase text only (ignores leading context chip text on cross-slot tiles).
  const pulsePhraseSaved = (phrase) => {
    const tile = $$('.ptile').find(t => {
      const text = t.querySelector('.pt-text');
      if (!text) return false;
      // Strip any context chip text from the comparison
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
        // No match — jump to custom save with prefill
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
