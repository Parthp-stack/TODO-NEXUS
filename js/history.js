/**
 * NEXUS - History Engine
 * Manages permanent historical archives, dynamic multi-month browsing, Planned vs Actual tracking, and multi-filters.
 */

class NexusHistory {
    constructor() {
        this.selectedMonthKey = this.getCurrentMonthKey(); // e.g. "2026-10"
        this.selectedCategory = 'all';
        this.selectedPriority = 'all';
        this.selectedStatus = 'all';
    }

    getCurrentMonthKey() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    formatMonthKeyToDisplay(monthKey) {
        const [year, month] = monthKey.split('-');
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    /**
     * Compute all available months from recorded data + past 6 months min
     */
    async getAvailableMonths() {
        const allTasks = await window.nexusStorage.getAllTasks();
        const allRecords = await window.nexusStorage.getAllDailyRecords();

        const monthSet = new Set();
        // Always include current month
        monthSet.add(this.getCurrentMonthKey());

        // Also add the last 5 past months to ensure easy navigation even on new setups
        const now = new Date();
        for (let i = 1; i <= 5; i++) {
            const past = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mKey = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`;
            monthSet.add(mKey);
        }

        // Add from all tasks
        for (const t of allTasks) {
            if (t.planned_date) {
                monthSet.add(t.planned_date.substring(0, 7));
            }
            if (t.completed_at) {
                monthSet.add(t.completed_at.substring(0, 7));
            }
        }

        // Add from all daily records
        for (const r of allRecords) {
            if (r.record_date) {
                monthSet.add(r.record_date.substring(0, 7));
            }
        }

        // Sort descending (newest month first: October 2026, September 2026...)
        return Array.from(monthSet).sort().reverse();
    }

    /**
     * Populate month dropdown and apply current selection
     */
    async populateMonthSelector() {
        const selector = document.getElementById('history-month-select');
        if (!selector) return;

        const months = await this.getAvailableMonths();
        selector.innerHTML = months.map(mKey => `
            <option value="${mKey}" ${mKey === this.selectedMonthKey ? 'selected' : ''}>
                ${this.formatMonthKeyToDisplay(mKey)}
            </option>
        `).join('');
    }

    /**
     * Populate categories filter dropdown
     */
    async populateCategoryFilter() {
        const select = document.getElementById('history-filter-category');
        if (!select) return;

        const categories = await window.nexusStorage.getCategories();
        let options = '<option value="all">All Categories</option>';
        for (const cat of categories) {
            options += `<option value="${this.escapeHTML(cat.name)}" ${this.selectedCategory === cat.name ? 'selected' : ''}>${this.escapeHTML(cat.name)}</option>`;
        }
        select.innerHTML = options;
    }

    /**
     * Set active month and refresh view
     */
    setMonth(monthKey) {
        this.selectedMonthKey = monthKey;
        this.renderHistory();
    }

    /**
     * Set filters
     */
    setFilters(category, priority, status) {
        if (category !== undefined) this.selectedCategory = category;
        if (priority !== undefined) this.selectedPriority = priority;
        if (status !== undefined) this.selectedStatus = status;
        this.renderHistory();
    }

    /**
     * Main render function for History page
     */
    async renderHistory() {
        const container = document.getElementById('history-content-container');
        if (!container) return;

        await this.populateMonthSelector();
        await this.populateCategoryFilter();

        const allTasks = await window.nexusStorage.getAllTasks();
        const allRecords = await window.nexusStorage.getAllDailyRecords();

        // Filter tasks for selected month
        const monthPrefix = this.selectedMonthKey; // e.g. "2026-10"

        // Group tasks by planned date or completion date within this month
        const daysMap = {};

        // Helper to ensure day entry
        const getDayEntry = (dateStr) => {
            if (!daysMap[dateStr]) {
                daysMap[dateStr] = {
                    date: dateStr,
                    plannedTasks: [],
                    completedTasks: [],
                    dailyRecord: null
                };
            }
            return daysMap[dateStr];
        };

        // Populate daily records for this month
        for (const r of allRecords) {
            if (r.record_date && r.record_date.startsWith(monthPrefix)) {
                getDayEntry(r.record_date).dailyRecord = r;
            }
        }

        // Populate tasks
        for (const t of allTasks) {
            // Apply category filter
            if (this.selectedCategory !== 'all' && t.category !== this.selectedCategory) {
                continue;
            }
            // Apply priority filter
            if (this.selectedPriority !== 'all' && t.priority !== this.selectedPriority) {
                continue;
            }
            // Apply status filter
            if (this.selectedStatus !== 'all' && t.status !== this.selectedStatus) {
                continue;
            }

            // If task was planned for a date in this month
            if (t.planned_date && t.planned_date.startsWith(monthPrefix)) {
                getDayEntry(t.planned_date).plannedTasks.push(t);
            }

            // If task was completed on a date in this month (even if originally planned earlier!)
            if (t.status === 'completed' && t.completed_at) {
                const completedDate = t.completed_at.substring(0, 10);
                if (completedDate.startsWith(monthPrefix)) {
                    getDayEntry(completedDate).completedTasks.push(t);
                }
            }
        }

        // Get sorted dates in descending order (latest day first)
        const sortedDates = Object.keys(daysMap).sort().reverse();

        if (sortedDates.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <div class="empty-icon">📜</div>
                    <h3>No Records Found</h3>
                    <p>No activity or tasks recorded for ${this.formatMonthKeyToDisplay(this.selectedMonthKey)} matching the current filters.</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (const dateStr of sortedDates) {
            const dayData = daysMap[dateStr];
            html += this.renderDayHistoryCard(dayData);
        }

        container.innerHTML = html;
    }

    /**
     * Render single day Planned vs Actual comparative card
     */
    renderDayHistoryCard(dayData) {
        const { date, plannedTasks, completedTasks, dailyRecord } = dayData;
        const formattedDate = window.nexusTasks.formatDateToDisplay(date, true);
        const hasDailyReflection = dailyRecord && (dailyRecord.what_i_did || dailyRecord.notes);

        return `
            <div class="history-day-card" data-date="${date}">
                <div class="history-day-header">
                    <div class="history-date-badge">
                        <span class="history-kanji">記録</span>
                        <h3>${formattedDate}</h3>
                    </div>
                    <div class="history-header-meta">
                        <span class="meta-tag">Planned: ${plannedTasks.length}</span>
                        <span class="meta-tag meta-tag-success">Done: ${completedTasks.length}</span>
                        <button class="btn-inspect-date" onclick="window.nexusCalendar.openDateDetails('${date}')" title="Inspect Full Record">
                            <span>Open Details ↗</span>
                        </button>
                    </div>
                </div>

                <div class="planned-vs-actual-grid">
                    <!-- WHAT I PLANNED -->
                    <div class="h-column column-planned">
                        <div class="column-header">
                            <span class="col-icon">📋</span>
                            <h4>WHAT I PLANNED</h4>
                            <span class="col-kanji">計画</span>
                        </div>
                        <div class="column-content">
                            ${plannedTasks.length === 0 ? `
                                <div class="column-empty">No tasks were scheduled for this date.</div>
                            ` : plannedTasks.map(t => {
                                const isDone = t.status === 'completed';
                                const wasCarried = t.original_planned_date && t.original_planned_date !== t.planned_date;
                                return `
                                    <div class="history-task-item ${isDone ? 'is-completed' : 'is-pending'}">
                                        <div class="h-task-status-symbol">${isDone ? '✓' : '○'}</div>
                                        <div class="h-task-details">
                                            <div class="h-task-title ${isDone ? 'strikethrough' : ''}">${this.escapeHTML(t.title)}</div>
                                            <div class="h-task-meta">
                                                <span class="badge badge-category-sm">${this.escapeHTML(t.category)}</span>
                                                <span class="badge badge-priority-sm">${t.priority}</span>
                                                ${t.start_time ? `<span class="h-task-time">${t.start_time} - ${t.end_time || ''}</span>` : ''}
                                                ${wasCarried ? `<span class="badge badge-carried-sm">Orig: ${window.nexusTasks.formatDateToDisplay(t.original_planned_date)}</span>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- WHAT I ACTUALLY DID -->
                    <div class="h-column column-actual">
                        <div class="column-header">
                            <span class="col-icon">⚡</span>
                            <h4>WHAT I ACTUALLY DID</h4>
                            <span class="col-kanji">実行・実績</span>
                        </div>
                        <div class="column-content">
                            ${hasDailyReflection ? `
                                <div class="daily-reflection-box">
                                    <div class="reflection-label">DAILY SUMMARY:</div>
                                    <p class="reflection-text">${this.escapeHTML(dailyRecord.what_i_did || 'No summary text provided.')}</p>
                                    ${dailyRecord.notes ? `
                                        <div class="notes-label">ADDITIONAL NOTES:</div>
                                        <p class="notes-text">${this.escapeHTML(dailyRecord.notes)}</p>
                                    ` : ''}
                                </div>
                            ` : `
                                <div class="daily-reflection-box empty-reflection">
                                    <em>No written reflection logged for this day.</em>
                                </div>
                            `}

                            <!-- Completed tasks on this day -->
                            <div class="completed-executions-label">COMPLETED TASKS ON THIS DAY:</div>
                            ${completedTasks.length === 0 ? `
                                <div class="column-empty">No tasks logged completed on this date.</div>
                            ` : completedTasks.map(t => {
                                const completedTime = t.completed_at ? window.nexusTasks.formatTimestamp(t.completed_at) : '';
                                const originallyPlanned = t.original_planned_date || t.planned_date;
                                const isDifferentDay = originallyPlanned && originallyPlanned !== date;

                                return `
                                    <div class="history-execution-item">
                                        <div class="exec-symbol">✓</div>
                                        <div class="exec-details">
                                            <div class="exec-title">${this.escapeHTML(t.title)}</div>
                                            <div class="exec-meta">
                                                ${completedTime ? `<span class="exec-time">Completed at ${completedTime}</span>` : ''}
                                                ${isDifferentDay ? `
                                                    <span class="exec-orig-tag" title="Originally planned for ${originallyPlanned}">
                                                        (Planned on ${window.nexusTasks.formatDateToDisplay(originallyPlanned)})
                                                    </span>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
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
window.nexusHistory = new NexusHistory();
