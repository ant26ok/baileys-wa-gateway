const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

function normalizePhone(raw) {
  let cleaned = String(raw || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

function phoneToJid(phone) {
  const norm = normalizePhone(phone);
  return norm.includes('@s.whatsapp.net') ? norm : `${norm}@s.whatsapp.net`;
}

class WhatsAppService {
  constructor(authDir = './auth_info_baileys', webhookUrl = '') {
    this.authDir = path.resolve(authDir);
    this.webhookUrl = webhookUrl;
    this.sock = null;
    this.qrString = null;
    this.qrDataUrl = null;
    this.isConnected = false;
    this.user = null;
    this.reconnectAttempts = 0;
    this.logger = pino({ level: 'silent' });
  }

  async init() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    this.sock = makeWASocket({
      version,
      logger: this.logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['Ubuntu Chrome', 'Desktop', '1.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrString = qr;
        try {
          this.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          qrcodeTerminal.generate(qr, { small: true });
          console.log('[BAILEYS] QR Code baru siap di-scan (tersedia di Web UI)');
        } catch (e) {
          console.error('[BAILEYS] Error generate QR data URL:', e.message);
        }
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.user = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[BAILEYS] Koneksi terputus (Status: ${statusCode}). Reconnect: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[BAILEYS] Sesi telah logout. Menghapus folder auth...');
          this.clearAuth();
          this.qrString = null;
          this.qrDataUrl = null;
          setTimeout(() => this.init(), 3000);
        } else if (shouldReconnect) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
          this.reconnectAttempts++;
          console.log(`[BAILEYS] Mencoba menyambung kembali dalam ${delay / 1000} detik...`);
          setTimeout(() => this.init(), delay);
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.qrString = null;
        this.qrDataUrl = null;
        this.user = this.sock.user;
        console.log(`[BAILEYS] ✅ Terhubung sukses sebagai: ${this.user?.name || this.user?.id}`);
      }
    });

    // Inbound Messages Listener
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const senderJid = msg.key.remoteJid || '';
        const phone = senderJid.replace('@s.whatsapp.net', '');
        const pushName = msg.pushName || '';

        // Extract text message
        const text = 
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';

        if (!text) continue;

        console.log(`[BAILEYS INBOUND] Pesan dari ${phone} (${pushName}): "${text}"`);

        // Forward to external webhook if configured
        if (this.webhookUrl) {
          try {
            await fetch(this.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: phone,
                name: pushName,
                text,
                timestamp: msg.messageTimestamp,
                raw: msg
              })
            });
            console.log(`[BAILEYS WEBHOOK] Forwarded ke ${this.webhookUrl} OK`);
          } catch (err) {
            console.error(`[BAILEYS WEBHOOK] Gagal forward ke ${this.webhookUrl}:`, err.message);
          }
        }
      }
    });
  }

  async sendMessage(phone, messageText) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp belum terhubung. Silakan scan QR code terlebih dahulu.');
    }

    const jid = phoneToJid(phone);
    const sent = await this.sock.sendMessage(jid, { text: messageText });
    return {
      success: true,
      messageId: sent.key.id,
      to: jid,
      timestamp: sent.messageTimestamp
    };
  }

  getStatus() {
    return {
      connected: this.isConnected,
      user: this.user ? {
        id: this.user.id?.replace(/:\d+@/, '@'),
        name: this.user.name || null,
        phone: this.user.id ? this.user.id.split(':')[0] : null
      } : null,
      hasQr: Boolean(this.qrString),
      qrDataUrl: this.qrDataUrl,
      webhookUrl: this.webhookUrl || null
    };
  }

  async logout() {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (e) {}
    }
    this.clearAuth();
    this.isConnected = false;
    this.user = null;
    this.qrString = null;
    this.qrDataUrl = null;
    setTimeout(() => this.init(), 2000);
    return { success: true, message: 'Session logged out and cleared.' };
  }

  clearAuth() {
    if (fs.existsSync(this.authDir)) {
      fs.rmSync(this.authDir, { recursive: true, force: true });
    }
  }
}

module.exports = {
  WhatsAppService,
  normalizePhone,
  phoneToJid
};
