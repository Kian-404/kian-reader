import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using the local file we copied to public
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export interface BookMetadata {
  title: string;
  author: string;
  cover?: string;
}

export const extractMetadata = async (file: File, format: 'txt' | 'epub' | 'pdf'): Promise<BookMetadata> => {
  const metadata: BookMetadata = {
    title: file.name.replace(/\.[^/.]+$/, ""),
    author: '未知作者'
  };

  try {
    if (format === 'epub') {
      const book = ePub(await file.arrayBuffer());
      const meta = await book.loaded.metadata;
      metadata.title = meta.title || metadata.title;
      metadata.author = meta.creator || metadata.author;
      
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        // coverUrl from epubjs is often a blob: URL, which is destroyed on page reload.
        // We must convert it to a base64 Data URL for persistent storage in IndexedDB.
        try {
          const response = await fetch(coverUrl);
          const blob = await response.blob();
          metadata.cover = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('Failed to convert EPUB cover blob to base64', e);
          metadata.cover = coverUrl; // fallback
        }
      }
    } else if (format === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const info = await pdf.getMetadata();
      
      if (info.info) {
        metadata.title = (info.info as any).Title || metadata.title;
        metadata.author = (info.info as any).Author || metadata.author;
      }

      // Extract first page as cover
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        metadata.cover = canvas.toDataURL();
      }
    }
  } catch (error) {
    console.error('Metadata extraction failed:', error);
  }

  return metadata;
};
