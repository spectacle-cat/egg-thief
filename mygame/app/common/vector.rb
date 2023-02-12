class Vector
  attr_reader :x, :y

  def initialize(x:, y:)
    @x = x
    @y = y
  end

  def normalize
    [
      x / Vector.mag(x, y),
      y / Vector.mag(x, y)
    ]
  end

  def *(amount)
    Vector.new(x: x * amount, y: y * amount)
  end

  class << self
    def build(data)
      if data.is_a?(Array)
        new(arr.first, arr.last)
      elsif data.is_a?(Hash)
        new(data[:x], data[:y])
      elsif data.respond_to?(:x) && data.respond_to?(:y)
        new(data.x, data.y)
      else
        raise "cannot build vector from #{data}"
      end
    end

    def mag(x, y)
      ((x**2)+(y**2))**0.5
    end

    def distance_between(a_vector, b_vector)
      $geometry.distance(a_vector, b_vector)
    end
  end
end