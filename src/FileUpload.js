import React, { Component } from 'react';
import * as d3 from 'd3';

class FileUpload extends Component {
  state = { file: null };

  handleFileSubmit = (e) => {
    e.preventDefault(); // Prevent form from actually submitting
    if (this.state.file) { // Check if a file has been uploaded
      const reader = new FileReader(); // Create a new FileReader object
      reader.onload = (e) => { // Define the onload event handler
        const csvText = e.target.result; // Get the CSV text from the file
        const blob = new Blob([csvText], { type: 'text/csv' }); // Create a Blob from the CSV text
        const url = URL.createObjectURL(blob); // Create a URL for the Blob

        d3.csv(url).then((data) => { // Use d3.csv to parse the CSV data (asynchronously)
          // Format the data specifically for the LLM hashtag visualization
          const formattedData = data.map(d => ({
            Date: d.Date,
            "GPT-4": +d["GPT-4"] || 0,
            "Gemini": +d["Gemini"] || 0,
            "PaLM-2": +d["PaLM-2"] || 0,
            "Claude": +d["Claude"] || 0,
            "LLaMA-3.1": +d["LLaMA-3.1"] || 0
          }));
          this.props.set_data(formattedData); // Pass the formatted data to the parent component
          URL.revokeObjectURL(url); // Release the Blob URL to prevent memory leaks
        }).catch(error => {
          console.error("Error loading the data:", error);
          alert("Error parsing CSV file. Please check the format.");
        });
      };
      reader.readAsText(this.state.file); // Read the selected file as text
    }
  };

  render = () => (
    <div style={{ backgroundColor: "#f0f0f0", padding: 20 }}>
      <h2>Upload a CSV File</h2>
      <form onSubmit={this.handleFileSubmit}>
        <input type="file" accept=".csv" onChange={(e) => this.setState({ file: e.target.files[0] })} />
        <button type="submit">Upload</button>
      </form>
    </div>
  );
}

export default FileUpload;