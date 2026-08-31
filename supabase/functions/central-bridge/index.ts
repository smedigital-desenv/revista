/* ============================================================================
   central-bridge — troca o token do Controle de Acesso CENTRAL por uma sessão
   real deste projeto (Portfolio MAG).

   POR QUE ISSO EXISTE
   -------------------
   O login da rede acontece no projeto CENTRAL. A revista é outro projeto
   Supabase, com outra chave, e o painel não oferece Third-Party Auth com JWKS
   customizado — só Firebase/Clerk/WorkOS/Auth0/Cognito. Sem uma ponte, as
   consultas sairiam como `anon`, que (de propósito) não tem permissão nenhuma
   neste banco.

   O QUE ELA FAZ
   -------------
   1. Confere a ASSINATURA ES256 do token do central contra o JWKS público dele.
   2. Confere NO CENTRAL que a pessoa tem acesso ao sistema 'revista'.
   3. Confere que o e-mail do token e o das permissões são o mesmo.
   4. Abre uma sessão deste projeto e devolve os tokens.
   5. Sincroniza identidade e vínculos de escola para `usuarios` /
      `usuario_unidades` (RPC `sincronizar_do_central`).

   Uma chamada por sessão do navegador, não uma por consulta.

   ⚠️ DEPLOY: publicar SEM verificação de JWT embutida, porque o token que chega
      é de OUTRO projeto e o Supabase o rejeitaria antes de nós:
          supabase functions deploy central-bridge --no-verify-jwt
      A função NÃO vai junto no deploy do GitHub Pages.
   ============================================================================ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.9.6/index.ts';

const CENTRAL_URL = 'https://pvdhepvtoavkyoschkod.supabase.co';
// Chave `anon` do central — pública por natureza (vai para o navegador de
// qualquer visitante). A segurança real está no RLS, nunca em escondê-la.
const CENTRAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZGhlcHZ0b2F2a3lvc2Noa29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTUzNDQsImV4cCI6MjA5Nzk5MTM0NH0.BY6jPR9iDvh2xRlGtaU8vdKWp0NKyC7Amlzx-tytmrk';

const SISTEMA = 'revista';

// O JWKS é buscado uma vez e fica em cache pela lib, com rotação automática.
const JWKS = createRemoteJWKSet(new URL(`${CENTRAL_URL}/auth/v1/.well-known/jwks.json`));

// Não é controle de segurança (chamada servidor-a-servidor ignora CORS), mas
// fecha o uso a partir de outros sites e não custa nada.
const CORS = {
  'Access-Control-Allow-Origin': 'https://smedigital.com.br',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cabeçalho HTTP só aceita ASCII imprimível. Um caractere invisível que entre
// na cópia do código (espaço não separável, hífen suave) faz o fetch estourar
// com "not a valid ByteString" — erro que não diz onde está. Chave e token são
// base64url por natureza, então limpar é seguro.
function soAscii(s: string) {
  return String(s || '').replace(/[^\x21-\x7E]/g, '');
}

function json(body: unknown, status = 200) {
  // Toda resposta de erro vai para o log da função. Sem isto, uma falha aparece
  // no navegador como 500 e o painel mostra só "booted"/"shutdown".
  if (status >= 400) console.error(`[central-bridge] ${status}`, JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'metodo_invalido' }, 405);

  try {
    const token = soAscii((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!token) return json({ erro: 'sem_token' }, 401);

    // ── 1) A assinatura é mesmo do central? O token ainda vale? ─────────────
    let email = '';
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: `${CENTRAL_URL}/auth/v1` });
      email = String(payload.email || '').trim().toLowerCase();
    } catch (_e) {
      return json({ erro: 'token_invalido' }, 401);
    }
    if (!email) return json({ erro: 'token_sem_email' }, 401);

    // ── 2) O central confirma que essa pessoa pode entrar na revista ───────
    // A checagem é refeita aqui de propósito: o gate do navegador é conforto,
    // não segurança — qualquer pessoa pode chamar esta função direto.
    let r: Response;
    try {
      r = await fetch(`${CENTRAL_URL}/rest/v1/rpc/minhas_permissoes`, {
        method: 'POST',
        headers: {
          apikey: soAscii(CENTRAL_ANON),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
    } catch (e) {
      return json({ erro: 'falha_ao_chamar_central', detalhe: String(e) }, 502);
    }
    if (!r.ok) {
      return json({ erro: 'central_recusou', status: r.status,
                    detalhe: await r.text().catch(() => '') }, 502);
    }

    const perms = await r.json();
    if (!perms?.autorizado) return json({ erro: 'nao_autorizado' }, 403);

    const sistema = Array.isArray(perms.sistemas)
      ? perms.sistemas.find((s: { slug?: string }) => s?.slug === SISTEMA)
      : null;
    if (!sistema) return json({ erro: 'sem_acesso_a_revista' }, 403);

    // O e-mail do token e o das permissões têm que ser o mesmo. Divergiu,
    // alguma coisa está errada — não emite sessão.
    const emailPerms = String(perms?.perfil?.email || '').trim().toLowerCase();
    if (emailPerms && emailPerms !== email) return json({ erro: 'email_divergente' }, 403);

    // ── 2b) SIMULAÇÃO: super admin abrindo o sistema como outra pessoa ──────
    // Personificação de verdade: a sessão emitida é a do simulado. Só super
    // admin do CENTRAL pode, e quem decide isso é o central — a resposta de
    // minhas_permissoes já foi validada acima.
    let alvo = email;
    let permsAlvo = perms;          // as permissões de QUEM a sessão vai representar
    const corpo = await req.json().catch(() => ({}));
    const simular = String(corpo?.simular || '').trim().toLowerCase();
    if (simular && simular !== email) {
      if (!perms?.perfil?.is_super_admin) return json({ erro: 'simulacao_negada' }, 403);

      // ⚠️ Busca as permissões REAIS do alvo. Não dá para reaproveitar as do
      // super admin: o passo 5 sincroniza `usuario_unidades` APAGANDO o que
      // saiu do central, então sincronizar o alvo com a lista errada (ou
      // vazia) arrancaria os vínculos de quem está sendo auditado. Auditoria
      // que estraga o auditado é pior que auditoria nenhuma.
      let ra: Response;
      try {
        ra = await fetch(`${CENTRAL_URL}/rest/v1/rpc/permissoes_de`, {
          method: 'POST',
          headers: {
            apikey: soAscii(CENTRAL_ANON),
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_email: simular }),
        });
      } catch (e) {
        return json({ erro: 'falha_ao_consultar_alvo', detalhe: String(e) }, 502);
      }
      if (!ra.ok) {
        return json({ erro: 'central_recusou_alvo', status: ra.status,
                      detalhe: await ra.text().catch(() => '') }, 502);
      }
      const pa = await ra.json();
      if (!pa?.autorizado) return json({ erro: 'alvo_nao_autorizado' }, 403);
      const temRevista = Array.isArray(pa.sistemas)
        && pa.sistemas.some((s: { slug?: string }) => s?.slug === SISTEMA);
      if (!temRevista) return json({ erro: 'alvo_sem_acesso_a_revista' }, 403);

      console.log(`[central-bridge] SIMULACAO: ${email} abrindo como ${simular}`);
      alvo = simular;
      permsAlvo = pa;
    }

    // ── 3) Emite a sessão AQUI, no projeto da revista ──────────────────────
    const url = soAscii(Deno.env.get('SUPABASE_URL') || '');
    const chave = soAscii(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const anon = soAscii(Deno.env.get('SUPABASE_ANON_KEY') || '');
    if (!url || !chave || !anon) {
      return json({ erro: 'ambiente_incompleto',
                    detalhe: 'SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY ausente' }, 500);
    }

    const admin = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Descobre (ou cria) o usuário deste projeto para o e-mail em questão.
    let uid = '';
    const criado = await admin.auth.admin.createUser({ email: alvo, email_confirm: true });
    if (criado.data?.user?.id) {
      uid = criado.data.user.id;
    } else {
      // Já existia. `generateLink` devolve o usuário sem enviar e-mail nenhum.
      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: alvo });
      if (link.error || !link.data?.user?.id) {
        return json({ erro: 'falha_ao_identificar_usuario',
                      detalhe: link.error?.message || criado.error?.message || '' }, 500);
      }
      uid = link.data.user.id;
    }

    // ── 4) Abre a sessão SEM depender de OTP ───────────────────────────────
    // O caminho do magic link não funciona: mesmo gerando e verificando no
    // mesmo processo, em milissegundos, o GoTrue responde "otp_expired" — não é
    // tempo, é o formato do token, que aquele fluxo não aceita.
    //
    // Então trocamos por algo determinístico: definimos uma senha aleatória e
    // pegamos a sessão pelo grant de senha. A senha é gerada aqui, NUNCA sai
    // desta função, nunca vai para o navegador e é substituída a cada acesso.
    // Ninguém faz login com senha na revista — a autenticação real aconteceu no
    // central, e é ela que foi validada nos passos 1 e 2.
    //
    // `email_confirm: true` também aqui, e não só na criação: usuário vindo de
    // fluxo anterior pode estar sem confirmação, e o grant de senha recusa com
    // "email_not_confirmed". Confirmar aqui não afrouxa nada — a identidade já
    // foi validada pelo central.
    const senha = crypto.randomUUID();   // 122 bits; o GoTrue limita a 72 chars
    const upd = await admin.auth.admin.updateUserById(uid, { password: senha, email_confirm: true });
    if (upd.error) return json({ erro: 'falha_ao_preparar_sessao', detalhe: upd.error.message }, 500);

    const v = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: alvo, password: senha }),
    });
    const sessao = await v.json().catch(() => null);
    if (!v.ok || !sessao?.access_token) {
      return json({ erro: 'falha_ao_abrir_sessao', status: v.status,
                    detalhe: JSON.stringify(sessao) }, 500);
    }

    // ── 5) Sincroniza identidade e vínculos de escola ──────────────────────
    // Sem isto, quem existe no central mas não tem linha em `usuarios` aqui
    // entra e NÃO VÊ NADA — `meu_usuario_id()` devolve nulo e toda função de
    // isolamento nega por padrão. O central é a fonte da verdade: nome, papel,
    // super admin e escolas vêm de lá a cada acesso, o que também impede os
    // dois bancos de divergirem com o tempo.
    //
    // Na simulação, quem é sincronizado é o ALVO, com as permissões DELE
    // (`permsAlvo`) — é a sessão dele que está sendo aberta, e o banco tem que
    // enxergá-lo como ele é.
    const perfilCentral = permsAlvo?.perfil || {};
    const sistemaAlvo = Array.isArray(permsAlvo?.sistemas)
      ? permsAlvo.sistemas.find((s: { slug?: string }) => s?.slug === SISTEMA)
      : null;
    const sync = await admin.rpc('sincronizar_do_central', {
      p_auth_uid: uid,
      p_email: alvo,
      p_nome: perfilCentral.nome ?? null,
      p_papel_central: sistemaAlvo?.papel ?? null,
      p_is_super_admin: !!perfilCentral.is_super_admin,
      p_escolas: permsAlvo?.escolas || [],
    });
    if (sync.error) {
      // Não aborta: a sessão já é válida. Mas registra, porque sem a
      // sincronização a pessoa vê telas vazias e ninguém saberia por quê.
      console.error('[central-bridge] falha ao sincronizar', sync.error.message);
    }

    return json({
      access_token: sessao.access_token,
      refresh_token: sessao.refresh_token,
      email: alvo,
      simulando: alvo !== email ? email : null,
      sincronizado: !sync.error,
    });
  } catch (e) {
    console.error('[central-bridge] excecao', e instanceof Error ? e.stack : String(e));
    return json({ erro: 'falha_inesperada', detalhe: String(e) }, 500);
  }
});
