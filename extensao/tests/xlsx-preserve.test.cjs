const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname, '../verificador-rp-sei');
const preserve = require(path.join(base, 'xlsx-preserve.js'));
const JSZip = require(path.join(base, 'vendor/jszip.min.js'));
const original = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:AA12"/><cols><col min="15" max="27" hidden="1" width="22"/></cols><sheetData><row r="11" spans="1:27"><c r="A11" t="s"><v>0</v></c><c r="M11" s="3"><v>100</v></c><c r="O11" s="4"><f>M11*2</f><v>200</v></c><c r="P11" t="inlineStr"><is><t>Preservar</t></is></c><c r="AA11"><v>999</v></c></row><row r="12"><c r="A12"><v>123</v></c><c r="N12" s="7" t="s"><v>1</v></c><c r="O12"><f>SUM(M11:O11)</f><v>300</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="P1:AA1"/></mergeCells></worksheet>';
const patched = preserve.patchWorksheet(original, [11,12]);
for (const cell of original.matchAll(/<c\b[^>]*\br="(?!N12)[^"]+"[^>]*>[\s\S]*?<\/c>/g)) assert(patched.includes(cell[0]), cell[0]);
assert(patched.indexOf('r="M11"') < patched.indexOf('r="N11"'));
assert(patched.indexOf('r="N11"') < patched.indexOf('r="O11"'));
assert(patched.includes('<c r="N12" s="7" t="inlineStr"><is><t>OK</t></is></c>'));
assert.equal(preserve.patchWorksheet(patched,[11,12]),patched);
assert.equal((patched.match(/<c\b/g)||[]).length,(original.match(/<c\b/g)||[]).length+1);
assert.throws(()=>preserve.patchWorksheet(original,[99]),/não foi encontrada/);
for(const cell of ['<x:c r="N11" s="2"/>','<x:c r="N11" t="n"><x:f>1+2</x:f><x:v>3</x:v></x:c>']) {
 const out=preserve.patchWorksheet(`<x:worksheet><x:sheetData><x:row r="11">${cell}<x:c r="O11"><x:v>5</x:v></x:c></x:row></x:sheetData></x:worksheet>`,[11]);
 assert(out.includes('<x:is><x:t>OK</x:t></x:is>'));
 assert(!out.includes('<x:f>')); assert(!out.includes('<x:v>3</x:v>'));
 assert(out.includes('<x:c r="O11"><x:v>5</x:v></x:c>'));
}
(async()=>{
 const zip=new JSZip();
 const entries={'xl/worksheets/sheet1.xml':original,'xl/worksheets/sheet2.xml':'<worksheet>Outra aba</worksheet>','xl/sharedStrings.xml':'<sst><si><t>Item</t></si><si><t>Anterior</t></si></sst>','xl/styles.xml':'<styleSheet/>','xl/workbook.xml':'<workbook/>','xl/media/image1.png':new Uint8Array([0,1,2,255])};
 for(const [name,data] of Object.entries(entries)) zip.file(name,data);
 const input=await zip.generateAsync({type:'uint8array'});
 const state={workbook:{zip:await JSZip.loadAsync(input),sheetPath:'xl/worksheets/sheet1.xml',sheetSource:original},verification:[{row:11,result:'ok'},{row:12,result:'ok'}]};
 const code=fs.readFileSync(path.join(base,'content.js'),'utf8');
 const helper=code.slice(code.indexOf('  async function createVerifiedWorkbookBlob()'),code.indexOf('  async function uploadVerifiedWorkbook()'));
 const context=vm.createContext({state,RPWorkbookPreserve:preserve});
 vm.runInContext(helper,context);
 const blob=await context.createVerifiedWorkbookBlob();
 const output=await JSZip.loadAsync(await blob.arrayBuffer());
 const before=await JSZip.loadAsync(input);
 assert.deepEqual(Object.keys(output.files),Object.keys(before.files));
 for(const name of Object.keys(entries)) {
  if(name===state.workbook.sheetPath) assert.equal(await output.file(name).async('string'),patched);
  else assert.deepEqual(await output.file(name).async('uint8array'),await before.file(name).async('uint8array'),name);
 }
 state.verification[0].result='pending';
 await assert.rejects(context.createVerifiedWorkbookBlob(),/não aprovou/);
 console.log('OK: exportação preserva colunas, fórmulas, estilos, outras abas e demais arquivos internos.');
})().catch(error=>{console.error(error);process.exitCode=1;});
