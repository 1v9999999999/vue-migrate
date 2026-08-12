<template>
  <div :style="themeVars" class="themed">
    <header class="themed-header">
      <h1 :style="{ color: 'var(--primary)' }">Dynamic Style + CSS Variables</h1>
      <button class="toggle-btn" @click="toggleDark()">
        切换主题 (当前: {{ isDark ? 'dark' : 'light' }})
      </button>
    </header>

    <!--
      真实集成场景:
      Vue 动态 style + CSS variables 是跨版本通用的主题方案:
        1. 父组件计算 :style 注入 CSS vars
        2. 子组件 <style> 中通过 var(--name) 引用
        3. 切换主题 = 改变 CSS vars, 不触发组件重渲染

      优势:
        - 性能: 只改 DOM style 属性, 不重渲染
        - 跨组件: CSS vars 继承, 子组件直接用
        - SSR 友好: 初始值可直接序列化
    -->

    <main class="themed-main">
      <section class="themed-card">
        <h2 :style="{ color: 'var(--primary)' }">Card Title</h2>
        <p :style="{ color: 'var(--text)' }">
          这里是卡片内容, 主题色通过 CSS variable 切换,
          不会触发组件 re-render, 仅修改 DOM style 属性
        </p>
        <code :style="{ color: 'var(--text-secondary)' }">
          var(--primary), var(--text)
        </code>
      </section>

      <section class="themed-card">
        <h2 :style="{ color: 'var(--primary)' }">Form</h2>
        <input
          v-model="inputVal"
          type="text"
          class="themed-input"
          placeholder="input"
        />
        <p :style="{ color: 'var(--text-secondary)' }">value: {{ inputVal }}</p>
      </section>

      <section class="themed-card">
        <h2 :style="{ color: 'var(--primary)' }">Computed 动态 style</h2>
        <div
          class="color-block"
          :style="dynamicBlockStyle"
        >
          动态宽高 + 背景色
        </div>
        <button class="themed-btn" @click="changeBlock">change block</button>
      </section>
    </main>

    <hr :style="{ borderColor: 'var(--border)' }" />

    <footer class="themed-footer">
      <p :style="{ color: 'var(--text-secondary)' }">
        ✅ CSS Variables 完整支持:
        <br />1. :style 注入 --primary, --bg, --text
        <br />2. &lt;style&gt; 中 var(--name) 引用
        <br />3. computed 返回对象, 自动响应
        <br />4. 配合 VueUse 的 useDark/useStorage 实现持久化
      </p>
    </footer>
  </div>
</template>

<script>
/**
 * 动态 style + CSS variables 集成
 *
 * 依赖: @vueuse/core (实际项目用)
 * 安装: npm i @vueuse/core
 *
 * Vue 2.7+ 中 Options API 也可写, 但 Composition API 更直观.
 * 本文件用 Options API 演示, 行为等价.
 */

import { computed, ref } from 'vue'

// 模拟 @vueuse/core 的 useDark / useToggle
// 实际项目: import { useDark, useToggle } from '@vueuse/core'
function useDark() {
  const ref = { value: false }
  // 实际会读 localStorage 'vueuse-color-scheme'
  return ref
}
function useToggle(dark) {
  return () => {
    dark.value = !dark.value
  }
}

export default {
  name: 'DynamicStyleBinding',
  data() {
    return {
      inputVal: '',
      blockSize: 100,
      blockColor: 'var(--primary)'
    }
  },
  computed: {
    /**
     * 模拟 useDark 返回的 ref
     * Vue 2.7+ 中可用 .value, 但 Options API 写法直接返回 ref
     */
    isDark() {
      // 实际: const isDark = useDark(); return isDark
      return this._isDark
    },
    /**
     * 动态主题变量
     */
    themeVars() {
      const dark = this.isDark
      return {
        '--primary': dark ? '#5a8cff' : '#42b983',
        '--primary-hover': dark ? '#7ba7ff' : '#369870',
        '--bg': dark ? '#1a1a1a' : '#ffffff',
        '--text': dark ? '#e0e0e0' : '#333333',
        '--text-secondary': dark ? '#a0a0a0' : '#909399',
        '--border': dark ? '#333' : '#eee'
      }
    },
    /**
     * 动态 block 样式
     */
    dynamicBlockStyle() {
      return {
        width: this.blockSize + 'px',
        height: this.blockSize / 2 + 'px',
        background: this.blockColor,
        transition: 'all 0.3s'
      }
    }
  },
  created() {
    // 模拟 useDark / useToggle
    this._isDark = useDark()
    this._toggleDark = useToggle(this._isDark)
  },
  methods: {
    toggleDark() {
      this._toggleDark()
    },
    changeBlock() {
      this.blockSize = this.blockSize === 100 ? 200 : 100
      this.blockColor = this.blockColor === 'var(--primary)'
        ? 'var(--primary-hover)'
        : 'var(--primary)'
    }
  }
}
</script>

<style scoped>
/*
  CSS variables 在 <style> 中通过 var(--name) 引用.
  父组件通过 :style 注入, 子组件继承.
  切换主题 = 修改 var, 不触发组件 re-render.
*/
.themed {
  background: var(--bg);
  color: var(--text);
  padding: 16px;
  transition: all 0.3s;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: sans-serif;
  min-height: 400px;
}
.themed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.themed-header h1 {
  margin: 0;
  font-size: 22px;
}
.themed-main {
  display: grid;
  gap: 12px;
}
.themed-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  transition: all 0.3s;
}
.themed-card h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.themed-card p {
  margin: 4px 0;
  line-height: 1.6;
}
.themed-card code {
  font-family: monospace;
  font-size: 12px;
  background: rgba(127, 127, 127, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
}
.themed-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  box-sizing: border-box;
  font-size: 14px;
  transition: all 0.3s;
}
.themed-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}
.themed-btn {
  padding: 6px 14px;
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--bg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 8px;
  transition: all 0.3s;
}
.themed-btn:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}
.toggle-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}
.toggle-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.color-block {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border-radius: 4px;
  margin-bottom: 8px;
}
.themed-footer p {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
}
hr {
  border: none;
  border-top: 1px solid;
  margin: 16px 0;
}
</style>
