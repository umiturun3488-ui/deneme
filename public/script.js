const tokenInput = document.getElementById('apiToken');
const savedToken = localStorage.getItem('apiToken') || '';
tokenInput.value = savedToken;

document.getElementById('saveToken').onclick = () => {
  localStorage.setItem('apiToken', tokenInput.value.trim());
  alert('Token kaydedildi.');
  refreshAll();
};

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-token': tokenInput.value.trim()
  };
}

async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Hata oluştu.');
  return data;
}

function tableHtml(rows) {
  if (!rows.length) return '<p>Kayıt yok.</p>';
  const cols = Object.keys(rows[0]);
  return `<table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function renderForm(id, fields, onSubmit) {
  const form = document.getElementById(id);
  form.innerHTML = fields.map(f => {
    if (f.type === 'select') {
      return `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
    }
    return `<input name="${f.name}" type="${f.type || 'text'}" placeholder="${f.label}" ${f.required ? 'required' : ''}>`;
  }).join('') + '<button type="submit">Kaydet</button><div class="msg"></div>';

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await onSubmit(data);
      form.reset();
      form.querySelector('.msg').textContent = 'Kayıt başarılı.';
      refreshAll();
    } catch (error) {
      form.querySelector('.msg').textContent = error.message;
    }
  };
}

async function refreshDashboard() {
  try {
    const d = await api('/dashboard');
    document.getElementById('dashboard').innerHTML = `
      <div class="stat"><strong>Toplam Satış</strong><div>${d.totalSales} ₺</div></div>
      <div class="stat"><strong>Personel Sayısı</strong><div>${d.activeEmployees}</div></div>
      <div class="stat"><strong>Bekleyen Fatura</strong><div>${d.pendingInvoices}</div></div>
      <div class="stat"><strong>Kritik Stok</strong><div>${d.lowStock}</div></div>
    `;
  } catch {
    document.getElementById('dashboard').innerHTML = '<div class="msg">Dashboard için token gerekli.</div>';
  }
}

async function refreshAll() {
  await refreshDashboard();
  try {
    document.getElementById('salesList').innerHTML = tableHtml(await api('/sales'));
    document.getElementById('invoicesList').innerHTML = tableHtml(await api('/invoices'));
    const employees = await api('/employees');
    document.getElementById('employeesList').innerHTML = tableHtml(employees);
    document.getElementById('payrollList').innerHTML = tableHtml(await api('/payroll'));
    const inventory = await api('/inventory');
    document.getElementById('inventoryList').innerHTML = tableHtml(inventory);
    document.getElementById('movementsList').innerHTML = tableHtml(await api('/stock-movements'));

    const employeeOptions = employees.map(e => `${e.id}`).length ? employees.map(e => `${e.id}`) : [''];
    const itemOptions = inventory.map(i => `${i.id}`).length ? inventory.map(i => `${i.id}`) : [''];

    renderForm('payrollForm', [
      { name: 'employee_id', label: 'Personel ID', required: true, type: 'select', options: employeeOptions },
      { name: 'pay_period', label: 'Dönem (2026-02)', required: true },
      { name: 'gross_amount', label: 'Brüt', required: true, type: 'number' },
      { name: 'deductions', label: 'Kesinti', type: 'number' },
      { name: 'paid_at', label: 'Ödeme Tarihi', type: 'date' }
    ], (data) => api('/payroll', 'POST', data));

    renderForm('movementsForm', [
      { name: 'item_id', label: 'Ürün ID', required: true, type: 'select', options: itemOptions },
      { name: 'movement_type', label: 'Tip', required: true, type: 'select', options: ['Giriş', 'Çıkış'] },
      { name: 'quantity', label: 'Miktar', required: true, type: 'number' },
      { name: 'movement_date', label: 'Tarih', type: 'date' },
      { name: 'note', label: 'Not' }
    ], (data) => api('/stock-movements', 'POST', data));
  } catch {
    // Token yoksa sessiz geç.
  }
}

renderForm('salesForm', [
  { name: 'product_name', label: 'Ürün Adı', required: true },
  { name: 'quantity', label: 'Miktar', required: true, type: 'number' },
  { name: 'unit_price', label: 'Birim Fiyat', required: true, type: 'number' },
  { name: 'customer_name', label: 'Müşteri' },
  { name: 'sale_date', label: 'Satış Tarihi', type: 'date' }
], (data) => api('/sales', 'POST', data));

renderForm('invoicesForm', [
  { name: 'invoice_no', label: 'Fatura No', required: true },
  { name: 'company_name', label: 'Firma', required: true },
  { name: 'amount', label: 'Tutar', required: true, type: 'number' },
  { name: 'tax_rate', label: 'KDV Oranı', required: true, type: 'number' },
  { name: 'issue_date', label: 'Düzenleme Tarihi', required: true, type: 'date' },
  { name: 'due_date', label: 'Vade', type: 'date' },
  { name: 'status', label: 'Durum', type: 'select', options: ['Beklemede', 'Ödendi', 'İptal'] }
], (data) => api('/invoices', 'POST', data));

renderForm('employeesForm', [
  { name: 'full_name', label: 'Ad Soyad', required: true },
  { name: 'role', label: 'Pozisyon', required: true },
  { name: 'salary', label: 'Maaş', required: true, type: 'number' },
  { name: 'start_date', label: 'İşe Başlangıç', required: true, type: 'date' },
  { name: 'iban', label: 'IBAN' }
], (data) => api('/employees', 'POST', data));

renderForm('inventoryForm', [
  { name: 'item_name', label: 'Ürün Adı', required: true },
  { name: 'stock', label: 'Başlangıç Stok', required: true, type: 'number' },
  { name: 'min_stock', label: 'Minimum Stok', required: true, type: 'number' },
  { name: 'unit', label: 'Birim', required: true }
], (data) => api('/inventory', 'POST', data));

document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

refreshAll();
