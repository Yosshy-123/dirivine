"use strict";

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

const input = document.getElementById("input");
const output = document.getElementById("output");
const slash = document.getElementById("slash");
const copy = document.getElementById("copy");
const reset = document.getElementById("reset");

const isLastSibling = (lines, i, indent) => {
  for (let j = i + 1; j < lines.length; j += 1) {
    const ni = lines[j].match(/^\s*/)[0].length;
    if (ni === indent) {
      return false;
    }
    if (ni < indent) {
      return true;
    }
  }
  return true;
};

const parse = (text) => {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const stack = [];
  let out = "";

  lines.forEach((line, i) => {
    const indentMatch = line.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0].length : 0;
    const name = line.trim();

    const nextIndent = i < lines.length - 1
      ? lines[i + 1].match(/^\s*/)[0].length
      : -1;

    const isDir = nextIndent > indent;
    const last = isLastSibling(lines, i, indent);

    if (indent === 0) {
      while (stack.length) {
        stack.pop();
      }

      if (slash.checked && isDir && !name.endsWith("/")) {
        out += `${name}/\n`;
      } else {
        out += `${name}\n`;
      }

      return;
    }

    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    let prefix = "";
    stack.forEach((s) => {
      prefix += s.last ? "   " : "│  ";
    });

    out += prefix + (last ? "└─ " : "├─ ") + name;
    if (slash.checked && isDir && !name.endsWith("/")) {
      out += "/";
    }
    out += "\n";

    stack.push({ indent, last });
  });

  return out;
};

const syncScroll = (from, to) => {
  const denom = from.scrollHeight - from.clientHeight || 1;
  const ratio = from.scrollTop / denom;
  to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
};

let lock = false;

input.addEventListener("scroll", () => {
  if (lock) {
    return;
  }
  lock = true;
  syncScroll(input, output);
  lock = false;
});

output.addEventListener("scroll", () => {
  if (lock) {
    return;
  }
  lock = true;
  syncScroll(output, input);
  lock = false;
});

const update = () => {
  output.textContent = parse(input.value);
  localStorage.setItem("dm-input", input.value);
  localStorage.setItem("dm-slash", String(slash.checked));
};

const load = () => {
  const saved = localStorage.getItem("dm-input");
  input.value = saved && saved.trim() !== "" ? saved : DEFAULT_INPUT;
  slash.checked = localStorage.getItem("dm-slash") === "true";
  update();
};

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") {
    return;
  }

  const start = input.selectionStart;
  const value = input.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const line = value.slice(lineStart, start);
  const indentMatch = line.match(/^\s*/);
  const indent = indentMatch ? indentMatch[0] : "";

  e.preventDefault();

  const insert = `\n${indent}`;
  input.value = value.slice(0, start) + insert + value.slice(start);

  const pos = start + insert.length;
  input.selectionStart = input.selectionEnd = pos;

  update();
});

copy.addEventListener("click", () => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(output.textContent)
      .then(() => {
        const originalText = copy.textContent;
        copy.textContent = "Copied!";
        setTimeout(() => {
          copy.textContent = originalText;
        }, 1500);
      })
      .catch((err) => {
        alert("コピーに失敗しました:", err);
      });
  }
});

reset.addEventListener("click", () => {
  localStorage.clear();
  input.value = DEFAULT_INPUT;
  slash.checked = false;
  update();
});

input.addEventListener("input", update);
slash.addEventListener("change", update);

document.addEventListener("DOMContentLoaded", load);
