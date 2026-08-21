<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type CaptureUrl } from '$lib/api';

	let urls = $state<CaptureUrl[]>([]);
	let loading = $state(true);
	let offset = $state(0);
	const limit = 100;

	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
			const res = await api.get<{ urls: CaptureUrl[] }>(`/api/urls?limit=${limit}&offset=${offset}`);
			urls = res.urls ?? [];
		} catch {
			urls = [];
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

<svelte:head><title>URLs</title></svelte:head>

<h1>URLs</h1>

{#if loading}
	<p>Loading…</p>
{:else if urls.length === 0}
	<p>No URLs found.</p>
{:else}
	<table class="url-table">
		<thead>
			<tr>
				<th>URL</th>
				<th>Capture</th>
				<th>Date</th>
			</tr>
		</thead>
		<tbody>
			{#each urls as u}
				<tr>
					<td><a href={u.url} target="_blank" rel="noopener">{u.url}</a></td>
					<td>
						<a href="/i/{u.capture_id}/edit">
							<span class="status {statusClass(u.capture_status)}">{u.capture_status}</span>
							{u.capture_title}
						</a>
					</td>
					<td>{fmtDate(u.created_at)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<nav class="pagination">
		<button onclick={prev} disabled={offset === 0}>← Prev</button>
		<span>{offset + 1}–{offset + urls.length}</span>
		<button onclick={next} disabled={urls.length < limit}>Next →</button>
	</nav>
{/if}
