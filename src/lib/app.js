import http from "http"
import https from "https"

import config from "lib/config"
import logger from "lib/logger"
import express from "express"

const app = express()
http.createServer(app).listen(config.apiPort)
https.createServer(app).listen(config.apiSslPort)

export default app