<template>
  <div id="app">
    <router-view v-slot="{ Component, route }">
      <transition name="page" mode="out-in">
        <keep-alive :include="cachedViews">
          <component :is="Component" :key="route.fullPath" />
        </keep-alive>
      </transition>
    </router-view>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() { return { cachedViews: ['Home', 'Profile'] } }
}
</script>

<style>
.page-enter-active, .page-leave-active { transition: all 0.3s; }
.page-enter, .page-leave-to { opacity: 0; transform: translateX(20px); }
</style>
