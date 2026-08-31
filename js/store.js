/* ============================================================
   store.js — estado global + cache TTL + EventBus + histórico
   ============================================================ */
const Store = (() => {
  const _state = {
    user:    null,   // { id, email, nome, perfil, unidade_id }
    config:  {},     // { chave: valor }
    layouts: [],     // CONFIG.LAYOUTS
    cores:   [],     // CONFIG.CORES
    cache:   {},     // { key: { data, expiresAt } }
    history: [],     // [{ view, params }]
    currentView:   null,
    currentParams: {},
  };

  // ── Getters ────────────────────────────────────────────
  const getUser    = () => _state.user;
  const getConfig  = () => _state.config;
  const getLayouts = () => _state.layouts;
  const getCores   = () => _state.cores;
  const isSecretaria = () => _state.user?.perfil === CONFIG.PERFIS.SECRETARIA;
  const isOwnerOf    = (uid) => isSecretaria() || _state.user?.unidade_id === uid;

  // ── Init (após login) ──────────────────────────────────
  function init(user, config) {
    _state.user    = user || null;
    _state.config  = config || {};
    _state.layouts = CONFIG.LAYOUTS;
    _state.cores   = CONFIG.CORES;
  }

  // ── Cache com TTL ──────────────────────────────────────
  //
  // Vive na memória E no sessionStorage. Só na memória, o TTL de 6 h dos temas
  // nunca chegava a valer: ele morria a cada recarregamento, e toda abertura de
  // página refazia todas as consultas. Com o sessionStorage, voltar a uma tela
  // já visitada é instantâneo.
  //
  // ⚠️ A chave é PREFIXADA PELO ID DA PESSOA. Sem isso, o super admin que usa
  // "ver como" veria, na mesma aba, o cache do perfil anterior — dado de uma
  // unidade aparecendo para outra, sem erro nenhum. É a mesma aba, é o mesmo
  // sessionStorage: o que separa é a chave.
  //
  // ⚠️ Fecha a aba, acaba. É de propósito: aqui há conteúdo de páginas de
  // escola, e cache que sobrevive ao fechamento passa a ser cópia de dado
  // guardada em máquina alheia.
  const _PREFIXO = 'MAG_CACHE_v1';
  const _chaveSessao = (key) => `${_PREFIXO}:${_state.user?.id || 'anon'}:${key}`;

  function cacheSet(key, data, ttlSec) {
    const entrada = { data, expiresAt: Date.now() + (ttlSec * 1000) };
    _state.cache[key] = entrada;
    // Falha de escrita (aba anônima restrita, cota estourada) não pode derrubar
    // a tela: o cache é conforto, e a memória já guardou.
    try { sessionStorage.setItem(_chaveSessao(key), JSON.stringify(entrada)); }
    catch (_) { /* segue sem persistir */ }
  }

  function cacheGet(key) {
    let e = _state.cache[key];
    if (!e) {
      try {
        const cru = sessionStorage.getItem(_chaveSessao(key));
        if (cru) { e = JSON.parse(cru); _state.cache[key] = e; }
      } catch (_) { e = null; }   // JSON corrompido é o mesmo que não ter cache
    }
    if (!e) return null;
    if (Date.now() > e.expiresAt) { cacheInvalidate(key); return null; }
    return e.data;
  }

  function cacheInvalidate(...keys) {
    keys.forEach((k) => {
      delete _state.cache[k];
      try { sessionStorage.removeItem(_chaveSessao(k)); } catch (_) {}
    });
    EventBus.emit('cache:invalidate', { keys });
  }

  function cacheInvalidateAll() {
    _state.cache = {};
    try {
      // Varre só o que é nosso: o sessionStorage é compartilhado com o
      // acesso-sme.js (ACESSO_PERMS_v1) e com os pacotes de outros sistemas.
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(_PREFIXO + ':'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch (_) {}
  }

  // ── Navegação ──────────────────────────────────────────
  function pushHistory(view, params) {
    _state.history.push({ view, params: params || {} });
  }
  function popHistory() {
    return _state.history.pop() || null;
  }
  function setCurrentView(view, params) {
    _state.currentView   = view;
    _state.currentParams = params || {};
  }
  const getCurrentView   = () => _state.currentView;
  const getCurrentParams = () => _state.currentParams;
  const getHistory       = () => _state.history;

  return {
    getUser, getConfig, getLayouts, getCores, isSecretaria, isOwnerOf, init,
    cacheSet, cacheGet, cacheInvalidate, cacheInvalidateAll,
    pushHistory, popHistory, setCurrentView, getCurrentView, getCurrentParams, getHistory,
  };
})();

/* ============================================================
   EventBus — pub/sub simples (mesmo arquivo)
   ============================================================ */
const EventBus = (() => {
  const _listeners = {};

  function on(event, handler) {
    (_listeners[event] = _listeners[event] || []).push(handler);
    return () => off(event, handler);
  }
  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter((h) => h !== handler);
  }
  function emit(event, data) {
    (_listeners[event] || []).slice().forEach((h) => {
      try { h(data); } catch (e) { console.error('[EventBus]', event, e); }
    });
  }
  function once(event, handler) {
    const un = on(event, (data) => { un(); handler(data); });
    return un;
  }

  return { on, off, emit, once };
})();
