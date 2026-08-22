/* ============================================================
   views/editor.js — Editor de páginas (3 colunas: páginas | preview | props)
   ============================================================ */
const EditorView = (() => {
  let _s = { pages: [], current: 0, unidade: {}, params: {}, dirty: false };

  const CAMPOS_POR_LAYOUT = {
    'hero-texto-galeria': ['tag', 'titulo', 'subtitulo', 'texto', 'galeria'],
    'video-metricas':     ['tag', 'titulo', 'subtitulo', 'videoUrl', 'metricas', 'citacao', 'citacaoAutor'],
    'citacao-galeria':    ['tag', 'titulo', 'subtitulo', 'citacao', 'citacaoAutor', 'galeria', 'texto'],
    'galeria-completa':   ['titulo', 'galeria', 'texto'],
    'timeline':           ['tag', 'titulo', 'subtitulo', 'eventos'],
    'indicadores':        ['tag', 'titulo', 'subtitulo', 'indicadores', 'citacao', 'citacaoAutor'],
  };

  const LABELS = {
    tag: 'Tag', titulo: 'Título', subtitulo: 'Subtítulo', texto: 'Texto',
    videoUrl: 'URL do vídeo', citacao: 'Citação', citacaoAutor: 'Autor da citação',
    metricas: 'Métricas (valor|label, ...)', eventos: 'Eventos (data|título|descrição por linha)',
    indicadores: 'Indicadores (ícone|valor|label|variação, ...)', galeria: 'Galeria',
  };

  // ── Render ──────────────────────────────────────────────
  async function render(container, params) {
    _s.params = params || {};
    if (!Store.isOwnerOf(params.unidadeId)) { Router.navigate('secretaria', {}, false); return; }

    const { unidade, paginas } = await Api.paginas.getModoEdicao(params.unidadeId, params.temaId);
    _s.unidade = unidade;
    _s.pages = paginas.length ? paginas : [_novaPagina()];
    _s.current = 0;
    _s.dirty = false;

    container.innerHTML = `
    <div id="view-editor" class="editor-grid">
      <aside class="ed-col ed-left">
        <div class="ed-section">
          <div class="ed-section-head">
            <span>Páginas</span>
            <button class="btn btn-primary btn-sm" onclick="EditorView.addPage()">+ Nova</button>
          </div>
          <div id="ed-pages-list" class="ed-pages-list">${_renderPagesList()}</div>
        </div>
        <div class="ed-section">
          <div class="ed-section-head"><span>Layout</span></div>
          <div class="ed-layouts">${_renderLayouts()}</div>
        </div>
        <div class="ed-section ed-section-grow">
          <div class="ed-section-head"><span>Conteúdo</span></div>
          <div id="ed-fields" class="ed-fields">${_renderFields()}</div>
        </div>
      </aside>

      <main class="ed-col ed-center">
        <div class="ed-canvas-bar">
          <div class="ed-canvas-title">
            Editando: <b id="ed-editing-name">${UI._esc(_cur().titulo || 'Sem título')}</b>
            · <span id="ed-page-count">Página ${_s.current + 1}/${_s.pages.length}</span>
          </div>
          <div class="ed-canvas-actions">
            ${UI.btn('Publicar na minha revista', { type: 'primary', size: 'sm', onclick: 'EditorView.publish()' })}
            ${UI.btn('Enviar p/ revista principal', { type: 'editor', size: 'sm', onclick: 'EditorView.enviarPrincipal()' })}
          </div>
        </div>
        <div class="ed-canvas">
          <div id="editor-preview" class="editor-preview">${Renderer.renderPagina(_cur())}</div>
        </div>
        <div class="ed-flip">
          <button class="rev-flip-btn" onclick="EditorView.prevPage()">‹</button>
          <div id="ed-dots" class="page-dots">${_renderDots()}</div>
          <button class="rev-flip-btn" onclick="EditorView.nextPage()">›</button>
        </div>
      </main>

      <aside class="ed-col ed-right">
        <div class="ed-prop">
          <div class="ed-prop-label">Status</div>
          <div id="ed-status-badge">${_statusBadge()}</div>
        </div>
        ${UI.formGroup('Título da página',
          `<input id="page-title" class="input" value="${UI._esc(_cur().titulo || '')}"
             oninput="EditorView.onTitleChange(this)">`)}
        <div class="ed-prop">
          <div class="ed-prop-label">Cor de destaque</div>
          ${UI.colorPicker(_cur().conteudo?.tagCor || '#1B3A6B', 'EditorView.setColor')}
        </div>
        <div class="ed-prop">
          <div class="ed-prop-label">Mídia (Storage)</div>
          <div class="ed-drive-btns">
            ${CONFIG.STORAGE_TIPOS.map((t) =>
              `<button class="btn btn-ghost btn-sm" onclick="EditorView.openDrive('${t}')">${t}</button>`).join('')}
          </div>
        </div>
        <div class="ed-prop ed-prop-actions">
          ${UI.btn('💾 Salvar', { type: 'primary', id: 'ed-save-btn', onclick: 'EditorView.save()' })}
          ${UI.btn('Excluir página', { type: 'ghost-danger', onclick: 'EditorView.deletePage()' })}
        </div>
      </aside>
    </div>`;
  }

  // ── Helpers de estado ───────────────────────────────────
  function _cur() { return _s.pages[_s.current]; }

  function _novaPagina() {
    return {
      id: null, unidade_id: _s.params.unidadeId, tema_id: _s.params.temaId,
      titulo: 'Nova página', layout: 'hero-texto-galeria', status: 'rascunho', principal_status: 'nenhum',
      conteudo: { tagCor: '#1B3A6B' }, inscricao_id: null,
      ordem: (_s.pages?.length || 0) + 1,
    };
  }

  // ── Listas / blocos ─────────────────────────────────────
  function _renderPagesList() {
    return _s.pages.map((p, i) =>
      `<div class="ed-page-item ${i === _s.current ? 'active' : ''}" onclick="EditorView.goToPage(${i})">
        <span class="ed-page-n">${i + 1}</span>
        <span class="ed-page-t">${UI._esc(p.titulo || 'Sem título')}</span>
        ${UI.badge('', _badgeType(p.status))}
      </div>`).join('');
  }

  function _renderLayouts() {
    return Store.getLayouts().map((l) =>
      `<div class="ed-layout ${l.id === _cur().layout ? 'active' : ''}" title="${UI._esc(l.descricao)}"
        onclick="EditorView.setLayout('${l.id}')">
        <div class="ed-layout-ic">${l.icone}</div>
        <div class="ed-layout-lb">${UI._esc(l.label)}</div>
      </div>`).join('');
  }

  function _renderFields() {
    const campos = CAMPOS_POR_LAYOUT[_cur().layout] || [];
    const c = _cur().conteudo || {};
    return campos.map((f) => {
      if (f === 'galeria') {
        return UI.formGroup(LABELS[f] || f,
          `<button class="btn btn-ghost btn-sm" onclick="EditorView.openDrive('fotos')">📁 Abrir pasta de fotos</button>
           <textarea class="input" data-field="galeria" rows="2"
             placeholder="URLs separadas por linha" oninput="EditorView.onField(this)">${UI._esc((c.galeria || []).join('\n'))}</textarea>`);
      }
      if (f === 'metricas') {
        const v = (c.metricas || []).map((m) => `${m.valor}|${m.label}`).join(', ');
        return UI.formGroup(LABELS[f], `<input class="input" data-field="metricas"
          value="${UI._esc(v)}" placeholder="45|Alunos, 120|Refeições" oninput="EditorView.onField(this)">`);
      }
      if (f === 'eventos') {
        const v = (c.eventos || []).map((e) => `${e.data}|${e.titulo}|${e.descricao || ''}`).join('\n');
        return UI.formGroup(LABELS[f], `<textarea class="input" data-field="eventos" rows="4"
          placeholder="Jan 2025|Início|Descrição" oninput="EditorView.onField(this)">${UI._esc(v)}</textarea>`);
      }
      if (f === 'indicadores') {
        const v = (c.indicadores || []).map((m) => `${m.icone}|${m.valor}|${m.label}|${m.variacao || ''}`).join(', ');
        return UI.formGroup(LABELS[f], `<input class="input" data-field="indicadores"
          value="${UI._esc(v)}" placeholder="🏆|45|Alunos|+12%" oninput="EditorView.onField(this)">`);
      }
      if (f === 'texto') {
        return UI.formGroup(LABELS[f], `<textarea class="input" data-field="texto" rows="3"
          oninput="EditorView.onField(this)">${UI._esc(c.texto || '')}</textarea>`);
      }
      return UI.formGroup(LABELS[f] || f, `<input class="input" data-field="${f}"
        value="${UI._esc(c[f] || '')}" oninput="EditorView.onField(this)">`);
    }).join('');
  }

  function _badgeType(status) {
    return status === 'publicado' ? 'published' : 'draft';
  }
  const _PRINCIPAL_LABEL = {
    nenhum: '', pendente: '⏳ Principal: aguardando', aprovado: '★ Na revista principal', recusado: '✗ Principal: recusada',
  };
  function _principalBadge() {
    const ps = _cur().principal_status || 'nenhum';
    if (ps === 'nenhum') return '';
    const type = ps === 'aprovado' ? 'published' : ps === 'pendente' ? 'review' : 'draft';
    return ' ' + UI.badge(_PRINCIPAL_LABEL[ps], type);
  }
  function _statusBadge() {
    const own = UI.badge(_cur().status === 'publicado' ? 'Publicado na escola' : 'Rascunho', _badgeType(_cur().status));
    return own + _principalBadge();
  }

  function _renderDots() {
    return _s.pages.map((_, i) =>
      `<div onclick="EditorView.goToPage(${i})" class="page-dot"
        style="width:${i === _s.current ? '20px' : '7px'};border-radius:${i === _s.current ? '4px' : '50%'};
        background:${i === _s.current ? 'var(--c4)' : 'var(--border)'}"></div>`).join('');
  }

  // ── Parsers ─────────────────────────────────────────────
  function _parse(field, raw) {
    if (field === 'galeria') return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (field === 'metricas') return raw.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [valor, label] = s.split('|'); return { valor: (valor || '').trim(), label: (label || '').trim() }; });
    if (field === 'eventos') return raw.split('\n').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [data, titulo, descricao] = s.split('|'); return { data: (data || '').trim(), titulo: (titulo || '').trim(), descricao: (descricao || '').trim() }; });
    if (field === 'indicadores') return raw.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [icone, valor, label, variacao] = s.split('|'); return { icone: (icone || '').trim(), valor: (valor || '').trim(), label: (label || '').trim(), variacao: (variacao || '').trim() }; });
    return raw;
  }

  // ── Eventos de edição ───────────────────────────────────
  function onField(input) {
    const field = input.dataset.field;
    _cur().conteudo = _cur().conteudo || {};
    _cur().conteudo[field] = _parse(field, input.value);
    _s.dirty = true;
    _refreshPreview();
  }

  function onTitleChange(input) {
    _cur().titulo = input.value;
    _s.dirty = true;
    const nm = document.getElementById('ed-editing-name');
    if (nm) nm.textContent = input.value || 'Sem título';
    const list = document.getElementById('ed-pages-list');
    if (list) list.innerHTML = _renderPagesList();
  }

  function setLayout(layoutId) {
    _cur().layout = layoutId;
    _s.dirty = true;
    document.querySelectorAll('.ed-layout').forEach((el) =>
      el.classList.toggle('active', el.getAttribute('onclick').includes(`'${layoutId}'`)));
    document.getElementById('ed-fields').innerHTML = _renderFields();
    _refreshPreview();
  }

  function setColor(cor) {
    _cur().conteudo = _cur().conteudo || {};
    _cur().conteudo.tagCor = cor;
    _s.dirty = true;
    document.querySelectorAll('#view-editor .ed-right .color-swatch').forEach((s) =>
      s.classList.toggle('active', s.title === cor));
    _refreshPreview();
  }

  function _refreshPreview() {
    const el = document.getElementById('editor-preview');
    if (el) el.innerHTML = Renderer.renderPagina(_cur());
  }

  // ── Navegação entre páginas ─────────────────────────────
  function addPage() {
    _s.pages.push(_novaPagina());
    _s.current = _s.pages.length - 1;
    render(document.getElementById('main-content'), _s.params);
  }
  function goToPage(idx) {
    if (idx < 0 || idx >= _s.pages.length) return;
    _syncTitle();
    _s.current = idx;
    render(document.getElementById('main-content'), _s.params);
  }
  function prevPage() { if (_s.current > 0) goToPage(_s.current - 1); }
  function nextPage() { if (_s.current < _s.pages.length - 1) goToPage(_s.current + 1); }

  function _syncTitle() {
    const el = document.getElementById('page-title');
    if (el) _cur().titulo = el.value;
  }

  // ── Salvar / status ─────────────────────────────────────
  async function save() {
    _syncTitle();
    const p = _cur();
    if (!p.titulo || !p.titulo.trim()) { UI.toast('Informe o título.', 'error'); return; }

    const btn = document.getElementById('ed-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const payload = {
      id: p.id || undefined,
      unidade_id: _s.params.unidadeId,
      tema_id: _s.params.temaId,
      titulo: p.titulo,
      layout: p.layout,
      conteudo: p.conteudo || {},
      ordem: p.ordem || (_s.current + 1),
      status: p.status || 'rascunho',
      inscricao_id: p.inscricao_id || null,
    };

    try {
      const res = await Api.paginas.salvar(payload);
      if (!p.id) p.id = res.id;
      p.status = res.status || p.status || 'rascunho';
      _s.dirty = false;
      UI.toast('Salvo!', 'success');
      const sb = document.getElementById('ed-status-badge');
      if (sb) sb.innerHTML = _statusBadge();
      document.getElementById('ed-pages-list').innerHTML = _renderPagesList();
    } catch (err) {
      UI.toast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '💾 Salvar'; }
    }
  }

  // A escola publica na própria revista (sem aprovação da SME)
  async function publish() {
    const p = _cur();
    if (!p.id) { UI.toast('Salve a página primeiro.', 'error'); return; }
    try {
      await Api.paginas.setStatus(p.id, 'publicado');
      p.status = 'publicado';
      UI.toast('Publicado na revista da escola!', 'success');
      _refreshStatus();
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  // A escola envia a página (já publicada) para a SME avaliar na revista principal
  async function enviarPrincipal() {
    const p = _cur();
    if (!p.id) { UI.toast('Salve a página primeiro.', 'error'); return; }
    if (p.status !== 'publicado') { UI.toast('Publique na sua revista antes de enviar à principal.', 'error'); return; }
    if (p.principal_status === 'aprovado') { UI.toast('Esta página já está na revista principal.', 'info'); return; }
    if (p.principal_status === 'pendente') { UI.toast('Já enviada — aguardando aprovação da SME.', 'info'); return; }
    try {
      await Api.paginas.enviarParaPrincipal(p.id);
      p.principal_status = 'pendente';
      UI.toast('Enviado! Aguarde a aprovação da SME.', 'success');
      _refreshStatus();
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function _refreshStatus() {
    const sb = document.getElementById('ed-status-badge');
    if (sb) sb.innerHTML = _statusBadge();
    const list = document.getElementById('ed-pages-list');
    if (list) list.innerHTML = _renderPagesList();
  }

  function deletePage() {
    const p = _cur();
    UI.confirm('Excluir esta página?', async () => {
      try {
        if (p.id) await Api.paginas.setStatus(p.id, 'excluido');
        _s.pages.splice(_s.current, 1);
        if (!_s.pages.length) _s.pages = [_novaPagina()];
        _s.current = Math.max(0, _s.current - 1);
        UI.toast('Página excluída.', 'info');
        render(document.getElementById('main-content'), _s.params);
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function preview() {
    Router.navigate('revista', { ..._s.params });
  }

  function openDrive(tipo) {
    UI.modal(`
      <div class="modal-title">Mídia — ${UI._esc(tipo)}</div>
      <p class="modal-text">Selecione arquivos para enviar ao Storage.</p>
      <input type="file" id="ed-file-input" class="input" multiple
        ${tipo === 'fotos' ? 'accept="image/*"' : tipo === 'videos' ? 'accept="video/*"' : ''}>
      <div id="ed-upload-status" class="ed-upload-status"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Fechar</button>
        <button class="btn btn-primary" onclick="EditorView.doUpload('${tipo}')">Enviar</button>
      </div>
    `);
  }

  async function doUpload(tipo) {
    const input = document.getElementById('ed-file-input');
    const status = document.getElementById('ed-upload-status');
    if (!input?.files?.length) { UI.toast('Selecione ao menos um arquivo.', 'error'); return; }
    const urls = [];
    for (const file of input.files) {
      status.textContent = `Enviando ${file.name}...`;
      try {
        const { url } = await Api.storage.uploadArquivo(_s.params.unidadeId, _s.params.temaId, tipo, file);
        urls.push(url);
      } catch (err) { UI.toast(`${file.name}: ${err.message}`, 'error'); }
    }
    if (urls.length && tipo === 'fotos') {
      _cur().conteudo = _cur().conteudo || {};
      _cur().conteudo.galeria = [...(_cur().conteudo.galeria || []), ...urls];
      _s.dirty = true;
      _refreshPreview();
      document.getElementById('ed-fields').innerHTML = _renderFields();
    }
    UI.closeModal();
    UI.toast(`${urls.length} arquivo(s) enviado(s).`, 'success');
  }

  return {
    render, onField, onTitleChange, setLayout, setColor,
    addPage, goToPage, prevPage, nextPage,
    save, publish, enviarPrincipal, deletePage, preview, openDrive, doUpload,
  };
})();
