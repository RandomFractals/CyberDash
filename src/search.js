const log4js = require('log4js')
const config = require('./config')
const TwitterBot = require('./bot')
const bot = new TwitterBot(config)

// create search logger
logger = log4js.getLogger('search')
logger.level = config.log_level

// subscirbe to user events
const userStream = bot.twitter.stream('user')
userStream.on('follow', event => bot.helloFriend(event)) // say hello :)

// check whitelist every hour
setInterval(() => bot.updateWhitelist, 60 * 60 * 1000)

// check blacklist every 15 minutes
setInterval(() => bot.updateBlacklist, 15 * 60 * 1000)

// check for mentions every 10 minutes
setInterval(() => bot.likeMentions, 10 * 60 * 1000)

// search tweets every 15 minutes
setInterval(() => searchTweets, 15 * 60 * 1000)

// call the first search
let since_tweet_id = 0
searchTweets()

/**
 * Searches Twitter for matching tweets to RT.
 * 
 * See: https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets.html
 */
function searchTweets() {
  bot.twitter.get('search/tweets', {
    q: `#cyberSec #hacking AND -filter:replies AND -filter:retweets`,
    count: 20, // max tweets to analyze every 15 minutes
    result_type: 'recent',
    since_id: since_tweet_id,
    lang: config.language
  })
  .then( response => {
    // process tweet search results
    //console.log(JSON.stringify(response.data, null, '\t'))
    response.data.statuses.forEach(tweet => {
      bot.processTweet(tweet)
      logger.info(`>@${tweet.user.screen_name}: \n${tweet.text}`)
    })
    // update since tweet id for the next twitter search
    since_tweet_id = response.data.search_metadata.max_id
    logger.info('search_metadata:', response.data.search_metadata)
  })
  .catch( err => {
    bot.logger.error(`Failed to get 'search/tweets' results!`, err)
  })
}