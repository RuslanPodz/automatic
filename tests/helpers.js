"use strict";
/* Спільні допоміжні функції тестів. */
const C = require("../src/cipherlab.js");
const assert = require("node:assert/strict");

/** Відтворюваний ГПВЧ для генеративних тестів (mulberry32). Не для ключів! */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 20261027;
const randInt = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const randLetters = (rnd, lo, hi) =>
  Array.from({ length: randInt(rnd, lo, hi) }, () => C.ALPHABET[randInt(rnd, 0, 24)]).join("");
const join = (b) => b.join("");
const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
const throwsInput = (fn) => assert.throws(fn, C.CipherInputError);

module.exports = { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput };
