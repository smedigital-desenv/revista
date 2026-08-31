/* ============================================================================
   supabase.js — cliente Supabase da revista.
   Depende de: config.js e do SDK supabase-js carregado via CDN.

   ⚠️ NÃO existe login próprio aqui. A autenticação da rede acontece no
   Controle de Acesso CENTRAL, e a sessão DESTE projeto é aberta pela Edge
   Function `central-bridge` — ver js/central.js. O que este arquivo faz é
   manter o cliente e ler o perfil que a ponte já sincronizou.

   O login com Google que existia aqui foi removido em favor do central: era o
   único sistema da rede com autenticação própria, e duas portas de entrada
   significam duas listas de quem pode entrar, que divergem na primeira
   mudança feita só numa.
   ============================================================================ */
const SupabaseClient = (() => {
  // Cliente único (singleton). Em modo demonstração (ou sem SDK) fica null e
  // não é usado — o Api delega tudo para o MockApi.
  const client = (!CONFIG.DEMO_MODE && window.supabase)
    ? window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
      )
    : null;

  const auth = {
    signOut: async () => {
      try { await client?.auth.signOut(); } catch (_) { /* segue para o central */ }
      // Sair da revista sem sair do central deixaria a pessoa presa num
      // meio-termo: sem sessão aqui, com sessão lá, e o próximo carregamento a
      // traria de volta sem pedir nada.
      CentralSME.sair();
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

  // Perfil da pessoa neste banco. A linha é escrita pela `central-bridge` a
  // cada acesso (RPC `sincronizar_do_central`), nunca pelo navegador: a tabela
  // `usuarios` não tem permissão de escrita para `authenticated`.
  //
  // Devolver null aqui significa que a ponte não sincronizou — e não que a
  // pessoa não tem acesso. São coisas diferentes, e o app avisa como tal.
  async function getUserProfile(userId) {
    const { data, error } = await client
      .from('usuarios')
      .select('id, email, nome, perfil, unidade_id, ativo')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  // `ultimo_acesso` é gravado pela PONTE, com service_role, junto da
  // sincronização. Não tente atualizá-lo daqui: `authenticated` não tem UPDATE
  // em `usuarios`, e a chamada seria um 403 a cada carregamento de página.

  return { client, auth, getUserProfile };
})();
