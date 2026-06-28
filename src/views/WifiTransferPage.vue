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
      <div class="bg-decor"></div>

      <div class="page-body">

        <!-- ===== 未开始 ===== -->
        <div v-if="!isRunning" class="welcome-card">
          <div class="welcome-icon">
            <Icon icon="solar:wifi-linear" style="font-size: 56px" />
          </div>
          <h2 class="welcome-title">无线传书</h2>
          <p class="welcome-desc">
            用电脑把电子书传到手机上，<br />
            不用数据线，不用装任何软件。
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
            开始传书
          </el-button>

          <div class="steps">
            <div class="step">
              <span class="step-num">1</span>
              <span class="step-text">点一下「开始传书」</span>
            </div>
            <div class="step-arrow">
              <Icon icon="solar:alt-arrow-down-linear" />
            </div>
            <div class="step">
              <span class="step-num">2</span>
              <span class="step-text">在电脑浏览器输入出现的地址</span>
            </div>
            <div class="step-arrow">
              <Icon icon="solar:alt-arrow-down-linear" />
            </div>
            <div class="step">
              <span class="step-num">3</span>
              <span class="step-text">选书上传，自动导入到书架</span>
            </div>
          </div>
        </div>

        <!-- ===== 已开始 ===== -->
        <div v-else class="active-section">

          <!-- 地址卡片 -->
          <div class="address-card">
            <div class="address-badge">
              <span class="dot-pulse"></span>
              就绪
            </div>
            <div class="address-box" @click="copyAddress">
              <div class="address-label">在电脑浏览器输入这个地址</div>
              <div class="address-value">{{ serverUrl }}</div>
              <div class="address-hint">点击复制地址</div>
            </div>
          </div>

          <!-- 操作指引 -->
          <div class="guide-card">
            <div class="guide-title">接下来怎么做</div>
            <div class="guide-step">
              <span class="guide-num">1</span>
              <span>打开电脑，连上同一个 Wi-Fi</span>
            </div>
            <div class="guide-step">
              <span class="guide-num">2</span>
              <span>打开 Chrome / Edge / Safari</span>
            </div>
            <div class="guide-step">
              <span class="guide-num">3</span>
              <span>输入上面的地址，上传电子书</span>
            </div>
          </div>

          <!-- 已上传文件 -->
          <div class="files-card">
            <div class="files-header">
              <span>收到的电子书</span>
              <div class="files-actions">
                <el-button text size="small" @click="refreshFiles">
                  <Icon icon="solar:refresh-linear" style="margin-right: 3px" />刷新
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

            <div v-if="uploadedFiles.length === 0" class="files-empty">
              <Icon icon="solar:upload-linear" style="font-size: 32px; opacity: 0.25" />
              <p>等电脑上传文件后会出现在这里</p>
            </div>

            <div v-else class="files-list">
              <div
                v-for="(f, i) in uploadedFiles"
                :key="i"
                class="file-row"
                :class="{ done: f.imported, fail: f.error }"
              >
                <Icon
                  :icon="getFileIcon(f.name)"
                  style="font-size: 20px"
                  :class="'ext-' + getFileExt(f.name)"
                />
                <div class="file-meta">
                  <span class="file-name">{{ f.name }}</span>
                  <span v-if="f.imported" class="file-tag ok">已导入</span>
                  <span v-else-if="f.error" class="file-tag err">{{ f.error }}</span>
                  <span v-else-if="f.importing" class="file-tag ing">导入中…</span>
                  <span v-else class="file-tag wait">等待导入</span>
                </div>
                <el-button
                  v-if="!f.imported && !f.importing && !f.error"
                  text
                  size="small"
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

          <!-- 关闭 -->
          <el-button round class="stop-btn" @click="stopServer">
            <Icon icon="solar:close-circle-linear" style="margin-right: 6px" />
            完成传书
          </el-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
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
const uploadedFiles = ref<WifiFile[]>([]);
let pollTimer: ReturnType<typeof setInterval> | null = null;

interface WifiFile {
  name: string;
  path: string;
  imported: boolean;
  importing: boolean;
  error?: string;
}

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
    ElMessage.success('已就绪，可以传书了');
    startPolling();
  } catch (e) {
    ElMessage.error('启动失败，请重试');
  } finally {
    isStarting.value = false;
  }
};

const stopServer = async () => {
  const confirmed = await ElMessageBox.confirm(
    '关闭后电脑将无法继续上传，确定吗？',
    '结束传书',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info', roundButton: true, customClass: 'glass-message-box' }
  ).catch(() => false);
  if (!confirmed) return;

  try {
    await stopWifiServer();
    isRunning.value = false;
    serverInfo.value = { ip: '', port: 0 };
    uploadedFiles.value = [];
    stopPolling();
    ElMessage.success('已关闭');
  } catch {
    ElMessage.error('关闭失败');
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
      let newCount = 0;
      for (const filePath of status.files) {
        const name = filePath.split('/').pop() || 'unknown';
        if (!/\.(epub|pdf|txt)$/i.test(name)) continue;
        if (!uploadedFiles.value.some(f => f.path === filePath)) {
          uploadedFiles.value.push({ name, path: filePath, imported: false, importing: false });
          newCount++;
        }
      }
      if (newCount > 0) {
        ElMessage.success(`收到 ${newCount} 本电子书`);
      }
    } catch { /* ignore */ }
  }, 3000);
};

const stopPolling = () => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
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
    file.error = '导入失败';
  } finally {
    file.importing = false;
  }
};

const importAllFiles = async () => {
  isImportingAll.value = true;
  const pending = uploadedFiles.value.filter(f => !f.imported && !f.importing);
  let ok = 0, fail = 0;
  for (const file of pending) {
    const idx = uploadedFiles.value.indexOf(file);
    await importFile(idx);
    if (uploadedFiles.value[idx].imported) ok++; else fail++;
  }
  if (ok > 0) ElMessage.success(`成功导入 ${ok} 本`);
  if (fail > 0) ElMessage.warning(`${fail} 本导入失败`);
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
        uploadedFiles.value.push({ name, path: filePath, imported: false, importing: false });
        newCount++;
      }
    }
    if (newCount > 0) ElMessage.success(`收到 ${newCount} 本`);
    else if (uploadedFiles.value.length === 0) ElMessage.info('还没有文件');
  } catch { /* ignore */ }
};

const getFileExt = (name: string) => (name.split('.').pop()?.toLowerCase() || '');
const getFileIcon = (name: string) => {
  const ext = getFileExt(name);
  if (ext === 'epub') return 'solar:notebook-linear';
  if (ext === 'pdf') return 'solar:file-pdf-linear';
  return 'solar:document-text-linear';
};

onUnmounted(() => {
  stopPolling();
  stopWifiServer().catch(() => {});
});
</script>

<style scoped lang="less">
.transfer-toolbar {
  --background: #fff;
}
.transfer-content {
  --background: #f4f7f6;
}
.bg-decor {
  position: fixed; inset: 0; z-index: -1;
  background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);
  opacity: 0.1;
}
.page-body {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* ── 开始前 ── */
.welcome-card {
  width: 100%; max-width: 380px;
  background: #fff;
  border-radius: 20px;
  padding: 40px 28px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.welcome-icon { color: #409eff; margin-bottom: 8px; }
.welcome-title { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 8px; }
.welcome-desc {
  font-size: 14px; color: #64748b; line-height: 1.7; margin: 0 0 20px;
}
.start-btn { padding: 0 32px; }

.steps {
  margin-top: 28px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.step {
  display: flex; align-items: center; gap: 10px;
  background: #f8fafc; border-radius: 12px; padding: 10px 18px;
  width: 100%; box-sizing: border-box;
}
.step-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: #409eff; color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.step-text { font-size: 13px; color: #334155; font-weight: 500; }
.step-arrow { color: #94a3b8; font-size: 14px; }

/* ── 已开始 ── */
.active-section {
  width: 100%; max-width: 420px;
  display: flex; flex-direction: column; gap: 16px; align-items: center;
}

.address-card {
  width: 100%;
  background: #fff; border-radius: 20px; padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.address-badge {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 600; color: #10b981; margin-bottom: 16px;
}
.dot-pulse {
  width: 8px; height: 8px; border-radius: 50%; background: #10b981;
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

.address-box {
  background: rgba(64,158,255,0.05); border: 1px solid rgba(64,158,255,0.12);
  border-radius: 14px; padding: 16px; text-align: center; cursor: pointer;
}
.address-label { font-size: 12px; color: #64748b; margin-bottom: 6px; }
.address-value {
  font-size: 18px; font-weight: 700; color: #409eff;
  letter-spacing: 0.5px; word-break: break-all;
}
.address-hint { font-size: 11px; color: #94a3b8; margin-top: 6px; }

.guide-card {
  width: 100%;
  background: #fff; border-radius: 20px; padding: 20px 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.guide-title { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
.guide-step {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0; font-size: 13px; color: #475569;
}
.guide-num {
  width: 20px; height: 20px; border-radius: 50%;
  background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* ── 文件列表 ── */
.files-card {
  width: 100%;
  background: #fff; border-radius: 20px; padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.files-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 12px;
}
.files-actions { display: flex; gap: 4px; }
.files-empty {
  text-align: center; padding: 24px 0; color: #94a3b8; font-size: 13px;
  p { margin: 8px 0 0; }
}
.file-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 0; border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
  &.done { opacity: 0.6; }
}
.file-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.file-name { font-size: 13px; color: #334155; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-tag { font-size: 11px; font-weight: 600; &.ok { color: #10b981; } &.err { color: #ef4444; } &.ing { color: #409eff; } &.wait { color: #94a3b8; } }
.ext-epub { color: #8b5cf6; } .ext-pdf { color: #ef4444; } .ext-txt { color: #64748b; }

.stop-btn { margin-top: 4px; }
</style>
