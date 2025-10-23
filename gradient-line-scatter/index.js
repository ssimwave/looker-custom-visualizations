looker.plugins.visualizations.add({
  // Visualization metadata
  id: "gradient_line_scatter",
  label: "Gradient Line/Scatter",
  
  // Configuration options
  options: {
    style: {
      type: "string",
      label: "Style",
      display: "select",
      values: [
        {"Line": "line"},
        {"Line And Dots": "line_with_dots"},
        {"Dots": "dots"}
      ],
      default: "line",
      section: "Plot",
      order: 1
    },
    plot_null_values: {
      type: "boolean",
      label: "Plot Null Values",
      default: false,
      section: "Plot",
      order: 2
    },
    color_min: {
      type: "string",
      label: "Minimum Color",
      display: "color",
      default: "#00ff00",
      section: "Plot",
      order: 3
    },
    color_mid: {
      type: "string",
      label: "Midpoint Color (Optional)",
      display: "color",
      default: "#ffff00",
      section: "Plot",
      order: 4
    },
    use_midpoint_color: {
      type: "boolean",
      label: "Use Midpoint Color",
      default: false,
      section: "Plot",
      order: 5
    },
    color_max: {
      type: "string",
      label: "Maximum Color",
      display: "color",
      default: "#ff0000",
      section: "Plot",
      order: 6
    },
    color_min_value: {
      type: "number",
      label: "Minimum Value",
      section: "Plot",
      order: 7
    },
    color_max_value: {
      type: "number",
      label: "Maximum Value",
      section: "Plot",
      order: 8
    },
    show_x_axis_name: {
      type: "boolean",
      label: "Show Axis Name",
      default: true,
      section: "X",
      order: 9
    },
    custom_x_axis_name: {
      type: "string",
      label: "Custom Axis Name",
      default: "",
      section: "X",
      order: 10
    },
    x_gridlines: {
      type: "boolean",
      label: "Gridlines",
      default: false,
      section: "X",
      order: 11
    },
    show_y_axis_name: {
      type: "boolean",
      label: "Show Axis Name",
      default: true,
      section: "Y",
      order: 12
    },
    custom_y_axis_name: {
      type: "string",
      label: "Custom Axis Name",
      default: "",
      section: "Y",
      order: 13
    },
    y_gridlines: {
      type: "boolean",
      label: "Gridlines",
      default: true,
      section: "Y",
      order: 14
    },
    unpin_axis_from_zero: {
      type: "boolean",
      label: "Unpin Axis From Zero",
      default: false,
      section: "Y",
      order: 15
    },
    y_min_value: {
      type: "number",
      label: "Minimum Value",
      section: "Y",
      order: 16
    },
    y_max_value: {
      type: "number",
      label: "Maximum Value",
      section: "Y",
      order: 17
    }
  },

  // Helper function to get field label (handles table calculations)
  getFieldLabel: function(field) {
    return field.label_short || field.label || field.name || 'Untitled';
  },

  // Create the visualization
  create: function(element, config) {
    // Create container
    this.container = d3.select(element)
      .style("font-family", "Roboto, 'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK KR', 'Noto Sans Arabic UI', 'Noto Sans Devanagari UI', 'Noto Sans Hebrew', 'Noto Sans Thai UI', Helvetica, Arial, sans-serif")
      .style("font-size", "12px")
      .style("color", "#262D33")
      .style("background-color", "white");

    // Store element reference for resize handling
    this.element = element;
    
    // Set up ResizeObserver for responsive behavior
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        // Debounce resize events to avoid too many redraws
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
          if (this.lastData && this.lastConfig && this.lastQueryResponse) {
            // Re-render with stored data
            this.updateVisualization(this.lastData, this.lastConfig, this.lastQueryResponse);
          }
        }, 100);
      });
      
      this.resizeObserver.observe(element);
    }
  },

  // Internal method to handle the actual visualization update
  updateVisualization: function(data, config, queryResponse) {
    try {
      // Clear previous content
      this.container.selectAll("*").remove();

      // Validate data structure
      const validation = this.validateData(data, queryResponse);
      if (!validation.isValid) {
        this.showError(validation.message);
        return;
      }

      // Extract and process data
      const processedData = this.processData(data, queryResponse, config);
      if (processedData.length === 0) {
        this.showMessage("No data to display");
        return;
      }

      // Set up dimensions and scales
      const dimensions = this.setupDimensions(this.element);
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
      this.drawColorLegend(svg, scales.color, dimensions, config, queryResponse);

      // Add tooltip
      this.addTooltip(svg, processedData, scales, config, queryResponse);

    } catch (error) {
      console.error("Error in updateVisualization:", error);
      this.showError("An error occurred while rendering the visualization");
    }
  },

  // Update the visualization
  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      // Store data for resize handling
      this.lastData = data;
      this.lastConfig = config;
      this.lastQueryResponse = queryResponse;

      // Perform the visualization update
      this.updateVisualization(data, config, queryResponse);

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
        if (config.plot_null_values) {
          yValue = 0;
        } else {
          return; // Skip this point
        }
      }

      if (colorValue === null) {
        if (config.plot_null_values) {
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
    const margin = { top: 7, right: 60, bottom: 23, left: 55 };
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
    if (config.y_min_value !== null && config.y_min_value !== undefined && 
        config.y_max_value !== null && config.y_max_value !== undefined) {
      yDomain = [config.y_min_value, config.y_max_value];
    } else {
      const yExtent = d3.extent(data, d => d.y);
      if (config.unpin_axis_from_zero) {
        yDomain = yExtent;
      } else {
        yDomain = [0, yExtent[1]];
      }
      
      // Apply manual min/max if specified
      if (config.y_min_value !== null && config.y_min_value !== undefined) {
        yDomain[0] = config.y_min_value;
      }
      if (config.y_max_value !== null && config.y_max_value !== undefined) {
        yDomain[1] = config.y_max_value;
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
    if (config.color_min_value !== null && config.color_min_value !== undefined) {
      colorDomain[0] = config.color_min_value;
    }
    if (config.color_max_value !== null && config.color_max_value !== undefined) {
      colorDomain[1] = config.color_max_value;
    }

    const colorMin = config.color_min || "#00ff00";
    const colorMid = config.color_mid || "#ffff00";
    const colorMax = config.color_max || "#ff0000";

    if (config.use_midpoint_color && colorMid && colorMid.trim() !== "") {
      const midpoint = (colorDomain[0] + colorDomain[1]) / 2;
      colorScale = d3.scaleLinear()
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
    // Vertical gridlines (X) - lighter and more subtle
    if (config.x_gridlines) {
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
        .attr("stroke", "#e6e6e6")
        .attr("stroke-width", 1);
    }

    // Horizontal gridlines (Y) - match Looker's style
    if (config.y_gridlines) {
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
        .attr("stroke", "#e6e6e6")
        .attr("stroke-width", 1);
    }
  },

  // Draw axes
  drawAxes: function(svg, scales, dimensions, config, queryResponse) {
    // X axis
    const xAxis = d3.axisBottom(scales.x)
      .tickSize(0)  // No tick marks
      .tickPadding(8);
    
    const xAxisGroup = svg.append("g")
      .attr("transform", `translate(0,${dimensions.height})`)
      .call(xAxis);
    
    // Style X axis to match Looker - keep the domain line
    xAxisGroup.select(".domain")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1);
    
    // Remove tick lines (they're already set to 0 size)
    xAxisGroup.selectAll(".tick line").remove();
    
    xAxisGroup.selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#262D33")
      .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif");

    // X axis label
    if (config.show_x_axis_name) {
      const xLabel = (config.custom_x_axis_name && config.custom_x_axis_name.trim() !== "") 
        ? config.custom_x_axis_name 
        : this.getFieldLabel(queryResponse.fields.dimension_like[0]);
      
      svg.append("text")
        .attr("transform", `translate(${dimensions.width / 2}, ${dimensions.height + 35})`)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#262D33")
        .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif")
        .text(xLabel);
    }

    // Y axis
    const yAxis = d3.axisLeft(scales.y)
      .tickSize(0)  // No tick marks
      .tickPadding(8);
    
    const yAxisGroup = svg.append("g")
      .call(yAxis);
    
    // Style Y axis to match Looker - REMOVE the domain line entirely
    yAxisGroup.select(".domain").remove();
    
    // Remove tick lines (they're already set to 0 size)
    yAxisGroup.selectAll(".tick line").remove();
    
    yAxisGroup.selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#262D33")
      .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif");

    // Y axis label
    if (config.show_y_axis_name) {
      const yLabel = (config.custom_y_axis_name && config.custom_y_axis_name.trim() !== "") 
        ? config.custom_y_axis_name 
        : this.getFieldLabel(queryResponse.fields.measure_like[0]);
      
      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -41)
        .attr("x", -(dimensions.height / 2))
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#262D33")
        .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif")
        .text(yLabel);
    }
  },

  // Draw the main plot
  drawPlot: function(svg, data, scales, config) {
    const plotStyle = config.style || "line";

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
      
      // Get colors for each point
      const color1 = scales.color(d1.c);
      const color2 = scales.color(d2.c);
      
      // Average color for the segment using d3.interpolateRgb
      const colorInterpolator = d3.interpolateRgb(color1, color2);
      const avgColor = colorInterpolator(0.5);
      
      svg.append("path")
        .datum([d1, d2])
        .attr("fill", "none")
        .attr("stroke", avgColor)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
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
      .attr("r", 5)
      .attr("fill", d => scales.color(d.c))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);
  },

  // Draw color legend
  drawColorLegend: function(svg, colorScale, dimensions, config, queryResponse) {
    const legendWidth = 15;
    const legendHeight = 150;
    const legendX = dimensions.width + 25;
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
      .style("stroke", "#ddd")
      .style("stroke-width", 1);

    // Add legend scale
    const legendScale = d3.scaleLinear()
      .domain(domain)
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickSize(4)
      .tickPadding(6);

    const legendAxisGroup = svg.append("g")
      .attr("transform", `translate(${legendX + legendWidth}, ${legendY})`)
      .call(legendAxis);

    // Style legend axis to match Looker
    legendAxisGroup.select(".domain")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1);
    
    legendAxisGroup.selectAll(".tick line")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1);
    
    legendAxisGroup.selectAll("text")
      .style("font-size", "10px")
      .style("fill", "#262D33")
      .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif");

    // Add legend label if using a second measure for color
    if (queryResponse.fields.measure_like.length > 1) {
      const colorLabel = this.getFieldLabel(queryResponse.fields.measure_like[1]);
      
      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", legendX + legendWidth + 55)
        .attr("x", -(legendY + legendHeight / 2))
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#262D33")
        .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif")
        .text(colorLabel);
    }
  },

  // Add tooltip functionality
  addTooltip: function(svg, data, scales, config, queryResponse) {
    // Create tooltip div with Looker-style formatting
    const tooltip = d3.select("body").append("div")
      .attr("class", "gradient-line-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "#262d33")
      .style("color", "white")
      .style("padding", "8px 10px")
      .style("border-radius", "3px")
      .style("font-family", "Roboto, 'Noto Sans', Helvetica, Arial, sans-serif")
      .style("font-size", "12px")
      .style("line-height", "1.4")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("white-space", "nowrap");

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
      .on("mouseover", (event, d) => {
        const dimensionLabel = this.getFieldLabel(queryResponse.fields.dimension_like[0]);
        const firstMeasureLabel = this.getFieldLabel(queryResponse.fields.measure_like[0]);
        const secondMeasureLabel = queryResponse.fields.measure_like[1] ? this.getFieldLabel(queryResponse.fields.measure_like[1]) : null;

        // Format values nicely
        const formatX = typeof d.originalX === 'string' ? d.originalX : 
                       d.originalX instanceof Date ? d.originalX.toLocaleDateString() : 
                       d.originalX.toLocaleString();
        
        const formatY = typeof d.originalY === 'number' ? d.originalY.toLocaleString() : d.originalY;
        const formatC = typeof d.originalC === 'number' ? d.originalC.toLocaleString() : d.originalC;

        // Build tooltip content with proper structure
        let tooltipContent = `<div style="font-weight: 500; margin-bottom: 4px;">${dimensionLabel}</div>`;
        tooltipContent += `<div style="margin-bottom: 2px; font-weight: bold;">${formatX}</div>`;
        tooltipContent += `<div style="font-weight: 500; margin-bottom: 4px; margin-top: 8px;">${firstMeasureLabel}</div>`;
        tooltipContent += `<div style="margin-bottom: 2px; font-weight: bold;">${formatY}</div>`;
        
        if (secondMeasureLabel) {
          tooltipContent += `<div style="font-weight: 500; margin-bottom: 4px; margin-top: 8px;">${secondMeasureLabel}</div>`;
          tooltipContent += `<div style="font-weight: bold;">${formatC}</div>`;
        }

        tooltip.transition()
          .duration(150)
          .style("opacity", .95);
        
        tooltip.html(tooltipContent)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function(d) {
        tooltip.transition()
          .duration(300)
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
  },

  // Cleanup method for proper disposal
  destroy: function() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    
    // Clean up stored data
    this.lastData = null;
    this.lastConfig = null;
    this.lastQueryResponse = null;
  }
});