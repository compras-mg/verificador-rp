/* Patch only the verified cells. Keep all other worksheet XML and ZIP members intact. */
(function(root){
  'use strict';
  const attr=(text,name)=>text.match(new RegExp('\\s'+name+'\\s*=\\s*["\\\']([^"\\\']*)["\\\']'))?.[1];
  const index=letters=>[...letters].reduce((value,ch)=>value*26+ch.charCodeAt(0)-64,0);
  const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function patchWorksheet(source,rowNumbers,column='N',value='OK'){
    if(!/^[A-Z]+$/.test(column))throw Error('Coluna de conferência inválida.');
    const pending=new Set(rowNumbers.map(Number));
    if([...pending].some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Linha de conferência inválida.');
    const destination=index(column);
    const output=source.replace(/<((?:[\w.-]+:)?row)\b([^>]*)(?:\/>|>([\s\S]*?)<\/\1\s*>)/g,(whole,tag,attributes,body)=>{
      const number=Number(attr(attributes,'r'));if(!pending.has(number))return whole;
      if(body==null)throw Error('A linha de item está vazia.');
      pending.delete(number);
      const prefix=tag.includes(':')?tag.slice(0,tag.indexOf(':')+1):'';
      const reference=column+number;
      const cellPattern=/<((?:[\w.-]+:)?c)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1\s*>)/g;
      const cells=[...body.matchAll(cellPattern)];
      const matches=cells.filter(m=>attr(m[2],'r')===reference);
      if(matches.length>1)throw Error('Há células duplicadas na linha de conferência.');
      const contents=p=>`<${p}is><${p}t>${escape(value)}</${p}t></${p}is>`;
      if(matches.length){
        const cell=matches[0],p=cell[1].includes(':')?cell[1].slice(0,cell[1].indexOf(':')+1):'';
        const attributes=cell[2].replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/g,'');
        const children=(cell[3]||'').replace(/<((?:[\w.-]+:)?(?:v|f|is))\b[^>]*(?:\/>|>[\s\S]*?<\/\1\s*>)/g,'');
        const replacement=`<${cell[1]}${attributes} t="inlineStr">${contents(p)}${children}</${cell[1]}>`;
        body=body.slice(0,cell.index)+replacement+body.slice(cell.index+cell[0].length);
      }else{
        const next=cells.find(m=>{const ref=attr(m[2],'r')?.match(/^([A-Z]+)\d+$/);return ref&&index(ref[1])>destination;});
        const at=next?next.index:cells.length?cells.at(-1).index+cells.at(-1)[0].length:0;
        const cell=`<${prefix}c r="${reference}" t="inlineStr">${contents(prefix)}</${prefix}c>`;
        body=body.slice(0,at)+cell+body.slice(at);
      }
      attributes=attributes.replace(/(\sspans\s*=\s*["'])(\d+):(\d+)(["'])/,(m,a,min,max,z)=>a+Math.min(Number(min),destination)+':'+Math.max(Number(max),destination)+z);
      return `<${tag}${attributes}>${body}</${tag}>`;
    });
    if(pending.size)throw Error('Uma linha de conferência não foi encontrada. O arquivo original foi preservado.');
    return output.replace(/(<(?:[\w.-]+:)?dimension\b[^>]*\sref=["'])([A-Z]+\d+):([A-Z]+)(\d+)(["'])/,(m,a,start,end,row,z)=>a+start+':'+(index(end)<destination?column:end)+row+z);
  }
  const api={patchWorksheet};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RPWorkbookPreserve=api;
})(typeof globalThis!=='undefined'?globalThis:this);
