//! Planova Tauri backend.
//!
//! Keep this shell small on purpose. All domain logic lives in the TypeScript
//! frontend (React + Dexie + IndexedDB inside WebView2). The Rust side only
//! provides:
//!   - Single-instance enforcement (the app's data model assumes one writer).
//!   - Native file dialogs + filesystem access for JSON backup Export/Import.
//!
//! Network calls (OpenRouter) go through the WebView `fetch` API, not through
//! a Rust HTTP plugin. CSP in `tauri.conf.json` restricts `connect-src`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
