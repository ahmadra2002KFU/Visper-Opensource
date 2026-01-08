#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod services;

use std::sync::Mutex;
use tokio::sync::Mutex as AsyncMutex;
use services::{DatabaseService, SettingsService, GeminiService};
use services::database::HistoryResult;
use services::gemini::{TranscriptionResult, TestApiResult};
use services::settings::Settings;

use tauri::{
    Manager,
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    menu::{Menu, MenuItem},
    Emitter,
    image::Image,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

// Application state
pub struct AppState {
    pub db: Mutex<DatabaseService>,
    pub settings: Mutex<SettingsService>,
    pub gemini: AsyncMutex<GeminiService>,  // Async mutex for async operations
    pub is_recording: Mutex<bool>,
}

// === RECORDING COMMANDS ===

#[tauri::command]
async fn send_audio_data(
    state: tauri::State<'_, AppState>,
    audio_buffer: Vec<u8>,
) -> Result<TranscriptionResult, String> {
    let gemini = state.gemini.lock().await;
    gemini.transcribe(&audio_buffer).await.map_err(|e| e.to_string())
}

// === HISTORY COMMANDS ===

#[tauri::command]
async fn history_get(
    state: tauri::State<'_, AppState>,
    page: u32,
    limit: u32,
) -> Result<HistoryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_transcriptions(page, limit).map_err(|e| e.to_string())
}

#[tauri::command]
async fn history_search(
    state: tauri::State<'_, AppState>,
    query: String,
    page: u32,
    limit: u32,
) -> Result<HistoryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_transcriptions(&query, page, limit).map_err(|e| e.to_string())
}

#[tauri::command]
async fn history_save(
    state: tauri::State<'_, AppState>,
    text: String,
    duration_seconds: f64,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_transcription(&text, duration_seconds).map_err(|e| e.to_string())
}

#[tauri::command]
async fn history_delete(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_transcription(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn history_clear(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.clear_history().map_err(|e| e.to_string())
}

// === SETTINGS COMMANDS ===

#[tauri::command]
async fn settings_get(
    state: tauri::State<'_, AppState>,
) -> Result<Settings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.get_all())
}

#[tauri::command]
async fn settings_set(
    state: tauri::State<'_, AppState>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.set(&key, value).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_api_key(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.get_api_key().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct SetApiKeyResult {
    success: bool,
    error: Option<String>,
}

#[tauri::command]
async fn set_api_key(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<SetApiKeyResult, String> {
    // First, set the API key in settings
    {
        let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
        if let Err(e) = settings.set_api_key(&key) {
            return Ok(SetApiKeyResult { success: false, error: Some(e.to_string()) });
        }
    }

    // Then, update Gemini service with new key
    {
        let mut gemini = state.gemini.lock().await;
        gemini.update_api_key(Some(key));
    }

    Ok(SetApiKeyResult { success: true, error: None })
}

#[tauri::command]
async fn test_api(
    state: tauri::State<'_, AppState>,
    key: Option<String>,
) -> Result<TestApiResult, String> {
    let gemini = state.gemini.lock().await;
    gemini.test_connection(key.as_deref()).await.map_err(|e| e.to_string())
}

// === APP COMMANDS ===

#[tauri::command]
async fn is_first_launch(
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.is_first_launch())
}

#[tauri::command]
async fn complete_setup(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.complete_setup().map_err(|e| e.to_string())
}

// === TRAY & HOTKEY SETUP ===

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let quit = MenuItem::with_id(app, "quit", "Quit Visper", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Start Recording", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &show, &quit])?;

    // Load icon from resources
    let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
        Image::from_bytes(include_bytes!("../icons/icon.png")).unwrap()
    });

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Visper - Press Win+J to dictate")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "quit" => app.exit(0),
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "toggle" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("hotkey:toggle-recording", ());
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_hotkey(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Primary: Super+J (Windows key + J)
    let shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyJ);

    let app_handle = app.handle().clone();
    if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("hotkey:toggle-recording", ());
        }
    }) {
        eprintln!("Failed to register Win+J hotkey: {}", e);

        // Fallback: Ctrl+Alt+J
        let fallback = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyJ);
        let app_handle2 = app.handle().clone();
        let _ = app.global_shortcut().on_shortcut(fallback, move |_app, _shortcut, _event| {
            if let Some(window) = app_handle2.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("hotkey:toggle-recording", ());
            }
        });
    }

    Ok(())
}

fn position_window_center(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let window_size = window.outer_size()?;

        let x = ((size.width as f64 / scale) as i32 - window_size.width as i32) / 2;
        let y = ((size.height as f64 / scale) as i32 - window_size.height as i32) / 2;

        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window on second instance
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize services
            let settings = SettingsService::new()
                .expect("Failed to initialize settings service");
            let db = DatabaseService::new()
                .expect("Failed to initialize database service");
            let gemini = GeminiService::new(&settings)
                .expect("Failed to initialize Gemini service");

            // Create application state
            let state = AppState {
                db: Mutex::new(db),
                settings: Mutex::new(settings),
                gemini: AsyncMutex::new(gemini),
                is_recording: Mutex::new(false),
            };
            app.manage(state);

            // Setup system tray
            setup_tray(app)?;

            // Setup global shortcut
            setup_hotkey(app)?;

            // Position window at center and show after a delay
            if let Some(window) = app.get_webview_window("main") {
                let _ = position_window_center(&window);

                // Show window after initialization
                let window_clone = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = window_clone.show();
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_audio_data,
            history_get,
            history_search,
            history_save,
            history_delete,
            history_clear,
            settings_get,
            settings_set,
            get_api_key,
            set_api_key,
            test_api,
            is_first_launch,
            complete_setup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
