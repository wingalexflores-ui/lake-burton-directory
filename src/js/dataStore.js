/* ==========================================================================
   dataStore.js — single source of truth for property data. Everything here
   is derived from data/properties.json; nothing about a specific property
   is hardcoded.
   ========================================================================== */

import { CONFIG } from './config.js';

export class DataStore {
  constructor() {
    /** @type {Array<object>} */
    this.properties = [];
    this.filters = { statuses: new Set(['Fully Paid', 'Tax Delinquent']), min: null, max: null };
  }

  async load() {
    const res = await fetch(CONFIG.DATA_URL);
    if (!res.ok) throw new Error(`Failed to fetch ${CONFIG.DATA_URL}: ${res.status}`);
    const json = await res.json();
    this.properties = json.properties || [];
    return this.properties;
  }

  /** Properties with valid, mappable coordinates. */
  get mappable() {
    return this.properties.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  /** Properties missing coordinates — still browsable, just not pinned. */
  get unmapped() {
    return this.properties.filter(p => !(Number.isFinite(p.lat) && Number.isFinite(p.lng)));
  }

  getById(id) {
    return this.properties.find(p => p.id === id);
  }

  setStatusFilter(statuses) {
    this.filters.statuses = new Set(statuses);
  }

  setValueRange(min, max) {
    this.filters.min = (min === null || min === '') ? null : Number(min);
    this.filters.max = (max === null || max === '') ? null : Number(max);
  }

  resetFilters() {
    this.filters = { statuses: new Set(['Fully Paid', 'Tax Delinquent']), min: null, max: null };
  }

  passesFilters(p) {
    if (!this.filters.statuses.has(p.taxStatus)) return false;
    const v = Number(p.propertyValue) || 0;
    if (this.filters.min !== null && v < this.filters.min) return false;
    if (this.filters.max !== null && v > this.filters.max) return false;
    return true;
  }

  /** Case-insensitive match across address, account #, owner name(s), and phone numbers. */
  matchesQuery(p, rawQuery) {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return false;
    const haystack = [
      p.title,
      p.accountNumber,
      ...(p.owner?.names || []),
      ...(p.owner?.phones || []),
      ...(p.relatives || []).flatMap(r => r.phones || []),
    ];
    return haystack.some(h => h && String(h).toLowerCase().includes(q));
  }

  /** Full result set after filters + search, used by both the map and the list. */
  getVisible(query = '') {
    return this.properties.filter(p => this.passesFilters(p) && (!query || this.matchesQuery(p, query)));
  }

  search(query, limit = 20) {
    if (!query.trim()) return [];
    return this.properties
      .filter(p => this.passesFilters(p) && this.matchesQuery(p, query))
      .slice(0, limit);
  }
}
