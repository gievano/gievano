from pathlib import Path
import re
import unittest
import xml.etree.ElementTree as ET


HEADER = Path(__file__).parents[1] / "assets" / "header.svg"


class HeaderAnimationTest(unittest.TestCase):
    def setUp(self):
        self.source = HEADER.read_text(encoding="utf-8")
        self.root = ET.fromstring(self.source)

    def test_gievano_is_drawn_by_a_looping_pencil_sequence(self):
        classes = {element.get("class") for element in self.root.iter()}

        self.assertIn("title-outline", classes)
        self.assertIn("title-fill", classes)
        self.assertIn("pencil", classes)
        self.assertIn("@keyframes reveal-title", self.source)
        self.assertIn("@keyframes move-pencil", self.source)
        self.assertIn("infinite", self.source)

    def test_reduced_motion_keeps_the_title_visible(self):
        reduced_motion = self.source.split(
            "@media (prefers-reduced-motion: reduce)", 1
        )[1]

        self.assertIn(".title-outline", reduced_motion)
        self.assertIn(".title-fill", reduced_motion)
        self.assertIn(".pencil", reduced_motion)
        self.assertIn(".eraser", reduced_motion)

    def test_each_side_doodle_has_its_own_motion(self):
        classes = {element.get("class") for element in self.root.iter()}

        self.assertTrue(
            {"doodle-bolt", "doodle-circle", "doodle-plane", "doodle-wave"}
            <= classes
        )

    def test_write_mask_has_room_for_both_outer_letters(self):
        mask = next(
            element
            for element in self.root.iter()
            if element.get("class") == "write-mask"
        )
        left = float(mask.get("x"))
        right = left + float(mask.get("width"))

        self.assertLessEqual(left, 190)
        self.assertGreaterEqual(right, 710)

    def test_pencil_uses_renderer_safe_transform_motion(self):
        self.assertNotIn("offset-path:", self.source)
        self.assertIn("transform: translate(", self.source)

    def test_banner_uses_lightweight_paper_pattern(self):
        ids = {element.get("id") for element in self.root.iter()}
        classes = {element.get("class") for element in self.root.iter()}

        self.assertIn("paper", ids)
        self.assertNotIn("paper-grain", ids)
        self.assertNotIn("paper-texture", classes)

    def test_pencil_motion_has_multiple_renderer_safe_checkpoints(self):
        motion = self.source.split("@keyframes move-pencil", 1)[1].split(
            "@keyframes", 1
        )[0]

        self.assertGreaterEqual(motion.count("transform: translate("), 6)

    def test_pencil_and_title_reveal_share_the_same_timing_checkpoints(self):
        reveal = self.source.split("@keyframes reveal-title", 1)[1].split(
            "@keyframes", 1
        )[0]
        pencil = self.source.split("@keyframes move-pencil", 1)[1].split(
            "@keyframes", 1
        )[0]
        reveal_steps = {
            int(step)
            for line in reveal.splitlines()
            if "scaleX" in line
            for step in re.findall(r"(\d+)%", line.split("{", 1)[0])
            if 5 <= int(step) <= 36
        }
        pencil_steps = {
            int(step)
            for line in pencil.splitlines()
            if "opacity: 1" in line
            for step in re.findall(r"(\d+)%", line.split("{", 1)[0])
        }

        self.assertGreaterEqual(len(pencil_steps), 6)
        self.assertEqual(pencil_steps, reveal_steps)

    def test_all_doodles_have_a_staggered_draw_in(self):
        self.assertIn("@keyframes draw-doodle", self.source)
        self.assertGreaterEqual(self.source.count("draw-doodle"), 5)

    def test_pencil_graphite_tip_is_on_the_left(self):
        tips = [
            element
            for element in self.root.iter()
            if element.get("class") == "pencil-tip"
        ]

        self.assertEqual(len(tips), 1)
        self.assertTrue(tips[0].get("d").startswith("M0 "))

    def test_loop_erases_the_title_from_left_to_right(self):
        classes = {element.get("class") for element in self.root.iter()}

        self.assertIn("erase-mask", classes)
        self.assertIn("eraser", classes)
        self.assertIn("@keyframes erase-title", self.source)
        self.assertIn("@keyframes move-eraser", self.source)

    def test_eraser_and_title_erase_share_the_same_timing_checkpoints(self):
        erase = self.source.split("@keyframes erase-title", 1)[1].split(
            "@keyframes", 1
        )[0]
        eraser = self.source.split("@keyframes move-eraser", 1)[1].split(
            "@keyframes", 1
        )[0]
        erase_steps = {
            int(step)
            for line in erase.splitlines()
            if "scaleX" in line
            for step in re.findall(r"(\d+)%", line.split("{", 1)[0])
            if 72 <= int(step) <= 90
        }
        eraser_steps = {
            int(step)
            for line in eraser.splitlines()
            if "opacity: 1" in line
            for step in re.findall(r"(\d+)%", line.split("{", 1)[0])
        }

        self.assertGreaterEqual(len(eraser_steps), 6)
        self.assertEqual(eraser_steps, erase_steps)

    def test_eraser_pad_is_on_the_left_leading_edge(self):
        pads = [
            element
            for element in self.root.iter()
            if element.get("class") == "eraser-pad"
        ]

        self.assertEqual(len(pads), 1)
        self.assertTrue(pads[0].get("d").startswith("M0 "))

    def test_eraser_uses_a_rectangular_block_body(self):
        bodies = [
            element
            for element in self.root.iter()
            if element.get("class") == "eraser-body"
        ]

        self.assertEqual(len(bodies), 1)
        self.assertTrue(bodies[0].tag.endswith("rect"))
        self.assertGreater(float(bodies[0].get("width")), float(bodies[0].get("height")))

    def test_banner_has_subtle_notebook_rules(self):
        classes = {element.get("class") for element in self.root.iter()}

        self.assertIn("notebook-line", classes)
        self.assertIn("notebook-margin", classes)


if __name__ == "__main__":
    unittest.main()
