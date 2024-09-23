<!-- src/routes/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import CollapsibleSidebar from '../lib/components/sidebar.svelte';
  import TerritoryModal from '../lib/components/territory.svelte';
  import AssignLeadsModal from '../lib/components/assignLeadsModal.svelte'; // Import the modal
  import Toolbar from '../lib/components/toolbar.svelte';
  import { supabase } from '../lib/supabaseClient';
  import lodashPkg from 'lodash';
  const { debounce } = lodashPkg;
  import { MarkerClusterer } from '@googlemaps/markerclusterer';

  export let data;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  let mapElement;
  let map;
  let clusterMarkers = [];
  let drawingManager;
  let actualZoomLevel;
  let effectiveZoomLevel;
  const clustersCache = new Map();
  let sidebarExpanded = true;
  let territoryModalExpanded = false;
  let isLoading = false;
  let errorMessage = null;

  let markerCluster; // Define markerCluster here to make it globally accessible
  let markerClustererLoaded = false; // Track whether the MarkerClusterer is loaded
  let individualMarkers = []; // Track individual markers

  const ZOOM_THRESHOLD = 12; // Define zoom threshold for switching between clusters and individual markers

  // State variables for Assign Leads Modal
  let assignLeadsModalExpanded = false;
  let selectedPolygon = null; // Store the drawn polygon

  onMount(async () => {
    try {
      await loadGoogleMaps(apiKey);
      initializeMap();
      setupDrawingManager();

      // Dynamically load the MarkerClusterer library
      await loadMarkerClusterer();

      markerClustererLoaded = true; // Set flag to true after it's loaded
      console.log('MarkerClusterer loaded successfully.');

      // Initial fetch based on the initial zoom level
      if (data.initialZoomLevel >= ZOOM_THRESHOLD) {
        await fetchIndividualMarkers(); // Handle individual markers
      } else {
        await fetchClusters(getMappedZoomLevel(data.initialZoomLevel)); // Handle clusters
      }

    } catch (error) {
      console.error('Error loading Google Maps or MarkerClusterer:', error);
      errorMessage = 'Failed to load Google Maps or MarkerClusterer. Please try again later.';
    }
  });

  // Function to dynamically load the MarkerClusterer script
  function loadMarkerClusterer() {
    return new Promise((resolve, reject) => {
      if (window.MarkerClusterer) {
        console.log('MarkerClusterer is already loaded.');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => {
        console.error('Error loading MarkerClusterer script:', e);
        reject(e);
      };
      document.head.appendChild(script);
    });
  }

  const getMappedZoomLevel = (zoom) => {
    if (zoom >= 11) return 9;
    if (zoom >= 10) return 8;
    if (zoom >= 8) return 6;
    if (zoom >= 3) return 5;
    return Math.round(zoom);
  };

  const generateCacheKey = (zoomLevel, bounds) => {
    if (!bounds) return `zoom_${zoomLevel}_all`;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return `zoom_${zoomLevel}_sw_${sw.lat().toFixed(4)}_${sw.lng().toFixed(4)}_ne_${ne.lat().toFixed(4)}_${ne.lng().toFixed(4)}`;
  };

  const expandBounds = (bounds, factor) => {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latSpan = ne.lat() - sw.lat();
    const lngSpan = ne.lng() - sw.lng();
    const expandedNE = new google.maps.LatLng(ne.lat() + latSpan * (factor - 1), ne.lng() + lngSpan * (factor - 1));
    const expandedSW = new google.maps.LatLng(sw.lat() - latSpan * (factor - 1), sw.lng() - lngSpan * (factor - 1));
    return new google.maps.LatLngBounds(expandedSW, expandedNE);
  };

  const fetchClusters = async (zoomLevel) => {
    let clusters = []; 
    const bounds = map.getBounds();
    if (!bounds) {
      console.error('Map bounds are undefined.');
      errorMessage = 'Map bounds are undefined. Please try again.';
      return;
    }

    const expansionFactor = 2;
    const expandedBounds = expandBounds(bounds, expansionFactor);
    const isZoomLevel5 = zoomLevel === 5;
    const cacheKey = isZoomLevel5
      ? generateCacheKey(zoomLevel, null)
      : generateCacheKey(zoomLevel, expandedBounds);

    if (clustersCache.has(cacheKey)) {
      console.log(`Using cached clusters for key: ${cacheKey}`);
      clusters = clustersCache.get(cacheKey);  // Fetch from cache
      addClusterMarkers(clusters);  // Use the clusters
      return;
    }

    const { min_lat, min_lon, max_lat, max_lon } = isZoomLevel5
      ? { min_lat: null, min_lon: null, max_lat: null, max_lon: null }
      : {
          min_lat: expandedBounds.getSouthWest().lat(),
          min_lon: expandedBounds.getSouthWest().lng(),
          max_lat: expandedBounds.getNorthEast().lat(),
          max_lon: expandedBounds.getNorthEast().lng(),
        };

    try {
      isLoading = true;
      console.log(`Fetching clusters for zoom level ${zoomLevel} with cache key ${cacheKey}`);
      const { data: fetchedClusters, error } = await supabase.rpc('get_cached_clusters', {
        p_zoom_level: zoomLevel,
        p_min_lat: min_lat,
        p_min_lon: min_lon,
        p_max_lat: max_lat,
        p_max_lon: max_lon,
      });

      if (error) {
        throw error;
      }

      clusters = fetchedClusters ?? []; 
      clustersCache.set(cacheKey, clusters);
      console.log(`Fetched ${clusters.length} clusters.`);
      addClusterMarkers(clusters);
      errorMessage = null;
    } catch (error) {
      console.error(`Error fetching clusters for zoom level ${zoomLevel}:`, error);
      errorMessage = 'Failed to load clusters. Please try again.';
    } finally {
      isLoading = false;
    }
  };

  const addClusterMarkers = (clusters) => {
    clearClusterMarkers();
    const newMarkers = clusters.map(cluster => {
      const marker = new google.maps.Marker({
        position: { lat: cluster.latitude, lng: cluster.longitude },
        map,
        title: `Cluster of ${cluster.count} restaurants`,
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
          scale: calculateMarkerScale(cluster.count),
          strokeColor: '#fff',
          strokeWeight: 1,
        },
      });
      marker.addListener('click', () => {
        console.log(`Cluster with ${cluster.count} markers clicked.`);
        map.setZoom(map.getZoom() + 2);
        map.setCenter(marker.getPosition());
      });
      return marker;
    });
    clusterMarkers = newMarkers;
    console.log(`Added ${clusterMarkers.length} cluster markers to the map.`);
  };

  const calculateMarkerScale = (count) => {
    const minScale = 20;
    const maxScale = 50;
    const minCount = 1;
    const maxCount = 1000;
    const normalized = (count - minCount) / (maxCount - minCount);
    const clamped = Math.max(0, Math.min(1, normalized));
    return minScale + clamped * (maxScale - minScale);
  };

  const clearClusterMarkers = () => {
    clusterMarkers.forEach(marker => marker.setMap(null));
    clusterMarkers = [];
    console.log('All cluster markers cleared from the map.');
  };

  async function fetchIndividualMarkers() {
    if (!map) {
      console.error('Map not initialized');
      return;
    }

    // Get current map bounds and expand them by a factor of 3
    const bounds = map.getBounds();
    if (!bounds) {
      console.error('Map bounds are undefined.');
      return;
    }
    const expandedBounds = expandBounds(bounds, 3);  // Expanding bounds 3x

    const min_lat = expandedBounds.getSouthWest().lat();
    const min_lon = expandedBounds.getSouthWest().lng();
    const max_lat = expandedBounds.getNorthEast().lat();
    const max_lon = expandedBounds.getNorthEast().lng();

    try {
      isLoading = true;
      console.log(`Fetching individual markers within bounds: ${min_lat}, ${min_lon}, ${max_lat}, ${max_lon}`);
      const response = await fetch(`/api/restaurants?min_lat=${min_lat}&min_lon=${min_lon}&max_lat=${max_lat}&max_lon=${max_lon}`);
      if (!response.ok) {
        throw new Error('Failed to fetch individual markers.');
      }

      const { restaurants } = await response.json();

      // Clear current individual markers
      clearIndividualMarkers();

      // Create markers for each restaurant
      individualMarkers = restaurants.map((restaurant) => {
        const marker = new google.maps.Marker({
          position: { lat: restaurant.latitude, lng: restaurant.longitude },
          map,
          title: restaurant.name,
          // Customize marker appearance if needed
        });

        // Optional: Add event listeners to individual markers
        marker.addListener('click', () => {
          console.log(`Marker for ${restaurant.name} clicked.`);
          // Implement additional behavior, e.g., show info window
        });

        return marker;
      });

      console.log(`${individualMarkers.length} individual markers added to the map.`);
    } catch (error) {
      console.error('Error fetching individual markers:', error);
    } finally {
      isLoading = false;
    }
  }

  const clearIndividualMarkers = () => {
    individualMarkers.forEach(marker => marker.setMap(null));
    individualMarkers = [];
    console.log('All individual markers cleared from the map.');
  };

  const handleMapIdle = debounce(async () => {
    if (!map) {
      console.warn('Map is not initialized yet.');
      return;
    }
    const newZoomLevel = map.getZoom();
    console.log(`Handle map idle: New zoom level is ${newZoomLevel}`);

    if (newZoomLevel >= ZOOM_THRESHOLD) {
      if (actualZoomLevel !== newZoomLevel) {
        console.log('Displaying individual markers.');
        actualZoomLevel = newZoomLevel;
        effectiveZoomLevel = null; // Reset effective zoom level
        await fetchIndividualMarkers();  // Fetch and display individual markers

        // Clear clusters if any
        clearClusterMarkers();
      } else {
        console.log('Already displaying individual markers.');
      }
    } else {
      const newEffectiveZoomLevel = getMappedZoomLevel(newZoomLevel);
      if (effectiveZoomLevel !== newEffectiveZoomLevel) {
        console.log(`Effective zoom level changed to ${newEffectiveZoomLevel}. Displaying clusters.`);
        effectiveZoomLevel = newEffectiveZoomLevel;
        actualZoomLevel = null; // Reset actual zoom level
        await fetchClusters(newEffectiveZoomLevel);  // Fetch and display clusters

        // Clear individual markers if any
        clearIndividualMarkers();
      } else {
        console.log('Effective zoom level unchanged.');
      }
    }
  }, 500);

  const initializeMap = () => {
    const options = {
      center: { lat: 39.50, lng: -98.35 },
      zoom: data.initialZoomLevel,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
    };
    map = new google.maps.Map(mapElement, options);
    console.log('Google Map initialized.');
    map.addListener('idle', handleMapIdle);
    console.log('Added "idle" event listener for zoom and pan changes.');
    google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
      console.log('Map tiles loaded.');
      if (data.initialZoomLevel >= ZOOM_THRESHOLD) {
        fetchIndividualMarkers();
      } else {
        fetchClusters(getMappedZoomLevel(data.initialZoomLevel));
      }
    });
  };

  const setupDrawingManager = () => {
    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
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
    console.log('Drawing Manager set up.');

    google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
      console.log('Territory drawn:', polygon.getPath().getArray());
      selectedPolygon = polygon; // Store the polygon
      // Optionally, if you want to allow only one polygon at a time, clear existing polygons
      // Or handle multiple polygons if needed
    });
  };

  const toggleTerritoryMode = () => {
    if (drawingManager.getDrawingMode()) {
      drawingManager.setDrawingMode(null);
      territoryModalExpanded = false;
      console.log('Territory drawing mode disabled.');
    } else {
      drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      territoryModalExpanded = true;
      console.log('Territory drawing mode enabled.');
    }
  };

  const handleTerritoryToggle = (isExpanded) => {
    territoryModalExpanded = isExpanded;
    if (!territoryModalExpanded && drawingManager.getDrawingMode()) {
      drawingManager.setDrawingMode(null);
      console.log('Territory modal closed and drawing mode disabled.');
    }
  };

  const handleSidebarToggle = (isExpanded) => {
    sidebarExpanded = isExpanded;
    console.log(`Sidebar is now ${sidebarExpanded ? 'expanded' : 'collapsed'}.`);
  };

  const handlePan = () => {
    map.setOptions({ draggable: true });
    console.log('Pan mode enabled.');
  };

  const handleFilterLeads = () => {
    console.log('Filter Leads clicked');
    // Implement filter leads functionality here
  };

  const handleToggleTerritoryMode = () => {
    toggleTerritoryMode();
  };

  const handleAssignLeads = () => {
    console.log('Assign Leads clicked');
    if (!selectedPolygon) {
      errorMessage = 'Please draw a territory on the map before assigning leads.';
      return;
    }
    assignLeadsModalExpanded = true;
  };

  const handleCreateLead = () => {
    console.log('Create Lead clicked');
    // Implement create lead functionality here
  };

  // Handle events emitted from AssignLeadsModal
  const handleAssignLeadsToggle = (event) => {
    assignLeadsModalExpanded = event.detail;
  };

  const handleAssignSuccess = () => {
    console.log('Leads assigned successfully. Refreshing markers...');
    // Remove the polygon from the map
    if (selectedPolygon) {
      selectedPolygon.setMap(null);
      selectedPolygon = null;
    }
    // Refresh markers based on current zoom level
    if (map.getZoom() >= ZOOM_THRESHOLD) {
      fetchIndividualMarkers();
    } else {
      fetchClusters(getMappedZoomLevel(map.getZoom()));
    }
  };

  onDestroy(() => {
    clearClusterMarkers();
    clearIndividualMarkers();
    if (markerCluster) {
      markerCluster.clearMarkers();
      console.log('MarkerCluster cleared.');
    }
    if (drawingManager) {
      drawingManager.setMap(null);
      console.log('Drawing Manager removed.');
    }
  });

  /**
   * Dynamically loads the Google Maps script.
   * @param {string} key - The Google Maps API key.
   * @returns {Promise} - Resolves when the script is loaded, rejects on error.
   */
  const loadGoogleMaps = (key) =>
    new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is undefined'));
        return;
      }

      if (window.google && window.google.maps) {
        console.log('Google Maps already loaded.');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps script loaded successfully.');

        // Load MarkerClusterer script
        const markerClustererScript = document.createElement('script');
        markerClustererScript.src = 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/markerclusterer.js';
        markerClustererScript.async = true;
        markerClustererScript.onload = resolve;
        markerClustererScript.onerror = reject;
        document.head.appendChild(markerClustererScript);
      };
      script.onerror = (e) => {
        console.error('Error loading Google Maps script:', e);
        reject(e);
      };
      document.head.appendChild(script);
    });

</script>

<style>
  .error-overlay {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 1001;
    animation: fadeIn 0.5s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .loader {
    border: 8px solid #f3f3f3;
    border-top: 8px solid #007bff;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  #map {
    width: 100%;
    height: 100%;
  }

  .loader,
  .error-overlay {
    z-index: 1000;
  }
</style>

<div class="flex flex-col h-screen relative">
  <CollapsibleSidebar isExpanded={sidebarExpanded} on:toggle={handleSidebarToggle} />
  <div class="flex-1 relative">
    <div id="map" bind:this={mapElement} class="w-full h-full"></div>

    {#if isLoading}
      <div class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-200 bg-opacity-50">
        <div class="loader"></div>
      </div>
    {/if}

    {#if errorMessage}
      <div class="error-overlay">
        <div class="error-message">{errorMessage}</div>
      </div>
    {/if}
  </div>

  {#if territoryModalExpanded}
    <TerritoryModal isExpanded={territoryModalExpanded} on:toggle={handleTerritoryToggle} />
  {/if}

  {#if assignLeadsModalExpanded}
    <AssignLeadsModal
      isExpanded={assignLeadsModalExpanded}
      polygon={selectedPolygon}
      on:toggle={handleAssignLeadsToggle}
      on:assignSuccess={handleAssignSuccess}
    />
  {/if}

  <Toolbar
    isDrawingMode={drawingManager?.getDrawingMode() !== null}
    on:pan={handlePan}
    on:filterLeads={handleFilterLeads}
    on:toggleTerritoryMode={handleToggleTerritoryMode}
    on:assignLeads={handleAssignLeads}
    on:createLead={handleCreateLead}
  />
</div>
