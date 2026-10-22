(() => {
  'use strict';
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const visible = e => e.getClientRects().length && !e.disabled;
  const send = (type, extra = {}) => chrome.runtime.sendMessage({ type: `VRP_MEMO_${type}`, ...extra });
  let busy = false;
  let banner;
  function notice(text, cancel = false) {
    if (!banner) {
      banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#fff;border:2px solid #b51e30;padding:14px;max-width:440px;font:14px Arial;color:#222;box-shadow:0 2px 12px #999';
      document.body.append(banner);
    }
    banner.textContent = text;
    if (cancel) {
      const button = document.createElement('button'); button.textContent = 'Cancelar automação';
      button.onclick = async () => { await send('STOP'); notice('Automação cancelada. Confira se o SEI já criou um rascunho antes de tentar novamente.'); };
      banner.append(document.createElement('br'),button);
    }
  }
  function labeled(label, selector) {
    const labels = [...document.querySelectorAll('label')].filter(l => norm(l.textContent).replace(/:$/,'') === norm(label));
    const found = labels.map(l => l.control || (l.htmlFor && document.getElementById(l.htmlFor))).filter(e => e?.matches(selector) && visible(e));
    return found.length === 1 ? found[0] : null;
  }
  function saveButton() {
    return [...document.querySelectorAll('button,input[type=submit],input[type=button],a')].filter(e => visible(e) && norm(e.value || e.textContent) === 'salvar')[0];
  }
  async function stop(text) { await send('STOP'); notice(text); }
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const reply = await send('GET');
      const draft = reply?.draft;
      if (!draft || ['done','stopped'].includes(draft.stage)) return;
      if (draft.stage === 'type') {
        const links = [...document.querySelectorAll('a')].filter(e => visible(e) && norm(e.textContent) === 'memorando');
        if (links.length === 1 && /escolha o tipo do documento/i.test(document.body.textContent)) {
          if ((await send('CLAIM',{stage:'type',next:'metadata'})).claimed) links[0].click();
        }
      } else if (draft.stage === 'metadata') {
        if (!/texto inicial/i.test(document.body.textContent) || !/memorando/i.test(document.body.textContent)) return;
        const description = labeled('Descrição','input,textarea');
        const publicRadio = labeled('Público','input[type=radio]');
        const noneRadio = labeled('Nenhum','input[type=radio]');
        const save = saveButton();
        if (!description || !publicRadio || !noneRadio || !save) return stop('Não reconheci todos os campos do cadastro. Conclua o memorando manualmente.');
        description.value = draft.data.subject;
        description.dispatchEvent(new Event('input',{bubbles:true}));
        description.dispatchEvent(new Event('change',{bubbles:true}));
        noneRadio.click(); publicRadio.click();
        if (!publicRadio.checked || !noneRadio.checked) return stop('Não foi possível confirmar o nível Público e o texto inicial.');
        if ((await send('CLAIM',{stage:'metadata',next:'editor'})).claimed) {
          notice('Criando o memorando Público. Aguardando o editor…',true);
          save.click();
        }
      } else if (draft.stage === 'editor') {
        // Each SEI frame checks its own editor; the worker targets this frame only.
        if (!document.querySelector('[id^=cke_],.cke')) return;
        const result = await send('FILL');
        if (result?.error) return stop(result.error);
        if (result?.filled) {
          const save = saveButton();
          if (!save) return stop('Texto preenchido. Clique em Salvar no editor e revise antes de assinar.');
          if ((await send('CLAIM',{stage:'editor',next:'done'})).claimed) {
            save.click();
            notice('Texto preenchido e comando Salvar acionado. Confira a confirmação do SEI e revise o memorando antes de assinar.');
          }
        }
      }
    } catch (error) { notice(`Automação interrompida: ${error.message}. Confira o rascunho no SEI.`); }
    finally { busy = false; }
  }
  setInterval(tick,1500);
  tick();
})();
