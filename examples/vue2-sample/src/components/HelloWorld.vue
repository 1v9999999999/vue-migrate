<template>
  <div class="hello">
    <h2>Hello, {{ name }}!</h2>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    name: {
      type: String,
      default: 'World'
    }
  }
}
</script>
