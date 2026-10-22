// Offline test fixture: procedure IDs 100/101 and example.test are synthetic. No network requests.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const controls=Object.fromEntries(['selSerie','txtDataElaboracao','txtNomeArvore','optNato','optPublico','hdnIdProcedimento'].map(id=>[id,{id,disabled:false,matches:()=>true,getClientRects:()=>[{}],value:id==='hdnIdProcedimento'?'100':''}]));
const context=vm.createContext({document:{getElementById:id=>controls[id],querySelectorAll:()=>[]},location:{href:'https://sei.example.test/sei/controlador.php?id_procedimento=100'},URL,chrome:{},setInterval:()=>{},window:{}});
let source=fs.readFileSync(__dirname+'/../verificador-rp-sei/upload-flow.js','utf8').replace('setInterval(tick,1500);tick();','globalThis.helpers={field,sameProcess};');
vm.runInContext(source,context);
for(const [label,id] of [['Tipo do Documento','selSerie'],['Data do Documento','txtDataElaboracao'],['Nome na Árvore','txtNomeArvore'],['Nato-digital','optNato'],['Público','optPublico']]) assert.equal(context.helpers.field(label,'input'),controls[id]);
assert.equal(context.helpers.sameProcess({procedureId:'100'}),true);
assert.equal(context.helpers.sameProcess({procedureId:'101'}),false);
console.log('Identificadores observados do SEI e bloqueio de processo diferente passaram.');
