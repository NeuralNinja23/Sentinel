import io
import mss
from PIL import Image
import cv2
import numpy as np

def calculate_mse(imageA, imageB):
    """Calculates the Mean Squared Error between two images."""
    err = np.sum((imageA.astype("float") - imageB.astype("float")) ** 2)
    err /= float(imageA.shape[0] * imageA.shape[1])
    return err

_last_frame_gray = None

def capture_primary_display(max_width: int = 1280, max_height: int = 720, min_diff_threshold: float = 50.0) -> bytes | None:
    """
    Captures the primary display. If the screen hasn't changed significantly since the last capture, 
    returns None. Otherwise, resizes and compresses it to JPEG bytes.
    """
    global _last_frame_gray
    
    with mss.MSS() as sct:
        # Monitor 1 is the primary monitor
        monitor = sct.monitors[1]
        sct_img = sct.grab(monitor)
        
        # Convert to numpy array for fast processing
        img_np = np.array(sct_img)
        
        # Convert to grayscale and shrink for blazing fast MSE comparison
        gray = cv2.cvtColor(img_np, cv2.COLOR_BGRA2GRAY)
        gray_small = cv2.resize(gray, (320, 180))
        
        if _last_frame_gray is not None:
            mse = calculate_mse(gray_small, _last_frame_gray)
            if mse < min_diff_threshold:
                # Screen hasn't changed enough, skip sending!
                return None
                
        # Save this frame as the new baseline
        _last_frame_gray = gray_small
        
        # Convert to PIL Image (mss returns BGRA)
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
        
        # Resize to maintain aspect ratio while fitting within max dimensions
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Compress and convert to JPEG bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=80)
        return img_byte_arr.getvalue()

if __name__ == "__main__":
    # Test execution
    print("Capturing frame 1...")
    jpeg1 = capture_primary_display()
    print("Frame 1:", "Sent!" if jpeg1 else "Skipped!")
    
    print("Capturing frame 2 (should be identical)...")
    jpeg2 = capture_primary_display()
    print("Frame 2:", "Sent!" if jpeg2 else "Skipped (Success!)")
