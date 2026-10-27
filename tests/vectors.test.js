"use strict";
// Фіксовані ключі в тестах - ДЕМОНСТРАЦІЙНІ публічні дані з методички.
const { describe, test } = require("node:test");
const { C, assert, seededRandom, SEED, randInt, randLetters, join, ascii, throwsInput } = require("./helpers.js");

describe("Контрольні вектори (розділ 7)", () => {
  test("Playfair E: MONARCHY, INSTRUMENTS -> GA TL MZ CL RQ XA", () => {
    const sq = new C.KeySquare("MONARCHY");
    assert.equal(C.playfairEncrypt(sq, C.prepare("INSTRUMENTS")).join(" "), "GA TL MZ CL RQ XA");
  });
  test("Playfair D: GA TL MZ CL RQ XA -> IN ST RU ME NT SX", () => {
    const sq = new C.KeySquare("MONARCHY");
    assert.equal(C.playfairDecrypt(sq, C.parseCiphertext("GA TL MZ CL RQ XA")).join(" "), "IN ST RU ME NT SX");
  });
  test("Два квадрати E: SECURITY -> NMDWQIPP", () => {
    const ts = new C.TwoSquare("EXAMPLE", "KEYWORD");
    assert.equal(join(ts.encrypt(C.prepare("SECURITY"))), "NMDWQIPP");
  });
  test("Два квадрати D: NMDWQIPP -> SECURITY", () => {
    const ts = new C.TwoSquare("EXAMPLE", "KEYWORD");
    assert.equal(join(ts.decrypt(C.parseCiphertext("NMDWQIPP"))), "SECURITY");
  });
  test("Vernam HEX: HELLO xor 1A2B3C4D5E -> 526E700111", () => {
    assert.equal(C.toHex(C.utf8Encode("HELLO")), "48 45 4C 4C 4F");
    const { cipher } = C.vernamEncryptText("HELLO", C.fromHex("1A2B3C4D5E"));
    assert.equal(C.toHex(cipher), "52 6E 70 01 11");
  });
  test("Vernam Base64: HELLO, Gis8TV4= -> Um5wARE=", () => {
    const { cipher } = C.vernamEncryptText("HELLO", C.base64DecodeStrict("Gis8TV4="));
    assert.equal(C.base64Encode(cipher), "Um5wARE=");
    assert.equal(C.vernamDecryptBase64("Um5wARE=", "Gis8TV4="), "HELLO");
  });
  test("Vernam UTF-8: Я (D0 AF), AQI= -> 0a0= (D1 AD)", () => {
    assert.equal(C.toHex(C.utf8Encode("Я")), "D0 AF");
    const { cipher } = C.vernamEncryptText("Я", C.base64DecodeStrict("AQI="));
    assert.equal(C.toHex(cipher), "D1 AD");
    assert.equal(C.base64Encode(cipher), "0a0=");
  });
});
