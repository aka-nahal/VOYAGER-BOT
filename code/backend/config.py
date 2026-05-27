"""
Central configuration for all system parameters.
Make all values easily adjustable without code changes.
"""

# ===== CAMERA SETTINGS =====
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FPS = 30
STREAM_WIDTH = 480
STREAM_HEIGHT = 320
STREAM_FPS = 15
JPEG_QUALITY = 65

# ===== TRACKING SETTINGS =====
# Available tracking colors with HSV ranges
# Enhanced ranges for better detection in various lighting conditions
AVAILABLE_COLORS = {
    'orange': {
        'hsv_min': [3, 100, 100],        # Widened range for better detection
        'hsv_max': [25, 255, 255],
        'display_name': 'Orange',
        'emoji': '🟠'
    },
    'red': {
        'hsv_min': [0, 100, 80],          # Lowered thresholds for dimmer conditions
        'hsv_max': [10, 255, 255],
        'display_name': 'Red',
        'emoji': '🔴'
    },
    'red_wrap': {                         # Red wraps around in HSV (170-180)
        'hsv_min': [170, 100, 80],
        'hsv_max': [180, 255, 255],
        'display_name': 'Red (Dark)',
        'emoji': '🔴'
    },
    'blue': {
        'hsv_min': [95, 80, 60],          # Wider range for blue
        'hsv_max': [135, 255, 255],
        'display_name': 'Blue',
        'emoji': '🔵'
    },
    'green': {
        'hsv_min': [35, 60, 60],          # Enhanced green detection
        'hsv_max': [90, 255, 255],
        'display_name': 'Green',
        'emoji': '🟢'
    },
    'yellow': {
        'hsv_min': [20, 80, 80],          # Better yellow range
        'hsv_max': [40, 255, 255],
        'display_name': 'Yellow',
        'emoji': '🟡'
    },
    'purple': {
        'hsv_min': [125, 60, 60],         # Widened purple
        'hsv_max': [165, 255, 255],
        'display_name': 'Purple',
        'emoji': '🟣'
    },
    'pink': {
        'hsv_min': [145, 40, 80],         # Added pink color
        'hsv_max': [170, 255, 255],
        'display_name': 'Pink',
        'emoji': '🩷'
    },
    'cyan': {
        'hsv_min': [85, 60, 60],          # Added cyan color
        'hsv_max': [100, 255, 255],
        'display_name': 'Cyan',
        'emoji': '🩵'
    },
    'black': {
        'hsv_min': [0, 0, 0],
        'hsv_max': [180, 255, 50],        # Slightly increased for better detection
        'display_name': 'Black',
        'emoji': '⚫'
    },
    'white': {
        'hsv_min': [0, 0, 200],           # Added white color
        'hsv_max': [180, 30, 255],
        'display_name': 'White',
        'emoji': '⚪'
    },
    'brown': {
        'hsv_min': [5, 40, 20],           # Enhanced brown
        'hsv_max': [25, 220, 200],
        'display_name': 'Brown',
        'emoji': '🟤'
    }
}

# Default tracking color on startup
DEFAULT_TRACKING_COLOR = 'orange'

# Detection parameters
MIN_BLOB_AREA = 500          # Minimum pixels for valid marker
MAX_BLOB_AREA = 50000        # Maximum pixels (reject if too close)
MARKER_LOST_TIMEOUT = 3.0    # Seconds before declaring marker lost

# Distance estimation (calibrate these)
TARGET_DISTANCE_CM = 125     # Ideal following distance (not used when following to 20cm)
MIN_SAFE_DISTANCE_CM = 20    # Stop if closer than this (follow until 20cm)
MAX_TRACKING_DISTANCE_CM = 500  # Ignore if farther than this (increased for better tracking)

# Distance calculation constants (will be calibrated)
DISTANCE_CALIBRATION_FACTOR = 15000  # Adjust based on real measurements
KNOWN_MARKER_WIDTH_CM = 15   # Real-world marker width

# ===== MOTOR SETTINGS =====
# GPIO pins (DO NOT CHANGE - matches hardware wiring)
LEFT_EN = 23
LEFT_IN1 = 24
LEFT_IN2 = 25
RIGHT_EN = 17
RIGHT_IN1 = 27
RIGHT_IN2 = 22

# Motor parameters
PWM_FREQUENCY = 1000         # Hz
MAX_SPEED = 100              # Maximum PWM duty cycle (%)
MIN_OPERATIONAL_SPEED = 30   # Minimum speed to overcome friction
ACCELERATION_RATE = 5        # Speed increase per update (smooth ramping)
DECELERATION_RATE = 10       # Speed decrease per update

# Auto-follow mode limits
AUTO_MAX_SPEED = 80          # Safety limit in autonomous mode

# ===== PID CONTROLLER TUNING =====
# Centering controller (keep marker centered horizontally)
PID_CENTER_KP = 0.8
PID_CENTER_KI = 0.0
PID_CENTER_KD = 0.1
PID_CENTER_MAX_OUTPUT = 50   # Maximum steering adjustment

# Distance controller (maintain target distance)
PID_DISTANCE_KP = 0.5
PID_DISTANCE_KI = 0.0
PID_DISTANCE_KD = 0.05
PID_DISTANCE_MAX_OUTPUT = 40  # Maximum speed adjustment

# ===== NAVIGATION SETTINGS =====
# Search behavior (when marker lost)
SEARCH_ROTATION_SPEED = 30   # Slow rotation to find marker

# Following behavior
CENTER_DEADZONE = 30         # Pixels - ignore small centering errors
DISTANCE_DEADZONE = 10       # cm - ignore small distance errors

# ===== NETWORK SETTINGS =====
WEBSOCKET_HOST = "0.0.0.0"
WEBSOCKET_PORT = 8765
API_HOST = "0.0.0.0"
API_PORT = 8000

# ===== SAFETY SETTINGS =====
WATCHDOG_TIMEOUT = 0.5       # Stop motors if no command for this many seconds
CONNECTION_TIMEOUT = 5.0     # Stop if frontend disconnects
THERMAL_LIMIT = 75.0         # Throttle if CPU exceeds this temp (°C)
EMERGENCY_STOP_PRIORITY = True

# ===== TELEMETRY SETTINGS =====
TELEMETRY_UPDATE_RATE = 1.0  # Seconds between telemetry updates
LOG_LEVEL = "INFO"           # DEBUG, INFO, WARNING, ERROR
LOG_FILE = "robot.log"

# ===== THREADING SETTINGS =====
QUEUE_MAX_SIZE = 10          # Maximum frames in queues
THREAD_TIMEOUT = 1.0         # Seconds to wait for thread operations



