
## The folder layout should be like the following

```
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ manifest.json # Chrome MV3 manifest
├─ index.html # (optional root; Vite needs one; not used by extension)
├─ public/
│ └─ icons/ (16/32/48/128)
├─ sidepanel/ # Vite page entry for side panel
│ └─ index.html
└─ src/
├─ background/
│ └─ index.ts # Service worker
├─ content/
│ └─ index.ts # (placeholder) content-script entry
├─ sidepanel/
│ ├─ main.ts # Mounts Vue
│ ├─ App.vue # Side panel shell
│ └─ components/
│ ├─ Menu.vue
│ ├─ CurrentPageInfo.vue
│ ├─ CurrentTaskList.vue
│ ├─ TaskItem.vue
│ ├─ ChatBox.vue
│ └─ FooterBar.vue
└─ shared/
├─ stores/
│ └─ usePanelStore.ts
├─ types.ts
└─ utils.ts
```