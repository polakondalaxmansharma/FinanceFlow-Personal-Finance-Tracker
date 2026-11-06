FinanceFlow – Personal Finance and Expense Tracker
FinanceFlow is a web-based personal finance management project designed to help users record income and expenses, understand spending patterns, manage budgets, and configure personal preferences.
Project status: Development through Phase 6. Phase 7 (cloud deployment) is outside the scope of this README.

Project Overview
The application combines a browser-based dashboard with a Node.js backend and MySQL database. It aims to provide an organized view of personal finances and support informed budgeting decisions.
Features Developed Through Phase 6
- Finance dashboard: View financial summaries and track income and expenses.
- Transaction management: Record and manage financial transactions.
- Expense organization: Track spending using transaction categories.
- Budget management: Configure budgets and compare spending against limits.
- Reports and insights: Review spending and income patterns in the dashboard.
- User settings: Configure supported preferences, including budget alert thresholds.
- Backend and database integration: Store and retrieve application data using a Node.js server and MySQL.
- Authentication support: Backend implementation uses JWT-based authentication where configured.
Budget alert note: A configurable threshold is not, by itself, proof that a visible dashboard notification is implemented. Verify that threshold checks are triggered, that an alert is returned by the backend, and that the frontend renders it before describing budget alerts as fully working.
Technology Stack
Layer	Technology
Frontend	HTML, CSS, JavaScript
Backend	Node.js, Express.js
Database	MySQL
Authentication	JSON Web Tokens (JWT)
Development tools	Visual Studio Code, MySQL Workbench, Git, GitHub


Project Structure
The core application includes files similar to the following. Actual directory names may vary in your repository.
FinanceFlow/
├── index.html          # Frontend page
├── style.css           # Styling
├── script.js           # Frontend interactions and API requests
├── server.js           # Express backend and API endpoints
├── package.json        # Node.js dependencies and scripts
├── package-lock.json   # Locked dependency versions (if generated)
├── .env                # Local secrets and database settings (do not commit)
└── README.md           # Project documentation
Prerequisites
- Node.js and npm installed
- MySQL Server available (local or hosted)
- MySQL Workbench (optional, for database administration)
- A modern web browser
Local Installation
1. Get the project
Clone your GitHub repository, or download and extract the project files.
git clone https://github.com/polakondalaxmansharma/REPOSITORY_NAME.git
cd REPOSITORY_NAME
Replace REPOSITORY_NAME with the actual repository name.
2. Install dependencies
From the folder containing package.json, run:
npm install
3. Configure MySQL
Create a database in MySQL if it does not already exist:
CREATE DATABASE IF NOT EXISTS financeflow;
Import the SQL schema used by your project before starting the backend. Do not assume that creating the database automatically creates the required tables. Use the database name and table definitions expected by your actual server.js.
4. Configure environment variables
Create a .env file in the backend's working directory. Example:
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=financeflow
JWT_SECRET=replace_with_a_long_random_secret
PORT=3000
Important: The variable names above are examples. Match them to the exact names read by your server.js. If using a hosted MySQL service with TLS/SSL, also configure the SSL options required by your provider and backend code.

Never commit .env, database passwords, JWT secrets, or real financial data to GitHub.
5. Start the backend
Use the script defined in your package.json, if present:
npm start
If there is no start script and server.js is the backend entry point:
node server.js
6. Open the frontend
Open index.html using the local development workflow configured for your project. Ensure the API base URL in script.js points to your running backend.
How to Use
1. Start the MySQL database and backend server.
2. Open the FinanceFlow frontend.
3. Sign in or register, if required by your configured application flow.
4. Add income and expense transactions.
5. Review dashboard summaries and transaction history.
6. Configure budgets and user settings.
7. Inspect reports and compare spending with configured limits.
Development Progress
Phase	Scope	Status
Phase 1	Project planning and initial setup	Completed
Phase 2	Frontend foundation and dashboard	Completed
Phase 3	Core financial transaction functionality	Completed
Phase 4	Database and backend integration	Completed
Phase 5	Additional financial management features	Completed
Phase 6	Advanced features, user settings, and testing	Completed (implementation stage)
Phase 7	Deployment and production configuration	Not included


The phase labels summarize the work completed; consult your project documentation for the exact step-by-step phase definitions.
Testing Checklist
Before presenting the project as fully tested, verify these workflows against the running backend and MySQL database:
- [ ] User registration and login work as intended.
- [ ] Authentication rejects invalid or expired credentials.
- [ ] Income and expense transactions can be created, read, updated, and deleted.
- [ ] Database records persist after refreshing the page or restarting the server.
- [ ] Dashboard totals reflect the stored transaction data.
- [ ] Budget limits are calculated correctly.
- [ ] User settings save and reload correctly.
- [ ] Budget threshold alerts appear in the intended UI when triggered.
- [ ] Invalid inputs and backend errors are handled gracefully.
- [ ] Secrets and private user information are not exposed in the repository.
Security Notes
- Keep MySQL credentials and JWT secrets in environment variables.
- Do not upload the .env file to GitHub.
- Use parameterized SQL queries to reduce SQL injection risks.
- Protect user-specific API endpoints with appropriate authentication and authorization.
- Avoid using real personal financial information in demo screenshots or sample data.
Suggested .gitignore entries:
node_modules/
.env
.env.*
!.env.example
*.log
Future Scope
- Deploy the backend and frontend to a hosting platform.
- Connect the deployed backend to a cloud-hosted MySQL database.
- Configure production environment variables, SSL, and secure access.
- Complete end-to-end production testing.
- Extend the budget notification experience if dashboard alerts are not yet implemented.
Author
GitHub: polakondalaxmansharma
