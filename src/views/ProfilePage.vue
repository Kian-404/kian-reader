<template>
  <ion-page>
    <ion-header :translucent="true" class="ion-no-border">
      <ion-toolbar class="profile-toolbar">
        <ion-title>个人中心</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="profile-content">
      <div class="glass-background"></div>
      
      <div class="profile-container">
        <!-- User Info Card -->
        <div class="user-card glass-card">
          <div class="avatar-section">
            <div class="avatar-placeholder">
              <Icon icon="solar:user-circle-linear" style="font-size: 48px" />
            </div>
            <div class="user-meta">
              <h3>书虫用户</h3>
              <p>愿每一本书都能温暖你的时光</p>
            </div>
          </div>
          <div class="stats-row">
            <div class="stat-item">
              <span class="value">{{ libraryStore.books.length }}</span>
              <span class="label">藏书</span>
            </div>
            <div class="stat-item">
              <span class="value">{{ totalNotesCount }}</span>
              <span class="label">笔记</span>
            </div>
            <div class="stat-item">
              <span class="value">{{ totalBookmarksCount }}</span>
              <span class="label">书签</span>
            </div>
          </div>
        </div>

        <!-- App Settings -->
        <div class="settings-group">
          <h3>应用设置</h3>
          <div class="settings-list glass-card">
            <div class="setting-row">
              <div class="row-left">
                <Icon icon="solar:moon-linear" style="font-size: 20px" />
                <span>夜间模式</span>
              </div>
              <el-switch v-model="isAppDarkMode" />
            </div>
            <div class="setting-row">
              <div class="row-left">
                <Icon icon="solar:info-circle-linear" style="font-size: 20px" />
                <span>关于 Kianer Reader</span>
              </div>
              <span class="version">v1.0.0</span>
            </div>
          </div>
        </div>

        <!-- Data Management -->
        <div class="settings-group danger-zone">
          <h3>数据管理</h3>
          <div class="settings-list glass-card">
            <div class="setting-row" @click="exportData">
              <div class="row-left">
                <Icon icon="solar:export-linear" style="font-size: 20px" />
                <span>导出数据备份</span>
              </div>
              <Icon icon="solar:alt-arrow-right-linear" class="arrow" style="font-size: 18px" />
            </div>
            <div class="setting-row" @click="triggerImport">
              <div class="row-left">
                <Icon icon="solar:import-linear" style="font-size: 20px" />
                <span>导入数据备份</span>
              </div>
              <Icon icon="solar:alt-arrow-right-linear" class="arrow" style="font-size: 18px" />
            </div>
            <div class="setting-row" @click="confirmClearData">
              <div class="row-left danger">
                <Icon icon="solar:trash-bin-trash-linear" style="font-size: 20px" />
                <span>清理所有数据</span>
              </div>
              <Icon icon="solar:alt-arrow-right-linear" class="arrow" style="font-size: 18px" />
            </div>
          </div>
          <p class="danger-hint">注意：清理将删除所有书籍、笔记和阅读进度，且不可恢复。建议先导出备份。</p>
        </div>

        <!-- Hidden Import Input -->
        <input
          type="file"
          ref="importInput"
          accept=".json"
          style="display: none"
          @change="handleImport"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent 
} from '@ionic/vue';
import { Icon } from '@iconify/vue';
import { useLibraryStore } from '@/stores/library';
import { ElMessageBox, ElMessage } from 'element-plus';
import localforage from 'localforage';
import { useDark } from '@vueuse/core';

const libraryStore = useLibraryStore();
const importInput = ref<HTMLInputElement | null>(null);
const isExporting = ref(false);
onMounted(async () => {
  await libraryStore.initStore();
});
const isAppDarkMode = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'ion-palette-dark',
  valueLight: '',
});

const totalNotesCount = computed(() => 
  libraryStore.books.reduce((acc, b) => acc + (b.notes?.length || 0), 0)
);

const totalBookmarksCount = computed(() => 
  libraryStore.books.reduce((acc, b) => acc + (b.bookmarks?.length || 0), 0)
);

/**
 * 导出完整数据备份 (metadata + base64 书籍文件)
 */
const exportData = async () => {
  if (isExporting.value) return;
  isExporting.value = true;

  try {
    ElMessage.info('正在打包数据...');
    const books = libraryStore.books;
    const exportData: any = {
      version: 1,
      exportedAt: Date.now(),
      app: 'Kianer Reader',
      books: [],
    };

    for (const book of books) {
      const raw = await localforage.getItem<any>(`book-data-${book.id}`);
      let base64 = '';
      if (raw) {
        const bytes = raw instanceof Blob ? new Uint8Array(await raw.arrayBuffer()) : new Uint8Array(raw);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
      }

      exportData.books.push({
        ...book,
        _fileDataBase64: base64,
      });
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kianer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ElMessage.success(`已导出 ${books.length} 本书`);
  } catch (e) {
    console.error('Export failed:', e);
    ElMessage.error('导出失败');
  } finally {
    isExporting.value = false;
  }
};

const triggerImport = () => {
  importInput.value?.click();
};

const handleImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !Array.isArray(data.books)) {
      ElMessage.error('无效的备份文件格式');
      return;
    }

    const confirmed = await ElMessageBox.confirm(
      `将导入 ${data.books.length} 本书籍数据${data.books.some((b: any) => b.notes?.length) ? '（含笔记）' : ''}，是否继续？`,
      '导入确认',
      {
        confirmButtonText: '确定导入',
        cancelButtonText: '取消',
        type: 'info',
        roundButton: true,
        customClass: 'glass-message-box',
      }
    ).catch(() => false);

    if (!confirmed) return;

    ElMessage.info('正在恢复数据...');
    const cleanBooks = data.books.map((b: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _fileDataBase64, ...meta } = b;
      return meta;
    });

    for (const bookData of data.books) {
      const { _fileDataBase64 } = bookData;

      // Restore binary data
      if (_fileDataBase64) {
        const binaryStr = atob(_fileDataBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        await localforage.setItem(`book-data-${bookData.id}`, bytes.buffer);
      }
    }

    // Write metadata once after all binaries are restored
    await localforage.setItem('kianer-library-metadata', cleanBooks);

    // 直接更新 store（initStore 已初始化过的场景会短路跳过）
    libraryStore.books.splice(0, libraryStore.books.length, ...cleanBooks);

    ElMessage.success(`成功导入 ${cleanBooks.length} 本书`);
    target.value = '';
  } catch (e) {
    console.error('Import failed:', e);
    ElMessage.error('导入失败，请检查备份文件');
    target.value = '';
  }
};

const confirmClearData = () => {
  ElMessageBox.confirm(
    '确定要清空所有数据吗？所有导入的书籍和阅读笔记都将丢失。',
    '极端危险操作',
    {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'error',
      roundButton: true,
      customClass: 'glass-message-box'
    }
  ).then(async () => {
    try {
      await localforage.clear();
      localStorage.clear();
      window.location.reload(); // Hard reload to reset everything
    } catch (e) {
      ElMessage.error('清理失败');
    }
  }).catch(() => {});
};
</script>

<style scoped lang="less">
.profile-toolbar {
  --background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.profile-content {
  --background: #f8fafc;
  position: relative;

  .glass-background {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
    opacity: 0.1;
    z-index: -1;
  }
}

.profile-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05);
}

.user-card {
  padding: 25px;
  
  .avatar-section {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;

    .avatar-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 0 10px 20px rgba(118, 75, 162, 0.2);
    }

    .user-meta {
      h3 { margin: 0 0 5px 0; font-size: 20px; font-weight: 700; color: #1e293b; }
      p { margin: 0; font-size: 13px; color: #64748b; }
    }
  }

  .stats-row {
    display: flex;
    justify-content: space-around;
    padding-top: 20px;
    border-top: 1px solid rgba(0,0,0,0.05);

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      .value { font-size: 20px; font-weight: 800; color: #1e293b; }
      .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    }
  }
}

.settings-group {
  h3 { margin: 0 0 15px 10px; font-size: 16px; font-weight: 700; color: #475569; }
  
  .settings-list {
    overflow: hidden;
    
    .setting-row {
      padding: 18px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(0,0,0,0.03);
      cursor: pointer;

      &:last-child { border-bottom: none; }
      &:active { background: rgba(0,0,0,0.02); }

      .row-left {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 15px;
        color: #334155;
        
        &.danger { color: #f56c6c; }
      }

      .version { font-size: 13px; color: #94a3b8; }
      .arrow { color: #cbd5e1; }
    }
  }
}

.danger-zone {
  .danger-hint {
    margin: 10px 10px 0 10px;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.5;
  }
}

/* Dark Mode Overrides */
</style>

<style lang="less">
html.ion-palette-dark .profile-toolbar {
  --background: rgba(30, 30, 30, 0.7);
}
html.ion-palette-dark .profile-content {
  --background: #121212;
}
html.ion-palette-dark .profile-content .glass-background {
  background: linear-gradient(135deg, #2a1b38 0%, #1e3c72 100%);
  opacity: 0.3;
}
html.ion-palette-dark .glass-card {
  background: rgba(40, 40, 40, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
}
html.ion-palette-dark .user-card .user-meta h3 {
  color: #e2e8f0;
}
html.ion-palette-dark .user-card .user-meta p {
  color: #94a3b8;
}
html.ion-palette-dark .user-card .stats-row .stat-item .value {
  color: #e2e8f0;
}
html.ion-palette-dark .user-card .stats-row .stat-item .label {
  color: #94a3b8;
}
html.ion-palette-dark .settings-group h3 {
  color: #94a3b8;
}
html.ion-palette-dark .settings-list .setting-row .row-left {
  color: #e2e8f0;
}
html.ion-palette-dark .settings-list .setting-row .row-left.danger {
  color: #f56c6c;
}
</style>
