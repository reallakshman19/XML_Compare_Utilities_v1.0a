from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "converters" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

import cii2019_section_rules as rules
import inputxml_to_cii2019 as conv


def defaults(diameter=0.0):
    return conv.ConverterDefaults(
        diameter=diameter,
        wall_thickness=0.01,
        insulation_thickness=0.0,
        corrosion_allowance=0.0,
        temperature1=0.0,
        temperature2=0.0,
        temperature3=0.0,
        pressure1=0.0,
        pressure2=0.0,
        pressure3=0.0,
        reducer_angle=0.0,
    )


def inputxml(elements):
    return (
        '<CAESARII xmlns="COADE" VERSION="14.00" XML_TYPE="Input">\n'
        '<PIPINGMODEL xmlns="" NUMELT="%d">\n%s\n</PIPINGMODEL>\n</CAESARII>\n'
        % (len(elements), "\n".join(elements))
    )


def element(from_node, to_node, diameter):
    return (
        f'<PIPINGELEMENT FROM_NODE="{from_node}" TO_NODE="{to_node}" '
        f'DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="{diameter}" '
        'WALL_THICK="1" INSUL_THICK="0" CORR_ALLOW="0" '
        'TEMP_EXP_C1="0" TEMP_EXP_C2="0" TEMP_EXP_C3="0"/>'
    )


def control(element_count):
    return rules.ControlCounts(
        numelt=element_count,
        numnoz=0,
        nohgrs=0,
        nonam=0,
        nored=0,
        numflg=0,
        bends=0,
        rigids=0,
        expjts=0,
        restraints=0,
        displmnt=0,
        forcmnt=0,
        uniform=0,
        wind=0,
        offsets=0,
        allowbls=0,
        sif_tees=0,
        izup=0,
        equipmnt=0,
    )


def validate_model(model):
    rows = []
    for row in model.elements:
        rows.append(
            f"{row.from_node:g} {row.to_node:g} {row.delta_x:g} "
            f"{row.delta_y:g} {row.delta_z:g} {row.diameter:g}"
        )
        rows.extend(["0"] * (rules.ELEMENT_LINES_PER_BLOCK - 1))
    return rules.validate_elements_rows({"ELEMENTS": rows}, control(len(model.elements)))


class DiameterPolicyTests(unittest.TestCase):
    def parse(self, text, fallback=0.0):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "input.xml"
            path.write_text(text, encoding="utf-8")
            return conv._parse_model(path, defaults(fallback))

    def test_missing_first_diameter_is_rejected_before_neutral_output(self):
        model = self.parse(inputxml([element(10, 20, "-1.010100")]))
        report = validate_model(model)
        self.assertFalse(report.ok)
        self.assertIn("CII2019-ELEMENT-OD-UNRESOLVED", [issue.code for issue in report.issues])

    def test_explicit_fallback_resolves_missing_first_diameter(self):
        model = self.parse(inputxml([element(10, 20, "-1.010100")]), 114.3)
        self.assertAlmostEqual(model.elements[0].diameter, 114.3)
        self.assertTrue(validate_model(model).ok)

    def test_real_diameter_carries_forward_over_later_sentinel(self):
        model = self.parse(inputxml([
            element(10, 20, "114.3"),
            element(20, 30, "-1.010100"),
        ]))
        self.assertEqual([round(row.diameter, 3) for row in model.elements], [114.3, 114.3])
        self.assertTrue(validate_model(model).ok)

    def test_sub_parser_threshold_diameter_fails_closed(self):
        model = self.parse(inputxml([element(10, 20, "5.0")]))
        report = validate_model(model)
        self.assertFalse(report.ok)
        self.assertIn("CII2019-ELEMENT-OD-UNRESOLVED", [issue.code for issue in report.issues])

    def test_converter_build_path_invokes_section_rules_before_return(self):
        source = Path(conv.__file__).read_text(encoding="utf-8")
        self.assertIn("cii2019_section_rules.assert_cii2019_sections_valid(cii_text)", source)


if __name__ == "__main__":
    unittest.main()
