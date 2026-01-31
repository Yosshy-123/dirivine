"use strict";

const DEFAULT_INPUT = `/
 .github
  logo.png
  README.ja.md
  README.md
 lib
  redisHelpers.js
  redisKeys.js
 lua
  spamService.lua
  tokenBucket.lua
 public
  css
   style.css
  images
   favicon-16x16.png
   favicon-32x32.png
   favicon-96x96.png
   logo.png
  js
   main.js
   socket.io.min.js
  index.html
 services
  spamService.js
 utils
  logger.js
  redisUtils.js
  socketWrapper.js
  tokenBucket.js
 hop-check.js
 LICENSE
 package.json
 render.gs
 render.yaml
 server.js`;

const STORAGE_KEYS = {
  INPUT: "dm-input",
  SLASH: "dm-slash",
};

// Monaco loader config (CDN)
require.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
  },
});

require(["vs/editor/editor.main"], function () {
  monaco.editor.defineTheme("dirivine-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0a1224",
      "editorGutter.background": "#0a1224",
      "editor.lineHighlightBackground": "#0f1b33",
      "editorLineNumber.foreground": "#5b6b8a",
      "editorCursor.foreground": "#5b7cfa",
      "editor.selectionBackground": "#22304a",
      "editor.inactiveSelectionBackground": "#1a2540",
    },
  });
  monaco.editor.setTheme("dirivine-dark");

  // DOM references
  const inputContainer = document.getElementById("input-editor");
  const outputContainer = document.getElementById("output-editor");
  const slash = document.getElementById("slash");
  const copy = document.getElementById("copy");
  const reset = document.getElementById("reset");

  // Create editors
  const inputEditor = monaco.editor.create(inputContainer, {
    value: "",
    language: "plaintext",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
    lineNumbers: "on",
    renderWhitespace: "none",
    folding: false,
  });

  const outputEditor = monaco.editor.create(outputContainer, {
    value: "",
    language: "plaintext",
    readOnly: true,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true,
    lineNumbers: "off",
    renderWhitespace: "none",
    folding: false,
    cursorStyle: "line-thin",
    renderLineHighlight: "none",
  });

  // --- Scroll sync between editors ---
  let scrollLock = false;

  const getEditorScrollableInfo = (ed) => {
    const scrollHeight = ed.getScrollHeight ? ed.getScrollHeight() : 1;
    const layout = ed.getLayoutInfo ? ed.getLayoutInfo() : { height: ed.getDomNode ? ed.getDomNode().clientHeight : 1 };
    const clientHeight = layout.height || 1;
    return { scrollHeight, clientHeight };
  };

  const syncScroll = (from, to) => {
    try {
      const fromInfo = getEditorScrollableInfo(from);
      const toInfo = getEditorScrollableInfo(to);

      const maxFrom = Math.max(fromInfo.scrollHeight - fromInfo.clientHeight, 1);
      const ratio = (from.getScrollTop ? from.getScrollTop() : 0) / maxFrom;
      const maxTo = Math.max(toInfo.scrollHeight - toInfo.clientHeight, 1);
      const toScrollTop = ratio * maxTo;

      if (to.setScrollTop) to.setScrollTop(toScrollTop);
    } catch (err) {
      // silently ignore sync failures
    }
  };

  inputEditor.onDidScrollChange(() => {
    if (scrollLock) return;
    scrollLock = true;
    syncScroll(inputEditor, outputEditor);
    scrollLock = false;
  });

  outputEditor.onDidScrollChange(() => {
    if (scrollLock) return;
    scrollLock = true;
    syncScroll(outputEditor, inputEditor);
    scrollLock = false;
  });

  // --- Parse logic (same as original) ---
  const isLastSibling = (lines, index, indent) => {
    for (let i = index + 1; i < lines.length; i += 1) {
      const nextIndent = lines[i].match(/^\s*/)[0].length;
      if (nextIndent === indent) return false;
      if (nextIndent < indent) return true;
    }
    return true;
  };

  const parse = (text) => {
    const lines = text.split("\n").filter((line) => line.trim() !== "");

    const stack = [];
    const parts = [];

    lines.forEach((line, index) => {
      const indent = line.match(/^\s*/)[0].length;
      const name = line.trim();

      const nextIndent =
        index < lines.length - 1 ? lines[index + 1].match(/^\s*/)[0].length : -1;

      const isDir = nextIndent > indent;
      const last = isLastSibling(lines, index, indent);

      if (indent === 0) {
        stack.length = 0;
        parts.push(slash.checked && isDir && !name.endsWith("/") ? `${name}/` : `${name}`);
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

  // --- UI helpers for copy button feedback ---
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

  // --- Update (re-parse and persist) ---
  const update = () => {
    const text = inputEditor.getValue();
    const parsed = parse(text);
    outputEditor.setValue(parsed);

    try {
      localStorage.setItem(STORAGE_KEYS.INPUT, text);
      localStorage.setItem(STORAGE_KEYS.SLASH, String(slash.checked));
    } catch (err) {
      console.warn("Failed to save to localStorage:", err);
    }
  };

  // --- Copy button ---
  copy.addEventListener("click", async () => {
    const text = outputEditor.getValue();
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

    // fallback
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

  // --- Reset button ---
  reset.addEventListener("click", () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.INPUT);
      localStorage.removeItem(STORAGE_KEYS.SLASH);
    } catch (err) {
      console.warn("Failed to clear localStorage:", err);
    }

    inputEditor.setValue(DEFAULT_INPUT);
    slash.checked = false;
    update();
  });

  // --- Bind content + option changes ---
  inputEditor.onDidChangeModelContent(update);
  slash.addEventListener("change", update);

  // --- Load saved or default content ---
  const load = () => {
    try {
      const savedInput = localStorage.getItem(STORAGE_KEYS.INPUT);
      inputEditor.setValue(savedInput && savedInput.trim() !== "" ? savedInput : DEFAULT_INPUT);
      slash.checked = localStorage.getItem(STORAGE_KEYS.SLASH) === "true";
    } catch (err) {
      console.warn("Failed to load from localStorage:", err);
      inputEditor.setValue(DEFAULT_INPUT);
      slash.checked = false;
    }
    update();
  };

  load();
});
