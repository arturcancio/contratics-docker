/**
 * Contratics SEI Studio - Service Worker (background.js)
 * Orquestra a Varredura Geral (Batch Scan) entre a aba do Contratics e a aba autenticada do SEI.
 */

let cachedProcesses = [];

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
 * Executa a Varredura Geral (Batch Scan) de uma lista de processos no SEI
 */
async function executeBatchScan(processes) {
  const seiTab = await findOpenSeiTab();
  if (!seiTab || !seiTab.id) {
    await broadcastToContratics('CONTRATICS_SEI_SCAN_PROGRESS', {
      current: 0,
      total: processes.length || 1,
      message: 'Nenhuma aba aberta do SEI foi encontrada! Abra e faça login no SEI em outra aba do Chrome e tente novamente.'
    });
    setTimeout(() => {
      broadcastToContratics('CONTRATICS_SEI_SCAN_COMPLETE', { results: [] });
    }, 3500);
    return;
  }

  const results = [];
  const total = processes.length;

  for (let i = 0; i < total; i++) {
    const proc = processes[i];
    await broadcastToContratics('CONTRATICS_SEI_SCAN_PROGRESS', {
      current: i + 1,
      total,
      currentProtocol: proc.protocolo,
      message: `Lendo árvore, histórico e processos associados no SEI (${i + 1}/${total})...`
    });

    try {
      const response = await chrome.tabs.sendMessage(seiTab.id, {
        action: 'SCRAPE_SINGLE_PROTOCOL',
        protocolo: proc.protocolo
      });

      if (response && response.ok && response.data) {
        results.push(response.data);
      }
    } catch (err) {
      console.warn(`[Contratics SEI Studio] Falha ao ler processo ${proc.protocolo}:`, err);
    }

    // Pausa suave de 350ms entre requisições para não sobrecarregar o SEI
    await new Promise((r) => setTimeout(r, 350));
  }

  await broadcastToContratics('CONTRATICS_SEI_SCAN_COMPLETE', {
    results
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === 'STORE_PROCESS_LIST') {
    cachedProcesses = msg.processes || [];
    sendResponse({ ok: true, count: cachedProcesses.length });
    return false;
  }

  if (msg.action === 'START_BATCH_SCAN') {
    const listToScan = msg.processes && msg.processes.length > 0 ? msg.processes : cachedProcesses;
    executeBatchScan(listToScan);
    sendResponse({ ok: true, started: true });
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

  if (msg.action === 'TRIGGER_ROLLBACK_FROM_POPUP') {
    broadcastToContratics('CONTRATICS_SEI_TRIGGER_ROLLBACK', {});
    sendResponse({ ok: true });
    return false;
  }
});
