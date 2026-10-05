/**
 * NEXUS - Application Bootstrapper
 * Orchestrates storage, cloud sync, UI initialization, and clean workspace startup.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[NEXUS] Initializing Cyber Command Core...');

    try {
        // 1. Initialize local storage (IndexedDB / LocalStorage)
        await window.nexusStorage.init();

        // 2. Clear any existing dummy/sample tasks and records
        await window.nexusStorage.purgeAllDummyData();

        // 3. Initialize Supabase Client
        window.nexusSupabase.init();

        // 4. Initialize Offline & Cloud Sync Engine
        window.nexusSync.init();

        // 5. Initialize UI, Theme, Particle Canvas, Audio, and Routing
        await window.nexusUI.init();

        console.log('[NEXUS] Core operational: PLAN → DO → COMPLETE → RECORD → REMEMBER');
    } catch (err) {
        console.error('[NEXUS] Boot sequence failed:', err);
    }
});
