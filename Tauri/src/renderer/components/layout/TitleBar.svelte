<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import logoSrc from '../../logo.png';

  function minimize() {
    window.visperAPI.window.minimize();
  }

  function close() {
    window.visperAPI.window.close();
  }

  function startDrag(e: MouseEvent) {
    // Only start dragging if clicking on the drag region itself, not controls
    const target = e.target as HTMLElement;
    if (!target.closest('.no-drag')) {
      getCurrentWindow().startDragging();
    }
  }
</script>

<div class="title-bar drag-region" onmousedown={startDrag}>
  <div class="logo">
    <img src={logoSrc} alt="Visper" class="logo-img" />
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
    height: 36px;
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

  .logo-img {
    width: 18px;
    height: 18px;
    object-fit: contain;
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
    width: 32px;
    height: 32px;
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
