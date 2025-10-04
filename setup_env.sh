#!/bin/bash

# This script sets up the environment for the AutoCode project.
# It installs both the Node.js and Python dependencies.

echo "--- Setting up AutoCode Environment ---"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Check if npm install was successful
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install Node.js dependencies. Please check your npm and package.json configuration."
    exit 1
fi
echo "✅ Node.js dependencies installed successfully."

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
# Create a virtual environment to avoid polluting the global python environment
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

# Check if pip install was successful
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install Python dependencies. Please check your pip and requirements.txt configuration."
    exit 1
fi
echo "✅ Python dependencies installed successfully."

echo "--- Environment setup complete! ---"
echo "To activate the python virtual environment, run: source .venv/bin/activate"