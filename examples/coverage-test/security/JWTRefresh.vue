<script setup>
// jwt-interceptor.js
import axios from 'axios'
import { refreshToken } from '@/api/auth'

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token)
  })
  failedQueue = []
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return axios(originalRequest)
        })
      }
      originalRequest._retry = true
      isRefreshing = true
      try {
        const { token } = await refreshToken()
        localStorage.setItem('token', token)
        axios.defaults.headers.common.Authorization = `Bearer ${token}`
        processQueue(null, token)
        originalRequest.headers.Authorization = `Bearer ${token}`
        return axios(originalRequest)
      } catch (e) {
        processQueue(e, null)
        localStorage.removeItem('token')
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)
</script>

<template>
  <div>
    <h3>JWT 自动刷新</h3>
    <p>401 触发 token 刷新,失败请求加入队列等待重试</p>
  </div>
</template>
