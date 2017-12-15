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
const keywords = config.track_filter.split(',')
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
      !tweet.retweeted) { // skip retweets
    processTweet(tweet)
  }
})

/**
 * Prints out tweet text and stats.
 * 
 * @param tweet Tweet to print out.
 */
function processTweet (tweet) {
  console.log(`\n${tweet.user.screen_name}: ${tweet.text}`)
  
  // check keyword matches
  let matches = ''
  keywords.forEach(keyword => {
    if (tweet.text.indexOf(keyword) >= 0) {
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