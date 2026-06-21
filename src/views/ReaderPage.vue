<template>
  <ion-page>
    <div 
      class="reader-page" 
      :class="['theme-' + readerStore.theme]"
      :style="{ 
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
          'mode-horizontal': readerStore.paginationMode === 'horizontal',
          'mode-vertical': readerStore.paginationMode === 'vertical'
        }" 
        @click="handleContainerClick"
        @scroll="handleScroll"
      >
        <!-- TXT Engine -->
        <div v-if="book?.format === 'txt'" class="txt-render" :class="'mode-' + readerStore.paginationMode">
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
        <div v-if="book?.format === 'epub'" class="epub-wrapper">
          <div id="viewer" class="epub-render"></div>
        </div>

        <!-- PDF Engine -->
        <div 
          v-if="book?.format === 'pdf'" 
          class="pdf-render"
          :class="readerStore.paginationMode"
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

      <!-- Page Indicator (PDF / TXT) -->
      <div v-if="book?.format === 'pdf' || book?.format === 'txt'" class="page-indicator">
        {{ book?.format === 'pdf' ? pdfCurrentPage : txtCurrentPage + 1 }} / {{ book?.format === 'pdf' ? pdfPages : txtTotalPages }}
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
        size="50%" 
        class="glass-drawer settings-drawer"
        :lock-scroll="true"
        destroy-on-close
      >
        <ReaderSettings 
          @pagination-change="handlePaginationChange" 
          @size-change="handleSizeChange" 
          @font-change="handleFontChange"
          @zoom-change="handleZoomChange"
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
import { ref, onMounted, onUnmounted, computed } from 'vue';
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

// Engines
const epubEngine = useEpubEngine(bookId);
const pdfEngine = usePdfEngine(bookId);
const txtEngine = useTxtEngine(bookId);

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

/**
 * TXT 文字选择检测
 */
const setupTxtSelection = () => {
  const bodies = document.querySelectorAll('.txt-page.active .content-body');
  if (!bodies.length) return;

  const onTxtMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      selectionText.value = sel.toString().trim();
      (window as any)._txtNotePage = txtCurrentPage.value;

      noteComment.value = '';
      noteColor.value = '#ffe082';
      showSelectionMenu.value = true;
    }, 10);
  };

  bodies.forEach((el) => {
    el.addEventListener('mouseup', onTxtMouseUp);
    el.addEventListener('touchend', onTxtMouseUp);
  });
};

/**
 * 生命周期钩子
 */
onMounted(async () => {
  await initReader();
});

onUnmounted(() => {
  // 清理资源
  epubEngine.rendition.value?.destroy();
  (window as any).pdfDoc = null;

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
  // Only PDF engine has handleScroll (TXT is page-based, EPUB is managed by epubjs)
  if (book.value?.format === 'pdf') {
    pdfEngine.handleScroll?.();
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

const handleFontChange = () => {
  if (book.value?.format === 'epub') {
    epubEngine.updateEpubStyle();
  }
};

const handleZoomChange = () => {
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
    const readerStore = useReaderStore();
    if (readerStore.paginationMode === 'horizontal') {
      bookmark.scrollLeft = container?.scrollLeft ?? 0;
    } else {
      bookmark.scrollTop = container?.scrollTop ?? 0;
    }
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
    note.page = (window as any)._txtNotePage ?? txtCurrentPage.value;
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

  &.theme-day {
    background: #fff;
    color: #333;
  }

  &.theme-night {
    background: #1a1a1a;
    color: #fff;
  }

  &.theme-sepia {
    background: #f4ecd8;
    color: #5b4636;
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

    .txt-page {
      flex: 0 0 100vw;
      width: 100vw;
      height: 100vh;
      scroll-snap-align: center;
      overflow-y: auto;
      padding: 40px 24px;
      box-sizing: border-box;
    }

    .content-body {
      max-width: 700px;
      margin: 0 auto;
      word-wrap: break-word;
      font-size: var(--font-size);
      line-height: var(--line-height);
      white-space: pre-wrap;
    }
  }

  &.mode-vertical .txt-page {
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
    background: rgba(0, 0, 0, 0.02);
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
    color: #94a3b8;
    font-size: 14px;
  }

  .pdf-canvas {
    max-width: 100%;
    height: auto !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    background: white;
  }
}

.epub-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
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
  background: rgba(255, 255, 255, 0.4);
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
    background: rgba(0, 0, 0, 0.4);
  }
}
</style>