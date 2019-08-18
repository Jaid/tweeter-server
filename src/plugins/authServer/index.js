import core, {koa, logger} from "src/core"
import queryString from "query-string"
import fsp from "@absolunet/fsp"
import {router} from "fast-koa-router"
import twitterClient from "src/plugins/twitterClient"

import generateHtml from "./login.hbs"

export default class AuthServer {

  async init() {
    this.koa = core.koa
    const routes = {
      get: {
        "/login": this.handleLogin,
        "/callback": this.handleCallback,
        "/done": this.handleDone,
      },
    }
    koa.use(router(routes))
  }

  /**
   * @param {import("koa").Context} context
   * @return {Promise<void>}
   */
  async handleLogin(context) {
    const requestToken = await twitterClient.getRequestToken()
    if (!requestToken?.oauth_token) {
      logger.error("Could not retrieve a token")
      throw new Error("Could not retrieve a token")
    }
    context.body = generateHtml({requestToken})
  }

  /**
   * @param {import("koa").Context} context
   * @return {Promise<void>}
   */
  async handleCallback(context) {
    const oauthToken = context.query.oauth_token
    const oauthVerifier = context.query.oauth_verifier
    const gotResponse = await twitterClient.signGot({
      url: "https://api.twitter.com/oauth/access_token",
      data: {
        oauth_token: oauthToken,
        oauth_verifier: oauthVerifier,
      },
    })
    const responseBody = gotResponse.body |> queryString.parse
    const internalId = responseBody.screen_name.toLowerCase()
    const outputPath = twitterClient.getCredentialsPathForUser(internalId)
    logger.info("Saving new credentials of %s to %s", responseBody.screen_name, outputPath)
    await fsp.outputYaml(outputPath, {
      internalId,
      id: responseBody.user_id,
      handle: responseBody.screen_name,
      oauthToken: responseBody.oauth_token,
      oauthTokenSecret: responseBody.oauth_token_secret,
    })
    context.redirect("/done")
  }

  /**
   * @param {import("koa").Context} context
   * @return {Promise<void>}
   */
  async handleDone(context) {
    context.body = "Done."
  }

}