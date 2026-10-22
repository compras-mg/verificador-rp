/* Compare spreadsheet text locally against the specification returned by CATMAS. */
(function (root) {
  'use strict';

  function normalizeSpecification(value) {
    return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
  }

  function compareSpecification(spreadsheet, official, unreadable = false) {
    if (unreadable) return { status: 'unverified', reason: 'Não foi possível ler a especificação da planilha.' };
    const actual = normalizeSpecification(spreadsheet);
    const expected = normalizeSpecification(official);
    if (!actual) return { status: 'pending', reason: 'A especificação do item está vazia na planilha.' };
    if (!expected) return { status: 'unverified', reason: 'O portal não retornou uma especificação que permita a comparação.' };
    if (actual !== expected) return { status: 'pending', reason: 'A especificação da planilha difere da especificação do Portal de Compras.' };
    return { status: 'ok', reason: 'Especificação igual à do Portal de Compras.' };
  }

  function verifyItem(item, portal) {
    const rpResult = portal?.result || 'unverified';
    const rpReason = portal?.reason || 'Consulta ao Portal de Compras não confirmada.';
    const errors = new Set(item.specificationReadErrors || []);
    // The official lookup is shared by code, but each spreadsheet row has its
    // own specification and complements and must be checked independently.
    const specificationCheck = compareSpecification(item.specification,
      ['ok', 'not-ok'].includes(rpResult) ? portal.description : '', errors.has('B'));
    const checks = [{ field: 'Especificação (B:F)', column: 'B', cell: `B${item.row}`,
      value: item.specification || '', ...specificationCheck }];
    for (const [column, field, value] of [
      ['G', 'Complementação da especificação', item.specificationComplement],
      ['H', 'Especificação longa', item.longSpecification]
    ]) {
      const unreadable = errors.has(column);
      const populated = normalizeSpecification(value).length > 0;
      checks.push({ column, field, cell: `${column}${item.row}`, value: value ?? '',
        status: unreadable ? 'unverified' : populated ? 'pending' : 'ok',
        reason: unreadable ? 'Não foi possível ler esta célula. Confira o arquivo no Excel.'
          : populated ? 'Há conteúdo nesta coluna. É necessária análise manual.' : 'Sem conteúdo.' });
    }
    const issues = checks.filter(check => check.status !== 'ok');
    const result = rpResult !== 'ok' ? rpResult : issues.some(check => check.status === 'unverified')
      ? 'unverified' : issues.length ? 'pending' : 'ok';
    return { ...item, ...portal, rpResult, rpReason, checks, result,
      reason: result === 'ok' ? 'Conferido' : 'Requer análise' };
  }

  const api = { compareSpecification, verifyItem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RPItemChecks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
