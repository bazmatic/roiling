import { useRef, useState, useEffect } from 'react'
import './App.css'
import { Grid } from './Grid';

interface SliderProps {
  label: string;
  value: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
  step: number;
  description?: string;
}

interface Settings {
  randomValues: number;
  speed: number;
  spatialSmoothing: number;
  temporalSmoothing: number;
  frameHistory: number;
  regressionWeight: number;
}

const MAX_CELL_HISTORY = 30;
const INITIAL_GRID_SIZE = 150;
const INITIAL_FRAME_HISTORY = 5;
const INITIAL_SPEED = 0.7;
const INITIAL_SPATIAL_SMOOTHING = 0.8;
const INITIAL_TEMPORAL_SMOOTHING = 0.7;
const INITIAL_REGRESSION_WEIGHT = 0.8;
const INITIAL_RANDOM_VALUES = 1; // For bell curve, 1 is uniform

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [randomValues, setRandomValues] = useState(INITIAL_RANDOM_VALUES);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [spatialSmoothing, setSpatialSmoothing] = useState(INITIAL_SPATIAL_SMOOTHING);
  const [temporalSmoothing, setTemporalSmoothing] = useState(INITIAL_TEMPORAL_SMOOTHING);
  const [frameHistory, setFrameHistory] = useState(INITIAL_FRAME_HISTORY);
  const [regressionWeight, setRegressionWeight] = useState(INITIAL_REGRESSION_WEIGHT);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  const newGrid = () => {
    return new Grid(INITIAL_GRID_SIZE, INITIAL_GRID_SIZE, frameHistory);
  }
  
  const gridRef = useRef<Grid>(newGrid());

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
    // Update grid when frameHistory changes
    gridRef.current = newGrid();
  }, [frameHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (timestamp: number): void => {
      // If we're trying to animate faster than 60 frames a second,
      // hang back.
      if (timestamp - lastUpdateRef.current < 16.67 / speed) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastUpdateRef.current = timestamp;

      // Update grid and get new values
      gridRef.current.update({
        randomValues,
        spatialSmoothing,
        temporalSmoothing,
        frameHistory,
        regressionWeight
      });

      // Get image data from grid
      const imageData = new ImageData(
        gridRef.current.getImageData(true),
        gridRef.current.dimensions.width,
        gridRef.current.dimensions.height
      );
      
      ctx.putImageData(imageData, 0, 0);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate(0);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [randomValues, speed, spatialSmoothing, temporalSmoothing, frameHistory, regressionWeight]);

  const resetSimulation = () => {
    gridRef.current.reset(frameHistory);
  };

  const getSettingsString = () => {
    const settings: Settings = {
      randomValues,
      speed,
      spatialSmoothing,
      temporalSmoothing,
      frameHistory,
      regressionWeight
    };
    return JSON.stringify(settings, null, 2);
  };

  const copySettings = async () => {
    try {
      await navigator.clipboard.writeText(getSettingsString());
      alert('Settings copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy settings:', err);
    }
  };

  return (
    <div className="container">
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={gridRef.current.dimensions.width}
          height={gridRef.current.dimensions.height}
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
        />
        <Slider
          label="Animation Speed"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          min={0.1}
          max={3}
          step={0.1}
        />
        <Slider
          label="Spatial Smoothing"
          value={spatialSmoothing}
          onChange={(e) => setSpatialSmoothing(parseFloat(e.target.value))}
          min={0}
          max={0.95}
          step={0.05}
        />
        <Slider
          label="Temporal Smoothing"
          value={temporalSmoothing}
          onChange={(e) => setTemporalSmoothing(parseFloat(e.target.value))}
          min={0}
          max={0.95}
          step={0.05}
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
          label="Regression Weight"
          value={regressionWeight}
          onChange={(e) => setRegressionWeight(parseFloat(e.target.value))}
          min={0}
          max={1}
          step={0.05}
        />
        <div className="settings-share">
          <div className="settings-header">
            <h3>Current Settings</h3>
            <button onClick={copySettings}>Copy Settings</button>
          </div>
          <textarea
            style={{display: 'none'}}
            readOnly
            value={getSettingsString()}
            className="settings-display"
          />
        </div>
      </div>
    </div>
  );
}

export default App 