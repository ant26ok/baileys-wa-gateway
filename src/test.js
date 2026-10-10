const assert = require('node:assert');
const { normalizePhone, phoneToJid, WhatsAppService } = require('./baileys');
const { app } = require('./server');

console.log('=== TEST: BAILEYS WHATSAPP GATEWAY ===');

// 1. Test Phone Normalization
assert.strictEqual(normalizePhone('081234567890'), '6281234567890');
assert.strictEqual(normalizePhone('81234567890'), '6281234567890');
assert.strictEqual(normalizePhone('+62 812-3456-7890'), '6281234567890');
assert.strictEqual(normalizePhone('6281234567890'), '6281234567890');
console.log('✓ Phone normalization passed');

// 2. Test Phone to JID Conversion
assert.strictEqual(phoneToJid('081234567890'), '6281234567890@s.whatsapp.net');
assert.strictEqual(phoneToJid('6285678901234@s.whatsapp.net'), '6285678901234@s.whatsapp.net');
console.log('✓ Phone to JID conversion passed');

// 3. Test Service Instantiation
const waTest = new WhatsAppService('./test_auth', 'http://localhost:3003/webhook');
assert.strictEqual(waTest.isConnected, false);
assert.strictEqual(waTest.webhookUrl, 'http://localhost:3003/webhook');
const st = waTest.getStatus();
assert.strictEqual(st.connected, false);
assert.strictEqual(st.user, null);
console.log('✓ WhatsApp service instantiation passed');

// 4. Test Unconnected Send Error Handling
waTest.sendMessage('081234567890', 'test')
  .then(() => {
    assert.fail('Should reject when not connected');
  })
  .catch((err) => {
    assert(err.message.includes('belum terhubung'));
    console.log('✓ Guard against unconnected message sending passed');
  });

console.log('=== ALL UNIT TESTS PASSED SUCCESSFULLY ===');
