require 'app/player.rb'

def tick args
  args.outputs.solids << background(args)

  Player.tick(args)
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
