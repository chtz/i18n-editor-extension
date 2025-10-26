#!/bin/bash
# install-native.bash - Install native messaging host for i18n Editor Extension

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 i18n Editor Extension - Native Host Installer${NC}"
echo "=================================================="

# Get absolute path to extension directory
EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NATIVE_HOST_JS="$EXT_DIR/native/host/native-messaging-host.js"
CONFIG_TEMPLATE="$EXT_DIR/config/host-config.json"

echo -e "${YELLOW}Extension directory:${NC} $EXT_DIR"
echo -e "${YELLOW}Native host script:${NC} $NATIVE_HOST_JS"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found:${NC} $(node --version)"

# Check if native host script exists
if [ ! -f "$NATIVE_HOST_JS" ]; then
    echo -e "${RED}❌ Native host script not found: $NATIVE_HOST_JS${NC}"
    exit 1
fi

# Make native host script executable
chmod +x "$NATIVE_HOST_JS"
echo -e "${GREEN}✅ Made native host script executable${NC}"

# Detect operating system
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    echo -e "${RED}❌ Unsupported operating system: $OSTYPE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Detected OS:${NC} $OS"

# Install native host configuration based on OS
case $OS in
    "macos")
        DEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        CONFIG_FILE="$DEST_DIR/com.i18ntexteditor.host.json"
        ;;
    "linux")
        DEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
        CONFIG_FILE="$DEST_DIR/com.i18ntexteditor.host.json"
        ;;
    "windows")
        echo -e "${YELLOW}⚠️  Windows installation requires manual registry setup${NC}"
        echo "Please run the following commands as Administrator:"
        echo ""
        echo "reg add \"HKEY_CURRENT_USER\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.i18ntexteditor.host\" /ve /d \"$CONFIG_FILE\" /f"
        echo ""
        DEST_DIR="$HOME/AppData/Local/Google/Chrome/User Data/NativeMessagingHosts"
        CONFIG_FILE="$DEST_DIR/com.i18ntexteditor.host.json"
        ;;
esac

# Create destination directory
mkdir -p "$DEST_DIR"
echo -e "${GREEN}✅ Created directory:${NC} $DEST_DIR"

# Create configuration file
cat > "$CONFIG_FILE" << EOF
{
  "name": "com.i18ntexteditor.host",
  "description": "i18n Text Editor Native Host",
  "path": "$NATIVE_HOST_JS",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID/"
  ]
}
EOF

echo -e "${GREEN}✅ Created native host config:${NC} $CONFIG_FILE"

# Set proper permissions
chmod 644 "$CONFIG_FILE"
echo -e "${GREEN}✅ Set proper permissions${NC}"

# Test native host
echo -e "${YELLOW}🧪 Testing native host...${NC}"
if echo '{"root":"test","lang":"en","payload":[{"key":"test","ns":"test","old":"old","new":"new"}]}' | timeout 5s "$NATIVE_HOST_JS" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Native host test successful${NC}"
else
    echo -e "${YELLOW}⚠️  Native host test failed (this is expected without valid files)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Load the extension in Chrome:"
echo "   - Open chrome://extensions"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $EXT_DIR"
echo ""
echo "2. Update the extension ID in the config file:"
echo "   - After loading, Chrome will assign an extension ID"
echo "   - Replace 'YOUR_EXTENSION_ID' in: $CONFIG_FILE"
echo "   - With your actual extension ID from chrome://extensions"
echo ""
echo "3. Configure the extension:"
echo "   - Click the extension icon"
echo "   - Set your resource bundle root directory"
echo "   - Set your default language"
echo "   - Click 'Save Settings'"
echo ""
echo "4. Enable the editor:"
echo "   - Click 'Enable Editor' in the popup"
echo "   - Or run 'starti18ndebug()' in the browser console"
echo ""
echo -e "${BLUE}Happy translating! 🌐${NC}"
