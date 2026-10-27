/*
 * Перевірка на власних текстах: шифрує examples/texts/*.txt усіма режимами,
 * розшифровує і зберігає входи, ключі та результати в examples/results/.
 * Запуск: npm run experiment
 *
 * Ключі Vernam у results/ - ДЕМОНСТРАЦІЙНІ: тексти не секретні. Якщо ключ уже
 * збережено, він використовується повторно лише для того самого тексту, щоб
 * результати у звіті були відтворюваними.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/cipherlab.js");
const pkg = require("../package.json");

const dir = __dirname;
const out = path.join(dir, "results");
fs.mkdirSync(out, { recursive: true });
const readText = (f) => C.utf8DecodeStrict(fs.readFileSync(path.join(dir, "texts", f)));
const save = (name, content) => fs.writeFileSync(path.join(out, name), content);

const english = readText("english.txt");
const ukrainian = readText("ukrainian.txt");
const summary = { program: `${pkg.name} ${pkg.version}`, node: process.version, runs: [] };

/* ---------- біграмні режими (зручний режим: сторонні символи вилучаються) ---------- */

const letters = C.normalizePlaintext(english, false);
const detailed = C.makeBigramsDetailed(letters);
const bigrams = detailed.map((b) => b.pair);
const removed = [...english.normalize("NFC")].length - letters.length;
const fillers = detailed.filter((b) => b.filled).length;
save("english.prepared.txt", bigrams.join(" ") + "\n");

const modes = [
  ["Playfair", "PROTECTION", (b) => C.playfairEncrypt(new C.KeySquare("PROTECTION"), b),
    (b) => C.playfairDecrypt(new C.KeySquare("PROTECTION"), b)],
  ["Два квадрати", "CIPHER / BIGRAM", (b) => new C.TwoSquare("CIPHER", "BIGRAM").encrypt(b),
    (b) => new C.TwoSquare("CIPHER", "BIGRAM").decrypt(b)],
];
for (const [name, key, enc, dec] of modes) {
  const cipher = enc(bigrams);
  const back = dec(C.parseCiphertext(cipher.join(" ")));
  const file = name === "Playfair" ? "english.playfair.txt" : "english.twosquare.txt";
  save(file, cipher.join(" ") + "\n");
  const unchanged = bigrams.filter((p, i) => p === cipher[i]).length;
  summary.runs.push({
    mode: name, key, text: "english.txt", chars: [...english].length, letters: letters.length,
    removed, fillers, bigrams: bigrams.length, unchangedBigrams: unchanged,
    cipherStart: cipher.slice(0, 12).join(" "), roundtrip: back.join("") === bigrams.join(""),
  });
}

/* ---------- Vernam: точні байти UTF-8, ключ із CSPRNG ---------- */

function vernamRun(label, text) {
  const message = C.utf8Encode(text);
  const keyFile = path.join(out, `${label}.key.b64`);
  let key = null;
  if (fs.existsSync(keyFile)) {
    key = C.base64DecodeStrict(fs.readFileSync(keyFile, "utf8"));
    if (key.length !== message.length) key = null; // текст змінився - потрібен новий ключ
  }
  key ??= C.generateKey(message.length);
  const { cipher } = C.vernamEncryptText(text, key);
  const cipherB64 = C.base64Encode(cipher);
  save(`${label}.key.b64`, C.base64Encode(key) + "\n");
  save(`${label}.cipher.b64`, cipherB64 + "\n");
  const back = C.vernamDecryptBase64(cipherB64, C.base64Encode(key));
  save(`${label}.decrypted.txt`, back);
  summary.runs.push({
    mode: "Vernam", key: `${label}.key.b64`, text: `${label}.txt`, chars: [...text].length,
    lines: text.split("\n").length - 1, bytes: message.length,
    cipherStart: cipherB64.slice(0, 44), roundtrip: back === text,
  });
}
vernamRun("ukrainian", ukrainian);
vernamRun("english", english);

save("summary.json", JSON.stringify(summary, null, 2) + "\n");
for (const r of summary.runs) {
  console.log(`${r.mode.padEnd(13)} ${r.text.padEnd(14)} D(E(x)) = x: ${r.roundtrip ? "так" : "НІ"}  ${r.cipherStart}`);
}
console.log(`english.txt: символів ${[...english].length}, літер ${letters.length}, вилучено ${removed}, заповнювачів ${fillers}, біграм ${bigrams.length}`);
console.log(`ukrainian.txt: символів ${[...ukrainian].length}, байтів UTF-8 ${C.utf8Encode(ukrainian).length}`);
