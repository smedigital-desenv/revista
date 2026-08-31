# O banco da revista — desenho, decisões e armadilhas

> Este arquivo é a especificação **versionada** do banco. O script que o cria
> (`db/schema.sql`) **não entra no Git**: o repositório é público e o site é
> servido da raiz dele, então um `.sql` commitado vira URL baixável. O script é
> entregue fora do repositório e rodado no SQL Editor do Supabase — é lá que ele
> vive. Precisa dele de novo? Peça a quem executou.

## Como a identidade chega aqui

A revista **não tem login próprio**. Quem governa quem entra é o Controle de
Acesso CENTRAL. Como a revista tem projeto Supabase próprio, e um token emitido
pelo central não é reconhecido por outro projeto, existe um degrau — a Edge
Function `central-bridge`:

```
navegador loga no CENTRAL
   → js/central.js manda o token do central para a central-bridge
      → a função valida a ASSINATURA ES256 contra o JWKS público do central
      → pergunta AO CENTRAL se a pessoa tem o sistema 'revista' liberado
      → confere que o e-mail do token e o das permissões são o mesmo
      → abre uma sessão DESTE projeto e devolve os tokens
      → chama sincronizar_do_central(...), que espelha identidade e vínculos
   → js/central.js instala a sessão com setSession()
```

A partir daí `auth.uid()` existe no banco da revista e as policies funcionam.
**Uma chamada por sessão do navegador**, não uma por consulta.

⚠️ A função é publicada com **Verify JWT DESLIGADO**: o token que chega é de
outro projeto, e a verificação embutida o rejeitaria antes de a função rodar. A
validação é feita por dentro, e é por isso que ela é feita três vezes
(assinatura, permissão no central, conferência de e-mail).

⚠️ **A checagem de permissão é refeita no servidor de propósito.** O gate do
navegador é conforto, não segurança: qualquer pessoa pode chamar a função direto.

## `usuarios` e `usuario_unidades` são ESPELHO, não cadastro

As duas tabelas são escritas **só pela ponte**, com `service_role`. Para
`authenticated` não há `insert`, `update` nem `delete` — nem no RLS, nem no
grant. Quem quiser mudar o acesso de alguém mexe no **central**, não aqui.

Isso é o que impede os dois bancos de divergirem: nome, papel, super admin e
escolas vêm do central **a cada acesso**.

⚠️ **`sincronizar_do_central` APAGA os vínculos antes de regravar.** É o que faz
a remoção de uma escola no central chegar aqui. É também por isso que a
simulação ("ver como") busca as permissões **reais do alvo**
(`permissoes_de`) em vez de reaproveitar as de quem está simulando: auditar
alguém com a lista errada arrancaria os vínculos do auditado. Auditoria que
estraga o auditado é pior que auditoria nenhuma.

⚠️ **`unidades.escola_central_id` é a chave do vínculo.** O nome é o caminho
reserva e casa por **igualdade normalizada** (`norm_unidade`), que é mais
estrita que qualquer heurística de token de propósito: pode faltar vínculo,
nunca trazer o de outra escola. Errar escondendo é visível e reclamável; errar
mostrando é invisível e grave.

Unidade cadastrada sem `escola_central_id` e com nome que não bate com o do
central **não recebe ninguém** — e o sintoma é uma escola que ninguém consegue
editar. É o primeiro lugar a olhar quando alguém disser "não consigo editar
minha escola".

## Quem é secretaria

`sincronizar_do_central` decide: super admin do central, **ou** papel
`secretaria` no sistema `revista`. Qualquer outro papel edita apenas a própria
unidade. Não há terceira via, e o papel não é editável dentro da revista.

## As sete tabelas

| Tabela | O que guarda |
|---|---|
| `unidades` | as escolas que publicam; liga ao catálogo do central |
| `usuarios` | espelho da identidade (id = `auth.users.id`) |
| `usuario_unidades` | vínculo pessoa × unidade — o recorte de edição |
| `temas` | os temas criados pela Secretaria |
| `inscricoes` | a unidade pede, a Secretaria aprova |
| `paginas` | o conteúdo da revista |
| `config` | chave/valor da publicação |

### Os dois eixos de status da página

São independentes, e confundi-los é o erro fácil:

| Coluna | Quem controla | Valores |
|---|---|---|
| `status` | a **escola** | `rascunho`, `publicado`, `excluido` |
| `principal_status` | a **SME** | `nenhum`, `pendente`, `aprovado`, `recusado` |

A escola publica na revista **dela**. Entrar na revista **principal** é decisão
da Secretaria — a unidade só consegue pedir, e só de página já publicada.

⚠️ Isso vive no **banco** (trigger `paginas_guarda_principal`), não no
JavaScript: quem abre o DevTools manda o UPDATE que quiser. O trigger também
limpa `principal_aprovado_em`/`_por` quando a página sai do ar, senão sobraria
a linha incoerente `principal_status = 'nenhum'` com data de aprovação
preenchida — que todo relatório futuro leria como "aprovada em".

### `paginas.inscricao_id` não é decorativo

A tela de tema lista as páginas **por dentro** de `inscricoes` (embed do
PostgREST, em `js/api.js`). Página sem essa referência **desaparece da
listagem, sem erro nenhum** — e o editor manda `inscricao_id: null`
(`js/views/editor.js`).

Por isso o trigger `paginas_resolver_inscricao` deriva o vínculo de
(unidade, tema) a cada insert/update. O banco garante; o front não precisa
acertar. **Não remova o trigger "porque o front agora manda certo".**

### Não existe DELETE de página

Não há policy de `delete` em `paginas`, e a ausência é a regra: a página sai de
cena com `status = 'excluido'` e o histórico fica.

## Storage

Bucket `portfolio-mag`, caminho
`unidades/<unidade_id>/<tema_id>/<tipo>/<arquivo>`. É o **segundo segmento** que
diz de quem é o arquivo (`unidade_do_caminho`), e caminho fora desse padrão é
recusado — arquivo "de ninguém" não pode virar arquivo de todos.

⚠️ **O bucket é PRIVADO, e isso é decisão.** O conteúdo é foto de atividade
escolar — criança identificável. Bucket público entrega o arquivo a quem tiver a
URL, sem passar pelo login da rede, enquanto a revista inteira vive atrás do
central.

⚠️ **PENDÊNCIA CONHECIDA:** `js/api.js` ainda usa `getPublicUrl`, que não
funciona em bucket privado. Trocar por `createSignedUrl` **não basta**: a URL
assinada expira, e hoje o editor grava a URL dentro de `paginas.conteudo`
(`galeria`, `heroBg`, `videoUrl`). O certo é gravar o **caminho** e assinar na
hora de renderizar — o que mexe em `js/renderer.js`. Enquanto isso não for
feito, as imagens não carregam fora do modo demonstração.

## Verificação (rode depois de qualquer mudança de esquema)

```sql
-- (a) policy permissiva sem condição — tem que voltar VAZIO
select tablename, policyname, cmd from pg_policies
 where schemaname='public' and qual='true' and cmd in ('SELECT','ALL');

-- (b) anon com permissão de tabela — VAZIO
select table_name, privilege_type from information_schema.role_table_grants
 where grantee='anon' and table_schema='public';

-- (c) anon com EXECUTE em função — VAZIO
select p.proname from pg_proc p
 where p.pronamespace='public'::regnamespace
   and has_function_privilege('anon', p.oid, 'EXECUTE');

-- (d) RLS ligado nas sete tabelas
select relname, relrowsecurity from pg_class
 where relnamespace='public'::regnamespace and relkind='r' order by 1;

-- (e) o bucket continua privado
select id, public from storage.buckets where id='portfolio-mag';
```

⚠️ Em **função**, `revoke ... from anon` NÃO basta: o padrão do PostgreSQL é dar
`EXECUTE` ao papel `PUBLIC`, e `anon` herda dele. Sem
`revoke execute on all functions in schema public from public`, todas as funções
continuariam chamáveis por qualquer visitante — inclusive as `SECURITY DEFINER`.
É a verificação (c) que pega isso; a (b) sozinha passa e dá falsa sensação de
segurança.

## O que foi testado, e como

O `db/schema.sql` foi rodado contra um PostgreSQL 16 local, com um arremedo do
ambiente Supabase (papéis `anon`/`authenticated`/`service_role`, `auth.uid()`
lendo `request.jwt.claims`, `storage.buckets`/`objects`). Rodou duas vezes
seguidas sem erro — é idempotente.

A bateria de comportamento passou 13 de 13, com três pessoas fictícias (uma
secretaria, duas de unidades diferentes):

- unidade cria página no tema em que foi **aprovada**: passa;
- unidade cria página em tema **sem inscrição aprovada**: barrado;
- unidade cria página **na unidade alheia**: barrado;
- unidade **não enxerga** o rascunho da outra;
- secretaria enxerga;
- autenticado **desconhecido** (sem linha em `usuarios`) não vê nada;
- unidade envia para avaliação: passa; unidade **se aprova**: barrado;
- secretaria aprova: passa;
- `anon` lendo tabela, `anon` chamando `sou_secretaria()`, `authenticated`
  chamando a função da ponte: os três barrados;
- storage: envia na própria pasta (passa), na pasta alheia (barrado), caminho
  fora do padrão (barrado);
- sincronização: duas escolas viram dois vínculos; removida uma no central,
  some aqui; casamento só por nome funciona; virar secretaria zera os vínculos
  (ela alcança tudo por `minhas_unidades()`); escola inexistente **não inventa**
  unidade.

⚠️ Isso prova que a regra faz o que diz. **Não prova** que o catálogo do dia
cobre as grafias que o central manda — isso só se vê com dado real, e é o que
justifica preencher `escola_central_id` em vez de confiar no nome.
