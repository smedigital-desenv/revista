# Portfolio MAG

Revista digital interativa da Secretaria Municipal de Educação de Ribeirão Preto (SP).
Cada escola publica páginas dentro de temas criados pela Secretaria.

**Stack:** HTML + CSS + JS puro · Supabase (PostgreSQL + Auth + Storage) · GitHub Pages.

---

## Estrutura

```
index.html            shell SPA + roteador
404.html              fallback SPA do GitHub Pages
css/global.css        design system (identidade do Mural: marinho, creme, oliva)
js/
  config.js           credenciais Supabase + constantes
  supabase.js         cliente + auth Google
  store.js            estado global + cache + EventBus
  api.js              todas as queries ao Supabase
  ui.js               toast, modal, componentes
  router.js           SPA router + breadcrumb
  renderer.js         6 layouts de página
  central.js          entrada pelo Controle de Acesso CENTRAL (+ central-bridge)
  app.js              inicialização + fluxo de acesso
  views/              secretaria, tema, revista, editor, admin
docs/BANCO.md         desenho do banco, decisões e armadilhas
supabase/functions/central-bridge/   Edge Function que abre a sessão da revista
.github/workflows/deploy.yml   deploy automático
```

---

## Configuração (passo a passo)

> Enquanto `CONFIG.DEMO_MODE` for `true`, o app roda com dados de exemplo em
> memória (`js/mock.js`), sem banco e sem login. É o estado publicado hoje.

### 1. Banco (Supabase)
1. Crie um projeto em https://supabase.com — este é o projeto **da revista**,
   separado do projeto do central.
2. Em **SQL Editor**, cole e rode `db/schema.sql` inteiro.

   ⚠️ Esse arquivo **não está no repositório e não deve estar**: aqui tudo é
   público e o site é servido da raiz, então um `.sql` commitado vira URL
   baixável. Ele é entregue fora do Git e vive no Supabase. O desenho está em
   [`docs/BANCO.md`](docs/BANCO.md).
3. Confirme em **Storage** que o bucket `portfolio-mag` está **privado**. Ele
   guarda foto de atividade escolar — bucket público entregaria o arquivo a
   quem tivesse a URL, sem passar pelo login da rede.

### 2. Login pelo CENTRAL
A revista **não tem login próprio**: quem autentica é o Controle de Acesso
CENTRAL. Como este é outro projeto Supabase, é preciso a ponte.

1. Publique a Edge Function, com a verificação de JWT **desligada** — o token
   que chega é de outro projeto e o Supabase o rejeitaria antes da função rodar:
   ```bash
   supabase functions deploy central-bridge --no-verify-jwt
   ```
2. No banco do **central**, cadastre o sistema `revista` na tabela `sistemas` e
   libere-o aos perfis. Sem isso a ponte responde `403 sem_acesso_a_revista` —
   e o sintoma não diz isso, aparece como "sem acesso" na tela.
3. Quem administra a revista precisa do papel `secretaria` no sistema `revista`
   (ou ser super admin do central). Qualquer outro papel edita só a própria
   unidade.

### 3. Unidades
Pelo painel **Admin → Unidades**, use **Importar do central**: ele lista o
catálogo de escolas do central e cria as unidades já com o `escola_central_id`
certo. É por esse id que a ponte descobre quem edita o quê.

⚠️ Unidade **sem vínculo** não alcança ninguém — a escola não consegue editar a
própria revista, e não há erro em lugar nenhum que diga isso. Por isso a lista
marca em vermelho quem está sem vínculo.

Se o RLS do central não permitir essa leitura, o modal diz isso com todas as
letras e o caminho é **+ Nova unidade**, informando o vínculo à mão.

### 4. config.js
```js
SUPABASE_URL:      'https://SEU-PROJETO.supabase.co',
SUPABASE_ANON_KEY: 'sua anon key (Settings → API)',
DEMO_MODE:         false,
```
> A `anon key` é segura no client — a proteção real é o RLS. **Nunca** commite a
> `service_role key`.

### 5. Deploy (GitHub Pages)
Cada push na `main` publica via `.github/workflows/deploy.yml`.

⚠️ **Push feito por automação não dispara o workflow** — rode-o à mão pela aba
Actions. E confirme por hash, não pela mensagem:
```bash
git fetch origin -q && git rev-parse --short origin/main
```

⚠️ **A Edge Function não vai junto no deploy do site.** Alterá-la exige
republicar pela CLI. Front-end e função desalinhados produzem erro que não
parece versão.

> **Ao mexer em `css/` ou `js/`, suba o `?v=` das tags do `index.html`** (e o
> `CONFIG.APP_VERSION`). Sem isso o navegador serve o arquivo antigo do cache e
> o deploy parece não ter mudado nada.

## Desenvolvimento local
Como é estático, basta um servidor HTTP:
```bash
python -m http.server 8000
# ou: npx serve
```
Acesse http://localhost:8000 e adicione `http://localhost:8000` nas *Redirect URLs* do Supabase.

---

## Perfis
| Perfil | Permissões |
|---|---|
| `secretaria` | Temas, inscrições, publicação e aprovação na revista principal |
| `unidade` | Edita páginas da própria unidade, solicita inscrição, envia para avaliação |

O perfil **não é editado aqui**: ele vem do central a cada acesso (super admin
ou papel `secretaria` no sistema `revista`). Mudança de acesso acontece no
central.

## Fluxo
Secretaria cria tema → unidade solicita inscrição → secretaria aprova → unidade cria/edita
páginas (rascunho) → envia para revisão → secretaria publica → aparece na revista pública.
