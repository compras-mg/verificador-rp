const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const script = readFileSync(__dirname + '/../verificador-rp-sei/portal.js', 'utf8');
function portal(responses) {
  const calls = [];
  const context = vm.createContext({ AbortController, setTimeout, clearTimeout, console,
    fetch: async (url, options) => {
      calls.push({url, options, body: JSON.parse(options.body)});
      if (!responses.length) throw new Error('Unexpected request');
      return responses.shift();
    } });
  vm.runInContext(script, context);
  return { query: code => vm.runInContext(`CatmasPortal.query(${JSON.stringify(code)})`, context), calls };
}
const response = (rows, total=rows.length) => ({ok:true,json:async()=>({resultado:{dados:rows,total}})});
const item = {codigo:'001883488',id:272956,versao:9,espOkRegPrecos:true,situacao:{id:'ATIVO',descricao:'Ativo'},especificacaoCompleta:'Cadeira'};
(async () => {
  let p = portal([response([item]),response([])]);
  let result = await p.query('1883488');
  assert.equal(result.result,'ok'); assert.equal(result.portalVersion,9);
  assert.equal(p.calls[0].body.filtros.codigoItem,'001883488');
  assert.equal(p.calls[1].body.filtros.tiposGrupo,'SERVICO');
  assert.equal(p.calls[0].options.credentials,'omit');
  p=portal([response([]),response([{...item,espOkRegPrecos:false}])]);
  assert.equal((await p.query('1883488')).result,'not-ok');
  p=portal([response([]),response([])]);assert.equal((await p.query('1883488')).result,'missing');
  p=portal([response([item]),response([item])]);assert.equal((await p.query('1883488')).result,'unverified');
  p=portal([response([{...item,espOkRegPrecos:null}]),response([])]);
  await assert.rejects(p.query('1883488'),/incompletos/);
  p=portal([{ok:false,status:403}]);await assert.rejects(p.query('1883488'),/bloqueou/);
  p=portal([{ok:true,json:async()=>({})}]);await assert.rejects(p.query('1883488'),/inesperada/);
  p=portal([response([],1)]);await assert.rejects(p.query('1883488'),/inconclusiva/);
  p=portal([]);await assert.rejects(p.query('https://evil.test'),/inválido/);assert.equal(p.calls.length,0);
  p=portal([response(Array(10).fill({...item,codigo:'009999999'}),11),response([item],11),response([])]);
  assert.equal((await p.query('1883488')).result,'ok');assert.equal(p.calls[1].body.page,2);
  console.log('10 cenários de consulta passaram.');
})().catch(error=>{console.error(error);process.exitCode=1});
