import { ref, shallowRef, watch } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import { useReaderStore } from '@/stores/reader';
import { useLibraryStore } from '@/stores/library';

/**
 * PDF阅读引擎钩子函数，用于处理PDF文档的加载、渲染和导航
 * @param bookId - 图书的唯一标识符
 * @returns 返回PDF相关的状态和方法
 */
export function usePdfEngine(bookId: string) {
  // 使用Pinia状态管理
  const readerStore = useReaderStore();
  const libraryStore = useLibraryStore();


  // PDF文档相关响应式状态

  const pdfPages = ref(0); // PDF总页数
  const currentPage = ref(1);
  const pdfDoc = shallowRef<any>(null);
  const progress = ref(0);
  const toc = ref<any[]>([]);
  const isPageLoading = ref(false);

  const renderTasks = new Map<number, any>();
  const renderLocks = new Map<number, Promise<void>>();
  let pdfDebounceTimer: any = null;

/**
 * 检查页码是否在当前页的范围内
 * @param n - 要检查的页码
 * @returns 如果页码在当前页的3页范围内（包括当前页）则返回true，否则返回false
 */
  const isPageInRange = (n: number) => { // 定义一个函数，用于判断页码是否在当前页的范围内
    return Math.abs(n - currentPage.value) <= 3;
  };

/**
 * 渲染PDF页面的异步函数
 * @param pdf - PDF文档对象
 * @param num - 要渲染的页码
 */
  const renderPdfPage = async (pdf: any, num: number) => {
    // 1. If already rendering this page, cancel it and wait for it to finish
    while (renderLocks.has(num)) {
      if (renderTasks.has(num)) {
        renderTasks.get(num).cancel();
      }
      await renderLocks.get(num);
    }

    // 2. Set a lock for this page
    let resolveLock: () => void;
    const lock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    renderLocks.set(num, lock);

    try {
      const page = await pdf.getPage(num);
      const scale = readerStore.pdfScale * 1.5;
      const viewport = page.getViewport({ scale });

      // Ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 0));

      const canvas = document.getElementById('pdf-page-' + num) as HTMLCanvasElement;
      if (!canvas) return;

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        intent: 'display'
      };

      const renderTask = page.render(renderContext);
      renderTasks.set(num, renderTask);

      try {
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('PDF Render Error:', err);
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      } finally {
        renderTasks.delete(num);
      }
    } finally {
      renderLocks.delete(num);
      resolveLock!();
    }
  };

/**
 * 渲染PDF页面函数
 * 该函数根据当前页码动态渲染PDF文档的页面
 * 只渲染当前页码前后一定范围内的页面，以优化性能
 */
  const renderPdfPages = () => {
  // 检查PDF文档是否存在，如果不存在则直接返回
    if (!pdfDoc.value) return;
  // 计算起始页码，确保不小于1
    const start = Math.max(1, currentPage.value - 2);
  // 计算结束页码，确保不超过PDF总页数
    const end = Math.min(pdfPages.value, currentPage.value + 3);
  // 遍历从start到end的页码范围，逐页渲染PDF
    for (let i = start; i <= end; i++) {
      renderPdfPage(pdfDoc.value, i);
    }
  };

/**
 * 初始化PDF文档的异步函数
 * @param data PDF文档数据
 */
  const initPdf = async (data: any) => {
  // 使用pdfjsLib加载PDF文档
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    pdfDoc.value = pdf;
    (window as any).pdfDoc = pdf; // Keep for search component if needed - 为搜索组件保留PDF文档引用
    pdfPages.value = pdf.numPages; // 设置PDF总页数

    try {
    // 尝试获取PDF文档的大纲(目录)
      const outline = await pdf.getOutline();
      if (outline) {
        const items = [];
      // 遍历大纲中的每个项目
        for (const item of outline) {
          let pageNum = null;
        // 处理目标可能是字符串的情况
          if (typeof item.dest === 'string') {
            const dest = await pdf.getDestination(item.dest);
            if (dest) pageNum = await pdf.getPageIndex(dest[0]) + 1;
          } else if (Array.isArray(item.dest)) {
            pageNum = await pdf.getPageIndex(item.dest[0]) + 1;
          }
          if (pageNum) {
            items.push({ label: item.title, href: pageNum.toString() });
          }
        }
        toc.value = items;
      }
    } catch (e) {
      console.error('Failed to get PDF outline', e);
    }
    
    const savedPage = localStorage.getItem(`book-pdf-page-${bookId}`);
    if (savedPage) {
      currentPage.value = parseInt(savedPage);
      progress.value = (currentPage.value / pdfPages.value) * 100;
    }

    renderPdfPages();
    
    nextTick(() => {
      const el = document.getElementById('pdf-page-container-' + currentPage.value);
      if (el) el.scrollIntoView();
    });
  };

/**
 * 跳转到指定页码的函数
 * @param pageNumStr - 页码字符串，将被转换为数字
 */
  const jumpTo = (pageNumStr: string) => {
  // 将字符串页码转换为数字
    const pageNum = parseInt(pageNumStr);
  // 检查转换后的值是否为有效数字
    if (!isNaN(pageNum)) {
    // 设置页面加载状态为true
      isPageLoading.value = true;
    // 更新当前页码
      currentPage.value = pageNum;
    // 渲染PDF页面
      renderPdfPages();
    // 在DOM更新后执行滚动操作
      nextTick(() => {
      // 获取渲染容器和目标页码元素
        const container = document.querySelector('.render-container');
        const el = document.getElementById('pdf-page-container-' + pageNum);
      // 如果容器和目标元素都存在
        if (el && container) {
        // 根据分页模式决定滚动方向
          if (readerStore.paginationMode === 'horizontal') {
          // 水平滚动到目标位置
            container.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
          } else {
          // 垂直滚动到目标位置（减去20px的偏移量）
            container.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
          }
        }
      // 300毫秒后设置页面加载状态为false
        setTimeout(() => { isPageLoading.value = false; }, 300);
      });
    }
  };

/**
 * 处理滚动事件，确定当前最可见的PDF页面并更新相关状态
 * @param {HTMLElement} target - 触发滚动事件的DOM元素
 */
  const handleScroll = () => {
  // 如果PDF文档不存在，则直接返回
    if (!pdfDoc.value) return;
  // 获取所有PDF页面容器元素
    const containers = document.querySelectorAll('.pdf-page-container');
    let mostVisiblePage = currentPage.value; // 初始化为当前页
    let maxVisibleArea = 0; // 记录最大可见区域面积

  // 遍历所有页面容器，计算可见区域
    containers.forEach((container: any) => {
      const rect = container.getBoundingClientRect();
      const visibleArea = readerStore.paginationMode === 'horizontal'
        ? Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
        : Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

    // 如果当前容器的可见区域大于之前记录的最大值，则更新最大可见区域和最可见页码
      if (visibleArea > maxVisibleArea) {
        maxVisibleArea = visibleArea;
        mostVisiblePage = parseInt(container.id.replace('pdf-page-container-', ''));
      }
    });

  // 如果检测到最可见页面发生变化，则更新相关状态
    if (mostVisiblePage !== currentPage.value) {
      currentPage.value = mostVisiblePage; // 更新当前页码
      progress.value = (currentPage.value / pdfPages.value) * 100; // 更新阅读进度百分比
    // 保存当前页码到本地存储
      localStorage.setItem(`book-pdf-page-${bookId}`, currentPage.value.toString());
    // 更新图书馆中的阅读进度
      libraryStore.updateProgress(bookId, progress.value);
    // 重新渲染PDF页面
      renderPdfPages();
    }
  };

/**
 * 处理分页变化时的滚动行为
 * 当页面切换时，将视图滚动到当前页面的位置
 */
  const handlePaginationChange = () => {
  // 重新渲染PDF页面
    renderPdfPages();
  // 使用nextTick确保DOM更新完成后再执行滚动操作
    nextTick(() => {
    // 获取渲染容器和当前页面的DOM元素
      const container = document.querySelector('.render-container');
      const el = document.getElementById('pdf-page-container-' + currentPage.value);
    // 检查元素是否存在
      if (el && container) {
      // 根据分页模式决定滚动方向
        if (readerStore.paginationMode === 'horizontal') {
        // 水平分页模式：横向滚动到页面位置
          container.scrollTo({ left: el.offsetLeft, behavior: 'auto' });
        } else {
        // 垂直分页模式：纵向滚动到页面位置，并减去20px的偏移量
          container.scrollTo({ top: el.offsetTop - 20, behavior: 'auto' });
        }
      }
    });
  };

/**
 * 跳转到下一页的函数
 * 当当前页码小于总页码时，执行翻页操作
 */
  const nextPage = () => {
  // 检查当前页码是否小于总页码数
    if (currentPage.value < pdfPages.value) {
    // 将当前页码加1后转换为字符串，并跳转到该页
      jumpTo((currentPage.value + 1).toString());
    }
  };

/**
 * 前一页函数
 * 用于实现翻页功能，当当前页大于1时，跳转到上一页
 */
  const prevPage = () => {
  // 判断当前页是否大于1，如果是则执行翻页操作
    if (currentPage.value > 1) {
    // 调用jumpTo函数，将当前页码减1后转换为字符串并传入
      jumpTo((currentPage.value - 1).toString());
    }
  };

/**
 * 处理进度条值变化的函数
 * @param val - 当前进度条的值，范围在0-100之间
 */
  const onProgressChange = (val: number) => {
  // 计算目标页码
  // 将进度值(0-100)转换为页码(1-pdfPages.value)
  // 使用Math.max确保最小页码为1
  // 使用Math.round四舍五入取整
    const targetPage = Math.max(1, Math.round((val / 100) * pdfPages.value));
  // 跳转到计算出的目标页码
  // 将页码转换为字符串类型后调用jumpTo函数
    jumpTo(targetPage.toString());
  };

  // Watch for style/size changes
  watch(() => readerStore.fontSize, () => {
    if (pdfDebounceTimer) clearTimeout(pdfDebounceTimer);
    pdfDebounceTimer = setTimeout(() => {
      renderPdfPages();
    }, 150);
  });

  return {
    pdfPages,
    currentPage,
    pdfDoc,
    progress,
    toc,
    isPageLoading,
    isPageInRange,
    initPdf,
    jumpTo,
    handleScroll,
    handlePaginationChange,
    nextPage,
    prevPage,
    onProgressChange
  };
}
