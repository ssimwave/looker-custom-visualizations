Create a Looker Custom Visualization named “Gradient Line/Scatter” (one file: index.js) for Looker (the BI Tool, NOT Looker Studio).

It should display a line and/or scatter plot where the color of each point or line segment is determined by a numeric value, using a configurable gradient.

The visualization supports the following data cases:

- One dimension and one measure: the dimension is used for the x-axis value, the measure is used for the y-axis value and to determine the color of the line/dot
- One dimension and two measures: the dimension is used for the x-axis value, the first measure is used for the y-axis value and the second measure is used determine the color of the line/dot

Other cases (e.g. no measures, or 3 measures) result in an error message stating that the current data is not supporting and stating the data requirements.

No pivots supported — if any pivots exist, display a message that this visualization does not support pivoted data and stop rendering.

Configurable options:
- Section "Plot"
    - Option "Style" - choice of "Line", "Line And Dots", "Dots", default Line
    - Option "Plot Null Values" - toggle on/off. If on, null values are plotted as 0, if off, null values result in gaps in the graph, default off. Not allowed to be blank.
    - Option "Minimum Color" - the HTML color code for the minimum value, default green
    - Option "Midpoint Color (Optional)" - the HTML color code for the midpoint value, default yellow. Allowed to be blank in which case it is not used (gradient is between min and max colors. 
    - Option "Maximum Color" - The HTML color code for the maximum value
    - Option "Minimum Value" - Integer, blank by default. If blank, the minimum value is determined automatially from the data. If specified, the value (and all values below) is used to establish the value at which the minimum color is used.
    - Option "Maximum Value" - Integer, blank by default. If blank, the maximum value is determined automatially from the data. If specified, the value (and all values above) is used to establish the value at which the maximum color is used.
- Section "X"
    - Option "Show Axis Name" - toggle on/off. If on, the name of the dimension is shown below the x axis, if off, it is not shown. Default on.
    - Option "Custom Axis Name" - text input. If blank, the dimension name is used to label the x axis. If not blank, the value that is entered is used to label the x axis. Default blank.
    - Option "Gridlines" - toggle on/off. If on, vertical gridlines are shown on the graph, if off they are not. Default off.
- Section "Y"
    - Option "Show Axis Name" - toggle on/off. If on, the name of the dimension is shown to the left of the y axis, if off, it is not shown. Default on.
    - Option "Custom Axis Name" - text input. If blank, the measure name is used to label the x axis. If not blank, the value that is entered is used to label the y axis. Default blank.
    - Option "Gridlines" - toggle on/off. If on, horizontal gridlines are shown on the graph, if off they are not. Default on.
    - Option "Unpin Axis From Zero" - toggle on/off. If off, the y-axis is always pinned to zero and the upper range is determined automatically (unless explicitly configured). If on, botht the min and the max values of the y-axis are determined automatically (unless explicitly configured). Default off.
    - Option "Minimum Value" - integer. If not set (blank value), the minimum value of the y-axis is pinned to zero or determined automatically, depending on the setting of "Unpin Axis From Zero". If set, this is the minimum value of the y-axis.
    - Option "Maximum Value" - integer. If not set, the maximum value of the y-axis is determined automatically. If set, this is the maximum value of the y-axis. 

The style of the graph should match the built-in Looker line chart as much as possible.
- Font size: 12
- Font family: Roboto, 'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK KR', 'Noto Sans Arabic UI', 'Noto Sans Devanagari UI', 'Noto Sans Hebrew', 'Noto Sans Thai UI', Helvetica, Arial, sans-serif
- Text color: #262D33
- White background

🧩 index.js

Register via looker.plugins.visualizations.add.

Data extraction logic:
- Validate: exactly one dimension, at least one measure, no more than two measures, no pivots.
- Extract dimension values → x.
- Extract first measure → y.
- Extract second measure (if present) → colorValue.
- If absent, use y as colorValue.
- Build an array of {x, y, c} points.
- Parse x as date if config.x_is_time = true, else try numeric; fall back to string (ordinal) if parsing fails.

Scales:
- x: use d3.scaleUtc() if x_is_time; d3.scaleLinear() if numeric; d3.scalePoint() if categorical.
- y: d3.scaleLinear().

Color Scale:
- Use min/max (and optional midpoint) of c from data to define color range.
- If color_mid is provided → d3.scaleDiverging() domain [min, (min+max)/2, max].
- Else → d3.scaleLinear() domain [min, max].
If min/max values are explicitly configured, use t_low / t_high (and optional midpoint) for domain.

Rendering Logic:
- Create SVG inside container; clear previous content on each update.
- Add margins and responsive layout.

Plot based on plot_style:
- "dots" → draw one circle per point (fill = colorScale(c), radius = point_radius).
- "line" → connect consecutive points with small colored line segments; each segment color is average of the two endpoint colors.
- "line_with_dots" → draw both lines and points.

Draw axes (x bottom, y left) and light gridlines if enabled.

Add tooltip on hover showing x and y (and 3rd metric if it exists) values.

Draw vertical colorbar legend, place it to the right of the chart (not on top of it)

Behavior:
- Redraw on any config or size change.
- Gracefully handle missing data (display “No data to display”).
- Ensure color scale and legend always reflect actual domain and configuration.

Appearance:
- Round line caps; subtle transitions; avoid excessive animation.

✅ Acceptance Criteria

1 dimension + 1 measure → color = y-value.

1 dimension + 2 measures → color = second measure.

Gradient adapts automatically when min/max values are not configured.

When min/max values are configured, mode obeys t_low / t_high.

Works with line, line-with-dots, and dots modes.

No support for pivots — displays clear message if encountered.

Colorbar accurately represents gradient range.