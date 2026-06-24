<template>
  <div class="selection-overlay" @click.self="$emit('close')">
    <transition name="slide-up">
      <div class="selection-sheet glass-card">
        <!-- Handle bar -->
        <div class="handle-bar"><div class="handle"></div></div>

        <!-- Selected text preview -->
        <div class="selection-preview" :style="{ borderLeftColor: selectedColor }">
          <Icon icon="solar:quote-linear" class="quote-icon" />
          <p class="preview-text">"{{ text }}"</p>
        </div>

        <!-- Comment input -->
        <div class="input-row">
          <Icon icon="solar:chat-square-linear" class="input-icon" />
          <el-input
            :model-value="comment"
            placeholder="写点感想..."
            :rows="2"
            type="textarea"
            class="note-input"
            resize="none"
            @update:model-value="$emit('update:comment', $event)"
          />
        </div>

        <!-- Color picker -->
        <div class="color-section">
          <span class="section-label">高亮颜色</span>
          <div class="color-options">
            <button
              v-for="c in colors"
              :key="c.value"
              :class="['color-chip', { active: selectedColor === c.value }]"
              :style="{ backgroundColor: c.value }"
              :title="c.label"
              @click="handleColorChange(c.value)"
            >
              <Icon v-if="selectedColor === c.value" icon="solar:check-linear" class="check-icon" />
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="action-row">
          <button class="action-btn secondary" @click="$emit('close')">
            <Icon icon="solar:close-circle-linear" />
            <span>取消</span>
          </button>
          <button class="action-btn primary" @click="$emit('save')">
            <Icon icon="solar:pen-linear" />
            <span>保存笔记</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  text: string;
  comment: string;
  selectedColor?: string;
}>();

const emit = defineEmits<{
  save: [];
  close: [];
  'update:comment': [value: string];
  'update:selectedColor': [value: string];
}>();

const colors = [
  { value: '#ffe082', label: '淡黄' },
  { value: '#a5d6a7', label: '淡绿' },
  { value: '#90caf9', label: '淡蓝' },
  { value: '#f48fb1', label: '淡粉' },
  { value: '#ce93d8', label: '淡紫' },
  { value: '#ffab91', label: '淡橙' },
];

const handleColorChange = (color: string) => {
  emit('update:selectedColor', color);
};
</script>

<style scoped lang="less">
.selection-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.selection-sheet {
  width: 100%;
  max-width: 500px;
  max-height: 70vh;
  border-radius: 24px 24px 0 0 !important;
  padding: 12px 24px 28px;
  background: rgba(255, 255, 255, 0.97) !important;
  overflow-y: auto;
  overscroll-behavior: contain;

  .handle-bar {
    display: flex;
    justify-content: center;
    padding: 4px 0 16px;

    .handle {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: #d1d5db;
    }
  }
}

// ── Selection Preview ──

.selection-preview {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border-left: 4px solid #ffe082;
  align-items: flex-start;

  .quote-icon {
    font-size: 18px;
    color: #94a3b8;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .preview-text {
    margin: 0;
    font-size: 14px;
    color: #475569;
    line-height: 1.6;
    font-style: italic;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

// ── Input ──

.input-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 16px;

  .input-icon {
    font-size: 18px;
    color: #94a3b8;
    margin-top: 10px;
    flex-shrink: 0;
  }

  .note-input {
    flex: 1;

    :deep(.el-textarea__inner) {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      background: rgba(255, 255, 255, 0.5);
      box-shadow: none;
      transition: border-color 0.2s;

      &:focus {
        border-color: #409eff;
      }

      &::placeholder {
        color: #94a3b8;
      }
    }
  }
}

// ── Color Picker ──

.color-section {
  margin-bottom: 20px;

  .section-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 10px;
  }

  .color-options {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .color-chip {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      transform: scale(1.1);
    }

    &.active {
      border-color: #1e293b;
      box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.12);
      transform: scale(1.1);
    }

    .check-icon {
      font-size: 16px;
      color: #1e293b;
      filter: drop-shadow(0 1px 1px rgba(255, 255, 255, 0.5));
    }
  }
}

// ── Actions ──

.action-row {
  display: flex;
  gap: 10px;

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s;

    &.primary {
      background: linear-gradient(135deg, #409eff, #60a5fa);
      color: #fff;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);

      &:active {
        transform: scale(0.97);
        box-shadow: 0 2px 6px rgba(64, 158, 255, 0.2);
      }
    }

    &.secondary {
      background: rgba(0, 0, 0, 0.04);
      color: #64748b;

      &:active {
        background: rgba(0, 0, 0, 0.08);
      }
    }
  }
}

// ── Slide-up Animation ──

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

// ── Dark Mode ──

html.ion-palette-dark {
  .selection-overlay {
    background: rgba(0, 0, 0, 0.5);
  }

  .selection-sheet {
    background: rgba(30, 41, 59, 0.97) !important;

    .handle {
      background: #475569;
    }
  }

  .selection-preview {
    background: rgba(255, 255, 255, 0.03);

    .preview-text {
      color: #94a3b8;
    }
  }

  .input-row .note-input :deep(.el-textarea__inner) {
    border-color: #334155;
    background: rgba(0, 0, 0, 0.2);
    color: #e2e8f0;

    &:focus {
      border-color: #60a5fa;
    }
  }

  .color-chip.active {
    border-color: #e2e8f0;
    box-shadow: 0 0 0 3px rgba(226, 232, 240, 0.15);
  }

  .action-btn.secondary {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;

    &:active {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}
</style>
