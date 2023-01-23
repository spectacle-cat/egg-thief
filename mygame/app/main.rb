require 'app/player.rb'
require 'app/tile_board.rb'

def tick args
  args.outputs.solids << background(args)
  args.state.collected_nests ||= []

  TileBoard.setup(args, level: 1) if args.tick_count == 0
  TileBoard.render_tiles(args)
  TileBoard.render_nests(args)
  Player.tick(args)
  TileBoard.render_cover(args)

  show_score(args)
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
