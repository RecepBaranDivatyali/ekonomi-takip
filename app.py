import os
import sys

# Change working directory to the odtu_oryantiring directory
# so that all local files (like ekonomi.db) and paths are resolved correctly.
app_dir = os.path.join(os.path.dirname(__file__), 'odtu_oryantiring')
os.chdir(app_dir)
sys.path.insert(0, app_dir)

# Read and execute the actual app.py in the global context
actual_app_path = os.path.join(app_dir, 'app.py')
with open(actual_app_path, 'r', encoding='utf-8') as f:
    code = compile(f.read(), 'app.py', 'exec')
    exec(code, globals())
