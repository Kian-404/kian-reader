/**
 * Wi-Fi 传书 — TypeScript 桥接 API
 * 通过 Capacitor 插件启动 Android 原生 HTTP 服务器
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useLibraryStore, type Book } from '@/stores/library';
import { extractMetadata } from '@/utils/parser';

interface WifiTransferPlugin {
  startServer(options: { port: number }): Promise<{ ip: string; port: number; running: boolean }>;
  stopServer(): Promise<void>;
  getServerStatus(): Promise<{ running: boolean; ip: string; port: number; files: string[] }>;
  getUploadedFiles(): Promise<{ files: string[] }>;
}

const WifiTransfer = registerPlugin<WifiTransferPlugin>('WifiTransfer');

export interface WifiServerStatus {
  running: boolean;
  ip: string;
  port: number;
  files: string[];
}

/**
 * 是否支持 Wi-Fi 传书（仅 Android 原生平台）
 */
export const isWifiTransferAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('WifiTransfer');
};

/**
 * 启动 Wi-Fi 传书服务器
 */
export const startWifiServer = async (port = 8080): Promise<{ ip: string; port: number }> => {
  const result = await WifiTransfer.startServer({ port });
  return { ip: result.ip, port: result.port };
};

/**
 * 停止服务器
 */
export const stopWifiServer = async (): Promise<void> => {
  await WifiTransfer.stopServer();
};

/**
 * 获取服务器状态
 */
export const getWifiServerStatus = async (): Promise<WifiServerStatus> => {
  const result = await WifiTransfer.getServerStatus();
  return {
    running: result.running,
    ip: result.ip || '',
    port: result.port || 0,
    files: result.files || [],
  };
};

/**
 * 获取已上传文件列表
 */
export const getUploadedFiles = async (): Promise<string[]> => {
  const result = await WifiTransfer.getUploadedFiles();
  return result.files || [];
};

/**
 * 导入已上传的文件到书架
 * 读取缓存目录中的文件，提取元数据并存储到 IndexedDB
 */
export const importUploadedFile = async (filePath: string): Promise<{ success: boolean; title?: string; error?: string }> => {
  try {
    const fileName = filePath.split('/').pop() || 'unknown';
    const format = detectFormatByName(fileName);
    if (!format) {
      return { success: false, error: `不支持的文件格式: ${fileName}` };
    }

    // 从缓存目录读取文件
    const result = await Filesystem.readFile({
      path: `wifi-uploads/${fileName}`,
      directory: Directory.Cache,
    });

    // result.data 是 base64 字符串
    const binaryStr = atob(result.data as string);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // 创建 File 对象用于元数据提取
    const blob = new Blob([arrayBuffer]);
    const file = new File([blob], fileName);

    const libraryStore = useLibraryStore();
    const meta = await extractMetadata(file, format);

    const book: Book = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: meta.title,
      author: meta.author,
      cover: meta.cover,
      format,
      size: blob.size,
      progress: 0,
      addedAt: Date.now(),
      bookmarks: [],
      notes: [],
    };

    await libraryStore.addBook(book, arrayBuffer);

    // 清理已上传的文件
    await Filesystem.deleteFile({
      path: `wifi-uploads/${fileName}`,
      directory: Directory.Cache,
    });

    return { success: true, title: meta.title };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
};

/**
 * 根据文件名检测格式
 */
const detectFormatByName = (name: string): 'txt' | 'epub' | 'pdf' | null => {
  const lower = name.toLowerCase().trim();
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.pdf')) return 'pdf';
  return null;
};
