/* ============================================================================
   app.js — inicialização + fluxo de acesso (sempre por último)

   Em produção quem autentica é o Controle de Acesso CENTRAL (js/central.js).
   A tela de login deste app existe apenas como saída de emergência: no caminho
   normal o central redireciona antes de ela aparecer.
   ============================================================================ */
(async () => {
  const $ = (id) => document.getElementById(id);
  const show = (id, disp = 'block') => { const e = $(id); if (e) e.style.display = disp; };
  const hide = (id) => { const e = $(id); if (e) e.style.display = 'none'; };

  function showLogin(msg) {
    hide('app'); hide('app-no-access'); hide('app-loading');
    if (msg) { const s = document.querySelector('#app-login .login-hint'); if (s) s.textContent = msg; }
    show('app-login', 'flex');
  }
  function showNoAccess(msg) {
    hide('app'); hide('app-login'); hide('app-loading');
    const m = $('no-access-msg'); if (m && msg) m.textContent = msg;
    show('app-no-access', 'flex');
  }

  // Botões da tela de login / sem acesso
  $('btn-google-login')?.addEventListener('click', () => { window.location.reload(); });
  $('btn-logout')?.addEventListener('click', logout);
  $('btn-no-access-logout')?.addEventListener('click', logout);
  $('tb-back')?.addEventListener('click', () => Router.goBack());
  $('tb-admin')?.addEventListener('click', () => Router.navigate('admin', {}));

  async function logout() {
    Store.cacheInvalidateAll();
    if (CONFIG.DEMO_MODE) { window.location.reload(); return; }
    try { await SupabaseClient.auth.signOut(); }
    catch (_) { window.location.reload(); }
  }

  // Registra as views no Router
  Router.register('secretaria', SecretariaView);
  Router.register('tema',       TemaView);
  Router.register('revista',    RevistaView);
  Router.register('editor',     EditorView);
  Router.register('admin',      AdminView);

  // ⚠️ Link direto NÃO existe neste app, e o `?redirect=` do 404.html não tem
  // o que restaurar: o Router guarda a rota só em memória (Store), sem nunca
  // escrever na barra de endereço. Fazer o deep-link funcionar é trabalho no
  // Router — pôr a rota na URL —, não de ler o parâmetro aqui.

  function abrirApp(rotuloUsuario, ehSecretaria) {
    $('tb-user').textContent = rotuloUsuario;
    $('tb-admin').style.display = ehSecretaria ? 'inline-flex' : 'none';
    hide('app-loading'); hide('app-login'); hide('app-no-access');
    show('app', 'block');
    Router.navigate('secretaria', {}, false);
  }

  try {
    // ── MODO DEMONSTRAÇÃO ──────────────────────────────────
    // Sem login: entra como Secretaria (vê tudo) usando dados de exemplo.
    if (CONFIG.DEMO_MODE) {
      const config = await Api.config.getAll();
      Store.init({ id: 'demo', email: 'demo@portfolio.mag', nome: 'Modo Demonstração',
        perfil: 'secretaria', unidade_id: null }, config);
      UI.toast('Modo demonstração — dados de exemplo, sem banco.', 'info');
      abrirApp('Demonstração', true);
      return;
    }

    // ── 1. Sessão pelo CENTRAL, via central-bridge ─────────
    let entrada;
    try {
      entrada = await CentralSME.entrar();
    } catch (err) {
      showNoAccess(err.message);
      return;
    }
    // null = o central assumiu a tela (redirecionou ou pintou o aviso).
    if (!entrada) return;

    const session = await SupabaseClient.auth.getSession();
    if (!session) { showLogin('A sessão não foi instalada. Recarregue a página.'); return; }

    // ── 2. Perfil e configuração, EM PARALELO ──────────────
    // Nenhuma das duas depende da outra; encadeá-las custava uma ida inteira ao
    // banco em toda abertura. A config é opcional (a revista abre sem ela), o
    // perfil não é — daí os desfechos diferentes logo abaixo.
    const [rPerfil, rConfig] = await Promise.allSettled([
      SupabaseClient.getUserProfile(session.user.id),
      Api.config.getAll(),
    ]);
    if (rPerfil.status === 'rejected') {
      showNoAccess('Erro ao verificar seu perfil: ' + rPerfil.reason.message);
      return;
    }
    const perfil = rPerfil.value;
    const config = rConfig.status === 'fulfilled' ? rConfig.value : {};

    // ⚠️ Aqui NÃO é "sem acesso": o central já confirmou o acesso à revista.
    // Perfil ausente significa que a sincronização da ponte falhou, e dizer
    // "você não tem permissão" mandaria quem for investigar para o lado errado.
    if (!perfil) {
      showNoAccess('Seu acesso foi confirmado no central, mas o perfil não foi criado na revista. '
                 + 'Recarregue a página; se persistir, avise a equipe (falha de sincronização da ponte).');
      return;
    }
    if (!perfil.ativo) { showNoAccess('Usuário inativo. Procure a Secretaria.'); return; }

    Store.init({
      id: perfil.id, email: perfil.email, nome: perfil.nome,
      perfil: perfil.perfil, unidade_id: perfil.unidade_id,
    }, config);

    const rotulo = (perfil.nome || perfil.email) + (entrada.simulando ? ' (simulando)' : '');
    abrirApp(rotulo, Store.isSecretaria());

  } catch (err) {
    console.error('[app init]', err);
    showNoAccess('Erro de inicialização: ' + err.message);
  }
})();
