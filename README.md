# CyberDash

CyberSec news Twitter bot: https://twitter.com/CyberDash

This keywords search Twitter bot retweets posts with links related to cyber security.

You can use this simple node.js Twitter bot code to create your own news feed bot for the areas of your interest. Just follow the buid, config and run instructions below.

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/CyberDash1.0.png?raw=true 
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
TRACK_FILTER=cyberSec,hacking

# Hashtags only filter match toggle
HASHTAGS_FILTER=true

# Name of the 'blacklist' Twitter list to skip tweets from the members of
# Note: can be any public or private Twitter list you create and curate
BLACKLIST=blacklist

# Skip tweets from news bots and 'celebrities'. Add other user description keywords as desired
USER_DESCRIPTION_FILTER=publishing,news,award-winning,best-selling,co-author,speaker,firm,company

# Skip tweets from users with these many posts, most likely just another news bot
MAX_TWEETS=40000

# Skip tweets from tweeps with these many 'friends', bound to be Twitter spam users
MAX_FRIENDS=30000

# Minimum followers to RT a tweet from 'unknown' user
MIN_FOLLOWERS=10000

# Skip tweets with more than these many hashtags, most likely marketing bots spam
MAX_HASHTAGS=6

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

# 1. Run realtime Twitter stream/filter bot

>node src/stream.js

trace output:

![Alt text](https://github.com/RandomFractals/CyberDash/blob/master/screens/CyberDashTrace4.png?raw=true 
 "trace")


# 2. OR Run bot.js for periodic RT's

>TODO :)

# Twitter Bots Tutorials

https://github.com/amandeepmittal/awesome-twitter-bots

https://medium.freecodecamp.org/how-to-build-and-deploy-a-multifunctional-twitter-bot-49e941bb3092

## Fun Twitter Bots on Github

https://github.com/aershov24/ibotsunburn
