class LevelStats
  attr_accessor :args

  class LevelData
    attr_accessor :level, :time_taken, :eggs_collected

    def initialize(level:, time_taken: 0, eggs_collected: 0)
      @level = level
      @time_taken = time_taken
      @eggs_collected = eggs_collected
    end
  end

  def initialize(args)
    @args = args
    args.state.level_stats ||= {}
  end

  def current_level
    level(args.state.level)
  end

  def save_for_current_level
    args.state.ended_level_at = args.state.tick_count
    time_taken = TimeUtils.ticks_to_time_string(args.state.ended_level_at - args.state.started_level_at)

    args.state.level_stats[args.state.level] = LevelData.new(
      level: args.state.level,
      time_taken: time_taken,
      eggs_collected: args.state.empty_nests.count
    )
  end

  def level(level_number)
    args.state.level_stats[level_number] ||= LevelData.new(level: level_number)
  end
end