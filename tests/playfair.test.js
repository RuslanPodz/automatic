"use strict";
// Фіксовані ключі в тестах - ДЕМОНСТРАЦІЙНІ публічні дані з методички.
const { describe, test } = require("node:test");
const { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput } = require("./helpers.js");

describe("Правила Playfair", () => {
  const sq = new C.KeySquare("MONARCHY");
  test("спільний рядок із циклічним переходом", () => {
    assert.equal(C.playfairRule(sq, "AR"), C.RULE.ROW);
    assert.deepEqual(C.playfairEncrypt(sq, ["AR"]), ["RM"]);
    assert.deepEqual(C.playfairDecrypt(sq, ["RM"]), ["AR"]);
  });
  test("спільний стовпець із циклічним переходом", () => {
    assert.equal(C.playfairRule(sq, "LU"), C.RULE.COLUMN);
    assert.deepEqual(C.playfairEncrypt(sq, ["LU"]), ["UM"]);
    assert.deepEqual(C.playfairDecrypt(sq, ["UM"]), ["LU"]);
  });
  test("прямокутник", () => {
    assert.equal(C.playfairRule(sq, "IN"), C.RULE.RECTANGLE);
    assert.deepEqual(C.playfairEncrypt(sq, ["IN"]), ["GA"]);
    assert.deepEqual(C.playfairDecrypt(sq, ["GA"]), ["IN"]);
  });
  test("біграма з однакових літер відхиляється", () => throwsInput(() => C.playfairDecrypt(sq, ["AA"])));
  test("зворотність для 12 повідомлень і 3 ключів", () => {
    const msgs = ["INSTRUMENTS", "BALLOON", "ODD", "XX", "HELLOWORLD", "ATTACKATDAWN", "UZHHOROD",
      "CRYPTOGRAPHY", "IAMINAIAM", "QUIZ", "MISSISSIPPI", "Z"];
    for (const key of ["MONARCHY", "PLAYFAIR", "UZHNU"]) {
      const s = new C.KeySquare(key);
      for (const m of msgs) {
        const b = C.prepare(m);
        assert.deepEqual(C.playfairDecrypt(s, C.playfairEncrypt(s, b)), b, `${key}/${m}`);
      }
    }
  });
  test("генеративний: 300 випадкових квадратів і текстів", () => {
    const rnd = seededRandom(SEED);
    for (let i = 0; i < 300; i++) {
      const s = new C.KeySquare(randLetters(rnd, 1, 15));
      const b = C.prepare(randLetters(rnd, 1, 40));
      const e = C.playfairEncrypt(s, b);
      assert.ok(e.every((p) => p.length === 2 && p[0] !== p[1]));
      assert.deepEqual(C.playfairDecrypt(s, e), b);
    }
  });
});
