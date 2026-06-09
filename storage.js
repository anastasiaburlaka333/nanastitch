window.Storage = class {
    constructor() {
        this.dbName = 'CrossStitchProDB';
        this.dbVersion = 1;
        this.db = null;
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                }
            };
            
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async saveProject(project) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = store.put(project);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getRecentProjects() {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result.slice(-5).reverse());
            request.onerror = () => reject(request.error);
        });
    }

    async exportToFile(project) {
        const data = JSON.stringify(project);
        const blob = new Blob([data], { type: 'application/json' });
        const fileName = `${project.name || 'pattern'}.xstitch`;
        
        try {
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'NanaStitch Project',
                        accept: {'application/json': ['.xstitch', '.json']}
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            }
        } catch(err) {
            if (err.name === 'AbortError') return;
            console.warn('showSaveFilePicker failed:', err);
        }
        
        // Fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const project = JSON.parse(e.target.result);
                    resolve(project);
                } catch (err) {
                    reject('Невірний формат файлу');
                }
            };
            reader.onerror = () => reject('Помилка читання файлу');
            reader.readAsText(file);
        });
    }
};
