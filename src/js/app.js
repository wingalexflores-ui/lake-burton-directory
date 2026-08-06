/* ==========================================================================
   app.js — composition root. Instantiates the three modules and connects
   their callbacks. No rendering logic lives here.
   ========================================================================== */

import { DataStore } from './dataStore.js';
import { MapController } from './mapController.js';
import { UIController } from './uiController.js';

async function main() {
  const store = new DataStore();

  const select = (id) => {
    if (id) {
      const property = store.getById(id);
      if (!property) return;
      ui.showProfile(property);
      map.select(id);
    } else {
      ui.showDirectory();
      map.clearSelection();
    }
  };

  const map = new MapController('map', select);
  const ui = new UIController(store, select);

  ui.onFiltersChanged = () => refresh();
  ui.onResize = () => map.invalidateSize();
  ui.onNotesChanged = () => refresh();

  function refresh() {
    const query = ui.els.searchInput.value.trim();
    const visible = store.getVisible(query);
    const visibleIds = visible.map(p => p.id);
    map.setVisibleIds(visibleIds);
    ui.renderDirectory(visible);
    ui.updateResultCount(visible.length, store.properties.length);
  }

  try {
    await store.load();
  } catch (err) {
    console.error(err);
    document.getElementById('directoryList').innerHTML =
      `<li class="muted-note" style="padding:12px 4px; list-style:none;">Could not load property data. If you opened this file directly in a browser, run a local server instead (see README.md) — browsers block JSON file:// requests.</li>`;
    return;
  }

  map.renderMarkers(store.mappable);
  refresh();

  window.addEventListener('resize', () => map.invalidateSize());
}

main();
