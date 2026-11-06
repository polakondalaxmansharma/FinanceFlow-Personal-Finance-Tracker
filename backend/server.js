
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./config/db');
const auth = require('./middleware/auth');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());

// Step 25.5: Allow local Live Server and the exact deployed frontend origin.
// In Render, set FRONTEND_ORIGIN=https://your-frontend-domain.example
// Multiple allowed origins can be comma-separated; never use '*' with private APIs.
const localOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];
const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(x => x.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = [...new Set([...localOrigins, ...configuredOrigins])];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS origin not allowed'));
  }
}));

app.use(express.json({ limit: '32kb' }));

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

const route = express.Router();

const fail = (res, status, message) =>
  res.status(status).json({ error: message });

const asyncRoute = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const validMonth = value =>
  typeof value === 'string' &&
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const monthRange = month => {
  const [y, m] = month.split('-').map(Number);

  const next = m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  return [month + '-01', next];
};

const validDate = value => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const d = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value;
};

const validMoney = (v, allowZero = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  if (allowZero ? v < 0 : v <= 0) return false;

  return v <= 9999999999.99 &&
    Math.abs(Math.round(v * 100) - v * 100) < 0.00001;
};

const validId = x =>
  /^\d+$/.test(String(x)) &&
  Number.isSafeInteger(Number(x)) &&
  Number(x) > 0;

const cleanTransaction = body => {
  const {
    category_id,
    transaction_type,
    description,
    amount,
    transaction_date
  } = body;

  if (
    !validId(category_id) ||
    !['income', 'expense'].includes(transaction_type) ||
    typeof description !== 'string' ||
    !description.trim() ||
    description.length > 255 ||
    !validMoney(amount) ||
    !validDate(transaction_date)
  ) return null;

  return {
    category_id: Number(category_id),
    transaction_type,
    description: description.trim(),
    amount,
    transaction_date
  };
};

// DATABASE HEALTH CHECK

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.json({
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);

    res.status(503).json({
      status: 'error',
      database: 'disconnected'
    });
  }
});

// USER REGISTRATION

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body || {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 120 ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 255 ||
    typeof password !== 'string' ||
    password.length < 10 ||
    password.length > 72
  ) {
    return fail(res, 400, 'Provide a name, valid email and password (10-72 characters)');
  }

  const hash = await bcrypt.hash(password, 12);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      'INSERT INTO users (full_name,email,password_hash) VALUES (?,?,?)',
      [name.trim(), email.trim().toLowerCase(), hash]
    );

    const userId = result.insertId;

    const presets = {
      income: [
        'Salary', 'Freelancing', 'Allowance',
        'Investment', 'Other Income'
      ],
      expense: [
        'Food', 'Shopping', 'Transport', 'Bills',
        'Education', 'Health', 'Entertainment',
        'Rent', 'Other Expense'
      ]
    };

    for (const [type, names] of Object.entries(presets)) {
      for (const category of names) {
        await conn.execute(
          'INSERT INTO categories (user_id,category_name,category_type) VALUES (?,?,?)',
          [userId, category, type]
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      message: 'Account created',
      user: {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase()
      }
    });
  } catch (e) {
    await conn.rollback();

    if (e.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'Email already registered');
    }

    throw e;
  } finally {
    conn.release();
  }
}));

// USER LOGIN

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return fail(res, 400, 'Email and password required');
  }

  const [rows] = await db.execute(
    'SELECT user_id,full_name,email,password_hash FROM users WHERE email=?',
    [email.trim().toLowerCase()]
  );

  if (
    !rows.length ||
    !(await bcrypt.compare(password, rows[0].password_hash))
  ) {
    return fail(res, 401, 'Invalid email or password');
  }

  const user = rows[0];

  const token = jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: String(user.user_id),
      expiresIn: '2h',
      algorithm: 'HS256'
    }
  );

  res.json({
    token,
    expires_in: 7200,
    user: {
      id: user.user_id,
      name: user.full_name,
      email: user.email
    }
  });
}));

// PROTECTED ROUTES

route.use(auth);

// GET CATEGORIES

route.get('/categories', asyncRoute(async (req, res) => {
  const [rows] = await db.execute(
    `SELECT category_id,category_name,category_type
     FROM categories
     WHERE user_id=?
     ORDER BY category_type,category_name`,
    [req.userId]
  );

  res.json({ categories: rows });
}));

// GET TRANSACTIONS

route.get('/transactions', asyncRoute(async (req, res) => {
  const { month, type } = req.query;

  if (month && !validMonth(month)) {
    return fail(res, 400, 'month must be YYYY-MM');
  }

  if (type && !['income', 'expense'].includes(type)) {
    return fail(res, 400, 'Invalid type');
  }

  let sql = `
    SELECT
      t.transaction_id,
      t.category_id,
      t.transaction_type,
      t.description,
      t.amount,
      t.transaction_date,
      c.category_name
    FROM transactions t
    JOIN categories c ON c.category_id=t.category_id
    WHERE t.user_id=?
  `;

  const params = [req.userId];

  if (month) {
    const [start, end] = monthRange(month);
    sql += ' AND t.transaction_date>=? AND t.transaction_date<?';
    params.push(start, end);
  }

  if (type) {
    sql += ' AND t.transaction_type=?';
    params.push(type);
  }

  sql += ' ORDER BY t.transaction_date DESC,t.transaction_id DESC LIMIT 1000';

  const [rows] = await db.execute(sql, params);

  res.json({ transactions: rows });
}));

// ADD TRANSACTION

route.post('/transactions', asyncRoute(async (req, res) => {
  const t = cleanTransaction(req.body || {});

  if (!t) {
    return fail(res, 400, 'Invalid transaction data');
  }

  const [cats] = await db.execute(
    `SELECT category_id FROM categories
     WHERE category_id=? AND user_id=? AND category_type=?`,
    [t.category_id, req.userId, t.transaction_type]
  );

  if (!cats.length) {
    return fail(res, 400, 'Category not found for this user and type');
  }

  const [result] = await db.execute(
    `INSERT INTO transactions
     (user_id,category_id,transaction_type,description,amount,transaction_date)
     VALUES (?,?,?,?,?,?)`,
    [
      req.userId,
      t.category_id,
      t.transaction_type,
      t.description,
      t.amount,
      t.transaction_date
    ]
  );

  res.status(201).json({
    message: 'Transaction added',
    id: result.insertId
  });
}));

// UPDATE TRANSACTION

route.put('/transactions/:id', asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) {
    return fail(res, 400, 'Invalid transaction id');
  }

  const t = cleanTransaction(req.body || {});

  if (!t) {
    return fail(res, 400, 'Invalid transaction data');
  }

  const [cats] = await db.execute(
    `SELECT category_id FROM categories
     WHERE category_id=? AND user_id=? AND category_type=?`,
    [t.category_id, req.userId, t.transaction_type]
  );

  if (!cats.length) {
    return fail(res, 400, 'Category not found for this user and type');
  }

  const [result] = await db.execute(
    `UPDATE transactions
     SET category_id=?,transaction_type=?,description=?,amount=?,transaction_date=?
     WHERE transaction_id=? AND user_id=?`,
    [
      t.category_id,
      t.transaction_type,
      t.description,
      t.amount,
      t.transaction_date,
      req.params.id,
      req.userId
    ]
  );

  if (!result.affectedRows) {
    return fail(res, 404, 'Transaction not found');
  }

  res.json({ message: 'Transaction updated' });
}));

// DELETE TRANSACTION

route.delete('/transactions/:id', asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) {
    return fail(res, 400, 'Invalid transaction id');
  }

  const [result] = await db.execute(
    'DELETE FROM transactions WHERE transaction_id=? AND user_id=?',
    [req.params.id, req.userId]
  );

  if (!result.affectedRows) {
    return fail(res, 404, 'Transaction not found');
  }

  res.json({ message: 'Transaction deleted' });
}));

// DASHBOARD SUMMARY

route.get('/dashboard/summary', asyncRoute(async (req, res) => {
  const month = req.query.month;

  if (!validMonth(month)) {
    return fail(res, 400, 'month must be YYYY-MM');
  }

  const [start, end] = monthRange(month);

  const [rows] = await db.execute(
    `SELECT
      COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END),0) AS expenses,
      COUNT(*) AS transaction_count
     FROM transactions
     WHERE user_id=? AND transaction_date>=? AND transaction_date<?`,
    [req.userId, start, end]
  );

  const income = Number(rows[0].income);
  const expenses = Number(rows[0].expenses);

  res.json({
    month,
    income,
    expenses,
    balance: income - expenses,
    transaction_count: rows[0].transaction_count
  });
}));

// REPORTS

route.get('/reports', asyncRoute(async (req, res) => {
  const month = req.query.month;

  if (!validMonth(month)) {
    return fail(res, 400, 'month must be YYYY-MM');
  }

  const [start, end] = monthRange(month);

  const [categories] = await db.execute(
    `SELECT c.category_name, SUM(t.amount) AS total
     FROM transactions t
     JOIN categories c ON c.category_id=t.category_id
     WHERE t.user_id=?
       AND t.transaction_type='expense'
       AND t.transaction_date>=?
       AND t.transaction_date<?
     GROUP BY c.category_id,c.category_name
     ORDER BY total DESC`,
    [req.userId, start, end]
  );

  const [trend] = await db.execute(
    `SELECT
      DATE_FORMAT(transaction_date,'%Y-%m') AS month,
      SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions
     WHERE user_id=?
       AND transaction_date>=DATE_SUB(?,INTERVAL 5 MONTH)
       AND transaction_date<?
     GROUP BY DATE_FORMAT(transaction_date,'%Y-%m')
     ORDER BY month`,
    [req.userId, start, end]
  );

  res.json({ month, categories, trend });
}));

// GET MONTHLY BUDGET
// Uses the new monthly_budgets table.

route.get('/budgets', asyncRoute(async (req, res) => {
  const month = req.query.month;

  if (!validMonth(month)) {
    return fail(res, 400, 'month must be YYYY-MM');
  }

  const [rows] = await db.execute(
    `SELECT limit_amount
     FROM monthly_budgets
     WHERE user_id=? AND budget_month=?`,
    [req.userId, month]
  );

  res.json({
    month,
    limit_amount: rows.length
      ? Number(rows[0].limit_amount)
      : 0
  });
}));

// SAVE OR UPDATE MONTHLY BUDGET

route.put('/budgets', asyncRoute(async (req, res) => {
  const { month, limit_amount } = req.body || {};

  if (!validMonth(month) || !validMoney(limit_amount, true)) {
    return fail(res, 400, 'Invalid month or budget');
  }

  await db.execute(
    `INSERT INTO monthly_budgets
       (user_id, budget_month, limit_amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       limit_amount=VALUES(limit_amount)`,
    [req.userId, month, limit_amount]
  );

  res.json({
    message: 'Budget saved',
    month,
    limit_amount
  });
}));

// REGISTER API ROUTES

 // GET USER SETTINGS
route.get('/settings', asyncRoute(async (req, res) => {
  await db.execute(
    `INSERT IGNORE INTO user_settings (user_id)
     VALUES (?)`,
    [req.userId]
  );

  const [rows] = await db.execute(
    `SELECT currency, theme,
            budget_alert_enabled, alert_threshold
     FROM user_settings
     WHERE user_id = ?`,
    [req.userId]
  );

  if (!rows.length) {
    return res.status(404).json({
      error: 'Settings not found'
    });
  }

  res.json({ settings: rows[0] });
}));

// UPDATE USER SETTINGS
route.put('/settings', asyncRoute(async (req, res) => {
  const {
    currency,
    theme,
    budget_alert_enabled,
    alert_threshold
  } = req.body || {};

  if (
    !['INR', 'USD', 'EUR'].includes(currency) ||
    !['light', 'dark'].includes(theme) ||
    typeof budget_alert_enabled !== 'boolean' ||
    !Number.isInteger(alert_threshold) ||
    alert_threshold < 1 ||
    alert_threshold > 100
  ) {
    return res.status(400).json({
      error: 'Invalid settings data'
    });
  }

  await db.execute(
    `INSERT INTO user_settings
       (user_id, currency, theme,
        budget_alert_enabled, alert_threshold)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       currency = VALUES(currency),
       theme = VALUES(theme),
       budget_alert_enabled = VALUES(budget_alert_enabled),
       alert_threshold = VALUES(alert_threshold)`,
    [
      req.userId,
      currency,
      theme,
      budget_alert_enabled,
      alert_threshold
    ]
  );

  res.json({
    message: 'Settings updated successfully',
    settings: {
      currency,
      theme,
      budget_alert_enabled,
      alert_threshold
    }
  });
}));

app.use('/api', route);

// 404 HANDLER

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// ERROR HANDLER

app.use((err, req, res, next) => {
  console.error('Request failed:', {
    code: err.code,
    message: err.message,
    sqlMessage: err.sqlMessage
  });

  if (err.message === 'CORS origin not allowed') {
    return res.status(403).json({
      error: 'Origin not allowed'
    });
  }

  res.status(500).json({
    error: 'Internal server error'
  });
});

// START SERVER

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  console.log(`FinanceFlow backend running on http://localhost:${port}`);
});
