
/* FinanceFlow Phase 5: MySQL-backed frontend */
'use strict';

// Step 25.5: Change this to your real Render backend URL after deployment.
// No trailing slash and no /api suffix: the code appends /api below.
const DEPLOYED_BACKEND_URL = 'https://YOUR-BACKEND-NAME.onrender.com';
const IS_LOCAL_FRONTEND = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = IS_LOCAL_FRONTEND
  ? 'http://localhost:5000/api'
  : `${DEPLOYED_BACKEND_URL.replace(/\/$/, '')}/api`;

const $ = id => document.getElementById(id);

const currency = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: settings.currency,
    maximumFractionDigits: 2
  }).format(Number(n) || 0);

const localDate = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const currentMonth = () => localDate(new Date()).slice(0, 7);

const selectedMonth = () =>
  $('monthPicker').value || currentMonth();

const monthLabel = month =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

const dateLabel = date =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

const escapeHTML = value =>
  String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

let token = null;
let user = null;
let transactions = [];
let categories = [];
let budget = 0;
let summary = null;
let reports = null;
let charts = {};
let toastTimer;
let authMode = 'login';
let loadSequence = 0;
let settings = { currency: 'INR', theme: 'light', budget_alert_enabled: true, alert_threshold: 80 };
let lastAlertKey = '';

// Notifications
function notify(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('visible');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, 3200);
}

function loading(on) {
  $('loadingOverlay').hidden = !on;
}

// Backend API connection
async function api(path, options = {}) {
  const headers = {
    ...(options.body
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {})
  };

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });
  } catch {
    throw new Error(IS_LOCAL_FRONTEND
      ? 'Cannot reach local backend. Start npm run dev on port 5000 and use Live Server.'
      : 'Cannot reach deployed backend. Check the Render URL, service status, and FRONTEND_ORIGIN.');
  }

  let result;

  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (response.status === 401 && token) {
    logout();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(
      result.error || `Request failed (${response.status})`
    );
  }

  return result;
}

// Authentication
function showAuth() {
  $('dashboardApp').hidden = true;
  $('authScreen').hidden = false;
  loading(false);
}

function showDashboard() {
  $('authScreen').hidden = true;
  $('dashboardApp').hidden = false;

  $('accountLabel').textContent =
    user?.name || user?.email || 'Signed in';
}

function logout() {
  token = null;
  user = null;
  transactions = [];
  categories = [];
  budget = 0;
  summary = null;
  reports = null;
  loadSequence++;
  settings = { currency: 'INR', theme: 'light', budget_alert_enabled: true, alert_threshold: 80 };
  document.body.classList.remove('theme-dark');
  lastAlertKey = '';

  showAuth();
  $('authPassword').value = '';
}

function switchAuth() {
  authMode = authMode === 'login' ? 'register' : 'login';

  const register = authMode === 'register';

  $('authHeading').textContent =
    register ? 'Create an account' : 'Welcome back';

  $('authSubheading').textContent = register
    ? 'Start tracking your finances securely.'
    : 'Sign in to view your personal finance dashboard.';

  $('nameField').hidden = !register;
  $('authName').required = register;

  $('authPassword').autocomplete = register
    ? 'new-password'
    : 'current-password';

  $('authSubmit').textContent =
    register ? 'Create account' : 'Sign in';

  $('authSwitchPrompt').textContent = register
    ? 'Already have an account?'
    : 'New to FinanceFlow?';

  $('authSwitch').textContent =
    register ? 'Sign in' : 'Create account';

  $('authError').hidden = true;
}

async function submitAuth(e) {
  e.preventDefault();

  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  const btn = $('authSubmit');

  btn.disabled = true;
  $('authError').hidden = true;

  try {
    if (authMode === 'register') {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: $('authName').value.trim(),
          email,
          password
        })
      });

      switchAuth();
      $('authPassword').value = '';

      notify('Account created. Sign in to continue.');
      return;
    }

    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    token = result.token;
    user = result.user;

    $('authPassword').value = '';

    showDashboard();
    await loadCategories();
    await loadSettings();
    await refreshMonth();

  } catch (err) {
    $('authError').textContent = err.message;
    $('authError').hidden = false;
  } finally {
    btn.disabled = false;
  }
}

// Categories
async function loadCategories() {
  const result = await api('/categories');
  categories = result.categories || [];
  updateCategories();
}

// Transaction normalization
function normalizeTransaction(t) {
  return {
    id: String(t.transaction_id),
    description: t.description,
    amount: Number(t.amount),
    type: t.transaction_type,
    category: t.category_name,
    categoryId: Number(t.category_id),
    date: String(t.transaction_date).slice(0, 10)
  };
}

// FIXED: Independent dashboard API loading
async function refreshMonth() {
  const month = selectedMonth();
  const seq = ++loadSequence;

  loading(true);

  try {
    const paths = [
      `/transactions?month=${month}`,
      `/dashboard/summary?month=${month}`,
      `/budgets?month=${month}`,
      `/reports?month=${month}`
    ];

    const results = await Promise.allSettled(
      paths.map(path => api(path))
    );

    if (seq !== loadSequence) return;

    const [
      txResult,
      summaryResult,
      budgetResult,
      reportsResult
    ] = results;

    transactions =
      txResult.status === 'fulfilled'
        ? (txResult.value.transactions || []).map(
            normalizeTransaction
          )
        : [];

    summary =
      summaryResult.status === 'fulfilled'
        ? summaryResult.value
        : null;

    budget =
      budgetResult.status === 'fulfilled'
        ? Number(budgetResult.value.limit_amount || 0)
        : 0;

    reports =
      reportsResult.status === 'fulfilled'
        ? reportsResult.value
        : null;

    // Render successful data even when one API fails
    render();

    const failed = results
      .map((result, index) =>
        result.status === 'rejected'
          ? `${[
              'Transactions',
              'Summary',
              'Budget',
              'Reports'
            ][index]}: ${result.reason.message}`
          : null
      )
      .filter(Boolean);

    if (failed.length) {
      console.error(
        'FinanceFlow dashboard API errors:',
        failed
      );

      notify(
        `Some data could not load: ${
          failed.map(x => x.split(':')[0]).join(', ')
        }`
      );
    }

  } catch (err) {
    if (seq === loadSequence) {
      notify(err.message);
    }
  } finally {
    if (seq === loadSequence) {
      loading(false);
    }
  }
}

// Navigation
function navigate(page) {
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle(
      'active',
      p.id === `page-${page}`
    )
  );

  document.querySelectorAll('.nav-link').forEach(n =>
    n.classList.toggle(
      'active',
      n.dataset.page === page
    )
  );

  $('pageTitle').textContent = ({
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    budgets: 'Budgets',
    reports: 'Reports',
    settings: 'Settings'
  })[page];

  $('sidebar').classList.remove('open');
  render();
}

// Transaction table row
function transactionRow(t, editable) {
  return `
    <tr>
      <td class="description-cell">
        ${escapeHTML(t.description)}
      </td>
      <td>${escapeHTML(t.category)}</td>
      <td>${dateLabel(t.date)}</td>
      <td>
        <span class="badge ${t.type}">
          ${t.type === 'income' ? 'Income' : 'Expense'}
        </span>
      </td>
      <td class="money-${t.type}">
        ${t.type === 'income' ? '+' : '−'}
        ${currency(t.amount)}
      </td>
      ${
        editable
          ? `<td>
              <button class="action-btn"
                data-edit="${t.id}">Edit</button>
              <button class="action-btn delete"
                data-delete="${t.id}">Delete</button>
            </td>`
          : ''
      }
    </tr>
  `;
}

// Render transaction tables
function renderTables() {
  const list = [...transactions].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      Number(b.id) - Number(a.id)
  );

  $('recentBody').innerHTML = list.length
    ? list.slice(0, 5)
        .map(t => transactionRow(t, false))
        .join('')
    : '<tr><td colspan="5" class="empty">No transactions for this month.</td></tr>';

  const q = $('searchInput').value.trim().toLowerCase();
  const type = $('typeFilter').value;

  const filtered = list.filter(t =>
    (type === 'all' || t.type === type) &&
    `${t.description} ${t.category}`
      .toLowerCase()
      .includes(q)
  );

  $('transactionsBody').innerHTML = filtered.length
    ? filtered.map(t => transactionRow(t, true)).join('')
    : '<tr><td colspan="6" class="empty">No matching transactions found.</td></tr>';

  $('transactionCount').textContent =
    `Showing ${filtered.length} of ${list.length} transactions for ${monthLabel(selectedMonth())}`;
}

// Reports
function categoryData() {
  return (reports?.categories || []).map(c => [
    c.category_name,
    Number(c.total)
  ]);
}

function trendData() {
  const [y, m] = selectedMonth().split('-').map(Number);

  const lookup = new Map(
    (reports?.trend || []).map(x => [x.month, x])
  );

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, m - 1 - (5 - i), 1);

    const key =
      `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, '0')}`;

    const t = lookup.get(key);

    return {
      label: d.toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit'
      }),
      income: Number(t?.income || 0),
      expense: Number(t?.expenses || 0)
    };
  });
}

// Dashboard statistics
function renderStats() {
  const income = Number(summary?.income || 0);
  const expense = Number(summary?.expenses || 0);
  const balance = income - expense;

  $('incomeTotal').textContent = currency(income);
  $('expenseTotal').textContent = currency(expense);
  $('balanceTotal').textContent = currency(balance);
  $('budgetTotal').textContent = currency(budget);

  $('budgetNote').textContent = budget
    ? `${Math.round(expense / budget * 100)}% used this month`
    : 'Set a budget to get started';

  $('budgetMonthLabel').textContent =
    monthLabel(selectedMonth());

  $('budgetInput').value = budget || '';

  $('budgetSpent').textContent =
    `${currency(expense)} spent`;

  $('budgetLimit').textContent =
    `of ${currency(budget)}`;

  const ratio = budget ? expense / budget * 100 : 0;

  $('budgetProgress').style.width =
    `${Math.min(ratio, 100)}%`;

  $('budgetProgress').classList.toggle(
    'over',
    ratio > 100
  );

  $('budgetStatus').textContent = !budget
    ? 'Set a monthly budget to begin.'
    : ratio > 100
      ? `Budget exceeded by ${currency(expense - budget)}.`
      : `${currency(budget - expense)} remaining in your budget.`;

  $('savingsRate').textContent = income
    ? `${((balance / income) * 100).toFixed(1)}%`
    : '—';

  $('reportCount').textContent =
    summary?.transaction_count || 0;

  $('topCategory').textContent =
    categoryData()[0]?.[0] || '—';
  checkBudgetAlert(expense);
}

// Charts
function drawChart(id, config) {
  if (typeof Chart === 'undefined') return;

  if (charts[id]) {
    charts[id].destroy();
  }

  charts[id] = new Chart($(id), config);
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const trend = trendData();
  const cats = categoryData();

  const palette = [
    '#5268e9',
    '#30b68a',
    '#f4ad55',
    '#e46f80',
    '#8b7bde',
    '#50b7d2',
    '#a0a9bd',
    '#e3a3cc',
    '#94b85c'
  ];

  const trendConfig = () => ({
    type: 'bar',
    data: {
      labels: trend.map(t => t.label),
      datasets: [
        {
          label: 'Income',
          data: trend.map(t => t.income),
          backgroundColor: '#5268e9',
          borderRadius: 5
        },
        {
          label: 'Expenses',
          data: trend.map(t => t.expense),
          backgroundColor: '#f4ad55',
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v =>
              '₹' + Number(v).toLocaleString('en-IN')
          }
        }
      }
    }
  });

  const catConfig = () => ({
    type: 'doughnut',
    data: {
      labels: cats.length
        ? cats.map(x => x[0])
        : ['No expenses'],
      datasets: [{
        data: cats.length
          ? cats.map(x => x[1])
          : [1],
        backgroundColor: cats.length
          ? palette
          : ['#e9edf5'],
        borderWidth: 3,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          enabled: cats.length > 0,
          callbacks: {
            label: c =>
              `${c.label}: ${currency(c.parsed)}`
          }
        }
      }
    }
  });

  drawChart('trendChart', trendConfig());
  drawChart('categoryChart', catConfig());
  drawChart('reportTrendChart', trendConfig());
  drawChart('reportCategoryChart', catConfig());
}

function render() {
  renderStats();
  renderTables();
  renderCharts();
}

// Category dropdown
function updateCategories() {
  const type = $('transactionType').value;

  const list = categories.filter(
    c => c.category_type === type
  );

  $('categoryInput').innerHTML = list
    .map(c =>
      `<option value="${Number(c.category_id)}">${escapeHTML(c.category_name)}</option>`
    )
    .join('');
}

// Transaction modal
function openModal(id) {
  $('transactionForm').reset();
  $('editId').value = '';
  $('modalTitle').textContent = 'Add Transaction';

  $('transactionType').value = 'expense';
  updateCategories();

  $('dateInput').value =
    selectedMonth() === currentMonth()
      ? localDate(new Date())
      : `${selectedMonth()}-01`;

  if (id) {
    const t = transactions.find(x => x.id === id);

    if (!t) return;

    $('modalTitle').textContent = 'Edit Transaction';
    $('editId').value = t.id;
    $('descriptionInput').value = t.description;
    $('amountInput').value = t.amount;
    $('transactionType').value = t.type;

    updateCategories();

    $('categoryInput').value = String(t.categoryId);
    $('dateInput').value = t.date;
  }

  $('transactionDialog').showModal();
}

// CSV export
function exportCSV() {
  const list = [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  if (!list.length) {
    notify('No transactions to export for this month.');
    return;
  }

  const safe = v => {
    let s = String(v);

    if (/^[\s]*[=+@-]/.test(s)) {
      s = "'" + s;
    }

    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = [
    ['Date', 'Description', 'Category', 'Type', 'Amount'],
    ...list.map(t => [
      t.date,
      t.description,
      t.category,
      t.type,
      t.amount
    ])
  ];

  const csv = '\uFEFF' +
    rows.map(row => row.map(safe).join(',')).join('\r\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download =
    `finance-transactions-${selectedMonth()}.csv`;

  document.body.append(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  notify('CSV export ready.');
}

// Add or edit transaction
async function saveTransaction(e) {
  e.preventDefault();

  const description = $('descriptionInput').value.trim();
  const amount = Number($('amountInput').value);
  const transaction_type = $('transactionType').value;
  const category_id = Number($('categoryInput').value);
  const transaction_date = $('dateInput').value;
  const id = $('editId').value;

  if (
    !description ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isInteger(category_id) ||
    category_id <= 0
  ) {
    notify('Enter valid transaction details.');
    return;
  }

  const body = {
    description,
    amount,
    transaction_type,
    category_id,
    transaction_date
  };

  const button = $('transactionForm')
    .querySelector('[type="submit"]');

  button.disabled = true;

  try {
    await api(
      id ? `/transactions/${id}` : '/transactions',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      }
    );

    $('transactionDialog').close();

    $('monthPicker').value =
      transaction_date.slice(0, 7);

    await refreshMonth();

    notify(
      id ? 'Transaction updated.' : 'Transaction added.'
    );

  } catch (err) {
    notify(err.message);
  } finally {
    button.disabled = false;
  }
}

// Save monthly budget
async function saveBudget(e) {
  e.preventDefault();

  const amount = Number($('budgetInput').value);

  if (!Number.isFinite(amount) || amount < 0) {
    notify('Enter a valid budget amount.');
    return;
  }

  const button = $('budgetForm')
    .querySelector('[type="submit"]');

  button.disabled = true;

  try {
    await api('/budgets', {
      method: 'PUT',
      body: JSON.stringify({
        month: selectedMonth(),
        limit_amount: amount
      })
    });

    await refreshMonth();
    notify('Monthly budget saved.');

  } catch (err) {
    notify(err.message);
  } finally {
    button.disabled = false;
  }
}

// Phase 6 user settings
function applySettings() {
  document.body.classList.toggle('theme-dark', settings.theme === 'dark');
  $('settingsCurrency').value = settings.currency;
  $('settingsTheme').value = settings.theme;
  $('settingsAlerts').checked = Boolean(settings.budget_alert_enabled);
  $('settingsThreshold').value = settings.alert_threshold;
  $('settingsThreshold').disabled = !settings.budget_alert_enabled;
}

async function loadSettings() {
  try {
    const data = await api('/settings');
    if (data.settings) {
      settings = {
        currency: data.settings.currency || 'INR',
        theme: data.settings.theme || 'light',
        budget_alert_enabled: Boolean(data.settings.budget_alert_enabled),
        alert_threshold: Number(data.settings.alert_threshold) || 80
      };
    }
    applySettings();
  } catch (err) {
    console.error('Settings load failed:', err);
    notify('Settings unavailable: ' + err.message);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    currency: $('settingsCurrency').value,
    theme: $('settingsTheme').value,
    budget_alert_enabled: $('settingsAlerts').checked,
    alert_threshold: Number($('settingsThreshold').value)
  };
  if (!Number.isInteger(payload.alert_threshold) || payload.alert_threshold < 1 || payload.alert_threshold > 100) {
    notify('Alert threshold must be between 1 and 100.');
    return;
  }
  const btn = $('settingsForm').querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await api('/settings', { method: 'PUT', body: JSON.stringify(payload) });
    settings = payload;
    lastAlertKey = '';
    applySettings();
    render();
    notify('Settings saved successfully.');
  } catch (err) {
    notify(err.message);
  } finally {
    btn.disabled = false;
  }
}

function checkBudgetAlert(expenses) {
  const banner = $('dashboardBudgetAlert');
  const validData = summary !== null && Number.isFinite(expenses);
  const enabled = Boolean(settings.budget_alert_enabled);
  const limit = Number(budget);
  const threshold = Number(settings.alert_threshold);

  // Never show an alert for missing data, disabled alerts or a zero budget.
  if (!validData || !enabled || !Number.isFinite(limit) || limit <= 0 ||
      !Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
    banner.hidden = true;
    banner.classList.remove('is-over');
    lastAlertKey = '';
    return;
  }

  const percentage = (expenses / limit) * 100;
  if (percentage < threshold) {
    banner.hidden = true;
    banner.classList.remove('is-over');
    lastAlertKey = '';
    return;
  }

  const over = percentage > 100;
  const reached = percentage >= 100;
  $('dashboardBudgetAlertTitle').textContent = over
    ? 'Monthly budget exceeded!'
    : reached ? 'Monthly budget fully used!' : 'Budget alert threshold reached!';
  $('dashboardBudgetAlertMessage').textContent = over
    ? `${percentage.toFixed(1)}% used — ${currency(expenses - limit)} over your ${monthLabel(selectedMonth())} budget.`
    : reached
      ? `You have spent 100% of your ${monthLabel(selectedMonth())} budget.`
      : `You have used ${percentage.toFixed(1)}% of your ${monthLabel(selectedMonth())} budget (alert threshold: ${threshold}%).`;
  banner.classList.toggle('is-over', reached);
  banner.hidden = false;

  // The dashboard warning stays visible; a toast is only shown for new usage.
  const key = `${selectedMonth()}:${limit}:${expenses}:${threshold}`;
  if (key !== lastAlertKey) {
    lastAlertKey = key;
    notify(`Budget alert: ${percentage.toFixed(1)}% of monthly budget used.`);
  }
}

// Initialize dashboard events
function init() {
  $('monthPicker').value = currentMonth();

  $('authForm').addEventListener('submit', submitAuth);
  $('authSwitch').addEventListener('click', switchAuth);
  $('logoutBtn').addEventListener('click', logout);

  document.querySelectorAll('.nav-link').forEach(b =>
    b.addEventListener('click', () =>
      navigate(b.dataset.page)
    )
  );

  document.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () =>
      navigate(b.dataset.go)
    )
  );

  $('menuToggle').addEventListener('click', () =>
    $('sidebar').classList.toggle('open')
  );

  $('monthPicker').addEventListener(
    'change',
    refreshMonth
  );

  $('searchInput').addEventListener(
    'input',
    renderTables
  );

  $('typeFilter').addEventListener(
    'change',
    renderTables
  );

  $('addTransactionBtn').addEventListener(
    'click',
    () => openModal()
  );

  $('closeModal').addEventListener('click', () =>
    $('transactionDialog').close()
  );

  $('cancelModal').addEventListener('click', () =>
    $('transactionDialog').close()
  );

  $('transactionType').addEventListener(
    'change',
    updateCategories
  );

  $('exportBtn').addEventListener('click', exportCSV);

  $('transactionForm').addEventListener(
    'submit',
    saveTransaction
  );

  $('budgetForm').addEventListener(
    'submit',
    saveBudget
  );
  $('settingsForm').addEventListener('submit', saveSettings);
  $('settingsAlerts').addEventListener('change', () => {
    $('settingsThreshold').disabled = !$('settingsAlerts').checked;
  });

  $('transactionsBody').addEventListener(
    'click',
    async e => {
      const edit = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-delete]');

      if (edit) {
        openModal(edit.dataset.edit);
      }

      if (
        del &&
        confirm('Delete this transaction?')
      ) {
        del.disabled = true;

        try {
          await api(
            `/transactions/${del.dataset.delete}`,
            { method: 'DELETE' }
          );

          await refreshMonth();
          notify('Transaction deleted.');

        } catch (err) {
          notify(err.message);
        } finally {
          del.disabled = false;
        }
      }
    }
  );

  showAuth();
}

document.addEventListener('DOMContentLoaded', init);
