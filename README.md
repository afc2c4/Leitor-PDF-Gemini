# Leitor-PDF-Gemini

Leitor-PDF-Gemini é uma aplicação web simples que permite visualizar PDFs em scroll contínuo, selecionar trechos de texto ou recortar áreas como imagens, e enviar essas seleções para o modelo Gemini (via API) para análise ou geração de texto.

Principais funcionalidades
- Visualização de PDFs com scroll contínuo (todas as páginas são renderizadas sequencialmente).
- Seleção de texto nativa com tooltip para "Explicar" e "Nota".
- Desenho de retângulos sobre o PDF para recorte de áreas (captura como imagens).
- Acumulação de trechos de texto e imagens para enviar em lote ao Gemini.
- Janela modal para exibir respostas formatadas (suporta blocos de código, fórmulas e tabelas).

Arquivos principais
- [index.html](index.html) — interface e estrutura da página.
- [styles.css](styles.css) — estilos customizados.
- [script.js](script.js) — lógica da aplicação, renderização de PDF e integração com Gemini.

Funções importantes em [script.js](script.js)
- [`renderPage`](script.js) — cria e renderiza cada página do PDF.
- [`attachDrawListeners`](script.js) — gerencia desenho/recorte por página.
- [`captureArea`](script.js) — extrai a área recortada do canvas como imagem.
- [`callGeminiText`](script.js) — envia prompts de texto para a API Gemini.
- [`callGeminiMultiModal`](script.js) — envia texto + múltiplas imagens para a API Gemini.
- [`formatGeminiResponse`](script.js) — formata a resposta do Gemini para exibição no modal.

Como usar (rápido)
1. Abra [index.html](index.html) no navegador (por exemplo, execute um servidor local: `python3 -m http.server` e acesse `http://localhost:8000`).
2. Clique em "Escolher arquivo" e carregue um PDF.
3. Mude entre os modos:
   - "Texto (Selecionar)" — selecione texto para ver o tooltip.
   - "Área (Desenhar)" — desenhe um retângulo para recortar uma imagem.
4. Use os botões do tooltip para adicionar à pilha (acumular) ou abrir o modal para enviar ao Gemini.
5. No modal, visualize a resposta retornada.

Nota sobre credenciais/API
- A chave da API está atualmente referenciada em [script.js](script.js) na constante `API_KEY`. Por segurança, recomenda-se removê-la do código e injetá‑la em tempo de execução (ex.: variáveis de ambiente, backend proxy ou arquivo de configuração fora do repositório).

Exemplo de fluxo
- Seleciona-se texto → clicar em "Explicar" → [`callGeminiText`](script.js) envia o prompt → resposta é formatada por [`formatGeminiResponse`](script.js) e exibida no modal.
- Desenha-se uma área → clicar em "Analisar Área" → imagem(s) são enviadas por [`callGeminiMultiModal`](script.js) → resultado exibido no modal.

Contribuição
- Abra uma issue ou PR com melhorias. Para edições rápidas, veja os arquivos referenciados acima: [index.html](index.html), [styles.css](styles.css) e [script.js](script.js).

Licença
- Projeto simples de demonstração — adapte conforme necessário.