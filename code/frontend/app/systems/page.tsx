"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRobotSocket } from "@/lib/robot-socket"
import {
  Server,
  Database,
  Shield,
  Wifi,
  HardDrive,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle,
  Settings,
  Camera,
  Zap,
} from "lucide-react"

export default function SystemsPage() {
  const { telemetry, motorStatus, connected, trackingData } = useRobotSocket()
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const systems = [
    {
      id: "SYS-001",
      name: "RASPBERRY PI 5",
      type: "Main Controller",
      status: connected ? "online" : "offline",
      health: telemetry
        ? Math.max(
            0,
            Math.min(
              100,
              100 - (telemetry.cpu_usage * 0.3) - (telemetry.ram_percent * 0.2) - (telemetry.thermal_warning ? 10 : 0)
            )
          )
        : 0,
      cpu: telemetry?.cpu_usage || 0,
      memory: telemetry?.ram_percent || 0,
      temp: telemetry?.cpu_temp || 0,
      uptime: telemetry ? formatUptime(telemetry.uptime_seconds) : "0d 0h 0m",
      fps: telemetry?.fps_processing || 0,
      location: "Robot Platform",
    },
    {
      id: "SYS-002",
      name: "CAMERA SYSTEM",
      type: "Video Capture",
      status: connected && telemetry ? "online" : "offline",
      health: connected && telemetry?.fps_streaming ? Math.min(100, (telemetry.fps_streaming / 15) * 100) : 0,
      cpu: 0,
      memory: 0,
      temp: telemetry?.cpu_temp || 0,
      fps: telemetry?.fps_streaming || 0,
      location: "RPi Camera 3",
    },
    {
      id: "SYS-003",
      name: "MOTOR CONTROL",
      type: "Hardware",
      status: motorStatus?.enabled ? "online" : "offline",
      health: motorStatus?.enabled ? 95 : 0,
      cpu: 0,
      memory: 0,
      leftSpeed: motorStatus?.left_speed || 0,
      rightSpeed: motorStatus?.right_speed || 0,
      mode: motorStatus?.mode || "unknown",
      location: "L298N Driver",
    },
    {
      id: "SYS-004",
      name: "TRACKING SYSTEM",
      type: "Computer Vision",
      status: trackingData?.marker_detected ? "tracking" : connected ? "searching" : "offline",
      health: trackingData?.marker_detected ? 90 : connected ? 50 : 0,
      cpu: 0,
      memory: 0,
      distance: trackingData?.distance_cm || 0,
      confidence: trackingData?.confidence ? Math.round(trackingData.confidence * 100) : 0,
      location: "Vision Pipeline",
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "tracking":
        return "bg-white/20 text-white"
      case "warning":
      case "searching":
        return "bg-orange-500/20 text-orange-500"
      case "maintenance":
        return "bg-neutral-500/20 text-neutral-300"
      case "offline":
        return "bg-red-500/20 text-red-500"
      default:
        return "bg-neutral-500/20 text-neutral-300"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
      case "tracking":
        return <CheckCircle className="w-4 h-4" />
      case "warning":
      case "searching":
        return <AlertTriangle className="w-4 h-4" />
      case "maintenance":
        return <Settings className="w-4 h-4" />
      case "offline":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getSystemIcon = (type: string) => {
    switch (type) {
      case "Main Controller":
        return <Cpu className="w-6 h-6" />
      case "Video Capture":
        return <Camera className="w-6 h-6" />
      case "Hardware":
        return <Zap className="w-6 h-6" />
      case "Computer Vision":
        return <Activity className="w-6 h-6" />
      default:
        return <Server className="w-6 h-6" />
    }
  }

  const getHealthColor = (health) => {
    if (health >= 95) return "text-white"
    if (health >= 85) return "text-white"
    if (health >= 70) return "text-orange-500"
    return "text-red-500"
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">SYSTEMS MONITOR</h1>
          <p className="text-sm text-neutral-400">Infrastructure health and performance monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">System Scan</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">Maintenance Mode</Button>
        </div>
      </div>

      {/* System Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">CONNECTION</p>
                <p className={`text-2xl font-bold font-mono ${connected ? "text-green-500" : "text-red-500"}`}>
                  {connected ? "ONLINE" : "OFFLINE"}
                </p>
              </div>
              {connected ? <CheckCircle className="w-8 h-8 text-green-500" /> : <AlertTriangle className="w-8 h-8 text-red-500" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">CPU TEMP</p>
                <p className={`text-2xl font-bold font-mono ${telemetry && telemetry.cpu_temp > 70 ? "text-red-500" : "text-white"}`}>
                  {telemetry ? `${telemetry.cpu_temp.toFixed(1)}°C` : "N/A"}
                </p>
              </div>
              <Cpu className="w-8 h-8 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">PROCESSING FPS</p>
                <p className="text-2xl font-bold text-white font-mono">{telemetry ? telemetry.fps_processing.toFixed(1) : "0"}</p>
              </div>
              <Activity className="w-8 h-8 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">UPTIME</p>
                <p className="text-lg font-bold text-white font-mono">{telemetry ? formatUptime(telemetry.uptime_seconds) : "0d 0h 0m"}</p>
              </div>
              <Settings className="w-8 h-8 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Systems Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {systems.map((system) => (
          <Card
            key={system.id}
            className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors cursor-pointer"
            onClick={() => setSelectedSystem(system)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getSystemIcon(system.type)}
                  <div>
                    <CardTitle className="text-sm font-bold text-white tracking-wider">{system.name}</CardTitle>
                    <p className="text-xs text-neutral-400">{system.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(system.status)}
                  <Badge className={getStatusColor(system.status)}>{system.status.toUpperCase()}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">SYSTEM HEALTH</span>
                <span className={`text-sm font-bold font-mono ${getHealthColor(system.health)}`}>{system.health}%</span>
              </div>
              <Progress value={system.health} className="h-2" />

              {(system.cpu !== undefined || system.memory !== undefined || system.fps !== undefined) && (
              <div className="grid grid-cols-3 gap-4 text-xs">
                  {system.cpu !== undefined && (
                <div>
                  <div className="text-neutral-400 mb-1">CPU</div>
                  <div className="text-white font-mono">{system.cpu}%</div>
                  <div className="w-full bg-neutral-800 rounded-full h-1 mt-1">
                    <div
                      className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${system.cpu}%` }}
                    ></div>
                  </div>
                </div>
                  )}
                  {system.memory !== undefined && (
                <div>
                  <div className="text-neutral-400 mb-1">MEMORY</div>
                  <div className="text-white font-mono">{system.memory}%</div>
                  <div className="w-full bg-neutral-800 rounded-full h-1 mt-1">
                    <div
                      className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${system.memory}%` }}
                    ></div>
                  </div>
                </div>
                  )}
                  {system.fps !== undefined && (
                <div>
                      <div className="text-neutral-400 mb-1">FPS</div>
                      <div className="text-white font-mono">{system.fps.toFixed(1)}</div>
                  <div className="w-full bg-neutral-800 rounded-full h-1 mt-1">
                    <div
                      className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (system.fps / 30) * 100)}%` }}
                    ></div>
                  </div>
                    </div>
                  )}
                  {system.leftSpeed !== undefined && system.rightSpeed !== undefined && (
                    <>
                      <div>
                        <div className="text-neutral-400 mb-1">L MOTOR</div>
                        <div className="text-white font-mono">{system.leftSpeed}%</div>
                      </div>
                      <div>
                        <div className="text-neutral-400 mb-1">R MOTOR</div>
                        <div className="text-white font-mono">{system.rightSpeed}%</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-1 text-xs text-neutral-400">
                {system.uptime && (
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="text-white font-mono">{system.uptime}</span>
                </div>
                )}
                <div className="flex justify-between">
                  <span>Location:</span>
                  <span className="text-white">{system.location}</span>
                </div>
                {system.distance !== undefined && (
                  <div className="flex justify-between">
                    <span>Distance:</span>
                    <span className="text-white font-mono">{system.distance.toFixed(0)}cm</span>
                  </div>
                )}
                {system.confidence !== undefined && (
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="text-white font-mono">{system.confidence}%</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Detail Modal */}
      {selectedSystem && (() => {
        const system = systems.find((s) => s.id === selectedSystem)
        if (!system) return null
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                  {getSystemIcon(system.type)}
                <div>
                    <CardTitle className="text-xl font-bold text-white tracking-wider">{system.name}</CardTitle>
                  <p className="text-sm text-neutral-400">
                      {system.id} • {system.type}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSelectedSystem(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-300 tracking-wider mb-2">SYSTEM STATUS</h3>
                    <div className="flex items-center gap-2">
                        {getStatusIcon(system.status)}
                        <Badge className={getStatusColor(system.status)}>
                          {system.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-neutral-300 tracking-wider mb-2">SYSTEM INFORMATION</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Location:</span>
                          <span className="text-white">{system.location}</span>
                      </div>
                        {system.uptime && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Uptime:</span>
                            <span className="text-white font-mono">{system.uptime}</span>
                          </div>
                        )}
                        {system.temp && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Temperature:</span>
                            <span className="text-white font-mono">{system.temp.toFixed(1)}°C</span>
                          </div>
                        )}
                        {system.fps !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">FPS:</span>
                            <span className="text-white font-mono">{system.fps.toFixed(1)}</span>
                          </div>
                        )}
                        {system.mode && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Mode:</span>
                            <span className="text-white font-mono uppercase">{system.mode}</span>
                          </div>
                        )}
                        {system.distance !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Distance:</span>
                            <span className="text-white font-mono">{system.distance.toFixed(0)}cm</span>
                      </div>
                        )}
                        {system.confidence !== undefined && (
                      <div className="flex justify-between">
                            <span className="text-neutral-400">Confidence:</span>
                            <span className="text-white font-mono">{system.confidence}%</span>
                      </div>
                        )}
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Health Score:</span>
                          <span className={`font-mono ${getHealthColor(system.health)}`}>
                            {system.health}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-300 tracking-wider mb-2">RESOURCE USAGE</h3>
                    <div className="space-y-3">
                        {system.cpu !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-400">CPU Usage</span>
                              <span className="text-white font-mono">{system.cpu}%</span>
                        </div>
                        <div className="w-full bg-neutral-800 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${system.cpu}%` }}
                          ></div>
                        </div>
                      </div>
                        )}

                        {system.memory !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-400">Memory Usage</span>
                              <span className="text-white font-mono">{system.memory}%</span>
                        </div>
                        <div className="w-full bg-neutral-800 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${system.memory}%` }}
                          ></div>
                        </div>
                      </div>
                        )}

                        {system.leftSpeed !== undefined && system.rightSpeed !== undefined && (
                          <>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-neutral-400">Left Motor</span>
                                <span className="text-white font-mono">{system.leftSpeed}%</span>
                              </div>
                              <div className="w-full bg-neutral-800 rounded-full h-2">
                                <div
                                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.abs(system.leftSpeed)}%` }}
                                ></div>
                              </div>
                            </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                                <span className="text-neutral-400">Right Motor</span>
                                <span className="text-white font-mono">{system.rightSpeed}%</span>
                        </div>
                        <div className="w-full bg-neutral-800 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.abs(system.rightSpeed)}%` }}
                          ></div>
                        </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )
      })()}
    </div>
  )
}
