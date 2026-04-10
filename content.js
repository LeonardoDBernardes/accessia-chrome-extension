// content.js — AccessIA v1.0.0
// Roda em cada página. Detecta login e ignora. Captura snapshot de acessibilidade.

(function () {
  if (window.self !== window.top) return;
  if (!location.href.startsWith("http")) return;

  function ehPaginaLogin() {
    if (document.querySelector('input[type="password"]')) return true;
    const urlLogin = /\/(login|signin|sign-in|auth|entrar|senha|password|account\/new|register|cadastro|recovery|forgot)/i;
    if (urlLogin.test(location.pathname)) return true;
    if (/login|entrar|senha|sign in|autenti/i.test((document.title || "").toLowerCase())) return true;
    return false;
  }

  if (ehPaginaLogin()) { chrome.runtime.sendMessage({ tipo: "login_ignorado", url: location.href }); return; }

  function capturarPagina() {
    const problemas = [];

    document.querySelectorAll("img").forEach(img => {
      if (!img.hasAttribute("alt")) problemas.push({ tipo: "img_sem_alt", elemento: img.outerHTML.slice(0, 120), gravidade: "grave" });
      else if (img.alt.trim() === "" && !img.getAttribute("role") && !img.getAttribute("aria-hidden") && img.naturalWidth > 100 && img.naturalHeight > 100)
        problemas.push({ tipo: "img_alt_vazio", elemento: img.outerHTML.slice(0, 120), gravidade: "moderado" });
    });

    document.querySelectorAll("button, [role='button']").forEach(el => {
      const nome = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent.trim() || el.getAttribute("title");
      if (!nome) problemas.push({ tipo: "botao_sem_nome", elemento: el.outerHTML.slice(0, 120), gravidade: "critico" });
    });

    document.querySelectorAll("a[href]").forEach(el => {
      const nome = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent.trim() || el.getAttribute("title");
      if (!nome) problemas.push({ tipo: "link_sem_nome", elemento: el.outerHTML.slice(0, 120), gravidade: "critico" });
    });

    document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='password']), select, textarea").forEach(el => {
      const temLabel = el.id && document.querySelector(`label[for="${el.id}"]`);
      const temAria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.getAttribute("placeholder");
      if (!temLabel && !temAria) problemas.push({ tipo: "campo_sem_label", elemento: el.outerHTML.slice(0, 120), gravidade: "critico" });
    });

    const lang = document.documentElement.getAttribute("lang");
    if (!lang) problemas.push({ tipo: "sem_lang", elemento: "<html>", gravidade: "grave" });

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const h1s = headings.filter(h => h.tagName === "H1");
    if (h1s.length === 0 && headings.length > 0) problemas.push({ tipo: "sem_h1", elemento: "página sem <h1>", gravidade: "grave" });
    else if (h1s.length > 1) problemas.push({ tipo: "multiplos_h1", elemento: `${h1s.length} elementos <h1>`, gravidade: "moderado" });
    let nivelAnterior = 0;
    headings.forEach(h => {
      const nivel = parseInt(h.tagName[1]);
      if (nivelAnterior > 0 && nivel > nivelAnterior + 1) problemas.push({ tipo: "salto_heading", elemento: `${h.tagName}: "${h.textContent.slice(0, 60)}"`, gravidade: "moderado" });
      nivelAnterior = nivel;
    });

    if (!document.querySelector("main, [role='main']")) problemas.push({ tipo: "sem_main", elemento: "página sem landmark <main>", gravidade: "grave" });

    const primeiroLink = document.querySelector("a");
    if (!primeiroLink || !/pul|skip|conteudo|content|main/i.test(primeiroLink.textContent + primeiroLink.href))
      problemas.push({ tipo: "sem_skip_link", elemento: "primeiro link não é skip link", gravidade: "moderado" });

    document.querySelectorAll("table").forEach(t => {
      if (!t.querySelector("th")) problemas.push({ tipo: "tabela_sem_cabecalho", elemento: t.outerHTML.slice(0, 80), gravidade: "grave" });
      if (!t.querySelector("caption") && !t.getAttribute("aria-label") && !t.getAttribute("aria-labelledby"))
        problemas.push({ tipo: "tabela_sem_nome", elemento: t.outerHTML.slice(0, 80), gravidade: "moderado" });
    });

    document.querySelectorAll("iframe").forEach(fr => {
      if (!fr.getAttribute("title") && !fr.getAttribute("aria-label"))
        problemas.push({ tipo: "iframe_sem_title", elemento: fr.outerHTML.slice(0, 120), gravidade: "grave" });
    });

    return {
      problemas,
      meta: {
        titulo: document.title || "", lang: lang || "",
        viewport: document.querySelector('meta[name="viewport"]')?.content || "",
        total_links: document.querySelectorAll("a[href]").length,
        total_imagens: document.querySelectorAll("img").length,
        total_formularios: document.querySelectorAll("form").length,
        total_botoes: document.querySelectorAll("button, [role='button']").length,
        headings: headings.map(h => ({ nivel: h.tagName, texto: h.textContent.trim().slice(0, 80) })),
      },
      html_snapshot: document.documentElement.outerHTML
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .slice(0, 50000),
    };
  }

  try {
    chrome.runtime.sendMessage({ tipo: "captura_pagina", url: location.href, dados: capturarPagina() });
  } catch (e) {}
})();