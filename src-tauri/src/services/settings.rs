use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::path::PathBuf;
use std::fs;
use keyring::Entry;

const SERVICE_NAME: &str = "Visper";
const KEYRING_USER: &str = "api_key";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    #[serde(rename = "soundEnabled")]
    pub sound_enabled: bool,
    #[serde(rename = "firstLaunchComplete")]
    pub first_launch_complete: bool,
    pub hotkey: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            sound_enabled: true,
            first_launch_complete: false,
            hotkey: "Super+J".to_string(),
        }
    }
}

pub struct SettingsService {
    settings: Settings,
    config_path: PathBuf,
}

impl SettingsService {
    pub fn new() -> Result<Self> {
        let config_path = Self::get_config_path()?;

        // Ensure directory exists
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut settings: Settings = if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Settings::default()
        };

        // Recovery: if firstLaunchComplete is false but API key exists,
        // the user already completed setup before (settings.json was likely deleted/corrupted)
        if !settings.first_launch_complete && Self::check_api_key_exists() {
            eprintln!("[Visper] Settings recovery: API key found in keyring but firstLaunchComplete=false. Auto-recovering.");
            settings.first_launch_complete = true;
        }

        let service = Self { settings, config_path };
        service.save()?;

        Ok(service)
    }

    /// Check if an API key exists in the system keyring without returning the value
    fn check_api_key_exists() -> bool {
        match Entry::new(SERVICE_NAME, KEYRING_USER) {
            Ok(entry) => entry.get_password().is_ok(),
            Err(e) => {
                eprintln!("[Visper] Keyring access error during startup check: {}", e);
                false
            }
        }
    }

    fn get_config_path() -> Result<PathBuf> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?;
        Ok(config_dir.join("Visper").join("settings.json"))
    }

    fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.settings)?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    pub fn get_all(&self) -> Settings {
        self.settings.clone()
    }

    pub fn get(&self, key: &str) -> Option<serde_json::Value> {
        match key {
            "theme" => Some(serde_json::Value::String(self.settings.theme.clone())),
            "soundEnabled" => Some(serde_json::Value::Bool(self.settings.sound_enabled)),
            "firstLaunchComplete" => Some(serde_json::Value::Bool(self.settings.first_launch_complete)),
            "hotkey" => Some(serde_json::Value::String(self.settings.hotkey.clone())),
            _ => None,
        }
    }

    pub fn set(&mut self, key: &str, value: serde_json::Value) -> Result<()> {
        match key {
            "theme" => {
                if let Some(s) = value.as_str() {
                    self.settings.theme = s.to_string();
                }
            }
            "soundEnabled" => {
                if let Some(b) = value.as_bool() {
                    self.settings.sound_enabled = b;
                }
            }
            "firstLaunchComplete" => {
                if let Some(b) = value.as_bool() {
                    self.settings.first_launch_complete = b;
                }
            }
            "hotkey" => {
                if let Some(s) = value.as_str() {
                    self.settings.hotkey = s.to_string();
                }
            }
            _ => {}
        }
        self.save()
    }

    // Secure API key storage using system keyring (Windows Credential Manager)
    pub fn get_api_key(&self) -> Result<Option<String>> {
        let entry = Entry::new(SERVICE_NAME, KEYRING_USER)?;
        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_api_key(&mut self, key: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, KEYRING_USER)?;
        entry.set_password(key)?;
        Ok(())
    }

    pub fn clear_api_key(&self) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, KEYRING_USER)?;
        // Ignore error if credential doesn't exist
        let _ = entry.delete_credential();
        Ok(())
    }

    pub fn is_first_launch(&self) -> bool {
        !self.settings.first_launch_complete
    }

    pub fn complete_setup(&mut self) -> Result<()> {
        self.settings.first_launch_complete = true;
        self.save()
    }

    pub fn reset(&mut self) -> Result<()> {
        // Reset settings to defaults but do NOT clear the API key.
        // API key should only be deleted via explicit user action (clear_api_key).
        self.settings = Settings::default();
        self.save()?;
        Ok(())
    }
}
