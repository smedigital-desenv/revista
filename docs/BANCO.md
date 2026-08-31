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

### Quanto demora abrir a sessão — MEDIDO em produção (2026-08-31)

| situação | tempo da ponte |
|---|---|
| função dormindo (partida a frio) | ~6,4 s |
| aquecimento parcial | ~4,0 s |
| **em uso (o normal)** | **~1,7 s** |

⚠️ **Não "otimize" a ponte com base no primeiro número.** Ele é partida a frio da
Edge Function, e o estado normal está bem abaixo do limiar de 4 s em que as
pessoas recarregam. Chegou-se a desenhar duas melhorias — inverter
`createUser`/`generateLink` (hoje a primeira sempre falha para quem já existe) e
rodar a sincronização em paralelo com o grant de senha. Elas continuam válidas
como ideia, mas não se justificavam: o custo é mais um deploy da função e risco
novo num caminho que já funciona.

O que sobra é inerente: a primeira pessoa a entrar depois de horas paradas
espera a função acordar. `js/central.js` mede e imprime cada perna no console —
é por ali que se investiga, nunca no olho.

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

Por isso o painel **Admin → Unidades** marca em vermelho quem está sem vínculo,
e o botão **Importar do central** lê o catálogo de lá (`window.ACESSO_SB`, a
sessão do central — não a da revista) e cria as unidades com o id certo por
construção. Quem decide se essa leitura é permitida é o RLS **do central**; se
ele negar, a tela diz isso e oferece o cadastro manual, em vez de mostrar uma
lista vazia que parece "não há escolas".

## Quem é secretaria

`sincronizar_do_central` decide: super admin do central, **ou** papel que comece
por `secretaria` no sistema `revista`. Qualquer outro papel edita apenas a
própria unidade. Não há terceira via, e o papel não é editável dentro da revista.

⚠️ **O campo `papel` de `minhas_permissoes` NÃO tem um formato único — medido no
primeiro acesso real (2026-08-31).** Para a mesma pessoa, super admin:

| de onde veio | valor |
|---|---|
| `sistema.papel` no navegador (`acesso-sme.js`) | `super_admin` |
| `perms.sistemas[].papel` na ponte (`minhas_permissoes` cru) | `admin` |

A divergência tem causa conhecida: o `acesso-sme.js` **substitui** a lista de
sistemas quando quem entra é super admin (`sistemasDoSuperAdmin`) e sintetiza o
papel; a ponte lê a resposta crua. Nenhum dos dois é `secretaria`, e naquele
caso quem decidiu foi o `is_super_admin`.

Por isso a comparação é `like 'secretaria%'` e não igualdade: cobre o slug e
cobre o nome do papel (`Secretaria (administra a revista)`), caso o central mande
um ou outro. **Não alargue para `admin`** — seria conceder administração por
adivinhação, e quem é admin de verdade já entra pelo `is_super_admin`.

⚠️ O caso da **Secretaria comum** (papel `secretaria`, sem super admin) ainda não
foi exercitado em produção. `teste-ponte.html` responde isso numa olhada: a linha
"O papel serve para administrar?".

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

### Como a foto chega à tela

⚠️ **O que se grava em `paginas.conteudo` é o CAMINHO do arquivo, nunca a URL.**
A URL assinada expira em 1 h; gravada no banco, viraria link quebrado no dia
seguinte — e o sintoma (foto sumida numa página antiga) não apontaria para a
causa. O editor guarda o caminho (`js/views/editor.js`, `doUpload`).

Quem transforma caminho em URL é `Renderer.resolverArquivos(container)`, **depois**
que o HTML entrou na tela:

1. `renderer.js` é síncrono de propósito — só monta texto. Caminho de arquivo
   vira `data-mag-arquivo` (imagem) ou `data-mag-fundo` (capa), com um GIF 1×1
   transparente segurando o lugar, para não piscar ícone de imagem quebrada.
2. Endereço externo (`http:`, `data:`, `blob:` — o que alguém colou à mão)
   passa direto para o `src`, sem assinatura.
3. `resolverArquivos` junta **todos** os caminhos daquele container e assina
   numa chamada só. Uma por imagem faria a galeria de 12 fotos virar 12
   requisições, e a revista reassinaria a cada virada de página.
4. `Api.storage.assinar` guarda as assinaturas em memória enquanto valem
   (1 h, com 10 min de margem), então a repetição não custa rede.

⚠️ **Falha ao assinar NÃO derruba a página.** O texto é o essencial da revista:
o que não assinou fica sem foto e sai no console dizendo qual arquivo foi. Um
caminho que o Supabase recusa individualmente também é pulado, em vez de virar
link quebrado.

Chamam o resolvedor: `views/revista.js` (primeiro render e cada virada de
página) e `views/editor.js` (primeiro render e cada atualização da
pré-visualização). **Tela nova que renderize página tem de chamar também** —
senão as fotos ficam no placeholder, sem erro nenhum.

⚠️ `conteudo.videoUrl` continua sendo endereço externo (YouTube). Vídeo enviado
ao bucket ainda não é exibido por nenhum layout.

## Verificação (rode depois de qualquer mudança de esquema)

O jeito prático é o `db/verificar.sql` — como o schema, ele **não é versionado**
e é entregue fora do repositório. São 10 linhas de resposta, e **todas têm de
sair `OK`**: as 7 tabelas, RLS ligado nas 7, nenhuma policy sem condição, `anon`
sem tabela e sem função, bucket privado, os 3 triggers de `paginas`, as 8
funções, as 4 policies de storage e o seed de `config`.

⚠️ Ele foi validado sabotando o banco de propósito (grant para `anon`, RLS
desligado, policy `using (true)`): as três sabotagens acusaram. Verificação que
só sabe dizer "OK" não vale nada.

As consultas soltas equivalentes, para quando faltar o arquivo:

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

O caminho da foto foi exercitado em navegador headless, com a assinatura
substituída por uma de mentira: endereço externo passa intacto; três caminhos
(duas fotos + a capa) viram **uma** chamada em lote; nada fica pendente ao fim;
a capa sai com véu + URL assinada; e, quando a assinatura falha, o texto
continua na tela sem imagem quebrada.

⚠️ Isso prova que a regra faz o que diz. **Não prova** que o catálogo do dia
cobre as grafias que o central manda — isso só se vê com dado real, e é o que
justifica preencher `escola_central_id` em vez de confiar no nome. Também não
prova nada contra o projeto real: o ambiente onde este código foi escrito não
alcança `supabase.co`, então a primeira execução do schema e a primeira
assinatura de arquivo de verdade acontecem no seu lado.
