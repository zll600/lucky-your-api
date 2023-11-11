const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const ffmpeg = require('fluent-ffmpeg')

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

async function extractVideoFrame(opts) {
  const {
    log = () => {},
    quality = 2,
    offset = 0,
    input,
    output,
    noaccurate = false,
  } = opts

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input)

    const inputOptions = []
    if (noaccurate) {
      inputOptions.push('-ss', offset / 1000)
    } else {
      cmd.seek(offset / 1000)
    }

    if (noaccurate) {
      inputOptions.push('-noaccurate_seek')
    }

    const outputOptions = [
      '-vframes', 1,
      '-q:v', quality,
    ]

    cmd
      .inputOptions(inputOptions)
      .outputOptions(outputOptions)
      .output(output)
      .on('start', (cmd) => log && log({cmd}))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

async function getVideoDuration(input) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, function (err, metadata) {
      if (err) {
        reject(err)
      } else {
        resolve(Math.round(metadata.streams[0].duration))
      }
    })
  })
}

module.exports = {
  extractVideoFrame,
  getVideoDuration,
}