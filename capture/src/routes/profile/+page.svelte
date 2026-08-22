<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type User } from '$lib/api';
	import { checkAuth, user } from '$lib/auth';

	let displayName = $state('');
	let about = $state('');
	let avatarPath = $state<string | null>(null);
	let saving = $state(false);
	let uploading = $state(false);
	let msg = $state('');
	let error = $state('');

	onMount(async () => {
		try {
			const res = await api.get<{ user: User }>('/api/auth/me');
			displayName = res.user.display_name ?? '';
			about = res.user.about ?? '';
			avatarPath = res.user.avatar_path;
		} catch {
			error = 'Failed to load profile.';
		}
	});

	async function save() {
		saving = true;
		msg = '';
		error = '';
		try {
			await api.patch('/api/auth/profile', { display_name: displayName || null, about: about || null });
			await checkAuth();
			msg = 'Saved.';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Save failed.';
		} finally {
			saving = false;
		}
	}

	async function uploadAvatar(ev: Event) {
		const input = ev.target as HTMLInputElement;
		if (!input.files?.length) return;
		uploading = true;
		error = '';
		try {
			const fd = new FormData();
			fd.append('avatar', input.files[0]);
			const res = await api.upload<{ avatar_path: string }>('/api/auth/avatar', fd);
			avatarPath = res.avatar_path;
			await checkAuth();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function deleteAvatar() {
		uploading = true;
		error = '';
		try {
			await api.del('/api/auth/avatar');
			avatarPath = null;
			await checkAuth();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Delete failed.';
		} finally {
			uploading = false;
		}
	}
</script>

<svelte:head><title>Profile</title></svelte:head>

<h1>Profile</h1>

<div class="card">
	<div class="avatar-section">
		{#if avatarPath}
			<img src="/avatars/{avatarPath}" alt="Avatar" class="avatar-preview" />
			<button onclick={deleteAvatar} disabled={uploading}>Remove avatar</button>
		{:else}
			<p>No avatar set.</p>
		{/if}
		<label class="form-label" style="margin-top:.5rem" for="avatar-upload">Upload avatar</label>
		<input id="avatar-upload" type="file" accept="image/*" onchange={uploadAvatar} disabled={uploading} />
	</div>

	<form onsubmit={(e) => { e.preventDefault(); save(); }}>
		<label class="form-label" for="display_name">Display name</label>
		<input id="display_name" type="text" bind:value={displayName} maxlength="100" />

		<label class="form-label" for="about">About</label>
		<textarea id="about" bind:value={about} rows="4" maxlength="2000"></textarea>

		<button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
	</form>

	{#if msg}<p class="msg">{msg}</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}
</div>

<style>
	.avatar-section { margin-bottom: 1.5rem; }
	.msg { color: #16a34a; font-size: .875rem; margin-top: .5rem; }
</style>
