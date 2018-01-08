require('dotenv').config()

// see .env for bot config options info
module.exports = {
  twitter_account: process.env.TWITTER_ACCOUNT,
  greeting: process.env.GREETING,
  // tweet and user filters
  track_filter: process.env.TRACK_FILTER,
  search_query: process.env.SEARCH_QUERY,
  hashtags_filter: Boolean(process.env.HASHTAGS_FILTER),
  mute_tweet_filter: process.env.MUTE_TWEET_FILTER,
  mute_tweet_links_filter: process.env.MUTE_TWEET_LINKS_FILTER,  
  blacklist: process.env.BLACKLIST,
  mute_user_filter: process.env.MUTE_USER_FILTER,  
  // user/tweets min/max filters
  min_user_followers: Number(process.env.MIN_USER_FOLLOWERS),
  min_user_friends: Number(process.env.MIN_USER_FRIENDS),
  max_user_friends: Number(process.env.MAX_USER_FRIENDS),
  min_user_tweets: Number(process.env.MIN_USER_TWEETS),
  max_user_tweets: Number(process.env.MAX_USER_TWEETS),
  max_tweet_hashtags: Number(process.env.MAX_TWEET_HASHTAGS),
  hourly_user_quota: Number(process.env.HOURLY_USER_QUOTA),
  hourly_retweet_quota: Number(process.env.HOURLY_RETWEET_QUOTA),
  // bot config vars
  like_mentions: Boolean(process.env.LIKE_MENTIONS),
  like_retweets: Boolean(process.env.LIKE_RETWEETS),
  language: process.env.LANGUAGE,
  log_level: process.env.LOG_LEVEL,
  mode: process.env.MODE,
  // rate quoted tweet vars
  rating_scale: Number(process.env.RATING_SCALE),
  positive_emoji: process.env.POSITIVE_EMOJI,
  negative_emoji: process.env.NEGATIVE_EMOJI,
  neutral_emoji: process.env.NEUTRAL_EMOJI,
  sentiment_test: process.env.SENTIMENT_TEST,
  // Twitter API keys
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
}
