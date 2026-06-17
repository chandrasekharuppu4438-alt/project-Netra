import type * as L from 'leaflet'

export class HeatLayer {
  private _map: L.Map | null = null
  private _canvas: HTMLCanvasElement | null = null
  private _latlngs: [number, number, number][]
  private _options: { radius?: number; blur?: number; maxZoom?: number }

  constructor(latlngs: [number, number, number][], options: { radius?: number; blur?: number; maxZoom?: number } = {}) {
    this._latlngs = latlngs
    this._options = options
  }

  addTo(map: L.Map): this {
    this._map = map
    this._initCanvas()
    map.on('moveend', this._redraw, this)
    map.on('zoomend', this._redraw, this)
    this._redraw()
    return this
  }

  remove() {
    if (this._map) {
      this._map.off('moveend', this._redraw, this)
      this._map.off('zoomend', this._redraw, this)
    }
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas)
    }
    this._canvas = null
    this._map = null
  }

  private _initCanvas() {
    if (!this._map) return
    const size = this._map.getSize()
    const canvas = document.createElement('canvas')
    canvas.width = size.x
    canvas.height = size.y
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'
    canvas.style.opacity = '0.65'
    const pane = this._map.getPanes().overlayPane
    if (pane) pane.appendChild(canvas)
    this._canvas = canvas
  }

  private _redraw = () => {
    if (!this._map || !this._canvas) return
    const size = this._map.getSize()
    this._canvas.width = size.x
    this._canvas.height = size.y
    const bounds = this._map.getBounds()
    const topLeft = this._map.latLngToContainerPoint(bounds.getNorthWest())
    this._canvas.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size.x, size.y)
    const radius = this._options.radius ?? 25

    this._latlngs.forEach(([lat, lng, intensity]) => {
      const point = this._map!.latLngToContainerPoint([lat, lng])
      const x = point.x - topLeft.x
      const y = point.y - topLeft.y
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(15, 110, 86, ${intensity * 0.8})`)
      gradient.addColorStop(0.5, `rgba(251, 191, 36, ${intensity * 0.4})`)
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    })
  }
}
