<script setup lang="ts">
import type { TaskItem } from '../../shared/types';
const props = defineProps<{ task: TaskItem }>();
</script>


<template>
<article class="item">
<div class="title">{{ props.task.title }}</div>
<div class="meta">
<a :href="props.task.url" target="_blank">Open</a>
<span v-for="t in props.task.tags" :key="t" class="tag">#{{ t }}</span>
</div>
</article>
</template>


<style scoped>
.item { border: 1px dashed rgba(0,0,0,.15); border-radius: 10px; padding: 8px; }
.title { font-weight: 600; }
.meta { display:flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
.tag { font-size: 12px; opacity: .7; }
</style>