<template>
  <div class="toc-container">
    <div v-if="!toc || toc.length === 0" class="empty-state">
      <Icon icon="solar:list-arrow-down-linear" style="font-size: 48px" />
      <p>正在读取目录...</p>
    </div>

    <div v-else class="toc-list">
      <div 
        v-for="(item, idx) in toc" 
        :key="idx" 
        class="toc-item"
        :class="{ active: activeHref === item.href }"
        :id="'toc-item-' + idx"
        @click="$emit('jump', item.href)"
      >
        <span class="toc-label">{{ item.label }}</span>
        <div class="toc-right">
          <span v-if="isPageNumber(item.href)" class="page-badge">第 {{ item.href }} 页</span>
          <Icon v-if="activeHref === item.href" icon="solar:check-circle-linear" class="active-icon" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  toc: Array<{ label: string, href: string }>;
  activeHref?: string;
}>();

defineEmits<{
  (e: 'jump', href: string): void;
}>();

/** 判断 href 是否为纯数字页码（TXT/PDF），而非 EPUB CFI */
const isPageNumber = (href: string): boolean => {
  return /^\d+$/.test(href);
};
</script>

<style scoped lang="less">
.toc-container {
  height: 100%;
  display: flex;
  flex-direction: column;
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

.toc-list {
  padding: 10px 0;
}

.toc-item {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);

  &:active {
    background: rgba(64, 158, 255, 0.05);
  }

  &.active {
    background: rgba(64, 158, 255, 0.08);
    .toc-label {
      color: #409eff;
      font-weight: 600;
    }
  }

  .toc-label {
    font-size: 15px;
    color: #334155;
    line-height: 1.4;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 10px;
  }

  .toc-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .page-badge {
    font-size: 12px;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.04);
    padding: 2px 10px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .active-icon {
    color: #409eff;
    font-size: 16px;
  }
}

html.ion-palette-dark {
  .toc-item {
    .toc-label { color: #e2e8f0; }
    .page-badge {
      color: #64748b;
      background: rgba(255, 255, 255, 0.06);
    }
    &.active .toc-label { color: #60a5fa; }
  }
}
</style>
