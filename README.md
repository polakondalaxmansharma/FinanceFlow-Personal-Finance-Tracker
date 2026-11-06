# FinanceFlow Phase 5 — MySQL Integration

## Files
Replace your existing `frontend/index.html`, `frontend/style.css`, and `frontend/script.js` with the files in this package. Keep your Phase 4 `backend` folder and its `.env` unchanged.

## Run
1. Start MySQL.
2. In `backend/`, run `npm run dev` and confirm `http://localhost:5000/api/health` returns `{"status":"ok","database":"connected"}`.
3. In VS Code, open `frontend/index.html` with Live Server at `http://127.0.0.1:5500` (or `http://localhost:5500`). Do **not** open via `file://`.
4. In `backend/.env`, set `FRONTEND_ORIGIN=http://127.0.0.1:5500,http://localhost:5500` and restart the backend. If Live Server uses a different port, update this value.
5. Create a new account, then sign in. Registration creates the default categories for that account.
6. Add income and expense transactions, verify the dashboard totals, change the month, edit/delete a transaction, save a budget, and export CSV.
7. Check MySQL Workbench: `SELECT * FROM personal_finance_tracker.transactions;`

## Important
- This frontend matches the **original Phase 4 backend** in `FinanceFlow_Phase4_Backend.zip` and its canonical Phase 3 schema. If you created `budgets(month,year,limit_amount)` instead of `budgets(budget_month,limit_amount)`, the budget endpoints will fail until you reconcile the schema. Also verify `users.full_name`, `categories.category_type`, and `transactions.transaction_type` columns.
- Phase 2 browser-local data is **not automatically imported** into MySQL. Use new records after signing in. Preserve your old frontend files as a backup if you need to migrate sample data.
- Authentication tokens are held in memory only, not localStorage; refreshing the page requires signing in again. This avoids persistent browser token storage but is not a complete production authentication solution. Before public deployment, use HTTPS and a properly designed secure session strategy.
- Backend transaction list is limited to 1,000 records per request; implement pagination before relying on it for large datasets.
- Chart.js is loaded from a CDN and requires internet access.
- Never put your MySQL password or JWT secret in frontend code. Never commit `.env` to GitHub.
