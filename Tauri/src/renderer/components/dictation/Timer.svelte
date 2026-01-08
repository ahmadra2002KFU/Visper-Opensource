<script lang="ts">
  import { formatTime } from '../../lib/formatters';

  interface Props {
    seconds: number;
    isRecording?: boolean;
  }

  let { seconds, isRecording = false }: Props = $props();

  const formattedTime = $derived(formatTime(seconds));
</script>

<div class="timer" class:recording={isRecording}>
  <span class="time">{formattedTime}</span>
  {#if isRecording}
    <span class="dot"></span>
  {/if}
</div>

<style>
  .timer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .timer.recording {
    color: var(--color-recording);
  }

  .time {
    min-width: 50px;
    text-align: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-recording);
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
