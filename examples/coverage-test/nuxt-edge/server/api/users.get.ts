// server/api/users.get.ts - 自动成为 GET /api/users
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 20
  const config = useRuntimeConfig()

  // 服务端可用 config.apiSecret
  const data = await $fetch(`${config.apiBase}/users`, {
    params: { page, limit },
    headers: { Authorization: `Bearer ${config.apiSecret}` }
  })

  return {
    items: data.users,
    total: data.total,
    page,
    limit
  }
})

// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  return await $fetch(`/users/${id}`)
})
