package com.aether.audio.player.playback;

import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.audio.AudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/** Native PCM16 DSP. State-preserving, crossfaded banks prevent slider/preset clicks.
 * Measured PCM RMS is published without requiring microphone permission.
 * This is neither bit-perfect output nor an intersample/true-peak limiter.
 */
@androidx.media3.common.util.UnstableApi
public final class AetherDspProcessor extends BaseAudioProcessor {
    private static final double[] FREQUENCIES = {31,62,125,250,500,1000,2000,4000,8000,16000};
    private volatile Settings requested = new Settings(false, new double[10], 0, 0, 0, 100, true, true, 0, false);
    private Settings applied;
    private int inputChannels, channels, sampleRate, fadeRemaining, fadeLength;
    private Bank current, previous;
    private double[] inputFrame, frame, previousFrame;
    public static final class Meter {
        public final double left, right, peak;
        public final boolean overloaded;
        Meter(double left, double right, double peak, boolean overloaded) {
            this.left=left; this.right=right; this.peak=peak; this.overloaded=overloaded;
        }
    }
    private volatile Meter meter = new Meter(0,0,0,false);
    public Meter getMeter() { return meter; }
    private static final class Settings {
        final boolean enabled, headroom, protection, mono;
        final double[] bands;
        final double preamp, bass, treble, width, balance;
        Settings(boolean enabled, double[] bands, double preamp, double bass, double treble, double width,
                 boolean headroom, boolean protection, double balance, boolean mono) {
            this.enabled=enabled; this.bands=bands.clone(); this.preamp=preamp; this.bass=bass; this.treble=treble; this.width=width;
            this.headroom=headroom; this.protection=protection; this.balance=balance; this.mono=mono;
        }
        boolean same(Settings s) {
            return enabled==s.enabled && Arrays.equals(bands,s.bands) && preamp==s.preamp && bass==s.bass && treble==s.treble && width==s.width && headroom==s.headroom && protection==s.protection && balance==s.balance && mono==s.mono;
        }
    }
    public void update(boolean enabled, double[] bands, double preamp, double bass, double treble, double width,
                       boolean headroom, boolean protection, double balance, boolean mono) {
        Settings next = new Settings(enabled,bands,preamp,bass,treble,width,headroom,protection,balance,mono);
        if (!requested.same(next)) requested=next;
    }
    @Override protected AudioFormat onConfigure(AudioFormat input) throws AudioProcessor.UnhandledAudioFormatException {
        if (input.encoding != C.ENCODING_PCM_16BIT) throw new AudioProcessor.UnhandledAudioFormatException(input);
        inputChannels=input.channelCount; channels=Math.max(2,inputChannels); sampleRate=input.sampleRate;
        inputFrame=new double[channels]; frame=new double[channels]; previousFrame=new double[channels];
        applied=null; current=null; previous=null;
        return new AudioFormat(sampleRate,channels,input.encoding);
    }
    private final class Bank {
        final Settings settings;
        final double[][] coefficients = new double[12][5];
        final double[][][] state = new double[channels][12][2];
        final double gain;
        Bank(Settings settings) {
            this.settings=settings;
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

            double maximum=-200;
            if (settings.enabled && settings.headroom) {
                for(int k=0;k<=256;k++) {
                    double f=10*Math.pow(Math.min(22000,sampleRate*0.49)/10.0,k/256.0);
                    double w=2*Math.PI*f/sampleRate, c=Math.cos(w), s=Math.sin(w), c2=Math.cos(2*w), s2=Math.sin(2*w), db=0;
                    for(double[] b:coefficients) {
                        double nr=b[0]+b[1]*c+b[2]*c2, ni=b[1]*s+b[2]*s2;
                        double dr=1+b[3]*c+b[4]*c2, di=b[3]*s+b[4]*s2;
                        db+=10*Math.log10(Math.max(1e-20,(nr*nr+ni*ni)/(dr*dr+di*di)));
                    }
                    maximum=Math.max(maximum,db);
                }
            }
            double widthBound=settings.mono ? 1 : Math.max(1,settings.width/100);
            double reduction=settings.headroom ? Math.max(0,maximum+settings.preamp+20*Math.log10(widthBound)+1) : 0;
            gain=settings.enabled ? Math.pow(10,(settings.preamp-reduction)/20) : 1;
        }
        void process(double[] input, double[] output) {
            for(int ch=0;ch<channels;ch++) {
                double x=input[ch];
                if(settings.enabled) {
                    x*=gain;
                    for(int i=0;i<12;i++) {
                        double[] b=coefficients[i], z=state[ch][i];
                        double y=b[0]*x+z[0]; z[0]=b[1]*x-b[3]*y+z[1]; z[1]=b[2]*x-b[4]*y;
                        // Flush inaudible denormals to keep long quiet tails inexpensive.
                        if(Math.abs(z[0])<1e-25) z[0]=0;
                        if(Math.abs(z[1])<1e-25) z[1]=0;
                        x=y;
                    }
                }
                output[ch]=x;
            }
            if(settings.enabled && channels==2) {
                double mid=(output[0]+output[1])*0.5;
                double side=(output[0]-output[1])*0.5*(settings.mono ? 0 : settings.width/100);
                output[0]=(mid+side)*Math.min(1,1-settings.balance);
                output[1]=(mid-side)*Math.min(1,1+settings.balance);
            }
        }
    }
    @Override public void queueInput(ByteBuffer input) {
        Settings settings=requested;
        if(applied!=settings && (current==null || fadeRemaining==0)) {
            // Keep the old delay state alive during the transition, instead of zeroing it mid-wave.
            previous=current; current=new Bank(settings); applied=settings;
            fadeLength=Math.max(1,sampleRate/50); fadeRemaining=fadeLength;
        }
        settings=applied;
        ByteBuffer output=replaceOutputBuffer(input.remaining()/inputChannels*channels).order(ByteOrder.nativeOrder());
        input.order(ByteOrder.nativeOrder());
        double sumLeft=0,sumRight=0,peak=0; int count=0; boolean overloaded=false;
        while(input.remaining()>=inputChannels*2) {
            if(inputChannels==1) {
                double mono=input.getShort()/32768.0;
                inputFrame[0]=mono; inputFrame[1]=mono;
            } else for(int ch=0;ch<channels;ch++) inputFrame[ch]=input.getShort()/32768.0;
            current.process(inputFrame,frame);
            if(fadeRemaining>0) {
                if(previous!=null) previous.process(inputFrame,previousFrame);
                double mix=1-fadeRemaining/(double)fadeLength;
                for(int ch=0;ch<channels;ch++) frame[ch]=frame[ch]*mix+(previous==null ? 0 : previousFrame[ch]*(1-mix));
                if(--fadeRemaining==0) previous=null;
            }
            for(int ch=0;ch<channels;ch++) {
                double x=frame[ch], a=Math.abs(x);
                overloaded|=a>=0.97;
                if(settings.protection && a>0.85) x=Math.signum(x)*(0.85+0.13*Math.tanh((Math.min(a,1)-0.85)/0.13));
                if(!Double.isFinite(x)) x=0;
                x=Math.max(-1,Math.min(32767.0/32768,x));
                frame[ch]=x; peak=Math.max(peak,Math.abs(x));
                output.putShort((short)Math.round(x*32768));
            }
            sumLeft+=frame[0]*frame[0];
            double right=frame[Math.min(1,channels-1)]; sumRight+=right*right; count++;
        }
        if(count>0) meter=new Meter(Math.sqrt(sumLeft/count),Math.sqrt(sumRight/count),peak,overloaded);
        output.flip();
    }
    @Override protected void onFlush() { applied=null; current=null; previous=null; meter=new Meter(0,0,0,false); }
    @Override protected void onReset() { onFlush(); inputFrame=null; frame=null; previousFrame=null; }
}
