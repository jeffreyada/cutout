| ID | Description | Repro steps | Severity | Mitigation | Status |
|----|-------------|-------------|----------|------------|--------|
| B19 | Subject areas close in color to the background (beige scarf on a bright wall) come out ghosted or semi-transparent | Upload a scarf-and-jersey selfie on a bright background | Medium | Part 3 refine brush, test other model sizes in Part 2 | Confirmed |
| B29 | Reduced-motion rule leaves the progress bar animation looping, causing a strobe effect | Enable reduce motion in the OS and upload a photo | Medium | Set iteration count to 1 and show a static bar in that mode | Confirmed by code review |
| B30 | Primary button contrast about 3.8 to 1, no color-scheme declaration | Check the contrast in DevTools, read style.css | Low | Darken the button color, add color-scheme dark | Confirmed by code review |
| B31 | npm audit reports zod advisory via the imgly library, the forced fix downgrades the library | Run npm audit | Low | Do not use fix force, retest with an override in Part 2, watch for a library update | Confirmed |
| B32 | Clicking the finished result image reopens the file picker | Click the result image | Low | Limit the click handler to the idle state | Confirmed by code review |
| B33 | Result image alt text hidden from screen readers by the button role on the dropzone | Test with a screen reader | Medium | Restructure so only the idle area is a button | Confirmed by code review |
| B34 | npm audit reports esbuild and vite dev-server advisory and a source-map-js advisory in build tooling | Run npm audit | Medium | source-map-js patched with a normal audit fix, Vite upgrade tested on its own branch in Fix Session 1, never use fix force | In progress, source-map-js fixed |
