/* ============================================================================
   central.js — entrada pelo Controle de Acesso CENTRAL da rede SME.

   A revista NÃO tem login próprio. Quem governa quem entra é o central
   (smedigital.com.br/central/). Como a revista tem banco Supabase próprio, e um
   token emitido pelo central não é reconhecido por outro projeto, existe um
   degrau: a Edge Function `central-bridge`, que valida o token do central e
   abre uma sessão DESTE projeto. É ela que faz `auth.uid()` existir no banco —
   sem isso toda consulta sai como `anon`, que não tem permissão em nada.

   Fluxo, uma vez por sessão do navegador:
     navegador loga no CENTRAL
        → acesso-sme.js confirma a sessão e o acesso ao sistema 'revista'
        → mandamos o token do central para a central-bridge
        → a ponte devolve os tokens desta revista
        → setSession() instala a sessão, e o RLS passa a valer

   Expõe window.CentralSME.
   ============================================================================ */
const CentralSME = (() => {
  const BASE = '/central/';

  // ⚠️ Os scripts do central carregam EM SÉRIE de propósito. O `acesso-sme.js`
  // é servido por outro repositório e pode usar `window.supabase` já no topo do
  // arquivo; paralelizar pode fazê-lo rodar antes de o SDK existir, e o sintoma
  // seria login quebrado para todo mundo.
  function carregarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  // Marcos de tempo de cada perna. "O login está lento" não se investiga no
  // olho: a abertura de sessão é um revezamento entre servidores diferentes
  // (CDN do supabase-js, /central, a Edge Function), e sem medir não há como
  // saber qual atrasou.
  const tempos = {};
  let t0 = 0;
  const marcar = (nome) => { tempos[nome] = Math.round(performance.now() - t0); };

  /**
   * Abre a sessão da revista a partir do central.
   * @returns {Promise<{email:string, simulando:string|null}|null>}
   *   null quando o central já assumiu a tela (redirecionou para o login ou
   *   pintou o aviso de "sem acesso") — nesse caso não há nada a fazer aqui.
   */
  async function entrar() {
    t0 = performance.now();

    // O prerender executa o JavaScript numa aba invisível e disputaria a
    // abertura de sessão com a aba visível — erro intermitente que "funciona na
    // segunda vez" é assinatura de corrida, não de configuração.
    if (document.prerendering) {
      await new Promise((r) => document.addEventListener('prerenderingchange', r, { once: true }));
    }
    marcar('prerender');

    // Precisa vir ANTES de acesso-sme.js: é assim que ele sabe qual sistema
    // conferir. `ACESSO_TELA = null` marca a página como o portal do sistema —
    // a revista é uma SPA de um arquivo só, sem tela por nome de arquivo.
    window.ACESSO_SISTEMA = 'revista';
    window.ACESSO_TELA = null;
    window.ACESSO_LOGIN = BASE + 'login.html';

    await carregarScript(BASE + 'config.js');
    await carregarScript(BASE + 'acesso-sme.js');
    marcar('acesso_sme');

    const A = window.AcessoSME;
    if (!A || !A.pronto) throw new Error('O módulo de acesso central não carregou.');

    await A.pronto;
    marcar('central');

    // Sem perfil, o próprio acesso-sme.js já redirecionou para o login ou já
    // trocou o conteúdo da página pelo aviso de acesso negado.
    //
    // ⚠️ Esta saída silenciosa é REGISTRADA de propósito: sem o log não há como
    // distinguir "redirecionamento legítimo" de "sessão que não abriu", e as
    // duas terminam na mesma tela vazia.
    if (!A.perfil) {
      console.warn('[central] sem perfil no central — a tela foi assumida por ele.');
      return null;
    }

    const token = await A.token();
    marcar('token_central');
    if (!token) throw new Error('Não foi possível obter o token do central.');

    const r = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/central-bridge', {
      method: 'POST',
      headers: {
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(A.simulando ? { simular: A.simulando } : {}),
    });
    const resp = await r.json().catch(() => null);
    marcar('ponte');

    if (!r.ok || !resp || !resp.access_token) {
      const erro = (resp && resp.erro) || r.status;
      const amigavel =
        erro === 'sem_acesso_a_revista'
          ? 'Esta conta não tem acesso à revista. Fale com a Secretaria.'
        : erro === 'alvo_sem_acesso_a_revista'
          ? 'A pessoa que você está simulando não tem acesso à revista.'
        : erro === 'simulacao_negada'
          ? 'Só super administradores podem abrir o sistema como outra pessoa.'
        : 'Não foi possível abrir sua sessão na revista (' + erro + ').';
      console.error('[central] a ponte recusou', r.status, resp);
      throw new Error(amigavel);
    }

    const { error } = await SupabaseClient.client.auth.setSession({
      access_token: resp.access_token,
      refresh_token: resp.refresh_token,
    });
    if (error) throw new Error('Sessão recusada pelo navegador: ' + error.message);
    marcar('abrir_sessao');

    // Acima de 4 s as pessoas recarregam — e recarregar no meio da abertura de
    // sessão é o que produz o "só funciona na segunda vez".
    const total = Math.round(performance.now() - t0);
    window.CentralTempos = { ...tempos, total };
    (total > 4000 ? console.warn : console.log)('[central] tempos (ms)', window.CentralTempos);

    if (!resp.sincronizado) {
      // A sessão vale, mas o espelho de identidade não foi atualizado. O sintoma
      // é tela vazia sem erro — então diz-se aqui, e não no silêncio.
      console.warn('[central] a ponte não conseguiu sincronizar identidade/vínculos.');
    }

    return { email: resp.email, simulando: resp.simulando || null };
  }

  /**
   * Lista as escolas do catálogo do CENTRAL, para importar como unidades.
   *
   * É o que evita digitar 112 nomes à mão — e, mais importante, é o que traz o
   * `escola_central_id` CERTO por construção. Unidade cadastrada com esse id
   * errado (ou vazio) não recebe ninguém, e o sintoma é uma escola que ninguém
   * consegue editar, sem erro em lugar nenhum.
   *
   * Usa a sessão do central (`window.ACESSO_SB`), não a da revista: são
   * projetos Supabase diferentes, e o catálogo de escolas vive lá.
   *
   * ⚠️ Quem decide se essa leitura é permitida é o RLS DO CENTRAL, não este
   * código. Se ele negar, quem chamou oferece o cadastro manual — a tela não
   * pode depender disto para funcionar.
   */
  async function escolasDoCentral() {
    const SB = window.ACESSO_SB;
    if (!SB) throw new Error('O módulo do central não está carregado nesta sessão.');
    const { data, error } = await SB.from('escolas')
      .select('id, nome, ativo').order('nome');
    if (error) throw new Error(error.message);
    return (data || []).filter((e) => e.ativo !== false);
  }

  function sair() {
    if (window.AcessoSME && window.AcessoSME.signOut) return window.AcessoSME.signOut();
    window.location.href = BASE + 'login.html';
  }

  return { entrar, sair, escolasDoCentral, tempos: () => ({ ...tempos }) };
})();

window.CentralSME = CentralSME;
