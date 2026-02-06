const db = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  total_amount REAL NOT NULL CHECK(total_amount >= 0),
  customer_name TEXT,
  sale_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  tax_rate REAL NOT NULL CHECK(tax_rate >= 0),
  issue_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL CHECK(status IN ('Beklemede', 'Ödendi', 'İptal')) DEFAULT 'Beklemede',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  salary REAL NOT NULL CHECK(salary >= 0),
  start_date TEXT NOT NULL,
  iban TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  pay_period TEXT NOT NULL,
  gross_amount REAL NOT NULL CHECK(gross_amount >= 0),
  deductions REAL NOT NULL CHECK(deductions >= 0),
  net_amount REAL NOT NULL CHECK(net_amount >= 0),
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'adet',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('Giriş', 'Çıkış')),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  movement_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
);
`);

console.log('Veritabanı hazır: data/app.db');
