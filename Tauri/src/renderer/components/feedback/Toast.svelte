<script lang="ts">
  interface Props {
    message: string;
    type?: 'success' | 'error' | 'info';
  }

  let { message, type = 'info' }: Props = $props();

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`
  };
</script>

<div class="toast {type}" class:animate-fadeIn={true} role="status" aria-live="polite">
  <span class="icon" aria-hidden="true">{@html icons[type]}</span>
  <span class="message">{message}</span>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .toast.success .icon {
    color: var(--color-success);
  }

  .toast.error .icon {
    color: var(--color-error);
  }

  .toast.info .icon {
    color: var(--color-accent);
  }

  .icon {
    display: flex;
    flex-shrink: 0;
  }

  .message {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }
</style>
