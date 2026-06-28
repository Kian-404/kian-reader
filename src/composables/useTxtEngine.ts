import { ref, computed } from 'vue';
import { useLibraryStore } from '@/stores/library';

/** 每页字符数（约两屏中文，章节内翻页不越界） */
const CHARS_PER_PAGE = 1200;
/** 垂直模式前后缓冲页数 */
const BUFFER_PAGES = 1;

/**
 * 自动检测 TXT 文件编码
 * 优先级: BOM → UTF-8(严格) → GBK → GB18030
 */
const detectEncoding = (data: ArrayBuffer): string => {
  const bytes = new Uint8Array(data);

  // BOM 检测
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be';

  // 尝试 UTF-8 严格模式
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data);
    return 'utf-8';
  } catch {
    // 不是合法 UTF-8
  }

  // 尝试 GBK（中文最常见）
  try {
    new TextDecoder('gbk', { fatal: true }).decode(data.slice(0, 2000));
    return 'gbk';
  } catch {
    // 回退 GB18030
  }

  return 'gb18030';
};

export function useTxtEngine(bookId: string) {
  const libraryStore = useLibraryStore();

  const txtContent = ref('');
  const toc = ref<any[]>([]);
  const progress = ref(0);
  const isPageLoading = ref(false);
  const currentPage = ref(0);
  const totalPages = ref(0);

  /** 翻页动画方向：forward | backward | '' (初始) */
  const pageAnimDir = ref<'forward' | 'backward' | ''>('');

  /** 将全文按固定字符数分页 */
  const allPages = computed(() => {
    const text = txtContent.value;
    if (!text) return [];
    const pages: string[] = [];
    for (let i = 0; i < text.length; i += CHARS_PER_PAGE) {
      pages.push(text.slice(i, i + CHARS_PER_PAGE));
    }
    return pages;
  });

  /** 水平模式：当前页文本 */
  const currentPageText = computed(() => {
    if (currentPage.value < allPages.value.length) {
      return allPages.value[currentPage.value];
    }
    return '';
  });

  /** 垂直模式可见页列表（当前页 + 前后缓冲） */
  const visiblePages = computed(() => {
    if (allPages.value.length === 0) return [];
    const start = Math.max(0, currentPage.value - BUFFER_PAGES);
    const end = Math.min(allPages.value.length, currentPage.value + BUFFER_PAGES + 1);
    return allPages.value.slice(start, end).map((text, i) => ({
      text,
      globalIndex: start + i,
    }));
  });

  const initTxt = async (data: ArrayBuffer) => {
    isPageLoading.value = true;
    const encoding = detectEncoding(data);
    console.log('TXT encoding detected:', encoding);
    const decoder = new TextDecoder(encoding, { fatal: false });
    txtContent.value = decoder.decode(data);
    totalPages.value = allPages.value.length;
    currentPage.value = 0;

    // Advanced Regex for TXT Chapter Detection
    const regex = /^\s*(第?\s*[0-9零一二两三四五六七八九十百千万]+[章回节卷集幕计][\s\S]{0,30}$|[Cc]hapter\s*[0-9]+|^\s*[0-9]{1,3}\s+.*$)/m;
    
    const lines = txtContent.value.split('\n');
    const newToc = [];
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0 && line.length < 60 && regex.test(line)) {
        const pageIndex = Math.floor(charCount / CHARS_PER_PAGE);
        newToc.push({ 
          label: line, 
          href: pageIndex.toString()
        });
      }
      charCount += lines[i].length + 1;
    }
    toc.value = newToc;

    // 恢复上次阅读位置（从 IndexedDB 获取）
    const book = libraryStore.books.find(b => b.id === bookId);
    if (book && book.progress > 0 && totalPages.value > 0) {
      const idx = Math.min(
        Math.floor((book.progress / 100) * totalPages.value),
        totalPages.value - 1
      );
      currentPage.value = idx;
      progress.value = book.progress;
    }

    isPageLoading.value = false;
  };

  const jumpTo = (href: string) => {
    const pageIndex = parseInt(href);
    if (!isNaN(pageIndex) && pageIndex >= 0 && pageIndex < totalPages.value) {
      pageAnimDir.value = pageIndex > currentPage.value ? 'forward' : 'backward';
      currentPage.value = pageIndex;
      progress.value = ((pageIndex + 1) / totalPages.value) * 100;
      libraryStore.updateProgress(bookId, progress.value);
    }
  };

  const nextPage = () => {
    if (currentPage.value < totalPages.value - 1) {
      pageAnimDir.value = 'forward';
      currentPage.value++;
      updateProgress();
    }
  };

  const prevPage = () => {
    if (currentPage.value > 0) {
      pageAnimDir.value = 'backward';
      currentPage.value--;
      updateProgress();
    }
  };

  const updateProgress = () => {
    progress.value = ((currentPage.value + 1) / totalPages.value) * 100;
    libraryStore.updateProgress(bookId, progress.value);
  };

  const onProgressChange = (val: number) => {
    const targetPage = Math.max(0, Math.min(
      totalPages.value - 1,
      Math.round((val / 100) * totalPages.value)
    ));
    jumpTo(targetPage.toString());
  };

  /**
   * 垂直模式滚动检测：根据滚动位置推断当前可见页，触发缓冲页更新
   */
  const handleScroll = (containerEl: HTMLElement) => {
    if (allPages.value.length === 0) return;
    const pageEls = containerEl.querySelectorAll('.txt-page');
    if (pageEls.length === 0) return;

    let bestPage = currentPage.value;
    let bestArea = 0;
    const viewH = window.innerHeight;

    pageEls.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, viewH);
      const area = Math.max(0, visibleBottom - visibleTop);
      if (area > bestArea) {
        bestArea = area;
        const idx = visiblePages.value[i];
        if (idx) bestPage = idx.globalIndex;
      }
    });

    if (bestPage !== currentPage.value) {
      currentPage.value = bestPage;
      updateProgress();
    }
  };

  return {
    txtContent,
    toc,
    progress,
    isPageLoading,
    currentPage,
    totalPages,
    visiblePages,
    currentPageText,
    pageAnimDir,
    initTxt,
    jumpTo,
    nextPage,
    prevPage,
    onProgressChange,
    handleScroll,
  };
}
