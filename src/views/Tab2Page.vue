<template>
  <ion-page>
    <ion-header :translucent="true" class="ion-no-border">
      <ion-toolbar class="stats-toolbar">
        <ion-title>阅读洞察</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="stats-content">
      <div class="glass-background"></div>
      
      <div class="stats-container">
        <!-- Summary Cards -->
        <div class="summary-grid">
          <div class="summary-card glass-card">
            <span class="label">藏书总量</span>
            <span class="value">{{ libraryStore.books.length }}</span>
            <Icon icon="solar:library-linear" class="card-icon" />
          </div>
          <div class="summary-card glass-card">
            <span class="label">已读完</span>
            <span class="value">{{ completedBooksCount }}</span>
            <Icon icon="solar:check-circle-linear" class="card-icon" />
          </div>
        </div>

        <!-- Progress Section -->
        <div class="insights-section glass-card">
          <h3>阅读进度</h3>
          <div class="progress-stats">
            <el-progress 
              type="dashboard" 
              :percentage="averageProgress" 
              :color="progressColors"
              :stroke-width="10"
            >
              <template #default="{ percentage }">
                <span class="percentage-value">{{ Math.round(percentage) }}%</span>
                <span class="percentage-label">平均进度</span>
              </template>
            </el-progress>
            <div class="progress-details">
              <p>阅读中的书籍：{{ readingBooksCount }} 本</p>
              <p>未开始的书籍：{{ unreadBooksCount }} 本</p>
            </div>
          </div>
        </div>

        <!-- Recent Reading -->
        <div class="recent-section">
          <div class="section-header">
            <h3>最近阅读</h3>
            <el-button link @click="router.push('/tabs/home')">查看全部</el-button>
          </div>
          
          <div v-if="recentBooks.length === 0" class="no-recent glass-card">
            暂无阅读记录，开启您的阅读之旅吧
          </div>
          
          <div v-else class="recent-list">
            <div 
              v-for="book in recentBooks" 
              :key="book.id" 
              class="recent-item glass-card"
              @click="openBook(book)"
            >
              <div class="recent-cover">
                <img v-if="book.cover" :src="book.cover" :alt="book.title" />
                <div v-else class="default-cover" :class="book.format">
                  <Icon 
                    :icon="book.format === 'pdf' ? 'solar:file-pdf-linear' : (book.format === 'epub' ? 'solar:notebook-linear' : 'solar:document-text-linear')" 
                    class="format-icon"
                  />
                </div>
              </div>
              <div class="recent-info">
                <h4 class="title">{{ book.title }}</h4>
                <p class="meta">
                  进度：{{ Math.round(book.progress) }}% · 
                  {{ formatTime(book.lastReadAt) }}
                </p>
                <el-progress :percentage="book.progress" :show-text="false" :stroke-width="4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent 
} from '@ionic/vue';
import { Icon } from '@iconify/vue';
import { useLibraryStore } from '@/stores/library';
import { useRouter } from 'vue-router';
const libraryStore = useLibraryStore();
const router = useRouter();

onMounted(async () => {
  await libraryStore.initStore();
});

const completedBooksCount = computed(() => 
  libraryStore.books.filter(b => b.progress >= 99).length
);

const readingBooksCount = computed(() => 
  libraryStore.books.filter(b => b.progress > 0 && b.progress < 99).length
);

const unreadBooksCount = computed(() => 
  libraryStore.books.filter(b => b.progress === 0).length
);

const averageProgress = computed(() => {
  if (libraryStore.books.length === 0) return 0;
  const total = libraryStore.books.reduce((acc, b) => acc + b.progress, 0);
  return total / libraryStore.books.length;
});

const recentBooks = computed(() => {
  return [...libraryStore.books]
    .filter(b => b.lastReadAt)
    .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
    .slice(0, 3);
});

const progressColors = [
  { color: '#f56c6c', percentage: 20 },
  { color: '#e6a23c', percentage: 40 },
  { color: '#5cb87a', percentage: 60 },
  { color: '#1989fa', percentage: 80 },
  { color: '#6f7ad3', percentage: 100 },
];

const openBook = (book: any) => {
  router.push(`/reader/${book.id}`);
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return new Date(timestamp).toLocaleDateString();
};
</script>

<style scoped lang="less">
.stats-toolbar {
  --background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.stats-content {
  --background: #f8fafc;
  position: relative;

  .glass-background {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%);
    opacity: 0.1;
    z-index: -1;
  }
}

.stats-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;

  .summary-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;

    .label { font-size: 13px; color: #64748b; margin-bottom: 5px; }
    .value { font-size: 28px; font-weight: 800; color: #1e293b; }
    .card-icon {
      position: absolute;
      right: -10px;
      bottom: -10px;
      font-size: 80px;
      opacity: 0.05;
      color: #409eff;
    }
  }
}

.insights-section {
  padding: 25px;
  h3 { margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #334155; }
  
  .progress-stats {
    display: flex;
    align-items: center;
    gap: 30px;
  }

  .percentage-value { font-size: 24px; font-weight: 800; color: #1e293b; display: block; }
  .percentage-label { font-size: 12px; color: #64748b; }

  .progress-details {
    p { font-size: 14px; color: #475569; margin: 8px 0; }
  }
}

.recent-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    h3 { margin: 0; font-size: 18px; font-weight: 700; color: #334155; }
  }

  .no-recent {
    padding: 40px;
    text-align: center;
    color: #94a3b8;
    font-size: 14px;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .recent-item {
    padding: 12px;
    display: flex;
    gap: 15px;
    cursor: pointer;
    transition: transform 0.2s;

    &:active { transform: scale(0.98); }

    .recent-cover {
      width: 50px;
      height: 70px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      
      img { width: 100%; height: 100%; object-fit: cover; }
      .default-cover {
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        background: #e2e8f0; color: #64748b;
        
        .format-icon { font-size: 24px; opacity: 0.8; }

        &.epub { background: #f0fdf4; color: #166534; }
        &.pdf { background: #fef2f2; color: #991b1b; }
        &.txt { background: #fffbeb; color: #854d0e; }
      }
    }

    .recent-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 5px;

      .title { margin: 0; font-size: 15px; font-weight: 600; color: #1e293b; }
      .meta { margin: 0; font-size: 12px; color: #64748b; }
    }
  }
}
</style>

<style lang="less">
/* Dark Mode Overrides */
html.ion-palette-dark .stats-toolbar {
  --background: rgba(30, 30, 30, 0.7);
}
html.ion-palette-dark .stats-content {
  --background: #121212;
}
html.ion-palette-dark .stats-content .glass-background {
  background: linear-gradient(135deg, #1f0507 0%, #2a0804 100%);
  opacity: 0.2;
}
html.ion-palette-dark .glass-card {
  background: rgba(40, 40, 40, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
}
html.ion-palette-dark .summary-card .label {
  color: #94a3b8;
}
html.ion-palette-dark .summary-card .value {
  color: #e2e8f0;
}
html.ion-palette-dark .insights-section h3,
html.ion-palette-dark .recent-section .section-header h3 {
  color: #e2e8f0;
}
html.ion-palette-dark .insights-section .percentage-value {
  color: #e2e8f0;
}
html.ion-palette-dark .insights-section .percentage-label {
  color: #94a3b8;
}
html.ion-palette-dark .insights-section .progress-details p {
  color: #cbd5e1;
}
html.ion-palette-dark .recent-section .no-recent {
  color: #94a3b8;
}
html.ion-palette-dark .recent-item .recent-info .title {
  color: #e2e8f0;
}
html.ion-palette-dark .recent-item .recent-info .meta {
  color: #94a3b8;
}
html.ion-palette-dark .recent-item .recent-cover .default-cover {
  background: #1e1e1e;
}
</style>
