# Superset correction — Tactical and Power Building

Reviewed the 30 Tactical templates (including the rest week) and nine Power Building templates against their stored prescriptions. The attached S2J1 program screenshot also establishes the four FULL BODY pairs. The regression fixture captures the pre-correction prescriptions, not athlete data.

## Corrected behavior

- Explicit supersets/bisets/trisets render in one card, round by round. Each movement retains its own input, exercise-library link, original exercise ID and original prescribed-set ID.
- Rest belongs after the last movement. Unknown rest remains unspecified.
- Program preview and coach view show the same group boundaries. Coach WORKOUT sections retain their label and complete prescription, including sets, tempo, RPE and rest.
- Fallback set creation uses only the workout prescription, never library technique instructions; `3x max` creates three rows. Ranges and compound rep/hold sequences are not prefilled as a single fixed rep target.
- WOD formats, WOD result keys, session progression, drafts and completion APIs are unchanged.

## Data corrections

`scripts/fix-superset-prescriptions.sql` checks the reviewed notes before changing anything, preserves all existing IDs, and is safe to rerun. Applied after the historical Tactical completion script.

- Power Building S1/S2/S3 J1: reciprocal “enchaîné avec” notes establish extension + hamstring curl, four rounds, two-minute rest after the pair.
- Tactical S1J1: same explicit pair; add the three missing hamstring-curl prescribed sets, retaining the original first set. Move extension rest to zero; the curl retains the pair's 120-second rest.
- Tactical S1/S3/S5/S9/S11 J2: the canonical source says “Pull-up + Dips”; restore this association lost during splitting.
- Tactical S2J1: screenshot establishes toes-to-bar + one out-and-back farmer carry on each of four rounds. S4J1 repeats that same imported block and receives the same grouping. Rest is not supplied.
- Remaining groups follow existing “après le superset/triset” boundaries, including the three-movement blocks in S8J3/S10J3.

No sessions or performed sets were written. Before/after checks matched all 97 session records and all 269 performed-set records exactly.

## Limits requiring source/device confirmation

- Power Building BENCH has separate Pull-up and Dips rows with equal set counts but no explicit pairing in the available source. They remain separate; equality alone is not evidence of a superset. The original Power Building page is needed to establish the intended relationship.
- This is a check against available prescriptions and the supplied screenshot, not certification against an unavailable original complete program.
- TypeScript, both native exports, regression fixtures and component callback tests validate code behavior; physical iPhone/Android layout and interaction still require a device check.
- Existing Expo update groups remain available and the SDK/runtime are unchanged. A QR pinned to an older group continues to open that older code; this does not automatically upgrade it.
