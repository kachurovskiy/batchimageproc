# batchimageproc

Electron app for batch JPEG processing. It can resize images, bake in EXIF rotation, and add an EXIF date/time overlay.

[Download the latest portable Windows build](https://github.com/kachurovskiy/batchimageproc/releases/latest)

<img src="https://github.com/user-attachments/assets/2c3b0222-84aa-4d43-9ffd-a6dcfc7cac0a" />

## Behavior

- Writes to a `batchimageproc-output` folder by default.
- Can overwrite originals when explicitly selected.
- Skips files already stamped by this app unless re-processing is enabled.
- Preserves folder structure when writing to an output folder.
- Excludes the default output folder from source scans.

## Developing

Make sure Git, Node.js 22.12 or newer, and npm are installed.

```sh
git clone https://github.com/kachurovskiy/batchimageproc.git
cd batchimageproc
npm install
npm start
```

## Testing

```sh
npm test
npm audit
```

## Building

```sh
npm run dist
```

Build output is written to `dist`. Do not commit generated `.exe` files; publish them through GitHub Releases.
