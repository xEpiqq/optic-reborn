<script>
    import { createEventDispatcher } from 'svelte';
    import Sidebar from '../../lib/components/sidebar.svelte'
    let isMappingVisible = false;
    let file;
    let csvHeaders = [];
    let mapping = {};
    export let data = {}; // Assuming you have data.tableColumns
    console.log(data.tableColumns)

    const dispatch = createEventDispatcher();
  
    // Function to calculate string similarity (Levenshtein distance)
    function stringSimilarity(s1, s2) {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      const longerLength = longer.length;
      if (longerLength === 0) {
        return 1.0;
      }
      return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
    }

    function editDistance(s1, s2) {
      s1 = s1.toLowerCase();
      s2 = s2.toLowerCase();
      const costs = new Array();
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i == 0) {
            costs[j] = j;
          } else {
            if (j > 0) {
              let newValue = costs[j - 1];
              if (s1.charAt(i - 1) != s2.charAt(j - 1)) {
                newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
              }
              costs[j - 1] = lastValue;
              lastValue = newValue;
            }
          }
        }
        if (i > 0) {
          costs[s2.length] = lastValue;
        }
      }
      return costs[s2.length];
    }

    // Auto-match CSV headers to table columns
    function autoMatchFields() {
      csvHeaders.forEach(header => {
        let bestMatch = '';
        let bestSimilarity = 0;
        data.tableColumns.forEach(column => {
          const similarity = stringSimilarity(header, column);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = column;
          }
        });
        if (bestSimilarity > 0.6) { // Threshold for considering a match
          mapping[header] = bestMatch;
        }
      });
    }

    // Handle CSV file upload
    function handleFileUpload(event) {
      file = event.target.files[0];
      if (file) {
        parseCSV(file);
      }
    }
  
    // Parse CSV to get headers
    async function parseCSV(file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target.result;
        const lines = csv.split('\n');
        csvHeaders = lines[0].split(',').map(header => header.trim()); // Get CSV headers from the first line
        autoMatchFields(); // Auto-match fields after parsing
        isMappingVisible = true; // Show the mapping UI on the right
      };
      reader.readAsText(file);
    }
  
    // Submit mapping
    async function submitMapping() {
      if (Object.keys(mapping).length > 0) {
        console.log('Submit Mapping:', mapping);
        // Handle your data submission logic here
      }
    }
</script>
  
<!-- Main centered file upload component -->
<div class="min-h-screen flex items-center justify-center bg-gray-900">
  <Sidebar />
  <div class="text-center flex flex-col">
    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
    <h3 class="mt-2 text-sm font-semibold text-gray-300">Import Leads</h3>
    <p class="mt-1 text-sm text-gray-400">Select a CSV file from your device</p>
    <div class="mt-6">
      <label for="file-upload" class="relative cursor-pointer bg-gray-800 rounded-md font-medium text-blue-400 hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
        <span class="inline-flex items-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          Choose file
        </span>
        <input id="file-upload" name="file-upload" type="file" accept=".csv" class="sr-only" on:change={handleFileUpload} />
      </label>
    </div>
  </div>
</div>

<!-- Floating mapping UI on the right -->
<!-- Floating mapping UI on the right -->
{#if isMappingVisible}
  <div class="fixed z-50 right-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 w-96 max-h-[75vh] overflow-y-auto border border-gray-300/10 custom-scrollbar">
    <!-- Expanded mapping modal content -->
    <div class="flex items-center justify-between p-2">
      <h1 class="text-sm font-semibold">CSV Mapping</h1>
      <button on:click={() => (isMappingVisible = false)} class="p-1 hover:bg-gray-700 rounded">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
    <div class="border-t border-gray-700 mt-1"></div>
    <div class="p-2">
      <p class="text-sm">Map CSV columns to database columns.</p>
      {#each csvHeaders as header}
        <div class="flex justify-between items-center mt-2">
          <span class="text-gray-300">{header}</span>
          <select bind:value={mapping[header]} class="bg-gray-800 text-gray-300 p-2 rounded">
            <option value="">Select column</option>
            {#each data.tableColumns as column}
              <option value={column}>{column}</option>
            {/each}
          </select>
        </div>
      {/each}

      <button class="mt-6 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-500" on:click={submitMapping}>
        Submit Mapping
      </button>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: gray transparent;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px; /* Thin scrollbar */
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent; /* Optional: background of the track */
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: gray; /* Gray color */
    border-radius: 10px; /* Rounded scrollbar thumb */
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #888; /* Slightly darker gray on hover */
  }
</style>
