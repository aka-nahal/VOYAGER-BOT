"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useRobotSocket } from "@/lib/robot-socket"

export default function EmergencyStop() {
  const { emergencyStop } = useRobotSocket()
  const [isStopped, setIsStopped] = useState(false)

  const handleClick = () => {
    const newState = !isStopped
    setIsStopped(newState)
    if (newState) {
      // Stop robot motors and navigation
      emergencyStop()
      
      // Stop AI assistant systems (helicopter mode, audio, commands, listening)
      if ((globalThis as any).__aiEmergencyStopAll) {
        (globalThis as any).__aiEmergencyStopAll()
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full py-4 sm:py-6 rounded-lg font-bold text-sm sm:text-lg tracking-wider transition-all border-2 flex items-center justify-center gap-2 sm:gap-3 touch-manipulation min-h-[60px] sm:min-h-[72px] ${
        isStopped
          ? "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-red-500"
          : "bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-red-500 border-red-500/50"
      }`}
    >
      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
      <span className="whitespace-nowrap">{isStopped ? "SYSTEM STOPPED" : "EMERGENCY STOP"}</span>
    </button>
  )
}
