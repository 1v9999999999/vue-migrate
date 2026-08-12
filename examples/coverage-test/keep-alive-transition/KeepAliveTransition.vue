<template>
  <div class="keep-alive-transition">
    <h2>Keep-Alive + Transition Demo</h2>

    <!-- 基础 keep-alive -->
    <keep-alive>
      <component :is="currentTab" />
    </keep-alive>

    <!-- keep-alive + include/exclude/max -->
    <keep-alive :include="cachedComponents" :exclude="excludedComponents" :max="10">
      <component :is="currentView" />
    </keep-alive>

    <!-- transition + keep-alive 组合 -->
    <transition name="fade" mode="out-in" appear>
      <keep-alive>
        <component :is="currentPanel" :key="panelKey" />
      </keep-alive>
    </transition>

    <!-- transition-group 列表动画 -->
    <transition-group name="list" tag="ul" class="animated-list">
      <li v-for="item in listItems" :key="item.id" class="list-item">
        {{ item.text }}
        <button @click="removeItem(item.id)">×</button>
      </li>
    </transition-group>

    <!-- transition 各种 mode -->
    <div class="mode-demo">
      <transition name="slide" mode="out-in">
        <div v-if="show" key="a" class="panel-a">Panel A</div>
        <div v-else key="b" class="panel-b">Panel B</div>
      </transition>
    </div>

    <!-- JS 钩子 transition -->
    <transition
      @before-enter="beforeEnter"
      @enter="onEnter"
      @after-enter="afterEnter"
      @enter-cancelled="enterCancelled"
      @before-leave="beforeLeave"
      @leave="onLeave"
      @after-leave="afterLeave"
      @leave-cancelled="leaveCancelled"
      :css="false"
    >
      <div v-if="jsShow" class="js-hook-panel">JS Hook Transition</div>
    </transition>

    <!-- 切换按钮 -->
    <div class="controls">
      <button @click="switchTab('A')">Tab A</button>
      <button @click="switchTab('B')">Tab B</button>
      <button @click="switchTab('C')">Tab C</button>
      <button @click="switchView">Switch View</button>
      <button @click="switchPanel">Switch Panel</button>
      <button @click="addItem">Add Item</button>
      <button @click="toggleShow">Toggle Show</button>
      <button @click="toggleJsShow">Toggle JS Hook</button>
    </div>
  </div>
</template>

<script>
import TabA from './TabA.vue'
import TabB from './TabB.vue'
import TabC from './TabC.vue'
import ViewA from './ViewA.vue'
import ViewB from './ViewB.vue'
import PanelA from './PanelA.vue'
import PanelB from './PanelB.vue'

export default {
  name: 'KeepAliveTransition',
  components: { TabA, TabB, TabC, ViewA, ViewB, PanelA, PanelB },
  data() {
    return {
      currentTab: 'TabA',
      currentView: 'ViewA',
      currentPanel: 'PanelA',
      panelKey: 'a',
      cachedComponents: ['TabA', 'TabB', 'ViewA'],
      excludedComponents: ['DebugPanel'],
      show: true,
      jsShow: true,
      listItems: [
        { id: 1, text: 'Item 1' },
        { id: 2, text: 'Item 2' },
        { id: 3, text: 'Item 3' }
      ],
      nextId: 4
    }
  },
  methods: {
    switchTab(tab) {
      this.currentTab = tab
    },
    switchView() {
      this.currentView = this.currentView === 'ViewA' ? 'ViewB' : 'ViewA'
    },
    switchPanel() {
      this.currentPanel = this.currentPanel === 'PanelA' ? 'PanelB' : 'PanelA'
      this.panelKey = this.currentPanel === 'PanelA' ? 'a' : 'b'
    },
    addItem() {
      this.listItems.push({ id: this.nextId++, text: `Item ${this.nextId - 1}` })
    },
    removeItem(id) {
      const idx = this.listItems.findIndex(item => item.id === id)
      if (idx !== -1) this.listItems.splice(idx, 1)
    },
    toggleShow() {
      this.show = !this.show
    },
    toggleJsShow() {
      this.jsShow = !this.jsShow
    },
    // JS transition hooks
    beforeEnter(el) {
      el.style.opacity = 0
      el.style.transform = 'translateX(100px)'
    },
    onEnter(el, done) {
      el.style.transition = 'all 0.5s ease'
      el.style.opacity = 1
      el.style.transform = 'translateX(0)'
      el.addEventListener('transitionend', done, { once: true })
    },
    afterEnter(el) {
      el.style.transition = ''
    },
    enterCancelled(el) {
      el.style.transition = ''
    },
    beforeLeave(el) {
      el.style.opacity = 1
    },
    onLeave(el, done) {
      el.style.transition = 'all 0.3s ease'
      el.style.opacity = 0
      el.style.transform = 'translateX(-100px)'
      el.addEventListener('transitionend', done, { once: true })
    },
    afterLeave(el) {
      el.style.transition = ''
      el.style.transform = ''
    },
    leaveCancelled(el) {
      el.style.transition = ''
    }
  }
}
</script>

<style scoped>
.keep-alive-transition {
  padding: 20px;
}
.controls button {
  margin: 3px;
  padding: 6px 12px;
  cursor: pointer;
}

/* fade transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

/* slide transition */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter {
  transform: translateX(100%);
}
.slide-leave-to {
  transform: translateX(-100%);
}

/* list transition-group */
.list-enter-active, .list-leave-active {
  transition: all 0.5s ease;
}
.list-enter, .list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.list-move {
  transition: transform 0.5s ease;
}

.panel-a, .panel-b {
  padding: 20px;
  margin: 10px 0;
}
.panel-a {
  background: #e3f2fd;
}
.panel-b {
  background: #fce4ec;
}
</style>
