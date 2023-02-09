module Common
  module Direction
    extend self

    def angle(direction)
      case direction
      when :up
        0
      when :down
        180
      when :right
        270
      when :left
        90
      else
        raise "no direction"
      end
    end
  end
end