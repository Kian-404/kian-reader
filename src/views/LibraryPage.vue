<template>
  <ion-page>
    <ion-header :translucent="true" class="ion-no-border">
      <ion-toolbar class="library-toolbar">
        <ion-title>我的书架</ion-title>
        <ion-buttons slot="end">
          <el-button circle @click="goWifiTransfer" class="add-btn-mini" style="margin-right: 6px">
            <Icon icon="solar:notebook-square-broken" width="22" height="22" />
          </el-button>
          <el-button circle @click="triggerFileInput" class="add-btn-mini">
            <Icon icon="solar:import-linear" width="24" height="24" />
          </el-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar class="search-toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索书名或作者..."
          clearable
          class="glass-search"
        >
          <template #prefix>
            <Icon icon="solar:magnifer-linear" style="font-size: 18px" />
          </template>
        </el-input>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="library-content">
      <div class="glass-background"></div>
      
      <div class="library-container">
        <!-- Empty State -->
        <div v-if="libraryStore.books.length === 0" class="empty-state">
          <div class="empty-illustration">
            <div class="circle-bg"></div>
            <Icon icon="solar:library-linear" class="main-icon" style="font-size: 64px" />
          </div>
          <h3>开启您的阅读之旅</h3>
          <p>导入您的第一本 TXT、EPUB 或 PDF <br/> 让文字温暖您的生活</p>
          <el-button type="primary" size="large" @click="triggerFileInput" round class="import-btn-large">
            <Icon icon="solar:import-linear" style="margin-right: 8px" />
            立即导入书籍
          </el-button>
        </div>

        <!-- Sort Bar -->
        <div v-else class="sort-bar">
          <span class="sort-label">排序：</span>
          <div class="sort-options">
            <button
              v-for="opt in sortOptions"
              :key="opt.value"
              :class="['sort-opt', { active: sortBy === opt.value }]"
              @click="sortBy = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <!-- Book Grid -->
        <div v-if="libraryStore.books.length > 0" class="book-grid">
          <div 
            v-for="book in sortedBooks" 
            :key="book.id" 
            class="book-card"
          >
            <div class="cover-wrapper" @click="openBook(book)">
              <img v-if="book.cover" :src="book.cover" :alt="book.title" />
              <div v-else class="default-cover" :class="book.format">
                <Icon 
                  :icon="book.format === 'pdf' ? 'solar:file-pdf-linear' : (book.format === 'epub' ? 'solar:notebook-linear' : 'solar:document-text-linear')" 
                  class="format-icon"
                />
                <span class="format-text">{{ book.format.toUpperCase() }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: book.progress + '%' }"></div>
              </div>
              <div class="delete-btn" @click.stop="confirmDelete(book)">
                <Icon icon="solar:trash-bin-trash-linear" style="font-size: 16px" />
              </div>
            </div>
            <div class="book-info">
              <h4 class="title">{{ book.title }}</h4>
              <p class="author">{{ book.author || '未知作者' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Hidden File Input -->
      <input 
        type="file" 
        ref="fileInput" 
        style="display: none" 
        multiple
        accept=".txt,.epub,.pdf,text/plain,application/pdf,application/epub+zip,application/octet-stream"
        @change="handleFileChange"
      />
    </ion-content>

    <!-- Import Loading -->
    <el-dialog
      v-model="importing"
      title="正在导入..."
      width="80%"
      :show-close="false"
      :close-on-click-modal="false"
      align-center
      class="glass-dialog"
    >
      <div class="loading-content">
        <el-progress type="circle" :percentage="importProgress" />
        <p>请稍候，正在解析书籍内容...</p>
      </div>
    </el-dialog>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButtons
} from '@ionic/vue';
import { Icon } from '@iconify/vue';
import { useLibraryStore, type Book } from '../stores/library';
import { extractMetadata } from '../utils/parser';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';

const libraryStore = useLibraryStore();
const router = useRouter();
const searchQuery = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const goWifiTransfer = () => {
  if (!Capacitor.isNativePlatform()) {
    ElMessage.info('Wi-Fi 传书功能仅支持 Android 设备');
    return;
  }
  router.push('/wifi-transfer');
};

const filteredBooks = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return libraryStore.books;
  return libraryStore.books.filter(book => 
    book.title.toLowerCase().includes(query) || 
    (book.author && book.author.toLowerCase().includes(query))
  );
});

type SortType = 'recent' | 'title' | 'progress' | 'import';
const sortBy = ref<SortType>('recent');
const sortOptions = [
  { value: 'recent' as SortType, label: '最近阅读' },
  { value: 'title' as SortType, label: '书名' },
  { value: 'progress' as SortType, label: '进度' },
  { value: 'import' as SortType, label: '导入时间' },
];
const sortedBooks = computed(() => {
  const list = [...filteredBooks.value];
  switch (sortBy.value) {
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    case 'progress':
      return list.sort((a, b) => b.progress - a.progress);
    case 'import':
      return list.sort((a, b) => b.addedAt - a.addedAt);
    case 'recent':
    default:
      return list.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
  }
});
const importing = ref(false);
const importProgress = ref(0);

onMounted(async () => {
  await libraryStore.initStore();
});

/**
 * 检测文件格式 (扩展名 → magic number → MIME type 三级检测)
 */
const detectFormat = async (file: File): Promise<'txt' | 'epub' | 'pdf' | null> => {
  const fileName = (file.name || '').toLowerCase().trim();

  // 1. Extension match
  if (fileName.endsWith('.txt')) return 'txt';
  if (fileName.endsWith('.epub')) return 'epub';
  if (fileName.endsWith('.pdf')) return 'pdf';

  // 2. Magic number sniffing
  try {
    const headerBlob = file.slice(0, 4);
    const headerBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(headerBlob);
    });
    const view = new Uint8Array(headerBuffer);
    if (view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46) return 'pdf';
    if (view[0] === 0x50 && view[1] === 0x4B) return 'epub';
  } catch (e) {
    console.warn('Magic number sniffing failed', e);
  }

  // 3. MIME type fallback
  const mime = (file.type || '').toLowerCase();
  if (mime === 'text/plain' || mime.includes('text/') || mime.includes('json')) return 'txt';
  if (mime === 'application/epub+zip' || mime === 'application/zip' || mime === 'application/x-zip-compressed' || (mime === 'application/octet-stream' && fileName.includes('epub'))) return 'epub';
  if (mime === 'application/pdf' || mime === 'application/x-pdf' || (mime === 'application/octet-stream' && fileName.includes('pdf'))) return 'pdf';

  // 4. Final guess for unknown binaries
  if (!file.type || file.type === 'application/octet-stream') {
    if (fileName.includes('epub') || !fileName.includes('.')) return 'epub';
  }

  return null;
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

/**
 * 导入单本书
 */
const importSingleBook = async (file: File, format: 'txt' | 'epub' | 'pdf'): Promise<boolean> => {
  const meta = await extractMetadata(file, format);
  const book: Book = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: meta.title,
    author: meta.author,
    cover: meta.cover,
    format,
    size: file.size,
    progress: 0,
    addedAt: Date.now(),
    bookmarks: [],
    notes: []
  };
  const fileData = await file.arrayBuffer();
  await libraryStore.addBook(book, fileData);
  return true;
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  importing.value = true;
  importProgress.value = 0;

  const totalFiles = files.length;
  let successCount = 0;
  let failCount = 0;
  let firstError = '';

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    importProgress.value = Math.round((i / totalFiles) * 90);
    console.log(`Importing [${i + 1}/${totalFiles}]:`, { name: file.name, type: file.type, size: file.size });

    try {
      const format = await detectFormat(file);
      if (!format) {
        failCount++;
        if (!firstError) firstError = `不支持: ${file.name || '无名'}`;
        continue;
      }

      // Duplicate check
      const isDuplicate = libraryStore.books.some(b =>
        (b.title === file.name.replace(/\.[^/.]+$/, "")) &&
        (b.size === file.size)
      );
      if (isDuplicate) continue; // Skip silent duplicates in batch mode

      // 15-second timeout per file
      await Promise.race([
        importSingleBook(file, format),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000))
      ]);

      successCount++;
    } catch (err: any) {
      failCount++;
      if (!firstError) firstError = err.message === 'TIMEOUT' ? `${file.name} 导入超时` : `${file.name} 导入失败`;
    }
  }

  importProgress.value = 100;
  setTimeout(() => {
    importing.value = false;
    if (successCount > 0) {
      ElMessage.success(`成功导入 ${successCount} 本${failCount > 0 ? `，${failCount} 本失败` : ''}`);
    } else if (failCount > 0) {
      ElMessage.error(firstError || '全部导入失败');
    }
    target.value = '';
  }, 500);
};

const openBook = (book: Book) => {
  router.push(`/reader/${book.id}`);
};

const confirmDelete = (book: Book) => {
  ElMessageBox.confirm(
    `确定要从书架删除《${book.title}》吗？`,
    '提示',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      roundButton: true,
      customClass: 'glass-message-box'
    }
  ).then(() => {
    libraryStore.removeBook(book.id);
    ElMessage.success('已删除');
  }).catch(() => {});
};
</script>

<style scoped lang="less">
.library-toolbar {
  --background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  --border-style: none;
}

.search-toolbar {
  --background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  padding: 0 16px 10px 16px;
  --min-height: 48px;
}

.glass-search {
  --el-input-bg-color: rgba(255, 255, 255, 0.5);
  --el-input-border-color: transparent;
  --el-input-hover-border-color: transparent;
  --el-input-focus-border-color: transparent;
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.6);
  }

  &:focus-within {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(64, 158, 255, 0.4);
    box-shadow: 0 8px 20px rgba(64, 158, 255, 0.1);
  }
  
  :deep(.el-input__wrapper) {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 12px;
    
    &.is-focus {
      box-shadow: none !important;
    }
  }
}

.library-content {
  --background: #f4f7f6;
  position: relative;
  
  .glass-background {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);
    opacity: 0.15;
    z-index: -1;
  }
}

.library-container {
  padding: 24px;
  min-height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70vh;
  text-align: center;

  .empty-illustration {
    position: relative;
    margin-bottom: 30px;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;

    .circle-bg {
      position: absolute;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.2) 0%, rgba(118, 75, 162, 0.1) 100%);
      border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
      animation: morph 8s ease-in-out infinite;
    }

    .main-icon {
      font-size: 60px;
      color: #409eff;
      z-index: 1;
      filter: drop-shadow(0 10px 15px rgba(64, 158, 255, 0.3));
    }
  }

  h3 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 12px;
    color: #1e293b;
    letter-spacing: 1px;
  }

  p {
    font-size: 15px;
    color: #64748b;
    margin-bottom: 40px;
    line-height: 1.6;
  }

  .import-btn-large {
    padding: 12px 40px;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 10px 20px rgba(64, 158, 255, 0.2);
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba(64, 158, 255, 0.3);
    }
  }
}

@keyframes morph {
  0% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
  34% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; }
  67% { border-radius: 100% 60% 60% 100% / 100% 100% 60% 60%; }
  100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 10px;
  width: 100%;
}

.book-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  min-width: 0; // Essential for grid items to prevent content from expanding the width

  &:hover {
    transform: translateY(-8px);
    
    .cover-wrapper {
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      border-color: rgba(64, 158, 255, 0.4);
      
      .delete-btn {
        opacity: 1;
        transform: scale(1);
      }
    }

    .book-info .title {
      color: #409eff;
    }
  }

  .cover-wrapper {
    position: relative;
    aspect-ratio: 2/3;
    background: #fff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.5);
    transition: all 0.4s ease;
    z-index: 1;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .default-cover {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;

      .format-icon {
        font-size: 48px;
        opacity: 0.8;
      }

      .format-text {
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 2px;
        opacity: 0.9;
      }

      &.epub { 
        background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%); 
        color: #166534; 
      }
      &.pdf { 
        background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); 
        color: #991b1b; 
      }
      &.txt { 
        background: linear-gradient(135deg, #fffbeb 0%, #fef08a 100%); 
        color: #854d0e; 
      }
    }

    .progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: rgba(0, 0, 0, 0.05);
      backdrop-filter: blur(4px);

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #60a5fa, #3b82f6);
        transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        border-radius: 0 2px 2px 0;
      }
    }

    .delete-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f87171;
      opacity: 0;
      transform: scale(0.8);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 10;
      
      &:active {
        transform: scale(0.9);
        background: #fee2e2;
      }
    }
  }

  .book-info {
    padding: 10px 2px 0 2px;
    
    .title {
      font-size: 13px; // Smaller font for 3-column layout
      font-weight: 700;
      margin: 0;
      color: #1e293b;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.3;
      transition: color 0.3s;
    }

    .author {
      font-size: 11px; // Smaller font for author
      color: #64748b;
      margin: 2px 0 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }
  }
}

.add-btn-mini {
  background: rgba(255, 255, 255, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  color: #409eff !important;
  backdrop-filter: blur(10px);
  width: 44px !important;
  height: 44px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0 !important;

  &:hover {
    background: #fff !important;
    transform: scale(1.05);
    box-shadow: 0 8px 20px rgba(64, 158, 255, 0.15);
    color: #337ecc !important;
  }

  &:active {
    transform: scale(0.95);
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
}

/* Sort Bar */
.sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0 16px;
  flex-wrap: wrap;
}

.sort-label {
  font-size: 13px;
  color: #94a3b8;
  white-space: nowrap;
}

.sort-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sort-opt {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 14px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba(64, 158, 255, 0.08);
    color: #409eff;
  }

  &.active {
    background: rgba(64, 158, 255, 0.12);
    color: #409eff;
    font-weight: 600;
  }
}

/* Dark Mode Overrides */
</style>

<style lang="less">
html.ion-palette-dark .library-toolbar,
html.ion-palette-dark .search-toolbar {
  --background: rgba(30, 30, 30, 0.7);
}
html.ion-palette-dark .library-content {
  --background: #121212;
}
html.ion-palette-dark .library-content .glass-background {
  background: linear-gradient(135deg, #2a1b38 0%, #1e3c72 100%);
  opacity: 0.3;
}
html.ion-palette-dark .empty-state h3 {
  color: #e2e8f0;
}
html.ion-palette-dark .empty-state p {
  color: #94a3b8;
}
html.ion-palette-dark .book-card .book-info .title {
  color: #e2e8f0;
}
html.ion-palette-dark .book-card .book-info .author {
  color: #94a3b8;
}
html.ion-palette-dark .book-card .cover-wrapper {
  background: #1e1e1e;
  border-color: rgba(255, 255, 255, 0.1);
}
html.ion-palette-dark .book-card .default-cover {
  &.epub { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #6ee7b7; }
  &.pdf { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); color: #fca5a5; }
  &.txt { background: linear-gradient(135deg, #78350f 0%, #92400e 100%); color: #fde047; }
}
html.ion-palette-dark .glass-search {
  --el-input-bg-color: rgba(0, 0, 0, 0.3);
}
html.ion-palette-dark .add-btn-mini {
  background: rgba(30, 41, 59, 0.7) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #60a5fa !important;
  
  &:hover {
    background: rgba(30, 41, 59, 0.9) !important;
    color: #93c5fd !important;
  }
}
html.ion-palette-dark .sort-opt {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;

  &:hover {
    background: rgba(96, 165, 250, 0.15);
    color: #60a5fa;
  }

  &.active {
    background: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
  }
}
</style>
