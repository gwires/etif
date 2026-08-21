<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Issue, type IssueListResult } from '$lib/api';

	let issues = $state<Issue[]>([]);
	let loading = $state(true);
	let offset = $state(0);
	let total = $state(0);
	const limit = 20;

	function excerpt(body: string | null, len = 150): string {
		if (!body) return '';
		return body.length > len ? body.slice(0, len) + '…' : body;
	}

	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	async function load() {
		loading = true;
		try {
			const res = await api.get<IssueListResult>(`/api/issues?type=draft&sort=created_at&order=desc&limit=${limit}&offset=${offset}`);
			issues = res.issues ?? [];
			total = res.total ?? issues.length;
		} catch {
			issues = [];
		} finally {
			loading = false;
		}
	}

	onMount(load);

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

{#if loading}
	<p>Loading…</p>
{:else if issues.length === 0}
	<p class="empty">No drafts yet. <a href="/capture">Create one</a>.</p>
{:else}
	<ul class="feed">
		{#each issues as issue}
			<li class="card">
				<a href="/i/{issue.id}/edit">
					<strong>{issue.title}</strong>
				</a>
				<p class="excerpt">{excerpt(issue.body)}</p>
				<small>{issue.created_by} · {fmtDate(issue.created_at)}</small>
			</li>
		{/each}
	</ul>

	<nav class="pagination">
		<button onclick={prev} disabled={offset === 0}>← Prev</button>
		<span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
		<button onclick={next} disabled={offset + limit >= total}>Next →</button>
	</nav>
{/if}

<style>
	.feed { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
	.card a { text-decoration: none; color: inherit; }
	.card a:hover strong { text-decoration: underline; }
	.excerpt { margin: 0.25rem 0; color: #555; }
	small { color: #888; font-size: 0.8rem; }
	.empty a { color: #2563eb; }
	.pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; gap: 1rem; }
	.pagination span { font-size: 0.875rem; color: #666; }
</style>
