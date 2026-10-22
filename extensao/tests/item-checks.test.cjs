const assert = require('node:assert/strict');
const { compareSpecification, verifyItem } = require('../verificador-rp-sei/item-checks.js');

assert.equal(compareSpecification('Cadeira\n  em AÇO\u00a0inox', 'CADEIRA EM AÇO INOX').status, 'ok');
assert.equal(compareSpecification('Cafe\u0301', 'Café').status, 'ok');
assert.equal(compareSpecification('Cadeira 10 cm', 'Cadeira 100 cm').status, 'pending');
assert.equal(compareSpecification('Cadeira azul', 'Cadeira vermelha').status, 'pending');
assert.equal(compareSpecification('Frasco 1,5 L', 'Frasco 15 L').status, 'pending');
assert.equal(compareSpecification('Sem braço', 'Com braço').status, 'pending');
assert.equal(compareSpecification('Cadeira', 'Cadeira; material: aço').status, 'pending');
assert.equal(compareSpecification('  \n ', 'Cadeira').status, 'pending');
assert.equal(compareSpecification('Cadeira', '').status, 'unverified');
assert.equal(compareSpecification('Cadeira', 'Cadeira', true).status, 'unverified');
console.log('OK: comparação de especificação aceita variações de caixa/espaçamento e detecta diferenças de conteúdo.');

const item = { row: 11, originalCode: '123', specification: 'Cadeira 10 cm', specificationComplement: '', longSpecification: '', specificationReadErrors: [] };
const portal = { result: 'ok', description: 'CADEIRA 10 CM', reason: 'OK para RP', checkedAt: '2026-01-01T12:00:00.000Z' };
assert.equal(verifyItem(item, portal).result, 'ok');
assert.equal(verifyItem({ ...item, specification: 'Cadeira 100 cm' }, portal).result, 'pending');
assert.equal(verifyItem({ ...item, specification: '' }, portal).result, 'pending');
for (const [key, column] of [['specificationComplement', 'G'], ['longSpecification', 'H']]) {
  for (const value of ['Sim', 'Complemento livre', '0', '-', 'Não se aplica']) {
    const result = verifyItem({ ...item, [key]: value }, portal);
    assert.equal(result.result, 'pending');
    assert.equal(result.rpResult, 'ok');
    assert.deepEqual(result.checks.filter(check => check.status !== 'ok').map(check => check.cell), [column + '11']);
  }
  assert.equal(verifyItem({ ...item, [key]: ' \n\t ' }, portal).result, 'ok');
}
const both = verifyItem({ ...item, specificationComplement: 'Cor azul', longSpecification: 'Sim' }, portal);
assert.deepEqual(both.checks.filter(check => check.status !== 'ok').map(check => check.cell), ['G11', 'H11']);
for (const column of ['B', 'G', 'H']) {
  const result = verifyItem({ ...item, specificationReadErrors: [column] }, portal);
  assert.equal(result.result, 'unverified');
  assert.equal(result.checks.find(check => check.column === column).status, 'unverified');
}
assert.equal(verifyItem(item, { ...portal, result: 'not-ok', reason: 'Não marcado como OK para RP' }).result, 'not-ok');
for (const status of ['missing', 'unverified']) {
  const result = verifyItem({ ...item, specificationComplement: 'Cor azul' }, { ...portal, result: status });
  assert.equal(result.result, status);
  assert.equal(result.checks[0].status, 'unverified');
  assert.equal(result.checks[1].status, 'pending');
}
assert.equal(verifyItem(item, { ...portal, description: '' }).result, 'unverified');
assert.equal(verifyItem(item).result, 'unverified');
assert.equal(portal.result, 'ok');
assert.equal(item.specificationComplement, '');
console.log('OK: B:F, G/H e habilitação RP combinados por linha; nenhuma pendência é aprovada automaticamente.');
