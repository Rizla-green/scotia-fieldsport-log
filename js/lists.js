// Scotia Fieldsport Log — shot list renderer (per-species tabs)

const Lists = (() => {
  let allPins = [];

  function update(pins) {
    allPins = pins;
  }

  function renderSpeciesList(containerId, speciesId, filterUser) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let pins = allPins.filter(p => p.species === speciesId && p.pinType === 'shot');
    if (filterUser) pins = pins.filter(p => p.user === filterUser);

    pins.sort((a,b) => (b.date + b.time).localeCompare(a.date + a.time));

    if (!pins.length) {
      container.innerHTML = '<p class="list-empty">No shot entries yet.</p>';
      return;
    }

    container.innerHTML = pins.map(p => `
      <div class="list-card" onclick="Lists.showDetail('${p.id}')">
        <div class="lc-header">
          <span class="lc-initial lc-initial-${(p.userInitial||'?').toLowerCase()}">${p.userInitial || '?'}</span>
          <span class="lc-date">${p.date} ${p.time}</span>
          <span class="lc-type">Shot / Culled</span>
        </div>
        ${p.landRef ? `<div class="lc-land">📍 ${p.landRef}</div>` : ''}
        ${p.weather  ? `<div class="lc-weather">☁ ${p.weather}</div>` : ''}
        ${p.notes    ? `<div class="lc-notes">${p.notes}</div>` : ''}
      </div>
    `).join('');
  }

  function showDetail(id) {
    const pin = allPins.find(p => p.id === id);
    if (!pin) return;
    const sp = SPECIES.find(s => s.id === pin.species);
    const pt = PIN_TYPES.find(t => t.id === pin.pinType);
    const photos = (pin.photoUrls||[]).map(u =>
      `<a href="${u}" target="_blank"><img src="${u}" class="popup-photo" /></a>`
    ).join('');

    Popup.show(`
      <div class="pin-popup">
        <div class="pp-header">
          <span class="pp-species">${sp?.label||pin.species}</span>
          <span class="pp-type">${pt?.label||pin.pinType}</span>
        </div>
        <div class="pp-meta"><b>${pin.user}</b> · ${pin.date} ${pin.time}</div>
        ${pin.landRef ? `<div class="pp-land">📍 ${pin.landRef}</div>` : ''}
        ${pin.weather ? `<div class="pp-weather">☁ ${pin.weather}</div>` : ''}
        ${pin.notes   ? `<div class="pp-notes">${pin.notes}</div>` : ''}
        ${photos}
        <div class="pp-coords">${pin.lat?.toFixed(5)}, ${pin.lng?.toFixed(5)}</div>
        <button class="pp-del" onclick="PinForm.deletePin('${pin.id}')">Delete pin</button>
      </div>
    `);
  }

  return { update, renderSpeciesList, showDetail };
})();
