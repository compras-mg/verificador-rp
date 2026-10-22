// Uses a synthetic XLSX and a local headless browser. No SEI or portal access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = path.resolve(__dirname, '../verificador-rp-sei');

(async () => {
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.addScriptTag({ path: path.join(base, 'vendor/jszip.min.js') });
    const source = fs.readFileSync(path.join(base, 'content.js'), 'utf8');
    const parser = source.slice(source.indexOf('  function xml('), source.indexOf('  async function queryPortalItems('));
    await page.addScriptTag({ content: `
      const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
      const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
      const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
      ${parser}
    ` });
    const result = await page.evaluate(async () => {
      const zip = new JSZip();
      zip.file('xl/workbook.xml', `<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets><sheet name="FORMULÁRIO" sheetId="1" r:id="rId1"/></sheets></workbook>`);
      zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`);
      zip.file('xl/sharedStrings.xml', `<sst xmlns="${NS}"><si><r><t>Texto </t></r><r><t>longo &amp; completo</t></r><rPh sb="0" eb="1"><t>Não incluir anotação</t></rPh></si></sst>`);
      zip.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="${NS}"><sheetData>
        <row r="10"><c r="A10"><v>999</v></c></row>
        <row r="11"><c r="A11"><v>123</v></c><c r="B11" t="inlineStr"><is><r><t>Cadeira </t></r><r><t>10 cm</t></r></is></c><c r="G11" t="inlineStr"><is><r><t>Cor </t></r><r><t>azul</t></r></is></c><c r="H11" t="s"><v>0</v></c></row>
        <row r="12"><c r="A12"><v>123</v></c><c r="G12" t="inlineStr"><is><t>  \n </t></is></c></row>
        <row r="13"><c r="A13"><v>456</v></c><c r="G13"><f>1-1</f><v>0</v></c><c r="H13" t="str"><f>CONCAT(&quot;Texto&quot;)</f><v>Texto calculado</v></c></row>
        <row r="14"><c r="A14"><v>789</v></c><c r="B14" t="e"><v>#REF!</v></c><c r="G14" t="str"><f>CONCAT(&quot;x&quot;)</f></c><c r="H14" t="e"><v>#VALUE!</v></c></row>
        <row r="15"><c r="A15"><v>101</v></c><c r="G15" t="s"><v>88</v></c><c r="H15" t="str"><f>IF(1=1,&quot;&quot;,&quot;x&quot;)</f><v></v></c></row>
      </sheetData><mergeCells count="1"><mergeCell ref="B11:F11"/></mergeCells></worksheet>`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const workbook = await parseWorkbook(new File([blob], 'formulario-sintetico.xlsx'));
      return workbook.items;
    });
    assert.equal(result.length, 5);
    assert.equal(result[0].specification, 'Cadeira 10 cm');
    assert.equal(result[0].specificationComplement, 'Cor azul');
    assert.equal(result[0].longSpecification, 'Texto longo & completo');
    assert.equal(result[1].specificationComplement, '');
    assert.equal(result[1].longSpecification, '');
    assert.equal(result[2].specificationComplement, '0');
    assert.equal(result[2].longSpecification, 'Texto calculado');
    assert.deepEqual(result[3].specificationReadErrors, ['B', 'G', 'H']);
    assert.deepEqual(result[4].specificationReadErrors, ['G']);
    assert.equal(result[4].longSpecification, '');
    console.log('OK: B:F mesclada e G/H lidas do XLSX, texto formatado, fórmulas, erros de leitura e linhas repetidas.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
