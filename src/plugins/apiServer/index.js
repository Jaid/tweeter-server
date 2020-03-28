import fsp from "@absolunet/fsp"
import dataUrls from "data-urls"
import ensureArray from "ensure-array"
import {router} from "fast-koa-router"
import hasContent from "has-content"
import koaBodyparser from "koa-bodyparser"
import path from "path"
import shortid from "shortid"

import getBodyParser from "lib/getBodyParser"

import core, {appFolder, logger} from "src/core"
import twitterClient from "src/plugins/twitterClient"

export default class ApiServer {

  handleConfig(config) {
    /**
     * @type {ApiUser[]}
     */
    this.apiUsers = ensureArray(config.apiUser)
    this.twitCredentials = {
      consumer_key: config.twitterConsumerKey,
      consumer_secret: config.twitterConsumerSecret,
    }
    this.apiPayloadLimit = config.apiPayloadLimit
  }

  async init() {
    const auth = this.auth.bind(this)
    const getCredentials = this.getCredentials.bind(this)
    const bodyParser = koaBodyparser({
      formLimit: this.apiPayloadLimit,
      textLimit: this.apiPayloadLimit,
      jsonLimit: this.apiPayloadLimit,
      strict: false,
    })
    const routes = {
      post: {
        "/tweet": [bodyParser, auth, this.handleTweet.bind(this)],
        "/credentials": [bodyParser, auth, getCredentials],
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
    for (const requiredArgument of ["text", "handle"]) {
      context.assert(requestBody?.hasOwnProperty(requiredArgument), 400, `body.${requiredArgument} not given`)
    }
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
    logger.info("[User %s] @%s: %s", context.apiUser.user, handle, requestBody.text)
    await twitterClient.tweet(handle, requestBody.text)
    context.body = {status: "OK"}
  }

  /**
   * @param {import("koa").Context} context
   * @return {Promise<void>}
   */
  async auth(context, next) {
    const requestBody = context.request.body
    context.assert(hasContent(requestBody.apiUser), 403, "apiUser not given in JSON body")
    context.assert(hasContent(requestBody.apiKey), 403, "apiKey not given in JSON body")
    context.apiUser = this.apiUsers.find(apiUser => apiUser.user === requestBody.apiUser)
    context.assert(context.apiUser, 403, "apiUser not found")
    context.assert(context.apiUser.key === requestBody.apiKey, 403, "Wrong apiKey")
    await next()
  }

  /**
   * @param {import("koa").Context} context
   * @return {Promise<void>}
   */
  async getCredentials(context) {
    const handle = context.request.body.handle
    const twitterUser = twitterClient.getUserByInternalId(handle)
    context.assert(twitterUser, 400, `No Twitter user found for ${handle}`)
    context.body = {
      ...this.twitCredentials,
      access_token: twitterUser.oauthToken,
      access_token_secret: twitterUser.oauthTokenSecret,
    }
  }

}