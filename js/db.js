// Scotia Fieldsport Log — Firestore data layer + offline queue

const DB = (() => {
  let db = null;
  const QUEUE_KEY = 'sfl_offline_queue';

  function init() {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    // Flush queue when back online
    window.addEventListener('online', flushQueue);
    return db;
  }

  // ── Pins ─────────────────────────────────────────────────────────────────

  async function savePin(pin) {
    const doc = {
      ...pin,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!navigator.onLine) {
      enqueue({ type: 'addPin', data: doc });
      return 'queued';
    }
    const ref = await db.collection('pins').add(doc);
    return ref.id;
  }

  async function updatePin(id, fields) {
    if (!navigator.onLine) {
      enqueue({ type: 'updatePin', id, data: fields });
      return;
    }
    await db.collection('pins').doc(id).update(fields);
  }

  async function deletePin(id) {
    await db.collection('pins').doc(id).delete();
  }

  function listenPins(callback) {
    return db.collection('pins').onSnapshot(snap => {
      const pins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(pins);
    });
  }

  // ── Boundaries ───────────────────────────────────────────────────────────

  async function saveBoundary(boundary) {
    if (!navigator.onLine) { enqueue({ type: 'addBoundary', data: boundary }); return 'queued'; }
    const ref = await db.collection('boundaries').add(boundary);
    return ref.id;
  }

  async function updateBoundary(id, fields) {
    if (!navigator.onLine) { enqueue({ type: 'updateBoundary', id, data: fields }); return; }
    await db.collection('boundaries').doc(id).update(fields);
  }

  async function deleteBoundary(id) {
    await db.collection('boundaries').doc(id).delete();
  }

  function listenBoundaries(callback) {
    return db.collection('boundaries').onSnapshot(snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    });
  }

  // ── Gates ────────────────────────────────────────────────────────────────

  async function saveGate(gate) {
    if (!navigator.onLine) { enqueue({ type: 'addGate', data: gate }); return 'queued'; }
    const ref = await db.collection('gates').add(gate);
    return ref.id;
  }

  async function deleteGate(id) {
    await db.collection('gates').doc(id).delete();
  }

  function listenGates(callback) {
    return db.collection('gates').onSnapshot(snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    });
  }

  // ── Export all ───────────────────────────────────────────────────────────

  async function exportAll() {
    const [pinsSnap, boundSnap, gateSnap] = await Promise.all([
      db.collection('pins').get(),
      db.collection('boundaries').get(),
      db.collection('gates').get()
    ]);
    return {
      exportedAt: new Date().toISOString(),
      pins: pinsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      boundaries: boundSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      gates: gateSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };
  }

  // ── Offline queue ─────────────────────────────────────────────────────────

  function enqueue(op) {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      q.push(op);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
      updateOfflineBadge();
    } catch {}
  }

  async function flushQueue() {
    if (!db) return;
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      if (!q.length) return;
      for (const op of q) {
        try {
          if (op.type === 'addPin') await db.collection('pins').add(op.data);
          else if (op.type === 'updatePin') await db.collection('pins').doc(op.id).update(op.data);
          else if (op.type === 'addBoundary') await db.collection('boundaries').add(op.data);
          else if (op.type === 'updateBoundary') await db.collection('boundaries').doc(op.id).update(op.data);
          else if (op.type === 'addGate') await db.collection('gates').add(op.data);
        } catch (e) { console.warn('Queue flush error', op.type, e); }
      }
      localStorage.removeItem(QUEUE_KEY);
      updateOfflineBadge();
    } catch {}
  }

  function queueLength() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length; } catch { return 0; }
  }

  function updateOfflineBadge() {
    const badge = document.getElementById('offlineBadge');
    if (!badge) return;
    const n = queueLength();
    badge.textContent = n > 0 ? `${n} pending` : '';
    badge.classList.toggle('hidden', n === 0);
  }

  return {
    init,
    savePin, updatePin, deletePin, listenPins,
    saveBoundary, updateBoundary, deleteBoundary, listenBoundaries,
    saveGate, deleteGate, listenGates,
    exportAll, flushQueue, queueLength, updateOfflineBadge
  };
})();
