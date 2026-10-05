/**
 * NEXUS - Global Search & Filter Engine
 * Performs debounced multi-field searching across task titles, descriptions, categories,
 * daily reflections ("What I did"), and notes with compound filters.
 */

class NexusSearch {
    constructor() {
        this.query = '';
        this.category = 'all';
        this.priority = 'all';
        this.status = 'all';
        this.dateFrom = '';
        this.dateTo = '';
        this.debounceTimeout = null;
    }

    /**
     * Set search query with debounce
     */
    handleInput(query) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.query = query.trim().toLowerCase();
            this.renderSearchResults();
        }, 250);
    }

    /**
     * Update filter criteria
     */
    updateFilters({ category, priority, status, dateFrom, dateTo }) {
        if (category !== undefined) this.category = category;
        if (priority !== undefined) this.priority = priority;
        if (status !== undefined) this.status = status;
        if (dateFrom !== undefined) this.dateFrom = dateFrom;
        if (dateTo !== undefined) this.dateTo = dateTo;
        this.renderSearchResults();
    }

    resetFilters() {
        this.query = '';
        this.category = 'all';
        this.priority = 'all';
        this.status = 'all';
        this.dateFrom = '';
        this.dateTo = '';

        const input = document.getElementById('search-input-field');
        if (input) input.value = '';

        const catSelect = document.getElementById('search-filter-category');
        if (catSelect) catSelect.value = 'all';

        const prioSelect = document.getElementById('search-filter-priority');
        if (prioSelect) prioSelect.value = 'all';

        const statusSelect = document.getElementById('search-filter-status');
        if (statusSelect) statusSelect.value = 'all';

        const dateFromInput = document.getElementById('search-date-from');
        if (dateFromInput) dateFromInput.value = '';

        const dateToInput = document.getElementById('search-date-to');
        if (dateToInput) dateToInput.value = '';

        this.renderSearchResults();
    }

    async populateCategories() {
        const select = document.getElementById('search-filter-category');
        if (!select) return;

        const categories = await window.nexusStorage.getCategories();
        let options = '<option value="all">All Categories</option>';
        for (const cat of categories) {
            options += `<option value="${this.escapeHTML(cat.name)}">${this.escapeHTML(cat.name)}</option>`;
        }
        select.innerHTML = options;
    }

    /**
     * Executes search and renders matching items
     */
    async renderSearchResults() {
        const container = document.getElementById('search-results-container');
        const countBadge = document.getElementById('search-results-count');
        if (!container) return;

        const [tasks, dailyRecords] = await Promise.all([
            window.nexusStorage.getAllTasks(),
            window.nexusStorage.getAllDailyRecords()
        ]);

        const matchedTasks = [];
        const matchedRecords = [];

        // 1. Search Tasks
        for (const t of tasks) {
            // Apply category filter
            if (this.category !== 'all' && t.category !== this.category) continue;
            // Apply priority filter
            if (this.priority !== 'all' && t.priority !== this.priority) continue;
            // Apply status filter
            if (this.status !== 'all' && t.status !== this.status) continue;
            // Apply date filters
            if (this.dateFrom && t.planned_date < this.dateFrom) continue;
            if (this.dateTo && t.planned_date > this.dateTo) continue;

            // If query is provided, check title, description, category
            if (this.query) {
                const titleMatch = (t.title || '').toLowerCase().includes(this.query);
                const descMatch = (t.description || '').toLowerCase().includes(this.query);
                const catMatch = (t.category || '').toLowerCase().includes(this.query);

                if (titleMatch || descMatch || catMatch) {
                    matchedTasks.push(t);
                }
            } else {
                matchedTasks.push(t);
            }
        }

        // 2. Search Daily Records
        for (const r of dailyRecords) {
            // Date filter
            if (this.dateFrom && r.record_date < this.dateFrom) continue;
            if (this.dateTo && r.record_date > this.dateTo) continue;

            if (this.query) {
                const whatMatch = (r.what_i_did || '').toLowerCase().includes(this.query);
                const notesMatch = (r.notes || '').toLowerCase().includes(this.query);

                if (whatMatch || notesMatch) {
                    matchedRecords.push(r);
                }
            } else if (!this.status || this.status === 'all') {
                // Include records if no specific query or strict task filter
                if (r.what_i_did || r.notes) {
                    matchedRecords.push(r);
                }
            }
        }

        const totalResults = matchedTasks.length + matchedRecords.length;
        if (countBadge) {
            countBadge.textContent = `${totalResults} found`;
        }

        if (totalResults === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <div class="empty-icon">🔍</div>
                    <h3>No Records Found</h3>
                    <p>No tasks or daily notes matched your criteria. Try different keywords or reset filters.</p>
                </div>
            `;
            return;
        }

        let html = '';

        // Display Tasks section if any
        if (matchedTasks.length > 0) {
            html += `
                <div class="search-section-header">
                    <span class="sec-badge">TASKS (${matchedTasks.length})</span>
                </div>
                <div class="search-tasks-list">
                    ${matchedTasks.map(t => this.renderSearchTaskItem(t)).join('')}
                </div>
            `;
        }

        // Display Daily Records section if any
        if (matchedRecords.length > 0) {
            html += `
                <div class="search-section-header" style="margin-top: 1.5rem;">
                    <span class="sec-badge">DAILY LOGS & NOTES (${matchedRecords.length})</span>
                </div>
                <div class="search-records-list">
                    ${matchedRecords.map(r => this.renderSearchRecordItem(r)).join('')}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderSearchTaskItem(task) {
        const isDone = task.status === 'completed';
        const formattedDate = window.nexusTasks.formatDateToDisplay(task.planned_date);

        return `
            <div class="search-result-item" onclick="window.nexusTasks.showEditModal('${task.id}')">
                <div class="search-item-left">
                    <span class="search-status-icon">${isDone ? '✓' : '○'}</span>
                    <div class="search-item-main">
                        <div class="search-item-title">${this.highlightMatch(task.title)}</div>
                        ${task.description ? `<div class="search-item-desc">${this.highlightMatch(task.description)}</div>` : ''}
                        <div class="search-item-meta">
                            <span class="badge badge-category-sm">${this.highlightMatch(task.category)}</span>
                            <span class="badge badge-priority-sm">${task.priority}</span>
                            <span class="search-date-tag">📅 ${formattedDate}</span>
                            ${task.start_time ? `<span class="search-time-tag">⏰ ${task.start_time} - ${task.end_time || ''}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="search-item-right">
                    <button class="btn-inspect-sm" title="Edit or Inspect">Inspect ↗</button>
                </div>
            </div>
        `;
    }

    renderSearchRecordItem(record) {
        const formattedDate = window.nexusTasks.formatDateToDisplay(record.record_date, true);

        return `
            <div class="search-result-item result-record" onclick="window.nexusCalendar.openDateDetails('${record.record_date}')">
                <div class="search-item-left">
                    <span class="search-status-icon record-icon">📝</span>
                    <div class="search-item-main">
                        <div class="search-item-title">Daily Reflection: ${formattedDate}</div>
                        ${record.what_i_did ? `
                            <div class="search-item-desc record-preview">
                                <strong>What I Did:</strong> ${this.highlightMatch(record.what_i_did)}
                            </div>
                        ` : ''}
                        ${record.notes ? `
                            <div class="search-item-desc record-preview">
                                <strong>Notes:</strong> ${this.highlightMatch(record.notes)}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="search-item-right">
                    <button class="btn-inspect-sm" title="Open Full Date Record">Open Date ↗</button>
                </div>
            </div>
        `;
    }

    highlightMatch(text) {
        if (!text) return '';
        if (!this.query) return this.escapeHTML(text);

        const escaped = this.escapeHTML(text);
        const regex = new RegExp(`(${this.escapeRegex(this.query)})`, 'gi');
        return escaped.replace(regex, '<mark class="nexus-search-highlight">$1</mark>');
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

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Export singleton instance
window.nexusSearch = new NexusSearch();
