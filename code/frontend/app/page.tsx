"use client"

import { useState, useEffect } from "react"
import { Menu, Video, Gauge, Settings, Wifi as WiFi, X, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import RobotControlPage from "./robot-control/page"
import TelemetryPage from "./telemetry/page"
import SettingsPage from "./settings/page"
import AIPage from "./ai/page"
import { IpAddressDialog } from "@/components/ip-address-dialog"
import { Preloader } from "@/components/preloader"
import { getStoredIpAddress } from "@/lib/ip-storage"

export default function VogayerBotDashboard() {
  const [activeSection, setActiveSection] = useState("control")
  const [menuOpen, setMenuOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("connected")
  const [showIpDialog, setShowIpDialog] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    // Check if IP address is stored on mount
    const storedIp = getStoredIpAddress()
    if (!storedIp) {
      setShowIpDialog(true)
    }
  }, [])

  const handleIpConnect = (ip: string) => {
    setShowIpDialog(false)
    // The socket will automatically reconnect with the new IP via useEffect
    // No reload needed - the socket provider will detect the IP change
  }

  const navItems = [
    { id: "control", icon: Video, label: "CONTROL" },
    { id: "ai", icon: Bot, label: "AI" },
    { id: "telemetry", icon: Gauge, label: "TELEMETRY" },
    { id: "settings", icon: Settings, label: "SETTINGS" },
  ]

  if (!mounted) {
    return null
  }

  return (
    <>
      {isLoading && <Preloader onComplete={() => setIsLoading(false)} />}
      <div className={`flex flex-col h-screen bg-gradient-to-br from-black via-neutral-950 to-black safe-area-inset overflow-hidden transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`} style={{ height: '100dvh', minHeight: '-webkit-fill-available', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <IpAddressDialog open={showIpDialog} onConnect={handleIpConnect} />
        <header className="bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-700/50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex-1 min-w-0">
          <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 font-bold text-sm sm:text-base tracking-wider truncate">
            VOGAYER
          </h1>
          <p className="text-neutral-500 text-[10px] sm:text-xs font-mono">v1.0</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded text-[10px] sm:text-xs touch-manipulation ${
              connectionStatus === "connected" ? "text-green-500" : "text-red-500"
            }`}
          >
            <WiFi className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="hidden min-[360px]:inline capitalize">{connectionStatus}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-neutral-400 hover:text-orange-500 -mr-1 sm:-mr-2 h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div className="bg-neutral-800/95 backdrop-blur-sm border-b border-neutral-700/50 p-3 sm:p-4 space-y-2 sm:space-y-3 z-50 relative animate-in slide-in-from-top duration-200">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  setMenuOpen(false)
                }}
                className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-lg transition-all duration-200 text-sm font-medium touch-manipulation min-h-[44px] ${
                  activeSection === item.id
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 scale-[1.02]"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-700/50 active:bg-neutral-700 active:scale-[0.98]"
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform ${activeSection === item.id ? 'scale-110' : ''}`} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMenuOpen(false)} />
        </>
      )}

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 safe-area-inset-x overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {activeSection === "control" && <RobotControlPage />}
        {activeSection === "ai" && <AIPage />}
        {activeSection === "telemetry" && <TelemetryPage />}
        {activeSection === "settings" && <SettingsPage />}
      </main>

      <nav className="fixed left-0 right-0 bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-700/50 flex md:hidden z-30 shadow-2xl" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 sm:py-3 transition-all duration-200 touch-manipulation min-h-[60px] relative ${
              activeSection === item.id 
                ? "text-orange-500 bg-neutral-800/50" 
                : "text-neutral-500 active:text-neutral-300 active:bg-neutral-800/30"
            }`}
          >
            {activeSection === item.id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent rounded-full" />
            )}
            <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition-transform ${activeSection === item.id ? 'scale-110' : ''}`} />
            <span className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="hidden md:flex md:fixed md:left-0 md:top-0 md:w-64 md:h-screen md:flex-col md:bg-neutral-900/95 md:backdrop-blur-sm md:border-r md:border-neutral-700/50 md:shadow-2xl">
        <div className="p-6">
          <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 font-bold text-lg tracking-wider mb-8">
            VOGAYER BOT
          </h1>
          <p className="text-neutral-500 text-xs mb-8 font-mono">v1.0 INTERFACE</p>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                  activeSection === item.id
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 scale-[1.02]"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/50 active:scale-[0.98]"
                }`}
              >
                <item.icon className={`w-5 h-5 transition-transform ${activeSection === item.id ? 'scale-110' : ''}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 p-4 bg-neutral-800 border border-neutral-700 rounded">
            <div className="flex items-center gap-2 mb-2">
              <WiFi className={`w-4 h-4 ${connectionStatus === "connected" ? "text-green-500" : "text-red-500"}`} />
              <span className="text-xs text-white uppercase">{connectionStatus}</span>
            </div>
            <div className="text-xs text-neutral-500 space-y-1">
              <div>BATTERY: 87%</div>
              <div>SIGNAL: -45dB</div>
              <div>LATENCY: 23ms</div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block md:ml-64" />
      </div>
    </>
  )
}
