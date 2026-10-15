from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT / 'converters' / 'scripts' / 'cii-v11-v14-upstream'
sys.path.insert(0, str(FROZEN))

import cii_v11_v14 as mod  # noqa: E402
import cii_v11_v14_records as records  # noqa: E402


def audit(source: int, target: int):
    return mod.Audit(source_version=source, target_version=target, source_sha256='synthetic')


def rows(values: list[float], version: int) -> list[str]:
    if len(values) % 6:
        raise AssertionError('fixture values must be divisible by six')
    return [mod._render_float_row(values[index:index + 6], version) for index in range(0, len(values), 6)]


def flatten(lines: list[str]) -> list[float]:
    return [value for line in lines for value in mod._extract_numbers(line)[0]]


class FrozenCiiV11V14EngineTests(unittest.TestCase):
    def test_detects_only_11_and_14(self) -> None:
        self.assertEqual(mod.detect_version([mod.Section('VERSION', ['        5.00000      11.0000    1252'])]), 11)
        self.assertEqual(mod.detect_version([mod.Section('VERSION', ['    5.00000      14.0000        1256'])]), 14)
        with self.assertRaises(mod.CiiConversionError):
            mod.detect_version([mod.Section('VERSION', ['    5.00000      12.0000        1256'])])

    def test_sif_axial_torsion_swap_is_semantic_not_positional(self) -> None:
        tee1 = [0.0] * 42
        tee2 = [0.0] * 42
        for tee, seed in ((tee1, 1000.0), (tee2, 5000.0)):
            for field in list(range(1, 19)) + list(range(23, 27)):
                tee[field - 1] = seed + field
            tee[14] = seed + 1500.0  # V14 item 15 = axial
            tee[15] = seed + 1600.0  # V14 item 16 = torsional
        converted = mod._convert_sif_tees(rows(tee1 + tee2, 14), 14, 11, False, audit(14, 11))
        self.assertEqual(len(converted), 10)
        first = flatten(converted[:5])
        self.assertEqual(first[14], tee1[15])  # V11 item 15 torsion
        self.assertEqual(first[15], tee1[14])  # V11 item 16 axial

    def test_nonzero_v14_sif_extension_fails_closed(self) -> None:
        tee1 = [0.0] * 42
        tee2 = [0.0] * 42
        tee1[26] = 777.0  # V14 item 27, no qualified V11 slot
        with self.assertRaisesRegex(mod.CiiConversionError, r'items 27'):
            mod._convert_sif_tees(rows(tee1 + tee2, 14), 14, 11, False, audit(14, 11))

    def test_nonzero_v11_ambiguous_sif_field_blocks_upgrade(self) -> None:
        tee1 = [0.0] * 30
        tee2 = [0.0] * 30
        tee1[18] = 9.0  # V11 item 19 has no qualified V14 semantic mapping
        with self.assertRaisesRegex(mod.CiiConversionError, r'items 19'):
            mod._convert_sif_tees(rows(tee1 + tee2, 11), 11, 14, False, audit(11, 14))

    def test_v14_allowables_extension_requires_loss_opt_in(self) -> None:
        values = [0.0] * 168
        values[153] = 7.0
        with self.assertRaises(mod.CiiConversionError):
            mod._convert_allowables(rows(values, 14), 14, 11, False, audit(14, 11))

    def test_restraint_default_stiffness_mapping_is_preserved(self) -> None:
        values1 = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        values2 = [0.0, 0.0, 0.0]
        mapped = records._map_restraint_stiffness(values1, values2, '            0 ', '            0 ', 14, 11)
        self.assertTrue(mod._close_to(mapped[2], mod._V11_DEFAULT_STIFFNESS))


if __name__ == '__main__':
    unittest.main(verbosity=2)
