var logger = require('./logger.js')
var Promise = require('bluebird')
var rp =  require('request-promise');
var search = Promise.promisify(require('youtube-search'));
var Youtube = require("youtube-api");
var Playlists = Promise.promisifyAll(Youtube.playlists);
var PlaylistItems = Promise.promisifyAll(Youtube.playlistItems)
var readJson = require("r-json")
var opn = require('opn')
var cheerio = require('cheerio')

Promise.config({
  longStackTraces: true,
})

function exitHandler() {
  process.exit(1)
}

Promise.onPossiblyUnhandledRejection(function(error) {
  logger.fatal('unhandled rejection: ', error);
  setTimeout(() => exitHandler(), 5000)
});

process.on('uncaughtException', function(err) {
  logger.fatal('Caught uncaughtException: ' + err + '\nstack: ' + err.stack + '\nstopping app...');
  setTimeout(() => exitHandler(), 5000)
});

logger.debug('hello from musicmedley')
var CREDENTIALS = readJson(`${__dirname}/credentials.json`);

var express = require('express');
var app = express();

app.get('/', function(req, res){
	res.send('hello from musicmedley');
});

var authPromise = new Promise(function(resolve, reject) {
  app.get('/oauth2callback', function(req, res){
    var code = req.query.code;
    
    oauth.getToken(code, function (err, tokens) {
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      if (!err) {
        oauth.setCredentials(tokens);
        resolve();
      } else {
        reject(err)
      }
    });

    res.send('tokens saved');
  });
})

app.listen(3000)

var oauth = Youtube.authenticate({
    type: "oauth"
  , client_id: CREDENTIALS.web.client_id
  , client_secret: CREDENTIALS.web.client_secret
  , redirect_url: CREDENTIALS.web.redirect_uris[0]
})

opn(oauth.generateAuthUrl({
    access_type: "offline"
  , scope: ["https://www.googleapis.com/auth/youtube"]
}))

var createPlaylistIfNotExists = function(title, description, privacy) {
  return Playlists.listAsync({
     'part': 'snippet,contentDetails',
     'mine' : 'true'
  }).then((response) => {
    for(var i = 0; i < response.items.length; ++i) {
      if(response.items[i].snippet.title == title && response.items[i].snippet.description == description) {
        logger.debug('playlist already exists');
        return response.items[i]; 
      }
    }
  }).then((playlist) => {
    if(playlist)
      return playlist;

    return Youtube.playlists.insertAsync({
      part: 'snippet,status',
      resource: {
        snippet: {
          title: title,
          description: description
        },
        status: {
          privacyStatus: privacy
        }
      }
    }).then((result) => {
      logger.debug('playlist created');
      return result;
    })
  })
}

var getMusicBandInfo = function(musicBand, url) {
  var localUrl = url;
  var bandInfo = { title: musicBand, url: url, discography: [] };
  
  return rp.get(url).then((response) => {
    var $ = cheerio.load(response);
    var discographyItems = $('div.custom-artist-releases-text').find('strong');
    logger.debug('got info for', localUrl)
    discographyItems.each(function(i, element) {
      if(element.parent.parent.attribs['class'] == 'first')
        return true;

      var album = $(this).text()
      bandInfo.discography.push(album)
    })

    return bandInfo;    
  })
}

var getMusicBands = function() {
  var requestUrl = 'https://api.import.io/store/connector/2c9f1256-d5ad-4624-8af6-9e9e026c2b39/_query?input=webpage/url:http%3A%2F%2Fwww.summer-breeze.de%2Fen%2Fbands%2Findex.html&&_apikey=d661281789fc42a18889853b03aa2770a09bc3488cb1c7d418ab9a0f5572ef78e5e34c59e6cea878e73c6e5839390eb0f163535c3b1bee20e210025aa7f4c7b1fe18aa4a76119de3aa9e8f9dd8e1673c'
  var getInfoPromises = [];

  return rp.get(requestUrl).then((response) => {
    var jsonResponse = JSON.parse(response)
    jsonResponse.results.some(function(element) {
      var musicBand = element['link/_text']
      getInfoPromises.push(getMusicBandInfo(musicBand, element.link));

      // return true; // debug
    }, this);

    return Promise.all(getInfoPromises);
  })
}

var searchMusicBands = function(musicBands) {
  var opts = {
      maxResults: 5,
      order: 'relevance',
      type: 'video',
      safeSearch: 'none',
      videoDuration: 'short',
      key: readJson(`${__dirname}/apikey.json`).key
  };

  var searches = [];
  musicBands.forEach((musicBand) => {
    searches.push(search(musicBand.title, opts).then((res) => {
      logger.debug('got results for: ', musicBand)
      return res;
    }))
  })

  return Promise.all(searches)
}

var skipped = 0;

var addToPlaylist = function(playlistId, kind, videoId) {
  logger.debug('adding: ', videoId)
  console.log('adding: ', videoId);
  
  return PlaylistItems.insertAsync({
    part: 'snippet',
    resource: {
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: kind,
          videoId: videoId
        }
      }
    }
  }).then((i) => {
    logger.debug('added: ', videoId);
    console.log('added: ', videoId);
    return i;
  }).catch((e) => {
    logger.error('failed to add: ', videoId, 'skipping... ');
    skipped++;
  })
}

authPromise.then(() => {
  logger.info('authentication succeed');
  return createPlaylistIfNotExists('summer-breeze v1.01', 'summer-breeze bands medley v2', 'public')
}).then((playlist) => {
  logger.info('playlist resolved');
  return getMusicBands().then(searchMusicBands).then((searchResults) => {
    var addToPlaylistItems = []
    searchResults.forEach((bandResults) => {
      logger.info(bandResults)
      bandResults.forEach((result) => {
        addToPlaylistItems.push({playlistId: playlist.id, kind: result.kind, id: result.id})
      })
    })
    return addToPlaylistItems;
  })
}).then((addToPlaylistItems) => {
  return Promise.each(addToPlaylistItems, function(item) {
    return Promise.delay(500).then(() => {
      return addToPlaylist(item.playlistId, item.kind, item.id);
    })
  })
}).then((results) => {
  logger.info('done!', 'skipped: ', skipped);
}).catch((err) => {
  logger.error('error: ', err)
})