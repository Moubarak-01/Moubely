import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';
import wavefile from 'wavefile';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';

const { WaveFile } = wavefile;

// Configure FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3000;

// Setup upload handling
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

let transcriber = null;

console.log("⏳ Loading Local Whisper Model (this may take a moment)...");
const initModel = async () => {
    // 'Xenova/whisper-tiny.en' is the fast, English-only model
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
    console.log("✅ Local Whisper Model Ready!");
};
initModel();

// IMPORTANT: This is the specific address the app must call
app.post('/v1/audio/transcriptions', upload.single('file'), async (req, res) => {
    const tempInput = `temp_input_${Date.now()}`;
    const tempOutput = `temp_output_${Date.now()}.wav`;

    try {
        if (!transcriber) return res.status(503).json({ error: "Model is still loading..." });
        if (!req.file) return res.status(400).json({ error: "No file uploaded." });

        console.log(`🎤 Processing ${req.file.size} bytes...`);

        // 1. Write the raw upload to disk
        fs.writeFileSync(tempInput, req.file.buffer);

        // 2. Convert to 16kHz Mono WAV using FFmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(tempInput)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('end', resolve)
                .on('error', reject)
                .save(tempOutput);
        });

        // 3. Read the clean WAV file
        const wavBuffer = fs.readFileSync(tempOutput);
        let wav = new WaveFile(wavBuffer);
        wav.toBitDepth('32f'); 
        let audioData = wav.getSamples();

        // Handle stereo to mono conversion if needed
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
        console.log(`✅ Text: "${result.text}"`);
        
        // 5. Cleanup temp files
        try { fs.unlinkSync(tempInput); } catch (e) {}
        try { fs.unlinkSync(tempOutput); } catch (e) {}

        // SUCCESS: Send the JSON back to the app
        res.json({ text: result.text.trim() });

    } catch (error) {
        // Cleanup on error
        try { fs.unlinkSync(tempInput); } catch (e) {}
        try { fs.unlinkSync(tempOutput); } catch (e) {}
        
        console.error("Transcribe Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Local Whisper running at http://localhost:${port}`);
});