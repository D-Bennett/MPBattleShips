var app = require('express')();
var http = require('http').Server(app);

var MPMono_Server = function() {
	var _self = this;
	_self.game_state = 0; //0=Waiting, 1=Setup, 2=Runing, 3=Gameover
	_self.players = [null,null];
	_self.players_data = [{grid:null,attacks:null,ships:null},{grid:null,attacks:null,ships:null}];
	_self.players_placed = [0,0];
	_self.players_ready = [0,0];
	_self.turn = 0;
	_self.io = null;
	
	_self.free_player_slot = function() {
		for (var p=0; p<_self.players.length; p++) {
			if (_self.players[p] === null) {
				return p;
			}
		}
		return -1;
	}
	_self.player_connect = function (player) {
		if (_self.game_state == 0) {//Waiting game, fill ANY slot.
			var playerSlot = _self.free_player_slot();
			if (playerSlot >= 0) {
				_self.players[playerSlot] = player;
				return playerSlot;
			} 
		}
		return -1;
	}
	_self.player_disconnect = function (player_slot) {
		if (player_slot >= 0) {
			_self.players[player_slot] = null;
			if (_self.game_state == 1 || _self.game_state == 2) {
				_self.game_end();
			}
		} else {
			//Spectator Left
		}
		_self.send_game_data();
	}
	_self.player_chat = function (message) {
		//Send chat message to all.
	}
	_self.player_ready = function (player_slot) {
		if (_self.game_state == 1) {
			if (player_slot >= 0) {
				if (_self.players_placed[player_slot] == 1) {
					_self.players_ready[player_slot] = 1;
					if (_self.players_ready[0] == 1 && _self.players_ready[1] == 1) {
						_self.game_run();
					} else {
						_self.send_game_data();
					}
				}
			}
		}
	}
	_self.game_run = function () {
		if (_self.game_state == 0) {
			_self.game_state = 1;
			
		} else if (_self.game_state == 1) {
			_self.game_state = 2;

		}
		_self.send_game_data();
	}
	_self.game_end = function () {
		_self.game_state = 3;
		//GAME OVER
	}
	_self.send_game_data = function() {
		for (var p=0; p<_self.players.length; p++) {
			if (_self.players[p] !== null) {
				var blob = {
					game_state: _self.game_state,
					turn: _self.turn,
					data: _self.players_data[p],
				};
				_self.players[p].emit('game-data', blob);
			}
		}
	}
	_self.init = function() {
		for (var p=0; p<_self.players.length; p++) {
			_self.players_data[p].grid = [];
			_self.players_data[p].attacks = [];
			for (var i=0; i<10; i++) {
				_self.players_data[p].grid.push([0,0,0,0,0,0,0,0,0,0]);
				_self.players_data[p].attacks.push([0,0,0,0,0,0,0,0,0,0]);
			}
		}
		_self.io.on('connection', function(socket) {
			var slot = _self.player_connect(socket);
			socket.emit('client-id', slot);
			_self.io.emit('player-joined', slot);
			_self.send_game_data();
			if (_self.game_state == 0) {
				if (_self.players[0] !== null && _self.players[1] !== null) {
					_self.game_run();
				}
			}
			socket.on('disconnect', function(){
				_self.player_disconnect(slot);
				_self.io.emit('player-left', slot);
			});
		});
	}
}

app.get('/', function(req, res){
	res.sendFile(__dirname + '/web/index.html');
});

var server = new MPMono_Server();
server.io = require('socket.io')(http);
server.init();

http.listen(3000, function(){
	console.log('listening on *:3000');
});
