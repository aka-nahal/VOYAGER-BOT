"use client"

import { useState, useEffect } from "react"
import { useRobotSocket } from "@/lib/robot-socket"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function ConnectionDebug() {
  const { socket, connected, socketUrl, telemetry, motorStatus, trackingData } = useRobotSocket()
  const [minimized, setMinimized] = useState(true)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Slide in animation after mount
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return null // Hide in production
  }

  return (
    <div
      className={`fixed top-1/2 -translate-y-1/2 z-50 transition-transform duration-300 ease-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ right: 0 }}
    >
      <div className="flex items-center gap-0 h-full">
        {/* Content that slides out */}
        <div
          className={`bg-neutral-900 border-l border-t border-b border-neutral-700 rounded-l-lg overflow-hidden transition-all duration-300 ease-out ${
            minimized ? 'w-0 opacity-0' : 'w-64 opacity-100'
          }`}
        >
          <CardContent className="text-xs space-y-1 font-mono p-3">
            <div>
              <span className="text-neutral-500">URL: </span>
              <span className="text-white">{socketUrl}</span>
            </div>
            <div>
              <span className="text-neutral-500">Socket ID: </span>
              <span className="text-white">{socket?.id?.substring(0, 12) || 'N/A'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Connected: </span>
              <span className={connected ? 'text-green-500' : 'text-red-500'}>
                {connected ? 'YES' : 'NO'}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Telemetry: </span>
              <span className={telemetry ? 'text-green-500' : 'text-red-500'}>
                {telemetry ? 'RECEIVING' : 'NONE'}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Motor Status: </span>
              <span className={motorStatus ? 'text-green-500' : 'text-red-500'}>
                {motorStatus ? 'RECEIVING' : 'NONE'}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Tracking: </span>
              <span className={trackingData ? 'text-green-500' : 'text-red-500'}>
                {trackingData ? 'RECEIVING' : 'NONE'}
              </span>
            </div>
          </CardContent>
        </div>

        {/* Vertical button */}
        <Card 
          className="bg-neutral-900 border border-neutral-700 rounded-l-lg cursor-pointer hover:bg-neutral-800 transition-colors shadow-lg"
          onClick={() => setMinimized(!minimized)}
        >
          <CardHeader className="px-2 py-4">
            <div className="flex flex-col items-center gap-2 min-h-[120px] justify-center">
              <CardTitle 
                className="text-xs font-mono"
                style={{ 
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright'
                }}
              >
                DEBUG INFO
              </CardTitle>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMinimized(!minimized)
                }}
                className="text-neutral-400 hover:text-white transition-colors mt-2"
              >
                {minimized ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}

