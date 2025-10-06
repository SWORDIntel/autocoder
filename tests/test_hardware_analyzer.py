import unittest
import json
from unittest.mock import patch, MagicMock
import sys
import os

# Add the root directory to the Python path to allow importing the hardware_analyzer
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from hardware_analyzer import MilitaryHardwareAnalyzer, main

class TestHardwareAnalyzer(unittest.TestCase):

    @patch('os.path.exists')
    @patch('hardware_analyzer.MilitaryHardwareAnalyzer.run_command')
    def test_full_analysis_mocked(self, mock_run_command, mock_os_path_exists):
        # Mock the responses from system commands
        mock_run_command.side_effect = self.mocked_run_command
        # Mock os.path.exists to simulate the presence of hardware devices
        mock_os_path_exists.return_value = True

        analyzer = MilitaryHardwareAnalyzer()
        # Mocking properties that depend on the environment
        analyzer.has_sudo = True
        analyzer.msr_available = False

        report = analyzer.analyze()

        # Verify that the report structure is correct and contains expected mocked data
        self.assertIn('platform', report)
        self.assertEqual(report['platform']['manufacturer'], 'MockDell Inc.')
        self.assertEqual(report['cpu']['model'], 'Mock Intel Core Ultra 9')
        self.assertTrue(report['npu']['detected'])
        self.assertIn('total_gb', report['memory'])
        self.assertGreater(report['memory']['total_gb'], 0)

    @patch('argparse.ArgumentParser.parse_args')
    @patch('hardware_analyzer.MilitaryHardwareAnalyzer.analyze')
    @patch('builtins.print')
    def test_main_json_output(self, mock_print, mock_analyze, mock_parse_args):
        # Configure mocks
        mock_parse_args.return_value = MagicMock(json=True)
        mock_analyze.return_value = {"status": "success", "data": "mocked_data"}

        # Run the main function
        main()

        # Check that print was called with a JSON string
        self.assertEqual(mock_print.call_count, 1)
        # The first argument of the first call to print
        args, _ = mock_print.call_args
        printed_output = args[0]
        try:
            # Verify it's valid JSON
            parsed_output = json.loads(printed_output)
            self.assertEqual(parsed_output['status'], 'success')
        except json.JSONDecodeError:
            self.fail("main() did not print a valid JSON string when --json is used.")

    def mocked_run_command(self, cmd, timeout=10):
        """A mock replacement for the run_command method."""
        if "dmidecode" in cmd:
            return "Manufacturer: MockDell Inc.\nProduct Name: MockLatitude"
        if "lscpu" in cmd:
            return "Model name: Mock Intel Core Ultra 9\nCPU(s): 16"
        if "free -b" in cmd:
            return "Mem: 33454554 12345 67890" # Mocked total memory
        return ""

if __name__ == '__main__':
    unittest.main()