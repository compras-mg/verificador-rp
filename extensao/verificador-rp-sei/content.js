(() => {
  'use strict';

  if (window.top !== window || document.documentElement.dataset.vrpSeiLoaded === '1') return;
  document.documentElement.dataset.vrpSeiLoaded = '1';

  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const PROCESS_RE = /\b\d{4}\.\d{2}\.\d{7}\/\d{4}-\d{2}\b/g;

  const state = {
    candidates: [],
    documents: [],
    processNumber: '',
    selectedDocument: null,
    selectedFile: null,
    workbook: null,
    verification: null,
    panelOpen: false,
    inProcess: false,
    toolbarButton: null
  };

  const host = document.createElement('div');
  host.id = 'verificador-rp-sei-host';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      button, input { font: inherit; }
      #panel {
        position: fixed; right: 18px; top: 18px; bottom: 18px; z-index: 2147483647;
        width: min(480px, calc(100vw - 28px)); display: none; flex-direction: column;
        background: #f4f7f8; color: #26343b; border: 1px solid #ccd6da; border-radius: 14px;
        box-shadow: 0 18px 55px rgba(0,0,0,.34); overflow: hidden;
        font: 14px/1.45 Arial, sans-serif;
      }
      #panel.open { display: flex; }
      .head { display: flex; align-items: center; gap: 10px; padding: 15px 16px; background: #b51f2e; color: #fff; }
      .head strong { flex: 1; font-size: 16px; }
      .head button { border: 0; background: transparent; color: #fff; font-size: 22px; cursor: pointer; }
      .body { flex: 1; overflow: auto; padding: 15px; }
      .card { margin-bottom: 12px; padding: 14px; background: #fff; border: 1px solid #d7e0e3; border-radius: 10px; }
      h2 { margin: 0 0 5px; font-size: 16px; }
      h3 { margin: 0 0 9px; font-size: 14px; }
      p { margin: 7px 0; }
      .muted { color: #64757d; font-size: 12px; }
      .status { display: none; margin-bottom: 12px; padding: 11px 12px; border-radius: 8px; }
      .status.show { display: block; }
      .status.info { color: #34505d; background: #eaf1f4; }
      .status.ok { color: #105d3a; background: #e7f6ee; }
      .status.bad { color: #7e2e1d; background: #ffebe6; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
      .button {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        min-height: 36px; padding: 8px 11px; border: 0; border-radius: 7px;
        font-weight: 700; cursor: pointer; text-decoration: none;
      }
      .primary { color: #fff; background: #b51f2e; }
      .primary:hover { background: #8f1723; }
      .secondary { color: #26343b; background: #e6edef; }
      .button:disabled { cursor: wait; opacity: .55; }
      .doc-list { display: grid; gap: 8px; margin-top: 10px; }
      .doc {
        display: grid; grid-template-columns: 1fr auto; gap: 9px; align-items: center;
        padding: 10px; border: 1px solid #d9e1e5; border-radius: 8px; background: #fbfcfc;
      }
      .doc strong { display: block; overflow-wrap: anywhere; }
      .doc small { color: #708087; }
      .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin: 10px 0; }
      .metric { padding: 9px 6px; border: 1px solid #d9e1e5; border-radius: 8px; text-align: center; }
      .metric strong { display: block; font-size: 19px; }
      .success { color: #167348; }
      .failure { color: #a33b24; }
      .table-wrap { overflow: auto; max-height: 260px; border: 1px solid #d9e1e5; border-radius: 8px; }
      table { width: 100%; border-collapse: collapse; min-width: 640px; }
      th, td { padding: 8px; border-bottom: 1px solid #e0e6e8; text-align: left; vertical-align: top; font-size: 12px; }
      th { position: sticky; top: 0; background: #eef3f5; }
      .tag { display: inline-block; padding: 3px 6px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
      .tag.ok { color: #11643e; background: #e2f4eb; }
      .tag.bad { color: #8b311d; background: #ffe6df; }
      .field { display: grid; gap: 4px; margin: 9px 0; }
      .field label { font-size: 12px; font-weight: 700; }
      .field input { width: 100%; padding: 8px 9px; border: 1px solid #bbc8cd; border-radius: 6px; color: #26343b; background: #fff; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 9px; }
      .preview { max-height: 250px; overflow: auto; padding: 12px; border: 1px solid #d8e0e4; border-radius: 8px; background: #fff; }
      .preview p { margin: 0 0 11px; }
      .hidden { display: none !important; }
      .privacy { padding: 11px 15px; border-top: 1px solid #d7e0e3; color: #5f7078; background: #fff; font-size: 11px; }
      @media (max-width: 520px) { .grid, .metrics { grid-template-columns: 1fr; } }
    </style>
    <aside id="panel" aria-label="Verificador RP">
      <div class="head"><strong>Verificador RP</strong><button id="close" type="button" aria-label="Fechar">×</button></div>
      <div class="body">
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <section id="startView" class="card">
          <h2>Planilha do processo</h2>
          <p id="processInfo" class="muted"></p>
          <p>Escolha o documento que contém a planilha de Registro de Preços.</p>
          <div id="documentList" class="doc-list"></div>
          <div class="actions">
            <button id="refresh" class="button secondary" type="button">Atualizar lista</button>
            <label class="button secondary" for="localFile">Selecionar do computador</label>
            <input id="localFile" class="hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
          </div>
        </section>
        <section id="resultView" class="card hidden"></section>
        <section id="memoView" class="card hidden"></section>
      </div>
      <div class="privacy">A planilha é processada no navegador. A extensão não lê senhas, não envia documentos para servidores e acessa somente o SEI-MG e a consulta pública CATMAS do Portal de Compras.</div>
    </aside>
  `;

  const $ = id => root.getElementById(id);
  const panel = $('panel');
  const statusBox = $('status');
  const startView = $('startView');
  const resultView = $('resultView');
  const memoView = $('memoView');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function normalizeSpace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function showStatus(message, kind = 'info') {
    statusBox.className = `status show ${kind}`;
    statusBox.textContent = message;
  }

  function clearStatus() {
    statusBox.className = 'status';
    statusBox.textContent = '';
  }

  function walkDocuments(callback, currentWindow = window, visited = new Set()) {
    if (visited.has(currentWindow)) return;
    visited.add(currentWindow);
    try {
      callback(currentWindow.document, currentWindow);
      for (const frame of currentWindow.document.querySelectorAll('iframe, frame')) {
        try {
          if (frame.contentWindow) walkDocuments(callback, frame.contentWindow, visited);
        } catch (_) {
          // Quadros de outra origem são ignorados.
        }
      }
    } catch (_) {
      // Uma página intermediária pode ser substituída enquanto o SEI navega.
    }
  }

  function decodeMarkup(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value ?? '').replace(/\\x26/gi, '&').replace(/\\u0026/gi, '&');
    return textarea.value;
  }

  function allowedSeiUrl(value) {
    try {
      const url = new URL(value, location.href);
      const allowedHost = url.hostname === 'sei.mg.gov.br' || url.hostname === 'www.sei.mg.gov.br';
      return url.protocol === 'https:' && allowedHost && url.pathname.startsWith('/sei/') ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function extractUrls(rawValue, baseUrl = location.href) {
    const raw = decodeMarkup(rawValue).replace(/\\\//g, '/');
    const matches = [];
    const absolute = /https:\/\/(?:www\.)?sei\.mg\.gov\.br\/sei\/[^'"\s<>]+/gi;
    const relative = /(?:\.\/|\/sei\/)?controlador\.php\?[^'"\s<>]+/gi;
    for (const match of raw.match(absolute) || []) matches.push(match);
    for (const match of raw.match(relative) || []) matches.push(match);
    return [...new Set(matches.map(value => {
      try { return allowedSeiUrl(new URL(value, baseUrl).href); } catch (_) { return ''; }
    }).filter(Boolean))];
  }

  function elementLabel(element) {
    const imageText = [...element.querySelectorAll?.('img') || []]
      .map(image => `${image.alt || ''} ${image.title || ''}`).join(' ');
    return normalizeSpace([
      element.textContent,
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label'),
      imageText
    ].filter(Boolean).join(' '));
  }

  function elementRawAction(element) {
    return [
      element.getAttribute?.('href'),
      element.getAttribute?.('src'),
      element.getAttribute?.('onclick'),
      element.getAttribute?.('data-href'),
      element.getAttribute?.('data-url'),
      element.href
    ].filter(Boolean).join(' ');
  }

  function scanSeiPage() {
    const processCounts = new Map();
    const candidates = new Map();
    const actions = [];
    let documentOrder = 0;

    walkDocuments((doc, frameWindow) => {
      const text = `${doc.title || ''} ${doc.body?.innerText || ''}`;
      for (const processNumber of text.match(PROCESS_RE) || []) {
        processCounts.set(processNumber, (processCounts.get(processNumber) || 0) + 1);
      }

      for (const element of doc.querySelectorAll('a, button, [onclick], iframe, embed, object')) {
        const label = elementLabel(element);
        const raw = elementRawAction(element);
        const combined = `${label} ${raw}`;
        const urls = extractUrls(raw, doc.baseURI);

        if (/incluir\s+documento|gerar\s+documento/i.test(combined) || /acao=procedimento_(?:escolher_tipo_documento|gerar_documento)/i.test(combined)) {
          actions.push({ element, frameWindow, urls });
        }

        // The SEI tree also exposes copy controls containing the document's label/link.
        // They are actions on an existing document, not additional spreadsheets.
        const controlLabel = [element.getAttribute?.('title'), element.getAttribute?.('aria-label')].filter(Boolean).join(' ');
        if (/copiar\s+(?:texto|link)\s*$/i.test(label) || /copiar\s+(?:texto|link)/i.test(controlLabel) || /(?:navigator\.clipboard|\b(?:infra)?copiar(?:Texto|Link)\s*\()/i.test(raw)) continue;

        const documentAction = /acao=(?:documento|anexo|arquivo)_(?:visualizar|consultar|download|baixar)/i.test(combined);
        const looksLikeSheet = /\.xlsx?\b|planilha|lista\s+de\s+itens|registro\s+de\s+pre[cç]os/i.test(combined);
        const treeDocument = urls.some(url => /acao=arvore_visualizar(?:&|$)/i.test(url) && /[?&]id_documento=\d+/.test(url));
        if ((!documentAction && !looksLikeSheet && !treeDocument) || !urls.length) continue;
        const order = documentOrder++;

        for (const url of urls) {
          let score = 0;
          if (/\.xlsx?\b/i.test(combined)) score += 30;
          if (/planilha|lista\s+de\s+itens/i.test(combined)) score += 15;
          if (/registro\s+de\s+pre[cç]os|\brp\b/i.test(combined)) score += 5;
          if (/download|baixar/i.test(combined)) score += 3;
          const current = candidates.get(url);
          if (!current || score > current.score) {
            candidates.set(url, {
              url,
              label: label || `Documento SEI ${candidates.size + 1}`,
              score,
              seiNumber: extractSeiNumber(label),
              order: current?.order ?? order
            });
          }
        }
      }
    });

    const sortedProcesses = [...processCounts.entries()].sort((a, b) => b[1] - a[1]);
    const processNumber = sortedProcesses.length === 1 || (sortedProcesses[0] && sortedProcesses[0][1] > (sortedProcesses[1]?.[1] || 0))
      ? sortedProcesses[0][0]
      : '';

    // Links in the tree, viewer and download action can have different session URLs.
    // Join by either stable identifier; keep distinct documents even with equal names.
    const groups = [];
    for (const candidate of candidates.values()) {
      const keys = new Set([`url:${candidate.url}`]);
      const documentId = candidate.url.match(/[?&]id_documento=(\d+)(?:&|#|$)/)?.[1];
      const publicNumber = candidate.label.match(/\((\d{7,12})\)/)?.[1]
        || candidate.label.match(/\b(?:documento\s+)?SEI[!\s]*(?:n[ºo°.]\s*)?(\d{7,12})\b/i)?.[1];
      if (documentId) keys.add(`document:${documentId}`);
      if (publicNumber) keys.add(`sei:${publicNumber}`);
      const matching = groups.filter(group => [...keys].some(key => group.keys.has(key)));
      const members = [candidate, ...matching.flatMap(group => group.members)];
      for (const group of matching) {
        for (const key of group.keys) keys.add(key);
        groups.splice(groups.indexOf(group), 1);
      }
      groups.push({ keys, members });
    }
    const documents = groups.map(({ members }) => {
      // Prefer a named tree link so memo detection and spreadsheet downloads retain context.
      const quality = candidate => (candidate.seiNumber ? 1000 : 0)
        + (/acao=arvore_visualizar(?:&|$)/i.test(candidate.url) ? 100 : 0) + candidate.score;
      const best = [...members].sort((a, b) => quality(b) - quality(a) || a.order - b.order)[0];
      return { ...best, score: Math.max(...members.map(item => item.score)), order: Math.min(...members.map(item => item.order)) };
    }).sort((a, b) => a.order - b.order);
    const allCandidates = [...documents].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt-BR'));
    const likelySheets = allCandidates.filter(candidate => candidate.score >= 5);
    return {
      processNumber,
      documents,
      candidates: (likelySheets.length ? likelySheets : allCandidates).slice(0, 40),
      inclusionAction: actions[0] || null
    };
  }

  function processContext() {
    const scan = scanSeiPage();
    const toolbar = findProcessToolbar();
    const inProcess = Boolean(scan.processNumber && toolbar);
    return { ...scan, toolbar, inProcess };
  }

  function findProcessToolbar() {
    let toolbar = null;
    walkDocuments(doc => {
      // Wait for the actual process/document actions. During iframe navigation,
      // the blue system header can be the only icon-rich bar still on the page.
      if (toolbar) return;
      for (const element of doc.querySelectorAll('#divArvoreAcoes')) {
        const rect = element.getBoundingClientRect();
        if (element.isConnected && rect.width > 0 && rect.height > 0) {
          toolbar = element;
          break;
        }
      }
    });
    return toolbar;
  }

  function installToolbarButton(toolbar) {
    if (!toolbar?.isConnected) return;
    const doc = toolbar.ownerDocument;
    let button = toolbar.querySelector('#vrp-sei-toolbar-button');
    // There must be only one launcher across the top page and all SEI frames.
    removeToolbarButton(button);
    if (button) {
      state.toolbarButton = button;
      return;
    }

    if (!doc.getElementById('vrp-sei-toolbar-style')) {
      const style = doc.createElement('style');
      style.id = 'vrp-sei-toolbar-style';
      style.textContent = `
        #vrp-sei-toolbar-button {
          display: inline-flex !important; flex-direction: column; gap: 1px;
          align-items: center; justify-content: center;
          box-sizing: border-box; width: 40px; height: 40px; margin: 3px 5px; padding: 0;
          border: 0; border-radius: 8px; vertical-align: top;
          color: #fff; background: #b51f2e; box-shadow: none;
          font: 800 14px/1 Arial, sans-serif; letter-spacing: -.02em;
          cursor: pointer;
        }
        #vrp-sei-toolbar-button .vrp-icon-catmas {
          display: block; color: inherit; font: 700 8px/10px Arial, sans-serif;
          letter-spacing: 0; white-space: nowrap; pointer-events: none;
        }
        #vrp-sei-toolbar-button .vrp-icon-rp {
          display: block; color: inherit; font: 800 18px/20px Arial, sans-serif;
          letter-spacing: -.02em; pointer-events: none;
        }
        #vrp-sei-toolbar-button:hover, #vrp-sei-toolbar-button:focus { background: #8f1723; outline: 2px solid #f1abb3; }
      `;
      doc.head?.appendChild(style);
    }

    button = doc.createElement('button');
    button.id = 'vrp-sei-toolbar-button';
    button.type = 'button';
    button.title = 'CATMAS RP — Verificador de Registro de Preços';
    button.setAttribute('aria-label', 'Abrir o Verificador CATMAS RP');
    const catmasLabel = doc.createElement('span');
    catmasLabel.className = 'vrp-icon-catmas';
    catmasLabel.textContent = 'CATMAS';
    const rpLabel = doc.createElement('span');
    rpLabel.className = 'vrp-icon-rp';
    rpLabel.textContent = 'RP';
    button.appendChild(catmasLabel);
    button.appendChild(rpLabel);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (state.panelOpen) closePanel(); else openPanel();
    });
    toolbar.appendChild(button);
    state.toolbarButton = button;
  }

  function removeToolbarButton(keep = null) {
    try {
      if (state.toolbarButton && state.toolbarButton !== keep) state.toolbarButton.remove();
    } catch (_) { /* quadro pode estar sendo substituído */ }
    walkDocuments(doc => {
      for (const button of doc.querySelectorAll('#vrp-sei-toolbar-button')) {
        if (button !== keep) button.remove();
      }
    });
    state.toolbarButton = keep;
  }

  function syncProcessButton() {
    const context = processContext();
    state.inProcess = context.inProcess;
    if (context.inProcess) {
      state.processNumber = context.processNumber;
      state.documents = context.documents;
      state.candidates = context.candidates;
      state.inclusionAction = context.inclusionAction;
      installToolbarButton(context.toolbar);
    } else {
      removeToolbarButton();
      if (state.panelOpen) closePanel();
    }
  }

  function extractSeiNumber(value) {
    const values = String(value ?? '').match(/\b\d{7,12}\b/g) || [];
    return values.at(-1) || '';
  }

  function renderScan() {
    const scan = scanSeiPage();
    state.processNumber = scan.processNumber;
    state.documents = scan.documents;
    state.candidates = scan.candidates;
    state.inclusionAction = scan.inclusionAction;

    $('processInfo').textContent = state.processNumber
      ? `Processo identificado: ${state.processNumber}`
      : 'Abra um processo para que a extensão identifique o número e seus documentos.';

    const list = $('documentList');
    list.replaceChildren();
    if (!state.candidates.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Nenhuma planilha foi identificada automaticamente. Abra o processo ou selecione o arquivo pelo computador.';
      list.appendChild(empty);
      return;
    }

    for (const candidate of state.candidates) {
      const row = document.createElement('div');
      row.className = 'doc';
      const description = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = candidate.label;
      const detail = document.createElement('small');
      detail.textContent = candidate.seiNumber ? `Documento SEI ${candidate.seiNumber}` : 'Documento do processo';
      description.append(title, detail);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button primary';
      button.textContent = 'Verificar';
      button.addEventListener('click', () => verifyCandidate(candidate, button));
      row.append(description, button);
      list.appendChild(row);
    }
  }

  function openPanel() {
    const context = processContext();
    if (!context.inProcess) return;
    state.inProcess = true;
    state.panelOpen = true;
    panel.classList.add('open');
    clearStatus();
    renderScan();
  }

  function closePanel() {
    state.panelOpen = false;
    panel.classList.remove('open');
  }

  $('close').addEventListener('click', closePanel);
  $('refresh').addEventListener('click', () => {
    clearStatus();
    renderScan();
  });
  $('localFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) verifyFile(file, { label: file.name, seiNumber: '' });
    event.target.value = '';
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'VRP_TOGGLE_PANEL') return;
    if (state.panelOpen) closePanel(); else openPanel();
  });

  syncProcessButton();
  setInterval(syncProcessButton, 2500);

  async function verifyCandidate(candidate, button) {
    button.disabled = true;
    showStatus('Baixando a planilha com a sessão atual do SEI…', 'info');
    try {
      const file = await resolveSpreadsheet(candidate.url, candidate.label);
      await verifyFile(file, candidate);
    } catch (error) {
      console.error(error);
      showStatus(`Não foi possível abrir essa planilha: ${error.message}`, 'bad');
    } finally {
      button.disabled = false;
    }
  }

  async function resolveSpreadsheet(startUrl, fallbackName) {
    const visited = new Set();

    async function visit(url, depth) {
      const safeUrl = allowedSeiUrl(url);
      if (!safeUrl || visited.has(safeUrl) || depth > 4) return null;
      visited.add(safeUrl);

      const response = await fetch(safeUrl, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(`o SEI respondeu com o código ${response.status}`);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const contentType = response.headers.get('content-type') || '';
      const disposition = response.headers.get('content-disposition') || '';

      if (isZip(bytes) || /spreadsheetml|ms-excel/i.test(contentType)) {
        const fileName = fileNameFromDisposition(disposition) || normalizeFileName(fallbackName);
        return new File([buffer], fileName, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }

      if (!/html|text|javascript/i.test(contentType) && bytes.length > 4) return null;
      const text = new TextDecoder('utf-8').decode(bytes.slice(0, 5_000_000));
      if (/login|usu[aá]rio|senha/i.test(text) && !/documento_(?:download|visualizar)/i.test(text)) {
        throw new Error('a sessão do SEI parece ter expirado; entre novamente e repita a operação');
      }

      const nextUrls = extractDocumentUrlsFromHtml(text, response.url || safeUrl);
      for (const nextUrl of nextUrls) {
        const file = await visit(nextUrl, depth + 1);
        if (file) return file;
      }
      return null;
    }

    const result = await visit(startUrl, 0);
    if (!result) throw new Error('não encontrei um arquivo Excel nesse documento');
    return result;
  }

  function isZip(bytes) {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }

  function fileNameFromDisposition(disposition) {
    const utf = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utf) {
      try { return normalizeFileName(decodeURIComponent(utf[1].replace(/^"|"$/g, ''))); } catch (_) { /* segue */ }
    }
    const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);
    return plain ? normalizeFileName(plain[1]) : '';
  }

  function normalizeFileName(value) {
    const cleaned = normalizeSpace(value).replace(/[\\/:*?"<>|]/g, '_');
    if (/\.xlsx$/i.test(cleaned)) return cleaned;
    return `${cleaned || 'planilha_sei'}.xlsx`;
  }

  function extractDocumentUrlsFromHtml(html, baseUrl) {
    const urls = new Set(extractUrls(html, baseUrl));
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      for (const element of doc.querySelectorAll('a, iframe, frame, embed, object, form, script')) {
        const raw = [
          element.getAttribute('href'), element.getAttribute('src'), element.getAttribute('data'),
          element.getAttribute('action'), element.getAttribute('onclick'), element.textContent
        ].filter(Boolean).join(' ');
        for (const url of extractUrls(raw, baseUrl)) urls.add(url);
      }
    } catch (_) {
      // A busca textual acima cobre páginas que não formam HTML válido.
    }
    return [...urls].sort((a, b) => urlScore(b) - urlScore(a));
  }

  function urlScore(url) {
    let score = 0;
    if (/download|baixar/i.test(url)) score += 20;
    if (/anexo|arquivo/i.test(url)) score += 10;
    if (/\.xlsx?(?:$|[?&#])/i.test(url)) score += 30;
    return score;
  }

  async function verifyFile(file, sourceDocument) {
    if (!/\.xlsx$/i.test(file.name)) throw new Error('selecione uma planilha no formato .xlsx');
    if (state.verifying) return;
    state.verifying = true;
    state.verification = null;
    state.selectedFile = file;
    state.selectedDocument = sourceDocument;
    resultView.classList.add('hidden');
    memoView.classList.add('hidden');
    showStatus('Lendo a planilha para consultar o Portal de Compras…', 'info');

    try {
      state.workbook = await parseWorkbook(file);
      if (state.workbook.processNumber) state.processNumber = state.workbook.processNumber;
      state.verification = await queryPortalItems(state.workbook.items);
      renderResults(state.verification, new Date().toISOString());
      clearStatus();
    } catch (error) {
      console.error(error);
      showStatus(`Não foi possível verificar a planilha: ${error.message}`, 'bad');
    } finally {
      state.verifying = false;
    }
  }

  function xml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('a planilha contém XML inválido');
    return doc;
  }

  function directChild(parent, localName) {
    if (!parent) return null;
    return [...parent.childNodes].find(node => node.nodeType === 1 && node.localName === localName) || null;
  }

  function cellValue(cell, sharedStrings) {
    if (!cell) return '';
    if (cell.getAttribute('t') === 'inlineStr') return directChild(directChild(cell, 'is') || cell, 't')?.textContent ?? '';
    const raw = directChild(cell, 'v')?.textContent ?? '';
    return cell.getAttribute('t') === 's' ? (sharedStrings[Number(raw)] ?? '') : raw;
  }

  async function parseWorkbook(file) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    if (!zip.file('xl/workbook.xml')) throw new Error('o arquivo não é uma planilha Excel válida');
    const workbookDoc = xml(await zip.file('xl/workbook.xml').async('text'));
    const rels = xml(await zip.file('xl/_rels/workbook.xml.rels').async('text'));
    const formSheet = [...workbookDoc.getElementsByTagNameNS(NS, 'sheet')]
      .find(sheet => sheet.getAttribute('name').trim().toUpperCase() === 'FORMULÁRIO');
    if (!formSheet) throw new Error('não foi encontrada a aba “FORMULÁRIO”');
    const relId = formSheet.getAttributeNS(REL_NS, 'id');
    const relationship = [...rels.getElementsByTagNameNS(PKG_REL_NS, 'Relationship')]
      .find(item => item.getAttribute('Id') === relId);
    if (!relationship) throw new Error('não foi possível localizar a aba FORMULÁRIO dentro do arquivo');
    const target = relationship.getAttribute('Target').replace(/^\//, '');
    const sheetPath = target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`;
    if (!zip.file(sheetPath)) throw new Error('o conteúdo da aba FORMULÁRIO não foi encontrado');
    const sheetSource = await zip.file(sheetPath).async('text');
    const sheetDoc = xml(sheetSource);

    let sharedDoc = null;
    let sharedStrings = [];
    if (zip.file('xl/sharedStrings.xml')) {
      sharedDoc = xml(await zip.file('xl/sharedStrings.xml').async('text'));
      sharedStrings = [...sharedDoc.getElementsByTagNameNS(NS, 'si')]
        .map(item => [...item.getElementsByTagNameNS(NS, 't')].map(text => text.textContent).join(''));
    }

    const rows = [...sheetDoc.getElementsByTagNameNS(NS, 'row')];
    const cells = new Map();
    for (const row of rows) {
      for (const cell of row.getElementsByTagNameNS(NS, 'c')) {
        cells.set(cell.getAttribute('r'), cellValue(cell, sharedStrings).trim());
      }
    }

    const items = [];
    for (const row of rows) {
      const rowNumber = Number(row.getAttribute('r'));
      if (rowNumber < 11) continue;
      const raw = cells.get(`A${rowNumber}`) || '';
      if (!/^\d{1,12}$/.test(raw) || Number(raw) === 0) continue;
      const candidates = [...new Set([raw, raw.length < 9 ? raw.padStart(9, '0') : raw])];
      items.push({ row: rowNumber, originalCode: raw, candidates });
    }
    if (!items.length) throw new Error('nenhum código CATMAS foi encontrado na coluna A, a partir da linha 11');

    return {
      zip, sheetDoc, sheetSource, sheetPath, sharedDoc, sharedStrings, items,
      processNumber: cells.get('C5') || '',
      objectName: cells.get('I5') || ''
    };
  }

  async function queryPortalItems(items) {
    const unique = [...new Set(items.map(item => item.originalCode.padStart(9, '0')))];
    const byCode = new Map();
    for (const [index, code] of unique.entries()) {
      showStatus(`Consultando o Portal de Compras: ${index + 1} de ${unique.length} códigos…`, 'info');
      try {
        const reply = await chrome.runtime.sendMessage({ type: 'VRP_QUERY_CATMAS', code });
        if (!reply?.result || reply.error) throw new Error(reply?.error || 'Consulta sem resposta');
        byCode.set(code, reply.result);
      } catch (error) {
        byCode.set(code, { result: 'unverified', description: '', situation: '',
          reason: `Não verificado: ${error.message}` });
      }
    }
    return items.map(item => ({ ...item, ...byCode.get(item.originalCode.padStart(9, '0')) }));
  }

  function renderResults(results, updated) {
    const ok = results.filter(result => result.result === 'ok').length;
    const problem = results.length - ok;
    const allOk = problem === 0;
    const rows = results.map(result => `
      <tr>
        <td>${escapeHtml(result.originalCode)}</td>
        <td>${escapeHtml(result.description || '—')}</td>
        <td>${escapeHtml(result.situation || '—')}</td>
        <td title="${escapeHtml(result.checkedAt ? `Consulta: ${new Date(result.checkedAt).toLocaleString('pt-BR')} · ID: ${result.portalId ?? '—'} · Versão: ${result.portalVersion ?? '—'}` : 'Consulta não confirmada')}"><span class="tag ${result.result === 'ok' ? 'ok' : 'bad'}">${escapeHtml(result.reason)}</span></td>
      </tr>`).join('');

    resultView.innerHTML = `
      <h2>${allOk ? 'Verificação concluída' : 'Verificação com pendências'}</h2>
      <p class="${allOk ? 'success' : 'failure'}">
        <strong>${allOk ? 'Todos os itens estão habilitados para Registro de Preços.' : `${problem} ${problem === 1 ? 'item apresenta pendência' : 'itens apresentam pendências'} de habilitação ou consulta.`}</strong>
      </p>
      <div class="metrics">
        <div class="metric"><strong>${results.length}</strong><span>analisados</span></div>
        <div class="metric"><strong class="success">${ok}</strong><span>OK para RP</span></div>
        <div class="metric"><strong class="${problem ? 'failure' : 'success'}">${problem}</strong><span>pendências</span></div>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Código</th><th>Especificação</th><th>Situação</th><th>Resultado</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <p class="muted">Arquivo: ${escapeHtml(state.selectedFile.name)}${updated ? ` · Consulta ao Portal de Compras concluída em ${escapeHtml(new Date(updated).toLocaleString('pt-BR'))}` : ''}</p>
      <div class="actions">
        ${allOk ? '<button id="downloadVerified" class="button secondary" type="button">Baixar planilha conferida</button><button id="uploadVerified" class="button secondary" type="button">Anexar planilha conferida ao SEI</button><button id="generateMemo" class="button primary" type="button">Gerar memorando padrão</button>' : ''}
        <button id="verifyAnother" class="button secondary" type="button">Verificar outra</button>
      </div>`;

    resultView.classList.remove('hidden');
    resultView.querySelector('#verifyAnother').addEventListener('click', () => {
      resultView.classList.add('hidden');
      memoView.classList.add('hidden');
      startView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (allOk) {
      resultView.querySelector('#downloadVerified').addEventListener('click', downloadVerifiedWorkbook);
      resultView.querySelector('#uploadVerified').addEventListener('click', uploadVerifiedWorkbook);
      resultView.querySelector('#generateMemo').addEventListener('click', renderMemoForm);
    }
    resultView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function createVerifiedWorkbookBlob() {
    if (!state.verification?.length || state.verification.some(item => item.result !== 'ok')) throw new Error('A conferência não aprovou todos os itens');
    const sheetXml = RPWorkbookPreserve.patchWorksheet(state.workbook.sheetSource, state.verification.map(result => result.row), 'N', 'OK');
    state.workbook.zip.file(state.workbook.sheetPath, sheetXml);
    return await state.workbook.zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  async function uploadVerifiedWorkbook() {
    const button = resultView.querySelector('#uploadVerified');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const scan = scanSeiPage();
      const action = scan.inclusionAction || state.inclusionAction;
      if (!action) throw new Error('Não localizei Incluir Documento no processo');
      const blob = await createVerifiedWorkbookBlob();
      if (blob.size > 4 * 1024 * 1024) throw new Error('Planilha maior que 4 MB. Baixe e anexe manualmente');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Não foi possível preparar o arquivo'));
        reader.readAsDataURL(blob);
      });
      const reply = await chrome.runtime.sendMessage({ type: 'VRP_UPLOAD_START', base64,
        name: state.selectedFile.name.replace(/\.xlsx$/i, '_CONFERIDA.xlsx'),
        processNumber: state.workbook.processNumber || state.processNumber });
      if (reply?.error || !reply?.job) throw new Error(reply?.error || 'Envio não iniciado');
      if (action.element?.isConnected && typeof action.element.click === 'function') action.element.click();
      else if (action.urls?.[0]) window.open(action.urls[0], '_blank', 'noopener');
      else throw new Error('Não foi possível abrir o cadastro externo');
      showStatus('Preparando Planilha Conferida no SEI, com acesso Público. Confira o resultado do salvamento na árvore.', 'info');
    } catch (error) {
      showStatus(`Não foi possível anexar: ${error.message}`, 'bad');
    } finally { button.disabled = false; }
  }

  async function downloadVerifiedWorkbook() {
    if (!state.verification?.length || state.verification.some(item => item.result !== 'ok')) return;
    try {
      const blob = await createVerifiedWorkbookBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = state.selectedFile.name.replace(/\.xlsx$/i, '_CONFERIDA.xlsx');
      document.documentElement.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showStatus('Planilha conferida gerada com sucesso.', 'ok');
    } catch (error) {
      console.error(error);
      showStatus(`Não foi possível gerar a planilha: ${error.message}`, 'bad');
    }
  }

  function renderMemoForm() {
    if (!state.verification?.length || state.verification.some(item => item.result !== 'ok')) return;
    // Refresh the tree after the verified spreadsheet has been attached.
    state.documents = scanSeiPage().documents;
    const count = state.verification.length;
    const selectedLabel = state.selectedDocument?.label || '';
    const sourceMemoPattern = /\bmemorando(?:\s+n[ºo]\.?)?\s+(\d+)/i;
    const selectedOrder = Number.isFinite(state.selectedDocument?.order) ? state.selectedDocument.order : Infinity;
    const memoCandidates = state.documents
      .filter(document => document.url !== state.selectedDocument?.url && sourceMemoPattern.test(document.label));
    const sourceMemo = memoCandidates
      .filter(document => Number.isFinite(document.order) && document.order < selectedOrder)
      .sort((a, b) => b.order - a.order)[0]
      || memoCandidates.sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0]
      || null;
    const sourceMemoNumber = sourceMemo?.label.match(sourceMemoPattern)?.[1] || '';
    const requestNumber = state.selectedDocument?.seiNumber || extractSeiNumber(selectedLabel);
    const planilhaNumber = state.documents
      .filter(doc => /\bplanilha\s+conferida\b/i.test(doc.label))
      .sort((a,b) => (b.order ?? 0)-(a.order ?? 0))[0]?.seiNumber || '';
    memoView.innerHTML = `
      <h2>Memorando padrão</h2>
      <p class="muted">Confira todos os campos antes de criar o rascunho Público. A assinatura é manual.</p>
      <form id="memoForm">
        <div class="grid">
          ${memoField('recipient', 'Destinatária', 'Paula Alves de Lima')}
          ${memoField('salutation', 'Tratamento', 'Senhora Diretora')}
        </div>
        ${memoField('recipientUnit', 'Unidade destinatária', 'Diretoria Central de Planejamento, Padronização e Estratégias de Contratação')}
        <div class="grid">
          ${memoField('originMemo', 'Memorando respondido', sourceMemoNumber)}
          ${memoField('originMemoSei', 'SEI do memorando', sourceMemo?.seiNumber || '')}
          ${memoField('requestSei', 'SEI do documento encaminhado', requestNumber)}
          ${memoField('sheetSei', 'SEI da planilha conferida (após anexar)', planilhaNumber)}
        </div>
        ${memoField('objectName', 'Objeto no SIRP', state.workbook.objectName)}
        ${memoField('processNumber', 'Processo SEI', state.workbook.processNumber || state.processNumber)}
        <p class="muted">Quantidade de itens: ${String(count).padStart(2, '0')}</p>
        <h3>Prévia</h3>
        <div id="memoPreview" class="preview"></div>
        <div class="actions">
          <button id="copyMemo" class="button secondary" type="button">Copiar memorando</button>
          <button id="copyAndOpen" class="button primary" type="button">Criar memorando Público no SEI</button>
        </div>
      </form>`;

    memoView.classList.remove('hidden');
    const form = memoView.querySelector('#memoForm');
    const update = () => updateMemoPreview(form);
    form.addEventListener('input', update);
    update();
    memoView.querySelector('#copyMemo').addEventListener('click', () => copyMemo(form));
    memoView.querySelector('#copyAndOpen').addEventListener('click', async () => {
      const data = memoData(form);
      const required = ['recipient','recipientUnit','salutation','originMemo','originMemoSei','requestSei','sheetSei','objectName','processNumber'];
      if (required.some(key => !normalizeSpace(data[key]))) {
        showStatus('Preencha todos os campos, inclusive o número SEI da planilha conferida já anexada ao processo.', 'bad');
        return;
      }
      const scan = scanSeiPage();
      if (!(scan.inclusionAction || state.inclusionAction)) {
        showStatus('Não localizei “Incluir Documento”. Abra o processo e tente novamente.', 'bad');
        return;
      }
      const memo = buildMemo(form);
      const parsed = new DOMParser().parseFromString(memo.html, 'text/html');
      const paragraphs = [...parsed.querySelectorAll('p')];
      const bodyHtml = paragraphs[4].innerHTML;
      try {
        const reply = await chrome.runtime.sendMessage({ type: 'VRP_MEMO_START', data: { ...data, bodyHtml } });
        if (reply?.error || !reply?.draft) throw new Error(reply?.error || 'Não foi possível iniciar');
        openDocumentCreation();
      } catch (error) { showStatus(error.message, 'bad'); }
    });
    memoView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function memoField(name, label, value) {
    return `<div class="field"><label for="memo-${escapeHtml(name)}">${escapeHtml(label)}</label><input id="memo-${escapeHtml(name)}" name="${escapeHtml(name)}" value="${escapeHtml(value || '')}"></div>`;
  }

  function memoData(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    return {
      ...values,
      count: String(state.verification.length).padStart(2, '0'),
      subject: 'Análise de Solicitação para Gestão de Registro de Preços'
    };
  }

  function placeholder(value, label) {
    return normalizeSpace(value) || `[INFORMAR ${label.toUpperCase()}]`;
  }

  function buildMemo(form) {
    const data = memoData(form);
    const recipient = placeholder(data.recipient, 'destinatária');
    const unit = placeholder(data.recipientUnit, 'unidade destinatária');
    const salutation = placeholder(data.salutation, 'tratamento');
    const originMemo = placeholder(data.originMemo, 'memorando respondido');
    const originMemoSei = placeholder(data.originMemoSei, 'SEI do memorando');
    const requestSei = placeholder(data.requestSei, 'SEI do documento encaminhado');
    const sheetSei = placeholder(data.sheetSei, 'SEI da planilha');
    const objectName = placeholder(data.objectName, 'objeto no SIRP');
    const processNumber = placeholder(data.processNumber, 'processo SEI');

    const paragraphs = [
      `<p><strong>Para:</strong> ${escapeHtml(recipient)}<br>${escapeHtml(unit)}</p>`,
      `<p><strong>Assunto:</strong> ${escapeHtml(data.subject)}</p>`,
      `<p><strong>Referência:</strong> [Caso responda este documento, indicar expressamente o Processo nº ${escapeHtml(processNumber)}].</p>`,
      `<p style="text-align:center">${escapeHtml(salutation)},</p>`,
      `<p style="text-align:justify">Cumprimentando-a cordialmente, em resposta ao Memorando ${escapeHtml(originMemo)} (Documento SEI! ${escapeHtml(originMemoSei)}), informamos que os ${escapeHtml(data.count)} itens de material solicitados para Gestão do RP de objeto <strong>${escapeHtml(objectName)}</strong>, aprovados e encaminhados para análise desta diretoria (Documento SEI! ${escapeHtml(requestSei)}), estão habilitados para RP, conforme planilha anexada (Documento SEI! ${escapeHtml(sheetSei)}).</p>`,
      '<p>Atenciosamente,</p>'
    ];

    const plain = [
      `Para: ${recipient}`,
      unit,
      '',
      `Assunto: ${data.subject}`,
      `Referência: [Caso responda este documento, indicar expressamente o Processo nº ${processNumber}].`,
      '',
      `${salutation},`,
      '',
      `Cumprimentando-a cordialmente, em resposta ao Memorando ${originMemo} (Documento SEI! ${originMemoSei}), informamos que os ${data.count} itens de material solicitados para Gestão do RP de objeto ${objectName}, aprovados e encaminhados para análise desta diretoria (Documento SEI! ${requestSei}), estão habilitados para RP, conforme planilha anexada (Documento SEI! ${sheetSei}).`,
      '',
      'Atenciosamente,'
    ].join('\n');

    return { html: paragraphs.join(''), plain };
  }

  function updateMemoPreview(form) {
    memoView.querySelector('#memoPreview').innerHTML = buildMemo(form).html;
  }

  async function copyMemo(form) {
    const memo = buildMemo(form);
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([memo.html], { type: 'text/html' }),
          'text/plain': new Blob([memo.plain], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(memo.plain);
      }
      showStatus('Memorando copiado. Revise o conteúdo no editor do SEI antes de salvar ou assinar.', 'ok');
      return true;
    } catch (error) {
      console.error(error);
      showStatus('O navegador não permitiu copiar automaticamente. Selecione o texto da prévia e copie manualmente.', 'bad');
      return false;
    }
  }

  function openDocumentCreation() {
    const scan = scanSeiPage();
    const action = scan.inclusionAction || state.inclusionAction;
    if (!action) {
      showStatus('Memorando copiado. Não localizei o botão “Incluir Documento”; abra-o manualmente no processo e escolha Memorando.', 'info');
      return;
    }
    try {
      if (action.element?.isConnected && typeof action.element.click === 'function') {
        action.element.click();
        showStatus('Criação iniciada. A extensão tentará selecionar Memorando e preencher o rascunho Público.', 'ok');
        return;
      }
      if (action.urls?.[0]) {
        window.open(action.urls[0], '_blank', 'noopener');
        showStatus('Criação aberta em outra aba. Aguarde o preenchimento do rascunho Público.', 'ok');
        return;
      }
    } catch (error) {
      console.error(error);
    }
    showStatus('Não foi possível abrir a criação. Abra “Incluir Documento” no mesmo processo para continuar.', 'info');
  }
})();
