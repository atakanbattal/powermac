'use client'

import { SidebarProvider } from '@/contexts/sidebar-context'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { Profile } from '@/lib/types'

interface DashboardShellProps {
  profile: Profile | null
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar profile={profile} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
