/* ============================================================
   renderer.js — renderizadores dos 6 layouts de página.
   Gera HTML para FUNDO BRANCO (página da revista). Cores hardcoded.
   ============================================================ */
const Renderer = (() => {

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Marinho da identidade (Mural de Praticas). A cor do tema entra como acento,
  // nao como fundo inteiro — senao cada pagina vira de uma familia visual.
  const NAVY = '#1B3A6B';

  // ── Helpers compartilhados ──────────────────────────────
  function _hero(c, height = 220) {
    const cor = c.tagCor || NAVY;
    const bg = c.heroBg
      ? `background:linear-gradient(180deg, rgba(20,41,75,.25), rgba(20,41,75,.88)), url('${_esc(c.heroBg)}') center/cover`
      : `background:linear-gradient(140deg, ${NAVY} 0%, #24487F 58%, ${cor} 190%)`;
    return `<div class="rp-hero" style="${bg};min-height:${height}px">
      ${c.tag ? `<span class="rp-tag" style="background:${cor}">${_esc(c.tag)}</span>` : ''}
      ${c.titulo ? `<h1 class="rp-title">${_esc(c.titulo)}</h1>` : ''}
      ${c.subtitulo ? `<p class="rp-subtitle">${_esc(c.subtitulo)}</p>` : ''}
      ${c.titulo ? `<span class="rp-rule" aria-hidden="true"></span>` : ''}
    </div>`;
  }

  function _galeria(items, cols = 3) {
    if (!items || !items.length) return '';
    return `<div class="rp-gallery" style="grid-template-columns:repeat(${cols},1fr)">
      ${items.map((src) => `<div class="rp-gallery-item">
        <img src="${_esc(src)}" alt="" loading="lazy"></div>`).join('')}
    </div>`;
  }

  function _video(url) {
    if (!url) return `<div class="rp-video-placeholder">🎬 Vídeo não informado</div>`;
    let embed = url;
    const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
    return `<div class="rp-video"><iframe src="${_esc(embed)}" frameborder="0"
      allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
      allowfullscreen></iframe></div>`;
  }

  function _citacao(c) {
    if (!c.citacao) return '';
    return `<blockquote class="rp-quote">
      <p>“${_esc(c.citacao)}”</p>
      ${c.citacaoAutor ? `<cite>— ${_esc(c.citacaoAutor)}</cite>` : ''}
    </blockquote>`;
  }

  function _metricas(items) {
    if (!items || !items.length) return '';
    return `<div class="rp-metrics">${items.map((m) =>
      `<div class="rp-metric"><div class="rp-metric-val">${_esc(m.valor)}</div>
        <div class="rp-metric-label">${_esc(m.label)}</div></div>`).join('')}</div>`;
  }

  function _indicadores(items) {
    if (!items || !items.length) return '';
    return `<div class="rp-metrics">${items.map((m) =>
      `<div class="rp-metric">
        ${m.icone ? `<div class="rp-ind-ic">${_esc(m.icone)}</div>` : ''}
        <div class="rp-metric-val">${_esc(m.valor)}</div>
        <div class="rp-metric-label">${_esc(m.label)}</div>
        ${m.variacao ? `<div class="rp-ind-var">${_esc(m.variacao)}</div>` : ''}
      </div>`).join('')}</div>`;
  }

  function _timeline(items) {
    if (!items || !items.length) return '';
    return `<div class="rp-timeline">${items.map((e) =>
      `<div class="rp-tl-item">
        <div class="rp-tl-dot"></div>
        <div class="rp-tl-content">
          <div class="rp-tl-date">${_esc(e.data)}</div>
          <div class="rp-tl-title">${_esc(e.titulo)}</div>
          ${e.descricao ? `<div class="rp-tl-desc">${_esc(e.descricao)}</div>` : ''}
        </div>
      </div>`).join('')}</div>`;
  }

  function _texto(text) {
    if (!text) return '';
    return `<div class="rp-text">${text.split('\n').filter(Boolean)
      .map((p) => `<p>${_esc(p)}</p>`).join('')}</div>`;
  }

  // ── Layouts ─────────────────────────────────────────────
  function _layoutHeroTextoGaleria(c) {
    return _hero(c) + `<div class="rp-body">${_texto(c.texto)}${_galeria(c.galeria || [])}</div>`;
  }
  function _layoutVideoMetricas(c) {
    return _hero(c, 160) + `<div class="rp-body">${_video(c.videoUrl)}${_metricas(c.metricas || [])}${_citacao(c)}</div>`;
  }
  function _layoutCitacaoGaleria(c) {
    return _hero(c, 160) + `<div class="rp-body">${_citacao(c)}${_galeria(c.galeria || [])}${_texto(c.texto)}</div>`;
  }
  function _layoutGaleriaCompleta(c) {
    return `<div class="rp-body">${c.titulo ? `<h1 class="rp-title-dark">${_esc(c.titulo)}</h1>
      <span class="rp-rule rp-rule-dark" aria-hidden="true"></span>` : ''}
      ${_galeria(c.galeria || [], 3)}${_texto(c.texto)}</div>`;
  }
  function _layoutTimeline(c) {
    return _hero(c, 160) + `<div class="rp-body">${_timeline(c.eventos || [])}</div>`;
  }
  function _layoutIndicadores(c) {
    return _hero(c, 160) + `<div class="rp-body">${_indicadores(c.indicadores || [])}${_citacao(c)}</div>`;
  }

  const _fns = {
    'hero-texto-galeria': _layoutHeroTextoGaleria,
    'video-metricas':     _layoutVideoMetricas,
    'citacao-galeria':    _layoutCitacaoGaleria,
    'galeria-completa':   _layoutGaleriaCompleta,
    'timeline':           _layoutTimeline,
    'indicadores':        _layoutIndicadores,
  };

  function renderPagina(pagina) {
    if (!pagina) return '';
    const fn = _fns[pagina.layout] || _fns['hero-texto-galeria'];
    return `<div class="rp-page-inner">${fn(pagina.conteudo || {})}</div>`;
  }

  return { renderPagina };
})();
