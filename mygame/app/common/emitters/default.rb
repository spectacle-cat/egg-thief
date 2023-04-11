module Emitters
  module Default
    extend self

    DEG2RAD = Math::PI / 180

    def emit(opts={})
      dir = rand(360)
      {
        x: opts[:x] + rand(20),
        y: opts[:y] + rand(20),
        w: opts[:w] || 1,
        h: opts[:h] || 1,
        angle: opts[:angle] || 0,
        direction: dir,
        r: opts[:r] || rand(255),
        g: opts[:g] || rand(255),
        b: opts[:b] || rand(255),
        a: opts[:a] || 150,
        path: opts[:path] || :pixel,
        blendmode_enum: opts[:blendmode_enum] || 2
      }
    end

    def update(particle)
      p = particle

      p[:x] += Math.cos(p[:direction] * DEG2RAD) - 1
      p[:y] += Math.sin(p[:direction] * DEG2RAD) - 1
      p[:angle] += p[:direction] < 180 ? -0.5 : 0.5
      p[:h] += 2
      p[:w] += 2
      p[:a] -= 1
    end
  end
end