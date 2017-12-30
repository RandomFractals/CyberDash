# CyberDash

CyberSec news Twitter bot: https://twitter.com/CyberDash

This keywords search Twitter bot retweets posts with links related to cyber security.

You can use this simple node.js Twitter bot code to create your own Twitter news feed for the topics of your interest, or for augmenting your existing Twitter account to become a subject matter expert in your domain, as most top Twitter 'influencers' do :) Just follow the build, config, test, debug, and bot run instructions below.

Where I started:

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/CyberDash1.0.png?raw=true 
 "@CyberDash")

After 2 days of bot training and config tweaking :)

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/CyberDashTrainingDay2.png?raw=true 
 "@CyberDash")

# Build

>npm install

# Config: save .env.template as .env

Follow instructions in .env.template for your Twitter bot config:

```
# Create new Twitter bot account and get API keys
#
# https://apps.twitter.com/ 

# Your Twitter bot name
TWITTER_ACCOUNT=CyberDash

# Greeting to DM new followers
GREETING=Hello friend.

# Realtime tweets track filter
# see https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html
# List of keywords to match for your Twitter bot to retweet
TRACK_FILTER=cyberSec,infoSec,hacking,penTest,cyberThreat,cyberAttack,cyberCrime,MrRobot

# Twitter bot search query for search/tweets interface
SEARCH_QUERY=#cyberSec #hacking AND -filter:replies AND -filter:retweets

# Hashtags only filter match toggle
HASHTAGS_FILTER=true

# Skip tweets with these keywords
MUTE_TWEET_FILTER=attend,join us,join our,summit,webinar,daily,predictions,easy steps,top,register

# Name of the 'blacklist' Twitter list to skip tweets from the members of
# Note: can be any public or private Twitter list you create and curate
BLACKLIST=blacklist

# Skip tweets from news bots, companies, magazines, 'celebrities' and support 'providers'
# Add other 'mute' user profile description keywords as desired
MUTE_USER_FILTER=publish,news,marketing,award-winning,best-selling,co-author,speaker,influencer,firm,company,magazine,provide,support

# Minimum followers to RT a tweet from 'unknown' user
MIN_USER_FOLLOWERS=1000

# Skip tweets from tweeps with these many 'friends', bound to be Twitter spam users
MAX_USER_FRIENDS=50000

# Minimum required user tweets to RT a post from 'unknown' user
MIN_USER_TWEETS=5000

# Skip tweets from users with these many posts, most likely just another bot
MAX_USER_TWEETS=50000

# Skip tweets with more than these many hashtags, most likely marketing spam bot
MAX_TWEET_HASHTAGS=6

# Max retweets per user per hour
HOURLY_USER_QUOTA=3

# Max bot retweets per hour
HOURLY_RETWEET_QUOTA=10

# Search and like mentions flag
LIKE_MENTIONS=true

# Bot language to skip RT of foreign tweets
LANGUAGE=en

# Bot log level: debug or info
LOG_LEVEL=debug

# Bot mode: rate or RT
MODE=rate

# Twitter bot API keys
CONSUMER_KEY=
CONSUMER_SECRET=
ACCESS_TOKEN=
ACCESS_TOKEN_SECRET=

# Add your Twitter bot API keys and copy this file to .env for local testing of your Twitter bot with node.js

```
> Read Twitter automation ground rules before you proceed to running your own bot
https://help.twitter.com/en/rules-and-policies/twitter-automation

The settings I've chosen for this Twitter bot limit the number of RT's your bot will send to comply with Twitter rules and rate limit regulations. Fine tune them at your own risk :(

# Test

Before you run your new Twitter bot, please consider testing it first.

Change log level to debug for this bot to skip the actual retweet or quoted tweet step and output matching tweets trace.

in your .env bot config file change this line to debug:

```
# Bot log level
LOG_LEVEL=debug
```

This option is also handy to fine-tune mute tweet and user keywords config, and ban spam users by building a private 'blacklist' Twitter list to ignore marketing and spammy Twitter users and bots.

Once you are happy with the results change log level to info for this Twitter bot to start retweeting or generating quoted tweet rating tweets in 'rate' bot mode. See src/bot.js code for what is done in 'rate' bot mode. Modify as desired.

# RT and Rate Twitter Bot Config

For an example of a hybrid rate quoted tweets and RT tweets with links see WebPackSense.env bot config, and the actual Twitter bot I created for the webpack dev community: https://twitter.com/WebPackSense

From the 1st two hours of that bot run:

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/WebPackSenseBotRunDay1.png?raw=true 
 "@WebPackSense")

Rate and RT bot log trace from the first 20 hours of day 1 on the job :)

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/WebPackSenseBotRunTrace20hrsDay1.png?raw=true 
 "@WebPackSense")

NOTE: 

- every . in that trace is a skipped tweet due to bot config rules. 
- | denotes a straight up retweet of a tweet with a link.
- new followers get logged and sent our greeting DM.
- tweets without links generate a quoted tweet with emojis sentiment rating :)

# 1. Run realtime Twitter stream/filter bot (default)

>node src/stream

sample trace output (old pic from week 1 of bot dev :(

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/CyberDashTrace7.png?raw=true 
 "trace")

Note: every . in that trace denotes a matching tweet analyzed and skipped according to the bot config rules. See 'Dasher's' :) timeline for actual RT's: https://twitter.com/CyberDash

Also, new followers get a greeting DM, and 'blacklist' is updated every 15 minutes to curate that channel.

# 2. OR Run search.js for periodic RT's

>node src/search

# V1.0 TODO

- finish search.js testing and filters config for periodic RT's using Twitter search/tweets interface
- add different match algo's: contains, regex, or http://compromise.cool/
- follow some good cybersec experts and update 'blacklist' for better and more diverse cybersec news RT results

# V2.0 TODO

- Add mute links config to check for reddit, paper.li, etc. links noise.
- Plug in smarter sentiments lib or service call for rating quoted tweets without links.
- hook up redis and check for tweet duplicates from tweeps that post same articles every day for promo

# This Twitter Bot 3rd party API References

https://github.com/motdotla/dotenv - used for bot config

https://github.com/ttezel/twit - used for Twitter API calls

https://github.com/log4js-node/log4js-node - used for bot info, debug and error logging

Official 'Standard' Twitter filter and search tweets APIs:

https://developer.twitter.com/en/docs/tweets/filter-realtime/api-reference/post-statuses-filter.html

https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets.html

# Twitter Bots Tutorials

https://github.com/amandeepmittal/awesome-twitter-bots

https://medium.freecodecamp.org/how-to-build-and-deploy-a-multifunctional-twitter-bot-49e941bb3092

## Fun Twitter Bots on Github

https://github.com/aershov24/ibotsunburn

https://github.com/maeligg/JSLibGenerator
