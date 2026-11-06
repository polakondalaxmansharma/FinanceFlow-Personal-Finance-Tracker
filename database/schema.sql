-- FinanceFlow Phase 3. MySQL 8.0. Safe to rerun table creation.
CREATE DATABASE IF NOT EXISTS personal_finance_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE personal_finance_tracker;

CREATE TABLE IF NOT EXISTS users (
 user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(120) NOT NULL,
 email VARCHAR(255) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
 category_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 category_name VARCHAR(80) NOT NULL,
 category_type ENUM('income','expense') NOT NULL,
 UNIQUE KEY uq_category (user_id, category_name, category_type),
 UNIQUE KEY uq_category_owner_type (category_id,user_id,category_type),
 CONSTRAINT fk_category_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
 transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 category_id BIGINT UNSIGNED NOT NULL,
 transaction_type ENUM('income','expense') NOT NULL,
 description VARCHAR(255) NOT NULL,
 amount DECIMAL(13,2) NOT NULL,
 transaction_date DATE NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT chk_transaction_amount CHECK (amount > 0),
 CONSTRAINT fk_transaction_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
 CONSTRAINT fk_transaction_category FOREIGN KEY (category_id,user_id,transaction_type)
   REFERENCES categories(category_id,user_id,category_type),
 INDEX idx_transaction_user_date (user_id,transaction_date)
) ENGINE=InnoDB;

-- NULL category_id means a budget for ALL expenses in that month (matching Phase 2 UI).
CREATE TABLE IF NOT EXISTS budgets (
 budget_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 category_id BIGINT UNSIGNED NULL,
 budget_month DATE NOT NULL,
 limit_amount DECIMAL(13,2) NOT NULL,
 all_categories_user_id BIGINT UNSIGNED GENERATED ALWAYS AS
  (CASE WHEN category_id IS NULL THEN user_id ELSE NULL END) STORED,
 CONSTRAINT chk_budget_amount CHECK (limit_amount >= 0),
 CONSTRAINT chk_budget_month CHECK (DAYOFMONTH(budget_month)=1),
 CONSTRAINT fk_budget_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
 CONSTRAINT fk_budget_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
 UNIQUE KEY uq_budget_category_month (user_id,category_id,budget_month),
 UNIQUE KEY uq_budget_all_month (all_categories_user_id,budget_month)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_settings (
 user_id BIGINT UNSIGNED PRIMARY KEY,
 currency_code CHAR(3) NOT NULL DEFAULT 'INR',
 theme ENUM('light','dark') NOT NULL DEFAULT 'light',
 CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;


USE personal_finance_tracker;

CREATE TABLE IF NOT EXISTS budgets (
    budget_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    CONSTRAINT fk_budget_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_budget_category
        FOREIGN KEY (category_id)
        REFERENCES categories(category_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;


USE personal_finance_tracker;

CREATE TABLE IF NOT EXISTS user_settings (
    setting_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    currency VARCHAR(10) DEFAULT 'INR',
    theme VARCHAR(20) DEFAULT 'light',
    monthly_budget_limit DECIMAL(12,2) DEFAULT 0.00,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

USE personal_finance_tracker;

SHOW TABLES;

