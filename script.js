
        // --- Variáveis e Elementos ---
        const pdfUpload = document.getElementById('pdf-upload');
        const loader = document.getElementById('loader');
        const viewerContainer = document.getElementById('viewer-container');
        
        // MUDANÇA: Elementos de página única removidos
        // const pageContainer = document.getElementById('pdf-page-container');
        // const canvas = document.getElementById('pdf-canvas');
        // const textLayerEl = document.getElementById('text-layer');
        // const drawLayer = document.getElementById('draw-layer');
        
        // MUDANÇA: Paginação removida
        // const prevBtn = document.getElementById('prev-page');
        // ...

        // Modos
        const btnModeText = document.getElementById('mode-text');
        const btnModeArea = document.getElementById('mode-area');
        let currentMode = 'text'; // 'text' ou 'area'

        // Tooltips
        const tooltipText = document.getElementById('tooltip-text');
        const tooltipArea = document.getElementById('tooltip-area'); // <-- ADICIONADO
        const btnExplain = document.getElementById('btn-explain'); // <-- ADICIONADO
        const btnNote = document.getElementById('btn-note'); // <-- ADICIONADO
        const btnAdd = document.getElementById('btn-add'); 
        const btnClear = document.getElementById('btn-clear'); 
        const btnAnalyzeArea = document.getElementById('btn-analyze-area');
        const btnAnalyzeText = document.getElementById('btn-analyze-text'); // <-- NOVO
        const btnAddArea = document.getElementById('btn-add-area'); // <-- NOVO
        const btnClearArea = document.getElementById('btn-clear-area'); // <-- NOVO

        // Modal
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        const modalHeader = document.getElementById('modal-header');
        const modalBody = document.getElementById('modal-body');
        const modalInputArea = document.getElementById('modal-input-area');
        const customPromptInput = document.getElementById('custom-prompt');
        const btnSendPrompt = document.getElementById('btn-send-prompt');

        // Estado
        let pdfDoc = null;
        let currentSelectedText = "";
        let currentImageBase64 = null;
        let accumulatedText = ""; // <-- "PLANO B" TEXTO
        let accumulatedImages = []; // <-- "PLANO B" IMAGEM

        // MUDANÇA: Estado de desenho (isDrawing, startX, etc) foi movido
        // para dentro da função 'attachDrawListeners' para ser local
        // de cada página.

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

        // --- Lógica de Modos ---
        function setMode(mode) {
            currentMode = mode;
            
            if (mode === 'text') {
                btnModeText.className = "px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white text-blue-600 shadow-sm";
                btnModeArea.className = "px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors";
                viewerContainer.style.cursor = 'text';
                
                // MUDANÇA: Aplica a todas as camadas
                document.querySelectorAll('.textLayer').forEach(el => el.style.pointerEvents = 'auto');
                document.querySelectorAll('.draw-layer').forEach(el => el.style.pointerEvents = 'none');
                
            } else {
                btnModeArea.className = "px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white text-blue-600 shadow-sm";
                btnModeText.className = "px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors";
                viewerContainer.style.cursor = 'crosshair';

                // MUDANÇA: Aplica a todas as camadas
                document.querySelectorAll('.textLayer').forEach(el => el.style.pointerEvents = 'none');
                document.querySelectorAll('.draw-layer').forEach(el => el.style.pointerEvents = 'auto');

                window.getSelection().removeAllRanges();
                tooltipText.style.display = 'none';
            }
        }

        btnModeText.addEventListener('click', () => setMode('text'));
        btnModeArea.addEventListener('click', () => setMode('area'));

        // --- Carregar PDF (MUDANÇA: Lógica de Scroll Contínuo) ---
        pdfUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || file.type !== 'application/pdf') return;

            const fr = new FileReader();
            fr.onload = async function() { // MUDANÇA: Adicionado 'async'
                loader.classList.remove('hidden');
                viewerContainer.classList.add('hidden');
                viewerContainer.innerHTML = ''; // Limpa páginas antigas
                
                const data = new Uint8Array(this.result);
                pdfDoc = await pdfjsLib.getDocument({ data }).promise;
                
                // MUDANÇA: Loop para renderizar TODAS as páginas
                // MUDANÇA: Renderizar SEQUENCIALMENTE, não em paralelo (Promise.all)
                // Isso corrige o erro "object not resolved" (pattern_pXX) em PDFs complexos.
                
                const fragment = document.createDocumentFragment();
                
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    // renderPage agora cria, renderiza E retorna o elemento
                    // Usamos await DENTRO do loop para forçar a renderização sequencial.
                    const pageEl = await renderPage(i, pdfDoc);
                    fragment.appendChild(pageEl);
                }
                
                // Adiciona todas as páginas de uma vez ao container
                viewerContainer.appendChild(fragment);
                
                loader.classList.add('hidden');
                viewerContainer.classList.remove('hidden');
                
                // Re-aplica o modo atual (importante para novas camadas)
                setMode(currentMode);
            };
            fr.readAsArrayBuffer(file);
        });

        /**
         * MUDANÇA: Esta função agora CRIA elementos para uma página
         * e retorna o container da página pronto.
         */
        async function renderPage(num, doc) {
            // MUDANÇA: Adicionado try...catch para capturar erros de renderização
            try {
                const page = await doc.getPage(num);
                const viewport = page.getViewport({ scale: 1.5 });

                // 1. Criar Page Container
                const pageContainer = document.createElement('div');
                pageContainer.id = `page-container-${num}`;
                pageContainer.className = 'pdf-page-container'; // MUDANÇA: Classe
                pageContainer.style.width = `${viewport.width}px`;
                pageContainer.style.height = `${viewport.height}px`;
                pageContainer.tabIndex = -1; // MUDANÇA: Impede o container de "roubar" o foco

                // 2. Criar Canvas
                const canvas = document.createElement('canvas');
                canvas.id = `pdf-canvas-${num}`;
                canvas.className = 'pdf-canvas'; // MUDANÇA: Classe
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                pageContainer.appendChild(canvas);

                // 3. Criar Text Layer
                const textLayerEl = document.createElement('div');
                textLayerEl.id = `text-layer-${num}`;
                textLayerEl.className = 'textLayer'; // MUDANÇA: Classe
                textLayerEl.style.width = `${viewport.width}px`;
                textLayerEl.style.height = `${viewport.height}px`;
                pageContainer.appendChild(textLayerEl);

                // 4. Criar Draw Layer
                const drawLayer = document.createElement('div');
                drawLayer.id = `draw-layer-${num}`;
                drawLayer.className = 'draw-layer'; // MUDANÇA: Classe
                drawLayer.dataset.pageNum = num; // Guarda a referência da página
                pageContainer.appendChild(drawLayer);

                // 5. Renderizar Canvas
                const ctx = canvas.getContext('2d');
                // MUDANÇA: Adicionado .catch() para a promessa de renderização (corrige UNHANDLEDREJECTION)
                await page.render({ canvasContext: ctx, viewport }).promise.catch(renderErr => {
                    console.error(`Erro ao renderizar canvas da página ${num}:`, renderErr);
                });

                // 6. Renderizar Camada de Texto
                const textContent = await page.getTextContent();
                const eventBus = new pdfjsViewer.EventBus();
                const textLayerBuilder = new pdfjsViewer.TextLayerBuilder({
                    textLayerDiv: textLayerEl,
                    eventBus: eventBus,
                    pageIndex: num - 1,
                    viewport: viewport
                });
                textLayerBuilder.setTextContent(textContent);
                
                // MUDANÇA: try...catch para o render do textLayer (alguns PDFs falham aqui)
                try {
                    textLayerBuilder.render();
                } catch (textErr) {
                    console.error(`Erro ao renderizar camada de texto da página ${num}:`, textErr);
                }

                // 7. MUDANÇA: Anexar listeners de desenho a ESTA camada específica
                attachDrawListeners(drawLayer, canvas);

                // 8. Retorna o elemento pronto
                return pageContainer;
            
            } catch (pageErr) {
                console.error(`Erro fatal ao carregar página ${num}:`, pageErr);
                // Retorna um container de erro para não quebrar o loop
                const errorContainer = document.createElement('div');
                errorContainer.className = 'pdf-page-container text-red-500 p-4 bg-red-50 border border-red-300';
                errorContainer.style.width = '100%';
                errorContainer.style.height = '100px';
                errorContainer.textContent = `Falha ao carregar página ${num}. O PDF pode estar corrompido.`;
                return errorContainer;
            }
        }
        
        // MUDANÇA: Paginação removida
        // prevBtn.addEventListener('click', ...);
        // nextBtn.addEventListener('click', ...);

        // --- Lógica de Seleção de Texto (Modo Texto) ---
        // MUDANÇA: Mover o listener para 'document' e adicionar 'setTimeout'
        // para tentar corrigir bugs de seleção nativa.
        document.addEventListener('mouseup', (e) => {
            // Só executa se estivermos no modo texto
            if (currentMode !== 'text') return;

            // Espera um instante para a seleção do browser "estabilizar"
            setTimeout(() => {
                const sel = window.getSelection();
                
                // 1. Verifica se há uma seleção
                if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
                    tooltipText.style.display = 'none';
                    return;
                }

                // 2. Verifica se a seleção começou dentro do nosso viewer
                // (Evita capturar seleção do resto da página)
                if (!sel.anchorNode || !viewerContainer.contains(sel.anchorNode.parentElement)) {
                     // Não limpa ativamente se a seleção começou fora
                     // Mas também não mostra o nosso tooltip
                     return;
                }
                
                // 3. Se a seleção "ancora" no viewer, verifica se tem texto
                const txt = sel.toString().trim();
                
                if (txt.length > 0) {
                    currentSelectedText = txt;
                    
                    // MUDANÇA: Lógica de acumulação (Plano B)
                    // Atualiza a UI dos botões baseado no estado
                    if (accumulatedText.length > 0) {
                        btnExplain.textContent = "Explicar (TUDO)";
                        btnNote.textContent = "Nota (TUDO)";
                        btnAdd.textContent = "[+] Adicionar Mais";
                        btnClear.style.display = 'block';
                    } else {
                        btnExplain.textContent = "Explicar";
                        btnNote.textContent = "Nota";
                        btnAdd.textContent = "[+] Adicionar";
                        btnClear.style.display = 'none';
                    }
                    
                    // MUDANÇA: Calcula posição relativa à PÁGINA usando pageX/pageY
                    const finalLeft = e.pageX + 10;
                    const finalTop = e.pageY + 10;

                    tooltipText.style.left = `${finalLeft}px`;
                    tooltipText.style.top = `${finalTop}px`;
                    tooltipText.style.display = 'flex';
                    tooltipArea.style.display = 'none';
                } else {
                    tooltipText.style.display = 'none';
                }
            }, 50); // 50ms de delay
        });


        /**
         * MUDANÇA: Nova função para anexar listeners de desenho
         * a uma camada de desenho específica.
         * As variáveis de estado (isDrawing, etc) são locais (via closure).
         */
        function attachDrawListeners(drawLayer, canvasElement) {
            let isDrawing = false;
            let startX, startY;
            let selectionRect = null;

            drawLayer.addEventListener('mousedown', (e) => {
                if (currentMode !== 'area') return;
                isDrawing = true;
                
                // Limpa APENAS esta camada
                drawLayer.innerHTML = ''; 
                tooltipArea.style.display = 'none';

                // Limpa seleção de texto residual
                window.getSelection().removeAllRanges();
                tooltipText.style.display = 'none';

                const rect = drawLayer.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;

                selectionRect = document.createElement('div');
                selectionRect.className = 'selection-box';
                selectionRect.style.left = `${startX}px`;
                selectionRect.style.top = `${startY}px`;
                selectionRect.style.width = '0px';
                selectionRect.style.height = '0px';
                drawLayer.appendChild(selectionRect);
            });

            drawLayer.addEventListener('mousemove', (e) => {
                if (!isDrawing) return;
                const rect = drawLayer.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;

                const width = currentX - startX;
                const height = currentY - startY;

                selectionRect.style.width = `${Math.abs(width)}px`;
                selectionRect.style.height = `${Math.abs(height)}px`;
                selectionRect.style.left = `${width < 0 ? currentX : startX}px`;
                selectionRect.style.top = `${height < 0 ? currentY : startY}px`;
            });

            drawLayer.addEventListener('mouseup', (e) => { // <-- 'e' (evento) é capturado aqui
                if (!isDrawing) return;
                isDrawing = false;

                const width = parseInt(selectionRect.style.width);
                const height = parseInt(selectionRect.style.height);
                const left = parseInt(selectionRect.style.left);
                const top = parseInt(selectionRect.style.top);

                if (width > 10 && height > 10) {
                    // 1. MUDANÇA: Recortar Imagem
                    captureArea(canvasElement, left, top, width, height); // Seta currentImageBase64

                    // 2. MUDANÇA: Lógica de acumulação (Plano B) para Imagens
                    if (accumulatedImages.length > 0) {
                        btnAnalyzeText.textContent = "Analisar (TUDO)";
                        btnAddArea.textContent = "[+] Adicionar Mais";
                        btnClearArea.style.display = 'block';
                    } else {
                        btnAnalyzeText.textContent = "Analisar Área";
                        btnAddArea.textContent = "[+] Adicionar";
                        btnClearArea.style.display = 'none';
                    }
                    
                    // 3. MUDANÇA: Calcular posição do tooltip
                    const finalLeft = e.pageX + 10;
                    const finalTop = e.pageY + 10;

                    tooltipArea.style.left = `${finalLeft}px`;
                    tooltipArea.style.top = `${finalTop}px`; 
                    tooltipArea.style.display = 'flex'; // <-- MUDANÇA: flex
                    
                } else {
                    drawLayer.innerHTML = ''; // Limpa desenho pequeno
                }
            });
        }

        /**
         * MUDANÇA: A função agora aceita o 'canvas' de onde recortar
         */
        function captureArea(canvas, x, y, w, h) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const ctx = tempCanvas.getContext('2d');

            // MUDANÇA: Usa o 'canvas' fornecido como fonte
            ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

            const dataUrl = tempCanvas.toDataURL('image/png');
            currentImageBase64 = dataUrl;
        }

        // --- Modal & Gemini ---
        // (Sem mudanças nesta seção)

        // MUDANÇA: Listeners atualizados para acumulação
        btnExplain.addEventListener('click', () => {
            // Se temos texto acumulado, usamos ele + o atual. Senão, só o atual.
            let textToSend = (accumulatedText.length > 0) 
                ? accumulatedText + "\n...\n" + currentSelectedText 
                : currentSelectedText;
            
            openTextModal('explain', textToSend);
            accumulatedText = ""; // Reseta
        });

        btnNote.addEventListener('click', () => {
            let textToSend = (accumulatedText.length > 0)
                ? accumulatedText + "\n...\n" + currentSelectedText
                : currentSelectedText;

            openTextModal('note', textToSend);
            accumulatedText = ""; // Reseta
        });
        
        // Listeners Texto (Plano B)
        btnAdd.addEventListener('click', () => {
            accumulatedText += (accumulatedText.length > 0 ? "\n...\n" : "") + currentSelectedText; 
            tooltipText.style.display = 'none'; 
        });

        btnClear.addEventListener('click', () => {
            accumulatedText = ""; 
            tooltipText.style.display = 'none'; 
        });

        
        // Listeners Área (Plano B)
        btnAnalyzeArea.addEventListener('click', () => {
            // Adiciona a imagem atual (acabou de ser desenhada) à lista
            if (currentImageBase64) {
                accumulatedImages.push(currentImageBase64);
                currentImageBase64 = null;
            }
            if (accumulatedImages.length === 0) return; // Não abre se vazio

            tooltipArea.style.display = 'none';
            openImageModal(); // Modal vai ler 'accumulatedImages'
        });

        btnAddArea.addEventListener('click', () => {
            if (currentImageBase64) {
                accumulatedImages.push(currentImageBase64);
                currentImageBase64 = null; 
            }
            tooltipArea.style.display = 'none';
        });

        btnClearArea.addEventListener('click', () => {
            accumulatedImages = [];
            currentImageBase64 = null;
            tooltipArea.style.display = 'none';
        });


        document.getElementById('modal-close').addEventListener('click', () => modalOverlay.classList.add('hidden'));
        
        btnSendPrompt.addEventListener('click', async () => {
            const userQuestion = customPromptInput.value.trim();
            if (!userQuestion || accumulatedImages.length === 0) return; // MUDANÇA: Checa array
            
            setModalLoading();
            try {
                // MUDANÇA: Envia o array de imagens
                const response = await callGeminiMultiModal(userQuestion, accumulatedImages);
                modalBody.innerHTML = formatGeminiResponse(response);
            } catch (e) {
                showErrorInModal(e);
            } finally {
                accumulatedImages = []; // Limpa DEPOIS da tentativa
            }
        });

        function setModalLoading() {
            modalBody.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10">
                    <div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-r-transparent"></div>
                    <span class="mt-4 text-gray-600">Consultando Gemini...</span>
                </div>`;
        }

        // MUDANÇA: Função agora aceita o texto a ser enviado
        function openTextModal(type, textToSend) {
            modalInputArea.classList.add('hidden');
            modalOverlay.classList.remove('hidden');
            modalContent.style.position = 'relative'; modalContent.style.top = 'auto'; modalContent.style.left = 'auto';
            setModalLoading();

            // MUDANÇA: Usa 'textToSend' vindo do parâmetro
            let prompt = "";
            if (type === 'explain') prompt = `Explique este(s) trecho(s) de forma didática:\n"${textToSend}"`;
            else prompt = `Crie uma nota técnica resumida sobre este(s) trecho(s):\n"${textToSend}"`;

            callGeminiText(prompt)
                .then(text => modalBody.innerHTML = formatGeminiResponse(text))
                .catch(e => showErrorInModal(e));
        }

        function openImageModal() {
            modalInputArea.classList.remove('hidden');
            modalOverlay.classList.remove('hidden');
            modalContent.style.position = 'relative'; modalContent.style.top = 'auto'; modalContent.style.left = 'auto';
            customPromptInput.value = ""; 
            customPromptInput.focus();

            // MUDANÇA: Gerar previews para TODAS as imagens acumuladas
            let previewsHTML = accumulatedImages.map((imgSrc, index) => `
                <div class="mb-3">
                    <h4 class="font-bold text-xs mb-1 uppercase text-gray-500">Imagem ${index + 1}:</h4>
                    <img src="${imgSrc}" class="cropped-image-preview" />
                </div>
            `).join('');

            modalBody.innerHTML = `
                <!-- MUDANÇA: Wrapper para scroll se muitas imagens -->
                <div class="max-h-[300px] overflow-y-auto bg-gray-50 p-3 rounded-md border">
                    ${previewsHTML}
                </div>
                <p class="text-gray-500 italic text-sm mt-3">Digite sua pergunta sobre a(s) imagem(ns) acima e clique em Enviar.</p>
            `;
        }

        function showErrorInModal(e) {
            modalBody.innerHTML = `<div class="text-red-600 p-4 bg-red-50 rounded">Erro: ${e.message}</div>`;
        }

        // --- APIs Gemini ---
        // (Sem mudanças)
        const API_KEY = "AIzaSyCYBZ3BVAIl8IwczkNuEulDxUHck_wcG8M"; // Inserido pelo ambiente

        async function callGeminiText(textPrompt) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
            const payload = { contents: [{ parts: [{ text: textPrompt }] }] };
            
            const res = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Erro na API Gemini');
            }
            const data = await res.json();
            if(data.error) throw new Error(data.error.message);
            if (!data.candidates || !data.candidates[0].content) {
                console.warn("Resposta inesperada da API:", data);
                throw new Error("Resposta inválida do Gemini.");
            }
            return data.candidates[0].content.parts[0].text;
        }

        // MUDANÇA: Função agora aceita um ARRAY de imagens
        async function callGeminiMultiModal(textPrompt, base64ImagesArray) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
            
            // MUDANÇA: Construir 'parts' dinamicamente
            const parts = [{ text: textPrompt }];
            
            for (const base64DataUrl of base64ImagesArray) {
                const base64Raw = base64DataUrl.split(',')[1];
                parts.push({
                    inlineData: { mimeType: "image/png", data: base64Raw }
                });
            }

            const payload = {
                contents: [{ parts: parts }] // <-- MUDANÇA
            };

            const res = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Erro na API Gemini');
            }
            const data = await res.json();
            if(data.error) throw new Error(data.error.message);
            if (!data.candidates || !data.candidates[0].content) {
                console.warn("Resposta inesperada da API:", data);
                throw new Error("Resposta inválida do Gemini.");
            }
            return data.candidates[0].content.parts[0].text;
        }

        // --- Formatador e Arrastar ---
        // (Sem mudanças)
        
        function formatGeminiResponse(text) {
            let blockIndex = 0;
            let placeholders = [];
            let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Escapa HTML inicial

            // 1. Proteger Blocos de Código (```...```)
             html = html.replace(/```([\s\S]*?)```/g, (match, content) => {
                const id = blockIndex++;
                const safeContent = content.trim(); // Já escapado
                const formattedBlock = `<pre class="math-block my-2 p-3 bg-gray-800 text-white rounded">${safeContent}</pre>`;
                placeholders.push(formattedBlock);
                return `___BLOCK_CODE_${id}___`;
            });

            // 2. Proteger Blocos de Matemática ($$...$$)
            html = html.replace(/\$\$(.*?)\$\$/gs, (match, content) => {
                const id = blockIndex++;
                const safeContent = content.trim(); // Já escapado
                const formattedBlock = `<div class="math-block my-2">${safeContent}</div>`;
                placeholders.push(formattedBlock);
                return `___BLOCK_MATH_${id}___`;
            });

            // 3. Proteger Matemática Inline ($...$)
            html = html.replace(/\$(.*?)\$/g, (match, content) => {
                if (content.match(/^\s|\s$/) || content.includes('\n')) return match;
                const id = blockIndex++;
                const safeContent = content.trim(); // Já escapado
                const formattedInline = `<span class="math-inline">${safeContent}</span>`;
                placeholders.push(formattedInline);
                return `___BLOCK_MATH_${id}___`;
            });

            // 4. Proteger Código Inline (`...`)
            html = html.replace(/`(.*?)`/g, (match, content) => {
                const id = blockIndex++;
                const safeContent = content.trim(); // Já escapado
                const formattedInline = `<span class="math-inline">${safeContent}</span>`;
                placeholders.push(formattedInline);
                return `___BLOCK_CODE_${id}___`;
            });

            // 5. Formatar Tabelas
            html = html.replace(
                /(?:^\s*\|[^\n]+\|\r?\n)((?:\|\s*:?-+:?\s*)+\|\r?\n)((?:^\s*\|[^\n]+\|\r?\n)+)/gm,
                (tableMatch) => {
                    const id = blockIndex++;
                    const lines = tableMatch.trim().split('\n');
                    const headerLine = lines[0];
                    const bodyLines = lines.slice(2);

                    let tableHtml = '<div class="overflow-x-auto my-4 rounded-lg shadow-md border border-gray-200">';
                    tableHtml += '<table class="min-w-full divide-y divide-gray-200">';
                    
                    const headers = headerLine.trim().slice(1, -1).split('|').map(h => h.trim());
                    tableHtml += '<thead class="bg-gray-100">';
                    tableHtml += '<tr>';
                    headers.forEach(h => {
                        tableHtml += `<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`;
                    });
                    tableHtml += '</tr></thead>';
                    
                    tableHtml += '<tbody class="divide-y divide-gray-200">';
                    bodyLines.forEach((rowLine, rowIndex) => {
                        const cells = rowLine.trim().slice(1, -1).split('|').map(c => c.trim());
                        const trClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'; 
                        tableHtml += `<tr class="${trClass} hover:bg-gray-100">`;
                        cells.forEach(c => {
                            const cellContent = c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                            tableHtml += `<td class="px-6 py-4 whitespace-normal text-sm text-gray-800">${cellContent}</td>`;
                        });
                        tableHtml += '</tr>';
                    });
                    
                    tableHtml += '</tbody></table></div>';

                    placeholders.push(tableHtml);
                    return `___BLOCK_TABLE_${id}___`;
                }
            );

            // 6. Formatar Markdown (Títulos, Regras, Listas, Negrito, Itálico)
            html = html
                .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-4 mb-1">$1</h1>')
                .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-gray-900 mt-3 mb-1">$1</h2>')
                .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-gray-900 mt-2 mb-1">$1</h3>')
                .replace(/^#### (.*$)/gm, '<h4 class="text-base font-bold text-gray-900 mt-1 mb-1">$1</h4>')
                .replace(/^(---|---|\*\*\*)\s*$/gm, '<hr class="my-4 border-gray-200">')
                .replace(/^(\*|-)\s(.*$)/gm, '<li class="ml-5 list-disc list-outside">$2</li>')
                .replace(/^\d+\.\s(.*$)/gm, '<li class="ml-5 list-decimal list-outside">$1</li>')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

            // 7. Agrupar <li>s em <ul>s e <ol>s
            html = html.replace(/(<li class="ml-5 list-disc list-outside">.*?<\/li>)(?:\s*<li class="ml-5 list-disc list-outside">.*?<\/li>)*/gs, (match) => {
                return `<ul class="my-2">${match}</ul>`;
            });
            html = html.replace(/(<li class="ml-5 list-decimal list-outside">.*?<\/li>)(?:\s*<li class="ml-5 list-decimal list-outside">.*?<\/li>)*/gs, (match) => {
                return `<ol class="my-2">${match}</ol>`;
            });

            // 8. Restaurar Blocos Protegidos
            html = html.replace(/___BLOCK_CODE_(\d+)___/g, (match, id) => placeholders[parseInt(id)]);
            html = html.replace(/___BLOCK_MATH_(\d+)___/g, (match, id) => placeholders[parseInt(id)]);
            html = html.replace(/___BLOCK_TABLE_(\d+)___/g, (match, id) => placeholders[parseInt(id)]);
            
            // 9. Limpar linhas vazias entre elementos de bloco (o pre-line cuida disso)
            
            return `<div class="text-gray-700">${html}</div>`;
        }


        // Drag Modal
        let isDragging = false;
        let offX, offY;
        modalHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = modalContent.getBoundingClientRect();
            offX = e.clientX - rect.left; offY = e.clientY - rect.top;
            modalContent.style.position = 'absolute';
            modalContent.style.left = rect.left + 'px'; modalContent.style.top = rect.top + 'px';
            modalContent.style.margin = '0'; 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            modalContent.style.left = (e.clientX - offX) + 'px';
            modalContent.style.top = (e.clientY - offY) + 'px';
        });
        document.addEventListener('mouseup', () => isDragging = false);
