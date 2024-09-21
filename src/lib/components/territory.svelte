<script>
  import { createEventDispatcher } from 'svelte';

  export let isExpanded = true;
  
  const dispatch = createEventDispatcher();

  function toggleModal() {
    isExpanded = !isExpanded;
    dispatch('toggle', isExpanded);
  }
</script>

<div class="fixed z-50 right-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 {isExpanded ? 'w-64' : 'w-0'} overflow-hidden">
  {#if isExpanded}
    <!-- Expanded modal content -->
    <div class="flex items-center justify-between p-2">
      <h1 class="text-sm font-semibold">Territory Management</h1>
      <button on:click={toggleModal} class="p-1 hover:bg-gray-700 rounded">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
    <div class="border-t border-gray-700 mt-1"></div>
    <div class="p-2">
      <!-- Add your territory management content here -->
      <p class="text-sm">Manage your territories here.</p>
    </div>
  {:else}
    <!-- Collapsed modal content -->
    <div class="flex items-center p-2 hover:bg-gray-800 cursor-pointer" on:click={toggleModal}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      <span class="ml-2 text-sm">Territory</span>
    </div>
  {/if}
</div>

<style>
  /* Add any additional styles here if needed */
</style>
