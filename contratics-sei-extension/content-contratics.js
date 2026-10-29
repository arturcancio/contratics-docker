/**
 * Contratics SEI Studio - Content Script para a aba do Contratics
 * Faz a ponte segura entre o aplicativo web Contratics (window.postMessage)
 * e o Service Worker da extensão Chrome (chrome.runtime), incluindo reconexão
 * automática caso a extensão tenha sido recarregada/atualizada sem dar F5 na aba.
 */

(function () {
  const currentRuntimeId = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) || 'active';

  // Anuncia presença da extensão para o Contratics imediatamente
  function announceReady() {
    window.postMessage(
      {
        source: 'CONTRATICS_SEI_EXTENSION',
        type: 'CONTRATICS_SEI_EXT_READY',
        payload: { version: '1.3.0' }
      },
      '*'
    );
  }

  announceReady();
  setTimeout(announceReady, 1000);

  if (window.__CONTRATICS_SEI_BRIDGE_RUNTIME_ID__ === currentRuntimeId) {
    return;
  }
  window.__CONTRATICS_SEI_BRIDGE_RUNTIME_ID__ = currentRuntimeId;

  // Remove listener anterior se a extensão foi recarregada na mesma aba sem F5
  if (typeof window.__CONTRATICS_SEI_WINDOW_MSG_HANDLER__ === 'function') {
    window.removeEventListener('message', window.__CONTRATICS_SEI_WINDOW_MSG_HANDLER__);
  }

  const handleWindowMessage = (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'CONTRATICS_WEB_APP') {
      return;
    }

    // Verifica se o contexto atual da extensão ainda é válido
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return;
    }

    const { type, payload } = event.data;

    if (type === 'CONTRATICS_SEI_EXT_PING') {
      window.postMessage(
        {
          source: 'CONTRATICS_SEI_EXTENSION',
          type: 'CONTRATICS_SEI_EXT_PONG',
          payload: { version: '1.3.0' }
        },
        '*'
      );
      return;
    }

    if (type === 'CONTRATICS_SEI_START_BATCH_SCAN') {
      try {
        chrome.runtime.sendMessage(
          {
            action: 'START_BATCH_SCAN',
            processes: (payload && payload.processes) || []
          },
          (response) => {
            if (chrome.runtime.lastError) {
              window.postMessage(
                {
                  source: 'CONTRATICS_SEI_EXTENSION',
                  type: 'CONTRATICS_SEI_SCAN_PROGRESS',
                  payload: {
                    current: 0,
                    total: 1,
                    message: 'Erro ao comunicar com a extensão: ' + chrome.runtime.lastError.message
                  }
                },
                '*'
              );
            }
          }
        );
      } catch (err) {
        window.postMessage(
          {
            source: 'CONTRATICS_SEI_EXTENSION',
            type: 'CONTRATICS_SEI_SCAN_PROGRESS',
            payload: {
              current: 0,
              total: 1,
              message: 'A extensão foi atualizada. Recarregue esta página (F5) e tente novamente.'
            }
          },
          '*'
        );
      }
      return;
    }

    if (type === 'CONTRATICS_SEI_PROCESS_LIST_RESPONSE') {
      try {
        chrome.runtime.sendMessage({
          action: 'STORE_PROCESS_LIST',
          processes: (payload && payload.processes) || []
        });
      } catch (e) {}
    }
  };

  window.__CONTRATICS_SEI_WINDOW_MSG_HANDLER__ = handleWindowMessage;
  window.addEventListener('message', handleWindowMessage);

  // Escuta mensagens vindas do background.js (progresso e conclusão da varredura)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (
      msg.type === 'CONTRATICS_SEI_SCAN_PROGRESS' ||
      msg.type === 'CONTRATICS_SEI_PROCESS_SCRAPED_ITEM' ||
      msg.type === 'CONTRATICS_SEI_SCAN_COMPLETE' ||
      msg.type === 'CONTRATICS_SEI_REQUEST_PROCESS_LIST' ||
      msg.type === 'CONTRATICS_SEI_TRIGGER_ROLLBACK'
    ) {
      window.postMessage(
        {
          source: 'CONTRATICS_SEI_EXTENSION',
          type: msg.type,
          payload: msg.payload || {}
        },
        '*'
      );
      sendResponse({ ok: true });
    }
  });
})();
