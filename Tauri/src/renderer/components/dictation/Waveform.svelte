<script lang="ts">
  interface Props {
    data: number[];
    isActive?: boolean;
  }

  let { data, isActive = false }: Props = $props();

  // Use 24 bars for visualization
  const barCount = 24;

  const bars = $derived(() => {
    if (!isActive || data.length === 0) {
      return Array(barCount).fill(0.1);
    }

    // Sample the data to get barCount values
    const step = Math.floor(data.length / barCount);
    return Array(barCount).fill(0).map((_, i) => {
      const start = i * step;
      const slice = data.slice(start, start + step);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length || 0;
      return Math.max(0.1, Math.min(1, avg * 1.5)); // Scale and clamp
    });
  });
</script>

<div class="waveform" class:active={isActive}>
  {#each bars() as height, i}
    <div
      class="bar"
      style="height: {height * 100}%; animation-delay: {i * 30}ms"
      class:animate={isActive}
    ></div>
  {/each}
</div>

<style>
  .waveform {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 40px;
    padding: 0 var(--spacing-md);
  }

  .bar {
    width: 4px;
    min-height: 4px;
    background: var(--color-text-muted);
    border-radius: var(--radius-full);
    transition: height 0.1s ease, background 0.2s ease;
  }

  .waveform.active .bar {
    background: var(--color-accent);
  }

  .bar.animate {
    animation: bounce 0.5s ease-in-out infinite alternate;
  }

  @keyframes bounce {
    from {
      transform: scaleY(0.8);
    }
    to {
      transform: scaleY(1.2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar.animate {
      animation: none;
    }
  }
</style>
