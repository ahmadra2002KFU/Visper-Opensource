<script lang="ts">
  import { onMount } from 'svelte';
  import NavBar from '../components/layout/NavBar.svelte';

  type View = 'dictation' | 'history' | 'settings';

  interface Props {
    navigate: (view: View) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  }

  let { navigate, showToast }: Props = $props();

  let apiKey = $state('');
  let hasCustomKey = $state(false);
  let theme = $state<'light' | 'dark' | 'system'>('light');
  let soundEnabled = $state(true);
  let isTesting = $state(false);
  let isSaving = $state(false);

  onMount(async () => {
    const settings = await window.visperAPI.settings.get();
    theme = settings.theme || 'light';
    soundEnabled = settings.soundEnabled ?? true;

    const savedKey = await window.visperAPI.settings.getApiKey();
    hasCustomKey = !!savedKey;
    if (savedKey) {
      apiKey = '••••••••••••••••••••';
    }
  });

  async function testApiKey() {
    if (!apiKey || apiKey.startsWith('•')) {
      showToast('Enter a new API key to test', 'info');
      return;
    }

    isTesting = true;
    try {
      const result = await window.visperAPI.settings.testApi(apiKey);
      if (result.success) {
        showToast('API key is valid!', 'success');
      } else {
        showToast(result.error || 'Invalid API key', 'error');
      }
    } catch (error) {
      showToast('Failed to test API key', 'error');
    } finally {
      isTesting = false;
    }
  }

  async function saveApiKey() {
    if (!apiKey || apiKey.startsWith('•')) {
      return;
    }

    isSaving = true;
    try {
      const result = await window.visperAPI.settings.setApiKey(apiKey);
      if (result && result.success) {
        hasCustomKey = true;
        apiKey = '••••••••••••••••••••';
        showToast('API key saved', 'success');
      } else {
        showToast(result?.error || 'Failed to save API key', 'error');
      }
    } catch (error) {
      showToast('Failed to save API key', 'error');
    } finally {
      isSaving = false;
    }
  }

  async function handleThemeChange(newTheme: 'light' | 'dark' | 'system') {
    theme = newTheme;
    await window.visperAPI.settings.set('theme', theme);

    // Apply theme
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  async function handleSoundToggle() {
    soundEnabled = !soundEnabled;
    await window.visperAPI.settings.set('soundEnabled', soundEnabled);
  }

  async function clearHistory() {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      try {
        await window.visperAPI.history.clear();
        showToast('History cleared', 'success');
      } catch (error) {
        showToast('Failed to clear history', 'error');
      }
    }
  }
</script>

<div class="settings">
  <div class="header">
    <h2>Settings</h2>
  </div>

  <div class="settings-container">
    <!-- API Key Section -->
    <section class="section">
      <h3>Gemini API Key</h3>
      <p class="section-desc">
        {#if hasCustomKey}
          API key configured
        {:else}
          No API key set - required for transcription
        {/if}
      </p>

      <div class="input-group">
        <input
          type="password"
          placeholder="Enter your Gemini API key"
          bind:value={apiKey}
          onfocus={() => { if (apiKey.startsWith('•')) apiKey = ''; }}
        />
        <div class="input-actions">
          <button
            class="btn secondary"
            onclick={testApiKey}
            disabled={isTesting || !apiKey || apiKey.startsWith('•')}
          >
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            class="btn primary"
            onclick={saveApiKey}
            disabled={isSaving || !apiKey || apiKey.startsWith('•')}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </section>

    <!-- Theme Section -->
    <section class="section">
      <h3>Theme</h3>
      <div class="theme-options">
        <button
          class="theme-btn"
          class:active={theme === 'light'}
          onclick={() => handleThemeChange('light')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          Light
        </button>
        <button
          class="theme-btn"
          class:active={theme === 'dark'}
          onclick={() => handleThemeChange('dark')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          Dark
        </button>
        <button
          class="theme-btn"
          class:active={theme === 'system'}
          onclick={() => handleThemeChange('system')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          System
        </button>
      </div>
    </section>

    <!-- Sound Section -->
    <section class="section">
      <div class="toggle-row">
        <div>
          <h3>Sound Feedback</h3>
          <p class="section-desc">Play sounds for recording events</p>
        </div>
        <button
          class="toggle"
          class:active={soundEnabled}
          onclick={handleSoundToggle}
          role="switch"
          aria-checked={soundEnabled}
        >
          <span class="toggle-thumb"></span>
        </button>
      </div>
    </section>

    <!-- Hotkey Section -->
    <section class="section">
      <h3>Hotkey</h3>
      <div class="hotkey-display">
        <kbd>Win</kbd> + <kbd>J</kbd>
      </div>
      <p class="section-desc">Press to start/stop dictation from anywhere</p>
    </section>

    <!-- Danger Zone -->
    <section class="section danger">
      <h3>Danger Zone</h3>
      <button class="btn danger" onclick={clearHistory}>
        Clear All History
      </button>
    </section>

    <!-- About -->
    <section class="section about">
      <p class="version">Visper v1.0.0</p>
      <p class="copyright">Powered by Gemini</p>
      <p class="open-source">Open Source</p>
      <div class="built-by">
        <span>Built by</span>
        <a
          href="https://www.linkedin.com/in/ahmed-rabaiah-a12943259/"
          target="_blank"
          rel="noopener noreferrer"
          class="author-link"
        >
          Ahmed Rabaiah
        </a>
      </div>
    </section>
  </div>

  <NavBar currentView="settings" {navigate} />
</div>

<style>
  .settings {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .header {
    padding: var(--spacing-md);
  }

  .header h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .settings-container {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-md);
  }

  .section {
    margin-bottom: var(--spacing-lg);
  }

  .section h3 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .section-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .input-group input {
    width: 100%;
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .input-group input:focus {
    border-color: var(--color-accent);
    outline: none;
  }

  .input-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .btn.primary {
    background: var(--color-accent);
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn.secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .btn.secondary:hover:not(:disabled) {
    background: var(--color-bg-secondary);
  }

  .btn.danger {
    background: var(--color-error);
    color: white;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .theme-options {
    display: flex;
    gap: var(--spacing-sm);
  }

  .theme-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .theme-btn:hover {
    border-color: var(--color-border);
  }

  .theme-btn.active {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-bg-primary);
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .toggle {
    width: 44px;
    height: 24px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    position: relative;
    transition: background var(--transition-fast);
  }

  .toggle.active {
    background: var(--color-accent);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .toggle.active .toggle-thumb {
    transform: translateX(20px);
  }

  .hotkey-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-xs);
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-xs);
    color: var(--color-text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .section.danger {
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }

  .section.about {
    text-align: center;
    padding: var(--spacing-md) 0;
  }

  .version {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .copyright {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .open-source {
    font-size: var(--font-size-xs);
    color: var(--color-accent);
    font-weight: 500;
    margin-top: var(--spacing-sm);
  }

  .built-by {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-xs);
  }

  .author-link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 500;
    transition: opacity var(--transition-fast);
  }

  .author-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
</style>
