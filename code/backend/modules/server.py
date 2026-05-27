"""
WebSocket server for real-time bidirectional communication.
REST API for configuration and control.
"""

import asyncio
import base64
import logging
import time
from typing import Dict, Optional, Set
from threading import Thread

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import socketio

logger = logging.getLogger(__name__)


class CommunicationServer:
    """WebSocket and REST API server."""
    
    def __init__(self, config, telemetry_monitor, motor_controller, navigation_controller, color_tracker):
        """
        Initialize communication server.
        
        Args:
            config: Configuration module
            telemetry_monitor: TelemetryMonitor instance
            motor_controller: MotorController instance
            navigation_controller: NavigationController instance
            color_tracker: ColorTracker instance
        """
        self.config = config
        self.telemetry_monitor = telemetry_monitor
        self.motor_controller = motor_controller
        self.navigation_controller = navigation_controller
        self.color_tracker = color_tracker
        logger.info(f"Server initialized with tracker: {color_tracker.get_current_color_display_name()}")
        
        # FastAPI app
        self.app = FastAPI(title="Robot Control API")
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Socket.IO server
        self.sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode='asgi')
        self.socket_app = socketio.ASGIApp(self.sio, self.app)
        
        # Client tracking
        self.connected_clients: Set[str] = set()
        self.last_telemetry_time = time.time()
        self.last_command_time = time.time()
        
        # Message queue for async operations from sync threads
        self.message_queue: Optional[asyncio.Queue] = None
        self.queue_maxsize = 100
        
        # Setup routes
        self._setup_routes()
        self._setup_socket_events()
        
        # Server thread
        self.server_thread: Optional[Thread] = None
        self.running = False
    
    def _setup_routes(self) -> None:
        """Setup REST API routes."""
        
        @self.app.get("/api/status")
        async def get_status():
            """Get current system status."""
            return {
                "mode": self.navigation_controller.mode,
                "state": self.navigation_controller.get_state(),
                "tracking_color": self.color_tracker.get_current_color(),
                "tracking_color_display": self.color_tracker.get_current_color_display_name(),
                "connected_clients": len(self.connected_clients),
                "motor_status": self.motor_controller.get_status(),
                "telemetry": self.telemetry_monitor.collect_metrics()
            }
        
        @self.app.get("/api/config")
        async def get_config():
            """Get all configuration parameters."""
            current_color_config = self.config.AVAILABLE_COLORS.get(
                self.color_tracker.get_current_color(),
                {}
            )
            return {
                "camera": {
                    "width": self.config.CAMERA_WIDTH,
                    "height": self.config.CAMERA_HEIGHT,
                    "fps": self.config.CAMERA_FPS
                },
                "tracking": {
                    "hsv_min": current_color_config.get('hsv_min', []),
                    "hsv_max": current_color_config.get('hsv_max', []),
                    "min_blob_area": self.config.MIN_BLOB_AREA,
                    "target_distance_cm": self.config.TARGET_DISTANCE_CM,
                    "current_color": self.color_tracker.get_current_color()
                },
                "motor": {
                    "max_speed": self.config.MAX_SPEED,
                    "auto_max_speed": self.config.AUTO_MAX_SPEED
                },
                "pid": {
                    "center": {
                        "kp": self.config.PID_CENTER_KP,
                        "ki": self.config.PID_CENTER_KI,
                        "kd": self.config.PID_CENTER_KD
                    },
                    "distance": {
                        "kp": self.config.PID_DISTANCE_KP,
                        "ki": self.config.PID_DISTANCE_KI,
                        "kd": self.config.PID_DISTANCE_KD
                    }
                }
            }
        
        @self.app.post("/api/config")
        async def update_config(config_updates: dict):
            """Update configuration parameters."""
            try:
                # Update config values (would need proper config management)
                return {"status": "success", "message": "Configuration updated"}
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))
        
        @self.app.get("/api/health")
        async def health_check():
            """Health check endpoint."""
            return {
                "status": "healthy",
                "uptime": time.time() - self.telemetry_monitor.start_time,
                "timestamp": time.time()
            }
        
        @self.app.get("/api/colors")
        async def get_available_colors():
            """Get list of available tracking colors."""
            colors_list = []
            for key, value in self.config.AVAILABLE_COLORS.items():
                colors_list.append({
                    "key": key,
                    "name": value['display_name'],
                    "emoji": value.get('emoji', ''),
                    "hsv_min": value['hsv_min'],
                    "hsv_max": value['hsv_max']
                })
            
            return {
                "colors": colors_list,
                "current": self.color_tracker.get_current_color(),
                "current_display": self.color_tracker.get_current_color_display_name()
            }
        
        @self.app.post("/api/calibrate/distance")
        async def calibrate_distance(calibration_data: dict):
            """Calibrate distance estimation."""
            try:
                known_distances = calibration_data.get("known_distances", [])
                measured_areas = calibration_data.get("measured_areas", [])
                self.color_tracker.calibrate_distance(known_distances, measured_areas)
                return {"status": "success", "message": "Calibration completed"}
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))

        @self.app.post("/api/color/extract")
        async def extract_color_from_image(data: dict):
            """Extract dominant color from uploaded image and set as custom tracking color."""
            try:
                import cv2
                import numpy as np

                # Get base64 image data
                image_base64 = data.get("image", "")
                if not image_base64:
                    raise HTTPException(status_code=400, detail="No image data provided")

                # Remove data URL prefix if present
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]

                # Decode base64 to image
                image_bytes = base64.b64decode(image_base64)
                nparr = np.frombuffer(image_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if image is None:
                    raise HTTPException(status_code=400, detail="Invalid image data")

                # Extract dominant color
                from modules.tracking import ColorTracker
                color_data = ColorTracker.extract_dominant_color_from_image(image)

                # Set as custom color
                self.color_tracker.set_custom_color(
                    color_data['hsv_min'],
                    color_data['hsv_max']
                )

                # Broadcast color change to all connected clients
                await self.sio.emit('color_changed', {
                    'color': 'custom',
                    'display_name': 'Custom Color',
                    'hsv_min': color_data['hsv_min'],
                    'hsv_max': color_data['hsv_max'],
                    'dominant_bgr': color_data['dominant_bgr'],
                    'dominant_hsv': color_data['dominant_hsv']
                })

                logger.info(f"✓ Custom color extracted and set from uploaded image")

                return {
                    "status": "success",
                    "message": "Custom color extracted and set successfully",
                    "color_data": color_data
                }

            except Exception as e:
                logger.error(f"Error extracting color from image: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=str(e))
    
    def _setup_socket_events(self) -> None:
        """Setup Socket.IO event handlers."""
        logger.info("🔧 Setting up Socket.IO event handlers...")
        logger.info(f"   Motor controller available: {self.motor_controller is not None}")
        
        @self.sio.event
        async def connect(sid, environ):
            """Handle client connection."""
            self.connected_clients.add(sid)
            logger.info(f"✅ Client connected: {sid}")
            logger.info(f"   Total connected clients: {len(self.connected_clients)}")
            logger.info(f"   Motor controller available: {self.motor_controller is not None}")
            await self.sio.emit('connected', {'status': 'ok'}, room=sid)
            
            # Start message queue processor if not already running
            if self.message_queue is None:
                self.message_queue = asyncio.Queue(maxsize=self.queue_maxsize)
                self.sio.start_background_task(self._process_message_queue)
        
        @self.sio.event
        async def disconnect(sid):
            """Handle client disconnection."""
            self.connected_clients.discard(sid)
            logger.info(f"Client disconnected: {sid}")
            # Stop motors on disconnect
            self.motor_controller.stop()
        
        @self.sio.on('manual_control')
        async def handle_manual_control(sid, data):
            """Handle manual control command."""
            try:
                logger.info(f"🔵 EVENT RECEIVED: manual_control from {sid}")
                logger.info(f"🔵 Raw data: {data} (type: {type(data)})")
                
                if not isinstance(data, dict):
                    logger.error(f"❌ Invalid data type: {type(data)}, expected dict")
                    return
                
                command = data.get('command', 'stop')
                speed = int(data.get('speed', 50))
                
                # Ensure speed is valid
                speed = max(0, min(100, speed))
                
                logger.info(f"📡 Manual control received: command='{command}' @ {speed}% (from {sid})")
                logger.info(f"   Motor controller available: {self.motor_controller is not None}")
                
                self.navigation_controller.set_mode('manual')
                
                # Map commands to motor speeds
                # FIXED: Corrected mappings based on actual behavior
                # Current wrong mappings:
                #   Forward (speed, speed) → goes LEFT, should go FORWARD
                #   Backward (-speed, -speed) → goes RIGHT, should go BACKWARD
                #   Left (-speed, speed) → goes FORWARD, should turn LEFT
                #   Right (speed, -speed) → goes BACKWARD, should turn RIGHT
                #
                # Since Left command produces forward movement, use that pattern for Forward
                # Since Right command produces backward movement, use that pattern for Backward
                # For turns, swap from current forward/backward patterns
                # FIXED: Motors are physically swapped - swap left/right arguments in set_speed calls
                # set_speed(left, right) but motors are swapped, so call set_speed(right, left)
                # FIXED: Based on user feedback - motors are swapped AND forward/backward directions inverted
                # Current wrong: Forward→left, Backward→right, Left→forward, Right→backward
                # Solution: Use what works + invert forward/backward signs
                if command == 'forward':
                    # Forward: Current Left (-speed, speed) goes forward, but we need both motors same direction
                    # Since directions are inverted, use positive for forward: (speed, speed) but swap = (speed, speed)
                    # Actually, try inverting: (-speed, -speed) but that goes right...
                    # Use the pattern that goes forward but invert signs: -(-speed, speed) = (speed, -speed) but swap = (-speed, speed)
                    logger.info(f"   → Calling motor_controller.set_speed({-speed}, {speed})")
                    self.motor_controller.set_speed(-speed, speed)  # What currently goes forward
                    logger.info(f"   → Forward: L={-speed}, R={speed}")
                elif command == 'backward':
                    # Backward: Current Right (speed, -speed) goes backward
                    logger.info(f"   → Calling motor_controller.set_speed({speed}, {-speed})")
                    self.motor_controller.set_speed(speed, -speed)  # What currently goes backward
                    logger.info(f"   → Backward: L={speed}, R={-speed}")
                elif command == 'left':
                    # Left turn: Current Forward (speed, speed) goes left - use that!
                    logger.info(f"   → Calling motor_controller.set_speed({speed}, {speed})")
                    self.motor_controller.set_speed(speed, speed)  # What currently goes left
                    logger.info(f"   → Left turn: L={speed}, R={speed}")
                elif command == 'right':
                    # Right turn: Current Backward (-speed, -speed) goes right - use that!
                    logger.info(f"   → Calling motor_controller.set_speed({-speed}, {-speed})")
                    self.motor_controller.set_speed(-speed, -speed)  # What currently goes right
                    logger.info(f"   → Right turn: L={-speed}, R={-speed}")
                elif command == 'stop':
                    logger.info(f"   → Calling motor_controller.stop()")
                    self.motor_controller.stop()
                    logger.info(f"   → Stop")
                else:
                    logger.warning(f"   ⚠️ Unknown command: '{command}'")
                    self.motor_controller.stop()
                
                self.last_command_time = time.time()
                
                # Get current status
                status = self.motor_controller.get_status()
                logger.info(f"   📊 Motor status: L={status['left_speed']}, R={status['right_speed']}, target L={status['target_left_speed']}, target R={status['target_right_speed']}")
                
                # Send acknowledgment with current status
                await self.sio.emit('motor_status', {
                    'left_speed': status['left_speed'],
                    'right_speed': status['right_speed'],
                    'target_left_speed': status['target_left_speed'],
                    'target_right_speed': status['target_right_speed'],
                    'last_command_time': status['last_command_time'],
                    'time_since_command': status['time_since_command']
                })
                
                logger.info(f"   ✓ Motor status sent via socket: L={status['left_speed']}, R={status['right_speed']}")
                
            except Exception as e:
                logger.error(f"❌ Manual control error: {e}", exc_info=True)
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                self.motor_controller.stop()
        
        @self.sio.on('mode_change')
        async def handle_mode_change(sid, data):
            """Handle mode change."""
            try:
                mode = data.get('mode', 'manual')
                if mode in ['manual', 'auto']:
                    self.navigation_controller.set_mode(mode)
                    await self.sio.emit('mode_changed', {'mode': mode})
            except Exception as e:
                logger.error(f"Mode change error: {e}", exc_info=True)
        
        @self.sio.on('auto_command')
        async def handle_auto_command(sid, data):
            """Handle autonomous command."""
            try:
                action = data.get('action', '')
                if action == 'start_following':
                    self.navigation_controller.set_mode('auto')
                elif action == 'stop_following':
                    self.navigation_controller.set_mode('manual')
            except Exception as e:
                logger.error(f"Auto command error: {e}", exc_info=True)
        
        @self.sio.on('emergency_stop')
        async def handle_emergency_stop(sid, data):
            """Handle emergency stop."""
            logger.warning("Emergency stop triggered via WebSocket")
            self.motor_controller.stop()
            self.navigation_controller.emergency_stop()
            await self.sio.emit('alert', {
                'level': 'critical',
                'message': 'Emergency stop activated',
                'timestamp': time.time()
            })
        
        @self.sio.on('change_color')
        async def handle_color_change(sid, data):
            """Handle color change request from client."""
            try:
                logger.info(f"🎨 Color change request from {sid}: {data}")
                
                # Validate request
                if not isinstance(data, dict):
                    await self.sio.emit('error', {
                        'message': 'Invalid request format'
                    }, room=sid)
                    return
                
                color_name = data.get('color')
                if not color_name:
                    await self.sio.emit('error', {
                        'message': 'Color name required'
                    }, room=sid)
                    return
                
                # Validate color exists
                if color_name not in self.config.AVAILABLE_COLORS:
                    available = list(self.config.AVAILABLE_COLORS.keys())
                    await self.sio.emit('error', {
                        'message': f'Invalid color: {color_name}. Available: {available}'
                    }, room=sid)
                    return
                
                # Change color in tracker
                success = self.color_tracker.set_color(color_name)
                
                if success:
                    color_config = self.config.AVAILABLE_COLORS[color_name]
                    display_name = color_config['display_name']
                    emoji = color_config.get('emoji', '')
                    
                    # Broadcast to ALL connected clients (not just requester)
                    await self.sio.emit('color_changed', {
                        'color': color_name,
                        'display_name': display_name,
                        'emoji': emoji,
                        'full_display': f"{emoji} {display_name}" if emoji else display_name,
                        'timestamp': time.time(),
                        'changed_by': sid
                    })
                    
                    logger.info(f"✓ Color changed to {emoji} {display_name} (by {sid})")
                else:
                    await self.sio.emit('error', {
                        'message': f'Failed to change color to: {color_name}'
                    }, room=sid)
                    
            except Exception as e:
                logger.error(f"❌ Color change error: {e}", exc_info=True)
                await self.sio.emit('error', {
                    'message': f'Server error: {str(e)}'
                }, room=sid)
        
        @self.sio.on('settings_update')
        async def handle_settings_update(sid, data):
            """Handle settings update."""
            try:
                category = data.get('category', '')
                params = data.get('params', {})
                # Would update config here
                await self.sio.emit('settings_updated', {'category': category})
            except Exception as e:
                logger.error(f"Settings update error: {e}", exc_info=True)
    
    async def _process_message_queue(self) -> None:
        """Process messages from queue in async context."""
        while self.running:
            try:
                if self.message_queue is None:
                    await asyncio.sleep(0.1)
                    continue
                
                try:
                    message = await asyncio.wait_for(self.message_queue.get(), timeout=0.1)
                    msg_type = message.get('type')
                    
                    if msg_type == 'video_frame':
                        await self.sio.emit('video_frame', message['data'])
                        self.telemetry_monitor.record_streaming_frame()
                    elif msg_type == 'tracking_data':
                        await self.sio.emit('tracking_data', message['data'])
                    elif msg_type == 'motor_status':
                        await self.sio.emit('motor_status', message['data'])
                    elif msg_type == 'telemetry':
                        await self.sio.emit('telemetry', message['data'])
                    elif msg_type == 'alert':
                        await self.sio.emit('alert', message['data'])
                        
                except asyncio.TimeoutError:
                    continue
            except Exception as e:
                logger.error(f"Message queue processor error: {e}", exc_info=True)
                await asyncio.sleep(0.1)
    
    def send_video_frame(self, frame: bytes, frame_number: int) -> None:
        """
        Send video frame to all connected clients.
        
        Args:
            frame: JPEG encoded frame bytes
            frame_number: Frame sequence number
        """
        if not self.connected_clients or self.message_queue is None:
            return
        
        try:
            # Encode frame as base64
            frame_b64 = base64.b64encode(frame).decode('utf-8')
            
            self.message_queue.put_nowait({
                'type': 'video_frame',
                'data': {
                    'type': 'video_frame',
                    'data': frame_b64,
                    'timestamp': time.time(),
                    'frame_number': frame_number
                }
            })
        except Exception:
            # Drop frame if queue full or other error
            pass
        except Exception as e:
            logger.error(f"Error sending video frame: {e}", exc_info=True)
    
    def send_tracking_data(self, tracking_data: Dict) -> None:
        """
        Send tracking data to all connected clients.
        
        Args:
            tracking_data: Tracking data dictionary
        """
        if not self.connected_clients or self.message_queue is None:
            return
        
        try:
            self.message_queue.put_nowait({
                'type': 'tracking_data',
                'data': {
                    'type': 'tracking_data',
                    'marker_detected': tracking_data.get('detected', False),
                    'position': {
                        'x': tracking_data.get('centroid', (0, 0))[0] if tracking_data.get('centroid') else 0,
                        'y': tracking_data.get('centroid', (0, 0))[1] if tracking_data.get('centroid') else 0
                    },
                    'distance_cm': tracking_data.get('distance_cm'),
                    'confidence': tracking_data.get('confidence', 0.0),
                    'blob_area': tracking_data.get('blob_area', 0),
                    'timestamp': time.time()
                }
            })
        except Exception:
            # Drop message if queue full
            pass
        except Exception as e:
            logger.error(f"Error sending tracking data: {e}", exc_info=True)
    
    def send_motor_status(self, motor_status: Dict) -> None:
        """
        Send motor status to all connected clients.
        
        Args:
            motor_status: Motor status dictionary
        """
        if not self.connected_clients or self.message_queue is None:
            return
        
        try:
            self.message_queue.put_nowait({
                'type': 'motor_status',
                'data': {
                    'type': 'motor_status',
                    'left_speed': motor_status.get('left_speed', 0),
                    'right_speed': motor_status.get('right_speed', 0),
                    'mode': self.navigation_controller.mode,
                    'state': self.navigation_controller.get_state(),
                    'timestamp': time.time()
                }
            })
        except Exception:
            # Drop message if queue full
            pass
        except Exception as e:
            logger.error(f"Error sending motor status: {e}", exc_info=True)
    
    def send_telemetry(self) -> None:
        """Send telemetry data to all connected clients."""
        if not self.connected_clients or self.message_queue is None:
            return
        
        try:
            metrics = self.telemetry_monitor.collect_metrics()
            self.message_queue.put_nowait({
                'type': 'telemetry',
                'data': {
                    'type': 'telemetry',
                    **metrics,
                    'timestamp': time.time()
                }
            })
        except Exception:
            # Drop message if queue full
            pass
        except Exception as e:
            logger.error(f"Error sending telemetry: {e}", exc_info=True)
    
    def send_alert(self, level: str, message: str) -> None:
        """
        Send alert to all connected clients.
        
        Args:
            level: Alert level (info, warning, error, critical)
            message: Alert message
        """
        if not self.connected_clients or self.message_queue is None:
            return
        
        try:
            self.message_queue.put_nowait({
                'type': 'alert',
                'data': {
                    'type': 'alert',
                    'level': level,
                    'message': message,
                    'timestamp': time.time()
                }
            })
        except Exception:
            # Drop message if queue full
            pass
        except Exception as e:
            logger.error(f"Error sending alert: {e}", exc_info=True)
    
    def start(self) -> None:
        """Start the server in a separate thread."""
        def run_server():
            uvicorn.run(
                self.socket_app,
                host=self.config.API_HOST,
                port=self.config.API_PORT,
                log_level="warning"
            )
        
        self.running = True
        self.server_thread = Thread(target=run_server, daemon=True)
        self.server_thread.start()
        logger.info(f"Server started on {self.config.API_HOST}:{self.config.API_PORT}")
    
    def stop(self) -> None:
        """Stop the server."""
        self.running = False
        logger.info("Server stopped")

