const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../verificador-rp-sei/content.js','utf8');
const scan=source.slice(source.indexOf('  function scanSeiPage()'),source.indexOf('  function processContext()'));
const url=(id,extra='')=>`https://sei.mg.gov.br/sei/controlador.php?acao=arvore_visualizar&id_documento=${id}${extra}`;
const sheet='Planilha CONSULTA CATMAS (900000001)';
function collect(frames){
 const ctx=vm.createContext({
  PROCESS_RE:/\b\d{4}\.\d{2}\.\d{7}\/\d{4}-\d{2}\b/g,
  walkDocuments:cb=>frames.forEach(links=>cb({body:{innerText:'0000.00.0000002/2000-00'},querySelectorAll:()=>links})),
  elementLabel:e=>e.label,elementRawAction:e=>e.raw||e.url,extractUrls:s=>s.match(/https:\/\/[^'"\s]+/g)||[],
  extractSeiNumber:s=>(s.match(/\b\d{7,12}\b/g)||[]).at(-1)||''
 });
 vm.runInContext(scan+'globalThis.result=scanSeiPage();',ctx);
 return ctx.result;
}
// The screenshot: the copy control precedes the actual document and has another URL.
let result=collect([[{label:sheet+' Copiar texto',url:url('901','&acao_origem=copiar')},{label:sheet,url:url('901','&infra_hash=one')}]]);
assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].label,sheet);
assert.equal(result.candidates[0].url,url('901','&infra_hash=one'));
// Multiple frames/session links + a download with only a displayed SEI number.
result=collect([[{label:sheet,url:url('901','&infra_hash=one')}],[{label:sheet,url:url('901','&infra_hash=two')},{label:sheet,url:'https://sei.mg.gov.br/sei/controlador.php?acao=anexo_download&id_anexo=700'}]]);
assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].url,url('901','&infra_hash=one'));
// Internal identifier deduplicates even without a displayed document number.
result=collect([[{label:'Planilha recebida',url:url('901')},{label:'Planilha recebida',url:url('901','&x=1')}]]);
assert.equal(result.candidates.length,1);
// Equal labels and a shared process number do not identify the same document.
result=collect([[{label:'Planilha recebida 0000.00.0000002/2000-00',url:url('901')},{label:'Planilha recebida 0000.00.0000002/2000-00',url:url('902')}]]);
assert.equal(result.candidates.length,2);
result=collect([[{label:'Planilha recebida (900000001)',url:url('901')},{label:'Planilha recebida (900000002)',url:url('902')}]]);
assert.equal(result.candidates.length,2);
// A bridging link joins a viewer without a label to the tree and public-number-only link.
result=collect([[{label:'Planilha recebida',url:url('901')},{label:sheet,url:'https://sei.mg.gov.br/sei/controlador.php?acao=anexo_download&id_anexo=700'},{label:sheet,url:url('901','&x=1')}]]);
assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].label,sheet);
// Standalone clipboard controls are excluded; memoranda retain tree order and identity.
result=collect([[{label:sheet,url:url('901')},{label:sheet,url:url('901'),getAttribute:n=>n==='title'?'Copiar texto':null},{label:'Memorando 340 (900000003)',url:url('903')}]]);
assert.equal(result.documents.length,2);assert.equal(result.documents[1].seiNumber,'900000003');
assert.equal(result.candidates.length,1);
console.log('OK: cópia ignorada, documento único entre quadros/URLs e documentos distintos preservados.');
