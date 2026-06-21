/* ============================================================
   router.js — SPA router + breadcrumb + animação de transição
   ============================================================ */
const Router = (() => {
  const VIEWS = {}; // { viewId: { render } | renderFn }

  function register(id, viewObj) { VIEWS[id] = viewObj; }

  function _renderFn(view) {
    const v = VIEWS[view];
    if (!v) return null;
    return typeof v === 'function' ? v : v.render;
  }

  function navigate(view, params = {}, pushHist = true) {
    const fn = _renderFn(view);
    if (!fn) { console.error('[Router] view não registrada:', view); return; }

    // 1. histórico
    const cur = Store.getCurrentView();
    if (pushHist && cur) Store.pushHistory(cur, Store.getCurrentParams());

    // 2. estado
    Store.setCurrentView(view, params);

    // 3. skeleton
    const container = document.getElementById('main-content');
    container.innerHTML = `<div class="view-pad">${UI.skeleton()}</div>`;

    // 4. render (assíncrono permitido)
    Promise.resolve(fn(container, params))
      .then(() => {
        // 5. animação
        const child = container.firstElementChild;
        if (child) child.classList.add('screen-animate');
      })
      .catch((err) => {
        console.error('[Router]', err);
        container.innerHTML = `<div class="view-pad error-state">Erro ao carregar: ${UI._esc(err.message)}</div>`;
      });

    // 6. topbar
    _updateTopbar(view, params);
    EventBus.emit('navigate', { view, params });
  }

  function goBack() {
    const prev = Store.popHistory();
    if (prev) navigate(prev.view, prev.params, false);
    else navigate('secretaria', {}, false);
  }

  // ── Breadcrumb ──────────────────────────────────────────
  function _buildCrumbs(view, params) {
    const home = { label: '🏠 Início', view: 'secretaria', params: {} };
    const crumbs = [home];
    if (view === 'tema' || view === 'revista' || view === 'editor') {
      crumbs.push({ label: params.temaNome || 'Tema', view: 'tema',
        params: { temaId: params.temaId, temaNome: params.temaNome } });
    }
    if (view === 'revista' || view === 'editor') {
      crumbs.push({ label: params.unidadeNome || 'Unidade', view: 'revista', params });
    }
    if (view === 'editor') crumbs.push({ label: 'Editor', view: 'editor', params });
    if (view === 'admin')  crumbs.push({ label: 'Admin', view: 'admin', params: {} });
    return crumbs;
  }

  function _updateTopbar(view, params) {
    const back = document.getElementById('tb-back');
    if (back) back.style.display = Store.getHistory().length ? 'flex' : 'none';

    const bc = document.getElementById('tb-breadcrumb');
    if (bc) {
      const crumbs = _buildCrumbs(view, params);
      bc.innerHTML = crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        const enc = encodeURIComponent(JSON.stringify(c.params || {}));
        return `${i ? '<span class="bc-sep">›</span>' : ''}<span class="bc-item ${last ? 'bc-active' : ''}"
          ${last ? '' : `onclick="Router.navigate('${c.view}', JSON.parse(decodeURIComponent('${enc}')), false)"`}
          >${UI._esc(c.label)}</span>`;
      }).join('');
    }

    const adminBtn = document.getElementById('tb-admin');
    if (adminBtn) adminBtn.style.display = Store.isSecretaria() ? 'inline-flex' : 'none';
  }

  return { register, navigate, goBack };
})();
