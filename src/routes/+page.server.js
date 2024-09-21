// src/routes/+page.server.js

import { supabase } from '../lib/supabaseClient';

export async function load() {
  // Define the zoom levels you want to support
  const zoomLevels = [2, 3]; // Add more zoom levels as needed

  // Initialize an object to store clusters for each zoom level
  const clustersByZoom = {};

  // Fetch clusters for each zoom level
  for (const zoomLevel of zoomLevels) {
    const { data, error } = await supabase.rpc('get_cached_clusters', {
      p_zoom_level: zoomLevel,
    });

    if (error) {
      console.error(`Error fetching clusters for zoom level ${zoomLevel}:`, error);
      throw new Error('Failed to fetch clusters. Please try again later.');
    }

    clustersByZoom[zoomLevel] = data ?? [];
  }

  return {
    clusters: clustersByZoom, // Object containing clusters for each zoom level
  };
}
