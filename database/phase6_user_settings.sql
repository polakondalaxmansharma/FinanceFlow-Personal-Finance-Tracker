USE personal_finance_tracker;
CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  currency ENUM('INR','USD','EUR') NOT NULL DEFAULT 'INR',
  theme ENUM('light','dark') NOT NULL DEFAULT 'light',
  budget_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  alert_threshold INT NOT NULL DEFAULT 80,
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
);

USE personal_finance_tracker;

SHOW TABLES;

DESCRIBE user_settings;

USE personal_finance_tracker;

ALTER TABLE user_settings
ADD COLUMN budget_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_settings
ADD COLUMN alert_threshold INT NOT NULL DEFAULT 80;

SELECT *
FROM user_settings;

SELECT user_id, budget_alert_enabled, alert_threshold
FROM user_settings;

SELECT *
FROM monthly_budgets;

