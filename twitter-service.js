var Twitter = require('twitter');

var client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });

  const tweetScores = (content) => {
    client.post('statuses/update', {status: content}, function(error, tweet, response) {
        if (!error) {
          console.log(tweet);
        } else {
            console.log(error);
        }
      });
  };

  module.exports = {
      tweetScores
  }
