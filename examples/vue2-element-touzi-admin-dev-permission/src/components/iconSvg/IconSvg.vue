<template>
  <svg class="svg-icon" aria-hidden="true">
    <use :xlink:href="iconName"></use>
  </svg>
</template>

<script>export default {
  name: 'icon-svg',
  /*
   * vue3-types inferred props shape:
   * @type {{ iconClass: string }}
   * (In Vue3, the recommended equivalent is
   *   const props = defineProps<{ iconClass: string }>()
   *   in <script setup>. For Options API, runtime props are kept as-is.)
   */
  props: {
    iconClass: {
      type: String,
      required: true
    }
  },
  computed: {
    /*
     * this 类型:
     * {
     *   iconClass: string
     * }
     */
    iconName() {
      return `#${this.iconClass}`;
    }
  }
};</script>

<style>
.svg-icon {
  width: 1em;
  height: 1em;
  font-size: 18px;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
}
</style>
