# Lake Burton Property Directory (v2 — real interactive map)

A production-ready, data-driven property directory built on a real
interactive map (Leaflet + OpenStreetMap), with marker clustering, a
resizable details panel, and a mobile bottom sheet.

Every property lives in `data/properties.json` — nothing about a specific
property is hardcoded anywhere in the code.

---

## What changed from v1

| | v1 | v2 |
|---|---|---|
| Map | Static scanned image with pixel `x`/`y` pins | Real interactive map (OpenStreetMap tiles via Leaflet) with true `lat`/`lng` |
| Pins | Large, ripple animation | ~50% smaller, flat modern marker, clustered at low zoom |
| Layout | Fixed-width side panel | Map ~70–75% of screen, **resizable** panel divider |
| Mobile | Panel hidden, basic bottom sheet | Full-screen map, touch-tuned bottom sheet, large tap targets |
| Selection | Highlight/dim only | Smooth fly-to + auto-expand cluster + highlight/dim |
| Search | Live list filter | Type-ahead dropdown; picking a result zooms, highlights, and opens the profile |
| Code | One large `app.js` | Split into `config.js`, `dataStore.js`, `mapController.js`, `uiController.js`, `app.js` |
| Scale | Fine for dozens | Marker clustering + array filtering designed to hold up at hundreds–thousands |

## 1. Project structure

```
lake-burton-directory/
├── index.html              # page shell — loads Leaflet/marker-cluster from CDN
├── css/
│   └── styles.css          # all styling / design tokens
├── js/
│   ├── config.js            # map defaults, tuning constants
│   ├── dataStore.js         # loads/filters/searches property data
│   ├── mapController.js     # Leaflet map, clustering, markers, selection
│   ├── uiController.js      # panels, search dropdown, filters, resize, mobile sheet
│   └── app.js                # wires the three modules together
├── data/
│   └── properties.json      # <-- THIS is the only file you edit to add properties
└── README.md
```

You were also given a second file, **`Lake Burton Property Directory.html`**
— a single self-contained file with the same code and data bundled inline.
Open that one directly (double-click it) for a zero-setup, zero-server
experience; use the folder version if you want to edit the code or the
data as separate files going forward.

## 2. Running the folder version locally

The folder version loads `data/properties.json` with `fetch()`, so open it
through a local server rather than double-clicking `index.html`:

```bash
cd lake-burton-directory
python3 -m http.server 8000
```

Then visit **http://localhost:8000**. (Any static server works — this is
only needed for the folder version; the standalone `.html` file needs
nothing at all.)

Both versions need an internet connection — the map tiles, fonts, and
mapping libraries load from OpenStreetMap/CDN, the same way Google Maps
would.

## 3. Adding a new property — edit only the JSON

Add another object to the `properties` array in `data/properties.json`
(folder version) — for the standalone file, the same array sits near the
top of the file inside a `PROPERTY_DATA` block. Either way, nothing else
needs to change.

```json
{
  "id": "LB09 081 L",
  "accountNumber": "LB09 081 L",
  "title": "764 CHEROKEE - LB 352",
  "lat": 34.7993323,
  "lng": -83.551436,
  "locationApproximate": false,
  "propertyLink": "https://beacon.schneidercorp.com/Application.aspx?...",
  "taxHistoryLink": "https://rabuncountyga.governmentwindow.com/select_bill.html?...",
  "taxStatus": "Fully Paid",
  "propertyValue": 130435,
  "owner": {
    "names": ["TENCH THERESA LYNN BARNETT", "BARNETT LARRY DOUGLAS"],
    "mailingAddress": "135 HUNTERS RUN, DEMOREST, GA 30535",
    "phones": ["(706) 580-3961", "(706) 754-4778"],
    "emails": []
  },
  "salesHistory": [
    { "saleDate": "6/14/2011", "deedBookPage": "612/188", "salePrice": "$118,000",
      "grantor": "HOGG ISLAND HOLDINGS LLC", "grantee": "BARNETT LARRY DOUGLAS" }
  ],
  "relatives": [
    { "name": "MARCUS TENCH", "age": "73", "relationship": "Spouse",
      "address": "135 HUNTERS RUN, DEMOREST, GA, 30535", "phones": ["(706) 968-1818"] }
  ],
  "notes": "optional — free-text research notes, shown as a callout on the profile"
}
```

### Field reference

| Field | Type | Notes |
|---|---|---|
| `id` | string | Must be unique. Recommended: the county account number. |
| `accountNumber` | string | Shown in the profile header. |
| `title` | string | The address label shown on hover, in the list, and as the profile heading. |
| `lat`, `lng` | number | **Real GPS coordinates**, decimal degrees. |
| `locationApproximate` | boolean | Optional. Set `true` if you don't have a confirmed address and estimated the pin — the profile shows a small disclaimer. |
| `propertyLink` | string (URL) | Official county record. Opens in a new tab wherever the address appears. |
| `taxHistoryLink` | string (URL) | Optional. County tax-bill page, shown as "View tax bill" if present. |
| `photos` | array of strings (URLs) | Optional. Property photos. The first one is the hero banner at the top of the profile; any additional ones appear in the "Photos & Documents" gallery. Each entry should be a relative path into `images/<slug>/` (see below), a normal `https://` URL, or (rare, avoid for new entries) a `data:image/...;base64,...` string. |
| `documents` | array of `{ "label": string, "url": string }` | Optional. Scanned deed pages or other documents, shown as a labeled thumbnail gallery — click one to open it full-size in the built-in viewer. Same URL rules as `photos`. |

### Images live as real files, not embedded text

Every property's photos and deed pages are stored as actual `.jpg` files under
`images/<slug>/`, where `<slug>` is the property's `id` with spaces replaced
by hyphens (e.g. id `"LB07 120 L"` → folder `images/LB07-120-L/`). Inside
that folder, files are named `photo-1.jpg`, `photo-2.jpg`, ... and
`deed-1.jpg`, `deed-2.jpg`, .... The JSON then just points at them:

```json
"photos": ["images/LB07-120-L/photo-1.jpg", "images/LB07-120-L/photo-2.jpg"],
"documents": [
  { "label": "Deed — Page 1 of 12", "url": "images/LB07-120-L/deed-1.jpg" }
]
```

This keeps `properties.json` (and the standalone `index.html`) small no
matter how many properties get added — only the `images/` folder grows.
When adding a new property, save its photos/deeds into a new
`images/<slug>/` folder using that same naming pattern, then reference
them the same way in the JSON. Rotate any sideways-scanned deed pages to
portrait before saving them — nearly every scan from this source needs a
90° clockwise rotation to read correctly.
| `taxStatus` | `"Fully Paid"` \| `"Tax Delinquent"` | Drives pin color and the status filter. |
| `propertyValue` | number | Used for display and the value-range filter. |
| `owner.names` / `.mailingAddress` / `.phones` / `.emails` | array / string / array / array | Leave arrays as `[]` if none. |
| `salesHistory` | array of objects | Each: `saleDate`, `deedBookPage`, `salePrice`, `grantor`, `grantee`. |
| `relatives` | array of objects | Each: `name`, `age`, `relationship`, `address`, `phones` (array). |
| `notes` | string | Optional. Free-text research note, shown as a callout on the profile. |

**No coordinates yet?** Leave `lat`/`lng` out entirely (or set them to
`null`). The property still appears in the search bar, the directory
list, and every filter — it just won't get a pin until you add real
coordinates later. Nothing else needs to change when you do.

You can add hundreds or thousands of properties this way — the map,
clustering, search, and filters all scale automatically.

### Finding coordinates for a new property

Search the address on Google Maps or OpenStreetMap, right-click the pin,
and copy the coordinates shown (e.g. "34.799332, -83.551436") — the first
number is `lat`, the second is `lng`.

## 4. Features included

- **Real interactive map** — OpenStreetMap tiles via Leaflet (no API key
  needed, unlike Google Maps JavaScript API, which requires the account
  owner to set up billing). Full pan, pinch-to-zoom, mouse-wheel zoom,
  smooth fly-to animation.
- **Marker clustering** — nearby pins group into a numbered cluster at
  low zoom and split apart as you zoom in, so the map stays legible with
  a handful of properties or several thousand.
- **Compact, modern pins** — about half the size of v1, color-coded by
  tax status, with a hover lift and a highlighted/dimmed state when one
  is selected.
- **Resizable side panel** (desktop) — drag the divider between the map
  and the panel; your chosen width is remembered on reload.
- **Mobile-first responsive layout** — full-screen map, large touch
  targets, a bottom sheet for the property profile, no horizontal
  overflow.
- **Search with type-ahead** — matches address, account number, owner
  name, or phone number; picking a result flies to the pin, highlights
  it, and opens the profile automatically.
- **Filters** for tax status and property value range, live-updating the
  map, the list, and the result count together.
- **Full property profile** — Property Information (with the address
  linking to the official county record, plus a tax-history link when
  available), Owner Information, Sales History table, and Possible
  Relatives as expandable cards.

## 5. Notes on each property

Every property profile has a **Notes** box at the bottom — free text plus
a **Save Note** button. Click Save and it's written to your browser's
local storage, keyed to that property; the box stays open afterward so
you can keep typing and save again anytime. Notes reload automatically
the next time you open that property, even after closing and reopening
the file, as long as you're using the same browser on the same device.

**Important — this is per-browser, per-device storage, not a shared
database:**
- Notes you save in Safari on your iPhone won't show up in Chrome on
  your laptop, and vice versa — there's no server behind this, so
  nothing syncs between devices or browsers.
- Clearing your browser's history/site data will erase saved notes.
- If a save ever fails (e.g. private/incognito browsing blocking
  storage), the status next to the button will say so plainly instead
  of pretending it worked.

If you want notes that sync across devices or that Charley can also see,
that needs a real backend (a small database + login) — let me know if
that's worth building out.

## 6. Code organization

- `config.js` — every tunable constant (map center/zoom, tile URL,
  cluster radius, breakpoints) in one place.
- `dataStore.js` — owns the property array; all filtering/search logic.
  No DOM code.
- `mapController.js` — owns the Leaflet map and markers. Only talks to
  the outside world through a single `onPinClick(id)` callback.
- `uiController.js` — owns every panel, the search dropdown, the filter
  drawer, the resize handle, and the notes box. Only talks out through
  `onSelect(id)`.
- `app.js` — the only file that wires the above three together. If you
  need to change *what* happens when a pin is clicked, this is the file
  to look at; if you need to change *how* something looks or is stored,
  it's in one of the other three.

## 7. Customizing look & feel

Design tokens (colors, fonts, spacing, panel width limits) live at the
top of `css/styles.css` under `:root`.
