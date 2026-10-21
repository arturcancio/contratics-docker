const statusBox = document.getElementById('statusBox');
const btnBatchScan = document.getElementById('btnBatchScan');
const btnSyncCurrent = document.getElementById('btnSyncCurrent');
const btnRollback = document.getElementById('btnRollback');

function setStatus(text, color) {
  if (!statusBox) return;
  statusBox.textContent = text;
  if (color) statusBox.style.color = color;
}

btnBatchScan.addEventListener('click', async () => {
  setStatus('Solicitando lista de processos monitorados ao Contratics...', '#38bdf8');
  const tabs = await chrome.tabs.query({});
  const contraticsTab = tabs.find((t) => {
    const u = (t.url || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    return title.includes('contratics') || u.includes('localhost') || u.includes('contratics') || u.includes('run.app');
  });

  if (!contraticsTab || !contraticsTab.id) {
    setStatus('Abra a aba do sistema Contratics primeiro para iniciar a Varredura Geral.', '#f87171');
    return;
  }

  await chrome.tabs.sendMessage(contraticsTab.id, {
    type: 'CONTRATICS_SEI_REQUEST_PROCESS_LIST',
    payload: {}
  });

  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'START_BATCH_SCAN', processes: [] }, () => {
      setStatus('Varredura Geral iniciada! Acompanhe o progresso na tela do Contratics.', '#34d399');
    });
  }, 500);
});

btnSyncCurrent.addEventListener('click', async () => {
  setStatus('Lendo processo aberto na aba ativa do SEI...', '#38bdf8');
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) {
    setStatus('Nenhuma aba ativa encontrada.', '#f87171');
    return;
  }

  chrome.tabs.sendMessage(activeTab.id, { action: 'SCRAPE_CURRENT_OPEN_PROCESS' }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      setStatus(
        (resp && resp.error) || 'Abra um processo válido no SEI para usar esta opção.',
        '#f87171'
      );
      return;
    }

    chrome.runtime.sendMessage({
      action: 'PUSH_SINGLE_SCRAPED_PROCESS',
      data: resp.data
    }, () => {
      setStatus(`Processo ${resp.data.protocolo} sincronizado com sucesso no Contratics!`, '#34d399');
    });
  });
});

btnRollback.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'TRIGGER_ROLLBACK_FROM_POPUP' }, () => {
    setStatus('Comando de restauração enviado para a aba do Contratics.', '#fbbf24');
  });
});
