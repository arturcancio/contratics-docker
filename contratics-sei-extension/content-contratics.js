/**
 * Contratics SEI Studio - Content Script para a aba do Contratics
 * Faz a ponte segura entre o aplicativo web Contratics (window.postMessage)
 * e o Service Worker da extensão Chrome (chrome.runtime).
 * Inclui blindagem contra "Extension context invalidated" quando a extensão é
 * recarregada/atualizada sem dar F5 na aba do Contratics.
 */

(function () {
  function isExtensionContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function safeSendRuntimeMessage(message, callback) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        try {
          if (!isExtensionContextValid()) return;
          const lastErr = chrome.runtime.lastError;
          if (typeof callback === 'function') {
            callback(response, lastErr);
          }
        } catch (cbErr) {
          // Contexto antigo invalidado após reload da extensão — ignora silenciosamente
        }
      });
    } catch (err) {
      // Contexto antigo invalidado — ignora silenciosamente sem gerar erro em chrome://extensions
    }
  }

  // Anuncia presença da extensão para o Contratics imediatamente
  function announceReady() {
    if (!isExtensionContextValid()) return;
    window.postMessage(
      {
        source: 'CONTRATICS_SEI_EXTENSION',
        type: 'CONTRATICS_SEI_EXT_READY',
        payload: { version: '1.3.1' }
      },
      '*'
    );
  }

  announceReady();
  setTimeout(announceReady, 800);

  const handleWindowMessage = (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'CONTRATICS_WEB_APP') {
      return;
    }

    // Se este script pertence a uma versão antiga da extensão que foi recarregada, remove o listener imediatamente
    if (!isExtensionContextValid()) {
      window.removeEventListener('message', handleWindowMessage);
      return;
    }

    const { type, payload } = event.data;

    if (type === 'CONTRATICS_SEI_EXT_PING') {
      window.postMessage(
        {
          source: 'CONTRATICS_SEI_EXTENSION',
          type: 'CONTRATICS_SEI_EXT_PONG',
          payload: { version: '1.3.1' }
        },
        '*'
      );
      return;
    }

    if (type === 'CONTRATICS_SEI_START_BATCH_SCAN') {
      safeSendRuntimeMessage(
        {
          action: 'START_BATCH_SCAN',
          processes: (payload && payload.processes) || []
        },
        (response, lastErr) => {
          if (lastErr) {
            window.postMessage(
              {
                source: 'CONTRATICS_SEI_EXTENSION',
                type: 'CONTRATICS_SEI_SCAN_PROGRESS',
                payload: {
                  current: 0,
                  total: 1,
                  message: 'Erro ao comunicar com a extensão: ' + (lastErr.message || String(lastErr))
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
      safeSendRuntimeMessage({
        action: 'STORE_PROCESS_LIST',
        processes: (payload && payload.processes) || []
      });
    }
  };

  window.addEventListener('message', handleWindowMessage);

  // Escuta mensagens vindas do background.js (progresso e conclusão da varredura)
  if (isExtensionContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!isExtensionContextValid() || !msg || !msg.type) return;

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
          try {
            sendResponse({ ok: true });
          } catch (e) {}
        }
      });
    } catch (e) {}
  }
})();
