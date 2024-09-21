<!-- src/routes/+page.svelte -->

<script>
  import { onMount } from 'svelte';
  import GoogleMap from '../lib/GoogleMap.svelte';
  export let data;

  // Define the initial zoom level (can be dynamic based on user interaction)
  let currentZoomLevel = 2; // Starting with zoom level 2

  // Extract clusters for the current zoom level
  let clusters = data.clusters[currentZoomLevel] || [];

  // Function to handle zoom level changes (if implementing dynamic zoom)
  function handleZoomChange(newZoomLevel) {
    currentZoomLevel = newZoomLevel;
    clusters = data.clusters[currentZoomLevel] || [];
  }
</script>

<!-- Pass the clusters to the GoogleMap component -->
<GoogleMap {clusters} />

<style>
  /* Optional: Add any additional styling here */
</style>
