// 主应用
import { initGlobalState } from 'qiankun'

const initialState = {
  user: null,
  theme: 'light',
  language: 'zh-CN'
}

const actions = initGlobalState(initialState)

// 主应用监听
actions.onGlobalStateChange((state, prev) => {
  console.log('main state changed:', state)
  localStorage.setItem('app-state', JSON.stringify(state))
})

// 修改状态
actions.setGlobalState({ theme: 'dark' })

// 子应用接收
export function mount(props) {
  props.onGlobalStateChange((state) => {
    console.log('sub app state:', state)
  })
  props.setGlobalState({ subReady: true })
}
