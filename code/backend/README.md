# Raspberry Pi 5 Robot Backend

Python backend system for a Raspberry Pi 5 robot with camera-based person following using color marker tracking.

## Features

- **Color Marker Tracking**: Detects bright orange markers using HSV color filtering
- **Autonomous Following**: PID-controlled person following with configurable distance
- **Manual Control**: WebSocket-based real-time control
- **Video Streaming**: MJPEG stream to web frontend with tracking overlays
- **System Telemetry**: CPU temperature, usage, RAM, FPS monitoring
- **Safety Features**: Watchdog timer, emergency stop, thermal protection

## Hardware Requirements

- Raspberry Pi 5 (4GB RAM recommended)
- RPi Camera 3
- L298N Motor Driver
- Dual DC motors (differential steering)
- 7-12V power supply for motors (separate from RPi)

## GPIO Wiring

```
# LEFT MOTOR
LEFT_EN = 23      # PWM Enable pin
LEFT_IN1 = 24     # Direction control 1
LEFT_IN2 = 25     # Direction control 2

# RIGHT MOTOR
RIGHT_EN = 17     # PWM Enable pin
RIGHT_IN1 = 27    # Direction control 1
RIGHT_IN2 = 22    # Direction control 2
```

**Important**: Common ground between RPi and L298N required!

## Installation

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip python3-opencv python3-picamera2
```

### 2. Enable Camera

```bash
sudo raspi-config
# Navigate to: Interface Options → Camera → Enable
```

### 3. Install Python Dependencies

```bash
cd backend
pip3 install -r requirements.txt
```

### 4. Configure GPIO Access

```bash
sudo usermod -a -G gpio pi
# Log out and back in for changes to take effect
```

### 5. Test Camera

```bash
rpicam-hello
```

## Configuration

All configuration parameters are in `config.py`. Key settings:

- **Camera**: Resolution, FPS, streaming quality
- **Tracking**: HSV color range, blob size limits, distance calibration
- **Motors**: GPIO pins, PWM frequency, speed limits
- **PID Controllers**: Tuning parameters for centering and distance control
- **Network**: WebSocket and API ports

## Usage

### Start the Backend

```bash
cd backend
python3 main.py
```

The server will start on:
- **WebSocket**: `ws://raspberry-pi-ip:8765`
- **REST API**: `http://raspberry-pi-ip:8000`

### Manual Control

Connect via WebSocket and send commands:

```javascript
socket.emit('manual_control', {
    command: 'forward',  // forward, backward, left, right, stop
    speed: 75
});
```

### Autonomous Following

```javascript
socket.emit('mode_change', { mode: 'auto' });
socket.emit('auto_command', { action: 'start_following' });
```

### Emergency Stop

```javascript
socket.emit('emergency_stop');
```

## REST API Endpoints

- `GET /api/status` - Current system status
- `GET /api/config` - All configuration parameters
- `POST /api/config` - Update configuration
- `GET /api/health` - Health check
- `POST /api/calibrate/distance` - Calibrate distance estimation

## WebSocket Events

### Outgoing (RPi → Frontend)

- `video_frame` - MJPEG video frame (base64 encoded)
- `tracking_data` - Marker detection results
- `motor_status` - Current motor speeds and state
- `telemetry` - System health metrics
- `alert` - System alerts and warnings

### Incoming (Frontend → RPi)

- `manual_control` - Manual control commands
- `mode_change` - Switch between manual/auto mode
- `auto_command` - Autonomous control commands
- `emergency_stop` - Emergency stop
- `settings_update` - Update configuration

## Marker Setup

The system tracks bright orange markers. Default HSV range:
- **Min**: [5, 200, 200]
- **Max**: [15, 255, 255]

Adjust in `config.py` if needed. Marker should be:
- 15cm wide (or update `KNOWN_MARKER_WIDTH_CM`)
- Bright orange color
- Visible in camera frame
- Range: 50cm - 300cm

## Distance Calibration

To improve distance estimation accuracy:

1. Place marker at known distances (e.g., 50cm, 100cm, 150cm, 200cm)
2. Record blob areas for each distance
3. Use calibration endpoint or update `DISTANCE_CALIBRATION_FACTOR` in config

## Performance Targets

- **Frame Processing**: 25-30 FPS
- **Video Streaming**: 15 FPS to frontend
- **Command Latency**: < 150ms
- **CPU Usage**: < 80%
- **CPU Temperature**: < 70°C

## Troubleshooting

### Camera Issues

- Verify camera enabled: `sudo raspi-config`
- Test with: `rpicam-hello`
- Check ribbon cable connection

### Motor Issues

- Test GPIO pins individually with LED
- Verify L298N power supply (7-12V)
- Check common ground connection
- Test motors with simple script first

### Tracking Issues

- Adjust HSV range in config.py
- Check lighting conditions
- Verify marker size and visibility
- Save HSV mask for visual inspection

### Performance Issues

- Check CPU temperature
- Reduce camera resolution if needed
- Optimize OpenCV operations
- Profile with cProfile

## Safety Notes

⚠️ **CRITICAL SAFETY REQUIREMENTS**

- Always test in open space first
- Keep emergency stop accessible
- Monitor for overheating
- Use proper power supply for motors (separate from RPi)
- Never run unsupervised
- Test thoroughly before deploying

## Logging

Logs are written to:
- **File**: `robot.log`
- **Console**: stdout

Log level can be changed in `config.py` (DEBUG, INFO, WARNING, ERROR).

## Auto-Start on Boot (Optional)

Create systemd service:

```bash
sudo nano /etc/systemd/system/robot-backend.service
```

```ini
[Unit]
Description=Robot Control Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/robot-backend/backend
ExecStart=/usr/bin/python3 main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable robot-backend.service
sudo systemctl start robot-backend.service
```

## Project Structure

```
backend/
├── main.py              # Entry point and orchestrator
├── config.py            # All configuration parameters
├── requirements.txt     # Python dependencies
├── README.md            # This file
└── modules/
    ├── __init__.py
    ├── camera.py        # Camera capture using picamera2
    ├── tracking.py      # Color detection and tracking
    ├── navigation.py    # PID controllers and state machine
    ├── motors.py        # GPIO motor control
    ├── server.py        # WebSocket + REST API
    └── telemetry.py     # System monitoring
```

## License

See LICENSE file in project root.



