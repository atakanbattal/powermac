'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'powermac-sidebar-collapsed'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setCollapsedState(stored === 'true')
    } catch {
      // ignore
    }
  }, [])

  const toggle = useCallback(() => {
    setCollapsedState(prev => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
