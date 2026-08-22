/* ============================================================
   config.js — constantes globais do Portfolio MAG
   SUBSTITUA SUPABASE_URL e SUPABASE_ANON_KEY pelos do seu projeto.
   (a anon key é segura no client — protegida por RLS)
   ============================================================ */
const CONFIG = {
  SUPABASE_URL:      'https://xxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'COLE_SUA_ANON_KEY_AQUI',

  // MODO DEMONSTRAÇÃO — sem login, dados de exemplo na memória (js/mock.js).
  // Coloque false depois de criar o banco no Supabase e preencher as credenciais acima.
  DEMO_MODE: true,

  APP_TITLE:   'Portfolio MAG',
  APP_VERSION: '1.2.1',   // mantenha igual ao ?v= das tags de index.html

  CACHE_TTL: {
    CONFIG:    21600,   // 6h
    TEMAS:     21600,   // 6h
    UNIDADES:   3600,   // 1h
    PAGINAS:     900,   // 15min
    DASHBOARD:   300,   // 5min
  },

  STORAGE_BUCKET: 'portfolio-mag',
  STORAGE_TIPOS:  ['fotos', 'videos', 'documentos', 'assets'],

  LAYOUTS: [
    { id: 'hero-texto-galeria', label: 'Hero + Texto + Galeria', icone: '🖼', descricao: 'Capa grande com texto e galeria' },
    { id: 'video-metricas',     label: 'Vídeo + Métricas',       icone: '🎬', descricao: 'Vídeo com indicadores numéricos' },
    { id: 'citacao-galeria',    label: 'Citação + Galeria',      icone: '💬', descricao: 'Frase de destaque com galeria' },
    { id: 'galeria-completa',   label: 'Galeria Completa',       icone: '🗂', descricao: 'Mosaico de fotos' },
    { id: 'timeline',           label: 'Timeline',               icone: '📅', descricao: 'Linha do tempo de eventos' },
    { id: 'indicadores',        label: 'Painel de Indicadores',  icone: '📊', descricao: 'Métricas em destaque' },
  ],

  // Paleta alinhada a identidade do Mural de Praticas Pedagogicas:
  // marinho, oliva, terracota e tons de giz. Precisa funcionar tanto no
  // app (fundo escuro) quanto nas paginas da revista (fundo claro).
  CORES: [
    '#1B3A6B', '#2E5FA3', '#4C8FB5', '#5FB3CE',
    '#7A7D2A', '#9AA33C', '#79B473', '#2F8C7F',
    '#C2603F', '#D98E4A', '#D9738C', '#8A6BA8',
  ],

  // status na revista da própria escola (a escola controla)
  STATUS_PAGINA:    { RASCUNHO: 'rascunho', PUBLICADO: 'publicado', EXCLUIDO: 'excluido' },
  // status em relação à revista principal (a SME valida)
  STATUS_PRINCIPAL: { NENHUM: 'nenhum', PENDENTE: 'pendente', APROVADO: 'aprovado', RECUSADO: 'recusado' },
  STATUS_INSCRICAO: { PENDENTE: 'pendente', APROVADO: 'aprovado', RECUSADO: 'recusado' },
  STATUS_GERAL:     { ATIVO: 'ativo', INATIVO: 'inativo' },
  PERFIS:           { SECRETARIA: 'secretaria', UNIDADE: 'unidade' },
};
