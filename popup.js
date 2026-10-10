// Scotia Fieldsport Log — popup / modal helper

const Popup = (() => {
  function show(html, opts = {}) {
    const overlay = document.getElementById('popupOverlay');
    const card = document.getElementById('popupCard');
    if (!overlay || !card) return;
    card.innerHTML = `
      <button class="popup-close" onclick="Popup.close()">✕</button>
      ${html}
    `;
    overlay.classList.remove('hidden');
    overlay.onclick = e => { if (e.target === overlay) Popup.close(); };
  }

  function close() {
    const overlay = document.getElementById('popupOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  return { show, close };
})();
