package com.bleled.com;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our custom microphone level plugin before Capacitor starts the bridge.
        registerPlugin(AudioLevelPlugin.class);
        registerPlugin(SmartAudioPlugin.class);
        // Full-APK self update through Android's Package Installer (separate from the ZIP web update).
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
