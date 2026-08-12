import { mount, flushPromises } from '@vue/test-utils'
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import UserList from '@/components/UserList.vue'

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json({
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
    }))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('UserList with MSW', () => {
  it('loads users on mount', async () => {
    const wrapper = mount(UserList)
    expect(wrapper.text()).toContain('Loading')
    await flushPromises()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('handles API error', async () => {
    server.use(
      rest.get('/api/users', (req, res, ctx) => res(ctx.status(500)))
    )
    const wrapper = mount(UserList)
    await flushPromises()
    expect(wrapper.text()).toContain('Error')
  })
})
