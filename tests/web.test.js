"use strict";
// Узгодженість веб-сторінки з кодом: сторінка відкривається без збирання,
// тому розбіжності між index.html і app.js можна виявити лише тестом.
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html");
const appJs = read("src/app.js");
const coreJs = read("src/cipherlab.js");

describe("Веб-версія", () => {
  test("сторінка підключає ядро раніше за інтерфейс", () => {
    const core = html.indexOf('src="src/cipherlab.js"');
    const app = html.indexOf('src="src/app.js"');
    assert.ok(core > 0 && app > core);
  });

  test("скрипти синтаксично коректні", () => {
    assert.doesNotThrow(() => new vm.Script(appJs, { filename: "app.js" }));
    assert.doesNotThrow(() => new vm.Script(coreJs, { filename: "cipherlab.js" }));
  });

  test("кожен id, який використовує app.js, існує в index.html", () => {
    const used = new Set([...appJs.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]));
    const defined = new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]));
    const missing = [...used].filter((id) => !defined.has(id));
    assert.deepEqual(missing, []);
    assert.ok(used.size >= 20);
  });

  test("ядро працює як браузерний скрипт і дає контрольний вектор", () => {
    const sandbox = { TextEncoder, TextDecoder, crypto: globalThis.crypto };
    sandbox.self = sandbox;
    vm.runInNewContext(coreJs, sandbox, { filename: "cipherlab.js" });
    const C = sandbox.CipherLab;
    assert.ok(C, "window.CipherLab не визначено");
    const sq = new C.KeySquare("MONARCHY");
    assert.equal(C.playfairEncrypt(sq, C.prepare("INSTRUMENTS")).join(""), "GATLMZCLRQXA");
  });

  test("інтерфейс не пише дані в консоль і не використовує Math.random", () => {
    for (const [name, src] of [["app.js", appJs], ["cipherlab.js", coreJs]]) {
      assert.ok(!/console\.(log|info|debug|warn)\s*\(/.test(src), `${name}: console`);
      assert.ok(!/Math\.random\s*\(/.test(src), `${name}: Math.random`);
    }
  });
});
