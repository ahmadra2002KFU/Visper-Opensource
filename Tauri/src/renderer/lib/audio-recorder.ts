export type RecordingState = 'idle' | 'recording' | 'processing';

export interface AudioRecorderOptions {
  onDataAvailable?: (data: Blob) => void;
  onVolumeChange?: (volume: number) => void;
  onWaveformData?: (data: number[]) => void;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private animationFrame: number | null = null;
  private options: AudioRecorderOptions;

  state: RecordingState = 'idle';

  constructor(options: AudioRecorderOptions = {}) {
    this.options = options;
  }

  async start(): Promise<boolean> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      // Set up audio context for visualization
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.state = 'recording';

      // Start visualization loop
      this.startVisualization();

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  async stop(): Promise<ArrayBuffer | null> {
    if (!this.mediaRecorder || this.state !== 'recording') {
      return null;
    }

    this.state = 'processing';
    this.stopVisualization();

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        // Create blob from chunks
        const webmBlob = new Blob(this.chunks, { type: 'audio/webm' });

        // Convert to WAV for Gemini
        const wavBuffer = await this.convertToWav(webmBlob);

        // Clean up
        this.cleanup();

        resolve(wavBuffer);
      };

      this.mediaRecorder!.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    this.state = 'idle';
  }

  private cleanup(): void {
    this.stopVisualization();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private startVisualization(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualization = () => {
      if (!this.analyser || this.state !== 'recording') return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate volume (RMS)
      const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
      const rms = Math.sqrt(sum / bufferLength);
      const volume = Math.min(1, rms / 128);

      if (this.options.onVolumeChange) {
        this.options.onVolumeChange(volume);
      }

      // Send waveform data
      if (this.options.onWaveformData) {
        const waveformData = Array.from(dataArray).map(v => v / 255);
        this.options.onWaveformData(waveformData);
      }

      this.animationFrame = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  }

  private stopVisualization(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private async convertToWav(webmBlob: Blob): Promise<ArrayBuffer> {
    // Decode WebM to raw audio
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await webmBlob.arrayBuffer();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get mono channel data
      const channelData = audioBuffer.getChannelData(0);

      // Create WAV file
      const wavBuffer = this.encodeWav(channelData, 16000);

      audioContext.close();
      return wavBuffer;
    } catch (error) {
      console.error('Error converting to WAV:', error);
      audioContext.close();
      // Return original buffer if conversion fails
      return arrayBuffer;
    }
  }

  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels (mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
