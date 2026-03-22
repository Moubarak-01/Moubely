import express from 'express';
import cors from 'cors';
import path from 'path';
import { app } from 'electron';

export class LocalServerHelper {
    private static PORT = 5181;
    private server: any = null;

    public startServer() {
        if (this.server) return;

        const expApp = express();

        // Enable CORS for the local dev server and production UI
        expApp.use(cors());

        // Serve the attachments directory
        const attachmentsDir = path.join(app.getPath('userData'), 'moubely_attachments');
        const screenshotsDir = path.join(app.getPath('userData'), 'moubely_screenshots');

        // Serve main attachments statically
        expApp.use('/attachments', express.static(attachmentsDir, {
            setHeaders: (res, path) => {
                // Ensure browsers don't aggressively cache the local files so deletions work properly
                res.setHeader('Cache-Control', 'no-cache');
            }
        }));

        // Also serve screenshots, just in case we want to migrate them later
        expApp.use('/screenshots', express.static(screenshotsDir, {
            setHeaders: (res, path) => {
                res.setHeader('Cache-Control', 'no-cache');
            }
        }));

        try {
            this.server = expApp.listen(LocalServerHelper.PORT, '127.0.0.1', () => {
                console.log(`[Media Server] 🚀 Streaming active on http://127.0.0.1:${LocalServerHelper.PORT}`);
            });

            this.server.on('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    console.warn(`[Media Server] ⚠️ Port ${LocalServerHelper.PORT} is already in use. The server might already be running in another instance.`);
                } else {
                    console.error('[Media Server] ❌ Server failed to start:', err);
                }
            });
        } catch (e) {
            console.error('[Media Server] ❌ Exception during startup:', e);
        }
    }

    public static getMediaUrl(filename: string): string {
        return `http://127.0.0.1:${LocalServerHelper.PORT}/attachments/${encodeURIComponent(filename)}`;
    }
}
