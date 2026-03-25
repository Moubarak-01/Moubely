import { pipeline } from '@xenova/transformers';
const { WaveFile } = require('wavefile');
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';

// Configure FFmpeg path correctly for development and production
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
const actualFfmpegPath = isDev 
    ? ffmpegPath 
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', (process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'));

ffmpeg.setFfmpegPath(actualFfmpegPath);

export class WhisperHelper {
    private static transcriber: any = null;
    private static isInitializing: boolean = false;
    private static processingQueue: any[] = [];
    private static isProcessing: boolean = false;

    /**
     * Pre-loads the Whisper model into memory.
     */
    public static async initModel() {
        if (this.transcriber || this.isInitializing) return;
        this.isInitializing = true;
        
        try {
            console.log("[Whisper 🧠] ⏳ Loading Local AI Model (Tiny English)...");
            
            // In production, the model will be bundled in the app's resources
            this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                quantized: true,
            });
            console.log("[Whisper 🧠] ✅ Local AI Ready!");
        } catch (error) {
            console.error("[Whisper 🧠] ❌ Model load failed:", error);
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Native transcription without needing a separate web server.
     */
    public static async transcribe(audioPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.processingQueue.push({ audioPath, resolve, reject });
            this.processQueue();
        });
    }

    private static async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) return;
        
        if (!this.transcriber) {
            await this.initModel();
            if (!this.transcriber) {
                const { reject } = this.processingQueue.shift();
                reject(new Error("Whisper model failed to initialize"));
                return;
            }
        }

        this.isProcessing = true;
        const { audioPath, resolve, reject } = this.processingQueue.shift();

        const requestId = Date.now() + Math.random();
        const tempOutput = path.join(os.tmpdir(), `moubely_transcribe_${requestId}.wav`);

        try {
            // 1. Convert to WAV (16kHz Mono) for the model
            await new Promise((res, rej) => {
                ffmpeg(audioPath)
                    .toFormat('wav')
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .on('end', res)
                    .on('error', rej)
                    .save(tempOutput);
            });

            // 2. Read and Prepare Audio Data
            const wavBuffer = fs.readFileSync(tempOutput);
            let wav = new WaveFile(wavBuffer);
            wav.toBitDepth('32f');
            let audioData: any = wav.getSamples();

            // Convert to mono if stereo
            if (Array.isArray(audioData)) {
                if (audioData.length > 1) {
                    const mono = new Float32Array(audioData[0].length);
                    for (let i = 0; i < audioData[0].length; i++) {
                        mono[i] = (audioData[0][i] + audioData[1][i]) / 2;
                    }
                    audioData = mono;
                } else {
                    audioData = audioData[0];
                }
            }

            // 3. Run Inference
            const result = await this.transcriber(audioData);
            
            // 4. Cleanup
            try { fs.unlinkSync(tempOutput); } catch (e) {}

            resolve(result.text.trim());

        } catch (error) {
            console.error("[Whisper 🧠] Inference Error:", error);
            try { fs.unlinkSync(tempOutput); } catch (e) {}
            reject(error);
        } finally {
            this.isProcessing = false;
            // Process next item in queue
            setImmediate(() => this.processQueue());
        }
    }
}
