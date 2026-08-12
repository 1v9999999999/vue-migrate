<script>
import {
  onBeforeMount, onMounted, onBeforeUpdate, onUpdated,
  onBeforeUnmount, onUnmounted, onActivated, onDeactivated,
  onErrorCaptured, onRenderTracked, onRenderTriggered,
  onServerPrefetch
} from 'vue'

export default {
  name: 'LifecycleInComposition',
  setup() {
    const log = []
    onBeforeMount(() => log.push('onBeforeMount'))
    onMounted(() => log.push('onMounted'))
    onBeforeUpdate(() => log.push('onBeforeUpdate'))
    onUpdated(() => log.push('onUpdated'))
    onBeforeUnmount(() => log.push('onBeforeUnmount'))
    onUnmounted(() => log.push('onUnmounted'))
    onActivated(() => log.push('onActivated'))
    onDeactivated(() => log.push('onDeactivated'))
    onErrorCaptured((err, vm, info) => { log.push('onErrorCaptured'); return false })
    onRenderTracked(() => log.push('onRenderTracked'))
    onRenderTriggered(() => log.push('onRenderTriggered'))
    onServerPrefetch(async () => { log.push('onServerPrefetch') })
    return { log }
  }
}
</script>
