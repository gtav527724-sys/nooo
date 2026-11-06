import { create } from "zustand";

interface ToastItem {
  id: number;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string) => void;
  remove: (id: number) => void;
}

let nextId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message) => {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message }] }));
    timers.set(id, setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
      timers.delete(id);
    }, 2600));
  },
  remove: (id) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
  },
}));

export function toast(message: string): void {
  useToasts.getState().push(message);
}
