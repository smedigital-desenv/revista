/* ============================================================
   views/tema.js — Nível 2: hero do tema + carrossel + lista de unidades
   ============================================================ */
const TemaView = (() => {
  let _ctx = {};

  async function render(container, params) {
    _ctx = params || {};
    const { tema, unidades } = await Api.temas.getData(params.temaId);
    const cor = tema.cor || '#C2603F';

    const totalPaginas = unidades.reduce((s, u) => s + (u.total_pags || 0), 0);
    const totalPrincipal = unidades.reduce((s, u) => s + (u.total_principal || 0), 0);
    const destaques = unidades.filter((u) => u.na_principal);

    // botão de ação por perfil
    let acaoBtn = '';
    if (Store.isSecretaria()) {
      acaoBtn = UI.btn('+ Adicionar unidade', { type: 'outline', onclick: `TemaView.adicionarUnidade()` });
    } else if (Store.getUser()?.unidade_id) {
      const jaInscrita = unidades.some((u) => u.id === Store.getUser().unidade_id);
      if (!jaInscrita) {
        acaoBtn = UI.btn('Inscrever minha unidade', { type: 'primary',
          onclick: `TemaView.solicitarInscricao('${tema.id}')` });
      }
    }

    container.innerHTML = `
    <div id="view-tema" class="view-pad">
      <section class="tema-hero" style="--tema-cor:${cor}">
        <div class="tema-hero-blob" style="background:${cor}"></div>
        <span class="tema-hero-chip" style="background:${cor}">
          ${tema.icone || '🎯'} ${UI._esc(tema.tag || tema.nome)}
        </span>
        <h1 class="tema-hero-title">${UI._esc(tema.nome)}</h1>
        <p class="tema-hero-desc">${UI._esc(tema.descricao || '')}</p>
        <div class="tema-hero-stats">
          <span><b>${unidades.length}</b> unidades</span>
          <span><b>${totalPaginas}</b> páginas</span>
          <span><b>${totalPrincipal}</b> na principal</span>
        </div>
      </section>

      <section class="carrossel-section">
        ${UI.sectionLabel('★', 'Em destaque na revista principal')}
        ${destaques.length ? `
          <div class="carrossel-wrap">
            <button class="carr-btn carr-prev" onclick="TemaView.scrollCarr(-1)">‹</button>
            <div id="carrossel" class="carrossel">
              ${destaques.map((u) => _pubCard(u, cor)).join('')}
            </div>
            <button class="carr-btn carr-next" onclick="TemaView.scrollCarr(1)">›</button>
          </div>` : `<div class="empty-state">Nenhuma publicação aprovada na revista principal ainda.</div>`}
      </section>

      <section class="unidades-section">
        ${UI.sectionLabel('🏫', 'Revistas das escolas')}
        <div class="unidades-list">
          ${unidades.map((u) => _unidadeRow(u)).join('')}
        </div>
        ${acaoBtn ? `<div class="unidades-acao">${acaoBtn}</div>` : ''}
      </section>
    </div>`;
  }

  function _navParams(u, scope) {
    return encodeURIComponent(JSON.stringify({
      temaId: _ctx.temaId, temaNome: _ctx.temaNome,
      unidadeId: u.id, unidadeNome: u.nome, scope: scope || 'escola',
    }));
  }

  function _pubCard(u, cor) {
    const ucor = u.cor || cor;
    return `<div class="pub-card" onclick="Router.navigate('revista', JSON.parse(decodeURIComponent('${_navParams(u, 'principal')}')))">
      <div class="pub-card-cover" style="background:linear-gradient(135deg,${ucor},${ucor}99)">
        <span class="pub-card-sigla">${UI._esc(u.sigla)}</span>
      </div>
      <div class="pub-card-body">
        <div class="pub-card-nome">${UI._esc(u.nome)}</div>
        <div class="pub-card-meta">★ ${u.total_principal} na principal</div>
      </div>
    </div>`;
  }

  function _unidadeRow(u) {
    const cor = u.cor || '#7A7D2A';
    const n = u.total_pags || 0;
    const thumbs = Array.from({ length: Math.min(n, 4) }).map((_, i) =>
      `<span class="ur-thumb" style="border-color:${cor};color:${cor}">${i + 1}</span>`).join('') +
      (n > 4 ? `<span class="ur-thumb ur-thumb-more">+${n - 4}</span>` : '');
    return `<div class="unidade-row" onclick="Router.navigate('revista', JSON.parse(decodeURIComponent('${_navParams(u, 'escola')}')))">
      <div class="ur-avatar" style="background:${cor}">${UI._esc(u.sigla)}</div>
      <div class="ur-info">
        <div class="ur-nome">${UI._esc(u.nome)}</div>
        <div class="ur-cidade">${UI._esc(u.cidade || '')}</div>
      </div>
      <div class="ur-thumbs">${thumbs}</div>
      <div class="ur-arrow">›</div>
    </div>`;
  }

  function scrollCarr(dir) {
    const el = document.getElementById('carrossel');
    if (el) el.scrollBy({ left: dir * 165, behavior: 'smooth' });
  }

  async function solicitarInscricao(temaId) {
    try {
      await Api.inscricoes.solicitar(Store.getUser().unidade_id, temaId);
      UI.toast('Solicitação enviada! Aguarde aprovação.', 'success');
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function adicionarUnidade() {
    UI.toast('Cadastro de unidades: em breve no painel Admin.', 'info');
  }

  return { render, scrollCarr, solicitarInscricao, adicionarUnidade };
})();
