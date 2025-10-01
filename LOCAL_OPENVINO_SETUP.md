# Local OpenVINO Setup Guide for Project COLDSNAP

This document outlines the steps required to set up the local OpenVINO inference environment for Project COLDSNAP.

## 1. Environment Preparation

### Node.js Dependencies
Ensure `axios` is installed:
```bash
npm install axios --save
```

### Python Environment
1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # On Linux/macOS:
   source .venv/bin/activate
   # On Windows:
   .venv\Scripts\Activate
   ```
2. Create `requirements.txt` in the project root with the following content:
   ```
   flask
   openvino-genai
   openvino>=2025.1
   optimum[openvino,nncf]
   onnx
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## 2. Acquire and Convert AI Model

*(This section requires significant disk space. Ensure sufficient space is available before proceeding.)*

To download and convert the `microsoft/Phi-3-mini-4k-instruct` model to OpenVINO INT4 format, optimized for NPU, execute the following command:
```bash
optimum-cli export openvino --model microsoft/Phi-3-mini-4k-instruct --weight-format int4 --sym --ratio 1.0 --group-size 128 Phi-3-mini-4k-instruct-int4-npu
```
This will create a directory named `Phi-3-mini-4k-instruct-int4-npu` in your project root containing the converted model files.

## 3. Running the Local Inference Server

1. Activate your Python virtual environment:
   ```bash
   source .venv/bin/activate  # Linux/macOS
   .venv\Scripts\Activate      # Windows
   ```
2. Start the OpenVINO inference server, pointing to your converted model:
   ```bash
   python openvino_inference_server.py --model-path ./Phi-3-mini-4k-instruct-int4-npu --device NPU
   ```
   (Replace `NPU` with `CPU` or `GPU` if targeting a different device.)

## 4. Integrating with Autocoder (Node.js)

Refer to the `config.js`, `userInterface.js`, `model.js`, and `codeGenerator.js` files for the Node.js side integration details.

This guide is a critical reference for anyone setting up or troubleshooting the local OpenVINO integration.
