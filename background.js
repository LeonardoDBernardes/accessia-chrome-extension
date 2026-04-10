// background.js — AccessIA v1.0.0 — Service Worker
// Gerencia fila SEQUENCIAL de análises. Um por vez.

let fila = [];
let processando = false;
let cooldownMap = {};
let config = {};

async function carregarConfig() {
  const defaults = {
    servidor_url: "http://192.168.0.130:8450",
    varredura_passiva: true,
    varredura_favoritos: true,
    ignorar_login: true,
    cooldown_segundos: 300,
    max_fila: 200,
    notificacao_conclusao: true,
  };
  config = await chrome.storage.local.get(defaults);
}

function normalizar(url) {
  try { const u = new URL(url); return u.origin + u.pathname; } catch { return url; }
}

function emCooldown(url) {
  const ts = cooldownMap[normalizar(url)];
  return ts && (Date.now() - ts) < (config.cooldown_segundos || 300) * 1000;
}

function registrarCooldown(url) {
  const chave = normalizar(url);
  cooldownMap[chave] = Date.now();
  const chaves = Object.keys(cooldownMap);
  if (chaves.length > 500) delete cooldownMap[chaves.sort((a,b) => cooldownMap[a]-cooldownMap[b])[0]];
}

function deveIgnorar(url) {
  if (!url || !url.startsWith("http")) return true;
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return true;
  if (url.startsWith("file://")) return true;
  if (url.length < 10) return true;
  return false;
}

function enfileirar(url, dados, source) {
  if (deveIgnorar(url)) return;
  if (emCooldown(url)) return;
  if (fila.length >= (config.max_fila || 200)) return;
  if (fila.some(item => normalizar(item.url) === normalizar(url))) return;
  fila.push({ url, dados: dados || {}, source: source || "chrome_extension", adicionado_em: Date.now() });
  atualizarBadge();
  processarProximo();
}

async function processarProximo() {
  if (processando || fila.length === 0) return;
  processando = true;
  const item = fila.shift();
  atualizarBadge();
  registrarCooldown(item.url);
  try { await enviarAo7040(item); } catch (e) { console.error("[AccessIA] Erro:", e); }
  processando = false;
  atualizarBadge();
  if (fila.length > 0) setTimeout(processarProximo, 2000);
}

async function enviarAo7040(item) {
  const url_servidor = (config.servidor_url || "http://192.168.0.130:8450").replace(/\/$/, "");
  const payload = {
    url: item.url,
    source: item.source,
    dados_nvda: { extensao_chrome: true, captura: item.dados, timestamp: new Date().toISOString() },
  };
  const resp = await fetch(`${url_servidor}/analisar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const resultado = await resp.json();
  if (resultado.job_id) await aguardarJob(resultado.job_id, url_servidor, item.url);
}

async function aguardarJob(job_id, url_servidor, url_origem) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10000));
    try {
      const resp = await fetch(`${url_servidor}/status/${job_id}`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.status === "done") {
        await salvarHistorico(url_origem, data.resumo_nvda || "", data.summary);
        if (config.notificacao_conclusao && data.resumo_nvda) {
          chrome.notifications.create({ type: "basic", iconUrl: "icons/icon48.png", title: "AccessIA — Análise concluída", message: data.resumo_nvda.slice(0, 200) });
        }
        return;
      } else if (data.status === "error") return;
    } catch {}
  }
}

async function salvarHistorico(url, resumo, summary) {
  const { historico = [] } = await chrome.storage.local.get({ historico: [] });
  historico.unshift({ url, resumo, total_violacoes: summary?.total_violacoes ?? 0, score: summary?.score_lighthouse ?? null, data: new Date().toISOString().slice(0, 10) });
  if (historico.length > 500) historico.splice(500);
  await chrome.storage.local.set({ historico });
}

async function escanearFavoritos() {
  if (!config.varredura_favoritos) return 0;
  const arvore = await chrome.bookmarks.getTree();
  const urls = [];
  function extrair(nos) {
    for (const no of nos) {
      if (no.url && no.url.startsWith("http")) urls.push(no.url);
      if (no.children) extrair(no.children);
    }
  }
  extrair(arvore);
  let delay = 0;
  for (const url of urls) { setTimeout(() => enfileirar(url, {}, "favoritos"), delay); delay += 1000; }
  return urls.length;
}

function atualizarBadge() {
  const n = fila.length;
  if (n === 0) {
    chrome.action.setBadgeText({ text: processando ? "…" : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  } else {
    chrome.action.setBadgeText({ text: String(n) });
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.tipo === "captura_pagina") { if (config.varredura_passiva) enfileirar(msg.url, msg.dados, "passivo"); }
  else if (msg.tipo === "login_ignorado") { console.log("[AccessIA] Login ignorado:", msg.url); }
  else if (msg.tipo === "escanear_favoritos") { escanearFavoritos().then(n => sendResponse({ enfileirados: n })); return true; }
  else if (msg.tipo === "analisar_agora") { enfileirar(msg.url, msg.dados || {}, "manual"); sendResponse({ ok: true }); }
  else if (msg.tipo === "status_fila") { sendResponse({ fila: fila.length, processando }); }
  else if (msg.tipo === "limpar_fila") { fila = []; atualizarBadge(); sendResponse({ ok: true }); }
  else if (msg.tipo === "get_historico") { chrome.storage.local.get({ historico: [] }).then(r => sendResponse(r)); return true; }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-options") chrome.runtime.openOptionsPage();
  else if (command === "scan-current") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) enfileirar(tabs[0].url, {}, "manual");
  }
});

chrome.storage.onChanged.addListener(() => carregarConfig());

carregarConfig().then(() => {
  atualizarBadge();
  console.log("[AccessIA] Background inicializado. Servidor:", config.servidor_url);
  chrome.alarms.create("scan_favoritos_diario", { delayInMinutes: 30, periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "scan_favoritos_diario") { await carregarConfig(); if (config.varredura_favoritos) escanearFavoritos(); }
});