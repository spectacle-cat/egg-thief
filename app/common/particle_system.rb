require 'app/common/emitters/default.rb'
require 'app/common/emitters/trail.rb'

DEG2RAD = Math::PI / 180

class ParticleSystem
  attr_accessor :x, :y, :rate, :count, :emitter
  attr_reader :particles

  def initialize(x:, y:, rate:, count:, emitter: nil)
    @x = x
    @y = y
    @rate = rate
    @particles = []
    @ticks_since_last_emission = 0
    @count = count
    @emitter = emitter || Emitters::Default
  end

  def update(args)
    self.count -= 1
    update_particles(args)
    if emit?
      ticks_per_emission = 60.fdiv(rate) # 5 => 12 pps; 0.2 => 300 pps. If ticks_per_emision < 1, multiple particles should be emitted in a single tick

      # count ticks until we reach a tick where we should emit a particle.
      @ticks_since_last_emission += 1
      particles_to_emit = (@ticks_since_last_emission / ticks_per_emission).floor

      if particles_to_emit > 0
        particles_to_emit.times { |i| particles << emit }
        @ticks_since_last_emission = 0
      end
    end
  end

  def emit?
    true if count.nil?
    count > 0
  end

  def dead?
    count <= 0 && particles.empty?
  end

  def update_particles(args)
    particles.reject! { |p| p[:a] <= 0 }

    particles.each do |p|
      emitter.update(p, args)
    end
  end

  def render
    $gtk.args.outputs.sprites << particles
  end

  def emit
    emitter.emit(x: x, y: y)
  end
end

# class ParticlesTestScene < Lair::Scene
#   def setup
#     @systems = []
#   end

#   def run
#     $args.outputs.background_color = [ 0,0,0 ]
#     mouse = $args.inputs.mouse
#     if mouse.click
#       @systems << ParticleSystem.new(x: mouse.x, y: mouse.y, rate: 15, count: 50)
#     end
#     @systems.each do |s|
#       s.update
#       @systems.delete(s) if s.dead?
#       s.render
#     end
#   end
# end