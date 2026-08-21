<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type CaptureListItem } from '$lib/api';

	let captures = $state<CaptureListItem[]>([]);
	let loading = $state(true);
	let offset = $state(0);
	let total = $state(0);
	let statusFilter = $state('');
	const limit = 20;

	const statuses = [
		{ value: '', label: 'All' },
		{ value: '***', label: '★★★' },
		{ value: '**', label: '★★' },
		{ value: '*', label: '★' },
		{ value: 'done', label: 'Done' }
	];

	function excerpt(text: string | null, len = 150): string {
		if (!text) return '';
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function statusClass(s: string): string {
		if (s === '***') return 'status-3';
		if (s === '**') return 'status-2';
		if (s === '*') return 'status-1';
		return 'status-done';
	}

	async function load() {
		loading = true;
		try {
			const params = `sort=created_at&order=desc&limit=${limit}&offset=${offset}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''}`;
			const res = await api.get<{ captures: CaptureListItem[] }>(`/api/captures?${params}`);
			captures = res.captures ?? [];
			total = captures.length < limit ? offset + captures.length : offset + limit + 1;
		} catch {
			captures = [];
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function setFilter(val: string) {
		statusFilter = val;
		offset = 0;
		load();
	}

	function prev() {
		offset = Math.max(0, offset - limit);
		load();
	}
	function next() {
		offset += limit;
		load();
	}
</script>

<svelte:head><title>Recent captures</title></svelte:head>

<h1>Recent captures</h1>

<div class="tabs">
	{#each statuses as s}
		<button class="tab" class:active={statusFilter === s.value} onclick={() => setFilter(s.value)}>
			{s.label}
		</button>
	{/each}
</div>

{#if loading}
	<p>Loading…</p>
{:else if captures.length === 0}
	<p class="empty">No captures yet. <a href="/capture">Create one</a>.</p>
{:else}
	<ul class="feed">
		{#each captures as cap}
			<li class="card">
				<a href="/i/{cap.id}/edit">
					<span class="status {statusClass(cap.status)}">{cap.status}</span>
					<strong>{cap.title}</strong>
				</a>
				<p class="excerpt">{excerpt(cap.what_text)}</p>
				<small>
					{fmtDate(cap.created_at)}
					{#if cap.image_count > 0} · 🖼 {cap.image_count}{/if}
					{#if cap.url_count > 0} · 🔗 {cap.url_count}{/if}
				</small>
			</li>
		{/each}
	</ul>

	<nav class="pagination">
		<button onclick={prev} disabled={offset === 0}>← Prev</button>
		<span>{offset + 1}–{Math.min(offset + captures.length, total)} of {total}+</span>
		<button onclick={next} disabled={captures.length < limit}>Next →</button>
	</nav>
{/if}

<style>
	.feed { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
	.card a { text-decoration: none; color: inherit; display: flex; align-items: baseline; gap: 0.5rem; }
	.card a:hover strong { text-decoration: underline; }
	.excerpt { margin: 0.25rem 0; color: #555; }
	small { color: #888; font-size: 0.8rem; }
	.empty a { color: #2563eb; }
</style>
