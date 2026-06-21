<template>
  <transition name="fade">
    <div v-if="show" class="controls-overlay">
      <!-- Top Bar -->
      <div class="top-bar">
        <el-button circle @click="$emit('back')" class="glass-btn">
          <Icon icon="solar:alt-arrow-left-linear" width="28" height="28" />
        </el-button>
        <div class="book-title">{{ title }}</div>
        <!-- Spacer for alignment -->
        <div style="width: 32px"></div> 
      </div>

      <!-- Bottom Bar -->
      <div class="bottom-bar">
        <div class="progress-section">
          <span class="progress-text">进度: {{ Math.round(progress) }}%</span>
          <el-slider 
            v-model="internalProgress" 
            :min="0" 
            :max="100" 
            :show-tooltip="false"
            @change="$emit('progress-change', $event)" 
            class="progress-slider"
          />
        </div>
        
        <div class="bottom-actions">
          <div class="action-item" @click="$emit('toggle-toc')">
            <Icon icon="solar:list-arrow-down-linear" style="font-size: 24px" />
          </div>
          <div class="action-item" @click="$emit('toggle-bookmarks')">
            <Icon icon="solar:bookmark-opened-linear" style="font-size: 24px" />
          </div>
          <div class="action-item" @click="$emit('toggle-notes')">
            <Icon icon="solar:pen-new-square-linear" style="font-size: 24px" />
          </div>
          <div class="action-item" @click="$emit('toggle-search')">
            <Icon icon="solar:magnifer-linear" style="font-size: 24px" />
          </div>
          <div class="action-item" @click="$emit('toggle-settings')">
            <Icon icon="solar:settings-linear" style="font-size: 24px" />
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  show: boolean;
  title?: string;
  progress: number;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'progress-change', val: number): void;
  (e: 'toggle-search'): void;
  (e: 'toggle-notes'): void;
  (e: 'toggle-bookmarks'): void;
  (e: 'toggle-toc'): void;
  (e: 'toggle-settings'): void;
}>();

const internalProgress = ref(props.progress);

watch(() => props.progress, (newVal) => {
  internalProgress.value = newVal;
});
</script>

<style scoped lang="less">
.controls-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  pointer-events: none;

  .top-bar, .bottom-bar {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
  }

  .top-bar {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    
    .book-title {
      font-weight: 700;
      font-size: 16px;
      color: #1e293b;
      flex: 1;
      text-align: center;
      margin: 0 20px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .bottom-bar {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 15px 25px 20px 25px; // Reduced padding
    display: flex;
    flex-direction: column;
    gap: 15px; // Reduced gap
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 24px 24px 0 0;

    .progress-section {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 15px;

      .progress-text {
        font-size: 12px;
        color: #64748b;
        font-weight: 600;
        min-width: 60px;
      }

      .progress-slider {
        flex: 1;
      }
    }

    .bottom-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px;

      .action-item {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s;

        &:active {
          transform: scale(0.9);
          background: rgba(64, 158, 255, 0.1);
          color: #409eff;
        }

        .el-icon {
          font-size: 24px;
        }
      }
    }
  }
}

.glass-btn {
  background: rgba(255, 255, 255, 0.5) !important;
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  color: #475569 !important;
  width: 44px !important;
  height: 44px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  &:hover {
    background: rgba(255, 255, 255, 0.8) !important;
    color: #409eff !important;
  }
}

.fade-enter-active, .fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  .top-bar { transform: translateY(-100%); }
  .bottom-bar { transform: translateY(100%); }
}
</style>
