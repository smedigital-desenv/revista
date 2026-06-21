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
  APP_VERSION: '1.0.0',

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

  CORES: [
    '#FF3366', '#7C3AED', '#2563EB', '#059669',
    '#D97706', '#DC2626', '#0891B2', '#FF6B35',
    '#00C896', '#FFD200', '#6366F1', '#EC4899',
  ],

  STATUS_PAGINA:    { RASCUNHO: 'rascunho', REVISAO: 'revisao', PUBLICADO: 'publicado', EXCLUIDO: 'excluido' },
  STATUS_INSCRICAO: { PENDENTE: 'pendente', APROVADO: 'aprovado', RECUSADO: 'recusado' },
  STATUS_GERAL:     { ATIVO: 'ativo', INATIVO: 'inativo' },
  PERFIS:           { SECRETARIA: 'secretaria', UNIDADE: 'unidade' },
};
