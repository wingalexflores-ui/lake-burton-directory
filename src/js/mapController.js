/* ==========================================================================
   mapController.js — owns the Leaflet map, marker clustering, and the
   visual selection state (active / dimmed pins). No knowledge of the
   panel or search UI lives here; it only exposes callbacks.
   ========================================================================== */

import { CONFIG } from './config.js';

export class MapController {
  /**
   * @param {string} elId - id of the map container element
   * @param {(id: string) => void} onPinClick - called when a pin is clicked
   */
  constructor(elId, onPinClick) {
    this.onPinClick = onPinClick;
    this.markersById = new Map();
    this.activeId = null;

    this.map = L.map(elId, {
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      minZoom: CONFIG.MAP_MIN_ZOOM,
      maxZoom: CONFIG.MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    L.tileLayer(CONFIG.TILE_URL, {
      maxZoom: CONFIG.MAP_MAX_ZOOM,
      attribution: CONFIG.TILE_ATTRIBUTION,
    }).addTo(this.map);

    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: CONFIG.CLUSTER_RADIUS,
      disableClusteringAtZoom: CONFIG.CLUSTER_MAX_ZOOM,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => this._clusterIcon(cluster),
    });
    this.map.addLayer(this.clusterGroup);

    this.map.on('click', () => this.onPinClick(null));
  }

  _clusterIcon(cluster) {
    const count = cluster.getChildCount();
    const sizeClass = count < 10 ? 'size-sm' : count < 30 ? 'size-md' : 'size-lg';
    return L.divIcon({
      html: `<div class="lb-cluster ${sizeClass}"><span>${count}</span></div>`,
      className: '',
      iconSize: null,
    });
  }

  _pinIconHtml(status) {
    return `
      <svg viewBox="0 0 15 19">
        <path class="pin-body" d="M7.5 0C3.36 0 0 3.3 0 7.4 0 12.7 7.5 19 7.5 19S15 12.7 15 7.4C15 3.3 11.64 0 7.5 0Z"></path>
        <circle class="pin-dot" cx="7.5" cy="7.2" r="2.4"></circle>
      </svg>`;
  }

  _statusClass(status) {
    return status === 'Tax Delinquent' ? 'delinquent' : 'paid';
  }

  /**
   * (Re)render every marker from the given property list. Safe to call
   * again if the underlying data set changes (e.g. hot-reload of JSON).
   */
  renderMarkers(properties) {
    this.clusterGroup.clearLayers();
    this.markersById.clear();

    properties.forEach(p => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return; // unmapped — skip pin

      const icon = L.divIcon({
        className: `pin status-${this._statusClass(p.taxStatus)}`,
        html: this._pinIconHtml(p.taxStatus),
        iconSize: [15, 19],
        iconAnchor: [7, 19],
      });

      const marker = L.marker([p.lat, p.lng], { icon, riseOnHover: true });
      marker.bindTooltip(p.title, { direction: 'top', offset: [0, -16], className: 'pin-tooltip' });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.onPinClick(p.id);
      });

      this.markersById.set(p.id, marker);
      this.clusterGroup.addLayer(marker);
    });

    this._applyVisualState();
  }

  /** Show/hide markers according to the visible-id set (from filters/search). */
  setVisibleIds(visibleIds) {
    const visibleSet = new Set(visibleIds);
    this.markersById.forEach((marker, id) => {
      const shouldShow = visibleSet.has(id);
      const hasLayer = this.clusterGroup.hasLayer(marker);
      if (shouldShow && !hasLayer) this.clusterGroup.addLayer(marker);
      if (!shouldShow && hasLayer) this.clusterGroup.removeLayer(marker);
    });
    this._applyVisualState();
  }

  /** Select a property: fly/zoom to it, expand its cluster, highlight it, dim the rest. */
  select(id) {
    this.activeId = id;
    const marker = id ? this.markersById.get(id) : null;

    if (marker) {
      // zoomToShowLayer expands any ancestor cluster and zooms just enough
      // to reveal this specific marker, then fires the callback.
      this.clusterGroup.zoomToShowLayer(marker, () => {
        this.map.flyTo(marker.getLatLng(), Math.max(this.map.getZoom(), CONFIG.SELECT_ZOOM), { duration: 0.6 });
        this._applyVisualState();
      });
    } else {
      this._applyVisualState();
    }
  }

  clearSelection() {
    this.activeId = null;
    this._applyVisualState();
  }

  _applyVisualState() {
    this.markersById.forEach((marker, id) => {
      const el = marker.getElement ? marker.getElement() : (marker._icon || null);
      if (!el) return; // not currently rendered (inside a cluster) — nothing to style
      el.classList.remove('is-active', 'is-dimmed');
      if (this.activeId) {
        el.classList.add(id === this.activeId ? 'is-active' : 'is-dimmed');
      }
    });
  }

  fitToAll() {
    const latLngs = [];
    this.markersById.forEach(m => latLngs.push(m.getLatLng()));
    if (latLngs.length) this.map.fitBounds(L.latLngBounds(latLngs).pad(0.15));
  }

  invalidateSize() {
    this.map.invalidateSize();
  }
}
