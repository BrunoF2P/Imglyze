import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('release_assets', Path(__file__).parents[1] / 'release-assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class ReleaseAssetsTests(unittest.TestCase):
    def test_incomplete_bundle_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                assets.collect('windows', root, root / 'output')

    def test_complete_release_contains_six_checksums(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'output'
            for platform, extensions in assets.FORMATS.items():
                bundle = root / platform
                bundle.mkdir()
                for extension in extensions:
                    (bundle / ('Imglyze_0.1.0' + extension)).write_bytes(b'installer fixture')
                assets.collect(platform, bundle, output)
            assets.finalize(output)
            lines = (output / 'SHA256SUMS.txt').read_text().splitlines()
            self.assertEqual(len(lines), 6)
            self.assertTrue(all(len(line.split()[0]) == 64 for line in lines))

    def test_partial_release_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                assets.finalize(Path(directory))

    def test_ambiguous_installer_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'one.dmg').write_bytes(b'one')
            (root / 'two.dmg').write_bytes(b'two')
            with self.assertRaises(ValueError):
                assets.collect('macos', root, root / 'output')


if __name__ == '__main__':
    unittest.main()
