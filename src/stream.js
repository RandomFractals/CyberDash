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
    console.log(`\n@${config.twitter_account} Followers:`)
    data.users.forEach(user => {
      console.log(user.screen_name)
    })
  }
})

// get a list of configured track filter keywords
const keywords = config.track_filter.split(',').map(keyword => keyword.toLowerCase())
console.log('Filter:', keywords)

// get min followers for processing a tweet
const minFollowers = Number(config.min_followers)

/**
 * Creates filtered realtime tweets feed for testing.
 * 
 * see: https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
 */
const filterStream = Twitter.stream('statuses/filter', {
  track: config.track_filter
});

filterStream.on('tweet', tweet => {
  if (Number(tweet.user.followers_count) >= minFollowers &&
      tweet.entities.urls.length > 0 && // has a link
      tweet.in_reply_to_status_id_str === null && // not a reply
      !tweet.text.startsWith('RT ') &&
      !tweet.retweeted) { // skip retweets
    logTweet(tweet)
    //retweet(tweet)
  }
})

/**
 * Prints out tweet text and stats.
 * 
 * @param tweet Tweet info to log.
 */
function logTweet (tweet) {
  let tweetText = tweet.text
  if (tweet.truncated) {
    // get full text
    tweetText = tweet.extended_tweet.full_text
  }
  console.log(`\n${tweet.user.screen_name}: ${tweetText}`)
  
  // check keyword matches
  let matches = ''
  tweetText = tweetText.toLowerCase()
  keywords.forEach(keyword => {
    if (tweetText.indexOf(keyword) >= 0) {
      matches += keyword + ' '
    }
  })
  if (matches.length > 0) {
    console.log('matches:', matches)
  }
  
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
      console.log(tweet.user.screen_name, '>RT:', tweet.text)
    }
    if (err) {
      console.error('failed to RT', tweet)
    }
  })
}

