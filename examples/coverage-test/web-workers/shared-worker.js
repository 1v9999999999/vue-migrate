// shared-worker.js
const connections = []

self.addEventListener('connect', (e) => {
  const port = e.ports[0]
  connections.push(port)
  port.onmessage = (event) => {
    // 广播给所有 tab
    connections.forEach(p => p.postMessage({ type: 'broadcast', data: event.data }))
  }
})
