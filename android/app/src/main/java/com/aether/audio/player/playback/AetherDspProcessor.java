package com.aether.audio.player.playback;

import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.audio.AudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/** PCM16 DSP in Media3's audio sink, independent of the WebView lifetime.
 * Output is deliberately PCM16; this is not a bit-perfect USB/DAC path.
 */
@androidx.media3.common.util.UnstableApi
public final class AetherDspProcessor extends BaseAudioProcessor {
    private static final double[] FREQUENCIES = {31,62,125,250,500,1000,2000,4000,8000,16000};
    private volatile Settings requested = new Settings(false, new double[10], 0, 0, 0, 100);
    private Settings applied;
    private int channels, sampleRate;
    private double[][] coefficients;
    private double[][][] state;
    private static final class Settings {
        final boolean enabled; final double[] bands; final double preamp, bass, treble, width;
        Settings(boolean enabled, double[] bands, double preamp, double bass, double treble, double width) {
            this.enabled=enabled; this.bands=bands.clone(); this.preamp=preamp; this.bass=bass; this.treble=treble; this.width=width;
        }
    }
    public void update(boolean enabled, double[] bands, double preamp, double bass, double treble, double width) {
        requested = new Settings(enabled, bands, preamp, bass, treble, width);
    }
    @Override protected AudioFormat onConfigure(AudioFormat input) throws AudioProcessor.UnhandledAudioFormatException {
        if (input.encoding != C.ENCODING_PCM_16BIT) throw new AudioProcessor.UnhandledAudioFormatException(input);
        channels = input.channelCount; sampleRate = input.sampleRate;
        applied=null;
        return input;
    }
    private void configure(Settings settings) {
        coefficients = new double[12][5]; state = new double[channels][12][2];
        for (int i=0;i<12;i++) {
            double gain = i<10 ? settings.bands[i] : (i==10 ? settings.bass : settings.treble)*0.12;
            double frequency = Math.min(sampleRate*0.45, i<10 ? FREQUENCIES[i] : i==10 ? 100 : 8000);
            double a=Math.pow(10,gain/40), w=2*Math.PI*frequency/sampleRate, c=Math.cos(w), sin=Math.sin(w);
            double alpha=sin/(2*1.4), b0,b1,b2,a0,a1,a2;
            if (i<10) {
                b0=1+alpha*a; b1=-2*c; b2=1-alpha*a; a0=1+alpha/a; a1=-2*c; a2=1-alpha/a;
            } else {
                alpha=sin/Math.sqrt(2); double r=2*Math.sqrt(a)*alpha;
                if(i==10) {
                    b0=a*((a+1)-(a-1)*c+r); b1=2*a*((a-1)-(a+1)*c); b2=a*((a+1)-(a-1)*c-r);
                    a0=(a+1)+(a-1)*c+r; a1=-2*((a-1)+(a+1)*c); a2=(a+1)+(a-1)*c-r;
                } else {
                    b0=a*((a+1)+(a-1)*c+r); b1=-2*a*((a-1)+(a+1)*c); b2=a*((a+1)+(a-1)*c-r);
                    a0=(a+1)-(a-1)*c+r; a1=2*((a-1)-(a+1)*c); a2=(a+1)-(a-1)*c-r;
                }
            }
            coefficients[i]=new double[]{b0/a0,b1/a0,b2/a0,a1/a0,a2/a0};
        }
        applied=settings;
    }
    @Override public void queueInput(ByteBuffer input) {
        Settings settings=requested;
        if(applied!=settings) configure(settings);
        ByteBuffer output=replaceOutputBuffer(input.remaining()).order(ByteOrder.nativeOrder());
        input.order(ByteOrder.nativeOrder());
        double preamp=Math.pow(10, settings.preamp/20), width=settings.width/100;
        double[] frame = new double[channels];
        while(input.remaining()>=channels*2) {
            for(int ch=0;ch<channels;ch++) {
                double x=input.getShort()/32768.0;
                if(settings.enabled) {
                    x*=preamp;
                    for(int i=0;i<12;i++) {
                        double[] b=coefficients[i], z=state[ch][i];
                        double y=b[0]*x+z[0]; z[0]=b[1]*x-b[3]*y+z[1]; z[1]=b[2]*x-b[4]*y; x=y;
                    }
                }
                frame[ch]=x;
            }
            if(settings.enabled && channels==2) {
                double mid=(frame[0]+frame[1])*0.5, side=(frame[0]-frame[1])*0.5*width;
                frame[0]=mid+side; frame[1]=mid-side;
            }
            for(double x:frame) output.putShort((short)Math.round(Math.max(-1,Math.min(32767.0/32768,x))*32768));
        }
        output.flip();
    }
    @Override protected void onFlush() { applied=null; }
    @Override protected void onReset() { applied=null; state=null; coefficients=null; }
}
