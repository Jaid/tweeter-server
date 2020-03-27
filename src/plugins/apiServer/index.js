import fsp from "@absolunet/fsp"
import dataUrls from "data-urls"
import ensureArray from "ensure-array"
import {router} from "fast-koa-router"
import path from "path"
import shortid from "shortid"

import bodyParser from "lib/bodyParser"

import core, {appFolder, logger} from "src/core"
import twitterClient from "src/plugins/twitterClient"

export default class ApiServer {

  handleConfig(config) {
    /**
     * @type {ApiUser[]}
     */
    this.apiUsers = ensureArray(config.apiUser)
  }

  getApiUser(user, key) {
    return this.apiUsers.find(apiUser => apiUser.user === user && apiUser.key === key)
  }

  async init() {
    const routes = {
      post: {
        "/tweet": [bodyParser, this.handleTweet.bind(this)],
      },
    }
    core.koa.use(router(routes))
  }

  /**
   * @typedef {Object} TweetRequest
   * @prop {string} text
   * @prop {string} handle
   * @prop {string} apiUser
   * @prop {string} apiKey
   * @prop {string|string[]} media
   */

  /**
   * @param {import("koa").Context} context
   * @return {Promise<void>}
   */
  async handleTweet(context) {
    /**
     * @type {TweetRequest}
     */
    const requestBody = context.request.body
    logger.debug("Got post data with keys %s", Object.keys(requestBody).join())
    for (const requiredArgument of ["text", "handle", "apiUser", "apiKey"]) {
      context.assert(requestBody?.hasOwnProperty(requiredArgument), 400, `body.${requiredArgument} not given`)
    }
    const apiUser = this.getApiUser(requestBody.apiUser, requestBody.apiKey)
    context.assert(apiUser, 400, "Invalid API User")
    const handle = requestBody.handle.toLowerCase()
    if (requestBody.media) {
      for (const dataUrl of ensureArray(requestBody.media)) {
        const {body, mimeType} = dataUrls(dataUrl)
        const size = body.length
        logger.info(`Got media of type ${mimeType.essence}, ${mimeType.type}`)
        if (mimeType.type === "image") {
          const mediaId = shortid()
          const mediaFolder = path.join(appFolder, "media", handle, mediaId)
          const mediaFile = path.join(mediaFolder, "original.png")
          await fsp.outputFile(mediaFile, body)
          logger.debug("Saved media %s, %s bytes", mediaFile, size)
          await twitterClient.uploadMedia(handle, mediaFile, requestBody.text)
          context.body = {status: "OK"}
          return
        }
      }
    }
    logger.info("[User %s] @%s: %s", requestBody.apiUser, handle, requestBody.text)
    await twitterClient.tweet(handle, requestBody.text)
    context.body = {status: "OK"}
  }

}