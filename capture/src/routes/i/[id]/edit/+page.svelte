<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api, type CaptureWithImages, type CaptureImage } from '$lib/api';

	let title = $state('');
	let status = $state('***');
	let whatText = $state('');
	let whereText = $state('');
	let whyText = $state('');
	let whenText = $state('');
	let notes = $state('');
	let error = $state('');
	let loading = $state(true);
	let saving = $state(false);

	let existingImages = $state<CaptureImage[]>([]);
	let newImages = $state<File[]>([]);
	let dragover = $state(false);

	const captureId = $derived($page.params.id);

	function imgUrl(path: string): string {
		const name = path.split('/').pop() ?? '';
		return `/images/${encodeURIComponent(name)}`;
	}

	onMount(async () => {
		try {
			const res = await api.get<{ capture: CaptureWithImages }>(`/api/captures/${captureId}`);
			const c = res.capture;
			title = c.title;
			status = c.status;
			whatText = c.what_text ?? '';
			whereText = c.where_text ?? '';
			whyText = c.why_text ?? '';
			whenText = c.when_text ?? '';
			notes = c.notes ?? '';
			existingImages = c.images ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load capture';
		} finally {
			loading = false;
		}
	});

	async function deleteImage(imgId: string) {
		if (!confirm('Delete this image?')) return;
		try {
			await api.del(`/api/captures/${captureId}/images/${imgId}`);
			existingImages = existingImages.filter((i) => i.id !== imgId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete image';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
		if (files.length) newImages = [...newImages, ...files];
	}

	function removeNew(idx: number) {
		newImages = newImages.filter((_, i) => i !== idx);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		saving = true;
		try {
			const body: Record<string, unknown> = { title, status };
			body.what_text = whatText.trim() || null;
			body.where_text = whereText.trim() || null;
			body.why_text = whyText.trim() || null;
			body.when_text = whenText.trim() || null;
			body.notes = notes.trim() || null;

			await api.patch(`/api/captures/${captureId}`, body);

			for (const file of newImages) {
				const fd = new FormData();
				fd.append('image', file);
				await api.upload(`/api/captures/${captureId}/images`, fd);
			}

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
		<input id="title" bind:value={title} required placeholder="What is this?" />

		<label for="status">Status</label>
		<select id="status" bind:value={status}>
			<option value="***">★★★ Urgent</option>
			<option value="**">★★ Important</option>
			<option value="*">★ Notable</option>
			<option value="done">✓ Done</option>
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

		<!-- Existing images -->
		{#if existingImages.length > 0}
			<span class="form-label">Existing images ({existingImages.length})</span>
			<div class="img-grid">
				{#each existingImages as img}
					<div class="img-thumb">
						<img src={imgUrl(img.path)} alt={img.caption ?? ''} />
						<button type="button" class="img-remove" onclick={() => deleteImage(img.id)}>×</button>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Add new images -->
		<span class="form-label" id="add-images-label">Add images ({newImages.length})</span>
		<button
			type="button"
			class="smart-field"
			class:dragover
			aria-label="Drop images or click to browse"
			ondrop={handleDrop}
			ondragover={(e) => { e.preventDefault(); dragover = true; }}
			ondragleave={() => (dragover = false)}
			onclick={() => document.getElementById('img-input')?.click()}
			style="cursor:pointer"
		>
			{#if newImages.length === 0}
				<span>Drop images here or click to browse</span>
			{:else}
				<span>{newImages.length} image{newImages.length > 1 ? 's' : ''} selected</span>
			{/if}
		</button>
		<input id="img-input" type="file" accept="image/*" multiple hidden
			onchange={(e) => {
				const files = Array.from((e.target as HTMLInputElement).files ?? []);
				if (files.length) newImages = [...newImages, ...files];
				(e.target as HTMLInputElement).value = '';
			}}
		/>

		{#if newImages.length > 0}
			<div class="img-grid">
				{#each newImages as file, i}
					<div class="img-thumb">
						<img src={URL.createObjectURL(file)} alt={file.name} />
						<button type="button" class="img-remove" onclick={() => removeNew(i)}>×</button>
					</div>
				{/each}
			</div>
		{/if}

		{#if error}<p class="error">{error}</p>{/if}

		<button type="submit" disabled={saving || !title.trim()}>
			{saving ? 'Saving…' : 'Save changes'}
		</button>
	</form>
{/if}
