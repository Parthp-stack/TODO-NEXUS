/**
 * NEXUS - Task Management Module
 * Handles task creation, editing, deletion, completion toggling, carry-forward, and rendering.
 */

class NexusTaskManager {
    constructor() {
        this.selectedDate = this.getTodayDateString();
    }

    /**
     * Get ISO Date string formatted YYYY-MM-DD
     */
    getTodayDateString() {
        const now = new Date();
        return this.formatDateToISO(now);
    }

    formatDateToISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get display date string e.g. "5 OCTOBER 2026"
     */
    formatDateToDisplay(dateStr, includeWeekday = false) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        
        const day = date.getDate();
        const monthNames = [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();

        if (includeWeekday) {
            const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const weekday = weekdays[date.getDay()];
            return `${weekday}, ${day} ${month} ${year}`;
        }
        return `${day} ${month} ${year}`;
    }

    /**
     * Create a new task
     */
    async createTask(taskData) {
        try {
            if (!taskData.title || !taskData.title.trim()) {
                throw new Error("Task title is required.");
            }
            if (!taskData.planned_date) {
                taskData.planned_date = this.getTodayDateString();
            }

            const newTask = {
                id: window.nexusStorage.generateUUID(),
                title: taskData.title.trim(),
                description: (taskData.description || '').trim(),
                planned_date: taskData.planned_date,
                original_planned_date: taskData.planned_date,
                start_time: taskData.start_time || null,
                end_time: taskData.end_time || null,
                priority: taskData.priority || 'medium',
                category: taskData.category || 'Personal',
                status: 'pending',
                completed_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await window.nexusStorage.saveTask(newTask, true);

            // Attempt online sync immediately if connected
            if (window.nexusSupabase && window.nexusSupabase.isConfigured() && navigator.onLine) {
                window.nexusSync.processSyncQueue();
            }

            if (window.nexusUI) {
                window.nexusUI.playSound('create');
                window.nexusUI.showToast("Task initialized successfully.", "success");
            }
            return newTask;
        } catch (err) {
            console.error('[NEXUS Tasks] Create task error:', err);
            if (window.nexusUI) {
                window.nexusUI.showToast(err.message || "Unable to save task. Please try again.", "error");
            }
            throw err;
        }
    }

    /**
     * Update an existing task
     */
    async updateTask(id, updates) {
        try {
            const task = await window.nexusStorage.getTaskById(id);
            if (!task) {
                throw new Error("Task not found.");
            }

            const updatedTask = {
                ...task,
                ...updates,
                updated_at: new Date().toISOString()
            };

            await window.nexusStorage.saveTask(updatedTask, true);

            if (window.nexusSupabase && window.nexusSupabase.isConfigured() && navigator.onLine) {
                window.nexusSync.processSyncQueue();
            }

            if (window.nexusUI) {
                window.nexusUI.playSound('click');
                window.nexusUI.showToast("Task updated.", "success");
            }
            return updatedTask;
        } catch (err) {
            console.error('[NEXUS Tasks] Update task error:', err);
            if (window.nexusUI) {
                window.nexusUI.showToast("Unable to update task. Please try again.", "error");
            }
            throw err;
        }
    }

    /**
     * Toggle completion status of a task
     */
    async toggleComplete(id) {
        try {
            const task = await window.nexusStorage.getTaskById(id);
            if (!task) return null;

            const isNowCompleted = task.status !== 'completed';
            const nowIso = new Date().toISOString();

            task.status = isNowCompleted ? 'completed' : 'pending';
            task.completed_at = isNowCompleted ? nowIso : null;
            task.updated_at = nowIso;

            await window.nexusStorage.saveTask(task, true);

            if (window.nexusSupabase && window.nexusSupabase.isConfigured() && navigator.onLine) {
                window.nexusSync.processSyncQueue();
            }

            if (window.nexusUI) {
                if (isNowCompleted) {
                    window.nexusUI.playSound('complete');
                    window.nexusUI.showToast("Task marked complete. Record archived.", "success");
                } else {
                    window.nexusUI.playSound('click');
                    window.nexusUI.showToast("Task reopened.", "info");
                }
            }
            return task;
        } catch (err) {
            console.error('[NEXUS Tasks] Toggle complete error:', err);
            if (window.nexusUI) {
                window.nexusUI.showToast("Unable to update task status.", "error");
            }
            throw err;
        }
    }

    /**
     * Delete a task
     */
    async deleteTask(id) {
        try {
            await window.nexusStorage.deleteTask(id, true);

            if (window.nexusSupabase && window.nexusSupabase.isConfigured() && navigator.onLine) {
                window.nexusSync.processSyncQueue();
            }

            if (window.nexusUI) {
                window.nexusUI.playSound('delete');
                window.nexusUI.showToast("Task removed.", "info");
            }
            return true;
        } catch (err) {
            console.error('[NEXUS Tasks] Delete task error:', err);
            if (window.nexusUI) {
                window.nexusUI.showToast("Unable to delete task. Please try again.", "error");
            }
            throw err;
        }
    }

    /**
     * Carry Forward: Move an uncompleted task to tomorrow or a target date
     * Strictly preserves original_planned_date so history is maintained!
     */
    async carryForwardTask(id, targetDateStr = null) {
        try {
            const task = await window.nexusStorage.getTaskById(id);
            if (!task) return null;

            let targetDate = targetDateStr;
            if (!targetDate) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                targetDate = this.formatDateToISO(tomorrow);
            }

            // Preserve original planned date if not set
            if (!task.original_planned_date) {
                task.original_planned_date = task.planned_date;
            }

            task.planned_date = targetDate;
            task.updated_at = new Date().toISOString();

            await window.nexusStorage.saveTask(task, true);

            if (window.nexusSupabase && window.nexusSupabase.isConfigured() && navigator.onLine) {
                window.nexusSync.processSyncQueue();
            }

            if (window.nexusUI) {
                window.nexusUI.playSound('click');
                window.nexusUI.showToast(`Task moved to ${this.formatDateToDisplay(targetDate)}. Original plan preserved.`, "info");
            }
            return task;
        } catch (err) {
            console.error('[NEXUS Tasks] Carry forward error:', err);
            if (window.nexusUI) {
                window.nexusUI.showToast("Unable to move task. Please try again.", "error");
            }
            throw err;
        }
    }

    /**
     * Render a task card HTML component
     */
    renderTaskCard(task, options = { showDate: false, allowCarryForward: true }) {
        const isCompleted = task.status === 'completed';
        const priorityClass = `priority-${task.priority.toLowerCase()}`;
        const hasTime = task.start_time || task.end_time;
        const timeDisplay = hasTime 
            ? `${task.start_time || '--:--'} – ${task.end_time || '--:--'}`
            : '';

        const wasCarriedForward = task.original_planned_date && task.original_planned_date !== task.planned_date;

        return `
            <div class="task-card ${isCompleted ? 'is-completed' : ''} ${priorityClass}" data-task-id="${task.id}">
                <div class="task-left">
                    <label class="nexus-checkbox-wrapper" title="${isCompleted ? 'Mark Pending' : 'Mark Completed'}">
                        <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} onchange="window.nexusTasks.handleToggleComplete('${task.id}')">
                        <span class="nexus-checkbox-custom">
                            <svg class="checkmark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </span>
                    </label>
                </div>

                <div class="task-body">
                    <div class="task-header-row">
                        <h4 class="task-title ${isCompleted ? 'strikethrough' : ''}">${this.escapeHTML(task.title)}</h4>
                        <div class="task-badges">
                            <span class="badge badge-category">${this.escapeHTML(task.category)}</span>
                            <span class="badge badge-priority badge-${task.priority.toLowerCase()}">${task.priority.toUpperCase()}</span>
                            ${wasCarriedForward ? `<span class="badge badge-carried" title="Originally planned for ${this.formatDateToDisplay(task.original_planned_date)}">↩ MOVED FROM ${this.formatDateToDisplay(task.original_planned_date)}</span>` : ''}
                        </div>
                    </div>

                    ${task.description ? `<p class="task-desc">${this.escapeHTML(task.description)}</p>` : ''}

                    <div class="task-footer-row">
                        <div class="task-time-info">
                            ${timeDisplay ? `
                                <span class="time-badge">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    ${timeDisplay}
                                </span>
                            ` : ''}
                            ${options.showDate ? `
                                <span class="date-badge">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    ${this.formatDateToDisplay(task.planned_date)}
                                </span>
                            ` : ''}
                            ${isCompleted && task.completed_at ? `
                                <span class="completed-timestamp">
                                    ✓ Completed ${this.formatTimestamp(task.completed_at)}
                                </span>
                            ` : ''}
                        </div>

                        <div class="task-actions">
                            ${!isCompleted && options.allowCarryForward ? `
                                <button class="btn-action btn-carry" onclick="window.nexusTasks.showCarryForwardModal('${task.id}')" title="Move to Tomorrow / Carry Forward">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                                    <span class="btn-label">Move</span>
                                </button>
                            ` : ''}
                            <button class="btn-action btn-edit" onclick="window.nexusTasks.showEditModal('${task.id}')" title="Edit Task">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-action btn-delete" onclick="window.nexusTasks.confirmDelete('${task.id}')" title="Delete Task">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async handleToggleComplete(id) {
        await this.toggleComplete(id);
        if (window.nexusUI) {
            window.nexusUI.refreshCurrentView();
        }
    }

    async showEditModal(id) {
        const task = await window.nexusStorage.getTaskById(id);
        if (!task || !window.nexusUI) return;
        window.nexusUI.openTaskModal(task);
    }

    confirmDelete(id) {
        if (confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
            this.deleteTask(id).then(() => {
                if (window.nexusUI) window.nexusUI.refreshCurrentView();
            });
        }
    }

    showCarryForwardModal(id) {
        if (window.nexusUI) {
            window.nexusUI.openCarryForwardModal(id);
        }
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

    formatTimestamp(isoStr) {
        try {
            const d = new Date(isoStr);
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${mins}`;
        } catch (e) {
            return '';
        }
    }
}

// Export singleton instance
window.nexusTasks = new NexusTaskManager();
