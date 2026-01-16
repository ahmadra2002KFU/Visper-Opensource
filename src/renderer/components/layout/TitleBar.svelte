<script lang="ts">
  function minimize() {
    window.visperAPI.window.minimize();
  }

  function close() {
    window.visperAPI.window.close();
  }
</script>

<div class="title-bar drag-region">
  <div class="logo">
    <svg class="logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Speech bubble shape -->
      <path d="M4 8C4 5.79086 5.79086 4 8 4H24C26.2091 4 28 5.79086 28 8V20C28 22.2091 26.2091 24 24 24H12L6 28V24H8C5.79086 24 4 22.2091 4 20V8Z" fill="url(#bubbleGradient)"/>
      <!-- Sound wave bars -->
      <rect x="10" y="10" width="2" height="8" rx="1" fill="#F97316"/>
      <rect x="13.5" y="8" width="2" height="12" rx="1" fill="#F97316"/>
      <rect x="17" y="10" width="2" height="8" rx="1" fill="#F97316"/>
      <rect x="20.5" y="11" width="2" height="6" rx="1" fill="#F97316"/>
      <defs>
        <linearGradient id="bubbleGradient" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F5F5F4"/>
          <stop offset="50%" stop-color="#44403C"/>
          <stop offset="100%" stop-color="#F97316"/>
        </linearGradient>
      </defs>
    </svg>
    <span class="app-name">Visper</span>
  </div>

  <div class="controls no-drag">
    <button class="control-btn minimize" onclick={minimize} aria-label="Minimize">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
      </svg>
    </button>
    <button class="control-btn close" onclick={close} aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 28px;
    padding: 0 var(--spacing-xs) 0 var(--spacing-sm);
    background: transparent;
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--color-text-primary);
  }

  .logo-icon {
    width: 18px;
    height: 18px;
  }

  .app-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .controls {
    display: flex;
    gap: var(--spacing-xs);
  }

  .control-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .control-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .control-btn.close:hover {
    background: var(--color-error);
    color: white;
  }
</style>
