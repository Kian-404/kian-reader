<template>
  <ion-page>
    <ion-header :translucent="true" class="ion-no-border">
      <ion-toolbar class="transfer-toolbar">
        <ion-buttons slot="start">
          <el-button circle @click="goBack">
            <Icon icon="solar:alt-arrow-left-linear" width="22" height="22" />
          </el-button>
        </ion-buttons>
        <ion-title>Wi-Fi 传书</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="transfer-content">
      <div class="glass-background"></div>

      <div class="transfer-container">
        <!-- 未启动状态 -->
        <div v-if="!isRunning" class="start-card glass-card">
          <div class="start-icon">
            <Icon icon="solar:wifi-linear" style="font-size: 64px" />
          </div>
          <h2 class="start-title">Wi-Fi 传书</h2>
          <p class="start-desc">
            在手机上启动服务器后，用同一局域网下的电脑浏览器打开显示的地址，即可上传书籍文件。
          </p>
          <el-button
            type="primary"
            size="large"
            round
            :loading="isStarting"
            @click="startServer"
            class="start-btn"
          >
            <Icon icon="solar:play-circle-linear" style="margin-right: 6px" />
            启动服务器
          </el-button>
        </div>

        <!-- 运行中状态 -->
        <div v-else class="running-section">
          <!-- 连接信息卡片 -->
          <div class="connection-card glass-card">
            <div class="connection-header">
              <div class="status-dot pulse"></div>
              <span class="status-text">服务器运行中</span>
            </div>

            <div class="url-card" @click="copyAddress">
              <div class="url-label">连接地址</div>
              <div class="url-value">{{ serverUrl }}</div>
              <div class="url-hint">点击复制地址</div>
            </div>

            <div class="info-row">
              <div class="info-item">
                <span class="info-label">IP 地址</span>
                <span class="info-value">{{ serverInfo.ip }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">端口</span>
                <span class="info-value">{{ serverInfo.port }}</span>
              </div>
            </div>

            <div class="usage-hint">
              <Icon icon="solar:info-circle-linear" style="font-size: 16px" />
              <span>在电脑浏览器打开上方地址，拖拽或选择文件上传</span>
            </div>
          </div>

          <!-- 已上传文件 -->
          <div class="files-section glass-card">
            <div class="files-header">
              <h3>已上传文件</h3>
              <div class="files-actions">
                <el-button text size="small" @click="refreshFiles" style="margin-right: 4px">
                  <Icon icon="solar:refresh-linear" /> 刷新
                </el-button>
                <el-button
                  v-if="uploadedFiles.length > 0"
                  text
                  size="small"
                  :loading="isImportingAll"
                  @click="importAllFiles"
                >
                  全部导入
                </el-button>
              </div>
            </div>

            <div v-if="uploadedFiles.length === 0" class="no-files">
              <Icon icon="solar:export-linear" style="font-size: 36px; opacity: 0.3" />
              <p>暂无上传文件，上传后将在此处显示</p>
            </div>

            <div v-else class="file-list">
              <div
                v-for="(f, i) in uploadedFiles"
                :key="i"
                class="file-item"
                :class="{ imported: f.imported, failed: f.error }"
              >
                <Icon
                  :icon="getFileIcon(f.name)"
                  style="font-size: 20px"
                  :class="'file-icon-' + getFileExt(f.name)"
                />
                <div class="file-info">
                  <span class="file-name">{{ f.name }}</span>
                  <span v-if="f.imported" class="file-status ok">已导入</span>
                  <span v-else-if="f.error" class="file-status fail">{{ f.error }}</span>
                  <span v-else-if="f.importing" class="file-status uploading">导入中...</span>
                  <span v-else class="file-status new">待导入</span>
                </div>
                <el-button
                  v-if="!f.imported && !f.importing && !f.error"
                  text
                  size="small"
                  :loading="f.importing"
                  @click="importFile(i)"
                >
                  导入
                </el-button>
                <el-button
                  v-if="f.error"
                  text
                  size="small"
                  @click="importFile(i)"
                >
                  重试
                </el-button>
              </div>
            </div>
          </div>

          <!-- 停止服务器 -->
          <el-button
            round
            class="stop-btn"
            @click="stopServer"
          >
            <Icon icon="solar:close-circle-linear" style="margin-right: 6px" />
            关闭服务器
          </el-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
} from '@ionic/vue';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import {
  isWifiTransferAvailable,
  startWifiServer,
  stopWifiServer,
  getWifiServerStatus,
  importUploadedFile as importFileToStore,
} from '@/utils/wifiTransfer';

const router = useRouter();
const isStarting = ref(false);
const isRunning = ref(false);
const isImportingAll = ref(false);
const serverInfo = ref({ ip: '', port: 0 });
const uploadedFiles = ref<Array<{ name: string; path: string; imported: boolean; importing: boolean; error?: string }>>([]);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const serverUrl = computed(() => {
  if (serverInfo.value.ip && serverInfo.value.port) {
    return `http://${serverInfo.value.ip}:${serverInfo.value.port}`;
  }
  return '';
});

const goBack = () => router.back();

const startServer = async () => {
  if (!isWifiTransferAvailable()) {
    ElMessage.warning('Wi-Fi 传书仅支持 Android 设备');
    return;
  }

  isStarting.value = true;
  try {
    const info = await startWifiServer(8080);
    serverInfo.value = info;
    isRunning.value = true;
    ElMessage.success('服务器已启动');
    startPolling();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error(`启动失败: ${msg}`);
  } finally {
    isStarting.value = false;
  }
};

const stopServer = async () => {
  const confirmed = await ElMessageBox.confirm(
    '关闭服务器后，正在进行的传输将中断。',
    '确认关闭',
    { confirmButtonText: '关闭', cancelButtonText: '取消', type: 'info', roundButton: true, customClass: 'glass-message-box' }
  ).catch(() => false);
  if (!confirmed) return;

  try {
    await stopWifiServer();
    isRunning.value = false;
    serverInfo.value = { ip: '', port: 0 };
    uploadedFiles.value = [];
    stopPolling();
    ElMessage.success('服务器已关闭');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error(`关闭失败: ${msg}`);
  }
};

const copyAddress = () => {
  if (serverUrl.value) {
    navigator.clipboard?.writeText(serverUrl.value);
    ElMessage.success('地址已复制');
  }
};

const startPolling = () => {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const status = await getWifiServerStatus();
      if (!status.running) {
        isRunning.value = false;
        stopPolling();
        return;
      }
      // 更新文件列表，只显示电子书文件
      let newCount = 0;
      for (const filePath of status.files) {
        const name = filePath.split('/').pop() || 'unknown';
        // 过滤：只接受 .epub .pdf .txt
        if (!/\.(epub|pdf|txt)$/i.test(name)) continue;
        if (!uploadedFiles.value.some(f => f.path === filePath)) {
          uploadedFiles.value.push({
            name,
            path: filePath,
            imported: false,
            importing: false,
          });
          newCount++;
        }
      }
      // 仅在有新文件时提示一次
      if (newCount > 0) {
        ElMessage.success(`已收到 ${newCount} 个文件`);
      }
    } catch {
      // 轮询失败忽略（网络波动等）
    }
  }, 3000);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const importFile = async (index: number) => {
  const file = uploadedFiles.value[index];
  if (!file || file.importing) return;

  file.importing = true;
  try {
    const result = await importFileToStore(file.path);
    if (result.success) {
      file.imported = true;
      file.error = undefined;
      ElMessage.success(`已导入: ${result.title}`);
    } else {
      file.error = result.error || '导入失败';
    }
  } catch (e) {
    file.error = e instanceof Error ? e.message : '导入失败';
  } finally {
    file.importing = false;
  }
};

const importAllFiles = async () => {
  isImportingAll.value = true;
  const pending = uploadedFiles.value.filter(f => !f.imported && !f.importing);
  let successCount = 0;
  let failCount = 0;

  for (const file of pending) {
    const idx = uploadedFiles.value.indexOf(file);
    await importFile(idx);
    if (uploadedFiles.value[idx].imported) {
      successCount++;
    } else {
      failCount++;
    }
  }

  if (successCount > 0) {
    ElMessage.success(`成功导入 ${successCount} 本`);
  }
  if (failCount > 0) {
    ElMessage.warning(`${failCount} 本导入失败`);
  }
  isImportingAll.value = false;
};

const refreshFiles = async () => {
  try {
    const status = await getWifiServerStatus();
    if (!status.running) return;
    let newCount = 0;
    for (const filePath of status.files) {
      const name = filePath.split('/').pop() || 'unknown';
      if (!/\.(epub|pdf|txt)$/i.test(name)) continue;
      if (!uploadedFiles.value.some(f => f.path === filePath)) {
        uploadedFiles.value.push({
          name,
          path: filePath,
          imported: false,
          importing: false,
        });
        newCount++;
      }
    }
    if (newCount > 0) {
      ElMessage.success(`已收到 ${newCount} 个文件`);
    } else if (uploadedFiles.value.length === 0) {
      ElMessage.info('暂无文件');
    }
  } catch (e) {
    console.error('refreshFiles error:', e);
  }
};

const getFileExt = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ext;
};

const getFileIcon = (name: string) => {
  const ext = getFileExt(name);
  if (ext === 'epub') return 'solar:notebook-linear';
  if (ext === 'pdf') return 'solar:file-pdf-linear';
  if (ext === 'txt') return 'solar:document-text-linear';
  return 'solar:document-text-linear';
};

onUnmounted(() => {
  stopPolling();
  // 离开页面时自动关闭服务器，防止端口被占用
  stopWifiServer().catch(() => {});
});
</script>

<style scoped lang="less">
.transfer-toolbar {
  --background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.transfer-content {
  --background: #f4f7f6;
  position: relative;

  .glass-background {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);
    opacity: 0.12;
    z-index: -1;
  }
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
}

.transfer-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

// ── Start Card ──

.start-card {
  width: 100%;
  max-width: 400px;
  padding: 48px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .start-icon {
    color: #409eff;
    opacity: 0.8;
  }

  .start-title {
    font-size: 22px;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
  }

  .start-desc {
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
    margin: 0;
    max-width: 320px;
  }

  .start-btn {
    margin-top: 12px;
    padding: 0 28px;
  }
}

// ── Running Section ──

.running-section {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.connection-card {
  width: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .connection-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #10b981;
    flex-shrink: 0;

    &.pulse {
      animation: pulse 2s infinite;
    }
  }

  .status-text {
    font-size: 15px;
    font-weight: 600;
    color: #10b981;
  }

  .url-card {
    background: rgba(64, 158, 255, 0.06);
    border: 1px solid rgba(64, 158, 255, 0.15);
    border-radius: 14px;
    padding: 16px;
    text-align: center;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(64, 158, 255, 0.1);
    }

    &:active {
      transform: scale(0.98);
    }

    .url-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 6px;
    }

    .url-value {
      font-size: 18px;
      font-weight: 800;
      color: #409eff;
      font-family: 'SF Mono', 'Fira Code', monospace;
      letter-spacing: 0.5px;
    }

    .url-hint {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 6px;
    }
  }

  .info-row {
    display: flex;
    gap: 12px;

    .info-item {
      flex: 1;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;

      .info-label {
        font-size: 11px;
        color: #94a3b8;
      }

      .info-value {
        font-size: 16px;
        font-weight: 700;
        color: #1e293b;
        font-family: 'SF Mono', 'Fira Code', monospace;
      }
    }
  }

  .usage-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
  }
}

// ── Files Section ──

.files-section {
  width: 100%;
  padding: 20px;

  .files-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #334155;
    }

    .files-actions {
      display: flex;
      align-items: center;
    }
  }

  .no-files {
    padding: 32px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    font-size: 13px;

    p {
      margin: 0;
    }
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .file-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.02);
      transition: background 0.2s;

      &:hover {
        background: rgba(0, 0, 0, 0.04);
      }

      &.imported {
        opacity: 0.6;
      }

      .file-icon-epub { color: #10b981; }
      .file-icon-pdf { color: #ef4444; }
      .file-icon-txt { color: #f59e0b; }

      .file-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;

        .file-name {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-status {
          font-size: 11px;
          font-weight: 600;

          &.ok { color: #10b981; }
          &.fail { color: #ef4444; }
          &.uploading { color: #f59e0b; }
          &.new { color: #409eff; }
        }
      }
    }
  }
}

.stop-btn {
  margin-top: 8px;
  min-width: 200px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
