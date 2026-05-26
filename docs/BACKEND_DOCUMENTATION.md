# VoyagerBot — Backend Documentation

> Python/FastAPI autonomous robot control system on Raspberry Pi 5
> **Version:** 1.0 | **Last Updated:** November 2025 | **Platform:** Raspberry Pi 5 + Python 3.9+

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Installation & Setup](#installation--setup)
5. [Configuration](#configuration)
6. [Modules Documentation](#modules-documentation)
7. [API Reference](#api-reference)
8. [WebSocket Events](#websocket-events)
9. [Hardware Integration](#hardware-integration)
10. [Development Guide](#development-guide)

---

## Overview

VoyagerBot backend is a Python-based autonomous robot control system designed to run on Raspberry Pi 5. It provides real-time video streaming, color-based object tracking, autonomous navigation, and comprehensive telemetry monitoring. The backend uses a modular, multi-threaded architecture for optimal performance and maintainability.

### Key Features

- **Real-time Video Streaming** — 15 FPS JPEG streaming via WebSocket
- **Color-based Object Tracking** — OpenCV-powered marker detection with 8 color options
- **Autonomous Navigation** — PID-controlled following with state machine
- **Motor Control** — Differential drive with PWM speed control
- **Telemetry Monitoring** — CPU, RAM, temperature, and FPS metrics
- **WebSocket Communication** — Real-time bidirectional communication
- **REST API** — Configuration and status endpoints
- **Hardware Abstraction** — Works with or without physical hardware

---

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.9+ | Primary programming language |
| FastAPI | ≥0.104.0 | Async web framework for REST API |
| Uvicorn | ≥0.24.0 | ASGI server for FastAPI |
| Socket.IO | ≥5.10.0 | WebSocket communication |
| OpenCV | ≥4.8.0 | Computer vision and image processing |
| NumPy | ≥1.24.0 | Numerical computing and array operations |

### Hardware Interface

| Library | Version | Purpose |
|--------|---------|---------|
| Picamera2 | ≥0.3.12 | Raspberry Pi camera interface |
| RPi.GPIO | ≥0.7.1 | GPIO pin control for motors |

### System Monitoring & Utilities

| Library | Version | Purpose |
|--------|---------|---------|
| psutil | ≥5.9.0 | System and process monitoring |
| python-dotenv | ≥1.0.0 | Environment variable management |
| aiohttp | ≥3.9.0 | Async HTTP client/server |

### Complete `requirements.txt`

```
picamera2>=0.3.12
opencv-python>=4.8.0
numpy>=1.24.0
fastapi>=0.104.0
uvicorn>=0.24.0
python-socketio>=5.10.0
aiohttp>=3.9.0
RPi.GPIO>=0.7.1
psutil>=5.9.0
python-dotenv>=1.0.0
```

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Controller                        │
│                        (main.py)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     RobotController — Orchestrates all components    │  │
│  │       • Processing Thread (30 FPS)                   │  │
│  │       • Streaming Thread  (15 FPS)                   │  │
│  │       • Telemetry Thread  (1 Hz)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│  CameraCapture  │  │  Tracking   │  │  Navigation     │
│  (camera.py)    │  │(tracking.py)│  │(navigation.py)  │
│                 │  │             │  │                 │
│ • Picamera2     │  │ • HSV color │  │ • State Machine │
│ • 640×480@30fps │  │ • Blob detect│  │ • PID Control  │
│ • Thread-safe   │  │ • Distance  │  │ • Auto-follow  │
└─────────────────┘  └─────────────┘  └─────────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│ MotorController │  │   Server    │  │   Telemetry     │
│  (motors.py)    │  │ (server.py) │  │ (telemetry.py)  │
│                 │  │             │  │                 │
│ • L298N driver  │  │ • FastAPI   │  │ • CPU/RAM       │
│ • PWM control   │  │ • Socket.IO │  │ • Temperature   │
│ • Watchdog      │  │ • REST API  │  │ • FPS metrics   │
└─────────────────┘  └─────────────┘  └─────────────────┘
```

### Thread Architecture

| Thread | Rate | Responsibility |
|--------|------|---------------|
| Processing | 30 FPS | Camera → Tracking → Navigation → Motors |
| Streaming | 15 FPS | JPEG encoding → WebSocket broadcast |
| Telemetry | 1 Hz | Metrics collection → WebSocket broadcast |

### Data Flow

```
Camera → Processing Thread → Navigation → Motors
           │                      │
           └──→ Streaming Thread ─┴──→ WebSocket → Frontend
                                  │
           Telemetry Thread ───────┘
```

---

## Installation & Setup

### Prerequisites

- Raspberry Pi 5 (or 4 for testing)
- Raspberry Pi Camera Module v2 or v3
- L298N Motor Driver
- 2× DC Motors
- Python 3.9+
- Raspbian / Raspberry Pi OS (64-bit recommended)

### Hardware Setup

**1. Camera Connection**
```bash
# Enable camera interface
sudo raspi-config
# → Interface Options → Camera → Enable
sudo reboot

# Test
libcamera-hello
```

**2. Motor Driver Wiring**
```
L298N → Raspberry Pi GPIO (BCM)

Left Motor:
  EN  → GPIO 23  (Pin 16)
  IN1 → GPIO 24  (Pin 18)
  IN2 → GPIO 25  (Pin 22)

Right Motor:
  EN  → GPIO 17  (Pin 11)
  IN1 → GPIO 27  (Pin 13)
  IN2 → GPIO 22  (Pin 15)

Power:
  12V → Motor power supply
  GND → Common ground
```

### Software Installation

```bash
# 1. Clone repository
git clone https://github.com/aka-nahal/voyagerbot.git
cd voyagerbot/backend

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the backend
python3 main.py
```

### Verification

After starting, you should see:
```
INFO - Initializing modules...
INFO - Camera initialized successfully
INFO - Motor controller initialized (simulation mode)
INFO - Tracking initialized with color: orange
INFO - Navigation controller initialized
INFO - Telemetry monitor initialized
INFO - Communication server initialized
INFO - Starting server on http://0.0.0.0:8000
INFO - WebSocket server on ws://0.0.0.0:8765
INFO - All systems operational
```

Access points:
- **REST API:** `http://<raspberry-pi-ip>:8000`
- **WebSocket:** `ws://<raspberry-pi-ip>:8765`
- **Health Check:** `http://<raspberry-pi-ip>:8000/api/health`

> ⚠️ **Power Warning:** Do not power the Raspberry Pi from the L298N 5V output under heavy motor load. Use a dedicated 5V/5A USB-C supply.

---

## Configuration

All configuration lives in `backend/config.py` — no code changes needed for tuning.

### Camera Settings

```python
CAMERA_WIDTH  = 640     # Capture resolution width
CAMERA_HEIGHT = 480     # Capture resolution height
CAMERA_FPS    = 30      # Camera capture frame rate
STREAM_WIDTH  = 480     # Streaming resolution width
STREAM_HEIGHT = 320     # Streaming resolution height
STREAM_FPS    = 15      # WebSocket streaming FPS
JPEG_QUALITY  = 65      # JPEG compression quality (1–100)
```

### Tracking Settings

```python
AVAILABLE_COLORS = {
    'orange': {
        'hsv_min': [5, 150, 150],
        'hsv_max': [20, 255, 255],
        'display_name': 'Orange',
        'emoji': '🟠'
    },
    # ... 7 more colors (red, blue, green, yellow, purple, black, brown)
}

DEFAULT_TRACKING_COLOR  = 'orange'
MIN_BLOB_AREA           = 500       # Minimum valid marker size (pixels)
MAX_BLOB_AREA           = 50000     # Maximum valid marker size (pixels)
MARKER_LOST_TIMEOUT     = 3.0       # Seconds before marker considered lost
```

### Distance Estimation

```python
TARGET_DISTANCE_CM          = 125   # Ideal following distance
MIN_SAFE_DISTANCE_CM        = 20    # Stop threshold
MAX_TRACKING_DISTANCE_CM    = 500   # Maximum detection range
DISTANCE_CALIBRATION_FACTOR = 15000 # Adjust based on calibration
KNOWN_MARKER_WIDTH_CM       = 15    # Real-world marker width
```

### Motor Settings

```python
# GPIO Pins (match your wiring)
LEFT_EN  = 23;  LEFT_IN1  = 24;  LEFT_IN2  = 25
RIGHT_EN = 17;  RIGHT_IN1 = 27;  RIGHT_IN2 = 22

PWM_FREQUENCY        = 1000   # PWM frequency (Hz)
MAX_SPEED            = 100    # Maximum duty cycle (%)
MIN_OPERATIONAL_SPEED = 30   # Minimum speed to overcome friction
ACCELERATION_RATE    = 5      # Speed ramp rate
AUTO_MAX_SPEED       = 80     # Speed limit in autonomous mode
```

### PID Tuning

```python
# Centering Controller (horizontal alignment)
PID_CENTER_KP         = 0.8
PID_CENTER_KI         = 0.0
PID_CENTER_KD         = 0.1
PID_CENTER_MAX_OUTPUT = 50

# Distance Controller (forward/backward)
PID_DISTANCE_KP         = 0.5
PID_DISTANCE_KI         = 0.0
PID_DISTANCE_KD         = 0.05
PID_DISTANCE_MAX_OUTPUT = 40
```

### Navigation Settings

```python
SEARCH_ROTATION_SPEED = 30    # Rotation speed when searching
CENTER_DEADZONE       = 30    # Ignore small centering errors (pixels)
DISTANCE_DEADZONE     = 10    # Ignore small distance errors (cm)
```

### Network & Safety Settings

```python
WEBSOCKET_HOST   = "0.0.0.0"
WEBSOCKET_PORT   = 8765
API_HOST         = "0.0.0.0"
API_PORT         = 8000

WATCHDOG_TIMEOUT        = 0.5    # Auto-stop if no command (seconds)
CONNECTION_TIMEOUT      = 5.0    # Stop on disconnect (seconds)
THERMAL_LIMIT           = 75.0   # CPU temperature limit (°C)
EMERGENCY_STOP_PRIORITY = True

TELEMETRY_UPDATE_RATE = 1.0      # Update interval (seconds)
LOG_LEVEL             = "INFO"   # DEBUG, INFO, WARNING, ERROR
LOG_FILE              = "robot.log"
```

---

## Modules Documentation

### 1. Camera Module — `modules/camera.py`

Manages Raspberry Pi camera capture with thread-safe frame access.

**Class:** `CameraCapture`

```python
camera = CameraCapture(width=640, height=480, fps=30)
camera.start()
```

| Method | Description | Returns |
|--------|-------------|---------|
| `start()` | Initialize camera and start capture thread | `None` |
| `get_frame()` | Get latest frame (thread-safe) | `numpy.ndarray \| None` |
| `get_fps()` | Get current capture FPS | `float` |
| `stop()` | Stop camera and cleanup | `None` |

**Features:** Automatic reconnection · Thread-safe frame buffering · FPS monitoring · RGB888 format · Graceful error handling

---

### 2. Color Tracking Module — `modules/tracking.py`

Detects and tracks colored objects using HSV color space.

**Class:** `ColorTracker`

```python
tracker = ColorTracker(color='orange')
```

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `detect(frame)` | `numpy.ndarray` | `dict` | Detect marker in frame |
| `set_color(color_name)` | `str` | `None` | Change tracking color |
| `get_current_color()` | — | `str` | Get active color name |

**Detection Result Format:**
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

**Detection Algorithm:**
1. Convert BGR → HSV color space
2. Apply color threshold (`inRange`)
3. Morphological operations (open + close)
4. Find contours
5. Filter by area (`MIN_BLOB_AREA` → `MAX_BLOB_AREA`)
6. Calculate centroid using moments
7. Estimate distance from blob area

**Supported Colors:** Orange 🟠 · Red 🔴 · Blue 🔵 · Green 🟢 · Yellow 🟡 · Purple 🟣 · Black ⚫ · Brown 🟤

---

### 3. Motor Control Module — `modules/motors.py`

Controls DC motors via L298N H-bridge driver with PWM.

**Class:** `MotorController`

```python
motors = MotorController()
motors.start()
```

| Method | Parameters | Description |
|--------|-----------|-------------|
| `set_speed(left, right)` | `int, int` (−100 to 100) | Set motor speeds |
| `stop()` | — | Stop all motors |
| `get_status()` | — | Return current motor state |

**Speed Format:** Range −100 to 100 · Positive = Forward · Negative = Backward · 0 = Stop

**Status Format:**
```python
{
    'left_speed':  50,
    'right_speed': 50,
    'mode':        'manual',
    'timestamp':   1234567890.123
}
```

**Features:** Differential drive · PWM speed control (1000 Hz) · Speed ramping · Watchdog timer · Simulation mode · Thread-safe operations

---

### 4. Navigation Controller — `modules/navigation.py`

Implements autonomous navigation with state machine and dual PID control.

**Class:** `NavigationController`

```python
nav = NavigationController(motors, camera_width=640)
```

| Method | Parameters | Description |
|--------|-----------|-------------|
| `update(tracking_data)` | `dict` | Update navigation state |
| `set_mode(mode)` | `'manual' \| 'auto'` | Change navigation mode |
| `emergency_stop()` | — | Trigger emergency stop |
| `get_state()` | — | Get current state string |

**State Machine:**

| State | Description |
|-------|-------------|
| `IDLE` | Ready, waiting for mode change |
| `SEARCHING` | Rotating to find marker |
| `LOCKED` | Marker detected, preparing to follow |
| `FOLLOWING` | Actively tracking marker |
| `LOST` | Marker lost, attempting reacquisition |
| `STOPPED` | Emergency stop state |

**Zone-based Navigation:**
- Left Zone: 0–40% of frame width
- Center Zone: 40–60% of frame width
- Right Zone: 60–100% of frame width

---

### 5. Telemetry Monitor — `modules/telemetry.py`

Monitors system metrics including CPU, RAM, temperature, and FPS.

**Class:** `TelemetryMonitor`

**Metrics Format:**
```python
{
    'cpu_temp':           45.2,
    'cpu_usage':          25.5,
    'ram_usage_mb':       512.3,
    'ram_total_mb':       2048.0,
    'ram_percent':        25.0,
    'fps_processing':     28.5,
    'fps_streaming':      14.2,
    'uptime_seconds':     3600.0,
    'thermal_warning':    False,
    'network_bytes_sent': 1048576,
    'network_bytes_recv': 524288,
    'timestamp':          1234567890.123
}
```

---

### 6. Communication Server — `modules/server.py`

Provides WebSocket and REST API communication.

**Class:** `CommunicationServer`

**Features:** FastAPI REST API · Socket.IO WebSocket · CORS support · Client connection tracking · Async message processing

---

## API Reference

**Base URL:** `http://<raspberry-pi-ip>:8000`

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Current system status |
| GET | `/api/config` | All configuration parameters |
| GET | `/api/colors` | Available tracking colors |
| POST | `/api/config` | Update configuration |
| POST | `/api/calibrate/distance` | Calibrate distance estimation |

**`GET /api/health`**
```json
{ "status": "operational", "uptime": 3600.5, "timestamp": 1234567890.123 }
```

**`GET /api/status`**
```json
{
  "navigation": { "mode": "manual", "state": "idle" },
  "tracking":   { "color": "orange", "color_display": "Orange 🟠" },
  "clients_connected": 2,
  "motors":     { "left_speed": 0, "right_speed": 0 },
  "telemetry":  { "cpu_temp": 45.2, "cpu_usage": 25.5, "ram_usage_mb": 512.3 }
}
```

**`POST /api/calibrate/distance`**
```json
// Request
{ "known_distance_cm": 50, "measured_blob_area": 5000 }

// Response
{ "status": "success", "new_calibration_factor": 15000 }
```

---

## WebSocket Events

**WebSocket URL:** `ws://<raspberry-pi-ip>:8765`

### Client → Server

| Event | Payload |
|-------|---------|
| `manual_control` | `{ "direction": "forward", "speed": 50 }` |
| `mode_change` | `{ "mode": "auto" }` |
| `emergency_stop` | `{ "confirm": true }` |
| `change_color` | `{ "color": "blue" }` |
| `settings_update` | `{ "setting": "pid_center_kp", "value": 0.9 }` |

### Server → Client

| Event | Description |
|-------|-------------|
| `video_frame` | Base64-encoded JPEG frame |
| `tracking_data` | Marker position, distance, confidence |
| `telemetry` | CPU, RAM, temp, FPS metrics |
| `motor_status` | Current motor speeds and state |
| `alert` | System alerts (`info`, `warning`, `error`) |
| `mode_changed` | Mode change notification |
| `color_changed` | Color change broadcast |

---

## Hardware Integration

### Raspberry Pi 5

| Spec | Detail |
|------|--------|
| CPU | 2.4 GHz quad-core ARM Cortex-A76 |
| RAM | 4 GB or 8 GB LPDDR4X |
| GPIO | 40-pin header, BCM numbering |
| Camera | 2-lane MIPI CSI connector |
| Power | 5V/5A USB-C (27W recommended) |

### L298N Motor Driver

| L298N Pin | Raspberry Pi | Purpose |
|-----------|-------------|---------|
| IN1 (Left) | GPIO 24 | Motor direction |
| IN2 (Left) | GPIO 25 | Motor direction |
| EN (Left) | GPIO 23 | Speed (PWM) |
| IN1 (Right) | GPIO 27 | Motor direction |
| IN2 (Right) | GPIO 22 | Motor direction |
| EN (Right) | GPIO 17 | Speed (PWM) |
| 12V | Power supply | Motor power |
| GND | Common ground | Ground |

---

## Development Guide

### Adding a New Tracking Color

```python
# In config.py — no other changes needed
AVAILABLE_COLORS['pink'] = {
    'hsv_min': [140, 100, 100],
    'hsv_max': [170, 255, 255],
    'display_name': 'Pink',
    'emoji': '🩷'
}
```

### Tuning PID Controllers

```python
# In config.py
PID_CENTER_KP = 1.0   # More aggressive centering
PID_CENTER_KD = 0.2   # More damping, reduces oscillation
```

### Adding New API Endpoints

```python
# In modules/server.py
@app.get("/api/my-endpoint")
async def my_endpoint():
    return {"data": "value"}
```

### Debugging

```bash
# Enable debug logging (config.py)
LOG_LEVEL = "DEBUG"

# Watch live logs
tail -f robot.log
```

### Performance Optimization

```python
# Reduce CPU usage
CAMERA_WIDTH  = 480
CAMERA_HEIGHT = 320
STREAM_FPS    = 10
JPEG_QUALITY  = 50

# Reduce network bandwidth
STREAM_WIDTH  = 320
STREAM_HEIGHT = 240
JPEG_QUALITY  = 40
```

### Testing Without Hardware

The backend auto-detects missing hardware and runs in **simulation mode** — dummy camera feed and simulated motor control. No configuration needed.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera not found | Run `libcamera-hello`; enable via `raspi-config` |
| GPIO permission denied | `sudo usermod -a -G gpio $USER` then re-login |
| High CPU temperature | Lower `CAMERA_FPS` or `STREAM_FPS` in `config.py` |
| Motors not responding | Check wiring and verify GPIO pins match `config.py` |
| WebSocket not connecting | Confirm Pi IP, check firewall, ensure same network |

---

*For full feature reference see [FEATURES_DOCUMENTATION.md](FEATURES_DOCUMENTATION.md)*
*For frontend details see [FRONTEND_DOCUMENTATION.md](FRONTEND_DOCUMENTATION.md)*
