<template>
  <div class="bookmarks-container">
    <div class="header-actions">
      <el-button type="primary" @click="$emit('add')" round size="small" class="add-btn">
        <Icon icon="solar:add-circle-linear" style="margin-right: 5px; font-size: 16px" />
        添加当前书签
      </el-button>
    </div>
    
    <div v-if="!bookmarks || bookmarks.length === 0" class="empty-state">
      <Icon icon="solar:bookmark-opened-linear" style="font-size: 48px" />
      <p>暂无书签，记录你的阅读足迹吧</p>
    </div>
    
    <div v-else class="bookmarks-list">
      <div 
        v-for="bm in sortedBookmarks" 
        :key="bm.id" 
        class="bookmark-item"
        @click="$emit('jump', bm)"
      >
        <div class="bm-info">
          <span class="bm-label">{{ bm.label }}</span>
          <span class="bm-time">{{ formatDate(bm.addedAt) }}</span>
        </div>
        <el-button 
          link 
          type="danger" 
          @click.stop="$emit('remove', bm.id)"
          class="delete-btn"
        >
          <template #icon>
            <Icon icon="solar:trash-bin-trash-linear" style="font-size: 18px" />
          </template>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  bookmarks?: any[];
}>();

defineEmits<{
  (e: 'jump', bm: any): void;
  (e: 'add'): void;
  (e: 'remove', id: string): void;
}>();

const sortedBookmarks = computed(() => {
  if (!props.bookmarks) return [];
  return [...props.bookmarks].sort((a, b) => b.addedAt - a.addedAt);
});

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style scoped lang="less">
.bookmarks-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header-actions {
  padding: 0 20px 20px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  
  .add-btn {
    width: 100%;
    height: 36px;
    font-weight: 600;
  }
}

.bookmarks-list {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  gap: 10px;
  p { font-size: 14px; }
}

.bookmark-item {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: rgba(64, 158, 255, 0.05);
  }

  .bm-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;

    .bm-label {
      font-size: 15px;
      color: #334155;
      font-weight: 500;
      line-height: 1.4;
    }

    .bm-time {
      font-size: 11px;
      color: #94a3b8;
    }
  }

  .delete-btn {
    padding: 8px;
    opacity: 0.6;
    &:hover { opacity: 1; }
  }
}
</style>
