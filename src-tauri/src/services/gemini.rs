use reqwest::Client;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

const TRANSCRIPTION_PROMPT: &str = r#"You are a precise audio transcription assistant. Your task is to:
1. REMOVE all filler words: "um", "uh", "er", "ah", "like" (when used as filler), "you know", "basically", verbal pauses, repeated stuttering words
2. PRESERVE the speaker's intended meaning exactly
3. CORRECT obvious grammatical speech errors while maintaining the speaker's voice
4. OUTPUT only the clean transcription text, nothing else - no quotes, no labels, no explanations
5. If audio is unclear or silent, respond with "[inaudible]"

Transcribe the audio now:"#;

const GEMINI_MODEL: &str = "gemini-3.0-flash";

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "systemInstruction")]
    system_instruction: SystemInstruction,
}

#[derive(Debug, Serialize)]
struct SystemInstruction {
    parts: Vec<TextPart>,
}

#[derive(Debug, Serialize)]
struct TextPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum Part {
    Text { text: String },
    InlineData {
        #[serde(rename = "inlineData")]
        inline_data: InlineData
    },
}

#[derive(Debug, Serialize)]
struct InlineData {
    #[serde(rename = "mimeType")]
    mime_type: String,
    data: String,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
    error: Option<GeminiError>,
}

#[derive(Debug, Deserialize)]
struct GeminiError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: ResponseContent,
}

#[derive(Debug, Deserialize)]
struct ResponseContent {
    parts: Vec<ResponsePart>,
}

#[derive(Debug, Deserialize)]
struct ResponsePart {
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub success: bool,
    pub text: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestApiResult {
    pub success: bool,
    pub error: Option<String>,
}

pub struct GeminiService {
    client: Client,
    api_key: Option<String>,
}

impl GeminiService {
    pub fn new(settings: &crate::services::SettingsService) -> Result<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()?;

        let api_key = settings.get_api_key().ok().flatten();

        Ok(Self {
            client,
            api_key,
        })
    }

    fn get_active_key(&self) -> Option<&String> {
        self.api_key.as_ref()
    }

    pub async fn transcribe(&self, audio_buffer: &[u8]) -> Result<TranscriptionResult> {
        let api_key = match self.get_active_key() {
            Some(key) => key,
            None => return Ok(TranscriptionResult {
                success: false,
                text: None,
                error: Some("No API key available. Please set your Gemini API key in Settings.".to_string()),
            }),
        };

        let base64_audio = BASE64.encode(audio_buffer);

        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![
                    Part::InlineData {
                        inline_data: InlineData {
                            mime_type: "audio/wav".to_string(),
                            data: base64_audio,
                        },
                    },
                    Part::Text {
                        text: "Transcribe this audio.".to_string(),
                    },
                ],
            }],
            system_instruction: SystemInstruction {
                parts: vec![TextPart {
                    text: TRANSCRIPTION_PROMPT.to_string(),
                }],
            },
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            GEMINI_MODEL
        );

        let response = match self.client
            .post(&url)
            .header("x-goog-api-key", api_key)
            .json(&request)
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) => {
                return Ok(TranscriptionResult {
                    success: false,
                    text: None,
                    error: Some(format!("Network error: {}", e)),
                });
            }
        };

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        if !status.is_success() {
            let error_msg = if response_text.contains("API key invalid") || response_text.contains("API_KEY_INVALID") {
                "Invalid API key. Please check your Gemini API key in Settings.".to_string()
            } else if response_text.contains("quota") || response_text.contains("RESOURCE_EXHAUSTED") {
                "API quota exceeded. Please try again later.".to_string()
            } else if response_text.contains("rate limit") || response_text.contains("RATE_LIMIT") {
                "Rate limit reached. Please wait a moment and try again.".to_string()
            } else {
                format!("API error ({}): {}", status.as_u16(), response_text)
            };

            return Ok(TranscriptionResult {
                success: false,
                text: None,
                error: Some(error_msg),
            });
        }

        let gemini_response: GeminiResponse = match serde_json::from_str(&response_text) {
            Ok(r) => r,
            Err(e) => {
                return Ok(TranscriptionResult {
                    success: false,
                    text: None,
                    error: Some(format!("Failed to parse response: {}", e)),
                });
            }
        };

        if let Some(error) = gemini_response.error {
            return Ok(TranscriptionResult {
                success: false,
                text: None,
                error: Some(error.message),
            });
        }

        let text = gemini_response.candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| c.content.parts.into_iter().next())
            .map(|p| p.text.trim().to_string())
            .unwrap_or_else(|| "[inaudible]".to_string());

        // If the result is empty or just whitespace, return [inaudible]
        let text = if text.is_empty() || text.chars().all(char::is_whitespace) {
            "[inaudible]".to_string()
        } else {
            text
        };

        Ok(TranscriptionResult {
            success: true,
            text: Some(text),
            error: None,
        })
    }

    pub async fn test_connection(&self, key: Option<&str>) -> Result<TestApiResult> {
        let api_key = key.or(self.get_active_key().map(|s| s.as_str()));

        let api_key = match api_key {
            Some(k) => k,
            None => return Ok(TestApiResult {
                success: false,
                error: Some("No API key provided".to_string()),
            }),
        };

        // Simple test request
        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part::Text {
                    text: "Say 'OK' if you can hear me.".to_string(),
                }],
            }],
            system_instruction: SystemInstruction {
                parts: vec![TextPart {
                    text: "You are a test assistant. Respond briefly.".to_string(),
                }],
            },
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            GEMINI_MODEL
        );

        let response = match self.client
            .post(&url)
            .header("x-goog-api-key", api_key)
            .json(&request)
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) => {
                return Ok(TestApiResult {
                    success: false,
                    error: Some(format!("Network error: {}", e)),
                });
            }
        };

        if response.status().is_success() {
            Ok(TestApiResult { success: true, error: None })
        } else {
            let error_text = response.text().await.unwrap_or_default();
            let error_msg = if error_text.contains("API key invalid") || error_text.contains("API_KEY_INVALID") {
                "Invalid API key".to_string()
            } else {
                "API validation failed".to_string()
            };
            Ok(TestApiResult {
                success: false,
                error: Some(error_msg),
            })
        }
    }

    pub fn update_api_key(&mut self, key: Option<String>) {
        self.api_key = key;
    }
}
