# VoyagerBot — Features Documentation

> Complete feature reference for developers, users, and stakeholders
> **Version:** 1.0 | **Last Updated:** November 2025 | **Project:** VoyagerBot

---

## Executive Summary

VoyagerBot is an advanced autonomous robot control system built on Raspberry Pi 5, featuring real-time video streaming, color-based object tracking, autonomous navigation, and AI-powered voice control. The system consists of a Python-based backend running on Raspberry Pi hardware and a modern Next.js frontend accessible via web browsers and mobile devices.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Backend Features](#backend-features)
3. [Frontend Features](#frontend-features)
4. [Communication Protocol](#communication-protocol)
5. [Hardware Integration](#hardware-integration)
6. [Technical Specifications](#technical-specifications)
7. [Security & Safety](#security--safety)
8. [Future Roadmap](#future-roadmap)

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Next.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Control  │  │   AI     │  │Telemetry │  │Settings│ │
│  │  Page    │  │  Page    │  │  Page    │  │  Page  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │  WebSocket + REST API
┌──────────────────────┴──────────────────────────────────┐
│               Backend (Python / FastAPI)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Server    │  │  Navigation  │  │   Tracking   │  │
│  │  (WebSocket) │  │  Controller  │  │   (OpenCV)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Camera    │  │    Motors    │  │  Telemetry   │  │
│  │ (Picamera2)  │  │ (GPIO/L298N) │  │   Monitor    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│               Hardware (Raspberry Pi 5)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Camera    │  │ Motor Driver │  │     GPIO     │  │
│  │  Module v2/3 │  │   (L298N)    │  │     Pins     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Thread Architecture

The backend uses three concurrent processing threads:

| Thread | Rate | Pipeline |
|--------|------|---------|
| Processing | 30 FPS | Camera → Tracking → Navigation → Motors |
| Streaming | 15 FPS | Frame encoding → WebSocket broadcast |
| Telemetry | 1 Hz | Metrics collection → WebSocket broadcast |

---

## Backend Features

### 1. Camera Module (`modules/camera.py`)

Manages Raspberry Pi camera capture with thread-safe frame access.

**Core capabilities:**
- High-performance capture via Picamera2 library at 640×480 @ 30 FPS
- Thread-safe frame access using a locking mechanism for concurrent reads
- Automatic reconnection on camera failures with graceful error recovery
- Real-time FPS monitoring and reporting
- RGB888 capture format for accurate color processing

**Key methods:** `start()` · `get_frame()` · `get_fps()` · `stop()`

---

### 2. Color Tracking Module (`modules/tracking.py`)

Detects and tracks colored objects using HSV color space analysis.

**Core capabilities:**
- Tracks 8 distinct colors simultaneously configurable at runtime
- Dynamic color switching without system restart
- Robust HSV-based detection resilient to lighting variation
- Distance estimation from tracked object using blob area (inverse-square relationship)
- Confidence scoring based on blob characteristics
- Morphological noise filtering (open + close operations)

**Supported colors:**

| Color | Emoji | HSV Range |
|-------|-------|-----------|
| Orange | 🟠 | `[5,150,150]` → `[20,255,255]` |
| Red | 🔴 | Configured in `config.py` |
| Blue | 🔵 | Configured in `config.py` |
| Green | 🟢 | Configured in `config.py` |
| Yellow | 🟡 | Configured in `config.py` |
| Purple | 🟣 | Configured in `config.py` |
| Black | ⚫ | Configured in `config.py` |
| Brown | 🟤 | Configured in `config.py` |

**Detection algorithm:**
1. Convert BGR → HSV color space
2. Apply color threshold (`inRange`)
3. Morphological operations for noise removal
4. Find and filter contours by area (`MIN_BLOB_AREA` → `MAX_BLOB_AREA`)
5. Calculate centroid using image moments
6. Estimate distance from blob area (inverse-square law)

**Output per frame:**
```python
{
    'marker_detected': True,
    'position':    {'x': 320, 'y': 240},
    'distance_cm': 45.5,
    'confidence':  0.85,
    'blob_area':   5000,
    'timestamp':   1234567890.123
}
```

---

### 3. Motor Control Module (`modules/motors.py`)

Controls DC motors via L298N H-bridge driver with PWM signals.

**Core capabilities:**
- Differential drive system with independent left/right control
- Precise PWM speed control (1000 Hz frequency)
- Bidirectional motion via H-bridge direction control
- Smooth speed ramping to prevent mechanical stress
- Watchdog timer — automatic stop if no command received within 0.5 s
- Full simulation mode for hardware-free testing

**Speed range:** −100 (full reverse) to +100 (full forward) · 0 = stop

**GPIO pin mapping:**

| Motor | EN (PWM) | IN1 | IN2 |
|-------|---------|-----|-----|
| Left | GPIO 23 | GPIO 24 | GPIO 25 |
| Right | GPIO 17 | GPIO 27 | GPIO 22 |

**Safety features:** Watchdog timeout · Configurable speed limits (100% manual / 80% autonomous) · Emergency stop · Automatic GPIO cleanup on shutdown

---

### 4. Navigation Controller (`modules/navigation.py`)

Implements autonomous navigation with a finite state machine and dual PID controllers.

**State machine:**

```
IDLE ──→ SEARCHING ──→ LOCKED ──→ FOLLOWING
  ↑           ↑              ↓         ↓
  └───────────┴──── LOST ←──┘         │
                                       ▼
                                   STOPPED (emergency)
```

| State | Behaviour |
|-------|-----------|
| `IDLE` | System ready, awaiting mode change |
| `SEARCHING` | Rotating to locate marker |
| `LOCKED` | Marker acquired, preparing to follow |
| `FOLLOWING` | Active tracking and following |
| `LOST` | Marker not visible, attempting reacquisition |
| `STOPPED` | Emergency stop engaged |

**Dual PID controllers:**

| Controller | Kp | Ki | Kd | Max Output | Purpose |
|-----------|----|----|----|-----------:|---------|
| Centering | 0.8 | 0.0 | 0.1 | 50 | Horizontal alignment |
| Distance | 0.5 | 0.0 | 0.05 | 40 | Forward/backward speed |

**Zone-based navigation:**
- Left zone (0–40%): turn left to center
- Center zone (40–60%): follow straight
- Right zone (60–100%): turn right to center

**Advanced features:** Sideways movement detection for predictive steering · Adaptive speed based on distance · Sudden-movement acceleration · Anti-windup integral clamping

---

### 5. Telemetry Monitor (`modules/telemetry.py`)

Real-time system health monitoring and metrics collection.

**Metrics collected:**

| Metric | Unit | Description |
|--------|------|-------------|
| `cpu_temp` | °C | CPU die temperature |
| `cpu_usage` | % | CPU utilization |
| `ram_usage_mb` | MB | RAM consumed |
| `ram_total_mb` | MB | Total RAM |
| `ram_percent` | % | RAM utilization |
| `fps_processing` | FPS | Processing thread rate |
| `fps_streaming` | FPS | Streaming thread rate |
| `uptime_seconds` | s | System uptime |
| `thermal_warning` | bool | Temperature threshold exceeded |
| `network_bytes_sent` | bytes | Cumulative egress |
| `network_bytes_recv` | bytes | Cumulative ingress |

Thermal warning fires when `cpu_temp > THERMAL_LIMIT` (default 75°C).

---

### 6. Communication Server (`modules/server.py`)

Unified WebSocket and REST API server for real-time bidirectional communication.

**Features:** FastAPI REST API · Socket.IO WebSocket server · CORS support (all origins in development) · Multi-client tracking · Async message processing · Comprehensive event routing

**REST endpoints summary:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check + uptime |
| GET | `/api/status` | Full system status |
| GET | `/api/config` | All configuration values |
| GET | `/api/colors` | Available tracking colors |
| POST | `/api/config` | Update configuration |
| POST | `/api/calibrate/distance` | Distance calibration |

---

### 7. Main Controller (`main.py`)

Orchestrates all modules, manages threads, and handles graceful shutdown.

**Responsibilities:**
- Module initialization and dependency injection
- Three-thread lifecycle management
- Signal handling (`SIGINT` / `SIGTERM`) for clean shutdown
- Frame queues connecting processing → streaming pipeline
- Comprehensive error logging

---

## Frontend Features

### 1. Main Dashboard (`app/page.tsx`)

Central navigation hub with first-run IP configuration.

**Features:** Responsive sidebar (desktop) + mobile hamburger menu · Tab navigation between sections · IP address dialog on first launch · Real-time connection indicator · Animated loading preloader · Dark theme throughout

---

### 2. Robot Control Page (`app/robot-control/page.tsx`)

Primary robot operation interface.

**Features:** Live camera feed with tracking overlay · Manual / Autonomous / Patrol mode switching · 8-color tracking color selector · Full joystick control pad · Emergency stop button · Real-time status badges

**Camera feed overlay:** Green detection circle · Crosshair at marker center · Distance readout · Confidence indicator · 3×3 spatial reference grid · FPS counter

**Joystick features:** Touch and mouse support · 8-directional movement · Rotation buttons · Speed ±% adjustment · Configurable repeat interval · Current command display

---

### 3. AI Page (`app/ai/page.tsx`)

Google Gemini-powered natural language robot control.

**Features:** Microphone voice input (Web Speech API) · Text input alternative · Command queue with visual status · Integrated camera view · Emergency stop from AI interface

**Voice command examples:**

| Utterance | Robot Action |
|-----------|-------------|
| "Move forward" | Drive forward |
| "Follow the blue marker" | Set color blue + enable auto mode |
| "Stop" | Emergency stop |
| "What's the CPU temperature?" | Query telemetry, respond via TTS |
| "Turn left slowly" | Slow left rotation |

**AI pipeline:** Speech → Web Speech API → Gemini Live API → Command parser → Socket.IO → Robot

---

### 4. Telemetry Page (`app/telemetry/page.tsx`)

System monitoring dashboard.

**Displayed metrics:** CPU % (with warning threshold) · CPU temperature · RAM MB and % · Processing and streaming FPS · Motor speeds (left/right) · Connection status · Uptime

**Visualization:** Color-coded warnings · Progress bars for CPU/RAM · Real-time charts for usage history · Recharts-powered graphs

---

### 5. Settings Page (`app/settings/page.tsx`)

Configuration and connection management.

**Features:** Backend IP address input and persistence · One-click connection test · Network detail display · Control preference adjustments · Option to clear all saved settings

---

### 6. Socket Communication (`lib/robot-socket.tsx`)

Global React context providing all real-time robot data and control functions.

**Auto-reconnection** with exponential backoff on disconnect.

**Control functions exposed:**

| Function | Parameters | Action |
|----------|-----------|--------|
| `sendManualControl` | direction, speed | Send movement command |
| `changeMode` | `'manual' \| 'auto'` | Switch navigation mode |
| `sendAutoCommand` | command string | Autonomous mode command |
| `emergencyStop` | — | Immediate halt |
| `changeColor` | color name | Switch tracking color |
| `fetchColors` | — | Load available colors |

---

### 7. Android App (Capacitor)

Native Android application wrapping the Next.js frontend.

**Build:**
```bash
npm run build:android
npx cap open android
# Android Studio → Build → Build APK(s)
```

**Native features:** Full-screen mode · Touch-optimized UI · System integration · Offline-capable shell · Camera access

---

## Communication Protocol

### WebSocket (Socket.IO)

| Property | Value |
|---------|-------|
| Transport | WebSocket with polling fallback |
| Reconnection | Automatic with exponential backoff |
| Timeout | 30 seconds |
| Heartbeat | Built-in Socket.IO ping/pong |

### Message Formats

**Video frame:**
```json
{
  "type": "video_frame",
  "data": "<base64_jpeg>",
  "timestamp": 1234567890.123,
  "frame_number": 12345
}
```

**Tracking data:**
```json
{
  "marker_detected": true,
  "position": {"x": 320, "y": 240},
  "distance_cm": 45.5,
  "confidence": 0.85,
  "blob_area": 5000,
  "timestamp": 1234567890.123
}
```

**Motor status:**
```json
{
  "left_speed": 50,
  "right_speed": 50,
  "mode": "manual",
  "state": "idle",
  "timestamp": 1234567890.123
}
```

**Telemetry:**
```json
{
  "cpu_temp": 45.2,
  "cpu_usage": 25.5,
  "ram_usage_mb": 512.3,
  "ram_total_mb": 2048.0,
  "ram_percent": 25.0,
  "fps_processing": 28.5,
  "fps_streaming": 14.2,
  "uptime_seconds": 3600.0,
  "thermal_warning": false,
  "network_bytes_sent": 1048576,
  "network_bytes_recv": 524288,
  "timestamp": 1234567890.123
}
```

---

## Hardware Integration

### Raspberry Pi 5

| Spec | Value |
|------|-------|
| CPU | 2.4 GHz quad-core ARM Cortex-A76 |
| RAM | 4 GB or 8 GB LPDDR4X |
| GPIO | 40-pin header, BCM numbering |
| Camera | 2-lane MIPI CSI |
| Power | 5V/5A USB-C (27W recommended) |

### L298N Motor Driver

| Spec | Value |
|------|-------|
| Logic voltage | 5V |
| Motor voltage | 5–35V (typically 12V) |
| Max current | 2A per channel |
| Control | Dual H-bridge |

**Full GPIO mapping:**

| Signal | L298N Pin | Raspberry Pi (BCM) |
|--------|----------|-------------------|
| Left speed | EN (Left) | GPIO 23 (PWM) |
| Left direction A | IN1 (Left) | GPIO 24 |
| Left direction B | IN2 (Left) | GPIO 25 |
| Right speed | EN (Right) | GPIO 17 (PWM) |
| Right direction A | IN1 (Right) | GPIO 27 |
| Right direction B | IN2 (Right) | GPIO 22 |
| Motor power | 12V | Motor supply |
| Ground | GND | Common ground |

### Camera Module

Compatible cameras: Raspberry Pi Camera Module v2 (8MP) · Camera Module v3 (12MP) · Any Picamera2-compatible camera

### Additional Hardware (Full BOM)

| Component | Purpose |
|----------|---------|
| Raspberry Pi 5 (8 GB) | Main compute unit |
| Camera Module v3 Noir | Vision / tracking |
| L298N Motor Driver | Motor control |
| 2× DC Motors | Locomotion |
| GSM Module + Antenna | Cellular connectivity |
| GPS Module | Location tracking |
| ESP32 MCU | Auxiliary control |
| 120 dB Siren | Alarm / alert |

---

## Technical Specifications

### Performance Metrics

| Metric | Value |
|--------|-------|
| Camera capture | 30 FPS @ 640×480 |
| Video streaming | 15 FPS @ 480×320 |
| Processing latency | < 33 ms / frame |
| Network latency (LAN) | < 50 ms |
| Motor response | < 100 ms |

### Configuration Reference

**Camera:**

| Parameter | Default | Description |
|----------|---------|-------------|
| `CAMERA_WIDTH` | 640 | Capture width |
| `CAMERA_HEIGHT` | 480 | Capture height |
| `CAMERA_FPS` | 30 | Capture rate |
| `STREAM_WIDTH` | 480 | Stream width |
| `STREAM_HEIGHT` | 320 | Stream height |
| `STREAM_FPS` | 15 | Stream rate |
| `JPEG_QUALITY` | 65 | Compression quality |

**Tracking:**

| Parameter | Default | Description |
|----------|---------|-------------|
| `MIN_BLOB_AREA` | 500 px | Minimum marker size |
| `MAX_BLOB_AREA` | 50,000 px | Maximum marker size |
| `MARKER_LOST_TIMEOUT` | 3.0 s | Lost marker threshold |
| `TARGET_DISTANCE_CM` | 125 cm | Ideal follow distance |
| `MIN_SAFE_DISTANCE_CM` | 20 cm | Stop threshold |
| `MAX_TRACKING_DISTANCE_CM` | 500 cm | Maximum range |

**Motors:**

| Parameter | Default | Description |
|----------|---------|-------------|
| `MAX_SPEED` | 100% | Manual max speed |
| `AUTO_MAX_SPEED` | 80% | Autonomous max speed |
| `PWM_FREQUENCY` | 1000 Hz | Motor PWM rate |
| `WATCHDOG_TIMEOUT` | 0.5 s | Auto-stop timeout |
| `ACCELERATION_RATE` | 5%/update | Ramp rate |

**Navigation:**

| Parameter | Default | Description |
|----------|---------|-------------|
| `SEARCH_ROTATION_SPEED` | 30% | Search spin speed |
| `CENTER_DEADZONE` | 30 px | Centering tolerance |
| `DISTANCE_DEADZONE` | 10 cm | Distance tolerance |
| `PID_CENTER_KP/KD` | 0.8 / 0.1 | Centering PID |
| `PID_DISTANCE_KP/KD` | 0.5 / 0.05 | Distance PID |

### Software Requirements

**Backend:**
- Python 3.9+
- picamera2 ≥ 0.3.12, opencv-python ≥ 4.8.0, numpy ≥ 1.24.0
- fastapi ≥ 0.104.0, uvicorn ≥ 0.24.0, python-socketio ≥ 5.10.0
- RPi.GPIO ≥ 0.7.1, psutil ≥ 5.9.0

**Frontend:**
- Node.js 18+, Next.js 14, React 18.3.1, TypeScript 5.x
- Socket.IO Client 4.8.1, Tailwind CSS 3.4.17
- Google Generative AI SDK, Capacitor 7.4.4

---

## Security & Safety

### Safety Features

| Feature | Mechanism |
|---------|-----------|
| Watchdog timer | Auto-stop motors after 0.5 s of no command |
| Emergency stop | Immediate halt from any interface |
| Thermal protection | CPU temperature monitoring (limit: 75°C) |
| Connection timeout | Motor stop on client disconnect (5 s) |
| Speed limits | 80% cap in autonomous mode |

### Network Security

> ⚠️ VoyagerBot is designed for **local network use only**. Current configuration has no authentication and allows all CORS origins. Do not expose to the public internet without additional security measures.

- CORS: Permissive (development configuration)
- Authentication: None (planned — see Roadmap)
- Encryption: None (planned — see Roadmap)

---

## Future Roadmap

| Feature | Description |
|---------|-------------|
| User authentication | Login/authorization for web interface |
| SSL/TLS | Encrypted WebSocket and REST API |
| Obstacle avoidance | Ultrasonic / LIDAR integration |
| SLAM mapping | Simultaneous Localization and Mapping |
| Multi-robot support | Control multiple VoyagerBot instances |
| Custom ML models | Trained object detection beyond color |
| Cloud remote access | Internet-accessible control + data logging |
| Path planning | Advanced autonomous navigation algorithms |

---

## Conclusion

VoyagerBot represents a comprehensive robotics platform combining real-time computer vision, autonomous navigation, and modern web technologies. The modular architecture enables easy extension and customization, while the responsive frontend provides an intuitive control interface accessible from any device.

Key achievements:
- Multi-threaded processing for optimal Raspberry Pi 5 performance
- Real-time video streaming with < 50 ms LAN latency
- Intelligent HSV-based object tracking and PID-controlled following
- Google Gemini AI-powered natural language voice control
- Comprehensive telemetry and thermal safety monitoring
- Robust error handling with hardware-abstraction simulation mode

---

*For backend implementation details see [BACKEND_DOCUMENTATION.md](BACKEND_DOCUMENTATION.md)*
*For frontend implementation details see [FRONTEND_DOCUMENTATION.md](FRONTEND_DOCUMENTATION.md)*
