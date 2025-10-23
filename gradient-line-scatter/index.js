looker.plugins.visualizations.add({
  // Visualization metadata
  id: "gradient_line_scatter",
  label: "Gradient Line/Scatter",
  
  // Configuration options
  options: {
    plot: {
      type: "object",
      label: "Plot",
      display: "section",
      properties: {
        style: {
          type: "string",
          label: "Style",
          display: "select",
          values: [
            {"Line": "line"},
            {"Line And Dots": "line_with_dots"},
            {"Dots": "dots"}
          ],
          default: "line"
        },
        plot_null_values: {
          type: "boolean",
          label: "Plot Null Values",
          default: false
        },
        color_min: {
          type: "string",
          label: "Minimum Color",
          display: "color",
          default: "#00ff00"
        },
        color_mid: {
          type: "string",
          label: "Midpoint Color (Optional)",
          display: "color",
          default: "#ffff00"
        },
        color_max: {
          type: "string",
          label: "Maximum Color",
          display: "color",
          default: "#ff0000"
        },
        min_value: {
          type: "number",
          label: "Minimum Value",
          default: null
        },
        max_value: {
          type: "number",
          label: "Maximum Value",
          default: null
        }
      }
    },
    x_axis: {
      type: "object",
      label: "X",
      display: "section",
      properties: {
        show_axis_name: {
          type: "boolean",
          label: "Show Axis Name",
          default: true
        },
        custom_axis_name: {
          type: "string",
          label: "Custom Axis Name",
          default: ""
        },
        gridlines: {
          type: "boolean",
          label: "Gridlines",
          default: false
        }
      }
    },
    y_axis: {
      type: "object",
      label: "Y",
      display: "section",
      properties: {
        show_axis_name: {
          type: "boolean",
          label: "Show Axis Name",
          default: true
        },
        custom_axis_name: {
          type: "string",
          label: "Custom Axis Name",
          default: ""
        },
        gridlines: {
          type: "boolean",
          label: "Gridlines",
          default: true
        },
        unpin_axis_from_zero: {
          type: "boolean",
          label: "Unpin Axis From Zero",
          default: false
        },
        min_value: {
          type: "number",
          label: "Minimum Value",
          default: null
        },
        max_value: {
          type: "number",
          label: "Maximum Value",
          default: null
        }
      }
    }
  },

  // Create the visualization
  create: function(element, config) {
    // Create container
    this.container = d3.select(element)
      .style("font-family", "Roboto, 'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK KR', 'Noto Sans Arabic UI', 'Noto Sans Devanagari UI', 'Noto Sans Hebrew', 'Noto Sans Thai UI', Helvetica, Arial, sans-serif")
      .style("font-size", "12px")
      .style("color", "#262D33")
      .style("background-color", "white");
  },

  // Update the visualization
  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      // Clear previous content
      this.container.selectAll("*").remove();

      // Validate data structure
      const validation = this.validateData(data, queryResponse);
      if (!validation.isValid) {
        this.showError(validation.message);
        done();
        return;
      }

      // Extract and process data
      const processedData = this.processData(data, queryResponse, config);
      if (processedData.length === 0) {
        this.showMessage("No data to display");
        done();
        return;
      }

      // Set up dimensions and scales
      const dimensions = this.setupDimensions(element);
      const scales = this.setupScales(processedData, dimensions, config);

      // Create SVG
      const svg = this.createSVG(dimensions);

      // Draw gridlines if enabled
      this.drawGridlines(svg, scales, dimensions, config);

      // Draw axes
      this.drawAxes(svg, scales, dimensions, config, queryResponse);

      // Draw the plot
      this.drawPlot(svg, processedData, scales, config);

      // Draw color legend
      this.drawColorLegend(svg, scales.color, dimensions, config);

      // Add tooltip
      this.addTooltip(svg, processedData, scales, config, queryResponse);

      done();
    } catch (error) {
      console.error("Error in updateAsync:", error);
      this.showError("An error occurred while rendering the visualization");
      done();
    }
  },

  // Validate data structure
  validateData: function(data, queryResponse) {
    const dimensions = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;
    const pivots = queryResponse.fields.pivots;

    // Check for pivots
    if (pivots && pivots.length > 0) {
      return {
        isValid: false,
        message: "This visualization does not support pivoted data"
      };
    }

    // Check dimensions
    if (dimensions.length !== 1) {
      return {
        isValid: false,
        message: "This visualization requires exactly one dimension"
      };
    }

    // Check measures
    if (measures.length < 1 || measures.length > 2) {
      return {
        isValid: false,
        message: "This visualization requires one or two measures"
      };
    }

    return { isValid: true };
  },

  // Process raw data into visualization format
  processData: function(data, queryResponse, config) {
    const dimensionName = queryResponse.fields.dimension_like[0].name;
    const firstMeasureName = queryResponse.fields.measure_like[0].name;
    const secondMeasureName = queryResponse.fields.measure_like[1]?.name;

    const processedData = [];

    data.forEach(row => {
      let xValue = row[dimensionName].value;
      let yValue = row[firstMeasureName].value;
      let colorValue = secondMeasureName ? row[secondMeasureName].value : yValue;

      // Handle null values
      if (yValue === null) {
        if (config.plot && config.plot.plot_null_values) {
          yValue = 0;
        } else {
          return; // Skip this point
        }
      }

      if (colorValue === null) {
        if (config.plot && config.plot.plot_null_values) {
          colorValue = 0;
        } else {
          return; // Skip this point
        }
      }

      // Try to parse x value as date, then number, fall back to string
      let parsedX = xValue;
      const dateValue = new Date(xValue);
      if (!isNaN(dateValue.getTime()) && typeof xValue === 'string' && xValue.match(/\d{4}-\d{2}-\d{2}/)) {
        parsedX = dateValue;
      } else if (!isNaN(parseFloat(xValue))) {
        parsedX = parseFloat(xValue);
      }

      processedData.push({
        x: parsedX,
        y: parseFloat(yValue),
        c: parseFloat(colorValue),
        originalX: xValue,
        originalY: yValue,
        originalC: colorValue
      });
    });

    return processedData;
  },

  // Setup chart dimensions
  setupDimensions: function(element) {
    const margin = { top: 20, right: 120, bottom: 60, left: 60 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    return { margin, width, height };
  },

  // Setup scales
  setupScales: function(data, dimensions, config) {
    // Determine x scale type
    let xScale;
    const firstX = data[0]?.x;
    
    if (firstX instanceof Date) {
      xScale = d3.scaleUtc()
        .domain(d3.extent(data, d => d.x))
        .range([0, dimensions.width]);
    } else if (typeof firstX === 'number') {
      xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, dimensions.width]);
    } else {
      xScale = d3.scalePoint()
        .domain(data.map(d => d.x))
        .range([0, dimensions.width])
        .padding(0.1);
    }

    // Y scale
    let yDomain;
    if (config.y_axis && config.y_axis.min_value !== null && config.y_axis.max_value !== null) {
      yDomain = [config.y_axis.min_value, config.y_axis.max_value];
    } else {
      const yExtent = d3.extent(data, d => d.y);
      if (config.y_axis && config.y_axis.unpin_axis_from_zero) {
        yDomain = yExtent;
      } else {
        yDomain = [0, yExtent[1]];
      }
      
      // Apply manual min/max if specified
      if (config.y_axis && config.y_axis.min_value !== null) {
        yDomain[0] = config.y_axis.min_value;
      }
      if (config.y_axis && config.y_axis.max_value !== null) {
        yDomain[1] = config.y_axis.max_value;
      }
    }

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([dimensions.height, 0]);

    // Color scale
    let colorScale;
    const colorExtent = d3.extent(data, d => d.c);
    let colorDomain = colorExtent;
    
    // Apply manual color min/max if specified
    if (config.plot && config.plot.min_value !== null) {
      colorDomain[0] = config.plot.min_value;
    }
    if (config.plot && config.plot.max_value !== null) {
      colorDomain[1] = config.plot.max_value;
    }

    const colorMin = (config.plot && config.plot.color_min) || "#00ff00";
    const colorMid = (config.plot && config.plot.color_mid) || "#ffff00";
    const colorMax = (config.plot && config.plot.color_max) || "#ff0000";

    if (colorMid && colorMid.trim() !== "") {
      const midpoint = (colorDomain[0] + colorDomain[1]) / 2;
      colorScale = d3.scaleDiverging()
        .domain([colorDomain[0], midpoint, colorDomain[1]])
        .range([colorMin, colorMid, colorMax]);
    } else {
      colorScale = d3.scaleLinear()
        .domain(colorDomain)
        .range([colorMin, colorMax]);
    }

    return { x: xScale, y: yScale, color: colorScale };
  },

  // Create SVG element
  createSVG: function(dimensions) {
    const svg = this.container
      .append("svg")
      .attr("width", dimensions.width + dimensions.margin.left + dimensions.margin.right)
      .attr("height", dimensions.height + dimensions.margin.top + dimensions.margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${dimensions.margin.left},${dimensions.margin.top})`);

    return g;
  },

  // Draw gridlines
  drawGridlines: function(svg, scales, dimensions, config) {
    // Vertical gridlines (X)
    if (config.x_axis && config.x_axis.gridlines) {
      svg.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(scales.x.ticks ? scales.x.ticks() : scales.x.domain())
        .enter()
        .append("line")
        .attr("x1", d => scales.x(d))
        .attr("x2", d => scales.x(d))
        .attr("y1", 0)
        .attr("y2", dimensions.height)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1);
    }

    // Horizontal gridlines (Y)
    if (config.y_axis && config.y_axis.gridlines) {
      svg.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(scales.y.ticks())
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", dimensions.width)
        .attr("y1", d => scales.y(d))
        .attr("y2", d => scales.y(d))
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1);
    }
  },

  // Draw axes
  drawAxes: function(svg, scales, dimensions, config, queryResponse) {
    // X axis
    const xAxis = d3.axisBottom(scales.x);
    svg.append("g")
      .attr("transform", `translate(0,${dimensions.height})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#262D33");

    // X axis label
    if (config.x_axis && config.x_axis.show_axis_name) {
      const xLabel = (config.x_axis.custom_axis_name && config.x_axis.custom_axis_name.trim() !== "") 
        ? config.x_axis.custom_axis_name 
        : queryResponse.fields.dimension_like[0].label_short;
      
      svg.append("text")
        .attr("transform", `translate(${dimensions.width / 2}, ${dimensions.height + 40})`)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#262D33")
        .text(xLabel);
    }

    // Y axis
    const yAxis = d3.axisLeft(scales.y);
    svg.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#262D33");

    // Y axis label
    if (config.y_axis && config.y_axis.show_axis_name) {
      const yLabel = (config.y_axis.custom_axis_name && config.y_axis.custom_axis_name.trim() !== "") 
        ? config.y_axis.custom_axis_name 
        : queryResponse.fields.measure_like[0].label_short;
      
      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - 40)
        .attr("x", 0 - (dimensions.height / 2))
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#262D33")
        .text(yLabel);
    }
  },

  // Draw the main plot
  drawPlot: function(svg, data, scales, config) {
    const plotStyle = (config.plot && config.plot.style) || "line";

    // Draw line if needed
    if (plotStyle === "line" || plotStyle === "line_with_dots") {
      this.drawLine(svg, data, scales);
    }

    // Draw dots if needed
    if (plotStyle === "dots" || plotStyle === "line_with_dots") {
      this.drawDots(svg, data, scales);
    }
  },

  // Draw line with gradient segments
  drawLine: function(svg, data, scales) {
    const line = d3.line()
      .x(d => scales.x(d.x))
      .y(d => scales.y(d.y))
      .curve(d3.curveLinear);

    // Create line segments with individual colors
    for (let i = 0; i < data.length - 1; i++) {
      const d1 = data[i];
      const d2 = data[i + 1];
      
      // Average color for the segment
      const avgColor = d3.interpolate(scales.color(d1.c), scales.color(d2.c))(0.5);
      
      svg.append("path")
        .datum([d1, d2])
        .attr("fill", "none")
        .attr("stroke", avgColor)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("d", line);
    }
  },

  // Draw dots
  drawDots: function(svg, data, scales) {
    svg.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => scales.x(d.x))
      .attr("cy", d => scales.y(d.y))
      .attr("r", 4)
      .attr("fill", d => scales.color(d.c))
      .attr("stroke", "white")
      .attr("stroke-width", 1);
  },

  // Draw color legend
  drawColorLegend: function(svg, colorScale, dimensions, config) {
    const legendWidth = 20;
    const legendHeight = 200;
    const legendX = dimensions.width + 20;
    const legendY = (dimensions.height - legendHeight) / 2;

    // Create gradient definition
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "color-gradient")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    // Add gradient stops
    const domain = colorScale.domain();
    const numStops = 10;
    
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      const value = domain[0] + t * (domain[domain.length - 1] - domain[0]);
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(value));
    }

    // Draw legend rectangle
    svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#color-gradient)")
      .style("stroke", "#ccc")
      .style("stroke-width", 1);

    // Add legend scale
    const legendScale = d3.scaleLinear()
      .domain(domain)
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5);

    svg.append("g")
      .attr("transform", `translate(${legendX + legendWidth}, ${legendY})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "10px")
      .style("fill", "#262D33");
  },

  // Add tooltip functionality
  addTooltip: function(svg, data, scales, config, queryResponse) {
    // Create tooltip div
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Add invisible circles for tooltip interaction
    svg.selectAll(".tooltip-target")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "tooltip-target")
      .attr("cx", d => scales.x(d.x))
      .attr("cy", d => scales.y(d.y))
      .attr("r", 8)
      .attr("fill", "transparent")
      .on("mouseover", function(event, d) {
        const dimensionLabel = queryResponse.fields.dimension_like[0].label_short;
        const firstMeasureLabel = queryResponse.fields.measure_like[0].label_short;
        const secondMeasureLabel = queryResponse.fields.measure_like[1]?.label_short;

        let tooltipText = `${dimensionLabel}: ${d.originalX}<br>${firstMeasureLabel}: ${d.originalY}`;
        
        if (secondMeasureLabel) {
          tooltipText += `<br>${secondMeasureLabel}: ${d.originalC}`;
        }

        tooltip.transition()
          .duration(200)
          .style("opacity", .9);
        
        tooltip.html(tooltipText)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function(d) {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });
  },

  // Show error message
  showError: function(message) {
    this.container
      .append("div")
      .style("text-align", "center")
      .style("padding", "50px")
      .style("color", "#ff0000")
      .text(message);
  },

  // Show info message
  showMessage: function(message) {
    this.container
      .append("div")
      .style("text-align", "center")
      .style("padding", "50px")
      .style("color", "#666666")
      .text(message);
  }
});