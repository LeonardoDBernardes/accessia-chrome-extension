// options.js — AccessIA

const DEFAULTS = {
  servidor_url: "http://192.168.0.130:8450",
  varredura_passiva: true,
  varredura_favoritos: true,
  ignorar_login: true,
  cooldown_segundos: 300,
  max_fila: 200,
  notificacao_conclusao: true,
};

async function carregarConfig() {
  const cfg = await chrome.storage.local.get(DEFAULTS);
  document.getElementById("servidor_url").value = cfg.servidor_url;
  document.getElementById("varredura_passiva").checked = cfg.varredura_passiva;
  document.getElementById("varredura_favoritos").checked = cfg.varredura_favoritos;
  document.getElementById("ignorar_login").checked = cfg.ignorar_login;
  document.getElementById("notificacao_conclusao").checked = cfg.notificacao_conclusao;
  document.getElementById("cooldown_segundos").value = cfg.cooldown_segundos;
  document.getElementById("max_fila").value = cfg.max_fila;
}

document.getElementById("btn_salvar").addEventListener("click", async () => {
  const cfg = {
    servidor_url: document.getElementById("servidor_url").value.trim().replace(/\/$/, ""),
    varredura_passiva: document.getElementById("varredura_passiva").checked,
    varredura_favoritos: document.getElementById("varredura_favoritos").checked,
    ignorar_login: document.getElementById("ignorar_login").checked,
    notificacao_conclusao: document.getElementById("notificacao_conclusao").checked,
    cooldown_segundos: parseInt(document.getElementById("cooldown_segundos").value) || 300,
    max_fila: parseInt(document.getElementById("max_fila").value) || 200,
  };
  await chrome.storage.local.set(cfg);
  const msg = document.getElementById("msg_salvo");
  msg.className = "msg ok";
  setTimeout(() => msg.className = "msg", 3000);
});

carregarConfig();