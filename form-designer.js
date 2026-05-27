// form-designer.js — Phase 1 designer skeleton
// Contract: FORM_DESIGNER_CONTRACT.md v1.4
// ADRs: 0003 (owner stamping), 0004 (lifecycle + save model)
//
// Responsibilities:
//   • Load forms registry from /api/registry?name=forms
//   • Render three-pane UI: list, editor, preview
//   • Hash routing: #draft/<slug>, #live/<slug>, #archived/<slug>, #new
//   • Autosave draft edits @ 800ms debounce → PUT /api/registry
//   • Lifecycle transitions (publish, archive, clone-as-draft, delete-draft)
//
// Phase 1 deliberately excludes: metric inputs, version history, undo,
// phrase authoring, attribute authoring (registries are read-only here).

// ─── Constants ───────────────────────────────────────────────────────────────
const SPORTS_FALLBACK = [
  'basketball', 'boxing', 'soccer', 'rugby_union', 'rugby_league',
  'aussie_rules', 'cricket', 'tennis', 'netball', 'volleyball',
  'athletics', 'swimming', 'general', 'other',
];

const ATTRIBUTES_FALLBACK = [
  { key: 'technical',   label: 'Technical' },
  { key: 'tactical',    label: 'Tactical' },
  { key: 'physical',    label: 'Physical' },
  { key: 'mental',      label: 'Mental' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'leadership',  label: 'Leadership' },
];

const SAVE_DEBOUNCE_MS = 800;

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  forms: [],              // array of form records from items[]
  attributes: [],         // from attributes registry, or fallback
  sports: [],             // from sports registry, or fallback
  rosters: [],            // from rosters registry, or fallback (empty)
  selectedSlug: null,     // currently-edited form's slug
  saveTimer: null,
  saveState: 'idle',      // 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  lastSavedAt: null,
};

// ─── Boot ────────────────────────────────────────────────────────────────────
init().catch((err) => {
  console.error('Designer boot failed:', err);
  setSaveState('error', err.message);
});

async function init() {
  // Load all registries in parallel, with fallback for missing ones.
  await Promise.all([
    loadRegistry('forms').then((r) => { state.forms = (r?.items) || []; }),
    loadRegistry('attributes').then((r) => {
      state.attributes = (r?.items) || ATTRIBUTES_FALLBACK;
    }),
    loadRegistry('sports').then((r) => {
      state.sports = (r?.items?.map?.((s) => s.key || s)) || SPORTS_FALLBACK;
    }),
    loadRegistry('rosters').then((r) => { state.rosters = (r?.items) || []; }),
  ]);

  populateSelects();
  renderList();
  bindUiEvents();
  bindHashRouting();
  applyHash();
  setSaveState('idle');
}

// ─── Registry I/O ────────────────────────────────────────────────────────────
async function loadRegistry(name) {
  try {
    const r = await fetch(`/api/registry?name=${encodeURIComponent(name)}`, {
      cache: 'no-store',
    });
    if (r.status === 404) return null;        // registry not created yet
    if (!r.ok) throw new Error(`GET ${name}: ${r.status}`);
    const body = await r.json();
    return body.data || null;
  } catch (e) {
    console.warn(`[registry] load failed for ${name}:`, e.message);
    return null;
  }
}

async function saveForms() {
  setSaveState('saving');
  try {
    const r = await fetch('/api/registry', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'forms',
        data: { version: 1, items: state.forms },
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`PUT forms: ${r.status} ${text}`);
    }
    state.lastSavedAt = new Date();
    setSaveState('saved');
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
    saveForms();
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
    case 'error':  text.textContent = `Save failed${detail ? ': ' + detail : ''}`; break;
  }
}

// ─── Populate top-of-form selects ────────────────────────────────────────────
function populateSelects() {
  const sportSels = document.querySelectorAll('select[data-field="sport"], #new-sport');
  for (const sel of sportSels) {
    sel.innerHTML = state.sports
      .map((s) => {
        const key = typeof s === 'string' ? s : s.key;
        const label = typeof s === 'string' ? s : (s.label || s.key);
        return `<option value="${esc(key)}">${esc(label)}</option>`;
      })
      .join('');
  }

  const rosterSels = document.querySelectorAll('select[data-field="rosterId"]');
  for (const sel of rosterSels) {
    const opts = ['<option value="">(all rosters — union)</option>'];
    for (const r of state.rosters) {
      opts.push(`<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`);
    }
    sel.innerHTML = opts.join('');
  }
}

// ─── Form list rendering ─────────────────────────────────────────────────────
function renderList() {
  const groups = { draft: [], live: [], archived: [] };
  const q = (document.getElementById('list-search')?.value || '').toLowerCase().trim();

  for (const f of state.forms) {
    if (!groups[f.status]) continue;
    if (q && !(f.name?.toLowerCase().includes(q) || f.slug?.includes(q))) continue;
    groups[f.status].push(f);
  }

  let total = 0;
  for (const [status, items] of Object.entries(groups)) {
    const ul = document.querySelector(`[data-list="${status}"]`);
    const countEl = document.querySelector(`[data-count="${status}"]`);
    if (countEl) countEl.textContent = items.length;
    total += items.length;
    if (!ul) continue;
    ul.innerHTML = items
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map((f) => {
        const current = state.selectedSlug === f.slug ? 'true' : 'false';
        return `
          <li>
            <button class="list-item" data-slug="${esc(f.slug)}" aria-current="${current}" type="button">
              <span class="list-item-name">${esc(f.name || f.slug)}</span>
              <span class="list-item-meta">${esc(f.sport || '')}${f.rosterId ? ' · ' + esc(f.rosterId) : ''}</span>
            </button>
          </li>`;
      })
      .join('');
  }

  document.querySelector('.list-empty')?.toggleAttribute('hidden', total > 0);
}

// ─── Editor rendering ────────────────────────────────────────────────────────
function renderEditor() {
  const empty = document.querySelector('.editor-empty');
  const body = document.querySelector('.editor-body');
  const form = currentForm();

  if (!form) {
    empty.hidden = false;
    body.hidden = true;
    renderPreview();
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const isDraft    = form.status === 'draft';
  const isLive     = form.status === 'live';
  const isArchived = form.status === 'archived';
  const readOnly   = !isDraft;

  // Status pills
  const statusPill = document.querySelector('[data-pill="status"]');
  statusPill.textContent = form.status.toUpperCase();
  statusPill.dataset.status = form.status;
  document.querySelector('[data-pill="sport"]').textContent = form.sport || 'no sport';
  document.querySelector('[data-pill="roster"]').textContent =
    form.rosterId || 'all rosters';

  // Action buttons
  show('[data-action="publish"]',      isDraft);
  show('[data-action="delete-draft"]', isDraft);
  show('[data-action="archive"]',      isLive);
  show('[data-action="clone"]',        isLive || isArchived);

  // Field values
  setField('name', form.name || '');
  setField('slug', form.slug || '');
  setField('description', form.description || '');
  setField('sport', form.sport || state.sports[0] || 'general');
  setField('rosterId', form.rosterId || '');

  // Slug is permanent: disable it once set (i.e. always after creation)
  document.querySelector('[data-field="slug"]').disabled = true;

  // Read-only for non-drafts
  for (const el of document.querySelectorAll('[data-field]')) {
    if (el.dataset.field === 'slug') continue;
    el.disabled = readOnly;
  }

  // Attribute chips
  renderAttributeChips(form);

  // Sentiments
  for (const cb of document.querySelectorAll('[data-field="sentiments"] input[type="checkbox"]')) {
    cb.checked = (form.sentiments || ['+','=','-']).includes(cb.value);
    cb.disabled = readOnly;
  }

  // Provenance
  setMeta('createdAt', formatIso(form.createdAt));
  setMeta('createdBy', form.createdBy || '—');
  setMeta('updatedAt', formatIso(form.updatedAt));
  setMeta('updatedBy', form.updatedBy || '—');
  setMeta('publishedAt', formatIso(form.publishedAt));
  setMeta('archivedAt', formatIso(form.archivedAt));
  toggleMetaRow('publishedAt', !!form.publishedAt);
  toggleMetaRow('archivedAt',  !!form.archivedAt);

  renderPreview();
}

function renderAttributeChips(form) {
  const ul = document.querySelector('[data-field="attributes"]');
  if (!ul) return;
  const attrs = form.attributes || [];
  ul.innerHTML = attrs
    .map((key) => {
      const a = state.attributes.find((x) => x.key === key);
      const label = a?.label || key;
      const removable = form.status === 'draft';
      return `
        <li class="chip" data-attr="${esc(key)}">
          <span>${esc(label)}</span>
          ${removable ? `<button type="button" class="chip-remove" data-remove-attr="${esc(key)}" aria-label="Remove ${esc(label)}">×</button>` : ''}
        </li>`;
    })
    .join('');

  const addBtn = document.querySelector('[data-action="pick-attributes"]');
  if (addBtn) addBtn.hidden = form.status !== 'draft';
}

// ─── Preview rendering ───────────────────────────────────────────────────────
function renderPreview() {
  const stage = document.getElementById('preview-stage');
  if (!stage) return;
  const form = currentForm();
  if (!form) {
    stage.innerHTML = `<div class="preview-empty"><p class="muted">Live preview appears here once a form is selected.</p></div>`;
    return;
  }

  const sentiments = form.sentiments?.length ? form.sentiments : ['+','=','-'];
  const attrs = form.attributes || [];

  stage.innerHTML = `
    <h3 class="preview-form-title">${esc(form.name || form.slug)}</h3>
    ${form.description ? `<p class="preview-form-desc">${esc(form.description)}</p>` : ''}
    <div class="preview-attribute-grid">
      ${attrs.length
        ? attrs.map((key) => {
            const a = state.attributes.find((x) => x.key === key);
            return `<div class="preview-attr-tile">${esc(a?.label || key)}</div>`;
          }).join('')
        : `<p class="muted" style="grid-column:1/-1;text-align:center;">No attributes yet.</p>`}
    </div>
    <div class="preview-sentiments">
      ${sentiments.map((s) => `<span class="preview-sent-pill">${esc(s)}</span>`).join('')}
    </div>
  `;
}

// ─── UI event binding ────────────────────────────────────────────────────────
function bindUiEvents() {
  // List clicks (event delegation)
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.list-item');
    if (item) {
      const slug = item.dataset.slug;
      const f = state.forms.find((x) => x.slug === slug);
      if (f) {
        location.hash = `#${f.status}/${slug}`;
      }
      return;
    }
    const removeAttr = e.target.closest('[data-remove-attr]');
    if (removeAttr) {
      const key = removeAttr.dataset.removeAttr;
      mutateCurrent((f) => {
        f.attributes = (f.attributes || []).filter((k) => k !== key);
      });
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action) handleAction(action);
  });

  // Search
  document.getElementById('list-search')?.addEventListener('input', renderList);

  // Field edits — autosave
  for (const el of document.querySelectorAll('[data-field]')) {
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, onFieldChange);
  }

  // Mobile tab switching
  for (const tab of document.querySelectorAll('.tab-btn')) {
    tab.addEventListener('click', () => {
      const which = tab.dataset.tab;
      for (const t of document.querySelectorAll('.tab-btn')) {
        t.setAttribute('aria-pressed', String(t.dataset.tab === which));
      }
      for (const p of document.querySelectorAll('.pane')) {
        p.dataset.active = String(p.dataset.pane === which);
      }
    });
  }

  // Set initial mobile-tab pane to "list"
  document.querySelector('.pane[data-pane="list"]')?.setAttribute('data-active', 'true');
}

function onFieldChange(e) {
  const form = currentForm();
  if (!form) return;
  if (form.status !== 'draft') return;  // read-only safety net

  const el = e.currentTarget;
  const field = el.dataset.field;

  if (field === 'sentiments') {
    const checked = [...document.querySelectorAll('[data-field="sentiments"] input:checked')].map((c) => c.value);
    mutateCurrent((f) => { f.sentiments = checked; });
    return;
  }
  if (field === 'attributes') return; // edited via chip/picker

  mutateCurrent((f) => { f[field] = el.value; });
}

function mutateCurrent(fn) {
  const f = currentForm();
  if (!f) return;
  fn(f);
  f.updatedAt = new Date().toISOString();
  // updatedBy is server-stamped, but we mirror locally so the UI doesn't lag
  renderEditor();
  renderList();
  scheduleSave();
}

// ─── Action handlers ─────────────────────────────────────────────────────────
async function handleAction(action) {
  switch (action) {
    case 'publish':       return publishCurrent();
    case 'archive':       return archiveCurrent();
    case 'clone':         return cloneCurrent();
    case 'delete-draft':  return deleteCurrentDraft();
    case 'pick-attributes': return openAttributePicker();
    default:
      console.warn('Unknown action:', action);
  }
}

async function publishCurrent() {
  const f = currentForm();
  if (!f || f.status !== 'draft') return;
  if (!confirm(`Publish "${f.name || f.slug}"? After publish, the form is read-only — to edit, you'll clone it as a new draft.`)) return;
  const nowIso = new Date().toISOString();
  f.status = 'live';
  f.publishedAt = nowIso;
  f.currentVersion = 1;
  await saveImmediate();
  location.hash = `#live/${f.slug}`;
}

async function archiveCurrent() {
  const f = currentForm();
  if (!f || f.status !== 'live') return;
  if (!confirm(`Archive "${f.name || f.slug}"? Existing entries against it are preserved; the form will no longer accept new entries.`)) return;
  f.status = 'archived';
  f.archivedAt = new Date().toISOString();
  await saveImmediate();
  location.hash = `#archived/${f.slug}`;
}

async function cloneCurrent() {
  const f = currentForm();
  if (!f) return;
  const newSlug = nextCloneSlug(f.slug);
  const nowIso = new Date().toISOString();
  const clone = {
    slug: newSlug,
    name: (f.name || f.slug) + ' (copy)',
    description: f.description || '',
    sport: f.sport,
    rosterId: f.rosterId || '',
    status: 'draft',
    publishedAt: null,
    archivedAt: null,
    currentVersion: null,
    attributes: [...(f.attributes || [])],
    sentiments: [...(f.sentiments || ['+','=','-'])],
    metricInputs: [],
    versions: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    // owner fields stamped by server
  };
  state.forms.push(clone);
  await saveImmediate();
  location.hash = `#draft/${newSlug}`;
}

function nextCloneSlug(slug) {
  let n = 2;
  const base = slug.replace(/-v\d+$/, '');
  while (state.forms.some((f) => f.slug === `${base}-v${n}`)) n++;
  return `${base}-v${n}`;
}

async function deleteCurrentDraft() {
  const f = currentForm();
  if (!f || f.status !== 'draft') return;
  const dlg = document.getElementById('confirm-delete-modal');
  dlg.querySelector('[data-slot="slug"]').textContent = f.slug;
  dlg.showModal();
  dlg.addEventListener('close', async function once() {
    dlg.removeEventListener('close', once);
    if (dlg.returnValue !== 'ok') return;
    state.forms = state.forms.filter((x) => x.slug !== f.slug);
    await saveImmediate();
    location.hash = '';
  });
}

async function saveImmediate() {
  if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
  await saveForms();
  renderList();
  renderEditor();
}

function openAttributePicker() {
  const f = currentForm();
  if (!f || f.status !== 'draft') return;
  const dlg = document.getElementById('pick-attributes-modal');
  const list = dlg.querySelector('#pick-attributes-list');
  const current = new Set(f.attributes || []);
  list.innerHTML = state.attributes
    .map((a) => `
      <li>
        <label style="display:flex;align-items:center;gap:10px;width:100%;cursor:pointer;">
          <input type="checkbox" value="${esc(a.key)}" ${current.has(a.key) ? 'checked' : ''} />
          <span>${esc(a.label || a.key)}</span>
        </label>
      </li>
    `).join('');
  dlg.showModal();
  dlg.addEventListener('close', function once() {
    dlg.removeEventListener('close', once);
    if (dlg.returnValue !== 'ok') return;
    const picked = [...list.querySelectorAll('input:checked')].map((c) => c.value);
    mutateCurrent((form) => { form.attributes = picked; });
  });
}

// ─── New-form flow ───────────────────────────────────────────────────────────
document.querySelector('.btn-new-form')?.addEventListener('click', openNewFormModal);

function openNewFormModal() {
  const dlg = document.getElementById('new-form-modal');
  const nameEl = document.getElementById('new-name');
  const slugEl = document.getElementById('new-slug');
  const sportEl = document.getElementById('new-sport');
  nameEl.value = '';
  slugEl.value = '';
  sportEl.value = state.sports[0] || 'general';

  // Auto-derive slug from name
  nameEl.oninput = () => { slugEl.value = slugify(nameEl.value); };

  dlg.showModal();
  dlg.addEventListener('close', async function once() {
    dlg.removeEventListener('close', once);
    if (dlg.returnValue !== 'ok') return;
    const name = nameEl.value.trim();
    const slug = slugEl.value.trim();
    const sport = sportEl.value;
    if (!name || !slug) return;
    if (state.forms.some((f) => f.slug === slug)) {
      alert(`Slug "${slug}" is taken. Pick another.`);
      return;
    }
    const nowIso = new Date().toISOString();
    state.forms.push({
      slug, name, description: '',
      sport, rosterId: '',
      status: 'draft',
      publishedAt: null, archivedAt: null,
      currentVersion: null,
      attributes: [],
      sentiments: ['+','=','-'],
      metricInputs: [],
      versions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await saveImmediate();
    location.hash = `#draft/${slug}`;
  });
}

// ─── Hash routing ────────────────────────────────────────────────────────────
function bindHashRouting() {
  window.addEventListener('hashchange', applyHash);
}

function applyHash() {
  const h = location.hash.slice(1); // strip '#'

  if (!h) {
    state.selectedSlug = null;
    renderList();
    renderEditor();
    return;
  }

  if (h === 'new') {
    state.selectedSlug = null;
    renderEditor();
    openNewFormModal();
    return;
  }

  const [statusHint, slug] = h.split('/');
  if (!slug) {
    location.hash = '';
    return;
  }

  const form = state.forms.find((f) => f.slug === slug);
  if (!form) {
    console.warn('Form not found for hash:', h);
    location.hash = '';
    return;
  }

  // URL status mismatch → silent rewrite (status field is the source of truth)
  if (statusHint && statusHint !== form.status) {
    location.replace(`#${form.status}/${slug}`);
    return;
  }

  state.selectedSlug = slug;
  renderList();
  renderEditor();

  // Switch mobile tab to editor if we're below the breakpoint
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.querySelector('.tab-btn[data-tab="editor"]')?.click();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function currentForm() {
  return state.forms.find((f) => f.slug === state.selectedSlug) || null;
}

function setField(field, value) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (!el) return;
  if (el.value !== value) el.value = value;
}

function setMeta(key, value) {
  const el = document.querySelector(`[data-meta="${key}"]`);
  if (el) el.textContent = value || '—';
}
function toggleMetaRow(key, visible) {
  const row = document.querySelector(`[data-meta-row="${key}"]`);
  if (row) row.toggleAttribute('hidden', !visible);
}

function show(selector, visible) {
  const el = document.querySelector(selector);
  if (el) el.hidden = !visible;
}

function formatIso(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch { return iso; }
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
