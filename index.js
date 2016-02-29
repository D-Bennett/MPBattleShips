var app = require('express')();
var http = require('http').Server(app);

var MPMono_Server = function() {
	var _self = this;
	_self.game_state = 0; //0=Waiting, 1=Setup, 2=Runing, 3=Gameover
	_self.players = [null,null];
	_self.players_data = [
		{attacks:null,ready_up:false,ships:[{x:0,y:0,d:1,s:1},{x:0,y:1,d:1,s:2},{x:0,y:2,d:1,s:3},{x:0,y:3,d:1,s:4},{x:0,y:4,d:1,s:5}]},
		{attacks:null,ready_up:false,ships:[{x:0,y:0,d:1,s:1},{x:0,y:1,d:1,s:2},{x:0,y:2,d:1,s:3},{x:0,y:3,d:1,s:4},{x:0,y:4,d:1,s:5}]}
	];
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
		if (_self.game_state == 1 && player_slot >= 0) {
			_self.players_data[player_slot].ready_up = true;
			_self.send_player_game_data(player_slot);
			if (_self.players_data[0].ready_up && _self.players_data[1].ready_up) {
				_self.set_game_state(2);
			}
		}
	}
	_self.set_game_state = function (ns) {
		if (ns == 0) {
			_self.game_state = 0;
			
		} else if (ns == 1) {
			_self.game_state = 1;
			
		} else if (ns == 2) {
			_self.game_state = 2;

		} else if (ns == 3) {
			_self.game_state = 2;

		}
		_self.send_game_data();
	}
	_self.game_end = function () {
		_self.set_game_state(3);
		//GAME OVER
	}
	_self.send_game_data = function() {
		for (var p=0; p<_self.players.length; p++) {
			_self.send_player_game_data(p);
		}
	}
	_self.send_player_game_data = function(p) {
		if (_self.players[p] !== null) {
			var blob = {
				game_state: _self.game_state,
				turn: _self.turn,
				data: _self.players_data[p],
				playerid: p,
				opponents_atack: _self.players_data[(p==0?1:0)].attacks,
			};
			_self.players[p].emit('game-data', blob);
		}
	}
	_self.ship_to_blocks = function (ship) {
		var points = [];
		for (var i=0; i<ship.s; i++) {
			points.push([ship.x + (ship.d==1?i:0), ship.y + (ship.d==0?i:0)]);
		}
		return points;
	}
	_self.valid_ship_placement = function (ship, ships, newpos) {
		var ship_points = _self.ship_to_blocks({x:newpos.x, y:newpos.y, d:newpos.d, s:ships[ship].s});
		for (var p=0; p<ship_points.length; p++) {
			if (ship_points[p][0]<0||ship_points[p][1]<0||ship_points[p][0]>9||ship_points[p][1]>9) {
				return false;
			}
			for (var q=0; q<ships.length; q++) {
				if (q != ship) {
					var other_ship_points = _self.ship_to_blocks(ships[q]);
					for (var r=0; r<other_ship_points.length; r++) {
						if (other_ship_points[r][0] == ship_points[p][0] && other_ship_points[r][1] == ship_points[p][1]) {
							return false;
						}
					}
				}
			}
		}
		return true;
	}
	_self.init = function() {
		for (var p=0; p<_self.players.length; p++) {
			_self.players_data[p].attacks = [];
			for (var i=0; i<10; i++) {
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
					_self.set_game_state(1);
				}
			}
			socket.on('place-ship', function(data){
				var ship = data.index;
				if (_self.valid_ship_placement(ship, _self.players_data[slot].ships, data.data)) {
					_self.players_data[slot].ships[ship].x = data.data.x;
					_self.players_data[slot].ships[ship].y = data.data.y;
					_self.players_data[slot].ships[ship].d = data.data.d;
					_self.send_player_game_data(slot);
				}
			});
			socket.on('attack', function(data){
				if (data !== null) {
					if (data.x >= 0 && data.x < 10 && data.y >=0 && data.y < 10) {
						if (_self.turn == slot) {
							_self.turn = (slot==0?1:0);
							_self.players_data[slot].attacks[data.x][data.y] = 1;
							//if hit ship make 2
							_self.send_game_data();
						}
					}
				}
			});
			socket.on('ready', function(){
				_self.player_ready(slot);
			});
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
