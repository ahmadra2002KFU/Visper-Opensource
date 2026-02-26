<script lang="ts">
  import logoSrc from '../logo.png';

  interface Props {
    onComplete: () => void;
  }

  let { onComplete }: Props = $props();

  let step = $state(1);
  let apiKey = $state('');
  let isValidating = $state(false);
  let error = $state('');
  let direction = $state<'forward' | 'back'>('forward');

  function goTo(target: number) {
    direction = target > step ? 'forward' : 'back';
    step = target;
    error = '';
  }

  async function handleValidate() {
    if (!apiKey.trim()) {
      error = 'Please enter your API key';
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
        error = result.error || 'Invalid API key. Please check and try again.';
      }
    } catch (e) {
      error = 'Connection error. Please try again.';
    } finally {
      isValidating = false;
    }
  }
</script>

<div class="welcome">
  <!-- Step indicator dots -->
  <div class="step-dots">
    {#each [1, 2, 3] as dot}
      <span class="dot" class:active={dot === step} class:completed={dot < step}></span>
    {/each}
  </div>

  <div class="step-container">
    {#if step === 1}
      <div class="step step-1" class:slide-in-right={direction === 'forward'} class:slide-in-left={direction === 'back'}>
        <div class="hero">
          <img src={logoSrc} alt="Visper" class="logo" width="72" height="72" />
          <h1 class="title">Visper</h1>
          <p class="tagline">Your voice, transcribed</p>
        </div>

        <div class="pills">
          <div class="pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Lightning Fast
          </div>
          <div class="pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <text x="6.5" y="8.5" font-size="6" fill="currentColor" stroke="none" text-anchor="middle">J</text>
            </svg>
            Win+J Hotkey
          </div>
          <div class="pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Auto-Copy
          </div>
        </div>

        <div class="step-footer">
          <button class="btn-primary" onclick={() => goTo(2)}>
            Get Started
          </button>
        </div>
      </div>
    {:else if step === 2}
      <div class="step step-2" class:slide-in-right={direction === 'forward'} class:slide-in-left={direction === 'back'}>
        <button class="back-btn" onclick={() => goTo(1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <h2 class="step-title">Get your API key</h2>
        <p class="step-desc">You'll need a free Gemini API key to use Visper.</p>

        <div class="instructions">
          <div class="instruction">
            <span class="num">1</span>
            <div>
              <span>Visit </span>
              <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">
                Google AI Studio
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
          </div>
          <div class="instruction">
            <span class="num">2</span>
            <span>Sign in with your Google account</span>
          </div>
          <div class="instruction">
            <span class="num">3</span>
            <span>Click <strong>Create API Key</strong> and copy it</span>
          </div>
        </div>

        <div class="step-footer">
          <button class="btn-primary" onclick={() => goTo(3)}>
            I have my key
          </button>
        </div>
      </div>
    {:else if step === 3}
      <div class="step step-3" class:slide-in-right={direction === 'forward'} class:slide-in-left={direction === 'back'}>
        <button class="back-btn" onclick={() => goTo(2)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <h2 class="step-title">Enter your API key</h2>
        <p class="step-desc">Paste the key you copied from Google AI Studio.</p>

        <div class="input-area">
          <input
            type="password"
            placeholder="Paste your Gemini API key"
            bind:value={apiKey}
            class:input-error={!!error}
            onkeydown={(e) => e.key === 'Enter' && handleValidate()}
          />
          {#if error}
            <span class="error-text">{error}</span>
          {/if}
        </div>

        <div class="step-footer">
          <button class="btn-primary" onclick={handleValidate} disabled={isValidating}>
            {#if isValidating}
              <span class="spinner"></span>
              Validating...
            {:else}
              Validate & Continue
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
    overflow: hidden;
  }

  /* Step dots */
  .step-dots {
    display: flex;
    justify-content: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-bg-tertiary);
    transition: all var(--transition-base);
  }

  .dot.active {
    width: 24px;
    background: var(--color-accent);
  }

  .dot.completed {
    background: var(--color-accent);
  }

  /* Step container */
  .step-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Slide animations */
  .slide-in-right {
    animation: slideFromRight 0.3s ease forwards;
  }

  .slide-in-left {
    animation: slideFromLeft 0.3s ease forwards;
  }

  @keyframes slideFromRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideFromLeft {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Back button */
  .back-btn {
    align-self: flex-start;
    padding: var(--spacing-xs);
    color: var(--color-text-secondary);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    margin-bottom: var(--spacing-md);
  }

  .back-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  /* Step 1 — Hero */
  .hero {
    text-align: center;
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .logo {
    border-radius: var(--radius-xl);
    margin-bottom: var(--spacing-md);
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

  /* Feature pills */
  .pills {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .pill {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .pill svg {
    color: var(--color-accent);
    flex-shrink: 0;
  }

  /* Step 2 — Instructions */
  .step-title {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .step-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-lg);
  }

  .instructions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .instruction {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .num {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent);
    color: white;
    font-size: var(--font-size-xs);
    font-weight: 700;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .instruction a {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .instruction a:hover {
    text-decoration: underline;
  }

  /* Step 3 — Input */
  .input-area {
    margin-bottom: var(--spacing-lg);
  }

  .input-area input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast);
  }

  .input-area input:focus {
    border-color: var(--color-accent);
    outline: none;
  }

  .input-area input.input-error {
    border-color: var(--color-error);
  }

  .error-text {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-error);
    margin-top: var(--spacing-xs);
  }

  /* Footer / CTA */
  .step-footer {
    margin-top: auto;
  }

  .btn-primary {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--color-accent);
    color: white;
    font-size: var(--font-size-base);
    font-weight: 600;
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Spinner */
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: var(--radius-full);
    animation: spin 0.6s linear infinite;
  }
</style>
