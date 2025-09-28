<template>
  <div class="chat-view">
    <ChatBox />
  </div>
</template>

<script setup lang="ts">
import ChatBox from '../components/ChatBox.vue'
</script>

<style scoped>
.chat-view {
  height: 100%;
  display: flex;
}
</style>
