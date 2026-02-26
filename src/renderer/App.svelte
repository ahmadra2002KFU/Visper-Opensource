<script lang="ts">
  import { onMount } from 'svelte';
  import TitleBar from './components/layout/TitleBar.svelte';
  import Welcome from './views/Welcome.svelte';
  import Dictation from './views/Dictation.svelte';
  import History from './views/History.svelte';
  import Settings from './views/Settings.svelte';
  import Toast from './components/feedback/Toast.svelte';

  type View = 'welcome' | 'dictation' | 'history' | 'settings';

  let currentView: View = $state('dictation');
  let isFirstLaunch = $state(false);
  let toasts: Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }> = $state([]);
  let toastId = 0;

  onMount(async () => {
    // Check if first launch
    isFirstLaunch = await window.visperAPI.app.isFirstLaunch();
    if (isFirstLaunch) {
      currentView = 'welcome';
    }

    // Apply saved theme
    const settings = await window.visperAPI.settings.get();
    const savedTheme = settings.theme || 'light';
    if (savedTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  });

  function navigate(view: View) {
    currentView = view;
  }

  async function completeSetup() {
    try {
      await window.visperAPI.app.completeSetup();
      isFirstLaunch = false;
      currentView = 'dictation';
    } catch (error) {
      console.error('Failed to complete setup:', error);
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = toastId++;
    toasts = [...toasts, { id, message, type }];
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
    }, 3000);
  }

  // Expose navigation and toast functions globally
  if (typeof window !== 'undefined') {
    (window as any).visperNavigate = navigate;
    (window as any).visperToast = showToast;
  }
</script>

<div class="app">
  <TitleBar />

  <main class="content">
    {#if currentView === 'welcome'}
      <Welcome onComplete={completeSetup} />
    {:else if currentView === 'dictation'}
      <Dictation {navigate} {showToast} />
    {:else if currentView === 'history'}
      <History {navigate} {showToast} />
    {:else if currentView === 'settings'}
      <Settings {navigate} {showToast} />
    {/if}
  </main>

  <!-- Toast container -->
  <div class="toast-container">
    {#each toasts as toast (toast.id)}
      <Toast message={toast.message} type={toast.type} />
    {/each}
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .toast-container {
    position: fixed;
    bottom: var(--spacing-lg);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    z-index: var(--z-toast);
  }
</style>
