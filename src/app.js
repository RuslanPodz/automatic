/*
 * Інтерфейс ЛР3. Лише робота з DOM; уся криптографічна логіка - у cipherlab.js.
 * Відкритий текст і ключі нікуди не надсилаються і не пишуться в консоль.
 */
(function () {
  "use strict";
  const C = window.CipherLab;
  const $ = (id) => document.getElementById(id);
  const MAX_FILE_BYTES = 5 * 1024 * 1024;

  const el = {
    input: $("input"), output: $("output"), key1: $("key1"), key2: $("key2"), vkey: $("vkey"),
    lenient: $("lenient"), run: $("run"), error: $("error"), status: $("status"),
    prepared: $("prepared"), steps: document.querySelector("#steps tbody"), squares: $("squares"),
    hexdump: $("hexdump"), file: $("file-input"),
  };

  const state = {
    lastExport: null,      // {name, text}
    lastKeyExport: null,
    keyUses: new Map(),    // ключ Base64 -> повідомлення, зашифроване ним у цій сесії
    fileTarget: null,
  };

  const algo = () => document.querySelector("input[name=algo]:checked").value;
  const op = () => document.querySelector("input[name=op]:checked").value;
  const isVernam = () => algo() === "vernam";
  const isEncrypt = () => op() === "encrypt";
  const show = (id, on) => { $(id).hidden = !on; };

  /* ---------- Повідомлення ---------- */

  function showError(err) {
    el.error.textContent = err instanceof C.CipherInputError
      ? err.message
      : "Непередбачена помилка. Перевірте вхідні дані.";
  }
  function clearMessages() { el.error.textContent = ""; el.status.textContent = ""; }
  const setStatus = (text) => { el.status.textContent = text; };

  /* ---------- Режим ---------- */

  function applyMode() {
    const v = isVernam(), enc = isEncrypt(), two = algo() === "twosquare";
    show("bigram-keys", !v);
    show("key2-field", two);
    $("key1-label").textContent = two ? "Ключ лівого квадрата" : "Ключ квадрата";
    show("lenient-field", !v && enc);
    show("vernam-key", v);
    $("gen-key").disabled = !enc;
    show("squares-card", !v);
    show("bytes-block", v);
    show("export-key", v && enc);
    show("prepared-block", !v);
    $("input-label").textContent = v
      ? (enc ? "Відкритий текст (UTF-8, без нормалізації)" : "Шифротекст (Base64)")
      : (enc ? "Відкритий текст" : "Шифротекст (пробіли між біграмами дозволені)");
    $("output-label").textContent = v
      ? (enc ? "Шифротекст (Base64)" : "Розшифрований текст")
      : (enc ? "Шифротекст" : "Розшифровані біграми (підготовлений потік)");
    $("prepared-block").querySelector(".label").textContent = enc ? "Підготовлені біграми" : "Біграми шифротексту";
    el.run.textContent = enc ? "Шифрувати" : "Розшифрувати";
    resetOutput();
    renderSquares();
    updateMeta();
  }

  function resetOutput() {
    el.output.value = "";
    $("output-meta").textContent = "";
    el.prepared.replaceChildren();
    el.steps.replaceChildren();
    el.hexdump.replaceChildren();
    state.lastExport = state.lastKeyExport = null;
    clearMessages();
  }

  /* ---------- Лічильники ---------- */

  function updateMeta() {
    const text = el.input.value;
    if (isVernam() && isEncrypt()) {
      $("input-meta").textContent = `${[...text].length} символів · ${C.utf8Encode(text).length} байтів UTF-8`;
    } else if (!isVernam()) {
      const letters = [...C.normalizeLetters(text)].filter((ch) => C.ALPHABET.includes(ch)).length;
      $("input-meta").textContent = `${letters} літер алфавіту`;
    } else {
      $("input-meta").textContent = "";
    }
    const k = el.vkey.value.trim();
    if (!k) { $("vkey-meta").textContent = "порожньо"; return; }
    try { $("vkey-meta").textContent = `${C.base64DecodeStrict(k).length} байтів`; }
    catch { $("vkey-meta").textContent = "некоректний Base64"; }
  }

  /* ---------- Квадрати ---------- */

  function currentSquares() {
    if (algo() === "playfair") return { main: new C.KeySquare(el.key1.value) };
    const ts = new C.TwoSquare(el.key1.value, el.key2.value);
    return { left: ts.left, right: ts.right, ts };
  }

  function squareTable(square, name, caption) {
    const fig = document.createElement("figure");
    fig.className = "square-box";
    const cap = document.createElement("figcaption");
    cap.textContent = caption;
    const table = document.createElement("table");
    table.className = "square";
    table.dataset.square = name;
    const head = table.createTHead().insertRow();
    head.appendChild(document.createElement("th"));
    for (let c = 1; c <= 5; c++) {
      const th = document.createElement("th"); th.scope = "col"; th.textContent = c; head.appendChild(th);
    }
    const body = table.createTBody();
    square.rows.forEach((row, r) => {
      const tr = body.insertRow();
      const th = document.createElement("th"); th.scope = "row"; th.textContent = r + 1; tr.appendChild(th);
      for (const ch of row) {
        const td = tr.insertCell(); td.textContent = ch; td.dataset.letter = ch;
      }
    });
    fig.append(cap, table);
    return fig;
  }

  function renderSquares() {
    if (isVernam()) return;
    el.squares.replaceChildren();
    const keyName = (k) => C.normalizeLetters(k).trim();
    const tryRender = (key, name, caption) => {
      try { el.squares.appendChild(squareTable(new C.KeySquare(key), name, caption)); }
      catch (e) {
        const p = document.createElement("p"); p.className = "square-error";
        p.textContent = `${caption}: ${e.message}`; el.squares.appendChild(p);
      }
    };
    if (algo() === "playfair") tryRender(el.key1.value, "main", `Квадрат · ${keyName(el.key1.value)}`);
    else {
      tryRender(el.key1.value, "left", `Лівий квадрат · ${keyName(el.key1.value)}`);
      tryRender(el.key2.value, "right", `Правий квадрат · ${keyName(el.key2.value)}`);
    }
  }

  function clearHighlight() {
    el.squares.querySelectorAll("td.src, td.dst").forEach((td) => td.classList.remove("src", "dst"));
    el.steps.querySelectorAll("tr.active").forEach((tr) => tr.classList.remove("active"));
  }

  function mark(squareName, letter, cls) {
    const td = el.squares.querySelector(`table[data-square="${squareName}"] td[data-letter="${letter}"]`);
    if (td) td.classList.add(cls);
  }

  /** Де шукати кожну літеру вхідної і вихідної біграми. */
  function locations() {
    if (algo() === "playfair") return { src: ["main", "main"], dst: ["main", "main"] };
    return isEncrypt()
      ? { src: ["left", "right"], dst: ["right", "left"] }
      : { src: ["right", "left"], dst: ["left", "right"] };
  }

  function highlight(tr) {
    clearHighlight();
    tr.classList.add("active");
    const loc = locations();
    [...tr.dataset.src].forEach((ch, i) => mark(loc.src[i], ch, "src"));
    [...tr.dataset.dst].forEach((ch, i) => mark(loc.dst[i], ch, "dst"));
  }

  /* ---------- Біграмні режими ---------- */

  function chips(items) {
    el.prepared.replaceChildren(...items.map(({ pair, filled }) => {
      const s = document.createElement("span");
      s.textContent = pair;
      if (filled) { s.className = "fill"; s.title = "друга літера - вставлений заповнювач"; }
      return s;
    }));
  }

  function runBigram() {
    const sq = currentSquares();
    let source, items;
    if (isEncrypt()) {
      const letters = C.normalizePlaintext(el.input.value, !el.lenient.checked);
      items = C.makeBigramsDetailed(letters);
      source = items.map((b) => b.pair);
    } else {
      source = C.parseCiphertext(el.input.value);
      items = source.map((pair) => ({ pair, filled: false }));
    }
    let result, rules;
    if (sq.main) {
      result = isEncrypt() ? C.playfairEncrypt(sq.main, source) : C.playfairDecrypt(sq.main, source);
      rules = source.map((p) => C.playfairRule(sq.main, p));
    } else {
      result = isEncrypt() ? sq.ts.encrypt(source) : sq.ts.decrypt(source);
      rules = source.map((p) => (sq.ts.sameRow(p, !isEncrypt()) ? "один рядок" : "різні рядки"));
    }

    renderSquares();
    chips(items);
    el.steps.replaceChildren(...source.map((p, i) => {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.dataset.src = p; tr.dataset.dst = result[i];
      for (const v of [i + 1, p, rules[i], result[i]]) tr.insertCell().textContent = v;
      tr.addEventListener("mouseenter", () => highlight(tr));
      tr.addEventListener("focus", () => highlight(tr));
      return tr;
    }));
    el.output.value = result.join(" ");
    $("output-meta").textContent = `${result.length} біграм · ${result.length * 2} літер`;
    state.lastExport = { name: isEncrypt() ? "ciphertext.txt" : "decrypted.txt", text: result.join("") + "\n" };
    setStatus(isEncrypt()
      ? "Готово. Пробіли лише групують біграми й не є частиною шифротексту."
      : "Готово. Заповнювачі X/Q не вилучаються автоматично: вони могли бути частиною тексту.");
  }

  /* ---------- Vernam ---------- */

  function hexRows(rows) {
    el.hexdump.replaceChildren(...rows.flatMap(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v || "(порожньо)";
      return [dt, dd];
    }));
  }

  function generateInto(lengthBytes) {
    const key = C.generateKey(lengthBytes);
    el.vkey.value = C.base64Encode(key);
    updateMeta();
    return key;
  }

  function runVernam() {
    if (isEncrypt()) {
      const text = el.input.value; // точно ті байти, що введено
      const message = C.utf8Encode(text);
      let key;
      if (!el.vkey.value.trim()) {
        key = generateInto(message.length);
      } else {
        key = C.base64DecodeStrict(el.vkey.value, "Base64 ключа");
        if (key.length !== message.length) {
          throw new C.CipherInputError(
            `Ключ має ${key.length} Б, а повідомлення ${message.length} Б UTF-8. Згенеруйте новий ключ.`
          );
        }
      }
      const keyB64 = C.base64Encode(key);
      const prev = state.keyUses.get(keyB64);
      if (prev !== undefined && prev !== text &&
          !window.confirm("Цей ключ уже використано для іншого повідомлення. Повторне використання " +
            "руйнує секретність одноразового блокнота. Продовжити все одно (лише для демонстрації)?")) {
        setStatus("Шифрування скасовано: ключ не можна використовувати повторно.");
        return;
      }
      state.keyUses.set(keyB64, text);
      const { cipher } = C.vernamEncryptText(text, key);
      const out = C.base64Encode(cipher);
      el.output.value = out;
      $("output-meta").textContent = `${cipher.length} байтів`;
      hexRows([["P", C.toHex(message)], ["K", C.toHex(key)], ["C = P ⊕ K", C.toHex(cipher)]]);
      state.lastExport = { name: "cipher.b64", text: out + "\n" };
      state.lastKeyExport = { name: "key.b64", text: keyB64 + "\n" };
      setStatus("Готово. Зберігайте і передавайте ключ окремо від шифротексту; не використовуйте його вдруге.");
    } else {
      const cipher = C.base64DecodeStrict(el.input.value, "Base64 шифротексту");
      const key = C.base64DecodeStrict(el.vkey.value, "Base64 ключа");
      const text = C.vernamDecryptBytes(cipher, key);
      el.output.value = text;
      $("output-meta").textContent = `${[...text].length} символів · ${cipher.length} байтів`;
      hexRows([["C", C.toHex(cipher)], ["K", C.toHex(key)], ["P = C ⊕ K", C.toHex(C.xorBytes(cipher, key))]]);
      state.lastExport = { name: "decrypted.txt", text };
      setStatus("Готово. Зверніть увагу: XOR не виявляє зміну шифротексту.");
    }
  }

  /* ---------- Дії ---------- */

  function run() {
    resetOutput();
    try {
      if (isVernam()) runVernam(); else runBigram();
    } catch (err) {
      showError(err);
    }
  }

  function download({ name, text }) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyOutput() {
    if (!el.output.value) { setStatus("Немає результату для копіювання."); return; }
    try { await navigator.clipboard.writeText(el.output.value); }
    catch { el.output.select(); document.execCommand("copy"); }
    setStatus("Результат скопійовано.");
  }

  async function importFile(file) {
    clearMessages();
    if (file.size > MAX_FILE_BYTES) { showError(new C.CipherInputError("Файл більший за 5 МБ")); return; }
    let text;
    try { text = C.utf8DecodeStrict(new Uint8Array(await file.arrayBuffer())); }
    catch { showError(new C.CipherInputError(`Файл '${file.name}' не є коректним UTF-8`)); return; }
    if (state.fileTarget === "vkey") el.vkey.value = text.replace(/(\r?\n)+$/, "");
    else el.input.value = text;
    updateMeta();
    setStatus(`Імпортовано '${file.name}'.`);
  }

  function swapResult() {
    if (!el.output.value) { setStatus("Спочатку виконайте операцію."); return; }
    const value = el.output.value;
    const wasEncrypt = isEncrypt();
    document.querySelector(`input[name=op][value=${wasEncrypt ? "decrypt" : "encrypt"}]`).checked = true;
    applyMode();
    el.input.value = value;
    if (isVernam() && !wasEncrypt) el.vkey.value = ""; // новому шифруванню - новий ключ
    updateMeta();
  }

  function keyReuseDemo() {
    const out = $("reuse-out");
    const p1 = C.utf8Encode($("p1").value), p2 = C.utf8Encode($("p2").value);
    const rows = [];
    if (p1.length !== p2.length || !p1.length) {
      rows.push(["Помилка", `Потрібні непорожні повідомлення однакової довжини в байтах (зараз ${p1.length} і ${p2.length}).`]);
    } else {
      const k = C.generateKey(p1.length);
      const c1 = C.xorBytes(p1, k), c2 = C.xorBytes(p2, k);
      const x = C.xorBytes(c1, c2), px = C.xorBytes(p1, p2);
      rows.push(["C1", C.toHex(c1)], ["C2", C.toHex(c2)], ["C1 ⊕ C2", C.toHex(x)], ["P1 ⊕ P2", C.toHex(px)],
        ["Збіг", x.every((b, i) => b === px[i]) ? "так — ключ повністю зник" : "ні"],
        ["(C1⊕C2)⊕P1", C.utf8DecodeStrict(C.xorBytes(x, p1)) + "  ← P2 відновлено без ключа"]);
    }
    out.replaceChildren(...rows.flatMap(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      return [dt, dd];
    }));
  }

  /* ---------- Події ---------- */

  document.querySelectorAll("input[name=algo], input[name=op]").forEach((r) => r.addEventListener("change", applyMode));
  el.run.addEventListener("click", run);
  el.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); });
  el.input.addEventListener("input", updateMeta);
  el.vkey.addEventListener("input", updateMeta);
  for (const k of [el.key1, el.key2]) {
    k.addEventListener("input", () => { resetOutput(); renderSquares(); });
  }
  $("gen-key").addEventListener("click", () => {
    if (el.vkey.value.trim() && !window.confirm("Поле вже містить ключ. Замінити його новим?")) return;
    generateInto(C.utf8Encode(el.input.value).length);
    setStatus("Згенеровано новий ключ довжиною повідомлення.");
  });
  $("copy").addEventListener("click", copyOutput);
  $("export").addEventListener("click", () => state.lastExport ? download(state.lastExport) : setStatus("Немає результату для експорту."));
  $("export-key").addEventListener("click", () => state.lastKeyExport ? download(state.lastKeyExport) : setStatus("Спочатку зашифруйте повідомлення."));
  $("import-input").addEventListener("click", () => { state.fileTarget = "input"; el.file.click(); });
  $("import-key").addEventListener("click", () => { state.fileTarget = "vkey"; el.file.click(); });
  el.file.addEventListener("change", () => { if (el.file.files[0]) importFile(el.file.files[0]); el.file.value = ""; });
  $("swap").addEventListener("click", swapResult);
  $("reuse-run").addEventListener("click", keyReuseDemo);
  el.squares.addEventListener("mouseleave", clearHighlight);

  applyMode();
})();
