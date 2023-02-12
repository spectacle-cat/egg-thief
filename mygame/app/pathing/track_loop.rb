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
  end

  def update!(position)
    # if on_track?(position)
    #   puts "increment step"
    #   puts "next step: #{next_step[:index]}"
      increment_step
    #   puts "new next step: #{next_step[:index]}"
    # else
    #   # set_current_step(find_closest_step(position))
    #   raise "TODO: implement finding the closest step to get back on track"
    # end
  end

  def find_track_top_speed
    add_distances_to_steps

    step_distances.min
  end

  def on_track?(position)
    distance_from_current_step =
      Vector.distance_between(position, current_step)
    distance_from_next_step =
      Vector.distance_between(position, next_step)
    distance_from_next_next_step =
      Vector.distance_between(position, current_step)

    distance_from_next_step < distance_from_current_step &&
      distance_from_next_step < distance_from_next_next_step
  end

  def increment_step
    self.previous_step = current_step
    self.current_step = next_step
    self.next_step = find_next_step
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

    @last_index = index - 1
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

  def show_debug(args)
    steps.each do |step|
      stepb = lookup_step_after(step)
      args.outputs.debug <<
      if step[:corner_angle] == true
        [step[:x], step[:y], stepb[:x], stepb[:y], 0, 150, 250].line
      else
        [step[:x], step[:y], stepb[:x], stepb[:y], 200, 200, 0].line
      end
    end
    args.outputs.debug << [
      current_step[:x], current_step[:y],
      next_step[:x], next_step[:y], 0, 200, 0
    ].line
  end
end