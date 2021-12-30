# batchimageproc

[Download EXE file](https://github.com/kachurovskiy/batchimageproc/raw/main/batchimageproc%201.0.4.exe)

Electron app for batch image processing. Designed for a very specific purpose of resizing, baking in EXIF rotation and creation date/time - but can be easily modified to have more features.

<img width="590" alt="batchimageproc" src="https://user-images.githubusercontent.com/517919/147630766-6f9e4c50-bdfa-4752-878e-30656b54aa6b.png">

# Developing

Make sure you have Git, Node JS and NPM installed.

```
git clone https://github.com/kachurovskiy/batchimageproc.git
cd batchimageproc
npm install
npm start
```

# Building EXE file

```
electron-builder --win portable 
```
