"""
GPIO-based motor control with differential steering.
Handles L298N motor driver communication.
"""

import time
import threading
import logging
from typing import Dict, Optional

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    logging.warning("RPi.GPIO not available - running in simulation mode")

logger = logging.getLogger(__name__)


class MotorController:
    """Motor controller for differential drive system."""
    
    def __init__(
        self,
        left_en: int,
        left_in1: int,
        left_in2: int,
        right_en: int,
        right_in1: int,
        right_in2: int,
        pwm_frequency: int,
        watchdog_timeout: float
    ):
        """
        Initialize motor controller.
        
        Args:
            left_en: Left motor PWM enable pin
            left_in1: Left motor direction control pin 1
            left_in2: Left motor direction control pin 2
            right_en: Right motor PWM enable pin
            right_in1: Right motor direction control pin 1
            right_in2: Right motor direction control pin 2
            pwm_frequency: PWM frequency in Hz
            watchdog_timeout: Watchdog timeout in seconds
        """
        self.left_en = left_en
        self.left_in1 = left_in1
        self.left_in2 = left_in2
        self.right_en = right_en
        self.right_in1 = right_in1
        self.right_in2 = right_in2
        self.pwm_frequency = pwm_frequency
        self.watchdog_timeout = watchdog_timeout
        
        self.pwm_left: Optional[object] = None
        self.pwm_right: Optional[object] = None
        self.current_left_speed = 0
        self.current_right_speed = 0
        self.target_left_speed = 0
        self.target_right_speed = 0
        self.last_command_time = time.time()
        self.watchdog_thread: Optional[threading.Thread] = None
        self.running = False
        self.lock = threading.Lock()
        
        if GPIO_AVAILABLE:
            self._initialize_gpio()
        else:
            logger.warning("Running in simulation mode - GPIO not available")
            # Initialize PWM objects as None for simulation
            self.pwm_left = None
            self.pwm_right = None
        
        # Always start watchdog - needed for ramping even in simulation
        self._start_watchdog()
        logger.info(f"MotorController initialized: GPIO={GPIO_AVAILABLE}, Watchdog timeout={watchdog_timeout}s")
    
    def _initialize_gpio(self) -> None:
        """Initialize GPIO pins and PWM."""
        if not GPIO_AVAILABLE:
            return
        
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # Setup left motor pins
            GPIO.setup(self.left_en, GPIO.OUT)
            GPIO.setup(self.left_in1, GPIO.OUT)
            GPIO.setup(self.left_in2, GPIO.OUT)
            
            # Setup right motor pins
            GPIO.setup(self.right_en, GPIO.OUT)
            GPIO.setup(self.right_in1, GPIO.OUT)
            GPIO.setup(self.right_in2, GPIO.OUT)
            
            # Initialize PWM
            self.pwm_left = GPIO.PWM(self.left_en, self.pwm_frequency)
            self.pwm_right = GPIO.PWM(self.right_en, self.pwm_frequency)
            
            # Start PWM at 0%
            self.pwm_left.start(0)
            self.pwm_right.start(0)
            
            # Initialize all pins to LOW
            GPIO.output(self.left_in1, GPIO.LOW)
            GPIO.output(self.left_in2, GPIO.LOW)
            GPIO.output(self.right_in1, GPIO.LOW)
            GPIO.output(self.right_in2, GPIO.LOW)
            
            logger.info("GPIO initialized successfully")
            
        except Exception as e:
            logger.error(f"GPIO initialization failed: {e}", exc_info=True)
            raise
    
    def _start_watchdog(self) -> None:
        """Start watchdog thread to monitor for timeout."""
        if self.watchdog_thread is not None:
            logger.warning("Watchdog thread already running")
            return
        
        self.running = True
        self.watchdog_thread = threading.Thread(target=self._watchdog_loop, daemon=True, name="MotorWatchdog")
        self.watchdog_thread.start()
        logger.info("Motor watchdog thread started")
    
    def _watchdog_loop(self) -> None:
        """Watchdog loop to stop motors on timeout and handle continuous ramping."""
        logger.info("Watchdog loop started")
        loop_count = 0
        while self.running:
            try:
                time.sleep(0.05)  # Update more frequently for smoother ramping
                loop_count += 1
                
                with self.lock:
                    # Continuous ramping to target speeds
                    if (self.current_left_speed != self.target_left_speed or 
                        self.current_right_speed != self.target_right_speed):
                        self._ramp_speeds()
                    
                    # Check for watchdog timeout
                    elapsed = time.time() - self.last_command_time
                    if elapsed > self.watchdog_timeout:
                        if self.current_left_speed != 0 or self.current_right_speed != 0:
                            logger.warning(f"Watchdog timeout ({elapsed:.2f}s) - stopping motors (target: L={self.target_left_speed}, R={self.target_right_speed}, current: L={self.current_left_speed}, R={self.current_right_speed})")
                            self.target_left_speed = 0
                            self.target_right_speed = 0
                            self._set_motor_speeds(0, 0, force=True)
                    
                    # Debug log every 100 loops (~5 seconds)
                    if loop_count % 100 == 0:
                        logger.debug(f"Watchdog: target(L={self.target_left_speed}, R={self.target_right_speed}), current(L={self.current_left_speed}, R={self.current_right_speed}), elapsed={elapsed:.2f}s")
                            
            except Exception as e:
                logger.error(f"Watchdog error: {e}", exc_info=True)
        
        logger.info("Watchdog loop stopped")
    
    def set_speed(self, left_speed: int, right_speed: int) -> None:
        """
        Set motor speeds with gradual ramping.
        
        Args:
            left_speed: Left motor speed (-100 to 100, negative = backward)
            right_speed: Right motor speed (-100 to 100, negative = backward)
        """
        with self.lock:
            # Clamp speeds
            left_speed = max(-100, min(100, int(left_speed)))
            right_speed = max(-100, min(100, int(right_speed)))
            
            # Log speed changes
            if (self.target_left_speed != left_speed or self.target_right_speed != right_speed):
                logger.info(f"⚙️ set_speed called: L={left_speed}, R={right_speed} (was L={self.target_left_speed}, R={self.target_right_speed})")
            
            self.target_left_speed = left_speed
            self.target_right_speed = right_speed
            self.last_command_time = time.time()
            
            # Initial ramp step (watchdog will continue ramping)
            self._ramp_speeds()
            
            logger.debug(f"After set_speed: target(L={self.target_left_speed}, R={self.target_right_speed}), current(L={self.current_left_speed}, R={self.current_right_speed})")
    
    def _ramp_speeds(self, acceleration_rate: int = 5) -> None:
        """Gradually ramp speeds to target."""
        # Calculate ramp direction
        left_diff = self.target_left_speed - self.current_left_speed
        right_diff = self.target_right_speed - self.current_right_speed
        
        # Apply acceleration/deceleration
        if abs(left_diff) > acceleration_rate:
            self.current_left_speed += acceleration_rate if left_diff > 0 else -acceleration_rate
        else:
            self.current_left_speed = self.target_left_speed
        
        if abs(right_diff) > acceleration_rate:
            self.current_right_speed += acceleration_rate if right_diff > 0 else -acceleration_rate
        else:
            self.current_right_speed = self.target_right_speed
        
        # Apply speeds to motors
        self._set_motor_speeds(self.current_left_speed, self.current_right_speed)
    
    def _set_motor_speeds(self, left_speed: int, right_speed: int, force: bool = False) -> None:
        """
        Apply speeds directly to motors.
        
        Args:
            left_speed: Left motor speed
            right_speed: Right motor speed
            force: If True, skip ramping and set directly
        """
        if force:
            self.current_left_speed = left_speed
            self.current_right_speed = right_speed
        
        if not GPIO_AVAILABLE:
            logger.info(f"Simulation: L={left_speed}, R={right_speed}")
            return
        
        try:
            # Left motor
            self._set_motor_direction(
                self.left_in1, self.left_in2, self.pwm_left, left_speed
            )
            
            # Right motor
            self._set_motor_direction(
                self.right_in1, self.right_in2, self.pwm_right, right_speed
            )
            
        except Exception as e:
            logger.error(f"Error setting motor speeds: {e}", exc_info=True)
            raise
    
    def _set_motor_direction(
        self,
        in1_pin: int,
        in2_pin: int,
        pwm: object,
        speed: int
    ) -> None:
        """
        Set motor direction and speed.
        
        Args:
            in1_pin: Direction control pin 1
            in2_pin: Direction control pin 2
            pwm: PWM object
            speed: Speed (-100 to 100)
        """
        if not GPIO_AVAILABLE:
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
    
    def stop(self) -> None:
        """Immediately stop all motors."""
        with self.lock:
            logger.info("Emergency stop activated")
            self.target_left_speed = 0
            self.target_right_speed = 0
            self._set_motor_speeds(0, 0, force=True)
    
    def cleanup(self) -> None:
        """Cleanup GPIO resources."""
        self.running = False
        
        if self.watchdog_thread is not None:
            self.watchdog_thread.join(timeout=1.0)
        
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
    
    def get_status(self) -> Dict:
        """
        Get current motor status.
        
        Returns:
            Dictionary with motor status
        """
        with self.lock:
            return {
                'left_speed': self.current_left_speed,
                'right_speed': self.current_right_speed,
                'target_left_speed': self.target_left_speed,
                'target_right_speed': self.target_right_speed,
                'last_command_time': self.last_command_time,
                'time_since_command': time.time() - self.last_command_time
            }



