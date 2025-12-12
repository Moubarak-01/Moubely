import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';
import { WaveFile } from 'wavefile';

const app = express();
const port = 3000;

// Configure upload storage (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Global variable to hold the model pipeline
let transcriber = null;

// Initialize the model (downloads automatically on first run)
console.log("⏳ Loading Local Whisper Model (this may take a moment)...");
const initModel = async () => {
    // Uses 'Xenova/whisper-tiny.en' for speed.
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
    console.log("✅ Local Whisper Model Ready!");
};
initModel();

// The "API" Endpoint
app.post('/v1/audio/transcriptions', upload.single('file'), async (req, res) => {
    try {
        if (!transcriber) {
            return res.status(503).json({ error: "Model is still loading. Please try again in a few seconds." });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No audio file provided." });
        }

        console.log(`🎤 Processing audio chunk: ${req.file.size} bytes`);

        // Convert buffer to Float32 WAV (required by Transformers.js)
        let wav = new WaveFile(req.file.buffer);
        wav.toBitDepth('32f');
        wav.toSampleRate(16000);
        let audioData = wav.getSamples();
        
        if (Array.isArray(audioData)) {
            if (audioData.length > 1) {
                // If stereo, mix to mono
                const mono = new Float32Array(audioData[0].length);
                for (let i = 0; i < audioData[0].length; i++) {
                    mono[i] = (audioData[0][i] + audioData[1][i]) / 2;
                }
                audioData = mono;
            } else {
                audioData = audioData[0];
            }
        }

        // Run the transcription
        const result = await transcriber(audioData);
        
        console.log(`✅ Transcription: "${result.text}"`);
        res.json({ text: result.text.trim() });

    } catch (error) {
        console.error("Transcription Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Local Whisper API running at http://localhost:${port}`);
});