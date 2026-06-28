import { ref, shallowRef, watch } from 'vue';
import ePub, { Rendition } from 'epubjs';

// epubjs type declarations are incomplete — cast to callable
const createEpub = ePub as unknown as (data: ArrayBuffer) => any;
import { useReaderStore } from '@/stores/reader';
import { useLibraryStore, type Note } from '@/stores/library';
import { READING_THEMES, THEME_ORDER } from '@/theme/readingThemes';

export function useEpubEngine(bookId: string) {
  const readerStore = useReaderStore();
  const libraryStore = useLibraryStore();

  const rendition = shallowRef<Rendition | null>(null);
  const epubBook = shallowRef<any>(null);
  const progress = ref(0);
  const toc = ref<any[]>([]);
  const isPageLoading = ref(false);
  /** 当前章节路径（用于 TOC 高亮） */
  const currentHref = ref('');
  /** 章节切换过渡中 */
  const isTransitioning = ref(false);

  // Selection state (internal to engine, but exposed via event)
  let onSelectedCallback: ((cfiRange: string, text: string) => void) | null = null;
  let onGlobalClickCallback: ((relativeX: number) => void) | null = null;

  /**
   * 从阅读主题系统生成 iframe 主题 CSS
   * 自动覆盖所有已定义的主题，新增主题无需手动维护
   */

  /**
   * 选择性注册 epubjs 主题：不做样式注入（改用 kdf-themes 类名作用域 CSS），
   */
  const registerThemes = () => {
    if (!rendition.value) return;
    // 仅调用 select() 让 content 元素获得/失去类名（.day/.night/.sepia）
    // 实际 CSS 由 injectThemeStyles() 通过类名作用域注入，不受 DOM 顺序影响
    rendition.value.themes.select(readerStore.theme);
    // 注入类名作用域 CSS
    injectThemeStyles();
  };

  /**
   * 通过 epubjs getContents() 获取所有 iframe，注入字体族样式
   * 每次调用替换同一个 <style> 元素，不产生 CSS 堆积
   */
  const injectFontFamily = () => {
    if (!rendition.value) return;
    try {
      const contents = (rendition.value as any).getContents() as any[];
      if (!contents || contents.length === 0) return;
      const css = `body, p, span, div, h1, h2, h3, h4, h5, h6 { font-family: ${readerStore.fontFamily} !important; line-height: ${readerStore.lineHeight} !important; }`;
      for (const content of contents) {
        if (!content?.document?.head) continue;
        const doc = content.document;
        let style = doc.getElementById('kdf-font') as HTMLStyleElement;
        if (!style) {
          style = doc.createElement('style');
          style.id = 'kdf-font';
          doc.head.appendChild(style);
        }
        style.textContent = css;
      }
    } catch (e) {
      console.warn('Cannot inject font-family into EPUB content', e);
    }
  };

  /**
   * 从 IndexedDB 恢复已保存的高亮笔记到 epubjs annotation 系统
   * 在每次 rendered 事件后调用，确保翻页后高亮重新出现
   */
  const restoreHighlights = () => {
    if (!rendition.value) return;
    try {
      const book = libraryStore.books.find(b => b.id === bookId);
      if (!book || !book.notes || book.notes.length === 0) return;
      const epubNotes = book.notes.filter((n): n is Note & { cfi: string } => !!n.cfi);
      for (const note of epubNotes) {
        rendition.value.annotations.add(
          'highlight',
          note.cfi,
          {},
          undefined,
          'hl-class',
          { fill: note.color || '#ffe082' }
        );
      }
    } catch (e) {
      console.warn('Cannot restore EPUB highlights', e);
    }
  };

  /**
   * 生成所有主题的类名作用域 CSS 字符串
   * 用 .day body {} / .night body {} 代替裸 body{}，使 addClass/removeClass 真正控制主题
   * 自动从 readingThemes.ts 读取所有主题色，新增主题自动生效
   */
  const buildThemeCSS = () => {
    const lines: string[] = [];
    for (const name of THEME_ORDER) {
      const theme = READING_THEMES[name];
      if (!theme) continue;
      const bg = theme.vars['--bg-primary'];
      const color = theme.vars['--text-primary'];
      lines.push(`/* ${name}: ${theme.label} */`);
      lines.push(`.${name} body { background-color: ${bg} !important; color: ${color} !important; }`);
      lines.push(`.${name} p { color: ${color} !important; }`);
      lines.push(`.${name} span { color: ${color} !important; }`);
      lines.push(`.${name} div { color: ${color} !important; }`);
      lines.push(`.${name} a { color: ${theme.vars['--accent-color']} !important; }`);
    }
    return lines.join('\n');
  };

  /**
   * 向所有 iframe 注入类名作用域的主题 CSS
   * 每个内容页面只保留一个 <style id="kdf-themes"> 元素，重复调用只替换内容
   */
  const injectThemeStyles = () => {
    if (!rendition.value) return;
    try {
      const contents = (rendition.value as any).getContents() as any[];
      if (!contents || contents.length === 0) return;
      const css = buildThemeCSS();
      for (const content of contents) {
        if (!content?.document?.head) continue;
        const doc = content.document;
        let style = doc.getElementById('kdf-themes') as HTMLStyleElement;
        if (!style) {
          style = doc.createElement('style');
          style.id = 'kdf-themes';
          doc.head.appendChild(style);
        }
        style.textContent = css;
      }
    } catch (e) {
      console.warn('Cannot inject theme styles into EPUB content', e);
    }
  };

  /**
   * 更新 EPUB 样式：
   *  - 字体大小：epubjs themes.fontSize()
   *  - 字体族：直接操作 iframe DOM（避免 override 堆积）
   *  - 主题：用类名作用域 CSS 确保多次切换后仍然生效
   *  - 高亮笔记：从 IndexedDB 恢复
   */
  const updateEpubStyle = () => {
    if (!rendition.value) return;
    rendition.value.themes.fontSize(readerStore.fontSize + 'px');
    // themes.select() 的作用仅用于给 content 元素添加/移除类名（.day/.night/.sepia）
    // 实际样式由 kdf-themes 中的类名作用域 CSS 控制
    rendition.value.themes.select(readerStore.theme);
    injectThemeStyles();
    // 字体族需等 iframe 渲染完成后再注入
    requestAnimationFrame(() => injectFontFamily());
    // 恢复持久化的高亮笔记
    restoreHighlights();
  };

  const bindEpubHooks = (epub: any) => {
    if (!rendition.value) return;

    rendition.value.on("selected", (cfiRange: string) => {
      epub.getRange(cfiRange).then((range: Range) => {
        if (onSelectedCallback) {
          onSelectedCallback(cfiRange, range.toString());
        }
      });
    });

    rendition.value.hooks.content.register((contents: any) => {
      const el = contents.document.documentElement;

      // 阻止系统右键菜单弹出（选中文字时不再显示浏览器默认菜单）
      el.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault();
      });

      let startX = 0;
      let startY = 0;
      let startTime = 0;

      el.addEventListener('touchstart', (e: TouchEvent) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }, { passive: true });

      el.addEventListener('touchend', (e: TouchEvent) => {
        const duration = Date.now() - startTime;
        const distX = Math.abs(e.changedTouches[0].clientX - startX);
        const distY = Math.abs(e.changedTouches[0].clientY - startY);
        const selection = contents.window.getSelection().toString();

        if (duration < 300 && distX < 10 && distY < 10 && !selection) {
          const clickX = e.changedTouches[0].clientX;
          const relativeX = clickX % window.innerWidth;
          if (onGlobalClickCallback) onGlobalClickCallback(relativeX);
          e.preventDefault();
        }
      }, { passive: false });

      el.addEventListener('click', (e: MouseEvent) => {
        const selection = contents.window.getSelection().toString();
        if (!selection) {
          const clickX = e.clientX;
          const relativeX = clickX % window.innerWidth;
          if (onGlobalClickCallback) onGlobalClickCallback(relativeX);
        }
      });
    });
  };

  const initEpub = async (data: ArrayBuffer, containerId: string = "viewer") => {
    isPageLoading.value = true;
    const epub = createEpub(data);
    epubBook.value = epub;
    
    const navigation = await epub.loaded.navigation;
    toc.value = navigation.toc.map((item: { label: string; href: string }) => ({
      label: item.label.trim(),
      href: item.href
    }));

    // 宽屏（>=768px）时启用双页展开模式
    const spreadMode = window.innerWidth >= 768 ? 'auto' : 'none';

    rendition.value = epub.renderTo(containerId, {
      width: "100%",
      height: "100%",
      flow: readerStore.paginationMode === 'horizontal' ? "paginated" : "scrolled",
      manager: readerStore.paginationMode === 'horizontal' ? "default" : "continuous",
      spread: spreadMode,
      allowScriptedContent: true
    });

    const r = rendition.value!;

    // 核心修复：只在 started 时注册一次主题
    r.on("started", () => {
      registerThemes();
      // 应用初始字体大小（watcher 只在值变化时触发，首次打开不会执行）
      r.themes.fontSize(readerStore.fontSize + 'px');
    });

    // 翻页/渲染后：重新 apply 字体大小、主题、字体族和高亮笔记
    r.on("rendered", () => {
      r.themes.fontSize(readerStore.fontSize + 'px');
      r.themes.select(readerStore.theme);
      injectThemeStyles();
      injectFontFamily();
      restoreHighlights();
      isPageLoading.value = false;
    });

    const savedCfi = localStorage.getItem(`book-cfi-${bookId}`);
    r.display(savedCfi || undefined);
    
    r.on("relocated", (location: any) => {
      if (location.start) {
        currentHref.value = location.start.href || '';
        localStorage.setItem(`book-cfi-${bookId}`, location.start.cfi);
        if ((epub as any).locations.length() > 0) {
          const percent = (epub as any).locations.percentageFromCfi(location.start.cfi) * 100;
          progress.value = percent;
          libraryStore.updateProgress(bookId, percent);
        }
      }
    });

    epub.locations.generate(1024).then(() => {
      if (rendition.value) {
        const location = rendition.value.currentLocation();
        if (location && (location as any).start) {
          const percent = (epub as any).locations.percentageFromCfi((location as any).start.cfi) * 100;
          progress.value = percent;
        }
      }
    });

    bindEpubHooks(epub);
  };

  const handlePaginationChange = async () => {
    isPageLoading.value = true;
    const loc = rendition.value?.currentLocation?.() as any;
    const currentCfi = loc?.start?.cfi;
    
    if (rendition.value) {
      rendition.value.destroy();
      rendition.value = null;
    }

    // 复用已有的 epubBook，避免从 IndexedDB 重新加载（大幅提速）
    if (!epubBook.value) {
      const data = await libraryStore.getBookData(bookId);
      if (!data) return;
      const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
      epubBook.value = ePub(arrayBuffer);
      await epubBook.value.loaded.navigation;
    }

    const spreadMode = window.innerWidth >= 768 ? 'auto' : 'none';
    rendition.value = epubBook.value.renderTo("viewer", {
      width: "100%",
      height: "100%",
      flow: readerStore.paginationMode === 'horizontal' ? "paginated" : "scrolled",
      manager: readerStore.paginationMode === 'horizontal' ? "default" : "continuous",
      spread: spreadMode,
      allowScriptedContent: true
    });
    
    const r = rendition.value!;
    bindEpubHooks(epubBook.value);

    r.on("started", () => {
      registerThemes();
      r.themes.fontSize(readerStore.fontSize + 'px');
      if (currentCfi) {
        r.display(currentCfi);
      } else {
        r.display();
      }
      setTimeout(() => { isPageLoading.value = false; }, 200);
    });

    r.on("rendered", () => {
      r.themes.fontSize(readerStore.fontSize + 'px');
      r.themes.select(readerStore.theme);
      injectThemeStyles();
      injectFontFamily();
      restoreHighlights();
    });
    
    // 安全兜底
    setTimeout(() => { isPageLoading.value = false; }, 1500);
  };

  const jumpTo = async (href: string) => {
    // 淡出 → 切换 → 淡入
    isTransitioning.value = true;
    await new Promise(r => setTimeout(r, 180));
    try {
      await rendition.value?.display(href);
    } catch {
      // 静默
    }
    // 等新内容渲染完成后淡入
    requestAnimationFrame(() => {
      isTransitioning.value = false;
    });
  };

  const nextPage = () => {
    if (readerStore.paginationMode === 'horizontal') {
      rendition.value?.next();
    } else {
      const container = document.querySelector('.epub-render');
      if (container) container.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
    }
  };

  const prevPage = () => {
    if (readerStore.paginationMode === 'horizontal') {
      rendition.value?.prev();
    } else {
      const container = document.querySelector('.epub-render');
      if (container) container.scrollBy({ top: -(window.innerHeight * 0.9), behavior: 'smooth' });
    }
  };

  const onProgressChange = (val: number) => {
    if (rendition.value && epubBook.value) {
      const cfi = epubBook.value.locations.cfiFromPercentage(val / 100);
      rendition.value.display(cfi);
    }
  };

  // Watch for style changes
  watch([() => readerStore.theme, () => readerStore.fontSize, () => readerStore.fontFamily, () => readerStore.lineHeight], () => {
    updateEpubStyle();
  });

  return {
    rendition,
    epubBook,
    progress,
    toc,
    isPageLoading,
    initEpub,
    handlePaginationChange,
    updateEpubStyle,
    currentHref,
    isTransitioning,
    jumpTo,
    nextPage,
    prevPage,
    onProgressChange,
    onSelected: (cb: (cfiRange: string, text: string) => void) => { onSelectedCallback = cb; },
    onGlobalClick: (cb: (relativeX: number) => void) => { onGlobalClickCallback = cb; },
  };
}
