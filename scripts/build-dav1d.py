"""Build a static AVIF decoder; requires Meson, Ninja, NASM and a C compiler."""
import json
from pathlib import Path
import platform
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
work = root / '.build' / 'dav1d'
source = work / 'source'
prefix = work / 'install'
work.mkdir(parents=True, exist_ok=True)

def run(*args):
    subprocess.run([str(a) for a in args], check=True)

if not source.exists():
    run('git', 'clone', '--depth', '1', '--branch', '1.5.4',
        'https://code.videolan.org/videolan/dav1d.git', source)
if subprocess.check_output(['git', '-C', str(source), 'describe', '--tags', '--exact-match'], text=True).strip() != '1.5.4':
    raise SystemExit('Unexpected dav1d source version')

universal = '--universal' in sys.argv
arches = ['x86_64', 'arm64'] if universal else [platform.machine()]
for arch in arches:
    build = work / ('build-' + arch)
    install = work / ('install-' + arch) if universal else prefix
    options = ['--buildtype=release', '--default-library=static', '--prefix=' + str(install),
               '--libdir=lib', '-Denable_tools=false', '-Denable_tests=false']
    if universal:
        cross = work / (arch + '.ini')
        family = 'aarch64' if arch == 'arm64' else 'x86_64'
        cross.write_text("[binaries]\nc = ['clang', '-arch', '" + arch + "']\nar = 'ar'\nstrip = 'strip'\n"
                         "[host_machine]\nsystem = 'darwin'\ncpu_family = '" + family + "'\ncpu = '" + arch + "'\nendian = 'little'\n")
        options += ['--cross-file=' + str(cross)]
    elif platform.system() == 'Windows':
        options += ['--vsenv']
    run('meson', 'setup', *(['--reconfigure'] if build.exists() else []), build, source, *options)
    run('meson', 'compile', '-C', build)
    run('meson', 'install', '-C', build)

if universal:
    import shutil
    prefix.mkdir(parents=True, exist_ok=True)
    shutil.copytree(work / 'install-arm64' / 'include', prefix / 'include', dirs_exist_ok=True)
    (prefix / 'lib' / 'pkgconfig').mkdir(parents=True, exist_ok=True)
    run('lipo', '-create', work / 'install-x86_64/lib/libdav1d.a',
        work / 'install-arm64/lib/libdav1d.a', '-output', prefix / 'lib/libdav1d.a')
    pc = (work / 'install-arm64/lib/pkgconfig/dav1d.pc').read_text()
    (prefix / 'lib/pkgconfig/dav1d.pc').write_text(pc.replace(str(work / 'install-arm64'), str(prefix)))
print(json.dumps({'prefix': str(prefix)}))
