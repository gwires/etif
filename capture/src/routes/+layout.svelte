<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="container">
	<nav>
		<a href="/capture"><strong>Capture</strong></a>
		<a href="/capture/recent">Recent</a>
	</nav>
	<main>
		{@render children()}
	</main>
</div>
