module Emitters
  class Trail
    attr_accessor :force

    def initialize(force: 0.1)
      # @direction = Vector.build(direction)
      @force = force
    end

    def emit(opts={})
      {
        x: opts[:x],
        y: opts[:y],
        w: opts[:w] || 20,
        h: opts[:h] || 20,
        angle: opts[:angle] || 0,
        # TODO: change this to actual degrees based off of the direction vector
        direction: 0,
        r: opts[:r],
        g: opts[:g],
        b: opts[:b],
        a: opts[:a] || 150,
        path: opts[:path] || :pixel,
        blendmode_enum: opts[:blendmode_enum] || 2
      }
    end

    def update(particle, args)
      p = particle

      particle_pos = Vector.build(particle)
      player_pos = Vector.build(
        x: args.state.player.x,
        y: args.state.player.y,
      )

      diff = (player_pos - particle_pos) * force

      particle[:x] += diff.x
      particle[:y] += diff.y
    end
  end
end