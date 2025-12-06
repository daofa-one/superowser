<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

interface MenuItem {
  label: string
  path: string
}

const items: MenuItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Tasks', path: '/tasks' },
  { label: 'Notes', path: '/notes' },
  { label: 'Chat', path: '/chat' },
  { label: 'Help', path: '/help' }
]

const isMenuOpen = ref(false)

const navigate = (path: string) => {
  router.push(path)
  isMenuOpen.value = false // Close menu after navigation on mobile
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}
</script>

<template>
  <nav class="bar">
    <!-- Hamburger Button (visible on narrow screens) -->
    <button class="hamburger" @click="toggleMenu" :class="{ open: isMenuOpen }">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <!-- Menu Items -->
    <ul :class="{ open: isMenuOpen }">
      <li
        v-for="item in items"
        :key="item.path"
        :class="{ active: route.path === item.path }"
        @click="navigate(item.path)"
      >
        <span class="label">{{ item.label }}</span>
      </li>
    </ul>

    <!-- Overlay for mobile menu -->
    <div v-if="isMenuOpen" class="overlay" @click="toggleMenu"></div>
  </nav>
</template>

<style scoped>
.bar {
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  container-type: inline-size; /* enable container queries for responsive behavior */
}

/* Hamburger Button */
.hamburger {
  display: none; /* Hidden by default, shown on narrow screens */
  flex-direction: column;
  justify-content: space-around;
  width: 28px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  transition: all 0.3s ease;
}

.hamburger span {
  width: 100%;
  height: 3px;
  background: #333;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.hamburger.open span:nth-child(1) {
  transform: rotate(45deg) translate(6px, 6px);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: rotate(-45deg) translate(6px, -6px);
}

/* Menu List */
ul {
  display: flex;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
}

li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  white-space: nowrap;
}

li .label {
  line-height: 1;
}

li:hover {
  background: #f0f0f0;
}

li.active {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}

/* Overlay for mobile menu */
.overlay {
  display: none;
}

/* Responsive Design - Container Query Approach */
/* When panel width is narrow (≤420px) */
@container (max-width: 420px) {
  .hamburger {
    display: flex;
  }

  ul {
    position: fixed;
    top: 57px; /* Below the menu bar */
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 0;
    background: white;
    border-bottom: 1px solid #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, opacity 0.3s ease;
    opacity: 0;
    z-index: 1000;
  }

  ul.open {
    max-height: 300px;
    opacity: 1;
  }

  li {
    padding: 14px 16px;
    border-radius: 0;
    border-bottom: 1px solid #f0f0f0;
  }


  li:last-child {
    border-bottom: none;
  }

  .overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
  }
}

/* Fallback for browsers without container query support */
/* Use viewport-based media query instead */
@supports not (container-type: inline-size) {
  @media (max-width: 420px) {
    .hamburger {
      display: flex;
    }

    ul {
      position: fixed;
      top: 57px;
      left: 0;
      right: 0;
      flex-direction: column;
      gap: 0;
      background: white;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease, opacity 0.3s ease;
      opacity: 0;
      z-index: 1000;
    }

    ul.open {
      max-height: 300px;
      opacity: 1;
    }

    li {
      padding: 14px 16px;
      border-radius: 0;
      border-bottom: 1px solid #f0f0f0;
    }


    li:last-child {
      border-bottom: none;
    }

    .overlay {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999;
    }
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .bar {
    background: #1e1e1e;
    border-bottom-color: #333;
  }

  .hamburger span {
    background: #fff;
  }

  ul {
    background: #1e1e1e;
    border-bottom-color: #333;
  }

  li {
    color: #e0e0e0;
  }

  li:hover {
    background: #2a2a2a;
  }

  li.active {
    background: #1e3a5f;
    color: #64b5f6;
  }

  li {
    border-bottom-color: #333;
  }
}
</style>
