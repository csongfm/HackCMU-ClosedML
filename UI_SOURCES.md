# Briefly UI sources

- Kokonut UI Background Paths: https://kokonutui.com/docs/backgrounds/background-paths ? adapted SVG path geometry in components/kokonutui/flow-paths.tsx. Simplified to 16 deterministic paths, with reduced-motion support and monochrome colors. MIT license in licenses/Kokonut-UI.txt.
- Motion: https://motion.dev/docs/react ? installed motion; shared reduced-motion configuration, hero entrance, and feed layout animation.
- Bklit UI Gauge: https://bklit.com/docs/components/gauge-chart ? adapted radial notch geometry in components/bklit/feedback-gauge.tsx. Displays actual ratings retained out of 200; not a confidence or accuracy score. MIT license in licenses/Bklit-UI.txt.
- Anton: https://github.com/google/fonts/tree/main/ofl/anton ? locally served display font; OFL license in public/fonts/OFL-Anton.txt.

Research also covered Kokonut Flow Field, Shapes Hero and Shimmer Text, Bklit installation and chart options, and Motion layout/accessibility documentation. The focused adaptations avoid pulling unused chart packages into the app.
