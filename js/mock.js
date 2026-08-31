/* ============================================================
   mock.js — dados e API de DEMONSTRAÇÃO (sem Supabase).
   Ativo quando CONFIG.DEMO_MODE === true. Mutações ficam em memória
   (perdidas ao recarregar). Quando o banco existir, é só desligar a flag.
   ============================================================ */
const MockData = {
  config: {
    nome_secretaria: 'Secretaria Municipal de Educação',
    cidade: 'Ribeirão Preto · SP',
    descricao: 'Revista digital das unidades escolares — edição de demonstração',
    edicao: '2026',
    cor_primaria: '#1B3A6B',
  },

  temas: [
    { id: 't1', nome: 'Boas Práticas da Cozinha', descricao: 'Alimentação saudável e merenda nas escolas.', icone: '🍎', cor: '#C2603F', tag: 'Alimentação', status: 'ativo', ordem: 1, criado_em: new Date().toISOString() },
    { id: 't2', nome: 'Leitura e Literatura', descricao: 'Projetos de incentivo à leitura.', icone: '📚', cor: '#8A6BA8', tag: 'Cultura', status: 'ativo', ordem: 2, criado_em: '2026-01-15T00:00:00Z' },
    { id: 't3', nome: 'Sustentabilidade', descricao: 'Hortas, reciclagem e meio ambiente.', icone: '🌱', cor: '#7A7D2A', tag: 'Meio Ambiente', status: 'ativo', ordem: 3, criado_em: '2026-02-20T00:00:00Z' },
  ],

  unidades: [
    { id: 'u1', nome: 'EMEF Padre Anchieta', sigla: 'EPA', cidade: 'Ribeirão Preto', regiao: 'Centro', cor: '#1B3A6B', status: 'ativo' },
    { id: 'u2', nome: 'EMEI Monteiro Lobato', sigla: 'EML', cidade: 'Ribeirão Preto', regiao: 'Norte', cor: '#2E5FA3', status: 'ativo' },
    { id: 'u3', nome: 'EMEF Cecília Meireles', sigla: 'ECM', cidade: 'Ribeirão Preto', regiao: 'Sul', cor: '#D98E4A', status: 'ativo' },
  ],

  inscricoes: [
    { id: 'i1', unidade_id: 'u1', tema_id: 't1', status: 'aprovado' },
    { id: 'i2', unidade_id: 'u2', tema_id: 't1', status: 'aprovado' },
    { id: 'i3', unidade_id: 'u3', tema_id: 't2', status: 'aprovado' },
    { id: 'i4', unidade_id: 'u2', tema_id: 't2', status: 'pendente' },
  ],

  paginas: [
    {
      id: 'p1', unidade_id: 'u1', tema_id: 't1', inscricao_id: 'i1', titulo: 'Nossa horta na merenda',
      ordem: 1, layout: 'hero-texto-galeria', status: 'publicado', principal_status: 'aprovado',
      conteudo: {
        tag: 'Alimentação', tagCor: '#C2603F', titulo: 'Da horta ao prato',
        subtitulo: 'Como a horta escolar transformou a merenda',
        texto: 'Os alunos plantaram, cuidaram e colheram.\nO resultado chegou direto à cozinha da escola, valorizando alimentos frescos e o trabalho coletivo.',
        galeria: ['https://picsum.photos/seed/horta1/600/400', 'https://picsum.photos/seed/horta2/600/400', 'https://picsum.photos/seed/horta3/600/400'],
      },
    },
    {
      id: 'p2', unidade_id: 'u1', tema_id: 't1', inscricao_id: 'i1', titulo: 'Números do projeto',
      ordem: 2, layout: 'indicadores', status: 'publicado', principal_status: 'aprovado',
      conteudo: {
        tag: 'Resultados', tagCor: '#C2603F', titulo: 'O impacto em números',
        subtitulo: 'Primeiro semestre de 2026',
        indicadores: [
          { icone: '🧑‍🎓', valor: '320', label: 'Alunos envolvidos', variacao: '+18%' },
          { icone: '🥗', valor: '12', label: 'Hortaliças cultivadas', variacao: '' },
          { icone: '🍽', valor: '4.500', label: 'Refeições no semestre', variacao: '+9%' },
        ],
        citacao: 'A comida ficou mais gostosa e as crianças querem repetir.',
        citacaoAutor: 'Merendeira da escola',
      },
    },
    {
      id: 'p3', unidade_id: 'u2', tema_id: 't1', inscricao_id: 'i2', titulo: 'Cozinha experimental',
      ordem: 1, layout: 'citacao-galeria', status: 'publicado', principal_status: 'pendente',
      conteudo: {
        tag: 'Alimentação', tagCor: '#2E5FA3', titulo: 'Sabores da infância',
        subtitulo: 'Oficinas culinárias com as famílias',
        citacao: 'Cozinhar junto é também aprender a cuidar.',
        citacaoAutor: 'Professora dos Anos Iniciais',
        galeria: ['https://picsum.photos/seed/coz1/600/400', 'https://picsum.photos/seed/coz2/600/400'],
        texto: 'As oficinas reuniram pais, alunos e professores em torno de receitas afetivas.',
      },
    },
    {
      id: 'p4', unidade_id: 'u3', tema_id: 't2', inscricao_id: 'i3', titulo: 'Clube do livro',
      ordem: 1, layout: 'timeline', status: 'publicado', principal_status: 'aprovado',
      conteudo: {
        tag: 'Leitura', tagCor: '#D98E4A', titulo: 'Um ano de leituras',
        subtitulo: 'A trajetória do clube do livro',
        eventos: [
          { data: 'Fev 2026', titulo: 'Abertura', descricao: 'Primeiro encontro com 40 alunos.' },
          { data: 'Abr 2026', titulo: 'Saraus', descricao: 'Apresentações de poesia no pátio.' },
          { data: 'Jun 2026', titulo: 'Feira literária', descricao: 'Mostra aberta à comunidade.' },
        ],
      },
    },
    {
      id: 'p5', unidade_id: 'u3', tema_id: 't2', inscricao_id: 'i3', titulo: 'Galeria do sarau',
      ordem: 2, layout: 'galeria-completa', status: 'publicado', principal_status: 'nenhum',
      conteudo: {
        titulo: 'Momentos do sarau', tagCor: '#D98E4A',
        galeria: ['https://picsum.photos/seed/sarau1/600/400', 'https://picsum.photos/seed/sarau2/600/400', 'https://picsum.photos/seed/sarau3/600/400', 'https://picsum.photos/seed/sarau4/600/400'],
        texto: 'Registros das apresentações dos alunos.',
      },
    },
  ],
};

const MockApi = (() => {
  let _seq = 100;
  const _id = (p) => `${p}${++_seq}`;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const tema = (id) => MockData.temas.find((t) => t.id === id);
  const unidade = (id) => MockData.unidades.find((u) => u.id === id);

  function _temaCounts(temaId) {
    const pubs = MockData.paginas.filter((p) => p.tema_id === temaId && p.status === 'publicado');
    const naPrincipal = pubs.filter((p) => p.principal_status === 'aprovado');
    return {
      total_unidades: new Set(pubs.map((p) => p.unidade_id)).size,
      total_paginas: pubs.length,
      total_principal: naPrincipal.length,
    };
  }

  const secretaria = {
    getData: async () => ({
      config: clone(MockData.config),
      temas: MockData.temas.filter((t) => t.status === 'ativo')
        .sort((a, b) => a.ordem - b.ordem)
        .map((t) => ({ ...clone(t), ..._temaCounts(t.id) })),
    }),
  };

  const temas = {
    getData: async (id) => {
      const t = tema(id);
      const aprovadas = MockData.inscricoes.filter((i) => i.tema_id === id && i.status === 'aprovado');
      const unidades = aprovadas.map((i) => {
        const u = unidade(i.unidade_id);
        if (!u) return null;
        const pubs = MockData.paginas.filter((p) => p.unidade_id === u.id && p.tema_id === id && p.status === 'publicado')
          .sort((a, b) => a.ordem - b.ordem);
        const principais = pubs.filter((p) => p.principal_status === 'aprovado');
        return {
          ...clone(u),
          total_pags: pubs.length,
          total_principal: principais.length,
          na_principal: principais.length > 0,
          capa: pubs[0] ? { titulo: pubs[0].titulo, layout: pubs[0].layout } : null,
          capa_principal: principais[0] ? { titulo: principais[0].titulo, layout: principais[0].layout } : null,
        };
      }).filter((u) => u && u.total_pags > 0);
      return { tema: clone(t), unidades };
    },
    criar: async (payload) => {
      const novo = { id: _id('t'), status: 'ativo', ordem: MockData.temas.length + 1,
                     criado_em: new Date().toISOString(), ...payload };
      MockData.temas.push(novo);
      return clone(novo);
    },
    atualizar: async (id, payload) => { Object.assign(tema(id), payload); return clone(tema(id)); },
    setStatus: async (id, status) => { tema(id).status = status; return clone(tema(id)); },
  };

  const unidades = {
    listar: async () => clone(MockData.unidades),
    criar: async (payload) => { const u = { id: _id('u'), status: 'ativo', ...payload }; MockData.unidades.push(u); return clone(u); },
    atualizar: async (id, payload) => { Object.assign(unidade(id), payload); return clone(unidade(id)); },
    setStatus: async (id, status) => { unidade(id).status = status; return clone(unidade(id)); },
  };

  const inscricoes = {
    solicitar: async (unidadeId, temaId) => {
      const ja = MockData.inscricoes.find((i) => i.unidade_id === unidadeId && i.tema_id === temaId);
      if (ja) throw new Error('Unidade já inscrita neste tema.');
      const novo = { id: _id('i'), unidade_id: unidadeId, tema_id: temaId, status: 'pendente' };
      MockData.inscricoes.push(novo);
      return clone(novo);
    },
    setStatus: async (id, status) => {
      const i = MockData.inscricoes.find((x) => x.id === id);
      i.status = status;
      return clone(i);
    },
  };

  const paginas = {
    // scope: 'escola' (tudo publicado) | 'principal' (só aprovado na revista principal)
    getRevista: async (unidadeId, temaId, scope = 'escola') => ({
      unidade: clone(unidade(unidadeId)),
      paginas: MockData.paginas
        .filter((p) => p.unidade_id === unidadeId && p.tema_id === temaId && p.status === 'publicado'
          && (scope !== 'principal' || p.principal_status === 'aprovado'))
        .sort((a, b) => a.ordem - b.ordem).map(clone),
    }),
    getModoEdicao: async (unidadeId, temaId) => ({
      unidade: clone(unidade(unidadeId)),
      paginas: MockData.paginas.filter((p) => p.unidade_id === unidadeId && p.tema_id === temaId && p.status !== 'excluido')
        .sort((a, b) => a.ordem - b.ordem).map(clone),
    }),
    salvar: async (payload) => {
      let p = payload.id ? MockData.paginas.find((x) => x.id === payload.id) : null;
      if (p) { Object.assign(p, payload); }
      else { p = { ...payload, id: _id('p'), status: payload.status || 'rascunho', principal_status: 'nenhum' }; MockData.paginas.push(p); }
      return { id: p.id, status: p.status, principal_status: p.principal_status };
    },
    // status na revista da própria escola (rascunho/publicado/excluido)
    setStatus: async (id, status) => {
      const p = MockData.paginas.find((x) => x.id === id);
      p.status = status;
      // ao despublicar/excluir, sai também da principal
      if (status !== 'publicado') p.principal_status = 'nenhum';
      return { id: p.id, status, unidade_id: p.unidade_id, tema_id: p.tema_id };
    },
    // escola envia a página (já publicada) para avaliação da revista principal
    enviarParaPrincipal: async (id) => {
      const p = MockData.paginas.find((x) => x.id === id);
      if (p.status !== 'publicado') throw new Error('Publique a página antes de enviar à revista principal.');
      p.principal_status = 'pendente';
      return { id: p.id, principal_status: p.principal_status };
    },
    // SME aprova/recusa a entrada na revista principal
    setPrincipalStatus: async (id, principal_status) => {
      const p = MockData.paginas.find((x) => x.id === id);
      p.principal_status = principal_status;
      return { id: p.id, principal_status, unidade_id: p.unidade_id, tema_id: p.tema_id };
    },
    reordenar: async (_u, _t, ordemArray) => {
      ordemArray.forEach(({ id, ordem }) => { const p = MockData.paginas.find((x) => x.id === id); if (p) p.ordem = ordem; });
      return true;
    },
  };

  const storage = {
    _basePath: (u, t, tipo) => `unidades/${u}/${t}/${tipo}`,
    // Mesmo contrato do storage real. Na demonstração o "caminho" já é uma URL
    // (objectURL do arquivo escolhido), então assinar é devolver o que veio.
    assinar: async (paths) => Object.fromEntries((paths || []).map((p) => [p, p])),
    listarArquivos: async () => [],
    uploadArquivo: async (_u, _t, _tipo, file) => {
      // Na demonstração o "caminho" É a URL local do arquivo escolhido: assim o
      // renderer a reconhece como endereço externo e mostra a foto na hora.
      // Devolver o nome do arquivo aqui deixaria a galeria vazia na demo.
      const url = (window.URL || window.webkitURL).createObjectURL(file);
      return { path: url, url };
    },
  };

  const admin = {
    getDashboard: async () => {
      const pgs = MockData.paginas;
      const stats = {
        total_unidades: MockData.unidades.filter((u) => u.status === 'ativo').length,
        total_temas: MockData.temas.filter((t) => t.status === 'ativo').length,
        total_publicadas: pgs.filter((p) => p.status === 'publicado').length,
        total_na_principal: pgs.filter((p) => p.principal_status === 'aprovado').length,
        total_principal_pend: pgs.filter((p) => p.status === 'publicado' && p.principal_status === 'pendente').length,
        total_rascunhos: pgs.filter((p) => p.status === 'rascunho').length,
        total_inscr_pend: MockData.inscricoes.filter((i) => i.status === 'pendente').length,
        total_usuarios: 1,
      };
      const inscricoes_pendentes = MockData.inscricoes.filter((i) => i.status === 'pendente').map((i) => ({
        id: i.id, inscrito_em: '', unidade_nome: unidade(i.unidade_id)?.nome || '—', tema_nome: tema(i.tema_id)?.nome || '—',
      }));
      const paginas_principal = pgs.filter((p) => p.status === 'publicado' && p.principal_status === 'pendente').map((p) => ({
        id: p.id, titulo: p.titulo, atualizado_em: '',
        unidade_nome: unidade(p.unidade_id)?.nome || '—', tema_nome: tema(p.tema_id)?.nome || '—',
      }));
      return { stats, inscricoes_pendentes, paginas_principal };
    },
  };

  const config = {
    getAll: async () => clone(MockData.config),
    set: async (chave, valor) => { MockData.config[chave] = valor; return { chave, valor }; },
  };

  return { secretaria, temas, unidades, inscricoes, paginas, storage, admin, config };
})();
