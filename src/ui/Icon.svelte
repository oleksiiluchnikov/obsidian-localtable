<script lang="ts">
	import { setIcon } from "obsidian";
	import { onMount } from "svelte";

	let {
		icon,
		className = "",
	}: {
		icon: string;
		className?: string;
	} = $props();

	let iconEl: HTMLElement = $state(null!);

	onMount(() => {
		if (iconEl) {
			setIcon(iconEl, icon);
		}
	});

	$effect(() => {
		if (iconEl && icon) {
			setIcon(iconEl, icon);
		}
	});
</script>

<span bind:this={iconEl} class={className} style="display:contents"></span>
