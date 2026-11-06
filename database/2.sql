USE personal_finance_tracker;

CREATE TABLE IF NOT EXISTS monthly_budgets (
    monthly_budget_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    budget_month CHAR(7) NOT NULL,
    limit_amount DECIMAL(12,2) NOT NULL,
    UNIQUE KEY unique_user_month (user_id, budget_month),
    CONSTRAINT fk_monthly_budget_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

SHOW TABLES;

DESCRIBE monthly_budgets;

