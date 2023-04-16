module TimeUtils
  extend self

  def ticks_to_time_string(ticks)
    total_seconds = ticks / 60
    minutes = total_seconds / 60
    seconds = total_seconds % 60
    format('%02d:%02d', minutes, seconds)
  end
end