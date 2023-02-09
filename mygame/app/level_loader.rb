class LevelLoader
  attr_reader :args, :level_number, :file_data, :level_data

  def initialize(args, level_number: 1)
    @level_number = level_number
    @args = args
    @file_data = args.gtk.read_file(level_path(level_number))
    @level_data = parse_file
  end

  private

  def level_path(level)
    "data/levels/level_#{level}.txt"
  end

  def parse_file
    types = file_data.split('---')
    types.shift

    types.reduce({}) do |acc, data|
      data_split = data.split
      type = data_split.shift
      level = data_split
      level_data = level.reverse.map { |row| row.chars }

      case type
      when "Tiles"
        acc[type] = level_data
      else
        acc[type] ||= []
        acc[type] << level_data
      end

      acc
    end
  end

  def serialize
    level_data || {}
  end
end