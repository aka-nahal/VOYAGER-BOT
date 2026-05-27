"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRobotSocket } from "@/lib/robot-socket"

export default function TelemetryPage() {
  const { telemetry, motorStatus, connected } = useRobotSocket()

  const metrics = [
    {
      label: "CPU",
      value: telemetry ? `${telemetry.cpu_usage.toFixed(1)}%` : "0%",
      color: telemetry && telemetry.cpu_usage > 80 ? "text-red-500" : "text-green-500",
    },
    {
      label: "RAM",
      value: telemetry ? `${telemetry.ram_usage_mb.toFixed(0)}MB` : "0MB",
      color: "text-blue-500",
    },
    {
      label: "CONNECTION",
      value: connected ? "ONLINE" : "OFFLINE",
      color: connected ? "text-green-500" : "text-red-500",
    },
    {
      label: "FPS",
      value: telemetry ? telemetry.fps_processing.toFixed(0) : "0",
      color: "text-orange-500",
    },
  ]

  const sensors = [
    {
      name: "TEMP",
      value: telemetry ? `${telemetry.cpu_temp.toFixed(1)}°C` : "0°C",
      status: telemetry && telemetry.cpu_temp > 70 ? "warning" : "normal",
    },
    {
      name: "RAM TOTAL",
      value: telemetry ? `${telemetry.ram_total_mb.toFixed(0)}MB` : "0MB",
      status: "normal",
    },
    {
      name: "RAM %",
      value: telemetry ? `${telemetry.ram_percent.toFixed(1)}%` : "0%",
      status: telemetry && telemetry.ram_percent > 80 ? "warning" : "normal",
    },
    {
      name: "STREAM FPS",
      value: telemetry ? telemetry.fps_streaming.toFixed(1) : "0",
      status: telemetry && telemetry.fps_streaming > 10 ? "normal" : "warning",
    },
    {
      name: "MOTOR L",
      value: motorStatus ? `${motorStatus.left_speed}%` : "0%",
      status: motorStatus?.enabled ? "normal" : "warning",
    },
    {
      name: "MOTOR R",
      value: motorStatus ? `${motorStatus.right_speed}%` : "0%",
      status: motorStatus?.enabled ? "normal" : "warning",
    },
  ]

  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 md:ml-64">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-6">
        {metrics.map((metric, i) => (
          <Card key={i} className="bg-neutral-900 border-neutral-700">
            <CardHeader className="pb-2 border-b border-neutral-700 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-neutral-400 tracking-wider uppercase truncate">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-2 sm:px-3 md:px-4 py-2 sm:py-3 md:py-4">
              <div className={`text-base sm:text-lg md:text-2xl font-bold font-mono ${metric.color} break-words`}>{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {[
          { title: "CPU HISTORY", color: "#3b82f6" },
          { title: "MEMORY HISTORY", color: "#f59e0b" },
        ].map((chart, i) => (
          <Card key={i} className="bg-neutral-900 border-neutral-700">
            <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
                {chart.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4">
              <div className="h-28 sm:h-32 md:h-48 relative">
                <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-20">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div key={i} className="border border-neutral-700"></div>
                  ))}
                </div>
                <svg className="absolute inset-0 w-full h-full">
                  <polyline
                    points="0,100 50,85 100,95 150,80 200,75 250,90 300,80 350,100"
                    fill="none"
                    stroke={chart.color}
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sensor Data */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
          <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">SENSORS</CardTitle>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {sensors.map((sensor, i) => (
              <div key={i} className="bg-neutral-800 border border-neutral-700 p-2 sm:p-3 rounded">
                <div className="text-[10px] sm:text-xs text-neutral-500 uppercase mb-1.5 sm:mb-2 truncate">{sensor.name}</div>
                <div className="text-xs sm:text-sm md:text-base font-mono text-white mb-1.5 sm:mb-2 break-words">{sensor.value}</div>
                <div className={`text-[10px] sm:text-xs ${sensor.status === "normal" ? "text-green-500" : "text-yellow-500"}`}>
                  {sensor.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
