/* ============================================================
   views/admin.js — Painel administrativo (exclusivo secretaria)
   ============================================================ */
const AdminView = (() => {

  async function render(container) {
    if (!Store.isSecretaria()) { Router.navigate('secretaria', {}, false); return; }

    const { stats, inscricoes_pendentes, paginas_revisao } = await Api.admin.getDashboard();

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
        ${UI.statCard(stats.total_publicadas, 'Publicadas', 'var(--c6)')}
        ${UI.statCard(stats.total_em_revisao, 'Em revisão', 'var(--c3)')}
        ${UI.statCard(stats.total_rascunhos, 'Rascunhos', 'var(--muted)')}
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
            <span>Aguardando revisão</span>
            <span class="admin-count">${paginas_revisao.length}</span>
          </div>
          <div class="admin-panel-body">
            ${paginas_revisao.length
              ? paginas_revisao.map(_revRow).join('')
              : `<div class="empty-state-sm">Nenhuma página em revisão.</div>`}
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

  function _revRow(p) {
    return `<div class="admin-item">
      <div class="admin-item-info">
        <div class="admin-item-t">${UI._esc(p.titulo)}</div>
        <div class="admin-item-s">${UI._esc(p.unidade_nome)} · ${UI._esc(p.tema_nome)}</div>
      </div>
      <div class="admin-item-actions">
        ${UI.btn('Publicar', { type: 'primary', size: 'sm', onclick: `AdminView.publicar('${p.id}')` })}
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

  async function publicar(paginaId) {
    try {
      await Api.paginas.setStatus(paginaId, 'publicado');
      UI.toast('Página publicada!', 'success');
      Store.cacheInvalidate('admin_dashboard');
      render(document.getElementById('main-content'));
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function notificar() { UI.toast('Notificações por e-mail: em breve.', 'info'); }

  return { render, aprovarInscricao, recusarInscricao, publicar, notificar };
})();
