import argparse
import os
import json
import subprocess
import sys
from flask import Flask, request, jsonify
from openvino_genai import LLMPipeline

# Globals
app = Flask(__name__)
pipeline = None
model_path_g = None
device_g = None

def initialize_pipeline():
    """Initializes the OpenVINO LLM pipeline with more detailed logging."""
    global pipeline
    print("--- Initializing OpenVINO LLM Pipeline ---")

    # Check if the model path is provided and if it's a directory
    if not model_path_g:
        print("❌ FATAL: Model path not provided. Please use the --model-path argument.")
        return False
    if not os.path.isdir(model_path_g):
        print(f"❌ FATAL: The provided model path is not a directory: '{model_path_g}'")
        return False

    print(f"Model Path: {model_path_g}")
    print(f"Target Device: {device_g}")

    try:
        pipeline = LLMPipeline(model_path_g, device_g)
        print("✅ LLMPipeline initialized successfully.")
        return True
    except Exception as e:
        print(f"❌ FATAL: An error occurred while initializing the LLMPipeline.")
        print("   This can happen if the model directory exists but does not contain a valid OpenVINO model,")
        print("   or if there is an issue with the OpenVINO installation itself.")
        print(f"   Underlying error: {e}")
        pipeline = None
        return False

@app.route('/', methods=['GET'])
def index():
    """A simple welcome message to confirm the server is running."""
    return jsonify({
        "message": "Welcome to the OpenVINO Local Inference Server!",
        "endpoints": {
            "/generate": "POST, for text generation",
            "/hardware": "GET, for hardware analysis",
            "/health": "GET, for health check"
        }
    })

@app.route('/health', methods=['GET'])
def health_check():
    """A simple health check endpoint."""
    if pipeline:
        return jsonify({"status": "ok", "pipeline_initialized": True}), 200
    else:
        return jsonify({"status": "error", "pipeline_initialized": False, "message": "LLM pipeline is not initialized."}), 503

@app.route('/hardware', methods=['GET'])
def get_hardware_info():
    """Executes the hardware analyzer script and returns its JSON output."""
    print("--- Running Hardware Analysis ---")
    try:
        # Execute the hardware_analyzer.py script with the --json flag
        result = subprocess.run(
            ['python3', 'hardware_analyzer.py', '--json'],
            capture_output=True,
            text=True,
            check=True
        )
        hardware_data = json.loads(result.stdout)
        print("✅ Hardware analysis complete.")
        return jsonify(hardware_data)
    except FileNotFoundError:
        print("❌ ERROR: 'hardware_analyzer.py' not found.")
        return jsonify({"error": "Hardware analyzer script not found."}), 500
    except subprocess.CalledProcessError as e:
        print(f"❌ ERROR: Hardware analyzer script failed with exit code {e.returncode}.")
        print(f"Stderr: {e.stderr}")
        return jsonify({"error": "Failed to execute hardware analyzer.", "details": e.stderr}), 500
    except json.JSONDecodeError:
        print("❌ ERROR: Failed to parse JSON from hardware analyzer script.")
        return jsonify({"error": "Failed to parse hardware analyzer output."}), 500
    except Exception as e:
        print(f"❌ ERROR: An unexpected error occurred during hardware analysis: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/generate', methods=['POST'])
def generate():
    """Handle inference requests."""
    print("--- Received Generation Request ---")
    if not pipeline:
        print("❌ ERROR: LLMPipeline not initialized.")
        return jsonify({"error": "LLMPipeline not initialized. Check server logs."}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON in request body"}), 400

        prompt = data.get('prompt')
        max_new_tokens = data.get('max_new_tokens', 100)

        if not prompt:
            print("❌ ERROR: Missing 'prompt' in request.")
            return jsonify({"error": "Missing 'prompt' in request body"}), 400

        print(f"Prompt received. Max new tokens: {max_new_tokens}")
        print(f"Received request: prompt='{prompt[:50]}...', max_new_tokens={max_new_tokens}")
        generated_text = pipeline(prompt, max_new_tokens=max_new_tokens)
        print("✅ Successfully generated text.")

        return jsonify({"generated_text": generated_text})

    except Exception as e:
        print(f"❌ ERROR: An error occurred during text generation: {e}")
        return jsonify({"error": f"An error occurred during text generation: {str(e)}"}), 500

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="OpenVINO Local Inference Server with Hardware Analysis")
    parser.add_argument('--model-path', type=str, required=True, help='Path to the OpenVINO IR model directory.')
    parser.add_argument('--device', type=str, default='CPU', help='Device for inference (e.g., NPU, CPU, GPU).')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the server on.')
    args = parser.parse_args()

    model_path_g = args.model_path
    device_g = args.device

    # Initialize the pipeline at startup
    if not initialize_pipeline():
        print("\n❌ Server cannot start because the LLM pipeline failed to initialize.")
        print("   Please check the model path and ensure the model files are correct and accessible.")
        sys.exit(1)

    print(f"🚀 Starting server on http://0.0.0.0:{args.port}")
    app.run(host='0.0.0.0', port=args.port)