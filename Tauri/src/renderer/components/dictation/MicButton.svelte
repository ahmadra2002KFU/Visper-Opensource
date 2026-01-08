<script lang="ts">
  import type { RecordingState } from '../../lib/audio-recorder';

  interface Props {
    state: RecordingState;
    onClick: () => void;
    disabled?: boolean;
  }

  let { state, onClick, disabled = false }: Props = $props();

  const isRecording = $derived(state === 'recording');
  const isProcessing = $derived(state === 'processing');
</script>

<button
  class="mic-button"
  class:recording={isRecording}
  class:processing={isProcessing}
  onclick={onClick}
  {disabled}
  aria-label={isRecording ? 'Stop recording' : isProcessing ? 'Processing...' : 'Start recording'}
>
  {#if isProcessing}
    <div class="spinner"></div>
  {:else}
    <svg class="mic-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  {/if}

  {#if isRecording}
    <div class="pulse-ring pulse-1"></div>
    <div class="pulse-ring pulse-2"></div>
    <div class="pulse-ring pulse-3"></div>
  {/if}
</button>

<style>
  .mic-button {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-base);
    box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);
  }

  .mic-button:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
  }

  .mic-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .mic-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mic-button.recording {
    background: var(--color-recording);
    box-shadow: 0 4px 14px var(--color-recording-glow);
    animation: breathing 1.5s ease-in-out infinite;
  }

  .mic-button.processing {
    background: var(--color-text-muted);
    box-shadow: none;
  }

  .mic-icon {
    transition: transform var(--transition-base);
  }

  .mic-button.recording .mic-icon {
    transform: scale(1.1);
  }

  /* Spinner */
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Pulse rings */
  .pulse-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--color-recording);
    transform: translate(-50%, -50%);
    opacity: 0;
  }

  .pulse-1 {
    animation: pulse-expand 2s ease-out infinite;
  }

  .pulse-2 {
    animation: pulse-expand 2s ease-out infinite 0.5s;
  }

  .pulse-3 {
    animation: pulse-expand 2s ease-out infinite 1s;
  }

  @keyframes breathing {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.03);
    }
  }

  @keyframes pulse-expand {
    0% {
      width: 100%;
      height: 100%;
      opacity: 0.6;
    }
    100% {
      width: 180%;
      height: 180%;
      opacity: 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mic-button.recording {
      animation: none;
    }

    .pulse-ring {
      display: none;
    }
  }
</style>
