package com.getcapacitor;

import android.content.Context;
import androidx.appcompat.app.AppCompatActivity;

/** Compile-time stub. Signatures copied from @capacitor/android 8.5.3 (capacitor/src/main/java/com/getcapacitor/Plugin.java). */
public class Plugin {
    public void load() {}
    public Context getContext() { return null; }
    public AppCompatActivity getActivity() { return null; }
    public Bridge getBridge() { return null; }
    protected void notifyListeners(String eventName, JSObject data, boolean retainUntilConsumed) {}
    protected void notifyListeners(String eventName, JSObject data) {}
    protected void requestPermissionForAlias(String alias, PluginCall call, String callbackName) {}
    public PermissionState getPermissionState(String alias) { return null; }
    protected void handleOnStart() {}
    protected void handleOnResume() {}
    protected void handleOnPause() {}
    protected void handleOnDestroy() {}
}
