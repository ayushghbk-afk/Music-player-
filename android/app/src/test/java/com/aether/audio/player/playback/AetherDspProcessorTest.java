package com.aether.audio.player.playback;

import static org.junit.Assert.*;
import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import org.junit.Test;

@androidx.media3.common.util.UnstableApi
public class AetherDspProcessorTest {
    private AetherDspProcessor processor() throws Exception {
        AetherDspProcessor p=new AetherDspProcessor();
        p.configure(new AudioProcessor.AudioFormat(48000,2,C.ENCODING_PCM_16BIT)); p.flush();
        return p;
    }
    private ByteBuffer tone(int frames, double left, double right, int offset) {
        ByteBuffer data=ByteBuffer.allocateDirect(frames*4).order(ByteOrder.nativeOrder());
        for(int i=0;i<frames;i++) {
            double sample=Math.sin(2*Math.PI*220*(offset+i)/48000);
            data.putShort((short)Math.round(left*sample*32767)); data.putShort((short)Math.round(right*sample*32767));
        }
        data.flip(); return data;
    }
    @Test public void metersAreRealIndependentChannels() throws Exception {
        AetherDspProcessor p=processor();
        for(int i=0;i<6;i++) { p.queueInput(tone(1024,0.4,0,i*1024)); p.getOutput(); }
        assertTrue(p.getMeter().left>0.25); assertEquals(0,p.getMeter().right,1e-8);
        p.queueInput(tone(1024,0,0.4,0)); p.getOutput();
        assertEquals(0,p.getMeter().left,1e-8); assertTrue(p.getMeter().right>0.25);
    }
    @Test public void boostedEqCannotWrapPcmAndRemainsAudibleWithHeadroom() throws Exception {
        AetherDspProcessor p=processor(); double[] bands=new double[10]; Arrays.fill(bands,12);
        p.update(true,bands,12,100,100,200,true,true,0,false);
        for(int i=0;i<15;i++) {
            p.queueInput(tone(1024,0.99,-0.99,i*1024)); ByteBuffer output=p.getOutput().order(ByteOrder.nativeOrder());
            while(output.hasRemaining()) assertTrue(Math.abs((int)output.getShort())<32113);
        }
        assertTrue(p.getMeter().left>0.001); assertTrue(Double.isFinite(p.getMeter().peak));
    }
    @Test public void monoAndBalanceAreAppliedToNativePcm() throws Exception {
        AetherDspProcessor p=processor();
        p.update(true,new double[10],0,0,0,100,true,true,0,true);
        for(int i=0;i<6;i++) { p.queueInput(tone(1024,0.4,0,i*1024)); p.getOutput(); }
        assertTrue(p.getMeter().left>0.1); assertEquals(p.getMeter().left,p.getMeter().right,1e-8);
        p.update(true,new double[10],0,0,0,100,true,true,1,false);
        for(int i=0;i<6;i++) { p.queueInput(tone(1024,0.4,0.4,i*1024)); p.getOutput(); }
        assertEquals(0,p.getMeter().left,1e-8); assertTrue(p.getMeter().right>0.2);
    }
    @Test public void rapidUpdatesCrossfadeRatherThanResetMidWave() throws Exception {
        AetherDspProcessor p=processor(); double last=0, maxStep=0;
        for(int block=0;block<80;block++) {
            double[] bands=new double[10]; bands[3]=block%2==0 ? 12 : -12;
            p.update(true,bands,0,0,0,100,true,true,0,false);
            p.queueInput(tone(240,0.4,0.4,block*240)); ByteBuffer out=p.getOutput().order(ByteOrder.nativeOrder());
            while(out.hasRemaining()) { double left=out.getShort()/32768.0; out.getShort(); maxStep=Math.max(maxStep,Math.abs(left-last)); last=left; }
        }
        assertTrue("Abrupt DSP discontinuity: "+maxStep,maxStep<0.08);
    }
    @Test public void monoSourcesAreUpmixedForRealChannelBalance() throws Exception {
        AetherDspProcessor p=new AetherDspProcessor();
        AudioProcessor.AudioFormat output=p.configure(new AudioProcessor.AudioFormat(48000,1,C.ENCODING_PCM_16BIT)); p.flush();
        assertEquals(2,output.channelCount);
        p.update(true,new double[10],0,0,0,100,true,true,1,false);
        for(int block=0;block<6;block++) {
            ByteBuffer data=ByteBuffer.allocateDirect(2048).order(ByteOrder.nativeOrder());
            for(int i=0;i<1024;i++) data.putShort((short)(0.4*Math.sin(2*Math.PI*220*(block*1024+i)/48000)*32767));
            data.flip(); p.queueInput(data); assertEquals(4096,p.getOutput().remaining());
        }
        assertEquals(0,p.getMeter().left,1e-8); assertTrue(p.getMeter().right>0.2);
    }
    @Test public void flushClearsStaleLevels() throws Exception {
        AetherDspProcessor p=processor(); p.queueInput(tone(2048,0.5,0.5,0)); p.getOutput();
        assertTrue(p.getMeter().peak>0); p.flush(); assertEquals(0,p.getMeter().peak,0);
    }
}
