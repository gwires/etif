<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, type Issue } from '$lib/api';

	let title = $state('');
	let body = $state('');
	let severity = $state('');
	let error = $state('');
	let loading = $state(false);
	let preview = $state(false);

	function renderMarkdown(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/^### (.+)$/gm, '<h3>$1</h3>')
			.replace(/^## (.+)$/gm, '<h2>$1</h2>')
			.replace(/^# (.+)$/gm, '<h1>$1</h1>')
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
			.replace(/\n/g, '<br>');
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const issue = await api.post<Issue>('/api/issues', {
				title,
				body,
				type: 'draft',
				severity: severity ? Number(severity) : null
			});
			goto(`/i/${issue.id}/edit`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create draft';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>New capture</title></svelte:head>

<h1>New capture</h1>

<form onsubmit={handleSubmit}>
	<label for="title">Title</label>
	<input id="title" bind:value={title} required placeholder="What's the issue?" />

	<div class="body-header">
		<label for="body">Body (markdown)</label>
		<button type="button" class="toggle-btn" onclick={() => (preview = !preview)}>
			{preview ? 'Edit' : 'Preview'}
		</button>
	</div>

	{#if preview}
		<div class="card preview">
			{@html renderMarkdown(body)}
		</div>
	{:else}
		<textarea
			id="body"
			bind:value={body}
			required
			minlength="10"
			rows="8"
			placeholder="Describe the issue. Use [text](url) for links, [video:url] for videos, [location:url] for places."
		></textarea>
	{/if}

	<small>
		Supports: <code>[text](url)</code> · <code>[video:url]</code> · <code>[location:url]</code> · markdown basics
	</small>

	<label for="severity">Severity (optional)</label>
	<select id="severity" bind:value={severity}>
		<option value="">—</option>
		<option value="1">1 — Low</option>
		<option value="2">2 — Minor</option>
		<option value="3">3 — Moderate</option>
		<option value="4">4 — High</option>
		<option value="5">5 — Critical</option>
	</select>

	{#if error}<p class="error">{error}</p>{/if}

	<button type="submit" disabled={loading || !title || body.length < 10}>
		{loading ? 'Saving…' : 'Save draft'}
	</button>
</form>

<style>
	.body-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
	.toggle-btn { background: none; border: 1px solid #ccc; color: #2563eb; padding: 0.25rem 0.75rem; min-height: auto; font-size: 0.875rem; }
	.toggle-btn:hover { background: #f0f0f0; }
	:global(.preview) { min-height: 8rem; }
</style>
