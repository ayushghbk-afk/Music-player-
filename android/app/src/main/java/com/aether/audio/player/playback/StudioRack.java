package com.aether.audio.player.playback;

import java.util.Arrays;

/** Immutable, bounded stereo-system settings. No Android or WebView audio dependency. */
public final class StudioRack {
    final boolean enabled, invertLeft, invertRight;
    final double highPassHz, lowPassHz, outputTrimDb, delayMs;
    final double[][] parametric;
    public static StudioRack disabled() {
        return new StudioRack(false,0,0,new double[][]{{120,0,1.4},{1000,0,1.4},{8000,0,1.4}},0,0,false,false);
    }
    public StudioRack(boolean enabled, double highPassHz, double lowPassHz, double[][] parametric,
                      double outputTrimDb, double delayMs, boolean invertLeft, boolean invertRight) {
        this.enabled=enabled;
        this.highPassHz=highPassHz==0 ? 0 : bounded(highPassHz,20,1000);
        this.lowPassHz=lowPassHz==0 ? 0 : bounded(lowPassHz,1000,20000);
        this.outputTrimDb=bounded(outputTrimDb,-24,0); this.delayMs=bounded(delayMs,0,100);
        this.invertLeft=invertLeft; this.invertRight=invertRight;
        if(parametric==null || parametric.length!=3) throw new IllegalArgumentException("Expected three parametric bands");
        this.parametric=new double[3][3];
        for(int i=0;i<3;i++) {
            if(parametric[i]==null || parametric[i].length!=3) throw new IllegalArgumentException("Invalid parametric band");
            this.parametric[i][0]=bounded(parametric[i][0],20,20000);
            this.parametric[i][1]=bounded(parametric[i][1],-12,12);
            this.parametric[i][2]=bounded(parametric[i][2],0.2,12);
        }
    }
    private static double bounded(double value, double min, double max) {
        if(!Double.isFinite(value) || value<min || value>max) throw new IllegalArgumentException("Invalid system rack value");
        return value;
    }
    boolean same(StudioRack other) {
        return enabled==other.enabled && highPassHz==other.highPassHz && lowPassHz==other.lowPassHz &&
            outputTrimDb==other.outputTrimDb && delayMs==other.delayMs && invertLeft==other.invertLeft &&
            invertRight==other.invertRight && Arrays.deepEquals(parametric,other.parametric);
    }
    double[][] coefficients(int sampleRate) {
        double[][] result=new double[5][5];
        for(int i=0;i<5;i++) {
            double frequency=i<2 ? (i==0 ? highPassHz : lowPassHz) : parametric[i-2][0];
            if(!enabled || (i<2 && frequency==0)) { result[i]=new double[]{1,0,0,0,0}; continue; }
            double w=2*Math.PI*Math.min(sampleRate*0.45,frequency)/sampleRate;
            double c=Math.cos(w), sin=Math.sin(w), b0,b1,b2,a0,a1,a2;
            if(i<2) {
                double alpha=sin/Math.sqrt(2);
                b0=i==0 ? (1+c)/2 : (1-c)/2; b1=(i==0 ? -2 : 2)*b0; b2=b0;
                a0=1+alpha; a1=-2*c; a2=1-alpha;
            } else {
                double a=Math.pow(10,parametric[i-2][1]/40), alpha=sin/(2*parametric[i-2][2]);
                b0=1+alpha*a; b1=-2*c; b2=1-alpha*a; a0=1+alpha/a; a1=-2*c; a2=1-alpha/a;
            }
            result[i]=new double[]{b0/a0,b1/a0,b2/a0,a1/a0,a2/a0};
        }
        return result;
    }
}
