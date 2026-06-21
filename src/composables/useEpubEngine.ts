import { ref, shallowRef, watch, nextTick } from 'vue';
import ePub, { Rendition } from 'epubjs';

// epubjs type declarations are incomplete — cast to callable
const createEpub = ePub as unknown as (data: ArrayBuffer) => any;
import { useReaderStore } from '@/stores/reader';
import { useLibraryStore } from '@/stores/library';

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

  // Selection state (internal to engine, but exposed via event)
  let onSelectedCallback: ((cfiRange: string, text: string) => void) | null = null;
  let onGlobalClickCallback: ((relativeX: number) => void) | null = null;

  /** 主题色常量 */
  const THEMES: Record<string, { bg: string; color: string }> = {
    day:   { bg: '#ffffff', color: '#333333' },
    night: { bg: '#1a1a1a', color: '#ffffff' },
    sepia: { bg: '#f4ecd8', color: '#5b4636' },
  };

  /**
   * 构造不含 font-family 的主题样式对象
   * font-family 通过直接操作 iframe DOM 设置，避免 epubjs override 的 CSS 堆积问题
   */
  const makeThemeStyles = (bg: string, color: string) => ({
    body: { 'background-color': `${bg} !important`, 'color': `${color} !important` },
    p:    { 'color': `${color} !important` },
    span: { 'color': `${color} !important` },
    div:  { 'color': `${color} !important` },
  });

  /**
   * 一次性注册三个主题（仅在初始化时调用）
   */
  const registerThemes = () => {
    if (!rendition.value) return;
    rendition.value.themes.register("day",   makeThemeStyles(THEMES.day.bg, THEMES.day.color));
    rendition.value.themes.register("night", makeThemeStyles(THEMES.night.bg, THEMES.night.color));
    rendition.value.themes.register("sepia", makeThemeStyles(THEMES.sepia.bg, THEMES.sepia.color));
    rendition.value.themes.select(readerStore.theme);
  };

  /**
   * 通过 epubjs getContents() 获取所有 iframe，注入字体族样式
   * 每次调用替换同一个 <style> 元素，不产生 CSS 堆积
   */
  const injectFontFamily = () => {
    if (!rendition.value) return;
    try {
      const content = rendition.value.getContents();
      if (!content?.document?.head) return;
      const css = `body, p, span, div, h1, h2, h3, h4, h5, h6 { font-family: ${readerStore.fontFamily} !important; }`;
      const doc = content.document;
      let style = doc.getElementById('kdf-font') as HTMLStyleElement;
      if (!style) {
        style = doc.createElement('style');
        style.id = 'kdf-font';
        doc.head.appendChild(style);
      }
      style.textContent = css;
    } catch (e) {
      console.warn('Cannot inject font-family into EPUB content', e);
    }
  };

  /**
   * 更新 EPUB 样式：
   *  - 字体大小：epubjs themes.fontSize()
   *  - 字体族：直接操作 iframe DOM（避免 override 堆积）
   *  - 主题：仅 select()，永不 re-register 完整主题
   */
  const updateEpubStyle = () => {
    if (!rendition.value) return;
    rendition.value.themes.fontSize(readerStore.fontSize + 'px');
    rendition.value.themes.select(readerStore.theme);
    // 字体族需等 iframe 渲染完成后再注入
    requestAnimationFrame(() => injectFontFamily());
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
    const epub = createEpub(data);
    epubBook.value = epub;
    
    const navigation = await epub.loaded.navigation;
    toc.value = navigation.toc.map((item: { label: string; href: string }) => ({
      label: item.label.trim(),
      href: item.href
    }));

    rendition.value = epub.renderTo(containerId, {
      width: "100%",
      height: "100%",
      flow: readerStore.paginationMode === 'horizontal' ? "paginated" : "scrolled",
      manager: readerStore.paginationMode === 'horizontal' ? "default" : "continuous",
      allowScriptedContent: true
    });

    const r = rendition.value!;

    // 核心修复：只在 started 时注册一次主题
    r.on("started", () => {
      registerThemes();
      // 应用初始字体大小（watcher 只在值变化时触发，首次打开不会执行）
      r.themes.fontSize(readerStore.fontSize + 'px');
    });

    // 翻页/渲染后：重新 apply 字体大小、主题和字体族
    r.on("rendered", () => {
      r.themes.fontSize(readerStore.fontSize + 'px');
      r.themes.select(readerStore.theme);
      injectFontFamily();
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

    rendition.value = epubBook.value.renderTo("viewer", {
      width: "100%",
      height: "100%",
      flow: readerStore.paginationMode === 'horizontal' ? "paginated" : "scrolled",
      manager: readerStore.paginationMode === 'horizontal' ? "default" : "continuous",
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
      injectFontFamily();
    });
    
    // 安全兜底
    setTimeout(() => { isPageLoading.value = false; }, 1500);
  };

  const jumpTo = (href: string) => {
    rendition.value?.display(href);
  };

  const nextPage = () => {
    if (readerStore.paginationMode === 'horizontal') {
      rendition.value?.next();
    } else {
      const container = document.querySelector('.epub-render');
      if (container) container.scrollTop += window.innerHeight * 0.8;
    }
  };

  const prevPage = () => {
    if (readerStore.paginationMode === 'horizontal') {
      rendition.value?.prev();
    } else {
      const container = document.querySelector('.epub-render');
      if (container) container.scrollTop -= window.innerHeight * 0.8;
    }
  };

  const onProgressChange = (val: number) => {
    if (rendition.value && epubBook.value) {
      const cfi = epubBook.value.locations.cfiFromPercentage(val / 100);
      rendition.value.display(cfi);
    }
  };

  // Watch for style changes
  watch([() => readerStore.theme, () => readerStore.fontSize, () => readerStore.fontFamily], () => {
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
    jumpTo,
    nextPage,
    prevPage,
    onProgressChange,
    onSelected: (cb: (cfiRange: string, text: string) => void) => { onSelectedCallback = cb; },
    onGlobalClick: (cb: (relativeX: number) => void) => { onGlobalClickCallback = cb; }
  };
}
