require('dotenv').config()

// see .env for bot config options info
module.exports = {
  twitter_account: process.env.TWITTER_ACCOUNT,
  greeting: process.env.GREETING,
  track_filter: process.env.TRACK_FILTER,
  hashtags_filter: Boolean(process.env.HASHTAGS_FILTER),
  mute_tweet_filter: process.env.MUTE_TWEET_FILTER,
  blacklist: process.env.BLACKLIST,
  mute_user_filter: process.env.MUTE_USER_FILTER,  
  min_followers: Number(process.env.MIN_FOLLOWERS),
  max_friends: Number(process.env.MAX_FRIENDS),
  min_user_tweets: Number(process.env.MIN_USER_TWEETS),
  max_user_tweets: Number(process.env.MAX_USER_TWEETS),
  max_hashtags: Number(process.env.MAX_HASHTAGS),
  hourly_user_quota: Number(process.env.HOURLY_USER_QUOTA),
  hourly_retweet_quota: Number(process.env.HOURLY_RETWEET_QUOTA),
  like_mentions: Boolean(process.env.LIKE_MENTIONS),
  language: process.env.LANGUAGE,
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
}
