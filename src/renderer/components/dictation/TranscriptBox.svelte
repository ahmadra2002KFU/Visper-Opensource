<script lang="ts">
  interface Props {
    text: string;
    onCopy: () => void;
    isLoading?: boolean;
  }

  let { text, onCopy, isLoading = false }: Props = $props();
  let copied = $state(false);

  async function handleCopy() {
    if (!text) return;
    onCopy();
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }
</script>

<div class="transcript-box" class:has-content={!!text}>
  {#if isLoading}
    <div class="loading">
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
    </div>
  {:else if text}
    <div class="text-container">
      <p class="text">{text}</p>
    </div>
    <button class="copy-btn" onclick={handleCopy} class:copied>
      {#if copied}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Copied!</span>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>Copy</span>
      {/if}
    </button>
  {:else}
    <p class="placeholder">Your transcription will appear here</p>
  {/if}
</div>

<style>
  .transcript-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    margin: 0 var(--spacing-sm);
    min-height: 60px;
    max-height: 100px;
  }

  .has-content {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
  }

  .text-container {
    flex: 1;
    overflow-y: auto;
    margin-bottom: var(--spacing-sm);
  }

  .text {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .placeholder {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-align: center;
    margin: auto;
  }

  .copy-btn {
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
    align-self: flex-end;
  }

  .copy-btn:hover {
    background: var(--color-accent-hover);
  }

  .copy-btn.copied {
    background: var(--color-success);
  }

  /* Loading animation */
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    margin: auto;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
    animation: loading-bounce 1.4s ease-in-out infinite both;
  }

  .loading-dot:nth-child(1) {
    animation-delay: -0.32s;
  }

  .loading-dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes loading-bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
</style>
