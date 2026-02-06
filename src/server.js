require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');
require('./init-db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_TOKEN = process.env.API_TOKEN || 'degistir-beni';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '300kb' }));
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

const sanitizeText = (value, max = 255) => String(value || '').trim().slice(0, max);
const sanitizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const auth = (req, res, next) => {
  const token = req.header('x-api-token');
  if (!token || token !== API_TOKEN) {
    return res.status(401).json({ error: 'Yetkisiz erişim.' });
  }
  return next();
};

async function pushToGSheet(moduleName, payload) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: moduleName, payload, sentAt: new Date().toISOString() })
    });
  } catch (error) {
    console.error('Google Sheets webhook hatası:', error.message);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Sistem çalışıyor.' });
});

app.use('/api', auth);

app.get('/api/dashboard', (req, res) => {
  const totalSales = db.prepare('SELECT IFNULL(SUM(total_amount),0) as total FROM sales').get().total;
  const activeEmployees = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
  const pendingInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'Beklemede'").get().count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE stock <= min_stock').get().count;

  res.json({ totalSales, activeEmployees, pendingInvoices, lowStock });
});

app.get('/api/sales', (req, res) => {
  const rows = db.prepare('SELECT * FROM sales ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/sales', async (req, res) => {
  const product_name = sanitizeText(req.body.product_name);
  const quantity = Number(req.body.quantity);
  const unit_price = Number(req.body.unit_price);
  const customer_name = sanitizeText(req.body.customer_name);
  const sale_date = sanitizeDate(req.body.sale_date) || new Date().toISOString().slice(0, 10);
  if (!product_name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unit_price) || unit_price < 0) {
    return res.status(400).json({ error: 'Geçersiz satış bilgileri.' });
  }

  const total_amount = Number((quantity * unit_price).toFixed(2));
  const info = db.prepare(`INSERT INTO sales (product_name, quantity, unit_price, total_amount, customer_name, sale_date)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(product_name, quantity, unit_price, total_amount, customer_name, sale_date);

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(info.lastInsertRowid);
  await pushToGSheet('sales', sale);
  res.status(201).json(sale);
});

app.get('/api/invoices', (req, res) => {
  const rows = db.prepare('SELECT * FROM invoices ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/invoices', async (req, res) => {
  const invoice_no = sanitizeText(req.body.invoice_no, 60);
  const company_name = sanitizeText(req.body.company_name, 120);
  const amount = Number(req.body.amount);
  const tax_rate = Number(req.body.tax_rate);
  const issue_date = sanitizeDate(req.body.issue_date);
  const due_date = sanitizeDate(req.body.due_date);
  const status = ['Beklemede', 'Ödendi', 'İptal'].includes(req.body.status) ? req.body.status : 'Beklemede';

  if (!invoice_no || !company_name || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(tax_rate) || tax_rate < 0 || !issue_date) {
    return res.status(400).json({ error: 'Geçersiz fatura bilgileri.' });
  }

  try {
    const info = db.prepare(`INSERT INTO invoices (invoice_no, company_name, amount, tax_rate, issue_date, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(invoice_no, company_name, amount, tax_rate, issue_date, due_date, status);

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
    await pushToGSheet('invoices', invoice);
    res.status(201).json(invoice);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu fatura numarası zaten var.' });
    }
    return res.status(500).json({ error: 'Kayıt sırasında hata oluştu.' });
  }
});

app.get('/api/employees', (req, res) => {
  const rows = db.prepare('SELECT * FROM employees ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/employees', async (req, res) => {
  const full_name = sanitizeText(req.body.full_name, 120);
  const role = sanitizeText(req.body.role, 80);
  const salary = Number(req.body.salary);
  const start_date = sanitizeDate(req.body.start_date);
  const iban = sanitizeText(req.body.iban, 34);

  if (!full_name || !role || !Number.isFinite(salary) || salary < 0 || !start_date) {
    return res.status(400).json({ error: 'Geçersiz personel bilgileri.' });
  }

  const info = db.prepare(`INSERT INTO employees (full_name, role, salary, start_date, iban)
    VALUES (?, ?, ?, ?, ?)`)
    .run(full_name, role, salary, start_date, iban);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  await pushToGSheet('employees', employee);
  res.status(201).json(employee);
});

app.get('/api/payroll', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, e.full_name
    FROM payroll p
    JOIN employees e ON e.id = p.employee_id
    ORDER BY p.id DESC
  `).all();
  res.json(rows);
});

app.post('/api/payroll', async (req, res) => {
  const employee_id = Number(req.body.employee_id);
  const pay_period = sanitizeText(req.body.pay_period, 20);
  const gross_amount = Number(req.body.gross_amount);
  const deductions = Number(req.body.deductions || 0);
  const paid_at = sanitizeDate(req.body.paid_at) || new Date().toISOString().slice(0, 10);

  if (!Number.isInteger(employee_id) || !pay_period || !Number.isFinite(gross_amount) || gross_amount < 0 || !Number.isFinite(deductions) || deductions < 0) {
    return res.status(400).json({ error: 'Geçersiz bordro bilgileri.' });
  }

  const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Personel bulunamadı.' });

  const net_amount = Math.max(0, Number((gross_amount - deductions).toFixed(2)));
  const info = db.prepare(`INSERT INTO payroll (employee_id, pay_period, gross_amount, deductions, net_amount, paid_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(employee_id, pay_period, gross_amount, deductions, net_amount, paid_at);

  const payroll = db.prepare('SELECT * FROM payroll WHERE id = ?').get(info.lastInsertRowid);
  await pushToGSheet('payroll', payroll);
  res.status(201).json(payroll);
});

app.get('/api/inventory', (req, res) => {
  const rows = db.prepare('SELECT * FROM inventory ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/inventory', async (req, res) => {
  const item_name = sanitizeText(req.body.item_name, 120);
  const stock = Number(req.body.stock || 0);
  const min_stock = Number(req.body.min_stock || 0);
  const unit = sanitizeText(req.body.unit || 'adet', 20);

  if (!item_name || !Number.isInteger(stock) || !Number.isInteger(min_stock)) {
    return res.status(400).json({ error: 'Geçersiz stok kartı bilgileri.' });
  }

  try {
    const info = db.prepare(`INSERT INTO inventory (item_name, stock, min_stock, unit)
      VALUES (?, ?, ?, ?)`)
      .run(item_name, stock, min_stock, unit);

    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(info.lastInsertRowid);
    await pushToGSheet('inventory', item);
    res.status(201).json(item);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu ürün zaten stokta tanımlı.' });
    }
    return res.status(500).json({ error: 'Kayıt sırasında hata oluştu.' });
  }
});

app.get('/api/stock-movements', (req, res) => {
  const rows = db.prepare(`
    SELECT sm.*, i.item_name
    FROM stock_movements sm
    JOIN inventory i ON i.id = sm.item_id
    ORDER BY sm.id DESC
  `).all();
  res.json(rows);
});

app.post('/api/stock-movements', async (req, res) => {
  const item_id = Number(req.body.item_id);
  const movement_type = req.body.movement_type === 'Çıkış' ? 'Çıkış' : 'Giriş';
  const quantity = Number(req.body.quantity);
  const movement_date = sanitizeDate(req.body.movement_date) || new Date().toISOString().slice(0, 10);
  const note = sanitizeText(req.body.note, 255);

  if (!Number.isInteger(item_id) || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Geçersiz hareket bilgisi.' });
  }

  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Stok ürünü bulunamadı.' });

  let newStock = item.stock;
  if (movement_type === 'Giriş') newStock += quantity;
  else newStock -= quantity;

  if (newStock < 0) return res.status(400).json({ error: 'Yetersiz stok.' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE inventory SET stock = ? WHERE id = ?').run(newStock, item_id);
    const info = db.prepare(`INSERT INTO stock_movements (item_id, movement_type, quantity, movement_date, note)
      VALUES (?, ?, ?, ?, ?)`)
      .run(item_id, movement_type, quantity, movement_date, note);
    return info.lastInsertRowid;
  });

  const movementId = tx();
  const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(movementId);
  await pushToGSheet('stock_movements', movement);
  res.status(201).json(movement);
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Uygulama hazır: http://localhost:${PORT}`);
});
