// phrase-library.js — Phase 2 phrase library
// Contract: FORM_DESIGNER_CONTRACT.md v1.4 §2.3
// ADRs: 0003 (owner stamping), 0005 (server-side id minting)
//
// Responsibilities:
//   • Load phrases registry from /api/registry?name=phrases
//   • Render three-pane UI: list (with filters + bulk), editor, where-used
//   • Hash routing: #p/<id>, #new, #archived
//   • Autosave edits @ 800ms debounce → PUT /api/registry
//   • Adopt server-minted ids from PUT response.data.items[]
//   • Option 1 immutability: text/attribute/sentiment locked after first save
//
// Phase 2 deliberately excludes: phrase picker INSIDE the form designer
// (that's a runtime concern), import/export, audit log.

// ─── Constants ───────────────────────────────────────────────────────────────
const SAVE_DEBOUNCE_MS = 800;
const DUP_CHECK_DEBOUNCE_MS = 250;

const SPORTS_FALLBACK = [
  'basketball', 'boxing', 'soccer', 'rugby_union', 'rugby_league',
  'aussie_rules', 'cricket', 'tennis', 'netball', 'volleyball',
  'athletics', 'swimming', 'general', 'other',
];

const ATTRIBUTES_FALLBACK = [
  // Basketball
  { key: 'technical',   label: 'Technical' },
  { key: 'tactical',    label: 'Tactical' },
  { key: 'physical',    label: 'Physical' },
  { key: 'mental',      label: 'Mental' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'leadership',  label: 'Leadership' },
  // Boxing
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'mitts',        label: 'Mitts' },
  { key: 'noodle',       label: 'Noodle' },
  { key: 'shields',      label: 'Shields' },
  { key: 'partner',      label: 'Partner' },
];

const SENTIMENT_LABEL = { '+': 'Strength', '=': 'Mixed', '-': 'Watch' };
const SENTIMENT_CLASS = { '+': 'sent-pos', '=': 'sent-neu', '-': 'sent-neg' };

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  phrases: [],            // array of phrase records (mirror of items[])
  attributes: [],         // from attributes registry, or fallback
  sports: [],             // sport key strings
  forms: [],              // for "where used"
  selectedId: null,       // currently-edited phrase id (or null for #new)
  draftItem: null,        // in-flight new phrase (no id yet)
  selected: new Set(),    // ids ticked in the list for bulk actions
  filters: {
    search: '',
    attributes: new Set(), // empty = all
    sentiments: new Set(), // empty = all
    sports: new Set(),     // empty = all
    showArchived: false,
  },
  saveTimer: null,
  dupCheckTimer: null,
  saveState: 'idle',
  lastSavedAt: null,
};

// ─── Boot ────────────────────────────────────────────────────────────────────
init().catch((err) => {
  console.error('Phrase library boot failed:', err);
  setSaveState('error', err.message);
});

async function init() {
  await Promise.all([
    loadRegistry('phrases').then((r) => { state.phrases = (r?.items) || []; }),
    loadRegistry('attributes').then((r) => {
      state.attributes = (r?.items) || ATTRIBUTES_FALLBACK;
    }),
    loadRegistry('sports').then((r) => {
      state.sports = (r?.items?.map?.((s) => s.key || s)) || SPORTS_FALLBACK;
    }),
    loadRegistry('forms').then((r) => { state.forms = (r?.items) || []; }),
  ]);

  populateAttributeSelect();
  populateSportPicker();
  populateFilterChips();
  bindUiEvents();
  bindHashRouting();
  renderList();
  applyHash();
  setSaveState('idle');
}

// ─── Registry I/O ────────────────────────────────────────────────────────────
async function loadRegistry(name) {
  try {
    const r = await fetch(`/api/registry?name=${encodeURIComponent(name)}`, {
      cache: 'no-store',
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GET ${name}: ${r.status}`);
    const body = await r.json();
    return body?.data || null;
  } catch (e) {
    console.warn(`[registry] ${name} load failed:`, e);
    return null;
  }
}

async function savePhrases() {
  setSaveState('saving');
  try {
    // Build the wire shape. state.phrases is the SoT; the in-flight draft
    // (if any) is appended with id:null so the server mints it (ADR-0005).
    const items = state.draftItem
      ? [...state.phrases, state.draftItem]
      : [...state.phrases];

    const r = await fetch('/api/registry', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'phrases',
        data: { version: 1, items },
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`PUT phrases: ${r.status} ${text}`);
    }
    const body = await r.json();
    const canonical = body?.data?.items || [];

    // Adopt the canonical list, preserving order. If we had a draft, the
    // server minted its id and we re-route to it.
    const wasDraft = !!state.draftItem;
    state.phrases = canonical;
    if (wasDraft) {
      // The draft is the last item; pick up its id and select it.
      const minted = canonical[canonical.length - 1];
      state.draftItem = null;
      state.selectedId = minted?.id || null;
      if (state.selectedId) {
        history.replaceState(null, '', `#p/${state.selectedId}`);
      }
    }

    state.lastSavedAt = new Date();
    setSaveState('saved');
    renderList();
    renderEditor();
  } catch (e) {
    console.error('[registry] save failed:', e);
    setSaveState('error', e.message);
  }
}

function scheduleSave() {
  setSaveState('dirty');
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    savePhrases();
  }, SAVE_DEBOUNCE_MS);
}

function setSaveState(next, detail) {
  state.saveState = next;
  const el = document.querySelector('.save-indicator');
  if (!el) return;
  el.dataset.state = next === 'idle' ? '' : next;
  const text = el.querySelector('.save-text');
  if (!text) return;
  switch (next) {
    case 'idle':   text.textContent = 'Ready'; break;
    case 'dirty':  text.textContent = 'Unsaved changes…'; break;
    case 'saving': text.textContent = 'Saving…'; break;
    case 'saved': {
      const t = state.lastSavedAt;
      const hh = t ? String(t.getHours()).padStart(2,'0') : '--';
      const mm = t ? String(t.getMinutes()).padStart(2,'0') : '--';
      text.textContent = `Saved ✓ ${hh}:${mm}`;
      break;
    }
    case 'error': text.textContent = `Save failed${detail ? ': ' + detail : ''}`; break;
  }
}

// ─── Hash routing ────────────────────────────────────────────────────────────
// Grammar:
//   (empty)     — no selection (editor shows empty state)
//   #new        — new draft phrase
//   #p/<id>     — edit phrase by id
function bindHashRouting() {
  window.addEventListener('hashchange', applyHash);
}

function applyHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (h === 'new') {
    startNewDraft();
    return;
  }
  const m = h.match(/^p\/(.+)$/);
  if (m) {
    selectPhrase(m[1]);
    return;
  }
  // No hash → clear selection
  state.selectedId = null;
  state.draftItem = null;
  renderList();
  renderEditor();
}

function selectPhrase(id) {
  const p = state.phrases.find((x) => x.id === id);
  if (!p) {
    // Unknown id — strip hash, show empty editor.
    state.selectedId = null;
    state.draftItem = null;
    history.replaceState(null, '', '#');
  } else {
    state.selectedId = id;
    state.draftItem = null;
  }
  renderList();
  renderEditor();
  if (window.matchMedia('(max-width: 900px)').matches) {
    switchTab('editor');
  }
}

function startNewDraft() {
  state.selectedId = null;
  state.draftItem = {
    id: null,
    text: '',
    attribute: state.attributes[0]?.key || 'technical',
    sentiment: '+',
    sports: [],
    status: 'active',
  };
  renderList();
  renderEditor();
  // Focus the text field
  setTimeout(() => {
    const ta = document.querySelector('[data-field="text"]');
    if (ta) ta.focus();
  }, 50);
  if (window.matchMedia('(max-width: 900px)').matches) {
    switchTab('editor');
  }
}

// ─── List rendering ──────────────────────────────────────────────────────────
function renderList() {
  const ul = document.querySelector('[data-list="phrases"]');
  if (!ul) return;

  const filtered = applyFilters(state.phrases);
  const archivedCount = state.phrases.filter((p) => p.status === 'archived').length;

  ul.innerHTML = '';
  for (const p of filtered) {
    const li = document.createElement('li');
    li.className = 'phrase-row';
    li.dataset.id = p.id;
    if (p.id === state.selectedId) li.classList.add('is-selected');
    if (p.status === 'archived') li.classList.add('is-archived');

    // Checkbox for bulk
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'row-check';
    check.checked = state.selected.has(p.id);
    check.addEventListener('click', (e) => e.stopPropagation());
    check.addEventListener('change', () => toggleBulkSelect(p.id, check.checked));

    // Body
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.minWidth = '0';

    const txt = document.createElement('div');
    txt.className = 'phrase-text';
    txt.textContent = p.text;

    const meta = document.createElement('div');
    meta.className = 'phrase-meta';
    const attrLabel = state.attributes.find((a) => a.key === p.attribute)?.label || p.attribute;
    meta.appendChild(chip('attr', attrLabel));
    meta.appendChild(chip(SENTIMENT_CLASS[p.sentiment] || '', p.sentiment));
    if (!p.sports || p.sports.length === 0) {
      meta.appendChild(chip('universal', 'all sports'));
    } else {
      for (const s of p.sports) meta.appendChild(chip('sport', s));
    }

    body.appendChild(txt);
    body.appendChild(meta);

    li.appendChild(check);
    li.appendChild(body);

    li.addEventListener('click', () => {
      location.hash = `p/${p.id}`;
    });

    ul.appendChild(li);
  }

  // Counts
  document.querySelector('[data-count="visible"]').textContent = String(filtered.length);
  document.querySelector('[data-count="total"]').textContent = String(state.phrases.length);
  const archCountEl = document.querySelector('[data-count="archived"]');
  if (archCountEl) archCountEl.textContent = `(${archivedCount})`;

  // Empty hint
  document.querySelector('.list-empty').hidden = filtered.length > 0;

  // Bulk toolbar visibility
  const bulkBar = document.querySelector('.bulk-toolbar');
  if (bulkBar) {
    bulkBar.hidden = state.selected.size < 2;
    const c = document.querySelector('[data-bulk-count]');
    if (c) c.textContent = String(state.selected.size);
  }
}

function chip(cls, text) {
  const span = document.createElement('span');
  span.className = `meta-chip ${cls}`;
  span.textContent = text;
  return span;
}

function applyFilters(items) {
  const f = state.filters;
  const q = f.search.trim().toLowerCase();
  return items.filter((p) => {
    if (p.status === 'archived' && !f.showArchived) return false;
    if (q && !p.text.toLowerCase().includes(q)) return false;
    if (f.attributes.size && !f.attributes.has(p.attribute)) return false;
    if (f.sentiments.size && !f.sentiments.has(p.sentiment)) return false;
    if (f.sports.size) {
      // A phrase matches if it has at least one of the selected sport tags,
      // OR has empty sports[] (universal).
      const universal = !p.sports || p.sports.length === 0;
      if (!universal && !p.sports.some((s) => f.sports.has(s))) return false;
    }
    return true;
  });
}

// ─── Editor rendering ────────────────────────────────────────────────────────
function renderEditor() {
  const empty = document.querySelector('.editor-empty');
  const body = document.querySelector('.editor-body');
  const item = currentEditedItem();

  if (!item) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const isNew = !item.id;
  const isArchived = item.status === 'archived';

  // Status pill + id pill
  const statusPill = document.querySelector('[data-pill="status"]');
  statusPill.textContent = isArchived ? 'ARCHIVED' : 'ACTIVE';
  statusPill.classList.toggle('is-archived', isArchived);

  const idPill = document.querySelector('[data-pill="id"]');
  idPill.textContent = item.id || '(unsaved)';

  // Actions
  document.querySelector('[data-action="archive"]').hidden = isNew || isArchived;
  document.querySelector('[data-action="unarchive"]').hidden = isNew || !isArchived;

  // Fields
  const txt = document.querySelector('[data-field="text"]');
  txt.value = item.text;
  txt.disabled = !isNew; // Option 1 immutability: text locked after first save
  const hint = document.querySelector('[data-text-hint]');
  hint.textContent = isNew
    ? '(permanent once saved · Option 1 immutability)'
    : '(permanent — text locked. To change wording, archive this and create a new phrase.)';

  const attrSel = document.querySelector('[data-field="attribute"]');
  attrSel.value = item.attribute;
  attrSel.disabled = !isNew;

  const sentSel = document.querySelector('[data-field="sentiment"]');
  sentSel.value = item.sentiment;
  sentSel.disabled = !isNew;

  // Sports chips
  renderSportChips(item);

  // Provenance
  setMeta('createdAt', formatDate(item.createdAt));
  setMeta('createdBy', item.createdBy || '—');
  setMeta('updatedAt', formatDate(item.updatedAt));
  setMeta('updatedBy', item.updatedBy || '—');

  // Where used
  renderWhereUsed(item);

  // Dup warning (hide on render; re-check on text blur)
  document.querySelector('.dup-warn').hidden = true;
}

function currentEditedItem() {
  if (state.draftItem) return state.draftItem;
  if (state.selectedId) return state.phrases.find((p) => p.id === state.selectedId) || null;
  return null;
}

function setMeta(key, val) {
  const el = document.querySelector(`[data-meta="${key}"]`);
  if (el) el.textContent = val || '—';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
}

function renderSportChips(item) {
  const ul = document.querySelector('[data-field="sports"]');
  ul.innerHTML = '';
  for (const s of item.sports || []) {
    const li = document.createElement('li');
    li.textContent = s;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.title = `Remove ${s}`;
    btn.addEventListener('click', () => removeSport(s));
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function removeSport(sportKey) {
  const item = currentEditedItem();
  if (!item) return;
  item.sports = (item.sports || []).filter((s) => s !== sportKey);
  renderSportChips(item);
  scheduleSave();
}

function addSport(sportKey) {
  const item = currentEditedItem();
  if (!item || !sportKey) return;
  if (!item.sports) item.sports = [];
  if (!item.sports.includes(sportKey)) {
    item.sports.push(sportKey);
    renderSportChips(item);
    scheduleSave();
  }
}

function renderWhereUsed(phrase) {
  const stage = document.querySelector('#preview-stage');
  if (!stage) return;
  // Match forms whose attributes list contains this phrase's attribute,
  // AND whose sport is one of phrase.sports (or sports[] is empty = universal).
  const universal = !phrase.sports || phrase.sports.length === 0;
  const matches = state.forms.filter((f) => {
    if (!f.attributes || !f.attributes.includes?.(phrase.attribute)) return false;
    if (universal) return true;
    return phrase.sports.includes(f.sport);
  });

  if (matches.length === 0) {
    stage.innerHTML = `
      <div class="preview-empty">
        <p class="muted">Not surfaced in any current form's picker.</p>
        <p class="muted" style="margin-top:8px; font-size:11px;">
          A phrase appears in a form's picker if the form lists its attribute
          AND the form's sport is in the phrase's <code>sports[]</code>
          (or <code>sports[]</code> is empty).
        </p>
      </div>`;
    return;
  }

  const list = matches.map((f) => `
    <li>
      <strong>${escapeHtml(f.name || f.slug)}</strong>
      <span class="muted">· ${escapeHtml(f.slug)} · ${escapeHtml(f.sport || '—')}</span>
    </li>
  `).join('');
  stage.innerHTML = `
    <div class="preview-content">
      <p class="muted" style="padding:0 16px;">Surfaces in ${matches.length} form${matches.length === 1 ? '' : 's'}:</p>
      <ul style="list-style:none; padding:8px 16px; margin:0;">${list}</ul>
    </div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ─── Field bindings ──────────────────────────────────────────────────────────
function bindUiEvents() {
  // Text field
  const txt = document.querySelector('[data-field="text"]');
  txt.addEventListener('input', (e) => {
    const item = currentEditedItem();
    if (!item) return;
    // Only new (unsaved) items can have text changed
    if (!item.id || state.draftItem) {
      item.text = e.target.value;
      scheduleSave();
      scheduleDupCheck();
    }
  });
  txt.addEventListener('blur', () => runDupCheck());

  // Attribute select
  document.querySelector('[data-field="attribute"]').addEventListener('change', (e) => {
    const item = currentEditedItem();
    if (!item || (item.id && !state.draftItem)) return; // locked post-save
    item.attribute = e.target.value;
    scheduleSave();
  });

  // Sentiment select
  document.querySelector('[data-field="sentiment"]').addEventListener('change', (e) => {
    const item = currentEditedItem();
    if (!item || (item.id && !state.draftItem)) return;
    item.sentiment = e.target.value;
    scheduleSave();
  });

  // Sport add
  document.querySelector('[data-action="add-sport"]').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v) {
      addSport(v);
      e.target.value = '';
    }
  });

  // Archive / unarchive
  document.querySelector('[data-action="archive"]').addEventListener('click', () => {
    const item = currentEditedItem();
    if (!item || !item.id) return;
    const modal = document.querySelector('#confirm-archive-modal');
    modal.querySelector('[data-slot="id"]').textContent = item.id;
    modal.showModal();
    modal.addEventListener('close', function onClose() {
      modal.removeEventListener('close', onClose);
      if (modal.returnValue === 'ok') {
        item.status = 'archived';
        scheduleSave();
        renderEditor();
        renderList();
      }
    });
  });
  document.querySelector('[data-action="unarchive"]').addEventListener('click', () => {
    const item = currentEditedItem();
    if (!item || !item.id) return;
    item.status = 'active';
    scheduleSave();
    renderEditor();
    renderList();
  });

  // New phrase
  document.querySelector('[data-action="new-phrase"]').addEventListener('click', () => {
    location.hash = 'new';
  });

  // Search
  document.querySelector('#list-search').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderList();
  });

  // Show archived toggle
  document.querySelector('#show-archived').addEventListener('change', (e) => {
    state.filters.showArchived = e.target.checked;
    renderList();
  });

  // Mobile tabs
  document.querySelectorAll('.topbar-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Bulk actions
  document.querySelector('[data-action="bulk-archive"]').addEventListener('click', () => bulkArchive(true));
  document.querySelector('[data-action="bulk-unarchive"]').addEventListener('click', () => bulkArchive(false));
  document.querySelector('[data-action="bulk-tag-sport"]').addEventListener('click', () => bulkSportPrompt('add'));
  document.querySelector('[data-action="bulk-untag-sport"]').addEventListener('click', () => bulkSportPrompt('remove'));
  document.querySelector('[data-action="bulk-clear"]').addEventListener('click', () => {
    state.selected.clear();
    renderList();
  });
}

function switchTab(tab) {
  document.querySelectorAll('.pane').forEach((p) => {
    p.classList.toggle('is-active', p.dataset.pane === tab);
  });
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.tab === tab ? 'true' : 'false');
  });
}

// ─── Bulk actions ────────────────────────────────────────────────────────────
function toggleBulkSelect(id, on) {
  if (on) state.selected.add(id);
  else state.selected.delete(id);
  renderList();
}

function bulkArchive(archive) {
  let changed = 0;
  for (const id of state.selected) {
    const p = state.phrases.find((x) => x.id === id);
    if (!p) continue;
    const next = archive ? 'archived' : 'active';
    if (p.status !== next) {
      p.status = next;
      changed++;
    }
  }
  if (changed > 0) {
    scheduleSave();
    renderList();
  }
  state.selected.clear();
  renderList();
}

function bulkSportPrompt(mode) {
  const modal = document.querySelector('#bulk-sport-modal');
  const title = modal.querySelector('[data-slot="title"]');
  const hint = modal.querySelector('[data-slot="hint"]');
  const sel = modal.querySelector('#bulk-sport-select');

  title.textContent = mode === 'add'
    ? 'Tag selected phrases with sport'
    : 'Remove sport tag from selected phrases';
  hint.textContent = mode === 'add'
    ? 'Applies to all selected. Sports already present are unchanged.'
    : 'Removes the chosen sport from any selected phrase that has it.';

  sel.innerHTML = '<option value="">— pick a sport —</option>'
    + state.sports.map((s) => `<option value="${s}">${s}</option>`).join('');

  modal.showModal();
  modal.addEventListener('close', function onClose() {
    modal.removeEventListener('close', onClose);
    if (modal.returnValue !== 'ok' || !sel.value) return;
    const sport = sel.value;
    let changed = 0;
    for (const id of state.selected) {
      const p = state.phrases.find((x) => x.id === id);
      if (!p) continue;
      if (!p.sports) p.sports = [];
      if (mode === 'add' && !p.sports.includes(sport)) {
        p.sports.push(sport);
        changed++;
      } else if (mode === 'remove' && p.sports.includes(sport)) {
        p.sports = p.sports.filter((s) => s !== sport);
        changed++;
      }
    }
    if (changed > 0) {
      scheduleSave();
      renderList();
    }
  });
}

// ─── Dup-text check ──────────────────────────────────────────────────────────
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?…]+$/g, '');
}

function scheduleDupCheck() {
  if (state.dupCheckTimer) clearTimeout(state.dupCheckTimer);
  state.dupCheckTimer = setTimeout(runDupCheck, DUP_CHECK_DEBOUNCE_MS);
}

function runDupCheck() {
  const item = currentEditedItem();
  const warn = document.querySelector('.dup-warn');
  if (!item || !item.text || !item.text.trim()) {
    warn.hidden = true;
    return;
  }
  // Only check when text is editable (new draft, or existing not yet saved).
  if (item.id && !state.draftItem) {
    warn.hidden = true;
    return;
  }
  const norm = normalizeText(item.text);
  const matches = state.phrases.filter((p) => {
    if (p.id === item.id) return false; // never self-match
    if (p.status === 'archived') return false; // archived phrases are out of rotation
    if (p.attribute !== item.attribute) return false;
    if (p.sentiment !== item.sentiment) return false;
    return normalizeText(p.text) === norm;
  });

  const list = warn.querySelector('.dup-list');
  list.innerHTML = '';
  if (matches.length === 0) {
    warn.hidden = true;
    return;
  }
  for (const m of matches) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${m.text} `;
    const idTag = document.createElement('span');
    idTag.className = 'muted';
    idTag.textContent = m.id;
    span.appendChild(idTag);
    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.textContent = 'Use this →';
    useBtn.addEventListener('click', () => {
      // Discard the draft, navigate to the existing phrase.
      state.draftItem = null;
      location.hash = `p/${m.id}`;
    });
    li.appendChild(span);
    li.appendChild(useBtn);
    list.appendChild(li);
  }
  warn.hidden = false;
}

// ─── Populators ──────────────────────────────────────────────────────────────
function populateAttributeSelect() {
  const sel = document.querySelector('[data-field="attribute"]');
  sel.innerHTML = '';
  for (const a of state.attributes) {
    const opt = document.createElement('option');
    opt.value = a.key;
    opt.textContent = a.label || a.key;
    sel.appendChild(opt);
  }
}

function populateSportPicker() {
  const sel = document.querySelector('[data-action="add-sport"]');
  sel.innerHTML = '<option value="">+ Add sport…</option>';
  for (const s of state.sports) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
}

function populateFilterChips() {
  // Attribute filter
  const attrBox = document.querySelector('[data-filter="attribute"]');
  attrBox.innerHTML = '';
  for (const a of state.attributes) {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = a.key;
    cb.addEventListener('change', () => {
      if (cb.checked) state.filters.attributes.add(a.key);
      else state.filters.attributes.delete(a.key);
      updateFilterSummary('attribute', state.filters.attributes);
      renderList();
    });
    const span = document.createElement('span');
    span.textContent = a.label || a.key;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    attrBox.appendChild(lbl);
  }

  // Sport filter
  const sportBox = document.querySelector('[data-filter="sport"]');
  sportBox.innerHTML = '';
  for (const s of state.sports) {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = s;
    cb.addEventListener('change', () => {
      if (cb.checked) state.filters.sports.add(s);
      else state.filters.sports.delete(s);
      updateFilterSummary('sport', state.filters.sports);
      renderList();
    });
    const span = document.createElement('span');
    span.textContent = s;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    sportBox.appendChild(lbl);
  }

  // Sentiment filter is in HTML; wire its checkboxes
  document.querySelectorAll('[data-filter="sentiment"] input').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.filters.sentiments.add(cb.value);
      else state.filters.sentiments.delete(cb.value);
      updateFilterSummary('sentiment', state.filters.sentiments);
      renderList();
    });
  });
}

function updateFilterSummary(key, set) {
  const el = document.querySelector(`[data-filter-summary="${key}"]`);
  if (!el) return;
  el.textContent = set.size === 0 ? 'All' : `${set.size} selected`;
}
