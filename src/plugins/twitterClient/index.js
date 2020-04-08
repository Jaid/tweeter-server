import fsp from "@absolunet/fsp"
import dataUrls from "data-urls"
import ensureArray from "ensure-array"
import filesize from "filesize"
import globby from "globby"
import hasContent, {isEmpty} from "has-content"
import mimeTypes from "mime-types"
import path from "path"
import tempfile from "tempfile"
import zahl from "zahl"

import TwitterApp from "lib/TwitterApp"
import TwitterUser from "lib/TwitterUser"

/**
 * @typedef {Object} User
 * @prop {string} internalId
 * @prop {string} id
 * @prop {string} handle
 * @prop {string} oauthToken
 * @prop {string} oauthTokenSecret
 * @prop {Twit} twit
 */

class TwitterClient {

  /**
   * @type {Object<string, TwitterApp>}
   */
  twitterApps = {}

  constructor() {
    this.usersFolder = path.join(this.logger.appFolder, "users")
  }

  handleConfig(config) {
    this.config = config
    this.twitterApps = {}
    if (hasContent(config.twitterApp?.consumerKey)) {
      this.twitterApps.main = new TwitterApp(config.twitterApp.consumerKey, config.twitterApp.consumerSecret, this)
    }
    for (const [id, {consumerKey, consumerSecret}] of Object.entries(config.twitterApps || {})) {
      this.twitterApps[id] = new TwitterApp(consumerKey, consumerSecret, this)
    }
    if (isEmpty(this.twitterApps)) {
      throw new Error("No Twitter apps defined in config!")
    }
    this.logger.info(`${zahl(this.twitterApps, "Twitter app")}: ${Object.keys(this.twitterApps).join(", ")}`)
  }

  async init() {
    const userFiles = await globby("*/credentials.yml", {
      cwd: this.usersFolder,
      onlyFiles: true,
      absolute: true,
    })
    const loadUsersJobs = userFiles.map(async file => {
      const user = await fsp.readYaml(file)
      const twitterAppId = this.config.users?.[user.internalId]?.app || "main"
      const twitterApp = this.twitterApps[twitterAppId]
      if (!twitterApp) {
        throw new Error(`User in ${file} wants to use Twitter app ${twitterAppId}, but it was not loaded`)
      }
      return new TwitterUser(user, twitterApp)
    })
    this.users = await Promise.all(loadUsersJobs)
    this.logger.info("Started twitterClient with %s users", this.users.length)
    this.logger.debug("Callback: %s", this.config.callbackUrl)
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
          this.logger.debug(`Wrote ${filesize(body.length)} to ${suffix} file`)
          return mediaId
        })
        postOptions.media_ids = await Promise.all(jobs)
      }
      const response = await user.twit.post("statuses/update", postOptions)
      return response.data
    } catch (error) {
      this.logger.error("Could not tweet for @%s: %s", internalId, error)
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
      this.logger.debug("Media %s", mediaId)
      if (hasContent(text)) {
        this.logger.debug(`Text: ${text}`)
      }
      await user.twit.post("statuses/update", {
        status: text,
        media_ids: mediaId,
      })
    } catch (error) {
      this.logger.error("Could not post media %s for @%s: %s", file, internalId, error)
    }
  }

}

export default new TwitterClient