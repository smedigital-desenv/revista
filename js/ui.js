/* ============================================================
   ui.js — componentes reutilizáveis (toast, modal, confirm, skeleton, etc)
   ============================================================ */
const UI = (() => {

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Toast ───────────────────────────────────────────────
  function toast(msg, type = 'info') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const colors = { info: 'var(--c3)', success: 'var(--c6)', error: 'var(--c1)' };
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.borderLeftColor = colors[type] || colors.info;
    el.innerHTML = _esc(msg);
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  // ── Modal ───────────────────────────────────────────────
  function modal(html) {
    closeModal();
    const ov = document.createElement('div');
    ov.id = 'modal-overlay';
    ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-box">${html}</div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    EventBus.emit('modal:open', { html });
  }
  function closeModal() {
    const ov = document.getElementById('modal-overlay');
    if (ov) { ov.classList.remove('show'); setTimeout(() => ov.remove(), 200); }
    EventBus.emit('modal:close', {});
  }

  // ── Confirm ─────────────────────────────────────────────
  // Usa window._confirmCb para evitar serializar funções no HTML
  function confirm(msg, onConfirm) {
    window._confirmCb = onConfirm;
    modal(`
      <div class="modal-title">Confirmar</div>
      <p class="modal-text">${_esc(msg)}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="(window._confirmCb&&window._confirmCb());UI.closeModal()">Confirmar</button>
      </div>
    `);
  }

  // ── Skeleton ────────────────────────────────────────────
  function skeleton() {
    return `<div class="skeleton-wrap">
      <div class="skel skel-title"></div>
      <div class="skel skel-line"></div>
      <div class="skel skel-line" style="width:70%"></div>
      <div class="skel-grid">
        ${Array.from({ length: 6 }).map(() => `<div class="skel skel-card"></div>`).join('')}
      </div>
    </div>`;
  }

  // ── Componentes HTML (string) ───────────────────────────
  function btn(label, opts = {}) {
    const { type = 'primary', size = '', icon = '', onclick = '', disabled = false, id = '' } = opts;
    return `<button class="btn btn-${type} ${size ? 'btn-' + size : ''}"
      ${id ? `id="${id}"` : ''} ${onclick ? `onclick="${onclick}"` : ''} ${disabled ? 'disabled' : ''}>
      ${icon ? `<span class="btn-ic">${icon}</span>` : ''}${_esc(label)}</button>`;
  }

  function badge(label, type = 'draft') {
    const map = {
      published: { c: 'var(--c6)', t: 'Publicado' },
      draft:     { c: 'var(--muted)', t: 'Rascunho' },
      review:    { c: 'var(--c3)', t: 'Em revisão' },
    };
    const m = map[type] || map.draft;
    return `<span class="badge" style="color:${m.c};border-color:${m.c}55;background:${m.c}18">
      ${_esc(label || m.t)}</span>`;
  }

  function statCard(num, label, cor = 'var(--c1)') {
    return `<div class="card stat-card">
      <div class="stat-blob" style="background:${cor}"></div>
      <div class="stat-num" style="color:${cor}">${_esc(num)}</div>
      <div class="stat-label">${_esc(label)}</div>
    </div>`;
  }

  function sectionLabel(icon, text) {
    return `<div class="section-label"><span>${icon}</span>${_esc(text)}</div>`;
  }

  function formGroup(label, inputHtml) {
    return `<div class="form-group"><label class="form-label">${_esc(label)}</label>${inputHtml}</div>`;
  }

  // fn: nome de função onclick que recebe a cor, ex: 'EditorView.setColor'
  function colorPicker(selected, fn) {
    return `<div class="color-picker">${CONFIG.CORES.map((c) =>
      `<div class="color-swatch ${c === selected ? 'active' : ''}" style="background:${c}"
        onclick="${fn}('${c}')" title="${c}"></div>`).join('')}</div>`;
  }

  return {
    toast, modal, closeModal, confirm, skeleton,
    btn, badge, statCard, sectionLabel, formGroup, colorPicker,
    _esc,
  };
})();
