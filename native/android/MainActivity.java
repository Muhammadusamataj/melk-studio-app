package com.melk.studio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Replace android/app/src/main/java/studio/melk/app/MainActivity.java with this file.
// Also copy AudioLevelPlugin.java into the same folder.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AudioLevelPlugin.class); // must come before super.onCreate
        super.onCreate(savedInstanceState);
    }
}
