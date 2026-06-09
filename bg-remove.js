class BackgroundRemover {
    constructor() {
        this.isReady = false;
        this.isProcessing = false;
        this.removeBackground = null;
    }

    // Load the library dynamically from CDN
    async init(onProgress) {
        if (this.isReady) return;
        try {
            if (onProgress) onProgress({ stage: 'loading', progress: 0.1 });
            // Dynamic import from CDN
            const module = await import('https://esm.sh/@imgly/background-removal@1.5.11');
            this.removeBackground = module.removeBackground || module.default;
            
            if (typeof this.removeBackground !== 'function') {
                // Check if it's nested or we need to access default differently
                if (module.default && typeof module.default.removeBackground === 'function') {
                    this.removeBackground = module.default.removeBackground;
                } else {
                    throw new Error('Не знайдено функцію removeBackground в імпортованому модулі');
                }
            }
            
            this.isReady = true;
            if (onProgress) onProgress({ stage: 'ready', progress: 1.0 });
        } catch (err) {
            console.error('Failed to load @imgly/background-removal:', err);
            if (window.app && typeof window.app.toast === 'function') {
                window.app.toast('Не вдалося завантажити бібліотеку видалення фону. Перевірте з\'єднання з інтернетом.', 'error');
            }
            throw err;
        }
    }

    // Remove background from an image blob
    async remove(imageBlob, onProgress) {
        if (this.isProcessing) {
            throw new Error('Процес видалення фону вже запущено');
        }
        this.isProcessing = true;
        
        try {
            if (!this.isReady) {
                await this.init(onProgress);
            }
            
            const config = {
                model: 'medium', // balanced speed/quality
                progress: (key, current, total) => {
                    if (onProgress) {
                        const percent = total > 0 ? (current / total) : 0.5;
                        onProgress({ stage: key, progress: percent });
                    }
                }
            };
            
            const resultBlob = await this.removeBackground(imageBlob, config);
            return resultBlob;
        } catch (err) {
            console.error('Background removal failed:', err);
            if (window.app && typeof window.app.toast === 'function') {
                window.app.toast('Помилка видалення фону: ' + (err.message || err), 'error');
            }
            throw err;
        } finally {
            this.isProcessing = false;
        }
    }

    // Remove background from a canvas element
    async removeFromCanvas(canvas, onProgress) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                try {
                    const noBgBlob = await this.remove(blob, onProgress);
                    const img = new Image();
                    img.onload = () => {
                        const newCanvas = document.createElement('canvas');
                        newCanvas.width = canvas.width;
                        newCanvas.height = canvas.height;
                        const ctx = newCanvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(newCanvas);
                    };
                    img.onerror = () => reject(new Error('Не вдалося завантажити результат видалення фону'));
                    img.src = URL.createObjectURL(noBgBlob);
                } catch (err) {
                    reject(err);
                }
            }, 'image/png');
        });
    }
}

window.bgRemover = new BackgroundRemover();
