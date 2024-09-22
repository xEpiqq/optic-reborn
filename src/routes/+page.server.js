// src/routes/+page.server.js

import { supabase } from '../lib/supabaseClient';

/**
 * Loads initial cluster data for zoom level 5.
 */
export async function load() {
  const initialZoomLevel = 5;

  // Fetch clusters for the initial zoom level without geographical bounds
  const { data, error } = await supabase.rpc('get_cached_clusters', {
    p_zoom_level: initialZoomLevel,
    p_min_lat: null,
    p_min_lon: null,
    p_max_lat: null,
    p_max_lon: null,
  });

  if (error) {
    console.error(`Error fetching clusters for zoom level ${initialZoomLevel}:`, error);
    throw new Error('Failed to fetch initial clusters. Please try again later.');
  }

  return {
    initialClusters: data ?? [],
    initialZoomLevel, // Pass the initial zoom level to the client
  };
}
