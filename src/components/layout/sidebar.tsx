'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import {
  LayoutDashboard, Factory, Package, PackageCheck, FileText, ShieldCheck,
  ClipboardList, Truck, Search, AlertTriangle, Settings, LogOut, Cog,
  PanelLeftClose, PanelLeft, Receipt
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useSidebar } from '@/contexts/sidebar-context'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Profile } from '@/lib/types'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Factory, Package, PackageCheck, FileText, ShieldCheck,
  ClipboardList, Truck, Search, AlertTriangle, Settings, Receipt,
}

interface SidebarProps {
  profile?: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { collapsed, toggle } = useSidebar()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/giris')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 h-screen transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo + Toggle */}
        <div className={cn(
          'border-b border-slate-100 dark:border-slate-800 shrink-0',
          collapsed ? 'flex flex-col items-center gap-2 py-3 px-2' : 'h-16 flex items-center justify-between px-4'
        )}>
          {!collapsed ? (
            <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold text-xl tracking-tight min-w-0">
              <Cog className="w-6 h-6 shrink-0" />
              <span className="truncate">PowerMac</span>
            </Link>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" className="flex items-center justify-center text-blue-600 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Cog className="w-6 h-6" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">PowerMac</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className="flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 shrink-0"
                aria-label={collapsed ? 'Sidebar aç' : 'Sidebar kapat'}
              >
                {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Sidebar aç' : 'Sidebar kapat'}</TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            const linkContent = (
              <Link
                href={item.href}
                prefetch={true}
                className={cn(
                  'flex items-center gap-3 rounded-lg font-medium text-sm transition-colors',
                  collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.href}>{linkContent}</div>
          })}
        </nav>

        {/* User Profile */}
        <div className={cn(
          'p-3 border-t border-slate-100 dark:border-slate-800 shrink-0',
          collapsed ? 'flex flex-col items-center gap-2' : ''
        )}>
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{profile?.full_name || 'Kullanıcı'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'viewer'}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Çıkış Yap</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {profile?.full_name || 'Kullanıcı'}
                </p>
                <p className="text-xs text-slate-500 truncate capitalize">
                  {profile?.role || 'viewer'}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Çıkış Yap</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
