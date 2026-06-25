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
          <div class="summary-card glass-card">
            <span class="label">阅读中</span>
            <span class="value">{{ readingBooksCount }}</span>
            <Icon icon="solar:book-linear" class="card-icon" />
          </div>
          <div class="summary-card glass-card">
            <span class="label">未开始</span>
            <span class="value">{{ unreadBooksCount }}</span>
            <Icon icon="solar:book-linear" class="card-icon icon-off" />
          </div>
        </div>

        <!-- Reading Progress -->
        <div class="insights-section glass-card">
          <h3>阅读进度</h3>
          <div class="progress-stats">
            <div class="ring-container">
              <svg viewBox="0 0 120 120" class="progress-ring">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" stroke-width="10" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  :stroke="progressRingColor"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="ringOffset"
                  transform="rotate(-90 60 60)"
                  class="ring-arc"
                />
                <text x="60" y="52" text-anchor="middle" class="ring-value" fill="#1e293b">
                  {{ Math.round(averageProgress) }}%
                </text>
                <text x="60" y="72" text-anchor="middle" class="ring-label" fill="#64748b">
                  平均进度
                </text>
              </svg>
            </div>
            <div class="status-legend">
              <div class="legend-item">
                <span class="legend-dot dot-complete"></span>
                <span class="legend-label">已完成</span>
                <span class="legend-count">{{ completedBooksCount }}</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot dot-reading"></span>
                <span class="legend-label">阅读中</span>
                <span class="legend-count">{{ readingBooksCount }}</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot dot-unread"></span>
                <span class="legend-label">未开始</span>
                <span class="legend-count">{{ unreadBooksCount }}</span>
              </div>
            </div>
          </div>
          <div class="total-size" v-if="totalSize > 0">
            <Icon icon="solar:folder-linear" style="font-size: 14px; margin-right: 4px;" />
            藏书总大小：{{ formatSize(totalSize) }}
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
                <div class="recent-top">
                  <h4 class="title">{{ book.title }}</h4>
                  <span class="format-tag" :class="book.format">{{ book.format.toUpperCase() }}</span>
                </div>
                <p class="meta">
                  进度 {{ Math.round(book.progress) }}% · {{ formatTime(book.lastReadAt) }}
                </p>
                <div class="mini-progress">
                  <div class="mini-bar" :style="{ width: book.progress + '%' }"></div>
                </div>
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

// ── 阅读状态统计 ──

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

// ── SVG 进度环 ──

const circumference = 2 * Math.PI * 52; // r=52

const ringOffset = computed(() => {
  const pct = Math.min(averageProgress.value, 100);
  return circumference - (circumference * pct) / 100;
});

const progressRingColor = computed(() => {
  const p = averageProgress.value;
  if (p >= 80) return '#10b981';
  if (p >= 40) return '#409eff';
  if (p > 0) return '#f59e0b';
  return '#94a3b8';
});


const totalSize = computed(() =>
  libraryStore.books.reduce((acc, b) => acc + (b.size || 0), 0)
);

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// ── 最近阅读 ──

const recentBooks = computed(() => {
  return [...libraryStore.books]
    .filter(b => b.lastReadAt)
    .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
    .slice(0, 5);
});

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
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

</script>

<style scoped lang="less">
.stats-toolbar {
  --background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.stats-content {
  --background: #f4f7f6;
  position: relative;

  .glass-background {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);
    opacity: 0.12;
    z-index: -1;
  }
}

.stats-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
}

// ── Summary Grid ──

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  .summary-card {
    padding: 18px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;

    .label { font-size: 13px; color: #64748b; margin-bottom: 4px; }
    .value { font-size: 28px; font-weight: 800; color: #1e293b; }
    .card-icon {
      position: absolute;
      right: -8px;
      bottom: -8px;
      font-size: 72px;
      opacity: 0.06;
      color: #409eff;
      transition: opacity 0.3s;
    }
    .icon-off { color: #94a3b8; }
  }
}

// ── Format Distribution ──

.insights-section {
  padding: 22px;
  h3 { margin: 0 0 18px 0; font-size: 17px; font-weight: 700; color: #334155; }
}

// ── Ring Progress ──

.progress-stats {
  display: flex;
  align-items: center;
  gap: 28px;

  .ring-container {
    flex-shrink: 0;
  }

  .progress-ring {
    width: 120px;
    height: 120px;
  }

  .ring-arc {
    transition: stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
                stroke 0.4s ease;
  }

  .ring-value { font-size: 22px; font-weight: 800; }
  .ring-label { font-size: 10px; }

  .status-legend {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #475569;

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;

      &.dot-complete { background: #10b981; }
      &.dot-reading  { background: #409eff; }
      &.dot-unread   { background: #94a3b8; }
    }

    .legend-label { flex: 1; }
    .legend-count {
      font-weight: 700;
      color: #1e293b;
      min-width: 20px;
      text-align: right;
    }
  }
}

.total-size {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #94a3b8;
  gap: 4px;
}

// ── Recent Section ──

.recent-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    h3 { margin: 0; font-size: 17px; font-weight: 700; color: #334155; }
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
    gap: 10px;
  }

  .recent-item {
    padding: 12px 14px;
    display: flex;
    gap: 14px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;

    &:active { transform: scale(0.98); }

    .recent-cover {
      width: 50px;
      height: 70px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      
      img { width: 100%; height: 100%; object-fit: cover; }
      .default-cover {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        background: #e2e8f0; color: #64748b;
        
        .format-icon { font-size: 24px; opacity: 0.8; }

        &.epub { background: #f0fdf4; color: #166534; }
        &.pdf  { background: #fef2f2; color: #991b1b; }
        &.txt  { background: #fffbeb; color: #854d0e; }
      }
    }

    .recent-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      overflow: hidden;

      .recent-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .format-tag {
        font-size: 10px;
        font-weight: 800;
        padding: 1px 6px;
        border-radius: 4px;
        flex-shrink: 0;
        letter-spacing: 0.5px;

        &.txt  { background: #fffbeb; color: #b45309; }
        &.epub { background: #f0fdf4; color: #166534; }
        &.pdf  { background: #fef2f2; color: #991b1b; }
      }

      .meta {
        margin: 0;
        font-size: 11px;
        color: #94a3b8;
      }

      .mini-progress {
        width: 100%;
        height: 4px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;

        .mini-bar {
          height: 100%;
          background: linear-gradient(90deg, #409eff, #60a5fa);
          border-radius: 4px;
          transition: width 0.4s ease;
        }
      }
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
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  opacity: 0.3;
}
html.ion-palette-dark .glass-card {
  background: rgba(40, 40, 40, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
}
html.ion-palette-dark .summary-card {
  .label { color: #94a3b8; }
  .value { color: #e2e8f0; }
}
html.ion-palette-dark .insights-section h3,
html.ion-palette-dark .recent-section .section-header h3 {
  color: #e2e8f0;
}
html.ion-palette-dark .ring-value { fill: #e2e8f0 !important; }
html.ion-palette-dark .ring-label { fill: #94a3b8 !important; }
html.ion-palette-dark .progress-ring circle:first-child { stroke: #334155; }
html.ion-palette-dark .legend-item { color: #cbd5e1; }
html.ion-palette-dark .legend-count { color: #e2e8f0; }
html.ion-palette-dark .total-size { color: #64748b; }
html.ion-palette-dark .recent-section .no-recent { color: #64748b; }
html.ion-palette-dark .recent-item .recent-info .title { color: #e2e8f0; }
html.ion-palette-dark .recent-item .recent-info .meta { color: #64748b; }
html.ion-palette-dark .recent-item .recent-cover .default-cover { background: #1e1e1e; }
html.ion-palette-dark .mini-progress { background: #334155; }
</style>
