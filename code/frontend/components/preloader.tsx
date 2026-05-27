"use client"

import { useState, useEffect } from "react"
import { Bot } from "lucide-react"

interface PreloaderProps {
  onComplete?: () => void
  minDisplayTime?: number
}

export function Preloader({ onComplete, minDisplayTime = 1500 }: PreloaderProps) {
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        // Accelerate then slow down for smooth effect
        const increment = prev < 50 ? 3 + Math.random() * 2 : 1 + Math.random() * 0.5
        return Math.min(prev + increment, 100)
      })
    }, 30)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(() => {
        setIsComplete(true)
        setTimeout(() => {
          onComplete?.()
        }, 300)
      }, minDisplayTime)

      return () => clearTimeout(timer)
    }
  }, [progress, minDisplayTime, onComplete])

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-gradient-to-br from-black via-neutral-900 to-black flex items-center justify-center transition-opacity duration-300 ${
        isComplete ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex flex-col items-center gap-6 sm:gap-8">
        {/* Logo Animation */}
        <div className="relative">
          <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-6 sm:p-8 rounded-2xl shadow-2xl transform transition-all duration-500 hover:scale-105">
            <Bot className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 animate-pulse">
            VOGAYER BOT
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 font-mono">INITIALIZING SYSTEMS...</p>
        </div>

        {/* Progress Bar */}
        <div className="w-64 sm:w-80 max-w-[90vw] space-y-2">
          <div className="h-1.5 sm:h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 rounded-full transition-all duration-300 ease-out shadow-lg shadow-orange-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs text-neutral-500 font-mono">{Math.round(progress)}%</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-orange-500 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Loading Dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-orange-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}





