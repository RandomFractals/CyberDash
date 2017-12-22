const log4js = require('log4js')
const Twit = require('twit')

/**
 * Creates new Twitter bot instance.
 * 
 * @param botConfig Bot config
 */
const TwitterBot = function (botConfig) {
  // save config
  this.config = botConfig

  // create Twit for Twitter API calls
  this.twitter = new Twit(this.config)
  
  // create bot collections 
  this.whitelist = {} // RT users whitelist
  this.blacklist = {} // RT users blacklist
  this.favorites = {} // favorite tweets

  // create retweet counters
  this.retweets = {} // hourly per user RT counters
  this.retweetCount = 0

  // create log and tweet parse vars
  this.dashes = '------------------------------'
  this.dots = '...'
  this.hashtagsRegEx = /(^|\s)#([^ ]*)/g
    
  // create logger
  this.logger = log4js.getLogger('bot')
  this.logger.level = this.config.log_level
  
  // get a list of configured track filter keywords
  this.config.track_keywords = this.config.track_filter.split(',').map(keyword => keyword.toLowerCase())
  if (this.config.hashtags_filter) {
    // convert them to hashtags
    this.config.track_keywords = this.config.track_keywords.map(keyword => ('#' + keyword))
  }

  // get 'mute' tweet filter keywords
  this.config.mute_tweet_keywords = this.config.mute_tweet_filter.split(',').map(keyword => keyword.toLowerCase())

  // get a list of configured user profile description filter keywords
  this.config.mute_user_keywords = this.config.mute_user_filter.split(',').map(keyword => keyword.toLowerCase())

  // log bot config for debug
  this.logConfig()

  // this.listFollowers()

  // create a whitelist from the Twitter bot account 'friends' list
  this.updateWhitelist()

  // create a blacklist from configured Twitter 'blacklist' list members
  this.updateBlacklist()

  // check and like recent mentions
  this.likeMentions()
}


/* --------------------------- Tweeets Processing Methods ----------------------------------- */

/**
 * Main process tweet method.
 * 
 * @param tweet Tweet json object
 */
TwitterBot.prototype.processTweet = function (tweet) {
  if (this.userChecksOut(tweet) && this.worthRT(tweet)) {
    // get full tweet text
    let tweetText = tweet.text
    if (tweet.truncated) {
      tweetText = tweet.extended_tweet.full_text
    }

    // get keywords
    const matchedKeywords = this.getKeywordMatches(tweetText, this.config.track_keywords)
    const muteKeywords = this.getKeywordMatches(tweetText, this.config.mute_tweet_keywords)
    if (muteKeywords.length <= 0 &&
        matchedKeywords.length > 0 &&
        matchedKeywords.split(' ').length <= this.config.max_tweet_hashtags &&
        tweetText.match(this.hashtagsRegEx).length <= this.config.max_tweet_hashtags) {
      this.logTweet(tweet, tweetText, matchedKeywords)
      this.retweet(tweet)
    }
  }
  else {
    // log . for skipped tweets
    process.stdout.write('.')
  }
} // end of processTweet(tweet)


/**
 * Checks user stats.
 * 
 * @param tweet Tweet with user stats.
 */
TwitterBot.prototype.userChecksOut = function (tweet) {
  // check user stats
  const isFriend = (this.whitelist[tweet.user.screen_name] !== undefined)
  const blacklisted = (this.blacklist[tweet.user.screen_name] !== undefined)
  const userQuotaExceeded = (this.retweets[tweet.user.screen_name] !== undefined &&
    this.retweets[tweet.user.screen_name] >= this.config.hourly_user_quota)

  const muteUser = (
    this.getKeywordMatches(
      tweet.user.description, 
      this.config.mute_user_keywords
    ).length > 0
  )

  return (isFriend && !blacklisted && !userQuotaExceeded) || // friends can be blacklisted :(
    (!blacklisted && !muteUser && !userQuotaExceeded &&
      !tweet.user.verified && // skip verified 'unknown' users for now
      tweet.user.followers_count >= this.config.min_user_followers && // min required for 'unknown' tweeps
      tweet.user.friends_count <= this.config.max_user_friends && // skip tweets from tweeps that follow the universe
      tweet.user.statuses_count >= this.config.min_user_tweets && // min required for 'unknown' user to RT
      tweet.user.statuses_count <= this.config.max_user_tweets) // most likely just another Twitter bot
}


/**
 * Checks if a tweet is worth RTing.
 * 
 * @param tweet Tweet to check for RT.
 */
TwitterBot.prototype.worthRT = function (tweet) {
  // check tweet stats
  const isFriend = (this.whitelist[tweet.user.screen_name] !== undefined)  
  const isRetweet = (tweet.retweeted_status !== undefined)
  return (isFriend || tweet.entities.urls.length > 0) && // RT friends and tweets with links
    tweet.entities.hashtags.length <= this.config.max_hashtags && // not too spammy
    tweet.in_reply_to_status_id_str === null && // not a reply
    tweet.lang === this.config.language && // skip foreign tweets    
    !tweet.text.startsWith('RT ') && 
    !isRetweet // skip retweets
    //!tweet.retweeted // RT only tweets without any retweets
}


/**
 * Checks if tweet text or user description matches filter keywords.
 * Twitter can be finicky with those keyword matches sometimes.
 * 
 * @param text Full tweet text or user info to check for keywords.
 * @param keywords Keywords list to check.
 */
TwitterBot.prototype.getKeywordMatches = function (text, keywords) {
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
TwitterBot.prototype.logTweet = function (tweet, tweetText, keywords) {
  this.logger.debug(`\n@${tweet.user.screen_name}: ${tweetText}`)
  this.logger.debug(this.dots)
  this.logger.debug(`matches: ${keywords}`)
  this.logger.debug('hashtags:', tweet.entities.hashtags.map(hashtag => hashtag.text))
  this.logger.debug(`links: ${tweet.entities.urls.length} | lang: ${tweet.lang}`)
  this.logger.debug(this.dots)
  this.logger.debug(`@${tweet.user.screen_name}:`,
    `tweets: ${tweet.user.statuses_count}`,
    `| friends: ${tweet.user.friends_count}`,
    `| followers: ${tweet.user.followers_count}`
  )
  this.logger.debug(tweet.user.description)
  //this.logger.debug(tweet)

  // log | for each RT to stdout
  process.stdout.write('|')
}


/**
 * Retweets a given tweet.
 * 
 * @param tweet Tweet to retweet
 */
TwitterBot.prototype.retweet = function (tweet) {
  if (this.retweetCount < this.config.hourly_retweet_quota) {
    // retweet
    this.twitter.post('statuses/retweet/:id', {
      id: tweet.id_str
    })
    .then( response => {
      this.logger.debug(this.dashes)
      this.logger.debug(`>RT: @${tweet.user.screen_name}: ${tweet.text}`)
      this.logger.debug(this.dashes)

      // update hourly user quota
      const userQuota = this.retweets[tweet.user.screen_name]
      if (userQuota === undefined) {
        this.retweets[tweet.user.screen_name] = 1 // first RT
      }
      else {
        this.retweets[tweet.user.screen_name]++ // increment
      }
      // update total hourly retweets counter
      this.retweetCount++
    })
    .catch(err => {
      this.logger.error('Failed to RT!', tweet)      
    })
  }
  else { // skip retweet due to hourly retweet quota reached
    this.logger.debug(this.dashes)
    this.logger.debug('Skipping RT: hourly retweet quota reached!')
    this.logger.debug(`>skip RT: @${tweet.user.screen_name}: ${tweet.text}`)
    this.logger.debug(this.dashes)
  }
}


/**
 * Gets the latest mentions and likes them.
 */
TwitterBot.prototype.likeMentions = function () {
  if (this.config.like_mentions) {
    this.twitter.get('statuses/mentions_timeline', {
      count: 2 // max mentions to like in 10 time span
    })
    .then(response => {
      this.logger.debug('\nMentions:', response.data.length)
      response.data.map(tweet => {
        if (this.favorites[tweet.id_str] === undefined) {
          this.likeTweet(tweet)
        }
      })
    })
    .catch( err => {
      this.logger.error(`Failed to get mentions for: @${this.config.twitter_account}`)
    })
  }
}


/**
 * Adds a tweet to user favorites.
 * 
 * @param tweet Tweet to add to favorites.
 */
TwitterBot.prototype.likeTweet = function (tweet) {
  this.twitter.post('favorites/create', {
    id: tweet.id_str
  })
  .then( response => {
    // add to favorites
    this.favorites[tweet.id_str] = tweet
    this.logger.debug(this.dashes)
    this.logger.debug(`>Liked: @${tweet.user.screen_name}: ${tweet.text}`)
    this.logger.debug(this.dashes)
  })
  .catch( err => {
    this.logger.error('Failed to Like!', tweet)
  })
}


/**
 * Sends 'Hello friend.' to new follower.
 */
TwitterBot.prototype.helloFriend = function (event) {
  const friendName = event.source.name
  const friendScreenName = event.source.screen_name
  if (friendScreenName !== this.config.twitter_account) { // not us
    this.logger.info('\nnew follower:', friendScreenName)
    // DM our greeting to new follower
    this.twitter.post('direct_messages/new', {
      screen_name: friendScreenName,
      text: this.config.greeting
    })
    .then( response  => {
      this.logger.info(`Greeting DM sent to @${response.data.recipient_screen_name}: '${response.data.text}'`)
    })
    .catch( err => {
      this.logger.error('Failed to send greeting DM', err)      
    })
  }
}


/**
 * Prints out 20 followers for the configured Twitter bot account
 * to test Twitter API OAth, etc.
 */
TwitterBot.prototype.listFollowers = function () {
  this.twitter.get('followers/list', {
    screen_name: this.config.twitter_account,
    count: 20
  })
  .then( response => {
    this.logger.debug(`\n${this.config.twitter_account} Followers:`)
    this.logger.debug(this.dashes)
    response.data.users.forEach(user => {
      this.logger.debug(user.screen_name)
    })
    this.logger.debug(this.dots)
  })
  .catch( err => {
    this.logger.error('Failed to get followers/list', err)    
  })
}


/**
 * Logs bot this.config.
 */
TwitterBot.prototype.logConfig = function () {
  this.logger.info('RT Filter:')
  this.logger.info(this.dashes)
  this.logger.info(this.config.track_keywords)
  this.logger.info('mute_tweet_filter:', this.config.mute_tweet_filter)
  this.logger.info('mute_user_filter:', this.config.mute_user_filter)
  this.logger.info('min_user_followers:', this.config.min_user_followers.toLocaleString())  
  this.logger.info('max_user_friends:', this.config.max_user_friends.toLocaleString())  
  this.logger.info('min_user_tweets:', this.config.min_user_tweets.toLocaleString())
  this.logger.info('max_user_tweets:', this.config.max_user_tweets.toLocaleString())
  this.logger.info('max_tweet_hashtags:', this.config.max_tweet_hashtags.toLocaleString())
  this.logger.info('hourly_user_quota:', this.config.hourly_user_quota.toLocaleString())
  this.logger.info('hourly_retweet_quota:', this.config.hourly_retweet_quota.toLocaleString())
  this.logger.info('like_mentions:', this.config.like_mentions)
  this.logger.info('language:', this.config.language)
}


/**
 * Updates whitelist with 'friends'
 * and resets retweet per user hourly counters.
 */
TwitterBot.prototype.updateWhitelist = function () {
  this.twitter.get('friends/list', {
    screen_name: this.config.twitter_account,
    count: 100 // max whitelist size for now
  })
  .then( response => {
    this.logger.debug('\nWhitelist:')
    this.logger.debug(this.dashes)
    response.data.users.forEach(user => {
      // add a 'friend' to the whitelist
      this.whitelist[user.screen_name] = user
      this.logger.debug(user.screen_name)
    })
    this.logger.debug(this.dots)

    // reset retweet per user counters
    this.retweets = {}

    // reset hourly retweets counter
    this.retweetCount = 0

  })
  .catch( err => {
    this.logger.error('Failed to get friends/list!', err)    
  })
}


/**
 * Updates blacklist from configured Twitter 'blacklist' list.
 */
TwitterBot.prototype.updateBlacklist = function () {
  this.twitter.get('lists/members', {
    slug: this.config.blacklist,
    owner_screen_name: this.config.twitter_account,
    count: 100 // max blacklist size for now
  })
  .then( response => {
    this.logger.debug('\nBlacklist:')
    this.logger.debug(this.dashes)
    this.logger.debug(`@${this.config.twitter_account}/lists/${this.config.blacklist}`)
    this.logger.debug(this.dashes)
    response.data.users.forEach(user => {
      // update blacklist
      this.blacklist[user.screen_name] = user
      this.logger.debug(user.screen_name)
    })
    this.logger.debug(this.dots)
    this.logger.debug('Processing realtime tweets...')
  })
  .catch( err => {
    this.logger.error(`Failed to get 'blacklist' lists/members!`, err)
  })
  
}

module.exports = TwitterBot