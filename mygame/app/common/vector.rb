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
    vamount = Vector.build(amount)
    Vector.new(x: x * vamount.x, y: y * vamount.y)
  end

  def +(amount)
    vamount = Vector.build(amount)
    Vector.new(x: x + vamount.x, y: y + vamount.y)
  end

  def inspect
    serialize
  end

  def serialize
    { x: x, y: y }
  end

  class << self
    def build(data)
      if data.is_a?(Array)
        new(x: data.first, y: data.last)
      elsif data.is_a?(Hash)
        new(x: data[:x], y: data[:y])
      elsif data.respond_to?(:x) && data.respond_to?(:y)
        new(x: data.x, y: data.y)
      else
        raise "cannot build vector from #{data}"
      end
    end

    def mag(x, y)
      ((x**2)+(y**2))**0.5
    end

    def distance_between(a_vector, b_vector)
      $geometry.distance(Vector.build(a_vector), Vector.build(b_vector))
    end
  end
end