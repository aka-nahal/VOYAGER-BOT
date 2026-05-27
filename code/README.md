# VoyagerBot 🤖

A Raspberry Pi 5 robot with camera-based color marker tracking, autonomous person following, real-time WebSocket control, and an AI assistant — all managed from a mobile-first web app or Android APK.

---

## Overview

VoyagerBot is a three-part system:

| Component | Tech | Purpose |
|-----------|------|---------|
| `backend/` | Python 3, FastAPI, Socket.IO, OpenCV, picamera2, RPi.GPIO | Runs on the Raspberry Pi 5; handles vision, motors, and the communication server |
| `frontend/` | Next.js 14, TypeScript, Tailwind CSS, Capacitor | Web/Android control interface with live camera feed, telemetry, and an AI chat assistant |
| `cli_control/` | Python 3 | Keyboard-driven motor tester for verifying wiring before full deployment |

---

## Features

- **Color Marker Tracking** — HSV-based detection supporting 12 colors (orange, red, blue, green, yellow, purple, pink, cyan, black, white, brown, and custom via image upload)
- **Autonomous Following** — Dual PID controllers keep the robot centered on and at a configurable distance from the tracked marker
- **Manual Control** — D-pad interface streamed over WebSocket with < 150 ms latency
- **Live Video Streaming** — MJPEG frames (480 × 320 px) encoded as JPEG and sent to the frontend at 15 FPS
- **AI Assistant** — Google Gemini-powered chat interface with live camera context; issues robot movement commands from natural language
- **System Telemetry** — Real-time CPU temperature, CPU/RAM usage, and FPS graphs in the app
- **Safety** — Watchdog timer, emergency stop button, thermal throttle at 75 °C
- **Android App** — Capacitor wraps the Next.js build into a native `.apk`

---

## Repository Structure

```
voyagerbot/
├── backend/               # Raspberry Pi 5 Python backend
│   ├── main.py            # Entry point — starts all threads
│   ├── config.py          # All tunable parameters in one place
│   ├── requirements.txt   # Python dependencies
│   └── modules/
│       ├── camera.py      # picamera2 capture
│       ├── tracking.py    # HSV color detection & blob analysis
│       ├── navigation.py  # PID state machine (manual / auto / search)
│       ├── motors.py      # GPIO PWM motor driver (L298N)
│       ├── telemetry.py   # CPU temp, RAM, FPS monitoring
│       └── server.py      # FastAPI REST + Socket.IO server
│
├── frontend/              # Next.js web + Android app
│   ├── app/
│   │   ├── page.tsx       # Root dashboard layout
│   │   ├── robot-control/ # Camera feed, mode selector, control pad
│   │   ├── ai/            # Gemini AI chat with live camera
│   │   ├── telemetry/     # Real-time charts
│   │   └── settings/      # IP address & robot configuration
│   ├── components/        # Reusable UI components
│   ├── hooks/             # useRobotSocket, useLiveAssistant, etc.
│   ├── lib/               # Socket client, IP storage helpers
│   └── capacitor.config.ts
│
└── cli_control/           # Command-line motor tester
    ├── cli_motor_control.py
    └── test_motors.py
```

---

## Hardware Requirements

- **Raspberry Pi 5** (4 GB RAM recommended)
- **Raspberry Pi Camera Module 3**
- **L298N Dual H-Bridge Motor Driver**
- **Two DC motors** (differential drive)
- **7–12 V motor power supply** (separate from the RPi supply)
- A phone or browser on the same network as the RPi

### GPIO Wiring

```
Left Motor             Right Motor
  EN  → GPIO 23          EN  → GPIO 17
  IN1 → GPIO 24          IN1 → GPIO 27
  IN2 → GPIO 25          IN2 → GPIO 22
```

> **Important:** Common ground between RPi and L298N is required.

---

## Backend Setup (Raspberry Pi 5)

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip python3-opencv python3-picamera2
```

### 2. Enable the Camera

```bash
sudo raspi-config
# Interface Options → Camera → Enable
```

### 3. Install Python Dependencies

```bash
cd backend
pip3 install -r requirements.txt
```

### 4. Grant GPIO Access

```bash
sudo usermod -a -G gpio $USER
# Log out and back in
```

### 5. Start the Backend

```bash
cd backend
python3 main.py
```

The backend starts two servers:

| Server | Default address |
|--------|----------------|
| Socket.IO / WebSocket | `ws://<rpi-ip>:8765` |
| REST API | `http://<rpi-ip>:8000` |

---

## Frontend Setup

### Run the Web App (development)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

On first load the app prompts for the Raspberry Pi's IP address. This is stored in `localStorage`.

### Build for Production

```bash
npm run build
npm run start
```

### Build the Android APK

```bash
# Requires Android Studio with SDK 34+
npm run build:android        # Next.js build + Capacitor sync
npx cap open android         # Open in Android Studio, then build APK
```

Or use the included PowerShell helpers on Windows:

```powershell
.\build-apk.ps1
```

---

## REST API Reference

All endpoints are served at `http://<rpi-ip>:8000`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Current system status |
| `GET` | `/api/config` | All configuration parameters |
| `POST` | `/api/config` | Update configuration |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/calibrate/distance` | Calibrate distance estimation |

---

## WebSocket Events

### Outgoing (RPi → Frontend)

| Event | Payload |
|-------|---------|
| `video_frame` | Base64-encoded JPEG frame + frame number |
| `tracking_data` | Detected blob position, size, distance, color |
| `motor_status` | Current left/right speeds and enabled state |
| `telemetry` | CPU temp, CPU %, RAM, FPS metrics |
| `alert` | Severity + message string |

### Incoming (Frontend → RPi)

| Event | Payload |
|-------|---------|
| `manual_control` | `{ command: "forward" \| "backward" \| "left" \| "right" \| "stop", speed: number }` |
| `mode_change` | `{ mode: "manual" \| "auto" }` |
| `auto_command` | `{ action: "start_following" \| "stop_following" }` |
| `emergency_stop` | _(no payload)_ |
| `settings_update` | Key-value configuration overrides |
| `change_color` | `{ color: string }` |

---

## CLI Motor Tester

Use this to verify GPIO wiring before running the full backend:

```bash
cd cli_control
python3 cli_motor_control.py
```

### Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Forward |
| `S` / `↓` | Backward |
| `A` / `←` | Rotate left |
| `D` / `→` | Rotate right |
| `Q` | Arc left (forward) |
| `E` | Arc right (forward) |
| `Z` | Arc left (backward) |
| `C` | Arc right (backward) |
| `1`–`9` | Set speed 10 %–90 % |
| `0` | Set speed 100 % |
| `Space` / `Enter` | Stop |
| `H` | Show help |
| `X` / `ESC` | Exit |

---

## Configuration Reference (`backend/config.py`)

| Section | Key parameters |
|---------|---------------|
| Camera | `CAMERA_WIDTH/HEIGHT` (640×480), `CAMERA_FPS` (30), `STREAM_FPS` (15) |
| Tracking | `DEFAULT_TRACKING_COLOR` (`orange`), `AVAILABLE_COLORS`, `MIN/MAX_BLOB_AREA` |
| Distance | `TARGET_DISTANCE_CM` (125), `MIN_SAFE_DISTANCE_CM` (20), `DISTANCE_CALIBRATION_FACTOR` |
| Motors | GPIO pins, `PWM_FREQUENCY` (1000 Hz), `MAX_SPEED` (100), `AUTO_MAX_SPEED` (80) |
| PID — center | `KP` 0.8, `KI` 0.0, `KD` 0.1 |
| PID — distance | `KP` 0.5, `KI` 0.0, `KD` 0.05 |
| Safety | `WATCHDOG_TIMEOUT` (0.5 s), `THERMAL_LIMIT` (75 °C) |
| Network | `WEBSOCKET_PORT` 8765, `API_PORT` 8000 |

---

## Auto-Start on Boot (optional)

```bash
sudo nano /etc/systemd/system/voyagerbot.service
```

```ini
[Unit]
Description=VoyagerBot Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/voyagerbot/backend
ExecStart=/usr/bin/python3 main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable voyagerbot.service
sudo systemctl start voyagerbot.service
```

---

## Troubleshooting

| Symptom | Steps |
|---------|-------|
| Camera not found | Run `rpicam-hello`; check ribbon cable; re-enable in `raspi-config` |
| Motors don't respond | Test individual GPIO pins; verify L298N 7–12 V supply; check common ground |
| Tracking misses marker | Widen HSV range in `config.py`; improve lighting; increase `MAX_TRACKING_DISTANCE_CM` |
| High CPU temperature | Lower `CAMERA_FPS`; reduce stream resolution; check ventilation |
| Frontend can't connect | Confirm RPi IP address in app Settings; check firewall rules on ports 8000 and 8765 |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
