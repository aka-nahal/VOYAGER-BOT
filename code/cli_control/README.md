# CLI Motor Control

Command-line interface for testing motor hardware using the backend motor controller.

## Features

- **Uses Backend Code**: Reuses `backend/modules/motors.py` for actual hardware control
- **Keyboard Control**: Use WASD or arrow keys to control motors
- **Variable Speed**: Adjust speed from 10% to 100%
- **Hardware Testing**: Test GPIO connections and motor driver before running full backend
- **Same Configuration**: Uses same GPIO pins and settings as main backend

## Installation

### On Raspberry Pi

```bash
# Install backend dependencies first
cd backend
pip3 install -r requirements.txt

# Then run the test tool
cd ../cli_control
python3 test_motors.py
```

## Usage

```bash
cd cli_control
python3 test_motors.py
```

This uses the same motor controller as the backend, so you can test your hardware wiring before running the full system.

## Controls

### Movement
- **W / ↑** - Move forward
- **S / ↓** - Move backward
- **A / ←** - Rotate left (turn in place)
- **D / →** - Rotate right (turn in place)
- **Q** - Forward-left (arc turn)
- **E** - Forward-right (arc turn)
- **Z** - Backward-left (arc turn)
- **C** - Backward-right (arc turn)

### Speed Control
- **1-9** - Set speed to 10-90%
- **0** - Set speed to 100%

### Other
- **Space / Enter** - Stop motors
- **H** - Show help
- **X / ESC** - Exit

## Examples

```bash
# Start with default 50% speed
python3 cli_motor_control.py

# Press 'w' to move forward
# Press '9' to increase speed to 90%
# Press 'a' to turn left
# Press space to stop
# Press 'x' to exit
```

## Safety Notes

⚠️ **WARNING**
- Test in open space
- Start with low speeds (1-3)
- Be ready to press space for emergency stop
- Ensure motors are properly wired before running

## GPIO Pins Used

Same as main backend:
- **Left Motor**: EN=23, IN1=24, IN2=25
- **Right Motor**: EN=17, IN1=27, IN2=22

## Troubleshooting

### Motors don't respond
- Check GPIO wiring
- Verify L298N power supply (7-12V)
- Ensure common ground between RPi and L298N
- Check permissions: `sudo usermod -a -G gpio pi`

### Permission denied
```bash
sudo usermod -a -G gpio $USER
# Log out and back in
```

### Import errors
```bash
pip3 install RPi.GPIO
```

