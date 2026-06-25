package io.ionic.starter;

import android.util.Base64;

import java.io.*;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 轻量级 HTTP 文件服务器 — 用于 Wi-Fi 传书
 * 在 Android 设备上启动一个 HTTP 服务器，用户通过浏览器上传文件到设备。
 */
public class SimpleHttpServer {

    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    private volatile boolean running = false;
    private int port;
    private File uploadDir;
    private final List<String> uploadedFiles = Collections.synchronizedList(new ArrayList<>());

    public SimpleHttpServer(File cacheDir, int port) {
        this.port = port;
        this.uploadDir = new File(cacheDir, "wifi-uploads");
        this.uploadDir.mkdirs();
    }

    /**
     * 启动服务器
     */
    public synchronized void start() throws IOException {
        if (running) return;
        // 绑定 0.0.0.0（所有网卡），不指定具体 IP，否则可能绑定到错误的接口
        serverSocket = new ServerSocket(port, 10);
        // 清理上次残留的上传文件
        if (uploadDir.exists()) {
            File[] children = uploadDir.listFiles();
            if (children != null) for (File f : children) f.delete();
        }
        running = true;
        threadPool = Executors.newCachedThreadPool();
        new Thread(this::acceptLoop, "http-server-accept").start();
    }

    /**
     * 停止服务器
     */
    public synchronized void stop() {
        running = false;
        try { if (serverSocket != null && !serverSocket.isClosed()) serverSocket.close(); } catch (Exception ignored) {}
        if (threadPool != null) threadPool.shutdownNow();
        uploadedFiles.clear();
    }

    public boolean isRunning() { return running; }
    public int getPort() { return port; }
    public String getIpAddress() {
        try {
            InetAddress addr = getLocalInetAddress();
            return addr != null ? addr.getHostAddress() : "127.0.0.1";
        } catch (Exception e) {
            return "127.0.0.1";
        }
    }
    public List<String> getUploadedFiles() { return new ArrayList<>(uploadedFiles); }

    private void acceptLoop() {
        while (running) {
            try {
                Socket client = serverSocket.accept();
                threadPool.execute(() -> handleClient(client));
            } catch (IOException e) {
                if (running) e.printStackTrace();
            }
        }
    }

    private void handleClient(Socket client) {
        try (
                InputStream in = client.getInputStream();
                OutputStream out = client.getOutputStream()
        ) {
            // 解析请求行
            String requestLine = readLine(in);
            if (requestLine == null || requestLine.isEmpty()) return;

            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0].toUpperCase(Locale.US);
            String path = parts[1];

            // 解析请求头
            Map<String, String> headers = new HashMap<>();
            String line;
            int contentLength = 0;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0) {
                    String key = line.substring(0, colon).trim().toLowerCase(Locale.US);
                    String value = line.substring(colon + 1).trim();
                    headers.put(key, value);
                    if (key.equals("content-length")) {
                        contentLength = Integer.parseInt(value);
                    }
                }
            }

            // 读取请求体
            byte[] body = null;
            if (contentLength > 0) {
                body = new byte[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int n = in.read(body, read, contentLength - read);
                    if (n == -1) break;
                    read += n;
                }
            }

            // 路由处理
            if (method.equals("GET") && path.equals("/")) {
                serveUploadPage(out);
            } else if (method.equals("GET") && path.equals("/status")) {
                serveJson(out, 200, "{\"running\":true,\"files\":" + toJsonArray(uploadedFiles) + "}");
            } else if (method.equals("POST") && path.equals("/upload") && body != null) {
                handleUpload(body, headers, out);
            } else {
                serveJson(out, 404, "{\"error\":\"Not Found\"}");
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try { client.close(); } catch (Exception ignored) {}
        }
    }

    /**
     * 处理文件上传 (接收 JSON: { filename, data (base64) })
     */
    private void handleUpload(byte[] body, Map<String, String> headers, OutputStream out) throws IOException {
        String contentType = headers.getOrDefault("content-type", "");
        if (contentType.contains("application/json")) {
            // JSON 格式: { filename: "...", data: "base64..." }
            String json = new String(body, StandardCharsets.UTF_8);
            String filename = extractJsonString(json, "filename");
            String data = extractJsonString(json, "data");

            if (filename == null || data == null) {
                serveJson(out, 400, "{\"error\":\"Missing filename or data\"}");
                return;
            }

            // 清理文件名
            filename = new File(filename).getName();

            // 只接受电子书文件格式
            String lower = filename.toLowerCase();
            if (!lower.endsWith(".epub") && !lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
                serveJson(out, 400, "{\"error\":\"Unsupported file format, only EPUB/PDF/TXT allowed\"}");
                return;
            }

            // 解码 base64
            byte[] fileBytes = Base64.decode(data, Base64.DEFAULT);
            File dest = new File(uploadDir, filename);

            // 避免覆盖
            int counter = 1;
            while (dest.exists()) {
                String name = filename.contains(".") ? filename.substring(0, filename.lastIndexOf('.')) : filename;
                String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.')) : "";
                dest = new File(uploadDir, name + "_" + counter + ext);
                counter++;
            }

            try (FileOutputStream fos = new FileOutputStream(dest)) {
                fos.write(fileBytes);
            }

            uploadedFiles.add(dest.getAbsolutePath());
            serveJson(out, 200, "{\"success\":true,\"file\":\"" + escapeJson(dest.getName()) + "\",\"size\":" + fileBytes.length + "}");

        } else if (contentType.contains("multipart/form-data")) {
            // 简单 multipart 支持
            serveJson(out, 501, "{\"error\":\"Multipart not supported, use JSON instead\"}");
        } else {
            serveJson(out, 400, "{\"error\":\"Unsupported Content-Type: " + escapeJson(contentType) + "\"}");
        }
    }

    /**
     * 主页 — 上传页面 (自包含 HTML)
     */
    private void serveUploadPage(OutputStream out) throws IOException {
        String html = "<!DOCTYPE html>" +
                "<html lang=\"zh-CN\">" +
                "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
                "<title>Kianer Reader - Wi-Fi 传书</title>" +
                "<style>" +
                "*{margin:0;padding:0;box-sizing:border-box}" +
                "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#e0c3fc,#8ec5fc);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}" +
                ".card{background:rgba(255,255,255,0.85);backdrop-filter:blur(20px);border-radius:24px;padding:40px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(31,38,135,0.15);text-align:center}" +
                "h1{font-size:24px;font-weight:800;color:#1e293b;margin-bottom:6px}" +
                "p{color:#64748b;font-size:14px;margin-bottom:20px}" +
                ".drop-zone{border:2px dashed #cbd5e1;border-radius:16px;padding:40px 20px;cursor:pointer;transition:all 0.3s;background:rgba(255,255,255,0.5)}" +
                ".drop-zone:hover,.drop-zone.dragover{border-color:#409eff;background:rgba(64,158,255,0.05)}" +
                ".drop-zone-icon{font-size:48px;margin-bottom:12px}" +
                ".drop-zone-text{font-size:15px;color:#475569;font-weight:500}" +
                ".drop-zone-hint{font-size:12px;color:#94a3b8;margin-top:8px}" +
                "input[type=file]{display:none}" +
                ".file-list{margin-top:16px;text-align:left}" +
                ".file-item{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.6);border-radius:10px;margin-bottom:8px;font-size:13px}" +
                ".file-item .name{flex:1;color:#1e293b;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
                ".file-item .size{color:#94a3b8;font-size:12px}" +
                ".file-item .status{font-size:12px;font-weight:600}" +
                ".file-item .status.ok{color:#10b981}" +
                ".file-item .status.fail{color:#ef4444}" +
                ".file-item .status.wait{color:#f59e0b}" +
                ".progress-container{width:100%;height:4px;background:#e5e7eb;border-radius:2px;margin-top:4px;overflow:hidden}" +
                ".progress-bar{height:100%;background:linear-gradient(90deg,#409eff,#60a5fa);border-radius:2px;transition:width 0.3s;width:0}" +
                ".footer{color:#94a3b8;font-size:12px;margin-top:24px}" +
                "@media(prefers-color-scheme:dark){" +
                "body{background:linear-gradient(135deg,#1a1a2e,#16213e)}" +
                ".card{background:rgba(30,41,59,0.85)}" +
                "h1{color:#e2e8f0}" +
                "p,.drop-zone-text,.drop-zone-hint,.footer{color:#94a3b8}" +
                ".drop-zone{border-color:#334155}" +
                ".file-item{background:rgba(51,65,85,0.6)}" +
                ".file-item .name{color:#e2e8f0}}" +
                "</style>" +
                "</head><body>" +
                "<div class=\"card\">" +
                "<h1>📚 传书到 Kianer Reader</h1>" +
                "<p>选择或拖拽文件到下方区域上传</p>" +
                "<div class=\"drop-zone\" id=\"dropZone\">" +
                "<div class=\"drop-zone-icon\">📂</div>" +
                "<div class=\"drop-zone-text\">点击选择文件或拖拽到此区域</div>" +
                "<div class=\"drop-zone-hint\">支持 EPUB、PDF、TXT 格式</div>" +
                "</div>" +
                "<input type=\"file\" id=\"fileInput\" multiple accept=\".epub,.pdf,.txt\" />" +
                "<div class=\"file-list\" id=\"fileList\"></div>" +
                "<div class=\"footer\">文件通过本地网络传输，不会上传到互联网</div>" +
                "</div>" +
                "<script>" +
                "const dropZone=document.getElementById('dropZone');" +
                "const fileInput=document.getElementById('fileInput');" +
                "const fileList=document.getElementById('fileList');" +
                "const fileQueue=[];" +
                "let uploading=false;" +
                "dropZone.addEventListener('click',()=>fileInput.click());" +
                "dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('dragover');});" +
                "dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('dragover'));" +
                "dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('dragover');addFiles(e.dataTransfer.files);});" +
                "fileInput.addEventListener('change',()=>{addFiles(fileInput.files);fileInput.value='';});" +
                "function addFiles(files){" +
                "for(const f of files){" +
                "const ext=f.name.split('.').pop().toLowerCase();" +
                "if(!['epub','pdf','txt'].includes(ext)){alert('不支持的文件格式: .'+ext);continue;}" +
                "if(fileQueue.some(x=>x.name===f.name&&x.size===f.size)) continue;" +
                "fileQueue.push({name:f.name,size:f.size,file:f});" +
                "renderFiles();" +
                "processQueue();" +
                "}}" +
                "function renderFiles(){" +
                "fileList.innerHTML=fileQueue.map((f,i)=>'<div class=\"file-item\" id=\"fi-'+i+'\">" +
                "<span class=\"name\">'+f.name+'</span>" +
                "<span class=\"size\">'+formatSize(f.size)+'</span>" +
                "<span class=\"status '+(f.status||'wait')+'\">'+(f.status==='ok'?'✓':f.status==='fail'?'✗':'⋯')+'</span>" +
                "<div class=\"progress-container\"><div class=\"progress-bar\" id=\"pb-'+i+'\"></div></div>" +
                "</div>').join('');" +
                "}" +
                "function formatSize(b){if(b===0)return'0 B';const u=['B','KB','MB','GB'];let i=0;let s=b;while(s>=1024&&i<u.length-1){s/=1024;i++}return s.toFixed(i===0?0:1)+' '+u[i]}" +
                "async function processQueue(){" +
                "if(uploading)return;" +
                "const idx=fileQueue.findIndex(f=>!f.status);" +
                "if(idx===-1)return;" +
                "uploading=true;" +
                "const item=fileQueue[idx];" +
                "item.status='uploading';renderFiles();" +
                "try{" +
                "const blob=item.file;" +
                "const buf=await blob.arrayBuffer();" +
                "const bytes=new Uint8Array(buf);" +
                "let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);" +
                "const b64=btoa(binary);" +
                "const res=await fetch('/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:item.name,data:b64})});" +
                "const result=await res.json();" +
                "if(result.success){" +
                "item.status='ok';" +
                "document.getElementById('pb-'+idx).style.width='100%';" +
                "}else{item.status='fail'}" +
                "}catch(e){item.status='fail';console.error(e)}" +
                "renderFiles();" +
                "uploading=false;" +
                "processQueue();" +
                "}" +
                "</script>" +
                "</body></html>";

        byte[] data = html.getBytes(StandardCharsets.UTF_8);
        sendResponse(out, 200, "text/html; charset=utf-8", data);
    }

    private void serveJson(OutputStream out, int statusCode, String json) throws IOException {
        byte[] data = json.getBytes(StandardCharsets.UTF_8);
        sendResponse(out, statusCode, "application/json; charset=utf-8", data);
    }

    private void sendResponse(OutputStream out, int statusCode, String contentType, byte[] body) throws IOException {
        String status = switch (statusCode) {
            case 200 -> "200 OK";
            case 400 -> "400 Bad Request";
            case 404 -> "404 Not Found";
            case 501 -> "501 Not Implemented";
            default -> "500 Internal Server Error";
        };
        String header = "HTTP/1.1 " + status + "\r\n" +
                "Content-Type: " + contentType + "\r\n" +
                "Content-Length: " + body.length + "\r\n" +
                "Connection: close\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "\r\n";
        out.write(header.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    private String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\r') continue;
            if (b == '\n') break;
            baos.write(b);
        }
        String s = baos.toString("UTF-8");
        return s.isEmpty() && baos.size() == 0 ? null : s;
    }

    private String extractJsonString(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start == -1) return null;
        start += search.length();
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"') break;
            if (c == '\\' && i + 1 < json.length()) {
                i++;
                sb.append(json.charAt(i));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private String toJsonArray(List<String> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJson(list.get(i))).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    private static InetAddress getLocalInetAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                Enumeration<InetAddress> addresses = ni.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof java.net.Inet4Address && !addr.isLoopbackAddress()) {
                        return addr;
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
