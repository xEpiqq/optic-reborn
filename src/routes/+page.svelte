<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import CollapsibleSidebar from '../lib/components/sidebar.svelte';
  import TerritoryModal from '../lib/components/territory.svelte'; // Import the Territory Modal

  // Props
  export let data;
  
  // Import Google Maps API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Reactive variables
  let mapElement;
  let map;
  let markers = [];
  let drawingManager;
  let currentZoomLevel = 2;
  let clusters = data.clusters[currentZoomLevel] || [];

  // Hover state for tooltips
  let hoverIndex = null;
  let tooltipTimer;

  let sidebarExpanded = true;

  // State for Territory Modal
  let territoryModalExpanded = false; // New state variable

  /**
   * Load Google Maps JavaScript API dynamically.
   */
  const loadGoogleMaps = (key) =>
    new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is undefined'));
        return;
      }

      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });

  /**
   * Initialize the Google Map.
   */
  const initializeMap = () => {
    const options = {
      center: { lat: 39.50, lng: -98.35 }, // Center of the US
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
    };
    map = new google.maps.Map(mapElement, options);
    addMarkers(clusters);

    // Update clusters on zoom change
    map.addListener('zoom_changed', () => {
      currentZoomLevel = map.getZoom();
      updateClusters();
    });
  };

  /**
   * Add markers to the map based on cluster data.
   */
  const addMarkers = (clusterData) => {
    clusterData.forEach(cluster => {
      const marker = new google.maps.Marker({
        position: { lat: cluster.latitude, lng: cluster.longitude },
        map,
        label: {
          text: String(cluster.count),
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#007bff',
          fillOpacity: 0.6,
          scale: Math.max(20, Math.min(cluster.count / 100, 50)),
          strokeColor: '#fff',
          strokeWeight: 1,
        },
      });

      marker.addListener('click', () => {
        map.setZoom(map.getZoom() + 2);
        map.setCenter(marker.getPosition());
      });

      markers.push(marker);
    });
  };

  /**
   * Clear all markers from the map.
   */
  const clearMarkers = () => {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
  };

  /**
   * Update clusters based on current zoom level.
   */
  const updateClusters = () => {
    clearMarkers();
    clusters = data.clusters[currentZoomLevel] || [];
    addMarkers(clusters);
  };

  /**
   * Setup Drawing Manager for drawing territories.
   */
  const setupDrawingManager = () => {
    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null, // Start with drawing mode off
      drawingControl: false,
      polygonOptions: {
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        strokeWeight: 2,
        clickable: false,
        editable: false,
        zIndex: 1,
      },
    });

    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
      // Handle the completed polygon (territory)
      console.log('Territory drawn:', polygon.getPath().getArray());
      // Optionally, store or display the polygon coordinates
      // For example, you can save the coordinates to a store or send them to a backend
    });
  };

  /**
   * Toggle Drawing Mode and Modal Visibility.
   */
  const toggleTerritoryMode = () => {
    if (drawingManager.getDrawingMode()) {
      // Currently drawing mode is active; deactivate it and close modal
      drawingManager.setDrawingMode(null);
      territoryModalExpanded = false;
    } else {
      // Activate drawing mode and open modal
      //drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      territoryModalExpanded = true;
    }
  };

  /**
   * Handle Modal Toggle Event.
   * Ensures that closing the modal deactivates drawing mode.
   */
  const handleTerritoryToggle = (event) => {
    territoryModalExpanded = event.detail;
    if (!territoryModalExpanded && drawingManager.getDrawingMode()) {
      drawingManager.setDrawingMode(null);
    }
  };

  /**
   * Handle Sidebar Toggle Event.
   */
  const handleSidebarToggle = (event) => {
    sidebarExpanded = event.detail;
  };

  /**
   * Handle Tooltip Display on Hover.
   */
  const showTooltip = (index) => {
    tooltipTimer = setTimeout(() => {
      hoverIndex = index;
    }, 700); // Show tooltip after 700ms
  };

  const hideTooltip = () => {
    clearTimeout(tooltipTimer);
    hoverIndex = null;
  };

  onMount(async () => {
    try {
      await loadGoogleMaps(apiKey);
      initializeMap();
      setupDrawingManager();
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    }
  });

  onDestroy(() => {
    clearMarkers();
    if (drawingManager) {
      drawingManager.setMap(null);
    }
  });
</script>

<style>
  /* No additional styles needed since we're using Tailwind CSS */
</style>

<div class="flex flex-col h-screen">
  <!-- Sidebar -->
  <CollapsibleSidebar isExpanded={sidebarExpanded} on:toggle={handleSidebarToggle} />

  <div class="flex-1 relative">
    <div id="map" bind:this={mapElement} class="w-full h-full"></div>
  </div>

  <!-- Territory Modal -->
  {#if territoryModalExpanded}
    <TerritoryModal isExpanded={territoryModalExpanded} on:toggle={handleTerritoryToggle} />
  {/if}

  <!-- Bottom Toolbar -->
  <div class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white flex items-center justify-between w-[400px] h-12 rounded-full shadow-lg px-4">
    <div class="relative">
      <button 
        class="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-full focus:outline-none"
        on:click={() => {
          // Example action for Pan button
          map.setOptions({ draggable: true });
        }}
        on:mouseenter={() => showTooltip(0)} 
        on:mouseleave={hideTooltip}>
        <img src="/pan.png" alt="Pan" class="h-6 w-6"/>
      </button>
      {#if hoverIndex === 0}
        <div class="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-sm py-1 px-2 rounded-lg">
          Pan
        </div>
      {/if}
    </div>

    <div class="flex space-x-4">
      <!-- Filter Leads Button -->
      <div class="relative">
        <button 
          class="flex items-center justify-center w-8 h-8 text-white bg-gray-600 rounded-full focus:outline-none" 
          on:mouseenter={() => showTooltip(1)} 
          on:mouseleave={hideTooltip}>
          <img src="/filter.png" alt="Filter Leads" class="h-4 w-4"/>
        </button>
        {#if hoverIndex === 1}
          <div class="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-sm py-1 px-2 rounded-lg">
            Filter Leads
          </div>
        {/if}
      </div>

      <!-- Territory Button -->
      <div class="relative">
        <button 
          class="flex items-center justify-center w-8 h-8 text-white bg-gray-600 rounded-full focus:outline-none" 
          on:click={toggleTerritoryMode}
          on:mouseenter={() => showTooltip(2)} 
          on:mouseleave={hideTooltip}>
          <img src="/territory.png" alt="Draw Territory" class="h-4 w-4"/>
        </button>
        {#if hoverIndex === 2}
          <div class="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-sm py-1 px-2 rounded-lg">
            {#if drawingManager && drawingManager.getDrawingMode()}
              Exit Drawing
            {:else}
              Draw Territory
            {/if}
          </div>
        {/if}
      </div>

      <!-- Assign Leads Button -->
      <div class="relative">
        <button 
          class="flex items-center justify-center w-8 h-8 text-white bg-gray-600 rounded-full focus:outline-none" 
          on:mouseenter={() => showTooltip(3)} 
          on:mouseleave={hideTooltip}>
          <img src="/assign.png" alt="Assign Leads" class="h-4 w-4"/>
        </button>
        {#if hoverIndex === 3}
          <div class="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-sm py-1 px-2 rounded-lg">
            Assign Leads
          </div>
        {/if}
      </div>

      <!-- Create Lead Button -->
      <div class="relative">
        <button 
          class="flex items-center justify-center w-8 h-8 text-white bg-gray-600 rounded-full focus:outline-none" 
          on:mouseenter={() => showTooltip(4)} 
          on:mouseleave={hideTooltip}>
          <img src="/newpin.png" alt="Create Lead" class="h-4 w-4"/>
        </button>
        {#if hoverIndex === 4}
          <div class="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-sm py-1 px-2 rounded-lg">
            Create Lead
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
