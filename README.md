# batchimageproc

[Download EXE file](https://github.com/kachurovskiy/batchimageproc/raw/main/batchimageproc%201.0.4.exe)

Electron app for batch image processing. Designed for a very specific purpose of resizing, baking in EXIF rotation and creation date/time - but can be easily modified to have more features.

<img width="590" alt="batchimageproc" src="https://user-images.githubusercontent.com/517919/147689605-dd15efab-b0d1-4998-aca6-298468665079.png">

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

Delete the created `dist` folder before making the next build or the `exe` file size will grow by including old temp files.
