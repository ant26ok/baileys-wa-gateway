const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { WhatsAppService, normalizePhone } = require('./baileys');

dotenv.config();

const PORT = parseInt(process.env.PORT || '3004', 10);
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, '../auth_info_baileys');
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3003/api/webhook/incoming';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const wa = new WhatsAppService(AUTH_DIR, WEBHOOK_URL);

// Web Dashboard
app.get('/', (req, res) => {
  const status = wa.getStatus();

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Baileys WhatsApp Gateway — Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    pre, code, .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-emerald-500 selection:text-white">
  <!-- Top Bar -->
  <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
    <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-emerald-500/20">
          W
        </div>
        <div>
          <span class="font-extrabold text-sm sm:text-base text-white tracking-tight block leading-tight">
            Baileys WhatsApp Gateway
          </span>
          <span class="text-[10px] text-slate-400 font-medium block">
            Socket Protocol • Zero-Chromium • Direct REST API
          </span>
        </div>
      </div>
      <div id="statusBadgeContainer">
        <!-- Live status badge rendered by JS -->
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
    <!-- QR Code & Connection Card -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs">
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <!-- QR Container -->
        <div class="w-64 h-64 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-3 relative shrink-0">
          <div id="qrLoading" class="text-xs text-slate-500 text-center space-y-2">
            <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <span>Memuat status koneksi...</span>
          </div>
          <img id="qrImage" class="w-full h-full object-contain rounded-xl hidden" alt="WhatsApp QR Code">
          <div id="connectedOverlay" class="hidden text-center space-y-2">
            <div class="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-xl">
              ✓
            </div>
            <p class="text-xs font-bold text-white">WhatsApp Terhubung</p>
            <p id="connectedPhone" class="text-[11px] font-mono text-emerald-400">-</p>
          </div>
        </div>

        <!-- Connection Instructions & Action -->
        <div class="flex-1 space-y-4 text-center sm:text-left">
          <div>
            <h2 id="connTitle" class="text-base font-bold text-white mb-1">Pindai QR Code WhatsApp</h2>
            <p id="connDesc" class="text-xs text-slate-400 leading-relaxed">
              Buka aplikasi WhatsApp di HP Anda → Menu Titik Tiga / Pengaturan → Perangkat Tertaut → Tautkan Perangkat → Arahkan kamera ke QR code di samping.
            </p>
          </div>

          <div class="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Status Port:</span><span class="text-white font-mono">:3004</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Forward Webhook:</span><span class="text-emerald-400 font-mono truncate max-w-xs">${WEBHOOK_URL}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Driver Auth:</span><span class="text-slate-300 font-mono">MultiFileAuthState</span></div>
          </div>

          <div class="flex gap-2 justify-center sm:justify-start">
            <button onclick="fetchStatus()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition">
              🔄 Refresh Status
            </button>
            <button id="logoutBtn" onclick="handleLogout()" class="px-3 py-1.5 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold rounded-xl transition hidden">
              Putus Sesi (Logout)
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Message Tester -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs">
      <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-1">
        <span>✉️</span> Uji Kirim Pesan WhatsApp (REST API Test)
      </h3>
      <p class="text-xs text-slate-400 mb-4">
        Kirim pesan teks langsung ke nomor tujuan menggunakan koneksi Baileys aktif.
      </p>

      <form id="sendForm" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Nomor WhatsApp Tujuan</label>
            <input type="text" id="targetPhone" placeholder="Contoh: 081234567890" required class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono">
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-300 mb-1">Isi Pesan</label>
            <input type="text" id="targetMessage" placeholder="Tulis pesan uji coba..." required value="Halo, ini uji coba pesan dari Baileys WhatsApp Gateway." class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
          </div>
        </div>

        <button type="submit" class="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 transition rounded-xl text-xs font-bold text-white shadow-xs">
          Kirim Pesan Sekarang 🚀
        </button>
      </form>

      <div id="sendFeedback" class="mt-3 text-xs p-3 rounded-xl border border-slate-800 bg-slate-950 hidden font-mono"></div>
    </div>
  </main>

  <footer class="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-500">
    <span>Baileys WhatsApp Gateway Server • Standalone Node.js</span>
  </footer>

  <script>
    async function fetchStatus() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        
        const badge = document.getElementById('statusBadgeContainer');
        const qrLoading = document.getElementById('qrLoading');
        const qrImage = document.getElementById('qrImage');
        const connectedOverlay = document.getElementById('connectedOverlay');
        const connectedPhone = document.getElementById('connectedPhone');
        const connTitle = document.getElementById('connTitle');
        const connDesc = document.getElementById('connDesc');
        const logoutBtn = document.getElementById('logoutBtn');

        if (data.connected) {
          badge.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Terhubung</span>';
          qrLoading.classList.add('hidden');
          qrImage.classList.add('hidden');
          connectedOverlay.classList.remove('hidden');
          connectedPhone.innerText = data.user?.phone ? '+' + data.user.phone : 'Device Linked';
          connTitle.innerText = 'Sesi WhatsApp Siap Digunakan';
          connDesc.innerText = 'Gateway aktif dan siap menerima panggilan REST API /send serta meneruskan pesan masuk ke webhook SIMRS.';
          logoutBtn.classList.remove('hidden');
        } else if (data.hasQr && data.qrDataUrl) {
          badge.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>Menunggu Scan</span>';
          qrLoading.classList.add('hidden');
          connectedOverlay.classList.add('hidden');
          qrImage.src = data.qrDataUrl;
          qrImage.classList.remove('hidden');
          connTitle.innerText = 'Pindai QR Code WhatsApp';
          connDesc.innerText = 'Buka WhatsApp di HP → Pengaturan → Perangkat Tertaut → Tautkan Perangkat.';
          logoutBtn.classList.add('hidden');
        } else {
          badge.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">Menghubungkan...</span>';
          qrLoading.classList.remove('hidden');
          qrImage.classList.add('hidden');
          connectedOverlay.classList.add('hidden');
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function handleLogout() {
      if (!confirm('Apakah Anda yakin ingin memutuskan tautan sesi WhatsApp ini?')) return;
      await fetch('/logout', { method: 'POST' });
      location.reload();
    }

    document.getElementById('sendForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('targetPhone').value;
      const message = document.getElementById('targetMessage').value;
      const fb = document.getElementById('sendFeedback');

      fb.className = 'mt-3 text-xs p-3 rounded-xl border border-slate-800 bg-slate-950 block text-slate-300';
      fb.innerText = 'Mengirim pesan via Baileys socket...';

      try {
        const res = await fetch('/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message })
        });
        const d = await res.json();
        if (d.success) {
          fb.className = 'mt-3 text-xs p-3 rounded-xl border border-emerald-800/40 bg-emerald-950/30 block text-emerald-300';
          fb.innerText = '✅ Pesan sukses dikirim! ID Pesan: ' + d.messageId;
        } else {
          fb.className = 'mt-3 text-xs p-3 rounded-xl border border-rose-800/40 bg-rose-950/30 block text-rose-300';
          fb.innerText = '❌ Gagal: ' + (d.error || 'Unknown error');
        }
      } catch (err) {
        fb.className = 'mt-3 text-xs p-3 rounded-xl border border-rose-800/40 bg-rose-950/30 block text-rose-300';
        fb.innerText = '❌ Gagal menghubungi server: ' + err.message;
      }
    });

    // Auto poll status every 3 seconds
    fetchStatus();
    setInterval(fetchStatus, 3000);
  </script>
</body>
</html>`;

  res.send(html);
});

// REST API: Get connection status
app.get('/status', (req, res) => {
  res.json(wa.getStatus());
});

// REST API: Get QR Code
app.get('/qr', (req, res) => {
  const s = wa.getStatus();
  if (s.connected) {
    return res.json({ connected: true, message: 'Already connected to WhatsApp' });
  }
  if (!s.hasQr) {
    return res.status(503).json({ connected: false, message: 'QR not ready yet' });
  }
  res.json({
    connected: false,
    qr: wa.qrString,
    qrDataUrl: wa.qrDataUrl
  });
});

// REST API: Send Message
app.post('/send', async (req, res) => {
  const phone = req.body.phone || req.body.to || req.body.to_number;
  const message = req.body.message || req.body.text;

  if (!phone || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Field "phone" dan "message" wajib diisi.' 
    });
  }

  try {
    const result = await wa.sendMessage(phone, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// REST API: Logout
app.post('/logout', async (req, res) => {
  const result = await wa.logout();
  res.json(result);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'baileys-wa-gateway', timestamp: new Date().toISOString() });
});

function start() {
  wa.init().catch(err => console.error('Baileys init error:', err));
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baileys WhatsApp Gateway running on http://0.0.0.0:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  wa,
  start
};
