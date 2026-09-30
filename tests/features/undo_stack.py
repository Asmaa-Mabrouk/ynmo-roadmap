import subprocess, os
out=subprocess.run(['node',os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'undo_unit.mjs')],capture_output=True,text=True)
print(out.stdout, out.stderr)
