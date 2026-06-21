import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ReaderTheme = 'day' | 'night' | 'sepia';
export type PaginationMode = 'horizontal' | 'vertical';

/**
 * 阅读器状态管理store
 * 使用Pinia进行状态管理，用于管理阅读器的各种设置
 */
export const useReaderStore = defineStore('reader', () => {
  // 字体大小设置，从localStorage中获取，默认为18
  const fontSize = ref(Number(localStorage.getItem('reader-font-size')) || 18);
  // 主题设置，从localStorage中获取，默认为'day'主题
  const theme = ref<ReaderTheme>((localStorage.getItem('reader-theme') as ReaderTheme) || 'day');
  // 行高设置，从localStorage中获取，默认为1.6
  const lineHeight = ref(Number(localStorage.getItem('reader-line-height')) || 1.6);
  // 字体族设置，从localStorage中获取，默认为'sans-serif'
  const fontFamily = ref(localStorage.getItem('reader-font-family') || 'sans-serif');
  // 亮度设置，从localStorage中获取，默认为100
  const brightness = ref(Number(localStorage.getItem('reader-brightness')) || 100);
  // 分页模式设置，从localStorage中获取，默认为'horizontal'
  const paginationMode = ref<PaginationMode>((localStorage.getItem('reader-pagination-mode') as PaginationMode) || 'horizontal');
  // PDF 缩放比例，从localStorage中获取，默认为1.0
  const pdfScale = ref(Number(localStorage.getItem('reader-pdf-scale')) || 1.0);

  // 监听所有设置变化，当变化时自动更新localStorage
  watch([fontSize, theme, lineHeight, fontFamily, brightness, paginationMode, pdfScale], () => {
    localStorage.setItem('reader-font-size', fontSize.value.toString());
    localStorage.setItem('reader-theme', theme.value);
    localStorage.setItem('reader-line-height', lineHeight.value.toString());
    localStorage.setItem('reader-font-family', fontFamily.value);
    localStorage.setItem('reader-brightness', brightness.value.toString());
    localStorage.setItem('reader-pagination-mode', paginationMode.value);
    localStorage.setItem('reader-pdf-scale', pdfScale.value.toString());
  });

  // 设置字体大小的方法
  const setFontSize = (size: number) => {
    fontSize.value = size;
  };

  // 设置主题的方法
  const setTheme = (newTheme: ReaderTheme) => {
    theme.value = newTheme;
  };

  // 返回store中的所有状态和方法
  return {
    fontSize,
    theme,
    lineHeight,
    fontFamily,
    brightness,
    paginationMode,
    pdfScale,
    setFontSize,
    setTheme
  };
});
