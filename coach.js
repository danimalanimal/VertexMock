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
  const incFreq = (p) => {
    state.freq[phraseKey(p)] = (state.freq[phraseKey(p)] || 0) + 1;
    save(FREQ_KEY, state.freq);
  };
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

  // ---------- Render: phrase deck ----------
  const phraseGrid = $('#phraseGrid');
  const phraseStatus = $('#phraseStatus');
  const renderPhrases = () => {
    phraseGrid.innerHTML = '';
    if (!state.attribute || !state.sentiment) {
      phraseStatus.textContent = 'Pick attribute & sentiment';
      phraseStatus.dataset.tone = 'wait';
      return;
    }
    const list = getPhrases();
    const sentName = state.sentiment === '+' ? 'commend' : state.sentiment === '-' ? 'critique' : 'note';
    const attrLabel = D.attributes.find(a => a.key === state.attribute).label;
    phraseStatus.textContent = `${attrLabel} \u2022 ${sentName} \u2022 ${list.length}`;
    phraseStatus.dataset.tone = state.sentiment === '+' ? 'pos' : state.sentiment === '-' ? 'neg' : 'neu';

    list.forEach(({ phrase, count, isCustom }) => {
      const tile = el('button', {
        class: 'ptile sent-' + (state.sentiment === '+' ? 'pos' : state.sentiment === '-' ? 'neg' : 'neu')
                + (isCustom ? ' custom' : ''),
        type: 'button',
      },
        el('span', { class:'pt-text' }, phrase),
        count > 0 ? el('span', { class:'pt-freq', title:`Used ${count}\u00d7` }, `\u00d7${count}`) : '',
        isCustom ? el('span', { class:'pt-tag' }, 'custom') : '',
      );
      tile.addEventListener('click', () => logEntry(phrase));
      phraseGrid.append(tile);
    });

    // Custom add tile always last
    const addTile = el('button', { class:'ptile add', type:'button' },
      el('span', { class:'pt-text' }, '+ Custom phrase'));
    addTile.addEventListener('click', openCustom);
    phraseGrid.append(addTile);
  };

  // ---------- Ready/Disabled state ----------
  const updateReady = () => {
    const ready = state.players.length > 0 && state.attribute && state.sentiment;
    phraseGrid.classList.toggle('disabled', !ready);
  };

  // ---------- Log entry ----------
  const logEntry = (phrase) => {
    if (state.players.length === 0) { toast('Pick a player first', 'warn'); return; }
    if (!state.attribute || !state.sentiment) { toast('Pick attribute & sentiment', 'warn'); return; }

    const attr = D.attributes.find(a => a.key === state.attribute);
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
        attribute: state.attribute,
        attributeLabel: attr.label,
        sentiment: state.sentiment,
        phrase,
        coach:  state.sessionOn ? state.sessionCoach : 'lin',
        kind:   state.sessionOn ? state.sessionKind  : 'Training',
        session: state.sessionOn,
      };
    });
    incFreq(phrase);
    state.entries.unshift(...newOnes);
    save(STORE_KEY, state.entries);
    pushToFeed(newOnes);
    renderTally();
    renderAttrs(); // refresh tally count on tiles
    pulsePhraseSaved(phrase);
    toast(state.players.length > 1
      ? `Logged ${newOnes.length} entries`
      : `Logged \u2014 ${player1Name(newOnes[0])}`, 'ok');
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
    customText.value = '';
    if (typeof customDialog.showModal === 'function') customDialog.showModal();
    else customDialog.setAttribute('open', '');
    setTimeout(() => customText.focus(), 50);
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
  const pulsePhraseSaved = (phrase) => {
    const tile = $$('.ptile').find(t => t.querySelector('.pt-text')?.textContent === phrase);
    if (!tile) return;
    tile.classList.remove('flash');
    void tile.offsetWidth; // restart animation
    tile.classList.add('flash');
  };

  // ---------- First paint ----------
  renderRoster();
  renderAttrs();
  renderPhrases();
  renderTally();
  renderBulk();
})();
