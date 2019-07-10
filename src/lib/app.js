import http from "http"
import https from "https"

import config from "lib/config"
import logger from "lib/logger"
import express from "express"

debugger

const app = express()
http.createServer(app).listen(config.apiPort)
http.createServer(app).listen(config.apiSslPort)

export default app