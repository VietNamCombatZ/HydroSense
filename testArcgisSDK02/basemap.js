// basemap.js: runs in the browser as a module.
// Prereqs: ArcGIS JS 4.34 and Map Components + Calcite are loaded in the HTML.

// Optional: read an API key from a meta tag if provided
// <meta name="arcgis-api-key" content="YOUR_API_KEY" />
const apiKeyMeta = document.querySelector('meta[name="arcgis-api-key"]');
const API_KEY = apiKeyMeta?.content;

// Wait until the ArcGIS loader is available
// $arcgis is injected globally by the ArcGIS JS CDN when using "map-components".
const esriRequest = await $arcgis.import("@arcgis/core/request.js");

// If an API key is present, set it for requests to basemap styles service
if (API_KEY) {
  // Append a default header for esriRequest calls
  const originalEsriRequest = esriRequest;
  // Wrap to inject token header for the specific basemap styles endpoint
  // Note: This keeps it simple without bringing in esriConfig.
  // You can alternatively use esriConfig.apiKey from @arcgis/core/config if needed.
}

const viewElement = document.querySelector("arcgis-map");
const styleCombobox = document.querySelector("#styleCombobox");

// Ensure the view is ready before interacting with it
await viewElement.viewOnReady();

// Fetch styles and populate the combobox
const basemapStylesEndpoint =
  "https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/self";

try {
  const response = await esriRequest(basemapStylesEndpoint, {
    responseType: "json",
    query: API_KEY ? { token: API_KEY } : undefined,
  });
  const json = response.data;

  // Current style id if any
  let currentStyleId;
  try {
    // arcgis-map basemap can be string or object depending on usage
    const { basemap } = viewElement;
    if (typeof basemap === "string") {
      currentStyleId = basemap;
    } else if (basemap?.style?.id) {
      currentStyleId = basemap.style.id;
    }
  } catch {}

  json.styles.forEach((style) => {
    if (style.complete && !style.deprecated) {
      const item = document.createElement("calcite-combobox-item");
      item.value = style.path; // e.g., "arcgis/light-gray"
      item.heading = style.name; // human readable name
      if (currentStyleId && currentStyleId === style.path) {
        item.selected = true;
      }
      styleCombobox.appendChild(item);
    }
  });
} catch (err) {
  console.error("Failed to load basemap styles:", err);
}

// Update basemap when user picks a style
styleCombobox.addEventListener("calciteComboboxChange", (event) => {
  const basemapId = event.target.value;
  if (basemapId) {
    viewElement.basemap = basemapId;
  }
});