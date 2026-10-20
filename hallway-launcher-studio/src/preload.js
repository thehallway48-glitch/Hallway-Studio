// ============================================================================
//  HallwayLauncher Studio — Preload bridge (contextBridge)
//  Runs in an isolated context with Node access, and exposes a SAFE, minimal
//  `window.hallway` surface to the React renderer. The renderer can never
//  touch Node, child_process, or the filesystem directly — every privileged
//  capability is gated behind an explicit ipcRenderer.invoke / .on channel
//  defined in main.js.
//
//  Channels exposed:
//    invoke(channel, ...args) -> Promise<any>   (request/response)
//    on(channel, cb)          -> unsubscribe     (streaming logs from main)
//
//  Whitelisted channels are the only ones the renderer may use.
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Every channel the renderer is allowed to invoke (request/response).
const INVOKE_WHITELIST = new Set([
  'run-diagnostics',
  'open-system-folder',
  'launch-minecraft',
  'backup-worlds',
  'app:quit',
  'app:minimize',
  'app:maximize',
]);

// Every channel the renderer is allowed to subscribe to (streaming events).
const ON_WHITELIST = new Set([
  'diagnostics-log',
  'folder-log',
  'launch-log',
  'backup-log',
  'launch-stdout',
  'launch-stderr',
]);

contextBridge.exposeInMainWorld('hallway', {
  /**
   * Invoke a privileged main-process channel.
   * @param {string} channel
   * @param {...any} args
   * @returns {Promise<any>}
   */
  invoke(channel, ...args) {
    if (!INVOKE_WHITELIST.has(channel)) {
      return Promise.reject(
        new Error(`hallway.invoke: channel "${channel}" is not whitelisted`)
      );
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Subscribe to a streaming main-process event.
   * @param {string} channel
   * @param {(payload: unknown) => void} cb
   * @returns {() => void}  unsubscribe
   */
  on(channel, cb) {
    if (!ON_WHITELIST.has(channel)) {
      console.warn(`hallway.on: channel "${channel}" is not whitelisted`);
      return () => {};
    }
    const wrapped = (_event, payload) => cb(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
