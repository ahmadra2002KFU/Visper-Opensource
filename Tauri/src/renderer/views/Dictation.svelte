<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MicButton from '../components/dictation/MicButton.svelte';
  import Timer from '../components/dictation/Timer.svelte';
  import Waveform from '../components/dictation/Waveform.svelte';
  import TranscriptBox from '../components/dictation/TranscriptBox.svelte';
  import NavBar from '../components/layout/NavBar.svelte';
  import { AudioRecorder, type RecordingState } from '../lib/audio-recorder';
  import { playSound } from '../lib/sounds';

  type View = 'dictation' | 'history' | 'settings';

  interface Props {
    navigate: (view: View) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  }

  let { navigate, showToast }: Props = $props();

  let recordingState: RecordingState = $state('idle');
  let seconds = $state(0);
  let waveformData: number[] = $state([]);
  let transcript = $state('');
  let soundEnabled = $state(true);

  let failedAudioData: string | null = null;
  let retrying = $state(false);

  let recorder: AudioRecorder | null = null;
  let timerInterval: number | null = null;
  let recordingStartTime: number | null = null;
  let unsubscribeHotkey: (() => void) | null = null;

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    recordingStartTime = null;
  }

  onMount(async () => {
    // Get sound setting
    const settings = await window.visperAPI.settings.get();
    soundEnabled = settings.soundEnabled ?? true;

    // Initialize recorder
    recorder = new AudioRecorder({
      onWaveformData: (data) => {
        waveformData = data;
      }
    });

    // Listen for hotkey toggle
    unsubscribeHotkey = window.visperAPI.recording.onToggle(() => {
      handleToggle();
    });
  });

  onDestroy(() => {
    if (recorder) {
      recorder.cancel();
    }
    clearTimer();
    if (unsubscribeHotkey) {
      unsubscribeHotkey();
    }
  });

  async function handleToggle() {
    if (recordingState === 'idle') {
      await startRecording();
    } else if (recordingState === 'recording') {
      await stopRecording();
    } else if (recordingState === 'processing') {
      // Can't toggle while processing
    }
  }

  async function startRecording() {
    if (!recorder) return;

    const started = await recorder.start();
    if (started) {
      recordingState = 'recording';
      transcript = '';
      failedAudioData = null;
      seconds = 0;

      if (soundEnabled) playSound('start');

      // Start timer
      clearTimer();
      seconds = 0;
      recordingStartTime = Date.now();

      timerInterval = window.setInterval(() => {
        seconds = Math.floor((Date.now() - recordingStartTime!) / 1000);

        // Warning at 2 minutes
        if (seconds === 120) {
          showToast('Recording will stop at 5 minutes', 'info');
        }

        // Auto-stop at 5 minutes
        if (seconds >= 300) {
          stopRecording();
        }
      }, 250);
    } else {
      showToast('Could not access microphone', 'error');
    }
  }

  async function stopRecording() {
    // Always clear timer first, regardless of state
    clearTimer();

    if (!recorder || recordingState !== 'recording') return;

    if (soundEnabled) playSound('stop');

    // Check minimum duration
    const recordedSeconds = seconds;
    if (recordedSeconds < 0.5) {
      recorder.cancel();
      recordingState = 'idle';
      seconds = 0;
      waveformData = [];
      showToast('Recording too short', 'info');
      return;
    }

    recordingState = 'processing';
    waveformData = [];

    try {
      const audioBuffer = await recorder.stop();

      if (audioBuffer) {
        // Store audio data for potential retry
        failedAudioData = audioBuffer;

        const result = await window.visperAPI.recording.sendAudioData(audioBuffer);

        if (result.success && result.text) {
          transcript = result.text;
          failedAudioData = null; // Clear on success

          // Save to history
          await window.visperAPI.history.save(result.text, recordedSeconds);

          // Auto-copy
          await window.visperAPI.clipboard.copy(result.text);

          if (soundEnabled) playSound('success');
          showToast('Copied to clipboard!', 'success');
        } else {
          throw new Error(result.error || 'Transcription failed');
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Transcription failed', 'error');
      if (soundEnabled) playSound('error');
    } finally {
      recordingState = 'idle';
      clearTimer(); // Double-check timer is cleared
    }
  }

  async function copyAndClear() {
    if (transcript) {
      await window.visperAPI.clipboard.copy(transcript);
      showToast('Copied to clipboard!', 'success');
      transcript = '';
    }
  }

  async function handleCopy() {
    if (transcript) {
      await window.visperAPI.clipboard.copy(transcript);
      showToast('Copied to clipboard!', 'success');
    }
  }

  async function retryTranscription() {
    if (!failedAudioData || retrying) return;

    retrying = true;
    recordingState = 'processing';
    transcript = '';

    try {
      const result = await window.visperAPI.recording.sendAudioData(failedAudioData);

      if (result.success && result.text) {
        transcript = result.text;
        failedAudioData = null;

        await window.visperAPI.history.save(result.text, seconds);
        await window.visperAPI.clipboard.copy(result.text);

        if (soundEnabled) playSound('success');
        showToast('Copied to clipboard!', 'success');
      } else {
        showToast(result.error || 'Transcription failed', 'error');
        if (soundEnabled) playSound('error');
      }
    } catch (error: any) {
      showToast(error.message || 'Retry failed', 'error');
      if (soundEnabled) playSound('error');
    } finally {
      recordingState = 'idle';
      retrying = false;
    }
  }
</script>

<div class="dictation">
  <div class="main-content">
    <div class="recording-area">
      <MicButton
        state={recordingState}
        onClick={handleToggle}
        disabled={recordingState === 'processing'}
      />

      <Timer
        {seconds}
        isRecording={recordingState === 'recording'}
      />

      <Waveform
        data={waveformData}
        isActive={recordingState === 'recording'}
      />
    </div>

    <TranscriptBox
      text={transcript}
      onCopy={handleCopy}
      isLoading={recordingState === 'processing'}
    />

    {#if failedAudioData && recordingState === 'idle' && !transcript}
      <button class="retry-btn" onclick={retryTranscription} disabled={retrying}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Retry Transcription
      </button>
    {/if}
  </div>

  <NavBar currentView="dictation" {navigate} />
</div>

<style>
  .dictation {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-sm);
    gap: var(--spacing-sm);
  }

  .recording-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) 0;
  }

  .retry-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--color-accent);
    color: white;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    transition: all var(--transition-fast);
    align-self: center;
    margin: 0 var(--spacing-sm);
  }

  .retry-btn:hover {
    background: var(--color-accent-hover);
  }

  .retry-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
