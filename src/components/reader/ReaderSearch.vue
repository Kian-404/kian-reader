<template>
  <div class="search-container">
    <div class="search-header">
      <el-input
        v-model="searchInput"
        placeholder="输入关键词..."
        clearable
        @keyup.enter="doSearch"
        class="search-input"
      >
        <template #prefix>
          <Icon icon="solar:magnifer-linear" style="font-size: 18px" />
        </template>
        <template #append>
          <el-button @click="doSearch">搜索</el-button>
        </template>
      </el-input>
    </div>
    
    <div class="results-container" v-loading="loading">
      <div v-if="loading" class="search-progress">
        <el-icon class="is-loading"><Icon icon="solar:spinner-linear" /></el-icon>
        <span>正在检索: {{ searchStatus }}</span>
      </div>
      <div v-if="results.length === 0 && searchInput && !loading" class="empty-state">
        <p>未找到相关内容</p>
      </div>
      <div v-else class="results-list">
        <div 
          v-for="(res, idx) in results" 
          :key="idx" 
          class="result-item"
          @click="$emit('jump', res)"
        >
          <p class="excerpt" v-html="res.excerpt || res.text"></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';

interface SearchResult {
  text: string;
  excerpt?: string;
  cfi?: string;
  page?: number;
}

const props = defineProps<{
  bookFormat?: string;
  txtContent?: string;
  rendition?: any;
}>();

defineEmits<{
  (e: 'jump', res: SearchResult): void;
}>();

const searchInput = ref('');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const searchStatus = ref('');
const MAX_RESULTS = 100;

/** 转义用户输入中的正则特殊字符，防止 new RegExp 崩溃 */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text: string, query: string) =>
  text.replace(new RegExp(escapeRegex(query), 'gi'), (m: string) => `<mark>${m}</mark>`);

const doSearch = async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  
  loading.value = true;
  results.value = [];
  searchStatus.value = '准备中...';

  try {
    const searchResults: SearchResult[] = [];
    const pushSafe = (item: SearchResult) => {
      if (searchResults.length >= MAX_RESULTS) return;
      searchResults.push(item);
    };

    if (props.bookFormat === 'epub' && props.rendition) {
      const epub = (props.rendition as any).book;
      const total = epub.spine.spineItems.length;
      let current = 0;
      
      for (const item of epub.spine.spineItems) {
        if (searchResults.length >= MAX_RESULTS) {
          searchStatus.value = `已达 ${MAX_RESULTS} 条上限`;
          break;
        }
        current++;
        searchStatus.value = `第 ${current} / ${total} 章节`;
        try {
          await item.load(epub.load.bind(epub));
          const body = item.document?.body;
          if (!body) { item.unload(); continue; }
          const text = body.textContent || '';
          const regex = new RegExp(escapeRegex(query), 'gi');
          let match;
          while ((match = regex.exec(text)) !== null && searchResults.length < MAX_RESULTS) {
            const start = Math.max(0, match.index - 30);
            const end = Math.min(text.length, match.index + match[0].length + 30);
            const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
            searchResults.push({
              text: match[0],
              excerpt: highlightText(excerpt, query),
              cfi: item.cfiBase + '!' // 跳转到章节开头
            });
          }
          item.unload();
        } catch (err) {
          console.warn('Failed to search chapter:', item.href, err);
        }
      }
      results.value = searchResults;
    } else if (props.bookFormat === 'txt' && props.txtContent) {
      searchStatus.value = '正在检索全文...';
      // 必须与 useTxtEngine.ts 中的 CHARS_PER_PAGE 保持一致
      const CHARS_PER_PAGE = 1200;
      const lines = props.txtContent.split('\n');
      let charOffset = 0;
      for (let i = 0; i < lines.length && searchResults.length < MAX_RESULTS; i++) {
        if (lines[i].toLowerCase().includes(query.toLowerCase())) {
          pushSafe({
            text: highlightText(lines[i], query),
            page: Math.floor(charOffset / CHARS_PER_PAGE)
          });
        }
        charOffset += lines[i].length + 1;
      }
      results.value = searchResults;
    } else if (props.bookFormat === 'pdf' && (window as any).pdfDoc) {
      const pdf = (window as any).pdfDoc;
      const total = pdf.numPages;
      
      for (let i = 1; i <= total && searchResults.length < MAX_RESULTS; i++) {
        searchStatus.value = `第 ${i} / ${total} 页`;
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        const text = strings.join(' ');
        
        if (text.toLowerCase().includes(query.toLowerCase())) {
          pushSafe({
            text,
            excerpt: highlightText(text, query),
            page: i
          });
        }
      }
      results.value = searchResults;
    } else {
      ElMessage.warning('当前格式暂不支持搜索');
    }

    if (searchResults.length >= MAX_RESULTS) {
      ElMessage.info(`已显示前 ${MAX_RESULTS} 条结果，请精确搜索以获取更多`);
    }
  } catch (e) {
    console.error('Search failed', e);
    ElMessage.error('搜索失败');
  } finally {
    searchStatus.value = '';
    loading.value = false;
  }
};
</script>

<style scoped lang="less">
.search-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-header {
  padding: 0 15px 20px 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.search-input {
  --el-input-bg-color: rgba(255, 255, 255, 0.5);
  --el-input-border-color: transparent;
  --el-input-hover-border-color: transparent;
  --el-input-focus-border-color: transparent;
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.6);
  }

  &:focus-within {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(64, 158, 255, 0.4);
    box-shadow: 0 8px 30px rgba(64, 158, 255, 0.12);
  }

  :deep(.el-input__wrapper) {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 16px;

    &.is-focus {
      box-shadow: none !important;
    }
  }

  :deep(.el-input-group__append) {
    background: rgba(64, 158, 255, 0.05);
    box-shadow: none;
    border: none;
    border-left: 1px solid rgba(0, 0, 0, 0.03);
    padding: 0;

    .el-button {
      margin: 0;
      border: none;
      height: 100%;
      padding: 0 25px;
      color: #409eff;
      font-weight: 700;
      font-size: 14px;
      border-radius: 0;
      transition: all 0.2s;

      &:hover {
        background: rgba(64, 158, 255, 0.1);
      }
    }
  }
}

/* Dark Mode Support */
:global(html.dark), :global(html.ion-palette-dark) {
  .search-input {
    --el-input-bg-color: rgba(30, 41, 59, 0.4);
    border-color: rgba(255, 255, 255, 0.1);
    
    &:focus-within {
      background: rgba(30, 41, 59, 0.6);
      border-color: rgba(64, 158, 255, 0.3);
    }

    :deep(.el-input-group__append .el-button) {
      background: rgba(64, 158, 255, 0.15);
    }
  }
  
  .result-item {
    border-bottom-color: rgba(255, 255, 255, 0.05);
    .excerpt { color: #94a3b8; }
    &:active { background: rgba(64, 158, 255, 0.1); }
  }
}

.results-container {
  flex: 1;
  overflow-y: auto;
}

.search-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: #409eff;
  font-size: 14px;
  font-weight: 600;
  background: rgba(64, 158, 255, 0.05);
  margin: 10px 15px;
  border-radius: 12px;

  .el-icon {
    font-size: 18px;
  }
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 14px;
}

.result-item {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: rgba(64, 158, 255, 0.05);
  }

  .excerpt {
    font-size: 14px;
    line-height: 1.6;
    color: #475569;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;

    :deep(mark) {
      background: #ffe082;
      color: #d84315;
      padding: 0 2px;
      border-radius: 2px;
    }
  }
}
</style>
