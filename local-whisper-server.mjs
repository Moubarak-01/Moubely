import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';
import wavefile from 'wavefile';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';   // <--- NEW IMPORT
import path from 'path'; // <--- NEW IMPORT

const { WaveFile } = wavefile;
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3000;

// Increase payload limit for safety
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

let transcriber = null;
let processingQueue = []; // Internal Server Queue
let isProcessing = false; // Flag to check if busy

console.log("⏳ Loading Local Whisper Model (English-Only Tiny)...");

const initModel = async () => {
    // UPDATED: 'Xenova/whisper-tiny.en' (English Only)
    // This is the fastest possible model for your laptop.
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        quantized: true,
    });
    console.log("✅ Local Whisper Ready! (English Only + Queue Active)");
};
initModel();

// The Queue Processor
const processQueue = async () => {
    if (isProcessing || processingQueue.length === 0) return;

    isProcessing = true;
    const { req, res, tempInput, tempOutput } = processingQueue.shift();

    try {
        // 1. Write File
        fs.writeFileSync(tempInput, req.file.buffer);

        // 2. Convert (Fastest settings)
        await new Promise((resolve, reject) => {
            ffmpeg(tempInput)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('end', resolve)
                .on('error', reject)
                .save(tempOutput);
        });

        // 3. Read
        const wavBuffer = fs.readFileSync(tempOutput);
        let wav = new WaveFile(wavBuffer);
        wav.toBitDepth('32f');
        let audioData = wav.getSamples();

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

        // 4. Transcribe
        const result = await transcriber(audioData);

        // 5. Cleanup
        try { fs.unlinkSync(tempInput); } catch (e) {}
        try { fs.unlinkSync(tempOutput); } catch (e) {}

        // Send Result
        res.json({ text: result.text.trim() });

    } catch (error) {
        console.error("Processing Error:", error);
        try { fs.unlinkSync(tempInput); } catch (e) {}
        try { fs.unlinkSync(tempOutput); } catch (e) {}
        res.status(500).json({ error: error.message });
    } finally {
        isProcessing = false;
        // Immediate check for next item
        setImmediate(processQueue);
    }
};

app.post('/v1/audio/transcriptions', upload.single('file'), (req, res) => {
    if (!transcriber) return res.status(503).json({ error: "Model loading..." });
    if (!req.file) return res.status(400).json({ error: "No file." });

    const requestId = Date.now() + Math.random();
    
    // --- UPDATED: Use System Temp Folder to avoid Permission Errors ---
    const tempInput = path.join(os.tmpdir(), `temp_input_${requestId}`);
    const tempOutput = path.join(os.tmpdir(), `temp_output_${requestId}.wav`);

    // Add to Queue instead of processing immediately
    processingQueue.push({ req, res, tempInput, tempOutput });
    
    // Trigger processor
    processQueue();
});

app.listen(port, () => {
    console.log(`🚀 Local Whisper running at http://localhost:${port}`);
});