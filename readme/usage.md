Create Twitter apps [here](https://apps.twitter.com).

### Access token from Twitter

If the developer account (= the account the Twitter app is created with) and the bot account (= the account that automatically posts tweets) are the same, the login process over `tweeter-server`'s Koa server is not needed. Instead, all keys can be specified in `secrets.yml`:

```yaml
twitterApps:
  myApp:
    consumerKey: a
    consumerSecret: b
    accessToken: c
    accessTokenSecret: d
```

### Access token from Tweeter Server

If the developer account and the bot account are different, only specify the Twitter app's credentials in `secrets.yml`:

```yaml
twitterApps:
  myApp:
    consumerKey: a
    consumerSecret: b
```

And then visit `tweeter-server`'s login endpoint in a web browser where the bot account is logged in.