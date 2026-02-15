export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    </div>
  )
}
