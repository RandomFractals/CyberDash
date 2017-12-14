const Twit = require('twit')
const config = require('./config')

const bot = new Twit(config)

bot.get('followers/list', {
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