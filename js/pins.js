// Scotia Fieldsport Log — pin drop form & management

const PinForm = (() => {
  let pendingLatLng = null;

  // ── Drop a pin at current GPS location ──────────────────────────────────
  async function dropAtCurrentLocation(species) {
    if (!navigator.geolocation) {
      alert('Geolocation not available on this device/browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        openForm(lat, lng, species);
      },
      err => {
        alert('Could not get your location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Allow placing pin anywhere on map ────────────────────────────────────
  function dropOnMap(species) {
    const map = MapModule.getMainMap();
    if (!map) return;
    const el = document.getElementById('mapDropHint');
    if (el) { el.textContent = 'Tap map to place pin — or drag it after'; el.classList.remove('hidden'); }
    map.once('click', e => {
      if (el) el.classList.add('hidden');
      openForm(e.latlng.lat, e.latlng.lng, species);
    });
  }

  // ── Open pin form popup ──────────────────────────────────────────────────
  async function openForm(lat, lng, defaultSpecies) {
    const user = Auth.require();
    if (!user) return;
    const weather = await Weather.fetchCurrent();
    const weatherStr = Weather.formatForEntry(weather);

    const speciesOpts = SPECIES.map(s =>
      `<option value="${s.id}" ${s.id === defaultSpecies ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    const pinTypeOpts = PIN_TYPES.map(pt =>
      `<option value="${pt.id}">${pt.label}</option>`
    ).join('');

    Popup.show(`
      <h3>New Pin</h3>
      <div class="form-group">
        <label>Species</label>
        <select id="pinSpecies">${speciesOpts}</select>
      </div>
      <div class="form-group">
        <label>Pin type</label>
        <select id="pinType" onchange="PinForm._onTypeChange()">${pinTypeOpts}</select>
      </div>
      <div class="form-group">
        <label>Land / Area name</label>
        <input type="text" id="pinLandRef" placeholder="e.g. North Hill, Blackwood" />
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="pinNotes" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>Weather (auto-filled)</label>
        <input type="text" id="pinWeather" value="${weatherStr}" />
      </div>
      <div id="pinPhotoSection" class="hidden"></div>
      <div class="form-coords">
        ${lat.toFixed(5)}, ${lng.toFixed(5)}
        <button type="button" class="btn-link" onclick="PinForm._adjustOnMap(${lat},${lng})">Move on map</button>
      </div>
      <button class="btn-primary" onclick="PinForm._saveForm(${lat},${lng})">Save Pin</button>
    `);

    _onTypeChange();
    pendingLatLng = { lat, lng };
  }

  function _onTypeChange() {
    const typeVal = document.getElementById('pinType')?.value;
    const pt = PIN_TYPES.find(t => t.id === typeVal);
    const section = document.getElementById('pinPhotoSection');
    if (!section) return;
    if (pt?.hasPhoto) {
      section.classList.remove('hidden');
      if (!section.dataset.built) {
        const { el } = CloudinaryUpload.buildPhotoInput('Photos (optional)');
        section.appendChild(el);
        section.dataset.built = '1';
      }
    } else {
      section.classList.add('hidden');
    }
  }

  function _adjustOnMap(lat, lng) {
    const map = MapModule.getMainMap();
    if (!map) return;
    Popup.close();
    const tempMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
    const hint = document.getElementById('mapDropHint');
    if (hint) { hint.textContent = 'Drag pin to exact spot, then tap Confirm'; hint.classList.remove('hidden'); }

    // Add confirm button to map
    const ctrl = L.control({ position: 'topright' });
    ctrl.onAdd = () => {
      const d = L.DomUtil.create('button', 'leaflet-bar map-confirm-btn');
      d.textContent = '✓ Confirm position';
      L.DomEvent.on(d, 'click', () => {
        const ll = tempMarker.getLatLng();
        map.removeLayer(tempMarker);
        ctrl.remove();
        if (hint) hint.classList.add('hidden');
        openForm(ll.lat, ll.lng, document.getElementById('pinSpecies')?.value);
      });
      return d;
    };
    ctrl.addTo(map);
  }

  async function _saveForm(lat, lng) {
    const user = Auth.require();
    const species  = document.getElementById('pinSpecies')?.value;
    const pinType  = document.getElementById('pinType')?.value;
    const landRef  = document.getElementById('pinLandRef')?.value.trim();
    const notes    = document.getElementById('pinNotes')?.value.trim();
    const weather  = document.getElementById('pinWeather')?.value.trim();

    // Collect any uploaded photo URLs
    const photoSection = document.getElementById('pinPhotoSection');
    let photoUrls = [];
    if (photoSection && !photoSection.classList.contains('hidden')) {
      // Gather from hidden input we stored
      const urlInput = photoSection.querySelector('[data-urls]');
      if (urlInput) photoUrls = JSON.parse(urlInput.dataset.urls || '[]');
      // Fallback: look for thumbs
      photoUrls = Array.from(photoSection.querySelectorAll('.photo-thumb')).map(img => img.src);
    }

    const now = new Date();
    const pin = {
      species, pinType, lat, lng,
      user: user.username,
      userInitial: user.initial,
      date: now.toISOString().slice(0,10),
      time: now.toTimeString().slice(0,5),
      landRef, notes, weather,
      photoUrls
    };

    Popup.close();
    const id = await DB.savePin(pin);
    if (id && id !== 'queued') {
      MapModule.addPinMarker({ ...pin, id });
    } else if (id === 'queued') {
      DB.updateOfflineBadge();
    }
    AppUI.refreshLists();
  }

  async function deletePin(id) {
    if (!confirm('Delete this pin?')) return;
    await DB.deletePin(id);
    Popup.close();
    // marker removed when listener fires
  }

  return { dropAtCurrentLocation, dropOnMap, openForm, _onTypeChange, _saveForm, _adjustOnMap, deletePin };
})();
