import axios from "axios";
import fs from "fs";
import path from "path";
import { app } from "electron";
import crypto from "crypto";

export interface GenerationRequest {
    prompt: string;
    model: string;
    aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}

export interface GenerationResponse {
    type: "image" | "video";
    localUri: string; // The moubely-local:// URI
    originalPrompt: string;
}

export class GenerationHelper {
    private geminiKey: string;

    constructor(apiKey?: string) {
        this.geminiKey = apiKey || process.env.GEMINI_API_KEY || "";
        if (!this.geminiKey) {
            console.warn("[GenAI] ⚠️ Missing GEMINI_API_KEY. Image/Video generation will fail.");
        }
    }

    /**
     * Determines if a model string is a generative media model
     */
    public static isMediaModel(modelName: string): boolean {
        const mediaModels = [
            'imagen-4.0',
            'veo-2.0',
            'veo-3.0',
            'veo-3.1',
            'gemini-2.5-flash-image',
            'gemini-3-pro-image-preview',
            'gemini-3.1-flash-image-preview'
        ];
        return mediaModels.some(m => modelName.toLowerCase().includes(m));
    }

    /**
     * Executes the generation request and saves the result to disk.
     */
    public async generateMedia(request: GenerationRequest): Promise<GenerationResponse> {
        if (!this.geminiKey) throw new Error("GEMINI_API_KEY is not configured.");

        console.log(`[GenAI] 🎨 Starting generation using ${request.model}...`);

        const isVideo = request.model.toLowerCase().includes("veo");
        const endpointModel = this.mapModelToEndpoint(request.model);

        try {
            if (isVideo) {
                return await this.generateVideo(request.prompt, endpointModel);
            } else if (request.model.includes("gemini")) {
                // Nano Banana variants use generateContent
                return await this.generateBananaImage(request.prompt, endpointModel);
            } else {
                // Imagen 4 variants use predict
                return await this.generateImagenImage(request.prompt, endpointModel, request.aspectRatio || "16:9");
            }
        } catch (error: any) {
            if (error.response) {
                console.error("[GenAI] ❌ API Error Details:", JSON.stringify(error.response.data, null, 2));
            } else {
                console.error("[GenAI] ❌ Network/System Error:", error.message);
            }
            throw new Error(error.response?.data?.error?.message || error.message || "Failed to generate media.");
        }
    }

    private mapModelToEndpoint(model: string): string {
        // Models are now passed as exact physical IDs from the filtered UI list
        return model;
    }

    private async generateImagenImage(prompt: string, model: string, aspectRatio: string): Promise<GenerationResponse> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.geminiKey}`;

        const payload = {
            instances: [{ prompt: prompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: aspectRatio,
                outputOptions: { mimeType: "image/jpeg" }
            }
        };

        const response = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });

        const predictions = response.data.predictions;
        if (!predictions || predictions.length === 0) throw new Error("No image data returned from Imagen API.");

        // Try all known Google naming conventions for base64 image bytes
        const base64Data = predictions[0].bytesBase64Encoded || predictions[0].bytesBase64 || predictions[0].data || predictions[0].base64;

        if (!base64Data) {
            throw new Error(`Imagen API returned predictions but no image data field found.`);
        }

        const savedUri = await this.saveMediaToDisk(Buffer.from(base64Data, "base64"), "jpg");

        return { type: "image", localUri: savedUri, originalPrompt: prompt };
    }

    private async generateBananaImage(prompt: string, model: string): Promise<GenerationResponse> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        const response = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
        const parts = response.data.candidates?.[0]?.content?.parts;

        if (!parts) throw new Error("No response parts returned from Banana API.");

        // Find the first part that contains inlineData (image)
        const imagePart = parts.find((p: any) => p.inlineData?.data);
        if (!imagePart) throw new Error("Banana API returned text but no image data. Try a more descriptive art prompt.");

        const base64Data = imagePart.inlineData.data;
        const savedUri = await this.saveMediaToDisk(Buffer.from(base64Data, "base64"), "jpg");

        return { type: "image", localUri: savedUri, originalPrompt: prompt };
    }

    private async generateVideo(prompt: string, model: string): Promise<GenerationResponse> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${this.geminiKey}`;

        const payload = {
            instances: [{ prompt: prompt }],
            parameters: { durationSeconds: 6 }
        };

        console.log(`[GenAI] 🎥 Requesting video from ${model}...`);
        const response = await axios.post(url, payload);
        const operationName = response.data.name;

        if (!operationName) throw new Error("Failed to start Video generation operation.");

        // Polling loop
        let isDone = false;
        let finalResponse: any = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes at 5s intervals

        while (!isDone && attempts < maxAttempts) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));
            console.log(`[GenAI] ⏳ Checking video status (Attempt ${attempts})...`);

            const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${this.geminiKey}`;
            const statusRes = await axios.get(statusUrl);

            if (statusRes.data.done) {
                isDone = true;
                finalResponse = statusRes.data;
            }
        }

        if (!finalResponse?.response) {
            throw new Error("Video generation timed out or failed on server.");
        }

        // Final Path Mapping from Trace: generateVideoResponse.generatedSamples[0].video.uri
        const res = finalResponse.response;
        const videoUri = res.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        const videoBytes = res.videoBytes || (res.predictions?.[0]?.bytesBase64Encoded || res.predictions?.[0]?.bytesBase64 || res.predictions?.[0]?.data);

        let savedUri = "";

        if (videoUri) {
            console.log(`[GenAI] 📥 Downloading physical video from URI...`);
            // The URI usually requires the API key to download media
            const downloadRes = await axios.get(`${videoUri}&key=${this.geminiKey}`, { responseType: 'arraybuffer' });
            savedUri = await this.saveMediaToDisk(Buffer.from(downloadRes.data), "mp4");
        } else if (videoBytes) {
            savedUri = await this.saveMediaToDisk(Buffer.from(videoBytes, 'base64'), "mp4");
        } else {
            throw new Error(`Video generation complete but physical data (URI or Bytes) not found.`);
        }

        return { type: "video", localUri: savedUri, originalPrompt: prompt };
    }

    private async saveMediaToDisk(data: Buffer, extension: string): Promise<string> {
        const userDataPath = app.getPath("userData");
        const attachmentsDir = path.join(userDataPath, 'moubely_attachments');

        if (!fs.existsSync(attachmentsDir)) {
            fs.mkdirSync(attachmentsDir, { recursive: true });
        }

        const fileName = `gen_${crypto.randomBytes(8).toString('hex')}.${extension}`;
        const filePath = path.join(attachmentsDir, fileName);

        try {
            await fs.promises.writeFile(filePath, data);
        } catch (err: any) {
            throw new Error(`Failed to write generated ${extension} to disk: ${err.message}`);
        }

        return `moubely-local://${filePath.replace(/\\/g, '/')}`;
    }
}
