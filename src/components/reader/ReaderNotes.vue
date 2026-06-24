<template>
  <div class="notes-container">
    <div v-if="!notes || notes.length === 0" class="empty-state">
      <Icon icon="solar:pen-new-square-linear" class="empty-icon" />
      <p class="empty-title">暂无笔记</p>
      <p class="empty-hint">阅读时选中文字即可添加高亮笔记</p>
    </div>
    
    <div v-else class="notes-list">
      <div 
        v-for="note in sortedNotes" 
        :key="note.id" 
        class="note-item"
        @click="$emit('jump', note)"
      >
        <div class="note-color-bar" :style="{ backgroundColor: note.color || '#ffe082' }"></div>
        <div class="note-body">
          <p class="note-text">{{ note.text }}</p>
          <div v-if="note.comment" class="note-comment">
            <Icon icon="solar:chat-square-linear" class="comment-icon" />
            <span>{{ note.comment }}</span>
          </div>
          <div class="note-footer">
            <span class="note-date">{{ formatDate(note.addedAt) }}</span>
            <button class="delete-btn" @click.stop="$emit('remove', note.id)">
              <Icon icon="solar:trash-bin-trash-linear" />
            </button>
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
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
</script>

<style scoped lang="less">
.notes-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

// ── Empty State ──

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 40px;

  .empty-icon {
    font-size: 48px;
    color: #cbd5e1;
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 17px;
    font-weight: 700;
    color: #94a3b8;
    margin: 0;
  }

  .empty-hint {
    font-size: 13px;
    color: #b0bcc9;
    margin: 0;
    text-align: center;
    line-height: 1.5;
  }
}

// ── Notes List ──

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note-item {
  margin: 0 16px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: rgba(64, 158, 255, 0.04);
    transform: scale(0.98);
  }

  .note-color-bar {
    width: 4px;
    border-radius: 3px;
    flex-shrink: 0;
    align-self: stretch;
  }

  .note-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;

    .note-text {
      margin: 0;
      font-size: 14px;
      color: #334155;
      font-weight: 500;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .note-comment {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      font-size: 13px;
      color: #409eff;
      background: rgba(64, 158, 255, 0.05);
      padding: 8px 10px;
      border-radius: 8px;
      line-height: 1.5;

      .comment-icon {
        flex-shrink: 0;
        margin-top: 1px;
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

      .delete-btn {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s;
        padding: 0;

        &:active {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      }
    }
  }
}
</style>
