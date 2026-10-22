'use strict';

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'VRP_TOGGLE_PANEL' });
  } catch (error) {
    console.warn('O Verificador RP não está disponível nesta página.', error);
  }
});

importScripts('portal.js');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'VRP_QUERY_CATMAS') return;
  const url = sender.url || '';
  if (sender.id !== chrome.runtime.id || !/^https:\/\/(?:www\.)?sei\.mg\.gov\.br\/sei\//.test(url)) {
    sendResponse({ error: 'Origem da consulta não autorizada' });
    return;
  }
  CatmasPortal.query(message.code)
    .then(result => sendResponse({ result }))
    .catch(error => sendResponse({ error: error.message || 'Falha ao consultar o portal' }));
  return true;
});

importScripts('memo-editor.js');
let memoQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message?.type?.startsWith('VRP_MEMO_')) return;
  if (sender.id !== chrome.runtime.id || !sender.tab?.id || !/^https:\/\/(?:www\.)?sei\.mg\.gov\.br\/sei\//.test(sender.url || '')) {
    respond({ error: 'Origem não autorizada' }); return;
  }
  memoQueue = memoQueue.catch(() => {}).then(async () => {
    const key = `memo:${sender.tab.id}`;
    let draft = (await chrome.storage.session.get(key))[key];
    if (message.type === 'VRP_MEMO_START') {
      if (draft && draft.expires > Date.now() && !['done','stopped'].includes(draft.stage)) throw new Error('Já existe uma criação em andamento. Cancele-a antes de iniciar outra.');
      const upload = (await chrome.storage.session.get(`upload:${sender.tab.id}`))[`upload:${sender.tab.id}`];
      if (upload && upload.expires > Date.now() && !['submitted','stopped'].includes(upload.stage)) throw new Error('Conclua ou cancele o envio da planilha antes de criar o memorando.');
      const data = message.data;
      const fields = ['recipient','recipientUnit','salutation','subject','bodyHtml','processNumber'];
      if (!data || fields.some(field => typeof data[field] !== 'string' || !data[field].trim() || data[field].length > 20000)) throw new Error('Dados do memorando incompletos');
      draft = { data, stage: 'type', expires: Date.now() + 15 * 60 * 1000 };
    } else {
      if (!draft || draft.expires < Date.now()) {
        await chrome.storage.session.remove(key);
        return respond({ draft: null });
      }
      if (message.type === 'VRP_MEMO_CLAIM') {
        if (draft.stage !== message.stage) return respond({ claimed: false });
        draft.stage = message.next;
      } else if (message.type === 'VRP_MEMO_STOP') draft.stage = 'stopped';
      else if (message.type === 'VRP_MEMO_FILL') {
        if (draft.stage !== 'editor') return respond({ draft });
        const results = await chrome.scripting.executeScript({ target: { tabId: sender.tab.id, frameIds: [sender.frameId] }, world: 'MAIN', func: fillSeiMemo, args: [draft.data] });
        return respond(results[0]?.result || { error: 'Editor sem resposta' });
      }
    }
    if (['done','stopped'].includes(draft.stage)) delete draft.data;
    await chrome.storage.session.set({ [key]: draft });
    respond({ draft, claimed: true });
  }).catch(error => respond({ error: error.message }));
  return true;
});
chrome.tabs.onCreated.addListener(async tab => {
  if (!tab.openerTabId) return;
  const key = `memo:${tab.openerTabId}`;
  const draft = (await chrome.storage.session.get(key))[key];
  if (draft && ['type', 'metadata', 'editor'].includes(draft.stage) && draft.expires > Date.now()) {
    await chrome.storage.session.set({ [`memo:${tab.id}`]: draft });
    await chrome.storage.session.remove(key);
  }
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove(`memo:${tabId}`));

let uploadQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message?.type?.startsWith('VRP_UPLOAD_')) return;
  if (sender.id !== chrome.runtime.id || !sender.tab?.id || !/^https:\/\/(?:www\.)?sei\.mg\.gov\.br\/sei\//.test(sender.url || '')) {
    respond({ error: 'Origem não autorizada' }); return;
  }
  uploadQueue = uploadQueue.catch(() => {}).then(async () => {
    const key = `upload:${sender.tab.id}`;
    let job = (await chrome.storage.session.get(key))[key];
    if (message.type === 'VRP_UPLOAD_START') {
      const memo = (await chrome.storage.session.get(`memo:${sender.tab.id}`))[`memo:${sender.tab.id}`];
      if (memo && memo.expires > Date.now() && !['done','stopped'].includes(memo.stage)) throw new Error('Conclua ou cancele a criação do memorando antes de anexar a planilha.');
      if (job && job.expires > Date.now() && !['submitted','stopped'].includes(job.stage)) throw new Error('Já existe um envio em andamento. Confira o cadastro antes de tentar novamente.');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(message.base64 || '') || !message.base64 || message.base64.length > 5592408 || !/\.xlsx$/i.test(message.name || '')) throw new Error('Arquivo inválido ou maior que 4 MB. Use o download e anexe manualmente.');
      if (!/^\d{4}\.\d{2}\.\d{7}\/\d{4}-\d{2}$/.test(message.processNumber || '')) throw new Error('Não foi possível confirmar o número do processo. Use o download e anexe manualmente.');
      const procedureId = new URL(sender.tab.url || sender.url).searchParams.get('id_procedimento');
      job = { procedureId: /^\d+$/.test(procedureId || '') ? procedureId : null, processNumber: message.processNumber, name: message.name.replace(/[\\/]/g,'_'), base64: message.base64,
        date: new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date()),
        stage: 'type', expires: Date.now() + 15 * 60 * 1000 };
    } else {
      if (!job || job.expires < Date.now()) {
        await chrome.storage.session.remove(key); return respond({ job: null });
      }
      if (message.type === 'VRP_UPLOAD_CLAIM') {
        if (job.stage !== message.stage) return respond({ claimed: false });
        job.stage = message.next;
      } else if (message.type === 'VRP_UPLOAD_STOP') job.stage = 'stopped';
      if (message.type === 'VRP_UPLOAD_FILE') return respond({ name: job.name, base64: job.base64 });
    }
    if (['submitted','stopped'].includes(job.stage)) delete job.base64;
    await chrome.storage.session.set({ [key]: job });
    const { base64, ...summary } = job;
    respond({ job: summary, claimed: true });
  }).catch(error => respond({ error: error.message }));
  return true;
});
chrome.tabs.onCreated.addListener(async tab => {
  if (!tab.openerTabId) return;
  const key = `upload:${tab.openerTabId}`;
  const job = (await chrome.storage.session.get(key))[key];
  if (job && ['type','form'].includes(job.stage) && job.expires > Date.now()) {
    await chrome.storage.session.set({ [`upload:${tab.id}`]: job });
    await chrome.storage.session.remove(key);
  }
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove(`upload:${tabId}`));
