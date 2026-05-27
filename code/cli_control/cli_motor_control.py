"""
Simple CLI for manual motor control.
Controls motors via keyboard commands.
"""

import sys
import time
import logging
from typing import Optional

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("Warning: RPi.GPIO not available - running in simulation mode")

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class SimpleMotorController:
    """Simple motor controller for CLI."""
    
    def __init__(self):
        """Initialize motor controller."""
        # GPIO pins (matching backend config)
        self.LEFT_EN = 23
        self.LEFT_IN1 = 24
        self.LEFT_IN2 = 25
        self.RIGHT_EN = 17
        self.RIGHT_IN1 = 27
        self.RIGHT_IN2 = 22
        
        self.PWM_FREQUENCY = 1000
        
        self.pwm_left: Optional[object] = None
        self.pwm_right: Optional[object] = None
        self.current_left_speed = 0
        self.current_right_speed = 0
        
        if GPIO_AVAILABLE:
            self._initialize_gpio()
        else:
            logger.warning("Running in simulation mode")
    
    def _initialize_gpio(self) -> None:
        """Initialize GPIO pins."""
        if not GPIO_AVAILABLE:
            return
        
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # Setup left motor pins
            GPIO.setup(self.LEFT_EN, GPIO.OUT)
            GPIO.setup(self.LEFT_IN1, GPIO.OUT)
            GPIO.setup(self.LEFT_IN2, GPIO.OUT)
            
            # Setup right motor pins
            GPIO.setup(self.RIGHT_EN, GPIO.OUT)
            GPIO.setup(self.RIGHT_IN1, GPIO.OUT)
            GPIO.setup(self.RIGHT_IN2, GPIO.OUT)
            
            # Initialize PWM
            self.pwm_left = GPIO.PWM(self.LEFT_EN, self.PWM_FREQUENCY)
            self.pwm_right = GPIO.PWM(self.RIGHT_EN, self.PWM_FREQUENCY)
            
            # Start PWM at 0%
            self.pwm_left.start(0)
            self.pwm_right.start(0)
            
            # Initialize all pins to LOW
            GPIO.output(self.LEFT_IN1, GPIO.LOW)
            GPIO.output(self.LEFT_IN2, GPIO.LOW)
            GPIO.output(self.RIGHT_IN1, GPIO.LOW)
            GPIO.output(self.RIGHT_IN2, GPIO.LOW)
            
            logger.info("GPIO initialized successfully")
            
        except Exception as e:
            logger.error(f"GPIO initialization failed: {e}")
            raise
    
    def _set_motor(self, in1_pin: int, in2_pin: int, pwm: object, speed: int) -> None:
        """Set motor direction and speed."""
        if not GPIO_AVAILABLE:
            logger.info(f"Simulation: pin1={in1_pin}, pin2={in2_pin}, speed={speed}")
            return
        
        abs_speed = abs(speed)
        
        if speed > 0:  # Forward
            GPIO.output(in1_pin, GPIO.HIGH)
            GPIO.output(in2_pin, GPIO.LOW)
            pwm.ChangeDutyCycle(abs_speed)
        elif speed < 0:  # Backward
            GPIO.output(in1_pin, GPIO.LOW)
            GPIO.output(in2_pin, GPIO.HIGH)
            pwm.ChangeDutyCycle(abs_speed)
        else:  # Stop
            GPIO.output(in1_pin, GPIO.LOW)
            GPIO.output(in2_pin, GPIO.LOW)
            pwm.ChangeDutyCycle(0)
    
    def set_speed(self, left_speed: int, right_speed: int) -> None:
        """
        Set motor speeds.
        
        Args:
            left_speed: Left motor speed (-100 to 100)
            right_speed: Right motor speed (-100 to 100)
        """
        left_speed = max(-100, min(100, int(left_speed)))
        right_speed = max(-100, min(100, int(right_speed)))
        
        self.current_left_speed = left_speed
        self.current_right_speed = right_speed
        
        if GPIO_AVAILABLE:
            self._set_motor(self.LEFT_IN1, self.LEFT_IN2, self.pwm_left, left_speed)
            self._set_motor(self.RIGHT_IN1, self.RIGHT_IN2, self.pwm_right, right_speed)
        
        logger.info(f"Motors: L={left_speed:3d}, R={right_speed:3d}")
    
    def stop(self) -> None:
        """Stop all motors."""
        self.set_speed(0, 0)
        logger.info("Motors stopped")
    
    def cleanup(self) -> None:
        """Cleanup GPIO resources."""
        self.stop()
        
        if GPIO_AVAILABLE:
            try:
                if self.pwm_left is not None:
                    self.pwm_left.stop()
                if self.pwm_right is not None:
                    self.pwm_right.stop()
                GPIO.cleanup()
                logger.info("GPIO cleaned up")
            except Exception as e:
                logger.error(f"Error during GPIO cleanup: {e}")


def print_help():
    """Print command help."""
    print("\n" + "=" * 60)
    print("MOTOR CONTROL COMMANDS")
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
    print("RASPBERRY PI ROBOT - CLI MOTOR CONTROL")
    print("=" * 60)
    
    controller = SimpleMotorController()
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
            
            elif key == 'h':
                print_help()
            
            elif key == 'w' or key == '\x48':  # w or Up arrow
                controller.set_speed(speed, speed)
            
            elif key == 's' or key == '\x50':  # s or Down arrow
                controller.set_speed(-speed, -speed)
            
            elif key == 'a' or key == '\x4b':  # a or Left arrow
                controller.set_speed(-speed, speed)  # Rotate left
            
            elif key == 'd' or key == '\x4d':  # d or Right arrow
                controller.set_speed(speed, -speed)  # Rotate right
            
            elif key == 'q':
                controller.set_speed(speed // 2, speed)  # Forward-left
            
            elif key == 'e':
                controller.set_speed(speed, speed // 2)  # Forward-right
            
            elif key == 'z':
                controller.set_speed(-speed // 2, -speed)  # Backward-left
            
            elif key == 'c':
                controller.set_speed(-speed, -speed // 2)  # Backward-right
            
            elif key.isdigit():
                speed_value = int(key)
                if speed_value == 0:
                    speed = 100
                else:
                    speed = speed_value * 10
                speed = max(10, min(100, speed))
                print(f"\nSpeed set to: {speed}%")
            
            time.sleep(0.05)  # Small delay to prevent CPU spinning
    
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    
    finally:
        controller.cleanup()
        print("Cleanup complete. Goodbye!")


if __name__ == "__main__":
    main()



