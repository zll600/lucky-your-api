const fs = require('fs')
const { Storage } = require('@google-cloud/storage')
const tempy = require('tempy')
const { promisify } = require('util')
const gcloudCredentials = require('../googlecloud.json')
const { extractVideoFrame, getVideoDuration } = require('./ffmpeg-extract-frame')
const { google } = require('googleapis')
const bigquery = require('@google-cloud/bigquery')
const googlePayConfig = require('../googlepay.config.json')

const androidpublisher = google.androidpublisher('v3')

const sizeOf = promisify(require('image-size'))
const gcloudStorageModel = new Storage({
  credentials: gcloudCredentials,
})
const GOOGLE_CLOUD_STORAGE_URL = 'https://storage.googleapis.com/'

async function uploadToGcloudAsync(bucketName, filePath, destination, metadata) {
  const options = {
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
    destination: destination,
    public: true,
    metadata,
  }
  const uploadResult = await gcloudStorageModel.bucket(bucketName).upload(filePath, options)
  if (uploadResult && uploadResult.length > 0) {
    return GOOGLE_CLOUD_STORAGE_URL + bucketName + '/' + destination
  }

  return null
}

function getCDNUrl(bucketName, url) {
  return url.replace(`${GOOGLE_CLOUD_STORAGE_URL}${bucketName}`, 'https://cdn.goluckydate.com')
}

async function uploadImageBufferToGcloudAsync(bucketName, tempFilePath, imageFilename, businessName = '') {
  try {
    const imageDestination = `image/${businessName ? `${businessName}/` : ''}${imageFilename}`
    const imageUrl = await uploadToGcloudAsync(bucketName, tempFilePath, imageDestination, 'image/jpg')

    //removeUploadedTmpFile(tempFilePath)
    return getCDNUrl(bucketName, imageUrl)
  } catch (err) {
    console.error(`[uploadImageBufferToGcloudAsync] ${err.message}`)

    return null
  }
}

function removeUploadedTmpFile(file) {
  try {
    fs.unlinkSync(file)
    fs.rmdirSync(path.dirname(file))
  } catch (err) {
    console.error(`[removeUploadedTmpFile] remove ${file} failed, ${err.message}`)
  }
}

async function uploadVideoBufferToCloudStorageAsync(
  bucketName,
  buffer,
  videoFilename,
  coverFilename,
  offset = 1000,
) {
  try {
    const videoDestination = `video/${videoFilename}`
    const imageDestination = `image/${coverFilename}`
    const tempFilePath = tempy.file({ name: videoFilename })
    fs.writeFileSync(tempFilePath, buffer)
    const tempCoverFilePath = tempy.file({ name: coverFilename })
    const videoDuration = await getVideoDuration(tempFilePath)
    await extractVideoFrame({
      input: tempFilePath,
      output: tempCoverFilePath,
      offset,
    })
    const {
      width: imageWidth,
      height: imageHeight,
    } = await sizeOf(tempCoverFilePath).metadata()

    const uploadVideoStart = parseInt(Date.now() / 1000)
    const videoUrl = await uploadToGcloudAsync(
      bucketName,
      tempFilePath,
      videoDestination,
    )
    removeUploadedTmpFile(tempFilePath)
    const uploadVideoEnd = parseInt(Date.now() / 1000)
    const uploadVideoDuration = uploadVideoEnd - uploadVideoStart
    console.log(`[upload_video] cost ${uploadVideoDuration} s`)

    const imageUrl = await uploadToGcloudAsync(
      bucketName,
      tempCoverFilePath,
      imageDestination,
    )
    removeUploadedTmpFile(tempCoverFilePath)
    if (videoUrl === null || imageUrl === null) {
      return null
    }

    return {
      video_url: getCDNUrl(bucketName, videoUrl),
      video_length_seconds: videoDuration,
      image_url: getCDNUrl(bucketName, imageUrl),
      image_width: imageWidth,
      image_height: imageHeight,
    }
  } catch (err) {
    console.error(`[uploadVideoBufferToCloudStorageAsync] ${err.message}`)

    return null
  }
}

async function googlePayProductGet(productId, token) {
  const auth = new google.auth.GoogleAuth({
    credentials: googlePayConfig,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  const authClient = await auth.getClient()
  google.options({ auth: authClient })
  const res = await androidpublisher.purchases.products.get({
    packageName: 'com.goluckydate.android',
    productId,
    token,
    requestBody: null,
  })

  return res.data
}

async function googlePayProductAcknowledge(productId, token) {
  const auth = new google.auth.GoogleAuth({
    credentials: googlePayConfig,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  const authClient = await auth.getClient()
  google.options({ auth: authClient })
  const res = await androidpublisher.purchases.products.acknowledge({
    packageName: 'com.goluckydate.android',
    productId,
    token,
    requestBody: null,
  })

  return res.data
}

async function logBigQueryAsync(datasetId, tableId, row) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return 
    }
    
    const bq = new bigquery.BigQuery({
      credentials: gcloudCredentials,
      projectId: gcloudCredentials['project_id'],
    })

    return await bq
      .dataset(datasetId)
      .table(tableId)
      .insert([row])
  } catch (err) {
    console.error(`[logBigQueryAsync] ${err.message}`)
  }
}

module.exports = {
  googlePayProductAcknowledge,
  googlePayProductGet,
  logBigQueryAsync,
  uploadImageBufferToGcloudAsync,
  uploadToGcloudAsync,
  uploadVideoBufferToCloudStorageAsync,
}
