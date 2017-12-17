const Twit = require('twit')
const config = require('./config')
const Twitter = new Twit(config)

const whitelist = {}
const blacklist = {}

/**
 * Create a whitelist from the Twitter bot account friends/list.
 */
Twitter.get('friends/list', {
  screen_name: config.twitter_account, 
  count: 100 // max whitelist size for now
}, (err, data, response) => {
  if (err) {
    console.log('Failed to get friends/list!', err)
  } 
  else {
    console.log('\nWhitelist:')
    console.log('------------------------------')
    data.users.forEach(user => {
      // add a 'friend' to the whitelist
      whitelist[user.screen_name] = user
      console.log(user.screen_name)      
    })
    console.log('...')
  }
})

// get blacklist Twitter list name from config
const blacklistName = config.blacklist

/**
 * Create a blacklist from configured Twitter list members
 */
Twitter.get('lists/members', {
  slug: blacklistName,
  owner_screen_name: config.twitter_account, 
  count: 100 // max blacklist size for now
}, (err, data, response) => {
  if (err) {
    console.log(`Failed to get 'blacklist' lists/members!`, err)
  } 
  else {
    console.log('\nBlacklist:')
    console.log('------------------------------')    
    console.log(`@${config.twitter_account}/lists/${blacklistName}`)
    console.log('------------------------------')
    data.users.forEach(user => {
      // update blacklist
      blacklist[user.screen_name] = user
      console.log(user.screen_name)      
    })
    console.log('...')
    console.log('Processing realtime tweets...')    
  }
})

// get a list of configured track filter keywords
let keywords = config.track_filter.split(',').map(keyword => keyword.toLowerCase())
if (config.hashtags_filter) {
  // convert them to hashtags
  keywords = keywords.map(keyword => ('#' + keyword))
}
console.log('RT Filter:\n------------------------------')
console.log(keywords)

// get required min followers for processing a tweet from 'unknown' user
const minFollowers = Number(config.min_followers)
console.log('minFollowers:', minFollowers)

// get max friends to check for tweeps that follow the universe
const maxFriends = Number(config.max_friends)
console.log('maxFriends:', maxFriends)

// get max hashtags to skip tweets from marketing bots
const maxHashtags = Number(config.max_hashtags)
console.log('maxHashtags:', maxHashtags)

/**
 * Start listenting for relevant tweets via realtime Twitter filter
 * 
 * see: https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
 */
const filterStream = Twitter.stream('statuses/filter', {
  track: config.track_filter
})

// process each tweet
filterStream.on('tweet', tweet => {
  // check user stats
  const userChecksOut = whitelist[tweet.user.screen_name] !== undefined ||
    (!tweet.user.verified && // skip verified users
      blacklist[tweet.user.screen_name] === undefined && // not blacklisted
      tweet.user.followers_count >= minFollowers && // min required for 'unknown' tweeps
      tweet.user.friends_count < maxFriends) // skip tweets from tweeps that follow the universe

  // check tweet stats
  const worthRT = tweet.entities.urls.length > 0 && // has a link
    tweet.entities.hashtags.length <= maxHashtags && // not too spammy
    tweet.in_reply_to_status_id_str === null && // not a reply
    !tweet.text.startsWith('RT ') &&
    !tweet.retweeted // skip retweets

  if (userChecksOut && worthRT) {
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
  console.log(`followers: ${tweet.user.followers_count} | tweets: ${tweet.user.statuses_count}`)  
  console.log('matches:', keywords)
  console.log('hashtags:', tweet.entities.hashtags)
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

/**
 * Prints out 20 followers for the configured Twitter bot account
 * to test Twitter API OAth, etc.
 */
function listFollowers () {
  Twitter.get('followers/list', {
    screen_name: config.twitter_account, 
    count: 20
  }, (err, data, response) => {
    if (err) {
      console.log('Failed to get followers/list', err)
    } 
    else {
      console.log(`\n${config.twitter_account} Followers:`)
      console.log('------------------------------')
      data.users.forEach(user => {
        console.log(user.screen_name)
      })
      console.log('...')
    }
  })
}