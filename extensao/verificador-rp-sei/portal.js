'use strict';

// Public, read-only CATMAS endpoint. Never accept a URL from the SEI page.
const CatmasPortal = (() => {
  const endpoint = 'https://www1.compras.mg.gov.br/servico/catalogo/itemmaterialservico/Consulta/pesquisar';
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function search(code, type, page = 1) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST', credentials: 'omit', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ reqId: page, ordenacoes: [], sizePerPage: 10, page,
            filtros: { tiposGrupo: type, codigoItem: code, situacoes: [] } })
        });
        if (!response.ok) {
          const error = new Error(response.status === 403
            ? 'Portal bloqueou a consulta; confira o código manualmente no portal'
            : `Portal respondeu HTTP ${response.status}`);
          error.retryable = response.status === 429 || response.status >= 500;
          throw error;
        }
        const data = await response.json();
        const result = data && data.resultado;
        if (!result || !Array.isArray(result.dados) || !Number.isSafeInteger(result.total) || result.total < 0 || result.dados.length > 10) {
          throw new Error('Resposta inesperada do portal; consulta não confirmada');
        }
        if (result.total > 100 || (result.total > 0 && result.dados.length === 0)) {
          throw new Error('Pesquisa inconclusiva no portal; confira o código manualmente');
        }
        return result;
      } catch (error) {
        if (attempt === 0 && (error.retryable || error.name === 'AbortError' || error instanceof TypeError)) {
          await delay(1000);
          continue;
        }
        if (error.name === 'AbortError') throw new Error('Portal não respondeu no prazo; tente novamente');
        throw error;
      } finally { clearTimeout(timer); }
    }
  }

  async function query(raw) {
    if (typeof raw !== 'string' || !/^\d{1,12}$/.test(raw) || /^0+$/.test(raw)) {
      throw new Error('Código CATMAS inválido');
    }
    const code = raw.length < 9 ? raw.padStart(9, '0') : raw;
    const matches = [];
    for (const type of ['MATERIAL', 'SERVICO']) {
      const first = await search(code, type);
      const rows = [...first.dados];
      for (let page = 2; page <= Math.ceil(first.total / 10); page++) {
        const next = await search(code, type, page);
        if (next.total !== first.total) throw new Error('Resultados mudaram durante a consulta; tente novamente');
        rows.push(...next.dados);
      }
      if (rows.length !== first.total) throw new Error('Resposta incompleta do portal');
      for (const row of rows) {
        if (row.codigo === code) matches.push({ row, type });
      }
    }
    const checkedAt = new Date().toISOString();
    const source = endpoint;
    if (!matches.length) return { result: 'missing', description: '', situation: '', reason: 'Código não encontrado no Portal de Compras', checkedAt, source };
    if (matches.length !== 1) return { result: 'unverified', description: '', situation: '', reason: 'Código ambíguo no portal; conferir manualmente', checkedAt, source };
    const { row, type } = matches[0];
    if (typeof row.espOkRegPrecos !== 'boolean' || !row.situacao || typeof row.situacao.id !== 'string' || typeof row.especificacaoCompleta !== 'string') {
      throw new Error('Dados de RP incompletos no portal; consulta não confirmada');
    }
    // Preserve the existing RP rule: approval depends on this specific flag.
    return { matchedCode: row.codigo, result: row.espOkRegPrecos ? 'ok' : 'not-ok',
      description: row.especificacaoCompleta, situation: row.situacao.descricao || row.situacao.id,
      reason: row.espOkRegPrecos ? 'OK para RP' : 'Não marcado como OK para RP',
      portalId: row.id, portalVersion: row.versao, type, checkedAt, source };
  }
  return { query };
})();
