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
  app.js              inicialização + fluxo de auth
  views/              secretaria, tema, revista, editor, admin
sql/schema.sql        banco completo + RLS + storage + seed
.github/workflows/deploy.yml   deploy automático
```

---

## Configuração (passo a passo)

### 1. Supabase
1. Crie um projeto em https://supabase.com.
2. Em **SQL Editor**, cole e rode `sql/schema.sql` inteiro.
3. Em **Authentication → Providers → Google**, ative e informe Client ID + Secret
   (crie no Google Cloud Console; redirect URI: `https://<seu-projeto>.supabase.co/auth/v1/callback`).
4. Em **Authentication → URL Configuration**, adicione em *Redirect URLs* a URL do seu
   GitHub Pages, ex: `https://seu-usuario.github.io/revista/`.
5. O bucket `portfolio-mag` é criado pelo `schema.sql`. Confirme em **Storage** que está público.

### 2. config.js
Edite `js/config.js` e substitua:
```js
SUPABASE_URL:      'https://SEU-PROJETO.supabase.co',
SUPABASE_ANON_KEY: 'sua anon key (Settings → API)',
```
> A `anon key` é segura no client — a proteção real está no RLS. **Nunca** commite a `service_role key`.

### 3. Primeiro administrador
1. Faça o primeiro login com Google no app (vai cair em "Sem acesso" — normal).
2. No SQL Editor, rode o bloco final do `schema.sql` (seção 15) com o e-mail real do admin
   para promovê-lo a `secretaria`.
3. Recarregue o app.

### 4. Deploy (GitHub Pages)
1. Crie o repositório e dê push.
2. Em **Settings → Pages**, selecione *Source: GitHub Actions*.
3. Cada push na branch `main` publica automaticamente via `.github/workflows/deploy.yml`.

> **Ao mexer em `css/` ou `js/`, suba o `?v=` das tags do `index.html`** (e o
> `CONFIG.APP_VERSION`, que existe só para lembrar da versão em uso). Sem isso o
> navegador serve o arquivo antigo do cache e o deploy parece não ter mudado nada.

---

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
| `secretaria` | Tudo: temas, inscrições, publicação, usuários |
| `unidade` | Edita páginas da própria unidade, solicita inscrição, envia para revisão |

## Fluxo
Secretaria cria tema → unidade solicita inscrição → secretaria aprova → unidade cria/edita
páginas (rascunho) → envia para revisão → secretaria publica → aparece na revista pública.
