#!/bin/bash
# ci_test.sh - Automated testing script for CI/CD integration

set -e  # Exit on any error

echo "🎙️  VOCERA VOICE DETECTION - CI/CD TEST RUNNER"
echo "================================================"

# Check if we're in the right directory
if [ ! -d "voice-detect" ] || [ ! -f "run_full_test.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd voice-detect
pip install -r requirements.txt
cd ..

# Start server in background
echo "🚀 Starting voice detection server..."
cd voice-detect
python app.py &
SERVER_PID=$!
cd ..

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Check if server is responding
echo "🔍 Checking server status..."
max_retries=10
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if curl -s http://localhost:5001/get_profile/test > /dev/null 2>&1; then
        echo "✅ Server is responding"
        break
    fi
    
    retry_count=$((retry_count + 1))
    echo "⏳ Server not ready, retrying... ($retry_count/$max_retries)"
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "❌ Server failed to start properly"
    exit 1
fi

# Run full test suite
echo "🧪 Running full test suite..."
python run_full_test.py

# Capture exit code
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo "🎉 All tests passed successfully!"
else
    echo "❌ Some tests failed (exit code: $TEST_RESULT)"
fi

exit $TEST_RESULT 