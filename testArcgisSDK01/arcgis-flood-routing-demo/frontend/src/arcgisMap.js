import esriConfig from '@arcgis/core/config.js'
import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'

export async function createMap(container, apiKey) {
  if (!apiKey) {
    console.warn('No ArcGIS API key found. Basemap may not load. Set EXPOSE_API_KEY=true and ARCGIS_API_KEY in backend .env')
  }
  esriConfig.apiKey = apiKey || ''

  const map = new Map({ basemap: 'arcgis-streets' })
  const view = new MapView({
    container,
    map,
    center: [-122.4194, 37.7749],
    zoom: 12,
  })

  const layer = new GraphicsLayer()
  map.add(layer)

  const routeLayer = new GraphicsLayer()
  map.add(routeLayer)

  return { map, view, layer, routeLayer }
}

export function makePointGraphic(lon, lat, color = 'blue') {
  return new Graphic({
    geometry: { type: 'point', longitude: lon, latitude: lat },
    symbol: { type: 'simple-marker', color, size: 10, outline: { color: 'white', width: 1 } },
  })
}

export function makePolylineGraphic(paths, color = [0, 120, 255, 0.9], width = 4) {
  return new Graphic({
    geometry: { type: 'polyline', paths },
    symbol: { type: 'simple-line', color, width },
  })
}
