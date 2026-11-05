package com.bleled.com;
import org.junit.Test;
import static org.junit.Assert.*;

public class AudioAnalysisTest {
    private short[] tone(double hz, double amplitude) {
        short[] samples = new short[AudioAnalysis.SIZE];
        for (int i = 0; i < samples.length; i++) samples[i] = (short) (Math.sin(2 * Math.PI * hz * i / AudioAnalysis.RATE) * amplitude * 32767);
        return samples;
    }
    @Test public void realFftSeparatesBassMidAndTreble() {
        AudioAnalysis.Frame bass = new AudioAnalysis().analyze(tone(100, .2), 1000);
        AudioAnalysis.Frame mid = new AudioAnalysis().analyze(tone(1000, .2), 1000);
        AudioAnalysis.Frame treble = new AudioAnalysis().analyze(tone(8000, .2), 1000);
        assertTrue(bass.bass > bass.mid * 10); assertTrue(mid.mid > mid.bass * 10); assertTrue(treble.treble > treble.mid * 10);
        assertEquals(.2 / Math.sqrt(2), mid.rms, .005);
    }
    @Test public void silenceHysteresisAndGainAreFinite() {
        AudioAnalysis a = new AudioAnalysis(); AudioAnalysis.Frame f = null;
        for (int t = 0; t < 2000; t += 46) f = a.analyze(new short[AudioAnalysis.SIZE], t);
        assertTrue(f.silence); assertEquals(0, f.energy, 0); assertFalse(f.beat); assertEquals(0, f.bpm, 0);
        f = a.analyze(tone(200, .04), 2100); assertFalse(f.silence); assertTrue(f.energy > 0);
        for (double v : f.spectrum) assertTrue(Double.isFinite(v) && v >= 0 && v <= 1);
    }
    @Test public void transientBassTriggersOnsetsWithCooldownAndNoConstantToneBeatStorm() {
        AudioAnalysis a = new AudioAnalysis(); int beats = 0;
        for (int t = 0; t < 5000; t += 46) { AudioAnalysis.Frame f = a.analyze(tone(100, t % 500 < 92 ? .5 : .001), t); if (f.beat) beats++; }
        assertTrue("detected real transient onsets: " + beats, beats >= 3 && beats <= 12);
        int stable = 0; for (int t = 5000; t < 8000; t += 46) if (a.analyze(tone(100, .2), t).beat) stable++;
        assertTrue("steady tone is not a beat sequence", stable <= 2);
    }
    @Test public void tempoIsAbsentUntilEnoughConsistentIntervals() {
        AudioAnalysis a = new AudioAnalysis(); AudioAnalysis.Frame f = a.analyze(tone(100, .5), 1000);
        assertEquals(0, f.bpm, 0); assertTrue(f.confidence < .65);
    }
    @Test(expected = IllegalArgumentException.class) public void malformedPcmIsRejected() { new AudioAnalysis().analyze(new short[10], 0); }
}
