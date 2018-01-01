var Game_Viewer = function(canvas_id, game_ready_id) {

  var _self = this;
  _self.render_width = 800;
  _self.render_height = 500;

  _self.canvas = document.getElementById(canvas_id);
  _self.is_rendering = false;
  _self.jq_canvas = jQuery(_self.canvas);
  _self.context = _self.canvas.getContext("2d");
  _self.blob = null;
  _self.mouse_dragging = false;
  _self.mouse_coords = {x:0, y:0};

  _self.game_ready_button = jQuery('#' + game_ready_id);

  _self.place_ship = -1;
  _self.first_block = null;
  _self.move_offset = null;
  _self.move_rot = 0;
  _self.move_valid_placement = false;

  _self.num_letter = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

  _self.left_box = {
    x: 7.5,
    y: 107.5,
    w: 385,
    h: 385,
  };
  _self.right_box = {
    x: 407.5,
    y: 107.5,
    w: 385,
    h: 385,
  };
  _self.block_size = 35;

  _self.point_in_box = function (box, point){
    return (
      point.x > (box.x) &&
      point.x < (box.x + box.w) &&
      point.y > (box.y) &&
      point.y < (box.y + box.h)
    );
  }

  _self.xy_from_grid = function (box, point) {
    for (var x=0; x<10; x++) {
      for (var y=0; y<10; y++) {
        var vbox = {
          x:(box.x + (_self.block_size * (x+1))),
          y:(box.y + (_self.block_size * (y+1))),
          w:_self.block_size,
          h:_self.block_size
        };
        if (_self.point_in_box(vbox,point)) {
          return {x:x, y:y};
        }
      }
    }
    return null;
  }

  _self.ship_to_box = function (box, ship, offset, offset_rotation) {
    return {
      x: box.x + (_self.block_size * (ship.x + 1 + (offset==null?0:offset[0]))),
      y: box.y + (_self.block_size * (ship.y + 1 + (offset==null?0:offset[1]))),
      h: _self.block_size * ((offset_rotation==null?ship.d:offset_rotation) == 0 ? ship.s : 1),
      w: _self.block_size * ((offset_rotation==null?ship.d:offset_rotation) == 1 ? ship.s : 1),
    };
  }

  _self.valid_ship_placement = function (ship, offset, offset_rotation) {
    //console.log("valid_ship_placement", ship, offset, offset_rotation);
    var ship_points = _self.ship_to_blocks(_self.blob.data.ships[ship], offset, offset_rotation);
    for (var p=0; p<ship_points.length; p++) {
      if (ship_points[p][0]<0||ship_points[p][1]<0||ship_points[p][0]>9||ship_points[p][1]>9) {
        return false;
      }
      for (var q=0; q<_self.blob.data.ships.length; q++) {
        if (q != ship) {
          var other_ship_points = _self.ship_to_blocks(_self.blob.data.ships[q]);
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

  _self.ship_to_blocks = function (ship, offset, offset_rotation) {
    //console.log('ship_to_blocks', ship, offset, offset_rotation);
    var points = [];
    for (var i=0; i<ship.s; i++) {
      points.push([ship.x + (offset==null?0:offset[0]) + ((offset_rotation==null?ship.d:offset_rotation)==1?i:0), ship.y + (offset==null?0:offset[1]) + ((offset_rotation==null?ship.d:offset_rotation)==0?i:0)]);
    }
    return points;
  }

  // GRAPHICS
  _self.renderFrame = function () {
    _self.context.fillStyle = "#d5e6d3";
    _self.context.fillRect(0,0,_self.render_width,_self.render_height);

    var draw_cross_hair = function (box) {
      _self.context.strokeStyle = "red";
      _self.context.lineWidth = 2;
      _self.context.lineCap = 'butt';

      _self.context.beginPath();
      _self.context.moveTo(_self.mouse_coords.x-10, _self.mouse_coords.y);
      _self.context.lineTo(_self.mouse_coords.x+10, _self.mouse_coords.y);
      _self.context.stroke();
      _self.context.beginPath();
      _self.context.moveTo(_self.mouse_coords.x, _self.mouse_coords.y-10);
      _self.context.lineTo(_self.mouse_coords.x, _self.mouse_coords.y+10);
      _self.context.stroke();
    }

    // _self.context.fillRect(_self.left_box.x + (_self.block_size * (x+1)) + 4, _self.left_box.y + (_self.block_size * (y+1)) + 4, _self.block_size - 8, _self.block_size - 8);

    var draw_hit = function (box, x, y) {
      var lx = box.x + (_self.block_size * (x+1));
      var ly = box.y + (_self.block_size * (y+1));

      _self.context.strokeStyle = "red";
      _self.context.lineWidth = 3;
      _self.context.lineCap = 'round';

      _self.context.beginPath();
      _self.context.moveTo(lx + 2, ly + 2);
      _self.context.lineTo(lx + _self.block_size - 4, ly + _self.block_size - 4);
      _self.context.stroke();

      _self.context.beginPath();
      _self.context.moveTo(lx + 2, ly + _self.block_size - 4);
      _self.context.lineTo(lx + _self.block_size - 4, ly + 2);
      _self.context.stroke();

    }

    var draw_miss = function (box, x, y) {

      var cx = box.x + (_self.block_size * (x+1)) + (_self.block_size*0.5);
      var cy = box.y + (_self.block_size * (y+1)) + (_self.block_size*0.5);

      _self.context.strokeStyle = "blue";
      _self.context.lineWidth = 3;

      _self.context.beginPath();
      _self.context.arc(cx, cy, (_self.block_size*0.5)-2, 0, 2 * Math.PI, false);
      _self.context.stroke();
    }

    var draw_grid = function (box) {
      _self.context.fillStyle = "#ffffff";
      _self.context.fillRect(box.x+_self.block_size,box.y+_self.block_size,box.w-_self.block_size,box.h-_self.block_size);
      _self.context.font = '20px Arial';
      _self.context.textAlign = 'center';
      _self.context.textBaseline = 'middle';
      _self.context.fillStyle = 'blue';
      _self.context.strokeStyle = "black";
      _self.context.lineWidth = 2;
      _self.context.lineCap = 'butt';
      for (var i=0; i<=10; i++) {
        _self.context.beginPath();
        _self.context.moveTo(box.x + (_self.block_size * (i+1)), box.y + _self.block_size);
        _self.context.lineTo(box.x + (_self.block_size * (i+1)), box.y + box.h);
        _self.context.stroke();
        _self.context.beginPath();
        _self.context.moveTo(box.x + _self.block_size, box.y + (_self.block_size * (i+1)));
        _self.context.lineTo(box.x + box.w, box.y + (_self.block_size * (i+1)));
        _self.context.stroke();
        if (i>0) {
          _self.context.fillText(i, box.x + (_self.block_size * i) + (_self.block_size / 2), box.y + (_self.block_size / 2));
          _self.context.fillText(_self.num_letter[i-1], box.x + (_self.block_size / 2), box.y + (_self.block_size * i) + (_self.block_size / 2));
        }
      }
    }


    if (_self.blob !== null) {
      if (_self.blob.game_state == 0) {

        _self.context.font = '20px Arial';
        _self.context.textAlign = 'center';
        _self.context.textBaseline = 'middle';
        _self.context.fillStyle = 'black';
        _self.context.fillText("Waiting on another player to join.", 400, 20);

      } else if (_self.blob.game_state == 1) {

        _self.context.font = '20px Arial';
        _self.context.textAlign = 'center';
        _self.context.textBaseline = 'middle';
        _self.context.fillStyle = 'black';
        _self.context.fillText((_self.blob.data.ready_up?'Ship\'s placed, waiting on other player.':'Please place ships and click \'Ready\' when done.'), 400, 20);

        draw_grid(_self.right_box);

        _self.context.strokeStyle = "blue";

        for (var ship_i=0; ship_i<_self.blob.data.ships.length; ship_i++) {
          if (ship_i != _self.place_ship) {
            var ship = _self.ship_to_box(_self.right_box, _self.blob.data.ships[ship_i], null, null);
            _self.context.beginPath();
            _self.context.rect(ship.x, ship.y, ship.w, ship.h);
            if (_self.place_ship == -1 && _self.point_in_box(ship, _self.mouse_coords)) {
              _self.context.fillStyle = 'lightblue';
            } else {
              _self.context.fillStyle = 'yellow';
            }
            _self.context.fill();
            _self.context.stroke();
          }
        }

        if (_self.place_ship > -1) {
          var os = _self.move_offset;
          var ship = _self.ship_to_box(_self.right_box, _self.blob.data.ships[_self.place_ship], os, _self.move_rot);
          _self.context.beginPath();
          _self.context.rect(ship.x, ship.y, ship.w, ship.h);
          if (_self.move_valid_placement) {
            _self.context.fillStyle = 'blue';
          } else {
            _self.context.fillStyle = 'red';
          }
          _self.context.fill();
          _self.context.stroke();
        }

        _self.context.fillStyle = "red";
        var block = _self.xy_from_grid(_self.right_box, _self.mouse_coords);
        if (block != null) {
          _self.context.fillRect(_self.right_box.x + (_self.block_size * (block.x+1)) + 4, _self.right_box.y + (_self.block_size * (block.y+1)) + 4, _self.block_size - 8, _self.block_size - 8);
        }

        draw_cross_hair();

      } else if (_self.blob.game_state == 2) {

        _self.context.font = '20px Arial';
        _self.context.textAlign = 'center';
        _self.context.textBaseline = 'middle';
        _self.context.fillStyle = 'black';
        _self.context.fillText((_self.blob.turn == _self.blob.playerid ?'Its your turn, please click on the map your next target.':'Waiting on the other player to place their move.'), 400, 20);

        draw_grid(_self.left_box);
        _self.context.font = '20px Arial';
        _self.context.textAlign = 'center';
        _self.context.textBaseline = 'middle';
        _self.context.fillStyle = 'black';
        _self.context.fillText('Opponent\'s board', _self.left_box.x + _self.block_size + ((_self.left_box.w-_self.block_size)/2), 80);

        draw_grid(_self.right_box);
        _self.context.font = '20px Arial';
        _self.context.textAlign = 'center';
        _self.context.textBaseline = 'middle';
        _self.context.fillStyle = 'black';
        _self.context.fillText('Your board', _self.right_box.x + _self.block_size + ((_self.right_box.w-_self.block_size)/2), 80);

        _self.context.strokeStyle = "blue";
        _self.context.fillStyle = 'yellow';
        for (var ship_i=0; ship_i<_self.blob.data.ships.length; ship_i++) {
            var ship = _self.ship_to_box(_self.right_box, _self.blob.data.ships[ship_i], null, null);
            _self.context.beginPath();
            _self.context.rect(ship.x, ship.y, ship.w, ship.h);
            _self.context.fill();
            _self.context.stroke();
        }

        for (var x=0; x<10; x++) {
          for (var y=0; y<10; y++) {
            if (_self.blob.opponents_atack[x][y] == 1) { //Enemy attack (MISSED)
              draw_miss(_self.right_box, x, y);
            } else if (_self.blob.opponents_atack[x][y] == 2) { //Enemy attack (HIT)
              draw_hit(_self.right_box, x, y);
            }
          }
        }
        for (var x=0; x<10; x++) {
          for (var y=0; y<10; y++) {
            if (_self.blob.data.attacks[x][y] == 1) { //Your attack (MISSED)
              draw_miss(_self.left_box, x, y);
            } else if (_self.blob.data.attacks[x][y] == 2) { //Enemy attack (HIT)
              draw_hit(_self.left_box, x, y);
            }
          }
        }
        draw_cross_hair();
      } else if (_self.blob.game_state == 3) {


      }
    }
  }

  _self.startRendering = function() {
    if (_self.is_rendering == false) {
      _self.is_rendering = true;
      var timeRender = function() {
        if (_self.is_rendering) {
          _self.renderFrame();
          setTimeout(timeRender, 100);
        }
      }
      timeRender();
    }
  }

  _self.stopRendering = function() {
    _self.is_rendering = false;
  }

  _self.resetGui = function() {
    _self.mouse_dragging = false;
    _self.mouse_coords = {x:0, y:0};
    _self.place_ship = -1;
    _self.first_block = null;
    _self.move_offset = null;
    _self.move_rot = 0;
    _self.move_valid_placement = false;
  }

  _self.setBlob = function(data) {
    console.log('setBlob', data);
    _self.blob = data;
  }

  _self.setupEvents = function() {
    _self.jq_canvas.on('mousedown', function(event){
      _self.mouse_dragging = true;
      _self.drag(event, {x:event.offsetX, y:event.offsetY}, true);
    });
    _self.jq_canvas.on('click', function(event){
      _self.click(event, {x:event.offsetX, y:event.offsetY});
    });
    _self.jq_canvas.on("mousemove", function(e){
      _self.drag(event, {x:event.offsetX, y:event.offsetY}, false);
    });
    jQuery(document.body).mouseup(function() {
      _self.dragEnd(event, {x:event.offsetX, y:event.offsetY});
    });
    jQuery(document.body).keypress(function( event ) {
      _self.keypress(event);
    });
    _self.game_ready_button.on('click', function(event){
      _self.readyClick(event);
    });
  };

  _self.drag = function(event, coords, first_click) {
    event.preventDefault();
    _self.mouse_coords = coords;
    if (_self.blob !== null) {
      if (_self.blob.game_state == 1 && _self.blob.data.ready_up == false) {
        if (first_click == true) {
          _self.place_ship = -1;
          _self.first_block = null;
          var block = _self.xy_from_grid(_self.right_box, _self.mouse_coords);
          if (block != null) {
            for (var ship_i=0; ship_i<_self.blob.data.ships.length; ship_i++) {
              var points = _self.ship_to_blocks(_self.blob.data.ships[ship_i], null, null);
              for (var point_i=0; point_i<points.length; point_i++) {
                if (points[point_i][0] == block.x && points[point_i][1] == block.y) {
                  _self.place_ship = ship_i;
                  _self.first_block = {x:_self.blob.data.ships[ship_i].x, y:_self.blob.data.ships[ship_i].y}; //block;
                  _self.move_rot = _self.blob.data.ships[ship_i].d;
                  _self.move_offset = [0,0];
                  _self.move_valid_placement = true;
                  break;
                }
              }
            }
          }
        } else {
          if (_self.mouse_dragging) {
            if (_self.place_ship > -1 && _self.first_block != null) {
              var block = _self.xy_from_grid(_self.right_box, _self.mouse_coords);
              if (block != null) {
                var offset = [
                  block.x - _self.first_block.x,
                  block.y - _self.first_block.y,
                ];
                var valid_placement = _self.valid_ship_placement(_self.place_ship, offset, _self.move_rot);

                _self.move_offset = offset;
                _self.move_valid_placement = valid_placement;
              }
            }
          }
        }
      } else if (_self.blob.game_state == 2 && _self.blob.turn == _self.blob.playerid) {
        if (first_click == true) {
          var block = _self.xy_from_grid(_self.left_box, _self.mouse_coords);
          if (block != null) {
            _self.jq_canvas.trigger("attack", block);
          }
        }
      }
    }
  }

  _self.dragEnd = function(event, coords) {
    event.preventDefault();
    if (_self.mouse_dragging) {
      _self.mouse_dragging = false;
      if (_self.blob !== null) {
        if (_self.blob.game_state == 1 && _self.blob.data.ready_up == false) {
          var valid_placement = _self.valid_ship_placement(_self.place_ship, _self.move_offset, _self.move_rot);
          if (valid_placement) {
            _self.jq_canvas.trigger("place-ship", {
              index: _self.place_ship,
              data: {
                x: _self.blob.data.ships[_self.place_ship].x + _self.move_offset[0],
                y: _self.blob.data.ships[_self.place_ship].y + _self.move_offset[1],
                d: _self.move_rot
              }
            });
          }
        }
      }
      _self.place_ship = -1;
      _self.first_block = null
      _self.move_rot = 0;
      _self.move_offset = null;
      _self.move_valid_placement = false;
    }
  }

  _self.keypress = function(event) {
    if (event.keyCode == 114 || event.keyCode == 82) {
      if (_self.mouse_dragging) {
        if (_self.move_rot==0) {
          _self.move_rot = 1;
        } else {
          _self.move_rot = 0;
        }
        var valid_placement = _self.valid_ship_placement(_self.place_ship, _self.move_offset, _self.move_rot);
        _self.move_valid_placement = valid_placement;
      }
    }
  }

  _self.click = function(event, coords) {
    event.preventDefault();
  }

  _self.readyClick = function(event) {
    if (_self.blob !== null) {
      if (_self.blob.game_state == 1 && _self.blob.data.ready_up == false) {
        _self.jq_canvas.trigger("ready");
      }
    }
  }

};
