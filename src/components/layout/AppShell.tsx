// src/components/layout/AppShell.tsx
import { type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { Toast } from './Toast';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 pb-24 max-w-md w-full mx-auto px-4 py-4 scroll-area">
        {children}
      </main>
      <BottomNav />
      <Toast />
    </div>
  );
}
