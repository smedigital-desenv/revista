/* ============================================================
   views/admin.js — Painel administrativo (exclusivo secretaria)
   ============================================================ */
const AdminView = (() => {

  // Cache da lista para os modais não terem de reconsultar a cada abertura.
  let _unidades = [];

  async function render(container) {
    if (!Store.isSecretaria()) { Router.navigate('secretaria', {}, false); return; }

    const [dash, unidades] = await Promise.all([
      Api.admin.getDashboard(),
      Api.unidades.listar().catch((err) => {
        console.error('[admin] falha ao listar unidades', err);
        return null;   // null = não consegui ler; [] seria "não há nenhuma"
      }),
    ]);
    const { stats, inscricoes_pendentes, paginas_principal } = dash;
    _unidades = unidades || [];

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

      <div class="admin-panel card">
        <div class="admin-panel-head">
          <span>Unidades</span>
          <span class="admin-count">${unidades ? unidades.length : '—'}</span>
          <div class="admin-panel-acoes">
            ${UI.btn('Importar do central', { type: 'outline', size: 'sm', onclick: 'AdminView.modalImportar()' })}
            ${UI.btn('+ Nova unidade', { type: 'primary', size: 'sm', onclick: 'AdminView.modalUnidade()' })}
          </div>
        </div>
        <div class="admin-panel-body">
          ${unidades === null
            ? `<div class="empty-state-sm">Não foi possível ler as unidades. Recarregue a página.</div>`
            : unidades.length
              ? unidades.map(_unidadeRow).join('')
              : `<div class="empty-state-sm">Nenhuma unidade cadastrada. Comece por
                 <b>Importar do central</b> — assim o vínculo com o catálogo vem certo.</div>`}
        </div>
      </div>
    </div>`;
  }

  // ⚠️ A coluna que importa aqui é o VÍNCULO. Unidade sem `escola_central_id`
  // não recebe ninguém: a ponte casa pessoa e unidade por esse id (e, como
  // reserva, por nome exatamente igual). O sintoma de um id faltando é uma
  // escola que ninguém consegue editar, sem erro em lugar nenhum — por isso ele
  // aparece na lista, e em vermelho quando falta.
  function _unidadeRow(u) {
    const inativa = u.status !== 'ativo';
    return `<div class="admin-item${inativa ? ' admin-item-off' : ''}">
      <div class="admin-item-avatar" style="background:${UI._esc(u.cor || '#1B3A6B')}">
        ${UI._esc(u.sigla || '—')}
      </div>
      <div class="admin-item-info">
        <div class="admin-item-t">${UI._esc(u.nome)}</div>
        <div class="admin-item-s">
          ${UI._esc(u.cidade || '')}${u.regiao ? ' · ' + UI._esc(u.regiao) : ''}
          ${u.escola_central_id
            ? ` · vínculo #${UI._esc(u.escola_central_id)}`
            : ` · <b class="admin-alerta">sem vínculo com o central</b>`}
          ${inativa ? ' · inativa' : ''}
        </div>
      </div>
      <div class="admin-item-actions">
        ${UI.btn('Editar', { type: 'ghost', size: 'sm', onclick: `AdminView.modalUnidade('${u.id}')` })}
        ${UI.btn(inativa ? 'Reativar' : 'Inativar', { type: 'ghost', size: 'sm',
            onclick: `AdminView.alternarUnidade('${u.id}', '${inativa ? 'ativo' : 'inativo'}')` })}
      </div>
    </div>`;
  }

  // ── Cadastro manual ─────────────────────────────────────
  function modalUnidade(id) {
    const u = _unidades.find((x) => x.id === id) || {};
    const cor = u.cor || CONFIG.CORES[0];
    UI.modal(`
      <div class="modal-title">${id ? 'Editar unidade' : 'Nova unidade'}</div>
      <div class="modal-body">
        ${UI.formGroup('Nome *', `<input id="un-nome" class="input" value="${UI._esc(u.nome || '')}"
          placeholder="Como aparece no catálogo do central">`)}
        <div class="form-row">
          ${UI.formGroup('Sigla', `<input id="un-sigla" class="input" maxlength="6"
            value="${UI._esc(u.sigla || '')}" placeholder="EPA">`)}
          ${UI.formGroup('Vínculo com o central', `<input id="un-central" class="input" inputmode="numeric"
            value="${UI._esc(u.escola_central_id ?? '')}" placeholder="id da escola no central">`)}
        </div>
        <div class="form-row">
          ${UI.formGroup('Cidade', `<input id="un-cidade" class="input"
            value="${UI._esc(u.cidade || 'Ribeirão Preto')}">`)}
          ${UI.formGroup('Região', `<input id="un-regiao" class="input" value="${UI._esc(u.regiao || '')}">`)}
        </div>
        ${UI.formGroup('Cor', UI.colorPicker(cor, 'AdminView.setCorUnidade'))}
        <input type="hidden" id="un-cor" value="${UI._esc(cor)}">
        <p class="form-ajuda">O <b>vínculo</b> é o que permite à escola editar a própria revista.
        Sem ele, ninguém alcança esta unidade. Prefira <b>Importar do central</b>, que o preenche sozinho.</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="AdminView.salvarUnidade('${id || ''}')">
          ${id ? 'Salvar' : 'Criar unidade'}</button>
      </div>`);
  }

  function setCorUnidade(cor) {
    document.getElementById('un-cor').value = cor;
    document.querySelectorAll('#modal-overlay .color-swatch').forEach((el) => {
      el.classList.toggle('active', el.title === cor);
    });
  }

  async function salvarUnidade(id) {
    const v = (x) => document.getElementById(x).value.trim();
    const nome = v('un-nome');
    if (!nome) { UI.toast('O nome é obrigatório.', 'error'); return; }

    const central = v('un-central');
    if (central && !/^\d+$/.test(central)) {
      UI.toast('O vínculo com o central é um número (o id da escola lá).', 'error');
      return;
    }

    const payload = {
      nome,
      sigla:  v('un-sigla') || null,
      cidade: v('un-cidade') || null,
      regiao: v('un-regiao') || null,
      cor:    v('un-cor'),
      escola_central_id: central ? Number(central) : null,
    };
    try {
      if (id) await Api.unidades.atualizar(id, payload);
      else    await Api.unidades.criar(payload);
      UI.closeModal();
      UI.toast(id ? 'Unidade atualizada.' : 'Unidade criada.', 'success');
      render(document.getElementById('main-content'));
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function alternarUnidade(id, status) {
    const acao = status === 'ativo' ? 'Reativar' : 'Inativar';
    UI.confirm(`${acao} esta unidade?`, async () => {
      try {
        await Api.unidades.setStatus(id, status);
        UI.toast(`Unidade ${status === 'ativo' ? 'reativada' : 'inativada'}.`, 'info');
        render(document.getElementById('main-content'));
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  // ── Importação a partir do catálogo do central ──────────
  // É o caminho recomendado: o `escola_central_id` vem certo por construção, e
  // é ele que faz a escola conseguir editar a própria revista.
  async function modalImportar() {
    if (CONFIG.DEMO_MODE) {
      UI.toast('Importar do central não funciona no modo demonstração.', 'info');
      return;
    }
    UI.modal(`<div class="modal-title">Importar do central</div>
      <div class="modal-body"><div class="empty-state-sm">Lendo o catálogo do central...</div></div>`);

    let escolas;
    try { escolas = await CentralSME.escolasDoCentral(); }
    catch (err) {
      // O RLS do central pode não permitir esta leitura. Isso não é avaria da
      // revista, e a saída é o cadastro manual — dito com todas as letras, em
      // vez de uma lista vazia que parece "não há escolas".
      UI.modal(`<div class="modal-title">Importar do central</div>
        <div class="modal-body">
          <p>Não foi possível ler o catálogo de escolas do central:</p>
          <p class="form-ajuda">${UI._esc(err.message)}</p>
          <p>Isso costuma ser permissão no central, não defeito aqui. Enquanto não
          for liberado, cadastre pelo botão <b>+ Nova unidade</b>, informando o
          <b>vínculo</b> à mão.</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="UI.closeModal()">Fechar</button>
        </div>`);
      return;
    }

    const jaTem = new Set(_unidades.map((u) => Number(u.escola_central_id)).filter(Boolean));
    const faltando = escolas.filter((e) => !jaTem.has(Number(e.id)));

    UI.modal(`<div class="modal-title">Importar do central</div>
      <div class="modal-body">
        ${faltando.length ? `
          <p class="form-ajuda">${faltando.length} escola(s) do central ainda não estão na revista.
          ${escolas.length - faltando.length} já estão e ficam de fora da lista.</p>
          <div class="import-lista">
            ${faltando.map((e) => `<label class="import-item">
              <input type="checkbox" class="imp-check" value="${UI._esc(e.id)}"
                     data-nome="${UI._esc(e.nome)}" checked>
              <span>${UI._esc(e.nome)}</span>
            </label>`).join('')}
          </div>`
        : `<div class="empty-state-sm">Todas as escolas do central já estão cadastradas aqui.</div>`}
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Fechar</button>
        ${faltando.length ? UI.btn('Importar selecionadas', { type: 'primary',
            id: 'imp-btn', onclick: 'AdminView.importarSelecionadas()' }) : ''}
      </div>`);
  }

  async function importarSelecionadas() {
    const marcadas = [...document.querySelectorAll('.imp-check:checked')];
    if (!marcadas.length) { UI.toast('Selecione ao menos uma escola.', 'error'); return; }

    const btn = document.getElementById('imp-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }

    // Uma a uma, de propósito: se a décima falhar, as nove primeiras já valem,
    // e a mensagem diz exatamente quais não entraram.
    const falhas = [];
    let feitas = 0;
    for (const el of marcadas) {
      const nome = el.dataset.nome;
      try {
        await Api.unidades.criar({
          nome,
          escola_central_id: Number(el.value),
          sigla: _siglaDe(nome),
          cidade: 'Ribeirão Preto',
          cor: CONFIG.CORES[feitas % CONFIG.CORES.length],
        });
        feitas++;
      } catch (err) { falhas.push(`${nome}: ${err.message}`); }
    }

    UI.closeModal();
    if (falhas.length) {
      console.warn('[admin] não importadas:', falhas);
      UI.toast(`${feitas} importada(s); ${falhas.length} falhou(ram) — veja o console.`, 'error');
    } else {
      UI.toast(`${feitas} unidade(s) importada(s).`, 'success');
    }
    render(document.getElementById('main-content'));
  }

  // Sigla de partida, só para o avatar não nascer vazio: iniciais das palavras
  // que não são ligação nem sigla de tipo. É um chute, e a pessoa edita.
  const _IGNORAR = new Set(['DE','DA','DO','DAS','DOS','E','EMEF','EMEI','CEI','EMEIEF',
                            'PROF','PROFA','PROFº','DR','DRA','PREF']);
  function _siglaDe(nome) {
    const palavras = String(nome || '')
      .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
      .filter((p) => !_IGNORAR.has(p));
    return palavras.slice(0, 3).map((p) => p[0]).join('') || '—';
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

  return {
    render, aprovarInscricao, recusarInscricao, aprovarPrincipal, recusarPrincipal, notificar,
    modalUnidade, salvarUnidade, alternarUnidade, setCorUnidade,
    modalImportar, importarSelecionadas,
  };
})();
