<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { user, checkAuth } from '$lib/auth';

	let { children } = $props();

	const PUBLIC_ROUTES = ['/login', '/signup'];

	onMount(async () => {
		const ok = await checkAuth();
		if (!ok && !PUBLIC_ROUTES.includes($page.url.pathname)) {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="container">
	<nav>
		<a href="/capture"><strong>Capture</strong></a>
		<a href="/capture/recent">Recent</a>
		{#if $user}
			<span>{$user.username}</span>
			<form method="POST" action="/logout">
				<button type="submit">Logout</button>
			</form>
		{/if}
	</nav>
	<main>
		{@render children()}
	</main>
</div>
