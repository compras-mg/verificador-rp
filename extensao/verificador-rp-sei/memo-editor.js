'use strict';

// Executed in the editor page so CKEditor can synchronize its own fields.
async function fillSeiMemo(data) {
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const editors = Object.values(window.CKEDITOR?.instances || {}).filter(e => e.status === 'ready');
  if (!editors.length) return { waiting: true };
  const snapshots = editors.map(editor => ({ editor, html: editor.getData() }));
  const text = html => new DOMParser().parseFromString(html, 'text/html').body.textContent;
  const process = data.processNumber.replace(/\D/g, '');
  if (!process || !document.body.textContent.replace(/\D/g, '').includes(process)) {
    return { error: 'Não foi possível confirmar o processo no editor. Preencha manualmente.' };
  }
  const recipient = snapshots.filter(s => s.html.includes('@nome_destinatario@') && s.html.includes('@cargo_destinatario@'));
  const body = snapshots.filter(s => s.html.includes('@vocativo_destinatario@') && /\[\s*Inserir Texto\s*\]/i.test(text(s.html)));
  const subject = snapshots.filter(s => /Assunto\s*:/i.test(text(s.html)) && /Referência\s*:/i.test(text(s.html)));
  if (recipient.length !== 1 || body.length !== 1 || subject.length !== 1 || new Set([recipient[0].editor,body[0].editor,subject[0].editor]).size !== 3) {
    return { error: 'O modelo não possui as três áreas esperadas ou já está preenchido. Nenhum texto foi substituído.' };
  }
  let subjectDoc = new DOMParser().parseFromString(subject[0].html, 'text/html');
  const nodes = [];
  const walker = subjectDoc.createTreeWalker(subjectDoc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) if (/^\s*Assunto\s*:\s*$/i.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
  if (nodes.length !== 1) return { error: 'Área do assunto diferente do modelo esperado. Nenhum texto foi substituído.' };
  nodes[0].parentNode.insertBefore(subjectDoc.createTextNode(' ' + data.subject), nodes[0].nextSibling);
  const bodyDoc = new DOMParser().parseFromString(body[0].html, 'text/html');
  const placeholders = [...bodyDoc.querySelectorAll('p')].filter(p => /^\[\s*Inserir Texto\s*\]$/i.test(p.textContent.trim()));
  if (placeholders.length !== 1) return { error: 'Área do corpo diferente do modelo esperado. Nenhum texto foi substituído.' };
  placeholders[0].innerHTML = data.bodyHtml;
  const replacements = [
    [recipient[0].editor,recipient[0].html.replaceAll('@nome_destinatario@',esc(data.recipient)).replaceAll('@cargo_destinatario@',esc(data.recipientUnit))],
    [subject[0].editor,subjectDoc.body.innerHTML],
    [body[0].editor,bodyDoc.body.innerHTML.replaceAll('@vocativo_destinatario@',esc(data.salutation))]
  ];
  await Promise.all(replacements.map(([editor,html]) => new Promise(resolve => editor.setData(html, { callback: resolve }))));
  for (const [editor] of replacements) editor.updateElement();
  return { filled: true };
}
