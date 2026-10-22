// Full content-script workflow with a synthetic SEI page and mocked CATMAS.
// No live requests, authenticated session, or real process documents are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = path.resolve(__dirname, '../verificador-rp-sei');
const JSZip = require(path.join(base, 'vendor/jszip.min.js'));
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function fixture(rows) {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', `<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="FORMULÁRIO" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="${NS}"><sheetData>${rows.map((row, i) => {
    const n = i + 11;
    return `<row r="${n}">${Object.entries({ A: '123', B: 'Cadeira 10 cm', G: '', H: '', O: 'Preservar', ...row }).map(([column, value]) => `<c r="${column}${n}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join('')}</row>`;
  }).join('')}</sheetData><mergeCells count="${rows.length}">${rows.map((_, i) => `<mergeCell ref="B${i + 11}:F${i + 11}"/>`).join('')}</mergeCells></worksheet>`);
  zip.file('xl/worksheets/sheet2.xml', '<worksheet>Outra aba preservada</worksheet>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

(async () => {
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    await page.setContent('<h1>Ambiente de teste</h1><p>Processo fictício: 0000.00.0000001/2000-00</p><div id="divArvoreAcoes" style="height:60px;background:#eee">Barra do processo</div>');
    await page.evaluate(() => {
      window.requests = [];
      window.failPortal = false;
      window.chrome = { runtime: { onMessage: { addListener() {} }, async sendMessage(message) {
        window.requests.push(message);
        if (message.type !== 'VRP_QUERY_CATMAS') throw Error('Unexpected operation');
        if (window.failPortal) return { error: 'Portal indisponível para teste' };
        return { result: { result: 'ok', description: 'CADEIRA 10 CM', reason: 'OK para RP', situation: 'Ativo', checkedAt: '2026-01-01T12:00:00.000Z' } };
      } } };
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
    for (const script of manifest.content_scripts[0].js) await page.addScriptTag({ path: path.join(base, script) });
    await page.locator('#vrp-sei-toolbar-button').click();
    const input = page.locator('#localFile');
    const results = page.locator('#resultView');
    const mixed = await fixture([
      { B: '  cadeira\n10 CM  ' },
      { A: '000000123', B: 'Cadeira 100 cm' },
      { G: '<img src=x onerror="window.injected=true"> Azul', H: 'Sim' },
      { B: '' }
    ]);
    await input.setInputFiles({ name: 'pendencias.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: mixed });
    await results.locator('h2').filter({ hasText: 'Verificação com pendências' }).waitFor();
    assert.equal(await results.locator('tbody tr').count(), 4);
    assert.equal(await results.locator('.tag.ok').count(), 1);
    assert.equal(await results.locator('.tag.bad').count(), 3);
    assert.match(await results.innerText(), /B12/);
    assert.match(await results.innerText(), /G13/);
    assert.match(await results.innerText(), /H13/);
    assert.match(await results.innerText(), /B14/);
    assert.equal(await results.locator('#downloadVerified, #uploadVerified, #generateMemo').count(), 0);
    assert.equal(await results.locator('img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    const requests = await page.evaluate(() => window.requests);
    assert.deepEqual(requests, [{ type: 'VRP_QUERY_CATMAS', code: '000000123' }]);
    if (process.env.ARTIFACT_DIR) {
      fs.mkdirSync(process.env.ARTIFACT_DIR, { recursive: true });
      await page.locator('#panel').screenshot({ path: path.join(process.env.ARTIFACT_DIR, 'pendencias.png') });
    }

    const approved = await fixture([{}]);
    await input.setInputFiles({ name: 'aprovada.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: approved });
    await results.locator('h2').filter({ hasText: 'Verificação concluída' }).waitFor();
    assert.equal(await results.locator('#downloadVerified, #uploadVerified, #generateMemo').count(), 3);
    assert.equal(await page.evaluate(() => window.requests.length), 2, 'Nova verificação precisa consultar o portal novamente');
    const downloaded = page.waitForEvent('download');
    await results.locator('#downloadVerified').click();
    const download = await downloaded;
    const after = await JSZip.loadAsync(fs.readFileSync(await download.path()));
    const before = await JSZip.loadAsync(approved);
    assert.deepEqual(Object.keys(after.files), Object.keys(before.files));
    for (const name of Object.keys(before.files).filter(name => !before.files[name].dir)) {
      if (name === 'xl/worksheets/sheet1.xml') {
        const output = await after.file(name).async('string');
        assert.match(output, /<c r="N11" t="inlineStr"><is><t>OK<\/t><\/is><\/c>/);
        assert.equal(output.replace(/<c r="N11"[^>]*>[\s\S]*?<\/c>/, ''), await before.file(name).async('string'));
      } else assert.deepEqual(await after.file(name).async('uint8array'), await before.file(name).async('uint8array'));
    }
    await results.locator('#generateMemo').click();
    await page.locator('#memoForm').waitFor();
    if (process.env.ARTIFACT_DIR) await page.locator('#panel').screenshot({ path: path.join(process.env.ARTIFACT_DIR, 'aprovada.png') });

    await page.evaluate(() => { window.failPortal = true; });
    await input.setInputFiles({ name: 'falha-consulta.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: mixed });
    await results.locator('h2').filter({ hasText: 'Verificação com pendências' }).waitFor();
    assert.match(await results.innerText(), /Portal indisponível para teste/);
    assert.match(await results.innerText(), /G13/);
    assert.match(await results.innerText(), /H13/);
    assert.equal(await results.locator('#downloadVerified, #uploadVerified, #generateMemo').count(), 0);
    assert.equal(await page.locator('#memoView').isVisible(), false);
    assert.equal(await page.evaluate(() => window.requests.length), 3);
    assert.deepEqual(errors, []);
    console.log('OK: fluxo completo, consulta única por código, pendências por linha, comparação visível, exportação íntegra e bloqueio do memorando.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
