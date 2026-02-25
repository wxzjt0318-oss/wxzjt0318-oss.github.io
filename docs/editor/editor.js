(function() {
"use strict";

const I18N = {
  "zh-CN": {
    pageTitle: "Mizuki 可视化编辑器",
    themeColor: "主题颜色",
    themeMode: "主题模式",
    themeDark: "默认深色",
    themeLight: "亮色主题",
    themeDeepBlue: "深蓝主题",
    themeHighContrast: "高对比度",
    colorRed: "红色",
    colorOrange: "橙色",
    colorYellow: "黄色",
    colorGreen: "绿色",
    colorCyan: "青色",
    colorBlue: "蓝色",
    colorPurple: "紫色",
    colorPink: "粉色",
    modulePanel: "模块面板",
    searchModules: "搜索模块...",
    editorPlaceholder: "在此输入 Markdown 内容...",
    cmdHeading: "标题",
    cmdBold: "加粗",
    cmdItalic: "斜体",
    cmdStrikethrough: "删除线",
    cmdUl: "无序列表",
    cmdOl: "有序列表",
    cmdTask: "任务列表",
    cmdQuote: "引用",
    cmdCode: "行内代码",
    cmdCodeblock: "代码块",
    cmdLink: "链接",
    cmdImage: "图片",
    cmdTable: "表格",
    cmdHr: "分割线",
    viewEdit: "编辑",
    viewSplit: "分屏",
    viewPreview: "预览",
    importFile: "导入",
    exportFile: "导出",
    fmConfig: "Front Matter 配置",
    fmTitle: "标题",
    fmTitlePh: "文章标题",
    fmPublished: "发布日期",
    fmUpdated: "更新日期",
    fmDesc: "描述",
    fmDescPh: "文章描述",
    fmImage: "封面图片",
    fmCategory: "分类",
    fmCategoryPh: "分类名称",
    fmTags: "标签",
    fmTagsPh: "标签1, 标签2, 标签3",
    fmDraft: "草稿",
    fmPinned: "置顶",
    fmComment: "评论",
    fmEncrypted: "加密",
    fmPassword: "密码",
    fmPasswordPh: "访问密码",
    fmPriority: "优先级",
    fmAlias: "别名",
    fmLang: "语言",
    fmLangDefault: "默认",
    fmLicense: "许可证",
    fmAuthor: "作者",
    fmAuthorPh: "作者名",
    fmSourceLink: "来源链接",
    fmApply: "应用到文章",
    fmCancelBtn: "取消",
    exportTitle: "导出文件",
    exportTxt: "📄 纯文本 (.txt)",
    dropMain: "📂 拖拽文件到此处导入",
    dropSub: "支持 .md .txt .html"
  },
  "zh-TW": {
    pageTitle: "Mizuki 視覺化編輯器",
    themeColor: "主題顏色",
    themeMode: "主題模式",
    themeDark: "預設深色",
    themeLight: "亮色主題",
    themeDeepBlue: "深藍主題",
    themeHighContrast: "高對比度",
    colorRed: "紅色",
    colorOrange: "橙色",
    colorYellow: "黃色",
    colorGreen: "綠色",
    colorCyan: "青色",
    colorBlue: "藍色",
    colorPurple: "紫色",
    colorPink: "粉色",
    modulePanel: "模組面板",
    searchModules: "搜尋模組...",
    editorPlaceholder: "在此輸入 Markdown 內容...",
    cmdHeading: "標題",
    cmdBold: "粗體",
    cmdItalic: "斜體",
    cmdStrikethrough: "刪除線",
    cmdUl: "無序清單",
    cmdOl: "有序清單",
    cmdTask: "任務清單",
    cmdQuote: "引用",
    cmdCode: "行內程式碼",
    cmdCodeblock: "程式碼區塊",
    cmdLink: "連結",
    cmdImage: "圖片",
    cmdTable: "表格",
    cmdHr: "分隔線",
    viewEdit: "編輯",
    viewSplit: "分屏",
    viewPreview: "預覽",
    importFile: "匯入",
    exportFile: "匯出",
    fmConfig: "Front Matter 設定",
    fmTitle: "標題",
    fmTitlePh: "文章標題",
    fmPublished: "發佈日期",
    fmUpdated: "更新日期",
    fmDesc: "描述",
    fmDescPh: "文章描述",
    fmImage: "封面圖片",
    fmCategory: "分類",
    fmCategoryPh: "分類名稱",
    fmTags: "標籤",
    fmTagsPh: "標籤1, 標籤2, 標籤3",
    fmDraft: "草稿",
    fmPinned: "置頂",
    fmComment: "留言",
    fmEncrypted: "加密",
    fmPassword: "密碼",
    fmPasswordPh: "存取密碼",
    fmPriority: "優先順序",
    fmAlias: "別名",
    fmLang: "語言",
    fmLangDefault: "預設",
    fmLicense: "授權條款",
    fmAuthor: "作者",
    fmAuthorPh: "作者名",
    fmSourceLink: "來源連結",
    fmApply: "套用至文章",
    fmCancelBtn: "取消",
    exportTitle: "匯出檔案",
    exportTxt: "📄 純文字 (.txt)",
    dropMain: "📂 拖曳檔案至此匯入",
    dropSub: "支援 .md .txt .html"
  },
  en: {
    pageTitle: "Mizuki Visual Editor",
    themeColor: "Theme Color",
    themeMode: "Theme Mode",
    themeDark: "Default Dark",
    themeLight: "Light Theme",
    themeDeepBlue: "Deep Blue",
    themeHighContrast: "High Contrast",
    colorRed: "Red",
    colorOrange: "Orange",
    colorYellow: "Yellow",
    colorGreen: "Green",
    colorCyan: "Cyan",
    colorBlue: "Blue",
    colorPurple: "Purple",
    colorPink: "Pink",
    modulePanel: "Modules",
    searchModules: "Search modules...",
    editorPlaceholder: "Type your Markdown here...",
    cmdHeading: "Heading",
    cmdBold: "Bold",
    cmdItalic: "Italic",
    cmdStrikethrough: "Strikethrough",
    cmdUl: "Bullet List",
    cmdOl: "Numbered List",
    cmdTask: "Task List",
    cmdQuote: "Blockquote",
    cmdCode: "Inline Code",
    cmdCodeblock: "Code Block",
    cmdLink: "Link",
    cmdImage: "Image",
    cmdTable: "Table",
    cmdHr: "Horizontal Rule",
    viewEdit: "Edit",
    viewSplit: "Split",
    viewPreview: "Preview",
    importFile: "Import",
    exportFile: "Export",
    fmConfig: "Front Matter Settings",
    fmTitle: "Title",
    fmTitlePh: "Article title",
    fmPublished: "Published",
    fmUpdated: "Updated",
    fmDesc: "Description",
    fmDescPh: "Article description",
    fmImage: "Cover image",
    fmCategory: "Category",
    fmCategoryPh: "Category name",
    fmTags: "Tags",
    fmTagsPh: "tag1, tag2, tag3",
    fmDraft: "Draft",
    fmPinned: "Pinned",
    fmComment: "Comments",
    fmEncrypted: "Encrypted",
    fmPassword: "Password",
    fmPasswordPh: "Access password",
    fmPriority: "Priority",
    fmAlias: "Alias",
    fmLang: "Language",
    fmLangDefault: "Default",
    fmLicense: "License",
    fmAuthor: "Author",
    fmAuthorPh: "Author name",
    fmSourceLink: "Source link",
    fmApply: "Apply to Article",
    fmCancelBtn: "Cancel",
    exportTitle: "Export File",
    exportTxt: "📄 Plain Text (.txt)",
    dropMain: "📂 Drop files here to import",
    dropSub: "Supports .md .txt .html"
  },
  ja: {
    pageTitle: "Mizuki ビジュアルエディタ",
    themeColor: "テーマカラー",
    themeMode: "テーマモード",
    themeDark: "デフォルトダーク",
    themeLight: "ライト",
    themeDeepBlue: "ディープブルー",
    themeHighContrast: "ハイコントラスト",
    colorRed: "赤",
    colorOrange: "オレンジ",
    colorYellow: "黄",
    colorGreen: "緑",
    colorCyan: "シアン",
    colorBlue: "青",
    colorPurple: "紫",
    colorPink: "ピンク",
    modulePanel: "モジュール",
    searchModules: "モジュール検索...",
    editorPlaceholder: "ここにMarkdownを入力...",
    cmdHeading: "見出し",
    cmdBold: "太字",
    cmdItalic: "斜体",
    cmdStrikethrough: "取消線",
    cmdUl: "箇条書き",
    cmdOl: "番号付き",
    cmdTask: "タスク",
    cmdQuote: "引用",
    cmdCode: "インラインコード",
    cmdCodeblock: "コードブロック",
    cmdLink: "リンク",
    cmdImage: "画像",
    cmdTable: "表",
    cmdHr: "区切り線",
    viewEdit: "編集",
    viewSplit: "分割",
    viewPreview: "プレビュー",
    importFile: "インポート",
    exportFile: "エクスポート",
    fmConfig: "Front Matter 設定",
    fmTitle: "タイトル",
    fmTitlePh: "記事タイトル",
    fmPublished: "公開日",
    fmUpdated: "更新日",
    fmDesc: "説明",
    fmDescPh: "記事の説明",
    fmImage: "カバー画像",
    fmCategory: "カテゴリ",
    fmCategoryPh: "カテゴリ名",
    fmTags: "タグ",
    fmTagsPh: "タグ1, タグ2, タグ3",
    fmDraft: "下書き",
    fmPinned: "ピン留め",
    fmComment: "コメント",
    fmEncrypted: "暗号化",
    fmPassword: "パスワード",
    fmPasswordPh: "アクセスパスワード",
    fmPriority: "優先度",
    fmAlias: "エイリアス",
    fmLang: "言語",
    fmLangDefault: "デフォルト",
    fmLicense: "ライセンス",
    fmAuthor: "著者",
    fmAuthorPh: "著者名",
    fmSourceLink: "ソースリンク",
    fmApply: "記事に適用",
    fmCancelBtn: "キャンセル",
    exportTitle: "ファイルエクスポート",
    exportTxt: "📄 プレーンテキスト (.txt)",
    dropMain: "📂 ファイルをここにドラッグ＆ドロップ",
    dropSub: ".md .txt .html に対応"
  }
};

let currentLang = localStorage.getItem("mizuki-editor-lang") || "zh-CN";

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N["zh-CN"][key]) || key;
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    if (el.tagName === "TITLE") {
      document.title = t(key);
      return;
    }
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    el.setAttribute("title", t(key));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", t(key));
  });
}

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const previewSection = document.getElementById("previewSection");
const modulePanel = document.getElementById("modulePanel");
const themePickerBtn = document.getElementById("themePickerBtn");
const themePickerPanel = document.getElementById("themePickerPanel");
const hueSlider = document.getElementById("hueSlider");
const huePreview = document.getElementById("huePreview");

function setHue(hue) {
  document.documentElement.style.setProperty("--hue", hue);
  if (huePreview) {
    huePreview.style.background = `hsl(${hue} 70% 55%)`;
  }
  localStorage.setItem("mizuki-editor-hue", String(hue));
}

function setTheme(theme) {
  document.body.classList.remove("theme-light", "theme-deep-blue", "theme-high-contrast");
  if (theme === "light") document.body.classList.add("theme-light");
  if (theme === "deep-blue") document.body.classList.add("theme-deep-blue");
  if (theme === "high-contrast") document.body.classList.add("theme-high-contrast");
  localStorage.setItem("mizuki-editor-theme", theme);
}

function renderPreview() {
  if (!preview || !editor) return;
  const content = editor.value || "";
  preview.innerHTML = window.marked.parse(content);
  if (window.hljs) {
    preview.querySelectorAll("pre code").forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }
}

function insertAtSelection(before, after = "") {
  if (!editor) return;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  editor.value = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
  editor.focus();
  editor.selectionStart = start + before.length;
  editor.selectionEnd = end + before.length;
  renderPreview();
}

function handleToolbarAction(cmd) {
  const map = {
    heading: () => insertAtSelection("# ", ""),
    bold: () => insertAtSelection("**", "**"),
    italic: () => insertAtSelection("*", "*"),
    strikethrough: () => insertAtSelection("~~", "~~"),
    ul: () => insertAtSelection("- ", ""),
    ol: () => insertAtSelection("1. ", ""),
    task: () => insertAtSelection("- [ ] ", ""),
    quote: () => insertAtSelection("> ", ""),
    code: () => insertAtSelection("`", "`"),
    codeblock: () => insertAtSelection("```", "```"),
    link: () => insertAtSelection("[text](", ")"),
    image: () => insertAtSelection("![alt](", ")"),
    table: () => insertAtSelection("| h1 | h2 |\n| --- | --- |\n| c1 | c2 |\n", ""),
    hr: () => insertAtSelection("\n---\n", "")
  };
  if (map[cmd]) map[cmd]();
}

function setView(view) {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === view);
  });
  if (!previewSection) return;
  if (view === "edit") {
    previewSection.classList.add("hidden");
  } else if (view === "preview") {
    previewSection.classList.remove("hidden");
  } else {
    previewSection.classList.remove("hidden");
  }
}

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
}

function buildFrontMatter(data) {
  const lines = [
    "---",
    `title: ${data.title || ""}`,
    `published: ${data.published || ""}`,
    data.updated ? `updated: ${data.updated}` : null,
    `description: ${data.description || ""}`,
    `image: ${data.image || ""}`,
    `tags: ${data.tags || ""}`,
    `category: ${data.category || ""}`,
    `draft: ${data.draft ? "true" : "false"}`,
    `pinned: ${data.pinned ? "true" : "false"}`,
    `comments: ${data.comment ? "true" : "false"}`,
    data.encrypted ? `encrypted: true` : null,
    data.password ? `password: ${data.password}` : null,
    data.priority ? `priority: ${data.priority}` : null,
    data.alias ? `alias: ${data.alias}` : null,
    data.lang ? `lang: ${data.lang}` : null,
    data.license ? `licenseName: ${data.license}` : null,
    data.author ? `author: ${data.author}` : null,
    data.source ? `sourceLink: ${data.source}` : null,
    "---",
    ""
  ].filter(Boolean);
  return lines.join("\n");
}

function initFrontMatter() {
  const applyBtn = document.getElementById("fmApply");
  const closeBtn = document.getElementById("fmClose");
  const cancelBtn = document.getElementById("fmCancel");
  const encryptedCheck = document.getElementById("fm-encrypted");
  const passwordRow = document.getElementById("fm-password-row");
  if (encryptedCheck && passwordRow) {
    encryptedCheck.addEventListener("change", () => {
      passwordRow.classList.toggle("hidden", !encryptedCheck.checked);
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", () => toggleModal("fmModal", false));
  if (cancelBtn) cancelBtn.addEventListener("click", () => toggleModal("fmModal", false));
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const data = {
        title: document.getElementById("fm-title").value,
        published: document.getElementById("fm-published").value,
        updated: document.getElementById("fm-updated").value,
        description: document.getElementById("fm-description").value,
        image: document.getElementById("fm-image").value,
        category: document.getElementById("fm-category").value,
        tags: document.getElementById("fm-tags").value,
        draft: document.getElementById("fm-draft").checked,
        pinned: document.getElementById("fm-pinned").checked,
        comment: document.getElementById("fm-comment").checked,
        encrypted: document.getElementById("fm-encrypted").checked,
        password: document.getElementById("fm-password").value,
        priority: document.getElementById("fm-priority").value,
        alias: document.getElementById("fm-alias").value,
        lang: document.getElementById("fm-lang").value,
        license: document.getElementById("fm-license").value,
        author: document.getElementById("fm-author").value,
        source: document.getElementById("fm-source").value
      };
      const fm = buildFrontMatter(data);
      if (editor) {
        editor.value = fm + editor.value.replace(/^---[\s\S]*?---\s*/m, "");
        renderPreview();
      }
      toggleModal("fmModal", false);
    });
  }
}

function initImportExport() {
  const importBtn = document.getElementById("btnImport");
  const exportBtn = document.getElementById("btnExport");
  const fileInput = document.getElementById("fileInput");
  const exportModal = document.getElementById("exportModal");
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (editor) {
          editor.value = reader.result || "";
          renderPreview();
        }
      };
      reader.readAsText(file);
    });
  }
  if (exportBtn) exportBtn.addEventListener("click", () => toggleModal("exportModal", true));
  if (exportModal) {
    exportModal.querySelectorAll(".export-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const format = btn.getAttribute("data-format") || "md";
        const content = editor ? editor.value : "";
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `mizuki.${format}`;
        link.click();
        URL.revokeObjectURL(url);
        toggleModal("exportModal", false);
      });
    });
  }
}

function initDragDrop() {
  const overlay = document.getElementById("dropOverlay");
  const hide = () => overlay && overlay.classList.add("hidden");
  const show = () => overlay && overlay.classList.remove("hidden");
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    show();
  });
  document.addEventListener("dragleave", (e) => {
    if (e.relatedTarget) return;
    hide();
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    hide();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (editor) {
        editor.value = reader.result || "";
        renderPreview();
      }
    };
    reader.readAsText(file);
  });
}

function initThemePicker() {
  if (!themePickerBtn || !themePickerPanel) return;
  themePickerBtn.addEventListener("click", () => {
    themePickerPanel.classList.toggle("hidden");
  });
  const savedHue = localStorage.getItem("mizuki-editor-hue");
  if (savedHue && hueSlider) {
    hueSlider.value = savedHue;
    setHue(savedHue);
  } else {
    setHue(hueSlider ? hueSlider.value : 60);
  }
  if (hueSlider) {
    hueSlider.addEventListener("input", () => setHue(hueSlider.value));
  }
  document.querySelectorAll(".preset").forEach((el) => {
    el.addEventListener("click", () => {
      const hue = el.getAttribute("data-hue");
      if (hueSlider) hueSlider.value = hue;
      setHue(hue);
    });
  });
  const savedTheme = localStorage.getItem("mizuki-editor-theme") || "dark";
  setTheme(savedTheme);
  document.querySelectorAll(".theme-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      const theme = opt.getAttribute("data-theme");
      document.querySelectorAll(".theme-opt").forEach((item) => item.classList.remove("active"));
      opt.classList.add("active");
      setTheme(theme);
    });
  });
}

function initLangSelector() {
  const btn = document.getElementById("btnLang");
  const dropdown = document.getElementById("langDropdown");
  if (!btn || !dropdown) return;
  btn.addEventListener("click", () => dropdown.classList.toggle("hidden"));
  dropdown.querySelectorAll(".lang-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      currentLang = opt.getAttribute("data-lang");
      localStorage.setItem("mizuki-editor-lang", currentLang);
      dropdown.querySelectorAll(".lang-opt").forEach((item) => item.classList.remove("active"));
      opt.classList.add("active");
      applyI18n();
    });
  });
  dropdown.querySelectorAll(".lang-opt").forEach((opt) => {
    opt.classList.toggle("active", opt.getAttribute("data-lang") === currentLang);
  });
  applyI18n();
}

function initModulePanel() {
  const list = document.getElementById("moduleList");
  const search = document.getElementById("moduleSearch");
  const modules = [
    { name: "H1", insert: "# " },
    { name: "Bold", insert: "**text**" },
    { name: "Italic", insert: "*text*" },
    { name: "Quote", insert: "> quote" },
    { name: "Code Block", insert: "```js\nconsole.log('hello')\n```" },
    { name: "Image", insert: "![alt](url)" },
    { name: "Link", insert: "[text](url)" }
  ];
  const render = (keyword = "") => {
    if (!list) return;
    list.innerHTML = "";
    modules.filter((m) => m.name.toLowerCase().includes(keyword.toLowerCase()))
      .forEach((m) => {
        const item = document.createElement("div");
        item.className = "module-item";
        item.textContent = m.name;
        item.addEventListener("click", () => {
          insertAtSelection(m.insert, "");
        });
        list.appendChild(item);
      });
  };
  render();
  if (search) {
    search.addEventListener("input", () => render(search.value));
  }
  const toggleBtn = document.getElementById("toggleModules");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (modulePanel) modulePanel.classList.toggle("hidden");
    });
  }
}

document.querySelectorAll(".tool-btn[data-cmd]").forEach((btn) => {
  btn.addEventListener("click", () => handleToolbarAction(btn.getAttribute("data-cmd")));
});

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.getAttribute("data-view")));
});

const fmBtn = document.getElementById("btnFrontMatter");
if (fmBtn) fmBtn.addEventListener("click", () => toggleModal("fmModal", true));

if (editor) {
  editor.addEventListener("input", renderPreview);
  renderPreview();
}

initFrontMatter();
initImportExport();
initDragDrop();
initThemePicker();
initLangSelector();
initModulePanel();
})();
