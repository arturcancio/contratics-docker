const statusBox = document.getElementById('statusBox');
const btnBatchScan = document.getElementById('btnBatchScan');
const btnSyncCurrent = document.getElementById('btnSyncCurrent');
const btnRollback = document.getElementById('btnRollback');
const chkDeepScan = document.getElementById('chkDeepScan');
const monitoredListEl = document.getElementById('monitoredList');
const monitoredCountBadge = document.getElementById('monitoredCountBadge');

function setStatus(text, color) {
  if (!statusBox) return;
  statusBox.textContent = text;
  if (color) statusBox.style.color = color;
}

function loadMonitoredProcesses() {
  chrome.runtime.sendMessage({ action: 'GET_MONITORED_PROCESSES' }, (resp) => {
    const list = (resp && resp.processes) || [];
    monitoredCountBadge.textContent = `${list.length} processo(s)`;
    monitoredListEl.innerHTML = '';

    if (list.length === 0) {
      monitoredListEl.innerHTML =
        '<div style="font-size:10px; color:#64748b; font-style:italic; padding:4px;">Abra a aba do Contratics para carregar automaticamente os processos cadastrados.</div>';
      return;
    }

    list.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'monitored-item';
      const catColor = p.category === 'contrato' ? '#38bdf8' : '#34d399';
      const catLabel = p.category === 'contrato' ? 'CONTRATO' : 'PLANEJAMENTO';
      div.innerHTML = `
        <div style="min-width:0; flex:1; padding-right:6px;">
          <div style="font-family:monospace; font-weight:700; color:#f8fafc;">
            ${p.protocolo}
            <span style="font-size:8.5px; color:${catColor}; margin-left:4px;">[${catLabel}]</span>
          </div>
          <div style="font-size:9.5px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${p.unidadeAtual ? '📍 SEI: ' + p.unidadeAtual + ' • ' : ''}${p.label || ''}
          </div>
        </div>
      `;
      monitoredListEl.appendChild(div);
    });
  });
}

loadMonitoredProcesses();

btnBatchScan.addEventListener('click', async () => {
  setStatus('Solicitando lista atualizada de processos monitorados ao Contratics...', '#38bdf8');
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
    chrome.runtime.sendMessage(
      {
        action: 'START_BATCH_SCAN',
        processes: [],
        deepScanRelated: chkDeepScan ? chkDeepScan.checked : true
      },
      () => {
        loadMonitoredProcesses();
        setStatus('Varredura Geral iniciada! Acompanhe o progresso na tela do Contratics.', '#34d399');
      }
    );
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

    chrome.runtime.sendMessage(
      {
        action: 'PUSH_SINGLE_SCRAPED_PROCESS',
        data: resp.data
      },
      () => {
        setStatus(`Processo ${resp.data.protocolo} espelhado com sucesso no BPMN do Contratics!`, '#34d399');
      }
    );
  });
});

btnRollback.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'TRIGGER_ROLLBACK_FROM_POPUP' }, () => {
    setStatus('Comando de restauração enviado para a aba do Contratics.', '#fbbf24');
  });
});
