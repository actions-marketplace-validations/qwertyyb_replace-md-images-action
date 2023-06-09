const fs = require('fs')
const getMarkdownUrls = require('gh-md-urls')
const fetch = require('node-fetch')
const { upload, initClient } = require('./cos')

const readFile = (path) => fs.readFileSync(path, 'utf8')

const getImages = (content) => {
  var urls = getMarkdownUrls(content, {
    repository: 'https://github.com/mattdesl/gh-md-urls'
  })

  const images = urls.filter(item => item.type === 'image')
  return images
}

const uploadImagesToCos = async (images, cosOptions = {}) => {
  initClient(cosOptions)
  const replaceInfos = await Promise.all(images.map(async item => {
    const res = await fetch(item.url)
    const fileName = item.url.split('/').reverse()[0]
    if (!fileName) throw new Error('获取文件名失败: ' + item.url)
    if (res.headers.get('content-type').startsWith('image/')) {
      const buffer = await res.arrayBuffer()
      const url = await upload({ buffer: Buffer.from(buffer), fileName }, cosOptions)
      return { oldVal: item.url, newVal: url}
    }
  }))
  return replaceInfos;
}

const replaceMarkdownImageUrls = (content, replaceInfos) => {
  replaceInfos.forEach(({ oldVal, newVal }) => {
    content = content.replaceAll(oldVal, newVal)
  })
  return content;
}

const replaceMdImages = async (fileName, cosOptions = {}) => {
  const content = readFile(fileName)
  const images = getImages(content)
  console.log('文件中包含如下图片: ', JSON.stringify(images, undefined, 2))
  const replaceInfos = await uploadImagesToCos(images, cosOptions)
  console.log('上传cos后的图片地址: ', JSON.stringify(replaceInfos, undefined, 2))
  const newContent = replaceMarkdownImageUrls(content, replaceInfos)
  const newFileName = fileName.substring(0, fileName.length - 3) + '_replaced.md'
  fs.writeFileSync(newFileName, newContent, 'utf-8')
  // 上传cos
  const previewUrl = await upload({ buffer: Buffer.from(newContent, 'utf-8'), fileName: newFileName }, cosOptions)
  return {
    newFileName,
    newContent,
    previewUrl
  }
}

module.exports = {
  replaceMdImages
}