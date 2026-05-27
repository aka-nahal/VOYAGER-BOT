"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRobotSocket } from "@/lib/robot-socket"
import { getConfig, updateConfig, type Config } from "@/lib/robot-api"
import { toast } from "sonner"
import { getNetworkIP } from "@/lib/network-utils"
import { Copy, Check } from "lucide-react"
import { getStoredIpAddress, setStoredIpAddress, validateIpAddress, formatIpAddress, getBackendUrl } from "@/lib/ip-storage"

export default function SettingsPage() {
  const { connected, updateSettings, socketUrl, setBackendUrl } = useRobotSocket()
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [backendIp, setBackendIp] = useState('')
  const [savingIp, setSavingIp] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [localIp, setLocalIp] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [manualPressDuration, setManualPressDuration] = useState(300)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      // Load stored IP address
      const storedIp = getStoredIpAddress()
      if (storedIp) {
        setBackendIp(storedIp)
      }
      loadConfig()
      // Get local IP for network access info
      getNetworkIP().then((ip) => {
        if (ip) {
          setLocalIp(ip)
        }
      })
      // Load manual press duration from localStorage
      const stored = localStorage.getItem('manual_press_duration_ms')
      if (stored) {
        setManualPressDuration(parseInt(stored, 10))
      }
    }
  }, [mounted])

  const copyNetworkUrl = () => {
    if (localIp && typeof window !== 'undefined') {
      const port = window.location.port ? parseInt(window.location.port) : 3000
      const url = `http://${localIp}:${port}`
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Network URL copied to clipboard")
    }
  }

  const loadConfig = async () => {
    try {
      const data = await getConfig()
      setConfig(data)
    } catch (error) {
      console.error("Failed to load configuration:", error)
      // Don't show error toast if just not connected - user will see connection status
      if (connected) {
        toast.error("Failed to load configuration from backend")
      }
      // Set empty config so UI doesn't stay stuck
      setConfig({
        camera: { width: 640, height: 480, fps: 30 },
        tracking: { hsv_min: [5, 200, 200], hsv_max: [15, 255, 255], min_blob_area: 500, target_distance_cm: 125 },
        motor: { max_speed: 100, auto_max_speed: 80 },
        pid: {
          center: { kp: 0.8, ki: 0.0, kd: 0.1 },
          distance: { kp: 0.5, ki: 0.0, kd: 0.05 },
        },
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await updateConfig(config)
      updateSettings("config", config)
      toast.success("Configuration saved")
    } catch (error) {
      toast.error("Failed to save configuration")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const updateCameraConfig = (field: string, value: number) => {
    if (!config) return
    setConfig({
      ...config,
      camera: { ...config.camera, [field]: value },
    })
  }

  const updateTrackingConfig = (field: string, value: number | number[]) => {
    if (!config) return
    setConfig({
      ...config,
      tracking: { ...config.tracking, [field]: value },
    })
  }

  const updatePIDConfig = (controller: "center" | "distance", field: string, value: number) => {
    if (!config) return
    setConfig({
      ...config,
      pid: {
        ...config.pid,
        [controller]: { ...config.pid[controller], [field]: value },
      },
    })
  }

  const handleSaveBackendIp = async () => {
    setSavingIp(true)
    try {
      // Validate IP address
      if (!backendIp.trim()) {
        toast.error("IP address cannot be empty")
        return
      }

      const cleaned = formatIpAddress(backendIp)
      if (!validateIpAddress(cleaned)) {
        toast.error("Invalid IP address format (e.g., 192.168.1.100)")
        return
      }

      // Test connection
      const url = getBackendUrl(cleaned)
      try {
        const response = await fetch(`${url}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) {
          throw new Error(`Connection failed: ${response.status}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to connect. Please check the IP address.")
        setSavingIp(false)
        return
      }

      // Save IP and update connection
      setStoredIpAddress(cleaned)
      setBackendUrl(url)
      toast.success("IP address updated. Reconnecting...")
      
      // Reload page to ensure everything reinitializes
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      toast.error(`Failed to update IP address: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setSavingIp(false)
    }
  }
  if (loading) {
    return (
      <div className="px-4 py-4 md:p-6 md:ml-64">
        <div className="text-neutral-400">Loading configuration...</div>
      </div>
    )
  }

  // Show settings even if config failed to load (uses defaults)
  if (!config) {
    return (
      <div className="px-4 py-4 md:p-6 md:ml-64">
        <div className="text-red-500 mb-4">Failed to load configuration from backend</div>
        <div className="text-neutral-400 text-sm">
          Make sure the backend is running and you're connected. You can still configure the connection settings below.
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 md:ml-64">
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {/* Connection Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">BACKEND CONNECTION</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">Raspberry Pi IP Address</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={backendIp}
                  onChange={(e) => setBackendIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="bg-neutral-800 border-neutral-700 text-white font-mono flex-1 text-sm sm:text-base min-h-[44px]"
                  disabled={savingIp}
                />
                <Button
                  onClick={handleSaveBackendIp}
                  disabled={savingIp || !backendIp.trim()}
                  className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white whitespace-nowrap min-h-[44px] px-3 sm:px-4 touch-manipulation"
                >
                  {savingIp ? "Saving..." : "Save"}
                </Button>
              </div>
              <p className="text-[10px] sm:text-xs text-neutral-500 mt-1.5 sm:mt-1">
                Enter the IP address of your Raspberry Pi robot (e.g., 192.168.1.100)
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-neutral-700">
              <span className="text-sm text-neutral-400">Status:</span>
              <span className={connected ? "text-green-500 font-mono text-sm" : "text-red-500 font-mono text-sm"}>
                {connected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            {socketUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Current URL:</span>
                <span className="text-white font-mono text-xs break-all text-right max-w-[60%]">
                  {socketUrl}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Access Info */}
        {localIp && (
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">NETWORK ACCESS</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
              <div>
                <Label className="text-xs text-neutral-400 uppercase mb-2 block">Local Network URL</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={`http://${localIp}:${typeof window !== 'undefined' ? (window.location.port || '3000') : '3000'}`}
                    readOnly
                    className="bg-neutral-800 border-neutral-700 text-green-400 font-mono text-[10px] sm:text-xs flex-1 min-h-[44px]"
                  />
                  <Button
                    onClick={copyNetworkUrl}
                    className="bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-white p-2 min-h-[44px] min-w-[44px] touch-manipulation"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] sm:text-xs text-neutral-500 mt-2 space-y-1">
                  <div>Share this URL with devices on the same WiFi network.</div>
                  <div className="mt-1">⚠️ <strong>Windows Firewall:</strong> You may need to allow port 3000 in Windows Firewall.</div>
                  <div className="mt-1">Run <code className="bg-neutral-800 px-1 rounded">.\check-network.ps1</code> in PowerShell (as Admin) to configure automatically.</div>
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-700">
                <span className="text-xs sm:text-sm text-neutral-400">Your IP:</span>
                <span className="text-white font-mono text-xs sm:text-sm">{localIp}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Camera Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">CAMERA</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">Width (px)</Label>
              <Input
                type="number"
                value={config.camera.width}
                onChange={(e) => updateCameraConfig("width", parseInt(e.target.value))}
                className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                disabled={!connected}
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">Height (px)</Label>
              <Input
                type="number"
                value={config.camera.height}
                onChange={(e) => updateCameraConfig("height", parseInt(e.target.value))}
                className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                disabled={!connected}
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">FPS</Label>
              <Input
                type="number"
                value={config.camera.fps}
                onChange={(e) => updateCameraConfig("fps", parseInt(e.target.value))}
                className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                disabled={!connected}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tracking Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">TRACKING</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">HSV Min (H, S, V)</Label>
              <div className="flex gap-2">
                {config.tracking.hsv_min.map((val, i) => (
                  <Input
                    key={i}
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newMin = [...config.tracking.hsv_min]
                      newMin[i] = parseInt(e.target.value)
                      updateTrackingConfig("hsv_min", newMin)
                    }}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">HSV Max (H, S, V)</Label>
              <div className="flex gap-2">
                {config.tracking.hsv_max.map((val, i) => (
                  <Input
                    key={i}
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newMax = [...config.tracking.hsv_max]
                      newMax[i] = parseInt(e.target.value)
                      updateTrackingConfig("hsv_max", newMax)
                    }}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">Target Distance (cm)</Label>
              <Input
                type="number"
                value={config.tracking.target_distance_cm}
                onChange={(e) => updateTrackingConfig("target_distance_cm", parseInt(e.target.value))}
                className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                disabled={!connected}
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">Min Blob Area</Label>
              <Input
                type="number"
                value={config.tracking.min_blob_area}
                onChange={(e) => updateTrackingConfig("min_blob_area", parseInt(e.target.value))}
                className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                disabled={!connected}
              />
            </div>
          </CardContent>
        </Card>

        {/* PID Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">PID CONTROLLERS</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
            <div>
              <h4 className="text-xs text-neutral-400 uppercase mb-2 sm:mb-3">Centering Controller</h4>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <Label className="text-xs text-neutral-500 mb-1 block">Kp</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.pid.center.kp}
                    onChange={(e) => updatePIDConfig("center", "kp", parseFloat(e.target.value))}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                </div>
                <div>
                  <Label className="text-xs text-neutral-500 mb-1 block">Ki</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.pid.center.ki}
                    onChange={(e) => updatePIDConfig("center", "ki", parseFloat(e.target.value))}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                </div>
                <div>
                  <Label className="text-xs text-neutral-500 mb-1 block">Kd</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.pid.center.kd}
                    onChange={(e) => updatePIDConfig("center", "kd", parseFloat(e.target.value))}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-xs text-neutral-400 uppercase mb-2 sm:mb-3">Distance Controller</h4>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <Label className="text-xs text-neutral-500 mb-1 block">Kp</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.pid.distance.kp}
                    onChange={(e) => updatePIDConfig("distance", "kp", parseFloat(e.target.value))}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                </div>
                <div>
                  <Label className="text-xs text-neutral-500 mb-1 block">Ki</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.pid.distance.ki}
                    onChange={(e) => updatePIDConfig("distance", "ki", parseFloat(e.target.value))}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                </div>
                <div>
                  <Label className="text-xs text-neutral-500 mb-1 block">Kd</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.pid.distance.kd}
                    onChange={(e) => updatePIDConfig("distance", "kd", parseFloat(e.target.value))}
                    className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                    disabled={!connected}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Motor Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">MOTOR</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-2 text-[11px] sm:text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-neutral-500 flex-shrink-0">MAX SPEED:</span>
              <span className="text-white font-mono text-right">{config.motor.max_speed}%</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-neutral-500 flex-shrink-0">AUTO MAX SPEED:</span>
              <span className="text-white font-mono text-right">{config.motor.auto_max_speed}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Control Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">CONTROL</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
            {[
              { label: "INVERT CAMERA", default: false },
              { label: "SMOOTH MOVEMENT", default: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <label className="text-sm text-neutral-400">{item.label}</label>
                <input type="checkbox" defaultChecked={item.default} className="w-5 h-5 cursor-pointer" />
              </div>
            ))}
            <div>
              <label className="text-xs text-neutral-400 uppercase mb-2 block">SPEED MULTIPLIER</label>
              <input type="range" min="0.5" max="2" step="0.1" defaultValue="1" className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 uppercase mb-2 block">MANUAL PRESS DURATION (ms)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="50"
                  max="2000"
                  step="50"
                  value={manualPressDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    if (!isNaN(value) && value >= 50 && value <= 2000) {
                      setManualPressDuration(value)
                      localStorage.setItem('manual_press_duration_ms', value.toString())
                      // Dispatch custom event for same-window updates
                      window.dispatchEvent(new Event('manualPressDurationChanged'))
                    }
                  }}
                  className="bg-neutral-800 border-neutral-700 text-white min-h-[44px] text-sm sm:text-base"
                />
                <span className="text-xs text-neutral-500 whitespace-nowrap">ms</span>
              </div>
              <p className="text-[10px] sm:text-xs text-neutral-500 mt-1.5 sm:mt-1">
                How long each button press lasts (50-2000ms)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 py-3 sm:py-4">
            <Button
              onClick={handleSave}
              disabled={!connected || saving}
              className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white py-3 sm:py-2 h-auto min-h-[44px] text-sm touch-manipulation"
            >
              {saving ? "SAVING..." : "SAVE CONFIGURATION"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
