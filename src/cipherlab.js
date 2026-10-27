/*
 * ЛР3. Біграмні шифри та шифр Вернама - алгоритмічне ядро.
 *
 * Модуль не залежить від інтерфейсу: працює у браузері (window.CipherLab)
 * і в Node.js (require), тому логіку тестують без ручного введення.
 * Навчальні алгоритми, не для реального захисту даних.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CipherLab = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Помилки ---------- */

  class CipherInputError extends Error {
    constructor(message) {
      super(message);
      this.name = "CipherInputError";
    }
  }

  /* ---------- Алфавіт і нормалізація ---------- */

  const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // без J
  const SIZE = 5;
  const FILLER = "X";
  const ALT_FILLER = "Q"; // коли розділити треба саме X

  /** NFC -> верхній регістр -> J до I. Інші символи не змінюються. */
  function normalizeLetters(text) {
    return String(text).normalize("NFC").toUpperCase().replace(/J/g, "I");
  }

  function foreignChars(text) {
    const bad = new Set();
    for (const ch of text) if (!ALPHABET.includes(ch)) bad.add(ch);
    return [...bad].sort();
  }

  function describeChars(chars) {
    return chars
      .map((c) => (c === " " ? "пробіл" : c === "\n" ? "перенос рядка" : `'${c}'`))
      .join(", ");
  }

  /* ---------- Ключовий квадрат 5x5 ---------- */

  class KeySquare {
    constructor(key) {
      this.key = key;
      this.letters = buildSquareLetters(key);
      this.rows = [];
      for (let r = 0; r < SIZE; r++) this.rows.push(this.letters.slice(r * SIZE, (r + 1) * SIZE));
      this.pos = new Map();
      [...this.letters].forEach((ch, i) => this.pos.set(ch, [Math.floor(i / SIZE), i % SIZE]));
    }

    position(letter) {
      const p = this.pos.get(letter);
      if (!p) throw new CipherInputError(`Літери '${letter}' немає у квадраті`);
      return p;
    }

    at(row, col) {
      const m = (n) => ((n % SIZE) + SIZE) % SIZE; // циклічний перехід
      return this.rows[m(row)][m(col)];
    }
  }

  /** 25 літер квадрата: унікальні літери ключа (у порядку першої появи) + решта алфавіту. */
  function buildSquareLetters(key) {
    const normalized = normalizeLetters(key ?? "").trim();
    if (!normalized) throw new CipherInputError("Ключ квадрата порожній");
    const bad = foreignChars(normalized);
    if (bad.length) {
      throw new CipherInputError(
        "Ключ квадрата містить недопустимі символи: " + describeChars(bad) +
          ". Дозволені лише латинські літери A–Z (J стає I)."
      );
    }
    let letters = "";
    for (const ch of normalized + ALPHABET) if (!letters.includes(ch)) letters += ch;
    // Інваріант: рівно 25 унікальних символів, кожен символ алфавіту присутній один раз.
    if (letters.length !== 25 || foreignChars(letters).length) {
      throw new Error("Внутрішня помилка побудови квадрата");
    }
    return letters;
  }

  /* ---------- Підготовка тексту (розділ 4.2) ---------- */

  /**
   * strict=true: будь-який сторонній символ (зокрема пробіл) - помилка.
   * strict=false: зручний режим, сторонні символи вилучаються.
   */
  function normalizePlaintext(text, strict = true) {
    const normalized = normalizeLetters(text);
    let letters;
    if (strict) {
      const bad = foreignChars(normalized);
      if (bad.length) {
        throw new CipherInputError(
          "Сторонні символи у строгому режимі: " + describeChars(bad) +
            ". Увімкніть зручний режим, щоб вилучити їх автоматично."
        );
      }
      letters = normalized;
    } else {
      letters = [...normalized].filter((ch) => ALPHABET.includes(ch)).join("");
    }
    if (!letters) throw new CipherInputError("Після підготовки не залишилось жодної підтримуваної літери");
    return letters;
  }

  const fillerFor = (letter) => (letter === FILLER ? ALT_FILLER : FILLER);

  /** Біграми з позначкою, чи друга літера є вставленим заповнювачем. */
  function makeBigramsDetailed(letters) {
    const out = [];
    let i = 0;
    while (i < letters.length) {
      const a = letters[i];
      const b = letters[i + 1];
      if (b === undefined || a === b) {
        // непарна літера в кінці або повтор у біграмі
        out.push({ pair: a + fillerFor(a), filled: true });
        i += 1;
      } else {
        out.push({ pair: a + b, filled: false });
        i += 2;
      }
    }
    return out;
  }

  const makeBigrams = (letters) => makeBigramsDetailed(letters).map((b) => b.pair);

  function prepare(text, strict = true) {
    return makeBigrams(normalizePlaintext(text, strict));
  }

  /** Шифротекст: лише літери алфавіту, парна довжина. Пробіли групування ігноруються. */
  function parseCiphertext(text) {
    const compact = normalizeLetters(text).replace(/\s+/g, "");
    if (!compact) throw new CipherInputError("Шифротекст порожній");
    const bad = foreignChars(compact);
    if (bad.length) throw new CipherInputError("Шифротекст містить недопустимі символи: " + describeChars(bad));
    if (compact.length % 2) {
      throw new CipherInputError(`Біграмний шифротекст має непарну довжину (${compact.length} літер)`);
    }
    const out = [];
    for (let i = 0; i < compact.length; i += 2) out.push(compact.slice(i, i + 2));
    return out;
  }

  /* ---------- Playfair (розділ 4.3) ---------- */

  const RULE = { ROW: "рядок", COLUMN: "стовпець", RECTANGLE: "прямокутник" };

  function playfairRule(square, pair) {
    const [r1, c1] = square.position(pair[0]);
    const [r2, c2] = square.position(pair[1]);
    if (r1 === r2) return RULE.ROW;
    if (c1 === c2) return RULE.COLUMN;
    return RULE.RECTANGLE;
  }

  /** shift = +1 шифрування (праворуч/вниз), -1 розшифрування (ліворуч/вгору). */
  function playfairPair(square, pair, shift) {
    if (pair[0] === pair[1]) {
      throw new CipherInputError(`Біграма '${pair}' з однакових літер неприпустима для Playfair`);
    }
    const [r1, c1] = square.position(pair[0]);
    const [r2, c2] = square.position(pair[1]);
    if (r1 === r2) return square.at(r1, c1 + shift) + square.at(r2, c2 + shift);
    if (c1 === c2) return square.at(r1 + shift, c1) + square.at(r2 + shift, c2);
    return square.at(r1, c2) + square.at(r2, c1);
  }

  const playfairEncrypt = (square, bigrams) => bigrams.map((p) => playfairPair(square, p, +1));
  const playfairDecrypt = (square, bigrams) => bigrams.map((p) => playfairPair(square, p, -1));

  /* ---------- Двоквадратний шифр (розділ 4.4) ---------- */

  /*
   * Шифрування: перша літера - у лівому квадраті (r1, c1), друга - у правому (r2, c2).
   *   r1 != r2 -> RIGHT[r1][c2] + LEFT[r2][c1]
   *   r1 == r2 -> RIGHT[r1][c1] + LEFT[r2][c2]
   * Розшифрування: перша літера - у правому квадраті, друга - у лівому.
   */
  class TwoSquare {
    constructor(leftKey, rightKey) {
      this.left = new KeySquare(leftKey);
      this.right = new KeySquare(rightKey);
    }

    encryptPair(pair) {
      const [r1, c1] = this.left.position(pair[0]);
      const [r2, c2] = this.right.position(pair[1]);
      if (r1 !== r2) return this.right.at(r1, c2) + this.left.at(r2, c1);
      return this.right.at(r1, c1) + this.left.at(r2, c2);
    }

    decryptPair(pair) {
      const [r1, x] = this.right.position(pair[0]);
      const [r2, y] = this.left.position(pair[1]);
      if (r1 !== r2) return this.left.at(r1, y) + this.right.at(r2, x); // x = c2, y = c1
      return this.left.at(r1, x) + this.right.at(r2, y); // x = c1, y = c2
    }

    sameRow(pair, decrypt = false) {
      const [a, b] = decrypt ? [this.right, this.left] : [this.left, this.right];
      return a.position(pair[0])[0] === b.position(pair[1])[0];
    }

    encrypt(bigrams) { return bigrams.map((p) => this.encryptPair(p)); }
    decrypt(bigrams) { return bigrams.map((p) => this.decryptPair(p)); }
  }

  /* ---------- Байти, UTF-8, Base64 ---------- */

  const utf8Encoder = new TextEncoder();
  const utf8StrictDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

  const utf8Encode = (text) => utf8Encoder.encode(text);

  function utf8DecodeStrict(bytes) {
    try {
      return utf8StrictDecoder.decode(bytes);
    } catch {
      throw new CipherInputError("Результат не є коректним UTF-8; перевірте ключ і шифротекст");
    }
  }

  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function base64Encode(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
      out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
      out += i + 2 < bytes.length ? B64[n & 63] : "=";
    }
    return out;
  }

  /**
   * Суворе декодування: лише алфавіт Base64, довжина кратна 4, правильне
   * доповнення і канонічна форма. Допускається тільки завершальний перенос рядка.
   */
  function base64DecodeStrict(text, what = "Base64") {
    const s = String(text).replace(/(\r?\n)+$/, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) {
      throw new CipherInputError(`Некоректний ${what}: недопустимі символи або довжина не кратна 4`);
    }
    const body = s.replace(/=+$/, "");
    const pad = s.length - body.length;
    const bytes = new Uint8Array((s.length / 4) * 3 - pad);
    let bits = 0, acc = 0, j = 0;
    for (const ch of body) {
      acc = (acc << 6) | B64.indexOf(ch);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes[j++] = (acc >> bits) & 0xff;
      }
    }
    if (base64Encode(bytes) !== s) {
      throw new CipherInputError(`Некоректний ${what}: неканонічне подання (зайві біти доповнення)`);
    }
    return bytes;
  }

  const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

  function fromHex(hex) {
    const s = hex.replace(/\s+/g, "");
    if (!/^([0-9a-fA-F]{2})*$/.test(s)) throw new CipherInputError("Некоректне шістнадцяткове подання");
    return Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));
  }

  /* ---------- Vernam / XOR (розділи 4.5–4.6) ---------- */

  function getCrypto() {
    const c = globalThis.crypto;
    if (!c || typeof c.getRandomValues !== "function") {
      throw new Error("Системний CSPRNG (crypto.getRandomValues) недоступний");
    }
    return c;
  }

  /** Одноразовий ключ із системного CSPRNG. Math.random не використовується. */
  function generateKey(length) {
    if (!Number.isInteger(length) || length < 0) throw new CipherInputError("Некоректна довжина ключа");
    const key = new Uint8Array(length);
    const c = getCrypto();
    for (let i = 0; i < length; i += 65536) c.getRandomValues(key.subarray(i, i + 65536)); // ліміт 64 КБ
    return key;
  }

  function xorBytes(data, key) {
    if (data.length !== key.length) {
      throw new CipherInputError(
        `Довжина ключа (${key.length} Б) не дорівнює довжині даних (${data.length} Б)`
      );
    }
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i];
    return out;
  }

  /** Текст не нормалізується мовчки: шифруються саме його байти UTF-8. */
  function vernamEncryptText(text, key = null) {
    const message = utf8Encode(text);
    const k = key ?? generateKey(message.length);
    return { cipher: xorBytes(message, k), key: k, message };
  }

  function vernamDecryptBytes(cipher, key) {
    return utf8DecodeStrict(xorBytes(cipher, key));
  }

  function vernamDecryptBase64(cipherB64, keyB64) {
    const cipher = base64DecodeStrict(cipherB64, "Base64 шифротексту");
    const key = base64DecodeStrict(keyB64, "Base64 ключа");
    return vernamDecryptBytes(cipher, key);
  }

  return {
    ALPHABET, CipherInputError, KeySquare, TwoSquare, RULE,
    normalizeLetters, normalizePlaintext, makeBigrams, makeBigramsDetailed, prepare, parseCiphertext,
    playfairRule, playfairEncrypt, playfairDecrypt,
    utf8Encode, utf8DecodeStrict, base64Encode, base64DecodeStrict, toHex, fromHex,
    generateKey, xorBytes, vernamEncryptText, vernamDecryptBytes, vernamDecryptBase64,
  };
});
