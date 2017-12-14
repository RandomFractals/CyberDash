const Twit = require('twit')
const config = require('./config')

const Twitter = new Twit(config)

Twitter.get('followers/list', {
  screen_name: 'CyberDash',
  count: 20
}, (err, data, response) => {
  if (err) {
    console.log(err)
  } else {
    console.log('Followers:')
    data.users.forEach(user => {
      console.log(user.screen_name)
    })
  }
})


var retweet = function() {
  // RT search params
  // see: https://dev.twitter.com/rest/reference/get/search/tweets
  var params = {
    q: '#cyberSec, #hacking',
    count: 5,
    result_type: 'recent',
    lang: 'en'    
  }

  Twitter.get('search/tweets', params, function(err, data) {
    // if there no errors
      if (!err) {
          // process matching tweets
          data.statuses.forEach(status => {
            console.log(status.text, status.user.screen_name)
            // retweet
            Twitter.post('statuses/retweet/:id', {id: status.id_str}, function(err, response) {
              if (response) {
                console.log('.');
              }
              // if there was an error while tweeting
              if (err) {
                coneole.error('failed to RT', status)
              }
            });
          })
      }
      // if unable to Search a tweet
      else {
        console.error('Twitter search failed!');
      }
  });
}

// grab & retweet as soon as program is running...
retweet();

// retweet in every 50 minutes
setInterval(retweet, 3000000);
