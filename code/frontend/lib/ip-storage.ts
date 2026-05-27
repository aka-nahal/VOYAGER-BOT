const STORAGE_KEY = 'rpi_ip_address'

export function getStoredIpAddress(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredIpAddress(ip: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, ip)
}

export function clearStoredIpAddress(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function formatIpAddress(ip: string): string {
  // Remove http:// or https:// if present
  let cleaned = ip.replace(/^https?:\/\//, '')
  // Remove port if present (we'll add it back)
  cleaned = cleaned.split(':')[0]
  return cleaned.trim()
}

export function validateIpAddress(ip: string): boolean {
  const cleaned = formatIpAddress(ip)
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(cleaned)) return false
  
  // Check each octet is 0-255
  const parts = cleaned.split('.')
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

export function getBackendUrl(ip: string, port: number = 8000): string {
  const cleaned = formatIpAddress(ip)
  return `http://${cleaned}:${port}`
}

