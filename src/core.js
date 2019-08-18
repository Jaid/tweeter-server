import JaidCore from "jaid-core"

const core = new JaidCore({
  name: _PKG_TITLE,
  version: _PKG_VERSION,
  gotLogLevel: "info",
  insecurePort: 21784,
  useGot: true,
  configSetup: {
    secretKeys: [
      "twitterConsumerKey",
      "twitterConsumerSecret",
      "apiUser",
    ],
    defaults: {
      callbackUrl: "https://twitter.example.com/callback",
    },
  },
})

/**
 * @typedef ApiUser
 * @type {Object}
 * @prop {string} user
 * @prop {string} key
 */

/**
 * @typedef {Object} Config
 * @prop {string} twitterConsumerKey
 * @prop {string} twitterConsumerSecret
 * @prop {ApiUser|ApiUser[]} apiUser
 * @prop {string} callbackUrl
 */

/**
 * @type {import("jaid-logger").JaidLogger}
 */
export const logger = core.logger

/**
 * @type {import("got").GotInstance}
 */
export const got = core.got

/**
 * @type {import("jaid-core").BaseConfig & Config}
 */
export const config = core.config

/**
 * @type {string}
 */
export const appFolder = core.appFolder

/**
 * @type {import("koa")}
 */
export const koa = core.koa

export default core