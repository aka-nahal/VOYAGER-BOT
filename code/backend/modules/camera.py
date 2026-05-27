"""
Camera capture using picamera2 library.
Provides frames to both processing and streaming pipelines.
"""

import time
import threading
import queue
import logging
import numpy as np
from typing import Optional, Tuple
from picamera2 import Picamera2

logger = logging.getLogger(__name__)


class CameraCapture:
    """Camera capture handler with thread-safe frame access."""
    
    def __init__(self, width: int, height: int, fps: int):
        """
        Initialize camera capture.
        
        Args:
            width: Capture width in pixels
            height: Capture height in pixels
            fps: Target frames per second
        """
        self.width = width
        self.height = height
        self.fps = fps
        self.camera: Optional[Picamera2] = None
        self.running = False
        self.capture_thread: Optional[threading.Thread] = None
        self.frame_lock = threading.Lock()
        self.latest_frame: Optional[np.ndarray] = None
        self.frame_count = 0
        self.last_fps_time = time.time()
        self.current_fps = 0.0
        
    def start(self) -> bool:
        """
        Start camera capture.
        
        Returns:
            True if started successfully, False otherwise
        """
        try:
            self.camera = Picamera2()
            
            # Configure camera for video capture
            config = self.camera.create_video_configuration(
                main={"size": (self.width, self.height), "format": "RGB888"},
                controls={"FrameRate": self.fps}
            )
            self.camera.configure(config)
            self.camera.start()
            
            self.running = True
            self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
            self.capture_thread.start()
            
            logger.info(f"Camera started: {self.width}x{self.height} @ {self.fps} FPS")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start camera: {e}", exc_info=True)
            self.running = False
            return False
    
    def _capture_loop(self) -> None:
        """Internal capture loop running in separate thread."""
        while self.running:
            try:
                if self.camera is None:
                    break
                    
                # Capture frame
                frame = self.camera.capture_array()
                
                if frame is not None and frame.size > 0:
                    with self.frame_lock:
                        self.latest_frame = frame.copy()
                        self.frame_count += 1
                    
                    # Calculate FPS
                    current_time = time.time()
                    if current_time - self.last_fps_time >= 1.0:
                        self.current_fps = self.frame_count / (current_time - self.last_fps_time)
                        self.frame_count = 0
                        self.last_fps_time = current_time
                        logger.debug(f"Camera FPS: {self.current_fps:.1f}")
                
                # Maintain target FPS
                time.sleep(1.0 / self.fps)
                
            except Exception as e:
                logger.error(f"Camera capture error: {e}", exc_info=True)
                time.sleep(0.1)
                # Attempt to reconnect
                if self.running:
                    try:
                        if self.camera is not None:
                            self.camera.stop()
                        self.camera = Picamera2()
                        config = self.camera.create_video_configuration(
                            main={"size": (self.width, self.height), "format": "RGB888"},
                            controls={"FrameRate": self.fps}
                        )
                        self.camera.configure(config)
                        self.camera.start()
                        logger.info("Camera reconnected successfully")
                    except Exception as reconnect_error:
                        logger.error(f"Camera reconnection failed: {reconnect_error}")
    
    def get_frame(self) -> Optional[np.ndarray]:
        """
        Get latest frame (thread-safe).
        
        Returns:
            Latest frame as numpy array, or None if not available
        """
        with self.frame_lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None
    
    def stop(self) -> None:
        """Stop camera capture."""
        self.running = False
        
        if self.capture_thread is not None:
            self.capture_thread.join(timeout=2.0)
        
        if self.camera is not None:
            try:
                self.camera.stop()
                self.camera.close()
            except Exception as e:
                logger.error(f"Error stopping camera: {e}")
            finally:
                self.camera = None
        
        logger.info("Camera stopped")
    
    def is_running(self) -> bool:
        """
        Check if camera is running.
        
        Returns:
            True if running, False otherwise
        """
        return self.running and self.camera is not None
    
    def get_fps(self) -> float:
        """
        Get current capture FPS.
        
        Returns:
            Current FPS
        """
        return self.current_fps



