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
    app.post("/tweet", bodyParser.json({limit: "20mb"}), async (request, response) => {
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
              const mediaFile = path.join(mediaFolder, "original.png")
              await fsp.outputFile(mediaFile, body)
              logger.info("Saved media %s, %s bytes", mediaFile, size)
              await twitterClient.uploadMedia(handle, mediaFile, request.body.text)
              response.send("Yes")
              return
            }
          }
        }
        logger.info("[User %s] @%s: %s", request.body.apiUser, handle, request.body.text)
        await twitterClient.tweet(handle, request.body.text)
        response.send({status: "Yes"})
      } catch (error) {
        logger.error("Could not handle /tweet request: %s", error)
      }
    })
    logger.info("Started API server")
  }

}

export default new Api