<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api, type Issue } from '$lib/api';

	let title = $state('');
	let body = $state('');
	let severity = $state('');
	let error = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let preview = $state(false);

	const issueId = $derived($page.params.id);

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

	onMount(async () => {
		try {
			const issue = await api.get<Issue>(`/api/issues/${issueId}`);
			title = issue.title;
			body = issue.body ?? '';
			severity = issue.severity != null ? String(issue.severity) : '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load issue';
		} finally {
			loading = false;
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		saving = true;
		try {
			await api.patch(`/api/issues/${issueId}`, {
				title,
				body,
				severity: severity ? Number(severity) : null
			});
			goto('/capture/recent');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Edit capture</title></svelte:head>

{#if loading}
	<p>Loading…</p>
{:else if error && !title}
	<p class="error">{error}</p>
{:else}
	<h1>Edit capture</h1>

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
				placeholder="Describe the issue."
			></textarea>
		{/if}

		<small>
			Supports: <code>[text](url)</code> · <code>[video:url]</code> · <code>[location:url]</code> · markdown basics
		</small>

		<label for="severity">Severity</label>
		<select id="severity" bind:value={severity}>
			<option value="">—</option>
			<option value="1">1 — Low</option>
			<option value="2">2 — Minor</option>
			<option value="3">3 — Moderate</option>
			<option value="4">4 — High</option>
			<option value="5">5 — Critical</option>
		</select>

		{#if error}<p class="error">{error}</p>{/if}

		<button type="submit" disabled={saving || !title || body.length < 10}>
			{saving ? 'Saving…' : 'Save changes'}
		</button>
	</form>

	<section class="citations-section">
		<h2>Citations</h2>
		<p class="empty">Citation extraction not yet enabled.</p>
	</section>

	<section class="upload-section">
		<h2>Images</h2>
		<p class="empty">Image upload coming soon.</p>
	</section>
{/if}

<style>
	.body-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
	.toggle-btn { background: none; border: 1px solid #ccc; color: #2563eb; padding: 0.25rem 0.75rem; min-height: auto; font-size: 0.875rem; }
	.toggle-btn:hover { background: #f0f0f0; }
	:global(.preview) { min-height: 8rem; }
	.citations-section, .upload-section { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; }
	.citations-section h2, .upload-section h2 { font-size: 1rem; margin-bottom: 0.5rem; }
	.empty { color: #888; font-size: 0.875rem; }
</style>
