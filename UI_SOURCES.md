# Briefly UI sources

- Kokonut UI Background Paths: https://kokonutui.com/docs/backgrounds/background-paths ? adapted SVG path geometry in components/kokonutui/flow-paths.tsx. Simplified to 16 deterministic paths, with reduced-motion support and monochrome colors. MIT license in licenses/Kokonut-UI.txt.
- Motion: https://motion.dev/docs/react ? installed motion; shared reduced-motion configuration, hero entrance, and feed layout animation.
- Bklit UI Gauge: https://bklit.com/docs/components/gauge-chart ? adapted radial notch geometry in components/bklit/feedback-gauge.tsx. Displays actual ratings retained out of 200; not a confidence or accuracy score. MIT license in licenses/Bklit-UI.txt.
- Anton: https://github.com/google/fonts/tree/main/ofl/anton ? locally served display font; OFL license in public/fonts/OFL-Anton.txt.

Research also covered Kokonut Flow Field, Shapes Hero and Shimmer Text, Bklit installation and chart options, and Motion layout/accessibility documentation. The focused adaptations avoid pulling unused chart packages into the app.

- Bklit stat-card-choropleth-01: https://ui.bklit.com/r/stat-card-choropleth-01.json and https://ui.bklit.com/r/choropleth-chart.json. Adapted the map-card layout and Mercator/context primitives into components/bklit/location-map.tsx and components/charts/choropleth. Replaced analytics values with country selection, added accessible SVG selection and zoom controls, and used existing Lucide icons instead of the paid Central Icons dependency. MIT license retained in licenses/Bklit-UI.txt.
- Local world map: world-atlas 2.0.2 countries-110m.json, converted to GeoJSON with Antarctica omitted for the location picker. https://github.com/topojson/world-atlas ; license in public/maps/LICENSE-world-atlas.txt. This generalized map omits some small countries; the text field supports locations absent from the map.
