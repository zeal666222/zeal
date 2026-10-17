export default function HoroscopeLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/30 animate-spin" style={{ animationDuration: "3s" }} />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">♈</div>
        </div>
        <p className="text-sm font-bold text-muted-foreground animate-pulse">Aligning the stars...</p>
      </div>
    </div>
  );
}
