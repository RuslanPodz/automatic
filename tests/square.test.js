"use strict";
// Фіксовані ключі в тестах - ДЕМОНСТРАЦІЙНІ публічні дані з методички.
const { describe, test } = require("node:test");
const { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput } = require("./helpers.js");

describe("Ключовий квадрат", () => {
  test("MONARCHY", () => {
    assert.deepEqual(new C.KeySquare("MONARCHY").rows, ["MONAR", "CHYBD", "EFGIK", "LPQST", "UVWXZ"]);
  });
  test("EXAMPLE і KEYWORD", () => {
    assert.deepEqual(new C.KeySquare("EXAMPLE").rows, ["EXAMP", "LBCDF", "GHIKN", "OQRST", "UVWYZ"]);
    assert.deepEqual(new C.KeySquare("KEYWORD").rows, ["KEYWO", "RDABC", "FGHIL", "MNPQS", "TUVXZ"]);
  });
  test("рівно 25 унікальних символів алфавіту", () => {
    for (const key of ["A", "ZEBRA", "JJJ", "abcdefghijklmnopqrstuvwxyz"]) {
      const letters = new C.KeySquare(key).letters;
      assert.equal(letters.length, 25);
      assert.deepEqual([...letters].sort().join(""), C.ALPHABET);
    }
  });
  test("малі літери і J -> I", () => {
    assert.equal(new C.KeySquare("jam").letters.slice(0, 2), "IA");
  });
  test("некоректні ключі відхиляються", () => {
    for (const key of ["", "   ", "KEY 1", "КЛЮЧ", "KEY!"]) throwsInput(() => new C.KeySquare(key));
  });
});
