<script setup>
// 配合 server 端生成 nonce (e.g. Express helmet)
// res.setHeader("Content-Security-Policy", `script-src 'nonce-${nonce}'`)

// 客户端用 nonce 注入 inline script
const nonce = document.querySelector('meta[name="csp-nonce"]')?.content

// 动态创建 script
function addInlineScript(content) {
  const script = document.createElement('script')
  script.nonce = nonce
  script.textContent = content
  document.head.appendChild(script)
}

// 动态 style
function addInlineStyle(content) {
  const style = document.createElement('style')
  style.nonce = nonce
  style.textContent = content
  document.head.appendChild(style)
}
</script>

<template>
  <div>
    <h3>CSP Nonce</h3>
    <p>当前 nonce: <code>{{ nonce }}</code></p>
  </div>
</template>
