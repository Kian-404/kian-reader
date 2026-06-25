package io.ionic.starter;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "WifiTransfer")
public class WifiTransferPlugin extends Plugin {

    private SimpleHttpServer server;

    @Override
    public void load() {
    }

    @PluginMethod
    public void startServer(PluginCall call) {
        int port = call.getInt("port", 8080);

        try {
            if (server != null && server.isRunning()) {
                server.stop();
            }
            server = new SimpleHttpServer(getContext().getCacheDir(), port);
            server.start();
            JSObject result = new JSObject();
            result.put("ip", server.getIpAddress());
            result.put("port", server.getPort());
            result.put("running", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        try {
            if (server != null) {
                server.stop();
                server = null;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getServerStatus(PluginCall call) {
        boolean running = server != null && server.isRunning();
        JSObject result = new JSObject();
        result.put("running", running);
        if (running) {
            result.put("ip", server.getIpAddress());
            result.put("port", server.getPort());
            result.put("files", toJSArray(server.getUploadedFiles()));
        } else {
            result.put("files", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getUploadedFiles(PluginCall call) {
        JSObject result = new JSObject();
        if (server != null) {
            result.put("files", toJSArray(server.getUploadedFiles()));
        } else {
            result.put("files", new JSArray());
        }
        call.resolve(result);
    }

    private JSArray toJSArray(List<String> list) {
        JSArray arr = new JSArray();
        for (String s : list) {
            arr.put(s);
        }
        return arr;
    }
}
