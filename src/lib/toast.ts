"use client";

import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, ms?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, ms = 2200) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.filter((t) => t.message !== message), { id, message }].slice(-3) });
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function toast(message: string, ms?: number): void {
  if (typeof window === "undefined") return;
  useToasts.getState().push(message, ms);
}
