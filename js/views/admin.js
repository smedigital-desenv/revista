/* ============================================================
   views/admin.js — Painel administrativo (exclusivo secretaria)
   ============================================================ */
const AdminView = (() => {

  async function render(container) {
    if (!Store.isSecretaria()) { Router.navigate('secretaria', {}, false); return; }

    const { stats, inscricoes_pendentes, paginas_principal } = await Api.admin.getDashboard();

    container.innerHTML = `
    <div id="view-admin" class="view-pad">
      <div class="admin-header">
        <div>
          <h2 class="admin-title">Painel Administrativo</h2>
          <p class="admin-sub">Gerencie inscrições, revisões e publicações</p>
        </div>
        ${UI.btn('🔔 Notificar unidades', { type: 'outline', size: 'sm', onclick: 'AdminView.notificar()' })}
      </div>

      <div class="stats-grid">
        ${UI.statCard(stats.total_unidades, 'Unidades', 'var(--c1)')}
        ${UI.statCard(stats.total_temas, 'Temas', 'var(--c2)')}
        ${UI.statCard(stats.total_publicadas, 'Publicadas (escolas)', 'var(--c6)')}
        ${UI.statCard(stats.total_na_principal, 'Na revista principal', 'var(--c4)')}
        ${UI.statCard(stats.total_principal_pend, 'Aguardando aprovação', 'var(--c3)')}
        ${UI.statCard(stats.total_inscr_pend, 'Inscrições pendentes', 'var(--c5)')}
      </div>

      <div class="admin-cols">
        <div class="admin-panel card">
          <div class="admin-panel-head">
            <span>Inscrições pendentes</span>
            <span class="admin-count">${inscricoes_pendentes.length}</span>
          </div>
          <div class="admin-panel-body">
            ${inscricoes_pendentes.length
              ? inscricoes_pendentes.map(_inscRow).join('')
              : `<div class="empty-state-sm">Nenhuma inscrição pendente.</div>`}
          </div>
        </div>

        <div class="admin-panel card">
          <div class="admin-panel-head">
            <span>Aprovar para a revista principal</span>
            <span class="admin-count">${paginas_principal.length}</span>
          </div>
          <div class="admin-panel-body">
            ${paginas_principal.length
              ? paginas_principal.map(_principalRow).join('')
              : `<div class="empty-state-sm">Nenhuma página aguardando aprovação.</div>`}
          </div>
        </div>
      </div>
    </div>`;
  }

  function _inscRow(i) {
    return `<div class="admin-item">
      <div class="admin-item-info">
        <div class="admin-item-t">${UI._esc(i.unidade_nome)}</div>
        <div class="admin-item-s">${UI._esc(i.tema_nome)}</div>
      </div>
      <div class="admin-item-actions">
        <button class="icon-btn icon-ok" title="Aprovar" onclick="AdminView.aprovarInscricao('${i.id}')">✓</button>
        <button class="icon-btn icon-no" title="Recusar" onclick="AdminView.recusarInscricao('${i.id}')">✗</button>
      </div>
    </div>`;
  }

  function _principalRow(p) {
    return `<div class="admin-item">
      <div class="admin-item-info">
        <div class="admin-item-t">${UI._esc(p.titulo)}</div>
        <div class="admin-item-s">${UI._esc(p.unidade_nome)} · ${UI._esc(p.tema_nome)}</div>
      </div>
      <div class="admin-item-actions">
        <button class="icon-btn icon-no" title="Recusar" onclick="AdminView.recusarPrincipal('${p.id}')">✗</button>
        ${UI.btn('Aprovar', { type: 'editor', size: 'sm', onclick: `AdminView.aprovarPrincipal('${p.id}')` })}
      </div>
    </div>`;
  }

  async function aprovarInscricao(id) {
    try {
      await Api.inscricoes.setStatus(id, 'aprovado');
      UI.toast('Inscrição aprovada!', 'success');
      Store.cacheInvalidate('admin_dashboard', 'secretaria_data');
      render(document.getElementById('main-content'));
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function recusarInscricao(id) {
    UI.confirm('Recusar esta inscrição?', async () => {
      try {
        await Api.inscricoes.setStatus(id, 'recusado');
        UI.toast('Inscrição recusada.', 'info');
        Store.cacheInvalidate('admin_dashboard');
        render(document.getElementById('main-content'));
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  async function aprovarPrincipal(paginaId) {
    try {
      await Api.paginas.setPrincipalStatus(paginaId, 'aprovado');
      UI.toast('Página aprovada na revista principal!', 'success');
      Store.cacheInvalidate('admin_dashboard');
      render(document.getElementById('main-content'));
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function recusarPrincipal(paginaId) {
    UI.confirm('Recusar esta página na revista principal?', async () => {
      try {
        await Api.paginas.setPrincipalStatus(paginaId, 'recusado');
        UI.toast('Página recusada.', 'info');
        Store.cacheInvalidate('admin_dashboard');
        render(document.getElementById('main-content'));
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function notificar() { UI.toast('Notificações por e-mail: em breve.', 'info'); }

  return { render, aprovarInscricao, recusarInscricao, aprovarPrincipal, recusarPrincipal, notificar };
})();
