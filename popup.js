// popup.js — AccessIA

async function init() {
  const status = await chrome.runtime.sendMessage({ tipo: "status_fila" });
  document.getElementById("fila_count").textContent = status.fila || "0";
  document.getElementById("processando").textContent = status.processando ? "sim" : "não";
  document.getElementById("processando").className = "badge " + (status.processando ? "warn" : "ok");

  const { servidor_url = "http://192.168.0.130:8450" } = await chrome.storage.local.get("servidor_url");
  try {
    const r = await fetch(servidor_url + "/", { signal: AbortSignal.timeout(3000) });
    const el = document.getElementById("servidor_status");
    el.textContent = r.ok ? "online" : "erro";
    el.className = "badge " + (r.ok ? "ok" : "warn");
  } catch {
    const el = document.getElementById("servidor_status");
    el.textContent = "offline"; el.className = "badge warn";
  }

  const resp = await chrome.runtime.sendMessage({ tipo: "get_historico" });
  const historico = resp.historico || [];
  const divHistorico = document.getElementById("historico");
  if (historico.length === 0) {
    divHistorico.textContent = "Nenhuma análise ainda.";
  } else {
    divHistorico.innerHTML = historico.slice(0, 10).map(h =>
      `<div class="historico-item"><div class="url" title="${h.url}">${h.url}</div><div class="resumo">${h.data} — ${h.total_violacoes ?? "?"} violações</div></div>`
    ).join("");
  }
}

document.getElementById("btn_analisar").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) { await chrome.runtime.sendMessage({ tipo: "analisar_agora", url: tab.url }); window.close(); }
});

document.getElementById("btn_favoritos").addEventListener("click", async () => {
  const btn = document.getElementById("btn_favoritos");
  btn.textContent = "Enfileirando favoritos..."; btn.disabled = true;
  const resp = await chrome.runtime.sendMessage({ tipo: "escanear_favoritos" });
  btn.textContent = `${resp.enfileirados || 0} favoritos enfileirados`;
  setTimeout(() => window.close(), 1500);
});

document.getElementById("btn_limpar").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ tipo: "limpar_fila" });
  document.getElementById("fila_count").textContent = "0";
});

document.getElementById("btn_config").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });

init();