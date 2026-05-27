"""
Main entry point. Coordinates all modules and threads.
"""

import logging
import queue
import signal
import sys
import threading
import time
from typing import Optional

import cv2
import numpy as np

import config
from modules.camera import CameraCapture
from modules.tracking import ColorTracker
from modules.navigation import NavigationController
from modules.motors import MotorController
from modules.telemetry import TelemetryMonitor
from modules.server import CommunicationServer

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(config.LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


class RobotController:
    """Main robot controller orchestrating all modules."""
    
    def __init__(self):
        """Initialize robot controller."""
        self.running = False
        self.stop_event = threading.Event()
        
        # Initialize modules
        logger.info("Initializing modules...")
        self.camera = CameraCapture(
            config.CAMERA_WIDTH,
            config.CAMERA_HEIGHT,
            config.CAMERA_FPS
        )
        
        self.tracker = ColorTracker(
            config.DEFAULT_TRACKING_COLOR,
            config.AVAILABLE_COLORS,
            config.MIN_BLOB_AREA,
            config.MAX_BLOB_AREA,
            config.DISTANCE_CALIBRATION_FACTOR,
            config.KNOWN_MARKER_WIDTH_CM
        )
        logger.info(f"🎨 Tracker initialized: {self.tracker.get_current_color_display_name()}")
        
        self.navigator = NavigationController(config)
        
        self.motors = MotorController(
            config.LEFT_EN,
            config.LEFT_IN1,
            config.LEFT_IN2,
            config.RIGHT_EN,
            config.RIGHT_IN1,
            config.RIGHT_IN2,
            config.PWM_FREQUENCY,
            config.WATCHDOG_TIMEOUT
        )
        
        self.telemetry = TelemetryMonitor(config.THERMAL_LIMIT)
        
        self.server = CommunicationServer(
            config,
            self.telemetry,
            self.motors,
            self.navigator,
            self.tracker  # Add tracker reference for color changes
        )
        
        # Queues for inter-thread communication
        self.processing_queue = queue.Queue(maxsize=config.QUEUE_MAX_SIZE)
        self.streaming_queue = queue.Queue(maxsize=config.QUEUE_MAX_SIZE)
        
        # Threads
        self.threads: list[threading.Thread] = []
        
        # Frame counter
        self.frame_number = 0
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
    
    def start(self) -> None:
        """Start all system components."""
        logger.info("Starting robot controller...")
        
        try:
            # Start camera
            if not self.camera.start():
                raise RuntimeError("Failed to start camera")
            
            # Start server
            self.server.start()
            
            # Give server time to start
            time.sleep(1.0)
            
            # Start processing threads
            self.running = True
            self.stop_event.clear()
            
            self.threads.append(
                threading.Thread(target=self._processing_loop, daemon=True, name="Processing")
            )
            self.threads.append(
                threading.Thread(target=self._streaming_loop, daemon=True, name="Streaming")
            )
            self.threads.append(
                threading.Thread(target=self._telemetry_loop, daemon=True, name="Telemetry")
            )
            
            for thread in self.threads:
                thread.start()
            
            logger.info("Robot controller started successfully")
            
            # Main monitoring loop
            self._monitor_loop()
            
        except Exception as e:
            logger.error(f"Failed to start robot controller: {e}", exc_info=True)
            self.stop()
            raise
    
    def _processing_loop(self) -> None:
        """Main processing loop for tracking and navigation."""
        logger.info("Processing loop started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Get frame from camera
                frame = self.camera.get_frame()
                if frame is None:
                    time.sleep(0.01)
                    continue
                
                # Track marker
                tracking_data = self.tracker.detect(frame)
                
                # Update navigation (only in auto mode)
                if self.navigator.mode == 'auto':
                    motor_command = self.navigator.update(tracking_data)
                    if motor_command:
                        self.motors.set_speed(
                            motor_command['left_speed'],
                            motor_command['right_speed']
                        )
                
                # Send tracking data to server
                self.server.send_tracking_data(tracking_data)
                
                # Record processing frame
                self.telemetry.record_processing_frame()
                
                # Add frame to streaming queue (resize for streaming - RAW, no overlays)
                if not self.streaming_queue.full():
                    stream_frame = cv2.resize(
                        frame,
                        (config.STREAM_WIDTH, config.STREAM_HEIGHT)
                    )
                    # Send raw frame without any overlays
                    self.streaming_queue.put(stream_frame, timeout=0.1)
                
                # Maintain target FPS
                time.sleep(1.0 / config.CAMERA_FPS)
                
            except queue.Full:
                # Drop frame if queue full
                pass
            except Exception as e:
                logger.error(f"Processing loop error: {e}", exc_info=True)
                time.sleep(0.1)
    
    def _streaming_loop(self) -> None:
        """Streaming loop for sending video to frontend."""
        logger.info("Streaming loop started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Get frame from queue
                try:
                    frame = self.streaming_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                
                # Encode frame as JPEG
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), config.JPEG_QUALITY]
                _, jpeg_frame = cv2.imencode('.jpg', frame, encode_param)
                
                if jpeg_frame is not None:
                    # Send frame via WebSocket
                    self.server.send_video_frame(
                        jpeg_frame.tobytes(),
                        self.frame_number
                    )
                    self.frame_number += 1
                
                # Maintain target streaming FPS
                time.sleep(1.0 / config.STREAM_FPS)
                
            except Exception as e:
                logger.error(f"Streaming loop error: {e}", exc_info=True)
                time.sleep(0.1)
    
    def _telemetry_loop(self) -> None:
        """Telemetry update loop."""
        logger.info("Telemetry loop started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Send telemetry
                self.server.send_telemetry()
                
                # Send motor status
                motor_status = self.motors.get_status()
                self.server.send_motor_status(motor_status)
                
                # Check for thermal warnings
                metrics = self.telemetry.collect_metrics()
                if metrics.get('thermal_warning'):
                    self.server.send_alert(
                        'warning',
                        f"High CPU temperature: {metrics['cpu_temp']}°C"
                    )
                
                # Sleep until next update
                time.sleep(config.TELEMETRY_UPDATE_RATE)
                
            except Exception as e:
                logger.error(f"Telemetry loop error: {e}", exc_info=True)
                time.sleep(1.0)
    
    def _monitor_loop(self) -> None:
        """Main monitoring loop."""
        logger.info("Monitoring loop started")
        
        try:
            while self.running and not self.stop_event.is_set():
                # Check thread health
                for thread in self.threads:
                    if not thread.is_alive():
                        logger.error(f"Thread {thread.name} died unexpectedly")
                
                # Monitor for errors
                # (Additional monitoring can be added here)
                
                time.sleep(1.0)
                
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received")
        except Exception as e:
            logger.error(f"Monitor loop error: {e}", exc_info=True)
        finally:
            self.stop()
    
    def stop(self) -> None:
        """Stop all system components."""
        logger.info("Stopping robot controller...")
        
        self.running = False
        self.stop_event.set()
        
        # Stop motors immediately
        self.motors.stop()
        
        # Stop camera
        self.camera.stop()
        
        # Wait for threads to finish
        for thread in self.threads:
            thread.join(timeout=config.THREAD_TIMEOUT)
        
        # Cleanup motors
        self.motors.cleanup()
        
        # Stop server
        self.server.stop()
        
        logger.info("Robot controller stopped")


def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("Raspberry Pi 5 Robot Backend Starting")
    logger.info("=" * 60)
    
    controller = RobotController()
    
    try:
        controller.start()
    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("Shutdown complete")


if __name__ == "__main__":
    main()

