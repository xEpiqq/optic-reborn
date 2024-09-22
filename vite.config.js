import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [sveltekit()],

  optimizeDeps: {
    // Include the module in the dependency pre-bundling step
    include: ['@googlemaps/markerclusterer'],
  },
  ssr: {
    noExternal: ['@googlemaps/markerclusterer'], // Treat this module as a regular dependency during SSR
  }
});
