/* ============================================================
   app.js — inicialização + fluxo de autenticação (sempre por último)
   ============================================================ */
(async () => {
  const $ = (id) => document.getElementById(id);
  const show = (id, disp = 'block') => { const e = $(id); if (e) e.style.display = disp; };
  const hide = (id) => { const e = $(id); if (e) e.style.display = 'none'; };

  function showLogin() {
    hide('app'); hide('app-no-access'); hide('app-loading');
    show('app-login', 'flex');
  }
  function showNoAccess(msg) {
    hide('app'); hide('app-login'); hide('app-loading');
    const m = $('no-access-msg'); if (m && msg) m.textContent = msg;
    show('app-no-access', 'flex');
  }

  // Botões da tela de login / sem acesso
  $('btn-google-login')?.addEventListener('click', async () => {
    try { await SupabaseClient.auth.signInWithGoogle(); }
    catch (err) { UI.toast(err.message, 'error'); }
  });
  $('btn-logout')?.addEventListener('click', logout);
  $('btn-no-access-logout')?.addEventListener('click', logout);
  $('tb-back')?.addEventListener('click', () => Router.goBack());
  $('tb-admin')?.addEventListener('click', () => Router.navigate('admin', {}));

  async function logout() {
    try { await SupabaseClient.auth.signOut(); } catch (_) {}
    Store.cacheInvalidateAll();
    window.location.reload();
  }

  // Registra as views no Router
  Router.register('secretaria', SecretariaView);
  Router.register('tema',       TemaView);
  Router.register('revista',    RevistaView);
  Router.register('editor',     EditorView);
  Router.register('admin',      AdminView);

  try {
    // 1-2. processa callback OAuth e pega sessão
    await SupabaseClient.handleAuthCallback();
    const session = await SupabaseClient.auth.getSession();

    // 3-4. sem sessão → login
    if (!session) { showLogin(); return; }

    // 5. busca perfil
    let perfil = null;
    try { perfil = await SupabaseClient.getUserProfile(session.user.id); }
    catch (err) { showNoAccess('Erro ao verificar acesso: ' + err.message); return; }

    // 6. não cadastrado
    if (!perfil) { showNoAccess('Seu e-mail (' + session.user.email + ') não está cadastrado.'); return; }
    // 7. inativo
    if (!perfil.ativo) { showNoAccess('Usuário inativo. Procure a Secretaria.'); return; }

    // carrega config
    let config = {};
    try { config = await Api.config.getAll(); } catch (_) {}

    // 8. init store
    Store.init({
      id: perfil.id, email: perfil.email, nome: perfil.nome,
      perfil: perfil.perfil, unidade_id: perfil.unidade_id,
    }, config);
    SupabaseClient.touchUltimoAcesso(perfil.id);

    // 9. topbar
    $('tb-user').textContent = perfil.nome || perfil.email;
    $('tb-admin').style.display = Store.isSecretaria() ? 'inline-flex' : 'none';

    // 10. mostra app + navega
    hide('app-loading'); hide('app-login'); hide('app-no-access');
    show('app', 'block');

    // suporta deep-link do 404.html (?redirect=...) — fallback simples
    Router.navigate('secretaria', {}, false);

  } catch (err) {
    console.error('[app init]', err);
    showNoAccess('Erro de inicialização: ' + err.message);
  }
})();
