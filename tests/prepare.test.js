"use strict";
// Фіксовані ключі в тестах - ДЕМОНСТРАЦІЙНІ публічні дані з методички.
const { describe, test } = require("node:test");
const { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput } = require("./helpers.js");

describe("Підготовка біграм", () => {
  test("приклади з таблиці методички", () => {
    const cases = { INSTRUMENTS: "IN ST RU ME NT SX", BALLOON: "BA LX LO ON", ODD: "OD DX", XX: "XQ XQ" };
    for (const [text, exp] of Object.entries(cases)) assert.equal(C.prepare(text).join(" "), exp, text);
  });
  test("непарна довжина, кінцева X", () => {
    assert.deepEqual(C.prepare("AX"), ["AX"]);
    assert.deepEqual(C.prepare("ABX"), ["AB", "XQ"]);
    assert.deepEqual(C.prepare("Z"), ["ZX"]);
  });
  test("J замінюється на I, регістр", () => {
    assert.equal(C.normalizePlaintext("jojo"), "IOIO");
    assert.equal(C.normalizePlaintext("hello"), "HELLO");
  });
  test("NFC: повна і розкладена форма дають однаковий результат", () => {
    assert.equal(C.normalizeLetters("é"), C.normalizeLetters("é"));
  });
  test("строгий режим відхиляє пробіли", () => throwsInput(() => C.normalizePlaintext("HELLO WORLD")));
  test("зручний режим вилучає пробіли й розділові знаки", () => {
    assert.equal(C.normalizePlaintext("Hello, World!", false), "HELLOWORLD");
  });
  test("порожній текст", () => {
    throwsInput(() => C.normalizePlaintext(""));
    throwsInput(() => C.normalizePlaintext("123 !!!", false));
  });
  test("шифротекст: парність і алфавіт", () => {
    throwsInput(() => C.parseCiphertext("ABC"));
    throwsInput(() => C.parseCiphertext("AB1C"));
    throwsInput(() => C.parseCiphertext(""));
    assert.deepEqual(C.parseCiphertext("ab cd"), ["AB", "CD"]);
  });
});
