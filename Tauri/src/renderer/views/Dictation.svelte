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

  let recorder: AudioRecorder | null = null;
  let timerInterval: number | null = null;
  let unsubscribeHotkey: (() => void) | null = null;

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
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
    } else if (transcript) {
      // In result state - copy and clear
      await copyAndClear();
    }
  }

  async function startRecording() {
    if (!recorder) return;

    const started = await recorder.start();
    if (started) {
      recordingState = 'recording';
      transcript = '';
      seconds = 0;

      if (soundEnabled) playSound('start');

      // Start timer
      timerInterval = window.setInterval(() => {
        seconds++;

        // Warning at 2 minutes
        if (seconds === 120) {
          showToast('Recording will stop at 5 minutes', 'info');
        }

        // Auto-stop at 5 minutes
        if (seconds >= 300) {
          stopRecording();
        }
      }, 1000);
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
        const result = await window.visperAPI.recording.sendAudioData(audioBuffer);

        if (result.success && result.text) {
          transcript = result.text;

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
</style>
