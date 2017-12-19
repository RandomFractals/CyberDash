require('dotenv').config()

module.exports = {
  twitter_account: process.env.TWITTER_ACCOUNT,
  greeting: process.env.GREETING,
  track_filter: process.env.TRACK_FILTER,
  hashtags_filter: process.env.HASHTAGS_FILTER,
  blacklist: process.env.BLACKLIST,  
  min_followers: Number(process.env.MIN_FOLLOWERS),
  max_friends: Number(process.env.MAX_FRIENDS),
  max_hashtags: Number(process.env.MAX_HASHTAGS),
  max_tweets: Number(process.env.MAX_TWEETS),
  user_description_filter: process.env.USER_DESCRIPTION_FILTER,
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
}
