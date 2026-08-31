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

  // Veu escuro sobre a foto da capa, para o titulo continuar legivel. Fica numa
  // constante porque `resolverArquivos` remonta o mesmo fundo depois de assinar.
  const VEU = 'linear-gradient(180deg, rgba(20,41,75,.25), rgba(20,41,75,.88))';

  // 1x1 transparente: segura o lugar da imagem ate a URL assinada chegar, sem
  // o icone de imagem quebrada piscando na tela.
  const VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // O bucket e PRIVADO: o que esta gravado em `conteudo` e o CAMINHO do
  // arquivo, nao uma URL. Endereco externo (o que alguem colou a mao) passa
  // direto; caminho vira `data-mag-arquivo` e espera a assinatura.
  function _ehExterno(src) { return /^(https?:|data:|blob:)/i.test(String(src || '')); }

  // ── Helpers compartilhados ──────────────────────────────
  function _hero(c, height = 220) {
    const cor = c.tagCor || NAVY;
    const semFoto = `background:linear-gradient(140deg, ${NAVY} 0%, #24487F 58%, ${cor} 190%)`;
    let bg = semFoto, aguarda = '';
    if (c.heroBg && _ehExterno(c.heroBg)) {
      bg = `background:${VEU}, url('${_esc(c.heroBg)}') center/cover`;
    } else if (c.heroBg) {
      // Fica no degrade ate a assinatura chegar — o texto continua legivel
      // nesse meio-tempo, que e o motivo de nao deixar o fundo vazio.
      aguarda = ` data-mag-fundo="${_esc(c.heroBg)}"`;
    }
    return `<div class="rp-hero"${aguarda} style="${bg};min-height:${height}px">
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
        <img ${_ehExterno(src)
                ? `src="${_esc(src)}"`
                : `src="${VAZIO}" data-mag-arquivo="${_esc(src)}"`
              } alt="" loading="lazy"></div>`).join('')}
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

  /**
   * Troca os caminhos de arquivo por URLs assinadas, DEPOIS que o HTML entrou
   * na tela. O renderizador e sincrono de proposito (ele so monta texto), e
   * assinar exige ida ao servidor — separar as duas coisas e o que permite a
   * pagina aparecer inteira antes de as fotos chegarem.
   *
   * ⚠️ Assina TUDO de uma vez. Uma chamada por imagem faria a galeria de 12
   * fotos virar 12 requisicoes, e a revista reassinaria a cada virada de
   * pagina (o cache de `Api.storage` cobre a repeticao).
   *
   * Falha aqui NAO derruba a pagina: o texto e o que a revista tem de
   * essencial. O que nao assinou fica sem foto e sai no console dizendo qual.
   */
  async function resolverArquivos(container) {
    if (!container) return;
    const imgs  = [...container.querySelectorAll('img[data-mag-arquivo]')];
    const capas = [...container.querySelectorAll('[data-mag-fundo]')];
    if (!imgs.length && !capas.length) return;

    const caminhos = [
      ...imgs.map((el) => el.dataset.magArquivo),
      ...capas.map((el) => el.dataset.magFundo),
    ].filter(Boolean);

    let urls = {};
    try { urls = await Api.storage.assinar(caminhos); }
    catch (err) { console.error('[renderer] falha ao assinar arquivos', err); return; }

    imgs.forEach((el) => {
      const u = urls[el.dataset.magArquivo];
      if (!u) return;                       // sem URL: fica o vazio, nao um link quebrado
      el.src = u;
      delete el.dataset.magArquivo;         // ja resolvido; nao reassina
    });
    capas.forEach((el) => {
      const u = urls[el.dataset.magFundo];
      if (!u) return;                       // sem URL: continua no degrade
      el.style.background = `${VEU}, url('${u}') center/cover`;
      delete el.dataset.magFundo;
    });
  }

  return { renderPagina, resolverArquivos };
})();
