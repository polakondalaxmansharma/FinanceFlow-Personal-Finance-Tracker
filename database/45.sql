USE personal_finance_tracker;

SELECT
    transaction_id,
    user_id,
    description,
    transaction_type,
    amount,
    transaction_date
FROM transactions
ORDER BY transaction_id DESC;

SELECT
    user_id,
    SUM(CASE
        WHEN transaction_type = 'income'
        THEN amount ELSE 0
    END) AS total_income,

    SUM(CASE
        WHEN transaction_type = 'expense'
        THEN amount ELSE 0
    END) AS total_expenses

FROM transactions
WHERE transaction_date >= '2026-11-01'
  AND transaction_date < '2026-12-01'
GROUP BY user_id;

USE personal_finance_tracker;

DESCRIBE budgets;

SHOW CREATE TABLE budgets;

USE personal_finance_tracker;

ALTER TABLE budgets
ADD COLUMN budget_month CHAR(7) NULL,
ADD COLUMN limit_amount DECIMAL(12,2) NULL;

USE personal_finance_tracker;

SET SQL_SAFE_UPDATES = 0;

UPDATE budgets
SET
    budget_month = DATE_FORMAT(start_date, '%Y-%m'),
    limit_amount = amount
WHERE budget_month IS NULL
   OR limit_amount IS NULL;

SET SQL_SAFE_UPDATES = 1;

DESCRIBE budgets;

USE personal_finance_tracker;

SELECT
    budget_id,
    user_id,
    category_id,
    amount,
    start_date,
    end_date,
    budget_month,
    limit_amount
FROM budgets;
USE personal_finance_tracker;

CREATE TABLE IF NOT EXISTS monthly_budgets (
    monthly_budget_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    budget_month CHAR(7) NOT NULL,
    limit_amount DECIMAL(12,2) NOT NULL,
    UNIQUE KEY unique_user_month (user_id, budget_month),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);