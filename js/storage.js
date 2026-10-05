/**
 * NEXUS - Local Storage & IndexedDB Cache Engine
 * Provides offline-first persistence with localStorage fallback and synchronization queue.
 */

const DB_NAME = 'nexus_core_db';
const DB_VERSION = 1;

class NexusStorage {
    constructor() {
        this.db = null;
        this.isIndexedDBSupported = typeof window !== 'undefined' && 'indexedDB' in window;
        this.fallbackKeyPrefix = 'nexus_fallback_';
    }

    /**
     * Initialize IndexedDB database and object stores
     */
    async init() {
        if (!this.isIndexedDBSupported) {
            console.warn('[NEXUS Storage] IndexedDB not supported; using localStorage fallback.');
            this._seedDefaultCategories();
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Tasks store
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    taskStore.createIndex('planned_date', 'planned_date', { unique: false });
                    taskStore.createIndex('status', 'status', { unique: false });
                    taskStore.createIndex('category', 'category', { unique: false });
                    taskStore.createIndex('updated_at', 'updated_at', { unique: false });
                }

                // Daily records store (keyed by record_date e.g. '2026-10-05')
                if (!db.objectStoreNames.contains('daily_records')) {
                    const recordStore = db.createObjectStore('daily_records', { keyPath: 'record_date' });
                    recordStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    const catStore = db.createObjectStore('categories', { keyPath: 'id' });
                    catStore.createIndex('name', 'name', { unique: true });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }

                // Sync Queue store
                if (!db.objectStoreNames.contains('sync_queue')) {
                    const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('created_at', 'created_at', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this._seedDefaultCategories();
                resolve();
            };

            request.onerror = (event) => {
                console.error('[NEXUS Storage] IndexedDB open error:', event.target.error);
                this.isIndexedDBSupported = false;
                this._seedDefaultCategories();
                resolve();
            };
        });
    }

    /**
     * Seeds default categories if none exist
     */
    async _seedDefaultCategories() {
        const defaultCats = [
            { id: 'cat-study', name: 'Study', created_at: new Date().toISOString() },
            { id: 'cat-coding', name: 'Coding', created_at: new Date().toISOString() },
            { id: 'cat-college', name: 'College', created_at: new Date().toISOString() },
            { id: 'cat-project', name: 'Project', created_at: new Date().toISOString() },
            { id: 'cat-personal', name: 'Personal', created_at: new Date().toISOString() },
            { id: 'cat-other', name: 'Other', created_at: new Date().toISOString() }
        ];

        const existing = await this.getCategories();
        if (!existing || existing.length === 0) {
            for (const cat of defaultCats) {
                await this.saveCategory(cat, false);
            }
        }
    }

    // ==========================================
    // TASK OPERATIONS
    // ==========================================

    async getAllTasks() {
        if (!this.db) {
            return this._getFallback('tasks', []);
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('tasks', 'readonly');
            const store = tx.objectStore('tasks');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async getTasksByDate(dateStr) {
        if (!this.db) {
            const all = this._getFallback('tasks', []);
            return all.filter(t => t.planned_date === dateStr);
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('tasks', 'readonly');
            const store = tx.objectStore('tasks');
            const index = store.index('planned_date');
            const req = index.getAll(dateStr);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async getTasksForDateRange(startDateStr, endDateStr) {
        const all = await this.getAllTasks();
        return all.filter(t => t.planned_date >= startDateStr && t.planned_date <= endDateStr);
    }

    async getTaskById(id) {
        if (!this.db) {
            const all = this._getFallback('tasks', []);
            return all.find(t => t.id === id) || null;
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('tasks', 'readonly');
            const store = tx.objectStore('tasks');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async saveTask(task, queueSync = true) {
        if (!task.id) {
            task.id = this.generateUUID();
        }
        task.updated_at = new Date().toISOString();
        if (!task.created_at) {
            task.created_at = task.updated_at;
        }

        if (!this.db) {
            const all = this._getFallback('tasks', []);
            const idx = all.findIndex(t => t.id === task.id);
            if (idx >= 0) all[idx] = task;
            else all.push(task);
            this._setFallback('tasks', all);
            if (queueSync) await this.addToSyncQueue('UPSERT_TASK', 'task', task);
            return task;
        }

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction('tasks', 'readwrite');
            const store = tx.objectStore('tasks');
            const req = store.put(task);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        if (queueSync) {
            await this.addToSyncQueue('UPSERT_TASK', 'task', task);
        }
        return task;
    }

    async deleteTask(id, queueSync = true) {
        if (!this.db) {
            const all = this._getFallback('tasks', []);
            const filtered = all.filter(t => t.id !== id);
            this._setFallback('tasks', filtered);
            if (queueSync) await this.addToSyncQueue('DELETE_TASK', 'task', { id });
            return true;
        }

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction('tasks', 'readwrite');
            const store = tx.objectStore('tasks');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        if (queueSync) {
            await this.addToSyncQueue('DELETE_TASK', 'task', { id });
        }
        return true;
    }

    // ==========================================
    // DAILY RECORDS OPERATIONS ("What I Did Today")
    // ==========================================

    async getDailyRecord(dateStr) {
        if (!this.db) {
            const all = this._getFallback('daily_records', {});
            return all[dateStr] || null;
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('daily_records', 'readonly');
            const store = tx.objectStore('daily_records');
            const req = store.get(dateStr);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async getAllDailyRecords() {
        if (!this.db) {
            const obj = this._getFallback('daily_records', {});
            return Object.values(obj);
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('daily_records', 'readonly');
            const store = tx.objectStore('daily_records');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async saveDailyRecord(record, queueSync = true) {
        if (!record.record_date) {
            throw new Error('record_date is required');
        }
        if (!record.id) {
            record.id = this.generateUUID();
        }
        record.updated_at = new Date().toISOString();
        if (!record.created_at) {
            record.created_at = record.updated_at;
        }

        if (!this.db) {
            const all = this._getFallback('daily_records', {});
            all[record.record_date] = record;
            this._setFallback('daily_records', all);
            if (queueSync) await this.addToSyncQueue('UPSERT_RECORD', 'daily_record', record);
            return record;
        }

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction('daily_records', 'readwrite');
            const store = tx.objectStore('daily_records');
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        if (queueSync) {
            await this.addToSyncQueue('UPSERT_RECORD', 'daily_record', record);
        }
        return record;
    }

    // ==========================================
    // CATEGORY OPERATIONS
    // ==========================================

    async getCategories() {
        if (!this.db) {
            return this._getFallback('categories', []);
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('categories', 'readonly');
            const store = tx.objectStore('categories');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async saveCategory(cat, queueSync = true) {
        if (!cat.id) {
            cat.id = this.generateUUID();
        }
        if (!cat.created_at) {
            cat.created_at = new Date().toISOString();
        }

        if (!this.db) {
            const all = this._getFallback('categories', []);
            if (!all.some(c => c.name.toLowerCase() === cat.name.toLowerCase())) {
                all.push(cat);
                this._setFallback('categories', all);
                if (queueSync) await this.addToSyncQueue('UPSERT_CATEGORY', 'category', cat);
            }
            return cat;
        }

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction('categories', 'readwrite');
            const store = tx.objectStore('categories');
            const req = store.put(cat);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        if (queueSync) {
            await this.addToSyncQueue('UPSERT_CATEGORY', 'category', cat);
        }
        return cat;
    }

    // ==========================================
    // SETTINGS OPERATIONS
    // ==========================================

    async getSettings() {
        const defaultSettings = {
            id: 'nexus_user_settings',
            theme: 'cyberpunk',
            animations_enabled: true,
            sound_enabled: true,
            effects_3d_enabled: true,
            reduced_motion: false
        };

        if (!this.db) {
            return this._getFallback('settings', defaultSettings);
        }

        return new Promise((resolve) => {
            const tx = this.db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const req = store.get('nexus_user_settings');
            req.onsuccess = () => resolve(req.result || defaultSettings);
            req.onerror = () => resolve(defaultSettings);
        });
    }

    async saveSettings(settings, queueSync = false) {
        settings.id = 'nexus_user_settings';
        settings.updated_at = new Date().toISOString();

        if (!this.db) {
            this._setFallback('settings', settings);
            return settings;
        }

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const req = store.put(settings);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        if (queueSync) {
            await this.addToSyncQueue('UPSERT_SETTINGS', 'settings', settings);
        }
        return settings;
    }

    // ==========================================
    // SYNCHRONIZATION QUEUE
    // ==========================================

    async addToSyncQueue(action, entity, data) {
        const item = {
            action,
            entity,
            data,
            created_at: new Date().toISOString()
        };

        if (!this.db) {
            const queue = this._getFallback('sync_queue', []);
            item.id = Date.now() + Math.random();
            queue.push(item);
            this._setFallback('sync_queue', queue);
            return item;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('sync_queue', 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.add(item);
            req.onsuccess = () => {
                item.id = req.result;
                resolve(item);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async getSyncQueue() {
        if (!this.db) {
            return this._getFallback('sync_queue', []);
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('sync_queue', 'readonly');
            const store = tx.objectStore('sync_queue');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async removeSyncQueueItem(id) {
        if (!this.db) {
            const queue = this._getFallback('sync_queue', []);
            this._setFallback('sync_queue', queue.filter(i => i.id !== id));
            return;
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('sync_queue', 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async clearSyncQueue() {
        if (!this.db) {
            this._setFallback('sync_queue', []);
            return;
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('sync_queue', 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // ==========================================
    // BACKUP & RESTORE (EXPORT / IMPORT)
    // ==========================================

    async exportAllData() {
        const [tasks, dailyRecords, categories, settings] = await Promise.all([
            this.getAllTasks(),
            this.getAllDailyRecords(),
            this.getCategories(),
            this.getSettings()
        ]);

        return {
            nexus_version: '1.0.0',
            exported_at: new Date().toISOString(),
            data: {
                tasks,
                daily_records: dailyRecords,
                categories,
                settings
            }
        };
    }

    async importAllData(payload, { merge = true } = {}) {
        if (!payload || !payload.data) {
            throw new Error('Invalid NEXUS backup JSON format.');
        }

        const { tasks = [], daily_records = [], categories = [], settings = {} } = payload.data;

        if (!merge) {
            await this.clearAllData();
        }

        // Import categories
        for (const cat of categories) {
            await this.saveCategory(cat, true);
        }

        // Import tasks
        for (const task of tasks) {
            await this.saveTask(task, true);
        }

        // Import daily records
        for (const rec of daily_records) {
            await this.saveDailyRecord(rec, true);
        }

        // Import settings
        if (settings && Object.keys(settings).length > 0) {
            await this.saveSettings(settings, false);
        }

        return {
            importedTasks: tasks.length,
            importedRecords: daily_records.length,
            importedCategories: categories.length
        };
    }

    async clearAllData() {
        if (!this.db) {
            localStorage.removeItem(this.fallbackKeyPrefix + 'tasks');
            localStorage.removeItem(this.fallbackKeyPrefix + 'daily_records');
            localStorage.removeItem(this.fallbackKeyPrefix + 'categories');
            localStorage.removeItem(this.fallbackKeyPrefix + 'settings');
            localStorage.removeItem(this.fallbackKeyPrefix + 'sync_queue');
            await this._seedDefaultCategories();
            return;
        }

        const stores = ['tasks', 'daily_records', 'categories', 'settings', 'sync_queue'];
        for (const storeName of stores) {
            await new Promise((resolve) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        }
        await this._seedDefaultCategories();
    }

    /**
     * Purges all dummy/sample data from tasks and daily records
     */
    async purgeAllDummyData() {
        const tasks = await this.getAllTasks();
        const dummySeedIds = ['task-seed-1', 'task-seed-2', 'task-seed-3', 'task-seed-4', 'task-seed-5', 'imported-test-task-99'];
        const dummyTitles = [
            'DSA Practice',
            'C++ Practice',
            'College Assignment',
            'Fullstack Project Architecture',
            'Algorithm Revision & Dynamic Programming',
            'Future Milestone Review',
            'Automated Test Task 1',
            'Updated Test Task 1',
            'Offline Created Mission',
            'Imported Backup Task'
        ];

        for (const t of tasks) {
            if (dummySeedIds.includes(t.id) || dummyTitles.includes(t.title) || (t.id && t.id.startsWith('task-seed-'))) {
                await this.deleteTask(t.id, false);
            }
        }

        // Purge dummy daily records
        const records = await this.getAllDailyRecords();
        for (const r of records) {
            if (r.id === 'record-seed-1' || (r.what_i_did && r.what_i_did.includes('DSA assignment, practiced C++'))) {
                if (this.db) {
                    await new Promise((resolve) => {
                        const tx = this.db.transaction('daily_records', 'readwrite');
                        tx.objectStore('daily_records').delete(r.record_date);
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => resolve();
                    });
                } else {
                    const all = this._getFallback('daily_records', {});
                    delete all[r.record_date];
                    this._setFallback('daily_records', all);
                }
            }
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    _getFallback(key, defaultValue) {
        try {
            const raw = localStorage.getItem(this.fallbackKeyPrefix + key);
            return raw ? JSON.parse(raw) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    _setFallback(key, value) {
        try {
            localStorage.setItem(this.fallbackKeyPrefix + key, JSON.stringify(value));
        } catch (e) {
            console.error('[NEXUS Storage] Fallback storage write failed:', e);
        }
    }
}

// Export singleton instance
window.nexusStorage = new NexusStorage();
