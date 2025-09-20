// src/shared/types.ts
export type PageMeta = {
    title: string;
    url: string;
    faviconUrl?: string;
    tags: string[];
    notes?: string;
};
    
    
export type TaskItem = {
    id: string;
    title: string;
    url: string;
    tags: string[];
    notes?: string;
    createdAt: number;
};