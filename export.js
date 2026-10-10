// Scotia Fieldsport Log — CSV export

const Export = (() => {
  function toCSV(rows, cols) {
    const header = cols.map(c => `"${c.label}"`).join(',');
    const lines = rows.map(r =>
      cols.map(c => {
        const v = r[c.key] ?? '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')
    );
    return [header, ...lines].join('\n');
  }

  function download(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function pinColumns() {
    return [
      { key: 'species',    label: 'Species'    },
      { key: 'pinType',    label: 'Type'       },
      { key: 'user',       label: 'User'       },
      { key: 'date',       label: 'Date'       },
      { key: 'time',       label: 'Time'       },
      { key: 'lat',        label: 'Latitude'   },
      { key: 'lng',        label: 'Longitude'  },
      { key: 'landRef',    label: 'Land Ref'   },
      { key: 'weather',    label: 'Weather'    },
      { key: 'notes',      label: 'Notes'      },
      { key: 'photoUrls',  label: 'Photos'     }
    ];
  }

  async function exportPins(opts = {}) {
    // opts: { species, user, dateFrom, dateTo }
    const all = await DB.exportAll();
    let pins = all.pins || [];

    if (opts.species) pins = pins.filter(p => p.species === opts.species);
    if (opts.user)    pins = pins.filter(p => p.user === opts.user);
    if (opts.dateFrom) {
      const from = new Date(opts.dateFrom);
      pins = pins.filter(p => new Date(p.date) >= from);
    }
    if (opts.dateTo) {
      const to = new Date(opts.dateTo);
      pins = pins.filter(p => new Date(p.date) <= to);
    }

    const rows = pins.map(p => ({
      ...p,
      photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls.join(' | ') : ''
    }));

    const csv = toCSV(rows, pinColumns());
    const stamp = new Date().toISOString().slice(0,10);
    const label = [opts.species, opts.user].filter(Boolean).join('-') || 'all';
    download(`ScotiaFieldsportLog-${label}-${stamp}.csv`, csv);
  }

  function showExportDialog() {
    const speciesOpts = [
      '<option value="">All species</option>',
      ...SPECIES.map(s => `<option value="${s.id}">${s.label}</option>`)
    ].join('');
    const userOpts = [
      '<option value="">All users</option>',
      ...USERS.map(u => `<option value="${u.username}">${u.displayName}</option>`)
    ].join('');

    Popup.show(`
      <h3>Export CSV</h3>
      <div class="form-group">
        <label>Species</label>
        <select id="exportSpecies">${speciesOpts}</select>
      </div>
      <div class="form-group">
        <label>User</label>
        <select id="exportUser">${userOpts}</select>
      </div>
      <div class="form-group">
        <label>Date from</label>
        <input type="date" id="exportFrom" />
      </div>
      <div class="form-group">
        <label>Date to</label>
        <input type="date" id="exportTo" />
      </div>
      <button class="btn-primary" onclick="Export._doExport()">Download CSV</button>
    `);
  }

  async function _doExport() {
    const opts = {
      species:  document.getElementById('exportSpecies')?.value || '',
      user:     document.getElementById('exportUser')?.value || '',
      dateFrom: document.getElementById('exportFrom')?.value || '',
      dateTo:   document.getElementById('exportTo')?.value || ''
    };
    Popup.close();
    await exportPins(opts);
  }

  return { exportPins, showExportDialog, _doExport };
})();
