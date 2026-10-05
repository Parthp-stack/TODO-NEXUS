/**
 * NEXUS - Visual Interface & Interaction Engine
 * Controls page routing, Japanese futuristic theme & particle canvas, Web Audio effects,
 * 3D holographic tilt, modals, and responsive navigation.
 */

class NexusUI {
    constructor() {
        this.activePage = 'today';
        this.upcomingDaysCount = 5; // 5 or 7
        this.audioCtx = null;
        this.settings = {
            theme: 'cyberpunk',
            animations_enabled: true,
            sound_enabled: true,
            effects_3d_enabled: true,
            reduced_motion: false
        };
        this.sakuraCanvas = null;
        this.sakuraAnimId = null;
        this.particles = [];
    }

    /**
     * Initialize UI listeners, particle canvas, themes, audio, and load initial page
     */
    async init() {
        this.loadSettings();
        this.initTheme();
        this.initCanvasBackground();
        this.initAudio();
        this.bindEvents();
        this.initSyncStatusListener();

        // Navigate to default page (Today)
        await this.navigateTo('today');
    }

    async loadSettings() {
        try {
            const saved = await window.nexusStorage.getSettings();
            if (saved) {
                this.settings = { ...this.settings, ...saved };
            }
        } catch (e) {
            console.warn('[NEXUS UI] Could not load settings from storage:', e);
        }
        this.applySettingsToDOM();
    }

    applySettingsToDOM() {
        document.documentElement.setAttribute('data-theme', this.settings.theme || 'cyberpunk');
        
        if (!this.settings.animations_enabled || this.settings.reduced_motion) {
            document.documentElement.classList.add('reduce-motion');
            if (this.sakuraCanvas) this.sakuraCanvas.style.display = 'none';
        } else {
            document.documentElement.classList.remove('reduce-motion');
            if (this.sakuraCanvas) this.sakuraCanvas.style.display = 'block';
        }

        if (this.settings.effects_3d_enabled && !this.settings.reduced_motion) {
            document.documentElement.classList.add('enable-3d');
        } else {
            document.documentElement.classList.remove('enable-3d');
        }
    }

    initTheme() {
        this.applySettingsToDOM();
    }

    // ==========================================
    // AUDIO ENGINE (Synthesized via Web Audio API)
    // ==========================================

    initAudio() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            // Lazy initialize on first interaction to comply with browser autoplay policies
            const unlockAudio = () => {
                if (!this.audioCtx) {
                    this.audioCtx = new AudioContextClass();
                }
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('keydown', unlockAudio);
            };
            window.addEventListener('click', unlockAudio, { once: true });
            window.addEventListener('keydown', unlockAudio, { once: true });
        }
    }

    playSound(type = 'click') {
        if (!this.settings.sound_enabled || !this.audioCtx) return;

        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const now = this.audioCtx.currentTime;

            if (type === 'click') {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'create') {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.setValueAtTime(780, now + 0.06);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.16);
            } else if (type === 'complete') {
                // Futuristic chime triad
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    const noteTime = now + (idx * 0.04);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, noteTime);
                    gain.gain.setValueAtTime(0.1, noteTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
                    osc.connect(gain);
                    gain.connect(this.audioCtx.destination);
                    osc.start(noteTime);
                    osc.stop(noteTime + 0.35);
                });
            } else if (type === 'delete') {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(240, now);
                osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.14);
            } else if (type === 'modal') {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(640, now + 0.1);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.1);
            }
        } catch (e) {
            // Audio error non-fatal
        }
    }

    // ==========================================
    // CANVAS SAKURA & CYBER DUST PARTICLES
    // ==========================================

    initCanvasBackground() {
        this.sakuraCanvas = document.getElementById('sakura-canvas');
        if (!this.sakuraCanvas) return;

        const ctx = this.sakuraCanvas.getContext('2d');
        let width = (this.sakuraCanvas.width = window.innerWidth);
        let height = (this.sakuraCanvas.height = window.innerHeight);

        window.addEventListener('resize', () => {
            if (!this.sakuraCanvas) return;
            width = this.sakuraCanvas.width = window.innerWidth;
            height = this.sakuraCanvas.height = window.innerHeight;
        });

        // Generate subtle sakura petals & cyber glowing nodes
        const particleCount = 28;
        this.particles = [];
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 5 + 3,
                speedX: Math.random() * 0.8 - 0.4,
                speedY: Math.random() * 0.9 + 0.3,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 1.5 - 0.75,
                opacity: Math.random() * 0.4 + 0.15,
                isSakura: i % 2 === 0
            });
        }

        const renderFrame = () => {
            if (!this.settings.animations_enabled || this.settings.reduced_motion) {
                this.sakuraAnimId = requestAnimationFrame(renderFrame);
                return;
            }

            ctx.clearRect(0, 0, width, height);

            for (const p of this.particles) {
                p.x += p.speedX;
                p.y += p.speedY;
                p.rotation += p.rotationSpeed;

                if (p.y > height + 20) {
                    p.y = -20;
                    p.x = Math.random() * width;
                }
                if (p.x > width + 20) p.x = -20;
                if (p.x < -20) p.x = width + 20;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);

                if (p.isSakura) {
                    // Soft pink sakura petal shape
                    ctx.fillStyle = `rgba(255, 140, 190, ${p.opacity})`;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Cyber glowing dust node
                    ctx.fillStyle = `rgba(0, 243, 255, ${p.opacity * 0.7})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            this.sakuraAnimId = requestAnimationFrame(renderFrame);
        };

        // Pause animation when tab is inactive to save battery
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(this.sakuraAnimId);
            } else {
                renderFrame();
            }
        });

        renderFrame();
    }

    // ==========================================
    // ROUTING & PAGE NAVIGATION
    // ==========================================

    async navigateTo(pageName) {
        this.activePage = pageName;
        this.playSound('click');

        // Update nav links state
        document.querySelectorAll('.nav-item').forEach(el => {
            const target = el.getAttribute('data-page');
            if (target === pageName) {
                el.classList.add('is-active');
            } else {
                el.classList.remove('is-active');
            }
        });

        // Hide all page containers
        document.querySelectorAll('.page-view').forEach(view => {
            view.classList.remove('is-active');
        });

        // Show active page container
        const targetView = document.getElementById(`view-${pageName}`);
        if (targetView) {
            targetView.classList.add('is-active');
        }

        // Render page specific data
        switch (pageName) {
            case 'today':
                await this.renderTodayPage();
                break;
            case 'upcoming':
                await this.renderUpcomingPage();
                break;
            case 'calendar':
                await window.nexusCalendar.renderCalendar();
                break;
            case 'history':
                await window.nexusHistory.renderHistory();
                break;
            case 'search':
                await window.nexusSearch.populateCategories();
                await window.nexusSearch.renderSearchResults();
                break;
            case 'settings':
                await this.renderSettingsPage();
                break;
        }

        // Apply 3D card tilt listeners
        this.attach3DTiltListeners();

        // Scroll top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async refreshCurrentView() {
        await this.navigateTo(this.activePage);
        await this.updateTodayPreviewDrawer();
    }

    // ==========================================
    // TODAY PAGE CONTROLLER
    // ==========================================

    async renderTodayPage() {
        const todayStr = window.nexusTasks.getTodayDateString();
        const displayDate = window.nexusTasks.formatDateToDisplay(todayStr, true);

        // Update date banner
        const bannerDate = document.getElementById('today-banner-date');
        if (bannerDate) {
            bannerDate.textContent = displayDate.toUpperCase();
        }

        const mobileHeaderDate = document.getElementById('mobile-header-date');
        if (mobileHeaderDate) {
            mobileHeaderDate.textContent = displayDate.toUpperCase();
        }

        const tasks = await window.nexusStorage.getTasksByDate(todayStr);
        const container = document.getElementById('today-tasks-container');
        const emptyState = document.getElementById('today-empty-state');
        const statsSummary = document.getElementById('today-stats-summary');

        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pending = total - completed;

        if (statsSummary) {
            statsSummary.innerHTML = `
                <div class="stat-pill"><span class="pill-label">PLANNED</span><span class="pill-val">${total}</span></div>
                <div class="stat-pill pill-success"><span class="pill-label">COMPLETED</span><span class="pill-val">${completed}</span></div>
                <div class="stat-pill pill-pending"><span class="pill-label">REMAINING</span><span class="pill-val">${pending}</span></div>
            `;
        }

        if (container) {
            if (total === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
            } else {
                if (emptyState) emptyState.style.display = 'none';
                container.innerHTML = tasks.map(t => window.nexusTasks.renderTaskCard(t, { showDate: false, allowCarryForward: true })).join('');
            }
        }

        // Load "What I Did Today"
        const record = await window.nexusStorage.getDailyRecord(todayStr);
        const textareaDid = document.getElementById('today-what-i-did-input');
        const textareaNotes = document.getElementById('today-daily-notes-input');

        if (textareaDid) textareaDid.value = record ? (record.what_i_did || '') : '';
        if (textareaNotes) textareaNotes.value = record ? (record.notes || '') : '';

        // Update right sidebar preview
        await this.updateTodayPreviewDrawer();
    }

    /**
     * Save "What I Did Today" and daily notes
     */
    async saveDailyRecord() {
        const todayStr = window.nexusTasks.getTodayDateString();
        const textareaDid = document.getElementById('today-what-i-did-input');
        const textareaNotes = document.getElementById('today-daily-notes-input');

        const what_i_did = textareaDid ? textareaDid.value.trim() : '';
        const notes = textareaNotes ? textareaNotes.value.trim() : '';

        try {
            const existing = await window.nexusStorage.getDailyRecord(todayStr);
            const record = {
                id: existing ? existing.id : window.nexusStorage.generateUUID(),
                record_date: todayStr,
                what_i_did,
                notes,
                created_at: existing ? existing.created_at : new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await window.nexusStorage.saveDailyRecord(record, true);

            if (window.nexusSupabase && window.nexusSupabase.isConfigured() && navigator.onLine) {
                window.nexusSync.processSyncQueue();
            }

            this.playSound('create');
            this.showToast("Daily record saved permanently.", "success");
        } catch (err) {
            console.error('[NEXUS UI] Save daily record error:', err);
            this.showToast("Unable to save daily record. Please try again.", "error");
        }
    }

    // ==========================================
    // UPCOMING PAGE CONTROLLER
    // ==========================================

    async renderUpcomingPage() {
        const container = document.getElementById('upcoming-days-container');
        if (!container) return;

        const count = this.upcomingDaysCount; // 5 or 7
        const today = new Date();
        const allTasks = await window.nexusStorage.getAllTasks();

        let html = '';
        let totalUpcomingTasks = 0;

        for (let i = 0; i < count; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + i);
            const dateStr = window.nexusTasks.formatDateToISO(targetDate);

            let dayLabel = '';
            if (i === 0) dayLabel = 'TODAY';
            else if (i === 1) dayLabel = 'TOMORROW';
            else {
                const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                dayLabel = daysOfWeek[targetDate.getDay()];
            }

            const formattedDate = window.nexusTasks.formatDateToDisplay(dateStr);
            const dayTasks = allTasks.filter(t => t.planned_date === dateStr);
            totalUpcomingTasks += dayTasks.length;

            const completedCount = dayTasks.filter(t => t.status === 'completed').length;
            const progressPct = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;

            html += `
                <div class="upcoming-day-card ${i === 0 ? 'is-today-card' : ''}" data-date="${dateStr}">
                    <div class="upcoming-card-header">
                        <div class="upcoming-header-left">
                            <span class="upcoming-day-badge">${dayLabel}</span>
                            <span class="upcoming-date-text">${formattedDate}</span>
                        </div>
                        <div class="upcoming-header-right">
                            <span class="upcoming-count-badge">${completedCount}/${dayTasks.length}</span>
                            <button class="btn-quick-add" onclick="window.nexusUI.openTaskModal(null, '${dateStr}')" title="Add task for this date">
                                + Add
                            </button>
                        </div>
                    </div>

                    <div class="upcoming-progress-bar">
                        <div class="upcoming-progress-fill" style="width: ${progressPct}%"></div>
                    </div>

                    <div class="upcoming-tasks-list">
                        ${dayTasks.length === 0 ? `
                            <div class="upcoming-empty-placeholder">Nothing planned for this day.</div>
                        ` : dayTasks.map(t => window.nexusTasks.renderTaskCard(t, { showDate: false, allowCarryForward: true })).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Update toggle buttons active state
        document.querySelectorAll('.btn-view-toggle').forEach(btn => {
            const val = parseInt(btn.getAttribute('data-days'), 10);
            if (val === count) btn.classList.add('is-active');
            else btn.classList.remove('is-active');
        });
    }

    setUpcomingDaysCount(days) {
        this.upcomingDaysCount = days;
        this.renderUpcomingPage();
    }

    // ==========================================
    // RIGHT DRAWER / PREVIEW COMPONENT
    // ==========================================

    async updateTodayPreviewDrawer() {
        const previewList = document.getElementById('preview-upcoming-list');
        const progressRing = document.getElementById('preview-progress-fill');
        const progressText = document.getElementById('preview-progress-text');
        if (!previewList) return;

        const todayStr = window.nexusTasks.getTodayDateString();
        const tasks = await window.nexusStorage.getTasksByDate(todayStr);

        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (progressText) progressText.textContent = `${pct}%`;
        if (progressRing) {
            // Circumference of r=40 is ~251.2
            const strokeDashoffset = 251.2 - (251.2 * pct) / 100;
            progressRing.style.strokeDashoffset = strokeDashoffset;
        }

        if (tasks.length === 0) {
            previewList.innerHTML = '<div class="drawer-empty-notice">No missions active for today.</div>';
        } else {
            previewList.innerHTML = tasks.slice(0, 6).map(t => `
                <div class="drawer-task-row ${t.status === 'completed' ? 'is-done' : ''}" onclick="window.nexusTasks.showEditModal('${t.id}')">
                    <span class="drawer-task-status">${t.status === 'completed' ? '✓' : '○'}</span>
                    <span class="drawer-task-title">${this.escapeHTML(t.title)}</span>
                    <span class="drawer-task-prio badge-${t.priority.toLowerCase()}">${t.priority[0].toUpperCase()}</span>
                </div>
            `).join('');
        }
    }

    // ==========================================
    // MODALS CONTROLLER
    // ==========================================

    async openTaskModal(existingTask = null, defaultDate = null) {
        const modal = document.getElementById('task-modal');
        if (!modal) return;

        const titleInput = document.getElementById('task-input-title');
        const descInput = document.getElementById('task-input-desc');
        const dateInput = document.getElementById('task-input-date');
        const startInput = document.getElementById('task-input-start');
        const endInput = document.getElementById('task-input-end');
        const prioritySelect = document.getElementById('task-input-priority');
        const categorySelect = document.getElementById('task-input-category');
        const taskIdInput = document.getElementById('task-input-id');
        const modalHeaderTitle = document.getElementById('task-modal-title');
        const submitBtn = document.getElementById('task-modal-submit-btn');

        // Populate Categories dropdown
        await this.populateCategorySelect(categorySelect);

        if (existingTask) {
            if (modalHeaderTitle) modalHeaderTitle.textContent = "EDIT TASK // 任務編集";
            if (submitBtn) submitBtn.textContent = "Save Changes";
            if (taskIdInput) taskIdInput.value = existingTask.id;
            if (titleInput) titleInput.value = existingTask.title || '';
            if (descInput) descInput.value = existingTask.description || '';
            if (dateInput) dateInput.value = existingTask.planned_date || '';
            if (startInput) startInput.value = existingTask.start_time || '';
            if (endInput) endInput.value = existingTask.end_time || '';
            if (prioritySelect) prioritySelect.value = existingTask.priority || 'medium';
            if (categorySelect) categorySelect.value = existingTask.category || 'Personal';
        } else {
            if (modalHeaderTitle) modalHeaderTitle.textContent = "NEW TASK // 新規任務";
            if (submitBtn) submitBtn.textContent = "Add Task";
            if (taskIdInput) taskIdInput.value = '';
            if (titleInput) titleInput.value = '';
            if (descInput) descInput.value = '';
            if (dateInput) dateInput.value = defaultDate || window.nexusTasks.getTodayDateString();
            if (startInput) startInput.value = '';
            if (endInput) endInput.value = '';
            if (prioritySelect) prioritySelect.value = 'medium';
            if (categorySelect) categorySelect.value = 'Personal';
        }

        modal.classList.add('is-active');
        this.playSound('modal');
        setTimeout(() => { if (titleInput) titleInput.focus(); }, 150);
    }

    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) modal.classList.remove('is-active');
    }

    async populateCategorySelect(selectElement) {
        if (!selectElement) return;
        const categories = await window.nexusStorage.getCategories();
        let html = '';
        for (const cat of categories) {
            html += `<option value="${this.escapeHTML(cat.name)}">${this.escapeHTML(cat.name)}</option>`;
        }
        selectElement.innerHTML = html;
    }

    async handleSaveTaskForm(e) {
        e.preventDefault();
        const taskId = document.getElementById('task-input-id').value;
        const title = document.getElementById('task-input-title').value;
        const description = document.getElementById('task-input-desc').value;
        const planned_date = document.getElementById('task-input-date').value;
        const start_time = document.getElementById('task-input-start').value;
        const end_time = document.getElementById('task-input-end').value;
        const priority = document.getElementById('task-input-priority').value;
        const category = document.getElementById('task-input-category').value;

        try {
            if (taskId) {
                await window.nexusTasks.updateTask(taskId, {
                    title, description, planned_date, start_time, end_time, priority, category
                });
            } else {
                await window.nexusTasks.createTask({
                    title, description, planned_date, start_time, end_time, priority, category
                });
            }

            this.closeTaskModal();
            await this.refreshCurrentView();
        } catch (err) {
            // Handled in tasks.js
        }
    }

    /**
     * Add custom category from modal
     */
    async addNewCategoryPrompt() {
        const catName = prompt("Enter new category name:");
        if (catName && catName.trim()) {
            const clean = catName.trim();
            const newCat = {
                id: window.nexusStorage.generateUUID(),
                name: clean,
                created_at: new Date().toISOString()
            };
            await window.nexusStorage.saveCategory(newCat, true);

            // Refresh category select
            const categorySelect = document.getElementById('task-input-category');
            await this.populateCategorySelect(categorySelect);
            if (categorySelect) categorySelect.value = clean;
            this.showToast(`Category "${clean}" added.`, "success");
        }
    }

    // ==========================================
    // CARRY FORWARD MODAL CONTROLLER
    // ==========================================

    async openCarryForwardModal(taskId) {
        const task = await window.nexusStorage.getTaskById(taskId);
        if (!task) return;

        const modal = document.getElementById('carry-forward-modal');
        if (!modal) return;

        const titleEl = document.getElementById('cf-task-title');
        const taskIdEl = document.getElementById('cf-task-id');
        const customDateInput = document.getElementById('cf-custom-date');

        if (titleEl) titleEl.textContent = task.title;
        if (taskIdEl) taskIdEl.value = task.id;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (customDateInput) customDateInput.value = window.nexusTasks.formatDateToISO(tomorrow);

        modal.classList.add('is-active');
        this.playSound('modal');
    }

    closeCarryForwardModal() {
        const modal = document.getElementById('carry-forward-modal');
        if (modal) modal.classList.remove('is-active');
    }

    async executeCarryForward(action) {
        const taskId = document.getElementById('cf-task-id').value;
        if (!taskId) return;

        if (action === 'tomorrow') {
            await window.nexusTasks.carryForwardTask(taskId);
        } else if (action === 'custom') {
            const customDate = document.getElementById('cf-custom-date').value;
            if (customDate) {
                await window.nexusTasks.carryForwardTask(taskId, customDate);
            }
        } else if (action === 'delete') {
            await window.nexusTasks.deleteTask(taskId);
        }

        this.closeCarryForwardModal();
        await this.refreshCurrentView();
    }

    // ==========================================
    // SETTINGS PAGE CONTROLLER
    // ==========================================

    async renderSettingsPage() {
        const urlInput = document.getElementById('setting-supabase-url');
        const keyInput = document.getElementById('setting-supabase-key');
        const animToggle = document.getElementById('setting-anim-toggle');
        const soundToggle = document.getElementById('setting-sound-toggle');
        const effects3dToggle = document.getElementById('setting-3d-toggle');
        const motionToggle = document.getElementById('setting-motion-toggle');
        const themeSelect = document.getElementById('setting-theme-select');

        // Cloud Credentials
        if (urlInput) urlInput.value = localStorage.getItem('nexus_supabase_url') || '';
        if (keyInput) keyInput.value = localStorage.getItem('nexus_supabase_anon_key') || '';

        // Toggles
        if (animToggle) animToggle.checked = this.settings.animations_enabled !== false;
        if (soundToggle) soundToggle.checked = this.settings.sound_enabled !== false;
        if (effects3dToggle) effects3dToggle.checked = this.settings.effects_3d_enabled !== false;
        if (motionToggle) motionToggle.checked = !!this.settings.reduced_motion;
        if (themeSelect) themeSelect.value = this.settings.theme || 'cyberpunk';

        // Diagnostics
        const [tasks, records, queue] = await Promise.all([
            window.nexusStorage.getAllTasks(),
            window.nexusStorage.getAllDailyRecords(),
            window.nexusStorage.getSyncQueue()
        ]);

        const statsEl = document.getElementById('setting-storage-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="diag-item"><span>Stored Tasks:</span> <strong>${tasks.length}</strong></div>
                <div class="diag-item"><span>Daily Records:</span> <strong>${records.length}</strong></div>
                <div class="diag-item"><span>Unsynced Queue:</span> <strong>${queue.length}</strong></div>
                <div class="diag-item"><span>Connection:</span> <strong>${navigator.onLine ? 'Online' : 'Offline'}</strong></div>
            `;
        }
    }

    async saveSettingsFromForm() {
        const theme = document.getElementById('setting-theme-select').value;
        const animations_enabled = document.getElementById('setting-anim-toggle').checked;
        const sound_enabled = document.getElementById('setting-sound-toggle').checked;
        const effects_3d_enabled = document.getElementById('setting-3d-toggle').checked;
        const reduced_motion = document.getElementById('setting-motion-toggle').checked;

        this.settings = {
            ...this.settings,
            theme,
            animations_enabled,
            sound_enabled,
            effects_3d_enabled,
            reduced_motion
        };

        await window.nexusStorage.saveSettings(this.settings, true);
        this.applySettingsToDOM();
        this.playSound('create');
        this.showToast("Settings preserved.", "success");
    }

    async testAndSaveSupabaseConnection() {
        const urlInput = document.getElementById('setting-supabase-url');
        const keyInput = document.getElementById('setting-supabase-key');
        const resultEl = document.getElementById('supabase-test-result');

        const url = urlInput ? urlInput.value.trim() : '';
        const key = keyInput ? keyInput.value.trim() : '';

        if (!url || !key) {
            if (resultEl) {
                resultEl.innerHTML = `<span class="res-error">Please provide both Project URL and Public Anon Key.</span>`;
            }
            return;
        }

        if (resultEl) {
            resultEl.innerHTML = `<span class="res-loading">Connecting to Supabase...</span>`;
        }

        const res = await window.nexusSupabase.testConnection(url, key);

        if (res.success) {
            window.nexusSupabase.saveCredentials(url, key);
            if (resultEl) {
                resultEl.innerHTML = `<span class="res-success">✓ ${res.message}</span>`;
            }
            this.showToast("Supabase cloud sync connected!", "success");
            // Trigger initial sync
            await window.nexusSync.processSyncQueue(true);
            await this.refreshCurrentView();
        } else {
            if (resultEl) {
                resultEl.innerHTML = `<span class="res-error">✗ ${res.message}</span>`;
            }
            this.showToast("Connection failed. Check credentials.", "error");
        }
    }

    // ==========================================
    // BACKUP & RESTORE EXPORT / IMPORT
    // ==========================================

    async exportDataJSON() {
        try {
            const data = await window.nexusStorage.exportAllData();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const now = new Date();
            const filename = `nexus_backup_${window.nexusTasks.formatDateToISO(now)}.json`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast("JSON backup exported successfully.", "success");
        } catch (e) {
            console.error('[NEXUS UI] Export error:', e);
            this.showToast("Export failed.", "error");
        }
    }

    async exportDataCSV() {
        try {
            const tasks = await window.nexusStorage.getAllTasks();
            if (tasks.length === 0) {
                this.showToast("No tasks to export.", "info");
                return;
            }

            const headers = ['id', 'title', 'description', 'planned_date', 'original_planned_date', 'start_time', 'end_time', 'priority', 'category', 'status', 'completed_at'];
            let csv = headers.join(',') + '\n';

            for (const t of tasks) {
                const row = headers.map(h => {
                    const val = t[h] || '';
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                csv += row.join(',') + '\n';
            }

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nexus_tasks_${window.nexusTasks.getTodayDateString()}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast("Tasks CSV exported successfully.", "success");
        } catch (e) {
            console.error('[NEXUS UI] CSV export error:', e);
            this.showToast("CSV export failed.", "error");
        }
    }

    async handleImportJSONFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const json = JSON.parse(text);

            if (!json.data || !json.data.tasks) {
                throw new Error("Invalid NEXUS backup JSON schema.");
            }

            const taskCount = json.data.tasks ? json.data.tasks.length : 0;
            const recordCount = json.data.daily_records ? json.data.daily_records.length : 0;

            const confirmed = confirm(`Import confirmation:\n- ${taskCount} tasks\n- ${recordCount} daily records\n\nMerge with existing data?`);
            if (confirmed) {
                await window.nexusStorage.importAllData(json, { merge: true });
                this.showToast(`Imported ${taskCount} tasks and ${recordCount} daily records!`, "success");
                await this.refreshCurrentView();
            }
        } catch (err) {
            console.error('[NEXUS UI] Import error:', err);
            this.showToast("Import failed: " + err.message, "error");
        } finally {
            e.target.value = '';
        }
    }

    async confirmClearLocalCache() {
        const confirmed = confirm("WARNING: This will clear all local cached records from this browser.\n\nAre you sure you want to proceed?");
        if (confirmed) {
            await window.nexusStorage.clearAllData();
            this.showToast("Local cache cleared.", "info");
            await this.refreshCurrentView();
        }
    }

    // ==========================================
    // 3D HOLOGRAPHIC TILT EFFECT
    // ==========================================

    attach3DTiltListeners() {
        if (!this.settings.effects_3d_enabled || this.settings.reduced_motion) return;

        const cards = document.querySelectorAll('.task-card, .upcoming-day-card, .history-day-card');
        cards.forEach(card => {
            if (card.dataset.tiltAttached) return;
            card.dataset.tiltAttached = 'true';

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -5;
                const rotateY = ((x - centerX) / centerX) * 5;

                card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
            });
        });
    }

    // ==========================================
    // NOTIFICATION TOASTS
    // ==========================================

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `nexus-toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: '✦'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '✦'}</span>
            <span class="toast-msg">${this.escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('is-fadeout');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3200);
    }

    // ==========================================
    // NETWORK / SYNC STATUS INDICATOR
    // ==========================================

    initSyncStatusListener() {
        window.nexusSync.subscribe((state) => {
            const badge = document.getElementById('nexus-network-badge');
            const label = document.getElementById('nexus-network-label');
            const syncIcon = document.getElementById('nexus-sync-icon');

            const badgeMobile = document.getElementById('nexus-network-badge-mobile');
            const labelMobile = document.getElementById('nexus-network-label-mobile');

            let badgeClass = 'network-badge is-online';
            let labelText = 'ONLINE';

            if (!state.isOnline) {
                badgeClass = 'network-badge is-offline';
                labelText = 'OFFLINE';
            } else if (state.isSyncing) {
                badgeClass = 'network-badge is-syncing';
                labelText = 'SYNCING';
            }

            if (badge) badge.className = badgeClass;
            if (label) label.textContent = labelText;

            if (badgeMobile) badgeMobile.className = badgeClass;
            if (labelMobile) labelMobile.textContent = labelText;

            if (syncIcon) {
                if (state.isSyncing) syncIcon.classList.add('spin-anim');
                else syncIcon.classList.remove('spin-anim');
            }
        });
    }

    // ==========================================
    // DOM EVENT BINDINGS
    // ==========================================

    bindEvents() {
        // Navigation clicks
        document.querySelectorAll('[data-nav-target]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const target = el.getAttribute('data-nav-target');
                this.navigateTo(target);
            });
        });

        // Global New Task Button
        const btnNewTask = document.getElementById('btn-global-add-task');
        if (btnNewTask) {
            btnNewTask.addEventListener('click', () => this.openTaskModal());
        }

        // Global New Task Mobile FAB
        const btnFab = document.getElementById('btn-mobile-fab');
        if (btnFab) {
            btnFab.addEventListener('click', () => this.openTaskModal());
        }

        // Modal Close Buttons
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeTaskModal();
                this.closeCarryForwardModal();
                window.nexusCalendar.closeDateDetails();
            });
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Escape closes open modals
            if (e.key === 'Escape') {
                this.closeTaskModal();
                this.closeCarryForwardModal();
                window.nexusCalendar.closeDateDetails();
            }
            // 'n' opens new task modal if not focused on inputs
            if (e.key === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                this.openTaskModal();
            }
            // '/' focuses global search if on search page or navigates to search
            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                this.navigateTo('search');
                setTimeout(() => {
                    const searchInput = document.getElementById('search-input-field');
                    if (searchInput) searchInput.focus();
                }, 100);
            }
        });
    }

    escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Export singleton instance
window.nexusUI = new NexusUI();
