import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import koffi from "koffi";

const execAsync = promisify(exec);

let user32: any = null;
let GetCursorInfo: any = null;
let LoadCursor: any = null;
let koffiLoaded = false;

// Standard Cursor IDs:
const IDC_IBEAM = 32513;     // text
const IDC_WAIT = 32514;      // wait
const IDC_CROSS = 32515;     // crosshair
const IDC_NO = 32648;        // not-allowed
const IDC_HAND = 32649;      // pointer
const IDC_APPSTARTING = 32650; // wait
const IDC_SIZEWE = 32644;    // ew-resize
const IDC_SIZENS = 32645;    // ns-resize


export class CursorHelper {
  private lastCursorShape: string = "default";

  public async getBackgroundCursor(): Promise<string> {
    if (os.platform() !== "win32") {
      return "default";
    }

    try {
      if (!koffiLoaded) {
        try {
          const POINT = koffi.struct('POINT', {
            x: 'long',
            y: 'long'
          });

          const CURSORINFO = koffi.struct('CURSORINFO', {
            cbSize: 'uint32',
            flags: 'uint32',
            hCursor: 'void*',
            ptScreenPos: POINT
          });

          user32 = koffi.load('user32.dll');
          GetCursorInfo = user32.func('bool __stdcall GetCursorInfo(_Out_ CURSORINFO *pci)');
          LoadCursor = user32.func('void* __stdcall LoadCursorA(void* hInstance, int lpCursorName)');
          koffiLoaded = true;
        } catch (e) {
          console.log("[CursorHelper ⚡] Native koffi bindings failed to load. Will fallback slightly.", e);
          koffiLoaded = true; // Mark as loaded so we don't spam try/catch, but functions remain null
        }
      }
      if (GetCursorInfo && LoadCursor) {
        // Attempt to use native Koffi execution
        let pci = {
          cbSize: 20, // 4 + 4 + 4 + 8 normally, Koffi structs can be tricky with cbSize on x64 but let's calculate
          flags: 0,
          hCursor: null,
          ptScreenPos: { x: 0, y: 0 }
        };

        // cbSize is 20 for 32-bit and 24 for 64-bit Windows usually. You must pass the correct size for the API to succeed.
        const is64 = process.arch === 'x64';
        pci.cbSize = is64 ? 24 : 20;

        let pciArray = [pci];
        const result = GetCursorInfo(pciArray);

        if (result && pciArray[0].flags === 1) { // CURSOR_SHOWING
          const currentCursor = pciArray[0].hCursor;
          if (!currentCursor) return "default";

          const currentAddress = koffi.address(currentCursor);

          // Load standard pointers
          const ibeam = LoadCursor(null, IDC_IBEAM);
          const hand = LoadCursor(null, IDC_HAND);
          const wait = LoadCursor(null, IDC_WAIT);
          const appstarting = LoadCursor(null, IDC_APPSTARTING);
          const cross = LoadCursor(null, IDC_CROSS);
          const no = LoadCursor(null, IDC_NO);
          const sizewe = LoadCursor(null, IDC_SIZEWE);
          const sizens = LoadCursor(null, IDC_SIZENS);

          if (currentAddress === koffi.address(ibeam)) return "text";
          if (currentAddress === koffi.address(hand)) return "pointer";
          if (currentAddress === koffi.address(wait) || currentAddress === koffi.address(appstarting)) return "wait";
          if (currentAddress === koffi.address(cross)) return "crosshair";
          if (currentAddress === koffi.address(no)) return "not-allowed";
          if (currentAddress === koffi.address(sizewe)) return "ew-resize";
          if (currentAddress === koffi.address(sizens)) return "ns-resize";

          return "default";
        }
      }
    } catch (error) {
      console.error("[CursorHelper ⚡] Koffi cursor fetch failed:", error);
    }

    return this.lastCursorShape; // Fallback to last known or default
  }
}
