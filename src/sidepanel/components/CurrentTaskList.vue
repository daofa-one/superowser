<script setup lang="ts">
import { usePanelStore } from '../../shared/stores/usePanelStore';
import TaskItem from './TaskItem.vue';
const store = usePanelStore();
</script>


<template>
<section class="card">
<header class="row">
<h3>Current Task</h3>
<button class="toggle" @click="store.toggleTaskList()">
{{ store.taskListOpen ? 'Hide' : 'Show' }}
</button>
</header>
<div v-show="store.taskListOpen" class="list">
<TaskItem v-for="t in store.tasks" :key="t.id" :task="t" />
<div v-if="store.tasks.length === 0" class="empty">No saved pages yet.</div>
</div>
</section>
</template>


<style scoped>
.card { border: 1px solid rgba(0,0,0,.1); border-radius: 12px; padding: 10px; display:flex; flex-direction: column; }
.row { display:flex; align-items:center; justify-content: space-between; }
.list { display:flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.toggle { border: 1px solid rgba(0,0,0,.15); background: transparent; border-radius: 8px; padding: 4px 8px; cursor: pointer; }
.empty { opacity: .6; font-size: 13px; }
</style>