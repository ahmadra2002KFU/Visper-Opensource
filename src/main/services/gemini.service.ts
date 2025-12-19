import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { SettingsService } from './settings.service.js';

const TRANSCRIPTION_PROMPT = `You are a precise audio transcription assistant. Your task is to:
1. REMOVE all filler words: "um", "uh", "er", "ah", "like" (when used as filler), "you know", "basically", verbal pauses, repeated stuttering words
2. PRESERVE the speaker's intended meaning exactly
3. CORRECT obvious grammatical speech errors while maintaining the speaker's voice
4. OUTPUT only the clean transcription text, nothing else - no quotes, no labels, no explanations
5. If audio is unclear or silent, respond with "[inaudible]"

Transcribe the audio now:`;

export class GeminiService {
  private settingsService: SettingsService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
    this.initializeClient();
  }

  private async initializeClient() {
    const apiKey = await this.getActiveApiKey();
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        systemInstruction: TRANSCRIPTION_PROMPT
      });
    }
  }

  private async getActiveApiKey(): Promise<string | null> {
    const userKey = await this.settingsService.getApiKey();
    if (userKey) return userKey;

    // Default key from environment
    return process.env.VITE_DEFAULT_GEMINI_KEY || null;
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    if (!this.model) {
      await this.initializeClient();
    }

    if (!this.model) {
      throw new Error('Gemini API not initialized. Please check your API key.');
    }

    // Convert ArrayBuffer to base64
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    try {
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        },
        { text: 'Transcribe this audio.' }
      ]);

      const response = await result.response;
      const text = response.text().trim();

      return text || '[inaudible]';
    } catch (error: any) {
      console.error('Gemini transcription error:', error);

      // Handle specific error types
      if (error.message?.includes('API key')) {
        throw new Error('Invalid API key. Please check your settings.');
      }
      if (error.message?.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later.');
      }
      if (error.message?.includes('rate')) {
        throw new Error('Rate limit reached. Please wait a moment.');
      }

      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  async testConnection(apiKey?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const keyToTest = apiKey || await this.getActiveApiKey();

      if (!keyToTest) {
        return { success: false, error: 'No API key available' };
      }

      const testAI = new GoogleGenerativeAI(keyToTest);
      const testModel = testAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Simple test - just list models or do a minimal request
      const result = await testModel.generateContent('Say "OK" if you can hear me.');
      const response = await result.response;
      const text = response.text();

      if (text) {
        // If testing with a new key, update the client
        if (apiKey && apiKey !== await this.getActiveApiKey()) {
          this.genAI = testAI;
          this.model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            systemInstruction: TRANSCRIPTION_PROMPT
          });
        }
        return { success: true };
      }

      return { success: false, error: 'No response from API' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async refreshClient() {
    await this.initializeClient();
  }
}
