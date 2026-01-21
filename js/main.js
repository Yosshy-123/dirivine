"use strict";

document.addEventListener("DOMContentLoaded", () => {
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
 server.js
 package.json
 LICENSE
 render.yaml`;

  const STORAGE_KEYS = {
    INPUT: "dm-input",
    SLASH: "dm-slash",
  };

  const input  = document.getElementById("input");
  const output = document.getElementById("output");
  const slash  = document.getElementById("slash");
  const copy   = document.getElementById("copy");
  const reset  = document.getElementById("reset");

  const isLastSibling = (lines, index, indent) => {
    for (let i = index + 1; i < lines.length; i += 1) {
      const nextIndent = lines[i].match(/^\s*/)[0].length;
      if (nextIndent === indent) return false;
      if (nextIndent < indent) return true;
    }
    return true;
  };

  const parse = (text) => {
    const lines = text
      .split("\n")
      .filter((line) => line.trim() !== "");

    const stack = [];
    const parts = [];

    lines.forEach((line, index) => {
      const indent = line.match(/^\s*/)[0].length;
      const name = line.trim();

      const nextIndent =
        index < lines.length - 1
          ? lines[index + 1].match(/^\s*/)[0].length
          : -1;

      const isDir = nextIndent > indent;
      const last = isLastSibling(lines, index, indent);

      if (indent === 0) {
        stack.length = 0;
        parts.push(
          slash.checked && isDir && !name.endsWith("/")
            ? `${name}/`
            : `${name}`
        );
        return;
      }

      while (stack.length && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      let prefix = "";
      stack.forEach((node) => {
        prefix += node.last ? "   " : "│  ";
      });

      let lineOut = prefix + (last ? "└─ " : "├─ ") + name;

      if (slash.checked && isDir && !name.endsWith("/")) {
        lineOut += "/";
      }

      parts.push(lineOut);
      stack.push({ indent, last });
    });

    return parts.length ? parts.join("\n") + "\n" : "";
  };

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

  const update = () => {
    output.textContent = parse(input.value);
    try {
      localStorage.setItem(STORAGE_KEYS.INPUT, input.value);
      localStorage.setItem(STORAGE_KEYS.SLASH, String(slash.checked));
    } catch (err) {
      console.warn("Failed to save to localStorage:", err);
    }
  };

  const load = () => {
    try {
      const savedInput = localStorage.getItem(STORAGE_KEYS.INPUT);
      input.value =
        savedInput && savedInput.trim() !== ""
          ? savedInput
          : DEFAULT_INPUT;
      slash.checked = localStorage.getItem(STORAGE_KEYS.SLASH) === "true";
    } catch (err) {
      console.warn("Failed to load from localStorage:", err);
      input.value = DEFAULT_INPUT;
      slash.checked = false;
    }
    update();
  };

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

  const showCopyErrorOnButton = (message = "⚠ Copy failed", duration = 1500) => {
    const original = copy.textContent;
    copy.textContent = message;
    copy.classList.add("copy-error");
    setTimeout(() => {
      copy.textContent = original;
      copy.classList.remove("copy-error");
    }, duration);
  };

  const showCopySuccessOnButton = (message = "Copied!", duration = 1500) => {
    const original = copy.textContent;
    copy.textContent = message;
    copy.classList.add("copy-success");
    setTimeout(() => {
      copy.textContent = original;
      copy.classList.remove("copy-success");
    }, duration);
  };

  copy.addEventListener("click", async () => {
    const text = output.textContent;
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        showCopySuccessOnButton();
      } catch (err) {
        console.error("navigator.clipboard.writeText error:", err);
        showCopyErrorOnButton();
      }
      return;
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.setAttribute("readonly", "");
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);

      if (!ok) {
        console.error("document.execCommand('copy') returned false.");
        showCopyErrorOnButton();
      } else {
        showCopySuccessOnButton();
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
      showCopyErrorOnButton();
    }
  });

  reset.addEventListener("click", () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.INPUT);
      localStorage.removeItem(STORAGE_KEYS.SLASH);
    } catch (err) {
      console.warn("Failed to clear localStorage:", err);
    }

    input.value = DEFAULT_INPUT;
    slash.checked = false;
    update();
  });

  input.addEventListener("input", update);
  slash.addEventListener("change", update);
  load();
});
