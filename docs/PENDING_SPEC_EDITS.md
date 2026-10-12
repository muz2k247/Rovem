# Pending spec edits

Exact text changes for the source documents in `docs/specs/`, which can't be edited from the repository. k._muz makes the edit in the source document, exports it over the old file (same name), regenerates `docs/specs/extracted/`, and deletes the entry here.

Entry format: an ID, the document and section, the exact current text, and the exact replacement text.

E1–E3 were made and exported on 2026-10-12. E4–E7 below block no milestone; `docs/DECISIONS.md` governs until they are made.

### E4: Physics Model Specification, "Driving states and acceleration" table, column "When"
Source: DECISIONS OI-1.
- Stopped: "v = 0 and either F_d ≤ F_r or the brake is held" → "v = 0 and either F_d ≤ F_r or u_b > 0"
- Driving: "Throttle applied, v below v_max" → "u_t > 0 and u_b = 0, except At top speed; a may be negative when F_d < F_r"
- At top speed: "v = v_max and F_d ≥ F_r" → "v = v_max, u_t > 0, u_b = 0 and F_d ≥ F_r"
- Coasting: "No throttle and no brake while moving" → "u_t = 0 and u_b = 0 while moving"
- Braking: "Brake applied while moving" → "u_b > 0 while moving; any remaining throttle is ignored"
- Add below the table: "The state is chosen from the control levels, not the keys, so a level still falling after release keeps acting until it reaches 0."

### E5: Physics Model Specification, Controls, "Locks"
Source: DECISIONS OI-2.
- Current: "In Mission 2 the throttle drops to 0 at the power-cut line and stays locked (FR-39)."
- Replacement: "In Mission 2 the throttle level drops to 0 at once, from the step after the power-cut line is reached, without the release ramp, and stays locked (FR-39)."

### E6: Physics Model Specification, Automated tests, T10, column "Expected"
Source: DECISIONS OI-3.
- Current: "to 0.001 s or 0.001 m"
- Replacement: "each within 0.0005 s or 0.0005 m of the sheet value"

### E7: SRS Draft 0.5, section 7 Open Items
Source: DECISIONS OI-5.
- Current row: "Knowledge values, unlock costs and power-ups | Set (3.8); confirmed in playtesting"
- Replacement: two rows, "Knowledge values and unlock costs | Confirmed (3.8)" and "Power-ups | Set (3.8); confirmed in playtesting"
