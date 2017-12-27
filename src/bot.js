const log4js = require('log4js')
const Twit = require('twit')
const sentiment = require('sentiment')

// log levels
const INFO = 'info'
const DEBUG = 'debug'
const RATE = 'rate'

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

  // since tweet id marker for search/tweets
  this.sinceTweetId = 0

  // set rate RT flag
  this.rateRT = (this.config.mode === RATE)

  // create log and tweet parse vars
  this.dashes = '------------------------------'  
  this.dots = '...'
  this.line = this.dashes + this.dashes + this.dashes
  this.hashtagsRegEx = /(^|\s)#([^ ]*)/g
    
  // create logger
  this.logger = log4js.getLogger('bot')
  this.logger.level = this.config.log_level
  console.log('Log:', this.logger.level)

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

  // get filter retweets and replies config
  this.config.filter_retweets = this.config.search_query.indexOf('-filter:retweets') >= 0
  this.config.filter_replies = this.config.search_query.indexOf('-filter:replies') >= 0

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


/**
 * Searches Twitter for matching tweets to RT.
 * 
 * See: https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets.html
 */
TwitterBot.prototype.searchTweets = function() {
  this.logger.info('searching...')
  this.twitter.get('search/tweets', {
    q: this.config.search_query,
    count: 20, // max tweets to analyze every 15 minutes
    result_type: 'recent',
    tweet_mode: 'extended',
    since_id: this.sinceTweetId,
    lang: this.config.language
  })
  .then(response => {
    // process tweet search results
    //console.log(JSON.stringify(response.data, null, '\t'))
    response.data.statuses.forEach(tweet => {
      this.processTweet(tweet)
      //this.logger.info(`>@${tweet.user.screen_name}: \n${tweet.text}`)
    })
    // update since tweet id for the next twitter search call
    this.sinceTweetId = response.data.search_metadata.max_id_str
    this.logger.info(`\n${this.line}\nsearch_metadata: `, 
      response.data.search_metadata, `\n${this.dots}`)
  })
  .catch(err => {
    this.logger.error(`Failed to get 'search/tweets' results!`, err)
  })
}

/* --------------------------- Tweeets Processing Methods ----------------------------------- */

/**
 * Main process tweet method.
 * 
 * @param tweet Tweet json object
 */
TwitterBot.prototype.processTweet = function (tweet) {
  if ((this.rateRT && tweet.lang === this.config.language) || // for tweets rating
      (this.userChecksOut(tweet) && this.worthRT(tweet))) { // for straight up RT

    // get full tweet text
    // see: https://developer.twitter.com/en/docs/tweets/tweet-updates for more info
    tweet.fullText = tweet.text
    if (tweet.truncated && tweet.extended_tweet !== undefined) {
      tweet.fullText = tweet.extended_tweet.full_text
    } 
    else if (tweet.full_text !== undefined) {
      // get new extended tweet full_text from tweet json object directly
      tweet.fullText = tweet.full_text
    }

    // get sentiment
    tweet.sentiment = sentiment(tweet.fullText, {
      'webpack': 5 // set 'webpack' word sentiment to max positive rating to boost RTs
    })
    tweet.sentiment.rating = Math.round(tweet.sentiment.comparative * 100 / 20) // for 5 start rating

    // get matched/mute keywords
    tweet.keywords = this.getKeywordMatches(tweet.fullText, this.config.track_keywords)
    tweet.muteKeywords = this.getKeywordMatches(tweet.fullText, this.config.mute_tweet_keywords)

    // extract all hashtags from full tweet text
    // b/c tweet.entities.hashtags are iffy and finicky sometimes :)
    tweet.hashtags = tweet.fullText.match(this.hashtagsRegEx)

    if (this.logger.level.isEqualTo(DEBUG)) {
      this.logTweet(tweet)
    }

    // run last keywords and hashtags checks for RT
    if (tweet.muteKeywords.length <= 0 &&
        tweet.keywords.length > 0 &&
        tweet.keywords.split(' ').length <= this.config.max_tweet_hashtags &&
        (this.config.hashtags_filter && tweet.hashtags && 
          tweet.hashtags.length <= this.config.max_tweet_hashtags) &&
        this.logger.level.isGreaterThanOrEqualTo(INFO) ) { // RT only in info mode!        
      this.retweet(tweet)
    }
  }
  else {
    // log . for skipped tweets
    process.stdout.write('.')
    if (this.logger.level.isEqualTo(DEBUG)) {
      this.logger.debug(`\n@${tweet.user.screen_name}: ${tweet.text}`)
    }
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
  const isRetweet = (tweet.retweeted_status !== undefined || tweet.text.startsWith('RT '))
  const isReply = (tweet.in_reply_to_status_id_str !== null)
  const skipRT = this.config.filter_retweets ? isRetweet: false
  const skipReply = this.config.filter_replies ? isReply: false
  const hashtagsCount = tweet.entities.hashtags.length
  return (isFriend || tweet.entities.urls.length > 0) && // RT friends and tweets with links
    hashtagsCount <= this.config.max_tweet_hashtags && // not too spammy
    !skipRT && !skipReply &&
    tweet.lang === this.config.language // skip foreign lang tweets
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
 * Logs tweet text and stats.
 * 
 * @param tweet Tweet info to log
 */
TwitterBot.prototype.logTweet = function (tweet) {
  this.logger.debug(`\n${this.line}\n${tweet.fullText}`)
  this.logger.debug(this.dashes)
  this.logger.debug(`matches: ${tweet.keywords}`)
  this.logger.debug('hashtags:', tweet.entities.hashtags.map(hashtag => hashtag.text))
  this.logger.debug(`links: ${tweet.entities.urls.length} | lang: ${tweet.lang}`)
  this.logger.debug(`sentiment: rating=${tweet.sentiment.rating}`,
    `| score=${tweet.sentiment.score}`,
    `| comparative=${tweet.sentiment.comparative}`)
  this.logger.debug(this.dashes)
  this.logger.debug(`@${tweet.user.screen_name}:`,
    `tweets: ${tweet.user.statuses_count}`,
    `| friends: ${tweet.user.friends_count}`,
    `| followers: ${tweet.user.followers_count}`
  )
  this.logger.debug(this.dashes)  
  this.logger.debug(tweet.user.description)
  //this.logger.debug(tweet)
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
      if (this.logger.level.isEqualTo(DEBUG)) {
        // log new RT
        this.logger.debug(this.dashes)
        this.logger.debug(`>RT: @${tweet.user.screen_name}: ${tweet.text}`)
        this.logger.debug(this.dashes)
      }

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

      // log | for each RT to stdout
      process.stdout.write('|')      
    })
    .catch(err => {
      this.logger.error('Failed to RT!', tweet)      
    })
  }
  else { // skip retweet due to hourly retweet quota reached
    if (this.logger.level.isEqualTo(DEBUG)) {
      this.logger.debug(this.dashes)
      this.logger.debug('Skipping RT: hourly retweet quota reached!')
      this.logger.debug(`>skip RT: @${tweet.user.screen_name}: ${tweet.text}`)
      this.logger.debug(this.dashes)
    }
    // log - for skipped RT due to RT quota
    process.stdout.write('-')
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
  this.logger.info('Bot Config:')
  this.logger.info(this.dashes)
  this.logger.info('track_filter:', this.config.track_keywords)
  this.logger.info('search_query:', this.config.search_query)      
  this.logger.info('hashtags_filter:', this.config.hashtags_filter)
  this.logger.info('filter_retweets:', this.config.filter_retweets)
  this.logger.info('filter_replies:', this.config.filter_replies)
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
  this.logger.info('mode:', this.config.mode)
  this.logger.info('🔹🔹🔹◽◽|🔸🔸◽◽◽')
  // create and log sentiment test
  sentimentTest = sentiment(this.config.sentiment_test, {
    //'webpack': 5 // set 'webpack' word sentiment to max positive rating to boost RTs
  })
  this.logger.info('sentiment_test:', this.config.sentiment_test)
  this.logger.info(`sentiment: score=${sentimentTest.score} comparative=${sentimentTest.comparative}`)
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
    if (response.data.users !== undefined) {
      response.data.users.forEach(user => {
        // update blacklist
        this.blacklist[user.screen_name] = user
        this.logger.debug(user.screen_name)
      })
    }
    this.logger.debug(this.dots)
    this.logger.debug('Processing realtime tweets...')
  })
  .catch( err => {
    this.logger.error(`Failed to get 'blacklist' lists/members!`, err)
  })
  
}

module.exports = TwitterBot