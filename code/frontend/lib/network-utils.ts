/**
 * Network utilities for detecting local IP address
 */

export async function getLocalIP(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  // Try to get IP from WebRTC (most reliable)
  return new Promise<string | null>((resolve) => {
    const RTCPeerConnection = (window as any).RTCPeerConnection || 
                              (window as any).webkitRTCPeerConnection || 
                              (window as any).mozRTCPeerConnection
    
    if (!RTCPeerConnection) {
      resolve(null)
      return
    }
    
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    
    pc.createDataChannel('')
    
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate
        const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/)
        if (match) {
          const ip = match[1]
          // Filter out localhost and invalid IPs
          if (ip && !ip.startsWith('127.') && !ip.startsWith('169.254.')) {
            pc.close()
            resolve(ip)
            return
          }
        }
      }
    }
    
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => {
        pc.close()
        resolve(null)
      })
    
    // Timeout after 2 seconds
    setTimeout(() => {
      pc.close()
      resolve(null)
    }, 2000)
  })
}

export async function getNetworkIP(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  try {
    const ip = await getLocalIP()
    return ip
  } catch {
    return null
  }
}

