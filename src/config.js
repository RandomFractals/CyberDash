require('dotenv').config()

module.exports = {
  twitter_account: process.env.TWITTER_ACCOUNT,
  track_filter: process.env.TRACK_FILTER,
  hashtags_filter: process.env.HASHTAGS_FILTER,
  min_followers: process.env.MIN_FOLLOWERS,
  blacklist: process.env.BLACKLIST,
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
}
