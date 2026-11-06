-- RUN schema.sql FIRST. These are example queries for MySQL Workbench.
USE personal_finance_tracker;

-- Demo user only: not a usable login account. Real registration will hash passwords in Phase 4/7.
INSERT INTO users (full_name,email,password_hash)
VALUES ('Demo User','finance-demo@example.invalid','DISABLED_DEMO_ACCOUNT')
ON DUPLICATE KEY UPDATE user_id=LAST_INSERT_ID(user_id);
SET @demo_user_id=LAST_INSERT_ID();

INSERT IGNORE INTO user_settings (user_id) VALUES (@demo_user_id);
INSERT IGNORE INTO categories (user_id,category_name,category_type) VALUES
(@demo_user_id,'Salary','income'),(@demo_user_id,'Freelancing','income'),
(@demo_user_id,'Allowance','income'),(@demo_user_id,'Investment','income'),
(@demo_user_id,'Other Income','income'),(@demo_user_id,'Food','expense'),
(@demo_user_id,'Shopping','expense'),(@demo_user_id,'Transport','expense'),
(@demo_user_id,'Bills','expense'),(@demo_user_id,'Education','expense'),
(@demo_user_id,'Health','expense'),(@demo_user_id,'Entertainment','expense'),
(@demo_user_id,'Rent','expense'),(@demo_user_id,'Other Expense','expense');

-- Demo data: execute these INSERTs once to avoid duplicates.
INSERT INTO transactions (user_id,category_id,transaction_type,description,amount,transaction_date)
SELECT @demo_user_id,category_id,'income','November Monthly Salary',25000.00,'2026-11-05'
FROM categories WHERE user_id=@demo_user_id AND category_name='Salary' AND category_type='income';
INSERT INTO transactions (user_id,category_id,transaction_type,description,amount,transaction_date)
SELECT @demo_user_id,category_id,'expense','Lunch at Restaurant',3000.00,'2026-11-05'
FROM categories WHERE user_id=@demo_user_id AND category_name='Food' AND category_type='expense';
INSERT INTO transactions (user_id,category_id,transaction_type,description,amount,transaction_date)
SELECT @demo_user_id,category_id,'expense','Purchased New Shoes',2500.00,'2026-11-05'
FROM categories WHERE user_id=@demo_user_id AND category_name='Shopping' AND category_type='expense';
INSERT INTO transactions (user_id,category_id,transaction_type,description,amount,transaction_date)
SELECT @demo_user_id,category_id,'expense','Monthly Bus Pass',1500.00,'2026-11-05'
FROM categories WHERE user_id=@demo_user_id AND category_name='Transport' AND category_type='expense';

INSERT INTO budgets (user_id,category_id,budget_month,limit_amount)
VALUES (@demo_user_id,NULL,'2026-11-01',10000.00)
ON DUPLICATE KEY UPDATE limit_amount=VALUES(limit_amount);

-- View transaction history (JOIN).
SELECT t.transaction_id,t.description,c.category_name,t.transaction_date,t.transaction_type,t.amount
FROM transactions t JOIN categories c ON c.category_id=t.category_id
WHERE t.user_id=@demo_user_id ORDER BY t.transaction_date DESC,t.transaction_id DESC;

-- Dashboard summary for November 2026.
SELECT COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END),0) AS total_income,
 COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END),0) AS total_expenses,
 COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount ELSE -amount END),0) AS balance
FROM transactions WHERE user_id=@demo_user_id AND transaction_date >= '2026-11-01' AND transaction_date < '2026-12-01';

-- Category-wise expense report.
SELECT c.category_name,SUM(t.amount) AS total_spent
FROM transactions t JOIN categories c ON c.category_id=t.category_id
WHERE t.user_id=@demo_user_id AND t.transaction_type='expense'
AND t.transaction_date >= '2026-11-01' AND t.transaction_date < '2026-12-01'
GROUP BY c.category_id,c.category_name ORDER BY total_spent DESC;

-- Monthly income vs expenses.
SELECT DATE_FORMAT(transaction_date,'%Y-%m') AS month,
 SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END) AS income,
 SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS expenses
FROM transactions WHERE user_id=@demo_user_id
GROUP BY DATE_FORMAT(transaction_date,'%Y-%m') ORDER BY month;

-- Monthly overall budget.
SELECT budget_month,limit_amount FROM budgets
WHERE user_id=@demo_user_id AND category_id IS NULL AND budget_month='2026-11-01';

-- CRUD examples: replace 12345 with an actual transaction_id shown by the history SELECT.
-- UPDATE transactions SET description='Updated description',amount=3200.00
-- WHERE transaction_id=12345 AND user_id=@demo_user_id;
-- DELETE FROM transactions WHERE transaction_id=12345 AND user_id=@demo_user_id;

-- Verify tables and relationships.
SHOW TABLES;
SHOW CREATE TABLE transactions;
