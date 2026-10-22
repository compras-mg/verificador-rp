(() => {
  'use strict';
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const visible = e => e.getClientRects().length && !e.disabled;
  const send = (type, extra={}) => chrome.runtime.sendMessage({type:`VRP_UPLOAD_${type}`,...extra});
  let busy=false, banner, formWaitStarted=0, typeReloadStarted=0;
  function notice(text, cancel=false) {
    if (!banner) { banner=document.createElement('div'); banner.style.cssText='position:fixed;bottom:16px;right:16px;z-index:2147483647;background:white;border:2px solid #b51e30;padding:14px;max-width:440px;font:14px Arial;color:#222';document.body.append(banner); }
    banner.textContent=text;
    if (cancel) { const button=document.createElement('button');button.textContent='Cancelar envio automático';button.onclick=async()=>{await send('STOP');notice('Automação cancelada. Confira se há arquivo anexado ou documento criado antes de repetir.');};banner.append(document.createElement('br'),button); }
  }
  function field(label,selector) {
    // IDs inspected in the user's SEI 5.0.4 external-document form.
    const ids = { 'Tipo do Documento':'selSerie', 'Data do Documento':'txtDataElaboracao',
      'Nome na Árvore':'txtNomeArvore', 'Nato-digital':'optNato', 'Público':'optPublico' };
    const known = document.getElementById(ids[label]);
    if (known?.matches(selector) && visible(known)) return known;
    const controls=[...document.querySelectorAll('label')].filter(l=>norm(l.textContent).replace(/:$/,'')===norm(label)).map(l=>l.control || document.getElementById(l.htmlFor)).filter(e=>e?.matches(selector)&&visible(e));
    const unique = [...new Set(controls)];
    return unique.length===1?unique[0]:null;
  }
  const saveButton=()=>[...document.querySelectorAll('button,input[type=submit],input[type=button],a')].find(e=>visible(e)&&norm(e.value || e.textContent)==='salvar');
  function change(e,value) { e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true})); }
  async function stop(text) {await send('STOP');notice(text);}
  function sameProcess(job) {
    if (job.procedureId) {
      const local = document.getElementById('hdnIdProcedimento');
      if (local?.value) return local.value === job.procedureId;
      const current = new URL(location.href).searchParams.get('id_procedimento');
      if (current) return current === job.procedureId;
    }
    const number = job.processNumber;
    const expected = number.replace(/\D/g,'');
    const visited = new Set();
    function scan(win) {
      if (visited.has(win)) return false;
      visited.add(win);
      try {
        if (win.document.body?.textContent.replace(/\D/g,'').includes(expected)) return true;
        return [...win.document.querySelectorAll('iframe,frame')].some(frame => scan(frame.contentWindow));
      } catch (_) { return false; }
    }
    return !!expected && scan(window.top);
  }
  async function tick() {
    if(busy)return;busy=true;
    try {
      const reply=await send('GET');const job=reply?.job;
      if(!job || ['stopped','submitted'].includes(job.stage))return;
      if(job.stage==='type') {
        if (norm(document.querySelector('h1')?.textContent)==='registrar documento externo' && sameProcess(job)) {
          await send('CLAIM',{stage:'type',next:'form'});
          return;
        }
        const links=[...document.querySelectorAll('a')].filter(e=>visible(e)&&norm(e.textContent)==='externo');
        if(links.length===1 && /escolha o tipo do documento/i.test(document.body.textContent)) {
          if((await send('CLAIM',{stage:'type',next:'form'})).claimed) links[0].click();
        }
      } else if(job.stage==='form') {
        if(norm(document.querySelector('h1')?.textContent)!=='registrar documento externo')return;
        if (!sameProcess(job)) return stop('Não consegui confirmar o processo neste cadastro. Use o download e anexe manualmente.');
        const type=field('Tipo do Documento','select'), date=field('Data do Documento','input'), name=field('Nome na Árvore','input');
        const digital=field('Nato-digital','input[type=radio]'), publicRadio=field('Público','input[type=radio]');
        const fileControl=document.getElementById('filArquivo');
        const files=fileControl?.type==='file' && !fileControl.disabled ? [fileControl] : [...document.querySelectorAll('input[type=file]')].filter(e=>!e.disabled);
        if(!type || !date || !name || !digital || !publicRadio || files.length!==1 || !saveButton()) {
          if (!formWaitStarted) formWaitStarted=Date.now();
          notice('Aguardando os campos do cadastro externo…',true);
          if (Date.now()-formWaitStarted < 30000) return;
          const missing = [!type&&'Tipo',!date&&'Data',!name&&'Nome na árvore',!digital&&'Nato-digital',!publicRadio&&'Público',files.length!==1&&`Arquivo (${files.length} controles)`,!saveButton()&&'Salvar'].filter(Boolean);
          return stop(`Cadastro não reconhecido. Campos pendentes: ${missing.join(', ')}. Envie este aviso para ajuste.`);
        }
        formWaitStarted=0;
        const options=[...type.options].filter(o=>norm(o.textContent)==='planilha');
        if(options.length!==1)return stop('Tipo Planilha não encontrado. Conclua o cadastro manualmente.');
        // SEI trocarSerie submits the form: never fill/upload in the departing document.
        if (typeReloadStarted) {
          if (Date.now()-typeReloadStarted > 30000) return stop('O SEI não concluiu a troca para Planilha. Atualize a página e tente novamente.');
          return;
        }
        if (type.value !== options[0].value) {
          typeReloadStarted=Date.now();
          notice('Selecionando Planilha. Aguardando o SEI recarregar o cadastro…',true);
          change(type,options[0].value);
          return;
        }
        if(files[0].files.length)return stop('Já existe um arquivo selecionado. Confira o cadastro antes de continuar.');
        change(date,date.type==='date'?job.date.split('/').reverse().join('-'):job.date);change(name,'Conferida');digital.click();publicRadio.click();
        if(!digital.checked || !publicRadio.checked || type.value!==options[0].value)return stop('Não foi possível confirmar Planilha, Nato-digital e Público.');
        const file=await send('FILE');if(!file?.base64)return stop('Arquivo não disponível; baixe e anexe manualmente.');
        const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
        const transfer=new DataTransfer();transfer.items.add(new File([bytes],file.name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
        if((await send('CLAIM',{stage:'form',next:'uploading'})).claimed) {
          files[0].files=transfer.files;
          files[0].dispatchEvent(new Event('change',{bubbles:true}));
          notice('Arquivo enviado ao controle do SEI. Aguardando sua inclusão na Lista de Anexos…',true);
        }
      } else if(job.stage==='uploading') {
        if(norm(document.querySelector('h1')?.textContent)!=='registrar documento externo')return;
        const rows=[...document.querySelectorAll('table tr')].filter(row=>[...row.querySelectorAll('td')].some(cell=>cell.textContent.trim()===job.name));
        if(rows.length!==1)return;
        if(/enviando|carregando|aguarde|erro|falha/i.test(rows[0].textContent))return;
        const publicRadio=field('Público','input[type=radio]'),digital=field('Nato-digital','input[type=radio]'),save=saveButton();
        if(!publicRadio?.checked || !digital?.checked || !save)return stop('Arquivo anexado, mas o cadastro precisa de conferência manual.');
        if((await send('CLAIM',{stage:'uploading',next:'submitted'})).claimed) {
          save.click();notice('Planilha Conferida: comando Salvar acionado. Confira a inclusão na árvore e copie o número SEI para o memorando.');
        }
      }
    } catch(error) {await stop(`Envio interrompido: ${error.message}. Confira o cadastro antes de repetir.`);}
    finally {busy=false;}
  }
  setInterval(tick,1500);tick();
})();
