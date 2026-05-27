/**
 * REST API client for robot backend.
 */

import { getStoredIpAddress, getBackendUrl } from './ip-storage'

function getApiBaseUrl(): string {
  const storedIp = getStoredIpAddress()
  if (!storedIp) {
    throw new Error('Raspberry Pi IP address not configured. Please set it in settings.')
  }
  return getBackendUrl(storedIp)
}

export interface SystemStatus {
  mode: string
  state: string
  connected_clients: number
  motor_status: {
    left_speed: number
    right_speed: number
    enabled: boolean
  }
  telemetry: {
    cpu_temp: number
    cpu_usage: number
    ram_usage: number
    fps: number
  }
}

export interface Config {
  camera: {
    width: number
    height: number
    fps: number
  }
  tracking: {
    hsv_min: number[]
    hsv_max: number[]
    min_blob_area: number
    target_distance_cm: number
  }
  motor: {
    max_speed: number
    auto_max_speed: number
  }
  pid: {
    center: {
      kp: number
      ki: number
      kd: number
    }
    distance: {
      kp: number
      ki: number
      kd: number
    }
  }
}

function getApiUrl(): string {
  return getApiBaseUrl()
}

export async function getStatus(): Promise<SystemStatus> {
  const res = await fetch(`${getApiUrl()}/api/status`)
  if (!res.ok) throw new Error('Failed to fetch status')
  return res.json()
}

export async function getConfig(): Promise<Config> {
  const res = await fetch(`${getApiUrl()}/api/config`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function updateConfig(updates: Partial<Config>): Promise<void> {
  const res = await fetch(`${getApiUrl()}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update config')
}

export async function healthCheck(): Promise<{ status: string; uptime: number; timestamp: number }> {
  const res = await fetch(`${getApiUrl()}/api/health`)
  if (!res.ok) throw new Error('Health check failed')
  return res.json()
}


