package com.bleled.com;

import java.util.Arrays;

/** Bounded radix-2 FFT and adaptive onset analysis. Reuses buffers; retains no recordings. */
final class AudioAnalysis {
    static final int SIZE = 2048;
    static final int RATE = 44100;
    static final class Frame {
        double rms, energy, bass, mid, treble, noiseFloor, bpm, confidence;
        boolean beat, silence;
        final double[] spectrum = new double[16], waveform = new double[32];
    }
    private final double[] real = new double[SIZE], imag = new double[SIZE], previous = new double[SIZE / 2];
    private final double[] intervals = new double[8];
    private double floor = .0002, peak = .02, fluxMean = .0001, fluxVariance = .0001;
    private long lastBeat = -10000, quietSince = -1;
    private int intervalCount, intervalIndex;

    Frame analyze(short[] pcm, long millis) {
        if (pcm.length != SIZE) throw new IllegalArgumentException("Expected 2048 PCM samples");
        Frame f = new Frame();
        double mean = 0, sum = 0;
        for (short s : pcm) mean += s / 32768.0;
        mean /= SIZE;
        for (int i = 0; i < SIZE; i++) {
            double x = pcm[i] / 32768.0 - mean; sum += x * x;
            real[i] = x * (.5 - .5 * Math.cos(2 * Math.PI * i / (SIZE - 1))); imag[i] = 0;
            if (i % 64 == 0) f.waveform[i / 64] = x;
        }
        f.rms = Math.sqrt(sum / SIZE);
        floor += (f.rms - floor) * (f.rms < floor ? .12 : .0005);
        floor = Math.max(.00005, Math.min(.015, floor)); f.noiseFloor = floor;
        peak = Math.max(f.rms, Math.max(.005, peak * .995));
        double gain = Math.min(30, 1 / Math.max(.01, peak * 1.4));
        double threshold = Math.max(.0005, floor * 1.8);
        if (f.rms < threshold) { if (quietSince < 0) quietSince = millis; }
        else if (f.rms > threshold * 1.3) quietSince = -1;
        f.silence = quietSince >= 0 && millis - quietSince >= 500;
        fft(real, imag);
        double flux = 0, bass = 0, mid = 0, treble = 0;
        for (int k = 1; k < SIZE / 2; k++) {
            double hz = k * RATE / (double) SIZE;
            double magnitude = 2 * Math.hypot(real[k], imag[k]) / SIZE;
            flux += Math.max(0, magnitude - previous[k]); previous[k] = magnitude;
            double power = magnitude * magnitude;
            if (hz >= 35 && hz < 250) bass += power;
            else if (hz >= 250 && hz < 4000) mid += power;
            else if (hz >= 4000 && hz < 16000) treble += power;
            int bucket = Math.min(15, Math.max(0, (int) (Math.log(Math.max(35, hz) / 35) / Math.log(16000.0 / 35) * 16)));
            f.spectrum[bucket] += power;
        }
        double oldMean = fluxMean;
        fluxMean += .05 * (flux - fluxMean); fluxVariance += .05 * ((flux - oldMean) * (flux - oldMean) - fluxVariance);
        f.beat = !f.silence && f.rms > threshold * 1.3 && flux > oldMean + Math.max(.002, 1.4 * Math.sqrt(fluxVariance)) && millis - lastBeat > 240;
        if (f.beat) {
            long delta = millis - lastBeat;
            if (delta >= 300 && delta <= 1500) { intervals[intervalIndex++ % intervals.length] = delta; intervalCount = Math.min(intervalCount + 1, intervals.length); }
            else intervalCount = 0;
            lastBeat = millis;
        }
        if (intervalCount >= 4 && millis - lastBeat < 2500) {
            double[] sorted = Arrays.copyOf(intervals, intervalCount); Arrays.sort(sorted);
            double median = sorted[intervalCount / 2], deviation = 0;
            for (double d : sorted) deviation += Math.abs(d - median) / median;
            f.confidence = Math.max(0, 1 - deviation / intervalCount * 3);
            if (f.confidence >= .65) f.bpm = 60000 / median;
        }
        f.energy = f.silence ? 0 : unit(Math.max(0, f.rms - floor) * gain);
        f.bass = f.silence ? 0 : unit(Math.sqrt(bass) * gain * 1.4);
        f.mid = f.silence ? 0 : unit(Math.sqrt(mid) * gain * 1.4);
        f.treble = f.silence ? 0 : unit(Math.sqrt(treble) * gain * 1.4);
        for (int i = 0; i < 16; i++) f.spectrum[i] = f.silence ? 0 : unit(Math.sqrt(f.spectrum[i]) * gain * 1.4);
        return f;
    }
    private static double unit(double x) { return Math.max(0, Math.min(1, x)); }
    static void fft(double[] r, double[] im) {
        int n = r.length;
        for (int i = 1, j = 0; i < n; i++) {
            int bit = n >> 1; for (; (j & bit) != 0; bit >>= 1) j ^= bit; j ^= bit;
            if (i < j) { double t = r[i]; r[i] = r[j]; r[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
        }
        for (int len = 2; len <= n; len <<= 1) {
            double angle = -2 * Math.PI / len, wr = Math.cos(angle), wi = Math.sin(angle);
            for (int start = 0; start < n; start += len) {
                double ur = 1, ui = 0;
                for (int j = 0; j < len / 2; j++) {
                    int a = start + j, b = a + len / 2;
                    double vr = r[b] * ur - im[b] * ui, vi = r[b] * ui + im[b] * ur;
                    r[b] = r[a] - vr; im[b] = im[a] - vi; r[a] += vr; im[a] += vi;
                    double next = ur * wr - ui * wi; ui = ur * wi + ui * wr; ur = next;
                }
            }
        }
    }
}
