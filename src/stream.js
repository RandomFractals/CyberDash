const Twit = require('twit')
const config = require('./config')
const Twitter = new Twit(config)

/**
 * Prints out 20 followers for the configured Twitter account
 * to test Twitter API OAth, etc.
 */
Twitter.get('followers/list', {
  screen_name: config.twitter_account, 
  count: 20
}, (err, data, response) => {
  if (err) {
    console.log(err)
  } else {
    console.log(`\n${config.twitter_account} Followers:`)
    console.log('------------------------------')
    data.users.forEach(user => {
      console.log(user.screen_name)
    })
    console.log('...')
    console.log('Processing realtime tweets...')
  }
})

// get a list of configured track filter keywords
let keywords = config.track_filter.split(',').map(keyword => keyword.toLowerCase())
if (config.hashtags_filter) {
  keywords = keywords.map(keyword => ('#' + keyword))
}
console.log('RT Filter:\n------------------------------')
console.log(keywords)

// get required min followers for processing a tweet
const minFollowers = Number(config.min_followers)
console.log('minFollowers:', minFollowers)

// get blacklist from config
const blacklist = config.blacklist
console.log('blacklist:', blacklist)

/**
 * Creates filtered realtime tweets feed for testing.
 * 
 * see: https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
 */
const filterStream = Twitter.stream('statuses/filter', {
  track: config.track_filter
})

filterStream.on('tweet', tweet => {
  if (!tweet.user.verified &&
    tweet.user.followers_count >= minFollowers &&
    tweet.entities.urls.length > 0 && // has a link
    tweet.in_reply_to_status_id_str === null && // not a reply
    !tweet.text.startsWith('RT ') &&
    !tweet.retweeted) { // skip retweets

    // get full tweet text
    let tweetText = tweet.text
    if (tweet.truncated) {
      tweetText = tweet.extended_tweet.full_text
    }

    // get keywords
    const matchedKeywords = getKeywordMatches(tweetText)
    if (matchedKeywords.length > 0) {
      logTweet(tweet, tweetText, matchedKeywords)
      retweet(tweet)    
    }              
  }
  else {
    // log . for skipped tweets
    process.stdout.write('.')
  }
})

/**
 * Checks if tweet text actually matches filter keywords.
 * Twitter can be finicky with those keyword matches sometimes.
 * 
 * @param tweetText Full tweet text to check for keywords.
 */
function getKeywordMatches(tweetText) {  
  let keywordMatches = ''
  tweetText = tweetText.toLowerCase()
  keywords.forEach(keyword => {
    if (tweetText.indexOf(keyword) >= 0) {
      keywordMatches += keyword + ' '
    }
  })
  return keywordMatches
}

/**
 * Prints out tweet text and stats.
 * 
 * @param tweet Tweet info to log
 * @param tweetText Full tweet text
 * @param keywords matched keywords
 */
function logTweet (tweet, tweetText, keywords) {
  console.log(`\n${tweet.user.screen_name}: ${tweetText}`)
  console.log('matches:', keywords)
  // print out other stats for analysis later
  console.log(`followers: ${tweet.user.followers_count} | tweets: ${tweet.user.statuses_count}`)
  //console.log(tweet)
}

/**
 * Retweets a given tweet.
 * 
 * @param tweet Tweet to retweet.
 */
function retweet(tweet) {
  // retweet
  Twitter.post('statuses/retweet/:id', {id: tweet.id_str}, function(err, response) {
    if (response) {
      console.log(`RT: @${tweet.user.screen_name}: ${tweet.text}`)
    }
    if (err) {
      console.error('failed to RT', tweet)
    }
  })
}
