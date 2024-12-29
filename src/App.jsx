// src/App.jsx
import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const canvasRef = useRef(null);
  const [randomValues, setRandomValues] = useState(5);
  const [speed, setSpeed] = useState(1);
  const [spatialSmoothing, setSpatialSmoothing] = useState(0.5);
  const [temporalSmoothing, setTemporalSmoothing] = useState(0.5);
  const [frameHistory, setFrameHistory] = useState(5);
  const [contrast, setContrast] = useState(0);
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(0);
  
  // Create circular buffer for frame history
  const historyBufferRef = useRef([]);
  const historyIndexRef = useRef(0);
  
  useEffect(() => {
    // Initialize or resize history buffer when frameHistory changes
    historyBufferRef.current = Array(frameHistory)
      .fill()
      .map(() => new Float32Array(100 * 100).fill(0));
    historyIndexRef.current = 0;
  }, [frameHistory]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(100, 100);
    const data = imageData.data;
    const tempBuffer = new Float32Array(100 * 100);
    const spatialBuffer = new Float32Array(100 * 100);
    
    const getWrappedValue = (buffer, x, y) => {
      const wrappedX = (x + 100) % 100;
      const wrappedY = (y + 100) % 100;
      return buffer[wrappedY * 100 + wrappedX];
    };

    const getSmoothNeighborhood = (buffer, x, y) => {
      const values = [
        getWrappedValue(buffer, x-1, y-1),
        getWrappedValue(buffer, x, y-1),
        getWrappedValue(buffer, x+1, y-1),
        getWrappedValue(buffer, x-1, y),
        getWrappedValue(buffer, x, y),
        getWrappedValue(buffer, x+1, y),
        getWrappedValue(buffer, x-1, y+1),
        getWrappedValue(buffer, x, y+1),
        getWrappedValue(buffer, x+1, y+1)
      ];
      
      const neighborWeight = spatialSmoothing / 8;
      const centerWeight = 1 - spatialSmoothing;
      
      return values[4] * centerWeight + 
             (values[0] + values[1] + values[2] + 
              values[3] + values[5] + 
              values[6] + values[7] + values[8]) * neighborWeight;
    };

    const blendWithHistory = (current) => {
      const result = new Float32Array(100 * 100);
      const historyWeight = temporalSmoothing / frameHistory;
      const currentWeight = 1 - temporalSmoothing;
      
      for (let i = 0; i < 10000; i++) {
        result[i] = current[i] * currentWeight;
        for (let f = 0; f < frameHistory; f++) {
          result[i] += historyBufferRef.current[f][i] * historyWeight;
        }
      }
      
      return result;
    };
    
    const animate = (timestamp) => {
      if (timestamp - lastUpdateRef.current < 16.67 / speed) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastUpdateRef.current = timestamp;
      
      // Generate new random values
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < 100; x++) {
          let sum = 0;
          for (let i = 0; i < randomValues; i++) {
            sum += Math.random();
          }
          const index = y * 100 + x;
          tempBuffer[index] = sum / randomValues;
        }
      }
      
      // Apply spatial smoothing
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < 100; x++) {
          const index = y * 100 + x;
          spatialBuffer[index] = getSmoothNeighborhood(tempBuffer, x, y);
        }
      }

      // Blend with history
      const blendedBuffer = blendWithHistory(spatialBuffer);
      
      // Update history buffer
      historyBufferRef.current[historyIndexRef.current].set(blendedBuffer);
      historyIndexRef.current = (historyIndexRef.current + 1) % frameHistory;
      
      // Apply contrast and convert to pixel data
      for (let i = 0; i < 10000; i++) {
        let value = blendedBuffer[i];
        value = value - 0.5;
        value = value * Math.exp(contrast);
        value = Math.max(0, Math.min(1, value + 0.5));
        
        const brightness = Math.floor(value * 255);
        const pixelIndex = i * 4;
        data[pixelIndex] = brightness;     // R
        data[pixelIndex + 1] = brightness; // G
        data[pixelIndex + 2] = brightness; // B
        data[pixelIndex + 3] = 255;        // A
      }
      
      ctx.putImageData(imageData, 0, 0);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate(0);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [randomValues, speed, spatialSmoothing, temporalSmoothing, frameHistory, contrast]);

  const Slider = ({ label, value, onChange, min, max, step, description }) => (
    <div className="slider-container">
      <div className="slider-header">
        <span>{label}: {typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span>{description}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
    </div>
  );
  
  return (
    <div className="container">
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        className="canvas"
      />
      <div className="controls">
        <Slider
          label="Random Values"
          value={randomValues}
          onChange={(e) => setRandomValues(parseInt(e.target.value))}
          min={1}
          max={10}
          step={1}
          description={randomValues === 1 ? 'Uniform' : 'More Normal'}
        />
        <Slider
          label="Animation Speed"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          min={0.1}
          max={3}
          step={0.1}
          description={speed === 0.1 ? 'Slow' : speed >= 2 ? 'Fast' : 'Normal'}
        />
        <Slider
          label="Spatial Smoothing"
          value={spatialSmoothing}
          onChange={(e) => setSpatialSmoothing(parseFloat(e.target.value))}
          min={0}
          max={0.95}
          step={0.05}
          description={spatialSmoothing < 0.3 ? 'Sharp' : spatialSmoothing > 0.7 ? 'Very Smooth' : 'Smooth'}
        />
        <Slider
          label="Temporal Smoothing"
          value={temporalSmoothing}
          onChange={(e) => setTemporalSmoothing(parseFloat(e.target.value))}
          min={0}
          max={0.95}
          step={0.05}
          description={temporalSmoothing < 0.3 ? 'Rapid' : temporalSmoothing > 0.7 ? 'Very Slow' : 'Smooth'}
        />
        <Slider
          label="History Frames"
          value={frameHistory}
          onChange={(e) => setFrameHistory(parseInt(e.target.value))}
          min={1}
          max={10}
          step={1}
          description={frameHistory <= 2 ? 'Short' : frameHistory >= 8 ? 'Long' : 'Medium'}
        />
        <Slider
          label="Contrast"
          value={contrast}
          onChange={(e) => setContrast(parseFloat(e.target.value))}
          min={-2}
          max={5}
          step={0.1}
          description={contrast < 0 ? 'Soft' : contrast > 3 ? 'Extreme' : contrast > 1 ? 'High' : 'Normal'}
        />
      </div>
    </div>
  )
}

export default App