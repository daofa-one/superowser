import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Tasks from '../views/Tasks.vue'
import Notes from '../views/Notes.vue'
import Chat from '../views/Chat.vue'
import Help from '../views/Help.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: Tasks
  },
  {
    path: '/notes',
    name: 'Notes',
    component: Notes
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Chat
  },
  {
    path: '/help',
    name: 'Help',
    component: Help
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router