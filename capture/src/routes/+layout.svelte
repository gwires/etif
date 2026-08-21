<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { user, checkAuth } from '$lib/auth';

	let { children } = $props();
	let menuOpen = $state(false);

	const PUBLIC_ROUTES = ['/login', '/signup'];

	onMount(async () => {
		const ok = await checkAuth();
		if (!ok && !PUBLIC_ROUTES.includes($page.url.pathname)) {
			goto('/login');
		}
	});

	// Close mobile menu on navigation
	$effect(() => {
		$page.url.pathname;
		menuOpen = false;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="container">
	<nav>
		<div class="nav-brand">
			<a href="/capture"><strong>Capture</strong></a>
			<button class="menu-toggle" onclick={() => (menuOpen = !menuOpen)} aria-label="Toggle menu">
				{menuOpen ? '✕' : '☰'}
			</button>
		</div>
		<div class="nav-links" class:open={menuOpen}>
			<a href="/capture">New</a>
			<a href="/capture/recent">Recent</a>
			{#if $user}
				<span class="nav-user">{$user.username}</span>
				<form method="POST" action="/logout">
					<button type="submit">Logout</button>
				</form>
			{/if}
		</div>
	</nav>
	<main>
		{@render children()}
	</main>
</div>
