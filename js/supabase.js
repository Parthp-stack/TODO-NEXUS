/**
 * NEXUS - Supabase Client Bridge
 * Handles direct PostgreSQL interaction via Supabase JS client.
 * Never hardcodes secrets; loads configuration from user settings or environment placeholders.
 */

class NexusSupabase {
    constructor() {
        this.client = null;
        this.defaultUrl = 'https://dhuhedcqqiwblzpdefgr.supabase.co';
        this.defaultAnonKey = 'sb_publishable__ucc7YM0IHkAhwnpoziNbw_zF5ilfj_';
        this.url = '';
        this.anonKey = '';
        this.isConnected = false;
        this.storageKeyUrl = 'nexus_supabase_url';
        this.storageKeyAnon = 'nexus_supabase_anon_key';
    }

    /**
     * Initializes Supabase client from stored configuration, defaults, or parameters
     */
    init(customUrl, customKey) {
        this.url = (customUrl || localStorage.getItem(this.storageKeyUrl) || this.defaultUrl || '').trim();
        this.anonKey = (customKey || localStorage.getItem(this.storageKeyAnon) || this.defaultAnonKey || '').trim();

        if (this.url && this.anonKey && window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                this.client = window.supabase.createClient(this.url, this.anonKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false
                    }
                });
                return true;
            } catch (err) {
                console.error('[NEXUS Supabase] Client initialization failed:', err);
                this.client = null;
                return false;
            }
        } else {
            this.client = null;
            return false;
        }
    }

    /**
     * Checks if Supabase credentials are configured
     */
    isConfigured() {
        return !!(this.client && this.url && this.anonKey);
    }

    /**
     * Save configuration credentials to localStorage
     */
    saveCredentials(url, anonKey) {
        this.url = url.trim();
        this.anonKey = anonKey.trim();
        localStorage.setItem(this.storageKeyUrl, this.url);
        localStorage.setItem(this.storageKeyAnon, this.anonKey);
        return this.init(this.url, this.anonKey);
    }

    /**
     * Test connection to Supabase instance
     */
    async testConnection(testUrl, testKey) {
        const urlToTest = (testUrl || this.url || '').trim();
        const keyToTest = (testKey || this.anonKey || '').trim();

        if (!urlToTest || !keyToTest) {
            return { success: false, message: 'URL and Anon Key are required.' };
        }

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            return { success: false, message: 'Supabase library not loaded. Check internet connection.' };
        }

        try {
            const testClient = window.supabase.createClient(urlToTest, keyToTest, {
                auth: { persistSession: false }
            });

            // Perform lightweight query on categories or tasks
            const { data, error } = await testClient
                .from('categories')
                .select('id, name')
                .limit(1);

            if (error) {
                // If table doesn't exist yet, provide helpful message
                if (error.code === '42P01') {
                    return {
                        success: false,
                        message: 'Connected to Supabase, but schema tables are missing. Please execute supabase/schema.sql in your Supabase SQL Editor.'
                    };
                }
                return { success: false, message: error.message || 'Supabase query failed.' };
            }

            this.isConnected = true;
            return { success: true, message: 'Connected successfully to Supabase PostgreSQL database!' };
        } catch (err) {
            return { success: false, message: err.message || 'Network error connecting to Supabase.' };
        }
    }

    // ==========================================
    // TASKS CRUD
    // ==========================================

    async fetchAllTasks() {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('tasks')
            .select('*')
            .order('planned_date', { ascending: true })
            .order('start_time', { ascending: true, nullsFirst: false });
    }

    async upsertTask(task) {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        
        // Clean payload for Postgres
        const payload = {
            id: task.id,
            title: task.title,
            description: task.description || '',
            planned_date: task.planned_date,
            original_planned_date: task.original_planned_date || task.planned_date,
            start_time: task.start_time || null,
            end_time: task.end_time || null,
            priority: task.priority || 'medium',
            category: task.category || 'Personal',
            status: task.status || 'pending',
            completed_at: task.completed_at || null,
            created_at: task.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return await this.client
            .from('tasks')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single();
    }

    async deleteTask(taskId) {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('tasks')
            .delete()
            .eq('id', taskId);
    }

    // ==========================================
    // DAILY RECORDS CRUD
    // ==========================================

    async fetchDailyRecord(recordDate) {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('daily_records')
            .select('*')
            .eq('record_date', recordDate)
            .maybeSingle();
    }

    async fetchAllDailyRecords() {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('daily_records')
            .select('*')
            .order('record_date', { ascending: false });
    }

    async upsertDailyRecord(record) {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        
        const payload = {
            id: record.id,
            record_date: record.record_date,
            what_i_did: record.what_i_did || '',
            notes: record.notes || '',
            created_at: record.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return await this.client
            .from('daily_records')
            .upsert(payload, { onConflict: 'record_date' })
            .select()
            .single();
    }

    // ==========================================
    // CATEGORIES CRUD
    // ==========================================

    async fetchCategories() {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('categories')
            .select('*')
            .order('name', { ascending: true });
    }

    async upsertCategory(category) {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('categories')
            .upsert({
                id: category.id,
                name: category.name,
                created_at: category.created_at || new Date().toISOString()
            }, { onConflict: 'name' })
            .select()
            .single();
    }

    // ==========================================
    // SETTINGS CRUD
    // ==========================================

    async fetchSettings() {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('settings')
            .select('*')
            .limit(1)
            .maybeSingle();
    }

    async upsertSettings(settings) {
        if (!this.client) return { data: null, error: new Error('Supabase not configured') };
        return await this.client
            .from('settings')
            .upsert({
                id: settings.id || 'nexus_user_settings',
                theme: settings.theme || 'cyberpunk',
                animations_enabled: settings.animations_enabled !== false,
                sound_enabled: settings.sound_enabled !== false,
                effects_3d_enabled: settings.effects_3d_enabled !== false,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select()
            .single();
    }
}

// Export singleton instance
window.nexusSupabase = new NexusSupabase();
