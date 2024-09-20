import { supabase } from '../lib/supabaseClient'

export async function load() {
  // Define the bounding box for the contiguous United States
  const min_lat = 24.5;   // Southernmost point (Key West, FL)
  const min_lon = -124.8; // Westernmost point (West Coast)
  const max_lat = 49.5;   // Northernmost point (Canada border)
  const max_lon = -66.9;  // Easternmost point (East Coast)
  
  // Set a lower zoom level for initial load to increase grid size and reduce clusters
  const zoom_level = 2;   // Adjusted zoom level

  // Call the 'get_clusters' RPC with the US bounding box and adjusted zoom level
  const { data, error } = await supabase.rpc('get_clusters', {
    min_lat,
    min_lon,
    max_lat,
    max_lon,
    zoom_level,
  });

  if (error) {
    console.error('Error fetching clusters:', error);
    // Optionally, you can throw an error to display a message in the frontend
    throw new Error('Failed to fetch clusters. Please try again later.');
  }

  return {
    clusters: data ?? [], // Ensure clusters is always an array
  };
}