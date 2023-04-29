class LevelLoader
  attr_reader :args, :level_number, :file_data, :level_data

  def initialize(args, level_number: 1)
    @level_number = level_number
    @args = args
    @file_data = args.gtk.read_file(self.class.level_path(level_number))
    @level_data = parse_file
  end

  def self.level_path(level)
    "data/levels/level_#{level}.txt"
  end

  private

  def parse_file
    types = file_data.split('---')
    types.shift

    types.reduce({}) do |acc, data|
      data_split = data.split
      type = data_split.shift
      attribute_lines, level = data_split.partition { |line| line.include?(':') }

      level_data = {}
      level_data[:tiles] = level.reverse.map { |row| row.chars }

      attribute_lines.each do |line|
        key, value = line.split(":")

        level_data[key] = value
      end

      acc[type] ||= []
      acc[type] << level_data

      acc
    end
  end

  def serialize
    level_data || {}
  end
end