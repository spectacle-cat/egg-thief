class TrackLoop
  attr_reader :steps, :last_index, :top_speed
  attr_accessor :previous_step, :current_step, :next_step

  def initialize(steps)
    @steps = steps
    reindex!
    @top_speed = find_track_top_speed

    @current_step = steps[0]
    @previous_step = find_previous_step
    @next_step = find_next_step
    @last_index = steps.last[:index]
  end

  def update!(position)
    if on_track?(position)
      increment_step
    else
      # set_current_step(find_closest_step(position))
      raise "TODO: implement finding the closest step to get back on track"
    end
  end

  def find_track_top_speed
    add_distances_to_steps

    min(step_distances)
  end

  def on_track?
    distance_from_current_step =
      Vector.distance_between(position, current_step)
    distance_from_next_step =
      Vector.distance_between(position, next_step)
    distance_from_next_next_step =
      Vector.distance_between(position, current_step)
  end

  def increment_step
    previous_step = current_step
    current_step = next_step
    next_step = find_next_step
  end

  def find_next_step
    lookup_step_after(current_step)
  end

  def find_previous_step
    lookup_step_before(current_step)
  end

  def lookup_step_after(step)
    i = step[:index]
    if i == last_index
      steps[0]
    else
      steps[i + 1]
    end
  end

  def lookup_step_before(step)
    i = step[:index]
    if i == last_index
      steps[0]
    else
      steps[i - 1]
    end
  end

  # make the index zero based
  def reindex!
    index = 0
    steps.flatten.each do |step|
      step[:index] = index
      index += 1
    end
  end

  def add_distances_to_steps
    steps.each do |step|
      step[:distance_to_next_step] =
        Vector.distance_between(step, lookup_step_after(step))
    end
  end

  def step_distances
    steps.map { |step| step[:distance_to_next_step] }
  end
end