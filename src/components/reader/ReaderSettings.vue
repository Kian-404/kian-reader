<template>
  <div class="settings-content">
    <div class="setting-item">
      <span class="label">背景主题</span>
      <div class="theme-picker">
        <button
          v-for="t in themes"
          :key="t.name"
          :class="['theme-opt', t.name, { active: readerStore.theme === t.name }]"
          :title="t.label"
          :aria-label="`切换到${t.label}主题`"
          @click="handleThemeChange(t.name as any)"
        ></button>
      </div>
    </div>
    
    <div class="setting-item">
      <span class="label">翻页方式</span>
      <el-radio-group 
        v-model="readerStore.paginationMode" 
        size="small" 
        @change="$emit('pagination-change')"
      >
        <el-radio-button value="horizontal">仿真左右</el-radio-button>
        <el-radio-button value="vertical">连续上下</el-radio-button>
      </el-radio-group>
    </div>

    <div class="setting-item">
      <span class="label">字体大小</span>
      <div class="font-size-ctrl">
        <el-button 
          circle 
          size="small" 
          :disabled="readerStore.fontSize <= 12"
          @click="changeFontSize(-1)"
        >
          <template #icon>
            <Icon icon="solar:minus-circle-linear" style="font-size: 18px" />
          </template>
        </el-button>
        <span class="size-val">{{ readerStore.fontSize }}</span>
        <el-button 
          circle 
          size="small" 
          :disabled="readerStore.fontSize >= 40"
          @click="changeFontSize(1)"
        >
          <template #icon>
            <Icon icon="solar:add-circle-linear" style="font-size: 18px" />
          </template>
        </el-button>
      </div>
    </div>

    <div class="setting-item font-family-item">
      <span class="label">阅读字体</span>
      <div class="font-family-picker">
        <button
          v-for="f in fonts" 
          :key="f.value" 
          :class="['font-opt', { active: readerStore.fontFamily === f.value }]"
          :style="{ fontFamily: f.value }"
          :aria-label="`选择${f.label}字体`"
          @click="changeFontFamily(f.value)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div class="setting-item">
      <span class="label">屏幕亮度</span>
      <div class="brightness-ctrl">
        <Icon icon="solar:sun-linear" class="sun-icon" style="font-size: 20px" />
        <el-slider 
          v-model="readerStore.brightness" 
          :min="30" 
          :max="100" 
          :step="5"
          :show-tooltip="false"
          @input="handleBrightnessChange"
        />
        <span class="brightness-value">{{ readerStore.brightness }}%</span>
      </div>
    </div>

    <div class="setting-item pdf-zoom-item">
      <span class="label">PDF 缩放</span>
      <div class="zoom-ctrl">
        <el-button
          circle
          size="small"
          :disabled="readerStore.pdfScale <= 0.5"
          @click="changePdfZoom(-0.1)"
        >
          <template #icon>
            <Icon icon="solar:minus-circle-linear" style="font-size: 18px" />
          </template>
        </el-button>
        <span class="zoom-val">{{ Math.round(readerStore.pdfScale * 100) }}%</span>
        <el-button
          circle
          size="small"
          :disabled="readerStore.pdfScale >= 3.0"
          @click="changePdfZoom(0.1)"
        >
          <template #icon>
            <Icon icon="solar:add-circle-linear" style="font-size: 18px" />
          </template>
        </el-button>
        <el-button size="small" @click="resetPdfZoom" class="reset-btn">重置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useReaderStore } from '@/stores/reader';
import { Icon } from '@iconify/vue';

const readerStore = useReaderStore();

/**
 * 主题配置
 */
const themes = [
  { name: 'day', label: '明亮' },
  { name: 'sepia', label: '护眼' },
  { name: 'night', label: '深色' }
];

/**
 * 字体配置
 */
const fonts = [
  { label: '系统', value: 'system-ui' },
  { label: '衬线', value: 'serif' },
  { label: '无衬线', value: 'sans-serif' },
  { label: '等宽', value: 'monospace' }
];

const emit = defineEmits<{
  (e: 'pagination-change'): void;
  (e: 'size-change'): void;
  (e: 'font-change'): void;
  (e: 'zoom-change'): void;
}>();

/**
 * 处理主题切换
 * 确保每次切换都能正确应用主题
 * @param themeName 主题名称
 */
const handleThemeChange = (themeName: string) => {
  // 如果切换到相同主题，先切换到其他主题再切换回来，确保触发重新渲染
  if (readerStore.theme === themeName) {
    return;
  }
  
  // 直接设置主题
  readerStore.setTheme(themeName as any);
  
  // 触发主题变更事件（如果需要额外操作）
  // 可在此添加主题切换的动画或其他效果
};

/**
 * 改变字体大小
 * @param delta 变化值（-1 或 +1）
 */
const changeFontSize = (delta: number) => {
  const newSize = readerStore.fontSize + delta;
  // 限制字体大小范围：12px - 40px
  if (newSize >= 12 && newSize <= 40) {
    readerStore.fontSize = newSize;
    emit('size-change');
  }
};

/**
 * 改变字体族
 * @param font 字体值
 */
const changeFontFamily = (font: string) => {
  readerStore.fontFamily = font;
  emit('font-change');
};

/**
 * 处理亮度变化
 * 确保亮度不低于 30%
 * @param value 亮度值
 */
const handleBrightnessChange = (value: number) => {
  // 限制最小亮度为 30%
  if (value < 30) {
    readerStore.brightness = 30;
  } else if (value > 100) {
    readerStore.brightness = 100;
  }
};

const changePdfZoom = (delta: number) => {
  const newZoom = Math.round((readerStore.pdfScale + delta) * 10) / 10;
  if (newZoom >= 0.5 && newZoom <= 3.0) {
    (readerStore as any).pdfScale = newZoom;
    emit('zoom-change');
  }
};

const resetPdfZoom = () => {
  (readerStore as any).pdfScale = 1.0;
  emit('zoom-change');
};
</script>

<style scoped lang="less">
.settings-content {
  padding: 10px 5px;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .label {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
  }
}

.theme-picker {
  display: flex;
  gap: 15px;
  
  .theme-opt {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 0;
    background: transparent;

    &:hover {
      transform: translateY(-2px);
    }

    &.active {
      border-color: #409eff;
      transform: scale(1.1);
    }

    &.day {
      background: #ffffff;
      border: 1px solid #e2e8f0;

      &.active {
        border-color: #409eff;
      }
    }

    &.sepia {
      background: #f4ecd8;
    }

    &.night {
      background: #1a1a1a;
    }
  }
}

.font-size-ctrl {
  display: flex;
  align-items: center;
  gap: 15px;
  background: rgba(0, 0, 0, 0.03);
  padding: 4px 12px;
  border-radius: 20px;

  .size-val {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    min-width: 24px;
    text-align: center;
  }

  :deep(.el-button) {
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.font-family-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.font-family-picker {
  display: flex;
  gap: 10px;
  width: 100%;
  overflow-x: auto;
  padding: 2px 0;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .font-opt {
    flex: 1;
    min-width: 70px;
    text-align: center;
    padding: 8px 0;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #64748b;
    transition: all 0.2s;
    border: 1px solid transparent;
    cursor: pointer;

    &:hover {
      background: rgba(64, 158, 255, 0.06);
    }

    &.active {
      background: rgba(64, 158, 255, 0.1);
      color: #409eff;
      border-color: rgba(64, 158, 255, 0.3);
      font-weight: 700;
    }
  }
}

.brightness-ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0.6;

  .sun-icon {
    color: #f39c12;
    font-size: 18px;
    flex-shrink: 0;
  }

  .brightness-value {
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
    min-width: 35px;
    text-align: right;
  }

  :deep(.el-slider) {
    --el-slider-main-bg-color: #f39c12;
    flex: 1;

    .el-slider__runway {
      background: linear-gradient(to right, rgba(243, 156, 18, 0.2), rgba(243, 156, 18, 0.4));
    }

    .el-slider__bar {
      background: linear-gradient(to right, #f39c12, #f1c40f);
    }

    .el-slider__button {
      border-color: #f39c12;
    }
  }

  .reset-btn {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 10px;
  }
}

.zoom-ctrl {
  display: flex;
  align-items: center;
  gap: 12px;

  .zoom-val {
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
    min-width: 40px;
    text-align: center;
  }
}
html.ion-palette-dark {
  .settings-content {
    .label {
      color: #cbd5e1;
    }
  }

  .theme-picker {
    .theme-opt {
      &.day {
        background: #f1f5f9;
      }

      &.night {
        background: #0f0f0f;
      }
    }
  }

  .font-size-ctrl {
    background: rgba(255, 255, 255, 0.05);

    .size-val {
      color: #f1f5f9;
    }
  }

  .font-family-picker {
    .font-opt {
      background: rgba(255, 255, 255, 0.05);
      color: #cbd5e1;

      &:hover {
        background: rgba(64, 158, 255, 0.1);
      }

      &.active {
        background: rgba(64, 158, 255, 0.2);
        color: #60a5fa;
        border-color: rgba(96, 165, 250, 0.3);
      }
    }
  }

  .brightness-ctrl {
    .sun-icon {
      color: #fbbf24;
    }

    .brightness-value {
      color: #cbd5e1;
    }

    :deep(.el-slider) {
      --el-slider-main-bg-color: #fbbf24;

      .el-slider__button {
        border-color: #fbbf24;
      }
    }
  }

  .zoom-ctrl {
    .zoom-val {
      color: #cbd5e1;
    }
  }
}
</style>