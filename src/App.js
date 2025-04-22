import React, { Component } from 'react';
import './App.css';
import * as d3 from 'd3';
import FileUpload from './FileUpload';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null,
      isDataLoaded: false
    };
    
    // Create refs
    this.chartRef = React.createRef();
    this.tooltip = null;
    
    // Constants for the visualization - reversed order for legend
    this.MODELS = ["LLaMA-3.1", "Claude", "PaLM-2", "Gemini", "GPT-4"];
    this.MODEL_COLORS = {
      "GPT-4": "#e41a1c",
      "Gemini": "#377eb8",
      "PaLM-2": "#4daf4a",
      "Claude": "#984ea3",
      "LLaMA-3.1": "#ff7f00"
    };
    
    // Dimensions for the visualization - reduced width
    this.DIMENSIONS = {
      width: 700,
      height: 400,
      margin: { top: 30, right: 120, bottom: 40, left: 40 }
    };
    
    // Month names for formatting dates
    this.MONTH_NAMES = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    
    // Bind methods
    this.setData = this.setData.bind(this);
    this.createVisualization = this.createVisualization.bind(this);
    this.createLegend = this.createLegend.bind(this);
    this.createTooltipContent = this.createTooltipContent.bind(this);
    this.handleStreamMouseOver = this.handleStreamMouseOver.bind(this);
    this.handleStreamMouseMove = this.handleStreamMouseMove.bind(this);
    this.handleStreamMouseLeave = this.handleStreamMouseLeave.bind(this);
    this.formatDate = this.formatDate.bind(this);
  }
  
  componentDidMount() {
    // Create tooltip element
    this.tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background-color", "white")
      .style("border", "1px solid gray")
      .style("border-radius", "5px")
      .style("padding", "10px")
      .style("box-shadow", "0 2px 5px rgba(0, 0, 0, 0.2)");
  }
  
  componentDidUpdate(prevProps, prevState) {
    // Create visualization when data is loaded
    if (this.state.data && !prevState.data) {
      this.createVisualization();
    }
  }
  
  componentWillUnmount() {
    // Clean up the tooltip when component unmounts
    if (this.tooltip) {
      this.tooltip.remove();
    }
  }
  
  // Convert date format from "M/D/YY" to "Month" (e.g., "1/15/24" to "Jan")
  formatDate(dateStr) {
    const dateParts = dateStr.split('/');
    if (dateParts.length >= 2) {
      const monthIndex = parseInt(dateParts[0], 10) - 1; // Months are 0-indexed in JS
      if (monthIndex >= 0 && monthIndex < 12) {
        return this.MONTH_NAMES[monthIndex];
      }
    }
    return dateStr; // Return original if parsing fails
  }
  
  // Method to receive data from FileUpload component
  setData(csvData) {
    if (!csvData || csvData.length === 0) {
      alert("No valid data found in the CSV file.");
      return;
    }
    
    // Process the data for our visualization needs
    const processedData = csvData.map(d => {
      // We assume the CSV has Date, GPT-4, Gemini, PaLM-2, Claude, LLaMA-3.1 columns
      return {
        // Store both original date and formatted date
        originalDate: d.Date,
        Date: this.formatDate(d.Date),
        "GPT-4": +d["GPT-4"] || 0,
        "Gemini": +d["Gemini"] || 0,
        "PaLM-2": +d["PaLM-2"] || 0,
        "Claude": +d["Claude"] || 0,
        "LLaMA-3.1": +d["LLaMA-3.1"] || 0
      };
    });
    
    // Update state with processed data
    this.setState({
      data: processedData,
      isDataLoaded: true
    });
  }
  
  createVisualization() {
    const { data } = this.state;
    if (!data) return;
    
    // Calculate inner dimensions
    const innerWidth = this.DIMENSIONS.width - this.DIMENSIONS.margin.left - this.DIMENSIONS.margin.right;
    const innerHeight = this.DIMENSIONS.height - this.DIMENSIONS.margin.top - this.DIMENSIONS.margin.bottom;
    
    // Clear previous chart
    d3.select(this.chartRef.current).selectAll("*").remove();
    
    // Create SVG container
    const svg = d3.select(this.chartRef.current)
      .append("svg")
      .attr("width", this.DIMENSIONS.width)
      .attr("height", this.DIMENSIONS.height);
    
    // Create chart group
    const chart = svg.append("g")
      .attr("transform", `translate(${this.DIMENSIONS.margin.left}, ${this.DIMENSIONS.margin.top})`);
    
    // Create x scale for dates - use the formatted dates for display
    const x = d3.scalePoint()
      .domain(data.map(d => d.Date))
      .range([0, innerWidth]);
    
    // For stacking, we need to use the original model order (not reversed)
    const stackKeys = ["GPT-4", "Gemini", "PaLM-2", "Claude", "LLaMA-3.1"];
    
    // Create stack generator for the streamgraph
    const stack = d3.stack()
      .keys(stackKeys)
      .offset(d3.stackOffsetWiggle);  // Create streamgraph effect
    
    const stackedData = stack(data);
    
    // Calculate y domain with increased padding to match the reference image
    const yExtent = [
      d3.min(stackedData, layer => d3.min(layer, d => d[0])),
      d3.max(stackedData, layer => d3.max(layer, d => d[1]))
    ];
    
    // Add 30% padding to top and bottom
    const yPadding = (yExtent[1] - yExtent[0]) * 0.3;
    
    // Calculate y domain
    const y = d3.scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([innerHeight, 0]);
    
    // Create area generator for the streams
    const area = d3.area()
      .x((d, i) => x(d.data.Date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);  // Smooth curve
    
    // Draw stream areas
    chart.selectAll(".stream")
      .data(stackedData)
      .enter()
      .append("path")
      .attr("class", "stream")
      .attr("d", area)
      .attr("fill", d => this.MODEL_COLORS[d.key])
      .attr("opacity", 0.8)
      .on("mouseover", this.handleStreamMouseOver)
      .on("mousemove", this.handleStreamMouseMove)
      .on("mouseleave", this.handleStreamMouseLeave);
    
    // Add X axis with formatted month names
    chart.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "middle")
      .attr("dy", "1em");
    
    // Create legend - now centered vertically
    this.createLegend(svg, innerHeight);
  }
  
  createLegend(svg, innerHeight) {
    // Calculate legend position to be vertically centered
    const legendX = this.DIMENSIONS.width - this.DIMENSIONS.margin.right + 20;
    const legendItemHeight = 25; // Height of each legend item
    const totalLegendHeight = this.MODELS.length * legendItemHeight;
    const legendY = (this.DIMENSIONS.margin.top + innerHeight/2) - (totalLegendHeight/2);
    
    const legend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);
    
    // Add legend items - using the reversed order defined in constructor
    this.MODELS.forEach((model, i) => {
      const legendItem = legend.append("g")
        .attr("transform", `translate(0, ${i * legendItemHeight})`);
      
      legendItem.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", this.MODEL_COLORS[model]);
      
      legendItem.append("text")
        .attr("x", 25)
        .attr("y", 12)
        .text(model);
    });
  }
  
  handleStreamMouseOver(event, d) {
    // Highlight the current stream
    d3.select(event.currentTarget)
      .attr("opacity", 1)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.5);
    
    // Show tooltip
    this.tooltip.style("opacity", 1);
  }
  
  handleStreamMouseMove(event, d) {
    // Position and update tooltip
    this.tooltip
      .style("left", `${event.pageX}px`)
      .style("top", `${event.pageY - 130}px`);
    
    // Create tooltip content
    this.createTooltipContent(d);
  }
  
  handleStreamMouseLeave(event) {
    // Reset the highlighted stream
    d3.select(event.currentTarget)
      .attr("opacity", 0.8)
      .attr("stroke", "none");
    
    // Hide tooltip
    this.tooltip.style("opacity", 0);
  }
  
  createTooltipContent(d) {
    const { data } = this.state;
    
    // Dimensions for the tooltip mini chart
    const tooltipWidth = 200;
    const tooltipHeight = 120;
    const tooltipMargin = { top: 5, right: 5, bottom: 30, left: 35 };
    const innerTooltipWidth = tooltipWidth - tooltipMargin.left - tooltipMargin.right;
    const innerTooltipHeight = tooltipHeight - tooltipMargin.top - tooltipMargin.bottom;
    
    // Clear previous tooltip content
    this.tooltip.html("");
    
    // Create SVG for the mini chart
    const tooltipSvg = this.tooltip.append("svg")
      .attr("width", tooltipWidth)
      .attr("height", tooltipHeight);
    
    const tooltipChart = tooltipSvg.append("g")
      .attr("transform", `translate(${tooltipMargin.left}, ${tooltipMargin.top})`);
    
    // X scale for the mini bar chart
    const tooltipX = d3.scaleBand()
      .domain(data.map(d => d.Date))
      .range([0, innerTooltipWidth])
      .padding(0.1);
    
    // Y scale for the mini bar chart
    const tooltipY = d3.scaleLinear()
      .domain([0, d3.max(data, dataPoint => dataPoint[d.key])])
      .range([innerTooltipHeight, 0]);
    
    // Draw mini bar chart background grid
    tooltipChart.selectAll(".grid-line")
      .data(tooltipY.ticks(5))
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", innerTooltipWidth)
      .attr("y1", d => tooltipY(d))
      .attr("y2", d => tooltipY(d))
      .attr("stroke", "#ddd")
      .attr("stroke-dasharray", "2,2");
    
    // Draw bars
    tooltipChart.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", dataPoint => tooltipX(dataPoint.Date))
      .attr("y", dataPoint => tooltipY(dataPoint[d.key]))
      .attr("width", tooltipX.bandwidth())
      .attr("height", dataPoint => innerTooltipHeight - tooltipY(dataPoint[d.key]))
      .attr("fill", this.MODEL_COLORS[d.key]);
    
    // Add X axis
    tooltipChart.append("g")
      .attr("transform", `translate(0, ${innerTooltipHeight})`)
      .call(d3.axisBottom(tooltipX)
        .tickValues(tooltipX.domain()))
      .selectAll("text")
      .style("text-anchor", "middle")
      .style("font-size", "8px");
    
    // Add Y axis
    tooltipChart.append("g")
      .call(d3.axisLeft(tooltipY).ticks(5))
      .selectAll("text")
      .style("font-size", "8px");
  }
  
  render() {
    const { isDataLoaded } = this.state;
    
    return (
      <div className="App">
        <div className="main-container">
          {!isDataLoaded && (
            <div className="left-container">
              <FileUpload set_data={this.setData} />
            </div>
          )}
          
          <div className="right-container">
            <div id="chart-container" ref={this.chartRef}></div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;