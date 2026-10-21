/**
 * Contratics SEI Studio - Motor de Leitura SEI (Inspirado no Estúdio de Fluxo do SEI Pro)
 * Opera dentro da sessão autenticada do usuário no SEI, extraindo:
 * 1. Árvore de Documentos (Nos[] / infraArvoreNo) e Assinaturas;
 * 2. Unidades onde o processo está aberto atualmente (Posição Atual para destaque BPMN);
 * 3. Processos Relacionados / Associados (Pagamentos, Aditivos, Descentralizações, OS);
 * 4. Histórico completo de tramitação (#tblHistorico em procedimento_consultar_historico).
 */

(function () {
  if (window.__CONTRATICS_SEI_READER_LOADED__) return;
  window.__CONTRATICS_SEI_READER_LOADED__ = true;

  /**
   * Decodifica HTML entities básicas e limpa espaços
   */
  function cleanText(raw) {
    if (!raw) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = String(raw).replace(/<[^>]*>/g, ' ');
    return txt.value.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extrai os nós da árvore do SEI a partir do script nativo `new infraArvoreNo(...)` (padrão SEI / SEI Pro)
   */
  function parseSeiArvoreScript(htmlText) {
    const result = {
      protocolo: '',
      especificacao: '',
      unidadesAbertas: [],
      unidadeAtual: '',
      processosRelacionados: [],
      documentos: [],
      historicoUrl: ''
    };

    // 1. Link de Consultar Andamento (procedimento_consultar_historico)
    const histMatch = htmlText.match(/controlador\.php\?acao=procedimento_consultar_historico[^"'\s\\]+/i);
    if (histMatch) {
      result.historicoUrl = histMatch[0].replace(/&amp;/g, '&');
    }

    // 2. Unidades onde o processo está aberto (divInformacao ou texto de andamento aberto)
    const openUnitsBlock = htmlText.match(/Processo aberto (?:somente )?na(?:s)? unidade(?:s)?:([\s\S]*?)<\/div>/i);
    if (openUnitsBlock && openUnitsBlock[1]) {
      const unitLinks = [...openUnitsBlock[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)];
      unitLinks.forEach((m) => {
        const u = cleanText(m[1]);
        if (u && !result.unidadesAbertas.includes(u)) {
          result.unidadesAbertas.push(u);
        }
      });
      if (result.unidadesAbertas.length === 0) {
        const plainUnits = cleanText(openUnitsBlock[1])
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        plainUnits.forEach((u) => {
          if (!result.unidadesAbertas.includes(u)) result.unidadesAbertas.push(u);
        });
      }
    }

    // 3. Parsear declarações `new infraArvoreNo(tipo, id, pai, href, target, label, title, ...)`
    const nodeRegex = /new\s+infraArvoreNo\s*\(([\s\S]*?)\)\s*;/g;
    let match;
    while ((match = nodeRegex.exec(htmlText)) !== null) {
      const argsRaw = match[1];
      // Extrai argumentos entre aspas
      const strArgs = [];
      const argPattern = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|null|true|false|\d+/g;
      let am;
      while ((am = argPattern.exec(argsRaw)) !== null) {
        const val = am[1] !== undefined ? am[1] : am[2] !== undefined ? am[2] : am[0];
        strArgs.push(val);
      }

      const nodeType = (strArgs[0] || '').toUpperCase();
      const nodeHref = (strArgs[3] || '').replace(/&amp;/g, '&');
      const nodeLabel = cleanText(strArgs[5] || '');
      const nodeTitle = cleanText(strArgs[6] || '');

      if (nodeType === 'PROCEDIMENTO' && !result.protocolo && nodeLabel) {
        result.protocolo = nodeLabel;
        result.especificacao = nodeTitle;
      } else if (
        nodeType.includes('RELACIONADO') ||
        (nodeHref.includes('acao=procedimento_trabalhar') && nodeType !== 'PROCEDIMENTO')
      ) {
        const protoMatch = (nodeLabel + ' ' + nodeTitle).match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);
        if (protoMatch) {
          const proto = protoMatch[0];
          if (!result.processosRelacionados.some((p) => p.protocolo === proto)) {
            result.processosRelacionados.push({
              protocolo: proto,
              tipo: nodeTitle || nodeLabel.replace(proto, '').replace(/[()]/g, '').trim() || 'Processo Associado',
              link: nodeHref ? new URL(nodeHref, window.location.origin + '/sei/').href : undefined
            });
          }
        }
      } else if (nodeType === 'DOCUMENTO' || nodeHref.includes('acao=documento_visualizar')) {
        // Exemplo de label: "Termo de Referência 12345678" ou "Nota Técnica 45 (12345678)"
        const seiNumMatch = nodeLabel.match(/(\d{7,10})\s*\)?$/) || nodeLabel.match(/\((\d{7,10})\)/);
        const numeroSei = seiNumMatch ? seiNumMatch[1] : nodeLabel;
        const tipoNome = seiNumMatch
          ? nodeLabel.replace(seiNumMatch[0], '').replace(/[()]/g, '').trim()
          : nodeLabel;

        // Tenta identificar unidade geradora no title ou label
        const unitMatch = nodeTitle.match(/\b([A-Z]{2,10}(?:[-/][A-Z]{2,10})*)\b/);
        const dateMatch = nodeTitle.match(/(\d{2}\/\d{2}\/\d{4})/);

        result.documentos.push({
          idSei: numeroSei,
          numeroSei,
          tipo: tipoNome || 'Documento SEI',
          data: dateMatch ? dateMatch[1] : '',
          unidade: unitMatch ? unitMatch[1] : '',
          assinado: !nodeTitle.toLowerCase().includes('minuta') && !nodeTitle.toLowerCase().includes('sem assinatura'),
          assinantes: []
        });
      }
    }

    // 4. Processos relacionados adicionais presentes no HTML da árvore
    const relRegex = /(\d{5}\.\d{6}\/\d{4}-\d{2})/g;
    let rm;
    while ((rm = relRegex.exec(htmlText)) !== null) {
      const foundProto = rm[1];
      if (
        result.protocolo &&
        foundProto !== result.protocolo &&
        !result.processosRelacionados.some((p) => p.protocolo === foundProto)
      ) {
        result.processosRelacionados.push({
          protocolo: foundProto,
          tipo: 'Processo Relacionado no SEI'
        });
      }
    }

    if (result.unidadesAbertas.length > 0) {
      result.unidadeAtual = result.unidadesAbertas[0];
    }

    return result;
  }

  /**
   * Faz o parse da tabela de histórico completo do SEI (#tblHistorico)
   */
  function parseSeiHistoricoHtml(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const andamentos = [];
    const unidadesAbertasDetectadas = [];

    // Verifica banner de unidades abertas no topo da visualização
    const infoDiv = doc.querySelector('#divInformacao, .infraInformacao');
    if (infoDiv) {
      const links = infoDiv.querySelectorAll('a');
      links.forEach((a) => {
        const u = cleanText(a.textContent);
        if (u && !unidadesAbertasDetectadas.includes(u)) {
          unidadesAbertasDetectadas.push(u);
        }
      });
    }

    const rows = doc.querySelectorAll('#tblHistorico tr, table.infraTable tr');
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 4) {
        const dataHora = cleanText(cells[0].textContent);
        const unidade = cleanText(cells[1].textContent);
        const usuario = cleanText(cells[2].textContent);
        const descricao = cleanText(cells[3].textContent);
        if (dataHora && /\d{2}\/\d{2}\/\d{4}/.test(dataHora)) {
          andamentos.push({
            dataHora,
            unidade,
            usuario,
            descricao
          });
        }
      }
    });

    return { andamentos, unidadesAbertasDetectadas };
  }

  /**
   * Lê um processo específico no SEI usando fetch autenticado na mesma origem do SEI
   */
  async function scrapeSingleProtocolInSei(protocolo) {
    const baseSeiUrl = window.location.origin + '/sei/';
    const cleanDigits = String(protocolo).replace(/\D/g, '');

    let mainWorkHtml = '';
    let finalUrl = '';

    // Caso o processo já esteja aberto na janela atual, aproveita o DOM/URL atual
    if (document.title.includes(protocolo) || document.body.innerHTML.includes(protocolo)) {
      const ifrArvore = document.getElementById('ifrArvore');
      if (ifrArvore && ifrArvore.src) {
        const resp = await fetch(ifrArvore.src, { credentials: 'include' });
        const buf = await resp.arrayBuffer();
        mainWorkHtml = new TextDecoder('iso-8859-1').decode(buf);
      }
    }

    // Se não for o processo aberto na aba principal, pesquisa via controlador.php do SEI
    if (!mainWorkHtml) {
      // Tenta busca rápida do protocolo no SEI
      const searchForm = new URLSearchParams();
      searchForm.append('txtPesquisaRapida', protocolo);

      const searchResp = await fetch(baseSeiUrl + 'controlador.php?acao=protocolo_pesquisar&acao_origem=procedimento_controlar', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: searchForm.toString()
      });

      finalUrl = searchResp.url;
      const buf = await searchResp.arrayBuffer();
      const pageHtml = new TextDecoder('iso-8859-1').decode(buf);

      // Procura o src do iframe ifrArvore (controlador.php?acao=procedimento_visualizar...)
      const arvoreSrcMatch =
        pageHtml.match(/ifrArvore[^>]+src=["']([^"']+)["']/i) ||
        pageHtml.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s]+/i);

      if (arvoreSrcMatch) {
        const rawSrc = (arvoreSrcMatch[1] || arvoreSrcMatch[0]).replace(/&amp;/g, '&');
        const fullArvoreUrl = new URL(rawSrc, baseSeiUrl).href;
        const arvResp = await fetch(fullArvoreUrl, { credentials: 'include' });
        const arvBuf = await arvResp.arrayBuffer();
        mainWorkHtml = new TextDecoder('iso-8859-1').decode(arvBuf);
      } else {
        // Caso tenha caído numa lista de resultados de pesquisa, pega o primeiro link do protocolo
        const procLinkMatch = pageHtml.match(/controlador\.php\?acao=procedimento_trabalhar[^"'\s]+/i);
        if (procLinkMatch) {
          const workUrl = new URL(procLinkMatch[0].replace(/&amp;/g, '&'), baseSeiUrl).href;
          const workResp = await fetch(workUrl, { credentials: 'include' });
          const workBuf = await workResp.arrayBuffer();
          const workHtml = new TextDecoder('iso-8859-1').decode(workBuf);
          const subArvMatch =
            workHtml.match(/ifrArvore[^>]+src=["']([^"']+)["']/i) ||
            workHtml.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s]+/i);
          if (subArvMatch) {
            const fullArvoreUrl = new URL((subArvMatch[1] || subArvMatch[0]).replace(/&amp;/g, '&'), baseSeiUrl).href;
            const arvResp = await fetch(fullArvoreUrl, { credentials: 'include' });
            const arvBuf = await arvResp.arrayBuffer();
            mainWorkHtml = new TextDecoder('iso-8859-1').decode(arvBuf);
          }
        }
      }
    }

    if (!mainWorkHtml) {
      throw new Error(`Não foi possível localizar a árvore do processo ${protocolo} no SEI.`);
    }

    const parsedTree = parseSeiArvoreScript(mainWorkHtml);
    let andamentos = [];

    if (parsedTree.historicoUrl) {
      try {
        const histFullUrl = new URL(parsedTree.historicoUrl, baseSeiUrl).href;
        const histResp = await fetch(histFullUrl, { credentials: 'include' });
        const histBuf = await histResp.arrayBuffer();
        const histHtml = new TextDecoder('iso-8859-1').decode(histBuf);
        const parsedHist = parseSeiHistoricoHtml(histHtml);
        andamentos = parsedHist.andamentos;
        parsedHist.unidadesAbertasDetectadas.forEach((u) => {
          if (!parsedTree.unidadesAbertas.includes(u)) {
            parsedTree.unidadesAbertas.push(u);
          }
        });
      } catch (e) {
        console.warn('[Contratics SEI Studio] Aviso ao ler histórico:', e);
      }
    }

    // Se unidadeAtual ainda estiver vazia, deduz a partir do andamento mais recente
    let unidadeAtual = parsedTree.unidadesAbertas[0] || '';
    if (!unidadeAtual && andamentos.length > 0) {
      unidadeAtual = andamentos[0].unidade;
      parsedTree.unidadesAbertas = [unidadeAtual];
    }

    return {
      protocolo: parsedTree.protocolo || protocolo,
      especificacao: parsedTree.especificacao || '',
      unidadeAtual: unidadeAtual || 'GECTI',
      unidadesAbertas: parsedTree.unidadesAbertas.length > 0 ? parsedTree.unidadesAbertas : [unidadeAtual || 'GECTI'],
      processosRelacionados: parsedTree.processosRelacionados,
      documentos: parsedTree.documentos,
      andamentos: andamentos,
      urlProcessoSei: finalUrl || window.location.href,
      scrapedAt: new Date().toISOString()
    };
  }

  // Escuta comandos vindos do Service Worker (background.js)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    if (msg.action === 'SCRAPE_SINGLE_PROTOCOL') {
      scrapeSingleProtocolInSei(msg.protocolo)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
      return true; // Indica resposta assíncrona
    }

    if (msg.action === 'SCRAPE_CURRENT_OPEN_PROCESS') {
      // Detecta o protocolo aberto na tela do SEI
      const bodyText = document.body ? document.body.innerText : '';
      const protoMatch =
        document.title.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/) ||
        bodyText.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);

      if (!protoMatch) {
        sendResponse({ ok: false, error: 'Nenhum número de processo SEI detectado na tela atual.' });
        return false;
      }

      scrapeSingleProtocolInSei(protoMatch[0])
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
      return true;
    }
  });

  // Injeta botão discreto "Contratics SEI Studio" na barra superior do SEI (apenas no frame principal)
  if (window === window.top && document.body) {
    const existingBtn = document.getElementById('contratics-sei-floating-btn');
    if (!existingBtn) {
      const btn = document.createElement('button');
      btn.id = 'contratics-sei-floating-btn';
      btn.innerHTML = '⚡ Contratics SEI Studio';
      btn.title = 'Sincronizar este processo ou iniciar Varredura Geral para o Contratics';
      btn.style.cssText = [
        'position: fixed',
        'bottom: 16px',
        'right: 16px',
        'z-index: 99999',
        'background: linear-gradient(135deg, #059669, #0d9488)',
        'color: #ffffff',
        'border: 1px solid rgba(255,255,255,0.25)',
        'border-radius: 10px',
        'padding: 8px 14px',
        'font-family: system-ui, -apple-system, sans-serif',
        'font-size: 12px',
        'font-weight: 700',
        'cursor: pointer',
        'box-shadow: 0 8px 20px rgba(0,0,0,0.35)',
        'transition: transform 0.15s ease'
      ].join(';');

      btn.addEventListener('click', async () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Lendo processo no SEI...';
        try {
          const protoMatch =
            document.title.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/) ||
            document.body.innerText.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);
          if (!protoMatch) {
            alert('Abra um processo no SEI ou inicie a Varredura Geral diretamente pela aba do Contratics.');
            btn.innerHTML = originalText;
            return;
          }
          const scraped = await scrapeSingleProtocolInSei(protoMatch[0]);
          chrome.runtime.sendMessage(
            {
              action: 'PUSH_SINGLE_SCRAPED_PROCESS',
              data: scraped
            },
            () => {
              btn.innerHTML = '✅ Enviado ao Contratics!';
              setTimeout(() => {
                btn.innerHTML = originalText;
              }, 2500);
            }
          );
        } catch (err) {
          alert('Erro ao ler processo no SEI: ' + (err.message || err));
          btn.innerHTML = originalText;
        }
      });

      document.body.appendChild(btn);
    }
  }
})();
