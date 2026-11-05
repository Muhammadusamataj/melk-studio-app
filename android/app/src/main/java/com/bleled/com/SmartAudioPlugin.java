package com.bleled.com;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;

/** Versioned bridge. Older APKs do not expose this plugin; web code must capability-check. */
@CapacitorPlugin(name = "SmartAudio", permissions = {
    @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "audio"),
    @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
})
public class SmartAudioPlugin extends Plugin implements SmartAudioService.Listener {
    private volatile PluginCall pending;
    private volatile boolean active;
    private volatile String requested;
    private volatile int generation;

    @PluginMethod public void getCapabilities(PluginCall call) {
        JSObject o = new JSObject(); o.put("apiVersion", 2); o.put("playback", Build.VERSION.SDK_INT >= 29); o.put("microphone", true); call.resolve(o);
    }
    @PluginMethod public void start(PluginCall call) {
        if (pending != null || active) { call.reject("Stop the current audio session first", "BUSY"); return; }
        requested = call.getString("source", "device");
        if (!"device".equals(requested) && !"microphone".equals(requested)) { call.reject("Choose Device Audio or Microphone", "BAD_SOURCE"); return; }
        if ("device".equals(requested) && Build.VERSION.SDK_INT < 29) { call.reject("Device Audio requires Android 10+; choose Microphone", "UNSUPPORTED"); return; }
        pending = call;
        generation++;
        if (getPermissionState("audio") != PermissionState.GRANTED) requestPermissionForAlias("audio", call, "audioPermission");
        else notifications(call);
    }
    @PermissionCallback private void audioPermission(PluginCall call) {
        if (pending != call) return;
        if (getPermissionState("audio") != PermissionState.GRANTED) { pending = null; call.reject("Audio permission denied. No capture started.", "PERMISSION_DENIED"); }
        else notifications(call);
    }
    private void notifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) requestPermissionForAlias("notifications", call, "notificationPermission");
        else consent(call);
    }
    @PermissionCallback private void notificationPermission(PluginCall call) { if (pending == call) consent(call); }
    private void consent(PluginCall call) {
        if ("device".equals(requested)) {
            MediaProjectionManager manager = getContext().getSystemService(MediaProjectionManager.class);
            startActivityForResult(call, manager.createScreenCaptureIntent(), "projectionConsent");
        } else launch(null, Activity.RESULT_OK);
    }
    @ActivityCallback private void projectionConsent(PluginCall call, ActivityResult result) {
        if (call == null || pending != call) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { pending = null; call.reject("Device Audio consent was declined. You can choose Microphone instead.", "CONSENT_DENIED"); return; }
        launch(result.getData(), result.getResultCode());
    }
    private void launch(Intent consent, int resultCode) {
        final int my = generation;
        SmartAudioService.listener = new SmartAudioService.Listener() {
            @Override public void started(String source) { if (my == generation) SmartAudioPlugin.this.started(source); }
            @Override public void frame(AudioAnalysis.Frame f, String source) { if (my == generation) SmartAudioPlugin.this.frame(f, source); }
            @Override public void stopped(String reason) { if (my == generation) SmartAudioPlugin.this.stopped(reason); }
        };
        Intent intent = new Intent(getContext(), SmartAudioService.class).putExtra("source", requested).putExtra("resultCode", resultCode);
        if (consent != null) intent.putExtra("consent", consent);
        try { if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent); else getContext().startService(intent); }
        catch (Exception e) { stopped("Android did not allow audio capture to start. Keep MELK Studio visible and retry."); }
    }
    @Override public void started(String source) {
        active = true; PluginCall call = pending; pending = null;
        if (call != null) { JSObject o = new JSObject(); o.put("source", source); call.resolve(o); }
    }
    @Override public void frame(AudioAnalysis.Frame f, String source) {
        JSObject o = new JSObject(); o.put("source", source); o.put("rms", f.rms); o.put("energy", f.energy);
        o.put("bass", f.bass); o.put("mid", f.mid); o.put("treble", f.treble); o.put("beat", f.beat); o.put("silence", f.silence);
        o.put("noiseFloor", f.noiseFloor); o.put("bpm", f.bpm); o.put("confidence", f.confidence);
        JSArray bins = JSArray.from(f.spectrum), wave = JSArray.from(f.waveform);
        o.put("spectrum", bins); o.put("waveform", wave); notifyListeners("frame", o);
    }
    @Override public void stopped(String reason) {
        active = false; PluginCall call = pending; pending = null;
        if (call != null) call.reject(reason, "CAPTURE_FAILED");
        JSObject o = new JSObject(); o.put("message", reason); notifyListeners("stopped", o);
    }
    @PluginMethod public void stop(PluginCall call) { stopSession(); call.resolve(); }
    private void stopSession() {
        generation++;
        PluginCall call = pending; pending = null;
        if (call != null) call.reject("Audio start cancelled", "CANCELLED");
        active = false; getContext().stopService(new Intent(getContext(), SmartAudioService.class));
    }
    // Foreground-only product policy. Consent UI may pause the activity while pending; do not cancel that prompt.
    @Override protected void handleOnStop() { if (active) stopSession(); }
    @Override protected void handleOnDestroy() { stopSession(); SmartAudioService.listener = null; super.handleOnDestroy(); }
}
