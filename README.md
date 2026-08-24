# Tesla (three.js port)

[View the demo](https://demoports.github.io/tesla_sunflower/)

A Three.js port of Sunflower's 2000 Windows demo. The effect order,
timing, fixed-function blend modes, source geometry, textures, and soundtrack
come directly from `tesla_src/Demo/Smasher` in the
[original source archive](https://files.scene.org/view/resources/code/sources/tesla_src.zip).

The port was created with the assistance of Claude and Codex.

The layout intentionally follows the original source: `src/Demo.js` owns the
timeline, `src/core` contains the small shared runtime, and `src/effects`
contains one module for each scheduled C++ effect.
