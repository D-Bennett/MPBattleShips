module.exports = {
  new: function () {
    var game_server = new GameServer();
    game_server.setup();
    return game_server;
  },
};

var uuid = require('uuid');

var GameServer = function() {
	var _self = this;

  _self.id = null;
	_self.game_state = 0;
  /*
    0 = Waiting for players to join.
    1 = Players connected, selecting their ship's.
    2 = Running.
    3 = Game over.
  */

	_self.players = [null,null];
	_self.players_data = [
		{attacks:null,ready_up:false,ships:[{x:0,y:0,d:1,s:1,h:0},{x:0,y:1,d:1,s:2,h:0},{x:0,y:2,d:1,s:3,h:0},{x:0,y:3,d:1,s:4,h:0},{x:0,y:4,d:1,s:5,h:0}]},
		{attacks:null,ready_up:false,ships:[{x:0,y:0,d:1,s:1,h:0},{x:0,y:1,d:1,s:2,h:0},{x:0,y:2,d:1,s:3,h:0},{x:0,y:3,d:1,s:4,h:0},{x:0,y:4,d:1,s:5,h:0}]}
	];
	_self.players_placed = [0,0];
	_self.players_ready = [0,0];
	_self.turn = 0;
	//_self.io = null;

	_self.setup = function() {
    _self.id = uuid();
		for (var player_slot=0; player_slot<2; player_slot++) {
			_self.players_data[player_slot].attacks = [];
			for (var i=0; i<10; i++) {
				_self.players_data[player_slot].attacks.push([0,0,0,0,0,0,0,0,0,0]);
			}
		}
	}

  _self.shipToBlocks = function (ship) {
		var points = [];
		for (var i=0; i<ship.s; i++) {
			points.push([ship.x + (ship.d==1?i:0), ship.y + (ship.d==0?i:0)]);
		}
		return points;
	}

  _self.isValidShipPlacement = function (ship, ships, newpos) {
		var ship_points = _self.shipToBlocks({x:newpos.x, y:newpos.y, d:newpos.d, s:ships[ship].s});
		for (var p=0; p<ship_points.length; p++) {
			if (ship_points[p][0]<0||ship_points[p][1]<0||ship_points[p][0]>9||ship_points[p][1]>9) {
				return false;
			}
			for (var q=0; q<ships.length; q++) {
				if (q != ship) {
					var other_ship_points = _self.shipToBlocks(ships[q]);
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

  _self.setClient = function(player_slot, client) {
    _self.players[player_slot] = client;

    if (_self.players[0] !== null && _self.players[1] !== null) {
      _self.setGameState(1);
    } else {
      _self.sendAllClientData();
    }
  }

  _self.sendClientData = function(player_slot) {
    console.log('sendClientData', player_slot);
    if (_self.players[player_slot] !== null) {
      console.log('player ' + player_slot + ' not null.');
      var blob = {
        game_state: _self.game_state,
        turn: _self.turn,
        data: _self.players_data[player_slot],
        playerid: player_slot,
        opponents_atack: _self.players_data[(player_slot==0?1:0)].attacks,
      };
      _self.players[player_slot].emit('client-data', blob);
    }
  }

  _self.sendAllClientData = function() {
    console.log('sendAllClientData');
		for (var player_slot=0; player_slot<2; player_slot++) {
			_self.sendClientData(player_slot);
		}
  }

  _self.setGameState = function (new_game_state) {
    if (new_game_state == 0) {
      _self.game_state = 0;

    } else if (new_game_state == 1) {
      _self.game_state = 1;

    } else if (new_game_state == 2) {
      _self.game_state = 2;

    } else if (new_game_state == 3) {
      _self.game_state = 3;

    }
    _self.sendAllClientData();
  }

  _self.isGameFreeToJoin = function() {
    if (_self.game_state == 0) {
      return true;
    }
    return false;
  }

  _self.getUsedSlotsCount = function() {
    var used_count = 0;
    for (var player_slot=0; player_slot<2; player_slot++) {
			if (_self.players[player_slot] !== null) {
				used_count++;
			}
		}
    return used_count;
  }

  _self.getFreePlayerSlot = function() {
		for (var player_slot=0; player_slot<2; player_slot++) {
			if (_self.players[player_slot] === null) {
				return player_slot;
			}
		}
		return false;
	}

  /*
  _self.playerConnected = function(player) {
    if (!_self.isGameFreeToJoin()) {
      return false;
    }

		var playerSlot = _self.getFreePlayerSlot();
		if (playerSlot === false) {
			return false;
		}

    _self.players[playerSlot] = player;

    //socket.emit('client-id', slot);
    //_self.io.emit('player-joined', slot);
    _self.sendAllClientData();

    if (_self.players[0] !== null && _self.players[1] !== null) {
      _self.setGameState(1);
    }

    return playerSlot;
  }
  */

  _self.playerPlaceShip = function(player_slot, data) {
    var ship = data.index;
    if (_self.isValidShipPlacement(ship, _self.players_data[player_slot].ships, data.data)) {
      _self.players_data[player_slot].ships[ship].x = data.data.x;
      _self.players_data[player_slot].ships[ship].y = data.data.y;
      _self.players_data[player_slot].ships[ship].d = data.data.d;
      _self.sendClientData(player_slot);
    }
  }

  _self.playerAttack = function(player_slot, data) {
    if (data !== null) {
      if (data.x >= 0 && data.x < 10 && data.y >=0 && data.y < 10) {
        if (_self.turn == player_slot && _self.players_data[player_slot].attacks[data.x][data.y] == 0) {
          var other_player_slot = (player_slot==0?1:0);
          _self.turn = other_player_slot;
          _self.players_data[player_slot].attacks[data.x][data.y] = 1;
          for (var q=0; q<_self.players_data[other_player_slot].ships.length; q++) {
            var other_ship_points = _self.shipToBlocks(_self.players_data[other_player_slot].ships[q]);
            for (var qi=0; qi<other_ship_points.length; qi++) {
              if (other_ship_points[qi][0] == data.x && other_ship_points[qi][1] == data.y) {
                _self.players_data[player_slot].attacks[data.x][data.y] = 2;
                _self.players_data[other_player_slot].ships[q].h++;
                break;
              }
            }
          }
          _self.sendAllClientData();
        }
      }
    }
  }

  _self.playerReady = function(player_slot) {
    if (_self.game_state == 1 && player_slot >= 0) {
			_self.players_data[player_slot].ready_up = true;
			_self.sendAllClientData();
			if (_self.players_data[0].ready_up && _self.players_data[1].ready_up) {
				_self.setGameState(2);
			}
		}
  }

  _self.playerDisconnect = function(player_slot) {
    if (player_slot >= 0) {
      _self.players[player_slot] = null;
      if (_self.game_state == 1 || _self.game_state == 2) {
        _self.setGameState(3);
      }
    }
    _self.sendAllClientData();
  }

}
