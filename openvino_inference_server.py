import argparse
import os
import json
import sys
from flask import Flask, request, jsonify
from openvino_genai import LLMPipeline

# --- Globals ---
app = Flask(__name__)
# Use a dictionary to cache loaded pipelines, keyed by model_path
pipelines = {}
# Global variable to store the prioritized device list from startup arguments
device_list_g = "CPU"

def set_performance_env_vars(devices):
    """Sets environment variables for performance tuning based on the device list."""
    print(f"--- Setting Performance Environment Variables for devices: {devices} ---")

    # Set HETERO device priority. This is the primary mechanism for controlling it.
    hetero_priority = ",".join(devices)
    os.environ["OPENVINO_HETERO_PRIORITY"] = hetero_priority
    print(f"✅ Set OPENVINO_HETERO_PRIORITY={hetero_priority}")

    # Tune thread counts for CPU if it's in the list
    if 'CPU' in devices:
        cpu_cores = os.cpu_count() or 1
        os.environ["OMP_NUM_THREADS"] = str(cpu_cores)
        os.environ["MKL_NUM_THREADS"] = str(cpu_cores)
        print(f"✅ Set OMP_NUM_THREADS and MKL_NUM_THREADS to {cpu_cores} for CPU.")

    # Set oneDNN primitive cache for performance, assuming a modern Intel CPU
    os.environ["ONEDNN_MAX_CPU_ISA"] = "AVX512_CORE_VNNI"
    os.environ["TBB_MALLOC_USE_HUGE_PAGES"] = "1"
    print("✅ Set oneDNN and TBB performance hints.")

def get_pipeline(model_path):
    """
    Loads or retrieves a cached LLM pipeline using the HETERO device
    for optimal performance across the prioritized hardware list.
    """
    # The device is now determined by the global HETERO configuration
    device = "HETERO"

    # Cache key can be simple as the model path, since device is always HETERO
    cache_key = model_path
    if cache_key in pipelines:
        return pipelines[cache_key]

    print(f"--- Initializing new pipeline for model: {model_path} on device: {device} ---")

    if not os.path.isdir(model_path):
        print(f"❌ FATAL: The provided model path is not a directory: '{model_path}'")
        return None

    try:
        # HETERO device will automatically use the devices specified in the
        # OPENVINO_HETERO_PRIORITY environment variable set at startup.
        pipeline = LLMPipeline(model_path, device)
        pipelines[cache_key] = pipeline
        print(f"✅ Pipeline for {os.path.basename(model_path)} initialized successfully on {device}:{os.environ['OPENVINO_HETERO_PRIORITY']}.")
        return pipeline
    except Exception as e:
        print(f"❌ FATAL: Could not initialize HETERO pipeline for model {model_path}. Error: {e}")
        return None

@app.route('/generate', methods=['POST'])
def generate():
    """Handle inference requests."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON in request body"}), 400

    prompt = data.get('prompt')
    model_path = data.get('model_path')
    max_new_tokens = data.get('max_new_tokens', 1024)

    if not prompt or not model_path:
        return jsonify({"error": "Missing 'prompt' or 'model_path' in request body"}), 400

    pipeline = get_pipeline(model_path)
    if not pipeline:
        return jsonify({"error": f"Failed to load model pipeline for path: {model_path}"}), 500

    try:
        generated_text = pipeline(prompt, max_new_tokens=max_new_tokens)
        return jsonify({"generated_text": generated_text})
    except Exception as e:
        return jsonify({"error": f"An error occurred during text generation: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """A simple health check endpoint."""
    return jsonify({"status": "ok", "message": "OpenVINO inference server is running."}), 200

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Local OpenVINO Inference Server with Dynamic Hardware Selection")
    parser.add_argument('--port', type=int, default=5001, help='Port to run the server on.')
    parser.add_argument('--device', type=str, default='CPU', help='Comma-separated list of devices for inference priority (e.g., NPU,GPU,CPU).')
    args = parser.parse_args()

    device_list_g = [d.strip().upper() for d in args.device.split(',')]

    # Set performance environment variables at startup
    set_performance_env_vars(device_list_g)

    print(f"🚀 Starting OpenVINO server on http://0.0.0.0:{args.port}")
    print(f"🔥 Using HETERO device with priority: {','.join(device_list_g)}")
    app.run(host='0.0.0.0', port=args.port)