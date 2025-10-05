#!/home/jules/.pyenv/shims/python3
import argparse
import json
import platform
import subprocess
import sys
import re
from datetime import datetime

def get_cpu_info():
    """Gathers detailed CPU information."""
    try:
        import cpuinfo
        info = cpuinfo.get_cpu_info()
        return {
            "Model": info.get('brand_raw', "N/A"),
            "Vendor": info.get('vendor_id_raw', "N/A"),
            "Cores": f"{info.get('count', 'N/A')} physical",
            "Frequency": {
                "Current": info.get('hz_actual_friendly', "N/A"),
                "Max": info.get('hz_advertised_friendly', "N/A"),
            },
            "Architecture": info.get('arch_string_raw', "N/A"),
        }
    except ImportError:
        return {"Error": "py-cpuinfo not installed. Please run: pip install py-cpuinfo"}
    except Exception as e:
        return {"Error": f"Could not retrieve CPU info: {e}"}

def get_memory_info():
    """Gathers memory (RAM) information."""
    try:
        import psutil
        mem = psutil.virtual_memory()
        total_gb = mem.total / (1024**3)
        return {
            "Total": f"{total_gb:.2f} GB",
            "Available": f"{mem.available / (1024**3):.2f} GB",
            "Used": f"{mem.used / (1024**3):.2f} GB ({mem.percent}%)",
        }
    except ImportError:
        return {"Error": "psutil not installed. Please run: pip install psutil"}
    except Exception as e:
        return {"Error": f"Could not retrieve memory info: {e}"}

def _run_command(command):
    """Helper to run a command and return its output."""
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except FileNotFoundError:
        return None
    except subprocess.CalledProcessError:
        return None

def get_pci_devices():
    """Gets a list of PCI devices using lspci."""
    lspci_output = _run_command(['lspci'])
    if lspci_output:
        return lspci_output.split('\n')
    return []

def get_system_product_info():
    """Detects if the system is an Intel NUC or Compute Stick."""
    product_name = _run_command(['dmidecode', '-s', 'system-product-name'])
    board_name = _run_command(['dmidecode', '-s', 'baseboard-product-name'])

    if product_name is None:
        return {"Error": "dmidecode not found or failed to run. Try running with sudo."}

    if "NUC" in (product_name or "") or "Compute Stick" in (product_name or ""):
        return {"Type": "Intel NUC / Compute Stick", "Model": product_name}

    return {"Type": product_name, "Board": board_name}

def parse_pci_devices(pci_devices):
    """Parses the list of PCI devices for specific components."""
    gpu_info = []
    accelerator_info = []

    for device in pci_devices:
        if "VGA compatible controller" in device and "Intel" in device:
            gpu_info.append({"Name": device.split(': ', 1)[1]})
        elif "Processing accelerators" in device and "NPU" in device:
            accelerator_info.append({"Type": "NPU", "Name": device.split(': ', 1)[1]})
        elif "Gaussian & Neural-Network Accelerator" in device:
            accelerator_info.append({"Type": "GNA", "Name": device.split(': ', 1)[1]})

    return gpu_info, accelerator_info

def get_disk_info():
    """Gathers disk storage information."""
    try:
        import psutil
        partitions = psutil.disk_partitions()
        disk_info = []
        for p in partitions:
            try:
                usage = psutil.disk_usage(p.mountpoint)
                disk_info.append({
                    "Device": p.device,
                    "Mountpoint": p.mountpoint,
                    "FileSystem": p.fstype,
                    "TotalSize": f"{usage.total / (1024**3):.2f} GB",
                    "Used": f"{usage.used / (1024**3):.2f} GB",
                    "Free": f"{usage.free / (1024**3):.2f} GB",
                    "UsagePercentage": f"{usage.percent}%",
                })
            except Exception:
                continue
        return disk_info
    except ImportError:
        return {"Error": "psutil not installed. Please run: pip install psutil"}
    except Exception as e:
        return {"Error": f"Could not retrieve disk info: {e}"}

def generate_compiler_flags(cpu_info):
    """Generates recommended GCC/G++ compiler flags."""
    model = cpu_info.get("Model", "").lower()

    if "meteor lake" in model:
        arch_flags = "-march=meteorlake -mtune=meteorlake"
    else:
        arch_flags = "-march=native -mtune=native"

    return {
        "Architecture": arch_flags,
        "Optimization": "-O3 -flto -fomit-frame-pointer",
        "Vectorization": "-ftree-vectorize -ftree-loop-vectorize -ftree-slp-vectorize",
        "Comment": "Use these flags for performance-critical local builds."
    }

def display_report(data):
    """Prints the hardware report in a human-readable format."""
    print("="*80)
    print("HARDWARE ENUMERATION & COMPILER OPTIMIZATION REPORT (ENHANCED)")
    print("="*80)
    print(f"Generated: {datetime.now().isoformat()}")

    # System Info
    print("\nℹ️  SYSTEM INFORMATION")
    print("."*40)
    for key, value in data['system_product'].items():
        print(f"  {key}: {value}")

    # CPU
    print("\n🖥  CPU INFORMATION")
    print("."*40)
    for key, value in data['cpu'].items():
        if isinstance(value, dict):
            print(f"  {key}:")
            for sub_key, sub_value in value.items():
                print(f"    {sub_key}: {sub_value}")
        else:
            print(f"  {key}: {value}")

    # Memory
    print("\n💾 MEMORY INFORMATION")
    print("."*40)
    for key, value in data['memory'].items():
        print(f"  {key}: {value}")

    # Graphics
    print("\n🎮 GRAPHICS CARDS")
    print("."*40)
    if data['gpu']:
        for i, gpu in enumerate(data['gpu']):
            print(f"  GPU {i+1}: {gpu['Name']}")
    else:
        print("  No GPUs detected or an error occurred.")

    # AI Accelerators
    print("\n🧠 AI ACCELERATORS")
    print("."*40)
    if data['accelerators']:
        for acc in data['accelerators']:
            print(f"  • {acc['Type']}: {acc['Name']}")
    else:
        print("  No dedicated AI accelerators detected via lspci.")

    # Disks
    print("\n💿 STORAGE DEVICES")
    print("."*40)
    if isinstance(data['disks'], list):
        for i, disk in enumerate(data['disks']):
            print(f"  Disk {i+1}: {disk['Device']} at {disk['Mountpoint']} ({disk['UsagePercentage']} used)")
    else:
         print("  No disks detected or an error occurred.")

    print("\n" + "="*20 + " OPTIMAL COMPILER FLAGS " + "="*20)
    # Compiler Flags
    print("\n🔧 GCC/G++ OPTIMIZATION")
    print("."*40)
    for key, value in data['compiler_flags'].items():
        print(f"  {key}: {value}")

    # Quick Copy Commands
    print("\n" + "="*20 + " QUICK COPY COMMANDS " + "="*20)
    flags = data['compiler_flags']
    cflags = f"{flags.get('Architecture', '')} {flags.get('Optimization', '')} {flags.get('Vectorization', '')}"
    print(f'\n# Performance-Tuned Flags')
    print(f'export CFLAGS="{cflags.strip()}"')
    print(f'export CXXFLAGS="$CFLAGS"')
    if 'Cores' in data['cpu']:
        try:
            core_count = int(re.search(r'\d+', data['cpu']['Cores']).group())
            print(f'\n# Parallel Build (using {core_count} cores)')
            print(f'export MAKEFLAGS="-j{core_count}"')
        except (ValueError, IndexError, AttributeError):
            pass

    print("\n" + "="*80)

def main():
    """Main function to gather and display hardware info."""
    parser = argparse.ArgumentParser(description="An enhanced hardware enumerator and compiler optimizer.")
    parser.add_argument('--json', action='store_true', help='Output the report in JSON format.')
    args = parser.parse_args()

    cpu_info = get_cpu_info()
    pci_devices = get_pci_devices()
    gpu_info, accelerator_info = parse_pci_devices(pci_devices)

    data = {
        "system_product": get_system_product_info(),
        "cpu": cpu_info,
        "memory": get_memory_info(),
        "gpu": gpu_info,
        "accelerators": accelerator_info,
        "disks": get_disk_info(),
        "compiler_flags": generate_compiler_flags(cpu_info),
    }

    if args.json:
        print(json.dumps(data, indent=4))
    else:
        display_report(data)

if __name__ == "__main__":
    # Check for necessary dependencies and guide the user if they are missing.
    try:
        import psutil
        import cpuinfo
    except ImportError as e:
        missing_module = str(e).split("'")[1]
        print(f"Error: Required Python package '{missing_module}' is not installed.", file=sys.stderr)
        print(f"Please install it by running: pip install {missing_module}", file=sys.stderr)
        sys.exit(1)

    main()