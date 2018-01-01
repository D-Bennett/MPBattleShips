// Config
var gameport = 4004;
var verbose = false;

var moment = require('moment');
var express = require('express');
var http = require('http');
var uuid = require('uuid');
var app = express();
var server = http.Server(app);
var socket_io = require('socket.io');
var io = socket_io(server);
var gameServerManager = require('./game_server');

var clients = {};
var games = {};

// Helpers
var log = function(msg) {
  var now = moment();
  var formatted = now.format('DD-MM-YYYY HH:mm:ss');
	console.log('[' + formatted + '] ' + msg);
}

// Run time
server.listen( gameport );
log('Listening on port ' + gameport);

// File servering
app.get('/', function(req, res){
	res.sendFile(__dirname + '/web/app.html');
});
app.use('/assets', express.static(__dirname + '/web/assets'));

// Server IO
io.set('log level', 0);
io.set('authorization', function (handshakeData, callback) {
  callback(null, true); // error first callback style
});

var sendLobbyInfo = function() {
  //log('Send lobby info');
  var client_ids = Object.keys(clients);

  var lobby_data = {
    'clients': client_ids,
    'games': []
  };

  var game_ids = Object.keys(games);
  for (var i=0; i<game_ids.length; i++) {
    var game_id = game_ids[i];
    var game = games[game_id];
    lobby_data.games.push({
      id: game_id,
      game_state: game.game_state,
      total_players: game.getUsedSlotsCount()
    });
  }

  io.to('lobby').emit('lobby-info', lobby_data);
}

var sendClientInfo = function(client) {
  client.emit('client-info', {
    user_id: client.user_id,
    game_id: client.game_id
  });
}

var showPopup = function(client, text) {
  client.emit('display-popup', { action:'show', message:text } );
}

var updatePopupText = function(client, text) {
  client.emit('display-popup', { action:'update-text', message:text } );
}

var closePopup = function(client) {
  client.emit('display-popup', { action:'hide' } );
}

var findAvailableGame = function() {
  log('findAvailableGame');
  var game_ids = Object.keys(games);
  if (game_ids.length > 0) {
    for (var i=0; i<game_ids.length; i++) {
      var game_id = game_ids[i];
      var game = games[game_id];
      if (game.isGameFreeToJoin()) {
        if (game.getUsedSlotsCount() > 0) {
          log('Found game (' + game_id + ')');
          return game;
        }
      }
    }
  }
  log('No game found.');
  return null;
}

io.on('connection', function (client) {
  //Setup client
  client.user_id = uuid();
  client.game_id = null;
  client.join('lobby');
  clients[client.user_id] = client;

  log('Player ' + client.user_id + ' - connected');

  sendClientInfo(client);

  // Find game code
  client.on('find-game', function () {
    log('Player ' + client.user_id + ' - find game');

    showPopup(client, 'Looking for a free game, please wait.');
    setTimeout(function () {
      var gameWithEmptySlot = findAvailableGame();
      if (gameWithEmptySlot !== null) {
        // Found an existing game.
        updatePopupText(client, 'Game found, joining now.');
        setTimeout(function () {

          //Set the client to the game
          var clientGameSlot = gameWithEmptySlot.getFreePlayerSlot();
          if (clientGameSlot !== false) {
            gameWithEmptySlot.setClient(clientGameSlot, client, false);
            client.game_id = gameWithEmptySlot.id;
            client.game_slot = clientGameSlot;
            client.join('game ' + gameWithEmptySlot.id);
            sendClientInfo(client);
            gameWithEmptySlot.sendClientData(clientGameSlot);
          } else {
            //Game no longer available.
          }

          closePopup(client);
        }, 1000);
      } else {
        //Create a new game.
        updatePopupText(client, 'No game found, creating one now.');
        setTimeout(function () {
          //Create a game.
          var newGame = gameServerManager.new();
          games[newGame.id] = newGame;

          //Set the client to the game
          var clientGameSlot = 0;
          newGame.setClient(clientGameSlot, client, false);
          client.game_id = newGame.id;
          client.game_slot = clientGameSlot;
          client.join('game ' + newGame.id);
          sendClientInfo(client);
          newGame.sendClientData(clientGameSlot);

          closePopup(client);
        }, 1000);
      }
    }, 1000);
  });

  client.on('place-ship', function(data) {
    if (client.game_id !== null) {
      games[client.game_id].playerPlaceShip(client.game_slot, data);
    }
  });

  client.on('attack', function(data) {
    if (client.game_id !== null) {
      games[client.game_id].playerAttack(client.game_slot, data);
    }
  });

  client.on('ready', function() {
    if (client.game_id !== null) {
      games[client.game_id].playerReady(client.game_slot);
    }
  });

  client.on('disconnect', function () {
		log('Player ' + client.user_id + ' - disconnected');

    if (client.game_id !== null) {
      games[client.game_id].playerDisconnect(client.game_slot);
      if (games[client.game_id].getUsedSlotsCount() == 0) {
        delete games[client.game_id];
      }
    }

    delete clients[client.user_id];
	});
});

setInterval(sendLobbyInfo, 500);
