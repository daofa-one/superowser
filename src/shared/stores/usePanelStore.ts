import { defineStore } from 'pinia';
import type { PageMeta, TaskItem } from '../types';


export const usePanelStore = defineStore('panel', {
    state: () => ({
        menuIndex: 0 as number,
        currentPage: {
            title: 'Untitled',
            url: '',
            faviconUrl: '',
            tags: [],
            notes: ''
        } as PageMeta,
        tasks: [] as TaskItem[],
        taskListOpen: true as boolean
    }),
    actions: {
        toggleTaskList() {
            this.taskListOpen = !this.taskListOpen;
        },
        setCurrentPage(meta: PageMeta) {
            this.currentPage = meta;
        },
        addTask(item: TaskItem) {
            this.tasks.unshift(item);
        }
    }
});