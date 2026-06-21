/* ============================================================
   views/secretaria.js — Nível 1: capa com hero + grid de temas
   ============================================================ */
const SecretariaView = (() => {

  async function render(container) {
    const { config, temas } = await Api.secretaria.getData();

    const nome   = config.nome_secretaria || 'Secretaria de Educação';
    const cidade = config.cidade || 'Ribeirão Preto · SP';
    const desc   = config.descricao || 'Revista digital das unidades escolares';
    const edicao = config.edicao || '—';

    const totalUnidades = temas.reduce((s, t) => s + (t.total_unidades || 0), 0);
    const totalPaginas  = temas.reduce((s, t) => s + (t.total_paginas || 0), 0);

    const novoCard = Store.isSecretaria()
      ? `<div class="tema-card tema-card-new" onclick="SecretariaView.modalNovoTema()">
           <div class="tc-new-plus">+</div><div class="tc-new-label">Novo tema</div>
         </div>` : '';

    container.innerHTML = `
    <div id="view-secretaria" class="view-pad">
      <section class="hero">
        <div class="hero-blobs">
          <span class="blob blob-1"></span><span class="blob blob-2"></span><span class="blob blob-3"></span>
        </div>
        <div class="hero-content">
          <div class="eyebrow">📍 ${UI._esc(cidade)}</div>
          <h1 class="hero-title">${UI._esc(nome)}</h1>
          <p class="hero-sub">${UI._esc(desc)}</p>
          <div class="hero-stats">
            ${UI.statCard(temas.length, 'Temas', 'var(--c1)')}
            ${UI.statCard(totalUnidades, 'Unidades', 'var(--c3)')}
            ${UI.statCard(totalPaginas, 'Publicações', 'var(--c6)')}
            ${UI.statCard(edicao, 'Edição', 'var(--c2)')}
          </div>
        </div>
      </section>

      <section class="temas-section">
        ${UI.sectionLabel('🎯', 'Temas desta edição')}
        <div class="temas-grid">
          ${temas.map(_temaCard).join('')}
          ${novoCard}
        </div>
        ${(!temas.length && !Store.isSecretaria())
          ? `<div class="empty-state">Nenhum tema publicado ainda.</div>` : ''}
      </section>
    </div>`;
  }

  function _temaCard(t) {
    const cor = t.cor || '#FF6B35';
    const params = encodeURIComponent(JSON.stringify({ temaId: t.id, temaNome: t.nome }));
    return `<div class="tema-card" onclick="Router.navigate('tema', JSON.parse(decodeURIComponent('${params}')))">
      ${t.novo ? `<span class="tema-badge-novo">Novo</span>` : ''}
      <div class="tema-icon" style="background:${cor}18;color:${cor}">${t.icone || '🎯'}</div>
      <h3 class="tema-nome">${UI._esc(t.nome)}</h3>
      <p class="tema-desc">${UI._esc(t.descricao || '')}</p>
      <div class="tema-meta">
        <span>🏫 ${t.total_unidades || 0}</span>
        <span title="Páginas publicadas pelas escolas">📄 ${t.total_paginas || 0}</span>
        <span title="Na revista principal">★ ${t.total_principal || 0}</span>
        ${t.tag ? `<span class="tema-tag" style="color:${cor}">${UI._esc(t.tag)}</span>` : ''}
      </div>
    </div>`;
  }

  function modalNovoTema() {
    UI.modal(`
      <div class="modal-title">Novo tema</div>
      <div class="modal-body">
        ${UI.formGroup('Nome *', `<input id="nt-nome" class="input" placeholder="Ex: Boas Práticas da Cozinha">`)}
        ${UI.formGroup('Descrição *', `<textarea id="nt-desc" class="input" rows="2" placeholder="Breve descrição"></textarea>`)}
        <div class="form-row">
          ${UI.formGroup('Ícone', `<input id="nt-icone" class="input" maxlength="4" placeholder="🍎">`)}
          ${UI.formGroup('Tag', `<input id="nt-tag" class="input" placeholder="Alimentação">`)}
        </div>
        ${UI.formGroup('Cor', UI.colorPicker('#FF6B35', 'SecretariaView.setCor'))}
        <input type="hidden" id="nt-cor" value="#FF6B35">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="SecretariaView.salvarTema()">Criar tema</button>
      </div>
    `);
  }

  function setCor(cor) {
    document.getElementById('nt-cor').value = cor;
    document.querySelectorAll('#modal-overlay .color-swatch').forEach((s) => {
      s.classList.toggle('active', s.style.background === cor || s.title === cor);
    });
  }

  async function salvarTema() {
    const nome = document.getElementById('nt-nome').value.trim();
    const descricao = document.getElementById('nt-desc').value.trim();
    if (!nome || !descricao) { UI.toast('Nome e descrição são obrigatórios.', 'error'); return; }
    const payload = {
      nome, descricao,
      icone: document.getElementById('nt-icone').value.trim() || '🎯',
      tag:   document.getElementById('nt-tag').value.trim(),
      cor:   document.getElementById('nt-cor').value,
      novo:  true,
    };
    try {
      await Api.temas.criar(payload);
      UI.closeModal();
      UI.toast('Tema criado!', 'success');
      render(document.getElementById('main-content'));
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  return { render, modalNovoTema, setCor, salvarTema };
})();
