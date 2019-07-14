import path from "path"

import logger from "lib/logger"
import config, {appFolder} from "lib/config"
import app from "lib/app"
import bodyParser from "body-parser"
import twitterClient from "src/twitterClient"
import ensureArray from "ensure-array"
import dataUrls from "data-urls"
import fsp from "@absolunet/fsp"
import shortid from "shortid"
import jimp from "jimp/es"

/**
 * @typedef ApiUser
 * @type {Object}
 * @prop {string} user
 * @prop {string} key
 */

class Api {

  constructor() {
    /**
     * @type {ApiUser[]}
     */
    this.apiUsers = ensureArray(config.apiUser)
  }

  getApiUser(user, key) {
    return this.apiUsers.find(apiUser => apiUser.user === user && apiUser.key === key)
  }

  async init() {
    app.post("/tweet", bodyParser.json(), async (request, response) => {
      try {
        logger.debug("Got post data with keys %s", Object.keys(request.body).join())
        for (const requiredArgument of ["text", "handle", "apiUser", "apiKey"]) {
          if (!request.body?.[requiredArgument]) {
            response.send(`body.${requiredArgument} not given`)
            return
          }
        }
        const apiUser = this.getApiUser(request.body.apiUser, request.body.apiKey)
        if (!apiUser) {
          response.send("Invalid API User")
          logger.warn("Someone tried to send a tweet with user %s and key %s", request.body.apiUser, request.body.apiKey)
          return
        }
        const handle = request.body.handle.toLowerCase()
        if (request.body.media) {
          for (const dataUrl of ensureArray(request.body.media)) {
            const {body, mimeType} = dataUrls(dataUrl)
            const size = body.length
            logger.info(`Got media of type ${mimeType.essence}, ${mimeType.type}`)
            if (mimeType.type === "image") {
              const mediaId = shortid()
              const mediaFolder = path.join(appFolder, "media", handle, mediaId)
              const originalMediaFile = path.join(mediaFolder, "original.png")
              const optimizedMediaFile = path.join(mediaFolder, "optimized.png")
              await fsp.outputFile(optimizedMediaFile, body)
              const jimpImage = await jimp.read(body)
              const pixelIndex = jimpImage.getPixelIndex(0, 0)
              jimpImage.bitmap.data[pixelIndex + 3] = 0
              await jimpImage.writeAsync(optimizedMediaFile)
              logger.info("Saved media %s, %s bytes", mediaId, size)
              await twitterClient.uploadMedia(handle, originalMediaFile, request.body.text)
            }
          }
        }
        logger.info("[User %s] @%s: %s", request.body.apiUser, handle, request.body.text)
        const tweetResult = await twitterClient.tweet(handle, request.body.text)
        if (tweetResult.statusCode !== 200) {
          logger.warn("Sending tweet may not have worked. Got %s %s", tweetResult.statusCode, tweetResult.statusMessage)
        }
        response.send(tweetResult.statusMessage)
      } catch (error) {
        logger.error("Could not handle /tweet request: %s", error)
      }
    })
    logger.info("Started API server")
  }

}

export default new Api