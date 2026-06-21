<template>
  <div class="notes-container">
    <div v-if="!notes || notes.length === 0" class="empty-state">
      <Icon icon="solar:pen-new-square-linear" style="font-size: 48px" />
      <p>暂无笔记，在阅读时选中文字记录感悟吧</p>
    </div>
    
    <div v-else class="notes-list">
      <div 
        v-for="note in sortedNotes" 
        :key="note.id" 
        class="note-item"
        @click="$emit('jump', note)"
      >
        <div class="note-highlight-strip" :style="{ backgroundColor: note.color }"></div>
        <div class="note-main">
          <p class="note-text">{{ note.text }}</p>
          <div v-if="note.comment" class="note-comment">
            <Icon icon="solar:chat-line-linear" class="comment-icon" style="font-size: 16px" />
            <span>{{ note.comment }}</span>
          </div>
          <div class="note-footer">
            <span class="note-date">{{ formatDate(note.addedAt) }}</span>
            <el-button 
              link 
              type="danger" 
              @click.stop="$emit('remove', note.id)"
              size="small"
            >
              <template #icon>
                <Icon icon="solar:trash-bin-trash-linear" style="font-size: 18px" />
              </template>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  notes?: any[];
}>();

defineEmits<{
  (e: 'jump', note: any): void;
  (e: 'remove', id: string): void;
}>();

const sortedNotes = computed(() => {
  if (!props.notes) return [];
  return [...props.notes].sort((a, b) => b.addedAt - a.addedAt);
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
.notes-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  gap: 10px;
  p { font-size: 14px; text-align: center; padding: 0 40px; }
}

.note-item {
  margin: 0 15px 15px 15px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.03);
  display: flex;
  gap: 15px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: rgba(64, 158, 255, 0.05);
    transform: scale(0.98);
  }

  .note-highlight-strip {
    width: 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .note-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .note-text {
      font-size: 14px;
      color: #334155;
      font-weight: 500;
      line-height: 1.6;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .note-comment {
      font-size: 13px;
      color: #409eff;
      background: rgba(64, 158, 255, 0.05);
      padding: 10px;
      border-radius: 8px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      
      .comment-icon {
        margin-top: 2px;
        font-size: 14px;
      }
    }

    .note-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .note-date {
        font-size: 11px;
        color: #94a3b8;
      }
    }
  }
}
</style>
