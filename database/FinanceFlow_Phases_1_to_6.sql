-- FinanceFlow Personal Finance & Expense Tracker
-- Consolidated MySQL schema covering features through Phase 6
-- Intended for a NEW/EMPTY MySQL database, not as a migration of existing tables.
-- MySQL 8.0+ | No passwords or personal financial records are included.
-- Note: This is a reconstructed consolidated schema aligned with the Phase 6 backend,
-- not an exact verbatim transcript of every earlier SQL command.

CREATE DATABASE IF NOT EXISTS personal_finance_tracker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE personal_finance_tracker;

-- Phase 1: User authentication and account information
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Phase 2: Separate income and expense categories per user
CREATE TABLE IF NOT EXISTS categories (
  category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  category_type ENUM('income','expense') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_user_category_type (user_id, category_name, category_type),
  KEY idx_category_owner_type (user_id, category_type),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Phases 2-4: Income/expense transactions, dashboard and reports
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('income','expense') NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (transaction_id),
  KEY idx_transactions_user_date (user_id, transaction_date),
  KEY idx_transactions_category (category_id),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id)
    REFERENCES categories(category_id),
  CONSTRAINT chk_transaction_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

-- Earlier category-specific budget structure, retained for Phase 3/4 compatibility.
-- The current Phase 6 backend uses monthly_budgets for overall monthly budgets.
CREATE TABLE IF NOT EXISTS budgets (
  budget_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  budget_month DATE NOT NULL,
  limit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (budget_id),
  KEY idx_budgets_user_month (user_id, budget_month),
  KEY idx_budgets_category (category_id),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id)
    REFERENCES categories(category_id) ON DELETE SET NULL,
  CONSTRAINT chk_budget_limit CHECK (limit_amount >= 0)
) ENGINE=InnoDB;

-- Phase 5/6: Overall monthly budget, used by /api/budgets
CREATE TABLE IF NOT EXISTS monthly_budgets (
  monthly_budget_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  budget_month CHAR(7) NOT NULL,
  limit_amount DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uq_monthly_budget_user_month (user_id, budget_month),
  CONSTRAINT fk_monthly_budget_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_monthly_budget_limit CHECK (limit_amount >= 0)
) ENGINE=InnoDB;

-- Phase 6: User preferences and budget alert threshold
CREATE TABLE IF NOT EXISTS user_settings (
  setting_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  theme ENUM('light','dark') NOT NULL DEFAULT 'light',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  budget_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  alert_threshold INT NOT NULL DEFAULT 80,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_id),
  UNIQUE KEY uq_user_settings_user (user_id),
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_alert_threshold CHECK (alert_threshold BETWEEN 1 AND 100)
) ENGINE=InnoDB;

-- Verification queries
SHOW TABLES;
DESCRIBE users;
DESCRIBE categories;
DESCRIBE transactions;
DESCRIBE budgets;
DESCRIBE monthly_budgets;
DESCRIBE user_settings;

-- Optional dashboard report queries (inspect data; no modification)
SELECT transaction_type, COALESCE(SUM(amount),0) AS total
FROM transactions GROUP BY transaction_type;

SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS month,
       SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS expenses
FROM transactions
GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
ORDER BY month;
