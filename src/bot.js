const log4js = require('log4js')
const Twit = require('twit')
const sentiment = require('sentiment')

// log levels
const INFO = 'info'
const DEBUG = 'debug'
const RATE = 'rate'

// tweet rating emojis
const POSITIVE_EMOJI = '🔥' //'🎉'
const NEGATIVE_EMOJI = '😡' //'💫'
const NEUTRAL_EMOJI  = '◽'

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

  // create retweet counters and caches
  this.retweets = {} // hourly per user RT counters
  this.retweetCount = 0
  this.retweetLinks = {} // to check for duplicates

  // since tweet id marker for search/tweets
  this.sinceTweetId = 0

  // set rate RT flag
  this.rateRT = (this.config.mode === RATE)

  // create tweet log and parse vars
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
 
  // get 'mute' tweet links filter
  this.config.mute_tweet_links = this.config.mute_tweet_links_filter.split(',').map(domain => domain.toLowerCase())
   
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
 * Logs bot config.
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
  this.logger.info('mute_tweet_links_filter:', this.config.mute_tweet_links_filter)  
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
  this.logger.info(`🔹|🔸|◽: ${POSITIVE_EMOJI}|${NEGATIVE_EMOJI}|${NEUTRAL_EMOJI}`)
  // create and log sentiment test
  sentimentTest = sentiment(this.config.sentiment_test, {
    // TODO: use track filter keywords from config here and boost all of them?
  })
  this.logger.info('sentiment_test:', this.config.sentiment_test)
  this.logger.info(`sentiment: score:${sentimentTest.score} | comparative:${sentimentTest.comparative}`)
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

      // update retweetLinks for debug
      tweet.entities.urls.map(link => {
        this.retweetLinks[link.url.replace('https://t.co/', '')] = link.expanded_url
      })
    })
    
    // update since tweet id for the next twitter search call
    this.sinceTweetId = response.data.search_metadata.max_id_str

    // log search results metadata
    this.logger.info(`\n${this.line}\nsearch_metadata: `, 
      response.data.search_metadata, `\n${this.dots}`)

    // log retweeted links for debug      
    this.logger.debug(
      `\n${this.dashes} \nRetweeted Links\n${this.dashes}\n`, 
      JSON.stringify(this.retweetLinks, null, '\t'))
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
  // friends and family coat check :)
  this.updateUser(tweet.user)

  // tweet augmentation
  this.updateTweet(tweet)

  // update matched/mute keywords and hashtags
  this.updateKeywords(tweet)

  // get tweet sentiment for rating quote tweets
  tweet.sentiment = this.getSentiment(tweet)
  
  // log enriched tweet stats for debug
  this.logTweet(tweet)
  
  // run user, retweet, links and keywords checks
  if (this.userChecksOut(tweet.user) && 
      this.worthRT(tweet) &&
      this.matchesKeywords(tweet) ) {

    if (this.config.mode === RATE && 
        (tweet.links.length === 0 || tweet.isReply) ) {
      // send rated quote tweet
      this.quoteTweet(tweet.sentiment.ratingEmojis, tweet)
      this.logRetweet(tweet.sentiment.ratingText, tweet)
    } 
    else if (this.isUniqueTweet(tweet)) { // check for retweets with same link from diff. users
      // just retweeted it for the 'breaking' news bots :)
      this.retweet(tweet)
      this.logRetweet('RT', tweet)
    }
    else {
      // log another skipped tweet
      process.stdout.write('.')
      this.logger.debug(`\n-@${tweet.user.screen_name}: ${tweet.fullText}`)        
    }

  }
  else { // did not pass configured user and tweet filters
    // log . for skipped tweets
    process.stdout.write('.')
    this.logger.debug(`\n-@${tweet.user.screen_name}: ${tweet.fullText}`)
  }
} // end of processTweet(tweet)


/**
 * Injects our custom bot user checks props 
 * into original tweet.user json data model.
 * 
 * @param user Tweet user to update.
 */
TwitterBot.prototype.updateUser = function (user) {
  // set whitelisted, blacklisted, muted, and user retweet quota props
  const userName = user.screen_name
  user.isFriend = (this.whitelist[userName] !== undefined)
  user.blacklisted = (this.blacklist[userName] !== undefined)
  user.retweetQuotaExceeded = (this.retweets[userName] !== undefined &&
    this.retweets[userName] > this.config.hourly_user_quota)
  user.muted = this.getKeywordMatches(user.description, this.config.mute_user_keywords).length > 0
}


/**
 * Injects our custom bot tweet checks props 
 * into original tweet json data model.
 * 
 * @param tweet Tweet to update.
 */
TwitterBot.prototype.updateTweet = function (tweet) {
  // set tweet full text, retweet, reply and hashtags count props
  tweet.fullText = this.getFullText(tweet)  
  tweet.isRetweet = (tweet.retweeted_status !== undefined || tweet.fullText.startsWith('RT '))
  tweet.isReply = (tweet.in_reply_to_status_id_str !== null)
  tweet.skipRetweet = this.config.filter_retweets ? tweet.isRetweet: false
  tweet.skipReply = this.config.filter_replies ? tweet.isReply: false
  tweet.hashtagsCount = tweet.entities.hashtags.length
  tweet.links = tweet.entities.urls.map(link => link.expanded_url)
    .filter(link => link.indexOf('https://twitter.com') < 0) // filter out twitter status links
}


/**
 * Extracts full tweet text for normal and extended tweets.
 * 
 * see: https://developer.twitter.com/en/docs/tweets/tweet-updates for more info
 * 
 * @param tweet Tweet to get full text from.
 */
TwitterBot.prototype.getFullText = function (tweet) {
  // get full tweet text
  let fullText = tweet.text
  if (tweet.truncated && tweet.extended_tweet !== undefined) {
    fullText = tweet.extended_tweet.full_text
  } 
  else if (tweet.full_text !== undefined) {
    // get new extended tweet full_text from tweet json object directly
    fullText = tweet.full_text
  }
  return fullText
}


/**
 * Updates a tweet with matched track filter, mute keywords, and hashtags.
 * 
 * @param tweet Tweet to update matched keywords for.
 */
TwitterBot.prototype.updateKeywords = function (tweet) {
  // get matched/mute keywords
  tweet.keywords = this.getKeywordMatches(tweet.fullText, this.config.track_keywords)
  tweet.muteKeywords = this.getKeywordMatches(tweet.fullText, this.config.mute_tweet_keywords)
  tweet.muteLinks = this.getKeywordMatches(tweet.links.toString(), this.config.mute_tweet_links)

  // extract all hashtags from full tweet text
  // b/c tweet.entities.hashtags are iffy and finicky sometimes :)
  tweet.hashtags = tweet.fullText.match(this.hashtagsRegEx)
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
 * Gets tweet text sentiment and rating text and emojis.
 * 
 * @param tweet Tweet to get sentiment info for.
 * 
 * Note: this could be extended later to boost tweets from whitelisted friends,
 * or users with good standing and great following.
 * 
 * Also could enhance this with better sentiment lib in v2.0
 */
TwitterBot.prototype.getSentiment = function (tweet) {
  let tweetSentiment = sentiment(tweet.fullText, {
    // TODO: use track filter keywords from config here and boost all of them?
    //'webpack': 5 // set 'webpack' word sentiment to max positive rating to boost RTs
  })

  // create tweet rating info
  tweetSentiment.rating = Math.round(tweetSentiment.comparative * 100 / 20) // for 5 star rating
  tweetSentiment.ratingEmojis = this.getRatingEmojis(tweetSentiment.rating)
  tweetSentiment.ratingText = this.getRatingText(tweetSentiment.rating)
  return tweetSentiment
}


/**
 * Gets tweet rating emojis text.
 * 
 * @param rating Integer tweet sentiment rating in -5,5 range.
 */
TwitterBot.prototype.getRatingEmojis = function(rating) {
  let ratingText = ''
  let ratingChar = rating >= 0 ? POSITIVE_EMOJI: NEGATIVE_EMOJI
  const absRating = Math.abs(rating)
  for (let i=0; i<5; i++) { // for -5/+5 int ratings
    if (absRating > i) {
      ratingText += ratingChar
    }
    else {
      ratingText += NEUTRAL_EMOJI
    }
  }
  return ratingText
}


/**
 * Gets console friendly tweet rating text for debug logging.
 * 
 * @param rating Integer tweet sentiment rating in -5,5 range.
 */
TwitterBot.prototype.getRatingText = function(rating) {
  let ratingText = '|'
  let ratingChar = rating >= 0 ? '+': '-'
  const absRating = Math.abs(rating)
  for (let i=0; i<5; i++) { // for -5/+5 int ratings
    if (absRating > i) {
      ratingText += ratingChar
    }
    else {
      ratingText += '.' // neutral
    }
  }  
  return ratingText + '|'
}


/**
 * Checks user stats.
 * 
 * @param user Tweet user stats.
 */
TwitterBot.prototype.userChecksOut = function (user) {
  return (user.isFriend && !user.blacklisted && !user.retweetQuotaExceeded) || // friends can be blacklisted :(
    (!user.blacklisted && !user.muted && !user.retweetQuotaExceeded &&
      !user.verified && // skip verified 'unknown' users for now
      user.followers_count >= this.config.min_user_followers && // min required for 'unknown' tweeps
      user.friends_count <= this.config.max_user_friends && // skip tweets from tweeps that follow the universe
      user.statuses_count >= this.config.min_user_tweets && // min required for 'unknown' user to RT
      user.statuses_count <= this.config.max_user_tweets) // most likely just another Twitter bot
}


/**
 * Checks if a tweet is worth RTing.
 * 
 * @param tweet Tweet to check for RT.
 */
TwitterBot.prototype.worthRT = function (tweet) {
  // check tweet stats
  return (tweet.user.isFriend || tweet.links.length > 0 || this.rateRT) && // RT friends and tweets with links
    tweet.hashtagsCount <= this.config.max_tweet_hashtags && // not too spammy
    !tweet.skipRetweet && !tweet.skipReply &&
    tweet.lang === this.config.language // skip foreign lang tweets
}


/**
 * Checks a tweet for matching track filter keywords, mute keywords and hashtags limits.
 * 
 * @param tweet Tweet to inspect with injected keywords and hashtags.
 */
TwitterBot.prototype.matchesKeywords = function (tweet) {
  return (
    tweet.muteKeywords.length <= 0 &&
    tweet.muteLinks.length <= 0 &&
    tweet.keywords.length > 0 &&
    tweet.keywords.split(' ').length <= this.config.max_tweet_hashtags &&
    (!this.config.hashtags_filter || 
      (this.config.hashtags_filter && tweet.hashtags && 
        tweet.hashtags.length <= this.config.max_tweet_hashtags) ) )
}


/**
 * Checks if a tweet has unique links to retweet.
 * 
 * @param tweet Tweet to check for duplicate links.
 * 
 * TODO: add a check for duplicate text later
 * for spammy users that retweet same content every day,
 * or don't use RT Twitter feature and repost same content
 * others already shared.
 */
TwitterBot.prototype.isUniqueTweet = function (tweet) {
  return tweet.links.length === 0 || 
    tweet.entities.urls.filter(link => {
      this.retweetLinks[link.url.replace('https://t.co/', '')] !== undefined
    }).length === 0
}


/**
 * Logs tweet text and stats.
 * 
 * @param tweet Tweet info to log
 */
TwitterBot.prototype.logTweet = function (tweet) {
  if (this.logger.level.isEqualTo(DEBUG) &&
      !tweet.user.muted) {  
    this.logger.debug(`\n${this.line}\n${tweet.fullText}`)
    if (this.config.mode === RATE && tweet.links.length === 0) {
      // log rated quote tweet rating text
      process.stdout.write(this.getRatingText(tweet.sentiment.rating))
    }
    this.logger.debug(this.dashes)
    this.logger.debug(`matches: ${tweet.keywords}`)
    this.logger.debug(`hashtags: ${tweet.hashtagsCount}`, tweet.entities.hashtags.map(hashtag => hashtag.text))
    this.logger.debug('muteLinks:', tweet.muteLinks)
    this.logger.debug(`links: ${tweet.links.length}`, tweet.links)
    this.logger.debug(
      `lang: ${tweet.lang}`,
      `| isRetweet: ${tweet.isRetweet}`,
      `| isReply: ${tweet.isReply}`,
      `| skipRetweet: ${tweet.skipRetweet}`,
      `| skipReply: ${tweet.skipReply}`)
    this.logger.debug(`sentiment: ${tweet.sentiment.ratingText}`,
      `rating=${tweet.sentiment.rating}`,
      `| score=${tweet.sentiment.score}`,
      `| comparative=${tweet.sentiment.comparative}`)
    this.logger.debug(this.dashes)
    this.logger.debug(`@${tweet.user.screen_name}:`,
      `tweets: ${tweet.user.statuses_count}`,
      `| friends: ${tweet.user.friends_count}`,
      `| followers: ${tweet.user.followers_count}`,
      `| isFriend: ${tweet.user.isFriend}`,
      `| blacklisted: ${tweet.user.blacklisted}`,
      `| muted: ${tweet.user.muted}`
    )
    this.logger.debug(this.dashes)  
    this.logger.debug(tweet.user.description)
    //this.logger.debug(tweet)
  }
}


/**
 * Logs retweet or quoted tweet.
 * 
 * @param status Retweet status message
 * @param tweet Tweet info to log
 */
TwitterBot.prototype.logRetweet = function (status, tweet) {
  if (this.logger.level.isEqualTo(DEBUG)) {
    // log new RT
    this.logger.debug(this.dashes)
    this.logger.debug(`>${status}: @${tweet.user.screen_name}: ${tweet.fullText}`)
    this.logger.debug(this.dashes)
  }
}


/**
 * Sends quoted tweet status update using
 * new attachment_url param for the quoted tweet.
 * 
 * see: https://developer.twitter.com/en/docs/tweets/tweet-updates for more info.
 * 
 * @param quoteText Tweet text for the quoted tweet
 * @param tweet Quoted tweet
 */
TwitterBot.prototype.quoteTweet = function (quoteText, tweet) {
  if (this.retweetCount < this.config.hourly_retweet_quota && // below hourly RT quota
    this.logger.level.isGreaterThanOrEqualTo(INFO) ) { // RT only in info mode!
    // send quoted tweet
    const quoteTweetUrl = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`
    this.twitter.post('statuses/update', {
      status: tweet.sentiment.ratingEmojis,
      attachment_url: quoteTweetUrl
    })
    .then( response => {
      // log new quoted tweet
      this.logRetweet(quoteText, tweet)
      this.logger.info(`>${quoteText}: @${tweet.user.screen_name}: ${quoteTweetUrl}`)

      // update bot quotas
      this.updateQuotas(tweet)
      
      // log | for each RT to stdout
      process.stdout.write('|')
    })
    .catch(err => {
      this.logger.error('Failed to send quoted tweet!', err)
    })
  }
  else { // skip retweet due to hourly retweet quota reached
    if (this.logger.level.isEqualTo(DEBUG)) {
      this.logRetweet('skip RT', tweet)
    }
    // log - for skipped RT due to RT quota
    process.stdout.write('-')
  }
} // end of quoteTweet()


/**
 * Updates bot tweets quotas.
 * 
 * @param tweet Last sent tweet to update bot tweets quotas.
 */
TwitterBot.prototype.updateQuotas = function (tweet) {
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
}


/**
 * Retweets a given tweet.
 * 
 * @param tweet Tweet to retweet
 */
TwitterBot.prototype.retweet = function (tweet) {
  if (this.retweetCount < this.config.hourly_retweet_quota && // below hourly RT quota
      this.logger.level.isGreaterThanOrEqualTo(INFO) ) { // RT only in info mode!
    // retweet
    this.twitter.post('statuses/retweet/:id', {
      id: tweet.id_str
    })
    .then( response => {
      // log new RT
      this.logRetweet('RT', tweet)

      // update bot quotas
      this.updateQuotas(tweet)

      // update retweeted links to check for duplicates later      
      tweet.entities.urls.filter(link => link.indexOf('https://twitter.com') < 0) // filter out twitter status links
        .map(link => {
          this.retweetLinks[link.url.replace('https://t.co/', '')] = link.expanded_url
        })

      // log | for each RT to stdout
      process.stdout.write('|')      
    })
    .catch(err => {
      this.logger.error('Failed to RT!', tweet)      
    })
  }
  else { // skip retweet due to hourly retweet quota reached
    if (this.logger.level.isEqualTo(DEBUG)) {
      this.logRetweet('skip RT', tweet)
    }
    // log - for skipped RT due to RT quota
    process.stdout.write('-')
  }
} // end of retweet()


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