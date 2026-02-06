# İşyeri Yönetim Web Uygulaması

Bu proje, sıfırdan kurup çalıştırabileceğiniz basit ama geliştirilebilir bir yönetim panelidir.

## Özellikler
- Güvenlik: `helmet`, API token kontrolü, rate limit, input doğrulama.
- Satış kayıt ve takip.
- Fatura kayıt/takip.
- Personel kayıt ve bordro (ödeme) takibi.
- Depo giriş/çıkış ve stok takibi.
- SQL veritabanı: SQLite (`data/app.db`).
- Opsiyonel Google Sheets anlık gönderim (webhook ile).

## 1) Kurulum (Kopyala-Çalıştır)
```bash
cp .env.example .env
npm install
npm run init-db
npm start
```

Tarayıcı: `http://localhost:3000`

## 2) API Token
`.env` dosyasında `API_TOKEN` değerini belirleyin.
Panel açılınca üstteki alana aynı token'ı girip **Token Kaydet** tıklayın.

## 3) Google Sheets Anlık Aktarım
Bu proje, `GOOGLE_SHEETS_WEBHOOK_URL` tanımlıysa her yeni kaydı oraya JSON POST eder.

### Örnek Google Apps Script (Web App)
Google Sheets > Extensions > Apps Script:
```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(data.module) || ss.insertSheet(data.module);

  var payload = data.payload;
  var keys = Object.keys(payload);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(keys.concat(['sentAt']));
  }

  var row = keys.map(function(k) { return payload[k]; });
  row.push(data.sentAt);
  sheet.appendRow(row);

  return ContentService.createTextOutput('ok');
}
```
Deploy > New Deployment > Web App > URL'yi alıp `.env` içine yazın:
```env
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
```

## 4) API Uçları
- `GET/POST /api/sales`
- `GET/POST /api/invoices`
- `GET/POST /api/employees`
- `GET/POST /api/payroll`
- `GET/POST /api/inventory`
- `GET/POST /api/stock-movements`
- `GET /api/dashboard`

> `/api/*` uçları için header gerekli: `x-api-token: <API_TOKEN>`

## Not
Bu sürüm MVP'dir. Sonraki adımda kullanıcı rolleri, audit log, yedekleme, çoklu şube, e-fatura entegrasyonu eklenebilir.
