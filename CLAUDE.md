# Revista / Portfolio MAG

> **Este arquivo é lido automaticamente por qualquer sessão do Claude Code
> neste repositório.** Leia antes de mexer em qualquer coisa.

Revista digital das unidades escolares: a Secretaria cria temas, a escola pede
inscrição, publica páginas na revista **dela** e pode enviá-las para a revista
**principal**, que a SME aprova.

| | |
|---|---|
| **Slug no central** | `revista` |
| **Publicado em** | `smedigital.com.br/revista/` |
| **Banco** | Supabase próprio — desenho em [`docs/BANCO.md`](docs/BANCO.md) |
| **Telas** | Início (temas), Tema, Revista (folheio), Editor, Admin |

Site estático (HTML/JS puro, sem framework nem build), SPA de um arquivo só.

## O sistema está em operação real

`CONFIG.DEMO_MODE = false` desde 2026-08-31: banco próprio
(`msutitbaewkpjtgvcfew`), login pelo central e Edge Function `central-bridge`
publicada. O `js/mock.js` continua no repositório e volta a valer se alguém
religar a chave — é o caminho para demonstrar o sistema sem banco, não um
resquício.

⚠️ **Religar `DEMO_MODE` é a maneira mais rápida de tirar o sistema do ar sem
erro nenhum:** a tela abre normalmente, com dados de exemplo, e quem estiver
usando perde o que gravou de vista. Se precisar reverter uma publicação, prefira
voltar o commit.

## Como o acesso funciona

Não há login próprio. Quem autentica é o **central**; como a revista tem banco
Supabase próprio, a sessão daqui é aberta pela Edge Function `central-bridge`
(`supabase/functions/central-bridge/`), chamada por `js/central.js`.

`usuarios` e `usuario_unidades` são **espelho** do central, escritos só pela
ponte com `service_role`. Para `authenticated` não há escrita nenhuma — nem no
RLS, nem no grant. **Mudança de acesso acontece no central, não aqui.**

⚠️ Antes de "consertar" um `403` neste banco, leia `docs/BANCO.md`: as
restrições foram postas de propósito e um `permission denied` vindo delas é o
sistema funcionando.

## Diagnóstico: `teste-ponte.html`

Página separada que exercita a integração com o central **sem depender de virar
o `DEMO_MODE`** — o que quebraria a demonstração pública se algo estivesse
errado. Ela é somente-leitura e mostra, passo a passo: sessão no central,
sistema liberado, se o papel serve para administrar, se a ponte emite sessão, se
o banco a reconhece, e se o catálogo de escolas do central é legível.

É a primeira coisa a abrir quando alguém disser "não consigo entrar". Fica atrás
do login do central como todo o resto, e pode ser apagada quando o sistema
estiver estável.

⚠️ Ela declara `window.ACESSO_TELA = null`. Sem isso o `acesso-sme.js` usaria o
nome do arquivo como slug de tela (`teste-ponte`), que não existe no catálogo, e
bloquearia a página com "sem permissão" — justamente a mensagem que atrapalha
quem está diagnosticando.

## Armadilhas específicas deste repositório

- **O script do banco (`db/schema.sql`) não é versionado, e não deve ser.** Ele
  vive no Supabase; `docs/BANCO.md` é a especificação versionada.
- **`paginas.inscricao_id` não é decorativo** — a listagem do tema passa por
  dentro de `inscricoes`, e página sem ele some da tela sem erro. Um trigger o
  preenche; não o remova.
- **O papel que o central manda não tem formato único.** Medido: `admin` para a
  ponte e `super_admin` para o navegador, na mesma pessoa. Quem administra a
  revista é decidido por `is_super_admin` **ou** papel `like 'secretaria%'` —
  ver "Quem é secretaria" em `docs/BANCO.md` antes de mexer nessa regra.
- **Unidade sem `escola_central_id` não alcança ninguém.** O vínculo pessoa ×
  unidade é casado por esse id (e, como reserva, por nome exatamente igual). O
  sintoma de um id faltando é uma escola que ninguém consegue editar, sem erro
  nenhum — por isso o painel Admin marca em vermelho quem está sem ele, e
  **Importar do central** existe para o id vir certo por construção.
- **O bucket é privado: `conteudo` guarda o CAMINHO da foto, nunca a URL.** URL
  assinada expira em 1 h e viraria link quebrado gravada no banco. Quem assina
  é `Renderer.resolverArquivos`, depois do render — e toda tela que renderizar
  página precisa chamá-lo. Ver a seção Storage de `docs/BANCO.md`.
- **Ao mexer em `css/` ou `js/`, suba o `?v=` do `index.html` e o
  `CONFIG.APP_VERSION`** — senão o navegador serve o arquivo velho do cache e o
  deploy parece não ter mudado nada.
---

## Regras da rede SME — valem para TODOS os sistemas

> Esta seção é padrão e idêntica em todos os repositórios da SME Ribeirão Preto.
> Ao alterá-la, replique nos demais.

### 1. Todo repositório aqui é PÚBLICO

Trate cada commit como publicação. O histórico do Git guarda para sempre: apagar
depois exige reescrita de histórico, força-push em todas as branches e abertura
de chamado no suporte do GitHub para purgar referências em pull requests. Já
aconteceu nesta rede e levou semanas.

**Nunca versione:**

- `*.sql`, `*.csv`, `*.dump`, `*.xlsx` — script de carga e export carregam dado
  real junto, quase sempre sem quem escreveu perceber. Estão no `.gitignore`.
- Dado pessoal de qualquer natureza: nome, e-mail, RA, matrícula, CPF, telefone,
  endereço. Nem em código, nem em comentário, nem em dado de exemplo, nem em
  mensagem de commit.
- Credencial de qualquer tipo: `service_role`, senha de banco, token de API,
  chave privada.

**Pode versionar:** a chave `anon` do Supabase. Ela é pública por natureza e vai
para o navegador de qualquer visitante. A segurança real está nas permissões do
banco, nunca em esconder essa chave.

Os sistemas desta rede tratam **dados pessoais de crianças**, alguns de natureza
sensível. Isso não é hipótese: é o conteúdo real da maioria destas bases.

### 2. Login é sempre pelo Controle de Acesso CENTRAL

Nenhum sistema da rede deve ter login próprio. A autenticação acontece no
**central** (`smedigital.com.br/central/`), que governa quem entra, em quais
sistemas e em quais telas.

Integrar um sistema novo:

```html
<script>window.ACESSO_SISTEMA = 'slug-do-sistema';</script>
<script src="/central/config.js"></script>
<script src="/central/acesso-sme.js"></script>
```

Isso expõe `window.AcessoSME` com `.pronto`, `.perfil`, `.escolas`, `.sistema`,
`.can(tela, acao)`, `.token()`, `.signOut()` e `.simular()`. Sem sessão válida,
a pessoa é levada ao login do central automaticamente.

O sistema precisa estar cadastrado no catálogo do central (tabela `sistemas`),
com suas telas e papéis, antes de a integração funcionar.

**Quando o sistema tem banco Supabase próprio**, existe um degrau: um token
emitido pelo central não é reconhecido por outro projeto Supabase. É preciso uma
ponte que valide o token do central e abra sessão no projeto do sistema. O MAPA
tem essa ponte implementada (`supabase/functions/central-bridge/`) e serve de
referência — não reinvente, copie.

### 3. Segurança do banco (Supabase)

Invariantes. Quebrar qualquer uma expõe dado:

1. **O papel `anon` não tem permissão em nada.** Nem tabela, nem função. Se você
   for escrever `grant ... to anon`, pare e entenda por que aquilo está fechado.
2. **Toda tabela com dado pessoal tem RLS ligado E policy com condição real.**
   RLS ligado sem policy adequada não protege — e policies permissivas se somam
   com **OR**, então uma única `using (true)` anula todas as outras da tabela.
   Verificação canônica:
   ```sql
   select tablename, policyname, cmd from pg_policies
    where schemaname='public' and qual='true' and cmd in ('SELECT','ALL');
   ```
   Só catálogo e configuração podem aparecer aí.
3. **View materializada IGNORA RLS.** É cópia física dos dados. Proteger só a
   tabela de origem é proteção de fachada; revogue o acesso direto e exponha por
   função.
4. **Função `SECURITY DEFINER` ignora RLS** — ela roda com o poder do dono. Ou
   aplica o recorte por dentro, ou não deveria ser `DEFINER`.
5. **O filtro feito em JavaScript não é segurança.** É conforto visual. Quem
   abre o DevTools vê tudo que o banco entregou. A regra tem que estar no
   Postgres.

**Desempenho:** chamadas de função dentro de policy precisam ser envolvidas em
`(select ...)`, senão são reavaliadas linha a linha e a consulta estoura tempo
até em tabela pequena:

```sql
using ( (select public.minha_funcao()) or coluna = ... )
```

### 4. Armadilhas de publicação

- **O `git push` feito por automação não dispara o workflow de deploy.** Rode
  manualmente pela aba Actions depois de publicar.
- **Confirme o push por hash, não pela mensagem.** `git push | tail` esconde
  "Everything up-to-date":
  ```bash
  git fetch origin -q && git rev-parse --short origin/main
  ```
- **O SQL Editor do Supabase envolve o script inteiro numa transação.** Um erro
  no meio **desfaz tudo que veio antes**, e o painel mostra só a mensagem do
  erro — parece que o resto passou. Ao falhar no meio, presuma que nada rodou.
- **Edge Function não vai junto no deploy do site.** Alterá-la exige republicar
  pelo painel do Supabase ou pela CLI. Front-end e função desalinhados produzem
  erros que não parecem versão.

### 5. Ao investigar um problema

1. `403` / `permission denied` costuma ser proteção funcionando, não avaria.
   Antes de conceder acesso, entenda por que aquilo está fechado.
2. Erro **intermitente** que "funciona depois de algumas tentativas" é assinatura
   de **corrida**, não de configuração. Procure o que executa o mesmo código duas
   vezes (prerender, prefetch, listener duplicado, aba oculta).
3. Timeout em tabela pequena é estatística velha ou instância saturada. Rode
   `ANALYZE` e verifique a capacidade no painel antes de culpar policy.
4. Antes de propor `grant`, releia a seção 3.

### 6. Manutenção deste arquivo

Ao alterar arquitetura, modelo de acesso, fluxo de autenticação ou processo de
publicação, **atualize este arquivo no mesmo commit**. Não espere que peçam.
Documento desatualizado é pior que nenhum: induz ao erro com aparência de
autoridade.
