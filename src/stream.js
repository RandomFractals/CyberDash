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

// subscirbe to user events
const userStream = bot.twitter.stream('user')
userStream.on('follow', bot.helloFriend) // say hello :)

// check whitelist every hour
setInterval(bot.updateWhitelist, 60 * 60 * 1000)

// check blacklist every 15 minutes
setInterval(bot.updateBlacklist, 15 * 60 * 1000)

// check for mentions every 10 minutes
setInterval(bot.likeMentions, 10 * 60 * 1000)
