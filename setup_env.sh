#!/bin/bash

# This script provides a comprehensive setup for various development environments.
# It can install tools for Node.js, Python (ML), C/C++, Rust, and MongoDB.

# --- Helper Functions ---
print_header() {
    echo "--- $1 ---"
}

print_success() {
    echo "✅ $1"
}

print_error() {
    echo "❌ Error: $1"
    exit 1
}

print_warn() {
    echo "🟡 WARN: $1"
}

# --- Setup Functions ---

setup_node() {
    print_header "Setting up Node.js Environment"
    echo "📦 Installing Node.js dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install Node.js dependencies."
    fi
    print_success "Node.js dependencies installed."
}

setup_python() {
    print_header "Setting up Python Machine Learning Environment"
    if [ ! -d ".venv" ]; then
        echo "   Creating Python virtual environment..."
        python3 -m venv .venv
    fi
    echo "   Activating virtual environment..."
    source .venv/bin/activate
    echo "   Installing Python dependencies from requirements.txt..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        print_error "Failed to install Python dependencies."
    fi
    print_success "Python ML environment is ready."
    echo "   To activate it in your shell, run: source .venv/bin/activate"
}

setup_cpp() {
    print_header "Setting up C/C++ Development Tools"
    if command -v apt-get &> /dev/null; then
        echo "   Detected Debian/Ubuntu. Installing build-essential and cmake..."
        sudo apt-get update && sudo apt-get install -y build-essential gcc g++ make cmake
    elif command -v yum &> /dev/null; then
        echo "   Detected CentOS/RHEL. Installing Development Tools and cmake..."
        sudo yum groupinstall -y "Development Tools"
        sudo yum install -y cmake
    elif command -v brew &> /dev/null; then
        echo "   Detected macOS. Installing gcc and cmake with Homebrew..."
        brew install gcc cmake
    else
        print_warn "Could not detect a supported package manager (apt-get, yum, brew)."
        echo "   Please install GCC, G++, Make, and CMake manually."
        return
    fi

    if command -v gcc &> /dev/null && command -v g++ &> /dev/null && command -v cmake &> /dev/null; then
        print_success "C/C++ development tools are installed."
    else
        print_error "C/C++ toolchain installation failed or was skipped."
    fi
}

setup_rust() {
    print_header "Setting up Rust Development Environment"
    if ! command -v cargo &> /dev/null; then
        echo "   Rust not found. Installing via rustup..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --default-toolchain stable -y
        source "$HOME/.cargo/env"
    else
        echo "   Rust is already installed."
    fi

    if command -v cargo &> /dev/null; then
        print_success "Rust development environment is ready."
    else
        print_error "Rust installation failed."
    fi
}

setup_database() {
    print_header "Setting up MongoDB Database"
    if command -v mongod &> /dev/null; then
        echo "   MongoDB is already installed."
    else
        echo "   MongoDB not found. Attempting installation..."
        if command -v apt-get &> /dev/null; then
            echo "   Detected Debian/Ubuntu. Installing MongoDB..."
            sudo apt-get update
            sudo apt-get install -y gnupg curl
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
            # Using jammy repo as noble is not yet supported by MongoDB
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            sudo apt-get update
            sudo apt-get install -y mongodb-org
            sudo systemctl start mongod
            sudo systemctl enable mongod
        elif command -v yum &> /dev/null; then
            echo "   Detected CentOS/RHEL. Installing MongoDB..."
            sudo yum install -y mongodb-org
            sudo systemctl start mongod
            sudo systemctl enable mongod
        elif command -v brew &> /dev/null; then
            echo "   Detected macOS. Installing MongoDB with Homebrew..."
            brew tap mongodb/brew
            brew install mongodb-community
            brew services start mongodb-community
        else
            print_warn "Could not detect a supported package manager for MongoDB installation."
            echo "   Please install MongoDB manually."
            return
        fi
    fi

    if command -v mongod &> /dev/null; then
        print_success "MongoDB is installed and running."
    else
        print_error "MongoDB installation failed."
    fi
}

print_usage() {
    echo "Usage: $0 [--node] [--python] [--cpp] [--rust] [--database] [--all]"
    echo "  --node      : Set up Node.js environment."
    echo "  --python    : Set up Python ML environment."
    echo "  --cpp       : Set up C/C++ development tools."
    echo "  --rust      : Set up Rust development environment."
    echo "  --database  : Set up MongoDB database."
    echo "  --all       : Set up all environments."
    exit 1
}

# --- Main Logic ---
if [ $# -eq 0 ]; then
    print_usage
fi

for arg in "$@"
do
    case $arg in
        --node)
        setup_node
        shift
        ;;
        --python)
        setup_python
        shift
        ;;
        --cpp)
        setup_cpp
        shift
        ;;
        --rust)
        setup_rust
        shift
        ;;
        --database)
        setup_database
        shift
        ;;
        --all)
        setup_node
        echo ""
        setup_python
        echo ""
        setup_cpp
        echo ""
        setup_rust
        echo ""
        setup_database
        shift
        ;;
        *)
        print_usage
        ;;
    esac
done

print_header "🎉 All requested setups are complete! 🎉"