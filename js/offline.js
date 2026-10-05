/**
 * NEXUS - Offline Engine & Automatic Cloud Sync
 * Manages network listeners, offline queue processing, and bidirectional database synchronization.
 */

class NexusSyncEngine {
    constructor() {
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.listeners = [];
        this.syncIntervalId = null;
    }

    /**
     * Initialize event listeners and start sync loop
     */
    init() {
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));

        // Periodically verify ping if online
        this.syncIntervalId = setInterval(() => {
            if (this.isOnline && !this.isSyncing && window.nexusSupabase.isConfigured()) {
                this.processSyncQueue();
            }
        }, 30000); // Check every 30 seconds

        // Initial sync attempt if already online
        if (this.isOnline) {
            setTimeout(() => this.processSyncQueue(true), 1500);
        }
    }

    /**
     * Subscribe to network & sync state changes
     */
    subscribe(callback) {
        this.listeners.push(callback);
        // Fire immediately with current state
        callback({
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime
        });
    }

    notifyListeners() {
        const state = {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime
        };
        for (const cb of this.listeners) {
            try { cb(state); } catch (e) { console.error(e); }
        }
    }

    /**
     * Network online / offline event handler
     */
    async handleNetworkChange(isOnline) {
        this.isOnline = isOnline;
        this.notifyListeners();

        if (window.nexusUI) {
            if (isOnline) {
                window.nexusUI.showToast("Connection restored. Syncing records...", "info");
                await this.processSyncQueue(true);
            } else {
                window.nexusUI.showToast("Offline mode. Changes will sync when you're back online.", "warning");
            }
        }
    }

    /**
     * Process pending offline changes from sync queue and synchronize with Supabase
     */
    async processSyncQueue(fullSync = false) {
        if (this.isSyncing) return;
        if (!navigator.onLine) {
            this.isOnline = false;
            this.notifyListeners();
            return;
        }

        if (!window.nexusSupabase || !window.nexusSupabase.isConfigured()) {
            // Local-only mode
            return;
        }

        this.isSyncing = true;
        this.notifyListeners();

        try {
            const queue = await window.nexusStorage.getSyncQueue();

            if (queue && queue.length > 0) {
                for (const item of queue) {
                    let result;
                    try {
                        switch (item.action) {
                            case 'UPSERT_TASK':
                                result = await window.nexusSupabase.upsertTask(item.data);
                                break;
                            case 'DELETE_TASK':
                                result = await window.nexusSupabase.deleteTask(item.data.id);
                                break;
                            case 'UPSERT_RECORD':
                                result = await window.nexusSupabase.upsertDailyRecord(item.data);
                                break;
                            case 'UPSERT_CATEGORY':
                                result = await window.nexusSupabase.upsertCategory(item.data);
                                break;
                            case 'UPSERT_SETTINGS':
                                result = await window.nexusSupabase.upsertSettings(item.data);
                                break;
                        }

                        if (result && result.error) {
                            console.error('[NEXUS Sync] Error syncing queue item:', item, result.error);
                            // If network failed, abort rest of queue for now
                            if (result.error.message && result.error.message.includes('fetch')) {
                                this.isOnline = false;
                                break;
                            }
                        } else {
                            // Successfully synced, remove from queue
                            await window.nexusStorage.removeSyncQueueItem(item.id);
                        }
                    } catch (itemErr) {
                        console.error('[NEXUS Sync] Item processing failed:', itemErr);
                        break;
                    }
                }
            }

            // If full sync requested (e.g. after coming online or upon initial boot), pull remote changes
            if (fullSync) {
                await this.pullRemoteData();
            }

            this.lastSyncTime = new Date();
            if (queue && queue.length > 0 && window.nexusUI) {
                window.nexusUI.showToast("Synced successfully.", "success");
            }
        } catch (err) {
            console.error('[NEXUS Sync] Sync cycle encountered error:', err);
        } finally {
            this.isSyncing = false;
            this.notifyListeners();
        }
    }

    /**
     * Pulls latest tasks, daily records, and categories from Supabase into local storage
     */
    async pullRemoteData() {
        if (!window.nexusSupabase || !window.nexusSupabase.isConfigured()) return;

        try {
            // 1. Pull Categories
            const catRes = await window.nexusSupabase.fetchCategories();
            if (catRes.data && catRes.data.length > 0) {
                for (const cat of catRes.data) {
                    await window.nexusStorage.saveCategory(cat, false);
                }
            }

            // 2. Pull Tasks
            const taskRes = await window.nexusSupabase.fetchAllTasks();
            if (taskRes.data && taskRes.data.length > 0) {
                for (const t of taskRes.data) {
                    await window.nexusStorage.saveTask(t, false);
                }
            }

            // 3. Pull Daily Records
            const recRes = await window.nexusSupabase.fetchAllDailyRecords();
            if (recRes.data && recRes.data.length > 0) {
                for (const r of recRes.data) {
                    await window.nexusStorage.saveDailyRecord(r, false);
                }
            }
        } catch (err) {
            console.error('[NEXUS Sync] Pull remote data error:', err);
        }
    }
}

// Export singleton instance
window.nexusSync = new NexusSyncEngine();
