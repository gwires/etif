<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, type Capture } from '$lib/api';

	let title = $state('');
	let status = $state('***');
	let whatText = $state('');
	let whereText = $state('');
	let whyText = $state('');
	let whenText = $state('');
	let notes = $state('');
	let error = $state('');
	let loading = $state(false);

	// Quick-capture smart field
	let smartValue = $state('');
	let images = $state<File[]>([]);
	let dragover = $state(false);

	function handleSmartKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const val = smartValue.trim();
		if (!val) return;

		// URL detection
		if (/^https?:\/\//i.test(val)) {
			title = val;
			status = '***';
		} else {
			title = val;
			status = '***';
		}
		smartValue = '';
		document.getElementById('title-input')?.focus();
	}

	function handleSmartPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) images = [...images, file];
				document.getElementById('title-input')?.focus();
				return;
			}
		}

		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (/^https?:\/\//i.test(text.trim())) {
			e.preventDefault();
			title = text.trim();
			status = '***';
			smartValue = '';
			document.getElementById('title-input')?.focus();
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
		if (files.length) {
			images = [...images, ...files];
			document.getElementById('title-input')?.focus();
		}
	}

	function removeImage(idx: number) {
		images = images.filter((_, i) => i !== idx);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const body: Record<string, unknown> = { title, status };
			if (whatText.trim()) body.what_text = whatText.trim();
			if (whereText.trim()) body.where_text = whereText.trim();
			if (whyText.trim()) body.why_text = whyText.trim();
			if (whenText.trim()) body.when_text = whenText.trim();
			if (notes.trim()) body.notes = notes.trim();

			const { capture } = await api.post<{ capture: Capture }>('/api/captures', body);

			// Upload images sequentially
			for (const file of images) {
				const fd = new FormData();
				fd.append('image', file);
				await api.upload(`/api/captures/${capture.id}/images`, fd);
			}

			goto('/capture/recent');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create capture';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>New capture</title></svelte:head>

<h1>New capture</h1>

<!-- Quick-capture smart field -->
<div
	role="group"
	aria-label="Quick capture"
	class="smart-field"
	class:dragover
	ondrop={handleDrop}
	ondragover={(e) => { e.preventDefault(); dragover = true; }}
	ondragleave={() => (dragover = false)}
>
	<input
		type="text"
		bind:value={smartValue}
		placeholder="Paste URL, drop image, or type + Enter…"
		onkeydown={handleSmartKeydown}
		onpaste={handleSmartPaste}
	/>
</div>

<!-- Image upload area -->
<label for="img-input">Images ({images.length})</label>
<button
	type="button"
	class="image-drop"
	class:dragover
	aria-label="Drop images or click to browse"
	ondrop={handleDrop}
	ondragover={(e) => { e.preventDefault(); dragover = true; }}
	ondragleave={() => (dragover = false)}
	onclick={() => document.getElementById('img-input')?.click()}
>
	{#if images.length === 0}
		<span>Drop images here or click to browse</span>
	{:else}
		<span>{images.length} image{images.length > 1 ? 's' : ''} selected</span>
	{/if}
</button>
<input id="img-input" type="file" accept="image/*" multiple hidden
	onchange={(e) => {
		const files = Array.from((e.target as HTMLInputElement).files ?? []);
		if (files.length) images = [...images, ...files];
		(e.target as HTMLInputElement).value = '';
	}}
/>

{#if images.length > 0}
	<div class="img-grid">
		{#each images as file, i}
			<div class="img-thumb">
				<img src={URL.createObjectURL(file)} alt={file.name} />
				<button type="button" class="img-remove" onclick={() => removeImage(i)}>×</button>
			</div>
		{/each}
	</div>
{/if}

<form onsubmit={handleSubmit}>
	<label for="title-input">Title</label>
	<input id="title-input" bind:value={title} required placeholder="What is this?" />

	<label for="status">Status</label>
	<select id="status" bind:value={status}>
		<option value="***">Draft</option>
		<option value="**">In progress</option>
		<option value="">Done</option>
		<option value="*">Needs revision</option>
	</select>

	<div class="form-grid">
		<label for="what">What</label>
		<textarea id="what" bind:value={whatText} rows="3" placeholder="What happened?"></textarea>

		<label for="where">Where</label>
		<textarea id="where" bind:value={whereText} rows="2" placeholder="Location or context"></textarea>

		<label for="why">Why</label>
		<textarea id="why" bind:value={whyText} rows="2" placeholder="Why does this matter?"></textarea>

		<label for="when">When</label>
		<textarea id="when" bind:value={whenText} rows="2" placeholder="Timing or deadline"></textarea>

		<label for="notes">Notes</label>
		<textarea id="notes" bind:value={notes} rows="3" placeholder="Additional notes (markdown)"></textarea>
	</div>

	{#if error}<p class="error">{error}</p>{/if}

	<button type="submit" disabled={loading || !title.trim()}>
		{loading ? 'Saving…' : 'Save capture'}
	</button>
</form>
