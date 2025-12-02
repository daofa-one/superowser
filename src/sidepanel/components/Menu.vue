<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

interface MenuItem {
  label: string;
  path: string;
}

const items: MenuItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Tasks', path: '/tasks' },
  { label: 'Notes', path: '/notes' },
  { label: 'Chat', path: '/chat' },
  { label: 'Help', path: '/help' }
];

const navigate = (path: string) => {
  router.push(path);
};
</script>

<template>
  <nav class="bar">
    <ul>
      <li
        v-for="item in items"
        :key="item.path"
        :class="{ active: route.path === item.path }"
        @click="navigate(item.path)"
      >
        {{ item.label }}
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  padding: 12px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

ul {
  display: flex;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

li:hover {
  background: #f0f0f0;
}

li.active {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}
</style>