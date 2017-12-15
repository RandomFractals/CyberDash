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

/**
 * Creates filtered realtime tweets feed for testing.
 * 
 * see: https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
 */
const filterStream = Twitter.stream('statuses/filter', {
  track: config.track_filter
});

filterStream.on('tweet', t => {
  console.log(`\n${t.user.screen_name}: ${t.text}`)

  // check keyword matches
  let matches = ''
  keywords.forEach(keyword => {
    if (t.text.indexOf(keyword) >= 0) {
      matches += keyword + ' '
    }
  })
  if (matches.length > 0) {
    console.log('matches:', matches)
  }

  // print out other stats for analysis later
  console.log(`followers: ${t.user.followers_count} | tweets: ${t.user.statuses_count}`)
  //console.log(t)
})
