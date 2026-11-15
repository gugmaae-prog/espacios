# Degraded heatmap boundary recovery, 15 November 2026

The accepted 3,126-feature area surface currently returns HTTP 503 because its private source object is unavailable while R2 is disabled. Its key is absent from the verified immutable recovery manifest. The full source remains preferred whenever it becomes readable.

The scoped fallback contains 222 Dubai Municipality community polygons from [Dubai Real Estate GIS](https://github.com/martaferreirahuspy/dubai-realestate-gis/blob/main/dubai_communities.geojson), whose source repository identifies Dubai Municipality ArcGIS as the publisher, plus seven existing geoBoundaries gbOpen emirate outlines. The downloaded Dubai file's SHA-256 is `ec6900f2f3471a502f14749b6c156f5f8715b70f6311d09815f9eae37c0ca993`. The bundled fallback has 229 features and is labelled in the response and map. It is display geometry, not a cadastral survey.

Registered-sale AED/sqft remains the independent DLD-derived August 2026 monthly median for the selected apartment and registration basket, with the existing minimum of 20 eligible sales. Exact names and four reviewed name joins attach 27 of 28 eligible areas to the fallback polygons. `Al Yelayiss 2` has no unambiguous polygon in this boundary source and remains unshaded. The renderer's smoothing creates no extra observations or valuations.

The ROI control displays published projected **gross rental yield** benchmarks, not total investment return. Where a benchmark lacks an exact polygon, the map uses a distinct coloured spot at a uniquely matched catalogue community centre. These centres are approximate navigation locations; their halos do not assign the benchmark to surrounding land. Mixed apartment and villa selections retain separate values and omit centre spots.

Project density, registered sales, asking benchmarks, gross yield, and conditional scenarios remain separate evidence classes. The accepted V48 project and history data are not changed by this recovery.

The map's metric controls now share the project heatmap's blue, teal, green, and amber glow style. Price uses the source-area median raster, gross yield uses a faint matched polygon with a labelled catalogue-centre glow, and Sales activity uses the quality-screened registered-sale sample count raster. Forecast glows are conditional scenarios over supported source areas only. Their units, date ranges, source labels, and legends remain separate; the shared colours do not imply that project density, sales, yields, and estimates are comparable values.
