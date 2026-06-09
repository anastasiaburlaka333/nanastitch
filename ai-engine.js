class AIEngine {
    constructor() {
        this.apiKey = localStorage.getItem('nanastitch-ai-key') || '';
        this.provider = localStorage.getItem('nanastitch-ai-provider') || 'gemini';
        this.isGenerating = false;
    }

    // Check if API is configured
    isConfigured() { return !!this.apiKey; }

    // Save settings
    saveSettings(apiKey, provider) {
        this.apiKey = apiKey;
        this.provider = provider;
        localStorage.setItem('nanastitch-ai-key', apiKey);
        localStorage.setItem('nanastitch-ai-provider', provider);
        this.updateUI();
    }

    // Test connection - call a simple Gemini API endpoint
    async testConnection() {
        if (!this.apiKey) {
            throw new Error('Ключ API не вказано');
        }
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${this.apiKey}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Помилка сервера (статус ${res.status})`);
            }
            return true;
        } catch (err) {
            console.error('AI connection test failed:', err);
            throw err;
        }
    }

    // Generate image from text prompt using Gemini's Imagen 3 (imagen-3.0-generate-002)
    async generateImage(prompt, style = 'realistic') {
        const fullPrompt = this._buildPatternPrompt(prompt, style);
        const body = {
            prompt: fullPrompt,
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio: "1:1"
        };

        const result = await this._callGemini('models/imagen-3.0-generate-002:generateImages', body);
        
        let base64Data = null;
        try {
            if (result.generatedImages && result.generatedImages[0] && result.generatedImages[0].image) {
                base64Data = result.generatedImages[0].image.imageBytes;
            }
        } catch (e) {
            console.error('Error parsing response candidate:', e);
        }

        if (!base64Data) {
            throw new Error('Модель не повернула зображення. Спробуйте інший опис або стиль.');
        }

        const mimeType = "image/jpeg";
        const binary = atob(base64Data);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(array)], { type: mimeType });

        return { imageBlob: blob, prompt: fullPrompt };
    }

    // Analyze image using Gemini Vision
    async analyzeImage(imageBlob, instruction) {
        const base64Data = await this._blobToBase64(imageBlob);
        const cleanBase64 = base64Data.split(',')[1];
        const mimeType = imageBlob.type || 'image/png';

        const body = {
            contents: [
                {
                    parts: [
                        { text: instruction },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: cleanBase64
                            }
                        }
                    ]
                }
            ]
        };

        const result = await this._callGemini('models/gemini-2.0-flash:generateContent', body);
        
        try {
            return result.candidates[0].content.parts[0].text;
        } catch (e) {
            throw new Error('Не вдалося розпізнати відповідь AI.');
        }
    }

    // Generate pattern from text description
    async generatePatternFromText(userPrompt, style, width, maxColors) {
        this.isGenerating = true;
        this.updateUI();
        try {
            const { imageBlob } = await this.generateImage(userPrompt, style);
            return { imageBlob, width, maxColors };
        } finally {
            this.isGenerating = false;
            this.updateUI();
        }
    }

    // AI-suggest optimal palette reduction
    async suggestPaletteReduction(imageBlob, currentColors, targetColors) {
        // currentColors is an array of objects: { code, hex, name, count }
        const colorsListStr = currentColors.map(c => `DMC ${c.code} (${c.name || ''}, HEX: ${c.hex}) - ${c.count} хрестиків`).join('\n');
        const instruction = `Перед тобою зображення вишивки та поточні DMC кольори, які використовуються у схемі:\n${colorsListStr}\n\nТобі потрібно вибрати щонайбільше ${targetColors} кольорів з цього списку, які найкраще збережуть деталі та загальний вигляд зображення, і відкинути або об'єднати рідкісні/менш важливі кольори. У відповіді поверни ТІЛЬКИ валідний JSON масив кодів DMC кольорів, які потрібно ЗАЛИШИТИ, без жодних коментарів, пояснень чи розмітки markdown. Наприклад: ["310", "white", "321", "413"]`;

        const responseText = await this.analyzeImage(imageBlob, instruction);
        try {
            // Clean markdown blocks if present
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const codes = JSON.parse(cleanText);
            if (Array.isArray(codes)) {
                return codes.map(String);
            }
            throw new Error('Формат відповіді не є масивом');
        } catch (e) {
            console.error('Failed to parse AI palette suggestion:', responseText, e);
            throw new Error('AI повернув некоректний формат палітри. Спробуйте ще раз.');
        }
    }

    // Helper: convert Blob to base64 data URL
    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Helper: build cross-stitch optimized prompt
    _buildPatternPrompt(userPrompt, style) {
        let baseInstructions = "cross-stitch pattern style, clean outlines, solid colors, limited palette, pixelated look, clear details, no text, no signatures, flat design.";
        switch(style) {
            case 'pixel':
                baseInstructions += " 8-bit pixel art style, high contrast, clean cell borders, retro game sprite.";
                break;
            case 'folk':
                baseInstructions += " traditional Slavic/Ukrainian folk embroidery style, symmetric ornaments, red and black dominates, geometric canvas textures.";
                break;
            case 'minimal':
                baseInstructions += " minimalist design, simple shapes, 4-8 colors max, high negative space, silhouette style.";
                break;
            case 'realistic':
            default:
                baseInstructions += " highly detailed cross-stitch look, rich tones, beautiful blend of threads, clear needlepoint structure.";
                break;
        }
        return `${userPrompt}. Beautiful, optimized for cross stitching. ${baseInstructions}`;
    }

    // Helper: call Gemini API with retry logic
    async _callGemini(endpoint, body) {
        if (!this.apiKey) {
            throw new Error('Ключ API не встановлено. Будь ласка, налаштуйте AI.');
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}?key=${this.apiKey}`;
        let lastError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                
                if (response.status === 429) {
                    throw new Error('Забагато запитів до API (Rate limit). Будь ласка, зачекайте.');
                }
                
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `Помилка API (статус ${response.status})`);
                }
                
                return await response.json();
            } catch (err) {
                lastError = err;
                if (attempt < 3) {
                    // Exponential backoff
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError;
    }

    // Show/hide the settings modal
    showSettings() { document.getElementById('modal-ai-settings')?.classList.add('active'); }
    hideSettings() { document.getElementById('modal-ai-settings')?.classList.remove('active'); }

    // Update UI state of AI buttons based on configuration
    updateUI() {
        const hasKey = this.isConfigured();
        const aiButtons = document.querySelectorAll('#btn-ai-generate, #btn-ai-optimize-palette, .tool-btn[data-tool="ai_enhance"], #btn-edit-bg-ai');
        
        aiButtons.forEach(btn => {
            if (hasKey) {
                btn.classList.remove('ai-disabled');
            } else {
                btn.classList.add('ai-disabled');
            }
        });

        // Update indicators
        const statusGens = document.querySelectorAll('#ai-gen-status, #ai-connection-status');
        statusGens.forEach(statusEl => {
            if (hasKey) {
                statusEl.className = 'ai-status connected';
                const span = statusEl.querySelector('span');
                if (span) {
                    if (statusEl.id === 'ai-gen-status') {
                        span.innerHTML = 'AI активовано. Готово до генерації.';
                    } else {
                        span.innerHTML = 'Підключено та налаштовано';
                    }
                }
                const icon = statusEl.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', 'check-circle');
                }
            } else {
                statusEl.className = 'ai-status disconnected';
                const span = statusEl.querySelector('span');
                if (span) {
                    if (statusEl.id === 'ai-gen-status') {
                        span.innerHTML = 'API не налаштовано. <a href="#" id="link-ai-setup" style="color:#7c3aed;">Налаштувати →</a>';
                    } else {
                        span.innerHTML = 'Не підключено';
                    }
                }
                const icon = statusEl.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', 'wifi-off');
                }
            }
        });

        // Re-init lucide icons for status indicators if lucide is loaded
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// Global instance
window.aiEngine = new AIEngine();
