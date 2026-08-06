/* ==========================================================================
   config.js — app-wide constants. Change these, nothing else, to retune
   the map's default view or data source path.
   ========================================================================== */

export const CONFIG = {
  DATA_URL: 'data/properties.json',

  // Default map view — centered on Lake Burton, Rabun County, GA
  MAP_CENTER: [34.8225, -83.545],
  MAP_ZOOM: 13,
  MAP_MIN_ZOOM: 10,
  MAP_MAX_ZOOM: 19,

  TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',

  // Zoom level to fly to when a property is selected (individual marker level)
  SELECT_ZOOM: 16,

  CLUSTER_RADIUS: 60,
  CLUSTER_MAX_ZOOM: 15, // stop clustering above this zoom so individual pins are selectable

  MOBILE_BREAKPOINT: 900,

  PANEL_WIDTH_STORAGE_KEY: 'lb-directory-panel-width',
};
