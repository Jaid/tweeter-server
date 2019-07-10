import path from "path"

import express from "express"
import Handlebars from "handlebars"
import config from "lib/config"
import logger from "lib/logger"
import queryString from "query-string"
import fsp from "@absolunet/fsp"

import twitterClient from "./twitterClient"

const generateHtml = Handlebars.compile("<a href='https://api.twitter.com/oauth/authenticate?oauth_token={{requestToken.oauth_token}}'>Login with Twitter</a>")

class AuthServer {

  async init() {
    this.app = express()
    this.app.get("/login", async (request, response) => {
      const requestToken = await twitterClient.getRequestToken()
      response.send(generateHtml({requestToken}))
    })
    this.app.get("/callback", async (request, response) => {
      const oauthToken = request.query.oauth_token
      const oauthVerifier = request.query.oauth_verifier
      const gotResponse = await twitterClient.signGot({
        url: "https://api.twitter.com/oauth/access_token",
        data: {
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        },
      })
      const responseBody = gotResponse.body |> queryString.parse
      const internalId = responseBody.screen_name.toLowerCase()
      const outputPath = path.join(logger.appFolder, "credentials", `${internalId}.yml`)
      await fsp.outputYaml(outputPath, {
        internalId,
        id: responseBody.user_id,
        handle: responseBody.screen_name,
        oauthToken: responseBody.oauth_token,
        oauthTokenSecret: responseBody.oauth_token_secret,
      })
      response.redirect("/done")
    })
    this.app.get("/done", (request, response) => {
      response.send("Done.")
    })
    this.app.listen(config.port)
  }

}

export default new AuthServer