<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api, type CaptchaChallenge } from '$lib/api';
	import { checkAuth } from '$lib/auth';

	let username = $state('');
	let password = $state('');
	let captchaAnswer = $state('');
	let captcha = $state<CaptchaChallenge | null>(null);
	let error = $state('');
	let loading = $state(false);

	onMount(async () => {
		const ok = await checkAuth();
		if (ok) {
			goto('/capture/recent');
			return;
		}
		await loadCaptcha();
	});

	async function loadCaptcha() {
		try {
			captcha = await api.get<CaptchaChallenge>('/api/auth/captcha');
		} catch {
			error = 'Failed to load captcha';
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await api.post('/api/auth/signup', {
				username,
				password,
				captcha_id: captcha!.id,
				captcha_answer: captchaAnswer
			});
			goto('/capture/recent');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Signup failed';
			await loadCaptcha();
			captchaAnswer = '';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Sign up</title></svelte:head>

<h1>Sign up</h1>

<form onsubmit={handleSubmit}>
	<label for="username">Username</label>
	<input id="username" bind:value={username} required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]+" />

	<label for="password">Password</label>
	<input id="password" type="password" bind:value={password} required minlength="8" />

	{#if captcha}
		<label for="captcha">Captcha</label>
		<p class="captcha-question">{(captcha.challenge_data as Record<string, string>).question}</p>
		<input id="captcha" bind:value={captchaAnswer} required placeholder="Your answer" />
	{/if}

	{#if error}<p class="error">{error}</p>{/if}

	<button type="submit" disabled={loading || !captcha}>{loading ? 'Creating account…' : 'Sign up'}</button>
</form>

<p>Already have an account? <a href="/login">Log in</a></p>

<style>
	.captcha-question { font-style: italic; margin-bottom: 0.5rem; }
</style>
