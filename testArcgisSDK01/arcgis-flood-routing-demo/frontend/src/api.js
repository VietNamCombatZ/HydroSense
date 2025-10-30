const api = {
  async getConfig() {
    const res = await fetch('/api/config')
    return res.json()
  },
  async getFloods() {
    const res = await fetch('/api/floods')
    return res.json()
  },
  async addFlood(coordinates) {
    const res = await fetch('/api/floods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates })
    })
    return res.json()
  },
  async deleteFlood(id) {
    const res = await fetch(`/api/floods/${id}`, { method: 'DELETE' })
    return res.json()
  },
  async requestRoute(origin, destination, flood_lines = []) {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, flood_lines })
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Route failed: ${t}`)
    }
    return res.json()
  }
}

export default api
