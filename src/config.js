require('dotenv').config()

module.exports = {
  twitter_account: process.env.TWITTER_ACCOUNT,
  track_filter: process.env.TRACK_FILTER,
  hashtags_filter: process.env.HASHTAGS_FILTER,
  blacklist: process.env.BLACKLIST,  
  min_followers: process.env.MIN_FOLLOWERS,
  max_friends: process.env.MAX_FRIENDS,
  max_hashtags: process.env.MAX_HASHTAGS,
  max_tweets: process.env.MAX_TWEETS,
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
}
