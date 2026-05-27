"""
Collect and report system health metrics.
"""

import time
import logging
import psutil
import subprocess
from typing import Dict, Optional
from collections import deque

logger = logging.getLogger(__name__)


class TelemetryMonitor:
    """System telemetry monitor."""
    
    def __init__(self, thermal_limit: float):
        """
        Initialize telemetry monitor.
        
        Args:
            thermal_limit: CPU temperature limit in Celsius
        """
        self.thermal_limit = thermal_limit
        self.start_time = time.time()
        
        # FPS tracking
        self.processing_fps_history = deque(maxlen=30)
        self.streaming_fps_history = deque(maxlen=30)
        self.last_processing_time = time.time()
        self.last_streaming_time = time.time()
        self.processing_frame_count = 0
        self.streaming_frame_count = 0
        
        # Network stats
        self.last_bytes_sent = 0
        self.last_bytes_recv = 0
        self.total_bytes_sent = 0
        self.total_bytes_recv = 0
        
    def get_cpu_temperature(self) -> float:
        """
        Get CPU temperature in Celsius.
        
        Returns:
            CPU temperature
        """
        try:
            # Try reading from thermal zone
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp_millidegrees = int(f.read().strip())
                return temp_millidegrees / 1000.0
        except (FileNotFoundError, ValueError, IOError):
            try:
                # Try vcgencmd
                result = subprocess.run(
                    ['vcgencmd', 'measure_temp'],
                    capture_output=True,
                    text=True,
                    timeout=1.0
                )
                if result.returncode == 0:
                    temp_str = result.stdout.strip()
                    temp_value = float(temp_str.split('=')[1].split("'")[0])
                    return temp_value
            except (subprocess.TimeoutExpired, ValueError, IndexError, FileNotFoundError):
                pass
        
        # Fallback: estimate from CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)
        return 40.0 + (cpu_percent * 0.3)  # Rough estimate
    
    def get_cpu_usage(self) -> float:
        """
        Get CPU usage percentage.
        
        Returns:
            CPU usage (0-100)
        """
        return psutil.cpu_percent(interval=0.1)
    
    def get_ram_usage(self) -> Dict:
        """
        Get RAM usage information.
        
        Returns:
            Dictionary with RAM stats
        """
        mem = psutil.virtual_memory()
        return {
            'used_mb': mem.used / (1024 * 1024),
            'total_mb': mem.total / (1024 * 1024),
            'percent': mem.percent,
            'available_mb': mem.available / (1024 * 1024)
        }
    
    def get_network_stats(self) -> Dict:
        """
        Get network statistics.
        
        Returns:
            Dictionary with network stats
        """
        net_io = psutil.net_io_counters()
        
        bytes_sent = net_io.bytes_sent
        bytes_recv = net_io.bytes_recv
        
        sent_delta = bytes_sent - self.last_bytes_sent
        recv_delta = bytes_recv - self.last_bytes_recv
        
        self.last_bytes_sent = bytes_sent
        self.last_bytes_recv = bytes_recv
        
        return {
            'bytes_sent': bytes_sent,
            'bytes_recv': bytes_recv,
            'bytes_sent_delta': sent_delta,
            'bytes_recv_delta': recv_delta
        }
    
    def record_processing_frame(self) -> None:
        """Record a processed frame for FPS calculation."""
        self.processing_frame_count += 1
        current_time = time.time()
        elapsed = current_time - self.last_processing_time
        
        if elapsed >= 1.0:
            fps = self.processing_frame_count / elapsed
            self.processing_fps_history.append(fps)
            self.processing_frame_count = 0
            self.last_processing_time = current_time
    
    def record_streaming_frame(self) -> None:
        """Record a streamed frame for FPS calculation."""
        self.streaming_frame_count += 1
        current_time = time.time()
        elapsed = current_time - self.last_streaming_time
        
        if elapsed >= 1.0:
            fps = self.streaming_frame_count / elapsed
            self.streaming_fps_history.append(fps)
            self.streaming_frame_count = 0
            self.last_streaming_time = current_time
    
    def get_processing_fps(self) -> float:
        """
        Get average processing FPS.
        
        Returns:
            Average FPS over recent history
        """
        if not self.processing_fps_history:
            return 0.0
        return sum(self.processing_fps_history) / len(self.processing_fps_history)
    
    def get_streaming_fps(self) -> float:
        """
        Get average streaming FPS.
        
        Returns:
            Average FPS over recent history
        """
        if not self.streaming_fps_history:
            return 0.0
        return sum(self.streaming_fps_history) / len(self.streaming_fps_history)
    
    def collect_metrics(self) -> Dict:
        """
        Collect all telemetry metrics.
        
        Returns:
            Dictionary with all metrics
        """
        cpu_temp = self.get_cpu_temperature()
        cpu_usage = self.get_cpu_usage()
        ram_usage = self.get_ram_usage()
        network_stats = self.get_network_stats()
        uptime = time.time() - self.start_time
        
        # Check thermal limit
        thermal_warning = cpu_temp > self.thermal_limit
        
        if thermal_warning:
            logger.warning(f"CPU temperature ({cpu_temp:.1f}°C) exceeds limit ({self.thermal_limit}°C)")
        
        return {
            'cpu_temp': round(cpu_temp, 1),
            'cpu_usage': round(cpu_usage, 1),
            'ram_usage_mb': round(ram_usage['used_mb'], 1),
            'ram_total_mb': round(ram_usage['total_mb'], 1),
            'ram_percent': round(ram_usage['percent'], 1),
            'fps_processing': round(self.get_processing_fps(), 1),
            'fps_streaming': round(self.get_streaming_fps(), 1),
            'uptime_seconds': round(uptime, 1),
            'thermal_warning': thermal_warning,
            'network_bytes_sent': network_stats['bytes_sent'],
            'network_bytes_recv': network_stats['bytes_recv']
        }



