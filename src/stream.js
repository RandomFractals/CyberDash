const Twit = require('twit')
const config = require('./config')
const Twitter = new Twit(config)

const whitelist = {}
const blacklist = {}
const dashes = '------------------------------'
const dots = '...'
const hashtags = /(^|\s)#([^ ]*)/g

// get a list of configured track filter keywords
config.keywords = config.track_filter.split(',').map(keyword => keyword.toLowerCase())
if (config.hashtags_filter) {
  // convert them to hashtags
  config.keywords = config.keywords.map(keyword => ('#' + keyword))
}

// get 'mute' tweet filter keywords
config.mute_tweet_keywords = config.mute_tweet_filter.split(',').map(keyword => keyword.toLowerCase())

// get a list of configured user description filter keywords
config.mute_user_keywords = config.mute_user_filter.split(',').map(keyword => keyword.toLowerCase())

// log bot config for debug
logConfig()

// create a whitelist from the Twitter bot account 'friends' list
updateWhitelist()

// create a blacklist from configured Twitter 'bot' list members
updateBlacklist()

// start listenting for relevant tweets via realtime Twitter filter
// see: https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
const filterStream = Twitter.stream('statuses/filter', {
  track: config.track_filter
})

// process each tweet from the filter stream
filterStream.on('tweet', tweet => processTweet(tweet))

// subscirbe to user events
const userStream = Twitter.stream('user')
userStream.on('follow', helloFriend) // say hello :)

// check blacklist every 15 minutes
setInterval(updateBlacklist, 15 * 60 * 1000)

// check whitelist every hour
setInterval(updateWhitelist, 60 * 60 * 1000)


/* ------------------------------- Stream Processing Methods ------------------------------------ */

/**
 * Main process tweet method.
 * 
 * @param tweet Tweet json object
 */
function processTweet(tweet) {
  // check user stats
  const isFriend = (whitelist[tweet.user.screen_name] !== undefined)
  const blacklisted = (blacklist[tweet.user.screen_name] !== undefined)
  const muteUser = (
    getKeywordMatches(
      tweet.user.description, 
      config.mute_user_keywords
    ).length > 0
  )
  const userChecksOut = (isFriend && !blacklisted) || // friends can be blacklisted :(
  (!blacklisted && 
    !tweet.user.verified && // skip verified 'unknown' users for now
    !muteUser && // 
    tweet.user.followers_count >= config.min_followers && // min required for 'unknown' tweeps
    tweet.user.friends_count < config.max_friends && // skip tweets from tweeps that follow the universe
    tweet.user.statuses_count < config.max_tweets) // most likely just another news bot

  // check tweet stats
  const isRetweet = (tweet.retweeted_status !== undefined)
  const worthRT = (isFriend || tweet.entities.urls.length > 0) && // RT friends and tweets with links
    tweet.entities.hashtags.length <= config.max_hashtags && // not too spammy
    tweet.in_reply_to_status_id_str === null && // not a reply
    !tweet.text.startsWith('RT ') && !isRetweet // skip retweets
    //!tweet.retweeted // RT only tweets without any retweets

  if (userChecksOut && worthRT) {
    // get full tweet text
    let tweetText = tweet.text
    if (tweet.truncated) {
      tweetText = tweet.extended_tweet.full_text
    }

    // get keywords
    const matchedKeywords = getKeywordMatches(tweetText, config.keywords)
    const muteKeywords = getKeywordMatches(tweetText, config.mute_tweet_keywords)
    if (muteKeywords.length <= 0 &&
        matchedKeywords.length > 0 &&
        matchedKeywords.split(' ').length <= config.max_hashtags &&
        tweetText.match(hashtags).length <= config.max_hashtags) {
      logTweet(tweet, tweetText, matchedKeywords)
      retweet(tweet)
    }
  }
  else {
    // log . for skipped tweets
    process.stdout.write('.')
  }
} // end of processTweet(tweet)


/**
 * Checks if tweet text or user description matches filter keywords.
 * Twitter can be finicky with those keyword matches sometimes.
 * 
 * @param text Full tweet text or user info to check for keywords.
 * @param keywords Keywords list to check.
 */
function getKeywordMatches(text, keywords) {
  let keywordMatches = ''
  if (text) {
    text = text.toLowerCase()
    keywords.forEach(keyword => {
      if (text.indexOf(keyword) >= 0) {
        keywordMatches += keyword + ' '
      }
    })
  }
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
  console.log(`\n@${tweet.user.screen_name}: ${tweetText}`)
  console.log(dots)
  console.log(`matches: ${keywords} | links: ${tweet.entities.urls.length}`)
  console.log('hashtags:', tweet.entities.hashtags.map(hashtag => hashtag.text))
  console.log(dots)
  console.log(`@${tweet.user.screen_name}:`,
    `tweets: ${tweet.user.statuses_count}`,
    `| friends: ${tweet.user.friends_count}`,
    `| followers: ${tweet.user.followers_count}`
  )
  console.log(tweet.user.description)
  //console.log(tweet)
}


/**
 * Retweets a given tweet.
 * 
 * @param tweet Tweet to retweet
 */
function retweet(tweet) {
  // retweet
  Twitter.post('statuses/retweet/:id', {id: tweet.id_str}, function(err, response) {
    if (response) {
      console.log(dashes)
      console.log(`>RT: @${tweet.user.screen_name}: ${tweet.text}`)
      console.log(dashes)
    }
    if (err) {
      console.error('failed to RT', tweet)
    }
  })
}


/**
 * Sends 'Hello friend.' to new follower.
 */
function helloFriend(event) {
  const friendName = event.source.name
  const friendScreenName = event.source.screen_name
  if (friendScreenName !== config.twitter_account) { // not us
    console.log('\nnew follower:', friendScreenName)
    // DM our greeting to new follower
    Twitter.post('direct_messages/new', {
      screen_name: friendScreenName,
      text: config.greeting
    }, (err, data, response) => {
      if (err) {
        console.log('Failed to send greeting DM', err)
      } else {
        console.log('Greeting DM sent.', data)
      }
    })
  }
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
      console.log(dashes)
      data.users.forEach(user => {
        console.log(user.screen_name)
      })
      console.log(dots)
    }
  })
}


/**
 * Logs bot config for debug.
 */
function logConfig () {
  console.log('RT Filter:')
  console.log(dashes)
  console.log(config.keywords)
  console.log('mute_tweet_filter:', config.mute_tweet_filter)
  console.log('mute_user_filter:', config.mute_user_filter)
  console.log('max_tweets:', config.max_tweets.toLocaleString())
  console.log('max_friends:', config.max_friends.toLocaleString())
  console.log('min_followers:', config.min_followers.toLocaleString())
  console.log('max_hashtags:', config.max_hashtags.toLocaleString())
}


/**
 * Updates whitelist with 'friends'.
 */
function updateWhitelist() {
  Twitter.get('friends/list', {
    screen_name: config.twitter_account,
    count: 100 // max whitelist size for now
  }, (err, data, response) => {
    if (err) {
      console.log('Failed to get friends/list!', err)
    }
    else {
      console.log('\nWhitelist:')
      console.log(dashes)
      data.users.forEach(user => {
        // add a 'friend' to the whitelist
        whitelist[user.screen_name] = user
        console.log(user.screen_name)
      })
      console.log(dots)
    }
  })
}


/**
 * Updates blacklist from Twitter 'bot' list.
 */
function updateBlacklist() {
  Twitter.get('lists/members', {
    slug: config.blacklist,
    owner_screen_name: config.twitter_account,
    count: 100 // max blacklist size for now
  }, (err, data, response) => {
    if (err) {
      console.log(`Failed to get 'blacklist' lists/members!`, err)
    }
    else {
      console.log('\nBlacklist:')
      console.log(dashes)
      console.log(`@${config.twitter_account}/lists/${config.blacklist}`)
      console.log(dashes)
      data.users.forEach(user => {
        // update blacklist
        blacklist[user.screen_name] = user
        console.log(user.screen_name)
      })
      console.log(dots)
      console.log('Processing realtime tweets...')
    }
  })
}