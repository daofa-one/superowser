<script setup lang="ts">
import { computed } from 'vue';
import { usePanelStore } from '../../shared/stores/usePanelStore';
import { formatUrl } from '../../shared/utils';
const store = usePanelStore();
const host = computed(() => formatUrl(store.currentPage.url || ''));
</script>


<template>
<section class="card">
<header>
<img v-if="store.currentPage.faviconUrl" :src="store.currentPage.faviconUrl" alt="favicon" />
<div class="titles">
<div class="title">{{ store.currentPage.title }}</div>
<div class="sub">{{ host }}</div>
</div>
</header>
<div class="meta">
<div class="tags">
<span v-for="t in store.currentPage.tags" :key="t" class="tag">#{{ t }}</span>
</div>
<p v-if="store.currentPage.notes">{{ store.currentPage.notes }}</p>
</div>
</section>
</template>


<style scoped>
.card { border: 1px solid rgba(0,0,0,.1); border-radius: 12px; padding: 10px; }
header { display:flex; gap: 10px; align-items: center; }
img { width: 16px; height: 16px; }
.title { font-weight: 600; }
.sub { font-size: 12px; opacity: .7; }
.tags { display:flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.tag { font-size: 12px; opacity: .8; }
</style>