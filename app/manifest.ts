import type { MetadataRoute } from "next";

// Colours follow the Axoraa look: warm canvas behind the app, canvas-coloured title bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Axoraa Hub",
    short_name: "Axoraa",
    description: "Work logs, pipeline, delivery and collections for the Axoraa team.",
    start_url: "/",
    display: "standalone",
    background_color: "#ebebe6",
    theme_color: "#ebebe6",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
