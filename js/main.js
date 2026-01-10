"use strict";

/* =========================
 * Constants
 * ========================= */

const DEFAULT_INPUT = `/
 .github
  README.md
  README.en.md
 public
  index.html
  js
   main.js
   socket.io.min.js
  css
   style.css
  images
   logo.png
   favicon-16x16.png
   favicon-32x32.png
   favicon-96x96.png
 src
  worker.js
 variants
  standalone
   server.js
   package.json
  redis-only
   server.js
   package.json
 server.js
 package.json
 LICENSE
 render.yaml`;

/* =========================
 * DOM Elements
 * ========================= */

const input  = document.getElementById("input");
const output = document.getElementById("output");
const slash  = document.getElementById("slash");
const copy   = document.getElementById("copy");
const reset  = document.getElementById("reset");

/* =========================
 * Tree Parsing Utilities
 * ========================= */

const isLastSibling = (lines, index, indent) => {
  for (let i = index + 1; i < lines.length; i += 1) {
    const nextIndent = lines[i].match(/^\s*/)[0].length;

    if (nextIndent === indent) {
      return false;
    }
    if (nextIndent < indent) {
      return true;
    }
  }
  return true;
};

const parse = (text) => {
  const lines = text
    .split("\n")
    .filter((line) => line.trim() !== "");

  const stack = [];
  let result = "";

  lines.forEach((line, index) => {
    const indent = line.match(/^\s*/)[0].length;
    const name = line.trim();

    const nextIndent =
      index < lines.length - 1
        ? lines[index + 1].match(/^\s*/)[0].length
        : -1;

    const isDir = nextIndent > indent;
    const last = isLastSibling(lines, index, indent);

    /* Root level */
    if (indent === 0) {
      stack.length = 0;

      result += slash.checked && isDir && !name.endsWith("/")
        ? `${name}/\n`
        : `${name}\n`;

      return;
    }

    /* Adjust stack */
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    /* Prefix */
    let prefix = "";
    stack.forEach((node) => {
      prefix += node.last ? "   " : "│  ";
    });

    result += prefix + (last ? "└─ " : "├─ ") + name;

    if (slash.checked && isDir && !name.endsWith("/")) {
      result += "/";
    }

    result += "\n";
    stack.push({ indent, last });
  });

  return result;
};

/* =========================
 * Scroll Synchronization
 * ========================= */

const syncScroll = (from, to) => {
  const maxFrom = from.scrollHeight - from.clientHeight || 1;
  const ratio = from.scrollTop / maxFrom;
  to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
};

let scrollLock = false;

const bindSyncScroll = (source, target) => {
  source.addEventListener("scroll", () => {
    if (scrollLock) return;
    scrollLock = true;
    syncScroll(source, target);
    scrollLock = false;
  });
};

bindSyncScroll(input, output);
bindSyncScroll(output, input);

/* =========================
 * State Management
 * ========================= */

const update = () => {
  output.textContent = parse(input.value);
  localStorage.setItem("dm-input", input.value);
  localStorage.setItem("dm-slash", String(slash.checked));
};

const load = () => {
  const savedInput = localStorage.getItem("dm-input");

  input.value =
    savedInput && savedInput.trim() !== ""
      ? savedInput
      : DEFAULT_INPUT;

  slash.checked = localStorage.getItem("dm-slash") === "true";
  update();
};

/* =========================
 * Input Handling
 * ========================= */

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const start = input.selectionStart;
  const value = input.value;

  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd =
    value.indexOf("\n", lineStart) === -1
      ? value.length
      : value.indexOf("\n", lineStart);

  const fullLine = value.slice(lineStart, lineEnd);
  e.preventDefault();

  /* Special case: single space line */
  if (fullLine === " " && start === lineStart + 1) {
    const before = value.slice(0, lineStart);
    const after = value.slice(start);
    const insert = "\n ";

    input.value = before + insert + after;
    input.selectionStart = input.selectionEnd = lineStart + insert.length;
    update();
    return;
  }

  let indent = fullLine.match(/^\s*/)[0];
  if (indent.length === 0) indent = " ";

  const insert = `\n${indent}`;
  input.value = value.slice(0, start) + insert + value.slice(start);

  const pos = start + insert.length;
  input.selectionStart = input.selectionEnd = pos;

  update();
});

/* =========================
 * Buttons
 * ========================= */

copy.addEventListener("click", () => {
  if (!navigator.clipboard?.writeText) return;

  navigator.clipboard
    .writeText(output.textContent)
    .then(() => {
      const original = copy.textContent;
      copy.textContent = "Copied!";
      setTimeout(() => {
        copy.textContent = original;
      }, 1500);
    })
    .catch((err) => {
      alert("コピーに失敗しました:", err);
    });
});

reset.addEventListener("click", () => {
  localStorage.clear();
  input.value = DEFAULT_INPUT;
  slash.checked = false;
  update();
});

/* =========================
 * Init
 * ========================= */

input.addEventListener("input", update);
slash.addEventListener("change", update);
document.addEventListener("DOMContentLoaded", load);
