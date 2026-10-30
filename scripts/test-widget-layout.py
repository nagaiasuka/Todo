from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='todo-widget-test-') as temp:
    binary = str(Path(temp) / 'capacity-tests')
    subprocess.run([
        'xcrun', 'swiftc', '-module-cache-path', str(Path(temp) / 'cache'),
        str(root / 'plugins/native/TodoWidgetCapacity.swift'),
        str(root / 'tests/widget-capacity/main.swift'), '-o', binary,
    ], check=True)
    subprocess.run([binary], check=True)
