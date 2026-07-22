"""
Generate Android launcher icons from RoomiaPMSLogoSinFondo.png (valid copy in src/)
Also fixes the corrupted copy in public/ directory.
"""

from PIL import Image, ImageDraw
import os
import shutil
import sys

# Source logo (valid copy)
LOGO_PATH = os.path.join("public", "BlancoLogosSinFondo.PNG")

# Android res directory
RES_DIR = os.path.join("android", "app", "src", "main", "res")

# Icon sizes for each density
ICON_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Foreground sizes for adaptive icons (108dp * density)
FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def make_round_icon(img):
    """Create a circular version of the icon."""
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, (0, 0), mask)
    return result


def resize_with_padding(img, target_size, padding_ratio=0.1):
    """Resize image to fit within target_size with some padding, centered."""
    result = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    
    padding = int(target_size * padding_ratio)
    available = target_size - (2 * padding)
    
    logo = img.copy()
    logo.thumbnail((available, available), Image.Resampling.LANCZOS)
    
    x = (target_size - logo.size[0]) // 2
    y = (target_size - logo.size[1]) // 2
    
    result.paste(logo, (x, y), logo if logo.mode == "RGBA" else None)
    return result


def main():
    if not os.path.exists(LOGO_PATH):
        print(f"ERROR: Logo file not found at {LOGO_PATH}")
        sys.exit(1)
    
    # Load the source logo
    logo = Image.open(LOGO_PATH).convert("RGBA")
    print(f"Loaded logo: {logo.size[0]}x{logo.size[1]} from {LOGO_PATH}")
    
    # Fix the corrupted copy in public/
    print("\nFixing corrupted public/ copies...")
    shutil.copy2(LOGO_PATH, os.path.join("public", "RoomiaPMSLogoSinFondo.png"))
    shutil.copy2(LOGO_PATH, os.path.join("public", "favicon.png"))
    print("  Fixed public/RoomiaPMSLogoSinFondo.png")
    print("  Fixed public/favicon.png")
    
    # Clean up temp file if exists
    temp = os.path.join("public", "RoomiaPMSLogoSinFondo_fixed.png")
    if os.path.exists(temp):
        os.remove(temp)
    
    # Generate standard launcher icons
    print("\nGenerating launcher icons...")
    for density, size in ICON_SIZES.items():
        dir_path = os.path.join(RES_DIR, density)
        os.makedirs(dir_path, exist_ok=True)
        
        # ic_launcher.png - square icon with white background
        icon = resize_with_padding(logo, size, padding_ratio=0.05)
        icon_bg = Image.new("RGBA", (size, size), (7, 23, 38, 255))
        icon_bg.paste(icon, (0, 0), icon)
        icon_final = icon_bg.convert("RGB")
        icon_path = os.path.join(dir_path, "ic_launcher.png")
        icon_final.save(icon_path, "PNG")
        print(f"  {icon_path} ({size}x{size})")
        
        # ic_launcher_round.png - circular icon
        round_icon = make_round_icon(icon_bg)
        round_path = os.path.join(dir_path, "ic_launcher_round.png")
        round_icon.save(round_path, "PNG")
        print(f"  {round_path} ({size}x{size})")
    
    # Generate foreground for adaptive icons
    print("\nGenerating adaptive icon foregrounds...")
    for density, size in FOREGROUND_SIZES.items():
        dir_path = os.path.join(RES_DIR, density)
        os.makedirs(dir_path, exist_ok=True)
        
        # Adaptive icons clip ~18% from each side, place logo in safe zone
        fg = resize_with_padding(logo, size, padding_ratio=0.22)
        fg_path = os.path.join(dir_path, "ic_launcher_foreground.png")
        fg.save(fg_path, "PNG")
        print(f"  {fg_path} ({size}x{size})")
    
    print("\n[OK] All icons generated successfully!")


if __name__ == "__main__":
    main()
