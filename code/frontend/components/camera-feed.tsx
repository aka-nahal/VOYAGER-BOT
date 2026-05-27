"use client"

import { useState, useEffect } from "react"
import { useRobotSocket } from "@/lib/robot-socket"

export default function CameraFeed() {
  const { currentFrame, trackingData, fps, connected, socket } = useRobotSocket()
  const [isLoading, setIsLoading] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<string>('')

  useEffect(() => {
    if (socket) {
      const interval = setInterval(() => {
        setConnectionInfo(
          socket.connected
            ? `Connected (ID: ${socket.id?.substring(0, 8)})`
            : 'Disconnected'
        )
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [socket])

  return (
    <div className="relative w-full bg-black rounded-b-lg overflow-hidden">
      {/* Video Feed */}
      <div className="relative w-full aspect-video bg-gradient-to-b from-neutral-800 to-black flex items-center justify-center overflow-hidden">
        {currentFrame ? (
          <img src={currentFrame} alt="Robot camera feed" className="w-full h-full object-contain" />
        ) : (
          <img src="/robot-camera-feed-with-detection-overlay.jpg" alt="Robot camera feed" className="w-full h-full object-cover opacity-50" />
        )}

        {/* Detection Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Grid overlay */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-orange-500/50"></div>
            ))}
          </div>

          {/* Detection boxes */}
          {trackingData?.marker_detected && trackingData.position && (
            <div
              className="absolute border-2 border-orange-500 rounded"
              style={{
                left: `${(trackingData.position.x / 640) * 100}%`,
                top: `${(trackingData.position.y / 480) * 100}%`,
                width: '10%',
                height: '10%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute -top-6 left-0 bg-orange-500 text-white text-xs px-2 py-1 font-mono whitespace-nowrap">
                MARKER {trackingData.distance_cm ? `${Math.round(trackingData.distance_cm)}cm` : ''}
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className={`absolute top-2 left-2 sm:top-4 sm:left-4 px-2 py-1.5 sm:px-3 sm:py-2 rounded text-[10px] sm:text-xs font-mono ${
            connected ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
          }`}>
            <div className="whitespace-nowrap">{connected ? 'CONNECTED' : 'DISCONNECTED'}</div>
            {connectionInfo && (
              <div className="text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 opacity-75 truncate max-w-[120px] sm:max-w-none">{connectionInfo}</div>
            )}
          </div>

          {/* FPS Counter */}
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-neutral-900/90 border border-neutral-700 px-2 py-1.5 sm:px-3 sm:py-2 rounded text-[10px] sm:text-xs text-green-500 font-mono">
            FPS: {fps || 0}
          </div>

          {/* Tracking Info */}
          {trackingData && (
            <div className="absolute bottom-12 sm:bottom-16 left-2 sm:left-4 bg-neutral-900/90 border border-neutral-700 px-2 py-1.5 sm:px-3 sm:py-2 rounded text-[10px] sm:text-xs space-y-0.5 sm:space-y-1 max-w-[calc(100%-1rem)] sm:max-w-none">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${trackingData.marker_detected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-neutral-400">MARKER:</span>
                <span className={`${trackingData.marker_detected ? 'text-green-500' : 'text-red-500'} font-mono truncate`}>
                  {trackingData.marker_detected ? 'DETECTED' : 'NOT FOUND'}
                </span>
              </div>
              {trackingData.distance_cm && (
                <div className="text-neutral-400">
                  DIST: <span className="text-white font-mono">{Math.round(trackingData.distance_cm)}cm</span>
                </div>
              )}
              {trackingData.confidence !== undefined && (
                <div className="text-neutral-400">
                  CONF: <span className="text-white font-mono">{(trackingData.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/90 border-t border-neutral-700 px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between text-[9px] sm:text-xs gap-1 sm:gap-2">
            <div className="flex-shrink-0">
              <span className="text-neutral-500 hidden sm:inline">RES:</span>
              <span className="text-white font-mono ml-0 sm:ml-2">640x480</span>
            </div>
            <div className="flex-shrink-0 hidden sm:block">
              <span className="text-neutral-500">STREAM:</span>
              <span className="text-white font-mono ml-2">480x320</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`${connected ? 'text-green-500' : 'text-red-500'} whitespace-nowrap`}>
                {connected ? 'STREAMING' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
