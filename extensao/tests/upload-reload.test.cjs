// Offline test fixture: procedure IDs 100/101 and example.test are synthetic. No network requests.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../verificador-rp-sei/upload-flow.js','utf8').replace('setInterval(tick,1500);tick();','globalThis.tick=tick;');
const messages=[];
function page(selected){
 const controls={};
 for(const id of ['selSerie','txtDataElaboracao','txtNomeArvore','optNato','optPublico','hdnIdProcedimento','filArquivo']) controls[id]={value:'',disabled:false,matches:()=>true,getClientRects:()=>[{}],dispatchEvent(){},click(){this.checked=true;}};
 Object.assign(controls.selSerie,{value:selected,options:[{textContent:'Planilha',value:'104'}],dispatchEvent(e){if(e.type==='change')messages.push('reload');}});
 controls.hdnIdProcedimento.value='100';controls.filArquivo.type='file';controls.filArquivo.files=[];
 const save={textContent:'Salvar',getClientRects:()=>[{}]};
 const document={body:{append(){}},createElement:()=>({style:{},append(){}}),getElementById:id=>controls[id],querySelector:()=>({textContent:'Registrar Documento Externo'}),querySelectorAll:s=>s.startsWith('button')?[save]:[]};
 const chrome={runtime:{async sendMessage(m){messages.push(m.type);if(m.type==='VRP_UPLOAD_GET')return {job:{stage:'form',procedureId:'100',date:'02/10/2026'}};if(m.type==='VRP_UPLOAD_FILE')return {base64:'YQ==',name:'conferida.xlsx'};if(m.type==='VRP_UPLOAD_CLAIM')return {claimed:true};}}};
 const ctx=vm.createContext({document,chrome,Date,URL,location:{href:'https://sei.example.test/'},Event:class{constructor(type){this.type=type}},atob:s=>Buffer.from(s,'base64').toString('binary'),Uint8Array,File:class{},DataTransfer:class{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}}});
 vm.runInContext(source,ctx);return {ctx,controls};
}
(async()=>{
 const before=page('');await before.ctx.tick();await before.ctx.tick();
 assert.equal(messages.filter(m=>m==='reload').length,1);
 assert.equal(messages.includes('VRP_UPLOAD_FILE'),false);
 assert.equal(messages.includes('VRP_UPLOAD_CLAIM'),false);
 assert.equal(before.controls.txtNomeArvore.value,'');
 const after=page('104');await after.ctx.tick();
 assert.equal(messages.filter(m=>m==='reload').length,1);
 assert.equal(after.controls.txtNomeArvore.value,'Conferida');
 assert.equal(after.controls.txtDataElaboracao.value,'02/10/2026');
 assert.equal(after.controls.optPublico.checked,true);
 assert.equal(after.controls.filArquivo.files.length,1);
 assert.equal(messages.includes('VRP_UPLOAD_CLAIM'),true);
 console.log('Recarregamento: seleciona uma vez, aguarda nova página e só então preenche/anexa.');
})();
