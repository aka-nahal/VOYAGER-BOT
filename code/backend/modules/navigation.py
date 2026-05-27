"""
State machine and PID controllers for autonomous person following.
Calculates motor commands based on marker position and distance.
"""

import time
import logging
from typing import Dict, Optional, Literal
from enum import Enum

logger = logging.getLogger(__name__)


class State(Enum):
    """Navigation state machine states."""
    IDLE = "idle"
    SEARCHING = "searching"
    LOCKED = "locked"
    FOLLOWING = "following"
    LOST = "lost"
    STOPPED = "stopped"


class PIDController:
    """Proportional-Integral-Derivative controller."""
    
    def __init__(self, kp: float, ki: float, kd: float, max_output: float):
        """
        Initialize PID controller.
        
        Args:
            kp: Proportional gain
            ki: Integral gain
            kd: Derivative gain
            max_output: Maximum output value
        """
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.max_output = max_output
        
        self.integral = 0.0
        self.prev_error = 0.0
        self.prev_time = time.time()
    
    def update(self, error: float, dt: Optional[float] = None) -> float:
        """
        Update PID controller with new error.
        
        Args:
            error: Current error value
            dt: Time delta in seconds (auto-calculated if None)
            
        Returns:
            PID output value
        """
        current_time = time.time()
        if dt is None:
            dt = current_time - self.prev_time
            if dt <= 0:
                dt = 0.01  # Minimum delta
        
        # Proportional term
        p_term = self.kp * error
        
        # Integral term
        self.integral += error * dt
        # Anti-windup: limit integral
        if self.max_output > 0:
            self.integral = max(-self.max_output, min(self.max_output, self.integral))
        i_term = self.ki * self.integral
        
        # Derivative term
        d_error = (error - self.prev_error) / dt if dt > 0 else 0.0
        d_term = self.kd * d_error
        
        # Calculate output
        output = p_term + i_term + d_term
        
        # Clamp output
        output = max(-self.max_output, min(self.max_output, output))
        
        # Update state
        self.prev_error = error
        self.prev_time = current_time
        
        return output
    
    def reset(self) -> None:
        """Reset PID controller state."""
        self.integral = 0.0
        self.prev_error = 0.0
        self.prev_time = time.time()


class NavigationController:
    """Navigation controller with state machine and PID control."""
    
    def __init__(self, config):
        """
        Initialize navigation controller.
        
        Args:
            config: Configuration module with all parameters
        """
        self.config = config
        self.mode: Literal['manual', 'auto'] = 'manual'
        self.state = State.IDLE
        
        # PID controllers
        self.centering_pid = PIDController(
            config.PID_CENTER_KP,
            config.PID_CENTER_KI,
            config.PID_CENTER_KD,
            config.PID_CENTER_MAX_OUTPUT
        )
        self.distance_pid = PIDController(
            config.PID_DISTANCE_KP,
            config.PID_DISTANCE_KI,
            config.PID_DISTANCE_KD,
            config.PID_DISTANCE_MAX_OUTPUT
        )
        
        # State tracking
        self.marker_detected_count = 0
        self.marker_lost_time: Optional[float] = None
        self.last_tracking_data: Optional[Dict] = None
        self.stable_detection_frames = 0
        self.last_motor_command: Optional[Dict] = None
        
        # Sideways movement tracking
        self.last_marker_x: Optional[float] = None
        self.last_marker_time: Optional[float] = None
        self.last_horizontal_velocity: Optional[float] = None
        
    def set_mode(self, mode: Literal['manual', 'auto']) -> None:
        """
        Set control mode.
        
        Args:
            mode: 'manual' or 'auto'
        """
        if mode != self.mode:
            logger.info(f"Mode changed: {self.mode} -> {mode}")
            self.mode = mode
            
            if mode == 'manual':
                self.set_state(State.IDLE)
                self.reset()
            elif mode == 'auto':
                self.set_state(State.SEARCHING)
    
    def set_state(self, state: State) -> None:
        """
        Set navigation state.
        
        Args:
            state: New state
        """
        if state != self.state:
            logger.info(f"State changed: {self.state.value} -> {state.value}")
            self.state = state
    
    def get_state(self) -> str:
        """
        Get current state as string.
        
        Returns:
            Current state name
        """
        return self.state.value
    
    def emergency_stop(self) -> None:
        """Trigger emergency stop."""
        self.set_state(State.STOPPED)
        self.reset()
        return {
            'left_speed': 0,
            'right_speed': 0,
            'timestamp': time.time()
        }
    
    def reset(self) -> None:
        """Reset navigation state."""
        self.centering_pid.reset()
        self.distance_pid.reset()
        self.marker_detected_count = 0
        self.marker_lost_time = None
        self.last_tracking_data = None
        self.stable_detection_frames = 0
        self.last_marker_x = None
        self.last_marker_time = None
        self.last_horizontal_velocity = None
    
    def update(self, tracking_data: Optional[Dict]) -> Dict:
        """
        Update navigation controller with tracking data.
        
        Args:
            tracking_data: Tracking data from ColorTracker
            
        Returns:
            Motor command dictionary
        """
        if self.mode != 'auto':
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': time.time()}
        
        if self.state == State.STOPPED:
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': time.time()}
        
        current_time = time.time()
        
        # Handle state transitions - lock onto marker quickly
        if tracking_data and tracking_data.get('detected'):
            # Marker detected - lock on immediately
            if self.state == State.SEARCHING:
                self.set_state(State.LOCKED)
                self.marker_detected_count = 1
                logger.info("🔒 Marker detected - locking on")
            elif self.state == State.LOCKED:
                self.marker_detected_count += 1
                # Lock faster - only need 2 frames instead of 3
                if self.marker_detected_count >= 2:
                    self.set_state(State.FOLLOWING)
                    logger.info("✅ Locked onto marker - starting to follow")
            elif self.state == State.FOLLOWING:
                self.marker_lost_time = None
            elif self.state == State.LOST:
                self.set_state(State.FOLLOWING)
                self.marker_lost_time = None
                logger.info("🔍 Marker found again - resuming follow")
        else:
            # Marker not detected
            if self.state == State.FOLLOWING:
                if self.marker_lost_time is None:
                    self.marker_lost_time = current_time
                elif current_time - self.marker_lost_time > self.config.MARKER_LOST_TIMEOUT:
                    self.set_state(State.LOST)
            elif self.state == State.LOCKED:
                self.set_state(State.SEARCHING)
            elif self.state == State.LOST:
                if current_time - self.marker_lost_time > 5.0:
                    self.set_state(State.SEARCHING)
        
        # Generate motor command based on state
        if self.state == State.SEARCHING:
            return self._search_behavior()
        elif self.state == State.LOCKED:
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': current_time}
        elif self.state == State.FOLLOWING:
            return self._following_behavior(tracking_data)
        elif self.state == State.LOST:
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': current_time}
        else:
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': current_time}
    
    def _search_behavior(self) -> Dict:
        """Generate motor command for search behavior - rotate left to find marker."""
        current_time = time.time()
        # Use "left" command pattern from frontend: (speed, speed) → turns left
        return {
            'left_speed': self.config.SEARCH_ROTATION_SPEED,
            'right_speed': self.config.SEARCH_ROTATION_SPEED,
            'timestamp': current_time
        }
    
    def _following_behavior(self, tracking_data: Optional[Dict]) -> Dict:
        """
        Generate motor command for following behavior.
        Based on FRIDAY robot approach: simple position-based control.
        
        Reference: https://github.com/farooqueesamiya/FRIDAY-The-Object-Following-Robot
        
        Args:
            tracking_data: Tracking data with marker position and distance
            
        Returns:
            Motor command dictionary
        """
        if not tracking_data or not tracking_data.get('detected'):
            # Reset sideways tracking when marker lost
            self.last_marker_x = None
            self.last_marker_time = None
            self.last_horizontal_velocity = None
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': time.time()}
        
        current_time = time.time()
        
        # Extract tracking data
        centroid = tracking_data.get('centroid')
        distance_cm = tracking_data.get('distance_cm')
        blob_area = tracking_data.get('blob_area', 0)
        
        if centroid is None or distance_cm is None:
            # Reset sideways tracking when invalid data
            self.last_marker_x = None
            self.last_marker_time = None
            self.last_horizontal_velocity = None
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': current_time}
        
        # Stop if reached target distance (20cm) - FRIDAY approach: stop when close enough
        if distance_cm <= self.config.MIN_SAFE_DISTANCE_CM:
            logger.info(f"✅ Reached target distance ({distance_cm:.1f}cm <= {self.config.MIN_SAFE_DISTANCE_CM}cm) - stopping")
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': current_time}
        
        # Ignore if too far
        if distance_cm > self.config.MAX_TRACKING_DISTANCE_CM:
            return {'left_speed': 0, 'right_speed': 0, 'timestamp': current_time}
        
        # FRIDAY approach: Divide frame into zones (left, center, right)
        # Based on object position, decide movement direction
        center_x = self.config.CAMERA_WIDTH / 2
        frame_width = self.config.CAMERA_WIDTH
        
        # Define zones (FRIDAY uses simple left/center/right zones)
        left_zone = frame_width * 0.4   # Left 40% of frame
        right_zone = frame_width * 0.6  # Right 40% of frame (center is 40-60%)
        
        marker_x = centroid[0]
        
        # Detect sideways movement (horizontal velocity)
        horizontal_velocity = 0.0
        sideways_movement_threshold = 50.0  # pixels per second threshold for sideways movement
        fast_sideways_threshold = 100.0  # pixels per second - object moving too fast, need faster response
        sudden_movement_threshold = 100.0  # pixels per second^2 threshold for sudden acceleration
        
        if self.last_marker_x is not None and self.last_marker_time is not None:
            dt = current_time - self.last_marker_time
            if dt > 0:
                dx = marker_x - self.last_marker_x
                horizontal_velocity = abs(dx / dt)  # pixels per second
        else:
            # Initialize tracking
            self.last_marker_x = marker_x
            self.last_marker_time = current_time
        
        # Detect sudden movement (acceleration)
        is_sudden_movement = False
        if self.last_horizontal_velocity is not None and self.last_marker_time is not None:
            dt = current_time - self.last_marker_time
            if dt > 0:
                acceleration = abs(horizontal_velocity - self.last_horizontal_velocity) / dt
                if acceleration > sudden_movement_threshold:
                    is_sudden_movement = True
                    logger.debug(f"Sudden movement detected: acceleration={acceleration:.1f} px/s²")
        
        # Update position tracking
        self.last_marker_x = marker_x
        self.last_marker_time = current_time
        self.last_horizontal_velocity = horizontal_velocity
        
        # FRIDAY approach: Calculate speed based on distance (blob area)
        # Larger blob = closer = slower speed, Smaller blob = farther = faster speed
        # Speed inversely proportional to blob area
        if blob_area > 0:
            # Normalize blob area to get speed (larger area = slower)
            # Use distance directly for speed calculation
            if distance_cm > 100:
                base_speed = 70
            elif distance_cm > 60:
                base_speed = 60
            elif distance_cm > 40:
                base_speed = 50
            elif distance_cm > 30:
                base_speed = 40
            elif distance_cm > 25:
                base_speed = 30
            else:
                base_speed = 20  # Very close, slow down
        else:
            base_speed = 50  # Default speed
        
        # Calculate steering adjustment based on how far from center
        center_x = self.config.CAMERA_WIDTH / 2
        error_x = marker_x - center_x  # Positive = right, Negative = left
        max_error = center_x  # Maximum possible error
        
        # Steering factor: 0.0 (no steering) to 0.5 (strong steering)
        # Increase max steering factor when object moving fast to allow sharper turns
        max_steering_factor = 0.5
        if horizontal_velocity > fast_sideways_threshold:
            max_steering_factor = 0.7  # Allow sharper steering when object moving fast
        steering_factor = min(max_steering_factor, abs(error_x) / max_error)
        
        # Increase turn angle when moving sideways (higher reduction = sharper turn, not spin)
        # Base reduction multiplier is 0.7, increase to 0.9 when sideways movement detected
        # Increase to 1.0 (maximum) when sudden movement detected for fastest turn
        # Increase to 1.2 (over-reduce) when object moving too fast to catch up
        reduction_multiplier = 0.7
        speed_boost = 1.0  # Multiplier for base speed
        
        if horizontal_velocity > fast_sideways_threshold:
            # Object moving too fast - need to turn faster to not lose it
            reduction_multiplier = 1.2  # Over-reduce one motor for fastest turn
            speed_boost = 1.3  # Increase base speed by 30% to move faster
            logger.debug(f"Fast sideways movement: velocity={horizontal_velocity:.1f} px/s, boosting speed and turn")
        elif is_sudden_movement:
            # Sudden movement - use maximum turn angle (reduce motor most) for fastest response
            reduction_multiplier = 1.0
            speed_boost = 1.2  # Increase speed slightly
            logger.debug(f"Sudden movement: velocity={horizontal_velocity:.1f} px/s, using maximum turn angle")
        elif horizontal_velocity > sideways_movement_threshold:
            # Frame moving sideways - use higher turn angle (reduce motor more)
            reduction_multiplier = 0.9
            logger.debug(f"Sideways movement detected: velocity={horizontal_velocity:.1f} px/s, using higher turn angle")
        
        # Apply speed boost to base speed before calculating motor speeds
        base_speed = int(base_speed * speed_boost)
        base_speed = min(base_speed, self.config.AUTO_MAX_SPEED)  # Don't exceed max speed limit
        
        # Use EXACT same motor control logic as frontend controls
        # Frontend control patterns (from server.py manual_control handler):
        # - forward: (-speed, speed) → goes forward
        # - backward: (speed, -speed) → goes backward  
        # - left: (speed, speed) → turns left
        # - right: (-speed, -speed) → turns right
        
        # For following: Always move FORWARD, but adjust steering based on marker position
        # When marker is LEFT → reduce left motor speed (turn left while moving forward)
        # When marker is RIGHT → reduce right motor speed (turn right while moving forward)
        # When marker is CENTER → go straight forward
        
        # Start with forward movement pattern: (-speed, speed)
        forward_left = -base_speed
        forward_right = base_speed
        
        if marker_x < left_zone:
            # Object on LEFT - reduce left motor speed to turn left while moving forward
            # forward_left becomes less negative (slower), forward_right stays same
            left_speed = int(forward_left * (1.0 - steering_factor * reduction_multiplier))  # Reduce left motor
            right_speed = forward_right
            command_type = "FORWARD_LEFT"
            logger.debug(f"LEFT zone: marker_x={marker_x:.0f}, error={error_x:.0f}, steering={steering_factor:.2f}, reduction={reduction_multiplier:.2f}")
        elif marker_x > right_zone:
            # Object on RIGHT - reduce right motor speed to turn right while moving forward
            # forward_right becomes less positive (slower), forward_left stays same
            left_speed = forward_left
            right_speed = int(forward_right * (1.0 - steering_factor * reduction_multiplier))  # Reduce right motor
            command_type = "FORWARD_RIGHT"
            logger.debug(f"RIGHT zone: marker_x={marker_x:.0f}, error={error_x:.0f}, steering={steering_factor:.2f}, reduction={reduction_multiplier:.2f}")
        else:
            # Object in CENTER - go straight forward
            left_speed = forward_left
            right_speed = forward_right
            command_type = "FORWARD"
            logger.debug(f"CENTER zone: marker_x={marker_x:.0f}, going straight")
        
        # Clamp speeds to valid range
        max_speed = self.config.AUTO_MAX_SPEED
        left_speed = max(-max_speed, min(max_speed, int(left_speed)))
        right_speed = max(-max_speed, min(max_speed, int(right_speed)))
        
        # Store command (NO SWAP - use direct values like frontend does)
        command = {
            'left_speed': int(left_speed),
            'right_speed': int(right_speed),
            'timestamp': current_time
        }
        
        logger.info(f"🎯 Following: marker_x={marker_x:.0f}, distance={distance_cm:.1f}cm, "
                   f"zone={command_type}, L={left_speed}, R={right_speed}")
        
        self.last_motor_command = command
        return command



