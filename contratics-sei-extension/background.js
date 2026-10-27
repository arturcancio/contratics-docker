/**
 * Contratics SEI Studio (Inspirado no SEI Pro) - Service Worker (background.js)
 * Gerencia:
 * 1. Sincronização da Lista de Processos Monitorados (Planejamentos e Contratos do Contratics) via chrome.storage.local;
 * 2. Orquestração da Varredura Geral (Batch Scan) na sessão autenticada do SEI;
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
 * Localiza uma aba aberta e autenticada do SEI
 */
async function findOpenSeiTab() {
  const allTabs = await chrome.tabs.query({});
  return allTabs.find((t) => {
    const url = (t.url || '').toLowerCase();
    return (
      url.includes('/sei/') ||
      url.includes('sei.economia.gov.br') ||
      url.includes('sei.fazenda.gov.br') ||
      url.includes('sei.planejamento.gov.br') ||
      url.includes('colaboragov.sei.gov.br')
    );
  });
}

/**
 * Envia mensagem para todas as abas do Contratics
 */
async function broadcastToContratics(type, payload) {
  const tabs = await findContraticsTabs();
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type, payload });
      } catch (e) {
        // Ignora abas onde o content script ainda não carregou
      }
    }
  }
}

/**
 * Executa a Varredura Geral (Batch Scan) de uma lista de processos monitorados no SEI
 */
async function executeBatchScan(processes, deepScanRelated = true) {
  const seiTab = await findOpenSeiTab();
  if (!seiTab || !seiTab.id) {
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

  // Garante que o content-sei.js esteja injetado no frame principal da aba do SEI (mesmo se a aba já estava aberta antes)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: seiTab.id, frameIds: [0] },
      files: ['content-sei.js']
    });
  } catch (e) {
    // Segue normalmente caso o script já esteja carregado
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
      const response = await chrome.tabs.sendMessage(
        seiTab.id,
        {
          action: 'SCRAPE_SINGLE_PROTOCOL',
          protocolo: proc.protocolo,
          deepScanRelated,
          knownDocIds: proc.knownDocIds || []
        },
        { frameId: 0 }
      );

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
