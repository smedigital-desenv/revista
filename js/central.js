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
  // Marca deixada pela ponte, para o atalho abaixo saber em que condições a
  // sessão guardada foi aberta.
  const MARCA = 'MAG_SESSAO_v1';

  // ⚠️ De quanto em quanto tempo o central é consultado de novo, no máximo.
  //
  // NÃO troque isto pela validade do token. O cliente é criado com
  // `autoRefreshToken: true`, então o supabase-js renova a sessão sozinho,
  // indefinidamente: confiar em "a sessão expira em 1 h" faria o atalho valer
  // PARA SEMPRE, e quem fosse removido no central continuaria entrando. O
  // relógio de parede é o que garante que a permissão volte a ser perguntada.
  //
  // 30 min é o acordo: é o atraso máximo para uma remoção de acesso fazer
  // efeito, e o preço é uma abertura completa a cada meia hora de uso.
  // O recorte por unidade não depende disto — quem o aplica é o Postgres, a
  // cada consulta.
  const VALIDADE_ATALHO = 30 * 60 * 1000;

  /**
   * Carrega os módulos do central, uma vez só, e devolve `window.AcessoSME`.
   *
   * Existe como função separada porque há DOIS caminhos que precisam do
   * central: a abertura de sessão e a importação de escolas do catálogo. Com o
   * atalho da sessão guardada, a abertura muitas vezes nem passa por aqui — e
   * aí a importação teria de carregá-los por conta própria.
   *
   * ⚠️ `carregarScript` em SÉRIE de propósito: o `acesso-sme.js` é servido por
   * outro repositório e pode usar `window.supabase` já no topo do arquivo.
   * Paralelizar pode fazê-lo rodar antes de o SDK existir, e o sintoma seria
   * login quebrado para todo mundo. O `<link rel="preload">` do index.html
   * adianta o DOWNLOAD sem mexer nessa ordem.
   */
  let _central = null;
  function garantirCentral() {
    if (_central) return _central;
    _central = (async () => {
      // Precisa vir ANTES de acesso-sme.js: é assim que ele sabe qual sistema
      // conferir. `ACESSO_TELA = null` marca a página como o portal do sistema —
      // a revista é uma SPA de um arquivo só, sem tela por nome de arquivo.
      window.ACESSO_SISTEMA = 'revista';
      window.ACESSO_TELA = null;
      window.ACESSO_LOGIN = BASE + 'login.html';

      if (!window.AcessoSME) {
        await carregarScript(BASE + 'config.js');
        await carregarScript(BASE + 'acesso-sme.js');
      }
      const A = window.AcessoSME;
      if (!A || !A.pronto) throw new Error('O módulo de acesso central não carregou.');
      await A.pronto;
      return A;
    })();
    return _central;
  }

  async function entrar() {
    t0 = performance.now();

    // O prerender executa o JavaScript numa aba invisível e disputaria a
    // abertura de sessão com a aba visível — erro intermitente que "funciona na
    // segunda vez" é assinatura de corrida, não de configuração.
    if (document.prerendering) {
      await new Promise((r) => document.addEventListener('prerenderingchange', r, { once: true }));
    }
    marcar('prerender');

    // ── Atalho: já existe sessão desta revista? ────────────────────────────
    // O supabase-js guarda a sessão no localStorage. Sem este atalho, TODO
    // carregamento de página refazia o revezamento inteiro — carregar os dois
    // módulos do central, pedir o token, chamar a ponte, e a ponte fazer quatro
    // idas por dentro — para chegar a uma sessão que já estava ali. Medido, era
    // a maior parte do tempo de abertura.
    //
    // ⚠️ Isto NÃO afrouxa o controle de acesso, e a razão é o prazo: a sessão
    // vale 1 h, e ao expirar o caminho completo roda de novo — com a checagem
    // no central. É o mesmo desenho do MAPA ("uma chamada por sessão, não por
    // consulta"). Quem for removido no central perde o acesso no vencimento,
    // não instantaneamente; e o recorte por unidade, esse, continua sendo
    // aplicado pelo Postgres a cada consulta.
    const guardada = await sessaoGuardada();
    if (guardada) {
      marcar('sessao_guardada');
      relatarTempos();
      return guardada;
    }

    const A = await garantirCentral();
    marcar('acesso_sme');

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

    relatarTempos();

    // Papel que o central mandou × o que o banco espera para dar administração.
    // Divergindo, a pessoa entra como unidade e a tela some sem explicar por quê.
    if (String(resp.papel || '').toLowerCase() !== 'secretaria') {
      console.log('[central] papel neste sistema:', resp.papel,
        '— administração exige exatamente "secretaria".');
    }

    // Registra em que condições esta sessão nasceu. Sessão de SIMULAÇÃO não
    // pode ser reaproveitada pelo atalho: o super admin encerra a simulação no
    // central e, sem isto, continuaria vendo o sistema pelos olhos da outra
    // pessoa até a sessão vencer.
    try {
      sessionStorage.setItem(MARCA, JSON.stringify({
        email: resp.email, simulando: resp.simulando || null, em: Date.now(),
      }));
    } catch (_) { /* sem a marca, o atalho simplesmente não é usado */ }

    if (!resp.sincronizado) {
      // A sessão vale, mas o espelho de identidade não foi atualizado. O sintoma
      // é tela vazia sem erro — então diz-se aqui, e não no silêncio.
      console.warn('[central] a ponte não conseguiu sincronizar identidade/vínculos.');
    }

    return { email: resp.email, simulando: resp.simulando || null };
  }

  /**
   * Devolve a entrada pronta quando já há sessão válida desta revista guardada
   * no navegador — e nada a fazer. `null` quando é preciso abrir do zero.
   */
  async function sessaoGuardada() {
    try {
      const cliente = SupabaseClient.client;
      if (!cliente) return null;

      let marca = null;
      try { marca = JSON.parse(sessionStorage.getItem(MARCA) || 'null'); } catch (_) {}
      // Sem marca não se sabe COMO a sessão nasceu — pode ser de simulação.
      // Na dúvida, refaz: custa uma abertura, não um vazamento de contexto.
      if (!marca || marca.simulando) return null;

      // O limite que importa: quanto tempo faz que o central foi consultado.
      if (!marca.em || (Date.now() - marca.em) > VALIDADE_ATALHO) return null;

      const { data, error } = await cliente.auth.getSession();
      if (error || !data.session) return null;

      // Margem de 5 min: sessão que vence no meio da navegação vira erro numa
      // tela qualquer, longe daqui, e ninguém liga uma coisa à outra.
      const faltam = (data.session.expires_at || 0) * 1000 - Date.now();
      if (faltam < 5 * 60 * 1000) return null;

      return { email: data.session.user?.email || marca.email, simulando: null };
    } catch (_) {
      return null;   // qualquer imprevisto: caminho completo, que é o que funciona
    }
  }

  function relatarTempos() {
    const total = Math.round(performance.now() - t0);
    window.CentralTempos = { ...tempos, total };
    // Acima de 4 s as pessoas recarregam — e recarregar no meio da abertura de
    // sessão é o que produz o "só funciona na segunda vez".
    (total > 4000 ? console.warn : console.log)('[central] tempos (ms)', window.CentralTempos);
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
    // Com o atalho da sessão guardada, o central pode nem ter sido carregado
    // nesta página. Carrega agora — é a única tela que precisa dele depois da
    // entrada.
    await garantirCentral();
    const SB = window.ACESSO_SB;
    if (!SB) throw new Error('O cliente do central não ficou disponível.');
    const { data, error } = await SB.from('escolas')
      .select('id, nome, ativo').order('nome');
    if (error) throw new Error(error.message);
    return (data || []).filter((e) => e.ativo !== false);
  }

  async function sair() {
    // Sair da revista sem sair do central deixaria a pessoa num meio-termo: sem
    // sessão aqui, com sessão lá, e o próximo carregamento a traria de volta
    // sem pedir nada. Por isso o central é carregado se ainda não estiver.
    try { sessionStorage.removeItem(MARCA); } catch (_) {}
    try {
      const A = await garantirCentral();
      if (A && A.signOut) return A.signOut();
    } catch (_) { /* cai para o redirecionamento abaixo */ }
    window.location.href = BASE + 'login.html';
  }

  return { entrar, sair, escolasDoCentral, tempos: () => ({ ...tempos }) };
})();

window.CentralSME = CentralSME;
