<template>
  <div class="tasks">
    <div class="tasks-header">
      <h2>Tasks</h2>
      <button @click="createNewTask" class="btn-primary">New Task</button>
    </div>

    <div class="tasks-list">
      <div v-if="tasks.length === 0" class="empty-state">
        No tasks yet. Create your first task to get started!
      </div>

      <div v-for="task in tasks" :key="task.id" class="task-card">
        <div class="task-header">
          <span class="task-name">{{ task.name }}</span>
          <span class="task-count">{{ task.pages?.length || 0 }} pages</span>
        </div>
        <div class="task-actions">
          <button @click="openTask(task)">Open</button>
          <button @click="editTask(task)">Edit</button>
          <button @click="deleteTask(task)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Task {
  id: string
  name: string
  pages?: Array<any>
  createdAt: Date
}

const tasks = ref<Task[]>([])

onMounted(async () => {
  // TODO: Load tasks from background storage
  // For now, using sample data
  tasks.value = []
})

const createNewTask = () => {
  // TODO: Implement task creation
  console.log('Create new task')
}

const openTask = (task: Task) => {
  // TODO: Implement task opening
  console.log('Open task:', task)
}

const editTask = (task: Task) => {
  // TODO: Implement task editing
  console.log('Edit task:', task)
}

const deleteTask = (task: Task) => {
  // TODO: Implement task deletion
  console.log('Delete task:', task)
}
</script>

<style scoped>
.tasks {
  padding: 16px;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.tasks-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.btn-primary {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary:hover {
  background: #45a049;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  color: #666;
  padding: 40px 20px;
  font-size: 14px;
}

.task-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: white;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-name {
  font-weight: 500;
  font-size: 16px;
}

.task-count {
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 12px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-actions button {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.task-actions button:hover {
  background: #f5f5f5;
}
</style>