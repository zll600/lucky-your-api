const { loadImage } = require('canvas')
let sharp = null
if (process.env.NODE_ENV === 'production') {
  sharp = require('sharp')
}
const fs = require('fs-extra')

async function getImageSizeAsync(buffer) {
  const image = await loadImage(buffer)

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
  }
}

async function resizeImageAsync(path, maxWidth, maxHeight) {
  const buffer = await fs.readFile(path)
  const image = await loadImage(buffer)
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width <= maxWidth && height <= maxHeight) {
    return buffer
  }

  let targetWidth = width
  let targetHeight = height
  if (width / height >= maxWidth / maxHeight) {
    targetWidth = maxWidth
    targetHeight = maxWidth * height / width
  } else {
    targetWidth = maxHeight * width / height
    targetHeight = maxHeight
  }

  const data = await sharp(buffer)
    .resize(parseInt(targetWidth), parseInt(targetHeight))
    .jpeg({ quality: 40 }).toBuffer()

  return data
}

module.exports = {
  getImageSizeAsync,
  resizeImageAsync,
}