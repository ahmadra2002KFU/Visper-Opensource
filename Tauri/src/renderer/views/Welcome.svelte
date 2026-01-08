<script lang="ts">
  interface Props {
    onComplete: () => void;
  }

  let { onComplete }: Props = $props();

  let apiKey = $state('');
  let isValidating = $state(false);
  let error = $state('');

  const features = [
    {
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>`,
      title: 'Lightning Fast',
      description: 'Under 3 seconds from speech to text'
    },
    {
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      </svg>`,
      title: 'Win+J Hotkey',
      description: 'Start dictating from anywhere'
    },
    {
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>`,
      title: 'History',
      description: 'All transcriptions saved locally'
    }
  ];

  async function handleStart() {
    if (!apiKey.trim()) {
      error = 'API key is required';
      return;
    }

    isValidating = true;
    error = '';

    try {
      const result = await window.visperAPI.settings.testApi(apiKey);
      if (result.success) {
        const saveResult = await window.visperAPI.settings.setApiKey(apiKey);
        if (saveResult && saveResult.success) {
          onComplete();
        } else {
          error = saveResult?.error || 'Failed to save API key';
        }
      } else {
        error = result.error || 'Invalid API key';
      }
    } catch (e) {
      error = 'Failed to validate API key';
    } finally {
      isValidating = false;
    }
  }
</script>

<div class="welcome">
  <div class="hero">
    <div class="logo">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
      </svg>
    </div>
    <h1 class="title">Visper</h1>
    <p class="tagline">Your voice, transcribed</p>
  </div>

  <div class="features">
    {#each features as feature}
      <div class="feature">
        <div class="feature-icon">{@html feature.icon}</div>
        <div class="feature-content">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      </div>
    {/each}
  </div>

  <div class="setup">
    <div class="input-group">
      <label for="api-key">Gemini API Key</label>
      <p class="api-key-help">
        Get your free API key from
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
          Google AI Studio
        </a>
      </p>
      <input
        id="api-key"
        type="password"
        placeholder="Enter your Gemini API key"
        bind:value={apiKey}
        class:error={!!error}
      />
      {#if error}
        <span class="error-text">{error}</span>
      {/if}
    </div>

    <button class="start-btn" onclick={handleStart} disabled={isValidating}>
      {#if isValidating}
        Validating...
      {:else}
        Get Started
      {/if}
    </button>
  </div>
</div>

<style>
  .welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-lg);
    animation: fadeIn 0.5s ease;
  }

  .hero {
    text-align: center;
    margin-bottom: var(--spacing-lg);
  }

  .logo {
    margin-bottom: var(--spacing-sm);
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .tagline {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .feature {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .feature-icon {
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .feature-content h3 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 2px;
  }

  .feature-content p {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .setup {
    margin-top: auto;
  }

  .input-group {
    margin-bottom: var(--spacing-md);
  }

  .input-group label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .api-key-help {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-sm);
  }

  .api-key-help a {
    color: var(--color-accent);
    text-decoration: none;
  }

  .api-key-help a:hover {
    text-decoration: underline;
  }

  .input-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast);
  }

  .input-group input:focus {
    border-color: var(--color-accent);
    outline: none;
  }

  .input-group input.error {
    border-color: var(--color-error);
  }

  .error-text {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-error);
    margin-top: var(--spacing-xs);
  }

  .start-btn {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--color-accent);
    color: white;
    font-size: var(--font-size-base);
    font-weight: 600;
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
  }

  .start-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .start-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
