<script setup lang="ts">
import Menu from './components/Menu.vue';
import FooterBar from './components/FooterBar.vue';
</script>

<template>
  <div class="sp-root">
    <Menu />
    <main class="sp-main">
      <router-view />
    </main>
    <FooterBar />
  </div>
</template>

<style scoped>
.sp-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji;
  background: #f5f5f5;
  overflow: hidden;
}

.sp-main {
  flex: 1;
  overflow-y: scroll; /* Always reserve space for scrollbar */
  background: white;
  min-height: 0;
}
</style>