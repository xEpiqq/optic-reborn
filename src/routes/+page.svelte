<!-- src/routes/+page.svelte -->

<script>
  import GoogleMap from '../lib/GoogleMap.svelte';
  export let data;

  // Extract clusters from the loaded data
  const { clusters } = data;
</script>

<!-- Pass the clusters to the GoogleMap component -->
<GoogleMap {clusters} />
