package com.bleled.com;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.media.projection.*;
import android.os.*;
import androidx.core.content.ContextCompat;

/** User-consented local audio capture. Never writes PCM or sends network traffic. */
public class SmartAudioService extends Service {
    interface Listener {
        void started(String source);
        void frame(AudioAnalysis.Frame frame, String source);
        void stopped(String reason);
    }
    static volatile Listener listener;
    private volatile boolean running;
    private volatile AudioRecord recorder;
    private MediaProjection projection;
    private String source;
    private Listener sessionListener;
    private volatile boolean readerStarted;
    private static final String CHANNEL = "melk-audio", STOP = "com.bleled.com.STOP_AUDIO";
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int id) {
        if (intent == null || STOP.equals(intent.getAction())) { stopCapture("Capture stopped"); stopSelf(); return START_NOT_STICKY; }
        if (running) { Listener l = listener; if (l != null) l.stopped("Capture is already running"); return START_NOT_STICKY; }
        source = intent.getStringExtra("source");
        sessionListener = listener;
        if (!"device".equals(source) && !"microphone".equals(source)) { stopSelf(); return START_NOT_STICKY; }
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Music sync capture", NotificationManager.IMPORTANCE_LOW));
            Intent stop = new Intent(this, SmartAudioService.class).setAction(STOP);
            PendingIntent action = PendingIntent.getService(this, 0, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent open = PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
            Notification notification = builder.setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("MELK Studio music sync")
                .setContentText("device".equals(source) ? "Capturing permitted device audio locally" : "Microphone is active · audio stays on this phone")
                .setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "Stop", action).build()).build();
            if (Build.VERSION.SDK_INT >= 30 || (Build.VERSION.SDK_INT >= 29 && "device".equals(source))) startForeground(42, notification, "device".equals(source) ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION : ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(42, notification);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw new SecurityException("Audio permission is required");
            AudioFormat format = new AudioFormat.Builder().setSampleRate(AudioAnalysis.RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build();
            int min = AudioRecord.getMinBufferSize(AudioAnalysis.RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) throw new IllegalStateException("Audio input is unavailable");
            AudioRecord.Builder audio = new AudioRecord.Builder().setAudioFormat(format).setBufferSizeInBytes(Math.max(min * 2, AudioAnalysis.SIZE * 4));
            if ("device".equals(source)) {
                if (Build.VERSION.SDK_INT < 29) throw new IllegalStateException("Device audio needs Android 10 or newer");
                Intent consent = Build.VERSION.SDK_INT >= 33 ? intent.getParcelableExtra("consent", Intent.class) : intent.getParcelableExtra("consent");
                projection = getSystemService(MediaProjectionManager.class).getMediaProjection(intent.getIntExtra("resultCode", Activity.RESULT_CANCELED), consent);
                if (projection == null) throw new IllegalStateException("Screen capture consent was not granted");
                final MediaProjection captureProjection = projection;
                projection.registerCallback(new MediaProjection.Callback() { @Override public void onStop() { if (projection == captureProjection) { stopCapture("Device capture was revoked. Tap Start for fresh consent."); stopSelf(); } } }, main);
                AudioPlaybackCaptureConfiguration config = new AudioPlaybackCaptureConfiguration.Builder(projection)
                    .addMatchingUsage(AudioAttributes.USAGE_MEDIA).addMatchingUsage(AudioAttributes.USAGE_GAME).addMatchingUsage(AudioAttributes.USAGE_UNKNOWN).build();
                audio.setAudioPlaybackCaptureConfig(config);
            } else audio.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder = audio.build();
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("Audio capture could not initialize");
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("Audio input is busy or restricted");
            running = true; final AudioRecord session = recorder;
            final Listener captureListener = sessionListener; final String captureSource = source;
            readerStarted = true;
            Listener l = sessionListener; if (l != null) l.started(source);
            new Thread(() -> capture(session, captureListener, captureSource), "MELK-Smart-Audio").start();
        } catch (Exception e) { stopCapture("Audio capture unavailable: " + e.getMessage()); stopSelf(); }
        return START_NOT_STICKY;
    }
    private void capture(AudioRecord session, Listener captureListener, String captureSource) {
        AudioAnalysis analysis = new AudioAnalysis(); short[] pcm = new short[AudioAnalysis.SIZE]; int offset = 0; long last = 0; boolean pendingBeat = false;
        try {
            while (running && recorder == session) {
                int n = session.read(pcm, offset, pcm.length - offset, AudioRecord.READ_BLOCKING);
                if (n <= 0) throw new IllegalStateException("Audio input stopped");
                offset += n;
                if (offset != pcm.length) continue;
                offset = 0; long now = SystemClock.elapsedRealtime();
                AudioAnalysis.Frame f = analysis.analyze(pcm, now);
                pendingBeat |= f.beat;
                // FFT works at ~21 frames/s; the bridge/UI receives at most ~11 frames/s.
                if (now - last >= 80) { last = now; f.beat = pendingBeat; pendingBeat = false; if (running && recorder == session && captureListener != null) captureListener.frame(f, captureSource); }
            }
        } catch (Exception e) { main.post(() -> { if (recorder == session) { stopCapture("Audio capture interrupted. Tap Start to retry."); stopSelf(); } }); }
        finally { try { session.release(); } catch (Exception ignored) {} }
    }
    private synchronized void stopCapture(String reason) {
        boolean hadSession = running || recorder != null || projection != null;
        running = false; AudioRecord old = recorder; recorder = null;
        if (old != null) { try { old.stop(); } catch (Exception ignored) {} if (!readerStarted) old.release(); }
        MediaProjection oldProjection = projection; projection = null;
        if (oldProjection != null) { try { oldProjection.stop(); } catch (Exception ignored) {} }
        Listener l = sessionListener; if (l != null && (hadSession || reason.startsWith("Audio capture unavailable"))) l.stopped(reason);
        stopForeground(STOP_FOREGROUND_REMOVE);
    }
    @Override public void onDestroy() { stopCapture("Capture stopped"); super.onDestroy(); }
}
