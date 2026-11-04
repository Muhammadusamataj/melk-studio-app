package com.melk.studio;

import android.Manifest;
import android.media.audiofx.Visualizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/* Reads the phone's own audio output (any app, earphones included) and sends
 * the bass level to the web layer as "frame" events, about 20 times a second. */
@CapacitorPlugin(
    name = "AudioLevel",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "mic")
    }
)
public class AudioLevelPlugin extends Plugin {
    private static final int BASS_BINS = 6;      // FFT bins 1..6 is roughly 40-260 Hz
    private static final double BASS_SCALE = 90.0; // tune if the strip reacts too weakly or too hard
    private Visualizer viz;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "micPermsCallback");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void micPermsCallback(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) begin(call);
        else call.reject("Audio permission nahi mili. Phone ki settings mein allow karein.");
    }

    private void begin(PluginCall call) {
        stopViz();
        try {
            viz = new Visualizer(0); // session 0 = mix of every app's output
            viz.setEnabled(false);
            viz.setCaptureSize(Visualizer.getCaptureSizeRange()[1]);
            viz.setDataCaptureListener(new Visualizer.OnDataCaptureListener() {
                @Override
                public void onWaveFormDataCapture(Visualizer v, byte[] waveform, int samplingRate) { }

                @Override
                public void onFftDataCapture(Visualizer v, byte[] fft, int samplingRate) {
                    double sum = 0;
                    for (int k = 1; k <= BASS_BINS; k++) {
                        int i = 2 * k;                 // fft layout: [DC, Nyquist, re1, im1, re2, im2, ...]
                        if (i + 1 >= fft.length) break;
                        double re = fft[i], im = fft[i + 1];
                        sum += Math.sqrt(re * re + im * im);
                    }
                    JSObject o = new JSObject();
                    o.put("bass", Math.min(1.0, sum / (BASS_BINS * BASS_SCALE)));
                    notifyListeners("frame", o);
                }
            }, Visualizer.getMaxCaptureRate(), false, true);
            viz.setEnabled(true);
            call.resolve();
        } catch (Exception e) {
            stopViz();
            call.reject("Is phone par audio capture nahi chal sakta: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopViz();
        call.resolve();
    }

    private void stopViz() {
        if (viz != null) {
            try { viz.setEnabled(false); viz.release(); } catch (Exception ignored) { }
            viz = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopViz();
    }
}
