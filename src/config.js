require('dotenv').config()

module.exports = {
  twitter_account: process.env.TWITTER_ACCOUNT,
  greeting: process.env.GREETING,
  track_filter: process.env.TRACK_FILTER,
  hashtags_filter: process.env.HASHTAGS_FILTER,  
  mute_tweet_filter: process.env.MUTE_TWEET_FILTER,
  blacklist: process.env.BLACKLIST,
  mute_user_filter: process.env.MUTE_USER_FILTER,  
  min_followers: Number(process.env.MIN_FOLLOWERS),
  max_friends: Number(process.env.MAX_FRIENDS),
  min_user_tweets: Number(process.env.MIN_USER_TWEETS),
  max_user_tweets: Number(process.env.MAX_USER_TWEETS),
  max_hashtags: Number(process.env.MAX_HASHTAGS),
  max_hourly_user_retweets: Number(process.env.MAX_HOURLY_USER_RETWEETS),
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
}
