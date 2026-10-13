"""Collect installers and validate the complete release before publication."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

FORMATS = {'linux': ['.AppImage', '.deb', '.rpm'], 'windows': ['.msi', '.exe'], 'macos': ['.dmg']}


def collect(platform, bundle, output):
    selected = []
    for extension in FORMATS[platform]:
        matches = sorted(bundle.rglob('*' + extension))
        if len(matches) != 1:
            raise ValueError(f'{platform}: expected one {extension} installer, found {len(matches)}')
        selected.append(matches[0])
    output.mkdir(parents=True, exist_ok=True)
    for source in selected:
        destination = output / (platform + '__' + source.name)
        if destination.exists():
            raise ValueError(f'Duplicate asset: {destination.name}')
        shutil.copy2(source, destination)


def finalize(output):
    files = []
    for platform, extensions in FORMATS.items():
        for extension in extensions:
            matches = sorted(output.glob(platform + '__*' + extension))
            if len(matches) != 1:
                raise ValueError(f'Incomplete release: {platform} {extension}')
            files.append(matches[0])
    checksums = []
    for path in sorted(files):
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        checksums.append(f'{digest}  {path.name}')
    (output / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n', encoding='utf8')
    print(json.dumps({'installers': len(files), 'checksums': 'SHA256SUMS.txt'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', choices=FORMATS)
    parser.add_argument('--bundle', type=Path)
    parser.add_argument('--output', type=Path, default=Path('release-assets'))
    parser.add_argument('--finalize', action='store_true')
    args = parser.parse_args()
    if args.finalize:
        finalize(args.output)
    elif args.platform and args.bundle:
        collect(args.platform, args.bundle, args.output)
    else:
        parser.error('use --finalize or --platform and --bundle')
