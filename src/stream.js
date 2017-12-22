const config = require('./config')
const TwitterBot = require('./bot')
const bot = new TwitterBot(config)

// start listenting for relevant tweets via realtime Twitter filter
// see: https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
const filterStream = bot.twitter.stream('statuses/filter', {
  track: config.track_filter,
  language: config.language
})

// process each tweet from the filter stream
filterStream.on('tweet', tweet => bot.processTweet(tweet))
