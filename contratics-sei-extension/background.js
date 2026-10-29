/**
 * Contratics SEI Studio (Inspirado no SEI Pro) - Service Worker (background.js)
 * Gerencia:
 * 1. Sincronização da Lista de Processos Monitorados (Planejamentos e Contratos do Contratics) via chrome.storage.local;
 * 2. Orquestração da Varredura Geral (Batch Scan) na sessão autenticada do SEI com reconexão automática de abas;
 * 3. Varredura de Processos Relacionados (Pagamentos, Descentralizações, Aditivos, OS);
 * 4. Acionamento rápido de Ponto de Restauração (Rollback) no Contratics.
 */

let cachedProcesses = [];

// Carrega processos monitorados salvos no storage ao iniciar
chrome.storage.local.get(['contratics_monitored_processes'], (res) => {
  if (res && Array.isArray(res.contratics_monitored_processes)) {
    cachedProcesses = res.contratics_monitored_processes;
  }
});

/**
 * Localiza abas abertas do Contratics
 */
async function findContraticsTabs() {
  const allTabs = await chrome.tabs.query({});
  return allTabs.filter((t) => {
    const url = (t.url || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return false;
    return (
      title.includes('contratics') ||
      url.includes('localhost') ||
      url.includes('contratics') ||
      url.includes('run.app') ||
      url.includes('vercel.app')
    );
  });
}

/**
 * Localiza e ordena por prioridade as abas abertas e autenticadas do SEI
 */
async function findOpenSeiTabs() {
  const allTabs = await chrome.tabs.query({});
  const candidates = allTabs.filter((t) => {
    const url = (t.url || '').toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
    // Ignora telas de login do SIP/SEI ou downloads diretos de anexo
    if (url.includes('/sip/login') || url.includes('acao=documento_download_anexo')) return false;
    return (
      url.includes('/sei/') ||
      url.includes('sei.economia.gov.br') ||
      url.includes('sei.fazenda.gov.br') ||
      url.includes('sei.planejamento.gov.br') ||
      url.includes('sei.mgi.gov.br') ||
      url.includes('sei.mpo.gov.br') ||
      url.includes('colaboragov.sei.gov.br') ||
      url.includes('controlador.php?acao=procedimento_')
    );
  });

  // Ordena priorizando:
  // 1) Aba não descartada (não hibernada pelo Chrome);
  // 2) Aba com controlador.php?acao= (sessão autenticada ativa no SEI);
  // 3) Aba ativa na janela.
  candidates.sort((a, b) => {
    const score = (tab) => {
      const u = (tab.url || '').toLowerCase();
      let s = 0;
      if (!tab.discarded) s += 100;
      if (u.includes('controlador.php?acao=')) s += 50;
      if (u.includes('procedimento_controlar') || u.includes('procedimento_trabalhar')) s += 25;
      if (tab.active) s += 10;
      return s;
    };
    return score(b) - score(a);
  });

  return candidates;
}

/**
 * Garante que o content-sei.js esteja injetado e ativo na aba do SEI informada.
 * Se a aba estava hibernada (discarded) pelo Chrome, recarrega-a automaticamente.
 */
async function ensureSeiTabReady(tab) {
  if (!tab || !tab.id) return false;

  // Se o Chrome hibernou a aba do SEI por inatividade, desperta a aba primeiro
  if (tab.discarded) {
    try {
      await chrome.tabs.reload(tab.id);
      await new Promise((r) => setTimeout(r, 2200));
    } catch (e) {}
  }

  // 1. Testa se o content-sei.js já responde ao PING
  try {
    const pingResp = await chrome.tabs.sendMessage(tab.id, { action: 'PING_SEI_READER' });
    if (pingResp && pingResp.ok) return true;
  } catch (e) {
    // Ainda não injetado ou extensão foi recarregada — prossegue para injeção
  }

  // 2. Injeta content-sei.js via chrome.scripting.executeScript
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-sei.js']
    });
    // Aguarda registro do listener e da função global
    await new Promise((r) => setTimeout(r, 250));
  } catch (err) {
    console.warn('[Contratics SEI Studio] Aviso ao injetar content-sei.js na aba', tab.id, err);
  }

  // 3. Verifica novamente via PING
  try {
    const pingAfter = await chrome.tabs.sendMessage(tab.id, { action: 'PING_SEI_READER' });
    if (pingAfter && pingAfter.ok) return true;
  } catch (e) {}

  return false;
}

/**
 * Executa a leitura de 1 protocolo na aba do SEI com tripla proteção contra
 * "Could not establish connection. Receiving end does not exist":
 * 1) Tenta via chrome.tabs.sendMessage;
 * 2) Se falhar por perda de conexão, reinjeta content-sei.js e tenta novamente;
 * 3) Se ainda falhar, executa diretamente a função `window.__contraticsScrapeSingleProtocolInSei` via `chrome.scripting.executeScript`.
 */
async function scrapeProtocolInTabWithFallback(tabId, proc, deepScanRelated) {
  const payload = {
    action: 'SCRAPE_SINGLE_PROTOCOL',
    protocolo: proc.protocolo,
    deepScanRelated,
    knownDocIds: proc.knownDocIds || []
  };

  // Tentativa 1: Mensagem direta ao content script
  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    if (response) return response;
  } catch (err1) {
    // Tentativa 2: Reinjeção de content-sei.js + nova tentativa de mensagem
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-sei.js']
      });
      await new Promise((r) => setTimeout(r, 300));
      const responseRetry = await chrome.tabs.sendMessage(tabId, payload);
      if (responseRetry) return responseRetry;
    } catch (err2) {
      // Tentativa 3: Execução direta de script na aba (não depende de canal de mensagens sendMessage!)
      const execResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (protocolo, deep, knownIds) => {
          try {
            if (typeof window.__contraticsScrapeSingleProtocolInSei !== 'function') {
              return {
                ok: false,
                error: 'Leitor do SEI não pôde ser inicializado nesta aba. Dê F5 na aba do SEI e tente novamente.'
              };
            }
            const data = await window.__contraticsScrapeSingleProtocolInSei(protocolo, deep, knownIds);
            return { ok: true, data };
          } catch (e) {
            return { ok: false, error: (e && e.message) || String(e) };
          }
        },
        args: [proc.protocolo, deepScanRelated !== false, proc.knownDocIds || []]
      });

      if (execResults && execResults[0] && execResults[0].result) {
        return execResults[0].result;
      }
      throw err2;
    }
  }

  return { ok: false, error: 'Sem resposta da aba do SEI.' };
}

/**
 * Envia mensagem para todas as abas do Contratics (injetando content-contratics.js se necessário)
 */
async function broadcastToContratics(type, payload) {
  const tabs = await findContraticsTabs();
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type, payload });
      } catch (e) {
        // Caso a extensão tenha sido recarregada sem F5 na aba do Contratics, reinjeta a ponte e reenvia!
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-contratics.js']
          });
          await new Promise((r) => setTimeout(r, 150));
          await chrome.tabs.sendMessage(tab.id, { type, payload });
        } catch (e2) {
          // Ignora abas restritas
        }
      }
    }
  }
}

/**
 * Executa a Varredura Geral (Batch Scan) de uma lista de processos monitorados no SEI
 */
async function executeBatchScan(processes, deepScanRelated = true) {
  const candidateTabs = await findOpenSeiTabs();
  if (!candidateTabs || candidateTabs.length === 0) {
    await broadcastToContratics('CONTRATICS_SEI_SCAN_PROGRESS', {
      current: 0,
      total: processes.length || 1,
      message: 'Nenhuma aba aberta do SEI foi encontrada! Abra e faça login no SEI em outra aba do Chrome e tente novamente.'
    });
    setTimeout(() => {
      broadcastToContratics('CONTRATICS_SEI_SCAN_COMPLETE', {
        results: [],
        totalAttempted: processes.length || 0,
        errors: [{ protocolo: 'SEI', error: 'Nenhuma aba aberta e autenticada do SEI foi localizada no navegador.' }]
      });
    }, 1500);
    return;
  }

  // Escolhe a primeira aba do SEI que aceite injeção/conexão (ou usa a melhor candidata com fallback direto)
  let seiTab = candidateTabs[0];
  for (const tab of candidateTabs) {
    const ready = await ensureSeiTabReady(tab);
    if (ready) {
      seiTab = tab;
      break;
    }
  }

  const results = [];
  const errors = [];
  const total = processes.length;

  for (let i = 0; i < total; i++) {
    const proc = processes[i];
    await broadcastToContratics('CONTRATICS_SEI_SCAN_PROGRESS', {
      current: i + 1,
      total,
      currentProtocol: proc.protocolo,
      message: `[SEI Pro Scanner] Lendo e gravando ${proc.protocolo} (${i + 1}/${total}) — ${results.length} gravado(s) até agora...`
    });

    try {
      const response = await scrapeProtocolInTabWithFallback(seiTab.id, proc, deepScanRelated);

      if (response && response.ok && response.data) {
        results.push(response.data);
        // Envia imediatamente o processo lido para o Contratics gravar em tempo real!
        await broadcastToContratics('CONTRATICS_SEI_PROCESS_SCRAPED_ITEM', {
          item: response.data,
          current: i + 1,
          total,
          successCount: results.length,
          isFirstItem: results.length === 1
        });
      } else {
        const errMsg = (response && response.error) || 'Processo não localizado na pesquisa do SEI.';
        errors.push({ protocolo: proc.protocolo, error: errMsg });
      }
    } catch (err) {
      console.warn(`[Contratics SEI Studio] Falha ao ler processo ${proc.protocolo}:`, err);
      errors.push({ protocolo: proc.protocolo, error: err.message || String(err) });
    }

    // Pausa suave de 300ms entre requisições para não sobrecarregar o SEI
    await new Promise((r) => setTimeout(r, 300));
  }

  // Salva timestamp da última varredura no storage da extensão
  chrome.storage.local.set({
    contratics_last_scan_at: new Date().toISOString(),
    contratics_last_scan_count: results.length
  });

  await broadcastToContratics('CONTRATICS_SEI_SCAN_COMPLETE', {
    results,
    totalAttempted: total,
    errors
  });
}

// Ao instalar ou atualizar/recarregar a extensão, reinjeta automaticamente os content scripts nas abas já abertas do SEI e do Contratics!
async function reinjectContentScriptsIntoOpenTabs() {
  try {
    const contraticsTabs = await findContraticsTabs();
    for (const t of contraticsTabs) {
      if (t.id && !t.discarded) {
        chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['content-contratics.js'] }).catch(() => {});
      }
    }
    const seiTabs = await findOpenSeiTabs();
    for (const t of seiTabs) {
      if (t.id && !t.discarded) {
        chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['content-sei.js'] }).catch(() => {});
      }
    }
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(() => {
  reinjectContentScriptsIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  reinjectContentScriptsIntoOpenTabs();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === 'STORE_PROCESS_LIST') {
    cachedProcesses = msg.processes || [];
    chrome.storage.local.set({ contratics_monitored_processes: cachedProcesses });
    sendResponse({ ok: true, count: cachedProcesses.length });
    return false;
  }

  if (msg.action === 'GET_MONITORED_PROCESSES') {
    if (cachedProcesses.length > 0) {
      sendResponse({ ok: true, processes: cachedProcesses });
      return false;
    }
    chrome.storage.local.get(['contratics_monitored_processes'], (res) => {
      cachedProcesses = (res && res.contratics_monitored_processes) || [];
      sendResponse({ ok: true, processes: cachedProcesses });
    });
    return true;
  }

  if (msg.action === 'START_BATCH_SCAN') {
    const listToScan = msg.processes && msg.processes.length > 0 ? msg.processes : cachedProcesses;
    executeBatchScan(listToScan, msg.deepScanRelated !== false);
    sendResponse({ ok: true, started: true, total: listToScan.length });
    return false;
  }

  if (msg.action === 'PUSH_SINGLE_SCRAPED_PROCESS') {
    if (msg.data) {
      broadcastToContratics('CONTRATICS_SEI_SCAN_COMPLETE', {
        results: [msg.data]
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'PUSH_MULTIPLE_SCRAPED_PROCESSES') {
    if (Array.isArray(msg.results) && msg.results.length > 0) {
      broadcastToContratics('CONTRATICS_SEI_SCAN_COMPLETE', {
        results: msg.results
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'TRIGGER_ROLLBACK_FROM_POPUP') {
    broadcastToContratics('CONTRATICS_SEI_TRIGGER_ROLLBACK', {});
    sendResponse({ ok: true });
    return false;
  }
});
