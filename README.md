# VOYAGER-BOT
An Autonomous smart Luggage Bag project 
# 🤖 VoyagerBot

> An advanced autonomous robot control system built on Raspberry Pi 5 — featuring real-time video streaming, AI-powered voice control, color-based object tracking, and autonomous navigation.

![VoyagerBot Banner](assets/banner.png)

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-5-C51A4A?style=flat-square&logo=raspberry-pi&logoColor=white)](https://raspberrypi.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**[Demo Video](#demo) · [Documentation](#documentation) · [Quick Start](#quick-start) · [Hardware Setup](#hardware-setup)**

</div>

---

## 📸 Demo

> 📹 *Add your demo video/GIF here — e.g., `![Demo](assets/demo.gif)`*

| Control Interface | Live Tracking | Telemetry Dashboard |
|:-:|:-:|:-:|
| ![Control](assets/control.png) | ![Tracking](assets/tracking.png) | ![Telemetry](assets/telemetry.png) |

---

## ✨ Features

### 🖥️ Backend (Raspberry Pi)
- **Real-time Video Streaming** — 15 FPS JPEG stream over WebSocket
- **Color Object Tracking** — OpenCV-powered detection for 8 colors (Orange, Red, Blue, Green, Yellow, Purple, Black, Brown)
- **Autonomous Navigation** — State machine + dual PID controllers for smooth following
- **Motor Control** — Differential drive with PWM via L298N H-bridge driver
- **System Telemetry** — Live CPU, RAM, temperature, and FPS monitoring
- **Safety Features** — Watchdog timer, emergency stop, thermal protection

### 🌐 Frontend (Web + Android)
- **Responsive Web App** — Built with Next.js 14, works on any device
- **Live Camera Feed** — Real-time stream with tracking overlay and detection markers
- **Joystick Control** — Touch & mouse-based directional control with speed adjustment
- **AI Voice Assistant** — Google Gemini-powered natural language commands
- **Telemetry Dashboard** — Real-time charts and metrics visualization
- **Android App** — Native APK via Capacitor

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────┐
│           Frontend Layer                        │
│   Next.js Web App  +  Android App (Capacitor)   │
└──────────────────┬──────────────────────────────┘
                   │  WebSocket (ws://pi:8765)
                   │  REST API  (http://pi:8000)
┌──────────────────┴──────────────────────────────┐
│           Backend Layer                         │
│         Python / FastAPI on Raspberry Pi 5      │
└──────────────────┬──────────────────────────────┘
                   │  GPIO + CSI Camera
┌──────────────────┴──────────────────────────────┐
│           Hardware Layer                        │
│    Camera Module  ·  L298N Driver  ·  DC Motors │
└─────────────────────────────────────────────────┘
```

### Thread Architecture (Backend)
| Thread | Rate | Responsibility |
|--------|------|----------------|
| Processing | 30 FPS | Camera → Tracking → Navigation → Motors |
| Streaming  | 15 FPS | JPEG encoding → WebSocket broadcast |
| Telemetry  | 1 Hz  | Metrics collection → WebSocket broadcast |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend Language | Python 3.9+ |
| Web Framework | FastAPI + Uvicorn |
| WebSocket | Socket.IO |
| Computer Vision | OpenCV 4.8+ |
| Camera | Picamera2 |
| GPIO | RPi.GPIO |
| Frontend Framework | Next.js 14 + React 18 + TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| AI | Google Gemini Live API |
| Mobile | Capacitor (Android) |
| Charts | Recharts |

---

## ⚡ Quick Start

### Prerequisites
- Raspberry Pi 5 (or Pi 4 for testing)
- Raspberry Pi Camera Module v2 or v3
- L298N Motor Driver + 2× DC Motors
- Node.js 18+ and Python 3.9+

### Backend Setup (Raspberry Pi)

```bash
git clone https://github.com/aka-nahal/voyagerbot.git
cd voyagerbot/backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
python3 main.py
```

The backend will start at:
- **REST API:** `http://0.0.0.0:8000`
- **WebSocket:** `ws://0.0.0.0:8765`

### Frontend Setup

```bash
cd voyagerbot/frontend
npm install
npm run dev
```

Open **http://localhost:3000**, enter your Raspberry Pi's IP address, and you're live.

---

## 🔌 Hardware Setup

### Wiring — L298N Motor Driver to Raspberry Pi 5

```
L298N Pin       →   Raspberry Pi GPIO (BCM)
─────────────────────────────────────────────
Left  EN        →   GPIO 23   (PWM)
Left  IN1       →   GPIO 24   (Direction)
Left  IN2       →   GPIO 25   (Direction)

Right EN        →   GPIO 17   (PWM)
Right IN1       →   GPIO 27   (Direction)
Right IN2       →   GPIO 22   (Direction)

12V             →   Motor Power Supply
GND             →   Common Ground
```

### Enable Camera Interface

```bash
sudo raspi-config
# Interface Options → Camera → Enable
sudo reboot

# Test camera
libcamera-hello
```

> ⚠️ **Power Warning:** Do not power the Raspberry Pi from the L298N 5V output under heavy motor load. Use a dedicated 5V/5A USB-C supply for the Pi.

---

## 🎮 Usage

### Manual Control
Use the on-screen joystick (web or Android) to drive the robot in 8 directions. Adjust speed between 30–100% using the +/- buttons.

### Autonomous Tracking
1. Select a color matching your marker (e.g., an orange ball)
2. Switch to **Auto** mode
3. The robot will find, lock on to, and follow the marker automatically

### AI Voice Control
Navigate to the **AI** page, tap the microphone, and speak commands:
```
"Move forward"             → drives forward
"Follow the blue marker"   → switches color + enables auto mode
"Stop"                     → emergency stop
"What's the CPU temp?"     → reads telemetry aloud
```

---

## 📡 API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Current system status |
| GET | `/api/config` | All configuration parameters |
| GET | `/api/colors` | Available tracking colors |
| POST | `/api/config` | Update configuration |
| POST | `/api/calibrate/distance` | Calibrate distance estimation |

### Key WebSocket Events

**Client → Server**
| Event | Payload Example |
|-------|----------------|
| `manual_control` | `{ direction: "forward", speed: 50 }` |
| `mode_change` | `{ mode: "auto" }` |
| `change_color` | `{ color: "blue" }` |
| `emergency_stop` | `{ confirm: true }` |

**Server → Client**
| Event | Description |
|-------|-------------|
| `video_frame` | Base64-encoded JPEG frame |
| `tracking_data` | Marker position, distance, confidence |
| `telemetry` | CPU, RAM, temp, FPS metrics |
| `motor_status` | Current motor speeds and state |

---

## ⚙️ Configuration

All settings live in `backend/config.py` — no code changes needed for tuning.

```python
# Camera
CAMERA_WIDTH  = 640      # Capture resolution
CAMERA_HEIGHT = 480
CAMERA_FPS    = 30
STREAM_FPS    = 15       # WebSocket streaming FPS

# PID Controllers
PID_CENTER_KP = 0.8      # Centering proportional gain
PID_CENTER_KD = 0.1      # Centering derivative gain
PID_DISTANCE_KP = 0.5    # Distance proportional gain

# Safety
WATCHDOG_TIMEOUT = 0.5   # Auto-stop if no command (seconds)
THERMAL_LIMIT    = 75.0  # CPU temp limit (°C)
```

### Adding a New Tracking Color

```python
# In config.py
AVAILABLE_COLORS['pink'] = {
    'hsv_min': [140, 100, 100],
    'hsv_max': [170, 255, 255],
    'display_name': 'Pink',
    'emoji': '🩷'
}
```
No other code changes needed — the system auto-detects new colors.

---

## 📱 Android App

```bash
# Build and sync
npm run build:android

# Open in Android Studio
npx cap open android

# Build APK: Android Studio → Build → Build APK(s)
# Or use the included PowerShell scripts:
.\build-apk.ps1
```

**Requirements:** Android Studio, Java JDK 11+, Android SDK, Gradle

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Camera Capture | 30 FPS @ 640×480 |
| Video Streaming | 15 FPS @ 480×320 |
| Processing Latency | < 33 ms/frame |
| Network Latency (LAN) | < 50 ms |
| Motor Response | < 100 ms |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera not found | Run `libcamera-hello`; enable via `raspi-config` |
| GPIO permission denied | `sudo usermod -a -G gpio $USER` then re-login |
| High CPU temperature | Lower `CAMERA_FPS` or `STREAM_FPS` in `config.py` |
| Motors not responding | Check wiring and verify GPIO pins match `config.py` |
| WebSocket not connecting | Confirm Pi IP address, check firewall, ensure same network |
| Frontend module not found | Delete `node_modules` and re-run `npm install` |

### Testing Without Hardware

The backend auto-detects missing hardware and runs in **simulation mode** — full functionality including a dummy camera feed and simulated motor control. Great for UI development on any machine.

```bash
# Enable debug logging
LOG_LEVEL = "DEBUG"   # in config.py

# Watch logs live
tail -f robot.log
```

---

## 📂 Project Structure

```
voyagerbot/
├── backend/
│   ├── main.py                 # Main controller & entry point
│   ├── config.py               # All configuration parameters
│   ├── requirements.txt
│   └── modules/
│       ├── camera.py           # Picamera2 capture
│       ├── tracking.py         # OpenCV color tracking
│       ├── navigation.py       # State machine + PID
│       ├── motors.py           # L298N motor control
│       ├── telemetry.py        # System metrics
│       └── server.py           # FastAPI + Socket.IO
│
└── frontend/
    ├── app/                    # Next.js App Router pages
    │   ├── page.tsx            # Dashboard
    │   ├── robot-control/      # Control interface
    │   ├── ai/                 # Voice assistant
    │   ├── telemetry/          # Metrics dashboard
    │   └── settings/           # Configuration
    ├── components/
    │   ├── camera-feed.tsx     # Live video component
    │   ├── control-pad.tsx     # Joystick component
    │   └── ui/                 # Shadcn UI components
    ├── lib/
    │   ├── robot-socket.tsx    # Socket.IO context
    │   └── ip-storage.ts       # IP persistence
    ├── hooks/
    │   └── useLiveAssistant.ts # AI voice hook
    └── android/                # Capacitor Android project
```

---

## 🗺️ Roadmap

- [ ] User authentication & authorization
- [ ] SSL/TLS encrypted communication
- [ ] Obstacle avoidance (ultrasonic / LIDAR)
- [ ] SLAM mapping
- [ ] Multi-robot support
- [ ] Custom ML object detection models
- [ ] Cloud remote access & data logging

---

## 📄 Documentation

Full documentation is available in the `/docs` folder (or see the files below):

- [`BACKEND_DOCUMENTATION.md`](docs/BACKEND_DOCUMENTATION.md) — Python modules, API reference, hardware wiring
- [`FRONTEND_DOCUMENTATION.md`](docs/FRONTEND_DOCUMENTATION.md) — Next.js architecture, components, hooks
- [`FEATURES_DOCUMENTATION.md`](docs/FEATURES_DOCUMENTATION.md) — Complete feature reference

---

## 🙏 Acknowledgements

- [FastAPI](https://fastapi.tiangolo.com) — Async Python web framework
- [OpenCV](https://opencv.org) — Computer vision library
- [Picamera2](https://github.com/raspberrypi/picamera2) — Raspberry Pi camera interface
- [Shadcn UI](https://ui.shadcn.com) — React component library
- [Google Gemini](https://ai.google.dev) — AI voice assistant
- [Capacitor](https://capacitorjs.com) — Native Android build

---

## 📜 License

free use License

---

<div align="center">

**Final Project — Semester VII, 2025**  
Built with ❤️ on Raspberry Pi 5

[⬆ Back to top](#-voyagerbot)

</div>
