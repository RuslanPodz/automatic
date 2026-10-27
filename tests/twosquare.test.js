"use strict";
// Фіксовані ключі в тестах - ДЕМОНСТРАЦІЙНІ публічні дані з методички.
const { describe, test } = require("node:test");
const { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput } = require("./helpers.js");

describe("Двоквадратний шифр", () => {
  const ts = new C.TwoSquare("EXAMPLE", "KEYWORD");
  test("різні рядки: SE -> NM", () => assert.equal(ts.encryptPair("SE"), "NM"));
  test("один рядок: EY -> KA і назад", () => {
    assert.ok(ts.sameRow("EY"));
    assert.equal(ts.encryptPair("EY"), "KA");
    assert.equal(ts.decryptPair("KA"), "EY");
  });
  test("незалежність ключів: обмін квадратів змінює результат", () => {
    const swapped = new C.TwoSquare("KEYWORD", "EXAMPLE");
    assert.notDeepEqual(swapped.encrypt(C.prepare("SECURITY")), ts.encrypt(C.prepare("SECURITY")));
  });
  test("бієкція на всіх 625 парах і обернене відображення", () => {
    const seen = new Set();
    for (const a of C.ALPHABET) for (const b of C.ALPHABET) {
      const e = ts.encryptPair(a + b);
      seen.add(e);
      assert.equal(ts.decryptPair(e), a + b);
    }
    assert.equal(seen.size, 625);
  });
  test("генеративний: 200 випадкових пар ключів", () => {
    const rnd = seededRandom(SEED + 1);
    for (let i = 0; i < 200; i++) {
      const t = new C.TwoSquare(randLetters(rnd, 1, 12), randLetters(rnd, 1, 12));
      const b = C.prepare(randLetters(rnd, 1, 30));
      assert.deepEqual(t.decrypt(t.encrypt(b)), b);
    }
  });
  test("порожній ключ відхиляється", () => throwsInput(() => new C.TwoSquare("EXAMPLE", "")));
});
