/**
 * Contratics SEI Studio — Suite Completa Inspirada no SEI Pro
 *
 * Ferramentas incluídas:
 * 1. Estúdio de Fluxo SEI Pro: Extrai toda a trajetória cronológica (#tblHistorico),
 *    unidades abertas (divInformacao), árvore de documentos (infraArvoreNo) e assinaturas
 *    para espelhar no Fluxo BPMN 2.0 Oficial do Contratics.
 * 2. Monitoramento Ativo no Controle de Processos & Acompanhamento Especial do SEI:
 *    Destaca automaticamente nas tabelas do SEI todos os processos que estão cadastrados
 *    no Contratics (Planejamentos e Contratos), permitindo atualizar 1 processo ou todos
 *    os visíveis com 1 clique diretamente de dentro do SEI.
 * 3. Varredura Profunda (2º Nível) de Processos Associados / Relacionados:
 *    Inspeciona automaticamente os processos relacionados (Pagamentos, Notas de Empenho,
 *    Descentralizações, Termos Aditivos, Apostilamentos e Ordens de Serviço) para alimentar
 *    o Contratics com o andamento e documentos de cada processo associado.
 * 4. Extrator de Artefatos e Portarias:
 *    Identifica automaticamente DFD, ETP, TR, Portaria da EPC, Portaria de Fiscalização,
 *    Parecer CONJUR, Edital, TRP, TRD e Notas de Empenho na árvore do SEI.
 * 5. Painel Retrátil "Contratics • SEI Pro" dentro do SEI + Botão de Rollback com 1 Clique.
 */

(function () {
  if (window.__CONTRATICS_SEI_READER_LOADED__) return;
  window.__CONTRATICS_SEI_READER_LOADED__ = true;

  function cleanText(raw) {
    if (!raw) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = String(raw).replace(/<[^>]*>/g, ' ');
    return txt.value.replace(/\s+/g, ' ').trim();
  }

  function normalizeDigits(val) {
    return String(val || '').replace(/\D/g, '');
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
        const seiNumMatch = nodeLabel.match(/(\d{7,10})\s*\)?$/) || nodeLabel.match(/\((\d{7,10})\)/);
        const idSei = seiNumMatch ? seiNumMatch[1] : nodeLabel;
        const rawRest = seiNumMatch
          ? nodeLabel.replace(seiNumMatch[0], '').replace(/[()]/g, '').trim()
          : nodeLabel;

        // Separa eventual número do documento (ex: "Portaria 42/2026" -> tipo: "Portaria", numero: "42/2026")
        const docNumMatch = rawRest.match(/^(.*?)\s+(?:n[º°]\s*)?(\d+(?:\/\d{2,4})?)$/i);
        const tipoNome = docNumMatch ? docNumMatch[1].trim() : rawRest;
        const numeroDoc = docNumMatch ? docNumMatch[2].trim() : undefined;

        const unitMatch = nodeTitle.match(/\b([A-Z]{2,10}(?:[-/][A-Z]{2,10})*)\b/);
        const dateMatch = nodeTitle.match(/(\d{2}\/\d{2}\/\d{4})/);

        // Extrai assinantes caso presentes no title ou em atributos da árvore
        const signers = [];
        const sigMatch = nodeTitle.match(/Assinado por[:\s]+([^()]+)/i);
        if (sigMatch && sigMatch[1]) {
          sigMatch[1]
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((s) => signers.push(s));
        }

        const isSigned =
          signers.length > 0 ||
          (!nodeTitle.toLowerCase().includes('minuta') &&
            !nodeTitle.toLowerCase().includes('sem assinatura') &&
            !argsRaw.toLowerCase().includes('documento_nao_assinado'));

        result.documentos.push({
          idSei,
          numeroSei: idSei,
          tipo: tipoNome || 'Documento SEI',
          numero: numeroDoc,
          data: dateMatch ? dateMatch[1] : '',
          unidade: unitMatch ? unitMatch[1] : '',
          assinado: isSigned,
          assinantes: signers
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
   * Retorna a URL base do SEI na aba atual (compatível com /sei/, /sip/ ou raiz do domínio)
   */
  function getBaseSeiUrl() {
    try {
      return new URL('.', window.location.href).href;
    } catch (e) {
      return window.location.origin + '/sei/';
    }
  }

  /**
   * Decodifica ArrayBuffer do SEI respeitando ISO-8859-1 ou UTF-8 conforme o cabeçalho/meta
   */
  function decodeSeiBuffer(buf, contentTypeHeader) {
    const ct = String(contentTypeHeader || '').toLowerCase();
    if (ct.includes('utf-8')) {
      return new TextDecoder('utf-8').decode(buf);
    }
    const isoText = new TextDecoder('iso-8859-1').decode(buf);
    if (/charset=["']?utf-8/i.test(isoText)) {
      return new TextDecoder('utf-8').decode(buf);
    }
    return isoText;
  }

  /**
   * Extrai o HTML da árvore (procedimento_visualizar) a partir do HTML de procedimento_trabalhar ou de listagem
   */
  async function extractArvoreFromWorkOrSearchPage(pageHtml, baseUrl, targetProtocolo) {
    const targetDigits = normalizeDigits(targetProtocolo);

    // Caso 1: A página já é a própria árvore (contém `new infraArvoreNo`)
    if (/new\s+infraArvoreNo\s*\(/i.test(pageHtml)) {
      return pageHtml;
    }

    // Caso 2: A página contém o iframe ifrArvore ou URL assinada de `acao=procedimento_visualizar`
    const arvoreSrcMatch =
      pageHtml.match(/id=["']ifrArvore["'][^>]+src=["']([^"']+)["']/i) ||
      pageHtml.match(/name=["']ifrArvore["'][^>]+src=["']([^"']+)["']/i) ||
      pageHtml.match(/src=["']([^"']*controlador\.php\?acao=procedimento_visualizar[^"']+)["']/i) ||
      pageHtml.match(/(controlador\.php\?acao=procedimento_visualizar[^"'\s<>\\]+)/i);

    if (arvoreSrcMatch) {
      const rawSrc = (arvoreSrcMatch[1] || arvoreSrcMatch[0]).replace(/&amp;/g, '&');
      const fullArvoreUrl = new URL(rawSrc, baseUrl).href;
      const arvResp = await fetch(fullArvoreUrl, { credentials: 'include' });
      const arvBuf = await arvResp.arrayBuffer();
      const arvHtml = decodeSeiBuffer(arvBuf, arvResp.headers.get('content-type'));
      if (arvHtml && /infraArvoreNo|procedimento_consultar_historico|divArvore/i.test(arvHtml)) {
        return arvHtml;
      }
    }

    // Caso 3: A pesquisa retornou uma lista de resultados com links `acao=procedimento_trabalhar`
    const allWorkLinks = [
      ...pageHtml.matchAll(/href=["']([^"']*controlador\.php\?acao=(?:procedimento_trabalhar|protocolo_pesquisar)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    ];

    let chosenWorkHref = '';
    for (const m of allWorkLinks) {
      const href = m[1].replace(/&amp;/g, '&');
      const anchorTextDigits = normalizeDigits(m[2] || '');
      if (targetDigits && (anchorTextDigits.includes(targetDigits) || href.includes(targetDigits))) {
        chosenWorkHref = href;
        break;
      }
    }

    if (!chosenWorkHref) {
      const fallbackMatch = pageHtml.match(/(controlador\.php\?acao=procedimento_trabalhar[^"'\s<>\\]+)/i);
      if (fallbackMatch) {
        chosenWorkHref = fallbackMatch[1].replace(/&amp;/g, '&');
      }
    }

    if (chosenWorkHref) {
      const workUrl = new URL(chosenWorkHref, baseUrl).href;
      const workResp = await fetch(workUrl, { credentials: 'include' });
      const workBuf = await workResp.arrayBuffer();
      const workHtml = decodeSeiBuffer(workBuf, workResp.headers.get('content-type'));

      if (/new\s+infraArvoreNo\s*\(/i.test(workHtml)) {
        return workHtml;
      }

      const subArvMatch =
        workHtml.match(/id=["']ifrArvore["'][^>]+src=["']([^"']+)["']/i) ||
        workHtml.match(/src=["']([^"']*controlador\.php\?acao=procedimento_visualizar[^"']+)["']/i) ||
        workHtml.match(/(controlador\.php\?acao=procedimento_visualizar[^"'\s<>\\]+)/i);

      if (subArvMatch) {
        const fullArvoreUrl = new URL((subArvMatch[1] || subArvMatch[0]).replace(/&amp;/g, '&'), baseUrl).href;
        const arvResp = await fetch(fullArvoreUrl, { credentials: 'include' });
        const arvBuf = await arvResp.arrayBuffer();
        return decodeSeiBuffer(arvBuf, arvResp.headers.get('content-type'));
      }
    }

    return '';
  }

  /**
   * Busca o HTML da árvore de um protocolo no SEI via link direto assinado ou Pesquisa Rápida com `infra_hash`
   */
  async function fetchArvoreHtmlForProtocol(protocolo) {
    const baseSeiUrl = getBaseSeiUrl();
    const targetDigits = normalizeDigits(protocolo);

    // 1. Verifica se o processo já possui link direto assinado na tela atual do SEI (Controle de Processos / Acompanhamento)
    const directLinks = document.querySelectorAll('a[href*="acao=procedimento_trabalhar"]');
    for (const a of directLinks) {
      const linkDigits = normalizeDigits((a.textContent || '') + ' ' + (a.getAttribute('title') || '') + ' ' + (a.getAttribute('href') || ''));
      if (targetDigits && linkDigits.includes(targetDigits)) {
        try {
          const signedWorkUrl = new URL(a.getAttribute('href'), baseSeiUrl).href;
          const workResp = await fetch(signedWorkUrl, { credentials: 'include' });
          const workBuf = await workResp.arrayBuffer();
          const workHtml = decodeSeiBuffer(workBuf, workResp.headers.get('content-type'));
          const treeHtml = await extractArvoreFromWorkOrSearchPage(workHtml, baseSeiUrl, protocolo);
          if (treeHtml) {
            return { mainWorkHtml: treeHtml, finalUrl: signedWorkUrl };
          }
        } catch (e) {
          // Continua para a Pesquisa Rápida assinada
        }
      }
    }

    // 2. Localiza o formulário oficial de Pesquisa Rápida do SEI (#frmProtocoloPesquisaRapida) que contém o `infra_hash` da sessão
    let searchFormEl =
      document.getElementById('frmProtocoloPesquisaRapida') ||
      document.querySelector('form[name="frmProtocoloPesquisaRapida"]') ||
      document.querySelector('form[action*="acao=protocolo_pesquisar"]');

    let searchActionUrl = '';
    const baseFormParams = new URLSearchParams();

    if (searchFormEl) {
      const rawAction = searchFormEl.getAttribute('action') || '';
      if (rawAction) {
        searchActionUrl = new URL(rawAction.replace(/&amp;/g, '&'), baseSeiUrl).href;
      }
      const hiddenInputs = searchFormEl.querySelectorAll('input[type="hidden"]');
      hiddenInputs.forEach((inp) => {
        if (inp.name) baseFormParams.set(inp.name, inp.value || '');
      });
    }

    // Fallback: procura a action assinada no HTML da página principal caso o form esteja colapsado na navbar
    if (!searchActionUrl && document.documentElement) {
      const actionInDom = document.documentElement.innerHTML.match(
        /controlador\.php\?acao=protocolo_pesquisar[^"'\s<>\\]+/i
      );
      if (actionInDom) {
        searchActionUrl = new URL(actionInDom[0].replace(/&amp;/g, '&'), baseSeiUrl).href;
      }
    }

    if (!searchActionUrl) {
      searchActionUrl = baseSeiUrl + 'controlador.php?acao=protocolo_pesquisar&acao_origem=procedimento_controlar';
    }

    // Tenta pesquisar primeiro com o protocolo formatado e, se necessário, apenas com os dígitos (padrão SEI 4.x)
    const candidates = [String(protocolo || '').trim()];
    if (targetDigits && !candidates.includes(targetDigits)) {
      candidates.push(targetDigits);
    }

    for (const queryVal of candidates) {
      try {
        const formParams = new URLSearchParams(baseFormParams.toString());
        formParams.set('txtPesquisaRapida', queryVal);
        if (!formParams.has('hdnInfraTipoPagina')) {
          formParams.set('hdnInfraTipoPagina', '1');
        }

        const searchResp = await fetch(searchActionUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams.toString()
        });

        const finalUrl = searchResp.url || searchActionUrl;
        const buf = await searchResp.arrayBuffer();
        const pageHtml = decodeSeiBuffer(buf, searchResp.headers.get('content-type'));

        const mainWorkHtml = await extractArvoreFromWorkOrSearchPage(pageHtml, baseSeiUrl, protocolo);
        if (mainWorkHtml) {
          return { mainWorkHtml, finalUrl };
        }

        // Também tenta via GET caso a instância do SEI redirecione pesquisa rápida por query string
        const urlWithParam = new URL(searchActionUrl);
        urlWithParam.searchParams.set('id_procedimento', queryVal);
        urlWithParam.searchParams.set('txtPesquisaRapida', queryVal);
      } catch (e) {
        console.warn('[Contratics SEI Studio] Tentativa de pesquisa falhou para', queryVal, e);
      }
    }

    // 3. Fallback direto por URL de pesquisa de protocolo se o usuário estiver dentro de um iframe ou tela interna
    try {
      const fallbackUrl = `${baseSeiUrl}controlador.php?acao=procedimento_trabalhar&id_procedimento=${encodeURIComponent(targetDigits)}`;
      const resp = await fetch(fallbackUrl, { credentials: 'include' });
      const buf = await resp.arrayBuffer();
      const html = decodeSeiBuffer(buf, resp.headers.get('content-type'));
      const treeHtml = await extractArvoreFromWorkOrSearchPage(html, baseSeiUrl, protocolo);
      if (treeHtml) {
        return { mainWorkHtml: treeHtml, finalUrl: resp.url || fallbackUrl };
      }
    } catch (e) {}

    return { mainWorkHtml: '', finalUrl: '' };
  }

  /**
   * Lê um processo específico no SEI (e opcionalmente faz inspeção de 2º nível nos processos relacionados)
   */
  async function scrapeSingleProtocolInSei(protocolo, deepScanRelated = true) {
    const baseSeiUrl = getBaseSeiUrl();
    const targetDigits = normalizeDigits(protocolo);
    let mainWorkHtml = '';
    let finalUrl = '';

    // Se já estiver aberto na tela atual do SEI, lê direto do iframe ifrArvore
    const pageTextDigits = normalizeDigits(document.title + ' ' + (document.body ? document.body.innerText.slice(0, 4000) : ''));
    if (targetDigits && pageTextDigits.includes(targetDigits)) {
      const ifrArvore = document.getElementById('ifrArvore') || document.querySelector('iframe[name="ifrArvore"]');
      if (ifrArvore) {
        try {
          if (ifrArvore.contentDocument && ifrArvore.contentDocument.documentElement) {
            const domHtml = ifrArvore.contentDocument.documentElement.innerHTML;
            if (domHtml && normalizeDigits(domHtml).includes(targetDigits)) {
              mainWorkHtml = domHtml;
            }
          }
        } catch (e) {}

        if (!mainWorkHtml && ifrArvore.src) {
          try {
            const resp = await fetch(ifrArvore.src, { credentials: 'include' });
            const buf = await resp.arrayBuffer();
            const candidateHtml = decodeSeiBuffer(buf, resp.headers.get('content-type'));
            if (normalizeDigits(candidateHtml).includes(targetDigits)) {
              mainWorkHtml = candidateHtml;
            }
          } catch (e) {}
        }
      }
    }

    if (!mainWorkHtml) {
      const fetched = await fetchArvoreHtmlForProtocol(protocolo);
      mainWorkHtml = fetched.mainWorkHtml;
      finalUrl = fetched.finalUrl;
    }

    if (!mainWorkHtml) {
      throw new Error(`Não foi possível localizar o processo ${protocolo} nesta sessão do SEI. Verifique se você está logado na tela principal do SEI.`);
    }

    const parsedTree = parseSeiArvoreScript(mainWorkHtml);
    let andamentos = [];

    if (parsedTree.historicoUrl) {
      try {
        const histFullUrl = new URL(parsedTree.historicoUrl, baseSeiUrl).href;
        const histResp = await fetch(histFullUrl, { credentials: 'include' });
        const histBuf = await histResp.arrayBuffer();
        const histHtml = decodeSeiBuffer(histBuf, histResp.headers.get('content-type'));
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

    // Varredura Profunda de 2º Nível para Processos Relacionados (Pagamentos, Descentralizações, Aditivos, etc.)
    if (deepScanRelated && parsedTree.processosRelacionados.length > 0) {
      const maxRelatedToInspect = Math.min(parsedTree.processosRelacionados.length, 5);
      for (let r = 0; r < maxRelatedToInspect; r++) {
        const rel = parsedTree.processosRelacionados[r];
        try {
          if (rel.link) {
            const relResp = await fetch(rel.link, { credentials: 'include' });
            const relBuf = await relResp.arrayBuffer();
            const relWorkHtml = decodeSeiBuffer(relBuf, relResp.headers.get('content-type'));
            const relArvHtml = await extractArvoreFromWorkOrSearchPage(relWorkHtml, baseSeiUrl, rel.protocolo);
            if (relArvHtml) {
              const relTree = parseSeiArvoreScript(relArvHtml);
              rel.unidadeAtual = relTree.unidadeAtual || relTree.unidadesAbertas[0] || undefined;
              rel.descricao = relTree.especificacao || rel.tipo;
              rel.documentosDetectados = (relTree.documentos || []).slice(-10);
              if (relTree.documentos && relTree.documentos.length > 0) {
                const lastDoc = relTree.documentos[relTree.documentos.length - 1];
                rel.ultimoAndamento = `Último doc: ${lastDoc.tipo}${lastDoc.numero ? ' ' + lastDoc.numero : ''} (SEI ${lastDoc.idSei})`;
                rel.dataUltimoAndamento = lastDoc.data || undefined;
              }
              continue;
            }
          }
          const relFetched = await fetchArvoreHtmlForProtocol(rel.protocolo);
          if (relFetched.mainWorkHtml) {
            const relTree = parseSeiArvoreScript(relFetched.mainWorkHtml);
            rel.unidadeAtual = relTree.unidadeAtual || relTree.unidadesAbertas[0] || undefined;
            rel.descricao = relTree.especificacao || rel.tipo;
            rel.documentosDetectados = (relTree.documentos || []).slice(-10);
            if (relTree.documentos && relTree.documentos.length > 0) {
              const lastDoc = relTree.documentos[relTree.documentos.length - 1];
              rel.ultimoAndamento = `Último doc: ${lastDoc.tipo}${lastDoc.numero ? ' ' + lastDoc.numero : ''} (SEI ${lastDoc.idSei})`;
              rel.dataUltimoAndamento = lastDoc.data || undefined;
            }
          }
        } catch (e) {
          // Segue normalmente se algum processo relacionado tiver acesso restrito
        }
      }
    }

    let unidadeAtual = parsedTree.unidadesAbertas[0] || '';
    if (!unidadeAtual && andamentos.length > 0) {
      unidadeAtual = andamentos[0].unidade;
      parsedTree.unidadesAbertas = [unidadeAtual];
    }

    return {
      protocolo: parsedTree.protocolo || protocolo,
      tipoProcessoSei: parsedTree.especificacao || '',
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
      scrapeSingleProtocolInSei(msg.protocolo, msg.deepScanRelated !== false)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
      return true;
    }

    if (msg.action === 'SCRAPE_CURRENT_OPEN_PROCESS') {
      const bodyText = document.body ? document.body.innerText : '';
      const protoMatch =
        document.title.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/) ||
        bodyText.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);

      if (!protoMatch) {
        sendResponse({ ok: false, error: 'Nenhum número de processo SEI detectado na tela atual.' });
        return false;
      }

      scrapeSingleProtocolInSei(protoMatch[0], true)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
      return true;
    }
  });

  // ============================================================================
  // FERRAMENTA SEI PRO: DESTAQUE AUTOMÁTICO DE PROCESSOS MONITORADOS NAS TABELAS DO SEI
  // (Controle de Processos, Acompanhamento Especial e Blocos Internos)
  // ============================================================================
  function highlightMonitoredProcessesInSeiTables(monitoredList) {
    if (!Array.isArray(monitoredList) || monitoredList.length === 0) return;

    const mapByDigits = new Map();
    monitoredList.forEach((item) => {
      const d = normalizeDigits(item.protocolo);
      if (d) mapByDigits.set(d, item);
    });

    const links = document.querySelectorAll('a[href*="acao=procedimento_trabalhar"]');
    const matchedOnScreen = [];

    links.forEach((a) => {
      if (a.dataset.contraticsTagged === 'true') return;
      const textDigits = normalizeDigits(a.textContent || '');
      const titleDigits = normalizeDigits(a.getAttribute('title') || '');
      const matched = mapByDigits.get(textDigits) || mapByDigits.get(titleDigits);
      if (!matched) return;

      a.dataset.contraticsTagged = 'true';
      matchedOnScreen.push(matched);

      const badge = document.createElement('span');
      const isContract = matched.category === 'contrato';
      badge.innerHTML = isContract ? '⚡ CONTRATICS • CONTRATO' : '⚡ CONTRATICS • PLANEJAMENTO';
      badge.title = `${matched.label} — Clique para sincronizar este processo com o Contratics agora`;
      badge.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'gap: 4px',
        'margin-left: 6px',
        'padding: 1px 6px',
        'border-radius: 4px',
        'font-size: 9.5px',
        'font-weight: 700',
        'font-family: system-ui, sans-serif',
        'cursor: pointer',
        isContract
          ? 'background: #0284c7; color: #ffffff; border: 1px solid #38bdf8;'
          : 'background: #059669; color: #ffffff; border: 1px solid #34d399;'
      ].join(';');

      badge.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const orig = badge.innerHTML;
        badge.innerHTML = '⏳ Lendo SEI...';
        try {
          const data = await scrapeSingleProtocolInSei(matched.protocolo, true);
          chrome.runtime.sendMessage({ action: 'PUSH_SINGLE_SCRAPED_PROCESS', data }, () => {
            badge.innerHTML = '✅ Sincronizado!';
            setTimeout(() => {
              badge.innerHTML = orig;
            }, 2500);
          });
        } catch (err) {
          badge.innerHTML = '❌ Erro';
          setTimeout(() => {
            badge.innerHTML = orig;
          }, 2500);
        }
      });

      a.parentElement && a.parentElement.appendChild(badge);
    });

    // Se encontrou processos monitorados na tabela do SEI, injeta barra rápida no topo da tabela
    if (matchedOnScreen.length > 0 && !document.getElementById('contratics-sei-table-banner')) {
      const tbl =
        document.querySelector('#tblProcessosRecebidos, #tblProcessosGerados, #tblProcessosDetalhado, #tblAcompanhamento') ||
        document.querySelector('table.infraTable');
      if (tbl && tbl.parentElement) {
        const banner = document.createElement('div');
        banner.id = 'contratics-sei-table-banner';
        banner.style.cssText = [
          'background: linear-gradient(90deg, #064e3b, #0f172a)',
          'color: #f8fafc',
          'padding: 8px 14px',
          'border-radius: 8px',
          'border: 1px solid #10b981',
          'margin: 8px 0',
          'display: flex',
          'align-items: center',
          'justify-content: space-between',
          'font-family: system-ui, sans-serif',
          'font-size: 12px'
        ].join(';');

        banner.innerHTML = `
          <div>
            <strong style="color:#34d399;">⚡ Contratics SEI Pro (Processos Monitorados):</strong>
            Detectamos <strong>${matchedOnScreen.length}</strong> processo(s) cadastrado(s) no Contratics nesta tela do SEI.
          </div>
          <button id="btnContraticsSyncVisible" style="background:#10b981; color:#022c22; border:none; border-radius:6px; padding:5px 12px; font-weight:700; font-size:11px; cursor:pointer;">
            🔄 Sincronizar Estes ${matchedOnScreen.length} Processo(s) no Contratics
          </button>
        `;

        tbl.parentElement.insertBefore(banner, tbl);
        const btnSyncVis = banner.querySelector('#btnContraticsSyncVisible');
        if (btnSyncVis) {
          btnSyncVis.addEventListener('click', () => {
            btnSyncVis.textContent = '⏳ Varredura iniciada... acompanhe no Contratics';
            chrome.runtime.sendMessage({
              action: 'START_BATCH_SCAN',
              processes: matchedOnScreen,
              deepScanRelated: true
            });
          });
        }
      }
    }
  }

  // ============================================================================
  // PAINEL RETRÁTIL "CONTRATICS • SEI PRO" DENTRO DO SEI
  // ============================================================================
  if (window === window.top && document.body) {
    chrome.runtime.sendMessage({ action: 'GET_MONITORED_PROCESSES' }, (resp) => {
      const monitored = (resp && resp.processes) || [];
      highlightMonitoredProcessesInSeiTables(monitored);
    });

    if (!document.getElementById('contratics-sei-floating-btn')) {
      const btn = document.createElement('button');
      btn.id = 'contratics-sei-floating-btn';
      btn.innerHTML = '⚡ Contratics • SEI Pro';
      btn.title = 'Abrir Painel Contratics SEI Pro (Estúdio de Fluxo, Processos Monitorados, Associados e Rollback)';
      btn.style.cssText = [
        'position: fixed',
        'bottom: 16px',
        'right: 16px',
        'z-index: 99999',
        'background: linear-gradient(135deg, #059669, #0284c7)',
        'color: #ffffff',
        'border: 1px solid rgba(255,255,255,0.3)',
        'border-radius: 10px',
        'padding: 9px 15px',
        'font-family: system-ui, -apple-system, sans-serif',
        'font-size: 12px',
        'font-weight: 700',
        'cursor: pointer',
        'box-shadow: 0 8px 24px rgba(0,0,0,0.4)'
      ].join(';');

      const drawer = document.createElement('div');
      drawer.id = 'contratics-sei-pro-drawer';
      drawer.style.cssText = [
        'position: fixed',
        'bottom: 60px',
        'right: 16px',
        'width: 380px',
        'max-height: 520px',
        'background: #0f172a',
        'color: #f8fafc',
        'border: 1px solid #334155',
        'border-radius: 12px',
        'box-shadow: 0 20px 40px rgba(0,0,0,0.6)',
        'z-index: 99999',
        'display: none',
        'flex-direction: column',
        'overflow: hidden',
        'font-family: system-ui, -apple-system, sans-serif',
        'font-size: 12px'
      ].join(';');

      drawer.innerHTML = `
        <div style="padding:12px 14px; background:#1e293b; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="font-size:13px; color:#34d399;">⚡ Contratics • SEI Pro Suite</strong>
            <div style="font-size:10px; color:#94a3b8;">Estúdio de Fluxo BPMN 2.0 • Processos Monitorados</div>
          </div>
          <button id="contraticsDrawerClose" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div style="padding:12px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:10px;">
          <div id="contraticsDrawerStatus" style="padding:8px 10px; background:#1e293b; border:1px solid #334155; border-radius:8px; font-size:11px; color:#cbd5e1;">
            Selecione uma ferramenta abaixo para alimentar o Contratics:
          </div>

          <button id="contraticsDrawerSyncCurrent" style="padding:10px; background:#10b981; color:#022c22; border:none; border-radius:8px; font-weight:700; cursor:pointer; text-align:left;">
            🔀 1. Estúdio de Fluxo: Mapear Processo Aberto &rarr; BPMN 2.0
            <div style="font-size:10px; font-weight:500; opacity:0.85; margin-top:2px;">Lê raias, documentos, portarias, assinaturas e processos associados</div>
          </button>

          <button id="contraticsDrawerBatchAll" style="padding:10px; background:#0284c7; color:#ffffff; border:none; border-radius:8px; font-weight:700; cursor:pointer; text-align:left;">
            📋 2. Varredura Geral dos Processos Monitorados
            <div style="font-size:10px; font-weight:500; opacity:0.9; margin-top:2px;">Atualiza todos os Planejamentos e Contratos cadastrados no Contratics</div>
          </button>

          <button id="contraticsDrawerRollback" style="padding:9px; background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.4); border-radius:8px; font-weight:700; cursor:pointer; text-align:left;">
            ⏪ 3. Voltar aos Dados Anteriores (Rollback 1 Clique)
            <div style="font-size:10px; font-weight:500; opacity:0.9; margin-top:2px;">Restaura o snapshot automático salvo antes da última leitura</div>
          </button>

          <div style="border-top:1px solid #1e293b; padding-top:8px;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">
              Processos Monitorados do Contratics (<span id="contraticsMonitoredCount">0</span>):
            </div>
            <div id="contraticsMonitoredListContainer" style="max-height:170px; overflow-y:auto; display:flex; flex-direction:column; gap:5px;"></div>
          </div>
        </div>
      `;

      document.body.appendChild(drawer);
      document.body.appendChild(btn);

      const statusEl = drawer.querySelector('#contraticsDrawerStatus');
      const listContainer = drawer.querySelector('#contraticsMonitoredListContainer');
      const countEl = drawer.querySelector('#contraticsMonitoredCount');

      function renderMonitoredInDrawer() {
        chrome.runtime.sendMessage({ action: 'GET_MONITORED_PROCESSES' }, (resp) => {
          const list = (resp && resp.processes) || [];
          countEl.textContent = String(list.length);
          listContainer.innerHTML = '';
          if (list.length === 0) {
            listContainer.innerHTML = '<div style="font-size:11px; color:#64748b; font-style:italic;">Abra a aba do Contratics para sincronizar a lista de processos monitorados.</div>';
            return;
          }
          list.forEach((item) => {
            const row = document.createElement('div');
            row.style.cssText = 'padding:6px 8px; background:#1e293b; border:1px solid #334155; border-radius:6px; display:flex; justify-content:space-between; align-items:center; gap:6px;';
            row.innerHTML = `
              <div style="min-width:0; flex:1;">
                <div style="font-family:monospace; font-weight:700; color:#38bdf8; font-size:11px;">${item.protocolo}</div>
                <div style="font-size:10px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.label || ''}</div>
              </div>
              <button data-proto="${item.protocolo}" style="background:#059669; color:#fff; border:none; border-radius:4px; padding:3px 7px; font-size:10px; font-weight:700; cursor:pointer; flex-shrink:0;">
                Sincronizar
              </button>
            `;
            const syncBtn = row.querySelector('button');
            syncBtn.addEventListener('click', async () => {
              syncBtn.textContent = '⏳...';
              try {
                const scraped = await scrapeSingleProtocolInSei(item.protocolo, true);
                chrome.runtime.sendMessage({ action: 'PUSH_SINGLE_SCRAPED_PROCESS', data: scraped }, () => {
                  syncBtn.textContent = '✅ OK';
                  statusEl.textContent = `Processo ${item.protocolo} atualizado no Contratics!`;
                  setTimeout(() => { syncBtn.textContent = 'Sincronizar'; }, 2000);
                });
              } catch (e) {
                syncBtn.textContent = 'Erro';
                statusEl.textContent = `Erro ao ler ${item.protocolo}: ${e.message || e}`;
              }
            });
            listContainer.appendChild(row);
          });
        });
      }

      btn.addEventListener('click', () => {
        const isHidden = drawer.style.display === 'none';
        drawer.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) renderMonitoredInDrawer();
      });

      drawer.querySelector('#contraticsDrawerClose').addEventListener('click', () => {
        drawer.style.display = 'none';
      });

      drawer.querySelector('#contraticsDrawerSyncCurrent').addEventListener('click', async () => {
        statusEl.textContent = '⏳ Mapeando fluxo, raias, documentos e processos associados...';
        try {
          const protoMatch =
            document.title.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/) ||
            document.body.innerText.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);
          if (!protoMatch) {
            statusEl.textContent = '⚠️ Abra um processo no SEI primeiro ou use a Varredura Geral.';
            return;
          }
          const scraped = await scrapeSingleProtocolInSei(protoMatch[0], true);
          chrome.runtime.sendMessage({ action: 'PUSH_SINGLE_SCRAPED_PROCESS', data: scraped }, () => {
            statusEl.textContent = `✅ Fluxo de ${scraped.protocolo} (${scraped.documentos.length} docs, ${scraped.processosRelacionados.length} associados) espelhado no BPMN do Contratics!`;
          });
        } catch (err) {
          statusEl.textContent = '❌ Erro: ' + (err.message || err);
        }
      });

      drawer.querySelector('#contraticsDrawerBatchAll').addEventListener('click', () => {
        statusEl.textContent = '⏳ Varredura Geral iniciada! Acompanhe o progresso no Contratics.';
        chrome.runtime.sendMessage({ action: 'START_BATCH_SCAN', processes: [], deepScanRelated: true });
      });

      drawer.querySelector('#contraticsDrawerRollback').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'TRIGGER_ROLLBACK_FROM_POPUP' }, () => {
          statusEl.textContent = '⏪ Comando de restauração enviado para o Contratics.';
        });
      });
    }
  }
})();
