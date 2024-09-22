-- 1. compute_clusters
DECLARE
    grid_size DOUBLE PRECISION;
    min_lat DOUBLE PRECISION := 24.5;
    min_lon DOUBLE PRECISION := -124.8;
    max_lat DOUBLE PRECISION := 49.5;
    max_lon DOUBLE PRECISION := -66.9;
BEGIN
    -- Determine grid size based on zoom level
    grid_size := CASE 
                  WHEN p_zoom_level = 2 THEN 45
                  WHEN p_zoom_level = 5 THEN 1.40625
                  WHEN p_zoom_level = 6 THEN 0.703125
                  WHEN p_zoom_level = 7 THEN 0.3515625
                  WHEN p_zoom_level = 8 THEN 0.17578125
                  WHEN p_zoom_level = 9 THEN 0.087890625
                  WHEN p_zoom_level = 10 THEN 0.0439453125
                  ELSE 90 / (2 ^ (p_zoom_level + 1))
                END;

    DELETE FROM public.clusters_cache 
    WHERE zoom_level = p_zoom_level;

    INSERT INTO public.clusters_cache (count, latitude, longitude, zoom_level)
    SELECT 
        COUNT(*) AS count,
        AVG(ST_Y(location)) AS latitude,
        AVG(ST_X(location)) AS longitude,
        p_zoom_level
    FROM public.restaurants
    WHERE 
        location && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)::geometry
    GROUP BY 
        ST_SnapToGrid(location, grid_size, grid_size);
END;
-- 2. get_cached_clusters
BEGIN
    RETURN QUERY
    SELECT 
        cc.count, 
        cc.latitude, 
        cc.longitude, 
        cc.zoom_level 
    FROM public.clusters_cache cc
    WHERE cc.zoom_level = p_zoom_level
      AND (
          p_min_lat IS NULL 
          OR (cc.latitude BETWEEN p_min_lat AND p_max_lat)
      )
      AND (
          p_min_lon IS NULL 
          OR (cc.longitude BETWEEN p_min_lon AND p_max_lon)
      );
END;
-- 3. get_restaurant_columns

BEGIN
  RETURN QUERY
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_name = 'restaurants' AND c.table_schema = 'public';
END;

--4. get_restaurants_in_bounds
BEGIN
  RETURN QUERY
  SELECT 
    restaurants.id,            -- Qualify the "id" with the table name
    restaurants.address, 
    ST_Y(restaurants.location::geometry) AS latitude, 
    ST_X(restaurants.location::geometry) AS longitude
  FROM restaurants
  WHERE ST_Within(
    restaurants.location,
    ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)
  );
END;
--5. trigger_update_clusters_cache

BEGIN
    PERFORM public.update_clusters_cache();
    RETURN NULL;
END;

--6. update_clusters_cache

BEGIN
    PERFORM compute_clusters(2);
    PERFORM compute_clusters(5);
    PERFORM compute_clusters(6);
    PERFORM compute_clusters(7);
    PERFORM compute_clusters(8);
    PERFORM compute_clusters(9);
    PERFORM compute_clusters(10);
END;

-----------------TRIGGERS---------------
