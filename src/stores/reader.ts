import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { READING_THEMES, type ThemeName } from '@/theme/readingThemes';

export type PaginationMode = 'horizontal' | 'vertical';

/**
 * 阅读器状态管理 store
 * 使用 Pinia 管理阅读器设置，自动持久化到 localStorage
 */
export const useReaderStore = defineStore('reader', () => {
  // ── 状态 ──

  /** 字体大小 */
  const fontSize = ref(Number(localStorage.getItem('reader-font-size')) || 18);
  /** 阅读主题 */
  const theme = ref<ThemeName>(
    (localStorage.getItem('reader-theme') as ThemeName) || 'day',
  );
  /** 行高 */
  const lineHeight = ref(Number(localStorage.getItem('reader-line-height')) || 1.6);
  /** 字体族 */
  const fontFamily = ref(localStorage.getItem('reader-font-family') || 'sans-serif');
  /** 屏幕亮度覆盖（30–100） */
  const brightness = ref(Number(localStorage.getItem('reader-brightness')) || 100);
  /** 分页模式 */
  const paginationMode = ref<PaginationMode>(
    (localStorage.getItem('reader-pagination-mode') as PaginationMode) || 'horizontal',
  );
  /** PDF 缩放比例 */
  const pdfScale = ref(Number(localStorage.getItem('reader-pdf-scale')) || 1.0);

  // ── 衍生 ──

  /** 当前主题的 CSS 变量键值对 */
  const themeVars = computed(() => READING_THEMES[theme.value]?.vars ?? READING_THEMES.day.vars);

  // ── 副作用：自动持久化 ──

  watch(
    [fontSize, theme, lineHeight, fontFamily, brightness, paginationMode, pdfScale],
    () => {
      localStorage.setItem('reader-font-size', fontSize.value.toString());
      localStorage.setItem('reader-theme', theme.value);
      localStorage.setItem('reader-line-height', lineHeight.value.toString());
      localStorage.setItem('reader-font-family', fontFamily.value);
      localStorage.setItem('reader-brightness', brightness.value.toString());
      localStorage.setItem('reader-pagination-mode', paginationMode.value);
      localStorage.setItem('reader-pdf-scale', pdfScale.value.toString());
    },
  );

  // ── 方法 ──

  const setFontSize = (size: number) => {
    fontSize.value = size;
  };

  const setTheme = (newTheme: ThemeName) => {
    theme.value = newTheme;
  };

  return {
    fontSize,
    theme,
    themeVars,
    lineHeight,
    fontFamily,
    brightness,
    paginationMode,
    pdfScale,
    setFontSize,
    setTheme,
  };
});
