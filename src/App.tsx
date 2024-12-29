import { useRef, useState, useEffect } from 'react'
import './App.css'

interface SliderProps {
  label: string;
  value: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
  step: number;
  description?: string;
}

interface RegressionResult {
  slope: number;
  intercept: number;
}

function linearRegression(history: number[]): RegressionResult {
  const n = history.length;
  if (n < 2) return { slope: 0, intercept: history[0] || 0 };
  
  const x = Array.from({length: n}, (_, i) => i);
  const y = history;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [randomValues, setRandomValues] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [spatialSmoothing, setSpatialSmoothing] = useState(0.5);
  const [temporalSmoothing, setTemporalSmoothing] = useState(0.5);
  const [frameHistory, setFrameHistory] = useState(5);
  const [contrast, setContrast] = useState(0);
  const [regressionWeight, setRegressionWeight] = useState(0.5);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  
  // Create circular buffer for frame history
  const historyBufferRef = useRef<Float32Array[]>([]);
  const historyIndexRef = useRef(0);
  
  // Create cell-wise history for regression
  const cellHistoryRef = useRef<number[][]>(Array(10000).fill(null).map(() => []));
  const MAX_CELL_HISTORY = 100;

  // Rest of the component remains the same, just add type annotations where TypeScript inference needs help

  const Slider: React.FC<SliderProps> = ({ label, value, onChange, min, max, step, description }) => (
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

  useEffect(() => {
    // Initialize or resize history buffer when frameHistory changes
    historyBufferRef.current = Array(frameHistory)
      .fill(null)
      .map(() => new Float32Array(100 * 100).fill(0));
    historyIndexRef.current = 0;
  }, [frameHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(100, 100);
    const data = imageData.data;
    const tempBuffer = new Float32Array(100 * 100);
    const spatialBuffer = new Float32Array(100 * 100);
    
    const getWrappedValue = (buffer: Float32Array, x: number, y: number): number => {
      const wrappedX = (x + 100) % 100;
      const wrappedY = (y + 100) % 100;
      return buffer[wrappedY * 100 + wrappedX];
    };

    const getSmoothNeighborhood = (buffer: Float32Array, x: number, y: number): number => {
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

    const predictNextValue = (index: number): number => {
      const history = cellHistoryRef.current[index];
      if (history.length < 2) return history[history.length - 1] || 0;
      
      const { slope, intercept } = linearRegression(history);
      return slope * history.length + intercept;
    };

    /**
     * Blend the current value with the history
     * @param current - The current value
     * @returns The blended value
     */
    const blendWithHistory = (current: Float32Array): Float32Array => {
      const result = new Float32Array(100 * 100);
      const historyWeight = temporalSmoothing / frameHistory;
      const currentWeight = 1 - temporalSmoothing;
      
      for (let i = 0; i < 10000; i++) {
        // Update cell history
        const cellHistory = cellHistoryRef.current[i];
        cellHistory.push(current[i]);
        if (cellHistory.length > MAX_CELL_HISTORY) {
          cellHistory.shift();
        }
        
        // Predict next value using regression
        const predicted = predictNextValue(i);
        
        // Calculate weighted contributions
        const currentContribution = current[i] * (1 - regressionWeight);
        const predictionContribution = predicted * regressionWeight;

        // Combine current value with regression prediction
        const blendedCurrent = currentContribution + predictionContribution;
        
        // Blend with temporal history
        result[i] = blendedCurrent * currentWeight;
        for (let f = 0; f < frameHistory; f++) {
          result[i] += historyBufferRef.current[f][i] * historyWeight;
        }
      }
      
      return result;
    };
    
    const animate = (timestamp: number): void => {
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

      // Blend with history and predictions
      const blendedBuffer = blendWithHistory(spatialBuffer);
      
      // Update history buffer
      historyBufferRef.current[historyIndexRef.current].set(blendedBuffer);
      historyIndexRef.current = (historyIndexRef.current + 1) % frameHistory;
      
      // Apply contrast and convert to pixel data
      let minValue = Infinity;
      let maxValue = -Infinity;
      for (let i = 0; i < 10000; i++) {
        let value = blendedBuffer[i];
        value = value - 0.5;
        value = value * Math.exp(contrast);
        value = value + 0.5;
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }

      // Now apply normalization and color mapping
      const range = maxValue - minValue;
      for (let i = 0; i < 10000; i++) {
        let value = blendedBuffer[i];
        value = value - 0.5;
        value = value * Math.exp(contrast);
        value = value + 0.5;
        
        // Normalize to [0,1] range
        value = (value - minValue) / range;
        
        const pixelIndex = i * 4;
        // Color interpolation
        if (value < 0.25) {
          // Black to Red (0.0 - 0.25)
          const t = value / 0.25;
          data[pixelIndex] = t * 255;     // R
          data[pixelIndex + 1] = 0;       // G
          data[pixelIndex + 2] = 0;       // B
        } else if (value < 0.5) {
          // Red to Orange (0.25 - 0.5)
          const t = (value - 0.25) / 0.25;
          data[pixelIndex] = 255;         // R
          data[pixelIndex + 1] = t * 165; // G (orange has G=165)
          data[pixelIndex + 2] = 0;       // B
        } else if (value < 0.75) {
          // Orange to Yellow (0.5 - 0.75)
          const t = (value - 0.5) / 0.25;
          data[pixelIndex] = 255;         // R
          data[pixelIndex + 1] = 165 + (t * (255-165)); // G (from 165 to 255)
          data[pixelIndex + 2] = 0;       // B
        } else {
          // Yellow to White (0.75 - 1.0)
          const t = (value - 0.75) / 0.25;
          data[pixelIndex] = 255;         // R
          data[pixelIndex + 1] = 255;     // G
          data[pixelIndex + 2] = t * 255; // B
        }
        data[pixelIndex + 3] = 255; // A
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
  }, [randomValues, speed, spatialSmoothing, temporalSmoothing, frameHistory, contrast, regressionWeight]);

  const resetSimulation = () => {
    // Clear history buffers
    historyBufferRef.current = Array(frameHistory)
      .fill(null)
      .map(() => new Float32Array(100 * 100).fill(0));
    historyIndexRef.current = 0;
    
    // Clear cell history
    cellHistoryRef.current = Array(10000).fill(null).map(() => []);
  };

  return (
    <div className="container">
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={100}
          height={100}
          className="canvas"
        />
        <button className="reset-button" onClick={resetSimulation}>
          Reset
        </button>
      </div>
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
          max={MAX_CELL_HISTORY}
          step={1}
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
        <Slider
          label="Regression Weight"
          value={regressionWeight}
          onChange={(e) => setRegressionWeight(parseFloat(e.target.value))}
          min={0}
          max={1}
          step={0.05}
          description={regressionWeight < 0.3 ? 'Light' : regressionWeight > 0.7 ? 'Heavy' : 'Balanced'}
        />
      </div>
    </div>
  );
}

export default App 