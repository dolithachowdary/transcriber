#!/usr/bin/env python3
"""
Setup script for Whisper Transcription Server
This script helps install dependencies and setup the server
"""

import subprocess
import sys
import os
import platform

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} detected")
    return True

def install_system_dependencies():
    """Install system-level dependencies"""
    system = platform.system().lower()
    
    if system == "darwin":  # macOS
        print("\n📦 Installing macOS dependencies...")
        commands = [
            "brew install ffmpeg",
            "brew install portaudio"
        ]
    elif system == "linux":
        print("\n📦 Installing Linux dependencies...")
        commands = [
            "sudo apt-get update",
            "sudo apt-get install -y ffmpeg",
            "sudo apt-get install -y portaudio19-dev python3-pyaudio"
        ]
    elif system == "windows":
        print("\n📦 Windows detected. Please ensure you have:")
        print("- FFmpeg installed and in PATH")
        print("- Visual Studio Build Tools or Visual Studio Community")
        return True
    else:
        print(f"⚠️  Unknown system: {system}")
        return True
    
    for cmd in commands:
        if not run_command(cmd, f"Running: {cmd}"):
            print(f"⚠️  Failed to run: {cmd}")
            print("Please install dependencies manually")
    
    return True

def create_virtual_environment():
    """Create and activate virtual environment"""
    if not os.path.exists("venv"):
        if not run_command("python -m venv venv", "Creating virtual environment"):
            return False
    
    # Activation command varies by OS
    if platform.system().lower() == "windows":
        activate_cmd = "venv\\Scripts\\activate"
    else:
        activate_cmd = "source venv/bin/activate"
    
    print(f"\n💡 To activate the virtual environment, run:")
    print(f"   {activate_cmd}")
    
    return True

def install_python_dependencies():
    """Install Python dependencies"""
    pip_cmd = "venv/bin/pip" if platform.system().lower() != "windows" else "venv\\Scripts\\pip"
    
    commands = [
        f"{pip_cmd} install --upgrade pip",
        f"{pip_cmd} install wheel setuptools",
        f"{pip_cmd} install torch torchaudio --index-url https://download.pytorch.org/whl/cpu",
        f"{pip_cmd} install -r requirements.txt"
    ]
    
    for cmd in commands:
        if not run_command(cmd, f"Running: {cmd}"):
            return False
    
    return True

def download_models():
    """Download required models"""
    print("\n🤖 Downloading Whisper models...")
    
    python_cmd = "venv/bin/python" if platform.system().lower() != "windows" else "venv\\Scripts\\python"
    
    download_script = '''
import whisper
print("Downloading Whisper base model...")
model = whisper.load_model("base")
print("Whisper model downloaded successfully!")
'''
    
    with open("download_models.py", "w") as f:
        f.write(download_script)
    
    success = run_command(f"{python_cmd} download_models.py", "Downloading Whisper models")
    
    # Cleanup
    if os.path.exists("download_models.py"):
        os.remove("download_models.py")
    
    return success

def create_start_script():
    """Create a start script for the server"""
    if platform.system().lower() == "windows":
        script_content = '''@echo off
echo Starting Whisper Transcription Server...
venv\\Scripts\\python whisper_server.py
pause
'''
        with open("start_server.bat", "w") as f:
            f.write(script_content)
        print("✅ Created start_server.bat")
    else:
        script_content = '''#!/bin/bash
echo "Starting Whisper Transcription Server..."
source venv/bin/activate
python whisper_server.py
'''
        with open("start_server.sh", "w") as f:
            f.write(script_content)
        os.chmod("start_server.sh", 0o755)
        print("✅ Created start_server.sh")

def main():
    """Main setup function"""
    print("🚀 Whisper Transcription Server Setup")
    print("=" * 40)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install system dependencies
    install_system_dependencies()
    
    # Create virtual environment
    if not create_virtual_environment():
        print("❌ Failed to create virtual environment")
        sys.exit(1)
    
    # Install Python dependencies
    if not install_python_dependencies():
        print("❌ Failed to install Python dependencies")
        sys.exit(1)
    
    # Download models
    if not download_models():
        print("⚠️  Failed to download models, but you can try running the server anyway")
    
    # Create start script
    create_start_script()
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Activate the virtual environment:")
    if platform.system().lower() == "windows":
        print("   venv\\Scripts\\activate")
        print("2. Start the server:")
        print("   python whisper_server.py")
        print("   OR double-click start_server.bat")
    else:
        print("   source venv/bin/activate")
        print("2. Start the server:")
        print("   python whisper_server.py")
        print("   OR ./start_server.sh")
    
    print("\n🌐 The server will run on: http://localhost:8765")
    print("📝 WebSocket endpoint: ws://localhost:8765/ws/transcribe")

if __name__ == "__main__":
    main()
