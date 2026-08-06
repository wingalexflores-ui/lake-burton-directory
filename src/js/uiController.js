/* ==========================================================================
   uiController.js — everything that touches the DOM outside the map itself:
   the directory list, the property profile panel, the search dropdown, the
   filter drawer, the resizable divider, and the mobile bottom sheet.
   ========================================================================== */

import { CONFIG } from './config.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function fmtCurrency(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function statusClass(status) {
  return status === 'Tax Delinquent' ? 'delinquent' : 'paid';
}

export class UIController {
  /**
   * @param {import('./dataStore.js').DataStore} store
   * @param {(id: string|null) => void} onSelect - called with a property id (or null to clear)
   */
  constructor(store, onSelect) {
    this.store = store;
    this.onSelect = onSelect;
    this.activeId = null;
    this._notesMemory = {}; // in-session fallback if localStorage is unavailable/blocked
    this._storageOk = this._testStorage();

    this.els = {
      searchInput: document.getElementById('searchInput'),
      searchResults: document.getElementById('searchResults'),
      searchCount: document.getElementById('searchCount'),
      filterToggle: document.getElementById('filterToggle'),
      filterDrawer: document.getElementById('filterDrawer'),
      filterClear: document.getElementById('filterClear'),
      valueMin: document.getElementById('valueMin'),
      valueMax: document.getElementById('valueMax'),
      statusChecks: document.querySelectorAll('.filter-status'),
      directoryPanel: document.getElementById('directoryPanel'),
      directoryList: document.getElementById('directoryList'),
      profilePanel: document.getElementById('profilePanel'),
      sidePanel: document.getElementById('sidePanel'),
      resizeHandle: document.getElementById('resizeHandle'),
      mapResultCount: document.getElementById('mapResultCount'),
      exportNotesBtn: document.getElementById('exportNotesBtn'),
      importNotesBtn: document.getElementById('importNotesBtn'),
      importNotesFile: document.getElementById('importNotesFile'),
      myNotesToggle: document.getElementById('myNotesToggle'),
      myNotesOverlay: document.getElementById('myNotesOverlay'),
      myNotesClose: document.getElementById('myNotesClose'),
      myNotesList: document.getElementById('myNotesList'),
    };

    this._wireSearch();
    this._wireFilters();
    this._wireResize();
    this._wireNotesBackup();
    this._wireMyNotes();
  }

  _testStorage() {
    try {
      const k = '__lb_storage_test__';
      localStorage.setItem(k, '1');
      const ok = localStorage.getItem(k) === '1';
      localStorage.removeItem(k);
      return ok;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------- search
  _wireSearch() {
    const { searchInput, searchResults } = this.els;

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      if (!q) { searchResults.classList.remove('open'); searchResults.innerHTML = ''; return; }
      const results = this.store.search(q, 20);
      this._renderSearchResults(results);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        const [first] = this.store.search(q, 1);
        if (first) this._chooseResult(first.id);
      } else if (e.key === 'Escape') {
        searchResults.classList.remove('open');
        searchInput.blur();
      }
    });

    document.addEventListener('click', (e) => {
      if (!searchResults.contains(e.target) && e.target !== searchInput) {
        searchResults.classList.remove('open');
      }
    });
  }

  _renderSearchResults(results) {
    const { searchResults } = this.els;
    if (!results.length) {
      searchResults.innerHTML = `<div class="search-results-empty">No matches</div>`;
      searchResults.classList.add('open');
      return;
    }
    searchResults.innerHTML = results.map(p => `
      <button class="search-result-item" data-id="${escapeHtml(p.id)}">
        <div class="sr-title">${escapeHtml(p.title)}</div>
        <div class="sr-meta">${escapeHtml(p.accountNumber)} · ${escapeHtml((p.owner?.names || [])[0] || '')}</div>
      </button>
    `).join('');
    searchResults.querySelectorAll('.search-result-item').forEach(btn => {
      btn.addEventListener('click', () => this._chooseResult(btn.dataset.id));
    });
    searchResults.classList.add('open');
  }

  _chooseResult(id) {
    this.els.searchResults.classList.remove('open');
    this.els.searchInput.value = '';
    this.onSelect(id); // zoom + highlight + open profile, per spec
  }

  // ---------------------------------------------------------------- filters
  _wireFilters() {
    const { filterToggle, filterDrawer, statusChecks, valueMin, valueMax, filterClear } = this.els;

    filterToggle.addEventListener('click', () => {
      filterDrawer.classList.toggle('open');
      filterToggle.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (!filterDrawer.contains(e.target) && !filterToggle.contains(e.target)) {
        filterDrawer.classList.remove('open');
        filterToggle.classList.remove('active');
      }
    });

    statusChecks.forEach(cb => cb.addEventListener('change', () => {
      const checked = [...this.els.statusChecks].filter(c => c.checked).map(c => c.value);
      this.store.setStatusFilter(checked);
      this.onFiltersChanged?.();
    }));

    [valueMin, valueMax].forEach(input => input.addEventListener('input', () => {
      this.store.setValueRange(valueMin.value, valueMax.value);
      this.onFiltersChanged?.();
    }));

    filterClear.addEventListener('click', () => {
      this.els.statusChecks.forEach(cb => cb.checked = true);
      valueMin.value = ''; valueMax.value = '';
      this.store.resetFilters();
      this.onFiltersChanged?.();
    });
  }

  // ---------------------------------------------------------------- resize
  _wireResize() {
    const { resizeHandle, sidePanel } = this.els;
    if (!resizeHandle) return;

    let dragging = false;

    const startDrag = (clientX) => {
      dragging = true;
      resizeHandle.classList.add('dragging');
      document.body.style.userSelect = 'none';
    };
    const drag = (clientX) => {
      if (!dragging) return;
      const newWidth = window.innerWidth - clientX;
      const min = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-min'));
      const max = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-max'));
      const clamped = Math.min(max, Math.max(min, newWidth));
      document.documentElement.style.setProperty('--panel-width', `${clamped}px`);
      this.onResize?.();
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      resizeHandle.classList.remove('dragging');
      document.body.style.userSelect = '';
      try {
        const width = getComputedStyle(document.documentElement).getPropertyValue('--panel-width');
        localStorage.setItem(CONFIG.PANEL_WIDTH_STORAGE_KEY, width.trim());
      } catch (_) { /* storage unavailable — non-fatal */ }
    };

    resizeHandle.addEventListener('mousedown', (e) => { startDrag(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => drag(e.clientX));
    window.addEventListener('mouseup', endDrag);

    resizeHandle.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchmove', (e) => drag(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchend', endDrag);

    // restore a saved width
    try {
      const saved = localStorage.getItem(CONFIG.PANEL_WIDTH_STORAGE_KEY);
      if (saved) document.documentElement.style.setProperty('--panel-width', saved);
    } catch (_) { /* ignore */ }
  }

  // ---------------------------------------------------------------- directory
  renderDirectory(properties) {
    const { directoryList } = this.els;
    const sorted = [...properties].sort((a, b) => a.title.localeCompare(b.title));
    const notedIds = new Set(Object.keys(this._allSavedNotes()));
    directoryList.innerHTML = sorted.map(p => `
      <li>
        <button class="directory-item" data-id="${escapeHtml(p.id)}">
          <div class="di-title">${escapeHtml(p.title)} ${notedIds.has(p.id) ? '<span class="note-dot" title="Has a saved note">📝</span>' : ''}</div>
          <div class="di-meta">
            <span>${escapeHtml(p.accountNumber)}</span>
          </div>
        </button>
      </li>
    `).join('') || `<li class="muted-note" style="padding:12px 4px; list-style:none;">No properties match your filters.</li>`;

    directoryList.querySelectorAll('.directory-item').forEach(btn => {
      btn.addEventListener('click', () => this.onSelect(btn.dataset.id));
    });
  }

  updateResultCount(count, total) {
    this.els.searchCount.textContent = '';
    if (this.els.mapResultCount) {
      this.els.mapResultCount.textContent = count === total
        ? `${total} propert${total === 1 ? 'y' : 'ies'}`
        : `${count} of ${total} properties`;
    }
  }

  // ---------------------------------------------------------------- selection / panels
  showDirectory() {
    this.activeId = null;
    this.els.directoryPanel.style.display = 'block';
    this.els.profilePanel.style.display = 'none';
    this._setMobileSheet(this.els.directoryPanel, false);
  }

  showProfile(property) {
    this.activeId = property.id;
    this._renderProfile(property);
    this.els.directoryPanel.style.display = 'none';
    this.els.profilePanel.style.display = 'block';
    this._setMobileSheet(this.els.profilePanel, true);
  }

  _setMobileSheet(panelEl, open) {
    if (window.innerWidth > CONFIG.MOBILE_BREAKPOINT) return;
    document.querySelectorAll('.side-panel .directory-panel, .side-panel .profile-panel')
      .forEach(p => p.classList.remove('sheet-open'));
    if (open) panelEl.classList.add('sheet-open');
    this.els.sidePanel.classList.toggle('sheet-open', open);
  }

  _renderProfile(p) {
    const chip = `<span class="status-chip ${statusClass(p.taxStatus)}">${escapeHtml(p.taxStatus)}</span>`;

    const ownerNames = (p.owner?.names || []).map(n => escapeHtml(n)).join('<br>') || '—';
    const phones = (p.owner?.phones || []);
    const phonesHtml = phones.length
      ? `<ul class="phone-list">${phones.map(ph => `<li>${escapeHtml(ph)}</li>`).join('')}</ul>`
      : `<span class="muted-note">None on file</span>`;
    const emails = (p.owner?.emails || []);
    const emailsHtml = emails.length
      ? `<ul class="email-list">${emails.map(em => `<li>${escapeHtml(em)}</li>`).join('')}</ul>`
      : `<span class="muted-note">None</span>`;

    const salesRows = (p.salesHistory || []).map(s => `
      <tr>
        <td>${escapeHtml(s.saleDate)}</td>
        <td>${escapeHtml(s.deedBookPage)}</td>
        <td class="price">${escapeHtml(s.salePrice)}</td>
        <td>${escapeHtml(s.grantor)}</td>
        <td>${escapeHtml(s.grantee)}</td>
      </tr>`).join('');

    const salesTable = (p.salesHistory && p.salesHistory.length)
      ? `<table class="sales-table">
           <thead><tr><th>Sale Date</th><th>Deed Book/Page</th><th>Sale Price</th><th>Grantor</th><th>Grantee</th></tr></thead>
           <tbody>${salesRows}</tbody>
         </table>`
      : `<span class="muted-note">No sales history on file</span>`;

    const relativeCards = (p.relatives || []).map(r => `
      <details class="relative-card">
        <summary>${escapeHtml(r.name)} <span class="rel-sub">${escapeHtml(r.relationship || '')}</span></summary>
        <div class="rel-body">
          <dl>
            <dt>Age</dt><dd>${escapeHtml(r.age || '—')}</dd>
            <dt>Relationship</dt><dd>${escapeHtml(r.relationship || '—')}</dd>
            <dt>Address</dt><dd>${escapeHtml(r.address || '—')}</dd>
            <dt>Phone(s)</dt><dd>${(r.phones && r.phones.length) ? r.phones.map(escapeHtml).join('<br>') : '—'}</dd>
          </dl>
        </div>
      </details>`).join('');

    const relativesHtml = (p.relatives && p.relatives.length) ? relativeCards : `<span class="muted-note">None on file</span>`;

    const approxNote = p.locationApproximate
      ? `<div class="approx-note">Map location is approximate — no exact address on file.</div>`
      : '';

    const photoThumbs = (p.photos || []).slice(1).map((url, i) => `
      <button type="button" class="gallery-thumb" data-full="${escapeHtml(url)}" data-caption="${escapeHtml(p.title)} — photo ${i + 2}">
        <img src="${escapeHtml(url)}" alt="Photo ${i + 2} of ${escapeHtml(p.title)}">
      </button>`).join('');

    const documentThumbs = (p.documents || []).map((d, i) => `
      <button type="button" class="gallery-thumb doc-thumb" data-full="${escapeHtml(d.url)}" data-caption="${escapeHtml(d.label || `Document ${i + 1}`)}">
        <img src="${escapeHtml(d.url)}" alt="${escapeHtml(d.label || `Document ${i + 1}`)}">
        <span class="doc-label">${escapeHtml(d.label || `Page ${i + 1}`)}</span>
      </button>`).join('');

    const hasMorePhotos = p.photos && p.photos.length > 1;
    const hasDocs = p.documents && p.documents.length;

    const photosDocsSection = (hasMorePhotos || hasDocs) ? `
        <section class="p-section">
          <h3>Photos &amp; Documents</h3>
          ${hasMorePhotos ? `<div class="gallery-grid">${photoThumbs}</div>` : ''}
          ${hasDocs ? `<div class="gallery-label">Deed — ${p.documents.length} page${p.documents.length === 1 ? '' : 's'}</div><div class="gallery-grid">${documentThumbs}</div>` : ''}
        </section>` : '';

    this.els.profilePanel.innerHTML = `
      <div class="profile-header">
        <button class="back-btn" id="profileBackBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg>
          Back to directory
        </button>
        ${(p.photos && p.photos[0]) ? `<button type="button" class="profile-hero-link" data-full="${escapeHtml(p.photos[0])}" data-caption="${escapeHtml(p.title)}"><img class="profile-hero-photo" src="${escapeHtml(p.photos[0])}" alt="Photo of ${escapeHtml(p.title)}"></button>` : ''}
        <div class="profile-title-row">
          <div class="profile-title-text">
            <span class="eyebrow">Account No. ${escapeHtml(p.accountNumber)}</span>
            <h2><a class="property-link" href="${escapeHtml(p.propertyLink)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(p.title)}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </a></h2>
            ${approxNote}
          </div>
        </div>
      </div>
      <div class="profile-body">

        <section class="p-section notes-section-top">
          <h3>Notes</h3>
          <div class="notes-log" id="notesLog">${this._renderNotesLog(this._loadEntries(p.id))}</div>
          <textarea class="notes-textarea" id="notesTextarea" placeholder="Add a new note — call outcomes, follow-ups, anything worth remembering…"></textarea>
          <div class="notes-actions">
            <button class="notes-save-btn" id="notesSaveBtn">Add Note</button>
            <span class="notes-status" id="notesStatus"></span>
          </div>
        </section>

        <section class="p-section">
          <h3>Property Information</h3>
          <dl class="kv-grid">
            <dt>Account No.</dt><dd>${escapeHtml(p.accountNumber)}</dd>
            <dt>Address</dt><dd><a class="property-link" href="${escapeHtml(p.propertyLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title)}</a></dd>
            <dt>Tax Status</dt><dd>${chip}</dd>
            <dt>Property Value</dt><dd class="value-figure">${fmtCurrency(p.propertyValue)}</dd>
            ${p.taxHistoryLink ? `<dt>Tax History</dt><dd><a class="property-link" href="${escapeHtml(p.taxHistoryLink)}" target="_blank" rel="noopener noreferrer">View tax bill</a></dd>` : ''}
          </dl>
          ${p.notes ? `<div class="notes-callout">${escapeHtml(p.notes)}</div>` : ''}
        </section>

        <section class="p-section">

          <h3>Owner Information</h3>
          <dl class="kv-grid">
            <dt>Owner(s)</dt><dd>${ownerNames}</dd>
            <dt>Mailing Address</dt><dd>${escapeHtml(p.owner?.mailingAddress || '—')}</dd>
            <dt>Phone Numbers</dt><dd>${phonesHtml}</dd>
            <dt>Emails</dt><dd>${emailsHtml}</dd>
          </dl>
        </section>

        <section class="p-section">
          <h3>Sales History</h3>
          ${salesTable}
        </section>

        <section class="p-section">
          <h3>Possible Relatives</h3>
          ${relativesHtml}
        </section>

        ${photosDocsSection}

      </div>
    `;

    document.getElementById('profileBackBtn').addEventListener('click', () => this.onSelect(null));
    this._wireNotes(p.id);
    this._wireLightboxTriggers();
  }

  _wireLightboxTriggers() {
    this.els.profilePanel.querySelectorAll('[data-full]').forEach(el => {
      el.addEventListener('click', () => this._openLightbox(el.dataset.full, el.dataset.caption || ''));
    });
  }

  _openLightbox(url, caption) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    const safeCaption = caption ? caption.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') : '';
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="Close">&times;</button>
      <img src="${url}" alt="${safeCaption || 'Full-size view'}">
      ${safeCaption ? `<div class="lightbox-caption">${safeCaption}</div>` : ''}
    `;
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.lightbox-close').addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------- notes (saved locally in this browser)
  _noteKey(id) {
    return `lb-directory-note:${id}`;
  }

  /** Always updates the in-memory copy; also tries localStorage and reports whether that part actually worked. */
  _saveRaw(id, rawString) {
    this._notesMemory[id] = rawString;
    if (!this._storageOk) return { ok: true, persisted: false };
    try {
      localStorage.setItem(this._noteKey(id), rawString);
      const readBack = localStorage.getItem(this._noteKey(id));
      return { ok: true, persisted: readBack === rawString };
    } catch (_) {
      return { ok: true, persisted: false };
    }
  }

  /** Parses a stored raw string into an array of {text, time} entries. Understands the old
   *  single-string format (pre-notepad-log) and upgrades it into a single entry on the fly. */
  _parseEntries(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(e => e && e.text);
    } catch (_) { /* not JSON — must be a legacy plain-string note */ }
    return [{ text: raw, time: null }];
  }

  _loadEntries(id) {
    const raw = Object.prototype.hasOwnProperty.call(this._notesMemory, id)
      ? this._notesMemory[id]
      : (() => { try { return localStorage.getItem(this._noteKey(id)) || ''; } catch (_) { return ''; } })();
    return this._parseEntries(raw);
  }

  /** Appends a new entry to this property's log — never overwrites earlier entries. */
  _addEntry(id, text) {
    const entries = this._loadEntries(id);
    entries.push({ text, time: new Date().toISOString() });
    const result = this._saveRaw(id, JSON.stringify(entries));
    return { ...result, entries };
  }

  _allSavedNotes() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lb-directory-note:')) {
          const id = key.slice('lb-directory-note:'.length);
          const val = localStorage.getItem(key);
          if (val) out[id] = val;
        }
      }
    } catch (_) { /* storage unavailable — memory copy below still covers this session */ }
    Object.assign(out, this._notesMemory); // session edits win over a possibly-stale storage read
    // drop empties
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  }

  _wireNotesBackup() {
    const { exportNotesBtn, importNotesBtn, importNotesFile } = this.els;
    if (!exportNotesBtn) return;

    exportNotesBtn.addEventListener('click', () => {
      const notes = this._allSavedNotes();
      const titled = {};
      Object.entries(notes).forEach(([id, raw]) => {
        const p = this.store.getById(id);
        titled[id] = { title: p ? p.title : id, entries: this._parseEntries(raw) };
      });
      const blob = new Blob([JSON.stringify(titled, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `lake-burton-notes-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    importNotesBtn?.addEventListener('click', () => importNotesFile?.click());
    importNotesFile?.addEventListener('change', () => {
      const file = importNotesFile.files && importNotesFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          let count = 0;
          Object.entries(parsed).forEach(([id, entry]) => {
            // accept the current {entries:[...]} export format, and older single-note exports too
            const incoming = Array.isArray(entry?.entries)
              ? entry.entries.filter(e => e && e.text)
              : (entry?.note ? [{ text: entry.note, time: null }] : []);
            if (!incoming.length) return;
            const existing = this._loadEntries(id);
            const existingTexts = new Set(existing.map(e => `${e.time || ''}|${e.text}`));
            const merged = existing.concat(incoming.filter(e => !existingTexts.has(`${e.time || ''}|${e.text}`)));
            this._saveRaw(id, JSON.stringify(merged));
            count++;
          });
          // if the currently open profile is one of the imported notes, refresh its log live
          const log = document.getElementById('notesLog');
          if (log && this.activeId && parsed[this.activeId]) {
            log.innerHTML = this._renderNotesLog(this._loadEntries(this.activeId));
          }
          this.onNotesChanged?.();
          alert(`Imported notes for ${count} propert${count === 1 ? 'y' : 'ies'}.`);
        } catch (err) {
          alert('Could not read that file — make sure it\'s a notes export from this app.');
        }
        importNotesFile.value = '';
      };
      reader.readAsText(file);
    });
  }

  _wireMyNotes() {
    const { myNotesToggle, myNotesOverlay, myNotesClose, myNotesList } = this.els;
    if (!myNotesToggle) return;

    const open = () => {
      this._renderMyNotesList();
      myNotesOverlay.style.display = 'flex';
    };
    const close = () => { myNotesOverlay.style.display = 'none'; };

    myNotesToggle.addEventListener('click', open);
    myNotesClose.addEventListener('click', close);
    myNotesOverlay.addEventListener('click', (e) => { if (e.target === myNotesOverlay) close(); });
  }

  _renderMyNotesList() {
    const notes = this._allSavedNotes();
    const rows = Object.entries(notes)
      .map(([id, raw]) => ({ id, entries: this._parseEntries(raw), property: this.store.getById(id) }))
      .filter(e => e.property && e.entries.length); // drop orphans and empties

    if (!rows.length) {
      this.els.myNotesList.innerHTML = `<div class="my-notes-empty">No notes saved on this device yet. Open any property and use the Notes box to add one.</div>`;
      return;
    }

    rows.sort((a, b) => a.property.title.localeCompare(b.property.title));

    this.els.myNotesList.innerHTML = rows.map(r => {
      const latest = r.entries[r.entries.length - 1];
      const countLabel = r.entries.length > 1 ? ` · ${r.entries.length} entries` : '';
      return `
      <button class="my-notes-item" data-id="${escapeHtml(r.id)}">
        <div class="mn-title">${escapeHtml(r.property.title)}<span class="mn-count">${countLabel}</span></div>
        <div class="mn-preview">${escapeHtml(latest.text)}</div>
      </button>`;
    }).join('');

    this.els.myNotesList.querySelectorAll('.my-notes-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.els.myNotesOverlay.style.display = 'none';
        this.onSelect(btn.dataset.id);
      });
    });
  }

  _formatEntryTime(iso) {
    if (!iso) return 'Earlier';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Earlier';
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const datePart = sameDay ? 'Today' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${timePart}`;
  }

  _renderNotesLog(entries) {
    if (!entries.length) {
      return `<div class="notes-log-empty">No notes yet — add the first one below.</div>`;
    }
    // newest first
    return [...entries].reverse().map(e => `
      <div class="note-entry">
        <div class="note-entry-time">${escapeHtml(this._formatEntryTime(e.time))}</div>
        <div class="note-entry-text">${escapeHtml(e.text)}</div>
      </div>
    `).join('');
  }

  _wireNotes(id) {
    const textarea = document.getElementById('notesTextarea');
    const saveBtn = document.getElementById('notesSaveBtn');
    const status = document.getElementById('notesStatus');
    const log = document.getElementById('notesLog');

    if (!this._storageOk) {
      status.textContent = 'Browser storage unavailable — notes save for this session only. Use Export Notes to keep a permanent copy.';
      status.className = 'notes-status warn';
    }

    saveBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      const result = this._addEntry(id, text);
      log.innerHTML = this._renderNotesLog(result.entries);
      textarea.value = '';
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (result.persisted) {
        status.textContent = `Added ✓ ${time}`;
        status.className = 'notes-status saved';
      } else {
        status.textContent = `Added for this session (${time}) — browser storage is blocked here. Click "Export Notes" above to keep a permanent copy.`;
        status.className = 'notes-status warn';
      }
      this.onNotesChanged?.();
      textarea.focus();
    });
  }
}
