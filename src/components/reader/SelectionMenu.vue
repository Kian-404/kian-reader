<template>
  <div class="selection-menu glass-card">
    <p class="selection-preview">"{{ text }}"</p>
    <el-input 
      :model-value="comment" 
      placeholder="写点感想..." 
      size="small" 
      class="note-input"
      @update:model-value="$emit('update:comment', $event)"
    />
    <div class="color-picker-row">
      <span class="color-label">高亮颜色</span>
      <div class="color-options">
        <button
          v-for="c in colors"
          :key="c.value"
          :class="['color-dot', { active: selectedColor === c.value }]"
          :style="{ backgroundColor: c.value }"
          :title="c.label"
          @click="handleColorChange(c.value)"
        ></button>
      </div>
    </div>
    <div class="menu-actions">
      <el-button type="primary" size="small" @click="$emit('save')" round>
        高亮笔记
      </el-button>
      <el-button size="small" @click="$emit('close')" round>
        取消
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
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
.selection-menu {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 3000;
  width: 85%;
  max-width: 400px;
  padding: 25px;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);

  .selection-preview {
    font-size: 14px;
    font-style: italic;
    color: #64748b;
    margin-bottom: 20px;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .note-input {
    margin-bottom: 15px;
    --el-input-bg-color: rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    overflow: hidden;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.3);

    :deep(.el-input__wrapper) {
      box-shadow: none !important;
      background: transparent !important;
    }
  }

  .color-picker-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;

    .color-label {
      font-size: 13px;
      color: #64748b;
      white-space: nowrap;
    }

    .color-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .color-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
      padding: 0;
      outline: none;

      &:hover {
        transform: scale(1.15);
      }

      &.active {
        border-color: #409eff;
        box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
        transform: scale(1.1);
      }
    }
  }

  .menu-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
}

html.ion-palette-dark {
  .selection-menu {
    background: rgba(30, 41, 59, 0.8) !important;

    .note-input {
      --el-input-bg-color: rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .color-label {
      color: #94a3b8;
    }
  }
}
</style>
