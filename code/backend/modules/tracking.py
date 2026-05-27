"""
Orange marker detection using OpenCV color tracking.
Fast, lightweight, reliable detection.
"""

import cv2
import numpy as np
import logging
from typing import Dict, Optional, Tuple
import math

logger = logging.getLogger(__name__)


class ColorTracker:
    """Color-based marker tracker with distance estimation."""
    
    def __init__(
        self,
        color_name: str,
        available_colors: dict,
        min_area: int,
        max_area: int,
        distance_calibration_factor: float,
        known_marker_width_cm: float
    ):
        """
        Initialize color tracker.
        
        Args:
            color_name: Initial color key (e.g., 'orange', 'blue')
            available_colors: Dictionary of available color configurations
            min_area: Minimum blob area in pixels
            max_area: Maximum blob area in pixels
            distance_calibration_factor: Calibration factor for distance estimation
            known_marker_width_cm: Known marker width in cm for calibration
        """
        self.available_colors = available_colors
        self.current_color = color_name
        
        # Set initial color (this will set self.hsv_min and self.hsv_max)
        if not self.set_color(color_name):
            # Fallback to first available color if invalid
            fallback = list(available_colors.keys())[0]
            logger.warning(f"Invalid color '{color_name}', using '{fallback}'")
            self.set_color(fallback)
        
        self.min_area = min_area
        self.max_area = max_area
        self.distance_calibration_factor = distance_calibration_factor
        self.known_marker_width_cm = known_marker_width_cm
        
        # Morphological kernels for noise removal (multiple sizes for better filtering)
        self.kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        self.kernel_medium = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        self.kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

        # Previous detection for stability check
        self.prev_centroid: Optional[Tuple[int, int]] = None
        self.stable_detections = 0

        # Enable advanced filtering options
        self.use_gaussian_blur = True
        self.use_bilateral_filter = False  # More expensive but preserves edges
        self.adaptive_threshold = False     # Future enhancement
    
    def set_color(self, color_name: str) -> bool:
        """
        Change tracking color dynamically.
        
        Args:
            color_name: Color key from available_colors dict
            
        Returns:
            True if color changed successfully, False if invalid color
        """
        if color_name not in self.available_colors:
            logger.error(f"❌ Invalid color: '{color_name}'. Available: {list(self.available_colors.keys())}")
            return False
        
        color_config = self.available_colors[color_name]
        self.hsv_min = np.array(color_config['hsv_min'])
        self.hsv_max = np.array(color_config['hsv_max'])
        self.current_color = color_name
        
        # Reset stability tracking when color changes
        self.prev_centroid = None
        self.stable_detections = 0
        
        logger.info(f"✓ Tracking color changed to: {color_config['display_name']} {color_config.get('emoji', '')}")
        return True
    
    def get_current_color(self) -> str:
        """
        Get current tracking color.
        
        Returns:
            Current color key (e.g., 'orange', 'blue')
        """
        return self.current_color
    
    def get_current_color_display_name(self) -> str:
        """
        Get display name of current color.
        
        Returns:
            Display name with emoji (e.g., '🟠 Orange')
        """
        color_config = self.available_colors.get(self.current_color, {})
        emoji = color_config.get('emoji', '')
        name = color_config.get('display_name', self.current_color)
        return f"{emoji} {name}" if emoji else name
        
    def detect(self, frame: np.ndarray) -> Dict:
        """
        Detect orange marker in frame.
        
        Args:
            frame: Input BGR frame
            
        Returns:
            Dictionary with detection results:
            {
                'detected': bool,
                'centroid': tuple[int, int] or None,
                'distance_cm': float or None,
                'confidence': float,
                'blob_area': int,
                'bounding_box': tuple[int, int, int, int] or None
            }
        """
        if frame is None or frame.size == 0:
            return self._empty_result()
        
        try:
            # Apply Gaussian blur to reduce noise before processing
            if self.use_gaussian_blur:
                frame = cv2.GaussianBlur(frame, (5, 5), 0)
            elif self.use_bilateral_filter:
                frame = cv2.bilateralFilter(frame, 9, 75, 75)

            # Convert BGR to HSV
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

            # Color threshold
            mask = cv2.inRange(hsv, self.hsv_min, self.hsv_max)

            # Enhanced morphological operations for better noise removal
            # 1. Small opening to remove tiny noise
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.kernel_small, iterations=1)
            # 2. Medium closing to fill small gaps
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.kernel_medium, iterations=2)
            # 3. Final opening with medium kernel to smooth boundaries
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.kernel_medium, iterations=1)
            # 4. Optional dilation to slightly expand the detected region
            mask = cv2.dilate(mask, self.kernel_small, iterations=1)
            
            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                self.prev_centroid = None
                self.stable_detections = 0
                return self._empty_result()
            
            # Filter contours by area
            valid_contours = [
                c for c in contours
                if self.min_area <= cv2.contourArea(c) <= self.max_area
            ]
            
            if not valid_contours:
                self.prev_centroid = None
                self.stable_detections = 0
                return self._empty_result()
            
            # Select largest contour (most likely to be the target object)
            # Reference repo approach: use largest blob as primary target
            largest_contour = max(valid_contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            
            # Calculate moments for centroid (reference: uses moments for accurate center)
            M = cv2.moments(largest_contour)
            if M["m00"] == 0:
                return self._empty_result()
            
            # Calculate centroid coordinates
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            centroid = (cx, cy)
            
            logger.debug(f"Detected {self.current_color}: centroid=({cx}, {cy}), area={area:.0f}px")
            
            # Calculate bounding box
            x, y, w, h = cv2.boundingRect(largest_contour)
            bounding_box = (x, y, w, h)
            
            # Estimate distance
            distance_cm = self._estimate_distance(area)
            
            # Calculate confidence
            confidence = self._calculate_confidence(area, largest_contour, centroid)
            
            # Check stability
            if self.prev_centroid is not None:
                distance_moved = math.sqrt(
                    (centroid[0] - self.prev_centroid[0])**2 +
                    (centroid[1] - self.prev_centroid[1])**2
                )
                if distance_moved < 50:  # Pixels
                    self.stable_detections += 1
                else:
                    self.stable_detections = 0
            else:
                self.stable_detections = 1
            
            self.prev_centroid = centroid
            
            return {
                'detected': True,
                'centroid': centroid,
                'distance_cm': distance_cm,
                'confidence': confidence,
                'blob_area': int(area),
                'bounding_box': bounding_box
            }
            
        except Exception as e:
            logger.error(f"Tracking error: {e}", exc_info=True)
            return self._empty_result()
    
    def _estimate_distance(self, blob_area: float) -> float:
        """
        Estimate distance from blob area.
        
        Args:
            blob_area: Blob area in pixels
            
        Returns:
            Estimated distance in cm
        """
        if blob_area <= 0:
            return 0.0
        
        # Simple inverse square relationship
        # distance = calibration_factor / sqrt(area)
        distance = self.distance_calibration_factor / math.sqrt(blob_area)
        
        return max(0.0, distance)
    
    def _calculate_confidence(
        self,
        area: float,
        contour: np.ndarray,
        centroid: Tuple[int, int]
    ) -> float:
        """
        Calculate detection confidence score.
        
        Args:
            area: Blob area
            contour: Detected contour
            centroid: Centroid coordinates
            
        Returns:
            Confidence score 0.0 to 1.0
        """
        confidence = 0.5  # Base confidence
        
        # Area-based confidence (prefer medium-sized blobs)
        if self.min_area <= area <= self.max_area:
            area_ratio = (area - self.min_area) / (self.max_area - self.min_area)
            # Prefer middle range
            if 0.3 <= area_ratio <= 0.7:
                confidence += 0.2
            else:
                confidence += 0.1
        
        # Circularity check
        perimeter = cv2.arcLength(contour, True)
        if perimeter > 0:
            circularity = 4 * math.pi * area / (perimeter * perimeter)
            if circularity > 0.7:  # More circular = more confident
                confidence += 0.2
            elif circularity > 0.5:
                confidence += 0.1
        
        # Stability bonus
        if self.stable_detections >= 3:
            confidence += 0.1
        
        return min(1.0, confidence)
    
    def _empty_result(self) -> Dict:
        """Return empty detection result."""
        return {
            'detected': False,
            'centroid': None,
            'distance_cm': None,
            'confidence': 0.0,
            'blob_area': 0,
            'bounding_box': None
        }
    
    def update_hsv_range(self, hsv_min: list[int], hsv_max: list[int]) -> None:
        """
        Update HSV color range.
        
        Args:
            hsv_min: New minimum HSV values
            hsv_max: New maximum HSV values
        """
        self.hsv_min = np.array(hsv_min)
        self.hsv_max = np.array(hsv_max)
        logger.info(f"HSV range updated: min={hsv_min}, max={hsv_max}")
    
    def calibrate_distance(
        self,
        known_distances: list[float],
        measured_areas: list[float]
    ) -> None:
        """
        Calibrate distance estimation using known measurements.

        Args:
            known_distances: List of known distances in cm
            measured_areas: List of corresponding blob areas in pixels
        """
        if len(known_distances) != len(measured_areas) or len(known_distances) < 2:
            logger.warning("Insufficient calibration data")
            return

        # Calculate calibration factor using least squares
        # distance = factor / sqrt(area)
        # factor = distance * sqrt(area)
        factors = [
            dist * math.sqrt(area)
            for dist, area in zip(known_distances, measured_areas)
        ]

        self.distance_calibration_factor = sum(factors) / len(factors)
        logger.info(f"Distance calibration updated: factor={self.distance_calibration_factor:.2f}")

    @staticmethod
    def extract_dominant_color_from_image(image_data: np.ndarray, num_clusters: int = 3) -> Dict:
        """
        Extract dominant color from an image using K-means clustering.

        Args:
            image_data: Image as numpy array (BGR format)
            num_clusters: Number of color clusters to find

        Returns:
            Dictionary with HSV ranges and BGR color:
            {
                'hsv_min': list[int],
                'hsv_max': list[int],
                'dominant_bgr': tuple[int, int, int],
                'dominant_hsv': tuple[int, int, int]
            }
        """
        try:
            # Resize image for faster processing
            height, width = image_data.shape[:2]
            max_dimension = 400
            if max(height, width) > max_dimension:
                scale = max_dimension / max(height, width)
                new_width = int(width * scale)
                new_height = int(height * scale)
                image_data = cv2.resize(image_data, (new_width, new_height))

            # Reshape image to be a list of pixels
            pixels = image_data.reshape(-1, 3).astype(np.float32)

            # Apply K-means clustering
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
            _, labels, centers = cv2.kmeans(pixels, num_clusters, None, criteria, 10, cv2.KMEANS_PP_CENTERS)

            # Find the most common cluster
            unique, counts = np.unique(labels, return_counts=True)
            dominant_cluster_idx = unique[np.argmax(counts)]
            dominant_color_bgr = centers[dominant_cluster_idx].astype(int)

            # Convert BGR to HSV
            bgr_pixel = np.uint8([[dominant_color_bgr]])
            hsv_pixel = cv2.cvtColor(bgr_pixel, cv2.COLOR_BGR2HSV)[0][0]

            # Create HSV range with tolerance
            h, s, v = hsv_pixel

            # Dynamic tolerance based on saturation and value
            h_tolerance = 15 if s > 50 else 20  # Wider range for less saturated colors
            s_tolerance = 40 if s > 100 else 60
            v_tolerance = 40 if v > 100 else 60

            # Calculate HSV min/max with bounds checking
            hsv_min = [
                max(0, h - h_tolerance),
                max(0, s - s_tolerance),
                max(0, v - v_tolerance)
            ]
            hsv_max = [
                min(180, h + h_tolerance),
                min(255, s + s_tolerance),
                min(255, v + v_tolerance)
            ]

            logger.info(f"Extracted dominant color: BGR={tuple(dominant_color_bgr)}, HSV={tuple(hsv_pixel)}")
            logger.info(f"HSV range: min={hsv_min}, max={hsv_max}")

            return {
                'hsv_min': hsv_min,
                'hsv_max': hsv_max,
                'dominant_bgr': tuple(dominant_color_bgr.tolist()),
                'dominant_hsv': tuple(hsv_pixel.tolist())
            }

        except Exception as e:
            logger.error(f"Error extracting dominant color: {e}", exc_info=True)
            # Return default orange color as fallback
            return {
                'hsv_min': [3, 100, 100],
                'hsv_max': [25, 255, 255],
                'dominant_bgr': (0, 127, 255),
                'dominant_hsv': (15, 255, 255)
            }

    def set_custom_color(self, hsv_min: list[int], hsv_max: list[int]) -> None:
        """
        Set custom HSV color range for tracking.

        Args:
            hsv_min: Minimum HSV values [H, S, V]
            hsv_max: Maximum HSV values [H, S, V]
        """
        self.hsv_min = np.array(hsv_min)
        self.hsv_max = np.array(hsv_max)
        self.current_color = 'custom'

        # Reset stability tracking
        self.prev_centroid = None
        self.stable_detections = 0

        logger.info(f"✓ Custom color set: HSV min={hsv_min}, max={hsv_max}")



