/* ============================================================
   views/revista.js — Nível 3: revista da unidade com flip de páginas
   ============================================================ */
const RevistaView = (() => {
  let _state = { pages: [], current: 0, unidade: {}, params: {} };

  async function render(container, params) {
    _state.params = params || {};
    const scope = params.scope === 'principal' ? 'principal' : 'escola';
    const { unidade, paginas } = await Api.paginas.getRevista(params.unidadeId, params.temaId, scope);
    _state.unidade = unidade;
    _state.pages = paginas;
    _state.current = 0;

    const cor = unidade.cor || '#FF3366';
    const podeEditar = Store.isOwnerOf(unidade.id);
    const scopeLabel = scope === 'principal' ? '★ Revista principal' : 'Revista da escola';

    const editarBtn = podeEditar
      ? UI.btn('✏ Editar', { type: 'editor', size: 'sm',
          onclick: `Router.navigate('editor', RevistaView._params())` }) : '';

    container.innerHTML = `
    <div id="view-revista" class="view-pad">
      <div class="rev-unit-header">
        <div class="rev-avatar" style="background:${cor}">${UI._esc(unidade.sigla)}</div>
        <div class="rev-unit-info">
          <div class="rev-unit-nome">${UI._esc(unidade.nome)}</div>
          <div class="rev-unit-tema">${UI._esc(scopeLabel)} · ${UI._esc(params.temaNome || '')}</div>
        </div>
        <div class="rev-unit-actions">
          ${editarBtn}
          ${UI.btn('Outras unidades', { type: 'ghost', size: 'sm', onclick: `Router.goBack()` })}
        </div>
      </div>

      <div class="revista-stage">
        <div id="rev-page" class="rev-page">${_pageHtml()}</div>
        <div id="rev-thumbs" class="rev-side-nav">${_renderThumbs(cor)}</div>
      </div>

      <div class="rev-controls">
        <button id="btn-prev" class="rev-flip-btn" onclick="RevistaView.flip(-1)">‹</button>
        <div id="page-dots" class="page-dots">${_renderDots()}</div>
        <button id="btn-next" class="rev-flip-btn" onclick="RevistaView.flip(1)">›</button>
      </div>
    </div>`;

    _updateControls();
  }

  function _params() {
    return { ...(_state.params || {}) };
  }

  function _pageHtml() {
    if (!_state.pages.length) {
      return `<div class="rev-empty">
        <div class="rev-empty-ic">📄</div>
        <div class="rev-empty-t">Nenhuma página publicada</div>
        <div class="rev-empty-s">Esta unidade ainda não publicou páginas neste tema.</div>
      </div>`;
    }
    return Renderer.renderPagina(_state.pages[_state.current]);
  }

  function _animateFlip(el) {
    el.style.animation = 'none';
    void el.offsetHeight; // reflow
    el.style.animation = 'flipIn .28s ease forwards';
  }

  function flip(dir) {
    const next = _state.current + dir;
    if (next < 0 || next >= _state.pages.length) return;
    _state.current = next;
    const el = document.getElementById('rev-page');
    el.innerHTML = _pageHtml();
    _animateFlip(el);
    _updateControls();
  }

  function jumpTo(idx) {
    if (idx < 0 || idx >= _state.pages.length || idx === _state.current) return;
    _state.current = idx;
    const el = document.getElementById('rev-page');
    el.innerHTML = _pageHtml();
    _animateFlip(el);
    _updateControls();
  }

  function _renderDots() {
    return _state.pages.map((_, i) => {
      const active = i === _state.current;
      return `<div onclick="RevistaView.jumpTo(${i})" class="page-dot"
        style="width:${active ? '20px' : '7px'};border-radius:${active ? '4px' : '50%'};
        background:${active ? 'var(--c1)' : 'var(--border)'}"></div>`;
    }).join('');
  }

  function _renderThumbs(cor) {
    return _state.pages.map((_, i) => {
      const active = i === _state.current;
      return `<div onclick="RevistaView.jumpTo(${i})" class="rev-thumb"
        style="border-color:${active ? cor : 'var(--border)'};color:${active ? cor : 'var(--muted)'}">${i + 1}</div>`;
    }).join('');
  }

  function _updateControls() {
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) prev.disabled = _state.current === 0;
    if (next) next.disabled = _state.current >= _state.pages.length - 1;
    const dots = document.getElementById('page-dots');
    if (dots) dots.innerHTML = _renderDots();
    const thumbs = document.getElementById('rev-thumbs');
    if (thumbs) thumbs.innerHTML = _renderThumbs(_state.unidade.cor || '#FF3366');
  }

  return { render, flip, jumpTo, _params };
})();
