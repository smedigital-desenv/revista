/* ============================================================
   api.js — TODAS as queries ao Supabase. Views nunca tocam o SB direto.
   Padrão de erro: const { data, error } = await ...; if (error) throw Error.
   ============================================================ */
const Api = (() => {
  const _sb = () => SupabaseClient.client;
  const _uid = () => Store.getUser()?.id || null;

  function _check({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  }

  // Conta itens dentro de um array de relação retornado pelo Supabase (ex: paginas: [{count}])
  function _count(rel) {
    if (!Array.isArray(rel)) return 0;
    if (rel.length && typeof rel[0]?.count === 'number') return rel[0].count;
    return rel.length;
  }

  // ── Secretaria ──────────────────────────────────────────
  const secretaria = {
    getData: async () => {
      const cached = Store.cacheGet('secretaria_data');
      if (cached) return cached;

      // A config já foi carregada na abertura da sessão e está no Store. Buscá-la
      // de novo aqui era uma consulta a cada visita ao início, para trazer o que
      // já estava na mão.
      const jaTem = Store.getConfig();
      const temConfig = jaTem && Object.keys(jaTem).length > 0;

      const [temasRes, configRes] = await Promise.all([
        _sb().from('temas')
          .select('*, inscricoes(count), paginas(count)')
          .eq('status', 'ativo')
          .order('ordem'),
        temConfig ? null : _sb().from('config').select('chave, valor'),
      ]);

      const temasRaw = _check(temasRes);
      const configRaw = configRes ? _check(configRes) : null;

      const temas = (temasRaw || []).map((t) => ({
        ...t,
        total_unidades: _count(t.inscricoes),
        total_paginas:  _count(t.paginas),
      }));
      const config = temConfig ? jaTem : {};
      (configRaw || []).forEach((c) => { config[c.chave] = c.valor; });

      const result = { config, temas };
      Store.cacheSet('secretaria_data', result, CONFIG.CACHE_TTL.TEMAS);
      return result;
    },
  };

  // ── Temas ───────────────────────────────────────────────
  const temas = {
    getData: async (id) => {
      const key = 'tema_' + id;
      const cached = Store.cacheGet(key);
      if (cached) return cached;

      const temaRes = await _sb().from('temas').select('*').eq('id', id).single();
      const tema = _check(temaRes);

      const inscRes = await _sb().from('inscricoes')
        .select('unidade_id, unidades ( id, nome, sigla, cidade, cor ), paginas ( id, titulo, layout, ordem, status, principal_status )')
        .eq('tema_id', id)
        .eq('status', 'aprovado');
      const inscricoes = _check(inscRes) || [];

      const unidades = inscricoes
        .map((i) => {
          const u = i.unidades;
          if (!u) return null;
          const pubs = (i.paginas || [])
            .filter((p) => p.status === 'publicado')
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
          const principais = pubs.filter((p) => p.principal_status === 'aprovado');
          return {
            ...u,
            total_pags: pubs.length,
            total_principal: principais.length,
            na_principal: principais.length > 0,
            capa: pubs[0] ? { titulo: pubs[0].titulo, layout: pubs[0].layout } : null,
            capa_principal: principais[0] ? { titulo: principais[0].titulo, layout: principais[0].layout } : null,
          };
        })
        .filter((u) => u && u.total_pags > 0);

      const result = { tema, unidades };
      Store.cacheSet(key, result, CONFIG.CACHE_TTL.UNIDADES);
      return result;
    },

    criar: async (payload) => {
      const data = _check(await _sb().from('temas')
        .insert({ ...payload, criado_por: _uid() })
        .select().single());
      Store.cacheInvalidate('secretaria_data');
      EventBus.emit('tema:criado', { id: data.id });
      return data;
    },

    atualizar: async (id, payload) => {
      const data = _check(await _sb().from('temas').update(payload).eq('id', id).select().single());
      Store.cacheInvalidate('secretaria_data', 'tema_' + id);
      return data;
    },

    setStatus: async (id, status) => {
      const data = _check(await _sb().from('temas').update({ status }).eq('id', id).select().single());
      Store.cacheInvalidate('secretaria_data', 'tema_' + id);
      return data;
    },
  };

  // ── Unidades ────────────────────────────────────────────
  const unidades = {
    listar: async () => _check(await _sb().from('unidades')
      .select('id, escola_central_id, nome, sigla, cidade, regiao, cor, status')
      .order('nome')),

    criar: async (payload) => {
      const data = _check(await _sb().from('unidades').insert(payload).select().single());
      Store.cacheInvalidate('admin_dashboard');
      return data;
    },
    atualizar: async (id, payload) =>
      _check(await _sb().from('unidades').update(payload).eq('id', id).select().single()),
    setStatus: async (id, status) =>
      _check(await _sb().from('unidades').update({ status }).eq('id', id).select().single()),
  };

  // ── Inscrições ──────────────────────────────────────────
  const inscricoes = {
    solicitar: async (unidadeId, temaId) => {
      const data = _check(await _sb().from('inscricoes')
        .insert({ unidade_id: unidadeId, tema_id: temaId, inscrito_por: _uid() })
        .select().single());
      Store.cacheInvalidate('admin_dashboard', 'tema_' + temaId);
      EventBus.emit('inscricao:status', { id: data.id, status: 'pendente' });
      return data;
    },

    setStatus: async (id, status) => {
      const patch = { status };
      if (status === CONFIG.STATUS_INSCRICAO.APROVADO) {
        patch.aprovado_em = new Date().toISOString();
        patch.aprovado_por = _uid();
      }
      const data = _check(await _sb().from('inscricoes').update(patch).eq('id', id).select().single());
      Store.cacheInvalidate('admin_dashboard', 'secretaria_data');
      EventBus.emit('inscricao:status', { id, status });
      return data;
    },
  };

  // ── Páginas ─────────────────────────────────────────────
  const paginas = {
    // scope: 'escola' (tudo publicado) | 'principal' (só aprovado na revista principal)
    getRevista: async (unidadeId, temaId, scope = 'escola') => {
      const key = `revista_${scope}_${unidadeId}_${temaId}`;
      const cached = Store.cacheGet(key);
      if (cached) return cached;

      let q = _sb().from('paginas').select('*')
        .eq('unidade_id', unidadeId).eq('tema_id', temaId)
        .eq('status', 'publicado');
      if (scope === 'principal') q = q.eq('principal_status', 'aprovado');

      const [unidadeRes, paginasRes] = await Promise.all([
        _sb().from('unidades').select('id, nome, sigla, cidade, cor, storage_path').eq('id', unidadeId).single(),
        q.order('ordem'),
      ]);

      const result = { unidade: _check(unidadeRes), paginas: _check(paginasRes) || [] };
      Store.cacheSet(key, result, CONFIG.CACHE_TTL.PAGINAS);
      return result;
    },

    getModoEdicao: async (unidadeId, temaId) => {
      const [unidadeRes, paginasRes] = await Promise.all([
        _sb().from('unidades').select('id, nome, sigla, cidade, cor, storage_path').eq('id', unidadeId).single(),
        _sb().from('paginas').select('*')
          .eq('unidade_id', unidadeId).eq('tema_id', temaId)
          .neq('status', 'excluido').order('ordem'),
      ]);
      return { unidade: _check(unidadeRes), paginas: _check(paginasRes) || [] };
    },

    _invalidate: (unidadeId, temaId) => Store.cacheInvalidate(
      'admin_dashboard', 'secretaria_data', 'tema_' + temaId,
      `revista_escola_${unidadeId}_${temaId}`, `revista_principal_${unidadeId}_${temaId}`),

    salvar: async (payload) => {
      const row = {
        ...payload,
        atualizado_em:  new Date().toISOString(),
        atualizado_por: _uid(),
      };
      if (!row.id) delete row.id; // insert
      const data = _check(await _sb().from('paginas').upsert(row).select('id, status, principal_status').single());
      paginas._invalidate(payload.unidade_id, payload.tema_id);
      EventBus.emit('pagina:salva', { id: data.id, status: data.status });
      return data;
    },

    // status na revista da própria escola (rascunho/publicado/excluido)
    setStatus: async (id, status) => {
      const patch = { status, atualizado_em: new Date().toISOString(), atualizado_por: _uid() };
      if (status !== 'publicado') patch.principal_status = 'nenhum'; // sai da principal
      const data = _check(await _sb().from('paginas').update(patch)
        .eq('id', id).select('id, status, unidade_id, tema_id').single());
      paginas._invalidate(data.unidade_id, data.tema_id);
      EventBus.emit('pagina:status', { id, novoStatus: status });
      return data;
    },

    // escola envia página (publicada) para avaliação da revista principal
    enviarParaPrincipal: async (id) => {
      const data = _check(await _sb().from('paginas')
        .update({ principal_status: 'pendente' })
        .eq('id', id).eq('status', 'publicado')
        .select('id, principal_status, unidade_id, tema_id').single());
      paginas._invalidate(data.unidade_id, data.tema_id);
      EventBus.emit('pagina:status', { id, novoStatus: 'principal:pendente' });
      return data;
    },

    // SME aprova/recusa a entrada na revista principal
    setPrincipalStatus: async (id, principalStatus) => {
      const patch = { principal_status: principalStatus };
      if (principalStatus === 'aprovado') { patch.principal_aprovado_em = new Date().toISOString(); patch.principal_aprovado_por = _uid(); }
      const data = _check(await _sb().from('paginas').update(patch)
        .eq('id', id).select('id, principal_status, unidade_id, tema_id').single());
      paginas._invalidate(data.unidade_id, data.tema_id);
      EventBus.emit('pagina:status', { id, novoStatus: 'principal:' + principalStatus });
      return data;
    },

    reordenar: async (unidadeId, temaId, ordemArray) => {
      // ordemArray: [{ id, ordem }]
      await Promise.all(ordemArray.map(({ id, ordem }) =>
        _sb().from('paginas').update({ ordem }).eq('id', id)));
      Store.cacheInvalidate(`revista_${unidadeId}_${temaId}`);
      return true;
    },
  };

  // ── Storage ─────────────────────────────────────────────
  // O bucket `portfolio-mag` é PRIVADO (foto de atividade escolar, criança
  // identificável), então não existe URL pública: o acesso é por URL ASSINADA,
  // que expira.
  //
  // ⚠️ Por isso o que se GRAVA em `paginas.conteudo` é o CAMINHO, nunca a URL.
  // URL assinada gravada no banco vira link quebrado no dia seguinte, e o
  // sintoma (imagem sumida em página antiga) não aponta para a causa.
  // Quem transforma caminho em URL na hora de exibir é `Renderer.resolverArquivos`.
  const storage = {
    _basePath: (unidadeId, temaId, tipo) => `unidades/${unidadeId}/${temaId}/${tipo}`,

    // Assinaturas ficam em memória enquanto valem. Sem isto, cada virada de
    // página da revista assinaria de novo os mesmos arquivos.
    _cache: new Map(),
    VALIDADE: 3600,          // 1 h — o que a URL assinada dura
    _MARGEM: 600,            // reassina 10 min antes de expirar

    /**
     * Assina vários caminhos de uma vez.
     * @param {string[]} paths
     * @returns {Promise<Object<string,string>>} caminho -> URL assinada
     */
    assinar: async (paths) => {
      const agora = Date.now();
      const saida = {};
      const faltando = [];

      for (const p of paths || []) {
        if (!p) continue;
        const c = storage._cache.get(p);
        if (c && c.ate > agora) saida[p] = c.url;
        else if (!faltando.includes(p)) faltando.push(p);
      }
      if (!faltando.length) return saida;

      const { data, error } = await _sb().storage
        .from(CONFIG.STORAGE_BUCKET)
        .createSignedUrls(faltando, storage.VALIDADE);
      if (error) throw new Error(error.message);

      const ate = agora + (storage.VALIDADE - storage._MARGEM) * 1000;
      (data || []).forEach((d) => {
        // Um caminho que falhou vem com `error` preenchido e sem URL. Ele fica
        // de fora do resultado — quem chamou mostra o buraco em vez de um link
        // quebrado, e o console diz qual arquivo foi.
        if (d.error || !d.signedUrl) {
          console.warn('[storage] não assinou', d.path, d.error);
          return;
        }
        saida[d.path] = d.signedUrl;
        storage._cache.set(d.path, { url: d.signedUrl, ate });
      });
      return saida;
    },

    listarArquivos: async (unidadeId, temaId, tipo) => {
      const base = storage._basePath(unidadeId, temaId, tipo);
      const { data, error } = await _sb().storage
        .from(CONFIG.STORAGE_BUCKET).list(base, { limit: 100 });
      if (error) throw new Error(error.message);
      const arquivos = (data || []).map((f) => ({ ...f, path: `${base}/${f.name}` }));
      const urls = await storage.assinar(arquivos.map((f) => f.path));
      return arquivos.map((f) => ({ ...f, url: urls[f.path] || null }));
    },

    uploadArquivo: async (unidadeId, temaId, tipo, file) => {
      const path = `${storage._basePath(unidadeId, temaId, tipo)}/${Date.now()}_${file.name}`;
      const { error } = await _sb().storage.from(CONFIG.STORAGE_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw new Error(error.message);
      const urls = await storage.assinar([path]);
      // `path` é o que vai para o banco; `url` serve só para a pré-visualização
      // imediata, e expira.
      return { path, url: urls[path] || null };
    },
  };

  // ── Admin ───────────────────────────────────────────────
  const admin = {
    getDashboard: async () => {
      const cached = Store.cacheGet('admin_dashboard');
      if (cached) return cached;

      const [unidadesRes, temasRes, paginasRes, inscricoesRes, usuariosRes] = await Promise.all([
        _sb().from('unidades').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
        _sb().from('temas').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
        _sb().from('paginas').select('status, principal_status'),
        _sb().from('inscricoes').select('status'),
        _sb().from('usuarios').select('id', { count: 'exact', head: true }).eq('ativo', true),
      ]);

      const pgs = _check(paginasRes) || [];
      const inscr = _check(inscricoesRes) || [];

      const stats = {
        total_unidades:       unidadesRes.count || 0,
        total_temas:          temasRes.count || 0,
        total_publicadas:     pgs.filter((p) => p.status === 'publicado').length,
        total_na_principal:   pgs.filter((p) => p.principal_status === 'aprovado').length,
        total_principal_pend: pgs.filter((p) => p.status === 'publicado' && p.principal_status === 'pendente').length,
        total_rascunhos:      pgs.filter((p) => p.status === 'rascunho').length,
        total_inscr_pend:     inscr.filter((i) => i.status === 'pendente').length,
        total_usuarios:       usuariosRes.count || 0,
      };

      const [pendRes, principalRes] = await Promise.all([
        _sb().from('inscricoes')
          .select('id, inscrito_em, unidades ( nome ), temas ( nome )')
          .eq('status', 'pendente').order('inscrito_em'),
        _sb().from('paginas')
          .select('id, titulo, atualizado_em, unidades ( nome ), temas ( nome )')
          .eq('status', 'publicado').eq('principal_status', 'pendente').order('atualizado_em'),
      ]);

      const inscricoes_pendentes = (_check(pendRes) || []).map((i) => ({
        id: i.id, inscrito_em: i.inscrito_em,
        unidade_nome: i.unidades?.nome || '—', tema_nome: i.temas?.nome || '—',
      }));
      const paginas_principal = (_check(principalRes) || []).map((p) => ({
        id: p.id, titulo: p.titulo, atualizado_em: p.atualizado_em,
        unidade_nome: p.unidades?.nome || '—', tema_nome: p.temas?.nome || '—',
      }));

      const result = { stats, inscricoes_pendentes, paginas_principal };
      Store.cacheSet('admin_dashboard', result, CONFIG.CACHE_TTL.DASHBOARD);
      return result;
    },
  };

  // ── Config ──────────────────────────────────────────────
  const config = {
    getAll: async () => {
      const rows = _check(await _sb().from('config').select('chave, valor'));
      const obj = {};
      (rows || []).forEach((c) => { obj[c.chave] = c.valor; });
      return obj;
    },
    set: async (chave, valor) => {
      const data = _check(await _sb().from('config').upsert({ chave, valor }).select().single());
      Store.cacheInvalidate('secretaria_data');
      return data;
    },
  };

  const real = { secretaria, temas, unidades, inscricoes, paginas, storage, admin, config };

  // Em modo demonstração, delega tudo para a API de mock (sem Supabase).
  return (typeof CONFIG !== 'undefined' && CONFIG.DEMO_MODE && typeof MockApi !== 'undefined')
    ? MockApi : real;
})();
