# Tauri app icons

Tauri expects the following files here, generated from a single source SVG or 1024×1024 PNG:

```
32x32.png
128x128.png
128x128@2x.png
icon.ico      (Windows installer)
icon.icns     (macOS, not used on Win11)
```

## Generation

Run once from the project root after installing the Tauri CLI:

```
npm run tauri icon public/icons/icon.svg
```

That command writes all required variants into this directory. Commit them
alongside any source icon changes. Do not edit the generated files by hand.
