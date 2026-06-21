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
  function cacheSet(key, data, ttlSec) {
    _state.cache[key] = { data, expiresAt: Date.now() + (ttlSec * 1000) };
  }
  function cacheGet(key) {
    const e = _state.cache[key];
    if (!e) return null;
    if (Date.now() > e.expiresAt) { delete _state.cache[key]; return null; }
    return e.data;
  }
  function cacheInvalidate(...keys) {
    keys.forEach((k) => delete _state.cache[k]);
    EventBus.emit('cache:invalidate', { keys });
  }
  function cacheInvalidateAll() { _state.cache = {}; }

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
