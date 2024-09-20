import { supabase } from '../../../lib/supabaseClient'
import { json } from '@sveltejs/kit';
export async function GET({ url }) {

    const minLat = parseFloat(url.searchParams.get('minLat')) || -90;
    const minLon = parseFloat(url.searchParams.get('minLon')) || -180;
    const maxLat = parseFloat(url.searchParams.get('maxLat')) || 90;
    const maxLon = parseFloat(url.searchParams.get('maxLon')) || 180;
    const zoom = parseInt(url.searchParams.get('zoom')) || 10;

    try {
        const { data, error } = await supabase
            .rpc('get_clusters', {
                min_lat: minLat,
                min_lon: minLon,
                max_lat: maxLat,
                max_lon: maxLon,
                zoom_level: zoom
            });

        if (error) {
            console.error('Error fetching clusters:', error);
            return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const clusters = data.map(row => ({
            count: row.count,             // BIGINT in PostgreSQL maps to JavaScript Number
            latitude: row.latitude,
            longitude: row.longitude
        }));

        return json(clusters);
    } catch (err) {
        console.error('Unexpected error:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}