/*
 * Відтворювані власні приклади для звіту. Запуск: npm run demo
 * Усі дані ДЕМОНСТРАЦІЙНІ й не секретні. Ключ Vernam для прикладу згенеровано
 * CSPRNG один раз і збережено у demo_key.b64, щоб результати у звіті можна було перевірити.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/cipherlab.js");

const render = (sq) => ["    1 2 3 4 5", ...sq.rows.map((r, i) => ` ${i + 1}  ${[...r].join(" ")}`)].join("\n");

console.log("=== Playfair, власний приклад ===");
const text = "Meet me at the library at noon!";
const sq = new C.KeySquare("PROTECTION");
console.log(render(sq));
const letters = C.normalizePlaintext(text, false);
const bigrams = C.makeBigrams(letters);
console.log("Вхід:", text);
console.log("Нормалізовано:", letters);
console.log("Біграми:", bigrams.join(" "));
for (const p of bigrams) console.log(`  ${p}: ${C.playfairRule(sq, p)} -> ${C.playfairEncrypt(sq, [p])[0]}`);
const enc = C.playfairEncrypt(sq, bigrams);
console.log("Шифротекст:", enc.join(" "));
console.log("Розшифровано:", C.playfairDecrypt(sq, enc).join(" "));

console.log("\n=== Двоквадратний, власний приклад ===");
const ts = new C.TwoSquare("CIPHER", "BIGRAM");
console.log(render(ts.left)); console.log(render(ts.right));
const b2 = C.makeBigrams(C.normalizePlaintext("Uzhhorod University", false));
console.log("Біграми:", b2.join(" "));
for (const p of b2) console.log(`  ${p}: ${ts.sameRow(p) ? "один рядок" : "різні рядки"} -> ${ts.encryptPair(p)}`);
const e2 = ts.encrypt(b2);
console.log("Шифротекст:", e2.join(" "));
console.log("Розшифровано:", ts.decrypt(e2).join(" "));

console.log("\n=== Vernam, власний приклад ===");
const msg = "Лабораторна №3 🔐";
const keyPath = path.join(__dirname, "demo_key.b64");
let key;
if (fs.existsSync(keyPath)) key = C.base64DecodeStrict(fs.readFileSync(keyPath, "utf8"));
else {
  key = C.generateKey(C.utf8Encode(msg).length);
  fs.writeFileSync(keyPath, C.base64Encode(key) + "\n");
}
const { cipher, message } = C.vernamEncryptText(msg, key);
console.log("Текст:", msg);
console.log("Символів (кодових точок):", [...msg].length, " одиниць UTF-16:", msg.length, " байтів UTF-8:", message.length);
for (const ch of msg) {
  console.log(`  ${JSON.stringify(ch).padEnd(6)} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}  ${C.toHex(C.utf8Encode(ch))}`);
}
console.log("P hex:", C.toHex(message));
console.log("K hex:", C.toHex(key));
console.log("C hex:", C.toHex(cipher));
console.log("Ключ Base64:", C.base64Encode(key));
console.log("Шифротекст Base64:", C.base64Encode(cipher));
console.log("Розшифровано:", C.vernamDecryptBytes(cipher, key));

console.log("\n=== Повторне використання ключа (не секретні дані) ===");
const p1 = C.utf8Encode("ATTACK AT DAWN"), p2 = C.utf8Encode("RETREAT AT SIX");
const k = C.generateKey(p1.length);
const x = C.xorBytes(C.xorBytes(p1, k), C.xorBytes(p2, k));
console.log("C1 xor C2:", C.toHex(x));
console.log("P1 xor P2:", C.toHex(C.xorBytes(p1, p2)));
console.log("Знаючи P1, відновлюємо P2:", C.utf8DecodeStrict(C.xorBytes(x, p1)));

console.log("\n=== Зміна шифротексту не виявляється ===");
const r = C.vernamEncryptText("PAY 100");
r.cipher[4] ^= 0x31 ^ 0x39;
console.log("PAY 100 ->", C.vernamDecryptBytes(r.cipher, r.key));
