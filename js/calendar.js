/**
 * NEXUS - Calendar Engine
 * Renders Month and Week views, computes activity status indicators, and handles Date Details modal.
 */

class NexusCalendar {
    constructor() {
        this.currentDate = new Date();
        this.activeView = 'month'; // 'month' or 'week'
    }

    /**
     * Set calendar to specific month and year
     */
    setViewDate(year, month) {
        this.currentDate = new Date(year, month, 1);
        this.renderCalendar();
    }

    prevPeriod() {
        if (this.activeView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        }
        this.renderCalendar();
    }

    nextPeriod() {
        if (this.activeView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        }
        this.renderCalendar();
    }

    jumpToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }

    switchView(viewMode) {
        this.activeView = viewMode;
        this.renderCalendar();
    }

    /**
     * Main render function for the Calendar page
     */
    async renderCalendar() {
        const container = document.getElementById('calendar-view-container');
        if (!container) return;

        const allTasks = await window.nexusStorage.getAllTasks();
        const allRecords = await window.nexusStorage.getAllDailyRecords();

        // Map tasks by date
        const tasksByDate = {};
        for (const t of allTasks) {
            if (!tasksByDate[t.planned_date]) tasksByDate[t.planned_date] = [];
            tasksByDate[t.planned_date].push(t);
        }

        // Map daily records by date
        const recordsByDate = {};
        for (const r of allRecords) {
            recordsByDate[r.record_date] = r;
        }

        if (this.activeView === 'month') {
            container.innerHTML = this.renderMonthView(tasksByDate, recordsByDate);
        } else {
            container.innerHTML = this.renderWeekView(tasksByDate, recordsByDate);
        }

        // Update header label
        this.updateHeaderLabel();
    }

    updateHeaderLabel() {
        const labelEl = document.getElementById('calendar-period-label');
        if (!labelEl) return;

        const monthNames = [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];

        if (this.activeView === 'month') {
            labelEl.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        } else {
            const startOfWeek = new Date(this.currentDate);
            startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            labelEl.textContent = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} – ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
        }
    }

    /**
     * Compute activity indicator for a date
     * Green = all tasks completed (>0)
     * Yellow = some completed, some pending
     * Red = has unfinished/overdue tasks on past date or today
     * Gray = no tasks
     */
    getDayStatus(dateStr, tasks) {
        if (!tasks || tasks.length === 0) {
            return { type: 'gray', label: 'No tasks', completedCount: 0, totalCount: 0 };
        }

        const totalCount = tasks.length;
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const pendingCount = totalCount - completedCount;

        const todayStr = window.nexusTasks.getTodayDateString();

        if (completedCount === totalCount) {
            return { type: 'green', label: 'All completed', completedCount, totalCount };
        }

        if (completedCount > 0 && pendingCount > 0) {
            return { type: 'yellow', label: 'Partially completed', completedCount, totalCount };
        }

        if (dateStr <= todayStr && pendingCount > 0) {
            return { type: 'red', label: 'Unfinished / Overdue', completedCount, totalCount };
        }

        return { type: 'pending', label: 'Planned', completedCount, totalCount };
    }

    /**
     * Render 7x5 or 7x6 month grid
     */
    renderMonthView(tasksByDate, recordsByDate) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const todayStr = window.nexusTasks.getTodayDateString();

        let cellsHtml = '';

        // Day of week headers
        const dayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        let headersHtml = dayHeaders.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

        // Previous month padding days
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevMonthDate = new Date(year, month - 1, dayNum);
            const dateStr = window.nexusTasks.formatDateToISO(prevMonthDate);
            cellsHtml += this.renderDayCell(dateStr, dayNum, true, tasksByDate[dateStr], recordsByDate[dateStr], todayStr);
        }

        // Current month days
        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const thisDate = new Date(year, month, dayNum);
            const dateStr = window.nexusTasks.formatDateToISO(thisDate);
            cellsHtml += this.renderDayCell(dateStr, dayNum, false, tasksByDate[dateStr], recordsByDate[dateStr], todayStr);
        }

        // Next month padding days to fill grid of 35 or 42
        const totalRendered = firstDay + daysInMonth;
        const remainingCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
        for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
            const nextMonthDate = new Date(year, month + 1, nextDay);
            const dateStr = window.nexusTasks.formatDateToISO(nextMonthDate);
            cellsHtml += this.renderDayCell(dateStr, nextDay, true, tasksByDate[dateStr], recordsByDate[dateStr], todayStr);
        }

        return `
            <div class="calendar-grid-wrapper">
                <div class="calendar-weekdays-row">${headersHtml}</div>
                <div class="calendar-days-grid">${cellsHtml}</div>
                <div class="calendar-legend">
                    <span class="legend-item"><span class="indicator-dot dot-green"></span> Completed</span>
                    <span class="legend-item"><span class="indicator-dot dot-yellow"></span> In Progress</span>
                    <span class="legend-item"><span class="indicator-dot dot-red"></span> Unfinished</span>
                    <span class="legend-item"><span class="indicator-dot dot-gray"></span> Empty</span>
                    <span class="legend-item"><span class="indicator-dot dot-record"></span> Daily Record Logged</span>
                </div>
            </div>
        `;
    }

    renderDayCell(dateStr, dayNum, isOtherMonth, tasks = [], dailyRecord = null, todayStr) {
        const isToday = dateStr === todayStr;
        const status = this.getDayStatus(dateStr, tasks);
        const hasRecord = dailyRecord && (dailyRecord.what_i_did || dailyRecord.notes);

        return `
            <div class="cal-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} status-${status.type}"
                 onclick="window.nexusCalendar.openDateDetails('${dateStr}')"
                 data-date="${dateStr}"
                 tabindex="0"
                 role="button"
                 title="${window.nexusTasks.formatDateToDisplay(dateStr)}: ${status.totalCount} tasks, ${status.completedCount} completed">
                <div class="cell-top">
                    <span class="cell-day-number">${dayNum}</span>
                    <div class="cell-indicators">
                        ${hasRecord ? '<span class="cell-record-badge" title="Daily log recorded">📝</span>' : ''}
                        <span class="cell-indicator-dot dot-${status.type}"></span>
                    </div>
                </div>
                <div class="cell-content">
                    ${tasks.length > 0 ? `
                        <div class="cell-task-count">
                            <span class="count-done">${status.completedCount}</span>/<span class="count-total">${status.totalCount}</span>
                        </div>
                        <div class="cell-mini-progress">
                            <div class="cell-mini-bar" style="width: ${Math.round((status.completedCount / status.totalCount) * 100)}%"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render week view
     */
    renderWeekView(tasksByDate, recordsByDate) {
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
        const todayStr = window.nexusTasks.getTodayDateString();

        let daysHtml = '';
        const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const dateStr = window.nexusTasks.formatDateToISO(date);
            const tasks = tasksByDate[dateStr] || [];
            const record = recordsByDate[dateStr];
            const isToday = dateStr === todayStr;
            const status = this.getDayStatus(dateStr, tasks);

            daysHtml += `
                <div class="cal-week-col ${isToday ? 'is-today' : ''}">
                    <div class="week-col-header" onclick="window.nexusCalendar.openDateDetails('${dateStr}')">
                        <span class="week-day-name">${dayNames[date.getDay()]}</span>
                        <span class="week-day-num">${date.getDate()}</span>
                        <span class="cell-indicator-dot dot-${status.type}"></span>
                    </div>
                    <div class="week-col-tasks">
                        ${tasks.length === 0 ? `
                            <div class="week-empty-notice">No tasks</div>
                        ` : tasks.map(t => `
                            <div class="week-mini-task ${t.status === 'completed' ? 'is-done' : ''}" onclick="window.nexusTasks.showEditModal('${t.id}')">
                                <span class="mini-task-status">${t.status === 'completed' ? '✓' : '○'}</span>
                                <span class="mini-task-title">${this.escapeHTML(t.title)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-add-week-task" onclick="window.nexusUI.openTaskModal(null, '${dateStr}')">
                        + Add Task
                    </button>
                </div>
            `;
        }

        return `<div class="calendar-week-grid">${daysHtml}</div>`;
    }

    /**
     * Open Date Details modal
     */
    async openDateDetails(dateStr) {
        const tasks = await window.nexusStorage.getTasksByDate(dateStr);
        const record = await window.nexusStorage.getDailyRecord(dateStr);

        const modal = document.getElementById('date-details-modal');
        if (!modal) return;

        const titleEl = document.getElementById('date-details-title');
        const plannedContainer = document.getElementById('date-details-planned');
        const completedContainer = document.getElementById('date-details-completed');
        const uncompletedContainer = document.getElementById('date-details-uncompleted');
        const whatIDidEl = document.getElementById('date-details-what-i-did');
        const notesEl = document.getElementById('date-details-notes');
        const dateInputEl = document.getElementById('date-details-hidden-date');

        if (dateInputEl) dateInputEl.value = dateStr;
        if (titleEl) {
            titleEl.textContent = window.nexusTasks.formatDateToDisplay(dateStr, true);
        }

        const completedTasks = tasks.filter(t => t.status === 'completed');
        const uncompletedTasks = tasks.filter(t => t.status !== 'completed');

        // Planned Summary
        if (plannedContainer) {
            plannedContainer.innerHTML = tasks.length === 0
                ? '<div class="empty-state-text">No tasks were planned for this date.</div>'
                : `<div class="planned-stat-summary">Total Tasks Planned: <strong>${tasks.length}</strong></div>`;
        }

        // Completed Tasks List
        if (completedContainer) {
            completedContainer.innerHTML = completedTasks.length === 0
                ? '<div class="empty-state-text">No tasks completed on this date.</div>'
                : completedTasks.map(t => window.nexusTasks.renderTaskCard(t, { showDate: false, allowCarryForward: false })).join('');
        }

        // Uncompleted Tasks List
        if (uncompletedContainer) {
            uncompletedContainer.innerHTML = uncompletedTasks.length === 0
                ? '<div class="empty-state-text">No pending or unfinished tasks.</div>'
                : uncompletedTasks.map(t => window.nexusTasks.renderTaskCard(t, { showDate: false, allowCarryForward: true })).join('');
        }

        // What I Did
        if (whatIDidEl) {
            whatIDidEl.textContent = (record && record.what_i_did)
                ? record.what_i_did
                : 'No reflection recorded for this day.';
        }

        // Notes
        if (notesEl) {
            notesEl.textContent = (record && record.notes)
                ? record.notes
                : 'No additional notes logged.';
        }

        modal.classList.add('is-active');
        if (window.nexusUI) window.nexusUI.playSound('modal');
    }

    closeDateDetails() {
        const modal = document.getElementById('date-details-modal');
        if (modal) modal.classList.remove('is-active');
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
window.nexusCalendar = new NexusCalendar();
