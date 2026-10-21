/**
 * Contratics SEI Studio - Content Script para a aba do Contratics
 * Faz a ponte segura entre o aplicativo web Contratics (window.postMessage)
 * e o Service Worker da extensão Chrome (chrome.runtime).
 */

(function () {
  // Evita múltiplas injeções
  if (window.__CONTRATICS_SEI_BRIDGE_ACTIVE__) return;
  window.__CONTRATICS_SEI_BRIDGE_ACTIVE__ = true;

  // Anuncia presença da extensão para o Contratics imediatamente
  function announceReady() {
    window.postMessage(
      {
        source: 'CONTRATICS_SEI_EXTENSION',
        type: 'CONTRATICS_SEI_EXT_READY',
        payload: { version: '1.0.0' }
      },
      '*'
    );
  }

  announceReady();
  setTimeout(announceReady, 1000);

  // Escuta mensagens vindas da interface React do Contratics
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'CONTRATICS_WEB_APP') {
      return;
    }

    const { type, payload } = event.data;

    if (type === 'CONTRATICS_SEI_EXT_PING') {
      window.postMessage(
        {
          source: 'CONTRATICS_SEI_EXTENSION',
          type: 'CONTRATICS_SEI_EXT_PONG',
          payload: { version: '1.0.0' }
        },
        '*'
      );
      return;
    }

    if (type === 'CONTRATICS_SEI_START_BATCH_SCAN') {
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
      return;
    }

    if (type === 'CONTRATICS_SEI_PROCESS_LIST_RESPONSE') {
      chrome.runtime.sendMessage({
        action: 'STORE_PROCESS_LIST',
        processes: (payload && payload.processes) || []
      });
    }
  });

  // Escuta mensagens vindas do background.js (progresso e conclusão da varredura)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (
      msg.type === 'CONTRATICS_SEI_SCAN_PROGRESS' ||
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
