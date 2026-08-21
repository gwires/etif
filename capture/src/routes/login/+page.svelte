<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { checkAuth } from '$lib/auth';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(async () => {
		const ok = await checkAuth();
		if (ok) goto('/capture/recent');
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await api.post('/api/auth/login', { username, password });
			goto('/capture/recent');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Log in</title></svelte:head>

<h1>Log in</h1>

<form onsubmit={handleSubmit}>
	<label for="username">Username</label>
	<input id="username" bind:value={username} required />

	<label for="password">Password</label>
	<input id="password" type="password" bind:value={password} required />

	{#if error}<p class="error">{error}</p>{/if}

	<button type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
</form>

<p>No account? <a href="/signup">Sign up</a></p>
