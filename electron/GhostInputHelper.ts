import { BrowserWindow, app } from "electron"
import { AppState } from "./main"

const WH_KEYBOARD_LL = 13;
const WM_KEYDOWN = 0x0100;
const WM_SYSKEYDOWN = 0x0104;

const VK_BACK = 0x08;
const VK_TAB = 0x09;
const VK_RETURN = 0x0D;
const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_MENU = 0x12; // Alt
const VK_CAPITAL = 0x14;
const VK_ESCAPE = 0x1B;
const VK_SPACE = 0x20;
const VK_PRIOR = 0x21; // Page Up
const VK_NEXT = 0x22;  // Page Down
const VK_END = 0x23;
const VK_HOME = 0x24;
const VK_LEFT = 0x25;
const VK_UP = 0x26;
const VK_RIGHT = 0x27;
const VK_DOWN = 0x28;
const VK_INSERT = 0x2D;
const VK_DELETE = 0x2E;
const VK_Z = 0x5A;
const VK_LWIN = 0x5B;
const VK_RWIN = 0x5C;
const VK_LSHIFT = 0xA0;
const VK_RSHIFT = 0xA1;
const VK_LCONTROL = 0xA2;
const VK_RCONTROL = 0xA3;
const VK_LMENU = 0xA4;
const VK_RMENU = 0xA5;

let koffi: any;
let user32: any;
let SetWindowsHookExW: any;
let UnhookWindowsHookEx: any;
let CallNextHookEx: any;
let GetKeyboardState: any;
let ToUnicode: any;
let GetAsyncKeyState: any;

let isLoaded = false;

function initKoffi() {
    if (isLoaded || process.platform !== "win32") return;
    try {
        koffi = require("koffi");
        user32 = koffi.load("user32.dll");

        const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
            vkCode: 'uint32',
            scanCode: 'uint32',
            flags: 'uint32',
            time: 'uint32',
            dwExtraInfo: 'int64'
        });

        const HookProc = koffi.proto('int64 __stdcall HookProc(int nCode, int64 wParam, void *lParam)');

        SetWindowsHookExW = user32.func('int64 __stdcall SetWindowsHookExW(int idHook, HookProc *lpfn, void* hMod, uint32 dwThreadId)');
        UnhookWindowsHookEx = user32.func('bool __stdcall UnhookWindowsHookEx(int64 hhk)');
        CallNextHookEx = user32.func('int64 __stdcall CallNextHookEx(int64 hhk, int nCode, int64 wParam, void *lParam)');
        GetKeyboardState = user32.func('bool __stdcall GetKeyboardState(uint8 *lpKeyState)');
        ToUnicode = user32.func('int __stdcall ToUnicode(uint32 wVirtKey, uint32 wScanCode, const uint8 *lpKeyState, _Out_ char16_t *pwszBuff, int cchBuff, uint32 wFlags)');
        GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int vKey)');

        isLoaded = true;
    } catch (e) {
        console.error("[GhostInput] ❌ Failed to load Koffi APIs", e);
    }
}

export class GhostInputHelper {
    private appState: AppState;
    private hookHandle: any = null;
    private hookCallback: any = null;
    public isActive: boolean = false;

    constructor(appState: AppState) {
        this.appState = appState;
        initKoffi();
    }

    public toggle(): void {
        if (!isLoaded) return;
        
        if (this.isActive) {
            this.disable();
        } else {
            this.enable();
        }
    }

    public disable(): void {
        if (!isLoaded || !this.isActive || !this.hookHandle) return;

        try {
            UnhookWindowsHookEx(this.hookHandle);
            koffi.unregister(this.hookCallback);
            this.hookHandle = null;
            this.hookCallback = null;
            this.isActive = false;
            this.sendState();
            console.log("[GhostInput] 🛑 Ghost Intercept DISABLED.");
        } catch (e) {
            console.error("[GhostInput] ❌ Error disabling hook", e);
        }
    }

    public enable(): void {
        if (!isLoaded || this.isActive || this.hookHandle) return;

        try {
            this.hookCallback = koffi.register((nCode: number, wParam: any, lParam: any) => {
                if (nCode >= 0) {
                    const wParamNum = Number(wParam);
                    if (wParamNum === WM_KEYDOWN || wParamNum === WM_SYSKEYDOWN) {
                        try {
                            const struct = koffi.decode(lParam, 'KBDLLHOOKSTRUCT');
                            const vkCode = struct.vkCode;
                            const scanCode = struct.scanCode;

                            // 1. Check for modifiers (Ctrl, Alt, Win)
                            const ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) !== 0;
                            const altDown = (GetAsyncKeyState(VK_MENU) & 0x8000) !== 0;
                            const winDown = (GetAsyncKeyState(VK_LWIN) & 0x8000) !== 0 || (GetAsyncKeyState(VK_RWIN) & 0x8000) !== 0;

                            // 2. Detect Shift+Z for Toggle (Our Rescue Key)
                            const shiftDown = (GetAsyncKeyState(VK_SHIFT) & 0x8000) !== 0;
                            if (vkCode === VK_Z && shiftDown && !ctrlDown && !altDown && !winDown) {
                                setImmediate(() => this.disable());
                                return 1; // Block Shift+Z
                            }

                            // 3. If any main modifier is held (Ctrl, Alt, Win), let the shortcut pass through
                            if (ctrlDown || altDown || winDown) {
                                return CallNextHookEx(this.hookHandle, nCode, wParam, lParam);
                            }

                            // 4. Pass through system/navigation/modifier keys (so they function normally)
                            if (
                                vkCode === VK_SHIFT || vkCode === VK_LSHIFT || vkCode === VK_RSHIFT ||
                                vkCode === VK_CONTROL || vkCode === VK_LCONTROL || vkCode === VK_RCONTROL ||
                                vkCode === VK_MENU || vkCode === VK_LMENU || vkCode === VK_RMENU ||
                                vkCode === VK_CAPITAL || vkCode === VK_ESCAPE || vkCode === VK_TAB ||
                                (vkCode >= 0x21 && vkCode <= 0x2E) || // PageUp to Delete
                                (vkCode >= 0x70 && vkCode <= 0x87)    // F1 to F24
                            ) {
                                return CallNextHookEx(this.hookHandle, nCode, wParam, lParam);
                            }

                            // 5. Intercept typing for Moubely
                            if (vkCode === VK_BACK) {
                                this.sendToFrontend({ action: 'backspace' });
                                return 1; // Block
                            }

                            if (vkCode === VK_RETURN) {
                                this.sendToFrontend({ action: 'enter' });
                                return 1; // Block
                            }

                            // 6. Character Translation
                            const keyState = Buffer.alloc(256);
                            GetKeyboardState(keyState);
                            const outBuffer = Buffer.alloc(4);
                            const res = ToUnicode(vkCode, scanCode, keyState, outBuffer, 2, 0);
                            
                            if (res > 0) {
                                const char = outBuffer.toString('utf16le').substring(0, res);
                                if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127) {
                                    this.sendToFrontend({ char });
                                    return 1; // Block only if printable
                                }
                            }

                            return 1; // Block other non-system keys
                        } catch (err) {
                            console.error("[GhostInput] hook proc error", err);
                        }
                    }
                }
                return CallNextHookEx(this.hookHandle, nCode, wParam, lParam);
            }, koffi.pointer('HookProc'));

            this.hookHandle = SetWindowsHookExW(WH_KEYBOARD_LL, this.hookCallback, null, 0);
            
            if (this.hookHandle) {
                this.isActive = true;
                this.sendState();
                console.log("[GhostInput] 👻 Ghost Intercept ENABLED.");
            } else {
                console.error("[GhostInput] ❌ Failed to set keyboard hook.");
                koffi.unregister(this.hookCallback);
                this.hookCallback = null;
            }
        } catch (e) {
            console.error("[GhostInput] ❌ Error enabling hook", e);
        }
    }

    private sendToFrontend(data: { char?: string, action?: 'backspace' | 'enter' }) {
        const win = this.appState.getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send("ghost-typing-input", data);
        }
    }

    private sendState() {
        const win = this.appState.getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send("ghost-typing-state", this.isActive);
        }
    }
}
