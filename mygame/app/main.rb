require 'app/player.rb'
require 'app/tile_board.rb'

def tick args
  args.outputs.solids << background(args)
  args.state.collected_nests ||= []
  args.state.level ||= 1
  args.state.exit_level ||= false

  if args.state.exit_level
    if last_level?(args)
      render_game_complete(args)
    else
      setup_next_level(args)
    end
  else
    if args.tick_count == 0
      load_level(args)
      TileBoard.setup(args)
    end

    render_level(args)
    show_score(args)
  end
end

def render_level(args)
  TileBoard.render_tiles(args)
  TileBoard.render_finish(args)
  TileBoard.render_nests(args)
  Player.tick(args)
  TileBoard.render_cover(args)
end

def last_level?(args)
  next_level = args.state.level + 1
  data = args.gtk.read_file(level_path(next_level))
  result = data.to_s.length == 0

  puts result
  result
end

def level_path(level)
  "data/levels/level_#{level}.txt"
end

def load_level(args)
  data = args.gtk.read_file(level_path(args.state.level))
  rows = data.split

  args.state.level_data = rows.reverse.map { |row| row.chars }
end

def setup_next_level(args)
  args.state.level += 1

  Player.reset(args)
  TileBoard.reset(args)
  load_level(args)
  TileBoard.setup(args)

  args.state.exit_level = false
end

def render_game_complete(args)
  args.outputs.labels << [
    x: args.grid.left.shift_right(720 - 275),
    y: args.grid.top.shift_down(200),
    text: "CONGRATULATIONS!",
    size_enum: 20,
  ]

  args.outputs.labels << [
    x: args.grid.left.shift_right(720 - 270),
    y: args.grid.top.shift_down(350),
    text: "You've completed the Game!",
    size_enum: 10,
  ]

  args.outputs.labels << [
    x: args.grid.left.shift_right(720 - 270),
    y: args.grid.top.shift_down(400),
    text: "Eggs #{args.state.collected_nests.count} / 100",
    size_enum: 5,
  ]

  args.outputs.labels << [
    x: args.grid.left.shift_right(720 - 270),
    y: args.grid.top.shift_down(500),
    text: "Press SPACE to restart",
    size_enum: 5,
  ]
end

def show_score(args)
  args.outputs.labels << [
    x: 50,
    y: 700,
    text: "Eggs: #{args.state.collected_nests.count}",
    size_enum: 10,
  ]
end

def background(args)
  [
    x: 0,
    y: 0,
    w: args.grid.w,
    h: args.grid.h,
    r: 30,
    g: 30,
    b: 30,
  ]
end
