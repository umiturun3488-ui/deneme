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

Uygulama açıldıktan sonra tarayıcıdan:
- `http://localhost:3000`
- `http://localhost:3000/index.html`

## 2) “Bu siteye ulaşılamadı” Hatası İçin Hızlı Çözüm
Aşağıdakileri sırayla kontrol edin:

1. Sunucu gerçekten çalışıyor mu?
```bash
npm start
```
Terminalde `Uygulama hazır` mesajını görmelisiniz.

2. Port meşgul mü?
```bash
ss -ltnp | rg 3000
```
Eğer 3000 doluysa `.env` içinde `PORT=3001` yapıp tekrar başlatın.

3. Host ayarı doğru mu?
`.env` içinde şu olsun:
```env
HOST=0.0.0.0
PORT=3000
```

4. Doğru adrese mi gidiyorsunuz?
- Yerel bilgisayarda: `http://localhost:3000`
- Aynı ağdaki başka cihazdan: `http://<sunucu_ip>:3000`

5. İlk test için API sağlık kontrolü:
```bash
curl http://localhost:3000/api/health
```
`{"ok":true,...}` benzeri cevap dönmeli.

## 3) API Token
`.env` dosyasında `API_TOKEN` değerini belirleyin.
Panel açılınca üstteki alana aynı token'ı girip **Token Kaydet** tıklayın.

## 4) Google Sheets Anlık Aktarım
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

## 5) API Uçları
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
