// 完整 useFetch 边缘
export function useUsers() {
  return useFetch('/api/users', {
    key: 'users-list',
    default: () => [],
    server: true,
    lazy: false,
    immediate: true,
    watch: [() => useRoute().query.page],
    transform: (data) => data.items,
    pick: ['id', 'name'],
    onResponse({ request, response, options }) {
      // 处理 response
    },
    onResponseError({ request, options, error }) {
      // 处理错误
    }
  })
}

export function useUserPosts(userId) {
  return useFetch(() => `/api/users/${userId}/posts`, {
    key: () => `user-posts-${userId}`,
    default: () => [],
    watch: [userId]
  })
}
