/* ============================================================
   supabase.js — cliente Supabase + helpers de autenticação (Google OAuth)
   Depende de: config.js e do SDK supabase-js carregado via CDN.
   ============================================================ */
const SupabaseClient = (() => {
  // Cliente único (singleton)
  const client = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );

  const auth = {
    // Inicia OAuth Google — redireciona para o Google e volta para esta página
    signInWithGoogle: async () => {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw new Error(error.message);
    },

    signOut: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },

    getSession: async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(error.message);
      return data.session;
    },

    getUser: async () => {
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      return data.user;
    },

    onAuthStateChange: (cb) => client.auth.onAuthStateChange(cb),
  };

  // Busca o perfil do usuário na tabela `usuarios` pelo id do auth
  async function getUserProfile(userId) {
    const { data, error } = await client
      .from('usuarios')
      .select('id, email, nome, perfil, unidade_id, ativo')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data; // null se não cadastrado
  }

  // Registra/atualiza último acesso (best-effort, ignora erro)
  async function touchUltimoAcesso(userId) {
    try {
      await client.from('usuarios')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', userId);
    } catch (_) { /* silencioso */ }
  }

  // Processa o retorno do OAuth (detectSessionInUrl já trata; isto limpa a URL)
  async function handleAuthCallback() {
    const session = await auth.getSession();
    if (session && (window.location.search.includes('code=') || window.location.hash.includes('access_token'))) {
      // remove parâmetros sensíveis da URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return session;
  }

  return { client, auth, getUserProfile, touchUltimoAcesso, handleAuthCallback };
})();
