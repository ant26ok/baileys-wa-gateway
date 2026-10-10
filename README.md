# Baileys WhatsApp Gateway

Gateway WhatsApp API mandiri berbasis protokol WebSocket WhatsApp Web (**@whiskeysockets/baileys**). Berjalan ringan tanpa browser Chromium/Puppeteer (menghemat RAM server faskes), dilengkapi **Web Dashboard pemindai QR Code** otomatis dan **REST API pengiriman pesan**.

---

## Fitur Utama

- **Zero-Chromium Architecture**: Konsumsi memori sangat minim (~35MB RAM).
- **Multi-Device Auth**: Menggunakan `useMultiFileAuthState` sehingga sesi login tersimpan permanen dan tahan reboot.
- **Web Dashboard QR Code**: Halaman web interaktif (`/`) dengan auto-refreshing QR code untuk pairing langsung dari HP.
- **REST API Langsung**:
  - `GET /status` — Cek status koneksi dan identitas akun tertaut.
  - `GET /qr` — Ambil data QR code mentah atau gambar Base64 Data URL.
  - `POST /send` — Kirim pesan WhatsApp ke nomor manapun.
  - `POST /logout` — Putus sesi perangkat tertaut.
- **Two-Way Inbound Webhook**: Otomatis meneruskan pesan masuk WhatsApp ke sistem backend tujuan (misalnya webhook reminder antrean SIMRS).

---

## Arsitektur Endpoint API

| Method | Endpoint | Fungsi | Contoh Payload / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Web Dashboard & Live QR Code | HTML Dashboard (Mobile Friendly) |
| `GET` | `/status` | Info status sesi & user WA | `{"connected": true, "user": {"phone": "628..."}}` |
| `GET` | `/qr` | Status QR Code mentah & Data URL | `{"connected": false, "qrDataUrl": "data:image/png..."}` |
| `POST` | `/send` | Kirim pesan teks WhatsApp | `{"phone": "081234567890", "message": "Halo"}` |
| `POST` | `/logout` | Reset & hapus sesi perangkat | `{"success": true, "message": "Session cleared"}` |

---

## Contoh Penggunaan (cURL)

### 1. Cek Status Koneksi
```bash
curl http://localhost:3004/status
```

### 2. Kirim Pesan Teks
```bash
curl -X POST http://localhost:3004/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "081234567890", "message": "Jadwal kunjungan Anda telah diverifikasi."}'
```

---

## Menjalankan Aplikasi

### Menjalankan Server
```bash
npm start
# Server berjalan di port 3004
```

### Menjalankan Unit Test
```bash
npm test
```
