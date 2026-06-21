import { defineStore } from 'pinia';
import { ref } from 'vue';
import localforage from 'localforage';

export interface Bookmark {
  id: string;
  label: string;
  cfi?: string; // For EPUB
  page?: number; // For PDF
  scrollTop?: number; // For TXT
  addedAt: number;
}

export interface Note {
  id: string;
  text: string;
  comment?: string;
  cfi?: string;
  page?: number;
  color: string;
  addedAt: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: 'txt' | 'epub' | 'pdf';
  size: number;
  cover?: string;
  progress: number; // 0 to 100
  addedAt: number;
  lastReadAt?: number;
  bookmarks: Bookmark[];
  notes: Note[];
}

/**
 * 使用 Pinia 创建的图书管理状态存储
 * 用于管理图书的元数据、进度、书签和笔记等信息
 */
export const useLibraryStore = defineStore('library', () => {
  // 存储图书列表的响应式引用
  const books = ref<Book[]>([]);
  // 标记存储是否已初始化的响应式引用
  const isInitialized = ref(false);

  // Initialize store from IndexedDB (metadata)
  const initStore = async () => {
    if (isInitialized.value) return;
    
    // 1. Check for legacy localStorage data
    const legacyData = localStorage.getItem('kianer-library-metadata');
    if (legacyData) {
      try {
        const parsed = JSON.parse(legacyData);
        books.value = parsed;
        // 2. Migrate to IndexedDB immediately
        await saveMetadata();
        // 3. Clear legacy data
        localStorage.removeItem('kianer-library-metadata');
        console.log('Successfully migrated library metadata to IndexedDB');
      } catch (e) {
        console.error('Failed to migrate legacy metadata', e);
      }
    } else {
      // 4. Load from IndexedDB
      const savedBooks = await localforage.getItem<Book[]>('kianer-library-metadata');
      if (savedBooks) {
        books.value = savedBooks;
      }
    }
    
    isInitialized.value = true;
  };

  const saveMetadata = async () => {
    // Filter out potential private/circular properties starting with _
    const metadata = JSON.parse(JSON.stringify(books.value, (key, value) => {
      if (key.startsWith('_')) return undefined;
      return value;
    }));
    await localforage.setItem('kianer-library-metadata', metadata);
  };

  const addBook = async (book: Book, fileData: Blob | ArrayBuffer) => {
    // Ensure arrays exist
    if (!book.bookmarks) book.bookmarks = [];
    if (!book.notes) book.notes = [];
    // Store binary data in IndexedDB
    await localforage.setItem(`book-data-${book.id}`, fileData);
    
    // Update metadata
    books.value.push(book);
    await saveMetadata();
  };

  const removeBook = async (id: string) => {
    await localforage.removeItem(`book-data-${id}`);
    books.value = books.value.filter(b => b.id !== id);
    await saveMetadata();
  };

  const updateProgress = async (id: string, progress: number) => {
    const book = books.value.find(b => b.id === id);
    if (book) {
      book.progress = progress;
      book.lastReadAt = Date.now();
      await saveMetadata();
    }
  };

  const updateLastRead = async (id: string) => {
    const book = books.value.find(b => b.id === id);
    if (book) {
      book.lastReadAt = Date.now();
      await saveMetadata();
    }
  };

  const addBookmark = async (bookId: string, bookmark: Bookmark) => {
    const book = books.value.find(b => b.id === bookId);
    if (book) {
      if (!book.bookmarks) book.bookmarks = [];
      book.bookmarks.push(bookmark);
      await saveMetadata();
    }
  };

  const removeBookmark = async (bookId: string, bookmarkId: string) => {
    const book = books.value.find(b => b.id === bookId);
    if (book) {
      book.bookmarks = (book.bookmarks || []).filter(bm => bm.id !== bookmarkId);
      await saveMetadata();
    }
  };

  const addNote = async (bookId: string, note: Note) => {
    const book = books.value.find(b => b.id === bookId);
    if (book) {
      if (!book.notes) book.notes = [];
      book.notes.push(note);
      await saveMetadata();
    }
  };

  const removeNote = async (bookId: string, noteId: string) => {
    const book = books.value.find(b => b.id === bookId);
    if (book) {
      book.notes = (book.notes || []).filter(n => n.id !== noteId);
      await saveMetadata();
    }
  };

  const getBookData = async (id: string) => {
    return await localforage.getItem<Blob | ArrayBuffer>(`book-data-${id}`);
  };

  return {
    books,
    initStore,
    addBook,
    removeBook,
    updateProgress,
    updateLastRead,
    addBookmark,
    removeBookmark,
    addNote,
    removeNote,
    getBookData
  };
});
