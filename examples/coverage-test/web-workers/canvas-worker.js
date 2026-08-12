// canvas-worker.js
// OffscreenCanvas 在 worker 中接收 canvas 并渲染

self.onmessage = (e) => {
  const { canvas, width = 400, height = 300 } = e.data
  if (!canvas) return

  const ctx = canvas.getContext('2d')

  // 简单渐变渲染作为示例
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#ff6b6b')
  gradient.addColorStop(0.5, '#4ecdc4')
  gradient.addColorStop(1, '#45b7d1')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // 绘制网格
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  for (let x = 0; x < width; x += 20) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y < height; y += 20) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}
