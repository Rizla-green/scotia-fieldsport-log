// Scotia Fieldsport Log — map module
// Handles: Leaflet init, Esri satellite tiles, pin layer, boundary/gate layers,
// drawing tools, overview maps

const MapModule = (() => {
  // ── Map instances ──────────────────────────────────────────────────────
  let mainMap = null;        // per-species map (overview tab)
  let overviewShotMap = null;
  let overviewAreaMap = null;

  // ── Layer groups ───────────────────────────────────────────────────────
  let pinLayer      = null;
  let boundaryLayer = null;
  let gateLayer     = null;

  // ── Pin markers ────────────────────────────────────────────────────────
  const pinMarkers = {};     // pinId → L.Marker
  const gateMarkers = {};
  const boundaryPolys = {};

  // ── Leaflet tile layers ────────────────────────────────────────────────
  // Satellite: Google hybrid via open proxy (no key needed)
  const GOOGLE_SAT   = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
  const GOOGLE_HYBRID = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';

  function makeTileLayers() {
    return [
      L.tileLayer(GOOGLE_HYBRID, {
        attribution: '© Google Maps',
        subdomains: ['0','1','2','3'],
        maxZoom: 21
      })
    ];
  }

  // ── Pin icon helper ────────────────────────────────────────────────────
  function pinIcon(colour, initial) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27S34 29.7 34 17C34 7.6 26.4 0 17 0z"
              fill="${colour}" stroke="#fff" stroke-width="1.5"/>
        <text x="17" y="22" text-anchor="middle" fill="#fff"
              font-family="Arial,sans-serif" font-size="13" font-weight="bold">${initial}</text>
      </svg>`;
    return L.divIcon({
      html: svg, className: '', iconSize: [34,44], iconAnchor: [17,44], popupAnchor: [0,-44]
    });
  }

  function gateIcon() {
    return L.divIcon({
      html: `<div class="gate-marker">🔓</div>`,
      className: '', iconSize: [28,28], iconAnchor: [14,14]
    });
  }

  // ── Initialise a map div ───────────────────────────────────────────────
  function initMap(elId, opts = {}) {
    const el = document.getElementById(elId);
    if (!el) return null;
    const m = L.map(elId, {
      center: [MAP_START.lat, MAP_START.lon],
      zoom: opts.zoom || MAP_START.zoom,
      zoomControl: true
    });
    makeTileLayers().forEach(t => t.addTo(m));
    return m;
  }

  // ── Main species map ───────────────────────────────────────────────────
  function initMainMap() {
    if (mainMap) return;
    mainMap = initMap('mainMap');
    if (!mainMap) return;
    pinLayer      = L.layerGroup().addTo(mainMap);
    boundaryLayer = L.layerGroup().addTo(mainMap);
    gateLayer     = L.layerGroup().addTo(mainMap);
    initDrawingTools(mainMap);
  }

  // ── Drawing tools (Leaflet.draw) ───────────────────────────────────────
  let drawnItems = null;
  let currentDrawMode = null; // 'boundary' | 'gate' | null

  function initDrawingTools(map) {
    drawnItems = new L.FeatureGroup().addTo(map);
    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems, remove: true },
      draw: {
        polygon: {
          shapeOptions: { color: '#C8A84B', fillColor: '#C8A84B', fillOpacity: 0.15 },
          showArea: false
        },
        marker: false, polyline: false, rectangle: false, circle: false, circlemarker: false
      }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, async e => {
      const layer = e.layer;
      drawnItems.addLayer(layer);

      if (e.layerType === 'polygon') {
        const latlngs = layer.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng }));
        const name = prompt('Boundary name:') || 'Unnamed';
        const colour = prompt('Colour (hex, e.g. #C8A84B):') || '#C8A84B';
        const id = await DB.saveBoundary({ name, colour, latlngs, createdBy: Auth.currentUser()?.username });
        layer.options.color = colour;
        layer.setStyle({ color: colour, fillColor: colour, fillOpacity: 0.15 });
        boundaryPolys[id] = layer;
        layer.bindPopup(`<b>${name}</b><br><button onclick="MapModule.deleteBoundary('${id}')">Delete</button>`);
      }
    });

    map.on(L.Draw.Event.DELETED, e => {
      // Deletion handled via popup buttons — also handle mass delete
    });
  }

  // ── Gate dropping ──────────────────────────────────────────────────────
  function enableGateDrop() {
    if (!mainMap) return;
    mainMap.once('click', async e => {
      const id = await DB.saveGate({ lat: e.latlng.lat, lng: e.latlng.lng, createdBy: Auth.currentUser()?.username });
      addGateMarker({ id, lat: e.latlng.lat, lng: e.latlng.lng });
    });
    alert('Tap the map to place a gate.');
  }

  function addGateMarker(gate) {
    const m = L.marker([gate.lat, gate.lng], { icon: gateIcon() });
    m.bindPopup(`Gate<br><button onclick="MapModule.deleteGate('${gate.id}')">Delete</button>`);
    gateLayer.addLayer(m);
    gateMarkers[gate.id] = m;
  }

  async function deleteGate(id) {
    await DB.deleteGate(id);
    if (gateMarkers[id]) { gateLayer.removeLayer(gateMarkers[id]); delete gateMarkers[id]; }
  }

  async function deleteBoundary(id) {
    await DB.deleteBoundary(id);
    if (boundaryPolys[id]) { drawnItems.removeLayer(boundaryPolys[id]); delete boundaryPolys[id]; }
  }

  // ── Render pins on map ─────────────────────────────────────────────────
  function renderPins(pins, filterSpecies, filterUser) {
    if (!pinLayer) return;
    pinLayer.clearLayers();
    Object.keys(pinMarkers).forEach(k => delete pinMarkers[k]);

    pins.forEach(pin => {
      if (filterSpecies && pin.species !== filterSpecies) return;
      if (filterUser && pin.user !== filterUser) return;
      addPinMarker(pin);
    });
  }

  function addPinMarker(pin) {
    if (!mainMap || !pinLayer) return;
    const pt = PIN_TYPES.find(t => t.id === pin.pinType) || PIN_TYPES[0];
    const icon = pinIcon(pt.colour, pin.userInitial || '?');
    const m = L.marker([pin.lat, pin.lng], { icon, draggable: true });

    m.bindPopup(() => buildPinPopupHTML(pin));
    m.on('dragend', async e => {
      const ll = e.target.getLatLng();
      await DB.updatePin(pin.id, { lat: ll.lat, lng: ll.lng });
    });
    pinLayer.addLayer(m);
    pinMarkers[pin.id] = m;
  }

  function buildPinPopupHTML(pin) {
    const sp = SPECIES.find(s => s.id === pin.species);
    const pt = PIN_TYPES.find(t => t.id === pin.pinType);
    const photos = (pin.photoUrls || []).map(u =>
      `<a href="${u}" target="_blank"><img src="${u}" class="popup-photo" /></a>`
    ).join('');
    return `
      <div class="pin-popup">
        <div class="pp-header">
          <span class="pp-species">${sp?.label || pin.species}</span>
          <span class="pp-type">${pt?.label || pin.pinType}</span>
        </div>
        <div class="pp-meta">
          <b>${pin.user}</b> · ${pin.date} ${pin.time}
        </div>
        ${pin.landRef ? `<div class="pp-land">${pin.landRef}</div>` : ''}
        ${pin.weather ? `<div class="pp-weather">☁ ${pin.weather}</div>` : ''}
        ${pin.notes   ? `<div class="pp-notes">${pin.notes}</div>` : ''}
        ${photos}
        <div class="pp-coords">${pin.lat?.toFixed(5)}, ${pin.lng?.toFixed(5)}</div>
        <button class="pp-del" onclick="PinForm.deletePin('${pin.id}')">Delete pin</button>
      </div>`;
  }

  // ── Load boundaries & gates from DB ───────────────────────────────────
  function loadBoundaries(boundaries) {
    if (!boundaryLayer) return;
    boundaryLayer.clearLayers();
    boundaries.forEach(b => {
      if (!b.latlngs) return;
      const poly = L.polygon(b.latlngs.map(ll => [ll.lat, ll.lng]), {
        color: b.colour || '#C8A84B', fillColor: b.colour || '#C8A84B', fillOpacity: 0.15
      });
      poly.bindPopup(`<b>${b.name}</b><br><button onclick="MapModule.deleteBoundary('${b.id}')">Delete</button>`);
      boundaryLayer.addLayer(poly);
      boundaryPolys[b.id] = poly;
    });
  }

  function loadGates(gates) {
    if (!gateLayer) return;
    gateLayer.clearLayers();
    gates.forEach(g => addGateMarker(g));
  }

  // ── Overview maps ──────────────────────────────────────────────────────
  function initOverviewMaps() {
    if (!overviewAreaMap) {
      overviewAreaMap = initMap('overviewAreaMap', { zoom: 12 });
      if (overviewAreaMap) {
        [100, 300, 600].forEach(ms => setTimeout(() => {
          overviewAreaMap.invalidateSize();
          overviewAreaMap.setView([MAP_START.lat, MAP_START.lon], 12);
        }, ms));
      }
    }
    if (!overviewShotMap) {
      overviewShotMap = initMap('overviewShotMap', { zoom: 12 });
      if (overviewShotMap) {
        [100, 300, 600].forEach(ms => setTimeout(() => {
          overviewShotMap.invalidateSize();
          overviewShotMap.setView([MAP_START.lat, MAP_START.lon], 12);
        }, ms));
      }
    }
  }

  function renderOverview(pins, boundaries, gates) {
    if (!overviewShotMap || !overviewAreaMap) return;

    // Shot map: shots + boundaries only
    overviewShotMap.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polygon) overviewShotMap.removeLayer(l); });
    boundaries.forEach(b => {
      if (!b.latlngs) return;
      L.polygon(b.latlngs.map(ll => [ll.lat, ll.lng]), { color: b.colour || '#C8A84B', fillOpacity: 0.12 }).addTo(overviewShotMap);
    });
    pins.filter(p => p.pinType === 'shot').forEach(pin => {
      const sp = SPECIES.find(s => s.id === pin.species);
      const icon = pinIcon(sp?.colour || '#E63946', pin.userInitial || '?');
      L.marker([pin.lat, pin.lng], { icon }).addTo(overviewShotMap);
    });

    // Area map: everything (boundaries, all pins, gates)
    overviewAreaMap.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polygon) overviewAreaMap.removeLayer(l); });
    boundaries.forEach(b => {
      if (!b.latlngs) return;
      L.polygon(b.latlngs.map(ll => [ll.lat, ll.lng]), { color: b.colour || '#C8A84B', fillOpacity: 0.12 }).addTo(overviewAreaMap);
    });
    pins.forEach(pin => {
      const pt = PIN_TYPES.find(t => t.id === pin.pinType) || PIN_TYPES[0];
      const icon = pinIcon(pt.colour, pin.userInitial || '?');
      L.marker([pin.lat, pin.lng], { icon }).addTo(overviewAreaMap);
    });
    gates.forEach(g => {
      L.marker([g.lat, g.lng], { icon: gateIcon() }).addTo(overviewAreaMap);
    });
  }

  // ── Invalidate size when tab becomes visible ───────────────────────────
  function invalidateAll() {
    [mainMap, overviewShotMap, overviewAreaMap].forEach(m => m?.invalidateSize());
  }

  return {
    initMainMap, initOverviewMaps,
    renderPins, renderOverview,
    loadBoundaries, loadGates,
    addGateMarker, addPinMarker,
    deleteGate, deleteBoundary,
    enableGateDrop,
    invalidateAll,
    getMainMap: () => mainMap
  };
})();
