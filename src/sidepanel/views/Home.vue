<template>
  <div class="home">
    <CurrentPageInfo />
    <CurrentTaskList />
  </div>
</template>

<script setup lang="ts">
import CurrentPageInfo from '../components/CurrentPageInfo.vue'
import CurrentTaskList from '../components/CurrentTaskList.vue'
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
</style>