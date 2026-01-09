<script lang="ts">
  import { onMount } from 'svelte';
  import NavBar from '../components/layout/NavBar.svelte';
  import { formatRelativeDate, formatTime12h, truncate, groupByDate } from '../lib/formatters';

  type View = 'dictation' | 'history' | 'settings';

  interface Transcription {
    id: number;
    text: string;
    durationSeconds: number | null;
    createdAt: string;
    isFavorite: number;
  }

  interface Props {
    navigate: (view: View) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  }

  let { navigate, showToast }: Props = $props();

  let items: Transcription[] = $state([]);
  let searchQuery = $state('');
  let isLoading = $state(true);
  let page = $state(1);
  let hasMore = $state(false);
  let total = $state(0);

  const limit = 20;

  const groupedItems = $derived(groupByDate(items));

  onMount(() => {
    loadHistory();
  });

  async function loadHistory(reset = true) {
    if (reset) {
      page = 1;
      items = [];
    }

    isLoading = true;

    try {
      const result = searchQuery
        ? await window.visperAPI.history.search(searchQuery, page, limit)
        : await window.visperAPI.history.get(page, limit);

      if (reset) {
        items = result.items;
      } else {
        items = [...items, ...result.items];
      }

      total = result.total;
      hasMore = items.length < total;
    } catch (error) {
      showToast('Failed to load history', 'error');
    } finally {
      isLoading = false;
    }
  }

  async function handleSearch() {
    loadHistory(true);
  }

  async function loadMore() {
    page++;
    loadHistory(false);
  }

  async function copyItem(text: string) {
    await window.visperAPI.clipboard.copy(text);
    showToast('Copied to clipboard!', 'success');
  }

  async function deleteItem(id: number) {
    try {
      await window.visperAPI.history.delete(id);
      items = items.filter(item => item.id !== id);
      total--;
      showToast('Deleted', 'info');
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  }
</script>

<div class="history">
  <div class="header">
    <h2>History</h2>
    <span class="count">{total} items</span>
  </div>

  <div class="search-bar">
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      type="text"
      placeholder="Search transcriptions..."
      bind:value={searchQuery}
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    {#if searchQuery}
      <button class="clear-btn" onclick={() => { searchQuery = ''; loadHistory(true); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    {/if}
  </div>

  <div class="items-container">
    {#if isLoading && items.length === 0}
      <div class="loading">Loading...</div>
    {:else if items.length === 0}
      <div class="empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>No transcriptions yet</p>
        <p class="hint">Press Win+J to start dictating</p>
      </div>
    {:else}
      {#each [...groupedItems] as [date, group]}
        <div class="date-group">
          <h3 class="date-header">{date}</h3>
          {#each group as item}
            <div class="item">
              <div class="item-content">
                <p class="item-text">{truncate(item.text, 100)}</p>
                <span class="item-time">{formatTime12h(item.createdAt)}</span>
              </div>
              <div class="item-actions">
                <button class="action-btn" onclick={() => copyItem(item.text)} aria-label="Copy">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                <button class="action-btn delete" onclick={() => deleteItem(item.id)} aria-label="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/each}

      {#if hasMore}
        <button class="load-more" onclick={loadMore} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Load more'}
        </button>
      {/if}
    {/if}
  </div>

  <NavBar currentView="history" {navigate} />
</div>

<style>
  .history {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-md) var(--spacing-sm);
  }

  .header h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .count {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0 var(--spacing-md) var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .search-bar input {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .search-bar input::placeholder {
    color: var(--color-text-muted);
  }

  .clear-btn {
    color: var(--color-text-muted);
    padding: 4px;
  }

  .clear-btn:hover {
    color: var(--color-text-primary);
  }

  .items-container {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-md);
  }

  .loading, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    color: var(--color-text-secondary);
    text-align: center;
  }

  .empty svg {
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .empty .hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-xs);
  }

  .date-group {
    margin-bottom: var(--spacing-md);
  }

  .date-header {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-sm);
  }

  .item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-xs);
    transition: background var(--transition-fast);
  }

  .item:hover {
    background: var(--color-bg-tertiary);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    line-height: 1.4;
    margin-bottom: 4px;
  }

  .item-time {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .item-actions {
    display: flex;
    gap: var(--spacing-xs);
    flex-shrink: 0;
    margin-left: var(--spacing-sm);
  }

  .action-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .action-btn.delete:hover {
    color: var(--color-error);
  }

  .load-more {
    width: 100%;
    padding: var(--spacing-sm);
    margin: var(--spacing-md) 0;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    transition: all var(--transition-fast);
  }

  .load-more:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .load-more:disabled {
    opacity: 0.6;
  }
</style>
