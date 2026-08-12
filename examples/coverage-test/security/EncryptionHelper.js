// utils/crypto.js

// 1. SHA-256 哈希
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// 2. AES-GCM 加密
export async function encryptAES(plaintext, password) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return { encrypted: new Uint8Array(encrypted), iv }
}

// 3. RSA 签名
export async function sign(message, privateKey) {
  const enc = new TextEncoder()
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    privateKey,
    enc.encode(message)
  )
  return new Uint8Array(signature)
}

// 4. Secure storage (sessionStorage + encryption)
export async function secureSet(key, value, password) {
  const { encrypted, iv } = await encryptAES(JSON.stringify(value), password)
  sessionStorage.setItem(key, JSON.stringify({ encrypted: Array.from(encrypted), iv: Array.from(iv) }))
}
