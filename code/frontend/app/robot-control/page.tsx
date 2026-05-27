"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import CameraFeed from "@/components/camera-feed"
import ControlPad from "@/components/control-pad"
import EmergencyStop from "@/components/emergency-stop"
import ConnectionDebug from "@/components/connection-debug"
import CustomColorUpload from "@/components/custom-color-upload"
import { useRobotSocket } from "@/lib/robot-socket"

export default function RobotControlPage() {
  const { changeMode, sendAutoCommand, motorStatus, telemetry, connected, availableColors, currentColor, changeColor } = useRobotSocket()
  const [mode, setMode] = useState<"manual" | "autonomous" | "patrol">("manual")

  const handleModeChange = (newMode: "manual" | "autonomous" | "patrol") => {
    setMode(newMode)
    if (newMode === "manual") {
      changeMode("manual")
    } else if (newMode === "autonomous") {
      changeMode("auto")
      sendAutoCommand("start_following")
    }
  }

  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 md:ml-64">
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {/* Main Camera Feed */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-xl card-hover">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider truncate">
                CAMERA FEED
              </CardTitle>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] sm:text-xs text-red-500">REC</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <CameraFeed />
          </CardContent>
        </Card>

        {/* Mode Selector */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-lg card-hover">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">MODE</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 px-3 sm:px-4 py-3 sm:py-4 space-y-2">
            {(["manual", "autonomous", "patrol"] as const).map((m) => (
              <Button
                key={m}
                onClick={() => handleModeChange(m)}
                disabled={!connected}
                className={`w-full text-xs sm:text-sm py-2.5 sm:py-2 h-auto min-h-[44px] touch-manipulation transition-all duration-200 ${
                  mode === m
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:from-orange-700 active:to-orange-800 shadow-lg shadow-orange-500/30 scale-[1.01]"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 active:bg-neutral-600 active:scale-[0.98]"
                }`}
              >
                {m.toUpperCase()}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Color Selector */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-lg card-hover">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">TRACKING COLOR</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 px-3 sm:px-4 py-3 sm:py-4">
            {availableColors.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableColors.map((color) => (
                  <Button
                    key={color.key}
                    onClick={() => changeColor(color.key)}
                    disabled={!connected}
                    className={`text-[10px] sm:text-xs py-2.5 sm:py-2 h-auto min-h-[44px] touch-manipulation transition-all duration-200 ${
                      currentColor === color.key
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:from-orange-700 active:to-orange-800 border-2 border-orange-400 shadow-lg shadow-orange-500/30 scale-[1.05]"
                        : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 active:bg-neutral-600 active:scale-[0.95] border-2 border-transparent"
                    }`}
                  >
                    <span className="mr-0.5 sm:mr-1 text-xs sm:text-sm">{color.emoji}</span>
                    <span className="truncate">{color.name}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 text-center py-2">
                {connected ? "Loading colors..." : "Not connected"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Color Upload */}
        <CustomColorUpload
          connected={connected}
          onColorExtracted={() => {
            // Optionally switch to autonomous mode after color extraction
            console.log("Custom color extracted and set")
          }}
        />

        {/* Emergency Stop */}
        <EmergencyStop />

        {/* System Status */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-lg card-hover">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">STATUS</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 px-3 sm:px-4 py-3 sm:py-4 space-y-2 text-[11px] sm:text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-neutral-500 flex-shrink-0">MODE:</span>
              <span className="text-white font-mono uppercase text-right truncate">{mode}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-neutral-500 flex-shrink-0">CONNECTION:</span>
              <span className={`${connected ? "text-green-500" : "text-red-500"} font-mono text-right`}>
                {connected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-neutral-500 flex-shrink-0">MOTORS:</span>
              <span className={`${motorStatus?.enabled ? "text-green-500" : "text-neutral-500"} font-mono text-right`}>
                {motorStatus?.enabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            {motorStatus && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-neutral-500 flex-shrink-0">SPEED:</span>
                <span className="text-white font-mono text-right text-[10px] sm:text-xs">
                  L:{motorStatus.left_speed} R:{motorStatus.right_speed}
                </span>
              </div>
            )}
            {telemetry && (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-neutral-500 flex-shrink-0">CPU:</span>
                  <span className="text-white font-mono text-right">{telemetry.cpu_usage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-neutral-500 flex-shrink-0">RAM:</span>
                  <span className="text-white font-mono text-right text-[10px] sm:text-xs">
                    {telemetry.ram_usage_mb.toFixed(0)}MB / {telemetry.ram_total_mb.toFixed(0)}MB ({telemetry.ram_percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-neutral-500 flex-shrink-0">TEMP:</span>
                  <span className="text-white font-mono text-right">{telemetry.cpu_temp.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-neutral-500 flex-shrink-0">PROC FPS:</span>
                  <span className="text-white font-mono text-right">{telemetry.fps_processing.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-neutral-500 flex-shrink-0">STREAM FPS:</span>
                  <span className="text-white font-mono text-right">{telemetry.fps_streaming.toFixed(1)}</span>
                </div>
                {telemetry.thermal_warning && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-500 flex-shrink-0">THERMAL:</span>
                    <span className="text-red-500 font-mono text-right">WARNING</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Control Pad */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-lg card-hover">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
              MOVEMENT CONTROL
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4">
            <ControlPad />
          </CardContent>
        </Card>
      </div>
      <ConnectionDebug />
    </div>
  )
}
