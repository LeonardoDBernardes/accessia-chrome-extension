# AccessIA — Extensão Chrome

Extensão Chrome Manifest V3 para varredura automática de acessibilidade WCAG em páginas web.

## Funcionalidades

- **Scan passivo**: analisa cada página visitada em segundo plano
- **Scanner de favoritos**: varre todos os favoritos sequencialmente (um por vez, nunca paralelo)
- **Fila sequencial**: cooldown de 5 min por URL, máximo 200 itens
- **Skip automático**: ignora páginas de login/senha
- **Servidor 7040**: envia dados para `http://192.168.0.130:8450/analisar`
- **Badge**: mostra itens na fila no ícone da extensão
- **Notificações**: avisa quando análise terminar

## Atalhos

- `Alt+Shift+A` — Abrir configurações
- `Alt+Shift+S` — Analisar página atual agora

## Instalação

1. Abrir `chrome://extensions`
2. Ativar "Modo desenvolvedor"
3. Clicar "Carregar sem compactação"
4. Selecionar esta pasta

## Parte do projeto AccessIA

- **Pipeline** (servidor 7040): [nvda-acessibilidade-ia](https://github.com/LeonardoDBernardes/nvda-acessibilidade-ia)
- **RAG**: WCAG 2.0/2.1/2.2 + LBI + Decreto 5296 + Lei 10098 indexados em pgvector
- **Robô Windows**: em desenvolvimento (`robo-windows/`)
