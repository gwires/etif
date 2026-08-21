<script lang="ts">
	// Root redirects to capture
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	onMount(() => goto('/capture/recent'));
</script>

<p>Redirecting…</p>
