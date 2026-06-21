<div align="center">

# Kianer Reader

<img src="public/favicon.png" width="80" alt="Kianer Logo" />

**一款基于 Vue 3 + Ionic + Capacitor 的跨平台电子书阅读器**

支持 EPUB / PDF / TXT 三种格式，自带精美的毛玻璃风格界面

</div>

---

## ✨ 功能特色

### 📚 图书管理
- 导入 EPUB、PDF、TXT 三种格式（智能格式检测：扩展名 → Magic Number → MIME）
- **批量导入**：一次选择多个文件
- 书架网格布局，阅读进度实时显示
- 搜索书名/作者，四种排序方式（最近阅读/书名/进度/导入时间）
- 重复文件检测

### 📖 阅读器
- **三种渲染引擎**：epubjs、pdfjs-dist、纯文本分页引擎
- **三种阅读主题**：明亮、护眼（羊皮纸）、深色
- **阅读设置**：字体大小、行高、字体族、屏幕亮度、PDF 独立缩放
- **两种翻页模式**：仿真左右翻页、连续上下滚动
- **全文搜索**：支持 EPUB 逐章节检索、PDF 逐页检索、TXT 全文检索
- **目录导航**：EPUB 内建目录、PDF 大纲、TXT 章节正则检测
- **书签系统**：保存精确阅读位置（EPUB CFI / PDF 页码 / TXT 页码）
- **笔记与高亮**：选中文本做笔记，支持 6 种高亮颜色，EPUB 内联高亮
- **阅读进度**：滑块跳转 + 自动保存 + 进度恢复
- **沉浸模式**：自动隐藏状态栏

### 📊 阅读洞察
- 藏书总量、已读完、平均进度仪表盘
- 在读书籍 / 未读书籍统计
- 最近阅读记录

### 👤 个人中心
- 藏书-笔记-书签统计
- 全局夜间模式
- **数据备份**：导出完整数据（含书籍文件）为 JSON / 从 JSON 恢复
- 一键清理所有数据

### 📦 数据存储
- 使用 **IndexedDB**（localforage）存储书籍元数据与二进制文件
- 自动从旧版 localStorage 迁移

---

## 🛠 技术栈

| 层面 | 技术 |
|------|------|
| **框架** | Vue 3 + TypeScript 6 |
| **移动端** | Ionic 8 + Capacitor 8 |
| **UI** | Element Plus + Iconify + 毛玻璃设计 |
| **状态管理** | Pinia |
| **构建** | Vite 8 + Bun |
| **EPUB** | epubjs |
| **PDF** | pdfjs-dist |
| **存储** | localforage (IndexedDB) |
| **测试** | Vitest + Cypress |
| **代码检查** | ESLint 10 + @vue/eslint-config-typescript |
| **样式** | Less |
| **目标平台** | Web / Android |

---

## 🚀 快速开始

### 前置条件

- [Bun](https://bun.sh) ≥ 1.0
- [Node.js](https://nodejs.org) ≥ 20（可选，Bun 亦可）

### 安装依赖

```bash
bun install
```

### 启动开发服务

```bash
bun run dev
```

浏览器打开 `http://localhost:5173` 即可使用。

### 代码检查

```bash
bun run lint
```

---

## 📱 构建与发布

### Web 构建

```bash
bun run build
```

输出在 `dist/` 目录。

### Android 构建

```bash
# 1. 构建 Web 资源并同步到 Android
bun run static:sync

# 2. 打开 Android Studio
bun run android:open

# 3. 或直接构建 APK
bun run android:build
```

生成的 APK 在 `android/app/build/outputs/apk/debug/`。

---

## 📁 项目结构

```
kianer/
├── public/                    # 静态资源
│   ├── favicon.png
│   └── pdf.worker.mjs        # PDF.js worker
├── src/
│   ├── components/
│   │   └── reader/            # 阅读器子组件
│   │       ├── ReaderBookmarks.vue
│   │       ├── ReaderControls.vue
│   │       ├── ReaderNotes.vue
│   │       ├── ReaderSearch.vue
│   │       ├── ReaderSettings.vue
│   │       ├── ReaderTOC.vue
│   │       └── SelectionMenu.vue
│   ├── composables/           # 渲染引擎
│   │       ├── useEpubEngine.ts    # EPUB 引擎
│   │       ├── usePdfEngine.ts     # PDF 引擎
│   │       └── useTxtEngine.ts     # TXT 引擎（分页渲染）
│   ├── stores/                # Pinia 状态管理
│   │       ├── library.ts          # 图书元数据
│   │       └── reader.ts           # 阅读器设置
│   ├── utils/
│   │       └── parser.ts           # 元数据提取（封面、作者等）
│   ├── theme/
│   │       ├── glass.less          # 毛玻璃全局样式
│   │       └── variables.css       # CSS 变量
│   ├── views/
│   │       ├── HomePage.vue        # 书架首页
│   │       ├── ReaderPage.vue      # 阅读器
│   │       ├── Tab2Page.vue        # 阅读洞察
│   │       ├── Tab3Page.vue        # 个人中心
│   │       └── TabsPage.vue        # 底部 Tab 容器
│   ├── router/
│   │       └── index.ts
│   ├── main.ts
│   └── App.vue
├── tests/
│   ├── unit/                  # Vitest 单元测试
│   └── e2e/                   # Cypress E2E 测试
├── android/                   # Capacitor Android 项目
├── package.json
├── tsconfig.json
└── eslint.config.js
```

---

## 📄 开源协议

MIT
