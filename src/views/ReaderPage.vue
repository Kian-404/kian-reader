<template>
  <ion-page>
    <div 
      class="reader-page" 
      :class="['theme-' + readerStore.theme]"
      :style="{ 
        ...readerStore.themeVars,
        '--font-size': readerStore.fontSize + 'px', 
        '--line-height': readerStore.lineHeight,
        'font-family': readerStore.fontFamily 
      }"
    >
      <!-- Brightness Overlay -->
      <div 
        class="brightness-overlay" 
        :style="{ opacity: (100 - readerStore.brightness) / 100 }"
      ></div>

      <!-- Rendering Engines -->
      <div 
        class="render-container" 
        :class="{ 
          'is-epub': book?.format === 'epub',
          'mode-horizontal': readerStore.paginationMode === 'horizontal' && book?.format !== 'txt',
          'mode-vertical': readerStore.paginationMode === 'vertical' && book?.format !== 'txt',
          'txt-horizontal': book?.format === 'txt' && readerStore.paginationMode === 'horizontal',
          'txt-vertical': book?.format === 'txt' && readerStore.paginationMode === 'vertical'
        }" 
        @click="handleContainerClick"
        @scroll="handleScroll"
      >
        <!-- TXT Engine -->
        <!-- 水平模式：单页渲染 + Transition 翻页动画 -->
        <template v-if="book?.format === 'txt' && readerStore.paginationMode === 'horizontal'">
          <transition :name="txtPageAnimName" mode="out-in">
            <div :key="txtCurrentPage" class="txt-page-single" @contextmenu.prevent>
              <div class="content-body">{{ txtCurrentPageText }}</div>
            </div>
          </transition>
        </template>

        <!-- 垂直模式：缓冲页 + 滚动加载 -->
        <div
          v-else-if="book?.format === 'txt'"
          class="txt-render mode-vertical"
          @contextmenu.prevent
        >
          <div
            v-for="page in txtVisiblePages"
            :key="page.globalIndex"
            class="txt-page"
            :class="{ active: page.globalIndex === txtCurrentPage }"
          >
            <div class="content-body">{{ page.text }}</div>
          </div>
        </div>

        <!-- EPUB Engine -->
        <div v-if="book?.format === 'epub'" 
          class="epub-wrapper" 
          :class="{ transitioning: epubEngine.isTransitioning.value }"
          @contextmenu.prevent
        >
          <div id="viewer" class="epub-render"></div>
        </div>

        <!-- PDF Engine -->
        <div 
          v-if="book?.format === 'pdf'" 
          class="pdf-render"
          :class="readerStore.paginationMode"
          @contextmenu.prevent
        >
          <div 
            v-for="n in pdfPages" 
            :key="n" 
            :id="`pdf-page-container-${n}`"
            class="pdf-page-container"
          >
            <canvas 
              v-if="isPdfPageInRange(n)" 
              :id="`pdf-page-${n}`"
              class="pdf-canvas"
            ></canvas>
            <div 
              v-if="isPdfPageInRange(n)" 
              :id="`pdf-text-${n}`" 
              class="textLayer"
            ></div>
            <div v-else class="pdf-page-placeholder">
              <Icon icon="solar:spinner-linear" class="is-loading" />
              <span>第 {{ n }} 页</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Page Indicator -->
      <div v-if="book?.format === 'pdf' || book?.format === 'txt'" class="page-indicator">
        {{ book?.format === 'pdf' ? pdfCurrentPage : txtCurrentPage + 1 }} / {{ book?.format === 'pdf' ? pdfPages : txtTotalPages }}
      </div>
      <div v-else-if="book?.format === 'epub'" class="page-indicator">
        {{ Math.round(progress) }}%
      </div>

      <!-- Control Overlay -->
      <ReaderControls
        :show="showControls"
        :title="book?.title"
        :progress="progress"
        @back="goBack"
        @progress-change="onProgressChange"
        @toggle-search="showSearch = true"
        @toggle-notes="showNotes = true"
        @toggle-bookmarks="showBookmarks = true"
        @toggle-toc="showTOC = true"
        @toggle-settings="showSettings = true"
      />

      <!-- Global Reader Loading -->
      <transition name="fade">
        <div v-if="isPageLoading" class="reader-loading-overlay">
          <div class="loading-card glass-card">
            <el-icon class="is-loading"><Icon icon="solar:spinner-linear" /></el-icon>
            <span>正在准备内容...</span>
          </div>
        </div>
      </transition>

      <!-- Selection Menu Popup -->
      <SelectionMenu
        v-if="showSelectionMenu"
        :text="selectionText"
        :comment="noteComment"
        :selected-color="noteColor"
        @save="saveNote"
        @close="showSelectionMenu = false"
        @update:comment="noteComment = $event"
        @update:selected-color="noteColor = $event"
      />

      <!-- Drawers -->
      <el-drawer 
        v-model="showSearch" 
        title="全文搜索" 
        direction="rtl" 
        size="80%" 
        class="glass-drawer"
        destroy-on-close
      >
        <ReaderSearch 
          :book-format="book?.format" 
          :txt-content="book?.format === 'txt' ? (txtEngine.txtContent?.value || '') : ''" 
          :rendition="epubEngine.rendition.value"
          @jump="jumpToSearchResult"
        />
      </el-drawer>

      <el-drawer 
        v-model="showTOC" 
        title="目录" 
        direction="ltr" 
        size="70%" 
        class="glass-drawer"
        destroy-on-close
      >
        <ReaderTOC :toc="toc" :active-href="activeTocHref" @jump="jumpTo" />
      </el-drawer>

      <el-drawer 
        v-model="showSettings" 
        title="阅读设置" 
        direction="btt" 
        class="glass-drawer settings-drawer"
        :lock-scroll="true"
        destroy-on-close
      >
        <ReaderSettings 
          :book-format="book?.format"
          @pagination-change="handlePaginationChange" 
          @size-change="handleSizeChange" 
        />
      </el-drawer>

      <el-drawer 
        v-model="showBookmarks" 
        title="书签" 
        direction="ltr" 
        size="70%" 
        class="glass-drawer"
        destroy-on-close
      >
        <ReaderBookmarks 
          :bookmarks="book?.bookmarks" 
          @add="addCurrentBookmark" 
          @jump="jumpToBookmark"
          @remove="removeBookmark"
        />
      </el-drawer>

      <el-drawer 
        v-model="showNotes" 
        title="笔记与高亮" 
        direction="ltr" 
        size="80%" 
        class="glass-drawer"
        destroy-on-close
      >
        <ReaderNotes 
          :notes="book?.notes" 
          @jump="jumpToNote"
          @remove="removeNote"
        />
      </el-drawer>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, onIonViewDidEnter } from '@ionic/vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { useLibraryStore, type Book } from '@/stores/library';
import { useReaderStore } from '@/stores/reader';
import { StatusBar } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Engines
import { useEpubEngine } from '@/composables/useEpubEngine';
import { usePdfEngine } from '@/composables/usePdfEngine';
import { useTxtEngine } from '@/composables/useTxtEngine';

// Components
import ReaderControls from '@/components/reader/ReaderControls.vue';
import ReaderTOC from '@/components/reader/ReaderTOC.vue';
import ReaderSettings from '@/components/reader/ReaderSettings.vue';
import ReaderSearch from '@/components/reader/ReaderSearch.vue';
import ReaderBookmarks from '@/components/reader/ReaderBookmarks.vue';
import ReaderNotes from '@/components/reader/ReaderNotes.vue';
import SelectionMenu from '@/components/reader/SelectionMenu.vue';

// Constants
const CLICK_DEBOUNCE_DELAY = 300;
const LEFT_ZONE_RATIO = 0.3;
const RIGHT_ZONE_RATIO = 0.7;

// Router & Store
const route = useRoute();
const router = useRouter();
const libraryStore = useLibraryStore();
const readerStore = useReaderStore();

const bookId = route.params.id as string;

// Book State
const book = ref<Book | undefined>();

// UI State
const showControls = ref(false);
const showSettings = ref(false);
const showTOC = ref(false);
const showBookmarks = ref(false);
const showSearch = ref(false);
const showNotes = ref(false);
const showSelectionMenu = ref(false);

// Selection State
const selectionCfi = ref('');
const selectionText = ref('');
const noteComment = ref('');
const noteColor = ref('#ffe082');
/** 替代 (window as any)._txtNotePage，记录 TXT 选中文字所在页码 */
const txtNotePage = ref(0);

// Engines
const epubEngine = useEpubEngine(bookId);
const pdfEngine = usePdfEngine(bookId);
const txtEngine = useTxtEngine(bookId);

// 同步主题到全局：CSS 变量 + ion-palette-dark 类
// 使 Teleport 出去的抽屉（设置、搜索、目录等）也能感知主题
watch(() => readerStore.theme, (theme) => {
  const root = document.documentElement;
  // 设置全局 CSS 变量
  const vars = readerStore.themeVars;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  // 深色主题同步 Ionic 深色模式
  root.classList.toggle('ion-palette-dark', theme === 'night' || theme === 'ink');
}, { immediate: true, deep: true });

/**
 * 获取当前活跃的引擎
 */
const currentEngine = computed(() => {
  if (book.value?.format === 'epub') return epubEngine;
  if (book.value?.format === 'pdf') return pdfEngine;
  if (book.value?.format === 'txt') return txtEngine;
  return null;
});

/**
 * 标准化状态 - 从当前引擎获取
 */
const progress = computed(() => currentEngine.value?.progress.value ?? 0);
const toc = computed(() => currentEngine.value?.toc.value ?? []);
const isPageLoading = computed(() => currentEngine.value?.isPageLoading.value ?? false);

// PDF 特定状态
const pdfPages = computed(() => pdfEngine.pdfPages.value);
const pdfCurrentPage = computed(() => pdfEngine.currentPage.value);

// TXT 特定状态
const txtVisiblePages = computed(() => txtEngine.visiblePages?.value ?? []);
const txtCurrentPage = computed(() => txtEngine.currentPage?.value ?? 0);
const txtTotalPages = computed(() => txtEngine.totalPages?.value ?? 0);
const txtCurrentPageText = computed(() => txtEngine.currentPageText?.value ?? '');

/** 翻页动画 CSS transition name */
const txtPageAnimName = computed(() => {
  const dir = txtEngine.pageAnimDir?.value;
  if (dir === 'forward') return 'page-forward';
  if (dir === 'backward') return 'page-backward';
  return 'page-none';
});

/** 当前章节标识（用于 TOC 高亮） */
const activeTocHref = computed(() => {
  if (!book.value) return '';
  switch (book.value.format) {
    case 'epub': return epubEngine.currentHref.value;
    case 'pdf': return pdfEngine.currentPage.value.toString();
    case 'txt': return txtEngine.currentPage?.value?.toString() ?? '';
    default: return '';
  }
});

/**
 * 检查 PDF 页面是否在可见范围内
 */
const isPdfPageInRange = (pageNum: number): boolean => {
  return pdfEngine.isPageInRange(pageNum);
};

// EPUB 延迟初始化处理
const isViewEntered = ref(false);
const pendingEpubData = ref<ArrayBuffer | null>(null);

/**
 * 初始化阅读页面
 */
const initReader = async () => {
  await libraryStore.initStore();
  book.value = libraryStore.books.find(b => b.id === bookId);

  if (!book.value) {
    ElMessage.error('图书未找到');
    return;
  }

  libraryStore.updateLastRead(bookId);
  await initImmersiveMode();

  const data = await libraryStore.getBookData(bookId);
  if (!data) {
    ElMessage.error('无法加载图书数据');
    return;
  }

  const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
  await initEngineByFormat(arrayBuffer);
  bindEngineEvents();
};

/**
 * 根据图书格式初始化引擎
 */
const initEngineByFormat = async (arrayBuffer: ArrayBuffer) => {
  switch (book.value?.format) {
    case 'txt':
      await txtEngine.initTxt(arrayBuffer);
      setTimeout(() => setupTxtSelection(), 100);
      break;
    case 'epub':
      if (isViewEntered.value) {
        await epubEngine.initEpub(arrayBuffer);
      } else {
        pendingEpubData.value = arrayBuffer;
      }
      break;
    case 'pdf':
      await pdfEngine.initPdf(arrayBuffer);
      break;
  }
};

/**
 * 初始化沉浸式模式
 */
const initImmersiveMode = async () => {
  if (!showControls.value) {
    try {
      await StatusBar.hide();
    } catch (e) {
      console.warn('无法隐藏状态栏');
    }
  }
};

/**
 * 绑定引擎事件
 */
const bindEngineEvents = () => {
  // EPUB 文本选择事件
  epubEngine.onSelected((cfi, text) => {
    selectionCfi.value = cfi;
    selectionText.value = text;
    showSelectionMenu.value = true;
    noteComment.value = '';
    noteColor.value = '#ffe082';
  });

  // EPUB 全局点击事件
  epubEngine.onGlobalClick((relativeX) => {
    handleGlobalClick(relativeX);
  });
};

/** 用于存储 TXT 选择事件清理函数，翻页或卸载时解除绑定 */
let txtSelectionCleanup: (() => void) | null = null;

/**
 * TXT 文字选择检测
 * 每次调用先清理之前的监听器，避免重复绑定
 */
const setupTxtSelection = () => {
  // 清理旧监听器
  txtSelectionCleanup?.();

  const bodies = document.querySelectorAll('.txt-page.active .content-body');
  if (!bodies.length) return;

  const onTxtMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      selectionText.value = sel.toString().trim();
      txtNotePage.value = txtCurrentPage.value;

      noteComment.value = '';
      noteColor.value = '#ffe082';
      showSelectionMenu.value = true;
    }, 10);
  };

  const onContextMenu = (e: Event) => { e.preventDefault(); };

  bodies.forEach((el) => {
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('mouseup', onTxtMouseUp);
    el.addEventListener('touchend', onTxtMouseUp);
  });

  txtSelectionCleanup = () => {
    bodies.forEach((el) => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('mouseup', onTxtMouseUp);
      el.removeEventListener('touchend', onTxtMouseUp);
    });
    txtSelectionCleanup = null;
  };
};

/**
 * 生命周期钩子
 */
onMounted(async () => {
  await initReader();
});

onUnmounted(() => {
  // 清理 TXT 选择事件监听器
  txtSelectionCleanup?.();
  // 清理资源
  epubEngine.rendition.value?.destroy();
  (window as any).pdfDoc = null;

  // 清理全局 CSS 变量
  const root = document.documentElement;
  ['--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary',
   '--border-color', '--accent-color', '--shadow-color'].forEach((key) => {
    root.style.removeProperty(key);
  });

  // 恢复状态栏
  try {
    StatusBar.show();
  } catch (e) {
    console.warn('无法显示状态栏');
  }
});

onIonViewDidEnter(() => {
  isViewEntered.value = true;
  if (pendingEpubData.value) {
    epubEngine.initEpub(pendingEpubData.value);
    pendingEpubData.value = null;
  }
});

/**
 * 页面导航
 */
const jumpTo = (target: string) => {
  currentEngine.value?.jumpTo(target);
  closeAllDrawers();
};

const jumpToSearchResult = (res: any) => {
  switch (book.value?.format) {
    case 'epub':
      epubEngine.jumpTo(res.cfi);
      break;
    case 'pdf':
      pdfEngine.jumpTo(res.page.toString());
      break;
    case 'txt':
      txtEngine.jumpTo(res.page?.toString() || res.charOffset?.toString() || res.lineIndex?.toString());
      break;
  }
  closeAllDrawers();
};

/**
 * 点击事件处理
 */
const handleContainerClick = (e: MouseEvent | TouchEvent) => {
  if (book.value?.format === 'epub') return;

  const clientX = 'touches' in e && e.touches.length > 0
    ? e.touches[0].clientX
    : (e as MouseEvent).clientX;

  handleGlobalClick(clientX);
};

let lastGlobalClickTime = 0;

const handleGlobalClick = (clientX: number) => {
  // 防止快速连续点击
  const now = Date.now();
  if (now - lastGlobalClickTime < CLICK_DEBOUNCE_DELAY) return;
  lastGlobalClickTime = now;

  const width = window.innerWidth;
  const leftZone = width * LEFT_ZONE_RATIO;
  const rightZone = width * RIGHT_ZONE_RATIO;

  if (clientX < leftZone) {
    prevPage();
  } else if (clientX > rightZone) {
    nextPage();
  } else {
    toggleControls();
  }
};

const handleScroll = () => {
  if (book.value?.format === 'pdf') {
    pdfEngine.handleScroll?.();
  } else if (book.value?.format === 'txt' && readerStore.paginationMode === 'vertical') {
    const container = document.querySelector('.render-container');
    if (container) txtEngine.handleScroll(container as HTMLElement);
  }
};

/**
 * 翻页
 */
const nextPage = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // 设备不支持触觉反馈
  }
  currentEngine.value?.nextPage();
};

const prevPage = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // 设备不支持触觉反馈
  }
  currentEngine.value?.prevPage();
};

const onProgressChange = (val: number) => {
  currentEngine.value?.onProgressChange(val);
};

/**
 * 分页和样式处理
 */
const handlePaginationChange = () => {
  if (book.value?.format === 'epub') {
    epubEngine.handlePaginationChange();
  } else if (book.value?.format === 'pdf') {
    pdfEngine.handlePaginationChange();
  }
};

const handleSizeChange = () => {
  // PDF 需要特殊处理
  if (book.value?.format === 'pdf') {
    pdfEngine.handlePaginationChange();
  }
};

/**
 * UI 控制
 */
const toggleControls = async () => {
  showControls.value = !showControls.value;

  try {
    await Haptics.selectionEnd();
  } catch (e) {
    // 设备不支持触觉反馈
  }

  try {
    if (showControls.value) {
      await StatusBar.show();
    } else {
      await StatusBar.hide();
    }
  } catch (e) {
    console.warn('无法切换状态栏');
  }
};

const goBack = () => {
  router.back();
};

const closeAllDrawers = () => {
  showSearch.value = false;
  showTOC.value = false;
  showSettings.value = false;
  showBookmarks.value = false;
  showNotes.value = false;
  showControls.value = false;
};

/**
 * 书签管理
 */
const addCurrentBookmark = () => {
  if (!book.value) return;

  const bookmark: any = {
    id: Date.now().toString(),
    label: `书签 - ${Math.round(progress.value)}%`,
    addedAt: Date.now()
  };

  // 保存格式特定的位置信息
  if (book.value.format === 'epub') {
    const loc = epubEngine.rendition.value?.currentLocation() as any;
    bookmark.cfi = loc?.start?.cfi;
  } else if (book.value.format === 'pdf') {
    bookmark.page = pdfEngine.currentPage.value;
  } else if (book.value.format === 'txt') {
    const container = document.querySelector('.render-container');
    // 两种模式都用 scrollTop（水平渲染单页纵向滚动）
    bookmark.scrollTop = container?.scrollTop ?? 0;
  }

  libraryStore.addBookmark(bookId, bookmark);
  ElMessage.success('书签已添加');
};

const jumpToBookmark = (bm: any) => {
  if (bm.cfi) {
    epubEngine.jumpTo(bm.cfi);
  } else if (bm.page) {
    pdfEngine.jumpTo(bm.page.toString());
  } else if (typeof bm.scrollTop === 'number') {
    const container = document.querySelector('.render-container');
    if (container) container.scrollTop = bm.scrollTop;
  } else if (typeof bm.scrollLeft === 'number') {
    const container = document.querySelector('.render-container');
    if (container) container.scrollLeft = bm.scrollLeft;
  }
  closeAllDrawers();
};

const removeBookmark = (id: string) => {
  libraryStore.removeBookmark(bookId, id);
  ElMessage.success('书签已删除');
};

/**
 * 笔记管理
 */
const saveNote = () => {
  if (!book.value || !selectionText.value) return;

  const note: any = {
    id: Date.now().toString(),
    text: selectionText.value,
    comment: noteComment.value,
    color: noteColor.value,
    addedAt: Date.now()
  };

  if (book.value.format === 'epub' && selectionCfi.value) {
    note.cfi = selectionCfi.value;
    try {
      epubEngine.rendition.value?.annotations.add(
        'highlight',
        note.cfi,
        {},
        undefined,
        'hl-class',
        { fill: note.color }
      );
    } catch (e) {
      console.warn('无法添加高亮注释');
    }
  } else if (book.value.format === 'pdf') {
    note.page = pdfEngine.currentPage.value;
  } else if (book.value.format === 'txt') {
    note.page = txtNotePage.value ?? txtCurrentPage.value;
  }

  libraryStore.addNote(bookId, note);
  ElMessage.success('笔记已保存');
  showSelectionMenu.value = false;
};

const jumpToNote = (note: any) => {
  if (note.cfi) {
    epubEngine.jumpTo(note.cfi);
  } else if (note.page) {
    if (book.value?.format === 'pdf') {
      pdfEngine.jumpTo(note.page.toString());
    } else {
      txtEngine.jumpTo(note.page.toString());
    }
  }
  closeAllDrawers();
};

const removeNote = (id: string) => {
  libraryStore.removeNote(bookId, id);
  ElMessage.success('笔记已删除');
};
</script>

<style scoped lang="less">
.reader-page {
  width: 100%;
  height: 100vh;
  transition: background 0.3s, color 0.3s;
  position: relative;
  overflow: hidden;

  &.theme-day,
  &.theme-parchment,
  &.theme-green,
  &.theme-gray,
  &.theme-night,
  &.theme-ink {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
}

.brightness-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  pointer-events: none;
  z-index: 2000;
  opacity: 0;
  transition: opacity 0.3s;
}

.render-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  scroll-behavior: smooth;

  &.mode-horizontal {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    padding: 0;
  }

  &.txt-horizontal {
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0;

    .txt-page-single {
      width: 100%;
      min-height: 100vh;
      padding: 40px 24px;
      box-sizing: border-box;

      .content-body {
        max-width: 700px;
        margin: 0 auto;
        word-wrap: break-word;
        font-size: var(--font-size);
        line-height: var(--line-height);
        white-space: pre-wrap;
      }
    }
  }

  &.mode-vertical,
  &.txt-vertical {
    .txt-page {
      min-height: 100vh;
      padding: 24px 20px;

      .content-body {
        font-size: var(--font-size);
        line-height: var(--line-height);
        white-space: pre-wrap;
        max-width: 700px;
        margin: 0 auto;
      }
    }
  }

  &.is-epub {
    overflow: hidden;
    padding: 0;
  }
}

.pdf-render {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding-bottom: 100px;

  &.horizontal {
    flex-direction: row;
    align-items: flex-start;
    padding-bottom: 0;
    height: 100%;
    gap: 0;

    .pdf-page-container {
      flex: 0 0 100vw;
      width: 100vw;
      height: 100%;
      min-height: auto;
      scroll-snap-align: center;
      background: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pdf-canvas {
      max-height: calc(100vh - 40px);
      max-width: calc(100vw - 40px);
      width: auto !important;
      height: auto !important;
      object-fit: contain;
    }
  }

  .pdf-page-container {
    width: 100%;
    min-height: 500px;
    display: flex;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 4px;
    position: relative;
    transition: all 0.3s;
  }

  .pdf-page-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .pdf-canvas {
    max-width: 100%;
    height: auto !important;
    box-shadow: 0 4px 12px var(--shadow-color);
    background: var(--bg-primary);
  }
}

.epub-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  opacity: 1;
  transition: opacity 0.2s ease;

  &.transitioning {
    opacity: 0;
  }
}

.epub-render {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

#viewer {
  width: 100%;
  height: 100%;
}

.page-indicator {
  position: fixed;
  bottom: 30px;
  right: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  backdrop-filter: blur(5px);
  z-index: 50;
  pointer-events: none;
}

.reader-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-primary) 60%, transparent);
  backdrop-filter: blur(8px);

  .loading-card {
    padding: 30px 50px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    color: #409eff;
    font-weight: 600;

    .el-icon {
      font-size: 32px;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

html.ion-palette-dark {
  .reader-loading-overlay {
    background: color-mix(in srgb, var(--bg-primary) 60%, transparent);
  }
}
</style>

<!-- 非 scoped：穿透 Teleport 覆盖 Element Plus 内联样式 -->
<style>
/* ── 所有抽屉 ── */
.glass-drawer.el-drawer {
  background: var(--bg-secondary) !important;
}
.glass-drawer .el-drawer__header {
  color: var(--text-primary, #1e293b) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color, #e2e8f0) 40%, transparent);
  margin-bottom: 0;
  padding: 14px 20px;
  font-size: 15px;
}
.glass-drawer .el-drawer__close-btn,
.glass-drawer .el-drawer__header button {
  color: var(--text-secondary, #64748b) !important;
}
.glass-drawer .el-drawer__close-btn:hover,
.glass-drawer .el-drawer__header button:hover {
  color: var(--text-primary, #1e293b) !important;
}

/* ── 设置抽屉（底部弹出） ── */
.settings-drawer .el-drawer__wrapper {
  display: flex;
  align-items: flex-end;
}
.settings-drawer.el-drawer {
  height: auto !important;
  bottom: 0;
  position: absolute;
}
.settings-drawer .el-drawer__body {
  overflow-y: visible;
  padding-bottom: env(safe-area-inset-bottom);
}

/* ── TXT 翻页动画 ── */
.page-forward-enter-active,
.page-forward-leave-active,
.page-backward-enter-active,
.page-backward-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-forward-enter-active,
.page-backward-enter-active {
  transition-delay: 0.15s;
}

/* 向前翻页：旧内容左滑出，新内容右滑入 */
.page-forward-leave-to {
  transform: translateX(-30%);
  opacity: 0;
}
.page-forward-enter-from {
  transform: translateX(30%);
  opacity: 0;
}

/* 向后翻页：旧内容右滑出，新内容左滑入 */
.page-backward-leave-to {
  transform: translateX(30%);
  opacity: 0;
}
.page-backward-enter-from {
  transform: translateX(-30%);
  opacity: 0;
}

/* 无动画（初始加载） */
.page-none-enter-active,
.page-none-leave-active {
  transition: none;
}
</style>