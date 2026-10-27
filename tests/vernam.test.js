"use strict";
// Фіксовані ключі в тестах - ДЕМОНСТРАЦІЙНІ публічні дані з методички.
const { describe, test } = require("node:test");
const { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput } = require("./helpers.js");

describe("Vernam XOR", () => {
  const roundtrip = (text) => {
    const { cipher, key } = C.vernamEncryptText(text);
    assert.equal(key.length, C.utf8Encode(text).length);
    assert.equal(C.vernamDecryptBase64(C.base64Encode(cipher), C.base64Encode(key)), text);
  };
  test("ASCII", () => roundtrip("HELLO"));
  test("український текст", () => roundtrip("Привіт, Ужгород! Їжак і ґанок"));
  test("емодзі (4 байти, сурогатні пари)", () => roundtrip("Ключ 🔑 і 👍🏽"));
  test("порожній текст", () => roundtrip(""));
  test("багаторядкове повідомлення", () => roundtrip("рядок 1\nрядок 2\r\nкінець\n"));
  test("розкладена форма не нормалізується мовчки", () => {
    const { message } = C.vernamEncryptText("é");
    assert.equal(message.length, 3);
  });
  test("кількість символів не підміняє кількість байтів", () => {
    const text = "Їжак🦔";
    assert.equal([...text].length, 5);
    assert.equal(C.utf8Encode(text).length, 12);
    throwsInput(() => C.vernamEncryptText(text, new Uint8Array([...text].length)));
  });
  test("ключ коротший або довший на 1 байт відхиляється", () => {
    const { cipher, key } = C.vernamEncryptText("HELLO");
    throwsInput(() => C.vernamDecryptBytes(cipher, key.slice(0, -1)));
    throwsInput(() => C.vernamDecryptBytes(cipher, Uint8Array.from([...key, 0])));
  });
  test("некоректний Base64", () => {
    for (const bad of ["Um5wARE", "Um5w*RE=", "Um5wARE==", "Um5w ARE=", "Um5wARF=", "===="]) {
      throwsInput(() => C.base64DecodeStrict(bad));
    }
  });
  test("завершальний перенос рядка у Base64 допустимий", () => {
    assert.equal(C.toHex(C.base64DecodeStrict("Um5wARE=\n")), "52 6E 70 01 11");
    assert.equal(C.toHex(C.base64DecodeStrict("Um5wARE=\r\n")), "52 6E 70 01 11");
  });
  test("Base64: кодування і декодування для всіх довжин 0..64", () => {
    const rnd = seededRandom(SEED + 3);
    for (let n = 0; n <= 64; n++) {
      const data = Uint8Array.from({ length: n }, () => randInt(rnd, 0, 255));
      const enc = C.base64Encode(data);
      assert.equal(enc, Buffer.from(data).toString("base64")); // звірка з еталоном Node
      assert.deepEqual(C.base64DecodeStrict(enc), data);
    }
  });
  test("пошкоджений UTF-8 після розшифрування дає помилку", () => {
    throwsInput(() => C.vernamDecryptBytes(Uint8Array.from([0xff, 0xfe]), new Uint8Array(2)));
  });
  test("два послідовні ключі належної довжини не збігаються", () => {
    const k1 = C.generateKey(32), k2 = C.generateKey(32);
    assert.equal(k1.length, 32);
    assert.notDeepEqual(k1, k2);
  });
  test("великий ключ (>64 КБ) генерується частинами", () => {
    assert.equal(C.generateKey(70000).length, 70000);
  });
  test("генеративний: XOR є власною оберненою операцією (500 масивів)", () => {
    const rnd = seededRandom(SEED + 2);
    for (let i = 0; i < 500; i++) {
      const n = randInt(rnd, 0, 64);
      const d = Uint8Array.from({ length: n }, () => randInt(rnd, 0, 255));
      const k = Uint8Array.from({ length: n }, () => randInt(rnd, 0, 255));
      assert.deepEqual(C.xorBytes(C.xorBytes(d, k), k), d);
    }
  });
  test("повторне використання ключа: C1 xor C2 = P1 xor P2 (не секретні дані)", () => {
    const p1 = ascii("ATTACK AT DAWN"), p2 = ascii("RETREAT AT SIX");
    const key = C.generateKey(p1.length);
    const x = C.xorBytes(C.xorBytes(p1, key), C.xorBytes(p2, key));
    assert.deepEqual(x, C.xorBytes(p1, p2));
    assert.deepEqual(C.xorBytes(x, p1), p2); // знаючи P1, відновлюємо P2 без ключа
  });
  test("зміна біта шифротексту не виявляється (немає цілісності)", () => {
    const { cipher, key } = C.vernamEncryptText("PAY 100");
    cipher[4] ^= "1".charCodeAt(0) ^ "9".charCodeAt(0);
    assert.equal(C.vernamDecryptBytes(cipher, key), "PAY 900");
  });
});
