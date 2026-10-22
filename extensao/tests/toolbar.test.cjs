const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../verificador-rp-sei/content.js','utf8');
const functions=source.slice(source.indexOf('  function findProcessToolbar()'),source.indexOf('  function extractSeiNumber('));
const BUTTON='vrp-sei-toolbar-button';
function documentFixture(){
 const nodes=[];
 const doc={nodes,querySelectorAll(selector){return nodes.filter(n=>n.isConnected&&selector==='#'+n.id)},getElementById(id){return nodes.find(n=>n.isConnected&&n.id===id)||null}};
 doc.createElement=tag=>{
  const n={tagName:tag.toUpperCase(),id:'',ownerDocument:doc,isConnected:false,children:[],listeners:[],
   appendChild(c){if(c.parentElement)c.parentElement.children=c.parentElement.children.filter(x=>x!==c);c.parentElement=this;c.isConnected=this.isConnected;this.children.push(c)},
   remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null},
   querySelector(selector){return this.children.find(n=>n.isConnected&&selector==='#'+n.id)||null},
   getBoundingClientRect(){return {width:this.hidden?0:700,height:this.hidden?0:65,top:0}},
   setAttribute(){},addEventListener(type,handler){this.listeners.push({type,handler})}
  };nodes.push(n);return n;
 };
 doc.head=doc.createElement('head');doc.head.isConnected=true;
 doc.add=(id,tag='div')=>{const n=doc.createElement(tag);n.id=id;n.isConnected=true;return n};
 return doc;
}
const top=documentFixture(),frame=documentFixture();
const header=top.add('navInfraBarraNavegacao','nav'),bar=frame.add('divArvoreAcoes');
const wrong=top.add(BUTTON,'button'),correct=frame.add(BUTTON,'button'),extra=frame.add(BUTTON,'button'),crc=frame.add('crc-sei-toolbar','span');
header.appendChild(wrong);bar.appendChild(crc);bar.appendChild(correct);bar.appendChild(extra);
let docs=[top,frame];
const state={toolbarButton:wrong,panelOpen:false};
const ctx=vm.createContext({state,walkDocuments:cb=>docs.forEach(doc=>cb(doc)),openPanel(){state.panelOpen=true},closePanel(){state.panelOpen=false}});
vm.runInContext(functions,ctx);
const count=()=>docs.reduce((n,d)=>n+d.querySelectorAll('#'+BUTTON).length,0);
// Retain only the button beside the original actions; CRC belongs to another extension.
assert.equal(ctx.findProcessToolbar(),bar);
ctx.installToolbarButton(bar);
assert.equal(count(),1);assert.equal(state.toolbarButton,correct);assert.equal(correct.parentElement,bar);
assert.equal(wrong.isConnected,false);assert.equal(extra.isConnected,false);assert.equal(crc.isConnected,true);
ctx.installToolbarButton(bar);assert.equal(count(),1);assert.equal(state.toolbarButton,correct);
// During navigation only the system header remains: never use it as a fallback.
const second=documentFixture();docs=[top,second];
assert.equal(ctx.findProcessToolbar(),null);
ctx.removeToolbarButton();assert.equal(count(),0);assert.equal(correct.isConnected,false);
// When the new iframe finishes loading, create one launcher in its own action bar.
const newBar=second.add('divArvoreAcoes');
ctx.installToolbarButton(newBar);const created=state.toolbarButton;
assert.equal(count(),1);assert.equal(created.parentElement,newBar);assert.equal(created.listeners.length,1);
ctx.installToolbarButton(newBar);assert.equal(state.toolbarButton,created);assert.equal(created.listeners.length,1);
created.listeners[0].handler({preventDefault(){},stopPropagation(){}});assert.equal(state.panelOpen,true);
created.listeners[0].handler({preventDefault(){},stopPropagation(){}});assert.equal(state.panelOpen,false);
// Leaving the process removes stale copies even when the tracked reference is gone.
header.appendChild(top.add(BUTTON,'button'));state.toolbarButton=null;
ctx.removeToolbarButton();assert.equal(count(),0);
newBar.hidden=true;assert.equal(ctx.findProcessToolbar(),null);
console.log('OK: um único RP na barra de ações, sem botão no cabeçalho ou duplicação após navegação.');
