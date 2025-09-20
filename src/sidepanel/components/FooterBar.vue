<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer class="foot">© {{ year }} Superowser</footer>
</template>

<style scoped>
.foot {
  text-align: center;
  opacity: .7;
  font-size: 12px;
  padding: 12px;
  background: white;
  border-top: 1px solid #e0e0e0;
}
</style>