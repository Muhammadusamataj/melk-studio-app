package com.bleled.com;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Produces mic-derived bass/volume energy; audio samples are NOT saved or uploaded.
 * This intentionally does not claim to capture Spotify/YouTube internal audio:
 * other applications may prohibit Android playback capture.
 */
@CapacitorPlugin(name = "AudioLevel", permissions = {
    @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "mic")
})
public class AudioLevelPlugin extends Plugin {
    private static final int SAMPLE_RATE = 16000;
    private volatile boolean running = false;
    private volatile AudioRecord recorder;
    private Thread captureThread;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "onMicPermission");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void onMicPermission(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) begin(call);
        else call.reject("Microphone permission denied. Settings > Apps > MELK Studio > Permissions > Microphone mein Allow karein.");
    }

    private synchronized void begin(PluginCall call) {
        stopCapture();
        // Recheck at the point of use, including after the permission callback.
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission denied");
            return;
        }
        try {
            int minimum = AudioRecord.getMinBufferSize(SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (minimum <= 0) throw new IllegalStateException("Audio input unavailable");
            final int capacity = Math.max(4096, minimum * 2);
            final AudioRecord audio = new AudioRecord(MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, capacity);
            if (audio.getState() != AudioRecord.STATE_INITIALIZED) {
                audio.release();
                throw new IllegalStateException("Phone microphone initialize nahi hua");
            }
            audio.startRecording();
            if (audio.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                audio.release();
                throw new IllegalStateException("Microphone busy hai");
            }
            recorder = audio;
            running = true;
            captureThread = new Thread(() -> capture(audio), "MELK-Music-Mic");
            captureThread.start();
            call.resolve();
        } catch (Exception e) {
            stopCapture();
            call.reject("Microphone start nahi ho saka: " + e.getMessage());
        }
    }

    private void capture(AudioRecord audio) {
        final short[] samples = new short[1024];
        // 220 Hz low pass, followed by slow DC removal. Approximate bass energy,
        // not a claim to identify exact musical notes or a device-controlled beat.
        final double lpCoef = 1 - Math.exp(-2.0 * Math.PI * 220 / SAMPLE_RATE);
        final double dcCoef = 1 - Math.exp(-2.0 * Math.PI * 18 / SAMPLE_RATE);
        double lp = 0.0, dc = 0.0, smoothed = 0.0;
        try {
            // A previous reader must not resume when a new session sets running=true.
            while (running && recorder == audio) {
                int n = audio.read(samples, 0, samples.length);
                if (n < 0) break;
                if (n == 0 || !running || recorder != audio) continue;
                double sum = 0;
                for (int i = 0; i < n; i++) {
                    double x = samples[i];
                    lp += lpCoef * (x - lp);
                    dc += dcCoef * (lp - dc);
                    double bass = lp - dc;
                    sum += bass * bass;
                }
                double rms = Math.sqrt(sum / n);
                double strength = Math.min(1, Math.max(0, (rms - 90) / 1900.0));
                smoothed += (strength - smoothed) * (strength > smoothed ? .4 : .18);
                JSObject payload = new JSObject();
                payload.put("bass", smoothed);
                if (running && recorder == audio) notifyListeners("frame", payload);
            }
        } catch (Exception ignored) {
        } finally {
            try { audio.stop(); } catch (Exception ignored) {}
            audio.release();
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopCapture();
        call.resolve();
    }

    private synchronized void stopCapture() {
        running = false;
        AudioRecord old = recorder;
        recorder = null;
        // Stop unblocks the capture thread; thread itself releases the recorder.
        if (old != null) {
            try { old.stop(); } catch (Exception ignored) {}
        }
        captureThread = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopCapture();
        super.handleOnDestroy();
    }

}
