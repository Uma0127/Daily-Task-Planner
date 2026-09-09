/* ============================================================
   DayFlow — script.js
   Daily Task Planner — Vanilla JS
   LocalStorage: dayflow-tasks | dayflow-theme
   ============================================================ */

'use strict';

/* ---------- Constants ---------- */
const STORAGE_KEY = 'dayflow-tasks';
const THEME_KEY   = 'dayflow-theme';

/* ---------- State ---------- */
let tasks        = [];
let activeFilter = 'all';
let searchQuery  = '';
let selectedDate = todayStr(); // YYYY-MM-DD

/* ---------- Date Helpers ---------- */
function todayStr() {
  const d = new Date();
  return localDateStr(d);
}

function localDateStr(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function offsetDate(base, days) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function formatDateLabel(ymd) {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function friendlyDateLabel(ymd) {
  const today     = todayStr();
  const yesterday = offsetDate(today, -1);
  if (ymd === today)     return 'Today';
  if (ymd === yesterday) return 'Yesterday';
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------- LocalStorage ---------- */
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (_) {}
}

function loadTasks() {
  try {
    const raw    = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    tasks = Array.isArray(parsed) ? parsed : [];
    // backward-compat: assign today's date to tasks missing taskDate
    const today = todayStr();
    tasks.forEach(t => { if (!t.taskDate) t.taskDate = today; });
  } catch (_) {
    tasks = [];
  }
}

/* ---------- General Helpers ---------- */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function relativeTime(task) {
  // Use taskDate for the scheduled-date label — never mix with createdAt
  if (!task.taskDate) return null;
  const today = todayStr();
  if (task.taskDate === today) return 'Added today';
  const d = new Date(task.taskDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- Statistics (date-scoped) ---------- */
function updateStats() {
  const dateTasks = tasks.filter(t => t.taskDate === selectedDate);
  const total     = dateTasks.length;
  const completed = dateTasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statPercent').textContent   = pct + '%';
  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = pct + '% complete';

  // Clear Completed scoped to selected date
  const completedOnDate = dateTasks.filter(t => t.completed).length;
  document.getElementById('clearCompletedBtn').disabled = completedOnDate === 0;
}

/* ---------- Filtering ---------- */
function getFilteredTasks() {
  return tasks.filter(t => {
    const matchesDate   = t.taskDate === selectedDate;
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'pending'   && !t.completed) ||
      (activeFilter === 'completed' &&  t.completed);
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesFilter && matchesSearch;
  });
}

/* ---------- Empty States ---------- */
function emptyStateHTML(filter, hasSearch) {
  const isToday = selectedDate === todayStr();
  const dateWord = isToday ? 'today' : 'this date';

  if (hasSearch) {
    return `<div class="df-empty">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="28" cy="28" r="16" stroke="currentColor" stroke-width="3"/>
        <path d="M40 40l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <path d="M22 28h12M28 22v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".4"/>
      </svg>
      <p class="df-empty-title">No tasks match your search</p>
      <p class="df-empty-sub">Try a different search term.</p>
    </div>`;
  }

  const states = {
    all: {
      icon: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="16" width="40" height="32" rx="6" stroke="currentColor" stroke-width="3"/>
        <path d="M20 26h24M20 32h16M20 38h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`,
      title: `No tasks scheduled for ${dateWord}`,
      sub: isToday ? 'Add your first task above to get started.' : 'No tasks were added for this date.'
    },
    pending: {
      icon: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="18" stroke="currentColor" stroke-width="3"/>
        <path d="M32 22v10l6 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      title: `No pending tasks for ${dateWord}`,
      sub: 'All caught up! Great work.'
    },
    completed: {
      icon: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="18" stroke="currentColor" stroke-width="3"/>
        <path d="M22 32l7 7 13-13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      title: `No completed tasks for ${dateWord}`,
      sub: 'Complete a task to see it here.'
    }
  };

  const s = states[filter] || states.all;
  return `<div class="df-empty">
    ${s.icon}
    <p class="df-empty-title">${s.title}</p>
    <p class="df-empty-sub">${s.sub}</p>
  </div>`;
}

/* ---------- Render ---------- */
function render() {
  renderDateNav();

  const list    = document.getElementById('taskList');
  const visible = getFilteredTasks();

  if (visible.length === 0) {
    list.innerHTML = emptyStateHTML(activeFilter, searchQuery.length > 0);
    updateStats();
    return;
  }

  list.innerHTML = visible.map(task => {
    const meta = relativeTime(task);
    return `
    <div class="df-task-item${task.completed ? ' completed' : ''}" data-id="${task.id}">
      <button class="df-checkbox" data-action="toggle"
        aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}"
        title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 6l3 3 5-5"/>
        </svg>
      </button>
      <div class="df-task-body">
        <p class="df-task-title">${escapeHtml(task.title)}</p>
        ${meta ? `<p class="df-task-meta">${meta}</p>` : ''}
      </div>
      <div class="df-task-actions">
        <button class="df-btn-icon edit" data-action="edit" aria-label="Edit task" title="Edit">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2.5a2.121 2.121 0 013 3L6 17H3v-3L14.5 2.5z"/>
          </svg>
        </button>
        <button class="df-btn-icon delete" data-action="delete" aria-label="Delete task" title="Delete">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 5h14M8 5V3h4v2M6 5l1 11h6l1-11"/>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('');

  updateStats();
}

/* ---------- Date Navigation ---------- */
function renderDateNav() {
  const label         = document.getElementById('currentDate');
  const todayIndicator = document.getElementById('todayIndicator');
  const todayNavBtn   = document.getElementById('todayBtn');
  label.textContent   = formatDateLabel(selectedDate);
  const isToday       = selectedDate === todayStr();
  // TODAY badge: visible only when viewing actual today
  todayIndicator.classList.toggle('hidden', !isToday);
  // "← Today" nav button: visible only when NOT on today
  todayNavBtn.classList.toggle('hidden', isToday);
}

function navigateDate(delta) {
  selectedDate = offsetDate(selectedDate, delta);
  render();
}

function goToToday() {
  selectedDate = todayStr();
  render();
}

/* ---------- Add Task ---------- */
function addTask() {
  const input = document.getElementById('taskInput');
  const msg   = document.getElementById('validationMsg');
  const title = input.value.trim();

  if (!title) {
    msg.textContent = 'Please enter a task title.';
    input.focus();
    return;
  }
  msg.textContent = '';

  tasks.unshift({
    id:        genId(),
    title,
    completed: false,
    taskDate:  selectedDate,
    createdAt: Date.now()
  });
  saveTasks();
  render();
  input.value = '';
  input.focus();
  showToast('Task added', '#22c55e');
}

/* ---------- Toggle ---------- */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  // taskDate is NEVER changed here
  saveTasks();
  render();
  showToast(task.completed ? 'Task completed' : 'Task reopened',
            task.completed ? '#22c55e' : '#f59e0b');
}

/* ---------- Delete ---------- */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
  showToast('Task deleted', '#ef4444');
}

/* ---------- Edit ---------- */
function startEdit(id) {
  const item = document.querySelector(`.df-task-item[data-id="${id}"]`);
  if (!item) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const body = item.querySelector('.df-task-body');
  body.innerHTML = `
    <div class="df-edit-form">
      <input class="df-edit-input" type="text" value="${escapeHtml(task.title)}"
        maxlength="200" aria-label="Edit task title" />
      <button class="df-edit-save"   data-action="save"   data-id="${id}">Save</button>
      <button class="df-edit-cancel" data-action="cancel" data-id="${id}">Cancel</button>
    </div>`;

  const editInput = body.querySelector('.df-edit-input');
  editInput.focus();
  editInput.select();

  editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveEdit(id, editInput.value);
    if (e.key === 'Escape') render();
  });
}

function saveEdit(id, rawValue) {
  const title = rawValue.trim();
  if (!title) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.title = title;
  // taskDate is NEVER changed here
  saveTasks();
  render();
  showToast('Task updated', '#5b6af0');
}

/* ---------- Clear Completed (scoped to selected date) ---------- */
function clearCompleted() {
  const count = tasks.filter(t => t.taskDate === selectedDate && t.completed).length;
  if (count === 0) return;
  if (count > 1 && !confirm(`Remove ${count} completed tasks for this date?`)) return;
  tasks = tasks.filter(t => !(t.taskDate === selectedDate && t.completed));
  saveTasks();
  render();
  showToast('Completed tasks cleared', '#ef4444');
}

/* ---------- Toast ---------- */
function showToast(message, dotColor = '#5b6af0') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast df-toast align-items-center border-0';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="toast-body d-flex align-items-center">
      <span class="df-toast-dot" style="background:${dotColor}"></span>
      ${escapeHtml(message)}
    </div>`;
  container.appendChild(el);
  const bsToast = new bootstrap.Toast(el, { delay: 2500 });
  bsToast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
}

function loadTheme() {
  let theme = 'light';
  try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (_) {}
  applyTheme(theme);
}

/* ---------- History Modal ---------- */
function openHistory() {
  const today     = todayStr();
  const yesterday = offsetDate(today, -1);

  // Collect tasks from all dates EXCEPT today, grouped by date, sorted newest first
  const pastTasks = tasks.filter(t => t.taskDate !== today);

  const backdrop = document.getElementById('historyBackdrop');
  const listEl   = document.getElementById('historyList');

  if (pastTasks.length === 0) {
    listEl.innerHTML = '<p class="df-hist-empty">No task history yet. Tasks from previous dates will appear here.</p>';
    backdrop.hidden = false;
    return;
  }

  // Group by date
  const groups = {};
  pastTasks.forEach(t => {
    if (!groups[t.taskDate]) groups[t.taskDate] = [];
    groups[t.taskDate].push(t);
  });

  // Sort dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  listEl.innerHTML = sortedDates.map(date => {
    const label = friendlyDateLabel(date);
    const rows  = groups[date].map(task => `
      <div class="df-hist-item${task.completed ? ' completed' : ''}" data-id="${task.id}">
        <button class="df-hist-checkbox" data-action="hist-toggle" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 6l3 3 5-5"/>
          </svg>
        </button>
        <span class="df-hist-title">${escapeHtml(task.title)}</span>
        <span class="df-hist-status ${task.completed ? 'completed' : 'pending'}">
          ${task.completed ? 'Completed' : 'Pending'}
        </span>
        <div class="df-hist-actions">
          <button class="df-btn-icon edit" data-action="hist-edit" aria-label="Edit task" title="Edit">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2.5a2.121 2.121 0 013 3L6 17H3v-3L14.5 2.5z"/>
            </svg>
          </button>
          <button class="df-btn-icon delete" data-action="hist-delete" aria-label="Delete task" title="Delete">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 5h14M8 5V3h4v2M6 5l1 11h6l1-11"/>
            </svg>
          </button>
        </div>
      </div>`).join('');

    return `<div class="df-hist-group">
      <p class="df-hist-date-label">${escapeHtml(label)}</p>
      ${rows}
    </div>`;
  }).join('');

  backdrop.hidden = false;
}

function closeHistory() {
  document.getElementById('historyBackdrop').hidden = true;
}

/* ---------- History inline edit ---------- */
function startHistEdit(id) {
  const item = document.querySelector(`#historyList .df-hist-item[data-id="${id}"]`);
  if (!item) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const titleEl = item.querySelector('.df-hist-title');
  const original = task.title;

  titleEl.innerHTML = `<input class="df-edit-input" style="width:100%" type="text"
    value="${escapeHtml(original)}" maxlength="200" aria-label="Edit task title" />`;

  const inp = titleEl.querySelector('input');
  inp.focus(); inp.select();

  const save = () => {
    const val = inp.value.trim();
    if (val) { task.title = val; saveTasks(); }
    openHistory();
    showToast('Task updated', '#5b6af0');
  };

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  save();
    if (e.key === 'Escape') openHistory();
  });
  inp.addEventListener('blur', () => {
    // small delay so click on save button fires first
    setTimeout(() => { if (document.activeElement !== inp) openHistory(); }, 150);
  });
}

/* ---------- Demo Data ---------- */
// Function retained to preserve existing LocalStorage data — button removed from UI

/* ============================================================
   Event Listeners
   ============================================================ */

/* Task list — delegation */
document.getElementById('taskList').addEventListener('click', e => {
  const btn  = e.target.closest('[data-action]');
  if (!btn) return;
  const item = btn.closest('.df-task-item');
  if (!item) return;
  const id     = item.dataset.id;
  const action = btn.dataset.action;

  if (action === 'toggle') toggleTask(id);
  if (action === 'edit')   startEdit(id);
  if (action === 'delete') deleteTask(id);
  if (action === 'save') {
    const inp = item.querySelector('.df-edit-input');
    if (inp) saveEdit(id, inp.value);
  }
  if (action === 'cancel') render();
});

/* History modal — delegation */
document.getElementById('historyList').addEventListener('click', e => {
  const btn  = e.target.closest('[data-action]');
  if (!btn) return;
  const item = btn.closest('.df-hist-item');
  if (!item) return;
  const id     = item.dataset.id;
  const action = btn.dataset.action;

  if (action === 'hist-toggle') {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    openHistory();
    render();
    showToast(task.completed ? 'Task completed' : 'Task reopened',
              task.completed ? '#22c55e' : '#f59e0b');
  }
  if (action === 'hist-edit')   startHistEdit(id);
  if (action === 'hist-delete') {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    openHistory();
    render();
    showToast('Task deleted', '#ef4444');
  }
});

/* Add button + Enter */
document.getElementById('addBtn').addEventListener('click', addTask);
document.getElementById('taskInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
  if (e.key !== 'Enter') document.getElementById('validationMsg').textContent = '';
});

/* Filters */
document.querySelectorAll('.df-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.df-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

/* Search */
document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value;
  render();
});

/* Clear Completed */
document.getElementById('clearCompletedBtn').addEventListener('click', clearCompleted);

/* Date navigation */
document.getElementById('prevDayBtn').addEventListener('click', () => navigateDate(-1));
document.getElementById('nextDayBtn').addEventListener('click', () => navigateDate(1));
document.getElementById('todayBtn').addEventListener('click', goToToday);

/* History open/close */
document.getElementById('historyBtn').addEventListener('click', openHistory);
document.getElementById('historyClose').addEventListener('click', closeHistory);
document.getElementById('historyBackdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('historyBackdrop')) closeHistory();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeHistory();
});

/* Demo data */
// Button removed — listener no longer needed

/* Theme toggle */
document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ---------- Init ---------- */
loadTheme();
loadTasks();
render();
