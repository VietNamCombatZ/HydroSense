import { useEffect, useRef, useState } from 'react'
import api from './api'
import { createMap, makePointGraphic, makePolylineGraphic } from './arcgisMap'

export default function App() {
  const viewDiv = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const stateRef = useRef({})

  const [A, setA] = useState(null)
  const [B, setB] = useState(null)
  const [route, setRoute] = useState(null)
  const [info, setInfo] = useState(null)
  const [directions, setDirections] = useState([])
  const [floods, setFloods] = useState([])

  const [floodDrawMode, setFloodDrawMode] = useState(false)
  const [tempFloodPts, setTempFloodPts] = useState([])

  useEffect(() => {
    let view, layer, routeLayer
    (async () => {
      const cfg = await api.getConfig()
      const { view: v, layer: l, routeLayer: rl } = await createMap(viewDiv.current, cfg.arcgisApiKey)
      view = v; layer = l; routeLayer = rl
      stateRef.current.view = view
      stateRef.current.layer = layer
      stateRef.current.routeLayer = routeLayer

      view.on('click', (e) => {
        const { longitude: x, latitude: y } = e.mapPoint
        if (floodDrawMode) {
          const pts = [...tempFloodPts, [x, y]]
          setTempFloodPts(pts)
          if (pts.length === 2) {
            // create simple flood line between two points
            api.addFlood(pts).then(() => refreshFloods())
            setFloodDrawMode(false)
            setTempFloodPts([])
            setRoute(null)
            setDirections([])
            if (A && B) doRoute(A, B)
          }
          return
        }
        if (!A) { setA({ x, y }) }
        else if (!B) { setB({ x, y }) }
        else { setA({ x, y }); setB(null); setRoute(null); setDirections([]) }
      })

  await refreshFloods()
      setMapReady(true)
    })()

    async function refreshFloods() {
      const list = await api.getFloods()
      setFloods(list)
    }

    return () => {
      if (view) view.destroy()
    }
  }, [floodDrawMode, tempFloodPts, A, B])

  useEffect(() => {
    if (!mapReady) return
    renderGraphics()
  }, [mapReady, A, B, route, floods])

  async function doRoute(a, b) {
    try {
      const floodLines = floods.map(f => f.coordinates)
      const res = await api.requestRoute(a, b, floodLines)
      setRoute(res.route)
      setInfo({ distanceKm: res.distanceKm, durationMin: res.durationMin })
      setDirections(res.directions)
    } catch (e) {
      alert(e.message)
    }
  }

  function renderGraphics() {
    const { layer, routeLayer } = stateRef.current
    if (!layer || !routeLayer) return
    layer.removeAll()
    routeLayer.removeAll()

    if (A) layer.add(makePointGraphic(A.x, A.y, 'green'))
    if (B) layer.add(makePointGraphic(B.x, B.y, 'red'))

    floods.forEach(f => {
      routeLayer.add(makePolylineGraphic([f.coordinates], [200, 0, 0, 0.6], 6))
    })

    if (route?.paths) {
      routeLayer.add(makePolylineGraphic(route.paths, [0, 120, 255, 0.9], 4))
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h3>Flood-aware Routing</h3>
        <div className="controls">
          <div className="row">
            <span className="badge">A</span>
            <span className="code">{A ? `${A.x.toFixed(5)}, ${A.y.toFixed(5)}` : 'Click map'}</span>
          </div>
          <div className="row">
            <span className="badge">B</span>
            <span className="code">{B ? `${B.x.toFixed(5)}, ${B.y.toFixed(5)}` : 'Click map'}</span>
          </div>
          <div className="row">
            <button disabled={!A || !B} onClick={() => doRoute(A, B)}>Route</button>
            <button onClick={() => { setA(null); setB(null); setRoute(null); setDirections([]) }}>Clear</button>
          </div>
          <div className="row">
            <button onClick={() => setFloodDrawMode(!floodDrawMode)} style={{ background: floodDrawMode ? '#ffd54f' : undefined }}>
              {floodDrawMode ? 'Click 2 points…' : 'Toggle Flooded Segment'}
            </button>
          </div>
        </div>

        {info && (
          <div>
            <div>Distance: {info.distanceKm.toFixed(2)} km</div>
            <div>Duration: {info.durationMin.toFixed(1)} min</div>
          </div>
        )}

        {!!directions.length && (
          <div>
            <h4>Directions</h4>
            <ol>
              {directions.map((d, i) => <li key={i}>{d}</li>)}
            </ol>
          </div>
        )}

        {!!floods.length && (
          <div>
            <h4>Flooded segments</h4>
            <ul>
              {floods.map(f => (
                <li key={f.id}>
                  <span className="code">{f.coordinates.map(c => c.map(n => n.toFixed(3)).join(',')).join(' | ')}</span>
                  <button onClick={async () => { await api.deleteFlood(f.id); setRoute(null); setDirections([]); setFloods(await api.getFloods()); if (A && B) doRoute(A, B) }}>X</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="map"><div id="viewDiv" ref={viewDiv} /></div>
    </div>
  )
}
