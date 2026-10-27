/*
 * Додаткове завдання: порівняння навчального XOR-гамування з ChaCha20-Poly1305
 * зі стандартної бібліотеки Node.js (node:crypto). Алгоритм НЕ реалізується вручну.
 * Запуск: npm run chacha
 */
"use strict";
const crypto = require("node:crypto");
const C = require("../src/cipherlab.js");

const text = "PAY 100 UAH TO ALICE";
const key = crypto.randomBytes(32); // 256-бітний ключ, CSPRNG

function seal(plain) {
  const nonce = crypto.randomBytes(12); // унікальний nonce для кожного повідомлення
  const c = crypto.createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { nonce, ct, tag: c.getAuthTag() };
}

function open({ nonce, ct, tag }) {
  const d = crypto.createDecipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8"); // final() перевіряє тег
}

const a = seal(text), b = seal(text);
console.log("ChaCha20-Poly1305");
console.log("  той самий текст і ключ, шифротекст 1:", a.ct.toString("hex").toUpperCase());
console.log("  той самий текст і ключ, шифротекст 2:", b.ct.toString("hex").toUpperCase());
console.log("  шифротексти різні (різний nonce):", !a.ct.equals(b.ct));
console.log("  розшифрування без змін:", open(a));

const tampered = { ...a, ct: Buffer.from(a.ct) };
tampered.ct[4] ^= 0x31 ^ 0x39; // та сама атака, що й на Вернама: '1' -> '9'
try {
  console.log("  після зміни байта:", open(tampered));
} catch (e) {
  console.log("  після зміни байта: ВІДМОВА -", e.message);
}

console.log("Vernam XOR (навчальний)");
const v = C.vernamEncryptText(text);
v.cipher[4] ^= 0x31 ^ 0x39;
console.log("  після зміни байта:", C.vernamDecryptBytes(v.cipher, v.key), "- підміну не виявлено");
