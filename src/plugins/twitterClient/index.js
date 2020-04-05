import fsp from "@absolunet/fsp"
import crypto from "crypto"
import dataUrls from "data-urls"
import ensureArray from "ensure-array"
import filesize from "filesize"
import globby from "globby"
import hasContent from "has-content"
import mimeTypes from "mime-types"
import OauthClient from "oauth-1.0a"
import path from "path"
import pify from "pify"
import queryString from "query-string"
import tempfile from "tempfile"
import Twit from "twit"

import core, {config, logger} from "src/core"

/**
 * @typedef {Object} User
 * @prop {string} internalId
 * @prop {string} id
 * @prop {string} handle
 * @prop {string} oauthToken
 * @prop {string} oauthTokenSecret
 * @prop {Twit} twit
 */

const oauthHasher = (text, key) => crypto.createHmac("sha1", key).update(text).digest("base64")

class TwitterClient {

  constructor() {
    this.usersFolder = path.join(logger.appFolder, "users")
  }

  async init() {
    this.oauthClient = new OauthClient({
      hash_function: oauthHasher,
      consumer: {
        key: config.twitterConsumerKey,
        secret: config.twitterConsumerSecret,
      },
      signature_method: "HMAC-SHA1",
    })
    const userFiles = await globby("*/credentials.yml", {
      cwd: this.usersFolder,
      onlyFiles: true,
      absolute: true,
    })
    const loadUsersJobs = userFiles.map(async file => {
      const user = await fsp.readYaml(file)
      const twit = new Twit({
        access_token: user.oauthToken,
        access_token_secret: user.oauthTokenSecret,
        consumer_key: config.twitterConsumerKey,
        consumer_secret: config.twitterConsumerSecret,
      })
      user.twit = pify(twit, {
        multiArgs: true,
        include: ["postMediaChunked"],
        excludeMain: true,
      })
      return user
    })
    /**
     * @type {User[]}
     */
    this.users = await Promise.all(loadUsersJobs)
    logger.info("Started twitterClient with %s users", this.users.length)
    logger.debug("Callback: %s", config.callbackUrl)
  }

  getUserByInternalId(id) {
    const idNormalized = String(id).toLowerCase()
    return this.users.find(({internalId}) => internalId === idNormalized)
  }

  getFolderForUser(internalId) {
    return path.join(this.usersFolder, internalId)
  }

  getCredentialsPathForUser(internalId) {
    return path.join(this.getFolderForUser(internalId), "credentials.yml")
  }

  /**
   * @return {Promise<Object>}
   */
  async getRequestToken() {
    const requestOptions = {
      url: "https://api.twitter.com/oauth/request_token",
      data: {
        oauth_callback: config.callbackUrl,
      },
    }
    const response = await this.signGot(requestOptions)
    return queryString.parse(response.body)
  }

  async signGot(options, oauthToken) {
    options = {
      method: "POST",
      ...options,
    }
    const signedOauthRequest = this.oauthClient.authorize(options, oauthToken)
    return core.got(options.url, {
      method: options.method,
      form: options.data,
      headers: this.oauthClient.toHeader(signedOauthRequest),
    })
  }

  /**
   * @param {string} internalId
   * @param {string} text
   * @param {string|string[]} media
   * @return {Promise<Object>}
   */
  async tweet(internalId, text, media) {
    try {
      const user = this.getUserByInternalId(internalId)
      if (!user) {
        throw new Error("User not found")
      }
      const postOptions = {
        status: text,
      }
      if (hasContent(media)) {
        const base64Files = ensureArray(media)
        const jobs = base64Files.map(async base64File => {
          const {body, mimeType} = dataUrls(base64File)
          const suffix = mimeTypes.extension(mimeType.essence)
          const file = tempfile(`.${suffix}`)
          await fsp.outputFile(file, body)
          const [{media_id_string: mediaId}] = await user.twit.postMediaChunked({
            file_path: file,
          })
          logger.debug(`Wrote ${filesize(body.length)} to ${suffix} file`)
          return mediaId
        })
        postOptions.media_ids = await Promise.all(jobs)
      }
      const response = await user.twit.post("statuses/update", postOptions)
      return response.data
    } catch (error) {
      logger.error("Could not tweet for @%s: %s", internalId, error)
    }
  }

  async uploadMedia(internalId, file, text) {
    try {
      const user = this.getUserByInternalId(internalId)
      if (!user) {
        throw new Error("User not found")
      }
      const [{media_id_string: mediaId}] = await user.twit.postMediaChunked({
        file_path: file,
      })
      logger.debug("Media %s", mediaId)
      if (hasContent(text)) {
        logger.debug(`Text: ${text}`)
      }
      await user.twit.post("statuses/update", {
        status: text,
        media_ids: mediaId,
      })
    } catch (error) {
      logger.error("Could not post media %s for @%s: %s", file, internalId, error)
    }
  }

}

export default new TwitterClient