"""
CLI tool to test motors using backend motor controller.
Uses the same motor control system as the main backend.
"""

import sys
import os
import time
import logging

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import config
from modules.motors import MotorController

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def print_help():
    """Print command help."""
    print("\n" + "=" * 60)
    print("MOTOR CONTROL TEST - Using Backend Motor Controller")
    print("=" * 60)
    print("Movement:")
    print("  w / ↑  - Forward")
    print("  s / ↓  - Backward")
    print("  a / ←  - Turn left (rotate left)")
    print("  d / →  - Turn right (rotate right)")
    print("  q      - Turn left while moving forward")
    print("  e      - Turn right while moving forward")
    print("  z      - Turn left while moving backward")
    print("  c      - Turn right while moving backward")
    print("\nSpeed Control:")
    print("  1-9    - Set speed (10-90%, default 50%)")
    print("  0      - Set speed to 100%")
    print("\nOther:")
    print("  space  - Stop motors")
    print("  h      - Show this help")
    print("  x / q  - Exit")
    print("=" * 60 + "\n")


def get_key():
    """Get a single keypress (cross-platform)."""
    try:
        # Try Windows
        import msvcrt
        if msvcrt.kbhit():
            key = msvcrt.getch().decode('utf-8').lower()
            return key
    except (ImportError, UnicodeDecodeError):
        pass
    
    try:
        # Try Unix
        import tty
        import termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            key = sys.stdin.read(1).lower()
            return key
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    except (ImportError, OSError):
        pass
    
    # Fallback: read line
    return input().strip().lower()


def main():
    """Main CLI loop."""
    print("\n" + "=" * 60)
    print("RASPBERRY PI ROBOT - MOTOR HARDWARE TEST")
    print("Using Backend Motor Controller")
    print("=" * 60)
    
    print("\nInitializing motor controller...")
    print(f"GPIO Pins:")
    print(f"  Left Motor:  EN={config.LEFT_EN}, IN1={config.LEFT_IN1}, IN2={config.LEFT_IN2}")
    print(f"  Right Motor: EN={config.RIGHT_EN}, IN1={config.RIGHT_IN1}, IN2={config.RIGHT_IN2}")
    print(f"  PWM Frequency: {config.PWM_FREQUENCY} Hz")
    print()
    
    try:
        controller = MotorController(
            config.LEFT_EN,
            config.LEFT_IN1,
            config.LEFT_IN2,
            config.RIGHT_EN,
            config.RIGHT_IN1,
            config.RIGHT_IN2,
            config.PWM_FREQUENCY,
            config.WATCHDOG_TIMEOUT
        )
        print("✓ Motor controller initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize motor controller: {e}")
        sys.exit(1)
    
    speed = 50  # Default speed
    
    print_help()
    print(f"Current speed: {speed}%")
    print("Press a key to control motors (h for help, x to exit)\n")
    
    try:
        while True:
            key = get_key()
            
            if not key:
                continue
            
            if key == 'x' or key == '\x1b':  # x or ESC
                print("\nExiting...")
                break
            
            elif key == ' ' or key == '\r':  # Space or Enter
                controller.stop()
                print("STOPPED")
            
            elif key == 'h':
                print_help()
            
            elif key == 'w' or key == '\x48':  # w or Up arrow
                controller.set_speed(speed, speed)
                print(f"FORWARD (speed: {speed}%)")
            
            elif key == 's' or key == '\x50':  # s or Down arrow
                controller.set_speed(-speed, -speed)
                print(f"BACKWARD (speed: {speed}%)")
            
            elif key == 'a' or key == '\x4b':  # a or Left arrow
                controller.set_speed(-speed, speed)  # Rotate left
                print(f"ROTATE LEFT (speed: {speed}%)")
            
            elif key == 'd' or key == '\x4d':  # d or Right arrow
                controller.set_speed(speed, -speed)  # Rotate right
                print(f"ROTATE RIGHT (speed: {speed}%)")
            
            elif key == 'q':
                controller.set_speed(speed // 2, speed)  # Forward-left
                print(f"FORWARD-LEFT (speed: {speed}%)")
            
            elif key == 'e':
                controller.set_speed(speed, speed // 2)  # Forward-right
                print(f"FORWARD-RIGHT (speed: {speed}%)")
            
            elif key == 'z':
                controller.set_speed(-speed // 2, -speed)  # Backward-left
                print(f"BACKWARD-LEFT (speed: {speed}%)")
            
            elif key == 'c':
                controller.set_speed(-speed, -speed // 2)  # Backward-right
                print(f"BACKWARD-RIGHT (speed: {speed}%)")
            
            elif key.isdigit():
                speed_value = int(key)
                if speed_value == 0:
                    speed = 100
                else:
                    speed = speed_value * 10
                speed = max(10, min(100, speed))
                print(f"\nSpeed set to: {speed}%")
                # Apply current command with new speed if motors are running
                status = controller.get_status()
                if status['left_speed'] != 0 or status['right_speed'] != 0:
                    # Maintain direction, update speed
                    left_dir = 1 if status['left_speed'] >= 0 else -1
                    right_dir = 1 if status['right_speed'] >= 0 else -1
                    left_abs = abs(status['left_speed'])
                    right_abs = abs(status['right_speed'])
                    # Scale speeds proportionally
                    if left_abs > 0:
                        left_new = int(left_dir * speed * (left_abs / 100))
                    else:
                        left_new = 0
                    if right_abs > 0:
                        right_new = int(right_dir * speed * (right_abs / 100))
                    else:
                        right_new = 0
                    controller.set_speed(left_new, right_new)
            
            time.sleep(0.05)  # Small delay to prevent CPU spinning
    
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    
    finally:
        print("\nCleaning up...")
        controller.cleanup()
        print("Cleanup complete. Goodbye!")


if __name__ == "__main__":
    main()



